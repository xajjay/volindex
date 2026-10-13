"""
The Vol Index - last-season stats for baseball transfers
========================================================
ESPN has no college baseball player stats, so this reads each previous school's own athletics
site (most use the same "Sidearm" stats page, /sports/baseball/stats/<year>) and pulls the
player's batting line (AVG, HR, RBI) and/or pitching line (ERA, IP, K). Results go into
data/transfer-stats.js under "baseball". Players already found are kept.

Run:  python tools/baseball_transfers.py      (also runs every morning from auto_schedule.py)
"""
import html as H, json, os, re, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "transfer-stats.js")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"}
YEAR = 2026
SITES = {
    "Cal Baptist": "cbulancers.com", "Rice": "riceowls.com", "Northwestern State": "nsudemons.com", "ETSU": "etsubucs.com",
    "Air Force": "goairforcefalcons.com", "Baylor": "baylorbears.com", "Texas Tech": "texastech.com", "Clemson": "clemsontigers.com",
    "Mercer": "mercerbears.com", "FIU": "fiusports.com", "Rutgers": "scarletknights.com", "Wright State": "wsuraiders.com",
    "Florida State": "seminoles.com", "South Carolina": "gamecocksonline.com", "Louisville": "gocards.com", "UC Irvine": "ucirvinesports.com",
    "Walters State CC": None,
}

def get(url):
    for i in range(3):
        try:
            time.sleep(0.5)
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (400, 403, 404): return None
        except Exception:
            pass
        time.sleep(2 * (i + 1))
    return None

strip = lambda x: re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", x))).strip()
norm = lambda s: re.sub(r"[^a-z]", "", (s or "").lower())

def tables(page):
    """Every table as (headers, rows of cell text)."""
    out = []
    for t in re.findall(r"<table.*?</table>", page, re.S):
        head = [strip(h) for h in re.findall(r"<th[^>]*>(.*?)</th>", (re.search(r"<thead.*?</thead>", t, re.S) or [""])[0] if re.search(r"<thead", t) else "", re.S)]
        rows = []
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
            cells = [strip(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
            if cells: rows.append(cells)
        if head and rows: out.append((head, rows))
    return out

def find(page, name):
    first, last = norm(name.split()[0]), norm(name.split()[-1] if not re.search(r"(jr|sr|ii|iii)\.?$", name.lower()) else name.split()[-2])
    res = {}
    for head, rows in tables(page):
        hu = [h.upper() for h in head]
        kind = "pitch" if "ERA" in hu and "IP" in hu else "bat" if "AVG" in hu and "AB" in hu else None
        if not kind or kind in res: continue
        for r in rows:
            txt = norm(" ".join(r[:3]))
            if last in txt and first[:3] in txt:
                v = dict(zip(hu, r))
                if kind == "bat": res["bat"] = {k: v.get(k) for k in ("AVG", "OPS", "GP-GS", "AB", "R", "H", "HR", "RBI", "SB-ATT") if v.get(k)}
                else: res["pitch"] = {k: v.get(k) for k in ("ERA", "WHIP", "W-L", "APP-GS", "SV", "IP", "BB", "SO") if v.get(k)}
                break
    return res

def main():
    t = open(OUT, encoding="utf-8").read()
    out = json.loads(t.split("window.SITE_AUTO.transfers = ", 1)[1].rsplit(";", 1)[0])
    s = open(os.path.join(DATA, "baseball.js"), encoding="utf-8").read()
    D = json.loads(s.split("window.SITE.baseball = ", 1)[1].rsplit(";", 1)[0])
    bucket = out.setdefault("baseball", {}); dbg = {}; pages = {}
    for p in D.get("roster", []):
        if not p.get("prev"): continue
        name = p["name"]
        if bucket.get(name, {}).get("bat") or bucket.get(name, {}).get("pitch"): continue
        school = p["prev"].split(" / ")[-1].strip()
        dom = SITES.get(school)
        if not dom: dbg[name] = f"no site for {school}"; continue
        if dom not in pages: pages[dom] = get(f"https://{dom}/sports/baseball/stats/{YEAR}") or ""
        page = pages[dom]
        if not page: dbg[name] = f"no page {dom}"; continue
        line = find(page, name)
        if line:
            line.update(team=school, season=str(YEAR), v=2, src=f"https://{dom}/sports/baseball/stats/{YEAR}")
            bucket[name] = line; print("OK  ", name, line)
        else:
            dbg[name] = {"dom": dom, "len": len(page), "tables": [t[0][:12] for t in tables(page)][:6]}
            print("SKIP", name, dbg[name])
    out["_bbdebug"] = dbg
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/transfer_stats.py (ESPN, basketball) and tools/baseball_transfers.py (school stats pages, baseball). Last-season stats for incoming transfers. */\n")
        f.write("window.SITE_AUTO = window.SITE_AUTO || {};\nwindow.SITE_AUTO.transfers = " + json.dumps(out, indent=1, ensure_ascii=False) + ";\n")

if __name__ == "__main__":
    main()
