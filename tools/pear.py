"""
The Vol Index - PEAR Ratings (pearatings.com) for the football Advanced tab.

PEAR's site is a JavaScript app, so this reads the same JSON the site itself loads.
probe() looks through the site's scripts for its data addresses and saves what it finds to
tools/cache/pear-probe.json (used to keep the fetcher working if PEAR moves its data).
"""
import json, os, re, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROBE = os.path.join(ROOT, "tools", "cache", "pear-probe.json")
SITE = "https://pearatings.com"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 VolIndexBot/1.0",
      "Accept": "application/json, text/html;q=0.9, */*;q=0.5"}

def _get(url, n=None):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        b = r.read() if n is None else r.read(n)
        return r.status, r.headers.get("Content-Type", ""), b.decode("utf-8", "replace")

def probe():
    out = {"pages": {}, "scripts": [], "urls": [], "tries": {}}
    scripts = set()
    for path in ("/cfb/fbs", "/cfb/fbs/teams", "/cfb/fbs/team-profile?team=Tennessee&season=2026"):
        try:
            st, ct, html = _get(SITE + path)
            out["pages"][path] = [st, ct, len(html), html[:1500]]
            scripts |= set(re.findall(r'src="([^"]+\.js[^"]*)"', html))
            out["urls"] += re.findall(r'https?://[^"\'\s<>\\]+', html)
            nd = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
            if nd: out["pages"][path].append(nd.group(1)[:4000])
        except Exception as e:
            out["pages"][path] = ["error", str(e)]
    found = set()
    for s in sorted(scripts)[:60]:
        u = s if s.startswith("http") else SITE + s
        out["scripts"].append(u)
        try:
            _, _, js = _get(u)
            found |= set(re.findall(r'["\'`](https?://[^"\'`\s]{6,200})["\'`]', js))
            found |= set(re.findall(r'["\'`](/api/[^"\'`\s]{1,200})["\'`]', js))
            found |= set(re.findall(r'["\'`]([^"\'`\s]*(?:ratings|cfb|fbs)[^"\'`\s]*)["\'`]', js)[:200])
        except Exception as e:
            out["tries"][u] = str(e)
    out["urls"] = sorted(set(out["urls"]) | found)[:1500]
    for path in ("/api/cfb/fbs/ratings?season=2026", "/api/cfb/ratings?season=2026", "/api/cfb/fbs/teams?season=2026",
                 "/api/cfb/fbs/team-profile?team=Tennessee&season=2026", "/api/ratings?sport=cfb&season=2026"):
        try:
            st, ct, t = _get(SITE + path, 3000); out["tries"][path] = [st, ct, t[:3000]]
        except Exception as e:
            out["tries"][path] = str(e)
    os.makedirs(os.path.dirname(PROBE), exist_ok=True)
    json.dump(out, open(PROBE, "w", encoding="utf-8"), indent=1)
    return out

YEAR = 2026
TEAM = "Tennessee"

def _json(url):
    _, _, t = _get(url); return json.loads(t)

def ratings():
    """PEAR numbers in the shape the Advanced tab uses (data/football.js -> advanced.pear / advanced.sec)."""
    prof = _json(f"{SITE}/api/profile-page/{TEAM}?year={YEAR}")
    st, week = prof["stats"], prof.get("week")
    v = lambda k: st.get(k) or {}
    f = lambda x, d=2: None if x is None else (f"{x:.{d}f}")
    rows = [("TSR", "power_rating", 1), ("SP+", "sp_rating", 1), ("FPI", "fpi", 1), ("FEI", "fei", 2), ("Massey", "massey_rating", 2),
            ("Dokter", "dokter_power", 2), ("Sagarin", "sagarin_rating", 2), ("RQI", "resume_quality", 3), ("SOS", "sos", 2)]
    out = dict(week=week, ratings=[[l, f(v(k).get("value"), d), v(k).get("rank")] for l, k, d in rows if v(k).get("value") is not None])
    side = [("Success rate", "success_rate"), ("EPA/play (PPA)", "ppa"), ("Rush PPA", "rushing"), ("Pass PPA", "passing"),
            ("Points per opportunity", "ppo"), ("Drive quality", "drive_quality")]
    out["offense"] = [["Rating", f(v("offensive_rating").get("value")), v("offensive_rating").get("rank")]] + \
                     [[l, f((st["offense"].get(k) or {}).get("value")), (st["offense"].get(k) or {}).get("rank")] for l, k in side if st.get("offense", {}).get(k)]
    out["defense"] = [["Rating", f(v("defensive_rating").get("value")), v("defensive_rating").get("rank")]] + \
                     [[l, f((st["defense"].get(k) or {}).get("value")), (st["defense"].get(k) or {}).get("rank")] for l, k in side if st.get("defense", {}).get(k)]
    sch = prof.get("schedule") or []
    out["games"] = [[g["opponent_team"], g.get("opponent_pr_rank"), g.get("PEAR"), f"{g.get('team_proj_score', 0):.1f}-{g.get('opponent_proj_score', 0):.1f}",
                     round(g.get("team_win_prob") or 0, 1)] for g in sch if not g.get("is_completed")]
    out["played"] = [[g["opponent_team"], g.get("opponent_pr_rank")] for g in sch if g.get("is_completed")]
    out["record"] = (prof.get("records") or {}).get("overall")
    # every SEC team: rating, national rank, offense (rank), defense (rank), SOS rank
    try:
        allr = _json(f"{SITE}/api/ratings/{YEAR}/{week}")["data"]
        rk = lambda k, desc: {t["Team"]: i + 1 for i, t in enumerate(sorted(allr, key=lambda t: (t.get(k) or 0) * (-1 if desc else 1)))}
        R, O, D, S = rk("Rating", True), rk("offensive_rating", True), rk("defensive_rating", False), rk("SOS", False)
        out["sec"] = {t["Team"]: [t["Rating"], R[t["Team"]], t["offensive_rating"], O[t["Team"]], t["defensive_rating"], D[t["Team"]], S[t["Team"]]]
                      for t in allr if t.get("CONF") == "SEC"}
    except Exception as e:
        out["secError"] = str(e)
    return out

if __name__ == "__main__":
    o = probe(); print(len(o["urls"]), "urls"); print(json.dumps(o["tries"], indent=1)[:3000])
