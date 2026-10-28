"""Build the football historical-mode data (data/hist/*.js).

Sources (downloaded once into a scratch folder, not kept in the repo):
  - NCAA Football 14 community roster files (PS3 saves) for 2006-2023, decrypted with hist/ps3dec.py and read
    with hist/tdb.py: every FBS team's real roster with game ratings.
  - cfbfastR-data (github.com/sportsdataverse/cfbfastR-data): rosters 2004-2026 and schedules/results 2001-2026.
  - nflverse draft picks (github.com/nflverse/nflverse-data): every drafted player since 1980 with his college and
    career value, used to re-rank recruiting classes by what players actually became.

Usage: python3 tools/build_hist_fb.py <scratch>/hdata <scratch>/hist
"""
import csv, json, math, os, re, sys, collections, statistics, zlib
HD, HIST = sys.argv[1], sys.argv[2]
sys.path.insert(0, HIST)
import tdb  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'hist')
os.makedirs(OUT, exist_ok=True)

# ---------- the dynasty's team list ----------
src = open(os.path.join(ROOT, 'assets/dynasty/dy-data.js')).read()
TL = [l.split('|') for l in re.search(r"const T = `(.*?)`", src, re.S).group(1).strip().split('\n')]
FL = [l.split('|') for l in re.search(r"const F = `(.*?)`", src, re.S).group(1).strip().split('\n')]
DYT = {l[0]: l for l in TL}
DYF = {l[0]: l for l in FL}
PRESTIGE_NOW = sorted((int(l[3]) for l in TL), reverse=True)
ALIAS = {'California': 'Cal', 'ECU': 'East Carolina', 'East Carolina ': 'East Carolina', 'Miami University': 'Miami (OH)',
         'Mid Tenn State': 'Middle Tennessee', 'UL Monroe': 'ULM', 'Louisiana Monroe': 'ULM', 'Pittsburgh': 'Pitt',
         'San Jose State': 'San José State', 'UL Lafayette': 'Louisiana', 'Louisiana-Lafayette': 'Louisiana', 'Connecticut': 'UConn',
         'USF': 'South Florida', 'Florida Atlantic': 'FAU', 'Florida International': 'FIU', 'Florida International ': 'FIU',
         'Army West Point': 'Army', 'Appalachian State': 'App State', 'Massachusetts': 'UMass', 'Southern Mississippi': 'Southern Miss',
         'UT San Antonio': 'UTSA', 'Hawaii': "Hawai'i", 'Miami (FL)': 'Miami', 'Miami (Ohio)': 'Miami (OH)', 'Louisiana State': 'LSU',
         'Mississippi': 'Ole Miss', 'Southern California': 'USC', 'Central Florida': 'UCF', 'Brigham Young': 'BYU', 'Texas Christian': 'TCU',
         'Southern Methodist': 'SMU', 'Alabama-Birmingham': 'UAB', 'Nevada-Las Vegas': 'UNLV', 'Texas-El Paso': 'UTEP', 'Texas-San Antonio': 'UTSA',
         'North Carolina State': 'NC State', 'Boston Col.': 'Boston College', 'Middle Tennessee State': 'Middle Tennessee', 'Western Kentucky ': 'Western Kentucky',
         'Sam Houston State': 'Sam Houston', 'Jacksonville St.': 'Jacksonville State', 'Pitt': 'Pitt', 'Ohio State': 'Ohio State', 'Bowling Green State': 'Bowling Green'}
def dyname(n):
    n = n.strip(); n = ALIAS.get(n, n)
    if n not in DYT and n not in DYF and n.endswith(' St.'): n = n[:-4] + ' State'
    n = ALIAS.get(n, n)
    return n if n in DYT or n in DYF else None

CONF = {'SEC': 'SEC', 'Big Ten': 'B1G', 'Big 12': 'B12', 'ACC': 'ACC', 'Pac-10': 'P12', 'Pac-12': 'P12', 'Mountain West': 'MWC',
        'American Athletic': 'AAC', 'Big East': 'BE', 'Sun Belt': 'SBC', 'Mid-American': 'MAC', 'Conference USA': 'CUSA',
        'Western Athletic': 'WAC', 'FBS Independents': 'IND'}

