/* ============================================================
   BASEBALL PROJECTED LINEUP  (this is the file you edit)
   Easiest: open the site > Baseball > Lineup > "Edit lineup",
   then "Save to file" and replace this file.
   By hand: each row is ["SPOT", ["starter", "backup", ...]].
   Names must match the roster exactly.
   ============================================================ */
window.LINEUP = window.LINEUP || {};
window.LINEUP.baseball = {
  "label": "2027 projected lineup and pitching staff",
  "updated": "2026-10-16",
  "rev": 4,
  "basedOn": "The Vol Index projected lineup and pitching staff (unofficial), built from the starting lineup of the exhibition against Lipscomb (October 16th)",
  "chart": {
    "Lineup": [
      ["C", ["Trent Grindlinger","Stone Lawless"]],
      ["1B", ["Levi Clark"]],
      ["2B", ["Travis Sanders","Wyatt Hanoian"]],
      ["SS", ["Chris Ramirez"]],
      ["3B", ["Blake Grimmer"]],
      ["LF", ["Tyler Myatt","Blaine Brown"]],
      ["CF", ["Andrew Duncan"]],
      ["RF", ["Sean Dunlap"]],
      ["DH", ["Jack Dugan"]]
    ],
    "Pitching staff": [
      ["Friday", ["Landon Mack"]],
      ["Saturday", ["Cam Appenzeller"]],
      ["Sunday", ["Parker Detmers","Jake McCoy"]],
      ["Midweek", ["Brody Trosclair"]],
      ["Closer", ["Brady Frederick"]],
      ["Setup", ["Hayden Simmerson"]]
    ]
  }
};
