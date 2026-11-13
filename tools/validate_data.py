"""
The Vol Index - last gate before a data commit
==============================================
Runs in .github/workflows/update.yml right before "Save changes" (or by hand: python tools/validate_data.py).

The updaters are fail-soft, and health_check.py reports stale data *after* it is committed. This script is the
gate *before* the commit: every data file the run changed must still be a file the site can load. A file that
fails is put back to the last committed version (so the live site keeps the last good data) and the problem is
printed as a GitHub Actions warning.

Checks on each changed data/*.js file
  1. It is valid JavaScript (node --check, when node is installed).
  2. Generated files (*-auto.js, standings-auto.js, updated.js): the JSON inside parses.
  3. Sport feeds (<sport>-auto.js): the schedule is not empty, every game has an opponent and a real date,
     every result has two numeric scores that agree with W/L, and no final score the site had has vanished.

    python tools/validate_data.py            # check and restore bad files
    python tools/validate_data.py --all      # check every data file, not only the changed ones
    python tools/validate_data.py --dry      # report only, restore nothing
"""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPORTS = ["football", "mbb", "wbb", "baseball", "softball", "volleyball", "soccer"]

def git(*a):
    return subprocess.run(["git", "-C", ROOT, *a], capture_output=True, text=True)

def changed():
    out = git("status", "--porcelain", "--", "data").stdout.splitlines()
    return sorted({l[3:].strip().strip('"') for l in out if l[3:].strip().endswith(".js")})

def payload(text):
    """The JSON object assigned in a generated file: `window.X = {...};` (last assignment in the file)."""
    m = list(re.finditer(r"window\.[\w.\[\]'\"]+\s*=\s*(?=[\[{])", text))
    if not m: return None
    return json.loads(text[m[-1].end():].rstrip().rstrip(";"))

def score_ok(g):
    us, them, r = g.get("us"), g.get("them"), g.get("result")
    if not r: return True
    if us is None and them is None: return True          # some sports store only "W 3-1" text
    try: us, them = float(us), float(them)
    except (TypeError, ValueError): return False
    return (r == "W" and us > them) or (r == "L" and us < them) or (r not in ("W", "L"))

def check_feed(sport, d, old):
    bad = []
    sch = d.get("schedule")
    if not isinstance(sch, list) or not sch: return ["schedule is empty"]
    for g in sch:
        if not g.get("opp"): bad.append("a game has no opponent"); break
    for g in sch:
        if g.get("date") and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(g["date"])): bad.append(f"bad date {g['date']!r}"); break
    for g in sch:
        if not score_ok(g): bad.append(f"score and result disagree vs {g.get('opp')}: {g.get('result')} {g.get('us')}-{g.get('them')}"); break
    osch = (old or {}).get("schedule") or []
    if osch and (old or {}).get("season") == d.get("season"):
        had = sum(1 for g in osch if g.get("result")); got = sum(1 for g in sch if g.get("result"))
        if got < had: bad.append(f"final scores vanished ({had} -> {got})")
        if len(sch) < 0.75 * len(osch): bad.append(f"schedule shrank ({len(osch)} -> {len(sch)} games)")
    return bad

def check(rel):
    path = os.path.join(ROOT, rel); name = os.path.basename(rel); bad = []
    try: text = open(path, encoding="utf-8").read()
    except Exception as e: return [f"unreadable: {e}"]
    if not text.strip(): return ["file is empty"]
    if shutil.which("node"):
        r = subprocess.run(["node", "--check", path], capture_output=True, text=True)
        if r.returncode: return ["not valid JavaScript: " + (r.stderr.strip().splitlines() or ["?"])[-1][:160]]
    gen = name.endswith("-auto.js") or name in ("updated.js", "health.js")
    if gen:
        try: d = payload(text)
        except Exception as e: return [f"JSON inside does not parse: {e}"]
        if d is None: return ["no data assignment found"]
        sport = name[:-len("-auto.js")] if name.endswith("-auto.js") else None
        if sport in SPORTS and "history" not in name:
            old = None
            prev = git("show", f"HEAD:{rel}")
            if prev.returncode == 0:
                try: old = payload(prev.stdout)
                except Exception: old = None
            bad += check_feed(sport, d, old)
    return bad

def main():
    dry = "--dry" in sys.argv
    files = sorted("data/" + f for f in os.listdir(os.path.join(ROOT, "data")) if f.endswith(".js")) if "--all" in sys.argv else changed()
    failed = 0
    for rel in files:
        bad = check(rel)
        if not bad: continue
        failed += 1
        msg = f"{rel}: " + "; ".join(bad)
        tracked = git("ls-files", "--error-unmatch", rel).returncode == 0
        if dry or "--all" in sys.argv or not tracked:
            print(f"::warning::{msg}")
        else:
            git("checkout", "HEAD", "--", rel)
            print(f"::warning::{msg} -> put back to the last good version")
    print(f"validate_data: {len(files)} file(s) checked, {failed} problem(s)")

if __name__ == "__main__":
    main()