# ---------- schedules and results 2001-2026 ----------
def season_games(y):
    f = os.path.join(HD, 'cfr/schedules/csv/cfb_schedules_%d.csv' % y)
    if not os.path.exists(f): return None
    return list(csv.DictReader(open(f)))
SCHED, CONFS, SRS = {}, {}, {}
for y in range(2001, 2027):
    rows = season_games(y)
    if not rows: continue
    conf, games = {}, []
    for r in rows:
        for s in ('home', 'away'):
            if r[s + '_division'] == 'fbs':
                n = dyname(r[s + '_team'])
                if n and n in DYT: conf[n] = CONF.get(r[s + '_conference'], 'IND')
    res = []
    for r in rows:
        if r['season_type'] != 'regular': continue
        if re.search(r'Championship', r.get('notes') or '', re.I) and r['conference_game'] == 'TRUE' and int(r['week']) >= 13: continue
        # conference title games (some have no notes): a conference game in December
        if r['conference_game'] == 'TRUE' and r['start_date'][5:7] == '12' and r['home_conference'] == r['away_conference'] and int(r['start_date'][8:10]) <= 9 and r['home_team'] not in ('Army', 'Navy'): continue
        h, a = r['home_team'], r['away_team']
        hn, an = dyname(h), dyname(a)
        hf, af = r['home_division'] == 'fbs', r['away_division'] == 'fbs'
        if not (hf and hn in conf) and not (af and an in conf): continue
        H = hn if (hf and hn in conf) else 'F:' + (hn if hn in DYF else h)
        A = an if (af and an in conf) else 'F:' + (an if an in DYF else a)
        # the local (Eastern) date: a night kickoff is the next day in UTC
        import datetime
        d = (datetime.datetime.fromisoformat(r['start_date'][:19]) - datetime.timedelta(hours=7)).strftime('%Y-%m-%d')
        games.append([d[5:], H, A, 1 if r['neutral_site'] == 'TRUE' else 0, 1 if r['conference_game'] == 'TRUE' else 0])
        if r['home_points'] not in ('', 'NA') and r['away_points'] not in ('', 'NA'):
            res.append((H, A, int(float(r['home_points'])) - int(float(r['away_points'])), r['neutral_site'] == 'TRUE'))
    SCHED[y] = games; CONFS[y] = conf
    # a simple SRS: rating = average capped margin adjusted for opponents (FCS opponents pooled), home field 2.5
    teams = sorted(set([t for g in res for t in g[:2]]))
    idx = {t: i for i, t in enumerate(teams)}
    rat = {t: 0.0 for t in teams}
    for it in range(200):
        acc = collections.defaultdict(list)
        for h, a, m, nt in res:
            m = max(-28, min(28, m)) - (0 if nt else 2.5)
            hk = h if not h.startswith('F:') else 'F:*'; ak = a if not a.startswith('F:') else 'F:*'
            acc[hk].append(m + rat.get(ak, -20)); acc[ak].append(-m + rat.get(hk, -20))
        new = {t: sum(v) / len(v) for t, v in acc.items()}
        mu = statistics.mean([v for t, v in new.items() if not t.startswith('F:')])
        rat = {t: v - mu for t, v in new.items()}
    SRS[y] = {t: round(v, 1) for t, v in rat.items() if not t.startswith('F:')}
print('schedules', min(SCHED), max(SCHED), 'games', {y: len(v) for y, v in list(SCHED.items())[:3]})

# ---------- NCAA 14 rosters ----------
NCAA_FILES = {2006: 'f00', 2007: 'f01', 2008: 'f02', 2009: 'f03', 2010: 'f04', 2011: 'f05', 2012: 'f06', 2013: 'f07', 2014: 'f10',
              2015: 'f12', 2016: 'f13', 2017: 'f14', 2018: 'f16', 2019: 'f18', 2020: 'g02', 2021: 'g03', 2022: 'g00', 2023: 'g01'}
PPOS = {0: 'QB', 1: 'RB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'OT', 9: 'OT', 6: 'IOL', 7: 'IOL', 8: 'IOL', 10: 'EDGE', 11: 'EDGE', 12: 'DT',
        13: 'LB', 14: 'LB', 15: 'LB', 16: 'CB', 17: 'S', 18: 'S', 19: 'K', 20: 'P'}
