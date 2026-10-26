/* The Vol Index — Football Dynasty: the league (new dynasty, schedules, weekly results, stats, polls, CFP rankings,
   conference title games, the playoff, bowls, awards, records, history and the news feed). */
(function (root) {
  'use strict';
  const DY = root.DY;
  const { rr, ri, chance, pick, gauss, clamp, wpick, shuffle } = DY;
  const rnd = () => DY.r();
  const G = () => DY.G;
  DY.T = id => id >= 1000 ? DY.fcsCache(id) : G().teams[id];
  DY.userT = () => G().teams[G().user];
  DY.tnT = () => G().teams[DY.UT_ID];                 // the real Tennessee (the user's team or a CPU opponent)
  DY.isTN = () => G().user === DY.UT_ID;
  DY.UN = () => DY.userT().name;
  DY.nick = () => DY.isTN() ? 'the Vols' : DY.UN();
  const tname = id => DY.T(id).name;

  /* ---------- dates ---------- */
  DY.firstSat = y => { const d = new Date(Date.UTC(y, 8, 1)); while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1); return d; };
  DY.weekDate = (y, w) => { const d = DY.firstSat(y); d.setUTCDate(d.getUTCDate() + 7 * (w - 1)); return d; };
  DY.weekOfDate = (y, iso) => Math.round((Date.parse(iso + 'T12:00:00Z') - DY.firstSat(y).getTime()) / (7 * 864e5)) + 1;
  DY.thirdSatOct = y => { const d = new Date(Date.UTC(y, 9, 1)); while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1); d.setUTCDate(d.getUTCDate() + 14); return Math.round((d - DY.firstSat(y)) / (7 * 864e5)) + 1; };
  DY.dateStr = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  DY.LAST_WK = 13;
  DY.CFP_WEEKS = [10, 11, 12, 13];
  // difficulty: CPU players get this added to every rating on every snap of your games (Heisman is the balanced default)
  // Varsity is the default; Heisman is the hard setting (CPU teams play above their ratings in your games)
  DY.DIFF = { freshman: -3, varsity: 0, heisman: 3 };
  // playoff size: the real format is 12 teams in 2026 and 24 teams from 2027 (no conference title games)
  DY.cfpSize = () => { const g = G(), c = g.settings.cfp; return c === 'real' || c == null ? (g.season >= 2027 ? 24 : 12) : +c; };     // CFP rankings come out the Tuesday after these weeks (early November on)

  /* ---------- new dynasty ---------- */
  DY.newDynasty = opts => {
    const seed = opts.seed || (Date.now() % 2147483647);
    DY.seed(seed);
    const g = DY.G = {
      v: DY.VERSION, seed, season: 2026, startSeason: 2026, phase: 'preseason', week: 0, P: {}, nextId: 1, teams: [], user: (DY.TEAMS.find(t => t.name === opts.team) || { id: DY.UT_ID }).id,
      coach: { name: opts.coach || 'Coach', arch: opts.arch || 'motivator', w: 0, l: 0, hist: [] },
      settings: Object.assign({ cfp: 'real', recruiting: 'manual', portal: 'manual', nil: 'manual', coachMode: 'offense', speed: 'slow', injuries: true, shake: true, difficulty: 'varsity', autosave: true, offStyle: 'power', watchSeason: false }, opts.settings || {}),
      sched: [], polls: { ap: [], cfp: null, hist: {} }, news: [], hist: [], awards: {}, rec: null, legacy: {}, post: null, off: null, recruit: null, created: Date.now(),
    };
    g.settings.diffBoost = DY.DIFF[g.settings.difficulty] || 0;
    DY.TEAMS.forEach(t0 => {
      const t = Object.assign({}, t0, { roster: [], depth: {}, w: 0, l: 0, cw: 0, cl: 0, pf: 0, pa: 0, res: [], hist: [] });
      t.style = DY.STYLE_OF[t.name] || wpick(Object.keys(DY.STYLES).filter(s => s !== 'option'), s => s === 'spread' ? 4 : s === 'pro' ? 3 : s === 'tempo' ? 2 : s === 'air' ? 1 : 1.2);
      t.aggr = clamp(0.5 + gauss() * 0.15, 0.2, 0.9);
      t.coach = t.id === g.user ? g.coach.name : DY.coachName();
      t.budget = DY.teamBudget(t);
      g.teams.push(t);
      if (t.id === g.user) t.user = true;
      if (t.id === DY.UT_ID) { DY.importTennessee(t); t.depthEdited = t.user; } else { DY.genRoster(t); if (t.user) DY.fillRoster(t, 84); }
    });
    g.teams.forEach(DY.fixNums);
    const ut = DY.userT();
    ut.style = g.settings.offStyle || 'power'; DY.pickCaptains(ut);
    DY.seedPast(g);
    // NIL: contracts sized to the budget
    DY.initNil(ut); if (!DY.isTN()) DY.initNil(DY.tnT());
    g.teams.forEach(t => DY.pickCaptains(t)); g.camp = { y: g.season, list: [] };
    g.teams.forEach(t => { const o = DY.teamOvr(t); t.elo = 1500 + (o.ovr - 76) * 26 + (t.prestige - 70) * 1.2; t.preElo = t.elo; });
    DY.buildSchedule(g.season);
    DY.preseasonPoll();
    if (DY.initRecruiting) DY.initRecruiting(true);
    DY.initRecords();
    DY.news('league', `${g.coach.name} takes over at ${DY.UN()}`, `The ${g.season} season opens ${DY.dateStr(DY.weekDate(g.season, 1))} against ${tname(DY.userGames(1)[0] ? DY.oppOf(DY.userGames(1)[0]) : 0)}. The Vols start the year No. ${DY.apRank(ut.id) || 'NR'} in the preseason AP poll.`);
    return g;
  };
  DY.initNil = t => {
    const ps = t.roster.map(DY.P);
    ps.forEach(p => { p.nilV = DY.nilValue(p, t); });
    const sum = ps.reduce((s, p) => s + p.nilV, 0), target = t.budget * 0.9;
    const k = target / sum;
    ps.forEach(p => { p.nil = Math.round(clamp(p.nilV * k * rr(0.85, 1.15), 5000, 7e6) / 5000) * 5000; });
  };
  DY.payroll = t => t.roster.reduce((s, id) => s + (DY.P(id).nil || 0), 0);

  /* ---------- schedules ---------- */
  const confTeams = conf => G().teams.filter(t => t.conf === conf);
  DY.byName = n => G().teams.find(t => t.name === n) || DY.FCS.find(t => t.name === n);
  const fcsC = {};
  DY.fcsCache = id => { const g = G(); const key = id + '|' + g.season; if (!fcsC[key]) { const f = DY.FCS.find(x => x.id === id); fcsC[key] = DY.fcsTeam(f, g.season); } return fcsC[key]; };
  DY.clearFcs = () => { for (const k in fcsC) delete fcsC[k]; DY.TMP = {}; };
  // conference opponent sets: a random graph where everyone gets n games (permanent rivals and Tennessee's real slate fixed)
  function confGraph(conf, n, fixed) {
    const ts = confTeams(conf).map(t => t.id);
    n = Math.min(n, ts.length - 1);
    for (let attempt = 0; attempt < 400; attempt++) {
      const E = new Set(), deg = {}; ts.forEach(t => deg[t] = 0);
      const key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
      let ok = true;
      fixed.forEach(([a, b]) => { const k = key(a, b); if (!E.has(k)) { E.add(k); deg[a]++; deg[b]++; } });
      if (ts.some(t => deg[t] > n)) return null;
      const lockedFull = fixed.lockFull || [];
      for (let it = 0; it < 2000; it++) {
        const need = ts.filter(t => deg[t] < n && !lockedFull.includes(t));
        if (!need.length) break;
        const a = need.sort((x, y) => (deg[x] - deg[y]) || (rnd() - 0.5))[0];
        const cands = need.filter(b => b !== a && !E.has(key(a, b)));
        if (!cands.length) { ok = false; break; }
        const b = pick(cands);
        E.add(key(a, b)); deg[a]++; deg[b]++;
      }
      if (ok && ts.every(t => lockedFull.includes(t) ? true : deg[t] === n)) return [...E].map(k => k.split('-').map(Number));
    }
    return null;
  }
  DY.UT_NONCONF_REAL = {
    2026: [['Furman', 'H', '2026-09-05'], ['Georgia Tech', 'A', '2026-09-12'], ['Kennesaw State', 'H', '2026-09-19']],
    2027: [['Georgia Tech', 'H', '2027-08-28'], ['Tennessee State', 'H', '2027-09-04'], ['Western Michigan', 'H', '2027-09-18']],
  };
  DY.buildSchedule = season => {
    const g = G(), UT = DY.UT_ID;
    const games = [];
    const add = (wk, h, a, conf, neutral, tag) => { games.push({ id: season + '-' + games.length, wk, h, a, conf: !!conf, neutral: !!neutral, tag: tag || null, res: null }); };
    const busy = {}; const isBusy = (t, w) => busy[t + '|' + w]; const mark = (t, w) => { busy[t + '|' + w] = 1; };
    const cyc = DY.UT_SEC[2026 + ((season - 2026) % 4 + 4) % 4];
    const bamaWk = DY.thirdSatOct(season);
    // 1. Tennessee's 12
    const utGames = [];
    if (season === 2026) {
      (root.SITE && root.SITE.football && root.SITE.football.schedule || []).forEach(s0 => { const o = DY.byName(s0.opp); if (!o) return; utGames.push({ wk: DY.weekOfDate(season, s0.date), o: o.id, home: s0.site === 'H', conf: s0.sec }); });
    }
    if (!utGames.length) {
      let non = (g.nonconfPick && g.nonconfPick[season]) || (DY.UT_NONCONF_REAL[season] ? DY.UT_NONCONF_REAL[season].map(x => ({ o: DY.byName(x[0]).id, home: x[1] === 'H', wk: DY.weekOfDate(season, x[2]) })) : null);
      if (!non) non = DY.autoNonconf(season);
      non = non.map(x => Object.assign({ conf: false }, x));
      const sec = cyc.H.map(n => ({ o: DY.byName(n).id, home: true, conf: true })).concat(cyc.A.map(n => ({ o: DY.byName(n).id, home: false, conf: true })));
      const used = new Set(non.map(x => x.wk));
      const bama = sec.find(x => tname(x.o) === 'Alabama'), vandy = sec.find(x => tname(x.o) === 'Vanderbilt');
      bama.wk = bamaWk; vandy.wk = DY.LAST_WK; used.add(bamaWk); used.add(DY.LAST_WK);
      const free = []; for (let w = 1; w <= DY.LAST_WK; w++) if (!used.has(w)) free.push(w);
      // one bye after the non-conference stretch, the rest SEC
      const rest = sec.filter(x => x !== bama && x !== vandy);
      const open = free.filter(w => w > Math.max(...non.map(x => x.wk), 0) || w > 5);
      const byeWk = pick(open.filter(w => w >= 6 && w <= 11 && w !== bamaWk));
      const weeks = free.filter(w => w !== byeWk).slice(-rest.length);
      shuffle(rest).forEach((x, i) => { x.wk = weeks[i] || free[i]; });
      utGames.push(...non, ...sec);
    }
    utGames.forEach(x => { add(x.wk, x.home ? UT : x.o, x.home ? x.o : UT, x.conf, false, x.wk === DY.LAST_WK && tname(x.o) === 'Vanderbilt' ? 'Rivalry Week' : tname(x.o) === 'Alabama' ? 'Third Saturday in October' : null); mark(UT, x.wk); if (x.o < 1000) mark(x.o, x.wk); });
    // 2. conference games for everyone else
    const confEdges = {};
    for (const conf in DY.CONF_GAMES) {
      const n = DY.CONF_GAMES[conf], ids = confTeams(conf).map(t => t.id);
      const fixed = [];
      if (conf === 'SEC') {
        for (const a in DY.SEC_PERM) DY.SEC_PERM[a].forEach(b => { const A = DY.byName(a).id, B = DY.byName(b).id; if (!fixed.some(e => (e[0] === A && e[1] === B) || (e[0] === B && e[1] === A))) fixed.push([A, B]); });
        cyc.H.concat(cyc.A).forEach(nm => { const B = DY.byName(nm).id; if (!fixed.some(e => (e[0] === UT && e[1] === B) || (e[0] === B && e[1] === UT))) fixed.push([UT, B]); });
        fixed.lockFull = [UT];
      }
      const E = confGraph(conf, n, fixed) || confGraph(conf, n - 1, fixed) || [];
      confEdges[conf] = E.filter(([a, b]) => a !== UT && b !== UT);
    }
    // rivalry week first
    const riv = DY.RIVALRY_WEEK.map(([a, b]) => [DY.byName(a), DY.byName(b)]).filter(([a, b]) => a && b && a.fbs && b.fbs && a.id !== UT && b.id !== UT);
    const nonconfRiv = [];
    riv.forEach(([A, B]) => {
      const E = confEdges[A.conf];
      const i = A.conf === B.conf && E ? E.findIndex(([x, y]) => (x === A.id && y === B.id) || (x === B.id && y === A.id)) : -1;
      if (i >= 0 && !isBusy(A.id, DY.LAST_WK) && !isBusy(B.id, DY.LAST_WK)) {
        E.splice(i, 1); const hm = (season + A.id + B.id) % 2 === 0;
        add(DY.LAST_WK, hm ? A.id : B.id, hm ? B.id : A.id, true, false, 'Rivalry Week'); mark(A.id, DY.LAST_WK); mark(B.id, DY.LAST_WK);
      } else if (A.conf !== B.conf && DY.P4.includes(A.conf) && DY.P4.includes(B.conf) && !isBusy(A.id, DY.LAST_WK) && !isBusy(B.id, DY.LAST_WK)) nonconfRiv.push([A, B]);
    });
    nonconfRiv.forEach(([A, B]) => { const hm = (season + A.id) % 2 === 0; add(DY.LAST_WK, hm ? A.id : B.id, hm ? B.id : A.id, false, false, 'Rivalry Week'); mark(A.id, DY.LAST_WK); mark(B.id, DY.LAST_WK); });
    // neutral-site classics
    const NEUTRAL = [['Florida', 'Georgia', 'Jacksonville'], ['Oklahoma', 'Texas', 'Dallas']];
    // place conference games into weeks (most constrained first)
    for (const conf in confEdges) {
      let E = shuffle(confEdges[conf]);
      const placeOne = (a, b, lo) => {
        const opts = []; for (let w = lo; w <= DY.LAST_WK; w++) if (!isBusy(a, w) && !isBusy(b, w)) opts.push(w);
        if (!opts.length) return false;
        const w = wpick(opts, x => x >= 4 ? 3 : 1);
        const nt = NEUTRAL.find(n => [tname(a), tname(b)].sort().join() === [n[0], n[1]].sort().join());
        const hm = (season + a * 7 + b * 3) % 2 === 0;
        add(w, hm ? a : b, hm ? b : a, true, !!nt, nt ? 'Neutral: ' + nt[2] : null); mark(a, w); mark(b, w); return true;
      };
      E.sort((x, y) => 0);
      E.forEach(([a, b]) => { if (!placeOne(a, b, 4)) placeOne(a, b, 1); });
    }
    // 3. non-conference: fill everyone to 12 (FBS vs FBS early, then FCS)
    const count = {}; G().teams.forEach(t => count[t.id] = 0); games.forEach(x => { if (count[x.h] != null) count[x.h]++; if (count[x.a] != null) count[x.a]++; });
    const fbs = G().teams.map(t => t.id).filter(t => t !== UT);
    for (let w = 1; w <= 12; w++) {
      if (w > 5 && w !== 12) continue;
      const avail = shuffle(fbs.filter(t => count[t] < 12 && !isBusy(t, w)));
      const used = new Set();
      avail.forEach(a => {
        if (used.has(a) || count[a] >= 12) return;
        const A = DY.T(a);
        if (chance(DY.P4.includes(A.conf) ? 0.42 : 0.15) && w <= 5) return; // leave room for an FCS game
        const cands = avail.filter(b => b !== a && !used.has(b) && count[b] < 12 && DY.T(b).conf !== A.conf && !games.some(x => (x.h === a && x.a === b) || (x.h === b && x.a === a)));
        if (!cands.length) return;
        const b = wpick(cands, b => { const B = DY.T(b); const p4a = DY.P4.includes(A.conf), p4b = DY.P4.includes(B.conf); return p4a !== p4b ? 3 : 1; });
        const B = DY.T(b);
        const aHome = (DY.P4.includes(A.conf) && !DY.P4.includes(B.conf)) ? true : (DY.P4.includes(B.conf) && !DY.P4.includes(A.conf)) ? false : chance(0.5);
        add(w, aHome ? a : b, aHome ? b : a, false); mark(a, w); mark(b, w); count[a]++; count[b]++; used.add(a); used.add(b);
      });
    }
    // anyone still short (independents, 8-game conferences): FBS opponents in any open week, then one FCS game
    for (let pass = 0; pass < 2; pass++) for (let w = 1; w <= DY.LAST_WK; w++) {
      const avail = shuffle(fbs.filter(t => count[t] < 12 - pass && !isBusy(t, w)));
      const used = new Set();
      avail.forEach(a => {
        if (used.has(a) || count[a] >= 12) return;
        const A = DY.T(a);
        const cands = avail.filter(b => b !== a && !used.has(b) && count[b] < 12 && (DY.T(b).conf !== A.conf || A.conf === 'IND') && !games.some(x => (x.h === a && x.a === b) || (x.h === b && x.a === a)));
        if (!cands.length) return;
        const b = pick(cands);
        const hm = chance(0.5); add(w, hm ? a : b, hm ? b : a, false); mark(a, w); mark(b, w); count[a]++; count[b]++; used.add(a); used.add(b);
      });
      if (pass === 0 && w === DY.LAST_WK) { /* second pass allows one more */ }
    }
    fbs.forEach(a => {
      for (let w = 1; w <= DY.LAST_WK && count[a] < 12; w++) {
        if (isBusy(a, w)) continue;
        const f = wpick(DY.FCS, f => DY.T(a).st === f.st ? 4 : 1);
        add(w, a, f.id, false); mark(a, w); count[a]++;
      }
    });
    games.sort((x, y) => x.wk - y.wk);
    g.sched = games;
    return games;
  };
  // auto-generated non-conference slate for Tennessee: a Power 4 or ACC opponent, a Group of Six team, an FCS team in weeks 1-4
  DY.autoNonconf = season => {
    const ut = DY.userT();
    const p4 = G().teams.filter(t => t.conf !== 'SEC' && DY.P4.includes(t.conf) || t.abbr === 'ND');
    const g6 = G().teams.filter(t => !DY.P4.includes(t.conf) && t.conf !== 'IND');
    const fcs = DY.FCS.filter(f => ['TN', 'GA', 'AL', 'SC', 'KY', 'NC'].includes(f.st));
    const a = wpick(p4, t => t.st === 'NC' || t.st === 'GA' || t.st === 'VA' || t.st === 'KY' ? 3 : 1), b = wpick(g6, t => t.st === 'TN' || t.prestige > 60 ? 3 : 1), c = pick(fcs);
    const wks = [1, 2, pick([3, 3, 4, 5])];
    return shuffle([{ o: a.id, home: season % 2 === 0 }, { o: b.id, home: true }, { o: c.id, home: true }]).map((x, i) => Object.assign(x, { wk: wks[i] }));
  };
  DY.weekGames = w => G().sched.filter(x => x.wk === w);
  DY.userGames = w => G().sched.filter(x => (w == null || x.wk === w) && (x.h === G().user || x.a === G().user));
  DY.oppOf = (x, tid) => { tid = tid == null ? G().user : tid; return x.h === tid ? x.a : x.h; };
  DY.teamGames = tid => G().sched.filter(x => x.h === tid || x.a === tid).concat((G().post && G().post.games || []).filter(x => x.h === tid || x.a === tid));

  /* ---------- playing a game and banking the results ---------- */
  const rivalOf = (a, b) => DY.RIVAL_NAME[[tname(a), tname(b)].sort().join('|')] || null;
  DY.gameOpts = x => {
    const A = DY.T(x.h), B = DY.T(x.a);
    const ra = DY.apRank(x.h), rb = DY.apRank(x.a);
    const big = !!(rivalOf(x.h, x.a) || (ra && ra <= 25 && rb && rb <= 25) || (rb && rb <= 15) || (ra && ra <= 10 && x.post) || x.post || x.tag === 'Rivalry Week');
    return { id: x.id, wk: x.wk, neutral: x.neutral, big, rival: rivalOf(x.h, x.a) || x.tag, title: x.title || null, ranks: { h: ra, a: rb }, noInj: !G().settings.injuries };
  };
  DY.startGame = (x, user) => {
    const g = G();
    DY.fixNums(DY.T(x.h)); DY.fixNums(DY.T(x.a));
    const GM = DY.newGame(DY.T(x.h), DY.T(x.a), Object.assign(DY.gameOpts(x), user ? { user: x.h === g.user ? 'h' : 'a', coach: g.settings.coachMode } : {}));
    return GM;
  };
  DY.bankGame = (x, GM) => {
    const g = G();
    x.res = { h: GM.score.h, a: GM.score.a, ot: GM.q >= 5 ? GM.q - 4 : 0 };
    const H = DY.T(x.h), A = DY.T(x.a), hw = GM.score.h > GM.score.a;
    const W = hw ? H : A, Lz = hw ? A : H;
    // stats into players
    for (const id in GM.ps) {
      const p = DY.P(+id); if (!p || +id < 0) continue;
      const s = p.s = p.s || { gp: 0 }, l = GM.ps[id];
      for (const k in l) if (k !== 't') s[k] = (k === 'rlg' || k === 'rclg' || k === 'fglg') ? Math.max(s[k] || 0, l[k]) : (s[k] || 0) + l[k];
    }
    for (const id in GM.snap) { const p = DY.P(+id); if (!p || +id < 0) continue; p.s = p.s || { gp: 0 }; p.s.gp = (p.s.gp || 0) + 1; }
    // game logs for Tennessee players and the user game box
    if (x.h === g.user || x.a === g.user) {
      const opp = x.h === g.user ? A : H, home = x.h === g.user;
      for (const id in GM.ps) { const p = DY.P(+id); if (!p || p.t !== g.user) continue; (p.gl = p.gl || []).push({ y: g.season, w: x.wk, o: opp.abbr, h: home, l: GM.ps[id], r: (home ? hw : !hw) ? 'W' : 'L', sc: home ? GM.score.h + '-' + GM.score.a : GM.score.a + '-' + GM.score.h }); if (p.gl.length > 70) p.gl.shift(); }
      x.box = { ts: GM.ts, ls: GM.lineScore, ps: Object.fromEntries(Object.entries(GM.ps).filter(([id]) => +id > 0)), drives: GM.drives.length, top: DY.topPerf(GM) };
      DY.checkRecords(GM, x);
    } else if (x.post || DY.apRank(x.h) <= 10 || DY.apRank(x.a) <= 10) x.box = { top: DY.topPerf(GM), ls: GM.lineScore };
    // rivalry series (Tennessee) and trophies (everyone)
    {
      const key = [H.name, A.name].sort().join('|');
      if (x.h === g.user || x.a === g.user) {
        const o = x.h === g.user ? A : H, won = (x.h === g.user) === hw;
        const sr = (g.series = g.series || {})[o.name] = g.series[o.name] || { w: 0, l: 0, streak: 0, last: null };
        if (won) { sr.w++; sr.streak = sr.streak > 0 ? sr.streak + 1 : 1; } else { sr.l++; sr.streak = sr.streak < 0 ? sr.streak - 1 : -1; }
        sr.last = g.season;
      }
      const tro = DY.TROPHIES[key];
      if (tro && !x.post) { const tr = (g.trophy = g.trophy || {}); const prev = tr[key]; tr[key] = W.id; if (prev != null && prev !== W.id) DY.news('rival', `${W.name} takes the ${tro}`, `${W.name} ${Math.max(GM.score.h, GM.score.a)}, ${Lz.name} ${Math.min(GM.score.h, GM.score.a)}.`); }
    }
    // records and standings
    if (!x.post || x.post === 'bowl' || x.post) {
      W.w++; Lz.l++;
      if (x.conf && !x.post) { W.cw++; Lz.cl++; }
      W.pf += hw ? GM.score.h : GM.score.a; W.pa += hw ? GM.score.a : GM.score.h;
      Lz.pf += hw ? GM.score.a : GM.score.h; Lz.pa += hw ? GM.score.h : GM.score.a;
    }
    // elo
    if (H.fbs && A.fbs) {
      const eh = H.elo + (x.neutral ? 0 : 55), exp = 1 / (1 + Math.pow(10, (A.elo - eh) / 400));
      const mov = Math.log(Math.abs(GM.score.h - GM.score.a) + 1) * (2.2 / ((hw ? eh - A.elo : A.elo - eh) * 0.001 + 2.2));
      const k = 30 * mov, d = k * ((hw ? 1 : 0) - exp);
      H.elo += d; A.elo -= d;
    } else if (H.fbs && !A.fbs && !hw) { H.elo -= 60; }
    // injuries -> news
    GM.injuries.filter(i => i.wks >= 3).forEach(i => { const p = DY.P(i.id); if (p && p.t === g.user) DY.news('injury', `${p.n} (${p.pos}) out ${i.wks >= 12 ? 'for the season' : i.wks + ' weeks'}`, `${p.n} suffered a ${i.what} against ${(x.h === g.user ? A : H).name}.`, { pid: p.id }); });
    return x.res;
  };
  DY.topPerf = GM => {
    const out = [];
    for (const s of ['h', 'a']) {
      const lines = Object.entries(GM.ps).map(([id, l]) => ({ p: DY.P(+id), l })).filter(x => x.p && x.p.t === GM.T[s].id);
      const best = (k) => lines.filter(x => x.l[k]).sort((a, b) => b.l[k] - a.l[k])[0];
      const qb = best('py'), rb = best('ry'), wr = best('rcy'), df = lines.filter(x => x.l.tk || x.l.sck || x.l.int).sort((a, b) => ((b.l.sck || 0) * 3 + (b.l.int || 0) * 4 + (b.l.tk || 0)) - ((a.l.sck || 0) * 3 + (a.l.int || 0) * 4 + (a.l.tk || 0)))[0];
      out.push({ s, qb: qb && [qb.p.id, `${qb.l.pc || 0}/${qb.l.pa || 0}, ${qb.l.py || 0} yds, ${qb.l.ptd || 0} TD${qb.l.pi ? ', ' + qb.l.pi + ' INT' : ''}`], rb: rb && [rb.p.id, `${rb.l.ra} car, ${rb.l.ry} yds${rb.l.rtd ? ', ' + rb.l.rtd + ' TD' : ''}`], wr: wr && [wr.p.id, `${wr.l.rc} rec, ${wr.l.rcy} yds${wr.l.rctd ? ', ' + wr.l.rctd + ' TD' : ''}`], df: df && [df.p.id, `${df.l.tk || 0} tkl${df.l.sck ? ', ' + df.l.sck + ' sk' : ''}${df.l.int ? ', ' + df.l.int + ' INT' : ''}`] });
    }
    return out;
  };
  /* ---------- Start Today: take over Tennessee this week of the real season ---------- */
  // Tennessee's real results, scores, box-score game logs and season stats come from the site's daily data; every other FBS
  // team's real record comes from DY_TODAY (NCAA standings). Games we don't have (CPU vs CPU) are simulated, then the results are
  // nudged so each team's record matches the real one, and team strength (Elo) is pulled toward what really happened.
  const BOXMAP = { passing: (l, r) => { const [c, a] = String(r[1]).split('/').map(Number); l.pc = (l.pc || 0) + c; l.pa = (l.pa || 0) + a; l.py = (l.py || 0) + +r[2]; l.ptd = (l.ptd || 0) + +r[4]; l.pi = (l.pi || 0) + +r[5]; },
    rushing: (l, r) => { l.ra = (l.ra || 0) + +r[1]; l.ry = (l.ry || 0) + +r[2]; l.rtd = (l.rtd || 0) + +r[4]; l.rlg = Math.max(l.rlg || 0, +r[5] || 0); },
    receiving: (l, r) => { l.rc = (l.rc || 0) + +r[1]; l.rcy = (l.rcy || 0) + +r[2]; l.rctd = (l.rctd || 0) + +r[4]; l.rclg = Math.max(l.rclg || 0, +r[5] || 0); l.tg = (l.tg || 0) + +r[1]; },
    defensive: (l, r) => { l.tk = (l.tk || 0) + +r[1]; l.sck = (l.sck || 0) + +r[3]; l.tfl = (l.tfl || 0) + +r[4]; l.pd = (l.pd || 0) + +r[5]; },
    interceptions: (l, r) => { l.int = (l.int || 0) + +r[1]; },
    kicking: (l, r) => { const [m, a] = String(r[1]).split('/').map(Number), [xm, xa] = String(r[4]).split('/').map(Number); l.fgm = m; l.fga = a; l.xpm = xm; l.xpa = xa; if (m) l.fglg = +r[3]; },
    punting: (l, r) => { l.pn = +r[1]; l.pny = +r[2]; l.i20 = +r[5]; },
    kickReturns: (l, r) => { l.kr = +r[1]; l.kry = +r[2]; },
    puntReturns: (l, r) => { l.pr = +r[1]; l.pry = +r[2]; } };
  function realSeason(ps) {
    const s = { gp: 0 };
    if (ps.pass) { s.pc = ps.pass[0]; s.pa = ps.pass[1]; s.py = ps.pass[2]; s.ptd = ps.pass[3]; s.pi = ps.pass[4]; }
    if (ps.rush) { s.ra = ps.rush[0]; s.ry = ps.rush[1]; s.rlg = ps.rush[3]; s.rtd = ps.rush[4]; }
    if (ps.rec) { s.rc = ps.rec[0]; s.rcy = ps.rec[1]; s.rclg = ps.rec[3]; s.rctd = ps.rec[4]; s.tg = ps.rec[0]; }
    if (ps.def) { s.tk = ps.def.tot; s.tfl = ps.def.tfl; s.sck = ps.def.sacks; s.int = ps.def.int; s.pd = ps.def.pbu; s.ff = ps.def.ff; }
    if (ps.kick) { s.fgm = ps.kick[0]; s.fga = ps.kick[1]; s.xpm = ps.kick[2]; s.xpa = ps.kick[3]; s.fglg = ps.kick[4]; }
    if (ps.punt) { s.pn = ps.punt[0]; s.pny = ps.punt[1]; s.i20 = ps.punt[5] || 0; }
    if (ps.kr) { s.kr = ps.kr[0]; s.kry = ps.kr[1]; }
    if (ps.pr) { s.pr = ps.pr[0]; s.pry = ps.pr[1]; }
    for (const k in s) if (s[k] == null || Number.isNaN(s[k])) delete s[k];
    return s;
  }
  DY.canStartToday = () => { const F = root.SITE_AUTO && root.SITE_AUTO.football; return !!(root.DY_TODAY && F && (F.schedule || []).some(x => x.result)); };
  DY.startToday = () => {
    const g = G(), TD = root.DY_TODAY, F = root.SITE_AUTO && root.SITE_AUTO.football;
    if (!DY.canStartToday()) return 'The current-season data is not available.';
    const played = F.schedule.filter(x => x.result);
    const lastWk = DY.weekOfDate(g.season, played[played.length - 1].date);
    const ut = DY.tnT(), me = DY.userT(), real = {};
    played.forEach(x => { const o = DY.byName(x.opp); if (o) real[o.id] = x; });
    if (DY.autoCamp) DY.autoCamp();
    DY.startSeason();
    const sim0 = {};
    // play the weeks that already happened
    let guard = 0;
    while (g.phase === 'season' && g.week <= lastWk && guard++ < 20) {
      const my = DY.userGames(g.week)[0];
      if (my && !my.res && my.h !== ut.id && my.a !== ut.id) DY.simGame(my);
      const ug = G().sched.find(x => x.wk === g.week && (x.h === ut.id || x.a === ut.id));
      if (ug && !ug.res) {
        DY.simGame(ug);
        const o = ug.h === ut.id ? ug.a : ug.h, rx = real[o];
        if (rx) {
          const home = ug.h === ut.id, simWon = home ? ug.res.h > ug.res.a : ug.res.a > ug.res.h, realWon = rx.result === 'W';
          ug.res = home ? { h: rx.us, a: rx.them, ot: 0 } : { h: rx.them, a: rx.us, ot: 0 };
          ug.real = true; ug.box = null;
          if (simWon !== realWon) { const sr = g.series && g.series[DY.T(o).name]; if (sr) { if (realWon) { sr.w++; sr.l--; sr.streak = 1; } else { sr.l++; sr.w--; sr.streak = -1; } } }
        }
      }
      DY.finishWeek();
    }
    // match every team's record to the real one: flip simulated CPU results where it helps, then set the records
    const done = g.sched.filter(x => x.res && x.wk <= lastWk && !x.post);
    const tgt = {}, cur = {};
    g.teams.forEach(t => { const r = TD.rec[t.name]; if (!r) return; const [o, c] = r.split('|'); const [w, l] = o.split('-').map(Number), [cw, cl] = c.split('-').map(Number); tgt[t.id] = { w, l, cw, cl }; cur[t.id] = 0; sim0[t.id] = t.w; });
    done.forEach(x => { const w = x.res.h > x.res.a ? x.h : x.a; if (cur[w] != null) cur[w]++; });
    for (let pass = 0; pass < 6; pass++) {
      DY.shuffle(done.slice()).forEach(x => {
        if (x.real || x.h === ut.id || x.a === ut.id) return;
        const w = x.res.h > x.res.a ? x.h : x.a, l = w === x.h ? x.a : x.h;
        const ew = cur[w] != null && tgt[w] ? cur[w] - tgt[w].w : 0, el = cur[l] != null && tgt[l] ? cur[l] - tgt[l].w : 0;
        if (ew > 0 && el < 0) { x.res = { h: x.res.a, a: x.res.h, ot: x.res.ot }; cur[w]--; cur[l]++; if (x.box) x.box = null; }
      });
    }
    g.teams.forEach(t => {
      const r = tgt[t.id]; if (!r) return;
      // strength follows the real season: a team that really won more than we simulated gets stronger
      t.elo += (r.w - sim0[t.id]) * 28;
      Object.assign(t, r);
      t.pf = 0; t.pa = 0;
    });
    done.forEach(x => { const H = DY.T(x.h), A = DY.T(x.a); if (H && H.pf != null) { H.pf += x.res.h; H.pa += x.res.a; } if (A && A.pf != null) { A.pf += x.res.a; A.pa += x.res.h; } });
    // the real AP poll
    const ap = (F.team && F.team.apTop25) || [];
    if (ap.length) {
      const ranked = ap.map(([, n]) => DY.byName(n) || g.teams.find(t => t.name.replace(/State$/, 'St.') === n)).filter(t => t && t.fbs !== false && g.teams.includes(t));
      const rest = g.teams.filter(t => !ranked.includes(t)).sort((a, b) => DY.apKey(b) - DY.apKey(a));
      g.polls.ap = ranked.concat(rest).slice(0, 25).map((t, i) => ({ t: t.id, pts: Math.round(1550 - i * 58), fp: 0, prev: null, rec: t.w + '-' + t.l }));
      g.teams.forEach(t => { t.ap = null; }); g.polls.ap.forEach((x, i) => { DY.T(x.t).ap = i + 1; });
    }
    // Tennessee: real season stats and real game logs from the box scores; other teams' players keep simulated stats
    const PS = F.playerStats || {};
    ut.roster.map(DY.P).forEach(p => { p.gl = (p.gl || []).filter(x => x.y !== g.season); p.s = PS[p.n] ? realSeason(PS[p.n]) : null; });
    played.forEach(x => {
      const b = F.box && F.box[x.opp]; if (!b || !b.players || !b.players.TENN) return;
      const lines = {};
      for (const cat in b.players.TENN) { const f = BOXMAP[cat]; if (!f) continue; b.players.TENN[cat].rows.forEach(r => { (lines[r[0]] = lines[r[0]] || {}); f(lines[r[0]], r); }); }
      const o = DY.byName(x.opp), wk = DY.weekOfDate(g.season, x.date);
      for (const n in lines) {
        const p = ut.roster.map(DY.P).find(q => q.n === n); if (!p) continue;
        (p.gl = p.gl || []).push({ y: g.season, w: wk, o: o ? o.abbr : x.opp, h: x.site === 'H', l: lines[n], r: x.result, sc: x.us + '-' + x.them, real: true });
        if (p.s) p.s.gp = (p.s.gp || 0) + 1; else p.s = Object.assign({ gp: 1 }, {});
      }
    });
    // records and news start clean: the real record book, then the first headline of your tenure
    DY.initRecords();
    g.news = [];
    g.startToday = { asOf: TD.asOf, week: lastWk, src: TD.source };
    DY.news('poll', `You take over ${me.name} at ${me.w}-${me.l} (${me.cw}-${me.cl} ${me.conf})`, `${DY.isTN() ? 'The Vols are' : me.name + ' is'} ${me.ap ? 'No. ' + me.ap + ' in the AP poll' : 'unranked'} with ${DY.userGames().filter(x => !x.res && x.wk > lastWk).length} regular-season games left. Records, scores and Tennessee's stats are real through ${DY.dateStr(new Date(played[played.length - 1].date + 'T12:00:00Z'))}.`);
    return null;
  };
  DY.simGame = x => { const GM = DY.startGame(x, false); DY.playFull(GM); DY.bankGame(x, GM); return GM; };

  /* ---------- the week ---------- */
  // after the user's game (if any) is played: everyone else plays, then injuries heal, recruiting and polls move
  DY.finishWeek = () => {
    const g = G(), w = g.week;
    const pend = DY.weekGames(w).filter(x => !x.res);
    pend.forEach(x => DY.simGame(x));
    DY.clearFcs();
    DY.healWeek();
    if (DY.recruitWeek) DY.recruitWeek(w);
    g.teams.forEach(t => DY.refreshDepth(t));
    DY.updatePolls(w);
    DY.weekNews(w);
    g.week++;
    if (g.week > DY.LAST_WK) {
      if (DY.cfpSize() === 24) {
        // no title games: the regular-season leader is the champion (tiebreakers in standings)
        for (const conf in DY.CONF_GAMES) { const st = DY.standings(conf); if (st[0]) { st[0].champ = g.season; st[0].confChamp = (st[0].confChamp || 0) + 1; } }
        g.post = { label: 'Selection', games: [], stage: 'ccg', rounds: [], bowls: [], seeds: [] };
        DY.updatePolls(14); DY.selection();
      } else { g.phase = 'ccg'; DY.setupCCG(); }
    }
  };
  DY.healWeek = () => { const g = G(); g.teams.forEach(t => t.roster.forEach(id => { const p = DY.P(id); if (p.inj) { p.inj.wks--; if (p.inj.wks <= 0) p.inj = null; } })); };
  DY.startSeason = () => {
    const g = G();
    if (g.phase !== 'preseason') return;
    g.phase = 'season'; g.week = Math.min(...g.sched.map(x => x.wk));
    if (g.week < 1 && !DY.userGames(g.week).length) g.week = 1;
  };
  DY.weekLabel = () => {
    const g = G();
    if (g.phase === 'preseason') return `${g.season} preseason`;
    if (g.phase === 'season') return `${g.season} · Week ${g.week} · ${DY.dateStr(DY.weekDate(g.season, g.week))}`;
    if (g.phase === 'ccg') return `${g.season} · Championship Week`;
    if (g.phase === 'post') return `${g.season} · ${g.post.label || 'Postseason'}`;
    if (g.phase === 'offseason') return `${g.season} offseason · ${DY.OFF_LABEL ? DY.OFF_LABEL[g.off.stage] : g.off.stage}`;
    return String(g.season);
  };

  /* ---------- standings ---------- */
  DY.standings = conf => {
    const ts = G().teams.filter(t => t.conf === conf);
    const h2h = (a, b) => { const x = G().sched.find(y => y.res && y.conf && ((y.h === a.id && y.a === b.id) || (y.h === b.id && y.a === a.id))); if (!x) return 0; const aw = (x.h === a.id) === (x.res.h > x.res.a); return aw ? -1 : 1; };
    return ts.sort((a, b) => {
      const pa = a.cw / Math.max(1, a.cw + a.cl), pb = b.cw / Math.max(1, b.cw + b.cl);
      if (pb !== pa) return pb - pa;
      if (b.cw !== a.cw) return b.cw - a.cw;
      const hh = h2h(a, b); if (hh) return hh;
      const oa = a.w / Math.max(1, a.w + a.l), ob = b.w / Math.max(1, b.w + b.l);
      if (ob !== oa) return ob - oa;
      return (DY.cfpKey ? DY.cfpKey(b) - DY.cfpKey(a) : b.elo - a.elo);
    });
  };

  /* ---------- polls ---------- */
  function lossPen(t) {
    let pen = 0, win = 0;
    G().sched.concat(G().post && G().post.games || []).forEach(x => {
      if (!x.res || (x.h !== t.id && x.a !== t.id)) return;
      const me = x.h === t.id, o = DY.T(me ? x.a : x.h), w = me ? x.res.h > x.res.a : x.res.a > x.res.h;
      const oe = o.fbs ? o.elo : 1250, mar = Math.abs(x.res.h - x.res.a);
      if (w) win += o.fbs ? 10 + clamp((oe - 1450) / 9, 0, 26) + Math.min(mar, 28) / 7 : 1;
      else pen += (74 - clamp((oe - 1520) / 5, 0, 42) + Math.min(mar, 28) / 3 + (o.fbs ? 0 : 60)) * (x.post === 'ccg' ? 0.3 : 1);
    });
    return { pen, win };
  }
  DY.apKey = t => {
    const g = G(), lp = lossPen(t), gp = t.w + t.l;
    const pre = t.preElo + (t.prestige - 70) * 2.2;
    const wPre = clamp(1 - gp / 7, 0.12, 1);
    const g6 = DY.P4.includes(t.conf) || t.abbr === 'ND' ? 0 : -48;
    return pre * wPre + (t.elo + lp.win - lp.pen) * (1 - wPre) + g6 - lp.pen * 0.35 * wPre;
  };
  DY.cfpKey = (t, final) => {
    const lp = lossPen(t), g = G();
    let top = 0;
    DY.teamGames(t.id).forEach(x => { if (!x.res) return; const me = x.h === t.id, o = me ? x.a : x.h, w = me ? x.res.h > x.res.a : x.res.a > x.res.h; const r = DY.apRank(o); if (w && r && r <= 25) top += r <= 10 ? 26 : 16; });
    const sos = avgOppElo(t);
    const g6 = DY.P4.includes(t.conf) || t.abbr === 'ND' ? 0 : -70;
    return t.elo * 0.55 + lp.win * 0.9 - lp.pen * 1.15 + top + (sos - 1500) * 0.35 + g6 + (final && t.champ === g.season ? 34 : 0);
  };
  function avgOppElo(t) { const os = DY.teamGames(t.id).filter(x => x.res).map(x => DY.T(DY.oppOf(x, t.id))).map(o => o.fbs ? o.elo : 1250); return os.length ? os.reduce((a, b) => a + b, 0) / os.length : 1500; }
  DY.sos = avgOppElo;
  DY.preseasonPoll = () => {
    const g = G();
    const ranked = g.teams.slice().sort((a, b) => DY.apKey(b) - DY.apKey(a));
    setPoll(ranked, 0);
  };
  function setPoll(ranked, wk) {
    const g = G(), prev = {}; (g.polls.ap || []).forEach((x, i) => prev[x.t] = i + 1);
    g.polls.ap = ranked.slice(0, 25).map((t, i) => ({ t: t.id, pts: Math.round(1550 - i * 58 - (i ? rr(0, 30) : 0)), fp: i === 0 ? ri(38, 62) : i === 1 ? ri(0, 8) : 0, prev: prev[t.id] || null, rec: t.w + '-' + t.l }));
    g.teams.forEach(t => { t.ap = null; }); g.polls.ap.forEach((x, i) => { DY.T(x.t).ap = i + 1; });
    g.polls.hist[g.season + '-' + wk] = g.polls.ap.map(x => x.t);
  }
  DY.apRank = tid => { const t = G().teams[tid]; return t && t.ap || null; };
  DY.cfpRank = tid => { const c = G().polls.cfp; if (!c) return null; const i = c.findIndex(x => x.t === tid); return i >= 0 ? i + 1 : null; };
  DY.updatePolls = wk => {
    const g = G();
    setPoll(g.teams.slice().sort((a, b) => DY.apKey(b) - DY.apKey(a)), wk);
    if (DY.CFP_WEEKS.includes(wk) || wk === 14) {
      const prev = {}; (g.polls.cfp || []).forEach((x, i) => prev[x.t] = i + 1);
      g.polls.cfp = g.teams.slice().sort((a, b) => DY.cfpKey(b, wk === 14) - DY.cfpKey(a, wk === 14)).slice(0, 25).map(t => ({ t: t.id, prev: prev[t.id] || null, rec: t.w + '-' + t.l }));
      g.polls.cfpWeek = wk;
      if (wk === DY.CFP_WEEKS[0]) DY.news('poll', `First College Football Playoff rankings are out`, `${g.polls.cfp.slice(0, 4).map((x, i) => (i + 1) + '. ' + tname(x.t)).join(', ')}. ${DY.UN()} is ${DY.cfpRank(g.user) ? 'No. ' + DY.cfpRank(g.user) : 'outside the top 25'}.`);
    }
  };

  /* ---------- conference championship week ---------- */
  DY.setupCCG = () => {
    const g = G(), games = [];
    for (const conf in DY.CONF_GAMES) {
      const st = DY.standings(conf);
      if (st.length < 4) continue;
      const [a, b] = st;
      games.push({ id: g.season + '-ccg-' + conf, wk: 14, h: a.id, a: b.id, conf: false, neutral: true, post: 'ccg', ccg: conf, title: `${DY.CONF_NAME[conf]} Championship`, res: null });
    }
    g.post = { label: 'Championship Week', games, stage: 'ccg', rounds: [], bowls: [], seeds: [] };
  };
  DY.finishCCG = () => {
    const g = G();
    g.post.games.filter(x => x.post === 'ccg' && !x.res).forEach(x => DY.simGame(x));
    g.post.games.filter(x => x.post === 'ccg').forEach(x => { const w = x.res.h > x.res.a ? x.h : x.a; DY.T(w).champ = g.season; DY.T(w).confChamp = (DY.T(w).confChamp || 0) + 1; });
    DY.clearFcs(); DY.healWeek();
    // independents and conferences too small for a title game: best record wins
    g.teams.forEach(t => DY.refreshDepth(t));
    DY.updatePolls(14);
    DY.selection();
  };

  /* ---------- the playoff ---------- */
  DY.selection = () => {
    const g = G(), size = DY.cfpSize();
    const cfp = g.polls.cfp.map(x => DY.T(x.t));
    const all = g.teams.slice().sort((a, b) => DY.cfpKey(b, true) - DY.cfpKey(a, true));
    const champs = all.filter(t => t.champ === g.season);
    const p4c = champs.filter(t => DY.P4.includes(t.conf));
    const g6c = champs.filter(t => !DY.P4.includes(t.conf)).slice(0, 1);
    // 12 and 24: conference champions get in; 2, 4 and 8: the committee's top teams, period
    const field = size >= 12 ? [...new Set([...p4c, ...g6c])] : [];
    for (const t of all) { if (field.length >= size) break; if (!field.includes(t)) field.push(t); }
    field.sort((a, b) => all.indexOf(a) - all.indexOf(b));
    g.post = { label: 'Selection Day', stage: 'selection', size, seeds: field.map(t => t.id), games: g.post.games, rounds: [], bowls: [] };
    // bowls for the rest of the bowl-eligible teams
    const elig = all.filter(t => t.w >= 6 && !field.includes(t));
    const bowls = [], used = new Set();
    DY.shuffle(DY.BOWLS).forEach(name => {
      const a = elig.find(t => !used.has(t.id)); if (!a) return; used.add(a.id);
      const b = elig.find(t => !used.has(t.id) && t.conf !== a.conf) || elig.find(t => !used.has(t.id)); if (!b) return; used.add(b.id);
      bowls.push({ id: g.season + '-bowl-' + bowls.length, wk: 15, h: a.id, a: b.id, neutral: true, post: 'bowl', title: name, res: null });
    });
    g.post.bowls = bowls;
    const inField = field.findIndex(t => t.id === g.user);
    DY.news('cfp', `Selection Day: ${size}-team playoff field set`, `No. 1 seed ${field[0].name}. ${inField >= 0 ? `${DY.UN()} is the No. ${inField + 1} seed.` : `${DY.UN()} is not in the field${bowls.find(x => x.h === g.user || x.a === g.user) ? ' and is headed to the ' + bowls.find(x => x.h === g.user || x.a === g.user).title : ''}.`}`);
    g.phase = 'post';
    DY.buildRound();
  };
  // the next round's games from the seeds and winners so far
  const winnerOf = x => x.res.h > x.res.a ? x.h : x.a;
  DY.buildRound = () => {
    const g = G(), P = g.post, S = P.seeds, n = P.size, r = P.rounds.length;
    let games = [];
    const site = (a, b, campus, name) => { const sa = S.indexOf(a), sb = S.indexOf(b); const h = sa <= sb ? a : b, aw = h === a ? b : a; return { id: g.season + '-cfp-' + r + '-' + games.length, wk: 15 + r, h, a: aw, neutral: !campus, post: 'cfp', round: r, title: name, res: null }; };
    const prevW = r ? P.rounds[r - 1].map(winnerOf) : [];
    if (n === 2) {
      if (r === 0) games = [site(S[0], S[1], false, 'CFP National Championship')];
    } else if (n === 4) {
      if (r === 0) { const b = DY.shuffle(DY.NY6).slice(0, 2); games = [[0, 3], [1, 2]].map(([a, c], i) => site(S[a], S[c], false, b[i] + ' (CFP Semifinal)')); }
      else if (r === 1) games = [site(prevW[0], prevW[1], false, 'CFP National Championship')];
    } else if (n === 8) {
      if (r === 0) games = [[0, 7], [3, 4], [1, 6], [2, 5]].map(([a, c]) => site(S[a], S[c], true, 'CFP Quarterfinal'));
      else if (r === 1) games = [[0, 1], [2, 3]].map(([a, c], i) => site(prevW[a], prevW[c], false, (i ? 'Cotton Bowl' : 'Orange Bowl') + ' (CFP Semifinal)'));
      else if (r === 2) games = [site(prevW[0], prevW[1], false, 'CFP National Championship')];
    } else if (n === 12) {
      if (r === 0) games = [[4, 11], [7, 8], [5, 10], [6, 9]].map(([a, b]) => site(S[a], S[b], true, 'CFP First Round'));
      else if (r === 1) { const bowls = DY.shuffle(DY.NY6).slice(0, 4); games = [[0, 1], [3, 0], [2, 3], [1, 2]].map(([seed, gi], i) => site(S[seed], prevW[gi], false, bowls[i] + ' (CFP Quarterfinal)')); }
      else if (r === 2) games = [[0, 1], [2, 3]].map(([a, b], i) => site(prevW[a], prevW[b], false, (i ? 'Cotton Bowl' : 'Orange Bowl') + ' (CFP Semifinal)'));
      else if (r === 3) games = [site(prevW[0], prevW[1], false, 'CFP National Championship')];
    } else {
      // first round 9-24 at the higher seed; second round at seeds 1-8 (1 vs 16/17, 8 vs 9/24, 4 vs 13/20, 5 vs 12/21, ...)
      if (r === 0) games = [[15, 16], [8, 23], [12, 19], [11, 20], [14, 17], [9, 22], [13, 18], [10, 21]].map(([a, b]) => site(S[a], S[b], true, 'CFP First Round'));
      else if (r === 1) games = [0, 7, 3, 4, 1, 6, 2, 5].map((seed, i) => site(S[seed], prevW[i], true, 'CFP Second Round'));
      else if (r === 2) { const bowls = DY.shuffle(DY.NY6).slice(0, 4); games = [[0, 1], [2, 3], [4, 5], [6, 7]].map(([a, b], i) => site(prevW[a], prevW[b], false, bowls[i] + ' (CFP Quarterfinal)')); }
      else if (r === 3) games = [[0, 1], [2, 3]].map(([a, b], i) => site(prevW[a], prevW[b], false, (i ? 'Cotton Bowl' : 'Orange Bowl') + ' (CFP Semifinal)'));
      else if (r === 4) games = [site(prevW[0], prevW[1], false, 'CFP National Championship')];
    }
    P.cur = games; P.label = games[0] ? games[0].title.replace(/^.*\(|\)$/g, '').replace(/^(Rose|Sugar|Orange|Cotton|Fiesta|Peach) Bowl /, '') : 'Done';
    if (games[0] && /National Championship/.test(games[0].title)) P.label = 'National Championship';
    P.stage = 'cfp';
  };
  DY.postUserGame = () => {
    const g = G(), P = g.post; if (!P) return null;
    if (P.stage === 'ccg') return P.games.find(x => !x.res && (x.h === g.user || x.a === g.user)) || null;
    if (P.stage === 'cfp') {
      const cg = (P.cur || []).find(x => !x.res && (x.h === g.user || x.a === g.user));
      if (cg) return cg;
      // the user's bowl is played alongside the first playoff round
      if (P.rounds.length === 0) return P.bowls.find(x => !x.res && (x.h === g.user || x.a === g.user)) || null;
    }
    return null;
  };
  DY.finishRound = () => {
    const g = G(), P = g.post;
    if (P.rounds.length === 0) P.bowls.filter(x => !x.res).forEach(x => DY.simGame(x));
    P.cur.filter(x => !x.res).forEach(x => DY.simGame(x));
    DY.clearFcs(); DY.healWeek();
    P.rounds.push(P.cur);
    const last = P.cur.length === 1;
    if (last) {
      const champ = winnerOf(P.cur[0]);
      DY.T(champ).natl = (DY.T(champ).natl || 0) + 1; P.champ = champ;
      DY.news('cfp', `${tname(champ)} wins the national championship`, `${tname(champ)} beat ${tname(P.cur[0].h === champ ? P.cur[0].a : P.cur[0].h)} ${Math.max(P.cur[0].res.h, P.cur[0].res.a)}-${Math.min(P.cur[0].res.h, P.cur[0].res.a)}.`);
      g.teams.forEach(t => DY.refreshDepth(t));
      DY.finalPoll();
      DY.seasonEnd();
      return;
    }
    g.teams.forEach(t => DY.refreshDepth(t));
    DY.buildRound();
  };
  DY.finalPoll = () => {
    const g = G(), P = g.post;
    const order = g.teams.slice().sort((a, b) => DY.apKey(b) - DY.apKey(a) + (b.id === P.champ ? 1e6 : 0) - (a.id === P.champ ? 1e6 : 0));
    // playoff finalists and semifinalists stay near the top
    const deep = {}; P.rounds.forEach((rd, i) => rd.forEach(x => { deep[x.h] = Math.max(deep[x.h] || 0, i + 1); deep[x.a] = Math.max(deep[x.a] || 0, i + 1); }));
    order.sort((a, b) => (DY.apKey(b) + (deep[b.id] || 0) * 30 + (b.id === P.champ ? 1e6 : 0)) - (DY.apKey(a) + (deep[a.id] || 0) * 30 + (a.id === P.champ ? 1e6 : 0)));
    setPoll(order, 99);
  };

  /* ---------- end of season: awards, history, records ---------- */
  DY.seasonEnd = () => {
    const g = G(), ut = DY.userT();
    DY.awards();
    const P = g.post;
    const ug = DY.teamGames(ut.id).filter(x => x.res);
    let finish = 'No bowl';
    const cfpG = P.rounds.flat().filter(x => x.h === ut.id || x.a === ut.id);
    if (P.champ === ut.id) finish = 'National champions';
    else if (cfpG.length) { const lastG = cfpG[cfpG.length - 1]; finish = 'Lost ' + lastG.title.replace(/ \(CFP /, ' (').replace('CFP ', 'CFP '); }
    else { const b = P.bowls.find(x => x.h === ut.id || x.a === ut.id); if (b) finish = ((b.h === ut.id) === (b.res.h > b.res.a) ? 'Won ' : 'Lost ') + b.title; }
    const ccg = (P.games || []).find(x => x.post === 'ccg' && (x.h === ut.id || x.a === ut.id));
    const entry = { y: g.season, w: ut.w, l: ut.l, cw: ut.cw, cl: ut.cl, ap: DY.apRank(ut.id), cfpSeed: P.seeds.indexOf(ut.id) + 1 || null, finish, sec: ut.champ === g.season, ccg: !!ccg,
      champ: tname(P.champ), heis: g.awards[g.season] && g.awards[g.season].heis ? g.awards[g.season].heis.n : null, recRank: g.recruit && g.recruit.classRank || null,
      games: ug.map(x => ({ w: x.wk, o: DY.T(DY.oppOf(x)).abbr, on: tname(DY.oppOf(x)), h: x.h === ut.id, n: x.neutral, us: x.h === ut.id ? x.res.h : x.res.a, th: x.h === ut.id ? x.res.a : x.res.h, t: x.title || null, ot: x.res.ot })) };
    g.hist.push(entry);
    g.coach.w += ut.w; g.coach.l += ut.l;
    g.teams.forEach(t => t.hist.push({ y: g.season, w: t.w, l: t.l, ap: t.ap, champ: t.champ === g.season }));
    DY.updateRecordsSeason();
    g.phase = 'offseason';
    if (DY.startOffseason) DY.startOffseason();
  };

  /* ---------- awards ---------- */
  const fmt = (s, k) => (s && s[k]) || 0;
  DY.awardScore = (p, t) => {
    const s = p.s || {}; if ((s.gp || 0) < 6) return -1;
    const tw = t ? t.w : 6, ovr = p.ovr;
    switch (p.pos) {
      case 'QB': return fmt(s, 'py') / 22 + fmt(s, 'ptd') * 4 - fmt(s, 'pi') * 3 + fmt(s, 'ry') / 12 + fmt(s, 'rtd') * 5 + tw * 3 + ovr * 0.3;
      case 'RB': return fmt(s, 'ry') / 10 + fmt(s, 'rtd') * 6 + fmt(s, 'rcy') / 14 + tw * 1.5 + ovr * 0.3;
      case 'WR': return fmt(s, 'rcy') / 10 + fmt(s, 'rctd') * 6 + fmt(s, 'rc') * 0.6 + ovr * 0.3;
      case 'TE': return fmt(s, 'rcy') / 9 + fmt(s, 'rctd') * 6 + ovr * 0.6;
      case 'OT': case 'IOL': return ovr * 1.25 + tw * 1.5 + (s.gp || 0) * 0.6;
      case 'EDGE': case 'DT': return fmt(s, 'sck') * 6 + fmt(s, 'tfl') * 3 + fmt(s, 'tk') * 0.5 + fmt(s, 'ff') * 4 + ovr * (p.pos === 'DT' ? 0.8 : 0.5);
      case 'LB': return fmt(s, 'tk') * 0.9 + fmt(s, 'tfl') * 2.5 + fmt(s, 'sck') * 4 + fmt(s, 'int') * 6 + ovr * 0.4;
      case 'CB': case 'S': return fmt(s, 'int') * 9 + fmt(s, 'pd') * 3 + fmt(s, 'tk') * 0.5 + fmt(s, 'dtd') * 8 + ovr * 0.5;
      case 'K': return (s.fga || 0) < 8 ? -1 : fmt(s, 'fgm') * 4 - (fmt(s, 'fga') - fmt(s, 'fgm')) * 3 + fmt(s, 'fglg') / 3 + fmt(s, 'xpm') * 0.3 + ovr * 0.4;
      case 'P': return (s.pn || 0) < 15 ? -1 : (fmt(s, 'pny') / s.pn - 40) * 6 + fmt(s, 'i20') * 1.5 + ovr * 0.3;
      default: return -1;
    }
  };
  const AA_SLOTS = [['QB', 1], ['RB', 2], ['WR', 3], ['TE', 1], ['OT', 2], ['IOL', 3], ['EDGE', 2], ['DT', 2], ['LB', 3], ['CB', 2], ['S', 2], ['K', 1], ['P', 1]];
  DY.AWARD_NAME = { HEIS: 'Heisman Trophy', HEISF: 'Heisman finalist', AA1: 'All-American 1st team', AA2: 'All-American 2nd team', FRAA: 'Freshman All-American', SEC1: 'All-SEC 1st team', SEC2: 'All-SEC 2nd team',
    SECO: 'SEC Offensive Player of the Year', SECD: 'SEC Defensive Player of the Year', SECF: 'SEC Freshman of the Year', OBRIEN: 'Davey O\'Brien Award', WALKER: 'Doak Walker Award',
    BILET: 'Biletnikoff Award', MACKEY: 'Mackey Award', OUTLAND: 'Outland Trophy', BEDNARIK: 'Bednarik Award', BUTKUS: 'Butkus Award', THORPE: 'Thorpe Award', GROZA: 'Lou Groza Award', GUY: 'Ray Guy Award' };
  DY.awards = () => {
    const g = G(), y = g.season, A = g.awards[y] = { aa1: [], aa2: [], fraa: [], sec1: [], sec2: [] };
    const all = [];
    g.teams.forEach(t => t.roster.forEach(id => { const p = DY.P(id); const sc = DY.awardScore(p, t); if (sc > 0) all.push({ p, t, sc }); }));
    const give = (p, code) => { p.aw.push({ y, a: code }); };
    const team = (pool, used) => { const out = []; AA_SLOTS.forEach(([pos, n]) => { pool.filter(x => x.p.pos === pos && !used.has(x.p.id)).sort((a, b) => b.sc - a.sc).slice(0, n).forEach(x => { out.push(x.p.id); used.add(x.p.id); }); }); return out; };
    const u1 = new Set(); A.aa1 = team(all, u1); A.aa2 = team(all, u1);
    const fr = all.filter(x => x.p.yr === 1); A.fraa = team(fr, new Set());
    const sec = all.filter(x => x.t.conf === 'SEC'), us = new Set(); A.sec1 = team(sec, us); A.sec2 = team(sec, us);
    A.aa1.forEach(id => give(DY.P(id), 'AA1')); A.aa2.forEach(id => give(DY.P(id), 'AA2')); A.fraa.forEach(id => give(DY.P(id), 'FRAA'));
    A.sec1.forEach(id => give(DY.P(id), 'SEC1')); A.sec2.forEach(id => give(DY.P(id), 'SEC2'));
    // Heisman: quarterbacks and backs on winning teams, with a nod to the playoff
    const hs = all.map(x => ({ x, h: x.sc * ({ QB: 1, RB: 0.92, WR: 0.82, TE: 0.5 }[x.p.pos] || 0.4) + (x.t.ap && x.t.ap <= 4 ? 18 : x.t.ap && x.t.ap <= 12 ? 9 : 0) + (x.t.w - 8) * 5 })).sort((a, b) => b.h - a.h);
    A.heisF = hs.slice(0, 4).map(z => z.x.p.id);
    const H = hs[0].x.p; A.heis = { id: H.id, n: H.n, t: H.t, pos: H.pos };
    give(H, 'HEIS'); A.heisF.slice(1).forEach(id => give(DY.P(id), 'HEISF'));
    const best = (f, code, key) => { const z = all.filter(f).sort((a, b) => b.sc - a.sc)[0]; if (z) { A[key] = z.p.id; give(z.p, code); } };
    best(x => x.p.pos === 'QB', 'OBRIEN', 'obrien'); best(x => x.p.pos === 'RB', 'WALKER', 'walker'); best(x => x.p.pos === 'WR', 'BILET', 'bilet');
    best(x => x.p.pos === 'TE', 'MACKEY', 'mackey'); best(x => x.p.pos === 'OT' || x.p.pos === 'IOL' || x.p.pos === 'DT', 'OUTLAND', 'outland');
    best(x => DY.SIDE(x.p.pos) === 'D', 'BEDNARIK', 'bednarik'); best(x => x.p.pos === 'LB', 'BUTKUS', 'butkus'); best(x => x.p.pos === 'CB' || x.p.pos === 'S', 'THORPE', 'thorpe');
    best(x => x.p.pos === 'K', 'GROZA', 'groza'); best(x => x.p.pos === 'P', 'GUY', 'guy');
    best(x => x.t.conf === 'SEC' && DY.SIDE(x.p.pos) === 'O' && x.p.pos !== 'OT' && x.p.pos !== 'IOL', 'SECO', 'seco');
    best(x => x.t.conf === 'SEC' && DY.SIDE(x.p.pos) === 'D', 'SECD', 'secd');
    best(x => x.t.conf === 'SEC' && x.p.yr === 1, 'SECF', 'secf');
    const ut = DY.userT(), mine = g.teams[g.user].roster.map(DY.P).filter(p => p.aw.some(a => a.y === y));
    DY.news('awards', `${H.n} (${tname(H.t)}) wins the Heisman Trophy`, `${H.pos}. ${DY.UN()} honorees: ${mine.length ? mine.map(p => p.n + ' (' + p.aw.filter(a => a.y === y).map(a => a.a).join(', ') + ')').join('; ') : 'none'}.`, { pid: H.id });
  };

  /* ---------- program records (seeded with the real UT record book) ---------- */
  const REC_MAP = { 'Passing yards': 'py', 'Passing TDs': 'ptd', 'Rushing yards': 'ry', 'Rushing TDs': 'rtd', 'Receptions': 'rc', 'Receiving yards': 'rcy', 'Receiving TDs': 'rctd', 'Tackles': 'tk', 'Sacks': 'sck', 'Interceptions': 'int', 'Field goals': 'fgm' };
  DY.REC_MAP = REC_MAP;
  DY.initRecords = () => {
    const g = G(), R = root.SITE && root.SITE.footballRecords;
    g.rec = { game: {}, season: {}, career: {} };
    // another school: its record book starts blank and fills in as your players set marks
    if (!DY.isTN()) { for (const scope of ['game', 'season', 'career']) for (const name in REC_MAP) g.rec[scope][REC_MAP[name]] = { v: 0, n: '—', y: '', note: '', real: true, blank: true }; return; }
    for (const scope of ['game', 'season', 'career']) (R && R[scope] || []).forEach(r => { const k = REC_MAP[r[0]]; if (k) g.rec[scope][k] = { v: r[2], n: r[1], y: r[3], note: r[4] || '', real: true }; });
  };
  DY.checkRecords = (GM, x) => {
    const g = G();
    for (const id in GM.ps) {
      const p = DY.P(+id); if (!p || p.t !== g.user) continue; const l = GM.ps[id];
      for (const name in REC_MAP) {
        const k = REC_MAP[name], sv = p.s && p.s[k], cs = g.rec.season[k];
        if (sv && cs && sv > cs.v && cs.pid !== p.id) { g.rec.season[k] = { v: sv, n: p.n, y: String(g.season), pid: p.id, prev: cs.n }; DY.news('record', `${p.n} breaks ${DY.UN()}'s season record`, `${sv} ${name.toLowerCase()} and counting, passing ${cs.n} (${cs.v}).`, { pid: p.id }); }
        else if (sv && cs && cs.pid === p.id && sv > cs.v) cs.v = sv;
        const cv = DY.careerTotal(p, k, true), cc = g.rec.career[k];
        if (cv && cc && cv > cc.v && cc.pid !== p.id) { g.rec.career[k] = { v: cv, n: p.n, y: (p.firstY || g.season) + '–' + g.season, pid: p.id, prev: cc.n }; DY.news('record', `${p.n} is ${DY.UN()}'s all-time leader in ${name.toLowerCase()}`, `${cv} career ${name.toLowerCase()}, passing ${cc.n} (${cc.v}).`, { pid: p.id }); if (!cc.blank) GM.recBroke = (GM.recBroke || []).concat(`${p.n}: ${DY.UN()}'s career ${name.toLowerCase()} record (${cv})`); }
        else if (cv && cc && cc.pid === p.id && cv > cc.v) cc.v = cv;
      }
      for (const name in REC_MAP) { const k = REC_MAP[name], cur = g.rec.game[k]; if (l[k] && cur && l[k] > cur.v) { g.rec.game[k] = { v: l[k], n: p.n, y: String(g.season), note: 'vs. ' + DY.T(DY.oppOf(x)).name, pid: p.id, prev: cur.n }; DY.news('record', `${p.n} sets a ${DY.UN()} single-game record`, `${l[k]} ${name.toLowerCase()} against ${DY.T(DY.oppOf(x)).name}, passing ${cur.n} (${cur.v}).`, { pid: p.id }); } }
    }
  };
  DY.updateRecordsSeason = () => {
    const g = G(), ut = DY.userT();
    ut.roster.map(DY.P).forEach(p => {
      for (const name in REC_MAP) {
        const k = REC_MAP[name];
        const v = p.s && p.s[k], cur = g.rec.season[k];
        if (v && cur && cur.pid === p.id) { if (v > cur.v) cur.v = v; }
        else if (v && cur && v > cur.v) { g.rec.season[k] = { v, n: p.n, y: String(g.season), pid: p.id, prev: cur.n }; DY.news('record', `${p.n} breaks a ${DY.UN()} season record`, `${v} ${name.toLowerCase()}, passing ${cur.n} (${cur.v}).`, { pid: p.id }); }
        const cv = DY.careerTotal(p, k, true), cc = g.rec.career[k];
        if (cv && cc && cc.pid === p.id) { if (cv > cc.v) { cc.v = cv; cc.y = (p.firstY || g.season) + '–' + g.season; } }
        else if (cv && cc && cv > cc.v) { g.rec.career[k] = { v: cv, n: p.n, y: (p.firstY || g.season) + '–' + g.season, pid: p.id, prev: cc.n }; }
      }
    });
  };
  DY.careerTotal = (p, k, incl) => { let v = 0; for (const y in p.car) v += p.car[y][k] || 0; if (incl && p.s) v += p.s[k] || 0; return v; };

  /* ---------- news ---------- */
  DY.news = (type, h, b, extra) => { const g = G(); if (type === 'record' && /— \(0\)|passing — /.test(b || '')) return; g.news.unshift(Object.assign({ type, h, b, y: g.season, w: g.week, ph: g.phase }, extra || {})); if (g.news.length > 160) g.news.length = 160; };
  DY.weekNews = w => {
    const g = G(), ut = DY.userT();
    // upsets of top-10 teams
    DY.weekGames(w).filter(x => x.res).forEach(x => {
      const hw = x.res.h > x.res.a, L0 = hw ? x.a : x.h, W0 = hw ? x.h : x.a;
      const lr = (g.polls.hist[g.season + '-' + (w - 1)] || g.polls.hist[g.season + '-0'] || []).indexOf(L0) + 1;
      const wr = (g.polls.hist[g.season + '-' + (w - 1)] || []).indexOf(W0) + 1;
      if (lr && lr <= 10 && (!wr || wr > lr + 8) && L0 !== g.user && W0 !== g.user) DY.news('upset', `UPSET: ${wr ? 'No. ' + wr + ' ' : ''}${tname(W0)} knocks off No. ${lr} ${tname(L0)}`, `${tname(W0)} ${Math.max(x.res.h, x.res.a)}, ${tname(L0)} ${Math.min(x.res.h, x.res.a)}.`);
    });
    const r = DY.apRank(ut.id);
    const prev = (g.polls.hist[g.season + '-' + (w - 1)] || []).indexOf(ut.id) + 1;
    if (r !== (prev || null)) DY.news('poll', r ? `${DY.UN()} ${prev ? (r < prev ? 'climbs' : 'slides') + ' to' : 'enters the poll at'} No. ${r}` : `${DY.UN()} drops out of the AP Top 25`, `AP Top 5: ${g.polls.ap.slice(0, 5).map((x, i) => (i + 1) + '. ' + tname(x.t)).join(', ')}.`);
  };
})(typeof window !== 'undefined' ? window : globalThis);
