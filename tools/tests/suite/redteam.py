import sys, json, http.server, threading, functools, re
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT=8890
h=functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT); h.log_message=lambda *a,**k:None
threading.Thread(target=http.server.ThreadingHTTPServer(("127.0.0.1",PORT),h).serve_forever,daemon=True).start()
evil='<img src=x onerror="window.__pwned=1">'
box={"updated":"2026-11-12","season":"2026-27","through":"2026-11-05","team":{"games":1,"wins":1,"losses":0,"pace":70,"us":{},"opp":{}},
 "players":[{"name":evil,"pos":evil,"g":1,"min":20,"mpg":20}],"games":[{"gid":"1","date":"2026-11-02","opp":evil,"site":"H","pts":80,"oppPts":60}],"logs":{evil:[{"date":"2026-11-02","opp":evil,"site":"H","start":True,"min":20,"pts":10,"reb":1,"ast":1,"stl":0,"blk":0,"tov":0,"fg":"1-2","tp":"0-0","ft":"0-0"}]}}
res=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    def run(name, url, route=None):
        pg=b.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        if route: pg.route(re.compile(route[0]), lambda r: r.fulfill(body=route[1], content_type="application/javascript"))
        pg.goto(f"http://127.0.0.1:{PORT}/{url}"); pg.wait_for_timeout(1500)
        pw=pg.evaluate("!!window.__pwned"); n=pg.evaluate("document.body.innerText.length"); res.append((name,"attack succeeded" if pw else "blocked", len(errs), n)); pg.close()
    js="window.SITE_WBBBOX="+json.dumps(box)+";"
    run("RT1 script injected through player, opponent and log names in the women's data","#wbb-advanced",("wbb-analytics\\.js",js))
    run("RT2 script injected in the URL hash","#wbb-advanced%22%3E%3Cimg%20src=x%20onerror=window.__pwned=1%3E")
    run("RT3 script injected through the URL path","wbb/%22%3E%3Cimg%20src=x%20onerror=window.__pwned=1%3E")
    run("RT4 garbage in the men's advanced data (null players)","#mbb-advanced",("mbb-cbbd\\.js","window.SITE_CBBD={players:[null],team:null,games:null};"))
    ok=0
    for t in ["football","volleyball","mbb","wbb","baseball","softball","soccer","games"]:
        pg=b.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(1)); pg.goto(f"http://127.0.0.1:{PORT}/#{t}"); pg.wait_for_timeout(700)
        ok+= (not errs and pg.evaluate("document.body.innerText.length")>300); pg.close()
    b.close()
for r in res: print(r)
print("legitimate pages that loaded normally:", ok, "of 8")
