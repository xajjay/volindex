/* The Vol Index — undefeated-run games for basketball, baseball and softball (football's 16-0 lives in games-run.js).
   40-0 (men's and women's basketball): spin an era, draft a starting five and a sixth player at their best season, then play
     a 31-game schedule (13 non-conference + 18 SEC) against real teams Tennessee played, the 16-team SEC Tournament
     (seeds 1-4 get a double bye) and the 64-team NCAA Tournament. A perfect run is 31 + 3 + 6 = 40-0.
   Road to Omaha / Road to OKC (baseball and softball): draft a nine-player lineup, then a pitching staff (three weekend starters and a closer in
     baseball, an ace and a No. 2 in softball). 56 regular-season games (SEC weekend series plus non-conference weekends and
     midweeks), the single-elimination SEC Tournament, a four-team double-elimination regional, a best-of-three super
     regional, the eight-team College World Series (two double-elimination brackets) and the best-of-three finals.
     A perfect run is 56 + 3 + 3 + 2 + 3 + 2 = 69 straight wins (shown as "Perfect season", not the record).
   Players: data/games-<sport>.js season lines (rating = where that season ranks among every Tennessee season in our data).
   Opponents: data/run-opps.js, real team-seasons from Tennessee's schedules (tools/build_run_opps.py).
   Needs assets/games.js (window.VIG). The engine is exposed as window.VI_RUN2_ENGINE for balance testing. */
