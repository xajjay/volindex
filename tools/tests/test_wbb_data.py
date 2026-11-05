"""
Look at the SportsDataverse women's basketball data (ESPN, published on GitHub) for Tennessee.
Does NOT touch the live site's data. Nothing is installed in the site; this is a look-and-see test.

Setup (once):
    pip install pandas pyarrow requests
Run:
    python tools/tests/test_wbb_data.py
    python tools/tests/test_wbb_data.py --season 2027      # season = the year the season ENDS (2026-27 -> 2027)

What it does:
  1. Lists the women's college basketball data releases on GitHub (so you can see what exists).
  2. Downloads ONE small table (the schedule) and, if it's small enough, the player box scores, for one season.
  3. Filters to Tennessee and prints the games and a few player lines next to what your site has.
Downloads are a few MB to ~100 MB. Play-by-play is ~8 GB total: this script never downloads it.
"""
import io, json, os, sys
try:
    import pandas as pd, requests
except ImportError:
    sys.exit("Run: pip install pandas pyarrow requests")

season = int(sys.argv[sys.argv.index("--season") + 1]) if "--season" in sys.argv else 2027
API = "https://api.github.com/repos/sportsdataverse/sportsdataverse-data/releases"
PREFIX = "espn_womens_college_basketball_"
# The release names follow one pattern; try the likely table names directly instead of paging through every release.
GUESSES = ["schedules", "schedule", "team_boxscores", "team_box", "player_boxscores", "player_box", "rosters", "player_stats", "team_stats", "pbp"]

wbb = []
for g in GUESSES:
    r = requests.get(f"{API}/tags/{PREFIX}{g}", timeout=30)
    if r.status_code == 200:
        wbb.append(r.json())
    elif r.status_code == 403:
        sys.exit("GitHub is rate-limiting anonymous requests. Wait about an hour and run again.")
print("Women's college basketball releases found:")
for r in wbb: print("  ", r["tag_name"], f"({len(r['assets'])} files)", ", ".join(a["name"] for a in r["assets"][:3]) + (" ..." if len(r["assets"]) > 3 else ""))
if not wbb: sys.exit("None of the guessed names exist. Open https://github.com/sportsdataverse/wehoop-wbb-data and copy a release name from the table links, then paste it to Claude.")

def asset_for(tag_part, max_mb):
    for r in wbb:
        if tag_part in r["tag_name"]:
            for a in r["assets"]:
                if str(season) in a["name"] and a["name"].endswith((".parquet", ".csv")):
                    mb = a["size"] / 1e6
                    print(f"  using {a['name']} ({mb:.1f} MB) from {r['tag_name']}")
                    return a if mb <= max_mb else print("  too big, skipping") or None
    print(f"  no {season} file in a release matching '{tag_part}'")

def load(asset):
    raw = requests.get(asset["browser_download_url"], timeout=300).content
    return pd.read_parquet(io.BytesIO(raw)) if asset["name"].endswith(".parquet") else pd.read_csv(io.BytesIO(raw))

def tn(df, cols):
    """Rows involving Tennessee (matches by name on any of the given columns)."""
    mask = False
    for c in cols:
        if c in df.columns:
            mask = mask | df[c].astype(str).str.contains("Tennessee", case=False) & ~df[c].astype(str).str.contains("Tech|State|Martin|Southern|Chat", case=False)
    return df[mask] if not isinstance(mask, bool) else df.iloc[0:0]

print("\n== Schedule")
a = asset_for("schedule", 60)
if a:
    sch = load(a); print("   columns:", ", ".join(sch.columns[:30]))
    t = tn(sch, ["home_display_name", "away_display_name", "home_name", "away_name"])
    print(f"   Tennessee games in {season}: {len(t)}")
    keep = [c for c in ("game_date", "home_display_name", "away_display_name", "home_score", "away_score", "status_type_completed") if c in t.columns]
    print(t[keep].tail(8).to_string(index=False))

print("\n== Player box scores")
a = asset_for("player_box", 150)
if a:
    pb = load(a); print("   columns:", ", ".join(pb.columns[:35]))
    t = tn(pb, ["team_display_name", "team_name"])
    print(f"   Tennessee player-game rows: {len(t)}")
    keep = [c for c in ("game_date", "athlete_display_name", "minutes", "points", "rebounds", "assists", "field_goals_made", "field_goals_attempted") if c in t.columns]
    print(t[keep].tail(10).to_string(index=False))

print("""
How to read it:
  - Do the Tennessee game count and scores match your site's Women's Hoops page? If yes, the data is trustworthy.
  - Do the player rows have the stats you'd want (minutes, points, shots)? Then box scores and shot charts are possible.
  - It's ESPN data republished daily. It adds depth (box scores, shots, history), not real-time scores.
""")
