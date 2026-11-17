"""Ourlads depth charts -> tools/cache/fbm/depth.json   (run from GitHub Actions; the sandbox cannot reach ourlads.com)
    python tools/model/fb_depth.py [Tennessee LSU Vanderbilt ...]     default: Tennessee, LSU, Vanderbilt
Page layout (verified by fetch): tables of Pos | No. | Player 1..5, cell text like '3 Jackson, Radarious (SO)'.
Team slugs/ids are discovered from the links on the Tennessee page, so nothing is hard-coded.
"""
import re, sys, os, json, time, urllib.request, html as H
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cache", "fbm", "depth.json")
BASE = "https://www.ourlads.com/ncaa-football-depth-charts/"
UA = {"User-Agent": "Mozilla/5.0 (VolIndex research; contact github.com/xajjay/volindex)"}
CLS = r"(?:RS\s+)?(?:FR|SO|JR|SR|GR)(?:/TR)?"
PLAYER = re.compile(r"^\s*(\d{1,2})\s+([^,()]+),\s*(.+?)\s*(?:\(\s*(" + CLS + r")\s*\)|\s(" + CLS + r"))?\s*$")


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def cells(row):
    return [re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.S | re.I)]


def parse(page):
    """-> {'offense': {pos: [players]}, 'defense': {...}, 'special': {...}}; player = {no, name, cls, rank}"""
    out, unit = {}, "offense"
    for blk in re.split(r"(?i)<table", page)[1:]:
        low = blk.lower()
        if "defense" in low[:600] or "4-2-5" in low[:600] or "3-4" in low[:600]: unit = "defense"
        elif "special" in low[:600]: unit = "special"
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", blk, flags=re.S | re.I):
            c = [x for x in cells(row) if x]
            if len(c) < 2 or not re.match(r"^[A-Z]{1,4}(-[A-Z]+)?$", c[0]): continue
            pos, plist = c[0], []
            pend = None
            for x in c[1:]:
                if re.fullmatch(r"\d{1,2}", x): pend = x; continue            # separate No. column
                if pend and not PLAYER.match(x): x = f"{pend} {x}"
                pend = None
                m = PLAYER.match(x)
                if m: plist.append({"no": int(m.group(1)), "name": f"{m.group(3).strip()} {m.group(2).strip()}", "cls": (m.group(4) or m.group(5) or "").strip(), "rank": len(plist) + 1})
            if plist: out.setdefault(unit, {})[pos] = plist
    return out


def main():
    want = [a.lower() for a in sys.argv[1:]] or ["tennessee", "lsu", "vanderbilt"]
    home = get(BASE + "depth-chart.aspx?s=tennessee&id=91993")
    links = dict((s.lower(), (s, i)) for s, i in re.findall(r"depth-chart\.aspx\?s=([^&\"']+)&(?:amp;)?id=(\d+)", home))
    res = {}
    for t in want:
        if t not in links: print("no link for", t); continue
        slug, tid = links[t]
        try: page = get(BASE + f"depth-chart.aspx?s={slug}&id={tid}")
        except Exception as e: print(t, "failed", e); continue
        d = parse(page); n = sum(len(v) for v in d.values())
        print(t, n, "position rows"); res[t] = {"slug": slug, "id": tid, "chart": d}; time.sleep(2)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"fetched": time.strftime("%Y-%m-%d"), "source": "ourlads.com", "teams": res}, open(OUT, "w"), indent=1)


if __name__ == "__main__":
    main()
