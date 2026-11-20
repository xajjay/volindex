"""Team-specific home-field test.  Joint ridge: margin = r(team,season)_home - r(team,season)_away + H + host[team] - visit[team]."""
import sys; sys.path.insert(0,'.')
import fb_gilbert as F, numpy as np, pandas as pd, scipy.sparse as sp
from sklearn.linear_model import Ridge
G=F.G[(F.G.fbs)&(~F.G.neutral_site.fillna(False).astype(bool))].copy()
G["m"]=G.home_score-G.away_score
G=G[G.season.isin([y for y in range(2014,2026) if y!=2020])]
def fit(g,lam_t=110.0,lam_r=0.05):
    ts=sorted(set(zip(g.season,g.home_team))|set(zip(g.season,g.away_team))); ti={k:i for i,k in enumerate(ts)}
    teams=sorted(set(g.home_team)|set(g.away_team)); pi={t:i for i,t in enumerate(teams)}
    n=len(g); nt=len(ts); np_=len(teams)
    r=[];c=[];v=[]
    ih=np.array([ti[(s,t)] for s,t in zip(g.season,g.home_team)]); ia=np.array([ti[(s,t)] for s,t in zip(g.season,g.away_team)])
    ph=np.array([pi[t] for t in g.home_team]); pa=np.array([pi[t] for t in g.away_team])
    rows=np.arange(n); sr=1/np.sqrt(lam_r); st=1/np.sqrt(lam_t)
    X=sp.hstack([sp.csr_matrix((np.full(n,sr),(rows,ih)),shape=(n,nt))-sp.csr_matrix((np.full(n,sr),(rows,ia)),shape=(n,nt)),
                 sp.csr_matrix(np.full((n,1),1.0)),
                 sp.csr_matrix((np.full(n,st),(rows,ph)),shape=(n,np_)),
                 sp.csr_matrix((np.full(n,-st),(rows,pa)),shape=(n,np_))]).tocsr()
    m=Ridge(alpha=1.0,fit_intercept=False,solver="auto").fit(X,g.m.values)
    co=m.coef_; H=co[nt]; host=co[nt+1:nt+1+np_]*st; vis=co[nt+1+np_:]*st
    return H,dict(zip(teams,host)),dict(zip(teams,vis)),m,X
if __name__=="__main__":
    H,host,vis,m,X=fit(G); print("league H",round(H,2))
    cnt=G.home_team.value_counts()
    t=pd.DataFrame({"host":host,"visit":vis,"n_home":cnt}).fillna(0); t["total_edge"]=H+t.host+t.visit*0  # host effect = extra home pts
    t["hfa"]=H+t.host
    print(t.loc[["Tennessee","Vanderbilt","LSU","Alabama","Georgia","Ohio State","Florida","Texas A&M","Kentucky","Oregon"]].round(2))
    print("top 8",t.sort_values("hfa",ascending=False).head(8).hfa.round(2).to_dict())
    print("bottom 8",t.sort_values("hfa").head(8).hfa.round(2).to_dict())
    print("SD of host effect",t.host.std().round(2))
    # split-half stability: even vs odd seasons
    a=G[G.season%2==0]; b=G[G.season%2==1]
    Ha,ha,_,_,_=fit(a); Hb,hb,_,_,_=fit(b)
    k=sorted(set(ha)&set(hb)); print("even/odd host-effect corr",np.corrcoef([ha[x] for x in k],[hb[x] for x in k])[0,1].round(3), "Tennessee even/odd",round(Ha+ha["Tennessee"],2),round(Hb+hb["Tennessee"],2),"Vanderbilt",round(Ha+ha["Vanderbilt"],2),round(Hb+hb["Vanderbilt"],2))
    # raw home vs road split for Tennessee/Vanderbilt: avg margin vs expected from ratings w/o team effects
