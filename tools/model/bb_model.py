"""
The Vol Index - college basketball (men's and women's) power ratings, player production and matchup effects
===========================================================================================================
Same recipe as the football model, built from ESPN box scores (SportsDataverse hoopR / wehoop, free on GitHub).

    python tools/model/bb_model.py fetch              # download box scores 2014-15 .. this season  (tools/cache/bbm/)
    python tools/model/bb_model.py mbb backtest       # walk-forward test: every game predicted from earlier games only
    python tools/model/bb_model.py wbb backtest
    python tools/model/bb_model.py mbb report         # write data/model-bb.js  (both sports; run for each)

1. Team efficiency (opponent-adjusted).  Per game, possessions = FGA - OREB + TO + 0.475*FTA (averaged over both teams).
   For each metric m (points per 100 possessions, eFG%, turnover rate, offensive-rebound rate, free-throw rate, possessions):
        value(offense o vs defense d) = mu + O[o] + D[d] + h*site
   fit by weighted ridge, recent games count more (half-life HL days).  The ridge is centered on LAST season's final O and D
   (shrunk by `carry`), so a team with no games yet starts from its history, and every game moves it.  Strength = O - D.
2. Player production.  Game Score per minute for every player (Hollinger), pooled across seasons (older seasons decay),
   regressed to the league mean with K minutes.  A team's lineup score in a game = minutes-weighted value of the players who
   actually played.  New transfers and freshmen start at the mean; returners and portal arrivals carry last season's value.
3. Matchups.  Offense and defense strengths stay separate; extra terms test pace mismatch, rebounding, turnover pressure
   and three-point reliance against the opposing defense.
4. Margin = ridge on the strength differences (scaled by expected possessions), lineup difference, site and early-season
   interactions, fit on earlier seasons only.  No records, rankings, polls or betting lines enter any of it.
"""
import os, sys, json, math, re
import numpy as np, pandas as pd
import scipy.sparse as sp

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR = os.path.join(ROOT, "tools", "cache", "bbm")
REPO = {"mbb": ("hoopR-mbb-data", "mbb"), "wbb": ("wehoop-wbb-data", "wbb")}
METRICS = ["eff", "efg", "tov", "orb", "ftr", "tempo"]
Y0, Y1 = 2014, 2027
PAR = {"mbb": dict(hl=100, lam=6, carry=0.95, K=150, hca=3.5), "wbb": dict(hl=100, lam=6, carry=0.95, K=150, hca=3.0)}


for _k in ("hl", "lam", "carry", "K"):
    if os.environ.get("BB_" + _k.upper()):
        for _s in PAR: PAR[_s][_k] = float(os.environ["BB_" + _k.upper()])


def fetch():
    import urllib.request
    for s, (repo, d) in REPO.items():
        for y in range(Y0, Y1 + 1):
            for kind, sub, name in [("team_box", "team_box", f"team_box_{y}"), ("player_box", "player_box", f"player_box_{y}"), ("sched", "schedules", f"{d}_schedule_{y}")]:
                f = os.path.join(DIR, f"{s}_{kind}_{y}.parquet")
                if os.path.exists(f) and y < Y1 - 0: continue                      # finished seasons are cached; the current one is refreshed
                try: open(f, "wb").write(urllib.request.urlopen(f"https://raw.githubusercontent.com/sportsdataverse/{repo}/main/{d}/{sub}/parquet/{name}.parquet", timeout=120).read())
                except Exception as e: print("skip", s, kind, y, e)


