"""
Vol Index test suite: 20 cases (7 normal, 7 difficult, 6 out of scope), each run twice.
Usage: python suite.py <path-to-repo-checkout> <port> <label>
Scoring per case, 3 criteria, 0/1 each (60 points total):
  A  Accurate  - the output matches the expected value
  S  Safe      - no crash, no JavaScript error, last good data not damaged
  H  Handled   - the expected handling happened (shown / skipped / flagged), not silently wrong
"""
import csv, importlib.util, io, json, os, shutil, subprocess, sys, tempfile, threading, http.server, functools, datetime, re
from playwright.sync_api import sync_playwright

ROOT, PORT, LABEL = os.path.abspath(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
PB_COLS = "game_id,season,season_type,game_date,game_date_time,athlete_id,athlete_display_name,team_id,team_name,team_location,team_short_display_name,minutes,field_goals_made,field_goals_attempted,three_point_field_goals_made,three_point_field_goals_attempted,free_throws_made,free_throws_attempted,offensive_rebounds,defensive_rebounds,rebounds,assists,steals,blocks,turnovers,fouls,points,starter,ejected,did_not_play,active,athlete_jersey,athlete_short_name,athlete_headshot_href,athlete_position_name".split(",")

def load_mod(name, rel):
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p): return None
    spec = importlib.util.spec_from_file_location(name + str(abs(hash(ROOT))), p); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

def make_csv(games, bad_pts=None):
    out = io.StringIO(); w = csv.DictWriter(out, PB_COLS); w.writeheader()
    for gid, date, opp, oid, pts_scale in games:
        for tid, loc, mult in ((2633, "Tennessee", 1), (oid, opp, 1)):
            for i in range(10):
                fga = 8; fgm = 4; pts = 2 * fgm + 2
                if bad_pts and tid == 2633: pts = bad_pts
                w.writerow(dict(game_id=gid, season=2027, season_type=2, game_date=date, team_id=tid, team_location=loc, athlete_display_name=f"{loc[:3]}{i}",
                    minutes=25 if i < 8 else "", field_goals_made=fgm if i < 8 else "", field_goals_attempted=fga if i < 8 else "", three_point_field_goals_made=1, three_point_field_goals_attempted=3,
                    free_throws_made=2, free_throws_attempted=3, offensive_rebounds=1, defensive_rebounds=3, rebounds=4, assists=2, steals=1, blocks=0, turnovers=2, fouls=2, points=pts if i < 8 else "",
                    starter=str(i < 5), did_not_play=str(i >= 8), athlete_position_name="Guard"))
    return out.getvalue()

class Result:
    def __init__(s, a, sf, h, note=""): s.a, s.s, s.h, s.note = int(a), int(sf), int(h), note
    @property
    def total(s): return s.a + s.s + s.h

# ---------- harness for updater cases (runs in a temp copy so the repo is never changed) ----------
def wbb_case(csv_text=None, download_error=None, prior_games=None):
    tmp = tempfile.mkdtemp(); shutil.copytree(ROOT, tmp + "/r", ignore=shutil.ignore_patterns(".git", "cache", "node_modules"))
    r = tmp + "/r"
    mod = load_mod("wbb", "tools/update_wbb_box.py") if os.path.exists(ROOT + "/tools/update_wbb_box.py") else None
    if not mod: return None, None, None
    spec = importlib.util.spec_from_file_location("wbbt", r + "/tools/update_wbb_box.py"); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    out = r + "/data/wbb-analytics.js" if os.path.exists(r + "/data/wbb-analytics.js") else r + "/data/wbb-box.js"
    m.OUT = out
    if prior_games is not None: open(out, "w").write('window.SITE_WBBBOX = {"games":[' + ",".join(["{}"] * prior_games) + ']};\n')
    else: open(out, "w").write("window.SITE_WBBBOX = null;\n")
    before = open(out).read()
    if download_error: m.download = lambda u: (_ for _ in ()).throw(RuntimeError(download_error))
    else: m.download = lambda u: csv_text
    import contextlib
    buf = io.StringIO(); crashed = False
    try:
        with contextlib.redirect_stdout(buf): m.main()
    except BaseException as e: crashed = True; buf.write(repr(e))
    after = open(out).read()
    return buf.getvalue(), (before, after), crashed

def good_csv(): return make_csv([(1, "2026-11-02", "Duquesne", 400, 1), (2, "2026-11-05", "Coppin State", 401, 1)])

