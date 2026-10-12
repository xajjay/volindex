"""
The Vol Index - data updater (football)
=======================================
Pulls fresh numbers from CollegeFootballData.com (CFBD) and ESPN's public
scoreboard data, then writes data/football-auto.js. The site loads that file
on top of data/football.js, so anything it contains wins.

What it updates:
  * Record, SEC record, AP + Coaches poll ranks
  * Schedule results, kickoff times, TV, ESPN line + ESPN (FPI) win chance
  * Every player's 2026 stats (passing, rushing, receiving, defense, kicking,
    punting, returns)
  * Team per-game numbers with national (FBS) and SEC ranks
  * 2027 and 2028 commit lists (247 composite ratings, via CFBD)
  * 247 ratings for every rostered player (high school composite + transfer
    rating) and the 247 team talent composite
  * Box scores for every finished game (ESPN)
  * Matchup previews for every remaining game: opponent stats, impact
    players, series history, SP+ and FPI
  * Full team stat sheet with national (FBS) and SEC ranks
  * Season-by-season schedules/results and team leaders (saved once to
    data/football-history-auto.js and tools/cache, then only refreshed
    when missing - run with --refresh to rebuild everything)

What it does NOT touch (update by hand or ask Claude weekly):
  * Your depth charts (data/football-depth.js)
  * On3 Top 300, PEAR ratings, draft boards, award watch lists, staff, history

Setup (once):
  1. Get a free API key at https://collegefootballdata.com/key
  2. Save it in tools/cfbd_key.txt (just the key, one line)
     or set the environment variable CFBD_API_KEY.
  3. Install Python 3.9+ (python.org). No extra packages needed.

Run:
  Double-click tools/update_data.bat, or run:  python tools/update_data.py
"""
import json, os, sys, time, urllib.request, urllib.error, datetime

YEAR = 2026
TEAM = "Tennessee"
ESPN_TEAM_ID = "2633"
RECRUIT_CLASSES = [2027, 2028]
CFBD = "https://api.collegefootballdata.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "football-auto.js")
OUT_HIST = os.path.join(ROOT, "data", "football-history-auto.js")
CACHE = os.path.join(ROOT, "tools", "cache")
REFRESH = "--refresh" in sys.argv
HIST_FROM = 1902          # first season in the History tab
LEADERS_FROM = 2004       # team leaders by season
SEC_SHORT = {"Alabama": "ALA", "South Carolina": "SC", "Kentucky": "UK", "Texas A&M": "TAMU", "LSU": "LSU",
             "Vanderbilt": "VAN", "Arkansas": "ARK", "Auburn": "AUB", "Texas": "TEX", "Georgia": "UGA",
             "Florida": "FLA", "Ole Miss": "MISS", "Mississippi State": "MSST", "Missouri": "MIZ", "Oklahoma": "OU"}
# ESPN abbreviations -> names used on the site
ESPN_NAMES = {"FUR": "Furman", "GT": "Georgia Tech", "KENN": "Kennesaw State", "TEX": "Texas", "AUB": "Auburn",
              "ARK": "Arkansas", "ALA": "Alabama", "SC": "South Carolina", "UK": "Kentucky", "TA&M": "Texas A&M",
              "LSU": "LSU", "VAN": "Vanderbilt"}

log = []
def note(msg):
    print(msg); log.append(msg)

def key():
    k = os.environ.get("CFBD_API_KEY")
    p = os.path.join(ROOT, "tools", "cfbd_key.txt")
    if not k and os.path.exists(p):
        k = open(p, encoding="utf-8").read().strip()
    if not k and sys.stdin and sys.stdin.isatty():
        print("No CFBD API key saved yet.")
        print("Get a free one at https://collegefootballdata.com/key (it arrives by email).")
        k = input("Paste your key here and press Enter: ").strip()
        if k:
            with open(p, "w", encoding="utf-8") as f:
                f.write(k + "\n")
            print("Saved to tools/cfbd_key.txt. You won't be asked again.\n")
    if not k:
        sys.exit("No CFBD API key. Put it in tools/cfbd_key.txt (see the top of this file).")
    return k

def get(url, headers=None, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=headers or {})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                sys.exit(f"CFBD refused the key ({e.code}). Check tools/cfbd_key.txt.")
            if i == tries - 1: raise
        except Exception:
            if i == tries - 1: raise
        time.sleep(2 * (i + 1))

def cfbd(path, **params):
    q = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in params.items())
    return get(f"{CFBD}{path}?{q}", {"Authorization": f"Bearer {KEY}", "Accept": "application/json"})

