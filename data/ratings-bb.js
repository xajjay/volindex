/* Basketball player ratings: 247Sports (men) and ESPN SC Next 100 (women).
   hs = coming out of high school: comp = 247Sports Composite (0-1 scale), own = 247Sports' own rating,
        natl = national rank, cls = class year.
   tr = 247Sports transfer rating (year = portal cycle), ovr = overall transfer rank.
   A player's "current" rating is the transfer rating if they have one, otherwise high school.
   Gathered from 247Sports player profiles, Oct. 2026. */
window.BB_RATINGS = {
  mbb: {
    src: 'https://247sports.com/college/tennessee/team/tennessee-volunteers-basketball-185/roster/',
    srcName: '247Sports Tennessee basketball roster',
    players: {
      'Dai Dai Ames':      { hs: { comp: 0.9748, stars: 4, natl: 68,  cls: 2023, own: 92 }, tr: { rating: 93, stars: 4, ovr: 57,  year: 2026 } },
      'DeWayne Brown II':  { hs: { comp: 0.9609, stars: 4, natl: 96,  cls: 2025, own: 90 } },
      'Marquis Clark':     { hs: { comp: 0.8910, stars: 3, natl: 282, cls: 2026, own: 87 } },
      'Christian Fermin':  { hs: { comp: 0.9464, stars: 4, natl: 116, cls: 2022, own: 89 } },
      'Manny Green':       { hs: { comp: 0.9154, stars: 3, natl: 179, cls: 2026, own: 90 } },
      'Jalen Haralson':    { hs: { comp: 0.9927, stars: 5, natl: 17,  cls: 2025, own: 97 }, tr: { rating: 94, stars: 4, ovr: 26,  year: 2026 } },
      'Juke Harris':       { hs: { comp: 0.9658, stars: 4, natl: 88,  cls: 2024, own: 91 }, tr: { rating: 97, stars: 4, ovr: 8,   year: 2026 } },
      'Troy Henderson':    { hs: { comp: 0.9036, stars: 3, natl: 237, cls: 2025, own: 88 } },
      'Terrence Hill Jr.': { tr: { rating: 95, stars: 4, ovr: 19,  year: 2026 } },
      'Braedan Lue':       { tr: { rating: 86, stars: 3, ovr: 447, year: 2026 } },
      'Tyler Lundblade':   { hs: { comp: 0.8717, stars: 3, natl: 248, cls: 2021, own: 85 }, tr: { rating: 93, stars: 4, ovr: 65,  year: 2026 } },
      'Miles Rubin':       { hs: { comp: 0.8967, stars: 3, natl: 226, cls: 2023, own: 88 }, tr: { rating: 92, stars: 4, ovr: 108, year: 2026 } },
      'Ralph Scott':       { hs: { comp: 0.9736, stars: 4, natl: 77,  cls: 2026, own: 92 } },
      'Jalen Washington':  { hs: { comp: 0.9803, stars: 4, natl: 55,  cls: 2022, own: 94 }, tr: { rating: 91, stars: 4, ovr: 132, year: 2026 } },
      'Chris Washington Jr.': { hs: { stars: 4, natl: 53, cls: 2026, own: 92 } }
    }
  },
  wbb: {
    src: 'https://www.espn.com/high-school/girls-basketball/recruiting/rankings/scnext100girls',
    srcName: 'ESPN SC Next 100 girls rankings (classes of 2021-2026)',
    note: 'Players not listed were not in ESPN\'s top 100 for their class. 247Sports doesn\'t publish women\'s transfer ratings.',
    players: {
      'Aaliyah Moore': { hs: { src: 'espn', grade: 97, stars: 5, natl: 6, cls: 2021 } },
      'Kaylene Smikle': { hs: { src: 'espn', grade: 93, stars: 4, natl: 64, cls: 2022 } },
      'Kennedy Fauntleroy': { hs: { src: 'espn', grade: 92, stars: 4, natl: 75, cls: 2022 } },
      'Rylie Theuerkauf': { hs: { src: 'espn', grade: 93, stars: 4, natl: 85, cls: 2023 } },
      'Harper Peterson': { hs: { src: 'espn', grade: 92, stars: 4, natl: 87, cls: 2024 } },
      'Zhen Craft': { hs: { src: 'espn', grade: 94, stars: 4, natl: 46, cls: 2025 } },
      'Harissoum Coulibaly': { hs: { src: 'espn', grade: 91, stars: 4, natl: 95, cls: 2025 } },
      'Gabby Minus': { hs: { src: 'espn', grade: 93, stars: 4, natl: 64, cls: 2026 } }
    }
  }
};
