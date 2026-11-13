"""
The Vol Index - calibrate the basketball game predictor from Tennessee's own history
====================================================================================
Reads data/mbb-history-auto.js and data/wbb-history-auto.js (every Tennessee game since 2000-01) and the program
strength table in assets/sdyn/sd-data.js, and writes data/predict-cal-bb.js for assets/predict-bb.js.

    python tools/calibrate_predictor_bb.py           # fit, backtest, write the file
    python tools/calibrate_predictor_bb.py --print   # numbers only

The model it fits (one per sport)
  margin = Tennessee's level that season - b * (opponent program strength - 60) - c * rank bonus + hca * site
    hca               measured separately and held fixed: half the gap between Tennessee's home and away margins against
                      the same opponent in the same season (so schedule strength can't leak into it)
    program strength  0-100 number per school from the dynasty's table (today's table, used for every season: a rough,
                      stable measure of how good a program usually is)
    rank bonus        (26 - AP rank) / 25 when the opponent was ranked at tip-off, else 0
    site              +1 home, -1 away, 0 neutral
    sd                how far real games land from that expected margin

Backtest (walk-forward, so nothing is predicted with information from its own future): for every game since 2010-11,
Tennessee's level is estimated only from that season's earlier games, pulled toward the previous season's final level
(weight = games / (games + k)); b, c and hca come from seasons before 2010-11.
"""
import json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "predict-cal-bb.js")
ALIAS = {"UConn": "Connecticut", "Ole Miss": "Ole Miss", "NC State": "NC State", "Miami (Fla.)": "Miami", "Miami (FL)": "Miami", "USC": "USC", "Pitt": "Pittsburgh",
         "ETSU": "East Tennessee State", "UT Martin": "UT Martin", "UNC Asheville": "UNC Asheville", "St. John's (N.Y.)": "St. John's", "Saint Mary's (Calif.)": "Saint Mary's"}
K = 6          # games of evidence it takes to count as much as last season's level

def strengths():
    t = open(os.path.join(ROOT, "assets", "sdyn", "sd-data.js"), encoding="utf-8").read()
    out = {}
    for line in t.splitlines():
        p = line.split("|")
        if len(p) >= 6 and p[2].isdigit() and p[3].isdigit():
            out[p[0].strip()] = (int(p[2]), int(p[3]))
    return out

def team_table(S):
    """name -> [men's strength, women's strength, color, short name], for the predictor (colors and short names from the football table where a school has one)."""
    col = {}
    for path in (os.path.join(ROOT, "assets", "sdyn", "sd-data.js"), os.path.join(ROOT, "assets", "dynasty", "dy-data.js")):
        for line in open(path, encoding="utf-8").read().splitlines():
            p = line.split("|")
            if len(p) < 4 or not p[0].strip() or p[0].strip() not in S: continue
            c = next((x for x in p if re.match(r"^#[0-9A-Fa-f]{6}$", x.strip())), None)
            ab = p[1].strip() if "dy-data" in path and re.match(r"^[A-Z&]{2,5}$", p[1].strip()) else None
            e = col.setdefault(p[0].strip(), [None, None])
            if c and not e[0]: e[0] = c.strip()
            if ab and not e[1]: e[1] = ab
    return {n: [v[0], v[1]] + col.get(n, [None, None]) for n, v in S.items()}

def clean(opp):
    m = re.match(r"^#(\d+)(?:/\d+)?\s+(.*)$", opp)
    rank = int(m.group(1)) if m else None
    name = (m.group(2) if m else opp).strip()
    name = re.sub(r"\s*\(.*?\)\s*$", "", name) if "Exhibition" in name else name
    return ALIAS.get(name, name), rank

def load(key, col, S):
    t = open(os.path.join(ROOT, "data", f"{key}-history-auto.js"), encoding="utf-8").read()
    i = t.index("{", t.index(f"{key}History") + len(key) + 7)
    depth = 0
    for j in range(i, len(t)):
        depth += t[j] == "{"; depth -= t[j] == "}"
        if depth == 0: break
    H = json.loads(t[i:j + 1])
    rows = []
    for season, games in H.items():
        y = int(season[:4])
        for n, g in enumerate(sorted(games, key=lambda g: g[0])):
            if "xhibition" in g[1] or g[3] not in ("W", "L"): continue
            try: us, them = int(g[4]), int(g[5])
            except (TypeError, ValueError): continue
            name, rank = clean(g[1])
            st = S.get(name)
            rows.append(dict(y=y, n=n, opp=name, st=st[col] if st and st[col] else None, rank=rank, site={"H": 1, "A": -1}.get(g[2], 0), us=us, them=them))
    return rows

def solve(A, y):
    """Least squares by normal equations (small, so plain Gaussian elimination)."""
    n = len(A[0]); M = [[sum(a[i] * a[j] for a in A) for j in range(n)] + [sum(a[i] * v for a, v in zip(A, y))] for i in range(n)]
    for i in range(n):
        p = max(range(i, n), key=lambda r: abs(M[r][i])); M[i], M[p] = M[p], M[i]
        if abs(M[i][i]) < 1e-12: continue
        for r in range(n):
            if r != i:
                f = M[r][i] / M[i][i]
                M[r] = [x - f * z for x, z in zip(M[r], M[i])]
    return [M[i][n] / M[i][i] if abs(M[i][i]) > 1e-12 else 0 for i in range(n)]

