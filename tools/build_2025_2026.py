"""Standalone, targeted rebuild for dynasty fix2 round 2:
  - fb-2025.js: real EA College Football 26 ratings (volindex-ea-cfb26.txt) instead of the
    cfbfastR-estimate fallback.
  - fb-2026.js + DY_TODAY_STATS: real 2026 rosters + season-to-date stats (volindex-sr-2026.txt).
  - fb-classes.js: adds the 2024 recruiting class (career-ranked, via nflverse draft.csv +
    Sports-Reference career stats/awards). 1990-2023 and 2025-2028 are left untouched.

Does NOT touch 2006-2023 (NCAA Football 14 PS3 rosters) or 1990-2005 (generated/real-player hybrid) -
those aren't affected by this round's new data and that data isn't available in this container.

Usage: python3 tools/build_2025_2026.py <scratch>/hdata
"""
import csv, json, math, os, re, sys, collections, statistics, zlib

HD = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'hist')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hist_ratings  # noqa: E402

# ---------- team list / name normalization (verbatim from build_hist_fb.py) ----------
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
def norm(n): return re.sub(r'[^a-z]', '', re.sub(r'\b(jr|sr|ii|iii|iv|v)\b\.?', '', (n or '').lower()))

CONF = {'SEC': 'SEC', 'Big Ten': 'B1G', 'Big 12': 'B12', 'ACC': 'ACC', 'Pac-10': 'P12', 'Pac-12': 'P12', 'Mountain West': 'MWC',
        'American Athletic': 'AAC', 'Big East': 'BE', 'Sun Belt': 'SBC', 'Mid-American': 'MAC', 'Conference USA': 'CUSA',
        'Western Athletic': 'WAC', 'FBS Independents': 'IND'}

# ---------- schedules 2025 (for CONFS/SRS) ----------
def season_games(y):
    f = os.path.join(HD, 'cfr/schedules/csv/cfb_schedules_%d.csv' % y)
    if not os.path.exists(f): return None
    return list(csv.DictReader(open(f)))
import datetime
SCHED, CONFS, SRS = {}, {}, {}
for y in (2025,):
    rows = season_games(y)
    conf, games, res = {}, [], []
    for r in rows:
        for s in ('home', 'away'):
            if r[s + '_division'] == 'fbs':
                n = dyname(r[s + '_team'])
                if n and n in DYT: conf[n] = CONF.get(r[s + '_conference'], 'IND')
    for r in rows:
        if r['season_type'] != 'regular': continue
        if re.search(r'Championship', r.get('notes') or '', re.I) and r['conference_game'] == 'TRUE' and int(r['week']) >= 13: continue
        if r['conference_game'] == 'TRUE' and r['start_date'][5:7] == '12' and r['home_conference'] == r['away_conference'] and int(r['start_date'][8:10]) <= 9 and r['home_team'] not in ('Army', 'Navy'): continue
        h, a = r['home_team'], r['away_team']
        hn, an = dyname(h), dyname(a)
        hf, af = r['home_division'] == 'fbs', r['away_division'] == 'fbs'
        if not (hf and hn in conf) and not (af and an in conf): continue
        H = hn if (hf and hn in conf) else 'F:' + (hn if hn in DYF else h)
        A = an if (af and an in conf) else 'F:' + (an if an in DYF else a)
        if r['home_points'] not in ('', 'NA') and r['away_points'] not in ('', 'NA'):
            res.append((H, A, int(float(r['home_points'])) - int(float(r['away_points'])), r['neutral_site'] == 'TRUE'))
    CONFS[y] = conf
    teams = sorted(set([t for g in res for t in g[:2]]))
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
print('CONFS[2025] teams:', len(CONFS[2025]), 'SRS[2025] teams:', len(SRS[2025]))

