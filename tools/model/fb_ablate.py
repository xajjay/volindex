"""
The Vol Index - which metrics earn their place?
===============================================
Builds opponent-adjusted strengths for every candidate metric once, then tests feature groups in the same walk-forward
backtest (each season predicted from betas fit on earlier seasons only) and prints how much each group changes the average
miss against the real margin.  A group stays in the model only if it helps out of sample.

    python tools/model/fb_ablate.py            # takes a few minutes
"""
import os, sys, math
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fb_ratings as FR

GROUPS = {
    "base": ["c_epa", "c_succ", "c_expl", "c_rush_epa", "c_pass_epa", "pts_per_drive"],
    "havoc": ["c_havoc"],
    "run quality": ["c_stuff", "c_line_y", "c_opp4"],
    "pass quality": ["c_ypa", "c_sack_rate", "c_int_rate"],
    "field position": ["start_yd", "avail_yds", "pts_per_opp"],
    "down splits": ["c_early_epa", "c_late_epa", "c_d3l_epa", "c_d4_epa"],
    "game state": ["c_lead_epa", "c_trail_epa", "c_one_epa"],
    "special teams": ["ko_epa", "pt_epa", "fg_epa"],
    "tempo": ["c_dt", "c_pass_rate", "c_proe"],
    "explosive split": ["c_nonexpl_epa", "c_expl_epa"],
}
ALL = sorted({m for g in GROUPS.values() for m in g})
CACHE = os.path.join(FR.DIR, "ablate_features.parquet")


def build(hl=240, lam=20):
    G, T = FR.load()
    for m in ["ko_epa", "pt_epa", "fg_epa"]:                        # kicking-team numbers: per game, scaled to per-game points
        T[m] = T[m]
    P = FR.panel(G, T)
    F = FR.games_features(G, P, hl, lam, metrics=ALL)
    D = G.merge(F, on="game_id", how="inner")
    D = D[D["margin"].notna() & (D["h_id"] != -1) & (D["a_id"] != -1)].copy()
    for m in ALL: D["f_" + m] = D[m + "_h"] - D[m + "_a"]
    keep = ["game_id", "season", "week", "margin", "spread", "site", "home_team_pregame_elo", "away_team_pregame_elo"] + ["f_" + m for m in ALL]
    D[keep].to_parquet(CACHE)
    return D[keep]


def ridge(X, y, lam):
    X1 = np.c_[np.ones(len(X)), X]
    pen = np.eye(X1.shape[1]) * lam; pen[0, 0] = 0
    return np.linalg.solve(X1.T @ X1 + pen, X1.T @ y)


def walk(D, feats, lam=50.0, y0=2018):
    out = []
    for y in range(y0, 2027):
        tr, te = D[(D["season"] < y)], D[(D["season"] == y)]
        te = te[te["spread"].notna()]
        if len(te) < 100: continue
        mu, sd = tr[feats].mean(), tr[feats].std().replace(0, 1)
        b = ridge(((tr[feats] - mu) / sd).values, tr["margin"].values, lam)
        out.append(te.assign(p=np.c_[np.ones(len(te)), ((te[feats] - mu) / sd).values] @ b))
    R = pd.concat(out)
    return R, np.abs(R["margin"] - R["p"]).mean(), math.sqrt(((R["margin"] - R["p"]) ** 2).mean())


def main():
    D = pd.read_parquet(CACHE) if os.path.exists(CACHE) and "--rebuild" not in sys.argv else build()
    D["elo"] = D["home_team_pregame_elo"] - D["away_team_pregame_elo"]
    D = D[D["elo"].notna()].copy()
    mkt = D[(D["season"] >= 2018) & D["spread"].notna()]
    print(f"{len(D)} games with ratings and Elo; market closing-line MAE on the test seasons: {np.abs(mkt['margin'] + mkt['spread']).mean():.3f}\n")
    base = ["f_" + m for m in GROUPS["base"]] + ["site", "elo"]
    R, mae0, rm0 = walk(D, base)
    print(f"{'base (6 metrics + site + Elo)':<34} MAE {mae0:.3f}  RMSE {rm0:.3f}")
    print("\nAdd one group at a time:")
    gains = {}
    for g, cols in GROUPS.items():
        if g == "base": continue
        _, mae, rm = walk(D, base + ["f_" + c for c in cols])
        gains[g] = mae0 - mae
        print(f"  + {g:<18} MAE {mae:.3f}  ({mae0 - mae:+.3f})  RMSE {rm:.3f}")
    keep = [g for g, v in gains.items() if v > 0.01]
    allf = base + ["f_" + c for g in keep for c in GROUPS[g]]
    R, mae, rm = walk(D, allf)
    print(f"\nBase + helpful groups {keep}: MAE {mae:.3f}  RMSE {rm:.3f}")
    allf2 = base + ["f_" + c for g, cols in GROUPS.items() if g != "base" for c in cols]
    for lam in (20, 50, 150, 400):
        _, mae2, rm2 = walk(D, allf2, lam)
        print(f"  everything, ridge {lam:>3}: MAE {mae2:.3f}  RMSE {rm2:.3f}")
    # blend with the market
    Z = np.c_[np.ones(len(R)), -R["spread"].values, R["p"].values]
    cf = np.linalg.lstsq(Z, R["margin"].values, rcond=None)[0]
    res = R["margin"].values - Z @ cf
    se = np.sqrt(np.diag(np.linalg.inv(Z.T @ Z)) * (res ** 2).sum() / (len(R) - 3))
    print(f"\nmargin = {cf[0]:.2f} + {cf[1]:.2f}*market + {cf[2]:.2f}*model  (t: market {cf[1] / se[1]:.1f}, model {cf[2] / se[2]:.1f})")
    print(f"market alone {np.abs(R['margin'] + R['spread']).mean():.3f}; market + model blend {np.abs(res).mean():.3f}")
    # late-season view
    L = R[R["week"] >= 10]
    print(f"Weeks 10+: market {np.abs(L['margin'] + L['spread']).mean():.3f}, model {np.abs(L['margin'] - L['p']).mean():.3f}  (n={len(L)})")


if __name__ == "__main__":
    main()
