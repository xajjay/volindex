"""Beta games data for basketball, baseball, softball, volleyball and soccer, plus trivia for every sport.

Inputs: tools/games_ut_<sport>.txt (season stats copied from utsports.com) and tools/games_trivia.py (hand-written questions).
Called by tools/build_games.py, which writes everything into data/games-data.js.
"""
import collections, os, random, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import games_trivia as T

# stats columns in each file (see the header line of each file)
COLS = {
    'mbb': ['gp', 'pts', 'reb', 'ast', 'stl', 'blk', 'tpm', 'fgp'],
    'wbb': ['gp', 'pts', 'reb', 'ast', 'stl', 'blk', 'tpm', 'fgp'],
    'baseball': ['gp', 'ab', 'h', 'hr', 'rbi', 'r', 'sb', 'avg', 'app', 'w', 'l', 'era', 'ip', 'so', 'sv'],
    'softball': ['gp', 'ab', 'h', 'hr', 'rbi', 'r', 'sb', 'avg', 'app', 'w', 'l', 'era', 'ip', 'so', 'sv'],
    'volleyball': ['sp', 'k', 'a', 'd', 'b', 'sa', 'hp'],
    'soccer': ['gp', 'g', 'a', 'pts', 'sv', 'sho', 'gaa', 'w'],
}
NAME = {'mbb': "Men's basketball", 'wbb': "Women's basketball", 'baseball': 'Baseball', 'softball': 'Softball', 'volleyball': 'Volleyball', 'soccer': 'Soccer'}

STATE = {'tenn': 'TN', 'tn': 'TN', 'ga': 'GA', 'n.c': 'NC', 'nc': 'NC', 'calif': 'CA', 'ohio': 'OH', 'fla': 'FL', 'texas': 'TX', 'tx': 'TX',
         'ala': 'AL', 'al': 'AL', 'ky': 'KY', 'mo': 'MO', 'md': 'MD', 'va': 'VA', 'ill': 'IL', 'mich': 'MI', 'colo': 'CO', 'ore': 'OR',
         'nev': 'NV', 'wash': 'WA', 'pa': 'PA', 'n.j': 'NJ', 'nj': 'NJ', 'n.y': 'NY', 'ny': 'NY', 'wis': 'WI', 'wisc': 'WI', 'minn': 'MN',
         'iowa': 'IA', 'kan': 'KS', 'neb': 'NE', 'okla': 'OK', 'ok': 'OK', 'la': 'LA', 's.c': 'SC', 'sc': 'SC', 'miss': 'MS', 'ms': 'MS',
         'ind': 'IN', 'conn': 'CT', 'n.m': 'NM', 'mass': 'MA', 'n.h': 'NH', 's.d': 'SD', 'hawaii': 'HI', 'ariz': 'AZ', 'az': 'AZ',
         'ark': 'AR', 'md.': 'MD', 'w.va': 'WV', 'del': 'DE', 'ga.': 'GA', 'mo.': 'MO'}
def state(s):
    if not s: return None
    k = s.strip().lower().rstrip('.')
    return STATE.get(k, STATE.get(k + '.', s.strip()))

def start_year(season):            # '2015-16' -> 2015 ; '2024' -> 2024
    return int(str(season)[:4])

def coach(sport, season):
    y = start_year(season)
    if sport == 'mbb':
        if y <= 1988: return 'Don DeVoe'
        if y <= 1993: return 'Wade Houston'
        if y <= 1996: return "Kevin O'Neill"
        return 'Jerry Green' if y <= 2000 else 'Buzz Peterson' if y <= 2004 else 'Bruce Pearl' if y <= 2010 else 'Cuonzo Martin' if y <= 2013 else 'Donnie Tyndall' if y == 2014 else 'Rick Barnes'
    if sport == 'wbb':
        return 'Pat Summitt' if y <= 2011 else 'Holly Warlick' if y <= 2018 else 'Kellie Harper' if y <= 2023 else 'Kim Caldwell'
    if sport == 'baseball':
        return 'Rod Delmonico' if y <= 2007 else 'Todd Raleigh' if y <= 2011 else 'Dave Serrano' if y <= 2017 else 'Tony Vitello' if y <= 2025 else 'Josh Elander'
    if sport == 'softball':
        return 'The Weeklys' if y <= 2018 else 'Karen Weekly'
    if sport == 'volleyball':
        return 'Rob Patrick' if y <= 2016 else 'Eve Rackham Watt'
    return None

def num(v):
    v = v.strip()
    if v == '': return None
    try:
        f = float(v); return int(f) if f.is_integer() and '.' not in v else f
    except ValueError: return None

