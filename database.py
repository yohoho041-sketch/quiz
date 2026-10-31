"""
Database Layer for Quiz App
Supports both Turso (libSQL over HTTP for Serverless/Vercel) and local SQLite (for offline use).
Handles schema initialization, CRUD operations for quizzes, questions, options, and attempts.
Runs with Python standard library, zero pip dependencies required.
"""

import os
import sqlite3
import json
import urllib.request
import base64
from typing import List, Dict, Any, Optional

def _load_env_file():
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip('"').strip("'")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

_load_env_file()

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quiz.db")
DB_PATH = os.environ.get("DATABASE_PATH")
if not DB_PATH:
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        DB_PATH = "/tmp/quiz.db"
    else:
        DB_PATH = DEFAULT_DB_PATH

TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")


# ==================== TURSO HTTP DRIVER ====================

def _format_turso_arg(val):
    if val is None:
        return {"type": "null"}
    elif isinstance(val, bool):
        return {"type": "integer", "value": "1" if val else "0"}
    elif isinstance(val, int):
        return {"type": "integer", "value": str(val)}
    elif isinstance(val, float):
        return {"type": "float", "value": val}
    elif isinstance(val, bytes):
        return {"type": "blob", "base64": base64.b64encode(val).decode("utf-8")}
    else:
        return {"type": "text", "value": str(val)}


def _parse_turso_val(val_dict):
    if not val_dict or val_dict.get("type") == "null":
        return None
    t = val_dict.get("type")
    v = val_dict.get("value")
    if t == "integer":
        return int(v)
    elif t == "float":
        return float(v)
    elif t == "blob":
        return base64.b64decode(val_dict.get("base64", ""))
    return v


class TursoRow(dict):
    """Row object that supports dict-key access, tuple index access, and dict() conversion."""
    def __init__(self, cols, vals):
        super().__init__()
        self._keys = cols
        self._vals = vals
        for c, v in zip(cols, vals):
            self[c] = v

    def __getitem__(self, item):
        if isinstance(item, int):
            return self._vals[item]
        return super().__getitem__(item)

    def keys(self):
        return self._keys


class TursoCursor:
    def __init__(self, conn):
        self.conn = conn
        self.description = None
        self.lastrowid = None
        self.rowcount = 0
        self._rows = []
        self._pos = 0

    def execute(self, sql: str, params: Any = ()):
        cols, rows, last_id, affected = self.conn._execute_stmt(sql, params)
        self.lastrowid = int(last_id) if last_id is not None else None
        self.rowcount = affected
        self.description = [(c, None, None, None, None, None, None) for c in cols] if cols else None
        self._rows = [TursoRow(cols, r) for r in rows]
        self._pos = 0
        return self

    def executemany(self, sql: str, seq_of_params: Any):
        for params in seq_of_params:
            self.execute(sql, params)
        return self

    def fetchone(self):
        if self._pos < len(self._rows):
            r = self._rows[self._pos]
            self._pos += 1
            return r
        return None

    def fetchall(self):
        res = self._rows[self._pos:]
        self._pos = len(self._rows)
        return res


class TursoConnection:
    def __init__(self, db_url: str, token: str):
        url = db_url.strip()
        if url.startswith("libsql://"):
            url = "https://" + url[len("libsql://"):]
        elif not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
        self.db_url = url.rstrip("/")
        self.token = token
        self.row_factory = sqlite3.Row

    def _execute_stmt(self, sql: str, params: Any = ()):
        url = f"{self.db_url}/v2/pipeline"
        args = [_format_turso_arg(p) for p in params]
        stmt = {"sql": sql}
        if args:
            stmt["args"] = args
        payload = {
            "requests": [
                {"type": "execute", "stmt": stmt},
                {"type": "close"}
            ]
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
        )
        res = None
        for attempt in range(2):
            try:
                with urllib.request.urlopen(req, timeout=8) as resp:
                    body = resp.read().decode("utf-8")
                    res = json.loads(body)
                    break
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                if attempt == 0:
                    time.sleep(0.25)
                    continue
                raise sqlite3.OperationalError(f"Turso network error: {e}") from e

        if not res:
            raise sqlite3.OperationalError("Turso returned empty response")

        first = res.get("results", [{}])[0]
        if first.get("type") == "error":
            raise sqlite3.OperationalError(first.get("error", {}).get("message", "Turso error"))

        result = first.get("response", {}).get("result", {})
        cols = [c["name"] for c in result.get("cols", [])]
        rows = []
        for raw_row in result.get("rows", []):
            parsed_row = [_parse_turso_val(cell) for cell in raw_row]
            rows.append(parsed_row)

        last_id = result.get("last_insert_rowid")
        affected = result.get("affected_row_count", 0)
        return cols, rows, last_id, affected

    def cursor(self):
        return TursoCursor(self)

    def execute(self, sql: str, params: Any = ()):
        cur = self.cursor()
        return cur.execute(sql, params)

    def commit(self):
        pass

    def close(self):
        pass


