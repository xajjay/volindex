"""Build step for clean addresses (run by the deploy workflow on the packaged _site folder).
GitHub Pages only serves real files, so this writes a copy of index.html into a folder for every
sport and tab (e.g. _site/football/depth-chart/index.html) plus a 404.html fallback. Each copy gets
<base href="/"> so its assets load from the site root. Keep these lists in sync with assets/router.js."""
import os, re, sys
site = sys.argv[1] if len(sys.argv) > 1 else "_site"
SPORTS = ["football", "volleyball", "soccer", "mens-basketball", "womens-basketball", "baseball", "softball"]
TABS = ["schedule", "roster", "depth-chart", "2027-preview", "stats", "advanced", "recruiting", "leaders-honors",
        "history", "social", "lineup", "review", "roster-moves"]
html = open(os.path.join(site, "index.html"), encoding="utf-8").read()
if "<base " not in html:
    html = html.replace("<head>", '<head>\n<base href="/">', 1)
def write(rel):
    d = os.path.join(site, rel); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(html)
n = 0
for s in SPORTS:
    write(s); n += 1
    for t in TABS: write(os.path.join(s, t)); n += 1
write("sources"); n += 1
write("about"); write(os.path.join("about", "fix")); write(os.path.join("about", "contact")); n += 3
for g in ["", "run", "guesser", "grid", "career", "rankings"]:  # games hub + each game (keep in sync with assets/games.js)
    write(os.path.join("games", g) if g else "games"); n += 1
open(os.path.join(site, "404.html"), "w", encoding="utf-8").write(html)
print(f"wrote {n} page folders + 404.html")
