from flask import Blueprint, g, jsonify, request

from api.me import public_user
from catalog import CATALOG
from db import get_db
from errors import ApiError
from security import admin_required
from validators import json_body

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _target(user_id):
    row = get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise ApiError(404, "No such user.", "not_found")
    if row["id"] == g.user["id"]:
        raise ApiError(400, "You can't do that to your own account.", "self_action")
    return row


@bp.get("/stats")
@admin_required
def stats():
    db = get_db()
    one = lambda sql: db.execute(sql).fetchone()[0]
    learners = {k: 0 for k in CATALOG}
    for r in db.execute("SELECT spec_id, COUNT(*) AS n FROM user_specs GROUP BY spec_id"):
        learners[r["spec_id"]] = r["n"]
    lessons = {k: 0 for k in CATALOG}
    for r in db.execute("SELECT spec_id, COUNT(*) AS n FROM lesson_progress GROUP BY spec_id"):
        lessons[r["spec_id"]] = r["n"]
    return jsonify(users=one("SELECT COUNT(*) FROM users"),
                   admins=one("SELECT COUNT(*) FROM users WHERE role = 'admin'"),
                   lessons_completed=one("SELECT COUNT(*) FROM lesson_progress"),
                   quizzes_taken=one("SELECT COUNT(*) FROM quiz_scores"),
                   learners_per_spec=learners, lessons_per_spec=lessons)


@bp.get("/users")
@admin_required
def users():
    db = get_db()
    q = (request.args.get("q") or "").strip().lower()
    like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    limit = min(max(request.args.get("limit", 100, type=int), 1), 500)
    offset = max(request.args.get("offset", 0, type=int), 0)
    rows = db.execute(
        """SELECT u.*, (SELECT COUNT(*) FROM lesson_progress p WHERE p.user_id = u.id) AS lessons,
                  (SELECT COUNT(*) FROM quiz_scores s WHERE s.user_id = u.id) AS quizzes
           FROM users u WHERE (? = '' OR u.username LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')
           ORDER BY u.created_at, u.id LIMIT ? OFFSET ?""", (q, like, like, limit, offset)).fetchall()
    specs = {}
    for r in db.execute("SELECT user_id, spec_id FROM user_specs ORDER BY position"):
        specs.setdefault(r["user_id"], []).append(r["spec_id"])
    return jsonify(users=[dict(public_user(r), specs=specs.get(r["id"], []), lessons=r["lessons"], quizzes=r["quizzes"])
                          for r in rows])


@bp.patch("/users/<int:user_id>")
@admin_required
def change_role(user_id):
    role = json_body().get("role")
    if role not in ("member", "admin"):
        raise ApiError(400, "role must be member or admin.", "invalid_role")
    target = _target(user_id)
    db = get_db()
    db.execute("UPDATE users SET role = ? WHERE id = ?", (role, target["id"]))
    db.commit()
    return jsonify(user=public_user(db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()))


@bp.post("/users/<int:user_id>/reset-progress")
@admin_required
def reset_progress(user_id):
    target, db = _target(user_id), get_db()
    for table in ("lesson_progress", "quiz_scores", "user_specs"):
        db.execute(f"DELETE FROM {table} WHERE user_id = ?", (target["id"],))
    db.execute("UPDATE users SET active_spec = NULL WHERE id = ?", (target["id"],))
    db.commit()
    return jsonify(ok=True)


@bp.delete("/users/<int:user_id>")
@admin_required
def delete_user(user_id):
    target, db = _target(user_id), get_db()
    db.execute("DELETE FROM users WHERE id = ?", (target["id"],))  # sessions, progress and scores cascade
    db.commit()
    return jsonify(ok=True)
