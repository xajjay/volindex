/* The Vol Index — Vol Dynasty: historical start. Pick any season from 2006 to 2025 and take over that year's team.
   Every FBS team's real roster and ratings for that season (NCAA Football 14 community rosters for 2006-2023; real
   rosters with ratings from results and later careers for 2024-2025), the real conferences of that year, the real
   regular-season schedule of every season through 2025, the playoff format of the time (BCS title game, then the
   four-team playoff, then twelve), and recruiting classes made of real players re-ranked by what their careers became.
   Data: data/hist/ (built by tools/build_hist_fb.py). */
(function (root) {
  'use strict';
  const DY = root.DY;
  const { clamp } = DY;
  DY.HIST_FIRST = 2006; DY.HIST_LAST = 2025;
  const G = () => DY.G;
  const BASE = { name: Object.assign({}, DY.CONF_NAME), games: Object.assign({}, DY.CONF_GAMES), p4: DY.P4.slice(), conf: DY.TEAMS.map(t => t.conf) };

  /* ---------- loading the data ---------- */
  const loaded = {};
  function script(src) {
    if (loaded[src]) return loaded[src];
    return (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src + '?v=' + (root.VI_BUILD || '1'); s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); }));
  }
  DY.loadHist = year => Promise.all([script('data/hist/fb-sched.js'), script('data/hist/fb-classes.js'), year ? script('data/hist/fb-' + year + '.js') : null]);
  // a saved historical dynasty: the schedules and classes must be loaded before it runs
  DY.histReady = g => g && g.hx ? DY.loadHist(null).then(() => { DY.applyEra(g); return g; }) : Promise.resolve(g);

  /* ---------- the era: conferences, title games, the playoff ---------- */
  const NO_CCG = y => {
    const out = ['IND', 'BE', 'WAC'];
    if (y < 2011) out.push('B1G', 'P12');
    if (y >= 2011 && y < 2017) out.push('B12');
    if (y < 2013) out.push('MWC');
    if (y < 2015) out.push('AAC');
    if (y < 2018) out.push('SBC');
    if (y >= 2024) out.push('P12');
    return out;
  };
  const NAMES = y => ({ SEC: 'SEC', B1G: 'Big Ten', B12: 'Big 12', ACC: 'ACC', P12: y <= 2010 ? 'Pac-10' : 'Pac-12', MWC: 'Mountain West', AAC: 'American',
    BE: 'Big East', SBC: 'Sun Belt', MAC: 'MAC', CUSA: 'Conference USA', WAC: 'WAC', IND: 'Independent', FCS: 'FCS' });
  const POWER = y => y <= 2012 ? ['SEC', 'B1G', 'B12', 'ACC', 'P12', 'BE'] : y <= 2023 ? ['SEC', 'B1G', 'B12', 'ACC', 'P12'] : ['SEC', 'B1G', 'B12', 'ACC'];
  DY.histCfp = y => y < 2014 ? 2 : y < 2024 ? 4 : y < 2026 ? 12 : null;
  DY.isHistSeason = (g, y) => !!(g && g.hx && y <= DY.HIST_LAST && root.DY_HSCHED && root.DY_HSCHED[y]);
  DY.applyEra = g => {
    g = g || G(); const y = g.season;
    const set = (obj, src) => { Object.keys(obj).forEach(k => delete obj[k]); Object.assign(obj, src); };
    DY.NOCCG = [];
    if (DY.isHistSeason(g, y)) {
      const conf = root.DY_HSCHED[y].conf, names = NAMES(y), games = {};
      g.teams.forEach(t => { const c = conf[t.name]; t.conf = c || 'NONE'; t.dorm = !c; });
      Object.values(conf).forEach(c => { if (c !== 'IND') games[c] = BASE.games[c] || 8; });
      set(DY.CONF_NAME, names); set(DY.CONF_GAMES, games);
      DY.P4.length = 0; POWER(y).forEach(c => DY.P4.push(c));
      DY.NOCCG = NO_CCG(y);
      g.hx.era = y;
      const wk = g.hx.wk && g.hx.wk[y]; DY.LAST_WK = wk ? wk.last : 13;
    } else {
      DY.LAST_WK = 13;
      set(DY.CONF_NAME, BASE.name); set(DY.CONF_GAMES, BASE.games); DY.P4.length = 0; BASE.p4.forEach(c => DY.P4.push(c));
      g.teams.forEach(t => { t.conf = BASE.conf[t.id]; t.dorm = false; });
      if (g.hx) g.hx.era = null;
    }
  };
  // dates on the calendar: a season that starts a week early has its week numbers shifted
  const weekDate0 = DY.weekDate;
  DY.weekDate = (y, w) => { const g = G(), o = g && g.hx && g.hx.wk && g.hx.wk[y] ? g.hx.wk[y].off : 0; return weekDate0(y, w - o); };
  // the modern game after a historical dynasty reaches 2026, or a plain dynasty: nothing to do
  DY.resetEra = () => { DY.applyEra({ season: 9999, teams: [], hx: null }); };

  /* ---------- the real schedule of a season ---------- */
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  function fcsId(name) {
    const n = name.slice(2), f = DY.FCS.find(x => x.name === n);
    return (f || DY.FCS[hash(n) % DY.FCS.length]).id;
  }
  DY.histSchedule = season => {
    const g = G(); if (!DY.isHistSeason(g, season)) return null;
    const S = root.DY_HSCHED[season], games = [], busy = {};
    const id = n => n.startsWith('F:') ? fcsId(n) : (DY.byName(n) || {}).id;
    const rows = S.g.map(r => ({ d: season + '-' + r[0], h: id(r[1]), a: id(r[2]), n: !!r[3], c: !!r[4] })).filter(r => r.h != null && r.a != null && r.h !== r.a)
      .sort((x, y) => x.d < y.d ? -1 : 1);
    // game weeks run Tuesday to Monday (a Thursday opener or a Labor Day Monday game stays in its week). Some seasons
    // start a week early (week -1) or run a week later: the season gets 14 or 15 weeks instead of 13
    const mon = DY.firstSat(season).getTime() - 4 * 864e5;
    rows.forEach(r => { r.w = Math.floor((Date.parse(r.d + 'T12:00:00Z') - mon) / (7 * 864e5)) + 1; });
    const cnt = {}; rows.forEach(r => { cnt[r.w] = (cnt[r.w] || 0) + 1; });
    const ws = Object.keys(cnt).map(Number), off = Math.max(0, -Math.min(...ws)), last = clamp(Math.max(...ws.filter(w => cnt[w] >= 3)) + off, 13, 15);
    g.hx.wk = g.hx.wk || {}; g.hx.wk[season] = { off, last }; DY.LAST_WK = last;
    rows.forEach(r => {
      let w = clamp(r.w + off, 0, DY.LAST_WK);
      const free = wk => !busy[r.h + '|' + wk] && !busy[r.a + '|' + wk];      // (FCS opponents can share a stand-in team: they are never busy)
      if (!free(w)) { let k = 1; while (k < 14 && !free(clamp(w + k, 0, DY.LAST_WK)) && !free(clamp(w - k, 0, DY.LAST_WK))) k++; w = free(clamp(w + k, 0, DY.LAST_WK)) ? clamp(w + k, 0, DY.LAST_WK) : clamp(w - k, 0, DY.LAST_WK); if (!free(w)) return; }
      if (r.h < 1000) busy[r.h + '|' + w] = 1; if (r.a < 1000) busy[r.a + '|' + w] = 1;
      const tn = x => (DY.T(x) || {}).name;
      const tag = (tn(r.h) === 'Tennessee' || tn(r.a) === 'Tennessee') && (tn(r.h) === 'Alabama' || tn(r.a) === 'Alabama') ? 'Third Saturday in October' : null;
      games.push({ id: season + '-' + games.length, wk: w, h: r.h, a: r.a, conf: r.c, neutral: r.n, tag, res: null, real: true });
    });
    games.sort((x, y) => x.wk - y.wk);
    g.sched = games;
    return games;
  };

  /* ---------- a historical dynasty ---------- */
  const MIX_MIN = { QB: 3, RB: 3, WR: 6, TE: 3, OT: 4, IOL: 5, EDGE: 4, DT: 4, LB: 5, CB: 5, S: 4, K: 1, P: 1 };
  function realRoster(t, rows, full) {
    const ids = [], H = DY.G;
    rows.forEach(r => {
      const [n, pos, yr, ovr, num, ht, wt, spd, str, awr, st, extra] = r;
      const el = yr === 1 ? 5 : Math.max(1, 5 - yr);     // a senior is in his last season; freshmen can still redshirt
      const fixed = {};
      // recruiting stars: a guess from how good he is and how early (specialists top out at three)
      const c = Math.round(clamp(0.80 + (ovr - 62 - (yr - 1) * 2.5) * 0.0075, 0.78, 0.9985) * 1e4) / 1e4;
      const p = DY.makePlayer(pos, ovr, { n: n || undefined, t: t.id, yr, el, num: num || undefined, ht: ht || undefined, wt: wt || undefined, st: st || t.st,
        home: extra && extra.home || undefined, grade: c * 100, rec: { c, stars: DY.starsOf(c, pos), g: c * 100 } });
      if (extra && extra.at) { for (const k in extra.at) if (DY.W[pos] && DY.W[pos][k] != null) { p.at[k] = extra.at[k]; fixed[k] = 1; } }
      else { if (spd) { p.at.spd = spd; fixed.spd = 1; } if (str) { p.at.str = str; } if (awr) { p.at.awr = awr; } }
      DY.fitOvr(p, ovr, fixed);
      p.ceil = Math.round(clamp(ovr + [0, 9, 6, 3.5, 1.5, 0.5][yr] + DY.gauss() * 2.5, ovr, 99));     // room to grow by class
      p.potG = DY.scoutGrade(p.ceil);
      p.hist = true;
      H.P[p.id] = p; ids.push(p.id);
    });
    // CPU teams carry about 60; the user's team the full roster
    let keep = ids;
    if (!full) {
      const by = {}; ids.forEach(i => { const p = H.P[i]; (by[p.pos] = by[p.pos] || []).push(p); });
      keep = [];
      Object.entries(by).forEach(([pos, ps]) => { ps.sort((a, b) => b.ovr - a.ovr); keep.push(...ps.slice(0, Math.max(MIX_MIN[pos] || 2, Math.ceil((MIX_MIN[pos] || 2) * 1.35))).map(p => p.id)); });
      ids.filter(i => !keep.includes(i)).forEach(i => delete H.P[i]);
    }
    t.roster = keep;
    // any position the file left short
    for (const pos in MIX_MIN) {
      let have = t.roster.filter(i => H.P[i].pos === pos).length;
      while (have < MIX_MIN[pos]) { const p = DY.genPlayerFor(t, pos, DY.ri(1, 4)); H.P[p.id] = p; t.roster.push(p.id); have++; }
    }
    // the user's roster: 85 at most
    if (full && t.roster.length > 85) { const drop = t.roster.map(i => H.P[i]).sort((a, b) => a.ovr - b.ovr).slice(0, t.roster.length - 85).map(p => p.id); drop.forEach(i => delete H.P[i]); t.roster = t.roster.filter(i => !drop.includes(i)); }
    t.depth = DY.autoDepth(t);
  }
  // called from DY.newDynasty when a start year is picked (the data is already loaded)
  DY.histBuild = (g, year) => {
    const D = root.DY_HIST[year];
    g.hx = { y: year, src: D.src };
    g.season = year; g.startSeason = year;
    DY.applyEra(g);
    g.teams.forEach(t => {
      if (D.pr[t.name] != null) t.prestige = D.pr[t.name];
      t.budget = DY.teamBudget(t);
      const rows = D.ros[t.name];
      if (rows && rows.length >= 30) realRoster(t, rows, t.user);
      else { DY.genRoster(t); if (t.user) DY.fillRoster(t, 84); }
    });
  };

  /* ---------- recruiting: real players, re-ranked by their careers ---------- */
  // replaces the top of a generated class with the real class of that year (stars by where their careers ranked them)
  DY.histClass = (year, list, prospectFn) => {
    const g = G(); if (!g || !g.hx || !root.DY_HCLASS || !root.DY_HCLASS[year]) return;
    const real = root.DY_HCLASS[year];
    list.sort((a, b) => b.rec.c - a.rec.c);
    real.forEach((r, i) => {
      const [name, pos, school, val, , , home] = r;
      const old = list[i]; if (!old) return;
      const hm = /,\s*([A-Z]{2})$/.exec(home || '');
      const st = hm ? hm[1] : (DY.byName(school) || {}).st || old.st;
      const p = prospectFn(pos, old.rec.c, { n: name, home: home || undefined, st });
      // what he became: the best careers have the most room to grow
      p.ceil = Math.max(p.ceil, Math.round(clamp(95 - i * 0.07 + DY.gauss() * 1.2, 83, 99)));
      p.potG = DY.scoutGrade(p.ceil); p.gem = p.ceil >= p.ovr + 18; p.bust = false;
      const sch = DY.byName(school);
      if (sch && sch.fbs) { p.realSchool = sch.id; p.interest[sch.id] = Math.max(p.interest[sch.id] || 0, 45); }
      p.realCareer = true;
      list[i] = p;
    });
  };

  /* ---------- bowl names of the time (null: that bowl did not exist yet) ---------- */
  DY.eraBowl = (n, y) => {
    const g = G(); if (!g || !g.hx || y >= 2026) return n;
    const M = {
      'Pop-Tarts Bowl': y < 2012 ? 'Champs Sports Bowl' : y < 2017 ? 'Russell Athletic Bowl' : y < 2020 ? 'Camping World Bowl' : y < 2023 ? 'Cheez-It Bowl' : n,
      "Duke's Mayo Bowl": y < 2011 ? 'Meineke Car Care Bowl' : y < 2020 ? 'Belk Bowl' : n,
      'ReliaQuest Bowl': y < 2022 ? 'Outback Bowl' : n,
      'Peach Bowl': y < 2014 ? 'Chick-fil-A Bowl' : n,
      'Citrus Bowl': y < 2015 ? 'Capital One Bowl' : n,
      'Guaranteed Rate Bowl': y < 2014 ? 'Insight Bowl' : y < 2018 ? 'Cactus Bowl' : y < 2020 ? 'Cheez-It Bowl' : n,
      'First Responder Bowl': y < 2018 ? 'Heart of Dallas Bowl' : n,
      'Fenway Bowl': y < 2021 ? null : n, 'LA Bowl': y < 2021 ? null : n, 'Myrtle Beach Bowl': y < 2020 ? null : n, 'Frisco Bowl': y < 2017 ? null : n,
      'Gasparilla Bowl': y < 2008 ? 'St. Petersburg Bowl' : y < 2017 ? 'St. Petersburg Bowl' : n, 'Cure Bowl': y < 2015 ? null : n, 'Arizona Bowl': y < 2015 ? null : n,
      'Bahamas Bowl': y < 2014 ? null : n, 'Boca Raton Bowl': y < 2014 ? null : n, 'Camellia Bowl': y < 2014 ? null : n, 'Salute to Veterans Bowl': y < 2025 ? null : n,
      'Pinstripe Bowl': y < 2010 ? null : n, 'Military Bowl': y < 2008 ? null : n, 'Birmingham Bowl': y < 2015 ? 'BBVA Compass Bowl' : n,
      'Famous Idaho Potato Bowl': y < 2011 ? 'Humanitarian Bowl' : n, 'Texas Bowl': y < 2006 ? null : n, 'Music City Bowl': n,
    };
    return M[n] === undefined ? n : M[n];
  };

  /* ---------- the setup screen: the start-year picker ---------- */
  DY.histYears = () => { const out = []; for (let y = DY.HIST_LAST; y >= DY.HIST_FIRST; y--) out.push(y); return out; };
  DY.histTeams = year => { const D = root.DY_HSCHED && root.DY_HSCHED[year]; return D ? Object.keys(D.conf) : null; };
})(typeof window !== 'undefined' ? window : globalThis);
