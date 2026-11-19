import fb_gilbert as F, numpy as np, pandas as pd, os
D=F.D; M=pd.read_parquet(f"{D}/matchup_features.parquet").drop_duplicates("game_id")
cf=f"{D}/cfbd"
years=[y for y in range(2016,2026) if y!=2020]
rows=[]
for y in years:
    S=F.G[F.G.season==y]
    for w in sorted(S.week.unique()):
        if w<3: continue
        tr=S[S.week<w]; te=S[(S.week==w)&S.fbs]
        if len(tr)<60 or te.empty: continue
        r=F.gilbert(tr)   # Gilbert exactly: opp avg + margin, no HFA, no cap, no prior
        t=te.copy(); t["g0"]=t.home_team.map(r)-t.away_team.map(r); rows.append(t)
df=pd.concat(rows).dropna(subset=["g0"])
df=df.merge(M,on="game_id",how="inner",suffixes=("","_m"))
d=lambda c:df[c+"_h"]-df[c+"_a"]
for c in ["c_epa","c_succ","c_expl","c_rush_epa","c_pass_epa","pts_per_drive"]: df["e_"+c]=d(c)
df["prod"]=1.0*d("u_pass")+0.5*d("u_rush")+0.5*d("u_recv")
tal=F.TAL
T=lambda t:np.array([tal.get((s,x),np.nan) for s,x in zip(df.season,t)])
df["tal"]=(T(df.home_team)-T(df.away_team))/100
rt=pd.read_parquet(f"{cf}/returning.parquet").drop_duplicates(["season","team"]).set_index(["season","team"])["percentPPA"]
R=lambda t:np.array([rt.get((s,x),np.nan) for s,x in zip(df.season,t)]); df["ret"]=R(df.home_team)-R(df.away_team)
rc=pd.read_parquet(f"{cf}/recruiting.parquet").drop_duplicates(["season","team"]).set_index(["season","team"])["points"]
# 3-yr recruiting avg
def rec(s,x): v=[rc.get((s-k,x),np.nan) for k in (0,1,2)]; return np.nanmean(v) if not all(np.isnan(v)) else np.nan
df["rec"]=(np.array([rec(s,x) for s,x in zip(df.season,df.home_team)])-np.array([rec(s,x) for s,x in zip(df.season,df.away_team)]))/100
co=pd.read_parquet(f"{cf}/coaches.parquet")
co["hire"]=pd.to_datetime(co.hireDate,utc=True,errors="coerce").dt.year
co=co.sort_values("games",ascending=False).drop_duplicates(["season","school"]).set_index(["season","school"])
def cten(s,x):
    try: return max(0,s-co.loc[(s,x),"hire"])
    except: return np.nan
def cwin(s,x):
    try: return co.loc[(s-1,x),"winPercentage"]  # prior-season win% under program (coaching/programme quality proxy)
    except: return np.nan
df["cten"]=np.clip(np.array([cten(s,x) for s,x in zip(df.season,df.home_team)])-np.array([cten(s,x) for s,x in zip(df.season,df.away_team)]),-6,6)
df["cnew"]=np.array([cten(s,x)<=0 for s,x in zip(df.season,df.home_team)],float)-np.array([cten(s,x)<=0 for s,x in zip(df.season,df.away_team)],float)
cx=F.CTX
H=df[["game_id","home_team"]].merge(cx.rename(columns={"team":"home_team","avail":"aH","rest":"rH"}),on=["game_id","home_team"],how="left")
A=df[["game_id","away_team"]].merge(cx.rename(columns={"team":"away_team","avail":"aA","rest":"rA"}),on=["game_id","away_team"],how="left")
df["av"]=(H.aH.values-A.aA.values); df["rest"]=np.clip(H.rH.values-A.rA.values,-7,7)
df["short"]=(H.rH.values<=6).astype(float)-(A.rA.values<=6).astype(float)
df["site"]=(~df.neu).astype(float); df["conf"]=df.conference_game.fillna(False).astype(float)*df.site
df["early"]=(df.week_x<=5).astype(float) if "week_x" in df else (df.week<=5).astype(float)
for c in ["av","rest","short","rec","cten","cnew"]: df[c]=df[c].fillna(0)
df=df.dropna(subset=["tal","ret","g0"]+["e_"+c for c in ["c_epa","c_succ","c_expl","c_rush_epa","c_pass_epa","pts_per_drive"]]+["prod"])
df["g0e"]=df.g0*df.early; df["tale"]=df.tal*df.early; df["rete"]=df.ret*df.early
print("rows",len(df),"seasons",sorted(df.season.unique()))
EFF=["e_"+c for c in ["c_epa","c_succ","c_expl","c_rush_epa","c_pass_epa","pts_per_drive"]]
def wf(cols,start=2019,lam=0.0):
    out=[]
    for y in years:
        if y<start: continue
        tr=df[df.season<y]; te=df[df.season==y]
        X=lambda a:np.c_[np.ones(len(a)),a[cols].values]
        A_=X(tr);b=np.linalg.solve(A_.T@A_+lam*np.eye(A_.shape[1]),A_.T@tr.margin.values if "margin" in tr else A_.T@tr.m.values)
        out.append(te.assign(pred=X(te)@b))
    o=pd.concat(out); e=(o.m-o.pred); return round(e.abs().mean(),3),round(((o.pred>0)==(o.m>0)).mean()*100,1),round(np.sqrt((e**2).mean()),2),len(o),b.round(2)
steps=[("0 Gilbert raw, +3 HFA",None),
("1 g0 rescaled + our HFA",["g0","site"]),
("2 + early-season damping",["g0","g0e","site"]),
("3 + player availability",["g0","g0e","site","av"]),
("4 + team talent & returning prod",["g0","g0e","site","av","tal","ret","tale","rete"]),
("5 + efficiency (6 opp-adj stats)",["g0","g0e","site","av","tal","ret","tale","rete"]+EFF),
("6 + player production",["g0","g0e","site","av","tal","ret","tale","rete"]+EFF+["prod"]),
("7 + recruiting depth",["g0","g0e","site","av","tal","ret","tale","rete"]+EFF+["prod","rec"]),
("8 + coaching (tenure/new)",["g0","g0e","site","av","tal","ret","tale","rete"]+EFF+["prod","rec","cten","cnew"]),
("9 + scheduling (rest/short/conf)",["g0","g0e","site","av","tal","ret","tale","rete"]+EFF+["prod","rec","cten","cnew","rest","short","conf"])]
if __name__=="__main__":
    b=df[df.season>=2019]; p0=b.g0+np.where(b.neu,0,3); e=b.m-p0
    print(steps[0][0],round(e.abs().mean(),3),round(((p0>0)==(b.m>0)).mean()*100,1),round(np.sqrt((e**2).mean()),2),len(b))
    for n,c in steps[1:]: r=wf(c); print(n,r[:4],flush=True)
    r=wf(steps[-1][1]); print(dict(zip(["b0"]+steps[-1][1],r[4])))
