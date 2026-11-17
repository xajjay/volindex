# Football power-rating model (work in progress)

Goal: the most accurate game prediction we can build, benchmarked honestly against the betting market, with the pieces
(team strength, home field, player value, coaching) measured from data rather than guessed.

## Run it

```
python tools/model/fb_build.py            # download + boil down 2014-this season (about 3 min, no API key)
python tools/model/fb_ratings.py          # opponent-adjusted ratings + walk-forward backtest vs the market
python tools/model/fb_hfa.py --save       # home-field advantage study  -> tools/cache/fbm/hfa_teams.csv
python tools/model/fb_preview.py          # current ratings + predictions for Tennessee's unplayed games
```

## Data (all free, no key): sportsdataverse-data GitHub releases
| table | what | source tag |
|---|---|---|
| `tools/cache/fbm/games.parquet` | one row per game: teams, site, venue, **attendance**, final score, **market spread and total (DraftKings/ESPN)**, pregame Elo | `cfbfastR_cfb_pbp`, `espn_cfb_schedules` |
| `tools/cache/fbm/teamgame.parquet` | one row per team per game: clean-time EPA/play, success, explosive rate (rush/pass split), early-down, third-down, red zone, sack/INT rate, points per drive, field position, time of possession, kicking EPA, turnovers, penalties | `cfbfastR_cfb_pbp`, `espn_cfb_team_box` |

Also available the same way, not yet used: `espn_cfb_player_box` (every player's game stats), `espn_cfb_pbp` (ESPN's own plays).
Needs the CFBD key (already a GitHub secret, so it can run in the nightly job): preseason talent composite, returning
production, transfer portal, recruiting, coaches, SP+/FPI/PEAR history, venues, game-level betting lines history.

## Method
1. **Ratings.** For each metric: `value(offense o vs defense d) = mu + O[o] + D[d] + h*site`, fit by weighted ridge
   (older games count less, thin samples shrink to average). Strength = O - D. Six metrics: EPA, success, explosive rate,
   rush EPA, pass EPA, points per drive. Garbage time removed (lead > 43/37/27/22 in quarters 1-4).
2. **Prediction.** `margin = a + sum(beta_m * strength difference_m) + home field`; betas learned on earlier seasons only.
3. **Test.** Walk-forward: each game is predicted with only what was known the week before. Compared with the closing line.

## Findings so far (FBS vs FBS, 2018-2026, 6,442 games)
* Market closing line: MAE **12.20**. Our efficiency ratings: MAE **13.05** (with pregame Elo as a feature). Elo alone: 13.08.
* Tuning the half-life (120-1000 days) and ridge strength barely moves it. The gap is missing *information*, not tuning.
* The gap is **weeks 1-3: about 2 points** (no preseason information: transfers, talent, returning production) and
  **weeks 11-14: about 0.3-0.5 points**. Late-season, our in-season efficiency is nearly market quality.
* Blending: `margin = 0.03 + 0.99*market + 0.02*model`. Historically the market already contains everything our ratings
  know; our ratings add nothing on top of it yet. Anything we add must beat that bar.
* **Home field** (fb_hfa.py): league-wide about 2.2-3.1 points (it dipped in 2020-22 and has risen to ~3 since). The
  real difference between teams is small, about 0.6 points (sd). Split-half correlation across eras is r = 0.19.
  Crowd size correlates only weakly (r ~ +0.15) and a bigger-than-usual crowd for the same team shows no effect.
  Shrunken team HFA: Tennessee 2.3, LSU 2.6, Vanderbilt 1.7. The old fixed 3.6 (fit on Tennessee alone) was too high.
  First attempt compared home games to the neutral-site scale and wrongly made good teams look like they had big HFA;
  comparing each team's home games to its own road games fixes it. Documented here so it is not repeated.

