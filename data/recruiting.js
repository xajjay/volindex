/* Recruiting for volleyball, soccer, basketball, baseball and softball (football recruiting lives in football.js).
   Edit by hand or ask Claude to refresh. Commitments are verbal until players sign (November signing period).
   commits: { name, pos, from, rank, date, src } */
window.RECRUITING = {
  mbb: {
    year: 2027,
    intro: "Rick Barnes' recruiting: the class of 2027, this year's freshmen and where to follow along.",
    commits: [],
    none: 'No 2027 commitments yet, per 247Sports (October 2026).',
    targets: {
      title: 'Top 2027 targets',
      note: 'Uncommitted prospects Tennessee is recruiting, in The Vol Index priority order. Ratings from 247Sports (Oct. 2026).',
      rows: [
        { name: 'Malachi Jordan', pos: 'SF', ht: "6-7, 225", from: 'Prolific Prep · Nashville, Tenn. native', rank: '247: 97, No. 23 · Composite: .9928 (5-star), No. 19', src: 'https://247sports.com/player/malachi-jordan-46146933/' },
        { name: 'Dylan Jones', pos: 'SF', ht: "6-6, 210", from: 'Bartlett (Bartlett, Tenn.)', rank: '247: 92, No. 40 · Composite: .9875 (5-star), No. 35 · No. 1 in Tennessee', src: 'https://247sports.com/player/dylan-jones-46158933/' },
        { name: 'Chris Brown', pos: 'C', ht: "6-9, 210", from: 'Dream City Christian (Glendale, Ariz.)', rank: '247: 90, No. 124 · Composite: .9424 (4-star), No. 110', src: 'https://247sports.com/player/chris-brown-46153130/' },
        { name: 'Reese Alston', pos: 'PG', ht: "6-2, 175", from: 'Houston Second Baptist (Houston, Texas)', rank: '247: 98, No. 9 · Composite: .9973 (5-star), No. 8 · No. 1 in Texas', src: 'https://247sports.com/player/reese-alston-46151465/' },
      ],
    },
    lastClass: {
      title: '2026 signing class (now freshmen) · 247Sports and On3 ratings',
      rows: [
        ['Christopher Washington Jr.', 'SF · Providence Christian Academy (Murfreesboro, Tenn.)', '247: 4-star, 92, No. 53 · On3: 4-star, 94, No. 51'],
        ['Ralph Scott', 'SF · IMG Academy (Bradenton, Fla.)', '247: 4-star, 92, No. 73 · On3: 4-star, 91, No. 88'],
        ['Manny Green', 'SF · Cedar Grove (Ellenwood, Ga.)', '247: 4-star, 90, No. 118 · On3: 3-star, 88'],
        ['Marquis Clark', 'PG · Whitney Young (Chicago, Ill.)', '247: 3-star, 87, No. 226 · On3: 3-star, 87'],
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
    commits: [
      { name: 'Maci Pringle', pos: 'Wing', from: 'Flower Mound HS (Flower Mound, Texas)', rank: '4-star (ESPN) · 6-1', date: 'Oct. 20, 2026', src: 'https://www.rockytopinsider.com/2026/10/20/lady-vols-basketball-land-commitment-of-four-star-wing-maci-pringle-after-recent-visit/' },
    ],
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
    intro: "Karen Weekly's recruiting: the next two classes, this year's freshmen and where to follow along. Ratings are On3's.",
    classes: [
      { year: 2027, rank: 'On3 class rank No. 25 (No. 4 in the SEC)', commits: [
        { name: 'Kaylee Hodges', pos: 'P', from: 'Matoaca (Chesterfield, Va.)', rank: '5-star · 99 · No. 2 nationally · No. 1 pitcher', date: 'Oct. 2, 2025' },
        { name: 'Gracyn Needle', pos: 'MI', from: "The King's Academy (Royal Palm Beach, Fla.)", rank: '4-star · 95 · No. 37', date: 'Sept. 8, 2025' },
        { name: 'Evelynn Swartzlander', pos: 'MI', from: 'Birdville (North Richland Hills, Texas)', rank: '4-star · 94 · No. 60', date: 'Sept. 7, 2025' },
        { name: 'Emma Pynes', pos: 'OF', from: 'Cornerstone Charter (Orlando, Fla.)', rank: '4-star · 94 · No. 57', date: 'Sept. 27, 2025' },
        { name: 'Mia Roland', pos: 'MI', from: 'Charles D. Owen (Black Mountain, N.C.)', rank: '4-star · 93 · No. 67', date: 'July 28, 2026' },
        { name: 'Kamryn Potts', pos: 'C', from: 'Viera (Rockledge, Fla.)', rank: '4-star · 93 · No. 74', date: 'Sept. 8, 2025' },
      ], src: 'https://www.on3.com/college/tennessee-volunteers/softball/2027/industry-comparison-commits/' },
      { year: 2028, rank: 'On3 class rank No. 2 (Sept. 22, 2026 update)', commits: [
        { name: 'Caelyn Campos', pos: 'OF', from: 'Del Oro (Rocklin, Calif.)', rank: '5-star · 99 · No. 4 nationally · No. 1 outfielder', date: 'Sept. 22, 2026' },
        { name: 'Reagan Eldred', pos: 'P', from: 'Klein Oak (Spring, Texas)', rank: '5-star · 98 · No. 14 nationally', date: 'Sept. 20, 2026' },
        { name: 'Nevaeh Wilson', pos: 'MI', from: 'Ganesha (Corona, Calif.)', rank: '4-star · 95 · No. 32', date: 'Sept. 7, 2026' },
        { name: 'Kenzie White', pos: 'CI', from: 'Clarksville (Clarksville, Tenn.)', rank: '4-star · 90 · No. 119', date: 'Sept. 7, 2026' },
        { name: 'Sophia Galindo', pos: 'CI', from: 'Hollister (Hollister, Calif.)', rank: '3-star · 88', date: 'Sept. 7, 2026' },
      ], src: 'https://www.on3.com/college/tennessee-volunteers/softball/2028/industry-comparison-commits/' },
    ],
    lastClass: {
      title: '2026 signing class (now freshmen) · On3 ratings',
      rows: [
        ['Avary Stockwell', 'C · Green Hill (Mount Juliet, Tenn.)', '4-star · 97 · No. 16'],
        ['Bailee Shelton', 'P · McNairy Central (Selmer, Tenn.)', '4-star · 97 · No. 24'],
        ['Halle Bailey', 'IF · Alcoa (Alcoa, Tenn.)', '4-star · 96 · No. 26'],
        ['Maggie Krause', 'P · Northview (Terre Haute, Ind.)', '4-star · 93 · No. 77'],
      ],
      src: 'https://www.on3.com/college/tennessee-volunteers/softball/2026/industry-comparison-commits/', srcName: 'On3 2026 Tennessee softball commits',
    },
    trackers: [
      ['2027 commits', 'On3', 'https://www.on3.com/college/tennessee-volunteers/softball/2027/industry-comparison-commits/'],
      ['2028 commits', 'On3', 'https://www.on3.com/college/tennessee-volunteers/softball/2028/industry-comparison-commits/'],
      ['Class rankings', 'Extra Inning Softball', 'https://extrainningsoftball.com/'],
    ],
  },
  volleyball: {
    year: 2027,
    intro: "Eve Rackham Watt's recruiting: the next class, this year's freshmen and where to follow along.",
    commits: [],
    none: 'The 2027 class is announced at signing in November. Volleyball commitments are rarely public before then.',
    lastClass: {
      title: '2026 signing class (now freshmen)',
      rows: [
        ['Emma Frietch', 'L · Cincinnati, Ohio (Northern Kentucky VBC)', 'Prep Dig No. 43 overall'],
        ['Morgan Williams', 'OH · Burke, Va. (Metro VBC)', 'Prep Dig No. 82 overall'],
        ['Jolene Oddo', 'MB · Clayton, N.C. (Cleveland HS)', 'PrepVolleyball No. 111'],
        ['Anni Tang', 'MB · Sydney, Australia (ProVolley Academy)', 'International · now a starter'],
        ['Camille Perry', 'MB · Frisco, Texas (Lone Star HS)', '—'],
        ['Jade Williams', 'RS · Atlanta, Ga. (Woodward Academy)', '—'],
      ],
      src: 'https://utsports.com/news/2025/11/17/volleyball-rackham-watt-announces-six-signings-in-2026-recruiting-class', srcName: 'utsports.com signing class announcement',
    },
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