def section(name):
    def wrap(fn):
        def run(*a, **k):
            try:
                out = fn(*a, **k); note(f"OK   {name}"); return out
            except SystemExit: raise
            except Exception as e:
                note(f"SKIP {name}: {e}"); return None
        return run
    return wrap

# ---------------------------------------------------------------- games / record
@section("games, results and record")
def games():
    gs = cfbd("/games", year=YEAR, team=TEAM, seasonType="regular")
    rows, w, l, sw, sl = [], 0, 0, 0, 0
    for g in sorted(gs, key=lambda g: g.get("startDate", "")):
        home = g.get("homeTeam") == TEAM
        opp = g.get("awayTeam") if home else g.get("homeTeam")
        us = g.get("homePoints") if home else g.get("awayPoints")
        them = g.get("awayPoints") if home else g.get("homePoints")
        row = dict(opp=opp, date=(g.get("startDate") or "")[:10], site="N" if g.get("neutralSite") else ("H" if home else "A"))
        if us is not None and them is not None and g.get("completed", True):
            row.update(result="W" if us > them else "L", us=us, them=them)
            w += us > them; l += us < them
            if g.get("conferenceGame"):
                sw += us > them; sl += us < them
        rows.append(row)
    return rows, f"{w}-{l}", f"{sw}-{sl}"

# ---------------------------------------------------------------- polls
@section("AP and Coaches polls")
def polls():
    weeks = cfbd("/rankings", year=YEAR, seasonType="regular")
    if not weeks: return None
    latest = max(weeks, key=lambda w: w.get("week", 0))
    out = dict(pollWeek=f"Week {latest.get('week')}")
    for p in latest.get("polls", []):
        r = next((x.get("rank") for x in p.get("ranks", []) if x.get("school") == TEAM), None)
        if p.get("poll") == "AP Top 25":
            out["ap"] = r if r else "NR"
            out["apTop25"] = [[x.get("rank"), x.get("school")] for x in sorted(p.get("ranks", []), key=lambda x: x.get("rank") or 99)]
        if p.get("poll") in ("Coaches Poll", "AFCA Coaches Poll"): out["coaches"] = r if r else "NR"
    return out

# ---------------------------------------------------------------- team per-game ranks
LEAGUE = {}
def league():
    """All FBS games + season team stats, fetched once per run and shared."""
    if LEAGUE: return LEAGUE
    gs = cfbd("/games", year=YEAR, seasonType="regular", division="fbs")
    pts, conf, rec = {}, {}, {}
    for g in gs:
        if g.get("homePoints") is None or g.get("awayPoints") is None: continue
        for side, other in (("home", "away"), ("away", "home")):
            t = g.get(f"{side}Team")
            if g.get(f"{side}Classification", "fbs") != "fbs": continue
            d = pts.setdefault(t, [0, 0, 0]); d[0] += g[f"{side}Points"]; d[1] += g[f"{other}Points"]; d[2] += 1
            conf[t] = g.get(f"{side}Conference")
            r = rec.setdefault(t, [0, 0, 0, 0]); won = g[f"{side}Points"] > g[f"{other}Points"]
            r[0 if won else 1] += 1
            if g.get("conferenceGame"): r[2 if won else 3] += 1
    stats = cfbd("/stats/season", year=YEAR)
    per = {}
    for s in stats:
        try: per.setdefault(s["team"], {})[s["statName"]] = float(s["statValue"])
        except (TypeError, ValueError): pass
        conf.setdefault(s["team"], s.get("conference"))
    LEAGUE.update(pts=pts, conf=conf, rec=rec, per=per)
    return LEAGUE

@section("team per-game numbers and national/SEC ranks")
def team_ranks():
    L = league(); pts, conf, per = L["pts"], L["conf"], L["per"]
    table = {}
    for t, (pf, pa, n) in pts.items():
        st = per.get(t, {}); gp = st.get("games") or n or 1
        table[t] = dict(ppg=pf / n, oppg=pa / n,
                        ypg=st.get("totalYards", 0) / gp, rushYpg=st.get("rushingYards", 0) / gp,
                        passYpg=st.get("netPassingYards", 0) / gp,
                        oypg=(st.get("totalYardsOpponent") or 0) / gp, oRushYpg=(st.get("rushingYardsOpponent") or 0) / gp,
                        oPassYpg=(st.get("netPassingYardsOpponent") or 0) / gp)
    lower_better = {"oppg", "oypg", "oRushYpg", "oPassYpg"}
    me = table.get(TEAM)
    if not me: raise RuntimeError("Tennessee not found in team stats")
    out = {}
    for k, v in me.items():
        if v == 0 and k != "ppg": continue  # opponent stats missing from API: keep the old value
        vals = [x[k] for x in table.values()]
        secvals = [x[k] for t, x in table.items() if conf.get(t) == "SEC"]
        better = (lambda a: a < v) if k in lower_better else (lambda a: a > v)
        out[k] = [round(v, 1), 1 + sum(1 for a in vals if better(a)), 1 + sum(1 for a in secvals if better(a))]
    return out