ATTR = [('spd', 'PSPD'), ('acc', 'PACC'), ('agi', 'PAGI'), ('str', 'PSTR'), ('awr', 'PAWR'), ('thp', 'PTHP'), ('sac', 'PTHA'), ('car', 'PCAR'),
        ('btk', 'PBTK'), ('bcv', 'PBCV'), ('cth', 'PCTH'), ('rbk', 'PRBK'), ('pbk', 'PPBK'), ('pmv', 'PPMV'), ('fmv', 'PFMV'), ('bsh', 'PBSH'),
        ('tak', 'PTAK'), ('prc', 'PPRC'), ('mcv', 'PMCV'), ('zcv', 'PZCV'), ('hit', 'PHIT'), ('kpw', 'PKPR'), ('kac', 'PKAC')]
def ncaa(y):
    d = open(os.path.join(HD, 'dec', NCAA_FILES[y] + '.bin'), 'rb').read(); T = tdb.tables(d)
    tm = {t['TGID']: t['TDNA'] for t in tdb.records(d, T['TEAM']) if t['TDNA']}
    out = collections.defaultdict(list)
    for p in tdb.records(d, T['PLAY']):
        n = dyname(tm.get(p['TGID'], '') or '')
        if not n or n not in DYT or p['PPOS'] not in PPOS: continue
        out[n].append(p)
    return out

# rating scale: NCAA overall -> dynasty overall (the dynasty runs about 50-96)
def scale(v): return max(45, min(97, round(31 + 0.62 * v)))
def scale_attr(v): return max(30, min(99, round(22 + 0.78 * v)))

# ---------- cfbfastR rosters (names, class, size, hometown) for the years without NCAA files ----------
def cfr_roster(y):
    f = os.path.join(HD, 'cfr/rosters/csv/cfb_rosters_%d.csv' % y)
    if not os.path.exists(f): return {}
    out = collections.defaultdict(list)
    for r in csv.DictReader(open(f)):
        n = dyname(r['team'])
        if n and n in DYT: out[n].append(r)
    return out
CPOS = {'QB': 'QB', 'RB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'OT': 'OT', 'OG': 'IOL', 'G': 'IOL', 'C': 'IOL', 'OC': 'IOL', 'DE': 'EDGE',
        'DT': 'DT', 'NT': 'DT', 'LB': 'LB', 'OLB': 'LB', 'ILB': 'LB', 'MLB': 'LB', 'CB': 'CB', 'S': 'S', 'FS': 'S', 'SS': 'S', 'K': 'K', 'PK': 'K',
        'P': 'P', 'LS': 'LS', 'ATH': 'WR', 'DB': 'CB', 'OL': 'OL', 'DL': 'DL'}

# ---------- the draft: career value by player ----------
DRAFT = []
for r in csv.DictReader(open(os.path.join(HD, 'draft.csv'))):
    try: age = int(float(r['age'])) if r['age'] not in ('', 'NA') else 22
    except ValueError: age = 22
    wav = float(r['w_av']) if r['w_av'] not in ('', 'NA') else 0
    pb = int(r['probowls'] or 0) if r['probowls'] not in ('', 'NA') else 0
    ap = int(r['allpro'] or 0) if r['allpro'] not in ('', 'NA') else 0
    pick = int(r['pick'])
    DRAFT.append(dict(n=r['pfr_player_name'], y=int(r['season']), pick=pick, pos=r['position'], col=r['college'], age=age,
                      val=wav + pb * 4 + ap * 8 + max(0, 260 - pick) / 12, hof=r['hof'] == 'TRUE'))
DRAFT_BY = collections.defaultdict(list)
for d in DRAFT: DRAFT_BY[d['n'].lower()].append(d)
def norm(n): return re.sub(r'[^a-z]', '', re.sub(r'\b(jr|sr|ii|iii|iv)\b\.?', '', n.lower()))
DRAFT_N = collections.defaultdict(list)
for d in DRAFT: DRAFT_N[norm(d['n'])].append(d)

