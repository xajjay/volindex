"""
The Vol Index - data health check
=================================
Runs at the end of the morning update (see .github/workflows/update.yml) or by hand:

    python tools/health_check.py            # print the report
    python tools/health_check.py --write    # also write data/health.js (shown on the Sources page)
    python tools/health_check.py --issue-body out.md   # markdown for the GitHub Issue

It answers one question: "Is the site actually updating?" The updaters are fail-soft (a broken source
keeps the last good data), so a failure is otherwise silent. This turns silence into a warning.

Three kinds of checks
  1. Automatic feeds: each sport's last refresh, empty/shrunken schedules, failed steps in the update log,
     and whether the poll on the site is as new as the latest poll should be (only in that sport's season).
  2. Manual files (On3 rankings, KenPom/Torvik ratings, depth charts, lineups): the last commit date of the
     file against how often it should be edited. These cannot be detected from the source, so they get a
     reminder instead ("On3 rankings haven't been touched in 31 days").
  3. Nothing else: no scraping of On3 or other sites.

Edit RULES / MANUAL below to change what counts as stale. Exit code is always 0; the workflow decides
what to do with the report.
"""
import datetime, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "health.js")

# (month, day) windows during which each sport's poll should be changing every week.
# A poll older than POLL_MAX_AGE days inside the window is stale.
POLL_MAX_AGE = 9
POLL_WINDOW = {
    "mbb":        ((11, 10), (3, 25)),
    "wbb":        ((11, 10), (3, 25)),
    "volleyball": ((9, 8),   (12, 10)),
    "soccer":     ((9, 8),   (11, 20)),
    "baseball":   ((2, 28),  (6, 15)),
    "softball":   ((2, 20),  (5, 31)),
}
# In-season, a sport must have refreshed within this many days (the Monday full refresh guarantees <= 8).
SEASON_WINDOW = {
    "football":   ((8, 25), (1, 12)),
    "mbb":        ((11, 1),  (4, 10)),
    "wbb":        ((11, 1),  (4, 10)),
    "volleyball": ((8, 25), (12, 20)),
    "soccer":     ((8, 15), (11, 25)),
    "baseball":   ((2, 10),  (6, 30)),
    "softball":   ((2, 1),   (6, 10)),
}
IN_SEASON_MAX_AGE = 8
OFF_SEASON_MAX_AGE = 45

# Hand-edited files: (path, label, max days since last edit, optional (start, end) window, who/what to do)
MANUAL = [
    ("data/recruiting.js",     "On3 / recruiting rankings",         30, None,            "Update from the latest On3 Top 300 and class rankings."),
    ("data/ratings-bb.js",     "KenPom / Torvik / EvanMiya ratings", 14, ((11, 5), (4, 8)), "Refresh the basketball ratings."),
    ("data/football-depth.js", "Football depth chart",               14, ((8, 1), (1, 12)), "Re-check the depth chart after the latest game/injury news."),
    ("data/mbb-lineup.js",     "Men's basketball lineup",            21, ((10, 1), (4, 10)), "Re-check the projected lineup."),
    ("data/wbb-lineup.js",     "Women's basketball lineup",          21, ((10, 1), (4, 10)), "Re-check the projected lineup."),
    ("data/volleyball-lineup.js", "Volleyball lineup",               21, ((8, 20), (12, 20)), "Re-check the projected lineup."),
    ("data/soccer-lineup.js",  "Soccer lineup",                      21, ((8, 15), (11, 25)), "Re-check the projected lineup."),
    ("data/baseball-lineup.js", "Baseball lineup",                   21, ((2, 10), (6, 30)), "Re-check the projected lineup."),
    ("data/softball-lineup.js", "Softball lineup",                   21, ((2, 1), (6, 10)),  "Re-check the projected lineup."),
]
SPORTS = ["football", "mbb", "wbb", "baseball", "softball", "volleyball", "soccer"]
# A SKIP in the update log only raises a warning when it is one of these core steps.
CRITICAL_SKIPS = ("schedule", "stats", "poll", "games", "player season", "rpi", "box scores")


