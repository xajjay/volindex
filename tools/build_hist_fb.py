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
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hist_ratings  # noqa: E402

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

# ---------- EA College Football 25 / 26 ratings (TeamCrafters exports) ----------
EA_YEAR = {2024: os.path.join(HD, 'ext', 'volindex-ea-cfb25.txt'), 2025: os.path.join(HD, 'ext', 'volindex-ea-cfb26.txt')}
EAPOS = {'QB': 'QB', 'HB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'LT': 'OT', 'RT': 'OT', 'LG': 'IOL', 'C': 'IOL', 'RG': 'IOL', 'LEDG': 'EDGE', 'REDG': 'EDGE',
         'LE': 'EDGE', 'RE': 'EDGE', 'DT': 'DT', 'SAM': 'LB', 'WILL': 'LB', 'MIKE': 'LB', 'LOLB': 'LB', 'ROLB': 'LB', 'MLB': 'LB', 'CB': 'CB', 'FS': 'S', 'SS': 'S',
         'K': 'K', 'P': 'P', 'ATH': 'WR', 'LS': 'LS', 'KR': 'WR', 'PR': 'WR'}
def ea_team(label):
    names = sorted(list(DYT) + list(ALIAS), key=len, reverse=True)
    for n in names:
        if label.startswith(n): return dyname(n)
    return None
def load_ea(path):
    out, cur, seen = collections.defaultdict(list), None, set()
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if line.startswith('#'): cur = ea_team(line.split('\t', 1)[1] if '\t' in line else ''); continue
        f = line.split('\t')
        if cur is None or len(f) < 13: continue
        nm = f[0].strip()
        if nm.isupper() and len(nm) > 4: nm = nm.title()          # the site lists some players twice, once in capitals
        key = (cur, norm(nm))
        if key in seen: continue
        seen.add(key)
        cls = f[5]; yr = {'FR': 1, 'SO': 2, 'JR': 3, 'SR': 4}.get(cls[:2], 2)
        try: wt = int(f[4]); wt = wt if 150 <= wt <= 400 else 0
        except ValueError: wt = 0
        num = lambda v: int(v) if v.isdigit() else 0
        out[cur].append({'n': nm, 'pos': EAPOS.get(f[1], 'WR'), 'num': num(f[2]), 'ht': num(f[3]), 'wt': wt, 'yr': yr, 'ovr': num(f[6]), 'dev': f[7], 'spd': num(f[8]), 'str': num(f[9]), 'awr': num(f[12])})
    return out

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


# ---------- season stats and awards (Sports-Reference export, when it is there) ----------
SRX = {}
SR_SLUG = {'miami-fl': 'Miami', 'miami-oh': 'Miami (OH)', 'louisiana-state': 'LSU', 'mississippi': 'Ole Miss', 'southern-california': 'USC', 'central-florida': 'UCF',
           'brigham-young': 'BYU', 'texas-christian': 'TCU', 'southern-methodist': 'SMU', 'alabama-birmingham': 'UAB', 'nevada-las-vegas': 'UNLV', 'texas-el-paso': 'UTEP',
           'texas-san-antonio': 'UTSA', 'north-carolina-state': 'NC State', 'pittsburgh': 'Pitt', 'california': 'Cal', 'connecticut': 'UConn', 'massachusetts': 'UMass',
           'florida-atlantic': 'FAU', 'florida-international': 'FIU', 'louisiana-monroe': 'ULM', 'louisiana-lafayette': 'Louisiana', 'appalachian-state': 'App State',
           'southern-mississippi': 'Southern Miss', 'hawaii': "Hawai'i", 'san-jose-state': 'San José State', 'middle-tennessee-state': 'Middle Tennessee',
           'sam-houston-state': 'Sam Houston', 'bowling-green-state': 'Bowling Green', 'texas-am': 'Texas A&M', 'mississippi-state': 'Mississippi State',
           'south-florida': 'South Florida', 'western-kentucky': 'Western Kentucky', 'east-carolina': 'East Carolina', 'james-madison': 'James Madison'}
