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
  "updated": "2026-10-13",
  "rev": 2,
  "basedOn": "The Vol Index projected lineup and pitching staff (unofficial), built from 2026 stats and transfer additions",
  "chart": {
    "Lineup": [
      ["C", ["Trent Grindlinger","Stone Lawless","Sean Dunlap"]],
      ["1B", ["Levi Clark","Cooper Shrum"]],
      ["2B", ["Wyatt Hanoian","Mario Trivella"]],
      ["SS", ["Chris Ramirez","Jaxson Wood"]],
      ["3B", ["Travis Sanders","Colt Springall"]],
      ["LF", ["Andrew Duncan","Jack Dugan"]],
      ["CF", ["Braydon Kersey","AJ Curry"]],
      ["RF", ["Blaine Brown","Tyler Myatt"]],
      ["DH", ["Blake Grimmer","Stone Lawless"]]
    ],
    "Pitching staff": [
      ["Friday", ["Landon Mack","Parker Detmers"]],
      ["Saturday", ["Cam Appenzeller","Jake McCoy"]],
      ["Sunday", ["Jake McCoy","Ricky Ojeda"]],
      ["Midweek", ["Brody Trosclair","Blaine Brown","Braydon Kersey"]],
      ["Closer", ["Brady Frederick","Hayden Simmerson"]],
      ["Setup", ["Hayden Simmerson","Cam Appenzeller"]]
    ]
  }
};
