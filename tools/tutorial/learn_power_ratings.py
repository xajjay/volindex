"""
THE VOL INDEX POWER RATING - build it yourself, layer by layer.
Needs only:  pip install pandas numpy      Run:  python learn_power_ratings.py
(Put the 5 CSV files in the same folder as this script.)

Layers (each one is tested out-of-sample so you can see whether it earns its place):
  1. Gilbert baseline : rating = average opponent rating + average margin   (Point-Jacobi)
                        home field is REMOVED from the margins first, so ratings are neutral-field
  1b. Prior           : early in the season a team starts from the rating its TALENT predicts, not from zero
  2. Talent           : 247 team talent composite, weighted heavily EARLY in the season
  3. Efficiency       : the same Gilbert trick applied to EPA / success / explosiveness margins
  4. Home field       : added ONLY when you predict a specific game
  5. Availability     : per-game adjustment (not part of the power rating itself)
"""
import os
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))     # so it works no matter which folder the terminal is in

# ---------------------------------------------------------------- data
G = pd.read_csv(os.path.join(HERE, "games.csv")).dropna(subset=["home_score", "away_score", "home_team"])
G["margin"] = G.home_score - G.away_score                       # home minus away
G["neutral"] = G.neutral_site.fillna(False).astype(bool)
G["fbs_game"] = (G.home_div == "fbs") & (G.away_div == "fbs")
TAL = pd.read_csv(os.path.join(HERE, "talent.csv")).set_index(["season", "team"]).talent
EFF = pd.read_csv(os.path.join(HERE, "team_game_efficiency.csv"))
AVL = pd.read_csv(os.path.join(HERE, "availability.csv"))
METRICS = ["c_epa", "c_succ", "c_expl", "c_rush_epa", "c_pass_epa", "pts_per_drive"]


# ------------------------------------------------- LAYER 1: Gilbert's formula
def gilbert(home, away, margin, iters=500, prior=None, k=0.0):
    """rating(team) = mean over its games of [ opponent's rating + team's margin in that game ]
    Solved by repeating the update until nothing moves (Point Jacobi). Ratings are centred on 0
    (Gilbert adds 100 for display; centring doesn't change any difference)."""
    teams = pd.unique(np.r_[home, away]); ix = {t: i for i, t in enumerate(teams)}
    h = np.array([ix[t] for t in home]); a = np.array([ix[t] for t in away]); n = len(teams)
    games_played = np.bincount(h, minlength=n) + np.bincount(a, minlength=n)
    p = np.zeros(n) if prior is None else np.array([prior.get(t, 0.0) for t in teams])   # optional starting belief
    r = p.copy()
    for _ in range(iters):
        total = np.bincount(h, margin + r[a], n) + np.bincount(a, -margin + r[h], n)  # sum of (opp rating + margin)
        new = (total + k * p) / (games_played + k)                # k = how many 'pretend games' the prior is worth
        new -= new.mean()                                         # pin the scale (ratings aren't unique otherwise)
        if np.abs(new - r).max() < 1e-8: r = new; break
        r = new
    return dict(zip(teams, r))


def rate(games, prior=None, k=0.0):
    """Neutral-field Gilbert ratings: guess HFA, remove it from home margins, re-rate, re-estimate HFA, repeat."""
    h = 2.5
    for _ in range(4):
        m = games.margin.values - np.where(games.neutral.values, 0, h)
        r = gilbert(games.home_team.values, games.away_team.values, m, prior=prior, k=k)
        h = estimate_hfa(games, r)
    return r, h


# ------------------------------------------------- LAYER 2: home field
def estimate_hfa(games, ratings):
    """HFA = average amount the home team beats the rating gap, in non-neutral games."""
    g = games[~games.neutral]
    gap = g.home_team.map(ratings).values - g.away_team.map(ratings).values
    return float((g.margin.values - gap).mean())


