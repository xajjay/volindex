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
    if slot in ('DL', 'EDGE'): return g(st, 'sk') * 8 + tfl * 2.5 + g(st, 'tot') * .4 + g(st, 'hur') * 1 + g(st, 'ff') * 3 + g(st, 'ints') * 6
    if slot == 'LB': return g(st, 'tot') * .8 + g(st, 'sk') * 6 + tfl * 2 + g(st, 'ints') * 8 + pd * 2 + g(st, 'ff') * 3
    if slot == 'CB': return g(st, 'ints') * 12 + pd * 4 + g(st, 'tot') * .4 + g(st, 'ff') * 3
    if slot == 'S': return g(st, 'tot') * .5 + g(st, 'ints') * 10 + pd * 3 + g(st, 'ff') * 3 + g(st, 'sk') * 4
def qualifies(slot, st):
    if slot == 'QB': return g(st, 'att') >= 150 and g(st, 'yds') >= 1400
    if slot == 'RB': return g(st, 'ryds') >= 600 or g(st, 'ryds') + g(st, 'cyds') >= 850
    if slot == 'WR': return g(st, 'cyds') >= 550
    if slot == 'TE': return g(st, 'cyds') >= 250
    return g(st, 'tot') >= 60 or g(st, 'sk') >= 4 or g(st, 'ints') >= 3 or g(st, 'pd') >= 7

HON_PTS = {'AAu': 8, 'AAc': 7, 'AA1': 5, 'AA2': 2, 'SEC': 2, 'POY': 4, 'OPOY': 3, 'DPOY': 3, 'H2': 4, 'H5': 2, 'H8': 1}
def hon_bonus(h):
    b = 0; aa = [x for x in h if x.startswith('AA')]
    if aa: b += max(HON_PTS[x] for x in aa)
    for x in h:
        if x.startswith('AA'): continue
        if x.startswith('W:'): b += 4
        elif x.startswith('F:'): b += 1.5
        else: b += HON_PTS.get(x, 0)
    return min(b, 12)

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

# percentile of production inside each slot -> 66..92, plus honors bonus
by = collections.defaultdict(list)
for r in rows: by[r['slot']].append(r)
for slot, rs in by.items():
    vals = sorted(r['raw'] for r in rs if not r['partial'])
    for r in rs:
        if r['partial']:
            base = 81 if any(h in r['hon'] for h in ('AAu', 'AAc', 'AA1')) else 77
        else:
            below = sum(1 for v in vals if v < r['raw']); pct = below / max(1, len(vals) - 1)
            base = 66 + 26 * pct
        r['ovr'] = round(min(99, base + hon_bonus(r['hon'])))

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
    pool_ok = best['ovr'] >= 80 or bool(best['hon']) or n in vfl   # notable: rated 80+, honored, or a VFL with an NFL career
    hon_all = sorted({h for r in rs for h in r['hon']})
    v = vfl.get(n)
    draft = None
    if v: draft = [v[3][0], v[3][1]]
    elif n in C.DRAFT_EXTRA: draft = list(C.DRAFT_EXTRA[n])
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
    out.append(dict(
        n=n, slot=best['slot'], side='O' if best['slot'] in OFF else 'D', y=best['y'], ovr=best['ovr'],
        st={a: (int(b) if float(b).is_integer() else b) for a, b in best['st'].items()}, hon=best['hon'], honAll=hon_all,
        seasons=[dict(y=r['y'], ovr=r['ovr']) for r in sorted(rs, key=lambda r: r['y'])],
        ut=(v[2] if v else (str(yrs[0]) if len(yrs) == 1 else f'{yrs[0]}-{str(yrs[-1])[2:]}')),
        coach=coach(best['y']), yrs=yrs, fl=fl, draft=draft, nfl=(v[4] if v else None), pool=pool_ok))
out.sort(key=lambda p: (-p['ovr'], p['n']))

# season table for Rocky Top Rankings (every qualifying season, full stats only)
season_rows = [dict(n=r['n'], y=r['y'], slot=r['slot'], st={a: (int(b) if float(b).is_integer() else b) for a, b in r['st'].items()}) for r in rows if not r['partial']]

opps = [dict(id=f"{o[0]}-{re.sub('[^a-z]', '', o[1].lower())}", y=o[0], team=o[1], rec=o[2], sec=o[3], off=o[4], deff=o[5], stars=o[6], note=o[7]) for o in C.OPPONENTS]
careers = [dict(n=v[0], pos=v[1], ut=v[2], draft=dict(y=v[3][0], rd=v[3][1], pick=v[3][2]), teams=v[4]) for v in C.VFL]

data = dict(built=__import__('datetime').date.today().isoformat(), players=out, seasons=season_rows, opponents=opps, careers=careers)
js = '/* Written by tools/build_games.py. Edit tools/games_curated.py and rerun instead of editing this file. */\nwindow.VI_GAMES_DATA = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n'
dst = os.path.join(HERE, '..', 'data', 'games-data.js'); open(dst, 'w', encoding='utf-8').write(js)
pool = [p for p in out if p['pool']]
print('players', len(out), 'pool', len(pool), 'seasons', len(season_rows), 'bytes', len(js))
for s in OFF + DEF:
    ps = [p for p in pool if p['slot'] == s]
    dec = collections.Counter(p['y'] // 10 * 10 for p in ps)
    print(s, len(ps), dict(sorted(dec.items())), ' | ', ', '.join(f"{p['n']} {p['y']} {p['ovr']}" for p in ps[:6]))
