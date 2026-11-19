"""Talent + last-season prior for the Gilbert rating (used by fb_vol_v3.py)."""
import fb_stack2 as S2, fb_gilbert as F, numpy as np, pandas as pd
years=S2.years; TAL=F.TAL
def final(y):
    Sy=F.G[F.G.season==y]; r,h=S2.gil_nohfa(Sy); return r
FIN={y:final(y) for y in range(2015,2026)}
def talprior(y):  # regress last season's final rating on last season's talent, apply to this season's talent
    f=FIN[y-1]; ts=[t for t in f if (y-1,t) in TAL.index and (y,t) in TAL.index]
    x=np.array([TAL[(y-1,t)] for t in ts])/100; yy=np.array([f[t] for t in ts]); c=np.polyfit(x,yy,1)
    xm=np.mean([TAL[(y,t)] for t in ts])/100
    return {t:c[0]*(TAL[(y,t)]/100-xm) for t in ts if (y,t) in TAL.index}, c[0]
def run(mode,k=3):
    out=[]
    for y in years:
        S=F.G[F.G.season==y]; pt,c=talprior(y); pl={t:0.8*v for t,v in FIN.get(y-1,{}).items()}
        for w in sorted(S.week.unique()):
            if w<3: continue
            tr=S[S.week<w]; te=S[(S.week==w)&S.fbs]
            if len(tr)<60 or te.empty: continue
            r0=F.gilbert(tr); h=F.est_hfa(tr,r0)
            pr={"none":None,"talent":pt,"last":pl}.get(mode)
            if mode=="both": pr={t:pt.get(t,0)*0.5+pl.get(t,0)*0.5 for t in set(pt)|set(pl)}
            r=F.gilbert(tr,h,k=0 if pr is None else k,prior=pr)
            t_=te.copy(); t_["g0"]=t_.home_team.map(r)-t_.away_team.map(r); out.append(t_[["game_id","g0"]])
    return pd.concat(out).drop_duplicates("game_id").set_index("g0" if False else "game_id").g0
