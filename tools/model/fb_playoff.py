"""Projected 12-team playoff field + Vol Power top 25, from data/model-fb.js and the season simulator.
Usage: python3 tools/model/fb_playoff.py [n_sims]   (prints tables; writes nothing)"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import fb_season_sim as SS
ROOT = os.path.join(HERE, "..", "..")
def load():
    s = open(os.path.join(ROOT, "data", "model-fb.js"), encoding="utf-8").read(); d = json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))
    a = open(os.path.join(ROOT, "data", "football-auto.js"), encoding="utf-8").read()
    auto = json.loads(a.split("window.SITE_AUTO.football = ", 1)[1].rsplit(";", 1)[0]); return d, auto
def project(n=20000):
    d, auto = load(); sc = d["powerScale"]; raw = {t: v / sc for t, v in d["powerAll"].items()}
    cfp = [tuple(x) for x in auto["team"]["cfpTop25"]]; tl = {}
    SS.run(raw, 2026, cfp, d["betas"]["b0"], d["betas"]["backtest"]["rmse"], hfa=d["betas"]["site"], n=n, tally=tl, cfp_thru=int("".join(c for c in (auto["team"].get("cfpWeek") or "0") if c.isdigit()) or 0) - 1 or None)
    return d, tl
if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
    d, tl = project(n); T = tl["teams"]; N = tl["n"]
    print("TOP25"); 
    for i, (t, v) in enumerate(sorted(d["powerAll"].items(), key=lambda x: -x[1])[:25], 1): print(i, t, v)
    print("FIELD")
    o = np.argsort(-tl["field"])[:20]
    for i in o:
        sd = tl["seed"][i]; print(T[i], f"rec {tl['w0'][i]:.0f}-{tl['l0'][i]:.0f} proj {tl['wins'][i]/N:.1f} field {100*tl['field'][i]/N:.0f}% bye {100*tl['bye'][i]/N:.0f}% avgseed {sum((k+1)*sd[k] for k in range(12))/max(1,sd.sum()):.1f} sf {100*tl['sf'][i]/N:.0f}% nc {100*tl['nc'][i]/N:.1f}%")
