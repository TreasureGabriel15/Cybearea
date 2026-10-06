"""Admin tasks from the terminal.

    python manage.py init-db
    python manage.py list-users
    python manage.py make-admin <username or email>
    python manage.py remove-admin <username or email>
"""
import argparse
import sys

from app import create_app
from db import get_db, init_db


def find(db, who):
    who = who.strip().lower()
    return db.execute("SELECT * FROM users WHERE username = ? OR email = ?", (who, who)).fetchone()


def main():
    parser = argparse.ArgumentParser(description="Cybearea admin tasks")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init-db", help="create the database tables")
    sub.add_parser("list-users", help="show every account")
    for name in ("make-admin", "remove-admin"):
        sub.add_parser(name).add_argument("who", help="username or email")
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        db = get_db()
        if args.cmd == "init-db":
            init_db()
            print("Database ready at", app.config["DB_PATH"])
        elif args.cmd == "list-users":
            for u in db.execute("SELECT username, email, role FROM users ORDER BY id"):
                print(f"{u['username']:<20} {u['email']:<32} {u['role']}")
        else:
            user = find(db, args.who)
            if user is None:
                sys.exit(f"No user found for '{args.who}'.")
            role = "admin" if args.cmd == "make-admin" else "member"
            db.execute("UPDATE users SET role = ? WHERE id = ?", (role, user["id"]))
            db.commit()
            print(f"{user['username']} is now {role}.")


if __name__ == "__main__":
    main()
