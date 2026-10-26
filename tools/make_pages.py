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

def page(rel, title, desc, img=DEFAULT_IMG, ld=None, priority="0.6", body=None):
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
    if body:   # static content for search engines and link previews; the app replaces it when it starts
        out = out.replace('<div id="app"></div>', '<div id="app">' + body + '</div>', 1)
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
     "Daily games built on Tennessee history: 16-0, 40-0, Road to Omaha, Vol Guesser, Power T Grid, VFL Career, trivia and more for every Vols sport.", GAMES_IMG, priority="0.9")
GAMES = {"football": ["run", "guesser", "grid", "career", "rankings", "duel", "trivia"]}
for sp in ["mens-basketball", "womens-basketball", "baseball", "softball"]: GAMES[sp] = ["run", "guesser", "rankings", "duel", "trivia"]
for sp in ["volleyball", "soccer"]: GAMES[sp] = ["guesser", "rankings", "duel", "trivia"]
RUN = {"football": ("16-0", GAME_DESC["run"]),
       "mens-basketball": ("40-0", "Draft a starting five from every era of Tennessee basketball, then play 31 real opponents, the SEC Tournament and March Madness. Can you go 40-0?"),
       "womens-basketball": ("40-0", "Draft a Lady Vols starting five from every era, then play 31 real opponents, the SEC Tournament and the NCAA Tournament. Can you go 40-0?"),
       "baseball": ("Road to Omaha", "Draft a Tennessee lineup and pitching staff from every era, then play 56 games, the SEC Tournament, regionals, supers and Omaha. Can you go perfect?"),
       "softball": ("Road to OKC", "Draft a Lady Vols lineup and pitching staff from every era, then play 56 games, the SEC Tournament, regionals, supers and the WCWS. Can you go perfect?")}
for s, games in GAMES.items():
    name = SPORTS[s]
    page(f"games/{s}", f"{name} games · Vol Games · The Vol Index", f"Daily Tennessee {name.lower()} games: " + ", ".join(RUN[s][0] if g == "run" else GAME_NAME[g] for g in games) + ".", GAMES_IMG, priority="0.8")
    for g in games:
        gname = RUN[s][0] if g == "run" else ("Lady Vol " + GAME_NAME[g][4:]) if s == "womens-basketball" and GAME_NAME[g].startswith("Vol ") else GAME_NAME[g]
        gdesc = RUN[s][1] if g == "run" else GAME_DESC[g]
        ld = {"@context": "https://schema.org", "@type": "VideoGame", "name": f"{gname} ({name})", "url": f"{ORIGIN}/games/{s}/{g}",
              "description": gdesc, "gamePlatform": "Web browser", "applicationCategory": "Game", "isAccessibleForFree": True,
              "publisher": {"@type": "Organization", "name": "The Vol Index"}}
        page(f"games/{s}/{g}", f"{gname} · Tennessee {name.lower()} game · The Vol Index", gdesc, GAMES_IMG, ld=ld, priority="0.8")
page("me", "Your Vol games · The Vol Index", "Your streaks, results and progress across every Vol game.", GAMES_IMG, priority="0.2")
page("compare", "Compare Vols · The Vol Index", "Put any two Tennessee players side by side: best seasons, careers, honors.", priority="0.6")

# players: data/players.js (written by tools/build_games.py) has every season line, so each player page ships
# real HTML (name, facts, season-by-season table) that search engines can read without running the app
def load_players():
    for path in (os.path.join(site, "data", "players.js"), os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "players.js")):
        if os.path.exists(path):
            t = open(path, encoding="utf-8").read()
            return json.JSONDecoder().raw_decode(t[t.index("=") + 1:].lstrip())[0]["players"]
    return []
