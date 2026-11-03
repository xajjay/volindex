/* Locker room for the basketball / baseball / softball dynasties: adapter between SD and the shared MORALE core (assets/morale.js). Default off (Settings). */
(function () {
  'use strict';
  const SD = window.SD, M = window.MORALE, G = () => SD.G;
  const hoops = () => SD.kind() === 'hoops';
  const ranked = () => SD.userT().roster.map(SD.P).sort((a, b) => b.ovr - a.ovr);
  const gp = p => (p.lastS && p.lastS.gp) || 0;
  SD.moraleAdapter = () => ({
    g: G, cap: hoops() ? 2 : 3, redshirtGames: 0,
    roster: () => SD.userT().roster.map(SD.P),
    name: p => p.n, ovr: p => p.ovr,
    nil: p => p.nil || 0, nilValue: p => (G().settings.nil === 'off' ? 0 : SD.nilValue(p, SD.userT())),
    winPct: () => { const t = SD.userT(), n = t.w + t.l; return n ? t.w / n : 0.5; },
    expWin: () => { const ts = G().teams.filter(t => !t.dorm && t.roster && t.roster.length), avg = ts.reduce((a, t) => a + SD.teamRating(t), 0) / ts.length; return Math.max(0.15, Math.min(0.9, 0.5 + (SD.teamRating(SD.userT()) - avg) * 0.02)); },
    yr: p => p.yr, stars: p => (p.rec && p.rec.stars) || 0,
    group: p => (hoops() ? ranked() : ranked().filter(q => (SD.isPit ? SD.isPit(q) === SD.isPit(p) : true))),
    slots: p => (hoops() ? 5 : (SD.isPit && SD.isPit(p) ? 5 : 9)), rot: p => (hoops() ? 9 : (SD.isPit && SD.isPit(p) ? 8 : 12)),
    tierShare: t => (hoops() ? { start: 0.66, rot: 0.34, bench: 0.07 }[t] : { start: 0.7, rot: 0.35, bench: 0.05 }[t]),
    role: p => {
      const s = p.lastS, g0 = gp(p); if (!s || !g0) return { start: false, rot: false, share: 0, usage: 9, gp: g0 };
      const mpg = (s.min || 0) / g0, T = SD.userT().roster.map(SD.P).filter(q => gp(q)).sort((a, b) => ((b.lastS.pts || 0) / gp(b)) - ((a.lastS.pts || 0) / gp(a)));
      if (!hoops()) { const share = (s.pa || s.bf || 0) / 150; return { start: share > 0.6, rot: share > 0.25, share, usage: 5, gp: g0 }; }
      return { start: (s.gs || 0) / g0 > 0.5 || mpg >= 24, rot: mpg >= 12, share: mpg / 40, usage: T.indexOf(p) + 1, gp: g0 };
    },
    raise: (p, amt) => SD.adjustNil(p.id, amt),
    news: (k, h, b) => SD.news(k, h, b),
  });
  SD.moraleTick = () => { const g = G(); if (!M || !M.on(g)) return; const t = SD.userT(), n = t.w + t.l, every = hoops() ? 7 : 10; if (n && n % every === 0 && g.mor_last !== n) { g.mor_last = n; M.tick(SD.moraleAdapter()); } };
  SD.moraleSeasonEnd = () => { if (M && M.on(G())) return M.seasonEnd(SD.moraleAdapter()); return null; };
})();
