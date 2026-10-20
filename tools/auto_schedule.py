"""
The Vol Index - automatic update schedule
=========================================
Runs every morning (GitHub Actions, or `python tools/update_data.py --auto` by hand)
and decides what needs refreshing today, so nothing has to be updated manually:

  * the morning after a game          -> that sport's results, stats, box scores
  * the morning after each sport's poll comes out (see POLL_DAY):
      football AP/Coaches  Sunday afternoon  -> Monday run
      volleyball AVCA      Monday            -> Tuesday run
      basketball AP (M/W)  Monday            -> Tuesday run
      baseball polls       Monday            -> Tuesday run
      soccer (United Soccer Coaches) Tuesday -> Wednesday run
      softball NFCA        Tuesday           -> Wednesday run
  * Thursday                          -> football lines, TV and win chances for the weekend
  * Monday                            -> weekly full refresh of everything
  * any sport with no data yet        -> refreshed right away

Game nights (--gameday, every 15 minutes from noon to 3 AM Eastern): each run asks ESPN's scoreboard
whether today's Tennessee game is final. The moment it is, that sport refreshes (result, record,
box score, season stats), and it keeps refreshing on the next runs until the site has the result
and the box score, plus one last pass about an hour later once stat providers settle. Before the
final, or on days with no game, the run does nothing and costs nothing.

Use --force to update everything regardless of the day.
Writes data/updated.js with the date each sport was last refreshed (shown on the site).
"""
import datetime, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
STAMP = os.path.join(DATA, "updated.js")

def now_et():
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("America/New_York")).replace(tzinfo=None)
    except Exception:   # no tz database: UTC-4 (EDT) Mar-Nov, UTC-5 otherwise
        now = datetime.datetime.utcnow()
        return now - datetime.timedelta(hours=4 if 3 <= now.month <= 10 else 5)

def today_et():
    return now_et().date()

def read_js_json(path, marker):
    try:
        t = open(path, encoding="utf-8").read()
        return json.loads(t.split(marker, 1)[1].rsplit(";", 1)[0])
    except Exception:
        return None

def game_dates(sport):
    """Dates of this sport's games, from the site's own data."""
    if sport == "football":
        a = read_js_json(os.path.join(DATA, "football-auto.js"), "window.SITE_AUTO.football = ")
        if a and a.get("schedule"): return {g["date"] for g in a["schedule"]}
        b = read_js_json(os.path.join(DATA, "football.js"), "window.SITE.football = ")
        return {g["date"] for g in (b or {}).get("schedule", [])}
    d = read_js_json(os.path.join(DATA, f"{sport}.js"), f"window.SITE.{sport} = ")
    return {g["date"] for g in (d or {}).get("schedule", []) if g.get("date")}

def load_stamps():
    try:
        t = open(STAMP, encoding="utf-8").read()
        return json.loads(t.split("window.SITE_UPDATED = ", 1)[1].rsplit(";", 1)[0])
    except Exception:
        return {}

def save_stamps(st):
    with open(STAMP, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/auto_schedule.py: when each sport's data was last refreshed. */\n")
        f.write("window.SITE_UPDATED = " + json.dumps(st, indent=1, sort_keys=True) + ";\n")

# weekday of the morning run after each poll is released (Mon=0 ... Sun=6)
POLL_DAY = {"football": 0, "volleyball": 1, "mbb": 1, "wbb": 1, "baseball": 1, "soccer": 2, "softball": 2}

def reasons_for(sport, day, stamps, force):
    """Why this sport should update today (empty list = skip)."""
    why = []
    if force: why.append("forced")
    if sport not in stamps: why.append("no data yet")
    dates = game_dates(sport)
    y1, y2 = (day - datetime.timedelta(days=1)).isoformat(), (day - datetime.timedelta(days=2)).isoformat()
    if day.isoformat() in dates: why.append("game today")      # evening runs pick up finals within ~30 min
    if y1 in dates: why.append("game yesterday")
    elif y2 in dates and day.weekday() == 0: why.append("weekend game")     # Saturday games caught again Monday
    if day.weekday() == POLL_DAY.get(sport, 0): why.append("new poll out")
    if day.weekday() == 0 and "new poll out" not in why: why.append("weekly refresh")
    if sport == "football" and day.weekday() == 3: why.append("lines and TV for the weekend")
    return why

# sport -> function that refreshes it. Phase 2 adds the other sports here.
def updaters():
    import update_data, update_sports
    out = {"football": update_data.run_football}
    for k in update_sports.SPORTS: out[k] = update_sports.make_runner(k)
    return out

# ---------------------------------------------------------------- game nights
ESPN = "https://site.api.espn.com/apis/site/v2/sports/"
ESPN_PATH = {"football": "football/college-football?groups=80", "volleyball": "volleyball/womens-college-volleyball?",
             "soccer": "soccer/usa.ncaa.w.1?", "mbb": "basketball/mens-college-basketball?groups=50",
             "wbb": "basketball/womens-college-basketball?groups=50", "baseball": "baseball/college-baseball?",
             "softball": "softball/college-softball?"}
GAMEDAY = os.path.join(ROOT, "tools", "cache", "gameday.json")

def espn_final(sport, date):
    """True when ESPN shows Tennessee's game on this date as completed; False if not yet; None if unknown."""
    import urllib.request
    path, _, q = ESPN_PATH[sport].partition("?")
    url = f"{ESPN}{path}/scoreboard?dates={date.replace('-', '')}&limit=500" + (f"&{q}" if q else "")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "VolIndexBot/1.0"}), timeout=20) as r:
            d = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print(f"   ESPN scoreboard unreachable for {sport}: {e}"); return None
    for ev in d.get("events", []):
        comp = (ev.get("competitions") or [{}])[0]
        if any(c.get("team", {}).get("abbreviation") == "TENN" or c.get("team", {}).get("location") == "Tennessee"
               for c in comp.get("competitors", [])):
            ty = (ev.get("status") or comp.get("status") or {}).get("type", {})
            return bool(ty.get("completed")) and ty.get("state") == "post"
    return None

