#!/usr/bin/env bash
# Stop hook: count user corrections in this session's JSONL and surface improver if ≥ threshold.
# Reads `claude_md_improver.high_correction_session_threshold` (default 5) from jstack.config.json.

set -euo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
SESSION_ID="${CLAUDE_SESSION_ID:-}"

[ -z "$SESSION_ID" ] && exit 0
[ ! -f "$PROJECT_ROOT/jstack.config.json" ] && exit 0

ENABLED=$(node -e "try { const j=JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/jstack.config.json','utf8')); console.log(j.claude_md_improver?.enabled ?? false); } catch { console.log('false'); }")
[ "$ENABLED" != "true" ] && exit 0

THRESHOLD=$(node -e "try { const j=JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/jstack.config.json','utf8')); console.log(j.claude_md_improver?.high_correction_session_threshold ?? 5); } catch { console.log('5'); }")

ENCODED=$(echo "$PROJECT_ROOT" | sed 's:/:-:g')
TRANSCRIPT="$HOME/.claude/projects/$ENCODED/${SESSION_ID}.jsonl"
[ ! -f "$TRANSCRIPT" ] && exit 0

CORRECTIONS=$(grep -E '"type":"user"' "$TRANSCRIPT" 2>/dev/null \
  | grep -ciE '"(message|content)":"(no|don'\''t|stop|wait|that'\''s wrong)\b' || true)

if [ "$CORRECTIONS" -ge "$THRESHOLD" ]; then
  echo "[jstack] You corrected Claude $CORRECTIONS times this session — run /jstack:skill-creator/improve-claude-md to capture them as rules." >&2
fi

exit 0