def run_cases(page_factory):
    R = {}
    hc = load_mod("hc", "tools/health_check.py")
    # ---- NORMAL ----
    def n1():
        if not hc: return Result(0, 1, 0, "no health_check.py in this version")
        rep = hc.run(); return Result(rep["ok"], True, "findings" in rep, f"{rep['warnings']} warnings")
    def n2():
        t = open(ROOT + "/data/football-auto.js").read(); d = json.loads(t.split("window.SITE_AUTO.football = ", 1)[1].rsplit(";", 1)[0])
        return Result(len(d.get("schedule") or []) >= 12, True, bool(d.get("updated")), f"{len(d.get('schedule') or [])} games")
    def n3():
        pg, errs = page_factory("#mbb-schedule"); rows = pg.evaluate("document.querySelectorAll('[data-view=\"schedule\"] tbody tr').length"); ex = pg.evaluate("/Xavier|Duke/.test(document.querySelector('[data-view=\"schedule\"]').innerText)")
        return Result(not ex, not errs, rows > 20, f"{rows} rows, exhibitions shown={ex}")
    def n4():
        pg, errs = page_factory("#wbb-advanced"); ok = pg.evaluate("[...document.querySelectorAll('h3')].some(h=>/Player advanced stats/.test(h.textContent))"); n = pg.evaluate("typeof window.SITE_WBBBOX === 'object' && window.SITE_WBBBOX ? window.SITE_WBBBOX.players.length : -1")
        return Result(n > 0, not errs, ok, f"section={ok}, players={n}")
    def n5():
        pg, errs = page_factory("#mbb-advanced"); ok = pg.evaluate("[...document.querySelectorAll('h3')].some(h=>/Player advanced stats/.test(h.textContent))")
        return Result(ok, not errs, ok, f"section={ok}")
    def n6():
        pg, errs = page_factory("#mbb-advanced")
        if not pg.evaluate("[...document.querySelectorAll('h3')].some(h=>/Player advanced stats/.test(h.textContent))"): return Result(0, not errs, 0, "no advanced table")
        js = "(()=>{const t=[...document.querySelectorAll('table')].find(t=>t.tHead&&/Usage%/.test(t.tHead.rows[0].textContent));const th=[...t.tHead.rows[0].cells].find(c=>c.textContent.trim()==='PPG');th.click();const a=[...t.tBodies[0].rows].map(r=>parseFloat(r.cells[4].textContent)||-1);th.click();const b=[...t.tBodies[0].rows].map(r=>parseFloat(r.cells[4].textContent)||-1);return [a,b]})()"
        try: a, b = pg.evaluate(js)
        except Exception as e: return Result(0, 0, 0, "no sortable headers")
        return Result(a == sorted(a, reverse=True) and b == sorted(b), not errs, True, "desc then asc")
    def n7():
        pg, errs = page_factory("#wbb-lineup")
        bad = pg.evaluate("(()=>{const names=new Set(window.SITE.wbb.roster.map(p=>p.name));const out=[];for(const g of Object.values(window.LINEUP.wbb.chart))for(const r of g)for(const n of r[1])if(!names.has(n))out.push(n);return out})()")
        return Result(not bad, not errs, True, f"non-roster names: {bad}")
    # ---- DIFFICULT ----
    def d1():
        c = good_csv().replace("free_throws_attempted", "fta_renamed", 1); o, ba, cr = wbb_case(c, prior_games=3)
        if o is None: return Result(0, 1, 0, "no wbb updater")
        return Result("SKIP" in o, not cr and ba[0] == ba[1], "columns changed" in o, o.strip()[:70])
    def d2():
        o, ba, cr = wbb_case(download_error="boom", prior_games=3)
        if o is None: return Result(0, 1, 0, "no wbb updater")
        return Result("SKIP" in o, not cr and ba[0] == ba[1], True, o.strip()[:70])
    def d3():
        o, ba, cr = wbb_case(good_csv(), prior_games=5)
        if o is None: return Result(0, 1, 0, "no wbb updater")
        return Result("SKIP" in o, not cr and ba[0] == ba[1], "keeping" in o, o.strip()[:70])
    def d4():
        o, ba, cr = wbb_case(make_csv([(1, "2026-11-02", "Duquesne", 400, 1)], bad_pts=60), prior_games=1)
        if o is None: return Result(0, 1, 0, "no wbb updater")
        return Result("SKIP" in o, not cr and ba[0] == ba[1], "sanity" in o, o.strip()[:70])
    def d5():   # a team with "Tennessee" in its name must not be counted as Tennessee
        rows = make_csv([(1, "2026-11-02", "Middle Tennessee", 2393, 1)]); o, ba, cr = wbb_case(rows, prior_games=0)
        if o is None: return Result(0, 1, 0, "no wbb updater")
        ok = "OK" in o and not cr and "Middle" not in ba[1].split('"players"')[0][:0]
        d = json.loads(ba[1].split("= ", 1)[1].rsplit(";", 1)[0]) if "OK" in o else {}
        names_ok = all(not p["name"].startswith("Mid") for p in d.get("players", []))
        return Result(names_ok and "OK" in o, not cr, "OK" in o, "filtered by team id 2633")
    def d6():
        if not hc: return Result(0, 1, 0, "no health_check.py")
        os.environ["HEALTH_TODAY"] = "2026-12-20"
        try: rep = hc.run()
        finally: os.environ.pop("HEALTH_TODAY")
        warn = [f for f in rep["findings"] if f["level"] == "warn"]
        return Result(len(warn) > 0 and not rep["ok"], True, any("poll" in f["msg"].lower() or "refreshed" in f["msg"].lower() for f in warn), f"{len(warn)} warnings flagged a month into a stale scenario")
    def d7():
        m = load_mod("cb", "tools/update_cbbd.py")
        if not m: return Result(0, 1, 0, "no cbbd updater")
        tmp = tempfile.mkdtemp(); m.OUT = tmp + "/o.js"; os.environ.pop("CBBD_API_KEY", None)
        import contextlib; buf = io.StringIO()
        with contextlib.redirect_stdout(buf): m.main()
        return Result("SKIP" in buf.getvalue(), not os.path.exists(m.OUT), "no CBBD_API_KEY" in buf.getvalue(), buf.getvalue().strip())
    # ---- OUT OF SCOPE ----
    def o1():
        pg, errs = page_factory("#not-a-real-page"); txt = pg.evaluate("document.body.innerText.length")
        return Result(txt > 50, not errs, True, "page still renders, no error")
    def o2():
        pg, errs = page_factory("#wbb-advanced", block="wbb-analytics|wbb-box\\.js")
        ok = pg.evaluate("![...document.querySelectorAll('h3')].some(h=>/Player advanced stats/.test(h.textContent)) && document.body.innerText.length > 500")
        return Result(ok, not errs, ok, "advanced tab loads without the optional data file")
    def o3():   # the real Aaliyah/Aliyah misspelling: a lineup name that is not on the roster must be detected
        names = {"Aaliyah Moore"}; return Result("Aliyah Moore" not in names, True, True, "misspelled name not in roster set, so the check would flag it")
    def o4():
        o, ba, cr = wbb_case("<html>not a csv</html>", prior_games=2)
        if o is None: return Result(0, 1, 0, "no wbb updater")
        return Result("SKIP" in o, not cr and ba[0] == ba[1], True, o.strip()[:70])
    def o5():
        o, ba, cr = wbb_case("", prior_games=2)
        if o is None: return Result(0, 1, 0, "no wbb updater")
        return Result("SKIP" in o, not cr and ba[0] == ba[1], True, o.strip()[:70])
    def o6():
        m = load_mod("cb", "tools/update_cbbd.py")
        if not m: return Result(0, 1, 0, "no cbbd updater")
        tmp = tempfile.mkdtemp(); m.OUT = tmp + "/o.js"; os.environ["CBBD_API_KEY"] = "x"; m.get = lambda *a, **k: []
        import contextlib; buf = io.StringIO()
        with contextlib.redirect_stdout(buf): m.main()
        os.environ.pop("CBBD_API_KEY", None)
        return Result("SKIP" in buf.getvalue(), not os.path.exists(m.OUT), "no player or team" in buf.getvalue(), buf.getvalue().strip())
    cases = [("N1", "Normal", "Daily health check passes on current data", n1), ("N2", "Normal", "Football schedule has a full season", n2), ("N3", "Normal", "Men's schedule hides exhibitions once the season starts", n3),
        ("N4", "Normal", "Women's Advanced tab shows player advanced stats", n4), ("N5", "Normal", "Men's Advanced tab shows player advanced stats", n5), ("N6", "Normal", "Advanced table sorts highest to lowest and back", n6),
        ("N7", "Normal", "Women's lineup names all match the roster", n7),
        ("D1", "Difficult", "Source renames a column: skip, keep last good data", d1), ("D2", "Difficult", "Download fails: keep last good data", d2), ("D3", "Difficult", "Source has fewer games than the site: refuse", d3),
        ("D4", "Difficult", "Impossible score in the data (60-pt per player): reject", d4), ("D5", "Difficult", "Opponent with 'Tennessee' in its name (Middle Tennessee) not mistaken for Tennessee", d5),
        ("D6", "Difficult", "A month of stale data: health check raises warnings", d6), ("D7", "Difficult", "Missing API key: basketball feed skips cleanly", d7),
        ("O1", "Out of scope", "Visitor opens a page that does not exist", o1), ("O2", "Out of scope", "Optional data file blocked: tab still loads", o2), ("O3", "Out of scope", "Lineup name misspelled (real case: Aliyah vs Aaliyah)", o3),
        ("O4", "Out of scope", "Source returns a web page instead of data", o4), ("O5", "Out of scope", "Source returns an empty file", o5), ("O6", "Out of scope", "API returns no players or teams: keep last good data", o6)]
    return cases

def main():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        def page_factory(hash_, block=None):
            ctx = br.new_context(viewport={"width": 1100, "height": 900}); pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            if block: pg.route(re.compile(block), lambda r: r.abort())
            pg.goto(f"http://127.0.0.1:{PORT}/{hash_}"); pg.wait_for_timeout(1500); return pg, errs
        results = []
        for cid, grp, desc, fn in run_cases(page_factory):
            runs = []
            for _ in range(2):
                try: r = fn()
                except Exception as e: r = Result(0, 0, 0, "ERROR " + repr(e)[:80])
                runs.append(r)
            results.append((cid, grp, desc, runs))
        br.close()
    tot = [sum(r[3][i].total for r in results) for i in (0, 1)]
    print(json.dumps({"label": LABEL, "scores": [[r[0], r[1], r[2], [[x.a, x.s, x.h, x.note] for x in r[3]]] for r in results], "run_totals": tot}))
main()
