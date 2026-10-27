/* The Vol Index — Football Dynasty: recruiting (weekly, 247-style composite), the offseason (NIL renegotiation,
   transfer portal, signing day, NFL draft, progression with boom/bust, non-conference scheduling, the new season)
   and the coach's legacy board. */
(function (root) {
  'use strict';
  const DY = root.DY;
  const { rr, ri, chance, pick, gauss, clamp, wpick, shuffle } = DY;
  const rnd = () => DY.r();
  const G = () => DY.G;

  DY.COACH_ARCH = {
    motivator: { name: 'Motivator', desc: 'Players play up in big moments: a small clutch bump for the whole team.' },
    recruiter: { name: 'Recruiter', desc: '+12 recruiting hours a week and better visits.' },
    guru: { name: 'Offensive Guru', desc: 'Up-tempo offense; offensive players develop 10% faster.' },
    architect: { name: 'Defensive Architect', desc: 'Defensive players develop 10% faster; the defense reads tendencies sooner.' },
    developer: { name: 'Program Builder', desc: 'Everyone develops 6% faster and fewer players bust.' },
  };
  DY.HOURS = () => 50 + (G().coach.arch === 'recruiter' ? 12 : 0);
  DY.BOARD_MAX = 30;
  DY.ACTIONS = { dm: { name: 'Social media', hrs: 1, pts: 4 }, call: { name: 'Phone call', hrs: 3, pts: 12 }, coach: { name: 'Head coach visit', hrs: 7, pts: 30 }, scout: { name: 'Scout', hrs: 3, pts: 0 } };
  DY.PREFS = { pt: 'Playing time', nil: 'NIL', champ: 'Title contender', prox: 'Close to home', brand: 'Brand exposure', coach: 'Coach stability', pro: 'Pro potential', dev: 'Player development' };

  /* ---------- a recruiting class ---------- */
  const POS_SHARE = [['QB', 7], ['RB', 8], ['WR', 15], ['TE', 6], ['OT', 9], ['IOL', 8], ['EDGE', 11], ['DT', 9], ['LB', 9], ['CB', 11], ['S', 8], ['K', 1], ['P', 0.8]];
  const htIn = s => { const m = /(\d+)-(\d+)/.exec(s || ''); return m ? +m[1] * 12 + +m[2] : null; };
  function realPos(r) {
    const ht = htIn(r.ht) || 74;
    if (r.pos === 'OL') return ht >= 77 ? 'OT' : 'IOL';
    if (r.pos === 'DL') return r.wt >= 280 ? 'DT' : 'EDGE';
    if (r.pos === 'DB') return r.wt >= 195 ? 'S' : 'CB';
    if (r.pos === 'ATH') return 'WR';
    if (r.pos === 'PK') return 'K';
    return DY.W[r.pos] ? r.pos : 'WR';
  }
  function prospect(pos, c, o) {
    o = o || {};
    if (pos === 'K' || pos === 'P' || pos === 'LS') c = Math.min(c, 0.888);   // specialists are never more than three stars
    const g = c * 100;
    // elite prospects arrive closer to ready: a top 5-star lands around 78-83
    const ovr = Math.round(clamp(61.5 + (g - 80) * 0.7 - 1 + Math.max(0, g - 90) * 0.75 + gauss() * (g >= 98 ? 1.7 : 3), 45, 85));
    const p = DY.makePlayer(pos, ovr, Object.assign({ t: null, yr: 1, el: 5, grade: g, rec: { c, stars: DY.starsOf(c, pos), g } }, o));
    p.pros = true; p.interest = {}; p.commit = null; p.pref = prefs(); p.scout = 0; p.acts = {}; p.offer = false; p.visit = null; p.nilOffer = 0;
    // gems and busts: the composite misses on some players
    const exp = ovr + 14 + (g - 85) * 0.35;
    p.gem = p.ceil >= exp + 5; p.bust = p.ceil <= exp - 6;
    return p;
  }
  function prefs() { const ks = shuffle(Object.keys(DY.PREFS)); return { top: ks.slice(0, 3), deal: chance(0.35) ? ks[0] : null }; }
  DY.genClass = (year, withReal) => {
    const g = G(), out = [];
    const n5 = 32, n4 = 300, n3 = 170;
    const comps = [];
    for (let i = 0; i < n5; i++) comps.push(rr(0.9834, 0.9999));
    for (let i = 0; i < n4; i++) comps.push(0.89 + Math.pow(rnd(), 1.6) * 0.0933);
    for (let i = 0; i < n3; i++) comps.push(rr(0.855, 0.8899));
    comps.sort((a, b) => b - a);
    comps.forEach(c => { const pos = wpick(POS_SHARE, x => x[1])[0]; out.push(prospect(pos, Math.round(c * 1e4) / 1e4)); });
    // real commits
    if (withReal) {
      const F = root.SITE && root.SITE.football;
      const list = year === 2027 ? (F && F.recruits || []) : year === 2028 ? (F && F.recruits2028 || []) : [];
      list.forEach(r => {
        const pos = r.pos === 'LS' ? 'LS' : realPos(r);
        let c = clamp(0.70 + (r.grade - 70) * 0.01, 0.75, 0.9999);
        if (r.stars >= 5) c = Math.max(c, 0.9845); else if (r.stars === 4) c = clamp(c, 0.8905, 0.9833); else if (r.stars === 3) c = clamp(c, 0.80, 0.8899);
        c = Math.round(c * 1e4) / 1e4;
        const hm = /,\s*([A-Za-z.]+)$/.exec(r.home || '');
        const p = prospect(pos, c, { n: r.name, home: r.home, st: hm ? DY.stAbbr(hm[1]) : 'TN', hs: r.hs, ht: htIn(r.ht) || undefined, wt: r.wt || undefined });
        p.real = true; p.commit = DY.UT_ID; p.firm = true; p.interest[DY.UT_ID] = 200; p.offer = true; p.realNat = r.nat ? +r.nat : null;
        out.push(p);
      });
    }
    // national, position and state ranks
    out.sort((a, b) => b.rec.c - a.rec.c);
    const posN = {}, stN = {};
    out.forEach((p, i) => { p.rec.nat = i + 1; posN[p.pos] = (posN[p.pos] || 0) + 1; p.rec.posRank = posN[p.pos]; stN[p.st] = (stN[p.st] || 0) + 1; p.rec.stRank = stN[p.st]; });
    // who is in on each player at the start
    out.forEach(p => seedInterest(p));
    return out;
  };
  const dist = (a, b) => { const A = DY.STATE_LL[a] || [35, -86], B = DY.STATE_LL[b] || [35, -86]; const dx = (A[1] - B[1]) * Math.cos((A[0] + B[0]) / 2 * Math.PI / 180), dy = A[0] - B[0]; return Math.sqrt(dx * dx + dy * dy) * 69; };
  DY.miles = dist;
  // how a school grades on what a prospect cares about (0-1)
  DY.fit = (t, p) => {
    const g = G(), d = dist(t.st, p.st);
    const depth = t.roster.map(DY.P).filter(x => x.pos === p.pos && x.el > 1).sort((a, b) => b.ovr - a.ovr);
    const starters = DY.STARTERS[p.pos] || 1;
    const pt = clamp(1 - (depth.length >= starters ? (depth[starters - 1].ovr - p.ovr - 4) / 16 : -0.5), 0.15, 1);
    const rank = t.ap || 40;
    const f = {
      pt, nil: clamp((t.budget || 4e6) / 34e6, 0.1, 1) * (p.nilOffer && t.user ? 1.25 : 1), champ: clamp(1 - (rank - 1) / 30, 0.1, 1) * 0.6 + clamp((t.elo - 1450) / 350, 0, 1) * 0.4,
      prox: clamp(1 - d / 900, 0.05, 1), brand: clamp(t.prestige / 95, 0.2, 1) * (DY.P4.includes(t.conf) ? 1 : 0.6), coach: t.user ? clamp(0.55 + g.hist.length * 0.08, 0.5, 1) : 0.7,
      pro: clamp((t.prestige - 40) / 55, 0.1, 1), dev: clamp(0.5 + (t.prestige - 60) / 80, 0.2, 1),
    };
    return f;
  };
  DY.fitScore = (t, p) => { const f = DY.fit(t, p); let s = 0.35; p.pref.top.forEach((k, i) => { s += f[k] * [0.38, 0.24, 0.16][i]; }); if (p.pref.deal && f[p.pref.deal] < 0.45) s *= 0.55; return s; };
  DY.grade = v => v >= 0.92 ? 'A+' : v >= 0.85 ? 'A' : v >= 0.78 ? 'A-' : v >= 0.7 ? 'B+' : v >= 0.62 ? 'B' : v >= 0.55 ? 'B-' : v >= 0.47 ? 'C+' : v >= 0.4 ? 'C' : v >= 0.3 ? 'C-' : 'D';
  function seedInterest(p) {
    const g = G();
    const ts = g.teams.filter(t => !t.user || true);
    const want = p.rec.stars >= 5 ? 9 : p.rec.stars === 4 ? 7 : 5;
    const scored = ts.map(t => ({ t, w: Math.pow(t.prestige / 60, p.rec.stars >= 4 ? 5 : 2.5) * (0.35 + DY.fit(t, p).prox * 1.2) * (DY.P4.includes(t.conf) || t.abbr === 'ND' ? 1 : (p.rec.stars >= 4 ? 0.12 : 0.6)) * rr(0.5, 1.5) }));
    const top = [];
    for (let i = 0; i < want; i++) { const pk = wpick(scored.filter(x => !top.includes(x.t.id)), x => x.w); if (pk) top.push(pk.t.id); }
    top.forEach(id => { if (p.interest[id] == null) p.interest[id] = Math.round(rr(5, 30)); });
  }
  DY.classPoints = (ids) => ids.map(DY.RP).filter(Boolean).sort((a, b) => b.rec.c - a.rec.c).reduce((s, p, i) => s + p.rec.c * 100 * Math.exp(-(i * i) / (2 * 100)), 0);

  /* ---------- the recruiting season ---------- */
  DY.RP = id => G().recruit && G().recruit.pool[id];
  DY.initRecruiting = withReal => {
    const g = G(), year = g.season + 1;
    const list = DY.genClass(year, withReal);
    const pool = {}; list.forEach(p => { pool[p.id] = p; });
    // year one: the real class is locked in (with NIL promises sized to each player's market value)
    const locked = !!withReal && year === (g.startSeason || 2026) + 1 && g.user === DY.UT_ID;
    g.recruit = { year, pool, board: [], hours: DY.HOURS(), log: [], classRank: null, signed: false, locked };
    const ut = DY.userT();
    list.filter(p => p.commit === g.user).forEach(p => { g.recruit.board.push(p.id); p.nilOffer = DY.recruitNil(p); p.nilLocked = true; });
    DY.rankClasses();
  };
  DY.boardAdd = id => { const R = G().recruit; if (R.locked) return 'Recruiting is locked in year one: the real 2027 class.'; if (R.board.includes(id)) return null; if (R.board.length >= DY.BOARD_MAX) return 'Your board is full (30). Remove someone first.'; R.board.push(id); const p = DY.RP(id); if (p.interest[G().user] == null) p.interest[G().user] = 0; return null; };
  DY.boardRemove = id => { const R = G().recruit; R.board = R.board.filter(x => x !== id); };
  DY.hoursUsed = () => { const R = G().recruit; let h = 0; R.board.forEach(id => { const p = DY.RP(id); for (const a in p.acts) h += DY.ACTIONS[a].hrs; }); return h; };
  DY.setAct = (id, act, on) => {
    const p = DY.RP(id); if (!p) return 'Not found.';
    if (G().recruit.locked) return 'Recruiting is locked in year one: the real 2027 class.';
    if (p.commit && p.commit !== G().user && p.firm) return `${p.n} is locked in with ${DY.T(p.commit).name}.`;
    if (on) {
      if (act === 'coach' && Object.values(G().recruit.pool).filter(x => x.acts.coach).length >= 4) return 'You can make 4 head coach visits a week.';
      if (act === 'scout' && p.scout >= 3) return 'Fully scouted.';
      const used = DY.hoursUsed() + DY.ACTIONS[act].hrs - (p.acts[act] ? DY.ACTIONS[act].hrs : 0);
      if (used > DY.HOURS()) return `Not enough hours left this week (${DY.HOURS() - DY.hoursUsed()} left).`;
      p.acts[act] = 1;
    } else delete p.acts[act];
    return null;
  };
  DY.offer = id => { const p = DY.RP(id); if (p.offer) return null; const R = G().recruit; if (R.locked) return 'Recruiting is locked in year one: the real 2027 class.'; const n = Object.values(R.pool).filter(x => x.offer && !x.real).length; if (n >= 40) return 'You have 40 scholarship offers out.'; p.offer = true; p.interest[G().user] = (p.interest[G().user] || 0) + 10; return null; };
  DY.setNil = (id, amt) => { const p = DY.RP(id); if (p.nilLocked) return 'That NIL promise is locked.'; p.nilOffer = Math.max(0, Math.round(amt / 5000) * 5000); return null; };
  DY.setVisit = (id, wk) => {
    const g = G(), p = DY.RP(id);
    const games = DY.userGames(wk).filter(x => x.h === g.user && !x.res);
    if (!games.length) return 'Official visits are for home games.';
    if (Object.values(g.recruit.pool).filter(x => x.visit === wk).length >= 6) return 'Six visitors a weekend is the limit.';
    if (p.visit) return 'He has already scheduled his visit.';
    p.visit = wk; return null;
  };
  // the user's week: hours turn into interest, scaled by how well Tennessee fits what he wants
  DY.recruitWeek = w => {
    const g = G(), R = g.recruit; if (!R || R.signed) return;
    const ut = DY.userT(), mode = R.locked ? 'off' : g.settings.recruiting;
    if (mode === 'auto') DY.autoRecruit();
    const logs = [];
    const full = DY.myCommits().length >= DY.CAP.hs;
    if (mode !== 'off') R.board.forEach(id => {
      const p = DY.RP(id); if (!p) return;
      let pts = 0;
      for (const a in p.acts) { if (a === 'scout') { p.scout = Math.min(3, p.scout + 1); continue; } pts += DY.ACTIONS[a].pts; }
      if (p.offer) pts += 3;
      if (p.nilOffer) pts += Math.min(25, p.nilOffer / Math.max(30000, DY.nilValue(p, ut) * 0.9) * 10) * (p.pref.top.includes('nil') ? 1.6 : 0.8);
      // official visit this week
      if (p.visit === w) {
        const x = DY.userGames(w)[0];
        const won = x && x.res && ((x.h === ut.id) === (x.res.h > x.res.a));
        const opp = x ? DY.T(DY.oppOf(x)) : null, big = opp && (opp.ap || 99) <= 25;
        const v = (won ? 55 : 18) + (big ? 20 : 0) + (g.coach.arch === 'recruiter' ? 12 : 0);
        pts += v; logs.push(`${p.n} (${p.rec.stars}★ ${p.pos}) took his official visit: ${won ? (DY.isTN && DY.isTN() ? 'Neyland delivered' : 'the home crowd delivered') : 'a tough loss to watch'}.`);
        p.visited = true;
      }
      p.acts = {};
      // fairness: stacking everything on one kid has diminishing returns, fit matters, and a crowded position room scares off players who want to play
      const atPos = DY.myCommits().filter(x => x.pos === p.pos && x !== p).length, room = Math.max(2, Math.round((DY.STARTERS[p.pos] || 1) * 1.5));
      const crowd = atPos >= room ? (p.pref.top.includes('pt') ? 0.65 : 0.88) : 1;
      pts = 140 * (1 - Math.exp(-pts / 140));
      if (pts > 0) p.interest[ut.id] = (p.interest[ut.id] || 0) + pts * (0.45 + DY.fitScore(ut, p)) * (p.offer ? 1 : 0.55) * crowd * DY.pull(ut, p);
    });
    // everyone else
    Object.values(R.pool).forEach(p => {
      if (p.commit && p.firm) return;
      for (const tid in p.interest) {
        const t = g.teams[tid]; if (t.user) continue;
        // blue-bloods go hardest after the elite kids
        const heat = p.rec.stars >= 5 ? 1.12 + Math.max(0, t.prestige - 82) / 80 : p.rec.stars === 4 ? 1.04 + Math.max(0, t.prestige - 82) / 150 : 0.9;
        p.interest[tid] += (6 + t.prestige / 9) * (0.45 + DY.fitScore(t, p)) * rr(0.35, 1.5) * heat;
      }
      // commits
      const order = Object.entries(p.interest).sort((a, b) => b[1] - a[1]);
      if (!order.length) return;
      const [lead, lv] = order[0], second = order[1] ? order[1][1] : 0;
      // the bar to commit drops as the season goes (most of a class is done by the early signing period)
      const need = (140 + p.rec.stars * 15 + (w <= 4 ? 40 : 0)) * (1 - Math.min(w, 14) / 24);
      // four- and five-stars want to see campus (an official visit) before they commit to you
      const visitOk = p.rec.stars < 4 || p.visited || w >= (p.rec.stars >= 5 ? 12 : 8);
      if (!p.commit && lv >= need && lv >= second * (w >= 10 ? 1.08 : 1.2) && (!g.teams[lead].user || (p.offer && !full && visitOk))) {
        p.commit = +lead;
        if (g.teams[lead].user) { logs.push(`COMMIT: ${p.n}, ${p.rec.stars}★ ${p.pos} from ${p.home}, commits to ${DY.UN()}!`); DY.news('commit', `${p.rec.stars}-star ${DY.POS_NAME[p.pos].toLowerCase()} ${p.n} commits to ${DY.UN()}`, `No. ${p.rec.nat} nationally (${p.rec.c.toFixed(4)} composite). ${p.home}, ${p.hs}.`, { rid: p.id }); }
        else if (p.rec.nat <= 50 && R.board.includes(p.id)) logs.push(`${p.n} (No. ${p.rec.nat}) commits to ${g.teams[lead].name}.`);
      } else if (p.commit && !p.firm && +lead !== p.commit && lv >= (p.interest[p.commit] || 0) * 1.35 && (!g.teams[lead].user || p.offer)) {
        const was = p.commit; p.commit = +lead;
        if (g.teams[lead].user) { logs.push(`FLIP: ${p.n} flips from ${g.teams[was].name} to ${DY.UN()}!`); DY.news('commit', `${p.n} flips to ${DY.UN()}`, `The ${p.rec.stars}-star ${p.pos} had been committed to ${g.teams[was].name}.`); }
        else if (g.teams[was].user) { logs.push(`DECOMMIT: ${p.n} flips to ${g.teams[lead].name}.`); DY.news('commit', `${p.n} flips from ${DY.UN()} to ${g.teams[lead].name}`, ''); }
      }
    });
    R.log = logs.concat(R.log).slice(0, 60);
    R.hours = DY.HOURS();
    DY.rankClasses();
  };
  // program pull: how much a school's pitch counts with a recruit. Blue-chips discount low-prestige programs,
  // so a rebuild takes years of winning (prestige) instead of one good recruiting season. Tennessee-level programs ~1.0.
  DY.pull = (t, p) => {
    const pr = t.prestige || 60; let m = clamp(0.55 + (pr - 45) / 70, 0.6, 1.12);
    if (p.rec.stars >= 5) m *= clamp((pr - 55) / 30, 0.15, 1.1);
    else if (p.rec.stars === 4) m *= clamp((pr - 45) / 35, 0.3, 1.08);
    return m;
  };
  DY.rankClasses = () => {
    const g = G(), R = g.recruit, by = {};
    Object.values(R.pool).forEach(p => { if (p.commit != null) (by[p.commit] = by[p.commit] || []).push(p.id); });
    const pts = Object.keys(by).map(t => [+t, DY.classPoints(by[t])]).sort((a, b) => b[1] - a[1]);
    R.ranks = pts.map(x => x[0]); R.points = Object.fromEntries(pts);
    const i = R.ranks.indexOf(g.user); R.classRank = i >= 0 ? i + 1 : null;
    R.commits = by;
  };
  DY.myCommits = () => Object.values(G().recruit.pool).filter(p => p.commit === G().user);
  // CPU recruiting for Tennessee: keep a board of the best fits at positions of need and spread the hours
  DY.autoRecruit = () => {
    const g = G(), R = g.recruit, ut = DY.userT();
    if (R.locked) return;
    const needs = DY.teamNeeds(ut);
    const cand = Object.values(R.pool).filter(p => !p.commit || p.commit === ut.id).filter(p => !p.real || p.commit === ut.id);
    // aim where the program can actually land players: value discounted by pull (blue-chips mostly ignore low-prestige schools)
    cand.forEach(p => {
      const pl = DY.pull(ut, p), rival = Math.max(0, ...Object.entries(p.interest).filter(([t]) => +t !== ut.id).map(([, v]) => v));
      // smaller programs look for players the big schools aren't already winning
      p._s = p.rec.c * 100 * (0.55 + pl * 0.45) - (pl < 0.4 ? 25 : 0) + (needs[p.pos] || 0) * 6 + DY.fitScore(ut, p) * 12 + (p.interest[ut.id] || 0) / 20 - rival * (1 - Math.min(1, pl)) * 0.25;
      if (['K', 'P', 'LS'].includes(p.pos) && !(needs[p.pos] > 0)) p._s -= 1000;
    });
    const room = Math.max(0, DY.CAP.hs - DY.myCommits().length);
    let spec = DY.myCommits().filter(p => ['K', 'P', 'LS'].includes(p.pos)).length;
    const want = cand.filter(p => p.commit !== ut.id).sort((a, b) => b._s - a._s).filter(p => !['K', 'P', 'LS'].includes(p.pos) || spec++ < 1).slice(0, Math.min(DY.BOARD_MAX - Math.min(18, DY.myCommits().length), room + 6));
    R.board = DY.myCommits().map(p => p.id).concat(want.map(p => p.id)).slice(0, DY.BOARD_MAX);
    let hrs = DY.HOURS(), coach = 4;
    want.forEach(p => { if (p.interest[ut.id] == null) p.interest[ut.id] = 0; if (!p.offer) DY.offer(p.id); p.acts = {}; if (coach > 0 && hrs >= 7 && p.rec.stars >= 4) { p.acts.coach = 1; hrs -= 7; coach--; } else if (hrs >= 3) { p.acts.call = 1; hrs -= 3; } else if (hrs >= 1) { p.acts.dm = 1; hrs -= 1; } });
    const homeWk = DY.userGames().find(x => x.h === ut.id && !x.res && x.wk > g.week);
    if (homeWk) want.slice(0, 4).forEach(p => { if (!p.visit) DY.setVisit(p.id, homeWk.wk); });
  };
  DY.teamNeeds = t => {
    const out = {};
    for (const pos in DY.STARTERS) {
      const have = t.roster.map(DY.P).filter(p => p.pos === pos && p.el > 1).length;
      const target = Math.round(DY.STARTERS[pos] * (t.user ? 3.6 : 2.4)) + (pos === 'QB' ? 1 : 0);
      out[pos] = clamp(target - have, 0, 8);
    }
    return out;
  };

  /* ---------- the offseason ---------- */
  DY.OFF_LABEL = { recap: 'Season recap', nil: 'NIL & budget', portal: 'Transfer portal', signing: 'Signing day', draft: 'NFL Draft', progress: 'Progression', cuts: 'Roster cut-down', schedule: 'Non-conference schedule' };
  DY.OFF_ORDER = ['recap', 'nil', 'portal', 'signing', 'draft', 'progress', 'cuts', 'schedule'];
  // limits per offseason (AJ): 30 newcomers (20 high school, 20 transfers), 30 departures, 15 transfers out, 15 NFL entries
  DY.CAP = { newcomers: 30, hs: 20, tin: 20, out: 30, tout: 15, nfl: 15 };
  DY.ROSTER_MAX = 85;
  DY.rosterMax = () => DY.ROSTER_MAX;
  DY.startOffseason = () => {
    const g = G();
    g.off = { stage: 'recap', leaving: [], portal: null, draft: null, prog: [], nilAsk: [], season: g.season };
    // bank the season, burn eligibility, decide who leaves
    g.teams.forEach(t => {
      t.roster.forEach(id => {
        const p = DY.P(id), s = p.s || { gp: 0 };
        if (p.s) { p.car[g.season] = Object.assign({ t: t.abbr }, p.s); }
        p.lastGp = s.gp || 0; p.lastScore = DY.awardScore(p, t);
        p.el--;
        p.s = null; p.inj = p.inj && p.inj.wks >= 12 ? { wks: 3, what: p.inj.what } : null;
        if (p.el <= 0) p.leave = 'grad';
        else if (p.yr >= 3) {
          const dg = DY.draftGrade(p);
          const pr = dg >= 91 ? 0.85 : dg >= 87 ? 0.55 : dg >= 84 ? 0.2 : dg >= 81 ? 0.05 : 0;
          if (chance(pr * (p.tr.ego > 75 ? 1.15 : 1) * (p.tr.loyal > 90 ? 0.7 : 1))) { p.leave = 'nfl'; p.dg = dg; }
        }
      });
      // never more than 15 early entries from one school
      const nfl = t.roster.map(DY.P).filter(p => p.leave === 'nfl').sort((a, b) => b.dg - a.dg);
      nfl.slice(DY.CAP.nfl).forEach(p => { p.leave = null; });
    });
    const ut = DY.userT();
    g.off.leaving = ut.roster.filter(id => DY.P(id).leave).map(id => ({ id, why: DY.P(id).leave }));
    g.off.pitched = {};
    DY.updateLegacy();
    DY.coachSeason();
    DY.jobReview();
  };
  /* ---------- the coaching carousel (dynasties that did not start at Tennessee) ----------
     Your season is judged against what the program expects (its prestige): win more than expected, win the conference,
     make the playoff, and better jobs call. Fall well short (or two bad years in a row) and you are fired: you pick from the
     jobs still open, usually a step down. */
  DY.expectedWins = t => clamp(3.5 + (t.prestige - 45) / 6.5, 3, 11);
  // the AD's goal for this season (non-Tennessee dynasties): wins from the program's prestige, adjusted for the schedule
  DY.coachGoal = () => {
    const g = G(), ut = DY.userT();
    if ((g.startTeam || 'Tennessee') === 'Tennessee') return null;
    const cg = g.coach.goal;
    if (cg && cg.season === g.season && cg.team === ut.id) return cg;
    const opp = DY.userGames().filter(x => x.wk >= 0).map(x => DY.T(DY.oppOf(x))).filter(Boolean);
    const oppP = opp.length ? opp.reduce((s, t) => s + (t.prestige || 50), 0) / opp.length : 65;
    const wins = Math.round(clamp(DY.expectedWins(ut) - (oppP - 66) / 10, 3, 11));
    const pr = ut.prestige;
    const text = pr >= 90 ? 'Win the conference and make a deep playoff run' : pr >= 82 ? 'Make the playoff' : pr >= 74 ? 'Contend for the conference and win a bowl' : pr >= 64 ? 'Get to a bowl game' : 'Show progress: become bowl eligible';
    g.coach.goal = { season: g.season, team: ut.id, wins, text, oppP: Math.round(oppP) };
    return g.coach.goal;
  };
  // job security 0-100 during the season: pace against the AD's goal plus recent history (first year gets grace)
  DY.jobSecurity = () => {
    const g = G(), ut = DY.userT(), goal = DY.coachGoal(); if (!goal) return null;
    const played = ut.w + ut.l, left = Math.max(0, 12 - played);
    const rate = (ut.w + goal.wins / 12 * 3) / (played + 3);   // early on, lean on what the AD expected
    const pace = ut.w + left * rate;
    const hist = (g.coach.perf || []).slice(-2), prior = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
    const years = g.season - (g.coach.since || g.startSeason) + 1;
    const v = Math.round(clamp(60 + (pace - goal.wins) * 9 + prior * 3 + (years <= 1 ? 15 : 0), 2, 98));
    const label = v >= 75 ? 'Secure' : v >= 55 ? 'Stable' : v >= 35 ? 'Warm seat' : 'Hot seat';
    return { v, label, pace: Math.round(pace * 10) / 10, goal, years };
  };
  DY.jobReview = () => {
    const g = G(), ut = DY.userT(), o = g.off;
    o.jobs = null;
    if ((g.startTeam || 'Tennessee') === 'Tennessee') return;
    const gl = g.coach.goal && g.coach.goal.season === g.season && g.coach.goal.team === ut.id ? g.coach.goal : null;
    const h = g.hist[g.hist.length - 1] || {}, exp = gl ? gl.wins : DY.expectedWins(ut);
    let score = (ut.w - exp) * 0.9 + (h.sec ? 2 : 0) + (h.cfpSeed ? 2.5 : 0) + (h.finish === 'National champions' ? 5 : 0) + (/Semifinal|Championship/.test(h.finish || '') ? 1.5 : 0);
    g.coach.perf = (g.coach.perf || []).concat([Math.round(score * 10) / 10]).slice(-4);
    const last2 = g.coach.perf.slice(-2), years = g.season - (g.coach.since || g.startSeason) + 1;
    const fired = years >= 2 && (score <= -4.5 || (last2.length === 2 && last2[0] <= -2 && last2[1] <= -2));
    const hot = !fired && score <= -2;
    const pool = g.teams.filter(t => t.id !== ut.id && t.fbs !== false);
    let offers = [];
    if (fired) offers = DY.shuffle(pool.filter(t => t.prestige <= ut.prestige - 4 && t.prestige >= ut.prestige - 30)).slice(0, 3);
    else if (score >= 1.5) {
      const up = Math.min(30, 6 + score * 3.5);
      offers = DY.shuffle(pool.filter(t => t.prestige > ut.prestige + 2 && t.prestige <= ut.prestige + up)).slice(0, score >= 4 ? 3 : score >= 2.5 ? 2 : 1);
    } else if (score > -1 && chance(0.35)) offers = DY.shuffle(pool.filter(t => Math.abs(t.prestige - ut.prestige) <= 4)).slice(0, 1);
    o.jobs = { score: Math.round(score * 10) / 10, exp: Math.round(exp * 10) / 10, fired, hot, offers: offers.map(t => t.id), taken: null };
    if (fired) DY.news('league', `${g.coach.name} is fired at ${ut.name}`, `${ut.w}-${ut.l} fell short of what ${ut.name} expects. ${offers.length} school${offers.length === 1 ? '' : 's'} want to talk.`);
    else if (offers.length) DY.news('league', `${g.coach.name} draws interest from ${offers.map(t => t.name).join(', ')}`, 'The coaching carousel is spinning.');
    else if (hot) DY.news('league', `${g.coach.name} is on the hot seat at ${ut.name}`, `Expected about ${Math.round(exp)} wins; went ${ut.w}-${ut.l}.`);
  };
  DY.takeJob = id => {
    const g = G(), o = g.off, old = DY.userT(), t = DY.T(id);
    if (!o || !o.jobs || !o.jobs.offers.includes(id) || o.stage !== 'recap') return 'That offer is off the table.';
    old.user = false; old.coach = DY.coachName(); old.depthEdited = false; DY.refreshDepth(old);
    (g.coach.stints = g.coach.stints || []).push({ team: old.name, from: g.coach.since || g.startSeason, to: g.season });
    g.user = t.id; t.user = true; t.coach = g.coach.name; t.depthEdited = false; t.style = g.settings.offStyle || t.style; g.coach.since = g.season + 1; g.coach.perf = [];
    if (t.id !== DY.UT_ID && t.roster.length < 80) DY.fillRoster(t, 82);
    DY.initNil(t); DY.pickCaptains(t); DY.refreshDepth(t);
    // this offseason now belongs to the new school
    o.leaving = t.roster.filter(x => DY.P(x).leave).map(x => ({ id: x, why: DY.P(x).leave })); o.pitched = {};
    if (g.recruit) g.recruit.board = DY.myCommits().map(p => p.id);
    o.jobs.taken = id; o.jobs.offers = [];
    DY.initRecords();
    DY.news('league', `${g.coach.name} takes the ${t.name} job`, `Leaving ${old.name} after ${g.season - ((g.coach.stints[g.coach.stints.length - 1] || {}).from || g.startSeason) + 1} season${g.season > ((g.coach.stints[g.coach.stints.length - 1] || {}).from || g.startSeason) ? 's' : ''}.`);
    return null;
  };
  DY.draftGrade = p => p.ovr + ({ QB: 3, EDGE: 2.5, OT: 2, CB: 2, WR: 1.5, DT: 1, S: 0.5, LB: 0, RB: -0.5, IOL: 0, TE: -0.5, K: -12, P: -12, LS: -20 }[p.pos] || 0) + (p.at.spd >= 90 ? 1 : 0) + p.aw.filter(a => /AA1|HEIS/.test(a.a)).length * 1.5;
  // talk an early entrant into one more year: an NIL raise and his loyalty against his draft stock
  DY.persuade = (id, raise) => {
    const g = G(), o = g.off, p = DY.P(id), ut = DY.userT();
    if (o.pitched[id] != null) return 'You already made your pitch.';
    if (DY.payroll(ut) + raise > ut.budget * 1.02) return `That raise would put you over your NIL budget (${DY.money(ut.budget - DY.payroll(ut))} open).`;
    const dg = p.dg || DY.draftGrade(p);
    const ch = clamp(0.55 - (dg - 82) * 0.06 + (p.tr.loyal - 60) / 140 + raise / Math.max(100000, p.nilV || DY.nilValue(p, ut)) * 0.3, 0.02, 0.85);
    const ok = chance(ch);
    o.pitched[id] = ok;
    if (ok) { p.leave = null; p.nil += raise; o.leaving = o.leaving.filter(x => x.id !== id); DY.addLog(p, `Returned for another season (NIL now ${DY.money(p.nil)}).`); DY.news('nil', `${p.n} is coming back to ${DY.UN()}`, `He had declared for the NFL Draft.`, { pid: p.id }); }
    return ok ? `${p.n} is coming back!` : `${p.n} is staying in the draft.`;
  };
  // in-season look ahead: how likely a junior or older is to leave early for the NFL
  DY.declareChance = p => {
    if (!p || p.el <= 1 || p.yr < 3) return 0;
    const dg = DY.draftGrade(p), pr = dg >= 91 ? 0.85 : dg >= 87 ? 0.55 : dg >= 84 ? 0.2 : dg >= 81 ? 0.05 : 0;
    return Math.min(0.95, pr * (p.tr.ego > 75 ? 1.15 : 1) * (p.tr.loyal > 90 ? 0.7 : 1));
  };
  DY.draftProj = p => { const dg = DY.draftGrade(p); return dg >= 91 ? 'Round 1' : dg >= 87 ? 'Rounds 1-2' : dg >= 84 ? 'Rounds 2-3' : 'Day 3'; };
  // the projected roster for next season at any point of the offseason: who is still here, who is coming
  DY.projRoster = () => {
    const g = G(), ut = DY.userT(), o = g.off || {}, cut = new Set(o.cut || []);
    const inSeason = g.phase !== 'offseason';
    const stay = ut.roster.map(DY.P).filter(p => p && !p.leave && !(p.portal && p.portal.from === ut.id) && !cut.has(p.id) && !(inSeason && p.el <= 1));
    const inc = g.recruit && !g.recruit.signed ? DY.myCommits() : [];
    const all = stay.map(p => ({ p, nw: !!(p.tin === g.season || (p.firstY && p.firstY > g.season)) })).concat(inc.map(p => ({ p, nw: true, commit: true })));
    const by = {};
    Object.keys(DY.STARTERS).forEach(pos => { by[pos] = all.filter(x => x.p.pos === pos).sort((a, b) => b.p.ovr - a.p.ovr); });
    return { by, n: all.length, out: ut.roster.length - stay.length, inc: inc.length };
  };
  DY.persuadeChance = (p, raise) => { const dg = p.dg || DY.draftGrade(p); return clamp(0.55 - (dg - 82) * 0.06 + (p.tr.loyal - 60) / 140 + (raise || 0) / Math.max(100000, p.nilV || DY.nilValue(p, DY.userT())) * 0.3, 0.02, 0.85); };
  DY.offNext = () => {
    const g = G(), o = g.off, i = DY.OFF_ORDER.indexOf(o.stage);
    leaveStage(o.stage);
    if (i >= DY.OFF_ORDER.length - 1) return DY.newSeason();
    o.stage = DY.OFF_ORDER[i + 1];
    enterStage(o.stage);
  };
  function leaveStage(st) {
    const g = G();
    if (st === 'recap') {
      // seniors and draft entrants leave everyone's roster (kept in the player table for history)
      g.teams.forEach(t => { t.roster = t.roster.filter(id => { const p = DY.P(id); if (p.leave) { p.t0 = t.id; p.gone = g.season; p.t = null; return false; } return true; }); });
    }
    if (st === 'nil') DY.resolveNilAsks();
    if (st === 'cuts') DY.autoCuts(true);
    if (st === 'portal') DY.resolvePortal(true);
    if (st === 'progress') { /* already applied on entering */ }
  }
  function enterStage(st) {
    const g = G();
    if (st === 'nil') DY.nilReview();
    if (st === 'portal') DY.openPortal();
    if (st === 'signing') DY.signingDay();
    if (st === 'draft') DY.runDraft();
    if (st === 'progress') DY.progressAll();
    if (st === 'cuts') DY.autoCuts(false);
    if (st === 'schedule') { g.nonconfPick = g.nonconfPick || {}; if (!g.nonconfPick[g.season + 1]) g.nonconfPick[g.season + 1] = DY.UT_NONCONF_REAL[g.season + 1] ? DY.UT_NONCONF_REAL[g.season + 1].map(x => ({ o: DY.byName(x[0]).id, home: x[1] === 'H', wk: DY.weekOfDate(g.season + 1, x[2]) })) : DY.autoNonconf(g.season + 1); }
  }

  /* NIL: market values move with performance; players who outgrew their deal ask for a raise */
  DY.nilReview = () => {
    const g = G(), ut = DY.userT();
    const bump = ut.champ === g.season ? 1.04 : 1;
    const deep = g.post && g.post.seeds && g.post.seeds.includes(ut.id) ? 1.04 : 1;
    const champ = g.post && g.post.champ === ut.id ? 1.08 : 1;
    const losing = ut.w < ut.l ? 0.96 : 1;
    ut.budget = Math.round(ut.budget * (bump > 1 ? 1.015 : 1) * (deep > 1 ? 1.02 : 1) * (champ > 1 ? 1.03 : 1) * (losing < 1 ? 0.97 : 1) * 1.03 / 1e5) * 1e5;
    g.off.nilAsk = []; g.off.nilAdj = {};
    ut.roster.map(DY.P).forEach(p => {
      p.nilV = DY.nilValue(p, ut);
      const want = p.nilV * (1 + (p.tr.ego - 60) / 300);
      if ((want > p.nil * 1.15 && want - p.nil >= 15000) || (p.tr.ego >= 80 && p.ovr >= 80 && chance(0.5))) g.off.nilAsk.push({ id: p.id, ask: Math.round(Math.max(want, p.nil * 1.15) / 5000) * 5000, ans: null });
    });
    g.off.nilAsk.sort((a, b) => b.ask - a.ask);
  };
  DY.answerNil = (id, yes) => { const a = G().off.nilAsk.find(x => x.id === id); if (a) a.ans = yes; };
  // how likely a player is to be unhappy (and test the portal) at a given salary
  DY.nilRisk = (p, amt) => {
    const v = p.nilV || DY.nilValue(p, DY.userT()), r = amt / Math.max(1000, v);
    let risk = r >= 1 ? 0.03 : r >= 0.85 ? 0.12 : r >= 0.65 ? 0.3 : 0.55;
    if (amt < (p.nil0 != null ? p.nil0 : p.nil)) risk += 0.2;
    risk *= 1 + (p.tr.ego - 60) / 120; risk *= 1 - (p.tr.loyal - 60) / 160;
    return clamp(risk, 0.01, 0.9);
  };
  DY.riskLabel = r => r < 0.05 ? 'None' : r < 0.12 ? 'Low' : r < 0.3 ? 'Medium' : 'High';
  DY.adjustNil = (id, amt) => {
    const g = G(), p = DY.P(id), ut = DY.userT();
    amt = Math.max(0, Math.round(amt / 5000) * 5000);
    if (DY.payroll(ut) - p.nil + amt > ut.budget * 1.02) return `Over budget: ${DY.money(ut.budget - DY.payroll(ut))} open.`;
    if (p.nil0 == null) p.nil0 = p.nil;
    p.nil = amt; g.off.nilAdj[id] = amt; return null;
  };
  DY.resolveNilAsks = () => {
    const g = G(), ut = DY.userT();
    // salary changes you made: a cut can sour him
    Object.keys(g.off.nilAdj || {}).forEach(id => { const p = DY.P(+id); if (p.nil0 != null && p.nil < p.nil0) { if (chance(DY.nilRisk(p, p.nil))) { p.unhappy = true; DY.addLog(p, `Took an NIL cut to ${DY.money(p.nil)} and was not happy about it.`); } } delete p.nil0; });
    g.off.nilAsk.forEach(a => {
      const p = DY.P(a.id);
      let yes = a.ans;
      if (yes == null) yes = g.settings.nil === 'auto' || g.settings.nil === 'manual' ? (DY.payroll(ut) + (a.ask - p.nil) <= ut.budget && p.ovr >= 76) : false;
      if (yes && DY.payroll(ut) + (a.ask - p.nil) <= ut.budget * 1.02) { p.nil = a.ask; p.unhappy = false; DY.addLog(p, `Signed a new NIL deal: ${DY.money(a.ask)}.`); }
      else { p.unhappy = true; DY.addLog(p, `Asked for a raise to ${DY.money(a.ask)} and did not get it.`); }
    });
  };
  DY.addLog = (p, t) => { (p.log = p.log || []).unshift((G().season) + ': ' + t); if (p.log.length > 30) p.log.length = 30; };

  /* the transfer portal */
  DY.portalChance = (p, t) => {
    const g = G();
    if (p.tr.loyal >= 93) return 0.01;
    let c = 0.025;
    const depth = (t.depth[p.pos] || []).indexOf(p.id), st = DY.STARTERS[p.pos] || 1;
    if (depth >= st && p.ovr >= 74) c += 0.12 + (p.ovr - 74) / 60;
    if ((p.lastGp || 0) < 4 && p.yr >= 2) c += 0.1;
    if (p.unhappy) c += 0.22;
    if (t.w < t.l) c += 0.05;
    c += (p.tr.ego - 55) / 400 - (p.tr.loyal - 55) / 260;
    if (p.el <= 1) c *= 0.7;
    return clamp(c, 0.005, 0.6);
  };
  // encourage one of your players to transfer: he enters the portal (and his NIL comes off the books when he leaves)
  DY.encourage = id => {
    const g = G(), o = g.off, p = DY.P(id), ut = DY.userT();
    if (!o || !p || p.t !== ut.id) return null;
    if (p.tin === g.season) return 'He just transferred in.';
    if (o.portal && o.portal.round > 1) return 'The portal window is closing; it is too late.';
    if (p.pushOut) { p.pushOut = false; if (o.portal) { o.portal.pool = o.portal.pool.filter(x => x !== id); p.portal = null; } return `${p.n} stays.`; }
    p.pushOut = true;
    if (o.portal) { p.portal = { from: ut.id, offers: {}, why: 'Encouraged to transfer', round: 0, pushed: true }; if (!o.portal.pool.includes(id)) o.portal.pool.push(id); }
    return `${p.n} is encouraged to transfer. He enters the portal${o.portal ? '' : ' when it opens'}.`;
  };
  DY.openPortal = () => {
    const g = G(), pool = [];
    const userOff = g.settings.portal === 'off';
    g.teams.forEach(t => {
      if (t.user && userOff) return;
      const gone = g.off && t.user ? g.off.leaving.length : 0;
      const pushed = t.roster.map(DY.P).filter(p => p.pushOut);
      const ent = t.roster.map(DY.P).filter(p => !p.pushOut && chance(DY.portalChance(p, t) * (t.user ? 1 : 0.8)));
      pushed.forEach(p => { p.portal = { from: t.id, offers: {}, why: 'Encouraged to transfer', round: 0, pushed: true }; pool.push(p.id); });
      // caps: 15 transfers out, 30 departures in all
      ent.sort((a, b) => DY.portalChance(b, t) - DY.portalChance(a, t)).slice(0, Math.max(0, Math.min(DY.CAP.tout, DY.CAP.out - gone))).forEach(p => {
        p.portal = { from: t.id, offers: {}, why: portalWhy(p, t), round: 0 };
        pool.push(p.id);
      });
    });
    g.off.portal = { pool, round: 1, rounds: 2, mine: {}, log: [], retain: {} };
  };
  function portalWhy(p, t) { if (p.unhappy) return 'NIL'; const depth = (t.depth[p.pos] || []).indexOf(p.id); if (depth >= (DY.STARTERS[p.pos] || 1) && p.ovr >= 74) return 'Playing time'; if ((p.lastGp || 0) < 4) return 'Playing time'; if (t.w < t.l) return 'Fresh start'; return pick(['Fresh start', 'Closer to home', 'Bigger role']); }
  // try to keep one of your own: a raise and a chance based on loyalty
  DY.retain = (id, raise) => {
    const g = G(), P = g.off.portal, p = DY.P(id), ut = DY.userT();
    if (P.retain[id] != null) return 'You already made your pitch.';
    if (DY.payroll(ut) + raise > ut.budget * 1.02) return 'That raise would put you over your NIL budget.';
    const ch = clamp(0.25 + (p.tr.loyal - 50) / 120 + raise / Math.max(40000, p.nilV || 50000) * 0.25 + (p.portal.why === 'NIL' ? 0.15 : 0), 0.05, 0.9);
    const ok = chance(ch);
    P.retain[id] = ok;
    if (ok) { p.nil += raise; p.unhappy = false; p.portal = null; P.pool = P.pool.filter(x => x !== id); DY.addLog(p, 'Pulled his name out of the portal and stayed.'); }
    return ok ? `${p.n} is staying!` : `${p.n} is moving on.`;
  };
  DY.portalOffer = (id, amt) => {
    const g = G(), p = DY.P(id), ut = DY.userT(), P = g.off.portal;
    const committed = Object.values(P.mine).reduce((s, v) => s + v, 0) - (P.mine[id] || 0);
    if (DY.payroll(ut) + committed + amt > ut.budget * 1.05) return `That offer puts you over your NIL budget (${DY.money(ut.budget - DY.payroll(ut) - committed)} left).`;
    if (!P.mine[id] && DY.transfersIn() >= DY.CAP.tin) return `That is ${DY.CAP.tin} transfer offers already (the limit).`;
    if (!P.mine[id] && DY.newcomers() >= DY.CAP.newcomers) return `That is ${DY.CAP.newcomers} newcomers already (signees plus transfers).`;
    P.mine[id] = Math.max(0, Math.round(amt / 5000) * 5000); return null;
  };
  // each round: CPU teams make offers, players pick the best mix of money, role, brand and home
  DY.resolvePortal = final => {
    const g = G(), P = g.off.portal, ut = DY.userT(); if (!P) return;
    if (g.settings.portal === 'auto') autoPortal();
    const rounds = final ? 3 : 1;
    for (let r = 0; r < rounds; r++) {
      const left = P.pool.filter(id => DY.P(id).portal);
      // CPU offers
      left.forEach(id => {
        const p = DY.P(id);
        g.teams.forEach(t => {
          if (t.user || t.id === p.portal.from) return;
          if (chance(0.03 * Math.pow(t.prestige / 70, 2) * (p.ovr >= 80 ? 3 : 1))) {
            const L = DY.lineup(t), cur = (L[p.pos] || [])[0];
            if (!cur || p.ovr > cur.ovr - 2) p.portal.offers[t.id] = Math.round(DY.nilValue(p, t) * (p.ovr >= 84 && t.prestige >= 80 ? rr(0.85, 1.4) : rr(0.6, 1.2)) / 5000) * 5000;
          }
        });
        if (P.mine[id] != null && g.settings.portal !== 'off') p.portal.offers[ut.id] = P.mine[id];
      });
      left.forEach(id => {
        const p = DY.P(id), offers = Object.entries(p.portal.offers);
        if (!offers.length) { p.portal.round++; return; }
        // money talks, but so do playing time, winning and home; the noise keeps anyone from being a lock
        const val = ([tid, amt]) => { const t = g.teams[tid]; const f = DY.fit(t, p); return Math.min(1.6, amt / Math.max(30000, DY.nilValue(p, t))) * 0.5 + f.pt * 1.0 + f.brand * 0.45 + f.prox * 0.25 + (t.prestige - 75) / 70 + rr(0, 0.5); };
        const best = offers.sort((a, b) => val(b) - val(a))[0];
        if (final || chance(0.55) || +best[0] === ut.id && chance(0.3)) {
          const t = g.teams[best[0]];
          p.t = t.id; p.nil = best[1]; t.roster.push(p.id); p.prevT = p.portal.from; p.tin = g.season; DY.addLog(p, `Transferred from ${g.teams[p.portal.from].name} to ${t.name}.`);
          if (t.user) { P.log.unshift(`${p.n} (${p.pos}, ${p.ovr}) commits to ${DY.UN()} from ${g.teams[p.portal.from].name}.`); DY.news('portal', `Transfer: ${p.n} picks ${DY.UN()}`, `${p.pos}, ${p.ovr} OVR, from ${g.teams[p.portal.from].name}.`, { pid: p.id }); }
          else if (p.portal.from === ut.id) P.log.unshift(`${p.n} transfers to ${t.name}.`);
          delete P.mine[id];
          p.portal = null;
        } else p.portal.round++;
      });
      P.pool = P.pool.filter(id => DY.P(id).portal);
    }
    if (final) {
      // anyone unsigned goes back to (or stays at) a lower-level school: off our books
      P.pool.forEach(id => { const p = DY.P(id); p.t = null; p.gone = g.season; p.leave = 'portal'; p.portal = null; });
      g.teams.forEach(t => { t.roster = t.roster.filter(id => { const p = DY.P(id); return p.t === t.id; }); });
    } else P.round++;
  };
  function autoPortal() {
    const g = G(), P = g.off.portal, ut = DY.userT(), needs = DY.teamNeeds(ut);
    let room = ut.budget - DY.payroll(ut);
    P.pool.map(DY.P).filter(p => p.portal && p.portal.from === ut.id && p.ovr >= 80 && P.retain[p.id] == null).forEach(p => { if (room > 100000) { DY.retain(p.id, Math.min(room / 4, 200000)); } });
    let n = 0;
    P.pool.map(DY.P).filter(p => p.portal && p.portal.from !== ut.id).sort((a, b) => b.ovr - a.ovr).forEach(p => {
      const L = DY.lineup(ut), st = (L[p.pos] || []).slice(0, DY.STARTERS[p.pos] || 1), worst = st[st.length - 1];
      const short = DY.rosterRoom() > 10;
      if (DY.rosterRoom() <= 0 || n >= (short ? 12 : 6) || DY.newcomers() >= DY.CAP.newcomers) return;
      if ((needs[p.pos] > (short ? 0 : 1) && p.ovr >= (short ? 70 : 74)) || (worst && p.ovr >= worst.ovr + 2)) { n++; const amt = Math.round(DY.nilValue(p, ut) * 1.05 / 5000) * 5000; if (amt < room * 0.4) { P.mine[p.id] = amt; room -= amt; } }
    });
  }
  DY.transfersIn = () => { const g = G(), P = g.off && g.off.portal; return (P ? Object.keys(P.mine).length : 0) + DY.userT().roster.map(DY.P).filter(p => p.prevT != null && p.tin === g.season).length; };
  DY.newcomers = () => { const g = G(); const commits = g.recruit && !g.recruit.signed ? Math.min(DY.CAP.hs, DY.myCommits().length) : DY.userT().roster.map(DY.P).filter(p => p.firstY === g.season + 1).length; return commits + DY.transfersIn(); };
  DY.rosterRoom = () => { const g = G(), ut = DY.userT(), P = g.off && g.off.portal; const commits = g.recruit && !g.recruit.signed ? DY.myCommits().length : 0; return DY.rosterMax() + 4 - ut.roster.length - commits - (P ? Object.keys(P.mine).length : 0); };
  // the portal hides a transfer's true overall: a star rating and a range from your scouts
  DY.tStars = p => p.ovr >= 84 ? 5 : p.ovr >= 75 ? 4 : 3;
  DY.tRange = p => { const h = (p.id * 2654435761 >>> 0) % 1000 / 1000, w = 5 + Math.round(h * 3), lo = Math.round(p.ovr - 1 - h * (w - 2)); return [Math.max(50, lo), Math.min(99, lo + w)]; };
  DY.portalPlayers = () => { const P = G().off.portal; return P ? P.pool.map(DY.P).filter(p => p && p.portal) : []; };

  /* signing day: commits sign, uncommitted players pick their leader, everyone fills out a class */
  DY.signingDay = () => {
    const g = G(), R = g.recruit, ut = DY.userT();
    const userOff = g.settings.recruiting === 'off';
    const counts = {}; g.teams.forEach(t => counts[t.id] = 0);
    const cap = t => t.user ? Math.max(0, Math.min(DY.CAP.hs, DY.CAP.newcomers - DY.transfersIn(), DY.rosterMax() + 6 - t.roster.length)) : Math.max(0, 54 - t.roster.length);
    const sign = (p, t) => {
      delete p.pros; delete p.interest; delete p.acts; p.t = t.id; p.yr = 1; p.el = 5; p.car = {}; p.aw = []; p.log = []; p.firstY = g.season + 1;
      p.nil = t.user ? Math.round((p.nilOffer || DY.recruitNil(p) * 0.8) / 5000) * 5000 : 0;
      G().P[p.id] = p; t.roster.push(p.id); counts[t.id]++;
      DY.addLog(p, `Signed with ${t.name} (${p.rec.stars}★, No. ${p.rec.nat} nationally).`);
    };
    const list = Object.values(R.pool).sort((a, b) => b.rec.c - a.rec.c);
    list.forEach(p => {
      let tid = p.commit;
      if (tid == null) {
        const order = Object.entries(p.interest).sort((a, b) => b[1] - a[1]).map(x => +x[0]);
        tid = order.find(id => { const t = g.teams[id]; return t && counts[id] < cap(t) && (!t.user || (p.offer && !userOff)); });
      }
      const t = tid != null ? g.teams[tid] : null;
      if (t && (counts[t.id] < cap(t) || (p.commit === t.id && (!t.user || counts[t.id] < DY.CAP.hs))) && !(t.user && userOff && !p.real)) sign(p, t);
    });
    // CPU (and recruiting-off Tennessee) fill the rest with lower-rated prospects
    g.teams.forEach(t => {
      const n = cap(t) - counts[t.id];
      const needs = DY.teamNeeds(t);
      // Tennessee (when recruiting is on) only fills real holes: positions where next year's roster is short
      let fill = t.user && !userOff && !R.locked && DY.myCommits().length >= 14 ? 0 : t.user && !userOff ? Object.keys(needs).filter(k => needs[k] >= 2).reduce((s, k) => s + Math.ceil(needs[k] / 2), 0) : Math.min(n, t.user ? 20 : 16);
      if (t.user && !userOff) { Object.keys(needs).forEach(k => { needs[k] = needs[k] >= 2 ? Math.ceil(needs[k] / 2) : 0; }); }
      for (let i = 0; i < Math.min(n, fill); i++) {
        if (t.user && !userOff && !Object.values(needs).some(v => v > 0)) break;
        const pos = wpick(Object.keys(needs), k => needs[k] + 0.4);
        const c = clamp(0.80 + (t.prestige - 40) / 600 + gauss() * 0.02, 0.76, 0.95);
        const p = prospect(pos, Math.round(c * 1e4) / 1e4, { st: chance(0.6) ? t.st : undefined });
        p.rec.nat = null; if (t.user) p.late = true; sign(p, t); needs[pos] = Math.max(0, needs[pos] - 1);
      }
    });
    // every roster needs bodies at every spot: walk-ons where a team came up short
    const MIN = { QB: 2, RB: 2, WR: 4, TE: 2, OT: 3, IOL: 4, EDGE: 3, DT: 3, LB: 3, CB: 3, S: 3, K: 1, P: 1 };
    g.teams.forEach(t => { for (const pos in MIN) { let have = t.roster.map(DY.P).filter(p => p.pos === pos).length; while (have < MIN[pos]) { const p = prospect(pos, 0.78, { st: t.st }); p.rec.nat = null; p.walkon = true; sign(p, t); have++; } } });
    // preferred walk-ons keep Tennessee's roster near the limit (they count as newcomers)
    if (!userOff) {
      const tn = DY.teamNeeds(ut);
      let k = 0;
      while (ut.roster.length < DY.rosterMax() - 2 && DY.newcomers() < DY.CAP.newcomers && k++ < 15) {
        const pos = wpick(Object.keys(tn), x => (tn[x] || 0) + 0.3);
        const p = prospect(pos, Math.round(clamp(0.79 + gauss() * 0.015, 0.76, 0.84) * 1e4) / 1e4, { st: ut.st }); p.rec.nat = null; p.walkon = true; sign(p, ut); tn[pos] = Math.max(0, (tn[pos] || 0) - 1);
      }
    }
    const mine = ut.roster.map(DY.P).filter(p => p.firstY === g.season + 1);
    DY.news('signing', `Signing day: ${DY.UN()} signs ${mine.length}`, `Class rank: No. ${R.classRank || '—'}. Headliners: ${mine.sort((a, b) => b.rec.c - a.rec.c).slice(0, 3).map(p => p.n + ' (' + p.rec.stars + '★ ' + p.pos + ')').join(', ')}.`);
    g.recruit.signed = true; g.recruit.finalRank = R.classRank;
  };

  /* cut-down day: get under the roster limit before the season (you choose, or the staff cuts the lowest) */
  DY.cutScore = p => p.ovr + (DY.GRADES.length - DY.gradeIdx(p.potG)) * 0.8 - p.yr * 0.6 + (p.captain ? 20 : 0) + (p.pos === 'K' || p.pos === 'P' ? 6 : 0);
  DY.cutsNeeded = () => Math.max(0, DY.userT().roster.length - DY.rosterMax());
  DY.autoCuts = final => {
    const g = G(), ut = DY.userT(), o = g.off;
    o.cut = o.cut || [];
    // CPU teams stay at 54-60
    if (final) g.teams.forEach(t => { if (t.user) return; const extra = t.roster.length - 60; if (extra > 0) { const out = t.roster.map(DY.P).sort((a, b) => DY.cutScore(a) - DY.cutScore(b)).slice(0, extra); out.forEach(p => { p.t = null; p.gone = g.season; p.leave = 'cut'; }); t.roster = t.roster.filter(id => DY.P(id).t === t.id); } });
    if (!final) return;
    let need = DY.cutsNeeded() - o.cut.length;
    if (need > 0) { const order = ut.roster.map(DY.P).filter(p => !o.cut.includes(p.id) && p.tin !== g.season).sort((a, b) => DY.cutScore(a) - DY.cutScore(b)); order.slice(0, need).forEach(p => o.cut.push(p.id)); }
    o.cut.forEach(id => { const p = DY.P(id); if (!p || p.t !== ut.id) return; p.t = null; p.t0 = ut.id; p.gone = g.season; p.leave = 'cut'; DY.addLog(p, 'Released at roster cut-down.'); });
    ut.roster = ut.roster.filter(id => DY.P(id).t === ut.id);
    DY.refreshDepth(ut);
  };
  DY.toggleCut = id => { const o = G().off; const pp = DY.P(id); if (pp && pp.tin === G().season) return 'Transfers who just arrived cannot be cut.'; o.cut = o.cut || []; const i = o.cut.indexOf(id); if (i >= 0) o.cut.splice(i, 1); else o.cut.push(id); };

  /* the NFL Draft: 7 rounds plus comp picks */
  DY.runDraft = () => {
    const g = G(), y = g.season + 1;
    const pool = Object.values(g.P).filter(p => p.gone === g.season && (p.leave === 'nfl' || p.leave === 'grad') && p.ovr >= 70).map(p => ({ p, v: DY.draftGrade(p) + gauss() * 2.2 })).sort((a, b) => b.v - a.v);
    const picks = [];
    const total = 257;
    pool.slice(0, total).forEach((x, i) => { const pk = i + 1, rd = pk <= 32 ? 1 : pk <= 64 ? 2 : pk <= 100 ? 3 : pk <= 138 ? 4 : pk <= 176 ? 5 : pk <= 216 ? 6 : 7; x.p.draft = { y, rd, pk }; picks.push({ id: x.p.id, rd, pk, t: x.p.t0 }); });
    g.off.draft = { y, picks };
    const mine = picks.filter(x => x.t === g.user);
    if (mine.length) DY.news('draft', `${mine.length} Vol${mine.length > 1 ? 's' : ''} drafted in ${y}`, mine.map(x => `${DY.P(x.id).n} (Rd ${x.rd}, No. ${x.pk})`).join(', ') + '.');
    (g.draftHist = g.draftHist || {})[y] = picks.slice(0, 64).map(x => [x.id, x.t]);
    DY.updateLegacy();
  };

  /* progression: a usual path, with players who meet, beat or miss their potential (Burger Town-style) */
  const GROW = { 1: 0.31, 2: 0.30, 3: 0.28, 4: 0.23, 5: 0.15, 6: 0.08 };   // share of the room to his ceiling closed per year (was ~0.4: 90+ players doubled in 3 years)
  DY.develop = (p, t) => {
    const g = G(), arch = g.coach.arch, side = DY.SIDE(p.pos);
    const before = p.ovr, ceil0 = p.ceil;
    let mult = (0.7 + p.tr.work / 170);
    if (t.user) { if (arch === 'developer') mult *= 1.06; if (arch === 'guru' && side === 'O') mult *= 1.1; if (arch === 'architect' && side === 'D') mult *= 1.1; }
    const base0 = Math.max(0, p.ceil - p.ovr) * (GROW[Math.min(6, p.yr)] || 0.05) * mult * 0.9;
    let gr = base0;
    // performance last season vs what you would expect from his rating (players who play and produce grow faster)
    const notes = [], why = [];
    why.push(`expected path ${base0 >= 0.5 ? '+' + base0.toFixed(1) : '0'} (${p.potG} potential, year ${p.yr}${p.tr.work >= 86 ? ', strong work ethic' : p.tr.work <= 58 ? ', questionable work ethic' : ''})`);
    if ((p.lastGp || 0) >= 6 && p.lastScore > 0) {
      const exp = { QB: 95, RB: 75, WR: 70, TE: 70, OT: 110, IOL: 110, EDGE: 60, DT: 66, LB: 75, CB: 50, S: 50, K: 50, P: 30 }[p.pos] || 60;
      const z = clamp((p.lastScore - exp * (p.ovr / 82)) / (exp * 0.45), -1.5, 2);
      gr += z * 1.4;
      why.push(`performance ${z >= 0 ? '+' : ''}${(z * 1.4).toFixed(1)} (${p.lastGp} games${z > 0.8 ? ', produced above his rating' : z < -0.5 ? ', underperformed' : ''})`);
      if (z > 1.2) notes.push('a big season pushed him forward');
      if (z > 1.6 && p.ovr >= p.ceil - 2) { p.ceil = Math.min(99, p.ceil + ri(1, 3)); notes.push('exceeded his potential'); }
    } else if ((p.lastGp || 0) <= 2 && p.yr >= 2) { gr *= 0.8; why.push('barely played (slower growth)'); }
    const aw = p.aw.filter(a => a.y === g.season).map(a => a.a);
    const awb = Math.min(2.5, aw.reduce((s, a) => s + ({ HEIS: 2.5, AA1: 2, AA2: 1.4, FRAA: 1.2, SEC1: 1, SEC2: 0.6 }[a] || 0), 0));
    if (awb) { gr += awb; why.push(`awards +${awb.toFixed(1)}`); }
    // boom or bust
    const bustP = 0.06 * (t.user && arch === 'developer' ? 0.6 : 1), boomP = 0.06;
    const r = rnd();
    if (p.yr <= 3 && r < boomP) { const b = ri(3, 6); p.ceil = Math.min(99, p.ceil + b); gr += ri(1, 3); const w = pick(['breakout offseason', 'added 12 pounds of muscle', 'the game slowed down for him', 'a monster spring camp']); notes.push(w); why.push('BOOM: ' + w); p.boom = (p.boom || 0) + 1; }
    else if (r < boomP + bustP) { const b = ri(3, 6); p.ceil = Math.max(p.ovr, p.ceil - b); gr *= 0.4; const w = pick(['development stalled', 'a lingering injury slowed him', 'struggled to pick up the scheme', 'motivation questions']); notes.push(w); why.push('BUST: ' + w); p.bust = (p.bust || 0) + 1; }
    else if (p.yr >= 3 && r < boomP + bustP + 0.04) { p.ceil = Math.min(99, p.ceil + ri(2, 4)); gr += 1.2; notes.push('late bloomer'); why.push('late bloomer'); }
    gr += gauss() * 1.1;
    // big jumps are rare: soften anything past +7
    if (gr > 6) gr = 6 + (gr - 6) * 0.4;
    gr = clamp(gr, -3, 11);
    p.why = why;
    if (p.pos === 'K' || p.pos === 'P' || p.pos === 'LS') gr = clamp(gr * 0.45, -2, 4);
    // apply to attributes: the ones that count most for his position move most; speed peaks early
    const w = DY.W[p.pos];
    for (const k in p.at) {
      const wt = w[k] ? 1 : 0.5;
      let d = gr * wt * rr(0.6, 1.4);
      if ((k === 'spd' || k === 'acc') && p.yr >= 3) d *= 0.4;
      p.at[k] = Math.round(clamp(p.at[k] + d, 50, 99));
    }
    DY.setOvr(p);
    if (p.ovr > p.ceil) p.ceil = p.ovr;
    // scouts get a clearer read as he ages
    const err = p.yr >= 3 ? 0.06 : 0.12, ri0 = DY.gradeIdx(DY.gradeOf(p.ceil)), rr0 = rnd();
    p.potG = DY.GRADES[clamp(ri0 + (rr0 < err ? -1 : rr0 < err * 2 ? 1 : 0), 0, DY.GRADES.length - 1)][0];
    p.yr++;
    // traits drift
    if (p.yr >= 4) p.tr.lead = Math.min(99, p.tr.lead + ri(0, 3));
    const delta = p.ovr - before;
    if (t.user) DY.addLog(p, `Offseason: ${delta >= 0 ? '+' : ''}${delta} (${before} → ${p.ovr}).${notes.length ? ' ' + notes.join('; ') + '.' : ''}`);
    return { id: p.id, before, after: p.ovr, delta, ceil0, ceil: p.ceil, notes, why };
  };
  DY.progressAll = () => {
    const g = G(), ut = DY.userT();
    const out = [];
    g.teams.forEach(t => t.roster.forEach(id => { const p = DY.P(id); if (p.firstY === g.season + 1) return; const r = DY.develop(p, t); if (t.user) out.push(r); }));
    out.sort((a, b) => b.delta - a.delta);
    g.off.prog = out;
  };

  /* coach history and the legacy board */
  DY.coachSeason = () => {
    const g = G(), h = g.hist[g.hist.length - 1];
    if (h) g.coach.hist.push({ y: h.y, w: h.w, l: h.l, finish: h.finish, ap: h.ap, sec: h.sec, natl: h.finish === 'National champions' });
  };
  DY.legacyScore = p => {
    let s = 0;
    const peak = Math.max(p.ovr, ...Object.values(p.peakO || {}));
    s += Math.max(0, peak - 70) * 2.2;
    (p.aw || []).forEach(a => { s += { HEIS: 70, HEISF: 18, AA1: 30, AA2: 18, FRAA: 8, SEC1: 12, SEC2: 6, SECO: 16, SECD: 16, SECF: 8, OBRIEN: 20, WALKER: 20, BILET: 20, MACKEY: 16, OUTLAND: 20, BEDNARIK: 22, BUTKUS: 18, THORPE: 18, GROZA: 10, GUY: 8 }[a.a] || 0; });
    for (const y in p.car) { const c = p.car[y]; s += (c.py || 0) / 400 + (c.ptd || 0) * 0.8 + (c.ry || 0) / 120 + (c.rtd || 0) * 1.2 + (c.rcy || 0) / 100 + (c.rctd || 0) * 1.2 + (c.sck || 0) * 2 + (c.int || 0) * 3 + (c.tk || 0) / 12 + (c.fgm || 0) * 0.5 + (c.gp || 0) * 0.4; }
    if (p.draft) s += { 1: 30, 2: 18, 3: 11, 4: 8, 5: 5, 6: 4, 7: 3 }[p.draft.rd] || 0;
    return Math.round(s);
  };
  DY.updateLegacy = () => {
    const g = G(), ids = new Set(Object.keys(g.legacy).map(Number));
    DY.userT().roster.forEach(id => ids.add(id));
    Object.values(g.P).forEach(p => { if (p.t0 === g.user && p.gone) ids.add(p.id); });
    ids.forEach(id => { const p = DY.P(id); if (!p) return; const played = Object.values(p.car || {}).some(c => (c.gp || 0) > 0 && c.t === 'TENN'); if (!played && !g.legacy[id]) return; g.legacy[id] = DY.legacyScore(p); });
  };
  DY.legacyBoard = n => Object.entries(G().legacy).map(([id, v]) => ({ p: DY.P(+id), v })).filter(x => x.p).sort((a, b) => b.v - a.v).slice(0, n || 10);

  /* ---------- captains and preseason camp ---------- */
  // two captains on each side of the ball: leadership first, then experience and ability
  DY.pickCaptains = t => {
    const ps = t.roster.map(DY.P).filter(Boolean);
    const keep = ps.filter(p => p.captain && p.capY === G().season);
    ps.forEach(p => { if (!keep.includes(p) && !(p.captain && p.capFix)) p.captain = false; });
    const score = p => p.tr.lead * 0.6 + p.ovr * 0.3 + p.yr * 3;
    ['O', 'D'].forEach(side => {
      const cur = ps.filter(p => p.captain && DY.SIDE(p.pos) === side);
      ps.filter(p => !p.captain && DY.SIDE(p.pos) === side && p.yr >= 3).sort((a, b) => score(b) - score(a)).slice(0, Math.max(0, 2 - cur.length)).forEach(p => { p.captain = true; });
    });
    ps.filter(p => p.captain).forEach(p => { p.capY = G().season; });
  };
  DY.CAMP_FOCUS = { pass: ['Throwing', ['sac', 'mac', 'dac', 'tup', 'thp']], hands: ['Hands & routes', ['cth', 'cit', 'srr', 'drr', 'rls']], run: ['Running', ['bcv', 'btk', 'elu', 'car']],
    block: ['Blocking', ['rbk', 'pbk']], rush: ['Pass rush', ['pmv', 'fmv', 'bsh']], cover: ['Coverage', ['mcv', 'zcv', 'prc', 'prs']], tackle: ['Tackling', ['tak', 'pur', 'hit']],
    kick: ['Kicking', ['kpw', 'kac']], pot: ['Potential', []] };
  DY.CAMP_MAX = 4;
  DY.campPlayer = (id, f) => {
    const g = G(), p = DY.P(id); g.camp = g.camp || { y: g.season, list: [] };
    if (g.camp.y !== g.season) g.camp = { y: g.season, list: [] };
    if (g.phase !== 'preseason') return 'Camp is in the preseason.';
    if (g.camp.list.length >= DY.CAMP_MAX) return `You have used all ${DY.CAMP_MAX} camp spots.`;
    if (g.camp.list.some(x => x.id === id)) return 'He is already in camp.';
    const F = DY.CAMP_FOCUS[f]; if (!F) return 'Pick a focus.';
    const before = p.ovr;
    if (f === 'pot') { p.ceil = Math.min(99, p.ceil + ri(1, 3)); }
    else { const keys = F[1].filter(k => p.at[k] != null); if (!keys.length) return 'That focus does not fit his position.'; keys.forEach(k => { p.at[k] = Math.min(99, p.at[k] + ri(1, 3)); }); DY.setOvr(p); if (p.ceil < p.ovr) p.ceil = p.ovr; }
    g.camp.list.push({ id, f, d: p.ovr - before });
    DY.addLog(p, `Preseason camp (${F[0].toLowerCase()}): ${p.ovr - before >= 0 ? '+' : ''}${p.ovr - before}.`);
    return `${p.n}: ${F[0]} camp, ${before} → ${p.ovr}.`;
  };
  // the staff fills unused camp spots: young starters-in-waiting with the most room to grow
  DY.autoCamp = () => {
    const g = G(); if (g.phase !== 'preseason') return;
    const t = DY.userT(), used = (g.camp && g.camp.y === g.season ? g.camp.list : []).map(x => x.id);
    const cands = t.roster.map(DY.P).filter(p => !used.includes(p.id) && p.pos !== 'K' && p.pos !== 'P').sort((a, b) => (b.ceil - b.ovr) * (6 - b.yr) - (a.ceil - a.ovr) * (6 - a.yr));
    for (const p of cands) {
      if (g.camp && g.camp.y === g.season && g.camp.list.length >= DY.CAMP_MAX) break;
      const W = DY.W[p.pos] || {};
      const best = Object.entries(DY.CAMP_FOCUS).filter(([k]) => k !== 'pot').map(([k, f]) => [k, f[1].reduce((s, a) => s + (W[a] || 0), 0)]).sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] > 0) DY.campPlayer(p.id, best[0]);
    }
  };

  /* ---------- a new season ---------- */
  DY.cleanNonconf = y => {
    const g = G(), arr = g.nonconfPick && g.nonconfPick[y]; if (!arr) return;
    const seen = new Set(), wks = new Set();
    arr.forEach(x => { if (seen.has(x.o) || x.o === g.user || (DY.T(x.o) && DY.T(x.o).conf === 'SEC')) x.o = null; else seen.add(x.o); });
    const auto = DY.autoNonconf(y);
    arr.forEach((x, i) => { if (x.o == null) { x.o = auto.find(a => !seen.has(a.o)).o; seen.add(x.o); } if (wks.has(x.wk) || x.wk < 0 || x.wk > 5) { x.wk = [0, 1, 2, 3, 4, 5].find(w => !wks.has(w) && w >= 1) ; } wks.add(x.wk); });
  };
  DY.newSeason = () => {
    const g = G();
    g.teams.forEach(DY.fixNums);
    DY.cleanNonconf(g.season + 1);
    g.season++;
    g.teams.forEach(t => {
      t.w = t.l = t.cw = t.cl = t.pf = t.pa = 0; t.res = []; t.ap = null;
      // CPU programs drift with results
      if (!t.user && t.hist.length) { const h = t.hist[t.hist.length - 1]; t.prestige = clamp(t.prestige + (h.w - 8) * 0.2 + (h.ap && h.ap <= 10 ? 0.3 : 0) - (t.prestige - DY.TEAMS[t.id].prestige) * 0.2, 25, 97); t.budget = DY.teamBudget(t); }
      t.depthEdited = false; DY.refreshDepth(t);
      const o = DY.teamOvr(t);
      t.elo = t.elo * 0.45 + (1500 + (o.ovr - 76) * 26 + (t.prestige - 70) * 1.2) * 0.55; t.preElo = t.elo;
      t.roster.forEach(id => { const p = DY.P(id); p.s = null; p.gl = (p.gl || []).slice(-40); p.peakO = p.peakO || {}; p.peakO[g.season] = p.ovr; });
    });
    // Tennessee's program prestige follows the coach
    const ut = DY.userT(), h = g.hist[g.hist.length - 1];
    if (h) ut.prestige = clamp(ut.prestige + (h.w - 8) * 0.4 + (h.finish === 'National champions' ? 3 : h.cfpSeed ? 1 : 0), 60, 97);
    trimPlayers();
    g.post = null; g.off = null; g.polls.cfp = null; g.phase = 'preseason'; g.week = 0;
    g.teams.forEach(t => DY.pickCaptains(t));
    g.camp = { y: g.season, list: [] };
    DY.buildSchedule(g.season);
    DY.preseasonPoll();
    DY.initRecruiting(true);
    DY.news('league', `${g.season} preseason: ${DY.UN()} opens at No. ${DY.apRank(ut.id) || 'NR'}`, `AP Top 5: ${g.polls.ap.slice(0, 5).map((x, i) => (i + 1) + '. ' + DY.T(x.t).name).join(', ')}.`);
  };
  // keep the save small: players who left CPU teams are dropped unless they won something
  function trimPlayers() {
    const g = G();
    for (const id in g.P) { const p = g.P[id]; if (p.t == null && p.gone && p.gone < g.season - 1 && p.t0 !== g.user && !p.aw.some(a => /AA1|HEIS/.test(a.a))) delete g.P[id]; }
  }
})(typeof window !== 'undefined' ? window : globalThis);