def parse(sport):
    rows, records = [], {}
    hist = os.path.join(HERE, f'games_hist_{sport}.txt')
    if os.path.exists(hist):
        rows, records = (parse_stat_leaders(hist) if sport == 'baseball' and 'category|' in open(hist).read(400) else parse_file(hist, sport))
    have = set(records) | {r['s'] for r in rows}
    r2, rec2 = parse_file(os.path.join(HERE, f'games_ut_{sport}.txt'), sport)
    rows += [r for r in r2 if r['s'] not in have]          # a full season from the history file replaces a partial one
    records.update({k: v for k, v in rec2.items() if k not in have})
    return rows, records

def parse_stat_leaders(path):
    """year|category|value|player from a record book's year-by-year leaders (baseball)"""
    HIT = {'Batting Average': 'avg', 'Hits': 'h', 'Runs Batted In': 'rbi', 'Home Runs': 'hr', 'Stolen Bases': 'sb'}
    PIT = {'Wins': 'w', 'ERA': 'era', 'Innings Pitched': 'ip', 'Strikeouts': 'so'}
    acc = collections.OrderedDict()
    for line in open(path, encoding='utf-8'):
        if not line.strip() or line.startswith('#'): continue
        y, cat, val, n = line.rstrip('\n').split('|')
        if ',' in n: continue
        if cat in HIT: k, key = 'H', HIT[cat]
        elif cat in PIT: k, key = 'P', PIT[cat]
        else: continue
        r = acc.setdefault((y, n, k), dict(n=n, s=y, pos='P' if k == 'P' else '', home=None, prev=None, st={}))
        r['st'][key] = num(val)
    rows = list(acc.values())
    for r in rows:   # hitters need an at-bat marker so they read as hitters
        if r['pos'] != 'P': r['st'].setdefault('ab', 0)
    return rows, {}

def parse_hoops_leaders(path):
    """season|name|pos|class|ppg|gp|pts|reb|ast|blk|stl from the men's record book (top scorers + stat leaders)"""
    rows, records, games = [], {}, {}
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip() or line.startswith('# '): continue
        if line.startswith('#'):
            season, rec = line[1:].split('|', 1); records[season] = rec.strip()
            w, l = re.match(r'(\d+)-(\d+)', rec.strip()).groups(); games[season] = int(w) + int(l); continue
        season, n, pos, cls, ppg, gp, pts, reb, ast, blk, stl = line.split('|')
        gp = num(gp) or games.get(season)
        st = {'gp': gp}
        if num(pts) is not None: st['pts'] = num(pts)
        elif num(ppg) is not None and gp: st['pts'] = round(num(ppg) * gp)
        for k, v in (('reb', reb), ('ast', ast), ('blk', blk), ('stl', stl)):
            if num(v) is not None: st[k] = num(v)
        rows.append(dict(n=n.strip(), s=season, pos=pos.strip(), home=None, prev=None, st=st))
    return rows, records

def parse_file(path, sport):
    rows, records = [], {}
    season = None
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip() or line.startswith('# '): continue
        if line.startswith('#'):
            season, rec = line[1:].split('|', 1); records[season] = rec.strip(); continue
        parts = line.split('|'); n, pos, st_, prev, stats = parts[:5]
        draft = parts[5].strip() if len(parts) > 5 and parts[5].strip() else None   # baseball: MLB draft "2016 rd 1"
        vals = stats.split(',')
        st = {}
        for k, v in zip(COLS[sport], vals):
            x = num(v)
            if x is not None: st[k] = x
        rows.append(dict(n=n.strip(), s=season, pos=pos.strip(), home=state(st_), prev=prev.strip() or None, st=st, draft=draft))
    return rows, records

def kind(sport, r):
    st = r['st']
    if sport in ('baseball', 'softball'): return 'P' if r.get('pos') == 'P' and not st.get('ab') else 'H' if 'ab' in st or 'avg' in st else 'P'
    if sport == 'soccer': return 'GK' if 'sv' in st else 'F'
    return 'X'

def score(sport, r):
    st, k = r['st'], r['k']
    g = lambda x: st.get(x) or 0
    if sport in ('mbb', 'wbb'):
        gp = max(1, g('gp')); return (g('pts') + .8 * g('reb') + 1.1 * g('ast') + 1.5 * (g('stl') + g('blk'))) / gp
    if sport in ('baseball', 'softball'):
        if k == 'H': return g('avg') * 100 + g('hr') * 1.3 + g('rbi') * .35 + g('sb') * .2 + g('r') * .2
        return g('ip') * .12 + g('so') * .08 + g('w') * 1.5 + g('sv') * 1.0 - g('era') * 4 + 20
    if sport == 'volleyball':
        sp = max(1, g('sp')); return (g('k') + 1.3 * g('b') + 1.2 * g('sa') + .12 * g('a') + .35 * g('d')) / sp
    if sport == 'soccer':
        if k == 'GK': return g('sho') * 2 + g('w') * 1.2 - g('gaa') * 6 + 20
        return g('pts') + g('g')
    return 0