def get_db_connection():
    """Returns a Turso connection if TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are set,
    otherwise connects to local SQLite."""
    if TURSO_DATABASE_URL and TURSO_AUTH_TOKEN:
        return TursoConnection(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA cache_size = -64000;")
    conn.execute("PRAGMA temp_store = MEMORY;")
    return conn


def init_db():
    """Initialize database tables and run automatic migrations."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT DEFAULT 'General',
        time_limit_minutes INTEGER DEFAULT 0, -- 0 means untimed
        positive_marks REAL DEFAULT 4.0,
        negative_marks REAL DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        image_url TEXT DEFAULT '',
        explanation TEXT DEFAULT '',
        order_index INTEGER DEFAULT 0,
        question_type TEXT DEFAULT 'mcq', -- 'mcq' or 'integer'
        correct_numerical_value REAL DEFAULT NULL,
        numerical_tolerance REAL DEFAULT 0.0,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        option_text TEXT NOT NULL,
        is_correct INTEGER DEFAULT 0, -- 1 if true, 0 if false
        order_index INTEGER DEFAULT 0,
        image_url TEXT DEFAULT '',
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL,
        student_name TEXT DEFAULT 'Anonymous Student',
        student_roll TEXT DEFAULT '',
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        time_taken_seconds INTEGER DEFAULT 0,
        answers_json TEXT NOT NULL,
        positive_score REAL DEFAULT 0.0,
        negative_penalty REAL DEFAULT 0.0,
        net_marks REAL DEFAULT 0.0,
        max_marks REAL DEFAULT 0.0,
        violations_count INTEGER DEFAULT 0,
        violations_log TEXT DEFAULT '[]',
        is_disqualified INTEGER DEFAULT 0,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS uploaded_images (
        filename TEXT PRIMARY KEY,
        mime_type TEXT DEFAULT 'image/png',
        data_base64 TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # High-Performance Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_options_question_id ON options(question_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attempts_quiz_id ON attempts(quiz_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes(category);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attempts_completed_at ON attempts(completed_at DESC);")

    # Automatic Migrations for existing databases
    def run_migrations():
        # quizzes table
        q_cols = [c[1] for c in cursor.execute("PRAGMA table_info(quizzes)").fetchall()]
        if "positive_marks" not in q_cols:
            cursor.execute("ALTER TABLE quizzes ADD COLUMN positive_marks REAL DEFAULT 4.0")
        if "negative_marks" not in q_cols:
            cursor.execute("ALTER TABLE quizzes ADD COLUMN negative_marks REAL DEFAULT 1.0")

        # questions table
        qu_cols = [c[1] for c in cursor.execute("PRAGMA table_info(questions)").fetchall()]
        if "question_type" not in qu_cols:
            cursor.execute("ALTER TABLE questions ADD COLUMN question_type TEXT DEFAULT 'mcq'")
        if "correct_numerical_value" not in qu_cols:
            cursor.execute("ALTER TABLE questions ADD COLUMN correct_numerical_value REAL DEFAULT NULL")
        if "numerical_tolerance" not in qu_cols:
            cursor.execute("ALTER TABLE questions ADD COLUMN numerical_tolerance REAL DEFAULT 0.0")

        # options table
        opt_cols = [c[1] for c in cursor.execute("PRAGMA table_info(options)").fetchall()]
        if "image_url" not in opt_cols:
            cursor.execute("ALTER TABLE options ADD COLUMN image_url TEXT DEFAULT ''")

        # attempts table
        att_cols = [c[1] for c in cursor.execute("PRAGMA table_info(attempts)").fetchall()]
        if "student_name" not in att_cols:
            cursor.execute("ALTER TABLE attempts ADD COLUMN student_name TEXT DEFAULT 'Anonymous Student'")
        if "student_roll" not in att_cols:
            cursor.execute("ALTER TABLE attempts ADD COLUMN student_roll TEXT DEFAULT ''")
        if "positive_score" not in att_cols:
            cursor.execute("ALTER TABLE attempts ADD COLUMN positive_score REAL DEFAULT 0.0")
        if "negative_penalty" not in att_cols:
            cursor.execute("ALTER TABLE attempts ADD COLUMN negative_penalty REAL DEFAULT 0.0")
        if "net_marks" not in att_cols:
            cursor.execute("ALTER TABLE attempts ADD COLUMN net_marks REAL DEFAULT 0.0")
        if "max_marks" not in att_cols:
            cursor.execute("ALTER TABLE attempts ADD COLUMN max_marks REAL DEFAULT 0.0")
        if "violations_count" not in att_cols:
            cursor.execute("ALTER TABLE attempts ADD COLUMN violations_count INTEGER DEFAULT 0")
        if "violations_log" not in att_cols:
            cursor.execute("ALTER TABLE attempts ADD COLUMN violations_log TEXT DEFAULT '[]'")
        if "is_disqualified" not in att_cols:
            cursor.execute("ALTER TABLE attempts ADD COLUMN is_disqualified INTEGER DEFAULT 0")

    run_migrations()
    conn.commit()
    conn.close()


def list_quizzes() -> List[Dict[str, Any]]:
    """List all quizzes with question counts, marking scheme, and past attempt stats."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    SELECT 
        q.id,
        q.title,
        q.description,
        q.category,
        q.time_limit_minutes,
        q.positive_marks,
        q.negative_marks,
        q.created_at,
        COUNT(DISTINCT qu.id) as question_count,
        COUNT(DISTINCT a.id) as attempt_count,
        MAX(a.score * 100.0 / NULLIF(a.total_questions, 0)) as best_score_percent,
        MAX(a.net_marks) as best_net_marks
    FROM quizzes q
    LEFT JOIN questions qu ON q.id = qu.quiz_id
    LEFT JOIN attempts a ON q.id = a.quiz_id
    GROUP BY q.id
    ORDER BY q.id DESC;
    """
    rows = cursor.execute(query).fetchall()
    quizzes = [dict(row) for row in rows]
    conn.close()
    return quizzes


def get_quiz(quiz_id: int) -> Optional[Dict[str, Any]]:
    """Get full quiz details including questions and options."""
    conn = get_db_connection()
    cursor = conn.cursor()

    quiz_row = cursor.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if not quiz_row:
        conn.close()
        return None

    quiz = dict(quiz_row)

    # Get questions ordered by order_index
    questions_rows = cursor.execute(
        "SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index ASC, id ASC",
        (quiz_id,)
    ).fetchall()

    questions = []
    if questions_rows:
        q_ids = [row["id"] for row in questions_rows]
        placeholders = ",".join("?" * len(q_ids))
        options_rows = cursor.execute(
            f"SELECT id, question_id, option_text, is_correct, order_index, image_url FROM options WHERE question_id IN ({placeholders}) ORDER BY order_index ASC, id ASC",
            q_ids
        ).fetchall()

        options_by_q: Dict[int, list] = {}
        for opt in options_rows:
            opt_dict = dict(opt)
            qid = opt_dict.pop("question_id")
            options_by_q.setdefault(qid, []).append(opt_dict)

        for q_row in questions_rows:
            q_dict = dict(q_row)
            q_dict["options"] = options_by_q.get(q_dict["id"], [])
            questions.append(q_dict)

    quiz["questions"] = questions
    conn.close()
    return quiz


def create_quiz(data: Dict[str, Any]) -> int:
    """Create a new quiz with questions, options, marking scheme, and question types."""
    conn = get_db_connection()
    cursor = conn.cursor()

    pos_marks = float(data.get("positive_marks", 4.0))
    neg_marks = float(data.get("negative_marks", 1.0))

    cursor.execute(
        "INSERT INTO quizzes (title, description, category, time_limit_minutes, positive_marks, negative_marks) VALUES (?, ?, ?, ?, ?, ?)",
        (
            data.get("title", "Untitled Quiz"),
            data.get("description", ""),
            data.get("category", "General"),
            int(data.get("time_limit_minutes", 0)),
            pos_marks,
            neg_marks
        )
    )
    quiz_id = cursor.lastrowid

    questions = data.get("questions", [])
    for q_idx, q in enumerate(questions):
        q_type = q.get("question_type", "mcq")
        corr_val = q.get("correct_numerical_value")
        if corr_val is not None and str(corr_val).strip() != "":
            try:
                corr_val = float(corr_val)
            except (ValueError, TypeError):
                corr_val = None
        else:
            corr_val = None
        tol = float(q.get("numerical_tolerance", 0.0) or 0.0)

        cursor.execute(
            """INSERT INTO questions 
               (quiz_id, question_text, image_url, explanation, order_index, question_type, correct_numerical_value, numerical_tolerance) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                quiz_id,
                q.get("question_text", ""),
                q.get("image_url", ""),
                q.get("explanation", ""),
                q_idx,
                q_type,
                corr_val,
                tol
            )
        )
        q_id = cursor.lastrowid

        options = q.get("options", [])
        if options:
            placeholders = ", ".join(["(?, ?, ?, ?, ?)"] * len(options))
            params = []
            for opt_idx, opt in enumerate(options):
                params.extend([
                    q_id,
                    opt.get("option_text", ""),
                    1 if opt.get("is_correct") else 0,
                    opt_idx,
                    opt.get("image_url", "") or ""
                ])
            cursor.execute(
                f"INSERT INTO options (question_id, option_text, is_correct, order_index, image_url) VALUES {placeholders}",
                params
            )

    conn.commit()
    conn.close()
    return quiz_id


