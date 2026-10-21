/* The Vol Index — 16-0.
   Spin an era, draft five Vols on offense and then five on defense (each at his best season), play a 12-game season
   against great teams from the last 30 years (9 SEC + 3 non-conference), the SEC Championship if you finish top two,
   then Selection Day and the 12-team College Football Playoff (five best conference champions + seven at-large,
   straight seeding, seeds 1-4 get a bye). A perfect run is 16-0 (17-0 with a first-round game).
   Needs assets/games.js (window.VIG). The sim engine is exposed as window.VI_RUN_ENGINE for balance testing. */
(function () {
  'use strict';
  const V = window.VIG;
  const { esc, etDate, SITE, reduceMotion, rngFrom, freeSeed, pick, shuffle, gauss, wpick, wsample, ERA_BOOST, store, copyText, twoTap,
    frame, modeBar, bindMode, dkey, FB_ERAS, SLOT_NAME, posLabel, statLine, honorChips, getEras, setEras, rerender } = V;
  let D = null, POOL = [], BYNAME = {};
  const syncData = () => { const x = V.data(); D = x.D; POOL = x.POOL; BYNAME = x.BYNAME; };

  const SLOTS = ['QB', 'RB', 'WR', 'WR', 'TE', 'DL', 'EDGE', 'LB', 'CB', 'S'];
  const OFF = ['QB', 'RB', 'WR', 'TE'];
  const sideOf = pos => OFF.includes(pos) ? 'O' : 'D';
  const REROLLS = 3, CARDS = 6;
  const RUN = { side: store.get('run-side', 'both'), mode: 'daily', st: null };
  const eraLabel = d => d + 's';
  const winEnd = w => w === 2020 ? 2025 : w + 4;   // the 2020s run as one window, 2020-25
  const winLabel = w => w + '-' + String(winEnd(w)).slice(2);
  const lastName = n => n.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(' ').pop();
  const runSlots = side => side === 'off' ? SLOTS.slice(0, 5) : side === 'def' ? SLOTS.slice(5) : SLOTS.slice();

  /* =====================================================================================
     ENGINE (no DOM)
     ===================================================================================== */
  const OPP = id => D.opponents.find(o => o.id === id);
  // tuning (see the balance notes in the games report): opponents sit on the Vol rating scale centered at CENTER
  const TUNE = Object.assign({ center: 76.9, mult: 0.7, sd: 8.5, stock: 88 }, window.VI_RUN_TUNE || {});
  const sq = v => TUNE.center + (v - 78) * 0.7;
  const strength = o => o.off + o.deff;
  // committee resume: team strength plus a bump for few losses (a 14-0 team should not be a 12 seed)
  const resume = o => { const l = +((/^\d+-(\d+)/.exec(o.rec) || [0, 3])[1]); return strength(o) + (l === 0 ? 8 : l === 1 ? 4 : l === 2 ? 1 : 0); };
  function teamRatings(st) {
    const avg = arr => arr.length ? arr.reduce((a, p) => a + p.ovr, 0) / arr.length : null;
    const off = avg(st.slots.filter(s => sideOf(s.pos) === 'O' && s.p).map(s => s.p));
    const def = avg(st.slots.filter(s => sideOf(s.pos) === 'D' && s.p).map(s => s.p));
    return { off: off == null ? TUNE.stock : off, def: def == null ? TUNE.stock : def, genericOff: off == null, genericDef: def == null };
  }
  // site: 1 home, 0 neutral, -1 away. Opponent ratings are squeezed toward 78 so they sit on the same scale as single-season Vol
  // ratings; each point of edge on a side of the ball is worth 1.1 points on the scoreboard.
  function playGame(seedKey, me, o, site) {
    const r = rngFrom(seedKey);
    const oo = sq(o.off), od = sq(o.deff);
    const edge = (x, y) => (x - y) * TUNE.mult, hfa = site * 1.6;
    let us = 27 + edge(me.off, od) + hfa + gauss(r) * TUNE.sd;
    let them = 27 + edge(oo, me.def) - hfa + gauss(r) * TUNE.sd;
    const score = v => { v = Math.max(0, Math.round(v)); if ([1, 2, 4, 5].includes(v)) v = v <= 2 ? 3 : v === 4 ? 3 : 6; return v; };
    us = score(us); them = score(them);
    let ot = false, otPts = 0, otUs = false;
    if (us === them) {
      ot = true; const pUs = 0.5 + (edge(me.off, od) - edge(oo, me.def)) / 60;
      otPts = r() < .6 ? 7 : 3; otUs = r() < pUs;
      if (otUs) us += otPts; else them += otPts;
    }
    return { us, them, w: us > them, ot, otPts, otUs };
  }
  const asTeam = o => ({ off: sq(o.off), def: sq(o.deff) });
  const rosterKey = st => st.slots.map(s => s.p ? s.p.n : '-').join(',');

  function buildSeason(st) {
    const r = rngFrom(st.seed + '|schedule');
    const sec = shuffle(r, D.opponents.filter(o => o.sec)), non = shuffle(r, D.opponents.filter(o => !o.sec));
    const games = sec.slice(0, 9).map(o => ({ o: o.id, conf: true })).concat(non.slice(0, 3).map(o => ({ o: o.id, conf: false })));
    const order = shuffle(r, games);
    order.forEach((g, i) => { g.home = i % 2 === 0; g.wk = i + 1; });
    st.games = order; st.played = 0; st.post = []; st.used = order.map(g => g.o); st.phase = 'season';
  }
  function playRegular(st) {
    const g = st.games[st.played], me = teamRatings(st);
    g.res = playGame(st.seed + '|' + rosterKey(st) + '|g' + g.wk, me, OPP(g.o), g.home ? 1 : -1);
    st.played++;
    return g;
  }
  function record(st) {
    const done = st.games.slice(0, st.played), w = done.filter(g => g.res.w).length;
    const conf = done.filter(g => g.conf), cw = conf.filter(g => g.res.w).length;
    return { w, l: done.length - w, cw, cl: conf.length - cw };
  }
  function enterPost(st) {
    const r = rngFrom(st.seed + '|' + rosterKey(st) + '|post');
    const { cl } = record(st);
    st.phase = 'post'; st.notes = [];
    const qual = cl <= 1 || (cl === 2 && r() < .35);
    if (cl === 2) st.notes.push(qual ? 'Tied at 7-2 in the SEC and won the tiebreaker for a spot in Atlanta.' : 'Tied at 7-2 in the SEC but lost the tiebreaker. No trip to Atlanta.');
    if (cl > 2) st.notes.push(`${9 - cl}-${cl} in the SEC. Not enough for Atlanta.`);
    if (qual) {
      const pool = D.opponents.filter(o => o.sec && !st.used.includes(o.id)).sort((a, b) => strength(b) - strength(a));
      const o = pool[Math.floor(r() * Math.min(3, pool.length))] || pool[0];
      st.scg = { o: o.id, conf: false, neutral: true, label: 'SEC Championship' };
      st.used.push(o.id); st.ps = 'scg';
    } else st.ps = 'select';
  }
  function playSCG(st) {
    const g = st.scg; g.res = playGame(st.seed + '|' + rosterKey(st) + '|scg', teamRatings(st), OPP(g.o), 0);
    st.post.push(g); st.ps = 'select'; return g;
  }
  const ROUNDS = [['R1', 'CFP first round'], ['QF', 'CFP quarterfinal'], ['SF', 'CFP semifinal'], ['F', 'National championship']];
  function makeSelection(st) {
    if (st.br) return;
    const r = rngFrom(st.seed + '|' + rosterKey(st) + '|select');
    const all = st.games.concat(st.post), losses = all.filter(g => !g.res.w).length;
    const secChamp = st.post.some(g => g.label === 'SEC Championship' && g.res.w);
    let seed = null;
    const span = (a, b) => a + Math.floor(r() * (b - a + 1));
    if (losses === 0) seed = 1;
    else if (losses === 1) seed = secChamp ? span(1, 3) : span(4, 7);
    else if (losses === 2) seed = secChamp ? span(3, 6) : span(6, 10);
    else if (losses === 3) seed = secChamp ? span(6, 11) : (r() < .5 ? span(10, 12) : null);
    else if (secChamp) seed = span(9, 12);
    st.seed12 = seed;
    if (!seed) st.notes.push(losses >= 4 ? `${losses} losses against this schedule is still ${losses} losses. Left out of the playoff.` : 'The committee left you just outside the 12-team field. First team out.');
    // the rest of the field: great teams you did not play, stronger teams more likely, seeded by strength
    const unused = D.opponents.filter(o => !st.used.includes(o.id));
    const others = wsample(r, unused, seed ? 11 : 12, o => Math.pow(Math.max(4, strength(o) - 160), 2)).sort((a, b) => resume(b) - resume(a));
    const field = []; let k = 0;
    for (let s = 1; s <= 12; s++) field.push(s === seed ? { seed: s, me: true } : { seed: s, id: others[k++].id });
    const S = n => n;  // seeds
    st.br = { field, rounds: { R1: [[5, 12], [6, 11], [7, 10], [8, 9]].map(([a, b]) => ({ a: S(a), b: S(b) })) }, cur: 0 };
    st.ps = 'bracket';
  }
  const fieldOf = (st, seed) => st.br.field.find(f => f.seed === seed);
  const teamName = (st, seed) => { const f = fieldOf(st, seed); return f.me ? 'Tennessee' : OPP(f.id).y + ' ' + OPP(f.id).team; };
  function nextRoundPairs(st, key) {
    const w = (rk, i) => st.br.rounds[rk][i].win;
    if (key === 'QF') return [[1, w('R1', 3)], [2, w('R1', 2)], [3, w('R1', 1)], [4, w('R1', 0)]];
    if (key === 'SF') return [[w('QF', 0), w('QF', 3)], [w('QF', 1), w('QF', 2)]];
    if (key === 'F') return [[w('SF', 0), w('SF', 1)]];
  }
  // play every game of the current round; returns our game in that round (if any)
  function playRound(st) {
    const [key, label] = ROUNDS[st.br.cur], me = teamRatings(st);
    if (!st.br.rounds[key]) st.br.rounds[key] = nextRoundPairs(st, key).map(([a, b]) => ({ a, b }));
    let mine = null;
    st.br.rounds[key].forEach((g, i) => {
      const A = fieldOf(st, g.a), B = fieldOf(st, g.b), siteA = key === 'R1' ? 1 : 0;   // higher seed hosts the first round
      const sk = st.seed + '|' + rosterKey(st) + '|' + key + i;
      let sa, sb, ot;
      if (A.me || B.me) {
        const opp = OPP(A.me ? B.id : A.id), res = playGame(sk, me, opp, A.me ? siteA : -siteA);
        sa = A.me ? res.us : res.them; sb = A.me ? res.them : res.us; ot = res.ot;
        mine = { o: opp.id, label, neutral: siteA === 0, home: A.me && siteA === 1, res, wk: key };
        st.post.push(mine);
      } else {
        const res = playGame(sk, asTeam(OPP(A.id)), OPP(B.id), siteA);
        sa = res.us; sb = res.them; ot = res.ot;
      }
      g.sa = sa; g.sb = sb; g.ot = ot; g.win = sa > sb ? g.a : g.b;
    });
    st.br.cur++;
    if (st.br.cur >= ROUNDS.length) st.br.champ = st.br.rounds.F[0].win;
    return mine;
  }
  const meAlive = st => {
    if (!st.br || !st.seed12) return false;
    for (let i = 0; i < st.br.cur; i++) { const rk = ROUNDS[i][0]; const g = st.br.rounds[rk].find(x => x.a === st.seed12 || x.b === st.seed12); if (g && g.win !== st.seed12) return false; }
    return true;
  };
  const myNextGame = st => {   // does Tennessee play in the current round?
    if (!meAlive(st) || st.br.cur >= ROUNDS.length) return false;
    const key = ROUNDS[st.br.cur][0];
    if (key === 'R1') return st.seed12 > 4;
    return true;
  };
  const TIERS = [
    [w => w.perfect, 'Neyland Immortals', 'Perfect season. National champions. Nobody touched you.'],
    [w => w.title, 'National Champions', 'Hoist it. The trophy is coming to Knoxville.'],
    [w => w.reached === 'National championship', 'Title game', 'One win from a national title.'],
    [w => w.reached === 'CFP semifinal', 'Final Four', 'A semifinal run against the best teams of the era.'],
    [w => w.reached && w.reached.startsWith('CFP'), 'Playoff team', 'You made the 12-team field.'],
    [w => w.wins >= 9, 'Bowl bound', 'A winning season against an all-time schedule.'],
    [w => w.wins >= 6, 'Bowl eligible', 'Six wins against legends is no small thing.'],
    [() => true, 'Rebuilding', 'This schedule is brutal. Spin again.'],
  ];
  function summary(st) {
    const all = st.games.concat(st.post || []);
    const wins = all.filter(g => g.res.w).length, losses = all.length - wins;
    const last = (st.post || []).slice(-1)[0];
    const title = !!(last && last.label === 'National championship' && last.res.w);
    const cfp = (st.post || []).filter(g => g.label !== 'SEC Championship');
    const reached = cfp.length ? cfp[cfp.length - 1].label : (st.seed12 ? 'CFP quarterfinal' : null);
    const secChamp = (st.post || []).some(g => g.label === 'SEC Championship' && g.res.w);
    const w = { wins, losses, title, perfect: title && losses === 0, reached, secChamp };
    const tier = TIERS.find(t => t[0](w)); w.tier = tier[1]; w.tierText = tier[2];
    return w;
  }
  // non-interactive full run, used by the balance tests
  function simulateRun(st) {
    buildSeason(st); while (st.played < st.games.length) playRegular(st);
    enterPost(st); if (st.ps === 'scg') playSCG(st);
    makeSelection(st); while (st.br.cur < ROUNDS.length) playRound(st);
    return summary(st);
  }

  /* ---------- spins ---------- */
  const openSlots = st => st.slots.filter(s => !s.p).map(s => s.pos);
  function currentSide(st) { const o = openSlots(st); return o.length ? sideOf(o[0]) : null; }
  function runSpin(st) {
    const used = REROLLS - st.rerolls, r = rngFrom(st.seed + '|spin' + st.spin + '|' + used);
    const side = currentSide(st), open = openSlots(st).filter(p => sideOf(p) === side);
    const taken = new Set(st.slots.filter(s => s.p).map(s => s.p.n));
    const seen = new Set(st.seen || []), recent = new Set();   // spins depend only on the seed, so a challenge link replays them exactly
    const sidePool = POOL.filter(p => sideOf(p.slot) === side && !taken.has(p.n));
    // spins land on a five-season window (1995-99, 2000-04 ...) inside the decades you picked
    const inWin = (p, w) => p.y >= w && p.y <= winEnd(w);
    const winsOf = decs => decs.reduce((a, e) => a.concat(e === 2020 ? [2020] : [e, e + 5]), []);
    const fits = w => sidePool.some(p => inWin(p, w) && open.includes(p.slot));
    let wins = winsOf(st.eras).filter(fits), wide = false;
    if (!wins.length) { wins = winsOf(FB_ERAS).filter(fits); wide = true; }
    if (!wins.length) { st.offer = { era: null, ids: [] }; return; }
    const era = wpick(r, wins, w => ERA_BOOST(w) * Math.sqrt(sidePool.filter(p => inWin(p, w)).length));
    const inEra = sidePool.filter(p => inWin(p, era));
    const nearby = sidePool.filter(p => !inWin(p, era) && Math.floor(p.y / 10) * 10 === Math.floor(era / 10) * 10);
    const w = p => (seen.has(p.n) ? 0.15 : 1) * (recent.has(p.n) ? 0.45 : 1) * (0.6 + (p.ovr - 66) / 40);
    const can = inEra.filter(p => open.includes(p.slot));
    const firstPick = wsample(r, can, Math.min(2, can.length), w);
    let rest = wsample(r, inEra.filter(p => !firstPick.includes(p)), CARDS - firstPick.length, w);
    if (firstPick.length + rest.length < CARDS) rest = rest.concat(wsample(r, nearby, CARDS - firstPick.length - rest.length, w));
    const cards = shuffle(r, firstPick.concat(rest));
    st.offer = { era, ids: cards.map(p => p.n), wide, side };
    st.seen = Array.from(new Set((st.seen || []).concat(st.offer.ids)));
  }
  function remember(st) {
    if (st.daily) return;
    const rec = store.get('run-recent', []).filter(n => !(st.seen || []).includes(n));
    store.set('run-recent', (st.seen || []).concat(rec).slice(0, 90));
  }

  /* =====================================================================================
     PLAY-BY-PLAY for the animated games
     ===================================================================================== */
  function decompose(r, pts) {
    if (pts <= 0) return [];
    for (let t = 0; t < 60; t++) {
      const out = []; let left = pts;
      while (left > 0) {
        const o = [];
        if (left >= 7) o.push(7, 7, 7, 7, 7); if (left >= 3) o.push(3, 3); if (left >= 6 && r() < .2) o.push(6); if (left >= 8 && r() < .15) o.push(8); if (left === 2 || (left >= 2 && r() < .03)) o.push(2);
        if (!o.length) break; const v = pick(r, o); out.push(v); left -= v;
      }
      if (left === 0) return out;
    }
    const out = []; let left = pts; while (left >= 3) { out.push(left % 3 === 1 && left >= 7 ? 7 : 3); left -= out[out.length - 1]; } if (left === 2) out.push(2); return out;
  }
  function plays(st, g, o, seedKey) {
    const r = rngFrom(seedKey + '|pbp'), res = g.res;
    const P = pos => { const s = st.slots.filter(x => x.pos === pos && x.p); return s.length ? lastName(pick(r, s).p.n) : null; };
    const me = teamRatings(st), stars = o.stars && o.stars.length ? o.stars : [o.team];
    const ourTD = (v) => {
      const yd = 1 + Math.floor(r() * 60), x = r();
      let t;
      if (me.genericOff) t = `Tennessee ${yd}-yd touchdown`;
      else if (x < .52) t = `${P('QB')} ${yd + 4}-yd TD pass to ${P(pick(r, ['WR', 'WR', 'WR', 'TE', 'RB']))}`;
      else if (x < .86) t = `${P('RB')} ${Math.max(1, yd - 20)}-yd TD run`;
      else if (x < .93) t = `${P('QB')} keeps it, ${Math.max(1, Math.floor(yd / 3))}-yd TD run`;
      else t = me.genericDef ? `Pick-six! ${yd}-yd return` : `${P(pick(r, ['CB', 'S', 'LB']))} ${yd + 10}-yd pick-six`;
      return t + (v === 8 ? ' + 2-pt conversion' : v === 6 ? ' (PAT no good)' : '');
    };
    const oppTD = v => `${lastName(pick(r, stars))} ${1 + Math.floor(r() * 55)}-yd TD` + (v === 8 ? ' + 2-pt' : v === 6 ? ' (PAT no good)' : '');
    const fg = () => `${22 + Math.floor(r() * 31)}-yd field goal`;
    const regUs = res.us - (res.ot && res.otUs ? res.otPts : 0), regThem = res.them - (res.ot && !res.otUs ? res.otPts : 0);
    const ev = [];
    const qw = [.22, .28, .2, .3];
    const addSide = (pts, us) => decompose(r, pts).forEach(v => {
      let x = r(), q = 0; while (q < 3 && x > qw[q]) { x -= qw[q]; q++; }
      const clock = Math.floor(r() * 870) + 15;   // seconds left in the quarter
      const text = v === 3 ? (us ? fg() : `${o.team} ${fg()}`) : v === 2 ? (us ? `Safety! ${P('EDGE') || 'Vols defense'} gets the QB in the end zone` : `${o.team} safety`) : us ? ourTD(v) : oppTD(v);
      ev.push({ q: q + 1, clock, us, v, text });
    });
    addSide(regUs, true); addSide(regThem, false);
    ev.sort((a, b) => a.q - b.q || b.clock - a.clock);
    if (res.ot) ev.push({ q: 5, clock: 0, us: res.otUs, v: res.otPts, text: (res.otUs ? (res.otPts === 7 ? ourTD(7) : fg()) : (res.otPts === 7 ? oppTD(7) : `${o.team} ${fg()}`)) + ' in overtime' });
    let a = 0, b = 0; ev.forEach(e => { if (e.us) a += e.v; else b += e.v; e.a = a; e.b = b; });
    return ev;
  }
  const qLabel = q => q === 5 ? 'OT' : 'Q' + q;
  const clockTxt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  // line score: points per quarter (OT as a fifth column when needed)
  function lineScore(ev, res, uptoSec) {
    const cols = res.ot ? 5 : 4, us = Array(cols).fill(0), them = Array(cols).fill(0);
    ev.forEach(e => { if (evSec(e) <= uptoSec) { const i = e.q - 1; if (e.us) us[i] += e.v; else them[i] += e.v; } });
    return { us, them, cols };
  }
  const evSec = e => e.q === 5 ? 3600 + 300 : (e.q - 1) * 900 + (900 - e.clock);
  function lineTable(o, ls, curQ, done) {
    const head = ['1', '2', '3', '4', 'OT'].slice(0, ls.cols);
    const cell = (v, i) => `<td class="${!done && i + 1 === curQ ? 'cur' : ''}">${done || i + 1 <= curQ ? v : ''}</td>`;
    const tot = a => a.reduce((x, y) => x + y, 0);
    return `<table class="glines" id="sLines"><thead><tr><th></th>${head.map((h, i) => `<th class="${!done && i + 1 === curQ ? 'cur' : ''}">${h}</th>`).join('')}<th>T</th></tr></thead>
      <tbody><tr class="ut"><th>TENN</th>${ls.us.map(cell).join('')}<td class="t">${tot(ls.us)}</td></tr>
      <tr><th>${esc(o.team.length > 10 ? o.team.slice(0, 4).toUpperCase() : o.team.toUpperCase())}</th>${ls.them.map(cell).join('')}<td class="t">${tot(ls.them)}</td></tr></tbody></table>`;
  }
  const SPEEDS = [['slow', 'Slower', 17000], ['normal', 'Normal', 10000], ['fast', 'Faster', 4500]];
  const speedMs = () => (SPEEDS.find(x => x[0] === store.get('sim-speed', 'normal')) || SPEEDS[1])[2];
  function liveBox(st, g, o, ev, done) {
    const res = g.res, label = g.label || ('Week ' + g.wk);
    const ls = lineScore(ev, res, done ? 99999 : -1), sp = store.get('sim-speed', 'normal');
    return `<div class="box glive ${done ? (res.w ? 'w' : 'l') : 'running'}" id="glive">
      <div class="glive-head"><span class="eyebrow">${esc(label)}${g.neutral ? ' · neutral site' : g.home ? ' · Neyland Stadium' : g.home === false && !g.label ? ' · road game' : ''}</span>
        ${done ? '' : `<span class="gspeed" role="group" aria-label="Sim speed">${SPEEDS.map(([k, l]) => `<button data-speed="${k}" aria-pressed="${sp === k}">${l}</button>`).join('')}<button class="glink" id="gSkip">Skip</button></span>`}</div>
      <div class="gscore"><div class="gsc-t ut"><span>Tennessee</span><b id="sUs">${done ? res.us : 0}</b></div>
        <div class="gsc-mid"><span id="sClock">${done ? (res.ot ? 'FINAL/OT' : 'FINAL') : 'Q1 15:00'}</span></div>
        <div class="gsc-t opp"><span>${esc(o.y + ' ' + o.team)}</span><b id="sThem">${done ? res.them : 0}</b></div></div>
      <div id="sLineWrap">${lineTable(o, ls, done ? 9 : 1, done)}</div>
      <ol class="gfeed" id="sFeed">${done ? ev.map(e => feedLi(e)).join('') : ''}</ol></div>`;
  }
  const feedLi = e => `<li class="${e.us ? 'us' : 'them'}"><span class="gf-t">${qLabel(e.q)} ${e.q === 5 ? '' : clockTxt(e.clock)}</span><span class="gf-x">${esc(e.text)}</span><span class="gf-s">${e.a}-${e.b}</span></li>`;
  let ANIM = 0;
  // plays the game out on a game clock; speed can change mid-game (Slower / Normal / Faster)
  function animateLive(ev, res, o, onDone) {
    const token = ++ANIM, box = document.getElementById('glive'); if (!box) return onDone();
    const elUs = box.querySelector('#sUs'), elThem = box.querySelector('#sThem'), elClock = box.querySelector('#sClock'), feed = box.querySelector('#sFeed'), lw = box.querySelector('#sLineWrap');
    const END = res.ot ? 3600 + 600 : 3600;
    let gsec = 0, last = performance.now(), shown = 0, finished = false, curQ = 1;
    const end = () => {
      if (finished) return; finished = true;
      while (shown < ev.length) feed.insertAdjacentHTML('beforeend', feedLi(ev[shown++]));
      elUs.textContent = res.us; elThem.textContent = res.them; elClock.textContent = res.ot ? 'FINAL/OT' : 'FINAL';
      lw.innerHTML = lineTable(o, lineScore(ev, res, 99999), 9, true);
      box.classList.remove('running'); box.classList.add(res.w ? 'w' : 'l');
      const sp = box.querySelector('.gspeed'); if (sp) sp.remove();
      setTimeout(onDone, reduceMotion() ? 0 : 900);
    };
    box.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
      store.set('sim-speed', b.dataset.speed);
      box.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', x === b));
    }));
    const skip = box.querySelector('#gSkip'); if (skip) skip.addEventListener('click', () => { ANIM++; end(); });
    if (reduceMotion()) return end();
    const step = now => {
      if (token !== ANIM || finished) return;
      const dt = Math.min(100, now - last); last = now;
      gsec += dt * 3600 / speedMs();
      const q = gsec >= 3600 ? 5 : Math.min(4, Math.floor(gsec / 900) + 1);
      elClock.textContent = q === 5 ? 'Overtime' : `Q${q} ${clockTxt(Math.max(0, Math.ceil(q * 900 - gsec)))}`;
      let changed = q !== curQ; curQ = q;
      while (shown < ev.length && evSec(ev[shown]) <= gsec) {
        const e = ev[shown++]; feed.insertAdjacentHTML('beforeend', feedLi(e));
        feed.lastElementChild.classList.add('pop'); feed.scrollTop = feed.scrollHeight;
        const el = e.us ? elUs : elThem; el.textContent = e.us ? e.a : e.b;
        const tile = el.parentElement; tile.classList.add('flash'); setTimeout(() => tile.classList.remove('flash'), 700);
        changed = true;
      }
      if (changed) lw.innerHTML = lineTable(o, lineScore(ev, res, gsec), curQ, false);
      if (gsec >= END) return end();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* =====================================================================================
     UI
     ===================================================================================== */
  function render(app) {
    syncData();
    const today = etDate(), daily = store.get(dkey('football', 'run'), null);
    const body = frame(app, 'football', 'run', 'Spin an era and draft Vols at their best season: offense first, then defense. Then try to run the table: 12 games, the SEC Championship and the 12-team College Football Playoff.');
    if (RUN.mode === 'daily' && daily && daily.final && (!RUN.st || !RUN.st.daily || RUN.st.date !== today || RUN.st.phase !== 'done')) { RUN.st = daily.final; RUN.st.phase = 'done'; }
    const ch = V.challenge();
    if (ch && RUN.chUsed !== ch.raw) {   // a friend's challenge link: same spins, same schedule
      RUN.chUsed = ch.raw; RUN.mode = 'free';
      let side = 'both'; try { side = { o: 'off', d: 'def' }[new URLSearchParams(location.search).get('s')] || 'both'; } catch (e) {}
      RUN.st = { phase: 'draft', daily: false, date: today, seed: ch.seed, side, eras: ch.eras && ch.eras.length ? ch.eras : FB_ERAS.slice(), fromChallenge: true,
        slots: runSlots(side).map(p => ({ pos: p, p: null })), spin: 0, rerolls: REROLLS, offer: null, seen: [] };
      runSpin(RUN.st);
    }
    const st = RUN.st;
    if (!st || (st.daily && st.date !== today)) { RUN.st = null; return setup(body, daily); }
    if (st.phase === 'draft') return draft(body);
    if (st.phase === 'season') return season(body);
    if (st.phase === 'post') return post(body);
    return results(body);
  }
  function setup(body, daily) {
    const isDaily = RUN.mode === 'daily', eras = getEras('football');
    body.innerHTML = `${modeBar(RUN.mode, !!(daily && daily.final))}
      <div class="box gsetup">
        <h3>Set up your run</h3>
        ${isDaily ? `<p class="dim">Today's challenge: everyone gets the same spins and the same schedule. Both sides of the ball, every era. One try per day.</p>` : `
        <div class="gfield"><div class="glabel">Roster</div><div class="gseg" data-k="side">
          ${[['both', 'Both sides'], ['off', 'Offense only'], ['def', 'Defense only']].map(([v, l]) => `<button data-v="${v}" aria-pressed="${RUN.side === v}">${l}</button>`).join('')}</div></div>
        <div class="gfield"><div class="glabel">Eras</div><div class="gchips">
          ${FB_ERAS.map(e => `<button data-era="${e}" aria-pressed="${eras.includes(e)}">${eraLabel(e)}</button>`).join('')}
          ${eras.length < FB_ERAS.length ? '<button class="glink" id="eraAll">All eras</button>' : ''}</div>
          <p class="dim small">1980s and early 1990s stat lines come from the UT record book (season leaders) and honors; 1995 on are full season stats. If your eras run out of players at a spot (there are no tight ends with big numbers before 2000), that spin pulls from any era.</p></div>`}
        <div class="gnote"><b>Prime seasons only.</b> Every Vol shows his single best season at Tennessee. Tap or hover a rating to see how it was built.</div>
        <details class="gnote"><summary><b>How OVR works</b></summary>
          <p>OVR = 62 + <b>production</b> (0-24) + <b>awards</b> (0-11) + <b>NFL draft</b> (0-8). Above 95 the climb gets steeper (each point counts 40%), the ceiling is 98, and 99 is reserved for Peyton Manning and Reggie White.</p>
          <ul><li><b>Production:</b> where that season ranks among every Vol at the same spot since 1980 (yards and touchdowns on offense; sacks, tackles for loss, tackles, interceptions and pass breakups on defense, with tackles counting more for interior linemen).</li>
          <li><b>Awards:</b> All-America (unanimous 8, consensus 7, first team 5.5, second/third 3), All-SEC (first 3, second 1.5), SEC player of the year 3-4, national award 4, finalist 1.5, Heisman top 2/5/10 4/2/1.</li>
          <li><b>Draft:</b> 1st round 8, 2nd 6, 3rd 4, 4th 3, 5th 2, 6th-7th 1.</li>
          <li><b>Floors:</b> first-team All-American 88, second/third-team All-American 84, first-round pick 85, first-team All-SEC 83, second-round pick 82, third-round pick 79.</li></ul></details>
        <div class="grow"><button class="btn primary big" id="runStart">Start ${isDaily ? "today's run" : 'free play'}</button></div>
      </div>
      ${howTo()}`;
    bindMode(body, m => { RUN.mode = m; RUN.st = null; rerender(); });
    body.querySelectorAll('[data-k="side"] button').forEach(b => b.addEventListener('click', () => { RUN.side = b.dataset.v; store.set('run-side', RUN.side); rerender(); }));
    body.querySelectorAll('[data-era]').forEach(b => b.addEventListener('click', () => { const e = +b.dataset.era; const n = eras.includes(e) ? eras.filter(x => x !== e) : eras.concat(e).sort(); if (n.length) setEras('football', n); rerender(); }));
    const ea = body.querySelector('#eraAll'); if (ea) ea.addEventListener('click', () => { setEras('football', FB_ERAS.slice()); rerender(); });
    body.querySelector('#runStart').addEventListener('click', () => {
      const d = RUN.mode === 'daily', side = d ? 'both' : RUN.side;
      RUN.st = { phase: 'draft', daily: d, date: etDate(), seed: d ? 'run-' + etDate() : freeSeed(), side, eras: d ? FB_ERAS.slice() : getEras('football').slice(),
        slots: runSlots(side).map(p => ({ pos: p, p: null })), spin: 0, rerolls: REROLLS, offer: null, seen: [] };
      runSpin(RUN.st); rerender();
    });
  }
  function howTo() {
    return `<details class="box ghow"><summary>How it works</summary>
      <ol><li><b>Spin.</b> Each spin lands on a five-season window (1995-99, 2000-04 ... 2020-25) and deals six Vols from it on the side of the ball you're building. Offense first (QB, RB, two WRs, TE), then defense (DT, edge, LB, CB, safety).</li>
      <li><b>Draft.</b> Take one player per spin. Spots you've already filled are greyed out, so a loaded spin can still hurt. Three re-spins per run. Players you've already seen show up less.</li>
      <li><b>Play.</b> Your offense and defense ratings are the average of your starters. Nine SEC games and three non-conference games against great teams from the last 30 seasons (2019 LSU, 2001 Miami, 2022 Georgia...). Sim one game at a time or the whole season.</li>
      <li><b>Postseason.</b> Finish in the SEC's top two for Atlanta. On Selection Day the committee seeds a 12-team field (five best conference champions plus seven at-large, straight seeding, seeds 1-4 get a bye). A perfect run is 16-0, or 17-0 if you have to play in the first round.</li></ol></details>`;
  }
  function board(st, compact, active) {
    const cell = s => `<div class="gslot ${s.p ? 'full' : ''}"><span class="gslot-pos">${posLabel(s.pos)}</span>${s.p ? `<b>${esc(s.p.n)}</b><span class="dim">${s.p.y} · ${s.p.ovr}</span>` : '<span class="dim">Open</span>'}</div>`;
    const off = st.slots.filter(s => sideOf(s.pos) === 'O'), def = st.slots.filter(s => sideOf(s.pos) === 'D');
    const rt = teamRatings(st);
    const grp = (lab, arr, key, val) => arr.length ? `<div class="gboard-side ${active === key ? 'on' : ''}"><div class="glabel">${lab}${arr.every(s => s.p) ? ` <span class="grate">${Math.round(val)}</span>` : ''}</div><div class="gslots">${arr.map(cell).join('')}</div></div>` : '';
    return `<div class="gboard ${compact ? 'compact' : ''}">${grp('Offense', off, 'O', rt.off)}${grp('Defense', def, 'D', rt.def)}</div>`;
  }
  const draftChip = p => p.draft ? `<span class="chip draft">${p.draft[1] ? 'NFL Rd ' + p.draft[1] + ' (' + p.draft[0] + ')' : 'NFL free agent'}</span>` : '';
  function ovrWhy(p) {
    if (!p.rb) return 'Rating for this season';
    const [prod, aw, dr, fl] = p.rb;
    const raw = Math.round((62 + prod + aw + dr) * 10) / 10;
    let t = `62 base + ${prod} production + ${aw} awards + ${dr} NFL draft = ${raw}`;
    if (p.ovr === 99) return t + '. 99 is reserved for Peyton Manning and Reggie White.';
    if (raw > 95) t += `; points above 95 count 40%, so ${p.ovr}`;
    if (fl) t += ` (raised to the ${fl} floor for his honors or draft slot)`;
    return 'OVR ' + p.ovr + ': ' + t;
  }
  function card(p, can, i) {
    return `<button class="gpcard deal ${can ? '' : 'off'}" data-n="${esc(p.n)}" style="--d:${i * 70}ms" ${can ? '' : 'disabled aria-disabled="true"'}>
      <span class="gpc-top"><span class="gpos">${posLabel(p.slot)}</span>${can ? '' : '<span class="gpc-filled">Filled</span>'}<span class="govr" title="${esc(ovrWhy(p))}">${p.ovr}</span></span>
      <b class="gpc-name">${esc(p.n)}</b><span class="gpc-yr">${p.y} · ${esc(p.coach)}</span>
      <span class="gpc-line">${esc(statLine(p))}</span><span class="gpc-hon">${honorChips(p.hon, 2)}${draftChip(p)}</span>
    </button>`;
  }
  function draft(body) {
    const st = RUN.st, side = currentSide(st), offer = st.offer || { ids: [] };
    const open = openSlots(st);
    const cards = offer.ids.map(n => BYNAME[n.toLowerCase()]).filter(Boolean);
    const sideSlots = st.slots.filter(s => sideOf(s.pos) === side), pickN = sideSlots.filter(s => s.p).length + 1;
    body.innerHTML = `${st.daily ? '<div class="gtag">Daily challenge · ' + esc(st.date) + '</div>' : st.fromChallenge ? '<div class="gchal">🤝 A friend\'s challenge: you start from the exact spins and schedule they got.</div>' : ''}
      ${board(st, false, side)}
      ${st.banner ? `<div class="gbanner">${esc(st.banner)}</div>` : ''}
      <div class="box gspin">
        <div class="gspin-head"><div><div class="eyebrow">${side === 'O' ? 'Offense' : 'Defense'} · pick ${pickN} of ${sideSlots.length}</div><h3 id="spinEra">${offer.era ? winLabel(offer.era) + ' Vols' : 'No Vols left'}</h3></div>
          <button class="btn" id="reroll" ${st.rerolls ? '' : 'disabled'}>Re-spin (${st.rerolls} left)</button></div>
        <p class="dim">${offer.wide ? 'No one left at your open spots in your eras, so this spin pulls from every era. ' : ''}Take one. Open: ${open.filter(p => sideOf(p) === side).map(posLabel).join(', ')}.</p>
        <div class="gcards-row" id="spinCards">${cards.map((p, i) => card(p, open.includes(p.slot), i)).join('') || '<p>Nobody fits your open spots. Use a re-spin or start over.</p>'}</div>
      </div>
      <div class="grow"><button class="glink" id="runQuit">Start over</button></div>`;
    const era = body.querySelector('#spinEra');
    if (era && offer.era && !st.animated) { st.animated = true; spinAnim(era, offer.era, body.querySelector('#spinCards')); }
    body.querySelectorAll('.gpcard:not(.off)').forEach(b => b.addEventListener('click', () => {
      const p = BYNAME[b.dataset.n.toLowerCase()], slot = st.slots.find(s => !s.p && s.pos === p.slot);
      if (!slot) return;
      const wasSide = currentSide(st);
      slot.p = p; st.spin++; st.animated = false; st.banner = null;
      if (st.slots.every(s => s.p)) { remember(st); buildSeason(st); }
      else {
        if (currentSide(st) !== wasSide) st.banner = `Offense locked in: ${Math.round(teamRatings(st).off)} OVR. Now build the defense.`;
        runSpin(st);
      }
      rerender();
    }));
    body.querySelector('#reroll').addEventListener('click', () => { if (!st.rerolls) return; st.rerolls--; st.animated = false; runSpin(st); rerender(); });
    twoTap(body.querySelector('#runQuit'), st.daily ? 'Tap again (daily spins stay the same)' : 'Tap again to start over', () => { RUN.st = null; rerender(); });
  }
  function spinAnim(el, era, cardsEl) {
    if (reduceMotion()) return;
    const final = el.textContent; let i = 0; el.classList.add('spinning'); if (cardsEl) cardsEl.classList.add('hold');
    const seq = [1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 1985, 1995, 2005, 2015];
    const tick = () => {
      el.textContent = winLabel(seq[i % seq.length]) + ' Vols'; i++;
      if (i < seq.length) setTimeout(tick, 40 + i * 9);
      else { el.textContent = final; el.classList.remove('spinning'); el.classList.add('landed'); if (cardsEl) cardsEl.classList.remove('hold'); }
    };
    tick();
  }

  // ---- season ----
  function gameRow(st, g, done, label, pending) {
    const o = OPP(g.o), where = g.neutral ? 'vs.' : g.home ? 'vs.' : 'at';
    const SHORT = { 'SEC Championship': 'SEC title', 'CFP first round': 'CFP 1st rd', 'CFP quarterfinal': 'CFP QF', 'CFP semifinal': 'CFP semi', 'National championship': 'Title game' };
    const show = done && !pending;
    if (pending) done = false;
    return `<li class="${show ? (g.res.w ? 'w' : 'l') : ''} ${pending ? 'pend' : ''}" data-wk="${g.wk}"><span class="gwk">${esc(label ? SHORT[label] || label : 'Wk ' + g.wk)}</span>
      <span class="gopp"><b>${where} ${o.y} ${esc(o.team)}</b> <span class="dim">(${esc(o.rec)})${g.conf ? ' · SEC' : ''}</span><span class="gstars">${esc(o.stars.join(', '))}</span></span>
      <span class="gorat" title="Opponent offense / defense">${o.off}/${o.deff}</span>
      <span class="gres">${done ? `<b>${g.res.w ? 'W' : 'L'}</b> ${g.res.us}-${g.res.them}${g.res.ot ? ' OT' : ''}` : ''}</span></li>`;
  }
  function teamBox(st) {
    const me = teamRatings(st), rc = record(st);
    if (st.live && !st.live.done && st.live.idx != null) { const g = st.games[st.live.idx]; if (g.res.w) rc.w--; else rc.l--; if (g.conf) { if (g.res.w) rc.cw--; else rc.cl--; } }
    return `<div class="box gteam"><div class="eyebrow">Your Vols</div>
      <div class="grat"><div><span>${Math.round(me.off)}</span>Offense${me.genericOff ? ' <i class="dim">(stock)</i>' : ''}</div><div><span>${Math.round(me.def)}</span>Defense${me.genericDef ? ' <i class="dim">(stock)</i>' : ''}</div><div><span id="recAll">${rc.w}-${rc.l}</span>Record</div><div><span id="recSec">${rc.cw}-${rc.cl}</span>SEC</div></div>
      ${board(st, true)}</div>`;
  }
  function season(body) {
    const st = RUN.st, busy = !!(st.live && !st.live.done) || !!st.reveal;
    const left = st.games.length - st.played;
    let live = '';
    if (st.live) { const g = st.games[st.live.idx], o = OPP(g.o); live = liveBox(st, g, o, plays(st, g, o, st.seed + '|' + g.wk), st.live.done); }
    body.innerHTML = `${st.daily ? '<div class="gtag">Daily challenge · ' + esc(st.date) + '</div>' : ''}
      ${live}
      <div class="grid g2">${teamBox(st)}
      <div class="box gsched"><div class="gsched-head"><h3>Regular season</h3>${left ? `<div class="gbtns"><button class="btn" id="simOne" ${busy ? 'disabled' : ''}>Sim game ${st.played + 1}</button> <button class="btn primary" id="simAll" ${busy ? 'disabled' : ''}>Sim season</button></div>` : ''}</div>
        <ol class="glist">${st.games.map((g, i) => gameRow(st, g, i < st.played, null, (st.reveal && i >= st.reveal.from && i < st.reveal.to) || (st.live && !st.live.done && i === st.live.idx))).join('')}</ol>
        ${!left && !busy ? `<div class="grow"><button class="btn primary big" id="toPost">Postseason →</button></div>` : ''}</div></div>`;
    const one = body.querySelector('#simOne');
    if (one) one.addEventListener('click', () => { const idx = st.played; playRegular(st); st.live = { idx, done: false }; rerender(); });
    const all = body.querySelector('#simAll');
    if (all) all.addEventListener('click', () => { const from = st.played; while (st.played < st.games.length) playRegular(st); st.live = null; st.reveal = { from, to: st.played }; rerender(); });
    const tp = body.querySelector('#toPost'); if (tp) tp.addEventListener('click', () => { st.live = null; enterPost(st); rerender(); });
    if (st.live && !st.live.done) { const g = st.games[st.live.idx], o = OPP(g.o); animateLive(plays(st, g, o, st.seed + '|' + g.wk), g.res, o, () => { if (st.live) st.live.done = true; rerender(); }); }
    if (st.reveal) revealRows(body, st);
  }
  function revealRows(body, st) {
    const rows = Array.from(body.querySelectorAll('.glist li.pend')), token = ++ANIM;
    let w = record(st).w, l = record(st).l; // final totals; count back
    st.games.slice(st.reveal.from, st.reveal.to).forEach(g => { if (g.res.w) w--; else l--; });
    let cw = 0, cl = 0; st.games.slice(0, st.reveal.from).forEach(g => { if (g.conf) { if (g.res.w) cw++; else cl++; } });
    const recA = body.querySelector('#recAll'), recS = body.querySelector('#recSec');
    const finish = () => { st.reveal = null; rerender(); };
    let i = 0;
    const step = () => {
      if (token !== ANIM) return;
      if (i >= rows.length) return setTimeout(() => { if (token === ANIM) finish(); }, 350);
      const li = rows[i], g = st.games[st.reveal.from + i];
      li.classList.remove('pend'); li.classList.add(g.res.w ? 'w' : 'l', 'pop');
      if (g.res.w) w++; else l++; if (g.conf) { if (g.res.w) cw++; else cl++; }
      if (recA) recA.textContent = w + '-' + l; if (recS) recS.textContent = cw + '-' + cl;
      i++; setTimeout(step, 300);
    };
    if (reduceMotion()) return finish();
    setTimeout(step, 150);
  }

  // ---- postseason ----
  function post(body) {
    const st = RUN.st;
    const head = `${st.daily ? '<div class="gtag">Daily challenge · ' + esc(st.date) + '</div>' : ''}`;
    const rc = record(st), notes = (st.notes || []).map(n => `<p class="dim">${esc(n)}</p>`).join('');
    if (st.ps === 'scg') {
      const g = st.scg, o = OPP(g.o);
      if (st.live) {
        body.innerHTML = head + liveBox(st, g, o, plays(st, g, o, st.seed + '|scg'), st.live.done) +
          (st.live.done ? `<div class="grow"><button class="btn primary big" id="toSel">${g.res.w ? 'SEC champions! On to Selection Day →' : 'Selection Day →'}</button></div>` : '');
        if (!st.live.done) animateLive(plays(st, g, o, st.seed + '|scg'), g.res, o, () => { st.live.done = true; rerender(); });
        const b = body.querySelector('#toSel'); if (b) b.addEventListener('click', () => { st.live = null; makeSelection(st); st.revealSel = true; rerender(); });
        return;
      }
      body.innerHTML = `${head}<div class="box gmatch"><div class="eyebrow">SEC Championship · Atlanta</div>
        <h2>Tennessee <span class="dim">${rc.w}-${rc.l}</span> <span class="gvs">vs.</span> ${esc(o.y + ' ' + o.team)} <span class="dim">${esc(o.rec)}</span></h2>
        <p class="gstars">${esc(o.stars.join(' · '))}</p>${notes}
        <div class="grow"><button class="btn primary big" id="playScg">Play the SEC Championship</button></div></div>`;
      body.querySelector('#playScg').addEventListener('click', () => { playSCG(st); st.ps = 'scg'; st.live = { done: false }; rerender(); });
      return;
    }
    if (st.ps === 'select') { makeSelection(st); st.revealSel = true; }
    // bracket (Selection Day reveal first)
    const br = st.br, inField = !!st.seed12;
    const alive = meAlive(st), champ = br.champ;
    const myGame = myNextGame(st), roundName = br.cur < ROUNDS.length ? ROUNDS[br.cur][1] : null;
    let live = '';
    if (st.live && st.live.g != null) { const g = st.post[st.live.g], o = OPP(g.o); live = liveBox(st, g, o, plays(st, g, o, st.seed + '|' + g.wk), st.live.done); }
    const busy = st.live && !st.live.done;
    const sel = st.revealSel ? selectionDay(st) : '';
    let actions = '';
    if (!busy) {
      if (champ) actions = `<button class="btn primary big" id="toRes">See your final results →</button>`;
      else if (myGame) actions = `<button class="btn primary big" id="playRd">Play the ${esc(roundName.replace('CFP ', ''))}</button> <button class="btn" id="simRest">Sim the rest</button>`;
      else actions = `<button class="btn primary" id="nextRd">${inField && alive ? 'Sim the first round (you have a bye)' : 'Sim the ' + esc((roundName || '').replace('CFP ', ''))}</button> <button class="btn" id="simRest">Sim the whole playoff</button>`;
    }
    body.innerHTML = `${head}${sel}${live}
      <div class="box gbracket-box"><div class="gsched-head"><h3>College Football Playoff</h3><span class="eyebrow">${inField ? 'You: No. ' + st.seed12 + ' seed' : 'You missed the field'}${!alive && inField && !busy ? ' · eliminated' : ''}</span></div>
        ${bracket(st, busy ? st.br.cur - 1 : -1)}
        <div class="grow">${actions}</div></div>`;
    if (st.revealSel) {
      st.revealSel = false;
      if (!reduceMotion()) body.querySelectorAll('.gsel li').forEach((li, i) => { li.style.animationDelay = (i * 120) + 'ms'; li.classList.add('rise'); });
    }
    const play = () => {
      const mine = playRound(st);
      if (mine) { st.live = { g: st.post.indexOf(mine), done: false }; }
      rerender();
    };
    const pr = body.querySelector('#playRd'); if (pr) pr.addEventListener('click', play);
    const nr = body.querySelector('#nextRd'); if (nr) nr.addEventListener('click', () => { st.live = null; play(); });
    const sr = body.querySelector('#simRest'); if (sr) sr.addEventListener('click', () => { st.live = null; while (st.br.cur < ROUNDS.length) playRound(st); rerender(); });
    const tr = body.querySelector('#toRes'); if (tr) tr.addEventListener('click', () => { st.live = null; st.phase = 'done'; finishRun(st); rerender(); });
    if (busy) { const g = st.post[st.live.g], o = OPP(g.o); animateLive(plays(st, g, o, st.seed + '|' + g.wk), g.res, o, () => { st.live.done = true; rerender(); }); }
  }
  function selectionDay(st) {
    const f = st.br.field.slice().sort((a, b) => b.seed - a.seed);
    return `<div class="box gselect"><div class="eyebrow">Selection Day</div><h3>${st.seed12 ? `You're in. No. ${st.seed12} seed.` : 'Left out.'}</h3>
      ${(st.notes || []).map(n => `<p class="dim">${esc(n)}</p>`).join('')}
      <ol class="gsel">${f.map(x => `<li class="${x.me ? 'me' : ''} ${x.seed <= 4 ? 'bye' : ''}"><span class="gseed">${x.seed}</span><b>${esc(teamName(st, x.seed))}</b>${x.me ? '' : `<span class="dim">${esc(OPP(x.id).rec)}</span>`}${x.seed <= 4 ? '<span class="chip">Bye</span>' : ''}</li>`).join('')}</ol></div>`;
  }
  // hide = index of a round whose results stay hidden while Tennessee's game in it is still being played
  function bracket(st, hide = -1) {
    const br = st.br;
    const team = (seed, score, win, played) => {
      const f = fieldOf(st, seed);
      return `<div class="gbt ${f.me ? 'me' : ''} ${played ? (win ? 'win' : 'lose') : ''}"><span class="gseed">${seed}</span><span class="gbn">${esc(teamName(st, seed))}</span>${played ? `<b>${score}</b>` : ''}</div>`;
    };
    const match = (g, rk) => {
      const played = g.win != null;
      return `<div class="gbm ${played ? 'done' : ''}">${team(g.a, g.sa, g.win === g.a, played)}${team(g.b, g.sb, g.win === g.b, played)}${g.ot ? '<span class="gbot">OT</span>' : ''}</div>`;
    };
    const tbdRow = '<div class="gbt dim"><span class="gseed"></span><span class="gbn">TBD</span></div>';
    const tbd = (a, b) => `<div class="gbm tbd">${a ? team(a, null, false, false) : tbdRow}${b ? team(b, null, false, false) : tbdRow}</div>`;
    const cols = ROUNDS.map(([rk, label], i) => {
      let games = br.rounds[rk];
      let html;
      if (games && i === hide) html = games.map(g => tbd(g.a, g.b)).join('');
      else if (games) html = games.map(g => match(g, rk)).join('');
      else if (rk === 'QF') html = [1, 2, 3, 4].map(s => tbd(s, null)).join('');
      else html = (rk === 'SF' ? [0, 1] : [0]).map(() => tbd(null, null)).join('');
      return `<div class="gbcol ${br.cur === i ? 'cur' : ''}"><div class="glabel">${esc(label.replace('CFP ', '').replace('National championship', 'Championship'))}</div>${html}</div>`;
    }).join('');
    const champ = br.champ && hide < ROUNDS.length - 1 ? `<div class="gbchamp ${fieldOf(st, br.champ).me ? 'me' : ''}">🏆 ${esc(teamName(st, br.champ))}</div>` : '';
    return `<div class="gbracket">${cols}</div>${champ}`;
  }

  // ---- results ----
  function finishRun(st) {
    const s = summary(st), me = teamRatings(st);
    const sq = st.games.map(g => g.res.w ? '🟧' : '⬛').join('') + (st.post.length ? ' ' + st.post.map(g => g.res.w ? '🟧' : '⬛').join('') : '');
    const e = st.eras.length === FB_ERAS.length ? '' : '.' + st.eras.map(x => String(x).slice(2)).join('-');
    const link = st.daily ? SITE : `https://www.volindex.net/games/football/run?c=${st.seed}${e}${st.side === 'both' ? '' : '&s=' + st.side[0]}`;
    st.share = `🏈 16-0${st.daily ? ' ' + st.date : ''}: ${s.wins}-${s.losses} · ${s.tier}\n${sq}\nOFF ${Math.round(me.off)} · DEF ${Math.round(me.def)}\n${st.daily ? link : 'Same draft: ' + link}`;
    if (window.VI_TRACK) window.VI_TRACK('finish/football/run/' + (st.daily ? 'daily' : 'free'));
    if (st.daily && window.VI_SYNC) setTimeout(window.VI_SYNC, 500);
    if (st.daily) store.set(dkey('football', 'run', st.date), { final: JSON.parse(JSON.stringify(st)), share: st.share });
    const hist = store.get('run-stats', { played: 0, titles: 0, perfect: 0, best: null });
    hist.played++; if (s.title) hist.titles++; if (s.perfect) hist.perfect++;
    if (!hist.best || s.wins - s.losses > hist.best.w - hist.best.l) hist.best = { w: s.wins, l: s.losses, tier: s.tier };
    store.set('run-stats', hist);
  }
  function results(body) {
    const st = RUN.st;
    st.slots.forEach(s => { if (s.p && !s.p.st) s.p = BYNAME[s.p.n.toLowerCase()] || s.p; });
    const s = summary(st), me = teamRatings(st), hist = store.get('run-stats', { played: 0, titles: 0, perfect: 0 });
    const dsv = store.get(dkey('football', 'run'), null);
    const champName = st.br && st.br.champ ? teamName(st, st.br.champ) : null;
    body.innerHTML = `${modeBar(RUN.mode, !!(dsv && dsv.final))}
      <div class="box gfinal ${s.title ? 'champ' : ''}"><div class="eyebrow">${st.daily ? 'Daily challenge · ' + esc(st.date) : 'Free play'}</div>
        <h2>${s.wins}-${s.losses}</h2><div class="gtier">${esc(s.tier)}</div><p>${esc(s.tierText)}</p>
        ${(st.notes || []).map(n => `<p class="dim">${esc(n)}</p>`).join('')}
        ${st.seed12 ? `<p class="dim">Playoff seed: No. ${st.seed12}${s.secChamp ? ' · SEC champions' : ''}</p>` : ''}
        ${champName && !s.title ? `<p class="dim">National champion: ${esc(champName)}</p>` : ''}
        <div class="grow"><button class="btn primary" id="runShare">Copy result</button> <button class="btn" id="runAgain">${st.daily ? 'Free play' : 'Play again'}</button></div>
        <p class="dim small">Your runs: ${hist.played} played · ${hist.titles} titles · ${hist.perfect} perfect</p></div>
      ${st.br ? `<div class="box gbracket-box"><h3>Playoff bracket</h3>${bracket(st)}</div>` : ''}
      <div class="gresults"><div class="box gteam"><div class="eyebrow">Your Vols · OFF ${Math.round(me.off)} · DEF ${Math.round(me.def)}</div>${board(st, true)}</div>
        <div class="box gsched"><h3>Season</h3><ol class="glist compact">${st.games.map(g => gameRow(st, g, true)).join('')}${(st.post || []).map(g => gameRow(st, g, true, g.label)).join('')}</ol></div></div>`;
    bindMode(body, m => { RUN.mode = m; RUN.st = null; rerender(); });
    body.querySelector('#runShare').addEventListener('click', e => { if (window.VI_TRACK) window.VI_TRACK('share/football/run'); copyText(st.share || '', e.currentTarget); });
    body.querySelector('#runAgain').addEventListener('click', () => { RUN.mode = 'free'; RUN.st = null; rerender(); });
  }

  window.VI_RUN = { render };
  window.VI_RUN_ENGINE = { playGame, teamRatings, buildSeason, playRegular, enterPost, playSCG, makeSelection, playRound, summary, simulateRun, runSpin, syncData, SLOTS, runSlots, sideOf, decompose, plays, ROUNDS };
})();