# ---------- team strength for a season: results (SRS) blended with roster talent ----------
def team_strength(y, rosters):
    s = SRS.get(y, {})
    tal = {}
    for t, ps in rosters.items():
        o = sorted((p[3] for p in ps), reverse=True)[:24]
        if o: tal[t] = statistics.mean(o)
    names = [t for t in CONFS.get(y, {})]
    def z(dct):
        v = [dct[t] for t in names if t in dct]
        if len(v) < 5: return {}
        m, sd = statistics.mean(v), statistics.pstdev(v) or 1
        return {t: (dct[t] - m) / sd for t in names if t in dct}
    zs, zt = z(s), z(tal)
    out = {}
    for t in names:
        a, b = zs.get(t), zt.get(t)
        out[t] = (a if b is None else b if a is None else a * 0.55 + b * 0.45) if (a is not None or b is not None) else -1.5
    return out
def prestige_map(strength):
    order = sorted(strength, key=lambda t: -strength[t])
    n = len(order)
    return {t: PRESTIGE_NOW[min(len(PRESTIGE_NOW) - 1, round(i * (len(PRESTIGE_NOW) - 1) / max(1, n - 1)))] for i, t in enumerate(order)}

# ---------- one start year ----------
def build_year(y):
    conf = CONFS.get(y, {})
    rosters = {}
    if y in NCAA_FILES:
        N = ncaa(y); src_note = 'NCAA Football 14 community roster'
        cf = cfr_roster(y)
        for t, ps in N.items():
            if t not in conf: continue
            home, bynum = {}, collections.defaultdict(list)
            for r in cf.get(t, []):
                home[norm(r['first_name'] + r['last_name'])] = r
                if r['jersey'] not in ('', 'NA'): bynum[int(float(r['jersey']))].append(r)
            out, used = [], set()
            for p in ps:
                pos = PPOS[p['PPOS']]; nm = re.sub(r' [A-Z]$', '', (p['PFNA'] + ' ' + p['PLNA']).strip())   # the file tags duplicate names ("Barnett C")
                if not p['PFNA'] or re.match(r'^[A-Z]+ #\d+$', p['PLNA'] or ''):
                    # a generic player in the file ("CB #20"): take the real name from that season's roster by jersey number
                    c = [r for r in bynum.get(p['PJEN'], []) if id(r) not in used]
                    c.sort(key=lambda r: 0 if CPOS.get((r['position'] or '').upper(), '') in (pos, 'OL' if pos in ('OT', 'IOL') else '', 'DL' if pos in ('EDGE', 'DT') else '', 'CB' if pos == 'S' else '') else 1)
                    if c: used.add(id(c[0])); nm = (c[0]['first_name'] + ' ' + c[0]['last_name']).strip()
                    else: nm = ''      # no name on record: the game makes one up
                yr = p['PYEA'] + 1
                ht = p['PHGT'] if 60 <= p['PHGT'] <= 84 else None
                wt = p['PWGT'] + 160 if p['PWGT'] < 200 else None
                at = {k: scale_attr(p[f]) for k, f in ATTR if p.get(f) is not None}
                h = home.get(norm(nm))
                row = [nm, pos, yr, scale(p['POVR']), p['PJEN'], ht or 0, wt or 0, at.get('spd'), at.get('str'), at.get('awr'), h['home_state'] if h and h['home_state'] not in ('', 'NA') else '']
                if t == 'Tennessee': row.append({'at': at, 'home': (h['home_city'] + ', ' + h['home_state']) if h and h['home_city'] not in ('', 'NA') else ''})
                out.append(row)
            rosters[t] = out
    else:
        src_note = 'cfbfastR roster; ratings from class year, team results and later careers'
        cf = cfr_roster(y)
        srs = SRS.get(y, {})
        for t, rs in cf.items():
            if t not in conf: continue
            out = []
            base = 70 + max(-10, min(14, srs.get(t, -6) * 0.55))
            for r in rs:
                pos = CPOS.get((r['position'] or '').upper())
                if not pos: continue
                try: wt = int(float(r['weight'])) if r['weight'] not in ('', 'NA') else 0
                except ValueError: wt = 0
                try: ht = int(float(r['height'])) if r['height'] not in ('', 'NA') else 0
                except ValueError: ht = 0
                if pos == 'OL': pos = 'OT' if ht >= 77 else 'IOL'
                if pos == 'DL': pos = 'DT' if wt >= 285 else 'EDGE'
                try: yr = max(1, min(5, int(float(r['year']))))
                except ValueError: yr = 1
                nm = (r['first_name'] + ' ' + r['last_name']).strip()
                h = zlib.crc32((nm + str(y)).encode()) % 1000 / 1000
                ovr = base + {1: -11, 2: -5, 3: -1.5, 4: 1.5, 5: 2.5}[yr] + (h - 0.5) * 12
                for d in DRAFT_N.get(norm(nm), []):
                    if d['y'] > y and d['y'] - y <= 4 and dyname(d['col']) == t:
                        ovr += max(3, 14 - d['pick'] / 18) * (1 - (d['y'] - y - 1) * 0.28)
                try: num = int(float(r['jersey'])) if r['jersey'] not in ('', 'NA') else 0
                except ValueError: num = 0
                row = [nm, pos, yr, max(45, min(95, round(ovr))), num, ht, wt, None, None, None, r['home_state'] if r['home_state'] not in ('', 'NA') else '']
                if t == 'Tennessee': row.append({'home': (r['home_city'] + ', ' + r['home_state']) if r['home_city'] not in ('', 'NA') else ''})
                out.append(row)
            out.sort(key=lambda r: -r[3]); rosters[t] = out[:85]
    st = team_strength(y, rosters)
    pr = prestige_map(st)
    data = {'y': y, 'src': src_note, 'conf': conf, 'pr': pr, 'ros': rosters}
    js = 'window.DY_HIST = window.DY_HIST || {}; window.DY_HIST[%d] = %s;\n' % (y, json.dumps(data, separators=(',', ':'), ensure_ascii=False))
    open(os.path.join(OUT, 'fb-%d.js' % y), 'w').write(js)
    ut = rosters.get('Tennessee', [])
    print(y, src_note[:12], 'teams', len(rosters), 'players', sum(len(v) for v in rosters.values()), 'UT', len(ut), 'kb', len(js) // 1024,
          'top UT', [r[0] + ' ' + str(r[3]) for r in sorted(ut, key=lambda r: -r[3])[:3]], 'UT pr', pr.get('Tennessee'))

