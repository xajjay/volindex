"""
The Vol Index - SEC standings for every sport
=============================================
Reads ESPN's public standings feed for each sport, keeps the SEC table (every team's
conference and overall record), and writes data/standings-auto.js. If a season hasn't
started yet (everyone 0-0), it uses last season's final standings instead and says so.

Run:  python tools/update_standings.py          (all sports)
      python tools/update_standings.py mbb wbb  (some sports)
Runs every morning from tools/auto_schedule.py.
"""
import datetime, json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "standings-auto.js")
UA = {"User-Agent": "Mozilla/5.0 (VolIndex fan site; standings)"}

# sport key -> (ESPN path, current season as ESPN numbers it, label for current, label for last season)
SPORTS = {
    "football":   ("football/college-football", 2026, "2026", "2025"),
    "volleyball": ("volleyball/womens-college-volleyball", 2026, "2026", "2025"),
    "soccer":     ("soccer/usa.ncaa.w.1", 2026, "2026", "2025"),
    "mbb":        ("basketball/mens-college-basketball", 2027, "2026-27", "2025-26"),
    "wbb":        ("basketball/womens-college-basketball", 2027, "2026-27", "2025-26"),
    "baseball":   ("baseball/college-baseball", 2027, "2027", "2026"),
    "softball":   ("softball/college-softball", 2027, "2027", "2026"),
}

def get(url):
    for i in range(3):
        try:
            time.sleep(0.3)
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            if e.code in (400, 404): return None
        except Exception:
            pass
        time.sleep(2 * (i + 1))
    return None

def find_sec(node):
    """Depth-first search for the SEC group in ESPN's standings tree."""
    if not isinstance(node, dict): return None
    name = (node.get("name") or "") + " " + (node.get("abbreviation") or "") + " " + (node.get("shortName") or "")
    if ("Southeastern" in name or name.split().count("SEC")) and ("standings" in node or "children" in node):
        return node
    for ch in node.get("children") or []:
        r = find_sec(ch)
        if r: return r
    return None

def entries_of(group):
    out = []
    if (group.get("standings") or {}).get("entries"): out += group["standings"]["entries"]
    for ch in group.get("children") or []: out += entries_of(ch)
    return out

def rec(stats, want):
    """Pull a W-L record out of ESPN's stat list. want='overall' or 'conf'."""
    for s in stats:
        n, t, d = (s.get("name") or "").lower(), (s.get("type") or "").lower(), (s.get("description") or "").lower()
        if want == "conf" and (t in ("vsconf", "vsconference") or n in ("vsconf", "vs. conf.", "conferencerecord") or "conference" in d and "record" in d):
            return s.get("displayValue") or s.get("summary")
        if want == "overall" and (t == "total" or n in ("overall", "overallrecord")):
            return s.get("displayValue") or s.get("summary")
    if want == "overall":
        g = {s.get("name"): s.get("value") for s in stats}
        if g.get("wins") is not None:
            w, l, tt = int(g.get("wins") or 0), int(g.get("losses") or 0), int(g.get("ties") or 0)
            return f"{w}-{l}" + (f"-{tt}" if tt else "")
    return None

def wl(r):
    try:
        p = [int(x) for x in str(r).split("-")]
        w, l, t = (p + [0, 0, 0])[:3]
        g = w + l + t
        return w, l, t, ((w + t / 2) / g if g else 0)
    except Exception:
        return 0, 0, 0, 0

def standings(path, season):
    for url in (f"https://site.api.espn.com/apis/v2/sports/{path}/standings?season={season}",
                f"https://site.api.espn.com/apis/v2/sports/{path}/standings?season={season}&group=8",
                f"https://site.api.espn.com/apis/v2/sports/{path}/standings?season={season}&group=23"):
        d = get(url)
        if not d: continue
        sec = find_sec(d)
        if not sec: continue
        rows = []
        for e in entries_of(sec):
            t = e.get("team") or {}; st = e.get("stats") or []
            conf, ov = rec(st, "conf"), rec(st, "overall")
            rows.append(dict(team=t.get("location") or t.get("displayName") or t.get("name"), name=t.get("displayName"), abbr=t.get("abbreviation"),
                             conf=conf, overall=ov, streak=next((s.get("displayValue") for s in st if (s.get("name") or "").lower() == "streak"), None)))
        rows = [r for r in rows if r["team"]]
        if not rows: continue
        rows.sort(key=lambda r: (-wl(r["conf"])[3], -wl(r["conf"])[0], -wl(r["overall"])[3], r["team"]))
        played = sum(sum(wl(r["overall"])[:3]) for r in rows)
        return rows, played, url
    return None, 0, None

def main(keys=None):
    try:
        t = open(OUT, encoding="utf-8").read()
        prev = json.loads(t.split("window.SITE_AUTO.standings = ", 1)[1].rsplit(";", 1)[0])
    except Exception:
        prev = {}
    out = dict(prev)
    for k in keys or SPORTS:
        path, season, label, last_label = SPORTS[k]
        try:
            rows, played, url = standings(path, season)
            final = False
            if not rows or played == 0:
                rows2, played2, url2 = standings(path, season - 1)
                if rows2: rows, url, final, label = rows2, url2, True, last_label
            if rows:
                out[k] = dict(season=label, final=final, rows=rows, source=url, updated=datetime.date.today().isoformat())
                print(f"OK   {k}: {len(rows)} SEC teams ({label}{' final' if final else ''})")
            else:
                print(f"SKIP {k}: no SEC standings found")
        except Exception as e:
            print(f"SKIP {k}: {e}")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/update_standings.py from ESPN's standings feed. Do not edit by hand. */\n")
        f.write("window.SITE_AUTO = window.SITE_AUTO || {};\nwindow.SITE_AUTO.standings = " + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n")

if __name__ == "__main__":
    main([a for a in sys.argv[1:] if a in SPORTS] or None)
