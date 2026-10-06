// Everything is stored in YOUR browser only (localStorage) — fine for a prototype.
// For real accounts you need a backend (e.g. Go + a database).

// ===== Google sign-in setup =====
// 1) Create an OAuth "Web application" Client ID at https://console.cloud.google.com/apis/credentials
// 2) Add http://localhost:8000 (or your site) under "Authorized JavaScript origins"
// 3) Paste the Client ID below. Google sign-in does NOT work from a file:// page.
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

const USERS_KEY = "cybearea_users";      // { username: { email, salt?, hash?, provider? } }
const SESSION_KEY = "cybearea_session";
const profileKey = (u) => "cybearea_profile_" + u;

const $ = (id) => document.getElementById(id);
let mode = "signin"; // or "signup"
let pending = null;  // signup data waiting for password confirmation

// ---------- storage ----------
const loadUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
const saveUsers = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));

// ---------- password hashing (raw password is never stored) ----------
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const newSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));
async function hashPassword(password, salt) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + password)));
}

// ---------- UI ----------
function setMode(next) {
  mode = next;
  const up = mode === "signup";
  $("tab-signin").classList.toggle("active", !up);
  $("tab-signup").classList.toggle("active", up);
  $("email-row").hidden = !up;
  $("email-in").required = up;
  $("hint").hidden = !up;
  $("username-label").textContent = up ? "Username" : "Username or email";
  $("password-label").textContent = up ? "Create password" : "Password";
  $("password").autocomplete = up ? "new-password" : "current-password";
  $("sign-in").textContent = up ? "Create account" : "Sign in";
  $("google-label").textContent = up ? "Sign up with Google" : "Sign in with Google";
  $("auth-msg").textContent = "";
  renderGoogleButton();
}

function startSession(username) {
  localStorage.setItem(SESSION_KEY, username);
  location.href = "app.html";
}

const cryptoOk = () => window.crypto && crypto.subtle;

// ---------- sign in / sign up ----------
$("tab-signin").addEventListener("click", () => setMode("signin"));
$("tab-signup").addEventListener("click", () => setMode("signup"));

$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("auth-msg");
  msg.textContent = "";
  if (!cryptoOk()) { msg.textContent = "Open this page over localhost or https so hashing works."; return; }

  const users = loadUsers();
  const id = $("username").value.trim().toLowerCase();
  const password = $("password").value;

  if (mode === "signin") {
    const name = Object.keys(users).find((n) => n === id || users[n].email === id);
    const user = name && users[name];
    if (!user || !user.hash || (await hashPassword(password, user.salt)) !== user.hash) {
      msg.textContent = user && user.provider === "google"
        ? "This account uses Google. Use Sign in with Google."
        : "Wrong username or password.";
      return;
    }
    startSession(name);
    return;
  }

  // sign up: validate, then ask for confirmation in a pop-up
  const email = $("email-in").value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = "Enter a valid email address."; return; }
  if (!/^[a-z0-9_.-]{3,20}$/.test(id)) { msg.textContent = "Username: 3–20 letters, numbers, . _ -"; return; }
  if (users[id]) { msg.textContent = "That username is taken."; return; }
  if (Object.values(users).some((u) => u.email === email)) { msg.textContent = "That email already has an account."; return; }
  if (password.length < 8) { msg.textContent = "Password must be at least 8 characters."; return; }

  pending = { email, username: id, password };
  $("confirm-pw").value = "";
  $("confirm-msg").textContent = "";
  $("confirm-dialog").showModal();
  $("confirm-pw").focus();
});

// ---------- confirm password pop-up ----------
function closeConfirm() {
  $("confirm-dialog").close();
  pending = null;
  $("confirm-pw").value = "";
}

$("confirm-cancel").addEventListener("click", closeConfirm);
$("confirm-dialog").addEventListener("cancel", () => { pending = null; }); // Esc key

$("confirm-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pending) return;
  if ($("confirm-pw").value !== pending.password) {
    $("confirm-msg").textContent = "Passwords don't match. Try again.";
    return;
  }
  const { email, username, password } = pending;
  const salt = newSalt();
  const users = loadUsers();
  users[username] = { email, salt, hash: await hashPassword(password, salt), created: Date.now() };
  saveUsers(users);
  closeConfirm();
  $("auth-form").reset();
  startSession(username);
});

// ---------- Google ----------
const googleReady = !GOOGLE_CLIENT_ID.startsWith("YOUR_");

function parseJwt(token) {
  const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(atob(b64).split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
  return JSON.parse(json);
}

// NOTE: in a real app, send resp.credential to your server and verify it there.
function handleGoogle(resp) {
  const p = parseJwt(resp.credential);
  const email = p.email.toLowerCase();
  const users = loadUsers();
  let name = Object.keys(users).find((n) => users[n].email === email);

  if (!name) {
    const base = email.split("@")[0].replace(/[^a-z0-9_.-]/g, "").slice(0, 16) || "user";
    name = base;
    for (let i = 2; users[name]; i++) name = base + i;
    users[name] = { email, provider: "google", created: Date.now() };
    saveUsers(users);
    localStorage.setItem(profileKey(name), JSON.stringify({ name: p.name || "", email, notes: "" }));
  }
  startSession(name);
}

function renderGoogleButton() {
  const holder = $("google-btn");
  if (!googleReady || !window.google || !google.accounts) return;
  holder.innerHTML = "";
  google.accounts.id.renderButton(holder, {
    theme: "filled_black", size: "large", shape: "pill", width: 300,
    text: mode === "signup" ? "signup_with" : "signin_with",
  });
}

function initGoogle() {
  if (!googleReady) {
    $("google-fallback").addEventListener("click", () => {
      $("auth-msg").textContent = "Google isn't set up yet. Add your Client ID at the top of app.js.";
    });
    return;
  }
  $("google-fallback").hidden = true;
  const s = document.createElement("script");
  s.src = "https://accounts.google.com/gsi/client";
  s.async = true;
  s.onload = () => {
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogle });
    renderGoogleButton();
  };
  s.onerror = () => {
    $("google-fallback").hidden = false;
    $("google-fallback").addEventListener("click", () => {
      $("auth-msg").textContent = "Couldn't reach Google. Check your connection.";
    });
  };
  document.head.appendChild(s);
}

// ---------- 3D tilt (mouse only) ----------
(function () {
  if (!matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const card = document.querySelector(".card");
  window.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    const cx = (e.clientX - r.left) / r.width, cy = (e.clientY - r.top) / r.height;
    const near = Math.abs(cx - 0.5) < 1.2 && Math.abs(cy - 0.5) < 1.2;
    card.style.setProperty("--ry", near ? (cx - 0.5) * 8 + "deg" : "0deg");
    card.style.setProperty("--rx", near ? (cy - 0.5) * -8 + "deg" : "0deg");
    card.style.setProperty("--mx", cx * 100 + "%");
    card.style.setProperty("--my", cy * 100 + "%");
  });
})();

// ---------- show / hide password ----------
$("pw-toggle").addEventListener("click", () => {
  const show = $("password").type === "password";
  $("password").type = show ? "text" : "password";
  $("pw-toggle").textContent = show ? "Hide" : "Show";
  $("pw-toggle").setAttribute("aria-label", show ? "Hide password" : "Show password");
});

// ---------- start ----------
setMode(location.hash === "#signup" ? "signup" : "signin");
window.addEventListener("hashchange", () => setMode(location.hash === "#signup" ? "signup" : "signin"));
initGoogle();
const current = localStorage.getItem(SESSION_KEY);
if (current && loadUsers()[current]) location.replace("app.html");
