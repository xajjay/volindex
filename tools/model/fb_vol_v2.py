"""Vol Index power rating v2: Gilbert baseline + HFA + talent + efficiency (+ early-season weighting), availability per game."""
import numpy as np, pandas as pd, json, os, re
import fb_stack as S, fb_gilbert as F, fb_ratings as FR
df=S.df; EFF=S.EFF
COLS=["g0","g0e","site","av","tal","ret","tale","rete"]+EFF
X=np.c_[np.ones(len(df)),df[COLS].values]; b=np.linalg.lstsq(X,df.m.values,rcond=None)[0]; B=dict(zip(["b0"]+COLS,b))
print({k:round(v,3) for k,v in B.items()})
# --- current season inputs ---
G,T=FR.load(); P=FR.panel(G,T); teams=sorted(set(P["o"])|set(P["d"]))
names={}
for side in("home","away"):
    for i,n in zip(G[f"{side}_team_id"],G[f"{side}_team"]): names[i]=n
season=int(G.season.max()); cut=int(P["day"].max())+1
St=FR.strengths(P,teams,cut,240,20); inv={v:k for k,v in names.items()}
def eff(t,m): O,D,_,ix=St[m]; return float(O[ix[inv[t]]]-D[ix[inv[t]]])
g26=F.G[F.G.season==season]; gr=F.gilbert(g26)
fbs=set(g26[g26.fbs].home_team)|set(g26[g26.fbs].away_team)
cur=[t for t in fbs if t in inv and (g26.home_team.eq(t)|g26.away_team.eq(t)).sum()>=7]
tal={t:F.TAL.get((season,t),np.nan) for t in cur}; tm=np.nanmean(list(tal.values())); tal={k:(tm if np.isnan(v) else v) for k,v in tal.items()}
rt=pd.read_parquet(f"{F.D}/cfbd/returning.parquet").drop_duplicates(["season","team"]).set_index(["season","team"])["percentPPA"]
ret={t:rt.get((season,t),np.nan) for t in cur}; rm=np.nanmean(list(ret.values())); ret={k:(rm if np.isnan(v) else v) for k,v in ret.items()}
gm=np.mean([gr[t] for t in cur]); em={m:np.mean([eff(t,m) for t in cur]) for m in FR.METRICS}
wk=int(g26.week.max()); early=1.0 if wk<=5 else 0.0
def parts(t):
    g=B["g0"]*(gr[t]-gm)+B["g0e"]*early*(gr[t]-gm)
    tr=B["tal"]*(tal[t]-tm)/100+B["ret"]*(ret[t]-rm)+early*(B["tale"]*(tal[t]-tm)/100+B["rete"]*(ret[t]-rm))
    ef=sum(B["e_"+m]*(eff(t,m)-em[m]) for m in FR.METRICS)
    return g,tr,ef
rows=[]
for t in cur:
    g,tr,ef=parts(t); rows.append((t,g+tr+ef,g,tr,ef,gr[t]+100))
R=pd.DataFrame(rows,columns=["team","power","gilbert","talent","eff","gil100"]).sort_values("power",ascending=False).reset_index(drop=True); R.index+=1
for c in("gilbert","talent","eff"): R[c+"_rk"]=R[c].rank(ascending=False).astype(int)
R["power"]-=R.power.mean(); R.to_csv("/tmp/vol_v2_power.csv")
print(R.head(25).round(1).to_string())
for t in("Tennessee","LSU","Vanderbilt"): print(R.loc[R.team==t].round(1).to_string(header=False))
# --- sample game LSU at Tennessee ---
def game(home,away,site=1,avU=0.0):
    ph,pa=R.set_index("team").loc[home],R.set_index("team").loc[away]
    d=lambda c:ph[c]-pa[c]
    out={"Gilbert baseline (margin + opp avg)":d("gilbert"),"Talent + returning":d("talent"),"Efficiency (6 stats)":d("eff"),"Home field":B["site"]*site,"Availability":B["av"]*avU,"Intercept":B["b0"]}
    return out
a=game("Tennessee","LSU",1,-3.68-(-1.03)); print(json.dumps({k:round(v,2) for k,v in a.items()},indent=1),"total",round(sum(a.values()),2))
a2=game("Tennessee","Vanderbilt",0,0); print({k:round(v,2) for k,v in a2.items()},"neutral total",round(sum(a2.values()),2))
json.dump({k:float(v) for k,v in B.items()},open("/tmp/vol_v2_betas.json","w"))
