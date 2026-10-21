"""Build data/games-data.js for The Vol Index games page.

Inputs (all in the repo):
  tools/games_curated.py   hand-curated record-book stats, honors, NFL careers, opponent teams
  tools/games_espn.txt     ESPN team-stat rows for 2004-2015 defense and 2004-2006 offense
  tools/cache/pstats-*.json  CollegeFootballData.com player season stats (2007-2025)

Run:  python tools/build_games.py
"""
import glob, json, os, re, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import games_curated as C

ALIAS = {'Joe Milton III': 'Joe Milton', 'John Kelly Jr.': 'John Kelly', 'Alexander Johnson': 'A.J. Johnson',
         "Dont'e Thornton": "Dont'E Thornton", 'Dont’E Thornton': "Dont'E Thornton"}
def nm(n): n = n.replace('’', "'"); return ALIAS.get(n, n)

OFF = ['QB', 'RB', 'WR', 'TE']; DEF = ['DL', 'EDGE', 'LB', 'CB', 'S']
seasons = collections.defaultdict(dict)   # (name, year) -> stat dict
srcpos = {}                               # (name, year) -> position from the source

# ---- CFBD 2007-2025 ----
for f in sorted(glob.glob(os.path.join(HERE, 'cache', 'pstats-*.json'))):
    for r in json.load(open(f)):
        y = r['season']; n = nm(r['player']); k = (n, y)
        try: v = float(r['stat'])
        except: continue
        cat, t = r['category'], r['statType']
        if y < 2009 and cat in ('passing', 'rushing', 'receiving'): continue   # CFBD offense is incomplete before 2009; ESPN covers 2004-08
        if y < 2016 and cat == 'defensive': continue                            # CFBD has no tackles before 2016
        m = {('passing', 'YDS'): 'yds', ('passing', 'TD'): 'td', ('passing', 'INT'): 'int', ('passing', 'COMPLETIONS'): 'cmp', ('passing', 'ATT'): 'att',
             ('rushing', 'YDS'): 'ryds', ('rushing', 'TD'): 'rtd', ('rushing', 'CAR'): 'car',
             ('receiving', 'REC'): 'rec', ('receiving', 'YDS'): 'cyds', ('receiving', 'TD'): 'ctd',
             ('defensive', 'TOT'): 'tot', ('defensive', 'SACKS'): 'sk', ('defensive', 'TFL'): 'tfl', ('defensive', 'PD'): 'pd',
             ('defensive', 'QB HUR'): 'hur', ('interceptions', 'INT'): 'ints', ('fumbles', 'FUM'): None}.get((cat, t))
        if not m: continue
        seasons[k][m] = v; srcpos.setdefault(k, r['position'])

# ---- ESPN 2004-2015 ----
for line in open(os.path.join(HERE, 'games_espn.txt')):
    line = line.strip()
    if not line or line.startswith('#'): continue
    p = line.split('|'); kind, y, n = p[0], int(p[1]), nm(p[2]); k = (n, y)
    if kind == 'D':
        pos, tot, sk, ints, ff = p[3], *map(float, p[4:8])
        d = seasons[k]; d.update(tot=tot, sk=sk, ff=ff); d['ints'] = max(d.get('ints', 0), ints); srcpos.setdefault(k, pos)
    elif kind == 'P':
        seasons[k].update(cmp=float(p[3]), att=float(p[4]), yds=float(p[5]), td=float(p[6]), int=float(p[7])); srcpos.setdefault(k, 'QB')
    elif kind == 'R':
        seasons[k].update(car=float(p[4]), ryds=float(p[5]), rtd=float(p[6])); srcpos.setdefault(k, p[3])
    elif kind == 'C':
        seasons[k].update(rec=float(p[4]), cyds=float(p[5]), ctd=float(p[6])); srcpos.setdefault(k, p[3])

