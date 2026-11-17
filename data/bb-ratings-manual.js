/* Ratings typed in by hand from sites that need a subscription or a login (KenPom, EvanMiya).
   tools/update_bb_ratings.py reads this file on every update and blends these numbers into the game predictions.
   A source only counts for a game when BOTH Tennessee and the opponent have it, so add the opponent too.

   How to fill it in (men's example):
     "Tennessee":      { "kenpom": [118.4, 94.1, 68.9], "evanmiya": 21.3 },
     "Michigan State": { "kenpom": [119.0, 92.5, 67.2], "evanmiya": 23.0 }

     kenpom    [adjusted offense, adjusted defense, adjusted tempo]   (AdjO, AdjD, AdjT on kenpom.com)
     evanmiya  the team's BPR (one number, points per 100 possessions better than average)

   Team names must be spelled the way the site's schedule spells them. Leave a sport as {} when you have nothing to add. */
window.BB_POWER_MANUAL = {
 "mbb": {},
 "wbb": {}
};
