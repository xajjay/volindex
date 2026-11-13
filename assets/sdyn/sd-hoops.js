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

  // Home court: the edge scales with the building and its fanbase (prestige), like football. Real college hoops is about 3.5 points on average,
  // roughly 2 for a quiet gym and 6 for the loudest arenas. HC_K is the shot-percentage swing for an average home team.
  H.HC_K = 0.0235;
  H.homeEdge = t => (0.6 + 0.9 * Math.max(0, Math.min(1.1, ((t && t.prestige || 55) - 30) / 65))) * H.HC_K;
  H.newGame = (th, ta, o) => {
    o = o || {}; const sp = SD.SP(), women = sp.he === 'she';
    const GM = { kind: 'hoops', T: { h: th, a: ta }, score: { h: 0, a: 0 }, per: 1, nper: sp.periods, perLen: sp.perLen, clock: sp.perLen, shot: sp.shot, poss: chance(0.5) ? 'h' : 'a',
      ps: {}, on: { h: [], a: [] }, en: {}, min: {}, tf: { h: 0, a: 0 }, to: { h: women ? 4 : 4, a: women ? 4 : 4 }, coach: { h: Object.assign({ pace: 'normal', focus: 'bal', def: 'man', depth: 9, star: 1 }, th.coach || {}), a: Object.assign({ pace: 'normal', focus: 'bal', def: 'man', depth: 9, star: 1 }, ta.coach || {}) },
      plays: [], lineScore: { h: [], a: [] }, user: o.user || null, mode: o.mode || 'coach', over: false, neutral: !!o.neutral, live: !!o.live, women, run: { s: null, n: 0 }, trans: null, lastEvent: null, ot: 0, half: 1, mom: 0, title: o.title || null, crowd: o.neutral ? 0.3 : 0.9 };
    GM.hc = o.neutral ? 0 : H.homeEdge(th); GM.restAdj = o.rest || { h: 0, a: 0 };
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
    if (p && c.mins && c.mins[p.id] != null && c.mins[p.id] !== '') return Math.max(0, +c.mins[p.id]) * total / 40;
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
  /* ---------- reading the floor: size, matchups, advantages, the situation ---------- */
  const SLOTI = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
  const big = p => p.pos === 'PF' || p.pos === 'C';
  const inches = p => p.ht || [74, 76, 79, 81, 83][SLOTI[p.pos] || 0];
  // how dangerous a scorer is: his best weapon, his all-around scoring, his overall
  const scor = p => Math.max(p.at.ins, p.at.mid, p.at.thr) * 0.55 + (p.at.ins + p.at.mid + p.at.thr) / 3 * 0.45 + (p.ovr - 75) * 0.35;
  const bySlot = a => a.slice().sort((x, y) => (SLOTI[x.pos] - SLOTI[y.pos]) || (inches(x) - inches(y)));
  const KR = 0.45;                                                            // how much a raw rating gap moves a shot once the matchup, the help and the look are already counted
  const KT0 = 2.0;                                                           // turnover dial: every risk below is scaled by it (tuned to about 16.5% of possessions)
  const heatOf = (GM, p) => (GM.heat && GM.heat[p.id]) || 0;                 // -1 ice cold ... +1 on fire
  const bump = (GM, p, v) => { GM.heat = GM.heat || {}; GM.heat[p.id] = clamp((GM.heat[p.id] || 0) + v, -1, 1); };
  const pfs = (GM, p) => GM.ps[p.id] ? GM.ps[p.id].pf : 0;
  // foul trouble: 1 = one more and he sits (or is gone), 0.5 = has to be careful
  const shy = (GM, p) => { const pf = pfs(GM, p), first = GM.nper === 2 ? GM.per === 1 : GM.per <= 2; return pf >= 4 ? 1 : (first && pf >= 2) || pf === 3 ? 0.5 : 0; };
  // who guards whom (man to man): by position, then the stopper takes their best perimeter scorer and a defender in foul trouble hides on their weakest
  function matchups(GM, O, D, zone) {
    const o = bySlot(O), dd = bySlot(D), m = {};
    o.forEach((p, i) => { m[p.id] = dd[i] || dd[dd.length - 1]; });
    if (zone) return m;
    const swap = (a, b) => { const x = m[a.id]; m[a.id] = m[b.id]; m[b.id] = x; };
    const per = o.filter(p => !big(p));
    if (per.length > 1) {
      const star = per.slice().sort((a, b) => scor(b) + heatOf(GM, b) * 5 - scor(a) - heatOf(GM, a) * 5)[0];
      const stop = per.slice().sort((a, b) => m[b.id].at.pdf - m[a.id].at.pdf)[0];
      if (stop !== star && m[stop.id].at.pdf - m[star.id].at.pdf >= 4 && Math.abs(inches(m[stop.id]) - inches(star)) <= 5) swap(star, stop);
      const weak = per.slice().sort((a, b) => scor(a) - scor(b))[0];
      const hot = per.find(p => p !== weak && shy(GM, m[p.id]) >= 1 && scor(p) - scor(weak) > 4);
      if (hot && shy(GM, m[weak.id]) < 1) swap(hot, weak);
    }
    return m;
  }
  // the edge an attacker has on his man: off the dribble, on the block, shooting over him (in rating points; a mismatch in size counts)
  const drvAdv = (GM, o, d) => sq((R(GM, o, 'ath') * 0.45 + R(GM, o, 'hnd') * 0.55) - (R(GM, d, 'pdf') * 0.62 + R(GM, d, 'ath') * 0.38)) + (big(d) && !big(o) ? 5 : 0) - (big(o) && !big(d) ? 5 : 0) + shy(GM, d) * 3;
  const pstAdv = (GM, o, d) => sq(R(GM, o, 'ins') - R(GM, d, 'idf')) + (inches(o) - inches(d)) * 1.5 + shy(GM, d) * 3;
  const shtAdv = (GM, o, d) => sq(R(GM, o, 'thr') - R(GM, d, 'pdf')) + (inches(o) - inches(d)) * 0.35;
  // what the score and the clock ask for
  function situation(GM, diff, endGame, sp) {
    const t = GM.clock;
    if (endGame) {
      if (diff < 0) {
        const need = -diff;
        if (need === 3 && t < 30) return 'need3';                           // a three to tie
        if ((need >= 4 && need <= 12 && t < 70) || (need >= 7 && need <= 15 && t < 150)) return 'need3q'; // quick threes
        if (need <= 2 && t < sp.shot + 4) return 'last';                    // one shot to tie or win
        if (need >= 9 && need <= 20 && t < 240) return 'hurry';
      } else if (diff > 0) { if (t < 150 && diff <= 14) return 'burn'; }     // protect the lead: clock, ball security, free throws
      else if (t < sp.shot + 4) return 'last';
    } else if (t < sp.shot + 4) return 'last';                               // hold for the last shot of the period
    if (t > sp.shot + 6 && t < sp.shot + 18) return '2for1';
    return 'normal';
  }
  // the other bench adjusts: press when it has to, a zone against a team that can't shoot, back to man when the zone gets shot over
  function cpuAdjust(GM) {
    GM.baseDef = GM.baseDef || { h: GM.coach.h.def, a: GM.coach.a.def };
    for (const x of ['h', 'a']) {
      if (x === GM.user) continue;
      const o = other(x), c = GM.coach[x], base = GM.baseDef[x], lead = GM.score[x] - GM.score[o];
      let tpa = 0, tpm = 0; GM.L[o].forEach(p => { const l = GM.ps[p.id]; if (l) { tpa += l.tpa; tpm += l.tpm; } });
      const lateDown = GM.per >= GM.nper && GM.clock < 300 && lead <= -8;
      if (lateDown) c.def = 'press';
      else if (c.def === 'press' && base !== 'press') c.def = base;
      else if (c.def === 'man' && tpa >= 12 && tpm / tpa < 0.25 && chance(0.5)) { c.def = 'zone'; GM.zoneAt = tpa; }
      else if (c.def === 'zone' && base !== 'zone' && tpa - (GM.zoneAt || 0) >= 8 && tpm / tpa > 0.33) c.def = 'man';
    }
  }


  H.step = (GM, uc) => {
    uc = uc || {};
    if (GM.over) return null;
    const s = GM.poss, d = other(s);
    const sp = SD.SP();
    // timeouts
    if (uc.timeout && GM.user && GM.to[GM.user] > 0) { GM.to[GM.user]--; GM.run = { s: null, n: 0 }; GM.mom = 0; GM.dead = true; GM.trans = null; GM.early = null; GM.putback = null; ['h', 'a'].forEach(x => onP(GM, x).forEach(p => { GM.en[p.id] = Math.min(1, GM.en[p.id] + 0.08); })); subs(GM, 'h', true); subs(GM, 'a', true); return push(GM, { s: GM.user, kind: 'to', text: `Timeout, ${GM.T[GM.user].name}.`, time: 0 }); }
    // a CPU timeout to stop a run
    for (const x of ['h', 'a']) if (x !== GM.user && GM.to[x] > 0 && GM.run.s === other(x) && GM.run.n >= 8) { GM.to[x]--; GM.run = { s: null, n: 0 }; GM.mom = 0; subs(GM, x, true); return push(GM, { s: x, kind: 'to', text: `Timeout, ${GM.T[x].name}. ${GM.T[other(x)].name} on a run.`, time: 0 }); }
    // substitutions at dead balls: every few trips, and whenever a period starts
    GM.np = (GM.np || 0) + 1;
    if (GM.np % 4 === 1 || GM.subNow) { subs(GM, 'h'); subs(GM, 'a'); GM.subNow = false; }
    if (GM.np % 6 === 1) cpuAdjust(GM);
    // the coach's call runs on the next dead-ball possession (after a make, a foul, a violation or a timeout), never off a live rebound
    const fresh = GM.dead !== false; GM.dead = false;
    if (uc.call && GM.user === s && fresh) GM.nextCall = uc.call;
    const c = GM.coach[s], cd = GM.coach[d];
    const O = onP(GM, s), D = onP(GM, d);
    const diff = GM.score[s] - GM.score[d], endGame = GM.per >= GM.nper;
    // pace and the late-game clock
    let dur = { slow: 26.5, normal: 22, fast: 17 }[c.pace] + gauss() * 3.5;
    if (GM.trans) dur = rr(4, 7);
    const wasEarly = !GM.trans && GM.early === s; GM.early = null;
    if (wasEarly) dur = rr(7, 11);
    if (endGame && GM.clock < 150 && diff > 0) dur = Math.max(dur, 24 + rr(0, 5));      // milk it
    if (endGame && GM.clock < 90 && diff < 0) dur = Math.min(dur, rr(6, 10));           // hurry
    if (GM.clock < dur + 2 && GM.clock < sp.shot) dur = Math.max(1, GM.clock - rr(0.5, 2)); // the last shot of the period
    const r = { s, kind: 'shot', pts: 0, text: '', ev: [], time: dur };
    // ---------- the situation: what does this team need right now? ----------
    const zone = cd.def === 'zone', press = cd.def === 'press', KT = KT0 * (GM.women ? 1.14 : 1);
    const M = matchups(GM, O, D, zone);
    const iqO = avg(O.map(p => p.at.iq)), iqD = avg(D.map(p => p.at.iq));
    const opts = c.opts || [], om = p => { const i = opts.indexOf(p.id); return i === 0 ? 1.7 : i === 1 ? 1.35 : i === 2 ? 1.15 : 1; };
    const usage = p => Math.pow(Math.max(55, (p.at.ins + p.at.mid + p.at.thr) / 3 + (p.ovr - 75) * 0.6), 2.9) * (p.tr.ego > 75 ? 1.15 : 1) * om(p) * (1 + 0.3 * heatOf(GM, p)) * (c.focus === 'star' && opts[0] === p.id ? 1.5 : 1);
    const goTo = O.find(p => p.id === opts[0]) || O.slice().sort((a, b) => (scor(b) + b.tr.clutch / 8) - (scor(a) + a.tr.clutch / 8))[0];
    const threat = O.slice().sort((a, b) => scor(b) + heatOf(GM, b) * 6 - scor(a) - heatOf(GM, a) * 6)[0];   // the man the defense worries about
    const handler = O.slice().sort((a, b) => (b.at.hnd + b.at.pas) - (a.at.hnd + a.at.pas))[0];
    const sit = situation(GM, diff, endGame, sp);
    const only3 = sit === 'need3', want3 = sit === 'need3' || sit === 'need3q';
    r.sit = sit === 'normal' ? undefined : sit;
    // the clock: a two-for-one, the last shot, milking a lead, hurrying when behind
    if (sit === '2for1' && !GM.trans) dur = clamp(GM.clock - sp.shot - rr(1, 4), 4, 11);
    if (sit === 'need3' || sit === 'need3q' || sit === 'hurry') dur = Math.min(dur, rr(5, 10));
    if (sit === 'last' && GM.clock < sp.shot) dur = Math.max(1, GM.clock - rr(0.6, 3.5));
    dur = clamp(dur, 1, sp.shot - 0.5); r.time = dur;

    // ---------- late: the trailing defense fouls on purpose; a defense up three fouls before the tying three ----------
    const bonusNow = () => sp.he === 'she' ? (GM.tf[d] >= 5 ? 2 : 0) : (GM.tf[d] >= 10 ? 2 : GM.tf[d] >= 7 ? 1.5 : 0);
    const upThree = endGame && GM.clock < 9 && diff === -3 && (d === GM.user ? cd.foulUp3 === true : chance(0.3 + (iqD - 70) / 100));
    const intFoul = endGame && GM.clock < 60 && diff >= 1 && diff <= 6 + (GM.clock < 20 ? 3 : 0) && (d !== GM.user || (cd.endFoul !== false));
    if (intFoul || upThree) {
      // the offense gets it to its best free-throw shooter; a sharp defense denies him and fouls someone worse
      const deny = !upThree && chance(clamp(0.18 + (iqD - 70) / 120, 0.05, 0.4));
      const ft = upThree ? SD.wpick(O, p => usage(p)) : deny ? SD.wpick(O, p => Math.pow(105 - p.at.ft, 3)) : SD.wpick(O, p => Math.pow(p.at.ft, 7) * (big(p) ? 0.5 : 1));
      const fouler = SD.wpick(D, p => (pfs(GM, p) >= 4 ? 0.3 : 1));
      add(GM, fouler, 'pf'); GM.tf[d]++;
      dur = rr(2, 5); r.time = dur; r.fouler = fouler; r.fouled = ft;
      const bonus = bonusNow();
      if (!bonus) {          // a foul to give: no shots yet
        r.kind = 'foul'; r.text = `${GM.T[d].name} fouls ${H.last(ft)} on purpose${upThree ? ' before the three can go up' : ''}. Not in the bonus yet: ${GM.T[s].abbr} ball.`; GM.dead = true;
        push(GM, r); GM.clock -= dur; tick(GM, dur, s); return checkClock(GM, r);
      }
      const made = bonus === 1.5 ? (ftOne(GM, ft) ? 1 + (ftOne(GM, ft) ? 1 : 0) : 0) : shoot2(GM, ft, 2);
      r.kind = 'ft'; r.pts = made; r.shooter = ft;
      r.text = `${GM.T[d].name} fouls ${H.last(ft)} on purpose${upThree ? ', up three, before the shot' : deny ? ' (they wanted him at the line)' : ''}. ${bonus === 1.5 ? `One-and-one: ${made === 0 ? 'misses the front end' : 'makes ' + made}` : `Makes ${made} of 2`}.`;
      if (bonus === 1.5 && made === 0) return rebound(GM, r, s, d, O, D, dur);
      return finishPoss(GM, r, s, d, made, ft, null, true);
    }

    const trans = GM.trans === s; GM.trans = null;
    const tFrom = GM.transFrom; GM.transFrom = null;
    const putId = GM.putback; GM.putback = null;
    const early = !trans && wasEarly;

    // ---------- shared pieces ----------
    const lead = [];                                           // what happened before the shot, for the play-by-play
    const TO = (who, thief, text, o) => {
      o = o || {}; add(GM, who, 'to');
      if (thief) { add(GM, thief, 'stl'); const run = chance((o.run != null ? o.run : 0.58) + (press ? 0.1 : 0)); GM.trans = run ? d : null; if (run) { GM.transFrom = 'steal'; GM.transBy = thief.id; } else GM.early = d; }
      else GM.dead = true;
      r.kind = 'to'; r.who = who; r.thief = thief || null; r.forced = !!(thief || o.forced); r.big = !!thief && GM.trans === d;
      r.text = (lead.length ? lead.join(' ') + ' ' : '') + text;
      if (o.off) add(GM, who, 'pf');
      return finishPoss(GM, r, s, d, 0, null, null, false, o.dur != null ? o.dur : dur);
    };
    // a pass: the passer's vision against the man in the lane. Returns null when it gets there, or the turnover.
    const pass = (from, to, risk, what) => {
      const lane = M[to.id] && chance(0.65) ? M[to.id] : pick(D);
      const p = clamp((risk + sq(R(GM, lane, 'stl') - R(GM, from, 'pas')) / 1000 + (70 - from.at.iq) / 1100 + (1 - (GM.en[from.id] || 1)) * 0.03) * (sit === 'burn' ? 0.8 : 1) * KT, 0.003, 0.3);
      if (!chance(p)) return null;
      const picked = chance(0.7);
      return TO(from, picked ? lane : null, picked ? pick([`${H.last(lane)} jumps the passing lane and picks off ${H.last(from)}.`, `${H.last(lane)} reads ${what || 'the pass'} and steals it.`, `${H.last(from)} telegraphs it: ${H.last(lane)} with the steal.`])
        : pick([`${H.last(from)} throws ${what || 'the pass'} away.`, `${H.last(from)} and ${H.last(to)} aren't on the same page: out of bounds.`]));
    };
    // what shot does this player take when it is his? His strengths, his limits, and what the moment needs.
    const menu = (p, lean) => {
      lean = lean || {};
      const lim3 = p.at.thr < 62 ? 0.06 : p.at.thr < 70 ? 0.35 : p.at.thr < 76 ? 0.8 : 1.15;
      const limR = (p.at.hnd < 60 && !big(p) ? 0.5 : 1) * (p.at.ins < 62 ? 0.5 : 1);
      const w3 = Math.pow(p.at.thr / 75, 4) * 44 * lim3 * (lean.three || 1) * (want3 ? 4 : 1) * (sit === 'burn' ? 0.55 : 1) * (zone ? 1.2 : 1);
      const wm = Math.pow(p.at.mid / 75, 4) * 22 * (lean.mid || 1) * (want3 ? 0.25 : 1);
      const wr = Math.pow((p.at.ins * 0.6 + p.at.ath * 0.25 + p.at.hnd * 0.15) / 75, 4) * 36 * limR * (lean.rim || 1) * (want3 ? 0.3 : 1) * (zone ? 0.75 : 1) * (c.focus === 'rim' ? 1.25 : 1) * (c.focus === 'three' ? 0.8 : 1);
      if (only3 && p.at.thr >= 60) return '3';
      const x = rr(0, w3 + wm + wr); return x < w3 ? '3' : x < w3 + wm ? 'mid' : 'rim';
    };
    const rimD = D.slice().sort((a, b) => (b.at.blk + b.at.idf) - (a.at.blk + a.at.idf))[0];          // the rim protector
    const shooters = O.filter(p => p.at.thr >= 76).length;
    // will the defense send help at this man? Stars, hot hands and mismatches draw a second defender; the coach can force it or forbid it
    const adapt = (GM.adapt && GM.adapt[d]) || 0;
    const helpP = (cr, adv, kind) => {
      if (zone) return kind === 'post' || kind === 'drive' || kind === 'pnr' ? 0.62 : 0.25;
      let p = 0.13 + (scor(cr) - 78) / 50 + heatOf(GM, cr) * 0.2 + Math.max(0, adv) / 36 + (kind === 'post' ? 0.05 : kind === 'drive' || kind === 'pnr' ? 0.14 : 0) + adapt - shooters * 0.025;
      if (cd.help === 'dbl') p += cr === threat ? 0.45 : 0.08;
      if (cd.help === 'stay') p *= 0.3;
      if (want3) p *= 0.4;                                        // nobody leaves a shooter when a three is all they need
      return clamp(p, 0.03, 0.88);
    };
    // the man the help leaves: smart defenses help off the worst shooter, the rest off whoever is nearest
    const leftOpen = cr => { const o = O.filter(p => p !== cr); return chance(clamp(0.4 + (iqD - 65) / 45, 0.2, 0.92)) ? o.slice().sort((a, b) => a.at.thr - b.at.thr)[0] : pick(o); };
    const closeout = p => clamp(1 - (R(GM, M[p.id], 'ath') * 0.5 + iqD * 0.5 - 62) / 55, 0.35, 1);       // how open he still is when the rotation gets there

    // the open man: shoot it, dive, swing it once more, or attack the closeout
    const openMan = (p, from, tag) => {
      const op = closeout(p);
      if ((p.at.thr >= 67 || (want3 && p.at.thr >= 62)) && !(sit === 'burn' && GM.clock > 20 && p.at.thr < 80)) { lead[lead.length - 1] += pick([`, and he kicks it out to ${H.last(p)}.`, `: out to ${H.last(p)} on the wing.`, `, and he finds ${H.last(p)} spotting up.`]).replace(' he ', sp.he === 'she' ? ' she ' : ' he '); return { shooter: p, type: '3', open: op, passer: from, play: tag === 'post' && big(from) ? 'post' : 'drive', kick: tag || true, cs: true }; }
      if (big(p) && !want3) { lead[lead.length - 1] += pick([`, and he dumps it down to ${H.last(p)}.`, `: a drop-off pass to ${H.last(p)}.`, `, and he slips it to ${H.last(p)} under the basket.`]).replace(' he ', sp.he === 'she' ? ' she ' : ' he '); return { shooter: p, type: 'rim', open: op * 0.7, passer: from, play: 'cut', cs: true }; }
      const better = O.filter(q => q !== p && q !== from && q.at.thr >= 75).sort((a, b) => b.at.thr - a.at.thr)[0];
      if (better && chance(clamp(0.45 + (p.at.iq - 70) / 60, 0.15, 0.9))) {
        const bad = pass(p, better, 0.018, 'the swing pass'); if (bad) return { done: bad };
        lead[lead.length - 1] += `: out to ${H.last(p)}.`; lead.push(`One more pass, to ${H.last(better)}.`);
        return { shooter: better, type: '3', open: clamp(op + 0.1, 0, 1), passer: p, play: 'spot', kick: tag || true, cs: true, swing: true };
      }
      lead[lead.length - 1] += `: out to ${H.last(p)}, who attacks the closeout.`;
      const t = only3 ? '3' : menu(p, { three: 0.3 });
      return { shooter: p, type: t, open: 0.35, passer: from, play: 'drive', cs: false };
    };
    // nothing there and the clock is running down: somebody has to take a tough one
    const bail = from => {
      if (chance(0.035)) return { done: TO(from || handler, null, `Shot-clock violation, ${GM.T[s].name}.`) };
      const p = chance(0.6) ? goTo : SD.wpick(O, usage);
      if (from && p !== from) { const bad = pass(from, p, 0.02); if (bad) return { done: bad }; }
      lead.push(pick([`Nothing there. ${H.last(p)} has to create late in the clock.`, `The clock is winding down on ${H.last(p)}.`]));
      return { shooter: p, type: only3 ? '3' : menu(p, { mid: 1.3 }), open: -0.75, play: 'iso', late: true };
    };
    // one man goes to work: on the drive, on the block, off the dribble. The defense helps or it doesn't; he reads it or he doesn't.
    const create = (cr, kind, bonus) => {
      const df = M[cr.id];
      const adv0 = (kind === 'post' ? pstAdv(GM, cr, df) : kind === 'iso' ? (drvAdv(GM, cr, df) + shtAdv(GM, cr, df)) / 2 : drvAdv(GM, cr, df)) + (bonus || 0);
      const adv = adv0 * 0.62 + gauss() * 8;
      if (adv0 >= 10 && !zone && (kind === 'post' ? inches(cr) - inches(df) >= 3 : big(df) && !big(cr))) { r.mis = true; lead.push(kind === 'post' ? `${H.last(cr)} has the smaller ${H.last(df)} on the block.` : `${H.last(cr)} likes the matchup with ${H.last(df)}.`); }
      if (chance(helpP(cr, adv0, kind))) {
        const dbl = kind === 'post' || kind === 'iso';
        const open = leftOpen(cr), hlp = zone ? rimD : (M[open.id] !== df ? M[open.id] : rimD);
        r.dbl = hlp;
        const read = chance(clamp(0.52 + (cr.at.iq - 70) / 60 + (cr.at.pas - 70) / 100 - (cr.tr.ego - 55) / 180 - (sit === 'last' ? 0.12 : 0), 0.12, 0.93));
        if (read) {
          lead.push(dbl ? pick([`${H.last(hlp)} comes to double ${H.last(cr)}`, `The double comes at ${H.last(cr)}`, `${H.last(hlp)} leaves ${H.last(open)} to trap ${H.last(cr)}`]) : pick([`${H.last(cr)} gets into the lane and ${H.last(hlp)} has to help`, `${H.last(hlp)} slides over to cut off ${H.last(cr)}`, `${H.last(cr)} draws a second defender`, `${H.last(cr)} collapses the defense`]));
          const bad = pass(cr, open, dbl ? 0.04 : 0.032, 'the kick-out'); if (bad) return { done: bad };
          return openMan(open, cr, kind);
        }
        // he forces it into two defenders
        if (chance(clamp(0.1 + sq(R(GM, hlp, 'stl') - R(GM, cr, 'hnd')) / 650, 0.03, 0.24) * KT)) {
          if (kind !== 'post' && chance(0.38)) return { done: TO(cr, null, `${H.last(cr)} lowers his shoulder into ${H.last(hlp)}: charge.`.replace(' his ', sp.he === 'she' ? ' her ' : ' his '), { off: true, forced: true }) };
          return { done: TO(cr, hlp, pick([`${H.last(cr)} drives into the help and ${H.last(hlp)} strips him.`, `${H.last(cr)} never sees ${H.last(hlp)} coming: stripped.`]).replace(/ him\b/, sp.he === 'she' ? ' her' : ' him')) };
        }
        lead.push(`${H.last(cr)} takes it into ${H.last(hlp)}'s help.`);
        return { shooter: cr, type: only3 ? '3' : kind === 'post' ? (chance(0.75) ? 'rim' : 'mid') : kind === 'iso' ? menu(cr) : (chance(0.7) ? 'rim' : 'mid'), open: -0.8, play: kind === 'pnr' ? 'pnr' : kind, help: hlp };
      }
      // one on one
      if (adv > 5) return { shooter: cr, type: only3 ? '3' : kind === 'iso' ? menu(cr, { rim: 1.5 }) : kind === 'post' ? 'rim' : (chance(0.8) ? 'rim' : menu(cr)), open: clamp(0.25 + adv / 30, 0.3, 0.8), play: kind, beat: true };
      if (adv > -6.5) {
        if (kind === 'post') return { shooter: cr, type: chance(0.62) ? 'rim' : 'mid', open: 0, play: 'post' };
        if (kind === 'iso') return { shooter: cr, type: menu(cr), open: -0.1, play: 'iso' };
        const t = chance(0.5) ? 'rim' : menu(cr, { rim: 0.4 });           // gets a step, or pulls up
        return { shooter: cr, type: only3 ? '3' : t, open: t === 'rim' ? -0.15 : 0.05, play: kind };
      }
      // stopped cold: a strip, a tough shot by a player who thinks he can make anything, or back out and reset
      if (chance(clamp(0.075 + sq(R(GM, df, 'stl') - R(GM, cr, 'hnd')) / 750, 0.02, 0.2) * KT)) return { done: TO(cr, df, pick([`${H.last(df)} rips it from ${H.last(cr)}.`, `${H.last(df)} pokes it away from ${H.last(cr)}.`, `${H.last(cr)} has nowhere to go and loses it to ${H.last(df)}.`])) };
      if (chance(clamp(0.25 + (cr.tr.ego - 55) / 90 - (cr.at.iq - 70) / 120, 0.08, 0.7))) { lead.push(`${H.last(df)} cuts ${H.last(cr)} off.`); return { shooter: cr, type: only3 ? '3' : menu(cr, { mid: 1.6, rim: 0.5 }), open: -0.7, play: kind, tough: true }; }
      lead.push(`${H.last(df)} cuts ${H.last(cr)} off, and he backs it out.`.replace(', and he ', sp.he === 'she' ? ', and she ' : ', and he '));
      return bail(cr);
    };

    // ---------- mistakes before the offense starts: pressure on the ball, and plain carelessness ----------
    if (!trans && putId == null) {
      const hd = M[handler.id], tired = 1 - avg(O.map(p => GM.en[p.id] == null ? 1 : GM.en[p.id]));
      const pPress = press ? clamp(0.062 + sq(avg(D.map(p => R(GM, p, 'stl') * 0.6 + R(GM, p, 'ath') * 0.4)) - (R(GM, handler, 'hnd') + R(GM, handler, 'pas')) / 2) / 600, 0.02, 0.14) : clamp(0.026 + sq(R(GM, hd, 'stl') - R(GM, handler, 'hnd')) / 800, 0.006, 0.07);
      if (chance(pPress * KT * (sit === 'burn' ? 0.8 : 1))) {
        const who = press ? SD.wpick(O, p => 130 - p.at.hnd) : handler, th = press ? SD.wpick(D, p => Math.pow(p.at.stl, 2)) : hd;
        return TO(who, th, press ? pick([`The press traps ${H.last(who)}: ${H.last(th)} comes away with it.`, `${H.last(who)} tries to split the trap and ${H.last(th)} takes it.`]) : pick([`${H.last(th)} picks ${H.last(who)}'s pocket.`, `${H.last(th)} steals it from ${H.last(who)}.`]), { dur: Math.min(dur, rr(4, 9)), run: 0.68 });
      }
      if (chance(clamp(0.036 + (70 - iqO) / 900 + tired * 0.05, 0.012, 0.085) * KT * 0.8 * (sit === 'burn' ? 0.8 : 1))) {
        const who = SD.wpick(O, p => (p.pos === 'PG' ? 1.6 : 1) * (150 - p.at.hnd - p.at.iq * 0.5));
        const off = chance(0.2);
        return TO(who, null, off ? `Offensive foul on ${H.last(who)}: an illegal screen.` : pick([`${H.last(who)} travels.`, `${H.last(who)} steps out of bounds.`, `${H.last(who)} dribbles it off his foot.`.replace(' his ', sp.he === 'she' ? ' her ' : ' his '), `Three seconds on ${GM.T[s].name}.`, `${H.last(who)} is called for carrying.`]), { off });
      }
      // a non-shooting foul (bonus free throws)
      if (chance(0.132 + (press ? 0.025 : 0))) {
        const fouler = SD.wpick(D, p => (100 - p.tr.disc + 30) * (shy(GM, p) >= 1 ? 0.5 : 1)), fouled = SD.wpick(O, usage);
        add(GM, fouler, 'pf'); GM.tf[d]++;
        const bonus = bonusNow();
        if (bonus) {
          let made = 0;
          if (bonus === 1.5) { if (ftOne(GM, fouled)) { made = 1 + (ftOne(GM, fouled) ? 1 : 0); } }
          else made = shoot2(GM, fouled, 2);
          r.kind = 'ft'; r.pts = made; r.shooter = fouled; r.text = `Foul on ${H.last(fouler)} (bonus). ${H.last(fouled)} makes ${made} at the line.`;
          if (bonus === 1.5 && made === 0) { r.text = `Foul on ${H.last(fouler)} (bonus). ${H.last(fouled)} misses the front end of the one-and-one.`; return rebound(GM, r, s, d, O, D, dur * 0.6); }
          return finishPoss(GM, r, s, d, made, fouled, null, true, dur * 0.6);
        }
        r.kind = 'foul'; r.text = `Foul on ${H.last(fouler)}. ${GM.T[s].abbr} ball.`; r.time = dur * 0.4; r.fouler = fouler; r.fouled = fouled; GM.dead = true;
        push(GM, r); GM.clock -= r.time; tick(GM, r.time, s); return checkClock(GM, r);
      }
    }

    // ---------- the play ----------
    const call = GM.user === s && GM.nextCall && !trans && !early && putId == null ? GM.nextCall : null; if (call) r.called = call; GM.nextCall = null;
    r.flow = trans ? 'trans' : early ? 'early' : call && call !== 'auto' ? 'call' : 'half';
    const kap = clamp(15 - (iqO - 65) / 2.5, 7, 17);                      // smart teams go at an advantage harder
    const ex = a => clamp(Math.exp(a / kap), 0.45, 2.4);
    const tgt = p => (shy(GM, M[p.id]) ? 1.25 : 1);                        // go at the defender in foul trouble
    let S = null, play;

    if (putId != null) {
      // an offensive rebound under the rim: go right back up, or kick it out and run offense
      const rb = O.find(p => p.id === putId);
      if (rb && (big(rb) || rb.at.ins >= 72) && chance(clamp(0.5 + (rb.at.ins - 70) / 60, 0.25, 0.8))) { S = { shooter: rb, type: 'rim', open: -0.2, play: 'post', putback: true }; dur = rr(1.5, 4); }
    }
    if (!S && trans) {
      // the break: how many got back, who has the ball, who is running with him
      const mid = (tFrom === 'steal' && O.find(p => p.id === GM.transBy)) || handler;
      const run = O.filter(p => p !== mid).sort((a, b) => (b.at.ath + (big(b) ? -8 : 0)) - (a.at.ath + (big(a) ? -8 : 0)));
      const spd = sq(avg([mid].concat(run.slice(0, 2)).map(p => R(GM, p, 'ath'))) - avg(D.map(p => R(GM, p, 'ath')))) / 60;
      const x = rr(0, 1) - spd;
      const nums = tFrom === 'steal' ? (x < 0.24 ? '1v0' : x < 0.58 ? '2v1' : x < 0.86 ? '3v2' : 'even') : (x < 0.1 ? '2v1' : x < 0.5 ? '3v2' : 'even');
      r.brk = nums; play = 'trans';
      const back = D.slice().sort((a, b) => b.at.ath - a.at.ath)[0];
      if (nums === '1v0') { lead.push(`${H.last(mid)} is all alone.`); S = { shooter: mid, type: 'rim', open: 1, play: 'trans', chase: back }; }
      else if (nums === '2v1') {
        const wing = run[0];
        const dish = chance(clamp(0.5 + (mid.at.iq - 70) / 60 + (mid.at.pas - 70) / 90 - (mid.tr.ego - 55) / 150 + (wing.at.ath - mid.at.ath) / 80, 0.15, 0.9));
        if (dish) { const bad = pass(mid, wing, 0.045, 'the lead pass'); if (bad) return bad; lead.push(`Two on one: ${H.last(mid)} draws ${H.last(back)} and gives it up.`); S = { shooter: wing, type: 'rim', open: 0.9, passer: mid, play: 'trans', cs: true, lob: wing.at.ath >= 80 }; }
        else { lead.push(`Two on one, and ${H.last(mid)} keeps it.`); S = { shooter: mid, type: 'rim', open: 0.15, play: 'trans', help: back }; }
      } else if (nums === '3v2') {
        const trail = run.find(p => p.at.thr >= 78), wing = run[0];
        const pk = rr(0, 1);
        if (trail && (want3 || pk < 0.3 + (c.focus === 'three' ? 0.15 : 0))) { const bad = pass(mid, trail, 0.03, 'the pitch-back'); if (bad) return bad; lead.push(`${H.last(mid)} pitches it back to the trailer.`); S = { shooter: trail, type: '3', open: 0.75, passer: mid, play: 'trans', cs: true }; }
        else if (pk < 0.7) { const bad = pass(mid, wing, 0.05, 'the pass on the break'); if (bad) return bad; lead.push(`Three on two: ${H.last(mid)} hits ${H.last(wing)} filling the lane.`); S = { shooter: wing, type: 'rim', open: 0.45, passer: mid, play: 'trans', cs: true, help: back }; }
        else S = { shooter: mid, type: only3 ? '3' : (chance(0.7) ? 'rim' : menu(mid)), open: 0.2, play: 'trans', help: back };
      } else {
        // everybody got back: pull it out and run early offense against a defense that is not quite set
        r.flow = 'early'; play = null; dur = Math.max(dur, rr(7, 11));
      }
    }
    const earlyNow = r.flow === 'early';
    if (!S) {
      // which action? The coach's lean, then what this five is good at, then what the moment needs
      if (call && call !== 'auto') play = call === 'three' ? 'spot' : call;
      else {
        const pst = Math.max(-10, ...O.filter(p => p.at.ins >= 68 && (big(p) || inches(p) - inches(M[p.id]) >= 3)).map(p => pstAdv(GM, p, M[p.id])));
        const drv = Math.max(...O.filter(p => p.at.hnd >= 62).map(p => drvAdv(GM, p, M[p.id])), -10);
        const hasBig = O.some(big);
        const w = earlyNow ? { pnr: 14, drive: 34, post: 2, spot: 32, iso: 5, cut: 5 } : { pnr: 27, drive: 16, post: 8, spot: 21, iso: 8, cut: 6, motion: 22 };
        if (putId != null) { w.spot += 16; w.motion = 0; }                 // a kick-out off the offensive board, the defense scrambling
        const foc = c.focus;
        if (foc === 'rim') { w.drive += 14; w.post += 8; w.spot -= 8; } if (foc === 'three') { w.spot += 18; w.pnr += 4; w.post -= 4; } if (foc === 'post') { w.post += 16; } if (foc === 'star') w.iso += 12;
        w.post *= zone ? 0.8 : clamp(ex(pst), 0.5, 1.7) * (hasBig ? 1 : 0.6); w.drive *= zone ? 0.7 : clamp(ex(drv), 0.6, 2); w.spot *= clamp(0.55 + shooters * 0.22, 0.5, 1.5) * (zone ? 1.4 : 1);
        w.pnr *= clamp((handler.at.hnd + handler.at.pas) / 150, 0.6, 1.25) * (hasBig ? 1 : 0.6); w.iso *= scor(goTo) >= 86 ? 1.5 : 1; if (w.motion) w.motion *= clamp(0.4 + (iqO - 60) / 25, 0.5, 1.5);
        if (want3) { w.spot = (w.spot + 20) * 2.6; w.post *= 0.15; w.cut *= 0.2; w.iso *= 1.2; }
        if (sit === 'last') { w.iso = 46; w.pnr = 40; w.motion = 0; w.cut = 3; w.spot = 10; w.drive = 12; w.post = big(goTo) ? 40 : 3; }
        if (sit === 'burn') { w.spot *= 0.6; w.motion = (w.motion || 0) + 10; }
        const ks = Object.keys(w); play = SD.wpick(ks, k => Math.max(0, w[k]));
      }
      const gt = sit === 'last' && !call ? goTo : null;                    // the last shot goes to the go-to guy
      let bonus = earlyNow ? 2.5 : 0;
      if (play === 'motion') {
        // motion: the ball moves until an advantage shows up. Good passing teams get a better look out of it
        r.motion = true;
        const n = 2 + (chance(0.5) ? 1 : 0);
        for (let i = 0; i < n; i++) { const a = pick(O), b = pick(O.filter(p => p !== a)); const bad = pass(a, b, 0.006); if (bad) return bad; }
        bonus += clamp((avg(O.map(p => p.at.pas)) + iqO - 135) / 6, -1.5, 5);
        play = SD.wpick(['spot', 'drive', 'cut', 'post'], k => ({ spot: 42 * clamp(0.55 + shooters * 0.22, 0.5, 1.5), drive: 34, cut: 18, post: 6 })[k]);
      }
      if (play === 'pnr') {
        // the ball screen. The defense has to choose: switch it, drop the big, or trap the ball
        const bh = gt && !big(gt) ? gt : SD.wpick(O.filter(p => p.at.hnd >= 60).length ? O.filter(p => p.at.hnd >= 60) : O, p => Math.pow((p.at.hnd + p.at.pas) / 2, 3) * Math.sqrt(usage(p)));
        const scr = SD.wpick(O.filter(p => p !== bh), p => (big(p) ? 5 : 0.5) * (p.at.ins + p.at.ath + (p.at.thr >= 74 ? 25 : 0)));
        const dh = M[bh.id], ds = M[scr.id];
        const canSwitch = !zone && ds.at.ath >= 70 && ds.at.pdf >= 60;
        const cov = zone ? 'drop' : (cd.help === 'dbl' && bh === threat) || (bh === threat && chance(0.14 + heatOf(GM, bh) * 0.2)) ? 'trap' : canSwitch && chance(0.5) ? 'switch' : !canSwitch && inches(ds) - inches(dh) < 3 && chance(0.4) ? 'switch' : 'drop';
        r.cov = cov;
        if (cov === 'switch') {
          // two new matchups: the guard on the big, the big on the guard. A smart offense goes at the better one
          M[bh.id] = ds; M[scr.id] = dh;
          const aB = drvAdv(GM, bh, ds), aS = scr.at.ins >= 66 ? pstAdv(GM, scr, dh) : -20;
          const hunt = chance(clamp(0.45 + (iqO - 68) / 40, 0.2, 0.9));
          if (hunt && aS > aB + 2 && !want3) { const bad = pass(bh, scr, 0.03, 'the entry'); if (bad) return bad; lead.push(`They switch the screen: ${H.last(scr)} has ${H.last(dh)} in the post.`); S = create(scr, 'post', 0); if (S && !S.done && S.shooter === scr && !S.passer) S.passer = bh; }
          else { lead.push(`They switch, and ${H.last(bh)} has the big man ${H.last(ds)} on an island.`); S = create(bh, 'iso', 2); }
          if (S && !S.done) S.play = S.play === 'post' ? 'post' : S.kick ? S.play : 'pnr';
        } else if (cov === 'trap') {
          // two on the ball: get rid of it. The screener catches it in space with a four-on-three behind him
          lead.push(`${H.last(dh)} and ${H.last(ds)} trap ${H.last(bh)} off the screen.`); r.dbl = ds;
          const bad = pass(bh, scr, 0.055, 'the pass out of the trap'); if (bad) return bad;
          const makesPlay = chance(clamp(0.4 + (scr.at.iq - 70) / 50 + (scr.at.pas - 65) / 70, 0.1, 0.9));
          const sh = O.filter(p => p !== bh && p !== scr).sort((a, b) => b.at.thr - a.at.thr)[0];
          if (makesPlay && sh && sh.at.thr >= 72 && (want3 || chance(0.55))) { const b2 = pass(scr, sh, 0.02, 'the short-roll pass'); if (b2) return b2; lead.push(`${H.last(scr)} catches on the short roll and finds the shooter.`); S = { shooter: sh, type: '3', open: 0.8, passer: scr, play: 'spot', cs: true, kick: 'trap' }; }
          else S = { shooter: scr, type: only3 ? '3' : scr.at.thr >= 76 && chance(0.4) ? '3' : chance(0.75) ? 'rim' : 'mid', open: 0.4, passer: bh, play: 'pnr', cs: true, help: rimD !== ds ? rimD : null };
        } else {
          // the drop: the big sits back. The handler can pull up behind the screen, turn the corner, hit the roller or the pop
          const pop = scr.at.thr >= 74, rollW = (scr.at.ins + scr.at.ath) / 2 * (bh.at.pas / 75) * (zone ? 0.6 : 1) * (want3 ? 0.2 : 1), popW = pop ? scr.at.thr * 0.9 * (bh.at.pas / 75) * (want3 ? 2 : 1) : 0;
          const pullW = Math.max(bh.at.thr >= 70 ? bh.at.thr : 0, want3 ? 0 : bh.at.mid * 0.8) * 1.05 * (gt ? 1.5 : 1), turnW = want3 ? 8 : (bh.at.ath + bh.at.ins) / 2 * 0.95 * (gt ? 1.5 : 1);
          const x = rr(0, rollW + popW + pullW + turnW);
          if (x < rollW) { const bad = pass(bh, scr, 0.036, 'the pocket pass'); if (bad) return bad; S = { shooter: scr, type: chance(0.82) ? 'rim' : 'mid', open: clamp(0.2 + (bh.at.pas - 70) / 60, 0, 0.6), passer: bh, play: 'pnr', cs: true, help: ds, lob: scr.at.ath >= 80 }; }
          else if (x < rollW + popW) { const bad = pass(bh, scr, 0.02, 'the pass to the pop'); if (bad) return bad; lead.push(`${H.last(scr)} pops out behind the line.`); S = { shooter: scr, type: '3', open: 0.65, passer: bh, play: 'pnr', cs: true }; }
          else if (x < rollW + popW + pullW) { const t3 = bh.at.thr >= 70 && (want3 || chance(clamp(0.5 + (bh.at.thr - bh.at.mid) / 40, 0.2, 0.85))); S = { shooter: bh, type: t3 ? '3' : 'mid', open: 0.3, play: 'pnr', pull: true }; }
          else { S = create(bh, 'pnr', 5 + bonus); if (S && !S.done && !S.kick && S.play !== 'iso') S.play = 'pnr'; }
        }
      } else if (play === 'drive') {
        const ok = O.filter(p => p.at.hnd >= 58 || big(p) === false);
        const cr = gt || SD.wpick(ok.length ? ok : O, p => usage(p) * (p.at.ath + p.at.hnd) / 140 * ex(drvAdv(GM, p, M[p.id])) * tgt(p) * (p.at.hnd < 62 ? 0.25 : 1));
        S = create(cr, 'drive', bonus);
      } else if (play === 'post') {
        const cr = gt && big(gt) ? gt : SD.wpick(O, p => (big(p) ? 4 : inches(p) - inches(M[p.id]) >= 3 ? 1.5 : 0.25) * p.at.ins * om(p) * ex(pstAdv(GM, p, M[p.id])) * tgt(p) * (1 + 0.3 * heatOf(GM, p)));
        const feeder = handler !== cr ? handler : O.find(p => p !== cr);
        const bad = pass(feeder, cr, 0.03 + (zone ? 0.012 : 0), 'the entry pass'); if (bad) return bad;
        S = create(cr, 'post', bonus); if (S && !S.done && S.shooter === cr && !S.passer) S.passer = feeder;
      } else if (play === 'spot' || play === 'three') {
        // a shooter comes off a screen: does he shake his man?
        play = 'spot';
        const pool = O.filter(p => p !== handler);
        const sh = (gt && gt !== handler && gt.at.thr >= 72 ? gt : SD.wpick(pool, p => Math.pow(p.at.thr, 2.8) * om(p) * (1 + 0.35 * heatOf(GM, p)) * ex(shtAdv(GM, p, M[p.id]) * 0.6))) || handler;
        const df = M[sh.id];
        const a = shtAdv(GM, sh, df) * 0.5 + (sh.at.iq - df.at.iq) / 5 + (zone ? 4 : 0) + bonus + (putId != null ? 4 : 0) + gauss() * 7 - (want3 ? 3 : 0) - (df.at.pdf >= 85 ? 2 : 0);
        const bad = pass(handler, sh, 0.014, 'the pass to the wing'); if (bad) return bad;
        if (a > 1) S = { shooter: sh, type: '3', open: clamp(0.35 + a / 22, 0.35, 0.95), passer: handler, play: 'spot', cs: true };
        else if (a > -6 || only3) S = { shooter: sh, type: only3 || sh.at.thr >= 74 || chance(0.5) ? '3' : 'mid', open: -0.15, passer: handler, play: 'spot', cs: true };
        else if (chance(clamp(0.5 + (sh.at.iq - 70) / 60, 0.2, 0.85)) && sh.at.hnd >= 62) { lead.push(`${H.last(df)} runs ${H.last(sh)} off the line.`); S = { shooter: sh, type: chance(0.55) ? 'mid' : 'rim', open: 0.15, passer: handler, play: 'drive' }; }
        else S = { shooter: sh, type: '3', open: -0.7, passer: handler, play: 'spot', cs: true, tough: true };
      } else if (play === 'cut') {
        // the backdoor: an overplaying defender, a cutter who reads it, a passer who sees it
        const pool = O.filter(p => p !== handler);
        const cu = SD.wpick(pool, p => p.at.ath * p.at.iq * om(p) * (M[p.id].at.iq < 68 ? 1.4 : 1)) || handler, df = M[cu.id];
        const a = (R(GM, cu, 'ath') + cu.at.iq) / 2 - (R(GM, df, 'pdf') + df.at.iq) / 2 + (handler.at.pas - 70) / 4 + bonus + gauss() * 8 + 4 - (zone ? 6 : 0);
        if (a > 0) { const bad = pass(handler, cu, 0.04, 'the backdoor pass'); if (bad) return bad; S = { shooter: cu, type: 'rim', open: clamp(0.5 + a / 25, 0.5, 1), passer: handler, play: 'cut', cs: true, help: chance(0.4) ? rimD : null, lob: cu.at.ath >= 82 && chance(0.5) }; }
        else if (chance(0.2)) return TO(handler, df, `${H.last(df)} sits on the backdoor cut and takes the pass away from ${H.last(handler)}.`);
        else { lead.push(`${H.last(df)} doesn't bite on the backdoor cut.`); S = bail(handler); }
      } else {
        play = 'iso';
        const cr = gt || SD.wpick(O, p => Math.pow(usage(p), 1.3) * ex((drvAdv(GM, p, M[p.id]) + shtAdv(GM, p, M[p.id])) / 2) * tgt(p) * (p.at.hnd < 60 ? 0.3 : 1));
        if (cr !== handler) { const bad = pass(handler, cr, 0.012); if (bad) return bad; }
        S = create(cr, 'iso', bonus);
      }
    }
    if (!S) S = bail(handler);
    if (S.done) return S.done;

    // ---------- the shot ----------
    const shooter = S.shooter, type = S.type, open = S.open || 0, passer = S.passer && S.passer !== shooter ? S.passer : null;
    play = S.play || play || 'iso';
    const dfn = M[shooter.id] || pick(D);
    const help = type === 'rim' ? (S.help !== undefined ? S.help : (open >= 0.85 ? null : (zone ? rimD : (rimD !== dfn ? rimD : null)))) : null;
    const w = sp.he === 'she';
    const clutchB = endGame && GM.clock < 120 && Math.abs(diff) <= 6 ? (shooter.tr.clutch - 82) / 900 : 0;
    const home = (GM.neutral ? 0 : (s === 'h' ? 0.6 : -0.4) * GM.hc) + (GM.restAdj ? GM.restAdj[s] : 0);
    const mom = (GM.run.s === s ? Math.min(4, GM.run.n / 3) * 0.004 : 0);
    const soft = shy(GM, dfn) * 0.018 + (help ? shy(GM, help) * 0.012 : 0);            // a defender in foul trouble can't afford to contest
    const con = 1 - Math.max(0, open) * 0.55;                                            // an open shooter barely feels his man
    let pm;
    if (type === 'rim') pm = (w ? 0.568 : 0.628) + sq(R(GM, shooter, 'ins') - R(GM, help || dfn, 'idf')) / 170 * con * KR + sq(R(GM, shooter, 'ath') - R(GM, dfn, 'ath')) / 320 * KR + (play === 'trans' ? 0.06 : 0) - (zone ? 0.03 : 0) + (open >= 0 ? open * 0.1 : open * 0.105) + (S.lob ? 0.04 : 0) + (S.putback ? 0.03 : 0);
    else if (type === 'mid') pm = (w ? 0.395 : 0.422) + sq(R(GM, shooter, 'mid') - R(GM, dfn, 'pdf')) / 210 * con * KR + (open >= 0 ? open * 0.07 : open * 0.075);
    else pm = (w ? 0.294 : 0.314) + sq(R(GM, shooter, 'thr') - R(GM, dfn, 'pdf')) / 200 * con * KR + (S.cs ? 0.012 : -0.022) + (zone ? 0.008 : 0) + (passer ? (passer.at.pas - 70) / 1400 : 0) + (open >= 0 ? open * 0.05 : open * 0.07) + (only3 ? -0.02 : 0);
    pm = clamp(pm + clutchB + home + mom + soft + heatOf(GM, shooter) * 0.012 + (S.late ? -0.01 : 0) + (shooter.tr.cons < 72 ? gauss() * 0.04 : 0), 0.1, 0.9);
    const val = type === '3' ? 3 : 2;
    // blocks and shooting fouls
    const bk = S.chase || help || dfn;
    const blkP = (type === 'rim' ? clamp(0.078 + (bk.at.blk - 65) / 330, 0.02, 0.19) * (S.chase ? 0.35 : open < 0 ? 1.45 : open > 0.6 ? 0.45 : 1) : type === 'mid' ? 0.02 * (open < 0 ? 1.4 : 0.6) : 0.008 * (open < 0 ? 1.5 : 0.4)) * (shy(GM, bk) ? 0.75 : 1);
    const foulP = (type === 'rim' ? 0.285 + (shooter.at.ath - 70) / 500 + (open < 0 ? 0.045 : 0) + (S.putback ? 0.03 : 0) - (open > 0.85 ? 0.1 : 0) : type === 'mid' ? 0.085 : 0.026) * (shy(GM, dfn) >= 1 ? 0.7 : 1) * (endGame && GM.clock < 30 && diff < 0 && diff >= -3 ? 0.6 : 1);
    r.play = play; r.type = type; r.shooter = shooter; r.dfn = dfn; r.open = open >= 0.6 ? 'open' : open <= -0.5 ? 'cont' : undefined; if (passer) r.passer = passer;
    if (S.kick) r.kick = true; if (S.putback) r.putback = true; if (S.lob) r.lob = true;
    const pre = lead.length ? lead.join(' ') + ' ' : '';
    add(GM, shooter, 'fga'); if (type === '3') add(GM, shooter, 'tpa');
    if (chance(blkP)) {
      const b = bk; add(GM, b, 'blk'); bump(GM, shooter, -0.12);
      r.blk = b; r.text = pre + (S.chase ? `${H.last(b)} chases ${H.last(shooter)} down from behind and blocks it!` : `${H.last(b)} blocks ${H.last(shooter)}${type === 'rim' ? ' at the rim' : ''}!`); r.big = true;
      return rebound(GM, r, s, d, O, D, dur);
    }
    const fouled = chance(foulP);
    const made = chance(pm * (fouled ? 0.55 : 1));
    if (fouled) { const f = type === 'rim' && help && chance(0.4) ? help : dfn; add(GM, f, 'pf'); GM.tf[d]++; r.fouler = f; }
    if (made) {
      add(GM, shooter, 'fgm'); add(GM, shooter, 'pts', val); if (type === '3') add(GM, shooter, 'tpm');
      bump(GM, shooter, type === '3' ? 0.3 : 0.2);
      let pts = val, ast = null;
      // an assist needs a pass that made the shot: a catch-and-shoot, a cut, a roll. Not a pass to a man who then went to work
      const astP = !passer ? (play === 'trans' ? 0.2 : 0.07) : S.cs ? 0.95 : play === 'post' ? 0.42 : play === 'drive' ? 0.4 : 0.3;
      if (chance(astP)) { ast = passer || SD.wpick(O.filter(p => p !== shooter), p => Math.pow(p.at.pas, 2.5)); add(GM, ast, 'ast'); }
      if (fouled) { const ft = ftOne(GM, shooter); pts += ft ? 1 : 0; r.and1 = true; }
      if (type === 'rim' && !fouled && shooter.at.ath >= 74 && chance(clamp((shooter.at.ath - 68) / 45 + (play === 'trans' || play === 'cut' || S.lob ? 0.22 : 0) - (shooter.pos === 'PG' ? 0.15 : 0), 0.03, 0.66))) r.dunk = true;
      r.pts = pts; r.ast = ast;
      r.text = pre + describe(GM, shooter, type, S.putback ? 'putback' : S.lob && r.dunk ? 'lob' : play, ast, r.and1, pts, r.dunk, S);
      r.big = type === '3' && Math.abs(diff) <= 5 && endGame || (play === 'trans' && type === 'rim' && shooter.at.ath >= 85) || !!r.dunk;
      return finishPoss(GM, r, s, d, pts, shooter, ast, false, dur);
    }
    bump(GM, shooter, type === '3' ? -0.12 : -0.1);
    if (fouled) {
      const n = type === '3' ? 3 : 2, ftm = shoot2(GM, shooter, n);
      r.kind = 'ft'; r.pts = ftm; r.text = pre + `${H.last(shooter)} is fouled on the ${type === '3' ? 'three' : S.putback ? 'putback' : 'shot'} by ${H.last(r.fouler)}. Makes ${ftm} of ${n}.`;
      return finishPoss(GM, r, s, d, ftm, shooter, null, true, dur);
    }
    const how = S.putback ? 'the putback' : type === '3' ? (open >= 0.6 ? 'an open three' : open <= -0.5 ? 'a contested three' : 'a three') : type === 'mid' ? (open <= -0.5 ? 'a tough jumper' : 'a jumper') : (open >= 0.6 ? 'an open look at the rim' : 'at the rim');
    r.text = pre + `${H.last(shooter)} misses ${how}${open <= -0.5 && dfn ? ' (' + H.last(help || dfn) + ' all over it)' : dfn && open < 0.6 && chance(0.25) ? ' (' + H.last(dfn) + ' with a good contest)' : ''}.`;
    return rebound(GM, r, s, d, O, D, dur);
  };
  function describe(GM, p, type, play, ast, and1, pts, dunk, S) {
    S = S || {};
    const n = H.last(p), a = ast ? ` (${H.last(ast)} assist)` : '', his = SD.SP().he === 'she' ? 'her' : 'his';
    if (play === 'putback') return pick([`${n} puts it right back in`, `${n} with the putback`, `${n} cleans up the miss`]) + (and1 ? '. And one!' : '.');
    if (play === 'lob' && ast) return `${H.last(ast)} throws the lob and ${n} hammers it home${and1 ? '. And one!' : '!'}`;
    if (type === '3') {
      if (S.pull) return pick([`${n} pulls up behind the screen: three`, `${n} steps back off the screen and drills it`]) + '.';
      if (S.tough || S.late || (S.open || 0) <= -0.5) return pick([`${n} hits a three with a hand in ${his} face`, `${n} buries a tough one from deep`]) + a + '.';
      if ((S.open || 0) >= 0.6) return pick([`${n} is wide open: three`, `${n} has all day and knocks down the three`, `${n} buries the open three`]) + a + '.';
      return pick([`${n} drills a three`, `${n} from deep: good`, `${n} hits the three`, `${n} buries it from the corner`]) + a + '.';
    }
    if (type === 'mid') return pick(S.tough || S.late ? [`${n} hits a tough jumper`, `${n} fades away and gets it to go`] : [`${n} pulls up and hits`, `${n} with the jumper`, `${n} knocks down the mid-range`]) + a + (and1 ? ' And one!' : '.');
    if (play === 'trans' && p.at.ath >= 82 && chance(0.5)) return `${n} throws it down in transition${a}${and1 ? '. And one!' : '!'}`;
    if (dunk) return pick([`${n} slams it home`, `${n} with the dunk`, `${n} rises up and throws it down`, `${n} finishes with a monster dunk`]) + a + (and1 ? '. And one!' : '!');
    if (play === 'post') return pick([`${n} scores in the post`, `${n} with the hook`, `${n} backs down and scores`]) + a + (and1 ? '. And one!' : '.');
    if (S.beat) return pick([`${n} blows by ${his} man and scores`, `${n} gets all the way to the rim`, `${n} turns the corner and lays it in`]) + a + (and1 ? '. And one!' : '.');
    if ((S.open || 0) <= -0.5) return pick([`${n} finishes through contact`, `${n} scores in traffic`, `${n} hangs and gets it to fall`]) + a + (and1 ? '. And one!' : '.');
    return pick([`${n} finishes at the rim`, `${n} with the layup`, `${n} attacks and scores`, `${n} gets to the cup`]) + a + (and1 ? '. And one!' : '.');
  }
  function ftOne(GM, p) { add(GM, p, 'fta'); const pct = clamp(0.565 + (p.at.ft - 50) / 105 + (GM.per >= GM.nper && GM.clock < 60 ? (p.tr.clutch - 82) / 600 : 0) - (GM.neutral || GM.poss === 'h' ? 0 : 0.01), 0.35, 0.95); const m = chance(pct); if (m) { add(GM, p, 'ftm'); add(GM, p, 'pts'); } return m; }
  function shoot2(GM, p, n) { let m = 0; for (let i = 0; i < n; i++) m += ftOne(GM, p) ? 1 : 0; return m; }
  function rebound(GM, r, s, d, O, D, dur) {
    const orb = clamp((GM.women ? 0.32 : 0.3) + (avg(O.map(p => R(GM, p, 'reb'))) - avg(D.map(p => R(GM, p, 'reb')))) / 230 - (r.type === '3' ? 0.02 : 0), 0.14, 0.42);
    if (chance(orb)) {
      const rb = SD.wpick(O, p => Math.pow(p.at.reb, 3) * (p.pos === 'C' || p.pos === 'PF' ? 1.6 : 0.7)); add(GM, rb, 'orb');
      r.orb = rb; r.text += ` Offensive rebound, ${H.last(rb)}.`;
      GM.putback = rb.id;
      push(GM, r); GM.clock -= dur; tick(GM, dur, s);
      // the possession continues (shot clock resets to 20)
      return checkClock(GM, r);
    }
    const rb = SD.wpick(D, p => Math.pow(p.at.reb, 3) * (p.pos === 'C' || p.pos === 'PF' ? 1.6 : 0.7)); add(GM, rb, 'drb');
    r.drb = rb; r.text += ` ${H.last(rb)} rebounds.`;
    // off a defensive rebound the ball is live: push it (transition), attack early, or walk it up
    const pushK = GM.coach[d].pace === 'fast' ? 1.5 : GM.coach[d].pace === 'slow' ? 0.5 : 1;
    GM.trans = chance((0.17 + (r.blk ? 0.06 : 0) + (r.type === '3' ? 0.03 : 0)) * pushK) ? d : null; if (GM.trans) GM.transFrom = 'reb';
    GM.early = !GM.trans && chance(0.3 * pushK) ? d : null;
    return finishPoss(GM, r, s, d, 0, null, null, false, dur);
  }
  function finishPoss(GM, r, s, d, pts, scorer, ast, ftEnd, dur) {
    dur = dur == null ? r.time : dur; r.time = dur;
    if (pts > 0 || ftEnd) { GM.dead = true; GM.trans = null; GM.early = null; }
    GM.putback = null;
    // the hot hand cools, and the defense leans toward whatever is hurting it (threes: stay home; layups: pack the paint)
    if (GM.heat) for (const k in GM.heat) GM.heat[k] *= 0.94;
    if (pts && r.type && (GM.coach[d].help || 'auto') === 'auto') { GM.adapt = GM.adapt || { h: 0, a: 0 }; GM.adapt[d] = clamp(GM.adapt[d] * 0.96 + (r.type === '3' ? -0.035 : r.type === 'rim' ? 0.022 : 0), -0.2, 0.2); }
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
    r.endPer = true; GM.subNow = true; GM.dead = true; GM.trans = null; GM.early = null; GM.putback = null;
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
