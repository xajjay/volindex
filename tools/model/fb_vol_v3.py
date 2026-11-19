"""Vol Index power rating v3.  python fb_vol_v3.py
power = w1*Gilbert(opp avg + margin, home field REMOVED, talent+last-season prior) + w2*talent + w3*efficiency(6 stats, offense minus defense)
prediction = power gap + home field (matchup only) + availability swing"""
import sys; sys.path.insert(0,'.')
import numpy as np, pandas as pd, json
import fb_stack2 as S2, fb_gilbert as F, fb_ratings as FR
from fb_prior import FIN, talprior, run
# --- stage 2 fit on all history using the prior-informed Gilbert
g=run("both"); d=S2.df.copy(); d["g0"]=d.game_id.map(g); d=d.dropna(subset=["g0"]); d["g0e"]=d.g0*d.early
COLS=["g0","g0e","site","tal","tale"]+S2.EFF
X=np.c_[np.ones(len(d)),d[COLS].values]; b=np.linalg.lstsq(X,d.m.values,rcond=None)[0]; B=dict(zip(["b0"]+COLS,b))
# availability weight (fit separately so it is its own line)
S2.df=d; r_av=S2.wf(COLS+["av"]); B["av"]=float(r_av[4][-1]); print("with availability",r_av[:3],"av weight",round(B["av"],2))
print({k:round(float(v),3) for k,v in B.items()})
# --- current season
G,T=FR.load(); P=FR.panel(G,T); teams=sorted(set(P["o"])|set(P["d"])); names={}
for side in("home","away"):
    for i,n in zip(G[f"{side}_team_id"],G[f"{side}_team"]): names[i]=n
season=int(G.season.max()); cut=int(P["day"].max())+1; inv={v:k for k,v in names.items()}
St=FR.strengths(P,teams,cut,240,20)
eff=lambda t,m:float(St[m][0][St[m][3][inv[t]]]-St[m][1][St[m][3][inv[t]]])
S=F.G[F.G.season==season]; fbs=set(S[S.fbs].home_team)|set(S[S.fbs].away_team)
cur=[t for t in fbs if t in inv and (S.home_team.eq(t)|S.away_team.eq(t)).sum()>=7]
r0=F.gilbert(S); h0=F.est_hfa(S,r0)
for _ in range(3): r0=F.gilbert(S,h0); h0=F.est_hfa(S,r0)
pure=r0                                          # Gilbert, HFA removed, no prior
FIN[season]=pure
pt,_=talprior(season) if (season-1) in FIN else ({},0)
pl={t:0.8*v for t,v in FIN[season-1].items()}
pr={t:pt.get(t,0)*0.5+pl.get(t,0)*0.5 for t in set(pt)|set(pl)}
rp=F.gilbert(S,h0,k=3,prior=pr)                    # with talent + last-season prior
tal={t:F.TAL.get((season,t),np.nan) for t in cur}; tm=np.nanmean(list(tal.values())); tal={k:(tm if np.isnan(v) else v) for k,v in tal.items()}
em={m:np.mean([eff(t,m) for t in cur]) for m in FR.METRICS}; gm=np.mean([rp[t] for t in cur]); pm=np.mean([pure[t] for t in cur])
wk=int(S.week.max()); early=1.0 if wk<=5 else 0.0
rows=[]
for t in cur:
    g_=(B["g0"]+B["g0e"]*early)*(rp[t]-gm); tl=(B["tal"]+B["tale"]*early)*(tal[t]-tm)/100; ef=sum(B["e_"+m]*(eff(t,m)-em[m]) for m in FR.METRICS)
    rows.append((t,g_+tl+ef,g_,tl,ef,pure[t]-pm))
R=pd.DataFrame(rows,columns=["team","power","gilbert","talent","efficiency","pure_gilbert"])
R["power"]-=R.power.mean(); R=R.sort_values("power",ascending=False).reset_index(drop=True); R.index+=1
R["pure_rank"]=R.pure_gilbert.rank(ascending=False).astype(int)
R.round(2).to_csv("/tmp/v3_power.csv"); json.dump({"B":{k:float(v) for k,v in B.items()},"hfa_direct":h0},open("/tmp/v3_betas.json","w"))
print("direct HFA this season",round(h0,2))
print(R.head(25).round(1).to_string())
for t in ("Tennessee","LSU","Vanderbilt"): print(R[R.team==t].round(1).to_string(header=False))
P_=R.set_index("team").power
avU,avL=-3.68,-1.03
def pred(home,away,avh,ava,neutral=False): 
    gap=P_[home]-P_[away]; hfa=0 if neutral else B["site"]; av=B["av"]*(avh-ava); return gap,hfa,av,gap+hfa+av+B["b0"]
print("LSU @ TENN  gap/hfa/avail/margin(Tenn)",[round(x,2) for x in pred("Tennessee","LSU",avU,avL)])
print("TENN @ VANDY (Vandy home) margin(Tenn)",[round(x,2) for x in (lambda a:(a[0],-a[1],a[2],a[0]-a[1]+a[2]+B["b0"]))(pred("Tennessee","Vanderbilt",avU,0.0))])
print("neutral Tenn-Vandy",round(P_["Tennessee"]-P_["Vanderbilt"],2))
