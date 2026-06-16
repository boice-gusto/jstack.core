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

export function hydrateJstackGlobalsFromEmbed() {
  const skillsPayload = parseJsonScriptById(ID_SKILLS_PAYLOAD);
  if (
    skillsPayload &&
    typeof skillsPayload === "object" &&
    Array.isArray(skillsPayload.skills) &&
    (!window.__JSTACK_SKILLS__ || !Array.isArray(window.__JSTACK_SKILLS__.skills))
  ) {
    window.__JSTACK_SKILLS__ = skillsPayload;
  }

  const skillHtml = parseJsonScriptById(ID_SKILL_HTML);
  if (
    skillHtml &&
    typeof skillHtml === "object" &&
    !Array.isArray(skillHtml) &&
    window.__JSTACK_SKILL_HTML__ == null
  ) {
    window.__JSTACK_SKILL_HTML__ = skillHtml;
  }

  const mdMap = parseJsonScriptById(ID_MD_BY_RELPATH);
  if (
    mdMap &&
    typeof mdMap === "object" &&
    !Array.isArray(mdMap) &&
    window.__JSTACK_MD_BY_RELPATH__ == null
  ) {
    window.__JSTACK_MD_BY_RELPATH__ = mdMap;
  }
}
