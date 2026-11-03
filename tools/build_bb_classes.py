#!/usr/bin/env python3
"""Build data/hist/bb-classes.js from the per-season rosters (data/hist/bb-<year>.js): the real freshman classes 2010..2025 with their high-school
rank (RSCI), the college they actually went to and how their college careers turned out (peak production). The game blends the two, like football's
career-ranked classes. window.BB_CLASS[classYear] = [[name, pos, ht, wt, home, school, rsci, peak, firstMin], ...]"""
import json, re, os, glob
D = {}
for f in glob.glob('data/hist/bb-20*.js'):
    y = int(re.search(r'bb-(\d+)\.js', f).group(1))
    t = open(f, encoding='utf-8').read()
    m = re.search(r'window\.BB_HIST\[%d\] = (\{.*?\});\n' % y, t, re.S)
    D[y] = json.loads(m.group(1))
def prod(r):
    g, mp, pts, trb, ast, stl, blk, tov = r[7], r[8], r[9], r[10], r[11], r[12], r[13], r[18]
    m = min(1, (mp or 0) / 26)
    return ((pts or 0) + .7 * (trb or 0) + 1.2 * (ast or 0) + 1.5 * (stl or 0) + 1.3 * (blk or 0) - (tov or 0)) * (.55 + .45 * m) + (0 if (g or 0) >= 8 else -3)
peak = {}
for y, d in D.items():
    for tn, T in d['teams'].items():
        for r in T['pl']:
            if r[0]: peak[r[0]] = max(peak.get(r[0], -99), prod(r))
out = {}
for y in sorted(D):
    cy = y - 1   # the class that enters in the fall before this season
    if cy < 2010: continue
    seen = {}
    for tn, T in D[y]['teams'].items():
        for r in T['pl']:
            if not r[0] or r[1] != 'FR': continue
            m = re.match(r'(\d+)\s*\((\d{4})\)', r[6] or '')
            rk = int(m.group(1)) if m and int(m.group(2)) == cy else None
            if rk is None and (r[8] or 0) < 12: continue      # unranked and barely played: not worth a slot
            if r[0] in seen and (rk or 999) >= (seen[r[0]][6] or 999): continue
            seen[r[0]] = [r[0], r[2], r[3], r[4], r[5], tn, rk, round(peak.get(r[0], 0), 1), r[8] or 0]
    out[cy] = sorted(seen.values(), key=lambda x: (x[6] or 999, -x[7]))
    print(cy, len(out[cy]), 'ranked', sum(1 for x in out[cy] if x[6]))
open('data/hist/bb-classes.js', 'w', encoding='utf-8').write('window.BB_CLASS = %s;\n' % json.dumps(out, separators=(',', ':'), ensure_ascii=False))
