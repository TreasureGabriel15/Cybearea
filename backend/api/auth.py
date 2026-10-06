import re
import sqlite3

from flask import Blueprint, current_app, jsonify, request

import google_auth
from api.me import public_user
from db import get_db, now_ms
from errors import ApiError
from security import (clear_session_cookie, create_session, destroy_session, hash_password, set_session_cookie,
                      SESSION_COOKIE, verify_password)
from validators import clean_email, clean_password, clean_username, json_body

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def start_session(user_id, status=200):
    user = get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    response = jsonify(user=public_user(user))
    response.status_code = status
    set_session_cookie(response, create_session(user_id))
    return response


@bp.post("/signup")
def signup():
    data = json_body()
    email = clean_email(data.get("email"))
    username = clean_username(data.get("username"))
    password = clean_password(data.get("password"))
    db = get_db()
    if db.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
        raise ApiError(409, "That username is taken.", "username_taken")
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise ApiError(409, "That email already has an account.", "email_taken")
    try:
        # Role is never read from the request: every new account is a member.
        cur = db.execute("INSERT INTO users (username, email, password_hash, created_at) VALUES (?,?,?,?)",
                         (username, email, hash_password(password), now_ms()))
        db.commit()
    except sqlite3.IntegrityError:
        raise ApiError(409, "That username or email is already registered.", "taken")
    return start_session(cur.lastrowid, 201)


@bp.post("/login")
def login():
    data = json_body()
    identifier = str(data.get("identifier") or "").strip().lower()
    password = data.get("password")
    if not identifier or not isinstance(password, str) or len(password) > 128:
        raise ApiError(400, "Enter your username or email and your password.", "missing_fields")

    limiter = current_app.extensions["limiter"]
    key = f"{request.remote_addr}|{identifier}"
    if limiter.blocked(key):
        raise ApiError(429, "Too many attempts. Try again in a few minutes.", "rate_limited")

    user = get_db().execute("SELECT * FROM users WHERE username = ? OR email = ?", (identifier, identifier)).fetchone()
    ok = verify_password(password, user["password_hash"] if user else None)
    if not user or not ok:
        limiter.fail(key)
        raise ApiError(401, "Wrong username or password.", "bad_credentials")
    limiter.clear(key)
    return start_session(user["id"])


@bp.post("/logout")
def logout():
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        destroy_session(token)
    response = jsonify(ok=True)
    clear_session_cookie(response)
    return response


def _unique_username(db, email):
    base = re.sub(r"[^a-z0-9_.-]", "", email.split("@")[0].lower())[:16]
    if len(base) < 3:
        base = (base + "user")[:16]
    name, i = base, 2
    while db.execute("SELECT 1 FROM users WHERE username = ?", (name,)).fetchone():
        name, i = f"{base}{i}", i + 1
    return name


@bp.post("/google")
def google():
    client_id = current_app.config["GOOGLE_CLIENT_ID"]
    if not client_id:
        raise ApiError(501, "Google sign-in is not configured on the server.", "google_not_configured")
    credential = json_body().get("credential")
    if not isinstance(credential, str) or not credential:
        raise ApiError(400, "Missing Google credential.", "missing_credential")
    try:
        claims = google_auth.verify_google_token(credential, client_id)
    except Exception:
        raise ApiError(401, "Google sign-in could not be verified.", "bad_google_token")
    if not claims.get("email_verified") or not claims.get("email") or not claims.get("sub"):
        raise ApiError(401, "Your Google email is not verified.", "unverified_email")

    db = get_db()
    email, sub = claims["email"].strip().lower(), str(claims["sub"])
    user = db.execute("SELECT * FROM users WHERE google_sub = ?", (sub,)).fetchone()
    if user:
        return start_session(user["id"])
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        # Linking automatically would let someone who pre-registered your email take over your Google login.
        raise ApiError(409, "An account with this email already exists. Sign in with your password.", "email_taken")
    cur = db.execute("INSERT INTO users (username, email, google_sub, name, created_at) VALUES (?,?,?,?,?)",
                     (_unique_username(db, email), email, sub, str(claims.get("name") or "")[:80], now_ms()))
    db.commit()
    return start_session(cur.lastrowid, 201)