def sr_team(slug):
    if not slug: return None
    if slug in SR_SLUG: return SR_SLUG[slug]
    return dyname(' '.join(w.capitalize() for w in slug.split('-')))
SRROS = collections.defaultdict(list)
def load_sr():
    f = os.path.join(HD, 'ext', 'volindex-sr-stats.txt')
    if not os.path.exists(f): return
    head, sec = {}, None
    for line in open(f, encoding='utf-8'):
        line = line.rstrip('\n')
        if line.startswith('H\t'): head = json.loads(line[2:]); continue
        if line.startswith('S\t'): sec = ('S', line[2:]); continue
        if line.startswith('A\t'): sec = ('A', line[2:]); continue
        if not sec: continue
        if sec[0] == 'S':
            y, page = sec[1].split('-', 1); hd = head.get(page)
            if not hd: continue
            fl = dict(zip(hd, line.split('|')))
            k = (int(y), norm(fl.get('name', '')))
            d = SRX.setdefault(k, {'school': fl.get('school'), 'aw': '', 'slug': fl.get('slug')})
            for h in hd[4:-1]:
                if fl.get(h) and not d.get(h): d[h] = fl[h]
            if fl.get('awards'): d['aw'] = (d['aw'] + ',' + fl['awards']).strip(',')
        else:
            # award pages: caption|slug|school|data-stat=value;...
            parts = line.split('|', 3)
            if len(parts) < 4: continue
            o = dict(kv.split('=', 1) for kv in parts[3].split(';') if '=' in kv)
            yv = o.get('year_id') or o.get('year') or (sec[1][-4:] if sec[1].startswith('heisman-') else '')
            m = re.search(r'(\d{4})', yv)
            nm = o.get('player') or o.get('name_display') or ''
            if not m or not nm: continue
            y = int(m.group(1)); k = (y, norm(nm.replace('*', '')))
            tag = 'AA' if sec[1].startswith('all-america') else ('H-' + (o.get('rank') or o.get('ranker') or '1')) if sec[1].startswith('heisman-') else sec[1].replace('-', ' ').title().replace(' ', '')
            if sec[1] == 'heisman': tag = 'H-1'
            d = SRX.setdefault(k, {'school': parts[2], 'aw': ''})
            if tag not in d['aw']: d['aw'] = (d['aw'] + ',' + tag).strip(',')
    for fn in sorted(os.listdir(os.path.join(HD, 'ext'))):
        if not fn.startswith('volindex-sr-rosters'): continue
        cur = None
        for line in open(os.path.join(HD, 'ext', fn), encoding='utf-8'):
            line = line.rstrip('\n')
            if line.startswith('R\t'):
                sl, yy = line[2:].split('|'); cur = (int(yy), sr_team(sl)); continue
            if not cur or not cur[1]: continue
            slug, nm, cls, pos, summ = (line.split('|') + [''] * 5)[:5]
            SRROS[cur].append({'slug': slug, 'n': nm, 'cls': cls, 'pos': pos, 'sum': summ})
            # defense from the stat summary ("45 Tkl, 6.5 TFL, 4 Sk, 2 Int")
            k = (cur[0], norm(nm)); d = SRX.setdefault(k, {'school': '', 'aw': ''})
            for val, lab in re.findall(r'([\d.]+) (Tkl|TFL|Sk|Int|PD|FF)', summ):
                key = {'Tkl': 'tackles_total', 'TFL': 'tackles_loss', 'Sk': 'sacks', 'Int': 'def_int', 'PD': 'pass_defended', 'FF': 'fumbles_forced'}[lab]
                if not d.get(key): d[key] = val
load_sr()
print('SR seasons with stats:', len(SRX), 'roster team-seasons:', len(SRROS))
def info_for(y, team, sy=None):
    def f(name, pos):
        out = {}
        st = SRX.get((sy or y, norm(name)))
        if st: out['prod'] = hist_ratings.production(pos, st); out['aw'] = st.get('aw', '')
        for d in DRAFT_N.get(norm(name), []):
            if y < d['y'] <= y + 4 and (dyname(d['col']) == team or not team):
                out['pick'] = d['pick']; out['yrs_out'] = d['y'] - y; break
        return out
    return f