# ---- utsports.com cumulative stats 1995-2008 (tools/games_ut_football.txt) ----
UT_KEYS = ['cmp', 'att', 'yds', 'td', 'int', 'car', 'ryds', 'rtd', 'rec', 'cyds', 'ctd', 'tot', 'tfl', 'sk', 'ints', 'pd', 'ff', 'hur']
POSMAP = {'QB': 'QB', 'RB': 'RB', 'TB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'DE': 'DE', 'DT': 'DT', 'NT': 'DT', 'DL': 'DT',
          'LB': 'LB', 'DB': 'DB', 'CB': 'DB', 'S': 'DB', 'FS': 'DB', 'SS': 'DB', 'ROV': 'DB'}
home = {}; prev_school = {}
ut_rows = {}
for line in open(os.path.join(HERE, 'games_ut_football.txt'), encoding='utf-8'):
    line = line.rstrip('\n')
    if not line.strip() or line.startswith('# '): continue
    if line.startswith('#'): yr = int(line[1:5]); continue
    n, pos, state, prev, stats = line.split('|'); n = nm(n)
    vals = stats.split(',')
    st = {}
    for key, v in zip(UT_KEYS, vals):
        if v.strip() == '': continue
        try: st[key] = float(v)
        except ValueError: pass
    ut_rows[(n, yr)] = (pos, st)
    if state: home.setdefault(n, state)
    if prev: prev_school.setdefault(n, prev)
early_keys = {(e[0], e[2]) for e in C.EARLY}
for k, (pos, st) in ut_rows.items():
    n, y = k
    offn = any(st.get(x, 0) for x in ('yds', 'ryds', 'cyds')); dfn = st.get('tot', 0) > 0
    toks = [POSMAP.get(t.strip().upper()) for t in pos.split('/') if POSMAP.get(t.strip().upper())]
    if len(toks) > 1:
        want_def = dfn and not offn
        toks = [t for t in toks if (t in ('DE', 'DT', 'LB', 'DB')) == want_def] or toks
    d = seasons[k]
    for a, b in st.items():
        d.setdefault(a, b)          # record book (1995-2003) and ESPN/CFBD (2004-08) values win; utsports fills the gaps
    if toks: srcpos.setdefault(k, toks[0])

# ---- record book 1980-2003 ----
early_slot = {}
for n, slot, y, st in C.EARLY:
    k = (n, y); seasons[k].update({a: float(b) for a, b in st.items()}); early_slot[k] = slot

def slot_of(k, st):
    n, y = k
    if k in early_slot: return early_slot[k]
    if n in C.SLOT: return C.SLOT[n]
    p = srcpos.get(k, '')
    if p == 'QB': return 'QB'
    if p in ('RB', 'FB'): return 'RB'
    if p == 'WR': return 'WR'
    if p == 'TE': return 'TE'
    if p in ('DE',): return 'EDGE'
    if p in ('DT', 'DL', 'NT'): return 'DL'
    if p in ('LB', 'OLB', 'ILB'): return 'LB'
    if p in ('DB', 'CB', 'S', 'FS', 'SS'): return 'S' if st.get('tot', 0) >= 60 else 'CB'
    return None

def g(st, k): return st.get(k, 0) or 0
def prod(slot, st, y):
    if slot == 'QB':
        pct = (g(st, 'cmp') / g(st, 'att')) if g(st, 'att') else .58
        return g(st, 'yds') / 40 + g(st, 'td') * 3 - g(st, 'int') * 2 + g(st, 'ryds') / 25 + g(st, 'rtd') * 3 + (pct - .58) * 150
    if slot == 'RB': return g(st, 'ryds') / 10 + g(st, 'rtd') * 6 + g(st, 'cyds') / 15 + g(st, 'ctd') * 6
    if slot in ('WR', 'TE'): return g(st, 'cyds') / 10 + g(st, 'rec') * .5 + g(st, 'ctd') * 6 + g(st, 'ryds') / 15 + g(st, 'rtd') * 6
    tfl = st.get('tfl', g(st, 'sk') * 1.6)          # TFL not tracked before 2016: estimate from sacks
    pd = st.get('pd', g(st, 'ints') + 3) if y < 2016 else g(st, 'pd')
    if slot == 'DL': return g(st, 'sk') * 7 + tfl * 3 + g(st, 'tot') * .9 + g(st, 'hur') * 1 + g(st, 'ff') * 3 + pd * 2 + g(st, 'ints') * 6   # interior: tackles count more
    if slot == 'EDGE': return g(st, 'sk') * 8 + tfl * 2.5 + g(st, 'tot') * .6 + g(st, 'hur') * 1 + g(st, 'ff') * 3 + g(st, 'ints') * 6
    if slot == 'LB': return g(st, 'tot') * .8 + g(st, 'sk') * 6 + tfl * 2 + g(st, 'ints') * 8 + pd * 2 + g(st, 'ff') * 3
    if slot == 'CB': return g(st, 'ints') * 12 + pd * 4 + g(st, 'tot') * .4 + g(st, 'ff') * 3
    if slot == 'S': return g(st, 'tot') * .5 + g(st, 'ints') * 10 + pd * 3 + g(st, 'ff') * 3 + g(st, 'sk') * 4
