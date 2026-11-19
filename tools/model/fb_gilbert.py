"""Vol Index layers on Gilbert's power rating (rating = avg opp rating + avg margin, Point-Jacobi, mean 100).
Walk-forward backtest of each upgrade, then current-season layered ratings.  Usage: python fb_gilbert.py [bt|now]"""
import os, sys, json, numpy as np, pandas as pd
D = os.path.join(os.path.dirname(__file__), "..", "cache", "fbm")
G = pd.read_parquet(f"{D}/games.parquet")
G = G[G.home_score.notna() & G.away_score.notna() & G.home_team.notna()].copy()
G["m"] = G.home_score - G.away_score
G["neu"] = G.neutral_site.fillna(False).astype(bool)
G["fbs"] = (G.home_team_division == "fbs") & (G.away_team_division == "fbs")
TAL = pd.read_parquet(f"{D}/cfbd/talent.parquet").drop_duplicates(["season", "team"]).set_index(["season", "team"])["talent"]
CTX = pd.read_parquet(f"{D}/context_features.parquet")

def gilbert(g, hfa=0.0, cap=None, k=0.0, prior=None, iters=400):
    """g: games before cutoff (home_team, away_team, m, neu).  hfa: subtract from home margin (non-neutral).
    cap: winsorise margins.  k: pseudo-games shrinking toward prior (0 = Gilbert exactly)."""
    teams = pd.unique(g[["home_team", "away_team"]].values.ravel()); ix = {t: i for i, t in enumerate(teams)}
    h = g.home_team.map(ix).values; a = g.away_team.map(ix).values
    m = g.m.values - np.where(g.neu.values, 0, hfa)
    if cap: m = np.clip(m, -cap, cap)
    n = len(teams); deg = np.bincount(h, minlength=n) + np.bincount(a, minlength=n)
    p = np.zeros(n) if prior is None else np.array([prior.get(t, 0.0) for t in teams])
    r = p.copy()
    for _ in range(iters):  # Point Jacobi, centred ratings (add 100 for his scale)
        s = np.bincount(h, m + r[a], n) + np.bincount(a, -m + r[h], n) + k * p
        new = s / np.maximum(deg + k, 1e-9); new -= new.mean()
        if np.abs(new - r).max() < 1e-7: r = new; break
        r = new
    return dict(zip(teams, r))

def est_hfa(g, r):
    d = g[~g.neu]; return float((d.m - d.home_team.map(r) + d.away_team.map(r)).mean())

def season_walk(y, variant, prev=None, wmin=4):
    S = G[(G.season == y)]; out = []
    for w in sorted(S.week.unique()):
        if w < wmin: continue
        tr = S[(S.week < w)]; te = S[(S.week == w) & S.fbs]
        if len(tr) < 100 or te.empty: continue
        r, h = variant(tr, prev)
        te = te.copy(); te["rh"] = te.home_team.map(r); te["ra"] = te.away_team.map(r); te = te.dropna(subset=["rh", "ra"])
        te["pred"] = te.rh - te.ra + np.where(te.neu, 0, h); te["hfa"] = h; out.append(te)
    return pd.concat(out) if out else pd.DataFrame()

# variants -> (ratings, hfa)
def V0(tr, prev):  # Gilbert exactly: no HFA in fit, +3 in picks
    return gilbert(tr), 3.0
def V1(tr, prev):  # + HFA in fit & neutral handled (estimated jointly)
    r = gilbert(tr); h = est_hfa(tr, r)
    for _ in range(3): r = gilbert(tr, h); h = est_hfa(tr, r)
    return r, h
def V2(tr, prev):  # + margin cap 28
    r, h = gilbert(tr), 2.5
    for _ in range(3): r = gilbert(tr, h, cap=28); h = est_hfa(tr, r)
    return r, h
def mk(k, carry):
    def V(tr, prev):
        p = {t: carry * v for t, v in (prev or {}).items()}; h = 2.5; r = None
        for _ in range(3): r = gilbert(tr, h, cap=28, k=k, prior=p); h = est_hfa(tr, r)
        return r, h
    return V

def prev_final(y):
    S = G[(G.season == y)]; 
    if S.empty: return None
    r = gilbert(S, 2.5, cap=28, k=1.0); return r

def score(df): 
    e = df.m - df.pred; return round(e.abs().mean(), 3), round(((df.pred > 0) == (df.m > 0)).mean() * 100, 1), len(df)

def bt():
    years = list(range(2016, 2026)); years.remove(2020)
    res = {}
    for name, V in [("G0 Gilbert (+3 HFA)", V0), ("G1 +HFA in fit/neutral", V1), ("G2 +margin cap 28", V2)] + [(f"G3 +prior k={k} carry={c}", mk(k, c)) for k, c in [(3, .6), (5, .6), (5, .8), (8, .8)]]:
        dfs = []
        for y in years:
            pv = prev_final(y - 1) if "prior" in name else None
            d = season_walk(y, V, pv); d["y"] = y; dfs.append(d)
        df = pd.concat(dfs); res[name] = df; print(f"{name:<28} MAE/winners/n {score(df)}  hfa~{df.hfa.mean():.2f}", flush=True)
    return res

if __name__ == "__main__":
    if (sys.argv[1:] or ["bt"])[0] == "bt": bt()
