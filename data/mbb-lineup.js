/* ============================================================
   MEN'S BASKETBALL PROJECTED LINEUP  (this is the file you edit)
   Easiest: open the site > Men's Basketball > Lineup > "Edit lineup",
   then "Save to file" and replace this file.
   By hand: each row is ["SPOT", ["starter", "backup", ...]].
   Names must match the roster exactly.
   ============================================================ */
window.LINEUP = window.LINEUP || {};
window.LINEUP.mbb = {
  "label": "2026-27 projected starting five",
  "updated": "2026-11-04",
  "rev": 5,
  "basedOn": "The Vol Index projected starting five (unofficial); adjusted after the exhibitions (Xavier, Duke): starts and minutes from the box scores",
  "chart": {
    "Starting five": [
      ["PG", ["Terrence Hill Jr.","Dai Dai Ames","Troy Henderson"]],
      ["SG", ["Dai Dai Ames","Troy Henderson","Marquis Clark","Tyler Lundblade"]],
      ["SF", ["Juke Harris","Jalen Haralson","Manny Green"]],
      ["PF", ["Jalen Haralson","Miles Rubin","Braedan Lue","Chris Washington Jr."]],
      ["C", ["DeWayne Brown II","Miles Rubin","Christian Fermin","Jalen Washington"]]
    ],
    "Rotation": [
      ["6th man", ["Troy Henderson"]],
      ["Bigs off bench", ["Miles Rubin","Braedan Lue"]],
      ["Developing", ["Christian Fermin","Manny Green","Marquis Clark","Ralph Scott","Chris Washington Jr."]],
      ["Not yet available", ["Tyler Lundblade","Jalen Washington"]]
    ]
  }
};
