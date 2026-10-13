"""
The Vol Index - high school ratings for Lady Vols players (ESPN HoopGurlz)
=========================================================================
247Sports doesn't rate most women's players, so women's basketball high school ratings come
from ESPN's HoopGurlz class rankings (espnW 100): stars, grade and national rank.
Reads ESPN's rankings for the classes of 2019-2026, keeps any current Lady Vol who appears,
and writes data/ratings-wbb-auto.js. Players already found are kept.

Run:  python tools/espn_hs_ratings.py      (also runs every morning from auto_schedule.py)
"""
import html as H, json, os, re, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "ratings-wbb-auto.js")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"}
CLASSES = range(2019, 2027)

def get(url):
    for i in range(3):
        try:
            time.sleep(0.4)
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (400, 404): return None
        except Exception:
            pass
        time.sleep(2 * (i + 1))
    return None

def norm(s): return re.sub(r"[^a-z]", "", (s or "").lower())
def strip(x): return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", x))).strip()

def roster():
    t = open(os.path.join(DATA, "wbb.js"), encoding="utf-8").read()
    D = json.loads(t.split("window.SITE.wbb = ", 1)[1].rsplit(";", 1)[0])
    return [p["name"] for p in D.get("roster", [])]

def main():
    try:
        t = open(OUT, encoding="utf-8").read()
        out = json.loads(t.split("window.SITE_AUTO.wbbRatings = ", 1)[1].rsplit(";", 1)[0])
    except Exception:
        out = {}
    players = out.setdefault("players", {})
    names = roster()
    todo = [n for n in names if n not in players]
    dbg = {}
    if todo:
        for yr in CLASSES:
            url = f"https://www.espn.com/college-sports/basketball/recruiting/playerrankings/_/view/hoopgurlz/class/{yr}"
            page = get(url)
            if not page: dbg[yr] = "no page"; continue
            rows = re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S)
            dbg[yr] = {"len": len(page), "rows": len(rows)}
            for tr in rows:
                txt = norm(strip(tr))
                for n in todo:
                    if n in players or norm(n) not in txt: continue
                    cells = [strip(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
                    stars = len(re.findall(r'class="[^"]*star[^"]*full', tr)) or len(re.findall(r"star-full|icon-star-solid", tr))
                    grade = next((int(c) for c in cells if re.fullmatch(r"\d{2}", c) and 60 <= int(c) <= 100), None)
                    rank = next((int(c) for c in cells[:2] if re.fullmatch(r"\d{1,3}", c)), None)
                    players[n] = dict(cls=yr, rank=rank, grade=grade, stars=stars or None, raw=cells[:8], src=url)
                    print(f"OK   {n}: class {yr}, No. {rank}, grade {grade}, {stars} stars")
            if yr == 2026 and not dbg.get("sample"):
                dbg["sample"] = [strip(r)[:200] for r in rows[1:4]]
    out["_debug"] = dbg
    out["updated"] = time.strftime("%Y-%m-%d")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Written by tools/espn_hs_ratings.py from ESPN HoopGurlz class rankings. */\n")
        f.write("window.SITE_AUTO = window.SITE_AUTO || {};\nwindow.SITE_AUTO.wbbRatings = " + json.dumps(out, indent=1, ensure_ascii=False) + ";\n")

if __name__ == "__main__":
    main()
