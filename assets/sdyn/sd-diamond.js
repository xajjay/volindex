/* The Vol Index — Diamond Dynasty: the baseball and softball game engine. Plate appearance by plate appearance:
   the count and the pitch count, strikeouts and walks, balls in play (grounders, liners, flies, home runs) with spray
   angles for the field view, base running, steals, bunts, double plays, sacrifice flies, errors, fatigue and the
   bullpen (starters, relievers, the closer; a softball ace can go the distance), the run rule and softball's
   international tiebreaker. */
(function (root) {
  'use strict';
  const SD = root.SD;
  const { clamp, chance, rr, pick, gauss } = SD;
  const B = SD.B = {};
  const other = s => s === 'h' ? 'a' : 'h';
  const last = p => SD.H ? SD.H.last(p) : p.n;

  B.newGame = (th, ta, o) => {
    o = o || {}; const sp = SD.SP(), soft = G().sport === 'softball';
    const GM = { kind: 'diamond', diff: o.diff || 0, uid: o.uid, soft, T: { h: th, a: ta }, score: { h: 0, a: 0 }, inn: 1, top: true, outs: 0, bases: [null, null, null], ps: {}, plays: [], lineScore: { h: [], a: [] },
      maxInn: sp.innings, mercy: o.noMercy ? null : sp.mercy, user: o.user || null, over: false, neutral: !!o.neutral, live: !!o.live, title: o.title || null, L: {}, hits: { h: 0, a: 0 }, err: { h: 0, a: 0 }, lob: { h: 0, a: 0 }, gameNo: o.gameNo || 0, starter: o.starter || {} };
    for (const s of ['h', 'a']) {
      const D = SD.diamondLineup(GM.T[s]);
      const sp0 = (GM.starter[s] ? SD.P(GM.starter[s]) : D.rotation[(o.gameNo || 0) % Math.max(1, Math.min(soft ? 2 : 4, D.rotation.length))] || D.rotation[0]) || D.pen[0] || D.order[D.order.length - 1];
      GM.L[s] = { order: D.order.map(p => p.id), idx: 0, field: Object.fromEntries(Object.entries(D.field).filter(([, p]) => p).map(([k, p]) => [k, p.id])), pit: sp0.id, used: [sp0.id], pen: D.pen.map(p => p.id).filter(id => id !== sp0.id), closer: D.closer && D.closer.id !== sp0.id ? D.closer.id : null, bench: D.bench.map(p => p.id), pc: {}, runsBy: {}, innP: 0 };
      GM.lineScore[s] = [];
      line(GM, sp0).gs = 1;
    }
    GM.lineScore.a.push(0);
    return GM;
  };
  const G = () => SD.G;
  const line = (GM, p) => { let l = GM.ps[p.id]; if (!l) l = GM.ps[p.id] = { t: p.t, pa: 0, ab: 0, h: 0, d2: 0, d3: 0, hr: 0, r: 0, rbi: 0, bb: 0, so: 0, sb: 0, cs: 0, hbp: 0, ipo: 0, ha: 0, ra: 0, er: 0, bbp: 0, k: 0, hra: 0, pc: 0, bf: 0, gs: 0 }; return l; };
  const add = (GM, p, k, v) => { if (p) line(GM, p)[k] += v == null ? 1 : v; };
  B.line = line;
  const bat = GM => GM.top ? 'a' : 'h';
  const fld = GM => GM.top ? 'h' : 'a';
  B.batting = bat;
  B.batter = GM => { const s = bat(GM), L = GM.L[s]; return SD.P(L.order[L.idx % L.order.length]); };
  B.pitcher = GM => SD.P(GM.L[fld(GM)].pit);
  // how tired the pitcher is: pitch count against his limit
  const limitOf = (GM, p) => GM.soft ? (p.pos === 'SP' ? 125 + (p.at.sta - 70) * 1.4 : 55) : (p.pos === 'SP' ? 92 + (p.at.sta - 70) * 0.9 : 38 + (p.at.sta - 70) * 0.4);
  const fat = (GM, p) => { const pc = GM.L[fld(GM)].pc[p.id] || 0, lim = limitOf(GM, p); return clamp((pc - lim * 0.78) / (lim * 0.45), 0, 1); };
  B.fatigue = (GM) => fat(GM, B.pitcher(GM));

  /* ---------- the manager ---------- */
  function aiPitching(GM, force) {
    const s = fld(GM), L = GM.L[s], p = SD.P(L.pit), pc = L.pc[p.id] || 0, lim = limitOf(GM, p);
    const lead = GM.score[s] - GM.score[other(s)], lastInn = GM.inn >= GM.maxInn;
    const runs = L.runsBy[p.id] || 0;
    let pull = false;
    if (pc >= lim * (0.95 + (GM.soft ? 0.05 : 0)) ) pull = true;
    if (runs >= (GM.soft ? 5 : 6) && pc > 40) pull = true;
    if (L.innP >= 3 && GM.outs === 0 && !GM.bases.some(Boolean)) pull = pull || (pc > lim * 0.8);
    // the closer for the save
    if (lastInn && GM.outs === 0 && lead > 0 && lead <= 3 && L.closer && L.pit !== L.closer && !L.used.includes(L.closer) && !GM.soft) pull = true;
    if (!pull && !force) return null;
    let next = null;
    if (lastInn && lead > 0 && lead <= 3 && L.closer && !L.used.includes(L.closer)) next = SD.P(L.closer);
    if (!next) { const avail = L.pen.filter(id => !L.used.includes(id)).map(SD.P).filter(q => !(q.rest > 0)); next = avail.sort((a, b) => b.ovr - a.ovr)[lead > 3 || lead < -3 ? Math.min(avail.length - 1, 2) : 0] || null; }
    if (!next) return null;
    return changePitcher(GM, s, next);
  }
  function changePitcher(GM, s, next) {
    const L = GM.L[s], old = SD.P(L.pit);
    L.pit = next.id; L.used.push(next.id); L.innP = 0;
    return { kind: 'sub', s, text: `Pitching change: ${next.n} replaces ${old.n} (${L.pc[old.id] || 0} pitches).`, time: 0 };
  }
  B.changePitcher = changePitcher;

  /* ---------- one plate appearance ---------- */
  B.step = (GM, uc) => {
    uc = uc || {};
    if (GM.over) return null;
    const s = bat(GM), d = fld(GM), L = GM.L[s], F = GM.L[d];
    // user moves before the pitch
    if (uc.pitcher && GM.user === d) { const np = SD.P(uc.pitcher); if (np && !F.used.includes(np.id)) return push(GM, changePitcher(GM, d, np)); }
    if (uc.pinch && GM.user === s) { const ph = SD.P(uc.pinch), cur = B.batter(GM); if (ph && L.bench.includes(ph.id)) { L.order[L.idx % L.order.length] = ph.id; L.bench = L.bench.filter(x => x !== ph.id); for (const k in L.field) if (L.field[k] === cur.id) L.field[k] = ph.id; return push(GM, { kind: 'sub', s, text: `Pinch hitter: ${ph.n} for ${cur.n}.`, time: 0 }); } }
    if (GM.user !== d || uc.autoPitch) { const ch = aiPitching(GM); if (ch) return push(GM, ch); }
    const b = B.batter(GM), p = B.pitcher(GM), f = fat(GM, p);
    const diff = GM.score[s] - GM.score[d], late = GM.inn >= GM.maxInn - 2;
    // the call: user's, or the manager's
    let call = GM.user === s && uc.call && uc.call !== 'auto' ? uc.call : aiCall(GM, b, s, d, diff, late);
    if (GM.user === d && uc.call === 'ibb') call = 'ibb';
    else if (GM.user !== d && aiIbb(GM, b, diff, late)) call = 'ibb';
    const r = { s, kind: 'pa', bat: b, pit: p, text: '', time: 30, pts: 0, adv: [], call };
    line(GM, b); add(GM, p, 'bf');
    if (call === 'ibb') { add(GM, b, 'pa'); add(GM, b, 'bb'); add(GM, p, 'bbp'); pitches(GM, p, 4); r.result = 'ibb'; r.text = `${b.n} is intentionally walked.`; walk(GM, r, b); return finishPa(GM, r); }
    // steals (before the pitch result)
    if (call === 'steal') {
      const i = GM.bases[1] && !GM.bases[2] ? 1 : GM.bases[0] && !GM.bases[1] ? 0 : -1;
      if (i >= 0) {
        const run = SD.P(GM.bases[i]), cat = SD.P(F.field.C) || p;
        const ok = chance(clamp(0.7 + (run.at.spd - (cat.at.arm || 65)) / 120 - (i === 1 ? 0.08 : 0) - (GM.soft ? 0.02 : 0), 0.35, 0.95));
        pitches(GM, p, 1);
        if (ok) { GM.bases[i + 1] = GM.bases[i]; GM.bases[i] = null; add(GM, run, 'sb'); r.kind = 'sb'; r.text = `${run.n} steals ${i === 0 ? 'second' : 'third'}.`; r.adv.push([i + 1, i + 2, run.id]); r.time = 20; return push(GM, r); }
        GM.bases[i] = null; add(GM, run, 'cs'); GM.outs++; r.kind = 'cs'; r.text = `${run.n} is caught stealing ${i === 0 ? 'second' : 'third'} (${last(cat)} with the throw).`; r.adv.push([i + 1, -1, run.id]); r.time = 20; push(GM, r); return endHalfIf(GM, r);
      }
      call = 'swing';
    }
    add(GM, b, 'pa');
    // a sacrifice bunt
    if (call === 'bunt' && GM.outs < 2 && (GM.bases[0] || GM.bases[1])) {
      pitches(GM, p, rr(1, 3) | 0);
      const good = chance(0.72 + (b.at.con - 70) / 300);
      if (good) { add(GM, b, 'ab', 0); r.result = 'sac'; r.bip = { type: 'gb', ang: rr(-20, 20), dist: 18 }; GM.outs++; advanceAll(GM, r, 1, true); r.text = `${b.n} lays down the sacrifice bunt.`; if (chance(0.08 + b.at.spd / 1500)) { GM.outs--; GM.bases[0] = b.id; r.text = `${b.n} bunts for a hit!`; add(GM, b, 'ab'); add(GM, b, 'h'); r.result = '1b'; } }
      else { add(GM, b, 'ab'); r.result = 'out'; r.bip = { type: 'pu', ang: rr(-25, 25), dist: 25 }; GM.outs++; r.text = `${b.n} pops up the bunt. One out.`; }
      L.idx++; return finishPa(GM, r);
    }
    // the count: strikeout, walk, hit by pitch or the ball in play
    const pd = GM.diff && p.t !== GM.uid ? GM.diff : 0, bd = GM.diff && b.t !== GM.uid ? GM.diff : 0;
    const st = (p.at.stf + pd) * (1 - f * 0.22), ct = (p.at.ctl + pd) * (1 - f * 0.3), ve = p.at.vel * (1 - f * 0.08);
    const pat = GM.user === s && uc.approach === 'patient' ? 1 : GM.user === s && uc.approach === 'aggressive' ? -1 : 0;
    const kP = clamp((GM.soft ? 0.165 : 0.205) + (st - (b.at.con + bd)) / 240 + (ve - 72) / 520 + pat * 0.02 - ((b.at.eye + bd) - 70) / 900, 0.05, 0.45);
    const bbP = clamp((GM.soft ? 0.095 : 0.1) + ((b.at.eye + bd) - ct) / 330 + f * 0.04 + pat * 0.025, 0.02, 0.24);
    const hbpP = GM.soft ? 0.012 : 0.017;
    const u = SD.rnd();
    if (u < kP) { add(GM, b, 'ab'); add(GM, b, 'so'); add(GM, p, 'k'); pitches(GM, p, rr(4, 6.5) | 0); GM.outs++; r.result = 'k'; r.text = `${b.n} strikes out${chance(0.35) ? ' looking' : ' swinging'}.`; L.idx++; return finishPa(GM, r); }
    if (u < kP + bbP) { add(GM, b, 'bb'); add(GM, p, 'bbp'); pitches(GM, p, rr(5, 7) | 0); r.result = 'bb'; r.text = `${b.n} walks.`; walk(GM, r, b); L.idx++; return finishPa(GM, r); }
    if (u < kP + bbP + hbpP) { add(GM, b, 'hbp'); pitches(GM, p, rr(1, 5) | 0); r.result = 'hbp'; r.text = `${b.n} is hit by a pitch.`; walk(GM, r, b); L.idx++; return finishPa(GM, r); }
    pitches(GM, p, rr(2, 5) | 0);
    // the ball in play
    add(GM, b, 'ab');
    const def = avgFld(GM, d);
    const hrP = clamp((GM.soft ? 0.05 : 0.048) + ((b.at.pow + bd) - 70) / 420 - (st - 70) / 1100 + f * 0.02 + (pat < 0 ? 0.006 : 0), 0.004, 0.2);
    const babip = clamp((GM.soft ? 0.33 : 0.33) + ((b.at.con + bd) - st) / 520 + (b.at.spd - 70) / 1700 - (def - 70) / 900 + f * 0.03 + (call === 'hr' ? 0.02 : 0), 0.16, 0.48);
    const ang = clamp(gauss() * 22 + (b.bt && b.bt[0] === 'L' ? 10 : -10), -44, 44);
    if (chance(hrP)) {
      add(GM, b, 'h'); add(GM, b, 'hr'); add(GM, p, 'ha'); add(GM, p, 'hra');
      r.result = 'hr'; r.bip = { type: 'hr', ang, dist: GM.soft ? rr(205, 240) : rr(345, 430) };
      const n = 1 + GM.bases.filter(Boolean).length;
      r.text = n === 4 ? `GRAND SLAM! ${b.n} clears the bases.` : `${b.n} homers${n > 1 ? ` (${n} runs)` : ''}!`; r.big = true;
      GM.bases.forEach((id, i) => { if (id) { score(GM, r, SD.P(id), b); r.adv.push([i + 1, 4, id]); } });
      GM.bases = [null, null, null]; score(GM, r, b, b); r.adv.push([0, 4, b.id]);
      L.idx++; return finishPa(GM, r);
    }
    const hit = chance(babip);
    const fb = pick(['gb', 'gb', 'ld', 'fb', 'fb', 'pu']);
    if (hit) {
      add(GM, b, 'h'); add(GM, p, 'ha');
      const x2 = clamp(0.21 + (b.at.pow - 70) / 300, 0.08, 0.4), x3 = clamp(0.02 + (b.at.spd - 75) / 800, 0.005, 0.07);
      const v = SD.rnd();
      if (v < x3) { add(GM, b, 'd3'); r.result = '3b'; r.bip = { type: 'ld', ang: ang > 0 ? rr(25, 44) : rr(-44, -25), dist: GM.soft ? rr(170, 200) : rr(320, 380) }; r.text = `${b.n} triples into the gap!`; advanceAll(GM, r, 3, false); GM.bases[2] = b.id; r.adv.push([0, 3, b.id]); r.big = true; }
      else if (v < x3 + x2) { add(GM, b, 'd2'); r.result = '2b'; r.bip = { type: 'ld', ang, dist: GM.soft ? rr(150, 190) : rr(260, 340) }; r.text = `${b.n} doubles${Math.abs(ang) > 30 ? ' down the line' : ' into the gap'}.`; advanceAll(GM, r, 2, false, b); GM.bases[1] = b.id; r.adv.push([0, 2, b.id]); }
      else { r.result = '1b'; r.bip = { type: fb === 'gb' ? 'gb' : 'ld', ang, dist: fb === 'gb' ? rr(90, 140) : GM.soft ? rr(110, 150) : rr(170, 230) }; r.text = `${b.n} singles${fb === 'gb' ? ' through the infield' : ' to ' + (ang < -15 ? 'left' : ang > 15 ? 'right' : 'center')}.`; advanceAll(GM, r, 1, false, b); GM.bases[0] = b.id; r.adv.push([0, 1, b.id]); }
      L.idx++; return finishPa(GM, r);
    }
    // an out (or an error)
    if (chance(0.025 + (75 - def) / 1200)) { GM.err[d]++; r.result = 'e'; r.bip = { type: 'gb', ang, dist: 95 }; r.text = `${b.n} reaches on an error.`; advanceAll(GM, r, 1, true); GM.bases[0] = b.id; r.adv.push([0, 1, b.id]); L.idx++; return finishPa(GM, r); }
    r.result = 'out'; r.bip = { type: fb, ang, dist: fb === 'gb' ? rr(60, 110) : fb === 'pu' ? rr(30, 80) : fb === 'ld' ? rr(120, 220) : GM.soft ? rr(140, 200) : rr(230, 340) };
    const fielder = fielderFor(r.bip);
    // double play
    if (fb === 'gb' && GM.bases[0] && GM.outs < 2 && call !== 'hr' && chance(0.42 - (b.at.spd - 70) / 250)) {
      const r1 = GM.bases[0]; GM.bases[0] = null; GM.outs += 2; r.result = 'dp'; r.text = `${b.n} grounds into a double play.`; r.adv.push([1, -1, r1]);
      if (GM.outs < 3) { advanceForce(GM, r); }
      L.idx++; return finishPa(GM, r);
    }
    GM.outs++;
    // sacrifice fly
    if ((fb === 'fb' || fb === 'ld') && GM.bases[2] && GM.outs < 3 && r.bip.dist > (GM.soft ? 150 : 250) && chance(0.85)) { const run = SD.P(GM.bases[2]); GM.bases[2] = null; score(GM, r, run, b); r.adv.push([3, 4, run.id]); add(GM, b, 'ab', -1); r.result = 'sf'; r.text = `${b.n} hits a sacrifice fly to ${fielder}. ${last(run)} scores.`; L.idx++; return finishPa(GM, r); }
    // productive outs: runners move up on grounders to the right side
    if (fb === 'gb' && GM.outs < 3 && (call === 'hr' || chance(0.45))) { if (GM.bases[2] && GM.outs < 3 && chance(0.4)) { const run = SD.P(GM.bases[2]); GM.bases[2] = null; score(GM, r, run, b); r.adv.push([3, 4, run.id]); } if (GM.bases[1] && !GM.bases[2]) { GM.bases[2] = GM.bases[1]; GM.bases[1] = null; r.adv.push([2, 3, GM.bases[2]]); } if (GM.bases[0] && !GM.bases[1]) { GM.bases[1] = GM.bases[0]; GM.bases[0] = null; r.adv.push([1, 2, GM.bases[1]]); } }
    r.text = `${b.n} ${({ gb: 'grounds out to', fb: 'flies out to', ld: 'lines out to', pu: 'pops up to' })[fb]} ${fielder}.`;
    L.idx++; return finishPa(GM, r);
  };
  function fielderFor(bip) { const a = bip.ang; if (bip.type === 'gb' || bip.type === 'pu' && bip.dist < 60) return a < -25 ? 'third' : a < -5 ? 'short' : a < 15 ? 'second' : 'first'; return a < -15 ? 'left' : a > 15 ? 'right' : 'center'; }
  function avgFld(GM, s) { const ids = Object.values(GM.L[s].field); const ps = ids.map(SD.P).filter(Boolean); return ps.length ? ps.reduce((t, p) => t + p.at.fld, 0) / ps.length : 70; }
  function pitches(GM, p, n) { const s = fld(GM); GM.L[s].pc[p.id] = (GM.L[s].pc[p.id] || 0) + n; add(GM, p, 'pc', n); }
  function walk(GM, r, b) {
    // forced runners only
    if (GM.bases[0]) { if (GM.bases[1]) { if (GM.bases[2]) { const run = SD.P(GM.bases[2]); score(GM, r, run, b); r.adv.push([3, 4, run.id]); } GM.bases[2] = GM.bases[1]; r.adv.push([2, 3, GM.bases[1]]); } GM.bases[1] = GM.bases[0]; r.adv.push([1, 2, GM.bases[0]]); }
    GM.bases[0] = b.id; r.adv.push([0, 1, b.id]);
  }
  // runners move up n bases (plus a little extra for speed on hits)
  function advanceAll(GM, r, n, forceOnly, batter) {
    const nb = [null, null, null];
    for (let i = 2; i >= 0; i--) {
      const id = GM.bases[i]; if (!id) continue; const run = SD.P(id);
      let to = i + n;
      if (!forceOnly && n < 3) { if (n === 1 && i === 1 && chance(0.6 + (run.at.spd - 70) / 120)) to = 3; if (n === 1 && i === 0 && chance(0.26 + (run.at.spd - 70) / 140) && !nb[2]) to = 2; if (n === 2 && i === 0 && chance(0.42 + (run.at.spd - 70) / 120)) to = 3; }
      if (forceOnly && n === 1) { to = (i === 0 || (i === 1 && GM.bases[0]) || (i === 2 && GM.bases[1] && GM.bases[0])) ? i + 1 : i; }
      if (to >= 3) { score(GM, r, run, batter && !forceOnly ? batter : (r.result === 'sac' ? r.bat : null)); r.adv.push([i + 1, 4, id]); }
      else { nb[to] = id; if (to !== i) r.adv.push([i + 1, to + 1, id]); }
    }
    GM.bases = nb;
  }
  function advanceForce(GM, r) { if (GM.bases[1] && !GM.bases[2]) { GM.bases[2] = GM.bases[1]; GM.bases[1] = null; r.adv.push([2, 3, GM.bases[2]]); } }
  function score(GM, r, run, bat) {
    const s = r.s; GM.score[s]++; r.pts++; add(GM, run, 'r'); if (bat && r.result !== 'dp' && r.result !== 'e') add(GM, bat, 'rbi');
    const p = r.pit || B.pitcher(GM); add(GM, p, 'ra'); add(GM, p, 'er', r.result === 'e' ? 0 : 1);
    GM.L[fld(GM)].runsBy[p.id] = (GM.L[fld(GM)].runsBy[p.id] || 0) + 1;
    GM.lineScore[s][GM.lineScore[s].length - 1]++;
  }
  function aiCall(GM, b, s, d, diff, late) {
    const r1 = GM.bases[0] && SD.P(GM.bases[0]), close = Math.abs(diff) <= 2;
    if (r1 && !GM.bases[1] && GM.outs < 2 && r1.at.spd >= 80 && chance(0.18)) return 'steal';
    if (late && close && GM.outs === 0 && (GM.bases[0] || GM.bases[1]) && !GM.bases[2] && b.ovr < 74 && chance(GM.soft ? 0.55 : 0.35)) return 'bunt';
    if (GM.soft && GM.bases[0] && !GM.bases[1] && GM.outs === 0 && b.ovr < 80 && b.at.pow < 78 && chance(0.12)) return 'bunt';
    return 'swing';
  }
  function aiIbb(GM, b, diff, late) { return late && Math.abs(diff) <= 1 && GM.bases[1] && !GM.bases[0] && b.ovr >= 82 && GM.outs < 2 && chance(0.4); }
  function push(GM, r) {
    r.inn = GM.inn; r.top = GM.top; r.outs = GM.outs; r.bases = GM.bases.slice(); r.score = { h: GM.score.h, a: GM.score.a };
    GM.plays.push(r); if (GM.plays.length > 400) GM.plays.shift();
    return r;
  }
  function finishPa(GM, r) {
    const p = r.pit; if (p) { if (r.result === 'k' || r.result === 'out' || r.result === 'sf' || r.result === 'sac') add(GM, p, 'ipo'); if (r.result === 'dp') add(GM, p, 'ipo', 2); if (r.result === 'cs') add(GM, p, 'ipo'); }
    if (r.pts) GM.hits = GM.hits;
    push(GM, r);
    // walk-off
    if (!GM.top && GM.inn >= GM.maxInn && GM.score.h > GM.score.a) { r.walkoff = true; r.big = true; GM.over = true; r.final = true; r.text += ' Walk-off!'; finalize(GM); return r; }
    return endHalfIf(GM, r);
  }
  function endHalfIf(GM, r) {
    if (GM.outs < 3) return r;
    const s = bat(GM);
    GM.lob[s] += GM.bases.filter(Boolean).length;
    GM.outs = 0; GM.bases = [null, null, null];
    GM.L[fld(GM)].innP++;
    // end of the game? (home team ahead after the top of the last inning, or any full inning after it)
    const innDone = !GM.top;
    const lead = GM.score.h - GM.score.a;
    if (GM.top && GM.inn >= GM.maxInn && lead > 0) { GM.over = true; r.final = true; r.endHalf = true; finalize(GM); return r; }
    if (innDone && GM.inn >= GM.maxInn && lead !== 0) { GM.over = true; r.final = true; r.endHalf = true; finalize(GM); return r; }
    // run rule
    if (GM.mercy && innDone && GM.inn >= GM.mercy.after && Math.abs(lead) >= GM.mercy.runs) { GM.over = true; r.final = true; r.mercy = true; r.endHalf = true; finalize(GM); return r; }
    if (GM.mercy && GM.top && GM.inn >= GM.mercy.after && lead >= GM.mercy.runs) { GM.over = true; r.final = true; r.mercy = true; r.endHalf = true; finalize(GM); return r; }
    r.endHalf = true;
    if (GM.top) { GM.top = false; GM.lineScore.h.push(0); }
    else { GM.top = true; GM.inn++; GM.lineScore.a.push(0); }
    // softball's international tiebreaker: a runner on second to start each extra inning
    if (GM.soft && GM.inn > GM.maxInn) { const L = GM.L[bat(GM)]; GM.bases[1] = L.order[(L.idx + L.order.length - 1) % L.order.length]; }
    if (GM.inn > (GM.soft ? 15 : 18)) { GM.over = true; r.final = true; finalize(GM); }
    return r;
  }
  function finalize(GM) {
    // decisions: the winning pitcher is the one in the game when his team took the lead for good (approximately: the starter if he went 5 (4 in softball), else the best reliever)
    const w = GM.score.h > GM.score.a ? 'h' : 'a', l = other(w);
    const Lw = GM.L[w], Ll = GM.L[l];
    const st = SD.P(Lw.used[0]), stOuts = (GM.ps[st.id] || {}).ipo || 0;
    const wp = stOuts >= (GM.soft ? 12 : 15) ? st : SD.P(Lw.used.slice(1).sort((a, b) => ((GM.ps[b] || {}).ipo || 0) - ((GM.ps[a] || {}).ipo || 0))[0] || Lw.used[0]);
    const lp = SD.P(Ll.used.slice().sort((a, b) => ((GM.ps[b] || {}).ra || 0) - ((GM.ps[a] || {}).ra || 0))[0]);
    line(GM, wp).w = 1; line(GM, lp).l = 1;
    const fin = SD.P(Lw.used[Lw.used.length - 1]);
    if (fin !== wp && GM.score[w] - GM.score[l] <= 3 && ((GM.ps[fin.id] || {}).ipo || 0) >= 3) line(GM, fin).sv = 1;
    // pitchers need rest
    ['h', 'a'].forEach(s => GM.L[s].used.forEach(id => { const p = SD.P(id), pc = GM.L[s].pc[id] || 0; p.rest = pc >= 80 ? (GM.soft ? 1 : 5) : pc >= 35 ? 2 : pc >= 15 ? 1 : 0; }));
  }
  B.playFull = GM => { let n = 0; while (!GM.over && n++ < 400) B.step(GM, {}); if (!GM.over) { GM.over = true; finalize(GM); } return GM; };
})(typeof window !== 'undefined' ? window : globalThis);