def load(sport):
    T = pd.concat([pd.read_parquet(os.path.join(DIR, f"{sport}_team_box_{y}.parquet")) for y in range(Y0, Y1 + 1) if os.path.exists(os.path.join(DIR, f"{sport}_team_box_{y}.parquet"))], ignore_index=True)
    S = pd.concat([pd.read_parquet(os.path.join(DIR, f"{sport}_sched_{y}.parquet"), columns=["game_id", "neutral_site"]) for y in range(Y0, Y1 + 1) if os.path.exists(os.path.join(DIR, f"{sport}_sched_{y}.parquet"))]).drop_duplicates("game_id")
    T = T.merge(S, on="game_id", how="left")
    num = ["team_score", "opponent_team_score", "field_goals_made", "field_goals_attempted", "three_point_field_goals_made", "three_point_field_goals_attempted", "free_throws_attempted", "offensive_rebounds", "defensive_rebounds", "turnovers"]
    for c in num: T[c] = pd.to_numeric(T[c], errors="coerce")
    T = T.dropna(subset=num).drop_duplicates(["game_id", "team_id"])
    T["date"] = pd.to_datetime(T["game_date"]).dt.tz_localize(None) if pd.to_datetime(T["game_date"]).dt.tz is not None else pd.to_datetime(T["game_date"])
    T["day"] = (T["date"] - pd.Timestamp("2013-01-01")).dt.days
    O = T[["game_id", "team_id", "field_goals_attempted", "offensive_rebounds", "defensive_rebounds", "free_throws_attempted", "turnovers"]].rename(columns=lambda c: c if c == "game_id" else "o_" + c)
    X = T.merge(O, left_on=["game_id", "opponent_team_id"], right_on=["game_id", "o_team_id"], how="inner")
    own = X["field_goals_attempted"] - X["offensive_rebounds"] + X["turnovers"] + 0.475 * X["free_throws_attempted"]
    opp = X["o_field_goals_attempted"] - X["o_offensive_rebounds"] + X["o_turnovers"] + 0.475 * X["o_free_throws_attempted"]
    X["poss"] = (own + opp) / 2
    X = X[(X["poss"] > 40) & (X["poss"] < 130)].copy()
    X["eff"] = X["team_score"] / X["poss"] * 100
    X["efg"] = (X["field_goals_made"] + 0.5 * X["three_point_field_goals_made"]) / X["field_goals_attempted"].clip(lower=1)
    X["tov"] = X["turnovers"] / X["poss"]
    X["orb"] = X["offensive_rebounds"] / (X["offensive_rebounds"] + X["o_defensive_rebounds"]).clip(lower=1)
    X["ftr"] = X["free_throws_attempted"] / X["field_goals_attempted"].clip(lower=1)
    X["tempo"] = X["poss"]
    X["r3"] = X["three_point_field_goals_attempted"] / X["field_goals_attempted"].clip(lower=1)
    X["site"] = np.where(X["neutral_site"].fillna(False).astype(bool), 0, np.where(X["team_home_away"] == "home", 1, -1))
    games_n = X.groupby(["season", "team_id"])["game_id"].transform("count")
    X["d1"] = games_n >= 14
    prev = set(zip(X.loc[X["d1"], "season"] + 1, X.loc[X["d1"], "team_id"]))              # a team that was Division I last season still is (early weeks of a new season)
    X["d1"] = X["d1"] | pd.Series([(s, t) in prev for s, t in zip(X["season"], X["team_id"])], index=X.index)
    return X


def panel(X):
    d1 = X.set_index(["season", "team_id"])["d1"].to_dict()
    P = X.copy()
    P["o"] = np.where(P["d1"], P["team_id"], -1)
    P["d"] = [oid if d1.get((s, oid), False) else -1 for s, oid in zip(P["season"], P["opponent_team_id"])]
    P["s"] = P["site"]
    return P[(P["o"] != P["d"])]


def fit(P, metric, cutoff, hl, lam, idx, prior=None, carry=0.0):
    q = P[(P["day"] < cutoff) & P[metric].notna()]
    k = len(idx)
    if len(q) < 150: return None
    n = len(q)
    oi, di = q["o"].map(idx).values, q["d"].map(idx).values
    rows = np.arange(n)
    X = sp.csr_matrix((np.ones(3 * n), (np.r_[rows, rows, rows], np.r_[oi, k + di, np.full(n, 2 * k)])), shape=(n, 2 * k + 2)).tolil()
    X[:, 2 * k + 1] = q["s"].values.reshape(-1, 1); X = X.tocsr()
    y = q[metric].values.astype(float)
    p = np.zeros(2 * k + 2)
    if prior is not None: p[:2 * k] = carry * prior
    w = 0.5 ** ((cutoff - q["day"].values) / hl)
    y2 = y - X @ p
    A = (X.T @ sp.diags(w) @ X).toarray()
    reg = np.full(2 * k + 2, lam); reg[2 * k:] = 1e-6
    beta = np.linalg.solve(A + np.diag(reg), X.T @ (w * y2)) + p
    return beta[:k], beta[k:2 * k], beta[2 * k + 1], beta[2 * k]


