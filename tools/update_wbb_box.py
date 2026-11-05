"""
The Vol Index - women's basketball box-score analytics
=======================================================
Writes data/wbb-box.js (window.SITE_WBBBOX), shown on the Women's Hoops "Advanced" tab:
team four factors, player advanced stats, a game-by-game efficiency log and per-player game logs.

Source: SportsDataverse (wehoop) women's college basketball player box scores, ESPN data republished daily
as release files on GitHub. No key, no quota. Team and opponent totals are computed here from each game's
player lines, so only one file is downloaded (about 3 MB).

    python tools/update_wbb_box.py
    python tools/update_wbb_box.py --gameday     # only runs if the main updater just changed data/wbb-auto.js

FAIL-SAFE (this is optional extra data, so nothing here may ever break the site or the rest of the update):
  1. Download retries; any failure keeps the last good data/wbb-box.js and exits 0.
  2. Schema check: if the source renamed columns, skip instead of writing garbage.
  3. Sanity checks: Tennessee must have games, minutes must add up near a real game's length, scores must be
     plausible, and the new file may never have FEWER games than the one already published.
  4. Lag check: data/health.js and tools/health_check.py warn when the file goes stale or the source runs
     behind the site's own results.
"""
import csv, datetime, io, json, os, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "wbb-box.js")
TEAM_ID = "2633"      # ESPN's id for Tennessee
URL = "https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_womens_college_basketball_player_boxscores/player_box_{yr}.csv"
REQUIRED = ["game_id", "game_date", "athlete_display_name", "team_id", "minutes", "field_goals_made", "field_goals_attempted",
            "three_point_field_goals_made", "three_point_field_goals_attempted", "free_throws_made", "free_throws_attempted",
            "offensive_rebounds", "defensive_rebounds", "rebounds", "assists", "steals", "blocks", "turnovers", "points"]


def season_year():
    try:
        t = open(os.path.join(ROOT, "data", "wbb-auto.js"), encoding="utf-8").read()
        s = json.loads(t.split("window.SITE_AUTO['wbb'] = ", 1)[1].rsplit(";", 1)[0]).get("season", "")
        if "-" in s: return int(s.split("-")[0]) + 1
    except Exception:
        pass
    n = datetime.date.today(); return n.year + 1 if n.month >= 9 else n.year

def site_schedule():
    try:
        t = open(os.path.join(ROOT, "data", "wbb-auto.js"), encoding="utf-8").read()
        return json.loads(t.split("window.SITE_AUTO['wbb'] = ", 1)[1].rsplit(";", 1)[0]).get("schedule") or []
    except Exception:
        return []

def previous_games():
    try:
        t = open(OUT, encoding="utf-8").read()
        d = json.loads(t.split("window.SITE_WBBBOX = ", 1)[1].rsplit(";", 1)[0])
        return len((d or {}).get("games") or [])
    except Exception:
        return 0

def download(url):
    last = None
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "vol-index-updater"}), timeout=60) as r:
                return r.read().decode("utf-8-sig")
        except Exception as e:
            last = e; time.sleep(3 * (i + 1))
    raise RuntimeError(f"download failed: {last}")

def num(x):
    try:
        v = float(x); return v if v == v else 0.0     # blank/NaN -> 0
    except Exception:
        return 0.0

def div(a, b, d=1, mult=1):
    return round(a / b * mult, d) if b else None

class T:     # team totals for one side of one game
    def __init__(s): s.m = s.fgm = s.fga = s.tpm = s.tpa = s.ftm = s.fta = s.orb = s.drb = s.reb = s.ast = s.stl = s.blk = s.tov = s.pts = 0.0
    def add(s, r):
        s.m += r["min"]; s.fgm += r["fgm"]; s.fga += r["fga"]; s.tpm += r["tpm"]; s.tpa += r["tpa"]; s.ftm += r["ftm"]; s.fta += r["fta"]
        s.orb += r["orb"]; s.drb += r["drb"]; s.reb += r["reb"]; s.ast += r["ast"]; s.stl += r["stl"]; s.blk += r["blk"]; s.tov += r["tov"]; s.pts += r["pts"]
    def poss(s): return s.fga - s.orb + s.tov + 0.475 * s.fta

def side(t, o, poss_avg):
    """Four factors and shooting for team t against opponent o."""
    return {"rating": div(t.pts, poss_avg, 1, 100), "efg": div(t.fgm + 0.5 * t.tpm, t.fga, 1, 100), "tov": div(t.tov, t.fga + 0.44 * t.fta + t.tov, 1, 100),
            "orb": div(t.orb, t.orb + o.drb, 1, 100), "ftr": div(t.fta, t.fga, 1, 100), "ts": div(t.pts, 2 * (t.fga + 0.44 * t.fta), 1, 100),
            "fg": div(t.fgm, t.fga, 1, 100), "tp": div(t.tpm, t.tpa, 1, 100), "ft": div(t.ftm, t.fta, 1, 100),
            "reb": int(t.reb), "ast": int(t.ast), "stl": int(t.stl), "blk": int(t.blk), "tov_n": int(t.tov), "pts": int(t.pts)}

