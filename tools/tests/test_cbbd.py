"""
Try the CollegeBasketballData (CBBD) API for Tennessee. Does NOT touch the live site's data.

Setup (once):
    1. Get a key at https://collegefootballdata.com/key (use your .edu email), same account covers CFBD + CBBD.
    2. pip install requests
    3. Put the key in an environment variable, never in the file:
         Windows PowerShell:  $env:CBBD_API_KEY = "paste-key-here"
         Mac/Linux:           export CBBD_API_KEY="paste-key-here"
Run:
    python tools/tests/test_cbbd.py
    python tools/tests/test_cbbd.py --season 2027      # season number = the year the season ENDS

It prints what each endpoint returns for Tennessee and a plain-English verdict. Each call uses 1 of your
monthly calls (free tier = 1,000), so a full run is about 10 calls.
"""
import json, os, sys
try:
    import requests
except ImportError:
    sys.exit("Run: pip install requests")

BASE = "https://api.collegebasketballdata.com"
KEY = os.environ.get("CBBD_API_KEY")
if not KEY:
    sys.exit("Set CBBD_API_KEY first (see the top of this file).")
H = {"Authorization": f"Bearer {KEY}", "Accept": "application/json"}
season = int(sys.argv[sys.argv.index("--season") + 1]) if "--season" in sys.argv else 2027
calls = 0

def get(path, **params):
    global calls
    calls += 1
    r = requests.get(BASE + path, headers=H, params=params, timeout=30)
    try: body = r.json()
    except Exception: body = r.text[:200]
    return r.status_code, body

def show(title, path, **params):
    code, body = get(path, **params)
    n = len(body) if isinstance(body, list) else "-"
    print(f"\n== {title}\n   GET {path} {params} -> HTTP {code}, items: {n}")
    if isinstance(body, list) and body:
        print("   fields:", ", ".join(list(body[0].keys())[:25]))
        print("   sample:", json.dumps(body[0])[:350])
    elif code != 200:
        print("   response:", str(body)[:200])
    return code, body

print(f"Testing CBBD for Tennessee, season {season}")

# 1. Find out what the API offers (the spec lists every endpoint)
spec = None
for p in ("/swagger/json", "/openapi.json", "/swagger/doc.json", "/docs/json"):
    code, body = get(p)
    if code == 200 and isinstance(body, dict) and body.get("paths"):
        spec = body; print(f"\nEndpoint list found at {p}:"); break
if spec:
    for path in sorted(spec["paths"]): print("   ", path)
else:
    print("\n(Could not auto-load the endpoint list; see https://api.collegebasketballdata.com/swagger)")

# 2. The things the site needs
code, games = show("Tennessee games (schedule + scores)", "/games", season=season, team="Tennessee")
show("Teams", "/teams", season=season)
for path, title in (("/games/teams", "Team box scores"), ("/games/players", "Player box scores"),
                    ("/stats/player/season", "Player season stats"), ("/stats/team/season", "Team season stats"),
                    ("/rankings", "Polls / rankings"), ("/ratings/adjusted", "Adjusted ratings (AdjO/AdjD)"),
                    ("/teams/roster", "Roster")):
    show(title, path, season=season, team="Tennessee")

# 3. Is women's basketball in there?
print("\n== Women's basketball check")
if isinstance(games, list) and games:
    print("   Game rows carry a field that says men's/women's?",
          [k for k in games[0] if any(w in k.lower() for w in ("gender", "women", "league", "division"))] or "none seen")
print("   Check the endpoint list above and https://collegebasketballdata.com for a women's option.")

# 4. Compare to the live site: do the games match?
site = os.path.join(os.path.dirname(__file__), "..", "..", "data", "mbb-auto.js")
try:
    t = open(site, encoding="utf-8").read()
    mine = json.loads(t.split("window.SITE_AUTO['mbb'] = ", 1)[1].rsplit(";", 1)[0])["schedule"]
    played = [g for g in mine if g.get("result")]
    api_n = len(games) if isinstance(games, list) else 0
    print(f"\n== Compare: the site has {len(mine)} scheduled / {len(played)} played games; the API returned {api_n}.")
except Exception as e:
    print("\n(Skipped comparison with data/mbb-auto.js:", e, ")")

print(f"\nCalls used this run: {calls}")
print("""
How to read it:
  - Worth switching a feature over ONLY if its endpoint returned items with the fields the site shows.
  - Schedule/scores matching the site = safe swap for basketball schedules.
  - Empty player stats, rosters or women's data = keep the current source for that part.""")
