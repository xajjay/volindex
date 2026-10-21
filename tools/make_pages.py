"""Build step for clean addresses (run by the deploy workflow on the packaged _site folder).
GitHub Pages only serves real files, so this writes a copy of index.html into a folder for every
sport and tab (e.g. _site/football/depth-chart/index.html), every game, every player page, plus a
404.html fallback and sitemap.xml. Each copy gets <base href="/"> so its assets load from the site root,
and its own title, description, canonical link and share card, so links shared on X, iMessage or Google
show what the page actually is. Keep these lists in sync with assets/router.js and assets/features.js."""
import html as H, json, os, re, sys
site = sys.argv[1] if len(sys.argv) > 1 else "_site"
ORIGIN = "https://www.volindex.net"
SPORTS = {"football": "Football", "volleyball": "Volleyball", "soccer": "Soccer", "mens-basketball": "Men's Basketball",
          "womens-basketball": "Women's Basketball", "baseball": "Baseball", "softball": "Softball"}
SPORT_KEY = {"mens-basketball": "mbb", "womens-basketball": "wbb"}
TABS = {"schedule": "Schedule & Standings", "roster": "Roster", "depth-chart": "Depth Chart", "2027-preview": "2027 Preview", "stats": "Stats",
        "advanced": "Advanced Stats", "recruiting": "Recruiting", "leaders-honors": "Leaders & Honors", "history": "History",
        "social": "Social & Media", "lineup": "Lineup", "review": "Season Review", "roster-moves": "Roster Moves"}
GAME_NAME = {"run": "16-0", "guesser": "Vol Guesser", "grid": "Power T Grid", "career": "VFL Career", "rankings": "Rocky Top Rankings",
             "duel": "Higher or Lower", "trivia": "Vol Trivia"}
GAME_DESC = {"run": "Draft Vols from every era at their best season, then play a 12-game season, the SEC title game and the 12-team playoff. Can you go 16-0?",
             "guesser": "Guess the mystery Vol in eight tries. Every guess shows how close you are.",
             "grid": "Fill a 3x3 grid with Vols who fit each row and column.",
             "career": "Name the Vol for Life from his college path and NFL teams.",
             "rankings": "Put five Tennessee seasons in order of a stat. Three tries.",
             "duel": "Two Tennessee seasons, one stat. Higher or lower? Build a streak.",
             "trivia": "Ten Tennessee trivia questions, easy, medium or hard."}
html = open(os.path.join(site, "index.html"), encoding="utf-8").read()
if "<base " not in html:
    html = html.replace("<head>", '<head>\n<base href="/">', 1)
DEFAULT_IMG = ORIGIN + "/assets/og-image.png"
GAMES_IMG = ORIGIN + "/assets/og-games.png"
pages = []   # (path, priority) for sitemap

def page(rel, title, desc, img=DEFAULT_IMG, ld=None, priority="0.6"):
    url = ORIGIN + "/" + rel.strip("/") + ("/" if rel else "")
    url = url.rstrip("/") if rel else ORIGIN + "/"
    t, d = H.escape(title, quote=True), H.escape(desc, quote=True)
    out = re.sub(r"<title>.*?</title>", f"<title>{t}</title>", html, count=1, flags=re.S)
    out = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + d, out, count=1)
    for prop, val in (("og:title", t), ("og:description", d), ("og:url", H.escape(url)), ("og:image", img)):
        out = re.sub(r'(<meta property="' + prop + r'" content=")[^"]*', lambda m: m.group(1) + val, out, count=1)
    for name, val in (("twitter:title", t), ("twitter:description", d), ("twitter:image", img)):
        out = re.sub(r'(<meta name="' + name + r'" content=")[^"]*', lambda m: m.group(1) + val, out, count=1)
    extra = f'<link rel="canonical" href="{H.escape(url)}">'
    if ld: extra += '\n<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace("</", "<\\/") + "</script>"
    out = out.replace("</head>", extra + "\n</head>", 1)
    if rel:
        d2 = os.path.join(site, rel); os.makedirs(d2, exist_ok=True)
        open(os.path.join(d2, "index.html"), "w", encoding="utf-8").write(out)
    else:
        open(os.path.join(site, "index.html"), "w", encoding="utf-8").write(out)
    pages.append((url, priority))

ORG = {"@context": "https://schema.org", "@type": "WebSite", "name": "The Vol Index", "url": ORIGIN + "/",
       "description": "Tennessee athletics in one place: schedules, rosters, depth charts, stats, recruiting, history and daily games."}
page("", "The Vol Index · Tennessee athletics, all in one place",
     "Every Vols sport in one free hub: schedules, scores, rosters, depth charts, stats, recruiting, history and daily Vol games.", ld=ORG, priority="1.0")
