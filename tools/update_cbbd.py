"""
The Vol Index - men's basketball advanced data from the CollegeBasketballData (CBBD) API
=========================================================================================
Writes data/mbb-cbbd.js (window.SITE_CBBD), shown on the Men's Hoops "Advanced" tab:
player advanced stats (ratings, usage, eFG%, TS%, win shares), the team's four factors with opponents,
and a game-by-game efficiency log.

    CBBD_API_KEY=...  python tools/update_cbbd.py
    python tools/update_cbbd.py --gameday    # only runs if the main updater just changed data/mbb-auto.js

Calls: 4 per run (player season, team season, game box scores, rankings). Free tier allows 1,000 a month,
shared with football. The key stays in the CBBD_API_KEY environment variable (a GitHub secret in Actions)
and is never written to a file. Only the fields the site displays are stored, not raw API responses.
Fail-soft like the other updaters: if the API is down, the last good file is kept and the run still passes.
Data provided by CollegeBasketballData.com.
"""
import datetime, json, os, subprocess, sys, time
import urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "mbb-cbbd.js")
BASE = "https://api.collegebasketballdata.com"
TEAM = "Tennessee"


def season_year():
    try:
        t = open(os.path.join(ROOT, "data", "mbb-auto.js"), encoding="utf-8").read()
        s = json.loads(t.split("window.SITE_AUTO['mbb'] = ", 1)[1].rsplit(";", 1)[0]).get("season", "")
        if "-" in s: return int(s.split("-")[0]) + 1          # "2026-27" -> 2027
    except Exception:
        pass
    n = datetime.date.today()
    return n.year + 1 if n.month >= 9 else n.year

def get(path, key, **params):
    url = BASE + path + "?" + urllib.parse.urlencode(params)
    last = None
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            last = e; time.sleep(2 * (i + 1))
    raise RuntimeError(f"{path}: {last}")

def r1(x, d=1):
    try: return round(float(x), d)
    except Exception: return None

def per(total, g, d=1):
    try: return round(float(total) / float(g), d) if g else None
    except Exception: return None

def pct(x):
    """Percent fields arrive as 0-100; season four factors sometimes as 0-1 ratios."""
    v = r1(x, 1)
    return v

def ratio_pct(x):
    """Season true-shooting arrives as a 0-1 ratio (1 = 100%), game rows as a percent; show percent."""
    v = r1(x, 3)
    return r1(v * 100) if v is not None and abs(v) <= 1.5 else r1(v)

def players(rows):
    out = []
    for p in rows:
        g = p.get("games") or 0
        fg, tp, ft, rb = p.get("fieldGoals") or {}, p.get("threePointFieldGoals") or {}, p.get("freeThrows") or {}, p.get("rebounds") or {}
        out.append({
            "name": p.get("name"), "pos": p.get("position"), "g": g, "gs": p.get("starts"),
            "mpg": per(p.get("minutes"), g), "ppg": per(p.get("points"), g), "rpg": per(rb.get("total"), g),
            "apg": per(p.get("assists"), g), "spg": per(p.get("steals"), g), "bpg": per(p.get("blocks"), g),
            "topg": per(p.get("turnovers"), g),
            "fg": r1(fg.get("pct")), "tp": r1(tp.get("pct")), "ft": r1(ft.get("pct")),
            "ortg": r1(p.get("offensiveRating")), "drtg": r1(p.get("defensiveRating")), "net": r1(p.get("netRating")),
            "usg": r1(p.get("usage")), "efg": r1(p.get("effectiveFieldGoalPct")), "ts": ratio_pct(p.get("trueShootingPct")),
            "ato": r1(p.get("assistsTurnoverRatio"), 2), "orb": r1(p.get("offensiveReboundPct")),
            "ftr": r1(p.get("freeThrowRate")), "porpag": r1(p.get("PORPAG")),
            "ws": r1((p.get("winShares") or {}).get("total")), "min": p.get("minutes"),
        })
    return out