def build(rows, sched):
    games = {}
    for r in rows:
        games.setdefault(r["gid"], []).append(r)
    mine = {g: rs for g, rs in games.items() if any(x["tid"] == TEAM_ID for x in rs)}
    glog, plog = [], {}
    tot_us, tot_op = T(), T()
    per_player = {}
    for gid, rs in mine.items():
        us, op = T(), T()
        for r in rs:
            if r["min"] <= 0 and r["fga"] == 0 and r["fta"] == 0 and r["pts"] == 0: continue
            (us if r["tid"] == TEAM_ID else op).add(r)
        if us.pts <= 0 or op.pts <= 0: continue                    # unfinished game or empty box
        date = max(x["date"] for x in rs)[:10]
        opp_name = next((x["team"] for x in rs if x["tid"] != TEAM_ID and x["team"]), "Opponent")
        gm = (us.m / 5.0)
        poss = (us.poss() + op.poss()) / 2.0
        home = None
        for s in sched:      # use the site's own schedule for home/away
            try:
                d = datetime.date.fromisoformat(s["date"])
                if abs((d - datetime.date.fromisoformat(date)).days) <= 1 and (opp_name.lower()[:6] in str(s["opp"]).lower() or str(s["opp"]).lower()[:6] in opp_name.lower()):
                    home = s["site"]; break
            except Exception: pass
        glog.append({"gid": gid, "date": date, "opp": opp_name, "site": home, "pts": int(us.pts), "oppPts": int(op.pts),
                     "min": round(gm, 1), "pace": div(poss, gm, 1, 40), "ortg": div(us.pts, poss, 1, 100), "drtg": div(op.pts, poss, 1, 100),
                     "efg": div(us.fgm + .5 * us.tpm, us.fga, 1, 100), "oppEfg": div(op.fgm + .5 * op.tpm, op.fga, 1, 100),
                     "tov": div(us.tov, us.fga + .44 * us.fta + us.tov, 1, 100), "orb": div(us.orb, us.orb + op.drb, 1, 100), "ftr": div(us.fta, us.fga, 1, 100)})
        tot_us.m += us.m; tot_op.m += op.m
        for k in ("fgm", "fga", "tpm", "tpa", "ftm", "fta", "orb", "drb", "reb", "ast", "stl", "blk", "tov", "pts"):
            setattr(tot_us, k, getattr(tot_us, k) + getattr(us, k)); setattr(tot_op, k, getattr(tot_op, k) + getattr(op, k))
        for r in rs:
            if r["tid"] != TEAM_ID or (r["min"] <= 0 and r["fga"] == 0 and r["pts"] == 0 and r["fta"] == 0): continue
            p = per_player.setdefault(r["name"], {"pos": r["pos"], "g": 0, "gs": 0, "T": T()})
            p["g"] += 1; p["gs"] += 1 if r["start"] else 0; p["T"].add(r)
            plog.setdefault(r["name"], []).append({"date": date, "opp": opp_name, "site": home, "start": bool(r["start"]), "min": round(r["min"]), "pts": int(r["pts"]),
                "reb": int(r["reb"]), "ast": int(r["ast"]), "stl": int(r["stl"]), "blk": int(r["blk"]), "tov": int(r["tov"]),
                "fg": f"{int(r['fgm'])}-{int(r['fga'])}", "tp": f"{int(r['tpm'])}-{int(r['tpa'])}", "ft": f"{int(r['ftm'])}-{int(r['fta'])}"})
    if not glog: return None
    glog.sort(key=lambda g: g["date"])
    for v in plog.values(): v.sort(key=lambda x: x["date"], reverse=True)
    pos_tot = tot_us.poss() / 2.0 + tot_op.poss() / 2.0
    gmin = tot_us.m / 5.0
    wins = sum(1 for g in glog if g["pts"] > g["oppPts"])
    team = {"games": len(glog), "wins": wins, "losses": len(glog) - wins, "pace": div(pos_tot / 1.0, gmin, 1, 40) if gmin else None,
            "us": side(tot_us, tot_op, pos_tot), "opp": side(tot_op, tot_us, pos_tot)}
    tm5, tfga, tfta, ttov, tfgm = tot_us.m / 5.0, tot_us.fga, tot_us.fta, tot_us.tov, tot_us.fgm
    players = []
    for name, p in per_player.items():
        t = p["T"]
        if t.m <= 0: continue
        players.append({"name": name, "pos": p["pos"], "g": p["g"], "gs": p["gs"], "min": round(t.m), "mpg": div(t.m, p["g"]), "ppg": div(t.pts, p["g"]),
            "rpg": div(t.reb, p["g"]), "apg": div(t.ast, p["g"]), "spg": div(t.stl, p["g"]), "bpg": div(t.blk, p["g"]), "topg": div(t.tov, p["g"]),
            "fg": div(t.fgm, t.fga, 1, 100), "tp": div(t.tpm, t.tpa, 1, 100), "ft": div(t.ftm, t.fta, 1, 100),
            "efg": div(t.fgm + .5 * t.tpm, t.fga, 1, 100), "ts": div(t.pts, 2 * (t.fga + .44 * t.fta), 1, 100),
            "ato": div(t.ast, t.tov, 2), "p40": div(t.pts, t.m, 1, 40),
            "usg": div((t.fga + .44 * t.fta + t.tov) * tm5, t.m * (tfga + .44 * tfta + ttov), 1, 100),
            "astp": div(t.ast, (t.m / tm5) * tfgm - t.fgm, 1, 100) if tm5 and (t.m / tm5) * tfgm - t.fgm > 0 else None,
            "trbp": div(t.reb * tm5, t.m * (tot_us.reb + tot_op.reb), 1, 100)})
    return {"team": team, "players": players, "games": glog, "logs": plog}