def line_text(sport, r):
    """short readable stat line for cards and trivia"""
    st, k = r['st'], r['k']
    f = lambda v: f'{v:,}' if isinstance(v, int) else (f'{v:.3f}'.lstrip('0') if isinstance(v, float) and v < 1 else str(v))
    parts = []
    def add(key, label):
        if st.get(key) not in (None, 0): parts.append(f'{f(st[key])} {label}')
    if sport in ('mbb', 'wbb'):
        gp = st.get('gp') or 1
        parts.append(f"{st.get('pts', 0) / gp:.1f} ppg")
        if st.get('reb') is not None: parts.append(f"{st['reb'] / gp:.1f} rpg")
        if st.get('ast') is not None: parts.append(f"{st['ast'] / gp:.1f} apg")
        if st.get('tpm', 0) >= 40: add('tpm', '3-pointers')
        if st.get('blk', 0) >= 40: add('blk', 'blocks')
    elif sport in ('baseball', 'softball'):
        if k == 'H':
            if st.get('avg') is not None: parts.append(f"{f(st['avg'])} avg")
            add('hr', 'HR'); add('rbi', 'RBI')
            if st.get('sb', 0) >= 15: add('sb', 'SB')
        else:
            if st.get('w') is not None: parts.append(f"{st.get('w', 0)}-{st.get('l', 0)}")
            if st.get('era') is not None: parts.append(f"{st['era']:.2f} ERA")
            add('so', 'K'); add('ip', 'IP')
            if st.get('sv', 0) >= 4: add('sv', 'saves')
    elif sport == 'volleyball':
        add('k', 'kills'); add('a', 'assists'); add('d', 'digs'); add('b', 'blocks')
        if st.get('sa', 0) >= 25: add('sa', 'aces')
    elif sport == 'soccer':
        if k == 'GK':
            add('sv', 'saves'); add('sho', 'shutouts')
            if st.get('gaa') is not None: parts.append(f"{st['gaa']:.2f} GAA")
        else:
            add('g', 'goals'); add('a', 'assists'); add('pts', 'points')
    return ' · '.join(parts)


# ---------------- honors + pro draft (tools/games_awards_sports.txt) ----------------
_AW = None
NAME_FIX = {'kevinpunterjr': 'kevinpunter', 'vincentjackson': 'vincejackson'}   # honors list name -> name in the season data
def _nm(n):
    k = re.sub(r'[^a-z0-9]', '', n.lower().replace('’', "'"))
    return NAME_FIX.get(k, k)