# ---------- EA ratings loader ----------
EA_YEAR = {2025: os.path.join(HD, 'ext', 'volindex-ea-cfb26.txt')}
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
        if nm.isupper() and len(nm) > 4: nm = nm.title()
        key = (cur, norm(nm))
        if key in seen: continue
        seen.add(key)
        cls = f[5]; yr = {'FR': 1, 'SO': 2, 'JR': 3, 'SR': 4}.get(cls[:2], 2)
        try: wt = int(f[4]); wt = wt if 150 <= wt <= 400 else 0
        except ValueError: wt = 0
        num = lambda v: int(v) if v.isdigit() else 0
        out[cur].append({'n': nm, 'pos': EAPOS.get(f[1], 'WR'), 'num': num(f[2]), 'ht': num(f[3]), 'wt': wt, 'yr': yr, 'ovr': num(f[6]), 'dev': f[7], 'spd': num(f[8]), 'str': num(f[9]), 'awr': num(f[12])})
    return out

def scale(v): return max(45, min(97, round(31 + 0.62 * v)))
def scale_attr(v): return max(30, min(99, round(22 + 0.78 * v)))

# ---------- cfbfastR rosters ----------
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
DRAFT_N = collections.defaultdict(list)
for d in DRAFT: DRAFT_N[norm(d['n'])].append(d)
print('DRAFT rows:', len(DRAFT))

# ---------- Sports-Reference career stats/awards ----------
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
        for r in rows:
            st = SRX.get((sy or y, norm(r[0])))
            if not st: continue
            f = lambda k: float(st.get(k) or 0)
            if f('pass_att') >= 150 and r[1] != 'QB': r[1] = 'QB'
            elif r[1] == 'QB' and f('pass_att') < 20 and f('rec') >= 10: r[1] = 'WR'
            elif r[1] == 'QB' and f('pass_att') < 20 and f('rush_att') >= 40: r[1] = 'RB'
        hist_ratings.rate_team(y, pr.get(t, 60), rows, info_for(y, t, sy))

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

# ==================== 1. fb-2025.js: real EA CFB26 ratings ====================
def build_2025():
    y = 2025
    conf = CONFS.get(y, {})
    rosters = {}
    src_note = 'EA Sports College Football 26 ratings (TeamCrafters)'
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
    st = team_strength(y, rosters)
    pr = prestige_map(st)
    rate_all(y, rosters, pr)
    data = {'y': y, 'src': src_note, 'conf': conf, 'pr': pr, 'ros': rosters}
    js = 'window.DY_HIST = window.DY_HIST || {}; window.DY_HIST[%d] = %s;\n' % (y, json.dumps(data, separators=(',', ':'), ensure_ascii=False))
    open(os.path.join(OUT, 'fb-%d.js' % y), 'w').write(js)
    ut = rosters.get('Tennessee', [])
    print(y, src_note[:12], 'teams', len(rosters), 'players', sum(len(v) for v in rosters.values()), 'UT', len(ut), 'kb', len(js) // 1024,
          'top UT', [r[0] + ' ' + str(r[3]) for r in sorted(ut, key=lambda r: -r[3])[:5]], 'UT pr', pr.get('Tennessee'))
build_2025()

# ==================== 2. fb-2026.js + DY_TODAY_STATS ====================
def load_247():
    f = os.path.join(HD, 'ext', 'volindex-247.txt'); out = collections.defaultdict(list)
    if not os.path.exists(f): return out
    for line in open(f, encoding='utf-8'):
        p = line.rstrip('\n').split('|')
        if len(p) < 9 or not p[0].isdigit(): continue
        cls, rk, nm, meta, pos, hw, score, stars, sch = p[:9]
        if not nm.strip() or not pos.strip(): continue
        rkm = re.match(r'\s*(\d+)', rk)
        if not rkm: continue
        rk = rkm.group(1)
        m = re.search(r'\(([^,]+), ([A-Z]{2})\)', meta)
        out[int(cls)].append({'rk': int(rk), 'n': nm.strip(), 'hs': meta.split(' (')[0], 'home': (m.group(1) + ', ' + m.group(2)) if m else '', 'st': m.group(2) if m else '',
                              'pos': pos, 'hw': hw, 'c': float(score) if score.replace('.', '').isdigit() else 0.0, 'stars': int(stars or 0), 'school': (sch.split('/')[-1] if sch else '')})
    return out