(function () {
  'use strict';
  const V = window.VIG;
  const { esc, etDate, SITE, reduceMotion, rngFrom, freeSeed, pick, shuffle, gauss, wpick, wsample, ERA_BOOST, store, copyText, twoTap,
    frame, modeBar, bindMode, dkey, getEras, setEras, rerender } = V;

  /* =====================================================================================
     SPORT SETUP
     ===================================================================================== */
  const HOOPS = { mbb: 1, wbb: 1 };
  const toks = pos => String(pos || '').toUpperCase().split(/[\/-]/).map(x => x.trim()).filter(Boolean);
  const isHitter = r => r.k === 'H';
  const CONF = {
    mbb: { hoops: true, run: '40-0', icon: '🏀', reg: 31, nonconf: 13, secG: 18, periods: 2, plen: 1200, total: 142, sixth: 'Sixth man', who: 'Vols', lady: false },
    wbb: { hoops: true, run: '40-0', icon: '🏀', reg: 31, nonconf: 15, secG: 16, periods: 4, plen: 600, total: 136, sixth: 'Sixth player', who: 'Lady Vols', lady: true },
    baseball: { hoops: false, run: 'Road to Omaha', icon: '⚾', reg: 56, secSeries: 10, inn: 9, base: 5.7, k: 0.16, cws: "Men's College World Series", omaha: 'Omaha', who: 'Vols' },
    softball: { hoops: false, run: 'Road to OKC', icon: '🥎', reg: 56, secSeries: 8, inn: 7, base: 4.3, k: 0.19, cws: "Women's College World Series", omaha: 'Oklahoma City', who: 'Lady Vols' },
  };
  // roster slots: [code, label, side (O lineup / D pitching / X basketball), fits(row)]
  // positions are strict: a player only goes in a spot his listed position allows (a G/F can play guard or forward)
  const has = (r, ...ts) => toks(r.pos).some(t => ts.includes(t));
  const HOOP_SLOTS = [
    ['G', 'Guard', 'X', r => has(r, 'G', 'PG', 'SG')],
    ['G', 'Guard', 'X', r => has(r, 'G', 'PG', 'SG')],
    ['F', 'Forward', 'X', r => has(r, 'F', 'SF', 'PF')],
    ['F', 'Forward', 'X', r => has(r, 'F', 'SF', 'PF')],
    ['B', 'Big', 'X', r => has(r, 'C', 'F', 'PF')],
    ['6', 'Sixth', 'X', () => true],
  ];
  // diamond: generic "IF/INF" infielders can play any base, utility players (UT/UTL) infield or outfield; no listed position = DH/DP only
  const GEN_IF = ['IF', 'INF', 'UTL', 'UT'];
  const fitBase = base => r => isHitter(r) && has(r, base, ...GEN_IF);
  const fitC = r => isHitter(r) && has(r, 'C');
  const fitOF = r => isHitter(r) && has(r, 'OF', 'LF', 'CF', 'RF', 'UTL', 'UT');
  const fitP = r => r.k === 'P';
  const DIA_HIT = [['C', 'Catcher', 'O', fitC], ['1B', 'First base', 'O', fitBase('1B')], ['2B', 'Second base', 'O', fitBase('2B')], ['SS', 'Shortstop', 'O', fitBase('SS')], ['3B', 'Third base', 'O', fitBase('3B')],
    ['OF', 'Outfield', 'O', fitOF], ['OF', 'Outfield', 'O', fitOF], ['OF', 'Outfield', 'O', fitOF]];
  const SLOTS = {
    mbb: HOOP_SLOTS, wbb: HOOP_SLOTS,
    baseball: DIA_HIT.concat([['DH', 'Designated hitter', 'O', isHitter], ['SP1', 'Friday starter', 'D', fitP], ['SP2', 'Saturday starter', 'D', fitP], ['SP3', 'Sunday starter', 'D', fitP], ['CL', 'Closer', 'D', fitP]]),
    softball: DIA_HIT.concat([['DP', 'Designated player', 'O', isHitter], ['P1', 'Ace', 'D', fitP], ['P2', 'No. 2 pitcher', 'D', fitP]]),
  };
  const slotDefs = (sport, side) => SLOTS[sport].filter(s => !side || side === 'both' || (side === 'off' ? s[2] === 'O' : s[2] === 'D'));
  const REROLLS = 3, CARDS = 6, STOCK = 78;
  // balance (tools: scratch bal2.js): a strong draft wins about 1 title in 5; a random draft rarely gets out of the first weekend
  const TUNE = Object.assign({
    mbb: { center: -4, mult: 1.0, sd: 9, hca: 3.2 },
    wbb: { center: -1.2, mult: 1.05, sd: 9, hca: 3.2 },
    baseball: { center: -4, mult: 1.15, hfa: 0.25 },
    softball: { center: -2.2, mult: 1.15, hfa: 0.2 },
  }, window.VI_RUN2_TUNE || {});

  /* =====================================================================================
     DATA
     ===================================================================================== */
  const DATA = {};
  function data(sport) {
    if (DATA[sport]) return DATA[sport];
    const S = V.initSport(sport), raw = (window.VI_RUN_OPPS || {})[sport] || [];
    const rows = S.rows.filter(r => r.ovr != null);
    const by = {}; rows.forEach(r => { r.id = r.n + '|' + r.s; by[r.id] = r; });
    const pl = {}; S.players.forEach(p => { pl[p.n] = p; });
    const opps = raw.map((x, i) => {
      let h = 0; for (const c of x[0] + x[1]) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const d = ((h % 9) - 4) / 2;   // a team-season leans a little toward offense or pitching/defense
      return { id: i, t: x[0], s: x[1], r: x[2], rk: x[3], sec: !!x[4], site: x[5], reg: !!x[6], off: x[2] + d, pit: x[2] - d };
    });
    const decs = Array.from(new Set(rows.map(r => Math.floor(r.y / 10) * 10))).sort();
    return (DATA[sport] = { S, rows, by, pl, opps, decs, name: S.name || sport });
  }
  const OPP = (st, id) => data(st.sport).opps[id];
  const oName = o => o.s + ' ' + o.t;
  const oTag = o => o.rk ? 'No. ' + o.rk : '';
  const lastName = n => n.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(' ').pop();

  /* =====================================================================================
     RATINGS + ONE GAME
     ===================================================================================== */
  function teamRatings(st) {
    const c = CONF[st.sport], filled = st.slots.filter(s => s.p);
    if (c.hoops) {
      let sum = 0, w = 0; filled.forEach(s => { const k = s.code === '6' ? 0.5 : 1; sum += s.p.ovr * k; w += k; });
      return { team: w ? sum / w : STOCK };
    }
    const hit = filled.filter(s => s.side === 'O'), pit = filled.filter(s => s.side === 'D');
    const off = hit.length ? hit.reduce((a, s) => a + s.p.ovr, 0) / hit.length : STOCK;
    const staff = {}; pit.forEach(s => { staff[s.code] = s.p.ovr; });
    const pitAvg = pit.length ? pit.reduce((a, s) => a + s.p.ovr, 0) / pit.length : STOCK;
    return { off, pit: pitAvg, staff, genericOff: !hit.length, genericPit: !pit.length };
  }
  // who pitches: baseball weekend game n uses the n-th starter (midweek = bullpen), the closer covers the late innings;
  // softball's ace throws two of every three games
  function pitchFor(st, role) {
    const me = teamRatings(st); if (me.genericPit) return { r: STOCK, who: null };
    const s = me.staff, pick2 = code => st.slots.find(x => x.code === code && x.p);
    if (st.sport === 'baseball') {
      const sp = role === 'mid' ? null : 'SP' + (((role || 0) % 3) + 1), cl = s.CL != null ? s.CL : me.pit;
      const start = sp && s[sp] != null ? s[sp] : (role === 'mid' ? Math.min(STOCK, me.pit - 2) : me.pit);
      return { r: 0.72 * start + 0.28 * cl, who: sp && pick2(sp) ? pick2(sp).p : null, cl: pick2('CL') ? pick2('CL').p : null };
    }
    const n = role === 'mid' ? 2 : (role || 0) % 3, code = n === 2 ? 'P2' : 'P1', other = code === 'P1' ? 'P2' : 'P1';
    const a = s[code] != null ? s[code] : me.pit, b = s[other] != null ? s[other] : me.pit;
    return { r: 0.85 * a + 0.15 * b, who: pick2(code) ? pick2(code).p : null };
  }
  // basketball: margin from the rating edge, home court and noise; ties go to overtime
  function hoopGame(sport, seedKey, me, them, site) {
    const r = rngFrom(seedKey), T = TUNE[sport], c = CONF[sport];
    const exp = (me - them) * T.mult + site * T.hca;
    const margin = exp + gauss(r) * T.sd, total = c.total + gauss(r) * 10;
    let us = Math.round((total + margin) / 2), th = Math.round((total - margin) / 2), ot = 0;
    const reg = { us, th };
    while (us === th && ot < 4) {
      ot++; const a = 8 + Math.round(gauss(r) * 3 + exp / 6), b = 8 + Math.round(gauss(r) * 3 - exp / 6);
      us += Math.max(2, a); th += Math.max(2, b);
    }
    if (us === th) { if (r() < 0.5 + exp / 40) us++; else th++; }
    return { us, them: th, w: us > th, ot, reg };
  }
  // baseball/softball: each half-inning either stays quiet or produces a rally; the rally rate comes from the hitters-vs-pitching edge
  function diaGame(sport, seedKey, meOff, mePit, oOff, oPit, site, noExtras) {
    const r = rngFrom(seedKey), c = CONF[sport], T = TUNE[sport];
    const lam = (off, pit, home) => Math.max(0.7, c.base + (off - pit) * c.k * T.mult + (home ? T.hfa : -T.hfa));
    const homeUs = site >= 0 ? site > 0 : null;   // neutral: we bat second half the time
    const usHome = homeUs === null ? r() < 0.5 : homeUs;
    const lu = lam(meOff, oPit, site > 0), lt = lam(oOff, mePit, site < 0);
    const half = mu => { const p = Math.min(0.8, mu / 1.72); if (r() >= p) return 0; let n = 1; while (r() < 0.41 && n < 9) n++; return n; };
    const U = [], Th = [];   // runs by inning (null = that half wasn't needed)
    const H = usHome ? U : Th, A = usHome ? Th : U, lh = usHome ? lu : lt, la = usHome ? lt : lu;
    const sum = a => a.reduce((x, y) => x + (y || 0), 0);
    let mercy = false;
    for (let inn = 1; ; inn++) {
      A.push(half(la / c.inn));
      const last = inn >= c.inn;
      // the home team skips its last at-bat when it's already ahead (or up by 8+ after five in softball)
      if ((last && sum(H) > sum(A)) || (sport === 'softball' && inn >= 5 && sum(H) - sum(A) >= 8)) { H.push(null); mercy = !last; break; }
      let runs = half(lh / c.inn);
      const need = sum(A) - sum(H) + 1;
      if (last && runs >= need) runs = r() < 0.3 ? Math.min(runs, need + 3) : need;   // walk-off: the game ends when the winning run scores
      H.push(runs);
      if (sport === 'softball' && inn >= 5 && !last && Math.abs(sum(H) - sum(A)) >= 8) { mercy = true; break; }
      if (last && sum(H) !== sum(A)) break;
      if (inn >= c.inn + (noExtras ? 0 : 6)) { H[H.length - 1] += 1; break; }   // a very long game: somebody finally scores
    }
    const done = () => ({ a: sum(U), b: sum(Th) });
    const s = done();
    return { us: s.a, them: s.b, w: s.a > s.b, inn: Math.max(U.length, Th.length), U, Th, usHome, mercy };
  }
  // one game for Tennessee; ctx = { site, role } (role = weekend game number or 'mid' for the diamond sports)
  function playOurs(st, key, o, ctx) {
    const sk = st.seed + '|' + rosterKey(st) + '|' + key, me = teamRatings(st);
    const sh = TUNE[st.sport].center;   // opponents shifted onto the Vols rating scale (balance knob)
    if (CONF[st.sport].hoops) return hoopGame(st.sport, sk, me.team, o.r + sh, ctx.site);
    const p = pitchFor(st, ctx.role);
    const res = diaGame(st.sport, sk, me.off, p.r, o.off + sh, o.pit + sh - (ctx.role === 'mid' ? 3 : 0), ctx.site);
    res.sp = p.who ? p.who.n : null;
    return res;
  }
  function playOthers(st, key, A, B, site) {   // two opponents (bracket games Tennessee isn't in)
    const sk = st.seed + '|' + rosterKey(st) + '|' + key;
    if (CONF[st.sport].hoops) return hoopGame(st.sport, sk, A.r, B.r, site);
    return diaGame(st.sport, sk, A.off, A.pit, B.off, B.pit, site);
  }
  const rosterKey = st => st.slots.map(s => s.p ? s.p.id : '-').join(',');

  /* =====================================================================================
     REGULAR SEASON
     ===================================================================================== */
  // games are grouped into blocks: one game (basketball, baseball midweeks) or a weekend (a three-game series or a tournament weekend)
  function buildSeason(st) {
    const r = rngFrom(st.seed + '|schedule'), c = CONF[st.sport], D = data(st.sport);
    const reg = D.opps.filter(o => o.reg);
    const secTeams = Array.from(new Set(reg.filter(o => o.sec).map(o => o.t)));
    const oneVersion = t => pick(r, reg.filter(o => o.t === t));
    const nonPool = reg.filter(o => !o.sec);
    const nonconf = n => { const out = [], seen = new Set(); for (const o of shuffle(r, nonPool)) { if (seen.has(o.t)) continue; seen.add(o.t); out.push(o); if (out.length === n) break; } return out; };
    const siteOf = o => o.site === 'H' ? 1 : o.site === 'A' ? -1 : 0;
    const blocks = [];
    if (c.hoops) {
      nonconf(c.nonconf).forEach(o => blocks.push({ kind: 'g', conf: false, games: [{ o: o.id, site: siteOf(o) }] }));
      const sec = shuffle(r, secTeams).map(oneVersion);
      const twice = sec.slice(0, c.secG - sec.length);
      const conf = [];
      sec.forEach((o, i) => conf.push({ kind: 'g', conf: true, games: [{ o: o.id, site: i % 2 ? 1 : -1 }] }));
      twice.forEach((o, i) => conf.push({ kind: 'g', conf: true, games: [{ o: o.id, site: i % 2 ? -1 : 1 }] }));
      shuffle(r, conf).forEach(b => blocks.push(b));
    } else {
      // non-conference: three opening weekends, then midweek games through the season; SEC weekends from mid-March
      const soft = st.sport === 'softball';
      const weekends = soft ? 4 : 4, perWeekend = soft ? 5 : 3, secN = c.secSeries;
      const nGames = c.reg - secN * 3, mids = nGames - weekends * perWeekend;
      const pool = nonconf(weekends * (soft ? perWeekend : 1) + mids + 4);
      let k = 0;
      const early = [];
      for (let w = 0; w < weekends; w++) {
        if (soft) early.push({ kind: 't', conf: false, label: 'Tournament weekend', games: Array.from({ length: perWeekend }, () => ({ o: pool[k++].id, site: 0 })) });
        else { const o = pool[k++]; early.push({ kind: 's', conf: false, games: [0, 1, 2].map(() => ({ o: o.id, site: w % 3 === 2 ? -1 : 1 })) }); }
      }
      const midG = Array.from({ length: mids }, () => { const o = pool[k++]; return { kind: 'm', conf: false, games: [{ o: o.id, site: r() < 0.7 ? 1 : -1, mid: true }] }; });
      const sec = shuffle(r, secTeams).slice(0, secN).map(oneVersion).map((o, i) => ({ kind: 's', conf: true, games: [0, 1, 2].map(() => ({ o: o.id, site: i % 2 ? -1 : 1 })) }));
      // interleave: weekends in order, a midweek game between weekends
      const weekendsAll = early.concat(sec);
      let m = 0;
      weekendsAll.forEach((b, i) => {
        blocks.push(b);
        const left = midG.length - m, slots = weekendsAll.length - i;
        const take = i < early.length - 1 && !soft ? 1 : Math.ceil(left / slots);
        for (let j = 0; j < take && m < midG.length; j++) blocks.push(midG[m++]);
      });
      while (m < midG.length) blocks.push(midG[m++]);
    }
    let n = 0;
    blocks.forEach((b, i) => { b.i = i; b.games.forEach((g, j) => { g.n = ++n; g.conf = b.conf; g.role = b.kind === 's' ? j : b.kind === 'm' ? 'mid' : (n % 3); }); });
    st.blocks = blocks; st.played = 0; st.post = []; st.phase = 'season'; st.notes = [];
  }
  const allReg = st => st.blocks.reduce((a, b) => a.concat(b.games), []);
  function playBlock(st) {
    const b = st.blocks[st.played];
    b.games.forEach(g => { g.res = playOurs(st, 'g' + g.n, OPP(st, g.o), { site: g.site, role: g.role }); });
    st.played++;
    return b;
  }
  function record(st, games) {
    games = games || allReg(st).filter(g => g.res);
    const w = games.filter(g => g.res.w).length, conf = games.filter(g => g.conf), cw = conf.filter(g => g.res.w).length;
    return { w, l: games.length - w, cw, cl: conf.length - cw };
  }

  /* =====================================================================================
     BRACKETS (SEC Tournament, NCAA region + Final Four)
     ===================================================================================== */
  // a bracket: field = seed -> { me } or { id }; rounds = [{ key, label, m: [{ a, b }] }], a/b = seed number or 'w<round>.<match>'
  function resolve(br, x) { if (typeof x === 'number') return x; const [ri, mi] = x.slice(1).split('.').map(Number); return br.rounds[ri].m[mi].win; }
  function playBracketRound(st, br, labelFor) {
    const rd = br.rounds[br.cur], mine = [];
    rd.m.forEach((g, i) => {
      const a = resolve(br, g.a), b = resolve(br, g.b);
      g.sa = null; g.A = a; g.B = b;
      const A = br.field[a], B = br.field[b], site = br.site ? br.site(a, b) : 0;
      if (A.me || B.me) {
        const o = OPP(st, A.me ? B.id : A.id), label = labelFor(rd);
        const res = playOurs(st, br.tag + rd.key + i, o, { site: A.me ? site : -site, role: br.roleBase != null ? br.roleBase + br.cur : br.cur });
        const post = { o: o.id, label, res, site: A.me ? site : -site, key: br.tag + rd.key };
        st.post.push(post); mine.push(post);
        g.sa = A.me ? res.us : res.them; g.sb = A.me ? res.them : res.us; g.ot = res.ot || (res.inn > CONF[st.sport].inn ? res.inn : 0);
      } else {
        const res = playOthers(st, br.tag + rd.key + i, OPP(st, A.id), OPP(st, B.id), site);
        g.sa = res.us; g.sb = res.them; g.ot = res.ot || (res.inn > (CONF[st.sport].inn || 99) ? res.inn : 0);
      }
      g.win = g.sa > g.sb ? a : b;
    });
    br.cur++;
    if (br.cur >= br.rounds.length) br.champ = br.rounds[br.rounds.length - 1].m[0].win;
    return mine;
  }
  const meIn = (br, seed) => br.field[seed] && br.field[seed].me;
  function bracketAlive(br) {
    const my = +Object.keys(br.field).find(k => br.field[k].me);
    if (!my) return false;
    for (let i = 0; i < br.cur; i++) { const g = br.rounds[i].m.find(x => x.A === my || x.B === my); if (g && g.win !== my) return false; }
    return true;
  }
  function bracketMyGameNow(br) {
    if (!bracketAlive(br) || br.cur >= br.rounds.length) return false;
    const my = +Object.keys(br.field).find(k => br.field[k].me), rd = br.rounds[br.cur];
    return rd.m.some(g => { try { return resolve(br, g.a) === my || resolve(br, g.b) === my; } catch (e) { return false; } });
  }
  // the 16-team SEC Tournament (softball: 15 teams, seeds 5-9 get a bye); seeds 1-4 get a double bye in both
  function secRounds(n) {
    const R = [];
    if (n === 16) {
      R.push({ key: 'R1', label: 'First round', m: [[9, 16], [12, 13], [10, 15], [11, 14]].map(([a, b]) => ({ a, b })) });
      R.push({ key: 'R2', label: 'Second round', m: [[8, 'w0.0'], [5, 'w0.1'], [7, 'w0.2'], [6, 'w0.3']].map(([a, b]) => ({ a, b })) });
    } else {
      R.push({ key: 'R1', label: 'First round', m: [[12, 13], [10, 15], [11, 14]].map(([a, b]) => ({ a, b })) });
      R.push({ key: 'R2', label: 'Second round', m: [[8, 9], [5, 'w0.0'], [7, 'w0.1'], [6, 'w0.2']].map(([a, b]) => ({ a, b })) });
    }
    R.push({ key: 'QF', label: 'Quarterfinals', m: [[1, 'w1.0'], [4, 'w1.1'], [2, 'w1.2'], [3, 'w1.3']].map(([a, b]) => ({ a, b })) });
    R.push({ key: 'SF', label: 'Semifinals', m: [['w2.0', 'w2.1'], ['w2.2', 'w2.3']].map(([a, b]) => ({ a, b })) });
    R.push({ key: 'F', label: 'Championship', m: [{ a: 'w3.0', b: 'w3.1' }] });
    return R;
  }
  function enterPost(st) {
    const r = rngFrom(st.seed + '|' + rosterKey(st) + '|sec'), c = CONF[st.sport];
    const games = allReg(st), rc = record(st);
    // the other SEC teams finish by their strength (with some luck); Tennessee's spot comes from its real SEC record
    const versions = {}; games.filter(g => g.conf).forEach(g => { const o = OPP(st, g.o); versions[o.t] = o; });
    const D = data(st.sport);
    const secTeams = Array.from(new Set(D.opps.filter(o => o.sec && o.reg).map(o => o.t)));
    secTeams.forEach(t => { if (!versions[t]) versions[t] = pick(r, D.opps.filter(o => o.t === t && o.reg)); });
    const confN = games.filter(g => g.conf).length;
    const table = Object.values(versions).map(o => {
      const p = 0.5 + (o.r - 80) / 34;   // a No. 1 team finishes around .87 in the league, an average SEC team around .45
      return { id: o.id, pct: Math.min(0.95, Math.max(0.1, p + gauss(r) * 0.07)) };
    });
    const myPct = rc.cw / Math.max(1, confN) + r() * 0.001;
    table.push({ me: true, pct: myPct });
    table.sort((a, b) => b.pct - a.pct);
    const n = table.length >= 16 ? 16 : table.length;
    const field = {}; table.slice(0, n).forEach((x, i) => { field[i + 1] = x.me ? { me: true } : { id: x.id }; });
    let mySeed = +Object.keys(field).find(k => field[k].me);
    if (!mySeed) { field[n] = { me: true }; mySeed = n; }   // everyone makes the field
    st.secSeed = mySeed;
    st.notes.push(`${rc.cw}-${rc.cl} in the SEC: No. ${mySeed} seed in the SEC Tournament${mySeed <= 4 ? ' with a double bye' : mySeed <= (n === 16 ? 8 : 9) ? ' with a first-round bye' : ''}.`);
    st.sec = { field, rounds: secRounds(n), cur: 0, tag: 'sec', site: () => 0 };
    // skip rounds Tennessee has a bye in (they get simmed when you play your first game)
    st.phase = 'post'; st.ps = 'sec';
  }
  const SEC_LABEL = rd => 'SEC Tournament ' + ({ R1: 'first round', R2: 'second round', QF: 'quarterfinal', SF: 'semifinal', F: 'final' }[rd.key]);

  /* ---------- NCAA basketball: one 16-team region + the Final Four ---------- */
  const R64 = [[1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]];
  const NCAA_ROUNDS = [['R64', 'First round'], ['R32', 'Second round'], ['S16', 'Sweet 16'], ['E8', 'Elite Eight'], ['FF', 'Final Four'], ['NC', 'National championship']];
  function hoopsSelection(st) {
    const r = rngFrom(st.seed + '|' + rosterKey(st) + '|select');
    const all = allReg(st).concat(st.post), L = all.filter(g => !g.res.w).length;
    const secChamp = !!(st.sec.champ && st.sec.field[st.sec.champ].me);
    const span = (a, b) => a + Math.floor(r() * (b - a + 1));
    let seed = L <= 1 ? 1 : L <= 3 ? (secChamp ? 1 : span(1, 2)) : L <= 5 ? span(2, 4) : L <= 7 ? span(3, 6) : L <= 9 ? span(5, 9) : L <= 11 ? (r() < 0.6 ? span(8, 11) : null) : L <= 13 ? (r() < 0.3 ? span(10, 12) : null) : null;
    if (!seed && secChamp) seed = span(10, 13);
    if (!seed) st.notes.push(L >= 14 ? `${L} losses. The committee wasn't going to take that one. NIT bound.` : 'Bubble team, and the bubble burst. First four out.');
    else if (!seed || seed > 12) st.notes.push(`In as the SEC's automatic bid.`);
    st.ncaaSeed = seed;
    const D = data(st.sport), used = new Set([...allReg(st), ...st.post].map(g => OPP(st, g.o).t));
    const target = k => 93 - 1.55 * (k - 1);
    const field = {}, names = new Set();
    for (let k = 1; k <= 16; k++) {
      if (k === seed) { field[k] = { me: true }; continue; }
      const cand = D.opps.filter(o => !names.has(o.t) && !used.has(o.t) && Math.abs(o.r - target(k)) <= 2.6);
      const o = cand.length ? pick(r, cand) : D.opps.filter(x => !names.has(x.t)).sort((a, b) => Math.abs(a.r - target(k)) - Math.abs(b.r - target(k)))[0];
      names.add(o.t); field[k] = { id: o.id };
    }
    // Final Four: the other three regions' champions
    const top = D.opps.filter(o => o.r >= 86 && !names.has(o.t) && !used.has(o.t));
    const others = []; while (others.length < 3 && top.length) { const o = wpick(r, top, x => Math.pow(x.r - 82, 2)); others.push(o); top.splice(top.indexOf(o), 1); names.add(o.t); }
    field[17] = { id: others[0].id, region: 1 }; field[18] = { id: others[1].id, region: 2 }; field[19] = { id: others[2].id, region: 3 };
    const rounds = [
      { key: 'R64', label: 'First round', m: R64.map(([a, b]) => ({ a, b })) },
      { key: 'R32', label: 'Second round', m: [0, 1, 2, 3].map(i => ({ a: 'w0.' + (2 * i), b: 'w0.' + (2 * i + 1) })) },
      { key: 'S16', label: 'Sweet 16', m: [0, 1].map(i => ({ a: 'w1.' + (2 * i), b: 'w1.' + (2 * i + 1) })) },
      { key: 'E8', label: 'Elite Eight', m: [{ a: 'w2.0', b: 'w2.1' }] },
      { key: 'FF', label: 'Final Four', m: [{ a: 'w3.0', b: 17 }, { a: 18, b: 19 }] },
      { key: 'NC', label: 'National championship', m: [{ a: 'w4.0', b: 'w4.1' }] },
    ];
    st.ncaa = seed ? { field, rounds, cur: 0, tag: 'ncaa', site: () => 0 } : null;
    st.ps = seed ? 'ncaa' : 'done';
  }
  const NCAA_LABEL = rd => rd.key === 'NC' ? 'National championship' : rd.key === 'FF' ? 'Final Four' : 'NCAA ' + rd.label.toLowerCase().replace('sweet 16', 'Sweet 16').replace('elite eight', 'Elite Eight');

  /* ---------- NCAA baseball / softball: regional, super regional, College World Series ---------- */
  // four-team double elimination: returns the games in order; Tennessee's games are played with playOurs
  function doubleElim(st, tag, teams, roleBase, hostIdx) {
    const games = [], beat = (a, b, key) => {
      const A = teams[a], B = teams[b], site = hostIdx === a ? 1 : hostIdx === b ? -1 : 0;
      let res, g;
      if (A.me || B.me) {
        const o = OPP(st, A.me ? B.id : A.id), n = games.filter(x => x.mine).length;
        res = playOurs(st, tag + key, o, { site: A.me ? site : -site, role: roleBase + n });
        g = { a, b, sa: A.me ? res.us : res.them, sb: A.me ? res.them : res.us, mine: true, res, o: o.id, site: A.me ? site : -site };
      } else { res = playOthers(st, tag + key, OPP(st, A.id), OPP(st, B.id), site); g = { a, b, sa: res.us, sb: res.them }; }
      g.inn = res.inn; g.win = g.sa > g.sb ? a : b; g.lose = g.win === a ? b : a; g.key = key; games.push(g); return g;
    };
    const g1 = beat(0, 3, 'G1'), g2 = beat(1, 2, 'G2');
    const g3 = beat(g1.lose, g2.lose, 'G3');             // elimination
    const g4 = beat(g1.win, g2.win, 'G4');               // winners' bracket final
    const g5 = beat(g4.lose, g3.win, 'G5');              // elimination
    const g6 = beat(g4.win, g5.win, 'G6');               // championship
    let champ = g6.win;
    if (g6.win === g5.win) { const g7 = beat(g4.win, g5.win, 'G7'); g7.ifnec = true; champ = g7.win; }
    return { games, champ, teams };
  }
  function series(st, tag, A, B, roleBase, siteA) {   // best of three
    const games = []; let wa = 0, wb = 0, i = 0;
    while (wa < 2 && wb < 2) {
      i++;
      let g;
      if (A.me || B.me) {
        const o = OPP(st, A.me ? B.id : A.id), res = playOurs(st, tag + 'G' + i, o, { site: A.me ? siteA : -siteA, role: roleBase + i - 1 });
        g = { sa: A.me ? res.us : res.them, sb: A.me ? res.them : res.us, mine: true, res, o: o.id, site: A.me ? siteA : -siteA, inn: res.inn };
      } else { const res = playOthers(st, tag + 'G' + i, OPP(st, A.id), OPP(st, B.id), siteA); g = { sa: res.us, sb: res.them, inn: res.inn }; }
      if (g.sa > g.sb) wa++; else wb++;
      g.n = i; games.push(g);
    }
    return { games, wa, wb, winA: wa > wb };
  }
  function diaSelection(st) {
    const r = rngFrom(st.seed + '|' + rosterKey(st) + '|select'), c = CONF[st.sport];
    const all = allReg(st).concat(st.post), W = all.filter(g => g.res.w).length, pct = W / all.length;
    const secChamp = !!(st.sec.champ && st.sec.field[st.sec.champ].me);
    const shift = st.sport === 'softball' ? 0.04 : 0;
    let tier = pct >= 0.8 + shift ? 'nat' : pct >= 0.7 + shift ? 'host' : pct >= 0.62 + shift ? 2 : pct >= 0.56 + shift ? (r() < 0.6 ? 3 : null) : null;
    if (!tier && secChamp) tier = 3;
    st.natSeed = tier === 'nat' ? 1 + Math.floor(r() * 8) : null;
    st.regSeed = tier === 'nat' || tier === 'host' ? 1 : tier;
    if (!tier) { st.notes.push(`${W}-${all.length - W} (${Math.round(pct * 100)}%) wasn't enough for the 64-team field.`); st.ps = 'done'; return; }
    st.notes.push(st.natSeed ? `No. ${st.natSeed} national seed: you host a regional and, if you win it, the super regional.` : st.regSeed === 1 ? 'A regional host: the 1 seed in your regional.' : `The No. ${st.regSeed} seed in a regional on the road.`);
    // regional field: Tennessee plus three teams at the other seed lines
    const D = data(st.sport), used = new Set(allReg(st).concat(st.post).map(g => OPP(st, g.o).t)), names = new Set();
    const T = { 1: 86, 2: 80, 3: 74, 4: 67 };
    const draw = target => { const cand = D.opps.filter(o => !names.has(o.t) && !used.has(o.t) && Math.abs(o.r - target) <= 3); const o = cand.length ? pick(r, cand) : D.opps.filter(x => !names.has(x.t)).sort((a, b) => Math.abs(a.r - target) - Math.abs(b.r - target))[0]; names.add(o.t); return o; };
    const reg = [1, 2, 3, 4].map(s => s === st.regSeed ? { me: true, seed: s } : { id: draw(T[s]).id, seed: s });
    st.dia = { reg, stage: 'regional', names: Array.from(names), used: Array.from(used) };
    st.ps = 'regional';
  }
  function playRegional(st) {
    const d = st.dia, host = d.reg.findIndex(t => t.seed === 1);
    const out = doubleElim(st, 'reg', d.reg, 0, host);
    d.regional = out; const me = d.reg[out.champ].me;
    out.games.filter(g => g.mine).forEach((g, i) => st.post.push({ o: g.o, label: 'Regional game ' + (i + 1), res: g.res, site: g.site, key: 'reg' }));
    st.ps = me ? 'super' : 'over';
    if (me) {
      const r = rngFrom(st.seed + '|' + rosterKey(st) + '|super'), D = data(st.sport), names = new Set(d.names.concat(d.used));
      const tgt = st.natSeed ? 84 : 88, cand = D.opps.filter(o => !names.has(o.t) && Math.abs(o.r - tgt) <= 3);
      const o = cand.length ? pick(r, cand) : D.opps.find(x => !names.has(x.t));
      d.superOpp = o.id; d.names.push(o.t);
    }
  }
  function playSuper(st) {
    const d = st.dia, home = st.natSeed ? 1 : -1;
    const out = series(st, 'sup', { me: true }, { id: d.superOpp }, 3, home);
    d.super = out;
    out.games.forEach(g => st.post.push({ o: g.o, label: 'Super Regional game ' + g.n, res: g.res, site: g.site, key: 'sup' }));
    st.ps = out.winA ? 'cws' : 'over';
    if (out.winA) {
      const r = rngFrom(st.seed + '|' + rosterKey(st) + '|cws'), D = data(st.sport), names = new Set(d.names.concat(d.used));
      const top = D.opps.filter(o => o.r >= 84 && !names.has(o.t)), seven = [];
      while (seven.length < 7 && top.length) { const o = wpick(r, top, x => Math.pow(x.r - 80, 2)); seven.push(o); top.splice(top.indexOf(o), 1); top.splice(0, top.length, ...top.filter(x => x.t !== o.t)); }
      d.cwsA = [{ me: true }].concat(seven.slice(0, 3).map(o => ({ id: o.id })));
      d.cwsB = seven.slice(3, 7).map(o => ({ id: o.id }));
    }
  }
  function playCWS(st) {
    const d = st.dia;
    const a = doubleElim(st, 'cwsA', d.cwsA, 6, -1), b = doubleElim(st, 'cwsB', d.cwsB, 0, -1);
    d.cwsAres = a; d.cwsBres = b;
    a.games.filter(g => g.mine).forEach((g, i) => st.post.push({ o: g.o, label: CONF[st.sport].omaha + ' game ' + (i + 1), res: g.res, site: 0, key: 'cws' }));
    st.ps = d.cwsA[a.champ].me ? 'finals' : 'over';
    d.finalOpp = d.cwsB[b.champ].id;
  }
  function playFinals(st) {
    const d = st.dia, out = series(st, 'fin', { me: true }, { id: d.finalOpp }, 9, 0);
    d.finals = out;
    out.games.forEach(g => st.post.push({ o: g.o, label: 'Finals game ' + g.n, res: g.res, site: 0, key: 'fin' }));
    d.champ = out.winA; st.ps = 'over';
  }

  /* =====================================================================================
     RESULTS
     ===================================================================================== */
  function summary(st) {
    const c = CONF[st.sport], all = allReg(st).filter(g => g.res).concat(st.post || []);
    const wins = all.filter(g => g.res.w).length, losses = all.length - wins;
    let title = false, reached = null;
    if (c.hoops) {
      if (st.ncaa) {
        const lastMine = st.post.filter(g => g.key && g.key.startsWith('ncaa')).slice(-1)[0];
        reached = lastMine ? lastMine.label : null;
        title = !!(st.ncaa.champ && st.ncaa.field[st.ncaa.champ].me);
      }
    } else if (st.dia) {
      const d = st.dia;
      title = !!d.champ;
      reached = d.finals ? 'finals' : d.cwsAres ? 'cws' : d.super ? 'super' : d.regional ? 'regional' : null;
    }
    const secChamp = !!(st.sec && st.sec.champ && st.sec.field[st.sec.champ].me);
    const w = { wins, losses, title, perfect: title && losses === 0, reached, secChamp, games: all.length };
    const T = c.hoops ? [
      [x => x.perfect, 'Perfection', c.lady ? 'Unbeaten national champions. Pat would be proud.' : 'Unbeaten national champions. No men\'s team has done it since 1976 Indiana.'],
      [x => x.title, 'National Champions', 'Cut down the nets. The trophy is coming to Knoxville.'],
      [x => x.reached === 'National championship', 'National runner-up', 'One game from a national title.'],
      [x => x.reached === 'Final Four', 'Final Four', 'A Final Four run against the best teams of the last 25 years.'],
      [x => x.reached === 'NCAA Elite Eight', 'Elite Eight', 'One win from the Final Four.'],
      [x => x.reached === 'NCAA Sweet 16', 'Sweet 16', 'Second weekend of March.'],
      [x => x.reached && x.reached.startsWith('NCAA'), 'NCAA Tournament', 'You went dancing.'],
      [x => x.wins >= 20, 'Bubble team', 'Twenty wins and an NIT bid.'],
      [() => true, 'Rebuilding', 'This schedule bites back. Spin again.'],
    ] : [
      [x => x.perfect, 'Perfection', 'A perfect season and a national title. It has never been done.'],
      [x => x.title, 'National Champions', `Dogpile in ${c.omaha}. National champions.`],
      [x => x.reached === 'finals', 'National runner-up', 'Two wins from a national title.'],
      [x => x.reached === 'cws', c.omaha, `You made it to ${c.omaha}.`],
      [x => x.reached === 'super', 'Super Regional', 'One series from ' + c.omaha + '.'],
      [x => x.reached === 'regional', 'Regional', 'In the field of 64.'],
      [x => x.wins >= 35, 'Bubble team', 'A winning year that came up short of the field.'],
      [() => true, 'Rebuilding', 'This schedule bites back. Spin again.'],
    ];
    const t = T.find(x => x[0](w)); w.tier = t[1]; w.tierText = t[2];
    return w;
  }
  // a whole run without the page (balance tests)
  function simulateRun(st) {
    buildSeason(st); while (st.played < st.blocks.length) playBlock(st);
    enterPost(st);
    while (st.sec.cur < st.sec.rounds.length) playBracketRound(st, st.sec, SEC_LABEL);
    if (CONF[st.sport].hoops) { hoopsSelection(st); if (st.ncaa) while (st.ncaa.cur < st.ncaa.rounds.length) playBracketRound(st, st.ncaa, NCAA_LABEL); }
    else {
      diaSelection(st);
      if (st.ps === 'regional') playRegional(st);
      if (st.ps === 'super') playSuper(st);
      if (st.ps === 'cws') playCWS(st);
      if (st.ps === 'finals') playFinals(st);
    }
    return summary(st);
  }

  /* =====================================================================================
     DRAFT SPINS
     ===================================================================================== */
  const winEnd = (sport, w) => w >= 2020 ? 2026 : w + 4;    // the last window runs to today
  const winLabel = (sport, w) => HOOPS[sport] ? w + '-' + String(Math.min(winEnd(sport, w), 2025) + 1).slice(2) : w + '-' + String(winEnd(sport, w)).slice(2);
  const openSlots = st => st.slots.filter(s => !s.p);
  const currentSide = st => { const o = openSlots(st); return o.length ? o[0].side : null; };
  const canFill = (st, row) => openSlots(st).some(s => s.side === currentSide(st) && s.fits(row));
  function newState(sport, opts) {
    const side = opts.side || 'both';
    return Object.assign({ sport, phase: 'draft', side, spin: 0, rerolls: REROLLS, offer: null, seen: [],
      slots: slotDefs(sport, side).map(([code, label, sd]) => ({ code, label, side: sd, p: null })) }, opts);
  }
  // slot fit functions are not saved with the state (it goes to localStorage), so put them back
  function hydrate(st) {
    const defs = SLOTS[st.sport]; let i = 0;
    st.slots.forEach(s => { const d = defs.find((x, j) => x[0] === s.code && x[2] === s.side && j >= i) || defs.find(x => x[0] === s.code); s.fits = d ? d[3] : () => true; });
    const D = data(st.sport); st.slots.forEach(s => { if (s.p && !s.p.st) s.p = D.by[s.p.id] || s.p; });
    return st;
  }
  function runSpin(st) {
    const D = data(st.sport), used = REROLLS - st.rerolls, r = rngFrom(st.seed + '|spin' + st.spin + '|' + used);
    const side = currentSide(st), open = openSlots(st).filter(s => s.side === side);
    const taken = new Set(st.slots.filter(s => s.p).map(s => s.p.n)), seen = new Set(st.seen || []);
    const sidePool = D.rows.filter(row => !taken.has(row.n) && (CONF[st.sport].hoops || (side === 'O' ? isHitter(row) : row.k === 'P')));
    const inWin = (row, w) => row.y >= w && row.y <= winEnd(st.sport, w);
    const winsOf = decs => decs.reduce((a, e) => a.concat(e >= 2020 ? [2020] : [e, e + 5]), []);
    const fitsOpen = row => open.some(s => s.fits(row));
    const ok = w => sidePool.some(row => inWin(row, w) && fitsOpen(row));
    let wins = winsOf(st.eras).filter(ok), wide = false;
    if (!wins.length) { wins = winsOf(D.decs).filter(ok); wide = true; }
    if (!wins.length) { st.offer = { era: null, ids: [] }; return; }
    const era = wpick(r, wins, w => ERA_BOOST(w) * Math.sqrt(sidePool.filter(row => inWin(row, w)).length));
    const inEra = sidePool.filter(row => inWin(row, era));
    // one season per player per spin
    const best = {}; inEra.forEach(row => { if (!best[row.n] || best[row.n].ovr < row.ovr) best[row.n] = row; });
    const uniq = Object.values(best);
    const w = row => (seen.has(row.id) ? 0.15 : 1) * (0.55 + (row.ovr - 58) / 40);
    const can = uniq.filter(fitsOpen);
    const first = wsample(r, can, Math.min(2, can.length), w);
    const rest = wsample(r, uniq.filter(x => !first.includes(x)), CARDS - first.length, w);
    st.offer = { era, ids: shuffle(r, first.concat(rest)).map(x => x.id), wide, side };
    st.seen = Array.from(new Set((st.seen || []).concat(st.offer.ids)));
  }
  // put a pick in the most specific open slot that fits (sixth man / DH last)
  function place(st, row) {
    const side = currentSide(st);
    const open = st.slots.filter(s => !s.p && s.side === side && s.fits(row));
    const flex = s => ['6', 'DH', 'DP'].includes(s.code) ? 2 : s.code === 'B' ? 1 : 0;
    open.sort((a, b) => flex(a) - flex(b));
    return open[0] || null;
  }

  /* =====================================================================================
     PLAY-BY-PLAY
     ===================================================================================== */
  function hoopPlays(st, g, o, seedKey) {
    const r = rngFrom(seedKey + '|pbp'), res = g.res, c = CONF[st.sport];
    const roster = st.slots.filter(s => s.p).map(s => ({ n: lastName(s.p.n), ppg: s.p.st.ppg || ((s.p.st.pts || 0) / (s.p.st.gp || 1)) || 4, tp: (s.p.st.tpm || 0) / (s.p.st.gp || 1), big: s.code === 'B' }));
    const who = three => roster.length ? wpick(r, roster, x => three ? 0.2 + x.tp * 3 : Math.pow(x.ppg + 1, 1.3)) : null;
    const GAME = c.periods * c.plen, OTL = 300;
    const ev = [];
    const split = pts => { const out = []; let left = pts; while (left > 0) { const x = r(); let v = x < 0.24 ? 3 : x < 0.83 ? 2 : (r() < 0.6 ? 2 : 1); if (v > left) v = left; out.push(v); left -= v; } return out; };
    const addSide = (pts, us, from, to) => split(pts).forEach(v => {
      const t = from + Math.floor(r() * (to - from)), p = us ? who(v === 3) : null;
      let text;
      if (us && p) text = v === 3 ? `${p.n} 3-pointer` : v === 1 ? `${p.n} free throw` : r() < 0.18 ? `${p.n} ${pick(r, ['and-one... and misses the free throw', 'free throws, 2 for 2'])}` : `${p.n} ${p.big ? pick(r, ['layup', 'dunk', 'hook shot', 'putback', 'jumper']) : pick(r, ['jumper', 'pull-up jumper', 'layup', 'driving layup', 'floater'])}`;
      else if (us) text = v === 3 ? 'Tennessee 3-pointer' : v === 1 ? 'Tennessee free throw' : 'Tennessee bucket';
      else text = `${o.t} ${v === 3 ? '3-pointer' : v === 1 ? 'free throw' : pick(r, ['jumper', 'layup', 'basket', 'free throws'])}`;
      ev.push({ t, us, v, text });
    });
    const regUs = res.reg ? res.reg.us : res.us, regTh = res.reg ? res.reg.th : res.them;
    addSide(regUs, true, 5, GAME - 1); addSide(regTh, false, 5, GAME - 1);
    let usLeft = res.us - regUs, thLeft = res.them - regTh;
    for (let k = 0; k < res.ot; k++) {
      const share = k === res.ot - 1 ? 1 : 1 / (res.ot - k);
      const a = k === res.ot - 1 ? usLeft : Math.round(usLeft * share), b = k === res.ot - 1 ? thLeft : Math.round(thLeft * share);
      addSide(a, true, GAME + k * OTL + 3, GAME + (k + 1) * OTL - 1); addSide(b, false, GAME + k * OTL + 3, GAME + (k + 1) * OTL - 1);
      usLeft -= a; thLeft -= b;
    }
    ev.sort((a, b) => a.t - b.t);
    let A = 0, B = 0; ev.forEach(e => { if (e.us) A += e.v; else B += e.v; e.a = A; e.b = B; });
    // keep the feed readable: every 3, every lead change and the last minutes; plain twos are folded into the score
    let lead = 0;
    ev.forEach((e, i) => { const nl = Math.sign(e.a - e.b); e.show = e.v === 3 || (nl !== lead && nl !== 0) || e.t > GAME - 120 || e.t >= GAME || i === ev.length - 1 || r() < 0.18; if (nl !== 0) { if (nl !== lead && lead !== 0) e.text += ' (lead change)'; lead = nl; } });
    return ev;
  }
  const hoopPeriodOf = (st, t) => { const c = CONF[st.sport], G = c.periods * c.plen; return t >= G ? c.periods + 1 + Math.floor((t - G) / 300) : Math.floor(t / c.plen) + 1; };
  const hoopClock = (st, t) => { const c = CONF[st.sport], G = c.periods * c.plen; const left = t >= G ? 300 - ((t - G) % 300) : c.plen - (t % c.plen); return Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'); };
  const hoopPLabel = (st, p) => { const c = CONF[st.sport]; return p > c.periods ? (p - c.periods > 1 ? (p - c.periods) + 'OT' : 'OT') : c.periods === 2 ? (p === 1 ? '1st' : '2nd') : 'Q' + p; };
  function diaPlays(st, g, o, seedKey) {
    const r = rngFrom(seedKey + '|pbp'), res = g.res, c = CONF[st.sport];
    const hitters = st.slots.filter(s => s.p && s.side === 'O').map(s => ({ n: lastName(s.p.n), hr: s.p.st.hr || 0, rbi: s.p.st.rbi || 0, avg: s.p.st.avg || 0.25 }));
    const who = homer => hitters.length ? wpick(r, hitters, x => homer ? 0.5 + x.hr : 2 + x.rbi / 6) : null;
    const ord = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
    const ev = [];
    const halves = Math.max(res.U.length, res.Th.length);
    let A = 0, B = 0;
    for (let i = 0; i < halves; i++) {
      for (const top of [true, false]) {
        const usBat = top ? !res.usHome : res.usHome;
        const runs = usBat ? res.U[i] : res.Th[i];
        if (runs == null) continue;
        const half = { inn: i + 1, top, us: usBat, v: runs };
        if (runs > 0) {
          if (usBat) {
            const hr = r() < (runs >= 2 ? 0.38 : 0.22), p = who(hr);
            const nm = p ? p.n : 'Tennessee';
            half.text = hr ? (runs === 1 ? `${nm} solo homer` : runs === 4 ? `GRAND SLAM! ${nm}` : runs <= 3 ? `${nm} ${runs}-run homer` : `${nm} ${pick(r, ['3-run homer', '2-run double'])} caps a ${runs}-run inning`)
              : runs === 1 ? `RBI ${pick(r, ['single', 'double', 'sac fly', 'groundout'])} by ${nm}` : `${runs}-run ${pick(r, ['inning', 'rally'])}: ${nm} ${pick(r, ['2-run double', 'RBI single', 'bases-clearing double', 'RBI triple'])}`;
          } else half.text = `${o.t} ${runs === 1 ? pick(r, ['scores on a single', 'solo homer', 'scores on a sac fly', 'RBI double']) : runs + '-run ' + pick(r, ['inning', 'homer', 'rally'])}`;
        } else if (!usBat && r() < 0.12) {
          const sp = res.sp ? lastName(res.sp) : null;
          if (sp) half.text = `${sp} ${pick(r, ['strikes out the side', 'works a 1-2-3 inning', 'gets a double play to end the inning'])}`;
        }
        if (usBat) A += runs; else B += runs;
        half.a = A; half.b = B; half.label = (top ? 'Top ' : 'Bot ') + ord(i + 1);
        ev.push(half);
      }
    }
    if (res.mercy) ev.push({ inn: halves, top: false, us: null, v: 0, a: A, b: B, label: 'Final', text: `Run rule after ${halves} innings` });
    return ev;
  }

  /* =====================================================================================
     LIVE BOX (line score + feed, game clock / inning by inning)
     ===================================================================================== */
  const SPEEDS = [['slow', 'Slower', 1.8], ['normal', 'Normal', 1], ['fast', 'Faster', 0.45]];
  const speedMul = () => (SPEEDS.find(x => x[0] === store.get('sim-speed', 'normal')) || SPEEDS[1])[2];
  const abbr = t => t.length > 10 ? t.replace(/[^A-Z&]/g, '').slice(0, 5) || t.slice(0, 4).toUpperCase() : t.toUpperCase();
  function lineTable(st, o, g, ev, upto, done) {
    const c = CONF[st.sport], res = g.res;
    let cols, us, th, cur = 0;
    if (c.hoops) {
      const np = c.periods + (res.ot || 0); cols = Array.from({ length: np }, (_, i) => i < c.periods ? String(i + 1) : (i - c.periods ? (i - c.periods + 1) + 'OT' : 'OT'));
      us = Array(np).fill(0); th = Array(np).fill(0);
      ev.forEach(e => { if (done || e.t <= upto) { const p = hoopPeriodOf(st, e.t) - 1; if (e.us) us[p] += e.v; else th[p] += e.v; } });
      cur = done ? 99 : hoopPeriodOf(st, Math.max(0, upto));
      const shown = i => done || i + 1 <= cur;
      us = us.map((v, i) => shown(i) ? v : ''); th = th.map((v, i) => shown(i) ? v : '');
    } else {
      const n = Math.max(c.inn, res.inn); cols = Array.from({ length: n }, (_, i) => String(i + 1));
      us = Array(n).fill(''); th = Array(n).fill('');
      ev.forEach((e, k) => { if (e.us == null || (!done && k > upto)) return; if (e.us) us[e.inn - 1] = e.v; else th[e.inn - 1] = e.v; });
      if (done) { res.U.forEach((v, i) => { if (v === null) us[i] = 'x'; }); res.Th.forEach((v, i) => { if (v === null) th[i] = 'x'; }); }
      cur = done ? 99 : (ev[upto] ? ev[upto].inn : 1);
    }
    const tot = a => a.reduce((x, y) => x + (typeof y === 'number' ? y : 0), 0);
    const cls = i => !done && i + 1 === cur ? 'cur' : '';
    const visitorsFirst = !c.hoops && res.usHome;   // baseball box scores list the visitors on top
    const rowUs = `<tr class="ut"><th>TENN</th>${us.map((v, i) => `<td class="${cls(i)}">${v}</td>`).join('')}<td class="t">${tot(us)}</td></tr>`;
    const rowTh = `<tr><th>${esc(abbr(o.t))}</th>${th.map((v, i) => `<td class="${cls(i)}">${v}</td>`).join('')}<td class="t">${tot(th)}</td></tr>`;
    return `<table class="glines ${c.hoops ? '' : 'inn'}" id="sLines"><thead><tr><th></th>${cols.map((h, i) => `<th class="${cls(i)}">${h}</th>`).join('')}<th>${c.hoops ? 'T' : 'R'}</th></tr></thead>
      <tbody>${visitorsFirst ? rowTh + rowUs : rowUs + rowTh}</tbody></table>`;
  }
  const feedLi = (st, e) => CONF[st.sport].hoops
    ? `<li class="${e.us ? 'us' : 'them'}"><span class="gf-t">${hoopPLabel(st, hoopPeriodOf(st, e.t))} ${hoopClock(st, e.t)}</span><span class="gf-x">${esc(e.text)}</span><span class="gf-s">${e.a}-${e.b}</span></li>`
    : `<li class="${e.us === null ? '' : e.us ? 'us' : 'them'}"><span class="gf-t">${esc(e.label)}</span><span class="gf-x">${esc(e.text)}</span><span class="gf-s">${e.a}-${e.b}</span></li>`;
  const finalTxt = (st, res) => CONF[st.sport].hoops ? (res.ot ? 'FINAL/' + (res.ot > 1 ? res.ot : '') + 'OT' : 'FINAL') : res.mercy ? `FINAL/${res.inn}` : res.inn > CONF[st.sport].inn ? `FINAL/${res.inn}` : 'FINAL';
  function whereTxt(st, g) {
    if (g.site === 0) return 'neutral site';
    const home = CONF[st.sport].hoops ? (st.sport === 'wbb' ? 'Thompson-Boling Arena' : 'Food City Center') : st.sport === 'baseball' ? 'Lindsey Nelson Stadium' : 'Sherri Parker Lee Stadium';
    return g.site > 0 ? home : 'road game';
  }
  function liveBox(st, g, o, ev, done, label, extra) {
    const res = g.res, sp = store.get('sim-speed', 'normal'), c = CONF[st.sport];
    const showEv = c.hoops ? ev.filter(e => e.show) : ev.filter(e => e.text);
    return `<div class="box glive ${done ? (res.w ? 'w' : 'l') : 'running'}" id="glive">
      <div class="glive-head"><span class="eyebrow">${esc(label)} · ${esc(whereTxt(st, g))}${!c.hoops && res.sp ? ' · SP ' + esc(lastName(res.sp)) : ''}</span>
        ${done ? '' : `<span class="gspeed" role="group" aria-label="Sim speed">${SPEEDS.map(([k, l]) => `<button data-speed="${k}" aria-pressed="${sp === k}">${l}</button>`).join('')}<button class="glink" id="gSkip">Skip</button></span>`}</div>
      <div class="gscore"><div class="gsc-t ut"><span>Tennessee</span><b id="sUs">${done ? res.us : 0}</b></div>
        <div class="gsc-mid"><span id="sClock">${done ? finalTxt(st, res) : c.hoops ? hoopPLabel(st, 1) + ' ' + hoopClock(st, 0) : 'Top 1st'}</span></div>
        <div class="gsc-t opp"><span>${esc(oName(o))}${o.rk ? ` <i class="dim">${oTag(o)}</i>` : ''}</span><b id="sThem">${done ? res.them : 0}</b></div></div>
      <div id="sLineWrap">${lineTable(st, o, g, ev, done ? 1e9 : -1, done)}</div>
      <ol class="gfeed" id="sFeed">${done ? showEv.map(e => feedLi(st, e)).join('') : ''}</ol>${extra || ''}</div>`;
  }
  let ANIM = 0;
  function animateLive(st, g, o, ev, onDone) {
    const token = ++ANIM, box = document.getElementById('glive'); if (!box) return onDone();
    const c = CONF[st.sport], res = g.res;
    const elUs = box.querySelector('#sUs'), elThem = box.querySelector('#sThem'), elClock = box.querySelector('#sClock'), feed = box.querySelector('#sFeed'), lw = box.querySelector('#sLineWrap');
    let finished = false;
    const end = () => {
      if (finished) return; finished = true;
      feed.innerHTML = (c.hoops ? ev.filter(e => e.show) : ev.filter(e => e.text)).map(e => feedLi(st, e)).join('');
      elUs.textContent = res.us; elThem.textContent = res.them; elClock.textContent = finalTxt(st, res);
      lw.innerHTML = lineTable(st, o, g, ev, 1e9, true);
      box.classList.remove('running'); box.classList.add(res.w ? 'w' : 'l');
      const sp = box.querySelector('.gspeed'); if (sp) sp.remove();
      setTimeout(onDone, reduceMotion() ? 0 : 800);
    };
    box.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { store.set('sim-speed', b.dataset.speed); box.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
    const skip = box.querySelector('#gSkip'); if (skip) skip.addEventListener('click', () => { ANIM++; end(); });
    if (reduceMotion()) return end();
    const flash = el => { const t = el.parentElement; t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 600); };
    if (c.hoops) {
      const G = c.periods * c.plen + (res.ot || 0) * 300, BASE = 12000;   // a game takes about 12 s at normal speed
      let t = 0, last = performance.now(), shown = 0, curP = 1;
      const step = now => {
        if (token !== ANIM || finished) return;
        const dt = Math.min(100, now - last); last = now;
        t += dt * (c.periods * c.plen) / (BASE * speedMul());
        const p = hoopPeriodOf(st, Math.min(t, G - 1)); elClock.textContent = `${hoopPLabel(st, p)} ${hoopClock(st, Math.min(t, G - 1))}`;
        let changed = p !== curP; curP = p;
        while (shown < ev.length && ev[shown].t <= t) {
          const e = ev[shown++]; if (e.show) { feed.insertAdjacentHTML('beforeend', feedLi(st, e)); feed.lastElementChild.classList.add('pop'); feed.scrollTop = feed.scrollHeight; }
          elUs.textContent = e.a; elThem.textContent = e.b; flash(e.us ? elUs : elThem); changed = true;
        }
        if (changed) lw.innerHTML = lineTable(st, o, g, ev, t, false);
        if (t >= G) return end();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else {
      let k = 0;
      const per = () => 8500 / Math.max(12, ev.length) * speedMul();   // about 8.5 s a game at normal speed
      const tick = () => {
        if (token !== ANIM || finished) return;
        if (k >= ev.length) return end();
        const e = ev[k];
        elClock.textContent = e.label;
        if (e.text) { feed.insertAdjacentHTML('beforeend', feedLi(st, e)); feed.lastElementChild.classList.add('pop'); feed.scrollTop = feed.scrollHeight; }
        if (e.v) { elUs.textContent = e.a; elThem.textContent = e.b; flash(e.us ? elUs : elThem); }
        lw.innerHTML = lineTable(st, o, g, ev, k, false);
        k++; setTimeout(tick, per());
      };
      setTimeout(tick, 200);
    }
  }
  const playsFor = (st, g, o, key) => CONF[st.sport].hoops ? hoopPlays(st, g, o, st.seed + '|' + key) : diaPlays(st, g, o, st.seed + '|' + key);

  /* =====================================================================================
     UI
     ===================================================================================== */
  const RUN = {};   // per sport: { mode, side, st }
  const R = sport => RUN[sport] || (RUN[sport] = { mode: 'daily', side: store.get(sport + '-run-side', 'both'), st: null });
  let SPORT = null;
  function render(app, sport) {
    SPORT = sport;
    if (!window.VI_RUN_OPPS) {
      app.innerHTML = '<div class="wrap hub-hero"><div class="eyebrow">Games</div><h1>Loading…</h1></div>';
      let s = document.querySelector('script[data-g="data/run-opps.js"]');
      if (!s) { s = document.createElement('script'); s.src = 'data/run-opps.js'; s.dataset.g = 'data/run-opps.js'; document.head.appendChild(s); }
      s.addEventListener('load', () => render(app, sport), { once: true });
      return;
    }
    data(sport);
    const c = CONF[sport], X = R(sport), today = etDate(), daily = store.get(dkey(sport, 'run'), null);
    const sub = c.hoops ? `Spin an era and draft a starting five plus a ${c.sixth.toLowerCase()}, each at their best season. Then try to run the table: 31 games against real Tennessee opponents, the SEC Tournament and the NCAA Tournament. Perfect is 40-0.`
      : `Spin an era and draft a lineup, then a pitching staff, each at their best season. Then try to run the table: 56 games against real Tennessee opponents, the SEC Tournament, regionals, supers and the ${c.cws}. Perfect means winning every game from opening day to the final out in ${c.omaha}.`;
    const body = frame(app, sport, 'run', sub);
    if (X.mode === 'daily' && daily && daily.final && (!X.st || !X.st.daily || X.st.date !== today || X.st.phase !== 'done')) { X.st = hydrate(daily.final); X.st.phase = 'done'; }
    const ch = V.challenge();
    if (ch && X.chUsed !== ch.raw) {
      X.chUsed = ch.raw; X.mode = 'free';
      let side = 'both'; try { side = { o: 'off', d: 'def' }[new URLSearchParams(location.search).get('s')] || 'both'; } catch (e) {}
      if (c.hoops) side = 'both';
      X.st = newState(sport, { daily: false, date: today, seed: ch.seed, side, eras: ch.eras && ch.eras.length ? ch.eras : data(sport).decs.slice(), fromChallenge: true });
      hydrate(X.st); runSpin(X.st);
    }
    const st = X.st;
    if (!st || (st.daily && st.date !== today)) { X.st = null; return setup(body, daily); }
    if (!st.slots[0].fits) hydrate(st);
    if (st.phase === 'draft') return draftView(body);
    if (st.phase === 'season') return seasonView(body);
    if (st.phase === 'post') return postView(body);
    return resultsView(body);
  }
  const rer = () => rerender();
  function ovrHelp(sport) {
    const c = CONF[sport], lg = LG[sport];
    return `<details class="gnote"><summary><b>How OVR works</b></summary>
      <p>Same build as football's 16-0. OVR = 62 + <b>production</b> (0-24) + <b>awards</b> (0-11)${lg ? ` + <b>${lg} draft</b> (0-8)` : ''}. Above 95 the climb gets steeper (each point counts 40%), the ceiling is 98, and 99 is reserved for ${sport === 'wbb' ? 'Chamique Holdsclaw and Candace Parker' : sport === 'softball' ? 'Monica Abbott and Karlyn Pickens' : sport === 'mbb' ? 'Dalton Knecht' : sport === 'baseball' ? 'Christian Moore' : 'nobody yet'}.</p>
      <ul><li><b>Production:</b> where that season ranks among every Tennessee ${c.hoops ? (c.lady ? "women's" : "men's") + ' basketball' : sport} season in our data (${c.hoops ? 'points, rebounds, assists, steals and blocks per game' : 'average, homers, RBI, runs and steals for hitters; innings, strikeouts, wins and saves minus ERA for pitchers'}).</li>
      <li><b>Awards:</b> first-team All-American 7, second/third team 4, honorable mention 2; first-team All-SEC 3, second team 1.5; SEC ${c.hoops ? 'Player' : 'Player or Pitcher'} of the Year 3.5; national player of the year or national award 4, finalist 1.5.</li>
      ${lg ? `<li><b>${lg} draft:</b> ${sport === 'baseball' ? 'top-5 pick 8, top-15 pick 7, rest of the first round 6, 2nd round 5, 3rd 4, 4th-5th 3, 6th-10th 2, 11th-20th 1' : sport === 'mbb' ? 'top-5 pick 8, lottery pick (6-14) 7, rest of the first round 6, second round 4' : 'top-5 pick 8, first round 6, second round 4, third 2, fourth 1'}. Seasons before the last one at Tennessee get half.</li>` : ''}
      <li><b>Floors:</b> first-team All-American 88, second/third team 84, first-team All-SEC or SEC ${c.hoops ? 'Player' : 'Player/Pitcher'} of the Year 83${lg ? ', top-5 pick 87, first-round pick 85, second round 82, third round 79' : ''}.</li>
      <li><b>Opponents:</b> real team-seasons Tennessee played since 2000. A team ranked No. 1 when Tennessee played them rates about 93, No. 25 about 82, an unranked power-conference team 77, a mid-major 66-72, plus a bump for teams that beat Tennessee.</li></ul></details>`;
  }
  function setup(body, daily) {
    const sport = SPORT, c = CONF[sport], X = R(sport), isDaily = X.mode === 'daily', D = data(sport);
    const eras = getEras(sport).filter(e => D.decs.includes(e)).length ? getEras(sport).filter(e => D.decs.includes(e)) : D.decs.slice();
    body.innerHTML = `${modeBar(X.mode, !!(daily && daily.final))}
      <div class="box gsetup"><h3>Set up your run</h3>
        ${isDaily ? `<p class="dim">Today's challenge: everyone gets the same spins and the same schedule. ${c.hoops ? 'Every era.' : 'Lineup and pitching, every era.'} One try per day.</p>` : `
        ${c.hoops ? '' : `<div class="gfield"><div class="glabel">Roster</div><div class="gseg" data-k="side">
          ${[['both', 'Lineup + pitching'], ['off', 'Lineup only'], ['def', 'Pitching only']].map(([v, l]) => `<button data-v="${v}" aria-pressed="${X.side === v}">${l}</button>`).join('')}</div></div>`}
        <div class="gfield"><div class="glabel">Eras</div><div class="gchips">
          ${D.decs.map(e => `<button data-era="${e}" aria-pressed="${eras.includes(e)}">${e}s</button>`).join('')}
          ${eras.length < D.decs.length ? '<button class="glink" id="eraAll">All eras</button>' : ''}</div>
          <p class="dim small">Spins land on five-season windows inside the decades you pick. If your eras run out of players at an open spot, that spin pulls from any era.</p></div>`}
        <div class="gnote"><b>Prime seasons only.</b> Every card is one player's best season in that window. Tap or hover a rating to see what it means.</div>
        ${ovrHelp(sport)}
        <div class="grow"><button class="btn primary big" id="runStart">Start ${isDaily ? "today's run" : 'free play'}</button></div>
      </div>${howTo(sport)}`;
    bindMode(body, m => { X.mode = m; X.st = null; rer(); });
    body.querySelectorAll('[data-k="side"] button').forEach(b => b.addEventListener('click', () => { X.side = b.dataset.v; store.set(sport + '-run-side', X.side); rer(); }));
    body.querySelectorAll('[data-era]').forEach(b => b.addEventListener('click', () => { const e = +b.dataset.era; const n = eras.includes(e) ? eras.filter(x => x !== e) : eras.concat(e).sort(); if (n.length) setEras(sport, n); rer(); }));
    const ea = body.querySelector('#eraAll'); if (ea) ea.addEventListener('click', () => { setEras(sport, D.decs.slice()); rer(); });
    body.querySelector('#runStart').addEventListener('click', () => {
      const d = X.mode === 'daily', side = d || c.hoops ? 'both' : X.side;
      X.st = newState(sport, { daily: d, date: etDate(), seed: d ? 'run-' + sport + '-' + etDate() : freeSeed(), side, eras: d ? D.decs.slice() : eras.slice() });
      hydrate(X.st); runSpin(X.st); rer();
    });
  }
  function howTo(sport) {
    const c = CONF[sport];
    return `<details class="box ghow"><summary>How it works</summary><ol>
      ${c.hoops ? `<li><b>Spin.</b> Each spin lands on a five-season window (1990-95, 1995-2000 ... 2020-26) and deals six players from it. Fill two guards, two forwards, a big (forward or center) and a ${c.sixth.toLowerCase()} (anyone). Players only go where their listed position allows. Spots you've filled are greyed out. Three re-spins per run.</li>
      <li><b>Play.</b> ${c.nonconf} non-conference games and ${c.secG} SEC games (every SEC team at least once, a few twice), all real teams Tennessee played since 2000, each at the strength they had that season. Sim one game at a time or the whole season.</li>
      <li><b>SEC Tournament.</b> Seeded by your SEC record against how the rest of the league finished. Top four seeds get a double bye, so the champion plays three games.</li>
      <li><b>NCAA Tournament.</b> The committee seeds you from your record. Win six games in your region and at the Final Four. 31 + 3 + 6 = 40-0.</li>`
      : `<li><b>Spin.</b> Each spin lands on a five-season window and deals six players. Lineup first (catcher, first, second, short, third, three outfielders and a ${sport === 'baseball' ? 'DH' : 'DP'}; players listed only as infielders can play any base, and players with no listed position can only ${sport === 'baseball' ? 'DH' : 'DP'}), then the pitching staff (${sport === 'baseball' ? 'three weekend starters and a closer' : 'an ace and a No. 2'}). Three re-spins per run.</li>
      <li><b>Play.</b> 56 games: ${c.secSeries} SEC weekend series plus ${sport === 'softball' ? 'tournament weekends' : 'non-conference weekends'} and midweek games, all real teams Tennessee played since 2000. Play a weekend at a time or sim the season.</li>
      <li><b>Postseason.</b> The single-elimination SEC Tournament (top four seeds get a double bye: three games), then the NCAA: a four-team double-elimination regional (three wins), a best-of-three super regional (two), the ${c.cws} in ${c.omaha} (three wins in a double-elimination bracket) and the best-of-three finals (two). 56 + 3 + 3 + 2 + 3 + 2 = 69 games without a loss: a perfect season.</li>`}
    </ol></details>`;
  }
  function board(st, compact) {
    const c = CONF[st.sport], me = teamRatings(st);
    const cell = s => `<div class="gslot ${s.p ? 'full' : ''}"><span class="gslot-pos">${esc(s.code === '6' ? '6th' : s.code)}</span>${s.p ? `<b>${esc(s.p.n)}</b><span class="dim">${esc(s.p.s)} · ${s.p.ovr}</span>` : `<span class="dim">${esc(s.label)}</span>`}</div>`;
    if (c.hoops) return `<div class="gboard ${compact ? 'compact' : ''}"><div class="gboard-side on"><div class="glabel">Your rotation${st.slots.every(s => s.p) ? ` <span class="grate">${Math.round(me.team)}</span>` : ''}</div><div class="gslots">${st.slots.map(cell).join('')}</div></div></div>`;
    const off = st.slots.filter(s => s.side === 'O'), def = st.slots.filter(s => s.side === 'D'), side = currentSide(st);
    const grp = (lab, arr, key, val) => arr.length ? `<div class="gboard-side ${side === key ? 'on' : ''}"><div class="glabel">${lab}${arr.every(s => s.p) ? ` <span class="grate">${Math.round(val)}</span>` : ''}</div><div class="gslots">${arr.map(cell).join('')}</div></div>` : '';
    return `<div class="gboard ${compact ? 'compact' : ''}">${grp('Lineup', off, 'O', me.off)}${grp('Pitching', def, 'D', me.pit)}</div>`;
  }
  const HONS = { AA1: 'All-American', AA2: 'All-America 2nd/3rd', AAH: 'All-America HM', SEC: 'All-SEC', SEC2: 'All-SEC 2nd', POY: 'SEC POY', PPOY: 'SEC Pitcher of the Year' };
  const honChip = h => `<span class="chip honor">${esc(h.startsWith('W:') ? h.slice(2) : h.startsWith('F:') ? h.slice(2) + ' finalist' : HONS[h] || h)}</span>`;
  const LG = { mbb: 'NBA', wbb: 'WNBA', baseball: 'MLB', softball: '' };
  function ovrWhy(st, row) {
    if (!row.rb) return 'OVR ' + row.ovr;
    const [prod, aw, dr, fl] = row.rb, raw = Math.round((62 + prod + aw + dr) * 10) / 10;
    let t = `OVR ${row.ovr}: 62 base + ${prod} production + ${aw} awards + ${dr} ${LG[st.sport] || 'pro'} draft = ${raw}`;
    if (row.ovr === 99) return t + '. 99 is reserved for the all-time greats.';
    if (raw > 95) t += `; points above 95 count 40%`;
    if (fl) t += ` (raised to the ${fl} floor for honors or draft slot)`;
    return t;
  }
  function card(st, row, can, i) {
    const D = data(st.sport), p = D.pl[row.n], pro = p && p.pro;
    const draft = pro ? `<span class="chip draft">${esc(pro.lg)} Rd ${pro.rd}${pro.pick ? ' #' + pro.pick : ''} (${pro.y})</span>` : p && p.draft ? `<span class="chip draft">MLB Rd ${esc(String(p.draft).split(' rd ')[1] || '')} (${esc(String(p.draft).split(' ')[0])})</span>` : '';
    return `<button class="gpcard deal ${can ? '' : 'off'}" data-id="${esc(row.id)}" style="--d:${i * 70}ms" ${can ? '' : 'disabled aria-disabled="true"'}>
      <span class="gpc-top"><span class="gpos">${esc(row.pos || (row.k === 'P' ? 'P' : 'UT'))}</span>${can ? '' : '<span class="gpc-filled">Filled</span>'}<span class="govr" title="${esc(ovrWhy(st, row))}">${row.ovr}</span></span>
      <b class="gpc-name">${esc(row.n)}</b><span class="gpc-yr">${esc(row.s)} · ${esc(row.coach || '')}</span>
      <span class="gpc-line">${esc(row.line || '')}</span><span class="gpc-hon">${(row.hon || []).slice(0, 2).map(honChip).join('')}${draft}</span>
    </button>`;
  }
  function draftView(body) {
    const st = R(SPORT).st, c = CONF[st.sport], D = data(st.sport), side = currentSide(st), offer = st.offer || { ids: [] };
    const rows = offer.ids.map(id => D.by[id]).filter(Boolean);
    const sideSlots = st.slots.filter(s => s.side === side), pickN = sideSlots.filter(s => s.p).length + 1;
    const openNames = Array.from(new Set(st.slots.filter(s => !s.p && s.side === side).map(s => s.label)));
    body.innerHTML = `${st.daily ? '<div class="gtag">Daily challenge · ' + esc(st.date) + '</div>' : st.fromChallenge ? '<div class="gchal">🤝 A friend\'s challenge: you start from the exact spins and schedule they got.</div>' : ''}
      ${board(st, false)}
      ${st.banner ? `<div class="gbanner">${esc(st.banner)}</div>` : ''}
      <div class="box gspin"><div class="gspin-head"><div><div class="eyebrow">${c.hoops ? 'Rotation' : side === 'O' ? 'Lineup' : 'Pitching'} · pick ${pickN} of ${sideSlots.length}</div><h3 id="spinEra">${offer.era ? winLabel(st.sport, offer.era) + ' ' + c.who : 'Nobody left'}</h3></div>
        <button class="btn" id="reroll" ${st.rerolls ? '' : 'disabled'}>Re-spin (${st.rerolls} left)</button></div>
        <p class="dim">${offer.wide ? 'Nobody left at your open spots in your eras, so this spin pulls from every era. ' : ''}Take one. Open: ${esc(openNames.join(', '))}.</p>
        <div class="gcards-row" id="spinCards">${rows.map((row, i) => card(st, row, canFill(st, row), i)).join('') || '<p>Nobody fits your open spots. Use a re-spin or start over.</p>'}</div></div>
      <div class="grow"><button class="glink" id="runQuit">Start over</button></div>`;
    const era = body.querySelector('#spinEra');
    if (era && offer.era && !st.animated) { st.animated = true; spinAnim(st, era, body.querySelector('#spinCards')); }
    body.querySelectorAll('.gpcard:not(.off)').forEach(b => b.addEventListener('click', () => {
      const row = D.by[b.dataset.id], slot = place(st, row); if (!slot) return;
      const was = currentSide(st);
      slot.p = row; st.spin++; st.animated = false; st.banner = null;
      if (st.slots.every(s => s.p)) buildSeason(st);
      else { if (currentSide(st) !== was) st.banner = `Lineup set: ${Math.round(teamRatings(st).off)} OVR. Now the pitching staff.`; runSpin(st); }
      rer();
    }));
    body.querySelector('#reroll').addEventListener('click', () => { if (!st.rerolls) return; st.rerolls--; st.animated = false; runSpin(st); rer(); });
    twoTap(body.querySelector('#runQuit'), st.daily ? 'Tap again (daily spins stay the same)' : 'Tap again to start over', () => { R(SPORT).st = null; rer(); });
  }
  function spinAnim(st, el, cardsEl) {
    if (reduceMotion()) return;
    const final = el.textContent, c = CONF[st.sport], D = data(st.sport);
    const seq = D.decs.reduce((a, e) => a.concat([e, e + 5]), []).filter(w => w <= 2020); let i = 0; el.classList.add('spinning'); if (cardsEl) cardsEl.classList.add('hold');
    const tick = () => { el.textContent = winLabel(st.sport, seq[i % seq.length]) + ' ' + c.who; i++; if (i < 13) setTimeout(tick, 40 + i * 9); else { el.textContent = final; el.classList.remove('spinning'); el.classList.add('landed'); if (cardsEl) cardsEl.classList.remove('hold'); } };
    tick();
  }

  // ---- season ----
  const resTxt = (st, res) => `${res.w ? 'W' : 'L'} ${res.us}-${res.them}${CONF[st.sport].hoops ? (res.ot ? (res.ot > 1 ? ' ' + res.ot + 'OT' : ' OT') : '') : (res.inn !== CONF[st.sport].inn ? ' (' + res.inn + ')' : '')}`;
  function blockRow(st, b, show, pending) {
    const c = CONF[st.sport], g0 = b.games[0], o = OPP(st, g0.o), where = g0.site > 0 ? 'vs.' : g0.site < 0 ? 'at' : 'vs.';
    if (pending) show = false;
    const rc = show ? record(st, b.games) : null;
    const multi = b.games.length > 1;
    const lab = c.hoops ? 'G' + g0.n : b.kind === 's' ? (b.conf ? 'SEC' : 'Series') : b.kind === 't' ? 'Tourn.' : 'Mid';
    const opp = b.kind === 't' ? `<b>${esc(b.label)}</b> <span class="gstars">${esc(b.games.map(g => OPP(st, g.o).t).join(', '))}</span>`
      : `<b>${where} ${esc(oName(o))}</b> <span class="dim">${o.rk ? oTag(o) : ''}${b.conf ? (o.rk ? ' · ' : '') + 'SEC' : ''}${multi ? (o.rk || b.conf ? ' · ' : '') + b.games.length + ' games' : ''}</span>`;
    const res = !show ? '' : multi ? `<b>${rc.w}-${rc.l}</b> <span class="dim small">${b.games.map(g => (g.res.w ? 'W' : 'L') + ' ' + g.res.us + '-' + g.res.them).join(', ')}</span>` : esc(resTxt(st, g0.res)).replace(/^([WL])/, '<b>$1</b>');
    const cls = show ? (multi ? (rc.w > rc.l ? 'w' : 'l') : g0.res.w ? 'w' : 'l') : '';
    return `<li class="${cls} ${pending ? 'pend' : ''} ${multi ? 'multi' : ''}"><span class="gwk">${esc(lab)}</span><span class="gopp">${opp}</span>
      <span class="gorat" title="Opponent rating">${b.kind === 't' ? '' : Math.round(o.r)}</span><span class="gres">${res}</span></li>`;
  }
  function teamBox(st, hideBlock) {
    const c = CONF[st.sport], me = teamRatings(st);
    const games = allReg(st).filter(g => g.res && !(hideBlock && hideBlock.games.includes(g))).concat((st.post || []).filter(g => !g.hidden));
    const rc = record(st, games), regRc = record(st, allReg(st).filter(g => g.res && !(hideBlock && hideBlock.games.includes(g))));
    const tiles = c.hoops ? `<div><span>${Math.round(me.team)}</span>Team</div>` : `<div><span>${Math.round(me.off)}</span>Lineup${me.genericOff ? ' <i class="dim">(stock)</i>' : ''}</div><div><span>${Math.round(me.pit)}</span>Pitching${me.genericPit ? ' <i class="dim">(stock)</i>' : ''}</div>`;
    return `<div class="box gteam"><div class="eyebrow">Your ${esc(c.who)}</div>
      <div class="grat">${tiles}<div><span id="recAll">${rc.w}-${rc.l}</span>Record</div><div><span id="recSec">${regRc.cw}-${regRc.cl}</span>SEC</div></div>
      ${board(st, true)}</div>`;
  }
  // the game(s) being played live: a queue, one live box at a time
  function liveSection(st) {
    if (!st.live) return '';
    const g = st.live.games[st.live.i], o = OPP(st, g.o);
    const more = st.live.i < st.live.games.length - 1;
    const extra = st.live.done && more ? `<div class="grow"><button class="btn primary" id="liveNext">Next game →</button> <button class="btn" id="liveRest">Sim the rest of the weekend</button></div>` : '';
    return liveBox(st, g, o, playsFor(st, g, o, 'live' + g.key2), st.live.done, g.labelLive, extra);
  }
  function wireLive(body, st, onAllDone) {
    if (!st.live) return;
    const L = st.live, g = L.games[L.i], o = OPP(st, g.o);
    if (!L.done) animateLive(st, g, o, playsFor(st, g, o, 'live' + g.key2), () => { if (st.live !== L) return; L.done = true; if (L.i >= L.games.length - 1) { onAllDone(); } rer(); });
    const nx = body.querySelector('#liveNext'); if (nx) nx.addEventListener('click', () => { L.i++; L.done = false; rer(); });
    const rs = body.querySelector('#liveRest'); if (rs) rs.addEventListener('click', () => { L.i = L.games.length - 1; L.done = true; onAllDone(); rer(); });
  }
  function startLive(st, games, labels, after) {
    games.forEach((g, i) => { g.labelLive = labels[i]; g.key2 = (g.n || '') + (g.key || '') + i + (labels[i] || ''); });
    st.live = { games, i: 0, done: false, after };
  }
  function seasonView(body) {
    const st = R(SPORT).st, c = CONF[st.sport], busy = !!(st.live && !st.liveFinished) || !!st.reveal;
    const left = st.blocks.length - st.played, liveBlock = st.live && !st.liveFinished ? st.blocks[st.liveBlock] : null;
    const nextB = st.blocks[st.played];
    const nextLabel = !nextB ? '' : c.hoops ? `Sim game ${nextB.games[0].n}` : nextB.games.length > 1 ? `Play ${nextB.kind === 't' ? 'the tournament weekend' : 'the series'}` : 'Play the midweek game';
    body.innerHTML = `${st.daily ? '<div class="gtag">Daily challenge · ' + esc(st.date) + '</div>' : ''}
      ${liveSection(st)}
      <div class="grid g2">${teamBox(st, liveBlock)}
      <div class="box gsched"><div class="gsched-head"><h3>Regular season</h3>${left ? `<div class="gbtns"><button class="btn" id="simOne" ${busy ? 'disabled' : ''}>${esc(nextLabel)}</button> <button class="btn primary" id="simAll" ${busy ? 'disabled' : ''}>Sim season</button></div>` : ''}</div>
        <ol class="glist">${st.blocks.map((b, i) => blockRow(st, b, i < st.played, (st.reveal && i >= st.reveal.from && i < st.reveal.to) || (liveBlock === b))).join('')}</ol>
        ${!left && !busy ? `<div class="grow"><button class="btn primary big" id="toPost">SEC Tournament →</button></div>` : ''}</div></div>`;
    const one = body.querySelector('#simOne');
    if (one) one.addEventListener('click', () => {
      const idx = st.played, b = playBlock(st);
      st.liveBlock = idx; st.liveFinished = false;
      const o = OPP(st, b.games[0].o);
      startLive(st, b.games, b.games.map((g, j) => c.hoops ? `Game ${g.n}` : `${b.kind === 's' ? 'Game ' + (j + 1) + ' of 3' : b.kind === 't' ? 'Tournament game ' + (j + 1) : 'Midweek'} · ${g.n} of 56`), null);
      rer();
    });
    const all = body.querySelector('#simAll');
    if (all) all.addEventListener('click', () => { const from = st.played; while (st.played < st.blocks.length) playBlock(st); st.live = null; st.reveal = { from, to: st.played }; rer(); });
    const tp = body.querySelector('#toPost'); if (tp) tp.addEventListener('click', () => { st.live = null; enterPost(st); rer(); });
    wireLive(body, st, () => { st.liveFinished = true; });
    if (st.reveal) revealRows(body, st);
  }
  function revealRows(body, st) {
    const rows = Array.from(body.querySelectorAll('.glist li.pend')), token = ++ANIM;
    const finish = () => { st.reveal = null; rer(); };
    const games = st.blocks.slice(0, st.reveal.from).reduce((a, b) => a.concat(b.games), []);
    let rc = record(st, games);
    const recA = body.querySelector('#recAll'), recS = body.querySelector('#recSec');
    let i = 0; const gap = Math.max(60, Math.min(220, 5000 / Math.max(1, rows.length)));
    const step = () => {
      if (token !== ANIM) return;
      if (i >= rows.length) return setTimeout(() => { if (token === ANIM) finish(); }, 300);
      const b = st.blocks[st.reveal.from + i], li = rows[i];
      const brc = record(st, b.games);
      li.classList.remove('pend'); li.classList.add(b.games.length > 1 ? (brc.w > brc.l ? 'w' : 'l') : b.games[0].res.w ? 'w' : 'l', 'pop');
      const res = li.querySelector('.gres'); if (res) res.innerHTML = b.games.length > 1 ? `<b>${brc.w}-${brc.l}</b>` : esc(resTxt(st, b.games[0].res)).replace(/^([WL])/, '<b>$1</b>');
      rc = { w: rc.w + brc.w, l: rc.l + brc.l, cw: rc.cw + brc.cw, cl: rc.cl + brc.cl };
      if (recA) recA.textContent = rc.w + '-' + rc.l; if (recS) recS.textContent = rc.cw + '-' + rc.cl;
      i++; setTimeout(step, gap);
    };
    if (reduceMotion()) return finish();
    setTimeout(step, 120);
  }

  // ---- postseason ----
  const teamOf = (st, br, seed) => { const f = br.field[seed]; return f.me ? 'Tennessee' : oName(OPP(st, f.id)); };
  function bracketHtml(st, br, labels, hide) {
    const team = (seed, score, win, played) => {
      if (seed == null) return '<div class="gbt dim"><span class="gseed"></span><span class="gbn">TBD</span></div>';
      const f = br.field[seed], o = f.me ? null : OPP(st, f.id);
      return `<div class="gbt ${f.me ? 'me' : ''} ${played ? (win ? 'win' : 'lose') : ''}"><span class="gseed">${seed > 16 ? '' : seed}</span><span class="gbn">${esc(teamOf(st, br, seed))}${o && o.rk ? ` <i class="dim">${oTag(o)}</i>` : ''}</span>${played ? `<b>${score}</b>` : ''}</div>`;
    };
    const known = x => { try { return resolve(br, x); } catch (e) { return null; } };
    const cols = br.rounds.map((rd, i) => {
      const html = rd.m.map(g => {
        const played = g.win != null && i !== hide;
        if (played) return `<div class="gbm done">${team(g.A, g.sa, g.win === g.A, true)}${team(g.B, g.sb, g.win === g.B, true)}${g.ot ? `<span class="gbot">${CONF[st.sport].hoops ? 'OT' : g.ot}</span>` : ''}</div>`;
        const a = i === hide ? g.A : known(g.a), b = i === hide ? g.B : known(g.b);
        return `<div class="gbm tbd">${team(a)}${team(b)}</div>`;
      }).join('');
      return `<div class="gbcol ${br.cur === i ? 'cur' : ''}"><div class="glabel">${esc(labels ? labels(rd) : rd.label)}</div>${html}</div>`;
    }).join('');
    const champ = br.champ && hide < br.rounds.length - 1 ? `<div class="gbchamp ${br.field[br.champ].me ? 'me' : ''}">🏆 ${esc(teamOf(st, br, br.champ))}</div>` : '';
    return `<div class="gbracket wide" style="--cols:${br.rounds.length}">${cols}</div>${champ}`;
  }
  function deHtml(st, title, de, teams, hideAll) {
    if (!de) return `<div class="gstage"><h4>${esc(title)}</h4><ul class="gde">${teams.map(t => `<li class="${t.me ? 'me' : ''}">${t.seed ? `<span class="gseed">${t.seed}</span>` : ''}<b>${t.me ? 'Tennessee' : esc(oName(OPP(st, t.id)))}</b></li>`).join('')}</ul></div>`;
    const nm = i => teams[i].me ? 'Tennessee' : OPP(st, teams[i].id).t;
    const LBL = { G1: 'Game 1', G2: 'Game 2', G3: 'Elimination', G4: 'Winners', G5: 'Elimination', G6: 'Final', G7: 'Final (if necessary)' };
    return `<div class="gstage"><h4>${esc(title)}</h4><ul class="gde">${de.games.map(g => {
      const show = !hideAll;
      return `<li class="${(teams[g.a].me || teams[g.b].me) ? 'me' : ''}"><span class="dim small">${LBL[g.key]}</span><span>${esc(nm(g.a))} ${show ? `<b>${g.sa}</b>` : ''} · ${esc(nm(g.b))} ${show ? `<b>${g.sb}</b>` : ''}${show && g.inn > CONF[st.sport].inn ? ` <i class="dim">(${g.inn})</i>` : ''}</span></li>`;
    }).join('')}</ul>${hideAll ? '' : `<p class="small"><b>Champion: ${esc(nm(de.champ))}</b></p>`}</div>`;
  }
  function seriesHtml(st, title, s, oppId, hideAll) {
    const o = OPP(st, oppId);
    return `<div class="gstage"><h4>${esc(title)}</h4><p>Tennessee vs. ${esc(oName(o))}${o.rk ? ' <i class="dim">' + oTag(o) + '</i>' : ''}</p>${s && !hideAll ? `<ul class="gde">${s.games.map(g => `<li class="me"><span class="dim small">Game ${g.n}</span><span>Tennessee <b>${g.sa}</b> · ${esc(o.t)} <b>${g.sb}</b></span></li>`).join('')}</ul><p class="small"><b>${s.winA ? 'Tennessee wins the series ' + s.wa + '-' + s.wb : esc(o.t) + ' wins the series ' + s.wb + '-' + s.wa}</b></p>` : ''}</div>`;
  }
  function postView(body) {
    const st = R(SPORT).st, c = CONF[st.sport];
    const head = st.daily ? '<div class="gtag">Daily challenge · ' + esc(st.date) + '</div>' : '';
    const busy = st.live && !st.liveFinished;
    const notes = (st.notes || []).map(n => `<p class="dim">${esc(n)}</p>`).join('');
    let main = '', actions = '';
    if (st.ps === 'sec') {
      const br = st.sec, myGame = bracketMyGameNow(br), done = br.cur >= br.rounds.length;
      const alive = bracketAlive(br);
      if (!busy) {
        if (done) actions = `<button class="btn primary big" id="toSel">${br.field[br.champ].me ? 'SEC champions! ' : ''}Selection ${c.hoops ? 'Sunday' : 'Monday'} →</button>`;
        else if (myGame) actions = `<button class="btn primary big" id="playRd">Play the ${esc(SEC_LABEL(br.rounds[br.cur]).replace('SEC Tournament ', ''))}</button> <button class="btn" id="simRest">Sim the rest</button>`;
        else actions = `<button class="btn primary" id="nextRd">${alive ? 'Sim the ' + esc(br.rounds[br.cur].label.toLowerCase()) + ' (you have a bye)' : 'Sim the ' + esc(br.rounds[br.cur].label.toLowerCase())}</button> <button class="btn" id="simRest">Sim the rest</button>`;
      }
      main = `<div class="box gbracket-box"><div class="gsched-head"><h3>SEC Tournament</h3><span class="eyebrow">You: No. ${st.secSeed} seed${!alive && !busy ? ' · eliminated' : ''}</span></div>${notes}
        ${bracketHtml(st, br, null, busy ? br.cur - 1 : -1)}<div class="grow">${actions}</div></div>`;
    } else if (c.hoops && st.ps === 'ncaa') {
      const br = st.ncaa, myGame = bracketMyGameNow(br), done = br.cur >= br.rounds.length, alive = bracketAlive(br);
      if (!busy) {
        if (done) actions = `<button class="btn primary big" id="toRes">See your final results →</button>`;
        else if (myGame) actions = `<button class="btn primary big" id="playRd">Play the ${esc(br.rounds[br.cur].label.replace('National championship', 'national championship'))}</button> <button class="btn" id="simRest">Sim the rest</button>`;
        else actions = `<button class="btn primary" id="nextRd">Sim the ${esc(br.rounds[br.cur].label)}</button> <button class="btn" id="simRest">Sim the rest</button>`;
      }
      main = `${st.revealSel ? `<div class="box gselect"><div class="eyebrow">Selection Sunday</div><h3>You're in. No. ${st.ncaaSeed} seed.</h3>${notes}</div>` : ''}
        <div class="box gbracket-box"><div class="gsched-head"><h3>NCAA Tournament</h3><span class="eyebrow">Your region · No. ${st.ncaaSeed} seed${!alive && !busy ? ' · eliminated' : ''}</span></div>
        ${bracketHtml(st, br, null, busy ? br.cur - 1 : -1)}<p class="dim small">The other three regions' champions meet you at the Final Four.</p><div class="grow">${actions}</div></div>`;
    } else if (!c.hoops && ['regional', 'super', 'cws', 'finals', 'over'].includes(st.ps) && st.dia) {
      const d = st.dia, hideStage = busy ? st.liveStage : null;
      const btn = { regional: ['Play the regional', 'Regional'], super: ['Play the super regional', 'Super'], cws: [`Play ${c.omaha}`, 'CWS'], finals: ['Play the finals', 'Finals'] }[st.ps];
      if (!busy) actions = st.ps === 'over' ? `<button class="btn primary big" id="toRes">See your final results →</button>` : `<button class="btn primary big" id="playStage">${esc(btn[0])}</button> <button class="btn" id="simRest">Sim the rest</button>`;
      main = `${st.revealSel ? `<div class="box gselect"><div class="eyebrow">Selection Monday</div><h3>You're in the field of 64.</h3>${notes}</div>` : ''}
        <div class="box gbracket-box"><div class="gsched-head"><h3>NCAA Tournament</h3><span class="eyebrow">${st.natSeed ? 'No. ' + st.natSeed + ' national seed' : 'Regional No. ' + st.regSeed + ' seed'}</span></div>
        <div class="gstages">${deHtml(st, 'Regional', d.regional, d.reg, hideStage === 'reg')}
        ${d.superOpp != null ? seriesHtml(st, 'Super Regional', d.super, d.superOpp, hideStage === 'sup') : ''}
        ${d.cwsA ? deHtml(st, c.omaha + ': your bracket', d.cwsAres, d.cwsA, hideStage === 'cws') : ''}
        ${d.cwsB && d.cwsBres && hideStage !== 'cws' ? deHtml(st, c.omaha + ': other bracket', d.cwsBres, d.cwsB) : ''}
        ${d.finals || st.ps === 'finals' ? seriesHtml(st, 'Finals', d.finals, d.finalOpp, hideStage === 'fin') : ''}</div>
        <div class="grow">${actions}</div></div>`;
    } else {
      actions = `<button class="btn primary big" id="toRes">See your final results →</button>`;
      main = `<div class="box gselect"><div class="eyebrow">Selection ${c.hoops ? 'Sunday' : 'Monday'}</div><h3>Left out.</h3>${notes}<div class="grow">${actions}</div></div>`;
    }
    body.innerHTML = `${head}${liveSection(st)}<div class="gpost">${main}</div>`;
    const after = () => { st.liveFinished = true; };
    wireLive(body, st, after);
    const playBr = br => {
      const lab = br === st.sec ? SEC_LABEL : NCAA_LABEL;
      // sim rounds where Tennessee has a bye first
      while (br.cur < br.rounds.length && !bracketMyGameNow(br) && bracketAlive(br)) playBracketRound(st, br, lab);
      const mine = playBracketRound(st, br, lab);
      st.live = null;
      if (mine.length) { st.liveFinished = false; startLive(st, mine.map(m => Object.assign(m, { n: '' })), mine.map(m => m.label), null); }
      rer();
    };
    const br = st.ps === 'sec' ? st.sec : st.ps === 'ncaa' ? st.ncaa : null;
    const pr = body.querySelector('#playRd'); if (pr) pr.addEventListener('click', () => { st.revealSel = false; playBr(br); });
    const nr = body.querySelector('#nextRd'); if (nr) nr.addEventListener('click', () => { st.revealSel = false; st.live = null; playBracketRound(st, br, br === st.sec ? SEC_LABEL : NCAA_LABEL); rer(); });
    const sr = body.querySelector('#simRest'); if (sr) sr.addEventListener('click', () => {
      st.live = null; st.revealSel = false;
      if (br) { const lab = br === st.sec ? SEC_LABEL : NCAA_LABEL; while (br.cur < br.rounds.length) playBracketRound(st, br, lab); }
      else { if (st.ps === 'regional') playRegional(st); if (st.ps === 'super') playSuper(st); if (st.ps === 'cws') playCWS(st); if (st.ps === 'finals') playFinals(st); }
      rer();
    });
    const ts = body.querySelector('#toSel'); if (ts) ts.addEventListener('click', () => { st.live = null; if (c.hoops) hoopsSelection(st); else diaSelection(st); st.revealSel = true; rer(); });
    const ps = body.querySelector('#playStage'); if (ps) ps.addEventListener('click', () => {
      st.revealSel = false; st.live = null;
      const before = st.post.length, stage = { regional: 'reg', super: 'sup', cws: 'cws', finals: 'fin' }[st.ps];
      ({ regional: playRegional, super: playSuper, cws: playCWS, finals: playFinals })[st.ps](st);
      const mine = st.post.slice(before);
      st.liveStage = stage; st.liveFinished = false;
      startLive(st, mine.map(m => Object.assign(m, { n: '' })), mine.map(m => m.label), null);
      rer();
    });
    const tr = body.querySelector('#toRes'); if (tr) tr.addEventListener('click', () => { st.live = null; st.phase = 'done'; finishRun(st); rer(); });
  }

  // ---- results ----
  function finishRun(st) {
    const s = summary(st), c = CONF[st.sport], me = teamRatings(st);
    const sq = g => g.res.w ? '🟧' : '⬛';
    const D = data(st.sport), e = st.eras.length === D.decs.length ? '' : '.' + st.eras.map(x => String(x).slice(2)).join('-');
    const path = { mbb: 'mens-basketball', wbb: 'womens-basketball', baseball: 'baseball', softball: 'softball' }[st.sport];
    const link = st.daily ? SITE : `https://www.volindex.net/games/${path}/run?c=${st.seed}${e}${st.side === 'both' ? '' : '&s=' + st.side[0]}`;
    const reg = record(st), body = c.hoops
      ? allReg(st).map(sq).join('') + (st.post.length ? '\n' + st.post.map(sq).join('') : '')
      : `Regular season ${reg.w}-${reg.l} (SEC ${reg.cw}-${reg.cl}) · Postseason ${st.post.filter(g => g.res.w).length}-${st.post.filter(g => !g.res.w).length}`;
    const rate = c.hoops ? `Team ${Math.round(me.team)}` : `Lineup ${Math.round(me.off)} · Pitching ${Math.round(me.pit)}`;
    st.share = `${c.icon} ${c.run} ${D.name}${st.daily ? ' ' + st.date : ''}: ${!c.hoops && s.perfect ? 'Perfect season' : s.wins + '-' + s.losses} · ${s.tier}\n${body}\n${rate}\n${st.daily ? link : 'Same draft: ' + link}`;
    if (window.VI_TRACK) window.VI_TRACK('finish/' + st.sport + '/run/' + (st.daily ? 'daily' : 'free'));
    const save = JSON.parse(JSON.stringify(st, (k, v) => k === 'fits' ? undefined : v));
    if (st.daily) store.set(dkey(st.sport, 'run', st.date), { final: save, share: st.share });
    if (st.daily && window.VI_SYNC) setTimeout(window.VI_SYNC, 500);
    const hist = store.get(st.sport + '-run-stats', { played: 0, titles: 0, perfect: 0, best: null });
    hist.played++; if (s.title) hist.titles++; if (s.perfect) hist.perfect++;
    if (!hist.best || s.wins - s.losses > hist.best.w - hist.best.l) hist.best = { w: s.wins, l: s.losses, tier: s.tier };
    store.set(st.sport + '-run-stats', hist);
  }
  function resultsView(body) {
    const sport = SPORT, X = R(sport), st = X.st, c = CONF[sport], s = summary(st), me = teamRatings(st);
    const hist = store.get(sport + '-run-stats', { played: 0, titles: 0, perfect: 0 }), dsv = store.get(dkey(sport, 'run'), null);
    let br = '';
    if (c.hoops && st.ncaa) br = `<div class="box gbracket-box"><h3>NCAA Tournament · your region</h3>${bracketHtml(st, st.ncaa, null, -1)}</div>`;
    else if (!c.hoops && st.dia) { const d = st.dia; br = `<div class="box gbracket-box"><h3>NCAA Tournament</h3><div class="gstages">${deHtml(st, 'Regional', d.regional, d.reg)}${d.superOpp != null ? seriesHtml(st, 'Super Regional', d.super, d.superOpp) : ''}${d.cwsAres ? deHtml(st, c.omaha + ': your bracket', d.cwsAres, d.cwsA) : ''}${d.finals ? seriesHtml(st, 'Finals', d.finals, d.finalOpp) : ''}</div></div>`; }
    const champ = c.hoops && st.ncaa && st.ncaa.champ && !s.title ? teamOf(st, st.ncaa, st.ncaa.champ) : null;
    body.innerHTML = `${modeBar(X.mode, !!(dsv && dsv.final))}
      <div class="box gfinal ${s.title ? 'champ' : ''}"><div class="eyebrow">${st.daily ? 'Daily challenge · ' + esc(st.date) : 'Free play'}</div>
        <h2>${!c.hoops && s.perfect ? 'Perfect season' : s.wins + '-' + s.losses}</h2><div class="gtier">${esc(s.tier)}</div><p>${esc(s.tierText)}</p>
        ${(st.notes || []).map(n => `<p class="dim">${esc(n)}</p>`).join('')}
        ${s.secChamp ? '<p class="dim">SEC Tournament champions</p>' : ''}
        ${champ ? `<p class="dim">National champion: ${esc(champ)}</p>` : ''}
        <div class="grow"><button class="btn primary" id="runShare">Copy result</button> <button class="btn" id="runAgain">${st.daily ? 'Free play' : 'Play again'}</button></div>
        <p class="dim small">Your ${c.run} runs: ${hist.played} played · ${hist.titles} titles · ${hist.perfect} perfect</p></div>
      ${br}
      ${st.sec ? `<details class="box gbracket-box"><summary><b>SEC Tournament</b></summary>${bracketHtml(st, st.sec, null, -1)}</details>` : ''}
      <div class="gresults"><div class="box gteam"><div class="eyebrow">Your ${esc(c.who)} · ${c.hoops ? 'Team ' + Math.round(me.team) : 'Lineup ' + Math.round(me.off) + ' · Pitching ' + Math.round(me.pit)}</div>${board(st, true)}</div>
        <div class="box gsched"><h3>Season</h3><ol class="glist compact">${st.blocks.map(b => blockRow(st, b, true)).join('')}
          ${(st.post || []).map(g => { const o = OPP(st, g.o); return `<li class="${g.res.w ? 'w' : 'l'}"><span class="gwk">Post</span><span class="gopp"><b>${esc(g.label)}</b> <span class="dim">vs. ${esc(oName(o))}</span></span><span class="gorat">${Math.round(o.r)}</span><span class="gres">${esc(resTxt(st, g.res)).replace(/^([WL])/, '<b>$1</b>')}</span></li>`; }).join('')}</ol></div></div>`;
    bindMode(body, m => { X.mode = m; X.st = null; rer(); });
    body.querySelector('#runShare').addEventListener('click', e => { if (window.VI_TRACK) window.VI_TRACK('share/' + sport + '/run'); copyText(st.share || '', e.currentTarget); });
    body.querySelector('#runAgain').addEventListener('click', () => { X.mode = 'free'; X.st = null; rer(); });
  }

  window.VI_RUN2 = { render };
  window.VI_RUN2_ENGINE = { CONF, SLOTS, TUNE, data, newState, hydrate, runSpin, place, canFill, currentSide, teamRatings, buildSeason, playBlock, enterPost,
    playBracketRound, hoopsSelection, diaSelection, playRegional, playSuper, playCWS, playFinals, summary, simulateRun, hoopGame, diaGame, hoopPlays, diaPlays, allReg, record };
})();
