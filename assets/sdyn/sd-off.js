/* The Vol Index — Hoops and Diamond Dynasty: recruiting and the offseason. Recruiting through the season (a board, weekly
   hours, calls, head-coach visits, official visits to home games, NIL promises; other programs recruit the same kids),
   then the offseason stages: season recap with early draft decisions (and your one pitch to keep a player), NIL and
   budget, the transfer portal, signing day, the pro draft, player development, roster limit and next season's schedule. */
(function (root) {
  'use strict';
  const SD = root.SD;
  const { clamp, chance, rr, ri, pick, gauss } = SD;
  const G = () => SD.G;
  const T = id => SD.T(id);

  /* ---------- recruiting ---------- */
  SD.CLASS = { mbb: 4, wbb: 4, baseball: 13, softball: 8 };
  SD.HOURS = () => 40;
  SD.MAXC = () => ({ mbb: 7, wbb: 7, baseball: 15, softball: 10 })[G().sport] || 7;   // the most commits a class can hold
  SD.ACTIONS = { dm: { name: 'Social media', hrs: 1, pts: 4 }, call: { name: 'Phone call', hrs: 3, pts: 12 }, coach: { name: 'Head coach visit', hrs: 7, pts: 30 }, scout: { name: 'Scout', hrs: 1, pts: 0 } };
  const posPool = () => SD.kind() === 'hoops' ? ['PG', 'SG', 'SF', 'PF', 'C'] : G().sport === 'softball' ? ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'SP', 'SP', 'RP'] : ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'SP', 'SP', 'SP', 'RP', 'RP', 'RP'];
  SD.CPU_PUSH = 1.1; SD.REAL_STICK = 0.88; SD.REAL_PULL = 3;   // CPU recruiting drive, and how strongly a real recruit's real school pulls
  SD.PROS_BASE = 64;   // freshman rating at a .80 composite (tuned so league talent holds steady season to season)
  function prospect(year, rank, n) {
    // national rank -> composite: No. 1 about .9999, No. 25 about .985 (five-stars), No. 150 about .93
    // past the top n prospects the composite keeps sliding gently (2-stars and walk-on level), never below .66
    // 247-style shape: about 25 five-stars (.984+), the 4-star band through roughly No. 190, three-stars below that
    const curve = r => r <= 25 ? 0.9999 - (r - 1) * 0.00066 : r <= 150 ? 0.9835 - (r - 25) / 125 * 0.083 : 0.9005 - (r - 150) / Math.max(1, n - 150) * 0.10;
    const c = rank <= n ? clamp(curve(rank) - rr(0, 0.003), 0.7, 0.9999) : clamp(0.7 - (rank - n) / n * 0.03 - rr(0, 0.004), 0.66, 0.7), g = c * 100;
    const pos = pick(posPool());
    const ovr = Math.round(clamp(SD.PROS_BASE + (g - 80) * 0.7 + Math.max(0, g - 95) * 1.2 + gauss() * 2.5, 50, 84));
    const p = SD.makePlayer(pos, ovr, { t: null, yr: 1, el: SD.kind() === 'hoops' ? 5 : 4, grade: g, rec: { c, stars: SD.starsOf(c), g, natl: rank, cls: year } });
    p.pros = true; p.interest = {}; p.commit = null; p.offer = false; p.acts = {}; p.visit = null; p.visited = false; p.nilOffer = 0; p.scout = 0;
    p.pref = SD.shuffle(['pt', 'champ', 'prox', 'brand', 'dev'].concat(SD.nilOn() ? ['nil'] : [])).slice(0, 3);
    // a few programs start interested
    const g0 = G(); for (let i = 0; i < 10; i++) { const t = SD.wpick(g0.teams, t => Math.pow(t.prestige / 60, 2.5 + p.rec.stars * 0.6)); p.interest[t.id] = rr(0, 30) * (t.prestige / 80); }
    return p;
  }
  SD.initRecruiting = first => {
    const g = G(), year = SD.kind() === 'hoops' ? g.season + 1 : g.season + 1;
    // enough prospects for every program to fill its class; the top of the board keeps the same shape (n0), the rest is a deeper tail
    const n0 = SD.kind() === 'hoops' ? 380 : 700, per = { mbb: 4.6, wbb: 4.6, baseball: 10.5, softball: 7.8 }[g.sport] || 5;
    const n = Math.max(n0, Math.round(g.teams.length * per));
    const pool = {};
    for (let i = 1; i <= n; i++) { const p = prospect(year, i, n0); pool[p.id] = p; }
    if (g.hx && SD.histClass) SD.histClass(year, pool);
    g.recruit = { year, pool, board: [], log: [], signed: false, classRank: null };
    // the real commitments for next year's class
    const R = root.RECRUITING && root.RECRUITING[g.sport];
    if (first && R && R.commits) R.commits.forEach(c => {
      const pos = SD.kind() === 'hoops' ? (/wing|SF|forward/i.test(c.pos) ? 'SF' : /PG|point/i.test(c.pos) ? 'PG' : /C|center|post/i.test(c.pos) ? 'C' : 'SG') : /RHP|LHP|P\b/.test(c.pos) ? 'SP' : /C\b/.test(c.pos) ? 'C' : /OF/.test(c.pos) ? 'CF' : 'SS';
      const st = /5-star/.test(c.rank) ? 5 : /4-star|No\. [1-9]\d?\b/.test(c.rank) ? 4 : 3, comp = st === 5 ? 0.99 : st === 4 ? 0.95 : 0.89;
      const p = prospect(year, Math.round((1 - comp) * 1000), n); p.n = c.name; SD.reposition(p, pos); p.rec.c = comp; p.rec.stars = st; p.commit = SD.tnT().id; p.firm = true; p.real = true; p.home = c.from || p.home;
      SD.setOvr(p); pool[p.id] = p;
    });
    // real Tennessee commits do not hand themselves over: pursue them (board + offer, or let the assistant run it) and they always commit
    if (SD.tnT && g.user === SD.tnT().id) Object.values(pool).forEach(p => { if (p.real && p.commit === g.user) { p.realUT = true; p.commit = null; p.firm = false; p.offer = false; p.interest[g.user] = 40; } });
  };
  // "interested in us": we are among his top schools and he is actually warm on us (or we have him on the board with an offer)
  SD.interested = p => { const g = G(), me = p.interest[g.user] || 0; if (p.commit != null) return p.commit === g.user; if (p.realUT || p.offer) return true; if (me < 10) return false; const above = Object.values(p.interest).filter(v => v > me).length; return above < 5; };
  SD.rankClasses = () => rankClasses();
  // before anyone commits (period 1), a projection: each uncommitted prospect counts for the school he currently leans toward
  SD.projectedClasses = () => {
    const R = G().recruit, pts = {}, n = {};
    Object.values(R.pool).forEach(p => { let t = p.commit; if (t == null) { const e = Object.entries(p.interest).sort((a, b) => b[1] - a[1])[0]; if (!e || e[1] < 8) return; t = +e[0]; } pts[t] = (pts[t] || 0) + Math.pow(p.rec.c * 100 - 70, 2); n[t] = (n[t] || 0) + 1; });
    return Object.entries(pts).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ t: +t, v, n: n[t] }));
  };
  SD.myCommits = () => Object.values(G().recruit.pool).filter(p => p.commit === G().user);
  SD.boardAdd = id => { const R = G().recruit; if (R.board.includes(id)) return null; if (R.board.length >= 20) return 'Your board is full (20).'; R.board.push(id); const p = R.pool[id]; if (p.interest[G().user] == null) p.interest[G().user] = 0; return null; };
  SD.boardRemove = id => { const R = G().recruit; R.board = R.board.filter(x => x !== id); };
  // Remove a commit (a pick the assistant made that you do not want). He is released and stays out of your class until you re-add him, which makes him a
  // commit again if nobody else has landed him and you have a spot.
  SD.releaseCommit = id => {
    const g = G(), R = g.recruit, p = R.pool[id]; if (!p || p.commit !== g.user) return 'He is not one of your commits.'; if (R.signed) return 'Signing day has passed.';
    p.commit = null; p.firm = false; p.dropped = true; p.acts = {}; p.interest[g.user] = 0; p.offer = false; p.visit = null;
    R.board = R.board.filter(x => x !== id); R.removed = (R.removed || []).filter(x => x !== id).concat(id);
    R.log = [`You removed ${p.n} from your class.`].concat(R.log || []); return `${p.n} removed from your class.`;
  };
  SD.readdCommit = id => {
    const g = G(), R = g.recruit, p = R.pool[id]; if (!p || !p.dropped) return null;
    if (p.commit != null) return `${p.n} has already committed to ${T(p.commit).name}.`; if (R.signed) return 'Signing day has passed.';
    if (SD.myCommits().length >= SD.MAXC()) return 'Your class is full.';
    p.commit = g.user; p.cwk = 99; p.firm = !!p.realUT; p.dropped = false; p.offer = true; p.interest[g.user] = Math.max(200, p.interest[g.user] || 0);
    R.removed = (R.removed || []).filter(x => x !== id); R.log = [`COMMIT: ${p.n} is back in your class.`].concat(R.log || []); return `${p.n} is a commit again.`;
  };
  SD.hoursUsed = () => { const R = G().recruit; let h = 0; R.board.forEach(id => { const p = R.pool[id]; for (const a in p.acts) h += SD.ACTIONS[a].hrs; }); return h; };
  SD.setAct = (id, act, on) => {
    const p = G().recruit.pool[id]; if (!p) return 'Not found.';
    if (p.firm && p.commit !== G().user) return `${p.n} is locked in with ${T(p.commit).name}.`;
    if (on && act === 'scout' && (p.scout || 0) >= 3) return 'Fully scouted.';
    if (on) { if (act === 'coach' && Object.values(G().recruit.pool).filter(x => x.acts.coach).length >= 3) return 'Three head coach visits a week.'; if (SD.hoursUsed() + SD.ACTIONS[act].hrs > SD.HOURS()) return 'Not enough hours left this week.'; p.acts[act] = 1; }
    else delete p.acts[act];
    return null;
  };
  SD.offer = id => { const p = G().recruit.pool[id]; const n = Object.values(G().recruit.pool).filter(x => x.offer).length; if (n >= SD.CLASS[G().sport] * 4) return 'That is enough offers out.'; p.offer = true; return null; };
  SD.setVisit = (id, d) => { const g = G(), p = g.recruit.pool[id]; const x = SD.userGames().find(y => y.d === d && y.h === g.user && !y.res); if (!x) return 'Official visits are for home games.'; if (Object.values(g.recruit.pool).filter(q => q.visit === d).length >= 4) return 'Four visitors a game is the limit.'; p.visit = d; return null; };
  // On full auto the program holds the standing it started with: the assistant works harder when the program has slipped below its starting rank and eases off
  // when it has climbed above it, so results still drift with how the simulation goes.
  SD.AUTO_HOLD = 0.8;
  SD.prestigeRank = t => 1 + G().teams.filter(x => !x.dorm && x.prestige > t.prestige).length;
  // roster-strength rank, cached per season and smoothed (prestige does not move in these sports, so the roster is the signal)
  SD.ovrRank = t => { const g = G(), k = g.season + ':' + g.phase; if (!g._ovrRk || g._ovrRk.k !== k) { const m = {}; g.teams.filter(x => !x.dorm && x.roster && x.roster.length).map(x => [x.id, SD.teamRating(x)]).sort((a, b) => b[1] - a[1]).forEach((x, i) => { m[x[0]] = i + 1; }); g._ovrRk = { k, m }; } return g._ovrRk.m[t.id] || 150; };
  SD.autoEff = () => {
    const g = G(), ut = SD.userT(); if (!g || !ut) return 1;
    const now = SD.ovrRank(ut); if (g.autoRank == null) { g.autoRank = now; g.autoSm = now; }
    if (g.autoSmK !== g.season) { g.autoSmK = g.season; g.autoSm = Math.exp(0.5 * Math.log(g.autoSm) + 0.5 * Math.log(now)); }
    return clamp(1 + SD.AUTO_HOLD * Math.log(g.autoSm / g.autoRank), 0.3, 1.5);
  };
  SD.recruitWeek = () => {
    const g = G(), R = g.recruit; if (!R || R.signed) return;
    const ut = SD.userT(), mode = g.settings.recruiting, full = SD.myCommits().length >= SD.MAXC();
    if (mode === 'auto') autoRecruit();
    const logs = [];
    if (mode !== 'off') R.board.forEach(id => {
      const p = R.pool[id]; if (!p) return;
      let pts = 0; for (const a in p.acts) { if (a === 'scout') { p.scout = Math.min(3, (p.scout || 0) + 1); continue; } pts += SD.ACTIONS[a].pts; } if (p.offer) pts += 3;
      if (p.nilOffer) pts += Math.min(22, p.nilOffer / Math.max(15000, SD.nilValue(p, ut)) * 9) * (p.pref.includes('nil') ? 1.5 : 0.8);
      // an official visit this week
      if (p.visit && p.visit <= g.date && !p.visited) { const x = SD.userGames().find(y => y.d === p.visit); const won = x && x.res && ((x.h === ut.id) === (x.res.h > x.res.a)); pts += won ? 50 : 18; p.visited = true; logs.push(`${p.n} (${p.rec.stars}★ ${p.pos}) took an official visit${won ? ' and saw a win' : ''}.`); }
      pts = 70 * (1 - Math.exp(-pts / 70));
      if (pts > 0) p.interest[ut.id] = (p.interest[ut.id] || 0) + pts * (0.45 + fitScore(ut, p) * 0.9) * (p.offer ? 1 : 0.5) * SD.recruitMult() * (mode === 'auto' ? SD.autoEff() : 1) * (window.MORALE ? MORALE.recruitMult(g, p.rpromise, p.rec.stars) : 1);
    });
    // a CPU program only has so many scholarships: a class tops out at the same size as yours, and no school stacks the top of the board
    const cnt = {}, hi = {}, CAP = SD.MAXC(), CAP4 = Math.max(2, Math.round(CAP * 0.55));
    Object.values(R.pool).forEach(q => { if (q.commit != null) { cnt[q.commit] = (cnt[q.commit] || 0) + 1; if (q.rec.stars >= 4) hi[q.commit] = (hi[q.commit] || 0) + 1; } });
    const open = (tid, p) => +tid === g.user || ((cnt[tid] || 0) < CAP && (p.rec.stars < 4 || (hi[tid] || 0) < CAP4) && (p.rec.stars < 5 || (hi[tid] || 0) < CAP4));
    Object.values(R.pool).forEach(p => {
      if (p.commit != null && p.commit !== ut.id && p.acts) p.acts = {}; else if (p.acts) delete p.acts.scout;   // a scouting report is one-time
      if (p.commit != null && p.firm) return;
      for (const tid in p.interest) { const t = g.teams[tid]; if (!t || t.user || +tid === g.user) continue; const heat = (p.rec.stars >= 4 ? 1 + Math.max(0, t.prestige - 75) / 50 : 1) * SD.CPU_PUSH;
        // a real recruit's real school is his default first option (he sticks about 88% of the time), unless the school never pushes him
        let rs = 1; if (p.realSchool != null) { if (p.stick == null) p.stick = chance(SD.REAL_STICK); rs = +tid === p.realSchool ? (p.stick ? SD.REAL_PULL : 1) : (p.stick ? 0.7 : 1); }
        p.interest[tid] += (3 + t.prestige / 10) * (0.5 + fitScore(t, p)) * rr(0.3, 1.4) * heat * rs; }
      if (p.realUT && p.commit == null && !p.dropped && ut.id === g.user && R.board.includes(p.id) && p.offer && !full) {
        p.commit = g.user; p.cwk = weekNo(); p.cper = SD.period().n; p.firm = true; logs.push(`COMMIT: ${p.n}, ${p.rec.stars}★ ${p.pos}, commits to ${SD.UN()}!`); SD.news('commit', `${p.rec.stars}-star ${p.pos} ${p.n} commits to ${SD.UN()}`, 'A real Tennessee commit, landed.'); return;
      }
      const order = Object.entries(p.interest).sort((a, b) => b[1] - a[1]).filter(([tid]) => open(tid, p) || +tid === p.commit); if (!order.length) return;
      const [lead, lv] = order[0], second = order[1] ? order[1][1] : 0, isMe = +lead === g.user;
      const need = (130 + p.rec.stars * 15) * (1 - Math.min(20, weekNo()) / 34);
      const per = SD.period().n, early = per === 1 ? 99 : per === 2 ? 1.25 : 1;
      if (p.commit == null && !(p.realUT && SD.period().n < 3 && !isMe) && lv >= need * early && lv >= second * (per === 2 ? 1.35 : 1.15) && (!isMe || (p.offer && !full && (p.rec.stars < 4 || p.visited || weekNo() >= 14)))) {
        p.commit = +lead; p.cwk = weekNo(); p.cper = per; if (per <= 2) p.early = true; cnt[+lead] = (cnt[+lead] || 0) + 1; if (p.rec.stars >= 4) hi[+lead] = (hi[+lead] || 0) + 1;
        if (isMe) { logs.push(`COMMIT: ${p.n}, ${p.rec.stars}★ ${p.pos}, commits to ${SD.UN()}!`); SD.news('commit', `${p.rec.stars}-star ${p.pos} ${p.n} commits to ${SD.UN()}`, `No. ${p.rec.natl} nationally.`); }
      } else if (p.commit != null && !p.firm && weekNo() - (p.cwk || 0) < 5 && !(p.commit === g.user && p.visited) && +lead !== p.commit && lv >= (p.interest[p.commit] || 0) * 1.35 && (!isMe || p.offer)) {
        const was = p.commit; p.commit = +lead; cnt[was]--; if (p.rec.stars >= 4) hi[was]--; cnt[+lead] = (cnt[+lead] || 0) + 1; if (p.rec.stars >= 4) hi[+lead] = (hi[+lead] || 0) + 1;
        if (isMe) logs.push(`FLIP: ${p.n} flips to ${SD.UN()}!`); else if (was === g.user) logs.push(`DECOMMIT: ${p.n} flips to ${T(+lead).name}.`);
      }
    });
    R.log = logs.concat(R.log).slice(0, 50);
    rankClasses();
  };
  // five recruiting periods over the season; commitments open up after period 1 (early commits in period 2 need a clear lead)
  SD.PERIOD_NAMES = ['Summer and fall evaluation', 'Early signing window', 'Conference play', 'Postseason stretch', 'Final push'];
  SD.period = () => { const w = weekNo(), B = [0, 4, 8, 12, 17]; let n = 0; B.forEach((b, i) => { if (w >= b) n = i + 1; }); return { n, name: SD.PERIOD_NAMES[n - 1], wk: w, next: B[n] != null ? B[n] - w : null }; };
  function weekNo() { const g = G(); return Math.max(0, Math.round((Date.parse(g.date) - Date.parse(SD.dateOf(SD.SP().start))) / (7 * 864e5))); }
  function fitScore(t, p) {
    let f = 0.35;
    p.pref.forEach((k, i) => { const w = [0.38, 0.25, 0.15][i]; const v = k === 'pt' ? clamp(1 - (t.roster.map(SD.P).filter(x => x.pos === p.pos && x.el > 1 && x.ovr > p.ovr + 6).length) / 3, 0.1, 1) : k === 'nil' ? clamp(t.budget / SD.budgetFor({ prestige: 95 }), 0.1, 1) : k === 'champ' ? clamp((t.elo - 1350) / 400, 0.1, 1) : k === 'prox' ? (t.st === (p.st || p.home.split(', ')[1]) ? 1 : 0.4) : k === 'brand' ? clamp(t.prestige / 95, 0.2, 1) : clamp(0.5 + (t.prestige - 60) / 80, 0.2, 1); f += v * w; });
    return f;
  }
  function autoRecruit() {
    const g = G(), R = g.recruit, ut = SD.userT();
    // open spots next season: the limit minus players coming back (seniors leave), capped by the class size
    const back = ut.roster.map(SD.P).filter(p => p.el > 1).length;
    const room = Math.min(SD.MAXC(), Math.max(1, SD.LIMIT[g.sport] - back + 1)) - SD.myCommits().length; if (room <= 0) return;
    // auto never takes anyone off your board: your own targets stay and are worked first; it only adds names to fill the board
    Object.values(R.pool).filter(p => p.realUT && p.commit == null && !p.dropped && !R.board.includes(p.id)).forEach(p => { if (R.board.length < 20) R.board.push(p.id); p.offer = true; });
    const mine = p => (p.interest[ut.id] || 0), top = p => Math.max(0, ...Object.entries(p.interest).filter(([t]) => +t !== ut.id).map(([, v]) => v));
    const winnable = p => Math.min(1.2, (mine(p) + 12) / (top(p) + 12));
    const late = Math.min(1, Math.max(0, (SD.period().n - 2) / 3));
    const score = p => p.rec.c * 60 * (1 - late * 0.5) + winnable(p) * (45 + late * 40) + fitScore(ut, p) * 10;
    const active = () => R.board.map(id => R.pool[id]).filter(p => p && (p.commit == null)).length;
    const want = Math.min(20, Math.max(8, room * 3 + SD.period().n * 2));
    Object.values(R.pool).filter(p => p.commit == null && !p.dropped && !R.board.includes(p.id)).sort((a, b) => score(b) - score(a)).slice(0, Math.max(0, Math.min(20 - R.board.length, want - active()))).forEach(p => R.board.push(p.id));
    const cand = R.board.map(id => R.pool[id]).filter(p => p && p.commit == null);
    let hrs = SD.HOURS(), coach = 3;
    cand.forEach(p => { p.acts = {}; p.offer = true; });
    cand.forEach(p => { if (hrs >= 1) { p.acts.dm = 1; hrs -= 1; } });
    const leads = p => mine(p) >= top(p);
    const ranked = cand.slice().sort((a, b) => ((leads(b) ? 2 : 0) + winnable(b) + b.rec.c * 0.4) - ((leads(a) ? 2 : 0) + winnable(a) + a.rec.c * 0.4));
    ranked.forEach(p => { if (coach > 0 && hrs >= 6 && p.rec.stars >= 4 && winnable(p) >= 0.45) { delete p.acts.dm; p.acts.coach = 1; hrs -= 6; coach--; } });
    ranked.forEach(p => { if (!p.acts.coach && hrs >= 2 && winnable(p) >= 0.35) { delete p.acts.dm; p.acts.call = 1; hrs -= 2; } });
    for (let pass = 0; pass < 4 && hrs > 3; pass++) ranked.forEach(p => { if (hrs <= 3) return; if (!p.acts.call && hrs >= SD.ACTIONS.call.hrs) { p.acts.call = 1; hrs -= SD.ACTIONS.call.hrs; } else if (!p.acts.dm && hrs >= 1) { p.acts.dm = 1; hrs -= 1; } else if (!p.acts.coach && coach > 0 && hrs >= SD.ACTIONS.coach.hrs) { p.acts.coach = 1; hrs -= SD.ACTIONS.coach.hrs; coach--; } });
    const home = SD.userGames().filter(x => x.h === ut.id && !x.neutral && !x.res && x.d > g.date);
    if (home.length) ranked.filter(p => !p.visit && (p.rec.stars >= 4 || leads(p))).slice(0, 8).forEach((p, i) => { SD.setVisit(p.id, home[i % home.length].d); });
    // the final period: settle the class with the best prospects still open that this board has been working
    if (SD.period().n >= 5 && room > 0) ranked.filter(p => p.commit == null && !p.dropped).sort((a, b) => (mine(b) + b.rec.c * 40) - (mine(a) + a.rec.c * 40)).slice(0, room).forEach(p => { p.commit = ut.id; p.cwk = 99; p.cper = 5; });
  }
  function rankClasses() {
    const g = G(), R = g.recruit, pts = {}, cs = {};
    Object.values(R.pool).forEach(p => { if (p.commit == null) return; pts[p.commit] = (pts[p.commit] || 0) + Math.pow(p.rec.c * 100 - 70, 2); const c = cs[p.commit] = cs[p.commit] || { 5: 0, 4: 0, 3: 0, n: 0 }; c.n++; if (p.rec.stars >= 3) c[Math.min(5, p.rec.stars)]++; });
    R.cstars = cs;
    const order = Object.entries(pts).sort((a, b) => b[1] - a[1]).map(x => +x[0]);
    R.classRank = order.indexOf(g.user) + 1 || null; R.order = order;
  }

  /* ---------- the offseason ---------- */
  const OFF_ALL = ['recap', 'nil', 'portal', 'signing', 'draft', 'progress', 'cuts', 'schedule'];
  // the transfer portal opened in October 2018 and NIL began in July 2021: a historical dynasty has neither before then
  SD.portalOn = () => { const g = G(); return !(g && g.hx && g.season < 2018); };
  SD.nilOn = () => { const g = G(); return !(g && g.hx && g.season < 2021); };
  Object.defineProperty(SD, 'OFF_ORDER', { get: () => OFF_ALL.filter(x => (x !== 'nil' || SD.nilOn()) && (x !== 'portal' || SD.portalOn())) });
  // never drop a player who played for your school, won an award or was drafted: the legacy board, records and search all need him
  SD.keepPlayer = p => { const ut = SD.userT(); return p.t0 === ut.id || (p.aw && p.aw.length > 0) || !!p.draft || Object.values(p.car || {}).some(x => x && (x.t === ut.abbr || (x.t === 'TENN' && ut.name === 'Tennessee') && +x.y !== 0)); };
  SD.OFF_LABEL = { recap: 'Season recap', nil: 'NIL & budget', portal: 'Transfer portal', signing: 'Signing day', draft: 'Pro draft', progress: 'Player development', cuts: 'Roster limit', schedule: 'Next season' };
  SD.LIMIT = { mbb: 15, wbb: 15, baseball: 34, softball: 25 };
  SD.startOffseason = () => {
    const g = G(), ut = SD.userT(), hoops = SD.kind() === 'hoops';
    g.off = { stage: 'recap', leaving: [], pitched: {}, nilAsk: [], cut: [] };
    // eligibility, early entries
    g.teams.forEach(t => t.roster.forEach(id => {
      const p = SD.P(id); if (p.s) { p.car[g.season] = Object.assign({ t: t.abbr }, p.s); } p.lastS = p.s; p.s = null; p.el--;
      if (p.el <= 0) { p.leave = 'grad'; return; }
      // a senior with a year left: most good players use the fifth year; role players and bench seniors often move on
      if (hoops && p.yr >= 4 && p.el >= 1 && chance(p.ovr < 68 ? 0.62 : p.ovr < 76 ? 0.38 : p.ovr < 83 ? 0.2 : 0.1) && !(p.tr.loyal > 96 && chance(0.6))) { p.leave = 'grad'; return; }
      const dg = p.ovr + (hoops ? 0 : (SD.isPit(p) ? 2 : 0));
      if (hoops) { /* decided after the loop by the NBA draft model */ }
      else if (g.sport === 'baseball' && p.yr >= 3 && p.ovr >= 80 && chance(clamp((p.ovr - 78) * 0.13, 0, 0.92))) { p.leave = 'pro'; p.dg = dg; }
    }));
    if (SD.moraleSeasonEnd) SD.moraleSeasonEnd();
    if (hoops) SD.nbaDeclare();
    g.off.leaving = ut.roster.filter(id => SD.P(id).leave).map(id => ({ id, why: SD.P(id).leave }));
    g.off.leaving.filter(x => x.why === 'pro').forEach(x => SD.news('nil', `${SD.P(x.id).n} declares for the draft`, 'You can make a pitch to bring him back on the recap screen.'));
    SD.jobReview();
  };
  /* ---------- the NBA draft: who goes pro is decided by how NBA teams see a player, not by his overall ---------- */
  // Prospect value on an overall-like scale: talent now, potential, youth, NBA size for his position, versatility, shooting, athleticism, a little production.
  // So a one-and-done wing with length ranks above an older college star who is undersized or a back-to-the-basket player.
  SD.nbaScore = p => {
    const yr = Math.min(5, p.yr || 1), at = p.at;
    let v = p.ovr * 0.7 + (p.ceil || p.ovr) * 0.3;
    v += [3, 1.5, 0, -2.5, -5][yr - 1];
    const ref = { PG: 75, SG: 77, SF: 79, PF: 81, C: 83 }[p.pos] || 78, d = (p.ht || ref) - ref;
    v += d >= 0 ? Math.min(4, d * 0.9) : Math.max(-8, d * (p.pos === 'C' || p.pos === 'PF' ? 1.6 : 1.1));
    const n = ['thr', 'hnd', 'pas', 'pdf', 'idf', 'reb', 'ath', 'blk', 'stl'].filter(k => at[k] >= 78).length; v += clamp((n - 3) * 0.9, -1.5, 3.5);
    v += (at.ath - 75) * 0.12;
    v += at.thr >= 78 ? (p.pos === 'C' || p.pos === 'PF' ? 2.5 : 1.5) : (at.thr < 60 && p.pos !== 'C' && p.pos !== 'PF' ? -2 : 0);
    const s = p.lastS; if (s && s.gp) v += clamp((((s.pts || 0) + (s.reb != null ? s.reb : (s.orb || 0) + (s.drb || 0)) + (s.ast || 0)) / s.gp - 14) * 0.12, -1.5, 2) || 0;
    return v;
  };
  // Rank every player; the best ~58 are draft picks and ~22 more go pro as free agents. Most of them leave, the borderline ones sometimes stay for NIL and a bigger role.
  SD.nbaDeclare = () => {
    const g = G(), she = SD.SP().he === 'she', K = she ? 36 : 58, U = she ? 10 : 22, all = [];
    g.teams.forEach(t => t.roster.forEach(id => { const p = SD.P(id); p.nba = SD.nbaScore(p); all.push(p); }));
    all.sort((a, b) => b.nba - a.nba);
    all.forEach((p, i) => {
      p.nbaRank = i + 1; if (i >= K + U) return;
      if (p.leave === 'pro') return;
      const r = (i + 1) / K, base = r <= 0.26 ? 0.97 : r <= 0.52 ? 0.92 : r <= 1 ? 0.8 : 0.45;
      if (p.leave === 'grad' || chance(clamp(base * (window.MORALE && p.t === g.user ? MORALE.leaveMult(g, p) : 1) * (p.tr.ego > 75 ? 1.1 : 1) * (p.tr.loyal > 96 ? 0.6 : 1) * (p.retYear === g.season - 1 ? 0.6 : 1), 0, 0.99))) { if (p.leave !== 'grad') p.leave = 'pro'; }
      p.dg = 90 - (i + 1) * 0.22 * (58 / K);
    });
  };
  SD.persuadeChance = (p, raise) => clamp(0.5 - (p.dg - 84) * 0.06 + (p.tr.loyal - 82) / 100 + (raise || 0) / Math.max(50000, SD.nilValue(p, SD.userT())) * 0.3 - (window.MORALE && MORALE.on(G()) ? (MORALE.leaveMult(G(), p) - 1) * 0.15 : 0), 0.03, 0.85);
  SD.persuade = (id, raise) => {
    const g = G(), o = g.off, p = SD.P(id), ut = SD.userT();
    if (o.pitched[id] != null) return 'You already made your pitch.';
    if (!SD.nilOn()) raise = 0;
    if (SD.payroll(ut) + (p.nil || 0) + raise > ut.budget * 1.03) return 'That raise is over your NIL budget.';
    const ok = chance(SD.persuadeChance(p, raise)); o.pitched[id] = ok;
    if (ok) { p.leave = null; p.retYear = g.season; p.nil += raise; o.leaving = o.leaving.filter(x => x.id !== id); SD.news('nil', `${p.n} is coming back`, ''); }
    return ok ? `${p.n} is coming back!` : `${p.n} is turning pro.`;
  };
  /* ---------- the coaching carousel (non-Tennessee dynasties): the AD's goal, job security, offers ---------- */
  const tnStart = () => (G().startTeam || 'Tennessee') === 'Tennessee';
  SD.expectedPct = t => clamp(0.35 + (t.prestige - 45) / 85, 0.3, 0.86);
  SD.coachGoal = () => {
    const g = G(), ut = SD.userT(); if (tnStart()) return null;
    const cg = g.coach.goal; if (cg && cg.season === g.season && cg.team === ut.id) return cg;
    const reg = SD.userGames().filter(x => x.kind === 'reg'), n = reg.length || (SD.kind() === 'hoops' ? 31 : 56);
    const oppR = reg.length ? reg.reduce((a, x) => a + SD.teamRating(T(SD.oppOf(x))), 0) / reg.length : 72;
    const wins = Math.round(n * clamp(SD.expectedPct(ut) - (oppR - 72) / 60, 0.25, 0.9));
    const pr = ut.prestige, hoops = SD.kind() === 'hoops', cws = G().sport === 'softball' ? 'the WCWS' : 'Omaha';
    const text = pr >= 88 ? (hoops ? 'Reach the Final Four' : `Get to ${cws}`) : pr >= 80 ? (hoops ? 'Make the NCAA Tournament and win games' : 'Host a regional') : pr >= 70 ? 'Make the NCAA Tournament' : pr >= 60 ? 'Finish above .500 and contend in the conference' : 'Show progress';
    g.coach.goal = { season: g.season, team: ut.id, wins, games: n, text };
    return g.coach.goal;
  };
  SD.jobSecurity = () => {
    const g = G(), ut = SD.userT(), goal = SD.coachGoal(); if (!goal) return null;
    const reg = SD.userGames().filter(x => x.kind === 'reg'), done = reg.filter(x => x.res);
    const w = done.filter(x => (x.h === ut.id) === (x.res.h > x.res.a)).length, played = done.length, left = Math.max(0, goal.games - played);
    const rate = (w + goal.wins / goal.games * 6) / (played + 6), pace = w + left * rate;
    const prior = (g.coach.perf || []).slice(-2), pr = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : 0;
    const years = g.season - (g.coach.since || g.startSeason || g.season) + 1;
    const v = Math.round(clamp(60 + (pace - goal.wins) / goal.games * 120 + pr * 3 + (years <= 1 ? 15 : 0), 2, 98));
    return { v, label: v >= 75 ? 'Secure' : v >= 55 ? 'Stable' : v >= 35 ? 'Warm seat' : 'Hot seat', pace: Math.round(pace), goal, years };
  };
  SD.jobReview = () => {
    const g = G(), ut = SD.userT(), o = g.off; o.jobs = null; if (tnStart()) return;
    if (!g.startSeason) g.startSeason = g.season;
    const goal = SD.coachGoal(), h = g.hist[g.hist.length - 1] || {}, fin = h.finish || '';
    const regW = SD.userGames().filter(x => x.kind === 'reg' && x.res && ((x.h === ut.id) === (x.res.h > x.res.a))).length;
    const post = /National champions/.test(fin) ? 6 : /championship|finals|Final Four|World Series/i.test(fin) ? 4 : /Elite Eight|Sweet 16|Super Regional/.test(fin) ? 2.5 : /round|Regional/.test(fin) ? 1.5 : 0;
    const score = (regW - goal.wins) / goal.games * 18 + post + (h.secT ? 1.5 : 0) + (h.secReg ? 1 : 0) - (goal.text.startsWith('Make the NCAA') && !post ? 1.5 : 0);
    g.coach.perf = (g.coach.perf || []).concat([Math.round(score * 10) / 10]).slice(-4);
    const last2 = g.coach.perf.slice(-2), years = g.season - (g.coach.since || g.startSeason) + 1;
    const fired = years >= 2 && (score <= -4 || (last2.length === 2 && last2[0] <= -2 && last2[1] <= -2)), hot = !fired && score <= -2;
    const pool = g.teams.filter(t => t.id !== ut.id); let offers = [];
    if (fired) offers = SD.shuffle(pool.filter(t => t.prestige <= ut.prestige - 4 && t.prestige >= ut.prestige - 30)).slice(0, 3);
    else if (score >= 1.5) { const up = Math.min(30, 6 + score * 3); offers = SD.shuffle(pool.filter(t => t.prestige > ut.prestige + 2 && t.prestige <= ut.prestige + up)).slice(0, score >= 4 ? 3 : score >= 2.5 ? 2 : 1); }
    else if (score > -1 && chance(0.35)) offers = SD.shuffle(pool.filter(t => Math.abs(t.prestige - ut.prestige) <= 4)).slice(0, 1);
    o.jobs = { score: Math.round(score * 10) / 10, exp: goal.wins, fired, hot, offers: offers.map(t => t.id), taken: null };
    if (fired) SD.news('league', `${g.coach.name} is fired at ${ut.name}`, `${offers.length} school${offers.length === 1 ? '' : 's'} want to talk.`);
    else if (offers.length) SD.news('league', `${g.coach.name} draws interest from ${offers.map(t => t.name).join(', ')}`, 'The coaching carousel is spinning.');
  };
  SD.takeJob = id => {
    const g = G(), o = g.off, old = SD.userT(), t = T(id);
    if (!o || !o.jobs || !o.jobs.offers.includes(id) || o.stage !== 'recap') return 'That offer is off the table.';
    old.coach = 'Staff'; (g.coach.stints = g.coach.stints || []).push({ team: old.name, from: g.coach.since || g.startSeason, to: g.season });
    g.user = t.id; t.coach = g.coach.name; g.coach.since = g.season + 1; g.coach.perf = []; t.rot = null; t.dl = null;
    o.leaving = t.roster.filter(x => SD.P(x).leave).map(x => ({ id: x, why: SD.P(x).leave })); o.pitched = {};
    if (g.recruit) { g.recruit.board = SD.myCommits().map(p => p.id); }
    o.jobs.taken = id; o.jobs.offers = [];
    SD.news('league', `${g.coach.name} takes the ${t.name} job`, `Leaving ${old.name}.`);
    return null;
  };
  /* ---------- season preview (locked at the opener) and the end-of-season review ---------- */
  SD.gameOdds = (a, b, home) => { const hoops = SD.kind() === 'hoops'; return 1 / (1 + Math.exp(-0.18 * ((SD.teamRating(a) - SD.teamRating(b)) + (hoops ? 2.5 * home : 0)))); };
  SD.EXP_TIERS = () => SD.kind() === 'hoops' ? ['Rebuilding year', 'Bubble team', 'NCAA Tournament team', 'Sweet 16 contender', 'Final Four contender', 'National title contender']
    : ['Rebuilding year', 'Bubble team', 'Regional team', 'Regional host', 'Omaha contender', 'National title contender'].map(x => G().sport === 'softball' ? x.replace('Omaha', 'WCWS') : x);
  const TIER_AT = [0.8, 1.5, 2.1, 3.2, 4.2, 5];
  SD.preview = () => {
    const g = G(), ut = SD.userT(); g.previews = g.previews || {};
    const have = g.previews[g.season]; if (have && have.team === ut.id) return have;
    if (g.phase !== 'preseason') return have || null;
    const games = SD.userGames().filter(x => !x.res && x.kind === 'reg');
    const odds = games.map(x => { const o = T(SD.oppOf(x)); return { id: x.id, d: x.d, opp: o.id, p: SD.gameOdds(ut, o, x.neutral ? 0 : x.h === ut.id ? 1 : -1) }; });
    const exp = odds.reduce((a, o) => a + o.p, 0), line = Math.floor(exp) + 0.5, n = odds.length;
    const avgOpp = t => { const os = g.sched.filter(x => x.kind === 'reg' && (x.h === t.id || x.a === t.id)).map(x => T(x.h === t.id ? x.a : x.h)).filter(o => o && o.roster); return os.length ? os.reduce((a, o) => a + SD.teamRating(o), 0) / os.length : 0; };
    const sos = g.teams.map(t => ({ id: t.id, v: avgOpp(t) })).sort((a, b) => b.v - a.v), sosRank = sos.findIndex(x => x.id === ut.id) + 1;
    const ap = SD.apRank(ut.id), pct = n ? exp / n : 0;
    const tier = ap && ap <= 4 ? 5 : ap && ap <= 10 ? 4 : ap && ap <= 20 || pct >= 0.72 ? 3 : ap || pct >= 0.6 ? 2 : pct >= 0.5 ? 1 : 0;
    const top25 = odds.filter(o => (SD.apRank(o.opp) || 99) <= 25).length;
    const big = odds.slice().sort((a, b) => ((26 - (SD.apRank(b.opp) || 26)) + (1 - Math.abs(b.p - 0.5) * 2) * 8) - ((26 - (SD.apRank(a.opp) || 26)) + (1 - Math.abs(a.p - 0.5) * 2) * 8))[0] || null;
    const ros = ut.roster.map(SD.P).filter(Boolean), stars = ros.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    const core = new Set(SD.kind() === 'hoops' ? SD.lineup(ut).slice(0, 8).map(p => p.id) : (() => { const L = SD.diamondLineup(ut); return Object.values(L.field).filter(Boolean).map(p => p.id).concat(L.rotation.map(p => p.id)); })());
    const breakouts = ros.filter(p => !stars.includes(p) && p.yr <= 3 && p.ceil - p.ovr >= 4 && core.has(p.id)).sort((a, b) => ((b.ceil - b.ovr) + (b.lastDelta || 0) * 1.5) - ((a.ceil - a.ovr) + (a.lastDelta || 0) * 1.5)).slice(0, 3);
    return (g.previews[g.season] = { season: g.season, team: ut.id, exp: Math.round(exp * 10) / 10, line, games: n, tier, label: SD.EXP_TIERS()[tier], ap, ovr: SD.teamRating(ut), sosRank, sosOf: sos.length, top25,
      odds, big: big && { id: big.id, d: big.d, opp: big.opp, p: big.p }, stars: stars.map(p => p.id), breakouts: breakouts.map(p => p.id) });
  };
  SD.review = () => {
    const g = G(), ut = SD.userT(), pv = (g.previews || {})[g.season], h = g.hist[g.hist.length - 1]; if (!h) return null;
    const fin = h.finish || '';
    const done = /National champions/.test(fin) ? 5 : /championship|finals/i.test(fin) ? 4.6 : /Final Four|World Series/.test(fin) ? 4.2 : /Elite Eight/.test(fin) ? 3.7 : /Sweet 16|Super Regional/.test(fin) ? 3.2 : /second round/.test(fin) ? 2.6 : /first round|Regional/.test(fin) ? 2.1 : clamp((h.w / Math.max(1, h.w + h.l) - 0.4) * 5, 0, 1.5);
    const prod = p => { const keep = p.s; p.s = p.s || p.lastS; const v = SD.awardScore(p, ut); p.s = keep; return v; };
    const ids = ut.roster.concat((g.off && g.off.leaving || []).map(x => x.id)).filter((x, i, a) => a.indexOf(x) === i).map(SD.P).filter(Boolean);
    const scored = ids.map(p => ({ p, v: prod(p) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const stars = scored.slice(0, 3).map(x => x.p);
    const byOvr = ids.slice().sort((a, b) => b.ovr - a.ovr);
    const breakouts = scored.map((x, i) => ({ p: x.p, jump: byOvr.indexOf(x.p) - i })).filter(x => !stars.includes(x.p) && !(pv && pv.stars.includes(x.p.id)) && x.p.ovr < 85 && x.jump >= 3).sort((a, b) => b.jump - a.jump).slice(0, 3).map(x => x.p);
    let score, vsLine = null;
    const regW = SD.userGames().filter(x => x.kind === 'reg' && x.res && ((x.h === ut.id) === (x.res.h > x.res.a))).length;
    if (pv) { vsLine = regW - pv.line; score = vsLine * (SD.kind() === 'hoops' ? 0.25 : 0.12) + (done - TIER_AT[pv.tier]) * 1.2; } else score = done - 2;
    const grade = score >= 3 ? 'A+' : score >= 2 ? 'A' : score >= 1 ? 'B+' : score >= 0 ? 'B' : score >= -1 ? 'C+' : score >= -2 ? 'C' : score >= -3 ? 'D' : 'F';
    const verdict = score >= 2 ? 'Blew past expectations' : score >= 0.6 ? 'Beat expectations' : score >= -0.6 ? 'Right about where we expected' : score >= -2 ? 'Fell short of expectations' : 'A disappointing year';
    return { pv, w: h.w, l: h.l, regW, fin, grade, verdict, vsLine, stars: stars.map(p => p.id), breakouts: breakouts.map(p => p.id) };
  };
  // positions short for next season: target counts per position vs. players with eligibility left
  SD.needs = t => {
    const hoops = SD.kind() === 'hoops', soft = G().sport === 'softball';
    const target = hoops ? { PG: 3, SG: 3, SF: 3, PF: 3, C: 3 } : soft ? { SP: 4, RP: 3, C: 2, '1B': 2, '2B': 2, SS: 2, '3B': 2, LF: 2, CF: 2, RF: 2 } : { SP: 7, RP: 8, C: 3, '1B': 2, '2B': 2, SS: 3, '3B': 2, LF: 2, CF: 3, RF: 2 };
    const out = {}; for (const pos in target) out[pos] = Math.max(0, target[pos] - t.roster.map(SD.P).filter(p => p.pos === pos && p.el > 1).length);
    return out;
  };
  // one tap through the rest of the offseason (the staff makes the remaining calls like Auto)
  SD.offAdvance = () => {
    const g = G(), keep = { nil: g.settings.nil, portal: g.settings.portal };
    g.settings.nil = 'auto'; g.settings.portal = 'auto';
    try { let n = 0; while (g.phase === 'offseason' && n++ < 20) SD.offNext(); }
    finally { g.settings.nil = keep.nil; g.settings.portal = keep.portal; }
  };
  SD.offNext = () => {
    const g = G(), o = g.off, st = o.stage;
    if (st === 'recap') { removeLeavers(); if (SD.nilOn()) nilReview(); else { o.nilAsk = []; if (SD.portalOn()) openPortal(); } }
    else if (st === 'nil') { resolveNil(); if (SD.portalOn()) openPortal(); }
    else if (st === 'portal') { resolvePortal(true); }
    else if (st === 'signing') { signingDay(); }
    else if (st === 'draft') { /* the draft already happened with the departures */ }
    else if (st === 'progress') { /* development already happened when the stage opened */ }
    else if (st === 'cuts') { cutDown(); }
    else if (st === 'schedule') { return newSeason(); }
    g.teams.forEach(SD.uniqueNums);
    o.stage = SD.OFF_ORDER[SD.OFF_ORDER.indexOf(st) + 1];
    if (o.stage === 'draft') runDraft();
    if (o.stage === 'progress') { const ut = SD.userT(), before = {}; ut.roster.forEach(id => { before[id] = SD.P(id).ovr; }); g.teams.forEach(t => t.roster.forEach(id => { const p = SD.P(id); if (p.firstY !== g.season + 1) develop(p); })); o.prog = ut.roster.map(id => { const p = SD.P(id); return { id, before: before[id], after: p.ovr, why: p.devWhy || [] }; }).sort((a, b) => (b.after - b.before) - (a.after - a.before)); }
  };
  function removeLeavers() {
    const g = G();
    g.teams.forEach(t => { t.roster = t.roster.filter(id => { const p = SD.P(id); if (p.leave) { p.gone = g.season; p.t0 = t.id; p.t = null; return false; } return true; }); });
  }
  function nilReview() {
    const g = G(), ut = SD.userT();
    g.off.nilAsk = ut.roster.map(SD.P).filter(p => SD.nilValue(p, ut) > (p.nil || 0) * (1.3 + (window.MORALE ? MORALE.nilSlack(g, p) : 0)) && (!window.MORALE || !MORALE.on(g) || MORALE.status(SD.moraleAdapter(), p) >= 0.15 || p.ovr >= 78) && p.el >= 1 && chance((0.6 + (p.tr.ego - 60) / 100) * (window.MORALE ? MORALE.nilMult(g, p) : 1))).map(p => ({ id: p.id, ask: Math.round(SD.nilValue(p, ut) * rr(0.85, 1.1) / 5000) * 5000, ans: null }));
  }
  SD.nilRisk = (p, amt) => { const v = SD.nilValue(p, SD.userT()), r = amt / Math.max(1000, v); let k = r >= 1 ? 0.03 : r >= 0.85 ? 0.12 : r >= 0.65 ? 0.3 : 0.55; k *= 1 + (p.tr.ego - 60) / 120; k *= 1 - (p.tr.loyal - 82) / 120; return clamp(k, 0.01, 0.9); };
  SD.riskLabel = r => r < 0.05 ? 'None' : r < 0.12 ? 'Low' : r < 0.3 ? 'Medium' : 'High';
  SD.adjustNil = (id, amt) => { const ut = SD.userT(), p = SD.P(id); amt = Math.max(0, Math.round(amt / 5000) * 5000); if (SD.payroll(ut) - p.nil + amt > ut.budget * 1.02) return 'Over budget.'; p.nil = amt; return null; };
  function resolveNil() {
    const g = G(), ut = SD.userT();
    g.off.nilAsk.forEach(a => { const p = SD.P(a.id); const yes = a.ans == null ? (g.settings.nil === 'auto' ? SD.payroll(ut) - p.nil + a.ask <= ut.budget : false) : a.ans; if (yes) p.nil = a.ask; else p.unhappy = chance(0.5); });
  }
  function openPortal() {
    const g = G(), pool = [];
    g.teams.forEach(t => {
      t.roster.map(SD.P).forEach(p => {
        let c = 0.03; const better = t.roster.map(SD.P).filter(x => x.pos === p.pos && x.ovr > p.ovr).length;
        if (better >= (SD.kind() === 'hoops' ? 1 : 2) && p.ovr >= 70) c += 0.12; if (p.unhappy) c += 0.25; if (t.id === g.user && window.MORALE && MORALE.on(g)) c = c * MORALE.leaveMult(g, p) + (MORALE.moraleOf(p) < 35 ? 0.06 : 0); c += (p.tr.ego - 60) / 400 - (p.tr.loyal - 82) / 250;
        if (p.pushOut || (chance(clamp(c, 0.005, 0.5)) && pool.filter(id => SD.P(id).portal.from === t.id).length < (SD.kind() === 'hoops' ? 4 : 8))) { p.portal = { from: t.id, offers: {}, pushed: !!p.pushOut }; pool.push(p.id); }
      });
    });
    g.off.portal = { pool, mine: {}, log: [] };
  }
  SD.encourage = id => {
    const g = G(), o = g.off, p = SD.P(id), ut = SD.userT();
    if (!o || !p || p.t !== ut.id) return null;
    if (p.tin === g.season) return `${SD.SP().he === 'she' ? 'She' : 'He'} just transferred in.`;
    if (o.portal && o.portal.resolved) return 'The portal window has closed.';
    if (p.pushOut) { p.pushOut = false; if (o.portal) { o.portal.pool = o.portal.pool.filter(x => x !== id); p.portal = null; } return `${p.n} stays.`; }
    p.pushOut = true;
    if (o.portal) { p.portal = { from: ut.id, offers: {}, pushed: true }; if (!o.portal.pool.includes(id)) o.portal.pool.push(id); }
    return `${p.n} is encouraged to transfer. ${SD.SP().he === 'she' ? 'She' : 'He'} enters the portal${o.portal ? '' : ' when it opens'}.`;
  };
  /* ---------- preseason camp: a team focus and three players who get extra reps ---------- */
  SD.CAMP = {
    hoops: { shooting: ['Shooting', ['thr', 'mid', 'ft']], handle: ['Ball handling', ['hnd', 'iq']], defense: ['Defense', ['pdf', 'idf', 'stl', 'blk']], rebound: ['Rebounding', ['reb']], inside: ['Inside scoring', ['ins']], conditioning: ['Conditioning', ['sta', 'ath']] },
    diamond: { hitting: ['Hitting', ['con', 'pow', 'eye']], pitching: ['Pitching', ['vel', 'stf', 'ctl']], stamina: ['Conditioning', ['sta']], defense: ['Defense', ['fld', 'arm']], speed: ['Speed and baserunning', ['spd']] },
  };
  SD.CAMP_MAX = 3;
  // focuses that make sense for one player (pitchers work on arms, hitters on bats and gloves)
  SD.campOptions = p => Object.entries(SD.CAMP[SD.kind()]).filter(([k, v]) => v[1].some(a => p.at[a] != null) && (SD.kind() === 'hoops' || SD.isPit(p) ? true : !['pitching', 'stamina'].includes(k)));
  SD.campState = () => { const g = G(); if (!g.camp || g.camp.y !== g.season || !g.camp.pf) g.camp = { y: g.season, pf: {}, picks: [], done: false, res: null }; return g.camp; };
  SD.campPick = (id, focus) => { const C = SD.campState(), p = SD.P(id), o = SD.campOptions(p); if (!o.length) return; C.pf[id] = o.some(x => x[0] === focus) ? focus : o[0][0]; if (!C.picks.includes(id)) C.picks.push(id); };
  SD.campSet = (id, f) => { const C = SD.campState(); if (C.picks.includes(id)) SD.campPick(id, f); };
  SD.runCamp = auto => {
    const g = G(), C = SD.campState(), ut = SD.userT(); if (C.done) return;
    if (auto && !C.picks.length) ut.roster.map(SD.P).filter(p => p.yr <= 2).sort((a, b) => (b.ceil - b.ovr) - (a.ceil - a.ovr)).slice(0, 3).forEach(p => {
      const o = SD.campOptions(p).map(([k, v]) => [k, v[1].reduce((s, a) => s + (p.at[a] != null ? p.at[a] : 99), 0) / v[1].length]).sort((a, b) => a[1] - b[1]); if (o.length) SD.campPick(p.id, o[0][0]);
    });
    const res = [];
    ut.roster.map(SD.P).forEach(p => {
      const before = p.ovr, extra = C.picks.includes(p.id), wk = (p.tr.work - 82) / 30, F = extra ? SD.CAMP[SD.kind()][C.pf[p.id]] : null;
      // only the three picked players train; the gain is a slight bump in the chosen skill
      if (F) F[1].forEach(k => { if (p.at[k] != null) p.at[k] = Math.round(clamp(p.at[k] + rr(0.8, 2.4) + wk, 40, 99)); });
      SD.setOvr(p); if (extra) res.push({ id: p.id, before, after: p.ovr, extra, foc: F ? F[0] : null });
    });
    C.done = true; C.res = res.sort((a, b) => (b.after - b.before) - (a.after - a.before));
    SD.news('season', 'Preseason camp', C.res.slice(0, 3).map(x => `${SD.P(x.id).n} +${x.after - x.before}${x.foc ? ' (' + x.foc.toLowerCase() + ')' : ''}`).join(', '));
  };
  SD.portalPlayers = () => { const P = G().off.portal; return P ? P.pool.map(SD.P).filter(p => p && p.portal) : []; };
  SD.newcomers = () => { const g = G(); return (g.recruit && !g.recruit.signed ? Math.min(SD.CLASS[g.sport], SD.myCommits().length) : 0) + Object.keys(g.off && g.off.portal ? g.off.portal.mine : {}).length; };
  SD.NEW_CAP = { mbb: 10, wbb: 10, baseball: 20, softball: 12 };
  SD.portalOffer = (id, amt) => {
    const g = G(), P = g.off.portal, ut = SD.userT();
    const committed = Object.values(P.mine).reduce((s, v) => s + v, 0) - (P.mine[id] || 0);
    if (SD.payroll(ut) + committed + amt > ut.budget * 1.05) return 'Over your NIL budget.';
    if (P.mine[id] == null && SD.newcomers() >= SD.NEW_CAP[g.sport]) return `That is ${SD.NEW_CAP[g.sport]} newcomers already.`;
    P.mine[id] = Math.round(amt / 5000) * 5000; return null;
  };
  SD.tStars = p => p.ovr >= 82 ? 5 : p.ovr >= 74 ? 4 : 3;
  SD.tRange = p => { const h = (p.id * 2654435761 >>> 0) % 1000 / 1000, w = 5 + Math.round(h * 3), lo = Math.round(p.ovr - 1 - h * (w - 2)); return [Math.max(50, lo), Math.min(99, lo + w)]; };
  function resolvePortal() {
    const g = G(), P = g.off.portal, ut = SD.userT(); if (!P) return; P.resolved = true;
    if (g.settings.portal === 'auto') { const need = SD.LIMIT[g.sport] - ut.roster.length; SD.portalPlayers().filter(p => p.portal.from !== g.user).sort((a, b) => b.ovr - a.ovr).slice(0, Math.max(0, Math.min(Math.max(1, Math.round(3 * Math.min(1, SD.autoEff()))), need))).forEach(p => SD.portalOffer(p.id, SD.nilValue(p, ut))); }
    SD.portalPlayers().forEach(p => {
      g.teams.forEach(t => { if (t.user || t.id === g.user || t.id === p.portal.from) return; if (chance(0.03 * Math.pow(t.prestige / 70, 2) * (p.ovr >= 78 ? 3 : 1))) p.portal.offers[t.id] = Math.round(SD.nilValue(p, t) * rr(0.6, 1.25) / 5000) * 5000; });
      if (p.portal.pushed && !Object.keys(p.portal.offers).length) { const t2 = pick(g.teams.filter(t => t.id !== p.portal.from && t.prestige < T(p.portal.from).prestige)); if (t2) p.portal.offers[t2.id] = Math.round(SD.nilValue(p, t2) * 0.8 / 5000) * 5000; }
      if (P.mine[p.id] != null) p.portal.offers[g.user] = P.mine[p.id];
      const offers = Object.entries(p.portal.offers);
      if (!offers.length) { p.t = null; p.gone = g.season; p.leave = 'portal'; T(p.portal.from).roster = T(p.portal.from).roster.filter(x => x !== p.id); p.portal = null; return; }
      const val = ([tid, amt]) => { const t = T(+tid); return Math.min(1.6, amt / Math.max(15000, SD.nilValue(p, t))) * 0.5 + (t.prestige - 70) / 60 + rr(0, 0.6); };
      const best = offers.sort((a, b) => val(b) - val(a))[0], t = T(+best[0]);
      T(p.portal.from).roster = T(p.portal.from).roster.filter(x => x !== p.id);
      t.roster.push(p.id); p.t = t.id; p.nil = best[1]; p.tin = g.season; p.prevT = p.portal.from;
      if (t.id === g.user) { P.log.unshift(`${p.n} (${p.pos}) transfers to ${SD.UN()}.`); SD.news('portal', `Transfer: ${p.n} picks ${SD.UN()}`, ''); }
      else if (p.portal.from === g.user) P.log.unshift(`${p.n} transfers to ${t.name}.`);
      p.portal = null;
    });
  }
  function signingDay() {
    const g = G(), R = g.recruit, lim = SD.LIMIT[g.sport], ut = SD.userT();
    // open spots: what a program can add before the roster limit (CPU teams keep one spot for the portal)
    const room = {}; g.teams.forEach(t => { room[t.id] = t.id === g.user ? SD.MAXC() : Math.max(0, lim - t.roster.length - (SD.kind() === 'hoops' ? 0 : 1)); });
    const sign = (p, t) => {
      delete p.pros; delete p.interest; delete p.acts; p.t = t.id; p.yr = 1; p.el = SD.kind() === 'hoops' ? 5 : 4; p.car = {}; p.firstY = g.season + 1; p.nil = SD.nilValue(p, t) * 0.6 | 0;
      if (t.id === g.user && window.MORALE) MORALE.signed(g, p, p.rpromise); else p.rpromise = null;
      t.roster.push(p.id); g.P[p.id] = p; room[t.id]--;
    };
    const list = Object.values(R.pool).sort((a, b) => b.rec.c - a.rec.c);
    // commitments first
    list.forEach(p => { if (p.commit == null) return; const t = T(p.commit); if (t && room[t.id] > 0) sign(p, t); else p.commit = null; });
    // everyone else signs with the most interested program that still has room (you only get players you offered)
    list.forEach(p => {
      if (p.t != null) return;
      const order = Object.entries(p.interest || {}).sort((a, b) => b[1] - a[1]).map(x => +x[0]);
      let tid = order.find(id => room[id] > 0 && (id !== g.user || (p.offer && g.settings.recruiting !== 'off')));
      if (tid == null) { const open = g.teams.filter(t => t.id !== g.user && room[t.id] > 0); if (!open.length) return; tid = SD.wpick(open, t => room[t.id] * Math.pow(t.prestige / 70, p.rec.stars >= 4 ? 3 : 1)).id; }
      sign(p, T(tid));
    });
    R.signed = true; R.finalRank = R.classRank;
  }
  function runDraft() {
    const g = G(), hoops = SD.kind() === 'hoops', she = SD.SP().he === 'she';
    const all = Object.values(g.P).filter(p => p.gone === g.season && (p.leave === 'pro' || p.leave === 'grad') && (hoops ? p.nba != null && p.nbaRank <= (she ? 46 : 80) : p.ovr >= 76));
    const out = hoops ? all.map(p => [p, p.nba + gauss() * 2.5]).sort((a, b) => b[1] - a[1]).map(x => x[0]) : all.sort((a, b) => b.ovr - a.ovr);
    const n = hoops ? (she ? 36 : 58) : 120;
    out.slice(n).forEach(p => { p.udfa = true; });
    g.off.draft = out.slice(0, n).map((p, i) => ({ id: p.id, pk: i + 1, t: p.t0 }));
    g.off.draft.forEach(x => { const p = SD.P(x.id); p.draft = { pk: x.pk, y: g.season }; });
    const mine = g.off.draft.filter(x => x.t === g.user);
    if (mine.length) SD.news('draft', `${mine.length} ${SD.UN()} player${mine.length > 1 ? 's' : ''} drafted`, mine.map(x => SD.P(x.id).n + ' (No. ' + x.pk + ')').join(', '));
  }
  function develop(p) {
    const work = (p.tr.work - 82) / 40, room = Math.max(0, p.ceil - p.ovr);
    const mins = p.lastS ? (SD.kind() === 'hoops' ? (p.lastS.min || 0) / Math.max(1, p.lastS.gp) / 30 : (p.lastS.pa || p.lastS.bf || 0) / 150) : 0;
    const hoops = SD.kind() === 'hoops', bl = p.bloom || 'steady', yi = Math.min(5, p.yr) - 1;
    const tm = hoops ? ({ early: [1.4, 1.1, 0.65, 0.35, 0.25], steady: [1, 1, 1, 1, 0.8], late: [0.45, 0.6, 1, 1.3, 1.1] }[bl] || [1, 1, 1, 1, 1])[yi] : 1;
    let gain = clamp(room * (0.36 + work * 0.12 + Math.min(0.15, mins * 0.1)) * tm + gauss() * 1.2, -2, 9);
    // basketball: players without a big ceiling grow (or stall) with what they actually do on the floor, and a late bloomer who is playing can break out in year three, four or five
    if (hoops) {
      const perf = clamp((mins - 0.55) * 2.2, -1, 1); if (room < 9) gain += perf * 0.9;
      if (bl === 'late' && p.yr >= 3 && mins >= 0.45 && chance(0.22)) { gain += rr(3, 6); p.burst = true; }
    }
    if (p.yr >= 4) gain = Math.min(gain, hoops && bl === 'late' ? 6 : 3);
    // the last few points are the hardest: slow growth near the top (diamond more, it piled up 90s)
    if (p.ovr >= 85 && gain > 0) gain *= SD.kind() === 'hoops' ? (p.ovr >= 90 ? 0.3 : p.ovr >= 87 ? 0.5 : 0.7) : 0.5;
    const before = p.ovr;
    for (const k in p.at) p.at[k] = Math.round(clamp(p.at[k] + gain * rr(0.6, 1.3), 50, 99));
    SD.setOvr(p); p.yr++; p.lastDelta = p.ovr - before;
    const why = []; if (p.tr.work >= 92) why.push('work ethic'); if (p.tr.work < 72) why.push('coasting'); if (mins >= 0.7) why.push('big minutes'); else if (mins < 0.15 && p.yr <= 3) why.push('little playing time'); if (room >= 12) why.push('high ceiling'); if (p.yr > 4) why.push('near his ceiling'); if (p.lastDelta >= 6) why.unshift('BREAKOUT'); if (p.lastDelta <= 0) why.unshift('stalled'); p.devWhy = why;
  }
  function progressPreview() { const ut = SD.userT(); return ut.roster.map(id => ({ id, before: SD.P(id).ovr })); }
  SD.cutsNeeded = () => Math.max(0, SD.userT().roster.length - SD.LIMIT[G().sport]);
  SD.toggleCut = id => { const o = G().off, p = SD.P(id); if (p.tin === G().season) return 'Transfers who just arrived cannot be cut.'; const i = o.cut.indexOf(id); if (i >= 0) o.cut.splice(i, 1); else o.cut.push(id); return null; };
  function cutDown() {
    const g = G(), ut = SD.userT(), o = g.off;
    let need = SD.cutsNeeded() - o.cut.length;
    if (need > 0) ut.roster.map(SD.P).filter(p => !o.cut.includes(p.id) && p.tin !== g.season).sort((a, b) => a.ovr - b.ovr + (b.yr - a.yr) * 0.3).slice(0, need).forEach(p => o.cut.push(p.id));
    o.cut.forEach(id => { const p = SD.P(id); p.t = null; p.gone = g.season; p.leave = 'cut'; });
    ut.roster = ut.roster.filter(id => !o.cut.includes(id));
    // CPU teams trim and fill to their limits
    g.teams.forEach(t => { if (t.id === g.user) return; const lim = SD.LIMIT[g.sport]; if (t.roster.length > lim) t.roster = t.roster.map(SD.P).sort((a, b) => b.ovr - a.ovr).slice(0, lim).map(p => p.id); while (t.roster.length < lim - (SD.kind() === 'hoops' ? 1 : 2)) { const pits = t.roster.map(SD.P).filter(SD.isPit).length, pos = SD.kind() === 'diamond' && pits < (g.sport === 'softball' ? 5 : 12) ? (pits < 4 ? 'SP' : 'RP') : SD.kind() === 'diamond' && t.roster.length - pits < 13 ? pick(['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF']) : pick(posPool()); const p = SD.makePlayer(pos, Math.round(clamp(38 + t.prestige * 0.47 - 6 + gauss() * 4, 50, 85)), { t: t.id, yr: 1, el: 4 }); t.roster.push(p.id); } });
    // every staff needs arms: below the minimum, the weakest position players make way for walk-on pitchers
    if (SD.kind() === 'diamond') g.teams.forEach(t => {
      const minP = g.sport === 'softball' ? 5 : 12; let pits = t.roster.map(SD.P).filter(SD.isPit).length, added = 0;
      while (pits < minP) {
        if (t.roster.length >= SD.LIMIT[g.sport]) { const drop = t.roster.map(SD.P).filter(p => !SD.isPit(p) && p.tin !== g.season).sort((a, b) => a.ovr - b.ovr)[0]; if (!drop) break; t.roster = t.roster.filter(id => id !== drop.id); drop.t = null; drop.gone = g.season; drop.leave = 'cut'; }
        const p = SD.makePlayer(pits < 4 ? 'SP' : 'RP', Math.round(clamp(38 + t.prestige * 0.47 - 6 + gauss() * 4, 50, 80)), { t: t.id, yr: 1, el: 4, rec: { walkon: true, stars: 0 } }); t.roster.push(p.id); pits++; added++;
      }
      if (added && t.id === g.user) SD.news('roster', `${added} walk-on pitcher${added > 1 ? 's' : ''} added`, 'The staff was short of arms, so the weakest position players made way.');
    });
    // walk-ons fill Tennessee's roster
    while (ut.roster.length < SD.LIMIT[g.sport] - (SD.kind() === 'hoops' ? 2 : 4)) { const p = SD.makePlayer(pick(posPool()), ri(52, 60), { t: ut.id, yr: 1, el: 4, rec: { walkon: true, stars: 0 } }); ut.roster.push(p.id); }
  }
  function newSeason() {
    const g = G();
    g.season++; g.phase = 'preseason'; g.off = null; g.post = null; g.ct = null;
    g.teams.forEach(t => { t.w = 0; t.l = 0; t.cw = 0; t.cl = 0; t.pf = 0; t.pa = 0; t.elo = t.elo * 0.6 + (1500 + (SD.teamRating(t) - 75) * 22) * 0.4; t.preElo = t.elo; t.roster.forEach(id => { const p = SD.P(id); p.unhappy = false; p.rest = 0; p.inj = null; }); });
    // old players and prospects nobody signed leave the table
    for (const id in g.P) { const p = g.P[id]; if (p.t == null && !p.pros && p.gone != null && p.gone < g.season - 2 && !SD.keepPlayer(p)) delete g.P[id]; }
    SD.buildSchedule();
    SD.updatePoll();
    SD.initRecruiting(false);
    g.date = SD.addDays(SD.dateOf(SD.SP().start), -7);
    SD.news('season', `${SD.SP().label(g.season)} preseason`, `${SD.UN()} opens ${SD.apRank(g.user) ? 'at No. ' + SD.apRank(g.user) : 'unranked'}.`);
    return true;
  }
})(typeof window !== 'undefined' ? window : globalThis);
