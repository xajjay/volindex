/* The Vol Index — Hoops and Diamond Dynasty (men's and women's basketball, baseball, softball): static data.
   Teams and conferences (2026-27 alignment), program strength by sport, school colors (borrowed from the football
   dynasty's table when a school plays FBS football), the season calendars and the postseason formats. */
(function (root) {
  'use strict';
  const SD = root.SD = root.SD || {};

  // name|conf|men's hoops|women's hoops|baseball|softball|color|color2|state   (0 = the school does not play that sport)
  const T = `
Tennessee|SEC|89|80|92|88|#FF8200|#FFFFFF|TN
Alabama|SEC|86|62|80|88
Arkansas|SEC|84|55|92|78
Auburn|SEC|88|58|82|80
Florida|SEC|90|60|90|92
Georgia|SEC|72|62|86|84
Kentucky|SEC|88|72|78|70
LSU|SEC|66|90|94|80
Mississippi State|SEC|76|66|84|76
Missouri|SEC|74|55|66|76
Oklahoma|SEC|70|80|80|97
Ole Miss|SEC|74|72|80|80
South Carolina|SEC|66|97|76|66
Texas|SEC|74|90|86|94
Texas A&M|SEC|80|58|88|86
Vanderbilt|SEC|76|78|88|0
Duke|ACC|95|80|80|88
North Carolina|ACC|86|80|88|72
Louisville|ACC|84|82|82|72
Clemson|ACC|78|58|86|82
Miami|ACC|70|62|80|0
Virginia|ACC|74|56|86|62
Virginia Tech|ACC|66|72|76|72
NC State|ACC|70|84|84|66
Wake Forest|ACC|66|54|84|0
Pitt|ACC|64|52|60|56
Syracuse|ACC|70|60|0|56
Florida State|ACC|68|72|88|94
Georgia Tech|ACC|60|62|82|68
Boston College|ACC|56|58|66|56
Notre Dame|ACC|66|90|72|66
SMU|ACC|68|48|0|0
Cal|ACC|58|66|66|66
Stanford|ACC|62|82|82|84
Michigan|B1G|88|66|70|72
Michigan State|B1G|88|68|56|56
Purdue|B1G|90|58|56|54
Illinois|B1G|84|60|64|54
Wisconsin|B1G|82|50|0|60
Indiana|B1G|74|72|68|58
Iowa|B1G|72|84|66|56
Ohio State|B1G|76|78|64|62
Maryland|B1G|78|82|64|52
UCLA|B1G|82|94|80|94
USC|B1G|74|92|72|0
Oregon|B1G|74|72|76|80
Nebraska|B1G|70|68|72|62
Northwestern|B1G|62|54|50|72
Minnesota|B1G|58|60|52|58
Rutgers|B1G|62|52|62|50
Penn State|B1G|60|58|58|56
Washington|B1G|62|62|66|86
Houston|B12|92|50|62|66
Iowa State|B12|88|70|0|66
Texas Tech|B12|86|64|78|80
Kansas|B12|88|68|62|66
Arizona|B12|86|64|80|86
BYU|B12|84|62|60|66
Baylor|B12|80|84|70|72
Cincinnati|B12|70|50|58|54
Kansas State|B12|70|76|66|0
Oklahoma State|B12|64|70|84|88
TCU|B12|70|80|82|0
UCF|B12|64|52|70|76
West Virginia|B12|70|72|74|0
Colorado|B12|64|68|0|0
Arizona State|B12|62|62|74|76
Utah|B12|62|72|62|66
UConn|BE|94|98|72|56|#000E2F|#FFFFFF|CT
St. John's|BE|88|56|60|54|#BA0C2F|#FFFFFF|NY
Marquette|BE|80|62|0|0|#003366|#FFCC00|WI
Creighton|BE|80|66|62|56|#005CA9|#FFFFFF|NE
Villanova|BE|76|70|52|50|#00205B|#13B5EA|PA
Xavier|BE|74|50|58|0|#0C2340|#9EA2A2|OH
Providence|BE|68|50|0|50|#000000|#A2AAAD|RI
Butler|BE|66|50|52|50|#13294B|#FFFFFF|IN
Seton Hall|BE|62|58|58|52|#004488|#FFFFFF|NJ
Georgetown|BE|62|52|54|0|#041E42|#63666A|DC
DePaul|BE|56|54|0|54|#005EB8|#E4002B|IL
Gonzaga|WCC|88|76|58|52|#002967|#C8102E|WA
Saint Mary's|WCC|76|52|56|50|#D80024|#06315B|CA
San Francisco|WCC|60|48|56|50|#00543C|#FDBB30|CA
Santa Clara|WCC|62|48|54|52|#862633|#FFFFFF|CA
Portland|WCC|46|62|56|0|#3F2A56|#FFFFFF|OR
San Diego|WCC|50|52|62|56|#003B70|#75BEE9|CA
San Diego State|MWC|78|48|58|62
Utah State|MWC|76|48|50|56
New Mexico|MWC|72|50|56|58
Boise State|MWC|70|52|0|58
UNLV|MWC|64|58|60|54
Nevada|MWC|64|50|62|54
Colorado State|MWC|66|56|0|54
Grand Canyon|MWC|66|52|64|62|#522398|#FFFFFF|AZ
Dayton|A10|74|52|58|50|#CE1141|#004B8D|OH
VCU|A10|76|56|66|0|#000000|#F8B800|VA
Saint Louis|A10|70|56|60|56|#003DA5|#FFFFFF|MO
Loyola Chicago|A10|62|50|0|50|#7C2529|#FFC82E|IL
George Mason|A10|66|54|60|56|#006633|#FFCC33|VA
Richmond|A10|60|66|58|52|#990000|#000066|VA
Davidson|A10|60|54|58|0|#AC1A2F|#000000|NC
Saint Joseph's|A10|64|52|52|50|#9E1B32|#A2AAAD|PA
Duquesne|A10|60|56|0|54|#002D62|#BA0C2F|PA
Rhode Island|A10|58|58|58|0|#002147|#75B2DD|RI
Memphis|AAC|80|52|52|52
FAU|AAC|70|48|64|56
Wichita State|AAC|64|50|66|62|#000000|#FFCD00|KS
North Texas|AAC|66|54|0|58
UAB|AAC|64|52|58|56
Temple|AAC|58|50|0|50
Tulane|AAC|58|56|70|0
South Florida|AAC|62|64|66|76
East Carolina|AAC|52|56|80|52
Charlotte|AAC|52|52|58|58
Rice|AAC|50|50|56|0
UTSA|AAC|50|50|62|56
Coastal Carolina|SBC|52|48|82|62
James Madison|SBC|62|68|64|70
App State|SBC|56|52|60|58
Arkansas State|SBC|60|56|52|54
Troy|SBC|56|68|66|64
Old Dominion|SBC|54|58|66|50
Marshall|SBC|58|58|54|52
South Alabama|SBC|52|46|64|66
Louisiana|SBC|58|60|74|86
Southern Miss|SBC|52|50|80|60
Georgia Southern|SBC|50|52|64|58
Texas State|SBC|56|50|70|76
Drake|MVC|72|68|0|56|#004477|#FFFFFF|IA
Bradley|MVC|66|48|50|50|#A50000|#FFFFFF|IL
Northern Iowa|MVC|62|56|0|56
Belmont|MVC|64|64|54|52|#002469|#C8102E|TN
Murray State|MVC|62|58|56|50|#002144|#ECAC00|KY
Illinois State|MVC|60|56|56|58|#CE1126|#F9DD16|IL
Southern Illinois|MVC|56|52|56|58
Evansville|MVC|48|46|58|50|#663399|#FF6600|IN
Wofford|SoCon|58|48|56|0
Furman|SoCon|60|52|0|52
Chattanooga|SoCon|56|60|0|62
East Tennessee State|SoCon|56|50|62|52
Samford|SoCon|60|50|62|56
UNC Greensboro|SoCon|56|56|54|56|#0F2044|#FFB71B|NC
Western Carolina|SoCon|46|46|52|54
Mercer|SoCon|50|56|60|58
Radford|BSouth|50|46|50|50|#C2011B|#FFFFFF|VA
High Point|BSouth|66|56|58|50|#330072|#FFFFFF|NC
Winthrop|BSouth|54|48|52|52|#872434|#FFD700|SC
UNC Asheville|BSouth|50|48|50|0|#003DA5|#FFFFFF|NC
Longwood|BSouth|50|46|0|52|#002855|#9EA2A2|VA
Presbyterian|BSouth|44|44|50|50|#0060A9|#9D2235|SC
Tennessee State|OVC|48|50|0|0
Morehead State|OVC|52|48|52|52|#003399|#FFCC00|KY
SIUE|OVC|50|50|52|54|#C8102E|#000000|IL
Little Rock|OVC|54|52|52|0|#6F263D|#A2AAAD|AR
UT Martin|OVC|46|56|0|58
Tennessee Tech|OVC|50|56|54|52
Eastern Kentucky|OVC|50|50|52|52
Marist|MAAC|52|54|50|50|#C8102E|#FFFFFF|NY
Quinnipiac|MAAC|52|58|50|50|#0C2340|#FFB81C|CT
Iona|MAAC|54|50|50|50|#6F2C3F|#FFB81C|NY
Fairfield|MAAC|50|66|50|52|#C8102E|#FFFFFF|CT
Siena|MAAC|50|48|50|50|#006A4E|#FFC72C|NY
Saint Peter's|MAAC|52|44|0|0|#0039A6|#FFFFFF|NJ
Norfolk State|MEAC|54|52|0|0|#007A53|#F3D03E|VA
Howard|MEAC|52|58|0|50|#003A63|#E51937|DC
North Carolina Central|MEAC|50|48|0|0|#880023|#808080|NC
Delaware State|MEAC|42|42|50|50|#E51937|#00B2E3|DE
Morgan State|MEAC|44|44|0|0|#F47937|#0033A1|MD
Dallas Baptist|CUSA|0|0|80|0|#002D72|#C8102E|TX
Liberty|CUSA|58|62|64|72
Western Kentucky|CUSA|58|56|56|64
Kennesaw State|CUSA|54|50|60|56
Jacksonville State|CUSA|56|54|60|58
Middle Tennessee|CUSA|58|72|54|56
Oregon State|P12|0|0|88|58
Washington State|P12|0|0|66|0
Fresno State|P12|0|0|60|66
UC Irvine|BWest|0|0|74|0|#0064A4|#FFD200|CA
UC Santa Barbara|BWest|0|0|70|62|#004D9F|#FDB515|CA
Cal Poly|BWest|0|0|66|58|#154734|#C69214|CA
Long Beach State|BWest|0|0|66|62|#000000|#FFC72A|CA
Stetson|ASUN|0|0|58|64|#006747|#FFFFFF|FL
Lipscomb|ASUN|0|0|56|60|#3C1053|#F1B434|TN
Florida Gulf Coast|ASUN|0|0|58|70|#00447C|#008B47|FL
North Florida|ASUN|0|0|56|54|#00246B|#A2AAAD|FL
Austin Peay|ASUN|0|0|58|56
Northern Illinois|MAC|0|0|50|52`;

  // a few schools only in the guest pool or with no football colors
  const COLORS = { 'Iowa State': ['#C8102E', '#F1BE48'], 'Gonzaga': ['#002967', '#C8102E'] };

  const SPORT_COL = { mbb: 2, wbb: 3, baseball: 4, softball: 5 };
  SD.CONF_NAME = { SEC: 'SEC', ACC: 'ACC', B1G: 'Big Ten', B12: 'Big 12', BE: 'Big East', WCC: 'West Coast', MWC: 'Mountain West', A10: 'Atlantic 10', AAC: 'American', SBC: 'Sun Belt',
    MVC: 'Missouri Valley', SoCon: 'Southern', BSouth: 'Big South', OVC: 'Ohio Valley', MAAC: 'MAAC', MEAC: 'MEAC', CUSA: 'Conference USA', P12: 'Pac-12', BWest: 'Big West', ASUN: 'ASUN', MAC: 'MAC', IND: 'Independent' };
  SD.POWER = ['SEC', 'ACC', 'B1G', 'B12', 'BE'];

  // teams for a sport: the schools that play it, with strength and colors
  SD.teamsFor = sport => {
    const col = SPORT_COL[sport], fb = root.DY && root.DY.TEAMS ? root.DY.TEAMS.concat(root.DY.FCS || []) : [];
    const out = [];
    T.trim().split('\n').forEach(line => {
      const f = line.split('|'), pr = +f[col]; if (!pr) return;
      const name = f[0], ft = fb.find(t => t.name === name) || {};
      const c = COLORS[name] || [];
      out.push({ id: out.length, name, abbr: ft.abbr || SD.abbrOf(name), conf: f[1], prestige: pr, c1: f[6] || c[0] || ft.c1 || SD.hashColor(name), c2: f[7] || c[1] || ft.c2 || '#FFFFFF', st: f[8] || ft.st || 'TN' });
    });
    return out;
  };
  SD.abbrOf = n => { const w = n.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean); return (w.length > 1 ? w.map(x => x[0]).join('') : n.slice(0, 4)).toUpperCase().slice(0, 5); };
  SD.hashColor = n => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; const H = (h % 360) / 60, C = 0.55 * (1 - Math.abs(2 * 0.35 - 1)), X = C * (1 - Math.abs(H % 2 - 1)), m = 0.35 - C / 2; const [r, g, b] = H < 1 ? [C, X, 0] : H < 2 ? [X, C, 0] : H < 3 ? [0, C, X] : H < 4 ? [0, X, C] : H < 5 ? [X, 0, C] : [C, 0, X]; return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join(''); };

  /* ---------- the sports ---------- */
  // Men's basketball 2026-27: SEC Tournament Mar. 10-14 (Nashville); Selection Sunday Mar. 14; First Four Mar. 16-17; first and second
  // rounds Mar. 18-21; regionals Mar. 25-28; Final Four Apr. 3 and title Apr. 5 (Detroit).
  // Women's: SEC Tournament Mar. 4-8 (Greenville); First Four Mar. 18-19; first and second rounds Mar. 20-23; regionals Mar. 27-30;
  // Final Four Apr. 2 and title Apr. 4 (Columbus).
  // Baseball 2027: SEC Tournament May 25-30 (Hoover); regionals June 4-7; super regionals June 11-14; Men's College World Series June 18-28 (Omaha).
  // Softball 2027: SEC Tournament May 11-15; regionals May 21-23; super regionals May 27-30; Women's College World Series June 3-11 (Oklahoma City).
  // (Postseason dates follow each event's usual place on the calendar; the NCAA confirms them closer to the season.)
  SD.SPORTS = {
    mbb: { key: 'mbb', name: "Men's basketball", short: 'Hoops', title: 'Vol Hoops Dynasty', kind: 'hoops', he: 'he', season: 2026, label: y => y + '-' + String(y + 1).slice(2),
      roster: 15, scholar: 15, halves: true, periods: 2, perLen: 1200, shot: 30, fouls: { bonus: 7, double: 10, foulOut: 5 },
      conf: { SEC: 18 }, confGames: 18, nonConf: 13,
      ct: { SEC: { days: ['03-10', '03-11', '03-12', '03-13', '03-14'], site: 'Nashville' } }, ncaa: { field: 68, days: { ff: ['03-16', '03-17'], r64: ['03-18', '03-19'], r32: ['03-20', '03-21'], s16: ['03-25', '03-26'], e8: ['03-27', '03-28'], f4: ['04-03'], nc: ['04-05'] }, site: 'Detroit' },
      start: '11-03', draft: 'NBA Draft', pro: 'NBA' },
    wbb: { key: 'wbb', name: "Women's basketball", short: 'Hoops', title: 'Lady Vols Dynasty', kind: 'hoops', he: 'she', season: 2026, label: y => y + '-' + String(y + 1).slice(2),
      roster: 15, scholar: 15, halves: false, periods: 4, perLen: 600, shot: 30, fouls: { bonus: 5, double: 5, foulOut: 5 },
      conf: { SEC: 16 }, confGames: 16, nonConf: 14,
      ct: { SEC: { days: ['03-04', '03-05', '03-06', '03-07', '03-08'], site: 'Greenville' } }, ncaa: { field: 68, days: { ff: ['03-18', '03-19'], r64: ['03-20', '03-21'], r32: ['03-22', '03-23'], s16: ['03-27', '03-28'], e8: ['03-29', '03-30'], f4: ['04-02'], nc: ['04-04'] }, site: 'Columbus' },
      start: '11-02', draft: 'WNBA Draft', pro: 'WNBA' },
    baseball: { key: 'baseball', name: 'Baseball', short: 'Baseball', title: 'Vol Diamond Dynasty', kind: 'diamond', he: 'he', season: 2027, label: y => String(y),
      roster: 34, innings: 9, mercy: { runs: 10, after: 7 }, ttb: false, confSeries: 10, games: 56,
      ct: { SEC: { start: '05-25', site: 'Hoover' } }, ncaa: { regional: '06-04', superR: '06-11', ws: '06-18', wsName: "Men's College World Series", wsSite: 'Omaha' },
      start: '02-19', draft: 'MLB Draft', pro: 'MLB' },
    softball: { key: 'softball', name: 'Softball', short: 'Softball', title: 'Lady Vols Softball Dynasty', kind: 'diamond', he: 'she', season: 2027, label: y => String(y),
      roster: 25, innings: 7, mercy: { runs: 8, after: 5 }, ttb: true, confSeries: 8, games: 56,
      ct: { SEC: { start: '05-11', site: 'SEC Tournament' } }, ncaa: { regional: '05-21', superR: '05-27', ws: '06-03', wsName: "Women's College World Series", wsSite: 'Oklahoma City' },
      start: '02-11', draft: 'AUSL Draft', pro: 'AUSL' },
  };

  /* ---------- names ---------- */
  SD.FIRST_M = 'Jalen Marcus Tyler Jordan Cameron Caleb Isaiah Jaylen Chris Elijah Josh Noah Mason Ethan Aiden Logan Brady Cole Gavin Hunter Landon Tanner Wyatt Carson Dylan Trey Malik Darius Andre Xavier Jamal Kobe Zion Amari Jace Bryce Colby Drew Grant Reid Owen Luke Jake Blake Nate Ty Cade Kade Brooks Max Sam Will Tre Javon Kendrick Devin Rashad Quinn Miles Dante Cooper Parker Ryder Hayden Chase Kyler'.split(' ');
  SD.FIRST_W = 'Ava Mia Kennedy Jada Aaliyah Brooke Taylor Madison Kayla Jordan Morgan Riley Sydney Destiny Imani Nia Alyssa Bailey Hailey Kendall Laila Maya Sierra Tessa Paige Reese Avery Camryn Emma Olivia Sophia Grace Ella Chloe Hannah Kate Lauren Mackenzie Raven Jasmine Tiana Zoe Amari Skylar Makayla Janiah Kiara Talia Gabby Lexi Peyton Rylee Kylie Halle Abby Ellie Addison Harper Lily'.split(' ');
  SD.LAST = 'Johnson Williams Brown Jones Davis Miller Wilson Moore Taylor Anderson Thomas Jackson White Harris Martin Thompson Garcia Martinez Robinson Clark Lewis Walker Hall Allen Young King Wright Scott Green Baker Adams Nelson Hill Campbell Mitchell Roberts Carter Phillips Evans Turner Parker Collins Edwards Stewart Morris Murphy Cook Rogers Morgan Cooper Peterson Bailey Reed Kelly Howard Cox Ward Richardson Watson Brooks Wood James Bennett Gray Hughes Price Sanders Myers Long Ross Foster Powell Jenkins Perry Russell Sullivan Bell Coleman Butler Henderson Barnes Fisher Simmons Graham Hayes Bryant Gibson Ellis Stevens Holmes Ford Warren Dixon Burns Gordon Shaw Rice Hunt Black Daniels Palmer Mills Grant Knight Ferguson Stone Hawkins Dunn Pierce Hansen Lane Riley Carr Weaver Arnold Hart'.split(' ');
  SD.TOWNS = [['Knoxville', 'TN'], ['Nashville', 'TN'], ['Memphis', 'TN'], ['Chattanooga', 'TN'], ['Atlanta', 'GA'], ['Charlotte', 'NC'], ['Raleigh', 'NC'], ['Birmingham', 'AL'], ['Houston', 'TX'], ['Dallas', 'TX'], ['Chicago', 'IL'], ['Indianapolis', 'IN'], ['Louisville', 'KY'], ['Cincinnati', 'OH'], ['Columbus', 'OH'], ['Detroit', 'MI'], ['Philadelphia', 'PA'], ['Baltimore', 'MD'], ['Washington', 'DC'], ['Richmond', 'VA'], ['Orlando', 'FL'], ['Tampa', 'FL'], ['Miami', 'FL'], ['Jacksonville', 'FL'], ['New Orleans', 'LA'], ['Jackson', 'MS'], ['St. Louis', 'MO'], ['Kansas City', 'MO'], ['Los Angeles', 'CA'], ['San Diego', 'CA'], ['Phoenix', 'AZ'], ['Las Vegas', 'NV'], ['Seattle', 'WA'], ['Denver', 'CO'], ['Minneapolis', 'MN'], ['New York', 'NY'], ['Boston', 'MA'], ['Oklahoma City', 'OK'], ['Little Rock', 'AR'], ['Columbia', 'SC']];
})(typeof window !== 'undefined' ? window : globalThis);