# ---------------------------------------------------------------- player stats
@section("player season stats")
def player_stats():
    rows = cfbd("/stats/player/season", year=YEAR, team=TEAM)
    P = {}
    for r in rows:
        P.setdefault(r["player"], {}).setdefault(r["category"], {})[r["statType"]] = float(r["stat"]) if str(r["stat"]).replace(".", "", 1).lstrip("-").isdigit() else r["stat"]
    out = {}
    num = lambda d, k: d.get(k, 0) if isinstance(d.get(k, 0), (int, float)) else 0
    for name, c in P.items():
        s = {}
        if "passing" in c:
            p = c["passing"]
            cmp_att = str(p.get("C/ATT", ""))
            cmp_, att = (cmp_att.split("/") + ["0"])[:2] if "/" in cmp_att else (num(p, "COMPLETIONS"), num(p, "ATT"))
            s["pass"] = [int(float(cmp_)), int(float(att)), int(num(p, "YDS")), int(num(p, "TD")), int(num(p, "INT")), None, None]
        if "rushing" in c:
            p = c["rushing"]; a = int(num(p, "CAR"))
            s["rush"] = [a, int(num(p, "YDS")), round(num(p, "YDS") / a, 1) if a else 0, int(num(p, "LONG")), int(num(p, "TD"))]
        if "receiving" in c:
            p = c["receiving"]; n = int(num(p, "REC"))
            s["rec"] = [n, int(num(p, "YDS")), round(num(p, "YDS") / n, 1) if n else 0, int(num(p, "LONG")), int(num(p, "TD"))]
        if "defensive" in c or "interceptions" in c:
            d = c.get("defensive", {}); i = c.get("interceptions", {}); f = c.get("fumbles", {})
            s["def"] = dict(solo=int(num(d, "SOLO")), ast=int(num(d, "TOT") - num(d, "SOLO")), tot=int(num(d, "TOT")),
                            tfl=num(d, "TFL"), sacks=num(d, "SACKS"), int=int(num(i, "INT")), pbu=int(num(d, "PD")),
                            qbh=int(num(d, "QB HUR")), fr=int(num(f, "REC")), ff=int(num(f, "FUM")))
        if "kicking" in c:
            p = c["kicking"]
            s["kick"] = [int(num(p, "FGM")), int(num(p, "FGA")), int(num(p, "XPM")), int(num(p, "XPA")), int(num(p, "LONG"))]
        if "punting" in c:
            p = c["punting"]
            s["punt"] = [int(num(p, "NO")), int(num(p, "YDS")), round(num(p, "YPP"), 2), int(num(p, "LONG")), None, int(num(p, "In 20")), None]
        for cat, k in (("puntReturns", "pr"), ("kickReturns", "kr")):
            if cat in c:
                p = c[cat]
                s[k] = [int(num(p, "NO")), int(num(p, "YDS")), round(num(p, "AVG"), 2), int(num(p, "TD")), int(num(p, "LONG"))]
        if s: out[name] = s
    return out

# ---------------------------------------------------------------- recruits
@section("recruiting classes")
def recruits():
    out = {}
    for yr in RECRUIT_CLASSES:
        rows = cfbd("/recruiting/players", year=yr, team=TEAM)
        lst = []
        for r in rows:
            if r.get("committedTo") not in (TEAM, None): continue
            h = r.get("height") or 0
            rating = r.get("rating")
            lst.append(dict(name=r.get("name"), pos=r.get("position"), hs=r.get("school"),
                            home=", ".join(x for x in (r.get("city"), r.get("stateProvince")) if x),
                            ht=f"{int(h // 12)}-{h % 12:g}" if h else "", wt=r.get("weight") or 0,
                            grade=round(rating * 100) if rating else None, stars=r.get("stars"),
                            nat=str(r["ranking"]) if r.get("ranking") else None))
        out[str(yr)] = sorted(lst, key=lambda x: -(x["grade"] or 0))
    return out

