/**
 * Reads embedded docs data from <script type="application/json" id="jstack-*"> and
 * assigns window.__JSTACK_SKILLS__, __JSTACK_SKILL_HTML__, __JSTACK_MD_BY_RELPATH__
 * when globals are missing or incomplete. Used by docs.js and md-preview.js.
 */

const ID_SKILLS_PAYLOAD = "jstack-skills-payload";
const ID_SKILL_HTML = "jstack-skill-html";
const ID_MD_BY_RELPATH = "jstack-md-by-relpath";

/**
 * @param {string} id
 * @returns {unknown}
 */
function parseJsonScriptById(id) {
  const el = document.getElementById(id);
  if (!el) {
    return undefined;
  }
  const text = el.textContent;
  if (text == null || text.trim() === "") {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * @typedef {object} HydrationTarget
 * @property {string} scriptId
 * @property {string} globalName
 * @property {(v: unknown) => boolean} isValid
 */

/** @type {HydrationTarget[]} */
const HYDRATION_TARGETS = [
  {
    scriptId: ID_SKILLS_PAYLOAD,
    globalName: "__JSTACK_SKILLS__",
    // Skills payload is a wrapper object; the meaningful field is the
    // nested `skills` array.
    isValid: (v) =>
      !!v &&
      typeof v === "object" &&
      Array.isArray(/** @type {{ skills?: unknown }} */ (v).skills),
  },
  {
    scriptId: ID_SKILL_HTML,
    globalName: "__JSTACK_SKILL_HTML__",
    // Skill HTML map is itself the payload: any non-array object.
    isValid: (v) => !!v && typeof v === "object" && !Array.isArray(v),
  },
  {
    scriptId: ID_MD_BY_RELPATH,
    globalName: "__JSTACK_MD_BY_RELPATH__",
    // Same shape requirement as skill HTML: a non-array object.
    isValid: (v) => !!v && typeof v === "object" && !Array.isArray(v),
  },
];

export function hydrateJstackGlobalsFromEmbed() {
  for (const { scriptId, globalName, isValid } of HYDRATION_TARGETS) {
    const parsed = parseJsonScriptById(scriptId);
    if (isValid(parsed) && !isValid(window[globalName])) {
      window[globalName] = parsed;
    }
  }
}
