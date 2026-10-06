# Cybearea backend (Flask + SQLite)

Accounts, sessions, specializations, lesson progress, quiz scores and the admin API.
In development it also serves `../frontend`, so one command runs the whole site.

## Run it (Linux)

    cd cybearea/backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env
    python app.py

Open http://localhost:5000

Make yourself the admin (sign up in the browser first):

    python manage.py make-admin yourusername

Run the tests:

    python -m unittest discover -s tests -v

## Folder structure

    backend/
      app.py            builds the app: security headers, CORS, errors, serves the frontend in dev
      db.py             SQLite connection and table definitions
      security.py       password hashing (scrypt), sessions, login/admin guards, brute-force limiter
      validators.py     input checks
      catalog.py        valid specialization ids and lesson/quiz counts (mirrors frontend/js/data.js)
      google_auth.py    verifies Google sign-in tokens
      errors.py         ApiError
      manage.py         terminal tasks: init-db, list-users, make-admin, remove-admin
      api/
        auth.py         signup, login, logout, google
        me.py           profile, specializations, lesson progress, quiz scores
        admin.py        stats, user list, roles, reset progress, delete user
      tests/test_api.py 34 tests
      data/             the SQLite database appears here (not committed)
      .env              your settings (not committed)

## API

All bodies are JSON. Every POST/PUT/PATCH/DELETE must send the header `X-Requested-With: cybearea`.
Errors look like `{"error": "message", "code": "machine_code"}`.

| Method | Path                                   | Who    | What                                             |
|--------|----------------------------------------|--------|--------------------------------------------------|
| POST   | /api/auth/signup                       | anyone | {email, username, password}, signs you in        |
| POST   | /api/auth/login                        | anyone | {identifier, password} (username or email)       |
| POST   | /api/auth/google                       | anyone | {credential} from Google's button                |
| POST   | /api/auth/logout                       | anyone | ends the session                                 |
| GET    | /api/me                                | member | user, profile, arena, quizzes in one response    |
| PATCH  | /api/me                                | member | {name, email, notes}                             |
| PUT    | /api/me/arena                          | member | {specs: [...], active}                           |
| PUT    | /api/me/progress                       | member | {spec, lesson, done}                             |
| POST   | /api/me/quizzes                        | member | {spec, score, total}, keeps the best score       |
| GET    | /api/admin/stats                       | admin  | totals and per-specialization counts             |
| GET    | /api/admin/users?q=&limit=&offset=     | admin  | list/search users                                |
| PATCH  | /api/admin/users/<id>                  | admin  | {role: "member" or "admin"}                      |
| POST   | /api/admin/users/<id>/reset-progress   | admin  | wipes their specializations, progress, scores    |
| DELETE | /api/admin/users/<id>                  | admin  | deletes the account                              |

## What is protected
- Passwords: scrypt with a random salt. Plain passwords are never stored or logged.
- Sessions: random token in an HttpOnly, SameSite=Lax cookie. Only its hash is stored, so a database leak
  can't be replayed, and logout really invalidates it.
- Admin: roles live in the database. Nobody can sign up as admin; you promote accounts with `manage.py`
  or from the admin panel. Every admin route checks the role on the server.
- Brute force: 5 wrong passwords for an account from one address locks it for 15 minutes.
  Wrong username and wrong password give the same answer.
- Cross-site requests: the custom header, an Origin check and SameSite cookies.
- Google: the token is verified on the server. A Google login never auto-merges into an existing
  password account with the same email.
- Also: parameterized SQL everywhere, input limits, no-store caching on API responses, security headers.

## Not done yet (in this order)
1. Connect the frontend: today the pages still use localStorage, so they don't call this API yet.
2. Chats (needs a table for messages and a way to push new ones).
3. Assessments graded on the server (never trust a score sent from the browser for those).
4. Email verification and password reset (signup does not prove someone owns the email yet).
5. Lesson and quiz content in the database so the admin panel can edit it.
6. Deploying: HTTPS, COOKIE_SECURE=1, a real server (gunicorn behind nginx or Caddy), backups of data/.
   `python app.py` is only for development. Move to PostgreSQL if you outgrow SQLite.
