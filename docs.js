/**
 * Static docs: search, category filter, safe highlight (DOM APIs only).
 * Catalog data: <script type="application/json" id="jstack-skills-payload"> plus bootstrap,
 * or window.__JSTACK_SKILLS__ (see docs:generate / docs:build).
 * Markdown rendering is loaded on demand via dynamic import so a failure there
 * does not block the catalog sidebar and grid.
 */

import { hydrateJstackGlobalsFromEmbed } from "./docs-embed-hydrate.js";

/** @type {Promise<typeof import("./markdown-render.js")> | null} */
let markdownRenderModulePromise = null;

/**
 * @returns {Promise<typeof import("./markdown-render.js")>}
 */
function loadMarkdownRender() {
  if (!markdownRenderModulePromise) {
    markdownRenderModulePromise = import("./markdown-render.js");
  }
  return markdownRenderModulePromise;
}

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   path: string;
 *   relPath: string;
 *   description: string;
 *   whenToUse: string;
 *   category: string;
 *   categoryKey: string;
 * }} Skill
 */

/**
 * @param {string} s
 * @returns {string}
 */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} id
 * @returns {string}
 */
function skillDetailDomId(id) {
  return "skill-detail-" + id.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * @param {string} id
 * @returns {string}
 */
function skillCardAnchorId(id) {
  return "skill-card-" + id.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * @param {string} text
 * @param {string} query
 * @returns {DocumentFragment}
 */
function fragmentWithHighlights(text, query) {
  const frag = document.createDocumentFragment();
  const t = text ?? "";
  const q = query.trim();
  if (q.length === 0) {
    frag.appendChild(document.createTextNode(t));
    return frag;
  }
  /** @type {RegExp} */
  let re;
  try {
    re = new RegExp(escapeRe(q), "gi");
  } catch {
    frag.appendChild(document.createTextNode(t));
    return frag;
  }
  let lastIndex = 0;
  let m;
  while ((m = re.exec(t)) !== null) {
    if (m.index > lastIndex) {
      frag.appendChild(document.createTextNode(t.slice(lastIndex, m.index)));
    }
    const mark = document.createElement("mark");
    mark.className = "hl";
    const matched = m[0];
    mark.appendChild(document.createTextNode(matched));
    frag.appendChild(mark);
    lastIndex = m.index + matched.length;
    if (matched.length === 0) {
      re.lastIndex += 1;
    }
  }
  if (lastIndex < t.length) {
    frag.appendChild(document.createTextNode(t.slice(lastIndex)));
  }
  return frag;
}

/**
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
function teaserText(text, max) {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= max) {
    return t.length > 0 ? t : "Click to expand for summary, examples, and references.";
  }
  return t.slice(0, max - 1).trimEnd() + "…";
}

/**
 * @param {HTMLElement} panel
 * @param {string} heading
 * @param {string} text
 * @param {string} q
 */
function appendDetailSection(panel, heading, text, q) {
  const raw = (text ?? "").trim();
  if (raw.length === 0) {
    return;
  }
  const sec = document.createElement("section");
  sec.className = "skill-detail-section";
  const h = document.createElement("h4");
  h.className = "skill-detail-section-title";
  h.textContent = heading;
  const body = document.createElement("div");
  body.className = "skill-detail-section-body";
  const p = document.createElement("p");
  p.className = "skill-detail-section-p";
  p.appendChild(fragmentWithHighlights(raw, q));
  body.appendChild(p);
  sec.appendChild(h);
  sec.appendChild(body);
  panel.appendChild(sec);
}

/**
 * @param {HTMLElement} panel
 * @param {Skill} s
 */
function appendQuickMeta(panel, s) {
  const sec = document.createElement("section");
  sec.className = "skill-detail-section skill-detail-quick";
  const h = document.createElement("h4");
  h.className = "skill-detail-section-title";
  h.textContent = "Catalog metadata";
  const dl = document.createElement("dl");
  dl.className = "skill-detail-meta";

  const row = (dt, ddContent) => {
    const dtt = document.createElement("dt");
    dtt.textContent = dt;
    const ddt = document.createElement("dd");
    ddt.appendChild(ddContent);
    dl.appendChild(dtt);
    dl.appendChild(ddt);
  };

  row("Category", document.createTextNode(s.category));
  row("Skill id", document.createTextNode(s.id));

  const links = document.createElement("div");
  links.className = "skill-detail-quick-links";
  const aMd = document.createElement("a");
  aMd.href = skillHref(s.relPath);
  aMd.textContent = "Open SKILL.md";
  links.appendChild(aMd);

  sec.appendChild(h);
  sec.appendChild(dl);
  sec.appendChild(links);
  panel.appendChild(sec);
}

/**
 * @param {Skill} s
 * @param {string} q
 * @returns {boolean}
 */
function skillMatches(s, q) {
  const needle = q.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  const blob = [s.name, s.description, s.whenToUse, s.category, s.relPath, s.path].join("\n").toLowerCase();
  return blob.includes(needle);
}

/**
 * @param {Skill[]} raw
 * @returns {Skill[]}
 */
function dedupeByPath(raw) {
  const m = new Map();
  for (const s of raw) {
    if (!m.has(s.relPath)) {
      m.set(s.relPath, s);
    }
  }
  return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {Skill[]} skills
 * @returns {Map<string, string>}
 */
function buildCategoryLabels(skills) {
  const map = new Map();
  for (const s of skills) {
    if (!map.has(s.categoryKey)) {
      map.set(s.categoryKey, s.category);
    }
  }
  return new Map([...map.entries()].sort((a, b) => a[1].localeCompare(b[1])));
}

/**
 * @param {string} relPath
 * @returns {string}
 */
function skillHref(relPath) {
  return "./" + relPath;
}

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "setup-guide", label: "Setup guide" },
  { id: "guides", label: "Guides" },
  { id: "repository-docs", label: "Repository docs" },
  { id: "setup-reference", label: "Setup reference" },
  { id: "all-skills", label: "All skills" },
];

/** @type {Map<string, string>} */
const skillBodyMarkdownCache = new Map();

function init() {
  hydrateJstackGlobalsFromEmbed();
  const raw = window.__JSTACK_SKILLS__;
  const grid = document.getElementById("skills-grid");
  const empty = document.getElementById("skills-empty");
  const countEl = document.getElementById("skills-count");
  const searchInput = document.getElementById("skill-search");
  const navToc = document.getElementById("nav-toc");
  const navCats = document.getElementById("nav-categories");
  const navSkills = document.getElementById("nav-skills");
  const activeFilters = document.getElementById("active-filters");
  const sidebar = document.getElementById("sidebar");
  const navToggle = document.getElementById("nav-toggle");

  // Sidebar "On this page" is static; keep it even when skills-data.js fails (file://, 404, race).
  if (navToc) {
    navToc.replaceChildren();
    for (const item of TOC) {
      const a = document.createElement("a");
      a.href = "#" + item.id;
      a.textContent = item.label;
      navToc.appendChild(a);
    }
  }

  if (navToggle && sidebar) {
    navToggle.addEventListener("click", () => {
      const open = !sidebar.classList.contains("is-open");
      sidebar.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  const skillsOk = Boolean(raw && Array.isArray(raw.skills));
  if (!skillsOk || !grid || !countEl || !(searchInput instanceof HTMLInputElement)) {
    if (navCats) {
      navCats.replaceChildren();
      const note = document.createElement("p");
      note.className = "nav-cats-fallback";
      note.textContent =
        skillsOk
          ? "Catalog UI is missing required elements."
          : "Categories need window.__JSTACK_SKILLS__.skills and this script to run (serve over http(s), not file://).";
      navCats.appendChild(note);
    }
    if (navSkills) {
      navSkills.replaceChildren();
      const note = document.createElement("p");
      note.className = "nav-skills-fallback";
      note.textContent =
        skillsOk
          ? "Skill list needs a working catalog."
          : "Skill index needs catalog data and docs.js (serve over http(s), not file://).";
      navSkills.appendChild(note);
    }
    if (grid) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent =
        "Could not load skills catalog. Serve jstack.core over http(s) (e.g. bunx serve .) so ES modules run.";
      grid.appendChild(p);
    }
    return;
  }

  const allSkills = dedupeByPath(raw.skills);
  const total = allSkills.length;
  const cats = buildCategoryLabels(allSkills);
  const catList = [{ key: "all", label: "All skills" }, ...Array.from(cats.entries()).map(([key, label]) => ({ key, label }))];

  const state = { category: /** @type {string | null} */ (null), query: "" };

  /**
   * @param {string} skillId
   */
  function jumpToSkillCard(skillId) {
    state.category = null;
    state.query = "";
    searchInput.value = "";
    setCategoryAria("all");
    render();
    const el = document.getElementById(skillCardAnchorId(skillId));
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        requestAnimationFrame(() => {
          const tgl = el.querySelector(".skill-card-toggle");
          if (tgl instanceof HTMLButtonElement && tgl.getAttribute("aria-expanded") !== "true") {
            tgl.click();
          }
        });
      });
    }
    sidebar?.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  }

  /**
   * @param {string} activeKey
   */
  function setCategoryAria(activeKey) {
    if (!navCats) {
      return;
    }
    const links = navCats.querySelectorAll("a[data-cat-id]");
    links.forEach((el) => {
      if (el instanceof HTMLAnchorElement) {
        if (el.dataset.catId === activeKey) {
          el.setAttribute("aria-current", "true");
        } else {
          el.removeAttribute("aria-current");
        }
      }
    });
  }

  if (navCats) {
    navCats.replaceChildren();
    for (const c of catList) {
      const a = document.createElement("a");
      a.href = "#all-skills";
      a.textContent = c.label;
      a.dataset.catId = c.key;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        state.category = c.key === "all" ? null : c.key;
        setCategoryAria(c.key);
        render();
        sidebar?.classList.remove("is-open");
        navToggle?.setAttribute("aria-expanded", "false");
        document.getElementById("all-skills")?.scrollIntoView({ behavior: "smooth" });
      });
      if (c.key === "all") {
        a.setAttribute("aria-current", "true");
      }
      navCats.appendChild(a);
    }
  }

  if (navSkills) {
    navSkills.replaceChildren();
    const catEntries = Array.from(cats.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    for (const [catKey, catLabel] of catEntries) {
      const inCat = allSkills.filter((s) => s.categoryKey === catKey).sort((a, b) => a.name.localeCompare(b.name));
      if (inCat.length === 0) {
        continue;
      }
      const wrap = document.createElement("div");
      wrap.className = "nav-skills-group";
      const title = document.createElement("div");
      title.className = "nav-skills-group-title";
      title.textContent = catLabel;
      wrap.appendChild(title);
      for (const s of inCat) {
        const a = document.createElement("a");
        a.href = "#" + skillCardAnchorId(s.id);
        a.textContent = s.name;
        a.addEventListener("click", (e) => {
          e.preventDefault();
          jumpToSkillCard(s.id);
        });
        wrap.appendChild(a);
      }
      navSkills.appendChild(wrap);
    }
  }

  function filtered() {
    return allSkills.filter((s) => {
      if (state.category && s.categoryKey !== state.category) {
        return false;
      }
      return skillMatches(s, state.query);
    });
  }

  function renderPills() {
    if (!activeFilters) {
      return;
    }
    activeFilters.textContent = "";
    if (state.category) {
      const label = cats.get(state.category) ?? state.category;
      const span = document.createElement("span");
      span.className = "pill";
      span.appendChild(document.createTextNode("Category: " + label));
      activeFilters.appendChild(span);
    }
    if (state.query.trim().length > 0) {
      const span = document.createElement("span");
      span.className = "pill";
      span.appendChild(document.createTextNode('Search: "' + state.query.trim() + '"'));
      activeFilters.appendChild(span);
    }
  }

  /**
   * @param {Skill} s
   * @param {HTMLElement} statusEl
   * @param {HTMLElement} bodyEl
   * @param {HTMLAnchorElement} errLink
   */
  async function loadSkillBody(s, statusEl, bodyEl, errLink) {
    const url = new URL(skillHref(s.relPath), window.location.href).href;
    errLink.href = url;
    errLink.hidden = true;
    statusEl.hidden = false;
    statusEl.textContent = "Loading documentation…";
    statusEl.className = "skill-card-panel-status skill-card-panel-status--loading";
    bodyEl.replaceChildren();

    try {
      const embeddedHtml =
        window.__JSTACK_SKILL_HTML__ && typeof window.__JSTACK_SKILL_HTML__ === "object"
          ? window.__JSTACK_SKILL_HTML__[s.relPath]
          : undefined;
      if (typeof embeddedHtml === "string" && embeddedHtml.length > 0) {
        const tpl = document.createElement("template");
        tpl.innerHTML = embeddedHtml;
        bodyEl.replaceChildren(tpl.content);
        statusEl.hidden = true;
        statusEl.textContent = "";
        return;
      }

      const { stripYamlFrontmatter, markdownToSafeFragment } =
        await loadMarkdownRender();
      let md = skillBodyMarkdownCache.get(s.relPath);
      if (md === undefined) {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) {
          throw new Error("Could not load file (" + String(res.status) + ").");
        }
        const text = await res.text();
        md = stripYamlFrontmatter(text);
        skillBodyMarkdownCache.set(s.relPath, md);
      }
      const frag = await markdownToSafeFragment(md);
      bodyEl.replaceChildren(frag);
      statusEl.hidden = true;
      statusEl.textContent = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      statusEl.hidden = false;
      errLink.hidden = false;
      statusEl.className = "skill-card-panel-status skill-card-panel-status--error";
      statusEl.textContent = msg;
    }
  }

  function render() {
    const list = filtered();
    const q = state.query;
    if (empty) {
      empty.hidden = list.length > 0;
    }
    countEl.textContent = "Showing " + list.length + " of " + total + " skills";
    renderPills();

    grid.textContent = "";
    for (const s of list) {
      const detailId = skillDetailDomId(s.id);
      const card = document.createElement("article");
      card.className = "skill-card";
      card.id = skillCardAnchorId(s.id);
      card.setAttribute("role", "listitem");

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "skill-card-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", detailId);
      toggle.setAttribute(
        "aria-label",
        "Expand " + s.name + ": summary, when to use, examples, and references from SKILL.md",
      );

      const headerInner = document.createElement("div");
      headerInner.className = "skill-card-header";

      const h3 = document.createElement("h3");
      h3.appendChild(fragmentWithHighlights(s.name, q));
      headerInner.appendChild(h3);

      const idPill = document.createElement("span");
      idPill.className = "pill skill-id-pill";
      idPill.setAttribute("title", s.id);
      idPill.appendChild(document.createTextNode(s.id));
      headerInner.appendChild(idPill);

      const chevron = document.createElement("span");
      chevron.className = "skill-card-chevron";
      chevron.setAttribute("aria-hidden", "true");

      toggle.appendChild(headerInner);
      toggle.appendChild(chevron);
      card.appendChild(toggle);

      const pTeaser = document.createElement("p");
      pTeaser.className = "skill-card-teaser";
      pTeaser.appendChild(
        fragmentWithHighlights(teaserText(s.description, 200), q),
      );
      card.appendChild(pTeaser);

      const meta = document.createElement("div");
      meta.className = "skill-meta";

      const spCat = document.createElement("span");
      spCat.appendChild(document.createTextNode("Category: " + s.category));
      meta.appendChild(spCat);

      const a = document.createElement("a");
      a.href = skillHref(s.relPath);
      a.appendChild(document.createTextNode("View " + s.relPath));
      meta.appendChild(a);

      card.appendChild(meta);

      const panel = document.createElement("div");
      panel.id = detailId;
      panel.className = "skill-card-panel";
      panel.hidden = true;

      const overview = document.createElement("div");
      overview.className = "skill-card-panel-overview";
      const summaryText = (s.description ?? "").trim();
      appendDetailSection(
        overview,
        "Summary",
        summaryText.length > 0 ? summaryText : "No description in YAML frontmatter for this skill.",
        q,
      );
      if ((s.whenToUse ?? "").trim().length > 0) {
        appendDetailSection(overview, "When to use", s.whenToUse, q);
      }
      appendQuickMeta(overview, s);

      const docHeading = document.createElement("h3");
      docHeading.className = "skill-card-doc-heading";
      docHeading.textContent = "Skill body: examples, workflows, references";

      const bar = document.createElement("div");
      bar.className = "skill-card-panel-bar";
      const prompt = document.createElement("span");
      prompt.className = "skill-card-panel-prompt";
      prompt.textContent = "$";
      const pathLine = document.createElement("span");
      pathLine.className = "skill-card-panel-path";
      pathLine.textContent = " cat ./" + s.relPath;
      bar.appendChild(prompt);
      bar.appendChild(pathLine);

      const hint = document.createElement("p");
      hint.className = "skill-card-panel-hint";
      hint.textContent =
        "Rendered from SKILL.md (frontmatter hidden). Code blocks, lists, and links match the repo file.";

      const statusEl = document.createElement("p");
      statusEl.className = "skill-card-panel-status";
      statusEl.hidden = true;

      const errLink = document.createElement("a");
      errLink.className = "skill-card-panel-fallback";
      errLink.href = skillHref(s.relPath);
      errLink.target = "_blank";
      errLink.rel = "noopener noreferrer";
      errLink.textContent = "Open raw SKILL.md";
      errLink.hidden = true;

      const bodyEl = document.createElement("div");
      bodyEl.className = "prose-md skill-card-prose";

      panel.appendChild(overview);
      panel.appendChild(docHeading);
      panel.appendChild(bar);
      panel.appendChild(hint);
      panel.appendChild(statusEl);
      panel.appendChild(errLink);
      panel.appendChild(bodyEl);
      card.appendChild(panel);

      let loaded = false;

      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        panel.hidden = !open;
        card.classList.toggle("skill-card--expanded", open);
        if (open && !loaded) {
          loaded = true;
          void loadSkillBody(s, statusEl, bodyEl, errLink);
        }
      });

      card.addEventListener("click", (ev) => {
        const t = ev.target;
        if (!(t instanceof Element)) {
          return;
        }
        if (t.closest("a[href]")) {
          return;
        }
        if (t.closest(".skill-card-toggle")) {
          return;
        }
        toggle.click();
      });

      grid.appendChild(card);
    }
  }

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    render();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "/") {
      return;
    }
    const t = ev.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
      return;
    }
    if (t instanceof HTMLElement && t.isContentEditable) {
      return;
    }
    ev.preventDefault();
    searchInput.focus();
  });

  render();
}

/**
 * Wait briefly if window.__JSTACK_SKILLS__ is not yet assigned (ordering edge cases).
 */
function startDocs() {
  const deadlineMs = 5000;
  const t0 = performance.now();

  function tick() {
    hydrateJstackGlobalsFromEmbed();
    const raw = window.__JSTACK_SKILLS__;
    if (raw && Array.isArray(raw.skills)) {
      init();
      return;
    }
    if (performance.now() - t0 >= deadlineMs) {
      init();
      return;
    }
    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      requestAnimationFrame(tick);
    });
  } else {
    requestAnimationFrame(tick);
  }
}

startDocs();