def awards():
    global _AW
    if _AW is not None: return _AW
    _AW = collections.defaultdict(list)
    for line in open(os.path.join(HERE, 'games_awards_sports.txt'), encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'): continue
        sp, yr, n, code = line.split('|')
        _AW[(sp, _nm(n))].append((int(yr), code))
    return _AW
LEAGUE = {'mbb': 'NBA', 'wbb': 'WNBA', 'baseball': 'MLB', 'softball': None, 'volleyball': None, 'soccer': None}
def pro_of(sport, n):
    for yr, code in awards().get((sport, _nm(n)), []):
        if code.startswith('D:'):
            rd, pk = code[2:].split('/'); return dict(lg=LEAGUE[sport], y=yr, rd=int(rd), pick=int(pk))
    return None
def draft_pts(sport, d):
    rd, pk = d['rd'], d['pick']
    if sport == 'baseball':
        if rd == 1 or (pk and pk <= 42 and rd <= 1): return 8 if pk <= 5 else 7 if pk <= 15 else 6
        return {2: 5, 3: 4, 4: 3, 5: 3}.get(rd, 2 if rd <= 10 else 1 if rd <= 20 else 0)
    if sport == 'mbb':
        return 8 if pk <= 5 else 7 if pk <= 14 else 6 if rd == 1 else 4
    return 8 if pk and pk <= 5 else 6 if rd == 1 else 4 if rd == 2 else 2 if rd == 3 else 1   # WNBA
AWARD_PTS = {'AA1': 7, 'AA2': 4, 'AAH': 2, 'SEC': 3, 'SEC2': 1.5, 'POY': 3.5, 'PPOY': 3.5}
LEGENDS = {('wbb', 'chamiqueholdsclaw'), ('wbb', 'candaceparker'), ('softball', 'monicaabbott'), ('softball', 'karlynpickens'), ('mbb', 'daltonknecht'), ('baseball', 'christianmoore')}
def season_end(sport, s): return start_year(s) + (1 if sport in ('mbb', 'wbb') else 0)
def rate_rows(sport, rows):
    if sport not in ('mbb', 'wbb', 'baseball', 'softball'):
        for r in rows: r['ovr'] = round(60 + 35 * r['pct'])
        return
    A = awards(); last = {}
    for r in rows: last[r['n']] = max(last.get(r['n'], 0), season_end(sport, r['s']))
    for r in rows:
        ye, mine = season_end(sport, r['s']), A.get((sport, _nm(r['n'])), [])
        hon = [c for y, c in mine if y == ye and not c.startswith('D:')]
        aw = sum(AWARD_PTS.get(c, 4 if c.startswith('W:') else 1.5 if c.startswith('F:') else 0) for c in hon)
        aw = min(11, aw)
        d = pro_of(sport, r['n'])
        dr = draft_pts(sport, d) if d else 0
        if d and ye != last[r['n']]: dr = dr / 2            # earlier seasons get half the draft credit
        prod = round(24 * r['pct'], 1)
        raw = 62 + prod + aw + dr
        ovr = raw if raw <= 95 else 95 + (raw - 95) * 0.4
        floor = 0
        if 'AA1' in hon: floor = max(floor, 88)
        if 'AA2' in hon: floor = max(floor, 84)
        if 'SEC' in hon or 'POY' in hon or 'PPOY' in hon: floor = max(floor, 83)
        if d and ye == last[r['n']]:
            floor = max(floor, 87 if d['pick'] and d['pick'] <= 5 else 85 if d['rd'] == 1 else 82 if d['rd'] == 2 else 79 if d['rd'] == 3 else 0)
        fl = floor if floor > ovr else 0
        r['ovr'] = min(98, round(max(ovr, floor)))
        r['hon'] = hon
        r['rb'] = [prod, round(aw, 1), round(dr, 1), fl]
    for leg in LEGENDS:
        if leg[0] != sport: continue
        mine = [r for r in rows if _nm(r['n']) == leg[1]]
        if mine: max(mine, key=lambda r: (r['ovr'], r['pct']))['ovr'] = 99
    matched = {(sp, n) for (sp, n) in A if sp == sport}
    have = {_nm(r['n']) for r in rows}
    miss = sorted(n for sp, n in matched if n not in have)
    if miss: print(f'  {sport}: {len(miss)} honored players not in the season data (not top-N that year):', ', '.join(miss[:12]), '...' if len(miss) > 12 else '')

def build_sport(sport):
    rows, records = parse(sport)
    for r in rows:
        r['k'] = kind(sport, r); r['raw'] = score(sport, r)
    # rating (same build as football's 16-0): 62 + production (0-24, percentile inside the sport and hitter/pitcher)
    # + awards (0-11) + pro draft (0-8); above 95 each point counts 40%, ceiling 98; floors for big honors; 99 for legends
    by = collections.defaultdict(list)
    for r in rows: by[r['k']].append(r)
    for k, rs in by.items():
        vals = sorted(x['raw'] for x in rs)
        for r in rs:
            below = sum(1 for v in vals if v < r['raw']); r['pct'] = below / max(1, len(vals) - 1)
    rate_rows(sport, rows)
    players = collections.defaultdict(list)
    for r in rows: players[r['n']].append(r)
    out = []
    for n, rs in players.items():
        best = max(rs, key=lambda r: (r['ovr'], r['s']))
        seasons = sorted({r['s'] for r in rs})
        out.append(dict(n=n, pos=best['pos'] or next((r['pos'] for r in rs if r['pos']), ''), k=best['k'], s=best['s'], y=start_year(best['s']),
                        ovr=best['ovr'], st=best['st'], line=line_text(sport, best),
                        home=next((r['home'] for r in rs if r['home']), None), prev=next((r['prev'] for r in rs if r['prev']), None),
                        coach=coach(sport, best['s']), seasons=seasons, ys=[start_year(x) for x in seasons],
                        honAll=sorted({h for r in rs for h in r.get('hon', [])}), rb=best.get('rb'),
                        **({'pro': pro_of(sport, n)} if pro_of(sport, n) else {}),
                        **({'draft': next(r['draft'] for r in rs if r.get('draft'))} if any(r.get('draft') for r in rs) else {})))
    out.sort(key=lambda p: (-p['ovr'], p['n']))
    def per_game(st):
        if sport not in ('mbb', 'wbb') or not st.get('gp'): return st
        st = dict(st)
        for k, pk in (('pts', 'ppg'), ('reb', 'rpg'), ('ast', 'apg')):
            if st.get(k) is not None: st[pk] = round(st[k] / st['gp'], 1)
        return st
    # every season line carries its own rating, readable stat line and head coach (the undefeated-run drafts use season lines)
    srows = [dict(n=r['n'], s=r['s'], y=start_year(r['s']), k=r['k'], pos=r['pos'], st=per_game(r['st']), ovr=r['ovr'],
                  line=line_text(sport, r), coach=coach(sport, r['s']), **({'hon': r['hon']} if r.get('hon') else {}), **({'rb': r['rb']} if r.get('rb') else {})) for r in rows]
    return dict(name=NAME[sport], players=out, rows=srows, records=records,
                first=min({r['s'] for r in rows}, key=start_year), last=max({r['s'] for r in rows}, key=start_year))

def build_all():
    return {s: build_sport(s) for s in COLS}

# ------------------------------------------------------------------------------------------------
# Trivia
# ------------------------------------------------------------------------------------------------
YEAR_RE = re.compile(r'\b(19[89]\d|20[0-2]\d)\b')
def curated(sport):
    out = []
    for d, q, a, w, *rest in T.TRIVIA.get(sport, []):
        m = YEAR_RE.search(q + ' ' + a)
        out.append(dict(d=d, q=q, a=a, w=list(w), y=int(m.group(1)) if m else None, src='curated'))
    return out

def fb_line(p):
    st, s = p['st'], p['slot']
    g = lambda k: st.get(k) or 0
    f = lambda v: f'{int(v):,}' if float(v).is_integer() else str(v)
    if s == 'QB': return f"{f(g('yds'))} passing yards, {f(g('td'))} TD, {f(g('int'))} INT"
    if s == 'RB': return f"{f(g('ryds'))} rushing yards, {f(g('rtd'))} TD" + (f", {f(g('cyds'))} receiving yards" if g('cyds') >= 150 else '')
    if s in ('WR', 'TE'): return f"{f(g('rec'))} catches, {f(g('cyds'))} yards, {f(g('ctd'))} TD"
    parts = []
    if g('tot'): parts.append(f"{f(g('tot'))} tackles")
    if g('tfl'): parts.append(f"{f(g('tfl'))} TFL")
    if g('sk'): parts.append(f"{f(g('sk'))} sack" + ('' if g('sk') == 1 else 's'))
    if g('ints'): parts.append(f"{f(g('ints'))} INT")
    return ', '.join(parts)

POS_WORD = {'QB': 'quarterback', 'RB': 'running back', 'WR': 'receiver', 'TE': 'tight end', 'DL': 'defensive tackle', 'EDGE': 'edge rusher', 'LB': 'linebacker', 'CB': 'cornerback', 'S': 'safety'}

def football_generated(players, rng):
    qs = []
    full = [p for p in players if p['pool'] and len(p['st']) >= 3 and fb_line(p)]
    for p in full:
        if not (p.get('star') or p['ovr'] >= 84): continue
        same = [x for x in full if x['slot'] == p['slot'] and x['n'] != p['n'] and abs(x['y'] - p['y']) <= 10]
        same.sort(key=lambda x: (not x.get('star'), abs(x['y'] - p['y'])))
        if len(same) < 3: continue
        wrong = rng.sample(same[:8], 3)
        famous = p.get('star') and (p['ovr'] >= 90 or any(h[:2] in ('AA', 'W:', 'H2', 'H5') for h in p['honAll']))
        d = 'easy' if famous and p['y'] >= 1995 else 'medium' if p.get('star') else 'hard'
        qs.append(dict(d=d, q=f"Which Vol {POS_WORD[p['slot']]} had this {p['y']} season: {fb_line(p)}?", a=p['n'], w=[x['n'] for x in wrong], y=p['y'], src='stats'))
    return qs

SHE = {'wbb', 'softball', 'volleyball', 'soccer'}
LEAD = {   # season-leader questions only for stats our season lists are sure to include the leader of (lists are each year's top players)
    'mbb': [('pts', 'points', 0), ('reb', 'rebounds', 200)], 'wbb': [('pts', 'points', 0), ('reb', 'rebounds', 220)],
    'baseball': [('h', 'hits', 0), ('w', 'wins (pitching)', 6)], 'softball': [('h', 'hits', 0), ('w', 'wins (pitching)', 10)],
    'volleyball': [('k', 'kills', 250), ('a', 'assists', 600), ('d', 'digs', 250)], 'soccer': [('g', 'goals', 5), ('pts', 'points', 12)]}
HOW_MANY = {'mbb': [('ppg', 'points per game'), ('rpg', 'rebounds per game')], 'wbb': [('ppg', 'points per game'), ('rpg', 'rebounds per game')],
            'baseball': [('hr', 'home runs'), ('avg', 'batting average'), ('so', 'strikeouts'), ('w', 'wins')],
            'softball': [('hr', 'home runs'), ('avg', 'batting average'), ('so', 'strikeouts'), ('w', 'wins')],
            'volleyball': [('k', 'kills'), ('d', 'digs'), ('a', 'assists')], 'soccer': [('g', 'goals'), ('pts', 'points')]}
CAP = {'stats': 26, 'leader': 34, 'howmany': 22, 'when': 18, 'mates': 16, 'coach': 8, 'record': 10, 'honor': 40, 'draft': 18, 'transfer': 8, 'best': 3}
def _fmt(k, v):
    if k == 'avg': return f'{v:.3f}'.lstrip('0')
    if isinstance(v, float) and not float(v).is_integer(): return f'{v:.1f}'
    return f'{int(v):,}'
def _wrong_nums(rng, k, v):
    out = set()
    for _ in range(60):
        if len(out) == 3: break
        if k == 'avg': x = round(v + rng.choice([-1, 1]) * rng.uniform(.018, .07), 3)
        elif isinstance(v, float) and not float(v).is_integer(): x = round(v * rng.uniform(.72, 1.3), 1)
        else: x = max(0, round(v + rng.choice([-1, 1]) * max(1, round(v * rng.uniform(.12, .35)))))
        if _fmt(k, x) != _fmt(k, v): out.add(_fmt(k, x))
    return list(out)
def sport_generated(sport, data, rng):
    by_t = collections.defaultdict(list)
    def add(t, **q): by_t[t].append(dict(src='stats', **q))
    ps = data['players']; n = len(ps); rows = data['rows']
    rank = {p['n']: i / max(1, n - 1) for i, p in enumerate(ps)}       # 0 = best
    fame = lambda name, y: 'easy' if rank.get(name, 1) <= .2 or (rank.get(name, 1) <= .4 and y >= 2014) else 'medium' if rank.get(name, 1) <= .6 else 'hard'
    pron = 'she' if sport in SHE else 'he'
    # A. which Vol posted this season line (capped, best players first)
    for p in ps:
        if not p['line']: continue
        same = [x for x in ps if x['k'] == p['k'] and x['n'] != p['n'] and abs(x['y'] - p['y']) <= 6]
        same.sort(key=lambda x: abs(x['y'] - p['y']))
        if len(same) < 3: continue
        add('stats', d=fame(p['n'], p['y']), q=f"Which Vol posted this {p['s']} season: {p['line']}?", a=p['n'], w=[x['n'] for x in rng.sample(same[:7], 3)], y=p['y'])
    # B. season leaders
    seasons = collections.defaultdict(list)
    for r in rows: seasons[r['s']].append(r)
    for s_, rs in seasons.items():
        for k, label, floor in LEAD.get(sport, []):
            vals = [r for r in rs if r['st'].get(k) not in (None, '')]
            if len(vals) < 4: continue
            vals.sort(key=lambda r: -float(r['st'][k]))
            if float(vals[0]['st'][k]) == float(vals[1]['st'][k]) or float(vals[0]['st'][k]) < floor: continue
            top = vals[0]
            add('leader', d=fame(top['n'], start_year(s_)), q=f"Who led Tennessee in {label} in {s_}?", a=top['n'], w=[r['n'] for r in rng.sample(vals[1:6], 3)], y=start_year(s_))
    # C. how many: one number from a well-known season
    for r in sorted(rows, key=lambda r: -(r.get('ovr') or 0))[:60]:
        for k, label in HOW_MANY.get(sport, []):
            v = r['st'].get(k)
            if v in (None, '', 0): continue
            if k == 'avg' and r['k'] != 'H': continue
            if k in ('so', 'w') and r['k'] != 'P': continue
            ws = _wrong_nums(rng, k, float(v) if k == 'avg' or isinstance(v, float) else v)
            if len(ws) < 3: continue
            what = {'avg': f"What did {r['n']} hit in {r['s']}?", 'ppg': f"How many points per game did {r['n']} average in {r['s']}?", 'rpg': f"How many rebounds per game did {r['n']} average in {r['s']}?"}.get(k, f"How many {label} did {r['n']} have in {r['s']}?")
            add('howmany', d='hard' if rank.get(r['n'], 1) > .2 else 'medium', q=what, a=_fmt(k, float(v) if k == 'avg' else v), w=ws, y=r['y'])
            break
    # D. which season (multi-season players)
    by_n = collections.defaultdict(list)
    for r in rows: by_n[r['n']].append(r)
    for nme, rs in by_n.items():
        if len(rs) < 2: continue
        best = max(rs, key=lambda r: r.get('ovr') or 0)
        others = sorted({r['s'] for r in rs if r['s'] != best['s']} | {x for x in seasons if abs(start_year(x) - best['y']) <= 3 and x != best['s']}, key=lambda x: abs(start_year(x) - best['y']))
        if len(others) < 3 or not best.get('line'): continue
        add('when', d=fame(nme, best['y']), q=f"In which season did {nme} put up {best['line']}?", a=best['s'], w=rng.sample(others[:5], 3), y=best['y'])
    # E. teammates
    for nme, rs in by_n.items():
        r = max(rs, key=lambda r: r.get('ovr') or 0)
        mates = [x['n'] for x in seasons[r['s']] if x['n'] != nme]
        far = sorted({x['n'] for x in rows if abs(x['y'] - r['y']) >= 6 and x['n'] not in mates and x['n'] != nme})
        if not mates or len(far) < 3 or rank.get(nme, 1) > .5: continue
        add('mates', d='medium', q=f"Which of these players was a teammate of {nme} in {r['s']}?", a=rng.choice(mates), w=rng.sample(far, 3), y=r['y'])
    # F. coach of a season
    coaches = sorted({r['coach'] for r in rows if r.get('coach')})
    if len(coaches) >= 4:
        for s_ in rng.sample(sorted(seasons), min(12, len(seasons))):
            c = coach(sport, s_)
            if not c: continue
            add('coach', d='medium', q=f"Who was Tennessee's head coach in {s_}?", a=c, w=rng.sample([x for x in coaches if x != c], 3), y=start_year(s_))
    # G. records
    recs = {s_: r.split(',')[0].strip() for s_, r in data['records'].items() if r}
    rec_list = sorted(set(recs.values()))
    for s_ in rng.sample(sorted(recs), min(12, len(recs))):
        wr = [x for x in rec_list if x != recs[s_]]
        if len(wr) < 3: continue
        add('record', d='hard', q=f"What was Tennessee's overall record in {s_}?", a=recs[s_], w=rng.sample(wr, 3), y=start_year(s_))
    def pct(rec):
        m = re.match(r'(\d+)-(\d+)(?:-(\d+))?', rec or '')
        if not m: return None
        w, l, t = int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)
        return (w + t / 2) / max(1, w + l + t)
    ranked = sorted([(s_, r) for s_, r in recs.items() if pct(r) is not None], key=lambda x: -pct(x[1]))
    allseas = [s_ for s_, _ in ranked]
    for s_, r in ranked[:3]:
        near = sorted([x for x in allseas if x != s_], key=lambda x: abs(start_year(x) - start_year(s_)))
        add('best', d='medium', q=f"Which Tennessee {data['name'].lower()} team finished {r}, one of the best records of the last 20 years?", a=s_, w=rng.sample(near[:6], 3), y=start_year(s_))
    # H. honors + pro drafts (tools/games_awards_sports.txt)
    A = [(yr, code, nme) for (sp, key), lst in awards().items() if sp == sport for yr, code in lst for nme in [next((r['n'] for r in rows if _nm(r['n']) == key), None)] if nme]
    names_by_year = collections.defaultdict(set)
    for r in rows: names_by_year[season_end(sport, r['s'])].add(r['n'])
    def decoys(yr, exclude):
        pool = sorted({x for y in range(yr - 4, yr + 5) for x in names_by_year.get(y, ())} - set(exclude))
        return rng.sample(pool, 3) if len(pool) >= 3 else None
    LBL = {'AA1': 'a first-team All-American', 'POY': 'SEC Player of the Year', 'PPOY': 'SEC Pitcher of the Year', 'SEC': 'first-team All-SEC'}
    for yr, code, nme in A:
        winners = [x[2] for x in A if x[0] == yr and x[1] == code]
        if code in LBL:
            w = decoys(yr, winners)
            if w: add('honor', d='easy' if code in ('POY', 'PPOY', 'AA1') and yr >= 2015 else 'medium' if code != 'SEC' else 'hard', q=f"Which Vol was {LBL[code]} in {yr}?", a=nme, w=w, y=yr)
        elif code.startswith('W:'):
            w = decoys(yr, winners)
            if w: add('honor', d='medium', q=f"Which Vol won the {code[2:]}{'' if 'Year' in code or 'Award' in code or 'Trophy' in code else ' award'} in {yr}?", a=nme, w=w, y=yr)
        elif code.startswith('D:') and LEAGUE.get(sport):
            rd, pk = code[2:].split('/'); lg = LEAGUE[sport]
            if int(pk) and int(rd) <= 2:
                w = decoys(yr, [nme])
                if w: add('draft', d='medium' if int(pk) <= 14 else 'hard', q=f"Which Vol went No. {int(pk)} overall in the {yr} {lg} draft?", a=nme, w=w, y=yr)
            if int(rd) <= 10:
                rounds = sorted({str(x) for x in ([1, 2, 3, 4] if lg != 'MLB' else [1, 2, 3, 4, 5, 6, 8, 10])} - {rd})
                add('draft', d='hard', q=f"In which round of the {yr} {lg} draft was {nme} taken?", a=rd, w=rng.sample(rounds, 3), y=yr)
    # multi-time All-SEC first team
    cnt = collections.Counter(n_ for yr, c, n_ in A if c == 'SEC')
    for nme, k in cnt.items():
        if k >= 2: add('honor', d='hard', q=f"How many times was {nme} named first-team All-SEC?", a=str(k), w=[str(x) for x in rng.sample([x for x in (1, 2, 3, 4, 5) if x != k], 3)], y=None)
    # I. transfers
    schools = sorted({p['prev'] for p in ps if p['prev']})
    for p in ps:
        if p['prev'] and len(schools) >= 4 and p['y'] >= 2018:
            add('transfer', d='hard', q=f"{p['n']} transferred to Tennessee. Where did {pron} play before?", a=p['prev'], w=rng.sample([x for x in schools if x != p['prev']], 3), y=p['y'])
    # cap each template so no single question shape dominates, and drop exact repeats
    out, seen = [], set()
    for t, qs in by_t.items():
        rng.shuffle(qs)
        for q in qs[:CAP.get(t, 20)]:
            if q['q'] in seen or q['a'] in q['w'] or len(set(q['w'])) < 3: continue
            seen.add(q['q']); q['t'] = t; out.append(q)
    return out

