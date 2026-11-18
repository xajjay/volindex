"""
The Vol Index - football: player production and matchup effects, tested walk-forward
=====================================================================================
Two questions, each answered by whether it lowers the average miss on seasons the betas never saw:

  1. PLAYER PRODUCTION. Each player gets a regressed value per role (pass / rush / recv) from every play he had BEFORE
     the game: value = (sum EPA + k * league mean) / (plays + k).  A team's unit score in a game is the usage-weighted
     average value of the players who actually took snaps, so a QB change, a transfer or a returning star shows up even
     when team-level efficiency has not caught up.  (Uses the game's real participants, i.e. assumes the lineup is known
     pregame, which is how availability is applied on the site.)
  2. MATCHUP EFFECTS. Offense and defense strengths are split (O and D from the same ridge as the power rating), so the
     model can weight them differently, and plan-weighted terms are added: a team's expected rush and pass EPA against THIS
     defense weighted by how often THIS offense runs and passes.

    python tools/model/fb_matchup.py [--rebuild]
"""
import os, sys, math
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fb_ratings as FR

M = ["c_epa", "c_succ", "c_expl", "c_rush_epa", "c_pass_epa", "pts_per_drive", "c_pass_rate"]
CACHE = os.path.join(FR.DIR, "matchup_features.parquet")
K = {"pass": 120, "rush": 70, "recv": 45}


def player_units(G):
    """usage-weighted regressed player value, per team per game, using only plays before that game"""
    pg = pd.read_parquet(os.path.join(FR.DIR, "players_game.parquet"))
    pg = pg[pg["role"].isin(K)].merge(G[["game_id", "day"]], on="game_id")
    pg[["n", "epa"]] = pg[["n", "epa"]].fillna(0)
    pg = pg[pg["pkey"].notna()]; pg["player"] = pg["pkey"]
    mu = {r: pg[pg.role == r]["epa"].sum() / max(pg[pg.role == r]["n"].sum(), 1) for r in K}
    pg = pg.sort_values(["day", "game_id"])
    tot = {}                                   # (role, player) -> [epa, n]
    out = {}
    for gid, grp in pg.groupby("game_id", sort=False):
        for (team, role), q in grp.groupby(["team", "role"]):
            num = den = 0.0
            for p, n, e in zip(q["player"], q["n"], q["epa"]):
                s = tot.get((role, p), [0.0, 0.0])
                v = (s[0] + K[role] * mu[role]) / (s[1] + K[role])
                num += n * (v - mu[role]); den += n
            out[(gid, team, role)] = num / den if den else 0.0
        for role, p, n, e in zip(grp["role"], grp["player"], grp["n"], grp["epa"]):
            s = tot.setdefault((role, p), [0.0, 0.0]); s[0] += e; s[1] += n
    return out


def current_units(G, recent=4):
    """each team's current unit scores: usage-weighted regressed value of the players who took snaps in its last `recent` games,
    using every play through today.  Returns {(team, role): (score, [(player, usage share, value), ...])}"""
    pg = pd.read_parquet(os.path.join(FR.DIR, "players_game.parquet"))
    pg = pg[pg["role"].isin(K)].merge(G[["game_id", "day"]], on="game_id")
    pg[["n", "epa"]] = pg[["n", "epa"]].fillna(0)
    pg = pg[pg["pkey"].notna()]
    shown = pg.sort_values("season").groupby("pkey")["player"].last()         # a readable name per key (most recent spelling)
    pg["player"] = pg["pkey"]
    mu = {r: pg[pg.role == r]["epa"].sum() / max(pg[pg.role == r]["n"].sum(), 1) for r in K}
    tot = pg.groupby(["role", "player"])[["epa", "n"]].sum()
    val = lambda r, p: (tot.loc[(r, p), "epa"] + K[r] * mu[r]) / (tot.loc[(r, p), "n"] + K[r]) - mu[r]
    out = {}
    last = pg[pg.season == pg.season.max()]
    for (team, role), q in last.groupby(["team", "role"]):
        gids = q.drop_duplicates("game_id").sort_values("day")["game_id"].tolist()[-recent:]
        q = q[q.game_id.isin(gids)].groupby("player")["n"].sum().sort_values(ascending=False)
        if not len(q) or q.sum() <= 0: continue
        sh = q / q.sum()
        out[(team, role)] = (float(sum(sh[p] * val(role, p) for p in sh.index)), [(shown.get(p, p), float(sh[p]), float(val(role, p))) for p in sh.index[:3]])
    return out


