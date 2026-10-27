/* The Vol Index — Football Dynasty: static data (teams, conferences, names, playbook, bowls).
   Conferences are the 2026 alignment. Prestige (0-99) drives CPU roster strength, recruiting pull and NIL budgets.
   Colors are school colors (no logos). */
(function (root) {
  'use strict';
  const DY = root.DY = root.DY || {};

  // name|abbr|conf|prestige|color|color2|stadium (thousands)|state
  const T = `
Alabama|ALA|SEC|92|#9E1B32|#FFFFFF|101|AL
Arkansas|ARK|SEC|66|#9D2235|#FFFFFF|76|AR
Auburn|AUB|SEC|78|#0C2340|#E87722|88|AL
Florida|FLA|SEC|79|#0021A5|#FA4616|88|FL
Georgia|UGA|SEC|95|#BA0C2F|#000000|93|GA
Kentucky|UK|SEC|64|#0033A0|#FFFFFF|61|KY
LSU|LSU|SEC|87|#461D7C|#FDD023|102|LA
Mississippi State|MSST|SEC|62|#660000|#FFFFFF|61|MS
Missouri|MIZ|SEC|77|#F1B82D|#000000|62|MO
Oklahoma|OU|SEC|84|#841617|#FDF9D8|80|OK
Ole Miss|MISS|SEC|86|#CE1126|#14213D|64|MS
South Carolina|SC|SEC|76|#73000A|#000000|77|SC
Tennessee|TENN|SEC|86|#FF8200|#FFFFFF|102|TN
Texas|TEX|SEC|93|#BF5700|#FFFFFF|100|TX
Texas A&M|TAMU|SEC|86|#500000|#FFFFFF|102|TX
Vanderbilt|VAN|SEC|72|#866D4B|#000000|40|TN
Illinois|ILL|B1G|76|#E84A27|#13294B|60|IL
Indiana|IND|B1G|88|#990000|#FFFFFF|52|IN
Iowa|IOWA|B1G|77|#FFCD00|#000000|69|IA
Maryland|MD|B1G|62|#E03A3E|#FFD520|51|MD
Michigan|MICH|B1G|87|#00274C|#FFCB05|107|MI
Michigan State|MSU|B1G|66|#18453B|#FFFFFF|75|MI
Minnesota|MINN|B1G|70|#7A0019|#FFCC33|50|MN
Nebraska|NEB|B1G|75|#E41C38|#FFFFFF|85|NE
Northwestern|NW|B1G|62|#4E2A84|#FFFFFF|35|IL
Ohio State|OSU|B1G|95|#BB0000|#666666|102|OH
Oregon|ORE|B1G|91|#154733|#FEE123|54|OR
Penn State|PSU|B1G|86|#041E42|#FFFFFF|106|PA
Purdue|PUR|B1G|58|#CEB888|#000000|61|IN
Rutgers|RUT|B1G|63|#CC0033|#000000|52|NJ
UCLA|UCLA|B1G|68|#2D68C4|#F2A900|70|CA
USC|USC|B1G|84|#990000|#FFC72C|77|CA
Washington|WASH|B1G|79|#4B2E83|#B7A57A|70|WA
Wisconsin|WIS|B1G|70|#C5050C|#FFFFFF|76|WI
Arizona|ARIZ|B12|70|#CC0033|#003366|50|AZ
Arizona State|ASU|B12|79|#8C1D40|#FFC627|53|AZ
Baylor|BAY|B12|72|#154734|#FFB81C|45|TX
BYU|BYU|B12|80|#002E5D|#FFFFFF|63|UT
Cincinnati|CIN|B12|66|#E00122|#000000|40|OH
Colorado|COLO|B12|72|#CFB87C|#000000|50|CO
Houston|HOU|B12|68|#C8102E|#FFFFFF|40|TX
Iowa State|ISU|B12|74|#C8102E|#F1BE48|61|IA
Kansas|KU|B12|68|#0051BA|#E8000D|47|KS
Kansas State|KSU|B12|74|#512888|#FFFFFF|52|KS
Oklahoma State|OKST|B12|64|#FF7300|#000000|55|OK
TCU|TCU|B12|74|#4D1979|#FFFFFF|45|TX
Texas Tech|TTU|B12|84|#CC0000|#000000|60|TX
UCF|UCF|B12|68|#000000|#BA9B37|45|FL
Utah|UTAH|B12|78|#CC0000|#FFFFFF|51|UT
West Virginia|WVU|B12|68|#002855|#EAAA00|60|WV
Boston College|BC|ACC|62|#98002E|#BC9B6A|44|MA
Cal|CAL|ACC|64|#003262|#FDB515|63|CA
Clemson|CLEM|ACC|85|#F56600|#522D80|81|SC
Duke|DUKE|ACC|70|#003087|#FFFFFF|40|NC
Florida State|FSU|ACC|77|#782F40|#CEB888|67|FL
Georgia Tech|GT|ACC|76|#B3A369|#003057|51|GA
Louisville|LOU|ACC|76|#AD0000|#000000|60|KY
Miami|MIA|ACC|88|#F47321|#005030|65|FL
NC State|NCST|ACC|68|#CC0000|#FFFFFF|57|NC
North Carolina|UNC|ACC|70|#7BAFD4|#13294B|50|NC
Pitt|PITT|ACC|68|#003594|#FFB81C|68|PA
SMU|SMU|ACC|77|#C8102E|#0033A0|32|TX
Stanford|STAN|ACC|62|#8C1515|#FFFFFF|50|CA
Syracuse|SYR|ACC|64|#F76900|#000E54|49|NY
Virginia|UVA|ACC|68|#232D4B|#F84C1E|61|VA
Virginia Tech|VT|ACC|70|#630031|#CF4420|65|VA
Wake Forest|WAKE|ACC|60|#9E7E38|#000000|31|NC
Notre Dame|ND|IND|91|#0C2340|#C99700|78|IN
UConn|UCONN|IND|56|#000E2F|#FFFFFF|40|CT
Boise State|BSU|P12|72|#0033A0|#D64309|36|ID
Colorado State|CSU|P12|52|#1E4D2B|#C8C372|36|CO
Fresno State|FRES|P12|58|#DB0032|#002E6D|40|CA
Oregon State|ORST|P12|58|#DC4405|#000000|35|OR
San Diego State|SDSU|P12|56|#A6192E|#000000|35|CA
Texas State|TXST|P12|58|#501214|#8D734A|30|TX
Utah State|USU|P12|50|#0F2439|#FFFFFF|25|UT
Washington State|WSU|P12|58|#981E32|#5E6A71|32|WA
Air Force|AF|MWC|54|#003087|#8A8D8F|46|CO
Hawai'i|HAW|MWC|50|#024731|#FFFFFF|15|HI
Nevada|NEV|MWC|44|#003366|#807F84|27|NV
New Mexico|UNM|MWC|50|#BA0C2F|#63666A|39|NM
San José State|SJSU|MWC|52|#0055A2|#E5A823|30|CA
UNLV|UNLV|MWC|64|#CF0A2C|#666666|65|NV
Wyoming|WYO|MWC|48|#492F24|#FFC425|29|WY
Northern Illinois|NIU|MWC|50|#BA0C2F|#000000|24|IL
UTEP|UTEP|MWC|44|#FF8200|#041E42|51|TX
Army|ARMY|AAC|60|#000000|#D3BC8D|38|NY
Charlotte|CLT|AAC|42|#046A38|#B9975B|15|NC
East Carolina|ECU|AAC|54|#592A8A|#FDC82F|50|NC
FAU|FAU|AAC|50|#003366|#CC0000|29|FL
Memphis|MEM|AAC|64|#003087|#898D8D|58|TN
Navy|NAVY|AAC|62|#00205B|#C5B783|34|MD
North Texas|UNT|AAC|60|#00853E|#FFFFFF|30|TX
Rice|RICE|AAC|46|#00205B|#C1C6C8|47|TX
South Florida|USF|AAC|60|#006747|#CFC493|65|FL
Temple|TEM|AAC|44|#9D2235|#FFFFFF|69|PA
Tulane|TULN|AAC|68|#006747|#418FDE|30|LA
Tulsa|TLSA|AAC|50|#002D72|#C8102E|30|OK
UAB|UAB|AAC|46|#1E6B52|#F4C300|47|AL
UTSA|UTSA|AAC|58|#0C2340|#F15A22|64|TX
App State|APP|SBC|58|#222222|#FFCC00|30|NC
Arkansas State|ARST|SBC|50|#CC092F|#000000|30|AR
Coastal Carolina|CCU|SBC|54|#006F71|#A27752|21|SC
Georgia Southern|GASO|SBC|56|#011E41|#A3AAAE|25|GA
Georgia State|GAST|SBC|46|#0039A6|#C60C30|25|GA
James Madison|JMU|SBC|68|#450084|#CBB677|25|VA
Louisiana|ULL|SBC|58|#CE181E|#000000|41|LA
ULM|ULM|SBC|42|#840029|#BD955A|30|LA
Marshall|MRSH|SBC|54|#00B140|#FFFFFF|38|WV
Old Dominion|ODU|SBC|54|#003057|#7C878E|22|VA
South Alabama|USA|SBC|56|#00205B|#BF0D3E|25|AL
Southern Miss|USM|SBC|48|#FFAB00|#000000|36|MS
Troy|TROY|SBC|54|#8A2432|#B3B5B8|30|AL
Akron|AKR|MAC|38|#041E42|#A89968|30|OH
Ball State|BALL|MAC|42|#BA0C2F|#FFFFFF|22|IN
Bowling Green|BGSU|MAC|48|#FE5000|#4F2C1D|24|OH
Buffalo|BUFF|MAC|46|#005BBB|#FFFFFF|25|NY
Central Michigan|CMU|MAC|46|#6A0032|#FFC82E|30|MI
Eastern Michigan|EMU|MAC|44|#006633|#FFFFFF|24|MI
Kent State|KENT|MAC|36|#002664|#EAAB00|25|OH
Miami (OH)|M-OH|MAC|54|#C3142D|#FFFFFF|24|OH
Ohio|OHIO|MAC|54|#00694E|#FFFFFF|24|OH
Toledo|TOL|MAC|56|#15397F|#FFDA00|26|OH
Western Michigan|WMU|MAC|52|#6C4023|#B5A167|30|MI
UMass|MASS|MAC|36|#881C1C|#FFFFFF|17|MA
Delaware|DEL|CUSA|46|#00539F|#FFD200|22|DE
FIU|FIU|CUSA|42|#081E3F|#B6862C|20|FL
Jacksonville State|JVST|CUSA|54|#CC0000|#FFFFFF|24|AL
Kennesaw State|KENN|CUSA|42|#FDBB30|#0B1315|10|GA
Liberty|LIB|CUSA|56|#0A254E|#C41230|25|VA
Louisiana Tech|LT|CUSA|48|#002F8B|#E31B23|28|LA
Middle Tennessee|MTSU|CUSA|46|#0066CC|#FFFFFF|30|TN
Missouri State|MOST|CUSA|42|#5E0009|#FFFFFF|17|MO
New Mexico State|NMSU|CUSA|42|#8C0B42|#FFFFFF|28|NM
Sam Houston|SHSU|CUSA|44|#F76800|#FFFFFF|14|TX
Western Kentucky|WKU|CUSA|54|#C60C30|#FFFFFF|22|KY`;

  // FCS opponents (no stored roster: generated for the day from a seed)
  const F = `
Furman|FUR|36|#582C83|#FFFFFF|SC
Tennessee State|TNST|30|#00539F|#FFFFFF|TN
Chattanooga|UTC|38|#00386B|#E0AA0F|TN
East Tennessee State|ETSU|36|#041E42|#FFC72C|TN
UT Martin|UTM|32|#0E1C4D|#FF8200|TN
Austin Peay|APSU|32|#C41E3A|#FFFFFF|TN
Tennessee Tech|TTU2|28|#4F2984|#FFDD00|TN
Samford|SAM|34|#002649|#C8102E|AL
Mercer|MER|38|#F76800|#000000|GA
Wofford|WOF|32|#886E4C|#000000|SC
Western Carolina|WCU|32|#592C88|#C1A875|NC
The Citadel|CIT|30|#3975B7|#FFFFFF|SC
Eastern Kentucky|EKU|34|#861F41|#FFFFFF|KY
North Alabama|UNA|30|#46166B|#DB9F11|AL
Alabama A&M|AAMU|26|#660000|#FFFFFF|AL
Jackson State|JKST|36|#002147|#FFFFFF|MS
Florida A&M|FAMU|32|#F47A20|#00843D|FL
North Dakota State|NDSU|50|#0A5640|#FFC82E|ND
South Dakota State|SDST|48|#0033A0|#FFD100|SD
Montana|MONT|44|#70003C|#999999|MT
Montana State|MTST|46|#003875|#B9975B|MT
Villanova|NOVA|40|#00205B|#13B5EA|PA
Richmond|RICH|34|#990000|#000066|VA
William & Mary|WM|34|#115740|#B9975B|VA
Youngstown State|YSU|32|#E31937|#FFFFFF|OH
Southern Illinois|SIU|36|#720000|#FFFFFF|IL
Northern Iowa|UNI|38|#4B116F|#FFCC00|IA
Incarnate Word|UIW|38|#CB2C30|#000000|TX
Abilene Christian|ACU|34|#4F2D7F|#FFFFFF|TX
McNeese|MCN|32|#00529B|#FFD204|LA
Southeastern Louisiana|SELA|34|#006341|#EEB111|LA
Nicholls|NICH|30|#C41230|#A2AAAD|LA
UC Davis|UCD|40|#022851|#FFBF00|CA
Idaho|IDHO|40|#B3A369|#000000|ID
Sacramento State|SAC|42|#043927|#C4B581|CA`;

  const CONF_NAME = { SEC: 'SEC', B1G: 'Big Ten', B12: 'Big 12', ACC: 'ACC', IND: 'Independent', P12: 'Pac-12', MWC: 'Mountain West', AAC: 'American', SBC: 'Sun Belt', MAC: 'MAC', CUSA: 'Conference USA', FCS: 'FCS' };
  const P4 = ['SEC', 'B1G', 'B12', 'ACC'];
  const CONF_GAMES = { SEC: 9, B1G: 9, B12: 9, ACC: 8, P12: 7, MWC: 8, AAC: 8, SBC: 8, MAC: 8, CUSA: 8 };

  DY.TEAMS = T.trim().split('\n').map((l, i) => {
    const [name, abbr, conf, pr, c1, c2, cap, st] = l.split('|');
    return { id: i, name, abbr, conf, prestige: +pr, c1, c2, cap: +cap, st, fbs: true };
  });
  DY.FCS = F.trim().split('\n').map((l, i) => {
    const [name, abbr, pr, c1, c2, st] = l.split('|');
    return { id: 1000 + i, name, abbr, conf: 'FCS', prestige: +pr, c1, c2, cap: 15, st, fbs: false };
  });
  DY.CONF_NAME = CONF_NAME; DY.P4 = P4; DY.CONF_GAMES = CONF_GAMES;
  DY.UT_ID = DY.TEAMS.find(t => t.abbr === 'TENN').id;

  // SEC permanent opponents (2026 format)
  DY.SEC_PERM = {
    Alabama: ['Auburn', 'Tennessee', 'Mississippi State'], Arkansas: ['Missouri', 'Texas', 'LSU'], Auburn: ['Georgia', 'Alabama', 'Vanderbilt'],
    Florida: ['Georgia', 'South Carolina', 'Kentucky'], Georgia: ['Auburn', 'Florida', 'South Carolina'], Kentucky: ['South Carolina', 'Tennessee', 'Florida'],
    LSU: ['Arkansas', 'Ole Miss', 'Texas A&M'], 'Mississippi State': ['Ole Miss', 'Alabama', 'Vanderbilt'], Missouri: ['Arkansas', 'Texas A&M', 'Oklahoma'],
    Oklahoma: ['Texas', 'Ole Miss', 'Missouri'], 'Ole Miss': ['Mississippi State', 'LSU', 'Oklahoma'], 'South Carolina': ['Georgia', 'Kentucky', 'Florida'],
    Tennessee: ['Alabama', 'Vanderbilt', 'Kentucky'], Texas: ['Texas A&M', 'Arkansas', 'Oklahoma'], 'Texas A&M': ['Texas', 'LSU', 'Missouri'],
    Vanderbilt: ['Tennessee', 'Mississippi State', 'Auburn'],
  };
  // Tennessee's real SEC slates 2026-29, then the cycle repeats (2030 = 2026 ...). H = home.
  DY.UT_SEC = {
    2026: { H: ['Alabama', 'Auburn', 'Kentucky', 'LSU', 'Texas'], A: ['Arkansas', 'South Carolina', 'Texas A&M', 'Vanderbilt'] },
    2027: { H: ['Florida', 'Mississippi State', 'Ole Miss', 'Vanderbilt'], A: ['Alabama', 'Georgia', 'Kentucky', 'Missouri', 'Oklahoma'] },
    2028: { H: ['Alabama', 'Arkansas', 'Kentucky', 'South Carolina', 'Texas A&M'], A: ['Auburn', 'LSU', 'Texas', 'Vanderbilt'] },
    2029: { H: ['Georgia', 'Missouri', 'Oklahoma', 'Vanderbilt'], A: ['Alabama', 'Florida', 'Kentucky', 'Mississippi State', 'Ole Miss'] },
  };
  // rivalry-week pairs (last regular-season Saturday) when both are in the same conference
  DY.RIVALRY_WEEK = [['Tennessee', 'Vanderbilt'], ['Alabama', 'Auburn'], ['Ole Miss', 'Mississippi State'], ['Texas', 'Texas A&M'], ['Florida', 'Florida State'],
    ['Georgia', 'Georgia Tech'], ['South Carolina', 'Clemson'], ['Kentucky', 'Louisville'], ['Ohio State', 'Michigan'], ['Oregon', 'Oregon State'],
    ['Washington', 'Washington State'], ['UCLA', 'USC'], ['Iowa', 'Nebraska'], ['Minnesota', 'Wisconsin'], ['Indiana', 'Purdue'], ['Penn State', 'Rutgers'],
    ['Michigan State', 'Maryland'], ['Illinois', 'Northwestern'], ['Arizona', 'Arizona State'], ['Kansas', 'Kansas State'], ['Utah', 'BYU'],
    ['Oklahoma State', 'Texas Tech'], ['North Carolina', 'NC State'], ['Virginia', 'Virginia Tech'], ['Duke', 'Wake Forest'], ['Pitt', 'Syracuse'],
    ['Cal', 'Stanford'], ['LSU', 'Oklahoma'], ['Arkansas', 'Missouri'], ['Miami', 'Boston College']];
  // trophy games / rivalry names for the scoreboard
  DY.RIVAL_NAME = { 'Alabama|Tennessee': 'Third Saturday in October', 'Tennessee|Vanderbilt': 'Rivalry Week', 'Florida|Tennessee': 'Border-line rivalry',
    'Georgia|Tennessee': 'Rivals', 'Kentucky|Tennessee': 'Battle for the Barrel', 'Alabama|Auburn': 'Iron Bowl', 'Mississippi State|Ole Miss': 'Egg Bowl',
    'Michigan|Ohio State': 'The Game', 'Texas|Texas A&M': 'Lone Star Showdown', 'Oklahoma|Texas': 'Red River Rivalry' };

  // state centroids (lat, lon) for recruiting distance
  DY.STATE_LL = { AL: [32.8, -86.8], AK: [61, -150], AZ: [34.2, -111.7], AR: [34.9, -92.4], CA: [36.8, -119.4], CO: [39, -105.5], CT: [41.6, -72.7], DE: [39, -75.5],
    FL: [28.6, -82.4], GA: [32.7, -83.4], HI: [20.8, -156.3], ID: [44.4, -114.6], IL: [40, -89.2], IN: [39.9, -86.3], IA: [42, -93.5], KS: [38.5, -98.4],
    KY: [37.5, -85.3], LA: [31, -92], ME: [45.4, -69.2], MD: [39, -76.8], MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3], MS: [32.7, -89.7],
    MO: [38.4, -92.5], MT: [47, -109.6], NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.7, -71.6], NJ: [40.2, -74.7], NM: [34.4, -106.1], NY: [42.9, -75.5],
    NC: [35.6, -79.4], ND: [47.5, -100.5], OH: [40.3, -82.8], OK: [35.6, -97.5], OR: [43.9, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.5], SC: [33.9, -80.9],
    SD: [44.4, -100.2], TN: [35.9, -86.4], TX: [31.5, -99.3], UT: [39.3, -111.7], VT: [44, -72.7], VA: [37.5, -78.9], WA: [47.4, -120.5], WV: [38.6, -80.6],
    WI: [44.6, -89.9], WY: [43, -107.6], DC: [38.9, -77] };
  // where recruits come from (share of national top talent, roughly the 247 composite by state)
  DY.RECRUIT_STATES = [['TX', 15], ['FL', 13], ['GA', 11], ['CA', 8], ['AL', 4.5], ['LA', 4.5], ['OH', 4], ['NC', 3.5], ['TN', 3.5], ['VA', 3], ['MD', 2.5],
    ['SC', 2.5], ['MS', 2.5], ['PA', 2.5], ['NJ', 2], ['IL', 2], ['MI', 2], ['AZ', 2], ['MO', 1.5], ['KY', 1], ['OK', 1.5], ['IN', 1], ['WA', 1.2],
    ['AR', 1], ['NV', 0.8], ['UT', 0.8], ['CO', 0.8], ['MN', 0.6], ['WI', 0.6], ['NY', 0.8], ['MA', 0.5], ['OR', 0.5], ['KS', 0.4], ['IA', 0.4], ['NE', 0.3],
    ['DC', 0.6], ['HI', 0.5]];
  DY.TOWNS = {
    TX: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Katy', 'Allen', 'Duncanville', 'DeSoto', 'Southlake', 'Lake Travis', 'Cedar Hill', 'Humble', 'Beaumont', 'Tyler', 'Lubbock', 'Frisco', 'Arlington', 'Mansfield'],
    FL: ['Miami', 'Fort Lauderdale', 'Tampa', 'Jacksonville', 'Orlando', 'Bradenton', 'Tallahassee', 'Pensacola', 'Gainesville', 'Venice', 'Lakeland', 'Plantation', 'Homestead', 'Naples'],
    GA: ['Atlanta', 'Buford', 'Milton', 'Savannah', 'Macon', 'Columbus', 'Valdosta', 'Carrollton', 'Rome', 'Lilburn', 'Suwanee', 'Marietta', 'Douglasville', 'Thomasville'],
    CA: ['Los Angeles', 'Santa Ana', 'Mission Viejo', 'Bellflower', 'Sacramento', 'San Diego', 'Corona', 'Oakland', 'Fresno', 'Concord', 'Bakersfield', 'Folsom'],
    AL: ['Birmingham', 'Hoover', 'Mobile', 'Montgomery', 'Huntsville', 'Thompson', 'Auburn', 'Dothan', 'Tuscaloosa', 'Gadsden'],
    LA: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Monroe', 'Lake Charles', 'Destrehan', 'Ruston'],
    OH: ['Cincinnati', 'Columbus', 'Cleveland', 'Massillon', 'Toledo', 'Akron', 'Dayton', 'Canton', 'Pickerington'],
    NC: ['Charlotte', 'Raleigh', 'Durham', 'Greensboro', 'Fayetteville', 'Matthews', 'Wilmington', 'Concord'],
    TN: ['Knoxville', 'Nashville', 'Memphis', 'Chattanooga', 'Franklin', 'Murfreesboro', 'Maryville', 'Brentwood', 'Clarksville', 'Oak Ridge', 'Alcoa', 'Cleveland', 'Jackson', 'Johnson City'],
    VA: ['Richmond', 'Norfolk', 'Virginia Beach', 'Chesapeake', 'Alexandria', 'Lynchburg', 'Manassas'],
    MD: ['Baltimore', 'Olney', 'Upper Marlboro', 'Hyattsville', 'Montgomery Village', 'Frederick'],
    SC: ['Columbia', 'Greenville', 'Charleston', 'Rock Hill', 'Spartanburg', 'Gaffney', 'Florence'],
    MS: ['Jackson', 'Hattiesburg', 'Tupelo', 'Gulfport', 'Starkville', 'Oxford', 'Meridian'],
    PA: ['Philadelphia', 'Pittsburgh', 'Harrisburg', 'Allentown', 'Erie', 'Scranton'],
    NJ: ['Newark', 'Paterson', 'Bergen', 'Trenton', 'Camden', 'Montclair'],
    IL: ['Chicago', 'Naperville', 'Joliet', 'Peoria', 'Rockford', 'Wheaton'],
    MI: ['Detroit', 'Grand Rapids', 'Lansing', 'Ann Arbor', 'Southfield', 'Belleville'],
    AZ: ['Phoenix', 'Chandler', 'Scottsdale', 'Tucson', 'Mesa', 'Gilbert'],
    MO: ['St. Louis', 'Kansas City', 'Springfield', 'Columbia'], KY: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro'],
    OK: ['Tulsa', 'Oklahoma City', 'Norman', 'Lawton'], IN: ['Indianapolis', 'Fort Wayne', 'Carmel', 'Evansville'], WA: ['Seattle', 'Tacoma', 'Spokane', 'Kennewick'],
    AR: ['Little Rock', 'Fayetteville', 'Bentonville', 'Pine Bluff'], NV: ['Las Vegas', 'Henderson', 'Reno'], UT: ['Salt Lake City', 'Provo', 'Ogden'],
    CO: ['Denver', 'Colorado Springs', 'Aurora'], MN: ['Minneapolis', 'Eden Prairie', 'St. Paul'], WI: ['Milwaukee', 'Madison', 'Green Bay'],
    NY: ['Buffalo', 'Rochester', 'Bronx', 'Syracuse'], MA: ['Boston', 'Worcester', 'Springfield'], OR: ['Portland', 'Eugene', 'Salem'],
    KS: ['Wichita', 'Overland Park', 'Topeka'], IA: ['Des Moines', 'Cedar Rapids', 'Iowa City'], NE: ['Omaha', 'Lincoln'], DC: ['Washington'],
    HI: ['Honolulu', 'Kahuku', 'Hilo'],
  };

  // names: common first names on CFB rosters (with weight) + surnames. Combined at random; no real-person intent.
  DY.FIRST = ('Jaylen Jalen Jayden Jaden Caleb Elijah Isaiah Josiah Malik Marcus Devin Darius Tyler Brandon Cameron Christian Jordan Justin Michael Chris Anthony ' +
    'Xavier Zion Trey Tre Jamal Jamari Kendrick Kenny Keon Khalil Kaden Kaleb Kamari Ke\'Shawn DeShawn DeAndre Dante Damon Darnell Demetrius Desmond Dylan ' +
    'Ethan Evan Gavin Grant Graham Hunter Jackson Jake Jacob Jace Jaxon Jett Cole Colby Colton Cooper Carson Cade Brady Bryce Blake Bryson Braylon Brayden ' +
    'Cam Connor Drew Garrett Luke Logan Mason Nolan Parker Peyton Reid Ryan Sawyer Trent Tanner Wyatt Will Zach Zane Austin Aiden Owen Nick Noah Sam Ty ' +
    'Ahmad Amari Antonio Andre Armani Bishop Cedric Cortez Cornelius Dashawn Davion Dominic Donovan Emmanuel Eric Frank Gabe Isaac Jabari Jaheim Jahmir ' +
    'Jakobe Jamarion Javon Jaylon Jermaine Jeremiah Jerome Joel Jonah Jordan Josh Julian Kai Keenan Kelvin Kevin Kobe Lamar LaDarius Lance Larry Lavon ' +
    'Malachi Marquis Maurice Micah Miles Montrell Nate Nehemiah Omari Quincy Quinton Raheem Rashad Reggie Rico Roderick Ronnie Shamar Shemar Solomon ' +
    'Stephon Terrance Terrell Travon Trevor Tyrone Tyrique Vernon Victor Wesley Xzavier Zay Ja\'Marr Ky\'Ron Tae Quay Rueben Dorian Elias Silas Tucker ' +
    'Boone Brock Chase Clay Dawson Easton Fisher Hayes Holden Jensen Kyler Landon Maddox Pierce Rhett Ryder Spencer Talan Tate Walker Brooks Camden ' +
    'Davis Harrison Kingston Knox Legend Mekhi Nyjalik Princeton Saquan Taj Trayvon Ulysses Yamir Zaire Bo Deuce Duce Kam Cam\'ron Jamir Jahlil Kaidon ' +
    'Daylen Kadarius Keldric Marquez Tavion Trevell Vonte Ladainian Tremaine Sincere Messiah Zavier Isaac Aaron Adrian Alex Alonzo Arian Benny Carlos ' +
    'Diego Mateo Luis Manny Tevita Sione Siaosi Kalani Makoa Noa Penei Taulia Viliami Ikaika Kainoa').split(' ');
  DY.LAST = ('Johnson Williams Smith Jones Brown Davis Jackson Harris Robinson Thomas Walker Wright Green Thompson Moore White Lewis Allen Young King Scott ' +
    'Hill Mitchell Carter Turner Parker Collins Edwards Stewart Morris Rogers Cook Morgan Bell Murphy Bailey Cooper Richardson Cox Howard Ward Peterson ' +
    'Gray James Watson Brooks Kelly Sanders Price Bennett Wood Barnes Ross Henderson Coleman Jenkins Perry Powell Long Patterson Hughes Washington Butler ' +
    'Simmons Foster Bryant Alexander Russell Griffin Hayes Myers Ford Hamilton Graham Sullivan Wallace Woods Cole West Jordan Owens Reynolds Fisher Ellis ' +
    'Harrison Gibson McDonald Marshall Wells Tucker Porter Hunter Hicks Crawford Henry Boyd Mason Kennedy Warren Dixon Burns Gordon Shaw Holmes Rice ' +
    'Hunt Black Daniels Palmer Mills Grant Knight Ferguson Stone Hawkins Dunn Perkins Hudson Spencer Stephens Pierce Lawrence Riley Carroll Duncan ' +
    'Armstrong Freeman Wade Webb Chambers Jacobs Lane Fields Banks Neal Gaines Holloway McCoy Ware Merritt Whitfield Tolbert Pruitt Strickland Mayfield ' +
    'Battle Blount Golden Hairston Ivory Lockett Mabry Odom Pettway Sapp Stallworth Thornton Upshaw Vance Whitlow Abernathy Boykin Dorsey Fountain ' +
    'Grimes Huff Ingram Lattimore McKinney Nance Overton Pope Rountree Swain Toomer Varner Witherspoon Yates Beasley Copeland Dukes Easley Funchess ' +
    'Gamble Hollins Isom Jeter Kirkland Lyons McNeal Nwosu Okafor Oyelaran Adebayo Mbakwe Eze Onwuachi Thibodeaux Broussard Fontenot Guidry Landry ' +
    'Arceneaux Boudreaux Hebert Gutierrez Ramirez Morales Herrera Vasquez Castillo Mendoza Tuipulotu Fifita Tupou Mauga Faleolo Moala Kaufusi Alualu ' +
    'Anderson Baker Campbell Clark Evans Hall Lee Martin Nelson Phillips Roberts Taylor Wilson Adams Garrett Hampton Hightower Langford Malone Norwood ' +
    'Pittman Ruffin Sheppard Truitt Vinson Wilder Ballard Bolden Cannon Dawkins Dillard Fleming Gilliam Haynes Jefferson Kemp Love Manning McGee ' +
    'Pickens Rankin Spikes Stovall Tatum Underwood Waddle Whitaker Ainsworth Brewer Cavanaugh Driscoll Fitzgerald Gallagher Hoffman Kowalski ' +
    'Lindstrom Novak Olsen Petersen Quinlan Schmidt Schultz Swanson Vandenberg Walsh Zimmerman Brennan Callahan Donnelly Flanagan Mahoney ' +
    'O\'Neal Reilly Sheridan Kincaid Pace Rhodes Sweat Bridges Carswell Dowell Eubanks Ferrell Goodwin Hairston Jernigan Lockhart Pollard Story').split(' ');
  DY.SUFFIX = ['Jr.', 'Jr.', 'Jr.', 'II', 'II', 'III'];
  DY.HS_WORDS = ['Central', 'North', 'South', 'East', 'West', 'Heritage', 'Christian Academy', 'Prep', 'Catholic', 'County', 'Academy', 'Memorial', 'Lakeside',
    'Ridge', 'Valley', 'Mountain View', 'Oak Grove', 'Pine Forest', 'Riverside', 'Grace', 'St. Thomas', 'Bishop', 'Liberty', 'Independence', 'Hillcrest'];

  // playbook flavor: the call the coach makes -> real concepts
  DY.PLAYS = {
    in: ['Inside Zone', 'Duo', 'Power', 'Counter Trey', 'Trap', 'Iso', 'Dart'],
    out: ['Outside Zone', 'Toss Crack', 'Jet Sweep', 'Pin & Pull', 'Stretch', 'Buck Sweep'],
    qb: ['Zone Read Keep', 'QB Power', 'QB Draw', 'Speed Option', 'QB Counter', 'Bash Keep'],
    quick: ['Stick', 'Slant-Flat', 'Hitch', 'Bubble RPO', 'Snag', 'Quick Out', 'Spot'],
    med: ['Dagger', 'Mesh', 'Levels', 'Curl-Flat', 'Drive', 'Y-Cross', 'Smash'],
    deep: ['Four Verticals', 'Post-Wheel', 'Go/Fade', 'Mills', 'Yankee', 'Double Move', 'Seam Shot'],
    screen: ['RB Screen', 'WR Tunnel Screen', 'Bubble Screen', 'Slip Screen', 'Middle Screen'],
    pa: ['PA Boot', 'PA Post', 'PA Yankee', 'RPO Glance', 'PA Crossers'],
  };
  DY.DEFS = {
    c0: { name: 'Cover 0 Blitz', box: 2, rush: 2.2, deep: -3, short: -0.5, man: 1, blitz: 1 },
    c1: { name: 'Cover 1 Robber', box: 1, rush: 0.6, deep: 0, short: 0.6, man: 1, blitz: 0 },
    c1f: { name: 'Cover 1 Fire Zone', box: 1.4, rush: 1.4, deep: -1, short: 0, man: 1, blitz: 1 },
    c2: { name: 'Cover 2', box: -0.6, rush: 0, deep: 1.2, short: 0.9, man: 0, blitz: 0 },
    t2: { name: 'Tampa 2', box: -0.4, rush: 0, deep: 1.4, short: 0.4, man: 0, blitz: 0 },
    c3: { name: 'Cover 3 Sky', box: 0.6, rush: 0, deep: 0.8, short: 0, man: 0, blitz: 0 },
    c3b: { name: 'Cover 3 Buzz', box: 0.8, rush: 0.3, deep: 0.5, short: 0.4, man: 0, blitz: 0 },
    c4: { name: 'Cover 4 Quarters', box: 0.2, rush: 0, deep: 1.6, short: -0.2, man: 0, blitz: 0 },
    c6: { name: 'Cover 6', box: 0, rush: 0, deep: 1.1, short: 0.4, man: 0, blitz: 0 },
    bear: { name: 'Bear Front Run Blitz', box: 2.6, rush: 1.0, deep: -1.5, short: -0.8, man: 1, blitz: 1 },
    prev: { name: 'Prevent', box: -2, rush: -0.8, deep: 2.6, short: -1.2, man: 0, blitz: 0 },
    c2m: { name: 'Cover 2 Man', box: -0.2, rush: 0, deep: 1.3, short: 0.9, man: 1, blitz: 0 },
    ncb: { name: 'Nickel Corner Blitz', box: 1.0, rush: 1.3, deep: -0.6, short: 0.1, man: 1, blitz: 1 },
    sfb: { name: 'Safety Blitz (Cover 1)', box: 1.4, rush: 1.2, deep: -0.4, short: 0.3, man: 1, blitz: 1 },
    zb: { name: 'Zone Blitz (Fire 3)', box: 1.1, rush: 1.5, deep: 0.3, short: -0.3, man: 0, blitz: 1 },
    dman: { name: 'Deep Man (2-Man Prevent)', box: -1.4, rush: -0.4, deep: 2.0, short: 0.4, man: 1, blitz: 0 },
    gl: { name: 'Goal Line Man', box: 2.4, rush: 1.0, deep: -1.0, short: 0.2, man: 1, blitz: 1 },
  };
  // the defensive call sheet: five calls, each with real packages underneath (auto picks the right one for the down and distance)
  DY.DPKG = {
    run: { label: 'Stop the run', sub: 'Load the box', items: [
      { k: 'box8', name: 'Load the box (Cover 1)', d: 'c1', pkg: 'base', note: 'Eight in the box, safety down' },
      { k: 'bear', name: 'Bear front run blitz', d: 'bear', pkg: 'base', note: 'Linebackers shoot gaps' },
      { k: 'buzz', name: 'Cover 3 Buzz', d: 'c3b', pkg: 'base', note: 'Safety rolls down into the run fit' },
      { k: 'goal', name: 'Goal line (6-2)', d: 'gl', pkg: 'goal', note: 'Bigger bodies up front' } ] },
    man: { label: 'Man coverage', sub: 'Cover 0 / 1 / 2-Man', items: [
      { k: 'c1', name: 'Cover 1 Robber', d: 'c1', note: 'Press man, a robber in the middle' },
      { k: 'c2m', name: 'Cover 2 Man', d: 'c2m', note: 'Man underneath, two deep' },
      { k: 'c0', name: 'Cover 0', d: 'c0', note: 'Everyone in man, no deep help' } ] },
    zone: { label: 'Zone coverage', sub: 'Cover 2 / 3 / 4', items: [
      { k: 'c3', name: 'Cover 3 Sky', d: 'c3', note: 'Three deep, four under' },
      { k: 'c4', name: 'Cover 4 Quarters', d: 'c4', note: 'Four deep: take away the deep ball' },
      { k: 'c2', name: 'Cover 2', d: 'c2', note: 'Corners squat the flats' },
      { k: 't2', name: 'Tampa 2', d: 't2', note: 'Mike runs the middle' },
      { k: 'c6', name: 'Cover 6', d: 'c6', note: 'Quarter-quarter-half' } ] },
    blitz: { label: 'Blitz', sub: 'Man and zone pressure', items: [
      { k: 'zb', name: 'Zone blitz (Fire 3)', d: 'zb', note: 'Five rush, a lineman drops' },
      { k: 'c1f', name: 'Fire zone (LB)', d: 'c1f', note: 'Linebacker blitz, three deep' },
      { k: 'ncb', name: 'Nickel corner blitz', d: 'ncb', note: 'Pressure off the slot' },
      { k: 'sfb', name: 'Safety blitz', d: 'sfb', note: 'Man behind it' },
      { k: 'c0', name: 'Cover 0 all-out', d: 'c0', note: 'Six rush, man everywhere' } ] },
    prev: { label: 'Prevent', sub: 'Keep it in front', items: [
      { k: 'prev', name: 'Prevent (deep zone)', d: 'prev', pkg: 'dime', note: 'Three rush, everybody deep' },
      { k: 'dman', name: 'Deep man (2-Man)', d: 'dman', pkg: 'dime', note: 'Man under, two very deep' } ] },
  };
  // simplified defensive calls the coach can make (each maps to a few real coverages)
  DY.DCALLS = {
    run: { label: 'Stop the run', sub: 'Load the box', keys: ['bear', 'c3b', 'c1'] },
    man: { label: 'Man coverage', sub: 'Cover 1 / 2-Man', keys: ['c1', 'c2m', 'c1'] },
    zone: { label: 'Zone coverage', sub: 'Cover 2 / 3 / 4', keys: ['c3', 'c4', 'c2', 't2', 'c6'] },
    bal: { label: 'Balanced', sub: 'Cover 3 / Quarters', keys: ['c3', 'c4', 'c6', 'c3b'] },
    blitz: { label: 'Blitz', sub: 'Send pressure', keys: ['zb', 'c1f', 'ncb', 'sfb', 'c0'] },
    pass: { label: 'Coverage', sub: 'Cover 2 / Tampa', keys: ['c2', 't2', 'c4'] },
    prev: { label: 'Prevent', sub: 'Keep it in front', keys: ['prev', 'dman'] },
  };
  // non-playoff bowls, most prestigious first: the best teams left after Selection Day get the biggest games
  DY.BOWLS = ['Citrus Bowl', 'ReliaQuest Bowl', 'Alamo Bowl', 'Gator Bowl', 'Holiday Bowl', 'Pop-Tarts Bowl', 'Texas Bowl', 'Music City Bowl', 'Sun Bowl',
    'Liberty Bowl', 'Las Vegas Bowl', "Duke's Mayo Bowl", 'Pinstripe Bowl', 'Fenway Bowl', 'Military Bowl', 'Gasparilla Bowl', 'Birmingham Bowl', 'Independence Bowl',
    'Guaranteed Rate Bowl', 'Armed Forces Bowl', 'First Responder Bowl', 'LA Bowl', 'Hawai\'i Bowl', 'Boca Raton Bowl', 'New Mexico Bowl', 'Camellia Bowl',
    'Cure Bowl', 'Frisco Bowl', 'Myrtle Beach Bowl', 'Arizona Bowl', 'Bahamas Bowl', 'Famous Idaho Potato Bowl', 'New Orleans Bowl', 'Salute to Veterans Bowl'];
  DY.NY6 = ['Rose Bowl', 'Sugar Bowl', 'Orange Bowl', 'Cotton Bowl', 'Fiesta Bowl', 'Peach Bowl'];
  // team identity (offensive style) by school; others are drawn at random
  DY.STYLE_OF = { Tennessee: 'power', 'Georgia Tech': 'option', 'Kennesaw State': 'option', 'Arizona State': 'tempo', 'Mississippi State': 'tempo', 'Texas Tech': 'air', Army: 'option', Navy: 'option', 'Air Force': 'option', Iowa: 'power', Wisconsin: 'power',
    Georgia: 'pro', Alabama: 'pro', Michigan: 'power', 'Ohio State': 'spread', Oregon: 'tempo', 'Ole Miss': 'tempo', LSU: 'pro', Texas: 'spread',
    'Washington State': 'air', 'Mississippi State': 'air', SMU: 'tempo', 'Kansas State': 'power', Indiana: 'spread' };
  // offensive identities: pass rate, seconds between snaps, and how often each formation is used
  DY.STYLES = {
    power: { name: 'Run heavy', desc: 'Under center and pistol, two tight ends, a standard-to-slow pace. Run first and play action off it.', pass: 0.42, tempo: 34, rpo: 0.06, forms: { ace12: 0.32, pistol: 0.2, trips: 0.18, iform: 0.16, doubles: 0.1, goal: 0.04 } },
    pro: { name: 'Pro style', desc: 'Balanced and multiple: under center, I-form and 12 personnel, play action, a deliberate pace.', pass: 0.48, tempo: 34, rpo: 0.06, forms: { ace12: 0.28, iform: 0.24, doubles: 0.18, trips: 0.15, pistol: 0.1, spread: 0.05 } },
    spread: { name: 'Spread offense', desc: 'Shotgun and three or four wide, RPOs, quick game and the QB run.', pass: 0.5, tempo: 31, rpo: 0.2, forms: { trips: 0.36, doubles: 0.3, pistol: 0.14, spread: 0.14, ace12: 0.06 } },
    tempo: { name: 'Up-tempo', desc: 'No-huddle spread: snap it fast, stress the defense sideline to sideline.', pass: 0.53, tempo: 24, rpo: 0.2, forms: { trips: 0.4, doubles: 0.24, spread: 0.2, empty: 0.06, pistol: 0.1 } },
    option: { name: 'Triple option', desc: 'Flexbone triple option: dive, keep or pitch, then the play-action shot.', pass: 0.14, tempo: 36, rpo: 0, forms: { flexbone: 0.62, pistol: 0.18, iform: 0.12, ace12: 0.08 } },
    air: { name: 'Air Raid', desc: 'Four wide, throw it all over the field.', pass: 0.6, tempo: 29, rpo: 0.08, forms: { spread: 0.4, trips: 0.28, empty: 0.15, doubles: 0.17 }, cpu: true },
  };
  DY.USER_STYLES = ['pro', 'spread', 'tempo', 'option', 'power'];
  // formations: personnel (RB-TE), receivers on the field, and what they do for the run game, protection and the passing game
  DY.FORMS = {
    trips: { name: 'Shotgun Trips', pers: '11', rb: 1, te: 1, wr: 3, run: 0, pro: 0, sep: 0.12, dpers: 'nickel' },
    doubles: { name: 'Shotgun Doubles', pers: '11', rb: 1, te: 1, wr: 3, run: 0.1, pro: 0.1, sep: 0.06, dpers: 'nickel' },
    pistol: { name: 'Pistol', pers: '11', rb: 1, te: 1, wr: 3, run: 0.35, pro: 0.15, sep: 0, dpers: 'nickel' },
    ace12: { name: 'Singleback Ace (12)', pers: '12', rb: 1, te: 2, wr: 2, run: 0.7, pro: 0.45, sep: -0.08, pa: 0.35, dpers: 'base' },
    iform: { name: 'I-Form (21)', pers: '21', rb: 2, te: 1, wr: 2, run: 0.9, pro: 0.55, sep: -0.12, pa: 0.45, dpers: 'base' },
    spread: { name: 'Shotgun Spread (10)', pers: '10', rb: 1, te: 0, wr: 4, run: -0.45, pro: -0.3, sep: 0.2, dpers: 'dime' },
    empty: { name: 'Empty', pers: '01', rb: 0, te: 1, wr: 4, run: -1.6, pro: -0.8, sep: 0.28, dpers: 'dime' },
    goal: { name: 'Goal Line (13)', pers: '13', rb: 1, te: 3, wr: 1, run: 1.3, pro: 0.8, sep: -0.35, pa: 0.5, dpers: 'goal' },
    flexbone: { name: 'Flexbone (30)', pers: '30', rb: 3, te: 0, wr: 2, run: 0.8, pro: 0.2, sep: 0.05, pa: 0.6, dpers: 'base' },
  };
  DY.DPERS = { base: { name: 'Base 4-3', box: 0.45, cov: -0.12 }, nickel: { name: 'Nickel', box: 0, cov: 0 }, dime: { name: 'Dime', box: -0.5, cov: 0.18 }, goal: { name: 'Goal line 6-2', box: 1.1, cov: -0.3 } };
  // the playbook: each named play beats some coverages/fronts and struggles against others
  DY.BOOK = {
    in: [{ n: 'Inside Zone', beats: [], weak: [] }, { n: 'Duo', beats: ['c2', 't2', 'c4', 'c6'], weak: ['bear', 'gl'] }, { n: 'Power', beats: ['c2', 't2', 'prev', 'c4', 'dman'], weak: ['bear', 'c0'] }, { n: 'Counter', beats: ['c1', 'c3b', 'sfb'], weak: ['c2'], counter: 1 }, { n: 'Trap', beats: ['c0', 'c1f', 'zb', 'ncb'], weak: ['c3'] }, { n: 'Iso', beats: ['c2', 'c4', 'c6'], weak: ['bear', 'gl'] }, { n: 'Dart', beats: ['c3', 'c1'], weak: ['zb'] }],
    out: [{ n: 'Outside Zone', beats: ['c2', 'c6'], weak: ['c3b'] }, { n: 'Toss Crack', beats: ['c3', 'c4', 'gl'], weak: ['bear', 'c1'] }, { n: 'Jet Sweep', beats: ['bear', 'c1f', 'c0', 'gl', 'ncb'], weak: ['c2', 't2'] }, { n: 'Pin & Pull', beats: ['c3b', 'c4'], weak: ['c0'] }, { n: 'Stretch', beats: ['c2', 'c2m', 't2'], weak: ['zb'] }, { n: 'Buck Sweep', beats: ['c4', 'c6', 'dman'], weak: ['bear'] }, { n: 'Rocket Toss', beats: ['c4', 'c6', 'c2'], weak: ['bear', 'c1'] }],
    qb: [{ n: 'Zone Read Keep', beats: ['c1', 'c3b', 'c2m'], weak: ['c0'] }, { n: 'QB Power', beats: ['c2', 't2', 'c4'], weak: ['bear'] }, { n: 'QB Draw', beats: ['c2', 't2', 'c4', 'prev', 'c6', 'dman', 'c2m'], weak: ['c1f', 'bear', 'zb'] }, { n: 'Speed Option', beats: ['c0', 'c1f', 'c1', 'ncb', 'sfb'], weak: ['c4', 'c6'] }, { n: 'Triple Option', beats: ['c1', 'c3', 'c2m'], weak: ['c4', 'zb'] }, { n: 'Midline Option', beats: ['bear', 'gl', 'c3b'], weak: ['c2'] }, { n: 'QB Counter', beats: ['c1', 'c3b'], weak: ['c2'], counter: 1 }],
    rpo: [{ n: 'Bubble Read', beats: ['bear', 'c3b', 'c1', 'gl'], weak: ['c2', 'c6'], run: 'Inside Zone' }, { n: 'RPO Glance', beats: ['c3b', 'c1', 'bear', 'c3'], weak: ['c4', 't2'], run: 'Inside Zone' }, { n: 'Slant RPO', beats: ['c3', 'c1', 'bear', 'c0'], weak: ['c2', 'c2m'], run: 'Duo' }, { n: 'Stick RPO', beats: ['c3', 'c4', 'c6', 'buzz'], weak: ['c1', 'c0'], run: 'Inside Zone' }],
    quick: [{ n: 'Stick', beats: ['c3', 'c4', 'c6'], weak: ['c1', 'c2'] }, { n: 'Slant-Flat', beats: ['c2', 'c0', 'c1f', 't2', 'ncb'], weak: ['c3b'] }, { n: 'Hitch', beats: ['c3', 'c4', 'prev', 'dman'], weak: ['c0', 'c1'] }, { n: 'Quick Out', beats: ['c3', 'c4', 'prev', 'dman'], weak: ['c2', 'c2m'] }, { n: 'Snag', beats: ['c3', 'c3b', 'c2'], weak: ['c1'] }],
    med: [{ n: 'Mesh', beats: ['c1', 'c0', 'c1f'], weak: ['c2', 't2', 'c4'] }, { n: 'Dagger', beats: ['c3', 'c4', 'c6'], weak: ['c1', 'c0'] }, { n: 'Smash', beats: ['c2', 't2', 'c6'], weak: ['c3b', 'c1'] }, { n: 'Curl-Flat', beats: ['c3', 'c3b'], weak: ['c2', 'c1'] }, { n: 'Y-Cross', beats: ['c3', 'c1', 'c4'], weak: ['t2'] }],
    deep: [{ n: 'Four Verticals', beats: ['c3', 'c1', 'c3b', 'c1f'], weak: ['c4', 'c2', 'prev'] }, { n: 'Post-Wheel', beats: ['c3', 'c6', 'c1f'], weak: ['c2', 'prev'] }, { n: 'Go/Fade', beats: ['c0', 'c1', 'c1f', 'bear'], weak: ['c4', 'c2', 'prev'] }, { n: 'Mills', beats: ['c4', 'c6', 'c2'], weak: ['c0', 'c1f'] }, { n: 'Double Move', beats: ['c1', 'c3b', 'c0'], weak: ['c4', 'prev'] }],
    screen: [{ n: 'RB Screen', beats: ['c0', 'c1f', 'bear'], weak: ['c2', 'c4'] }, { n: 'WR Tunnel Screen', beats: ['c3', 'c4', 'prev', 'c1f'], weak: ['c2', 't2'] }, { n: 'Bubble Screen', beats: ['bear', 'c3b', 'c0'], weak: ['c2', 'c6'] }],
    pa: [{ n: 'PA Boot', beats: ['bear', 'c3b', 'c1f'], weak: ['c2', 'prev'] }, { n: 'PA Post', beats: ['c3b', 'c1', 'bear', 'c3'], weak: ['c4', 'c2'] }, { n: 'RPO Glance', beats: ['c3b', 'c1', 'bear'], weak: ['c4', 't2'] }, { n: 'PA Crossers', beats: ['c1', 'c0', 'c3b'], weak: ['t2', 'c6'] }],
  };
  // pre-game plans and halftime adjustments
  DY.PLANS = {
    bal: { name: 'Balanced', desc: 'Take what they give you.', mod: {} },
    run: { name: 'Establish the run', desc: '+run blocking, run more, play action hits harder.', mod: { run: 1.2, pass: -0.12, pa: 0.2 } },
    air: { name: 'Air it out', desc: '+separation, throw more; protection a little thinner.', mod: { sep: 0.15, pro: -0.6, pass: 0.12 } },
    pressure: { name: 'Bring pressure', desc: '+pass rush on defense; more exposed deep.', mod: { rush: 0.5, deep: -0.3 } },
    bend: { name: 'Bend, don\'t break', desc: 'Keep everything in front; softer against the run.', mod: { deep: 0.4, short: 0.15, box: -0.25 } },
  };
  DY.ADJ_O = { none: { name: 'No change', mod: {} }, run: { name: 'Lean on the run game', mod: { run: 1.0, pass: -0.1 } }, protect: { name: 'Max protect', mod: { pro: 1.3, sep: -0.06 } }, quick: { name: 'Quick game', mod: { sepS: 0.25, pass: 0.05 } }, shots: { name: 'Take shots', mod: { sepD: 0.25, pro: -0.3 } } };
  DY.ADJ_D = { none: { name: 'No change', mod: {} }, box: { name: 'Stop the run', mod: { box: 0.45, deep: -0.15 } }, deep: { name: 'Take away the deep ball', mod: { deep: 0.45, box: -0.2 } }, pressure: { name: 'Bring more pressure', mod: { rush: 0.55, short: -0.15 } }, contain: { name: 'Contain the QB', mod: { qbrun: -0.8, rush: -0.2 } } };
  DY.TROPHIES = { 'Mississippi State|Ole Miss': 'Golden Egg', 'Arkansas|LSU': 'Golden Boot', 'Arkansas|Missouri': 'Battle Line Trophy', 'Kentucky|Louisville': "Governor's Cup",
    'Georgia|Georgia Tech': "Governor's Cup", 'Clemson|South Carolina': 'Palmetto Trophy', 'Oklahoma|Texas': 'Golden Hat', 'Oregon|Oregon State': 'Platypus Trophy',
    'Minnesota|Wisconsin': "Paul Bunyan's Axe", 'Iowa|Nebraska': 'Heroes Trophy', 'Indiana|Purdue': 'Old Oaken Bucket', 'Arizona|Arizona State': 'Territorial Cup',
    'Cal|Stanford': 'The Axe', 'UCLA|USC': 'Victory Bell', 'Washington|Washington State': 'Apple Cup', 'Virginia|Virginia Tech': 'Commonwealth Cup',
    'Illinois|Northwestern': 'Land of Lincoln Trophy', 'Kansas|Kansas State': 'Sunflower Showdown', 'Florida|Florida State': 'Sunshine Showdown' };
  DY.UT_RIVALS = ['Alabama', 'Kentucky', 'Vanderbilt', 'Florida', 'Georgia', 'LSU', 'South Carolina', 'Auburn', 'Texas'];

})(typeof window !== 'undefined' ? window : globalThis);
