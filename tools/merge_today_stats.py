"""
The Vol Index - refresh every team's real player stats for Start Today
======================================================================
Merges fresh Sports-Reference 2026 season lines (name|team-slug|gp:..,pc:..) into window.DY_TODAY_STATS in
data/hist/fb-2026.js. Offense/kicking/punting keys are replaced for every player in the pull; defensive keys
and players not in the pull keep what they had.

Run:  python tools/merge_today_stats.py sr1.txt sr2.txt sr3.txt [--asof 2026-11-08]
"""
import json, os, re, sys, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(ROOT, "data", "hist", "fb-2026.js")
def norm(n): return re.sub(r'[^a-z]', '', re.sub(r'\b(jr|sr|ii|iii|iv|v)\b\.?', '', (n or '').lower()))
SR_SLUG = {'miami-fl': 'Miami', 'miami-oh': 'Miami (OH)', 'louisiana-state': 'LSU', 'mississippi': 'Ole Miss', 'southern-california': 'USC', 'central-florida': 'UCF',
           'brigham-young': 'BYU', 'texas-christian': 'TCU', 'southern-methodist': 'SMU', 'alabama-birmingham': 'UAB', 'nevada-las-vegas': 'UNLV', 'texas-el-paso': 'UTEP',
           'texas-san-antonio': 'UTSA', 'north-carolina-state': 'NC State', 'pittsburgh': 'Pitt', 'california': 'Cal', 'connecticut': 'UConn', 'massachusetts': 'UMass',
           'florida-atlantic': 'FAU', 'florida-international': 'FIU', 'louisiana-monroe': 'ULM', 'louisiana-lafayette': 'Louisiana', 'appalachian-state': 'App State',
           'southern-mississippi': 'Southern Miss', 'hawaii': "Hawai'i", 'san-jose-state': 'San José State', 'middle-tennessee-state': 'Middle Tennessee',
           'sam-houston-state': 'Sam Houston', 'bowling-green-state': 'Bowling Green', 'texas-am': 'Texas A&M', 'mississippi-state': 'Mississippi State', 'ucla': 'UCLA'}
OFF = ['gp','pc','pa','py','ptd','pi','ra','ry','rtd','rc','rcy','rctd','fgm','fga','xpm','xpa','pn','pny']
def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    asof = sys.argv[sys.argv.index('--asof') + 1] if '--asof' in sys.argv else ''
    if '--asof' in sys.argv: args = [a for a in args if a != asof]
    src = open(F, encoding='utf-8').read()
    m = re.search(r'^window\.DY_TODAY_STATS = (\{.*\});$', src, re.M)
    S = json.loads(m.group(1))
    names = set(S)
    new = collections.defaultdict(dict); miss = collections.Counter()
    for fn in args:
        for line in open(fn, encoding='utf-8'):
            line = line.strip()
            if not line: continue
            nm, slug, kv = line.split('|', 2)
            t = SR_SLUG.get(slug) or ' '.join(w.capitalize() for w in slug.split('-'))
            if t.endswith(' State') is False and t not in names and t.endswith(' St.'): t = t[:-4] + ' State'
            if t not in names: miss[slug] += 1; continue
            d = new[t].setdefault(norm(nm), {})
            for p in kv.split(','):
                k, v = p.split(':'); d[k] = int(v)
    upd = add = 0
    for t, pl in new.items():
        for k, d in pl.items():
            old = S[t].get(k)
            if old is None: S[t][k] = dict(d); add += 1; continue
            for o in OFF: old.pop(o, None)
            for o in OFF: old[o] = d.get(o, 0)
            upd += 1
    print(f"updated {upd} players, added {add}, teams {len(new)}; unmatched team slugs: {dict(miss) or 'none'}")
    out = src[:m.start()] + 'window.DY_TODAY_STATS = ' + json.dumps(S, separators=(',', ':'), ensure_ascii=False) + ';' + src[m.end():]
    if asof and 'DY_TODAY_STATS_ASOF' not in out: out = out.rstrip('\n') + "\nwindow.DY_TODAY_STATS_ASOF = '" + asof + "';\n"
    elif asof: out = re.sub(r"DY_TODAY_STATS_ASOF = '[^']*'", "DY_TODAY_STATS_ASOF = '" + asof + "'", out)
    open(F, 'w', encoding='utf-8').write(out)
main()