def build():
    G, T = FR.load(); P = FR.panel(G, T)
    F = FR.games_features(G, P, 240, 20, metrics=M)
    D = G.merge(F, on="game_id", how="inner")
    D = D[D["margin"].notna() & (D["h_id"] != -1) & (D["a_id"] != -1)].copy()
    U = player_units(G)
    for r in K:
        D["u_" + r + "_h"] = [U.get((g, t, r), 0.0) for g, t in zip(D["game_id"], D["home_team"])]
        D["u_" + r + "_a"] = [U.get((g, t, r), 0.0) for g, t in zip(D["game_id"], D["away_team"])]
    keep = ["game_id", "season", "week", "margin", "spread", "site"] + [c for c in D.columns if c.startswith(tuple(m + "_" for m in M)) or c.startswith("u_")]
    D[keep].to_parquet(CACHE); return D[keep]


def ridge(X, y, lam):
    X1 = np.c_[np.ones(len(X)), X]; pen = np.eye(X1.shape[1]) * lam; pen[0, 0] = 0
    return np.linalg.solve(X1.T @ X1 + pen, X1.T @ y)


def walk(D, feats, lam=50.0, y0=2018):
    out = []
    for y in range(y0, 2027):
        tr, te = D[D.season < y], D[(D.season == y) & D.spread.notna()]
        if len(te) < 100: continue
        mu, sd = tr[feats].mean(), tr[feats].std().replace(0, 1)
        b = ridge(((tr[feats] - mu) / sd).values, tr["margin"].values, lam)
        out.append(te.assign(p=np.c_[np.ones(len(te)), ((te[feats] - mu) / sd).values] @ b))
    R = pd.concat(out); return R, float((R.margin - R.p).abs().mean())


def main():
    D = pd.read_parquet(CACHE) if os.path.exists(CACHE) and "--rebuild" not in sys.argv else build()
    base6 = ["c_epa", "c_succ", "c_expl", "c_rush_epa", "c_pass_epa", "pts_per_drive"]
    for m in M:
        D["f_" + m] = D[m + "_h"] - D[m + "_a"]
        D["fo_" + m] = D[m + "_off_h"] - D[m + "_off_a"]        # offense-only edge
        D["fd_" + m] = D[m + "_def_a"] - D[m + "_def_h"]        # defense-only edge (positive = home defense allows less)
    # expected efficiency of each offense against this defense, then plan-weighted
    for s, o in (("h", "a"), ("a", "h")):
        pr = (0.45 + 0.5 * (D[f"c_pass_rate_off_{s}"] + D[f"c_pass_rate_def_{o}"] * 0.5)).clip(0.3, 0.7)
        er = D[f"c_rush_epa_off_{s}"] + D[f"c_rush_epa_def_{o}"]; ep = D[f"c_pass_epa_off_{s}"] + D[f"c_pass_epa_def_{o}"]
        D["plan_" + s] = (1 - pr) * er + pr * ep
        D["mis_" + s] = (ep - er) * (pr - 0.5)                   # passing mismatch that this team leans on
    D["f_plan"] = D.plan_h - D.plan_a; D["f_mis"] = D.mis_h - D.mis_a
    for r in K: D["f_u_" + r] = D[f"u_{r}_h"] - D[f"u_{r}_a"]
    D["f_u_all"] = D.f_u_pass * 1.0 + D.f_u_rush * 0.5 + D.f_u_recv * 0.5
    b = ["f_" + m for m in base6] + ["site"]
    R0, m0 = walk(D, b); print(f"{len(R0)} test games (2018+). market MAE {np.abs(R0.margin + R0.spread).mean():.3f}\n")
    print(f"{'A. current: six net strengths + site':<52} {m0:.3f}")
    tests = [
        ("B. offense and defense split (12 terms)", ["fo_" + m for m in base6] + ["fd_" + m for m in base6] + ["site"]),
        ("C. + plan-weighted matchup (rush/pass mix)", b + ["f_plan", "f_mis"]),
        ("D. + player production (QB, RB, receivers)", b + ["f_u_pass", "f_u_rush", "f_u_recv"]),
        ("E. + player production, one combined score", b + ["f_u_all"]),
        ("F. split + matchup + players", ["fo_" + m for m in base6] + ["fd_" + m for m in base6] + ["site", "f_plan", "f_mis", "f_u_pass", "f_u_rush", "f_u_recv"]),
    ]
    for name, f in tests:
        R, mae = walk(D, f); print(f"{name:<52} {mae:.3f}  ({m0 - mae:+.3f})")
    R, mae = walk(D, b + ["f_u_pass", "f_u_rush", "f_u_recv"])
    for r in ("pass", "rush", "recv"):
        print(f"   corr(unit {r} edge, residual of A) = {np.corrcoef(R0['margin'] - R0['p'], D.loc[R0.index, 'f_u_' + r])[0,1]:+.3f}")


if __name__ == "__main__":
    main()
