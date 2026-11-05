"""
Save one full example from each CBBD endpoint to tools/tests/cbbd_samples.json (no key is saved).
Send that file back so the site's basketball feed can be built against the real field names.

    $env:CBBD_API_KEY = "paste-your-key-here"
    python tools/tests/dump_cbbd_samples.py --season 2027
Uses about 7 API calls.
"""
import json, os, sys
try:
    import requests
except ImportError:
    sys.exit("Run: pip install requests")
KEY = os.environ.get("CBBD_API_KEY") or sys.exit("Set CBBD_API_KEY first.")
season = int(sys.argv[sys.argv.index("--season") + 1]) if "--season" in sys.argv else 2027
H = {"Authorization": f"Bearer {KEY}", "Accept": "application/json"}
out = {}
for name, path in (("games", "/games"), ("gameTeams", "/games/teams"), ("gamePlayers", "/games/players"),
                   ("playerSeason", "/stats/player/season"), ("teamSeason", "/stats/team/season"),
                   ("rankings", "/rankings"), ("roster", "/teams/roster")):
    r = requests.get("https://api.collegebasketballdata.com" + path, headers=H,
                     params={"season": season, "team": "Tennessee"}, timeout=30)
    try: body = r.json()
    except Exception: body = r.text[:300]
    out[name] = {"status": r.status_code, "count": len(body) if isinstance(body, list) else None,
                 "first": body[0] if isinstance(body, list) and body else body}
    print(name, r.status_code)
p = os.path.join(os.path.dirname(__file__), "cbbd_samples.json")
json.dump(out, open(p, "w"), indent=1)
print("Saved", p, "- attach this file in chat.")
