#!/usr/bin/env bash
# Stop hook: count user corrections in this session's JSONL and surface improver if ≥ threshold.
# Reads `claude_md_improver.high_correction_session_threshold` (default 5) from jstack.config.json.

set -euo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"

# Claude Code delivers the hook payload (including session_id) on STDIN as JSON.
# This script previously read $CLAUDE_SESSION_ID, which Claude Code does not export
# (the env var is CLAUDE_CODE_SESSION_ID), so the -z guard below always fired and this
# hook never once evaluated corrections. Read stdin first, then fall back to the env.
HOOK_STDIN=""
if [ ! -t 0 ]; then
  HOOK_STDIN=$(cat 2>/dev/null || true)
fi

SESSION_ID=""
if [ -n "$HOOK_STDIN" ] && command -v node >/dev/null 2>&1; then
  SESSION_ID=$(printf '%s' "$HOOK_STDIN" | node -e "
    let s='';
    process.stdin.on('data', d => s += d).on('end', () => {
      try { process.stdout.write(String(JSON.parse(s).session_id ?? '')); } catch { process.stdout.write(''); }
    });
  " 2>/dev/null || true)
fi
[ -z "$SESSION_ID" ] && SESSION_ID="${CLAUDE_CODE_SESSION_ID:-${CLAUDE_SESSION_ID:-}}"

[ -z "$SESSION_ID" ] && exit 0
[ ! -f "$PROJECT_ROOT/jstack.config.json" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0

# Single node call for both config values (was two separate subprocess spawns).
CFG=$(node -e "
  try {
    const j = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    const c = j.claude_md_improver ?? {};
    console.log([c.enabled ?? false, c.high_correction_session_threshold ?? 5].join(' '));
  } catch { console.log('false 5'); }
" "$PROJECT_ROOT/jstack.config.json")
ENABLED="${CFG%% *}"
THRESHOLD="${CFG##* }"
[ "$ENABLED" != "true" ] && exit 0

# Claude Code's real project-dir encoding replaces every non-alphanumeric character with `-`,
# not just `/` -- a project path containing a dot (e.g. this very repo, ".../jstack.core", or a
# username like "jonathan.boice") produced the wrong directory name with the old slash-only
# substitution, so TRANSCRIPT below never existed and this hook silently did nothing for any such
# path. Verified against a real project dir: /Users/x/jstack.core -> -Users-x-jstack-core.
ENCODED=$(echo "$PROJECT_ROOT" | sed 's/[^a-zA-Z0-9]/-/g')
TRANSCRIPT="$HOME/.claude/projects/$ENCODED/${SESSION_ID}.jsonl"
[ ! -f "$TRANSCRIPT" ] && exit 0

CORRECTIONS=$(grep -E '"type":"user"' "$TRANSCRIPT" 2>/dev/null \
  | grep -ciE '"(message|content)":"(no|don'\''t|stop|wait|that'\''s wrong)\b' || true)

if [ "$CORRECTIONS" -ge "$THRESHOLD" ]; then
  echo "[jstack] You corrected Claude $CORRECTIONS times this session — run /jstack:skill-creator/improve-claude-md to capture them as rules." >&2
fi

exit 0
