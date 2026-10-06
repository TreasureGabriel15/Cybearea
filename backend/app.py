import os

from flask import Flask, abort, jsonify, redirect, request, send_from_directory
from werkzeug.exceptions import HTTPException

from api import admin as admin_api, auth as auth_api, me as me_api
from db import close_db, init_db
from errors import ApiError
from security import LoginLimiter, load_user

BASE = os.path.dirname(os.path.abspath(__file__))


def load_dotenv(path):
    """Tiny .env reader so you don't need another package."""
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def create_app(overrides=None):
    load_dotenv(os.path.join(BASE, ".env"))
    app = Flask(__name__, static_folder=None)
    app.url_map.strict_slashes = False
    app.config.update(
        DB_PATH=os.environ.get("CYBEAREA_DB", os.path.join(BASE, "data", "cybearea.db")),
        COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "0") == "1",
        GOOGLE_CLIENT_ID=os.environ.get("GOOGLE_CLIENT_ID", ""),
        CORS_ORIGINS=[o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()],
        SERVE_FRONTEND=os.environ.get("SERVE_FRONTEND", "1") == "1",
        FRONTEND_DIR=os.environ.get("FRONTEND_DIR", os.path.join(BASE, "..", "frontend")),
        SCRYPT_N=2**15,
        MAX_CONTENT_LENGTH=64 * 1024,
    )
    if overrides:
        app.config.update(overrides)

    os.makedirs(os.path.dirname(os.path.abspath(app.config["DB_PATH"])), exist_ok=True)
    app.extensions["limiter"] = LoginLimiter()
    app.teardown_appcontext(close_db)
    with app.app_context():
        init_db()

    # ---------- request checks (run in this order) ----------
    @app.before_request
    def preflight():
        if request.method == "OPTIONS" and request.path.startswith("/api"):
            return "", 204

    @app.before_request
    def csrf_guard():
        if request.method in ("GET", "HEAD", "OPTIONS") or not request.path.startswith("/api"):
            return
        origin = request.headers.get("Origin")
        if origin and origin != request.host_url.rstrip("/") and origin not in app.config["CORS_ORIGINS"]:
            raise ApiError(403, "Cross-site request blocked.", "bad_origin")
        if request.headers.get("X-Requested-With") != "cybearea":
            raise ApiError(403, "Missing X-Requested-With header.", "csrf")

    app.before_request(load_user)

    @app.after_request
    def add_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        if request.path.startswith("/api"):
            resp.headers["Cache-Control"] = "no-store"
        origin = request.headers.get("Origin")
        if origin and origin in app.config["CORS_ORIGINS"]:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Credentials"] = "true"
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Requested-With"
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            resp.headers["Vary"] = "Origin"
        return resp

    # ---------- errors always come back as JSON on /api ----------
    @app.errorhandler(ApiError)
    def api_error(e):
        return jsonify(error=e.message, code=e.code), e.status

    @app.errorhandler(HTTPException)
    def http_error(e):
        if request.path.startswith("/api"):
            return jsonify(error=e.description, code=e.name.lower().replace(" ", "_")), e.code
        return e

    @app.errorhandler(Exception)
    def crash(e):
        app.logger.exception("Unhandled error")
        if request.path.startswith("/api"):
            return jsonify(error="Something went wrong on our side.", code="server_error"), 500
        return "Server error", 500

    # ---------- routes ----------
    app.register_blueprint(auth_api.bp)
    app.register_blueprint(me_api.bp)
    app.register_blueprint(admin_api.bp)

    @app.get("/api/health")
    def health():
        return jsonify(ok=True)

    if app.config["SERVE_FRONTEND"]:
        root = os.path.abspath(app.config["FRONTEND_DIR"])

        @app.get("/", defaults={"path": ""})
        @app.get("/<path:path>")
        def frontend(path):
            """Dev convenience: serve ../frontend from the same address so there is nothing to configure."""
            if path == "api" or path.startswith("api/"):
                abort(404)
            if path.split("/")[0] == "tests" or path.endswith((".py", ".md")):
                abort(404)
            target = path or "index.html"
            if os.path.isdir(os.path.join(root, target)):
                if not request.path.endswith("/"):
                    return redirect(request.path + "/")
                target = os.path.join(target, "index.html")
            return send_from_directory(root, target)

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")),
                     debug=os.environ.get("FLASK_DEBUG") == "1")