def today():
    d = os.environ.get("HEALTH_TODAY")
    if d: return datetime.date.fromisoformat(d)
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("America/New_York")).date()
    except Exception:
        return datetime.date.today()

def in_window(day, win):
    if not win: return True
    (m1, d1), (m2, d2) = win
    a, b, x = (m1, d1), (m2, d2), (day.month, day.day)
    return (a <= x <= b) if a <= b else (x >= a or x <= b)   # windows may wrap the new year

def load_auto(sport):
    p = os.path.join(DATA, f"{sport}-auto.js")
    mk = "window.SITE_AUTO.football = " if sport == "football" else f"window.SITE_AUTO['{sport}'] = "
    try:
        t = open(p, encoding="utf-8").read()
        return json.loads(t.split(mk, 1)[1].rsplit(";", 1)[0])
    except Exception as e:
        return {"_error": str(e)}

def stamps():
    try:
        t = open(os.path.join(DATA, "updated.js"), encoding="utf-8").read()
        return json.loads(t.split("window.SITE_UPDATED = ", 1)[1].rsplit(";", 1)[0])
    except Exception:
        return {}

def last_counts():
    try:
        t = open(OUT, encoding="utf-8").read()
        return json.loads(t.split("window.SITE_HEALTH = ", 1)[1].rsplit(";", 1)[0]).get("counts", {})
    except Exception:
        return {}

def last_commit_date(rel):
    try:
        out = subprocess.check_output(["git", "log", "-1", "--format=%cs", "--", rel], cwd=ROOT, text=True,
                                      stderr=subprocess.DEVNULL).strip()
        if out: return datetime.date.fromisoformat(out)
    except Exception:
        pass
    try:   # not a git checkout: fall back to the file's modified time
        return datetime.date.fromtimestamp(os.path.getmtime(os.path.join(ROOT, rel)))
    except Exception:
        return None

def parse_date(s):
    try: return datetime.date.fromisoformat(str(s)[:10])
    except Exception: return None


def load_cbbd():
    try:
        t = open(os.path.join(DATA, "mbb-cbbd.js"), encoding="utf-8").read()
        return json.loads(t.split("window.SITE_CBBD = ", 1)[1].rsplit(";", 1)[0])
    except Exception:
        return None

def check_cbbd(t, findings):
    """Men's basketball advanced stats (CBBD): should refresh daily in season; its AP poll should match the site's."""
    c = load_cbbd()
    if not in_window(t, SEASON_WINDOW["mbb"]): return
    if not c:
        findings.append(("note", "mbb", "No CBBD advanced stats yet (add the CBBD_API_KEY secret, or the API had no data).")); return
    d = parse_date(c.get("updated"))
    if d and (t - d).days > IN_SEASON_MAX_AGE:
        findings.append(("warn", "mbb", f"CBBD advanced stats last refreshed {(t - d).days} days ago."))
    site = (load_auto("mbb").get("poll") or {})
    ap = [p for p in c.get("polls", []) if p.get("poll") == "AP Top 25"]
    if ap and site.get("rank") not in (None, "NR") and parse_date(ap[-1].get("date")) and parse_date(site.get("date")) \
            and parse_date(ap[-1]["date"]) > parse_date(site["date"]) and POLL_WINDOW.get("mbb") and in_window(t, POLL_WINDOW["mbb"]):
        findings.append(("warn", "mbb", f"CBBD has a newer AP poll ({ap[-1]['date']}, #{ap[-1].get('rank')}) than the site shows ({site['date']})."))