def fit(rows, hca):
    seasons = sorted({r["y"] for r in rows}); si = {y: k for k, y in enumerate(seasons)}
    A = []; Y = []
    for r in rows:
        a = [0.0] * len(seasons); a[si[r["y"]]] = 1
        A.append(a + [-(r["st"] - 60), -((26 - r["rank"]) / 25 if r["rank"] else 0)]); Y.append(r["us"] - r["them"] - hca * r["site"])      # home court is fixed at the paired estimate
    w = solve(A, Y); b, c = w[-2:]; h = hca
    res = [yv - sum(x * z for x, z in zip(a, w)) for a, yv in zip(A, Y)]
    sd = math.sqrt(sum(e * e for e in res) / (len(res) - len(w)))
    return dict(b=b, c=c, hca=h, sd=sd, level={y: w[si[y]] for y in seasons})

def phi(z): return 0.5 * (1 + math.erf(z / math.sqrt(2)))

def backtest(rows, hca, split=2010):
    tr = [r for r in rows if r["y"] < split]; f = fit(tr, hca)
    b, c, h, sd = f["b"], f["c"], f["hca"], f["sd"]
    adj = lambda r: -b * (r["st"] - 60) - c * ((26 - r["rank"]) / 25 if r["rank"] else 0) + h * r["site"]
    prev = sum(f["level"].values()) / len(f["level"])
    hit = n = 0; brier = mae = 0.0; buckets = {}
    for y in sorted({r["y"] for r in rows if r["y"] >= split}):
        seen = []
        for r in sorted([r for r in rows if r["y"] == y], key=lambda r: r["n"]):
            est = sum(seen) / len(seen) if seen else prev
            lvl = prev + (est - prev) * len(seen) / (len(seen) + K)
            m = lvl + adj(r); p = phi(m / sd); won = r["us"] > r["them"]
            hit += (p >= 0.5) == won; brier += (p - won) ** 2; mae += abs(m - (r["us"] - r["them"])); n += 1
            k = min(4, int(max(p, 1 - p) * 10) - 5); bk = buckets.setdefault(k, [0, 0, 0.0]); bk[0] += 1; bk[1] += (p >= 0.5) == won; bk[2] += max(p, 1 - p)
            seen.append(r["us"] - r["them"] - adj(r))
        prev = prev + ((sum(seen) / len(seen)) - prev) * len(seen) / (len(seen) + K) if seen else prev
    return dict(train=f"2000-01 to {split - 1}-{str(split)[2:]} ({len(tr)} games)", test=f"{split}-{str(split + 1)[2:]} to 2025-26 ({n} games)", accuracy=round(hit / n * 100, 1), brier=round(brier / n, 4), mae=round(mae / n, 1),
                calibration=[[f"{50 + k * 10}-{60 + k * 10}%", v[0], round(v[2] / v[0] * 100, 1), round(v[1] / v[0] * 100, 1)] for k, v in sorted(buckets.items())])

def main():
    S = strengths(); out = {}
    for key, col in (("mbb", 0), ("wbb", 1)):
        allrows = load(key, col, S); rows = [r for r in allrows if r["st"]]
        # home court measured the clean way: the same opponent, same season, home and away (half the difference)
        pairs = []
        for y in {r["y"] for r in rows}:
            by = {}
            for r in rows:
                if r["y"] == y and r["site"]: by.setdefault(r["opp"], {}).setdefault(r["site"], []).append(r["us"] - r["them"])
            for o, d in by.items():
                if 1 in d and -1 in d: pairs.append((sum(d[1]) / len(d[1]) - sum(d[-1]) / len(d[-1])) / 2)
        hca = sum(pairs) / len(pairs); f = fit(rows, hca)
        recent = [r for r in allrows if r["y"] >= 2018]
        last = max(f["level"]); 
        out[key] = dict(fitted=f"{len(rows)} Tennessee games, 2000-01 to 2025-26", b=round(f["b"], 3), c=round(f["c"], 2), hca=round(f["hca"], 2), sd=round(f["sd"], 2), k=K,
                        hcaPairs=[round(sum(pairs) / len(pairs), 2), len(pairs)], lastLevel=round(f["level"][last], 1), lastSeason=f"{last}-{str(last + 1)[2:]}",
                        avgTotal=round(sum(r["us"] + r["them"] for r in recent) / len(recent), 1), unknown=round(sum(1 for r in allrows if not r["st"]) / len(allrows) * 100, 1),
                        backtest=backtest(rows, hca))
    if __name__ == "__main__": print(json.dumps(out, indent=1))
    out["teams"] = team_table(S); out["alias"] = ALIAS
    if "--print" not in sys.argv:
        tmp = OUT + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write("/* Written by tools/calibrate_predictor_bb.py from the basketball history files. Do not edit by hand. */\n")
            fh.write("window.PREDICT_CAL_BB = " + json.dumps(out, separators=(",", ":")) + ";\n")
        os.replace(tmp, OUT)

if __name__ == "__main__":
    main()
