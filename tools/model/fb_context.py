"""
The Vol Index - context and availability features, tested against the market
===========================================================================
Adds what efficiency ratings cannot see, one feature family at a time, and keeps only what helps the walk-forward backtest:

  availability   points an offense loses when its QB1 / RB / WR are out, and what a defense loses when regulars are out,
                 measured from real historical absences (box-score participation), not assumed
  rest           days since each team's last game (bye, short week)
  early season   how far into the season it is (ratings are least certain in weeks 1-3)
  ranking        top-25 status of each team (from the market line's own era: only as an interaction check)

    python tools/model/fb_context.py --build     # download ESPN player box scores (defense participation), cache features
    python tools/model/fb_context.py             # run the tests and print the table
"""
import os, sys, math, tempfile, json
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fb_build as B
import fb_ratings as FR
import fb_players as FP
import fb_ablate as AB

DBOX = os.path.join(FR.DIR, "defense_box.parquet")
FEAT = os.path.join(FR.DIR, "context_features.parquet")


def build_defense_box():
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for y in range(2014, 2027):
            p = os.path.join(tmp, f"{y}.parquet")
            try: B.fetch("espn_cfb_player_box", f"player_box_{y}.parquet", p)
            except Exception as e: print(y, "skipped", e); continue
            d = pd.read_parquet(p); os.remove(p)
            keep = [c for c in ["game_id", "team_id", "athlete_id", "athlete_name", "totalTackles", "sacks", "tacklesForLoss", "passesDefended", "season"] if c in d.columns]
            d = d[keep].copy()
            for c in ["totalTackles", "sacks", "tacklesForLoss", "passesDefended"]:
                if c not in d.columns: d[c] = 0
            for c in ["totalTackles", "sacks", "tacklesForLoss", "passesDefended"]:
                if c in d.columns: d[c] = pd.to_numeric(d[c], errors="coerce").fillna(0)
            d["game_id"] = d["game_id"].astype("int64"); d["team_id"] = pd.to_numeric(d["team_id"], errors="coerce"); d["season"] = y
            d = d[(d["totalTackles"] > 0) | (d["passesDefended"] > 0) | (d["sacks"] > 0) | (d["tacklesForLoss"] > 0)]
            rows.append(d); print(y, len(d), flush=True)
    pd.concat(rows, ignore_index=True).to_parquet(DBOX)


def expected_epa(G, T, P, hl=240, lam=20):
    teams = sorted(set(P["o"]) | set(P["d"]))
    G = G.copy(); G["wk"] = G["date"].dt.to_period("W-SUN").astype(str)
    rows = []
    for wk, grp in G[G["season"] >= 2015].groupby("wk"):
        r = FR.fit(P, "c_epa", grp["day"].min(), hl, lam, teams)
        if r is None: continue
        O, D, h, mu, idx = r
        for _, g in grp.iterrows():
            for team, o, d_, s in ((g["home_team"], g["h_id"], g["a_id"], g["site"]), (g["away_team"], g["a_id"], g["h_id"], -g["site"])):
                if o in idx and d_ in idx: rows.append((g["game_id"], team, mu + O[idx[o]] + D[idx[d_]] + h * s))
    return pd.DataFrame(rows, columns=["game_id", "team", "exp_epa"])


def offense_flags(PGm, T):
    agg = PGm.groupby(["season", "team", "player", "role"]).agg(g=("game_id", "nunique"), n=("n_all", "sum")).reset_index()
    tg = T.groupby(["season", "team"])["game_id"].nunique().rename("team_games").reset_index()
    agg = agg.merge(tg, on=["season", "team"])
    lim = {"pass": 1, "rush": 2, "recv": 3}
    agg = agg[agg["role"].isin(lim)].copy()
    agg["rank"] = agg.groupby(["season", "team", "role"])["n"].rank(ascending=False, method="first")
    key = agg[(agg["rank"] <= agg["role"].map(lim)) & (agg["g"] >= 0.7 * agg["team_games"])]
    pres = PGm[PGm["n_all"] >= 3].groupby(["season", "team", "player", "role"])["game_id"].apply(set).rename("pl").reset_index()
    allg = T.groupby(["season", "team"])["game_id"].apply(set).rename("all").reset_index()
    key = key.merge(pres, on=["season", "team", "player", "role"]).merge(allg, on=["season", "team"])
    key["miss"] = key.apply(lambda r: r["all"] - r["pl"], axis=1)
    m = key.explode("miss").dropna(subset=["miss"])
    m["game_id"] = m["miss"].astype("int64"); m["tag"] = m["role"] + m["rank"].astype(int).astype(str)
    return m.assign(v=1).pivot_table(index=["game_id", "team"], columns="tag", values="v", aggfunc="max", fill_value=0).reset_index()