def run():
    t = today()
    prev = last_counts()
    U = stamps()
    findings, counts, rows = [], {}, []   # findings: (level, area, message); level warn|note

    for s in SPORTS:
        a = load_auto(s)
        if "_error" in a:
            findings.append(("warn", s, f"Could not read data/{s}-auto.js ({a['_error']})")); continue
        in_season = in_window(t, SEASON_WINDOW.get(s))
        # 1. how recently did this sport refresh?
        upd = parse_date(max(filter(None, [U.get(s), a.get("updated")]), default=None))
        age = (t - upd).days if upd else None
        limit = IN_SEASON_MAX_AGE if in_season else OFF_SEASON_MAX_AGE
        if upd is None:
            findings.append(("warn", s, "No last-updated date found."))
        elif age > limit:
            findings.append(("warn", s, f"Last refreshed {age} days ago (expected within {limit}{' - in season' if in_season else ''})."))
        # 2. schedule present and not suddenly smaller
        n = len(a.get("schedule") or [])
        counts[s] = n
        if n == 0:
            findings.append(("warn", s, "Schedule is empty."))
        elif prev.get(s) and n < prev[s] * 0.6:
            findings.append(("warn", s, f"Schedule shrank from {prev[s]} to {n} games."))
        # 3. failed steps in the update log
        for line in a.get("log") or []:
            if line.startswith("SKIP"):
                msg = line[4:].strip()
                lvl = "warn" if any(k in msg.lower() for k in CRITICAL_SKIPS) else "note"
                findings.append((lvl, s, f"Update step skipped: {msg}"))
        # 4. poll freshness (only while that sport's poll is moving)
        poll = a.get("poll") or {}
        pdate = parse_date(poll.get("date"))
        if s in POLL_WINDOW and in_window(t, POLL_WINDOW[s]):
            if not poll:
                findings.append(("warn", s, "No poll data on the site, but the poll should be out by now."))
            elif pdate and (t - pdate).days > POLL_MAX_AGE:
                findings.append(("warn", s, f"{poll.get('poll', 'Poll')} on the site is dated {pdate} ({(t - pdate).days} days old). A newer poll should be out."))
        rows.append({"key": s, "updated": str(upd) if upd else None, "ageDays": age, "games": n,
                     "poll": poll.get("poll"), "pollDate": str(pdate) if pdate else None})

    check_cbbd(t, findings)

    # manual files
    manual_rows = []
    for rel, label, maxd, win, todo in MANUAL:
        d = last_commit_date(rel)
        age = (t - d).days if d else None
        due = in_window(t, win)
        manual_rows.append({"file": rel, "label": label, "edited": str(d) if d else None, "ageDays": age,
                            "maxDays": maxd, "active": due})
        if due and age is not None and age > maxd:
            findings.append(("warn", "manual", f"{label} last edited {age} days ago (check every {maxd}). {todo}"))

    warns = [f for f in findings if f[0] == "warn"]
    report = {"checked": str(t), "ok": not warns, "warnings": len(warns), "sports": rows, "manual": manual_rows,
              "findings": [{"level": l, "area": a, "msg": m} for l, a, m in findings], "counts": counts}
    return report


def markdown(rep):
    lines = [f"Automatic data check for **{rep['checked']}**: "
             + ("everything looks fresh. :white_check_mark:" if rep["ok"] else f"**{rep['warnings']} thing(s) need a look.**"), ""]
    for level, title in (("warn", "Needs attention"), ("note", "Notes (no action required)")):
        items = [f for f in rep["findings"] if f["level"] == level]
        if items:
            lines.append(f"### {title}")
            lines += [f"- **{f['area']}**: {f['msg']}" for f in items]
            lines.append("")
    lines.append("<sub>Written by tools/health_check.py. This issue closes itself when the problems are fixed.</sub>")
    return "\n".join(lines)


def main():
    rep = run()
    print(markdown(rep))
    if "--write" in sys.argv:
        with open(OUT, "w", encoding="utf-8") as f:
            f.write("/* Written by tools/health_check.py. Do not edit by hand. */\n")
            f.write("window.SITE_HEALTH = " + json.dumps(rep, indent=1, sort_keys=True) + ";\n")
    if "--issue-body" in sys.argv:
        path = sys.argv[sys.argv.index("--issue-body") + 1]
        with open(path, "w", encoding="utf-8") as f: f.write(markdown(rep))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f: f.write(f"ok={'true' if rep['ok'] else 'false'}\n")


if __name__ == "__main__":
    main()
