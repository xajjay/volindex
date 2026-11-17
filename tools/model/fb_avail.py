"""Availability -> point adjustment per team.   python tools/model/fb_avail.py
Inputs: data/availability.json (report entries), tools/cache/fbm/depth.json (Ourlads), availability_values.json (measured costs).
In-rating flag: players out for most of the season are already reflected in the ratings (recent games without them), so they count 0.
Cost per missing player = status weight x slot cost, slot from depth-chart rank at the player's position.
  measured from 2015-26 absences: QB1 -2.2, RB1 -1.1, RB2 -1.6, WR1 -1.0, WR2 -1.1, WR3 -0.3, defender (top-8 regular) -0.33
  ASSUMED (not measurable with free data, labeled as priors): TE1 -0.4, each OL starter -0.9, other starters on defense -0.33
Writes tools/cache/fbm/availability_adj.json: {team: {total, rows:[...]}}; total is points the team loses (negative).
"""
import os, json, re, unicodedata
D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(D, "..", "..")
W = {"out": 1.0, "doubtful": 0.9, "questionable": 0.5, "game-time decision": 0.5, "probable": 0.1, "available": 0.0}
DEF = {"DE", "DT", "NT", "LEO", "DL", "EDGE", "WLB", "MLB", "SLB", "LB", "OLB", "ILB", "LCB", "RCB", "CB", "NB", "SS", "FS", "S", "DB"}
OL = {"LT", "LG", "C", "RG", "RT", "OL", "OT", "OG"}


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z ]", "", re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", s)).strip()


def rank_of(chart, name, pos):
    n = norm(name)
    best = None
    for unit in chart.values():
        for p, plist in unit.items():
            for pl in plist:
                if norm(pl["name"]) == n: best = (p, pl["rank"]) if best is None or pl["rank"] < best[1] else best
    return best


def cost(pos, rank, vals):
    o = vals["offense"]; p = pos.upper()
    if p == "QB": return o["pass1"] if rank <= 1 else 0.0, "measured"
    if p in ("RB", "HB", "FB"): return {1: o["rush1"], 2: o["rush2"]}.get(rank, 0.0), "measured"
    if p in ("WR", "WR-X", "WR-Z", "WR-SL", "SL"): return {1: o["recv1"], 2: o["recv2"], 3: o["recv3"]}.get(rank, 0.0), "measured (rank within position slot)"
    if p == "TE": return -0.4 if rank <= 1 else 0.0, "prior"
    if p in OL: return -0.9 if rank <= 1 else 0.0, "prior"
    if p in DEF: return -vals["defense_each"] if rank <= 1 else 0.0, "measured, weak"
    return 0.0, "n/a"


GROUP = {"QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE", "OL": "OL", "OT": "OL", "OG": "OL", "DL": "DL", "DE": "DL", "DT": "DL", "LB": "LB", "CB": "DB", "S": "DB", "NB": "DB", "DB": "DB"}
TOPN = {"OL": 5, "DL": 4, "LB": 3, "DB": 5}


def snap_cost(snaps, name, pos, vals):
    """Cost from season snaps: skill positions by rank within the position group, line/backers/backs by share of a typical starter's snaps."""
    pl = snaps["players"]; g = GROUP.get(pos.upper())
    mates = sorted([x for x in pl if GROUP.get(x["pos"]) == g], key=lambda x: -x["snaps"])
    me = next((x for x in mates if norm(x["name"]) == norm(name)), None)
    if not me or g is None: return 0.0, "no snaps recorded", "none"
    rk = mates.index(me) + 1; o = vals["offense"]
    if g == "QB": return (o["pass1"] if rk == 1 else 0.0), "measured", f"QB{rk} ({me['snaps']} snaps)"
    if g == "RB": return {1: o["rush1"], 2: o["rush2"]}.get(rk, 0.0), "measured", f"RB{rk} ({me['snaps']} snaps)"
    if g == "WR": return {1: o["recv1"], 2: o["recv2"], 3: o["recv3"]}.get(rk, 0.0), "measured", f"WR{rk} ({me['snaps']} snaps)"
    if g == "TE": return (-0.4 if rk == 1 else 0.0), "prior", f"TE{rk} ({me['snaps']} snaps)"
    top = [x["snaps"] for x in mates[:TOPN[g]]]; ref = sum(top) / len(top); share = min(1.0, me["snaps"] / ref)
    per = -0.9 if g == "OL" else -vals["defense_each"]
    return per * share, "prior" if g == "OL" else "measured, weak", f"{g}{rk} ({me['snaps']} snaps, {share:.0%} of a starter)"


def main():
    av = json.load(open(os.path.join(ROOT, "data", "availability.json")))
    vals = json.load(open(os.path.join(ROOT, "tools", "cache", "fbm", "availability_values.json")))
    dp = os.path.join(ROOT, "tools", "cache", "fbm", "depth.json")
    depth = json.load(open(dp))["teams"] if os.path.exists(dp) else {}
    sp = os.path.join(ROOT, "data", "snaps.json")
    snaps = json.load(open(sp)) if os.path.exists(sp) else {}
    out = {}
    for team, rows in av["teams"].items():
        chart = depth.get(team.lower(), {}).get("chart", {})
        res, tot = [], 0.0
        for r in rows:
            w = W.get(r["status"].lower(), 0.0)
            if team in snaps and not r.get("slot"):
                c, kind, dep = snap_cost(snaps[team], r["name"], r["pos"], vals)
                w2 = 0.0 if r.get("in_rating") else w
                res.append({"name": r["name"], "pos": r["pos"], "status": r["status"], "in_rating": bool(r.get("in_rating")), "depth": dep, "pts": round(w2 * c, 2), "basis": kind + ", from season snaps"})
                tot += w2 * c; continue
            hit = rank_of(chart, r["name"], r["pos"]) if chart else None
            if hit and hit[0] in ("RES", "INJ"): hit = None   # Ourlads moves injured players to a reserve row, so the row says nothing about his role
            m = re.match(r"^([A-Z]+)(\d)$", r.get("slot", ""))
            if m: hit = (m.group(1), int(m.group(2)))             # slot set by hand in availability.json (e.g. "RB2")
            slot_pos, rk = hit if hit else (r["pos"], 1)       # no depth chart or not found: assume starter
            c, kind = cost(slot_pos if hit else r["pos"], rk, vals)
            if m: kind += ", slot set by hand"
            if r.get("in_rating"): w = 0.0            # long-term absence: games without him are already in the team rating
            res.append({"name": r["name"], "pos": r["pos"], "status": r["status"], "in_rating": bool(r.get("in_rating")), "depth": f"{slot_pos}{rk}" if hit else "not on depth chart (assumed starter)", "pts": round(w * c, 2), "basis": kind})
            tot += w * c
        out[team] = {"total": round(tot, 2), "rows": res}
    json.dump({"asOf": av["asOf"], "game": av.get("game"), "teams": out}, open(os.path.join(ROOT, "tools", "cache", "fbm", "availability_adj.json"), "w"), indent=1)
    for t, v in out.items(): print(t, v["total"], [(r["name"], r["pts"]) for r in v["rows"]])


if __name__ == "__main__":
    main()
