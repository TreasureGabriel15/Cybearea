(function () {
  const user = localStorage.getItem(VAL.SESSION);
  let users = ensureRoles();
  if (!user || !users[user]) { location.replace("../login.html"); return; }
  if (users[user].role !== "admin") { location.replace("../app.html"); return; }

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const spec = (id) => SPECS.find((s) => s.id === id);
  const root = $("#view");
  let view = "overview", query = "";

  // ---------- reading the data ----------
  function rowsData() {
    users = readJSON(VAL.USERS, {});
    return Object.keys(users).map((n) => {
      const a = readJSON("cybearea_arena_" + n, { specs: [], done: {} });
      return {
        name: n, email: users[n].email || "", role: users[n].role || "member", created: users[n].created,
        specs: a.specs || [], done: a.done || {}, quizzes: Object.keys(readJSON("cybearea_quiz_" + n, {})).length
      };
    });
  }
  const lessonsOf = (r) => Object.values(r.done).reduce((t, a) => t + a.length, 0);
  function chatKeys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.indexOf("cybearea_chat_") === 0) out.push(k); }
    return out;
  }
  const allMessages = () => chatKeys().flatMap((k) => readJSON(k, []).map((m) => Object.assign({ key: k }, m))).sort((a, b) => b.ts - a.ts);
  function threadName(key) {
    const id = key.replace("cybearea_chat_", "");
    if (id.indexOf("g:") === 0) { const s = spec(id.slice(2)); return s ? s.name : "General"; }
    return "DM: " + id.slice(2).replace("|", " and ");
  }

  // ---------- views ----------
  function bars(items) {
    const max = Math.max(1, ...items.map((i) => i.n));
    return items.map((i) => `<div class="barrow" style="--acc:${i.s.acc}"><span>${esc(i.s.name)}</span><div class="bar"><i style="width:${(i.n / max) * 100}%"></i></div><em>${i.n}</em></div>`).join("");
  }

  function overviewView() {
    const rows = rowsData(), msgs = allMessages();
    const stat = (id, n, label) => `<div class="stat" data-stat="${id}"><b>${n}</b><span>${label}</span></div>`;
    const learners = SPECS.map((s) => ({ s, n: rows.filter((r) => r.specs.includes(s.id)).length }));
    const lessons = SPECS.map((s) => ({ s, n: rows.reduce((t, r) => t + (r.done[s.id] || []).length, 0) }));
    return `<h2>Overview</h2><p class="sub">How the platform is being used.</p>
      <div class="stats">
        ${stat("users", rows.length, "Users")}
        ${stat("admins", rows.filter((r) => r.role === "admin").length, "Admins")}
        ${stat("lessons", rows.reduce((t, r) => t + lessonsOf(r), 0), "Lessons completed")}
        ${stat("quizzes", rows.reduce((t, r) => t + r.quizzes, 0), "Quizzes taken")}
        ${stat("messages", msgs.length, "Messages")}
      </div>
      <div class="twocol">
        <section class="box"><h3>Learners per specialization</h3>${bars(learners)}</section>
        <section class="box"><h3>Lessons completed per specialization</h3>${bars(lessons)}</section>
      </div>
      <p class="note">Roles are stored in this browser for now, so this panel is for development. Real access control has to be enforced by your backend.</p>`;
  }

  function usersRows() {
    const q = query.trim().toLowerCase();
    return rowsData().filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)).map((r) => {
      const me = r.name === user;
      const chips = r.specs.map(spec).filter(Boolean).map((s) => `<span class="chip2" style="--acc:${s.acc}"><i></i>${esc(s.name)}</span>`).join("") || '<span class="muted">None</span>';
      const actions = me ? '<span class="muted">You</span>' :
        `<button type="button" class="mini" data-act="role">${r.role === "admin" ? "Remove admin" : "Make admin"}</button>
         <button type="button" class="mini" data-act="reset">Reset progress</button>
         <button type="button" class="mini danger" data-act="delete">Delete</button>`;
      return `<tr data-user="${esc(r.name)}"><td><strong>${esc(r.name)}</strong></td><td>${esc(r.email) || "&mdash;"}</td>
        <td><span class="role ${r.role}">${r.role}</span></td><td>${chips}</td><td>${lessonsOf(r)}</td><td>${r.quizzes}</td>
        <td>${r.created ? new Date(r.created).toLocaleDateString() : "&mdash;"}</td><td><div class="actions-cell">${actions}</div></td></tr>`;
    }).join("") || '<tr><td colspan="8" class="muted">No users match.</td></tr>';
  }

  function usersView() {
    return `<h2>Users</h2><p class="sub">Manage accounts, roles and progress.</p>
      <div class="toolbar"><input id="q" type="search" placeholder="Search by username or email" aria-label="Search users" value="${esc(query)}"></div>
      <div class="tablewrap"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Specializations</th><th>Lessons</th><th>Quizzes</th><th>Joined</th><th></th></tr></thead>
      <tbody id="utb">${usersRows()}</tbody></table></div>`;
  }

  function contentView() {
    const rows = rowsData();
    const body = SPECS.map((s) => `<tr data-spec="${s.id}"><td><span class="chip2" style="--acc:${s.acc}"><i></i><strong>${esc(s.name)}</strong></span></td>
      <td>${s.lessons.length}</td><td>${QUIZZES[s.id].length}</td>
      <td>${rows.filter((r) => r.specs.includes(s.id)).length}</td>
      <td>${rows.reduce((t, r) => t + (r.done[s.id] || []).length, 0)}</td></tr>`).join("");
    return `<h2>Content</h2><p class="sub">The specializations, lessons and quizzes people see.</p>
      <div class="tablewrap"><table><thead><tr><th>Specialization</th><th>Lessons</th><th>Quiz questions</th><th>Learners</th><th>Lessons completed</th></tr></thead><tbody>${body}</tbody></table></div>
      <p class="note">Lessons, links and quiz questions are edited in js/data.js for now. Editing them from this panel needs a backend to store the changes.</p>`;
  }

  function messagesView() {
    const msgs = allMessages().slice(0, 60);
    const body = msgs.map((m) => `<tr><td>${esc(threadName(m.key))}</td><td>${esc(m.u)}</td><td class="msg-text">${esc(m.t)}</td>
      <td>${new Date(m.ts).toLocaleString()}</td>
      <td><button type="button" class="mini danger" data-act="msgdel" data-key="${esc(m.key)}" data-ts="${m.ts}" data-u="${esc(m.u)}">Delete</button></td></tr>`).join("");
    return `<h2>Messages</h2><p class="sub">The latest messages across all chats. Remove anything that should not be there.</p>
      ${msgs.length ? `<div class="tablewrap"><table><thead><tr><th>Chat</th><th>From</th><th>Message</th><th>Sent</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`
        : '<p class="muted">No messages yet.</p>'}`;
  }

  function render() {
    document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    root.innerHTML = ({ overview: overviewView, users: usersView, content: contentView, messages: messagesView }[view])();
  }

  // ---------- actions ----------
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { view = b.dataset.view; render(); }));
  $("#logout").addEventListener("click", () => { localStorage.removeItem(VAL.SESSION); location.href = "../login.html"; });

  root.addEventListener("input", (e) => {
    if (e.target.id === "q") { query = e.target.value; $("#utb").innerHTML = usersRows(); }
  });

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const tr = b.closest("tr"), name = tr && tr.dataset.user, act = b.dataset.act;

    if (act === "role") {
      const all = readJSON(VAL.USERS, {});
      all[name].role = all[name].role === "admin" ? "member" : "admin";
      writeJSON(VAL.USERS, all);
    } else if (act === "reset") {
      localStorage.removeItem("cybearea_arena_" + name);
      localStorage.removeItem("cybearea_quiz_" + name);
    } else if (act === "delete") {
      if (!confirm("Delete " + name + "? This removes their account, progress and direct messages.")) return;
      const all = readJSON(VAL.USERS, {});
      delete all[name];
      writeJSON(VAL.USERS, all);
      ["cybearea_profile_", "cybearea_arena_", "cybearea_quiz_"].forEach((p) => localStorage.removeItem(p + name));
      chatKeys().forEach((k) => {
        if (k.indexOf("cybearea_chat_d:") === 0 && k.replace("cybearea_chat_d:", "").split("|").indexOf(name) !== -1) localStorage.removeItem(k);
      });
    } else if (act === "msgdel") {
      const left = readJSON(b.dataset.key, []).filter((m) => !(String(m.ts) === b.dataset.ts && m.u === b.dataset.u));
      writeJSON(b.dataset.key, left);
    }
    render();
  });

  render();
})();