FB_LEAD = [('QB', 'yds', 'passing yards', 1500), ('RB', 'ryds', 'rushing yards', 600), ('WR', 'cyds', 'receiving yards', 500)]
def football_more(fb_players, rows, rng):
    """football: season leaders, how-many, which-season and teammate questions (1995 on, when full stats exist)"""
    by_t = collections.defaultdict(list)
    star = {p['n']: p for p in fb_players}
    fam = lambda n: 'easy' if star.get(n, {}).get('star') and star[n]['ovr'] >= 90 else 'medium' if star.get(n, {}).get('star') else 'hard'
    full = [r for r in rows if r['y'] >= 1995 and not r.get('partial')]
    years = collections.defaultdict(list)
    for r in full: years[r['y']].append(r)
    keymap = {'yds': 'QB', 'td': 'QB', 'ryds': 'RB', 'rtd': 'RB', 'cyds': 'WR', 'rec': 'WR', 'tot': None, 'sk': None, 'ints': None}
    for y, rs in years.items():
        for slot, k, label, floor in FB_LEAD:
            vals = sorted([r for r in rs if r['st'].get(k)], key=lambda r: -float(r['st'][k]))
            if len(vals) < 4 or float(vals[0]['st'][k]) == float(vals[1]['st'][k]) or float(vals[0]['st'][k]) < floor: continue
            top = vals[0]
            by_t['leader'].append(dict(d=fam(top['n']), q=f"Who led Tennessee in {label} in {y}?", a=top['n'], w=[r['n'] for r in rng.sample(vals[1:6], 3)], y=y))
    # how many: famous seasons
    HM = {'QB': [('yds', 'passing yards'), ('td', 'touchdown passes')], 'RB': [('ryds', 'rushing yards')], 'WR': [('cyds', 'receiving yards'), ('rec', 'catches')],
          'EDGE': [('sk', 'sacks')], 'DL': [('sk', 'sacks')], 'LB': [('tot', 'tackles')], 'CB': [('ints', 'interceptions')], 'S': [('ints', 'interceptions')]}
    for p in sorted(fb_players, key=lambda p: -p['ovr'])[:80]:
        r = next((x for x in full if x['n'] == p['n'] and x['y'] == p['y']), None)
        if not r: continue
        for k, label in HM.get(r['slot'], []):
            v = r['st'].get(k)
            if not v: continue
            ws = _wrong_nums(rng, k, v)
            if len(ws) == 3: by_t['howmany'].append(dict(d='hard' if p['ovr'] < 92 else 'medium', q=f"How many {label} did {p['n']} have in {p['y']}?", a=_fmt(k, v), w=ws, y=p['y'])); break
    # which season
    by_n = collections.defaultdict(list)
    for r in full: by_n[r['n']].append(r)
    for p in fb_players:
        rs = by_n.get(p['n'], [])
        if len(rs) < 2 or not star.get(p['n'], {}).get('star'): continue
        line = fb_line(p)
        if not line: continue
        others = sorted({r['y'] for r in rs if r['y'] != p['y']} | {p['y'] + d for d in (-2, -1, 1, 2)} - {p['y']}, key=lambda y: abs(y - p['y']))
        by_t['when'].append(dict(d=fam(p['n']), q=f"In which season did {p['n']} put up {line}?", a=str(p['y']), w=[str(x) for x in rng.sample(others[:5], 3)], y=p['y']))
    # teammates
    names = sorted({r['n'] for r in full})
    for p in fb_players:
        if not p.get('star') or p['y'] < 1995: continue
        mates = sorted({r['n'] for r in years.get(p['y'], []) if r['n'] != p['n'] and star.get(r['n'], {}).get('star')})
        far = sorted({r['n'] for r in full if abs(r['y'] - p['y']) >= 8 and star.get(r['n'], {}).get('star')})
        if mates and len(far) >= 3:
            by_t['mates'].append(dict(d='medium', q=f"Which of these Vols was a teammate of {p['n']} in {p['y']}?", a=rng.choice(mates), w=rng.sample(far, 3), y=p['y']))
    out, seen = [], set()
    for t, qs in by_t.items():
        rng.shuffle(qs)
        for q in qs[:{'leader': 45, 'howmany': 30, 'when': 25, 'mates': 25}[t]]:
            if q['q'] in seen or q['a'] in q['w'] or len(set(q['w'])) < 3: continue
            seen.add(q['q']); q['t'] = t; q['src'] = 'stats'; out.append(q)
    return out

def build_trivia(fb_players, season_rows_all, sports):
    rng = random.Random(1916)
    gen = football_generated(fb_players, rng)
    rng.shuffle(gen)
    out = {'football': curated('football') + gen[:45] + football_more(fb_players, season_rows_all, rng)}
    for sport, data in sports.items():
        out[sport] = curated(sport) + sport_generated(sport, data, rng)
    return out
