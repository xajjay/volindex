#!/usr/bin/env python3
"""Append the real AP preseason top 25 (Wikipedia 'NCAA Division I men's basketball rankings', 'Pre' column) to data/hist/bb-<year>.js as BB_HIST[y].poll.
Key = season end year (2010 = 2009-10)."""
import re, os, json
SD = open(os.path.join(os.path.dirname(__file__), '..', 'assets/sdyn/sd-data.js'), encoding='utf-8').read()
NAMES = set(re.findall(r"^(?:\s*)([A-Za-z&.' ]+)\|[A-Za-z0-9]+\|", SD, re.M))
AL = {'California': 'Cal', 'Pittsburgh': 'Pitt', 'Florida Atlantic': 'FAU', 'Connecticut': 'UConn', 'Miami (FL)': 'Miami', 'NC State': 'NC State', 'Saint Mary\'s': "Saint Mary's"}
P = {
2010: "Kansas,Michigan State,Texas,Kentucky,Villanova,North Carolina,Purdue,West Virginia,Duke,Tennessee,Butler,UConn,California,Washington,Michigan,Ohio State,Oklahoma,Mississippi State,Louisville,Georgetown,Dayton,Georgia Tech,Illinois,Clemson,Minnesota",
2011: "Duke,Michigan State,Kansas State,Ohio State,Pittsburgh,Villanova,Kansas,North Carolina,Florida,Syracuse,Kentucky,Gonzaga,Illinois,Purdue,Missouri,Baylor,Butler,Washington,Memphis,Georgetown,Virginia Tech,Temple,Tennessee,BYU,San Diego State",
2012: "North Carolina,Kentucky,Ohio State,UConn,Syracuse,Duke,Vanderbilt,Florida,Louisville,Pitt,Memphis,Baylor,Kansas,Xavier,Wisconsin,Arizona,UCLA,Michigan,Alabama,Texas A&M,Cincinnati,Marquette,Gonzaga,Cal,Missouri",
2013: "Indiana,Louisville,Kentucky,Ohio State,Michigan,NC State,Kansas,Duke,Syracuse,Florida,North Carolina,Arizona,UCLA,Michigan State,Missouri,Creighton,Memphis,UNLV,Baylor,San Diego State,Gonzaga,Notre Dame,Wisconsin,Cincinnati,Florida State",
2014: "Kentucky,Michigan State,Louisville,Duke,Kansas,Arizona,Michigan,Oklahoma State,Syracuse,Florida,Ohio State,North Carolina,Memphis,VCU,Gonzaga,Wichita State,Marquette,UConn,Oregon,Wisconsin,Notre Dame,UCLA,New Mexico,Virginia,Baylor",
2015: "Kentucky,Arizona,Wisconsin,Duke,Kansas,North Carolina,Florida,Louisville,Virginia,Texas,Wichita State,Villanova,Gonzaga,Iowa State,VCU,San Diego State,UConn,Michigan State,Oklahoma,Ohio State,Nebraska,SMU,Syracuse,Michigan,Utah",
2016: "North Carolina,Kentucky,Maryland,Kansas,Duke,Virginia,Iowa State,Oklahoma,Gonzaga,Wichita State,Villanova,Arizona,Michigan State,Cal,Indiana,Utah,Wisconsin,Vanderbilt,Notre Dame,UConn,LSU,Baylor,Purdue,Butler,Michigan",
2017: "Duke,Kentucky,Kansas,Villanova,Oregon,North Carolina,Xavier,Virginia,Wisconsin,Arizona,Indiana,Michigan State,Louisville,Gonzaga,Purdue,UCLA,Saint Mary's,UConn,Syracuse,West Virginia,Texas,Creighton,Rhode Island,Iowa State,Maryland",
2018: "Duke,Michigan State,Arizona,Kansas,Kentucky,Villanova,Wichita State,Florida,North Carolina,USC,West Virginia,Cincinnati,Miami,Notre Dame,Minnesota,Louisville,Xavier,Gonzaga,Northwestern,Purdue,UCLA,Saint Mary's,Seton Hall,Baylor,Texas A&M",
2019: "Kansas,Kentucky,Gonzaga,Duke,Virginia,Tennessee,Nevada,North Carolina,Villanova,Michigan State,Auburn,Kansas State,West Virginia,Oregon,Virginia Tech,Syracuse,Florida State,Mississippi State,Michigan,TCU,UCLA,Clemson,LSU,Purdue,Washington",
2020: "Michigan State,Kentucky,Kansas,Duke,Louisville,Florida,Maryland,Gonzaga,North Carolina,Villanova,Virginia,Seton Hall,Texas Tech,Memphis,Oregon,Baylor,Utah State,Ohio State,Xavier,Saint Mary's,Arizona,LSU,Purdue,Auburn,VCU",
2021: "Gonzaga,Baylor,Villanova,Virginia,Iowa,Kansas,Wisconsin,Illinois,Duke,Kentucky,Creighton,Tennessee,Michigan State,Texas Tech,West Virginia,North Carolina,Houston,Arizona State,Texas,Oregon,Florida State,UCLA,Ohio State,Rutgers,Michigan",
2022: "Gonzaga,UCLA,Kansas,Villanova,Texas,Michigan,Purdue,Baylor,Duke,Kentucky,Illinois,Memphis,Oregon,Alabama,Houston,Arkansas,Ohio State,Tennessee,North Carolina,Florida State,Maryland,Auburn,St. Bonaventure,UConn,Virginia",
2023: "North Carolina,Gonzaga,Houston,Kentucky,Kansas,Baylor,Duke,UCLA,Creighton,Arkansas,Tennessee,Texas,Indiana,TCU,Auburn,Villanova,Arizona,Virginia,San Diego State,Alabama,Oregon,Michigan,Illinois,Dayton,Texas Tech",
2024: "Kansas,Duke,Purdue,Michigan State,Marquette,UConn,Houston,Creighton,Tennessee,Florida Atlantic,Gonzaga,Arizona,Miami,Arkansas,Texas A&M,Kentucky,San Diego State,Texas,North Carolina,Baylor,USC,Villanova,Saint Mary's,Alabama,Illinois",
2025: "Kansas,Alabama,UConn,Houston,Iowa State,Gonzaga,Duke,Baylor,North Carolina,Arizona,Auburn,Tennessee,Texas A&M,Purdue,Creighton,Arkansas,Indiana,Marquette,Texas,Cincinnati,Florida,UCLA,Kentucky,Ole Miss,Rutgers",
2026: "Purdue,Houston,Florida,UConn,St. John's,Duke,Michigan,BYU,Kentucky,Texas Tech,Louisville,UCLA,Arizona,Arkansas,Alabama,Iowa State,Illinois,Tennessee,Kansas,Auburn,Gonzaga,Michigan State,Creighton,Wisconsin,North Carolina",
}
for y, s in P.items():
    names = [AL.get(n, n) for n in s.split(',')]
    bad = [n for n in names if n not in NAMES]
    if bad: print(y, 'unmatched', bad)
    f = 'data/hist/bb-%d.js' % y
    t = open(f, encoding='utf-8').read()
    t = re.sub(r'\nwindow\.BB_HIST\[%d\]\.poll=.*\n?' % y, '\n', t)
    t = t.rstrip('\n') + '\nwindow.BB_HIST[%d].poll=%s;\n' % (y, json.dumps(names))
    open(f, 'w', encoding='utf-8').write(t)
print('ok')
