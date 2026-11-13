/* The Vol Index — game predictor for football matchup previews.

   What it does, in order:
     1. MODEL     Blends the power ratings the site already has (SP+, FPI, PEAR) into one number per team, adds home field
                  (measured from 313 real Tennessee games, see tools/calibrate_predictor.py), rest and recent form when both
                  teams' schedules are known, and any what-if the visitor sets. Out comes an expected margin and total.
     2. SIMULATE  Plays the game snap by snap 1,000 times. Each offense is built from its own season numbers against the
                  other defense's (yards per carry, yards per attempt, completion rate, sacks, interceptions, fumbles),
                  then tuned so the average simulated score equals the model's expected score. The ratings decide who is
                  better; the simulation decides how wide the range of outcomes is and what the games look like.
     3. REPORT    Win chance, projected score, the spread of results, what the winner usually did, projected team numbers.
     4. WATCH     Picks the simulated game closest to the middle of all 1,000 and replays it on a field, play by play.

   No network calls: everything comes from data/football-auto.js (previews) and data/predict-cal.js. */
(function (root) {
  'use strict';
  const VP = root.VP = {};
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CAL = () => root.PREDICT_CAL || { hfa: 3.6, sd: 15.7, fitted: 'Tennessee games since 2000', backtest: null };
  // FBS averages the matchup math is anchored to (2024-25 seasons; rushing here excludes sacks)
  const NAT = { ypc: 5.0, ypa: 7.4, cmp: 61.5, intR: 0.026, sackR: 0.063, fumR: 0.008, pts: 29.5, total: 54 };
  const UT = 'Tennessee';
  // school colors and short names for the opponents Tennessee actually plays; anything else gets a neutral gray
  const TEAMS = { 'Tennessee': ['#FF8200', 'TENN'], 'Texas A&M': ['#500000', 'TAMU'], 'LSU': ['#461D7C', 'LSU'], 'Vanderbilt': ['#1C1C1C', 'VAN'], 'Alabama': ['#9E1B32', 'ALA'], 'Georgia': ['#BA0C2F', 'UGA'],
    'Florida': ['#0021A5', 'FLA'], 'Kentucky': ['#0033A0', 'UK'], 'South Carolina': ['#73000A', 'SC'], 'Texas': ['#BF5700', 'TEX'], 'Oklahoma': ['#841617', 'OU'], 'Auburn': ['#0C2340', 'AUB'], 'Arkansas': ['#9D2235', 'ARK'],
    'Ole Miss': ['#14213D', 'MISS'], 'Mississippi State': ['#660000', 'MSST'], 'Missouri': ['#2B2B2B', 'MIZ'], 'Georgia Tech': ['#857437', 'GT'], 'Ohio State': ['#BB0000', 'OSU'] };
  const teamOf = n => { const t = TEAMS[n]; if (t) return { name: n, col: t[0], abbr: t[1] }; const d = root.DY && root.DY.TEAMS && root.DY.TEAMS.find && root.DY.TEAMS.find(x => x.name === n); return { name: n, col: (d && d.color) || '#5E6670', abbr: (d && d.abbr) || n.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() }; };
  const phi = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
  // a small seeded random number generator, so simulation #417 is the same game every time it is replayed
  const rng = seed => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* ====================================================================================================
     1. THE MODEL
     ==================================================================================================== */
  const gamesIn = rec => { const m = /(\d+)-(\d+)/.exec(rec || ''); return m ? Math.max(1, +m[1] + +m[2]) : 9; };
  const days = (a, b) => Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 864e5);
  // last game before this one, and average margin in the last three against the season (from a list of [date, us, them])
  function recent(list, date) {
    const done = (list || []).filter(x => x[0] < date && x[1] != null && x[2] != null).sort((a, b) => a[0] < b[0] ? -1 : 1);
    if (!done.length) return null;
    const m = done.map(x => x[1] - x[2]), all = m.reduce((s, x) => s + x, 0) / m.length, l3 = m.slice(-3).reduce((s, x) => s + x, 0) / Math.min(3, m.length);
    return { rest: days(date, done[done.length - 1][0]), form: done.length >= 5 ? l3 - all : 0, n: done.length };
  }
  VP.model = (g, P, ctx, adj) => {
    ctx = ctx || {}; adj = adj || {}; P = P || {};
    const cal = CAL(), opp = g.opp, sec = (ctx.pear && ctx.pear.sec) || {};
    const src = [];
    if (P.sp && P.sp.ut && P.sp.opp && P.sp.ut[0] != null && P.sp.opp[0] != null) src.push({ k: 'SP+', ut: +P.sp.ut[0], opp: +P.sp.opp[0] });
    if (P.fpi && P.fpi.ut && P.fpi.opp && P.fpi.ut[0] != null && P.fpi.opp[0] != null) src.push({ k: 'FPI', ut: +P.fpi.ut[0], opp: +P.fpi.opp[0] });
    if (sec[UT] && sec[opp]) src.push({ k: 'PEAR', ut: +sec[UT][0], opp: +sec[opp][0] });
    const c = P.compare;
    if (!src.length && c && c.ppg && c.oppg) src.push({ k: 'Scoring margin', ut: (c.ppg[0] - c.oppg[0]) * 0.7, opp: (c.ppg[1] - c.oppg[1]) * 0.7 });
    if (!src.length) return null;
    const rU = src.reduce((s, x) => s + x.ut, 0) / src.length, rO = src.reduce((s, x) => s + x.opp, 0) / src.length;
    const site = g.site === 'H' ? 1 : g.site === 'A' ? -1 : 0;
    const factors = [{ k: 'Power ratings', v: rU - rO, note: src.map(x => `${x.k} ${x.ut.toFixed(1)} vs ${x.opp.toFixed(1)}`).join(' · ') }];
    factors.push({ k: site > 0 ? 'Home field (Neyland)' : site < 0 ? `Road game (${opp})` : 'Neutral site', v: site * cal.hfa, note: site ? `${cal.hfa} points, measured from ${cal.fitted}` : 'No home-field edge either way' });
    // rest and form only count when both teams' schedules are known, so one side never gets an adjustment the other can't
    const ru = recent((ctx.schedule || []).map(x => [x.date, x.us, x.them]), g.date), ro = recent(P.games, g.date);
    if (ru && ro) {
      const rest = (ru.rest >= 12 && ro.rest <= 8) ? 1 : (ro.rest >= 12 && ru.rest <= 8) ? -1 : (ru.rest <= 5 && ro.rest >= 7) ? -1 : (ro.rest <= 5 && ru.rest >= 7) ? 1 : 0;
      factors.push({ k: 'Rest', v: rest, note: `Tennessee ${ru.rest} days since its last game, ${opp} ${ro.rest}` });
      const form = clamp(0.12 * (ru.form - ro.form), -1.5, 1.5);
      factors.push({ k: 'Recent form', v: form, note: `Last three games against the season average: Tennessee ${ru.form >= 0 ? '+' : ''}${ru.form.toFixed(1)}, ${opp} ${ro.form >= 0 ? '+' : ''}${ro.form.toFixed(1)}` });
    } else factors.push({ k: 'Rest and recent form', v: 0, note: ru ? `Tennessee has had ${ru.rest} days since its last game. ${opp}'s schedule arrives with the next data update, so neither side is adjusted yet` : 'Not available yet' });
    const hu = +adj.ut || 0, ho = +adj.opp || 0;
    if (hu || ho) factors.push({ k: 'Your what-if', v: hu - ho, note: `${hu ? 'Tennessee ' + hu : ''}${hu && ho ? ', ' : ''}${ho ? opp + ' ' + ho : ''} points` });
    const margin = factors.reduce((s, f) => s + f.v, 0);
    // total points: opponent-adjusted offense and defense ratings when the site has them, season scoring otherwise
    let total, totalNote;
    if (sec[UT] && sec[opp] && sec[UT][2] != null && sec[opp][4] != null) {
      total = (+sec[UT][2] + +sec[opp][4] - NAT.pts) + (+sec[opp][2] + +sec[UT][4] - NAT.pts);
      totalNote = `Opponent-adjusted offense and defense ratings: Tennessee ${(+sec[UT][2]).toFixed(1)} / ${(+sec[UT][4]).toFixed(1)}, ${opp} ${(+sec[opp][2]).toFixed(1)} / ${(+sec[opp][4]).toFixed(1)}`;
    } else if (c && c.ppg && c.oppg) {
      total = ((c.ppg[0] + c.oppg[1]) / 2 + (c.ppg[1] + c.oppg[0]) / 2) * 0.7 + NAT.total * 0.3;
      totalNote = 'Each offense\'s points per game against the other defense\'s points allowed, pulled 30% toward the national average';
    } else { total = NAT.total; totalNote = 'National average (no team scoring data yet)'; }
    total = clamp(total, 30, 86);
    const m = clamp(margin, -total + 8, total - 8);
    return { opp, site, src, factors, margin, total, totalNote, ptsU: (total + m) / 2, ptsO: (total - m) / 2, ratingWin: phi(margin / cal.sd), rest: ru, restOpp: ro };
  };

  /* ====================================================================================================
     2. THE SIMULATION
     ==================================================================================================== */
  // a team's offense and defense as rates, from the season numbers in the preview (i = 0 Tennessee, 1 opponent)
  function profile(c, i, G) {
    const v = (k, d) => (c && c[k] && c[k][i] != null ? +c[k][i] : d);
    const sk = v('sacksAllowed', 2.2 * G) / G, rAttAll = v('rushYpg', 160) / Math.max(2.5, v('ypc', 4.3)), pAtt = v('passYpg', 230) / Math.max(4.5, v('ypa', 7.4));
    const rAtt = Math.max(15, rAttAll - sk), ypc = (v('rushYpg', 160) + sk * 6.5) / rAtt;        // college rushing counts sacks: take them back out
    const plays = rAtt + pAtt + sk, dsk = v('sacks', 2.2 * G) / G;
    return {
      runShare: clamp(rAtt / plays, 0.36, 0.66), ypc, ypa: v('ypa', 7.4), cmp: v('cmpPct', 61.5), intR: v('intThrown', 0.8 * G) / G / pAtt, sackR: sk / (pAtt + sk),
      fumR: Math.max(0, v('toLost', 1.4 * G) - v('intThrown', 0.8 * G)) / G / plays, plays,
      d: { ypc: v('oYpc', 4.3) + dsk * 0.18, passK: v('oPassYpg', 228) / 228, cmp: v('oCmpPct', 61.5), intR: v('defInt', 0.8 * G) / G / 32, sackR: dsk / 35, fumR: Math.max(0, v('takeaways', 1.4 * G) - v('defInt', 0.8 * G)) / G / 70 }
    };
  }
  // one offense against one defense: multiply the two edges over the national average, then pull a quarter of the way back to average
  // (nine games is a small sample, and extreme numbers rarely hold up)
  function matchup(o, d) {
    const mix = (off, def, nat, lo, hi) => clamp((off * def / nat) * 0.75 + nat * 0.25, lo, hi);
    const m = { runShare: o.runShare, ypc: mix(o.ypc, d.d.ypc, NAT.ypc, 3.2, 7.2), ypa: clamp((o.ypa * Math.pow(d.d.passK, 0.8)) * 0.75 + NAT.ypa * 0.25, 5, 10.5), cmp: mix(o.cmp, d.d.cmp, NAT.cmp, 48, 74),
      intR: mix(o.intR, d.d.intR, NAT.intR, 0.01, 0.05), sackR: mix(o.sackR, d.d.sackR, NAT.sackR, 0.025, 0.12), fumR: mix(o.fumR, d.d.fumR, NAT.fumR, 0.003, 0.016), plays: o.plays, k: 1, tempo: 1 };
    return m;
  }
  // one game. Ms = [Tennessee's offense vs their defense, their offense vs Tennessee's defense]. rec (optional) collects every play.
  function simGame(Ms, seed, rec, names) {
    const R = rng(seed * 7919 + 13), chance = p => R() < p, rr = (a, b) => a + R() * (b - a);
    const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const expo = m => -Math.log(1 - R() * 0.9999) * m;
    const st = { sc: [0, 0], q: 1, clk: 900, poss: 0, ball: 25, down: 1, togo: 10, over: false, ot: 0, inOT: false };
    const T = [0, 1].map(() => ({ plays: 0, rushA: 0, rushY: 0, att: 0, cmp: 0, passY: 0, sacks: 0, sackY: 0, int: 0, fum: 0, fd: 0, t3a: 0, t3c: 0, top: 0, q: [0, 0, 0, 0, 0], punts: 0, fga: 0, fgm: 0, drives: 0, big: 0, td: 0,
      qb: { att: 0, cmp: 0, yds: 0, td: 0, int: 0 }, rb: { car: 0, yds: 0, td: 0 }, wr: { rec: 0, yds: 0, td: 0 } }));
    let first = null, driveStart = null, lat = 0;
    const NM = names || [{}, {}], tn = i => (i === 0 ? UT : NM[1].team || 'Opponent');
    const log = (type, o, y, text, x) => {
      if (!rec) return;
      const e = Object.assign({ type, o, y: y || 0, text, q: pre.q, clk: pre.clk, down: pre.down, togo: pre.togo, ball: pre.ball, end: x && x.end != null ? x.end : st.ball, sc: st.sc.slice(), lat: pre.lat }, x || {});
      rec.push(e);
    };
    let pre = {};
    const snap0 = () => { pre = { q: st.inOT ? 4 + st.ot : st.q, clk: st.inOT ? 0 : st.clk, down: st.down, togo: st.togo, ball: st.ball, lat }; };
    const score = (i, n) => { st.sc[i] += n; T[i].q[Math.min(4, (st.inOT ? 5 : st.q) - 1)] += n; if (first == null) first = i; };
    function tick(sec, o) {
      if (st.inOT) return;
      sec = Math.min(sec, st.clk); st.clk -= sec; if (o != null) T[o].top += sec;
    }
    // what happens when a quarter runs out; returns true when the drive is over (halftime, end of regulation)
    function quarterEnd() {
      if (st.inOT || st.clk > 0) return false;
      if (st.q === 2) { st.q = 3; st.clk = 900; kickoff(1 - opening, true); return true; }
      if (st.q >= 4) { st.over = true; return true; }
      st.q++; st.clk = 900; return false;
    }
    const flip = spot => { st.poss = 1 - st.poss; st.ball = clamp(Math.round(100 - spot), 1, 99); st.down = 1; st.togo = Math.min(10, 100 - st.ball); T[st.poss].drives++; lat = clamp(lat + gauss() * 4, -8, 8); };
    function kickoff(recv, silent) {
      const k = 1 - recv; st.poss = k; st.ball = 35; st.down = 0; st.togo = 0; snap0();
      const late = st.q === 4 && st.clk < 200 && st.sc[k] < st.sc[recv] && st.sc[recv] - st.sc[k] <= 16 && !st.inOT;
      if (late && chance(0.7)) {       // an onside kick
        const got = chance(0.12);
        st.poss = got ? k : recv; st.ball = got ? 47 : 53; st.down = 1; st.togo = 10; T[st.poss].drives++; tick(4, null);
        log('ko', k, 0, got ? `Onside kick: ${tn(k)} recovers!` : `Onside kick: ${tn(recv)} falls on it.`, { onside: true, key: true, recv, end: 47 }); return;
      }
      st.poss = recv; st.down = 1; st.togo = 10; T[recv].drives++; lat = 0;
      if (chance(0.62)) { st.ball = 25; log('ko', k, 0, `Kickoff: touchback. ${tn(recv)} starts at its 25.`, { recv, tb: true, end: 75 }); return; }
      if (chance(0.006)) { tick(12, null); st.ball = 100; score(recv, 6); log('ko', k, 100, `Kickoff returned all the way for a ${tn(recv)} touchdown!`, { recv, td6: true, key: true, end: 100 }); pat(recv); ko(k); return; }
      st.ball = clamp(Math.round(25 + gauss() * 7), 8, 48); tick(6, null);
      log('ko', k, 0, `Kickoff returned to the ${tn(recv)} ${st.ball}.`, { recv, end: 100 - st.ball });
    }
    function pat(i) {
      const lead = st.sc[i] - st.sc[1 - i];
      const two = st.inOT ? st.ot >= 2 : (st.q === 4 && (lead === -2 || lead === -5 || lead === 1 || lead === 5 || (lead === -10 && st.clk < 400)));
      st.poss = i; st.ball = 97; st.down = 0; st.togo = 3; snap0();
      if (two) { const ok = chance(0.43); if (ok) score(i, 2); log('pat', i, 0, `Two-point try ${ok ? 'is good' : 'fails'}.`, { two: true, good: ok, key: true }); }
      else { const ok = chance(0.965); if (ok) score(i, 1); log('pat', i, 0, ok ? 'Extra point is good.' : 'Extra point is no good!', { good: ok }); }
    }
    const dead = () => !st.inOT && st.clk <= 0 && (st.q === 2 || st.q >= 4);      // the half or the game just ended: no kickoff
    const ko = recv => { if (!st.inOT && !dead()) kickoff(recv); };
    const tdAfter = o => { T[o].td++; pat(o); ko(1 - o); };
    function play() {
      const o = st.poss, d = 1 - o, M = Ms[o], N = NM[o] || {}, DN = NM[d] || {};
      const lead = st.sc[o] - st.sc[d], late = st.q === 4 && !st.inOT, twoMin = !st.inOT && (st.q === 2 || st.q === 4) && st.clk < 120;
      snap0();
      // victory formation
      if (late && lead > 0 && st.clk <= 38 * (4 - st.down) + 2) {
        const t = Math.min(st.clk, 40); st.ball = Math.max(1, st.ball - 1); st.down++; st.togo++; tick(t, o); T[o].plays++;
        log('kneel', o, -1, `${tn(o)} takes a knee.`, {}); if (st.down > 4 && st.clk > 0) flip(st.ball); return quarterEnd();
      }
      // a flag before the snap or during the play (about one snap in eighteen)
      if (chance(0.055)) {
        const onO = chance(0.55);
        if (onO) { const y = chance(0.6) ? 5 : 10, a = Math.min(y, Math.floor(st.ball / 2)); st.ball -= a; st.togo += a; log('pen', o, -a, `Flag: ${y === 5 ? 'false start' : 'holding'} on ${tn(o)}, ${a} yards.`, {}); }
        else { const y = chance(0.6) ? 5 : 15, a = Math.min(y, Math.floor((100 - st.ball) / 2)); st.ball += a; if (y === 15 || a >= st.togo) { st.down = 1; st.togo = Math.min(10, 100 - st.ball); T[o].fd++; } else st.togo -= a; log('pen', o, a, `Flag: ${y === 5 ? 'offside' : chance(0.5) ? 'pass interference' : 'personal foul'} on ${tn(d)}, ${a} yards${y === 15 ? ' and a first down' : ''}.`, {}); }
        return false;
      }
      if (st.down === 4) { const r = fourth(o, d, lead, late); if (r !== 'go') return r; }
      // run or pass
      let pRun = M.runShare + (st.down === 1 ? 0.05 : 0);
      if (st.down === 2 && st.togo >= 8) pRun -= 0.12;
      if (st.down >= 3) pRun = st.togo <= 2 ? 0.66 : st.togo <= 5 ? 0.3 : 0.12;
      if (st.ball >= 96) pRun += 0.15;
      if (twoMin && !(late && lead > 0)) pRun *= 0.4;
      if (late && lead > 0) pRun = Math.max(pRun, st.clk < 360 ? 0.78 : 0.62);
      if (late && lead < 0 && st.clk < 420) pRun *= lead < -8 ? 0.3 : 0.6;
      if (st.q === 3 && lead <= -17) pRun *= 0.75;
      const hurry = !st.inOT && ((twoMin && lead <= 0) || (late && lead < 0 && st.clk < 300) || (st.q === 2 && st.clk < 120));
      const tm = () => clamp((hurry ? 15 : late && lead > 0 ? 39 : 27 * M.tempo) + gauss() * 5, 8, 42);
      const was3 = st.down === 3 || st.down === 4; if (st.down === 3) T[o].t3a++;
      let y = 0, text = '', type = 'run', x = {}, stop = false, to = null;
      T[o].plays++;
      if (chance(pRun)) {
        const kk = st.ball >= 75 ? clamp(Math.pow(M.k, 2.4), 0.4, 3) : Math.pow(M.k, 0.4), ypc = M.ypc * kk * 1.08, pBig = clamp(0.13 * ypc / NAT.ypc, 0.05, 0.22), mu = (ypc + 0.17 * 1.5 - pBig * 21) / (1 - 0.17 - pBig), z = R();
        y = z < 0.17 ? -Math.floor(R() * 4) : z < 0.17 + pBig ? Math.round(10 + expo(11)) : Math.max(0, Math.round(mu + gauss() * 2.6));
        if (st.ball >= 95) y = Math.min(y, Math.round(y * 0.7 + 1));                           // a short field squeezes the run game
        y = Math.min(y, 100 - st.ball);
        const lead1 = chance(0.62), who = N.rb && lead1 ? N.rb : null; x.who = who; x.lane = rr(-1, 1);      // always draw, so a game is the same with or without names
        T[o].rushA++; T[o].rushY += y; if (who) { T[o].rb.car++; T[o].rb.yds += y; }
        if (chance(M.fumR * 0.9) && st.ball + y < 100) { to = 'fum'; text = `${who || tn(o)} fumbles after ${y > 0 ? 'a gain of ' + y : 'the handoff'}: ${tn(d)} recovers!`; }
        else if (st.ball + y >= 100) { text = `${who || tn(o)}: ${y}-yard touchdown run!`; if (who) T[o].rb.td++; }
        else text = y >= 15 ? `${who || tn(o)} breaks free for ${y} yards.` : y > 0 ? `${who || tn(o) + ' run'}${who ? ' runs' : ''} for ${y} yard${y === 1 ? '' : 's'}.` : y === 0 ? `${who || tn(o)} is stopped for no gain${DN.tkl ? ' by ' + DN.tkl : ''}.` : `${who || tn(o)} is dropped for a loss of ${-y}${DN.tkl ? ' by ' + DN.tkl : ''}.`;
        tick(5 + tm(), o);
      } else {
        const qb = N.qb || null;
        if (chance(M.sackR * (st.down === 3 && st.togo >= 7 ? 1.5 : 0.9))) {
          type = 'sack'; y = -Math.round(4 + R() * 6); y = Math.max(y, -st.ball + 1); T[o].sacks++; T[o].sackY += y; x.who = qb;
          if (chance(0.045)) { to = 'fum'; text = `${qb || tn(o)} is hit and loses the ball: ${tn(d)} recovers!`; } else text = `${qb || tn(o) + ' QB'} is sacked for a loss of ${-y}${DN.sack ? ' by ' + DN.sack : ''}.`;
          tick(5 + tm(), o);
        } else if (chance(0.05)) {
          type = 'run'; x.scr = true; x.who = qb; y = Math.min(Math.round(1 + R() * 10), 100 - st.ball); T[o].rushA++; T[o].rushY += y; x.lane = chance(0.5) ? 1 : -1;
          text = st.ball + y >= 100 ? `${qb || tn(o) + ' QB'} scrambles in for the touchdown!` : `${qb || tn(o) + ' QB'} scrambles for ${y}.`; tick(5 + tm(), o);
        } else {
          type = 'pass';
          const deep = chance(0.19 + (st.down === 3 && st.togo >= 10 ? 0.1 : 0) + (late && lead < -8 ? 0.1 : 0)), c0 = M.cmp / 100, cS = Math.min(0.86, c0 * 1.13), cD = c0 * 0.62;
          const base = 0.79 * cS * 9 + 0.21 * cD * 31, kk = st.ball >= 75 ? clamp(Math.pow(M.k, 2.4), 0.4, 3) : Math.pow(M.k, 0.4), sc = M.ypa * kk * 1.1 / base;
          const top1 = chance(0.3), tgt = N.wr && top1 ? N.wr : null; x.who = qb; x.tgt = tgt; x.deep = deep; x.side = chance(0.5) ? 1 : -1;
          T[o].att++; T[o].qb.att++;
          if (chance(M.intR * (deep ? 1.9 : 0.8) * (late && lead < 0 ? 1.3 : 1))) {
            to = 'int'; type = 'int'; x.air = deep ? Math.round(22 + R() * 14) : Math.round(5 + R() * 9); x.air = Math.min(x.air, 99 - st.ball); x.ret = Math.round(R() * 14);
            T[o].int++; T[o].qb.int++; text = `${qb || tn(o) + ' pass'}${qb ? "'s pass" : ''} is intercepted${DN.int ? ' by ' + DN.int : ''}!`; tick(7, o);
          } else if (chance(deep ? cD : cS)) {
            y = Math.round((deep ? 18 + expo(13) : 1 + R() * 8 + expo(4)) * sc); y = clamp(y, deep ? 15 : -2, 100 - st.ball);
            x.air = clamp(deep ? y - Math.round(R() * 5) : Math.min(y, Math.round(1 + R() * 7)), 0, Math.max(0, y));
            T[o].cmp++; T[o].passY += y; T[o].qb.cmp++; T[o].qb.yds += y; if (tgt) { T[o].wr.rec++; T[o].wr.yds += y; }
            if (chance(M.fumR * 0.7) && st.ball + y < 100) { to = 'fum'; text = `${tgt || tn(o)} makes the catch and fumbles: ${tn(d)} ball!`; }
            else if (st.ball + y >= 100) { text = `${qb || tn(o)}${tgt ? ' to ' + tgt : ' pass'}: ${y}-yard touchdown!`; T[o].qb.td++; if (tgt) T[o].wr.td++; }
            else text = deep ? `${qb || tn(o)} goes deep${tgt ? ' to ' + tgt : ''}: ${y} yards.` : `${qb || tn(o) + ' pass'}${qb ? (tgt ? ' finds ' + tgt : ' completes it') : ' complete'} for ${y} yard${y === 1 ? '' : 's'}.`;
            const oob = chance(hurry ? 0.4 : 0.15); tick(oob ? 7 : 5 + tm(), o);
          } else { type = 'inc'; x.air = deep ? Math.round(24 + R() * 14) : Math.round(4 + R() * 9); text = `${qb || tn(o) + ' pass'}${qb ? "'s pass" : ''}${tgt ? ' for ' + tgt : ''} is incomplete${deep ? ' deep downfield' : ''}.`; tick(6, o); }
        }
      }
      if (y >= 20) T[o].big++;
      // the result
      if (to) {
        T[o][to === 'int' ? 'int' : 'fum'] += to === 'int' ? 0 : 1;
        const spot = to === 'int' ? st.ball + x.air : st.ball + y;
        if (chance(to === 'int' ? 0.09 : 0.05)) { st.ball = clamp(spot, 1, 99); log(type, o, to === 'int' ? 0 : y, text + ' Returned for a touchdown!', Object.assign(x, { to, key: true, td6: true, end: st.ball })); score(d, 6); st.poss = d; st.ball = 99; tdAfter(d); return st.inOT ? true : quarterEnd(); }
        const ret = to === 'int' ? x.ret : 0;
        log(type, o, to === 'int' ? 0 : y, text, Object.assign(x, { to, key: true, end: clamp(spot, 1, 99) }));
        flip(clamp(spot - ret, 1, 99)); return st.inOT ? true : quarterEnd();
      }
      st.ball += y;
      if (st.ball >= 100) { st.ball = 100; if (was3 && pre.down === 3) T[o].t3c++; T[o].fd++; score(o, 6); log(type, o, y, text, Object.assign(x, { td: true, key: true, end: 100 })); tdAfter(o); return st.inOT ? true : quarterEnd(); }
      if (st.ball <= 0) { st.ball = 1; score(d, 2); log(type, o, y, text + ' Safety!', Object.assign(x, { safety: true, key: true })); ko(d); return quarterEnd(); }
      if (y >= st.togo) { if (pre.down === 3) T[o].t3c++; T[o].fd++; st.down = 1; st.togo = Math.min(10, 100 - st.ball); x.first = true; if (pre.down === 4) { x.key = true; text += ' First down!'; } }
      else { st.down++; st.togo -= y; }
      if (y >= 20) x.key = true;
      if (type === 'sack' && pre.down === 3) x.key = true;
      log(type, o, y, text, x);
      if (st.down > 4) { if (rec) rec[rec.length - 1].text += ' Turnover on downs.'; if (rec) rec[rec.length - 1].key = true; flip(st.ball); return st.inOT ? true : quarterEnd(); }
      return quarterEnd();
    }
    function fourth(o, d, lead, late) {
      const fgDist = 100 - st.ball + 17, endHalf = !st.inOT && st.q === 2 && st.clk < 30;
      let go = false;
      if (st.inOT) go = (otNeed != null && otNeed > 3) || (fgDist > 50 && otNeed == null ? st.togo <= 3 : false) || (otNeed === 3 && fgDist > 52);
      else if (late && lead < 0 && (st.clk < 150 || (st.clk < 330 && lead < -8)) && !(lead >= -3 && fgDist <= 52)) go = true;
      else if (st.togo <= 1 && st.ball >= 30) go = chance(0.8);                                  // modern college offenses go for it about twice a game
      else if (st.togo <= 2 && st.ball >= 45) go = chance(st.ball >= 96 ? 0.6 : fgDist <= 40 ? 0.45 : 0.7);
      else if (st.togo <= 4 && st.ball >= 52 && fgDist > 47) go = chance(0.55);
      if (!go && fgDist > 54 && st.ball >= 63) go = true;                    // too far to kick, too close to punt
      if (go) return 'go';
      if (fgDist <= 54 && (fgDist <= 49 || endHalf || late || st.inOT)) {
        const p = fgDist < 30 ? 0.97 : fgDist < 40 ? 0.88 : fgDist < 50 ? 0.72 : 0.5, ok = chance(p);
        T[o].fga++; tick(5, o);
        if (ok) { T[o].fgm++; score(o, 3); log('fg', o, 0, `${fgDist}-yard field goal is good.`, { good: true, dist: fgDist, key: true }); ko(d); return st.inOT ? true : quarterEnd(); }
        log('fg', o, 0, `${fgDist}-yard field goal is no good.`, { good: false, dist: fgDist, key: true });
        flip(Math.min(st.ball, 80)); return st.inOT ? true : quarterEnd();
      }
      // punt
      T[o].punts++;
      let net = clamp(Math.round(38.5 + gauss() * 7), 12, 66), spot = st.ball + net, tb = false;
      if (spot >= 100) { spot = 80; tb = true; net = spot - st.ball; }
      tick(8, o);
      if (chance(0.004)) { log('punt', o, net, `Punt returned all the way for a ${tn(d)} touchdown!`, { net, td6: true, key: true, end: clamp(spot, 1, 99) }); score(d, 6); st.poss = d; tdAfter(d); return quarterEnd(); }
      log('punt', o, net, tb ? 'Punt into the end zone: touchback.' : `Punt: ${tn(d)} takes over at its ${100 - spot}.`, { net, end: clamp(spot, 1, 99) });
      flip(spot); return quarterEnd();
    }
    let otNeed = null;
    const opening = chance(0.5) ? 0 : 1;      // who receives the opening kickoff
    kickoff(opening);
    let guard = 0;
    while (!st.over && guard++ < 600) play();
    // overtime, college rules: each side gets the ball at the 25; from the second overtime a touchdown must be followed by a two-point try;
    // from the third it is two-point tries only
    while (st.sc[0] === st.sc[1] && st.ot < 8) {
      st.inOT = true; st.ot++;
      const order = st.ot % 2 ? [opening, 1 - opening] : [1 - opening, opening];
      if (st.ot >= 3) { for (const i of order) { st.poss = i; st.ball = 97; st.down = 1; st.togo = 3; snap0(); const ok = chance(0.43); if (ok) score(i, 2); log('pat', i, 0, `Overtime ${st.ot}: ${tn(i)}'s two-point try ${ok ? 'is good' : 'fails'}.`, { two: true, good: ok, key: true }); } continue; }
      let firstPts = null;
      for (const i of order) {
        const before = st.sc[i]; st.poss = i; st.ball = 75; st.down = 1; st.togo = 10; otNeed = firstPts; T[i].drives++;
        let n = 0; while (st.poss === i && st.sc[i] === before && n++ < 30) { if (play() === true) break; }
        if (firstPts == null) firstPts = st.sc[i] - before; else otNeed = null;
        if (firstPts != null && i === order[1]) break;
      }
      otNeed = null;
    }
    return { sc: st.sc, T, ot: st.ot, first, seed };
  }

  // Tune each offense until the average simulated score matches the model's expected score, and the pace until the play count matches
  // the two teams' season averages. The dial (k) works mostly on finishing drives inside the 25 and a little on yardage everywhere,
  // because that is where real teams with the same yardage differ in points. A few quick passes on 200 games get close; the rest are
  // run on the same 1,000 games that are reported, until the averages are within a quarter of a point.
  function calibrate(Ms, m, N) {
    const want = [m.ptsU, m.ptsO], plays = Ms[0].plays + Ms[1].plays;
    let out = null;
    for (let it = 0; it < 10; it++) {
      const n = it < 5 ? 200 : N, games = [];
      let a = 0, b = 0, pl = 0;
      for (let i = 0; i < n; i++) { const r = simGame(Ms, 1000 + i); a += r.sc[0]; b += r.sc[1]; pl += r.T[0].plays + r.T[1].plays; if (it >= 5) games.push(r); }
      a /= n; b /= n;
      if (it >= 5) { out = games; if ((Math.abs(a - want[0]) < 0.25 && Math.abs(b - want[1]) < 0.25) || it === 9) break; }
      const e = it < 5 ? 0.45 : 0.4;
      Ms[0].k = clamp(Ms[0].k * Math.pow(clamp(want[0] / Math.max(3, a), 0.7, 1.4), e), 0.55, 1.9); Ms[1].k = clamp(Ms[1].k * Math.pow(clamp(want[1] / Math.max(3, b), 0.7, 1.4), e), 0.55, 1.9);
      if (it < 5) { const tf = clamp((pl / n) / plays, 0.85, 1.18); Ms[0].tempo = Ms[1].tempo = clamp(Ms[0].tempo * tf, 0.7, 1.4); }
    }
    return out;
  }
  const pctl = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };

  VP.run = (g, P, ctx, adj, N) => {
    N = N || 1000; P = P || {};
    const m = VP.model(g, P, ctx, adj); if (!m) return null;
    const G0 = gamesIn(ctx && ctx.record), G1 = gamesIn(P.record), c = P.compare || null;
    const pu = profile(c, 0, G0), po = profile(c, 1, G1), Ms = [matchup(pu, po), matchup(po, pu)];
    const games = calibrate(Ms, m, N);
    const sims = []; let w = 0, ot = 0, one = 0;
    const agg = [0, 1].map(() => ({ pts: 0, rushY: 0, passY: 0, to: 0, plays: 0, sacks: 0, t3a: 0, t3c: 0, top: 0, fd: 0 }));
    const cond = { toWin: [0, 0], toLose: [0, 0], rushWin: [0, 0], first: [0, 0], oppFirst: [0, 0], big: [0, 0] };
    for (let i = 0; i < N; i++) {
      const r = games[i]; const win = r.sc[0] > r.sc[1];
      sims.push({ u: r.sc[0], o: r.sc[1], ot: r.ot, seed: 1000 + i, ru: r.T[0].rushY + r.T[0].sackY, toU: r.T[0].int + r.T[0].fum, toO: r.T[1].int + r.T[1].fum, first: r.first, bigU: r.T[0].big, bigO: r.T[1].big });
      w += win; ot += r.ot ? 1 : 0; one += Math.abs(r.sc[0] - r.sc[1]) <= 8 ? 1 : 0;
      [0, 1].forEach(t => { const a = agg[t], x = r.T[t]; a.pts += r.sc[t]; a.rushY += x.rushY + x.sackY; a.passY += x.passY; a.to += x.int + x.fum; a.plays += x.plays; a.sacks += x.sacks; a.t3a += x.t3a; a.t3c += x.t3c; a.top += x.top; a.fd += x.fd; });
    }
    const medRush = pctl(sims.map(s => s.ru), 0.5);
    sims.forEach(s => {
      const win = s.u > s.o ? 1 : 0;
      if (s.toU < s.toO) { cond.toWin[0] += win; cond.toWin[1]++; } if (s.toU > s.toO) { cond.toLose[0] += win; cond.toLose[1]++; }
      if (s.ru >= medRush) { cond.rushWin[0] += win; cond.rushWin[1]++; }
      if (s.first === 0) { cond.first[0] += win; cond.first[1]++; } else { cond.oppFirst[0] += win; cond.oppFirst[1]++; }
      if (s.bigU > s.bigO) { cond.big[0] += win; cond.big[1]++; }
    });
    const mar = sims.map(s => s.u - s.o), mean = mar.reduce((a, b) => a + b, 0) / N, sd = Math.sqrt(mar.reduce((a, b) => a + (b - mean) * (b - mean), 0) / N);
    const medU = pctl(sims.map(s => s.u), 0.5), medO = pctl(sims.map(s => s.o), 0.5), favU = w >= N / 2;
    // the game to show: the one nearest the middle of all of them, won by the side that wins most often
    const near = (tu, to, wantU) => sims.slice().sort((a, b) => (Math.abs(a.u - tu) + Math.abs(a.o - to) + ((a.u > a.o) === wantU ? 0 : 60) + (a.ot ? 4 : 0)) - (Math.abs(b.u - tu) + Math.abs(b.o - to) + ((b.u > b.o) === wantU ? 0 : 60) + (b.ot ? 4 : 0)))[0];
    let pu2 = medU, po2 = medO; if ((pu2 > po2) !== favU || pu2 === po2) { if (favU) pu2 = po2 + 1; else po2 = pu2 + 1; }
    const upsetPool = sims.filter(s => (s.u > s.o) !== favU), up = upsetPool.length ? upsetPool.slice().sort((a, b) => Math.abs(Math.abs(a.u - a.o) - 6) - Math.abs(Math.abs(b.u - b.o) - 6))[0] : null;
    const bestU = sims.slice().sort((a, b) => (a.u - a.o) - (b.u - b.o))[Math.round(0.9 * (N - 1))];
    const hist = [[-99, -22], [-21, -15], [-14, -8], [-7, -1], [1, 7], [8, 14], [15, 21], [22, 99]].map(([lo, hi]) => ({ lo, hi, n: mar.filter(x => x >= lo && x <= hi).length }));
    return { g, P, ctx, m, Ms, N, win: w / N, ot: ot / N, one: one / N, mean, sd, medU: pu2, medO: po2, avg: agg.map(a => { const o = {}; for (const k in a) o[k] = a[k] / N; return o; }), cond, medRush, hist, sims,
      picks: { likely: near(pu2, po2, favU), upset: up, best: bestU }, p10: pctl(mar, 0.1), p90: pctl(mar, 0.9), favU };
  };
  // the names used in the play-by-play: quarterback, lead back, lead receiver, and the other side's top tackler, pass rusher and ball hawk
  function namesFor(P, ctx, opp) {
    const pickN = (list, what, pos) => { const x = (list || []).find(z => z.what === what && (!pos || pos.test(z.pos || ''))); return x ? x.name.split(' ').slice(-1)[0] : null; };
    const side = (list, qb) => ({ qb: qb || pickN(list, 'passing'), rb: pickN(list, 'rushing'), wr: pickN(list, 'receiving'), tkl: pickN(list, 'defensive'), sack: pickN(list, 'defensive', /DL|DE|DT|EDGE|LB/) || pickN(list, 'dl'), int: pickN(list, 'interceptions') });
    const u = side(P.utImpact, ctx && ctx.utQB ? ctx.utQB.split(' ').slice(-1)[0] : null), o = side(P.impact); u.team = UT; o.team = opp;
    // an offense's play is defended by the other team's players
    return [Object.assign({}, u, { team: UT }), Object.assign({}, o, { team: opp })].map((x, i) => x);
  }
  VP.game = (res, seed, ctx) => {
    const nm = namesFor(res.P, ctx, res.g.opp);
    // offense names from its own side; defensive names from the other side
    const NM = [{ team: UT, qb: nm[0].qb, rb: nm[0].rb, wr: nm[0].wr }, { team: res.g.opp, qb: nm[1].qb, rb: nm[1].rb, wr: nm[1].wr }];
    const DEF = [{ tkl: nm[0].tkl, sack: nm[0].sack, int: nm[0].int }, { tkl: nm[1].tkl, sack: nm[1].sack, int: nm[1].int }];
    const names = [Object.assign({}, NM[0]), Object.assign({}, NM[1])];
    // simGame reads the defender names from the defending team's entry
    names[0].tkl = DEF[0].tkl; names[0].sack = DEF[0].sack; names[0].int = DEF[0].int; names[1].tkl = DEF[1].tkl; names[1].sack = DEF[1].sack; names[1].int = DEF[1].int;
    const rec = []; const r = simGame(res.Ms, seed, rec, names);
    // win probability after every play: the lead, the pregame edge that is left, who has the ball and where
    const sd = res.sd || 15, m = res.m.margin;
    rec.forEach((p, pi) => {
      const left = p.q > 4 ? 0.02 : clamp(((4 - p.q) * 900 + p.clk) / 3600, 0, 1);
      const nx = rec[pi + 1], ep = !nx || nx.type === 'ko' || nx.type === 'pat' ? 0 : (-1.2 + 0.07 * nx.ball) * (nx.o === 0 ? 1 : -1);   // what the next snap's field position is worth
      p.wp = phi((p.sc[0] - p.sc[1] + m * left + ep * Math.min(1, left * 6 + 0.15)) / (sd * Math.sqrt(left) + 1.2));
    });
    return { rec, sc: r.sc, T: r.T, ot: r.ot, names };
  };

  /* ====================================================================================================
     3. THE REPORT
     ==================================================================================================== */
  const pc = x => Math.round(x * 100) + '%';
  const css = () => {
    if (document.getElementById('vpCss')) return;
    const s = document.createElement('style'); s.id = 'vpCss';
    s.textContent = `
.vp{--vp-opp:#5E6670}.vp h4{margin:18px 0 8px;font:700 15px Archivo,system-ui,sans-serif}.vp p{margin:6px 0}
.vp-score{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)}
.vp-team{display:flex;flex-direction:column;gap:2px;min-width:0}.vp-team.r{text-align:right;align-items:flex-end}.vp-team b{font:800 clamp(30px,7vw,46px)/1 Archivo,system-ui,sans-serif;font-variant-numeric:tabular-nums}
.vp-team span{font-weight:600;overflow-wrap:anywhere}.vp-mid{text-align:center;color:var(--muted);font-size:13px}
.vp-bar{display:flex;height:26px;border-radius:6px;overflow:hidden;margin:10px 0 4px;font:700 13px Archivo,system-ui,sans-serif}
.vp-bar i{display:flex;align-items:center;padding:0 8px;font-style:normal;color:#fff;white-space:nowrap;min-width:0}.vp-bar i:first-child{background:#FF8200;color:#1a1a1a}.vp-bar i:last-child{background:var(--vp-opp);justify-content:flex-end;margin-left:2px}
.vp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.vp-chips span{border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:13px;background:var(--surface)}.vp-chips b{font-variant-numeric:tabular-nums}
.vp-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.vp-hist{width:100%;height:auto;display:block}.vp-hist text{font:12px 'Source Sans 3',system-ui,sans-serif;fill:var(--fg)}.vp-hist .ax{fill:var(--muted);font-size:11px}
.vp-fac{width:100%;border-collapse:collapse;font-size:14px}.vp-fac td{padding:6px 4px;border-top:1px solid var(--line);vertical-align:top}.vp-fac td.n{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}
.vp-fac small{display:block;color:var(--muted);line-height:1.3}.vp-fac tr.tot td{border-top:2px solid var(--line-strong);font-weight:700}
.vp-keys{margin:0;padding-left:18px}.vp-keys li{margin:5px 0}
.vp-what{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:14px}.vp-what select{font:inherit;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--fg);max-width:100%}
.vp-watch{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.vp-btn{font:700 14px Archivo,system-ui,sans-serif;padding:9px 14px;border-radius:8px;border:1px solid var(--line-strong);background:var(--surface);color:var(--fg);cursor:pointer}
.vp-btn.pri{background:#FF8200;border-color:#FF8200;color:#1a1a1a}.vp-btn[aria-pressed="true"]{background:var(--fg);color:var(--surface)}.vp-btn:focus-visible{outline:2px solid var(--orange);outline-offset:2px}
.vp-stage{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#101510;margin-top:8px}
.vp-bug{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;background:#161616;color:#fff;font:700 15px Archivo,system-ui,sans-serif}
.vp-bug .t{display:flex;align-items:center;gap:8px;padding:8px 12px;min-width:0}.vp-bug .t.r{flex-direction:row-reverse}.vp-bug .t i{width:10px;height:26px;border-radius:2px;flex:none}.vp-bug .t b{font-size:24px;font-variant-numeric:tabular-nums}
.vp-bug .t em{font-style:normal;width:8px;height:8px;border-radius:50%;background:#FFD21F;visibility:hidden}.vp-bug .t.has em{visibility:visible}
.vp-bug .c{padding:4px 12px;text-align:center;font-variant-numeric:tabular-nums;border-left:1px solid #333;border-right:1px solid #333}.vp-bug .c small{display:block;font:600 11px 'Source Sans 3',system-ui,sans-serif;color:#bbb}
.vp-dd{background:#222;color:#eee;font:600 13px 'Source Sans 3',system-ui,sans-serif;padding:4px 12px;display:flex;justify-content:space-between;gap:10px}
.vp-cv{display:block;width:100%}.vp-call{background:#161616;color:#fff;padding:8px 12px;min-height:44px;font-size:15px;line-height:1.3}.vp-call b{color:#FFB25C}
.vp-wp{display:block;width:100%;height:64px;background:#161616}
.vp-ctl{display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:var(--surface-2);align-items:center}.vp-ctl .sp{flex:1}
.vp-log{max-height:220px;overflow:auto;border-top:1px solid var(--line);font-size:13.5px;background:var(--surface)}.vp-log>div{padding:4px 12px;border-bottom:1px solid var(--line);display:flex;gap:8px}.vp-log>div.k{background:var(--orange-soft)}.vp-log p{margin:0}.vp-log span{color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;flex:none;min-width:104px}
.vp-box{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}.vp-box th,.vp-box td{padding:5px 6px;border-top:1px solid var(--line);text-align:right}.vp-box th:first-child,.vp-box td:first-child{text-align:left}
.vp-note{color:var(--muted);font-size:13px}`;
    document.head.appendChild(s);
  };
  const short = n => teamOf(n).abbr;
  function histSvg(res) {
    const W = 520, H = 190, pad = 6, top = 22, bot = 34, bw = (W - pad * 2) / res.hist.length, max = Math.max(...res.hist.map(h => h.n)), o = short(res.g.opp);
    const lab = h => h.lo < -90 ? `${o} 22+` : h.hi > 90 ? 'UT 22+' : h.hi < 0 ? `${o} ${-h.hi}-${-h.lo}` : `UT ${h.lo}-${h.hi}`;
    return `<svg class="vp-hist" viewBox="0 0 ${W} ${H}" role="img" aria-label="How ${res.N} simulated games ended, by margin">${res.hist.map((h, i) => {
      const bh = Math.max(2, (H - top - bot) * h.n / max), x = pad + i * bw + 3, y = H - bot - bh;
      return `<rect x="${x}" y="${y}" width="${bw - 6}" height="${bh}" rx="4" fill="${h.lo > 0 ? '#FF8200' : 'var(--vp-opp)'}"><title>${lab(h)}: ${h.n} of ${res.N} games</title></rect><text x="${x + (bw - 6) / 2}" y="${y - 5}" text-anchor="middle" font-weight="700">${Math.round(h.n / res.N * 100)}%</text><text class="ax" x="${x + (bw - 6) / 2}" y="${H - bot + 15}" text-anchor="middle">${lab(h)}</text>`;
    }).join('')}<line x1="${pad}" x2="${W - pad}" y1="${H - bot}" y2="${H - bot}" stroke="var(--line-strong)"/><text class="ax" x="${W / 2}" y="${H - 4}" text-anchor="middle">Winner and margin of victory</text></svg>`;
  }
  function keys(res) {
    const c = res.P.compare, o = res.g.opp, a = res.avg, out = [], cd = res.cond, f = x => (x[1] ? Math.round(x[0] / x[1] * 100) : null);
    if (c && c.rushYpg && c.oRushYpg) out.push(`<b>The ground game.</b> Tennessee runs for ${c.rushYpg[0]} yards a game${c.ypc ? ` (${c.ypc[0]} a carry)` : ''}; ${esc(o)} allows ${c.oRushYpg[1]}${c.oYpc ? ` (${c.oYpc[1]} a carry)` : ''}. The simulation puts the Vols at about ${Math.round(a[0].rushY)} rushing yards. When they reach ${res.medRush} or more, they win ${f(cd.rushWin)}% of the time.`);
    if (cd.toWin[1] > 30 && cd.toLose[1] > 30) out.push(`<b>Turnovers.</b> Tennessee wins ${f(cd.toWin)}% of the simulated games where it wins the turnover battle, and ${f(cd.toLose)}% where it loses it${c && c.toMargin ? `. Season turnover margin: Tennessee ${c.toMargin[0] > 0 ? '+' : ''}${c.toMargin[0]}, ${esc(o)} ${c.toMargin[1] > 0 ? '+' : ''}${c.toMargin[1]}` : ''}.`);
    if (c && c.passYpg && c.oPassYpg) out.push(`<b>${esc(o)} through the air.</b> ${esc(o)} throws for ${c.passYpg[1]} yards a game against a Tennessee defense that allows ${c.oPassYpg[0]}${c.sacks ? ` and has ${c.sacks[0]} sacks` : ''}. Projected: about ${Math.round(a[1].passY)} passing yards and ${a[1].sacks.toFixed(1)} sacks taken.`);
    if (cd.first[1] > 30 && cd.oppFirst[1] > 30) out.push(`<b>The start.</b> Tennessee wins ${f(cd.first)}% when it scores first and ${f(cd.oppFirst)}% when ${esc(o)} does.`);
    return out;
  }
  // the same game as others see it, when the site has their numbers
  function others(res) {
    const E = res.ctx && res.ctx.espn || {}, pg = ((res.ctx && res.ctx.pear && res.ctx.pear.games) || []).find(x => x[0] === res.g.opp || String(x[0]).includes(res.g.opp)), out = [];
    if (E.win != null) out.push(`ESPN FPI ${(+E.win).toFixed(0)}%`);
    if (pg && pg[4] != null) out.push(`PEAR ${Math.round(pg[4])}% (${esc(pg[3])})`);
    if (E.line) out.push(`Line ${esc(E.line)}${E.ou ? ', over/under ' + esc(E.ou) : ''}`);
    return out.length ? `<p class="vp-note">For comparison, Tennessee's chances elsewhere: ${out.join(' · ')}.</p>` : '';
  }
  function report(res) {
    const g = res.g, o = g.opp, m = res.m, cal = CAL(), tO = teamOf(o), a = res.avg, bt = cal.backtest;
    const fav = m.margin >= 0 ? UT : o, sp = Math.abs(Math.round(res.mean * 2) / 2);
    const row = (l, x, y, d) => `<tr><td>${l}</td><td>${(+x).toFixed(d == null ? 0 : d)}</td><td>${(+y).toFixed(d == null ? 0 : d)}</td></tr>`;
    return `<div class="vp-score"><div class="vp-team"><span>Tennessee</span><b>${res.medU}</b></div><div class="vp-mid">Most likely<br>final score</div><div class="vp-team r"><span>${esc(o)}</span><b>${res.medO}</b></div></div>
      <div class="vp-bar" role="img" aria-label="Tennessee wins ${pc(res.win)} of simulations, ${esc(o)} ${pc(1 - res.win)}"><i style="flex:${Math.max(0.12, res.win)}">Tennessee ${pc(res.win)}</i><i style="flex:${Math.max(0.12, 1 - res.win)}">${esc(tO.abbr)} ${pc(1 - res.win)}</i></div>
      <div class="vp-chips"><span>Spread: <b>${sp === 0 ? 'Pick’em' : esc(fav) + ' by ' + sp}</b></span><span>Total: <b>${Math.round((a[0].pts + a[1].pts) * 2) / 2}</b></span><span>One-score game: <b>${pc(res.one)}</b></span><span>Overtime: <b>${pc(res.ot)}</b></span><span>Middle 80% of results: <b>${res.p10 > 0 ? 'UT by ' + res.p10 : res.p10 < 0 ? tO.abbr + ' by ' + -res.p10 : 'even'} to ${res.p90 > 0 ? 'UT by ' + res.p90 : res.p90 < 0 ? tO.abbr + ' by ' + -res.p90 : 'even'}</b></span></div>
      ${others(res)}
      <div class="vp-watch"><button class="vp-btn pri" data-vpw="likely">▶ Watch the most likely game</button>${res.picks.upset ? `<button class="vp-btn" data-vpw="upset">Watch ${esc(res.favU ? o : 'Tennessee')} pull the upset</button>` : ''}<button class="vp-btn" data-vpw="best">Watch Tennessee's best day</button></div>
      <div id="vpStage"></div>
      <div class="vp-two"><div><h4>${res.N.toLocaleString()} simulated games: how they ended</h4>${histSvg(res)}</div>
      <div><h4>What goes into the number</h4><table class="vp-fac"><tbody>${m.factors.map(f => `<tr><td>${esc(f.k)}<small>${esc(f.note)}</small></td><td class="n">${f.v > 0 ? 'UT +' + f.v.toFixed(1) : f.v < 0 ? esc(tO.abbr) + ' +' + (-f.v).toFixed(1) : '0.0'}</td></tr>`).join('')}
        <tr class="tot"><td>Expected margin<small>Expected total ${m.total.toFixed(1)}. ${esc(m.totalNote)}</small></td><td class="n">${m.margin >= 0 ? 'UT +' + m.margin.toFixed(1) : esc(tO.abbr) + ' +' + (-m.margin).toFixed(1)}</td></tr></tbody></table>
        <div class="vp-what"><label>What if Tennessee is <select data-vpadj="ut"><option value="0">at full strength</option><option value="-2">missing a key starter (−2)</option><option value="-4">missing several starters (−4)</option><option value="-6">without its starting QB (−6)</option></select></label><label>and ${esc(o)} is <select data-vpadj="opp"><option value="0">at full strength</option><option value="-2">missing a key starter (−2)</option><option value="-4">missing several starters (−4)</option><option value="-6">without its starting QB (−6)</option></select></label></div></div></div>
      <h4>What decides it</h4><ul class="vp-keys">${keys(res).map(k => `<li>${k}</li>`).join('')}</ul>
      <h4>Projected team numbers <span class="vp-note">(average of ${res.N.toLocaleString()} games)</span></h4>
      <div class="tablewrap"><table class="vp-box"><thead><tr><th></th><th>Tennessee</th><th>${esc(o)}</th></tr></thead><tbody>${row('Points', a[0].pts, a[1].pts, 1)}${row('Total yards', a[0].rushY + a[0].passY, a[1].rushY + a[1].passY)}${row('Rushing yards', a[0].rushY, a[1].rushY)}${row('Passing yards', a[0].passY, a[1].passY)}${row('First downs', a[0].fd, a[1].fd, 1)}${row('Third-down %', a[0].t3c / Math.max(1, a[0].t3a) * 100, a[1].t3c / Math.max(1, a[1].t3a) * 100)}${row('Turnovers', a[0].to, a[1].to, 1)}${row('Sacks allowed', a[0].sacks, a[1].sacks, 1)}${row('Time of possession (min)', a[0].top / 60, a[1].top / 60, 1)}</tbody></table></div>
      <details style="margin-top:14px"><summary><b>How this works, and how good it is</b></summary>
        <p>The margin comes from published power ratings (${m.src.map(s => s.k).join(', ')}), averaged, plus home field. Home field (${cal.hfa} points) and the usual miss around an expected margin (${cal.sd} points) were measured from ${esc(cal.fitted)}. Rest and recent form are added only when both teams' schedules are on the site. Series history is shown on the Series tab but is not in the number: once current team strength is counted, past meetings add nothing reliable.</p>
        <p>The game is then played snap by snap ${res.N.toLocaleString()} times. Each offense starts from its season rates against the other defense's, and its yardage is tuned so the average simulated score matches the expected score above. In these simulations the margin lands within ${Math.round(res.sd)} points of expected about two times in three.</p>
        ${bt ? `<p><b>Backtest.</b> The same margin formula, using Elo ratings, was fit on ${esc(bt.train)} and then asked to call ${esc(bt.test)} it had never seen: it picked the winner ${bt.accuracy}% of the time, missed the margin by ${bt.mae} points on average, and had a Brier score of ${bt.brier} (0.25 is a coin flip; lower is better).</p>
        <div class="tablewrap"><table class="vp-box"><thead><tr><th>Favorite's win chance</th><th>Games</th><th>Predicted</th><th>Actually won</th></tr></thead><tbody>${bt.calibration.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}%</td><td>${r[3]}%</td></tr>`).join('')}</tbody></table></div>
        <p class="vp-note">The live number uses SP+, FPI and PEAR instead of Elo, so the backtest checks the method, not this exact blend.</p>` : ''}
        <p class="vp-note">A simulation is an estimate, not a pick. Injuries and lineup news are not in the data unless you set them with the what-if menus.</p></details>`;
  }

  /* ====================================================================================================
     4. THE FIELD
     ==================================================================================================== */
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  // position on a path of [t, u, v] keyframes
  function at(path, t) {
    if (t <= path[0][0]) return path[0]; const n = path.length; if (t >= path[n - 1][0]) return path[n - 1];
    for (let i = 1; i < n; i++) if (t <= path[i][0]) { const a = path[i - 1], b = path[i], k = ease((t - a[0]) / Math.max(1e-6, b[0] - a[0])); return [t, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * k]; }
    return path[n - 1];
  }
  // 22 players and the ball for one play, in the offense's frame: u = yards past the line of scrimmage, v = yards across from the ball
  function stage(p, seed) {
    const R = rng(seed + 77), rr = (a, b) => a + R() * (b - a);
    const O = [[-0.6, -3], [-0.6, -1.5], [-0.4, 0], [-0.6, 1.5], [-0.6, 3], [-0.6, 4.7], [-4.6, 0], [-4.6, 1.9], [-0.4, -19], [-0.4, 19], [-1, -11]];   // OL x5, TE, QB, RB, WR, WR, slot
    const D = [[0.9, -3.6], [0.9, -1.2], [0.9, 1.2], [0.9, 3.6], [4.3, -4.6], [4.6, 0], [4.3, 4.6], [5.5, -19], [5.5, 19], [5, -11], [12.5, 2]];        // DL x4, LB x3, CB, CB, nickel, S
    const off = O.map(a => [[0, a[0], a[1]]]), def = D.map(a => [[0, a[0], a[1]]]), ball = [[0, -0.4, 0, 0]];
    const QB = 6, RB = 7, t0 = 0.5, y = p.y || 0, key = (a, t, u, v) => a.push([t, u, v]);
    let T = 2.4, flag = null, banner = null;
    const settle = (arr, t) => arr.forEach(a => { const l = a[a.length - 1]; if (l[0] < t) a.push([t, l[1], l[2]]); });
    const swarm = (u, v, t, n) => def.map((a, i) => ({ i, d: Math.hypot(a[a.length - 1][1] - u, a[a.length - 1][2] - v) })).sort((a, b) => a.d - b.d).slice(0, n).forEach((x, k) => key(def[x.i], t, u + (k ? rr(-1, 1) : 0.4), v + (k ? rr(-1.4, 1.4) : 0)));
    off.concat(def).forEach(a => key(a, t0, a[0][1], a[0][2])); ball.push([t0, -0.4, 0, 0]);
    if (p.type === 'run' && !p.scr) {
      const lane = (p.lane || 0) * 9, tHand = t0 + 0.45, run = clamp(0.7 + Math.abs(y) * 0.075, 0.8, 3.2), tEnd = tHand + run, uEnd = p.td ? y + 3 : y, vEnd = clamp(lane + rr(-3, 3) + (y > 8 ? rr(-6, 6) : 0), -24, 24);
      key(off[QB], tHand, -3.6, 0.3); key(off[RB], tHand, -3.4, 0.9); key(off[RB], tHand + 0.4, -0.3, lane * 0.6); if (y > 4) key(off[RB], tHand + 0.4 + (run - 0.4) * 0.55, y * 0.6, (lane + vEnd) / 2); key(off[RB], tEnd, uEnd, vEnd);
      for (let i = 0; i < 6; i++) key(off[i], tHand + 0.6, 1.2 + rr(0, 0.8), O[i][1] + lane * 0.12); for (let i = 0; i < 4; i++) key(def[i], tHand + 0.6, 0.6, D[i][1] + lane * 0.2);
      [8, 9, 10].forEach(i => key(off[i], tEnd, Math.min(8, Math.max(2, y)), O[i][1] * 0.92)); [7, 8, 9].forEach(i => key(def[i], tEnd, Math.min(8, Math.max(2.6, y)) + 0.6, D[i][1] * 0.92));
      ball.push([tHand, -3.5, 0.5, 0]); ball.push([tHand + 0.4, -0.3, lane * 0.6, 0]); if (y > 4) ball.push([tHand + 0.4 + (run - 0.4) * 0.55, y * 0.6, (lane + vEnd) / 2, 0]); ball.push([tEnd, uEnd, vEnd, 0]);
      if (!p.td) swarm(uEnd, vEnd, tEnd, y > 12 ? 2 : 4); else swarm(uEnd - 2, vEnd, tEnd, 2);
      T = tEnd + 0.5;
    } else if (p.type === 'run' && p.scr || p.type === 'sack' || p.type === 'kneel') {
      const tDrop = t0 + 0.7, tEnd = tDrop + (p.type === 'kneel' ? 0.3 : 1.0 + Math.abs(y) * 0.05), vEnd = p.scr ? (p.lane || 1) * rr(5, 11) : rr(-2, 2), uEnd = p.type === 'kneel' ? -5.4 : p.td ? y + 3 : y;
      key(off[QB], tDrop, -6.5, 0); if (p.scr) key(off[QB], tDrop + 0.5, -4, vEnd * 0.7); key(off[QB], tEnd, uEnd, vEnd);
      ball.push([tDrop, -6.5, 0, 0]); if (p.scr) ball.push([tDrop + 0.5, -4, vEnd * 0.7, 0]); ball.push([tEnd, uEnd, vEnd, 0]);
      for (let i = 0; i < 6; i++) key(off[i], tDrop, -1.6, O[i][1]);
      if (p.type !== 'kneel') { for (let i = 0; i < 4; i++) key(def[i], p.type === 'sack' ? tEnd : tDrop + 0.5, p.type === 'sack' ? uEnd + rr(-0.3, 0.6) : -2.5, p.type === 'sack' ? vEnd + rr(-1.2, 1.2) : D[i][1] * 0.7); [8, 9, 10].forEach(i => key(off[i], tEnd, rr(8, 16), O[i][1] * 0.85)); [7, 8, 9].forEach(i => key(def[i], tEnd, rr(9, 17), D[i][1] * 0.85)); if (p.scr && !p.td) swarm(uEnd, vEnd, tEnd, 3); }
      T = tEnd + 0.45;
    } else if (p.type === 'pass' || p.type === 'inc' || p.type === 'int') {
      const side = p.side || 1, wr = side > 0 ? 9 : 8, cb = side > 0 ? 8 : 7, air = Math.max(1, p.air != null ? p.air : 6), tThrow = t0 + (p.deep ? 1.5 : 1.0), vC = clamp(side * (p.deep ? rr(10, 20) : rr(4, 16)), -24, 24);
      const dist = Math.hypot(air + 6.5, vC), tCatch = tThrow + clamp(dist / 24, 0.4, 1.35), done = p.type === 'pass', uEnd = done ? (p.td ? y + 3 : y) : air, vEnd = clamp(vC + (done ? rr(-4, 4) * Math.min(1, (y - air) / 6) : 0), -25, 25), tEnd = done ? tCatch + clamp((y - air) * 0.11, 0.15, 2.2) : tCatch + 0.5;
      key(off[QB], tThrow, -6.6, rr(-0.8, 0.8)); key(off[RB], tThrow, -5.2, -1.6);
      for (let i = 0; i < 6; i++) key(off[i], tThrow, -1.7 + rr(-0.3, 0.3), O[i][1]); for (let i = 0; i < 4; i++) { key(def[i], tThrow, -2.6 + rr(-0.5, 0.8), D[i][1] * 0.75); key(def[i], tCatch, -4.5, D[i][1] * 0.4); }
      [8, 9, 10].forEach(i => { if (i === wr) { key(off[i], tThrow, air * 0.72, O[i][1] * 0.95); key(off[i], tCatch, air, vC); if (done) key(off[i], tEnd, uEnd, vEnd); } else key(off[i], tCatch, rr(6, 18), O[i][1] * rr(0.5, 0.95)); });
      [7, 8, 9].forEach(i => { if (i === cb) { key(def[i], tThrow, air * 0.72 + 1.2, D[i][1] * 0.95); key(def[i], tCatch, air + (p.type === 'int' ? 0 : done ? 1.3 : 0.5), vC + (p.type === 'int' ? 0 : rr(-1, 1))); } else key(def[i], tCatch, rr(7, 19), D[i][1] * rr(0.5, 0.95)); });
      key(def[10], tCatch, Math.max(air + 3, 9), vC * 0.6); [4, 5, 6].forEach(i => key(def[i], tCatch, Math.min(air, 7) + rr(-1, 2), D[i][1] + vC * 0.25));
      ball.push([tThrow, -6.6, 0, 0]); ball.push([(tThrow + tCatch) / 2, (air - 6.6) / 2, vC / 2, clamp(dist / 5, 2, 9)]); ball.push([tCatch, air, vC, done || p.type === 'int' ? 0 : 0.6]);
      if (done) { ball.push([tEnd, uEnd, vEnd, 0]); if (!p.td) swarm(uEnd, vEnd, tEnd, 3); else swarm(uEnd - 2, vEnd, tEnd, 1); }
      else if (p.type === 'int') { const rt = (p.ret || 0); key(def[cb], tEnd + rt * 0.1, air - rt, vC + rr(-5, 5)); ball.push([tEnd + rt * 0.1, air - rt, def[cb][def[cb].length - 1][2], 0]); T = tEnd + rt * 0.1 + 0.5; }
      else ball.push([tCatch + 0.35, air + 2.5, vC + side * 1.5, 0]);
      if (p.type !== 'int') T = tEnd + 0.45;
    } else if (p.type === 'punt') {
      const net = p.net || 40, tKick = t0 + 0.9, tLand = tKick + 2.0;
      key(off[QB], t0 + 0.01, -13, 0); off[QB][0] = [0, -13, 0]; off[QB][1] = [t0, -13, 0]; ball.push([t0 + 0.45, -13, 0, 0]); ball.push([tKick, -12, 0, 0]); ball.push([(tKick + tLand) / 2, net / 2, rr(-3, 3), 16]); ball.push([tLand, net, rr(-6, 6), 0]);
      def[10][0] = [0, net + 2, 0]; def[10][1] = [t0, net + 2, 0]; key(def[10], tLand, net, ball[ball.length - 1][2]);
      off.forEach((a, i) => { if (i !== QB) key(a, tLand, Math.max(2, net - rr(3, 14)), a[0][2] * 0.7 + rr(-4, 4)); }); def.forEach((a, i) => { if (i !== 10) key(a, tLand, Math.max(4, net - rr(6, 20)), a[0][2] * 0.7 + rr(-4, 4)); });
      T = tLand + 0.5;
    } else if (p.type === 'fg' || p.type === 'pat') {
      const dist = p.type === 'pat' ? 20 : (p.dist || 30), tKick = t0 + 0.7, tEnd = tKick + (p.type === 'pat' ? 0.9 : 1.3), vEnd = p.good ? rr(-1.6, 1.6) : (R() < 0.5 ? -1 : 1) * rr(4.5, 8);
      off[QB][0] = [0, -7, 0]; off[QB][1] = [t0, -7, 0]; off[RB][0] = [0, -9, -1.5]; off[RB][1] = [t0, -9, -1.5]; key(off[RB], tKick, -7.3, -0.4);
      ball.push([tKick - 0.25, -7, 0, 0]); ball.push([tKick, -7, 0, 0]); ball.push([(tKick + tEnd) / 2, (dist - 7 - 7) / 2, vEnd / 2, 11]); ball.push([tEnd, dist - 7 + 3, vEnd, 3]);
      for (let i = 0; i < 4; i++) key(def[i], tKick, -1.5, D[i][1] * 0.7);
      T = tEnd + 0.4;
    } else if (p.type === 'pen') { flag = [rr(-1, 3), rr(-8, 8)]; T = 1.3; }
    else T = 1.2;
    settle(off, T); settle(def, T); const lb = ball[ball.length - 1]; if (lb[0] < T) ball.push([T, lb[1], lb[2], 0]);
    if (p.td || p.td6) banner = 'TOUCHDOWN'; else if (p.type === 'int') banner = 'INTERCEPTION'; else if (p.to === 'fum') banner = 'FUMBLE'; else if (p.type === 'fg') banner = p.good ? 'FIELD GOAL' : 'NO GOOD'; else if (p.safety) banner = 'SAFETY'; else if (p.type === 'sack') banner = 'SACK';
    return { off, def, ball, T, flag, banner };
  }

  function player(host, res, G, label) {
    const g = res.g, tU = teamOf(UT), tO = teamOf(g.opp), plays = G.rec;
    host.innerHTML = `<div class="vp-stage"><div class="vp-bug"><div class="t" id="vpTu"><i style="background:${tU.col}"></i><span>TENN</span><b id="vpSu">0</b><em></em></div><div class="c"><span id="vpQ">1st 15:00</span><small>${esc(label)}</small></div><div class="t r" id="vpTo"><i style="background:${tO.col}"></i><span>${esc(tO.abbr)}</span><b id="vpSo">0</b><em></em></div></div>
      <div class="vp-dd"><span id="vpDd">Kickoff</span><span id="vpWpT">Tennessee win chance ${pc(res.win)}</span></div>
      <canvas class="vp-cv" id="vpCv" aria-label="Animated field showing the simulated game"></canvas><div class="vp-call" id="vpCall" aria-live="polite">Press play to watch.</div><canvas class="vp-wp" id="vpWp" aria-label="Tennessee win probability through the game"></canvas>
      <div class="vp-ctl"><button class="vp-btn pri" data-vpc="play">▶ Play</button><button class="vp-btn" data-vpc="mode" aria-pressed="true" title="Key plays in full, the rest in fast forward">Highlights</button><button class="vp-btn" data-vpc="speed">Speed 1×</button><button class="vp-btn" data-vpc="score">Next score ⏭</button><span class="sp"></span><button class="vp-btn" data-vpc="end">Skip to final</button></div>
      <div class="vp-log" id="vpLog" tabindex="0" aria-label="Play-by-play"></div></div><div id="vpFinal"></div>`;
    const $ = s => host.querySelector(s), cv = $('#vpCv'), c = cv.getContext('2d'), wpc = $('#vpWp'), wc = wpc.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    const size = () => { dpr = Math.min(2, root.devicePixelRatio || 1); W = cv.clientWidth || 600; H = Math.round(W * 0.46); cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; wpc.width = (wpc.clientWidth || W) * dpr; wpc.height = 64 * dpr; };
    size();
    // field geometry: 120 yards long (two 10-yard end zones), 53.3 wide. Tennessee always drives left to right.
    const X = yd => (yd / 120) * W, Y = v => H / 2 + (v / 53.3) * H * 0.96, fx = (o, ball) => o === 0 ? 10 + ball : 110 - ball, dir = o => o === 0 ? 1 : -1;
    const S = { i: -1, t: 0, st: null, playing: false, speed: 1, hi: true, raf: null, last: 0, done: false, hold: 0, cur: null, quick: null, banner: null, bt: 0, sc: [0, 0], until: null };
    function field() {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let i = 0; i < 20; i++) { c.fillStyle = i % 2 ? '#2A7A39' : '#2F8540'; c.fillRect(X(10 + i * 5), 0, X(5) + 1, H); }
      // Tennessee's end zone: the orange and white checkerboard. The opponent's: its color.
      const sq = X(10) / 4, rows = Math.ceil(H / sq);
      for (let r = 0; r < rows; r++) for (let k = 0; k < 4; k++) { c.fillStyle = (r + k) % 2 ? '#FFFFFF' : '#FF8200'; c.fillRect(k * sq, r * sq, sq + 0.5, sq + 0.5); }
      c.fillStyle = tO.col; c.fillRect(X(110), 0, X(10) + 1, H);
      c.save(); c.translate(X(115), H / 2); c.rotate(Math.PI / 2); c.fillStyle = 'rgba(255,255,255,.85)'; c.font = `800 ${Math.max(11, H * 0.085)}px Archivo, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tO.name.toUpperCase(), 0, 0); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1;
      for (let yd = 10; yd <= 110; yd += 5) { c.globalAlpha = yd % 10 === 0 ? 0.8 : 0.35; c.beginPath(); c.moveTo(X(yd), 0); c.lineTo(X(yd), H); c.stroke(); }
      c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.55)'; c.font = `700 ${Math.max(9, H * 0.07)}px Archivo, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let yd = 20; yd <= 100; yd += 10) { const n = yd <= 60 ? yd - 10 : 110 - yd; c.fillText(n, X(yd), H * 0.12); c.fillText(n, X(yd), H * 0.88); }
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1; c.beginPath(); for (let yd = 11; yd < 110; yd++) { if (yd % 5 === 0) continue; [-6.6, 6.6].forEach(v => { c.moveTo(X(yd), Y(v) - 2); c.lineTo(X(yd), Y(v) + 2); }); } c.stroke();   // hash marks
      c.strokeStyle = '#FFD21F'; c.lineWidth = 2; [[1.2], [118.8]].forEach(([x]) => { c.beginPath(); c.moveTo(X(x), Y(-3.1)); c.lineTo(X(x), Y(3.1)); c.stroke(); });   // goal posts
    }
    const dot = (x, y, col, r, ring) => { c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fillStyle = col; c.fill(); c.lineWidth = Math.max(1, r * 0.32); c.strokeStyle = ring || '#fff'; c.stroke(); };
    function draw() {
      field();
      const p = S.cur; if (!p) return;
      const o = p.o, d = 1 - o, lx = fx(o, p.ball), dr = dir(o), lat = p.lat || 0, r = Math.max(3, W / 150);
      const colO = o === 0 ? tU.col : tO.col, colD = d === 0 ? tU.col : tO.col;
      if (p.type !== 'ko' && p.type !== 'pat') {
        c.lineWidth = 2; c.strokeStyle = 'rgba(40,110,255,.9)'; c.beginPath(); c.moveTo(X(lx), 0); c.lineTo(X(lx), H); c.stroke();
        if (p.down && p.togo && p.ball + p.togo < 100) { c.strokeStyle = 'rgba(255,210,31,.95)'; c.beginPath(); c.moveTo(X(lx + dr * p.togo), 0); c.lineTo(X(lx + dr * p.togo), H); c.stroke(); }
      }
      if (S.quick) {            // fast forward: just the ball moving to the new spot
        const k = ease(clamp(S.t / S.quick, 0, 1)), bx = lx + dr * (p.end - p.ball) * k;
        dot(X(bx), Y(lat), '#7A4A21', r * 1.25, '#fff'); return;
      }
      const stg = S.st; if (!stg) return;
      const pos = (path) => { const a = at(path, S.t); return [X(lx + dr * a[1]), Y(clamp(lat + a[2], -25.6, 25.6)), a[3] || 0]; };
      stg.def.forEach(a => { const q = pos(a); dot(q[0], q[1], colD, r, d === 0 ? '#fff' : '#E8E8E8'); });
      stg.off.forEach(a => { const q = pos(a); dot(q[0], q[1], colO, r, o === 0 ? '#fff' : '#E8E8E8'); });
      if (stg.flag) { c.fillStyle = '#FFD21F'; c.fillRect(X(lx + dr * stg.flag[0]) - 4, Y(lat + stg.flag[1]) - 4, 8, 8); }
      const b = pos(stg.ball), z = b[2];
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(b[0], b[1] + 2, r * 0.9, r * 0.5, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#7A4A21'; c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.ellipse(b[0], b[1] - z * (H / 53.3) * 0.55, r * (0.85 + z * 0.05), r * (0.6 + z * 0.035), 0, 0, 6.2832); c.fill(); c.stroke();
      const nm = p.type === 'run' || p.type === 'sack' ? p.who : p.type === 'pass' ? (S.t > stg.T * 0.45 ? p.tgt : p.who) : p.type === 'inc' || p.type === 'int' ? p.who : null;
      if (nm && S.t > 0.5 && W >= 420) { c.font = `700 ${Math.max(10, W / 85)}px Archivo, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.65)'; const hx = p.type === 'pass' && S.t <= stg.T * 0.45 || p.type === 'inc' || p.type === 'int' ? pos(stg.off[6]) : b; c.strokeText(nm, hx[0], hx[1] - r * 1.8); c.fillStyle = '#fff'; c.fillText(nm, hx[0], hx[1] - r * 1.8); }
      if (S.banner && S.bt > 0) {
        const a = clamp(S.bt / 0.3, 0, 1) * clamp((1.6 - S.bt) / 0.3 + 1, 0, 1), col = S.bannerCol || '#FF8200';
        c.globalAlpha = Math.min(1, a); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, H * 0.36, W, H * 0.28); c.fillStyle = col; c.fillRect(0, H * 0.36, W, 3); c.fillRect(0, H * 0.64 - 3, W, 3);
        c.fillStyle = '#fff'; c.font = `800 ${Math.max(18, H * 0.15)}px Archivo, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(S.banner, W / 2, H * 0.5); c.globalAlpha = 1;
      }
    }
    function wpDraw() {
      const w = wpc.width / dpr, h = 64; wc.setTransform(dpr, 0, 0, dpr, 0, 0); wc.clearRect(0, 0, w, h);
      wc.fillStyle = '#161616'; wc.fillRect(0, 0, w, h); wc.strokeStyle = '#444'; wc.lineWidth = 1; wc.setLineDash([3, 3]); wc.beginPath(); wc.moveTo(0, h / 2); wc.lineTo(w, h / 2); wc.stroke(); wc.setLineDash([]);
      for (let q = 1; q < 4; q++) { wc.strokeStyle = '#333'; wc.beginPath(); wc.moveTo(w * q / 4, 0); wc.lineTo(w * q / 4, h); wc.stroke(); }
      wc.fillStyle = '#8a8a8a'; wc.font = '10px system-ui, sans-serif'; wc.textBaseline = 'top'; wc.fillText('TENN 100%', 4, 2); wc.textBaseline = 'bottom'; wc.fillText(tO.abbr + ' 100%', 4, h - 2);
      const tx = p => { const e = p.q > 4 ? 3600 : (p.q - 1) * 900 + (900 - p.clk); return clamp(e / 3600, 0, 1) * w; };
      wc.strokeStyle = '#FF8200'; wc.lineWidth = 2; wc.beginPath(); wc.moveTo(0, h - res.win * h);
      for (let i = 0; i <= S.i && i < plays.length; i++) wc.lineTo(tx(plays[i]), h - plays[i].wp * h);
      wc.stroke();
      if (S.i >= 0) { const p = plays[Math.min(S.i, plays.length - 1)]; wc.fillStyle = '#fff'; wc.beginPath(); wc.arc(tx(p), h - p.wp * h, 3, 0, 6.2832); wc.fill(); }
    }
    const ord = n => ['1st', '2nd', '3rd', '4th'][n - 1] || n + 'th', clk = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    const spotTxt = (o, ball) => ball === 50 ? 'the 50' : ball < 50 ? `${o === 0 ? 'TENN' : tO.abbr} ${ball}` : `${o === 0 ? tO.abbr : 'TENN'} ${100 - ball}`;
    function hud(p, after) {
      $('#vpQ').firstChild.nodeValue = (p.q > 4 ? 'OT' + (p.q - 4 > 1 ? p.q - 4 : '') : ord(p.q)) + ' ' + (p.q > 4 ? '' : clk(p.clk));
      $('#vpSu').textContent = S.sc[0]; $('#vpSo').textContent = S.sc[1];
      $('#vpTu').classList.toggle('has', p.o === 0 && p.type !== 'ko'); $('#vpTo').classList.toggle('has', p.o === 1 && p.type !== 'ko');
      $('#vpDd').textContent = p.type === 'ko' ? 'Kickoff' : p.type === 'pat' ? 'Try after touchdown' : `${ord(p.down)} & ${p.ball + p.togo >= 100 ? 'goal' : p.togo} at ${spotTxt(p.o, p.ball)}`;
      if (after) $('#vpWpT').textContent = `Tennessee win chance ${pc(p.wp)}`;
    }
    function logLine(p) {
      const el = document.createElement('div'); if (p.key) el.className = 'k';
      el.innerHTML = `<span>${p.q > 4 ? 'OT' : 'Q' + p.q} ${p.q > 4 ? '' : clk(p.clk)} ${p.o === 0 ? 'TENN' : esc(tO.abbr)}</span><p>${esc(p.text)}${p.td || p.td6 || p.type === 'fg' && p.good || p.safety || p.type === 'pat' ? ` <b>${p.sc[0]}-${p.sc[1]}</b>` : ''}</p>`;
      const lg = $('#vpLog'); lg.insertBefore(el, lg.firstChild);
    }
    function begin(i) {
      S.i = i; const p = plays[i]; S.cur = p; S.t = 0; S.curDone = false; hud(p, false);
      const full = !S.hi || p.key || (p.q === 4 && p.clk < 120 && Math.abs(S.sc[0] - S.sc[1]) <= 8) || p.q > 4;
      const skipAnim = S.until != null;
      if (p.type === 'ko' || (p.type === 'pat' && S.hi) || !full || skipAnim) { S.quick = skipAnim ? 0.01 : p.type === 'ko' ? 0.5 : p.type === 'pat' ? 0.35 : 0.3; S.st = null; }
      else { S.quick = null; S.st = stage(p, i * 31 + 7); }
      $('#vpCall').innerHTML = full && !skipAnim && p.type !== 'ko' ? `<b>${p.o === 0 ? 'Tennessee' : esc(tO.name)}</b> · ${p.type === 'pat' ? 'the try' : ord(p.down) + ' & ' + (p.ball + p.togo >= 100 ? 'goal' : p.togo)}` : esc(p.text);
    }
    function finish() {
      const p = S.cur; if (S.curDone) return; S.curDone = true; S.sc = p.sc.slice(); hud(p, true); $('#vpCall').textContent = p.text; logLine(p); wpDraw();
      if (S.st && S.st.banner && S.until == null) { S.banner = S.st.banner; S.bt = 1.6; const sc = p.td6 || p.type === 'int' || p.to === 'fum' || p.safety ? 1 - p.o : p.o; S.bannerCol = sc === 0 ? '#FF8200' : tO.col; }
      if (S.until === 'score' && (p.td || p.td6 || (p.type === 'fg' && p.good) || p.safety)) { S.until = null; }
    }
    function frame(ts) {
      S.raf = null; if (!S.playing) return;
      const dt = Math.min(0.1, (ts - S.last) / 1000) * S.speed; S.last = ts;
      if (S.until != null) {      // skipping ahead: run the plays without animating them
        S.bt = 0; S.banner = null; if (S.cur && !S.curDone) finish(); let n = 0;
        while (S.until != null && n++ < 600) { if (S.i + 1 >= plays.length) return end(); begin(S.i + 1); finish(); }
        S.t = S.quick || 0.01; S.hold = 0.9; draw(); S.raf = requestAnimationFrame(frame); return;
      }
      if (S.bt > 0) { S.bt -= dt / Math.max(1, S.speed * 0.6); draw(); S.raf = requestAnimationFrame(frame); return; }
      if (S.hold > 0) { S.hold -= dt; if (S.hold <= 0) { if (S.i + 1 >= plays.length) return end(); begin(S.i + 1); } draw(); S.raf = requestAnimationFrame(frame); return; }
      if (S.i < 0) begin(0);
      S.t += dt; const T = S.quick != null ? S.quick : S.st.T;
      if (S.t >= T) { S.t = T; draw(); finish(); S.hold = S.until != null ? 0.001 : S.quick != null ? 0.12 : 0.55; }
      else draw();
      S.raf = requestAnimationFrame(frame);
    }
    function end() {
      S.playing = false; S.done = true; S.until = null; $('[data-vpc="play"]').textContent = '↺ Watch again';
      const T = G.T, won = G.sc[0] > G.sc[1], n = G.names, ld = (t, i) => { const x = T[i]; return [n[i].qb ? `${n[i].qb}: ${x.qb.cmp}-${x.qb.att}, ${x.qb.yds} yds, ${x.qb.td} TD, ${x.qb.int} INT` : null, n[i].rb && x.rb.car ? `${n[i].rb}: ${x.rb.car} car, ${x.rb.yds} yds, ${x.rb.td} TD` : null, n[i].wr && x.wr.rec ? `${n[i].wr}: ${x.wr.rec} rec, ${x.wr.yds} yds, ${x.wr.td} TD` : null].filter(Boolean).join(' · '); };
      const qh = Math.max(T[0].q[4] || T[1].q[4] ? 5 : 4, 4), row = (l, a, b) => `<tr><td>${l}</td><td>${a}</td><td>${b}</td></tr>`;
      $('#vpCall').innerHTML = `<b>Final${G.ot ? ' (' + (G.ot > 1 ? G.ot + 'OT' : 'OT') + ')' : ''}:</b> Tennessee ${G.sc[0]}, ${esc(tO.name)} ${G.sc[1]}. ${won ? 'Vols win.' : esc(tO.name) + ' wins.'}`;
      host.querySelector('#vpFinal').innerHTML = `<h4>This game's box score</h4><div class="tablewrap"><table class="vp-box"><thead><tr><th></th>${Array.from({ length: qh }, (_, i) => `<th>${i < 4 ? i + 1 : 'OT'}</th>`).join('')}<th>T</th></tr></thead><tbody>${[0, 1].map(i => `<tr><td><b>${i === 0 ? 'Tennessee' : esc(tO.name)}</b></td>${Array.from({ length: qh }, (_, k) => `<td>${T[i].q[k]}</td>`).join('')}<td><b>${G.sc[i]}</b></td></tr>`).join('')}</tbody></table></div>
        <div class="tablewrap"><table class="vp-box"><thead><tr><th></th><th>Tennessee</th><th>${esc(tO.name)}</th></tr></thead><tbody>${row('Total yards', T[0].rushY + T[0].sackY + T[0].passY, T[1].rushY + T[1].sackY + T[1].passY)}${row('Rushing (sacks included)', `${T[0].rushA + T[0].sacks}-${T[0].rushY + T[0].sackY}`, `${T[1].rushA + T[1].sacks}-${T[1].rushY + T[1].sackY}`)}${row('Passing', `${T[0].cmp}-${T[0].att}, ${T[0].passY}`, `${T[1].cmp}-${T[1].att}, ${T[1].passY}`)}${row('First downs', T[0].fd, T[1].fd)}${row('Third downs', `${T[0].t3c}-${T[0].t3a}`, `${T[1].t3c}-${T[1].t3a}`)}${row('Turnovers', T[0].int + T[0].fum, T[1].int + T[1].fum)}${row('Sacks allowed', T[0].sacks, T[1].sacks)}${row('Time of possession', clk(T[0].top), clk(T[1].top))}</tbody></table></div>
        <p class="small"><b>Tennessee:</b> ${esc(ld(T, 0)) || '—'}<br><b>${esc(tO.name)}:</b> ${esc(ld(T, 1)) || '—'}</p><p class="vp-note">One simulated game out of ${res.N.toLocaleString()}, shown because it ${label.toLowerCase().includes('likely') ? 'sits closest to the middle of all of them' : 'shows that kind of outcome'}. Player lines are simulated, not predictions for individuals.</p>`;
      draw(); wpDraw();
    }
    function reset() { S.i = -1; S.t = 0; S.sc = [0, 0]; S.done = false; S.hold = 0; S.cur = null; S.st = null; S.quick = null; S.bt = 0; S.until = null; $('#vpLog').innerHTML = ''; host.querySelector('#vpFinal').innerHTML = ''; $('#vpSu').textContent = 0; $('#vpSo').textContent = 0; }
    function go() { if (S.done) reset(); S.playing = true; S.last = performance.now(); $('[data-vpc="play"]').textContent = '❚❚ Pause'; if (!S.raf) S.raf = requestAnimationFrame(frame); }
    function pause() { S.playing = false; $('[data-vpc="play"]').textContent = '▶ Play'; }
    host.querySelector('.vp-ctl').addEventListener('click', e => {
      const b = e.target.closest('[data-vpc]'); if (!b) return; const k = b.dataset.vpc;
      if (k === 'play') { S.playing ? pause() : go(); }
      if (k === 'mode') { S.hi = !S.hi; b.setAttribute('aria-pressed', S.hi); b.textContent = S.hi ? 'Highlights' : 'Every play'; }
      if (k === 'speed') { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; b.textContent = `Speed ${S.speed}×`; }
      if (k === 'score') { S.until = 'score'; S.bt = 0; go(); }
      if (k === 'end') { S.until = 'end'; S.bt = 0; go(); }
    });
    const onR = () => { if (!document.body.contains(cv)) { root.removeEventListener('resize', onR); S.playing = false; return; } size(); draw(); wpDraw(); };
    root.addEventListener('resize', onR);
    field(); wpDraw();
    VP._player = { stop: () => { S.playing = false; }, state: S, go, end: () => { S.until = 'end'; go(); } };
    if (!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) go();
  }

  /* ---------- mounting it in the matchup preview ---------- */
  VP.mount = (el, g, P, ctx) => {
    css(); ctx = ctx || {};
    const adj = { ut: 0, opp: 0 };
    const render = () => {
      if (VP._player) VP._player.stop();
      const res = VP.run(g, P, ctx, adj);
      if (!res) { el.innerHTML = '<p class="dim small">The prediction needs power ratings for both teams. They load with the next data update.</p>'; return; }
      VP.last = res;
      el.className = 'vp'; el.style.setProperty('--vp-opp', teamOf(g.opp).col === '#1C1C1C' || teamOf(g.opp).col === '#2B2B2B' ? '#6B6B6B' : teamOf(g.opp).col);
      el.innerHTML = report(res);
      el.querySelectorAll('[data-vpadj]').forEach(s => { s.value = String(adj[s.dataset.vpadj]); s.addEventListener('change', () => { adj[s.dataset.vpadj] = +s.value; render(); }); });
      el.querySelectorAll('[data-vpw]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.vpw, pk = res.picks[k]; if (!pk) return;
        if (VP._player) VP._player.stop();
        const label = k === 'likely' ? 'Most likely game' : k === 'upset' ? 'The upset' : "Tennessee's best day";
        const stageEl = el.querySelector('#vpStage'); player(stageEl, res, VP.game(res, pk.seed, ctx), label);
        stageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }));
    };
    render();
  };
  // one line for the written preview, from the ratings alone (no simulation needed)
  VP.line = (g, P, ctx) => { const m = VP.model(g, P, ctx); if (!m) return ''; const a = Math.round(m.ptsU), b = Math.round(m.ptsO); return `The Vol Index model makes it Tennessee ${a === b ? a + (m.margin >= 0 ? 1 : 0) : a}, ${g.opp} ${a === b ? b + (m.margin >= 0 ? 0 : 1) : b}, with the Vols winning about ${Math.round(m.ratingWin * 100)}% of the time. Open the Prediction tab to see 1,000 simulated games and watch the most likely one.`; };
  VP._sim = simGame; VP._profile = profile; VP._matchup = matchup;
})(typeof window !== 'undefined' ? window : globalThis);