def defense_flags(DB, T, G):
    """Count of top defensive regulars (by a tackles/TFL/sacks/PD activity score) who recorded nothing in the game."""
    nm = pd.concat([G[[f"{s}_team_id", f"{s}_team"]].set_axis(["i", "n"], axis=1) for s in ("home", "away")])
    nm["i"] = pd.to_numeric(nm["i"], errors="coerce"); nm = nm.dropna().drop_duplicates("i")
    names = dict(zip(nm["i"].astype("int64"), nm["n"]))
    DB = DB.copy(); DB["team_id"] = pd.to_numeric(DB["team_id"], errors="coerce"); DB = DB.dropna(subset=["team_id"]); DB["team_id"] = DB["team_id"].astype("int64")
    DB["team"] = DB["team_id"].map(names)
    DB = DB.dropna(subset=["team"])
    DB["act"] = DB["totalTackles"] + 3 * DB["sacks"] + 3 * DB["tacklesForLoss"] + 2 * DB["passesDefended"]
    seas = DB.groupby(["season", "team", "athlete_id"]).agg(g=("game_id", "nunique"), act=("act", "sum")).reset_index()
    tg = T.groupby(["season", "team"])["game_id"].nunique().rename("team_games").reset_index()
    seas = seas.merge(tg, on=["season", "team"])
    seas["rk"] = seas.groupby(["season", "team"])["act"].rank(ascending=False, method="first")
    top = seas[(seas["rk"] <= 8) & (seas["g"] >= 0.7 * seas["team_games"])]
    pres = DB.groupby(["season", "team", "athlete_id"])["game_id"].apply(set).rename("pl").reset_index()
    allg = T.groupby(["season", "team"])["game_id"].apply(set).rename("all").reset_index()
    top = top.merge(pres, on=["season", "team", "athlete_id"]).merge(allg, on=["season", "team"])
    top["miss"] = top.apply(lambda r: r["all"] - r["pl"], axis=1)
    m = top.explode("miss").dropna(subset=["miss"]); m["game_id"] = m["miss"].astype("int64")
    m["top3"] = (m["rk"] <= 3).astype(int)
    return m.groupby(["game_id", "team"]).agg(def_out=("rk", "size"), def_out_top3=("top3", "sum")).reset_index()


def build():
    G, T = FR.load(); P = FR.panel(G, T)
    PGm = pd.read_parquet(FP.PG)
    DB = pd.read_parquet(DBOX)
    E = expected_epa(G, T, P)
    X = T[["game_id", "season", "team", "opp", "c_epa", "c_plays"]].merge(E, on=["game_id", "team"], how="inner")
    X["resid_pts"] = (X["c_epa"] - X["exp_epa"]) * X["c_plays"]
    X = X[X["c_plays"] >= 30]
    OF = offense_flags(PGm, T)
    tags = ["pass1", "rush1", "rush2", "recv1", "recv2", "recv3"]
    X = X.merge(OF, on=["game_id", "team"], how="left")
    for t in tags:
        if t not in X.columns: X[t] = 0
    X[tags] = X[tags].fillna(0)
    A = np.c_[np.ones(len(X)), X[tags].values]
    coef = np.linalg.lstsq(A, X["resid_pts"].values, rcond=None)[0]
    off_coef = dict(zip(tags, coef[1:]))
    print("offense absence cost per game:", {k: round(v, 2) for k, v in off_coef.items()})
    # defense: opponent's offense residual regressed on this defense's absences
    DF = defense_flags(DB, T, G)
    opp = X[["game_id", "team", "resid_pts", "c_plays"]].rename(columns={"team": "opp", "resid_pts": "opp_resid", "c_plays": "opp_plays"})
    Y = T[["game_id", "team", "opp"]].merge(opp, on=["game_id", "opp"], how="inner").merge(DF, on=["game_id", "team"], how="left").fillna({"def_out": 0, "def_out_top3": 0})
    Y = Y[Y["opp_plays"] >= 30]
    B2 = np.c_[np.ones(len(Y)), Y["def_out"].values, Y["def_out_top3"].values]
    c2 = np.linalg.lstsq(B2, Y["opp_resid"].values, rcond=None)[0]
    r2 = Y["opp_resid"].values - B2 @ c2
    se2 = np.sqrt(np.diag(np.linalg.inv(B2.T @ B2)) * (r2 ** 2).sum() / (len(Y) - 3))
    print(f"defense: each top-8 regular with no recorded play: {c2[1]:+.2f} pts allowed (se {se2[1]:.2f}); each of top 3: extra {c2[2]:+.2f} (se {se2[2]:.2f})   n={len(Y)}")
    # per team-game absence cost (negative = hurts the team): offense loss + defense loss
    OFF = OF.copy()
    for t in tags:
        if t not in OFF.columns: OFF[t] = 0
    OFF["off_cost"] = sum(OFF[t] * off_coef[t] for t in tags)           # negative
    DFc = DF.copy(); DFc["def_cost"] = -(DFc["def_out"] * max(c2[1], 0) + DFc["def_out_top3"] * max(c2[2], 0))
    cost = T[["game_id", "team"]].merge(OFF[["game_id", "team", "off_cost"]], on=["game_id", "team"], how="left").merge(DFc[["game_id", "team", "def_cost"]], on=["game_id", "team"], how="left").fillna({"off_cost": 0, "def_cost": 0})
    cost["avail"] = cost["off_cost"] + cost["def_cost"]
    # rest days
    G2 = G[["game_id", "season", "date", "home_team", "away_team"]]
    long = pd.concat([G2.rename(columns={"home_team": "team"})[["game_id", "season", "date", "team"]], G2.rename(columns={"away_team": "team"})[["game_id", "season", "date", "team"]]]).sort_values(["team", "date"])
    long["rest"] = long.groupby("team")["date"].diff().dt.days.clip(upper=21)
    cost = cost.merge(long[["game_id", "team", "rest"]], on=["game_id", "team"], how="left")
    cost.to_parquet(FEAT)
    json.dump({"offense": {k: float(v) for k, v in off_coef.items()}, "defense_each": float(c2[1]), "defense_top3_extra": float(c2[2])},
              open(os.path.join(FR.DIR, "availability_values.json"), "w"), indent=1)
    return cost


