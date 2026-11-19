# Vol Index power rating: build it, run it, break it

This folder rebuilds the Vol Index football power rating in about 150 lines of Python so you can read every step, change it, and see what happens to the accuracy. You only need `pandas` and `numpy`.

## What the model is

```
power rating  =  Gilbert rating (opponent average + margin of victory, home field removed, started from talent + last year)
               + talent (extra weight in weeks 1-5)
               + efficiency (offense minus defense: EPA, success rate, explosiveness, rush EPA, pass EPA, points per drive)

game prediction = power rating gap + home field (added only here) + availability swing + a tiny intercept
```

| Piece | Where it lives in `learn_power_ratings.py` |
|---|---|
| Gilbert's formula | `gilbert()` |
| Home field removed from the margins, estimated from the data | `rate()` and `estimate_hfa()` |
| Early-season prior (talent + last season) | `make_prior()` |
| Efficiency with the same trick | `efficiency_ratings()` |
| Walk-forward rows, using only past games | `build_features()` |
| Weights by least squares and the backtest | `walk_forward()` |
| Predictions for a matchup | `predict()` at the bottom |

The intercept is the regression's constant (about 0). It is the margin predicted when every input is zero and does nothing for rankings.

## Which program to use (you've barely used Python, so keep it simple)

**Use Visual Studio Code (VS Code).** It is free, works on Windows, and shows your files, code and terminal in one window.

1. Install it from https://code.visualstudio.com and open it.
2. Click the Extensions icon (four squares, left side), search `Python`, and install the one from Microsoft.
3. `File > Open Folder...` and choose the folder that holds `learn_power_ratings.py`.
4. Open a terminal inside VS Code: `Terminal > New Terminal`. It opens already in your folder.
5. You already installed Python and pandas. If numpy is missing, run `pip install pandas numpy`.
6. Run it: `python learn_power_ratings.py` (about 10 seconds). You should see a backtest table, a top 25, and two game predictions.

**If anything breaks:** `python --version` should print a version. If `python` is not found, use `py learn_power_ratings.py`. The CSV files must be in the same folder as the script.

**Optional, nicer for experiments:** Google Colab (colab.research.google.com) needs no install. Upload the CSV files and paste the script in.

## How to read the output

- **Backtest table.** Each row adds one layer. The numbers are the average points the prediction misses by, the percent of winners picked right, and the number of games. Lower is better. Every prediction uses only games played before it, so it can't cheat.
- **Top 25.** Power is points better than an average FBS team on a neutral field. `pure_gilbert` and `pure_rank` are Gilbert's formula alone, so you can see how much the other layers move each team.
- **Predictions.** Home team first. The breakdown shows the power gap, home field and availability.

## Exercises (do them in this order)

Change one thing, re-run, and write down what moved. Keep a copy of the original file first (`copy learn_power_ratings.py my_version.py`).

1. **Read it, don't change it.** Put `print()` lines inside `gilbert()` to watch the ratings settle. Print the ratings after 1, 5 and 50 loops.
2. **Break the prior.** In `build_features`, change `k=3` to `0`, then to `8`. What happens to the early-week misses? (Filter `df[df.week <= 5]` before the backtest.)
3. **Home field.** Print `hfa_now` (it is returned by `rate`). Compare it to the 2.5 in `predict`. Try estimating it separately for each conference.
4. **Remove a layer.** Delete `"talent"` and `"talent_early"` from the lists in `steps`. How much does the miss grow? Do the same with the efficiency terms.
5. **Add a feature.** Rest days, a first-year-coach flag, or travel distance. Add a column in `build_features`, add its name to a `steps` list, and see if the miss falls by more than 0.05 points. If it doesn't, it is noise.
6. **Change the home-field assumption in the picks.** Replace `beta["site"]` with 3.0 in `predict()`. Which games flip?
7. **Predict a game you care about.** Add a line to the `for home, away, ...` list at the bottom, using the team names exactly as they appear in `games.csv`.
8. **Beat it.** Find a feature or setting that lowers the 2019-2025 miss below 12.62. Check it also helps in each single season. One lucky year proves nothing.

## Things to watch for (this is the real analyst skill)

- **Leakage.** Never use a number from after the game to predict it. Everything here is built from games played earlier.
- **Noise.** A feature that lowers the miss by 0.01 is noise. Try it on different seasons before trusting it.
- **Overlap.** Efficiency stats and the Gilbert rating measure similar things, so their weights shouldn't be read one at a time.
- **Small samples.** 51 home games is not enough to tell a team's home field from the league average.

## Files

| File | What it is |
|---|---|
| `games.csv` | Every FBS and FCS game, 2015 to week 11 of 2026 |
| `talent.csv` | 247 team talent composite by team and season |
| `team_game_efficiency.csv` | Per-game EPA, success rate, explosiveness, rush and pass EPA, points per drive (garbage time removed) |
| `availability.csv` | Per-game availability cost (0 or negative points) |

Not in this folder: the production Vol Index model (`tools/model/fb_report.py` in the repo), which uses a time-decayed regression that splits offense from defense and ranks a bit better than this simplified version (12.57 vs 12.62 average miss).
