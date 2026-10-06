"""Run from the backend folder:  python -m unittest discover -s tests -v"""
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import google_auth  # noqa: E402
from app import create_app  # noqa: E402

HDR = {"X-Requested-With": "cybearea"}
FRONTEND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "frontend")


class Base(unittest.TestCase):
    config = {}

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.db_path = os.path.join(self.tmp, "t.db")
        cfg = {"DB_PATH": self.db_path, "SERVE_FRONTEND": False, "SCRYPT_N": 2**10, "TESTING": False}
        cfg.update(self.config)
        self.app = create_app(cfg)
        self.c = self.app.test_client()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    # helpers
    def post(self, path, body=None, client=None):
        return (client or self.c).post(path, json=body if body is not None else {}, headers=HDR)

    def put(self, path, body, client=None):
        return (client or self.c).put(path, json=body, headers=HDR)

    def patch(self, path, body, client=None):
        return (client or self.c).patch(path, json=body, headers=HDR)

    def delete(self, path, client=None):
        return (client or self.c).delete(path, headers=HDR)

    def signup(self, name="ada", client=None, **extra):
        body = {"email": f"{name}@example.com", "username": name, "password": "supersecret1"}
        body.update(extra)
        return self.post("/api/auth/signup", body, client)

    def make_admin(self, username):
        con = sqlite3.connect(self.db_path)
        con.execute("UPDATE users SET role='admin' WHERE username=?", (username,))
        con.commit()
        con.close()

    def user_id(self, username):
        con = sqlite3.connect(self.db_path)
        row = con.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
        con.close()
        return row[0]