def games_table(X):
    h = X[X["team_home_away"] == "home"].drop_duplicates("game_id")
    G = h[["game_id", "season", "date", "day", "team_id", "opponent_team_id", "team_score", "opponent_team_score", "site", "d1"]].rename(columns={"team_id": "h", "opponent_team_id": "a", "team_score": "hs", "opponent_team_score": "as_"})
    d1 = X.set_index(["season", "team_id"])["d1"].to_dict()
    G["a_d1"] = [d1.get((s, a), False) for s, a in zip(G["season"], G["a"])]
    G["margin"] = G["hs"] - G["as_"]
    G["total"] = G["hs"] + G["as_"]
    return G


def run_ratings(P, G, par):
    """Walk through the seasons.  Before each week's games the ratings are refit on that season's earlier games, centered on last
    season's final ratings (shrunk by `carry`).  After the season a final fit becomes next season's prior.
    Returns one row per game with both teams' pre-game O and D in every metric, plus the final ratings of each season."""
    ids = sorted(set(P["o"]) | set(P["d"])); idx = {t: i for i, t in enumerate(ids)}
    prior = {m: None for m in METRICS}; out = []; final = {}
    for y in range(Y0, Y1 + 1):
        Py = P[P["season"] == y]; Gy = G[G["season"] == y].copy()
        if not len(Gy): continue
        Gy["wk"] = pd.to_datetime(Gy["date"]).dt.to_period("W-SUN").astype(str)
        for wk, grp in Gy.groupby("wk"):
            cut = int(grp["day"].min()); f = pd.DataFrame({"game_id": grp["game_id"].values}); ok = True
            ih, ia = grp["h"].map(lambda t: idx.get(t, idx[-1])).values.astype(int), grp["a"].map(lambda t: idx.get(t, idx[-1])).values.astype(int)
            for m in METRICS:
                r = fit(Py, m, cut, par["hl"], par["lam"], idx, prior[m], par["carry"])
                if r is None and prior[m] is not None:                              # first days of a season: the prior alone
                    k = len(idx); O, D, hh, mu = prior[m][:k] * par["carry"], prior[m][k:] * par["carry"], 0.0, float(Py[m].mean()) if len(Py) else 0.0
                elif r is None: ok = False; break
                else: O, D, hh, mu = r
                f[m + "_Oh"], f[m + "_Dh"], f[m + "_Oa"], f[m + "_Da"] = O[ih], D[ih], O[ia], D[ia]
                f[m + "_mu"] = mu; f[m + "_hh"] = hh
            if ok: out.append(f)
        for m in METRICS:
            if not len(Py): break
            r = fit(Py, m, int(Py["day"].max()) + 1, par["hl"] * 3, par["lam"], idx, prior[m], par["carry"])
            if r is not None:
                final[(y, m)] = r; prior[m] = np.r_[r[0], r[1]]
        print(" ratings", y, flush=True)
    return pd.concat(out, ignore_index=True), idx, final


