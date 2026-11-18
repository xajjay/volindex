"""
The Vol Index - football projection report  ->  data/model-fb.js  (window.MODEL_FB)
==================================================================================
For every unplayed Tennessee game: both teams' ratings and tendencies, how they compare metric by metric (with what each edge is
worth in points), team-specific home field, availability costs, preseason context, and the dials the play-by-play simulation uses
so a simulated game looks like how the two teams actually play (pass rate, pace, explosiveness).

    python tools/model/fb_report.py [Tennessee]
"""
import os, sys, re, json, math
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fb_ratings as FR
import fb_hfa as HF
import fb_ablate as AB
import fb_matchup as MU_

TEAM = "Tennessee"
SD = 15.7
UR = ["pass", "rush", "recv"]
UW = {"pass": 1.0, "rush": 0.5, "recv": 0.5}      # one combined production score: a passer counts double a runner or a receiving group
MXC = os.path.join(FR.DIR, "matchup_features.parquet")
CF = os.path.join(FR.DIR, "cfbd")

# label, column, higher is better for the offense, decimals, scale (x100 = percent)
ROWS = [
    ("EPA per play", "c_epa", 1, 3, 1), ("Success rate", "c_succ", 1, 1, 100), ("Explosive play rate", "c_expl", 1, 1, 100),
    ("Rush EPA per play", "c_rush_epa", 1, 3, 1), ("Pass EPA per play", "c_pass_epa", 1, 3, 1), ("Points per drive", "pts_per_drive", 1, 2, 1),
    ("Early-down success", "c_early_succ", 1, 1, 100), ("Third-down conversion", "c_conv3", 1, 1, 100), ("Red-zone EPA per play", "c_rz_epa", 1, 3, 1),
    ("Sack rate (taken / made)", "c_sack_rate", -1, 1, 100), ("Stuff rate (runs for loss)", "c_stuff", -1, 1, 100), ("Line yards per carry", "c_line_y", 1, 2, 1),
    ("Starting field position (yd)", "start_yd", 1, 1, 1), ("Turnovers per game", "turnovers", -1, 2, 1), ("Penalties per game", "pen_n", -1, 1, 1),
]
STYLE = [("Pass rate", "c_pass_rate", 100, 1), ("Pass rate over expected", "c_proe", 100, 1), ("Plays per game", "c_plays", 1, 1), ("Seconds per play", "c_dt", 1, 1),
         ("Drives per game", "drives", 1, 1), ("Time of possession (min)", "top_secs", 1 / 60, 1)]


def season_table(T, season, teams):
    t = T[(T["season"] == season) & (T["team"].isin(teams))].copy()
    cols = [r[1] for r in ROWS] + [s[1] for s in STYLE]
    cols = [c for c in dict.fromkeys(cols) if c in t.columns]
    opp = T[T["season"] == season][["game_id", "team"] + cols].rename(columns={"team": "opp"})
    d = t[["game_id", "team", "opp"]].merge(opp, on=["game_id", "opp"], suffixes=("", "_x"))
    off = t.groupby("team")[cols].mean()
    de = d.groupby("team")[[c for c in cols]].mean()
    n = t.groupby("team")["game_id"].nunique()
    return off, de, n