for y in range(2006, 2026):
    build_year(y)

# ---------- 1990-2005: conferences of the time, real players where the record has them ----------
FBS_FROM = {'UCF': 1996, 'Marshall': 1997, 'UConn': 2002, 'Troy': 2001, 'South Florida': 2001, 'Middle Tennessee': 1999, 'FAU': 2004, 'FIU': 2005,
            'UAB': 1996, 'Buffalo': 1999, 'ULM': 1994, 'North Texas': 1995, 'Boise State': 1996, 'Nevada': 1992, 'Arkansas State': 1992,
            'Western Kentucky': 2009, 'Georgia State': 2013, 'Texas State': 2012, 'UTSA': 2012, 'South Alabama': 2012, 'Charlotte': 2015,
            'Coastal Carolina': 2017, 'Liberty': 2018, 'App State': 2014, 'Georgia Southern': 2014, 'Old Dominion': 2014, 'James Madison': 2022,
            'Sam Houston': 2023, 'Jacksonville State': 2023, 'Kennesaw State': 2024, 'Delaware': 2025, 'Missouri State': 2025, 'UMass': 2012}
SEC10 = ['Alabama', 'Auburn', 'Florida', 'Georgia', 'Kentucky', 'LSU', 'Ole Miss', 'Mississippi State', 'Tennessee', 'Vanderbilt']
ACC8 = ['Clemson', 'Duke', 'Georgia Tech', 'Maryland', 'North Carolina', 'NC State', 'Virginia', 'Wake Forest']
B10 = ['Illinois', 'Indiana', 'Iowa', 'Michigan', 'Michigan State', 'Minnesota', 'Northwestern', 'Ohio State', 'Purdue', 'Wisconsin']
P10 = ['Arizona', 'Arizona State', 'Cal', 'Oregon', 'Oregon State', 'Stanford', 'UCLA', 'USC', 'Washington', 'Washington State']
B8 = ['Colorado', 'Iowa State', 'Kansas', 'Kansas State', 'Missouri', 'Nebraska', 'Oklahoma', 'Oklahoma State']
SWC = ['Baylor', 'Houston', 'Rice', 'SMU', 'TCU', 'Texas', 'Texas A&M', 'Texas Tech']
BEAST = ['Boston College', 'Miami', 'Pitt', 'Rutgers', 'Syracuse', 'Temple', 'Virginia Tech', 'West Virginia']
MAC9 = ['Ball State', 'Bowling Green', 'Central Michigan', 'Eastern Michigan', 'Kent State', 'Miami (OH)', 'Ohio', 'Toledo', 'Western Michigan']
def old_conf(y):
    c = {}
    for t in SEC10: c[t] = 'SEC'
    if y >= 1992: c['Arkansas'] = c['South Carolina'] = 'SEC'
    for t in ACC8: c[t] = 'ACC'
    c['Florida State'] = 'ACC' if y >= 1992 else 'IND'
    for t in B10: c[t] = 'B1G'
    c['Penn State'] = 'B1G' if y >= 1993 else 'IND'
    for t in P10: c[t] = 'P12'
    if y <= 1995:
        for t in B8: c[t] = 'B8'
        for t in SWC: c[t] = 'SWC'
        if y <= 1991: c['Arkansas'] = 'SWC'
    else:
        for t in B8 + ['Baylor', 'Texas', 'Texas A&M', 'Texas Tech']: c[t] = 'B12'
    for t in BEAST: c[t] = 'BE' if y >= 1991 else 'IND'
    if y <= 1995:
        for t in ['Air Force', 'BYU', 'Colorado State', "Hawai'i", 'New Mexico', 'San Diego State', 'Utah', 'UTEP', 'Wyoming']: c[t] = 'WAC'
        c['Fresno State'] = 'WAC' if y >= 1992 else 'BW'
        for t in ['San José State', 'UNLV', 'Utah State', 'New Mexico State']: c[t] = 'BW'
        if y >= 1992: c['Nevada'] = 'BW'
        for t in ['Arkansas State', 'Louisiana Tech', 'Louisiana']: c[t] = 'BW' if y >= 1993 else 'IND'
        for t in ['Memphis', 'Southern Miss', 'Tulane', 'Louisville', 'Cincinnati', 'East Carolina', 'Army', 'Navy', 'Notre Dame', 'Northern Illinois', 'ULM', 'North Texas']: c[t] = 'IND'
        if y >= 1993: c['Northern Illinois'] = 'BW'
    else:
        if y <= 1998:
            for t in ['Air Force', 'BYU', 'Colorado State', "Hawai'i", 'New Mexico', 'San Diego State', 'Utah', 'UTEP', 'Wyoming', 'Fresno State',
                      'Rice', 'SMU', 'TCU', 'Tulsa', 'UNLV', 'San José State']: c[t] = 'WAC'
        else:
            for t in ['Air Force', 'BYU', 'Colorado State', 'New Mexico', 'San Diego State', 'UNLV', 'Utah', 'Wyoming']: c[t] = 'MWC'
            for t in ['Fresno State', "Hawai'i", 'Rice', 'San José State', 'SMU', 'TCU', 'Tulsa', 'UTEP']: c[t] = 'WAC'
            if y >= 2000: c['Nevada'] = 'WAC'
        for t in ['Utah State', 'New Mexico State', 'Boise State', 'North Texas', 'Arkansas State']: c[t] = 'BW'
        if y <= 1999: c['Nevada'] = 'BW'
        for t in ['Cincinnati', 'Houston', 'Louisville', 'Memphis', 'Southern Miss', 'Tulane']: c[t] = 'CUSA'
        c['East Carolina'] = 'CUSA' if y >= 1997 else 'IND'
        c['UAB'] = 'CUSA' if y >= 1999 else 'IND'
        c['Army'] = 'CUSA' if y >= 1998 else 'IND'
        for t in ['Navy', 'Notre Dame', 'Louisiana Tech', 'Louisiana', 'ULM', 'UCF', 'Middle Tennessee']: c[t] = 'IND'
        c['Northern Illinois'] = 'MAC' if y >= 1997 else 'BW'
    for t in MAC9: c[t] = 'MAC'
    if y >= 1992: c['Akron'] = 'MAC'
    else: c['Akron'] = 'IND'
    if y >= 1997: c['Marshall'] = 'MAC'
    if y >= 1999: c['Buffalo'] = 'MAC'
    c['Tulsa'] = c.get('Tulsa', 'IND')
    return {t: v for t, v in c.items() if t in DYT and FBS_FROM.get(t, 0) <= y}
