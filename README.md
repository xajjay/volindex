# The Vol Index

An all-in-one Tennessee athletics fan site: rosters, depth charts and lineups, schedules, box scores, matchup previews, stats, rankings, recruiting and history for football, volleyball, soccer, basketball, baseball and softball.

Independent fan site, not affiliated with the University of Tennessee. Every source is credited and linked on the site's **Sources & credits** page.

## How it updates

`.github/workflows/update.yml` runs every morning. `tools/auto_schedule.py` decides what's new that day (the morning after games, the morning after each sport's poll comes out, Thursday football lines, Monday weekly refresh), runs the updaters, and commits the new data. The site then redeploys on its own.

- Run it by hand: **Actions → Update data → Run workflow** (tick *force* to refresh everything).
- Needs one repository secret: `CFBD_API_KEY` (free key from collegefootballdata.com).

## Editing

Depth charts and lineups are the only hand-edited files: `data/football-depth.js` and `data/<sport>-lineup.js`. The easiest way is the Edit button on the site, then **Save to file**.

## Local use

Open `index.html` in a browser. To update data from your own computer: `tools/update_data.bat` (Windows) or `python tools/update_data.py`.