class AuthTests(Base):
    def test_health(self):
        self.assertEqual(self.c.get("/api/health").get_json(), {"ok": True})

    def test_signup_creates_member_and_sets_secure_cookie(self):
        r = self.signup()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.get_json()["user"]["role"], "member")
        cookie = r.headers.get("Set-Cookie")
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertEqual(self.c.get("/api/me").get_json()["user"]["username"], "ada")

    def test_cannot_sign_up_as_admin(self):
        r = self.signup(role="admin", is_admin=True)
        self.assertEqual(r.get_json()["user"]["role"], "member")

    def test_signup_validation(self):
        self.assertEqual(self.signup(password="short").status_code, 400)
        self.assertEqual(self.signup(username="a b").status_code, 400)
        self.assertEqual(self.signup(email="nope").status_code, 400)
        self.assertEqual(self.post("/api/auth/signup", {"email": 5, "username": [], "password": None}).status_code, 400)
        self.assertEqual(self.c.post("/api/auth/signup", data="not json", headers=HDR).status_code, 400)

    def test_duplicates_are_rejected_case_insensitively(self):
        self.signup("ada")
        self.assertEqual(self.signup("ada").status_code, 409)
        r = self.post("/api/auth/signup", {"email": "ADA@example.com", "username": "other", "password": "supersecret1"})
        self.assertEqual(r.status_code, 409)
        r = self.post("/api/auth/signup", {"email": "x@example.com", "username": "ADA", "password": "supersecret1"})
        self.assertEqual(r.status_code, 409)

    def test_password_is_hashed_not_stored(self):
        self.signup("ada")
        con = sqlite3.connect(self.db_path)
        stored = con.execute("SELECT password_hash FROM users").fetchone()[0]
        con.close()
        self.assertTrue(stored.startswith("scrypt$"))
        self.assertNotIn("supersecret1", stored)

    def test_login_by_username_and_email(self):
        self.signup("ada")
        for ident in ("ada", "ADA@example.com"):
            c = self.app.test_client()
            r = self.post("/api/auth/login", {"identifier": ident, "password": "supersecret1"}, c)
            self.assertEqual(r.status_code, 200, ident)
            self.assertEqual(c.get("/api/me").status_code, 200)

    def test_bad_logins_look_identical(self):
        self.signup("ada")
        wrong = self.post("/api/auth/login", {"identifier": "ada", "password": "nope-nope-1"})
        ghost = self.post("/api/auth/login", {"identifier": "nobody", "password": "nope-nope-1"})
        self.assertEqual((wrong.status_code, wrong.get_json()), (ghost.status_code, ghost.get_json()))
        self.assertEqual(wrong.status_code, 401)

    def test_login_rate_limit(self):
        self.signup("ada")
        c = self.app.test_client()
        for _ in range(5):
            self.assertEqual(self.post("/api/auth/login", {"identifier": "ada", "password": "bad-bad-bad"}, c).status_code, 401)
        self.assertEqual(self.post("/api/auth/login", {"identifier": "ada", "password": "bad-bad-bad"}, c).status_code, 429)
        # even the right password is refused while locked
        self.assertEqual(self.post("/api/auth/login", {"identifier": "ada", "password": "supersecret1"}, c).status_code, 429)

    def test_logout_really_ends_the_session(self):
        token = self.signup("ada").headers["Set-Cookie"].split("cybearea_session=")[1].split(";")[0]
        self.assertEqual(self.post("/api/auth/logout").status_code, 200)
        self.assertEqual(self.c.get("/api/me").status_code, 401)
        replay = self.app.test_client()
        replay.set_cookie("cybearea_session", token)  # an attacker who copied the old cookie
        self.assertEqual(replay.get("/api/me").status_code, 401)

    def test_expired_session_is_rejected(self):
        self.signup("ada")
        con = sqlite3.connect(self.db_path)
        con.execute("UPDATE sessions SET expires_at = 1")
        con.commit()
        con.close()
        self.assertEqual(self.c.get("/api/me").status_code, 401)

    def test_unauthenticated_requests_are_refused(self):
        for method, path in [("get", "/api/me"), ("put", "/api/me/arena"), ("get", "/api/admin/stats")]:
            r = getattr(self.c, method)(path, headers=HDR) if method == "get" else self.put(path, {})
            self.assertEqual(r.status_code, 401, path)

    def test_missing_csrf_header_and_foreign_origin_blocked(self):
        r = self.c.post("/api/auth/signup", json={"email": "a@b.co", "username": "ada", "password": "supersecret1"})
        self.assertEqual(r.status_code, 403)
        r = self.c.post("/api/auth/signup", json={"email": "a@b.co", "username": "ada", "password": "supersecret1"},
                        headers=dict(HDR, Origin="https://evil.example"))
        self.assertEqual(r.status_code, 403)

    def test_security_headers_and_json_errors(self):
        r = self.c.get("/api/nope")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.get_json()["code"], "not_found")
        self.assertEqual(r.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(r.headers["X-Frame-Options"], "DENY")
        self.assertEqual(r.headers["Cache-Control"], "no-store")

    def test_production_password_hashing_is_strong(self):
        self.assertGreaterEqual(create_app({"DB_PATH": self.db_path, "SERVE_FRONTEND": False}).config["SCRYPT_N"], 2**15)


class MeTests(Base):
    def setUp(self):
        super().setUp()
        self.signup("ada")

    def test_profile_update_and_email_conflict(self):
        r = self.patch("/api/me", {"name": "Ada L", "notes": "Loves Go", "email": "ada2@example.com"})
        self.assertEqual(r.get_json()["profile"], {"name": "Ada L", "email": "ada2@example.com", "notes": "Loves Go"})
        other = self.app.test_client()
        self.signup("bob", client=other)
        self.assertEqual(self.patch("/api/me", {"email": "BOB@example.com"}).status_code, 409)
        self.assertEqual(self.patch("/api/me", {"name": "x" * 81}).status_code, 400)
        self.assertEqual(self.patch("/api/me", {"name": 5}).status_code, 400)

    def test_cannot_change_role_through_profile(self):
        self.patch("/api/me", {"role": "admin"})
        self.assertEqual(self.c.get("/api/me").get_json()["user"]["role"], "member")

    def test_arena_choose_specializations(self):
        r = self.put("/api/me/arena", {"specs": ["web", "cloud", "web"], "active": "cloud"}).get_json()["arena"]
        self.assertEqual((r["specs"], r["active"]), (["web", "cloud"], "cloud"))
        r = self.put("/api/me/arena", {"specs": ["pentest"]}).get_json()["arena"]
        self.assertEqual((r["specs"], r["active"]), (["pentest"], "pentest"))
        self.assertEqual(self.put("/api/me/arena", {"specs": ["hacking-the-gibson"]}).status_code, 400)
        self.assertEqual(self.put("/api/me/arena", {"specs": ["web"], "active": "cloud"}).status_code, 400)
        self.assertEqual(self.put("/api/me/arena", {"specs": "web"}).status_code, 400)

    def test_lesson_progress(self):
        self.put("/api/me/arena", {"specs": ["web"]})
        r = self.put("/api/me/progress", {"spec": "web", "lesson": 2, "done": True})
        self.put("/api/me/progress", {"spec": "web", "lesson": 0, "done": True})
        self.put("/api/me/progress", {"spec": "web", "lesson": 0, "done": True})  # twice is harmless
        self.assertEqual(self.c.get("/api/me").get_json()["arena"]["done"], {"web": [0, 2]})
        r = self.put("/api/me/progress", {"spec": "web", "lesson": 2, "done": False})
        self.assertEqual(r.get_json()["arena"]["done"], {"web": [0]})
        for bad in ({"spec": "web", "lesson": 6, "done": True}, {"spec": "web", "lesson": -1, "done": True},
                    {"spec": "web", "lesson": True, "done": True}, {"spec": "nope", "lesson": 0, "done": True},
                    {"spec": "web", "lesson": 0, "done": "yes"}):
            self.assertEqual(self.put("/api/me/progress", bad).status_code, 400, bad)

    def test_quiz_keeps_best_score_and_counts_attempts(self):
        self.post("/api/me/quizzes", {"spec": "web", "score": 3, "total": 4})
        r = self.post("/api/me/quizzes", {"spec": "web", "score": 1, "total": 4})
        self.assertEqual(r.get_json()["quizzes"]["web"], {"best": 3, "total": 4, "attempts": 2})
        for bad in ({"spec": "web", "score": 5, "total": 4}, {"spec": "web", "score": -1, "total": 4},
                    {"spec": "web", "score": 3, "total": 9}, {"spec": "x", "score": 1, "total": 4},
                    {"spec": "web", "score": 1.5, "total": 4}):
            self.assertEqual(self.post("/api/me/quizzes", bad).status_code, 400, bad)

    def test_users_cannot_see_each_others_data(self):
        self.put("/api/me/arena", {"specs": ["web"]})
        other = self.app.test_client()
        self.signup("bob", client=other)
        self.assertEqual(other.get("/api/me").get_json()["arena"]["specs"], [])


class AdminTests(Base):
    def setUp(self):
        super().setUp()
        self.signup("ada")
        self.bob = self.app.test_client()
        self.signup("bob", client=self.bob)
        self.put("/api/me/arena", {"specs": ["web", "cloud"]}, self.bob)
        self.put("/api/me/progress", {"spec": "web", "lesson": 0, "done": True}, self.bob)
        self.post("/api/me/quizzes", {"spec": "web", "score": 2, "total": 4}, self.bob)

    def test_members_are_forbidden(self):
        self.assertEqual(self.bob.get("/api/admin/stats", headers=HDR).status_code, 403)
        self.assertEqual(self.bob.get("/api/admin/users", headers=HDR).status_code, 403)
        self.assertEqual(self.patch(f"/api/admin/users/{self.user_id('ada')}", {"role": "admin"}, self.bob).status_code, 403)

    def test_stats_and_users(self):
        self.make_admin("ada")
        s = self.c.get("/api/admin/stats", headers=HDR).get_json()
        self.assertEqual((s["users"], s["admins"], s["lessons_completed"], s["quizzes_taken"]), (2, 1, 1, 1))
        self.assertEqual((s["learners_per_spec"]["web"], s["learners_per_spec"]["network"]), (1, 0))
        users = self.c.get("/api/admin/users", headers=HDR).get_json()["users"]
        bob = [u for u in users if u["username"] == "bob"][0]
        self.assertEqual((bob["specs"], bob["lessons"], bob["quizzes"]), (["web", "cloud"], 1, 1))
        self.assertNotIn("password_hash", bob)
        found = self.c.get("/api/admin/users?q=BO", headers=HDR).get_json()["users"]
        self.assertEqual([u["username"] for u in found], ["bob"])
        self.assertEqual(self.c.get("/api/admin/users?q=%25", headers=HDR).get_json()["users"], [])  # % is not a wildcard

    def test_role_change_reset_and_delete(self):
        self.make_admin("ada")
        bob_id = self.user_id("bob")
        self.assertEqual(self.patch(f"/api/admin/users/{bob_id}", {"role": "admin"}).get_json()["user"]["role"], "admin")
        self.assertEqual(self.patch(f"/api/admin/users/{bob_id}", {"role": "owner"}).status_code, 400)
        self.assertEqual(self.patch(f"/api/admin/users/{bob_id}", {"role": "member"}).get_json()["user"]["role"], "member")
        self.assertEqual(self.post(f"/api/admin/users/{bob_id}/reset-progress").status_code, 200)
        me = self.bob.get("/api/me").get_json()
        self.assertEqual((me["arena"]["specs"], me["arena"]["done"], me["quizzes"]), ([], {}, {}))
        self.assertEqual(self.delete(f"/api/admin/users/{bob_id}").status_code, 200)
        self.assertEqual(self.bob.get("/api/me").status_code, 401)  # their session went with the account
        con = sqlite3.connect(self.db_path)
        left = con.execute("SELECT (SELECT COUNT(*) FROM sessions WHERE user_id=?), (SELECT COUNT(*) FROM lesson_progress WHERE user_id=?)",
                           (bob_id, bob_id)).fetchone()
        con.close()
        self.assertEqual(left, (0, 0))

    def test_admin_cannot_change_or_delete_themselves(self):
        self.make_admin("ada")
        ada_id = self.user_id("ada")
        self.assertEqual(self.patch(f"/api/admin/users/{ada_id}", {"role": "member"}).status_code, 400)
        self.assertEqual(self.delete(f"/api/admin/users/{ada_id}").status_code, 400)
        self.assertEqual(self.delete("/api/admin/users/9999").status_code, 404)


class GoogleTests(Base):
    config = {"GOOGLE_CLIENT_ID": "test-client"}

    def setUp(self):
        super().setUp()
        self.real = google_auth.verify_google_token
        self.claims = {"sub": "g-123", "email": "Chidi@Gmail.com", "email_verified": True, "name": "Chidi N"}
        google_auth.verify_google_token = lambda credential, client_id: (
            self.claims if credential == "good" else (_ for _ in ()).throw(ValueError("bad token")))

    def tearDown(self):
        google_auth.verify_google_token = self.real
        super().tearDown()

    def test_new_google_user_then_returning_user(self):
        r = self.post("/api/auth/google", {"credential": "good"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.get_json()["user"]["username"], "chidi")
        self.assertEqual(r.get_json()["user"]["provider"], "google")
        again = self.app.test_client()
        self.assertEqual(self.post("/api/auth/google", {"credential": "good"}, again).status_code, 200)
        con = sqlite3.connect(self.db_path)
        self.assertEqual(con.execute("SELECT COUNT(*) FROM users").fetchone()[0], 1)
        con.close()

    def test_google_account_cannot_log_in_with_a_password(self):
        self.post("/api/auth/google", {"credential": "good"})
        r = self.post("/api/auth/login", {"identifier": "chidi", "password": "anything-at-all"}, self.app.test_client())
        self.assertEqual(r.status_code, 401)

    def test_bad_or_unverified_token_is_refused(self):
        self.assertEqual(self.post("/api/auth/google", {"credential": "forged"}).status_code, 401)
        self.claims["email_verified"] = False
        self.assertEqual(self.post("/api/auth/google", {"credential": "good"}).status_code, 401)

    def test_google_does_not_merge_into_an_existing_password_account(self):
        self.post("/api/auth/signup", {"email": "chidi@gmail.com", "username": "squatter", "password": "supersecret1"},
                  self.app.test_client())
        self.assertEqual(self.post("/api/auth/google", {"credential": "good"}).status_code, 409)

    def test_not_configured(self):
        app = create_app({"DB_PATH": self.db_path, "SERVE_FRONTEND": False, "GOOGLE_CLIENT_ID": ""})
        self.assertEqual(app.test_client().post("/api/auth/google", json={"credential": "good"}, headers=HDR).status_code, 501)


class CorsTests(Base):
    config = {"CORS_ORIGINS": ["http://localhost:5500"]}

    def test_allowed_origin_gets_cors_headers_and_preflight_works(self):
        r = self.c.options("/api/auth/login", headers={"Origin": "http://localhost:5500"})
        self.assertEqual(r.status_code, 204)
        self.assertEqual(r.headers["Access-Control-Allow-Origin"], "http://localhost:5500")
        self.assertEqual(r.headers["Access-Control-Allow-Credentials"], "true")
        r = self.signup(client=self.c)  # normal same-origin call still works
        self.assertEqual(r.status_code, 201)
        r = self.c.post("/api/auth/login", json={"identifier": "ada", "password": "supersecret1"},
                        headers=dict(HDR, Origin="http://localhost:5500"))
        self.assertEqual(r.status_code, 200)

    def test_other_origins_get_nothing(self):
        r = self.c.get("/api/health", headers={"Origin": "https://evil.example"})
        self.assertNotIn("Access-Control-Allow-Origin", r.headers)


class FrontendServingTests(Base):
    config = {"SERVE_FRONTEND": True, "FRONTEND_DIR": FRONTEND}

    def fetch(self, path):
        r = self.c.get(path)
        r.close()  # release the file handle
        return r

    def test_pages_are_served(self):
        self.assertEqual(self.fetch("/").status_code, 200)
        self.assertEqual(self.fetch("/login.html").status_code, 200)
        self.assertEqual(self.fetch("/css/app.css").status_code, 200)
        self.assertEqual(self.fetch("/admin/").status_code, 200)
        r = self.fetch("/admin")
        self.assertIn(r.status_code, (301, 302, 307, 308))
        self.assertTrue(r.headers["Location"].endswith("/admin/"))
        home = self.c.get("/")
        self.assertIn(b"Cybearea", home.data)
        home.close()

    def test_private_files_and_traversal_are_blocked(self):
        for path in ("/tests/e2e.py", "/README.md", "/js/../../backend/app.py", "/%2e%2e/backend/app.py",
                     "/..%2fbackend%2fapp.py", "/api/nothing-here"):
            self.assertEqual(self.fetch(path).status_code, 404, path)


if __name__ == "__main__":
    unittest.main()
