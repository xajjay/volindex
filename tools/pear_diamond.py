"""
The Vol Index - PEAR Ratings for baseball and softball (api.pearatings.com, Python client `pearatings`).
Needs the PEAR_API_KEY secret. Free tier = 1,000 calls/month, so this makes about 6 calls and runs at most once a day.
Writes data/pear-diamond.js (window.SITE_PEAR = {baseball: {...}, softball: {...}}); assets/sports.js layers it over the hand-entered
Advanced tab numbers in data/extras.js. If anything fails the hand-entered numbers stay. The first real run also saves
tools/cache/pear-diamond-probe.json (column names and sample rows) so the parser can be corrected if PEAR's tables differ from what is guessed here.
Run by hand:  PEAR_API_KEY=... python tools/pear_diamond.py [--force]
"""
import datetime, json, os, sys, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "pear-diamond.js")
PROBE = os.path.join(ROOT, "tools", "cache", "pear-diamond-probe.json")
TEAM = "Tennessee"
SEASON = 2027
SPORTS = {"baseball": "baseball", "softball": "softball"}

def col(df, *names, contains=()):
    low = {str(c).lower().replace(" ", "_"): c for c in df.columns}
    for n in names:
        if n in low: return low[n]
    for key in contains:
        for k, c in low.items():
            if key in k: return c
    return None

def num(x, d=2):
    try: return round(float(x), d)
    except Exception: return None

def one(pear, sport, probe):
    out = {}
    r = pear.ratings(sport=sport, division="d1")
    probe[sport + "_ratings"] = dict(columns=[str(c) for c in r.columns], head=json.loads(r.head(3).to_json(orient="records")), attrs={k: str(v) for k, v in getattr(r, "attrs", {}).items()})
    if r.index.name or not isinstance(r.index, __import__("pandas").RangeIndex): r = r.reset_index()
    cT = col(r, "team", "team_name", contains=("team",)); cTSR = col(r, "tsr", "power_rating", "rating", contains=("tsr", "power", "rating"))
    cPCR = col(r, "pcr", contains=("pcr",)); cRQI = col(r, "rqi", contains=("rqi",)); cSOS = col(r, "sos", contains=("sos",)); cCONF = col(r, "conference", "conf", contains=("conf",))
    cO = col(r, "adjo", "offense", contains=("adjo", "offens")); cD = col(r, "adjd", "defense", contains=("adjd", "defens"))
    if cT is None or cTSR is None: raise RuntimeError("ratings table has no team / rating column: %s" % list(r.columns))
    r = r.dropna(subset=[cT]).copy(); r["_rank"] = r[cTSR].astype(float).rank(ascending=False, method="min").astype(int)
    rank = dict(zip(r[cT], r["_rank"])); trow = r[r[cT] == TEAM]
    if trow.empty: raise RuntimeError("Tennessee not in ratings")
    t = trow.iloc[0]
    out["asOf"] = str(r.attrs.get("date", "")) if hasattr(r, "attrs") else ""
    out["tennessee"] = dict(rank=int(t["_rank"]), tsr=num(t[cTSR]), pcr=num(t[cPCR], 0) if cPCR else None, rqi=num(t[cRQI], 3) if cRQI else None, sos=num(t[cSOS]) if cSOS else None,
                            off=num(t[cO]) if cO else None, defense=num(t[cD]) if cD else None, n=int(len(r)))
    if cCONF:
        sec = r[r[cCONF].astype(str).str.upper().str.contains("SEC")].sort_values(cTSR, ascending=False)
        out["sec"] = [[str(x[cT]), int(x["_rank"]), num(x[cTSR]), num(x[cPCR], 0) if cPCR else None, num(x[cSOS]) if cSOS else None] for _, x in sec.iterrows()]
    try:
        s = pear.schedule(SEASON, sport=sport, division="d1")
        probe[sport + "_schedule"] = dict(columns=[str(c) for c in s.columns], head=json.loads(s.head(3).to_json(orient="records")), rows=int(len(s)))
        cH = col(s, "home_team", "home", contains=("home",)); cA = col(s, "away_team", "away", contains=("away", "visitor")); cDt = col(s, "date", contains=("date",))
        cWp = col(s, "win_prob", "home_win_prob", "home_win_probability", contains=("win_prob", "winprob", "prob")); cN = col(s, "neutral", contains=("neutral",))
        if cH and cA and cDt:
            g = s[(s[cH] == TEAM) | (s[cA] == TEAM)].sort_values(cDt)
            rows = []
            for _, x in g.iterrows():
                home = x[cH] == TEAM; opp = x[cA] if home else x[cH]
                wp = x[cWp] if cWp else None
                wp = None if wp is None or wp != wp else float(wp)
                if wp is not None and wp <= 1.0: wp *= 100
                if wp is not None and cWp and "home" in str(cWp).lower() and not home: wp = 100 - wp
                neutral = bool(x[cN]) if cN else False
                label = ("vs. " if neutral else ("" if home else "at ")) + str(opp)
                rows.append([str(x[cDt])[:10], label, int(rank.get(opp, 999)), round(wp, 1) if wp is not None else None])
            out["games"] = rows
    except Exception as e:
        out["scheduleError"] = str(e)[:200]
    return out

def main():
    force = "--force" in sys.argv
    if not os.environ.get("PEAR_API_KEY"): print("PEAR_API_KEY not set; skipped"); return 0
    today = datetime.date.today().isoformat()
    try: prev = json.loads(open(OUT, encoding="utf-8").read().split("window.SITE_PEAR = ", 1)[1].rsplit(";", 1)[0])
    except Exception: prev = {}
    if prev.get("fetched") == today and not force: print("already fetched today"); return 0
    from pearatings import Pear
    pear = Pear(); probe = {}; data = {"fetched": today}
    for sport in SPORTS:
        try: data[sport] = one(pear, sport, probe); print("OK  PEAR", sport, data[sport]["tennessee"])
        except Exception as e:
            print("SKIP PEAR", sport, repr(e)[:300]); probe[sport + "_error"] = repr(e)[:500]
            if prev.get(sport): data[sport] = prev[sport]
    os.makedirs(os.path.dirname(PROBE), exist_ok=True); json.dump(probe, open(PROBE, "w", encoding="utf-8"), indent=1, default=str)
    if any(k in data for k in SPORTS):
        open(OUT, "w", encoding="utf-8").write("window.SITE_PEAR = " + json.dumps(data, indent=1) + ";\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
