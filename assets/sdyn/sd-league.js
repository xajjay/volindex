/* The Vol Index — Hoops and Diamond Dynasty: the league. A new dynasty (teams, rosters, the real Tennessee schedule and a
   schedule for everyone else on the real calendar), the day-by-day season, rankings and standings, conference tournaments,
   the NCAA Tournament (68 teams in basketball; 64 in baseball and softball with regionals, super regionals and the
   College World Series), awards and the season's history. */
(function (root) {
  'use strict';
  const SD = root.SD;
  const { clamp, chance, rr, ri, pick, gauss } = SD;
  const G = () => SD.G;
  const T = id => SD.T(id);
  const other = s => s === 'h' ? 'a' : 'h';
  SD.VERSION = 1;

  /* ---------- dates ---------- */
  const D0 = iso => Date.parse(iso + 'T12:00:00Z');
  SD.iso = ms => new Date(ms).toISOString().slice(0, 10);
  SD.addDays = (iso, n) => SD.iso(D0(iso) + n * 864e5);
  SD.dow = iso => new Date(D0(iso)).getUTCDay();          // 0 Sunday
  SD.dateStr = iso => new Date(D0(iso)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  SD.dayStr = iso => new Date(D0(iso)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  // the calendar year a month-day falls in for this season (hoops seasons cross New Year's)
  const yOf = (md, g) => { g = g || G(); const sp = SD.SPORTS[g.sport]; if (sp.kind === 'hoops') return +md.slice(0, 2) >= 7 ? g.season : g.season + 1; return g.season; };
  SD.dateOf = (md, g) => yOf(md, g) + '-' + md;

  /* ---------- a new dynasty ---------- */
  SD.newDynasty = o => {
    const sp = SD.SPORTS[o.sport];
    SD.seed(o.seed || (Date.now() % 2147483647));
    const g = SD.G = { v: SD.VERSION, sport: o.sport, season: sp.season, coach: { name: o.coach || 'Coach', w: 0, l: 0 }, settings: Object.assign({ coachMode: 'coach', speed: 'slow', recruiting: 'manual', portal: 'manual', nil: 'manual', injuries: true, sound: false, autoPen: true }, o.settings || {}),
      teams: SD.teamsFor(o.sport), P: {}, nextId: 1, guests: {}, sched: [], phase: 'preseason', polls: { ap: [], hist: {} }, news: [], hist: [], awards: {}, recruit: null, off: null, slot: o.slot || 1, created: Date.now(), seed: SD.rstate(), rec: { season: {}, career: {} } };
    g.user = g.teams.find(t => t.name === 'Tennessee').id;
    g.teams.forEach(t => { t.w = 0; t.l = 0; t.cw = 0; t.cl = 0; t.pf = 0; t.pa = 0; t.hist = []; t.roster = t.id === g.user ? SD.importTennessee(t) : SD.genRoster(t); t.budget = SD.budgetFor(t); t.coach = t.id === g.user ? g.coach.name : SD.nameOf().split(' ')[1] + ' ' + pick(SD.LAST); });
    SD.realPollBoost();
    g.teams.forEach(t => { t.elo = 1500 + (SD.teamRating(t) - 75) * 22; t.preElo = t.elo; });
    SD.initNil();
    SD.buildSchedule();
    SD.initPoll();
    if (SD.initRecruiting) SD.initRecruiting(true);
    g.date = SD.addDays(SD.dateOf(sp.start), -7);
    SD.news('season', `Coach ${g.coach.name} takes over ${SD.SP().name.toLowerCase()} at Tennessee`, `${SD.SP().label(g.season)} begins ${SD.dateStr(SD.dateOf(sp.start))}.`);
    return g;
  };
  // the real preseason poll: ranked teams get the strength their ranking says they have
  SD.realPollBoost = () => {
    const g = G(), A = root.SITE_AUTO && root.SITE_AUTO[g.sport], P = A && A.poll;
    if (!P || !P.top || SD.kind() !== 'hoops') return;
    if (P.date && P.date < g.season + '-09-01') return;   // last season's final poll: not this season
    P.top.forEach(([rk, name]) => {
      const t = g.teams.find(x => x.name === name); if (!t || t.id === g.user) return;
      const want = 86.5 - rk * 0.28, cur = SD.teamRating(t);
      if (cur < want) { const L = SD.lineup(t); L.slice(0, 8).forEach(p => { const d = Math.round(want - cur + gauss()); for (const k in p.at) p.at[k] = clamp(p.at[k] + d, 50, 99); SD.setOvr(p); }); }
      t.realRank = rk;
    });
  };
  SD.initNil = () => G().teams.forEach(t => { const pay = t.roster.map(SD.P); const tot = pay.reduce((s, p) => s + SD.nilValue(p, t), 0); const k = Math.min(1, t.budget * 0.92 / Math.max(1, tot)); pay.forEach(p => { p.nil = Math.round(SD.nilValue(p, t) * k / 5000) * 5000; }); });
  SD.userT = () => T(G().user);
  SD.news = (type, h, b, x) => { const g = G(); g.news.unshift(Object.assign({ type, h, b, y: g.season, d: g.date, ph: g.phase }, x || {})); if (g.news.length > 150) g.news.length = 150; };

  /* ---------- schedule ---------- */
  let gid = 0;
  const mk = (d, h, a, x) => Object.assign({ id: ++gid + '-' + G().season, d, h, a, neutral: false, conf: false, kind: 'reg', res: null }, x || {});
  const byName = n => { const g = G(); n = n.replace(/^#\d+\s+/, '').trim(); return g.teams.find(t => t.name === n) || null; };
  SD.byName = byName;
  // Tennessee's real schedule (next season's is generated the same way as everyone else's)
  function utReal() {
    const g = G(), A = root.SITE_AUTO && root.SITE_AUTO[g.sport], out = [];
    if (!A || !A.schedule || g.season !== SD.SPORTS[g.sport].season) return null;
    const start = SD.dateOf(SD.SPORTS[g.sport].start);
    A.schedule.forEach(x => {
      if (x.exh || x.date < SD.addDays(start, -3) || /SEC Tournament|NCAA|Regional/i.test(x.opp)) return;
      let nm = x.opp.replace(/^#\d+\s+/, '');
      if (/\/| or /.test(nm)) nm = pick(nm.split(/\/| or /).map(s => s.trim()));
      let o = nm === 'TBD' ? pick(G().teams.filter(t => SD.POWER.includes(t.conf) && t.id !== g.user && t.conf !== 'SEC')) : byName(nm);
      if (!o) o = SD.guest(nm);
      out.push({ d: x.date, o: o.id, site: x.site || 'H', conf: !!x.conf || (o.conf === 'SEC' && x.date >= SD.dateOf(SD.kind() === 'hoops' ? '12-28' : '03-01')) });
    });
    return out;
  }
  SD.buildSchedule = () => {
    const g = G(), sp = SD.SPORTS[g.sport];
    g.sched = [];
    if (sp.kind === 'hoops') buildHoops(g, sp); else buildDiamond(g, sp);
    g.sched.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  };
  // pair up teams on a date: each team at most once, up to its quota, avoiding too many meetings
  function pairDay(g, d, pool, need, met, maxMeet, conf, kindX) {
    const avail = SD.shuffle(pool.filter(t => need[t.id] > 0 && !busy(g, t.id, d)));
    while (avail.length >= 2) {
      const a = avail.shift(); let j = avail.findIndex(b => (met[a.id + '-' + b.id] || 0) < maxMeet); if (j < 0) continue;
      const b = avail.splice(j, 1)[0];
      const home = chance(0.5) ? a : b;
      g.sched.push(mk(d, home.id, home === a ? b.id : a.id, { conf: !!conf, kind: kindX || 'reg' }));
      need[a.id]--; need[b.id]--; met[a.id + '-' + b.id] = (met[a.id + '-' + b.id] || 0) + 1; met[b.id + '-' + a.id] = met[a.id + '-' + b.id];
    }
  }
  const busyIdx = {};
  function busy(g, tid, d) { return g.sched.some(x => x.d === d && (x.h === tid || x.a === tid)); }
  function buildHoops(g, sp) {
    const ut = SD.userT(), real = utReal();
    const start = SD.dateOf(sp.start), confStart = SD.dateOf('12-30'), regEnd = SD.addDays(SD.dateOf(sp.ct.SEC.days[0]), -2);
    // Tennessee's real games
    const need = {}, cneed = {}, met = {};
    g.teams.forEach(t => { need[t.id] = sp.nonConf; cneed[t.id] = t.conf === 'SEC' ? sp.confGames : Math.min(18, (g.teams.filter(x => x.conf === t.conf).length - 1) * 2); });
    if (real) real.forEach(x => {
      const o = T(x.o), home = x.site === 'H', neutral = x.site === 'N';
      g.sched.push(mk(x.d, home || neutral ? ut.id : o.id, home || neutral ? o.id : ut.id, { neutral, conf: x.conf }));
      if (x.conf) { cneed[ut.id]--; if (cneed[o.id] != null) cneed[o.id]--; met[ut.id + '-' + o.id] = (met[ut.id + '-' + o.id] || 0) + 1; met[o.id + '-' + ut.id] = met[ut.id + '-' + o.id]; }
      else { need[ut.id]--; if (need[o.id] != null) need[o.id]--; }
    });
    need[ut.id] = Math.max(0, need[ut.id]); if (real) { need[ut.id] = 0; cneed[ut.id] = 0; }
    // non-conference: November and December, every two or three days
    const ncDays = []; for (let d = start; d < confStart; d = SD.addDays(d, chance(0.5) ? 2 : 3)) ncDays.push(d);
    ncDays.forEach(d => pairDay(g, d, g.teams, need, met, 1, false));
    // conference play: SEC on Tennessee's real conference dates (plus a few), everyone else Wednesdays and Saturdays
    const utConf = real ? real.filter(x => x.conf).map(x => x.d) : [];
    const grid = []; for (let d = confStart; d <= regEnd; d = SD.addDays(d, 1)) { const w = SD.dow(d); if (w === 3 || w === 6 || w === 2) grid.push(d); }
    const confs = [...new Set(g.teams.map(t => t.conf))];
    confs.forEach(c => {
      const ts = g.teams.filter(t => t.conf === c); if (ts.length < 2) return;
      const days = c === 'SEC' && utConf.length ? [...new Set(utConf.concat(grid))].sort() : grid;
      for (let pass = 0; pass < 3; pass++) days.forEach(d => pairDay(g, d, ts.filter(t => t.id !== (real ? ut.id : -1)), cneed, met, 2, true));
    });
    if (!real) { // a generated Tennessee schedule (later seasons): same as everyone, plus a few named games
    }
  }
  function buildDiamond(g, sp) {
    const ut = SD.userT(), real = utReal(), soft = g.sport === 'softball';
    const start = SD.dateOf(sp.start), ctStart = SD.dateOf(sp.ct.SEC.start), regEnd = SD.addDays(ctStart, -2);
    const total = soft ? 54 : 56, need = {}, cneed = {}, met = {};
    g.teams.forEach(t => { cneed[t.id] = (t.conf === 'SEC' ? sp.confSeries : Math.min(sp.confSeries, g.teams.filter(x => x.conf === t.conf).length - 1)) * 3; need[t.id] = total - cneed[t.id]; });
    if (real) {
      real.forEach(x => {
        const o = T(x.o), home = x.site === 'H', neutral = x.site === 'N';
        g.sched.push(mk(x.d, home || neutral ? ut.id : o.id, home || neutral ? o.id : ut.id, { neutral, conf: x.conf }));
        if (x.conf) { cneed[ut.id]--; if (cneed[o.id] != null) cneed[o.id]--; met[ut.id + '-' + o.id] = 3; met[o.id + '-' + ut.id] = 3; } else { need[ut.id]--; if (need[o.id] != null) need[o.id]--; }
      });
      cneed[ut.id] = 0;
      // softball's real schedule is only the SEC so far: Tennessee's early-season tournaments and midweeks are filled in
      if (!soft) need[ut.id] = 0;
    }
    // weekends: Friday-Saturday-Sunday series; softball adds Thursday tournament games in February and March
    const weekends = []; for (let d = start; d <= regEnd; d = SD.addDays(d, 1)) if (SD.dow(d) === 5) weekends.push(d);
    const confWk = weekends.filter(d => d >= SD.dateOf('03-12'));
    const ncWk = weekends.filter(d => d < SD.dateOf('03-12'));
    const series = (d, pool, needM, conf) => {
      const avail = SD.shuffle(pool.filter(t => needM[t.id] >= 3 && ![0, 1, 2].some(k => busy(g, t.id, SD.addDays(d, k)))));
      while (avail.length >= 2) {
        const a = avail.shift(); const j = avail.findIndex(b => !met[a.id + '-' + b.id]); if (j < 0) continue;
        const b = avail.splice(j, 1)[0], home = chance(0.5) ? a : b, away = home === a ? b : a;
        [0, 1, 2].forEach(k => g.sched.push(mk(SD.addDays(d, k), home.id, away.id, { conf: !!conf, series: true })));
        needM[a.id] -= 3; needM[b.id] -= 3; met[a.id + '-' + b.id] = 3; met[b.id + '-' + a.id] = 3;
      }
    };
    const confs = [...new Set(g.teams.map(t => t.conf))];
    confs.forEach(c => { const ts = g.teams.filter(t => t.conf === c && !(real && t.id === ut.id)); for (let pass = 0; pass < 2; pass++) confWk.forEach(d => series(d, ts, cneed, true)); });
    for (let pass = 0; pass < 2; pass++) ncWk.forEach(d => series(d, g.teams.filter(t => !(real && !soft && t.id === ut.id)), need, false));
    // midweeks: Tuesdays (and some Wednesdays), mostly regional opponents
    const mids = []; for (let d = start; d <= regEnd; d = SD.addDays(d, 1)) if (SD.dow(d) === 2 || (SD.dow(d) === 3 && chance(0.3))) mids.push(d);
    for (let pass = 0; pass < 2; pass++) mids.forEach(d => pairDay(g, d, g.teams.filter(t => !(real && !soft && t.id === ut.id)), need, met, 2, false));
  }

  /* ---------- the day ---------- */
  SD.gamesOn = d => G().sched.filter(x => x.d === d);
  SD.teamGames = tid => G().sched.filter(x => x.h === tid || x.a === tid);
  SD.userGames = () => SD.teamGames(G().user);
  SD.nextUserGame = () => SD.userGames().find(x => !x.res);
  SD.oppOf = x => x.h === G().user ? x.a : x.h;
  SD.isHome = x => x.h === G().user && !x.neutral;
  // jersey numbers: unique on each team (real players keep theirs; generated players move off a taken number)
  SD.uniqueNums = t => { if (!t.roster) return; const ps = t.roster.map(SD.P).filter(Boolean).sort((a, b) => (b.real ? 1 : 0) - (a.real ? 1 : 0)), used = new Set(); ps.forEach(p => { if (used.has(p.num) || p.num == null) { let n = SD.ri(0, 55), k = 0; while (used.has(n) && k++ < 200) n = (n + 1) % 100; p.num = n; } used.add(p.num); }); };
  SD.startGame = (x, user) => {
    const g = G(), H = T(x.h), A = T(x.a), k = SD.kind();
    SD.uniqueNums(H); SD.uniqueNums(A);
    const o = { neutral: x.neutral, title: x.title, live: !!user, user: user ? (x.h === g.user ? 'h' : 'a') : null };
    if (k === 'diamond') { o.gameNo = x.gn || 0; o.noMercy = x.kind === 'ncaa'; }
    return k === 'hoops' ? SD.H.newGame(H, A, o) : SD.B.newGame(H, A, o);
  };
  SD.playFull = GM => GM.kind === 'hoops' ? SD.H.playFull(GM) : SD.B.playFull(GM);
  // a CPU vs CPU game nobody watches: the same engine (box scores and stats for everyone)
  SD.simGame = x => { const g = G(); const GM = SD.kind() === 'hoops' && x.h !== g.user && x.a !== g.user ? quickHoops(x) : SD.startGame(x, false); if (!GM.quick) SD.playFull(GM); SD.bankGame(x, GM); return GM; };
  // basketball games Tennessee is not in: a fast model of the same game (score from the two teams' strength, home court and
  // a little luck; the box score split by minutes and each player's game). Tennessee's games always use the full engine.
  function quickHoops(x) {
    const H = T(x.h), A = T(x.a), w = SD.SP().he === 'she';
    const rh = SD.teamRating(H), ra = SD.teamRating(A), home = x.neutral ? 0 : 3.2;
    const pace = 68 + gauss() * 4, base = w ? 69 : 73;
    const margin = (rh - ra) * 1.25 + home + gauss() * 11;
    let sh = Math.round(base + margin / 2 + gauss() * 4), sa = Math.round(base - margin / 2 + gauss() * 4);
    let ot = 0; while (sh === sa) { ot++; sh += SD.ri(4, 12); sa += SD.ri(4, 12); }
    const GM = { kind: 'hoops', quick: true, T: { h: H, a: A }, score: { h: sh, a: sa }, ot, ps: {}, lineScore: null };
    for (const s of ['h', 'a']) {
      const L = SD.lineup(GM.T[s]).slice(0, 10), mins = [33, 32, 31, 30, 29, 21, 17, 4, 2, 1];
      const u = L.map((p, i) => Math.pow(Math.max(55, (p.at.ins + p.at.mid + p.at.thr) / 3 + (p.ovr - 75) * 0.6), 2.6) * mins[i]);
      const ut = u.reduce((a, b) => a + b, 0), pts = GM.score[s];
      const reb = 35 + gauss() * 4, ast = 13 + gauss() * 3;
      L.forEach((p, i) => {
        const share = u[i] / ut, pp = Math.max(0, Math.round(pts * share + gauss() * 2.2));
        const fga = Math.round(pp / 1.15 + SD.rr(0, 2)), tpa = Math.round(fga * clamp((p.at.thr - 50) / 80, 0.05, 0.6));
        const l = GM.ps[p.id] = { t: p.t, min: mins[i], pts: pp, fga, fgm: Math.min(fga, Math.round(pp / 2.3)), tpa, tpm: Math.round(tpa * clamp(0.3 + (p.at.thr - 70) / 200, 0.15, 0.48)), fta: Math.round(pp * 0.22), ftm: Math.round(pp * 0.16),
          orb: 0, drb: Math.max(0, Math.round(reb * mins[i] / 200 * (p.at.reb / 72) + gauss())), ast: Math.max(0, Math.round(ast * mins[i] / 200 * (p.at.pas / 72) + gauss() * 0.7)), stl: chance(p.at.stl / 140) ? 1 : 0, blk: chance(p.at.blk / 150) ? 1 : 0, to: chance(0.5) ? 1 : 0, pf: SD.ri(0, 3), pm: 0, gs: i < 5 ? 1 : 0 };
      });
    }
    return GM;
  }
  SD.bankGame = (x, GM) => {
    const g = G(), Ht = T(x.h), At = T(x.a);
    if (GM.kind === 'hoops' && !GM.quick) SD.H.finalize(GM);
    x.res = { h: GM.score.h, a: GM.score.a, ot: GM.ot || (GM.inn && GM.inn > GM.maxInn ? GM.inn : 0), inn: GM.inn || null };
    const hw = GM.score.h > GM.score.a, W = hw ? Ht : At, L = hw ? At : Ht;
    // stats into players
    for (const id in GM.ps) { const p = SD.P(+id); if (!p) continue; const s = p.s = p.s || { gp: 0 }, l = GM.ps[id]; s.gp++; for (const k in l) if (k !== 't' && typeof l[k] === 'number') s[k] = (s[k] || 0) + l[k]; }
    if (x.h === g.user || x.a === g.user) {
      x.box = { ps: Object.fromEntries(Object.entries(GM.ps).map(([id, l]) => [id, Object.assign({}, l)])), ls: GM.lineScore };
      for (const id in GM.ps) { const p = SD.P(+id); if (!p || p.t !== g.user) continue; (p.gl = p.gl || []).push({ d: x.d, o: T(SD.oppOf(x)).abbr, h: SD.isHome(x), l: GM.ps[id], r: (x.h === g.user) === hw ? 'W' : 'L', sc: x.h === g.user ? GM.score.h + '-' + GM.score.a : GM.score.a + '-' + GM.score.h }); if (p.gl.length > 70) p.gl.shift(); }
      const won = (x.h === g.user) === hw; g.coach.w += won ? 1 : 0; g.coach.l += won ? 0 : 1;
    }
    if (W.w != null) { W.w++; L.l++; if (x.conf && x.kind === 'reg') { W.cw++; L.cl++; } W.pf += Math.max(GM.score.h, GM.score.a); W.pa += Math.min(GM.score.h, GM.score.a); L.pf += Math.min(GM.score.h, GM.score.a); L.pa += Math.max(GM.score.h, GM.score.a); }
    // Elo (the NET-like rating)
    const eh = (Ht.elo || 1300) + (x.neutral ? 0 : 60), ea = At.elo || 1300, exp = 1 / (1 + Math.pow(10, (ea - eh) / 400));
    const mov = Math.log(Math.abs(GM.score.h - GM.score.a) + 1), k = (SD.kind() === 'hoops' ? 22 : 10) * mov * (x.kind === 'reg' ? 1 : 1.2), dl = k * ((hw ? 1 : 0) - exp);
    if (Ht.elo) Ht.elo += dl; if (At.elo) At.elo -= dl;
    return x.res;
  };
  // play every game before date d (and the user's game too if it is on an earlier date and we are simming)
  SD.simTo = (d, inclUser) => {
    const g = G(); let guard = 0;
    while (g.date < d && guard++ < 400) {
      const day = g.date;
      SD.gamesOn(day).filter(x => !x.res && (inclUser || (x.h !== g.user && x.a !== g.user))).forEach(x => SD.simGame(x));
      SD.endDay(day);
      g.date = SD.addDays(day, 1);
    }
  };
  SD.endDay = d => {
    const g = G();
    // injuries heal, pitchers rest
    g.teams.forEach(t => t.roster.forEach(id => { const p = SD.P(id); if (p.inj && p.inj.g > 0 && SD.gamesOn(d).some(x => x.h === t.id || x.a === t.id)) p.inj.g--; if (p.rest > 0) p.rest--; }));
    Object.values(g.guests || {}).forEach(t => t.roster.forEach(id => { const p = SD.P(id); if (p.rest > 0) p.rest--; }));
    // weekly: polls and recruiting (Mondays)
    if (SD.dow(d) === 1 && g.phase === 'season') { SD.updatePoll(); if (SD.recruitWeek) SD.recruitWeek(); }
  };

  /* ---------- rankings and standings ---------- */
  SD.powerKey = t => t.elo + (t.w - t.l) * (SD.kind() === 'hoops' ? 2 : 0.6) + (SD.POWER.includes(t.conf) ? 20 : 0);
  SD.initPoll = () => {
    const g = G(), A = root.SITE_AUTO && root.SITE_AUTO[g.sport], P = A && A.poll;
    let order = g.teams.slice().sort((a, b) => SD.powerKey(b) - SD.powerKey(a));
    if (P && P.top && !(P.date && P.date < g.season + '-09-01') && SD.kind() === 'hoops') { const real = P.top.map(([, n]) => byName(n)).filter(Boolean); order = real.concat(order.filter(t => !real.includes(t))); }
    setPoll(order, 'pre');
  };
  function setPoll(order, wk) { const g = G(), prev = {}; g.polls.ap.forEach((x, i) => { prev[x.t] = i + 1; }); g.polls.ap = order.slice(0, 25).map((t, i) => ({ t: t.id, prev: prev[t.id] || null, rec: t.w + '-' + t.l })); g.teams.forEach(t => { t.ap = null; }); g.polls.ap.forEach((x, i) => { T(x.t).ap = i + 1; }); g.polls.hist[g.season + '-' + wk] = g.polls.ap.map(x => x.t); }
  SD.updatePoll = () => { const g = G(); setPoll(g.teams.slice().sort((a, b) => SD.powerKey(b) - SD.powerKey(a) + (b.w + b.l ? 0 : 0)), g.date); };
  SD.apRank = tid => { const t = G().teams[tid]; return t && t.ap || null; };
  SD.netRank = () => G().teams.slice().sort((a, b) => b.elo - a.elo);
  SD.standings = conf => {
    const g = G(); const ts = g.teams.filter(t => t.conf === conf);
    return ts.sort((a, b) => { const pa = a.cw / Math.max(1, a.cw + a.cl), pb = b.cw / Math.max(1, b.cw + b.cl); if (pb !== pa) return pb - pa; if (b.cw !== a.cw) return b.cw - a.cw; return b.elo - a.elo; });
  };
  SD.confs = () => [...new Set(G().teams.map(t => t.conf))];

  /* ---------- the season's phases ---------- */
  SD.startSeason = () => { const g = G(); if (g.phase !== 'preseason') return; g.phase = 'season'; g.date = SD.addDays(SD.dateOf(SD.SP().start), -1); };
  SD.regularOver = () => !G().sched.some(x => x.kind === 'reg' && !x.res);
  // conference tournaments: single elimination, top seeds get byes into a 16- (or 8-) team bracket
  SD.setupCT = () => {
    const g = G(), sp = SD.SP(); g.phase = 'ct';
    const days = SD.kind() === 'hoops' ? sp.ct.SEC.days.map(md => SD.dateOf(md)) : [0, 1, 2, 3, 4, 5].map(k => SD.addDays(SD.dateOf(sp.ct.SEC.start), k));
    g.ct = {};
    SD.confs().forEach(c => {
      if (c === 'IND') return;
      const st = SD.standings(c), n = st.length; if (n < 4) return;
      const size = n >= 13 ? 16 : n >= 7 ? 8 : 4;
      g.ct[c] = { seeds: st.map(t => t.id).slice(0, size), rounds: [], size, days, champ: null, name: (SD.CONF_NAME[c] || c) + ' Tournament' };
    });
    SD.ctNextRound();
    SD.news('ct', `Conference tournament week`, `Tennessee is the No. ${(g.ct.SEC ? g.ct.SEC.seeds.indexOf(g.user) + 1 : 0) || '—'} seed in the ${G().sport === 'softball' ? 'SEC Softball' : 'SEC'} Tournament.`);
  };
  // the next round of every conference tournament
  SD.ctNextRound = () => {
    const g = G();
    for (const c in g.ct) {
      const C = g.ct[c]; if (C.champ != null) continue;
      const r = C.rounds.length, S = C.seeds;
      let pairs = [];
      if (r === 0) {
        // first round: the lower seeds play; byes for the top seeds (a 16-team bracket: seeds 9-16 play first, then 5-8 enter, then 1-4)
        if (C.size === 16) pairs = [[8, 15], [11, 12], [9, 14], [10, 13]].map(([a, b]) => [S[a], S[b]]);
        else if (C.size === 8) pairs = [[0, 7], [3, 4], [1, 6], [2, 5]].map(([a, b]) => [S[a], S[b]]);
        else pairs = [[0, 3], [1, 2]].map(([a, b]) => [S[a], S[b]]);
      } else {
        const prev = C.rounds[r - 1].map(x => x.res.h > x.res.a ? x.h : x.a);
        if (C.size === 16 && r === 1) pairs = [[7, 0], [4, 1], [6, 2], [5, 3]].map(([s, i]) => [S[s], prev[i]]);
        else if (C.size === 16 && r === 2) pairs = [[0, 0], [3, 1], [1, 2], [2, 3]].map(([s, i]) => [S[s], prev[i]]);
        else { for (let i = 0; i + 1 < prev.length; i += 2) pairs.push([prev[i], prev[i + 1]]); }
      }
      if (!pairs.length) continue;
      const day = C.days[Math.min(C.days.length - 1, r + (C.size === 16 ? 0 : C.size === 8 ? 2 : 3))];
      const games = pairs.filter(p => p[0] != null && p[1] != null).map(([a, b]) => { const sa = S.indexOf(a), sb = S.indexOf(b), hi = sa < sb ? a : b; return mk(day, hi, hi === a ? b : a, { neutral: true, kind: 'ct', conf: false, title: C.name, ct: c }); });
      C.cur = games; g.sched.push(...games);
    }
  };
  SD.ctAfterDay = () => {
    const g = G(); let left = false;
    for (const c in g.ct) {
      const C = g.ct[c]; if (C.champ != null || !C.cur) continue;
      if (C.cur.some(x => !x.res)) { left = true; continue; }
      C.rounds.push(C.cur); C.cur = null;
      if (C.rounds[C.rounds.length - 1].length === 1) { const f = C.rounds[C.rounds.length - 1][0]; C.champ = f.res.h > f.res.a ? f.h : f.a; T(C.champ).confChamp = g.season; if (c === 'SEC' || C.champ === g.user) SD.news('ct', `${T(C.champ).name} wins the ${C.name}`, ''); }
      else left = true;
    }
    if (left) SD.ctNextRound();
    return !Object.values(g.ct).some(C => C.champ == null);
  };

  /* ---------- the NCAA Tournament ---------- */
  SD.selection = () => {
    const g = G(), sp = SD.SP(), hoops = SD.kind() === 'hoops';
    const field = hoops ? 68 : 64;
    const autos = Object.values(g.ct || {}).map(C => C.champ).filter(x => x != null).map(T);
    const net = SD.netRank();
    const at = net.filter(t => !autos.includes(t));
    const fieldTeams = autos.concat(at.slice(0, field - autos.length));
    const ranked = fieldTeams.sort((a, b) => net.indexOf(a) - net.indexOf(b));
    g.post = { field: ranked.map(t => t.id), autos: autos.map(t => t.id), rounds: [], champ: null, label: 'Selection' };
    g.phase = 'ncaa';
    const me = ranked.findIndex(t => t.id === g.user);
    if (hoops) setupMadness(g, ranked); else setupRegionals(g, ranked);
    SD.news('ncaa', hoops ? 'Selection Sunday' : 'NCAA Tournament field announced', me >= 0 ? (hoops ? `Tennessee is a No. ${g.post.seedOf[g.user]} seed in the ${g.post.regionOf[g.user]} Region.` : `Tennessee is the No. ${me + 1} overall seed${me < 16 ? ' and hosts a regional' : ''}.`) : 'Tennessee is not in the field.');
  };
  // basketball: 4 regions of 16 (s-curve); First Four for the last four at-large and the four lowest automatic bids
  function setupMadness(g, ranked) {
    const sp = SD.SP(), days = sp.ncaa.days;
    const autos = new Set(g.post.autos);
    const atl = ranked.filter(t => !autos.has(t.id)), lastFour = atl.slice(-4), lowAutos = ranked.filter(t => autos.has(t.id)).slice(-4);
    const main = ranked.filter(t => !lastFour.includes(t) && !lowAutos.includes(t)); // 60
    const regions = ['East', 'West', 'South', 'Midwest'], R = { East: [], West: [], South: [], Midwest: [] };
    const seedOf = {}, regionOf = {};
    // seeds 1-15 from the 60, then the 11 and 16 lines get First Four winners
    let k = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const order = seed % 2 ? regions : regions.slice().reverse();
      order.forEach(rg => {
        if (seed === 16 && (rg === 'East' || rg === 'West')) { R[rg].push({ ff: [lowAutos[rg === 'East' ? 0 : 2], lowAutos[rg === 'East' ? 1 : 3]].map(t => t.id), seed }); return; }
        if (seed === 11 && (rg === 'South' || rg === 'Midwest')) { R[rg].push({ ff: [lastFour[rg === 'South' ? 0 : 2], lastFour[rg === 'South' ? 1 : 3]].map(t => t.id), seed }); return; }
        const t = main[k++]; if (!t) return; R[rg].push({ t: t.id, seed }); seedOf[t.id] = seed; regionOf[t.id] = rg;
      });
    }
    [...lastFour, ...lowAutos].forEach(t => { const rg = regions.find(r => R[r].some(x => x.ff && x.ff.includes(t.id))); regionOf[t.id] = rg; seedOf[t.id] = R[rg].find(x => x.ff && x.ff.includes(t.id)).seed; });
    g.post.R = R; g.post.seedOf = seedOf; g.post.regionOf = regionOf; g.post.stage = 'ff'; g.post.label = 'First Four';
    const ffGames = []; regions.forEach(rg => R[rg].filter(x => x.ff).forEach((x, i) => ffGames.push(mk(SD.dateOf(days.ff[ffGames.length % 2]), x.ff[0], x.ff[1], { neutral: true, kind: 'ncaa', title: 'First Four', rg, seed: x.seed }))));
    g.post.cur = ffGames; g.sched.push(...ffGames);
  }
  const PAIRS = [[1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]];
  SD.madnessNext = () => {
    const g = G(), P = g.post, sp = SD.SP(), days = sp.ncaa.days;
    if (P.cur && P.cur.some(x => !x.res)) return false;
    const win = x => x.res.h > x.res.a ? x.h : x.a;
    if (P.cur) P.rounds.push(P.cur);
    const st = P.stage;
    let games = [], next;
    const regions = ['East', 'West', 'South', 'Midwest'];
    if (st === 'ff') {
      P.cur.forEach(x => { const slot = P.R[x.rg].find(y => y.ff && y.ff.includes(x.h)); slot.t = win(x); });
      regions.forEach((rg, ri0) => PAIRS.forEach(([a, b], i) => { const A = P.R[rg].find(x => x.seed === a), B = P.R[rg].find(x => x.seed === b); games.push(mk(SD.dateOf(days.r64[(ri0 + i) % 2]), A.t, B.t, { neutral: true, kind: 'ncaa', title: `NCAA ${rg} first round`, rg, slot: i })); }));
      next = 'r64';
    } else if (st === 'r64' || st === 'r32' || st === 's16') {
      const w = P.cur.map(win), lab = { r64: 'second round', r32: 'Sweet 16', s16: 'Elite Eight' }[st], dk = { r64: 'r32', r32: 's16', s16: 'e8' }[st];
      regions.forEach((rg, ri0) => { const rw = P.cur.filter(x => x.rg === rg).map(win); for (let i = 0; i + 1 < rw.length; i += 2) games.push(mk(SD.dateOf(days[dk][(ri0 + i) % 2]), rw[i], rw[i + 1], { neutral: true, kind: 'ncaa', title: `NCAA ${rg} ${lab}`, rg })); });
      next = dk;
    } else if (st === 'e8') {
      const w = P.cur.map(win); games = [mk(SD.dateOf(days.f4[0]), w[0], w[1], { neutral: true, kind: 'ncaa', title: 'Final Four' }), mk(SD.dateOf(days.f4[0]), w[2], w[3], { neutral: true, kind: 'ncaa', title: 'Final Four' })]; next = 'f4';
    } else if (st === 'f4') {
      const w = P.cur.map(win); games = [mk(SD.dateOf(days.nc[0]), w[0], w[1], { neutral: true, kind: 'ncaa', title: 'National championship' })]; next = 'nc';
    } else if (st === 'nc') { P.champ = win(P.cur[0]); P.cur = null; P.stage = 'done'; T(P.champ).natl = (T(P.champ).natl || 0) + 1; SD.news('ncaa', `${T(P.champ).name} wins the national championship`, ''); return true; }
    // higher seed is the "home" team on a neutral floor
    games.forEach(x => { if ((P.seedOf[x.a] || 99) < (P.seedOf[x.h] || 99)) { const t = x.h; x.h = x.a; x.a = t; } });
    P.cur = games; P.stage = next; P.label = { r64: 'First round', r32: 'Second round', s16: 'Sweet 16', e8: 'Elite Eight', f4: 'Final Four', nc: 'National championship' }[next];
    g.sched.push(...games);
    return false;
  };
  // baseball and softball: 16 four-team regionals (double elimination) at the top 16 seeds, best-of-three super regionals,
  // and a College World Series of two four-team double-elimination brackets and a best-of-three final
  function setupRegionals(g, ranked) {
    const P = g.post, sp = SD.SP();
    const host = ranked.slice(0, 16), s2 = ranked.slice(16, 32), s3 = ranked.slice(32, 48), s4 = ranked.slice(48, 64);
    P.regs = host.map((h, i) => ({ teams: [h.id, s2[15 - i] ? s2[15 - i].id : null, s3[i] ? s3[i].id : null, s4[15 - i] ? s4[15 - i].id : null].filter(x => x != null), host: h.id, de: null, champ: null, nat: i + 1 }));
    P.seedOf = {}; ranked.forEach((t, i) => { P.seedOf[t.id] = i + 1; });
    P.stage = 'reg'; P.label = 'Regionals'; P.day0 = SD.dateOf(sp.ncaa.regional);
    P.regs.forEach(R => { R.de = deNew(R.teams, P.day0); });
    deSchedule(g, P.regs, 'NCAA Regional');
  }
  // a four-team double-elimination bracket as a small state machine
  function deNew(teams, day0) { return { teams, day0, games: [], losses: Object.fromEntries(teams.map(t => [t, 0])), done: null, step: 0 }; }
  function deNextGames(de) {
    // returns the pairs to play next (or [] when finished)
    const alive = de.teams.filter(t => de.losses[t] < 2);
    if (alive.length === 1) { de.done = alive[0]; return []; }
    const W = alive.filter(t => de.losses[t] === 0), L = alive.filter(t => de.losses[t] === 1);
    const n = de.games.length;
    if (n === 0) return [[de.teams[0], de.teams[3]], [de.teams[1], de.teams[2]]];
    if (alive.length === 2) return [[alive[0], alive[1]]];
    const pairs = [];
    if (W.length >= 2) pairs.push([W[0], W[1]]);
    if (L.length >= 2) pairs.push([L[0], L[1]]);
    else if (W.length === 1 && L.length === 1 && alive.length === 2) pairs.push([W[0], L[0]]);
    return pairs;
  }
  function deSchedule(g, list, title, superMode) {
    const out = [];
    list.forEach((R, i) => {
      const de = R.de; if (de.done != null) return;
      const pairs = deNextGames(de); if (!pairs.length) return;
      const day = SD.addDays(de.day0, de.step);
      pairs.forEach(([a, b]) => { const host = R.host != null && [a, b].includes(R.host) ? R.host : ((g.post.seedOf[a] || 99) <= (g.post.seedOf[b] || 99) ? a : b); const x = mk(day, host, host === a ? b : a, { neutral: R.host == null || ![a, b].includes(R.host), kind: 'ncaa', title, ri: i }); de.games.push(x); out.push(x); });
      de.step++;
    });
    g.post.cur = out; g.sched.push(...out);
  }
  function deAfter(de) {
    de.games.forEach(x => { if (x.res && !x.counted) { x.counted = true; const l = x.res.h > x.res.a ? x.a : x.h; de.losses[l]++; } });
  }
  SD.diamondNext = () => {
    const g = G(), P = g.post, sp = SD.SP();
    if (P.cur && P.cur.some(x => !x.res)) return false;
    if (P.stage === 'reg' || P.stage === 'ws') {
      const list = P.stage === 'reg' ? P.regs : P.ws;
      list.forEach(R => { deAfter(R.de); deNextGames(R.de); });
      if (list.some(R => R.de.done == null)) { deSchedule(g, list, P.stage === 'reg' ? 'NCAA Regional' : sp.ncaa.wsName); return false; }
      list.forEach(R => { R.champ = R.de.done; });
      if (P.stage === 'reg') {
        // super regionals: 1 vs 16, 8 vs 9 ... best of three, the higher national seed hosts
        const order = [[0, 15], [7, 8], [3, 12], [4, 11], [1, 14], [6, 9], [2, 13], [5, 10]];
        P.sup = order.map(([a, b]) => { const A = P.regs[a].champ, B = P.regs[b].champ; const host = (P.seedOf[A] || 99) <= (P.seedOf[B] || 99) ? A : B; return { a: A, b: B, host, wins: { [A]: 0, [B]: 0 }, games: [], champ: null }; });
        P.stage = 'sup'; P.label = 'Super regionals'; P.supDay = SD.dateOf(sp.ncaa.superR); P.supN = 0;
        return SD.diamondNext();
      }
      // the CWS bracket winners meet in the finals
      P.fin = { a: P.ws[0].champ, b: P.ws[1].champ, wins: { [P.ws[0].champ]: 0, [P.ws[1].champ]: 0 }, games: [], champ: null };
      P.stage = 'fin'; P.label = sp.ncaa.wsName + ' finals'; P.finN = 0; P.finDay = SD.addDays(P.wsDay, 8);
      return SD.diamondNext();
    }
    if (P.stage === 'sup' || P.stage === 'fin') {
      const list = P.stage === 'sup' ? P.sup : [P.fin];
      list.forEach(S => S.games.forEach(x => { if (x.res && !x.counted) { x.counted = true; S.wins[x.res.h > x.res.a ? x.h : x.a]++; } if (S.wins[S.a] >= 2) S.champ = S.a; if (S.wins[S.b] >= 2) S.champ = S.b; }));
      const open = list.filter(S => S.champ == null);
      if (open.length) {
        const n = P.stage === 'sup' ? P.supN++ : P.finN++;
        const day = SD.addDays(P.stage === 'sup' ? P.supDay : P.finDay, n);
        const games = open.map(S => { const home = P.stage === 'fin' ? (n % 2 ? S.b : S.a) : S.host; const x = mk(day, home, home === S.a ? S.b : S.a, { neutral: P.stage === 'fin', kind: 'ncaa', title: P.stage === 'sup' ? 'NCAA Super Regional' : sp.ncaa.wsName + ' finals', gn: n }); S.games.push(x); return x; });
        P.cur = games; g.sched.push(...games); return false;
      }
      if (P.stage === 'sup') {
        const w = P.sup.map(S => S.champ);
        P.ws = [{ teams: [w[0], w[1], w[2], w[3]], host: null }, { teams: [w[4], w[5], w[6], w[7]], host: null }];
        P.wsDay = SD.dateOf(sp.ncaa.ws);
        P.ws.forEach(R => { R.de = deNew(R.teams, P.wsDay); });
        P.stage = 'ws'; P.label = sp.ncaa.wsName;
        deSchedule(g, P.ws, sp.ncaa.wsName); return false;
      }
      P.champ = P.fin.champ; P.stage = 'done'; P.cur = null; T(P.champ).natl = (T(P.champ).natl || 0) + 1;
      SD.news('ncaa', `${T(P.champ).name} wins the ${sp.ncaa.wsName}`, ''); return true;
    }
    return P.stage === 'done';
  };
  // after every postseason day
  SD.postAfterDay = () => { const g = G(); if (g.phase === 'ct') { if (SD.ctAfterDay()) { SD.selection(); } return; } if (g.phase === 'ncaa') { const done = SD.kind() === 'hoops' ? SD.madnessNext() : SD.diamondNext(); if (done) SD.endSeason(); } };

  /* ---------- the end of the season: awards and history ---------- */
  SD.awardScore = (p, t) => {
    const s = p.s; if (!s || !s.gp) return 0;
    if (SD.kind() === 'hoops') { const g = s.gp; return (s.pts + s.orb * 0.7 + s.drb * 0.5 + s.ast * 1.1 + s.stl * 1.5 + s.blk * 1.3 - s.to) / g * 3 + (t.w - t.l) * 0.4 + p.ovr * 0.15; }
    if (SD.isPit(p)) { const ip = s.ipo / 3; if (ip < 10) return 0; const era = s.er * (G().sport === 'softball' ? 7 : 9) / ip; return ip * 0.35 + s.k * 0.15 - era * 6 + (s.w || 0) * 2 + (s.sv || 0); }
    if (s.ab < 40) return 0; const avg = s.h / s.ab, obp = (s.h + s.bb + s.hbp) / Math.max(1, s.ab + s.bb + s.hbp), slg = (s.h + s.d2 + s.d3 * 2 + s.hr * 3) / s.ab;
    return (obp + slg) * 60 + s.hr * 1.2 + s.rbi * 0.25 + s.sb * 0.2 + p.at.fld * 0.05;
  };
  SD.endSeason = () => {
    const g = G(), ut = SD.userT(), sp = SD.SP();
    // awards
    const all = []; g.teams.forEach(t => t.roster.forEach(id => { const p = SD.P(id); const sc = SD.awardScore(p, t); if (sc > 0) all.push({ p, t, sc }); }));
    all.sort((a, b) => b.sc - a.sc);
    const A = g.awards[g.season] = {};
    const give = (p, k) => { p.aw = p.aw || []; p.aw.push({ y: g.season, a: k }); };
    A.poy = all[0] && all[0].p.id; if (all[0]) give(all[0].p, 'POY');
    A.aa1 = all.slice(0, SD.kind() === 'hoops' ? 5 : 12).map(x => x.p.id); A.aa1.forEach(id => give(SD.P(id), 'AA1'));
    const sec = all.filter(x => x.t.conf === 'SEC'); A.sec1 = sec.slice(0, SD.kind() === 'hoops' ? 5 : 12).map(x => x.p.id); A.sec1.forEach(id => give(SD.P(id), 'SEC1'));
    A.secPoy = sec[0] && sec[0].p.id; if (sec[0]) give(sec[0].p, 'SECPOY');
    const fr = sec.filter(x => x.p.yr === 1); A.secFr = fr[0] && fr[0].p.id; if (fr[0]) give(fr[0].p, 'SECFR');
    if (A.poy) SD.news('award', `${SD.P(A.poy).n} (${T(SD.P(A.poy).t).name}) is the National Player of the Year`, '');
    // history
    const P = g.post, me = P ? P.field.indexOf(g.user) : -1;
    let finish = me < 0 ? 'Missed the NCAA Tournament' : 'NCAA Tournament';
    if (P && me >= 0) {
      if (P.champ === g.user) finish = 'National champions';
      else { const lastG = g.sched.filter(x => x.kind === 'ncaa' && (x.h === g.user || x.a === g.user) && x.res).pop(); if (lastG) finish = 'Lost in the ' + lastG.title.replace(/^NCAA (East|West|South|Midwest) /, '').replace('NCAA ', ''); }
    }
    const secC = g.ct && g.ct.SEC && g.ct.SEC.champ === g.user;
    const entry = { y: g.season, w: ut.w, l: ut.l, cw: ut.cw, cl: ut.cl, ap: SD.apRank(ut.id), seed: P && P.seedOf ? P.seedOf[g.user] || null : null, finish, secReg: SD.standings('SEC')[0] && SD.standings('SEC')[0].id === g.user, secT: secC, champ: P && P.champ != null ? T(P.champ).name : null, poy: A.poy ? SD.P(A.poy).n : null };
    g.hist.push(entry);
    g.teams.forEach(t => t.hist.push({ y: g.season, w: t.w, l: t.l, ap: t.ap }));
    SD.news('season', `${SD.SP().label(g.season)} in the books: ${ut.w}-${ut.l}`, finish + '.');
    g.phase = 'offseason';
    if (SD.startOffseason) SD.startOffseason();
  };

  /* ---------- the primary action: what happens next ---------- */
  // advance the calendar until it is the user's game day (or the season moves to its next stage)
  SD.advanceToUser = () => {
    const g = G();
    if (g.phase === 'preseason') SD.startSeason();
    let guard = 0;
    while (guard++ < 400) {
      if (g.phase === 'offseason') return null;
      const nx = SD.nextUserGame();
      if (nx && nx.d <= SD.addDays(g.date, 0)) { SD.simTo(nx.d, false); return nx; }
      if (nx) { SD.simTo(nx.d, false); continue; }
      // no user game scheduled: play out the day, then let the postseason move
      const pend = g.sched.filter(x => !x.res);
      if (g.phase === 'season' && SD.regularOver()) { SD.updatePoll(); SD.setupCT(); continue; }
      if (!pend.length && (g.phase === 'ct' || g.phase === 'ncaa')) { SD.postAfterDay(); continue; }
      if (pend.length) { const d = pend.map(x => x.d).sort()[0]; SD.simTo(SD.addDays(d, 1), true); if (g.phase !== 'season') SD.postAfterDay(); continue; }
      return null;
    }
    return null;
  };
  // after the user's game: finish that day for everyone, then move on
  SD.afterUserGame = x => {
    const g = G();
    SD.gamesOn(x.d).filter(y => !y.res).forEach(y => SD.simGame(y));
    SD.endDay(x.d); g.date = SD.addDays(x.d, 1);
    if (g.phase === 'season' && SD.regularOver()) { SD.updatePoll(); SD.setupCT(); }
    else if (g.phase === 'ct' || g.phase === 'ncaa') { if (!g.sched.some(y => !y.res && y.d <= x.d)) SD.postAfterDay(); }
  };
  // sim the user's next game without playing it
  SD.simNext = () => { const x = SD.advanceToUser(); if (!x) return null; SD.simGame(x); SD.afterUserGame(x); return x; };
  SD.simToEnd = (stopPhase) => { const g = G(); let guard = 0; while (g.phase !== 'offseason' && guard++ < 200) { if (stopPhase && g.phase !== stopPhase && stopPhase !== 'end') break; const x = SD.simNext(); if (!x && g.phase !== 'offseason') { SD.advanceToUser(); if (!SD.nextUserGame() && g.phase !== 'offseason') { /* out of the postseason: play it out */ let n = 0; while (g.phase !== 'offseason' && n++ < 60) { const pend = g.sched.filter(y => !y.res); if (!pend.length) { SD.postAfterDay(); continue; } const d = pend.map(y => y.d).sort()[0]; SD.simTo(SD.addDays(d, 1), true); SD.postAfterDay(); } } } } };
  SD.phaseLabel = () => {
    const g = G(), sp = SD.SP(), yl = sp.label(g.season);
    if (g.phase === 'preseason') return `${yl} preseason`;
    if (g.phase === 'season') return `${yl} · ${SD.dateStr(g.date)}`;
    if (g.phase === 'ct') return `${yl} · Conference tournaments`;
    if (g.phase === 'ncaa') return `${yl} · ${g.post.label}`;
    if (g.phase === 'offseason') return `${yl} offseason · ${SD.OFF_LABEL ? SD.OFF_LABEL[g.off.stage] : ''}`;
    return yl;
  };
})(typeof window !== 'undefined' ? window : globalThis);
