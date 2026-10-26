/* The Vol Index — Football Dynasty: the game engine.
   One snap at a time: pre-snap (play clock, crowd noise, false starts), the call on each side (coach or CPU),
   the matchup (blocks, rush vs protection, routes vs coverage, tackles), what each player's personality did to the play,
   the clock (2023+ college rules: the clock keeps running on first downs except in the last 2:00 of a half),
   timeouts, penalties, kicks, PATs, two-point tries and college overtime.
   Every result carries a short animation script the game screen draws. No DOM in here. */
(function (root) {
  'use strict';
  const DY = root.DY;
  const { rr, ri, chance, pick, gauss, clamp, wpick } = DY;
  const rnd = () => DY.r();
  const other = s => s === 'h' ? 'a' : 'h';
  const last = p => p ? p.n.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(' ').slice(-1)[0] : '?';
  DY.lastName = last;

  /* ---------- setting up a game ---------- */
  DY.newGame = (home, away, o) => {
    o = o || {};
    const G = DY.G;
    const crowdBase = o.neutral ? 0 : clamp(home.cap / 100, 0.15, 1.05);
    const big = !!o.big;
    const GM = {
      id: o.id || ('g' + Math.floor(rnd() * 1e9)), wk: o.wk, season: G ? G.season : 2026, T: { h: home, a: away }, neutral: !!o.neutral, big, rival: o.rival || null,
      crowd: clamp(crowdBase * (big ? 1 : 0.72) * (0.75 + home.prestige / 400), 0, 1.1), title: o.title || null, ranks: o.ranks || {},
      L: { h: DY.lineup(home), a: DY.lineup(away) },
      q: 1, clock: 900, poss: 'h', ball: 25, down: 1, togo: 10, score: { h: 0, a: 0 }, to: { h: 3, a: 3 }, running: false, lineScore: { h: [0, 0, 0, 0], a: [0, 0, 0, 0] },
      next: 'kick', kicker: null, opening: null, ps: {}, ts: { h: DY.teamLine(), a: DY.teamLine() }, plays: [], drives: [], drive: null, mom: 0, form: {}, hot: {},
      tend: { h: DY.newTend(), a: DY.newTend() }, dtend: { h: {}, a: {} }, snap: {}, user: o.user || null, coach: o.coach || 'offense', over: false, ot: null,
      lastCall: { h: [], a: [] }, ovr: { h: DY.teamOvr(home), a: DY.teamOvr(away) }, injuries: [], noInj: !!o.noInj, hurry: { h: false, a: false }, chew: { h: false, a: false },
    };
    // coin toss: the winner defers; the other team receives
    const toss = chance(0.5) ? 'h' : 'a';
    GM.opening = other(toss); GM.kicker = toss; GM.tossWinner = toss;
    // per-game form (consistency trait) for everyone dressed
    for (const s of ['h', 'a']) GM.T[s].roster.forEach(id => { const p = DY.P(id); if (p) GM.form[id] = gauss() * (100 - p.tr.cons) / 22; });
    GM.style = { h: DY.STYLES[home.style || 'spread'] || DY.STYLES.spread, a: DY.STYLES[away.style || 'spread'] || DY.STYLES.spread };
    GM.aggr = { h: home.aggr || 0.55, a: away.aggr || 0.55 };
    // game plans (CPU picks its own; you pick yours on the scouting report), halftime adjustments, captains
    GM.plan = { h: DY.aiPlan(GM, 'h'), a: DY.aiPlan(GM, 'a') };
    GM.adj = { h: { o: 'none', d: 'none' }, a: { o: 'none', d: 'none' } };
    GM.planSet = !GM.user || GM.coach === 'watch';
    GM.cap = {};
    for (const s of ['h', 'a']) { const caps = GM.T[s].roster.map(DY.P).filter(p => p && p.captain); const lead = caps.length ? avg(caps.map(p => p.tr.lead)) : 70; GM.cap[s] = clamp((lead - 75) / 14, 0, 1.4); }
    GM.wiped = null; GM.by = 26.67; GM.live = !!o.live;
    return GM;
  };
  DY.teamLine = () => ({ plays: 0, yds: 0, ry: 0, ra: 0, py: 0, pa: 0, pc: 0, fd: 0, pen: 0, peny: 0, to: 0, top: 0, c3: 0, a3: 0, c4: 0, a4: 0, sk: 0, pn: 0 });
  DY.newTend = () => ({ e: [3, 3], s: [3, 2], l: [1, 4], dir: { L: 1, M: 1, R: 1 }, pt: { quick: 1, med: 1, deep: 1, screen: 1, pa: 1 } });
  const line = (GM, p) => { if (!p) return {}; let s = GM.ps[p.id]; if (!s) s = GM.ps[p.id] = { t: p.t }; return s; };
  const add = (GM, p, k, v) => { if (!p) return; const s = line(GM, p); s[k] = (s[k] || 0) + (v == null ? 1 : v); };
  const maxs = (GM, p, k, v) => { if (!p) return; const s = line(GM, p); s[k] = Math.max(s[k] || 0, v); };

  /* ---------- who is on the field this snap (rotation, garbage time, injuries) ---------- */
  // how much the backups play (percent of snaps when the game is close); stars play more, QB1 plays every snap
  DY.ROT_DEFAULT = { RB: 30, WR: 12, TE: 18, DL: 24, LB: 6, DB: 4 };
  DY.ROT_GROUPS = [['RB', 'Running back'], ['WR', 'Wide receiver'], ['TE', 'Tight end'], ['DL', 'Defensive line'], ['LB', 'Linebacker'], ['DB', 'Secondary']];
  function pers(GM, s) {
    const L = GM.L[s], lead = GM.score[s] - GM.score[other(s)];
    const garbage = (GM.q === 4 && Math.abs(lead) >= 24) || (GM.q >= 3 && Math.abs(lead) >= 35);
    const g = garbage ? 1 : 0;
    const R = Object.assign({}, DY.ROT_DEFAULT, GM.T[s].rot || {});
    const at = (arr, i) => arr[Math.min(arr.length - 1, i)] || arr[0];
    // the backup comes in R% of the time, less when the starter is much better (a star stays on the field)
    const sw = (st, bk, grp) => { if (!bk || bk === st) return st; if (garbage) return chance(0.75) ? bk : st; const m = clamp(1 - ((st.ovr || 70) - (bk.ovr || 70)) / 16, 0.12, 1.25); return chance(R[grp] / 100 * m) ? bk : st; };
    const QB = garbage && Math.abs(lead) >= 28 ? at(L.QB, 1) : L.QB[0];
    const P = {
      QB, RB: sw(L.RB[0], L.RB[1], 'RB'),
      WR: [garbage ? at(L.WR, 3) : sw(L.WR[0], L.WR[3], 'WR'), garbage ? at(L.WR, 4) : sw(L.WR[1], L.WR[4] || L.WR[3], 'WR'), sw(L.WR[2], L.WR[3], 'WR')],
      TE: sw(L.TE[0], L.TE[1], 'TE'),
      OL: [at(L.OT, 0), at(L.IOL, 0), at(L.IOL, 1), at(L.IOL, 2), at(L.OT, 1)],
      DL: [sw(L.EDGE[0], L.EDGE[2], 'DL'), sw(L.DT[0], L.DT[2], 'DL'), sw(L.DT[1], L.DT[3] || L.DT[2], 'DL'), sw(L.EDGE[1], L.EDGE[3] || L.EDGE[2], 'DL')],
      LB: [sw(L.LB[0], L.LB[2], 'LB'), sw(L.LB[1], L.LB[3] || L.LB[2], 'LB')],
      CB: [sw(L.CB[0], L.CB[3] || L.CB[2], 'DB'), sw(L.CB[1], L.CB[3] || L.CB[2], 'DB')], NB: L.NB, S: [sw(L.S[0], L.S[2], 'DB'), sw(L.S[1], L.S[2], 'DB')],
      K: L.K[0], P: L.P[0], KR: L.KR, PR: L.PR,
      TE2: at(L.TE, 1), WR4: at(L.WR, 3), WR5: at(L.WR, 4), FB: L.RB[1] || L.TE[1] || L.RB[0],
    };
    if (garbage && L.OT.length > 2) P.OL[0] = L.OT[2];
    if (garbage && L.IOL.length > 3) P.OL[2] = L.IOL[3];
    // a thin or injury-hit room never leaves a hole on the field: borrow from the nearest group
    const pool = { DL: ['DT', 'EDGE', 'LB', 'IOL'], LB: ['LB', 'S', 'EDGE'], CB: ['CB', 'NB', 'S'], S: ['S', 'CB', 'LB'], WR: ['WR', 'TE', 'RB'], OL: ['IOL', 'OT', 'TE'] };
    Object.keys(pool).forEach(k => { const used = new Set(P[k].filter(Boolean)); P[k] = P[k].map(p => { if (p) return p; const c = pool[k].flatMap(g => L[g] ? [].concat(L[g]) : []).find(x => x && !used.has(x)) || pool[k].flatMap(g => L[g] ? [].concat(L[g]) : []).find(Boolean); if (c) used.add(c); return c; }); });
    ['RB', 'TE', 'NB', 'TE2', 'WR4', 'WR5', 'FB'].forEach(k => { if (!P[k]) P[k] = P.WR[0] || P.RB; });
    if (!P.NB) P.NB = P.CB[0];
    return P;
  }
  // snap counts: everyone on the field for the play (by formation), every snap
  const snap1 = (GM, p) => { if (!p) return; GM.snap[p.id] = 1; add(GM, p, 'sn'); };
  const markSnapF = (GM, P, F) => { [P.QB, ...P.OL].forEach(p => snap1(GM, p)); const wr = F ? F.wr : 3, te = F ? F.te : 1, rb = F ? F.rb : 1;
    if (rb >= 1) snap1(GM, P.RB); if (rb >= 2) snap1(GM, P.FB); [P.WR[0], P.WR[1], P.WR[2], P.WR4, P.WR5].slice(0, wr).forEach(p => snap1(GM, p)); if (te >= 1) snap1(GM, P.TE); if (te >= 2) snap1(GM, P.TE2); };
    const markDef = (GM, P) => { [...P.DL, ...P.LB, ...P.CB, P.NB, ...P.S].forEach(p => snap1(GM, p)); };

  /* ---------- effective rating for this snap: attribute + game form + momentum + crowd + clutch ---------- */
  function bigMoment(GM) { const d = Math.abs(GM.score.h - GM.score.a); return GM.q >= 5 || (GM.q === 4 && GM.clock <= 420 && d <= 8); }
  DY.bigMoment = bigMoment;
  function E(GM, p, k, side) {
    if (!p) return 45;
    let v = p.at[k] != null ? p.at[k] : p.ovr - 12;
    v = 78 + (v - 78) * DY.SENS;
    v += (GM.form[p.id] || 0) + (GM.hot[p.id] || 0);
    const m = side === 'h' ? GM.mom : -GM.mom; v += m * 1.6;
    if (side === 'a' && GM.crowd > 0 && GM.poss === 'a') v -= GM.crowd * 1.8 * (1 - (GM.L.a.QB[0] ? (GM.L.a.QB[0].tr.lead - 50) / 120 : 0)) * (1 - (GM.cap ? GM.cap.a * 0.25 : 0));
    if (bigMoment(GM) || (GM.down >= 3 && GM.q >= 3 && Math.abs(GM.score.h - GM.score.a) <= 8)) v += (p.tr.clutch - 55) / 9 + (GM.cap ? GM.cap[side] || 0 : 0);
    if (DY.G && DY.G.settings && DY.G.settings.diffBoost && GM.T[side] && !GM.T[side].user && (GM.T.h.user || GM.T.a.user)) v += DY.G.settings.diffBoost;
    return v;
  }
  const avg = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  DY.SENS = 0.6;
  DY._E = E; DY._pers = (GM, s) => pers(GM, s);

  /* ---------- the CPU coordinators ---------- */
  function predPass(GM, offSide) {
    const t = GM.tend[offSide], k = GM.togo <= 3 && GM.down >= 2 ? 's' : (GM.togo >= 7 && GM.down >= 2) ? 'l' : 'e';
    const prior = { e: 0.5, s: 0.32, l: 0.82 }[k];
    const obs = t[k][1] / (t[k][0] + t[k][1]);
    return 0.45 * prior + 0.55 * obs;
  }
  DY.aiDef = (GM, defSide) => {
    const offSide = other(defSide), lead = GM.score[defSide] - GM.score[offSide];
    if ((GM.q === 4 || GM.q === 2) && GM.clock <= 40 && lead > 0 && lead <= 8 + (GM.q === 2 ? 99 : 0) && GM.ball < 60) return { d: 'prev', lean: 'M' };
    if (GM.q === 4 && GM.clock <= 75 && lead >= 4 && lead <= 8) return { d: chance(0.6) ? 'prev' : 'c4', lean: 'M' };
    let pp = predPass(GM, offSide);
    // read the offense's habits (repeat calls get sniffed out)
    const lc = GM.lastCall[offSide];
    const repeat = lc.length >= 2 && lc[lc.length - 1] === lc[lc.length - 2];
    const aggr = GM.aggr[defSide];
    const opts = pp > 0.62
      ? [['c2', 1.2], ['t2', 0.9], ['c4', 1.1], ['c1', 1], ['c1f', 0.6 * aggr * 2], ['c0', 0.25 * aggr * 2], ['c6', 0.8], ['c3', 0.7]]
      : pp < 0.4 ? [['bear', 1.1], ['c3b', 1.2], ['c1', 1.0], ['c1f', 0.5], ['c3', 0.6], ['c4', 0.35]]
        : [['c3', 1.2], ['c4', 0.9], ['c1', 0.9], ['c3b', 0.8], ['c2', 0.6], ['c1f', 0.5 * aggr * 2], ['c6', 0.6], ['bear', 0.35]];
    if (GM.ball >= 90) opts.push(['c0', 0.6], ['bear', 0.6], ['gl', GM.ball >= 96 ? 1.6 : 0.4]);
    if (pp > 0.55) opts.push(['zb', 0.45 * aggr * 2], ['ncb', 0.3 * aggr * 2], ['c2m', 0.6]);
    else opts.push(['sfb', 0.25 * aggr * 2]);
    const d = wpick(opts, x => x[1])[0];
    const dirs = GM.tend[offSide].dir, tot = dirs.L + dirs.M + dirs.R;
    const lean = chance(0.55) ? wpick(['L', 'M', 'R'], x => dirs[x] / tot) : pick(['L', 'M', 'R']);
    // personnel: goal line inside the 3, dime on obvious passing downs
    const pkg = d === 'gl' || (GM.ball >= 97 && GM.togo <= 3) ? 'goal' : (GM.down >= 3 && GM.togo >= 9) || d === 'prev' || d === 'dman' ? 'dime' : null;
    return { d, lean, pkg, read: repeat ? lc[lc.length - 1] : null };
  };
  // modifiers from the game plan and halftime adjustments for one side
  const NOMOD = {};
  function MOD(GM, s) {
    const m = {};
    const addm = o => { for (const k in o) m[k] = (m[k] || 0) + o[k]; };
    addm((DY.PLANS[GM.plan && GM.plan[s]] || DY.PLANS.bal).mod);
    if (GM.adj) { addm((DY.ADJ_O[GM.adj[s].o] || DY.ADJ_O.none).mod); addm((DY.ADJ_D[GM.adj[s].d] || DY.ADJ_D.none).mod); }
    return m;
  }
  DY.MOD = MOD;
  DY.aiPlan = (GM, s) => {
    const me = GM.ovr[s], them = GM.ovr[other(s)], st = GM.style[s];
    if (st.pass <= 0.45 && chance(0.6)) return 'run';
    if (st.pass >= 0.55 && chance(0.5)) return 'air';
    if (me.def > them.off + 3 && chance(0.4)) return 'pressure';
    if (them.off > me.def + 4 && chance(0.4)) return 'bend';
    return 'bal';
  };
  // halftime: the CPU reads the first half
  DY.aiAdjust = (GM, s) => {
    const T = GM.ts[s], O = GM.ts[other(s)];
    const oppYpc = O.ra ? O.ry / O.ra : 4, oppYpa = O.pa ? O.py / O.pa : 6, myYpc = T.ra ? T.ry / T.ra : 4;
    const d = oppYpc > 5.2 ? 'box' : oppYpa > 8 ? 'deep' : O.sk < 1 && chance(0.5) ? 'pressure' : 'none';
    const o = T.sk >= 3 ? 'protect' : myYpc > 5 ? 'run' : T.pa && T.pc / T.pa < 0.55 ? 'quick' : 'none';
    return { o, d };
  };
  // formation for a call: the team's identity, the situation and the call
  DY.aiForm = (GM, s, call) => {
    const st = GM.style[s];
    if (GM.ball >= 97 && GM.togo <= 3 && call.k === 'run') return 'goal';
    if (GM.togo <= 1 && GM.down >= 3 && call.k === 'run' && chance(0.6)) return chance(0.5) ? 'goal' : 'iform';
    if (call.k === 'pass' && GM.down >= 3 && GM.togo >= 8) return wpick(['spread', 'trips', 'empty', 'doubles'], f => ({ spread: 3, trips: 3, empty: 1.5, doubles: 1.5 })[f]);
    if (call.k === 'pass' && call.t === 'pa') return wpick(['ace12', 'pistol', 'iform', 'trips'], f => (st.forms[f] || 0.05) + (f === 'ace12' || f === 'iform' ? 0.15 : 0));
    if (call.k === 'pass' && call.t === 'screen') return wpick(['trips', 'doubles', 'spread'], f => st.forms[f] || 0.1);
    const fs = Object.keys(st.forms);
    return wpick(fs, f => st.forms[f] * (call.k === 'run' ? 1 + (DY.FORMS[f].run || 0) * 0.6 : 1 + (DY.FORMS[f].sep || 0) * 2));
  };
  DY.fgRange = k => 40 + ((k ? k.at.kpw : 70) - 60) * 0.5;
  DY.fgProb = (GM, k, dist) => {
    const kpw = k ? k.at.kpw : 65, kac = k ? k.at.kac : 65, range = 40 + (kpw - 60) * 0.5;
    let p = 0.995 - Math.max(0, dist - 20) * 0.0105 * (1.15 - (kac - 70) / 90) - Math.max(0, dist - range) * 0.07;
    return clamp(p, 0.02, 0.99);
  };
  DY.aiOff = (GM, s) => {
    const P = pers(GM, s), lead = GM.score[s] - GM.score[other(s)], late = GM.q === 4 && GM.clock <= 300, two = (GM.q === 2 || GM.q === 4) && GM.clock <= 120;
    const fgDist = 100 - GM.ball + 17, range = DY.fgRange(P.K);
    const out = { tempo: null };
    // kneel it out
    if (GM.q === 4 && lead > 0 && GM.clock <= (4 - GM.down) * 40 + 2 && GM.to[other(s)] <= Math.max(0, 3 - GM.down)) return { k: 'kneel' };
    if (GM.q === 2 && GM.clock <= 30 && GM.ball < 40 && GM.down < 4 && lead >= 0) return { k: 'kneel' };
    // end of half / game: kick it
    if ((GM.q === 2 || (GM.q === 4 && lead >= -3 && lead <= 0)) && GM.clock <= 8 && fgDist <= range + 3) return { k: 'fg' };
    if (GM.q >= 5 && GM.down === 4 && fgDist <= range && (GM.ot && GM.ot.needTD !== true)) return { k: 'fg' };
    // spike to stop the clock
    if (two && GM.running && GM.to[s] === 0 && GM.clock <= 35 && GM.clock > 4 && GM.down < 4 && lead <= 0) return { k: 'spike' };
    if (GM.down === 4) {
      const dec = DY.fourthDown(GM, s);
      if (dec !== 'go') return { k: dec };
    }
    // tempo
    if ((GM.q === 4 && lead < 0 && GM.clock <= 420) || two && lead <= 7) out.tempo = 'hurry';
    else if (GM.q === 4 && lead > 0 && GM.clock <= 600) out.tempo = 'chew';
    // run or pass
    let pp = GM.style[s].pass;
    if (GM.down === 2) pp += GM.togo >= 8 ? 0.12 : GM.togo <= 3 ? -0.14 : 0;
    if (GM.down === 3) pp = GM.togo >= 7 ? 0.86 : GM.togo >= 4 ? 0.66 : GM.togo <= 1 ? 0.28 : 0.42;
    if (GM.down === 4) pp = GM.togo <= 2 ? 0.42 : 0.86;
    if (GM.ball >= 95) pp -= 0.12;
    if (lead < -8 && GM.q >= 3) pp += 0.12;
    if (GM.q === 4 && lead < 0 && GM.clock <= 240) pp = Math.max(pp, 0.82);
    if (GM.q === 4 && lead > 0 && GM.clock <= 420) pp -= 0.28;
    if (two && lead <= 0) pp = Math.max(pp, 0.85);
    const qbv = P.QB ? (P.QB.at.sac + P.QB.at.mac + P.QB.at.awr) / 3 : 60, rbv = P.RB ? P.RB.ovr : 60;
    pp += clamp((qbv - rbv) / 80, -0.08, 0.08);
    const dt = GM.dtend[other(s)], dTot = Object.values(dt).reduce((a, b) => a + b, 0) || 1;
    const blitzy = ((dt.blitz || 0) + (dt.c0 || 0) + (dt.c1f || 0)) / dTot, boxy = ((dt.bear || 0) + (dt.c3b || 0)) / dTot;
    pp += boxy * 0.06;
    pp += (MOD(GM, s).pass || 0);
    pp = clamp(pp, 0.08, 0.96);
    const st = GM.style[s];
    // run-pass options for spread teams on early downs and short yardage
    if ((st.rpo || 0) > 0 && GM.down <= 3 && GM.togo <= 10 && GM.ball < 95 && !two && chance(st.rpo * (GM.down === 3 ? 0.5 : 1))) {
      return Object.assign(out, { k: 'rpo', t: 'rpo', dir: pick(['L', 'M', 'R']) });
    }
    if (chance(pp) && !(st === DY.STYLES.option && chance(0.5))) {
      let w = { quick: 0.32, med: 0.30, deep: 0.15, screen: 0.10, pa: 0.13 };
      if (GM.down === 3 && GM.togo >= 7) w = { quick: 0.16, med: 0.46, deep: 0.26, screen: 0.08, pa: 0.04 };
      if (GM.togo <= 4) { w.quick += 0.2; w.deep -= 0.06; }
      if (GM.down === 1 && boxy > 0.3) w.pa += 0.15;
      if (blitzy > 0.3) { w.screen += 0.1; w.quick += 0.1; }
      if (GM.ball >= 88) { w.deep = 0.08; w.screen = 0.04; w.pa += 0.05; }
      if (two) { w.screen = 0.03; w.pa = 0.03; w.med += 0.1; }
      if (lead > 14 && GM.q === 4) w.deep = 0.04;
      const t = wpick(Object.keys(w), k => w[k]);
      return Object.assign(out, { k: 'pass', t });
    }
    const qbRun = P.QB && P.QB.at.spd >= 80 ? 0.24 : P.QB && P.QB.at.spd >= 72 ? 0.1 : 0.03;
    const t = wpick(['in', 'out', 'qb'], x => x === 'in' ? 0.56 : x === 'out' ? 0.30 : qbRun * (st === DY.STYLES.option ? 2.5 : 1) + (st === DY.STYLES.option ? 0.5 : 0));
    if (st === DY.STYLES.option) { const play = t === 'qb' ? pick(['Triple Option', 'Triple Option', 'Midline Option', 'Speed Option']) : t === 'in' ? pick(['Inside Zone', 'Trap', 'Counter']) : pick(['Rocket Toss', 'Toss Crack', 'Jet Sweep']); return Object.assign(out, { k: 'run', t, dir: pick(['L', 'R']), play }); }
    const ol = P.OL, side = { L: avg([ol[0].at.rbk, ol[1].at.rbk]), M: avg([ol[1].at.rbk, ol[2].at.rbk, ol[3].at.rbk]), R: avg([ol[3].at.rbk, ol[4].at.rbk, (P.TE ? P.TE.at.rbk : 50)]) };
    let dir = wpick(['L', 'M', 'R'], d => Math.pow(1.08, side[d] - 70) * (t === 'out' && d === 'M' ? 0 : 1));
    if (GM.ball >= 97 && t !== 'out') dir = chance(0.5) ? 'M' : dir;
    return Object.assign(out, { k: 'run', t, dir });
  };
  /* ---------- fourth down: expected points, then the scoreboard and the clock ---------- */
  // expected points of a first down at a yard line (own goal line = 0)
  DY.EP = b => clamp(-1.25 + b * 0.068 + Math.max(0, b - 80) * 0.035, -1.6, 6.3);
  DY.convProb = (GM, s, togo) => {
    const base = togo <= 10 ? [0, 0.73, 0.61, 0.54, 0.48, 0.43, 0.39, 0.35, 0.32, 0.29, 0.26][Math.max(1, togo)] : Math.max(0.1, 0.26 - (togo - 10) * 0.012);
    const edge = (GM.ovr[s].off - GM.ovr[other(s)].def) * 0.008;
    return clamp(base + edge + (GM.ball >= 95 ? -0.04 : 0), 0.05, 0.9);
  };
  DY.fourthDown = (GM, s) => {
    const P = pers(GM, s), lead = GM.score[s] - GM.score[other(s)], late = GM.q === 4 && GM.clock <= 300;
    const fgDist = 100 - GM.ball + 17, pFG = fgDist <= 70 ? DY.fgProb(GM, P.K, fgDist) : 0;
    if (GM.q >= 5) return (GM.ot && GM.ot.needTD) || pFG < 0.35 || lead < -3 ? 'go' : (GM.togo <= 1 && chance(0.4) ? 'go' : 'fg');
    const p = DY.convProb(GM, s, GM.togo), EP = DY.EP;
    const kick = -EP(25);                         // the other team's drive after a kickoff
    const evGo = p * EP(Math.min(99, GM.ball + GM.togo + 1.5)) + (1 - p) * -EP(100 - GM.ball);
    const net = clamp(39 + ((P.P ? P.P.at.kpw : 65) - 70) * 0.3, 30, 46);
    const evPunt = 100 - GM.ball <= 38 ? -EP(20) : -EP(100 - Math.min(GM.ball + net, 90));
    const evFG = fgDist <= 70 ? pFG * (3 + kick) + (1 - pFG) * -EP(100 - Math.max(20, GM.ball - 7)) : -99;
    let go = evGo + (GM.aggr[s] - 0.55) * 0.8, punt = evPunt, fg = evFG;
    // the scoreboard and the clock change everything late
    const rem = GM.q === 4 ? GM.clock : GM.q === 3 ? GM.clock + 900 : 9999;
    if (rem <= 420 && lead < 0) {
      const needTD = lead < -3, poss = Math.ceil(rem / 150);
      if (needTD || rem <= 120) { punt -= 1.5 + (420 - rem) / 120; if (needTD) fg -= 2 + (420 - rem) / 100; }
      if (-lead > 8 * Math.max(1, poss - 1)) { go += 3; }
    }
    if (rem <= 300 && lead > 0) { go -= 0.6 + (lead <= 3 ? 0.3 : 0); if (GM.ball < 50) go -= 1.5; }
    if (GM.q === 2 && GM.clock <= 25) { fg += pFG > 0.3 ? 1 : 0; }
    if (late && lead < 0 && GM.clock <= 120) { if (lead >= -3 && pFG >= 0.35) fg += 2; }
    const best = Math.max(go, punt, fg);
    return best === go ? 'go' : best === fg ? 'fg' : 'punt';
  };
  DY.aiPat = (GM, s) => {
    const lead = GM.score[s] - GM.score[other(s)];
    if (GM.ot && GM.ot.n >= 2) return '2pt';
    if (GM.q === 4 && GM.clock <= 600 && [-2, -5, -10, -9, 1, 5, -16].includes(lead)) return '2pt';
    if (GM.q === 4 && GM.clock <= 120 && lead === -1) return chance(0.35) ? '2pt' : 'xp';
    return 'xp';
  };

  /* ---------- helpers ---------- */
  DY.spotName = (GM, s, ball) => { const tm = GM.T[s], op = GM.T[other(s)]; ball = Math.round(ball); if (ball === 50) return '50'; return ball < 50 ? tm.abbr + ' ' + ball : op.abbr + ' ' + (100 - ball); };
  DY.downStr = (d, togo, ball) => ['', '1st', '2nd', '3rd', '4th'][d] + ' & ' + (ball + togo >= 100 ? 'Goal' : togo);
  const clockStr = c => Math.floor(c / 60) + ':' + String(Math.floor(c % 60)).padStart(2, '0');
  DY.clockStr = clockStr;
  function tempoSecs(GM, s, call) {
    const base = GM.style[s].tempo + gauss() * 2.5;
    const tempo = (call && call.tempo) || (GM.hurry[s] ? 'hurry' : GM.chew[s] ? 'chew' : null);
    if (tempo === 'hurry') return rr(11, 16);
    if (tempo === 'chew') return rr(36, 40);
    return clamp(base, 12, 40);
  }
  const in2min = GM => (GM.q === 2 || GM.q === 4) && GM.clock <= 120;
  function weighted(list, f) { return wpick(list.filter(Boolean), f); }

  /* ---------- the snap ---------- */
  // call: offense call for the user's side when it is on offense; dcall: defensive call for the user's side on defense.
  DY.needs = GM => {
    if (GM.over) return 'final';
    if (GM.user && GM.coach !== 'watch' && !GM.planSet) return 'plan';
    if (GM.user && GM.coach !== 'watch' && GM.halftime) return 'half';
    if (GM.next === 'pat') return GM.user === GM.poss && GM.coach !== 'watch' ? 'pat' : null;
    if (GM.next !== 'scrim') return null;
    if (GM.user === GM.poss && GM.coach !== 'watch') return 'off';
    if (GM.user === other(GM.poss) && GM.coach === 'full') return 'def';
    return null;
  };
  DY.step = (GM, uc) => {
    uc = uc || {};
    if (GM.over) return null;
    if (!GM.planSet) { if (GM.user && uc.plan && DY.PLANS[uc.plan]) GM.plan[GM.user] = uc.plan; GM.planSet = true; }
    if (GM.halftime) {
      for (const sd of ['h', 'a']) GM.adj[sd] = sd === GM.user && uc.adj ? Object.assign({ o: 'none', d: 'none' }, uc.adj) : DY.aiAdjust(GM, sd);
      GM.halftime = false;
    }
    let res;
    const di0 = GM.drives.length - 1;
    if (GM.next === 'kick') res = kickoff(GM, false);
    else if (GM.next === 'free') res = kickoff(GM, true);
    else if (GM.next === 'pat') res = pat(GM, uc.pat);
    else if (GM.next === 'ot') res = otStart(GM);
    else res = scrimmage(GM, uc);
    if (res) { res.di = res.type === 'kick' ? GM.drives.length - 1 : di0; res.q = res.q || GM.q; GM.plays.push(res); if (GM.plays.length > 400) GM.plays.shift(); }
    return res;
  };

  function startDrive(GM, s, how) { GM.drive = { s, start: GM.ball, q: GM.q, clock: GM.clock, plays: 0, yds: 0, how, res: null }; GM.drives.push(GM.drive); }
  function endDrive(GM, res) { if (GM.drive && !GM.drive.res) { GM.drive.res = res; GM.drive.endClock = GM.clock; GM.drive.endQ = GM.q; } }
  function changePoss(GM, newBall, how) {
    GM.poss = other(GM.poss); GM.ball = Math.round(clamp(newBall, 1, 99)); GM.down = 1; GM.togo = Math.min(10, 100 - GM.ball); GM.running = false;
    startDrive(GM, GM.poss, how);
  }
  function score(GM, s, pts) {
    GM.score[s] += pts;
    const qi = Math.min(GM.q, 5) - 1;
    if (qi < 4) GM.lineScore[s][qi] += pts; else { GM.lineScore[s][4] = (GM.lineScore[s][4] || 0) + pts; }
  }
  function swing(GM, s, v) { GM.mom = clamp(GM.mom + (s === 'h' ? v : -v), -1, 1); }

  /* kickoffs and free kicks */
  function kickoff(GM, free) {
    const ks = GM.kicker, rs = other(ks), KP = pers(GM, ks), RP = pers(GM, rs), K = KP.K, KR = RP.KR;
    const lead = GM.score[ks] - GM.score[rs];
    GM.poss = rs;
    const onside = !free && GM.q === 4 && GM.clock <= 180 && lead < 0 && lead >= -16;
    let text, anim, ball, recovered = false;
    if (onside) {
      recovered = chance(0.11);
      ball = recovered ? 55 : 45;
      text = `${GM.T[ks].abbr} onside kick... ${recovered ? 'RECOVERED by ' + GM.T[ks].name + '!' : 'recovered by ' + GM.T[rs].name + '.'}`;
      anim = { kind: 'onside', from: 35, rec: recovered };
      GM.clock = Math.max(0, GM.clock - 3);
      if (recovered) { GM.poss = ks; GM.ball = 45; GM.down = 1; GM.togo = 10; GM.running = false; startDrive(GM, ks, 'onside'); swing(GM, ks, 0.4); GM.next = 'scrim'; return { type: 'kick', text, anim, s: ks, big: true, tag: 'ONSIDE' }; }
      GM.ball = 100 - 45 - 10 + 10; // ball at the kicking team's 45 (from the receivers' view: their 55)
      GM.ball = 55; GM.down = 1; GM.togo = 10; GM.running = false; startDrive(GM, rs, 'onside'); GM.next = 'scrim';
      return { type: 'kick', text, anim, s: rs, tag: 'ONSIDE' };
    }
    const from = free ? 20 : 35 - (GM.kickPen ? 15 : 0); GM.kickPen = 0;
    const dist = clamp(61 + ((K ? K.at.kpw : 65) - 70) * 0.42 + gauss() * 4.5 - (free ? 14 : 0), 38, 78);
    const land = 100 - from - dist; // receivers' yard line (negative = in the end zone)
    let ret = 0, td = false, fumble = false, tb = false, fc = false;
    if (land <= 0 && chance(0.82)) tb = true;
    else if (land > 0 && land <= 25 && chance(0.35)) fc = true;
    else if (GM.live && DY.SIM && KR) {
      const sim = DY.SIM.returnPlay(GM, rs, { kind: 'kick', land: Math.max(1, land), hang: 3.6, returner: KR });
      ret = sim.ret; td = sim.td; fumble = sim.fum && chance(0.5); GM.liveRet = sim;
      if (sim.tackler) add(GM, sim.tackler, 'tk');
    }
    else {
      const rv = KR ? (E(GM, KR, 'spd', rs) * 0.45 + E(GM, KR, 'acc', rs) * 0.2 + E(GM, KR, 'elu', rs) * 0.35) : 60;
      ret = clamp(21 + (rv - 75) / 3.2 + gauss() * 7, 4, 45);
      if (chance(0.025 + (rv - 80) / 1500)) ret += rr(15, 45);
      if (chance(0.0045 + Math.max(0, rv - 85) / 2500)) ret = 110;
      if (chance(0.006)) fumble = true;
    }
    const kicker = GM.T[ks].abbr;
    if (tb) { ball = 25; text = `${last(K)} kicks off ${Math.round(dist)} yards into the end zone. Touchback.`; }
    else if (fc) { ball = 25; text = `${last(K)} kicks ${Math.round(dist)} yards, fair catch at the ${Math.round(land)}. Ball at the 25.`; }
    else {
      ball = Math.round(Math.max(1, land) + ret);
      if (ball >= 100) { td = true; }
      text = `${last(K)} kicks ${Math.round(dist)} yards. ${last(KR)} returns ${td ? 'it ALL THE WAY' : Math.round(ret) + ' yards to the ' + DY.spotName(GM, rs, Math.min(99, ball))}.`;
      add(GM, KR, 'kr'); add(GM, KR, 'kry', Math.round(Math.min(ret, 100 - Math.max(1, land))));
      GM.clock = Math.max(0, GM.clock - Math.round(4 + ret / 8));
    }
    GM.running = false;
    anim = { kind: 'kick', from, land, end: td ? 100 : ball, tb, fc, ret, kicking: ks };
    if (GM.liveRet) { anim.trk = GM.liveRet.trk; GM.liveRet = null; }
    GM.by = 26.67;
    if (fumble && !td) {
      const rec = chance(0.5);
      text += ` FUMBLE on the return!${rec ? ' ' + GM.T[ks].name + ' recovers!' : ' ' + GM.T[rs].name + ' falls on it.'}`;
      if (rec) { GM.poss = ks; GM.ball = 100 - ball; GM.down = 1; GM.togo = 10; startDrive(GM, ks, 'fumble'); swing(GM, ks, 0.35); GM.next = 'scrim'; add(GM, KR, 'fum'); return { type: 'kick', text, anim, s: ks, big: true, tag: 'FUMBLE' }; }
    }
    if (td) {
      GM.ball = 100; startDrive(GM, rs, 'kick'); text += ` TOUCHDOWN ${GM.T[rs].name}!`;
      add(GM, KR, 'rttd'); score(GM, rs, 6); endDrive(GM, 'TD'); swing(GM, rs, 0.4); GM.next = 'pat';
      return { type: 'kick', text, anim, s: rs, big: true, tag: 'TOUCHDOWN', td: true };
    }
    GM.ball = Math.round(clamp(ball, 1, 99)); GM.down = 1; GM.togo = 10; startDrive(GM, rs, 'kick'); GM.next = 'scrim';
    return { type: 'kick', text, anim, s: rs, kick: kicker };
  }

  function pat(GM, choice) {
    const s = GM.poss, P = pers(GM, s);
    choice = choice || DY.aiPat(GM, s);
    let ok, text, anim;
    if (choice === '2pt') {
      const call = GM.user === s && GM.patCall ? GM.patCall : (chance(0.55) ? { k: 'pass', t: 'quick' } : { k: 'run', t: 'in', dir: 'M' });
      GM.patCall = null;
      const keep = { ball: GM.ball, down: GM.down, togo: GM.togo };
      GM.ball = 97; GM.down = 1; GM.togo = 3;
      const r = resolve(GM, s, call, DY.aiDef(GM, other(s)), true);
      ok = r.yards >= 3 && !r.turnover;
      text = `Two-point try: ${r.short} ${ok ? '— GOOD!' : '— no good.'}`;
      anim = r.anim; anim.pat = true;
      Object.assign(GM, keep);
      if (ok) { score(GM, s, 2); if (r.passer) add(GM, r.passer, 'p2'); if (r.carrier) add(GM, r.carrier, 'x2'); }
    } else {
      const p = clamp(0.945 + ((P.K ? P.K.at.kac : 65) - 70) / 300 + (GM.crowd && s === 'a' ? -0.01 : 0), 0.82, 0.995);
      ok = chance(p);
      add(GM, P.K, 'xpa'); if (ok) { add(GM, P.K, 'xpm'); score(GM, s, 1); }
      text = `${last(P.K)} extra point is ${ok ? 'good' : chance(0.3) ? 'BLOCKED!' : 'no good — wide ' + (chance(0.5) ? 'left' : 'right')}.`;
      anim = { kind: 'xp', ok };
    }
    GM.next = 'kick'; GM.kicker = s;
    if (GM.ot) { GM.next = 'scrim'; return otAfterPoss(GM, { type: 'pat', text, anim, s, ok, two: choice === '2pt' }); }
    return { type: 'pat', text, anim, s, ok, two: choice === '2pt' };
  }

  /* overtime (college): each team gets a possession from the 25; 2OT on must go for two; 3OT on alternating two-point plays */
  function otStart(GM) {
    if (!GM.ot) GM.ot = { n: 1, first: other(GM.tossWinner), done: 0 };
    const o = GM.ot;
    GM.q = 4 + o.n; GM.clock = 0; GM.to = { h: 1, a: 1 };
    GM.poss = o.done === 0 ? o.first : other(o.first);
    GM.ot.needTD = o.n >= 2;
    if (o.n >= 3) { GM.ball = 97; GM.down = 1; GM.togo = 3; o.shootout = true; }
    else { GM.ball = 75; GM.down = 1; GM.togo = 10; o.shootout = false; }
    startDrive(GM, GM.poss, 'OT'); GM.next = 'scrim';
    return { type: 'ot', text: `${o.n === 1 ? 'OVERTIME' : (o.n === 2 ? 'DOUBLE' : o.n === 3 ? 'TRIPLE' : o.n + 'X') + ' OVERTIME'}: ${GM.T[GM.poss].name} ball ${o.shootout ? 'for a two-point play' : 'at the 25'}.`, anim: { kind: 'none' }, s: GM.poss, tag: o.n === 1 ? 'OVERTIME' : o.n + 'OT' };
  }
  function otAfterPoss(GM, res) {
    const o = GM.ot;
    o.done++;
    if (o.done >= 2) {
      if (GM.score.h !== GM.score.a) { GM.over = true; GM.next = 'final'; res.final = true; return res; }
      o.n++; o.done = 0;
    }
    GM.next = 'ot';
    return res;
  }

  function scrimmage(GM, uc) {
    const s = GM.poss, d = other(s);
    // timeouts before the snap (yours or the CPU's)
    let toText = '';
    const callTO = side => { if (GM.to[side] > 0 && GM.running) { GM.to[side]--; GM.running = false; toText += `Timeout, ${GM.T[side].name} (${GM.to[side]} left). `; return true; } return false; };
    if (uc.timeout && GM.user) callTO(GM.user);
    GM.lastRunoff = null;
    GM.puntRush = GM.user === d && GM.coach === 'full' && uc.dcall && uc.dcall.st === 'block' ? d : null;
    cpuTimeouts(GM, callTO);
    // play clock runoff
    if (GM.running && GM.q <= 4) {
      const ro = tempoSecs(GM, s, GM.user === s ? uc.call : null);
      GM.lastRunoff = ro;
      if (ro >= GM.clock) { GM.ts[s].top += GM.clock; GM.clock = 0; return endQuarter(GM, toText); }
      GM.clock -= ro; GM.ts[s].top += ro;
    }
    // pre-snap penalties
    const pre = preSnap(GM, s);
    if (pre) { pre.text = toText + pre.text; return pre; }
    // the calls
    const ocall = (GM.user === s && GM.coach !== 'watch' && uc.call) ? uc.call : DY.aiOff(GM, s);
    if (GM.user === s && ocall.tempo) { GM.hurry[s] = ocall.tempo === 'hurry'; GM.chew[s] = ocall.tempo === 'chew'; }
    else if (GM.user !== s) { GM.hurry[s] = ocall.tempo === 'hurry'; GM.chew[s] = ocall.tempo === 'chew'; }
    let dcall = (GM.user === d && GM.coach === 'full' && uc.dcall) ? resolveDcall(uc.dcall, GM) : DY.aiDef(GM, d);
    if (GM.ot && GM.ot.shootout && ocall.k !== 'run' && ocall.k !== 'pass') { ocall.k = 'pass'; ocall.t = 'quick'; }
    GM.dtend[d][dcall.dgroup || dcall.d] = (GM.dtend[d][dcall.dgroup || dcall.d] || 0) + 1;
    if (dcall.d === 'c0' || dcall.d === 'c1f') GM.dtend[d].blitz = (GM.dtend[d].blitz || 0) + 1;
    const startBall = GM.ball, startDown = GM.down, startTogo = GM.togo, startQ = GM.q, startClock = GM.clock;
    let r;
    if (ocall.k === 'punt') r = punt(GM, s);
    else if (ocall.k === 'fg') r = fieldGoal(GM, s);
    else if (ocall.k === 'kneel') r = { kind: 'kneel', yards: -1, time: 3, stop: false, text: `${last(pers(GM, s).QB)} takes a knee.`, short: 'kneel', anim: { kind: 'kneel' } };
    else if (ocall.k === 'spike') r = { kind: 'spike', yards: 0, time: 2, stop: true, inc: true, text: `${last(pers(GM, s).QB)} spikes the ball to stop the clock.`, short: 'spike', anim: { kind: 'spike' } };
    else r = resolve(GM, s, ocall, dcall, false);
    // record tendencies (the defense learns from these)
    if (ocall.k === 'run' || ocall.k === 'pass') {
      const k = startTogo <= 3 && startDown >= 2 ? 's' : (startTogo >= 7 && startDown >= 2) ? 'l' : 'e';
      GM.tend[s][k][ocall.k === 'pass' ? 1 : 0]++;
      if (ocall.k === 'run') GM.tend[s].dir[ocall.dir || 'M']++; else GM.tend[s].pt[ocall.t]++;
      GM.lastCall[s].push(ocall.k + (ocall.t || '') + (ocall.dir || '')); if (GM.lastCall[s].length > 6) GM.lastCall[s].shift();
    }
    return applyResult(GM, s, r, { ocall, dcall, startBall, startDown, startTogo, startQ, startClock, toText });
  }
  // your defensive call: a group (the staff picks the package) or a specific package
  function resolveDcall(g, GM) {
    const key = typeof g === 'string' ? g : g.g, item = typeof g === 'object' && g.k ? g.k : null;
    const P = DY.DPKG[key];
    if (P) {
      let it = item ? P.items.find(x => x.k === item) : null;
      if (!it) {
        // auto: fit the down and distance
        const long = GM && GM.down >= 3 && GM.togo >= 7, short = GM && GM.togo <= 2, goal = GM && GM.ball >= 96;
        const pool = P.items.filter(x => (x.pkg !== 'goal' || goal || short) && !(key === 'man' && x.d === 'c0' && !short && !goal));
        it = pool.length ? (long && key === 'zone' ? pool.find(x => x.d === 'c4') || pick(pool) : pick(pool)) : P.items[0];
      }
      return { d: it.d, pkg: it.pkg || (GM && GM.down >= 3 && GM.togo >= 9 && key !== 'run' ? 'dime' : null), lean: pick(['L', 'M', 'R']), dgroup: key, dname: it.name };
    }
    const grp = DY.DCALLS[key] || DY.DCALLS.bal;
    return { d: pick(grp.keys), lean: pick(['L', 'M', 'R']), dgroup: key };
  }
  function cpuTimeouts(GM, callTO) {
    if (!GM.running || GM.q > 4) return;
    for (const side of ['h', 'a']) {
      if (GM.user === side && GM.coach !== 'watch') continue;
      const lead = GM.score[side] - GM.score[other(side)], onD = side !== GM.poss;
      // defense trying to get the ball back
      if (onD && GM.q === 4 && lead <= 0 && GM.clock <= 170 && GM.clock > 5) { if (callTO(side)) return; }
      if (onD && GM.q === 4 && lead < 0 && lead >= -16 && GM.clock <= 300 && GM.to[side] >= 2 && GM.down >= 2) { if (callTO(side)) return; }
      // offense in a two-minute drill
      if (!onD && in2min(GM) && lead <= (GM.q === 2 ? 14 : 0) && GM.clock <= 75 && GM.ball >= 35 && GM.clock > 3) { if (callTO(side)) return; }
      if (!onD && GM.q === 2 && GM.clock <= 30 && GM.ball >= 55 && GM.clock > 2) { if (callTO(side)) return; }
    }
  }

  function preSnap(GM, s) {
    const P = pers(GM, s), D = pers(GM, other(s)), road = s === 'a' ? GM.crowd : 0;
    const olDisc = avg(P.OL.map(p => p.tr.disc)), qb = P.QB;
    const loud = road > 0.75 && GM.big;
    const fs = 0.016 + road * 0.019 + (60 - olDisc) / 2400 + (GM.down === 3 ? road * 0.01 : 0);
    const dg = 0.0025 + road * 0.009 + (qb ? (60 - qb.tr.lead) / 3500 : 0);
    const off = 0.008 + (60 - avg(D.DL.map(p => p.tr.disc))) / 3000;
    let text, yds, on, who;
    if (chance(fs)) {
      who = chance(0.85) ? pick(P.OL) : pick([P.TE, ...P.WR]);
      const why = road > 0.6 ? (chance(0.5) ? `the ${GM.T.h.name} crowd got to him` : 'he could not hear the snap count') : who.yr === 1 ? 'young-player jitters' : who.tr.disc < 58 ? 'his discipline let him down again' : 'jumped early';
      text = `False start, #${who.num} ${last(who)} — ${why}. 5-yard penalty.`; yds = -5; on = s; GM.jump = 1;
    } else if (chance(dg)) {
      text = road > 0.6 ? `Delay of game on ${GM.T[s].name}. ${last(qb)} could not get the play in over the noise.` : `Delay of game, ${GM.T[s].name}.`; yds = -5; on = s;
    } else if (chance(off)) {
      who = pick(D.DL); text = `Offside, #${who.num} ${last(who)} (${GM.T[other(s)].abbr}). 5 yards.`; yds = 5; on = other(s);
    } else return null;
    if (who) add(GM, who, 'pen');
    GM.ts[on].pen++; GM.ts[on].peny += 5;
    const before = GM.ball;
    GM.ball = clamp(GM.ball + (yds > 0 ? Math.min(5, (100 - GM.ball) / 2) : -Math.min(5, GM.ball / 2)), 1, 99);
    GM.togo = Math.max(1, GM.togo - (GM.ball - before));
    if (GM.togo <= 0 || (yds > 0 && GM.ball - before >= GM.togo + (GM.ball - before))) { /* noop */ }
    if (yds > 0 && GM.togo <= 0) { GM.down = 1; GM.togo = Math.min(10, 100 - GM.ball); }
    GM.running = false;
    if (GM.drive) GM.drive.plays++;
    const shake = loud && GM.down === 3;
    return { type: 'pen', text, anim: { kind: 'pen', on }, s, pen: true, shake, tag: 'FLAG', ballBefore: before, ballAfter: GM.ball };
  }

  /* ---------- Index grades (a PFF-style grade from what each player did on each snap) ----------
     Every player on the field gets the snap; credit and blame go to the players involved: the passer's decision and result,
     the ball carrier's yards over expected and broken tackles, the target's catch or drop, the tackler, the defender in coverage,
     the rusher who got home and the blocker who lost (in a live game the 22-man simulation adds blocks held and lost, whiffs and
     missed tackles). A game grade is 0-100: about 60-65 is average, 80+ is very good, 90+ is elite. */
  function gradePlay(GM, s, r, O, D) {
    if (!r) return;
    const G_ = (p, v) => { if (p && v) add(GM, p, 'gv', Math.round(v * 100) / 100); };
    const need = GM.down >= 3 ? GM.togo : GM.down === 2 ? GM.togo * 0.6 : GM.togo * 0.45;
    const y = r.yards || 0, succ = y >= need || r.td;
    const OL = O.OL || [];
    if (r.kind === 'run') {
      const c = r.carrier;
      G_(c, clamp((y - 3.5) / 5, -0.8, 1.6) + (r.broke && !r.sim ? 0.4 : 0) + (r.fum ? -2 : 0) + (succ ? 0.2 : -0.1));
      if (!r.sim) OL.forEach(p => G_(p, clamp((y - 3) / 8, -0.4, 0.4) * 0.3));
      if (r.tackler) G_(r.tackler, (y <= 0 ? 1.0 : y <= 2 ? 0.5 : y <= 5 ? 0.2 : 0.05) + (r.fum ? 1.2 : 0));
      if (r.ast) G_(r.ast, 0.2);
      if (y >= 12) [...(D.LB || []), ...(D.S || [])].forEach(p => G_(p, -0.2));
    } else if (r.kind === 'pass') {
      const air = r.air || 0;
      G_(r.passer, clamp(0.25 + (y - 6) / 12 + air / 25, -0.4, 1.8) + (succ ? 0.25 : 0));
      G_(r.target, clamp(0.3 + (y - air) / 10, 0, 1.2) + (r.fum ? -2 : 0));
      if (r.defender) G_(r.defender, -clamp(0.2 + y / 20, 0.2, 1.2));
      if (r.tackler) G_(r.tackler, (y <= 3 ? 0.4 : 0.1) + (r.fum ? 1.2 : 0));
      if (!r.sim) OL.forEach(p => G_(p, 0.03));
    } else if (r.kind === 'inc') {
      if (r.drop) { G_(r.target, -1.4); G_(r.passer, 0.2); }
      else if (!r.away && r.target) G_(r.passer, -0.3);
      if (r.defender) G_(r.defender, r.drop ? 0 : 0.8);
      if (!r.sim) OL.forEach(p => G_(p, r.pressured ? -0.12 : 0.02));
    } else if (r.kind === 'int') { G_(r.passer, -2); G_(r.defender, 2); G_(r.target, -0.3); }
    else if (r.kind === 'dpi') { G_(r.defender, -1.5); G_(r.target, 0.4); }
    else if (r.kind === 'sack') { G_(r.passer, -0.5); G_(r.sackBy || r.tackler, 1.6); if (!r.sim) OL.forEach(p => G_(p, -0.25)); }
    if (r.flagHold) G_(r.flagHold, -1.4);
    if (r.gr) for (const id in r.gr) G_(DY.P(+id), r.gr[id]);
  }
  // a game or season grade from the summed play credit and the snaps played
  DY.GRADE_K = { QB: 0.36, RB: 0.55, WR: 0.8, TE: 0.85, OT: 1.0, IOL: 1.0, EDGE: 0.85, DT: 0.95, LB: 0.9, CB: 0.85, S: 0.95, K: 1, P: 1 };
  DY.gradeOf = (l, pos) => { if (!l || !(l.sn >= 6)) return null; const v = (l.gv || 0) * (DY.GRADE_K[pos] || 0.9) / Math.sqrt(l.sn); return Math.round(clamp(62 + 36 * Math.tanh(v * 1.1), 30, 99.5) * 10) / 10; };
  DY.gradeCls = g => g == null ? '' : g >= 90 ? 'g-elite' : g >= 80 ? 'g-high' : g >= 70 ? 'g-good' : g >= 60 ? 'g-avg' : 'g-low';

  /* ---------- run and pass resolution ---------- */
  function resolve(GM, s, call, dc, isTry) {
    const d = other(s), O = pers(GM, s), D = pers(GM, d), def = DY.DEFS[dc.d] || DY.DEFS.c3;
    const read = dc.read && dc.read === call.k + (call.t || '') + (call.dir || '') ? 1 : 0;
    if (call.k === 'rpo') call.t = 'rpo';
    const fk = call.f && DY.FORMS[call.f] ? call.f : DY.aiForm(GM, s, call);
    const F = DY.FORMS[fk], book = DY.BOOK[call.t] || DY.BOOK.in;
    markSnapF(GM, O, F); markDef(GM, D);
    const pl = (call.play && book.find(b => b.n === call.play)) || pick(book);
    // a live game on screen: the 22-man simulation plays the snap
    if (GM.live && DY.SIM && (call.k === 'run' || call.k === 'pass' || call.k === 'rpo')) {
      let pm0 = pl.beats.includes(dc.d) ? 1 : pl.weak.includes(dc.d) ? -1 : 0;
      if (pl.counter && dc.lean && dc.lean === call.dir) pm0 = 1.2;
      const ctx0 = { F, fk, pl, pname: pl.n, pm: pm0, dp: DY.DPERS[dc.pkg || F.dpers] || DY.DPERS.nickel, mo: MOD(GM, s), md: MOD(GM, d) };
      if (call.k === 'rpo') call.run = pl.run || 'Inside Zone';
      const r = DY.SIM.play(GM, s, O, D, call, dc, def, ctx0);
      r.play = pl.n + (call.k === 'run' && call.dir ? ' ' + { L: 'Left', M: 'Middle', R: 'Right' }[call.dir] : ''); r.form = F.name; r.cov = def.name + ' · ' + ctx0.dp.name; r.call = call; r.dcall = dc; r.pm = pm0;
      r.anim = Object.assign(r.anim || {}, { f: fk });
      if (pm0 > 0 && chance(0.3)) r.events.push(`${pl.n} was the right call against ${def.name}.`);
      gradePlay(GM, s, r, O, D);
      return r;
    }
    // the fast model: an RPO is a run or a quick throw depending on the box
    if (call.k === 'rpo') { const heavy = def.box >= 0.8; call = Object.assign({}, call, heavy ? { k: 'pass', t: 'quick' } : { k: 'run', t: 'in', dir: call.dir || 'M' }); }
    let pm = pl.beats.includes(dc.d) ? 1 : pl.weak.includes(dc.d) ? -1 : 0;
    if (pl.counter && dc.lean && dc.lean === call.dir) pm = 1.2;
    const ctx = { F, fk, pl, pm, dp: DY.DPERS[dc.pkg || F.dpers] || DY.DPERS.nickel, mo: MOD(GM, s), md: MOD(GM, d) };
    const playName = pl.n + (call.k === 'run' && call.dir ? ' ' + { L: 'Left', M: 'Middle', R: 'Right' }[call.dir] : '');
    const r = call.k === 'run' ? runPlay(GM, s, O, D, call, dc, def, read, ctx) : passPlay(GM, s, O, D, call, dc, def, read, ctx);
    r.play = playName; r.form = F.name; r.cov = def.name + ' · ' + ctx.dp.name; r.call = call; r.dcall = dc; r.pm = pm;
    r.anim = Object.assign(r.anim || {}, { f: fk });
    if (pm > 0 && chance(0.35)) r.events.push(`${pl.n} was the right call against ${def.name}.`);
    if (read && chance(0.5)) r.events.push(`${GM.T[d].abbr} saw it coming — they have been sitting on that call.`);
    gradePlay(GM, s, r, O, D);
    return r;
  }
  function tacklerFor(D, yards, kind) {
    const front = [...D.DL], lbs = D.LB, back = [...D.CB, D.NB, ...D.S];
    let pool; const r = rnd();
    if (yards <= 1) pool = r < 0.5 ? front : r < 0.85 ? lbs : back;
    else if (yards <= 8) pool = r < 0.42 ? lbs : r < 0.8 ? back : front;
    else pool = r < 0.2 ? lbs : back;
    if (kind === 'short') pool = r < 0.6 ? [...D.CB, D.NB, ...D.S] : lbs;
    return weighted(pool, p => (p.at.tak || 50) + (p.at.pur || 50) - 60);
  }
  function runPlay(GM, s, O, D, call, dc, def, read, ctx) {
    ctx = ctx || { F: DY.FORMS.trips, pm: 0, dp: DY.DPERS.nickel, mo: NOMOD, md: NOMOD };
    const t = call.t, dir = call.dir || 'M', ev = [];
    const car = t === 'qb' ? O.QB : O.RB;
    const ol = O.OL, te = O.TE;
    const blk = dir === 'L' ? [ol[0], ol[1]] : dir === 'R' ? [ol[3], ol[4], te] : [ol[1], ol[2], ol[3]];
    const fr = dir === 'L' ? [D.DL[3], D.DL[2]] : dir === 'R' ? [D.DL[1], D.DL[0]] : [D.DL[1], D.DL[2]];
    if (ctx.F.te >= 2 && dir !== 'L') blk.push(O.TE2);
    if (ctx.F.rb >= 2) blk.push(O.FB);
    const olv = avg(blk.filter(Boolean).map(p => E(GM, p, 'rbk', s) * 0.72 + E(GM, p, 'str', s) * 0.28)) + ctx.F.run * 1.8 + (ctx.mo.run || 0) * 1.2;
    const dlv = avg(fr.map(p => E(GM, p, 'bsh', other(s)) * 0.55 + E(GM, p, 'str', other(s)) * 0.25 + E(GM, p, 'tak', other(s)) * 0.2));
    const lbv = avg(D.LB.map(p => E(GM, p, 'tak', other(s)) * 0.4 + E(GM, p, 'prc', other(s)) * 0.35 + E(GM, p, 'pur', other(s)) * 0.25));
    let box = def.box + (dc.lean === dir ? 0.7 : 0) - (dc.lean && dc.lean !== dir && dc.lean !== 'M' ? 0.25 : 0) + read * 0.8 + ctx.dp.box + (ctx.md.box || 0) - ctx.pm * 0.55;
    if (t === 'qb') box -= (ctx.md.qbrun || 0) * 0.5;
    const ballSec = E(GM, car, 'car', s);
    let win, y;
    if (t === 'out') {
      const edge = dir === 'L' ? D.DL[3] : D.DL[0], cb = dir === 'L' ? D.CB[1] : D.CB[0];
      const sp = E(GM, car, 'spd', s) * 0.6 + E(GM, car, 'acc', s) * 0.4, ds = (E(GM, edge, 'spd', other(s)) * 0.5 + E(GM, edge, 'pur', other(s)) * 0.5) * 0.7 + E(GM, cb, 'tak', other(s)) * 0.3;
      win = (sp - ds) / 21 + (olv - dlv) / 27 - box * 0.25 + gauss() * 1.5;
      y = 3.0 + win * 2.6 + (E(GM, car, 'elu', s) - 76) / 32;
    } else if (t === 'qb') {
      const read2 = car.at.spd >= 80 && dir !== 'M' ? 0.35 : 0;
      win = (olv - dlv) / 17 + (olv - lbv) / 34 - box * 0.3 + read2 + (dir === 'M' && def.box < 0 ? 0.6 : 0) + gauss() * 1.25;
      y = 2.9 + win * 2.0 + (E(GM, car, 'spd', s) - 76) / 16;
    } else {
      win = (olv - dlv) / 17 + (olv - lbv) / 34 - box * 0.32 + gauss() * 1.12;
      y = 3.9 + win * 1.9 + (E(GM, car, 'bcv', s) - 76) / 26 + (E(GM, car, 'btk', s) - 76) / 38;
    }
    if (GM.ball >= 95) y = Math.min(y, y * 0.75 + 0.6);
    let tackler = tacklerFor(D, y, 'run'), broke = false, big = false;
    if (y > 0 && chance(clamp(0.10 + (E(GM, car, 'btk', s) - E(GM, tackler, 'tak', other(s))) / 230, 0.03, 0.24))) { broke = true; y += rr(2, 8); ev.push(`${last(car)} breaks the tackle of ${last(tackler)}.`); }
    if (y >= 7) {
      const sspd = avg(D.S.map(p => E(GM, p, 'spd', other(s))));
      const pb = clamp(0.06 + (E(GM, car, 'spd', s) - sspd) / 230 + (E(GM, car, 'elu', s) - 76) / 400, 0.02, 0.2) * (t === 'out' ? 1.3 : t === 'qb' ? 1.1 : 0.85);
      if (chance(pb)) { y += 8 + -Math.log(1 - rnd()) * 16; big = true; }
      tackler = tacklerFor(D, y, 'run');
    }
    y = Math.round(clamp(y, -7, 100));
    if (y < 0 && t !== 'qb' && chance(0.3)) ev.push(`${last(fr[0])} blew it up in the backfield.`);
    let fum = false;
    const hitter = tackler;
    if (chance(0.0085 * (1 + (72 - ballSec) / 22) * (hitter ? (hitter.at.hit || 60) / 75 : 1))) fum = true;
    const oob = t === 'out' ? chance(0.34) && y > 2 : chance(0.05);
    const text0 = `${last(car)} ${t === 'qb' ? (dir === 'M' ? 'keeps it up the middle' : 'keeps it ' + (dir === 'L' ? 'left' : 'right')) : t === 'out' ? 'runs wide ' + (dir === 'L' ? 'left' : 'right') : 'runs ' + ({ L: 'left', M: 'up the middle', R: 'right' }[dir])}`;
    return { kind: 'run', t, dir, carrier: car, tackler, yards: y, fum, oob, broke, big, events: ev, text0, time: Math.round(5 + Math.abs(y) / 6 + rnd() * 2), anim: { kind: 'run', t, dir, broke } };
  }
  function pickTarget(GM, s, O, D, t, def, hurried, ctx) {
    ctx = ctx || { F: DY.FORMS.trips, pm: 0, dp: DY.DPERS.nickel, mo: NOMOD, md: NOMOD };
    const F = ctx.F, deepish = t === 'deep' || t === 'pa';
    const routes = F.wr >= 3 || F.te >= 2 ? [
      { p: O.WR[0], role: 'WR1', cov: D.CB[0], depth: t === 'deep' ? 'd' : t === 'quick' ? 's' : t === 'pa' ? 'd' : 'm', w: 1.15 },
      { p: O.WR[1], role: 'WR2', cov: D.CB[1], depth: t === 'deep' ? 'd' : t === 'quick' ? 's' : 'm', w: 1.0 },
      { p: O.WR[2], role: 'WR3', cov: D.NB, depth: t === 'quick' ? 's' : t === 'deep' ? 'm' : t === 'pa' ? 'm' : 'm', w: 0.95 },
      { p: O.TE, role: 'TE', cov: D.LB[0], depth: t === 'quick' ? 's' : 'm', w: 0.75 },
      { p: O.RB, role: 'RB', cov: D.LB[1], depth: 's', w: t === 'deep' || t === 'pa' ? 0.08 : 0.15 },
    ] : [];
    // personnel changes who is out on routes
    if (F.wr < 3) { routes.splice(2, 1); if (F.te >= 2) routes.push({ p: O.TE2, role: 'TE2', cov: D.S[1], depth: deepish ? 'm' : 's', w: 0.7 }); }
    if (F.te === 0) { const i = routes.findIndex(r => r.role === 'TE'); if (i >= 0) routes.splice(i, 1); }
    if (F.wr >= 4) routes.push({ p: O.WR4, role: 'WR4', cov: D.S[1], depth: deepish ? 'd' : 'm', w: 0.85 });
    if (F.rb === 0) { const i = routes.findIndex(r => r.role === 'RB'); if (i >= 0) routes.splice(i, 1); }
    if (F.rb >= 2) routes.push({ p: O.FB, role: 'FB', cov: D.LB[1], depth: 's', w: 0.3 });
    if (!routes.length) routes.push({ p: O.WR[0], role: 'WR1', cov: D.CB[0], depth: 's', w: 1 });
    const red = GM.ball >= 80, sticks = GM.down >= 3 ? GM.togo : 0;
    routes.forEach(x => { if (!x.p) x.p = O.WR[0]; if (!x.cov) x.cov = D.CB[0]; });
    const qb = O.QB, noise = (100 - E(GM, qb, 'awr', s)) / 26 + (hurried ? 0.8 : 0);
    routes.forEach(rt => {
      const p = rt.p, c = rt.cov, man = def.man;
      const rskill = rt.depth === 'd' ? E(GM, p, 'drr', s) || p.ovr - 6 : E(GM, p, 'srr', s) || p.ovr - 6;
      const cskill = man ? E(GM, c, 'mcv', other(s)) : E(GM, c, 'zcv', other(s));
      let sep = (rskill * 0.5 + E(GM, p, 'spd', s) * 0.3 + (E(GM, p, 'rls', s) || 60) * 0.2 - (cskill * 0.6 + E(GM, c, 'spd', other(s)) * 0.25 + (E(GM, c, 'prc', other(s)) || 60) * 0.15)) / 16;
      sep += gauss() * 1.15;
      if (rt.depth === 'd') sep -= def.deep * 0.62; else if (rt.depth === 's') sep -= def.short * 0.5; else sep -= (def.short + def.deep) * 0.22;
      if (rt.depth === 'd' && man && p.at.spd > c.at.spd + 3) sep += 0.45;
      if (def.blitz && rt.depth !== 'd') sep += 0.35;
      if (rt.role === 'RB' || rt.role === 'FB') sep -= 0.1;
      // the play call against the coverage, personnel, the plan, and a compressed red zone
      sep += ctx.pm * 0.45 + F.sep + (ctx.mo.sep || 0) + (rt.depth === 's' ? (ctx.mo.sepS || 0) - (ctx.md.short || 0) * 0.4 : 0) + (rt.depth === 'd' ? (ctx.mo.sepD || 0) - (ctx.md.deep || 0) * 0.5 : 0) - ctx.dp.cov;
      if (t === 'pa') sep += (F.pa || 0) * 0.5 + (ctx.mo.pa || 0);
      if (red && rt.depth === 'd') sep -= 0.45; if (GM.ball >= 92) sep -= 0.3;
      const depthYds = rt.depth === 'd' ? 20 : rt.depth === 'm' ? 11 : 4;
      rt.sep = sep; rt.view = sep + gauss() * noise + Math.log(rt.w) + (sticks && depthYds >= sticks ? 0.6 : sticks ? -0.4 : 0);
    });
    if (hurried) routes.forEach(r => { if (r.depth !== 's') r.view -= 0.6; });
    return routes.sort((a, b) => b.view - a.view)[0];
  }
  function passPlay(GM, s, O, D, call, dc, def, read, ctx) {
    ctx = ctx || { F: DY.FORMS.trips, pm: 0, dp: DY.DPERS.nickel, mo: NOMOD, md: NOMOD };
    const t = call.t, ev = [], qb = O.QB, ds = other(s);
    // protection vs rush
    // the weakest link matters: the tackles against the edge rushers
    const pb = p => E(GM, p, 'pbk', s) * 0.7 + E(GM, p, 'agi', s) * 0.15 + E(GM, p, 'awr', s) * 0.15;
    const er = p => Math.max(E(GM, p, 'pmv', ds), E(GM, p, 'fmv', ds)) * 0.6 + E(GM, p, 'spd', ds) * 0.25 + E(GM, p, 'awr', ds) * 0.15;
    const edgeGap = Math.min(pb(O.OL[0]) - er(D.DL[3]), pb(O.OL[4]) - er(D.DL[0]));
    const pro = avg(O.OL.map(pb)) + (t === 'deep' || t === 'pa' ? 1.2 : 0) + ctx.F.pro * 2 + (ctx.mo.pro || 0) * 1.2 + Math.min(0, edgeGap) * 0.25;
    const rushers = D.DL.map((p, i) => ({ p, v: i === 0 || i === 3 ? Math.max(E(GM, p, 'pmv', ds), E(GM, p, 'fmv', ds)) * 0.6 + E(GM, p, 'spd', ds) * 0.25 + E(GM, p, 'awr', ds) * 0.15 : E(GM, p, 'pmv', ds) * 0.6 + E(GM, p, 'str', ds) * 0.25 + E(GM, p, 'fmv', ds) * 0.15 })).sort((a, b) => b.v - a.v);
    if (def.blitz) rushers.push({ p: D.LB[0], v: (E(GM, D.LB[0], 'pmv', ds) || 60) * 0.5 + E(GM, D.LB[0], 'spd', ds) * 0.5 });
    const rush = rushers[0].v * 0.45 + rushers[1].v * 0.3 + rushers[2].v * 0.25;
    const time = 2.75 + (pro - rush) / 23 + gauss() * 0.7 - (def.rush + (ctx.md.rush || 0)) * 0.33 + (read && def.blitz ? -0.3 : 0);
    let need = { quick: 1.5, med: 2.5, deep: 3.15, screen: 1.0, pa: 2.95 }[t];
    if (t === 'pa' && def.box > 0.5) need -= 0.35;
    const margin = time - need;
    const winner = () => weighted(rushers.slice(0, 3).map(x => x.p), p => Math.pow(rushers.find(r => r.p === p).v, 3));
    // screens
    if (t === 'screen') {
      const tgt = chance(0.45) ? O.RB : chance(0.5) ? O.WR[2] : O.WR[0];
      const blockers = avg([O.OL[1], O.OL[2], O.OL[3]].map(p => E(GM, p, 'rbk', s)));
      const pursuit = avg(D.LB.map(p => E(GM, p, 'pur', ds) * 0.6 + E(GM, p, 'spd', ds) * 0.4));
      const sniff = (def.blitz ? -1.4 : def.box > 0.5 ? -0.4 : 0.6) + read * 1.2 + (dc.d === 'c2' || dc.d === 't2' ? 0.5 : 0) - ctx.pm * 0.6;
      if (chance(clamp(0.1 + sniff * 0.08, 0.04, 0.3))) {
        const pd = chance(0.6) ? D.DL[1] : D.LB[0];
        if (chance(0.06)) return interception(GM, s, O, D, qb, tgt, pd, t, ev, `${last(pd)} reads the screen all the way`);
        add(GM, pd, 'pd');
        return { kind: 'inc', t, passer: qb, target: tgt, defender: pd, yards: 0, events: [`${last(pd)} sniffs out the screen and knocks it down.`], text0: `${last(qb)} screen to ${last(tgt)} — batted down`, time: 4, anim: { kind: 'pass', t, inc: true, role: tgt === O.RB ? 'RB' : 'WR' }, inc: true };
      }
      let y = rr(-2, 1) + 5.0 + (blockers - pursuit) / 15 - sniff * 2.2 + (E(GM, tgt, 'elu', s) - 70) / 12 + gauss() * 3.4;
      if (y > 9 && chance(0.18 + (tgt.at.spd - 85) / 120)) y += -Math.log(1 - rnd()) * 18;
      y = Math.round(clamp(y, -6, 100));
      const tk = tacklerFor(D, y, y < 4 ? 'short' : 'run');
      return complete(GM, s, qb, tgt, tk, y, Math.round(rr(-2, 1)), t, ev, false, { kind: 'pass', t, role: tgt === O.RB ? 'RB' : tgt === O.WR[2] ? 'WR3' : 'WR1' });
    }
    // pressure
    if (margin < -0.5) {
      const sackP = clamp(0.62 - (E(GM, qb, 'agi', s) + E(GM, qb, 'spd', s)) / 420 - (E(GM, qb, 'awr', s) - 70) / 190, 0.16, 0.72) * (t === 'quick' ? 0.45 : 1);
      if (chance(sackP)) {
        const sk = winner(); const y = -Math.round(rr(4, 10));
        let strip = chance(0.10 + (sk.at.pmv || 60) / 1500);
        if (strip && chance(1 - qb.at.car / 140)) strip = true; else strip = false;
        ev.push(qb.tr.tup < 45 ? `${last(qb)} held it too long (he gets jumpy under pressure).` : `${last(sk)} won with a ${sk.at.fmv > sk.at.pmv ? 'speed rush around the edge' : 'bull rush right through the pocket'}.`);
        return { kind: 'sack', t, passer: qb, tackler: sk, yards: y, fum: strip, events: ev, text0: `${last(qb)} SACKED by ${last(sk)}`, time: 5, anim: { kind: 'sack', t }, sackBy: sk };
      }
      if (qb.at.spd >= 76 && chance(0.5)) {
        const lbs = avg(D.LB.map(p => p.at.spd));
        let y = Math.round(clamp(3 + (qb.at.spd - lbs) / 3 + gauss() * 4, -2, 30));
        if (y > 10 && chance(0.18)) y += Math.round(rr(5, 30));
        ev.push(`Pocket collapses — ${last(qb)} escapes and scrambles.`);
        return { kind: 'run', t: 'scr', dir: pick(['L', 'R']), carrier: qb, tackler: tacklerFor(D, y, 'run'), yards: y, fum: false, oob: chance(0.4), events: ev, text0: `${last(qb)} scrambles`, time: 6, anim: { kind: 'run', t: 'scr', dir: 'L', scramble: true } };
      }
      if (chance(0.42)) {
        ev.push(`Pressure from ${last(winner())} — ${last(qb)} throws it away.`);
        return { kind: 'inc', t, passer: qb, target: null, yards: 0, events: ev, text0: `${last(qb)} pass incomplete (thrown away)`, time: 4, anim: { kind: 'pass', t, inc: true, away: true }, inc: true, pressured: true };
      }
    }
    const hurried = margin < 0;
    const rt = pickTarget(GM, s, O, D, t, def, hurried, ctx);
    const tgt = rt.p, cov = rt.cov;
    // crowd noise: route miscommunication for the road offense
    if (s === 'a' && GM.crowd > 0.5 && chance(GM.crowd * 0.022)) {
      ev.push(`${last(qb)} and ${last(tgt)} were not on the same page — the noise in ${GM.T.h.name === 'Tennessee' ? 'Neyland' : 'the stadium'} wrecked the communication.`);
      if (chance(0.16)) return interception(GM, s, O, D, qb, tgt, cov, t, ev, 'a busted route');
      return { kind: 'inc', t, passer: qb, target: tgt, yards: 0, events: ev, text0: `${last(qb)} pass to ${last(tgt)} incomplete`, time: 4, anim: { kind: 'pass', t, inc: true, role: rt.role }, inc: true, bust: true };
    }
    const acc = rt.depth === 'd' ? E(GM, qb, 'dac', s) : rt.depth === 'm' ? E(GM, qb, 'mac', s) : E(GM, qb, 'sac', s);
    const base = { s: 0.71, m: 0.59, d: 0.39 }[rt.depth] + (t === 'pa' ? 0.03 : 0);
    let pc = base + (rt.sep - 1) * 0.05 + (acc - 82) * 0.0045 + (E(GM, tgt, 'cth', s) - 80) * 0.002 - (hurried ? 0.11 : 0);
    if (rt.depth === 'd') pc += (E(GM, qb, 'thp', s) - 82) * 0.002;
    if (hurried && qb.tr.tup < 45) { pc -= 0.05; }
    pc = clamp(pc, 0.07, 0.93);
    const air = rt.depth === 'd' ? Math.round(rr(18, 42)) : rt.depth === 'm' ? Math.round(rr(8, 17)) : Math.round(rr(1, 7));
    const toGoal = 100 - GM.ball;
    if (chance(pc)) {
      let yac = rt.depth === 'd' ? (rt.sep > 1.6 ? rr(3, 30) : rr(0, 7)) : rt.depth === 'm' ? rr(0, 6) + gauss() * 2 : rr(1, 7) + gauss() * 2;
      yac += ((E(GM, tgt, 'elu', s) || 60) + E(GM, tgt, 'spd', s) - 160) / 24;
      const tk = tacklerFor(D, air + yac, rt.depth === 's' ? 'short' : 'deep');
      if (chance(clamp(0.1 + ((E(GM, tgt, 'btk', s) || tgt.at.str || 60) - E(GM, tk, 'tak', ds)) / 130, 0.03, 0.25))) { yac += rr(3, 12); ev.push(`${last(tgt)} shakes off ${last(tk)}.`); }
      if (air + yac > 14 && chance(0.12 + (tgt.at.spd - 85) / 100)) yac += -Math.log(1 - rnd()) * 14;
      let y = Math.round(Math.min(toGoal, air + Math.max(0, yac)));
      if (air >= toGoal) y = toGoal;
      if (bigMoment(GM) && tgt.tr.clutch >= 88 && chance(0.5)) ev.push(`${last(tgt)} — Ice Water — comes up big again.`);
      return complete(GM, s, qb, tgt, tk, y, Math.min(air, toGoal), t, ev, rt.depth !== 'd' && chance(in2min(GM) && GM.score[s] <= GM.score[ds] ? 0.5 : 0.22), { kind: 'pass', t, role: rt.role, air: Math.min(air, toGoal) });
    }
    // incomplete: interception, drop, pass breakup, interference
    let pint = { s: 0.013, m: 0.022, d: 0.036 }[rt.depth] * (1 + Math.max(0, 1 - rt.sep) * 0.3) * (1 + (80 - E(GM, qb, 'awr', s)) / 70) * ((cov.at.cth || 55) / 68) * (hurried ? 1.6 : 1);
    if (qb.arch === 'Gunslinger') pint *= 1.15;
    if (chance(clamp(pint / (1 - pc), 0.01, 0.3))) return interception(GM, s, O, D, qb, tgt, cov, t, ev, null);
    if (rt.depth !== 's' && rt.sep < 0.6 && chance(0.075)) {
      const pi = Math.min(15, air, toGoal - 1);
      ev.push(`Flag: pass interference on #${cov.num} ${last(cov)}.`);
      add(GM, cov, 'pen');
      return { kind: 'dpi', t, passer: qb, target: tgt, defender: cov, yards: Math.max(1, pi), events: ev, text0: `${last(qb)} pass deep to ${last(tgt)} — pass interference, ${last(cov)}`, time: 5, anim: { kind: 'pass', t, inc: true, role: rt.role, flag: true }, firstDown: true, pen: true };
    }
    const dropped = rt.sep > 0.6 && chance(clamp((84 - tgt.at.cth) / 70 + 0.05, 0.05, 0.42));
    if (dropped) ev.push(`DROPPED. ${last(tgt)} had it in his hands${tgt.tr.cons < 58 ? ' (Streaky: the focus comes and goes)' : ''}.`);
    else if (rt.sep < 0.3 && chance(0.55)) { add(GM, cov, 'pd'); ev.push(`Broken up by ${last(cov)}.`); }
    add(GM, tgt, 'tg');
    return { kind: 'inc', t, passer: qb, target: tgt, defender: cov, yards: 0, events: ev, text0: `${last(qb)} pass ${rt.depth === 'd' ? 'deep' : 'short'} ${pick(['left', 'right', 'middle'])} to ${last(tgt)} incomplete`, time: 5, anim: { kind: 'pass', t, inc: true, role: rt.role, air }, inc: true, drop: dropped };
  }
  function complete(GM, s, qb, tgt, tk, y, air, t, ev, oob, anim) {
    add(GM, tgt, 'tg');
    let fum = chance(0.0055 * (1 + (70 - (tgt.at.car || 65)) / 30));
    return { kind: 'pass', t, passer: qb, target: tgt, tackler: tk, yards: y, air, fum, oob, events: ev, text0: `${last(qb)} pass ${t === 'screen' ? 'screen' : air >= 18 ? 'deep' : 'short'} ${pick(['left', 'right', 'middle'])} complete to ${last(tgt)}`, time: Math.round(5 + y / 8), anim };
  }
  function interception(GM, s, O, D, qb, tgt, cov, t, ev, why) {
    const pick6 = chance(0.05 + Math.max(0, (cov.at.spd - 82)) / 120);
    const ret = pick6 ? 999 : Math.round(clamp(6 + gauss() * 9 + (cov.at.spd - 80) / 4, 0, 60));
    if (why) ev.push(`Picked: ${why}.`);
    else if (qb.arch === 'Gunslinger') ev.push(`${last(qb)} the gunslinger tried to fit it in.`);
    else if (qb.tr.tup < 45) ev.push(`${last(qb)} forced it under pressure.`);
    return { kind: 'int', t, passer: qb, target: tgt, defender: cov, yards: 0, ret, pick6, turnover: true, events: ev, text0: `${last(qb)} pass to ${last(tgt)} INTERCEPTED by ${last(cov)}`, time: Math.round(6 + Math.min(ret, 60) / 8), anim: { kind: 'pass', t, int: true, role: 'WR1', ret } };
  }

  /* ---------- kicks from scrimmage ---------- */
  function punt(GM, s) {
    const P = pers(GM, s), R = pers(GM, other(s)), pt = P.P, pr = R.PR;
    const rush = GM.puntRush === other(s);
    if (chance(rush ? 0.035 : 0.006)) return { kind: 'puntblk', yards: 0, text: `PUNT BLOCKED! ${GM.T[other(s)].name} gets it at the ${DY.spotName(GM, s, GM.ball)}!`, time: 4, anim: { kind: 'punt', blocked: true }, punter: pt };
    const gross = clamp(39 + ((pt ? pt.at.kpw : 60) - 62) * 0.33 + gauss() * 5, 22, 66);
    let land = GM.ball + gross; // from the punting team's view
    const result = { kind: 'punt', punter: pt, gross: Math.round(gross), time: 5, events: [] };
    if (land >= 100) { result.tb = true; result.newBall = 20; result.text = `${last(pt)} punts ${Math.round(gross)} yards into the end zone. Touchback.`; add(GM, pt, 'pn'); add(GM, pt, 'pny', Math.round(100 - GM.ball)); result.net = 100 - GM.ball - 20; }
    else {
      // aim inside the 20 near midfield
      if (GM.ball >= 50 && land > 94 && chance(0.5 + ((pt ? pt.at.kac : 60) - 70) / 80)) land = rr(88, 97);
      const recv = 100 - land;
      let ret = 0, fc = chance((recv <= 12 ? 0.75 : 0.36) + (rush ? 0.2 : 0)), muff = !fc && chance(0.014), td = false;
      let liveR = null;
      if (!fc && !muff && GM.live && DY.SIM && pr) { liveR = DY.SIM.returnPlay(GM, other(s), { kind: 'punt', land: Math.max(1, recv), hang: 4.2, returner: pr }); ret = liveR.ret; td = liveR.td; if (liveR.tackler) add(GM, liveR.tackler, 'tk'); result.trk = liveR.trk; }
      else if (!fc && !muff) { ret = clamp(7 + ((pr ? pr.at.agi + pr.at.spd : 150) - 160) / 6 + gauss() * 6, -2, 40); if (chance(0.006)) { td = true; } }
      if (rush && !td) ret = Math.round(ret * 0.55);
      add(GM, pt, 'pn'); add(GM, pt, 'pny', Math.round(gross)); if (recv <= 20) add(GM, pt, 'i20');
      result.text = `${last(pt)} punts ${Math.round(gross)} yards to the ${DY.spotName(GM, other(s), Math.round(recv))}. ` + (fc ? `Fair catch by ${last(pr)}.` : muff ? `MUFFED by ${last(pr)}! ` : td ? `${last(pr)} takes it back... TOUCHDOWN!` : `${last(pr)} returns ${Math.round(ret)} yards.`);
      if (!fc && !muff && !td) { add(GM, pr, 'pr'); add(GM, pr, 'pry', Math.round(ret)); }
      if (muff) { const rec = chance(0.55); result.text += rec ? `${GM.T[s].name} RECOVERS!` : `${last(pr)} falls on it.`; if (rec) { result.muffRec = true; result.newBallSame = Math.round(land); } add(GM, pr, 'fum'); }
      result.newBall = td ? 100 : clamp(Math.round(recv + ret), 1, 99); result.ret = Math.round(ret); result.td = td; result.pr = pr; result.net = Math.round(gross - ret);
      if (td) add(GM, pr, 'rttd');
      result.time = Math.round(6 + ret / 8);
    }
    result.anim = { kind: 'punt', gross: result.gross, land: Math.min(100, Math.round(GM.ball + gross)), ret: result.net, trk: result.trk || null, fc: !!(result.text && /Fair catch/.test(result.text)) };
    delete result.trk;
    return result;
  }
  function fieldGoal(GM, s) {
    const P = pers(GM, s), K = P.K, dist = Math.round(100 - GM.ball + 17);
    let p = DY.fgProb(GM, K, dist);
    if (s === 'a' && GM.crowd > 0.6 && GM.big) p -= 0.03;
    if (bigMoment(GM)) p += ((K ? K.tr.clutch : 55) - 55) / 400;
    const blocked = chance(0.014 + Math.max(0, dist - 45) / 1500);
    const ok = !blocked && chance(p);
    add(GM, K, 'fga'); if (ok) { add(GM, K, 'fgm'); maxs(GM, K, 'fglg', dist); }
    const ev = [];
    if (!ok && !blocked && bigMoment(GM) && K && K.tr.clutch < 58) ev.push(`${last(K)} has struggled with big kicks.`);
    if (ok && bigMoment(GM) && K && K.tr.clutch >= 85) ev.push(`Ice in the veins from ${last(K)}.`);
    return { kind: 'fg', ok, blocked, dist, kicker: K, yards: 0, time: 5, events: ev, text: `${last(K)} ${dist}-yard field goal is ${ok ? 'GOOD' : blocked ? 'BLOCKED' : 'no good, ' + pick(['wide left', 'wide right', 'short', 'off the upright'])}.`, anim: { kind: 'fg', ok, dist, blocked } };
  }

  /* ---------- applying a play: ball, down, clock, score, stats, momentum, injuries ---------- */
  function applyResult(GM, s, r, c) {
    const d = other(s), T = GM.ts[s], before = GM.ball, ev = r.events || [];
    let text = '', tag = null, big = false, td = false, turnover = false, firstDown = false, stop = false, safety = false;
    const head = `${DY.downStr(c.startDown, c.startTogo, c.startBall)} at ${DY.spotName(GM, s, c.startBall)}`;
    if (GM.drive) GM.drive.plays++;
    T.plays++;
    if (c.startDown === 3 && (r.kind === 'run' || r.kind === 'pass' || r.kind === 'inc' || r.kind === 'sack' || r.kind === 'int' || r.kind === 'dpi')) T.a3++;
    if (c.startDown === 4 && (r.kind === 'run' || r.kind === 'pass' || r.kind === 'inc' || r.kind === 'sack' || r.kind === 'int' || r.kind === 'dpi')) T.a4++;
    const tm = Math.min(GM.q <= 4 ? GM.clock : 0, r.time || 5);
    if (GM.q <= 4) { GM.clock = Math.max(0, GM.clock - tm); T.top += tm; }

    if (r.kind === 'punt' || r.kind === 'puntblk') {
      T.pn++;
      text = r.text;
      if (r.kind === 'puntblk') { changePoss(GM, 100 - GM.ball, 'block'); endDrivePrev(GM, 'Blocked punt'); swing(GM, d, 0.45); tag = 'BLOCKED'; big = true; }
      else if (r.muffRec) { GM.ball = clamp(r.newBallSame, 1, 99); GM.down = 1; GM.togo = Math.min(10, 100 - GM.ball); GM.running = false; swing(GM, s, 0.4); tag = 'MUFF'; big = true; if (GM.drive) GM.drive.plays++; }
      else if (r.td) { endDrive(GM, 'Punt'); changePoss(GM, 99, 'punt'); score(GM, d, 6); endDrive(GM, 'TD'); GM.next = 'pat'; swing(GM, d, 0.45); tag = 'TOUCHDOWN'; td = true; big = true; }
      else { endDrive(GM, 'Punt'); changePoss(GM, r.newBall, 'punt'); }
      stop = true;
    } else if (r.kind === 'fg') {
      text = r.text;
      if (r.ok) { score(GM, s, 3); endDrive(GM, 'FG'); tag = 'FIELD GOAL'; GM.next = 'kick'; GM.kicker = s; if (bigMoment(GM)) big = true; }
      else { endDrive(GM, r.blocked ? 'Blocked FG' : 'Missed FG'); changePoss(GM, Math.max(20, 100 - (GM.ball - 7)), 'missed FG'); tag = r.blocked ? 'BLOCKED' : 'NO GOOD'; swing(GM, d, 0.2); }
      stop = true;
    } else {
      // scrimmage result
      let y = r.yards || 0;
      const P = pers(GM, s);
      if (r.kind === 'kneel') { GM.ball = Math.max(1, GM.ball - 1); GM.down++; text = r.text; add(GM, P.QB, 'ra'); add(GM, P.QB, 'ry', -1); }
      else if (r.kind === 'spike') { GM.down++; text = r.text; stop = true; add(GM, P.QB, 'pa'); }
      else {
        // stats
        if (r.kind === 'run') { add(GM, r.carrier, 'ra'); add(GM, r.carrier, 'ry', y); maxs(GM, r.carrier, 'rlg', y); T.ra++; T.ry += y; }
        if (r.kind === 'pass') { add(GM, r.passer, 'pa'); add(GM, r.passer, 'pc'); add(GM, r.passer, 'py', y); add(GM, r.target, 'rc'); add(GM, r.target, 'rcy', y); maxs(GM, r.target, 'rclg', y); T.pa++; T.pc++; T.py += y; }
        if (r.kind === 'inc' || r.kind === 'int' || r.kind === 'dpi') { add(GM, r.passer, 'pa'); T.pa++; }
        if (r.sim && r.target && (r.kind === 'pass' || r.kind === 'inc' || r.kind === 'int')) add(GM, r.target, 'tg');
        if (r.kind === 'sack') { add(GM, r.passer, 'sk'); add(GM, r.sackBy, 'sck'); add(GM, r.sackBy, 'tk'); add(GM, r.sackBy, 'tfl'); T.sk++; T.py += y; }
        if (r.tackler && (r.kind === 'run' || r.kind === 'pass') && !r.fum) { add(GM, r.tackler, 'tk'); if (y < 0) add(GM, r.tackler, 'tfl'); }
        if (r.ast && (r.kind === 'run' || r.kind === 'pass' || r.kind === 'sack') && !r.fum) add(GM, r.ast, 'tk');
        // post-play penalties
        let pen = null;
        if (r.kind === 'run' || r.kind === 'pass') pen = postPenalty(GM, s, r, y);
        if (pen && pen.on === s) {
          // offensive holding wipes the play: 10 yards from the line, replay the down
          if (r.kind === 'run') { line(GM, r.carrier).ra--; line(GM, r.carrier).ry -= y; T.ra--; T.ry -= y; }
          if (r.kind === 'pass') { const pl = line(GM, r.passer), tl = line(GM, r.target); pl.pc--; pl.py -= y; tl.rc--; tl.rcy -= y; T.pc--; T.py -= y; }
          if (r.tackler) { line(GM, r.tackler).tk--; }
          y = -Math.min(10, Math.floor(GM.ball / 2)); r.fum = false;
          GM.ball += y; GM.togo -= y;
          text = `${r.text0}, but ${pen.text}`; GM.ts[s].pen++; GM.ts[s].peny += -y; stop = true; var wiped = { yards: r.yards, kind: r.kind }; tag = 'FLAG';
        } else {
          if (r.kind === 'dpi') { y = r.yards; GM.ts[d].pen++; GM.ts[d].peny += y; }
          // fumbles
          if (r.fum) {
            const holder = r.kind === 'sack' ? r.passer : r.kind === 'pass' ? r.target : r.carrier;
            add(GM, holder, 'fum');
            const ff = r.kind === 'sack' ? r.sackBy : r.tackler;
            add(GM, ff, 'ff');
            const lost = chance(0.52);
            const spot = clamp(GM.ball + y, 1, 99);
            text = `${r.text0}${y ? ' for ' + y + ' yards' : ''}... FUMBLE! ` + (lost ? `${GM.T[d].name} recovers!` : `${GM.T[s].name} falls on it.`);
            if (lost) {
              const rec = pick([...pers(GM, d).DL, ...pers(GM, d).LB]); add(GM, rec, 'fr');
              endDrive(GM, 'Fumble'); T.to++; changePoss(GM, 100 - spot, 'fumble'); turnover = true; swing(GM, d, 0.4); tag = 'FUMBLE'; big = true; stop = true;
              if (r.kind === 'run' && y > 0) { line(GM, r.carrier).ry += 0; }
            } else { GM.ball = spot; y = spot - before; finishDown(); }
          } else if (r.kind === 'int') {
            add(GM, r.defender, 'int'); add(GM, r.passer, 'pi'); T.to++;
            const caughtAt = clamp(GM.ball + (r.anim.air || 10), 1, 109);
            let nb = 100 - Math.min(99, caughtAt);
            if (r.sim ? r.intTB : (caughtAt >= 100 && r.ret < 999 && chance(0.6))) { nb = 20; text = `${r.text0} in the end zone. Touchback.`; }
            else if (r.pick6) { text = `${r.text0} — and he is GONE! PICK-SIX!`; }
            else { nb = clamp(nb + r.ret, 1, 99); text = `${r.text0}, returned ${r.ret} yards to the ${DY.spotName(GM, d, nb)}.`; }
            endDrive(GM, 'INT'); changePoss(GM, nb, 'interception'); turnover = true; swing(GM, d, 0.45); tag = r.pick6 ? 'PICK-SIX' : 'INTERCEPTED'; big = true; stop = true;
            add(GM, r.defender, 'intY', Math.min(r.ret, 100));
            if (r.pick6) { GM.ball = 100; score(GM, d, 6); add(GM, r.defender, 'dtd'); endDrive(GM, 'TD'); GM.next = 'pat'; td = true; tag = 'PICK-SIX'; }
          } else {
            GM.ball = GM.ball + y;
            finishDown();
          }
          if (pen && pen.on === d) {
            text += ` ${pen.text}`;
            GM.ball = clamp(GM.ball + pen.y, 1, 99); GM.down = 1; GM.togo = Math.min(10, 100 - GM.ball); firstDown = true; GM.ts[d].pen++; GM.ts[d].peny += pen.y; stop = true;
          }
        }
        function finishDown() {
          if (GM.ball >= 100) {
            const scorer = r.kind === 'pass' ? r.target : r.carrier;
            if (r.kind === 'pass') { add(GM, r.passer, 'ptd'); add(GM, r.target, 'rctd'); } else add(GM, r.carrier, 'rtd');
            score(GM, s, 6); endDrive(GM, 'TD'); td = true; tag = 'TOUCHDOWN'; GM.next = 'pat'; swing(GM, s, 0.3); big = true; stop = true;
            text = `${r.text0} for ${y} yards. TOUCHDOWN ${GM.T[s].name.toUpperCase()}!`;
            // taunting / celebration flag, enforced on the kickoff
            if (scorer && chance(Math.max(0, scorer.tr.ego - 68) / 350 + Math.max(0, 55 - scorer.tr.disc) / 600)) { GM.kickPen = 15; ev.push(`Flag on the celebration — #${scorer.num} ${last(scorer)} (Showman) draws an unsportsmanlike penalty. 15 yards on the kickoff.`); add(GM, scorer, 'pen'); }
            return;
          }
          if (GM.ball <= 0) {
            safety = true; score(GM, d, 2); endDrive(GM, 'Safety'); GM.next = 'free'; GM.kicker = s; tag = 'SAFETY'; big = true; stop = true; swing(GM, d, 0.35);
            text = `${r.text0} — tackled in the end zone. SAFETY!`;
            if (r.tackler) add(GM, r.tackler, 'saf');
            return;
          }
          const gained = GM.ball - before;
          if (r.kind === 'dpi' || gained >= GM.togo) {
            GM.down = 1; GM.togo = Math.min(10, 100 - GM.ball); firstDown = true; T.fd++;
            if (c.startDown === 3) T.c3++; if (c.startDown === 4) T.c4++;
          } else {
            GM.down++; GM.togo -= gained;
            if (GM.down > 4) {
              endDrive(GM, 'Downs'); changePoss(GM, 100 - GM.ball, 'downs'); turnover = true; tag = 'TURNOVER ON DOWNS'; swing(GM, d, 0.3); stop = true;
            }
          }
          text = r.kind === 'dpi' ? r.text0 + `. ${r.yards} yards, automatic first down.` : `${r.text0} ${r.kind === 'inc' ? '' : (y === 0 ? 'for no gain' : 'for ' + y + ' yard' + (Math.abs(y) === 1 ? '' : 's'))}`.trim() + (r.tackler && r.kind !== 'inc' && r.kind !== 'sack' && !r.oob ? ` (${last(r.tackler)})` : r.oob ? ', out of bounds' : '') + '.';
          if (r.kind === 'sack') text = `${r.text0} for a loss of ${-y}.`;
        }
        if (r.kind === 'sack' && !r.fum && !safety) tag = tag || 'SACK';
        if (r.kind === 'pass' || r.kind === 'run') { if (y >= 25) { big = true; swing(GM, s, 0.12); } }
        if (r.inc || r.oob && in2min(GM)) stop = true;
        if (r.kind === 'run' && r.oob && !in2min(GM)) GM.oobRestart = true;
      }
      T.yds += Math.max(-20, (r.kind === 'run' || r.kind === 'pass' || r.kind === 'sack') ? (r.yards || 0) : 0);
      if (firstDown && in2min(GM)) stop = true;
      if (GM.drive) GM.drive.yds = GM.ball - GM.drive.start;
      // 4th down stop momentum
      if (tag === 'TURNOVER ON DOWNS') big = true;
      // hot hand
      const star = r.kind === 'pass' ? r.target : r.carrier;
      if (star && (r.kind === 'pass' || r.kind === 'run')) GM.hot[star.id] = clamp((GM.hot[star.id] || 0) + (y >= 10 ? 0.6 : y <= 0 ? -0.4 : 0), -1.5, 2);
    }
    // injuries
    if (!GM.noInj && (r.kind === 'run' || r.kind === 'pass' || r.kind === 'sack')) {
      const pool = [r.carrier, r.target, r.tackler, r.passer].filter(Boolean);
      pool.forEach(p => { if (chance(0.0019 * (1 + (60 - p.tr.tough) / 80))) injure(GM, p, ev); });
    }
    // where the ball is spotted across the field (between the hashes)
    if (r.kind === 'run' || r.kind === 'pass' || r.kind === 'sack' || r.kind === 'int') {
      if (r.sim && r.endL != null) GM.by = clamp(GM.by + r.endL * (s === 'h' ? 1 : -1), 20, 33.33);
      else if (r.kind !== 'sack') GM.by = clamp(GM.by + gauss() * 5, 20, 33.33);
    }
    if (turnover || td || r.kind === 'punt' || r.kind === 'fg') { if (r.kind !== 'int' && r.kind !== 'run' && r.kind !== 'pass') GM.by = clamp(26.67 + gauss() * 3.5, 20, 33.33); }
    if (!stop && !td && !turnover && !safety) GM.running = true; else GM.running = false;
    if (GM.oobRestart) { GM.running = true; GM.oobRestart = false; GM.clock = Math.min(GM.clock + 0, GM.clock); }
    if (r.kind === 'spike' || r.kind === 'inc') GM.running = false;
    GM.mom *= 0.88;
    if (GM.next === 'scrim' && GM.q <= 4 && GM.clock <= 0) {
      if (!td && !safety) { const eq = endQuarter(GM, ''); text = text + ' ' + eq.text; tag = tag || eq.tag; }
    }
    if (GM.ot && GM.next === 'scrim' && (turnover || r.kind === 'fg' || (GM.ot.shootout && !td))) {
      // possession over without a touchdown (two-point shootout plays end after one snap)
      if (GM.ot.shootout && !turnover && r.kind !== 'fg') { /* failed try */ }
      if (r.kind === 'fg' && r.ok) {}
      const res0 = { type: 'play', text: (c.toText || '') + text, head, events: ev, s, tag, big, anim: Object.assign({ los: c.startBall, end: GM.poss === s ? GM.ball : 100 - GM.ball }, r.anim || {}), r };
      const wasPoss = s;
      GM.poss = wasPoss;
      return otAfterPoss(GM, res0);
    }
    if (GM.ot && td && GM.ot.shootout) {
      // a successful two-point play in 3OT+: worth 2, not 6
      GM.score[s] -= 4; GM.lineScore[s][4] -= 4; text = text.replace('TOUCHDOWN', 'TWO-POINT PLAY GOOD —'); GM.next = 'scrim';
      const res0 = { type: 'play', text: (c.toText || '') + text, head, events: ev, s, tag: 'GOOD', big: true, anim: Object.assign({ los: c.startBall, end: 100 }, r.anim || {}), r };
      return otAfterPoss(GM, res0);
    }
    const shake = GM.big && GM.crowd > 0.7 && c.startDown === 3 && s === 'a';
    return {
      type: 'play', text: (c.toText || '') + text, head, events: ev, s, tag, big, td, turnover, firstDown, shake,
      anim: Object.assign({ los: c.startBall, end: typeof wiped !== 'undefined' && wiped ? c.startBall + (wiped.yards || 0) : td ? 100 : (GM.poss === s ? GM.ball : 100 - GM.ball), yards: r.yards || 0, wiped: typeof wiped !== 'undefined' && !!wiped }, r.anim || {}),
      play: r.play, cov: r.cov, call: c.ocall, dcall: c.dcall, r,
    };
  }
  function endDrivePrev(GM, why) { const dr = GM.drives[GM.drives.length - 2]; if (dr && !dr.res) dr.res = why; }
  function postPenalty(GM, s, r, y) {
    const O = pers(GM, s), D = pers(GM, other(s));
    if (r.sim && r.flagHold) { const h = r.flagHold; add(GM, h, 'pen'); return { on: s, text: `holding on #${h.num} ${last(h)} brings it back. 10 yards, replay the down.` }; }
    const hold = r.sim ? 0 : 0.022 + (r.kind === 'run' && y <= 0 ? 0.035 : 0) + (r.kind === 'pass' && r.pressured ? 0.03 : 0);
    if (chance(hold)) {
      const h = weighted(O.OL, p => 110 - p.tr.disc); add(GM, h, 'pen');
      return { on: s, text: `holding on #${h.num} ${last(h)} brings it back. 10 yards, replay the down.` };
    }
    if (r.kind === 'pass' && chance(0.011)) { const c = pick(D.CB); add(GM, c, 'pen'); return { on: other(s), y: 5, text: `Defensive holding on #${c.num} ${last(c)}: 5 yards and an automatic first down.` }; }
    if (chance(0.0055)) {
      const hh = weighted([...D.DL, ...D.LB, ...D.S], p => Math.pow(Math.max(5, p.tr.ego - p.tr.disc + 50), 2)); add(GM, hh, 'pen');
      const hot = hh.tr.ego >= 78 && hh.tr.disc <= 58;
      return { on: other(s), y: 15, text: `Personal foul, #${hh.num} ${last(hh)}${hot ? ' — the Hot Head after the whistle again' : ''}. 15 yards.` };
    }
    return null;
  }
  function injure(GM, p, ev) {
    if (p.inj && p.inj.wks > 0) return;
    const r = rnd();
    const wks = r < 0.55 ? 0 : r < 0.8 ? ri(1, 2) : r < 0.95 ? ri(3, 6) : 12;
    const what = wks === 0 ? pick(['banged up', 'shaken up', 'cramping']) : wks <= 2 ? pick(['ankle sprain', 'hamstring tightness', 'shoulder stinger', 'bruised ribs']) : wks <= 6 ? pick(['high ankle sprain', 'knee sprain', 'broken hand', 'hamstring strain']) : pick(['torn ACL', 'broken leg', 'torn labrum']);
    GM.injuries.push({ id: p.id, wks, what });
    ev.push(wks === 0 ? `${last(p)} is ${what} but returns.` : `INJURY: ${last(p)} (${what}) is out${wks >= 12 ? ' for the season' : ''}.`);
    if (wks > 0) {
      p.inj = { wks, what };
      // pull him from the lineup for the rest of the game
      for (const sd of ['h', 'a']) { const L = GM.L[sd]; for (const k in L) { if (Array.isArray(L[k])) { const i = L[k].indexOf(p); if (i >= 0 && L[k].length > 1) L[k].splice(i, 1); } } if (GM.L[sd].NB === p) GM.L[sd].NB = GM.L[sd].CB[2] || GM.L[sd].S[2] || GM.L[sd].CB[1]; if (GM.L[sd].KR === p) GM.L[sd].KR = GM.L[sd].RB[1] || GM.L[sd].WR[3]; if (GM.L[sd].PR === p) GM.L[sd].PR = GM.L[sd].WR[3] || GM.L[sd].CB[2]; }
    }
  }
  function endQuarter(GM, pre) {
    const q = GM.q;
    GM.running = false;
    if (q === 1 || q === 3) { GM.q++; GM.clock = 900; return { type: 'q', text: pre + `End of the ${q === 1 ? '1st' : '3rd'} quarter.`, anim: { kind: 'none' }, s: GM.poss, tag: 'END OF Q' + q }; }
    if (q === 2) {
      endDrive(GM, 'Half'); GM.q = 3; GM.clock = 900; GM.to = { h: 3, a: 3 }; GM.next = 'kick'; GM.kicker = GM.opening; GM.hurry = { h: false, a: false }; GM.halftime = true;
      return { type: 'q', text: pre + `HALFTIME: ${GM.T.a.name} ${GM.score.a}, ${GM.T.h.name} ${GM.score.h}.`, anim: { kind: 'none' }, s: GM.poss, tag: 'HALFTIME', half: true };
    }
    endDrive(GM, 'End of game');
    if (GM.score.h === GM.score.a) { GM.next = 'ot'; return { type: 'q', text: pre + `End of regulation: tied ${GM.score.h}-${GM.score.a}. We are going to OVERTIME.`, anim: { kind: 'none' }, s: GM.poss, tag: 'OVERTIME' }; }
    GM.over = true; GM.next = 'final';
    return { type: 'q', text: pre + `FINAL: ${GM.T.a.name} ${GM.score.a}, ${GM.T.h.name} ${GM.score.h}.`, anim: { kind: 'none' }, s: GM.poss, tag: 'FINAL', final: true };
  }

  /* ---------- win probability (home) ---------- */
  DY.winProb = GM => {
    if (GM.over) return GM.score.h > GM.score.a ? 1 : 0;
    const rem = GM.q >= 5 ? 300 : (4 - GM.q) * 900 + GM.clock;
    const diff = GM.score.h - GM.score.a;
    const ep = (GM.ball - 30) / 14;
    const poss = GM.next === 'pat' ? (GM.poss === 'h' ? 0.9 : -0.9) : GM.poss === 'h' ? ep : -ep;
    const prior = (GM.ovr.h.ovr - GM.ovr.a.ovr) * 0.35 * (rem / 3600) + (GM.neutral ? 0 : 1.5 * rem / 3600);
    const sd = Math.sqrt(rem / 3600) * 14 + 0.8;
    const z = (diff + poss + prior) / sd;
    return clamp(1 / (1 + Math.exp(-1.7 * z)), 0.005, 0.995);
  };

  /* ---------- simulating ---------- */
  DY.simTo = (GM, until, max) => {
    const out = [];
    let n = 0;
    while (!GM.over && n++ < (max || 2000)) {
      const r = DY.step(GM, {});
      if (r) out.push(r);
      if (until && until(GM, r)) break;
    }
    return out;
  };
  DY.playFull = GM => { DY.simTo(GM, null, 3000); return GM; };
})(typeof window !== 'undefined' ? window : globalThis);
