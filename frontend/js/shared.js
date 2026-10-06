// Helpers shared by the app and the admin panel.
const VAL = { USERS: "cybearea_users", SESSION: "cybearea_session" };

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
}
function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// Roles live in the browser for now. If nobody is an admin yet, the earliest account becomes one.
function ensureRoles() {
  const users = readJSON(VAL.USERS, {}), names = Object.keys(users);
  let changed = false;
  if (names.length && !names.some((n) => users[n].role === "admin")) { users[names[0]].role = "admin"; changed = true; }
  names.forEach((n) => { if (!users[n].role) { users[n].role = "member"; changed = true; } });
  if (changed) writeJSON(VAL.USERS, users);
  return users;
}