## Current read on the remaining games (Nov 17)
* LSU at Tennessee (Nov 21): our ratings Tennessee -7.1 (neutral +4.8, home +2.3). **Market: LSU -1.5** (FanDuel and
  DraftKings opening, Nov 15). An 8.6-point disagreement. The most likely cause is something the ratings cannot see:
  eight Tennessee players are out for the season (WR Matthews, RB Morris, DE Weathersby, LG Moe and others). The
  ratings still count them because they played in earlier games. This is the case for the player-value model below.
* Tennessee at Vanderbilt (Nov 28): our ratings Tennessee -16.9 (neutral +18.6, Vanderbilt HFA -1.7). No line posted yet.

## Next (in order of expected value)
1. **Player value and injuries.** From `player_box` + play-by-play: each player's points added (EPA above a replacement
   at the same position and usage), shrunk toward the position average. A team's rating is then re-computed with the
   players who are actually available. QB, then OL/edge/CB. Needs a reliable injury/availability feed.
2. **Preseason priors.** Talent composite, returning production, transfer-portal net, coach continuity (CFBD key) to fix weeks 1-3.
3. **Market as an input.** When a line exists, model the *difference* from the line, not the margin. Use the market
   spread as a feature and learn what our data adds on top of it (injuries, matchup, rest).
4. **Context features**: rest days, travel, rivalry and ranking, "must-win" (playoff leverage), weather, pace and
   time-of-possession interaction, special teams, turnover luck (regress fumbles/interceptions toward the mean).
5. **Matchup terms**: our model treats offense and defense additively; test run/pass-specific matchups.
6. **Coaching value**: team rating residual vs talent by head coach and coordinator (needs the talent data).
7. Wire the result into `assets/predict.js` as the new margin and uncertainty, keeping the play-by-play simulator.

## Sources reviewed
* cfbstats.com: team stat pages, no export; everything on it is covered by the play-by-play data.
* bcftoys FEI: opponent-adjusted drive efficiency (Tennessee 9th, LSU 6th, Vanderbilt 65th, through week 11).
  A good independent benchmark to compare our ratings to; not needed as an input.
* cfbfastR: the free data used above.
* gameonpaper.com: its robots.txt disallows automated access, so it is not used.
* fourthandshort.com: the page is rendered by JavaScript (no data in the HTML); skipped for now.

## Round 22 results so far (football)
- Extra efficiency metrics (havoc, line yards, splits, tempo, special teams) add no walk-forward lift over the six base metrics.
- Player absence costs, points per game (offense): QB1 -2.2, RB1 -1.1, RB2 -1.7, WR1 -1.1, WR2 -1.1, WR3 -0.3. Defensive absences are not distinguishable from zero with ESPN participation data (+0.33, se 0.27).
- Availability feature improves walk-forward MAE by 0.02 pts; rest by 0.005. The market (MAE 12.20) still beats the model (13.03). Blending: market 0.95, model 0.07.
- CFBD data (talent, returning production, portal, recruiting, lines, SP+, FPI, PPA, coaches, rankings, venues) is pulled by model.yml into tools/cache/fbm/cfbd. Next: preseason priors, market-difference model, matchup report, site wiring.

## Projection model wired into the site (round 22)
`fb_report.py` writes `data/model-fb.js`; `assets/predict.js` reads it. The margin averages SP+, FPI, PEAR and our own play-by-play power rating, adds a home field averaged from the old measured value and the team-specific one (UT 2.3, LSU 2.5, Vanderbilt 1.7, shrunken home-minus-road), and subtracts availability (`fb_avail.py`, SEC report + Ourlads depth charts). The simulation uses each team's real pass rate, plays per game, pace and an opponent-adjusted explosive-play dial. The report tab shows both teams' offense and defense metrics with FBS ranks.
Honest status: the play-by-play model alone still trails the market in walk-forward tests (MAE 13.0 vs 12.2); it enters as one of four ratings, not as the sole input.
Market anchor: when the site has a line for the game, margin = 0.75 x line + 0.25 x model (model already includes availability, which the line prices too, so the model share is kept small), total = average of model and posted over/under. UT snap counts (through Nov 14) are in data/snaps.json and set the slot and share of a starter for each absent player.
