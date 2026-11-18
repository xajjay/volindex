"""
The Vol Index - basketball projection report  ->  data/model-bb.js  (window.MODEL_BB)
=====================================================================================
For men's and women's basketball: every Division I team's power rating (points better than an average D1 team on a neutral
court, from opponent-adjusted efficiency + player production + matchup terms; no records, polls, rankings or betting lines),
and for each unplayed Tennessee game the margin, total, edge table, expected four factors for BOTH teams (they drive the
play-by-play simulation) and the players who carry the production score.

    python tools/model/bb_report.py mbb
    python tools/model/bb_report.py wbb
"""
import os, sys, re, json, math
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bb_model as B

TEAM = "Tennessee"
FEATS = ["f_eff", "f_efg", "f_tov", "f_orb", "f_ftr", "f_site", "f_L", "f_L_early", "m_pace", "m_orb", "m_tov", "m_efg_x_tempo", "m_off_vs_def"]
LABEL = {"f_eff": "Efficiency (points per 100 possessions)", "f_efg": "Shooting (effective FG%)", "f_tov": "Turnover rate", "f_orb": "Offensive rebounding", "f_ftr": "Free-throw rate",
         "f_L": "Player production (lineup score)", "f_L_early": "Player production, early season"}
ALIAS = {}                                                              # ESPN's team names already match utsports' ("LSU", "Ole Miss", "UConn", "NC State")


def norm(x): return re.sub(r"[^a-z0-9 ]+", " ", str(x).lower().replace("&", " and ")).replace(" state", " st").strip()


