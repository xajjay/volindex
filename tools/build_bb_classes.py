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
# Pro-career tiers: elite talents who left after one year (or whose college stats undersell them) still rank where their NBA careers say
PRO = {"Kyrie Irving": "A", "Anthony Davis": "A", "Bradley Beal": "A", "Michael Kidd-Gilchrist": "B", "Andrew Wiggins": "A", "Jabari Parker": "B", "Julius Randle": "B", "Aaron Gordon": "B", "Joel Embiid": "A", "Karl-Anthony Towns": "A", "Jahlil Okafor": "B", "D'Angelo Russell": "B", "Devin Booker": "A", "Myles Turner": "B", "Tyus Jones": "B", "Justise Winslow": "B", "Jamal Murray": "A", "Jaylen Brown": "A", "Brandon Ingram": "B", "Ben Simmons": "A", "Jayson Tatum": "A", "De'Aaron Fox": "A", "Bam Adebayo": "A", "Jarrett Allen": "B", "Lonzo Ball": "B", "Markelle Fultz": "B", "Josh Jackson": "B", "Shai Gilgeous-Alexander": "A", "Trae Young": "A", "Jaren Jackson Jr.": "A", "Marvin Bagley III": "B", "Deandre Ayton": "B", "Michael Porter Jr.": "B", "Wendell Carter Jr.": "B", "Zion Williamson": "A", "R.J. Barrett": "B", "Tyrese Maxey": "A", "Anthony Edwards": "A", "Cade Cunningham": "A", "Evan Mobley": "A", "Scottie Barnes": "A", "Jalen Suggs": "B", "Chet Holmgren": "A", "Paolo Banchero": "A", "Jabari Smith": "A", "Keegan Murray": "B", "Nerlens Noel": "B", "Victor Oladipo": "B", "Tobias Harris": "B", "Tristan Thompson": "B", "Brandon Knight": "C", "Kevin Durant": "A", "Cody Zeller": "C", "Gary Harris": "C", "Nick Johnson": "C", "Ja Morant": "A", "Donovan Mitchell": "A", "Isaiah Stewart": "C", "Tyrese Haliburton": "A", "Jalen Johnson": "B", "Walker Kessler": "B", "Jalen Duren": "B", "Dyson Daniels": "B", "Bennedict Mathurin": "B", "Jaden Ivey": "B", "Ousmane Dieng": "C", "Terrence Shannon": "C", "Cooper Flagg": "A", "Dylan Harper": "A", "Ace Bailey": "A", "V.J. Edgecombe": "A", "Kon Knueppel": "B", "Tre Johnson": "B", "Jeremiah Fears": "B", "Khaman Maluach": "B"}
FLOOR = {'A': 34, 'B': 27, 'C': 24}
# Real top recruits whose rows are missing from the season data: [name,pos,ht,wt,home,school,rsci,class year,firstMin]
MANUAL = [['Ben Simmons','F','6-10','240','Melbourne, AUS','LSU',1,2015,32],['Markelle Fultz','G','6-4','195','Upper Marlboro, MD','Washington',5,2016,32],['Anthony Edwards','G','6-4','225','Atlanta, GA','Georgia',1,2019,32],['Ace Bailey','F','6-10','210','Bronx, NY','Rutgers',3,2024,30]]
peak = {}
for y, d in D.items():
    for tn, T in d['teams'].items():
        for r in T['pl']:
            if r[0]: peak[r[0]] = max(peak.get(r[0], -99), prod(r))
first = {}
for y in sorted(D):
    for tn, T in D[y]['teams'].items():
        for r in T['pl']: first.setdefault(r[0], y)
out = {}
for y in sorted(D):
    cy = y - 1   # the class that enters in the fall before this season
    if cy < 2010: continue
    seen = {}
    for tn, T in D[y]['teams'].items():
        for r in T['pl']:
            if not r[0] or r[1] not in ('FR', ''): continue
            m = re.match(r'(\d+)\s*\((\d{4})\)', r[6] or '')
            rk = int(m.group(1)) if m and int(m.group(2)) == cy else None
            if r[1] == '' and (r[0] not in PRO or first.get(r[0]) != y): continue
            if rk is None and (r[8] or 0) < 12: continue      # unranked and barely played: not worth a slot
            if r[0] in seen and (rk or 999) >= (seen[r[0]][6] or 999): continue
            seen[r[0]] = [r[0], r[2], r[3], r[4], r[5], tn, rk, round(peak.get(r[0], 0), 1), r[8] or 0]
    for m in MANUAL:
        if m[7] == cy and m[0] not in seen: seen[m[0]] = [m[0], m[1], m[2], m[3], m[4], m[5], m[6], 0, m[8]]
    for n, x in seen.items():
        if n in PRO:
            x[7] = round(max(x[7], FLOOR[PRO[n]]), 1)
            if x[6] is None or x[6] > {'A': 12, 'B': 20, 'C': 35}[PRO[n]]: x[6] = {'A': 8, 'B': 15, 'C': 30}[PRO[n]] if x[6] is None else x[6]
    out[cy] = sorted(seen.values(), key=lambda x: (x[6] or 999, -x[7]))
    print(cy, len(out[cy]), 'ranked', sum(1 for x in out[cy] if x[6]))
open('data/hist/bb-classes.js', 'w', encoding='utf-8').write('window.BB_CLASS = %s;\n' % json.dumps(out, separators=(',', ':'), ensure_ascii=False))
