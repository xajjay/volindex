# The Vol Index models: every formula

Nothing here uses records, polls, rankings, reputation or betting lines. Those only appear in the final blended game
prediction on the site, where they are labeled as separate sources.

## 1. Football

### 1.1 Raw team numbers (`fb_build.py`)
Built from play-by-play (cfbfastR), scrimmage plays only (rush, pass, sack), with **garbage time removed**: a play is
dropped when the lead is more than 43 / 37 / 27 / 22 points in quarters 1 / 2 / 3 / 4.

| Metric | Formula |
|---|---|
| EPA per play | mean expected points added over the offense's clean plays |
| Success rate | share of plays the data marks successful (gains enough yardage for the down) |
| Explosive rate | share of plays that are a rush of 10+ yards or a completed pass of 20+ yards |
| Rush / pass EPA | the same EPA mean, split by play type |
| Points per drive | points scored on the offense's drives (clean time) |
| Pass rate | passes and sacks / all scrimmage plays |

### 1.2 Opponent adjustment (`fb_ratings.py`)
For each metric `m`, every offense-in-a-game is one row:

    m(offense o vs defense d, game g) = mu + O[o] + D[d] + h * site

`O[o]` = how much better than average offense `o` is. `D[d]` = how much MORE than average defense `d` allows.
`site` is +1 for the home offense, -1 for the road offense, 0 neutral. Fit by weighted ridge:

    weight(game) = 0.5 ^ (days since game / 240)         (half-life 240 days: recent games count more)
    minimise  sum weight * (m - fitted)^2  +  20 * (sum O^2 + sum D^2)

The ridge term (lambda = 20) pulls teams with few games toward average. FCS opponents share one pooled team.
**Team strength in metric m = O - D.** Expected metric for offense `o` against defense `d` = `mu + O[o] + D[d]`
(this is what the simulation and the drive model use).

### 1.3 Power rating (`fb_report.py`)
Points better than an average FBS team on a neutral field:

    power(team) = sum over the six metrics of  b_m * strength_m(team)
                + b_talent * (talent - league mean) / 100
                + b_ret    * (returning production - league mean)
                + b_prod   * production score

* The six metrics: EPA/play, success rate, explosive rate, rush EPA, pass EPA, points per drive.
* **Talent** = CFBD team talent composite (recruiting rankings of everyone on the roster).
* **Returning production** = CFBD share of last year's PPA that returns.
* There are also early-season terms: talent and returning production are multiplied by 1 in weeks 1-4 (extra beta) because
  last year's roster information matters most before the season has produced data.
* The betas `b` come from an OLS fit of actual game margins on those differences over 2015-today
  (`data/model-fb.js -> betas`).

### 1.4 Player production (`fb_matchup.py`)
For every player and role (pass, rush, receive) with `n` plays before the game and total EPA `e`:

    value = (e + k * league mean EPA per play) / (n + k)          k = 120 (passers), 70 (rushers), 45 (receivers)

That is a shrunk EPA per play; a freshman starts at the league mean, a proven starter keeps most of his own number.
Players are matched across seasons and schools by first initial + last name. A team's unit score for a role is the
usage-weighted average of `value - league mean` over the players who took snaps in its last four games. Then

    production score = 1.0 * passing unit + 0.5 * rushing unit + 0.5 * receiving unit

Backtest: adding it lowers the average miss by 0.03-0.04 points (small, consistent).

### 1.5 Matchups
* **Offense/defense split** (separate betas for O and D): +0.013 points. Not used (inside noise).
* **Plan-weighted matchup** (each offense's expected rush and pass EPA against THIS defense, weighted by how often it runs
  and passes): +0.001. Not used in the margin; the same expected-efficiency numbers drive the play-by-play simulation.
* Edges shown in each game's table are `beta * (team strength - opponent strength)` in points.

### 1.6 Game margin
    neutral margin = b0 + sum b_m * (strength diff) + talent + returning + production terms
    margin         = neutral + site * team HFA + availability(UT) - availability(opponent)

