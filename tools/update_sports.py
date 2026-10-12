"""
The Vol Index - updater for volleyball, soccer, basketball, baseball and softball
================================================================================
Reads the structured data behind utsports.com (the official Tennessee athletics
site) and ESPN's public rankings feed, then writes data/<sport>-auto.js. The site
layers that file over data/<sport>.js, so anything here wins.

What it updates for each sport:
  * Schedule, results, start times, TV, links to watch / live stats
  * Season stats for every player and the team (us vs. opponents)
  * Box scores for every finished game (saved once in tools/cache)
  * Series history vs. upcoming opponents
  * Past seasons' schedules and results (saved once in tools/cache)
  * The sport's main poll ranking where a free feed exists

Run one sport:   python tools/update_sports.py volleyball
Run all:         python tools/update_sports.py
No API key needed.
"""
import datetime, json, os, re, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, "tools", "cache")
BASE = "https://utsports.com"
UA = {"User-Agent": "Mozilla/5.0 (compatible; VolIndexBot/1.0; fan site; +https://github.com/xajjay/volindex)"}
sys.setrecursionlimit(20000)

# season = the season shown on the site; last = previous season (stats shown until the new one starts)
SPORTS = {
    "volleyball": dict(slug="womens-volleyball", season="2026", last="2025", espn=None),
    "soccer":     dict(slug="womens-soccer", season="2026", last="2025", espn=None),
    "mbb":        dict(slug="mens-basketball", season="2026-27", last="2025-26", espn="basketball/mens-college-basketball"),
    "wbb":        dict(slug="womens-basketball", season="2026-27", last="2025-26", espn="basketball/womens-college-basketball"),
    "baseball":   dict(slug="baseball", season="2027", last="2026", espn="baseball/college-baseball"),
    "softball":   dict(slug="softball", season="2027", last="2026", espn=None),   # no free poll feed; preseason poll set by hand in January
}

log = []
def note(msg):
    print(msg); log.append(msg)

def fetch(url, tries=3, binary=False):
    for i in range(tries):
        try:
            time.sleep(0.4)                      # be polite to utsports.com
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                b = r.read()
                return b if binary else b.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            if i == tries - 1: raise
        except Exception:
            if i == tries - 1: raise
        time.sleep(2 * (i + 1))
    return None

def cached(name, fn, keep=True):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name + ".json")
    if keep and os.path.exists(p):
        with open(p, encoding="utf-8") as f: return json.load(f)
    d = fn()
    if d is not None:
        with open(p, "w", encoding="utf-8") as f: json.dump(d, f, separators=(",", ":"))
    return d

