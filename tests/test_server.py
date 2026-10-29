"""
Automated unit and integration test suite for the Offline Quiz Application.
Tests database operations, API endpoints, image uploading, and scoring.
"""

import os
import sys
import json
import base64
import unittest
import threading
import urllib.request
import urllib.error

# Add parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database
import seed_data
from server import QuizRequestHandler, ThreadingHTTPServer

TEST_PORT = 8991
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"


class TestQuizApp(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Point database to an isolated test db so user's real database is never touched
        cls.orig_turso_url = database.TURSO_DATABASE_URL
        database.TURSO_DATABASE_URL = None
        cls.orig_db_path = database.DB_PATH
        cls.test_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_quiz.db")
        database.DB_PATH = cls.test_db_path
        if os.path.exists(cls.test_db_path):
            os.remove(cls.test_db_path)

        # Seed sample data into isolated test database for test suite execution
        seed_data.seed_database(force=True)

        # Start HTTP server on test port in background thread
        cls.server = ThreadingHTTPServer(("127.0.0.1", TEST_PORT), QuizRequestHandler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        database.DB_PATH = cls.orig_db_path
        database.TURSO_DATABASE_URL = cls.orig_turso_url
        if os.path.exists(cls.test_db_path):
            try:
                os.remove(cls.test_db_path)
            except OSError:
                pass
        # Clean any SVG/uploads created during test run
        for svg in ["von_neumann.svg", "logic_gate.svg", "cell_organelle.svg"]:
            p = os.path.join(seed_data.UPLOADS_DIR, svg)
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass

    def test_01_database_operations(self):
        """Test database CRUD and stats."""
        quizzes = database.list_quizzes()
        self.assertGreaterEqual(len(quizzes), 1)

        first_id = quizzes[0]["id"]
        quiz = database.get_quiz(first_id)
        self.assertIsNotNone(quiz)
        self.assertTrue(len(quiz["questions"]) > 0)
        self.assertTrue(len(quiz["questions"][0]["options"]) >= 2)

        stats = database.get_overall_stats()
        self.assertGreaterEqual(stats["total_quizzes"], 1)
        self.assertGreaterEqual(stats["total_questions"], 1)

    def test_02_api_list_and_get_quizzes(self):
        """Test GET /api/quizzes and GET /api/quizzes/<id>."""
        req = urllib.request.Request(f"{BASE_URL}/api/quizzes")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertGreaterEqual(len(data["quizzes"]), 1)
            quiz_id = data["quizzes"][0]["id"]

        req = urllib.request.Request(f"{BASE_URL}/api/quizzes/{quiz_id}")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertEqual(data["quiz"]["id"], quiz_id)

    def test_03_api_create_and_delete_quiz(self):
        """Test teacher PIN authorization for POST /api/quizzes and DELETE /api/quizzes/<id>, plus student attempt metadata."""
        new_quiz = {
            "title": "Automated Test Quiz",
            "description": "Integration test quiz",
            "category": "Testing",
            "time_limit_minutes": 5,
            "questions": [
                {
                    "question_text": "Is this test working?",
                    "image_url": "",
                    "explanation": "Yes, unit test is running.",
                    "options": [
                        {"option_text": "Yes", "is_correct": True},
                        {"option_text": "No", "is_correct": False}
                    ]
                }
            ]
        }
        body = json.dumps(new_quiz).encode("utf-8")

        # 1. Attempt creation WITHOUT teacher PIN -> Expect 403 Forbidden
        unauth_req = urllib.request.Request(
            f"{BASE_URL}/api/quizzes",
            data=body,
            headers={"Content-Type": "application/json"}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(unauth_req)
        self.assertEqual(ctx.exception.code, 403)

        # 2. Authorized creation WITH teacher PIN -> Expect 201 Created
        auth_req = urllib.request.Request(
            f"{BASE_URL}/api/quizzes",
            data=body,
            headers={"Content-Type": "application/json", "X-Teacher-PIN": "2026"}
        )
        with urllib.request.urlopen(auth_req) as resp:
            self.assertEqual(resp.status, 201)
            data = json.loads(resp.read().decode("utf-8"))
            created_id = data["quiz"]["id"]
            self.assertEqual(data["quiz"]["title"], "Automated Test Quiz")

        # 3. Record student attempt with candidate metadata and violations
        attempt_body = json.dumps({
            "score": 1,
            "total_questions": 1,
            "time_taken_seconds": 15,
            "answers": {"1": 1},
            "student_name": "Test Candidate Rahul",
            "student_roll": "ROLL-2026",
            "violations_count": 2
        }).encode("utf-8")
        att_req = urllib.request.Request(
            f"{BASE_URL}/api/quizzes/{created_id}/attempts",
            data=attempt_body,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(att_req) as resp:
            self.assertEqual(resp.status, 201)
            att_data = json.loads(resp.read().decode("utf-8"))
            attempt_id = att_data["attempt_id"]

        # Verify candidate metadata is persisted
        detail = database.get_attempt_detail(attempt_id)
        self.assertEqual(detail["student_name"], "Test Candidate Rahul")
        self.assertEqual(detail["student_roll"], "ROLL-2026")
        self.assertEqual(detail["violations_count"], 2)

        # 4. Attempt quiz deletion WITHOUT PIN -> Expect 403 Forbidden
        del_unauth_req = urllib.request.Request(
            f"{BASE_URL}/api/quizzes/{created_id}",
            method="DELETE"
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(del_unauth_req)
        self.assertEqual(ctx.exception.code, 403)

        # 5. Delete quiz WITH Teacher PIN -> Expect 200 OK
        del_req = urllib.request.Request(
            f"{BASE_URL}/api/quizzes/{created_id}",
            method="DELETE",
            headers={"X-Teacher-PIN": "2026"}
        )
        with urllib.request.urlopen(del_req) as resp:
            self.assertEqual(resp.status, 200)

        # Verify it's gone
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(f"{BASE_URL}/api/quizzes/{created_id}")
        self.assertEqual(ctx.exception.code, 404)

    def test_04_api_upload_base64(self):
        """Test POST /api/upload using base64 image data."""
        # 1x1 transparent png in base64
        tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        payload = json.dumps({
            "data": tiny_png_b64,
            "extension": ".png"
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{BASE_URL}/api/upload",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertTrue(data["url"].startswith("/uploads/img_"))

            # Verify the uploaded image can be fetched via GET
            img_req = urllib.request.Request(f"{BASE_URL}{data['url']}")
            with urllib.request.urlopen(img_req) as img_resp:
                self.assertEqual(img_resp.status, 200)
                self.assertEqual(img_resp.headers.get("Content-Type"), "image/png")

        # Test database persistence: delete from disk cache and ensure GET still succeeds via DB fallback
        uploaded_fname = data["url"].split("/")[-1]
        uploaded_fpath = os.path.join(seed_data.UPLOADS_DIR, uploaded_fname)
        if os.path.exists(uploaded_fpath):
            os.remove(uploaded_fpath)
        self.assertFalse(os.path.exists(uploaded_fpath))

        with urllib.request.urlopen(img_req) as img_resp2:
            self.assertEqual(img_resp2.status, 200)
            self.assertEqual(img_resp2.headers.get("Content-Type"), "image/png")

        # Clean up test uploaded image from disk and DB
        if os.path.exists(uploaded_fpath):
            try:
                os.remove(uploaded_fpath)
            except OSError:
                pass
        conn = database.get_db_connection()
        c = conn.cursor()
        c.execute("DELETE FROM uploaded_images WHERE filename = ?", (uploaded_fname,))
        conn.commit()
        conn.close()

    def test_05_static_file_serving(self):
        """Test GET / serves index.html and static assets."""
        with urllib.request.urlopen(f"{BASE_URL}/") as resp:
            self.assertEqual(resp.status, 200)
            content = resp.read().decode("utf-8")
            self.assertIn("QuizMaster", content)

        with urllib.request.urlopen(f"{BASE_URL}/static/css/styles.css") as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn("text/css", resp.headers.get("Content-Type"))

        # Test serving a static upload file with cleanup
        test_svg_path = os.path.join(seed_data.UPLOADS_DIR, "test_file.svg")
        with open(test_svg_path, "w", encoding="utf-8") as f:
            f.write("<svg></svg>")
        try:
            with urllib.request.urlopen(f"{BASE_URL}/uploads/test_file.svg") as resp:
                self.assertEqual(resp.status, 200)
                self.assertIn("image/svg+xml", resp.headers.get("Content-Type"))
        finally:
            if os.path.exists(test_svg_path):
                try:
                    os.remove(test_svg_path)
                except OSError:
                    pass

    def test_06_api_attempts_history(self):
        """Test GET /api/attempts privacy isolation by student PIN and teacher audit access."""
        # 1. Unauthenticated student with no PIN -> returns empty list []
        req = urllib.request.Request(f"{BASE_URL}/api/attempts")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertEqual(data["attempts"], [])

        # Record test attempts for two distinct students
        quizzes = database.list_quizzes()
        qid = quizzes[0]["id"]

        att_a_id = database.record_attempt(
            quiz_id=qid, score=3, total_questions=5, time_taken_seconds=60,
            answers={}, student_name="Student Alpha", student_roll="123456"
        )
        att_b_id = database.record_attempt(
            quiz_id=qid, score=4, total_questions=5, time_taken_seconds=50,
            answers={}, student_name="Student Beta", student_roll="654321"
        )

        # 2. Student Alpha queries attempts with X-Student-PIN: 123456
        alpha_req = urllib.request.Request(
            f"{BASE_URL}/api/attempts",
            headers={"X-Student-PIN": "123456"}
        )
        with urllib.request.urlopen(alpha_req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            rolls = [a["student_roll"] for a in data["attempts"]]
            self.assertIn("123456", rolls)
            self.assertNotIn("654321", rolls)

        # 3. Student Beta cannot access Student Alpha's attempt detail (403 Forbidden)
        forbidden_req = urllib.request.Request(
            f"{BASE_URL}/api/attempts/{att_a_id}",
            headers={"X-Student-PIN": "654321"}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(forbidden_req)
        self.assertEqual(ctx.exception.code, 403)

        # 4. Student Alpha CAN access their own attempt detail (200 OK)
        allowed_req = urllib.request.Request(
            f"{BASE_URL}/api/attempts/{att_a_id}",
            headers={"X-Student-PIN": "123456"}
        )
        with urllib.request.urlopen(allowed_req) as resp:
            self.assertEqual(resp.status, 200)
            det_data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(det_data["success"])
            self.assertEqual(det_data["attempt"]["student_roll"], "123456")

        # 5. Teacher Mode sees all attempts across all students
        teacher_req = urllib.request.Request(
            f"{BASE_URL}/api/attempts",
            headers={"X-Teacher-PIN": "2026"}
        )
        with urllib.request.urlopen(teacher_req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            teacher_rolls = [a["student_roll"] for a in data["attempts"]]
            self.assertIn("123456", teacher_rolls)
            self.assertIn("654321", teacher_rolls)
    def test_07_missed_questions_calculation(self):
        """Test recording an attempt with incorrect answers and verifying missed questions identification."""
        quizzes = database.list_quizzes()
        self.assertGreaterEqual(len(quizzes), 1)
        quiz = None
        for q in quizzes:
            cand = database.get_quiz(q["id"])
            if cand and len(cand.get("questions", [])) >= 2:
                quiz = cand
                break
        self.assertIsNotNone(quiz, "Should find a quiz with at least 2 questions")
        self.assertGreaterEqual(len(quiz["questions"]), 2)

        # Build an attempt where question 0 is correct and question 1 is wrong
        q0 = quiz["questions"][0]
        q1 = quiz["questions"][1]
        correct_opt_0 = [o for o in q0["options"] if o["is_correct"]][0]
        wrong_opt_1 = [o for o in q1["options"] if not o["is_correct"]][0]

        answers = {
            str(q0["id"]): correct_opt_0["id"],
            str(q1["id"]): wrong_opt_1["id"]
        }

        att_id = database.record_attempt(
            quiz_id=quiz["id"],
            score=1,
            total_questions=len(quiz["questions"]),
            time_taken_seconds=45,
            answers=answers
        )
        self.assertIsNotNone(att_id)

        detail = database.get_attempt_detail(att_id)
        self.assertIsNotNone(detail)
        self.assertEqual(detail["score"], 1)

        # Calculate missed questions
        stored_answers = detail["answers"]
        missed = []
        for q in detail["quiz"]["questions"]:
            chosen_opt_id = stored_answers.get(str(q["id"]))
            correct_opts = [o["id"] for o in q["options"] if o["is_correct"]]
            if chosen_opt_id not in correct_opts:
                missed.append(q["id"])

        self.assertIn(q1["id"], missed)
        self.assertNotIn(q0["id"], missed)

    def test_08_jee_marking_scheme_and_integer_no_penalty(self):
        """
        Verify exact JEE Marking Scheme:
        - MCQ correct: +4
        - MCQ wrong: -1
        - Numerical Integer correct: +4
        - Numerical Integer wrong: STRICTLY 0 penalty (no negative marking)
        Total Net Marks = (+4) + (-1) + (+4) + (0) = +7 / 16
        """
        quiz_data = {
            "title": "JEE Marking Scheme Integration Test",
            "description": "Physics & Chemistry mock",
            "category": "JEE Advanced",
            "time_limit_minutes": 10,
            "positive_marks": 4.0,
            "negative_marks": 1.0,
            "questions": [
                {
                    "question_text": "MCQ Question 1",
                    "question_type": "mcq",
                    "options": [
                        {"option_text": "Correct A", "is_correct": True},
                        {"option_text": "Wrong B", "is_correct": False}
                    ]
                },
                {
                    "question_text": "MCQ Question 2",
                    "question_type": "mcq",
                    "options": [
                        {"option_text": "Wrong A", "is_correct": False},
                        {"option_text": "Correct B", "is_correct": True}
                    ]
                },
                {
                    "question_text": "Integer Question 3",
                    "question_type": "integer",
                    "correct_numerical_value": 25.0,
                    "numerical_tolerance": 0.1,
                    "options": []
                },
                {
                    "question_text": "Integer Question 4",
                    "question_type": "integer",
                    "correct_numerical_value": -10.0,
                    "numerical_tolerance": 0.0,
                    "options": []
                }
            ]
        }

        # Create quiz via API
        body = json.dumps(quiz_data).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}/api/quizzes",
            data=body,
            headers={"Content-Type": "application/json", "X-Teacher-PIN": "2026"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 201)
            data = json.loads(resp.read().decode("utf-8"))
            quiz_id = data["quiz"]["id"]

        fetched_quiz = database.get_quiz(quiz_id)
        q1 = fetched_quiz["questions"][0]  # MCQ
        q2 = fetched_quiz["questions"][1]  # MCQ
        q3 = fetched_quiz["questions"][2]  # Integer
        q4 = fetched_quiz["questions"][3]  # Integer

        correct_opt_q1 = [o["id"] for o in q1["options"] if o["is_correct"]][0]
        wrong_opt_q2 = [o["id"] for o in q2["options"] if not o["is_correct"]][0]

        # Answers payload:
        # q1: correct MCQ (+4)
        # q2: wrong MCQ (-1)
        # q3: correct integer 25.05 within 0.1 tolerance (+4)
        # q4: wrong integer 99.0 -> STRICT 0 penalty (no deduction!)
        user_answers = {
            str(q1["id"]): correct_opt_q1,
            str(q2["id"]): wrong_opt_q2,
            str(q3["id"]): "25.05",
            str(q4["id"]): "99.0"
        }

        att_payload = json.dumps({
            "score": 2,
            "total_questions": 4,
            "time_taken_seconds": 60,
            "answers": user_answers
        }).encode("utf-8")

        att_req = urllib.request.Request(
            f"{BASE_URL}/api/quizzes/{quiz_id}/attempts",
            data=att_payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(att_req) as resp:
            self.assertEqual(resp.status, 201)
            att_data = json.loads(resp.read().decode("utf-8"))
            attempt_id = att_data["attempt_id"]

        detail = database.get_attempt_detail(attempt_id)
        self.assertIsNotNone(detail)

        # Assert correct count
        self.assertEqual(detail["score"], 2)
        # Assert Gross Earned = 8.0 (+4 + +4)
        self.assertEqual(detail["positive_score"], 8.0)
        # Assert Negative Penalty = 1.0 (Only q2 MCQ penalized, q4 Integer has 0 penalty)
        self.assertEqual(detail["negative_penalty"], 1.0)
        # Assert Net Marks = 7.0 (8.0 - 1.0)
        self.assertEqual(detail["net_marks"], 7.0)
        # Assert Max Marks = 16.0
        self.assertEqual(detail["max_marks"], 16.0)

        # Clean up test quiz
        database.delete_quiz(quiz_id)

    def test_09_delete_attempts(self):
        """Test deleting a single attempt and deleting all attempts via API endpoints with teacher authorization."""
        quizzes = database.list_quizzes()
        self.assertGreaterEqual(len(quizzes), 1)
        quiz_id = quizzes[0]["id"]

        # Record two attempts
        att_id_1 = database.record_attempt(quiz_id, 1, 1, 10, {})
        att_id_2 = database.record_attempt(quiz_id, 1, 1, 20, {})
        self.assertIsNotNone(att_id_1)
        self.assertIsNotNone(att_id_2)

        # Delete single attempt without PIN -> Expect 403
        unauth_req = urllib.request.Request(f"{BASE_URL}/api/attempts/{att_id_1}", method="DELETE")
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(unauth_req)
        self.assertEqual(ctx.exception.code, 403)

        # Delete single attempt with PIN -> Expect 200
        req = urllib.request.Request(
            f"{BASE_URL}/api/attempts/{att_id_1}",
            method="DELETE",
            headers={"X-Teacher-PIN": "2026"}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])

        # Verify att_id_1 is gone
        self.assertIsNone(database.get_attempt_detail(att_id_1))
        # Verify att_id_2 still exists
        self.assertIsNotNone(database.get_attempt_detail(att_id_2))

        # Delete all attempts with PIN
        req_all = urllib.request.Request(
            f"{BASE_URL}/api/attempts",
            method="DELETE",
            headers={"X-Teacher-PIN": "2026"}
        )
        with urllib.request.urlopen(req_all) as resp_all:
            self.assertEqual(resp_all.status, 200)
            data_all = json.loads(resp_all.read().decode("utf-8"))
            self.assertTrue(data_all["success"])

        # Verify all attempts are cleared
        self.assertEqual(len(database.list_all_attempts()), 0)

    def test_10_katex_assets_and_latex_support(self):
        """Test serving KaTeX assets, fonts, and storing LaTeX questions with determinants and chemical equations."""
        # 1. Verify KaTeX JS asset
        req_js = urllib.request.Request(f"{BASE_URL}/static/vendor/katex/katex.min.js")
        with urllib.request.urlopen(req_js) as resp:
            self.assertEqual(resp.status, 200)
            self.assertTrue(len(resp.read()) > 50000)

        # 2. Verify KaTeX CSS asset
        req_css = urllib.request.Request(f"{BASE_URL}/static/vendor/katex/katex.min.css")
        with urllib.request.urlopen(req_css) as resp:
            self.assertEqual(resp.status, 200)
            content_type = resp.headers.get("Content-Type", "")
            self.assertIn("text/css", content_type)

        # 3. Verify KaTeX mhchem extension asset
        req_mhchem = urllib.request.Request(f"{BASE_URL}/static/vendor/katex/contrib/mhchem.min.js")
        with urllib.request.urlopen(req_mhchem) as resp:
            self.assertEqual(resp.status, 200)

        # 4. Verify KaTeX font asset
        req_font = urllib.request.Request(f"{BASE_URL}/static/vendor/katex/fonts/KaTeX_Main-Regular.woff2")
        with urllib.request.urlopen(req_font) as resp:
            self.assertEqual(resp.status, 200)
            content_type = resp.headers.get("Content-Type", "")
            self.assertIn("font/woff2", content_type)

        # 5. Create an assessment containing determinants and chemical equations
        latex_quiz = {
            "title": "Advanced Science: Determinants & Chemistry",
            "description": "Assessment testing linear algebra determinants and chemical equilibrium",
            "category": "Science",
            "time_limit_minutes": 15,
            "positive_marks": 4.0,
            "negative_marks": 1.0,
            "questions": [
                {
                    "question_type": "mcq",
                    "question_text": "Compute the determinant of the matrix: $\\begin{vmatrix} 1 & 3 \\\\ 2 & 8 \\end{vmatrix}$",
                    "explanation": "Determinant calculation: (1 * 8) - (3 * 2) = 8 - 6 = 2.",
                    "options": [
                        {"option_text": "2", "is_correct": True},
                        {"option_text": "14", "is_correct": False},
                        {"option_text": "\\begin{vmatrix} 2 & 0 \\\\ 0 & 1 \\end{vmatrix}", "is_correct": False},
                        {"option_text": "-2", "is_correct": False}
                    ]
                },
                {
                    "question_type": "mcq",
                    "question_text": "Which balanced equation represents the Haber-Bosch process for ammonia synthesis?",
                    "explanation": "Nitrogen gas reacts with hydrogen gas to form ammonia: $\\ce{N2 + 3H2 <=> 2NH3}$.",
                    "options": [
                        {"option_text": "\\ce{N2 + 3H2 <=> 2NH3}", "is_correct": True},
                        {"option_text": "\\ce{NO + H2 -> NH3}", "is_correct": False},
                        {"option_text": "\\ce{N2 + O2 -> 2NO}", "is_correct": False},
                        {"option_text": "\\ce{2NH3 -> N2 + 3H2}", "is_correct": False}
                    ]
                }
            ]
        }

        req = urllib.request.Request(
            f"{BASE_URL}/api/quizzes",
            data=json.dumps(latex_quiz).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Teacher-PIN": "2026"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 201)
            data = json.loads(resp.read().decode("utf-8"))
            quiz_id = data["quiz"]["id"]

        # Fetch and verify quiz questions and options
        req_get = urllib.request.Request(f"{BASE_URL}/api/quizzes/{quiz_id}")
        with urllib.request.urlopen(req_get) as resp_get:
            self.assertEqual(resp_get.status, 200)
            fetched = json.loads(resp_get.read().decode("utf-8"))["quiz"]
            self.assertEqual(len(fetched["questions"]), 2)
            self.assertIn("\\begin{vmatrix}", fetched["questions"][0]["question_text"])
            self.assertIn("\\ce{N2 + 3H2 <=> 2NH3}", fetched["questions"][1]["options"][0]["option_text"])

        # Clean up
        database.delete_quiz(quiz_id)

    def test_11_teacher_verify_endpoint(self):
        """Test POST /api/teacher/verify with invalid and valid PINs."""
        # 1. Invalid PIN -> 403 Forbidden
        bad_req = urllib.request.Request(
            f"{BASE_URL}/api/teacher/verify",
            data=json.dumps({"pin": "wrong-pin"}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(bad_req)
        self.assertEqual(ctx.exception.code, 403)

        # 2. Valid PIN -> 200 OK
        good_req = urllib.request.Request(
            f"{BASE_URL}/api/teacher/verify",
            data=json.dumps({"pin": "2026"}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(good_req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])

    def test_12_atomic_idempotent_quiz_creation_and_submission(self):
        """Test rapid duplicate requests return idempotent responses without duplicate records."""
        quiz_payload = {
            "title": "Idempotency Test Quiz",
            "subject": "Testing",
            "grade": "12",
            "difficulty": "Easy",
            "time_limit_minutes": 5,
            "questions": [
                {
                    "question_text": "Is duplicate creation prevented?",
                    "options": [
                        {"option_text": "Yes", "is_correct": True},
                        {"option_text": "No", "is_correct": False}
                    ]
                }
            ]
        }

        # 1. First POST /api/quizzes
        req1 = urllib.request.Request(
            f"{BASE_URL}/api/quizzes",
            data=json.dumps(quiz_payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Teacher-PIN": "2026"},
            method="POST"
        )
        with urllib.request.urlopen(req1) as resp1:
            self.assertEqual(resp1.status, 201)
            data1 = json.loads(resp1.read().decode("utf-8"))
            quiz_id_1 = data1["quiz"]["id"]

        # 2. Rapid duplicate POST /api/quizzes with same payload
        req2 = urllib.request.Request(
            f"{BASE_URL}/api/quizzes",
            data=json.dumps(quiz_payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Teacher-PIN": "2026"},
            method="POST"
        )
        with urllib.request.urlopen(req2) as resp2:
            self.assertEqual(resp2.status, 201)
            data2 = json.loads(resp2.read().decode("utf-8"))
            quiz_id_2 = data2["quiz"]["id"]

        # Must return the identical quiz ID from idempotency cache
        self.assertEqual(quiz_id_1, quiz_id_2)

        # 3. Test attempt submission idempotency
        attempt_payload = {
            "score": 1,
            "total_questions": 1,
            "time_taken_seconds": 25,
            "student_name": "Atomic Student",
            "student_roll": "123456",
            "answers": {"1": "Yes"}
        }

        att_req1 = urllib.request.Request(
            f"{BASE_URL}/api/quizzes/{quiz_id_1}/attempts",
            data=json.dumps(attempt_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(att_req1) as att_resp1:
            self.assertEqual(att_resp1.status, 201)
            att_data1 = json.loads(att_resp1.read().decode("utf-8"))
            attempt_id_1 = att_data1["attempt_id"]

        # Rapid duplicate attempt submission
        att_req2 = urllib.request.Request(
            f"{BASE_URL}/api/quizzes/{quiz_id_1}/attempts",
            data=json.dumps(attempt_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(att_req2) as att_resp2:
            self.assertEqual(att_resp2.status, 201)
            att_data2 = json.loads(att_resp2.read().decode("utf-8"))
            attempt_id_2 = att_data2["attempt_id"]

        # Must return the identical attempt ID
        self.assertEqual(attempt_id_1, attempt_id_2)

        # Cleanup test quiz
        database.delete_quiz(quiz_id_1)


if __name__ == "__main__":
    unittest.main()