# ---------------------------------------------------------------- ESPN lines, TV, win chance
@section("ESPN lines, TV and win chances")
def espn():
    sch = get(f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/{ESPN_TEAM_ID}/schedule?season={YEAR}")
    out = {}
    for e in sch.get("events", []):
        comp = e["competitions"][0]
        teams = {c["homeAway"]: c for c in comp["competitors"]}
        ut_home = teams["home"]["team"]["id"] == ESPN_TEAM_ID
        opp_c = teams["away"] if ut_home else teams["home"]
        opp = ESPN_NAMES.get(opp_c["team"].get("abbreviation"), opp_c["team"].get("location"))
        tv = "/".join(b["media"]["shortName"] for b in comp.get("broadcasts", []) if b.get("media")) or None
        info = dict(tv=tv, kick=e.get("date"))
        if comp["status"]["type"]["name"] != "STATUS_FINAL":
            s = get(f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event={e['id']}")
            pc = (s.get("pickcenter") or [{}])[0]
            if pc.get("details"):
                info["line"] = pc["details"]; info["ou"] = pc.get("overUnder")
                odds = pc.get("homeTeamOdds" if ut_home else "awayTeamOdds") or {}
                if odds.get("moneyLine") is not None:
                    ml = odds["moneyLine"]; info["ml"] = f"+{ml}" if ml > 0 else str(ml)
                info["book"] = (pc.get("provider") or {}).get("name")
            pr = s.get("predictor") or {}
            side = pr.get("homeTeam" if ut_home else "awayTeam") or {}
            if side.get("gameProjection"): info["win"] = round(float(side["gameProjection"]), 1)
        out[opp] = info
    return out


# ---------------------------------------------------------------- small cache (one-time pulls)
def cached(name, fetch, keep=True):
    """Return tools/cache/<name>.json, fetching it once. keep=False always refetches."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name + ".json")
    if keep and not REFRESH and os.path.exists(path):
        with open(path, encoding="utf-8") as f: return json.load(f)
    data = fetch()
    with open(path, "w", encoding="utf-8") as f: json.dump(data, f)
    return data

def full(r): return " ".join(x for x in (r.get("firstName"), r.get("lastName")) if x).strip()

# ---------------------------------------------------------------- full team stat sheet
# (key, label, group, value(stats, games, points_for_per_game, points_against_per_game), lower_is_better, decimals)
def _pct(a, b): return (a / b * 100) if b else 0
METRICS = [
    ("ppg", "Points per game", "Total offense", lambda s, g, pf, pa: pf, False, 1),
    ("ypg", "Total yards per game", "Total offense", lambda s, g, pf, pa: s.get("totalYards", 0) / g, False, 1),
    ("ypp", "Yards per play", "Total offense", lambda s, g, pf, pa: s.get("totalYards", 0) / max(1, s.get("passAttempts", 0) + s.get("rushingAttempts", 0)), False, 2),
    ("passYpg", "Passing yards per game", "Passing", lambda s, g, pf, pa: s.get("netPassingYards", 0) / g, False, 1),
    ("cmpPct", "Completion %", "Passing", lambda s, g, pf, pa: _pct(s.get("passCompletions", 0), s.get("passAttempts", 0)), False, 1),
    ("ypa", "Yards per pass attempt", "Passing", lambda s, g, pf, pa: s.get("netPassingYards", 0) / max(1, s.get("passAttempts", 0)), False, 2),
    ("passTD", "Passing TDs", "Passing", lambda s, g, pf, pa: s.get("passingTDs", 0), False, 0),
    ("intThrown", "Interceptions thrown", "Passing", lambda s, g, pf, pa: s.get("interceptions", 0), True, 0),
    ("sacksAllowed", "Sacks allowed", "Passing", lambda s, g, pf, pa: s.get("sacksOpponent", 0), True, 0),
    ("rushYpg", "Rushing yards per game", "Rushing", lambda s, g, pf, pa: s.get("rushingYards", 0) / g, False, 1),
    ("ypc", "Yards per carry", "Rushing", lambda s, g, pf, pa: s.get("rushingYards", 0) / max(1, s.get("rushingAttempts", 0)), False, 2),
    ("rushTD", "Rushing TDs", "Rushing", lambda s, g, pf, pa: s.get("rushingTDs", 0), False, 0),
    ("recPg", "Receptions per game", "Receiving", lambda s, g, pf, pa: s.get("passCompletions", 0) / g, False, 1),
    ("ypr", "Yards per reception", "Receiving", lambda s, g, pf, pa: s.get("netPassingYards", 0) / max(1, s.get("passCompletions", 0)), False, 2),
    ("fdPg", "First downs per game", "Downs", lambda s, g, pf, pa: s.get("firstDowns", 0) / g, False, 1),
    ("thirdPct", "3rd down conversion %", "Downs", lambda s, g, pf, pa: _pct(s.get("thirdDownConversions", 0), s.get("thirdDowns", 0)), False, 1),
    ("fourthPct", "4th down conversion %", "Downs", lambda s, g, pf, pa: _pct(s.get("fourthDownConversions", 0), s.get("fourthDowns", 0)), False, 1),
    ("penYpg", "Penalty yards per game", "Downs", lambda s, g, pf, pa: s.get("penaltyYards", 0) / g, True, 1),
    ("top", "Time of possession per game (min)", "Downs", lambda s, g, pf, pa: s.get("possessionTime", 0) / 60 / g, False, 1),
    ("toLost", "Turnovers lost", "Downs", lambda s, g, pf, pa: s.get("turnovers", 0), True, 0),
    ("oppg", "Points allowed per game", "Points allowed", lambda s, g, pf, pa: pa, True, 1),
    ("oypg", "Yards allowed per game", "Yards allowed", lambda s, g, pf, pa: s.get("totalYardsOpponent", 0) / g, True, 1),
    ("oypp", "Yards per play allowed", "Yards allowed", lambda s, g, pf, pa: s.get("totalYardsOpponent", 0) / max(1, s.get("passAttemptsOpponent", 0) + s.get("rushingAttemptsOpponent", 0)), True, 2),
    ("othirdPct", "Opponent 3rd down %", "Yards allowed", lambda s, g, pf, pa: _pct(s.get("thirdDownConversionsOpponent", 0), s.get("thirdDownsOpponent", 0)), True, 1),
    ("oPassYpg", "Passing yards allowed per game", "Pass defense", lambda s, g, pf, pa: s.get("netPassingYardsOpponent", 0) / g, True, 1),
    ("oCmpPct", "Opponent completion %", "Pass defense", lambda s, g, pf, pa: _pct(s.get("passCompletionsOpponent", 0), s.get("passAttemptsOpponent", 0)), True, 1),
    ("defInt", "Interceptions", "Pass defense", lambda s, g, pf, pa: s.get("passesIntercepted", 0), False, 0),
    ("sacks", "Sacks", "Pass defense", lambda s, g, pf, pa: s.get("sacks", 0), False, 0),
    ("oRushYpg", "Rushing yards allowed per game", "Run defense", lambda s, g, pf, pa: s.get("rushingYardsOpponent", 0) / g, True, 1),
    ("oYpc", "Yards per carry allowed", "Run defense", lambda s, g, pf, pa: s.get("rushingYardsOpponent", 0) / max(1, s.get("rushingAttemptsOpponent", 0)), True, 2),
    ("tfl", "Tackles for loss", "Run defense", lambda s, g, pf, pa: s.get("tacklesForLoss", 0), False, 0),
    ("takeaways", "Takeaways", "Run defense", lambda s, g, pf, pa: s.get("passesIntercepted", 0) + s.get("fumblesRecovered", 0), False, 0),
    ("toMargin", "Turnover margin", "Run defense", lambda s, g, pf, pa: s.get("passesIntercepted", 0) + s.get("fumblesRecovered", 0) - s.get("turnovers", 0), False, 0),
    ("krAvg", "Kick return average", "Returning", lambda s, g, pf, pa: s.get("kickReturnYards", 0) / max(1, s.get("kickReturns", 0)), False, 1),
    ("prAvg", "Punt return average", "Returning", lambda s, g, pf, pa: s.get("puntReturnYards", 0) / max(1, s.get("puntReturns", 0)), False, 1),
    ("retTD", "Return TDs", "Returning", lambda s, g, pf, pa: s.get("kickReturnTDs", 0) + s.get("puntReturnTDs", 0), False, 0),
]
def metric_table():
    L = league(); out = {}
    for t, (pf, pa, n) in L["pts"].items():
        st = L["per"].get(t, {}); g = st.get("games") or n or 1
        out[t] = {k: fn(st, g, pf / n, pa / n) for k, _, _, fn, _, _ in METRICS}  # points per game from game scores
    return out

@section("full team stat sheet with national and SEC ranks")
def team_sheet():
    L = league(); tbl = metric_table(); me = tbl.get(TEAM)
    if not me: raise RuntimeError("Tennessee not found")
    rows = []
    for k, label, grp, _, low, dec in METRICS:
        v = me[k]; better = (lambda a: a < v) if low else (lambda a: a > v)
        nat = 1 + sum(1 for x in tbl.values() if better(x[k]))
        sec = 1 + sum(1 for t, x in tbl.items() if L["conf"].get(t) == "SEC" and better(x[k]))
        rows.append([k, label, grp, round(v, dec), nat, sec, low])
    # kicking and punting come from ESPN (CFBD's team sheet has no field goals)
    extra = {}
    try:
        es = get(f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/{ESPN_TEAM_ID}/statistics")
        for c in es["results"]["stats"]["categories"]:
            if c["name"] in ("kicking", "punting"):
                extra[c["name"]] = [[x.get("displayName"), x.get("displayValue")] for x in c["stats"]]
    except Exception as e:
        note(f"     (ESPN kicking/punting skipped: {e})")
    return dict(teams=len(tbl), secTeams=sum(1 for t in tbl if L["conf"].get(t) == "SEC"), rows=rows, espn=extra)

# ---------------------------------------------------------------- ratings for every rostered player
@section("247 ratings for the full roster (HS composite + transfer) and team talent")
def roster_ratings():
    roster = cfbd("/roster", team=TEAM, year=YEAR)
    rec = {}
    for y in range(YEAR - 7, YEAR + 1):
        rows = cached(f"recruits-{y}", lambda y=y: cfbd("/recruiting/players", year=y, classification="HighSchool"))
        for r in rows: rec[str(r.get("id"))] = r; rec.setdefault("name:" + (r.get("name") or "").lower(), r)
    portal = []
    for y in range(YEAR - 2, YEAR + 1):
        portal += cached(f"portal-{y}", lambda y=y: cfbd("/player/portal", year=y), keep=(y < YEAR))
    out = {}
    for p in roster:
        name = full(p); hs = None
        for rid in p.get("recruitIds") or []:
            hs = rec.get(str(rid)) or hs
        hs = hs or rec.get("name:" + name.lower())
        entry = dict(pos=p.get("position"), num=p.get("jersey"), year=p.get("year"))
        if hs and hs.get("rating"):
            entry["hs"] = dict(grade=round(hs["rating"] * 100, 2), stars=hs.get("stars"), nat=hs.get("ranking"),
                               cls=hs.get("year"), school=hs.get("school"), committedTo=hs.get("committedTo"))
        tr = [t for t in portal if full(t).lower() == name.lower() and t.get("destination") == TEAM]
        if tr:
            t = sorted(tr, key=lambda t: t.get("season") or 0)[-1]
            entry["transfer"] = dict(grade=round(t["rating"] * 100, 2) if t.get("rating") else None, stars=t.get("stars"),
                                     origin=t.get("origin"), season=t.get("season"))
        out[name] = entry
    talent = None
    try:
        tal = cfbd("/talent", year=YEAR)
        tal = sorted(tal, key=lambda t: -float(t.get("talent") or 0))
        i = next(i for i, t in enumerate(tal) if t.get("team") == TEAM)
        talent = dict(rank=i + 1, score=round(float(tal[i]["talent"]), 2), of=len(tal),
                      top=[[t["team"], round(float(t["talent"]), 2)] for t in tal[:15]])
    except Exception as e:
        note(f"     (team talent skipped: {e})")
    return out, talent

# ---------------------------------------------------------------- box scores (ESPN)
def box_from_espn(event_id):
    s = get(f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event={event_id}")
    comp = s["header"]["competitions"][0]
    teams = []
    for c in comp["competitors"]:
        teams.append(dict(abbr=c["team"].get("abbreviation"), name=c["team"].get("location") or c["team"].get("displayName"),
                          home=c["homeAway"] == "home", score=c.get("score"),
                          lines=[l.get("displayValue") for l in c.get("linescores", [])]))
    stats = {}
    for t in s["boxscore"].get("teams", []):
        stats[t["team"]["abbreviation"]] = [[x.get("label"), x.get("displayValue")] for x in t.get("statistics", [])]
    players = {}
    for t in s["boxscore"].get("players", []):
        cats = {}
        for c in t.get("statistics", []):
            if not c.get("athletes"): continue
            cats[c["name"]] = dict(labels=c.get("labels"), rows=[[a["athlete"]["displayName"]] + a.get("stats", []) for a in c["athletes"]])
        players[t["team"]["abbreviation"]] = cats
    scoring = [[p["period"]["number"], p["clock"]["displayValue"], p["team"].get("abbreviation"), p.get("text"), p.get("awayScore"), p.get("homeScore")]
               for p in s.get("scoringPlays", [])]
    gi = s.get("gameInfo", {})
    return dict(id=event_id, venue=(gi.get("venue") or {}).get("fullName"), attendance=gi.get("attendance"),
                teams=teams, stats=stats, players=players, scoring=scoring)

@section("box scores for finished games (ESPN)")
def box_scores():
    sch = get(f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/{ESPN_TEAM_ID}/schedule?season={YEAR}")
    out = {}
    for e in sch.get("events", []):
        comp = e["competitions"][0]
        if comp["status"]["type"]["name"] != "STATUS_FINAL": continue
        opp_c = next(c for c in comp["competitors"] if c["team"]["id"] != ESPN_TEAM_ID)
        opp = ESPN_NAMES.get(opp_c["team"].get("abbreviation"), opp_c["team"].get("location"))
        out[opp] = cached(f"box-{e['id']}", lambda i=e["id"]: box_from_espn(i))
    return out

# ---------------------------------------------------------------- matchup previews
@section("matchup previews for remaining games (CFBD)")
def previews(schedule_rows):
    L = league(); tbl = metric_table()
    left = [r["opp"] for r in schedule_rows if not r.get("result")]
    if not left: return {}
    sp = {r["team"]: r for r in (cfbd("/ratings/sp", year=YEAR) or [])}
    try: fpi = {r["team"]: r for r in (cfbd("/ratings/fpi", year=YEAR) or [])}
    except Exception: fpi = {}
    sp_rank = {t: i + 1 for i, t in enumerate(sorted(sp, key=lambda t: -(sp[t].get("rating") or -99)))}
    fpi_rank = {t: i + 1 for i, t in enumerate(sorted(fpi, key=lambda t: -(fpi[t].get("fpi") or -99)))}
    rows = cfbd("/stats/player/season", year=YEAR, conference="SEC")
    P = {}
    for r in rows:
        try: v = float(r["stat"])
        except (TypeError, ValueError): continue
        P.setdefault(r["team"], {}).setdefault(r["player"], {"pos": r.get("position")}).setdefault(r["category"], {})[r["statType"]] = v
    def leaders(team):
        pl = P.get(team, {}); out = []
        def best(cat, stat, label, extra=None):
            c = [(n, d) for n, d in pl.items() if d.get(cat, {}).get(stat)]
            if not c: return
            n, d = max(c, key=lambda x: x[1][cat][stat])
            line = f"{d[cat][stat]:g} {label}" + (extra(d[cat]) if extra else "")
            out.append(dict(name=n, pos=d.get("pos"), what=cat, line=line))
        best("passing", "YDS", "pass yds", lambda c: f", {c.get('TD', 0):g} TD, {c.get('INT', 0):g} INT")
        best("rushing", "YDS", "rush yds", lambda c: f", {c.get('TD', 0):g} TD")
        best("receiving", "YDS", "rec yds", lambda c: f", {c.get('REC', 0):g} rec, {c.get('TD', 0):g} TD")
        best("defensive", "TOT", "tackles", lambda c: f", {c.get('TFL', 0):g} TFL")
        best("defensive", "SACKS", "sacks")
        best("interceptions", "INT", "INT")
        return out
    out = {}
    for opp in left:
        d = dict(record=None, conf=L["conf"].get(opp))
        r = L["rec"].get(opp)
        if r: d.update(record=f"{r[0]}-{r[1]}", confRecord=f"{r[2]}-{r[3]}")
        if opp in tbl and TEAM in tbl:
            d["compare"] = {k: [round(tbl[TEAM][k], dec), round(tbl[opp][k], dec)] for k, _, _, _, _, dec in METRICS}
        if opp in sp:
            x = sp[opp]; u = sp.get(TEAM, {})
            d["sp"] = dict(opp=[x.get("rating"), sp_rank.get(opp), (x.get("offense") or {}).get("ranking"), (x.get("defense") or {}).get("ranking")],
                           ut=[u.get("rating"), sp_rank.get(TEAM), (u.get("offense") or {}).get("ranking"), (u.get("defense") or {}).get("ranking")])
        if opp in fpi:
            d["fpi"] = dict(opp=[fpi[opp].get("fpi"), fpi_rank.get(opp)], ut=[(fpi.get(TEAM) or {}).get("fpi"), fpi_rank.get(TEAM)])
        d["impact"] = leaders(opp); d["utImpact"] = leaders(TEAM)
        try:
            m = cfbd("/teams/matchup", team1=TEAM, team2=opp)
            gs = sorted(m.get("games", []), key=lambda g: g.get("season", 0))
            d["series"] = dict(w=m.get("team1Wins"), l=m.get("team2Wins"), t=m.get("ties"), first=gs[0]["season"] if gs else None,
                               last=[[g.get("season"), g.get("winner"), g.get("homeTeam"), g.get("homeScore"), g.get("awayTeam"), g.get("awayScore")] for g in gs[-6:]])
        except Exception as e:
            note(f"     (series vs {opp} skipped: {e})")
        out[opp] = d
    return out

# ---------------------------------------------------------------- history: schedules + leaders (one-time, cached)
@section("season-by-season schedules and team leaders (cached after the first run)")
def history():
    seasons = {}
    for y in range(HIST_FROM, YEAR):
        gs = cached(f"games-{y}", lambda y=y: cfbd("/games", year=y, team=TEAM, seasonType="both"))
        rows = []
        for g in sorted(gs, key=lambda g: g.get("startDate") or ""):
            home = g.get("homeTeam") == TEAM
            us, them = (g.get("homePoints"), g.get("awayPoints")) if home else (g.get("awayPoints"), g.get("homePoints"))
            rows.append([(g.get("startDate") or "")[:10], g.get("awayTeam") if home else g.get("homeTeam"),
                         "N" if g.get("neutralSite") else ("H" if home else "A"), us, them,
                         1 if g.get("conferenceGame") else 0, g.get("notes") or ("Bowl" if g.get("seasonType") == "postseason" else "")])
        seasons[str(y)] = rows
    leaders = {}
    for y in range(LEADERS_FROM, YEAR):
        st = cached(f"pstats-{y}", lambda y=y: cfbd("/stats/player/season", year=y, team=TEAM))
        P = {}
        for r in st:
            try: P.setdefault((r["category"], r["statType"]), {})[r["player"]] = float(r["stat"])
            except (TypeError, ValueError): pass
        def top(cat, stat):
            d = P.get((cat, stat), {})
            if not d: return None
            n = max(d, key=d.get); return [n, d[n]]
        leaders[str(y)] = dict(pass_=top("passing", "YDS"), rush=top("rushing", "YDS"), rec=top("receiving", "YDS"),
                               tkl=top("defensive", "TOT"), sacks=top("defensive", "SACKS"), int_=top("interceptions", "INT"))
    with open(OUT_HIST, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/update_data.py (CollegeFootballData.com). Do not edit by hand. */\n")
        f.write("window.SITE_AUTO = window.SITE_AUTO || {};\nwindow.SITE_AUTO.footballHistory = " +
                json.dumps(dict(seasons=seasons, leaders=leaders), separators=(",", ":")) + ";\n")
    return True

# ---------------------------------------------------------------- main
def load_previous():
    """Last run's output, so a section that fails this time keeps its old data instead of vanishing."""
    try:
        with open(OUT, encoding="utf-8") as f:
            t = f.read()
        return json.loads(t.split("window.SITE_AUTO.football = ", 1)[1].rsplit(";", 1)[0])
    except Exception:
        return {}

def run_football():
    global KEY
    KEY = key()
    prev = load_previous()
    auto = dict(updated=datetime.date.today().isoformat(), team={})
    g = games()
    if g:
        rows, rec, sec = g
        auto["team"].update(record=rec, sec=sec)
        auto["schedule"] = rows
    p = polls()
    if p: auto["team"].update(p)
    tr = team_ranks()
    if tr: auto["team"]["ranks"] = tr
    ps = player_stats()
    if ps: auto["playerStats"] = ps
    rc = recruits()
    if rc: auto["recruits"] = rc
    e = espn()
    if e:
        auto["espn"] = e
    sh = team_sheet()
    if sh: auto["teamSheet"] = sh
    rr = roster_ratings()
    if rr:
        auto["ratings"], talent = rr
        if talent: auto["talent"] = talent
    bx = box_scores()
    if bx: auto["box"] = bx
    if g:
        pv = previews(g[0])
        if pv: auto["previews"] = pv
    history()
    auto["log"] = log
    for k, v in prev.items():            # keep last run's data for anything that failed this time
        if k not in auto: auto[k] = v
    if prev.get("team"):
        for k, v in prev["team"].items(): auto["team"].setdefault(k, v)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/update_data.py on " + auto["updated"] + ". Do not edit by hand; rerun the updater. */\n")
        f.write("window.SITE_AUTO = window.SITE_AUTO || {};\nwindow.SITE_AUTO.football = " + json.dumps(auto, indent=1) + ";\n")
    print(f"\nWrote {OUT}")

if __name__ == "__main__":
    if "--auto" in sys.argv:
        import auto_schedule
        auto_schedule.main()
    else:
        run_football()
