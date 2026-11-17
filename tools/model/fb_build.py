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

PBP_COLS = ["game_id", "pos_team", "def_pos_team", "play_type", "down", "distance", "yards_to_goal", "yards_gained", "EPA",
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

    def agg(x):
        r, q = x[x["is_rush"] == 1], x[x["is_pass"] == 1]
        e = x[x["early"] == 1]
        return pd.Series({
            "plays": len(x), "epa": x["EPA"].mean(), "succ": x["succ"].mean(), "expl": x["expl"].mean(),
            "rush_n": len(r), "rush_epa": r["EPA"].mean(), "rush_succ": r["succ"].mean(), "rush_expl": r["expl"].mean(),
            "pass_n": len(q), "pass_epa": q["EPA"].mean(), "pass_succ": q["succ"].mean(), "pass_expl": q["expl"].mean(),
            "sack_rate": q["sack_"].mean() if len(q) else np.nan, "int_rate": q["int_"].mean() if len(q) else np.nan,
            "early_epa": e["EPA"].mean(), "early_succ": e["succ"].mean(),
            "conv3": x["conv3"].sum() / max(x["is3"].sum(), 1), "rz_epa": x.loc[x["rz"] == 1, "EPA"].mean(),
        })
    k = ["game_id", "pos_team"]
    clean = sp[~sp["gt"]].groupby(k).apply(agg, include_groups=False).add_prefix("c_")
    allp = sp.groupby(k).agg(a_plays=("EPA", "size"), a_epa=("EPA", "mean")).reset_index()
    gtn = sp.groupby(k)["gt"].mean().rename("garbage_share")
    tg = clean.join(gtn).reset_index().merge(allp, on=k, how="left")

    # ----- drives (points, field position, time) -----
    dv = d[d["drive_id"].notna()].drop_duplicates(["game_id", "drive_id"])[["game_id", "pos_team", "drive_pts", "drive_start_yards_to_goal",
                                                                          "drive_time_minutes_elapsed", "drive_time_seconds_elapsed"]].copy()
    dv["secs"] = dv["drive_time_minutes_elapsed"].fillna(0) * 60 + dv["drive_time_seconds_elapsed"].fillna(0)
    dv["start"] = 100 - dv["drive_start_yards_to_goal"]
    dg = dv.groupby(k).agg(drives=("drive_pts", "size"), pts_per_drive=("drive_pts", "mean"), start_yd=("start", "mean"), top_secs=("secs", "sum")).reset_index()
    tg = tg.merge(dg, on=k, how="left")

    # ----- kicking-unit EPA (punts, kickoffs, field goals), from the kicking team's side -----
    kk = d[d["play_type"].isin(KICK) & d["EPA"].notna()].groupby(k)["EPA"].sum().rename("st_epa").reset_index()
    tg = tg.merge(kk, on=k, how="left")
    tg["st_epa"] = tg["st_epa"].fillna(0)

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
            G.to_parquet(gp + ".tmp"); os.replace(gp + ".tmp", gp)
            T.to_parquet(tp + ".tmp"); os.replace(tp + ".tmp", tp)
            print(f"{y}: {len(g)} games, {len(t)} team-games")


if __name__ == "__main__":
    main()