def update_quiz(quiz_id: int, data: Dict[str, Any]) -> bool:
    """Update an existing quiz and replace its questions/options."""
    conn = get_db_connection()
    cursor = conn.cursor()

    pos_marks = float(data.get("positive_marks", 4.0))
    neg_marks = float(data.get("negative_marks", 1.0))

    cursor.execute(
        "UPDATE quizzes SET title = ?, description = ?, category = ?, time_limit_minutes = ?, positive_marks = ?, negative_marks = ? WHERE id = ?",
        (
            data.get("title", "Untitled Quiz"),
            data.get("description", ""),
            data.get("category", "General"),
            int(data.get("time_limit_minutes", 0)),
            pos_marks,
            neg_marks,
            quiz_id
        )
    )

    if cursor.rowcount == 0:
        conn.close()
        return False

    # Delete existing questions and cascade options
    cursor.execute("DELETE FROM questions WHERE quiz_id = ?", (quiz_id,))

    questions = data.get("questions", [])
    for q_idx, q in enumerate(questions):
        q_type = q.get("question_type", "mcq")
        corr_val = q.get("correct_numerical_value")
        if corr_val is not None and str(corr_val).strip() != "":
            try:
                corr_val = float(corr_val)
            except (ValueError, TypeError):
                corr_val = None
        else:
            corr_val = None
        tol = float(q.get("numerical_tolerance", 0.0) or 0.0)

        cursor.execute(
            """INSERT INTO questions 
               (quiz_id, question_text, image_url, explanation, order_index, question_type, correct_numerical_value, numerical_tolerance) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                quiz_id,
                q.get("question_text", ""),
                q.get("image_url", ""),
                q.get("explanation", ""),
                q_idx,
                q_type,
                corr_val,
                tol
            )
        )
        q_id = cursor.lastrowid

        options = q.get("options", [])
        if options:
            placeholders = ", ".join(["(?, ?, ?, ?, ?)"] * len(options))
            params = []
            for opt_idx, opt in enumerate(options):
                params.extend([
                    q_id,
                    opt.get("option_text", ""),
                    1 if opt.get("is_correct") else 0,
                    opt_idx,
                    opt.get("image_url", "") or ""
                ])
            cursor.execute(
                f"INSERT INTO options (question_id, option_text, is_correct, order_index, image_url) VALUES {placeholders}",
                params
            )

    conn.commit()
    conn.close()
    return True


def delete_quiz(quiz_id: int) -> bool:
    """Delete a quiz and its questions, options, and attempts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM quizzes WHERE id = ?", (quiz_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def save_uploaded_image(filename: str, mime_type: str, data_bytes: bytes):
    """Persist an uploaded image into the database (Turso or SQLite) for serverless permanence."""
    conn = get_db_connection()
    cursor = conn.cursor()
    b64_str = base64.b64encode(data_bytes).decode("utf-8")
    cursor.execute(
        "INSERT OR REPLACE INTO uploaded_images (filename, mime_type, data_base64) VALUES (?, ?, ?)",
        (filename, mime_type, b64_str)
    )
    conn.commit()
    conn.close()


def get_uploaded_image(filename: str) -> Optional[tuple]:
    """Retrieve an uploaded image from the database if not present on local ephemeral disk."""
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT mime_type, data_base64 FROM uploaded_images WHERE filename = ?",
        (filename,)
    ).fetchone()
    conn.close()
    if not row or not row["data_base64"]:
        return None
    mime = row["mime_type"] or "image/png"
    try:
        data = base64.b64decode(row["data_base64"])
        return mime, data
    except Exception:
        return None