def player_lineups(sport, G, K):
    """Lineup score per team per game from players' PRE-game values.  Returns {(game_id, team_id): lineup}, plus the last values table."""
    PB = pd.concat([pd.read_parquet(os.path.join(DIR, f"{sport}_player_box_{y}.parquet"), columns=["game_id", "season", "athlete_id", "athlete_display_name", "team_id", "minutes", "points", "field_goals_made", "field_goals_attempted", "free_throws_made", "free_throws_attempted", "offensive_rebounds", "defensive_rebounds", "assists", "steals", "blocks", "turnovers", "fouls", "did_not_play"]) for y in range(Y0, Y1 + 1) if os.path.exists(os.path.join(DIR, f"{sport}_player_box_{y}.parquet"))], ignore_index=True)
    for c in PB.columns:
        if c not in ("athlete_display_name",): PB[c] = pd.to_numeric(PB[c], errors="coerce")
    PB = PB[(PB["minutes"] > 0) & PB["athlete_id"].notna()].copy()
    PB[["field_goals_made", "field_goals_attempted", "free_throws_made", "free_throws_attempted", "offensive_rebounds", "defensive_rebounds", "assists", "steals", "blocks", "turnovers", "fouls", "points"]] = PB[["field_goals_made", "field_goals_attempted", "free_throws_made", "free_throws_attempted", "offensive_rebounds", "defensive_rebounds", "assists", "steals", "blocks", "turnovers", "fouls", "points"]].fillna(0)
    PB["gs"] = (PB["points"] + 0.4 * PB["field_goals_made"] - 0.7 * PB["field_goals_attempted"] - 0.4 * (PB["free_throws_attempted"] - PB["free_throws_made"])
                + 0.7 * PB["offensive_rebounds"] + 0.3 * PB["defensive_rebounds"] + PB["steals"] + 0.7 * PB["assists"] + 0.7 * PB["blocks"] - 0.4 * PB["fouls"] - PB["turnovers"])
    PB = PB.merge(G[["game_id", "day"]], on="game_id").sort_values(["day", "game_id"])
    mu = PB["gs"].sum() / PB["minutes"].sum()
    tot = {}; out = {}; season = None
    for gid, grp in PB.groupby("game_id", sort=False):
        y = int(grp["season"].iloc[0])
        if season is not None and y != season:
            for v in tot.values(): v[0] *= 0.7; v[1] *= 0.7                   # a new season: last year's evidence counts for 70%
        season = y
        for tid, q in grp.groupby("team_id"):
            m = q["minutes"].values; tm = m.sum()
            if tm <= 0: continue
            vals = np.array([((tot.get(a, (0, 0))[0] + K * mu) / (tot.get(a, (0, 0))[1] + K) - mu) * 40 for a in q["athlete_id"]])
            out[(gid, tid)] = float((m / tm * vals).sum())
        for a, g_, m_ in zip(grp["athlete_id"], grp["gs"], grp["minutes"]):
            v = tot.setdefault(a, [0.0, 0.0]); v[0] += g_; v[1] += m_
    names = PB.sort_values("day").groupby("athlete_id")["athlete_display_name"].last().to_dict()
    teams = PB.sort_values("day").groupby("athlete_id")["team_id"].last().to_dict()
    cur = {a: ((v[0] + K * mu) / (v[1] + K) - mu) * 40 for a, v in tot.items()}
    # who is playing now: each team's minutes shares over its last five games this season
    last = PB[PB["season"] == PB["season"].max()]; recent = {}
    for tid, q in last.groupby("team_id"):
        gids = q.drop_duplicates("game_id").sort_values("day")["game_id"].tolist()[-5:]
        m = q[q["game_id"].isin(gids)].groupby("athlete_id")["minutes"].sum(); recent[tid] = (m / m.sum()).sort_values(ascending=False)
    return out, dict(mu=mu, names=names, teams=teams, vals=cur, mins={a: v[1] for a, v in tot.items()}, recent=recent)


def frame(sport, par=None):
    par = par or PAR[sport]
    X = load(sport); P = panel(X); G = games_table(X)
    F, idx, final = run_ratings(P, G, par)
    L, PL = player_lineups(sport, G, par["K"])
    D = G.merge(F, on="game_id", how="inner")
    D = D[D["d1"] & D["a_d1"]].copy()
    D["L_h"] = [L.get((g, t), 0.0) for g, t in zip(D["game_id"], D["h"])]; D["L_a"] = [L.get((g, t), 0.0) for g, t in zip(D["game_id"], D["a"])]
    return D, P, G, idx, final, PL


def features(D, sport):
    n = lambda m, s: D[f"{m}_O{s}"] - D[f"{m}_D{s}"]
    poss = D["tempo_mu"] + (D["tempo_Oh"] + D["tempo_Da"] + D["tempo_Oa"] + D["tempo_Dh"]) / 2           # expected possessions: league average plus both teams' pace tendencies
    poss = poss.clip(55, 85); D["poss"] = poss; sc = poss / 100
    D["f_eff"] = (n("eff", "h") - n("eff", "a")) * sc
    D["f_efg"] = (n("efg", "h") - n("efg", "a")) * 100 * sc; D["f_tov"] = -(n("tov", "h") - n("tov", "a")) * 100 * sc
    D["f_orb"] = (n("orb", "h") - n("orb", "a")) * 100 * sc; D["f_ftr"] = (n("ftr", "h") - n("ftr", "a")) * 100 * sc
    D["f_L"] = D["L_h"] - D["L_a"]
    D["f_site"] = D["site"]
    # matchups: how each side's style meets the other's defense, beyond the additive sum
    D["m_pace"] = (D["tempo_Oh"] - D["tempo_Oa"]).abs() * D["f_eff"].apply(np.sign)            # a big pace gap helps the weaker side's variance, not the mean
    D["m_orb"] = ((D["orb_Oh"] + D["orb_Da"]) - (D["orb_Oa"] + D["orb_Dh"])) * 100
    D["m_tov"] = ((D["tov_Oh"] + D["tov_Da"]) - (D["tov_Oa"] + D["tov_Dh"])) * -100
    D["m_efg_x_tempo"] = ((D["efg_Oh"] + D["efg_Da"]) * (D["tempo_Oh"] + D["tempo_Da"]) - (D["efg_Oa"] + D["efg_Dh"]) * (D["tempo_Oa"] + D["tempo_Dh"])) * 100
    D["m_off_vs_def"] = ((D["eff_Oh"] - D["eff_Oa"]) - (D["eff_Da"] - D["eff_Dh"]))              # offense edge minus defense edge: who leans on which side
    return D


