"""
The Vol Index - basketball power ratings, game predictions and the prediction log
=================================================================================
Runs after the basketball updaters (see .github/workflows/update.yml), or by hand:

    CBBD_API_KEY=...  python tools/update_bb_ratings.py
    python tools/update_bb_ratings.py --offline     # no network: rebuild predictions and the log from the files already here

Writes
  data/bb-ratings.js    window.BB_POWER: ratings for Tennessee and every opponent on the schedule, the prediction for every
                        upcoming game (the game predictor on the site reads these numbers, so the math lives in one place),
                        and Tennessee's player values for the "what if he is out" menu
  data/predict-log.js   window.PREDICT_LOG: every prediction as it stood before tip-off, graded once the game is final

Sources (each is optional; whatever answers is used, and the file records which ones did)
  CollegeBasketballData.com  men only, needs CBBD_API_KEY (3 calls a run): opponent-adjusted offensive / defensive / net
                             efficiency for every team, SRS, and every team's pace and four factors
  Bart Torvik (T-Rank)       men and women, free, no key: adjusted offense / defense and tempo, with preseason priors built in
  data/bb-ratings-manual.js  ratings typed in by hand from paid sites (KenPom, EvanMiya): see the comment in that file

The prediction (one per sport, per upcoming game)
  long-run model    Tennessee's level this season vs. the opponent's program strength and AP rank (tools/calibrate_predictor_bb.py)
  efficiency model  the average, over every source that rates both teams, of (Tennessee net - opponent net) x tempo / 100
  margin            trust x efficiency + (1 - trust) x long-run, plus home court.
                    trust: KenPom 0.9, Torvik 0.85 (both carry preseason priors), CBBD games / (games + 8) (raw early ratings are noisy)
  total             each offense against the other defense when a source splits them, blended the same way
  spread of results 11 points when the efficiency ratings carry the number, the long-run model's own spread when they do not
"""
import datetime, json, math, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "bb-ratings.js")
LOG = os.path.join(DATA, "predict-log.js")
MANUAL = os.path.join(DATA, "bb-ratings-manual.js")
TEAM = "Tennessee"
NAT = {"mbb": dict(tempo=68.5, eff=106.0), "wbb": dict(tempo=70.0, eff=97.0)}
RATED_SD = 11.0
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
notes = []
def note(m): print(m); notes.append(m)

# ---------------------------------------------------------------- small helpers
def read_js(path, marker):
    try:
        t = open(path, encoding="utf-8").read()
        return json.loads(t.split(marker, 1)[1].strip().rstrip(";"))
    except Exception:
        return None

