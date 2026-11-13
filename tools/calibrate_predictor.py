"""
The Vol Index - calibrate the game predictor from Tennessee's own history
=========================================================================
Reads tools/cache/games-<year>.json (every Tennessee game, from CollegeFootballData.com) and writes
data/predict-cal.js: the numbers assets/predict.js needs that should come from data rather than a guess.

    python tools/calibrate_predictor.py           # fit, backtest, write data/predict-cal.js
    python tools/calibrate_predictor.py --print   # show the numbers only

What it fits (games since 2000 where both teams have a pregame Elo rating)
  margin = b * (Tennessee Elo - opponent Elo) + hfa * site        site = +1 home, -1 away, 0 neutral
  sd     = spread of what is left over: how far real games land from the expected margin

Backtest: fit on 2000-2014, then predict every 2015+ game it has never seen. Reports how often the favorite
won, the Brier score (0.25 = coin flip, lower is better) and calibration by bucket (do 70% favorites win 70%?).
"""
import glob, json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "predict-cal.js")
TEAM = "Tennessee"

def load():
    rows = []
    for p in sorted(glob.glob(os.path.join(ROOT, "tools", "cache", "games-*.json"))):
        y = int(re.search(r"games-(\d{4})", p).group(1))
        try: gs = json.load(open(p, encoding="utf-8"))
        except Exception: continue
        for g in gs if isinstance(gs, list) else []:
            if not g.get("completed") or g.get("homePoints") is None or g.get("awayPoints") is None: continue
            home = g.get("homeTeam") == TEAM
            us, them = (g["homePoints"], g["awayPoints"]) if home else (g["awayPoints"], g["homePoints"])
            eu, eo = (g.get("homePregameElo"), g.get("awayPregameElo")) if home else (g.get("awayPregameElo"), g.get("homePregameElo"))
            ls_u, ls_o = (g.get("homeLineScores"), g.get("awayLineScores")) if home else (g.get("awayLineScores"), g.get("homeLineScores"))
            rows.append(dict(y=y, site=0 if g.get("neutralSite") else (1 if home else -1), us=us, them=them, eu=eu, eo=eo,
                             ls=(ls_u, ls_o), opp=g.get("awayTeam") if home else g.get("homeTeam")))
    return rows

def fit(rows):
    """Least squares for margin = b*dElo + hfa*site (no intercept: equal teams on a neutral field are even)."""
    sxx = sxs = sss = sxy = ssy = 0.0
    for r in rows:
        x, s, y = r["eu"] - r["eo"], r["site"], r["us"] - r["them"]
        sxx += x * x; sxs += x * s; sss += s * s; sxy += x * y; ssy += s * y
    det = sxx * sss - sxs * sxs
    b = (sxy * sss - ssy * sxs) / det; h = (sxx * ssy - sxs * sxy) / det
    res = [r["us"] - r["them"] - b * (r["eu"] - r["eo"]) - h * r["site"] for r in rows]
    sd = math.sqrt(sum(e * e for e in res) / (len(res) - 2))
    return b, h, sd

def phi(z): return 0.5 * (1 + math.erf(z / math.sqrt(2)))

def main():
    rows = load()
    elo = [r for r in rows if r["eu"] and r["eo"] and r["y"] >= 2000]
    b, h, sd = fit(elo)
    # out-of-sample backtest
    train = [r for r in elo if r["y"] <= 2014]; test = [r for r in elo if r["y"] >= 2015]
    tb, th, tsd = fit(train)
    hit = 0; brier = 0.0; mae = 0.0; buckets = {}
    for r in test:
        m = tb * (r["eu"] - r["eo"]) + th * r["site"]; p = phi(m / tsd); won = r["us"] > r["them"]
        hit += (p >= 0.5) == won; brier += (p - won) ** 2; mae += abs(m - (r["us"] - r["them"]))
        k = min(4, int(max(p, 1 - p) * 10) - 5); bk = buckets.setdefault(k, [0, 0, 0.0])
        bk[0] += 1; bk[1] += (p >= 0.5) == won; bk[2] += max(p, 1 - p)
    n = len(test)
    cal = [[f"{50 + k * 10}-{60 + k * 10}%", v[0], round(v[2] / v[0] * 100, 1), round(v[1] / v[0] * 100, 1)] for k, v in sorted(buckets.items())]
    # how Tennessee games are scored: share of points by quarter, total points, how often by one score
    mod = [r for r in rows if r["y"] >= 2010]
    q = [0.0] * 4; tot = 0.0
    for r in mod:
        for ls in r["ls"]:
            if ls and len(ls) >= 4:
                for i in range(4): q[i] += ls[i]
                tot += sum(ls[:4])
    out = dict(
        fitted=f"{len(elo)} Tennessee games, 2000-{max(r['y'] for r in elo)}",
        eloPerPoint=round(1 / b, 1), hfa=round(h, 2), sd=round(sd, 2),
        backtest=dict(train=f"2000-2014 ({len(train)} games)", test=f"2015-{max(r['y'] for r in test)} ({n} games)",
                      accuracy=round(hit / n * 100, 1), brier=round(brier / n, 4), mae=round(mae / n, 1), calibration=cal),
        quarters=[round(x / tot, 3) for x in q],
        avgTotal=round(sum(r["us"] + r["them"] for r in mod) / len(mod), 1),
        oneScore=round(sum(abs(r["us"] - r["them"]) <= 8 for r in mod) / len(mod) * 100, 1),
        homeRecord=[sum(1 for r in mod if r["site"] == 1 and r["us"] > r["them"]), sum(1 for r in mod if r["site"] == 1)],
        awayRecord=[sum(1 for r in mod if r["site"] == -1 and r["us"] > r["them"]), sum(1 for r in mod if r["site"] == -1)],
    )
    if __name__ == "__main__": print(json.dumps(out, indent=1))
    if "--print" not in sys.argv:
        tmp = OUT + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write("/* Written by tools/calibrate_predictor.py from tools/cache/games-*.json. Do not edit by hand. */\n")
            f.write("window.PREDICT_CAL = " + json.dumps(out, indent=1) + ";\n")
        os.replace(tmp, OUT)
        if __name__ == "__main__": print("Wrote", OUT)

if __name__ == "__main__":
    main()
