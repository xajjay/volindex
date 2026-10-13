/* The Vol Index — site app. Data lives in /data; this file only renders it. */
(function () {
  'use strict';
  const SPORTS = [
    { key: 'football', name: 'Football', ready: true },
    { key: 'volleyball', name: 'Volleyball', ready: true },
    { key: 'soccer', name: 'Soccer', ready: true },
    { key: 'mbb', name: "Men's Basketball", ready: false },
    { key: 'wbb', name: "Women's Basketball", ready: false },
    { key: 'baseball', name: 'Baseball', ready: false },
    { key: 'softball', name: 'Softball', ready: false },
  ];
  const TABS = [
    ['overview', 'Overview'], ['schedule', 'Schedule & Standings'], ['roster', 'Roster'], ['depth', 'Depth Chart'],
    ['stats', 'Stats'], ['advanced', 'Advanced'], ['recruits', 'Recruiting'], ['next', '2027 Preview'],
    ['leaders', 'Leaders & Honors'], ['history', 'History'], ['media', 'Social & Media'],
  ];
  const app = document.getElementById('app');
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  /* ---------- theme ---------- */
  const themeBtn = document.getElementById('themeBtn');
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
    if (themeBtn) themeBtn.textContent = t === 'dark' ? 'Dark' : 'Light';
  }
  applyTheme(store.get('ut-theme') === 'dark' ? 'dark' : null);
  themeBtn && themeBtn.addEventListener('click', () => {
    const cur = store.get('ut-theme'); const nx = cur === 'dark' ? null : 'dark';
    nx ? store.set('ut-theme', nx) : store.del('ut-theme'); applyTheme(nx);
  });

  /* ---------- helpers ---------- */
  function fmtDate(iso, opts) { if (!iso) return 'TBA'; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-US', opts || { weekday: 'short', month: 'short', day: 'numeric' }); }
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  function starStr(n) { if (!n) return ''; return '<span class="stars" aria-label="' + n + ' stars">' + '★'.repeat(n) + '<i>' + '★'.repeat(5 - n) + '</i></span>'; }
  function rateBadge(r, compact) {
    if (!r) return '<span class="rate" title="No rating listed"><span class="g">NR</span></span>';
    if (r.src === 'on3') { const mv = r.prevRank ? r.prevRank - r.rank : 0; return `<span class="rate on3" title="${esc(r.label || 'On3 2026 Top 300 college players')}, college grade ${r.grade}"><span class="g">${r.grade}</span>${compact ? '#' + r.rank : 'On3 No. ' + r.rank}${mv ? `<i class="mv ${mv > 0 ? 'up' : 'dn'}">${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}</i>` : ''}</span>`; }
    if (r.src === '247t') return `<span class="rate tr" title="247Sports transfer rating"><span class="g">${r.grade}</span>${compact ? 'TR' : 'Transfer'}</span>`;
    return `<span class="rate" title="${esc(r.label || '247Sports composite')}"><span class="g">${r.grade}</span>${starStr(r.stars)}</span>`;
  }
  function rankChips(p, max = 25) { return (p.natRanks || []).filter(r => r.rank <= max).map(r => `<span class="chip nat">No. ${r.rank} nat'l · ${esc(r.stat)}</span>`).join(''); }
  function posGroup(p) {
    const m = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', OL: 'OL', OT: 'OL', DL: 'DL', LB: 'LB', DB: 'DB', CB: 'DB', S: 'DB', PK: 'ST', P: 'ST', 'P/PK': 'ST', K: 'ST', LS: 'ST' };
    return m[p] || p;
  }
  const NEXT_CLASS = { 'Fr.': 'So.', 'So.': 'Jr.', 'Jr.': 'Sr.', 'Sr.': '5th', '5th': '—' };
  // shown class: official redshirt eligibility from the roster (RS Fr., RS So., ...) when the player has one
  const RS = { FR: 'Fr.', SO: 'So.', JR: 'Jr.', SR: 'Sr.' }, RS_NEXT = { FR: 'So.', SO: 'Jr.', JR: 'Sr.', SR: null };
  const rsOf = p => { const m = /^RS (FR|SO|JR|SR)/.exec(p.elig || ''); return m ? m[1] : null; };
  const clsLabel = p => { const r = rsOf(p); return r ? 'RS ' + RS[r] : p.cls; };
  const nextLabel = p => { const r = rsOf(p); return r ? (RS_NEXT[r] ? 'RS ' + RS_NEXT[r] : '—') : NEXT_CLASS[p.cls]; };
  const TIPS = {
    FPI: "ESPN's Football Power Index: how many points better (or worse) a team is than an average FBS team on a neutral field. ESPN's game win chances and season projections come from it.",
    'SP+': "Bill Connelly's tempo- and opponent-adjusted efficiency rating, in points per game vs. an average FBS team.",
    PEAR: "PEAR Ratings' team strength rating: points better than an average FBS team on a neutral field.",
  };
  const tip = (label, key) => `<span class="tip" tabindex="0" data-tip="${esc(TIPS[key || label])}">${esc(label)}<i aria-hidden="true">?</i></span>`;
  const n1 = v => (v === undefined || v === null || v === '') ? '—' : (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : v);

  /* ---------- router ---------- */
  function route() {
    const h = window.VI_ROUTER ? window.VI_ROUTER.key() : ((location.hash || '#home').slice(1));
    const [sport, tab] = h.split('-');
    const d = document.getElementById('playerDlg'); if (d && d.open) d.close();
    document.querySelectorAll('.sportnav a').forEach(a => a.setAttribute('aria-current', a.dataset.sport === sport ? 'page' : 'false'));
    if (sport === 'football') renderFootball(tab || 'overview');
    else if (SPORTS.find(s => s.key === sport)) { if (window.SITE && window.SITE[sport] && window.renderSport) window.renderSport(sport, tab || 'overview'); else renderComing(sport); }
    else if (sport === 'sources') renderSources();
    else if (sport === 'about' && window.renderAbout) { window.renderAbout(app, tab); return; }
    else renderHub();
    window.scrollTo(0, 0);
  }
  window.addEventListener('vi:route', route);

  /* ---------- hub ---------- */
  /* Official polls only (the most-used one per sport). rank: number, 'NR' (unranked) or 'TBA' (not released yet).
     Edit these lines when a new poll comes out. Football reads the AP rank from data/football.js. */
  const POLLS = {
    volleyball: { rank: 10, poll: 'AVCA Coaches Poll', when: 'Oct. 4' },
    soccer:     { rank: 'NR', poll: 'United Soccer Coaches', when: 'Oct. 6' },
    mbb:        { rank: 'TBA', poll: 'AP preseason poll', when: 'Due in October', last: 'Final 2025-26 AP: No. 12' },
    wbb:        { rank: 'TBA', poll: 'AP preseason poll', when: 'Due in October', last: 'Final 2025-26 AP: unranked' },
    baseball:   { rank: 'TBA', poll: 'Preseason polls', when: 'Due in January', last: '2026 final (Baseball America): No. 25' },
    softball:   { rank: 'TBA', poll: 'NFCA preseason poll', when: 'Due in January', last: '2026 final NFCA: No. 4' },
  };
  function pollFor(key, F) {
    if (key === 'football') return F && F.team.ap ? { rank: F.team.ap, poll: 'AP Top 25', when: F.team.pollWeek || '' } : { rank: 'NR', poll: 'AP Top 25', when: F && F.team.pollWeek || '' };
    const D = window.sportData ? window.sportData(key) : null;
    const P = D && D.pollAuto;
    // use the automatic poll once it's from the current season (a final poll from last season doesn't count)
    const yr = D ? parseInt(D.season, 10) : 0, start = /baseball|softball/.test(key) ? `${yr}-01-01` : `${yr}-08-01`;
    if (P && P.rank != null && P.date && P.date >= start) return { rank: P.rank, poll: P.poll, when: fmtDate(P.date, { month: 'short', day: 'numeric' }) };
    return POLLS[key];
  }
  function rankBlock(p) {
    if (!p) return '';
    const num = typeof p.rank === 'number';
    return `<span class="rankbig${num ? '' : ' none'}" title="${esc(p.poll + (p.when ? ' · ' + p.when : ''))}">${num ? '#' + p.rank : esc(p.rank)}</span>`;
  }
  function pollLine(p) {
    if (!p) return '';
    return `<div class="pollline"><b>${esc(p.poll)}</b>${p.when ? ' · ' + esc(p.when) : ''}${p.last ? '<br>' + esc(p.last) : ''}</div>`;
  }
  // How to watch: network plus where it streams
  function howToWatch(tv) {
    if (!tv) return null;
    const net = String(tv).split('/')[0].trim();
    const n = net.toUpperCase().replace(/\s+/g, '');
    let stream;
    if (/^(SECN\+|SECNETWORK\+|ESPN\+)$/.test(n)) stream = 'Streaming only: ESPN app (ESPN+ / ESPN Unlimited subscription)';
    else if (/^(SECN|SECNETWORK|ESPN|ESPN2|ESPNU|ESPNEWS|ACCN)$/.test(n)) stream = 'Cable/satellite, or stream on the ESPN app with a TV provider or ESPN subscription';
    else if (n === 'ABC') stream = 'Free over the air on ABC, or stream on the ESPN app';
    else if (n === 'CBS') stream = 'Free over the air on CBS, or stream on Paramount+';
    else if (n === 'NBC') stream = 'Free over the air on NBC, or stream on Peacock';
    else if (/^(FOX|FS1)$/.test(n)) stream = 'FOX / FS1, or stream on the FOX One app';
    else if (/BIGTEN|BTN|B1G/.test(n)) stream = 'Big Ten Network, or stream on the FOX One app / B1G+';
    else stream = 'Check the network for streaming options';
    return { net, stream };
  }
  window.howToWatch = howToWatch;
  function watchLine(g, when) {
    if (!g) return '';
    const w = howToWatch(g.tv);
    return `<div class="watch"><div><span class="eyebrow">Next</span> <b>${g.site === 'A' ? 'at ' : 'vs. '}${esc(String(g.opp).replace(/ \(\d games\)/, '').replace(/ \(No\. \d+\)/, ''))}</b></div>
      <div class="dim">${fmtDate(g.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${esc(when || 'Time TBA')}</div>
      <div class="tv">${w ? `<b>📺 ${esc(w.net)}</b><span>${esc(w.stream)}</span>` : '<b>📺 TV TBA</b><span>Network usually announced 1–2 weeks out</span>'}</div></div>`;
  }
  const etToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  function lastUpdated(k) {
    const U = window.SITE_UPDATED || {};
    const own = k === 'football' ? F && F.updated : window.SITE[k] && window.SITE[k].updated;
    return [U[k], own].filter(Boolean).sort().pop() || null;
  }
  window.lastUpdated = lastUpdated;
  function renderHub() {
    if (window.SITE && window.SITE.football) initFootball();
    const next = F && F.schedule.find(g => !g.result && !(g.date < etToday()));
    app.innerHTML = `
    <div class="wrap hub-hero">
      <div class="eyebrow">University of Tennessee · Knoxville</div>
      <h1>The Vol <span>Index</span></h1>
      <p>Rosters, depth charts, lineups, recruits, ratings, schedules and history for Tennessee athletics: football, volleyball, soccer, basketball, baseball, softball and more to come.</p>
      ${window.askHero ? window.askHero() : ''}
    </div>
    <div class="wrap grid g3">
      ${SPORTS.map(s => `<a class="sportcard live" data-sport="${s.key}" href="#${s.key}">
        <div class="sc-name">
        <div class="eyebrow">${s.key === 'football' ? '2026 season' : window.SITE && window.SITE[s.key] ? window.SITE[s.key].season + ' season' : 'Coming soon'}</div>
        <h2>${esc(s.name)} ${rankBlock(pollFor(s.key, F))}</h2></div>
        ${pollLine(pollFor(s.key, F))}
        ${(d => d ? `<div class="upd">Updated ${fmtDate(d, { month: 'short', day: 'numeric' })}</div>` : '')(lastUpdated(s.key))}
        ${(r => r ? `<div class="bigrec"><b>${esc(r.rec)}</b>${r.sec ? `<span>${esc(r.sec)} <em>SEC</em></span>` : ''}<small>${esc(r.season)} record</small></div>` : '')(s.key === 'football' && F ? (F.schedule.some(g => g.result) ? { season: F.season, rec: F.team.record, sec: F.team.sec } : null) : window.sportRecord && window.sportRecord(s.key))}
        <div class="status">${(s.key === 'football' && F && F.schedule.some(g => g.result)) || (window.sportRecord && window.sportRecord(s.key)) ? '' : s.key === 'football' && F ? `${F.season}: ${F.team.record} (${F.team.sec} SEC)` : window.sportStatus && window.sportStatus(s.key) ? esc(window.sportStatus(s.key).split(' · Next')[0]) : 'Page in progress.'}</div>
        ${s.key === 'football' && F ? watchLine(next && Object.assign({ tv: (next.espn || {}).tv }, next), next && kick(next)) : window.sportNext ? (n => watchLine(n, n && (n.time ? n.time + ' ET' : null)))(window.sportNext(s.key)) : ''}
      </a>`).join('')}
    </div>
    ${window.mediaHub ? window.mediaHub() : ''}`;
    window.wireAskHero && window.wireAskHero();
  }
  const POLL_SOURCES = [
    ['Football: AP Top 25', 'AP via ESPN', 'https://www.espn.com/college-football/rankings'],
    ['Volleyball: AVCA Coaches Poll', 'AVCA', 'https://www.avca.org/'],
    ['Soccer: United Soccer Coaches poll', 'United Soccer Coaches', 'https://unitedsoccercoaches.org/rankings/college-rankings/ncaa-di-women/'],
    ["Basketball: AP Top 25 (men's and women's)", 'AP via ESPN', 'https://www.espn.com/mens-college-basketball/rankings'],
    ['Baseball: Baseball America Top 25', 'Baseball America', 'https://www.baseballamerica.com/'],
    ['Softball: NFCA / USA Softball Coaches Poll', 'NFCA', 'https://nfca.org/'],
    ['TV and streaming info', 'utsports.com schedules', 'https://utsports.com/calendar'],
  ];
  function renderSources() {
    initFootball();
    const list = rows => `<ul class="srclist">${rows.map(r => `<li><span>${esc(r[0])}</span> <a href="${esc(r[2])}" target="_blank" rel="noopener">${esc(r[1])}</a></li>`).join('')}</ul>`;
    const sports = SPORTS.filter(s => s.key !== 'football' && window.SITE[s.key] && window.SITE[s.key].sources);
    app.innerHTML = `<div class="wrap hub-hero"><div class="eyebrow">Credits</div><h1>Sources</h1>
      <p>Every number on The Vol Index comes from the sources below, each linked so you can check it. The Vol Index is an independent fan site and is not affiliated with the University of Tennessee, the SEC, ESPN, 247Sports, On3 or any other source. Ratings, rankings, stats and logos belong to their owners; we summarize and link to them.</p></div>
      <div class="wrap grid g2">
        <div class="box" style="padding:16px 18px"><h3>Home page rankings</h3>${list(POLL_SOURCES)}</div>
        <div class="box" style="padding:16px 18px"><h3>Football</h3>${list(F.sources.concat((F.records && F.records.source) || []))}</div>
        ${sports.map(s => `<div class="box" style="padding:16px 18px"><h3>${esc(s.name)}</h3>${list(window.SITE[s.key].sources.map(x => Array.isArray(x) ? x : [x.label || x.name || '', x.site || x.name || x.url, x.url]))}</div>`).join('')}
      </div>`;
  }
  function renderComing(key) {
    const s = SPORTS.find(x => x.key === key);
    app.innerHTML = `<div class="wrap hub-hero"><div class="eyebrow">Coming soon</div><h1>${esc(s.name)}</h1>
      <p>This team page is on the way.</p>
      <p><a href="#football">Go to Football</a></p></div>`;
  }

  /* ---------- football ---------- */
  let F, byName, recByName, depthState;
  const DKEY = 'ut-depth-football-v2';
  function initFootball() {
    if (F) return;
    F = window.SITE.football;
    applyAuto(F);
    byName = new Map(F.players.map(p => [p.name, p]));
    recByName = new Map(F.recruits.concat(F.recruits2028 || []).map(r => [r.name, r]));
    let draft = store.get(DKEY);
    if (draft && (draft.rev || 0) < (window.DEPTH.football.rev || 0)) { store.del(DKEY); draft = null; } // a newer chart file wins over old browser edits
    depthState = draft || JSON.parse(JSON.stringify(window.DEPTH.football));
    ['current', 'next'].forEach(k => { depthState[k].chart = splitOffense(depthState[k].chart); });
    depthState._draft = !!draft;
  }
  // Older saved charts had one "Offense" group: split it into Backfield / Receivers / Offensive Line
  function splitOffense(chart) {
    if (!chart.Offense) return chart;
    const out = {};
    Object.entries(chart).forEach(([side, rows]) => {
      if (side !== 'Offense') { out[side] = rows; return; }
      out['Backfield'] = rows.filter(r => /^(QB|RB|FB)$/.test(r[0]));
      out['Receivers'] = rows.filter(r => /^(WR|TE)/.test(r[0]));
      out['Offensive Line'] = rows.filter(r => !/^(QB|RB|FB|WR|TE)/.test(r[0]));
    });
    return out;
  }
  // Layer data/football-auto.js (written by tools/update_data.py) over the base data.
  function applyAuto(F) {
    const A = window.SITE_AUTO && window.SITE_AUTO.football;
    if (!A) return;
    try {
      const t = A.team || {};
      ['record', 'sec', 'ap', 'coaches', 'pollWeek'].forEach(k => { if (t[k] != null) F.team[k] = t[k]; });
      if (t.ranks) F.team.ranks = Object.assign({}, F.team.ranks, t.ranks);
      (A.schedule || []).forEach(g => {
        const s = F.schedule.find(x => x.opp === g.opp); if (!s) return;
        if (g.result) { s.result = g.result; s.us = g.us; s.them = g.them; delete s.time; }
      });
      Object.entries(A.espn || {}).forEach(([opp, e]) => { const s = F.schedule.find(x => x.opp === opp); if (s) s.espn = Object.assign({}, s.espn, Object.fromEntries(Object.entries(e).filter(([, v]) => v != null && v !== ''))); });
      // CFBD sometimes uses a different form of a name than the roster: match loosely, plus known nicknames
      const NAME_ALIAS = { 'timothy merritt': 'tim merritt', "mar'quavious moss": 'qua moss' };
      const norm = n => n.toLowerCase().replace(/[.'’]/g, '').replace(/\s+(jr|sr|ii|iii|iv|v)$/, '').replace(/\s+/g, ' ').trim();
      const lc = new Map(F.players.map(p => [norm(p.name), p]));
      Object.entries(A.playerStats || {}).forEach(([name, st]) => {
        const p = lc.get(norm(NAME_ALIAS[name.toLowerCase()] || name)); if (!p) return;
        Object.entries(st).forEach(([k, v]) => {
          if (k === 'pass' && p.stats.pass) v = v.map((x, i) => x == null ? p.stats.pass[i] : x);
          if (k === 'punt' && p.stats.punt) v = v.map((x, i) => x == null ? p.stats.punt[i] : x);
          if (k === 'def') v = Object.assign({ gp: p.stats.def ? p.stats.def.gp : null }, v);
          p.stats[k] = v;
        });
        const c = {}, s2 = p.stats;
        if (s2.pass) c.pass = s2.pass.slice(0, 5);
        if (s2.rush) c.rush = [s2.rush[0], s2.rush[1], s2.rush[4]];
        if (s2.rec) c.rec = [s2.rec[0], s2.rec[1], s2.rec[4]];
        if (s2.def && s2.def.tot) c.def = [s2.def.tot, s2.def.sacks, s2.def.int, s2.def.pbu, s2.def.ff];
        if (s2.kick) c.kick = s2.kick.slice(0, 4);
        if (Object.keys(c).length) p.career = Object.assign({}, p.career, { [String(F.season)]: c });
      });
      // fresh CFBD rows update matching commits; commits CFBD hasn't picked up yet (it can lag 247) are kept
      const mergeRec = (base, fresh) => fresh.map(r => { const o = (base || []).find(b => b.name === r.name) || {}; return Object.assign({}, o, Object.fromEntries(Object.entries(r).filter(([, v]) => v != null && v !== ''))); })
        .concat((base || []).filter(b => !fresh.some(r => r.name === b.name)))
        .sort((a, b) => (b.grade || 0) - (a.grade || 0));
      if (A.recruits && A.recruits['2027'] && A.recruits['2027'].length) F.recruits = mergeRec(F.recruits, A.recruits['2027']);
      if (A.recruits && A.recruits['2028'] && A.recruits['2028'].length) F.recruits2028 = mergeRec(F.recruits2028, A.recruits['2028']);
      if (t.apTop25) F.team.apTop25 = t.apTop25;
      if (A.box) F.box = A.box;
      if (A.previews) F.previews = A.previews;
      if (A.teamSheet) F.teamSheet = A.teamSheet;
      if (A.talent) F.talent = A.talent;
      // 247 ratings for every rostered player: On3 Top 300 first, then the most recent 247 rating (transfer, else high school)
      if (A.ratings) {
        F.ratings247 = A.ratings;
        Object.entries(A.ratings).forEach(([name, r]) => {
          const p = lc.get(norm(NAME_ALIAS[name.toLowerCase()] || name)); if (!p) return;
          p.r247 = r;
          if (p.rating && p.rating.src === 'on3') return;
          const tr = r.transfer, hs = r.hs;
          if (tr && tr.grade) p.rating = { src: '247t', grade: Math.floor(tr.grade), stars: tr.stars, label: `247Sports transfer rating (${tr.season} portal, from ${tr.origin})` };
          else if (hs && hs.grade) p.rating = { src: '247', grade: Math.floor(hs.grade), stars: hs.stars, label: `247Sports composite, class of ${hs.cls}${hs.nat ? ' · No. ' + hs.nat + ' nationally' : ''}` };
        });
      }
      if (A.updated) F.updated = A.updated;
    } catch (e) { console.warn('Auto data skipped:', e); }
    const H = window.SITE_AUTO && window.SITE_AUTO.footballHistory;
    if (H) F.histAuto = H;
    F.records = window.SITE.footballRecords || null;
  }
  function header(tab) {
    const t = F.team;
    return `<div class="teamhead"><div class="wrap">
      <div><div class="eyebrow">Tennessee Volunteers · SEC · ${F.season}</div><h1>Vols <span>Football</span></h1></div>
      <div class="scoreline" aria-label="Season snapshot">
        <div><b>${t.record}</b><small>Overall</small></div>
        <div><b>${t.sec}</b><small>SEC</small></div>
        <div><b>${t.ap}</b><small>AP poll</small></div>
        <div class="hide-sm"><b>${F.advanced.fpi.rank}</b><small>${tip('FPI')}</small></div>
      </div>
      <nav class="tabs" aria-label="Football sections">${TABS.map(([k, l]) => `<a href="#football-${k}" aria-current="${k === tab ? 'page' : 'false'}">${l}</a>`).join('')}</nav>
    </div></div><div class="checker" aria-hidden="true"></div>`;
  }
  function renderFootball(tab) {
    initFootball();
    if (!TABS.find(t => t[0] === tab)) tab = 'overview';
    const body = { overview, roster, depth: () => depthPanel('current'), next: () => depthPanel('next'), schedule, stats, advanced, recruits, leaders, history, media: () => window.renderMedia('football') }[tab]();
    app.innerHTML = header(tab) + `<main class="wrap" id="panel">${body}</main>` + footer();
    const after = { roster: wireRoster, depth: () => wireDepth('current'), next: () => wireDepth('next'), history: wireHistory, recruits: wireRecruits, stats: wireStats }[tab];
    after && after();
    wirePlayers(app); wireGames(app);
  }
  function wireGames(root) {
    root.querySelectorAll('[data-game]').forEach(el => {
      el.addEventListener('click', e => { if (e.target.closest('[data-player]')) return; openGame(el.dataset.game); });
      el.addEventListener('keydown', e => { if (e.key === 'Enter') openGame(el.dataset.game); });
    });
  }
  function wirePlayers(root) {
    root.querySelectorAll('[data-player]').forEach(el => {
      if (el._wired) return; el._wired = true;
      el.addEventListener('click', e => { if (e.target.closest('.edit-tools')) return; e.preventDefault(); openPlayer(el.dataset.player); });
    });
  }
  function footer() {
    return `<footer><div class="wrap">Data last gathered ${fmtDate(F.updated, { month: 'long', day: 'numeric', year: 'numeric' })}. Sources:
      <ul>${F.sources.map(s => `<li>${esc(s[0])}: <a href="${s[2]}" target="_blank" rel="noopener">${esc(s[1])}</a></li>`).join('')}</ul>
      Ratings: an orange grade is On3's college player grade (Top 300). "TR" is the 247Sports transfer rating. Otherwise the number is the 247Sports composite from high school, with stars derived from it (98+ ★5, 89+ ★4, 80+ ★3). Fan site, not affiliated with the University of Tennessee.</div></footer>`;
  }

  // players worth knowing
  function standouts() {
    const score = p => (p.rating && p.rating.src === 'on3' ? 400 - p.rating.rank : 0) + p.honors.length * 25 + (p.natRanks || []).filter(r => r.rank <= 25).length * 60 + (p.draft ? ({ High: 80, Medium: 40, Watch: 10 })[p.draft.level] : 0) + (p.rating ? p.rating.grade : 0) / 10;
    return F.players.filter(p => p.honors.length || (p.rating && p.rating.src === 'on3') || (p.draft && p.draft.level !== 'Watch')).sort((a, b) => score(b) - score(a));
  }
  function pcard(p, why) {
    return `<button class="pcard" data-player="${esc(p.name)}">
      <div class="pcard-top"><span class="jersey">${p.num}</span><div><div class="nm">${esc(p.name)}${p.nick ? ` <span class="nick">"${esc(p.nick)}"</span>` : ''}</div><div class="sub">${p.pos} · ${clsLabel(p)}${p.prev ? ' · from ' + esc(p.prev.split('/').pop()) : ''}</div></div></div>
      <div class="tagrow">${rateBadge(p.rating)}${rankChips(p)}</div>
      ${why ? `<div class="why">${why}</div>` : ''}
    </button>`;
  }
  function kick(g) {
    const k = g.espn && g.espn.kick;
    if (!k || g.time && !/^\d/.test(g.time) && !/AM|PM/.test(g.time)) return g.time || 'TBA';
    const d = new Date(k); if (d.getUTCHours() < 8) return g.time || 'Time TBA';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  }
  const ABBR = { 'Alabama': 'BAMA', 'South Carolina': 'SC', 'Kentucky': 'UK', 'Texas A&M': 'TAMU', 'LSU': 'LSU', 'Vanderbilt': 'VAN' };
  const abbr = n => ABBR[n] || n.slice(0, 4).toUpperCase();
  function quickHits() {
    const t = F.team, R = t.ranks, next = F.schedule.find(g => !g.result && !(g.date < etToday()));
    const P = F.players;
    const best = (f) => P.map(p => [p, f(p)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
    const rb = best(p => p.stats.rush ? p.stats.rush[1] : 0), sk = best(p => p.stats.def ? p.stats.def.tfl : 0);
    const losses = F.schedule.filter(g => g.result === 'L').map(g => g.opp);
    const hits = [
      `<b>${t.record}</b> overall and <b>${t.sec}</b> in the SEC${losses.length ? `, with the only loss to ${esc(losses.join(', '))} by ${F.schedule.find(g => g.result === 'L').them - F.schedule.find(g => g.result === 'L').us}` : ''}. Ranked <b>No. ${t.ap}</b> in the AP poll.`,
      `The run game drives the offense: <b>${R.rushYpg[0]} rushing yards a game</b>, ${ord(R.rushYpg[2])} in the SEC. ${rb ? esc(rb[0].name) + ' has ' + rb[1] + ' yards.' : ''}`,
      `The defense allows <b>${R.oppg[0]} points a game</b>, ${ord(R.oppg[2])}-best in the SEC. ${sk ? esc(sk[0].name) + ' leads with ' + sk[1] + ' tackles for loss.' : ''}`,
      next && next.espn && next.espn.win != null ? `Next up: <b>${esc(next.opp)}</b>${next.espn.tv ? ' on ' + esc(next.espn.tv) : ''}. ESPN gives the Vols a <b>${Math.round(next.espn.win)}%</b> chance${next.espn.line ? ' (' + esc(next.espn.line) + ')' : ''}.` : '',
    ].filter(Boolean);
    return `<div class="box quick"><div class="eyebrow">The quick read</div><ul>${hits.map(h => `<li>${h}</li>`).join('')}</ul></div>`;
  }
  function rankTile(val, label, r) {
    return `<div class="tile"><b>${val}</b><span>${label}</span><em>No. ${r[1]} FBS · ${ord(r[2])} SEC</em></div>`;
  }
  function overview() {
    const t = F.team, R = t.ranks; const next = F.schedule.find(g => !g.result && !(g.date < etToday()));
    const played = F.schedule.filter(g => g.result);
    const qb1 = byName.get(((depthState.current.chart.Backfield || []).find(r => r[0] === 'QB') || [, []])[1][0]);
    const pick = (((window.EXTRAS || {}).football || {}).playersToKnow || []).map(n => byName.get(n)).filter(Boolean);
    let top = pick.length ? pick : standouts().slice(0, 8);
    if (!pick.length && qb1 && !top.some(p => p.pos === 'QB')) top = top.slice(0, 7).concat([qb1]);
    const E = next ? (next.espn || {}) : {};
    return `
    ${quickHits()}
    <div class="grid g2">
      ${next ? `<div class="box nextgame matchup click" data-game="${esc(next.opp)}" tabindex="0" role="button" aria-label="Open ${esc(next.opp)} matchup preview"><div class="eyebrow">Next game · ${fmtDate(next.date, { weekday: 'long', month: 'long', day: 'numeric' })} · ${esc(kick(next))}${E.tv ? ' · ' + esc(E.tv) : ''}</div>
        <div class="mrow"><div><span class="team">Tennessee</span><span class="dim">${t.record} · AP ${t.ap}</span></div><span class="vsmark">${next.site === 'H' ? 'VS' : 'AT'}</span><div class="r"><span class="team">${esc(next.opp)}</span><span class="dim">${esc(next.loc)}</span></div></div>
        ${E.win != null ? `<div class="wp"><div class="wp-l"><span>ESPN win chance</span><span>${E.line ? 'Line: <b>' + esc(E.line) + '</b>' : 'Line not posted yet'}${E.ou ? ' · O/U ' + E.ou : ''}</span></div>
          <div class="wp-bar" role="img" aria-label="Tennessee ${E.win}% chance to win"><i style="width:${E.win}%"></i></div>
          <div class="wp-l mono"><b class="ut">UT ${E.win.toFixed(1)}%</b><b>${esc(abbr(next.opp))} ${(100 - E.win).toFixed(1)}%</b></div></div>` : ''}
        <div class="golink" style="margin-top:10px">Matchup preview: impact players, team numbers, series history ›</div></div>` : ''}
      ${window.resultsBox({ games: played.map(g => ({ date: g.date, opp: g.opp, site: g.site, result: g.result, us: g.us, them: g.them, attr: `data-game="${esc(g.opp)}"` })), record: t.record,
        sub: (sp => sp && sp.conf && !sp.final ? sp.conf + ' SEC' : '')(window.secPlace && window.secPlace('football')),
        more: played.length > 5 ? [window.VI_ROUTER ? window.VI_ROUTER.href('football-schedule') : '#football-schedule', 'Full schedule and results'] : null,
        meta: `AP No. ${t.ap} · Coaches No. ${t.coaches} (${t.pollWeek}) · ${tip('FPI')} No. ${F.advanced.fpi.rank} · projected ${F.advanced.fpi.proj}` })}
    </div>
    <div class="section"><h3>Team numbers <small>per game through ${played.length} games, with national (FBS) and SEC rank</small></h3>
      <div class="tiles four">
        ${rankTile(R.ppg[0], 'Points scored', R.ppg)}${rankTile(R.oppg[0], 'Points allowed', R.oppg)}
        ${rankTile(R.ypg[0], 'Yards gained', R.ypg)}${rankTile(R.oypg[0], 'Yards allowed', R.oypg)}
        ${rankTile(R.rushYpg[0], 'Rush yards', R.rushYpg)}${rankTile(R.passYpg[0], 'Pass yards', R.passYpg)}
        ${rankTile(R.oPassYpg[0], 'Pass yds allowed', R.oPassYpg)}${rankTile(R.oRushYpg[0], 'Rush yds allowed', R.oRushYpg)}
      </div></div>
    <div class="section"><h3>Players to know <small>${pick.length ? 'The Vol Index picks · click a player for his card' : 'Top-rated players, national stat leaders, award lists and NFL prospects'}</small></h3>
      <div class="grid g4">${top.map(p => pcard(p, p.honors[0] ? '<span class="chip honor">Honor</span> ' + esc(p.honors[0]) : p.draft ? '<span class="chip risk-' + p.draft.level + '">NFL</span> ' + esc(p.draft.note) : p.pos === 'QB' ? '<span class="chip">QB1</span> Starting quarterback' + (p.stats.pass ? ': ' + p.stats.pass[2] + ' yds, ' + p.stats.pass[3] + ' TD, ' + p.stats.pass[4] + ' INT' : '') : '')).join('')}</div></div>
    <div class="section"><h3>Coaching staff</h3>
      <div class="box"><ul class="list">${t.staff.concat([['John Bonamego', 'Assistant Special Teams Coach']]).map(s => `<li><b class="grow">${esc(s[0])}</b><span class="dim">${esc(s[1])}</span></li>`).join('')}</ul></div></div>`;
  }

  /* roster */
  let rosterState = { group: 'All', q: '', sort: 'num' };
  function roster() {
    const groups = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'ST'];
    return `<div class="panel-head"><div><h2>Roster</h2><p>${F.players.length} players. Click a player for stats by year, honors, ratings and draft outlook.</p></div>
      <div class="controls">
        <div class="seg" role="group" aria-label="Position group">${groups.map(g => `<button data-g="${g}" aria-pressed="${rosterState.group === g}">${g}</button>`).join('')}</div>
        <input type="search" id="rosterSearch" placeholder="Search name or hometown" value="${esc(rosterState.q)}" aria-label="Search roster">
      </div></div>
      <div class="tablewrap"><table><thead><tr>
        <th class="n"><button data-s="num">#</button></th><th><button data-s="name">Name</button></th><th>Pos</th>
        <th><button data-s="rating">Rating</button></th><th>Class</th><th class="hide-sm">Ht / Wt</th><th class="hide-sm">Hometown / Last school</th><th>2027</th>
      </tr></thead><tbody id="rosterBody"></tbody></table></div>`;
  }
  function status27(p) {
    if (p.leaving) return '<span class="chip leave">Out of eligibility</span>';
    if (p.confirmed27) return '<span class="chip new">Returning (confirmed)</span>';
    if (p.draft) return `<span class="chip risk-${p.draft.level}">Draft: ${p.draft.level}</span>`;
    if (p.cls === 'Sr.') return '<span class="chip">5th year</span>';
    return '<span class="chip">Returns</span>';
  }
  function wireRoster() {
    const body = $('#rosterBody');
    const draw = () => {
      const q = rosterState.q.toLowerCase();
      let rows = F.players.filter(p => (rosterState.group === 'All' || posGroup(p.pos) === rosterState.group) && (!q || (p.name + ' ' + p.home + ' ' + p.hs + ' ' + (p.prev || '')).toLowerCase().includes(q)));
      const rv = p => p.rating ? (p.rating.src === 'on3' ? 200 + p.rating.grade : p.rating.grade) : 0;
      rows.sort(rosterState.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : rosterState.sort === 'rating' ? (a, b) => rv(b) - rv(a) : (a, b) => a.num - b.num);
      body.innerHTML = rows.map(p => `<tr class="click" data-player="${esc(p.name)}" tabindex="0">
        <td class="n"><b>${p.num}</b></td><td><b>${esc(p.name)}</b></td><td>${p.pos}</td><td>${rateBadge(p.rating, true)}</td>
        <td>${clsLabel(p)}</td><td class="hide-sm num">${p.ht} / ${p.wt}</td>
        <td class="hide-sm">${esc(p.home)}<br><span class="dim small">${esc(p.prev ? p.prev.split('/').pop() + ' (transfer)' : p.hs)}</span></td>
        <td>${status27(p)}</td></tr>`).join('') || '<tr><td colspan="8">No players match.</td></tr>';
      body.querySelectorAll('[data-player]').forEach(el => { el.addEventListener('click', () => openPlayer(el.dataset.player)); el.addEventListener('keydown', e => { if (e.key === 'Enter') openPlayer(el.dataset.player); }); });
    };
    app.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { rosterState.group = b.dataset.g; app.querySelectorAll('[data-g]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }));
    app.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { rosterState.sort = b.dataset.s; draw(); }));
    $('#rosterSearch').addEventListener('input', e => { rosterState.q = e.target.value; draw(); });
    draw();
  }

  /* depth charts */
  let editing = null, showRisk = false;
  // 2027 view: draft-risk players are left out of the projection; the toggle puts them back where they sit now
  function chartFor(which) {
    const d = depthState[which];
    if (which !== 'next' || !showRisk) return d.chart;
    const risk = F.players.filter(p => p.draft && !p.leaving && !p.confirmed27).map(p => p.name);
    const out = {};
    Object.entries(d.chart).forEach(([side, rows]) => {
      const curRows = depthState.current.chart[side] || [];
      out[side] = rows.map(([pos, names], ri) => {
        const cr = curRows.filter(r => r[0] === pos)[rows.slice(0, ri).filter(r => r[0] === pos).length];
        const add = cr ? cr[1].filter(n => risk.includes(n) && !names.includes(n)) : [];
        const list = names.slice();
        add.forEach(n => list.splice(Math.min(cr[1].indexOf(n), list.length), 0, n));
        return [pos, list];
      });
    });
    return out;
  }
  function who(name, which) {
    const p = byName.get(name);
    if (p) {
      const cls = which === 'next' ? nextLabel(p) : clsLabel(p);
      const tags = [];
      if (which === 'next' && p.draft && !p.confirmed27) tags.push(`<span class="chip risk-${p.draft.level}">Draft risk: ${p.draft.level}</span>`);
      if (which === 'next' && p.cls === 'Sr.' && !p.confirmed27) tags.push('<span class="chip">5th-year return</span>');
      if (which === 'next' && p.leaving) tags.push('<span class="chip leave">Out of eligibility</span>');
      if (which === 'next' && p.confirmed27) tags.push('<span class="chip new">Confirmed 5th year</span>');
      if (which === 'current') { tags.push(rankChips(p)); if (p.honors.length) tags.push('<span class="chip honor">Honors</span>'); }
      return { num: p.num, cls, rating: p.rating, tags, known: true, nick: p.nick };
    }
    const r = recByName.get(name);
    if (r) return { num: '', cls: 'Fr.', rating: { src: '247', grade: r.grade, stars: r.stars }, tags: ['<span class="chip new">2027 commit</span>'], known: true };
    return { num: '', cls: '', rating: null, tags: ['<span class="chip risk-Watch">Not on roster</span>'], known: false };
  }
  function pool(which) {
    const ps = F.players.filter(p => which === 'current' || !p.leaving).map(p => [p.name, `${p.name} · ${p.pos} #${p.num}${which === 'next' && p.draft ? ' (draft risk)' : ''}`]);
    const rs = which === 'next' ? F.recruits.map(r => [r.name, `${r.name} · ${r.pos} (2027 commit)`]) : [];
    return ps.concat(rs).sort((a, b) => a[0].localeCompare(b[0]));
  }
  function depthPanel(which) {
    const d = depthState[which]; const isEdit = editing === which;
    const intro = which === 'current'
      ? `<h2>Depth Chart</h2><p>${esc(d.basedOn)}. Updated ${fmtDate(d.updated, { month: 'short', day: 'numeric', year: 'numeric' })}. Click a name for the player card.</p>`
      : `<h2>2027 Preview</h2><p>${esc(d.basedOn)}. Under the new rule every player gets a 5th year, so only 5th-year players are out of eligibility. Classes shown are next season's. You can edit the preview and add anyone back, including draft risks.</p>`;
    const extra = which === 'next' ? nextSummary() : '';
    return `${depthState._draft ? `<div class="notice"><span><b>Unsaved edits.</b> You're seeing depth chart changes stored in this browser only. Save them to the data file to make them permanent.</span><button class="btn small" data-act="export">Save to file</button><button class="btn small" data-act="discard">Discard my edits</button></div>` : ''}
      <div class="panel-head"><div>${intro}</div>
        <div class="controls">${which === 'next' && !isEdit ? `<label class="toggle"><input type="checkbox" id="riskTgl" ${showRisk ? 'checked' : ''}> Show NFL draft-risk players</label>` : ''}${isEdit ? '' : `<button class="btn" data-act="edit">${which === 'next' ? 'Edit preview' : 'Edit depth chart'}</button>`}</div></div>
      ${isEdit ? `<div class="editbar"><p>Editing. Use ↑ ↓ to reorder, ✕ to remove, and the menu under each position to add a player. Changes are kept in this browser until you save them to the file.</p>
        <button class="btn primary" data-act="done">Done</button><button class="btn" data-act="export">Save to file</button><button class="btn" data-act="reset">Reset to file version</button></div>` : ''}
      <div id="exportBox"></div>${extra}${which === 'next' ? '<div class="side-title" style="margin-top:28px">Projected depth chart</div>' : ''}
      <div class="${isEdit ? 'editing' : ''}">${Object.entries(isEdit ? d.chart : chartFor(which)).map(([side, rows]) => `<div class="side-title">${esc(side)}</div>
        <div class="dgrid">${rows.map(([pos, names], ri) => `<div class="dpos"><div class="dpos-h"><b>${esc(pos)}</b><span>${names.length} deep</span></div>
          <ol>${names.map((n, i) => { const w = who(n, which); return `<li><span class="ord">${i + 1}</span>
            <div class="pn" data-player="${esc(n)}">${w.num !== '' ? `<b class="num pnum">${w.num}</b>` : ''}${esc(n)}${w.nick ? ` <span class="nick">"${esc(w.nick)}"</span>` : ''}<small>${esc(w.cls || '')}</small>
              <div class="tags">${rateBadge(w.rating, true)}${w.tags.join('')}</div></div>
            ${isEdit ? `<div class="edit-tools" data-side="${esc(side)}" data-row="${ri}" data-i="${i}"><button data-m="up" aria-label="Move ${esc(n)} up">↑</button><button data-m="down" aria-label="Move ${esc(n)} down">↓</button><button data-m="rm" aria-label="Remove ${esc(n)}">✕</button></div>` : '<span></span>'}
          </li>`; }).join('')}</ol>
          ${isEdit ? `<div class="addrow"><select data-add="${esc(side)}|${ri}" aria-label="Add player to ${esc(pos)}"><option value="">+ Add player…</option>${pool(which).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>` : ''}
        </div>`).join('')}</div>`).join('')}</div>`;
  }
  function nextSummary() {
    const leaving = F.players.filter(p => p.leaving);
    const risk = F.players.filter(p => p.draft && !p.leaving && !p.confirmed27);
    const seniors = F.players.filter(p => p.cls === 'Sr.');
    const starters = Object.values(depthState.current.chart).flat().filter(r => !['H', 'KO', 'PR', 'KR'].includes(r[0])).map(r => r[1][0]);
    const uniq = [...new Set(starters)];
    const ret = uniq.filter(n => byName.get(n) && !byName.get(n).leaving).length;
    const order = { High: 0, Medium: 1, Watch: 2 };
    return `<div class="tiles" style="margin-bottom:18px">
        <div class="tile"><b>${ret}/${uniq.length}</b><span>Starters with eligibility left</span></div>
        <div class="tile"><b>${leaving.length}</b><span>Out of eligibility (5th year)</span></div>
        <div class="tile"><b>${seniors.length}</b><span>Seniors eligible for a 5th year</span></div>
        <div class="tile"><b>${risk.length}</b><span>NFL draft risks</span></div>
        <div class="tile"><b>${F.recruits.length}</b><span>2027 commits</span></div></div>
      <div class="grid g2" style="margin-bottom:8px">
        <div class="box"><div class="lb"><h4>Out of eligibility after 2026 <span>5th-year players</span></h4></div><ul class="list">${leaving.map(p => `<li data-player="${esc(p.name)}" class="click-li"><span class="grow"><b>${esc(p.name)}</b> <span class="dim">${p.pos} · ${clsLabel(p)}</span></span>${rateBadge(p.rating, true)}</li>`).join('')}</ul></div>
        <div class="box"><div class="lb"><h4>NFL draft risk <span>From mock drafts, big boards and big seasons</span></h4></div><ul class="list">${risk.sort((a, b) => order[a.draft.level] - order[b.draft.level]).map(p => `<li data-player="${esc(p.name)}" class="click-li"><span class="grow"><b>${esc(p.name)}</b> <span class="dim">${p.pos} · ${clsLabel(p)}</span><br><span class="dim">${esc(p.draft.note)}</span></span><span class="chip risk-${p.draft.level}">${p.draft.level}</span></li>`).join('')}</ul></div>
      </div>`;
  }
  function saveDraft() { depthState._draft = true; store.set(DKEY, depthState); }
  function fileText() {
    const d = depthState;
    const chart = c => Object.entries(c).map(([side, rows]) => `    "${side}": [\n` + rows.map(([pos, ns]) => `      ["${pos}", ${JSON.stringify(ns)}]`).join(',\n') + '\n    ]').join(',\n');
    const part = (k) => `  "${k}": {\n    "label": ${JSON.stringify(d[k].label)},\n    "updated": "${new Date().toISOString().slice(0, 10)}",\n    "basedOn": ${JSON.stringify(d[k].basedOn)},\n    "chart": {\n${chart(d[k].chart)}\n    }\n  }`;
    return `/* ============================================================
   TENNESSEE FOOTBALL DEPTH CHARTS  (this is the file you edit)
   ------------------------------------------------------------
   Easiest: open the site, go to Depth Chart, click "Edit",
   make changes, then "Save to file" and replace this file.
   By hand: each row is ["POSITION", ["1st string", "2nd", ...]].
   Names must match the roster (or 2027 recruit list) exactly.
   Position labels can repeat (two DT rows, two CB rows, etc.).
   ============================================================ */
window.DEPTH = window.DEPTH || {};
window.DEPTH.football = {
  "rev": ${(depthState.rev || 0) + 1},
${part('current')},
${part('next')}
};
`;
  }
  async function exportFile(which) {
    const text = fileText();
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: 'football-depth.js', types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }] });
        const w = await h.createWritable(); await w.write(text); await w.close();
        store.del(DKEY); depthState._draft = false; depthState.current.updated = depthState.next.updated = new Date().toISOString().slice(0, 10);
        editing = null; renderFootball(which === 'next' ? 'next' : 'depth');
        $('#exportBox').innerHTML = '<div class="notice ok"><span>Saved. If you saved over <b>data/football-depth.js</b>, the site now uses your chart for everyone.</span></div>';
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    $('#exportBox').innerHTML = `<div class="box" style="padding:12px;margin-bottom:12px;display:grid;gap:8px">
      <b>Copy this into data/football-depth.js (replace everything in the file)</b>
      <textarea class="export" id="exportText" readonly>${esc(text)}</textarea>
      <div class="controls"><button class="btn primary" id="copyBtn">Copy text</button><span id="copyMsg" class="dim"></span></div></div>`;
    $('#copyBtn').addEventListener('click', () => {
      const ta = $('#exportText');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => { $('#copyMsg').textContent = 'Copied.'; })
        .catch(() => { ta.focus(); ta.select(); $('#copyMsg').textContent = 'Text selected. Press Ctrl+C to copy.'; });
    });
    $('#exportBox').scrollIntoView({ block: 'nearest' });
  }
  function wireDepth(which) {
    const tab = which === 'next' ? 'next' : 'depth';
    const tg = $('#riskTgl'); if (tg) tg.addEventListener('change', () => { showRisk = tg.checked; renderFootball('next'); });
    app.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'edit') { editing = which; renderFootball(tab); }
      else if (a === 'done') { editing = null; renderFootball(tab); }
      else if (a === 'export') exportFile(which);
      else if (a === 'discard' || a === 'reset') { store.del(DKEY); depthState = JSON.parse(JSON.stringify(window.DEPTH.football)); depthState._draft = false; renderFootball(tab); }
    }));
    app.querySelectorAll('.edit-tools button').forEach(b => b.addEventListener('click', () => {
      const t = b.parentElement; const rows = depthState[which].chart[t.dataset.side]; const list = rows[+t.dataset.row][1]; const i = +t.dataset.i;
      if (b.dataset.m === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      else if (b.dataset.m === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
      else if (b.dataset.m === 'rm') list.splice(i, 1);
      saveDraft(); renderFootball(tab);
    }));
    app.querySelectorAll('[data-add]').forEach(s => s.addEventListener('change', () => {
      if (!s.value) return; const [side, ri] = s.dataset.add.split('|');
      const list = depthState[which].chart[side][+ri][1]; if (!list.includes(s.value)) list.push(s.value);
      saveDraft(); renderFootball(tab);
    }));
  }

  /* schedule */
  function schedule() {
    const rows = F.schedule.map(g => { const e = g.espn || {}; return `<tr class="click" data-game="${esc(g.opp)}" tabindex="0" title="${g.result ? 'Box score' : 'Matchup preview'}"><td class="num">${fmtDate(g.date)}</td><td><b>${g.site === 'A' ? 'at ' : ''}${esc(g.opp)}</b>${g.sec ? ' <span class="chip">SEC</span>' : ''}</td>
      <td class="hide-sm">${esc(g.loc)}</td><td class="num">${g.result ? `<span class="${g.result}">${g.result}</span> ${g.us}–${g.them}` : esc(kick(g))}</td><td class="hide-sm">${esc(e.tv || (g.result ? '' : 'TBA'))}</td>
      <td class="num">${g.result ? '' : esc(e.line || '—')}</td><td>${!g.result && e.win != null ? winBar(e.win) : ''}</td><td class="n"><span class="golink">${g.result ? 'Box score' : 'Preview'} ›</span></td></tr>`; }).join('');
    const n = F.schedule2027;
    return `<div class="panel-head"><div><h2>Schedule & Standings</h2><p>Click any game: finished games open the full box score, upcoming games open a matchup preview. Lines and win chances come from ESPN (DraftKings line, ESPN FPI matchup predictor). TV networks and kickoff times are announced 6–12 days before each game.${(sp => sp ? ` <a href="#standings" class="jump" data-goto-stand>Tennessee is ${sp.text} in the SEC${sp.final ? ' (' + sp.season + ' final)' : ''}${sp.conf ? ', ' + sp.conf : ''} ›</a>` : '')(window.secPlace && window.secPlace('football'))}</p></div><div class="controls">${window.standSwitch ? window.standSwitch() : ''}</div></div>
      <div data-view="standings" ${window.standCur && window.standCur() !== 'standings' ? 'hidden' : ''}>${window.standingsHtml ? window.standingsHtml('football') : ''}</div>
      <div data-view="schedule" ${window.standCur && window.standCur() !== 'schedule' ? 'hidden' : ''}><div class="tablewrap"><table><thead><tr><th>Date</th><th>Opponent</th><th class="hide-sm">Location</th><th>Result / Time</th><th class="hide-sm">TV</th><th>Line</th><th>Win chance</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="section"><h3>2027 schedule <small>Opponents announced; SEC dates not yet released</small></h3>
        <div class="grid g2">
          <div class="box"><div class="lb"><h4>Home <span>Neyland Stadium</span></h4></div><ul class="list">${n.filter(g => g.site === 'H').map(g => `<li><span class="grow"><b>${esc(g.opp)}</b>${g.sec ? ' <span class="chip">SEC</span>' : ''}</span><span class="dim">${g.date ? fmtDate(g.date) : 'Date TBA'}</span></li>`).join('')}</ul></div>
          <div class="box"><div class="lb"><h4>Away <span>Road games</span></h4></div><ul class="list">${n.filter(g => g.site === 'A').map(g => `<li><span class="grow"><b>at ${esc(g.opp)}</b>${g.sec ? ' <span class="chip">SEC</span>' : ''}</span><span class="dim">${g.date ? fmtDate(g.date) : 'Date TBA'}</span></li>`).join('')}</ul></div>
        </div></div></div>`;
  }
  function winBar(pct) {
    return `<span class="winbar" title="Tennessee win chance ${pct}%"><i style="width:${pct}%"></i></span> <b class="num">${pct.toFixed(1)}%</b>`;
  }

  /* stats: player stats + team stats */
  let statsView = 'player', statsCat = 'passing', statsPos = 'All', statsQ = '', statsSort = null;
  const STAT_GROUPS = [
    ['Offense', [['passing', 'Passing'], ['rushing', 'Rushing'], ['receiving', 'Receiving'], ['touchdowns', 'Touchdowns']]],
    ['Defense', [['tackles', 'Tackles'], ['sacks', 'Sacks'], ['interceptions', 'Interceptions']]],
    ['Special teams', [['returning', 'Returning'], ['kicking', 'Kicking'], ['punting', 'Punting']]],
  ];
  function stats() {
    return `<div class="panel-head"><div><h2>2026 Stats</h2><p>Player stats for every Vol with a stat this season, and team stats with national (FBS) and SEC ranks. Click a column to sort.</p></div>
      <div class="controls"><div class="seg" role="group" aria-label="Stats view">${[['player', 'Player stats'], ['team', 'Team stats']].map(([k, l]) => `<button data-sv="${k}" aria-pressed="${statsView === k}">${l}</button>`).join('')}</div></div></div>
      <div id="statsBody"></div>`;
  }
  function sortTable(cols, rows, defIdx, lowCols = []) {
    const si = statsSort && statsSort.cols === cols.join() ? statsSort.i : defIdx;
    const dir = statsSort && statsSort.cols === cols.join() ? statsSort.dir : (lowCols.includes(defIdx) ? 1 : -1);
    rows = rows.slice().sort((a, b) => { const x = a[si], y = b[si]; if (si === 0) return dir * String(x).localeCompare(String(y)); return dir * ((x ?? -1e9) - (y ?? -1e9)); });
    return `<div class="tablewrap"><table data-cols="${esc(cols.join())}"><thead><tr><th><button data-sort="0">Player${si === 0 ? (dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>${cols.map((c, i) => `<th class="n"><button data-sort="${i + 1}">${c}${si === i + 1 ? (dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => { const p = byName.get(r[0]); return `<tr class="click" data-player="${esc(r[0])}"><td><b>${esc(r[0])}</b> <span class="dim small">${p ? p.pos + ' · ' + p.cls : ''}</span> ${p ? rankChips(p) : ''}</td>${r.slice(1).map(v => `<td class="n">${n1(v)}</td>`).join('')}</tr>`; }).join('') || `<tr><td colspan="${cols.length + 1}">No players match.</td></tr>`}</tbody></table></div>`;
  }
  function playerStatsHtml() {
    const q = statsQ.toLowerCase();
    const P = F.players.filter(p => (statsPos === 'All' || posGroup(p.pos) === statsPos) && (!q || p.name.toLowerCase().includes(q)));
    const d = p => p.stats.def || {};
    const T = (cols, rows, def, low) => sortTable(cols, rows, def, low);
    switch (statsCat) {
      case 'passing': return T(['Cmp', 'Att', 'Pct', 'Yds', 'Y/A', 'TD', 'Int', 'Long', 'Rating'], P.filter(p => p.stats.pass).map(p => { const s = p.stats.pass; return [p.name, s[0], s[1], s[1] ? +(s[0] / s[1] * 100).toFixed(1) : 0, s[2], s[1] ? +(s[2] / s[1]).toFixed(1) : 0, s[3], s[4], s[5], s[6]]; }), 4);
      case 'rushing': return T(['Att', 'Yds', 'Avg', 'Long', 'TD'], P.filter(p => p.stats.rush).map(p => [p.name, ...p.stats.rush]), 2);
      case 'receiving': return T(['Rec', 'Yds', 'Avg', 'Long', 'TD'], P.filter(p => p.stats.rec).map(p => [p.name, ...p.stats.rec]), 2);
      case 'touchdowns': return T(['Rush', 'Rec', 'Return', 'Total', 'Pass TD thrown'], P.map(p => { const r = p.stats.rush ? p.stats.rush[4] : 0, c = p.stats.rec ? p.stats.rec[4] : 0, ret = (p.stats.pr ? p.stats.pr[3] : 0) + (p.stats.kr ? p.stats.kr[3] : 0); return [p.name, r, c, ret, r + c + ret, p.stats.pass ? p.stats.pass[3] : 0]; }).filter(r => r[4] || r[5]), 4);
      case 'tackles': return T(['GP', 'Solo', 'Ast', 'Total', 'TFL', 'FF', 'FR'], P.filter(p => d(p).tot).map(p => [p.name, d(p).gp, d(p).solo, d(p).ast, d(p).tot, d(p).tfl, d(p).ff, d(p).fr]), 4);
      case 'sacks': return T(['Sacks', 'TFL', 'QB hurries', 'Tackles'], P.filter(p => d(p).sacks || d(p).qbh || d(p).tfl).map(p => [p.name, d(p).sacks, d(p).tfl, d(p).qbh, d(p).tot]), 1);
      case 'interceptions': return T(['INT', 'PBU', 'Passes defended', 'Tackles'], P.filter(p => d(p).int || d(p).pbu).map(p => [p.name, d(p).int, d(p).pbu, (d(p).int || 0) + (d(p).pbu || 0), d(p).tot]), 3);
      case 'returning': return `<h4 class="subhead">Punt returns</h4>` + T(['No', 'Yds', 'Avg', 'TD', 'Long'], P.filter(p => p.stats.pr).map(p => [p.name, ...p.stats.pr]), 2)
        + `<h4 class="subhead">Kick returns</h4>` + T(['No ', 'Yds ', 'Avg ', 'TD ', 'Long '], P.filter(p => p.stats.kr).map(p => [p.name, ...p.stats.kr]), 2);
      case 'kicking': return `<h4 class="subhead">Field goals & PATs</h4>` + T(['FGM', 'FGA', 'FG%', 'XPM', 'XPA', 'Long'], P.filter(p => p.stats.kick).map(p => { const k = p.stats.kick; return [p.name, k[0], k[1], k[1] ? +(k[0] / k[1] * 100).toFixed(1) : 0, k[2], k[3], k[4]]; }), 1)
        + `<h4 class="subhead">Kickoffs</h4>` + T(['Kicks', 'Yds', 'Avg', 'Touchbacks'], P.filter(p => p.stats.ko).map(p => [p.name, ...p.stats.ko]), 1);
      case 'punting': return T(['Punts', 'Yds', 'Avg', 'Long', 'Fair catch', 'Inside 20', '50+'], P.filter(p => p.stats.punt).map(p => [p.name, ...p.stats.punt]), 1);
    }
    return '';
  }
  const TEAM_GROUPS = [['Offense', ['Total offense', 'Passing', 'Rushing', 'Receiving', 'Downs']], ['Defense', ['Points allowed', 'Yards allowed', 'Pass defense', 'Run defense']], ['Special teams', ['Returning']]];
  function teamStatsHtml() {
    const S = F.teamSheet;
    if (!S) {
      const R = F.team.ranks;
      const rows = [['Points per game', R.ppg], ['Points allowed', R.oppg], ['Yards per game', R.ypg], ['Yards allowed', R.oypg], ['Rushing yards', R.rushYpg], ['Passing yards', R.passYpg], ['Rush yards allowed', R.oRushYpg], ['Pass yards allowed', R.oPassYpg]];
      return `<div class="notice"><span>The full team stat sheet appears after the next data update. Key numbers so far:</span></div>` + teamTable(rows.map(([l, r]) => [l, r[0], r[1], r[2]]), 136, 16);
    }
    const by = g => S.rows.filter(r => r[2] === g).map(r => [r[1], r[3], r[4], r[5]]);
    const esp = (k, l) => S.espn && S.espn[k] ? `<h4 class="subhead">${l} <small class="dim">(ESPN, season totals)</small></h4><div class="tablewrap"><table class="mini"><tbody>${S.espn[k].filter(x => x[1] && !/^(0|0\.0|0-0)$/.test(x[1]) && !/Team Games Played|Touchback Percentage|Total Kicking Points/.test(x[0])).map(x => `<tr><td>${esc(x[0])}</td><td class="n">${esc(x[1])}</td></tr>`).join('')}</tbody></table></div>` : '';
    return TEAM_GROUPS.map(([side, groups]) => `<div class="section"><h3>${side}</h3><div class="grid g2">${groups.map(g => `<div><h4 class="subhead">${g}</h4>${teamTable(by(g), S.teams, S.secTeams)}</div>`).join('')}
      ${side === 'Special teams' ? `<div>${esp('kicking', 'Kicking')}${esp('punting', 'Punting')}</div>` : ''}</div></div>`).join('')
      + `<p class="dim small">Ranks among ${S.teams} FBS teams and ${S.secTeams} SEC teams, computed from <a href="https://collegefootballdata.com" target="_blank" rel="noopener">CollegeFootballData.com</a> season stats. Compare with <a href="https://www.espn.com/college-football/stats/_/view/team" target="_blank" rel="noopener">ESPN team stats</a>.</p>`;
  }
  function teamTable(rows, nat, sec) {
    return `<div class="tablewrap"><table class="mini"><thead><tr><th>Stat</th><th class="n">Tennessee</th><th class="n">FBS</th><th class="n">SEC</th><th class="hide-sm"></th></tr></thead>
      <tbody>${rows.map(([l, v, rn, rs]) => `<tr><td>${esc(l)}</td><td class="n"><b>${n1(v)}</b></td><td class="n">${ord(rn)}</td><td class="n">${ord(rs)}</td><td class="hide-sm">${rankBar(rn, nat)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function wireStats() {
    const draw = () => {
      const body = $('#statsBody');
      if (statsView === 'team') { body.innerHTML = teamStatsHtml(); return; }
      const groups = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'ST'];
      body.innerHTML = `<div class="statnav">${STAT_GROUPS.map(([g, cats]) => `<div><span class="eyebrow">${g}</span><div class="seg" role="group" aria-label="${g} stats">${cats.map(([k, l]) => `<button data-cat="${k}" aria-pressed="${statsCat === k}">${l}</button>`).join('')}</div></div>`).join('')}</div>
        <div class="controls" style="margin:12px 0"><div class="seg" role="group" aria-label="Position filter">${groups.map(g => `<button data-sp="${g}" aria-pressed="${statsPos === g}">${g}</button>`).join('')}</div>
        <input type="search" id="statsSearch" placeholder="Filter by name" value="${esc(statsQ)}" aria-label="Filter players by name"></div>
        <div id="statsTable">${playerStatsHtml()}</div>
        ${glossary([['TFL', 'Tackle for loss: a tackle behind the line of scrimmage.'], ['PBU', 'Pass breakup: knocking down a pass.'], ['QB hurries', 'Forcing a rushed throw.'], ['FF / FR', 'Forced fumble / fumble recovered.'], ['Rating', 'NCAA passer efficiency rating.'], ['Y/A', 'Passing yards per attempt.'], ['Inside 20', "Punts downed inside the opponent's 20-yard line."]])}`;
      const wireT = () => {
        $('#statsTable').querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', e => {
          e.stopPropagation(); const cols = b.closest('table').dataset.cols; const i = +b.dataset.sort;
          statsSort = statsSort && statsSort.cols === cols && statsSort.i === i ? { cols, i, dir: -statsSort.dir } : { cols, i, dir: i === 0 ? 1 : -1 };
          $('#statsTable').innerHTML = playerStatsHtml(); wireT();
        }));
        wirePlayers($('#statsTable'));
      };
      wireT();
      body.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { statsCat = b.dataset.cat; statsSort = null; draw(); }));
      body.querySelectorAll('[data-sp]').forEach(b => b.addEventListener('click', () => { statsPos = b.dataset.sp; draw(); }));
      $('#statsSearch').addEventListener('input', e => { statsQ = e.target.value; $('#statsTable').innerHTML = playerStatsHtml(); wireT(); });
    };
    app.querySelectorAll('[data-sv]').forEach(b => b.addEventListener('click', () => { statsView = b.dataset.sv; app.querySelectorAll('[data-sv]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }));
    draw();
  }

  /* advanced */
  function rankBar(rank, total = 136) {
    const pct = Math.max(2, (1 - (rank - 1) / total) * 100);
    const tone = rank <= 25 ? 'good' : rank <= 70 ? 'mid' : 'low';
    return `<span class="rbar ${tone}" title="No. ${rank} of ${total} FBS"><i style="width:${pct}%"></i></span>`;
  }
  function metricList(title, rows) {
    return `<div class="box"><div class="lb"><h4>${title} <span>Value · FBS rank</span></h4></div><ul class="list mlist">${rows.map(r => `<li><span class="grow">${esc(r[0])}</span><span class="num">${esc(r[1])}</span>${rankBar(r[2])}<b class="num rk">${r[2]}</b></li>`).join('')}</ul></div>`;
  }
  function advanced() {
    const A = F.advanced, P = A.pear, f = A.fpi;
    const sec = A.sec.slice().sort((a, b) => a[2] - b[2]);
    const tnSec = sec.findIndex(r => r[0] === 'Tennessee') + 1;
    const fpiSec = A.sec.slice().sort((a, b) => a[9] - b[9]).findIndex(r => r[0] === 'Tennessee') + 1;
    return `<div class="panel-head"><div><h2>Advanced</h2><p>Computer ratings, efficiency metrics and projections from PEAR Ratings and ESPN's Football Power Index (FPI), with Tennessee's rank nationally and in the SEC.</p></div></div>
      <div class="tiles" style="margin-bottom:16px">
        <div class="tile"><b>${P.ratings[0][2]}</b><span>${tip('PEAR')} TSR rank</span><em>${ord(tnSec)} in SEC</em></div>
        <div class="tile"><b>${f.rank}</b><span>${tip('FPI')} rank (${f.fpi})</span><em>${ord(fpiSec)} in SEC</em></div>
        <div class="tile"><b>${f.proj}</b><span>${tip('FPI')} projected record</span><em>Win out: ${f.winOut}%</em></div>
        <div class="tile"><b>${f.playoff}%</b><span>Playoff chance (FPI)</span><em>Win SEC: ${f.winConf}%</em></div>
        <div class="tile"><b>${f.winNC}%</b><span>Win national title</span><em>Reach title game: ${f.makeNC}%</em></div>
      </div>
      <div class="grid g3x">
        ${metricList('Computer ratings', P.ratings)}
        ${metricList('Offense', P.offense)}
        ${metricList('Defense', P.defense)}
      </div>
      <div class="section"><h3>Remaining games: PEAR model <small>PEAR's own projected line, score and Tennessee win chance (the Schedule tab shows ESPN's)</small></h3>
        <div class="tablewrap"><table><thead><tr><th>Opponent</th><th class="n">Opp. rank</th><th>Line</th><th class="n">Proj. score (UT–Opp)</th><th>Win chance</th></tr></thead>
        <tbody>${P.games.map(g => `<tr><td><b>${esc(g[0])}</b></td><td class="n">${g[1]}</td><td>${esc(g[2])}</td><td class="n">${esc(g[3])}</td><td>${winBar(g[4])}</td></tr>`).join('')}</tbody></table></div>
        <p class="dim small">Expected wins in remaining games: <b>${(P.games.reduce((a, g) => a + g[4], 0) / 100).toFixed(1)}</b> (sum of win chances), for a projected finish near ${5 + Math.round(P.games.reduce((a, g) => a + g[4], 0) / 100)}-${1 + 6 - Math.round(P.games.reduce((a, g) => a + g[4], 0) / 100)}.</p></div>
      <div class="section"><h3>Tennessee vs. the SEC <small>Sorted by PEAR team rating. Ranks are national (FBS).</small></h3>
        <div class="tablewrap"><table><thead><tr><th>Team</th><th class="n">PEAR</th><th class="n">Nat'l</th><th class="n">Off. (rk)</th><th class="n">Def. (rk)</th><th class="n">SOS rk</th><th class="n">FPI</th><th class="n">FPI rk</th><th class="n">FPI proj.</th><th class="n">Win SEC</th><th class="n">Playoff</th></tr></thead>
        <tbody>${sec.map(r => `<tr class="${r[0] === 'Tennessee' ? 'me' : ''}"><td><b>${esc(r[0])}</b></td><td class="n">${r[1].toFixed(1)}</td><td class="n">${r[2]}</td><td class="n">${r[3].toFixed(1)} (${r[4]})</td><td class="n">${r[5].toFixed(1)} (${r[6]})</td><td class="n">${r[7]}</td><td class="n">${r[8].toFixed(1)}</td><td class="n">${r[9]}</td><td class="n">${r[10]}</td><td class="n">${r[11].toFixed(1)}%</td><td class="n">${r[12].toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
        <p class="dim small">PEAR offense rating: higher is better. PEAR defense rating: points allowed to an average offense, lower is better.</p></div>
      ${glossary([
        ['TSR', 'PEAR\'s team strength rating: roughly how many points better than an average FBS team on a neutral field.'],
        ['SP+', 'Bill Connelly\'s tempo- and opponent-adjusted efficiency rating, in points per game vs. an average team.'],
        ['FPI', 'ESPN\'s Football Power Index: expected point margin vs. an average team. Powers ESPN\'s win chances.'],
        ['FEI', 'Brian Fremeau\'s drive-based efficiency rating, adjusted for opponent.'],
        ['EPA / PPA', 'Expected points added per play: how much each snap changes the expected score. Positive is good for an offense, negative is good for a defense.'],
        ['Success rate', 'Share of plays that keep an offense on schedule (about 50% of needed yards on 1st down, 70% on 2nd, 100% on 3rd/4th).'],
        ['Points per opportunity', 'Points scored per drive that reaches the opponent\'s 40. Finishing drives. For a defense, lower is better.'],
        ['Drive quality', 'How well a team moves the ball on a typical drive (defense: how well it stops drives).'],
        ['SOS', 'Strength of schedule. Lower rank number = tougher schedule.'],
        ['RQI', 'Resume quality: how impressive the wins and losses are so far, regardless of how good the team looks.'],
      ])}`;
  }

  function glossary(items) {
    return `<details class="box gloss"><summary>What do these numbers mean?</summary><dl>${items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>`;
  }

  /* recruits */
  let recYear = 2027;
  function compositeHtml() {
    const rows = F.players.map(p => ({ p, hs: p.r247 && p.r247.hs, tr: p.r247 && p.r247.transfer })).filter(x => x.hs || x.tr);
    rows.sort((a, b) => ((b.hs && b.hs.grade) || 0) - ((a.hs && a.hs.grade) || 0));
    const T = F.talent;
    const stars = [5, 4, 3, 2].map(n => [n, rows.filter(x => x.hs && x.hs.stars === n).length]);
    const avg = rows.filter(x => x.hs).reduce((a, x) => a + x.hs.grade, 0) / Math.max(1, rows.filter(x => x.hs).length);
    return `<div class="panel-head"><div><h2>Team Composite</h2><p>Every player on the 2026 roster with their 247Sports composite rating coming out of high school, plus transfer ratings. This is the talent the 247Sports Team Talent Composite measures.</p></div>
      <div class="controls">${recSeg()}</div></div>
      ${rows.length ? `<div class="tiles" style="margin-bottom:16px">${T ? `<div class="tile"><b>${T.rank}</b><span>247 Team Talent Composite</span><em>Score ${T.score} · of ${T.of} teams</em></div>` : ''}<div class="tile"><b>${avg.toFixed(2)}</b><span>Avg. HS composite</span></div>${stars.map(([n, c]) => `<div class="tile"><b>${c}</b><span>${n}-star (HS)</span></div>`).join('')}<div class="tile"><b>${rows.filter(x => x.tr).length}</b><span>Rated transfers</span></div></div>
      <div class="tablewrap" style="max-height:640px"><table><thead><tr><th>Player</th><th>Pos</th><th>HS rating</th><th class="n">Nat'l</th><th class="n">Class</th><th class="hide-sm">High school</th><th>Transfer rating</th></tr></thead>
      <tbody>${rows.map(({ p, hs, tr }) => `<tr class="click" data-player="${esc(p.name)}"><td><b>${esc(p.name)}</b> <span class="dim small">${clsLabel(p)}</span></td><td>${p.pos}</td>
        <td>${hs ? rateBadge({ src: '247', grade: Math.floor(hs.grade), stars: hs.stars, label: '247 composite' }) + ` <span class="dim small">${hs.grade.toFixed(2)}</span>` : '—'}</td><td class="n">${hs && hs.nat ? hs.nat : '—'}</td><td class="n">${hs ? hs.cls : '—'}</td>
        <td class="hide-sm">${hs ? esc(hs.school || '') + (hs.committedTo && hs.committedTo !== 'Tennessee' ? `<br><span class="dim small">Signed with ${esc(hs.committedTo)}</span>` : '') : ''}</td>
        <td>${tr && tr.grade ? rateBadge({ src: '247t', grade: Math.floor(tr.grade), stars: tr.stars }) + ` <span class="dim small">from ${esc(tr.origin)}</span>` : '—'}</td></tr>`).join('')}</tbody></table></div>
      ${T && T.top ? `<div class="section"><h3>Team Talent Composite top 15</h3><div class="box"><ol class="list">${T.top.map((t, i) => `<li class="${t[0] === 'Tennessee' ? 'me' : ''}"><b class="num">${i + 1}</b><span class="grow">${esc(t[0])}</span><span class="num">${t[1]}</span></li>`).join('')}</ol></div></div>` : ''}`
      : `<div class="notice"><span>The full-roster 247 ratings load after the next data update (run <b>tools/update_data.bat</b>).</span></div>`}
      <p class="dim small">Sources: <a href="https://247sports.com/college/tennessee/team/tennessee-volunteers-football-184/roster/" target="_blank" rel="noopener">247Sports Tennessee roster</a>, <a href="https://247sports.com/season/2026-football/compositeteamrankings/" target="_blank" rel="noopener">247Sports Team Talent Composite</a>; ratings delivered through <a href="https://collegefootballdata.com" target="_blank" rel="noopener">CollegeFootballData.com</a>.</p>`;
  }
  function recSeg() { return `<div class="seg" role="group" aria-label="Recruiting view">${[[2027, 'Class of 2027'], [2028, 'Class of 2028'], ['comp', 'Team composite']].map(([y, l]) => `<button data-yr="${y}" aria-pressed="${recYear === y}">${l}</button>`).join('')}</div>`; }
  function recruits() {
    if (recYear === 'comp') return compositeHtml();
    const r = recYear === 2027 ? F.recruits : F.recruits2028;
    const st = [5, 4, 3].map(s => [s, r.filter(x => x.stars === s).length]);
    const intro = recYear === 2027
      ? `${r.length} commitments. 247Sports team rank: No. ${F.recruitClass.rank247}. Ratings are the 247Sports composite; stars are derived from the rating.`
      : `It's early: ${r.length} commitment so far for the class of 2028. Ratings are the 247Sports composite.`;
    return `<div class="panel-head"><div><h2>${recYear} Recruiting Class</h2><p>${intro}</p></div>
      <div class="controls">${recSeg()}</div></div>
      <div class="tiles" style="margin-bottom:16px"><div class="tile"><b>${r.length}</b><span>Commits</span></div>${st.map(([s, c]) => `<div class="tile"><b>${c}</b><span>${s}-star</span></div>`).join('')}${recYear === 2027 ? `<div class="tile"><b>${F.recruitClass.rank247}</b><span>247 class rank</span></div><div class="tile"><b>${F.transferClassRank}</b><span>2026 transfer class rank</span></div>` : ''}</div>
      <div class="tablewrap"><table><thead><tr><th>Name</th><th>Pos</th><th>Rating</th><th class="n">Nat'l</th><th class="n">Pos</th><th class="n">State</th><th class="hide-sm">School</th><th class="hide-sm">Ht / Wt</th><th class="hide-sm">Committed</th></tr></thead>
      <tbody>${r.map(x => `<tr class="click" data-player="${esc(x.name)}"><td><b>${esc(x.name)}</b></td><td>${x.pos}</td><td>${rateBadge({ src: '247', grade: x.grade, stars: x.stars })}</td>
        <td class="n">${x.nat || '—'}</td><td class="n">${x.posRank || '—'}</td><td class="n">${x.stateRank || '—'}</td>
        <td class="hide-sm">${esc(x.hs)}<br><span class="dim small">${esc(x.home)}</span></td><td class="hide-sm num">${x.ht} / ${x.wt}</td><td class="hide-sm num">${fmtDate(x.committed, { month: 'short', day: 'numeric', year: 'numeric' })}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function wireRecruits() { app.querySelectorAll('[data-yr]').forEach(b => b.addEventListener('click', () => { recYear = b.dataset.yr === 'comp' ? 'comp' : +b.dataset.yr; renderFootball('recruits'); })); }

  /* leaders & honors */
  function board(title, unit, rows, max) {
    if (!rows.length) return '';
    return `<div class="box lb"><h4>${title} <span>${unit}</span></h4><ol>${rows.map(([p, v, sub, nat]) => `<li data-player="${esc(p)}" class="click-li"><span><b>${esc(p)}</b> <span class="dim small">${esc(sub || '')}</span>${nat ? ` <span class="chip nat">No. ${nat} nat'l</span>` : ''}</span><b class="num">${n1(v)}</b><span class="bar"><i style="width:${Math.max(4, v / max * 100)}%"></i></span></li>`).join('')}</ol></div>`;
  }
  function natFor(p, stat) { const r = (p.natRanks || []).find(x => x.stat === stat); return r && r.rank <= 25 ? r.rank : null; }
  function leaders() {
    const P = F.players;
    const top = (f, k = 5) => P.map(p => [p, f(p)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, k);
    const pass = top(p => p.stats.pass ? p.stats.pass[2] : 0, 3), rush = top(p => p.stats.rush ? p.stats.rush[1] : 0), rec = top(p => p.stats.rec ? p.stats.rec[1] : 0);
    const tk = top(p => p.stats.def ? p.stats.def.tot : 0), sk = top(p => p.stats.def ? p.stats.def.sacks : 0), tfl = top(p => p.stats.def ? p.stats.def.tfl : 0), it = top(p => p.stats.def ? p.stats.def.int : 0), pbu = top(p => p.stats.def ? p.stats.def.pbu : 0);
    const B = (title, unit, list, sub, stat) => board(title, unit, list.map(([p, v]) => [p.name, v, sub(p), stat ? natFor(p, stat) : null]), list.length ? list[0][1] : 1);
    const honored = P.filter(p => p.honors.length);
    const order = { High: 0, Medium: 1, Watch: 2 };
    const prospects = P.filter(p => p.draft).sort((a, b) => order[a.draft.level] - order[b.draft.level]);
    const future = P.filter(p => p.future).sort((a, b) => a.future.year - b.future.year || a.future.rank - b.future.rank);
    const natAll = P.filter(p => (p.natRanks || []).some(r => r.rank <= 25));
    return `<div class="panel-head"><div><h2>Leaders & Honors</h2><p>2026 team leaders with national ranks, award watch lists, weekly honors and NFL draft outlook.</p></div></div>
      ${natAll.length ? `<div class="box natbox"><div class="eyebrow">Top 25 in the nation</div><div class="controls">${natAll.map(p => (p.natRanks || []).filter(r => r.rank <= 25).map(r => `<button class="chip nat big" data-player="${esc(p.name)}">${esc(p.name)} · No. ${r.rank} nationally in ${esc(r.stat.toLowerCase())}</button>`).join('')).join('')}</div></div>` : ''}
      <div class="grid g3" style="margin-top:14px">
        ${B('Passing', 'yards', pass, p => `${p.stats.pass[3]} TD, ${p.stats.pass[4]} INT`)}
        ${B('Rushing', 'yards', rush, p => `${p.stats.rush[0]} car, ${p.stats.rush[4]} TD`, 'Rushing yards')}
        ${B('Receiving', 'yards', rec, p => `${p.stats.rec[0]} rec, ${p.stats.rec[4]} TD`, 'Receiving yards')}
        ${B('Tackles', 'total', tk, p => p.pos)}
        ${B('Tackles for loss', 'total', tfl, p => p.pos, 'Tackles for loss')}
        ${B('Sacks', 'total', sk, p => p.pos, 'Sacks')}
        ${B('Interceptions', 'total', it, p => p.pos)}
        ${B('Pass breakups', 'total', pbu, p => p.pos)}
      </div>
      <div class="section"><h3>Awards, watch lists & weekly honors <small>2026</small></h3>
        <div class="box"><ul class="list">${honored.map(p => p.honors.map(h => `<li data-player="${esc(p.name)}" class="click-li"><b class="namecol">${esc(p.name)}</b><span class="grow">${esc(h)}</span><span class="dim">${p.pos}</span></li>`).join('')).join('')}</ul></div></div>
      <div class="section"><h3>NFL draft outlook <small>2027 consensus big board, mock drafts and big seasons</small></h3>
        <div class="box"><ul class="list">${prospects.map(p => `<li data-player="${esc(p.name)}" class="click-li"><b class="namecol">${esc(p.name)}</b><span class="grow dim">${p.pos} · ${clsLabel(p)} · ${esc(p.draft.note)}</span><span class="chip risk-${p.draft.level}">${p.draft.level}</span></li>`).join('')}</ul></div>
        ${future.length ? `<p class="dim small" style="margin-top:10px">Future first-round buzz: ${future.map(p => `<b>${esc(p.name)}</b> (No. ${p.future.rank} on the ${p.future.year} consensus board)`).join(', ')}.</p>` : ''}</div>
      <div class="section"><h3>On3 Top 300 college players <small>Tennessee players ranked among the nation's best (updated Oct. 12; arrows show movement since Oct. 5)</small></h3>
        <div class="grid g3">${P.filter(p => p.rating && p.rating.src === 'on3').sort((a, b) => a.rating.rank - b.rating.rank).map(p => pcard(p)).join('')}</div></div>`;
  }

  /* program records + who's chasing them */
  function careerTotal(p, k, i) { return Object.values(p.career || {}).reduce((a, y) => a + (y[k] ? (y[k][i] || 0) : 0), 0); }
  function chasing() {
    const R = F.records; if (!R) return [];
    const played = F.schedule.filter(g => g.result).length, total = F.schedule.length;
    const pace = v => Math.round(v / Math.max(1, played) * total);
    const out = [];
    const check = (list, label, val, projected, p, unit) => {
      const rankNow = list.filter(x => x[1] > val).length + 1, rankProj = list.filter(x => x[1] > projected).length + 1;
      const rec = list[0];
      if (rankProj > list.length) return;
      out.push({ p, html: `<b>${esc(p.name)}</b>: ${val.toLocaleString()} ${unit} (${rankNow <= list.length ? ord(rankNow) + ' all-time' : 'outside the top ' + list.length}). On pace for <b>${projected.toLocaleString()}</b> by the end of the regular season, which would rank <b>${ord(rankProj)}</b>. The record: ${esc(rec[0])}, ${rec[1].toLocaleString()} (${esc(rec[2])})${projected >= rec[1] ? ' — <b>on pace to break it</b>' : `, ${(rec[1] - val).toLocaleString()} away`}.`, label });
    };
    F.players.forEach(p => {
      const s = p.stats;
      if (s.rush) { const c = careerTotal(p, 'rush', 1); check(R.top10.careerRush, 'Career rushing yards', c, c - s.rush[1] + pace(s.rush[1]), p, 'career rushing yards'); check(R.top10.seasonRush, 'Single-season rushing yards', s.rush[1], pace(s.rush[1]), p, 'rushing yards this season'); }
      if (s.pass) { const c = careerTotal(p, 'pass', 2); check(R.top10.careerPass, 'Career passing yards', c, c - s.pass[2] + pace(s.pass[2]), p, 'career passing yards'); check(R.top10.seasonPass, 'Single-season passing yards', s.pass[2], pace(s.pass[2]), p, 'passing yards this season'); }
      if (s.rec) { const c = careerTotal(p, 'rec', 1); check(R.top10.careerRec, 'Career receiving yards', c, c - s.rec[1] + pace(s.rec[1]), p, 'career receiving yards'); }
      if (s.def && s.def.sacks) { const c = careerTotal(p, 'def', 1); check(R.top10.careerSacks, 'Career sacks', c, c - s.def.sacks + pace(s.def.sacks), p, 'career sacks at Tennessee'); check(R.top10.seasonSacks, 'Single-season sacks', s.def.sacks, pace(s.def.sacks), p, 'sacks this season'); }
    });
    return out;
  }
  function recordsHtml() {
    const R = F.records; if (!R) return '';
    const ch = chasing();
    const tbl = (rows, title) => `<div><h4 class="subhead">${title}</h4><div class="tablewrap"><table class="mini"><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td><b>${esc(r[1])}</b><br><span class="dim small">${esc(r[3])}${r[4] ? ' · ' + esc(r[4]) : ''}</span></td><td class="n"><b>${Number(r[2]).toLocaleString()}</b></td></tr>`).join('')}</tbody></table></div></div>`;
    return `<div class="section"><h3>Tennessee records <small>${esc(R.asOf)}</small></h3>
      ${ch.length ? `<div class="box quick" style="margin-bottom:14px"><div class="eyebrow">Chasing history · current Vols climbing the record book</div><ul>${ch.map(c => `<li data-player="${esc(c.p.name)}" class="click-li"><span class="chip">${esc(c.label)}</span> ${c.html}</li>`).join('')}</ul></div>` : ''}
      <div class="seg" role="group" aria-label="Record type" style="margin-bottom:10px">${[['game', 'Single game'], ['season', 'Single season'], ['career', 'Career']].map(([k, l], i) => `<button data-rec="${k}" aria-pressed="${i === 2}">${l}</button>`).join('')}</div>
      ${['game', 'season', 'career'].map(k => `<div data-recp="${k}" ${k === 'career' ? '' : 'hidden'}><div class="grid g2">${tbl(R[k].slice(0, 6), 'Offense')}${tbl(R[k].slice(6), 'Defense & kicking')}</div></div>`).join('')}
      <p class="dim small">Source: ${R.source.map(s => `<a href="${s[2]}" target="_blank" rel="noopener">${esc(s[0])}</a> (${esc(s[1])})`).join(', ')}. "On pace" assumes the same per-game rate over the ${F.schedule.length}-game regular season.</p></div>`;
  }
  function openSeason(year) {
    const H = F.histAuto && F.histAuto.seasons && F.histAuto.seasons[year];
    const row = F.history.find(r => String(r.year) === String(year));
    const head = `<div><div class="eyebrow">Season ${year}${row ? ' · ' + esc(row.coach) : ''}</div><h3>${year} Tennessee: ${row ? esc(parseRec(row.overall).t ? row.overall : row.overall.replace(/-0$/, '')) : ''}</h3></div>`;
    if (String(year) === String(F.season)) { window.VI_ROUTER.go('football-schedule'); return; }
    if (!H) { showDialog(head, `<p>Game-by-game results load after the next data update (run <b>tools/update_data.bat</b>).</p><p><a href="https://www.sports-reference.com/cfb/schools/tennessee/${year}-schedule.html" target="_blank" rel="noopener">${year} schedule on Sports Reference</a></p>`); return; }
    const L = F.histAuto.leaders && F.histAuto.leaders[year];
    const lead = L ? `<div class="tiles" style="margin-bottom:12px">${[['pass_', 'Passing yds'], ['rush', 'Rushing yds'], ['rec', 'Receiving yds'], ['tkl', 'Tackles'], ['sacks', 'Sacks'], ['int_', 'INT']].filter(([k]) => L[k]).map(([k, l]) => `<div class="tile"><b style="font-size:22px">${n1(L[k][1])}</b><span>${l}</span><em>${esc(L[k][0])}</em></div>`).join('')}</div>` : '';
    showDialog(head, `${lead}<div class="tablewrap"><table class="mini"><thead><tr><th>Date</th><th>Opponent</th><th class="n">Result</th><th>Note</th></tr></thead>
      <tbody>${H.map(g => { const res = g[3] == null ? '—' : g[3] > g[4] ? `<span class="W">W</span> ${g[3]}–${g[4]}` : g[3] < g[4] ? `<span class="L">L</span> ${g[3]}–${g[4]}` : `T ${g[3]}–${g[4]}`; return `<tr><td class="num">${g[0] ? fmtDate(g[0], { month: 'short', day: 'numeric' }) : ''}</td><td><b>${g[2] === 'A' ? 'at ' : g[2] === 'N' ? 'vs. ' : ''}${esc(g[1])}</b>${g[5] ? ' <span class="chip">Conf</span>' : ''}</td><td class="n">${res}</td><td class="dim small">${esc(g[6] === 'Bowl' ? (g[5] ? 'SEC Championship Game' : 'Postseason') : (g[6] || ''))}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="dim small">Game results: <a href="https://collegefootballdata.com" target="_blank" rel="noopener">CollegeFootballData.com</a>.</p>`, true);
  }

  /* history */
  function parseRec(s) { const [w, l, t] = s.split('-').map(Number); return { w, l, t: t || 0, pct: (w + (t || 0) / 2) / (w + l + (t || 0)) }; }
  let histFilter = 'All';
  function history() {
    const h = F.history; const coaches = [...new Set(h.map(r => r.coach.split(',')[0]))];
    const full = h.filter(r => !r.inProgress);
    const tot = full.reduce((a, r) => { const x = parseRec(r.overall); a.w += x.w; a.l += x.l; a.t += x.t; return a; }, { w: 0, l: 0, t: 0 });
    const bowls = full.filter(r => r.bowl); const bw = bowls.filter(r => /\(W\)/.test(r.bowl)).length;
    const yrs = Object.keys(F.leaders).sort((a, b) => b - a);
    return `<div class="panel-head"><div><h2>History</h2><p>Program records (and the current Vols chasing them), season-by-season results from ${full[full.length - 1].year} to today, team leaders by year and the program's retired jerseys.</p></div></div>
      <div class="grid g4">
        <div class="box titlebox"><b>${F.titles.national.length}</b><div class="eyebrow">National titles claimed</div><p>${F.titles.national.join(', ')}</p></div>
        <div class="box titlebox"><b>${F.titles.sec.length}</b><div class="eyebrow">SEC championships</div><p>${F.titles.sec.join(', ')}</p></div>
        <div class="box titlebox"><b class="num">${tot.w}-${tot.l}-${tot.t}</b><div class="eyebrow">Record, ${full[full.length - 1].year}–${full[0].year}</div><p>Seasons in the table below</p></div>
        <div class="box titlebox"><b class="num">${bw}-${bowls.length - bw}</b><div class="eyebrow">Bowl & playoff record</div><p>${bowls.length} postseason games listed</p></div>
      </div>
      ${recordsHtml()}
      <div class="section"><h3>Win percentage by season <small>Orange = 10+ wins · line at .500</small></h3>
        <div class="box chart">${histChart(h)}</div></div>
      <div class="section"><h3>Retired jerseys <small>Numbers no Vol will wear again</small></h3>
        <div class="grid g4">${F.retired.map(r => `<div class="box retired"><span class="rnum">${r[0]}</span><div><b>${esc(r[1])}</b><div class="dim small">${r[2] ? r[2] + ' · ' : ''}${esc(r[3])}</div><p>${esc(r[4])}</p></div></div>`).join('')}</div></div>
      <div class="section"><h3>Season by season <small>Click a season for its schedule and results</small></h3>
        <div class="controls" style="margin-bottom:10px"><label for="coachSel" class="dim">Coach</label>
          <select id="coachSel"><option>All</option>${coaches.map(c => `<option ${histFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="tablewrap" style="max-height:560px"><table><thead><tr><th>Year</th><th>Overall</th><th>Conf.</th><th class="hide-sm">League</th><th>Coach</th><th>Bowl / Playoff</th></tr></thead><tbody id="histBody"></tbody></table></div></div>
      ${leadersByYear(yrs)}`;
  }
  function leadersByYear(yrs) {
    const AL = F.histAuto && F.histAuto.leaders;
    if (AL && Object.keys(AL).length) {
      const ys = Object.keys(AL).sort((a, b) => b - a); const cats = [['pass_', 'Passing yds'], ['rush', 'Rushing yds'], ['rec', 'Receiving yds'], ['tkl', 'Tackles'], ['sacks', 'Sacks'], ['int_', 'Interceptions']];
      return `<div class="section"><h3>Team leaders by season <small>${ys[ys.length - 1]}–${ys[0]} · click a year for that season</small></h3>
        <div class="tablewrap" style="max-height:560px"><table><thead><tr><th>Year</th>${cats.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead>
        <tbody>${ys.map(y => { const st = F.leaders[y]; const empty = cats.every(([k]) => !AL[y][k]);
          // years CFBD has no player stats for fall back to the ESPN leaders (no tackles column there)
          const cell = (k, i) => { if (AL[y][k]) return `<td>${esc(AL[y][k][0])} <b class="num">${n1(AL[y][k][1])}</b></td>`; if (empty && st) { const v = st[{ pass_: 0, rush: 1, rec: 2, sacks: 3, int_: 4 }[k]]; const m = v && v.match(/^(.*) ([\d,.]+)$/); if (m) return `<td>${esc(m[1])} <b class="num">${m[2]}</b></td>`; } return '<td>—</td>'; };
          return `<tr class="click" data-season="${y}"><td class="num"><b>${y}</b></td>${cats.map(([k], i) => cell(k, i)).join('')}</tr>`; }).join('')}</tbody></table></div>
        <p class="dim small">Leaders: <a href="https://collegefootballdata.com" target="_blank" rel="noopener">CollegeFootballData.com</a>.</p></div>`;
    }
    return `<div class="section"><h3>Team leaders by season <small>${yrs[yrs.length - 1]}–${yrs[0]}, from ESPN · click a year for that season</small></h3>
        <div class="tablewrap" style="max-height:560px"><table><thead><tr><th>Year</th>${F.leaderCats.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${yrs.map(y => `<tr class="click" data-season="${y}"><td class="num"><b>${y}</b></td>${F.leaders[y].map(v => { const m = v.match(/^(.*) ([\d,.]+)$/); return m ? `<td>${esc(m[1])} <b class="num">${m[2]}</b></td>` : `<td>${esc(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }
  function histChart(h) {
    const rows = h.slice().reverse(); const W = 1100, H = 190, pad = { l: 34, r: 8, t: 10, b: 26 };
    const bw = (W - pad.l - pad.r) / rows.length; const y = v => pad.t + (1 - v) * (H - pad.t - pad.b);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Win percentage by season, ${rows[0].year} to ${rows[rows.length - 1].year}">`;
    [0, .5, 1].forEach(v => { s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${v === .5 ? 'stroke-dasharray="4 3"' : ''}/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${v === 1 ? '1.000' : v === .5 ? '.500' : '0'}</text>`; });
    rows.forEach((r, i) => {
      const x = parseRec(r.overall); const top = y(x.pct); const hgt = y(0) - top;
      const fill = x.w >= 10 ? 'var(--orange)' : 'var(--smokey)';
      s += `<rect x="${pad.l + i * bw + bw * .15}" y="${top}" width="${bw * .7}" height="${Math.max(1, hgt)}" fill="${fill}" opacity="${x.w >= 10 ? 1 : .55}"><title>${r.year}: ${r.overall}${r.bowl ? ' · ' + r.bowl : ''}</title></rect>`;
      if (r.year % 10 === 0) s += `<text x="${pad.l + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${r.year}</text>`;
    });
    return s + '</svg>';
  }
  function wireHistory() {
    const draw = () => {
      $('#histBody').innerHTML = F.history.filter(r => histFilter === 'All' || r.coach.includes(histFilter)).map(r => {
        const x = parseRec(r.overall); const champ = F.titles.national.includes(String(r.year)) ? ' <span class="chip honor">National champs</span>' : F.titles.sec.includes(String(r.year)) ? ' <span class="chip">SEC champs</span>' : '';
        return `<tr class="click" data-season="${r.year}" tabindex="0"><td class="num"><b>${r.year}</b>${r.inProgress ? ' <span class="chip new">In progress</span>' : ''}</td><td class="num">${x.t ? r.overall : x.w + '-' + x.l}${champ}</td><td class="num">${r.confRec ? r.confRec.replace(/-0$/, '') : '—'}</td><td class="hide-sm">${r.conf}</td><td>${esc(r.coach)}</td>
        <td>${r.bowl ? r.bowl.replace('(W)', '<span class="W">W</span>').replace('(L)', '<span class="L">L</span>') : '—'}</td></tr>`;
      }).join('');
    };
    app.querySelectorAll('.section tr[data-season]').forEach(tr => tr.addEventListener('click', () => openSeason(tr.dataset.season)));
    $('#histBody').addEventListener('click', e => { const tr = e.target.closest('[data-season]'); if (tr) openSeason(tr.dataset.season); });
    $('#histBody').addEventListener('keydown', e => { const tr = e.target.closest('[data-season]'); if (tr && e.key === 'Enter') openSeason(tr.dataset.season); });
    app.querySelectorAll('[data-rec]').forEach(b => b.addEventListener('click', () => { app.querySelectorAll('[data-rec]').forEach(x => x.setAttribute('aria-pressed', x === b)); app.querySelectorAll('[data-recp]').forEach(x => { x.hidden = x.dataset.recp !== b.dataset.rec; }); }));
    $('#coachSel').addEventListener('change', e => { histFilter = e.target.value; draw(); });
    draw();
  }

  /* player dialog */
  const dlg = document.getElementById('playerDlg');
  function careerTable(p) {
    const yrs = Object.keys(p.career || {}).sort();
    if (!yrs.length) return '';
    const f = (s, k) => {
      if (!s[k]) return '—'; const v = s[k];
      if (k === 'pass') return `${v[0]}/${v[1]}, ${v[2]} yds, ${v[3] || 0} TD, ${v[4] || 0} INT`;
      if (k === 'rush') return `${v[0]}-${v[1]}, ${v[2] || 0} TD`;
      if (k === 'rec') return `${v[0]}-${v[1]}, ${v[2] || 0} TD`;
      if (k === 'def') return `${v[0]} tkl` + (v[1] ? `, ${v[1]} sk` : '') + (v[2] ? `, ${v[2]} INT` : '') + (v[3] ? `, ${v[3]} PD` : '') + (v[4] ? `, ${v[4]} FF` : '');
      if (k === 'kick') return `FG ${v[0]}/${v[1]}, XP ${v[2]}/${v[3]}`;
    };
    const keys = ['pass', 'rush', 'rec', 'def', 'kick'].filter(k => yrs.some(y => p.career[y][k]));
    const label = { pass: 'Passing', rush: 'Rushing', rec: 'Receiving', def: 'Defense', kick: 'Kicking' };
    return `<div><h4>Stats at Tennessee by year</h4><div class="tablewrap"><table class="mini"><thead><tr><th>Year</th>${keys.map(k => `<th>${label[k]}</th>`).join('')}</tr></thead>
      <tbody>${yrs.map(y => `<tr><td class="num"><b>${y}</b></td>${keys.map(k => `<td class="num">${f(p.career[y], k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }
  function openPlayer(name) {
    const p = byName.get(name); const r = recByName.get(name);
    if (!p && !r) return;
    let head, body;
    if (p) {
      const depthSpots = []; Object.values(depthState.current.chart).forEach(rows => rows.forEach(([pos, ns]) => { const i = ns.indexOf(name); if (i >= 0) depthSpots.push(`${pos} (${ord(i + 1)})`); }));
      head = `<span class="jersey">${p.num}</span><div><h3>${esc(p.name)}${p.nick ? ` <span class="nick">"${esc(p.nick)}"</span>` : ''}</h3><p>${p.pos} · ${clsLabel(p)} · ${p.ht}, ${p.wt} lb</p></div>`;
      const rl = p.rating ? (p.rating.src === 'on3' ? 'On3 college grade (Top 300)' : p.rating.src === '247t' ? '247Sports transfer rating' : p.rating.label) : 'No rating listed';
      body = `<div class="tagrow">${rateBadge(p.rating)} <span class="dim small">${esc(rl)}</span>${(p.natRanks || []).map(x => `<span class="chip nat">No. ${x.rank} nat'l · ${esc(x.stat)}</span>`).join('')}</div>
        <dl class="kv"><dt>Hometown</dt><dd>${esc(p.home)}</dd><dt>High school</dt><dd>${esc(p.hs || '—')}</dd>${p.prev ? `<dt>Previous schools</dt><dd>${esc(p.prev.replace(/\//g, ', '))}</dd>` : ''}
        ${p.r247 && p.r247.hs ? `<dt>247 HS composite</dt><dd>${p.r247.hs.grade.toFixed(2)} · ${p.r247.hs.stars || '?'}-star · class of ${p.r247.hs.cls}${p.r247.hs.nat ? ' · No. ' + p.r247.hs.nat + ' nationally' : ''}</dd>` : ''}
        ${p.r247 && p.r247.transfer && p.r247.transfer.grade ? `<dt>247 transfer rating</dt><dd>${p.r247.transfer.grade.toFixed(2)} · ${p.r247.transfer.stars || '?'}-star · ${p.r247.transfer.season} portal from ${esc(p.r247.transfer.origin)}</dd>` : ''}
        <dt>Depth chart</dt><dd>${depthSpots.join(', ') || 'Not on the depth chart'}</dd>
        <dt>2027</dt><dd>${p.confirmed27 ? esc(p.confirmed27) : p.leaving ? 'Out of eligibility (5th-year player)' : p.draft ? `Draft risk (${p.draft.level}): ${esc(p.draft.note)}` : p.cls === 'Sr.' ? 'Eligible to return for a 5th year' : 'Expected to return as a ' + NEXT_CLASS[p.cls]}</dd>
        ${p.future ? `<dt>Draft buzz</dt><dd>No. ${p.future.rank} on the ${p.future.year} consensus big board</dd>` : ''}</dl>
        ${careerTable(p)}
        ${p.honors.length ? `<div><h4>Honors & watch lists</h4><ul>${p.honors.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}`;
    } else {
      const yr = F.recruits.includes(r) ? 2027 : 2028;
      head = `<span class="jersey">'${String(yr).slice(2)}</span><div><h3>${esc(r.name)}</h3><p>${r.pos} · ${yr} commit · ${r.ht}, ${r.wt} lb</p></div>`;
      body = `<div>${rateBadge({ src: '247', grade: r.grade, stars: r.stars })} <span class="dim small">247Sports composite</span></div>
        <dl class="kv"><dt>School</dt><dd>${esc(r.hs)}</dd><dt>Hometown</dt><dd>${esc(r.home)}</dd><dt>National rank</dt><dd>${r.nat || '—'}</dd><dt>Position rank</dt><dd>${r.posRank || '—'}</dd><dt>State rank</dt><dd>${r.stateRank || '—'}</dd><dt>Committed</dt><dd>${fmtDate(r.committed, { month: 'long', day: 'numeric', year: 'numeric' })}</dd></dl>`;
    }
    showDialog(head, body, false);
  }
  /* ---------- game dialogs: box scores (finished) and matchup previews (upcoming) ---------- */
  function showDialog(head, body, wide) {
    dlg.classList.toggle('wide', !!wide);
    dlg.innerHTML = `<div class="dlg-h">${head}<button class="dlg-x" aria-label="Close">✕</button></div><div class="dlg-b">${body}</div>`;
    $('.dlg-x', dlg).addEventListener('click', () => dlg.close());
    if (!dlg.open) dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
    dlg.scrollTop = 0;
  }
  window.fbOpenPlayer = name => { initFootball(); openPlayer(name); };
  window.fbOpenGame = opp => { initFootball(); openGame(opp); };
  window.fbData = () => { initFootball(); return F; };
  function openGame(opp) {
    const g = F.schedule.find(x => x.opp === opp); if (!g) return;
    if (g.result) openBox(g); else openPreview(g);
  }
  const BOX_CATS = [['passing', 'Passing'], ['rushing', 'Rushing'], ['receiving', 'Receiving'], ['defensive', 'Defense'], ['interceptions', 'Interceptions'],
    ['kicking', 'Kicking'], ['punting', 'Punting'], ['kickReturns', 'Kick returns'], ['puntReturns', 'Punt returns'], ['fumbles', 'Fumbles']];
  function openBox(g) {
    const B = F.box && F.box[g.opp];
    const head = `<div><div class="eyebrow">Final · ${fmtDate(g.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div><h3>Tennessee ${g.us}, ${esc(g.opp)} ${g.them}</h3></div>`;
    if (!B) {
      showDialog(head, `<p>Full box score loads after the next data update (run <b>tools/update_data.bat</b>).</p><p><a href="https://www.espn.com/college-football/team/schedule/_/id/2633" target="_blank" rel="noopener">See the game on ESPN</a></p>`);
      return;
    }
    const T = B.teams.slice().sort((a, b) => (a.home ? 1 : 0) - (b.home ? 1 : 0)); // away first
    const nQ = Math.max(...T.map(t => t.lines.length));
    const qh = Array.from({ length: nQ }, (_, i) => i < 4 ? `Q${i + 1}` : nQ === 5 ? 'OT' : `OT${i - 3}`);
    const line = `<div class="tablewrap"><table class="mini box-line"><thead><tr><th>Team</th>${qh.map(q => `<th class="n">${q}</th>`).join('')}<th class="n">T</th></tr></thead>
      <tbody>${T.map(t => `<tr class="${t.abbr === 'TENN' ? 'me' : ''}"><td><b>${esc(t.name)}</b></td>${qh.map((_, i) => `<td class="n">${esc(t.lines[i] ?? '')}</td>`).join('')}<td class="n"><b>${esc(t.score)}</b></td></tr>`).join('')}</tbody></table></div>`;
    const [a, h] = T; const sa = B.stats[a.abbr] || [], sh = B.stats[h.abbr] || [];
    const teamStats = `<div class="tablewrap"><table class="mini"><thead><tr><th>Team stats</th><th class="n">${esc(a.abbr)}</th><th class="n">${esc(h.abbr)}</th></tr></thead>
      <tbody>${sa.map((r, i) => `<tr><td>${esc(r[0])}</td><td class="n">${esc(r[1])}</td><td class="n">${esc((sh[i] || [])[1] ?? '')}</td></tr>`).join('')}</tbody></table></div>`;
    const players = t => { const P = B.players[t.abbr] || {}; return BOX_CATS.filter(([k]) => P[k]).map(([k, l]) => `<h5 class="subhead">${l}</h5><div class="tablewrap"><table class="mini"><thead><tr><th>${esc(t.abbr)}</th>${P[k].labels.map(x => `<th class="n">${esc(x)}</th>`).join('')}</tr></thead>
      <tbody>${P[k].rows.map(r => `<tr><td>${byName.has(r[0]) && t.abbr === 'TENN' ? `<a href="#" data-player="${esc(r[0])}">${esc(r[0])}</a>` : esc(r[0])}</td>${r.slice(1).map(v => `<td class="n">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join(''); };
    const scoring = B.scoring.length ? `<ol class="list scoring">${B.scoring.map(p => `<li><span class="chip">Q${p[0]} ${esc(p[1])}</span> <b>${esc(p[2])}</b> <span class="grow">${esc(p[3])}</span> <span class="num dim">${p[4]}–${p[5]}</span></li>`).join('')}</ol>` : '';
    showDialog(head, `<p class="dim small">${esc(B.venue || g.loc || '')}${B.attendance ? ' · Attendance ' + Number(B.attendance).toLocaleString() : ''}</p>
      ${line}
      <div class="seg" role="group" aria-label="Box score section" style="margin:14px 0 10px">${[['team', 'Team stats'], ['ut', 'Tennessee players'], ['opp', esc(g.opp) + ' players'], ['scoring', 'Scoring']].map(([k, l], i) => `<button data-bx="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
      <div data-bxp="team">${teamStats}</div>
      <div data-bxp="ut" hidden>${players(T.find(t => t.abbr === 'TENN') || h)}</div>
      <div data-bxp="opp" hidden>${players(T.find(t => t.abbr !== 'TENN') || a)}</div>
      <div data-bxp="scoring" hidden>${scoring || '<p class="dim">No scoring summary available.</p>'}</div>
      <p class="dim small">Box score: <a href="https://www.espn.com/college-football/game/_/gameId/${esc(B.id)}" target="_blank" rel="noopener">ESPN game page</a>.</p>`, true);
    wireDialogTabs('bx'); wirePlayers(dlg);
  }
  window.showDialog = (h, b, w) => showDialog(h, b, w);
  window.wireDialogTabs = k => wireDialogTabs(k);
  function wireDialogTabs(key) {
    dlg.querySelectorAll(`[data-${key}]`).forEach(b => b.addEventListener('click', () => {
      dlg.querySelectorAll(`[data-${key}]`).forEach(x => x.setAttribute('aria-pressed', x === b));
      dlg.querySelectorAll(`[data-${key}p]`).forEach(p => { p.hidden = p.dataset[key + 'p'] !== b.dataset[key]; });
    }));
  }
  const CMP = [['ppg', 'Points per game', 0], ['oppg', 'Points allowed', 1], ['ypg', 'Yards per game', 0], ['oypg', 'Yards allowed', 1],
    ['rushYpg', 'Rushing yards', 0], ['oRushYpg', 'Rush yards allowed', 1], ['passYpg', 'Passing yards', 0], ['oPassYpg', 'Pass yards allowed', 1],
    ['ypp', 'Yards per play', 0], ['oypp', 'Yards per play allowed', 1], ['thirdPct', '3rd down %', 0], ['othirdPct', 'Opp. 3rd down %', 1],
    ['sacks', 'Sacks', 0], ['sacksAllowed', 'Sacks allowed', 1], ['takeaways', 'Takeaways', 0], ['toLost', 'Turnovers lost', 1], ['toMargin', 'Turnover margin', 0], ['penYpg', 'Penalty yards per game', 1]];
  function apRank(team) { const r = (F.team.apTop25 || []).find(x => x[1] === team); return r ? r[0] : null; }
  function previewText(g, P, E) {
    const opp = g.opp, rk = apRank(opp);
    const bits = [];
    bits.push(`${rk ? 'No. ' + rk + ' ' : ''}${esc(opp)}${P && P.record ? ` (${P.record}${P.confRecord ? ', ' + P.confRecord + ' SEC' : ''})` : ''} ${g.site === 'H' ? 'comes to Neyland Stadium' : g.site === 'A' ? 'hosts Tennessee' : 'meets Tennessee'} on ${fmtDate(g.date, { weekday: 'long', month: 'long', day: 'numeric' })}.`);
    if (E.win != null) bits.push(`ESPN's FPI gives the Vols a ${Math.round(E.win)}% chance to win${E.line ? `, and the line is ${esc(E.line)}` : ''}.`);
    if (P && P.series) { const s = P.series; const lead = s.w > s.l ? 'leads' : s.w < s.l ? 'trails' : 'is even in'; const last = s.last && s.last[s.last.length - 1]; bits.push(`Tennessee ${lead} the all-time series ${s.w}-${s.l}${s.t ? '-' + s.t : ''}${last ? `; ${last[1] === 'Tennessee' ? 'the Vols won' : esc(last[1]) + ' won'} the last meeting in ${last[0]}` : ''}.`); }
    if (P && P.compare) {
      const c = P.compare;
      bits.push(`Matchup to watch: Tennessee runs for ${c.rushYpg[0]} yards a game, and ${esc(opp)} allows ${c.oRushYpg[1]} on the ground. Through the air, the Vols throw for ${c.passYpg[0]} while ${esc(opp)} gives up ${c.oPassYpg[1]}.`);
      bits.push(c.ppg[1] > c.oppg[0] ? `${esc(opp)} scores ${c.ppg[1]} points a game, more than the ${c.oppg[0]} Tennessee's defense allows, so something has to give.` : `Tennessee's defense allows ${c.oppg[0]} points a game; ${esc(opp)} averages ${c.ppg[1]}.`);
    }
    if (P && P.impact && P.impact[0]) bits.push(`${esc(opp)}'s top playmaker: ${esc(P.impact[0].name)} (${esc(P.impact[0].line)}).`);
    return bits.join(' ');
  }
  function openPreview(g) {
    const P = (F.previews || {})[g.opp]; const E = g.espn || {}; const w = howToWatch(E.tv);
    const head = `<div><div class="eyebrow">Matchup preview · ${fmtDate(g.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${esc(kick(g))}</div><h3>${g.site === 'A' ? 'Tennessee at ' + esc(g.opp) : esc(g.opp) + ' at Tennessee'}</h3></div>`;
    const pear = (F.advanced.pear.games || []).find(x => x[0].replace(/^(at|vs\.?) /, '') === g.opp || x[0].includes(g.opp));
    const watch = `<div class="tiles" style="margin-bottom:14px">
      <div class="tile"><b style="font-size:22px">${w ? esc(w.net) : 'TBA'}</b><span>TV · ${esc(kick(g))}</span><em>${w ? esc(w.stream) : 'Network announced 6–12 days out'}</em></div>
      <div class="tile"><b style="font-size:22px">${E.line ? esc(E.line) : '—'}</b><span>Line${E.ou ? ' · O/U ' + E.ou : ''}</span><em>${E.book ? esc(E.book) + ' via ESPN' : 'Not posted yet'}</em></div>
      <div class="tile"><b style="font-size:22px">${E.win != null ? E.win.toFixed(1) + '%' : '—'}</b><span>UT win chance (${tip('FPI')})</span><em>${esc(g.loc || '')}</em></div></div>`;
    const imp = (list, who) => list && list.length ? `<ul class="list">${list.map(x => `<li${who === 'ut' && byName.has(x.name) ? ` data-player="${esc(x.name)}" class="click-li"` : ''}><b class="namecol">${esc(x.name)}</b><span class="dim">${esc(x.pos || '')}</span><span class="grow">${esc(x.line)}</span></li>`).join('')}</ul>` : '<p class="dim small">Available after the next data update.</p>';
    const series = P && P.series ? `<div class="box" style="padding:14px"><div class="lb"><h4>Series history <span>since ${P.series.first || '—'}</span></h4></div>
        <p style="margin:6px 0 10px"><b class="num" style="font-size:26px">${P.series.w}-${P.series.l}${P.series.t ? '-' + P.series.t : ''}</b> <span class="dim">Tennessee's all-time record vs. ${esc(g.opp)}</span></p>
        <ul class="list">${P.series.last.slice().reverse().map(x => `<li><b class="num">${x[0]}</b><span class="grow">${esc(x[4])} ${x[5]}, ${esc(x[2])} ${x[3]}</span><span class="${x[1] === 'Tennessee' ? 'W' : 'L'}">${x[1] === 'Tennessee' ? 'W' : 'L'}</span></li>`).join('')}</ul></div>` : '';
    const cmp = P && P.compare ? `<div class="tablewrap"><table class="mini cmp"><thead><tr><th>Per game unless noted</th><th class="n">Tennessee</th><th class="n">${esc(g.opp)}</th></tr></thead>
      <tbody>${CMP.filter(([k]) => P.compare[k]).map(([k, l, low]) => { const [u, o] = P.compare[k]; const ub = low ? u < o : u > o; const ob = low ? o < u : o > u; return `<tr><td>${l}</td><td class="n ${ub ? 'better' : ''}">${n1(u)}</td><td class="n ${ob ? 'better' : ''}">${n1(o)}</td></tr>`; }).join('')}</tbody></table></div><p class="dim small">Highlighted = the better number. Computed from CollegeFootballData.com season stats (FBS games).</p>` : '<p class="dim small">Team comparison loads after the next data update.</p>';
    const adv = `<div class="tablewrap"><table class="mini"><thead><tr><th>Rating</th><th class="n">Tennessee</th><th class="n">${esc(g.opp)}</th></tr></thead><tbody>
      ${P && P.sp ? `<tr><td>${tip('SP+')} rating (nat'l rank)</td><td class="n">${n1(P.sp.ut[0])} (${P.sp.ut[1] || '—'})</td><td class="n">${n1(P.sp.opp[0])} (${P.sp.opp[1] || '—'})</td></tr>
        <tr><td>SP+ offense rank</td><td class="n">${P.sp.ut[2] || '—'}</td><td class="n">${P.sp.opp[2] || '—'}</td></tr><tr><td>SP+ defense rank</td><td class="n">${P.sp.ut[3] || '—'}</td><td class="n">${P.sp.opp[3] || '—'}</td></tr>` : ''}
      ${P && P.fpi ? `<tr><td>${tip('FPI')} (nat'l rank)</td><td class="n">${n1(P.fpi.ut[0])} (${P.fpi.ut[1] || '—'})</td><td class="n">${n1(P.fpi.opp[0])} (${P.fpi.opp[1] || '—'})</td></tr>` : ''}
      ${apRank(g.opp) || F.team.ap ? `<tr><td>AP poll</td><td class="n">${F.team.ap}</td><td class="n">${apRank(g.opp) || 'NR'}</td></tr>` : ''}
      </tbody></table></div>
      ${pear ? `<p class="small" style="margin-top:10px"><b>${tip('PEAR')} projection:</b> ${esc(pear[2])}, projected score ${esc(pear[3])} (UT–${esc(g.opp)}), Tennessee win chance ${pear[4]}%.</p>` : ''}`;
    showDialog(head, `${watch}
      <div class="seg" role="group" aria-label="Preview section" style="margin-bottom:12px">${[['pre', 'Preview'], ['imp', 'Impact players'], ['cmp', 'Team numbers'], ['adv', 'Advanced'], ['ser', 'Series']].map(([k, l], i) => `<button data-pv="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
      <div data-pvp="pre"><p class="lede">${previewText(g, P, E)}</p></div>
      <div data-pvp="imp" hidden><div class="grid g2"><div><h5 class="subhead">${esc(g.opp)}</h5>${imp(P && P.impact)}</div><div><h5 class="subhead">Tennessee</h5>${imp(P && P.utImpact, 'ut')}</div></div></div>
      <div data-pvp="cmp" hidden>${cmp}</div>
      <div data-pvp="adv" hidden>${adv}</div>
      <div data-pvp="ser" hidden>${series || '<p class="dim small">Series history loads after the next data update.</p>'}</div>
      <p class="dim small" style="margin-top:12px">Sources: <a href="https://collegefootballdata.com" target="_blank" rel="noopener">CollegeFootballData.com</a> (stats, SP+, FPI, series), <a href="https://www.espn.com/college-football/team/schedule/_/id/2633" target="_blank" rel="noopener">ESPN</a> (TV, line, win chance), <a href="https://pearatings.com/cfb/fbs/team-profile?team=Tennessee&season=2026" target="_blank" rel="noopener">PEAR Ratings</a>.</p>`, true);
    wireDialogTabs('pv'); wirePlayers(dlg);
  }

  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  route();
})();
