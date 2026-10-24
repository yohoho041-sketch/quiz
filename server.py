"""
Offline Quiz Server for Solus Linux.
Pure Python standard library (http.server, sqlite3, json, cgi/email, uuid).
Zero external dependencies, 100% offline.
"""

import os
import sys
import json
import uuid
import time
import threading
import mimetypes
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import database

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    UPLOADS_DIR = "/tmp/uploads"
else:
    UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

try:
    os.makedirs(UPLOADS_DIR, exist_ok=True)
except Exception:
    pass

try:
    os.makedirs(STATIC_DIR, exist_ok=True)
except Exception:
    pass


TEACHER_PIN = os.environ.get("TEACHER_PIN", "2026")


def is_teacher_authorized(headers) -> bool:
    """Validate teacher PIN from X-Teacher-PIN or Authorization header."""
    pin = headers.get("X-Teacher-PIN") or headers.get("x-teacher-pin")
    if not pin:
        auth_hdr = headers.get("Authorization", "")
        if auth_hdr.startswith("Bearer "):
            pin = auth_hdr[7:].strip()
    return bool(pin and pin == TEACHER_PIN)


TEACHER_PIN_ATTEMPTS = {}  # client_ip -> {"count": int, "locked_until": float}


def is_client_locked_out(client_ip: str) -> bool:
    info = TEACHER_PIN_ATTEMPTS.get(client_ip)
    if info and info.get("locked_until", 0) > time.time():
        return True
    return False


def record_pin_attempt(client_ip: str, is_success: bool):
    if is_success:
        TEACHER_PIN_ATTEMPTS.pop(client_ip, None)
    else:
        info = TEACHER_PIN_ATTEMPTS.setdefault(client_ip, {"count": 0, "locked_until": 0})
        info["count"] += 1
        if info["count"] >= 5:
            info["locked_until"] = time.time() + 900  # Lock out for 15 minutes


