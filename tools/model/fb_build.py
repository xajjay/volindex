"""
The Vol Index - football model data builder
===========================================
Turns the open cfbfastR / ESPN data (no API key needed) into two compact tables the power-rating work uses:

    tools/cache/fbm/games.parquet       one row per game: teams, site, venue, attendance, final score, market line, Elo
    tools/cache/fbm/teamgame.parquet    one row per team per game: what that team's offense did and what it allowed,
                                        opponent-neutral raw numbers (EPA/play, success, explosives, drives, time of
                                        possession, turnovers, special teams), with garbage time removed

    python tools/model/fb_build.py                 # 2014 through this season
    python tools/model/fb_build.py 2024 2026       # only those seasons (merged into what is already saved)

Each season's raw file is ~100 MB, so it is downloaded, boiled down, and deleted. Nothing raw is kept in the repo.
Sources (all GitHub release assets of sportsdataverse/sportsdataverse-data):
    cfbfastR_cfb_pbp        play by play with EPA, success, win probability, drives, market spread, venue, pregame Elo
    espn_cfb_schedules      final scores, venue, attendance
    espn_cfb_team_box       turnovers, penalties, possession time
"""
import os, sys, urllib.request, tempfile, datetime
import numpy as np, pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "tools", "cache", "fbm")
BASE = "https://github.com/sportsdataverse/sportsdataverse-data/releases/download"

PBP_COLS = ["game_play_number", "clock_minutes", "clock_seconds", "drive_yards", "fumble_forced_player_name", "pass_breakup_player_name",
            "sack_player_name", "passer_player_name", "rusher_player_name", "receiver_player_name", "interception_player_name",
            "completion", "touchdown",
            "game_id", "pos_team", "def_pos_team", "play_type", "down", "distance", "yards_to_goal", "yards_gained", "EPA",
            "success", "rush", "pass", "sack", "int", "period", "drive_id", "drive_pts", "drive_start_yards_to_goal",
            "drive_time_minutes_elapsed", "drive_time_seconds_elapsed", "rz_play", "home_team", "away_team", "home_team_id",
            "away_team_id", "spread", "formatted_spread", "over_under", "provider", "neutral_site", "conference_game",
            "season_type", "week", "start_date", "venue", "home_team_division", "away_team_division",
            "home_team_pregame_elo", "away_team_pregame_elo", "pos_team_score", "def_pos_team_score"]
KICK = {"Kickoff", "Punt", "Field Goal Good", "Field Goal Missed", "Blocked Field Goal"}


def fetch(tag, name, dest):
    url = f"{BASE}/{tag}/{name}"
    req = urllib.request.Request(url, headers={"User-Agent": "volindex-model"})
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as f:
        while True:
            b = r.read(1 << 20)
            if not b: break
            f.write(b)


def garbage(df):
    """The usual college rule: the game is decided when the lead is bigger than 43/37/27/22 points in quarters 1-4."""
    lim = df["period"].map({1: 43, 2: 37, 3: 27, 4: 22}).fillna(22)
    return (df["pos_team_score"] - df["def_pos_team_score"]).abs() > lim


PLAYERS = []