# ------------------------------------------------- LAYER 4: efficiency = Gilbert on stat margins
def efficiency_ratings(games, upto_games):
    """Same formula, but the 'margin' is the difference in an efficiency stat (EPA/play etc.)."""
    e = EFF.set_index(["game_id", "team"])
    out = {}
    d = games.copy()
    for m in METRICS:
        hv = pd.Series(list(zip(d.game_id, d.home_team))).map(e[m]).values
        av = pd.Series(list(zip(d.game_id, d.away_team))).map(e[m]).values
        ok = ~(np.isnan(hv) | np.isnan(av))
        out[m] = gilbert(d.home_team.values[ok], d.away_team.values[ok], (hv - av)[ok]) if ok.sum() > 50 else {}
    return out


# ------------------------------------------------- the prior: this season's talent
FINAL = {y: rate(G[G.season == y])[0] for y in range(2015, 2026)}      # end-of-year ratings, used only to learn the talent slope


def make_prior(y):
    """Start each team from the rating its TALENT predicts (this season's roster only; no team carries last season's rating).
    Last season is used only to learn how many rating points one talent point is worth."""
    last = FINAL.get(y - 1, {})
    ts = [t for t in last if (y - 1, t) in TAL.index and (y, t) in TAL.index]
    if len(ts) < 50: return None
    slope = np.polyfit([TAL[(y - 1, t)] / 100 for t in ts], [last[t] for t in ts], 1)[0]   # points per 100 talent points
    tm = np.mean([TAL[(y, t)] for t in ts]) / 100
    return {t: slope * (TAL[(y, t)] / 100 - tm) for t in ts}


# ------------------------------------------------- build one row per game, using ONLY earlier games
def build_features(seasons, min_week=3):
    rows = []
    for y in seasons:
        S = G[G.season == y]; prior = make_prior(y)
        for w in sorted(S.week.unique()):
            if w < min_week: continue
            past, today = S[S.week < w], S[(S.week == w) & S.fbs_game]
            if len(past) < 60 or today.empty: continue
            base, _ = rate(past, prior, k=3 if prior else 0)
            eff = efficiency_ratings(past, None)
            for _, g in today.iterrows():
                H, A = g.home_team, g.away_team
                if H not in base or A not in base or any(H not in eff[m] or A not in eff[m] for m in METRICS): continue
                rows.append(dict(
                    game_id=g.game_id, season=y, week=w, margin=g.margin, neutral=g.neutral,
                    gilbert=base[H] - base[A],
                    site=0.0 if g.neutral else 1.0,
                    talent=(TAL.get((y, H), np.nan) - TAL.get((y, A), np.nan)) / 100,
                    early=1.0 if w <= 5 else 0.0,
                    **{"eff_" + m: eff[m][H] - eff[m][A] for m in METRICS}))
    df = pd.DataFrame(rows).dropna(subset=["talent"])
    df["gilbert_early"] = df.gilbert * df.early            # lets the model trust Gilbert differently early in the year
    df["talent_early"] = df.talent * df.early              # ...and talent MORE early in the year
    a = AVL.set_index(["game_id", "team"]).avail
    gm = G.set_index("game_id")
    h = pd.Series(list(zip(df.game_id, df.game_id.map(gm.home_team)))).map(a).values
    aw = pd.Series(list(zip(df.game_id, df.game_id.map(gm.away_team)))).map(a).values
    df["avail"] = np.nan_to_num(h) - np.nan_to_num(aw)    # home availability cost minus away (costs are <= 0)
    return df


# ------------------------------------------------- stage 2: weights via least squares
def walk_forward(df, cols, first_test_year=2019):
    """Train on every earlier season, predict the next one. Returns (avg miss, % winners right)."""
    preds = []
    for y in sorted(df.season.unique()):
        if y < first_test_year: continue
        tr, te = df[df.season < y], df[df.season == y]
        X = lambda d: np.c_[np.ones(len(d)), d[cols].values]
        beta = np.linalg.lstsq(X(tr), tr.margin.values, rcond=None)[0]
        preds.append(te.assign(pred=X(te) @ beta))
    o = pd.concat(preds)
    return round((o.margin - o.pred).abs().mean(), 2), round(((o.pred > 0) == (o.margin > 0)).mean() * 100, 1), len(o)