def qualifies(slot, st):
    if slot == 'QB': return g(st, 'att') >= 150 and g(st, 'yds') >= 1400
    if slot == 'RB': return g(st, 'ryds') >= 600 or g(st, 'ryds') + g(st, 'cyds') >= 850
    if slot == 'WR': return g(st, 'cyds') >= 550
    if slot == 'TE': return g(st, 'cyds') >= 250
    return g(st, 'tot') >= 60 or g(st, 'sk') >= 4 or g(st, 'ints') >= 3 or g(st, 'pd') >= 7

# ---- Overall rating (OVR) for one season ----
#   production  0-24  percentile of the season's production among every Vol at that game position (1980-today)
#   awards      0-11  All-America, All-SEC, SEC player of the year, national awards, Heisman finish
#   NFL draft   0-8   round he was drafted in (talent the scouts saw): 1st 8, 2nd 6, 3rd 4, 4th 3, 5th 2, 6th-7th 1
#   OVR = 62 + production + awards + draft, capped at 99, with floors for the biggest honors
#   (first-team All-American 88, second/third-team All-American 84, first-round pick 85, first-team All-SEC 83,
#   second-round pick 82, third-round pick 79).
HON_PTS = {'AAu': 8, 'AAc': 7, 'AA1': 5.5, 'AA2': 3, 'SEC': 3, 'SEC2': 1.5, 'POY': 4, 'OPOY': 3, 'DPOY': 3, 'H2': 4, 'H5': 2, 'H8': 1}
def hon_bonus(h):
    b = 0; aa = [x for x in h if x.startswith('AA')]
    if aa: b += max(HON_PTS[x] for x in aa)
    secs = [x for x in h if x in ('SEC', 'SEC2')]
    if secs: b += max(HON_PTS[x] for x in secs)
    for x in h:
        if x.startswith('AA') or x in ('SEC', 'SEC2'): continue
        if x.startswith('W:'): b += 4
        elif x.startswith('F:'): b += 1.5
        else: b += HON_PTS.get(x, 0)
    return min(b, 11)
DRAFT_PTS = {1: 8, 2: 6, 3: 4, 4: 3, 5: 2, 6: 1, 7: 1}
draft_rd = {}
for line in open(os.path.join(HERE, 'games_ut_draft.txt'), encoding='utf-8'):
    if not line.strip() or line.startswith('#'): continue
    n, last, dy, rd = line.strip().split('|'); draft_rd[nm(n)] = (int(dy), int(rd))
for v in C.VFL: draft_rd.setdefault(nm(v[0]), (v[3][0], v[3][1]))
for n, d in C.DRAFT_EXTRA.items(): draft_rd.setdefault(nm(n), tuple(d))
def floor_for(h, rd):
    f = 0
    if any(x in h for x in ('AAu', 'AAc', 'AA1')): f = max(f, 88)
    if 'AA2' in h: f = max(f, 84)
    if 'SEC' in h: f = max(f, 83)
    f = max(f, {1: 85, 2: 82, 3: 79}.get(rd, 0))
    return f

