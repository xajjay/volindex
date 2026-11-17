"""
The Vol Index - current ratings and predictions for Tennessee's remaining games
===============================================================================
    python tools/model/fb_preview.py            # ratings table + predictions for every unplayed Tennessee game

Uses the efficiency ratings as of today (every finished game so far), the betas learned from all earlier seasons, and the
team-specific home-field estimates from fb_hfa.py (shrunk toward the league average).
"""
import os, sys, math
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fb_ratings as FR
import fb_hfa as HF

TEAM = "Tennessee"


def main():
    hl, lam = 240, 20
    G, T = FR.load(); P = FR.panel(G, T)
    teams = sorted(set(P["o"]) | set(P["d"]))
    names = {}
    for side in ("home", "away"):
        for i, n in zip(G[f"{side}_team_id"], G[f"{side}_team"]): names[i] = n
    cut = int(P["day"].max()) + 1
    S = FR.strengths(P, teams, cut, hl, lam)
    idx = S[FR.METRICS[0]][3]

    # betas from every finished FBS-vs-FBS game with pre-game ratings
    D, H, mu = HF.home_edges(hl, lam)
    feats = ["f_" + m for m in FR.METRICS] + ["site"]
    b = FR.ols(D[feats].values, D["margin"].values)
    hfa = pd.read_csv(os.path.join(FR.DIR, "hfa_teams.csv"), index_col=0)["hfa"] if os.path.exists(os.path.join(FR.DIR, "hfa_teams.csv")) else pd.Series(dtype=float)

    def strength(tid, m): O, Dd, _, ix = S[m]; return O[ix[tid]] - Dd[ix[tid]]
    # ---- ratings table, ranked among FBS teams ----
    fbs = [t for t in teams if t != -1]
    rows = []
    for t in fbs:
        r = {"team": names.get(t, t)}
        for m in FR.METRICS: r[m] = strength(t, m)
        r["off_epa"], r["def_epa"] = S["c_epa"][0][idx[t]], S["c_epa"][1][idx[t]]
        rows.append(r)
    R = pd.DataFrame(rows)
    # only teams that actually played this season
    cur = set(G[(G["season"] == G["season"].max())][["home_team", "away_team"]].values.ravel())
    R = R[R["team"].isin(cur)].copy()
    R["power"] = sum(b[1 + i] * R[m] for i, m in enumerate(FR.METRICS))                   # points better than an average FBS team, neutral field
    R["rank"] = R["power"].rank(ascending=False).astype(int)
    R = R.sort_values("power", ascending=False).reset_index(drop=True)
    print("Top 12 by efficiency power rating (points vs. an average FBS team, neutral site):")
    print(R.head(12)[["rank", "team", "power", "off_epa", "def_epa"]].round(2).to_string(index=False))
    for n in (TEAM, "LSU", "Vanderbilt"):
        x = R[R["team"] == n]
        if len(x):
            x = x.iloc[0]
            print(f"\n{n}: rank {x['rank']}/{len(R)}, power {x['power']:+.1f}; offense EPA/play {x['off_epa']:+.3f} (rank {int((R['off_epa'] > x['off_epa']).sum()) + 1}), "
                  f"defense EPA allowed {x['def_epa']:+.3f} (rank {int((R['def_epa'] < x['def_epa']).sum()) + 1}); "
                  f"success {x['c_succ']:+.3f}, explosive {x['c_expl']:+.3f}, pts/drive {x['pts_per_drive']:+.2f}")

    # ---- unplayed Tennessee games (from the site's own schedule file) ----
    import json, re
    txt = open(os.path.join(FR.ROOT, "data", "football-auto.js"), encoding="utf-8").read()
    sched = json.loads(re.search(r"SITE_AUTO\.football\s*=\s*(\{.*\});?\s*$", txt, re.S).group(1))["schedule"]
    pw = R.set_index("team")
    print("\nPredictions for unplayed games (margin = Tennessee minus opponent, points):")
    out = []
    for g in sched:
        if g.get("result"): continue
        opp = re.sub(r"^#\d+\s+", "", g["opp"]).strip()
        if opp not in pw.index: print("  no ratings for", opp); continue
        site = {"H": 1, "A": -1}.get(g["site"], 0)
        tid_u = [k for k, v in names.items() if v == TEAM][0]; tid_o = [k for k, v in names.items() if v == opp][0]
        f = np.array([strength(tid_u, m) - strength(tid_o, m) for m in FR.METRICS])
        neutral = b[0] + (b[1:1 + len(FR.METRICS)] * f).sum()
        h = hfa.get(TEAM if site == 1 else opp, mu) if site else 0.0
        margin = neutral + site * h
        print(f"  {g['date']}  {'vs' if site == 1 else 'at' if site == -1 else 'neutral'} {opp:<16} neutral {neutral:+5.1f}  HFA {site * h:+4.1f}  -> {margin:+5.1f}  "
              f"(Tennessee win chance {100 * 0.5 * (1 + math.erf(margin / (15.3 * math.sqrt(2)))):.0f}%)")
        out.append(dict(date=g["date"], opp=opp, site=site, neutral=neutral, hfa=site * h, margin=margin))
    return R, b, hfa


if __name__ == "__main__":
    main()
