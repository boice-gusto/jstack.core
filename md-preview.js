/**
 * In-page Markdown preview: fetch same-origin .md, render with marked (CDN), sanitize with DOMPurify (CDN).
 * Intercepts primary clicks on markdown links inside <main>. Sheet UI is plain CSS (no React; shadcn is React-only).
 */

import { ensureMarkdownLibs, markdownToSafeFragment } from "./markdown-render.js";
import { hydrateJstackGlobalsFromEmbed } from "./docs-embed-hydrate.js";

const SHEET_SEL = "#md-sheet";
const TITLE_SEL = "#md-sheet-title";
const CONTENT_SEL = "#md-sheet-content";
const ERROR_SEL = "#md-sheet-error";
const ERROR_MSG_SEL = "#md-sheet-error-msg";
const ERROR_LINK_SEL = "#md-sheet-error-open";
const LOADING_SEL = "#md-sheet-loading";
const RAW_SEL = "#md-sheet-open-raw";
const CLOSE_BTN_SEL = "#md-sheet-close-btn";

/**
 * GitHub Pages single-file build sets window.__JSTACK_MD_BY_RELPATH__ (all skills .md files).
 * @param {string} absoluteUrl
 * @returns {string | null}
 */
function resolveEmbeddedMarkdown(absoluteUrl) {
  hydrateJstackGlobalsFromEmbed();
  const map = window.__JSTACK_MD_BY_RELPATH__;
  if (!map || typeof map !== "object") {
    return null;
  }
  try {
    const u = new URL(absoluteUrl);
    let path = decodeURIComponent(u.pathname);
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    const skillsIdx = path.indexOf("/skills/");
    if (skillsIdx !== -1) {
      const key = path.slice(skillsIdx + 1);
      const hit = map[key];
      if (typeof hit === "string") {
        return hit;
      }
    }
    /** @type {string[]} */
    const candidates = [];
    for (const k of Object.keys(map)) {
      if (path === "/" + k || path.endsWith("/" + k)) {
        candidates.push(k);
      }
    }
    if (candidates.length === 1) {
      const only = map[candidates[0]];
      return typeof only === "string" ? only : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * @param {string} href
 * @returns {boolean}
 */
function isSameOriginMarkdownHref(href) {
  if (!href || href.startsWith("#")) {
    return false;
  }
  if (!href.endsWith(".md")) {
    return false;
  }
  try {
    const resolved = new URL(href, window.location.href);
    return resolved.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * @param {HTMLElement} root
 * @param {boolean} open
 */
function setSheetOpen(root, open) {
  const panel = root.querySelector(".md-sheet-panel");
  if (!panel) {
    return;
  }
  root.classList.toggle("md-sheet--open", open);
  root.hidden = !open;
  root.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) {
    document.body.classList.add("md-sheet-lock");
    panel.removeAttribute("inert");
  } else {
    document.body.classList.remove("md-sheet-lock");
    panel.setAttribute("inert", "");
  }
}

/**
 * @param {HTMLElement} el
 */
function clearContent(el) {
  el.replaceChildren();
}

/**
 * @param {MouseEvent} ev
 * @returns {void}
 */
function onDocClick(ev) {
  if (!(ev.target instanceof Element)) {
    return;
  }
  const a = ev.target.closest("a");
  if (!(a instanceof HTMLAnchorElement)) {
    return;
  }
  if (!a.closest("main")) {
    return;
  }
  const hrefAttr = a.getAttribute("href");
  if (!hrefAttr || !isSameOriginMarkdownHref(hrefAttr)) {
    return;
  }
  if (ev.defaultPrevented) {
    return;
  }
  if (ev.button !== 0) {
    return;
  }
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) {
    return;
  }
  ev.preventDefault();
  void openPreview(a.href, a.textContent?.trim() || "");
}

/**
 * @param {string} absoluteUrl
 * @param {string} linkLabel
 * @returns {Promise<void>}
 */
async function openPreview(absoluteUrl, linkLabel) {
  const root = document.querySelector(SHEET_SEL);
  const titleEl = document.querySelector(TITLE_SEL);
  const contentEl = document.querySelector(CONTENT_SEL);
  const errorEl = document.querySelector(ERROR_SEL);
  const errorMsgEl = document.querySelector(ERROR_MSG_SEL);
  const errorLinkEl = document.querySelector(ERROR_LINK_SEL);
  const loadingEl = document.querySelector(LOADING_SEL);
  const rawEl = document.querySelector(RAW_SEL);
  const closeBtn = document.querySelector(CLOSE_BTN_SEL);

  if (
    !(root instanceof HTMLElement) ||
    !(titleEl instanceof HTMLElement) ||
    !(contentEl instanceof HTMLElement) ||
    !(errorEl instanceof HTMLElement) ||
    !(errorMsgEl instanceof HTMLElement) ||
    !(errorLinkEl instanceof HTMLAnchorElement) ||
    !(loadingEl instanceof HTMLElement) ||
    !(rawEl instanceof HTMLAnchorElement) ||
    !(closeBtn instanceof HTMLButtonElement)
  ) {
    window.location.href = absoluteUrl;
    return;
  }

  let pathLabel = linkLabel;
  try {
    const u = new URL(absoluteUrl);
    const seg = u.pathname.split("/").filter(Boolean);
    const last = seg[seg.length - 1];
    if (last !== undefined) {
      pathLabel = decodeURIComponent(last);
    }
  } catch {
    // keep linkLabel
  }

  titleEl.textContent = pathLabel;
  rawEl.setAttribute("href", absoluteUrl);
  errorLinkEl.setAttribute("href", absoluteUrl);
  clearContent(contentEl);
  errorEl.hidden = true;
  errorMsgEl.textContent = "";
  loadingEl.hidden = false;
  setSheetOpen(root, true);
  closeBtn.focus();

  try {
    const embedded = resolveEmbeddedMarkdown(absoluteUrl);
    if (embedded !== null) {
      const frag = await markdownToSafeFragment(embedded);
      contentEl.replaceChildren(frag);
      return;
    }

    const res = await fetch(absoluteUrl, { credentials: "same-origin" });
    if (!res.ok) {
      throw new Error("Could not load file (" + String(res.status) + ").");
    }
    const text = await res.text();
    const frag = await markdownToSafeFragment(text);
    contentEl.replaceChildren(frag);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    errorMsgEl.textContent = msg;
    errorLinkEl.setAttribute("href", absoluteUrl);
    errorEl.hidden = false;
    clearContent(contentEl);
  } finally {
    loadingEl.hidden = true;
  }
}

/**
 * @returns {void}
 */
function closeSheet() {
  const root = document.querySelector(SHEET_SEL);
  if (!(root instanceof HTMLElement)) {
    return;
  }
  setSheetOpen(root, false);
}

function init() {
  document.addEventListener("click", onDocClick);

  const root = document.querySelector(SHEET_SEL);
  const closeBtn = document.querySelector(CLOSE_BTN_SEL);
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      closeSheet();
    });
  }
  if (root) {
    root.querySelectorAll("[data-md-sheet-close]").forEach((el) => {
      el.addEventListener("click", () => {
        closeSheet();
      });
    });
    const panel = root.querySelector(".md-sheet-panel");
    if (panel instanceof HTMLElement) {
      panel.setAttribute("inert", "");
    }
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") {
      return;
    }
    const sheet = document.querySelector(SHEET_SEL);
    if (sheet instanceof HTMLElement && sheet.classList.contains("md-sheet--open")) {
      ev.preventDefault();
      closeSheet();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
