"""
The Vol Index - the real 2026 FBS schedule and scores for "Start Today"
======================================================================
Pulls every FBS-team game of the 2026 season from ESPN's public scoreboard and writes
data/hist/fb-sched26.js: [mm-dd, home, away, neutral, conference, homeScore, awayScore] (scores only once final).
Start Today builds every team's slate from it, so opponents and results match real life.

Safety: nothing is overwritten unless the pull looks complete (800+ games). On any failure the old file stays.
Runs from tools/auto_schedule.py every morning.     Run:  python tools/update_sched26.py
"""
import datetime, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "hist", "fb-sched26.js")
API = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=400&dates={a}-{b}"
START, END = datetime.date(2026, 8, 29), datetime.date(2026, 12, 13)
ALIAS = {"California": "Cal", "Pittsburgh": "Pitt", "Florida Atlantic": "FAU", "UL Monroe": "ULM", "Massachusetts": "UMass",
         "Florida International": "FIU", "SE Louisiana": "Southeastern Louisiana"}

def pull():
    rows, d = [], START
    while d <= END:
        e = min(d + datetime.timedelta(days=6), END)
        req = urllib.request.Request(API.format(a=d.strftime("%Y%m%d"), b=e.strftime("%Y%m%d")), headers={"User-Agent": "Mozilla/5.0"})
        j = json.load(urllib.request.urlopen(req, timeout=40))
        for ev in j.get("events", []):
            c = ev["competitions"][0]
            home = next(t for t in c["competitors"] if t["homeAway"] == "home"); away = next(t for t in c["competitors"] if t["homeAway"] == "away")
            hn, an = home["team"].get("location") or home["team"]["displayName"], away["team"].get("location") or away["team"]["displayName"]
            if "TBD" in (hn, an) or not hn or not an: continue
            u = datetime.datetime.strptime(ev["date"], "%Y-%m-%dT%H:%MZ"); dt = u - datetime.timedelta(hours=4 if u < datetime.datetime(2026, 11, 1, 6) else 5)   # kickoff in Eastern, so late games stay on their day
            r = [dt.strftime("%m-%d"), hn, an, int(bool(c.get("neutralSite"))), int(bool(c.get("conferenceCompetition")))]
            if ev["status"]["type"].get("completed"): r += [int(home["score"]), int(away["score"])]
            rows.append(r)
        d = e + datetime.timedelta(days=1)
    seen, out = set(), []
    for r in rows:
        k = (r[0], r[1], r[2])
        if k not in seen: seen.add(k); out.append(r)
    return sorted(out, key=lambda r: (r[0], r[1]))

def main():
    try: rows = pull()
    except Exception as ex:
        print("!! ESPN schedule pull failed (" + str(ex)[:80] + "): leaving fb-sched26.js as it is"); return False
    if len(rows) < 800:
        print("!! ESPN schedule pull looks incomplete (%d games): leaving fb-sched26.js as it is" % len(rows)); return False
    asof = datetime.date.today().isoformat()
    body = ",\n".join(json.dumps(r, separators=(",", ":"), ensure_ascii=False) for r in rows)
    txt = ("/* Real 2026 FBS schedule and final scores (ESPN), as of %s. Rows: [mm-dd, home, away, neutral, conf, homeScore, awayScore]. Refreshed by tools/update_sched26.py */\n"
           "window.DY_REAL26 = {asOf:'%s',alias:%s,rows:[\n%s\n]};\n") % (asof, asof, json.dumps(ALIAS, ensure_ascii=False).replace('"', "'"), body)
    if os.path.exists(OUT) and open(OUT, encoding="utf-8").read().split("\n", 1)[1:] == txt.split("\n", 1)[1:]:
        print("2026 schedule unchanged"); return True
    open(OUT, "w", encoding="utf-8").write(txt)
    print("2026 schedule: %d games, %d final" % (len(rows), sum(len(r) > 5 for r in rows))); return True

if __name__ == "__main__":
    sys.exit(0 if main() else 1)