LEGENDS = {'Peyton Manning', 'Reggie White'}
# fan favorites that belong in Vol Guesser even without big honors
POPULAR = {'Nico Iamaleava', 'Tyler Bray', 'Joe Milton', 'Jabari Small', 'Jaylen Wright', 'Bru McCoy', 'Tee Martin', 'Casey Clausen', 'Erik Ainge', 'Jauan Jennings', 'Squirrel White', 'Joey Aguilar'}
rows = []
for k, st in seasons.items():
    n, y = k
    if y < 1980: continue
    slot = slot_of(k, st)
    if not slot: continue
    hon = C.HONORS.get(k, [])
    full = y >= 2004 or k in early_slot
    if not (qualifies(slot, st) or hon or k in early_slot): continue
    rows.append(dict(n=n, y=y, slot=slot, st=st, hon=hon, raw=prod(slot, st, y), partial=(k in early_slot and len(st) < 2)))
# honors for seasons with no stat line at all (e.g. linemen we don't track) are ignored unless curated in EARLY

# percentile of production inside each slot, plus awards and draft (see the OVR note above)
by = collections.defaultdict(list)
for r in rows: by[r['slot']].append(r)
for slot, rs in by.items():
    vals = sorted(r['raw'] for r in rs if not r['partial'])
    for r in rs:
        if r['partial']:
            pct = .65 if any(h in r['hon'] for h in ('AAu', 'AAc', 'AA1')) else .45
        else:
            below = sum(1 for v in vals if v < r['raw']); pct = below / max(1, len(vals) - 1)
        rd = draft_rd.get(r['n'], (None, None))[1]
        prod, aw, dr = 24 * pct, hon_bonus(r['hon']), DRAFT_PTS.get(rd, 0)
        raw = 62 + prod + aw + dr
        # above 95 the climb gets steeper (each extra point counts 40%) and 98 is the ceiling;
        # 99 is reserved for the two Pro Football Hall of Famers of the era, Peyton Manning and Reggie White
        ovr = raw if raw <= 95 else 95 + (raw - 95) * 0.4
        fl = floor_for(r['hon'], rd)
        ovr = min(98, max(ovr, fl))
        if r['n'] in LEGENDS and r['hon']: ovr = 99
        r['ovr'] = round(ovr)
        r['rb'] = [round(prod, 1), round(aw, 1), dr, fl if fl > raw else 0]

def coach(y):
    if y <= 1992: return 'Johnny Majors'
    if y <= 2008: return 'Phillip Fulmer'
    if y == 2009: return 'Lane Kiffin'
    if y <= 2012: return 'Derek Dooley'
    if y <= 2017: return 'Butch Jones'
    if y <= 2020: return 'Jeremy Pruitt'
    return 'Josh Heupel'

