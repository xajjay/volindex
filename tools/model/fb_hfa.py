"""
The Vol Index - home-field advantage study
==========================================
Home-field advantage (HFA) is not the same everywhere.  This measures it the way you described: how a team does at home
RELATIVE TO ITS OWN POWER RATING, so a good team does not look like it has a big HFA just because it is good.

    python tools/model/fb_hfa.py

Steps
  1. Pre-game ratings (same walk-forward efficiency ratings as fb_ratings.py) give a neutral-field expected margin.
  2. For every non-neutral FBS-vs-FBS game:  home edge = actual margin - neutral expected margin.
  3. A team's HFA = its average home edge, shrunk toward the league average in proportion to how noisy it is
     (empirical Bayes).  A game's noise is ~15 points, so one team-season is very noisy; the shrinkage handles that.
  4. Test whether team HFA is real: does a team's HFA in one period predict the next?  And what explains it?
     (crowd size, how full the stadium is, how good the team is, how big the game is)
"""
import os, sys, math
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fb_ratings as FR

ROOT = FR.ROOT


def home_edges(hl=240, lam=20):
    """Team-perspective residuals for every non-neutral game, using ratings fit on all games (site term included)."""
    G, T = FR.load(); P = FR.panel(G, T)
    F = FR.games_features(G, P, hl, lam)
    D = G.merge(F, on="game_id", how="inner")
    D = D[D["margin"].notna() & (D["h_id"] != -1) & (D["a_id"] != -1)].copy()
    for m in FR.METRICS: D["f_" + m] = D[m + "_h"] - D[m + "_a"]
    feats = ["f_" + m for m in FR.METRICS] + ["site"]
    b = FR.ols(D[feats].values, D["margin"].values)
    D["res"] = D["margin"] - np.c_[np.ones(len(D)), D[feats].values] @ b      # what the ratings and the league-average HFA missed
    H = D[D["site"] == 1].copy()
    return D, H, b[-1]


def team_hfa(D, H, mu):
    """HFA_i = league HFA + (residual at home - residual on the road, from team i's side) / 2.
    A rating that is too compressed or too stretched shifts home and road residuals together, so it cancels."""
    home = H.groupby("home_team")["res"].agg(["mean", "count"])
    aw = H.assign(r=-H["res"]).groupby("away_team")["r"].agg(["mean", "count"])
    j = home.join(aw, lsuffix="_h", rsuffix="_a", how="inner")
    j["raw"] = mu + (j["mean_h"] - j["mean_a"]) / 2
    j["n"] = np.minimum(j["count_h"], j["count_a"])
    return j


def main():
    D, H, mu = home_edges()
    sd = H["res"].std()
    print(f"{len(H)} home games.  League-wide home edge from the fitted site term: {mu:.2f} points (one game's sd {sd:.1f})")
    print("By season (mean residual + league term):  " + "  ".join(f"{y}: {mu + g['res'].mean():.2f}" for y, g in H.groupby("season")))

    # ---- is team-specific HFA real?  split-half across time ----
    def half(df): return team_hfa(D, df, mu)
    A, B = H[H["season"] <= 2020], H[H["season"] >= 2021]
    j = half(A).join(half(B), lsuffix="_a", rsuffix="_b").dropna()
    j = j[(j["n_a"] >= 15) & (j["n_b"] >= 15)]
    r = np.corrcoef(j["raw_a"], j["raw_b"])[0, 1]
    print(f"\nSplit-half: {len(j)} teams with 15+ home and road games in both 2014-2020 and 2021-2026.  r = {r:.2f}")
    t = team_hfa(D, H, mu); t = t[t["n"] >= 25]
    noise = (sd ** 2 / 2) * (1 / t["count_h"] + 1 / t["count_a"]) / 2
    tau2 = max(t["raw"].var() - noise.mean(), 0.0)
    print(f"Real spread between teams (sd of true HFA): {math.sqrt(tau2):.2f} points  (sampling noise per team ~{math.sqrt(noise.mean()):.2f})")

    allt = team_hfa(D, H, mu)
    k = (sd ** 2 / 2) / max(tau2, 1e-6)
    allt["hfa"] = mu + (allt["raw"] - mu) * allt["n"] / (allt["n"] + k)
    v = H.groupby("home_team").agg(att=("attendance", "mean"), cap=("attendance", lambda x: x.quantile(0.95)))
    v["fill"] = v["att"] / v["cap"]
    q = H.groupby("home_team").apply(lambda g: (g["margin"] > 0).mean(), include_groups=False).rename("home_win")
    X = allt.join(v).join(q).dropna(); X = X[X["n"] >= 25]
    print(f"\nWhat goes with a bigger home edge (among {len(X)} teams with 25+ games each way):")
    for c, lab in [("att", "average crowd"), ("cap", "stadium size (95th pct crowd)"), ("fill", "how full it is"), ("home_win", "home win rate")]:
        print(f"  {lab:<32} r = {np.corrcoef(X['hfa'], X[c])[0, 1]:+.2f}")
    print("\nBiggest home edges (shrunken):")
    print(X.sort_values("hfa", ascending=False).head(12)[["hfa", "raw", "n", "att"]].round(2).to_string())
    print("\nSmallest:")
    print(X.sort_values("hfa").head(8)[["hfa", "raw", "n", "att"]].round(2).to_string())
    for name in ("Tennessee", "LSU", "Vanderbilt"):
        if name in allt.index:
            x = allt.loc[name]; print(f"{name}: home-minus-road HFA {x['raw']:+.2f} over {int(x['n'])}+ games each way -> shrunken {x['hfa']:.2f}")
    H["crowd_z"] = (H["attendance"] - H.groupby("home_team")["attendance"].transform("mean")) / H.groupby("home_team")["attendance"].transform("std")
    z = H[H["crowd_z"].notna()]
    print(f"\nSame team, bigger-than-usual crowd: r(crowd z-score, home residual) = {np.corrcoef(z['crowd_z'], z['res'])[0, 1]:+.3f}")
    if "--save" in sys.argv:
        out = os.path.join(FR.DIR, "hfa_teams.csv"); allt.round(3).to_csv(out); print("wrote", out)


if __name__ == "__main__":
    main()