def season(y, tmp):
    p = os.path.join(tmp, f"pbp{y}.parquet")
    fetch("cfbfastR_cfb_pbp", f"play_by_play_{y}.parquet", p)
    d = pd.read_parquet(p, columns=PBP_COLS)
    os.remove(p)
    d["game_id"] = d["game_id"].astype("int64")

    # ----- game table (one row per game) -----
    g = d.drop_duplicates("game_id")[["game_id", "week", "season_type", "start_date", "home_team", "away_team", "home_team_id",
                                       "away_team_id", "neutral_site", "conference_game", "venue", "home_team_pregame_elo",
                                       "away_team_pregame_elo", "spread", "formatted_spread", "over_under", "provider",
                                       "home_team_division", "away_team_division"]].copy()
    g["season"] = y
    for c in ["home_team_id", "away_team_id", "spread", "over_under", "home_team_pregame_elo", "away_team_pregame_elo", "week"]:
        g[c] = pd.to_numeric(g[c], errors="coerce")
    for c in ["neutral_site", "conference_game"]: g[c] = g[c].fillna(False).astype(bool)
    for c in ["start_date", "venue", "provider", "formatted_spread", "season_type", "home_team_division", "away_team_division"]:
        g[c] = g[c].astype("string")
    try:
        s = os.path.join(tmp, f"sched{y}.parquet"); fetch("espn_cfb_schedules", f"cfb_schedule_{y}.parquet", s)
        sc = pd.read_parquet(s)[["game_id", "home_score", "away_score", "attendance", "status"]]; sc["game_id"] = sc["game_id"].astype("int64")
        sc["attendance"] = pd.to_numeric(sc["attendance"], errors="coerce"); sc["status"] = sc["status"].astype("string")
        g = g.merge(sc, on="game_id", how="left"); os.remove(s)
    except Exception as e:
        print(f"  {y}: no schedule file ({e})"); g["home_score"] = g["away_score"] = g["attendance"] = np.nan; g["status"] = pd.Series([None] * len(g), dtype="string")

    # ----- scrimmage plays (rush, pass, sack) with garbage time marked -----
    sp = d[((d["rush"] == 1) | (d["pass"] == 1) | (d["sack"] == 1)) & d["EPA"].notna() & d["down"].notna()].copy()
    sp["gt"] = garbage(sp)
    sp["is_pass"] = ((sp["pass"] == 1) | (sp["sack"] == 1)).astype(int)
    sp["is_rush"] = ((sp["rush"] == 1) & (sp["is_pass"] == 0)).astype(int)
    yg = sp["yards_gained"].fillna(0)
    sp["expl"] = (((sp["is_rush"] == 1) & (yg >= 10)) | ((sp["is_pass"] == 1) & (sp["sack"] != 1) & (yg >= 20))).astype(int)
    sp["early"] = sp["down"].isin([1, 2]).astype(int)
    sp["conv3"] = ((sp["down"] == 3) & (yg >= sp["distance"])).astype(int)
    sp["is3"] = (sp["down"] == 3).astype(int)
    sp["rz"] = (sp["yards_to_goal"] <= 20).astype(int)
    sp["int_"] = (sp["int"] == 1).astype(int)
    sp["sack_"] = (sp["sack"] == 1).astype(int)
    sp["succ"] = sp["success"].fillna(0)

    sp["rush_y"] = np.where(sp["is_rush"] == 1, yg, np.nan)
    sp["stuff"] = ((sp["is_rush"] == 1) & (yg <= 0)).astype(int)
    sp["opp4"] = ((sp["is_rush"] == 1) & (yg >= 4)).astype(int)
    ly = np.where(yg < 0, 1.2 * yg, np.where(yg <= 4, yg, 4 + 0.5 * (np.minimum(yg, 10) - 4)))
    sp["line_y"] = np.where(sp["is_rush"] == 1, ly, np.nan)
    sp["tfl"] = ((sp["is_rush"] == 1) & (yg < 0)).astype(int)
    sp["havoc"] = (((sp["tfl"] == 1) | (sp["sack_"] == 1) | (sp["int_"] == 1) | sp["fumble_forced_player_name"].notna()
                    | sp["pass_breakup_player_name"].notna())).astype(int)
    sp["dist_b"] = np.where(sp["down"] != 3, 0, np.where(sp["distance"] <= 3, 1, np.where(sp["distance"] <= 6, 2, 3)))
    sp["diff"] = sp["pos_team_score"] - sp["def_pos_team_score"]
    # expected pass rate (pass rate over expected, PROE): a plain logistic fit on the season's own plays
    try:
        from sklearn.linear_model import LogisticRegression
        X = np.c_[sp["down"] == 1, sp["down"] == 2, sp["down"] == 3, np.log1p(sp["distance"].clip(lower=0)), sp["yards_to_goal"] / 100.0,
                  sp["diff"].clip(-28, 28) / 28.0, (sp["period"] >= 4).astype(int), (sp["diff"].abs() <= 8)]
        m_ = LogisticRegression(max_iter=300).fit(X[~sp["gt"].values], sp.loc[~sp["gt"], "is_pass"])
        sp["pexp"] = m_.predict_proba(X)[:, 1]
    except Exception:
        sp["pexp"] = sp["is_pass"].mean()
    sp["proe"] = sp["is_pass"] - sp["pexp"]
    # pace: seconds the offense uses between its plays inside one drive
    sp["clk"] = sp["clock_minutes"].fillna(0) * 60 + sp["clock_seconds"].fillna(0)
    sp = sp.sort_values(["game_id", "pos_team", "game_play_number"])
    gp = sp.groupby(["game_id", "pos_team", "drive_id", "period"])["clk"].diff(-1)
    sp["dt"] = gp.where((gp > 0) & (gp <= 45))

    def agg(x):
        r, q = x[x["is_rush"] == 1], x[x["is_pass"] == 1]
        e = x[x["early"] == 1]
        f = lambda c, v: x.loc[c, v].mean()
        return pd.Series({
            "plays": len(x), "epa": x["EPA"].mean(), "succ": x["succ"].mean(), "expl": x["expl"].mean(),
            "rush_n": len(r), "rush_epa": r["EPA"].mean(), "rush_succ": r["succ"].mean(), "rush_expl": r["expl"].mean(),
            "pass_n": len(q), "pass_epa": q["EPA"].mean(), "pass_succ": q["succ"].mean(), "pass_expl": q["expl"].mean(),
            "sack_rate": q["sack_"].mean() if len(q) else np.nan, "int_rate": q["int_"].mean() if len(q) else np.nan,
            "early_epa": e["EPA"].mean(), "early_succ": e["succ"].mean(),
            "conv3": x["conv3"].sum() / max(x["is3"].sum(), 1), "rz_epa": x.loc[x["rz"] == 1, "EPA"].mean(),
            "ypa": q.loc[q["sack_"] == 0, "yards_gained"].mean() if len(q) else np.nan,
            "stuff": r["stuff"].mean(), "opp4": r["opp4"].mean(), "line_y": r["line_y"].mean(), "havoc": x["havoc"].mean(),
            "pass_rate": len(q) / max(len(x), 1), "proe": x["proe"].mean(), "dt": x["dt"].mean(),
            "late_epa": x.loc[x["down"] >= 3, "EPA"].mean(), "late_succ": x.loc[x["down"] >= 3, "succ"].mean(),
            "d3s_epa": f(x["dist_b"] == 1, "EPA"), "d3m_epa": f(x["dist_b"] == 2, "EPA"), "d3l_epa": f(x["dist_b"] == 3, "EPA"),
            "d4_epa": f(x["down"] == 4, "EPA"), "lead_epa": f(x["diff"] > 0, "EPA"), "trail_epa": f(x["diff"] < 0, "EPA"),
            "own_epa": f(x["yards_to_goal"] > 50, "EPA"), "opp_epa": f(x["yards_to_goal"] <= 50, "EPA"),
            "one_epa": f(x["diff"].abs() <= 8, "EPA"), "rz_pass_rate": f(x["rz"] == 1, "is_pass"), "d1_pass_rate": f(x["down"] == 1, "is_pass"),
            "nonexpl_epa": x.loc[x["expl"] == 0, "EPA"].mean(), "expl_epa": x.loc[x["expl"] == 1, "EPA"].mean(),
        })
    k = ["game_id", "pos_team"]
    clean = sp[~sp["gt"]].groupby(k).apply(agg, include_groups=False).add_prefix("c_")
    allp = sp.groupby(k).agg(a_plays=("EPA", "size"), a_epa=("EPA", "mean")).reset_index()
    gtn = sp.groupby(k)["gt"].mean().rename("garbage_share")
    tg = clean.join(gtn).reset_index().merge(allp, on=k, how="left")

    # ----- drives (points, field position, time, available yards, first two drives, scoring opportunities) -----
    dv = d[d["drive_id"].notna() & d["pos_team"].notna()].copy()
    first = dv.sort_values("game_play_number").groupby(["game_id", "drive_id"]).agg(
        pos_team=("pos_team", "first"), drive_pts=("drive_pts", "first"), start_ytg=("drive_start_yards_to_goal", "first"),
        mins=("drive_time_minutes_elapsed", "first"), secs_=("drive_time_seconds_elapsed", "first"), dy=("drive_yards", "first"),
        minytg=("yards_to_goal", "min"), n0=("game_play_number", "min")).reset_index()
    first["secs"] = first["mins"].fillna(0) * 60 + first["secs_"].fillna(0)
    first["start"] = 100 - first["start_ytg"]
    first["avail"] = (first["dy"] / first["start_ytg"]).clip(0, 1)
    first["opp40"] = first["minytg"] <= 40
    first["order"] = first.groupby(["game_id", "pos_team"])["n0"].rank(method="first")
    first["scr"] = first["drive_pts"].where(first["order"] <= 2)
    first["opp_pts"] = first["drive_pts"].where(first["opp40"])
    dg = first.groupby(k).agg(drives=("drive_pts", "size"), pts_per_drive=("drive_pts", "mean"), start_yd=("start", "mean"), top_secs=("secs", "sum"),
                              avail_yds=("avail", "mean"), scripted_ppd=("scr", "mean"), pts_per_opp=("opp_pts", "mean"),
                              opp_n=("opp40", "sum")).reset_index()
    tg = tg.merge(dg, on=k, how="left")

    # ----- special teams by unit, from the KICKING team's side (a return is the other team's gain) -----
    ptype = d["play_type"].fillna("")
    for nm, mask in [("ko_epa", ptype == "Kickoff"), ("pt_epa", ptype.isin(["Punt", "Blocked Punt", "Blocked Punt Touchdown"])),
                     ("fg_epa", ptype.isin(["Field Goal Good", "Field Goal Missed", "Blocked Field Goal"]))]:
        x = d[mask & d["EPA"].notna()].groupby(k)["EPA"].sum().rename(nm).reset_index()
        tg = tg.merge(x, on=k, how="left"); tg[nm] = tg[nm].fillna(0)
    tg["st_epa"] = tg["ko_epa"] + tg["pt_epa"] + tg["fg_epa"]

    # ----- players: who produced the plays (clean time), for player-value work -----
    pl = []
    q = sp[~sp["gt"]]
    pa = q[(q["is_pass"] == 1) & q["passer_player_name"].notna()].groupby(["pos_team", "passer_player_name"]).agg(
        n=("EPA", "size"), epa=("EPA", "sum"), succ=("succ", "sum"), yds=("yards_gained", "sum"), games=("game_id", "nunique"),
        ints=("int_", "sum"), sacks=("sack_", "sum")).reset_index().rename(columns={"pos_team": "team", "passer_player_name": "player"})
    pa["role"] = "pass"; pl.append(pa)
    ru = q[(q["is_rush"] == 1) & q["rusher_player_name"].notna()].groupby(["pos_team", "rusher_player_name"]).agg(
        n=("EPA", "size"), epa=("EPA", "sum"), succ=("succ", "sum"), yds=("yards_gained", "sum"), games=("game_id", "nunique")).reset_index().rename(columns={"pos_team": "team", "rusher_player_name": "player"})
    ru["role"] = "rush"; pl.append(ru)
    re_ = q[(q["is_pass"] == 1) & q["receiver_player_name"].notna()].groupby(["pos_team", "receiver_player_name"]).agg(
        n=("EPA", "size"), epa=("EPA", "sum"), succ=("succ", "sum"), yds=("yards_gained", "sum"), games=("game_id", "nunique"),
        catches=("completion", "sum")).reset_index().rename(columns={"pos_team": "team", "receiver_player_name": "player"})
    re_["role"] = "recv"; pl.append(re_)
    P_ = pd.concat(pl, ignore_index=True); P_["season"] = y
    # defenders: sacks, pass breakups, interceptions, tackles for loss (the play's defending team)
    dd = []
    for col, nm in [("sack_player_name", "sack"), ("pass_breakup_player_name", "pbu"), ("interception_player_name", "int")]:
        t_ = d[d[col].notna()].groupby(["def_pos_team", col]).size().reset_index(name="n").rename(columns={"def_pos_team": "team", col: "player"})
        t_["role"] = nm; dd.append(t_)
    D_ = pd.concat(dd, ignore_index=True); D_["season"] = y
    PLAYERS.append((P_, D_))

    # ----- attach the opponent, the site, and what the opponent's offense did to this team (= this team's defense) -----
    m = g[["game_id", "home_team", "away_team", "home_team_id", "away_team_id"]]
    tg = tg.merge(m, on="game_id", how="left")
    tg["is_home"] = (tg["pos_team"] == tg["home_team"]).astype(int)
    tg["team"] = tg["pos_team"]
    tg["opp"] = np.where(tg["is_home"] == 1, tg["away_team"], tg["home_team"])
    tg["team_id"] = pd.to_numeric(np.where(tg["is_home"] == 1, tg["home_team_id"], tg["away_team_id"]), errors="coerce")
    tg["season"] = y
    tg = tg.drop(columns=["pos_team", "home_team", "away_team", "home_team_id", "away_team_id"])

    # ----- ESPN team box: turnovers, penalties, possession -----
    try:
        b = os.path.join(tmp, f"box{y}.parquet"); fetch("espn_cfb_team_box", f"team_box_{y}.parquet", b)
        bx = pd.read_parquet(b); os.remove(b)
        bx["game_id"] = bx["game_id"].astype("int64"); bx["team_id"] = pd.to_numeric(bx["team_id"], errors="coerce")
        bx = bx[["game_id", "team_id", "turnovers", "fumblesLost", "interceptions", "totalPenaltiesYards", "possessionTime"]]
        for c in ["turnovers", "fumblesLost", "interceptions"]: bx[c] = pd.to_numeric(bx[c], errors="coerce")
        pen = bx["totalPenaltiesYards"].astype(str).str.extract(r"(\d+)-(\d+)")
        bx["pen_n"], bx["pen_yds"] = pd.to_numeric(pen[0], errors="coerce"), pd.to_numeric(pen[1], errors="coerce")
        pt = bx["possessionTime"].astype(str).str.extract(r"(\d+):(\d+)")
        bx["top_box"] = pd.to_numeric(pt[0], errors="coerce") * 60 + pd.to_numeric(pt[1], errors="coerce")
        tg["team_id"] = pd.to_numeric(tg["team_id"], errors="coerce")
        tg = tg.merge(bx.drop(columns=["totalPenaltiesYards", "possessionTime"]), on=["game_id", "team_id"], how="left")
    except Exception as e:
        print(f"  {y}: no team box ({e})")
    return g, tg


