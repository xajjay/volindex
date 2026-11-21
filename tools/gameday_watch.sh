#!/usr/bin/env bash
# Game-night watcher (run by .github/workflows/gameday-watch.yml).
# GitHub skips many scheduled runs, so instead of relying on a run every 15 minutes this ONE job stays up
# for hours and checks every few minutes. Each check is the same cheap game-night pass the 15-minute runs do:
# it asks ESPN whether Tennessee's game is final and does nothing until it is. The moment a game is final it
# refreshes the result, box score, record and season stats (players + team), the power ratings, then commits,
# pushes and publishes the site. Usage: tools/gameday_watch.sh [minutes_to_run] [seconds_between_checks]
set -u
cd "$(dirname "$0")/.."
RUN_MIN="${1:-330}"; EVERY="${2:-240}"
END=$((SECONDS + RUN_MIN * 60))
git config user.name "vol-index-bot"; git config user.email "vol-index-bot@users.noreply.github.com"
n=0
while [ "$SECONDS" -lt "$END" ]; do
  n=$((n + 1)); echo "=== check $n at $(date -u +%H:%M:%S) UTC"
  git pull -q --rebase -X theirs origin main || { git rebase --abort 2>/dev/null; git pull -q --no-rebase -X theirs origin main || true; }
  python tools/update_data.py --auto --gameday || true
  python tools/update_cbbd.py --gameday || true
  python tools/update_wbb_box.py --gameday || true
  python tools/update_bb_ratings.py --gameday || true
  if ! git diff --quiet -- data tools/cache assets/dynasty/dy-today.js 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard data tools/cache | head -1)" ]; then
    # keep the "which game nights are done" bookkeeping, but don't publish if only that file changed
    python tools/validate_data.py || true
    git add data tools/cache assets/dynasty/dy-today.js 2>/dev/null
    if ! git diff --cached --quiet; then
      changed_data=$(git diff --cached --name-only | grep -v 'tools/cache/gameday.json' | head -1)
      git commit -q -m "Game night data update $(date -u +%Y-%m-%d)"
      pushed=0
      for i in 1 2 3 4; do git push -q origin HEAD:main && { pushed=1; break; }; sleep $((i * 5)); git pull -q --rebase -X theirs origin main || { git rebase --abort 2>/dev/null; git pull -q --no-rebase -X theirs origin main || true; }; done
      if [ "$pushed" = 1 ] && [ -n "$changed_data" ]; then echo "published: $changed_data"; gh workflow run deploy.yml --ref main || true; fi
    fi
  fi
  sleep "$EVERY"
done
echo "watch window over"
