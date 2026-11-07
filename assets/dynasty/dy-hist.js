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
  DY.HIST_FIRST = 1990; DY.HIST_LAST = 2025;
  const G = () => DY.G;
  const BASE = { name: Object.assign({}, DY.CONF_NAME), games: Object.assign({}, DY.CONF_GAMES), p4: DY.P4.slice(), conf: DY.TEAMS.map(t => t.conf) };

  /* ---------- loading the data ---------- */
  const loaded = {};
  function script(src) {
    if (loaded[src]) return loaded[src];
    return (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src + '?v=' + (root.VI_BUILD || '1'); s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); }));
  }
  DY.loadHist = year => year >= 2026 ? Promise.all([script('data/hist/fb-2026.js').catch(() => null), script('data/hist/fb-classes.js').catch(() => null)]) : Promise.all([script('data/hist/fb-sched.js'), script('data/hist/fb-classes.js'), script('data/hist/fb-tnclasses.js').catch(() => null), year ? script('data/hist/fb-' + year + '.js') : null]);
  // a saved historical dynasty: the schedules and classes must be loaded before it runs
  DY.histReady = g => g && g.hx ? DY.loadHist(null).then(() => { DY.applyEra(g); try { DY.dedupePool(g); } catch (e) { } try { DY.lcMigrate(g); } catch (e) { } try { DY.jetBackfill(g); } catch (e) { } try { DY.fixHistSched(g); } catch (e) { } try { if (g.sched && g.sched.length && g.sched.every(x => !x.res && !x.real)) DY.balanceHome(g.sched); } catch (e) { } return g; }) : Promise.resolve(g);   // (a saved generated slate that has not started gets the home/away fix too)

  /* ---------- the era: conferences, title games, the playoff ---------- */
  const NO_CCG = y => {
    const out = ['IND', 'BE', 'SWC', 'B8', 'BW'];
    if (y < 1992) out.push('SEC');
    if (y < 1996 || y > 1998) out.push('WAC');
    if (y < 1997) out.push('MAC');
    if (y < 2005) out.push('ACC', 'CUSA');
    if (y < 2011) out.push('B1G', 'P12');
    if (y >= 2011 && y < 2017) out.push('B12');
    if (y < 2013) out.push('MWC');
    if (y < 2015) out.push('AAC');
    if (y < 2018) out.push('SBC');
    if (y >= 2024) out.push('P12');
    return out;
  };
  const NAMES = y => ({ SEC: 'SEC', B1G: 'Big Ten', B12: 'Big 12', ACC: 'ACC', P12: y <= 2010 ? 'Pac-10' : 'Pac-12', MWC: 'Mountain West', AAC: 'American',
    BE: 'Big East', SWC: 'Southwest', B8: 'Big Eight', BW: 'Big West', SBC: 'Sun Belt', MAC: 'MAC', CUSA: 'Conference USA', WAC: 'WAC', IND: 'Independent', FCS: 'FCS' });
  const POWER = y => y <= 1995 ? ['SEC', 'B1G', 'P12', 'ACC', 'SWC', 'B8', 'BE'] : y <= 2012 ? ['SEC', 'B1G', 'B12', 'ACC', 'P12', 'BE'] : y <= 2023 ? ['SEC', 'B1G', 'B12', 'ACC', 'P12'] : ['SEC', 'B1G', 'B12', 'ACC'];
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
      eraRules(g, y);
    } else {
      DY.LAST_WK = 13;
      if (g.hx) eraRules(g, y);
      set(DY.CONF_NAME, BASE.name); set(DY.CONF_GAMES, BASE.games); DY.P4.length = 0; BASE.p4.forEach(c => DY.P4.push(c));
      g.teams.forEach(t => { t.conf = BASE.conf[t.id]; t.dorm = false; });
      if (g.hx) g.hx.era = null;
    }
  };
  // dates on the calendar: a season that starts a week early has its week numbers shifted
  const weekDate0 = DY.weekDate;
  DY.weekDate = (y, w) => { const g = G(), o = g && g.hx && g.hx.wk && g.hx.wk[y] ? g.hx.wk[y].off : 0; return weekDate0(y, w - o); };
  // real life arrives on schedule: the transfer portal (2018-19) and NIL (July 2021), if they were off only because of the era
  function eraRules(g, y) {
    if (!g.settings || !g.hx) return;
    if (g.hx.eraPortal && y >= 2019 && g.settings.portal === 'off') { g.settings.portal = 'manual'; g.hx.eraPortal = false; if (DY.news && g.news) DY.news('league', 'The NCAA opens the transfer portal', 'Players can now enter the portal and talk to other schools. Manage it each offseason.'); }
    if (g.hx.eraNil && y >= 2021 && g.settings.nil === 'off') {
      g.settings.nil = 'manual'; g.hx.eraNil = false;
      if (DY.initNil && g.teams && g.teams.length) { g.teams.forEach(t => { t.budget = DY.teamBudget(t); }); DY.initNil(DY.userT()); }
      if (DY.news && g.news) DY.news('league', 'NIL is here', 'Players can now be paid for their name, image and likeness. Your program has an NIL budget: keep your roster happy.');
    }
  }
  // the modern game after a historical dynasty reaches 2026, or a plain dynasty: nothing to do
  DY.resetEra = () => { DY.applyEra({ season: 9999, teams: [], hx: null }); };

  /* ---------- the real schedule of a season ---------- */
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  function fcsId(name) {
    const n = name.slice(2), f = DY.FCS.find(x => x.name === n);
    return (f || DY.FCS[hash(n) % DY.FCS.length]).id;
  }
  // Tennessee's real non-conference slate for a historical season, as editable picks (weeks counted from the opener)
  DY.histUtNonconf = season => {
    const g = G(); if (!g.hx || !DY.isHistSeason(g, season)) return null;
    const S = root.DY_HSCHED[season]; if (!S || !S.g || !S.g.length) return null;
    const rows = S.g.filter(r => !r[3] && !r[4] && (r[1] === 'Tennessee' || r[2] === 'Tennessee')).sort((x, y) => x[0] < y[0] ? -1 : 1);
    const mon = DY.firstSat(season).getTime() - 4 * 864e5, out = [];
    rows.forEach(r => { const o = DY.byName(r[1] === 'Tennessee' ? r[2] : r[1]); if (!o) return;
      out.push({ o: o.id, home: r[1] === 'Tennessee', wk: clamp(Math.floor((Date.parse(season + '-' + r[0] + 'T12:00:00Z') - mon) / (7 * 864e5)) + 1, 1, 5) }); });
    return out.length ? out : null;
  };
  // Tennessee-Vanderbilt is the in-state rivalry and closes Tennessee's regular season, whatever the real calendar of a given year did.
  // Swap it with Tennessee's current last game; a third team's game that then collides is slid to the freed week, or another open week, or dropped
  DY.vandyLast = (games, from) => {
    const UT = DY.UT_ID, vu = DY.byName('Vanderbilt'); if (UT == null || !vu) return false; const VU = vu.id;
    const ok = x => x.res == null && !x.played && x.wk >= (from || 0);
    const mine = games.filter(x => x.h === UT || x.a === UT), V = mine.find(x => x.h === VU || x.a === VU);
    if (!V || !ok(V)) return false;
    const L = mine.filter(x => x !== V).sort((p, q) => q.wk - p.wk)[0];
    if (!L || L.wk < V.wk || !ok(L)) return false;
    const LO = L.h === UT ? L.a : L.h, oldWk = V.wk, newWk = L.wk, last = DY.LAST_WK || 13;
    const at = (t, w, not) => t >= 1000 ? null : games.find(x => x !== not && x.wk === w && (x.h === t || x.a === t));
    const conflicts = [[VU, newWk, oldWk, V], [LO, oldWk, newWk, L]].map(([t, w]) => at(t, w, t === VU ? V : L)).filter(Boolean);
    if (conflicts.some(m => !ok(m) || m.h === UT || m.a === UT)) return false;
    V.wk = newWk; L.wk = oldWk;
    conflicts.forEach(m => {
      const freeFor = w => w >= 0 && w <= last && ![m.h, m.a].some(t => t < 1000 && (at(t, w, m) || (t === UT && (V.wk === w || L.wk === w))));
      const prefer = m.wk === newWk ? oldWk : newWk;
      let w = freeFor(prefer) ? prefer : null; for (let k = 1; w == null && k <= last; k++) { if (freeFor(m.wk + k)) w = m.wk + k; else if (freeFor(m.wk - k)) w = m.wk - k; }
      if (w == null) games.splice(games.indexOf(m), 1); else m.wk = w;
    });
    games.sort((p, q) => p.wk - q.wk);
    return true;
  };
  // saves made before the schedule data was fixed (Saturday-night games on rivalry weekend were dropped, so some teams, Tennessee in 2013 for one, played 11): put the real games the season is missing back in
  DY.fixHistSched = g => {
    g.fx = g.fx || {};
    if (!g.hx || !g.sched || !g.sched.length || !DY.isHistSeason(g, g.season)) return;
    const from0 = g.phase === 'season' ? (g.week || 0) : 0, keep = g.sched;
    if (!g.fx.sched2) {
      g.fx.sched2 = 1;
      const wkKeep = g.hx.wk && g.hx.wk[g.season] ? Object.assign({}, g.hx.wk[g.season]) : null, lastWk = DY.LAST_WK;
      let fresh = null; try { fresh = DY.histSchedule(g.season, true); } finally { g.sched = keep; if (wkKeep) g.hx.wk[g.season] = wkKeep; DY.LAST_WK = lastWk; }
      if (fresh) {
        const busy = {}, pair = new Set();
        keep.forEach(x => { if (x.h < 1000) busy[x.h + '|' + x.wk] = 1; if (x.a < 1000) busy[x.a + '|' + x.wk] = 1; if (x.h < 1000 && x.a < 1000) pair.add(Math.min(x.h, x.a) + '|' + Math.max(x.h, x.a)); });
        let n = 0;
        fresh.forEach(x => {
          if (x.wk < from0 || (x.h < 1000 && busy[x.h + '|' + x.wk]) || (x.a < 1000 && busy[x.a + '|' + x.wk])) return;
          if (x.h < 1000 && x.a < 1000 && pair.has(Math.min(x.h, x.a) + '|' + Math.max(x.h, x.a))) return;
          if ((x.h >= 1000 || x.a >= 1000) && !(x.h === DY.UT_ID || x.a === DY.UT_ID)) return;   // (only real I-A games are added back: no FCS stand-ins for other teams)
          keep.push(Object.assign({}, x, { id: g.season + '-fx' + (n++), res: null }));
          if (x.h < 1000) busy[x.h + '|' + x.wk] = 1; if (x.a < 1000) busy[x.a + '|' + x.wk] = 1; if (x.h < 1000 && x.a < 1000) pair.add(Math.min(x.h, x.a) + '|' + Math.max(x.h, x.a));
        });
        if (n) keep.sort((p, q) => p.wk - q.wk);
      }
    }
    if (!g.fx.sched3) {
      g.fx.sched3 = 1; g.fx.vandy1 = 1;
      DY.vandyLast(keep, from0);
      if (g.season >= 2006) { const b2 = {}; keep.forEach(x => { if (x.h < 1000) b2[x.h + '|' + x.wk] = 1; if (x.a < 1000) b2[x.a + '|' + x.wk] = 1; }); const before = keep.length; fillFcs(g.season, keep, b2, Math.max(1, from0)); if (keep.length > before) keep.sort((p, q) => p.wk - q.wk); }
    }
  };
  DY.histSchedule = (season, raw) => {
    const g = G(); if (!DY.isHistSeason(g, season)) return null;
    const S = root.DY_HSCHED[season], games = [], busy = {};
    if (!S.g.length) return genSchedule(season);
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
    // the coach's own non-conference picks replace the real slate's non-conference games (only once he has touched them)
    const picks = g.nonconfPick && g.nonconfPick[season];
    if (picks && g.ncTouched && g.ncTouched[season]) {
      const UT = DY.UT_ID;
      for (let i = games.length - 1; i >= 0; i--) { const x = games[i]; if ((x.h === UT || x.a === UT) && !x.conf && !x.neutral) { if (x.h < 1000) delete busy[x.h + '|' + x.wk]; if (x.a < 1000) delete busy[x.a + '|' + x.wk]; games.splice(i, 1); } }
      const off = (g.hx.wk && g.hx.wk[season] && g.hx.wk[season].off) || 0;
      picks.forEach(pk => { if (pk.o == null || pk.o === UT) return;
        const ok = w => w >= 0 && w <= DY.LAST_WK && !busy[UT + '|' + w] && (pk.o >= 1000 || !busy[pk.o + '|' + w]);
        let w = clamp((pk.wk || 1) + off, 0, DY.LAST_WK); if (!ok(w)) { let k = 1; while (k < 15 && !ok(w + k) && !ok(w - k)) k++; w = ok(w + k) ? w + k : ok(w - k) ? w - k : -1; }
        if (w < 0) return; busy[UT + '|' + w] = 1; if (pk.o < 1000) busy[pk.o + '|' + w] = 1;
        games.push({ id: season + '-' + games.length + 'p', wk: w, h: pk.home ? UT : pk.o, a: pk.home ? pk.o : UT, conf: false, neutral: false, tag: null, res: null, real: false, pick: true }); });
    }
    if (!raw && DY.vandyLast(games, 0)) { Object.keys(busy).forEach(k => delete busy[k]); games.forEach(x => { if (x.h < 1000) busy[x.h + '|' + x.wk] = 1; if (x.a < 1000) busy[x.a + '|' + x.wk] = 1; }); }
    fillFcs(season, games, busy);
    games.sort((x, y) => x.wk - y.wk);
    g.sched = games;
    return games;
  };
  // the record before 2007 only has games between I-A teams: fill everyone to eleven with I-AA opponents
  function fillFcs(season, games, busy, from) {
    const g = G(), cnt = {};
    games.forEach(x => { cnt[x.h] = (cnt[x.h] || 0) + 1; cnt[x.a] = (cnt[x.a] || 0) + 1; });
    const want = season >= 2006 ? 12 : 11;      // every team plays a twelve-game regular season from 2006 (the real record is kept as it was in 2001-2005)
    g.teams.filter(t => !t.dorm).forEach(t => {
      for (let w = Math.max(0, from || 0) || 1; w <= DY.LAST_WK && (cnt[t.id] || 0) < want; w++) {
        if (busy[t.id + '|' + w]) continue;
        const f = DY.FCS[(hash(t.name + season) + w) % DY.FCS.length];
        games.push({ id: season + '-' + games.length + (from ? 'f' : ''), wk: w, h: t.id, a: f.id, conf: false, neutral: false, tag: null, res: null });
        busy[t.id + '|' + w] = 1; cnt[t.id] = (cnt[t.id] || 0) + 1;
      }
    });
  }
  // home and away: nobody plays 9 of 11 on the road. Flip games (never the FCS ones) until every team is within a game of even
  DY.balanceHome = balanceHome;
  function balanceHome(games) {
    const d = {}, ok = x => x.h < 1000 && x.a < 1000 && !x.neutral && !x.pick;
    games.forEach(x => { if (x.h < 1000) d[x.h] = (d[x.h] || 0) + 1; if (x.a < 1000) d[x.a] = (d[x.a] || 0) - 1; });
    for (let pass = 0; pass < 60; pass++) {
      let moved = 0;
      for (const x of games) { if (!ok(x)) continue; if ((d[x.h] || 0) - (d[x.a] || 0) > 2) { const t = x.h; x.h = x.a; x.a = t; d[x.a] -= 2; d[x.h] += 2; moved++; } }
      if (!moved) break;
    }
  }
  // seasons before 2001: a generated slate in that year's conferences (rivalries kept), eleven games
  function genSchedule(season) {
    const g = G(), games = [], busy = {}, rnd = DY.r, cnt = {};
    DY.LAST_WK = 13; g.hx.wk = g.hx.wk || {}; g.hx.wk[season] = { off: 0, last: 13 };
    const live = g.teams.filter(t => !t.dorm), byConf = {};
    live.forEach(t => { (byConf[t.conf] = byConf[t.conf] || []).push(t.id); });
    const edges = [], key = (a, b) => a < b ? a + '-' + b : b + '-' + a, have = new Set();
    const addE = (a, b, c) => { const k = key(a, b); if (have.has(k)) return; have.add(k); edges.push([a, b, c]); };
    const RIV = [['Tennessee', 'Alabama'], ['Tennessee', 'Vanderbilt'], ['Tennessee', 'Kentucky'], ['Tennessee', 'Florida'], ['Tennessee', 'Georgia'], ['Alabama', 'Auburn'], ['Florida', 'Georgia'],
      ['Ohio State', 'Michigan'], ['USC', 'UCLA'], ['Texas', 'Oklahoma'], ['Texas', 'Texas A&M'], ['Oklahoma', 'Nebraska'], ['Florida', 'Florida State'], ['Clemson', 'South Carolina'], ['Army', 'Navy'], ['Notre Dame', 'USC'], ['Miami', 'Florida State']];
    RIV.forEach(([a, b]) => { const A = DY.byName(a), B = DY.byName(b); if (A && B && !A.dorm && !B.dorm) addE(A.id, B.id, A.conf === B.conf); });
    for (const c in byConf) {
      if (c === 'IND' || c === 'NONE') continue;
      const ids = byConf[c], n = Math.min(c === 'BW' || c === 'BE' ? 6 : 8, ids.length - 1), deg = {};
      ids.forEach(i => { deg[i] = 0; }); edges.forEach(([a, b]) => { if (deg[a] != null && deg[b] != null) { deg[a]++; deg[b]++; } });
      for (let it = 0; it < 4000; it++) {
        const need = ids.filter(i => deg[i] < n); if (need.length < 2) break;
        const a = need[Math.floor(rnd() * need.length)], cands = need.filter(b => b !== a && !have.has(key(a, b)));
        if (!cands.length) { deg[a] = n; continue; }
        const b = cands[Math.floor(rnd() * cands.length)]; addE(a, b, true); deg[a]++; deg[b]++;
      }
    }
    edges.forEach(([a, b]) => { cnt[a] = (cnt[a] || 0) + 1; cnt[b] = (cnt[b] || 0) + 1; });
    // the coach's own non-conference picks go in first (opponent, home or away, preferred week)
    const pickMap = {}, picks = (g.nonconfPick && g.nonconfPick[season]) || [], UTID = DY.UT_ID;
    picks.forEach(pk => { const o = pk.o != null && DY.T(pk.o); if (!o || o.dorm || pk.o === UTID || have.has(key(UTID, pk.o))) return;
      addE(UTID, pk.o, false); cnt[UTID] = (cnt[UTID] || 0) + 1; cnt[pk.o] = (cnt[pk.o] || 0) + 1; pickMap[key(UTID, pk.o)] = pk; });
    // non-conference: fill to eleven against other I-A teams, then I-AA
    const ids = live.map(t => t.id);
    for (let pass = 0; pass < 3; pass++) for (const a of DY.shuffle(ids)) {
      if ((cnt[a] || 0) >= 11) continue;
      const cands = ids.filter(b => b !== a && (cnt[b] || 0) < 11 && DY.T(b).conf !== DY.T(a).conf && !have.has(key(a, b)));
      if (!cands.length) continue;
      const b = cands[Math.floor(rnd() * cands.length)]; addE(a, b, false); cnt[a] = (cnt[a] || 0) + 1; cnt[b] = (cnt[b] || 0) + 1;
    }
    // weeks: non-conference first, the conference season after; Tennessee-Alabama on the third Saturday in October, Vanderbilt last
    const third = DY.thirdSatOct(season), tn = n => (DY.byName(n) || {}).id;
    const order = edges.slice().sort((x, y) => (x[2] ? 1 : 0) - (y[2] ? 1 : 0));
    const place = (a, b, conf, pref) => {
      const tries = pref != null ? [pref] : [];
      for (let w = conf ? 4 : 1; w <= 13; w++) tries.push(w);
      for (let w = 1; w <= 13; w++) tries.push(w);
      for (const w of tries) if (!busy[a + '|' + w] && !busy[b + '|' + w]) {
        busy[a + '|' + w] = busy[b + '|' + w] = 1;
        const pm = pickMap[key(a, b)], hm = pm ? (pm.home ? a === UTID : b === UTID) : (season + a * 7 + b * 3) % 2 === 0, A = DY.T(a), B = DY.T(b);
        const tag = (A.name === 'Tennessee' || B.name === 'Tennessee') && (A.name === 'Alabama' || B.name === 'Alabama') ? 'Third Saturday in October' : null;
        games.push({ id: season + '-' + games.length, wk: w, h: hm ? a : b, a: hm ? b : a, conf: !!conf, neutral: false, tag, res: null, pick: !!pm }); return true;
      }
      return false;
    };
    const special = e => { const n = [DY.T(e[0]).name, DY.T(e[1]).name].sort().join('|'); return n === 'Alabama|Tennessee' ? third : n === 'Tennessee|Vanderbilt' ? 13 : n === 'Auburn|Alabama' || n === 'Alabama|Auburn' ? 13 : n === 'Michigan|Ohio State' ? 13 : null; };
    order.filter(e => special(e) != null).forEach(e => place(e[0], e[1], e[2], special(e)));
    order.filter(e => special(e) == null).forEach(e => { const pm = pickMap[key(e[0], e[1])]; place(e[0], e[1], e[2], pm ? clamp(pm.wk || 1, 1, 13) : undefined); });
    fillFcs(season, games, busy);
    balanceHome(games);
    games.sort((x, y) => x.wk - y.wk);
    g.sched = games;
    return games;
  }

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
      // the source's attributes give the shape (fast, strong, smart); the overall comes from the era-balanced rating
      const at = extra && extra.at ? extra.at : { spd, str, awr };
      for (const k in at) if (at[k] != null && p.at[k] != null) p.at[k] = at[k];
      if (at.spd && !['OT', 'IOL', 'DT', 'K', 'P'].includes(pos)) fixed.spd = 1;
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
    g.hx = { y: year, src: D.src, eraNil: year < 2021 && g.settings.nil === 'off', eraPortal: year < 2018 && g.settings.portal === 'off' };
    g.season = year; g.startSeason = year;
    DY.applyEra(g);
    g.teams.forEach(t => {
      if (D.pr[t.name] != null) t.prestige = D.pr[t.name];
      t.budget = DY.teamBudget(t);
      const rows = D.ros[t.name];
      if (rows && rows.length >= 45) realRoster(t, rows, t.user);
      else if (rows && rows.length) {      // a few real players (the ones the record has): the rest of the roster is generated
        realRoster(t, rows, true);
        const mix = DY.ROSTER_MIX;
        for (const pos in mix) { let have = t.roster.filter(i => DY.G.P[i].pos === pos).length; while (have < mix[pos]) { const p = DY.genPlayerFor(t, pos, DY.ri(1, 4), { bump: -6 }); DY.G.P[p.id] = p; t.roster.push(p.id); have++; } }
        if (t.user) DY.fillRoster(t, 84);
        t.depth = DY.autoDepth(t);
      } else { DY.genRoster(t); if (t.user) DY.fillRoster(t, 84); }
    });
  };

  /* ---------- 2026: every team's real roster (Tennessee keeps its hand-built one) ---------- */
  DY.hasReal2026 = t => !!(root.DY_HIST && root.DY_HIST[2026] && root.DY_HIST[2026].ros[t.name] && root.DY_HIST[2026].ros[t.name].length >= 45);
  DY.modern2026 = g => {
    g.teams.forEach(t => { if (t.id !== DY.UT_ID && DY.hasReal2026(t) && !t.roster.length) realRoster(t, root.DY_HIST[2026].ros[t.name], t.user); });
    g.real2026 = true;
  };

  /* ---------- recruiting: real players, re-ranked by their careers ---------- */
  // replaces the top of a generated class with the real class of that year (stars by where their careers ranked them)
  const PGRP = { OT: 'OL', IOL: 'OL', OL: 'OL', EDGE: 'DL', DT: 'DL', DL: 'DL', CB: 'DB', S: 'DB', DB: 'DB', K: 'ST', P: 'ST', PK: 'ST', LS: 'ST' };
  const realPos0 = (pos, r) => pos;
  const stOf = h => { const m = /,\s*([A-Z]{2})\s*$/.exec(h || ''); return m ? m[1] : null; };
  // the real names already in this dynasty (rosters, former players, signees and recruits) so no real person is created twice
  const hKey = h => String(h || '').toLowerCase().replace(/[^a-z]/g, '');
  const nKey = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  // the same real person: same name, and either the same hometown or the same position group (a juco or a position change keeps the name but not always the home)
  DY.sameReal = (a, b) => nKey(a.n) === nKey(b.n) && ((hKey(a.home) && hKey(a.home) === hKey(b.home)) || (PGRP[a.pos] || a.pos) === (PGRP[b.pos] || b.pos));
  DY.realDupe = g => {
    const isReal = p => p && (p.realName || p.real || p.rec && p.rec.real);
    if (!g.realSeen2) { g.realSeen2 = []; Object.values(g.P || {}).concat(Object.values((g.recruit && g.recruit.pool) || {})).forEach(p => { if (isReal(p)) g.realSeen2.push([nKey(p.n), PGRP[p.pos] || p.pos, hKey(p.home)]); }); }
    const idx = {}; g.realSeen2.forEach(x => (idx[x[0]] = idx[x[0]] || []).push(x));
    const same = (name, pos, home) => (idx[nKey(name)] || []).some(x => x[1] === (PGRP[pos] || pos) || (x[2] && x[2] === hKey(home)));
    return { has: same, add: (name, pos, home) => { const x = [nKey(name), PGRP[pos] || pos, hKey(home)]; g.realSeen2.push(x); (idx[x[0]] = idx[x[0]] || []).push(x); } };
  };
  // an older save: one real person exists once. Duplicates still in the recruiting pool are deleted; duplicates already on rosters are released (the one who played more, or the one on your team, stays)
  DY.dedupePool = g => {
    g.fx = g.fx || {}; if (g.fx.dedupe2) return; g.fx.dedupe2 = 1;
    const R = g.recruit, isReal = p => p && (p.realName || p.real || p.rec && p.rec.real), ut = g.user;
    const all = Object.values(g.P || {}).filter(isReal), byN = {};
    const keep = (a, b) => { const sc = p => (p.t === ut ? 1e6 : 0) + (p.gp || 0) * 100 + (p.ovr || 0) - p.id * 1e-6; return sc(a) >= sc(b) ? a : b; };
    all.forEach(p => (byN[nKey(p.n)] = byN[nKey(p.n)] || []).push(p));
    Object.values(byN).forEach(v => {
      if (v.length < 2) return;
      const kept = [];
      v.sort((a, b) => (b.t === ut ? 1e6 : 0) + (b.gp || 0) - (a.t === ut ? 1e6 : 0) - (a.gp || 0)).forEach(p => {
        const twin = kept.find(q => DY.sameReal(p, q));
        if (!twin) { kept.push(p); return; }
        const dead = keep(p, twin) === p ? twin : p;
        if (dead === twin) kept[kept.indexOf(twin)] = p;
        if (dead.t != null) { const t = g.teams[dead.t]; dead.leave = 'dup'; dead.gone = g.season; dead.t0 = dead.t; dead.t = null; if (t) { t.roster = t.roster.filter(id => id !== dead.id); try { DY.refreshDepth(t); } catch (e) { } } }
      });
    });
    if (R && R.pool) {
      const seen = all.filter(p => p.t != null || (p.gone != null));
      Object.keys(R.pool).forEach(id => {
        const p = R.pool[id]; if (!isReal(p)) return;
        const hit = seen.some(q => q.id !== p.id && DY.sameReal(p, q));
        if (hit) { delete R.pool[id]; if (R.board) R.board = R.board.filter(x => x !== +id); } else seen.push(p);
      });
    }
    g.realSeen2 = null; DY.realDupe(g);
  };
  // Jet Award (best returner) was added after many seasons had been played: give it out for every past season that has none
  DY.jetBackfill = g => {
    g.fx = g.fx || {}; if (g.fx.jet2) return; g.fx.jet2 = 1;      // the first version only looked at players with a general award score, so return specialists were skipped: redo every season
    const ps = Object.values(g.P || {}).filter(p => p && p.car);
    ps.forEach(p => { if (p.aw) p.aw = p.aw.filter(a => a.a !== 'JET'); });
    Object.keys(g.awards || {}).forEach(y => {
      const A = g.awards[y]; if (!A) return; delete A.jet;
      let best = null, bs = 0;
      ps.forEach(p => { const c = p.car[y]; if (!c || c.real || (c.kr || 0) + (c.pr || 0) < 6) return; const sc = (c.rttd || 0) * 60 + ((c.kry || 0) + (c.pry || 0)) / 8 + ((c.kr || 0) + (c.pr || 0)) * 0.5; if (sc > bs) { bs = sc; best = p; } });
      if (best) { A.jet = best.id; best.aw = best.aw || []; if (!best.aw.some(a => a.y === +y && a.a === 'JET')) best.aw.push({ y: +y, a: 'JET' }); }
    });
    g.nat = null; if (g.legacy) { try { DY.updateLegacy(); } catch (e) { } }
  };
  // this dynasty: Dobbs and Kamara come back this offseason; the offseason in progress gets its two last-chance visits
  DY.lcMigrate = g => {
    g.fx = g.fx || {}; if (g.fx.lc1) return; g.fx.lc1 = 1;
    const sure = ['Joshua Dobbs', 'Alvin Kamara'];     // this offseason only; next year they declare like anyone else and you can use a last-chance visit
    const o = g.off; if (!o || o.stage == null) return;
    if (o.lc == null) o.lc = 2;
    const ut = DY.userT();
    (ut.roster || []).map(DY.P).forEach(p => { if (p && p.leave === 'nfl' && sure.includes(p.n)) { p.leave = null; if (o.leaving) o.leaving = o.leaving.filter(x => x.id !== p.id); if (o.pitched) delete o.pitched[p.id]; DY.addLog(p, 'Returned for another season.'); DY.news('nil', `${p.n} is coming back to ${DY.UN()}`, 'He had declared for the NFL Draft, but changed his mind.', { pid: p.id }); } });
  };
  DY.histClass = (year, list, prospectFn) => {
    const g = G(); if (!g || !root.DY_HCLASS || !root.DY_HCLASS[year]) return;
    if (!g.hx && year < 2027) return;                      // the 2026 game: real classes from 2027 on
    const real = root.DY_HCLASS[year], nk = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
    const have = new Set(list.filter(p => p.real).map(p => nk(p.n)));   // Tennessee's real commits are already in the class
    // one real person appears once: the same name (same home state and position group where known) is never signed a second time in a later class or alongside a player already on a roster
    const dupe = DY.realDupe(g);
    const isDup = (name, pos, home) => dupe.has(name, pos, home);
    const mark = (p) => dupe.add(p.n, p.pos, p.home);
    const gen = list.filter(p => !p.real).sort((a, b) => b.rec.c - a.rec.c);
    let gi = 0;
    real.forEach((r, i) => {
      const [name, pos, school, val, , , home, comp] = r;
      if (have.has(nk(name)) || isDup(name, realPos0(pos, r), home)) return;
      const old = gen[gi++]; if (!old) return;
      const hm = /,\s*([A-Z]{2})$/.exec(home || '');
      const st = hm ? hm[1] : (DY.byName(school) || {}).st || old.st;
      const c = comp ? Math.round(Math.min(0.9999, comp) * 1e4) / 1e4 : old.rec.c;   // 247 composite (modern classes) or the career-ranked slot
      const p = prospectFn(pos, c, { n: name, home: home || undefined, st });
      if (!comp) {
        // what he became: the best careers have the most room to grow
        p.ceil = Math.max(p.ceil, Math.round(clamp(95 - i * 0.07 + DY.gauss() * 1.2, 83, 99)));
        p.potG = DY.scoutGrade(p.ceil); p.gem = p.ceil >= p.ovr + 18; p.bust = false; p.realCareer = true;
      }
      const sch = DY.byName(school);
      if (sch && sch.fbs) { p.realSchool = sch.id; p.interest[sch.id] = Math.max(p.interest[sch.id] || 0, sch.id === DY.UT_ID ? 60 : 45); }
      p.realName = true;
      const at = list.indexOf(old); if (at >= 0) list[at] = p;
      mark(p);
    });
    // Tennessee's real signees for the year (top of the class by 247 rating): in the class, committed to the Vols
    const tn = root.DY_TNCLASS && root.DY_TNCLASS[year];
    if (tn && DY.UT_ID != null) {
      const spare = () => list.filter(p => !p.real && !p.realName).sort((a, b) => a.rec.c - b.rec.c)[0];   // replace the weakest generated recruit
      tn.forEach(r => {
        const [name, pos, home, comp] = r, key = nk(name);
        let p = list.find(x => nk(x.n) === key);
        if (!p) {
          if (isDup(name, pos, home)) return;
          const old = spare(); if (!old) return;
          const hm = /,\s*([A-Z]{2})$/.exec(home || '');
          p = prospectFn(pos, comp, { n: name, home, st: hm ? hm[1] : old.st });
          p.realName = true;
          p.ceil = Math.max(p.ceil, Math.round(clamp(78 + (comp - 0.85) * 90, 76, 95))); p.potG = DY.scoutGrade(p.ceil);
          list[list.indexOf(old)] = p;
        }
        p.real = true; p.commit = DY.UT_ID; p.firm = true; p.offer = true; p.realSchool = DY.UT_ID; p.interest[DY.UT_ID] = 200; mark(p);
      });
    }
  };

  /* ---------- bowl names of the time (null: that bowl did not exist yet) ---------- */
  DY.eraBowl = (n, y) => {
    const g = G(); if (!g || !g.hx || y >= 2026) return n;
    const M = {
      'Pop-Tarts Bowl': y < 1990 ? null : y < 2001 ? 'Carquest Bowl' : y < 2004 ? 'Tangerine Bowl' : y < 2012 ? 'Champs Sports Bowl' : y < 2017 ? 'Russell Athletic Bowl' : y < 2020 ? 'Camping World Bowl' : y < 2023 ? 'Cheez-It Bowl' : n,
      "Duke's Mayo Bowl": y < 2002 ? null : y < 2011 ? 'Meineke Car Care Bowl' : y < 2020 ? 'Belk Bowl' : n,
      'ReliaQuest Bowl': y < 1995 ? 'Hall of Fame Bowl' : y < 2022 ? 'Outback Bowl' : n,
      'Peach Bowl': y < 2014 ? 'Chick-fil-A Bowl' : n,
      'Citrus Bowl': y < 2003 ? 'Florida Citrus Bowl' : y < 2015 ? 'Capital One Bowl' : n,
      'Guaranteed Rate Bowl': y < 1997 ? 'Copper Bowl' : y < 2014 ? 'Insight Bowl' : y < 2018 ? 'Cactus Bowl' : y < 2020 ? 'Cheez-It Bowl' : n,
      'First Responder Bowl': y < 2010 ? null : y < 2018 ? 'Heart of Dallas Bowl' : n,
      'Fenway Bowl': y < 2021 ? null : n, 'LA Bowl': y < 2021 ? null : n, 'Myrtle Beach Bowl': y < 2020 ? null : n, 'Frisco Bowl': y < 2017 ? null : n,
      'Gasparilla Bowl': y < 2008 ? null : y < 2017 ? 'St. Petersburg Bowl' : n, 'Cure Bowl': y < 2015 ? null : n, 'Arizona Bowl': y < 2015 ? null : n,
      'Bahamas Bowl': y < 2014 ? null : n, 'Boca Raton Bowl': y < 2014 ? null : n, 'Camellia Bowl': y < 2014 ? null : n, 'Salute to Veterans Bowl': y < 2025 ? null : n,
      'Pinstripe Bowl': y < 2010 ? null : n, 'Military Bowl': y < 2008 ? null : n, 'Birmingham Bowl': y < 2006 ? null : y < 2015 ? 'BBVA Compass Bowl' : n,
      'Famous Idaho Potato Bowl': y < 1997 ? null : y < 2011 ? 'Humanitarian Bowl' : n, 'Texas Bowl': y < 2006 ? null : n, 'Music City Bowl': y < 1998 ? null : n,
      'Las Vegas Bowl': y < 1992 ? null : n, 'Alamo Bowl': y < 1993 ? null : n, 'Armed Forces Bowl': y < 2003 ? null : y < 2006 ? 'Fort Worth Bowl' : n, "Hawai'i Bowl": y < 2002 ? null : n,
      'New Mexico Bowl': y < 2006 ? null : n, 'New Orleans Bowl': y < 2001 ? null : n, 'Independence Bowl': n, 'Holiday Bowl': n, 'Sun Bowl': n, 'Liberty Bowl': n, 'Gator Bowl': n,
    };
    return M[n] === undefined ? n : M[n];
  };

  /* ---------- the record book as it stood the year you start ---------- */
  // records set after your start year have not happened yet: they come off the board (blank until someone sets one)
  const initRecords0 = DY.initRecords;
  DY.initRecords = () => {
    initRecords0();
    const g = G(); if (!g || !g.hx || !g.rec) return;
    for (const scope of ['game', 'season', 'career']) for (const k in g.rec[scope]) {
      const r = g.rec[scope][k]; if (!r || !r.real) continue;
      const yrs = String(r.y || '').match(/\d{4}/g) || [];
      const first = yrs.length ? Math.min(...yrs.map(Number)) : 0, last = yrs.length ? Math.max(...yrs.map(Number)) : 0;
      if ((scope === 'career' ? last : first) >= g.startSeason) g.rec[scope][k] = { v: 0, n: '—', y: '', note: 'not set yet in ' + g.startSeason, real: true, blank: true };
    }
  };

  /* ---------- the setup screen: the start-year picker ---------- */
  DY.histYears = () => { const out = []; for (let y = DY.HIST_LAST; y >= DY.HIST_FIRST; y--) out.push(y); return out; };
  DY.histTeams = year => { const D = root.DY_HSCHED && root.DY_HSCHED[year]; return D ? Object.keys(D.conf) : null; };
})(typeof window !== 'undefined' ? window : globalThis);
