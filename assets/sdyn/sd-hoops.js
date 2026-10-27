/* The Vol Index — Hoops Dynasty: the game engine. Possession by possession: who is on the floor (minutes, fatigue, fouls,
   closing lineups, garbage time), the play (pick-and-roll, drive, post-up, spot-up three, isolation, transition), the shot
   and the defense against it, fouls and free throws, rebounds, turnovers and steals, timeouts and late-game fouling.
   When a game is on screen each possession also carries its choreography (ten players and the ball) for the court view. */
(function (root) {
  'use strict';
  const SD = root.SD;
  const { clamp, chance, rr, pick, gauss } = SD;
  const H = SD.H = {};
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const other = s => s === 'h' ? 'a' : 'h';
  const last = p => p ? p.n.split(' ').slice(-1)[0].replace(/^(Jr\.|II|III|IV)$/, '') || p.n : '';
  H.last = p => p ? (p.n.split(' ').filter(w => !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(w)).slice(-1)[0] || p.n) : '';

  H.newGame = (th, ta, o) => {
    o = o || {}; const sp = SD.SP(), women = sp.he === 'she';
    const GM = { kind: 'hoops', T: { h: th, a: ta }, score: { h: 0, a: 0 }, per: 1, nper: sp.periods, perLen: sp.perLen, clock: sp.perLen, shot: sp.shot, poss: chance(0.5) ? 'h' : 'a',
      ps: {}, on: { h: [], a: [] }, en: {}, min: {}, tf: { h: 0, a: 0 }, to: { h: women ? 4 : 4, a: women ? 4 : 4 }, coach: { h: Object.assign({ pace: 'normal', focus: 'bal', def: 'man', depth: 9, star: 1 }, th.coach || {}), a: Object.assign({ pace: 'normal', focus: 'bal', def: 'man', depth: 9, star: 1 }, ta.coach || {}) },
      plays: [], lineScore: { h: [], a: [] }, user: o.user || null, mode: o.mode || 'coach', over: false, neutral: !!o.neutral, live: !!o.live, women, run: { s: null, n: 0 }, trans: null, lastEvent: null, ot: 0, half: 1, mom: 0, title: o.title || null, crowd: o.neutral ? 0.3 : 0.9 };
    GM.diff = o.diff || 0; GM.uid = o.uid;
    for (const s of ['h', 'a']) {
      GM.L = GM.L || {}; GM.L[s] = SD.lineup(GM.T[s]);
      GM.L[s].forEach((p, i) => { GM.en[p.id] = 1; GM.min[p.id] = 0; });
      GM.on[s] = GM.L[s].slice(0, 5).map(p => p.id);
      GM.lineScore[s].push(0);
      GM.T[s].ovrNow = SD.teamOvr(GM.T[s]);
    }
    return GM;
  };
  const line = (GM, p) => { let l = GM.ps[p.id]; if (!l) l = GM.ps[p.id] = { t: p.t, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0, pm: 0, gs: 0 }; return l; };
  const add = (GM, p, k, v) => { if (p) line(GM, p)[k] += v == null ? 1 : v; };
  H.line = line;
  const onP = (GM, s) => GM.on[s].map(SD.P);
  // a rating for this moment: the attribute, fatigue, and a little game-to-game form
  // soften big rating gaps (elite vs. weak): the better side still wins the matchup, just not by 50 every night
  const sq = d => d > 12 ? 12 + (d - 12) * 0.55 : d < -12 ? -12 + (d + 12) * 0.55 : d;
  const R = (GM, p, k) => { const e = GM.en[p.id] == null ? 1 : GM.en[p.id]; const form = GM.form && GM.form[p.id] || 0; return ((p.at[k] || 60) + (GM.diff && p.t !== GM.uid ? GM.diff : 0)) * (0.86 + 0.14 * e) + form; };

  /* ---------- the rotation ---------- */
  // target minutes by spot in the rotation (stars get more), a depth setting (7, 8, 9 or 10 players) and foul trouble
  function targetMin(GM, s, i) {
    const c = GM.coach[s], total = GM.perLen * GM.nper / 60;
    const base = [34, 33, 32, 31, 30, 22, 18, 13, 8, 4, 2][i] || 0;
    const depth = c.depth || 9, cut = i >= depth ? 0.15 : 1;
    const p = GM.L[s][i], star = p && i < 5 && p.ovr >= 85 ? 2 * (c.star || 1) : 0;
    return (base + star) * cut * total / 40;
  }
  function subs(GM, s, force) {
    const L = GM.L[s].filter(p => !(GM.ps[p.id] && GM.ps[p.id].pf >= 5));
    const tot = GM.perLen * GM.nper, el = Math.min(1, ((GM.per - 1) * GM.perLen + (GM.perLen - GM.clock)) / tot);
    const diff = GM.score[s] - GM.score[other(s)], late = GM.per >= GM.nper && GM.clock < 240, garbage = GM.per >= GM.nper && GM.clock < 300 && Math.abs(diff) >= 18;
    const firstHalf = GM.nper === 2 ? GM.per === 1 : GM.per <= 2;
    const score = L.map(p => {
      const i = GM.L[s].indexOf(p), tgt = targetMin(GM, s, i), m = (GM.min[p.id] || 0) / 60, e = GM.en[p.id] == null ? 1 : GM.en[p.id];
      const pf = GM.ps[p.id] ? GM.ps[p.id].pf : 0;
      let d = tgt * Math.max(el, 0.04) - m + (e - 0.7) * 6 + (i < 5 ? 1.5 : 0);
      if (firstHalf && pf >= (GM.nper === 2 ? 2 : (GM.per === 1 ? 2 : 3))) d -= 12;
      if (!firstHalf && pf >= 4 && !late) d -= 6;
      if (late && !garbage) d = p.ovr + (i < 5 ? 6 : 0) + e * 4 - (pf >= 4 ? 3 : 0);
      if (garbage) d = i >= 5 ? 50 + i - (e < 0.5 ? 20 : 0) : -50;
      return { p, d };
    }).sort((a, b) => b.d - a.d);
    // keep a guard and at most three bigs
    const pickd = [], bigs = x => x.filter(q => q.p.pos === 'PF' || q.p.pos === 'C').length;
    for (const x of score) { if (pickd.length >= 5) break; if ((x.p.pos === 'PF' || x.p.pos === 'C') && bigs(pickd) >= 3) continue; pickd.push(x); }
    for (const x of score) { if (pickd.length >= 5) break; if (!pickd.includes(x)) pickd.push(x); }
    if (!pickd.some(x => x.p.pos === 'PG' || x.p.pos === 'SG')) { const g = score.find(x => !pickd.includes(x) && (x.p.pos === 'PG' || x.p.pos === 'SG')); if (g) { pickd.pop(); pickd.push(g); } }
    const ids = pickd.map(x => x.p.id), was = GM.on[s];
    const changes = ids.filter(id => !was.includes(id)).length;
    if (changes && (force || changes)) { GM.on[s] = ids; return ids.filter(id => !was.includes(id)).map(SD.P); }
    return [];
  }
  H.subs = subs;

  /* ---------- one possession ---------- */
  H.step = (GM, uc) => {
    uc = uc || {};
    if (GM.over) return null;
    const s = GM.poss, d = other(s);
    const sp = SD.SP();
    // timeouts
    if (uc.timeout && GM.user && GM.to[GM.user] > 0) { GM.to[GM.user]--; GM.run = { s: null, n: 0 }; GM.mom = 0; GM.dead = true; GM.trans = null; GM.early = null; ['h', 'a'].forEach(x => onP(GM, x).forEach(p => { GM.en[p.id] = Math.min(1, GM.en[p.id] + 0.08); })); subs(GM, 'h', true); subs(GM, 'a', true); return push(GM, { s: GM.user, kind: 'to', text: `Timeout, ${GM.T[GM.user].name}.`, time: 0 }); }
    // a CPU timeout to stop a run
    for (const x of ['h', 'a']) if (x !== GM.user && GM.to[x] > 0 && GM.run.s === other(x) && GM.run.n >= 8) { GM.to[x]--; GM.run = { s: null, n: 0 }; GM.mom = 0; subs(GM, x, true); return push(GM, { s: x, kind: 'to', text: `Timeout, ${GM.T[x].name}. ${GM.T[other(x)].name} on a run.`, time: 0 }); }
    // substitutions at dead balls: every few trips, and whenever a period starts
    GM.np = (GM.np || 0) + 1;
    if (GM.np % 4 === 1 || GM.subNow) { subs(GM, 'h'); subs(GM, 'a'); GM.subNow = false; }
    // the coach's call runs on the next dead-ball possession (after a make, a foul, a violation or a timeout), never off a live rebound
    const fresh = GM.dead !== false; GM.dead = false;
    if (uc.call && GM.user === s && fresh) GM.nextCall = uc.call;
    const c = GM.coach[s], cd = GM.coach[d];
    const O = onP(GM, s), D = onP(GM, d);
    const diff = GM.score[s] - GM.score[d], endGame = GM.per >= GM.nper;
    // pace and the late-game clock
    let dur = { slow: 23.5, normal: 19, fast: 14.5 }[c.pace] + gauss() * 3.5;
    if (GM.trans) dur = rr(4, 7);
    const early = !GM.trans && GM.early === s; GM.early = null;
    if (early) dur = rr(7, 11);
    if (endGame && GM.clock < 150 && diff > 0) dur = Math.max(dur, 24 + rr(0, 5));      // milk it
    if (endGame && GM.clock < 90 && diff < 0) dur = Math.min(dur, rr(6, 10));           // hurry
    if (GM.clock < dur + 2 && GM.clock < sp.shot) dur = Math.max(1, GM.clock - rr(0.5, 2)); // the last shot of the period
    dur = clamp(dur, 2, sp.shot - 0.5);
    // late: the trailing defense fouls on purpose
    const intFoul = endGame && GM.clock < 60 && diff >= 1 && diff <= 6 + (GM.clock < 20 ? 3 : 0) && (d !== GM.user || (cd.endFoul !== false));
    const r = { s, kind: 'shot', pts: 0, text: '', ev: [], time: dur };
    if (intFoul) {
      dur = rr(2, 5); r.time = dur;
      const ft = O.slice().sort((a, b) => a.at.ft - b.at.ft)[0], fouler = pick(D);
      add(GM, fouler, 'pf'); GM.tf[d]++;
      const made = shoot2(GM, ft, 2);
      r.kind = 'ft'; r.pts = made; r.shooter = ft;
      r.text = `${GM.T[d].name} fouls ${H.last(ft)} on purpose. He makes ${made} of 2.`.replace(' He ', ' ' + (sp.he === 'she' ? 'She' : 'He') + ' ');
      return finishPoss(GM, r, s, d, made, ft, null, true);
    }
    const trans = GM.trans === s; GM.trans = null;
    // turnovers
    const press = cd.def === 'press';
    const toP = clamp(0.15 + sq(avg(D.map(p => R(GM, p, 'stl'))) - avg(O.map(p => (R(GM, p, 'hnd') + R(GM, p, 'pas')) / 2))) / 380 + (press ? 0.035 : 0) - (avg(O.map(p => p.at.iq)) - 70) / 700 + (trans ? -0.03 : 0), 0.08, 0.26);
    if (chance(toP)) {
      const who = SD.wpick(O, p => (p.pos === 'PG' ? 2.2 : p.pos === 'SG' ? 1.5 : 1) * (100 - p.at.hnd + 20));
      add(GM, who, 'to');
      const steal = chance(0.55);
      let thief = null; if (steal) { thief = SD.wpick(D, p => Math.pow(p.at.stl, 2)); add(GM, thief, 'stl'); GM.trans = chance(0.62 + (press ? 0.1 : 0)) ? d : null; if (!GM.trans) GM.early = d; } else GM.dead = true;
      r.kind = 'to'; r.text = steal ? `${H.last(thief)} steals it from ${H.last(who)}.` : pick([`${H.last(who)} travels.`, `${H.last(who)} throws it away.`, `Offensive foul on ${H.last(who)}.`, `Shot-clock violation, ${GM.T[s].name}.`, `${H.last(who)} steps out of bounds.`]);
      r.who = who; r.thief = thief; r.big = steal && GM.trans === d;
      if (/Offensive foul/.test(r.text)) add(GM, who, 'pf');
      return finishPoss(GM, r, s, d, 0, null, null, false, dur);
    }
    // a non-shooting foul (bonus free throws)
    if (!trans && chance(0.085 + (press ? 0.025 : 0))) {
      const fouler = SD.wpick(D, p => 100 - p.tr.disc + 30), fouled = pick(O);
      add(GM, fouler, 'pf'); GM.tf[d]++;
      const bonus = sp.he === 'she' ? (GM.tf[d] >= 5 ? 2 : 0) : (GM.tf[d] >= 10 ? 2 : GM.tf[d] >= 7 ? 1.5 : 0);
      if (bonus) {
        let made = 0;
        if (bonus === 1.5) { if (ftOne(GM, fouled)) { made = 1 + (ftOne(GM, fouled) ? 1 : 0); } }
        else made = shoot2(GM, fouled, 2);
        r.kind = 'ft'; r.pts = made; r.shooter = fouled; r.text = `Foul on ${H.last(fouler)} (bonus). ${H.last(fouled)} makes ${made} at the line.`;
        return finishPoss(GM, r, s, d, made, fouled, null, true, dur * 0.6);
      }
      r.kind = 'foul'; r.text = `Foul on ${H.last(fouler)}. ${GM.T[s].abbr} ball.`; r.time = dur * 0.4; r.fouler = fouler; r.fouled = fouled; GM.dead = true;
      push(GM, r); GM.clock -= r.time; tick(GM, r.time, s); return checkClock(GM, r);
    }
    // the play
    const zone = cd.def === 'zone', foc = c.focus, call = GM.user === s && GM.nextCall && !trans && !early ? GM.nextCall : null; if (call) r.called = call; GM.nextCall = null;
    r.flow = trans ? 'trans' : early ? 'early' : call && call !== 'auto' ? 'call' : 'half';
    let play;
    if (trans) play = 'trans';
    else if (call && call !== 'auto') play = call;
    else {
      const bigs = O.filter(p => p.pos === 'C' || p.pos === 'PF'), post = bigs.length ? Math.max(...bigs.map(p => p.at.ins + p.at.reb / 3)) : 0;
      const w = early ? { pnr: 12, drive: 34, post: 2, spot: 34, iso: 6, cut: 4 } : { pnr: 26, drive: 18, post: post > 110 ? 14 : 7, spot: 18, iso: 9, cut: 8, motion: 22 };
      if (foc === 'rim') { w.drive += 14; w.post += 8; w.spot -= 8; } if (foc === 'three') { w.spot += 18; w.pnr += 4; w.post -= 4; } if (foc === 'post') { w.post += 16; } if (foc === 'star') w.iso += 16;
      if (zone) { w.spot += 8; w.post += 2; w.drive -= 6; }
      if (endGame && GM.clock < 120 && diff < -6) { w.spot += 16; }
      const ks = Object.keys(w); play = SD.wpick(ks, k => Math.max(0, w[k]));
      // motion offense: the ball moves until someone gets a look (a drive, a kick-out three or a cut)
      if (play === 'motion') { r.motion = true; play = SD.wpick(['spot', 'drive', 'cut'], k => ({ spot: 45, drive: 35, cut: 20 })[k]); }
    }
    const usage = p => Math.pow(Math.max(55, (p.at.ins + p.at.mid + p.at.thr) / 3 + (p.ovr - 75) * 0.6), 2.6) * (p.tr.ego > 75 ? 1.15 : 1);
    const pickBy = (arr, f) => SD.wpick(arr, f);
    let shooter, passer = null, type;
    const handler = O.slice().sort((a, b) => (b.at.hnd + b.at.pas) - (a.at.hnd + a.at.pas))[0];
    if (play === 'trans') { shooter = pickBy(O, p => usage(p) * (p.at.ath / 70)); type = chance(0.82) ? 'rim' : '3'; }
    else if (play === 'pnr') { const roll = chance(0.35); shooter = roll ? pickBy(O.filter(p => p !== handler), p => p.pos === 'C' || p.pos === 'PF' ? 3 : 0.4) : handler; passer = roll ? handler : null; type = roll ? (chance(0.75) ? 'rim' : 'mid') : SD.wpick(['rim', 'mid', '3'], t => ({ rim: 30, mid: 30, '3': 40 })[t] * (t === '3' ? handler.at.thr / 75 : 1)); }
    else if (play === 'drive') { shooter = pickBy(O, p => usage(p) * (p.at.ath + p.at.hnd) / 140); type = chance(0.68) ? 'rim' : chance(0.6) ? 'mid' : '3'; if (type === '3') { passer = shooter; shooter = pickBy(O.filter(p => p !== passer), p => Math.pow(p.at.thr, 3)); } }
    else if (play === 'post') { shooter = pickBy(O, p => (p.pos === 'C' || p.pos === 'PF' ? 4 : 0.5) * p.at.ins); passer = handler !== shooter ? handler : null; type = chance(0.68) ? 'rim' : 'mid'; }
    else if (play === 'spot' || play === 'three') { passer = handler; shooter = pickBy(O.filter(p => p !== handler), p => Math.pow(p.at.thr, 3.5)) || handler; type = chance(0.86) ? '3' : 'mid'; play = 'spot'; }
    else if (play === 'cut') { passer = handler; shooter = pickBy(O.filter(p => p !== handler), p => p.at.ath * p.at.iq) || handler; type = 'rim'; }
    else { shooter = pickBy(O, p => Math.pow(usage(p), 1.3)); type = SD.wpick(['rim', 'mid', '3'], t => ({ rim: 38, mid: 34, '3': 28 })[t] * (t === '3' ? shooter.at.thr / 75 : 1)); play = 'iso'; }
    // the defender on him (by position slot)
    const idx = O.indexOf(shooter), dfn = D[idx] || pick(D);
    const help = zone ? D.slice().sort((a, b) => b.at.idf - a.at.idf)[0] : D.filter(p => p !== dfn).sort((a, b) => b.at.blk - a.at.blk)[0];
    // make probability
    const w = sp.he === 'she';
    const clutchB = endGame && GM.clock < 120 && Math.abs(diff) <= 6 ? (shooter.tr.clutch - 70) / 900 : 0;
    const home = GM.neutral ? 0 : (s === 'h' ? 0.012 : -0.008);
    const mom = (GM.run.s === s ? Math.min(4, GM.run.n / 3) * 0.004 : 0);
    let pm;
    if (type === 'rim') pm = (w ? 0.56 : 0.6) + sq(R(GM, shooter, 'ins') - R(GM, help || dfn, 'idf')) / 170 + sq(R(GM, shooter, 'ath') - R(GM, dfn, 'ath')) / 320 + (play === 'trans' ? 0.1 : play === 'cut' ? 0.05 : 0) - (zone ? 0.03 : 0);
    else if (type === 'mid') pm = (w ? 0.39 : 0.41) + sq(R(GM, shooter, 'mid') - R(GM, dfn, 'pdf')) / 210;
    else pm = (w ? 0.32 : 0.345) + sq(R(GM, shooter, 'thr') - R(GM, dfn, 'pdf')) / 200 + (play === 'spot' ? 0.018 : play === 'iso' ? -0.02 : 0) + (zone ? 0.012 : 0) + (passer ? (passer.at.pas - 70) / 1400 : 0);
    pm = clamp(pm + clutchB + home + mom + (shooter.tr.cons < 60 ? gauss() * 0.04 : 0), 0.12, 0.86);
    const val = type === '3' ? 3 : 2;
    // blocks and shooting fouls
    const blkP = type === 'rim' ? clamp(0.055 + ((help || dfn).at.blk - 65) / 350, 0.02, 0.16) : type === 'mid' ? 0.02 : 0.008;
    const foulP = type === 'rim' ? 0.2 + (shooter.at.ath - 70) / 500 : type === 'mid' ? 0.075 : 0.022;
    r.play = play; r.type = type; r.shooter = shooter; r.dfn = dfn;
    add(GM, shooter, 'fga'); if (type === '3') add(GM, shooter, 'tpa');
    if (chance(blkP)) {
      const b = help && chance(0.6) ? help : dfn; add(GM, b, 'blk');
      r.blk = b; r.text = `${H.last(b)} blocks ${H.last(shooter)}${type === 'rim' ? ' at the rim' : ''}!`; r.big = true;
      return rebound(GM, r, s, d, O, D, dur);
    }
    const fouled = chance(foulP);
    const made = chance(pm * (fouled ? 0.55 : 1));
    if (fouled) { const f = type === 'rim' && help && chance(0.4) ? help : dfn; add(GM, f, 'pf'); GM.tf[d]++; r.fouler = f; }
    if (made) {
      add(GM, shooter, 'fgm'); add(GM, shooter, 'pts', val); if (type === '3') add(GM, shooter, 'tpm');
      let pts = val, ast = null;
      const astP = { spot: 0.9, pnr: passer ? 0.92 : 0.55, post: 0.4, drive: 0.42, iso: 0.08, cut: 0.92, trans: 0.55 }[play] || 0.5;
      if (chance(astP)) { ast = passer && passer !== shooter ? passer : SD.wpick(O.filter(p => p !== shooter), p => Math.pow(p.at.pas, 2.5)); add(GM, ast, 'ast'); }
      if (fouled) { const ft = ftOne(GM, shooter); pts += ft ? 1 : 0; r.and1 = true; }
      r.pts = pts; r.ast = ast;
      r.text = describe(GM, shooter, type, play, ast, r.and1, pts);
      r.big = type === '3' && Math.abs(diff) <= 5 && endGame || (play === 'trans' && type === 'rim' && shooter.at.ath >= 85);
      return finishPoss(GM, r, s, d, pts, shooter, ast, false, dur);
    }
    if (fouled) {
      const n = type === '3' ? 3 : 2, ftm = shoot2(GM, shooter, n);
      r.kind = 'ft'; r.pts = ftm; r.text = `${H.last(shooter)} is fouled on the ${type === '3' ? 'three' : 'shot'} by ${H.last(r.fouler)}. Makes ${ftm} of ${n}.`;
      return finishPoss(GM, r, s, d, ftm, shooter, null, true, dur);
    }
    r.text = `${H.last(shooter)} misses ${type === '3' ? 'a three' : type === 'mid' ? 'a jumper' : 'at the rim'}${dfn && chance(0.3) ? ' (' + H.last(dfn) + ' with a good contest)' : ''}.`;
    return rebound(GM, r, s, d, O, D, dur);
  };
  function describe(GM, p, type, play, ast, and1, pts) {
    const n = H.last(p), a = ast ? ` (${H.last(ast)} assist)` : '';
    if (type === '3') return pick([`${n} drills a three`, `${n} from deep: good`, `${n} hits the three`, `${n} buries it from the corner`]) + a + '.';
    if (type === 'mid') return pick([`${n} pulls up and hits`, `${n} with the jumper`, `${n} knocks down the mid-range`]) + a + (and1 ? ' And one!' : '.');
    if (play === 'trans' && p.at.ath >= 82 && chance(0.5)) return `${n} throws it down in transition${a}${and1 ? '. And one!' : '!'}`;
    if (play === 'post') return pick([`${n} scores in the post`, `${n} with the hook`, `${n} backs down and scores`]) + a + (and1 ? '. And one!' : '.');
    return pick([`${n} finishes at the rim`, `${n} with the layup`, `${n} attacks and scores`, `${n} gets to the cup`]) + a + (and1 ? '. And one!' : '.');
  }
  function ftOne(GM, p) { add(GM, p, 'fta'); const pct = clamp(0.5 + (p.at.ft - 50) / 105 + (GM.per >= GM.nper && GM.clock < 60 ? (p.tr.clutch - 70) / 600 : 0) - (GM.neutral || GM.poss === 'h' ? 0 : 0.01), 0.35, 0.95); const m = chance(pct); if (m) { add(GM, p, 'ftm'); add(GM, p, 'pts'); } return m; }
  function shoot2(GM, p, n) { let m = 0; for (let i = 0; i < n; i++) m += ftOne(GM, p) ? 1 : 0; return m; }
  function rebound(GM, r, s, d, O, D, dur) {
    const orb = clamp((GM.women ? 0.3 : 0.28) + (avg(O.map(p => R(GM, p, 'reb'))) - avg(D.map(p => R(GM, p, 'reb')))) / 230 - (r.type === '3' ? 0.02 : 0), 0.14, 0.42);
    if (chance(orb)) {
      const rb = SD.wpick(O, p => Math.pow(p.at.reb, 3) * (p.pos === 'C' || p.pos === 'PF' ? 1.6 : 0.7)); add(GM, rb, 'orb');
      r.orb = rb; r.text += ` Offensive rebound, ${H.last(rb)}.`;
      push(GM, r); GM.clock -= dur; tick(GM, dur, s);
      // the possession continues (shot clock resets to 20)
      return checkClock(GM, r);
    }
    const rb = SD.wpick(D, p => Math.pow(p.at.reb, 3) * (p.pos === 'C' || p.pos === 'PF' ? 1.6 : 0.7)); add(GM, rb, 'drb');
    r.drb = rb; r.text += ` ${H.last(rb)} rebounds.`;
    // off a defensive rebound the ball is live: push it (transition), attack early, or walk it up
    const pushK = GM.coach[d].pace === 'fast' ? 1.5 : GM.coach[d].pace === 'slow' ? 0.5 : 1;
    GM.trans = chance(0.17 * pushK) ? d : null;
    GM.early = !GM.trans && chance(0.3 * pushK) ? d : null;
    return finishPoss(GM, r, s, d, 0, null, null, false, dur);
  }
  function finishPoss(GM, r, s, d, pts, scorer, ast, ftEnd, dur) {
    dur = dur == null ? r.time : dur; r.time = dur;
    if (pts > 0 || ftEnd) { GM.dead = true; GM.trans = null; GM.early = null; }
    GM.score[s] += pts; GM.lineScore[s][GM.lineScore[s].length - 1] += pts;
    // plus/minus
    if (pts) { GM.on[s].forEach(id => { const p = SD.P(id); add(GM, p, 'pm', pts); }); GM.on[d].forEach(id => { const p = SD.P(id); add(GM, p, 'pm', -pts); }); }
    // runs
    if (pts) { if (GM.run.s === s) GM.run.n += pts; else GM.run = { s, n: pts }; }
    push(GM, r);
    GM.clock -= dur; tick(GM, dur, s);
    GM.poss = d;
    return checkClock(GM, r);
  }
  // minutes and fatigue
  function tick(GM, dt, s) {
    ['h', 'a'].forEach(x => {
      GM.L[x].forEach(p => {
        const on = GM.on[x].includes(p.id);
        if (on) { GM.min[p.id] = (GM.min[p.id] || 0) + dt; GM.en[p.id] = Math.max(0.2, GM.en[p.id] - dt * (0.0017 - (p.at.sta - 70) / 60000) * (GM.coach[x].pace === 'fast' || GM.coach[x].def === 'press' ? 1.25 : 1)); }
        else GM.en[p.id] = Math.min(1, (GM.en[p.id] == null ? 1 : GM.en[p.id]) + dt * 0.0035);
      });
    });
  }
  function push(GM, r) {
    r.per = GM.per; r.clock = Math.max(0, GM.clock); r.score = { h: GM.score.h, a: GM.score.a };
    if (r.kind !== 'to' || r.who) r.sc = GM.score[r.s] + (r.pts && false ? 0 : 0);
    GM.plays.push(r); if (GM.plays.length > 500) GM.plays.shift();
    GM.lastEvent = r;
    return r;
  }
  function checkClock(GM, r) {
    if (GM.clock > 0.4) return r;
    GM.clock = 0;
    const regDone = GM.per >= GM.nper;
    if (regDone && GM.score.h !== GM.score.a) { GM.over = true; r.final = true; return r; }
    // next period (or overtime)
    GM.per++;
    const ot = GM.per > GM.nper;
    GM.clock = ot ? 300 : GM.perLen;
    if (GM.nper === 2 ? GM.per === 2 : (GM.per === 3)) { GM.tf = { h: 0, a: 0 }; GM.half = 2; }
    if (GM.nper === 4) GM.tf = { h: 0, a: 0 };
    if (ot) { GM.ot++; GM.tf = GM.tf; }
    GM.lineScore.h.push(0); GM.lineScore.a.push(0);
    GM.poss = GM.per % 2 === 0 ? other(GM.firstPoss || 'h') : (GM.firstPoss || 'h');
    r.endPer = true; GM.subNow = true; GM.dead = true; GM.trans = null; GM.early = null;
    ['h', 'a'].forEach(x => GM.L[x].forEach(p => { GM.en[p.id] = Math.min(1, (GM.en[p.id] || 1) + (GM.per === (GM.nper === 2 ? 2 : 3) ? 0.35 : 0.12)); }));
    return r;
  };
  H.playFull = GM => { GM.firstPoss = GM.poss; let n = 0; while (!GM.over && n++ < 800) H.step(GM, {}); finalize(GM); return GM; };
  function finalize(GM) {
    for (const s of ['h', 'a']) { GM.L[s].forEach((p, i) => { if (GM.min[p.id] > 0 || GM.ps[p.id]) { const l = line(GM, p); l.min = Math.round((GM.min[p.id] || 0) / 60); if (i < 5) l.gs = 1; } }); }
  }
  H.finalize = finalize;

  /* ---------- the court view: choreography for one possession (10 players and the ball, in feet) ---------- */
  // offense spots relative to the basket (x: feet from the baseline toward half court, y: across)
  const SPOTS = { PG: [23, 25], SG: [19, 8], SF: [19, 42], PF: [8, 15], C: [7, 34] };
  const FIVE = { PG: [24, 25], SG: [21, 6], SF: [21, 44], PF: [5, 3], C: [5, 47] };
  H.frames = (GM, r, s, onO, onD, firstHalfDir) => {
    // which basket: the home team attacks the right basket in the first half
    const half2 = GM.nper === 2 ? r.per >= 2 : r.per >= 3;
    const right = (s === 'h') !== half2;
    const bx = right ? 88.75 : 5.25, sg = right ? -1 : 1;    // sg: direction from the basket toward half court
    const P = (dx, y) => [bx + sg * dx, y];
    const O = onO.map(SD.P), D = onD.map(SD.P);
    const spot = (p, i, five) => { const sp = (five ? FIVE : SPOTS)[p.pos] || [16 + i * 3, 10 + i * 8]; return P(sp[0] + gauss() * 1.2, clamp(sp[1] + gauss() * 1.5, 2, 48)); };
    const zone = GM.coach[other(s)].def === 'zone';
    const ZONE = [[17, 17], [17, 33], [7, 6], [7, 44], [5, 25]];
    const dpos = (opos, i) => zone ? P(ZONE[i][0], ZONE[i][1]) : [opos[0] + (bx - opos[0]) * 0.16, opos[1] + (25 - opos[1]) * 0.12];
    const frames = [];
    const T = clamp(r.time || 12, 3, 30), S = Math.min(1, 7 / T);   // the possession is shown at about 4-7 seconds
    const fr = (t, op, dp, ball, holder, z) => frames.push([Math.round(t * 100) / 100, op.map(x => [Math.round(x[0] * 10) / 10, Math.round(x[1] * 10) / 10]), dp.map(x => [Math.round(x[0] * 10) / 10, Math.round(x[1] * 10) / 10]), ball, holder, z || 0]);
    // 0: bring it up (or the break)
    const five = r.play === 'spot' || r.play === 'three' || GM.coach[s].focus === 'three';
    const set = O.map((p, i) => spot(p, i, five));
    const start = O.map((p, i) => r.play === 'trans' ? P(48 + i * 4, 10 + i * 8) : P(36 + gauss() * 4, 8 + i * 8.5));
    const hIdx = Math.max(0, O.findIndex(p => p.pos === 'PG'));
    const dStart = start.map((x, i) => [x[0] - sg * 4, x[1]]);
    fr(0, start, dStart, P(42, 25), hIdx);
    const tSet = r.play === 'trans' ? 1.2 : 2.2;
    fr(tSet, set, set.map(dpos), set[hIdx], hIdx);
    // the action
    const si = r.shooter ? O.indexOf(r.shooter) : hIdx, pi = r.ast ? O.indexOf(r.ast) : (r.passer ? O.indexOf(r.passer) : -1);
    const act = set.map(x => x.slice()), dact = set.map(dpos);
    let shotAt;
    if (r.kind === 'to') {
      const w = r.who ? O.indexOf(r.who) : hIdx; act[w] = P(16, 25 + gauss() * 6); dact[w] = [act[w][0] + sg * 1.5, act[w][1]];
      fr(tSet + 1.4, act, dact, act[w], w);
      const ti = r.thief ? D.indexOf(r.thief) : -1;
      if (ti >= 0) { dact[ti] = act[w].slice(); const run = P(70, 25); fr(tSet + 2.0, act, dact, act[w], -2 - ti); fr(tSet + 3.0, act.map(x => [x[0] - sg * 12, x[1]]), dact.map((x, i) => i === ti ? run : [x[0] - sg * 10, x[1]]), run, -2 - ti); }
      return { frames, right, T: frames[frames.length - 1][0] };
    }
    if (si >= 0) {
      if (r.type === 'rim') shotAt = P(3 + rr(0, 2), 25 + gauss() * 3);
      else if (r.type === 'mid') shotAt = P(14 + rr(0, 3), clamp(set[si][1] + gauss() * 3, 8, 42));
      else shotAt = (() => { const corner = Math.abs(set[si][1] - 25) > 15 && set[si][0] === set[si][0] && chance(0.4); return corner ? P(4, set[si][1] < 25 ? 3 : 47) : P(23 + rr(0, 2), set[si][1]); })();
      // the pass (if any), the move to the spot
      if (pi >= 0 && pi !== si) { fr(tSet + 0.9, act, dact, act[pi], pi); }
      act[si] = shotAt; dact[si] = [shotAt[0] + sg * 1.4, shotAt[1] + gauss() * 0.6];
      if (r.type === 'rim') { const helpI = D.findIndex(p => p === (r.blk || null)); if (helpI >= 0) dact[helpI] = [shotAt[0] + sg * 1.0, shotAt[1] + 1.2]; }
      const tShot = tSet + (pi >= 0 ? 2.0 : 1.6);
      fr(tShot, act, dact, shotAt, si);
      // the ball in the air
      const made = r.pts > 0 && r.kind !== 'ft';
      fr(tShot + 0.75, act, dact, [bx, 25], -1, r.type === '3' ? 8 : 5);
      if (r.kind === 'ft') { // to the line
        const line = P(15, 25), ftp = act.map(x => x.slice()); ftp[si] = line; const ld = dact.map((x, i) => i < 2 ? P(10, 19 + i * 12) : P(7, 20 + i * 4));
        fr(tShot + 1.8, ftp, ld, line, si); fr(tShot + 2.4, ftp, ld, [bx, 25], -1, 5);
      } else if (!made) {
        const rbI = r.orb ? O.indexOf(r.orb) : r.drb ? D.indexOf(r.drb) : -1, spotR = P(6 + rr(0, 4), 25 + gauss() * 6);
        const a2 = act.map(x => [x[0] + (bx - x[0]) * 0.3, x[1] + (25 - x[1]) * 0.3]), d2 = dact.map(x => [x[0] + (bx - x[0]) * 0.35, x[1] + (25 - x[1]) * 0.35]);
        if (r.orb && rbI >= 0) a2[rbI] = spotR; else if (rbI >= 0) d2[rbI] = spotR;
        fr(tShot + 1.5, a2, d2, spotR, r.orb ? rbI : rbI >= 0 ? -2 - rbI : -1);
      } else {
        fr(tShot + 1.3, act.map(x => [x[0] - sg * 3, x[1]]), dact, [bx - sg * 1, 25], -1, 0);
      }
    }
    return { frames, right, T: frames[frames.length - 1][0] };
  };
})(typeof window !== 'undefined' ? window : globalThis);
