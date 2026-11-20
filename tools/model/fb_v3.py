"""Vol Index power rating v3 for the live site.  power = w1*Gilbert(results, schedule; home field removed; talent prior) + w2*talent + w3*efficiency.
Weights are fit once on 2016-2025 (fb_vol_v3.py fit) and cached in tools/cache/fbm/v3_betas.json. Light enough to run on every refresh."""
import os, json, numpy as np, pandas as pd
import fb_gilbert as F
CACHE = os.path.join(F.D, "v3_betas.json")
EFFM = ["c_epa", "c_succ", "c_expl", "c_rush_epa", "c_pass_epa", "pts_per_drive"]
K = 3          # the prior counts as 3 pretend games

def betas():
    if os.path.exists(CACHE): return json.load(open(CACHE))
    import fb_vol_v3 as V
    return V.fit_betas()

def gil_nohfa(g):
    r = F.gilbert(g); h = F.est_hfa(g, r)
    for _ in range(3): r = F.gilbert(g, h); h = F.est_hfa(g, r)
    return r, h

def priors(season):
    """talent prior on the rating scale. Last season's results are used ONLY to learn how many rating points a talent point is worth; no team carries last season's rating."""
    last, _ = gil_nohfa(F.G[F.G.season == season - 1])
    TAL = F.TAL; ts = [t for t in last if (season - 1, t) in TAL.index and (season, t) in TAL.index]
    slope = np.polyfit([TAL[(season - 1, t)] / 100 for t in ts], [last[t] for t in ts], 1)[0]
    xm = np.mean([TAL[(season, t)] for t in ts]) / 100
    pt = {t: slope * (TAL[(season, t)] / 100 - xm) for t in ts}     # this season's talent only; last season's ratings are used only to learn points-per-talent
    return pt, slope

def power_table(B, season, eff_of, cur):
    """eff_of(team, metric) -> opponent-adjusted offense-minus-defense strength. Returns one row per team in `cur` with the components that add to power."""
    S = F.G[F.G.season == season]; wk = int(S.week.max()); early = 1.0 if wk <= 5 else 0.0
    r0, h0 = gil_nohfa(S)
    pt, slope = priors(season)
    S0 = S.assign(m=0.0)
    res = F.gilbert(S, h0, k=K)                      # results and schedule, shrunk toward 0
    tal = F.gilbert(S0, 0.0, k=K, prior=pt)          # what the talent prior contributes (the rating is linear in margins and prior)
    full = F.gilbert(S, h0, k=K, prior=pt)
    w = B["g0"] + B["g0e"] * early
    c = lambda d: np.mean([d[t] for t in cur])
    TAL = F.TAL; tv = {t: TAL.get((season, t), np.nan) for t in cur}; tm = np.nanmean(list(tv.values())); tv = {t: (tm if np.isnan(v) else v) for t, v in tv.items()}
    em = {m: np.mean([eff_of(t, m) for t in cur]) for m in EFFM}
    rows = []
    for t in cur:
        g_res = w * (res[t] - c(res)); g_tal = w * (tal[t] - c(tal))
        t_term = (B["tal"] + B["tale"] * early) * (tv[t] - tm) / 100
        eff = {m: B["e_" + m] * (eff_of(t, m) - em[m]) for m in EFFM}
        rows.append(dict(team=t, results=g_res, talent=g_tal + t_term, efficiency=sum(eff.values()), eff=eff, gilbert_full=w * (full[t] - c(full)), talent_raw=tv[t]))
    R = pd.DataFrame(rows)
    R["power"] = R.results + R.talent + R.efficiency
    R["power"] -= R.power.mean()
    return R, dict(hfa_direct=h0, slope=slope, early=early, week=wk)
