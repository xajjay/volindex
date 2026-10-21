"""Opponents for the undefeated-run games (40-0 basketball, 69-0 baseball and softball).

Every opponent is a real team-season Tennessee played, taken from the schedule history files
(data/<sport>-history-auto.js, written by tools/update_sports.py from utsports.com). Each team-season gets a
strength rating on the same scale as a Vols starting group (about 60-95):
  ranked when Tennessee played them   93 for No. 1, down 0.45 a spot (No. 25 is about 82)
  unranked power-conference team      77     (SEC, ACC, Big Ten, Big 12, Big East, Pac-12)
  unranked strong mid-major           72     (Gonzaga, Memphis, VCU ...)
  any other Division I team           66
  non-Division I and exhibitions      left out
then nudged by how they did against Tennessee (+2 for a win, +1 more by 10+ / 5+ runs, -2 for a blowout loss).
Writes data/run-opps.js (window.VI_RUN_OPPS[sport] = [[team, season, rating, rank, sec, games...], ...])."""
import json, os, re, collections

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SEC = {'Alabama', 'Arkansas', 'Auburn', 'Florida', 'Georgia', 'Kentucky', 'LSU', 'Ole Miss', 'Mississippi State', 'Missouri',
       'Oklahoma', 'South Carolina', 'Texas', 'Texas A&M', 'Vanderbilt'}
ALIAS = {'Mississippi': 'Ole Miss', 'Louisiana State': 'LSU', 'Miss. State': 'Mississippi State', 'Mississippi St.': 'Mississippi State',
         'Connecticut': 'UConn', 'Miami (Fla.)': 'Miami', 'Miami (FL)': 'Miami', 'Miami (Ohio)': 'Miami (OH)', 'Middle Tennessee State': 'Middle Tennessee', 'MTSU': 'Middle Tennessee',
         'East Tennessee State': 'ETSU', 'NC State': 'NC State', 'North Carolina State': 'NC State', 'Southern California': 'USC', 'Pittsburgh': 'Pitt',
         'Texas A&M University': 'Texas A&M', 'Southern Miss': 'Southern Miss', 'Southern Mississippi': 'Southern Miss', 'UNC': 'North Carolina',
         'St. John\'s (NY)': "St. John's", 'Saint Joseph\'s': "Saint Joseph's"}
POWER = SEC | {
    # ACC
    'Boston College', 'California', 'Clemson', 'Duke', 'Florida State', 'Georgia Tech', 'Louisville', 'Miami', 'North Carolina', 'NC State',
    'Notre Dame', 'Pitt', 'SMU', 'Stanford', 'Syracuse', 'Virginia', 'Virginia Tech', 'Wake Forest', 'Maryland',
    # Big Ten
    'Illinois', 'Indiana', 'Iowa', 'Michigan', 'Michigan State', 'Minnesota', 'Nebraska', 'Northwestern', 'Ohio State', 'Oregon',
    'Penn State', 'Purdue', 'Rutgers', 'UCLA', 'USC', 'Washington', 'Wisconsin',
    # Big 12
    'Arizona', 'Arizona State', 'Baylor', 'BYU', 'Cincinnati', 'Colorado', 'Houston', 'Iowa State', 'Kansas', 'Kansas State',
    'Oklahoma State', 'TCU', 'Texas Tech', 'UCF', 'Utah', 'West Virginia',
    # Big East
    'Butler', 'Creighton', 'DePaul', 'Georgetown', 'Marquette', 'Providence', "St. John's", 'Seton Hall', 'UConn', 'Villanova', 'Xavier',
    # Pac-12 (historic)
    'Oregon State', 'Washington State'}
MID = {'Gonzaga', 'Memphis', 'VCU', 'Dayton', 'Saint Mary\'s', 'San Diego State', 'Wichita State', 'Davidson', 'Belmont', 'Murray State',
       'Saint Louis', 'Temple', 'UNLV', 'New Mexico', 'Nevada', 'Utah State', 'Boise State', 'Old Dominion', 'George Washington', 'Richmond',
       'Louisiana Tech', 'Middle Tennessee', 'Western Kentucky', 'Rice', 'Tulane', 'Charlotte', 'Chattanooga', 'Liberty', 'Florida Atlantic',
       'Long Beach State', 'Cal State Fullerton', 'UC Irvine', 'Coastal Carolina', 'East Carolina', 'Southern Miss', 'Dallas Baptist', 'James Madison',
       'Princeton', 'Harvard', 'Drake', 'Northern Iowa', 'Bradley', 'Missouri State', 'South Florida', 'Wofford', 'Furman', 'College of Charleston', 'UAB'}