* **Team home field** = (home margin - road margin against the same opponents) / 2, shrunk toward the FBS average.
* **Availability** (`fb_avail.py`): for each player listed out/doubtful/questionable: `status weight * cost`, with
  weights out 1.0, doubtful 0.9, questionable 0.5, probable 0.1. Cost = measured points per game from real absences
  (QB1 -2.2, RB1 -1.1, RB2 -1.6, WR1 -1.0, WR2 -1.1, WR3 -0.3); labeled priors for TE1 (-0.4), offensive linemen
  (-0.9 x snap share) and defenders (-0.33 x snap share). Players already out long term count zero (already in ratings).
* Win probability = Phi(margin / 15.7).
* **Total** = drives x (expected points per drive for each side, `mu + O + D` from the points-per-drive fit).

## 2. Basketball (men's and women's; `bb_model.py`, `bb_report.py`)

### 2.1 Possessions and metrics
    possessions = ((FGA - OREB + TO + 0.475 FTA) of team + same for opponent) / 2

| Metric | Formula |
|---|---|
| Efficiency | points / possessions x 100 |
| eFG% | (FGM + 0.5 x 3PM) / FGA |
| Turnover rate | turnovers / possessions |
| Offensive rebound rate | OREB / (OREB + opponent DREB) |
| Free-throw rate | FTA / FGA |
| Tempo | possessions |

### 2.2 Opponent adjustment
Same structure as football: `metric = mu + O[o] + D[d] + h*site`, weighted ridge with half-life 100 days and lambda 6, but
**centered on last season's final ratings**: the fit estimates a change from `0.95 x last season's O and D`, so a team
starts the year at (almost) its history and every game moves it. Ratings refit weekly in the backtest. Non-Division-I
opponents share one pooled team.

### 2.3 Player production
Game Score (Hollinger): `PTS + 0.4 FGM - 0.7 FGA - 0.4 (FTA - FTM) + 0.7 OREB + 0.3 DREB + STL + 0.7 AST + 0.7 BLK - 0.4 PF - TO`.

    value per 40 = ((sum GS + 150 * league GS per min) / (minutes + 150) - league GS per min) * 40

Totals carry across seasons and schools (ESPN athlete ids), decaying to 70% each new season. Lineup score of a team =
minutes-weighted average of `value` over the players who played. Backtest: -0.04 (men) to -0.10 (women) points of miss.

### 2.4 Margin
    expected possessions = tempo mean + (tempoO_h + tempoD_a + tempoO_a + tempoD_h) / 2
    f_eff = (netEff_home - netEff_away) * possessions / 100          (same scaling for eFG, turnovers, rebounding, free throws)
    margin = ridge( f_eff, f_efg, f_tov, f_orb, f_ftr, site, lineup diff, lineup diff x early season, matchup terms )

Matchup terms: pace gap x favorite, rebounding matchup `(O_orb + D_orb)` home minus away, turnover matchup, eFG x tempo, and
offense-edge minus defense-edge. Fit on earlier seasons only (walk-forward), test seasons 2018-19 to 2026-27.

* Power rating = this margin against an average Division I team on a neutral court.
* Total = `(2 mu_eff + O_h + D_a + O_a + D_h) * possessions / 100`.
* Win probability = Phi(margin / RMSE) (RMSE 11.6 men, 12.4 women).

### 2.5 Backtest (walk-forward, no records or polls)
| | Men's | Women's |
|---|---|---|
| Net efficiency + site | MAE 9.15 | MAE 9.89 |
| + four factors | 9.14 | 9.88 |
| + player production | 9.11 | 9.81 |
| + early-season interaction | 9.11 | 9.79 |
| + matchup terms | 9.10 | 9.79 |
| Winners picked | 72.3% | 76.5% |

## 3. The blended game prediction on the site
* **Football** (`predict.js`): average of our power rating, SP+, FPI and PEAR; plus home field, availability, rest, recent
  form; then the betting line carries 75% of the margin and 70% of the total.
* **Basketball** (`predict-bb.js`): 75% our power-rating model + 25% the program-history model (Tennessee's level since
  2000-01, opponent program strength, AP rank, court). The model alone beat the history model on Tennessee's own games in
  the walk-forward test.
