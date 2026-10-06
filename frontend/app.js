(function () {
  const SESSION = "valhalla_session", USERS = "valhalla_users";
  const user = localStorage.getItem(SESSION);
  let users = {};
  try { users = JSON.parse(localStorage.getItem(USERS) || "{}"); } catch (e) {}
  if (!user || !users[user]) { location.replace("login.html"); return; }

  const $ = (s, r = document) => r.querySelector(s);
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const spec = (id) => SPECS.find((s) => s.id === id);

  const profKey = "valhalla_profile_" + user, arenaKey = "valhalla_arena_" + user;
  let arena = load(arenaKey, { specs: [], active: null, done: {} });
  let view = "arena", picking = false, draft = [], sel = -1;
  const root = $("#view");
  const doneSet = (id) => new Set(arena.done[id] || []);

  // ---------- sidebar chip ----------
  function paintMe() {
    const p = load(profKey, {});
    const name = p.name || user;
    $("#me-name").textContent = name;
    $("#me-user").textContent = "@" + user;
    $("#avatar").textContent = name.trim().charAt(0).toUpperCase() || "?";
  }

  // ---------- views ----------
  function profileView() {
    const p = load(profKey, {});
    return `<h2>Profile</h2><p class="sub">This is what your AI knows about you.</p>
      <form id="pf" class="panel narrow">
        <label for="f-name">Name</label><input id="f-name" value="${esc(p.name || "")}">
        <label for="f-email">Email</label><input id="f-email" type="email" value="${esc(p.email || users[user].email || "")}">
        <label for="f-notes">About me (for my AI)</label><textarea id="f-notes" rows="6">${esc(p.notes || "")}</textarea>
        <p id="pf-msg" class="msg" role="status"></p>
        <button class="btn" type="submit">Save details</button>
      </form>`;
  }

  function assessView() {
    if (!arena.specs.length) {
      return `<h2>Assessments</h2><p class="sub">Every specialization has its own assessment. Choose one in the Arena first.</p>
        <button class="btn" data-go="arena" type="button">Go to the Arena</button>`;
    }
    const cards = arena.specs.map((id) => {
      const s = spec(id), n = s.lessons.length, d = doneSet(id).size, ready = d === n;
      return `<article class="acard" style="--acc:${s.acc}">
        <div><h3>${esc(s.name)}</h3><p>${d} of ${n} lessons done</p>
        <div class="bar"><i style="width:${Math.round((d / n) * 100)}%"></i></div></div>
        <button class="btn" type="button" disabled>${ready ? "Ready. Questions coming soon" : "Finish all lessons to unlock"}</button>
      </article>`;
    }).join("");
    return `<h2>Assessments</h2><p class="sub">Finish every lesson in a specialization to unlock its assessment.</p><div class="acards">${cards}</div>`;
  }

  function pickerView() {
    const cards = SPECS.map((s) => `
      <button type="button" class="spec ${draft.includes(s.id) ? "on" : ""}" data-spec="${s.id}" style="--acc:${s.acc}" aria-pressed="${draft.includes(s.id)}">
        <strong>${esc(s.name)}</strong><span>${esc(s.blurb)}</span><em>${s.lessons.length} lessons</em>
      </button>`).join("");
    return `<h2>Choose your specializations</h2>
      <p class="sub">Pick one or more. You can change this any time and your progress is kept.</p>
      <div class="specs">${cards}</div>
      <button class="btn" id="start" type="button" ${draft.length ? "" : "disabled"}>Start learning</button>`;
  }

  function wrap(t, max) {
    const out = []; let line = "";
    t.split(" ").forEach((w) => {
      if ((line + " " + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + " " + w).trim();
    });
    if (line) out.push(line);
    return out;
  }

  function ring(s, done, next) {
    const n = s.lessons.length, cx = 410, cy = 280, R = 175, C = 2 * Math.PI * R, frac = done.size / n;
    let nodes = "";
    s.lessons.forEach((l, i) => {
      const a = ((-90 + (i * 360) / n) * Math.PI) / 180, c = Math.cos(a), si = Math.sin(a);
      const x = cx + R * c, y = cy + R * si;
      const cls = ["node", done.has(i) && "done", i === next && "next", i === sel && "sel"].filter(Boolean).join(" ");
      const lines = wrap(l.t, 16), lx = cx + (R + 44) * c;
      let ly = cy + (R + 44) * si;
      ly = si < -0.5 ? ly - (lines.length - 1) * 17 : si > 0.5 ? ly + 12 : ly - (lines.length - 1) * 8.5 + 5;
      const anchor = c > 0.3 ? "start" : c < -0.3 ? "end" : "middle";
      nodes += `<g class="${cls}" data-i="${i}" tabindex="0" role="button" aria-label="Lesson ${i + 1}: ${esc(l.t)}">
        <circle class="halo" cx="${x}" cy="${y}" r="34"/>
        <circle class="dot" cx="${x}" cy="${y}" r="26"/>
        ${done.has(i) ? `<path class="tick" d="M${x - 9} ${y} l6 6 l12 -13"/>` : `<text class="num" x="${x}" y="${y}" dy="6" text-anchor="middle">${i + 1}</text>`}
        <text class="lbl" x="${lx}" y="${ly}" text-anchor="${anchor}">${lines.map((t, k) => `<tspan x="${lx}" dy="${k ? 17 : 0}">${esc(t)}</tspan>`).join("")}</text>
      </g>`;
    });
    return `<svg viewBox="80 25 660 520" role="group" aria-label="${esc(s.name)} lessons">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--acc)"/><stop offset="1" stop-color="#d4f5ff"/></linearGradient></defs>
      <circle class="inner" cx="${cx}" cy="${cy}" r="${R - 55}"/>
      <circle class="track" cx="${cx}" cy="${cy}" r="${R}"/>
      <circle class="arc" cx="${cx}" cy="${cy}" r="${R}" transform="rotate(-90 ${cx} ${cy})" stroke-dasharray="${C * frac} ${C}" style="--c:${C};opacity:${frac ? 1 : 0}"/>
      ${nodes}
      <text class="pct" x="${cx}" y="${cy - 2}">${Math.round(frac * 100)}%</text>
      <text class="cname" x="${cx}" y="${cy + 32}">${esc(s.name)}</text>
      <text class="csub" x="${cx}" y="${cy + 56}">${done.size} of ${n} lessons</text>
    </svg>`;
  }

  function dashView() {
    if (!spec(arena.active)) arena.active = arena.specs[0];
    const s = spec(arena.active), done = doneSet(s.id), n = s.lessons.length;
    const next = s.lessons.findIndex((_, i) => !done.has(i));
    if (sel < 0 || sel >= n) sel = next < 0 ? 0 : next;
    const l = s.lessons[sel], isDone = done.has(sel);

    const chips = arena.specs.map((id) => `<button type="button" class="chip ${id === s.id ? "on" : ""}" data-chip="${id}" style="--acc:${spec(id).acc}"><i></i>${esc(spec(id).name)}</button>`).join("");
    const links = l.l.map(([label, url, kind]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span class="tag">${kind}</span>${esc(label)}</a></li>`).join("");

    return `<div class="arena" style="--acc:${s.acc}">
      <h2>Arena</h2>
      <div class="chips">${chips}<button type="button" class="ghost" id="edit">Edit specializations</button></div>
      <div class="dash">
        <div class="ringwrap">${ring(s, done, next)}</div>
        <aside class="lesson">
          <p class="kicker">Lesson ${sel + 1} of ${n}${sel === next ? ", up next" : ""}</p>
          <h3>${esc(l.t)}</h3>
          <p>${esc(l.s)}</p>
          <p class="time">About ${l.m} minutes</p>
          <ul class="links">${links}</ul>
          <div class="row">
            <button type="button" class="ghost" id="prev" ${sel === 0 ? "disabled" : ""}>Previous</button>
            <button type="button" class="btn ${isDone ? "undo" : ""}" id="toggle">${isDone ? "Completed. Undo" : "Mark complete"}</button>
            <button type="button" class="ghost" id="nextl" ${sel === n - 1 ? "disabled" : ""}>Next</button>
          </div>
        </aside>
      </div></div>`;
  }

  function arenaView() { return picking || !arena.specs.length ? pickerView() : dashView(); }

  function render() {
    document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    root.innerHTML = ({ profile: profileView, assess: assessView, chats: chatsView, quizzes: quizzesView }[view] || arenaView)();
    if (view === "chats") paintMsgs();
  }

  const persist = () => save(arenaKey, arena);

  // ---------- events ----------
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { view = b.dataset.view; picking = false; render(); }));
  $("#logout").addEventListener("click", () => { localStorage.removeItem(SESSION); location.href = "login.html"; });

  function pickNode(el) { sel = +el.dataset.i; render(); }

  root.addEventListener("click", (e) => {
    const t = e.target;
    let el;
    if ((el = t.closest("[data-go]"))) { view = el.dataset.go; render(); }
    else if ((el = t.closest("[data-spec]"))) {
      const id = el.dataset.spec;
      draft = draft.includes(id) ? draft.filter((x) => x !== id) : [...draft, id];
      render();
    }
    else if (t.closest("#start")) {
      arena.specs = draft.slice();
      if (!arena.specs.includes(arena.active)) arena.active = arena.specs[0];
      picking = false; sel = -1; persist(); render();
    }
    else if (t.closest("#edit")) { draft = arena.specs.slice(); picking = true; render(); }
    else if ((el = t.closest("[data-chip]"))) { arena.active = el.dataset.chip; sel = -1; persist(); render(); }
    else if ((el = t.closest(".node"))) pickNode(el);
    else if (t.closest("#prev")) { sel -= 1; render(); }
    else if (t.closest("#nextl")) { sel += 1; render(); }
    else if (t.closest("#toggle")) {
      const id = arena.active, set = doneSet(id);
      if (set.has(sel)) set.delete(sel);
      else {
        set.add(sel);
        const n = spec(id).lessons.length;
        for (let k = 1; k <= n; k++) { const j = (sel + k) % n; if (!set.has(j)) { sel = j; break; } }
      }
      arena.done[id] = [...set].sort((a, b) => a - b);
      persist(); render();
    }
  });

  root.addEventListener("keydown", (e) => {
    const el = e.target.closest && e.target.closest(".node");
    if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pickNode(el); }
  });

  root.addEventListener("submit", (e) => {
    if (e.target.id !== "pf") return;
    e.preventDefault();
    save(profKey, { name: $("#f-name").value.trim(), email: $("#f-email").value.trim(), notes: $("#f-notes").value.trim() });
    const m = $("#pf-msg"); m.textContent = "Details saved."; m.classList.add("ok");
    paintMe();
  });

  // ---------- chats (stored in this browser for now) ----------
  const chatKey = (id) => "valhalla_chat_" + id;
  let thread = "g:general";

  function threadList() {
    const groups = [{ id: "g:general", name: "General", sub: "Everyone", acc: "#2fc4f0" }]
      .concat(arena.specs.map((id) => ({ id: "g:" + id, name: spec(id).name, sub: "Group", acc: spec(id).acc })));
    const dms = Object.keys(load(USERS, {})).filter((u) => u !== user).sort()
      .map((u) => ({ id: "d:" + [user, u].sort().join("|"), name: u, sub: "Direct message", acc: "#8fb0c0" }));
    return { groups, dms };
  }

  function chatsView() {
    const { groups, dms } = threadList(), all = groups.concat(dms);
    if (!all.find((t) => t.id === thread)) thread = groups[0].id;
    const cur = all.find((t) => t.id === thread);
    const item = (t) => `<button type="button" class="titem ${t.id === thread ? "on" : ""}" data-thread="${esc(t.id)}" style="--acc:${t.acc}"><i></i><span>${esc(t.name)}</span></button>`;
    return `<h2>Chats</h2><p class="sub">Talk with your groups and message people directly.</p>
      <div class="chat">
        <aside class="tlist"><p class="gh">Groups</p>${groups.map(item).join("")}
          <p class="gh">Direct messages</p>${dms.length ? dms.map(item).join("") : '<p class="empty">No one else has joined yet.</p>'}</aside>
        <section class="thread">
          <header><strong>${esc(cur.name)}</strong><small>${cur.sub}</small></header>
          <div class="msgs" id="msgs" aria-live="polite"></div>
          <form id="cf" autocomplete="off"><input id="ci" placeholder="Message ${esc(cur.name)}" aria-label="Message"><button class="btn" type="submit">Send</button></form>
        </section></div>`;
  }

  function paintMsgs() {
    const box = $("#msgs");
    if (!box) return;
    const msgs = load(chatKey(thread), []);
    box.innerHTML = msgs.length
      ? msgs.map((x) => `<div class="msg-row ${x.u === user ? "me" : ""}"><div class="bubble">${x.u === user ? "" : "<b>" + esc(x.u) + "</b>"}<p>${esc(x.t)}</p><time>${new Date(x.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div></div>`).join("")
      : '<p class="empty">No messages yet. Say hello.</p>';
    box.scrollTop = box.scrollHeight;
  }

  root.addEventListener("submit", (e) => {
    if (e.target.id !== "cf") return;
    e.preventDefault();
    const input = $("#ci"), text = input.value.trim();
    if (!text) return;
    const msgs = load(chatKey(thread), []);
    msgs.push({ u: user, t: text, ts: Date.now() });
    save(chatKey(thread), msgs.slice(-200));
    input.value = "";
    paintMsgs();
  });

  window.addEventListener("storage", (e) => {
    if (view === "chats" && e.key && e.key.indexOf("valhalla_chat_") === 0) paintMsgs();
  });

  // ---------- quizzes ----------
  const quizKey = "valhalla_quiz_" + user;
  let best = load(quizKey, {}), quiz = null;
  const newQuiz = (id) => ({ spec: id, i: 0, score: 0, picked: null, done: false });

  function quizzesView() {
    if (!quiz) {
      const cards = SPECS.map((s) => {
        const n = QUIZZES[s.id].length, b = best[s.id];
        return `<article class="acard" style="--acc:${s.acc}">
          <div><h3>${esc(s.name)}</h3><p>${n} questions${b != null ? ". Best score " + b + " of " + n : ""}</p>
          <div class="bar"><i style="width:${b != null ? Math.round((b / n) * 100) : 0}%"></i></div></div>
          <button class="btn" type="button" data-quiz="${s.id}">${b != null ? "Try again" : "Start quiz"}</button></article>`;
      }).join("");
      return `<h2>Quizzes</h2><p class="sub">Short quizzes to check what stuck. Retake them as often as you like.</p><div class="acards">${cards}</div>`;
    }
    const s = spec(quiz.spec), qs = QUIZZES[quiz.spec], n = qs.length;
    if (quiz.done) {
      return `<h2>Quizzes</h2><div class="qcard" style="--acc:${s.acc}">
        <p class="kicker">${esc(s.name)} quiz finished</p><p class="score">${quiz.score} of ${n}</p>
        <p class="why">Best score: ${best[quiz.spec]} of ${n}</p>
        <div class="row2"><button class="btn" type="button" id="qagain">Try again</button><button class="ghost" type="button" id="qback">Back to quizzes</button></div></div>`;
    }
    const q = qs[quiz.i], last = quiz.i === n - 1, answered = quiz.picked !== null;
    const opts = q.o.map((o, k) => {
      const st = answered ? (k === q.a ? "right" : k === quiz.picked ? "wrong" : "") : "";
      return `<button type="button" class="opt ${st}" data-opt="${k}" ${answered ? "disabled" : ""}>${esc(o)}</button>`;
    }).join("");
    return `<h2>Quizzes</h2><div class="qcard" style="--acc:${s.acc}">
      <div class="bar"><i style="width:${(quiz.i / n) * 100}%"></i></div>
      <p class="kicker">${esc(s.name)}, question ${quiz.i + 1} of ${n}</p>
      <h3>${esc(q.q)}</h3><div class="opts">${opts}</div>
      ${answered ? `<p class="why">${esc(q.e)}</p><button class="btn" type="button" id="qnext">${last ? "See results" : "Next question"}</button>` : ""}
      <p><button class="ghost" type="button" id="qback">Leave quiz</button></p></div>`;
  }

  root.addEventListener("click", (e) => {
    const t = e.target;
    let el;
    if ((el = t.closest("[data-thread]"))) { thread = el.dataset.thread; render(); }
    else if ((el = t.closest("[data-quiz]"))) { quiz = newQuiz(el.dataset.quiz); render(); }
    else if ((el = t.closest("[data-opt]")) && quiz && quiz.picked === null) {
      quiz.picked = +el.dataset.opt;
      if (quiz.picked === QUIZZES[quiz.spec][quiz.i].a) quiz.score++;
      render();
    }
    else if (t.closest("#qnext") && quiz) {
      if (quiz.i + 1 >= QUIZZES[quiz.spec].length) {
        quiz.done = true;
        if (best[quiz.spec] == null || quiz.score > best[quiz.spec]) { best[quiz.spec] = quiz.score; save(quizKey, best); }
      } else { quiz.i++; quiz.picked = null; }
      render();
    }
    else if (t.closest("#qagain") && quiz) { quiz = newQuiz(quiz.spec); render(); }
    else if (t.closest("#qback")) { quiz = null; render(); }
  });

  paintMe();
  render();
})();