def site_has_final(sport, date):
    """Does the site's data already have this game's result and box score?"""
    if sport == "football":
        a = read_js_json(os.path.join(DATA, "football-auto.js"), "window.SITE_AUTO.football = ") or {}
        g = next((g for g in a.get("schedule", []) if g.get("date") == date), None)
        return bool(g and g.get("result") and g.get("opp") in (a.get("box") or {}))
    a = read_js_json(os.path.join(DATA, f"{sport}-auto.js"), f"window.SITE_AUTO['{sport}'] = ") or {}
    gs = [g for g in a.get("schedule", []) if g.get("date") == date and not g.get("exh")] or \
         [g for g in a.get("schedule", []) if g.get("date") == date]
    return bool(gs) and all(g.get("result") and str(g.get("id")) in (a.get("box") or {}) for g in gs)

def gameday_due(day, now):
    """Sports whose game just went final and still need a refresh. Updates tools/cache/gameday.json."""
    try: st = json.load(open(GAMEDAY, encoding="utf-8"))
    except Exception: st = {}
    st = {k: v for k, v in st.items() if k.split("|")[1] >= (day - datetime.timedelta(days=3)).isoformat()}
    due = []
    dates = [day.isoformat()] + ([(day - datetime.timedelta(days=1)).isoformat()] if now.hour < 4 else [])
    for sport in ESPN_PATH:
        gd = game_dates(sport)
        for date in dates:
            if date not in gd: continue
            k = f"{sport}|{date}"; s = st.get(k, {})
            if s.get("done"): continue
            if not s.get("final"):
                f = espn_final(sport, date)
                print(f"   {sport} {date}: {'final' if f else 'not final yet' if f is False else 'not on ESPN'}")
                if not f: continue
                s["final"] = now.isoformat(timespec="minutes")
            fin = datetime.datetime.fromisoformat(s["final"])
            have = site_has_final(sport, date)
            if not have:
                if s.get("tries", 0) >= 12: s["done"] = "gave up (morning run will retry)"
                else: due.append((sport, "game final, result/box score not on the site yet")); s["tries"] = s.get("tries", 0) + 1
            elif not s.get("settled") and now - fin >= datetime.timedelta(minutes=60):
                due.append((sport, "final stats pass, an hour after the game")); s["settled"] = now.isoformat(timespec="minutes"); s["done"] = True
            st[k] = s
    os.makedirs(os.path.dirname(GAMEDAY), exist_ok=True)
    json.dump(st, open(GAMEDAY, "w", encoding="utf-8"), indent=1, sort_keys=True)
    return due

def run_gameday():
    now, day = now_et(), today_et()
    due = gameday_due(day, now)
    if not due:
        print("game night: nothing final that needs refreshing"); return
    stamps, ran, ups = load_stamps(), [], updaters()
    for sport, why in due:
        print(f"== {sport}: {why}")
        try:
            ups[sport](); stamps[sport] = day.isoformat(); ran.append(sport)
        except SystemExit as e: print(f"!! {sport} stopped: {e}")
        except Exception as e: print(f"!! {sport} failed: {e}")
    if ran:
        try:
            import update_standings; update_standings.main()
        except Exception as e: print(f"!! standings failed: {e}")
        save_stamps(stamps)
    print("updated:", ", ".join(ran) or "nothing")

def main():
    if "--gameday" in sys.argv and "--force" not in sys.argv:
        return run_gameday()
    force = "--force" in sys.argv
    day = today_et()
    stamps = load_stamps()
    ran = []
    for sport, fn in updaters().items():
        why = reasons_for(sport, day, stamps, force)
        if not why:
            print(f"skip {sport}: nothing new today"); continue
        print(f"== {sport}: {', '.join(why)}")
        try:
            fn()
            stamps[sport] = day.isoformat(); ran.append(sport)
        except SystemExit as e:
            print(f"!! {sport} stopped: {e}")
        except Exception as e:
            print(f"!! {sport} failed: {e}")
    # SEC standings for every sport: cheap, so refresh them every morning
    try:
        import update_standings; update_standings.main()
    except Exception as e:
        print(f"!! standings failed: {e}")
    try:
        import transfer_stats; transfer_stats.main()
    except Exception as e:
        print(f"!! transfer stats failed: {e}")
    try:
        import baseball_transfers; baseball_transfers.main()
    except Exception as e:
        print(f"!! baseball transfer stats failed: {e}")
    save_stamps(stamps)
    print("updated:", ", ".join(ran) or "nothing")

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
