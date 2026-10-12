/* Social & Media: official Tennessee accounts, news sites, podcasts and creators for every sport.
   Edit by hand. Each entry: { name, about, links: [[label, url], ...] }.
   Official handles are from utsports.com's social media directory. For people whose exact
   handle hasn't been confirmed, the link is an X people-search for their name. */
const xs = q => 'https://x.com/search?q=' + encodeURIComponent(q) + '&f=user';
window.SOCIAL = {
  // The Vol Index's own X account. Put the handle here (without @) and it shows across the site.
  volIndexX: '',

  // shown on every sport's Social & Media tab and on the home page
  general: {
    official: [
      { name: 'Tennessee Athletics', about: 'Official site: schedules, tickets, rosters, news, record books', links: [['utsports.com', 'https://utsports.com/'], ['X @Vol_Sports', 'https://x.com/Vol_Sports'], ['Social media directory', 'https://utsports.com/sports/2017/6/15/social-media.aspx']] },
      { name: 'Vol Network', about: 'Official radio home of the Vols (football, basketball, baseball and more)', links: [['Vol Network', 'https://utsports.com/news/2017/6/15/volnetwork']] },
      { name: 'Tickets', about: 'Official ticket site', links: [['AllVols.com', 'https://allvols.com/']] },
      { name: 'Volopedia', about: "UT Libraries' encyclopedia of university and athletics history", links: [['volopedia.lib.utk.edu', 'https://volopedia.lib.utk.edu/']] },
    ],
    news: [
      { name: 'Rocky Top Insider', about: 'Independent Tennessee coverage of every sport, plus podcasts', links: [['rockytopinsider.com', 'https://www.rockytopinsider.com/'], ['Podcasts', 'https://rockytopinsider.transistor.fm/']] },
      { name: 'VolQuest (On3)', about: 'Brent Hubbs and staff: football, hoops, baseball and recruiting', links: [['VolQuest', 'https://www.on3.com/teams/tennessee-volunteers/'], ['VolQuest podcast', 'https://podcasts.apple.com/podcast/id1086686885']] },
      { name: 'GoVols247 (247Sports)', about: 'News, recruiting and the GoVols247 podcast', links: [['GoVols247', 'https://247sports.com/college/tennessee/'], ['Podcast', 'https://www.podengine.ai/podcasts/govols247-a-tennessee-volunteers-athletics-podcast']] },
      { name: 'Volunteer Country (Vols on SI)', about: 'Sports Illustrated network site for Tennessee', links: [['si.com/college/tennessee', 'https://www.si.com/college/tennessee']] },
      { name: 'Rocky Top Talk', about: 'SB Nation fan community', links: [['rockytoptalk.com', 'https://www.rockytoptalk.com/']] },
      { name: 'Knox News', about: 'Knoxville News Sentinel beat coverage', links: [['knoxnews.com', 'https://www.knoxnews.com/sports/']] },
      { name: 'WBIR 10News', about: 'Knoxville TV sports coverage', links: [['wbir.com', 'https://www.wbir.com/sports']] },
      { name: 'WVLT', about: 'Knoxville TV sports coverage', links: [['wvlt.tv', 'https://www.wvlt.tv/sports']] },
      { name: 'The Daily Beacon', about: "UT's student newspaper", links: [['utdailybeacon.com', 'https://www.utdailybeacon.com/sports/']] },
    ],
  },

  football: {
    official: [{ name: 'Tennessee Football', about: 'Official team accounts', links: [['X @Vol_Football', 'https://x.com/Vol_Football'], ['Instagram', 'https://instagram.com/vol_football'], ['Facebook', 'https://www.facebook.com/VolFootball'], ['utsports.com', 'https://utsports.com/sports/football']] }],
    creators: [
      { name: "Talkin' VAWLS", about: 'Fan podcast and post-game shows (Boogey Bentley)', links: [['X @TalkinVAWLS_pod', 'https://x.com/TalkinVAWLS_pod'], ['Podcast', 'https://player.fm/series/talkin-vawls-2351044'], ['Facebook', 'https://www.facebook.com/talkinVAWLS/'], ['Find Boogey Bentley on X', xs('Boogey Bentley')]] },
      { name: 'Brent Hubbs', about: 'VolQuest publisher, longtime Tennessee insider', links: [['VolQuest', 'https://www.on3.com/teams/tennessee-volunteers/'], ['Find on X', xs('Brent Hubbs')]] },
      { name: 'Eric Cain', about: 'Host of Locked On Vols, a daily Tennessee podcast', links: [['Locked On Vols', 'https://lockedonpodcasts.com/hosts/eric-cain/'], ['Find on X', xs('Eric Cain Vols')]] },
      { name: 'Rocky Top Insider football', about: 'Daily football coverage and podcasts', links: [['Football news', 'https://www.rockytopinsider.com/category/football/']] },
      { name: 'GoVols247 football', about: 'Football and recruiting', links: [['GoVols247', 'https://247sports.com/college/tennessee/']] },
    ],
    resources: [
      ['ESPN team page (FPI, scores)', 'https://www.espn.com/college-football/team/_/id/2633/tennessee-volunteers'],
      ['CFBD (College Football Data)', 'https://collegefootballdata.com/'],
      ['247Sports team recruiting rankings', 'https://247sports.com/college/tennessee/'],
    ],
  },

  mbb: {
    official: [{ name: 'Tennessee Basketball', about: 'Official team accounts', links: [['X @Vol_Hoops', 'https://x.com/Vol_Hoops'], ['Instagram', 'https://instagram.com/vol_hoops'], ['Facebook', 'http://facebook.com/tennesseebasketball'], ['utsports.com', 'https://utsports.com/sports/mens-basketball']] }],
    creators: [
      { name: 'Ryan Schumpert', about: 'Tennessee basketball reporter; RTI Rim Runner podcast', links: [['X @ryanschumpert00', 'https://x.com/ryanschumpert00'], ['RTI Rim Runner podcast', 'https://castbox.fm/channel/RTI-Rim-Runner-id6803016']] },
      { name: 'Southeastern16', about: 'SEC basketball coverage', links: [['Find on X', xs('Southeastern16')]] },
      { name: 'Rocky Top Insider basketball', about: 'Daily hoops coverage', links: [['Basketball news', 'https://www.rockytopinsider.com/category/basketball/']] },
    ],
    resources: [['KenPom', 'https://kenpom.com/'], ['EvanMiya', 'https://evanmiya.com/'], ['Bart Torvik (T-Rank)', 'https://barttorvik.com/'], ['ESPN BPI', 'https://www.espn.com/mens-college-basketball/bpi'], ['NCAA NET', 'https://www.ncaa.com/rankings/basketball-men/d1/ncaa-mens-basketball-net-rankings']],
  },

  wbb: {
    official: [{ name: 'Lady Vol Basketball', about: 'Official team accounts', links: [['X @LadyVol_Hoops', 'https://x.com/LadyVol_Hoops'], ['Instagram', 'https://instagram.com/ladyvol_hoops'], ['Facebook', 'https://www.facebook.com/BallWithTheLadyVols'], ['utsports.com', 'https://utsports.com/sports/womens-basketball']] }],
    creators: [
      { name: 'Ryan Sylvia', about: 'Lady Vols beat coverage for Rocky Top Insider', links: [['RTI podcast page', 'https://rockytopinsider.transistor.fm/people/ryan-sylvia'], ['Find on X', xs('Ryan Sylvia')]] },
      { name: 'Rocky Top Insider', about: 'Lady Vols coverage', links: [['rockytopinsider.com', 'https://www.rockytopinsider.com/']] },
    ],
    resources: [['Massey Ratings (women)', 'https://masseyratings.com/cbw/ncaa-d1/ratings'], ['Her Hoop Stats', 'https://herhoopstats.com/'], ['NCAA NET (women)', 'https://www.ncaa.com/rankings/basketball-women/d1/ncaa-womens-basketball-net-rankings']],
  },

  volleyball: {
    official: [{ name: 'Tennessee Volleyball', about: 'Official team accounts', links: [['X @Vol_VBall', 'https://x.com/Vol_VBall'], ['Instagram', 'https://instagram.com/vol_vball'], ['Facebook', 'https://www.facebook.com/volvball/'], ['utsports.com', 'https://utsports.com/sports/womens-volleyball']] }],
    creators: [
      { name: 'John Sartori', about: 'Covers Tennessee volleyball and soccer', links: [['X @JohnSartoriTV', 'https://x.com/JohnSartoriTV']] },
    ],
    resources: [['AVCA poll', 'https://www.ncaa.com/rankings/volleyball-women/d1/avca-coaches'], ['NCAA RPI', 'https://www.ncaa.com/rankings/volleyball-women/d1/ncaa-womens-volleyball-rpi'], ['Massey Ratings', 'https://masseyratings.com/cvw/ncaa-d1/ratings'], ['PrepVolleyball', 'https://prepvolleyball.com/']],
  },

  soccer: {
    official: [{ name: 'Tennessee Soccer', about: 'Official team accounts', links: [['X @Vol_Soccer', 'https://x.com/Vol_Soccer'], ['Instagram', 'https://instagram.com/vol_soccer'], ['Facebook', 'https://www.facebook.com/TennesseeSoccer'], ['utsports.com', 'https://utsports.com/sports/womens-soccer']] }],
    creators: [
      { name: 'John Sartori', about: 'Covers Tennessee soccer and volleyball', links: [['X @JohnSartoriTV', 'https://x.com/JohnSartoriTV']] },
    ],
    resources: [['United Soccer Coaches poll', 'https://www.ncaa.com/rankings/soccer-women/d1/united-soccer-coaches'], ['NCAA RPI', 'https://www.ncaa.com/rankings/soccer-women/d1/ncaa-womens-soccer-rpi'], ['TopDrawerSoccer', 'https://www.topdrawersoccer.com/'], ['Massey Ratings', 'https://masseyratings.com/csw/ncaa-d1/ratings']],
  },

  baseball: {
    official: [{ name: 'Tennessee Baseball', about: 'Official team accounts', links: [['X @Vol_Baseball', 'https://x.com/Vol_Baseball'], ['Instagram', 'https://instagram.com/vol_baseball'], ['Facebook', 'https://www.facebook.com/VolBaseball'], ['utsports.com', 'https://utsports.com/sports/baseball']] }],
    creators: [
      { name: 'Ben McKee', about: 'Tennessee baseball coverage and podcasts', links: [['Podcasts', 'https://www.listennotes.com/top-podcasts/ben-mckee/'], ['Find on X', xs('Ben McKee Vols')]] },
      { name: 'Vols on SI (Volunteer Country)', about: 'Baseball coverage and the VC on SI podcast', links: [['Baseball news', 'https://www.si.com/college/tennessee/baseball']] },
      { name: 'VolQuest baseball', about: 'Baseball news and recruiting', links: [['VolQuest baseball', 'https://www.on3.com/teams/tennessee-volunteers/category/baseball/news']] },
    ],
    resources: [['PEAR Ratings', 'https://pearatings.com/cbase/d1/team-profile?team=Tennessee&season=2027'], ['D1Baseball', 'https://d1baseball.com/'], ['Baseball America', 'https://www.baseballamerica.com/'], ['Perfect Game', 'https://www.perfectgame.org/']],
  },

  softball: {
    official: [{ name: 'Tennessee Softball', about: 'Official team accounts', links: [['X @Vol_Softball', 'https://x.com/Vol_Softball'], ['Instagram', 'https://instagram.com/vol_softball'], ['Facebook', 'https://www.facebook.com/TennesseeSoftball'], ['utsports.com', 'https://utsports.com/sports/softball']] }],
    creators: [
      { name: 'Rocky Top Insider softball', about: 'Softball coverage', links: [['rockytopinsider.com', 'https://www.rockytopinsider.com/']] },
    ],
    resources: [['PEAR Ratings', 'https://pearatings.com/csoft/d1?season=2027'], ['D1Softball', 'https://d1softball.com/'], ['Softball America', 'https://www.softballamerica.com/'], ['Extra Inning Softball', 'https://extrainningsoftball.com/'], ['On3 softball recruiting', 'https://www.on3.com/college/tennessee-volunteers/softball/2028/industry-comparison-commits/']],
  },
};