for slug, name in SPORTS.items():
    page(slug, f"Tennessee {name} · The Vol Index", f"Tennessee {name.lower()}: schedule, scores, roster, stats, rankings and history, updated after every game.", priority="0.9")
    for t, tl in TABS.items():
        page(f"{slug}/{t}", f"Tennessee {name} {tl} · The Vol Index", f"Tennessee {name.lower()} {tl.lower()} on The Vol Index.", priority="0.7")
page("sources", "Sources & credits · The Vol Index", "Where every number on The Vol Index comes from.", priority="0.3")
for rel, t in (("about", "About"), ("about/fix", "Corrections & suggestions"), ("about/contact", "Contact")):
    page(rel, f"{t} · The Vol Index", "The Vol Index is an independent Tennessee athletics fan site.", priority="0.3")

# games
page("games", "Vol Games · Daily Tennessee sports games · The Vol Index",
     "Daily games built on Tennessee history: 16-0, Vol Guesser, Power T Grid, VFL Career, trivia and more for every Vols sport.", GAMES_IMG, priority="0.9")
GAMES = {"football": ["run", "guesser", "grid", "career", "rankings", "duel", "trivia"]}
for sp in ["mens-basketball", "womens-basketball", "baseball", "softball", "volleyball", "soccer"]: GAMES[sp] = ["guesser", "rankings", "duel", "trivia"]
for s, games in GAMES.items():
    name = SPORTS[s]
    page(f"games/{s}", f"{name} games · Vol Games · The Vol Index", f"Daily Tennessee {name.lower()} games: " + ", ".join(GAME_NAME[g] for g in games) + ".", GAMES_IMG, priority="0.8")
    for g in games:
        gname = ("Lady Vol " + GAME_NAME[g][4:]) if s == "womens-basketball" and GAME_NAME[g].startswith("Vol ") else GAME_NAME[g]
        ld = {"@context": "https://schema.org", "@type": "VideoGame", "name": f"{gname} ({name})", "url": f"{ORIGIN}/games/{s}/{g}",
              "description": GAME_DESC[g], "gamePlatform": "Web browser", "applicationCategory": "Game", "isAccessibleForFree": True,
              "publisher": {"@type": "Organization", "name": "The Vol Index"}}
        page(f"games/{s}/{g}", f"{gname} · Tennessee {name.lower()} game · The Vol Index", GAME_DESC[g], GAMES_IMG, ld=ld, priority="0.8")
page("me", "Your Vol games · The Vol Index", "Your streaks, results and progress across every Vol game.", GAMES_IMG, priority="0.2")
page("compare", "Compare Vols · The Vol Index", "Put any two Tennessee players side by side: best seasons, careers, honors.", priority="0.6")

# players (tools/players-index.json is written by tools/build_games.py; the deploy copies it in)
idx_path = os.path.join(site, "players-index.json")
if not os.path.exists(idx_path): idx_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "players-index.json")
people = json.load(open(idx_path, encoding="utf-8")) if os.path.exists(idx_path) else []
SP_SLUG = {"football": "football", "mbb": "mens-basketball", "wbb": "womens-basketball", "baseball": "baseball", "softball": "softball", "volleyball": "volleyball", "soccer": "soccer"}
page("players", "Tennessee players · The Vol Index", "Every Vol in our history data, from Peyton Manning to Candace Parker: seasons, stats, honors and pro careers.", priority="0.8")
for sp in SP_SLUG.values():
    page(f"players/{sp}", f"Tennessee {SPORTS[sp].lower()} players · The Vol Index", f"Tennessee {SPORTS[sp].lower()} players with season stats and honors.", priority="0.6")
for sp, slug, name, pos, yrs in people:
    ss = SP_SLUG[sp]; sname = SPORTS[ss]
    ld = {"@context": "https://schema.org", "@type": "Person", "name": name, "url": f"{ORIGIN}/players/{ss}/{slug}",
          "affiliation": {"@type": "SportsTeam", "name": f"Tennessee Volunteers {sname.lower()}", "sport": sname}}
    page(f"players/{ss}/{slug}", f"{name} · Tennessee {sname} · The Vol Index",
         f"{name}{', ' + pos if pos else ''}, Tennessee {sname.lower()}{' ' + yrs if yrs else ''}: season stats, honors and more on The Vol Index.", ld=ld, priority="0.5")

open(os.path.join(site, "404.html"), "w", encoding="utf-8").write(html)
with open(os.path.join(site, "sitemap.xml"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    for url, pr in pages: f.write(f"  <url><loc>{H.escape(url)}</loc><priority>{pr}</priority></url>\n")
    f.write("</urlset>\n")
print(f"wrote {len(pages)} pages (each with its own title and share card) + 404.html + sitemap.xml")
