#!/bin/bash
# Stop hook: if code changed since CLAUDE.md (or since the last reminder),
# ask Claude once to decide whether CLAUDE.md needs an update. Claude may skip.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

# Second stop in a row (Claude already saw the reminder): let it finish.
grep -q '"stop_hook_active": *true' && exit 0

stamp=.claude/.claude-md-checked
ref=CLAUDE.md
[ -f "$stamp" ] && [ "$stamp" -nt "$ref" ] && ref=$stamp

changed=$(find src index.html vite.config.ts package.json -type f -newer "$ref" 2>/dev/null | head -10)
[ -z "$changed" ] && exit 0

touch "$stamp"
files=$(echo "$changed" | tr '\n' ' ')
cat <<EOF
{"decision":"block","reason":"Files changed since CLAUDE.md was last touched: $files. Check the 'Updating this file' section of CLAUDE.md: update it only if something there is now wrong or missing (new module, moved responsibility, new gotcha, status change). For routine changes, skip it. Either way, finish with one line saying whether you updated CLAUDE.md."}
EOF
