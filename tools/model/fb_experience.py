"""Roster experience for LSU / Tennessee / Vanderbilt.  python fb_experience.py
Academic class: Fr/RFr 1, So/RSo 2, Jr/RJr 3, Sr 4, 5th-year/Graduate 5 (redshirt years don't add a year).  Snap-weighted where we have snap counts (LSU, Tennessee)."""
import os, re, json, unicodedata
D=os.path.dirname(os.path.abspath(__file__)); R=os.path.join(D,"..","cache","fbm","rosters")
YR={"freshman":1,"fr":1,"redshirt freshman":1,"r-fr":1,"sophomore":2,"so":2,"redshirt sophomore":2,"r-so":2,"junior":3,"jr":3,"redshirt junior":3,"r-jr":3,"senior":4,"sr":4,"5th-year senior":5,"5th year":5,"5th":5,"graduate":5,"graduate student":5,"grad":5}
def yrs(c): return YR.get(re.sub(r"[.\s]+$","",c.strip().lower()))
def norm(s): return re.sub(r"[^a-z ]","",re.sub(r"\b(jr|sr|ii|iii|iv)\b","",unicodedata.normalize("NFKD",s).encode("ascii","ignore").decode().lower())).strip()
def load_txt(f): return [(a,b,yrs(c)) for a,b,c in (l.rstrip("\n").split("|") for l in open(os.path.join(R,f)) if "|" in l) if yrs(c)]
def tenn():
    s=open(os.path.join(D,"..","..","data","football.js")).read(); i=s.index('"players": ['); out=[]
    for m in re.finditer(r'"name": "([^"]+)",\s*"num": [^,]*,\s*"pos": "([^"]+)",.*?"cls": "([^"]+)"',s[i:],re.S):
        y=yrs(m.group(3)); 
        if y: out.append((m.group(1),m.group(2),y))
    return out
snaps=json.load(open(os.path.join(D,"..","..","data","snaps.json")))
def report(team,ros):
    mean=sum(y for _,_,y in ros)/len(ros); res={"roster_n":len(ros),"roster_mean_years":round(mean,2),"pct_5th_or_grad":round(sum(y==5 for *_,y in ros)/len(ros)*100,1),"pct_freshman_rs":round(sum(y<=2 for *_,y in ros)/len(ros)*100,1)}
    if team in snaps:
        cls={norm(n):y for n,_,y in ros}; w=t=0
        for p in snaps[team]["players"]:
            y=cls.get(norm(p["name"]))
            if y: w+=y*p["snaps"]; t+=p["snaps"]
        res["snap_weighted_years"]=round(w/t,2) if t else None; res["snap_coverage"]=f'{sum(1 for p in snaps[team]["players"] if cls.get(norm(p["name"])))}/{len(snaps[team]["players"])} players'
        # starters = top snaps per unit
        pl=sorted([(p["snaps"],cls.get(norm(p["name"]))) for p in snaps[team]["players"] if cls.get(norm(p["name"]))],reverse=True)[:22]
        res["top22_by_snaps_years"]=round(sum(y for _,y in pl)/len(pl),2)
    return res
if __name__=="__main__":
    for team,ros in [("Tennessee",tenn()),("LSU",load_txt("lsu_2026.txt")),("Vanderbilt",load_txt("vanderbilt_2026.txt"))]: print(team,report(team,ros))
