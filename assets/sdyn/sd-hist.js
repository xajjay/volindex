/* The Vol Index — Hoops Dynasty: historical start. Real rosters and production for any season from 2010-11 on (Sports-Reference per-game
   lines, class, height, hometown and RSCI rank), turned into ratings. Data files live in data/hist/bb-<year>.js (year = the spring the season ends). */
(function (root) {
  'use strict';
  const SD = root.SD, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CLS = { FR: 1, SO: 2, JR: 3, SR: 4, GR: 4 };
  root.BB_HIST = root.BB_HIST || {};
  SD.HIST_FIRST = 2009; SD.HIST_LAST = 2025;       // season start years (2009 = 2009-10)
  SD.HIST_ENABLED = true;        // data/hist/bb-2010..2026.js ship (top ~70 teams per year)
  SD.histAvailable = sport => SD.HIST_ENABLED && sport === 'mbb';
  // loads the starting season plus up to three earlier ones (a player's prior seasons and honors come from them)
  SD.loadHist = (startYear, cb) => {
    const y = startYear + 1, want = [y]; for (let k = 1; k <= 3; k++) if (y - k >= 2010) want.push(y - k);
    let left = 0, ok = true;
    const done = () => { if (--left <= 0) cb(ok && !!root.BB_HIST[y]); };
    if (!root.BB_CLASS) { left++; const c = document.createElement('script'); c.src = 'data/hist/bb-classes.js'; c.onload = done; c.onerror = done; document.head.appendChild(c); }
    want.forEach(w => { if (root.BB_HIST[w]) return; left++; const s = document.createElement('script'); s.src = 'data/hist/bb-' + w + '.js'; s.onload = done; s.onerror = () => { if (w === y) ok = false; done(); }; document.head.appendChild(s); });
    if (!left) cb(true);
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
    // the team he played for: a star on a 28-win power plays against better opposition than one on a mid-major
    const HT = root.BB_HIST[year] && root.BB_HIST[year].teams && root.BB_HIST[year].teams[team.name], srs = HT ? HT.srs : 8;
    if ((mp || 0) >= 10) ovr += clamp((srs - 8) * 0.36 - (srs < 12 ? 1.2 : 0), -4, 6);
    // recruiting pedigree (RSCI): the elite prospects are further along than a line of production shows, most of all as freshmen and sophomores
    if (rk) { const fl = rk <= 5 ? 88 : rk <= 10 ? 86 : rk <= 20 ? 83 : rk <= 30 ? 81 : rk <= 60 ? 78 : rk <= 100 ? 75 : 72; const fl2 = fl - ((mp || 0) < 8 ? 10 : (mp || 0) < 16 ? 5 : 0); ovr = yr <= 2 ? Math.max(ovr, fl2) : yr === 3 ? Math.max(ovr, fl2 - 3) : Math.max(ovr, fl2 - 5); }
    if ((mp || 0) < 6 && !rk) ovr = Math.min(ovr, 64);
    ovr = Math.round(clamp(ovr, 52, 95));
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
    const ids = T.pl.filter(r => r[0]).sort((a, b) => prod(b) - prod(a)).slice(0, 15).map(r => SD.histPlayer(r, team, g.season + 1).id);
    // a full 15: the data lists only players who logged minutes, so depth is filled with reserves in line with the program
    const POS = ['PG', 'SG', 'SF', 'PF', 'C'], mu = 36 + team.prestige * 0.42;
    for (let k = 0; ids.length < 15; k++) { const yr = 1 + Math.floor(Math.random() * 4), ovr = Math.round(clamp(mu - 6 + (yr - 2.5) * 1.5 + (Math.random() - 0.5) * 8, 50, 74)), c = clamp(0.74 + (ovr - 55) * 0.004, 0.7, 0.9);
      ids.push(SD.makePlayer(POS[k % 5], ovr, { t: team.id, yr, el: 6 - yr, rec: { c, stars: SD.starsOf(c), g: c * 100 } }).id); }
    return ids;
  };

  // earlier seasons for the real players: per-game lines from the prior years' data and honors the stats earned (conference and national player of the year,
  // all-conference, all-America, SEC freshman of the year). Called once after the starting rosters exist.
  SD.histPast = g => {
    const Y = g.season + 1; if (!root.BB_HIST[Y]) return;
    // team strength follows the real season (SRS): a 25-SRS power is a title contender, a 5-SRS mid-major is not, whatever its leading scorer's line says
    { const D0 = root.BB_HIST[Y].teams; g.teams.forEach(t => { const T = D0[t.name]; if (!T || typeof T.srs !== 'number') return;
        const want = clamp(0.4 * SD.teamRating(t) + 0.6 * (71 + T.srs * 0.65), 62, 90); SD.setTeamTo(t, Math.round(want)); }); }
    const byName = {}; g.teams.forEach(t => t.roster.forEach(id => { const p = SD.P(id); if (p && p.real) (byName[p.n] = byName[p.n] || []).push(p); }));
    for (let y = Y - 1; y >= Math.max(2010, Y - 3); y--) {
      const D = root.BB_HIST[y]; if (!D || !D.teams) continue;
      const all = [];
      for (const tn in D.teams) {
        const T = D.teams[tn], tm = g.teams.find(t => t.name === tn); if (!tm) continue;
        T.pl.forEach(r => { if (!r[0] || !(r[7] > 0)) return; all.push({ r, tm, conf: T.conf, sc: prod(r) * Math.min(1, r[7] / 24) + (T.srs || 0) * 0.15 }); });
      }
      all.sort((a, b) => b.sc - a.sc);
      const give = (rec, k) => { const ps = byName[rec.r[0]]; if (!ps) return; ps.forEach(p => { p.aw = p.aw || []; if (!p.aw.some(x => x.y === y - 1 && x.a === k)) p.aw.push({ y: y - 1, a: k }); }); };
      all.slice(0, 1).forEach(x => give(x, 'POY'));
      const per = {}; all.filter(x => (per[x.tm.name] = (per[x.tm.name] || 0) + 1) <= 2).slice(0, 5).forEach(x => give(x, 'AA1'));
      const sec = all.filter(x => /^SEC/.test(x.conf || '')); if (sec[0]) give(sec[0], 'SECPOY');
      sec.slice(0, 5).forEach(x => give(x, 'SEC1')); sec.slice(5, 10).forEach(x => give(x, 'SEC2'));
      const fr = sec.filter(x => x.r[1] === 'FR'); if (fr[0]) give(fr[0], 'SECFR');
      all.forEach(x => { const ps = byName[x.r[0]]; if (!ps) return; const [, , , , , , , gm, mp, pts, trb, ast, stl, blk] = x.r;
        ps.forEach(p => { if (p.car[y - 1]) return; p.car[y - 1] = { t: x.tm.abbr, real: true, gp: gm, pts: Math.round(pts * gm), reb: Math.round(trb * gm), ast: Math.round(ast * gm), stl: Math.round(stl * gm), blk: Math.round(blk * gm), min: Math.round(mp * gm) }; }); });
    }
  };

  // the real recruiting class of a year (data/hist/bb-classes.js: who signed where, high-school rank, how the college career went). The top of the
  // generated pool is replaced by the real players, ordered by a blend of recruiting rank and career production, so the board looks like that year's.
  SD.histClass = (year, pool) => {
    const g = SD.G, L = root.BB_CLASS && root.BB_CLASS[year]; if (!L || !g || !g.hx) return;
    const list = L.map(r => ({ r, hs: r[6] || null, pk: r[7] }));
    const byPk = list.slice().sort((a, b) => b.pk - a.pk); byPk.forEach((x, i) => { x.cr = i + 1; });
    let ur = 60; list.forEach(x => { x.hr = x.hs || (ur += 1.4); x.k = 0.55 * x.hr + 0.45 * x.cr * (list.length > 100 ? 0.75 : 0.9); });
    list.sort((a, b) => a.k - b.k);
    const gen = Object.values(pool).sort((a, b) => a.rec.natl - b.rec.natl);
    list.forEach((x, i) => {
      const p = gen[i]; if (!p) return; const [name, pos0, hts, wt, home, school] = x.r, ht = htIn(hts) || 77;
      let pos = String(pos0 || 'G').toUpperCase();
      pos = pos.startsWith('C') ? 'C' : pos.startsWith('F') ? (ht >= 81 ? 'C' : ht >= 79 ? 'PF' : 'SF') : pos === 'G/F' ? 'SF' : (ht <= 74 ? 'PG' : 'SG');
      p.n = name; p.pos = pos; p.home = home || p.home; p.ht = ht; if (wt) p.wt = +wt; p.realName = true;
      const sch = g.teams.find(t => t.name === school);
      if (sch) { p.realSchool = sch.id; p.interest[sch.id] = Math.max(p.interest[sch.id] || 0, 45);
        if (school === 'Tennessee' && g.user === sch.id) { p.commit = sch.id; p.firm = true; p.real = true; p.offer = true; p.interest[sch.id] = 200; } }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
