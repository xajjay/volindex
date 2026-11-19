"""v2 stack: Gilbert (home field removed from the fit) + talent + efficiency; HFA only added at matchup time.  Tests HFA refinements."""
import fb_gilbert as F, numpy as np, pandas as pd
D=F.D; M=pd.read_parquet(f"{D}/matchup_features.parquet").drop_duplicates("game_id")
years=[y for y in range(2016,2026) if y!=2020]
def gil_nohfa(tr,iters=3):
    r=F.gilbert(tr); h=F.est_hfa(tr,r)
    for _ in range(iters): r=F.gilbert(tr,h); h=F.est_hfa(tr,r)
    return r,h
rows=[]
for y in years:
    S=F.G[F.G.season==y]
    for w in sorted(S.week.unique()):
        if w<3: continue
        tr=S[S.week<w]; te=S[(S.week==w)&S.fbs]
        if len(tr)<60 or te.empty: continue
        r,h=gil_nohfa(tr); t=te.copy(); t["g0"]=t.home_team.map(r)-t.away_team.map(r); t["h_est"]=h; rows.append(t)
df=pd.concat(rows).dropna(subset=["g0"]).merge(M,on="game_id",how="inner",suffixes=("","_m"))
ms=["c_epa","c_succ","c_expl","c_rush_epa","c_pass_epa","pts_per_drive"]
EFF=["e_"+m for m in ms]
for m in ms: df["e_"+m]=df[m+"_h"]-df[m+"_a"]
T=lambda c:np.array([F.TAL.get((s,x),np.nan) for s,x in zip(df.season,df[c])])
df["tal"]=(T("home_team")-T("away_team"))/100
df["site"]=(~df.neu).astype(float); df["early"]=(df.week<=5).astype(float)
df["g0e"]=df.g0*df.early; df["tale"]=df.tal*df.early
cx=F.CTX
H=df[["game_id","home_team"]].merge(cx.rename(columns={"team":"home_team","avail":"aH","rest":"rH"}),on=["game_id","home_team"],how="left")
A=df[["game_id","away_team"]].merge(cx.rename(columns={"team":"away_team","avail":"aA","rest":"rA"}),on=["game_id","away_team"],how="left")
df["av"]=(H.aH.fillna(0).values-A.aA.fillna(0).values)
df["rest"]=np.clip(H.rH.fillna(10).values-A.rA.fillna(10).values,-7,7)
df=df.dropna(subset=["tal"]+EFF)
# ---- venue / travel features
V=pd.read_parquet(f"{D}/cfbd/venues.parquet").drop_duplicates("name").set_index("name")
gv=F.G.dropna(subset=["venue"]); hv=gv[~gv.neu].groupby(["season","home_team"]).venue.agg(lambda s:s.mode().iloc[0])
def ll(season,team):
    n=hv.get((season,team)) 
    if n is None or n not in V.index: return (np.nan,np.nan,np.nan,np.nan)
    v=V.loc[n]; f=lambda x:float(pd.to_numeric(x,errors='coerce')); return (f(v.latitude),f(v.longitude),f(v.elevation),f(v.capacity))
def hav(a,b):
    la1,lo1,la2,lo2=map(np.radians,[a[0],a[1],b[0],b[1]]); d=np.sin((la2-la1)/2)**2+np.cos(la1)*np.cos(la2)*np.sin((lo2-lo1)/2)**2
    return 3959*2*np.arcsin(np.sqrt(d))
hh=[ll(s,t) for s,t in zip(df.season,df.home_team)]; aa=[ll(s,t) for s,t in zip(df.season,df.away_team)]
df["miles"]=[hav(h,a) if not(np.isnan(h[0]) or np.isnan(a[0])) else np.nan for h,a in zip(hh,aa)]
df["lon_shift"]=[abs(h[1]-a[1])/15 if not(np.isnan(h[1]) or np.isnan(a[1])) else np.nan for h,a in zip(hh,aa)]  # ~time zones crossed
df["elev"]=[(h[2]-a[2]) if not(np.isnan(h[2]) or np.isnan(a[2])) else np.nan for h,a in zip(hh,aa)]
df["cap"]=[h[3] for h in hh]
for c,fill in [("miles",df.miles.median()),("lon_shift",0),("elev",0),("cap",df.cap.median())]: df[c]=df[c].fillna(fill)
df["miles_k"]=np.clip(df.miles,0,2500)/1000*df.site; df["tz"]=df.lon_shift*df.site; df["elev_k"]=np.clip(df.elev,-1500,1500)/1000*df.site
df["cap_k"]=(df.cap-df.cap.median())/50000*df.site
df["conf_g"]=df.conference_game.fillna(False).astype(float)*df.site
# ---- shrunk team HFA, walk-forward: residuals from previous seasons only
pre=df.copy()
def team_hfa_wf(y,k=40):
    prior=df[df.season<y]
    if len(prior)<500: return {}
    base=np.c_[np.ones(len(prior)),prior[["g0","g0e","site","tal","tale"]+EFF].values]; b=np.linalg.lstsq(base,prior.m.values,rcond=None)[0]
    res=(prior.m-base@b+b[3]*0)  # residual includes the average site effect already removed
    res=res[prior.site==1]; g=prior[prior.site==1].assign(res=res)
    s=g.groupby("home_team").res.agg(["sum","count"]); return ((s["sum"])/(s["count"]+k)).to_dict()   # shrunk toward 0 (league HFA is the site weight)
df["thfa"]=0.0
for y in years:
    d=team_hfa_wf(y); idx=df.season==y; df.loc[idx,"thfa"]=df.loc[idx,"home_team"].map(d).fillna(0)*df.loc[idx,"site"]
BASE=["g0","g0e","site","tal","tale"]+EFF
def wf(cols,start=2019):
    out=[]
    for y in years:
        if y<start: continue
        tr=df[df.season<y]; te=df[df.season==y]; X=lambda a:np.c_[np.ones(len(a)),a[cols].values]
        b=np.linalg.lstsq(X(tr),tr.m.values,rcond=None)[0]; out.append(te.assign(pred=X(te)@b))
    o=pd.concat(out); e=o.m-o.pred; return round(e.abs().mean(),3),round(((o.pred>0)==(o.m>0)).mean()*100,1),round(np.sqrt((e**2).mean()),2),len(o),b.round(3)
if __name__=="__main__":
    print("rows",len(df))
    r=wf(BASE); print("base (HFA constant)         ",r[:4]); print(dict(zip(["b0"]+BASE,r[4])))
    for n,c in [("+ team HFA (shrunk)",["thfa"]),("+ travel miles",["miles_k"]),("+ time zones crossed",["tz"]),("+ elevation diff",["elev_k"]),("+ stadium capacity",["cap_k"]),("+ conference game",["conf_g"]),("+ rest diff",["rest"]),("+ availability",["av"]),("all home-field extras",["thfa","miles_k","tz","elev_k","cap_k","conf_g"])]:
        r=wf(BASE+c); print(f"{n:<28}",r[:4],dict(zip(c,r[4][-len(c):])),flush=True)
