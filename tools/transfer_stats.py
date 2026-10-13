"""
The Vol Index - last-season stats for basketball transfers
==========================================================
For every men's and women's basketball player who transferred in (roster "prev" school) and has
no Tennessee stats from last season, look the player up on ESPN and save last season's averages
(games, points, rebounds, assists) and school. Writes data/transfer-stats.js, used by the
projected lineup and player cards. Results are cached, so each player is only looked up once.

Run:  python tools/transfer_stats.py        (also runs every morning from auto_schedule.py)
"""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "transfer-stats.js")
UA = {"User-Agent": "Mozilla/5.0 (VolIndex fan site; transfer stats)"}
SPORTS = {"mbb": ("mens-college-basketball", 2026, "2025-26"), "wbb": ("womens-college-basketball", 2026, "2025-26"), "baseball": ("college-baseball", 2026, "2026")}
SPORT_PATH = {"mens-college-basketball": "basketball", "womens-college-basketball": "basketball", "college-baseball": "baseball"}

def get(url):
    for i in range(3):
        try:
            time.sleep(0.35)
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            if e.code in (400, 404): return None
        except Exception:
            pass
        time.sleep(2 * (i + 1))
    return None

def norm(s): return re.sub(r"[^a-z ]", "", (s or "").lower().replace("jr.", "").replace(" ii", "").replace(" iii", "")).strip()

def site_json(key):
    t = open(os.path.join(DATA, f"{key}.js"), encoding="utf-8").read()
    return json.loads(t.split(f"window.SITE.{key} = ", 1)[1].rsplit(";", 1)[0])

def tennessee_names(key):
    """Players who already have Tennessee stats last season (no lookup needed)."""
    try:
        t = open(os.path.join(DATA, f"{key}-auto.js"), encoding="utf-8").read()
        a = json.loads(t.split(f"window.SITE_AUTO['{key}'] = ", 1)[1].rsplit(";", 1)[0])
        rows = (a.get("stats") or {}).get("tables", {}).get("individualStats", [])
        return {norm(r["name"]) for r in rows if str((r.get("s") or {}).get("gamesPlayed") or "0") not in ("0", "")}
    except Exception:
        return set()

DEBUG = {}
def find_athlete(name, league):
    d = get("https://site.web.api.espn.com/apis/common/v3/search?" + urllib.parse.urlencode({"query": name, "limit": 25, "type": "player"}))
    items = []
    for blk in (d or {}).get("results", []) or []:
        items += blk.get("contents", []) or []
    items += (d or {}).get("items", []) or []
    for it in items:
        blob = json.dumps(it).lower()
        if league in blob and norm(it.get("displayName") or it.get("name")) == norm(name):
            uid = it.get("uid") or ""; m = re.search(r"a:(\d+)", uid)
            aid = it.get("id") if str(it.get("id", "")).isdigit() else (m.group(1) if m else None)
            if aid: return aid
    if len(DEBUG) < 3: DEBUG[name] = {"keys": list((d or {}).keys())[:10], "items": [json.dumps(it)[:400] for it in items[:3]]}
    return None

