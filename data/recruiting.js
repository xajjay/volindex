/* Recruiting for volleyball, soccer, basketball, baseball and softball (football recruiting lives in football.js).
   Edit by hand or ask Claude to refresh. Commitments are verbal until players sign (November signing period).
   commits: { name, pos, from, rank, date, src } */
window.RECRUITING = {
  mbb: {
    year: 2027,
    intro: "Rick Barnes' recruiting: the class of 2027, this year's freshmen and where to follow along.",
    commits: [],
    none: 'No 2027 commitments found as of Nov. 18, 2026 (the Nov. 13 decision of target Chris Brown could not be confirmed). Four-star wing Dylan Jones, a Tennessee target, picked Texas A&M on Oct. 26.',
    targets: {
      title: 'Top 2027 targets',
      note: 'Uncommitted prospects Tennessee is recruiting, in The Vol Index priority order. Ratings from 247Sports (Oct. 2026). Dylan Jones, a former target, committed to Texas A&M on Oct. 26.',
      rows: [
        { name: 'Malachi Jordan', pos: 'SF', ht: "6-7, 225", from: 'Prolific Prep · Nashville, Tenn. native', rank: '247: 97, No. 23 · Composite: .9928 (5-star), No. 19', src: 'https://247sports.com/player/malachi-jordan-46146933/' },
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
      { name: 'Amaya Manuel', pos: 'PG', from: 'Lift For Life Academy (St. Louis, Mo.)', rank: '4-star · 5-8 · No. 27 (ESPN NEXT 100) · No. 35 (On3) · No. 1 in Missouri', date: 'Signed Nov. 11, 2026', src: 'https://www.rockytopinsider.com/2026/11/10/lady-vols-basketball-land-commitment-from-four-star-point-guard-recruit-amaya-manuel/' },
      { name: 'Maci Pringle', pos: 'Wing', from: 'Flower Mound HS (Flower Mound, Texas)', rank: '4-star · 6-1 · No. 33 (ESPN NEXT 100) · No. 21 (On3) · No. 3 in Texas', date: 'Signed Nov. 11, 2026', src: 'https://www.rockytopinsider.com/2026/10/20/lady-vols-basketball-land-commitment-of-four-star-wing-maci-pringle-after-recent-visit/' },
    ],
    none: 'No 2027 commitments confirmed by a current source yet.',
    note: 'Commitments are verbal until signed. The early signing period runs Nov. 11-18, 2026; Manuel and Pringle both signed on Nov. 11. Lady Vol Hoops signed a top-10 class for the second straight year in November 2025.',
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
      { name: 'Dylan Seward', pos: 'SS', from: 'Norco HS (Norco, Calif.)', rank: 'Perfect Game No. 1 · No. 1 national prospect (Perfect Game, Baseball America, Over-Slot)', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
      { name: 'Sushi Wilson', pos: 'OF', from: 'IMG Academy (Chicago, Ill.)', rank: 'Perfect Game No. 9', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
      { name: 'Max Hemenway', pos: 'SS', from: 'IMG Academy (Puyallup, Wash.)', rank: 'Perfect Game No. 23', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
      { name: 'Leo Nockley', pos: 'SS', from: 'Wyoming Seminary (Upper Plains, Pa.)', rank: 'Perfect Game No. 27', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
      { name: 'Caden Dawson', pos: 'OF', from: 'Blessed Trinity Catholic (Marietta, Ga.)', rank: 'Perfect Game No. 48', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
      { name: 'Banks Addison', pos: 'SS', from: 'Baylor School (Germantown, Tenn.)', rank: 'Perfect Game No. 58', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
      { name: 'Blake Lundy', pos: 'C', from: 'Baylor School (Ooltewah, Tenn.)', rank: 'Perfect Game No. 80', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
      { name: 'Brady Buenik', pos: 'RHP', from: 'Libertyville HS (Libertyville, Ill.)', rank: 'Perfect Game No. 149', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
      { name: 'Jayden Pearl', pos: 'OF', from: 'Battle Ground Academy (Mt. Juliet, Tenn.)', rank: 'Perfect Game No. 180', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
      { name: 'Gaven French', pos: 'RHP', from: 'Heritage HS (Maryville, Tenn.)', rank: 'Perfect Game No. 283', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
      { name: 'Jack Nicholls', pos: 'RHP', from: 'Haddon Heights HS (Haddon Heights, N.J.)', rank: 'Perfect Game No. 337', date: 'Signed Nov. 11, 2026', src: 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class' },
    ],
    note: "2027 class signed Nov. 11, 2026: 11 players, ranked No. 3 by Baseball America and No. 7 by Perfect Game; national ranks are Perfect Game's. Earlier 2027 commit Kaiden McCarthy (RHP, Vermont) is not on the signed list. 2028 outfielder Hudson Oliver (Hoover HS, Ala.; Perfect Game No. 45) is a verbal commit.",
    trackers: [
      ['2027 signing class', 'utsports.com', 'https://utsports.com/news/2026/11/11/vols-ink-baseball-americas-no-3-ranked-signing-class'],
      ['Commitments and class rankings', 'Perfect Game', 'https://www.perfectgame.org/'],
      ['2028 class early look', 'Yahoo Sports', 'https://sports.yahoo.com/articles/breaking-down-tennessee-baseballs-great-013749735.html'],
    ],
  },
  softball: {
    year: 2027,
    intro: "Karen Weekly's recruiting: the next two classes, this year's freshmen and where to follow along. Ratings are On3's.",
    classes: [
      { year: 2027, rank: 'On3 class rank No. 25 (No. 4 in the SEC) · signing period opened Nov. 11; Hodges not yet reported signed', commits: [
        { name: 'Kaylee Hodges', pos: 'P', from: 'Matoaca (Chesterfield, Va.)', rank: '5-star · 99 · No. 2 nationally · No. 1 pitcher', date: 'Oct. 2, 2025' },
        { name: 'Gracyn Needle', pos: 'MI', from: "The King's Academy (Royal Palm Beach, Fla.)", rank: '4-star · 95 · No. 37', date: 'Sept. 8, 2025 · signed Nov. 11, 2026' },
        { name: 'Evelynn Swartzlander', pos: 'MI', from: 'Birdville (North Richland Hills, Texas)', rank: '4-star · 94 · No. 60', date: 'Sept. 7, 2025 · signed Nov. 11, 2026' },
        { name: 'Emma Pynes', pos: 'OF', from: 'Cornerstone Charter (Orlando, Fla.)', rank: '4-star · 94 · No. 57', date: 'Sept. 27, 2025 · signed Nov. 11, 2026' },
        { name: 'Mia Roland', pos: 'MI', from: 'Charles D. Owen (Black Mountain, N.C.)', rank: '4-star · 93 · No. 67', date: 'July 28, 2026 · signed Nov. 11, 2026' },
        { name: 'Kamryn Potts', pos: 'C', from: 'Viera (Rockledge, Fla.)', rank: '4-star · 93 · No. 74 (On3); No. 79 overall, No. 12 C per SI', date: 'Sept. 8, 2025 · signed Nov. 11, 2026' },
      ], src: 'https://www.on3.com/college/tennessee-volunteers/softball/2027/industry-comparison-commits/' },
      { year: 2028, rank: 'On3 class rank No. 2 (Sept. 22 update; six commits now)', commits: [
        { name: 'Caelyn Campos', pos: 'OF', from: 'Del Oro (Rocklin, Calif.)', rank: '5-star · 99 · No. 4 nationally · No. 1 outfielder', date: 'Sept. 22, 2026' },
        { name: 'Reagan Eldred', pos: 'P', from: 'Klein Oak (Spring, Texas)', rank: '5-star · 98 · No. 14 nationally', date: 'Sept. 20, 2026' },
        { name: 'Nevaeh Wilson', pos: 'MI', from: 'Ganesha (Corona, Calif.)', rank: '4-star · 95 · No. 32', date: 'Sept. 7, 2026' },
        { name: 'Kenzie White', pos: 'CI', from: 'Clarksville (Clarksville, Tenn.)', rank: '4-star · 90 · No. 119', date: 'Sept. 7, 2026' },
        { name: 'Sophia Galindo', pos: 'CI', from: 'Hollister (Hollister, Calif.)', rank: '3-star · 88', date: 'Sept. 7, 2026' },
        { name: 'Megan Kuiper', pos: 'P', from: 'Woodstock, Ill.', rank: '4-star · No. 40 in the 2028 class (Softball America)', date: 'Oct. 18, 2026' },
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
    commits: [
      { name: 'Eva Jeffries', pos: 'OH', from: 'CITY Volleyball Club (Los Angeles, Calif.)', rank: '6-3 · enrolls summer 2027 · father Jared Jeffries played 11 NBA seasons', date: 'Signed Nov. 12, 2026', src: 'https://roundtable.io/sports/ncaa/tennessee/news/tennessee-volleyball-lands-three-top-recruits' },
      { name: 'Lola Peters', pos: 'S', from: 'Plano West HS (Plano, Texas)', rank: '6-1 · PrepDig No. 91 · No. 3 setter · enrolls spring 2027', date: 'Signed Nov. 12, 2026', src: 'https://roundtable.io/sports/ncaa/tennessee/news/tennessee-volleyball-lands-three-top-recruits' },
      { name: 'Mara Sandberg', pos: 'OH', from: 'Gonzaga Prep (Spokane, Wash.)', rank: 'Enrolls spring 2027', date: 'Signed Nov. 12, 2026', src: 'https://roundtable.io/sports/ncaa/tennessee/news/tennessee-volleyball-lands-three-top-recruits' },
    ],
    note: 'Signing class announced Nov. 12, 2026 by Eve Rackham Watt: three players.',
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
