#!/usr/bin/env python3
"""Build data/hist/bb-<year>.js from the Sports-Reference scrape (bb_data.json: {teams: {"2024|duke": {...}}}).
usage: build_bb_hist.py bb_data.json"""
import json, sys, re, os, collections
SD = open(os.path.join(os.path.dirname(__file__), '..', 'assets/sdyn/sd-data.js'), encoding='utf-8').read()
NAMES = set(re.findall(r"^(?:\s*)([A-Za-z&.' ]+)\|[A-Za-z0-9]+\|", SD, re.M))
ALIAS = {'Nevada–Las Vegas': 'UNLV', 'Connecticut': 'UConn', 'Pittsburgh': 'Pitt', 'California': 'Cal', 'Southern California': 'USC', 'Mississippi': 'Ole Miss', 'North Carolina State': 'NC State', 'Central Florida': 'UCF',
         'Brigham Young': 'BYU', 'Louisiana State': 'LSU', 'Southern Methodist': 'SMU', 'Virginia Commonwealth': 'VCU', 'Florida Atlantic': 'FAU', "Saint Mary's (CA)": "Saint Mary's",
         "St. John's (NY)": "St. John's", 'Loyola (IL)': 'Loyola Chicago', 'Appalachian State': 'App State', 'Tennessee-Martin': 'UT Martin', 'Louisiana-Lafayette': 'Louisiana', 'Miami (FL)': 'Miami',
         'Texas Christian': 'TCU', 'Mississippi State': 'Mississippi State', 'Southern Mississippi': 'Southern Miss', 'North Carolina-Greensboro': 'UNC Greensboro', 'North Carolina-Asheville': 'UNC Asheville',
         'Nevada-Las Vegas': 'UNLV', 'Alabama-Birmingham': 'UAB', 'Texas-San Antonio': 'UTSA', 'Illinois-Chicago': 'Illinois-Chicago', 'Saint Louis': 'Saint Louis', "Saint Joseph's": "Saint Joseph's",
         'Texas A&M': 'Texas A&M', 'Southern Illinois-Edwardsville': 'SIUE', 'Arkansas-Little Rock': 'Little Rock', 'Penn State': 'Penn State', 'Pennsylvania': 'Penn',
         'East Tennessee State': 'East Tennessee State', 'Saint Peter\'s': "Saint Peter's", 'Georgia Southern': 'Georgia Southern', 'Texas State': 'Texas State', 'Western Kentucky': 'Western Kentucky'}
d = json.load(open(sys.argv[1]))
by = collections.defaultdict(dict); miss = collections.Counter()
for k, t in d['teams'].items():
    y = int(k.split('|')[0]); n = re.sub(r'\s+NCAA$', '', t['n']).strip(); n = ALIAS.get(n, n)
    if n not in NAMES: miss[n] += 1; continue
    by[y][n] = {'conf': t['conf'], 'w': t['w'], 'l': t['l'], 'srs': t['srs'], 'coach': t['coach'], 'pl': t['pl']}
os.makedirs('data/hist', exist_ok=True)
for y, teams in by.items():
    open('data/hist/bb-%d.js' % y, 'w').write('window.BB_HIST = window.BB_HIST || {}; window.BB_HIST[%d] = %s;\n' % (y, json.dumps({'teams': teams}, separators=(',', ':'), ensure_ascii=False)))
    print(y, len(teams), 'teams')
print('unmatched:', dict(miss))