def main():
    hl, lam = 240, 20
    G, T = FR.load(); P = FR.panel(G, T)
    teams = sorted(set(P["o"]) | set(P["d"]))
    names = {}
    for side in ("home", "away"):
        for i, n in zip(G[f"{side}_team_id"], G[f"{side}_team"]): names[i] = n
    season = int(G["season"].max()); cut = int(P["day"].max()) + 1
    S = FR.strengths(P, teams, cut, hl, lam); idx = S[FR.METRICS[0]][3]
    D, H, mu = HF.home_edges(hl, lam)
    # margin model: six opponent-adjusted efficiency strengths + site + team talent + returning production (no Elo, no records, no polls, no market)
    Dm = pd.read_parquet(AB.CACHE).merge(G[["game_id", "home_team", "away_team"]], on="game_id")
    tal = pd.read_parquet(os.path.join(CF, "talent.parquet")).drop_duplicates(["season", "team"]).set_index(["season", "team"])["talent"]
    ret = pd.read_parquet(os.path.join(CF, "returning.parquet")).drop_duplicates(["season", "team"]).set_index(["season", "team"])["percentPPA"]
    gv = lambda ser, side: np.array([ser.get((a, t), np.nan) for a, t in zip(Dm["season"], Dm[side + "_team"])])
    Dm["f_talent"] = (gv(tal, "home") - gv(tal, "away")) / 100; Dm["f_ret"] = gv(ret, "home") - gv(ret, "away")
    Dm = Dm.dropna(subset=["f_talent"]).copy(); Dm["f_ret"] = Dm["f_ret"].fillna(0)
    early = (Dm["week"] <= 4).astype(float)
    MX = pd.read_parquet(MXC)[["game_id"] + [f"u_{r}_{s}" for r in UR for s in "ha"]].drop_duplicates("game_id")            # player production, from fb_matchup.py
    Dm = Dm.merge(MX, on="game_id", how="left")
    for r_ in UR: Dm["f_u_" + r_] = (Dm[f"u_{r_}_h"] - Dm[f"u_{r_}_a"]).fillna(0)
    Dm["f_u_all"] = sum(UW[r_] * Dm["f_u_" + r_] for r_ in UR)
    early = (Dm["week"] <= 4).astype(float).values
    X = np.c_[Dm[["f_" + m for m in FR.METRICS] + ["site", "f_talent", "f_ret"]].values, Dm["f_talent"].values * early, Dm["f_ret"].values * early, Dm[["f_u_all"]].values]
    b = FR.ols(X, Dm["margin"].values)

    hfa = pd.read_csv(os.path.join(FR.DIR, "hfa_teams.csv"), index_col=0)["hfa"]
    fbs = [names[t] for t in teams if t != -1 and t in names]
    TAL = {t: float(tal.get((season, t), np.nan)) for t in fbs}; RET = {t: float(ret.get((season, t), np.nan)) for t in fbs}
    tm, rm = np.nanmean(list(TAL.values())), np.nanmean(list(RET.values()))
    TAL = {k: (tm if np.isnan(v) else v) for k, v in TAL.items()}; RET = {k: (rm if np.isnan(v) else v) for k, v in RET.items()}
    off, de, ng = season_table(T, season, fbs)
    cur = [t for t in fbs if t in ng.index and ng[t] >= 7]
    inv = {v: k for k, v in names.items()}

    MU = {m: FR.fit(P, m, cut, hl, lam, teams)[3] for m in ("c_expl", "pts_per_drive")}

    def st(team, m): O, Dd, _, ix = S[m]; return float(O[ix[inv[team]]] - Dd[ix[inv[team]]])
    NM = len(FR.METRICS)
    CU = MU_.current_units(G)
    ub = {r_: float(b[NM + 6]) * UW[r_] for r_ in UR}
    um = {r_: float(np.mean([v[0] for (t, rr), v in CU.items() if rr == r_ and t in fbs])) for r_ in UR}
    uval = lambda t, r_: CU.get((t, r_), (um[r_], []))[0]
    prod = lambda t: sum(ub[r_] * (uval(t, r_) - um[r_]) for r_ in UR)
    tr = lambda t: float(b[NM + 2] * (TAL[t] - tm) / 100 + b[NM + 3] * (RET[t] - rm) + prod(t))
    power = {t: sum(b[1 + i] * st(t, m) for i, m in enumerate(FR.METRICS)) + tr(t) for t in cur}
    prank = pd.Series(power).rank(ascending=False).astype(int)

    def rank(col, team, side, better):
        s = (off if side == "o" else de)[col].reindex(cur)
        return int((s > s[team]).sum() + 1) if better > 0 else int((s < s[team]).sum() + 1)

    # preseason / context from CFBD (all labeled informational; the in-season ratings carry the weight)
    ctx = {}
    def pick(f, **kw):
        p = os.path.join(CF, f + ".parquet"); return pd.read_parquet(p) if os.path.exists(p) else None
    tal, ret, rec, sp, fpi = pick("talent"), pick("returning"), pick("recruiting"), pick("sp"), pick("fpi")
    for t in cur:
        c = {}
        try:
            if tal is not None:
                x = tal[(tal["team"] == t) & (tal["year"] == season)]; allx = tal[tal["year"] == season].sort_values("talent", ascending=False)["team"].tolist()
                if len(x): c["talent"] = round(float(x["talent"].iloc[0]), 1); c["talentRank"] = allx.index(t) + 1
            if ret is not None:
                x = ret[(ret["team"] == t) & (ret["season"] == season)]
                if len(x): c["returningPPA"] = round(float(x["percentPPA"].iloc[0]) * 100, 0)
            if rec is not None:
                x = rec[(rec["team"] == t) & (rec["year"] == season)]
                if len(x): c["recruitRank"] = int(x["rank"].iloc[0])
            if sp is not None:
                x = sp[(sp["team"] == t) & (sp["year"] == season)]
                if len(x): c["sp"] = round(float(x["rating"].iloc[0]), 1); c["spRank"] = int(x["ranking"].iloc[0])
            if fpi is not None:
                x = fpi[(fpi["team"] == t) & (fpi["year"] == season)]
                if len(x): c["fpi"] = round(float(x["fpi"].iloc[0]), 1)
        except Exception as e: print("ctx", t, e)
        ctx[t] = c

    avail = {}
    ap = os.path.join(FR.DIR, "availability_adj.json")
    if os.path.exists(ap): avail = json.load(open(ap))
    av = lambda t: (avail.get("teams", {}).get(t) or {"total": 0.0, "rows": []})

    def tend(t):
        out = {}
        for lab, col, sc, dec in STYLE:
            out[col] = round(float(off.loc[t, col]) * sc, dec + 2 if sc == 1 else dec + 1)
        natdt = float(off.loc[cur, "c_dt"].mean()); natpl = float(off.loc[cur, "c_plays"].mean())
        out.update(natDt=round(natdt, 2), natPlays=round(natpl, 1), natPassRate=round(float(off.loc[cur, "c_pass_rate"].mean()) * 100, 1))
        return out

    # opponent-adjusted explosiveness and pace dials for the simulation
    def expl_k(o, d):
        O, Dd, h, ix = S["c_expl"]; m0 = MU["c_expl"]
        return float(np.clip((m0 + O[ix[inv[o]]] + Dd[ix[inv[d]]]) / m0, 0.6, 1.6))

    sched = json.loads(re.search(r"SITE_AUTO\.football\s*=\s*(\{.*\});?\s*$", open(os.path.join(FR.ROOT, "data", "football-auto.js"), encoding="utf-8").read(), re.S).group(1))["schedule"]
    games = []
    for g in sched:
        if g.get("result"): continue
        opp = re.sub(r"^#\d+\s+", "", g["opp"]).strip()
        if opp not in cur or TEAM not in cur: continue
        site = {"H": 1, "A": -1}.get(g["site"], 0)
        f = np.array([st(TEAM, m) - st(opp, m) for m in FR.METRICS])
        tU, tO = float(b[NM + 2] * (TAL[TEAM] - TAL[opp]) / 100), float(b[NM + 3] * (RET[TEAM] - RET[opp]))
        pU = float(prod(TEAM) - prod(opp))
        neutral = float(b[0] + (b[1:1 + NM] * f).sum() + tU + tO + pU)
        homeTeam = TEAM if site == 1 else opp
        h = float(hfa.get(homeTeam, mu)) if site else 0.0
        ok = avail.get("opp") == opp
        au, ao = (av(TEAM)["total"], av(opp)["total"]) if ok else (0.0, 0.0)
        margin = neutral + site * h + au - ao
        edges = [{"k": FR.METRIC_LABELS[m] if hasattr(FR, "METRIC_LABELS") else m, "m": m, "ut": round(st(TEAM, m), 4), "opp": round(st(opp, m), 4), "pts": round(float(b[1 + i] * f[i]), 2)} for i, m in enumerate(FR.METRICS)]
        edges += [{"k": "Team talent composite", "m": "talent", "ut": round(TAL[TEAM], 1), "opp": round(TAL[opp], 1), "pts": round(tU, 2)}, {"k": "Returning production", "m": "ret", "ut": round(RET[TEAM], 2), "opp": round(RET[opp], 2), "pts": round(tO, 2)}]
        LAB = {"pass": "Quarterback production", "rush": "Rushing production", "recv": "Receiver production"}
        for r_ in UR:
            nm = lambda t: (CU.get((t, r_), (0, []))[1] or [("n/a", 0, 0)])[0][0]
            edges.append({"k": LAB[r_], "m": "u_" + r_, "ut": f"{nm(TEAM)} {uval(TEAM, r_) - um[r_]:+.3f}", "opp": f"{nm(opp)} {uval(opp, r_) - um[r_]:+.3f}", "pts": round(ub[r_] * (uval(TEAM, r_) - uval(opp, r_)), 2), "unit": True})
        # points from drives: each side's expected points per drive against the other, times the drives the game will have
        O, Dd, hh, ix = S["pts_per_drive"]; m0 = MU["pts_per_drive"]
        dr = (off.loc[TEAM, "drives"] + off.loc[opp, "drives"]) / 2
        ppU = m0 + O[ix[inv[TEAM]]] + Dd[ix[inv[opp]]]; ppO = m0 + O[ix[inv[opp]]] + Dd[ix[inv[TEAM]]]
        rows = []
        for lab, col, better, dec, sc in ROWS:
            if col not in off.columns: continue
            rows.append({"k": lab, "ut": [round(float(off.loc[TEAM, col]) * sc, dec), rank(col, TEAM, "o", better)], "utD": [round(float(de.loc[TEAM, col]) * sc, dec), rank(col, TEAM, "d", -better)],
                         "opp": [round(float(off.loc[opp, col]) * sc, dec), rank(col, opp, "o", better)], "oppD": [round(float(de.loc[opp, col]) * sc, dec), rank(col, opp, "d", -better)]})
        tu, to = tend(TEAM), tend(opp)
        nat = tu["natDt"]
        natSack = float(off.loc[cur, "c_sack_rate"].mean())
        sackU = float(np.clip(off.loc[TEAM, "c_sack_rate"] + 0.6 * (de.loc[opp, "c_sack_rate"] - natSack), 0.02, 0.13)); sackO = float(np.clip(off.loc[opp, "c_sack_rate"] + 0.6 * (de.loc[TEAM, "c_sack_rate"] - natSack), 0.02, 0.13))
        sim = {"sackU": round(sackU, 4), "sackO": round(sackO, 4), "passU": tu["c_pass_rate"] / 100, "passO": to["c_pass_rate"] / 100, "playsU": tu["c_plays"], "playsO": to["c_plays"],
               "explU": round(expl_k(TEAM, opp), 3), "explO": round(expl_k(opp, TEAM), 3), "dtU": tu["c_dt"], "dtO": to["c_dt"], "natDt": nat}
        games.append({"date": g["date"], "opp": opp, "site": site, "neutral": round(neutral, 2), "hfa": round(site * h, 2), "hfaTeam": homeTeam, "availU": round(au, 2), "availO": round(ao, 2),
                      "margin": round(margin, 2), "sd": SD, "win": round(0.5 * (1 + math.erf(margin / (SD * math.sqrt(2)))), 3),
                      "ptsU": round(float(ppU * dr), 1), "ptsO": round(float(ppO * dr), 1), "drives": round(float(dr), 1), "edges": edges, "rows": rows, "tend": {"ut": tu, "opp": to}, "sim": sim})
        print(f"{g['date']} {opp:<12} neutral {neutral:+5.1f} hfa {site * h:+4.1f} avail {au - ao:+4.1f} -> {margin:+5.1f}  pts {ppU * dr:.0f}-{ppO * dr:.0f}  win {games[-1]['win']:.0%}  explK {sim['explU']}/{sim['explO']}")
    out = {"asOf": pd.Timestamp.today().strftime("%Y-%m-%d"), "season": season, "hl": hl, "lam": lam, "betas": [round(float(x), 3) for x in b], "hfaAvg": round(float(mu), 2), "sd": SD,
           "teams": {t: {"power": round(power[t], 1), "rank": int(prank[t]), "of": len(cur), "ctx": ctx.get(t, {}), "tend": tend(t), "hfa": round(float(hfa.get(t, mu)), 2)} for t in (TEAM, "LSU", "Vanderbilt") if t in cur},
           "powerAll": {t: round(power[t], 1) for t in cur}, "availability": avail, "games": games}
    p = os.path.join(FR.ROOT, "data", "model-fb.js")
    open(p, "w", encoding="utf-8").write("window.MODEL_FB = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("wrote", p, os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()
