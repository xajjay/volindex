"""
The Vol Index - player value and availability
=============================================
How many points is a player worth, and what happens to a team when he is out?

    python tools/model/fb_players.py --build      # per-game player table from play-by-play (about 3 minutes), 2014-this season
    python tools/model/fb_players.py              # estimate player values from real historical absences and print the report

Method (no injury feed needed for the history)
  * Per game we know who touched the ball: passer, rushers, targets (and defenders who made sacks, pass breakups, picks).
  * A team's "regular" players in a season are those who played in most of its games.  When a regular is missing from a
    game, that is a real absence (injury, suspension, rest), whatever the reason.
  * Take each team-game's offensive and defensive result minus what its pre-game rating predicted, and regress it on the
    value of the regulars who were missing.  The coefficient is what an absent player costs, in points per game, estimated
    from thousands of real absences.  It is not a guess and not a lookup table.
  * A player's own value = his points added per game (EPA above replacement at his job), shrunk toward the position
    average because a few games are noisy.
Offensive linemen and most defenders do not show in these box-score stats, so their value is entered as a position-group
prior (clearly labeled) until a snap-count source is added.
"""
import os, sys, tempfile
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fb_build as B
import fb_ratings as FR

PG = os.path.join(FR.DIR, "players_game.parquet")
COLS = ["play_text", "game_id", "pos_team", "def_pos_team", "play_type", "down", "yards_gained", "EPA", "success", "rush", "pass", "sack", "int", "period",
        "pos_team_score", "def_pos_team_score", "passer_player_name", "rusher_player_name", "receiver_player_name",
        "sack_player_name", "pass_breakup_player_name", "interception_player_name", "completion"]


_NM = r"#\d+\s+([A-Z][A-Za-z]*\.\s?[A-Za-z'\-]+)"
def pkey(name):
    """'Sam Leavitt', 'S. Leavitt', 'S.Leavitt' -> 's leavitt' (first initial + last name), so one player is one key across seasons"""
    if not isinstance(name, str) or not name.strip(): return None
    t = name.replace(".", ". ").replace("'", "").split()
    t = [x for x in t if x.lower().strip(".") not in ("jr", "sr", "ii", "iii", "iv", "v")]
    return (t[0][0] + " " + t[-1]).lower() if len(t) >= 2 else None


def fill_names(d):
    """Recent play-by-play (this season) arrives with jersey-number text and no parsed names: '#11 F.Brandon pass complete ... to #4 M.Matthews'.
    Where the name columns are mostly empty, read passer, rusher and receiver out of the play text."""
    ps = d["pass"] == 1
    if ps.sum() and d.loc[ps, "passer_player_name"].notna().mean() > 0.3: return d
    t = d["play_text"].fillna("")
    qb = t.str.extract(_NM + r"\s+(?:pass|sacked)")[0]
    rb = t.str.extract(_NM + r"\s+(?:rush|run)\b")[0]
    rc = t.str.extract(r"\bto\s+" + _NM)[0]
    d = d.copy()
    d.loc[d["passer_player_name"].isna(), "passer_player_name"] = qb
    d.loc[d["rusher_player_name"].isna(), "rusher_player_name"] = rb
    d.loc[d["receiver_player_name"].isna() & ps, "receiver_player_name"] = rc
    return d


def build():
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for y in range(2014, 2027):
            p = os.path.join(tmp, f"{y}.parquet")
            try: B.fetch("cfbfastR_cfb_pbp", f"play_by_play_{y}.parquet", p)
            except Exception as e: print(y, "skipped", e); continue
            d = pd.read_parquet(p, columns=COLS); os.remove(p)
            d["game_id"] = d["game_id"].astype("int64")
            d = fill_names(d)
            s0 = d[((d["rush"] == 1) | (d["pass"] == 1) | (d["sack"] == 1)) & d["EPA"].notna() & d["down"].notna()].copy()
            s0["gt"] = B.garbage(s0)
            s0["succ"] = s0["success"].fillna(0)
            for role, mask, col in [("pass", (s0["pass"] == 1) | (s0["sack"] == 1), "passer_player_name"),
                                    ("rush", (s0["rush"] == 1) & (s0["sack"] != 1), "rusher_player_name"),
                                    ("recv", (s0["pass"] == 1) & (s0["sack"] != 1), "receiver_player_name")]:
                df = s0[mask & s0[col].notna()]
                allp = df.groupby(["game_id", "pos_team", col]).size().rename("n_all")           # presence: every play, garbage time too
                c = df[~df["gt"]].groupby(["game_id", "pos_team", col]).agg(n=("EPA", "size"), epa=("EPA", "sum"), succ=("succ", "sum"), yds=("yards_gained", "sum"))
                g = pd.concat([allp, c], axis=1).fillna(0).reset_index()
                g.columns = ["game_id", "team", "player", "n_all", "n", "epa", "succ", "yds"]; g["role"] = role; g["season"] = y; g["pkey"] = g["player"].map(pkey); rows.append(g)
            for role, col in [("sack", "sack_player_name"), ("pbu", "pass_breakup_player_name"), ("int", "interception_player_name")]:
                g = d[d[col].notna()].groupby(["game_id", "def_pos_team", col]).size().reset_index(name="n")
                g.columns = ["game_id", "team", "player", "n"]; g["n_all"] = g["n"]; g["role"] = role; g["epa"] = 0.0; g["succ"] = 0.0; g["yds"] = 0.0; g["season"] = y; rows.append(g)
            print(y, "done", flush=True)
    pd.concat(rows, ignore_index=True).to_parquet(PG)


