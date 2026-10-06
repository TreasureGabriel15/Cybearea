from flask import Blueprint, g, jsonify

from catalog import CATALOG
from db import get_db, now_ms
from errors import ApiError
from security import login_required
from validators import clean_email, clean_text, is_int, json_body

bp = Blueprint("me", __name__, url_prefix="/api/me")


def public_user(u):
    return {"id": u["id"], "username": u["username"], "email": u["email"], "role": u["role"], "name": u["name"],
            "provider": "google" if u["google_sub"] else "password", "created_at": u["created_at"]}


def me_payload(db, u):
    """Everything the app needs after sign-in, in one response."""
    uid = u["id"]
    specs = [r["spec_id"] for r in db.execute("SELECT spec_id FROM user_specs WHERE user_id = ? ORDER BY position", (uid,))]
    done = {}
    for r in db.execute("SELECT spec_id, lesson FROM lesson_progress WHERE user_id = ? ORDER BY lesson", (uid,)):
        done.setdefault(r["spec_id"], []).append(r["lesson"])
    quizzes = {r["spec_id"]: {"best": r["best"], "total": r["total"], "attempts": r["attempts"]}
               for r in db.execute("SELECT * FROM quiz_scores WHERE user_id = ?", (uid,))}
    return {"user": public_user(u),
            "profile": {"name": u["name"], "email": u["email"], "notes": u["notes"]},
            "arena": {"specs": specs, "active": u["active_spec"], "done": done},
            "quizzes": quizzes}


def _fresh_user(db):
    return db.execute("SELECT * FROM users WHERE id = ?", (g.user["id"],)).fetchone()


@bp.get("/")
@login_required
def get_me():
    db = get_db()
    return jsonify(me_payload(db, _fresh_user(db)))


@bp.patch("/")
@login_required
def update_profile():
    data, db, uid = json_body(), get_db(), g.user["id"]
    changes = {}
    if "name" in data:
        changes["name"] = clean_text(data["name"], "Name", 80)
    if "notes" in data:
        changes["notes"] = clean_text(data["notes"], "About me", 2000)
    if "email" in data:
        email = clean_email(data["email"])
        if db.execute("SELECT 1 FROM users WHERE email = ? AND id != ?", (email, uid)).fetchone():
            raise ApiError(409, "That email already has an account.", "email_taken")
        changes["email"] = email
    if changes:
        # Column names come from the fixed keys above, never from the request.
        sets = ", ".join(f"{col} = ?" for col in changes)
        db.execute(f"UPDATE users SET {sets} WHERE id = ?", (*changes.values(), uid))
        db.commit()
    return jsonify(me_payload(db, _fresh_user(db)))


@bp.put("/arena")
@login_required
def set_arena():
    data, db, uid = json_body(), get_db(), g.user["id"]
    specs = data.get("specs")
    if not isinstance(specs, list) or not all(isinstance(s, str) and s in CATALOG for s in specs):
        raise ApiError(400, "specs must be a list of valid specialization ids.", "invalid_specs")
    specs = list(dict.fromkeys(specs))  # remove duplicates, keep order
    active = data.get("active")
    if active is None:
        active = specs[0] if specs else None
    if active is not None and active not in specs:
        raise ApiError(400, "active must be one of your specializations.", "invalid_active")
    db.execute("DELETE FROM user_specs WHERE user_id = ?", (uid,))
    db.executemany("INSERT INTO user_specs (user_id, spec_id, position) VALUES (?,?,?)",
                   [(uid, s, i) for i, s in enumerate(specs)])
    db.execute("UPDATE users SET active_spec = ? WHERE id = ?", (active, uid))
    db.commit()
    return jsonify(me_payload(db, _fresh_user(db)))


@bp.put("/progress")
@login_required
def set_progress():
    data, db, uid = json_body(), get_db(), g.user["id"]
    spec, lesson, done = data.get("spec"), data.get("lesson"), data.get("done")
    if not isinstance(spec, str) or spec not in CATALOG:
        raise ApiError(400, "Unknown specialization.", "invalid_spec")
    if not is_int(lesson) or not 0 <= lesson < CATALOG[spec]["lessons"]:
        raise ApiError(400, "Unknown lesson.", "invalid_lesson")
    if not isinstance(done, bool):
        raise ApiError(400, "done must be true or false.", "invalid_done")
    if done:
        db.execute("INSERT OR IGNORE INTO lesson_progress (user_id, spec_id, lesson, completed_at) VALUES (?,?,?,?)",
                   (uid, spec, lesson, now_ms()))
    else:
        db.execute("DELETE FROM lesson_progress WHERE user_id = ? AND spec_id = ? AND lesson = ?", (uid, spec, lesson))
    db.commit()
    return jsonify(me_payload(db, _fresh_user(db)))


@bp.post("/quizzes")
@login_required
def save_quiz():
    data, db, uid = json_body(), get_db(), g.user["id"]
    spec, score, total = data.get("spec"), data.get("score"), data.get("total")
    if not isinstance(spec, str) or spec not in CATALOG:
        raise ApiError(400, "Unknown specialization.", "invalid_spec")
    if not is_int(total) or total != CATALOG[spec]["quiz"]:
        raise ApiError(400, "total does not match this quiz.", "invalid_total")
    if not is_int(score) or not 0 <= score <= total:
        raise ApiError(400, "score must be between 0 and total.", "invalid_score")
    db.execute(
        """INSERT INTO quiz_scores (user_id, spec_id, best, total, attempts, updated_at) VALUES (?,?,?,?,1,?)
           ON CONFLICT(user_id, spec_id) DO UPDATE SET best = MAX(best, excluded.best), total = excluded.total,
           attempts = attempts + 1, updated_at = excluded.updated_at""",
        (uid, spec, score, total, now_ms()))
    db.commit()
    return jsonify(me_payload(db, _fresh_user(db)))
