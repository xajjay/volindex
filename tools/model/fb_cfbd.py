"""
The Vol Index - CollegeFootballData pulls for the football model
================================================================
Runs in the GitHub workflow (the CFBD key is a repository secret; it is not available anywhere else).
Writes one small parquet file per source into tools/cache/fbm/cfbd/ and a status.json saying what worked.

    python tools/model/fb_cfbd.py                 # everything: 2014 through this season (past seasons are skipped once saved)
    python tools/model/fb_cfbd.py 2026            # only that season (always re-fetched)

Calls are spent carefully: a past season is fetched once, the current season every run, and the script stops early if the
monthly quota is nearly used up (it reads CFBD's X-CallLimit-Remaining header).

Sources (all CFBD) and what each gives the model
    stats/game/advanced   per team per game: PPA/EPA, success, explosiveness, havoc, stuff, line yards, field position,
                          points per opportunity, standard vs passing downs, rush vs pass (the numbers the stat sites show)
    stats/season/advanced the same per season
    ppa/players/season    each player's PPA (points added) by position  -> player value
    player/usage          each player's share of the offense's plays
    player/returning      returning production (offense / defense, passing / rushing / receiving / tackles / sacks)
    talent                247 team talent composite by year
    recruiting/teams      recruiting class rank and points
    player/portal         transfer portal movement
    coaches               head coaches and their records by season
    lines                 betting lines by game and sportsbook (opening and closing)
    metrics/wp/pregame    pregame win probability and spread
    ratings/sp, fpi, elo  published power ratings by year
    rankings              weekly AP / coaches polls
    games                 schedule, attendance, venue, excitement
    venues                stadium capacity, surface, dome, elevation
"""
import json, os, sys, time, datetime, urllib.request, urllib.error
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "tools", "cache", "fbm", "cfbd")
CFBD = "https://api.collegefootballdata.com"
KEY = os.environ.get("CFBD_API_KEY", "")
THIS = datetime.date.today().year
LOW = 120                         # stop when fewer calls than this are left this month
STATUS = {}
state = {"remaining": None}