def rate_all(y, rosters, pr, sy=None):
    for t, rows in rosters.items():
        for r in rows:      # where he actually played that season, when the stats say so
            st = SRX.get((sy or y, norm(r[0])))
            if not st: continue
            f = lambda k: float(st.get(k) or 0)
            if f('pass_att') >= 150 and r[1] != 'QB': r[1] = 'QB'
            elif r[1] == 'QB' and f('pass_att') < 20 and f('rec') >= 10: r[1] = 'WR'
            elif r[1] == 'QB' and f('pass_att') < 20 and f('rush_att') >= 40: r[1] = 'RB'
        hist_ratings.rate_team(y, pr.get(t, 60), rows, info_for(y, t, sy))

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
    elif y in EA_YEAR and os.path.exists(EA_YEAR[y]):
        # EA College Football 25 (end of 2024) / 26 (end of 2025): every team's real roster and ratings
        src_note = 'EA Sports College Football %d ratings (TeamCrafters)' % (25 if y == 2024 else 26)
        E = load_ea(EA_YEAR[y]); cf = cfr_roster(y); homes = {}
        for t, rs in cf.items():
            for r in rs: homes[(t, norm(r['first_name'] + r['last_name']))] = r
        for t, rs in E.items():
            if t not in conf: continue
            out = []
            for r in rs:
                h = homes.get((t, norm(r['n'])))
                row = [r['n'], r['pos'], r['yr'], scale(r['ovr']), r['num'], r['ht'], r['wt'], scale_attr(r['spd']), scale_attr(r['str']), scale_attr(r['awr']), h['home_state'] if h and h['home_state'] not in ('', 'NA') else '']
                if t == 'Tennessee': row.append({'home': (h['home_city'] + ', ' + h['home_state']) if h and h['home_city'] not in ('', 'NA') else ''})
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
    rate_all(y, rosters, pr)
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
    rate_all(y, ros, pr)
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

# ---------- 2026: every team's real roster (Tennessee keeps its hand-built roster in the game) ----------
def load_247():
    f = os.path.join(HD, 'ext', 'volindex-247.txt'); out = collections.defaultdict(list)
    if not os.path.exists(f): return out
    for line in open(f, encoding='utf-8'):
        p = line.rstrip('\n').split('|')
        if len(p) < 9 or not p[0].isdigit(): continue
        cls, rk, nm, meta, pos, hw, score, stars, sch = p[:9]
        m = re.search(r'\(([^,]+), ([A-Z]{2})\)', meta)
        out[int(cls)].append({'rk': int(rk), 'n': nm.strip(), 'hs': meta.split(' (')[0], 'home': (m.group(1) + ', ' + m.group(2)) if m else '', 'st': m.group(2) if m else '',
                              'pos': pos, 'hw': hw, 'c': float(score) if score.replace('.', '').isdigit() else 0.0, 'stars': int(stars or 0), 'school': (sch.split('/')[-1] if sch else '')})
    return out