people = load_players()
SP_SLUG = {"football": "football", "mbb": "mens-basketball", "wbb": "womens-basketball", "baseball": "baseball", "softball": "softball", "volleyball": "volleyball", "soccer": "soccer"}
COLS = {"pos": "Pos", "ovr": "OVR", "gp": "GP", "cmp": "Cmp", "att": "Att", "yds": "Pass yds", "td": "Pass TD", "int": "INT", "car": "Car", "ryds": "Rush yds", "rtd": "Rush TD",
        "rec": "Rec", "cyds": "Rec yds", "ctd": "Rec TD", "tot": "Tackles", "tfl": "TFL", "sk": "Sacks", "ints": "INT", "pd": "PBU", "ff": "FF",
        "pts": "Pts", "ppg": "PPG", "reb": "Reb", "rpg": "RPG", "ast": "Ast", "apg": "APG", "stl": "Stl", "blk": "Blk", "tpm": "3PM", "fgp": "FG%",
        "ab": "AB", "h": "H", "hr": "HR", "rbi": "RBI", "r": "R", "sb": "SB", "avg": "AVG", "app": "App", "w": "W", "l": "L", "era": "ERA", "ip": "IP", "so": "K", "sv": "SV",
        "k": "Kills", "a": "Ast", "d": "Digs", "b": "Blocks", "sa": "Aces", "sp": "Sets", "g": "Goals", "sho": "SHO", "gaa": "GAA"}
HON = {"AAu": "Unanimous All-American", "AAc": "Consensus All-American", "AA1": "All-American", "AA2": "All-America 2nd/3rd team", "AAH": "All-America honorable mention", "SEC": "First-team All-SEC", "PPOY": "SEC Pitcher of the Year",
       "SEC2": "Second-team All-SEC", "POY": "SEC Player of the Year", "OPOY": "SEC Offensive POY", "DPOY": "SEC Defensive POY", "H2": "Heisman runner-up", "H5": "Heisman top 5", "H8": "Heisman top 10"}
def hon_text(h): return h[2:] + ("" if any(w in h for w in ("Award", "Trophy", "Year")) else " Award") if h.startswith("W:") else h[2:] + " finalist" if h.startswith("F:") else HON.get(h, h)
def fmt(v):
    if isinstance(v, float) and v < 1: return f"{v:.3f}".lstrip("0")
    return f"{v:,}" if isinstance(v, int) else str(v)
e = lambda x: H.escape(str(x), quote=True)
def span(p):
    ys = p.get("yrs") or []
    if not ys: return ""
    last = ys[-1] + (1 if p["sp"] in ("mbb", "wbb") else 0)
    return str(ys[0]) + ("-" + str(last)[2:] if last != ys[0] else "")
def player_body(p):
    ss = SP_SLUG[p["sp"]]; sname = SPORTS[ss]
    facts = [("Position", p.get("pos")), ("Seasons", span(p)), ("Hometown", p.get("home")), ("Before Tennessee", p.get("frm")), ("Coach (best season)", p.get("coach"))]
    if p.get("draft"): facts.append(("NFL draft", f"{p['draft'][0]}, round {p['draft'][1]}" if p["draft"][1] else f"{p['draft'][0]}, undrafted free agent"))
    if p.get("pro"): facts.append((p["pro"]["lg"] + " draft", f"{p['pro']['y']}, round {p['pro']['rd']}" + (f", pick {p['pro']['pick']}" if p["pro"].get("pick") else "")))
    elif p.get("mlb"): facts.append(("MLB draft", p["mlb"].replace(" rd ", ", round ")))
    if p.get("nfl"): facts.append(("NFL teams", " → ".join(p["nfl"])))
    keys = []
    for sn in p.get("seasons", []):
        for k in sn.get("st", {}):
            if k in COLS and k not in keys: keys.append(k)
    rows = "".join(f"<tr><th>{e(sn.get('s', sn.get('y')))}</th><td>{e(sn.get('pos', ''))}</td>" + "".join(f"<td>{e(fmt(sn['st'][k])) if sn['st'].get(k) is not None else ''}</td>" for k in keys) + "</tr>" for sn in p.get("seasons", []))
    hon = sorted(set(p.get("hon") or []))
    return (f'<div class="wrap pl-page"><nav class="gcrumb"><a href="/players">Players</a> › <a href="/players/{ss}">{e(sname)}</a> › <b>{e(p["n"])}</b></nav>'
            f'<header class="pl-head"><div><div class="eyebrow">Tennessee {e(sname)}</div><h1>{e(p["n"])}</h1>'
            + (f'<p>{e(", ".join(hon_text(h) for h in hon))}</p>' if hon else '') + '</div></header>'
            + '<dl class="pl-facts">' + "".join(f"<div><dt>{e(k)}</dt><dd>{e(v)}</dd></div>" for k, v in facts if v) + '</dl>'
            + f'<div class="box pl-box"><h2>Season by season</h2><table class="pstats"><thead><tr><th>Season</th><th>Pos</th>' + "".join(f"<th>{e(COLS[k])}</th>" for k in keys) + f'</tr></thead><tbody>{rows}</tbody></table></div>'
            + (f'<p>Best season: {e(p.get("bestS") or p.get("best"))}' + (f' ({e(p["line"])})' if p.get("line") else '') + '.</p>' if p.get("best") else '')
            + f'<p><a href="/compare?a={p["sp"]}/{p["slug"]}">Compare {e(p["n"])} with another Vol</a> · <a href="/players/{ss}">All Tennessee {e(sname.lower())} players</a></p></div>')
