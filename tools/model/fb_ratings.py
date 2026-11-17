"""
The Vol Index - football power ratings and backtest
===================================================
Builds opponent-adjusted team ratings from play-level efficiency (EPA/play, success rate, explosive rate, points per
drive) and tests them the honest way: every game is predicted using ONLY what was known the week before, then compared
with the real result and with the betting market's closing line.

    python tools/model/fb_ratings.py                 # backtest 2018-2025, print the report
    python tools/model/fb_ratings.py --save          # also write the current ratings to tools/cache/fbm/

How a rating is built (one metric at a time)
    metric(offense o vs defense d, in game g) = mu + O[o] + D[d] + h * site
        O = how much better than average this offense is,  D = how much MORE than average this defense allows,
        site = +1 for the home offense, -1 for the away offense, 0 neutral.
    Fit by weighted ridge: older games count less (half-life HL days), and a team with few games is pulled toward average.
    A team's strength in that metric is O - D.  Non-FBS opponents share one pooled "FCS" team.

How games are predicted
    margin(home) = sum_m beta[m] * (strength_m(home) - strength_m(away)) + hfa * site (+ other terms)
    The betas are learned on earlier seasons only (walk-forward), never on the season being predicted.
"""
import os, sys, math
import numpy as np, pandas as pd
import scipy.sparse as sp

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR = os.path.join(ROOT, "tools", "cache", "fbm")
METRICS = ["c_epa", "c_succ", "c_expl", "c_rush_epa", "c_pass_epa", "pts_per_drive"]


def load():
    G = pd.read_parquet(os.path.join(DIR, "games.parquet"))
    T = pd.read_parquet(os.path.join(DIR, "teamgame.parquet"))
    G["date"] = pd.to_datetime(G["start_date"], utc=True, errors="coerce").dt.tz_localize(None)
    G["day"] = (G["date"] - pd.Timestamp("2014-01-01")).dt.days
    # a team is FBS in a season if the data ever labels it so that year; everyone else is pooled as "FCS" (id -1)
    fbs = {}
    for side in ("home", "away"):
        x = G[G[f"{side}_team_division"] == "fbs"][["season", f"{side}_team_id"]]
        for y, i in zip(x["season"], x[f"{side}_team_id"]): fbs.setdefault(y, set()).add(i)
    G["h_id"] = [i if i in fbs.get(y, ()) else -1 for y, i in zip(G["season"], G["home_team_id"])]
    G["a_id"] = [i if i in fbs.get(y, ()) else -1 for y, i in zip(G["season"], G["away_team_id"])]
    G["margin"] = G["home_score"] - G["away_score"]
    G["site"] = np.where(G["neutral_site"], 0, 1)
    return G, T


def panel(G, T):
    """One row per offense-in-a-game: the metric values that offense produced, who it faced, and where."""
    g = G[["game_id", "season", "day", "home_team", "away_team", "h_id", "a_id", "site"]]
    P = T.merge(g, on=["game_id", "season"], how="inner")
    home = P["team"] == P["home_team"]
    P["o"] = np.where(home, P["h_id"], P["a_id"]); P["d"] = np.where(home, P["a_id"], P["h_id"])
    P["s"] = np.where(home, 1, -1) * P["site"]
    return P


def fit(P, metric, cutoff, hl, lam, teams):
    """Weighted ridge for one metric using games before `cutoff`. Returns (O, D, h, mu) as dicts/values."""
    q = P[(P["day"] < cutoff) & P[metric].notna() & (P["o"] != P["d"])]
    if len(q) < 200: return None
    idx = {t: i for i, t in enumerate(teams)}
    n, k = len(q), len(teams)
    oi, di = q["o"].map(idx).values, q["d"].map(idx).values
    rows = np.arange(n)
    X = sp.csr_matrix((np.ones(n * 2 + n), (np.r_[rows, rows, rows], np.r_[oi, k + di, np.full(n, 2 * k)])), shape=(n, 2 * k + 2))
    X = X.tolil(); X[:, 2 * k + 1] = q["s"].values.reshape(-1, 1); X = X.tocsr()
    # columns: O (k), D (k), intercept, site
    X = sp.csr_matrix(X)
    w = 0.5 ** ((cutoff - q["day"].values) / hl)
    y = q[metric].values
    W = sp.diags(w)
    A = (X.T @ W @ X).toarray()
    reg = np.full(2 * k + 2, lam); reg[2 * k:] = 1e-6                  # do not shrink the intercept or the site term
    A += np.diag(reg)
    b = X.T @ (w * y)
    beta = np.linalg.solve(A, b)
    O, D = beta[:k], beta[k:2 * k]
    O = O - O[idx.get(-1, 0)] * 0                                     # keep as is; the ridge centers teams on average
    return O, D, beta[2 * k + 1], beta[2 * k], idx


def strengths(P, teams, cutoff, hl, lam, metrics=METRICS):
    out = {}
    for m in metrics:
        r = fit(P, m, cutoff, hl, lam, teams)
        if r is None: return None
        O, D, h, mu, idx = r
        out[m] = (O, D, h, idx)
    return out


