import base64
import hashlib
import hmac
import os
import secrets
import time
from functools import wraps

from flask import current_app, g, request

from db import get_db, now_ms
from errors import ApiError

SESSION_COOKIE = "cybearea_session"
SESSION_DAYS = 14
_R, _P, _MAXMEM = 8, 1, 2**28


# ---------- passwords (scrypt, salted, from the standard library) ----------
def _b64(raw):
    return base64.b64encode(raw).decode()


def hash_password(password):
    n = current_app.config.get("SCRYPT_N", 2**15)
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=n, r=_R, p=_P, maxmem=_MAXMEM, dklen=32)
    return f"scrypt${n}${_R}${_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password, stored):
    """Checks a password. With no stored hash it still does the same work, so timing doesn't reveal which accounts exist."""
    if not stored:
        _verify(password, _dummy_hash())
        return False
    return _verify(password, stored)


def _verify(password, stored):
    try:
        scheme, n, r, p, salt, expected = stored.split("$")
        digest = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p),
                                maxmem=_MAXMEM, dklen=32)
        return scheme == "scrypt" and hmac.compare_digest(digest, base64.b64decode(expected))
    except (ValueError, TypeError):
        return False


_dummy = {}


def _dummy_hash():
    n = current_app.config.get("SCRYPT_N", 2**15)
    if n not in _dummy:
        _dummy[n] = hash_password("not-a-real-password")
    return _dummy[n]


# ---------- sessions (random token in an HttpOnly cookie, hash stored in the database) ----------
def _hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    now = now_ms()
    db = get_db()
    db.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
    db.execute("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)",
               (_hash_token(token), user_id, now, now + SESSION_DAYS * 86400 * 1000))
    db.commit()
    return token


def destroy_session(token):
    db = get_db()
    db.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))
    db.commit()


def set_session_cookie(response, token):
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, samesite="Lax",
                        secure=current_app.config["COOKIE_SECURE"], path="/")


def clear_session_cookie(response):
    response.delete_cookie(SESSION_COOKIE, path="/")


def load_user():
    """Runs before every API request: finds who is signed in (or nobody)."""
    g.user = None
    if not request.path.startswith("/api"):
        return
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return
    g.user = get_db().execute(
        "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
        (_hash_token(token), now_ms())).fetchone()


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if g.user is None:
            raise ApiError(401, "Please sign in.", "unauthenticated")
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    @login_required
    def wrapper(*args, **kwargs):
        if g.user["role"] != "admin":
            raise ApiError(403, "Admins only.", "forbidden")
        return fn(*args, **kwargs)
    return wrapper


# ---------- brute-force protection (in memory: fine for one server process) ----------
class LoginLimiter:
    def __init__(self, max_fails=5, window=900):
        self.max_fails, self.window, self.fails = max_fails, window, {}

    def _recent(self, key):
        now = time.time()
        recent = [t for t in self.fails.get(key, []) if now - t < self.window]
        self.fails[key] = recent
        return recent

    def blocked(self, key):
        return len(self._recent(key)) >= self.max_fails

    def fail(self, key):
        self._recent(key).append(time.time())

    def clear(self, key):
        self.fails.pop(key, None)
