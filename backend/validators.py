import re

from flask import request

from errors import ApiError

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[a-z0-9_.-]{3,20}$")


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError(400, "Send a JSON object.", "bad_json")
    return data


def clean_email(value):
    value = value.strip().lower() if isinstance(value, str) else ""
    if len(value) > 254 or not EMAIL_RE.match(value):
        raise ApiError(400, "Enter a valid email address.", "invalid_email")
    return value


def clean_username(value):
    value = value.strip().lower() if isinstance(value, str) else ""
    if not USERNAME_RE.match(value):
        raise ApiError(400, "Username: 3-20 letters, numbers, . _ -", "invalid_username")
    return value


def clean_password(value):
    if not isinstance(value, str) or len(value) < 8:
        raise ApiError(400, "Password must be at least 8 characters.", "weak_password")
    if len(value) > 128:
        raise ApiError(400, "Password must be 128 characters or fewer.", "long_password")
    return value


def clean_text(value, label, max_len):
    if not isinstance(value, str):
        raise ApiError(400, f"{label} must be text.", "invalid_text")
    value = value.strip()
    if len(value) > max_len:
        raise ApiError(400, f"{label} must be {max_len} characters or fewer.", "too_long")
    return value


def is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)
