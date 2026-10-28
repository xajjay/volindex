"""Standalone: rebuild ONLY recruiting classes 2025+ from the 247 composite file,
leaving 1990-2024 (career-ranked) untouched. Merges into the existing fb-classes.js.
Usage: python3 tools/build_classes_247.py <scratch>/hdata
"""
import json, os, re, sys, collections

HD = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'hist', 'fb-classes.js')

src = open(os.path.join(ROOT, 'assets/dynasty/dy-data.js')).read()
TL = [l.split('|') for l in re.search(r"const T = `(.*?)`", src, re.S).group(1).strip().split('\n')]
FL = [l.split('|') for l in re.search(r"const F = `(.*?)`", src, re.S).group(1).strip().split('\n')]
DYT = {l[0]: l for l in TL}
DYF = {l[0]: l for l in FL}
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
def norm(s): return re.sub(r'[^a-z]', '', (s or '').lower())

P247 = {'QB': 'QB', 'PRO': 'QB', 'DUAL': 'QB', 'RB': 'RB', 'APB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'OT': 'OT', 'IOL': 'IOL', 'OG': 'IOL', 'OC': 'IOL',
        'EDGE': 'EDGE', 'WDE': 'EDGE', 'SDE': 'EDGE', 'DL': 'DT', 'DT': 'DT', 'LB': 'LB', 'ILB': 'LB', 'OLB': 'LB', 'CB': 'CB', 'S': 'S', 'SAF': 'S', 'ATH': 'WR',
        'K': 'K', 'P': 'P', 'LS': 'LS'}

def load_247():
    f = os.path.join(HD, 'ext', 'volindex-247.txt'); out = collections.defaultdict(list)
    for line in open(f, encoding='utf-8'):
        p = line.rstrip('\n').split('|')
        if len(p) < 9 or not p[0].isdigit(): continue
        cls, rk, nm, meta, pos, hw, score, stars, sch = p[:9]
        if not nm.strip() or not pos.strip(): continue       # blank/placeholder row from the scrape
        rkm = re.match(r'\s*(\d+)', rk)
        if not rkm: continue                                  # malformed rank field, skip
        rk = rkm.group(1)
        m = re.search(r'\(([^,]+), ([A-Z]{2})\)', meta)
        out[int(cls)].append({'rk': int(rk), 'n': nm.strip(), 'hs': meta.split(' (')[0], 'home': (m.group(1) + ', ' + m.group(2)) if m else '', 'st': m.group(2) if m else '',
                              'pos': pos, 'hw': hw, 'c': float(score) if score.replace('.', '').isdigit() else 0.0, 'stars': int(stars or 0), 'school': (sch.split('/')[-1] if sch else '')})
    return out
R247 = load_247()
print('247 classes found:', sorted(R247.keys()))

# load existing fb-classes.js (career-ranked 1990-2024, whatever's there)
existing_src = open(OUT).read()
m = re.search(r'window\.DY_HCLASS = (.*);\s*$', existing_src, re.S)
CL = {int(k): v for k, v in json.loads(m.group(1)).items()}
before = sorted(CL.keys())
print('existing years:', before)

new_years = 0
for c in sorted(R247.keys()):
    if c < 2025: continue   # never touch career-ranked years
    cand = {}
    for r in R247[c]:
        cand[norm(r['n'])] = {'n': r['n'], 'pos': P247.get(r['pos'].upper(), 'WR'), 'school': dyname(r['school']) or r['school'], 'home': r['home'], 'c': r['c'], 'rk': r['rk']}
    ps = sorted([x for x in cand.values() if x['rk'] < 9999], key=lambda x: x['rk'])[:320]
    CL[c] = [[x['n'], x['pos'], x['school'], 0, 0, 0, x['home'], x['c']] for x in ps]
    new_years += 1
    print(c, 'class size', len(CL[c]), 'top5:', [(x[0], x[1], x[7]) for x in CL[c][:5]])

CL = {c: v for c, v in CL.items() if v}
open(OUT, 'w').write('window.DY_HCLASS = %s;\n' % json.dumps({str(k): v for k, v in CL.items()}, separators=(',', ':'), ensure_ascii=False))
print('wrote', OUT, '- years now:', sorted(CL.keys()), '- new/updated years from 247:', new_years)
