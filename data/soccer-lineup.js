/* ============================================================
   SOCCER PROJECTED LINEUP  (this is the file you edit)
   Easiest: open the site > Soccer > Lineup > "Edit lineup",
   then "Save to file" and replace this file.
   By hand: each row is ["SPOT", ["starter", "backup", ...]].
   Names must match the roster exactly.
   ============================================================ */
window.LINEUP = window.LINEUP || {};
window.LINEUP.soccer = {
  "label": "Starting XI",
  "updated": "2026-10-12",
  "basedOn": "Based on 2026 starts (utsports.com stats)",
  "chart": {
    "Goalkeeper": [
      ["GK", ["Cayden Norris", "Lauryn Berry", "Morgan Weaver"]]
    ],
    "Defense": [
      ["LB", ["Milee Zych", "Savannah Jackson"]],
      ["CB", ["Nyla Blue", "Marlee Raymond"]],
      ["CB", ["Devin Davis"]],
      ["RB", ["Cora Fry"]]
    ],
    "Midfield": [
      ["CM", ["Dakota Brown", "Tesia Mikuta"]],
      ["CM", ["Ines Derrien", "Bella Smith"]],
      ["CM", ["Emerson Moore", "Olivia Feagin"]]
    ],
    "Attack": [
      ["LW", ["Taylor Cheatham", "Kai Tsakiris"]],
      ["ST", ["Kylee Simmons", "Jayla Blue"]],
      ["RW", ["Shae O'Rourke", "Ayva Jordan"]]
    ]
  }
};
