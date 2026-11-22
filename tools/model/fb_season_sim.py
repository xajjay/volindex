"""Season Monte Carlo for Tennessee's projected record, win-out, conference title, playoff and national-title odds.
Uses our own power ratings (raw model scale) and the remaining FBS schedule from the CFBD games cache.
Selection: 12-team field = 5 highest-ranked conference champions + 7 at-large, ranked by a committee proxy
(power rating + a win-loss term fitted to the current committee top 25), seeded 1-12 in order; neutral-site games after round 1."""
import os, numpy as np, pandas as pd
from math import erf, sqrt
CF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cache", "fbm", "cfbd")
HFA_FALLBACK = 2.47; FCS_PW = -18.0

def _phi(x): return 0.5 * (1 + erf(x / sqrt(2)))

def proxy_weight(power, wl, cfp_top):
    """Pick w so rank by (power + w*(W-L)) best matches the committee's current top 25 (Spearman)."""
    best, bw = -9, 1.0
    for w in np.arange(0, 4.01, 0.25):
        sc = {t: power[t] + w * wl.get(t, 0) for t in power}
        order = sorted(sc, key=lambda t: -sc[t]); pos = {t: i for i, t in enumerate(order)}
        x = [pos[t] for _, t in cfp_top if t in pos]; y = [i for i, (_, t) in enumerate(cfp_top) if t in pos]
        c = np.corrcoef(x, y)[0, 1]
        if c > best: best, bw = c, w
    return bw, best

