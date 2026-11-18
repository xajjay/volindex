/* Ratings typed in by hand from sites that need a subscription or a login (KenPom, EvanMiya).
   tools/update_bb_ratings.py reads this file on every update and blends these numbers into the game predictions.
   A source only counts for a game when BOTH Tennessee and the opponent have it, so add the opponent too.

   How to fill it in (men's example):
     "Tennessee":      { "kenpom": [118.4, 94.1, 68.9], "evanmiya": 21.3 },
     "Michigan State": { "kenpom": [119.0, 92.5, 67.2], "evanmiya": 23.0 }

     kenpom    [adjusted offense, adjusted defense, adjusted tempo]   (AdjO, AdjD, AdjT on kenpom.com)
     evanmiya  the team's BPR (one number, points per 100 possessions better than average)

   Team names must be spelled the way the site's schedule spells them. Leave a sport as {} when you have nothing to add.
   Last filled in Nov. 18, 2026 from KenPom (all teams) and EvanMiya (top ~50 teams only; the rest have no EvanMiya number). */
window.BB_POWER_MANUAL = {
 "mbb": {
  "Tennessee": {"kenpom": [115.9, 93.0, 68.1], "evanmiya": 21.9},
  "Coastal Carolina": {"kenpom": [102, 108.7, 70]},
  "Maryland": {"kenpom": [117, 101.2, 71.1]},
  "Florida State": {"kenpom": [116.1, 100.4, 72.4]},
  "NC State": {"kenpom": [117.5, 102.2, 69.4], "evanmiya": 17.6},
  "Purdue": {"kenpom": [119.4, 99.8, 65.7], "evanmiya": 17.6},
  "Morehead State": {"kenpom": [100.8, 116.5, 66.5]},
  "Marist": {"kenpom": [96.5, 107.2, 68.5]},
  "Norfolk State": {"kenpom": [99.7, 116.3, 67.9]},
  "Vanderbilt": {"kenpom": [122.6, 92.9, 70], "evanmiya": 22.4},
  "Auburn": {"kenpom": [117.9, 97.6, 70.3], "evanmiya": 17.4},
  "LSU": {"kenpom": [118.9, 95.9, 71.6], "evanmiya": 25.6},
  "Missouri": {"kenpom": [121.7, 98.4, 69.7], "evanmiya": 19.6},
  "Arkansas": {"kenpom": [119.4, 100, 69.8], "evanmiya": 15.6},
  "Kentucky": {"kenpom": [119.9, 103.6, 69.5], "evanmiya": 15.7},
  "Texas A&M": {"kenpom": [121.4, 96.3, 75], "evanmiya": 21.7},
  "Florida": {"kenpom": [126.1, 92.9, 70], "evanmiya": 30.9},
  "Georgia": {"kenpom": [118.4, 100.7, 71.4], "evanmiya": 19.6},
  "Oklahoma": {"kenpom": [114.5, 101.6, 67.9]},
  "Ole Miss": {"kenpom": [114.8, 92.7, 70.4], "evanmiya": 19.9},
  "Alabama": {"kenpom": [123.5, 99.4, 76], "evanmiya": 22.2},
  "South Carolina": {"kenpom": [112.7, 102.4, 66.8]},
  "Texas": {"kenpom": [122.5, 94.9, 69.6], "evanmiya": 24.7},
  "Mississippi State": {"kenpom": [115, 100.8, 70.9]}
 },
 "wbb": {}
};
