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
  SD.ACTIONS = { dm: { name: 'Social media', hrs: 1, pts: 4 }, call: { name: 'Phone call', hrs: 3, pts: 12 }, coach: { name: 'Head coach visit', hrs: 7, pts: 30 } };
  const posPool = () => SD.kind() === 'hoops' ? ['PG', 'SG', 'SF', 'PF', 'C'] : G().sport === 'softball' ? ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'SP', 'SP', 'RP'] : ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'SP', 'SP', 'SP', 'RP', 'RP', 'RP'];
  SD.PROS_BASE = 66;   // freshman rating at a .80 composite (tuned so league talent holds steady season to season)
  function prospect(year, rank, n) {
    // national rank -> composite: No. 1 about .9999, No. 25 about .985 (five-stars), No. 150 about .93
    // past the top n prospects the composite keeps sliding gently (2-stars and walk-on level), never below .66
    const c = rank <= n ? clamp(1 - Math.pow(rank / n, 0.75) * 0.3 - rr(0, 0.004), 0.7, 0.9999) : clamp(0.7 - (rank - n) / n * 0.03 - rr(0, 0.004), 0.66, 0.7), g = c * 100;
    const pos = pick(posPool());
    const ovr = Math.round(clamp(SD.PROS_BASE + (g - 80) * 0.7 + Math.max(0, g - 95) * 1.2 + gauss() * 2.5, 50, 84));
    const p = SD.makePlayer(pos, ovr, { t: null, yr: 1, el: 4, grade: g, rec: { c, stars: SD.starsOf(c), g, natl: rank, cls: year } });
    p.pros = true; p.interest = {}; p.commit = null; p.offer = false; p.acts = {}; p.visit = null; p.visited = false; p.nilOffer = 0; p.scout = 0;
    p.pref = SD.shuffle(['pt', 'nil', 'champ', 'prox', 'brand', 'dev']).slice(0, 3);
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
    g.recruit = { year, pool, board: [], log: [], signed: false, classRank: null };
    // the real commitments for next year's class
    const R = root.RECRUITING && root.RECRUITING[g.sport];
    if (first && R && R.commits) R.commits.forEach(c => {
      const pos = SD.kind() === 'hoops' ? (/wing|SF|forward/i.test(c.pos) ? 'SF' : /PG|point/i.test(c.pos) ? 'PG' : /C|center|post/i.test(c.pos) ? 'C' : 'SG') : /RHP|LHP|P\b/.test(c.pos) ? 'SP' : /C\b/.test(c.pos) ? 'C' : /OF/.test(c.pos) ? 'CF' : 'SS';
      const st = /5-star/.test(c.rank) ? 5 : /4-star|No\. [1-9]\d?\b/.test(c.rank) ? 4 : 3, comp = st === 5 ? 0.99 : st === 4 ? 0.95 : 0.89;
      const p = prospect(year, Math.round((1 - comp) * 1000), n); p.n = c.name; p.pos = pos; p.rec.c = comp; p.rec.stars = st; p.commit = SD.tnT().id; p.firm = true; p.real = true; p.home = c.from || p.home;
      SD.setOvr(p); pool[p.id] = p;
    });
  };
  SD.myCommits = () => Object.values(G().recruit.pool).filter(p => p.commit === G().user);
  SD.boardAdd = id => { const R = G().recruit; if (R.board.includes(id)) return null; if (R.board.length >= 20) return 'Your board is full (20).'; R.board.push(id); const p = R.pool[id]; if (p.interest[G().user] == null) p.interest[G().user] = 0; return null; };
  SD.boardRemove = id => { const R = G().recruit; R.board = R.board.filter(x => x !== id); };
  SD.hoursUsed = () => { const R = G().recruit; let h = 0; R.board.forEach(id => { const p = R.pool[id]; for (const a in p.acts) h += SD.ACTIONS[a].hrs; }); return h; };
  SD.setAct = (id, act, on) => {
    const p = G().recruit.pool[id]; if (!p) return 'Not found.';
    if (p.firm && p.commit !== G().user) return `${p.n} is locked in with ${T(p.commit).name}.`;
    if (on) { if (act === 'coach' && Object.values(G().recruit.pool).filter(x => x.acts.coach).length >= 3) return 'Three head coach visits a week.'; if (SD.hoursUsed() + SD.ACTIONS[act].hrs > SD.HOURS()) return 'Not enough hours left this week.'; p.acts[act] = 1; }
    else delete p.acts[act];
    return null;
  };
  SD.offer = id => { const p = G().recruit.pool[id]; const n = Object.values(G().recruit.pool).filter(x => x.offer).length; if (n >= SD.CLASS[G().sport] * 4) return 'That is enough offers out.'; p.offer = true; return null; };
  SD.setVisit = (id, d) => { const g = G(), p = g.recruit.pool[id]; const x = SD.userGames().find(y => y.d === d && y.h === g.user && !y.res); if (!x) return 'Official visits are for home games.'; if (Object.values(g.recruit.pool).filter(q => q.visit === d).length >= 4) return 'Four visitors a game is the limit.'; p.visit = d; return null; };
  SD.recruitWeek = () => {
    const g = G(), R = g.recruit; if (!R || R.signed) return;
    const ut = SD.userT(), mode = g.settings.recruiting, full = SD.myCommits().length >= SD.CLASS[g.sport] + 2;
    if (mode === 'auto') autoRecruit();
    const logs = [];
    if (mode !== 'off') R.board.forEach(id => {
      const p = R.pool[id]; if (!p) return;
      let pts = 0; for (const a in p.acts) pts += SD.ACTIONS[a].pts; if (p.offer) pts += 3;
      if (p.nilOffer) pts += Math.min(22, p.nilOffer / Math.max(15000, SD.nilValue(p, ut)) * 9) * (p.pref.includes('nil') ? 1.5 : 0.8);
      // an official visit this week
      if (p.visit && p.visit <= g.date && !p.visited) { const x = SD.userGames().find(y => y.d === p.visit); const won = x && x.res && ((x.h === ut.id) === (x.res.h > x.res.a)); pts += won ? 50 : 18; p.visited = true; logs.push(`${p.n} (${p.rec.stars}★ ${p.pos}) took an official visit${won ? ' and saw a win' : ''}.`); }
      p.acts = {};
      pts = 70 * (1 - Math.exp(-pts / 70));
      if (pts > 0) p.interest[ut.id] = (p.interest[ut.id] || 0) + pts * (0.45 + fitScore(ut, p) * 0.9) * (p.offer ? 1 : 0.5) * SD.recruitMult();
    });
    Object.values(R.pool).forEach(p => {
      if (p.commit != null && p.firm) return;
      for (const tid in p.interest) { const t = g.teams[tid]; if (!t || t.user || +tid === g.user) continue; const heat = p.rec.stars >= 4 ? 1 + Math.max(0, t.prestige - 75) / 50 : 1; p.interest[tid] += (3 + t.prestige / 10) * (0.5 + fitScore(t, p)) * rr(0.3, 1.4) * heat; }
      const order = Object.entries(p.interest).sort((a, b) => b[1] - a[1]); if (!order.length) return;
      const [lead, lv] = order[0], second = order[1] ? order[1][1] : 0, isMe = +lead === g.user;
      const need = (130 + p.rec.stars * 15) * (1 - Math.min(20, weekNo()) / 34);
      if (p.commit == null && lv >= need && lv >= second * 1.15 && (!isMe || (p.offer && !full && (p.rec.stars < 4 || p.visited || weekNo() >= 14)))) {
        p.commit = +lead; p.cwk = weekNo();
        if (isMe) { logs.push(`COMMIT: ${p.n}, ${p.rec.stars}★ ${p.pos}, commits to ${SD.UN()}!`); SD.news('commit', `${p.rec.stars}-star ${p.pos} ${p.n} commits to ${SD.UN()}`, `No. ${p.rec.natl} nationally.`); }
      } else if (p.commit != null && !p.firm && weekNo() - (p.cwk || 0) < 5 && !(p.commit === g.user && p.visited) && +lead !== p.commit && lv >= (p.interest[p.commit] || 0) * 1.35 && (!isMe || p.offer)) {
        const was = p.commit; p.commit = +lead;
        if (isMe) logs.push(`FLIP: ${p.n} flips to ${SD.UN()}!`); else if (was === g.user) logs.push(`DECOMMIT: ${p.n} flips to ${T(+lead).name}.`);
      }
    });
    R.log = logs.concat(R.log).slice(0, 50);
    rankClasses();
  };
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
    const room = Math.min(SD.CLASS[g.sport] + 2, Math.max(1, SD.LIMIT[g.sport] - back + 1)) - SD.myCommits().length; if (room <= 0) return;
    // chase who you can get: quality, fit, and how close you are to the leader
    const winnable = p => { const mine = p.interest[ut.id] || 0, top = Math.max(0, ...Object.entries(p.interest).filter(([t]) => +t !== ut.id).map(([, v]) => v)); return Math.min(1, (mine + 12) / (top + 12)); };
    const score = p => p.rec.c * 60 + winnable(p) * 45 + fitScore(ut, p) * 10;
    const cand = Object.values(R.pool).filter(p => p.commit == null || (p.commit === ut.id)).filter(p => p.commit !== ut.id).sort((a, b) => score(b) - score(a)).slice(0, room * 3);
    R.board = SD.myCommits().map(p => p.id).concat(cand.map(p => p.id)).slice(0, 20);
    let hrs = SD.HOURS(), coach = 3;
    cand.forEach(p => { if (!p.offer) p.offer = true; p.acts = {}; if (coach > 0 && hrs >= 7 && p.rec.stars >= 4) { p.acts.coach = 1; hrs -= 7; coach--; } else if (hrs >= 3) { p.acts.call = 1; hrs -= 3; } else if (hrs >= 1) { p.acts.dm = 1; hrs -= 1; } });
    const home = SD.userGames().filter(x => x.h === ut.id && !x.res && x.d > g.date).slice(0, 2);
    cand.slice(0, 4).forEach((p, i) => { if (!p.visit && home[i % Math.max(1, home.length)]) SD.setVisit(p.id, home[i % home.length].d); });
  }
  function rankClasses() {
    const g = G(), R = g.recruit, pts = {};
    Object.values(R.pool).forEach(p => { if (p.commit == null) return; pts[p.commit] = (pts[p.commit] || 0) + Math.pow(p.rec.c * 100 - 70, 2); });
    const order = Object.entries(pts).sort((a, b) => b[1] - a[1]).map(x => +x[0]);
    R.classRank = order.indexOf(g.user) + 1 || null; R.order = order;
  }

  /* ---------- the offseason ---------- */
  SD.OFF_ORDER = ['recap', 'nil', 'portal', 'signing', 'draft', 'progress', 'cuts', 'schedule'];
  SD.OFF_LABEL = { recap: 'Season recap', nil: 'NIL & budget', portal: 'Transfer portal', signing: 'Signing day', draft: 'Pro draft', progress: 'Player development', cuts: 'Roster limit', schedule: 'Next season' };
  SD.LIMIT = { mbb: 15, wbb: 15, baseball: 34, softball: 25 };
  SD.startOffseason = () => {
    const g = G(), ut = SD.userT(), hoops = SD.kind() === 'hoops';
    g.off = { stage: 'recap', leaving: [], pitched: {}, nilAsk: [], cut: [] };
    // eligibility, early entries
    g.teams.forEach(t => t.roster.forEach(id => {
      const p = SD.P(id); if (p.s) { p.car[g.season] = Object.assign({ t: t.abbr }, p.s); } p.lastS = p.s; p.s = null; p.el--;
      if (p.el <= 0) { p.leave = 'grad'; return; }
      const dg = p.ovr + (hoops ? 0 : (SD.isPit(p) ? 2 : 0));
      if (hoops) { if (p.ovr >= 84 && chance(clamp((p.ovr - 82) * 0.12 * (p.tr.ego > 75 ? 1.2 : 1) * (p.tr.loyal > 90 ? 0.6 : 1), 0, 0.9))) { p.leave = 'pro'; p.dg = dg; } }
      else if (g.sport === 'baseball' && p.yr >= 3 && p.ovr >= 80 && chance(clamp((p.ovr - 78) * 0.13, 0, 0.92))) { p.leave = 'pro'; p.dg = dg; }
    }));
    g.off.leaving = ut.roster.filter(id => SD.P(id).leave).map(id => ({ id, why: SD.P(id).leave }));
    SD.jobReview();
  };
  SD.persuadeChance = (p, raise) => clamp(0.5 - (p.dg - 84) * 0.06 + (p.tr.loyal - 70) / 100 + (raise || 0) / Math.max(50000, SD.nilValue(p, SD.userT())) * 0.3, 0.03, 0.85);
  SD.persuade = (id, raise) => {
    const g = G(), o = g.off, p = SD.P(id), ut = SD.userT();
    if (o.pitched[id] != null) return 'You already made your pitch.';
    if (SD.payroll(ut) + raise > ut.budget * 1.03) return 'That raise is over your NIL budget.';
    const ok = chance(SD.persuadeChance(p, raise)); o.pitched[id] = ok;
    if (ok) { p.leave = null; p.nil += raise; o.leaving = o.leaving.filter(x => x.id !== id); SD.news('nil', `${p.n} is coming back`, ''); }
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
    if (st === 'recap') { removeLeavers(); nilReview(); }
    else if (st === 'nil') { resolveNil(); openPortal(); }
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
    g.off.nilAsk = ut.roster.map(SD.P).filter(p => SD.nilValue(p, ut) > (p.nil || 0) * 1.3 && p.el >= 1 && chance(0.6 + (p.tr.ego - 60) / 100)).map(p => ({ id: p.id, ask: Math.round(SD.nilValue(p, ut) * rr(0.85, 1.1) / 5000) * 5000, ans: null }));
  }
  SD.nilRisk = (p, amt) => { const v = SD.nilValue(p, SD.userT()), r = amt / Math.max(1000, v); let k = r >= 1 ? 0.03 : r >= 0.85 ? 0.12 : r >= 0.65 ? 0.3 : 0.55; k *= 1 + (p.tr.ego - 60) / 120; k *= 1 - (p.tr.loyal - 70) / 120; return clamp(k, 0.01, 0.9); };
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
        if (better >= (SD.kind() === 'hoops' ? 1 : 2) && p.ovr >= 70) c += 0.12; if (p.unhappy) c += 0.25; c += (p.tr.ego - 60) / 400 - (p.tr.loyal - 70) / 250;
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
    hoops: { shooting: ['Shooting', ['thr', 'mid', 'ft']], defense: ['Defense', ['pdf', 'idf', 'stl', 'blk']], conditioning: ['Conditioning', ['sta', 'ath']], skill: ['Ball skills', ['hnd', 'pas', 'iq']], paint: ['Inside game', ['ins', 'reb']] },
    diamond: { hitting: ['Hitting', ['con', 'pow', 'eye']], pitching: ['Pitching', ['vel', 'stf', 'ctl', 'sta']], defense: ['Defense', ['fld', 'arm']], speed: ['Speed and baserunning', ['spd']] },
  };
  SD.campState = () => { const g = G(); if (!g.camp || g.camp.y !== g.season) g.camp = { y: g.season, focus: Object.keys(SD.CAMP[SD.kind()])[0], picks: [], done: false, res: null }; return g.camp; };
  SD.runCamp = auto => {
    const g = G(), C = SD.campState(), ut = SD.userT(); if (C.done) return;
    if (auto && !C.picks.length) C.picks = ut.roster.map(SD.P).filter(p => p.yr <= 2).sort((a, b) => (b.ceil - b.ovr) - (a.ceil - a.ovr)).slice(0, 3).map(p => p.id);
    const keys = SD.CAMP[SD.kind()][C.focus][1], res = [];
    ut.roster.map(SD.P).forEach(p => {
      const before = p.ovr, extra = C.picks.includes(p.id), wk = (p.tr.work - 70) / 30;
      keys.forEach(k => { if (p.at[k] != null) p.at[k] = Math.round(clamp(p.at[k] + rr(0.5, 2.2) + wk + (extra ? rr(1, 3) : 0), 40, 99)); });
      if (extra) Object.keys(p.at).forEach(k => { if (!keys.includes(k)) p.at[k] = Math.round(clamp(p.at[k] + rr(0, 1.5), 40, 99)); });
      SD.setOvr(p); if (p.ovr !== before || extra) res.push({ id: p.id, before, after: p.ovr, extra });
    });
    C.done = true; C.res = res.sort((a, b) => (b.after - b.before) - (a.after - a.before));
    SD.news('season', `Preseason camp: ${SD.CAMP[SD.kind()][C.focus][0].toLowerCase()} focus`, C.res.slice(0, 3).map(x => `${SD.P(x.id).n} +${x.after - x.before}`).join(', '));
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
    if (g.settings.portal === 'auto') { const need = SD.LIMIT[g.sport] - ut.roster.length; SD.portalPlayers().filter(p => p.portal.from !== g.user).sort((a, b) => b.ovr - a.ovr).slice(0, Math.max(0, Math.min(3, need))).forEach(p => SD.portalOffer(p.id, SD.nilValue(p, ut))); }
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
    const room = {}; g.teams.forEach(t => { room[t.id] = t.id === g.user ? SD.CLASS[g.sport] + 2 : Math.max(0, lim - t.roster.length - (SD.kind() === 'hoops' ? 0 : 1)); });
    const sign = (p, t) => {
      delete p.pros; delete p.interest; delete p.acts; p.t = t.id; p.yr = 1; p.el = 4; p.car = {}; p.firstY = g.season + 1; p.nil = SD.nilValue(p, t) * 0.6 | 0;
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
    const g = G(), out = Object.values(g.P).filter(p => p.gone === g.season && (p.leave === 'pro' || p.leave === 'grad') && p.ovr >= (SD.kind() === 'hoops' ? 80 : 76)).sort((a, b) => b.ovr - a.ovr);
    const n = SD.kind() === 'hoops' ? (SD.SP().he === 'she' ? 36 : 58) : 120;
    g.off.draft = out.slice(0, n).map((p, i) => ({ id: p.id, pk: i + 1, t: p.t0 }));
    g.off.draft.forEach(x => { const p = SD.P(x.id); p.draft = { pk: x.pk, y: g.season }; });
    const mine = g.off.draft.filter(x => x.t === g.user);
    if (mine.length) SD.news('draft', `${mine.length} ${SD.UN()} player${mine.length > 1 ? 's' : ''} drafted`, mine.map(x => SD.P(x.id).n + ' (No. ' + x.pk + ')').join(', '));
  }
  function develop(p) {
    const work = (p.tr.work - 70) / 40, room = Math.max(0, p.ceil - p.ovr);
    const mins = p.lastS ? (SD.kind() === 'hoops' ? (p.lastS.min || 0) / Math.max(1, p.lastS.gp) / 30 : (p.lastS.pa || p.lastS.bf || 0) / 150) : 0;
    let gain = clamp(room * (0.36 + work * 0.12 + Math.min(0.15, mins * 0.1)) + gauss() * 1.2, -2, 9);
    if (p.yr >= 4) gain = Math.min(gain, 3);
    // the last few points are the hardest: slow growth near the top (diamond more, it piled up 90s)
    if (p.ovr >= 85 && gain > 0) gain *= SD.kind() === 'hoops' ? 0.8 : 0.5;
    const before = p.ovr;
    for (const k in p.at) p.at[k] = Math.round(clamp(p.at[k] + gain * rr(0.6, 1.3), 50, 99));
    SD.setOvr(p); p.yr++; p.lastDelta = p.ovr - before;
    const why = []; if (p.tr.work >= 82) why.push('work ethic'); if (p.tr.work < 60) why.push('coasting'); if (mins >= 0.7) why.push('big minutes'); else if (mins < 0.15 && p.yr <= 3) why.push('little playing time'); if (room >= 12) why.push('high ceiling'); if (p.yr > 4) why.push('near his ceiling'); if (p.lastDelta >= 6) why.unshift('BREAKOUT'); if (p.lastDelta <= 0) why.unshift('stalled'); p.devWhy = why;
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
    for (const id in g.P) { const p = g.P[id]; if (p.t == null && !p.pros && p.gone != null && p.gone < g.season - 2) delete g.P[id]; }
    SD.buildSchedule();
    SD.updatePoll();
    SD.initRecruiting(false);
    g.date = SD.addDays(SD.dateOf(SD.SP().start), -7);
    SD.news('season', `${SD.SP().label(g.season)} preseason`, `${SD.UN()} opens ${SD.apRank(g.user) ? 'at No. ' + SD.apRank(g.user) : 'unranked'}.`);
    return true;
  }
})(typeof window !== 'undefined' ? window : globalThis);
