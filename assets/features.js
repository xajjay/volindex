/* The Vol Index — site features around the stats pages:
     · page titles for every address (and the share card text updated on each route)
     · home page: "Play today" band (daily games, streak, countdown) and "On this day in Vols history"
     · /me: your games profile (streaks, results, transfer code to move progress, optional sign-in)
     · /players and /players/<sport>/<name>: player pages built from the games data (data/players.js, loaded on demand)
     · /compare: any two players side by side
     · game day: the live game card shows the latest plays from ESPN, refreshed with the score
     · VI_TRACK(name): counts a game event in GoatCounter (skipped on the owner's devices, see assets/track.js) */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const etDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const href = k => (window.VI_ROUTER ? window.VI_ROUTER.href(k) : '#' + k);
  const slugify = n => String(n).toLowerCase().replace(/[’'.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  window.VI_SLUG = slugify;
  const SPORT_NAME = { football: 'Football', volleyball: 'Volleyball', soccer: 'Soccer', mbb: "Men's Basketball", wbb: "Women's Basketball", baseball: 'Baseball', softball: 'Softball' };
  const SPORT_ORDER = ['football', 'mbb', 'wbb', 'baseball', 'softball', 'volleyball', 'soccer'];
  const GAMES = { football: ['run', 'guesser', 'grid', 'career', 'rankings', 'duel', 'trivia'] };
  ['mbb', 'wbb', 'baseball', 'softball'].forEach(k => { GAMES[k] = ['run', 'guesser', 'rankings', 'duel', 'trivia']; });
  ['volleyball', 'soccer'].forEach(k => { GAMES[k] = ['guesser', 'rankings', 'duel', 'trivia']; });
  const GAME_NAME = { run: '16-0', guesser: 'Vol Guesser', grid: 'Power T Grid', career: 'VFL Career', rankings: 'Rocky Top Rankings', duel: 'Higher or Lower', trivia: 'Vol Trivia' };
  const GAME_ICON = { run: '🏈', guesser: '🔎', grid: '🟧', career: '🏟️', rankings: '📊', duel: '↕️', trivia: '❓' };
  const RUN_NAME = { football: '16-0', mbb: '40-0', wbb: '40-0', baseball: '69-0', softball: '69-0' }, RUN_ICON = { football: '🏈', mbb: '🏀', wbb: '🏀', baseball: '⚾', softball: '🥎' };
  const gName = (sp, g) => g === 'run' ? RUN_NAME[sp] : sp === 'wbb' ? GAME_NAME[g].replace(/^Vol /, 'Lady Vol ') : GAME_NAME[g];
  const gIcon = (sp, g) => g === 'run' ? RUN_ICON[sp] : GAME_ICON[g];

  /* ---------- analytics events (GoatCounter; nothing is sent from the owner's opted-out browsers or local previews) ---------- */
  const sent = {};
  window.VI_TRACK = function (name, once) {
    if (once && sent[name]) return; sent[name] = 1;
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'event/' + name, title: name, event: true }); } catch (e) {}
  };

  /* ---------- page titles ---------- */
  const TAB_NAME = { overview: '', schedule: 'Schedule & Standings', roster: 'Roster', depth: 'Depth Chart', next: '2027 Preview', stats: 'Stats', advanced: 'Advanced Stats',
    recruits: 'Recruiting', recruiting: 'Recruiting', leaders: 'Leaders & Honors', history: 'History', media: 'Social & Media', lineup: 'Lineup', review: 'Season Review', moves: 'Roster Moves' };
  const titleCase = s => s.split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
  window.VI_SET_TITLE = function (key) {
    const [a, b, c] = key.split('-'), S = ' · The Vol Index';
    let t = 'The Vol Index · Tennessee athletics, all in one place';
    if (SPORT_NAME[a]) t = `Tennessee ${SPORT_NAME[a]}${TAB_NAME[b] ? ' ' + TAB_NAME[b] : ''}${S}`;
    else if (a === 'games') t = !b ? 'Vol Games' + S : !c ? `${SPORT_NAME[b] || 'Football'} games${S}` : `${(GAME_NAME[c] && gName(SPORT_NAME[b] ? b : 'football', c)) || 'Vol Games'} · ${SPORT_NAME[b] || 'Football'}${S}`;
    else if (a === 'players') t = !b ? 'Tennessee players' + S : key.split('-').length > 2 ? `${titleCase(key.split('-').slice(2).join('-'))} · Tennessee ${SPORT_NAME[b] || ''}${S}` : `Tennessee ${SPORT_NAME[b] || ''} players${S}`;
    else if (a === 'compare') t = 'Compare Vols' + S;
    else if (a === 'me') t = 'Your Vol games' + S;
    else if (a === 'sources') t = 'Sources & credits' + S;
    else if (a === 'about') t = 'About' + S;
    document.title = t;
  };

  /* ---------- games progress (read from the games' own saved results in this browser) ---------- */
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const jget = k => { try { return JSON.parse(LS.get('vi-games-' + k)); } catch (e) { return null; } };
  const dkey = (sport, g, date) => (sport === 'football' ? '' : sport + '-') + g + '-daily-' + date;
  const doneOn = (sport, g, date) => { const v = jget(dkey(sport, g, date)); return !!(v && (v.final || (v.state && v.state.done))); };
  const dayShift = (date, n) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  function anyOn(date) { return SPORT_ORDER.some(s => GAMES[s].some(g => doneOn(s, g, date))); }
  function streak(test) {
    let d = etDate(), n = 0;
    if (!test(d)) d = dayShift(d, -1);           // today not played yet: the streak runs through yesterday
    while (test(d) && n < 2000) { n++; d = dayShift(d, -1); }
    return n;
  }
  window.VI_PROGRESS = { streak: () => streak(anyOn), doneOn };

  /* ---------- home: Play today ---------- */
  function untilMidnight() {
    const now = new Date(), et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const left = (24 * 3600) - (et.getHours() * 3600 + et.getMinutes() * 60 + et.getSeconds());
    const h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  // undefeated-run games, one per sport (names come from the real season length; see assets/games-run-sports.js)
  const RUNS = [['football', '16-0', '🏈', 'Football'], ['mbb', '40-0', '🏀', "Men's hoops"], ['wbb', '40-0', '🏀', "Women's hoops"], ['baseball', '69-0', '⚾', 'Baseball'], ['softball', '69-0', '🥎', 'Softball']];
  window.homeBottom = function () {
    const today = etDate(), st = streak(anyOn);
    const fb = GAMES.football.filter(g => g !== 'run'), done = GAMES.football.filter(g => doneOn('football', g, today)).length;
    return `<section class="wrap pbwrap" aria-label="Today's Vol games"><div class="playband">
      <div class="pb-head"><div><div class="eyebrow">Vol Games · new at midnight Eastern</div><h2>Play today</h2>
        <p>Same puzzles for everyone, every day${st ? ` · <b class="pb-streak">🔥 ${st}-day streak</b>` : ''} · next set in <b id="pbClock">${untilMidnight()}</b></p></div>
        <a class="btn" href="${href('me')}">My games &amp; streaks</a></div>
      <div class="pb-runs">${RUNS.map(([sp, name, icon, label]) => `<a class="pb-run ${doneOn(sp, 'run', today) ? 'done' : ''}" href="${href('games-' + sp + '-run')}"><span class="pb-ic" aria-hidden="true">${icon}</span><span><b>${name}</b><small>${label}${sp === 'football' ? '' : ' · Beta'}</small></span>${doneOn(sp, 'run', today) ? '<i>✓</i>' : ''}</a>`).join('')}</div>
      <div class="pb-label">Football dailies <span class="dim">${done}/${GAMES.football.length} done</span></div>
      <div class="pb-games">${fb.map(g => `<a class="pb-game ${doneOn('football', g, today) ? 'done' : ''}" href="${href('games-football-' + g)}"><span aria-hidden="true">${GAME_ICON[g]}</span><b>${esc(GAME_NAME[g])}</b>${doneOn('football', g, today) ? '<i>✓</i>' : ''}</a>`).join('')}</div>
      <div class="pb-foot"><a href="${href('games')}">Every sport's games ›</a> · <a href="${href('players')}">Player pages ›</a> · <a href="${href('compare')}">Compare Vols ›</a></div>
    </div></section>`;
  };
  let clockTimer = null;
  window.wireHome = function (app) {
    clearInterval(clockTimer);
    const el = app.querySelector('#pbClock'); if (el) clockTimer = setInterval(() => { if (!el.isConnected) return clearInterval(clockTimer); el.textContent = untilMidnight(); }, 1000);
  };

  /* ---------- lazy data ---------- */
  function load(src, ready, cb) {
    if (ready()) return cb();
    let s = document.querySelector(`script[data-f="${src}"]`);
    if (!s) { s = document.createElement('script'); s.src = src; s.dataset.f = src; document.head.appendChild(s); }
    s.addEventListener('load', cb, { once: true });
  }
  const loading = (app, t) => { app.innerHTML = `<div class="wrap hub-hero"><div class="eyebrow">${esc(t)}</div><h1>Loading…</h1></div>`; };
  let PL = null, BYKEY = {};
  function initPlayers() {
    if (PL) return PL; PL = window.VI_PLAYERS.players;
    PL.forEach(p => { BYKEY[p.sp + '/' + p.slug] = p; const hoops = p.sp === 'mbb' || p.sp === 'wbb', last = p.yrs && p.yrs.length ? p.yrs[p.yrs.length - 1] + (hoops ? 1 : 0) : 0;
      p.span = p.yrs && p.yrs.length ? (p.yrs[0] + (last !== p.yrs[0] ? '-' + String(last).slice(2) : '')) : ''; });
    return PL;
  }
  const withPlayers = (app, label, fn) => window.VI_PLAYERS ? (initPlayers(), fn()) : (loading(app, label), load('data/players.js', () => !!window.VI_PLAYERS, () => { initPlayers(); fn(); }));

  /* ---------- player pages ---------- */
  const HON = { AAu: 'Unanimous All-American', AAc: 'Consensus All-American', AA1: 'First-team All-American', AA2: 'All-America 2nd/3rd team', AAH: 'All-America honorable mention', SEC: 'First-team All-SEC', SEC2: 'Second-team All-SEC', POY: 'SEC Player of the Year', PPOY: 'SEC Pitcher of the Year', OPOY: 'SEC Offensive Player of the Year', DPOY: 'SEC Defensive Player of the Year', H2: 'Heisman runner-up', H5: 'Heisman top 5', H8: 'Heisman top 10' };
  const honText = h => h.startsWith('W:') ? h.slice(2) + (/Award|Trophy|Year/.test(h) ? '' : ' Award') + (/Year$/.test(h) ? '' : ' winner') : h.startsWith('F:') ? h.slice(2) + (/Award|Trophy/.test(h) ? '' : ' Award') + ' finalist' : (HON[h] || h);
  const COLS = {
    football: [['pos', 'Pos'], ['cmp', 'Cmp'], ['att', 'Att'], ['yds', 'Pass yds'], ['td', 'Pass TD'], ['int', 'INT thrown'], ['car', 'Car'], ['ryds', 'Rush yds'], ['rtd', 'Rush TD'], ['rec', 'Rec'], ['cyds', 'Rec yds'], ['ctd', 'Rec TD'], ['tot', 'Tackles'], ['tfl', 'TFL'], ['sk', 'Sacks'], ['ints', 'INT'], ['pd', 'PBU'], ['ff', 'FF'], ['ovr', '16-0 OVR']],
    hoops: [['ovr', '40-0 OVR'], ['gp', 'G'], ['pts', 'Pts'], ['ppg', 'PPG'], ['reb', 'Reb'], ['rpg', 'RPG'], ['ast', 'Ast'], ['apg', 'APG'], ['stl', 'Stl'], ['blk', 'Blk'], ['tpm', '3PM'], ['fgp', 'FG%']],
    diamond: [['ovr', '69-0 OVR'], ['gp', 'G'], ['ab', 'AB'], ['h', 'H'], ['hr', 'HR'], ['rbi', 'RBI'], ['r', 'R'], ['sb', 'SB'], ['avg', 'AVG'], ['app', 'App'], ['w', 'W'], ['l', 'L'], ['era', 'ERA'], ['ip', 'IP'], ['so', 'K'], ['sv', 'SV']],
    volleyball: [['sp', 'Sets'], ['k', 'Kills'], ['a', 'Assists'], ['d', 'Digs'], ['b', 'Blocks'], ['sa', 'Aces'], ['hp', 'Hit %']],
    soccer: [['gp', 'G'], ['g', 'Goals'], ['a', 'Assists'], ['pts', 'Pts'], ['sv', 'Saves'], ['sho', 'SO'], ['gaa', 'GAA'], ['w', 'W']],
  };
  const colsFor = sp => COLS[sp === 'football' ? 'football' : sp === 'mbb' || sp === 'wbb' ? 'hoops' : sp === 'baseball' || sp === 'softball' ? 'diamond' : sp];
  const fmtV = (k, v) => v == null || v === '' ? '' : /^(avg|fgp|hp)$/.test(k) ? Number(v).toFixed(3).replace(/^0/, '') : /^(era|gaa)$/.test(k) ? Number(v).toFixed(2) : typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : (typeof v === 'number' ? v.toLocaleString('en-US') : v);
  function seasonTable(p) {
    const cols = colsFor(p.sp).filter(([k]) => p.seasons.some(s => k === 'pos' ? s.pos : k === 'ovr' ? s.ovr : s.st && s.st[k] != null && s.st[k] !== ''));
    return `<div class="tablewrap"><table class="pstats"><thead><tr><th>Season</th>${cols.map(([, l]) => `<th class="n">${esc(l)}</th>`).join('')}</tr></thead>
      <tbody>${p.seasons.map(s => `<tr${p.sp === 'football' ? (s.y === p.best ? ' class="best"' : '') : (s.s === p.bestS ? ' class="best"' : '')}><td><b>${esc(s.s)}</b>${s.k === 'P' && p.sp.match(/ball$/) ? ' <span class="dim">pitching</span>' : ''}${(s.hon || []).length ? ` <span class="dim">${esc(s.hon.map(honText).slice(0, 2).join(', '))}</span>` : ''}</td>${cols.map(([k]) => `<td class="n num">${esc(k === 'pos' ? (s.pos === 'DL' ? 'DT' : s.pos) : k === 'ovr' ? s.ovr : fmtV(k, s.st[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function playerCard(p) {
    return `<a class="pl-card" href="${href('players-' + p.sp + '-' + p.slug)}"><b>${esc(p.n)}</b><span class="dim">${esc(SPORT_NAME[p.sp])} · ${esc(p.pos === 'DL' ? 'DT' : p.pos || '')} · ${esc(p.span)}</span></a>`;
  }
  function setLD(obj) {
    let s = document.getElementById('ldPlayer'); if (!obj) { if (s) s.remove(); return; }
    if (!s) { s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'ldPlayer'; document.head.appendChild(s); }
    s.textContent = JSON.stringify(obj);
  }
  window.renderPlayers = function (app, sport, slug) {
    withPlayers(app, 'Players', () => {
      if (sport && slug) return playerPage(app, BYKEY[sport + '/' + slug], sport, slug);
      setLD(null);
      const sp = SPORT_NAME[sport] ? sport : null;
      const list = PL.filter(p => !sp || p.sp === sp);
      app.innerHTML = `<div class="wrap hub-hero"><div class="eyebrow">History</div><h1>${sp ? esc(SPORT_NAME[sp]) + ' players' : 'Players'}</h1>
        <p>${PL.length} Vols with season-by-season stats: football from 1980, women's basketball from 1990-91, men's basketball from 1990-91, baseball and softball from 2000, volleyball from 2006 and soccer from 2001. Search anyone, or <a href="${href('compare')}">compare two players</a>.</p></div>
        <div class="wrap"><div class="pl-tools"><input id="plq" type="search" placeholder="Search a player" aria-label="Search players" autocomplete="off">
          <div class="gchips">${['all'].concat(SPORT_ORDER).map(k => `<a class="chipbtn" aria-current="${(k === 'all' && !sp) || k === sp ? 'true' : 'false'}" href="${href(k === 'all' ? 'players' : 'players-' + k)}">${esc(k === 'all' ? 'All sports' : SPORT_NAME[k])}</a>`).join('')}</div></div>
          <h3 class="pl-sub" id="plHead">Top players</h3><div class="pl-grid" id="plList"></div></div>`;
      const box = app.querySelector('#plList'), head = app.querySelector('#plHead'), q = app.querySelector('#plq');
      const top = list.slice().sort((a, b) => b.ovr - a.ovr || (b.yrs.length - a.yrs.length)).slice(0, 60);
      const draw = () => {
        const s = q.value.trim().toLowerCase();
        const rows = s.length < 2 ? top : list.filter(p => p.n.toLowerCase().includes(s)).slice(0, 80);
        head.textContent = s.length < 2 ? `Top ${sp ? SPORT_NAME[sp].toLowerCase() + ' ' : ''}players` : `${rows.length} match${rows.length === 1 ? '' : 'es'}`;
        box.innerHTML = rows.map(playerCard).join('') || '<p class="dim">No one by that name in our data yet.</p>';
      };
      q.addEventListener('input', draw); draw();
    });
  };
  function playerPage(app, p, sport, slug) {
    if (!p) { app.innerHTML = `<div class="wrap hub-hero"><div class="eyebrow">Players</div><h1>Not found</h1><p>We don't have a page for that player yet. <a href="${href('players')}">Search all players</a>.</p></div>`; return; }
    document.title = `${p.n} · Tennessee ${SPORT_NAME[p.sp]} · The Vol Index`;
    setLD({ '@context': 'https://schema.org', '@type': 'Person', name: p.n, affiliation: { '@type': 'SportsTeam', name: 'Tennessee Volunteers ' + SPORT_NAME[p.sp].toLowerCase() } });
    const hon = (p.hon || []).slice().sort();
    const facts = [
      ['Position', p.pos === 'DL' ? 'DT' : p.pos], ['Seasons in our data', p.span], ['Hometown', p.home], ['Before Tennessee', p.frm],
      p.sp === 'football' ? ['NFL draft', p.draft ? (p.draft[1] ? `${p.draft[0]}, round ${p.draft[1]}` : `${p.draft[0]}, undrafted free agent`) : null] : ['Coach (best season)', p.coach],
      p.pro ? [p.pro.lg + ' draft', `${p.pro.y}, round ${p.pro.rd}${p.pro.pick ? ', pick ' + p.pro.pick : ''}`] : p.mlb ? ['MLB draft', p.mlb.replace(' rd ', ', round ')] : null,
      p.sp === 'football' ? ['NFL teams', (p.nfl || []).join(' → ')] : null,
    ].filter(x => x && x[1]);
    const related = PL.filter(x => x.sp === p.sp && x !== p && x.yrs.some(y => p.yrs.includes(y))).sort((a, b) => b.ovr - a.ovr).slice(0, 8);
    app.innerHTML = `<div class="wrap pl-page">
      <nav class="gcrumb"><a href="${href('players')}">Players</a> <span aria-hidden="true">›</span> <a href="${href('players-' + p.sp)}">${esc(SPORT_NAME[p.sp])}</a> <span aria-hidden="true">›</span> <b>${esc(p.n)}</b></nav>
      <header class="pl-head"><div><div class="eyebrow">Tennessee ${esc(SPORT_NAME[p.sp])}</div><h1>${esc(p.n)}</h1>
        <div class="pl-hon">${hon.map(h => `<span class="chip honor">${esc(honText(h))}</span>`).join('')}</div></div>
        ${RUN_NAME[p.sp] ? `<div class="pl-ovr" title="${RUN_NAME[p.sp]} overall rating for the best season"><b>${p.ovr}</b><span>${RUN_NAME[p.sp]} OVR (${esc(p.bestS || p.best)})</span></div>` : ''}</header>
      <dl class="pl-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="box pl-box"><h3>Season by season</h3>${seasonTable(p)}<p class="dim small">${p.sp === 'football' ? 'Best season highlighted. 1980s and early 1990s lines come from the UT record book\'s season leaders; 1995 on are full season stats.' : 'Best season highlighted. Season stats from utsports.com, Tennessee record books, Sports-Reference and The Baseball Cube.'}</p></div>
      <div class="grow"><a class="btn primary" href="${href('compare')}?a=${p.sp}/${p.slug}">Compare with another Vol</a> <a class="btn" href="${href('games-' + p.sp + '-guesser')}">Play ${p.sp === 'wbb' ? 'Lady Vol' : 'Vol'} Guesser</a></div>
      ${related.length ? `<h3 class="pl-sub">Teammates in our data</h3><div class="pl-grid">${related.map(playerCard).join('')}</div>` : ''}
    </div>`;
  }

  /* ---------- compare ---------- */
  function totals(p) {
    const t = {}; p.seasons.forEach(s => Object.keys(s.st || {}).forEach(k => { const v = s.st[k]; if (typeof v === 'number' && !/^(avg|fgp|hp|era|gaa|ppg|rpg|apg)$/.test(k)) t[k] = (t[k] || 0) + v; })); return t;
  }
  window.renderCompare = function (app) {
    withPlayers(app, 'Compare', () => {
      const qs = new URLSearchParams(location.search || (location.hash.split('?')[1] ? '?' + location.hash.split('?')[1] : '')), A = BYKEY[qs.get('a') || ''] || null, B = BYKEY[qs.get('b') || ''] || null;
      const pickBox = (id, p) => `<div class="cmp-pick"><input id="${id}" type="search" placeholder="Search a player" value="${p ? esc(p.n) : ''}" autocomplete="off" aria-label="Player"><ul class="cmp-hits" id="${id}h"></ul></div>`;
      const col = p => {
        if (!p) return '<div class="box cmp-col empty"><p class="dim">Pick a player.</p></div>';
        const best = p.sp === 'football' ? p.seasons.find(s => s.y === p.best) : p.seasons.find(s => s.s === p.bestS) || p.seasons[0];
        const cols = colsFor(p.sp).filter(([k]) => k !== 'pos' && k !== 'ovr' && best && best.st && best.st[k] != null);
        const tot = totals(p), tcols = colsFor(p.sp).filter(([k]) => tot[k] != null && !/^(gp|app|sp)$/.test(k));
        return `<div class="box cmp-col"><div class="eyebrow">${esc(SPORT_NAME[p.sp])} · ${esc(p.pos === 'DL' ? 'DT' : p.pos || '')} · ${esc(p.span)}</div>
          <h3><a href="${href('players-' + p.sp + '-' + p.slug)}">${esc(p.n)}</a></h3>
          ${RUN_NAME[p.sp] ? `<p><b class="cmp-ovr">${p.ovr}</b> ${RUN_NAME[p.sp]} OVR</p>` : ''}
          <div class="pl-hon">${(p.hon || []).slice(0, 4).map(h => `<span class="chip honor">${esc(honText(h))}</span>`).join('')}</div>
          <h4>Best season (${esc(best ? best.s : '')})</h4><dl class="cmp-stats">${cols.map(([k, l]) => `<div data-k="b-${k}"><dt>${esc(l)}</dt><dd>${esc(fmtV(k, best.st[k]))}</dd></div>`).join('')}</dl>
          <h4>Totals in our data (${p.seasons.length} season${p.seasons.length === 1 ? '' : 's'})</h4><dl class="cmp-stats">${tcols.map(([k, l]) => `<div data-k="t-${k}"><dt>${esc(l)}</dt><dd>${esc(fmtV(k, tot[k]))}</dd></div>`).join('') || '<p class="dim small">Only a best-season line for this player.</p>'}</dl></div>`;
      };
      app.innerHTML = `<div class="wrap hub-hero"><div class="eyebrow">Players</div><h1>Compare Vols</h1><p>Pick any two players, any sports. The better number on a shared stat is highlighted.</p></div>
        <div class="wrap"><div class="cmp-picks">${pickBox('cmpA', A)}<span class="gvs">vs.</span>${pickBox('cmpB', B)}</div>
        <div class="cmp-grid">${col(A)}${col(B)}</div>${A && B ? `<div class="grow"><button class="btn" id="cmpShare">Copy link to this comparison</button></div>` : ''}</div>`;
      // highlight the better value on shared stats (lower is better for ERA / GAA)
      if (A && B) app.querySelectorAll('.cmp-col:first-child [data-k]').forEach(el => {
        const k = el.dataset.k, other = app.querySelector(`.cmp-col:last-child [data-k="${k}"]`); if (!other) return;
        const a = parseFloat(el.querySelector('dd').textContent.replace(/,/g, '')), b = parseFloat(other.querySelector('dd').textContent.replace(/,/g, ''));
        if (isNaN(a) || isNaN(b) || a === b) return; const low = /era|gaa|-int$/.test(k);
        ((low ? a < b : a > b) ? el : other).classList.add('win');
      });
      const set = (which, p) => { const q2 = new URLSearchParams(location.search); q2.set(which, p.sp + '/' + p.slug); history.replaceState(history.state, '', location.pathname + '?' + q2.toString() + location.hash); window.renderCompare(app); };
      ['cmpA', 'cmpB'].forEach(id => {
        const inp = app.querySelector('#' + id), ul = app.querySelector('#' + id + 'h'); let hits = [];
        inp.addEventListener('input', () => { const s = inp.value.trim().toLowerCase(); hits = s.length < 2 ? [] : PL.filter(p => p.n.toLowerCase().includes(s)).slice(0, 8); ul.innerHTML = hits.map((p, i) => `<li data-i="${i}"><b>${esc(p.n)}</b> <span class="dim">${esc(SPORT_NAME[p.sp])} · ${esc(p.span)}</span></li>`).join(''); });
        ul.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (!li) return; e.preventDefault(); set(id === 'cmpA' ? 'a' : 'b', hits[+li.dataset.i]); });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter' && hits[0]) set(id === 'cmpA' ? 'a' : 'b', hits[0]); });
      });
      const sh = app.querySelector('#cmpShare');
      if (sh) sh.addEventListener('click', () => { const u = 'https://www.volindex.net/compare' + location.search; try { navigator.clipboard.writeText(u).then(() => { sh.textContent = 'Copied!'; }); } catch (e) { window.prompt('Copy:', u); } });
    });
  };

  /* ---------- /me: your games ---------- */
  function exportProgress() { const o = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^vi-games-/.test(k)) o[k] = localStorage.getItem(k); } } catch (e) {} return o; }
  function importProgress(o) { let n = 0; Object.keys(o || {}).forEach(k => { if (/^vi-games-/.test(k) && typeof o[k] === 'string') { if (!LS.get(k) || /-daily-/.test(k) === false) { LS.set(k, o[k]); n++; } else if (!/"done":true|"final"/.test(LS.get(k)) && /"done":true|"final"/.test(o[k])) { LS.set(k, o[k]); n++; } } }); return n; }
  const toCode = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const fromCode = c => JSON.parse(decodeURIComponent(escape(atob(c.trim()))));
  function stats() {
    const out = { dailies: 0, bySport: {}, trivia: [], days: new Set() };
    Object.keys(exportProgress()).forEach(k => {
      const m = /^vi-games-(?:([a-z]+)-)?([a-z]+)-daily-(\d{4}-\d{2}-\d{2})$/.exec(k); if (!m) return;
      const v = jget(k.slice(9)); if (!(v && (v.final || (v.state && v.state.done)))) return;
      const sp = m[1] || 'football'; out.dailies++; out.bySport[sp] = (out.bySport[sp] || 0) + 1; out.days.add(m[3]);
      if (m[2] === 'trivia' && v.state && v.state.qs) out.trivia.push(v.state.picks.filter((p, i) => p === v.state.qs[i].a).length);
    });
    return out;
  }
  window.renderMe = function (app) {
    const S = stats(), today = etDate();
    const run = ['run-stats'].concat(['mbb', 'wbb', 'baseball', 'softball'].map(k => k + '-run-stats')).map(jget).filter(Boolean)
      .reduce((a, x) => ({ played: a.played + (x.played || 0), titles: a.titles + (x.titles || 0), perfect: a.perfect + (x.perfect || 0) }), { played: 0, titles: 0, perfect: 0 });
    const st = streak(anyOn), best = (() => { const ds = [...S.days].sort(); let b = 0, cur = 0, prev = null; ds.forEach(d => { cur = prev && dayShift(prev, 1) === d ? cur + 1 : 1; b = Math.max(b, cur); prev = d; }); return b; })();
    const days = Array.from({ length: 28 }, (_, i) => dayShift(today, i - 27));
    const avg = S.trivia.length ? (S.trivia.reduce((a, b) => a + b, 0) / S.trivia.length).toFixed(1) : null;
    const CFG = window.VI_AUTH_CONFIG;
    const sync = `        <div class="box me-sync"><h3>${CFG ? 'Sign in to sync' : 'Move your progress'}</h3>
          ${CFG ? `<div id="meAuth"><p class="dim">Sign in with your email and your streaks follow you to every device. We email you a link, no password.</p><div class="grow"><input id="meEmail" type="email" placeholder="you@example.com" autocomplete="email"><button class="btn primary" id="meSend">Email me a sign-in link</button></div><p class="dim small" id="meMsg"></p></div>` :
          `<p class="dim">Accounts are on the way. Until then, copy your transfer code here and paste it on your other phone or computer.</p>`}
          <div class="grow"><button class="btn" id="meCopy">Copy my transfer code</button></div>
          <details><summary>Paste a code from another device</summary><textarea id="meCode" rows="3" placeholder="Paste your transfer code"></textarea><div class="grow"><button class="btn" id="meLoad">Load progress</button></div><p class="dim small" id="meLoaded"></p></details></div>`;
    app.innerHTML = `<div class="wrap hub-hero"><div class="eyebrow">Your games</div><h1>My Vol games</h1><p>Your streaks and results. Progress is saved in this browser${CFG ? ' and in your account when you sign in' : ''}.</p></div>
      <div class="wrap">
${CFG ? sync : ''}        <div class="me-tiles"><div class="box"><b>${st}</b><span>Day streak 🔥</span></div><div class="box"><b>${best}</b><span>Best streak</span></div><div class="box"><b>${S.dailies}</b><span>Dailies finished</span></div>
          <div class="box"><b>${run.titles || 0}</b><span>Titles in ${run.played || 0} undefeated-run games</span></div><div class="box"><b>${run.perfect || 0}</b><span>Perfect seasons</span></div><div class="box"><b>${avg ?? '—'}</b><span>Trivia average (of 10)</span></div></div>
        <div class="box me-cal"><h3>Last four weeks</h3><div class="me-days">${days.map(d => `<span class="${anyOn(d) ? 'on' : ''} ${d === today ? 'today' : ''}" title="${d}"></span>`).join('')}</div></div>
        <div class="box me-today"><h3>Today's dailies</h3>${SPORT_ORDER.map(sp => `<div class="me-row"><b>${esc(SPORT_NAME[sp])}</b><span>${GAMES[sp].map(g => `<a class="${doneOn(sp, g, today) ? 'done' : ''}" href="${href('games-' + sp + '-' + g)}" title="${esc(gName(sp, g))}">${gIcon(sp, g)}${doneOn(sp, g, today) ? '✓' : ''}</a>`).join('')}</span><span class="dim">${S.bySport[sp] || 0} all time</span></div>`).join('')}</div>
${CFG ? '' : sync}      </div>`;
    app.querySelector('#meCopy').addEventListener('click', e => { const c = toCode(exportProgress()); const b = e.currentTarget; try { navigator.clipboard.writeText(c).then(() => { b.textContent = 'Copied!'; }); } catch (x) { window.prompt('Your transfer code:', c); } });
    app.querySelector('#meLoad').addEventListener('click', () => { const m = app.querySelector('#meLoaded'); try { const n = importProgress(fromCode(app.querySelector('#meCode').value)); m.textContent = `Loaded ${n} saved results.`; setTimeout(() => window.renderMe(app), 900); } catch (e) { m.textContent = "That code didn't work. Copy it again and paste the whole thing."; } });
    if (CFG) wireAuth(app, CFG);
  };
  /* Optional sign-in (Supabase magic link). Turned on by setting window.VI_AUTH_CONFIG = { url, anonKey } in
     assets/auth-config.js; see tools/SIGNIN_SETUP.md. Progress syncs to a "progress" table (one row per user). */
  async function client(CFG) {
    if (!window.supabase) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    return window._viSb || (window._viSb = window.supabase.createClient(CFG.url, CFG.anonKey));
  }
  async function sync(sb) {
    const { data: { user } } = await sb.auth.getUser(); if (!user) return null;
    const { data } = await sb.from('progress').select('data').eq('user_id', user.id).maybeSingle();
    if (data && data.data) importProgress(data.data);
    await sb.from('progress').upsert({ user_id: user.id, data: exportProgress(), updated_at: new Date().toISOString() });
    return user;
  }
  async function wireAuth(app, CFG) {
    const box = app.querySelector('#meAuth'), msg = app.querySelector('#meMsg');
    try {
      const sb = await client(CFG), user = await sync(sb);
      headerAuth();
      if (user) { box.innerHTML = `<p>Signed in as <b>${esc(user.email)}</b>. Your progress is synced.</p><div class="grow"><button class="btn" id="meOut">Sign out</button></div>`; box.querySelector('#meOut').addEventListener('click', async () => { await sb.auth.signOut(); headerAuth(); window.renderMe(app); }); return; }
      app.querySelector('#meSend').addEventListener('click', async () => {
        const email = app.querySelector('#meEmail').value.trim(); if (!/.+@.+\..+/.test(email)) { msg.textContent = 'Enter your email.'; return; }
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + (window.VI_ROUTER ? window.VI_ROUTER.href('me') : '/me') } });
        msg.textContent = error ? "Couldn't send the link. Try again in a minute." : 'Check your email for the sign-in link.';
      });
    } catch (e) { if (msg) msg.textContent = 'Sign-in is unavailable right now. Your progress is still saved in this browser.'; }
  }
  // header: "Sign in", or "My account" once a Supabase session is saved in this browser
  function headerAuth() {
    const a = document.getElementById('meLink'), CFG = window.VI_AUTH_CONFIG; if (!a) return;
    if (!CFG) { a.textContent = 'My games'; a.title = 'Your games and streaks'; return; }
    let on = false; try { const ref = (/https:\/\/([^.]+)\./.exec(CFG.url) || [])[1]; on = !!(ref && localStorage.getItem('sb-' + ref + '-auth-token')); } catch (e) {}
    a.textContent = on ? 'My account' : 'Sign in'; a.title = on ? 'Your account, games and streaks' : 'Sign in to sync your Vol games across devices';
  }
  window.VI_HEADER_AUTH = headerAuth;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', headerAuth); else headerAuth();
  // keep a signed-in player's progress synced after each finished daily
  window.VI_SYNC = function () { const CFG = window.VI_AUTH_CONFIG; if (!CFG) return; client(CFG).then(sync).catch(() => {}); };

  /* ---------- game day: latest plays on the live card ---------- */
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/';
  let playsTimer = null, lastPlaysAt = 0, lastHtml = '';
  async function livePlays() {
    clearTimeout(playsTimer);
    const L = window.VI_LIVE || {}, key = window.VI_ROUTER ? window.VI_ROUTER.key() : 'home';
    const g = L[key.split('-')[0]];
    const card = document.querySelector('.livecard');
    if (!g || !card || !g.id || g.state === 'pre') return;
    try {
      if (Date.now() - lastPlaysAt > 15e3) {
        const r = await fetch(`${ESPN}${window.VI_LIVE_PATH[g.sport][0]}/summary?event=${g.id}`, { cache: 'no-store' });
        const d = await r.json(); lastPlaysAt = Date.now();
        const P = (d.scoringPlays && d.scoringPlays.length ? d.scoringPlays : (d.plays || [])).slice(-4).reverse();
        lastHtml = P.length ? `<div class="lplays"><div class="eyebrow">${d.scoringPlays && d.scoringPlays.length ? 'Latest scoring plays' : 'Latest plays'}</div><ol>${P.map(p => `<li><span class="dim">${esc((p.period && p.period.displayValue ? p.period.displayValue + ' ' : '') + ((p.clock || {}).displayValue || ''))}</span> ${esc(p.text || p.shortText || '')}</li>`).join('')}</ol></div>` : '';
      }
      let box = card.querySelector('.lplays-slot'); if (!box) { box = document.createElement('div'); box.className = 'lplays-slot'; card.appendChild(box); }
      if (box.innerHTML !== lastHtml) box.innerHTML = lastHtml;
    } catch (e) {}
    if (g.state === 'in') playsTimer = setTimeout(livePlays, 20e3);
  }
  window.addEventListener('vi:route', () => setTimeout(livePlays, 1500));
  // the live card is redrawn on every score update: put the cached plays back right away
  setInterval(() => { const card = document.querySelector('.livecard'); if (card && lastHtml && !card.querySelector('.lplays-slot')) { const b = document.createElement('div'); b.className = 'lplays-slot'; b.innerHTML = lastHtml; card.appendChild(b); } }, 1500);
  document.addEventListener('DOMContentLoaded', () => setTimeout(livePlays, 2500));
})();
