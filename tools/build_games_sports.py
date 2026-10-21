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

def build_sport(sport):
    rows, records = parse(sport)
    for r in rows:
        r['k'] = kind(sport, r); r['raw'] = score(sport, r)
    # rating 60..95 by percentile of production inside the sport (and hitter/pitcher, field/keeper)
    by = collections.defaultdict(list)
    for r in rows: by[r['k']].append(r)
    for k, rs in by.items():
        vals = sorted(x['raw'] for x in rs)
        for r in rs:
            below = sum(1 for v in vals if v < r['raw']); r['ovr'] = round(60 + 35 * below / max(1, len(vals) - 1))
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
                  line=line_text(sport, r), coach=coach(sport, r['s'])) for r in rows]
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

def sport_generated(sport, data, rng):
    qs = []
    ps = data['players']; n = len(ps)
    rank = {p['n']: i / max(1, n - 1) for i, p in enumerate(ps)}       # 0 = best
    for p in ps:
        if not p['line']: continue
        same = [x for x in ps if x['k'] == p['k'] and x['n'] != p['n'] and abs(x['y'] - p['y']) <= 6]
        same.sort(key=lambda x: abs(x['y'] - p['y']))
        if len(same) < 3: continue
        wrong = rng.sample(same[:7], 3)
        r = rank[p['n']]
        d = 'easy' if r <= .3 and p['y'] >= 2015 else 'medium' if r <= .6 else 'hard'
        qs.append(dict(d=d, q=f"Which Vol posted this {p['s']} season: {p['line']}?", a=p['n'], w=[x['n'] for x in wrong], y=p['y'], src='stats'))
    # transfers: where did she/he play before Tennessee?
    schools = sorted({p['prev'] for p in ps if p['prev']})
    for p in ps:
        if p['prev'] and len(schools) >= 4 and p['y'] >= 2018:
            wrong = rng.sample([s for s in schools if s != p['prev']], 3)
            qs.append(dict(d='hard', q=f"{p['n']} transferred to Tennessee. Where did {('she' if sport in ('wbb', 'softball', 'volleyball', 'soccer') else 'he')} play before?", a=p['prev'], w=wrong, y=p['y'], src='stats'))
    # best records
    def pct(rec):
        m = re.match(r'(\d+)-(\d+)(?:-(\d+))?', rec or '')
        if not m: return None
        w, l, t = int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)
        return (w + t / 2) / max(1, w + l + t)
    recs = [(s, r, pct(r)) for s, r in data['records'].items() if pct(r) is not None]
    recs.sort(key=lambda x: -x[2])
    seasons = [s for s, _, _ in recs]
    for s, r, _ in recs[:3]:
        overall = r.split(',')[0].strip()
        near = [x for x in seasons if x != s]
        near.sort(key=lambda x: abs(start_year(x) - start_year(s)))
        wrong = rng.sample(near[:6], 3)
        qs.append(dict(d='medium', q=f"Which Tennessee {data['name'].lower()} team finished {overall}, one of the best records of the last 20 years?", a=s, w=wrong, y=start_year(s), src='stats'))
    return qs

def build_trivia(fb_players, season_rows_all, sports):
    rng = random.Random(1916)
    out = {'football': curated('football') + football_generated(fb_players, rng)}
    for sport, data in sports.items():
        out[sport] = curated(sport) + sport_generated(sport, data, rng)
    return out