def write_js(path, head, var, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(f"/* {head} */\n{var} = " + json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + ";\n")
    os.replace(tmp, path)

ALIAS = {"uconn": "connecticut", "olemiss": "mississippi", "ncstate": "northcarolinast", "pitt": "pittsburgh", "umass": "massachusetts", "etsu": "easttennesseest",
         "miamifl": "miami", "miamifla": "miami", "usc": "southerncalifornia", "lsu": "louisianast", "smu": "southernmethodist", "tcu": "texaschristian",
         "byu": "brighamyoung", "ucf": "centralflorida", "vcu": "virginiacommonwealth", "unlv": "nevadalasvegas", "utmartin": "tennesseemartin", "fgcu": "floridagulfcoast"}
def norm(name):
    """One spelling per school, so 'Michigan St.', 'Michigan State' and 'MICHIGAN STATE' all match."""
    s = re.sub(r"^#\d+(/\d+)?\s+", "", str(name or "")).lower().replace("&", "and")
    s = re.sub(r"\bsaint\b", "st", s); s = re.sub(r"\bstate\b", "st", s); s = re.sub(r"\buniversity\b|\bthe\b", "", s)
    s = re.sub(r"[^a-z0-9]", "", s)
    return ALIAS.get(s, s)

def fetch(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=dict({"User-Agent": "Mozilla/5.0 (VolIndexBot; +https://www.volindex.net)", "Accept": "application/json,text/plain,*/*"}, **(headers or {})))
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")

def phi(z): return 0.5 * (1 + math.erf(z / math.sqrt(2)))
def r1(x, d=1):
    try: return round(float(x), d)
    except Exception: return None

# ---------------------------------------------------------------- sources
def cbbd(yr):
    """CollegeBasketballData: adjusted efficiency, SRS and season stats for every men's team. {norm name: {...}}"""
    key = os.environ.get("CBBD_API_KEY")
    if not key: note("SKIP CBBD ratings: no CBBD_API_KEY set"); return {}
    import update_cbbd as U
    out = {}
    try:
        for r in U.get("/ratings/adjusted", key, season=yr) or []:
            o, d = r.get("offensiveRating", r.get("offensive_rating")), r.get("defensiveRating", r.get("defensive_rating"))
            n = r.get("netRating", r.get("net_rating"))
            if o is None or d is None: continue
            out.setdefault(norm(r.get("team")), {"name": r.get("team")})["adj"] = [r1(o), r1(d), r1(n if n is not None else o - d), ((r.get("rankings") or {}).get("net"))]
        note(f"OK   CBBD adjusted efficiency ({sum(1 for v in out.values() if 'adj' in v)} teams)")
    except Exception as e: note(f"SKIP CBBD adjusted efficiency: {e}")
    try:
        n0 = 0
        for r in U.get("/ratings/srs", key, season=yr) or []:
            if r.get("rating") is None: continue
            out.setdefault(norm(r.get("team")), {"name": r.get("team")})["srs"] = r1(r.get("rating")); n0 += 1
        note(f"OK   CBBD SRS ({n0} teams)")
    except Exception as e: note(f"SKIP CBBD SRS: {e}")
    try:
        n0 = 0
        for r in U.get("/stats/team/season", key, season=yr) or []:
            t = U.team(r)
            if not t.get("games"): continue
            keep = lambda s: {k: s.get(k) for k in ("rating", "efg", "tov", "orb", "ftr", "tp", "ft")}
            out.setdefault(norm(r.get("team")), {"name": r.get("team")})["stats"] = {"g": t["games"], "pace": t.get("pace"), "us": keep(t["us"]), "opp": keep(t["opp"])}; n0 += 1
        note(f"OK   CBBD team season stats ({n0} teams)")
    except Exception as e: note(f"SKIP CBBD team stats: {e}")
    return out

def torvik(yr, women):
    """Bart Torvik's team results file. Rows are plain lists, so the columns are found by what the numbers look like:
    the first two decimals between 70 and 140 after the team name are adjusted offense and defense, and tempo is the
    last decimal between 55 and 85. Thrown away unless it looks like a full Division I table with Tennessee in it."""
    base = "https://barttorvik.com/" + ("ncaaw/" if women else "")
    last = None
    for url in (f"{base}{yr}_team_results.json", f"{base}trank.php?year={yr}&json=1"):
        try:
            rows = json.loads(fetch(url))
            out = {}
            for row in rows if isinstance(rows, list) else []:
                if not isinstance(row, list): continue
                name = next((x for x in row[:3] if isinstance(x, str) and re.search(r"[A-Za-z]{3}", x) and not re.fullmatch(r"[A-Z0-9]{2,5}", x)), None)
                if not name: continue
                dec = [float(x) for x in row if (isinstance(x, float) and x != int(x)) or (isinstance(x, str) and re.fullmatch(r"-?\d+\.\d+", x))]
                eff = [x for x in dec if 70 <= x <= 140]
                if len(eff) < 2: continue
                bar = next((x for x in dec if 0 < x < 1), None); tempo = [x for x in dec if 55 <= x <= 85 and x not in eff[:2]]
                out[norm(name)] = {"name": name, "torvik": [r1(eff[0]), r1(eff[1]), r1(bar, 4), r1(tempo[-1]) if tempo else None]}
            me = out.get(norm(TEAM))
            if len(out) >= 300 and me and 85 <= me["torvik"][0] <= 135:
                note(f"OK   Torvik {'women' if women else 'men'} ({len(out)} teams)"); return out
            last = f"{url}: {len(out)} usable rows"
        except Exception as e: last = f"{url}: {e}"
    note(f"SKIP Torvik {'women' if women else 'men'}: {last}"); return {}

def manual(key):
    m = read_js(MANUAL, "window.BB_POWER_MANUAL = ") or {}
    out = {}
    for name, v in (m.get(key) or {}).items():
        if isinstance(v, dict): out[norm(name)] = dict(v, name=name)
    return out

# ---------------------------------------------------------------- the model
def site_of(g): return {"H": 1, "A": -1}.get(g.get("site"), 0)
def is_exh(g): return bool(g.get("exh")) or str(g.get("type") or "") in ("E", "S") or "xhibition" in str(g.get("opp"))
def opp_name(g): return re.sub(r"\s*\((Exh\.?|Exhibition|Scrimmage)\)", "", re.sub(r"^#\d+(/\d+)?\s+", "", str(g.get("opp") or ""))).strip()
def unset(g): return not g.get("opp") or bool(re.search(r"TBD|TBA|/| or ", str(g["opp"]), re.I))

def long_run(cal, teams, alias, col, top, sched, g):
    """The fitted model from Tennessee's history. Returns (neutral-court margin, parts for the write-up)."""
    def edge(game):
        n = opp_name(game); n2 = alias.get(n, n); t = teams.get(n2)
        m = re.match(r"^#(\d+)", str(game.get("opp") or ""))
        rank = next((r for r, nm in top if nm == n), None) or (int(m.group(1)) if m else None)
        st = (t[col] if t and t[col] else None)
        return -cal["b"] * ((st or 42) - 60) - cal["c"] * ((26 - rank) / 25 if rank else 0), st, rank
    done = []
    for x in sched:
        if not x.get("result") or is_exh(x) or x.get("date", "") >= g["date"]: continue
        try: mar = float(x["us"]) - float(x["them"])
        except (TypeError, ValueError, KeyError): continue
        done.append(mar - edge(x)[0] - cal["hca"] * site_of(x))
    est = sum(done) / len(done) if done else cal["lastLevel"]
    w = len(done) / (len(done) + cal["k"])
    level = cal["lastLevel"] + (est - cal["lastLevel"]) * w
    e, st, rank = edge(g)
    tots = []
    for x in sched:
        if x.get("result") and not is_exh(x) and x.get("date", "") < g["date"]:
            try: tots.append(float(x["us"]) + float(x["them"]))
            except (TypeError, ValueError, KeyError): pass
    tot = cal["avgTotal"] + ((sum(tots) / len(tots) if tots else cal["avgTotal"]) - cal["avgTotal"]) * (len(tots) / (len(tots) + cal["k"]))
    return level + e, dict(level=round(level, 1), games=len(done), st=st, rank=rank), tot

def predict(key, cal, teams, alias, top, sched, R, g):
    col = 1 if key == "wbb" else 0
    lr, parts, lr_total = long_run(cal, teams, alias, col, top, sched, g)
    opp = opp_name(g); me, them = R.get(norm(TEAM), {}), R.get(norm(alias.get(opp, opp)), {}) or R.get(norm(opp), {})
    site = site_of(g); nat = NAT[key]
    src = []     # (label, Tennessee net, opponent net, trust, [oeU, deU, oeO, deO] or None)
    if me.get("kenpom") and them.get("kenpom"):
        a, b = me["kenpom"], them["kenpom"]; src.append(("KenPom", a[0] - a[1], b[0] - b[1], 0.9, [a[0], a[1], b[0], b[1]]))
    if me.get("torvik") and them.get("torvik"):
        a, b = me["torvik"], them["torvik"]; src.append(("Torvik", a[0] - a[1], b[0] - b[1], 0.85, [a[0], a[1], b[0], b[1]]))
    if me.get("adj") and them.get("adj"):
        a, b = me["adj"], them["adj"]; gms = min((me.get("stats") or {}).get("g") or 0, (them.get("stats") or {}).get("g") or 0)
        src.append(("CBBD", a[2], b[2], gms / (gms + 8.0), [a[0], a[1], b[0], b[1]]))
    if me.get("evanmiya") is not None and them.get("evanmiya") is not None:
        src.append(("EvanMiya", float(me["evanmiya"]), float(them["evanmiya"]), 0.85, None))
    paces = [x for x in ((me.get("stats") or {}).get("pace"), (them.get("stats") or {}).get("pace"), (me.get("torvik") or [None] * 4)[3], (them.get("torvik") or [None] * 4)[3],
                         (me.get("kenpom") or [None] * 3)[2] if len(me.get("kenpom") or []) > 2 else None, (them.get("kenpom") or [None] * 3)[2] if len(them.get("kenpom") or []) > 2 else None) if x]
    tempo = sum(paces) / len(paces) if len(paces) >= 2 else nat["tempo"]
    factors = []
    if src:
        tw = sum(s[3] for s in src) or 1e-9
        em = sum((s[1] - s[2]) * s[3] for s in src) / tw
        trust = max(s[3] for s in src)
        rated = em * tempo / 100.0
        factors.append(dict(k=f"Efficiency ratings ({', '.join(s[0] for s in src)})", v=round(trust * rated, 2),
                            note=" · ".join(f"{s[0]} net {s[1]:+.1f} vs {s[2]:+.1f}" for s in src) + f"; {em:+.1f} per 100 possessions at a pace of {tempo:.0f}; counted for {round(trust * 100)}%"))
    else:
        trust, rated = 0.0, 0.0
    factors.append(dict(k="Long-run model", v=round((1 - trust) * lr, 2),
                        note=f"Tennessee's level this season ({parts['level']:+.1f} after {parts['games']} game{'s' if parts['games'] != 1 else ''}) against {opp}'s program strength"
                             f" ({parts['st'] if parts['st'] else 'not in the table, treated as 42'} of 100){' and AP rank No. ' + str(parts['rank']) if parts['rank'] else ''}; counted for {round((1 - trust) * 100)}%"))
    factors.append(dict(k="Home court" if site > 0 else "Road game" if site < 0 else "Neutral court", v=round(cal["hca"] * site, 2),
                        note=f"{cal['hca']} points, from Tennessee's home and away results against the same opponent in the same season" if site else "No home-court edge either way"))
    margin = sum(f["v"] for f in factors)
    split = next((s[4] for s in src if s[4]), None)
    if split:
        avg = R.get("_avg") or nat["eff"]
        rt = (split[0] * split[3] / avg + split[2] * split[1] / avg) * tempo / 100.0
        total = trust * rt + (1 - trust) * lr_total
    else: total = lr_total
    sd = trust * RATED_SD + (1 - trust) * cal["sd"]
    return dict(date=g["date"], opp=opp, site=g.get("site"), margin=round(margin, 1), total=round(total, 1), sd=round(sd, 1), win=round(phi(margin / sd), 3),
                trust=round(trust, 2), tempo=round(tempo, 1), src=[s[0] for s in src], factors=factors)

def player_values(key):
    """What each Tennessee player is worth in points a game if he sits: a prior from his recruiting / transfer rating,
    moved toward this season's production (men: CBBD's points over replacement; women: scoring rate and minutes)."""
    rat = (read_js(os.path.join(DATA, "ratings-bb.js"), "window.BB_RATINGS = ") or {}).get(key, {}).get("players", {})
    def prior(name):
        r = rat.get(name) or {}; own = (r.get("tr") or {}).get("rating") or (r.get("hs") or {}).get("own")
        return max(0.5, (own - 84) * 0.35) if own else 1.5
    out = []
    if key == "mbb":
        for p in (read_js(os.path.join(DATA, "mbb-cbbd.js"), "window.SITE_CBBD = ") or {}).get("players", []):
            g, mpg = p.get("g") or 0, p.get("mpg") or 0
            if mpg < 8: continue
            w = g / (g + 8.0); ev = p.get("porpag")
            v = prior(p["name"]) * (1 - w) + (ev if ev is not None else prior(p["name"])) * w
            out.append([p["name"], round(max(0.3, min(8, v * min(1, mpg / 28.0 + 0.25))), 1)])
    else:
        ps = (read_js(os.path.join(DATA, "wbb-analytics.js"), "window.SITE_WBBBOX = ") or {}).get("players", [])
        avg = sum((p.get("p40") or 0) for p in ps) / max(1, len(ps))
        for p in ps:
            g, mpg = p.get("g") or 0, p.get("mpg") or 0
            if mpg < 8: continue
            w = g / (g + 8.0); ev = max(0.3, 1.5 + ((p.get("p40") or avg) - avg) * 0.18)
            out.append([p["name"], round(max(0.3, min(8, (prior(p["name"]) * (1 - w) + ev * w) * min(1, mpg / 28.0 + 0.25))), 1)])
    return sorted(out, key=lambda x: -x[1])[:9]

# ---------------------------------------------------------------- the log
def update_log(log, key, preds, sched, today):
    rows = log.setdefault(key, [])
    by = {(r["date"], r["opp"]): r for r in rows}
    for p in preds:
        if p["date"] < today: continue                       # only games that have not been played
        r = by.get((p["date"], p["opp"]))
        if r and r.get("result"): continue
        entry = dict(date=p["date"], opp=p["opp"], site=p["site"], margin=p["margin"], total=p["total"], win=p["win"], src=p["src"], made=today)
        if r: r.update(entry)
        else: rows.append(entry); by[(p["date"], p["opp"])] = entry
    for x in sched:                                           # grade the ones that are final
        r = by.get((x.get("date"), opp_name(x)))
        if r and not r.get("result") and x.get("result"):
            try: r["result"] = [int(float(x["us"])), int(float(x["them"]))]
            except (TypeError, ValueError, KeyError): pass
    rows.sort(key=lambda r: r["date"])
    graded = [r for r in rows if r.get("result")]
    if graded:
        hit = sum((r["margin"] > 0) == (r["result"][0] > r["result"][1]) for r in graded)
        log.setdefault("summary", {})[key] = dict(n=len(graded), right=hit, miss=round(sum(abs(r["margin"] - (r["result"][0] - r["result"][1])) for r in graded) / len(graded), 1),
                                                  brier=round(sum((r["win"] - (r["result"][0] > r["result"][1])) ** 2 for r in graded) / len(graded), 3))

def main():
    offline = "--offline" in sys.argv
    if "--gameday" in sys.argv:    # game-night runs: only when the main updater just changed the basketball data
        import subprocess
        try:
            if subprocess.run(["git", "diff", "--quiet", "HEAD", "--", "data/mbb-auto.js", "data/wbb-auto.js"], cwd=ROOT).returncode == 0:
                print("Basketball ratings: no basketball change this run"); return
        except Exception: pass
    today = os.environ.get("HEALTH_TODAY") or datetime.date.today().isoformat()
    calAll = read_js(os.path.join(DATA, "predict-cal-bb.js"), "window.PREDICT_CAL_BB = ")
    if not calAll: print("SKIP basketball ratings: data/predict-cal-bb.js is missing (run tools/calibrate_predictor_bb.py)"); return
    prev = read_js(OUT, "window.BB_POWER = ") or {}
    log = read_js(LOG, "window.PREDICT_LOG = ") or {}
    out = dict(updated=today)
    for key in ("mbb", "wbb"):
        auto = read_js(os.path.join(DATA, f"{key}-auto.js"), f"window.SITE_AUTO['{key}'] = ") or {}
        sched = auto.get("schedule") or []
        if not sched: note(f"SKIP {key}: no schedule"); out[key] = prev.get(key) or {}; continue
        m = re.match(r"(\d{4})", str(auto.get("season") or "")); yr = int(m.group(1)) + 1 if m else datetime.date.today().year + 1
        R = {}
        if offline:
            for n, v in ((prev.get(key) or {}).get("teams") or {}).items(): R[norm(n)] = dict(v, name=n)
        else:
            for src in ([cbbd(yr)] if key == "mbb" else []) + [torvik(yr, key == "wbb")]:
                for n, v in src.items(): R.setdefault(n, {}).update(v)
            if not R:                                          # every source failed: keep the last good ratings
                for n, v in ((prev.get(key) or {}).get("teams") or {}).items(): R[norm(n)] = dict(v, name=n)
        for n, v in manual(key).items(): R.setdefault(n, {}).update(v)
        effs = [v[s][0] for v in R.values() for s in ("torvik", "adj", "kenpom") if isinstance(v.get(s), list) and v[s] and v[s][0]]
        R["_avg"] = round(sum(effs) / len(effs), 1) if len(effs) > 100 else (prev.get(key) or {}).get("avgEff") or NAT[key]["eff"]
        cal = calAll[key]; top = [(r, n) for r, n in ((auto.get("poll") or {}).get("top") or [])]
        preds = [predict(key, cal, calAll.get("teams") or {}, calAll.get("alias") or {}, top, sched, R, g) for g in sched if not g.get("result") and not is_exh(g) and not unset(g) and g.get("date")]
        want = {norm(TEAM)} | {norm((calAll.get("alias") or {}).get(opp_name(g), opp_name(g))) for g in sched if not unset(g)} | {norm(opp_name(g)) for g in sched if not unset(g)}
        teams = {}
        for n in want:
            v = R.get(n)
            if v and any(k in v for k in ("adj", "torvik", "kenpom", "srs", "stats", "evanmiya")):
                teams[v.get("name") or n] = {k: v[k] for k in ("adj", "srs", "torvik", "kenpom", "evanmiya", "stats") if k in v}
        missing = sorted({opp_name(g) for g in sched if not g.get("result") and not unset(g) and not is_exh(g)} - {p["opp"] for p in preds if p["src"]})
        out[key] = dict(season=auto.get("season"), avgEff=R["_avg"], teams=teams, pred={p["date"]: p for p in preds}, players=player_values(key),
                        rated=sum(1 for p in preds if p["src"]), unrated=missing[:40])
        update_log(log, key, preds, sched, today)
        note(f"OK   {key}: {len(preds)} upcoming games predicted, {out[key]['rated']} with efficiency ratings, {len(teams)} teams stored")
    out["log"] = notes
    write_js(OUT, "Written by tools/update_bb_ratings.py. Do not edit by hand.", "window.BB_POWER", out)
    log["updated"] = today
    write_js(LOG, "Written by tools/update_bb_ratings.py: each basketball prediction as it stood before tip-off, graded after the game. Do not edit by hand.", "window.PREDICT_LOG", log)

if __name__ == "__main__":
    main()