R247 = load_247()
def build_2026():
    y = 2026
    cf = cfr_roster(y)
    E = load_ea(EA_YEAR[2025]) if os.path.exists(EA_YEAR[2025]) else {}
    ea = {}
    for t, rs in E.items():
        for r in rs: ea[norm(r['n'])] = r
    fr = {norm(r['n']): r for r in R247.get(2026, [])}
    rosters = {}
    for t, rs in cf.items():
        if t == 'Tennessee': continue
        out = []
        for r in rs:
            pos = CPOS.get((r['position'] or '').upper())
            if not pos: continue
            nm = (r['first_name'] + ' ' + r['last_name']).strip(); k = norm(nm)
            try: wt = int(float(r['weight'])) if r['weight'] not in ('', 'NA') else 0
            except ValueError: wt = 0
            try: ht = int(float(r['height'])) if r['height'] not in ('', 'NA') else 0
            except ValueError: ht = 0
            if pos == 'OL': pos = 'OT' if ht >= 77 else 'IOL'
            if pos == 'DL': pos = 'DT' if wt >= 285 else 'EDGE'
            try: yr = max(1, min(5, int(float(r['year']))))
            except ValueError: yr = 1
            e = ea.get(k); src = 0; spd = None
            if e: src = scale(e['ovr']) + 1.5; spd = scale_attr(e['spd']); pos = e['pos'] if e['pos'] != 'WR' or pos == 'WR' else pos     # a year older than his CFB 26 rating
            elif k in fr: src = scale(55 + (fr[k]['c'] - 0.80) * 140)
            try: num = int(float(r['jersey'])) if r['jersey'] not in ('', 'NA') else 0
            except ValueError: num = 0
            out.append([nm, pos, yr, src, num, ht, wt, spd, None, None, r['home_state'] if r['home_state'] not in ('', 'NA') else ''])
        rosters[t] = out
    pr = {l[0]: int(l[3]) for l in TL}
    rate_all(y, rosters, pr, 2025)      # preseason: last season's production
    for t in rosters: rosters[t].sort(key=lambda r: -r[3]); rosters[t] = rosters[t][:85]
    data = {'y': y, 'src': 'real 2026 rosters (cfbfastR); ratings from EA College Football 26, the 247 composite for freshmen, production and the draft', 'conf': {}, 'pr': pr, 'ros': rosters}
    # real 2026 stats so far for every team (Start Today): Sports-Reference season pages + stat rosters (defense)
    TS = collections.defaultdict(dict); MAPK = {'games': 'gp', 'pass_cmp': 'pc', 'pass_att': 'pa', 'pass_yds': 'py', 'pass_td': 'ptd', 'pass_int': 'pi', 'rush_att': 'ra', 'rush_yds': 'ry',
        'rush_td': 'rtd', 'rec': 'rc', 'rec_yds': 'rcy', 'rec_td': 'rctd', 'fgm': 'fgm', 'fga': 'fga', 'xpm': 'xpm', 'xpa': 'xpa', 'punt': 'pn', 'punt_yds': 'pny'}
    f26 = os.path.join(HD, 'ext', 'volindex-sr-2026.txt')
    if os.path.exists(f26):
        for line in open(f26, encoding='utf-8'):
            line = line.rstrip('\n')
            if line.startswith('S\t') or not line: continue
            parts = line.split('|', 3)
            if len(parts) < 4: continue
            t = sr_team(parts[2])
            if not t: continue
            o = dict(kv.split('=', 1) for kv in parts[3].split(';') if '=' in kv)
            d = TS[t].setdefault(norm(parts[1]), {})
            for k, v in o.items():
                if k in MAPK and v not in ('', None):
                    try: n = float(v); d[MAPK[k]] = int(n) if n == int(n) else n
                    except ValueError: pass
    for (yy, t), rows in SRROS.items():
        if yy != 2026 or not t: continue
        for r in rows:
            d = TS[t].setdefault(norm(r['n']), {})
            for val, lab in re.findall(r'([\d.]+) (Tkl|TFL|Sk|Int|PD|FF)', r['sum']):
                d[{'Tkl': 'tk', 'TFL': 'tfl', 'Sk': 'sck', 'Int': 'int', 'PD': 'pd', 'FF': 'ff'}[lab]] = float(val) if '.' in val else int(val)
    js = 'window.DY_HIST = window.DY_HIST || {}; window.DY_HIST[2026] = %s;\n' % json.dumps(data, separators=(',', ':'), ensure_ascii=False)
    js += 'window.DY_TODAY_STATS = %s;\n' % json.dumps(TS, separators=(',', ':'), ensure_ascii=False)
    open(os.path.join(OUT, 'fb-2026.js'), 'w').write(js)
    print('2026 stats: teams', len(TS), 'players', sum(len(v) for v in TS.values()))
    print('2026: teams', len(rosters), 'players', sum(len(v) for v in rosters.values()), 'with EA rating', sum(1 for v in rosters.values() for r in v if norm(r[0]) in ea))
