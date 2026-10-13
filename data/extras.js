/* The Vol Index: researched details for volleyball, soccer, basketball, baseball and softball.
   Hand-curated (Claude, Oct. 12, 2026). Every block lists its sources. Automatic data (schedules,
   stats, box scores, polls, RPI) comes from the *-auto.js files and wins where both exist.
   ratings: rows for the Rankings & Ratings tab [source, value, note, link]
   advanced: team metrics, conference comparison and player ratings for the Advanced tab
   honors / draft / recruit: keyed by player name
   departures: [name, reason] (anyone else who played last season and isn't on the roster is listed automatically)
   playersToKnow: the overview's Players to know, exactly these names in this order (when set) */
window.EXTRAS = {
  football: {
    playersToKnow: ['Xavier Gilliam', 'DeSean Bishop', 'Mike Matthews', 'David Sanders Jr.', 'Arion Carter', 'Ty Redmond', 'Dejuan Lane', 'George MacIntyre'],
  },
  mbb: {
    ratings: [
      ['SEC media preseason poll', 'No. 4', 'Predicted order, released Oct. 12, 2026. Florida 1st, Texas 2nd, Arkansas 3rd.', 'https://utsports.com/news/2026/10/12/mens-basketball-vols-voted-fourth-in-sec-by-media-harris-named-first-team-all-sec'],
      ['KenPom preseason', 'No. 18', 'Net rating +24.47 · offense No. 16 · defense No. 19 · tempo No. 297', 'https://kenpom.com/'],
      ['Bart Torvik T-Rank projection', 'No. 15', 'Projected 21-9 (11-7 SEC) · adj. offense No. 8 · adj. defense No. 22', 'https://barttorvik.com/team.php?team=Tennessee&year=2027'],
      ['EvanMiya preseason', 'No. 18', 'No. 13 excluding players with pending eligibility · offense No. 30 · defense No. 14 · roster rank No. 31', 'https://evanmiya.com/?team_ratings'],
      ['Blue Ribbon Yearbook preseason top 25', 'No. 6', 'Preseason magazine ranking', 'https://www.rockytopinsider.com/'],
      ['CBS Sports Preseason Top 25 And 1', 'No. 15', 'Gary Parrish', 'https://www.cbssports.com/college-basketball/'],
      ['Rotowire preseason', 'No. 6', 'Team preview', 'https://www.rotowire.com/cbasketball/article/college-basketball-team-preview-no-6-tennessee-volunteers-136006'],
      ['AP preseason poll', 'TBA', 'Released in mid-to-late October; the home page updates automatically', 'https://www.espn.com/mens-college-basketball/rankings'],
      ['ESPN BPI', 'Not out yet', 'ESPN publishes BPI once the season starts in November', 'https://www.espn.com/mens-college-basketball/bpi'],
      ['NCAA NET', 'Not out yet', 'The NCAA starts NET rankings in early December', 'https://www.ncaa.com/rankings/basketball-men/d1/ncaa-mens-basketball-net-rankings'],
    ],
    advanced: {
      intro: 'Preseason computer ratings from the three most-used college basketball models, plus EvanMiya player ratings and T-Rank player projections. These switch to in-season numbers once games start.',
      teams: [
        { src: 'KenPom', url: 'https://kenpom.com/', rank: 18, rating: '+24.47', off: ['119.8', 16], def: ['95.3', 19], extra: 'Adj. tempo 70.0 (No. 297)', date: 'Preseason' },
        { src: 'Bart Torvik (T-Rank)', url: 'https://barttorvik.com/team.php?team=Tennessee&year=2027', rank: 15, rating: '.9197 Barthag', off: ['119.8', 8], def: ['96.9', 22], extra: 'Projected 21-9, 11-7 SEC · adj. tempo 69.0', date: 'Preseason' },
        { src: 'EvanMiya', url: 'https://evanmiya.com/?team_ratings', rank: 18, rating: '+20.1', off: ['+10.6', 30], def: ['+9.5', 14], extra: 'Roster rank No. 31 · No. 13 if pending-eligibility players are excluded', date: 'Preseason (May 29)' },
      ],
      confTitle: 'SEC by KenPom preseason rating',
      confCols: ['KenPom', 'Net', 'Off. (rk)', 'Def. (rk)'],
      conf: [
        ['Florida', 2, '+33.38', '125.7 (1)', '92.3 (7)'], ['Alabama', 9, '+26.99', '123.2 (4)', '96.2 (28)'], ['Texas', 10, '+26.73', '121.2 (6)', '94.5 (14)'],
        ['Vanderbilt', 13, '+26.12', '120.0 (13)', '93.9 (10)'], ['Tennessee', 18, '+24.47', '119.8 (16)', '95.3 (19)'], ['Texas A&M', 19, '+24.00', '121.2 (8)', '97.2 (40)'],
        ['Arkansas', 20, '+23.98', '120.2 (12)', '96.2 (30)'], ['Auburn', 25, '+22.73', '119.9 (14)', '97.1 (39)'], ['Kentucky', 26, '+22.68', '120.9 (9)', '98.2 (50)'],
        ['Oklahoma', 29, '+21.87', '118.6 (26)', '96.7 (34)'], ['Ole Miss', 38, '+19.25', '113.1 (64)', '93.9 (12)'], ['Georgia', 46, '+18.03', '117.5 (32)', '99.5 (63)'],
        ['Missouri', 48, '+17.04', '117.2 (33)', '100.2 (72)'], ['LSU', 62, '+13.37', '113.8 (60)', '100.4 (75)'], ['Mississippi State', 69, '+12.37', '112.8 (66)', '100.4 (76)'], ['South Carolina', 93, '+8.59', '111.2 (84)', '102.7 (95)'],
      ],
      playersTitle: 'Player ratings',
      playerCols: ['EvanMiya BPR', 'OBPR', 'DBPR', 'BPR nat\'l rank', 'T-Rank proj. PPG', 'Proj. RPG', 'Proj. APG', 'Proj. min %'],
      players: [
        ['Juke Harris', 4.83, 3.18, 1.65, 158, 15.1, 5.0, 1.8, 80],
        ['Dai Dai Ames', 3.36, 2.45, 0.91, 383, 13.8, 2.8, 2.0, 76],
        ['Jalen Haralson', 4.34, 2.36, 1.98, 213, 10.8, 4.4, 2.5, 68],
        ['Jalen Washington', 4.69, 2.23, 2.46, 165, 9.8, 6.4, 1.2, 64],
        ['Tyler Lundblade', 2.23, 3.40, -1.17, 686, 8.4, 2.6, 1.2, 62],
        ['Terrence Hill Jr.', 4.03, 4.33, -0.31, 252, 7.5, 2.5, 1.8, 52],
        ['DeWayne Brown II', 4.90, 2.65, 2.25, 151, 5.1, 3.5, 1.0, 37],
        ['Miles Rubin', 4.98, 1.63, 3.35, 144, 3.8, 2.3, 1.1, 31],
        ['Braedan Lue', null, null, null, null, 2.8, 0.6, 0.3, 18],
        ['Christian Fermin', null, null, null, null, 1.7, 2.0, 0.0, 11],
        ['Chris Washington Jr.', 1.95, 1.01, 0.94, 775, null, null, null, null],
      ],
      playersNote: 'BPR (Bayesian Performance Rating) is EvanMiya\'s estimate of a player\'s value per 100 possessions on offense (OBPR) and defense (DBPR). T-Rank projections are Bart Torvik\'s preseason per-game projections. EvanMiya also lists Tyler Lundblade among the nation\'s best 3-point shooters by projected accuracy.',
      glossary: [
        ['KenPom net rating', 'Points per 100 possessions better than an average D-I team, adjusted for opponent and venue.'],
        ['Adj. offense / defense', 'Points scored / allowed per 100 possessions against an average opponent. Lower defense numbers are better.'],
        ['Barthag', 'T-Rank\'s chance of beating an average D-I team on a neutral floor.'],
        ['BPR', 'EvanMiya\'s Bayesian Performance Rating: a player\'s total impact per 100 possessions, built from box score and on/off data.'],
        ['Tempo', 'Possessions per 40 minutes. Tennessee is projected to play slow, as usual under Rick Barnes.'],
      ],
    },
    honors: {
      'Juke Harris': ['Preseason First Team All-SEC (SEC media, Oct. 12, 2026), the only newcomer on the first team', 'Second Team All-ACC and ACC Most Improved Player, 2025-26 (Wake Forest)', 'Averaged 21.4 points and 6.5 rebounds at Wake Forest in 2025-26; 750 points ranked sixth nationally'],
    },
    draft: {
      'Juke Harris': { level: 'High', note: 'ESPN 2027 mock draft: No. 29 overall (first round), June 25, 2026', src: 'https://www.on3.com/teams/tennessee-volunteers/news/juke-harris-nba-mock-draft-first-round-espn-tennessee-vols-basketball/' },
    },
    recruit: {
      'Chris Washington Jr.': 'On3: 4-star, 94 rating, No. 51 nationally (2026)',
      'Ralph Scott': 'On3: 4-star, 91 rating, No. 88 nationally (2026)',
      'Manny Green': 'On3: 3-star, 88 rating, No. 55 at his position (2026)',
      'Marquis Clark': 'On3: 3-star, 87 rating, No. 49 at his position (2026)',
    },
    departures: [
      ['Nate Ament', '2026 NBA Draft: No. 13 overall (Bucks)'],
      ["Ja'Kobi Gillespie", 'Out of eligibility · 2026 NBA Draft: No. 42 (Spurs)'],
      ['Felix Okpara', 'Out of eligibility · 2026 NBA Draft: No. 46 (Wizards)'],
      ['Bishop Boswell', 'Transferred to Maryland'], ['J.P. Estrella', 'Transferred to Michigan'], ['Jaylen Carey', 'Transferred to Missouri'],
      ['Amari Evans', 'Transferred to Texas'], ['Cade Phillips', 'Transferred to Texas A&M'], ['Clarence Massamba', 'Transferred to UC Davis'],
    ],
    playersToKnow: ['Juke Harris', 'Terrence Hill Jr.', 'DeWayne Brown II', 'Jalen Haralson', 'Dai Dai Ames', 'Miles Rubin', 'Tyler Lundblade', 'Braedan Lue'],
    sources: [
      ['SEC media poll and preseason All-SEC', 'utsports.com', 'https://utsports.com/news/2026/10/12/mens-basketball-vols-voted-fourth-in-sec-by-media-harris-named-first-team-all-sec'],
      ['Team ratings', 'KenPom', 'https://kenpom.com/'], ['Team ratings and player projections', 'Bart Torvik (T-Rank)', 'https://barttorvik.com/team.php?team=Tennessee&year=2027'],
      ['Team and player ratings (BPR)', 'EvanMiya', 'https://evanmiya.com/'], ['Freshman ratings', 'On3 industry comparison', 'https://www.on3.com/college/tennessee-volunteers/basketball/2026/industry-comparison-commits/'],
      ['Outgoing transfers', 'Rocky Top Insider', 'https://www.rockytopinsider.com/2026/05/02/where-all-of-tennessee-basketballs-outgoing-transfer-portal-players-landed/'],
      ['2027 NBA mock draft', 'ESPN via On3', 'https://www.on3.com/teams/tennessee-volunteers/news/juke-harris-nba-mock-draft-first-round-espn-tennessee-vols-basketball/'],
    ],
  },
  wbb: {
    playersToKnow: ['Rylie Theuerkauf', 'Kaylene Smikle', 'Kennedy Fauntleroy', 'Fatmata Janneh', 'Aaliyah Moore', 'Naomi White', 'Harissoum Coulibaly', 'Riley Makalusky', 'Avery Mills', 'Gabby Minus'],
    ratings: [
      ['SEC media preseason poll', 'No. 8', 'Predicted order, released Oct. 12, 2026. South Carolina 1st.', 'https://www.on3.com/news/sec-womens-basketball-preseason-poll-predicted-order-of-finish-released-2026-27-season'],
      ['Massey Ratings preseason', 'No. 14', 'Power No. 12 · offense No. 10 · defense No. 31 · expected 21-10', 'https://masseyratings.com/cbw/ncaa-d1/ratings'],
      ['USA Today post-portal top 25', 'No. 25', 'Offseason ranking after the transfer portal', 'https://www.usatoday.com/sports/ncaaw/'],
      ['USA Today transfer class', 'No. 9', 'Transfer portal class ranking', 'https://www.usatoday.com/sports/ncaaw/'],
      ['The Athletic post-portal', 'NR', 'Offseason top 25', 'https://www.nytimes.com/athletic/college-basketball/'],
      ['AP preseason poll', 'TBA', 'Released in late October; the home page updates automatically', 'https://www.espn.com/womens-college-basketball/rankings'],
      ['NCAA NET', 'Not out yet', 'Starts in December', 'https://www.ncaa.com/rankings/basketball-women/d1/ncaa-womens-basketball-net-rankings'],
    ],
    advanced: {
      intro: 'Kenneth Massey\'s computer ratings are the standard free advanced model for women\'s basketball. These are preseason numbers; they update after every game.',
      teams: [
        { src: 'Massey Ratings', url: 'https://masseyratings.com/cbw/ncaa-d1/ratings', rank: 14, rating: '8.31', off: ['104.32', 10], def: ['29.79', 31], extra: 'Power rank No. 12 · expected record 21.3-9.7', date: 'Preseason' },
      ],
      confTitle: 'SEC by Massey preseason rating',
      confCols: ['Massey', 'Offense rk', 'Defense rk'],
      conf: [['South Carolina', 1, 2, 2], ['Texas', 3, 5, 3], ['LSU', 5, 1, 11], ['Oklahoma', 8, 4, 39], ['Tennessee', 14, 10, 31], ['Vanderbilt', 15, 8, 36], ['Ole Miss', 18, 21, 12], ['Kentucky', 22, 22, 18], ['Alabama', 25, 32, 16], ['Mississippi State', 37, 30, 57], ['Georgia', 39, 48, 28], ['Florida', 42, 36, 68], ['Texas A&M', 57, 70, 49], ['Auburn', 60, 84, 27], ['Missouri', 63, 47, 110], ['Arkansas', 74, 49, 136]],
      glossary: [['Massey rating', 'Margin-based computer rating; higher is better.'], ['Power', 'Massey\'s blend of rating and schedule strength.'], ['Offense / defense rank', 'Where Tennessee\'s projected scoring and scoring prevention rank nationally.']],
    },
    recruit: { 'Gabby Minus': 'On3: 4-star, 95 rating, No. 36 nationally (2026)' },
    departures: [
      ['Talaysia Cooper', 'Transferred to Ole Miss · preseason Second Team All-SEC there'], ['Jaida Civil', 'Transferred to Ole Miss'], ['Mia Pauldo', 'Transferred to Rutgers'],
      ['Mya Pauldo', 'Transferred to Rutgers'], ['Deniya Prawl', 'Transferred to Louisville'], ['Alyssa Latham', 'Transferred to Virginia Tech'],
      ['Lauren Hurst', 'Transferred to Virginia Tech'], ['Kaniya Boyd', 'Transferred to Texas A&M'],
    ],
    sources: [
      ['SEC media poll', 'On3', 'https://www.on3.com/news/sec-womens-basketball-preseason-poll-predicted-order-of-finish-released-2026-27-season'],
      ['Team ratings', 'Massey Ratings', 'https://masseyratings.com/cbw/ncaa-d1/ratings'],
      ['Outgoing transfers', 'Rocky Top Insider', 'https://www.rockytopinsider.com/2026/04/16/where-all-eight-outgoing-lady-vols-basketball-transfers-committed-in-the-portal/'],
    ],
  },
  volleyball: {
    ratings: [
      ['AVCA Coaches Poll', 'No. 9', 'Through games of Oct. 11 (up from No. 10)', 'https://www.ncaa.com/rankings/volleyball-women/d1/avca-coaches'],
      ['NCAA RPI', 'No. 18', 'Through games of Oct. 11 (up from No. 19) · road 3-1, neutral 2-1, home 7-1', 'https://www.ncaa.com/rankings/volleyball-women/d1/ncaa-womens-volleyball-rpi'],
      ['Massey Ratings', 'No. 13', 'Power No. 14 · strength of schedule No. 25 · through Oct. 11', 'https://masseyratings.com/cvol/ncaa-d1/ratings'],
      ['SEC coaches preseason poll', '5th', 'Picked fifth in the SEC (July 2026)', 'https://utsports.com/news/2026/7/29/volleyball-caroline-kerr-earns-preseason-all-sec-honors'],
      ['AVCA preseason poll', 'No. 22', 'Start of the season', 'https://www.avca.org/polls-awards/polls/'],
    ],
    advanced: {
      intro: 'The NCAA RPI drives NCAA Tournament seeding; Massey adds a margin-based computer rating.',
      teams: [
        { src: 'NCAA RPI', url: 'https://www.ncaa.com/rankings/volleyball-women/d1/ncaa-womens-volleyball-rpi', rank: 18, rating: '12-3', extra: 'Road 3-1 · neutral 2-1 · home 7-1', date: 'Through Oct. 11' },
        { src: 'Massey Ratings', url: 'https://masseyratings.com/cvol/ncaa-d1/ratings', rank: 13, rating: '8.49', extra: 'Power No. 14 · schedule strength No. 25 · expected finish 7.8-2.2 the rest of the way', date: 'Through Oct. 11' },
      ],
      glossary: [['RPI', 'Rating Percentage Index: 25% your winning percentage, 50% your opponents\', 25% your opponents\' opponents\'. The selection committee uses it for NCAA Tournament bids.'], ['Massey', 'Computer rating that accounts for set and point margins and schedule.'], ['Hitting percentage', '(Kills − errors) ÷ attempts. Above .300 is excellent.']],
    },
    honors: {
      'Caroline Kerr': ['2026 Preseason All-SEC', 'Three-time All-American', '2025 First Team All-SEC', 'SEC Co-Setter of the Week (Sept. 7, 2026), her ninth career Setter of the Week'],
      'Kennedi Rogers': ['SEC Co-Offensive Player of the Week (Sept. 7, 2026)'],
      'Jolene Oddo': ['SEC Freshman of the Week (Sept. 7, 2026)'],
    },
    recruit: {
      'Emma Frietch': 'Prep Dig: No. 43 overall, No. 5 in Ohio (2026)',
      'Jolene Oddo': 'PrepVolleyball: No. 111 nationally (2026)',
      'Morgan Williams': 'Prep Dig: No. 82 overall, No. 4 in Virginia (2026)',
      'Anni Tang': 'International signee from Sydney, Australia (ProVolley Academy)',
    },
    departures: [
      ['Paityn Chapman', 'Transferred to Illinois'], ['Zoe Humphrey', 'Transferred to Georgia Tech'], ['Izzy Mogridge', 'Transferred to Utah'],
      ['Camdyn Stucky', 'Transferred to Kansas State'], ['Keondreya Granberry', 'Transferred to Indiana (final year)'], ['Starr Williams', 'Entered the transfer portal'], ['Cate Schnell', 'Entered the transfer portal'],
    ],
    playersToKnow: ['Kennedi Rogers', 'Caroline Kerr', 'Jalyn Stout', 'Maggie Dostic', 'Chelsea Sutton', 'Raegan Burns', 'Jolene Oddo', 'Anni Tang'],
    sources: [
      ['AVCA poll and NCAA RPI', 'NCAA.com', 'https://www.ncaa.com/rankings/volleyball-women/d1/avca-coaches'], ['Computer ratings', 'Massey Ratings', 'https://masseyratings.com/cvol/ncaa-d1/ratings'],
      ['Honors', 'utsports.com', 'https://utsports.com/news/2026/9/7/volleyball-trio-of-lady-vols-earn-sec-weekly-honors'],
      ['2026 signees', 'utsports.com', 'https://utsports.com/news/2025/11/17/volleyball-rackham-watt-announces-six-signings-in-2026-recruiting-class'],
      ['Outgoing transfers', 'UT Daily Beacon', 'https://utdailybeacon.com/206209/sports/tennessee-volleyball-2025-transfer-portal-tracker-whos-coming-in-whos-leaving-in-the-portal/'],
      ['Starting lineup (Oct. 11 vs. LSU)', '@Vol_VBall', 'https://x.com/Vol_VBall'],
    ],
  },
  soccer: {
    ratings: [
      ['United Soccer Coaches poll', 'NR', 'Poll 8 (Oct. 6). Was No. 13 on Sept. 29 and as high as No. 8.', 'https://unitedsoccercoaches.org/rankings/college-rankings/ncaa-di-women/'],
      ['NCAA RPI', 'No. 32', 'Through games of Oct. 11 (was No. 29) · home 5-1-1, road 1-2-2', 'https://www.ncaa.com/rankings/soccer-women/d1/ncaa-womens-soccer-rpi'],
      ['Massey Ratings', 'No. 27', 'Power No. 22 · offense No. 38 · defense No. 17 · schedule strength No. 16', 'https://masseyratings.com/csocw/ncaa-d1/ratings'],
      ['United Soccer Coaches preseason', 'No. 24', 'August 4, 2026', 'https://unitedsoccercoaches.org/rankings/college-rankings/ncaa-di-women/'],
      ['TopDrawerSoccer newcomer class', 'No. 5', 'Incoming class ranking', 'https://www.topdrawersoccer.com/college-soccer/college-soccer-details/women/tennessee/clgid-282'],
    ],
    advanced: {
      intro: 'RPI decides NCAA Tournament at-large bids; Massey adds a goal-margin computer rating split into offense and defense.',
      teams: [
        { src: 'NCAA RPI', url: 'https://www.ncaa.com/rankings/soccer-women/d1/ncaa-womens-soccer-rpi', rank: 32, rating: '6-3-3', extra: 'Home 5-1-1 · road 1-2-2', date: 'Through Oct. 11' },
        { src: 'Massey Ratings', url: 'https://masseyratings.com/csocw/ncaa-d1/ratings', rank: 27, rating: '8.38', off: ['5.12', 38], def: ['3.96', 17], extra: 'Power No. 22 · schedule strength No. 16', date: 'Through Oct. 11' },
      ],
      glossary: [['RPI', '25% your winning percentage, 50% opponents\', 25% opponents\' opponents\'. Ties count as half a win.'], ['Massey offense / defense', 'Projected goals scored / prevented against an average opponent.']],
    },
    honors: {
      'Cayden Norris': ['TopDrawerSoccer Preseason Top 100: No. 74', '2026 SEC Preseason Watchlist', 'Tied the program record with 13 clean sheets in 2025'],
      'Kylee Simmons': ['2026 SEC Preseason Watchlist', '2023 First Team All-SEC (at Missouri)'],
      'Ines Derrien': ['2026 SEC Preseason Watchlist'], 'Dakota Brown': ['2026 SEC Preseason Watchlist'], "Shae O'Rourke": ['2026 SEC Preseason Watchlist'],
      'Ayva Jordan': ['TopDrawerSoccer Preseason Freshman Best XI'],
    },
    recruit: { 'Ayva Jordan': 'TopDrawerSoccer: No. 6 in the 2026 freshman class' },
    playersToKnow: ['Kylee Simmons', 'Ines Derrien', 'Cayden Norris', "Shae O'Rourke", 'Taylor Cheatham', 'Devin Davis', 'Milee Zych', 'Nyla Blue'],
    sources: [
      ['Poll', 'United Soccer Coaches', 'https://unitedsoccercoaches.org/rankings/college-rankings/ncaa-di-women/'], ['NCAA RPI', 'NCAA.com', 'https://www.ncaa.com/rankings/soccer-women/d1/ncaa-womens-soccer-rpi'],
      ['Computer ratings', 'Massey Ratings', 'https://masseyratings.com/csocw/ncaa-d1/ratings'],
      ['Preseason honors', 'utsports.com', 'https://utsports.com/news/2026/8/10/five-lady-vols-named-to-2026-sec-soccer-preseason-watchlist'],
      ['TopDrawerSoccer preseason recognition', 'utsports.com', 'https://utsports.com/news/2026/8/12/two-lady-vols-earn-preseason-recognition-from-topdrawersoccer'],
      ['Starting XI (Oct. 9 at South Carolina)', '@Vol_Soccer', 'https://x.com/Vol_Soccer'],
    ],
  },
  baseball: {
    playersToKnow: ['Trent Grindlinger', 'Cam Appenzeller', 'Landon Mack', 'Levi Clark', 'Blaine Brown', 'Chris Ramirez', 'Travis Sanders', 'Blake Grimmer'],
    ratings: [
      ['PEAR team strength (TSR)', 'No. 10', 'TSR 5.18 (8th in SEC) · projected 38-18, 15-15 SEC · expected 36.9 wins (range 27-47)', 'https://pearatings.com/cbase/d1/team-profile?team=Tennessee&season=2027'],
      ['PEAR projected PCR', 'No. 15', 'Projected end-of-season résumé rank', 'https://pearatings.com/cbase/d1/team-profile?team=Tennessee&season=2027'],
      ['Baseball America way-too-early Omaha eight', 'In', 'Projected College World Series team', 'https://www.baseballamerica.com/'],
      ['D1Baseball preseason top 25', 'Jan.', 'Released in January', 'https://d1baseball.com/'],
      ['Baseball America preseason top 25', 'Jan.', 'Released in January', 'https://www.baseballamerica.com/'],
      ['Perfect Game preseason top 25', 'Jan.', 'Released in January', 'https://www.perfectgame.org/'],
      ['2026 final ranking', 'No. 25', 'Baseball America and Perfect Game', 'https://www.baseballamerica.com/'],
    ],
    advanced: {
      intro: 'PEAR\'s college baseball model projects every game on the 2027 schedule. Its strength rating (TSR) is points better than average; PCR is a résumé ranking like the RPI.',
      teams: [
        { src: 'PEAR', url: 'https://pearatings.com/cbase/d1/team-profile?team=Tennessee&season=2027', rank: 10, rating: 'TSR 5.18', extra: 'Projected 38-18, 15-15 SEC · expected 36.9 wins · projected PCR No. 15', date: 'Preseason' },
      ],
      pearGames: [['2027-02-19', 'Northern Illinois (3)', 179, 88.9], ['2027-02-23', 'High Point', 118, 83.0], ['2027-02-26', 'vs. Cincinnati', 41, 65.9], ['2027-02-27', 'vs. Illinois', 75, 73.4], ['2027-02-28', 'vs. Georgia Tech', 4, 46.7], ['2027-03-02', 'ETSU', 107, 82.2], ['2027-03-05', 'Missouri State (3)', 67, 77.2], ['2027-03-09', 'Mississippi Valley State (2)', 305, 99.0], ['2027-03-12', 'Evansville (3)', 175, 88.6], ['2027-03-16', 'Dayton', 189, 89.7], ['2027-03-19', 'Oklahoma (3)', 12, 56.7], ['2027-03-23', 'Eastern Kentucky', 234, 92.5], ['2027-03-26', 'at Texas A&M (3)', 7, 41.4], ['2027-03-30', 'Morehead State', 200, 90.3], ['2027-04-02', 'Arkansas (3)', 9, 55.0], ['2027-04-06', 'Tennessee Tech', 224, 91.7], ['2027-04-09', 'at Texas (3)', 1, 36.6], ['2027-04-13', 'Queens', 259, 94.3], ['2027-04-16', 'at Auburn (3)', 6, 41.1], ['2027-04-20', 'Lipscomb', 184, 89.2], ['2027-04-23', 'Georgia (3)', 2, 50.7], ['2027-04-27', 'Alabama A&M', 304, 99.0], ['2027-04-30', 'at Florida (3)', 8, 41.7], ['2027-05-04', 'Eastern Kentucky', 234, 92.5], ['2027-05-07', 'Mississippi State (3)', 5, 53.1], ['2027-05-11', 'Bellarmine', 260, 94.5], ['2027-05-14', 'at Alabama (3)', 20, 48.6], ['2027-05-18', 'Belmont', 187, 89.7], ['2027-05-20', 'Vanderbilt (3)', 17, 60.3]],
      glossary: [['TSR', 'PEAR team strength rating: runs better than an average D-I team.'], ['PCR', 'PEAR\'s résumé ranking, similar to the RPI the NCAA uses for selection.'], ['Win chance', 'PEAR\'s probability that Tennessee wins each game (per game in a series).']],
    },
    honors: {
      'Levi Clark': ['2026 Preseason Second Team All-SEC', '2025 Perfect Game Freshman All-American (first team)', '2025 SEC Co-Freshman of the Week'],
      'Blaine Brown': ['2026 Baseball America Preseason All-American (second team)', '2026 John Olerud Two-Way Player of the Year watch list', '2025 First Team All-American Conference (Rice)'],
    },
    draft: {
      'Levi Clark': { level: 'High', note: 'Perfect Game: No. 7 college prospect for the 2027 MLB Draft (Dec. 2025)', src: 'https://www.perfectgame.org/Articles/View.aspx?article=24044' },
      'Blaine Brown': { level: 'High', note: 'Perfect Game: No. 11 college prospect for 2027 (Dec. 2025)', src: 'https://www.perfectgame.org/Articles/View.aspx?article=24044' },
      'Landon Mack': { level: 'Medium', note: 'Perfect Game: No. 38 college prospect for 2027 (Dec. 2025)', src: 'https://www.perfectgame.org/Articles/View.aspx?article=24044' },
      'Trent Grindlinger': { level: 'Watch', note: 'Perfect Game: No. 83 college prospect for 2027 (Dec. 2025)', src: 'https://www.perfectgame.org/Articles/View.aspx?article=24044' },
    },
    draftNote: 'Baseball America\'s 2027 college draft rankings list five Tennessee players (subscriber-only list).',
    departures: [
      ['Manny Marin', 'Transferred to Arkansas'], ['Brayden Krenzel', 'Transferred to Arkansas'], ['Jay Abernathy', 'Transferred to Oklahoma'], ['Ethan Moore', 'Transferred to Missouri'],
      ['Ariel Antigua', 'Transferred to Arizona'], ['Evan Hankins', 'Transferred to Virginia Tech'], ['Cash Williams', 'Transferred to West Virginia'], ['Taylor Tracey', 'Transferred to TCU'],
      ['Nic Abraham', 'Transferred to Virginia Tech'], ['Nate Eisfelder', 'Transferred to Indiana'], ['Chris Newstrom', 'Transferred to UC Santa Barbara'], ['Hunter High', 'Transferred to Jacksonville State'],
      ['Hutson Chance', 'Transferred to Jacksonville State'], ['Finley Bates', 'Entered the transfer portal'], ['Ari Bethea', 'Entered the transfer portal'], ['Sawyer Deering', 'Entered the transfer portal'],
      ['Jax Bishop', 'Entered the transfer portal'], ['DJ McDowel', 'Entered the transfer portal'],
    ],
    sources: [
      ['Team ratings and game projections', 'PEAR Ratings', 'https://pearatings.com/cbase/d1/team-profile?team=Tennessee&season=2027'],
      ['2027 college draft prospects', 'Perfect Game', 'https://www.perfectgame.org/Articles/View.aspx?article=24044'],
      ['Outgoing transfers', 'Rocky Top Insider', 'https://www.rockytopinsider.com/2026/07/03/where-tennessee-baseball-outgoing-transfers-have-committed/'],
      ['Honors', 'utsports.com', 'https://utsports.com/sports/baseball/roster/levi-clark/22636'],
    ],
  },
  softball: {
    ratings: [
      ['PEAR team strength (TSR)', 'No. 3', 'TSR 8.50 (3rd in SEC) · projected PCR No. 7', 'https://pearatings.com/csoft/d1/team-profile?team=Tennessee&season=2027'],
      ['The Oklahoman way-too-early 2027 Super 16', 'No. 4', 'Offseason ranking', 'https://www.oklahoman.com/sports/'],
      ['2026 final ranking', 'No. 4', 'NFCA/USA Today, ESPN/USA Softball, D1Softball and Softball America', 'https://nfca.org/'],
      ['On3 2028 recruiting class', 'No. 2', 'On3 team ranking (Sept. 22 update) · five commits, two five-stars', 'https://www.on3.com/college/tennessee-volunteers/softball/2028/industry-comparison-commits/'],
      ['On3 2027 recruiting class', 'No. 25', 'Six commits led by five-star pitcher Kaylee Hodges (No. 2 nationally)', 'https://www.on3.com/college/tennessee-volunteers/softball/2027/industry-comparison-commits/'],
      ['D1Softball / NFCA / Softball America preseason', 'Jan.', 'Released in January', 'https://d1softball.com/'],
    ],
    advanced: {
      intro: 'PEAR\'s softball model rates Tennessee third in the country heading into 2027 and projects every SEC series.',
      teams: [
        { src: 'PEAR', url: 'https://pearatings.com/csoft/d1/team-profile?team=Tennessee&season=2027', rank: 3, rating: 'TSR 8.50', extra: 'Projected PCR No. 7 · SEC games so far posted: 26', date: 'Preseason' },
      ],
      pearGames: [['2027-02-12', 'vs. Nebraska', 8, 56.0], ['2027-03-12', 'at Texas A&M (3)', 10, 52.3], ['2027-03-19', 'Texas (3)', 1, 51.4], ['2027-03-25', 'at LSU (3)', 13, 55.4], ['2027-04-03', 'Oklahoma (3)', 2, 52.8], ['2027-04-09', 'at Auburn (3)', 30, 71.6], ['2027-04-23', 'Georgia (3)', 14, 69.2], ['2027-04-30', 'at Arkansas (3)', 5, 44.0], ['2027-05-06', 'Missouri (3)', 27, 79.8]],
      glossary: [['TSR', 'PEAR team strength rating: runs better than an average D-I team.'], ['PCR', 'PEAR\'s résumé ranking, similar to the RPI.']],
    },
    honors: {
      'Sage Mardjetko': ['2026 First Team All-SEC: SEC-best 0.96 ERA, 12-2, career-first no-hitter (Feb. 22 vs. Southern Illinois)'],
      'Alannah Leach': ['2026 First Team All-SEC: team-high 12 home runs, .330 average'],
      'Sophia Knight': ['SEC Player of the Week (Feb. 23, 2026)'],
    },
    recruit: {
      'Avary Stockwell': 'On3: 4-star, 97 rating, No. 16 nationally (2026)', 'Bailee Shelton': 'On3: 4-star, 97 rating, No. 24 nationally (2026)',
      'Halle Bailey': 'On3: 4-star, 96 rating, No. 26 nationally (2026)', 'Maggie Krause': 'On3: 4-star, 93 rating, No. 77 nationally (2026)',
    },
    departures: [
      ['Karlyn Pickens', 'Out of eligibility · 2026 First Team All-SEC'], ['Ella Dodge', 'Entered the transfer portal (starting third baseman: .275, 11 HR)'],
      ['Kailey Plumlee', 'Transferred to Alabama'], ['Saviya Morgan', 'Entered the transfer portal'],
    ],
    sources: [
      ['Team ratings and series projections', 'PEAR Ratings', 'https://pearatings.com/csoft/d1/team-profile?team=Tennessee&season=2027'],
      ['Recruiting classes', 'On3', 'https://www.on3.com/college/tennessee-volunteers/softball/2028/industry-comparison-commits/'],
      ['2026 All-SEC', 'utsports.com', 'https://utsports.com/news/2026/5/8/softball-three-lady-vols-named-first-team-all-sec'],
      ['Outgoing transfers', 'WATE', 'https://www.wate.com/sports/orange-and-white-nation/a-third-lady-vol-softball-player-enters-transfer-portal/amp/'],
    ],
  },
};