def main():
    a = [int(x) for x in sys.argv[1:]]
    y0, y1 = (a[0], a[-1]) if a else (2014, datetime.date.today().year)
    os.makedirs(OUT, exist_ok=True)
    gp, tp = os.path.join(OUT, "games.parquet"), os.path.join(OUT, "teamgame.parquet")
    G = pd.read_parquet(gp) if os.path.exists(gp) else pd.DataFrame()
    T = pd.read_parquet(tp) if os.path.exists(tp) else pd.DataFrame()
    with tempfile.TemporaryDirectory() as tmp:
        for y in range(y0, y1 + 1):
            try:
                g, t = season(y, tmp)
            except Exception as e:
                print(f"{y}: skipped ({e})"); continue
            if len(G): G = G[G["season"] != y]; T = T[T["season"] != y]
            G, T = pd.concat([G, g], ignore_index=True), pd.concat([T, t], ignore_index=True)
            pp, dp = os.path.join(OUT, "players_off.parquet"), os.path.join(OUT, "players_def.parquet")
            if PLAYERS:
                Po, Do = PLAYERS.pop()
                PO = pd.read_parquet(pp) if os.path.exists(pp) else pd.DataFrame(); DO = pd.read_parquet(dp) if os.path.exists(dp) else pd.DataFrame()
                if len(PO): PO = PO[PO["season"] != y]; DO = DO[DO["season"] != y]
                pd.concat([PO, Po], ignore_index=True).to_parquet(pp); pd.concat([DO, Do], ignore_index=True).to_parquet(dp)
            G.to_parquet(gp + ".tmp"); os.replace(gp + ".tmp", gp)
            T.to_parquet(tp + ".tmp"); os.replace(tp + ".tmp", tp)
            print(f"{y}: {len(g)} games, {len(t)} team-games")


if __name__ == "__main__":
    main()
