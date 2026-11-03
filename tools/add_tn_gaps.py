#!/usr/bin/env python3
"""Adds Tennessee's 2014-15 and 2015-16 rosters (Sports-Reference) to data/hist, which the top-70-per-year scrape had missed."""
import json, re
def dash(x): return 0 if x in ('—', None, '') else float(x)
def build(rows, stats):
    st = {}
    for line in stats.strip().splitlines():
        p = [c.strip() for c in line.split('|')]
        st[p[0]] = p[1:]
    out = []
    for line in rows.strip().splitlines():
        n, cls, pos, ht, wt, home, rs = [c.strip() for c in line.split('|')]
        s = st[n]; g, mp, pts, trb, ast, stl, blk, fg, tp, ft, tpa, tov = [dash(x) for x in s]
        out.append([n, cls, pos, ht, wt, home, rs if rs not in ('None', '—') else '', int(g), mp, pts, trb, ast, stl, blk, fg, tp, ft, tpa, tov, 0, 0])
    return out
Y = {
2015: ('Donnie Tyndall', 16, 16, 7.23, """Josh Richardson|SR|G|6-6|200|Edmond, OK|—
Armani Moore|JR|G|6-5|215|Kennesaw, GA|—
Kevin Punter|JR|G|6-4|180|Bronx, NY|—
Robert Hubbs|SO|G|6-6|195|Newbern, TN|22 (2013)
Derek Reese|JR|G|6-8|220|Orlando, FL|—
Devon Baulkman|JR|G|6-5|200|Bainbridge, GA|—
Detrick Mostella|FR|G|6-1|175|Decatur, AL|99 (2014)
Willie Carmichael|FR|F|6-8|210|Apopka, FL|—
Jabari McGhee|FR|F|6-7|215|Albany, GA|—
Tariq Owens|FR|F|6-10|205|Odenton, MD|—
Dominic Woodson|SO|F|6-10|290|Austin, TX|83 (2013)
Ian Chiles|SR|G|6-1|200|Louisville, KY|—
Galen Campbell|JR|G|6-2|190|Knoxville, TN|—""", """Josh Richardson|32|36.3|16.0|4.5|3.6|2.1|0.5|.461|.359|.798|4.0|2.7
Armani Moore|32|30.9|10.3|6.8|2.2|1.4|1.2|.445|.182|.617|1.0|2.3
Kevin Punter|32|31.0|10.3|2.1|1.9|1.6|0.2|.419|.352|.685|3.8|1.8
Robert Hubbs|32|24.8|7.2|2.9|0.9|0.5|0.1|.409|.333|.727|2.9|0.8
Derek Reese|32|25.3|6.0|5.3|0.9|0.7|0.3|.406|.333|.737|1.9|1.2
Devon Baulkman|31|14.7|4.7|2.3|0.6|0.6|0.1|.381|.382|.795|2.2|0.8
Detrick Mostella|31|11.7|3.4|0.9|0.5|0.3|0.0|.276|.272|.700|2.6|1.0
Willie Carmichael|32|14.8|3.0|2.3|0.3|0.2|0.4|.519|—|.625|0.0|0.9
Jabari McGhee|8|12.9|4.4|3.8|0.0|0.4|0.1|.700|—|.412|0.0|0.4
Tariq Owens|28|7.6|1.2|1.1|0.1|0.2|0.5|.353|—|.526|0.0|0.4
Dominic Woodson|4|12.0|3.5|2.0|0.3|0.8|0.5|.500|—|.333|0.0|0.8
Ian Chiles|3|4.7|0.7|0.7|0.3|0.3|0.0|.500|.000|—|0.3|0.0
Galen Campbell|2|1.0|0.0|0.0|0.0|0.0|0.0|—|—|—|0.0|0.0"""),
2016: ('Rick Barnes', 15, 19, 7.80, """Kevin Punter|SR|G|6-4|180|Bronx, NY|None
Armani Moore|SR|G|6-5|215|Kennesaw, GA|None
Devon Baulkman|SR|G|6-5|200|Bainbridge, GA|None
Robert Hubbs|JR|G|6-6|195|Newbern, TN|22 (2013)
Detrick Mostella|SO|G|6-1|175|Decatur, AL|99 (2014)
Admiral Schofield|FR|G|6-6|241|Zion, IL|None
Shembari Phillips|FR|G|6-4|210|Atlanta, GA|None
Derek Reese|SR|G|6-8|220|Orlando, FL|None
Kyle Alexander|FR|F|6-11|215|Milton, Canada|None
Ray Kasongo|SO|F|6-8|245|Toronto, Canada|None
Jabari McGhee|FR|F|6-7|215|Albany, GA|None
Brad Woodson|FR|G|6-1|177|Murfreesboro, TN|None
Lucas Campbell|FR|G|6-4|185|Knoxville, TN|None""", """Kevin Punter|26|34.1|22.2|3.4|3.5|1.4|0.2|.460|.369|.817|6.0|2.5
Armani Moore|33|32.7|12.2|7.6|4.1|1.2|1.6|.414|.316|.565|1.7|2.6
Robert Hubbs|30|26.7|10.6|3.9|1.3|0.4|0.0|.452|.239|.739|1.5|0.7
Devon Baulkman|34|27.4|9.5|3.4|1.8|1.0|0.4|.373|.333|.815|5.5|1.3
Detrick Mostella|34|19.6|8.4|2.2|1.2|0.3|0.2|.363|.303|.735|4.6|1.4
Admiral Schofield|32|18.7|7.6|4.0|0.9|0.4|0.3|.444|.301|.897|2.6|0.7
Shembari Phillips|33|16.2|5.4|1.8|1.0|0.2|0.2|.408|.368|.766|1.7|1.4
Jabari McGhee|6|10.8|3.8|3.2|0.0|0.7|0.5|.529|—|.833|0.0|0.2
Derek Reese|34|19.2|3.1|5.4|0.9|0.5|0.6|.465|.467|.541|0.4|0.5
Kyle Alexander|32|12.2|1.7|3.2|0.1|0.2|1.0|.432|—|.656|0.0|0.5
Ray Kasongo|22|5.5|1.4|1.5|0.0|0.0|0.3|.522|—|.636|0.0|0.3
Lucas Campbell|4|2.0|0.8|0.3|0.0|0.0|0.0|.333|.500|—|0.5|0.3
Brad Woodson|10|6.3|0.7|0.8|0.3|0.1|0.0|.143|.111|1.000|0.9|0.2"""),
}
for y, (coach, w, l, srs, rows, stats) in Y.items():
    f = 'data/hist/bb-%d.js' % y
    t = open(f, encoding='utf-8').read()
    m = re.search(r'(window\.BB_HIST\[%d\] = )(\{.*?\})(;\n)' % y, t, re.S)
    d = json.loads(m.group(2))
    d['teams']['Tennessee'] = {'conf': 'SEC MBB', 'w': w, 'l': l, 'srs': srs, 'coach': coach, 'pl': build(rows, stats)}
    t = t[:m.start(2)] + json.dumps(d, separators=(',', ':'), ensure_ascii=False) + t[m.end(2):]
    open(f, 'w', encoding='utf-8').write(t)
    print(y, 'Tennessee added', len(d['teams']), 'teams')