# ---------------------------------------------------------------- Nuxt payload (utsports.com pages)
WRAP = {"Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "Set", "Map", "Date", "NuxtError"}
def nuxt(path):
    html = fetch(BASE + path)
    if not html: return None
    m = re.search(r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m: return None
    arr = json.loads(m.group(1)); memo = {}
    def hy(i):
        if not isinstance(i, int) or isinstance(i, bool): return i
        if i < 0: return None
        if i in memo: return memo[i]
        v = arr[i]
        if isinstance(v, list):
            if v and isinstance(v[0], str) and v[0] in WRAP:
                r = hy(v[1]) if len(v) > 1 else None; memo[i] = r; return r
            out = []; memo[i] = out
            out.extend(hy(x) for x in v); return out
        if isinstance(v, dict):
            o = {}; memo[i] = o
            for k, x in v.items(): o[k] = hy(x)
            return o
        memo[i] = v; return v
    return hy(0)

def first_value(d):
    return next(iter(d.values())) if isinstance(d, dict) and d else None

SKIP = re.compile(r"(Url|Image|image|logo|Logo|Id|^id$|^code$|checkName|nameFromStats|isAFooterStat|playerUniform2|meetsMin|^venue$|^scoreSummary$|^breakdowns$)")
def flat_stats(p):
    """Player/team stat dict -> {field: value}; nested *Stats dicts become prefixed fields."""
    out = {}
    for k, v in (p or {}).items():
        if SKIP.search(k): continue
        if isinstance(v, dict):                      # nested groups: attackStats, shots, goalie, penalties ...
            for s, x in v.items():
                if isinstance(x, (str, int, float)) and x not in ("", None):
                    out[k + s[0].upper() + s[1:]] = x
        elif isinstance(v, (str, int, float)) and v not in ("", None) and not isinstance(v, bool):
            out[k] = v
    return out

def first_last(name):
    """'Rogers, Kennedi' -> 'Kennedi Rogers'"""
    if name and "," in name:
        last, first = [x.strip() for x in name.split(",", 1)]
        return f"{first} {last}".strip()
    return name

# ---------------------------------------------------------------- schedule
def schedule(slug, season):
    d = nuxt(f"/sports/{slug}/schedule/{season}")
    if not d: return None
    sc = (d.get("pinia") or {}).get("schedule") or {}
    games = None
    def find(o, depth=0):
        nonlocal games
        if games is not None or depth > 7: return
        if isinstance(o, list) and o and isinstance(o[0], dict) and "opponent" in o[0] and "date" in o[0]:
            games = o; return
        if isinstance(o, dict):
            for v in o.values(): find(v, depth + 1)
        elif isinstance(o, list):
            for v in o: find(v, depth + 1)
    find(sc)
    rows = []
    for g in games or []:
        opp = g.get("opponent") or {}
        res = g.get("result") or {}
        media = g.get("media") or {}
        box = (res.get("boxscore") or {}).get("url")
        status = res.get("status")
        title = (opp.get("title") or "").strip()
        exh = bool(re.search(r"\(Exh\.?\)|exhibition", title, re.I))
        row = dict(id=g.get("id"), date=(g.get("date") or "")[:10], time=g.get("time"), exh=exh,
                   opp=re.sub(r"\s*\((Exh\.?|Exhibition|Scrimmage)\)", "", title, flags=re.I).strip(), site={"H": "H", "A": "A"}.get(g.get("location_indicator"), "N"),
                   loc=g.get("location"), conf=bool(g.get("conference")), type=g.get("type"),
                   tv=media.get("tv") or None, watch=(media.get("video") or {}).get("url"),
                   live=(media.get("stats") or {}).get("url"), history=g.get("opponent_history_path"),
                   tournament=g.get("event_name") or None)
        if status in ("W", "L", "T"):
            row.update(result=status, us=res.get("team_score"), them=res.get("opponent_score"),
                       note=(res.get("postscore_info") or "").strip() or None, box=box)
        rows.append(row)
    return rows

# ---------------------------------------------------------------- season stats
def season_stats(slug, season):
    d = nuxt(f"/sports/{slug}/stats/{season}")
    if not d: return None
    cs = first_value(((d.get("pinia") or {}).get("statsSeason") or {}).get("cumulativeStats"))
    if not cs: return None
    tables = {}
    def walk(o, prefix):
        for k, v in (o or {}).items():
            if "Conference" in k: continue
            if isinstance(v, list) and v and isinstance(v[0], dict) and "playerName" in v[0]:
                rows = []
                for p in v:
                    if p.get("isAFooterStat"): continue
                    rows.append(dict(name=first_last(p.get("playerName")), num=p.get("playerUniform") or p.get("uniform"),
                                     url=p.get("playerUrl"), s=flat_stats(p)))
                tables[prefix + k] = rows
            elif isinstance(v, dict):
                walk(v, prefix + k + ".")
    walk(cs.get("overallIndividualStats"), "")
    team = (cs.get("overallTeamStats") or {}).get("teamStats") or {}
    ours = {k[3:]: v for k, v in team.items() if k.startswith("our") and isinstance(v, (str, int, float))}
    opp = {k[8:]: v for k, v in team.items() if k.startswith("opponent") and isinstance(v, (str, int, float))}
    return dict(season=season, record=cs.get("record"), tables=tables, team=dict(us=ours, opp=opp))

# ---------------------------------------------------------------- box scores
def box_score(url):
    d = nuxt(url)
    if not d: return None
    b = first_value(((d.get("pinia") or {}).get("boxscore") or {}).get("boxscore"))
    if not b: return None
    def team(t, home):
        if not t: return None
        players = []
        for p in t.get("players") or []:
            players.append(dict(name=p.get("playerFirstLastName") or first_last(p.get("name")), num=p.get("uniform"), s=flat_stats(p)))
        tot = flat_stats({k: v for k, v in t.items() if k.endswith("Stats")})
        if isinstance(t.get("totals"), dict): tot.update(flat_stats(t["totals"]))
        return dict(name=t.get("name"), rank=t.get("rank") or None, record=t.get("record"), home=home,
                    score=(t.get("scoreSummary") or {}).get("score") or (b.get("homeTeamScore") if home else b.get("visitingTeamScore")),
                    players=players, totals=tot)
    v = b.get("venue") or {}
    teams = [x for x in (team(b.get("visitingTeam"), False), team(b.get("homeTeam"), True)) if x]
    return dict(date=v.get("date"), stadium=v.get("stadium"), location=v.get("location"), attendance=v.get("attendance"),
                periodLabel=b.get("periodLabel"), periods=b.get("periods"),
                periodsAway=b.get("periodScoresAway"), periodsHome=b.get("periodScoresHome"),
                teams=teams, url=BASE + url)

# ---------------------------------------------------------------- series history
def series(path):
    d = nuxt(path)
    if not d: return None
    oh = first_value(((d.get("pinia") or {}).get("opponentHistory") or {}).get("opponentHistory"))
    if not oh: return None
    w = l = t = 0; games = []
    for r in oh.get("results") or []:
        s = r.get("resultStatus")
        if s == "W": w += 1
        elif s == "L": l += 1
        elif s == "T": t += 1
        else: continue
        games.append([(r.get("gameDate") or "")[:10], s, r.get("teamScore"), r.get("opponentScore"), r.get("gameLocationIndicator")])
    games.sort()
    return dict(name=(oh.get("opponent") or {}).get("name"), w=w, l=l, t=t, first=games[0][0][:4] if games else None, last=games[-6:])

# ---------------------------------------------------------------- polls (ESPN public rankings feed)
def espn_poll(path):
    j = json.loads(fetch(f"https://site.api.espn.com/apis/site/v2/sports/{path}/rankings") or "{}")
    for p in j.get("rankings") or []:
        name = p.get("name") or p.get("shortName") or ""
        if not re.search(r"AP|Coaches|USA TODAY|D1Baseball|NFCA", name, re.I): continue
        rank = None
        for r in p.get("ranks") or []:
            t = r.get("team") or {}
            if (t.get("location") or t.get("nickname") or "") == "Tennessee": rank = r.get("current")
        others = [x for x in p.get("others") or [] if ((x.get("team") or {}).get("location") == "Tennessee")]
        return dict(poll=name, rank=rank or "NR", votes=bool(others), date=(p.get("date") or "")[:10],
                    top=[[r.get("current"), (r.get("team") or {}).get("location")] for r in (p.get("ranks") or [])[:25]])
    return None

# ---------------------------------------------------------------- polls without a feed (official poll pages)
def avca_poll():
    html = fetch("https://www.avca.org/polls-awards/polls/?_season=%d&_divisions=division-i-women" % datetime.date.today().year)
    if not html: return None
    t = re.search(r"Division I WVB Poll\s*-\s*([A-Z][a-z]+\.?\s*\d+)", html)
    m = re.search(r"<td>\s*<p>\s*(\d+)\s*</p>\s*</td>\s*<td>\s*<p>\s*Tennessee\s*</p>", html)
    return dict(poll="AVCA Coaches Poll", rank=int(m.group(1)) if m else "NR", label=t.group(1) if t else None,
                date=_poll_date(t.group(1)) if t else None)

def usc_poll():
    html = fetch("https://unitedsoccercoaches.org/rankings/college-rankings/ncaa-di-women/")
    if not html: return None
    for part in re.split(r"<h2[^>]*>", html):
        h = re.match(r"\s*National\s*-\s*([^<]+?)\s*</h2>", part)
        if not h: continue                                   # first "National - Poll N - date" block is the latest
        table = part.split("</table>", 1)[0]
        m = re.search(r'tdRank">\s*(\d+)\s*</td>\s*<td class="tdSchool">\s*University of Tennessee\s*</td>', table)
        d = re.search(r"([A-Z][a-z]+ \d+, \d{4})", h.group(1))
        return dict(poll="United Soccer Coaches", rank=int(m.group(1)) if m else "NR", label=h.group(1),
                    date=datetime.datetime.strptime(d.group(1), "%B %d, %Y").date().isoformat() if d else None)
    return None

def _poll_date(label):
    """'Oct. 5' -> ISO date in the current season."""
    try:
        mon, day = re.match(r"([A-Za-z]+)\.?\s*(\d+)", label).groups()
        m = datetime.datetime.strptime(mon[:3], "%b").month
        y = datetime.date.today().year
        return datetime.date(y, m, int(day)).isoformat()
    except Exception:
        return None

POLL_FN = {"volleyball": avca_poll, "soccer": usc_poll}

# ---------------------------------------------------------------- one sport
def run_sport(key):
    cfg = SPORTS[key]; slug = cfg["slug"]
    out = dict(updated=datetime.date.today().isoformat(), season=cfg["season"])
    note(f"== {key}")
    try:
        sch = schedule(slug, cfg["season"])
        if sch: out["schedule"] = sch; note(f"OK   schedule ({len(sch)} games)")
    except Exception as e: note(f"SKIP schedule: {e}"); sch = None
    played = [g for g in (sch or []) if g.get("result")]
    stats_season = cfg["season"] if played else cfg["last"]
    try:
        st = cached(f"{key}-stats-{stats_season}", lambda: season_stats(slug, stats_season), keep=(stats_season != cfg["season"]))
        if st: out["stats"] = st; note(f"OK   stats {stats_season} ({sum(len(v) for v in st['tables'].values())} rows)")
    except Exception as e: note(f"SKIP stats: {e}")
    box = {}
    for g in played:
        if not g.get("box"): continue
        try:
            b = cached(f"{key}-box-{g['id']}", lambda u=g["box"]: box_score(u))
            if b: box[str(g["id"])] = b
        except Exception as e: note(f"SKIP box {g['opp']}: {e}")
    if box: out["box"] = box; note(f"OK   box scores ({len(box)})")
    ser = {}
    today = datetime.date.today().isoformat()
    upcoming = [g for g in (sch or []) if not g.get("result") and g.get("history") and (g.get("date") or "") >= today]
    for g in upcoming[:12]:
        try:
            s = series(g["history"])
            if s: ser[g["opp"]] = s
        except Exception as e: note(f"SKIP series {g['opp']}: {e}")
    if ser: out["series"] = ser; note(f"OK   series history ({len(ser)} opponents)")
    if cfg.get("espn") or key in POLL_FN:
        try:
            p = POLL_FN[key]() if key in POLL_FN else espn_poll(cfg["espn"])
            if p: out["poll"] = p; note(f"OK   poll: {p['poll']} {p['rank']}")
        except Exception as e: note(f"SKIP poll: {e}")
    out["log"] = list(log)
    path = os.path.join(DATA, f"{key}-auto.js")
    prev = {}
    try:
        t = open(path, encoding="utf-8").read()
        prev = json.loads(t.split(f"window.SITE_AUTO['{key}'] = ", 1)[1].rsplit(";", 1)[0])
    except Exception: pass
    for k, v in prev.items():
        if k not in out: out[k] = v              # keep last run's data for anything that failed this time
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"/* Written by tools/update_sports.py on {out['updated']} from utsports.com and ESPN. Do not edit by hand. */\n")
        f.write(f"window.SITE_AUTO = window.SITE_AUTO || {{}};\nwindow.SITE_AUTO['{key}'] = " + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n")
    note(f"Wrote {path}")

def past_seasons(key, seasons):
    """Schedules/results of earlier seasons for the History tab (cached forever)."""
    cfg = SPORTS[key]; out = {}
    for s in seasons:
        try:
            rows = cached(f"{key}-sched-{s}", lambda s=s: schedule(cfg["slug"], s))
            if rows: out[s] = [[g["date"], g["opp"], g["site"], g.get("result"), g.get("us"), g.get("them"), g.get("conf"), g.get("tournament") or g.get("note") or ""] for g in rows]
        except Exception as e:
            note(f"SKIP {key} {s}: {e}")
    path = os.path.join(DATA, f"{key}-history-auto.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/update_sports.py from utsports.com. Do not edit by hand. */\n")
        f.write(f"window.SITE_AUTO = window.SITE_AUTO || {{}};\nwindow.SITE_AUTO['{key}History'] = " + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n")
    note(f"OK   past seasons ({len(out)})")

def history_seasons(key):
    """Season labels from the History tab of data/<key>.js."""
    try:
        t = open(os.path.join(DATA, f"{key}.js"), encoding="utf-8").read()
        d = json.loads(t.split(f"window.SITE.{key} = ", 1)[1].rsplit(";", 1)[0])
        h = d.get("history") or {}
        rows = h.get("seasons", []) if isinstance(h, dict) else h
        return [str(r.get("season")) for r in rows if r.get("season")]
    except Exception:
        return []

def make_runner(key):
    def run():
        del log[:]
        run_sport(key)
        past_seasons(key, history_seasons(key))
    return run

if __name__ == "__main__":
    keys = [a for a in sys.argv[1:] if a in SPORTS] or list(SPORTS)
    for k in keys: make_runner(k)()