# Division II / NAIA / club and exhibition opponents seen in the files (not real games for a sim)
NON_D1 = re.compile(r'EA SPORTS|Exhibition|EXHIBITION|Exh\.|Smokies|National Team|Carson-Newman|Tusculum|Lenoir-Rhyne|Columbus State|Georgia College|Coker|'
                    r'California \(PA\)|Florida Southern|Southern Indiana|Maryville|Union|Lincoln Memorial|Johnson|Bryan|King\b|Milligan|Cumberland|'
                    r'Tennessee Wesleyan|Brevard|Shorter|Montevallo|Alabama-Huntsville|West Georgia|Clayton State|Barry|Rollins|Indianapolis|Washburn|Pfeiffer')

RANK = re.compile(r'^(?:No\.\s*|#)?(#?(?:\d+|RV|NR|--))\s*/\s*(#?(?:\d+|RV|NR|--))\s+|^(?:No\.\s*|#)(\d+)\s+|^RV\s+')
def clean(name):
    """'#5/#3 Villanova', '3/3 LSU', 'NR/25 Vanderbilt', 'No.1/1 Florida', '#12 LSU (DH)' -> (team, best rank or None)"""
    rank = None
    m = RANK.match(name)
    if m:
        nums = [int(x.lstrip('#')) for x in (m.group(1), m.group(2), m.group(3)) if x and x.lstrip('#').isdigit()]
        rank = min(nums) if nums else None
        name = name[m.end():]
    name = re.sub(r'^\[\d+\]\s*', '', name)
    name = re.sub(r'\s*-\s*Conclusion of game.*$', '', name)
    name = re.sub(r'\s*\((DH|H|\d+-seed|Exhibition|EXHIBITION)\)\s*$', '', name).strip()
    name = re.sub(r'^(at|vs\.?)\s+', '', name)
    return ALIAS.get(name, name), rank

def build(sport):
    path = os.path.join(ROOT, 'data', f'{sport}-history-auto.js')
    t = open(path, encoding='utf-8').read()
    H = json.JSONDecoder().raw_decode(t[t.index('= ', t.index(sport + 'History')) + 2:])[0]
    hoops = sport in ('mbb', 'wbb')
    ts = collections.OrderedDict()
    for season, games in H.items():
        for g in games:
            raw = g[1]
            if NON_D1.search(raw) or g[3] not in ('W', 'L', 'T'): continue
            team, rank = clean(raw)
            if not team or team == 'Tennessee': continue
            try: us, them = int(g[4]), int(g[5])
            except (TypeError, ValueError): continue
            month = int(g[0][5:7])
            # regular season only: basketball Nov-early Mar, baseball and softball Feb-mid May (postseason opponents are drawn separately)
            post = (hoops and (month in (3, 4) and not g[6] and g[0][5:] >= '03-08')) or (not hoops and (g[0][5:] >= '05-14'))
            key = (team, season)
            x = ts.setdefault(key, dict(team=team, season=season, rank=None, games=[], sec=team in SEC, conf=False, post=False))
            if rank: x['rank'] = min(rank, x['rank'] or 99)
            x['conf'] = x['conf'] or bool(g[6])
            x['post'] = x['post'] or post
            x['games'].append((g[2], us - them, post))
    out = []
    big = 10 if hoops else 5
    for x in ts.values():
        if x['rank']: r = 93 - 0.45 * (x['rank'] - 1)
        elif x['team'] in POWER: r = 77
        elif x['team'] in MID: r = 72
        else: r = 66
        margins = [m for _, m, _ in x['games']]
        lost = [m for m in margins if m < 0]
        if lost: r += 2 + (1 if min(lost) <= -big else 0)
        elif margins and min(margins) >= big * 2.5: r -= 2
        reg = [g for g in x['games'] if not g[2]]
        site = (reg or x['games'])[0][0]
        out.append([x['team'], x['season'], round(r, 1), x['rank'] or 0, 1 if x['sec'] else 0, site, 1 if reg else 0])
    return out

def main():
    data = {k: build(k) for k in ('mbb', 'wbb', 'baseball', 'softball')}
    js = ('/* Written by tools/build_run_opps.py from the schedule history files. Rerun instead of editing.\n'
          '   [team, season, rating, rank when played (0 = unranked), SEC (1/0), site of the meeting (H/A/N), met in the regular season (1/0)] */\n'
          'window.VI_RUN_OPPS = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n')
    open(os.path.join(ROOT, 'data', 'run-opps.js'), 'w', encoding='utf-8').write(js)
    for k, v in data.items():
        rs = sorted(x[2] for x in v)
        print(k, len(v), 'team-seasons', 'SEC', sum(x[4] for x in v), 'ranked', sum(1 for x in v if x[3]), 'rating min/med/max', rs[0], rs[len(rs) // 2], rs[-1])

if __name__ == '__main__':
    main()
