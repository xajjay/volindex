# The Vol Index: editing guide

For Aj, and for any AI assistant helping edit this site. **If you are an AI assistant, read this whole file before changing anything.**

## What the site is

volindex.net is a free, fan-made Tennessee athletics hub: football, volleyball, soccer, men's and women's basketball, baseball and softball. It is a static website (plain HTML, CSS and JavaScript, no server, no build step) hosted on GitHub Pages from the GitHub repo `xajjay/volindex`, branch `main`. Every push to `main` republishes the site in about a minute (`.github/workflows/deploy.yml`).

## What updates by itself (don't touch)

`.github/workflows/update.yml` runs every morning and commits fresh data. These files are written by scripts in `tools/`; never edit them by hand:

- `data/*-auto.js`, `data/*-history-auto.js`: stats, results, box scores, polls
- `data/standings-auto.js`: SEC standings (ESPN, secsports.com)
- `data/transfer-stats.js`: last-season stats for transfers (hand-added baseball lines inside it are kept)
- `data/updated.js`: last-updated dates

Live scores (`assets/live.js`) and the live box score window (`assets/livebox.js`) need no maintenance; they read ESPN during games.

## Files you edit by hand

| File | What it holds |
|---|---|
| `data/football-depth.js` | Football depth chart (`current`) and 2027 preview (`next`) |
| `data/<sport>-lineup.js` | Projected lineups: `mbb`, `wbb`, `volleyball`, `soccer`, `baseball`, `softball` |
| `data/football.js` | Football roster (`players`), schedule, notes, sources, retired jerseys |
| `data/<sport>.js` | Other sports: `roster`, `schedule`, `quick` (overview bullets), `staff`, `sources` |
| `data/extras.js` | Per sport: `playersToKnow` (overview cards, exact order), `honors`, `draft` (pro prospects), `departures`, `ratings`, `advanced`, `recruit` |
| `data/recruiting.js` | Commits, targets and recruiting notes per sport |
| `data/ratings-bb.js` | Basketball player ratings (247Sports men, ESPN women) |
| `data/social.js` | Social & Media tab links |

### Rules

1. **Names must match the roster exactly**, spelling, suffixes and all (`DeWayne Brown II`, `Terrence Hill Jr.`).
2. **Depth chart and lineup files have a `"rev"` number. Add 1 every time you change one** (for example `"rev": 4` to `"rev": 5`) and update `"updated"`. Otherwise visitors who edited their own copy keep seeing their old version.
3. Depth charts and lineups are The Vol Index's own projections and stay labeled **(unofficial)**.
4. Keep JavaScript valid: matching quotes and brackets, commas between items, no comma after the last item in JSON-style files.
5. **Never commit secrets** (the CFBD API key lives only in GitHub Secrets).
6. **No team logos, player photos or copied article text.** Write notes in your own words and credit sources in `sources`.
7. PFF grades are private research only; never put them on the site.

### Formats

Depth chart or lineup row: `["POSITION", ["Starter", "Backup", "Third"]]`

Roster player (other sports): `{"num": "4", "name": "First Last", "pos": "G", "ht": "6-4", "cls": "Jr.", "home": "City, St.", "hs": "High School", "prev": "Old School", "note": "Short note"}`

Players to know (`data/extras.js`): `playersToKnow: ['Name One', 'Name Two', ...]` (8 names fill two rows)

Pro prospect (`data/extras.js` → sport → `draft`): `'Name': { level: 'High', note: 'Who ranked him and where (date)', src: 'https://link' }` with `level` = `High`, `Medium` or `Watch`

## Easiest ways to make changes (no coding)

- **Depth chart or lineup:** on volindex.net open the tab, tap **Edit**, make changes, tap **Save to file**. On github.com/xajjay/volindex, open the matching `data/...` file, tap the pencil, replace everything with the saved file, raise `"rev"` by 1, and **Commit changes**. Live in about a minute.
- **Small text or data fix:** open the file on GitHub, pencil icon, edit, Commit changes.
- **Force a data refresh:** GitHub → **Actions → Update data → Run workflow** (tick *force* to refresh everything).
- **Check it worked:** GitHub → **Actions**; a green check on "Deploy site" means it's live. Hard-refresh the site (or close and reopen it on a phone).
- **Undo a bad change:** open the file on GitHub → **History** → pick the last good version → copy its contents back in → commit.

## Testing changes on your own computer before pushing

1. Install **Git** and **GitHub Desktop**; clone `xajjay/volindex`.
2. In the repo folder run `python -m http.server 8000`, then open http://localhost:8000. Navigate from the home page (refreshing on a sub-page like /football can 404 locally; that's normal, the live site handles it).
3. Open the browser console (F12). Red errors mean something broke; undo it.
4. Commit and push with GitHub Desktop.

## Code map (for bigger changes)

- `index.html`: page shell, loads every script in order
- `assets/router.js`: clean addresses (volindex.net/football/depth-chart)
- `assets/site.js`: home page, football pages, sources page
- `assets/sports.js`: every other sport's pages, player cards, lineups, ratings badges
- `assets/standings.js`: SEC standings table, results box
- `assets/live.js`: live scores, banner, game-day cards
- `assets/search.js`: Ask the Index search box
- `assets/about.js`: About page and corrections form
- `assets/track.js`: analytics (Cloudflare and GoatCounter; open volindex.net/#notrack to skip your own visits)
- `assets/site.css`: all styles (Tennessee Orange #FF8200, Smokey Gray #4B4B4B)
- `tools/`: Python scripts the daily update runs
