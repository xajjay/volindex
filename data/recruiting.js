/* Recruiting for volleyball, soccer, basketball, baseball and softball (football recruiting lives in football.js).
   Edit by hand or ask Claude to refresh. Commitments are verbal until players sign (November signing period).
   commits: { name, pos, from, rank, date, src } */
window.RECRUITING = {
  mbb: {
    year: 2027,
    intro: "Rick Barnes' recruiting: the class of 2027, this year's freshmen and where to follow along.",
    commits: [],
    none: 'No 2027 commitments yet, per 247Sports (October 2026).',
    lastClass: {
      title: '2026 signing class (now freshmen) · 247Sports ratings',
      rows: [
        ['Christopher Washington Jr.', 'SF · Providence Christian Academy (Murfreesboro, Tenn.)', '4-star · 92 · No. 53 nationally'],
        ['Ralph Scott', 'SF · IMG Academy (Bradenton, Fla.)', '4-star · 92 · No. 73 nationally'],
        ['Manny Green', 'SF · Cedar Grove (Ellenwood, Ga.)', '4-star · 90 · No. 118 nationally'],
        ['Marquis Clark', 'PG · Whitney Young (Chicago, Ill.)', '3-star · 87 · No. 226 nationally'],
      ],
      src: 'https://247sports.com/college/tennessee/season/2026-basketball/commits/', srcName: '247Sports 2026 Tennessee basketball commits',
    },
    trackers: [
      ['2027 commits', '247Sports', 'https://247sports.com/college/tennessee/season/2027-basketball/commits/'],
      ['Recruiting news', 'Rocky Top Insider basketball recruiting', 'https://www.rockytopinsider.com/category/basketball/basketball-recruiting/'],
    ],
  },
  wbb: {
    year: 2027,
    intro: "Kim Caldwell's recruiting: the class of 2027, this year's freshmen and where to follow along.",
    commits: [],
    none: 'No 2027 commitments confirmed by a current source yet. Earlier pledges from before the 2024 coaching change are not counted.',
    note: 'Lady Vol Hoops signed a top-10 class for the second straight year in November 2025.',
    trackers: [
      ['2026 signing class announcement', 'utsports.com', 'https://utsports.com/news/2025/11/14/womens-basketball-lady-vol-hoops-nets-second-straight-top-10-signing-class'],
      ['Class rankings (HoopGurlz)', 'ESPN', 'https://www.espn.com/womens-college-basketball/'],
      ['Recruiting news', 'Rocky Top Insider', 'https://www.rockytopinsider.com/'],
    ],
  },
  baseball: {
    year: 2027,
    intro: "Josh Elander's first recruiting classes: 2027 commitments, this year's freshmen and where to follow along.",
    commits: [
      { name: 'Kaiden McCarthy', pos: 'RHP', from: 'Vermont', rank: 'Perfect Game No. 59 (2027)', date: 'Nov. 1, 2025', src: 'https://www.rockytopinsider.com/2025/11/01/tennessee-baseball-lands-first-commitment-of-josh-elander-era-kaiden-mccarthy/' },
      { name: 'Gaven French', pos: 'SS', from: 'Heritage HS (Maryville, Tenn.)', rank: 'Perfect Game No. 337 · No. 13 in Tennessee', date: 'Nov. 5, 2025', src: 'https://www.on3.com/teams/tennessee-volunteers/news/local-standout-commits-to-josh-elander-vols/' },
    ],
    note: 'Public commitments found in news reports. Baseball classes are large; Perfect Game lists the full class.',
    trackers: [
      ['Commitments and class rankings', 'Perfect Game', 'https://www.perfectgame.org/'],
      ['2028 class early look', 'Yahoo Sports', 'https://sports.yahoo.com/articles/breaking-down-tennessee-baseballs-great-013749735.html'],
    ],
  },
  softball: {
    year: 2027,
    intro: "Karen Weekly's recruiting: 2027 commitments, this year's freshmen and where to follow along.",
    commits: [
      { name: 'Emma Pynes', pos: 'OF', from: 'Florida', rank: '4-star · No. 59 overall', date: 'Oct. 2, 2025', src: 'https://www.si.com/college/tennessee/recruiting/commit-alert-2027-4-star-of-emma-pynes-picks-tennessee-softball-01k6khsah7ax' },
      { name: 'Gracyn Needle', pos: 'SS / C / 3B', from: "The King's Academy (Palm Beach, Fla.)", rank: '—', date: 'Sept. 8, 2025', src: 'https://247sports.com/college/tennessee/article/lady-vols-softball-commits-253718620/' },
      { name: 'Kamryn Potts', pos: '1B / C', from: 'Viera HS (Viera, Fla.)', rank: '—', date: 'Sept. 8, 2025', src: 'https://247sports.com/college/tennessee/article/lady-vols-softball-commits-253718620/' },
      { name: 'Evelynn Swartzlander', pos: 'SS', from: 'Birdville HS (North Richland Hills, Texas)', rank: '—', date: 'Sept. 8, 2025', src: 'https://247sports.com/college/tennessee/article/lady-vols-softball-commits-253718620/' },
    ],
    note: 'Public commitments found in news reports; the full class is announced at signing in November.',
    trackers: [
      ['Class rankings', 'Extra Inning Softball', 'https://extrainningsoftball.com/'],
      ['2026 class breakdown', 'On3', 'https://www.on3.com/softball/news/2026-signing-class-breakdown-tennessee'],
    ],
  },
  volleyball: {
    year: 2027,
    intro: "Eve Rackham Watt's recruiting: the next class, this year's freshmen and where to follow along.",
    commits: [],
    none: 'The 2027 class is announced at signing in November. Volleyball commitments are rarely public before then.',
    trackers: [
      ['2026 signing class (six signees)', 'utsports.com', 'https://utsports.com/news/2025/11/17/volleyball-rackham-watt-announces-six-signings-in-2026-recruiting-class'],
      ['Class rankings', 'PrepVolleyball', 'https://prepvolleyball.com/articles/tag/recruiting-class-rankings'],
      ['Commit list', 'PrepDig', 'https://prepdig.com/college/tennessee/'],
    ],
  },
  soccer: {
    year: 2027,
    intro: "Joe Kirt's recruiting: the next class, this year's freshmen and where to follow along.",
    commits: [],
    none: "TopDrawerSoccer's 2027 class rankings are behind its paywall; the class is announced at signing in November.",
    note: "The 2026 class (this year's freshmen) was ranked No. 6 nationally by TopDrawerSoccer.",
    trackers: [
      ['2026 signing class, ranked No. 6', 'utsports.com', 'https://utsports.com/news/2025/11/13/kirt-announces-tennessee-soccers-2026-signing-class'],
      ['2027 class rankings', 'TopDrawerSoccer', 'https://www.topdrawersoccer.com/club-soccer-articles/2027-womens-di-recruiting-class-rankings_aid55643'],
      ['Commit list', 'PrepSoccer', 'https://prepsoccer.com/college/tennessee/'],
    ],
  },
};