def call(path, **params):
    q = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in params.items())
    url = f"{CFBD}{path}" + (f"?{q}" if q else "")
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={"Authorization": f"Bearer {KEY}", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                rem = r.headers.get("X-CallLimit-Remaining")
                if rem is not None: state["remaining"] = int(rem)
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (401, 403): raise SystemExit(f"CFBD refused the key ({e.code})")
            if e.code == 429: raise SystemExit("CFBD quota exhausted (429)")
            if i == 2: raise
        except Exception:
            if i == 2: raise
        time.sleep(2 * (i + 1))


def flat(rows):
    """Nested dicts -> flat columns (offense.ppa -> offense_ppa); lists are dropped to a JSON string."""
    df = pd.json_normalize(rows, sep="_")
    for c in df.columns:
        if df[c].map(lambda v: isinstance(v, (list, dict))).any():
            df[c] = df[c].map(lambda v: json.dumps(v) if isinstance(v, (list, dict)) else v)
    return df


def save(name, df, year=None):
    path = os.path.join(OUT, f"{name}.parquet")
    if year is not None and os.path.exists(path):
        old = pd.read_parquet(path)
        if "season" in old.columns: old = old[old["season"] != year]
        df = pd.concat([old, df], ignore_index=True)
    df.to_parquet(path + ".tmp"); os.replace(path + ".tmp", path)


def have(name, year):
    path = os.path.join(OUT, f"{name}.parquet")
    if not os.path.exists(path): return False
    try: return year in set(pd.read_parquet(path, columns=["season"])["season"])
    except Exception: return False


def pull(name, path, year, explode=None, **extra):
    """One endpoint for one season. Past seasons already saved are skipped."""
    if year != THIS and have(name, year): return
    if state["remaining"] is not None and state["remaining"] < LOW:
        STATUS.setdefault(name, {})[year] = "skipped: quota"; return
    try:
        rows = call(path, year=year, **extra)
        if explode: rows = explode(rows)
        df = flat(rows) if rows else pd.DataFrame()
        if len(df) == 0: STATUS.setdefault(name, {})[year] = "0 rows"; return
        df["season"] = year
        save(name, df, year)
        STATUS.setdefault(name, {})[year] = f"{len(df)} rows"
    except SystemExit: raise
    except Exception as e:
        STATUS.setdefault(name, {})[year] = f"FAILED: {str(e)[:120]}"


def x_lines(rows):                       # one row per game per sportsbook
    out = []
    for g in rows:
        for l in g.get("lines") or []:
            out.append({"id": g.get("id"), "week": g.get("week"), "seasonType": g.get("seasonType"), "startDate": g.get("startDate"),
                        "homeTeam": g.get("homeTeam"), "awayTeam": g.get("awayTeam"), "homeScore": g.get("homeScore"),
                        "awayScore": g.get("awayScore"), **l})
    return out


def x_rank(rows):                        # one row per team per poll per week
    out = []
    for w in rows:
        for p in w.get("polls") or []:
            for r in p.get("ranks") or []:
                out.append({"week": w.get("week"), "seasonType": w.get("seasonType"), "poll": p.get("poll"), **r})
    return out


def x_coaches(rows):
    out = []
    for c in rows:
        for s in c.get("seasons") or []:
            out.append({"first": c.get("firstName"), "last": c.get("lastName"), "hireDate": c.get("hireDate"), **s})
    return out


def main():
    if not KEY: sys.exit("No CFBD_API_KEY in the environment")
    os.makedirs(OUT, exist_ok=True)
    a = [int(x) for x in sys.argv[1:]]
    years = a if a else list(range(2014, THIS + 1))
    # current season first, then newest to oldest, so a quota stop costs the least-useful years
    years = sorted(years, key=lambda y: (y != THIS, -y))
    for y in years:
        pull("game_adv", "/stats/game/advanced", y, excludeGarbageTime="true")
        pull("season_adv", "/stats/season/advanced", y, excludeGarbageTime="true")
        pull("ppa_teams", "/ppa/teams", y, excludeGarbageTime="true")
        pull("talent", "/talent", y)
        pull("returning", "/player/returning", y)
        pull("recruiting", "/recruiting/teams", y)
        pull("portal", "/player/portal", y)
        pull("lines", "/lines", y, explode=x_lines)
        pull("pregame_wp", "/metrics/wp/pregame", y)
        pull("sp", "/ratings/sp", y)
        pull("fpi", "/ratings/fpi", y)
        pull("elo", "/ratings/elo", y)
        pull("rankings", "/rankings", y, explode=x_rank)
        pull("games", "/games", y, seasonType="both")
        pull("coaches", "/coaches", y, explode=x_coaches)
        if y >= 2019:                    # player tables are big; the model uses recent seasons
            pull("ppa_players", "/ppa/players/season", y, excludeGarbageTime="true")
            pull("usage", "/player/usage", y, excludeGarbageTime="true")
    # venues are not seasonal
    vp = os.path.join(OUT, "venues.parquet")
    if not os.path.exists(vp):
        try:
            save("venues", flat(call("/venues"))); STATUS["venues"] = "ok"
        except SystemExit: raise
        except Exception as e: STATUS["venues"] = f"FAILED: {str(e)[:120]}"
    STATUS["_calls_remaining"] = state["remaining"]
    STATUS["_ran"] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    with open(os.path.join(OUT, "status.json"), "w") as f: json.dump(STATUS, f, indent=1, default=str)
    bad = {k: v for k, v in STATUS.items() if any("FAILED" in str(x) for x in (v.values() if isinstance(v, dict) else [v]))}
    print(json.dumps(STATUS, indent=1, default=str)[:3000])
    if bad: print("Some pulls failed:", list(bad))


if __name__ == "__main__":
    main()