# talent by team and season from the draft: who was on campus (arrived <= season < drafted)
def draft_talent(y):
    tal = collections.defaultdict(float)
    for d in DRAFT:
        enroll = d['y'] - max(3, min(5, d['age'] - 18))
        if enroll <= y < d['y']:
            t = dyname(d['col'])
            if t in DYT: tal[t] += max(1, 30 - d['pick'] / 9) + d['val'] * 0.15
    return tal
UTSTATS = collections.defaultdict(list)
cur = None
for line in open(os.path.join(ROOT, 'tools/games_ut_football.txt')):
    line = line.rstrip('\n')
    m = re.match(r'^#(\d{4})\|', line)
    if m: cur = int(m.group(1)); continue
    if line.startswith('#') or not line.strip() or cur is None: continue
    nm, pos = line.split('|')[:2]; UTSTATS[cur].append((nm, pos.split('/')[0]))
SPOS = {'QB': 'QB', 'RB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'DE': 'EDGE', 'DT': 'DT', 'NT': 'DT', 'LB': 'LB', 'DB': 'CB', 'CB': 'CB', 'S': 'S',
        'K': 'K', 'P': 'P', 'OL': 'IOL', 'OT': 'OT', 'OG': 'IOL', 'C': 'IOL'}
def build_old(y):
    if y in SCHED and y >= 2001: conf = dict(CONFS[y])
    else: conf = old_conf(y)
    for t in list(conf):
        if FBS_FROM.get(t, 0) > y: del conf[t]
    tal = draft_talent(y)
    srs = SRS.get(y, {})
    # strength: results when there are any (2001-2005), blended with talent on campus
    names = list(conf)
    def z(d):
        v = [d.get(t, 0) for t in names]; m, sd = statistics.mean(v), statistics.pstdev(v) or 1
        return {t: (d.get(t, 0) - m) / sd for t in names}
    zt, zs = z(tal), (z(srs) if srs else None)
    st = {t: (zt[t] * 0.5 + zs[t] * 0.5) if zs else zt[t] for t in names}
    pr = prestige_map(st)
    # real players: everyone drafted later who was on campus that season, and Tennessee's stat leaders
    ros = collections.defaultdict(list)
    for d in DRAFT:
        enroll = d['y'] - max(3, min(5, d['age'] - 18))
        if not (enroll <= y < d['y']): continue
        t = dyname(d['col'])
        if t not in conf: continue
        pos = POSMAP_D.get(d['pos'].upper())
        if not pos: continue
        yr = max(1, min(5, y - enroll + 1)); left = d['y'] - y     # seasons until the draft
        ovr = 70 + max(0, 20 - d['pick'] / 13) - (left - 1) * 4.5 + min(4, d['val'] / 25)
        ros[t].append([d['n'], pos, yr, max(55, min(94, round(ovr))), 0, 0, 0, None, None, None, ''])
    seen = {norm(r[0]) for r in ros.get('Tennessee', [])}
    for nm, p0 in UTSTATS.get(y, []):
        pos = SPOS.get(p0.upper()); 
        if not pos or norm(nm) in seen: continue
        prior = sum(1 for yy in range(y - 4, y) if any(norm(n) == norm(nm) for n, _ in UTSTATS.get(yy, [])))
        ros['Tennessee'].append([nm, pos, min(5, prior + 2), 76 + prior * 2, 0, 0, 0, None, None, None, ''])
        seen.add(norm(nm))
    data = {'y': y, 'src': 'real players from the NFL draft record and Tennessee stat sheets; the rest of each roster is generated', 'conf': conf, 'pr': pr, 'ros': dict(ros)}
    js = 'window.DY_HIST = window.DY_HIST || {}; window.DY_HIST[%d] = %s;\n' % (y, json.dumps(data, separators=(',', ':'), ensure_ascii=False))
    open(os.path.join(OUT, 'fb-%d.js' % y), 'w').write(js)
    OLD_CONF[y] = conf
    ut = ros.get('Tennessee', [])
    print(y, 'old: teams', len(conf), 'real players', sum(len(v) for v in ros.values()), 'UT', len(ut), [r[0] + ' ' + str(r[3]) for r in sorted(ut, key=lambda r: -r[3])[:4]], 'UT pr', pr.get('Tennessee'), 'top', sorted(pr, key=lambda t: -st[t])[:5])
