"""
Vercel Serverless Function entrypoint for QuizMaster.
Exports the standard BaseHTTPRequestHandler 'handler' subclass for Vercel Python Runtime.
"""

import os
import sys

# Ensure parent directory is in sys.path so modules database and server are importable
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# When running in serverless cloud, check if local fallback is needed
if not os.environ.get("TURSO_DATABASE_URL") and (os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")):
    default_db = os.path.join(BASE_DIR, "quiz.db")
    tmp_db = "/tmp/quiz.db"
    if not os.path.exists(tmp_db) and os.path.exists(default_db):
        import shutil
        try:
            shutil.copyfile(default_db, tmp_db)
        except Exception as e:
            sys.stderr.write(f"Could not copy default db to /tmp: {e}\n")

import database
from server import QuizRequestHandler

# Run DB schema checks and migrations on serverless cold boot
try:
    database.init_db()
except Exception as e:
    sys.stderr.write(f"Vercel DB initialization notice: {e}\n")


class handler(QuizRequestHandler):
    """
    Vercel Python runtime detects and calls 'handler'.
    Inherits all API routes, static file serving, and teacher authorization from QuizRequestHandler.
    """
    pass