def list_body(title, ps):
    return (f'<div class="wrap hub-hero"><div class="eyebrow">Players</div><h1>{e(title)}</h1></div><div class="wrap"><ul class="pl-static">'
            + "".join(f'<li><a href="/players/{SP_SLUG[p["sp"]]}/{p["slug"]}">{e(p["n"])}</a> · {e(SPORTS[SP_SLUG[p["sp"]]])}{", " + e(p["pos"]) if p.get("pos") else ""} {e(span(p))}</li>' for p in ps) + '</ul></div>')
page("players", "Tennessee players · The Vol Index", "Every Vol in our history data, from Peyton Manning to Candace Parker: seasons, stats, honors and pro careers.", priority="0.8",
     body=list_body("Tennessee players", people))
for sp, ss in SP_SLUG.items():
    page(f"players/{ss}", f"Tennessee {SPORTS[ss].lower()} players · The Vol Index", f"Tennessee {SPORTS[ss].lower()} players with season stats and honors.", priority="0.6",
         body=list_body(f"Tennessee {SPORTS[ss].lower()} players", [p for p in people if p["sp"] == sp]))
for p in people:
    ss = SP_SLUG[p["sp"]]; sname = SPORTS[ss]; yrs = span(p)
    ld = {"@context": "https://schema.org", "@type": "Person", "name": p["n"], "url": f"{ORIGIN}/players/{ss}/{p['slug']}",
          "affiliation": {"@type": "SportsTeam", "name": f"Tennessee Volunteers {sname.lower()}", "sport": sname}}
    if p.get("home"): ld["homeLocation"] = {"@type": "Place", "name": p["home"]}
    desc = f"{p['n']}{', ' + p['pos'] if p.get('pos') else ''}, Tennessee {sname.lower()}{' ' + yrs if yrs else ''}" + (f". Best season {p.get('bestS') or p.get('best')}: {p['line']}" if p.get("line") else "") + ". Season stats, honors and more on The Vol Index."
    page(f"players/{ss}/{p['slug']}", f"{p['n']} · Tennessee {sname} · The Vol Index", desc, ld=ld, priority="0.6", body=player_body(p))

open(os.path.join(site, "404.html"), "w", encoding="utf-8").write(html)
with open(os.path.join(site, "sitemap.xml"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    for url, pr in pages: f.write(f"  <url><loc>{H.escape(url)}</loc><priority>{pr}</priority></url>\n")
    f.write("</urlset>\n")
print(f"wrote {len(pages)} pages (each with its own title and share card) + 404.html + sitemap.xml")
