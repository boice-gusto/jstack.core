/**
 * Client-side cron validation + a human-readable preview for the Schedule tab's cron field.
 * Deliberately self-contained (not shared with cli/src/types/config.ts's `cronExpr` Zod
 * validator) -- desktop and cli aren't wired for cross-package imports yet, and this only needs
 * to catch typos before they're submitted; the daemon's own validation is still authoritative.
 */

/** Builds a field pattern accepting a bare star, a stepped star (star-slash-N), a number/name, a
 * range, a step on a range, and comma-separated lists of any of those -- `charClass` widens which
 * single-unit tokens are legal per field (e.g. day-of-month allows L/W, day-of-week allows L/#). */
function fieldPattern(charClass: string): RegExp {
  const unit = `[${charClass}]+`;
  const term = `(?:\\*(?:/[0-9]+)?|${unit}(?:-${unit})?(?:/[0-9]+)?)`;
  return new RegExp(`^${term}(?:,${term})*$`);
}

const FIELD_PATTERNS: RegExp[] = [
  fieldPattern("0-9"), // minute
  fieldPattern("0-9"), // hour
  fieldPattern("0-9?LW"), // day-of-month
  fieldPattern("0-9A-Za-z"), // month
  fieldPattern("0-9A-Za-z?#L"), // day-of-week
];

const FIELD_NAMES = ["minute", "hour", "day-of-month", "month", "day-of-week"];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Empty string is allowed elsewhere as "not scheduled" (see cronExpr's own doc comment), but a
 * schedule the user is actively creating needs a real cron string -- `required` on the input
 * covers empty; this only judges non-empty text. */
export function validateCron(expr: string): string | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    return `Cron needs exactly 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}.`;
  }
  for (let i = 0; i < 5; i++) {
    if (!FIELD_PATTERNS[i]!.test(fields[i]!)) {
      return `"${fields[i]}" isn't a valid ${FIELD_NAMES[i]} field.`;
    }
  }
  return null;
}

function describeTime(minute: string, hour: string): string | null {
  if (!/^[0-9]+$/.test(minute) || !/^[0-9]+$/.test(hour)) return null;
  const m = Number(minute);
  const h = Number(hour);
  if (m > 59 || h > 23) return null;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Best-effort human description of common shapes; returns null for anything more exotic
 * (lists, step values on multiple fields, etc.) rather than guessing wrong. */
export function describeCron(expr: string): string | null {
  if (validateCron(expr)) return null;
  const [minute, hour, dom, month, dow] = expr.trim().split(/\s+/) as [
    string,
    string,
    string,
    string,
    string,
  ];

  if (dom !== "*" || month !== "*") return null;

  const time = describeTime(minute, hour);
  if (!time) {
    if (minute.startsWith("*/") && hour === "*") {
      return `Every ${minute.slice(2)} minutes`;
    }
    return null;
  }

  if (dow === "*") return `Every day at ${time}`;
  if (dow === "1-5") return `Every weekday at ${time}`;
  if (dow === "0,6" || dow === "6,0") return `Every weekend day at ${time}`;
  if (/^[0-6]$/.test(dow)) return `Every ${DAY_NAMES[Number(dow)]} at ${time}`;

  return null;
}