# group by player
players = collections.defaultdict(list)
for r in rows: players[r['n']].append(r)
vfl = {v[0]: v for v in C.VFL}
out = []
for n, rs in players.items():
    rs.sort(key=lambda r: (-r['ovr'], -r['y']))
    best = rs[0]
    pool_ok = best['ovr'] >= 78 or (best['slot'] == 'TE' and best['ovr'] >= 70) or bool(best['hon']) or n in vfl or bool(draft and 1 <= draft[1] <= 3)   # notable: rated 80+, honored, or a VFL with an NFL career
    hon_all = sorted({h for r in rs for h in r['hon']})
    v = vfl.get(n)
    draft = list(draft_rd[n]) if n in draft_rd else None
    yrs = sorted({r['y'] for r in rs})
    sts = [r['st'] for r in rs]
    fl = []   # career flags for Power T Grid
    if any(h in hon_all for h in ('AAu', 'AAc', 'AA1')): fl.append('aa')
    if 'SEC' in hon_all: fl.append('sec')
    if draft and draft[1] == 1: fl.append('r1')
    if draft and draft[1] >= 1: fl.append('drafted')
    if any(g(x, 'ryds') >= 1000 or g(x, 'cyds') >= 1000 for x in sts): fl.append('k1000')
    if any(g(x, 'sk') >= 10 for x in sts): fl.append('s10')
    if any(g(x, 'ints') >= 5 for x in sts): fl.append('i5')
    if any(g(x, 'tot') >= 100 for x in sts): fl.append('t100')
    if any(g(x, 'td') >= 25 for x in sts): fl.append('p25')
    if any(g(x, 'rtd') + g(x, 'ctd') >= 12 for x in sts): fl.append('td12')
    if v and v[4]: fl.append('nfl')
    # "star": the notable Vols that Vol Guesser draws answers from (award winners, All-Americans, first-team All-SEC,
    # early draft picks, big NFL names, or a top-rated season)
    star = (n in C.VFL_NOTABLE or any(h[:2] in ('AA', 'W:', 'F:', 'H2', 'H5', 'H8') or h in ('SEC', 'POY', 'OPOY', 'DPOY') for h in hon_all)
            or bool(draft and 1 <= draft[1] <= 2) or best['ovr'] >= 92 or (best['y'] >= 2010 and best['ovr'] >= 82) or n in POPULAR)
    before = C.BEFORE_UT.get(n) or prev_school.get(n)
    out.append(dict(
        n=n, slot=best['slot'], side='O' if best['slot'] in OFF else 'D', y=best['y'], ovr=best['ovr'], rb=best['rb'],
        st={a: (int(b) if float(b).is_integer() else b) for a, b in best['st'].items()}, hon=best['hon'], honAll=hon_all,
        seasons=[dict(y=r['y'], ovr=r['ovr']) for r in sorted(rs, key=lambda r: r['y'])],
        ut=(v[2] if v else (str(yrs[0]) if len(yrs) == 1 else f'{yrs[0]}-{str(yrs[-1])[2:]}')),
        coach=coach(best['y']), yrs=yrs, fl=fl, draft=draft, nfl=(v[4] if v else None), pool=pool_ok,
        **({'star': 1} if star else {}), **({'from': before} if before else {}), **({'home': home[n]} if n in home else {})))
out.sort(key=lambda p: (-p['ovr'], p['n']))

# season table for Rocky Top Rankings (every qualifying season, full stats only)
season_rows = [dict(n=r['n'], y=r['y'], slot=r['slot'], st={a: (int(b) if float(b).is_integer() else b) for a, b in r['st'].items()}) for r in rows if not r['partial']]

opps = [dict(id=f"{o[0]}-{re.sub('[^a-z]', '', o[1].lower())}", y=o[0], team=o[1], rec=o[2], sec=o[3], off=o[4], deff=o[5], stars=o[6], note=o[7]) for o in C.OPPONENTS]
careers = [dict(n=v[0], pos=v[1], ut=v[2], draft=dict(y=v[3][0], rd=v[3][1], pick=v[3][2]), teams=v[4],
                **({'from': C.BEFORE_UT.get(v[0]) or prev_school.get(v[0])} if (C.BEFORE_UT.get(v[0]) or prev_school.get(v[0])) else {}),
                **({'notable': 1} if v[0] in C.VFL_NOTABLE else {})) for v in C.VFL]

import build_games_sports as BS
sports = BS.build_all()
trivia = BS.build_trivia(out, season_rows_all=rows, sports=sports)

built = __import__('datetime').date.today().isoformat()
data = dict(built=built, players=out, seasons=season_rows, opponents=opps, careers=careers, trivia=trivia['football'],
            sports={k: dict(name=v['name'], first=v['first'], last=v['last'], players=len(v['players'])) for k, v in sports.items()})
for k, v in sports.items():   # one lazy-loaded file per beta sport
    v = dict(v, trivia=trivia[k], built=built)
    sjs = f'/* Written by tools/build_games.py from tools/games_ut_{k}.txt. Rerun instead of editing. */\nwindow.VI_GAMES_SPORT = window.VI_GAMES_SPORT || {{}};\nwindow.VI_GAMES_SPORT[{json.dumps(k)}] = ' + json.dumps(v, separators=(',', ':'), ensure_ascii=False) + ';\n'
    open(os.path.join(HERE, '..', 'data', f'games-{k}.js'), 'w', encoding='utf-8').write(sjs)
    print('wrote data/games-%s.js' % k, len(sjs))