POSMAP_D = {'QB': 'QB', 'RB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'T': 'OT', 'OT': 'OT', 'G': 'IOL', 'OG': 'IOL', 'C': 'IOL', 'OL': 'OT',
            'DE': 'EDGE', 'OLB': 'EDGE', 'DT': 'DT', 'NT': 'DT', 'DL': 'DT', 'LB': 'LB', 'ILB': 'LB', 'MLB': 'LB', 'CB': 'CB', 'DB': 'CB',
            'S': 'S', 'SAF': 'S', 'FS': 'S', 'SS': 'S', 'K': 'K', 'P': 'P', 'LS': 'LS'}
OLD_CONF = {}
for y in range(1990, 2006):
    build_old(y)

# ---------- schedules for every season (the real slate is played in any historical season up to 2025) ----------
S = {y: {'conf': CONFS[y], 'g': SCHED[y]} for y in SCHED if 2006 <= y <= 2025}
for y, c in OLD_CONF.items(): S[y] = {'conf': c, 'g': SCHED.get(y, []) if y >= 2001 else []}
open(os.path.join(OUT, 'fb-sched.js'), 'w').write('window.DY_HSCHED = %s;\n' % json.dumps(S, separators=(',', ':'), ensure_ascii=False))
print('fb-sched kb', os.path.getsize(os.path.join(OUT, 'fb-sched.js')) // 1024)

# ---------- recruiting classes re-ranked by careers: the best real players of each class (drafted players) ----------
POSMAP = {'QB': 'QB', 'RB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'T': 'OT', 'OT': 'OT', 'G': 'IOL', 'OG': 'IOL', 'C': 'IOL', 'OL': 'OT',
          'DE': 'EDGE', 'OLB': 'EDGE', 'DT': 'DT', 'NT': 'DT', 'DL': 'DT', 'LB': 'LB', 'ILB': 'LB', 'MLB': 'LB', 'CB': 'CB', 'DB': 'CB',
          'S': 'S', 'SAF': 'S', 'FS': 'S', 'SS': 'S', 'K': 'K', 'P': 'P', 'LS': 'LS'}
HOME = {}
for y in range(2004, 2027):
    for t, rs in cfr_roster(y).items():
        for r in rs:
            if r['home_state'] not in ('', 'NA'): HOME[norm(r['first_name'] + r['last_name'])] = (r['home_city'], r['home_state'])
classes = collections.defaultdict(list)
for d in DRAFT:
    enroll = d['y'] - max(3, min(5, d['age'] - 18))     # the fall he arrived on campus
    cls = enroll                                         # signed in that class
    if cls < 1990 or cls > 2022: continue
    pos = POSMAP.get(d['pos'].upper())
    if not pos: continue
    school = dyname(d['col']) or d['col']
    hm = HOME.get(norm(d['n']))
    classes[cls].append([d['n'], pos, school, round(d['val'], 1), d['y'], d['pick'], (hm[0] + ', ' + hm[1]) if hm else ''])
CL = {}
for c, ps in classes.items():
    ps.sort(key=lambda r: -r[3]); CL[c] = ps[:200]
open(os.path.join(OUT, 'fb-classes.js'), 'w').write('window.DY_HCLASS = %s;\n' % json.dumps(CL, separators=(',', ':'), ensure_ascii=False))
print('classes', min(CL), max(CL), {c: len(v) for c, v in list(sorted(CL.items()))[-6:]}, 'kb', os.path.getsize(os.path.join(OUT, 'fb-classes.js')) // 1024)
print('2015 class top 10:', [(r[0], r[1], r[2]) for r in CL[2015][:10]])
