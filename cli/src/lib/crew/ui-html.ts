/**
 * The orchestration page. One self-contained HTML string: no build step, no framework, no
 * CDN, so there is nothing to go stale and no third-party script in a page that holds a
 * control-plane token.
 *
 * A strict CSP is part of the security story rather than decoration. `default-src 'none'`
 * plus `connect-src 'self'` means that even if a rendered value smuggled markup through, it
 * could not load a remote script or beacon the token anywhere.
 */
export function renderUiHtml(token: string, port: number): string {
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "script-src 'unsafe-inline'",
    "connect-src 'self'",
    "img-src data:",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<title>crew · orchestration</title>
<style>
  :root {
    --bg:#0f1115; --panel:#161a21; --line:#242a34; --fg:#e6e9ef; --dim:#8b93a3;
    --ok:#43b581; --warn:#e3b341; --bad:#e35d6a; --acc:#6ea8fe; --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  @media (prefers-color-scheme: light) {
    :root { --bg:#f6f7f9; --panel:#fff; --line:#e3e6ea; --fg:#1b1f27; --dim:#6b7280; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
    font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  header { padding:14px 20px; border-bottom:1px solid var(--line); display:flex;
    align-items:center; gap:14px; flex-wrap:wrap; position:sticky; top:0; background:var(--bg); z-index:5; }
  h1 { font-size:15px; margin:0; font-weight:600; letter-spacing:.02em; }
  .pill { font:11px var(--mono); padding:3px 8px; border-radius:999px; border:1px solid var(--line); color:var(--dim); }
  .pill.live { color:var(--warn); border-color:var(--warn); }
  .pill.dry { color:var(--ok); border-color:var(--ok); }
  .pill.halt { color:var(--bad); border-color:var(--bad); }
  nav { display:flex; gap:2px; padding:0 20px; border-bottom:1px solid var(--line); }
  nav button { background:none; border:0; border-bottom:2px solid transparent; color:var(--dim);
    padding:10px 14px; font-size:13px; cursor:pointer; }
  nav button[aria-selected=true] { color:var(--fg); border-bottom-color:var(--acc); }
  main { padding:20px; max-width:1100px; }
  section[hidden] { display:none; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px;
    padding:14px 16px; margin-bottom:12px; }
  .row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .grow { flex:1; min-width:180px; }
  .dot { width:9px; height:9px; border-radius:50%; display:inline-block; flex:none; }
  .dot.on { background:var(--ok); } .dot.off { background:var(--dim); opacity:.5; }
  code, .mono { font-family:var(--mono); font-size:12px; }
  .dim { color:var(--dim); }
  button.act { background:var(--panel); color:var(--fg); border:1px solid var(--line);
    border-radius:7px; padding:5px 11px; font-size:12px; cursor:pointer; }
  button.act:hover { border-color:var(--acc); color:var(--acc); }
  button.act.danger:hover { border-color:var(--bad); color:var(--bad); }
  button.act:disabled { opacity:.4; cursor:default; }
  table { width:100%; border-collapse:collapse; }
  th,td { text-align:left; padding:7px 8px; border-bottom:1px solid var(--line); font-size:12.5px; vertical-align:top; }
  th { color:var(--dim); font-weight:500; font-size:11px; text-transform:uppercase; letter-spacing:.05em; }
  pre { background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:10px;
    overflow:auto; max-height:420px; font-family:var(--mono); font-size:11.5px; margin:0; }
  input,textarea,select { background:var(--bg); color:var(--fg); border:1px solid var(--line);
    border-radius:7px; padding:6px 9px; font-size:12.5px; font-family:inherit; }
  #toast { position:fixed; right:16px; bottom:16px; background:var(--panel);
    border:1px solid var(--line); border-radius:9px; padding:10px 14px; max-width:460px;
    box-shadow:0 8px 24px rgba(0,0,0,.3); display:none; }
  #toast.bad { border-color:var(--bad); }
  .banner { border-left:3px solid var(--warn); padding-left:12px; }
</style>
</head>
<body>
<header>
  <h1>crew</h1>
  <span id="mode" class="pill">…</span>
  <span id="halt" class="pill" hidden>HALTED</span>
  <span id="spend" class="pill">…</span>
  <span class="grow"></span>
  <button class="act" data-act="tick">Tick now</button>
  <button class="act danger" data-act="panic">Panic</button>
  <button class="act" id="refresh">Refresh</button>
</header>

<nav>
  <button data-tab="agents" aria-selected="true">Agents</button>
  <button data-tab="tasks">Tasks</button>
  <button data-tab="logs">Logs</button>
  <button data-tab="scheduler">Scheduler</button>
  <button data-tab="doctor">Doctor</button>
</nav>

<main>
  <section id="tab-agents">
    <div class="card">
      <div class="row"><strong style="font-size:13px">Agents</strong><span class="grow"></span>
        <button class="act" id="showAdd">New agent</button></div>
      <div id="agents" style="margin-top:10px"></div>
    </div>
    <div class="card" id="addCard" hidden>
      <strong style="font-size:13px">Create an agent</strong>
      <p class="dim" style="margin:6px 0 10px">
        Starts <em>disabled</em>. Sigils default to <code>!id</code> and <code>@agent-id</code>.
      </p>
      <div class="row">
        <input id="nId" placeholder="id (kebab-case)" size="16">
        <input id="nWs" placeholder="/absolute/workspace/path" class="grow">
      </div>
      <div class="row" style="margin-top:8px">
        <input id="nModel" placeholder="model (optional)" size="20">
        <input id="nDesc" placeholder="description (optional)" class="grow">
      </div>
      <div class="row" style="margin-top:10px">
        <button class="act" data-act="agentAdd">Create</button>
        <button class="act" id="cancelAdd">Cancel</button>
      </div>
    </div>
  </section>

  <section id="tab-tasks" hidden>
    <div class="card"><strong style="font-size:13px">Tasks</strong>
      <div id="tasks" style="margin-top:10px"></div></div>
    <div class="card">
      <strong style="font-size:13px">Why did a message get no reply?</strong>
      <div class="row" style="margin-top:8px">
        <input id="exTs" placeholder="1785141296.398489" class="mono grow">
        <button class="act" data-act="explain">Explain</button>
      </div>
      <pre id="explainOut" style="margin-top:10px" hidden></pre>
    </div>
    <div class="card">
      <strong style="font-size:13px">Dry-run a message</strong>
      <p class="dim" style="margin:6px 0 8px">Runs the real pipeline and stops before Slack. Never posts.</p>
      <div class="row"><input id="simText" placeholder="!ralph what changed this week?" class="grow">
        <button class="act" data-act="simulate">Simulate</button></div>
    </div>
  </section>

  <section id="tab-logs" hidden>
    <div class="card"><div class="row"><strong style="font-size:13px">Recent decisions</strong>
      <span class="grow"></span><label class="dim" style="font-size:12px">
      <input type="checkbox" id="auto"> auto-refresh</label></div>
      <div id="events" style="margin-top:10px"></div></div>
  </section>

  <section id="tab-scheduler" hidden>
    <div class="card"><strong style="font-size:13px">Scheduler</strong>
      <div id="sched" style="margin-top:10px"></div>
      <p class="dim" style="margin:12px 0 0">
        Install and uninstall are intentionally not available here: they change what runs at
        login. Use <code>jstackc crew install</code>.
      </p>
    </div>
  </section>

  <section id="tab-doctor" hidden>
    <div class="card"><div class="row"><strong style="font-size:13px">Preflight</strong>
      <span class="grow"></span><button class="act" data-act="doctor">Run</button></div>
      <div id="doctor" style="margin-top:10px" class="dim">Not run yet.</div></div>
  </section>
</main>

<div id="toast"></div>

<script>
const TOKEN = ${JSON.stringify(token)};
const BASE = "http://127.0.0.1:${port}";
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

function toast(msg, bad) {
  const t = $("#toast");
  t.textContent = msg; t.className = bad ? "bad" : "";
  t.style.display = "block";
  clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = "none"), bad ? 9000 : 3500);
}