def main(sport):
    par = B.PAR[sport]
    D, P, G, idx, final, PL = B.frame(sport); D = B.features(D, sport)
    D["early"] = (D.groupby("season")["day"].transform(lambda s: (s - s.min()) <= 28)).astype(float); D["f_L_early"] = D["f_L"] * D["early"]
    mu_, sd_ = D[FEATS].mean(), D[FEATS].std().replace(0, 1)
    b = B.ridge(((D[FEATS] - mu_) / sd_).values, D["margin"].values, 30.0)
    R, mae, rmse, win = B.walk(D, FEATS)
    print(f"{sport}: walk-forward MAE {mae:.3f}, RMSE {rmse:.3f}, winners {win*100:.1f}%  (n={len(R)})")
    raw = pd.Series(b[1:] / sd_.values, index=FEATS)                      # points per unit of each feature

    # current ratings: this season's games on top of last season's final ratings
    ids = sorted(set(P["o"]) | set(P["d"])); k = len(ids)
    Py = P[P["season"] == B.Y1]; cut = int(P["day"].max()) + 1
    S = {}
    for m in B.METRICS:
        prior = np.r_[final[(B.Y1 - 1, m)][0], final[(B.Y1 - 1, m)][1]] if (B.Y1 - 1, m) in final else None
        S[m] = B.fit(Py, m, cut, par["hl"], par["lam"], idx, prior, par["carry"])
    X = B.load(sport)
    X = X[X["season"] == B.Y1]
    names = {}
    for t, n in zip(X["team_id"], X["team_location"]): names[t] = n
    ngames = X.groupby("team_id")["game_id"].nunique()
    cur = [t for t in ids if t != -1 and t in names and ngames.get(t, 0) >= 3 and X[X["team_id"] == t]["d1"].iloc[0]]
    season_start = int(Py["day"].min()) if len(Py) else cut
    today = cut

    def row(h, a, site, day):
        r = {"site": site, "f_site": site}
        for m in B.METRICS:
            O, Dd, hh, mu = S[m]
            r[m + "_Oh"], r[m + "_Dh"] = (O[idx[h]], Dd[idx[h]]) if h in idx else (0.0, 0.0)
            r[m + "_Oa"], r[m + "_Da"] = (O[idx[a]], Dd[idx[a]]) if a in idx else (0.0, 0.0)
            r[m + "_mu"] = mu
        r["L_h"] = Lcur(h); r["L_a"] = Lcur(a); r["day"] = day
        return r

    def Lcur(t):
        rc = PL["recent"].get(t)
        if rc is None: return 0.0
        return float(sum(sh * PL["vals"].get(a, 0.0) for a, sh in rc.items()))

    def predict(rows):
        F = B.features(pd.DataFrame(rows), sport)
        F["early"] = ((F["day"] - season_start) <= 28).astype(float); F["f_L_early"] = F["f_L"] * F["early"]
        z = (F[FEATS] - mu_) / sd_
        return F, b[0] + z.values @ b[1:], z.values * b[1:]

    AVG = -999                                                           # a pseudo team with every rating at zero
    avg_t = {t: 0 for t in cur}
    rows = []
    for t in cur:
        r = row(t, AVG, 0, today)
        rows.append(r)
    F, pw, contrib = predict(rows)
    power = dict(zip(cur, [float(x) for x in pw]))
    rank = pd.Series(power).rank(ascending=False).astype(int)
    O_eff, D_eff, _, mu_eff = S["eff"]; O_t, D_t, _, mu_t = S["tempo"]
    powerAll = {names[t]: [round(power[t], 1), round(float(O_eff[idx[t]]), 1), round(float(D_eff[idx[t]]), 1), round(float(mu_t + O_t[idx[t]] + D_t[idx[t]]), 1)] for t in cur}   # power, adj. offense, adj. defense (positive = allows more), tempo

    # Tennessee's schedule
    ut = [t for t in cur if names[t] == TEAM][0]
    nmap = {}
    for t in cur: nmap.setdefault(norm(names[t]), t)
    sched = json.loads(re.search(r"SITE_AUTO\[?['\"]?%s['\"]?\]?\s*=\s*(\{.*\});?\s*$" % sport, open(os.path.join(B.ROOT, "data", f"{sport}-auto.js"), encoding="utf-8").read(), re.S).group(1))["schedule"]
    d0 = pd.Timestamp("2013-01-01")
    nameOf = lambda a: B_name(PL, a)

    def B_name(PL, a): return PL["names"].get(a, str(a))
    games, missing = [], []
    for g in sched:
        if g.get("result") or g.get("kind") == "exh" or g.get("exh"): continue
        opp = re.sub(r"^#\d+(?:/\d+)?\s+", "", g["opp"]).strip()
        o = nmap.get(norm(ALIAS.get(norm(opp), opp)))
        if o is None: missing.append(opp); continue
        site = {"H": 1, "A": -1}.get(g["site"], 0); day = (pd.Timestamp(g["date"]) - d0).days
        F, p1, c1 = predict([row(ut, o, site, day)]); _, p0, _ = predict([row(ut, o, 0, day)])
        F = F.iloc[0]; margin = float(p1[0]); neutral = float(p0[0])
        eff_u = mu_eff + O_eff[idx[ut]] + D_eff[idx[o]]; eff_o = mu_eff + O_eff[idx[o]] + D_eff[idx[ut]]
        poss = float(F["poss"]); total = float((eff_u + eff_o) * poss / 100)
        fx = {m: (S[m][3] + S[m][0][idx[ut]] + S[m][1][idx[o]], S[m][3] + S[m][0][idx[o]] + S[m][1][idx[ut]]) for m in ("efg", "tov", "orb", "ftr")}
        con = dict(zip(FEATS, c1[0]))
        edges = [{"k": LABEL[f], "m": f, "pts": round(float(con[f]), 2)} for f in ("f_eff", "f_efg", "f_tov", "f_orb", "f_ftr")]
        edges.append({"k": LABEL["f_L"], "m": "L", "ut": round(float(F["L_h"]), 2), "opp": round(float(F["L_a"]), 2), "pts": round(float(con["f_L"] + con["f_L_early"]), 2)})
        edges.append({"k": "Style matchups (pace, rebounding, turnovers, shooting)", "m": "match", "pts": round(float(sum(con[f] for f in FEATS if f.startswith("m_"))), 2)})
        edges.append({"k": "Net efficiency (adjusted points per 100)", "m": "net", "ut": round(float(O_eff[idx[ut]] - D_eff[idx[ut]]), 1), "opp": round(float(O_eff[idx[o]] - D_eff[idx[o]]), 1), "pts": 0})

        def top(t, n=6):
            rc = PL["recent"].get(t); out = []
            if rc is None: return out
            for a, sh in list(rc.items())[:n]: out.append([nameOf(a), round(float(sh), 3), round(float(PL["vals"].get(a, 0.0)), 2), int(round(PL["mins"].get(a, 0)))])
            return out
        games.append({"date": g["date"], "opp": opp, "site": site, "neutral": round(neutral, 2), "hca": round(margin - neutral, 2), "margin": round(margin, 2), "sd": round(rmse, 1),
                      "win": round(0.5 * (1 + math.erf(margin / (rmse * math.sqrt(2)))), 3), "total": round(total, 1), "poss": round(poss, 1),
                      "ptsU": round((total + margin) / 2, 1), "ptsO": round((total - margin) / 2, 1), "edges": edges,
                      "oppRank": int(rank[o]), "oppPower": round(power[o], 1), "players": {"ut": top(ut), "opp": top(o)},
                      "sim": {"efgU": round(float(fx["efg"][0]), 4), "efgO": round(float(fx["efg"][1]), 4), "tovU": round(float(fx["tov"][0]), 4), "tovO": round(float(fx["tov"][1]), 4),
                              "orbU": round(float(fx["orb"][0]), 4), "orbO": round(float(fx["orb"][1]), 4), "ftrU": round(float(fx["ftr"][0]), 4), "ftrO": round(float(fx["ftr"][1]), 4), "pace": round(poss, 1)}})
        print(f"{g['date']} {'vs' if site >= 0 else 'at'} {opp:<22} neutral {neutral:+5.1f} -> {margin:+5.1f}  total {total:.0f}  win {games[-1]['win']:.0%}  (opp rank {rank[o]})")
    if missing: print("unmatched opponents:", sorted(set(missing)))
    res = {"season": f"{B.Y1 - 1}-{str(B.Y1)[2:]}", "through": str((d0 + pd.Timedelta(days=cut - 1)).date()), "n": len(cur), "sd": round(rmse, 1),
           "backtest": {"mae": round(mae, 2), "rmse": round(rmse, 2), "winners": round(win * 100, 1), "games": len(R), "seasons": "2018-19 to 2026-27", "fit": par},
           "betas": {f: round(float(raw[f]), 4) for f in FEATS}, "intercept": round(float(b[0]), 3),
           "tennessee": {"power": round(power[ut], 1), "rank": int(rank[ut]), "off": round(float(O_eff[idx[ut]]), 1), "def": round(float(D_eff[idx[ut]]), 1), "players": [[nameOf(a), round(float(sh), 3), round(float(PL['vals'].get(a, 0)), 2)] for a, sh in list(PL["recent"].get(ut, pd.Series(dtype=float)).items())[:8]]},
           "powerAll": powerAll, "games": games}
    p = os.path.join(B.ROOT, "data", "model-bb.js")
    cur_all = {}
    if os.path.exists(p):
        try: cur_all = json.loads(open(p, encoding="utf-8").read().split("=", 1)[1].rstrip().rstrip(";"))
        except Exception: cur_all = {}
    cur_all[sport] = res; cur_all["asOf"] = pd.Timestamp.today().strftime("%Y-%m-%d")
    open(p, "w", encoding="utf-8").write("window.MODEL_BB = " + json.dumps(cur_all, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("wrote", p, os.path.getsize(p), "bytes")
    top = sorted(power.items(), key=lambda x: -x[1])[:15]
    print("Top 15:", ", ".join(f"{names[t]} {v:+.1f}" for t, v in top))


if __name__ == "__main__":
    main(sys.argv[1])