R247 = load_247()
print('247 classes:', sorted(R247.keys()))

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
            if e: src = scale(e['ovr']) + 1.5; spd = scale_attr(e['spd']); pos = e['pos'] if e['pos'] != 'WR' or pos == 'WR' else pos
            elif k in fr: src = scale(55 + (fr[k]['c'] - 0.80) * 140)
            try: num = int(float(r['jersey'])) if r['jersey'] not in ('', 'NA') else 0
            except ValueError: num = 0
            out.append([nm, pos, yr, src, num, ht, wt, spd, None, None, r['home_state'] if r['home_state'] not in ('', 'NA') else ''])
        rosters[t] = out
    pr = {l[0]: int(l[3]) for l in TL}
    rate_all(y, rosters, pr, 2025)
    for t in rosters: rosters[t].sort(key=lambda r: -r[3]); rosters[t] = rosters[t][:85]
    data = {'y': y, 'src': 'real 2026 rosters (cfbfastR); ratings from EA College Football 26, the 247 composite for freshmen, production and the draft', 'conf': {}, 'pr': pr, 'ros': rosters}
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

# ==================== 3. fb-classes.js: add 2024 (career-ranked) ====================
POSMAP = {'QB': 'QB', 'RB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'T': 'OT', 'OT': 'OT', 'G': 'IOL', 'OG': 'IOL', 'C': 'IOL', 'OL': 'OT',
          'DE': 'EDGE', 'OLB': 'EDGE', 'DT': 'DT', 'NT': 'DT', 'DL': 'DT', 'LB': 'LB', 'ILB': 'LB', 'MLB': 'LB', 'CB': 'CB', 'DB': 'CB',
          'S': 'S', 'SAF': 'S', 'FS': 'S', 'SS': 'S', 'K': 'K', 'P': 'P', 'LS': 'LS'}
HOME = {}
for yy in range(2004, 2027):
    for t, rs in cfr_roster(yy).items():
        for r in rs:
            if r['home_state'] not in ('', 'NA'): HOME[norm(r['first_name'] + r['last_name'])] = (r['home_city'], r['home_state'])
P247 = {'QB': 'QB', 'PRO': 'QB', 'DUAL': 'QB', 'RB': 'RB', 'APB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'OT': 'OT', 'IOL': 'IOL', 'OG': 'IOL', 'OC': 'IOL',
        'EDGE': 'EDGE', 'WDE': 'EDGE', 'SDE': 'EDGE', 'DL': 'DT', 'DT': 'DT', 'LB': 'LB', 'ILB': 'LB', 'OLB': 'LB', 'CB': 'CB', 'S': 'S', 'SAF': 'S', 'ATH': 'WR',
        'K': 'K', 'P': 'P', 'LS': 'LS'}
CAREER = collections.defaultdict(float)
for (yy, nk), st in SRX.items():
    best = max((hist_ratings.production(pp, st) or 0) for pp in ('QB', 'RB', 'WR', 'EDGE', 'LB', 'CB'))
    CAREER[nk] += best * 4 + hist_ratings.award_points(st.get('aw', '')) * 3

c = 2024
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
ps = sorted([x for x in cand.values() if x['val'] > 0 or (c >= 2023 and x['c'] >= 0.95)], key=lambda x: -(x['val'] + max(0, x['c'] - 0.85) * 30))[:250]
CL_2024 = [[x['n'], x['pos'], x['school'], round(x['val'], 1), x.get('dy', 0), x.get('pick', 0), x['home'], 0] for x in ps]
print('2024 class size:', len(CL_2024), 'top10:', [(r[0], r[1], r[2], r[3]) for r in CL_2024[:10]])

classes_path = os.path.join(OUT, 'fb-classes.js')
existing_src = open(classes_path).read()
m = re.search(r'window\.DY_HCLASS = (.*);\s*$', existing_src, re.S)
CL = json.loads(m.group(1))
CL['2024'] = CL_2024
open(classes_path, 'w').write('window.DY_HCLASS = %s;\n' % json.dumps(CL, separators=(',', ':'), ensure_ascii=False))
print('fb-classes.js years now:', sorted(CL.keys(), key=int))