BDEBUG = {}
def baseball_line(aid, season):
    """Last season at the previous school: batting (AVG, HR, RBI) and/or pitching (ERA, IP, K)."""
    d = get(f"https://site.web.api.espn.com/apis/common/v3/sports/baseball/college-baseball/athletes/{aid}/stats")
    if not d: return None
    teams = {str(t.get("id")): t.get("location") or t.get("displayName") for t in (d.get("teams") or {}).values()} if isinstance(d.get("teams"), dict) else {}
    out, team = {}, None
    for cat in d.get("categories", []) or []:
        labels = [l.upper() for l in cat.get("labels") or cat.get("names") or []]
        if len(BDEBUG) < 4: BDEBUG.setdefault(str(aid), []).append({"name": cat.get("name"), "labels": labels[:25], "years": [(r.get("season") or {}).get("year") for r in cat.get("statistics", []) or []]})
        for row in cat.get("statistics", []) or []:
            if (row.get("season") or {}).get("year") != season: continue
            v = dict(zip(labels, row.get("stats") or []))
            team = team or teams.get(str(row.get("teamId"))) or row.get("teamSlug")
            nm = (cat.get("name") or "").lower()
            if ("bat" in nm or "AVG" in v and "AB" in v) and "bat" not in out:
                out["bat"] = {k: v.get(k) for k in ("GP", "AB", "R", "H", "HR", "RBI", "AVG", "OBP", "SLG", "OPS", "SB")}
            if ("pitch" in nm or "ERA" in v) and "pitch" not in out:
                out["pitch"] = {k: v.get(k) for k in ("GP", "GS", "W", "L", "SV", "IP", "H", "ER", "BB", "K", "SO", "ERA", "WHIP")}
    if not out: return None
    out["team"] = team
    return out

def season_line(aid, league, season):
    d = get(f"https://site.web.api.espn.com/apis/common/v3/sports/basketball/{league}/athletes/{aid}/stats")
    if not d: return None
    teams = {str(t.get("id")): t.get("location") or t.get("displayName") for t in (d.get("teams") or {}).values()} if isinstance(d.get("teams"), dict) else {}
    for cat in d.get("categories", []) or []:
        if (cat.get("name") or "").lower() not in ("averages", "pergame"): continue
        labels = [l.upper() for l in cat.get("labels") or cat.get("names") or []]
        for row in cat.get("statistics", []) or []:
            yr = (row.get("season") or {}).get("year")
            if yr != season: continue
            vals = dict(zip(labels, row.get("stats") or []))
            team = teams.get(str(row.get("teamId"))) or row.get("teamSlug") or (row.get("team") or {}).get("displayName")
            return dict(gp=vals.get("GP"), ppg=vals.get("PTS"), rpg=vals.get("REB"), apg=vals.get("AST"), team=team)
    return None

def main():
    try:
        t = open(OUT, encoding="utf-8").read()
        out = json.loads(t.split("window.SITE_AUTO.transfers = ", 1)[1].rsplit(";", 1)[0])
    except Exception:
        out = {}
    for key, (league, season, label) in SPORTS.items():
        D = site_json(key); have = tennessee_names(key)
        bucket = out.setdefault(key, {})
        for p in D.get("roster", []):
            name = p.get("name")
            done = bucket.get(name) or {}
            if not p.get("prev") or norm(name) in have or ((done.get("ppg") or done.get("bat") or done.get("pitch")) and done.get("v") == 2): continue
            try:
                aid = find_athlete(name, league)
                if key == "baseball":
                    line = baseball_line(aid, season) if aid else None
                    if line:
                        line.update(season=label, espnId=aid, v=2); bucket[name] = line
                        print(f"OK   {key} {name}: {line.get('bat') or ''} {line.get('pitch') or ''} at {line.get('team')}")
                    else:
                        print(f"SKIP {key} {name}: {'no ESPN match' if not aid else 'no ' + label + ' line'}")
                    continue
                line = season_line(aid, league, season) if aid else None
                if line and line.get("ppg") is not None:
                    line.update(season=label, espnId=aid, v=2); bucket[name] = line
                    print(f"OK   {key} {name}: {line['ppg']} ppg at {line.get('team')}")
                else:
                    print(f"SKIP {key} {name}: {'no ESPN match' if not aid else 'no ' + label + ' line'}")
            except Exception as e:
                print(f"SKIP {key} {name}: {e}")
    out["_debug"] = DEBUG; out["_bdebug"] = BDEBUG
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/transfer_stats.py from ESPN. Last-season averages for incoming basketball transfers. */\n")
        f.write("window.SITE_AUTO = window.SITE_AUTO || {};\nwindow.SITE_AUTO.transfers = " + json.dumps(out, indent=1, ensure_ascii=False) + ";\n")

if __name__ == "__main__":
    main()