class QuizRequestHandler(BaseHTTPRequestHandler):
    server_version = "QuizApp/1.0"

    def log_message(self, format, *args):
        # Clean terminal logging
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message, status=400):
        self.send_json({"error": message, "success": False}, status=status)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Teacher-PIN, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # Serve API routes
        if path.startswith("/api/"):
            return self.handle_api_get(path)

        # Serve static files and uploads
        return self.handle_static_get(path)

    def handle_static_get(self, path):
        if path == "/" or path == "/index.html":
            file_path = os.path.join(STATIC_DIR, "index.html")
        elif path.startswith("/uploads/"):
            rel_path = path[len("/uploads/"):].lstrip("/")
            file_path = os.path.join(UPLOADS_DIR, rel_path)
        elif path.startswith("/static/"):
            rel_path = path[len("/static/"):].lstrip("/")
            file_path = os.path.join(STATIC_DIR, rel_path)
        else:
            file_path = os.path.join(STATIC_DIR, path.lstrip("/"))

        # Prevent directory traversal attacks
        real_file = os.path.realpath(file_path)
        if not (real_file.startswith(os.path.realpath(STATIC_DIR)) or real_file.startswith(os.path.realpath(UPLOADS_DIR))):
            self.send_error(403, "Forbidden")
            return

        if not os.path.exists(file_path) or os.path.isdir(file_path):
            # Fallback to index.html for client-side routing if not found
            index_path = os.path.join(STATIC_DIR, "index.html")
            if os.path.exists(index_path) and not path.startswith("/uploads/"):
                file_path = index_path
            else:
                self.send_error(404, "File Not Found")
                return

        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type is None:
            if file_path.endswith(".svg"):
                mime_type = "image/svg+xml"
            elif file_path.endswith(".woff2"):
                mime_type = "font/woff2"
            elif file_path.endswith(".woff"):
                mime_type = "font/woff"
            elif file_path.endswith(".ttf"):
                mime_type = "font/ttf"
            elif file_path.endswith(".css"):
                mime_type = "text/css"
            elif file_path.endswith(".js"):
                mime_type = "application/javascript"
            else:
                mime_type = "application/octet-stream"

        try:
            stat = os.stat(file_path)
            etag = f'"{int(stat.st_mtime)}-{stat.st_size}"'

            if_none_match = self.headers.get("If-None-Match")
            if if_none_match and if_none_match == etag:
                self.send_response(304)
                self.end_headers()
                return

            with open(file_path, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", f"{mime_type}; charset=utf-8" if mime_type.startswith("text/") or mime_type == "application/json" else mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("ETag", etag)
            if path.startswith("/uploads/"):
                self.send_header("Cache-Control", "public, max-age=86400")
            else:
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Pragma", "no-cache")
                self.send_header("Expires", "0")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Internal server error: {e}")

    def handle_api_get(self, path):
        parts = [p for p in path.split("/") if p]
        # parts: ['api', ...]

        # GET /api/app/quit
        if len(parts) == 3 and parts[1] == "app" and parts[2] == "quit":
            self.send_json({"success": True, "message": "App shutting down"})
            threading.Thread(target=lambda: (time.sleep(0.3), os._exit(0)), daemon=True).start()
            return

        if len(parts) == 2 and parts[1] == "quizzes":
            # GET /api/quizzes
            quizzes = database.list_quizzes()
            return self.send_json({"success": True, "quizzes": quizzes})

        if len(parts) == 3 and parts[1] == "quizzes":
            # GET /api/quizzes/<id>
            try:
                quiz_id = int(parts[2])
            except ValueError:
                return self.send_error_json("Invalid quiz ID", 400)

            quiz = database.get_quiz(quiz_id)
            if not quiz:
                return self.send_error_json("Quiz not found", 404)
            return self.send_json({"success": True, "quiz": quiz})

        if len(parts) == 4 and parts[1] == "quizzes" and parts[3] == "attempts":
            # GET /api/quizzes/<id>/attempts
            try:
                quiz_id = int(parts[2])
            except ValueError:
                return self.send_error_json("Invalid quiz ID", 400)

            attempts = database.get_quiz_attempts(quiz_id)
            return self.send_json({"success": True, "attempts": attempts})

        if len(parts) == 2 and parts[1] == "attempts":
            # GET /api/attempts
            # If teacher is authorized, return all submissions.
            # If student, only return attempts matching their student PIN!
            if is_teacher_authorized(self.headers):
                attempts = database.list_all_attempts()
            else:
                student_pin = self.headers.get("X-Student-PIN") or self.headers.get("x-student-pin")
                if not student_pin:
                    # check parsed query param
                    parsed_query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                    student_pin = (parsed_query.get("student_pin") or [""])[0]

                if not student_pin:
                    # Student not logged in: return empty attempts to protect privacy
                    return self.send_json({"success": True, "attempts": []})

                attempts = database.list_all_attempts(student_pin=student_pin)

            return self.send_json({"success": True, "attempts": attempts})

        if len(parts) == 3 and parts[1] == "attempts":
            # GET /api/attempts/<id>
            try:
                attempt_id = int(parts[2])
            except ValueError:
                return self.send_error_json("Invalid attempt ID", 400)

            detail = database.get_attempt_detail(attempt_id)
            if not detail:
                return self.send_error_json("Attempt record not found", 404)

            # Privacy protection: if not teacher, ensure attempt belongs to this student PIN
            if not is_teacher_authorized(self.headers):
                student_pin = self.headers.get("X-Student-PIN") or self.headers.get("x-student-pin")
                if not student_pin:
                    parsed_query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                    student_pin = (parsed_query.get("student_pin") or [""])[0]
                if not student_pin or str(detail.get("student_roll", "")).strip() != str(student_pin).strip():
                    return self.send_error_json("Access denied: Attempt record belongs to another student", 403)

            return self.send_json({"success": True, "attempt": detail})

        if len(parts) == 2 and parts[1] == "stats":
            # GET /api/stats
            stats = database.get_overall_stats()
            return self.send_json({"success": True, "stats": stats})

        return self.send_error_json("API route not found", 404)

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        parts = [p for p in path.split("/") if p]

        if not path.startswith("/api/"):
            return self.send_error_json("Not found", 404)

        # 1. Handle file upload: POST /api/upload
        if len(parts) == 2 and parts[1] == "upload":
            return self.handle_upload()

        # 2. Handle JSON requests
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception as e:
            return self.send_error_json(f"Invalid JSON payload: {e}", 400)

        # POST /api/app/quit
        if len(parts) == 3 and parts[1] == "app" and parts[2] == "quit":
            self.send_json({"success": True, "message": "App shutting down"})
            threading.Thread(target=lambda: (time.sleep(0.3), os._exit(0)), daemon=True).start()
            return

        # POST /api/teacher/verify
        if len(parts) == 3 and parts[1] == "teacher" and parts[2] == "verify":
            client_ip = self.client_address[0] if (hasattr(self, "client_address") and self.client_address) else "client"
            if is_client_locked_out(client_ip):
                return self.send_error_json("Too many incorrect attempts. Authentication locked for 15 minutes.", 429)

            pin = payload.get("pin", "") or self.headers.get("X-Teacher-PIN", "")
            if str(pin).strip() == TEACHER_PIN:
                record_pin_attempt(client_ip, is_success=True)
                return self.send_json({"success": True, "message": "Teacher verified successfully"})

            record_pin_attempt(client_ip, is_success=False)
            attempts_left = max(0, 5 - TEACHER_PIN_ATTEMPTS.get(client_ip, {}).get("count", 0))
            if attempts_left == 0:
                return self.send_error_json("Too many failed attempts. Locked for 15 minutes.", 429)
            return self.send_error_json(f"Invalid passcode. ({attempts_left} attempts remaining)", 403)

        # POST /api/quizzes
        if len(parts) == 2 and parts[1] == "quizzes":
            if not is_teacher_authorized(self.headers):
                return self.send_error_json("Teacher authorization required to create assessments", 403)
            if not payload.get("title", "").strip():
                return self.send_error_json("Quiz title is required", 400)
            if not payload.get("questions"):
                return self.send_error_json("Quiz must have at least one question", 400)

            quiz_id = database.create_quiz(payload)
            created_quiz = database.get_quiz(quiz_id)
            return self.send_json({"success": True, "quiz": created_quiz}, status=201)

        # POST /api/quizzes/<id>/attempts
        if len(parts) == 4 and parts[1] == "quizzes" and parts[3] == "attempts":
            try:
                quiz_id = int(parts[2])
            except ValueError:
                return self.send_error_json("Invalid quiz ID", 400)

            quiz = database.get_quiz(quiz_id)
            if not quiz:
                return self.send_error_json("Quiz not found", 404)

            score = int(payload.get("score", 0))
            total_questions = int(payload.get("total_questions", len(quiz["questions"])))
            time_taken = int(payload.get("time_taken_seconds", 0))
            answers = payload.get("answers", {})
            pos_score = payload.get("positive_score")
            neg_pen = payload.get("negative_penalty")
            net_marks = payload.get("net_marks")
            max_marks = payload.get("max_marks")

            violations_count = int(payload.get("violations_count", 0))
            violations_log = payload.get("violations_log", [])
            is_disqualified = bool(payload.get("is_disqualified", False))

            student_name = payload.get("student_name", "Anonymous Student")
            student_roll = payload.get("student_roll", "")

            attempt_id = database.record_attempt(
                quiz_id, score, total_questions, time_taken, answers,
                positive_score=float(pos_score) if pos_score is not None else None,
                negative_penalty=float(neg_pen) if neg_pen is not None else None,
                net_marks=float(net_marks) if net_marks is not None else None,
                max_marks=float(max_marks) if max_marks is not None else None,
                violations_count=violations_count,
                violations_log=violations_log,
                is_disqualified=is_disqualified,
                student_name=student_name,
                student_roll=student_roll
            )
            return self.send_json({"success": True, "attempt_id": attempt_id}, status=201)

        return self.send_error_json("API route not found", 404)

    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        parts = [p for p in path.split("/") if p]

        if len(parts) == 3 and parts[1] == "quizzes":
            if not is_teacher_authorized(self.headers):
                return self.send_error_json("Teacher authorization required to modify assessments", 403)

            try:
                quiz_id = int(parts[2])
            except ValueError:
                return self.send_error_json("Invalid quiz ID", 400)

            try:
                content_length = int(self.headers.get("Content-Length", 0))
                post_data = self.rfile.read(content_length)
                payload = json.loads(post_data.decode("utf-8")) if post_data else {}
            except Exception as e:
                return self.send_error_json(f"Invalid JSON payload: {e}", 400)

            if not payload.get("title", "").strip():
                return self.send_error_json("Quiz title is required", 400)

            updated = database.update_quiz(quiz_id, payload)
            if not updated:
                return self.send_error_json("Quiz not found", 404)

            quiz = database.get_quiz(quiz_id)
            return self.send_json({"success": True, "quiz": quiz})

        return self.send_error_json("API route not found", 404)

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        parts = [p for p in path.split("/") if p]

        if len(parts) == 3 and parts[1] == "quizzes":
            if not is_teacher_authorized(self.headers):
                return self.send_error_json("Teacher authorization required to delete assessments", 403)

            try:
                quiz_id = int(parts[2])
            except ValueError:
                return self.send_error_json("Invalid quiz ID", 400)

            deleted = database.delete_quiz(quiz_id)
            if not deleted:
                return self.send_error_json("Quiz not found", 404)

            return self.send_json({"success": True, "message": "Quiz deleted successfully"})

        # DELETE /api/attempts (Clear All History)
        if len(parts) == 2 and parts[1] == "attempts":
            if not is_teacher_authorized(self.headers):
                return self.send_error_json("Teacher authorization required to clear history", 403)

            database.clear_all_attempts()
            return self.send_json({"success": True, "message": "All assessment history cleared successfully"})

        # DELETE /api/attempts/<id> (Delete Single Attempt)
        if len(parts) == 3 and parts[1] == "attempts":
            if not is_teacher_authorized(self.headers):
                return self.send_error_json("Teacher authorization required to delete attempt records", 403)

            try:
                attempt_id = int(parts[2])
            except ValueError:
                return self.send_error_json("Invalid attempt ID", 400)

            deleted = database.delete_attempt(attempt_id)
            if not deleted:
                return self.send_error_json("Attempt not found", 404)

            return self.send_json({"success": True, "message": "Attempt deleted successfully"})

        return self.send_error_json("API route not found", 404)

    def handle_upload(self):
        """Handle image file uploads via multipart/form-data or base64 JSON."""
        content_type = self.headers.get("Content-Type", "")

        # 1. Base64 JSON upload fallback
        if "application/json" in content_type:
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                import base64
                raw_data = body.get("data", "")
                if "," in raw_data:
                    raw_data = raw_data.split(",", 1)[1]
                file_bytes = base64.b64decode(raw_data)
                ext = body.get("extension", ".png").lower()
                if not ext.startswith("."):
                    ext = "." + ext
                if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]:
                    ext = ".png"
                filename = f"img_{uuid.uuid4().hex[:12]}{ext}"
                dest = os.path.join(UPLOADS_DIR, filename)
                with open(dest, "wb") as f:
                    f.write(file_bytes)
                return self.send_json({"success": True, "url": f"/uploads/{filename}"})
            except Exception as e:
                return self.send_error_json(f"Base64 upload failed: {e}", 400)

        # 2. Standard multipart/form-data
        if "multipart/form-data" in content_type:
            try:
                boundary = None
                for param in content_type.split(";"):
                    param = param.strip()
                    if param.startswith("boundary="):
                        boundary = param.split("=", 1)[1].strip('"').strip("'")
                        break

                if not boundary:
                    return self.send_error_json("Missing multipart boundary", 400)

                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length)

                delimiter = ("--" + boundary).encode("latin-1")
                end_delimiter = ("--" + boundary + "--").encode("latin-1")

                parts = body.split(delimiter)
                for part in parts:
                    if not part or part == b"--\r\n" or part == b"--":
                        continue
                    
                    if b"\r\n\r\n" not in part:
                        continue

                    header_bytes, content = part.split(b"\r\n\r\n", 1)
                    # Strip trailing \r\n
                    if content.endswith(b"\r\n"):
                        content = content[:-2]

                    header_text = header_bytes.decode("latin-1", errors="ignore")
                    if 'name="image"' in header_text or 'filename=' in header_text:
                        # Extract filename
                        original_name = "upload.png"
                        for line in header_text.split("\r\n"):
                            if "filename=" in line:
                                original_name = line.split("filename=")[1].strip().strip('"').strip("'")
                                break

                        ext = os.path.splitext(original_name)[1].lower()
                        if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]:
                            ext = ".png"

                        filename = f"img_{uuid.uuid4().hex[:12]}{ext}"
                        dest = os.path.join(UPLOADS_DIR, filename)
                        with open(dest, "wb") as f:
                            f.write(content)

                        return self.send_json({"success": True, "url": f"/uploads/{filename}"})

                return self.send_error_json("No image part found in request", 400)
            except Exception as e:
                return self.send_error_json(f"Upload processing failed: {e}", 500)

        return self.send_error_json("Unsupported content type for upload", 400)


def run_server(port=8000, host="0.0.0.0"):
    database.init_db()
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, QuizRequestHandler)
    print("=" * 60)
    print(f" Quiz MCQ App is running!")
    print(f" Local address: http://localhost:{port}")
    if host == "0.0.0.0":
        print(f" Network access: http://<your-ip>:{port} (accessible to students)")
    print(f" Press Ctrl+C to stop the server")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Quiz server...")
        httpd.server_close()
        print("Server stopped.")


if __name__ == "__main__":
    port = 8000
    if "PORT" in os.environ:
        try:
            port = int(os.environ["PORT"])
        except ValueError:
            pass
    elif len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    host = os.environ.get("HOST", "0.0.0.0")
    run_server(port=port, host=host)
