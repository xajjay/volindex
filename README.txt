THE VOL INDEX - how this site works
Covers Tennessee football, volleyball, soccer, men's and women's basketball, baseball and softball.
====================================
Open index.html in any browser (double-click it). No install needed.

FOLDERS
  index.html               the site
  assets/                  look (site.css), code (site.js), logo (logo.svg)
  data/football.js         base data: roster, ratings, stats, schedule, recruits, history, advanced
  data/football-depth.js   THE FILE YOU EDIT: 2026 depth chart + 2027 projected depth chart
  data/football-auto.js    fresh numbers written by the updater (layered on top of football.js)
  data/<sport>.js          other sports: volleyball, soccer, mbb, wbb, baseball, softball
  data/<sport>-lineup.js   EDITABLE projected lineups / starters for each of those sports
                           (site > sport > Lineup tab > "Edit lineup" > "Save to file")
  tools/update_data.py     the updater (CollegeFootballData.com + ESPN)
  tools/update_data.bat    double-click to run the updater on Windows

EDITING A DEPTH CHART
  1. Open the site > Football > Depth Chart (or 2027 Preview).
  2. Click "Edit depth chart". Arrows reorder, X removes, the menu adds players.
  3. Click "Save to file" and save over data/football-depth.js.
  Until you save, edits only live in that browser.

UPDATING THE NUMBERS (CollegeFootballData.com + ESPN)
  One-time setup:
    1. Get a free API key: https://collegefootballdata.com/key
    2. Paste the key (only the key) into a new file: tools/cfbd_key.txt
    3. Install Python 3 from python.org (tick "Add Python to PATH").
  Each update:
    Double-click tools/update_data.bat. It rewrites data/football-auto.js; refresh the site.
  It updates: record, polls, results, kickoff/TV, ESPN line + win chance, every player's
  stats, team per-game numbers with national/SEC ranks, 2027 and 2028 commits.
  Not automatic (weekly by hand or with Claude): depth charts, On3 Top 300, PEAR,
  draft boards, award lists, coaching staff, history.

PLAYER RATINGS (football)
  1. On3 Top 300 college grade (orange badge) if the player is ranked.
  2. Transfers: 247Sports transfer rating ("TR").
  3. Otherwise: 247Sports composite from high school (number + stars). NR = not rated.

GOING LIVE LATER (volindex.net)
  The folder is a static website. Put it on GitHub, connect Cloudflare Pages or Netlify,
  point volindex.net at it, and run the updater on a schedule with GitHub Actions.