def record_attempt(
    quiz_id: int,
    score: int = 0,
    total_questions: int = 0,
    time_taken_seconds: int = 0,
    answers_dict: Optional[Dict] = None,
    answers: Optional[Dict] = None,
    positive_score: Optional[float] = None,
    negative_penalty: Optional[float] = None,
    net_marks: Optional[float] = None,
    max_marks: Optional[float] = None,
    violations_count: int = 0,
    violations_log: Optional[Any] = None,
    is_disqualified: bool = False,
    student_name: str = "Anonymous Student",
    student_roll: str = ""
) -> int:
    """
    Record a user quiz attempt with full JEE Marking Scheme computation and anti-cheating audit.
    Rule: MCQ incorrect incurs negative penalty (-1); Integer incorrect incurs 0 (no negative penalty).
    Optimized for high concurrency with minimal round-trip queries.
    """
    payload_dict = answers_dict if answers_dict is not None else (answers or {})
    v_log_str = json.dumps(violations_log) if isinstance(violations_log, (list, dict)) else str(violations_log or "[]")
    conn = get_db_connection()
    cursor = conn.cursor()

    quiz_row = cursor.execute("SELECT positive_marks, negative_marks FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if not quiz_row:
        conn.close()
        raise ValueError(f"Quiz {quiz_id} not found")

    pos_marks = float(quiz_row["positive_marks"]) if "positive_marks" in quiz_row.keys() else 4.0
    neg_marks = float(quiz_row["negative_marks"]) if "negative_marks" in quiz_row.keys() else 1.0

    questions_rows = cursor.execute(
        "SELECT id, question_type, correct_numerical_value, numerical_tolerance FROM questions WHERE quiz_id = ?",
        (quiz_id,)
    ).fetchall()

    # Fetch all correct options in a SINGLE batched IN (...) query instead of sequential queries in a loop
    q_ids = [q_row["id"] for q_row in questions_rows]
    correct_options_map = {}
    if q_ids:
        placeholders = ",".join("?" * len(q_ids))
        opts = cursor.execute(
            f"SELECT id, question_id FROM options WHERE question_id IN ({placeholders}) AND is_correct = 1",
            q_ids
        ).fetchall()
        for opt in opts:
            correct_options_map[opt["question_id"]] = opt["id"]

    calc_correct = 0
    calc_pos_score = 0.0
    calc_neg_penalty = 0.0

    for q_row in questions_rows:
        qid_str = str(q_row["id"])
        q_type = q_row["question_type"] if "question_type" in q_row.keys() else "mcq"

        if qid_str in payload_dict and payload_dict[qid_str] is not None and str(payload_dict[qid_str]).strip() != "":
            user_val = payload_dict[qid_str]
            if q_type == "integer":
                # Integer type question
                corr_val = q_row["correct_numerical_value"]
                tol = float(q_row["numerical_tolerance"] or 0.0)
                try:
                    is_correct = (corr_val is not None) and (abs(float(user_val) - float(corr_val)) <= tol)
                except Exception:
                    is_correct = False

                if is_correct:
                    calc_correct += 1
                    calc_pos_score += pos_marks
                else:
                    # STRICT JEE RULE: Zero negative penalty for numerical / integer type!
                    calc_neg_penalty += 0.0
            else:
                # Standard MCQ question from pre-fetched map
                correct_opt_id = correct_options_map.get(q_row["id"])
                try:
                    chosen_opt_id = int(user_val)
                    if correct_opt_id is not None and chosen_opt_id == correct_opt_id:
                        calc_correct += 1
                        calc_pos_score += pos_marks
                    else:
                        calc_neg_penalty += neg_marks
                except (ValueError, TypeError):
                    calc_neg_penalty += neg_marks

    final_pos_score = round(positive_score if positive_score is not None else calc_pos_score, 2)
    final_neg_penalty = round(negative_penalty if negative_penalty is not None else calc_neg_penalty, 2)
    final_net_marks = round(net_marks if net_marks is not None else (final_pos_score - final_neg_penalty), 2)
    total_q_count = len(questions_rows) if len(questions_rows) > 0 else (total_questions or 1)
    final_max_marks = round(max_marks if max_marks is not None else (total_q_count * pos_marks), 2)
    final_score = calc_correct if (score == 0 and calc_correct > 0) else score

    clean_name = str(student_name or "").strip() or "Anonymous Student"
    clean_roll = str(student_roll or "").strip()

    cursor.execute(
        """INSERT INTO attempts 
           (quiz_id, student_name, student_roll, score, total_questions, time_taken_seconds, answers_json, positive_score, negative_penalty, net_marks, max_marks, violations_count, violations_log, is_disqualified) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            quiz_id,
            clean_name,
            clean_roll,
            final_score,
            total_q_count if total_questions == 0 else total_questions,
            time_taken_seconds,
            json.dumps(payload_dict),
            final_pos_score,
            final_neg_penalty,
            final_net_marks,
            final_max_marks,
            int(violations_count),
            v_log_str,
            1 if is_disqualified else 0
        )
    )
    attempt_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return attempt_id


def get_quiz_attempts(quiz_id: int) -> List[Dict[str, Any]]:
    """Get all past attempts for a quiz."""
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT * FROM attempts WHERE quiz_id = ? ORDER BY completed_at DESC",
        (quiz_id,)
    ).fetchall()
    attempts = [dict(row) for row in rows]
    conn.close()
    return attempts


def list_all_attempts(student_pin: Optional[str] = None) -> List[Dict[str, Any]]:
    """List all past quiz attempts across all quizzes with metadata and JEE marks.
    If student_pin is provided, only return attempts belonging to that student PIN.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    params = []
    where_clause = ""
    if student_pin:
        where_clause = "WHERE a.student_roll = ?"
        params.append(str(student_pin).strip())

    query = f"""
    SELECT 
        a.id as attempt_id,
        a.quiz_id,
        a.student_name,
        a.student_roll,
        q.title as quiz_title,
        q.category,
        q.positive_marks,
        q.negative_marks,
        a.score,
        a.total_questions,
        a.positive_score,
        a.negative_penalty,
        a.net_marks,
        a.max_marks,
        a.time_taken_seconds,
        a.violations_count,
        a.is_disqualified,
        a.completed_at,
        ROUND(a.score * 100.0 / NULLIF(a.total_questions, 0), 1) as score_percent
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    {where_clause}
    ORDER BY a.completed_at DESC, a.id DESC;
    """
    rows = cursor.execute(query, params).fetchall()
    attempts = [dict(row) for row in rows]
    conn.close()
    return attempts


def get_attempt_detail(attempt_id: int) -> Optional[Dict[str, Any]]:
    """Get full attempt record including user's answers and quiz questions/options."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
    SELECT 
        a.id as attempt_id,
        a.quiz_id,
        a.student_name,
        a.student_roll,
        q.title as quiz_title,
        q.description as quiz_description,
        q.category,
        q.time_limit_minutes,
        q.positive_marks,
        q.negative_marks,
        a.score,
        a.total_questions,
        a.positive_score,
        a.negative_penalty,
        a.net_marks,
        a.max_marks,
        a.time_taken_seconds,
        a.violations_count,
        a.violations_log,
        a.is_disqualified,
        a.answers_json,
        a.completed_at,
        ROUND(a.score * 100.0 / NULLIF(a.total_questions, 0), 1) as score_percent
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    WHERE a.id = ?;
    """
    row = cursor.execute(query, (attempt_id,)).fetchone()
    if not row:
        conn.close()
        return None

    data = dict(row)
    try:
        data["answers"] = json.loads(data["answers_json"])
    except Exception:
        data["answers"] = {}

    conn.close()
    # Fetch quiz questions and options
    data["quiz"] = get_quiz(data["quiz_id"])
    return data


def get_overall_stats() -> Dict[str, Any]:
    """Get global quiz statistics."""
    conn = get_db_connection()
    cursor = conn.cursor()
    total_quizzes = cursor.execute("SELECT COUNT(*) FROM quizzes").fetchone()[0]
    total_questions = cursor.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    total_attempts = cursor.execute("SELECT COUNT(*) FROM attempts").fetchone()[0]
    avg_score = cursor.execute(
        "SELECT AVG(score * 100.0 / NULLIF(total_questions, 0)) FROM attempts"
    ).fetchone()[0] or 0.0

    conn.close()
    return {
        "total_quizzes": total_quizzes,
        "total_questions": total_questions,
        "total_attempts": total_attempts,
        "average_score": round(avg_score, 1)
    }


def delete_attempt(attempt_id: int) -> bool:
    """Delete a single quiz attempt by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM attempts WHERE id = ?", (attempt_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def clear_all_attempts() -> bool:
    """Clear all past quiz attempts from database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM attempts")
    conn.commit()
    conn.close()
    return True
