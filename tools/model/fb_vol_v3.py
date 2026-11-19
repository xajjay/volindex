"""Vol Index power rating v3.  python fb_vol_v3.py [fit]   (fit = refit the weights on 2016-2025 and cache them; the live site uses fb_v3.py)"""
import sys, json, os; sys.path.insert(0, '.')
import numpy as np, pandas as pd


def fit_betas():
    import fb_stack2 as S2
    from fb_prior import run
    g = run("both"); d = S2.df.copy(); d["g0"] = d.game_id.map(g); d = d.dropna(subset=["g0"]); d["g0e"] = d.g0 * d.early
    COLS = ["g0", "g0e", "site", "tal", "tale"] + S2.EFF
    X = np.c_[np.ones(len(d)), d[COLS].values]; b = np.linalg.lstsq(X, d.m.values, rcond=None)[0]; B = {k: float(v) for k, v in zip(["b0"] + COLS, b)}
    S2.df = d; r = S2.wf(COLS + ["av"]); B["av"] = float(r[4][-1]); B["backtest"] = {"mae": float(r[0]), "winners": float(r[1]), "rmse": float(r[2]), "games": int(r[3])}
    json.dump(B, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cache", "fbm", "v3_betas.json"), "w"), indent=1)
    return B


if __name__ == "__main__":
    if "fit" in sys.argv: print(json.dumps(fit_betas(), indent=1))
    else: print("usage: python fb_vol_v3.py fit   (ratings are produced by fb_report.py via fb_v3.py)")