def team(row):
    def side(s):
        ff, pts = s.get("fourFactors") or {}, s.get("points") or {}
        tov = ff.get("turnoverRatio")
        if tov is not None and abs(tov) < 1: tov = tov * 100     # season rows give a ratio, game rows a percent
        return {"rating": r1(s.get("rating")), "ts": r1(s.get("trueShooting")), "efg": r1(ff.get("effectiveFieldGoalPct")),
                "tov": r1(tov), "orb": r1(ff.get("offensiveReboundPct")), "ftr": r1(ff.get("freeThrowRate")),
                "fg": r1((s.get("fieldGoals") or {}).get("pct")), "tp": r1((s.get("threePointFieldGoals") or {}).get("pct")),
                "ft": r1((s.get("freeThrows") or {}).get("pct")), "paint": pts.get("inPaint"), "fast": pts.get("fastBreak"),
                "offTov": pts.get("offTurnovers"), "reb": (s.get("rebounds") or {}).get("total"),
                "ast": s.get("assists"), "stl": s.get("steals"), "blk": s.get("blocks"), "pts": pts.get("total")}
    g = row.get("games") or 0
    return {"games": g, "wins": row.get("wins"), "losses": row.get("losses"), "pace": r1(row.get("pace")),
            "us": side(row.get("teamStats") or {}), "opp": side(row.get("opponentStats") or {})}

def game_log(rows):
    out = []
    for g in rows:
        u, o = g.get("teamStats") or {}, g.get("opponentStats") or {}
        uf, of = u.get("fourFactors") or {}, o.get("fourFactors") or {}
        out.append({"date": (g.get("startDate") or "")[:10], "opp": g.get("opponent"), "home": g.get("isHome"),
                    "neutral": g.get("neutralSite"), "pts": (u.get("points") or {}).get("total"), "oppPts": (o.get("points") or {}).get("total"),
                    "pace": r1(g.get("pace")), "ortg": r1(u.get("rating")), "drtg": r1(o.get("rating")),
                    "efg": r1(uf.get("effectiveFieldGoalPct")), "oppEfg": r1(of.get("effectiveFieldGoalPct")),
                    "tov": r1(uf.get("turnoverRatio")), "orb": r1(uf.get("offensiveReboundPct")), "ftr": r1(uf.get("freeThrowRate"))})
    return sorted(out, key=lambda x: x["date"])

def polls(rows):
    return [{"poll": r.get("pollType"), "week": r.get("week"), "date": (r.get("pollDate") or "")[:10],
             "rank": r.get("ranking"), "points": r.get("points"), "first": r.get("firstPlaceVotes")} for r in rows]

def main():
    key = os.environ.get("CBBD_API_KEY")
    if not key:
        print("SKIP CBBD: no CBBD_API_KEY set"); return
    if "--gameday" in sys.argv:    # game-night runs: only when the main updater just changed the basketball data
        try:
            if subprocess.run(["git", "diff", "--quiet", "HEAD", "--", "data/mbb-auto.js"], cwd=ROOT).returncode == 0:
                print("CBBD: no basketball change this run"); return
        except Exception: pass
    yr = season_year()
    try:
        ps = get("/stats/player/season", key, season=yr, team=TEAM)
        ts = get("/stats/team/season", key, season=yr, team=TEAM)
        gt = get("/games/teams", key, season=yr, team=TEAM)
        rk = get("/rankings", key, season=yr, team=TEAM)
        if not ps or not ts:
            print("SKIP CBBD: API returned no player or team season stats"); return
        data = {"updated": datetime.date.today().isoformat(), "season": f"{yr - 1}-{str(yr)[2:]}",
                "team": team(ts[0]), "players": players(ps), "games": game_log(gt), "polls": polls(rk)}
    except Exception as e:
        print(f"SKIP CBBD: {e}"); return      # keep the last good file; the health check flags a stale one
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/update_cbbd.py from CollegeBasketballData.com. Do not edit by hand. */\n")
        f.write("window.SITE_CBBD = " + json.dumps(data, separators=(",", ":")) + ";\n")
    print(f"OK   CBBD: {len(data['players'])} players, {len(data['games'])} games, season {data['season']}")

if __name__ == "__main__":
    main()
