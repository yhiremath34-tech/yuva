"""
Feedback Admin Portal - Backend Server
Zero-dependency HTTP Server, SQLite Database, and Secure Authentication API.
Compatible with Python 3.8+ (including Python 3.13)
"""

import http.server
import socketserver
import json
import sqlite3
import hashlib
import secrets
import os
import urllib.parse
from datetime import datetime, timezone

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "feedback.db")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

# =============================================================================
# DATABASE & CRYPTOGRAPHY HELPERS
# =============================================================================

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """Generates a PBKDF2-HMAC-SHA256 hash with a cryptographically secure salt."""
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        iterations=300000
    )
    return key.hex(), salt

def verify_password(stored_hash: str, salt: str, password_attempt: str) -> bool:
    """Verifies a password attempt against stored PBKDF2 hash using constant-time comparison."""
    calculated_hash, _ = hash_password(password_attempt, salt)
    return secrets.compare_digest(stored_hash, calculated_hash)

def init_db():
    """Initializes SQLite database schema and seeds initial admin and API key."""
    conn = get_db()
    cursor = conn.cursor()

    # 1. Admins table - passwords strictly hashed with salt
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # 2. API Keys table for external website connections
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_value TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        requests_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)

    # 3. Feedback submissions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        category TEXT NOT NULL DEFAULT 'General',
        message TEXT NOT NULL,
        page_url TEXT,
        user_agent TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        admin_notes TEXT DEFAULT '',
        api_key_used TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # 4. Sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        admin_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (admin_id) REFERENCES admins(id)
    )
    """)

    # Check if default admin exists
    cursor.execute("SELECT id FROM admins WHERE email = 'admin@feedbackhub.com'")
    if not cursor.fetchone():
        pwd_hash, salt = hash_password("Admin@2026!SecureKey")
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "INSERT INTO admins (email, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
            ("admin@feedbackhub.com", pwd_hash, salt, now)
        )
        print("[Security] Default admin account seeded: admin@feedbackhub.com")

    # Check if default API key exists
    cursor.execute("SELECT id FROM api_keys LIMIT 1")
    if not cursor.fetchone():
        default_key = f"fbk_live_{secrets.token_hex(16)}"
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "INSERT INTO api_keys (key_value, name, status, requests_count, created_at) VALUES (?, ?, 'active', 0, ?)",
            (default_key, "Default Website Widget Key", now)
        )
        print(f"[API Keys] Default API key generated: {default_key}")

    # Seed sample feedback if table is empty
    cursor.execute("SELECT COUNT(*) as count FROM feedback")
    if cursor.fetchone()["count"] == 0:
        samples = [
            ("Sarah Jenkins", "sarah.j@techvision.io", 5, "Praise", "The new onboarding flow is exceptionally fast! Loving the clean UI and responsiveness.", "https://example.com/onboarding", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "resolved", "Followed up via email to thank Sarah.", "2026-09-02T09:15:00Z"),
            ("Marcus Aurelius", "marcus@rome.design", 4, "Feature Request", "Would be fantastic to have dark mode scheduling based on local sunrise/sunset.", "https://example.com/settings", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "reviewing", "Added to Q4 product roadmap backlog.", "2026-09-03T11:42:00Z"),
            ("Alex Chen", "alex.chen@startup.co", 2, "Bug Report", "Checkout button freezes for 2 seconds on Safari when using Apple Pay on iOS.", "https://example.com/checkout", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)", "new", "Reproduced bug on mobile WebKit. Ticket #DEV-412.", "2026-09-03T16:20:00Z"),
            ("Elena Rostova", "elena@designlab.org", 5, "Praise", "Customer support answered my query within 3 minutes on live chat. Amazing service!", "https://example.com/support", "Mozilla/5.0 (X11; Linux x86_64)", "resolved", "Shared with support team kudos channel.", "2026-09-04T07:10:00Z"),
            ("David Miller", "dmiller@enterprise.net", 3, "UX / Usability", "Search filtering by date range is slightly unintuitive when selecting calendar days.", "https://example.com/reports", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "new", "", "2026-09-04T09:45:00Z"),
        ]
        cursor.executemany(
            """INSERT INTO feedback 
               (name, email, rating, category, message, page_url, user_agent, status, admin_notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            samples
        )
        print("[Database] Seeded 5 initial feedback records for immediate demonstration.")

    conn.commit()
    conn.close()

# =============================================================================
# REQUEST HANDLER
# =============================================================================

class FeedbackRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key')

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests from external websites."""
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _read_json(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {}

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _get_auth_admin(self):
        """Extracts and verifies session token from Authorization header."""
        auth = self.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return None
        token = auth[7:].strip()
        conn = get_db()
        row = conn.execute(
            "SELECT admins.id, admins.email FROM sessions JOIN admins ON sessions.admin_id = admins.id WHERE sessions.token = ?",
            (token,)
        ).fetchone()
        conn.close()
        return row

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. Auth verify endpoint
        if path == '/api/auth/verify':
            admin = self._get_auth_admin()
            if not admin:
                return self._send_json({"ok": False, "error": "Unauthorized"}, 401)
            return self._send_json({"ok": True, "admin": {"email": admin["email"]}})

        # 2. Feedback list endpoint (Protected)
        if path == '/api/feedback':
            admin = self._get_auth_admin()
            if not admin:
                return self._send_json({"ok": False, "error": "Unauthorized"}, 401)
            
            rating = query.get('rating', [None])[0]
            status = query.get('status', [None])[0]
            category = query.get('category', [None])[0]
            search = query.get('search', [None])[0]

            sql = "SELECT * FROM feedback WHERE 1=1"
            params = []

            if rating and rating.isdigit():
                sql += " AND rating = ?"
                params.append(int(rating))
            if status and status != 'all':
                sql += " AND status = ?"
                params.append(status)
            if category and category != 'all':
                sql += " AND category = ?"
                params.append(category)
            if search:
                sql += " AND (message LIKE ? OR name LIKE ? OR email LIKE ?)"
                kw = f"%{search}%"
                params.extend([kw, kw, kw])

            sql += " ORDER BY id DESC"

            conn = get_db()
            rows = conn.execute(sql, params).fetchall()
            items = [dict(r) for r in rows]
            conn.close()
            return self._send_json({"ok": True, "feedback": items})

        # 3. Stats calculation endpoint (Protected)
        if path == '/api/stats':
            admin = self._get_auth_admin()
            if not admin:
                return self._send_json({"ok": False, "error": "Unauthorized"}, 401)

            conn = get_db()
            total = conn.execute("SELECT COUNT(*) as c FROM feedback").fetchone()["c"]
            avg_rating = conn.execute("SELECT AVG(rating) as a FROM feedback").fetchone()["a"] or 0.0

            # Ratings breakdown (1 to 5)
            stars_count = {str(i): 0 for i in range(1, 6)}
            for r in conn.execute("SELECT rating, COUNT(*) as c FROM feedback GROUP BY rating").fetchall():
                stars_count[str(r["rating"])] = r["c"]

            # Category breakdown
            categories = {}
            for r in conn.execute("SELECT category, COUNT(*) as c FROM feedback GROUP BY category").fetchall():
                categories[r["category"]] = r["c"]

            # Status breakdown
            statuses = {"new": 0, "reviewing": 0, "resolved": 0, "archived": 0}
            for r in conn.execute("SELECT status, COUNT(*) as c FROM feedback GROUP BY status").fetchall():
                statuses[r["status"]] = r["c"]

            # Positive feedback percentage (4 and 5 stars)
            positives = sum(stars_count.get(str(s), 0) for s in [4, 5])
            pos_pct = round((positives / total * 100) if total > 0 else 100.0, 1)

            conn.close()
            return self._send_json({
                "ok": True,
                "stats": {
                    "total": total,
                    "avg_rating": round(avg_rating, 1),
                    "positive_percentage": pos_pct,
                    "stars_count": stars_count,
                    "categories": categories,
                    "statuses": statuses
                }
            })

        # 4. API Keys endpoint (Protected)
        if path == '/api/keys':
            admin = self._get_auth_admin()
            if not admin:
                return self._send_json({"ok": False, "error": "Unauthorized"}, 401)
            
            conn = get_db()
            rows = conn.execute("SELECT id, key_value, name, status, requests_count, created_at FROM api_keys ORDER BY id DESC").fetchall()
            keys = [dict(r) for r in rows]
            conn.close()
            return self._send_json({"ok": True, "keys": keys})

        # 5. Route widget.js directly if requested
        if path == '/widget.js':
            self.path = '/widget.js'

        # Default static file serving (public directory)
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        data = self._read_json()

        # 1. Admin Login
        if path == '/api/auth/login':
            email = data.get('email', '').strip().lower()
            password = data.get('password', '').strip()

            if not email or not password:
                return self._send_json({"ok": False, "error": "Email and password are required."}, 400)

            conn = get_db()
            admin = conn.execute("SELECT id, email, password_hash, salt FROM admins WHERE email = ?", (email,)).fetchone()
            
            if not admin or not verify_password(admin["password_hash"], admin["salt"], password):
                conn.close()
                return self._send_json({"ok": False, "error": "Invalid email or password. Access denied."}, 401)

            # Generate cryptographically secure session token
            token = secrets.token_hex(32)
            now = datetime.now(timezone.utc).isoformat()
            conn.execute("INSERT INTO sessions (token, admin_id, created_at) VALUES (?, ?, ?)", (token, admin["id"], now))
            conn.commit()
            conn.close()

            return self._send_json({
                "ok": True,
                "token": token,
                "admin": {"email": admin["email"]}
            })

        # 2. Admin Logout
        if path == '/api/auth/logout':
            auth = self.headers.get('Authorization', '')
            if auth.startswith('Bearer '):
                token = auth[7:].strip()
                conn = get_db()
                conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                conn.commit()
                conn.close()
            return self._send_json({"ok": True, "message": "Logged out successfully."})

        # 3. Admin Change Password
        if path == '/api/auth/change-password':
            admin = self._get_auth_admin()
            if not admin:
                return self._send_json({"ok": False, "error": "Unauthorized"}, 401)
            
            old_password = data.get('old_password', '')
            new_password = data.get('new_password', '')

            if len(new_password) < 8:
                return self._send_json({"ok": False, "error": "New password must be at least 8 characters long."}, 400)

            conn = get_db()
            admin_row = conn.execute("SELECT id, password_hash, salt FROM admins WHERE id = ?", (admin["id"],)).fetchone()
            if not verify_password(admin_row["password_hash"], admin_row["salt"], old_password):
                conn.close()
                return self._send_json({"ok": False, "error": "Current password is incorrect."}, 400)

            new_hash, new_salt = hash_password(new_password)
            conn.execute("UPDATE admins SET password_hash = ?, salt = ? WHERE id = ?", (new_hash, new_salt, admin["id"]))
            conn.commit()
            conn.close()
            return self._send_json({"ok": True, "message": "Password updated successfully."})

        # 4. Generate new API Key
        if path == '/api/keys/generate':
            admin = self._get_auth_admin()
            if not admin:
                return self._send_json({"ok": False, "error": "Unauthorized"}, 401)
            
            name = data.get('name', 'External Website Key').strip() or 'External Website Key'
            new_key = f"fbk_live_{secrets.token_hex(16)}"
            now = datetime.now(timezone.utc).isoformat()

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO api_keys (key_value, name, status, requests_count, created_at) VALUES (?, ?, 'active', 0, ?)",
                (new_key, name, now)
            )
            key_id = cursor.lastrowid
            conn.commit()
            conn.close()

            return self._send_json({
                "ok": True,
                "key": {
                    "id": key_id,
                    "key_value": new_key,
                    "name": name,
                    "status": "active",
                    "requests_count": 0,
                    "created_at": now
                }
            })

        # 5. Revoke an API Key
        if path == '/api/keys/revoke':
            admin = self._get_auth_admin()
            if not admin:
                return self._send_json({"ok": False, "error": "Unauthorized"}, 401)
            
            key_id = data.get('id')
            if not key_id:
                return self._send_json({"ok": False, "error": "Missing key id"}, 400)

            conn = get_db()
            conn.execute("UPDATE api_keys SET status = 'revoked' WHERE id = ?", (key_id,))
            conn.commit()
            conn.close()
            return self._send_json({"ok": True, "message": "API key revoked successfully."})

        # 6. Seed Sample Data (For Admin Testing)
        if path == '/api/feedback/sample':
            admin = self._get_auth_admin()
            if not admin:
                return self._send_json({"ok": False, "error": "Unauthorized"}, 401)
            
            now = datetime.now(timezone.utc).isoformat()
            sample = (
                data.get("name", "Test User"),
                data.get("email", "test.user@sample.com"),
                int(data.get("rating", 5)),
                data.get("category", "General"),
                data.get("message", "Testing the live admin feedback portal integration!"),
                data.get("page_url", "http://localhost:8000/demo-client.html"),
                "Admin Portal Test Generator",
                "new",
                "",
                "test_seed",
                now
            )
            conn = get_db()
            conn.execute(
                """INSERT INTO feedback 
                   (name, email, rating, category, message, page_url, user_agent, status, admin_notes, api_key_used, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                sample
            )
            conn.commit()
            conn.close()
            return self._send_json({"ok": True, "message": "Sample feedback created."})

        # 7. PUBLIC API: Submit Feedback via API Key (Used by external websites / widgets)
        if path == '/api/v1/feedback':
            # Extract API key from x-api-key header, or query param, or JSON body
            api_key = self.headers.get('x-api-key') or data.get('api_key')
            if not api_key:
                return self._send_json({"ok": False, "error": "Missing 'x-api-key' header. Please provide an active API key to connect."}, 401)

            conn = get_db()
            key_row = conn.execute("SELECT id, status, requests_count FROM api_keys WHERE key_value = ?", (api_key,)).fetchone()
            if not key_row or key_row["status"] != 'active':
                conn.close()
                return self._send_json({"ok": False, "error": "Invalid or revoked API key."}, 403)

            # Validate feedback fields
            try:
                rating = int(data.get('rating', 5))
                if rating < 1 or rating > 5:
                    rating = 5
            except (ValueError, TypeError):
                rating = 5

            message = data.get('message', '').strip()
            if not message:
                conn.close()
                return self._send_json({"ok": False, "error": "Feedback message cannot be empty."}, 400)

            name = data.get('name', 'Anonymous').strip() or 'Anonymous'
            email = data.get('email', '').strip()
            category = data.get('category', 'General').strip()
            page_url = data.get('page_url', self.headers.get('Referer', '')).strip()
            user_agent = self.headers.get('User-Agent', '')
            now = datetime.now(timezone.utc).isoformat()

            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO feedback 
                   (name, email, rating, category, message, page_url, user_agent, status, admin_notes, api_key_used, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'new', '', ?, ?)""",
                (name, email, rating, category, message, page_url, user_agent, api_key, now)
            )
            feedback_id = cursor.lastrowid

            # Increment API key usage
            cursor.execute("UPDATE api_keys SET requests_count = requests_count + 1 WHERE id = ?", (key_row["id"],))
            conn.commit()
            conn.close()

            return self._send_json({
                "ok": True,
                "message": "Thank you! Your feedback has been received.",
                "id": feedback_id
            }, 201)

        self._send_json({"ok": False, "error": "Not found"}, 404)

    def do_PATCH(self):
        """Handle updating feedback status or admin notes."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        if path.startswith('/api/feedback/'):
            admin = self._get_auth_admin()
            if not admin:
                return self._send_json({"ok": False, "error": "Unauthorized"}, 401)

            try:
                feedback_id = int(path.split('/')[-1])
            except ValueError:
                return self._send_json({"ok": False, "error": "Invalid feedback ID"}, 400)

            data = self._read_json()
            status = data.get('status')
            admin_notes = data.get('admin_notes')

            conn = get_db()
            if status is not None:
                conn.execute("UPDATE feedback SET status = ? WHERE id = ?", (status, feedback_id))
            if admin_notes is not None:
                conn.execute("UPDATE feedback SET admin_notes = ? WHERE id = ?", (admin_notes, feedback_id))
            conn.commit()
            conn.close()

            return self._send_json({"ok": True, "message": "Feedback updated successfully."})

        self._send_json({"ok": False, "error": "Not found"}, 404)

    def do_DELETE(self):
        """Handle deleting feedback."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/feedback/'):
            admin = self._get_auth_admin()
            if not admin:
                return self._send_json({"ok": False, "error": "Unauthorized"}, 401)

            try:
                feedback_id = int(path.split('/')[-1])
            except ValueError:
                return self._send_json({"ok": False, "error": "Invalid feedback ID"}, 400)

            conn = get_db()
            conn.execute("DELETE FROM feedback WHERE id = ?", (feedback_id,))
            conn.commit()
            conn.close()

            return self._send_json({"ok": True, "message": "Feedback deleted successfully."})

        self._send_json({"ok": False, "error": "Not found"}, 404)

# =============================================================================
# MAIN RUNNER
# =============================================================================

def run_server():
    import sys
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    init_db()

    # Re-use socket address to avoid port blocking on reload
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), FeedbackRequestHandler) as httpd:
        print("=" * 65)
        print(" [OK] FEEDBACK ADMIN PORTAL & API KEY SERVER IS RUNNING")
        print("=" * 65)
        print(f" -> Admin Portal URL:     http://localhost:{PORT}")
        print(f" -> Client Demo Website:  http://localhost:{PORT}/demo-client.html")
        print(f" -> Feedback API:         http://localhost:{PORT}/api/v1/feedback")
        print(f" -> Embed Widget Script:  http://localhost:{PORT}/widget.js")
        print("-" * 65)
        print(" [SECURITY]")
        print("   Admin password is salted & hashed with PBKDF2-HMAC-SHA256.")
        print("   Zero credentials exist in frontend code.")
        print("   Default Login: admin@feedbackhub.com / Admin@2026!SecureKey")
        print("=" * 65)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server gracefully...")
            httpd.shutdown()

if __name__ == '__main__':
    run_server()
