# Cybearea frontend

## Folder structure

```
cybearea/                  <- your project root
  frontend/                <- everything in this zip
    index.html             Landing page (buttons lead to login / sign up)
    login.html             Sign in, create account, Google, confirm-password pop-up
    app.html               Main app: Profile, Assessments, Arena, Chats, Quizzes
    admin/                 Admin dashboard (admins only), served at /admin/
      index.html
      admin.css
      admin.js
    assets/
      logo.jpg             The Cybearea logo (used on the landing page)
    css/
      landing.css          Styles for index.html
      login.css            Styles for login.html
      app.css              Styles for app.html (admin reuses it too)
    js/
      data.js              Specializations, lessons, links and quiz questions: edit content here
      shared.js            Storage helpers and admin-role logic used by app and admin
      login.js             Login / sign up / Google logic
      app.js               Logic for every view in the main app
    tests/
      e2e.py               Automated browser test for all pages
    README.md
  backend/                 <- your Go/Python API goes here later, next to frontend/
```

Where new things go:
- A new page: an .html file in the frontend root, its CSS in css/, its JS in js/.
- New admin screens: inside admin/ only. Admin code never goes in js/ or css/ (except shared helpers in js/shared.js).
- Images and icons: assets/.
- Lesson, link or quiz changes: js/data.js.

## Run it
Serve the frontend folder (Google sign-in does not work from file:// pages):

    cd frontend
    python -m http.server 8000

Open http://localhost:8000. The admin dashboard is at http://localhost:8000/admin/

## Admin
- The first account created in a browser becomes the admin. Admins can promote others in Admin > Users.
- An Admin link appears in the app sidebar for admins only.
- IMPORTANT: this is a development shortcut. Anyone can read admin/ and edit browser storage, so real
  protection must come from your backend. When you build it:
  1. Store a role on each user in the database, and make yourself admin directly in the database
     or from an ADMIN_EMAIL setting. Do not use "first signup wins" on a live site.
  2. Protect every admin API route with a role check on the server.
  3. Keep admin/ in this folder for now. Later you can deploy it separately if you want it hidden.

## Test it
    pip install playwright
    playwright install chromium
    python tests/e2e.py

By hand: open the browser console (F12). It should stay free of red errors while you click through every page.
To start fresh, run `localStorage.clear()` in the console and reload.

## Moving to React later
- data.js becomes a data module. Each view in app.js and admin/admin.js becomes a component.
- The variables that drive each view (view, sel, quiz, thread...) become useState.
- The load/save helpers become a useLocalStorage hook, then API calls once the backend exists.
- The CSS files can be imported as they are.
- Keep the ids and data-attributes (#start, #toggle, data-view, data-act...). tests/e2e.py drives the
  page through them, so the same file will tell you whether the React version behaves the same.