if __name__ == "__main__":
    seasons = [y for y in range(2016, 2026) if y != 2020]
    print("building walk-forward features (about a minute)...")
    df = build_features(seasons); EFFC = ["eff_" + m for m in METRICS]

    b = df[df.season >= 2019]
    raw = b.gilbert + np.where(b.neutral, 0, 2.5)
    print("\nBACKTEST (avg points missed, % winners right, games)")
    print("Gilbert prior-informed alone + 2.5 HFA ", round((b.margin - raw).abs().mean(), 2), round(((raw > 0) == (b.margin > 0)).mean() * 100, 1), len(b))
    steps = [("+ rescale + fitted home field", ["gilbert", "site"]),
             ("+ early-season weighting", ["gilbert", "gilbert_early", "site"]),
             ("+ talent (more early)", ["gilbert", "gilbert_early", "site", "talent", "talent_early"]),
             ("+ efficiency", ["gilbert", "gilbert_early", "site", "talent", "talent_early"] + EFFC),
             ("+ availability (per game)", ["gilbert", "gilbert_early", "site", "talent", "talent_early", "avail"] + EFFC)]
    for name, cols in steps: print(f"{name:<32}", *walk_forward(df, cols))

    # ---- fit on everything, then show the CURRENT power ratings (neutral field, average opponent = 0)
    cols = steps[-1][1]
    X = np.c_[np.ones(len(df)), df[cols].values]; beta = dict(zip(["b0"] + cols, np.linalg.lstsq(X, df.margin.values, rcond=None)[0]))
    print("\nfitted weights:", {k: round(float(v), 2) for k, v in beta.items()})
    y = int(G.season.max()); S = G[G.season == y]; wk = S.week.max(); early = 1.0 if wk <= 5 else 0.0
    prior = make_prior(y); base, hfa_now = rate(S, prior, k=3); eff = efficiency_ratings(S, None)
    fbs = sorted(set(S[S.fbs_game].home_team) | set(S[S.fbs_game].away_team))
    fbs = [t for t in fbs if t in base and ((S.home_team == t) | (S.away_team == t)).sum() >= 7]
    mean = lambda d: np.mean([d[t] for t in fbs])
    tm = np.nanmean([TAL.get((y, t), np.nan) for t in fbs])
    pure = rate(S)[0]; pm = mean({t: pure[t] for t in fbs})
    rows = []
    for t in fbs:
        g = (beta["gilbert"] + beta["gilbert_early"] * early) * (base[t] - mean(base))
        tl = (beta["talent"] + beta["talent_early"] * early) * (np.nan_to_num(TAL.get((y, t), tm), nan=tm) - tm) / 100
        ef = sum(beta["eff_" + m] * (eff[m][t] - mean(eff[m])) for m in METRICS)
        rows.append((t, g + tl + ef, g, tl, ef, pure[t] - pm))
    R = pd.DataFrame(rows, columns=["team", "power", "gilbert_part", "talent_part", "efficiency_part", "pure_gilbert"]).sort_values("power", ascending=False)
    R["power"] -= R.power.mean(); R.insert(0, "rank", range(1, len(R) + 1))
    R["pure_rank"] = R.pure_gilbert.rank(ascending=False).astype(int)
    print(f"\nTOP 25 POWER RATINGS, {y} through week {wk}  (points better than an average FBS team, neutral field)")
    print(R.head(25).round(1).to_string(index=False))
    R.to_csv(os.path.join(HERE, "my_power_ratings.csv"), index=False)

    # ---- predictions: power gap + home field (ONLY here) + availability swing
    pw = R.set_index("team").power
    def predict(home, away, avail_home=0.0, avail_away=0.0, neutral=False):
        gap = pw[home] - pw[away]; hf = 0.0 if neutral else beta["site"]; av = beta["avail"] * (avail_home - avail_away)
        return gap + hf + av + beta["b0"], gap, hf, av
    print("\nPREDICTIONS   (positive = home team wins by that many)")
    for home, away, ah, aa in [("Tennessee", "LSU", -3.68, -1.03), ("Vanderbilt", "Tennessee", 0.0, -3.68)]:
        m, gap, hf, av = predict(home, away, ah, aa)
        print(f"  {away} at {home}: {home if m > 0 else away} by {abs(m):.1f}   (power gap {gap:+.1f}, home field {hf:+.1f}, availability {av:+.1f})")