def run(power_raw, season, cfp_top, b0, sd, hfa=HFA_FALLBACK, team="Tennessee", n=20000, seed=7, force=None, tally=None, cfp_thru=None):
    """force: optional {opponent: "W"|"L"} to condition the team's remaining games (what-if scenarios).
    cfp_thru: last regular-season week the committee ranking already counted (e.g. 11 for the "Week 12" release). Given it, the committee order is the baseline: every ranked team keeps its committee slot, unranked teams stay below #25, and only results after that release move teams.
    tally: optional dict; when given it is filled with per-team counts (field, bye, seed histogram, semifinal, title, champ, avg wins) over all sims."""
    force = force or ({k: v for k, v in (x.split(":") for x in os.environ["VI_FORCE"].split(","))} if os.environ.get("VI_FORCE") else {})
    g = pd.read_parquet(os.path.join(CF, "games.parquet")); g = g[(g.season == season) & (g.seasonType == "regular")]
    fbs = lambda c: str(c).lower() == "fbs"
    g = g[g.homeClassification.map(fbs) | g.awayClassification.map(fbs)].copy()
    done = g[g.completed == True]; todo = g[g.completed != True]
    teams = sorted(power_raw); idx = {t: i for i, t in enumerate(teams)}; nT = len(teams)
    conf = {}
    for _, r in g.iterrows():
        if fbs(r.homeClassification) and pd.notna(r.homeConference): conf[r.homeTeam] = r.homeConference
        if fbs(r.awayClassification) and pd.notna(r.awayConference): conf[r.awayTeam] = r.awayConference
    W = np.zeros(nT); L = np.zeros(nT); CW = np.zeros(nT); CL = np.zeros(nT)
    for _, r in done.iterrows():
        h, a = r.homeTeam, r.awayTeam; hw = r.homePoints > r.awayPoints
        for t, win in ((h, hw), (a, not hw)):
            if t in idx:
                (W if win else L)[idx[t]] += 1
                if r.conferenceGame: (CW if win else CL)[idx[t]] += 1
    rng = np.random.default_rng(seed)
    P = np.array([power_raw[t] for t in teams])
    # remaining games: arrays of (home idx or -1 for FCS, away idx, neutral, conf)
    gm = []
    for _, r in todo.iterrows():
        h, a = r.homeTeam, r.awayTeam
        if h not in idx and a not in idx: continue
        gm.append((idx.get(h, -1), idx.get(a, -1), bool(r.neutralSite), bool(r.conferenceGame)))
    ph = np.zeros(len(gm)); H = np.array([x[0] for x in gm]); A = np.array([x[1] for x in gm]); N = np.array([x[2] for x in gm]); C = np.array([x[3] for x in gm])
    rh = np.where(H >= 0, P[np.maximum(H, 0)], FCS_PW); ra = np.where(A >= 0, P[np.maximum(A, 0)], FCS_PW)
    mu = rh - ra + b0 + np.where(N, 0, hfa)
    pwin_h = np.array([_phi(m / sd) for m in mu])
    for k, x in enumerate(gm):
        if force and (x[0] == idx[team] or x[1] == idx[team]):
            o = x[1] if x[0] == idx[team] else x[0]; res = force.get(teams[o] if o >= 0 else "")
            if res: pwin_h[k] = float((res == "W") == (x[0] == idx[team]))
    cur_wl = {t: W[idx[t]] - L[idx[t]] for t in teams}
    if cfp_thru is None:
        base_wl = cur_wl
    else:
        bw_ = {t: 0.0 for t in teams}
        for _, r in done[done.week <= cfp_thru].iterrows():
            hw = r.homePoints > r.awayPoints
            for t, win in ((r.homeTeam, hw), (r.awayTeam, not hw)):
                if t in bw_: bw_[t] += 1 if win else -1
        base_wl = bw_
    w, corr = proxy_weight(power_raw, base_wl, cfp_top)
    rk = np.zeros(nT)
    if cfp_thru is not None:       # committee baseline: re-deal the ranked teams' own scores in committee order; cap unranked teams just under #25
        m0 = {t: power_raw[t] + w * base_wl.get(t, 0) for t in teams}
        ranked = [t for _, t in sorted(cfp_top) if t in idx]
        vals = sorted((m0[t] for t in ranked), reverse=True)
        for v, t in zip(vals, ranked): rk[idx[t]] = v - m0[t]
        s25 = vals[-1]
        for t in teams:
            if t not in ranked: rk[idx[t]] = min(0.0, s25 - 0.5 - m0[t])
    ut = idx[team]; out = dict(wins=0.0, winOut=0, conf=0, playoff=0, mk=0, nc=0); wins_hist = []
    confs = sorted(set(conf.values())); members = {c: [idx[t] for t in teams if conf.get(t) == c] for c in confs}
    if tally is not None:
        for k_ in ("field", "bye", "sf", "nc", "champ", "wins"): tally[k_] = np.zeros(nT)
        tally["seed"] = np.zeros((nT, 12)); tally["teams"] = teams; tally["n"] = n; tally["w0"] = W.copy(); tally["l0"] = L.copy()
    remaining_ut = [(k, x) for k, x in enumerate(gm) if x[0] == ut or x[1] == ut]
    for s in range(n):
        r = rng.random(len(gm)) < pwin_h
        w_ = W.copy(); l_ = L.copy(); cw = CW.copy(); cl = CL.copy()
        for k in range(len(gm)):
            h, a = H[k], A[k]; hw = r[k]
            if h >= 0: (w_ if hw else l_)[h] += 1
            if a >= 0: (l_ if hw else w_)[a] += 1
            if C[k]:
                if h >= 0: (cw if hw else cl)[h] += 1
                if a >= 0: (cl if hw else cw)[a] += 1
        out["wins"] += w_[ut]
        if all((r[k] if x[0] == ut else not r[k]) for k, x in remaining_ut): out["winOut"] += 1
        # conference championship games: top two by conference win pct (random tiebreak)
        champs = {}
        for c, m in members.items():
            if len(m) < 2: 
                if len(m) == 1: champs[c] = m[0]
                continue
            pct = np.array([cw[i] / max(1, cw[i] + cl[i]) for i in m]) + rng.random(len(m)) * 1e-3
            top = [m[i] for i in np.argsort(-pct)[:2]]
            d = P[top[0]] - P[top[1]]
            champs[c] = top[0] if rng.random() < _phi(d / sd) else top[1]
            w_[champs[c]] += 1; l_[top[0] if champs[c] == top[1] else top[1]] += 1
            if ut in top and champs[c] == ut: out["conf"] += 1
        score = P + w * (w_ - l_) + rk
        order = list(np.argsort(-score)); champset = set(champs.values())
        cc = [i for i in order if i in champset][:5]
        rest = [i for i in order if i not in cc][:7]; field = sorted(cc + rest, key=lambda i: -score[i])
        if ut in field: out["playoff"] += 1
        if tally is not None:
            tally["wins"] += w_
            for c_ in champset: tally["champ"][c_] += 1
            for sd_, t_ in enumerate(field): tally["field"][t_] += 1; tally["seed"][t_, sd_] += 1; tally["bye"][t_] += sd_ < 4
        elif ut not in field: continue
        # bracket (straight seeding)
        def play(a, b, neutral=True, home=None):
            d = P[a] - P[b] + (0 if neutral else (hfa if home == a else -hfa))
            return a if rng.random() < _phi(d / sd) else b
        s_ = field
        r1 = {5: play(s_[4], s_[11], False, s_[4]), 6: play(s_[5], s_[10], False, s_[5]), 7: play(s_[6], s_[9], False, s_[6]), 8: play(s_[7], s_[8], False, s_[7])}
        q = [play(s_[0], r1[8]), play(s_[1], r1[7]), play(s_[2], r1[6]), play(s_[3], r1[5])]
        sf = [play(q[0], q[3]), play(q[1], q[2])]
        ch_ = play(sf[0], sf[1])
        if tally is not None:
            for t_ in sf: tally["sf"][t_] += 1
            tally["nc"][ch_] += 1
        if ut in field:
            out["mk"] += ut in sf
            out["nc"] += ch_ == ut
    pc = lambda x: round(100 * x / n, 1)
    return dict(proj=f"{out['wins']/n:.1f}-{(len(done[(done.homeTeam==team)|(done.awayTeam==team)])+len(remaining_ut))-out['wins']/n:.1f}",
                winOut=pc(out["winOut"]), winConf=pc(out["conf"]), playoff=pc(out["playoff"]), makeNC=pc(out["mk"]), winNC=pc(out["nc"]),
                n=n, proxyW=float(w), proxyCorr=round(float(corr), 3), source="Vol Index model simulation")