/** Mutations send the token as a HEADER: a cross-origin form cannot set one. */
async function call(action, params, mutating) {
  const res = await fetch(BASE + "/api/" + encodeURIComponent(action) + (mutating ? "" : "?t=" + encodeURIComponent(TOKEN)), {
    method: mutating ? "POST" : "GET",
    headers: mutating ? { "content-type": "application/json", "x-crew-token": TOKEN } : {},
    body: mutating ? JSON.stringify(params || {}) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 400) || res.status);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function jsonFrom(r) {
  if (r && r.stdout !== undefined) { try { return JSON.parse(r.stdout); } catch { return null; } }
  return r;
}

async function refresh() {
  try {
    const st = jsonFrom(await call("status", null, false)) || {};
    $("#mode").textContent = st.mode || "?";
    $("#mode").className = "pill " + (st.mode === "live" ? "live" : "dry");
    $("#halt").hidden = !st.halted;
    $("#spend").textContent = "$" + Number(st.spentToday || 0).toFixed(3) + " today";

    const agents = jsonFrom(await call("agentsList", null, false)) || [];
    $("#agents").innerHTML = agents.length ? agents.map(agentRow).join("") :
      '<p class="dim">No agents.</p>';

    const ev = jsonFrom(await call("status", null, false)) || {};
    renderTasks(ev);
    renderEvents(st.recent_events || []);
    renderSched(st);
  } catch (e) { toast("refresh failed: " + e.message, true); }
}

function agentRow(a) {
  const on = a.enabled;
  return '<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)">' +
    '<span class="dot ' + (on ? "on" : "off") + '"></span>' +
    '<div class="grow"><div><strong>' + esc(a.id) + '</strong> ' +
      '<span class="mono dim">' + esc((a.sigils || []).join(" ")) + '</span></div>' +
      '<div class="dim mono" style="font-size:11px">' + esc(a.model) + " · " +
      esc((a.tools || []).join(", ")) + " · " + esc(a.workspace) + "</div>" +
      (a.description ? '<div class="dim" style="font-size:11.5px">' + esc(a.description) + "</div>" : "") +
    "</div>" +
    '<button class="act" data-act="' + (on ? "agentDisable" : "agentEnable") + '" data-id="' + esc(a.id) + '">' +
      (on ? "Disable" : "Enable") + "</button>" +
    '<button class="act danger" data-act="agentRemove" data-id="' + esc(a.id) + '">Delete</button>' +
  "</div>";
}

function renderTasks(st) {
  const rows = st.recent_tasks || [];
  $("#tasks").innerHTML = rows.length
    ? "<table><tr><th>id</th><th>agent</th><th>state</th><th>turns</th><th>cost</th><th>source ts</th></tr>" +
      rows.map((t) => "<tr><td class=mono>" + esc(t.id) + "</td><td>" + esc(t.agent_id || "—") +
        "</td><td>" + esc(t.state) + "</td><td>" + esc(t.turns) + "</td><td>$" +
        Number(t.cost_usd || 0).toFixed(3) + "</td><td class=mono>" + esc(t.source_ts) + "</td></tr>").join("") +
      "</table>"
    : '<p class="dim">No tasks yet.</p>';
}

function renderEvents(rows) {
  $("#events").innerHTML = rows.length
    ? "<table><tr><th>when</th><th>kind</th><th>rule</th><th>detail</th></tr>" +
      rows.map((e) => "<tr><td class=mono>" + esc(new Date(e.ts).toLocaleTimeString()) +
        "</td><td>" + esc(e.kind) + "</td><td class=mono>" + esc(e.rule_id || "") +
        "</td><td class=dim>" + esc(e.detail || "") + "</td></tr>").join("") + "</table>"
    : '<p class="dim">No events recorded.</p>';
}

function renderSched(st) {
  const s = st.scheduler || {};
  $("#sched").innerHTML =
    '<div class="row"><span class="dot ' + (s.loaded ? "on" : "off") + '"></span>' +
    "<div class=grow><div><strong>" + esc(s.label || "com.jstack.crew") + "</strong></div>" +
    '<div class="dim mono" style="font-size:11.5px">' +
      (s.loaded ? "loaded · every " + esc(s.interval_s ?? "?") + "s" : "not installed") +
    "</div></div></div>" +
    (st.last_tick_at ? '<p class="dim" style="margin:10px 0 0">Last tick ' +
      esc(new Date(st.last_tick_at).toLocaleString()) + "</p>" : "") +
    (st.watermark ? '<p class="dim mono" style="margin:4px 0 0">watermark ' + esc(st.watermark) + "</p>" : "");
}

async function run(action, params, mutating, label) {
  const btns = document.querySelectorAll("button.act");
  btns.forEach((b) => (b.disabled = true));
  try {
    const r = await call(action, params, mutating);
    const out = (r.stdout || r.raw || "").trim();
    toast((label || action) + ": " + (out.split("\\n").slice(-2).join(" ") || "done"));
    return r;
  } catch (e) {
    toast((label || action) + " failed: " + e.message, true);
    return null;
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

document.addEventListener("click", async (ev) => {
  const el = ev.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;

  if (act === "agentRemove" && !confirm("Delete agent \\"" + id + "\\"? Disabling is reversible; this is not.")) return;
  if (act === "panic" && !confirm("Halt the crew? It will stop posting until you run: jstackc crew resume")) return;

  if (act === "doctor") {
    const r = await run("doctor", null, false, "doctor");
    const d = jsonFrom(r);
    if (d) $("#doctor").innerHTML = (d.checks || []).map((c) =>
      '<div class="row"><span>' + (c.ok ? "✓" : "✗") + "</span><strong>" + esc(c.name) +
      '</strong><span class="dim grow">' + esc(c.detail) + "</span></div>").join("");
    return;
  }
  if (act === "explain") {
    const r = await run("explain", { ts: $("#exTs").value.trim() }, false, "explain");
    if (r) { $("#explainOut").hidden = false; $("#explainOut").textContent = (r.stdout || r.raw || "").trim(); }
    return;
  }
  if (act === "simulate") { await run("simulate", { text: $("#simText").value.trim() }, true, "simulate"); return; }
  if (act === "agentAdd") {
    await run("agentAdd", { id: $("#nId").value.trim(), workspace: $("#nWs").value.trim(),
      model: $("#nModel").value.trim(), description: $("#nDesc").value.trim() }, true, "create");
    $("#addCard").hidden = true; await refresh(); return;
  }

  const mutating = act !== "agentShow";
  await run(act, id ? { id } : {}, mutating, act);
  await refresh();
});

document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("nav button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  for (const s of document.querySelectorAll("main section")) s.hidden = s.id !== "tab-" + b.dataset.tab;
}));
$("#refresh").addEventListener("click", refresh);
$("#showAdd").addEventListener("click", () => ($("#addCard").hidden = false));
$("#cancelAdd").addEventListener("click", () => ($("#addCard").hidden = true));
let timer = null;
$("#auto").addEventListener("change", (e) => {
  clearInterval(timer);
  if (e.target.checked) timer = setInterval(refresh, 10000);
});
refresh();
</script>
</body>
</html>`;
}
