"""
The Vol Index - "Start Today" data for the football dynasty
===========================================================
Writes assets/dynasty/dy-today.js: every FBS team's real overall and conference record right now,
from ESPN's public FBS standings feed (no key). Start Today uses it to match the dynasty to the real
season, so it has to move with the weekly results. Runs from tools/auto_schedule.py (every morning
and on game nights after football results are refreshed).

Safety: it only overwrites the file when the feed is complete (at least 125 FBS teams matched to the
game's team names and the wins and losses roughly balance). Otherwise the old file stays.

Run:  python tools/update_today.py
"""
import datetime, json, os, re, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "dynasty", "dy-today.js")
UA = {"User-Agent": "Mozilla/5.0 (VolIndex fan site; standings)"}
SEASON = 2026
URLS = [f"https://site.web.api.espn.com/apis/v2/sports/football/college-football/standings?group=80&season={SEASON}&level=3",
        f"https://site.api.espn.com/apis/v2/sports/football/college-football/standings?group=80&season={SEASON}&level=3"]

# ESPN's school name -> the name the dynasty game uses
ALIAS = {"Miami": "Miami", "Pittsburgh": "Pitt", "California": "Cal", "Hawaii": "Hawai'i", "San Jose State": "San José State",
         "Massachusetts": "UMass", "UL Monroe": "ULM", "Louisiana Monroe": "ULM", "Louisiana-Monroe": "ULM", "Southern Mississippi": "Southern Miss",
         "Appalachian State": "App State", "Florida Atlantic": "FAU", "Florida International": "FIU", "UT San Antonio": "UTSA",
         "NIU": "Northern Illinois", "Connecticut": "UConn", "Army West Point": "Army", "Mississippi": "Ole Miss", "Sam Houston State": "Sam Houston",
         "USF": "South Florida", "Southern California": "USC", "Middle Tennessee State": "Middle Tennessee", "Louisiana Lafayette": "Louisiana"}

def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            if e.code in (400, 404): return None
        except Exception:
            pass
        time.sleep(2 * (i + 1))
    return None

def game_names():
    src = open(os.path.join(ROOT, "assets", "dynasty", "dy-data.js"), encoding="utf-8").read()
    t = re.search(r"const T = `(.*?)`", src, re.S).group(1).strip().split("\n")
    return {l.split("|")[0] for l in t}

def entries(node, out):
    if not isinstance(node, dict): return
    for e in (node.get("standings") or {}).get("entries") or []: out.append(e)
    for ch in node.get("children") or []: entries(ch, out)

def stat(stats, want):
    for s in stats:
        n, t = (s.get("name") or "").lower(), (s.get("type") or "").lower()
        if want == "conf" and (t in ("vsconf", "vsconference") or n in ("vsconf", "vs. conf.", "conferencerecord")):
            return s.get("displayValue") or s.get("summary")
        if want == "overall" and (t == "total" or n in ("overall", "overallrecord")):
            return s.get("displayValue") or s.get("summary")
    return None

def wl(r):
    m = re.match(r"^(\d+)-(\d+)", str(r or ""))
    return (int(m.group(1)), int(m.group(2))) if m else None

def main():
    names = game_names()
    ents = []
    for u in URLS:
        d = get(u)
        if d:
            entries(d, ents)
            if len(ents) >= 100: break
    rec, miss = {}, []
    for e in ents:
        t = e.get("team") or {}; st = e.get("stats") or []
        loc = (t.get("location") or "").strip()
        k = ALIAS.get(loc, loc)
        if k not in names and k.endswith(" St."): k = k[:-4] + " State"
        if k not in names: k = ALIAS.get((t.get("displayName") or "").strip(), k)
        ov, cf = stat(st, "overall"), stat(st, "conf")
        if k not in names or not wl(ov):
            if loc: miss.append(loc)
            continue
        c = wl(cf) or (0, 0)
        rec[k] = f"{wl(ov)[0]}-{wl(ov)[1]}|{c[0]}-{c[1]}"
    W = sum(wl(v.split("|")[0])[0] for v in rec.values()); L = sum(wl(v.split("|")[0])[1] for v in rec.values())
    print(f"matched {len(rec)} teams, unmatched: {', '.join(sorted(set(miss))) or 'none'}; wins {W}, losses {L}")
    if len(rec) < 125 or abs(W - L) > 0.15 * max(W, L, 1) or W + L < 100:
        print("!! standings feed incomplete: leaving dy-today.js as it is"); return False
    today = (datetime.datetime.utcnow() - datetime.timedelta(hours=5)).date().isoformat()     # Eastern, close enough for a date stamp
    # teams missing from the feed keep their last known record so the file always covers the whole league
    try:
        old = json.loads(re.search(r"rec: (\{.*?\}) \}", open(OUT, encoding="utf-8").read(), re.S).group(1))
    except Exception:
        old = {}
    for k in names:
        if k not in rec and k in old: rec[k] = old[k]
    body = ("/* Start Today: every FBS team's real record, refreshed automatically (tools/update_today.py runs with the daily data update).\n"
            "   Source: ESPN FBS standings, fetched " + today + ". Tennessee's own schedule, scores and player stats come from the site's daily data. */\n"
            "(function (root) {\n  root.DY_TODAY = { asOf: '" + today + "', source: 'ESPN FBS standings', rec: " + json.dumps(rec, separators=(",", ":"), ensure_ascii=False) + " };\n"
            "})(typeof window !== 'undefined' ? window : globalThis);\n")
    open(OUT, "w", encoding="utf-8").write(body)
    print("wrote", OUT)
    return True

if __name__ == "__main__":
    sys.exit(0 if main() else 1)