def main():
    if "--build" in sys.argv or not os.path.exists(DBOX):
        build_defense_box()
    cost = build() if ("--build" in sys.argv or not os.path.exists(FEAT)) else pd.read_parquet(FEAT)
    D = pd.read_parquet(AB.CACHE)
    G, _ = FR.load()
    D = D.merge(G[["game_id", "home_team", "away_team"]], on="game_id")
    for side in ("home", "away"):
        c = cost.rename(columns={"team": side + "_team", "avail": "avail_" + side, "rest": "rest_" + side})[["game_id", side + "_team", "avail_" + side, "rest_" + side]]
        D = D.merge(c, on=["game_id", side + "_team"], how="left")
    D["f_avail"] = D["avail_home"].fillna(0) - D["avail_away"].fillna(0)
    D["f_rest"] = (D["rest_home"].fillna(7).clip(upper=14) - D["rest_away"].fillna(7).clip(upper=14))
    D["f_early"] = (D["week"] <= 3).astype(float) * 1.0
    D["elo"] = D["home_team_pregame_elo"] - D["away_team_pregame_elo"]
    D = D[D["elo"].notna()].copy()
    base = ["f_" + m for m in AB.GROUPS["base"]] + ["site", "elo"]
    R0, mae0, rm0 = AB.walk(D, base)
    mk = np.abs(R0["margin"] + R0["spread"]).mean()
    print(f"\nmarket {mk:.3f}  |  base ratings {mae0:.3f} (RMSE {rm0:.3f})")
    for name, add in [("+ availability", ["f_avail"]), ("+ rest", ["f_rest"]), ("+ availability + rest", ["f_avail", "f_rest"])]:
        R, mae, rm = AB.walk(D, base + add)
        print(f"  {name:<24} MAE {mae:.3f}  ({mae0 - mae:+.3f})  RMSE {rm:.3f}")
    R, mae, rm = AB.walk(D, base + ["f_avail", "f_rest"])
    Z = np.c_[np.ones(len(R)), -R["spread"].values, R["p"].values]
    cf = np.linalg.lstsq(Z, R["margin"].values, rcond=None)[0]
    res = R["margin"].values - Z @ cf
    se = np.sqrt(np.diag(np.linalg.inv(Z.T @ Z)) * (res ** 2).sum() / (len(R) - 3))
    print(f"\nwith availability + rest: margin = {cf[0]:.2f} + {cf[1]:.2f}*market + {cf[2]:.2f}*model (t: market {cf[1] / se[1]:.1f}, model {cf[2] / se[2]:.1f}); blend MAE {np.abs(res).mean():.3f} vs market {mk:.3f}")
    a = D.assign(x=D["f_avail"])
    print(f"games where availability differs by 2+ points: {int((a['x'].abs() >= 2).sum())} of {len(a)}")


if __name__ == "__main__":
    main()
