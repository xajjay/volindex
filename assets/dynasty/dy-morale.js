/* Locker room for Vol Dynasty (football): adapter between DY and the shared MORALE core (assets/morale.js). Default off (Settings). */
(function () {
  'use strict';
  const DY = window.DY, M = window.MORALE, G = () => DY.G || window.DYG;
  const gOf = () => (DY.G && DY.G.teams ? DY.G : window.DYG);
  const ut = () => DY.userT();
  const have = (p) => ut().roster.map(DY.P).filter(q => q && q.pos === p.pos).sort((a, b) => b.ovr - a.ovr);
  const SKILL = ['QB', 'RB', 'WR', 'TE'];
  DY.moraleAdapter = () => ({
    g: gOf, cap: 4, line: 54, redshirtGames: 0,
    roster: () => ut().roster.map(DY.P),
    name: p => p.n, ovr: p => p.ovr, yr: p => p.yr, stars: p => (p.rec && p.rec.stars) || 0,
    group: p => have(p), slots: p => DY.STARTERS[p.pos] || 1, rot: p => (DY.STARTERS[p.pos] || 1) + ({ QB: 0, K: 0, P: 0, RB: 1, WR: 2, TE: 1, OT: 1, IOL: 1, EDGE: 2, DT: 2, LB: 2, CB: 2, S: 1 }[p.pos] || 1),
    canFocal: p => SKILL.includes(p.pos),
    tierShare: t => ({ start: 0.7, rot: 0.3, bench: 0.04 }[t]),
    nil: p => p.nil || 0, nilValue: p => (gOf().settings && gOf().settings.nil === 'off' ? 0 : (p.nilV || DY.nilValue(p, ut()))),
    winPct: () => { const t = ut(), n = t.w + t.l; return n ? t.w / n : 0.5; },
    expWin: () => { const o = t => { const v = DY.teamOvr(t); return typeof v === 'number' ? v : v.ovr; }, ts = gOf().teams.filter(t => t.fbs && t.roster && t.roster.length), avg = ts.reduce((a, t) => a + o(t), 0) / ts.length; return Math.max(0.1, Math.min(0.92, 0.5 + (o(ut()) - avg) * 0.045)); },
    role: p => {
      const t = ut(), d = t.depth[p.pos] || [], i = d.indexOf(p.id), s = DY.STARTERS[p.pos] || 1, gp = (p.s && p.s.gp) || 0, inj = p.inj && p.inj.wks > 0;
      const start = i >= 0 && i < s, rot = i >= 0 && i < s + 2;
      const usage = SKILL.includes(p.pos) ? 1 + t.roster.map(DY.P).filter(q => SKILL.includes(q.pos) && q.ovr > p.ovr).length : 9;
      return { start, rot, share: gp === 0 && !start ? (rot ? 0.12 : 0.02) : (start ? 0.7 : rot ? 0.3 : 0.05), usage, gp: gp || (start ? 1 : 0) };
    },
    raise: (p, amt) => { const t = ut(); if (DY.payroll(t) - (p.nil || 0) + amt > t.budget * 1.02) return 'That raise is over your NIL budget.'; p.nil = amt; return null; },
    news: (k, h, b) => DY.news(k, h, b),
  });
  // honor promises on the depth chart: a promised starter is moved into a starting spot, a promised rotation player into the two-deep
  DY.moralePush = t => {
    const g = gOf(); if (!t.user || !M || !M.on(g)) return;
    t.roster.map(DY.P).filter(p => p.pr && p.pr.st === 'open' && (p.pr.type === 'start' || p.pr.type === 'focal' || p.pr.type === 'rot')).forEach(p => {
      const d = t.depth[p.pos]; if (!d) return; const i = d.indexOf(p.id), want = p.pr.type === 'rot' ? (DY.STARTERS[p.pos] || 1) : (DY.STARTERS[p.pos] || 1) - 1;
      if (i > want) { d.splice(i, 1); d.splice(want, 0, p.id); }
    });
  };
  DY.moraleTick = () => { const g = gOf(); if (!M || !M.on(g)) return; const t = ut(); if (t.w + t.l > 0 && (t.w + t.l) % 3 === 0 && g.mor_last !== t.w + t.l) { g.mor_last = t.w + t.l; M.tick(DY.moraleAdapter()); } };
  DY.moraleSeasonEnd = () => { const g = gOf(); return M && M.on(g) ? M.seasonEnd(DY.moraleAdapter()) : null; };
})();
