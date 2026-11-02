/* The Vol Index — Hoops Dynasty: historical start. Real rosters and production for any season from 2010-11 on (Sports-Reference per-game
   lines, class, height, hometown and RSCI rank), turned into ratings. Data files live in data/hist/bb-<year>.js (year = the spring the season ends). */
(function (root) {
  'use strict';
  const SD = root.SD, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CLS = { FR: 1, SO: 2, JR: 3, SR: 4, GR: 4 };
  root.BB_HIST = root.BB_HIST || {};
  SD.HIST_FIRST = 2010; SD.HIST_LAST = 2026;       // season start years (2010 = 2010-11)
  SD.HIST_ENABLED = false;       // flipped on when data/hist/bb-*.js ship
  SD.histAvailable = sport => SD.HIST_ENABLED && sport === 'mbb';
  SD.loadHist = (startYear, cb) => {
    const y = startYear + 1; if (root.BB_HIST[y]) return cb(true);
    const s = document.createElement('script'); s.src = 'data/hist/bb-' + y + '.js'; s.onload = () => cb(!!root.BB_HIST[y]); s.onerror = () => cb(false); document.head.appendChild(s);
  };
  const htIn = s => { const m = /(\d+)-(\d+)/.exec(s || ''); return m ? +m[1] * 12 + +m[2] : 0; };
  const prod = r => { const [, , , , , , , g, mp, pts, trb, ast, stl, blk, , , , , tov] = r; const m = Math.min(1, (mp || 0) / 26); return ((pts || 0) + 0.7 * (trb || 0) + 1.2 * (ast || 0) + 1.5 * (stl || 0) + 1.3 * (blk || 0) - (tov || 0)) * (0.55 + 0.45 * m) + (g >= 8 ? 0 : -3); };
  SD.histPlayer = (r, team, year) => {
    const [name, cls, pos0, hts, wt, home, rsci, g, mp, pts, trb, ast, stl, blk, fgp, tpp, ftp, tpa, tov, orb] = r, yr = CLS[cls] || 2, ht = htIn(hts) || 77;
    let pos = String(pos0 || 'G').toUpperCase();
    pos = pos.startsWith('C') ? 'C' : pos.startsWith('F') ? (ht >= 81 ? 'C' : ht >= 79 ? 'PF' : 'SF') : pos === 'G/F' ? 'SF' : (ht <= 74 || ast >= 4.2 ? 'PG' : 'SG');
    const sc = prod(r);
    let ovr = 57 + Math.min(34, sc * 1.12) * (sc > 22 ? 0.9 : 1) + (yr - 1) * 0.5;
    const rk = parseInt(rsci, 10);
    if (rk && yr <= 2) ovr = Math.max(ovr, rk <= 10 ? 83 : rk <= 30 ? 79 : rk <= 60 ? 76 : 73);
    if ((mp || 0) < 6 && !rk) ovr = Math.min(ovr, 64);
    ovr = Math.round(clamp(ovr, 52, 94));
    const comp = rk ? clamp(0.999 - rk * 0.0006, 0.93, 0.999) : clamp(0.82 + (ovr - 60) * 0.004, 0.76, 0.93);
    const p = SD.makePlayer(pos, ovr, { n: name, t: team.id, yr, el: Math.max(1, 6 - yr), home: home || '', ht, rec: { c: comp, stars: SD.starsOf(comp), g: comp * 100, natl: rk || null, cls: year - yr } });
    p.real = true; p.note = `${(pts || 0).toFixed(1)} pts, ${(trb || 0).toFixed(1)} reb, ${(ast || 0).toFixed(1)} ast in ${year - 1}-${String(year).slice(2)}`;
    if (wt) p.wt = +wt;
    if ((tpa || 0) >= 1.2 && tpp) p.at.thr = Math.round(clamp(55 + (tpp - 0.30) * 300, 50, 97));
    if (ftp) p.at.ft = Math.round(clamp(50 + (ftp - 0.6) * 140, 50, 97));
    if (ast) p.at.pas = Math.round(clamp(p.at.pas + (ast - 2) * 3, 50, 97));
    if (trb) p.at.reb = Math.round(clamp(p.at.reb + (trb - 4.5) * 2.5, 50, 97));
    if (blk) p.at.blk = Math.round(clamp(p.at.blk + (blk - 0.6) * 6, 50, 97));
    if (stl) p.at.stl = Math.round(clamp(p.at.stl + (stl - 0.9) * 6, 50, 97));
    SD.setOvr(p); if (Math.abs(p.ovr - ovr) > 2) { const d = ovr - p.ovr, w = SD.W[p.pos]; for (const k in w) p.at[k] = Math.round(clamp(p.at[k] + d, 50, 99)); SD.setOvr(p); }
    SD.setCeil && SD.setCeil(p, ovr + (yr <= 2 ? 6 : 2));
    if (g) p.car[year - 1] = { t: team.abbr, real: true, gp: g, pts: Math.round(pts * g), reb: Math.round(trb * g), ast: Math.round(ast * g), stl: Math.round(stl * g), blk: Math.round(blk * g), min: Math.round(mp * g) };
    return p;
  };
  // the roster for one team at the start of a historical dynasty (null when the data has no such team)
  SD.histRoster = (team, g) => {
    const D = root.BB_HIST[g.season + 1], T = D && D.teams && D.teams[team.name]; if (!T) return null;
    team.prestige = clamp(Math.round(44 + T.srs * 1.55), 38, 97); team.realRec = T.w + '-' + T.l; team.coachReal = T.coach || '';
    return T.pl.filter(r => r[0]).sort((a, b) => prod(b) - prod(a)).slice(0, 15).map(r => SD.histPlayer(r, team, g.season + 1).id);
  };
})(typeof window !== 'undefined' ? window : globalThis);