js = '/* Written by tools/build_games.py. Edit tools/games_curated.py and rerun instead of editing this file. */\nwindow.VI_GAMES_DATA = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n'
dst = os.path.join(HERE, '..', 'data', 'games-data.js'); open(dst, 'w', encoding='utf-8').write(js)
pool = [p for p in out if p['pool']]
print('players', len(out), 'pool', len(pool), 'stars', sum(1 for p in out if p.get('star')), 'seasons', len(season_rows), 'bytes', len(js))
print('stars by decade', dict(sorted(collections.Counter(p['y']//10*10 for p in out if p.get('star')).items())))
print('notable careers', sum(1 for c in careers if c.get('notable')), dict(sorted(collections.Counter(int(c['ut'][:4])//10*10 for c in careers if c.get('notable')).items())))
for k, v in sports.items(): print(k, 'players', len(v['players']), 'seasons', len(v['rows']))
print('trivia', {k: collections.Counter(q['d'] for q in v) for k, v in trivia.items()})
for s in OFF + DEF:
    ps = [p for p in pool if p['slot'] == s]
    dec = collections.Counter(p['y'] // 10 * 10 for p in ps)
    print(s, len(ps), dict(sorted(dec.items())), ' | ', ', '.join(f"{p['n']} {p['y']} {p['ovr']}" for p in ps[:6]))

# ---------------------------------------------------------------------------------------------
# Player pages: data/players.js (one record per player per sport, every season we have)
# ---------------------------------------------------------------------------------------------
def slugify(n):
    s = re.sub(r"[’'.]", '', n.lower()); s = re.sub(r'[^a-z0-9]+', '-', s).strip('-'); return s
people = []
fb_seasons = collections.defaultdict(list)
for r in rows:
    fb_seasons[r['n']].append(dict(y=r['y'], s=str(r['y']), pos=r['slot'], ovr=r['ovr'], st={a: (int(b) if float(b).is_integer() else b) for a, b in r['st'].items()}, hon=r['hon']))
vfl_by = {c['n']: c for c in careers}
for p in out:
    c = vfl_by.get(p['n'])
    people.append(dict(sp='football', n=p['n'], slug=slugify(p['n']), pos=p['slot'], yrs=p['yrs'], ovr=p['ovr'], best=p['y'], hon=p['honAll'],
                       draft=p['draft'], nfl=(c['teams'] if c else p.get('nfl')), frm=p.get('from'), home=p.get('home'),
                       seasons=sorted(fb_seasons[p['n']], key=lambda x: x['y'])))
for k, v in sports.items():
    rs = collections.defaultdict(list)
    for r in v['rows']: rs[r['n']].append(dict(y=r['y'], s=r['s'], pos=r['pos'], k=r['k'], st=r['st']))
    for p in v['players']:
        people.append(dict(sp=k, n=p['n'], slug=slugify(p['n']), pos=p['pos'], yrs=p['ys'], ovr=p['ovr'], best=p['y'], bestS=p['s'], line=p['line'],
                           frm=p.get('prev'), home=p.get('home'), coach=p.get('coach'), mlb=p.get('draft'), seasons=sorted(rs[p['n']], key=lambda x: (x['y'], x['k']))))
seen = collections.Counter()
for p in people:   # unique slugs per sport
    key = (p['sp'], p['slug']); seen[key] += 1
    if seen[key] > 1: p['slug'] += '-' + str(seen[key])
pjs = '/* Written by tools/build_games.py: every player in the games data, for the player pages and the compare tool. */\nwindow.VI_PLAYERS = ' + json.dumps(dict(built=built, players=people), separators=(',', ':'), ensure_ascii=False) + ';\n'
open(os.path.join(HERE, '..', 'data', 'players.js'), 'w', encoding='utf-8').write(pjs)
json.dump([[p['sp'], p['slug'], p['n'], p['pos'], (str(p['yrs'][0]) + ('-' + str(p['yrs'][-1]) if len(p['yrs']) > 1 else '')) if p['yrs'] else ''] for p in people],
          open(os.path.join(HERE, 'players-index.json'), 'w'), ensure_ascii=False)   # used by tools/make_pages.py for player pages + sitemap
print('players.js', len(people), 'people', len(pjs), 'bytes')

# opponents for the 40-0 / 69-0 runs (real team-seasons from the schedule history files)
import build_run_opps
build_run_opps.main()
