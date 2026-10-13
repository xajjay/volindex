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
import datetime, json, os, re, sys, time, urllib.request, urllib.error

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
        if want == "home" and (t == "home" or n == "home"):
            return s.get("displayValue") or s.get("summary")
        if want == "away" and (t in ("road", "away") or n in ("road", "away")):
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
                             conf=conf, overall=ov, home=rec(st, "home"), away=rec(st, "away"), streak=next((s.get("displayValue") for s in st if (s.get("name") or "").lower() == "streak"), None)))
        rows = [r for r in rows if r["team"]]
        if not rows: continue
        rows.sort(key=lambda r: (-wl(r["conf"])[3], -wl(r["conf"])[0], -wl(r["overall"])[3], r["team"]))
        played = sum(sum(wl(r["overall"])[:3]) for r in rows)
        return rows, played, url
    return None, 0, None


# ESPN has no SEC standings for these; the SEC's own site (secsports.com) has a JSON feed
SEC_SPORT = {"volleyball": (14, "2026"), "soccer": (9, "2026"), "baseball": (1, "2027"), "softball": (10, "2027")}
MASCOTS = ["Crimson Tide", "Razorbacks", "Tigers", "Gators", "Bulldogs", "Wildcats", "Rebels", "Gamecocks", "Volunteers", "Lady Volunteers",
           "Lady Vols", "Commodores", "Aggies", "Longhorns", "Sooners"]

def sec_site(k):
    sid, year = SEC_SPORT[k]
    base = "https://www.secsports.com/api/"
    d = get(base + f"schedules?per_page=100&include=season&filter[sport_id]={sid}")
    if not d: return None, None, None
    sch = {}
    for x in d.get("data") or []:
        t = str(x.get("title") or x.get("name") or "")
        m = re.match(r"(\d{4})", t)
        if m: sch[m.group(1)] = x["id"]
    for yr, final in ((year, False), (str(int(year) - 1), True)):
        if yr not in sch: continue
        st = get(base + f"schedules/{sch[yr]}/standings?include=school")
        rows = []
        for r in (st or {}).get("data") or []:
            nm = ((r.get("school") or {}).get("name") or "").strip()
            team = nm
            for mc in MASCOTS:
                if team.endswith(" " + mc): team = team[: -len(mc) - 1]; break
            rec3 = lambda a: f"{r.get(a + '_wins') or 0}-{r.get(a + '_loses') or 0}" + (f"-{r.get(a + '_ties')}" if r.get(a + "_ties") else "")
            stk = f"{r.get('streak_type_label') or ''}{r.get('streak') or ''}" if r.get("streak") else None
            rows.append(dict(team=team, name=nm, abbr=(r.get("school") or {}).get("short_name"), conf=rec3("conference"), overall=rec3("overall"), home=rec3("home"), away=rec3("road"), streak=stk))
        played = sum(sum(wl(x["overall"])[:3]) for x in rows)
        if rows and played:
            rows.sort(key=lambda r: (-wl(r["conf"])[3], -wl(r["conf"])[0], -wl(r["overall"])[3], r["team"]))
            return rows, final, yr
    return None, None, None

# (old) NCAA.com fallback — its standings pages are rendered by JavaScript, so this rarely finds anything
NCAA = {"volleyball": "volleyball-women/d1", "soccer": "soccer-women/d1", "baseball": "baseball/d1", "softball": "softball/d1"}

def get_text(url):
    for i in range(3):
        try:
            time.sleep(0.3)
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (400, 404): return None
        except Exception:
            pass
        time.sleep(2 * (i + 1))
    return None

def ncaa_standings(path):
    import re
    html = get_text("https://www.ncaa.com/standings/" + path)
    if not html: return None, "no page"
    strip = lambda x: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", x)).strip()
    # find the SEC block: a heading/caption mentioning SEC or Southeastern, then the next table
    m = re.search(r">\s*(SEC|Southeastern(?: Conference)?)\s*<", html)
    if not m:
        i = html.find("Tennessee")
        return None, {"len": len(html), "title": (re.search(r"<title>(.*?)</title>", html, re.S) or [None, ""])[1][:120],
                      "secHits": [html[max(0, j.start() - 120): j.start() + 60] for j in re.finditer(r"Southeastern|>SEC", html)][:3],
                      "nearTN": html[max(0, i - 900): i + 300] if i >= 0 else None,
                      "links": sorted(set(re.findall(r'href="(/standings/[^"#?]+)"', html)))[:60],
                      "h": re.findall(r"<h[1-4][^>]*>(.*?)</h[1-4]>", html, re.S)[:15],
                      "tables": len(re.findall(r"<table", html)), "firstTable": (re.search(r"<table.*?</table>", html, re.S) or [""])[0][:900] if re.search(r"<table", html) else None}
    t = re.search(r"<table.*?</table>", html[m.end():], re.S)
    if not t: return None, "no table after SEC heading"
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", t.group(0), re.S):
        cells = [strip(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        if cells: rows.append(cells)
    head = [r for r in rows if not any(re.fullmatch(r"\d+", c) for c in r[1:])]
    body = [r for r in rows if any(re.fullmatch(r"\d+", c) for c in r[1:])]
    out = []
    for r in body:
        team = r[0]
        nums = r[1:]
        # split numeric run on percentage-looking cells: [conf W L (T)] pct [overall W L (T)] pct ...
        groups, cur = [], []
        for c in nums:
            if re.fullmatch(r"\d+", c): cur.append(c)
            elif re.fullmatch(r"-?\.?\d*\.\d+|1\.000|0?\.\d+|-", c) or "." in c:
                if cur: groups.append(cur); cur = []
            else:
                if cur: groups.append(cur); cur = []
        if cur: groups.append(cur)
        g = [x for x in groups if len(x) >= 2]
        if len(g) < 2: continue
        conf, ov = "-".join(g[0][:3]), "-".join(g[1][:3])
        out.append(dict(team=team, name=team, abbr=None, conf=conf, overall=ov, streak=None))
    dbg = {"head": head[:2], "first": body[:2]}
    return (out or None), dbg

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
            src = "ESPN"
            if (not rows or final) and k in SEC_SPORT:
                r2, f2, yr = sec_site(k)
                if r2:
                    rows, final, url, src = r2, f2, "https://www.secsports.com/standings/" + k, "SEC (secsports.com)"
                    label = yr if not f2 else last_label
            if not rows and k in NCAA:
                rows, dbg = ncaa_standings(NCAA[k])
                url = "https://www.ncaa.com/standings/" + NCAA[k]; final = False
                if rows:
                    rows.sort(key=lambda r: (-wl(r["conf"])[3], -wl(r["conf"])[0], -wl(r["overall"])[3], r["team"]))
                    final = sum(sum(wl(r["overall"])[:3]) for r in rows) > 0 and k in ("baseball", "softball")
                    label = last_label if final else label
            if rows:
                out[k] = dict(season=label, final=final, rows=rows, source=url, sourceName=src, updated=datetime.date.today().isoformat())
                print(f"OK   {k}: {len(rows)} SEC teams ({label}{' final' if final else ''})")
            else:
                print(f"SKIP {k}: no SEC standings found")
        except Exception as e:
            print(f"SKIP {k}: {e}")
    out.pop("_debug", None)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/update_standings.py from ESPN's standings feed. Do not edit by hand. */\n")
        f.write("window.SITE_AUTO = window.SITE_AUTO || {};\nwindow.SITE_AUTO.standings = " + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n")

if __name__ == "__main__":
    main([a for a in sys.argv[1:] if a in SPORTS] or None)