def sane(res, rows_n):
    """Reject results that look like bad data rather than basketball."""
    if not res or not res["games"] or not res["players"]: return "no Tennessee games or players"
    for g in res["games"]:
        if not (20 <= g["pts"] <= 170 and 20 <= g["oppPts"] <= 170): return f"implausible score {g['pts']}-{g['oppPts']} on {g['date']}"
        if not (30 <= g["min"] <= 60): return f"implausible game length {g['min']} min on {g['date']}"
        if g["pace"] and not (40 <= g["pace"] <= 110): return f"implausible pace {g['pace']} on {g['date']}"
    return None

def main():
    if "--gameday" in sys.argv:
        try:
            if subprocess.run(["git", "diff", "--quiet", "HEAD", "--", "data/wbb-auto.js"], cwd=ROOT).returncode == 0:
                print("WBB box: no women's basketball change this run"); return
        except Exception: pass
    yr = season_year()
    try:
        text = download(URL.format(yr=yr))
        rd = csv.DictReader(io.StringIO(text))
        missing = [c for c in REQUIRED if c not in (rd.fieldnames or [])]
        if missing:
            print(f"SKIP WBB box: source columns changed (missing {', '.join(missing[:5])})"); return
        pick = lambda r, *cols: next((r[c] for c in cols if r.get(c) not in (None, "")), "")
        rows = []
        for r in rd:
            dnp = str(r.get("did_not_play", "")).lower() in ("true", "1", "yes")
            rows.append({"gid": r["game_id"], "date": r["game_date"] or "", "name": r["athlete_display_name"], "tid": str(r["team_id"]).split(".")[0],
                         "opp": "", "team": pick(r, "team_location", "team_short_display_name", "team_name"), "pos": r.get("athlete_position_name") or "",
                         "start": str(r.get("starter", "")).lower() in ("true", "1"), "did_not_play": dnp, "active": True,
                         "min": 0.0 if dnp else num(r["minutes"]), "fgm": num(r["field_goals_made"]), "fga": num(r["field_goals_attempted"]),
                         "tpm": num(r["three_point_field_goals_made"]), "tpa": num(r["three_point_field_goals_attempted"]),
                         "ftm": num(r["free_throws_made"]), "fta": num(r["free_throws_attempted"]), "orb": num(r["offensive_rebounds"]),
                         "drb": num(r["defensive_rebounds"]), "reb": num(r["rebounds"]), "ast": num(r["assists"]), "stl": num(r["steals"]),
                         "blk": num(r["blocks"]), "tov": num(r["turnovers"]), "pts": num(r["points"])})
        # name each side's opponent from the other team's rows in the same game
        by_game = {}
        for r in rows: by_game.setdefault(r["gid"], {}).setdefault(r["tid"], r["team"])
        for r in rows:
            other = [n for t, n in by_game[r["gid"]].items() if t != r["tid"]]
            r["opp"] = other[0] if other else ""
        res = build(rows, site_schedule())
        bad = sane(res, len(rows))
        if bad: print(f"SKIP WBB box: data failed a sanity check ({bad})"); return
        prev = previous_games()
        if len(res["games"]) < prev:
            print(f"SKIP WBB box: source has {len(res['games'])} games but the site already shows {prev}; keeping the last good data"); return
    except Exception as e:
        print(f"SKIP WBB box: {e}"); return        # keep the last good file; the health check flags a stale one
    data = {"updated": datetime.date.today().isoformat(), "season": f"{yr - 1}-{str(yr)[2:]}", "through": res["games"][-1]["date"], **res}
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/update_wbb_box.py from SportsDataverse (wehoop) women's basketball box scores. Do not edit by hand. */\n")
        f.write("window.SITE_WBBBOX = " + json.dumps(data, separators=(",", ":")) + ";\n")
    print(f"OK   WBB box scores: {len(res['games'])} games, {len(res['players'])} players, through {data['through']}")

if __name__ == "__main__":
    main()