def ridge(X, y, lam):
    X1 = np.c_[np.ones(len(X)), X]; pen = np.eye(X1.shape[1]) * lam; pen[0, 0] = 0
    return np.linalg.solve(X1.T @ X1 + pen, X1.T @ y)


def walk(D, feats, lam=30.0, y0=2019):
    out = []
    for y in range(y0, Y1 + 1):
        tr, te = D[D["season"] < y], D[D["season"] == y]
        if len(te) < 200: continue
        mu, sd = tr[feats].mean(), tr[feats].std().replace(0, 1)
        b = ridge(((tr[feats] - mu) / sd).values, tr["margin"].values, lam)
        out.append(te.assign(p=np.c_[np.ones(len(te)), ((te[feats] - mu) / sd).values] @ b))
    R = pd.concat(out); return R, float((R["margin"] - R["p"]).abs().mean()), float(np.sqrt(((R["margin"] - R["p"]) ** 2).mean())), float(((R["p"] > 0) == (R["margin"] > 0)).mean())


def backtest(sport):
    par = PAR[sport]
    D, P, G, idx, final, PL = frame(sport); D = features(D, sport)
    D["early"] = (D.groupby(["season"])["day"].transform(lambda s: (s - s.min()) <= 28)).astype(float)
    D["f_L_early"] = D["f_L"] * D["early"]
    D.to_parquet(os.path.join(DIR, f"{sport}_frame.parquet")) if not os.environ.get("BB_NOSAVE") else None
    print(f"\n{sport}: {len(D)} D1-vs-D1 games with pre-game ratings.  Walk-forward, test seasons 2019-{Y1}")
    base = ["f_eff", "f_site"]
    four = ["f_eff", "f_efg", "f_tov", "f_orb", "f_ftr", "f_site"]
    R0, m0, r0, w0 = walk(D, base); print(f"  A. net efficiency + site                      MAE {m0:.3f}  RMSE {r0:.3f}  winners {w0*100:.1f}%  (n={len(R0)})")
    R, m, r, w = walk(D, four); print(f"  B. + four factors                             MAE {m:.3f}  RMSE {r:.3f}  winners {w*100:.1f}%  ({m0-m:+.3f})")
    R, m, r, w = walk(D, four + ["f_L"]); print(f"  C. + player production (lineup score)         MAE {m:.3f}  RMSE {r:.3f}  winners {w*100:.1f}%  ({m0-m:+.3f})")
    R, m, r, w = walk(D, four + ["f_L", "f_L_early"]); print(f"  D. + lineup x early season                    MAE {m:.3f}  RMSE {r:.3f}  winners {w*100:.1f}%  ({m0-m:+.3f})")
    mt = ["m_pace", "m_orb", "m_tov", "m_efg_x_tempo", "m_off_vs_def"]
    R, m, r, w = walk(D, four + ["f_L", "f_L_early"] + mt); print(f"  E. + matchup terms                            MAE {m:.3f}  RMSE {r:.3f}  winners {w*100:.1f}%  ({m0-m:+.3f})")
    for t in mt:
        R, m1, _, _ = walk(D, four + ["f_L", "f_L_early", t]); print(f"       + only {t:<16}                    MAE {m1:.3f}  ({m0 - m1:+.3f})")
    # no-history comparison: ratings with no carry-over from last season
    print(f"  Reference: predicting the home margin = site only: MAE {np.abs(D[D.season>=2019]['margin'] - D[D.season>=2019]['margin'].mean()).mean():.3f}")
    L = R[R["day"] > 0]
    for lab, sel in (("first 4 weeks", R["early"] == 1), ("after week 4", R["early"] == 0)):
        x = R[sel]; print(f"     {lab:<14} MAE {np.abs(x['margin']-x['p']).mean():.3f} (n={len(x)})")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "fetch": fetch()
    elif len(a) >= 2 and a[1] == "backtest": backtest(a[0])