def regulars(PGm):
    """Per team-season: who is a regular at each role, and how much he is worth per game when he plays."""
    PGm = PGm.copy()
    games = PGm.groupby(["season", "team"])["game_id"].nunique().rename("team_games")
    agg = PGm.groupby(["season", "team", "player", "role"]).agg(g=("game_id", "nunique"), n=("n", "sum"), epa=("epa", "sum")).reset_index()
    agg = agg.merge(games.reset_index(), on=["season", "team"])
    return agg


def main():
    if "--build" in sys.argv or not os.path.exists(PG):
        build(); return
    PGm = pd.read_parquet(PG)
    G, T = FR.load()
    agg = regulars(PGm)
    # share of the team's plays at the role (a QB with 90% of the team's dropbacks is "the" QB)
    tot = agg.groupby(["season", "team", "role"])["n"].transform("sum")
    agg["share"] = agg["n"] / tot
    agg["pg"] = agg["epa"] / agg["g"]                     # points added per game he played
    keyroles = {"pass": 1, "rush": 2, "recv": 3}
    agg["rank"] = agg.groupby(["season", "team", "role"])["n"].rank(ascending=False, method="first")
    ag = agg[agg["role"].isin(keyroles)].copy()
    ag["lim"] = ag["role"].map(keyroles)
    key = ag[(ag["rank"] <= ag["lim"]) & (ag["g"] >= 0.7 * ag["team_games"])]
    print(f"{len(key)} key offensive players (QB1, RB1-2, WR1-3) across seasons")

    # which games each key player missed (he was a regular, but is not in the game's box)
    present = PGm[PGm["n_all"] >= 3].groupby(["season", "team", "player", "role"])["game_id"].apply(set).rename("played").reset_index()
    key = key.merge(present, on=["season", "team", "player", "role"])
    allg = T[["game_id", "season", "team", "c_epa", "c_plays"]].copy()
    teamgames = allg.groupby(["season", "team"])["game_id"].apply(set).rename("all").reset_index()
    key = key.merge(teamgames, on=["season", "team"])
    key["missed"] = key.apply(lambda r: r["all"] - r["played"], axis=1)
    miss = key.explode("missed").dropna(subset=["missed"]).rename(columns={"missed": "game_id"})
    miss["game_id"] = miss["game_id"].astype("int64")
    print(f"{len(miss)} player-games missed by a key player")

    # pre-game expected offense/defense EPA/play from ratings, per team-game (use the rating-walk features)
    P = FR.panel(G, T)
    teams = sorted(set(P["o"]) | set(P["d"]))
    G["wk"] = G["date"].dt.to_period("W-SUN").astype(str)
    rows = []
    for wk, grp in G[G["season"] >= 2015].groupby("wk"):
        cut = grp["day"].min()
        r = FR.fit(P, "c_epa", cut, 240, 20, teams)
        if r is None: continue
        O, D, h, mu, idx = r
        for _, g in grp.iterrows():
            for team, o, d_, s in ((g["home_team"], g["h_id"], g["a_id"], 1 * g["site"]), (g["away_team"], g["a_id"], g["h_id"], -1 * g["site"])):
                if o in idx and d_ in idx:
                    rows.append((g["game_id"], team, mu + O[idx[o]] + D[idx[d_]] + h * s))
    E = pd.DataFrame(rows, columns=["game_id", "team", "exp_epa"])
    X = allg.merge(E, on=["game_id", "team"], how="inner")
    X["resid"] = X["c_epa"] - X["exp_epa"]                    # EPA/play above what the ratings expected, this game
    X = X[(X["c_plays"] >= 30)]
    # indicator regression: points per game the offense loses when each key player is out (QB1, RB1, RB2, WR1-3)
    miss["tag"] = miss["role"] + miss["rank"].astype(int).astype(str)
    I = miss.assign(v=1).pivot_table(index=["game_id", "team"], columns="tag", values="v", aggfunc="max", fill_value=0).reset_index()
    X = X.merge(I, on=["game_id", "team"], how="left")
    tags = [c for c in ["pass1", "rush1", "rush2", "recv1", "recv2", "recv3"] if c in X.columns]
    X[tags] = X[tags].fillna(0)
    X["resid_pts"] = X["resid"] * X["c_plays"]
    A = np.c_[np.ones(len(X)), X[tags].values]
    coef = np.linalg.lstsq(A, X["resid_pts"].values, rcond=None)[0]
    res = X["resid_pts"].values - A @ coef
    se = np.sqrt(np.diag(np.linalg.inv(A.T @ A)) * (res ** 2).sum() / (len(X) - A.shape[1]))
    print("\nOffense points per game lost when the player is out (negative = hurts), from real absences:")
    for c, b, s_ in zip(["intercept"] + tags, coef, se):
        print(f"  {c:<10} {b:+.2f}  (se {s_:.2f}, t {b / s_:+.1f})   n out = {int(X[c].sum()) if c in X else len(X)}")
    cols = tags
    out = {"coef": dict(zip(["intercept"] + cols, [float(x) for x in coef])), "se": dict(zip(["intercept"] + cols, [float(x) for x in se])), "n": int(len(X))}
    import json
    with open(os.path.join(FR.DIR, "player_value.json"), "w") as f: json.dump(out, f, indent=1)


if __name__ == "__main__":
    main()