build_2026()

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
P247 = {'QB': 'QB', 'PRO': 'QB', 'DUAL': 'QB', 'RB': 'RB', 'APB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'OT': 'OT', 'IOL': 'IOL', 'OG': 'IOL', 'OC': 'IOL',
        'EDGE': 'EDGE', 'WDE': 'EDGE', 'SDE': 'EDGE', 'DL': 'DT', 'DT': 'DT', 'LB': 'LB', 'ILB': 'LB', 'OLB': 'LB', 'CB': 'CB', 'S': 'S', 'SAF': 'S', 'ATH': 'WR',
        'K': 'K', 'P': 'P', 'LS': 'LS'}
# college production and awards by player across seasons (from the Sports-Reference export)
CAREER = collections.defaultdict(float)
for (yy, nk), st in SRX.items():
    best = max((hist_ratings.production(pp, st) or 0) for pp in ('QB', 'RB', 'WR', 'EDGE', 'LB', 'CB'))
    CAREER[nk] += best * 4 + hist_ratings.award_points(st.get('aw', '')) * 3
CL = {}
for c in range(1990, 2030):
    cand = {}
    for r in R247.get(c, []):
        cand[norm(r['n'])] = {'n': r['n'], 'pos': P247.get(r['pos'].upper(), 'WR'), 'school': dyname(r['school']) or r['school'], 'home': r['home'], 'c': r['c'], 'rk': r['rk'], 'val': 0.0}
    for d in DRAFT:
        enroll = d['y'] - max(3, min(5, d['age'] - 18))
        if enroll != c: continue
        pos = POSMAP.get(d['pos'].upper())
        if not pos: continue
        k = norm(d['n']); x = cand.get(k)
        if not x:
            hm = HOME.get(k)
            x = cand[k] = {'n': d['n'], 'pos': pos, 'school': dyname(d['col']) or d['col'], 'home': (hm[0] + ', ' + hm[1]) if hm else '', 'c': 0, 'rk': 9999, 'val': 0.0}
        x['val'] += d['val']; x['pick'] = d['pick']; x['dy'] = d['y']
    for k, x in cand.items(): x['val'] += CAREER.get(k, 0)
    if c <= 2024:
        # what they became: the class ranked by careers (the composite only breaks ties); busts fall out of the top
        ps = sorted([x for x in cand.values() if x['val'] > 0 or (c >= 2023 and x['c'] >= 0.95)], key=lambda x: -(x['val'] + max(0, x['c'] - 0.85) * 30))[:250]
        CL[c] = [[x['n'], x['pos'], x['school'], round(x['val'], 1), x.get('dy', 0), x.get('pick', 0), x['home'], 0] for x in ps]
    else:
        # classes still in school or not yet signed: the 247 Sports composite
        ps = sorted([x for x in cand.values() if x['rk'] < 9999], key=lambda x: x['rk'])[:320]
        CL[c] = [[x['n'], x['pos'], x['school'], 0, 0, 0, x['home'], x['c']] for x in ps]
CL = {c: v for c, v in CL.items() if v}
open(os.path.join(OUT, 'fb-classes.js'), 'w').write('window.DY_HCLASS = %s;\n' % json.dumps(CL, separators=(',', ':'), ensure_ascii=False))
print('classes', min(CL), max(CL), {c: len(v) for c, v in list(sorted(CL.items()))[-6:]}, 'kb', os.path.getsize(os.path.join(OUT, 'fb-classes.js')) // 1024)
print('2015 class top 10:', [(r[0], r[1], r[2]) for r in CL.get(2015, [])[:10]]); print('2027 top 5:', [(r[0], r[1], r[2], r[7]) for r in CL.get(2027, [])[:5]])
