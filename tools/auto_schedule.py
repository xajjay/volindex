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

Use --force to update everything regardless of the day.
Writes data/updated.js with the date each sport was last refreshed (shown on the site).
"""
import datetime, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
STAMP = os.path.join(DATA, "updated.js")

def today_et():
    # Eastern time without extra packages: UTC-4 (EDT) Mar-Nov, UTC-5 otherwise. Close enough for a morning job.
    now = datetime.datetime.utcnow()
    offset = 4 if 3 <= now.month <= 10 else 5
    return (now - datetime.timedelta(hours=offset)).date()

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

def main():
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
