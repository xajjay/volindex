"""
The Vol Index - the real 2027 recruiting class for "Start Today"
================================================================
Reads the 247Sports Composite rankings (class of 2027, high schoolers), page by page, and writes
data/hist/fb-class27.js: every ranked prospect (composite 0.87 and up) and the school he is committed
to today (blank = still open). Start Today builds the 2027 class from it.

Safety: nothing is overwritten unless the pull looks complete (900+ prospects, nearly all with a rating,
hundreds of commits). If 247 blocks the request or the page layout changes, the old file stays and the
run says so. Runs from tools/auto_schedule.py every morning.

Run:  python tools/update_class27.py
"""
import datetime, json, os, re, sys, time, urllib.request, urllib.error
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "hist", "fb-class27.js")
BASE = "https://247sports.com/season/2027-football/compositerecruitrankings/?InstitutionGroup=HighSchool&Page="
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9"}
MIN_SCORE = 8700
ALIAS = {"California": "Cal", "Pittsburgh": "Pitt", "Florida Atlantic": "FAU", "Appalachian State": "App State", "Miami (FL)": "Miami", "Southern California": "USC",
         "Hawaii": "Hawai'i", "San Jose State": "San José State", "Massachusetts": "UMass", "USF": "South Florida", "Connecticut": "UConn"}

class Page(HTMLParser):
    """Collects one row per <li class="rankings-page__list-item">."""
    def __init__(self):
        super().__init__(); self.rows = []; self.cur = None; self.depth = 0; self.field = None; self.buf = ""
    def handle_starttag(self, tag, attrs):
        a = dict(attrs); cls = a.get("class") or ""
        if tag == "li" and "rankings-page__list-item" in cls:
            self.cur = dict(name="", meta="", pos="", metrics="", score="", stars=0, imgs=[]); self.depth = 1; return
        if self.cur is None: return
        if tag == "li": self.depth += 1
        if tag == "a" and "rankings-page__name-link" in cls: self.field, self.buf = "name", ""
        elif tag == "span" and re.search(r"(^|\s)meta(\s|$)", cls): self.field, self.buf = "meta", ""
        elif tag == "div" and re.search(r"(^|\s)position(\s|$)", cls): self.field, self.buf = "pos", ""
        elif tag == "div" and re.search(r"(^|\s)metrics(\s|$)", cls): self.field, self.buf = "metrics", ""
        elif tag == "span" and re.search(r"(^|\s)score(\s|$)", cls): self.field, self.buf = "score", ""
        elif tag == "span" and "icon-starsolid" in cls and "yellow" in cls: self.cur["stars"] += 1
        elif tag == "img" and a.get("alt"): self.cur["imgs"].append(a["alt"].strip())
    def handle_data(self, d):
        if self.cur is not None and self.field: self.buf += d
    def handle_endtag(self, tag):
        if self.cur is None: return
        if self.field and tag in ("a", "span", "div"):
            self.cur[self.field] = self.buf.strip(); self.field = None
        if tag == "li":
            self.depth -= 1
            if self.depth <= 0:
                if self.cur["name"]: self.rows.append(self.cur)
                self.cur = None

def fetch(url):
    for i in range(3):
        try:
            time.sleep(0.8)
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (403, 404, 429): return None
        except Exception:
            pass
        time.sleep(3 * (i + 1))
    return None

def game_names():
    src = open(os.path.join(ROOT, "assets", "dynasty", "dy-data.js"), encoding="utf-8").read()
    return {l.split("|")[0] for l in re.search(r"const T = `(.*?)`", src, re.S).group(1).strip().split("\n")}

def convert(raw, names):
    out, seen = [], set()
    for r in raw:
        m = re.match(r"^(.*) \((.*)\)$", r["meta"]); hs, home = (m.group(1), m.group(2)) if m else (r["meta"], "")
        try: sc = round(float(r["score"]) * 10000)
        except ValueError: continue
        if sc < MIN_SCORE: continue
        k = (r["name"], hs)
        if k in seen: continue
        seen.add(k)
        school = next((x for x in reversed(r["imgs"]) if x != r["name"]), "")
        school = ALIAS.get(school, school)
        if school and school not in names:
            if school.endswith(" St."): school = school[:-4] + " State"
            if school not in names: continue          # committed outside FBS: not in this game
        ht, _, wt = r["metrics"].replace(" ", "").partition("/")
        try: wt = int(float(wt))
        except ValueError: wt = 0
        out.append([r["name"], r["pos"], school, home, hs, ht, wt, sc, r["stars"]])
    return out

def main():
    names = game_names(); raw = []
    for p in range(1, 121):
        html = fetch(BASE + str(p))
        if not html: print(f"page {p}: no response" ); break
        pg = Page(); pg.feed(html)
        if not pg.rows: break
        raw += pg.rows
        if len(pg.rows) < 50: break
    rows = convert(raw, names)
    n, com = len(rows), sum(1 for r in rows if r[2])
    print(f"pulled {len(raw)} ranked, kept {n} (composite {MIN_SCORE/1e4:.2f}+), {com} committed to FBS schools, {n - com} open")
    if n < 900 or com < 600 or any(not r[0] or not r[1] for r in rows[:50]):
        print("!! 247 pull looks incomplete or blocked: leaving fb-class27.js as it is"); return False
    rows.sort(key=lambda r: -r[7])
    today = (datetime.datetime.utcnow() - datetime.timedelta(hours=5)).date().isoformat()
    body = ("/* The real 2027 recruiting class (247Sports Composite, refreshed automatically by tools/update_class27.py, last pull " + today + "): every ranked prospect with the school he is committed to today (blank = still uncommitted).\n"
            "   Used by Start Today. [name, pos, school, home, high school, height, weight, composite x10000, stars] */\n"
            "(function (root) {\n  root.DY_C27 = { asOf: '" + today + "', rows: " + json.dumps(rows, separators=(",", ":"), ensure_ascii=False) + " };\n"
            "})(typeof window !== 'undefined' ? window : globalThis);\n")
    open(OUT, "w", encoding="utf-8").write(body); print("wrote", OUT); return True

if __name__ == "__main__":
    sys.exit(0 if main() else 1)