def games_features(G, P, hl, lam, metrics=METRICS, y0=2015):
    """For every finished game from y0 on, the pre-game strength of both teams in each metric (fit on earlier games only)."""
    teams = sorted(set(P["o"]) | set(P["d"]))
    G = G[(G["season"] >= y0)].copy()
    G["wk"] = G["date"].dt.to_period("W-SUN").astype(str)
    rows = []
    for wk, grp in G.groupby("wk"):
        cut = grp["day"].min()
        S = strengths(P, teams, cut, hl, lam, metrics)
        if S is None: continue
        for _, g in grp.iterrows():
            f = {"game_id": g["game_id"]}
            for m, (O, D, h, idx) in S.items():
                ih, ia = idx.get(g["h_id"]), idx.get(g["a_id"])
                if ih is None or ia is None: break
                f[m + "_h"] = O[ih] - D[ih]; f[m + "_a"] = O[ia] - D[ia]
                f[m + "_off_h"], f[m + "_def_h"], f[m + "_off_a"], f[m + "_def_a"] = O[ih], D[ih], O[ia], D[ia]
                f[m + "_site"] = h
            else:
                rows.append(f)
    return pd.DataFrame(rows)


def ols(X, y, lam=1e-6):
    X1 = np.c_[np.ones(len(X)), X]
    return np.linalg.solve(X1.T @ X1 + lam * np.eye(X1.shape[1]), X1.T @ y)


def report(name, pred, d):
    err = d["margin"].values - pred
    win = ((pred > 0) == (d["margin"].values > 0))
    return f"{name:<34} MAE {np.abs(err).mean():5.2f}  RMSE {math.sqrt((err**2).mean()):5.2f}  winners {win.mean()*100:5.1f}%  (n={len(d)})"


def main():
    G, T = load(); P = panel(G, T)
    hl = float(os.environ.get("HL", 240)); lam = float(os.environ.get("LAM", 30))
    F = games_features(G, P, hl, lam)
    D = G.merge(F, on="game_id", how="inner")
    D = D[D["margin"].notna() & (D["h_id"] != -1) & (D["a_id"] != -1)].copy()             # FBS vs FBS, finished
    D["mkt"] = -D["spread"]
    D["elo"] = D["home_team_pregame_elo"] - D["away_team_pregame_elo"]
    for m in METRICS: D["f_" + m] = D[m + "_h"] - D[m + "_a"]
    D["f_site"] = D["site"]
    feats = ["f_" + m for m in METRICS] + ["f_site"]
    D = D[D["elo"].notna()].copy() if os.environ.get("ELO") else D
    if os.environ.get("ELO"): feats = feats + ["elo"]
    print(f"half-life {hl:.0f} days, ridge {lam:g}; FBS-vs-FBS games with ratings: {len(D)}")
    print("\nWalk-forward: each season is predicted by betas fit on all earlier seasons (2015+)")
    res = []
    for y in range(2018, 2027):
        tr, te = D[D["season"] < y], D[D["season"] == y]
        te = te[te["mkt"].notna()]
        if len(te) < 100: continue
        b = ols(tr[feats].values, tr["margin"].values)
        p = np.c_[np.ones(len(te)), te[feats].values] @ b
        res.append(te.assign(p_model=p))
    R = pd.concat(res)
    print(report("Market closing line", R["mkt"].values, R))
    print(report("Our efficiency ratings", R["p_model"].values, R))
    e = R[R["elo"].notna()]
    be = ols(D[D["elo"].notna()][["elo", "f_site"]].values, D[D["elo"].notna()]["margin"].values)
    print(report("Pregame Elo only (in-sample fit)", np.c_[np.ones(len(e)), e[["elo", "f_site"]].values] @ be, e))
    # does the model know something the market does not?  margin = a + b*market + c*model
    Z = np.c_[np.ones(len(R)), R["mkt"].values, R["p_model"].values]
    cf = np.linalg.lstsq(Z, R["margin"].values, rcond=None)[0]
    res_ = R["margin"].values - Z @ cf
    se = np.sqrt(np.diag(np.linalg.inv(Z.T @ Z)) * (res_ ** 2).sum() / (len(R) - 3))
    print(f"\nmargin = {cf[0]:.2f} + {cf[1]:.2f}*market + {cf[2]:.2f}*model   (t: market {cf[1]/se[1]:.1f}, model {cf[2]/se[2]:.1f})")
    blend = Z @ cf
    print(report("Market + our model blend", blend, R))
    R["wkn"] = R["week"].clip(upper=14)
    print("\nBy week of season (MAE market / model):")
    for w, g in R.groupby("wkn"):
        print(f"  wk {int(w):>2}: {np.abs(g['margin']-g['mkt']).mean():5.2f} / {np.abs(g['margin']-g['p_model']).mean():5.2f}   n={len(g)}") if os.environ.get("WK") else None
    print("\nBy season (MAE market / model):")
    for y, g in R.groupby("season"):
        print(f"  {y}: {np.abs(g['margin']-g['mkt']).mean():5.2f} / {np.abs(g['margin']-g['p_model']).mean():5.2f}   n={len(g)}")
    if "--save" in sys.argv:
        R.to_parquet(os.path.join(DIR, "backtest.parquet"))


if __name__ == "__main__":
    main()
