/* The Vol Index — Games.
   Five games built on Tennessee football history (data/games-data.js, written by tools/build_games.py):
     · Checkerboard Run   spin an era, draft a 10-man roster of Vols, play a 12-game season, the SEC title game and the 12-team playoff
     · Vol Guesser        find the mystery Vol from position, era, coach, honors and draft clues
     · Power T Grid       fill a 3x3 grid with Vols who fit the row and the column
     · VFL Career         name the Vol from the NFL teams he played for
     · Rocky Top Rankings put five Vol seasons in order of a stat
   Each game has a daily challenge (same for everyone, new at midnight Eastern) and free play.
   Results stay in this browser (localStorage). Nothing is sent anywhere. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const etDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const SITE = 'volindex.net/games';

  /* ---------- seeded random ---------- */
  function hashStr(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; }; }
  function rngFrom(seed) { let a = hashStr(String(seed))(); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const freeSeed = () => String(Date.now()) + Math.random();
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* ---------- storage (per browser) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('vi-games-' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('vi-games-' + k, JSON.stringify(v)); } catch (e) {} },
  };
  function copyText(t, btn) {
    const done = () => { if (btn) { const o = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = o; }, 1600); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => window.prompt('Copy your result:', t));
    else window.prompt('Copy your result:', t);
  }

  /* ---------- data ---------- */
  let D = null, ALL = [], POOL = [], BYNAME = {};
  function loadData(cb) {
    if (window.VI_GAMES_DATA) return cb();
    let s = document.getElementById('viGamesData');
    if (!s) { s = document.createElement('script'); s.id = 'viGamesData'; s.src = 'data/games-data.js'; document.head.appendChild(s); }
    s.addEventListener('load', cb, { once: true });
  }
  function initData() {
    if (D) return; D = window.VI_GAMES_DATA;
    ALL = D.players; POOL = ALL.filter(p => p.pool);
    ALL.forEach(p => { BYNAME[p.n.toLowerCase()] = p; p.dec = Math.floor(p.y / 10) * 10; });
  }
  const SLOTS = ['QB', 'RB', 'WR', 'WR', 'TE', 'DL', 'EDGE', 'LB', 'CB', 'S'];
  const SLOT_NAME = { QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end', DL: 'Defensive tackle', EDGE: 'Edge rusher', LB: 'Linebacker', CB: 'Cornerback', S: 'Safety' };
  const ERAS = [1980, 1990, 2000, 2010, 2020];
  const eraLabel = d => d + 's';
  const HON_LABEL = { AAu: 'Unanimous All-American', AAc: 'Consensus All-American', AA1: 'All-American', AA2: 'All-America 2nd/3rd team', SEC: 'First-team All-SEC', POY: 'SEC Player of the Year', OPOY: 'SEC Offensive POY', DPOY: 'SEC Defensive POY', H2: 'Heisman runner-up', H5: 'Heisman top 5', H8: 'Heisman top 10' };
  const honText = h => h.startsWith('W:') ? h.slice(2) + ' Award' : h.startsWith('F:') ? h.slice(2) + ' finalist' : (HON_LABEL[h] || h);
  const fmt = n => (typeof n === 'number' ? (Number.isInteger(n) ? n.toLocaleString('en-US') : String(n)) : n);
  function statLine(p) {
    const s = p.st || {}, out = [];
    const add = (v, l) => { if (v !== undefined && v !== null) out.push(fmt(v) + ' ' + l); };
    if (p.slot === 'QB') { if (s.cmp && s.att) out.push(s.cmp + '/' + s.att); add(s.yds, 'pass yds'); add(s.td, 'TD'); add(s.int, 'INT'); if (s.ryds > 150) add(s.ryds, 'rush yds'); }
    else if (p.slot === 'RB') { add(s.ryds, 'rush yds'); add(s.rtd, 'TD'); if (s.cyds > 100) add(s.cyds, 'rec yds'); }
    else if (p.slot === 'WR' || p.slot === 'TE') { add(s.rec, 'rec'); add(s.cyds, 'yds'); add(s.ctd, 'TD'); }
    else { add(s.tot, 'tackles'); if (s.tfl) add(s.tfl, 'TFL'); if (s.sk) add(s.sk, 'sacks'); if (s.ints) add(s.ints, 'INT'); if (s.pd) add(s.pd, 'PBU'); }
    return out.length ? out.join(' · ') : 'Stats not fully tracked that year';
  }
  const honorChips = (h, max = 3) => (h || []).slice().sort((a, b) => honRank(a) - honRank(b)).slice(0, max).map(x => `<span class="chip honor">${esc(honText(x))}</span>`).join('');
  function honRank(h) { return ['AAu', 'AAc', 'W:', 'AA1', 'H2', 'POY', 'OPOY', 'DPOY', 'H5', 'AA2', 'SEC', 'F:', 'H8'].findIndex(x => h.startsWith(x)); }

  /* ---------- autocomplete search box ---------- */
  function searchBox(el, names, onPick, placeholder) {
    el.innerHTML = `<div class="gsearch"><input type="text" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder || 'Type a player name')}" aria-label="${esc(placeholder || 'Player name')}"><ul role="listbox"></ul></div>`;
    const inp = el.querySelector('input'), ul = el.querySelector('ul'); let hits = [], sel = 0;
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '');
    const draw = () => { ul.innerHTML = hits.map((h, i) => `<li role="option" data-i="${i}" class="${i === sel ? 'on' : ''}">${esc(h)}</li>`).join(''); ul.hidden = !hits.length; };
    inp.addEventListener('input', () => {
      const q = norm(inp.value.trim());
      hits = q.length < 2 ? [] : names.filter(n => norm(n).split(' ').some(w => w.startsWith(q)) || norm(n).startsWith(q) || norm(n).includes(q)).slice(0, 8);
      sel = 0; draw();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { sel = Math.min(hits.length - 1, sel + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && hits[sel]) { const h = hits[sel]; inp.value = ''; hits = []; draw(); onPick(h); }
      else if (e.key === 'Escape') { hits = []; draw(); }
    });
    ul.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (!li) return; e.preventDefault(); const h = hits[+li.dataset.i]; inp.value = ''; hits = []; draw(); onPick(h); });
    ul.hidden = true;
    return inp;
  }

  /* ---------- shared page frame ---------- */
  const GAMES = [
    { key: 'run', name: 'Checkerboard Run', icon: '🏈', blurb: 'Spin an era, draft ten Vols at their best, then play 12 games against all-time great teams. Win the SEC and run the 12-team playoff.' },
    { key: 'guesser', name: 'Vol Guesser', icon: '🔎', blurb: 'Find the mystery Vol. Every guess shows how close you are on position, prime season, head coach, honors and NFL draft.' },
    { key: 'grid', name: 'Power T Grid', icon: '🟧', blurb: 'Fill a 3×3 grid with Vols who fit both the row and the column. Nine guesses, no repeats.' },
    { key: 'career', name: 'VFL Career', icon: '🏟️', blurb: 'Name the Vol for Life from the NFL teams he played for. Wrong guesses unlock more clues.' },
    { key: 'rankings', name: 'Rocky Top Rankings', icon: '📊', blurb: 'Put five Vol seasons in order of a stat. Correct spots lock in orange. Three tries.' },
  ];
  function frame(app, g, inner, sub) {
    app.innerHTML = `<div class="wrap games">
      <nav class="gcrumb"><a href="#games">Games</a> <span aria-hidden="true">›</span> <b>${esc(g.name)}</b></nav>
      <header class="ghead"><h1><span aria-hidden="true">${g.icon}</span> ${esc(g.name)}</h1>${sub ? `<p>${sub}</p>` : ''}</header>
      <div id="gbody">${inner || ''}</div></div>`;
    return app.querySelector('#gbody');
  }
  function modeBar(mode, dailyDone) {
    return `<div class="gmode" role="tablist" aria-label="Game mode">
      <button role="tab" data-mode="daily" aria-selected="${mode === 'daily'}">Daily challenge${dailyDone ? ' ✓' : ''}</button>
      <button role="tab" data-mode="free" aria-selected="${mode === 'free'}">Free play</button></div>`;
  }
  function bindMode(root, cb) { root.querySelectorAll('.gmode [data-mode]').forEach(b => b.addEventListener('click', () => cb(b.dataset.mode))); }

  /* =====================================================================================
     HUB
     ===================================================================================== */
  function renderHub(app) {
    const today = etDate();
    app.innerHTML = `<div class="wrap hub-hero games-hero"><div class="eyebrow">Play</div><h1>Vol <span>Games</span></h1>
      <p>Trivia and sim games built on Tennessee football history, from Reggie White to Jalin Hyatt. Each one has a daily challenge that everyone gets the same, plus free play. New dailies drop at midnight Eastern.</p></div>
      <div class="wrap grid g3 gcards">${GAMES.map(g => {
        const sv = store.get(g.key + '-daily-' + today, null), done = sv && (sv.final || (sv.state && sv.state.done));
        return `<a class="box gcard" href="#games-${g.key}"><div class="gcard-top"><span class="gicon" aria-hidden="true">${g.icon}</span>${done ? '<span class="chip new">Today ✓</span>' : '<span class="chip">Daily</span>'}</div>
          <h3>${esc(g.name)}</h3><p>${esc(g.blurb)}</p><span class="btn primary">Play</span></a>`;
      }).join('')}</div>
      <div class="wrap gfoot"><button class="btn" id="gShareAll">Copy today's results</button>
        <p class="dim">Stats come from the Tennessee football record book, ESPN and CollegeFootballData.com. Each Vol appears at his best season at Tennessee. Spotted a mistake? Email <a href="mailto:thevolindex@gmail.com">thevolindex@gmail.com</a>.</p></div>`;
    app.querySelector('#gShareAll').addEventListener('click', e => {
      const lines = GAMES.map(g => { const r = store.get(g.key + '-daily-' + today, null); return r && r.share ? r.share.split('\n')[0] : null; }).filter(Boolean);
      copyText(lines.length ? `Vol Index games · ${today}\n${lines.join('\n')}\n${SITE}` : `No daily games finished yet today. ${SITE}`, e.currentTarget);
    });
  }

  /* =====================================================================================
     CHECKERBOARD RUN — roster builder + season sim
     ===================================================================================== */
  const RUN = { settings: { side: 'both', eras: ERAS.slice() }, mode: 'daily', st: null };
  const RUN_REROLLS = 2;
  function runSlots(side) { return side === 'off' ? SLOTS.slice(0, 5) : side === 'def' ? SLOTS.slice(5) : SLOTS.slice(); }

  function renderRun(app) {
    const g = GAMES[0], today = etDate();
    const daily = store.get('run-daily-' + today, null);
    const body = frame(app, g, '', 'Spin an era, draft Vols at their best season, then try to run the table: 12 games, the SEC Championship and the 12-team College Football Playoff.');
    const st = RUN.st;
    if (RUN.mode === 'daily' && daily && daily.final) { RUN.st = daily.final; return runResults(body, true); }
    if (!st) return runSetup(body, daily);
    if (st.phase === 'draft') return runDraft(body);
    if (st.phase === 'season') return runSeason(body);
    return runResults(body, false);
  }
  function runSetup(body, daily) {
    const s = RUN.settings, isDaily = RUN.mode === 'daily';
    body.innerHTML = `${modeBar(RUN.mode, !!(daily && daily.final))}
      <div class="box gsetup">
        <h3>Set up your run</h3>
        ${isDaily ? `<p class="dim">Today's challenge: everyone gets the same spins and the same schedule. Both sides of the ball, every era. One try per day.</p>` : `
        <div class="gfield"><div class="glabel">Roster</div><div class="gseg" data-k="side">
          ${[['both', 'Both sides'], ['off', 'Offense only'], ['def', 'Defense only']].map(([v, l]) => `<button data-v="${v}" aria-pressed="${s.side === v}">${l}</button>`).join('')}</div></div>
        <div class="gfield"><div class="glabel">Eras <button class="glink" id="eraAll">${s.eras.length === ERAS.length ? 'Clear all' : 'Select all'}</button></div><div class="gchips">
          ${ERAS.map(e => `<button data-era="${e}" aria-pressed="${s.eras.includes(e)}">${eraLabel(e)}</button>`).join('')}</div>
          <p class="dim small">1980s-2003 stat lines come from the UT record book (season leaders) and honors; 2004 on are full box-score stats.</p></div>`}
        <div class="gnote"><b>Prime seasons only.</b> Every Vol shows his single best season at Tennessee, rated on production with a bonus for All-America, All-SEC and national awards.</div>
        <div class="grow"><button class="btn primary big" id="runStart" ${!isDaily && !s.eras.length ? 'disabled' : ''}>Start ${isDaily ? "today's run" : 'free play'}</button></div>
      </div>
      ${howRun()}`;
    bindMode(body, m => { RUN.mode = m; RUN.st = null; VI_RENDER_GAMES(); });
    body.querySelectorAll('[data-k="side"] button').forEach(b => b.addEventListener('click', () => { s.side = b.dataset.v; VI_RENDER_GAMES(); }));
    body.querySelectorAll('[data-era]').forEach(b => b.addEventListener('click', () => { const e = +b.dataset.era; s.eras = s.eras.includes(e) ? s.eras.filter(x => x !== e) : s.eras.concat(e).sort(); VI_RENDER_GAMES(); }));
    const ea = body.querySelector('#eraAll'); if (ea) ea.addEventListener('click', () => { s.eras = s.eras.length === ERAS.length ? [] : ERAS.slice(); VI_RENDER_GAMES(); });
    body.querySelector('#runStart').addEventListener('click', () => {
      const daily = RUN.mode === 'daily';
      const side = daily ? 'both' : s.side, eras = daily ? ERAS.slice() : s.eras.slice();
      RUN.st = { phase: 'draft', daily, date: etDate(), seed: daily ? 'run-' + etDate() : freeSeed(), side, eras, slots: runSlots(side).map(p => ({ pos: p, p: null })), spin: 0, rerolls: RUN_REROLLS, offer: null };
      runSpin(); VI_RENDER_GAMES();
    });
  }
  function howRun() {
    return `<details class="box ghow"><summary>How it works</summary>
      <ol><li><b>Spin.</b> Each spin lands on an era and shows up to five Vols from it who fit your open spots.</li>
      <li><b>Draft.</b> Pick one per spin until your roster is full: QB, RB, two WRs, TE on offense; DT, edge, LB, CB and safety on defense. Two re-spins per run.</li>
      <li><b>Play.</b> Your offense and defense ratings are the average of your starters. You play 9 SEC games and 3 non-conference games against great teams from the last 30 seasons (2019 LSU, 2001 Miami, 2022 Georgia...).</li>
      <li><b>Postseason.</b> Finish in the SEC's top two for the SEC Championship. The 12-team playoff takes the five best conference champions plus seven at-large teams, seeded 1-12; seeds 1-4 get a bye. A perfect run is 16-0 or 17-0.</li></ol></details>`;
  }
  function openSlots(st) { return st.slots.filter(s => !s.p).map(s => s.pos); }
  function runSpin() {
    const st = RUN.st, r = rngFrom(st.seed + '|spin' + st.spin + '|' + (RUN_REROLLS - st.rerolls));
    const open = openSlots(st), taken = new Set(st.slots.filter(s => s.p).map(s => s.p.n));
    const elig = POOL.filter(p => st.eras.includes(p.dec) && open.includes(p.slot) && !taken.has(p.n));
    const eras = st.eras.filter(e => elig.some(p => p.dec === e));
    if (!eras.length) { st.offer = { era: null, ids: [] }; return; }
    const era = pick(r, eras);
    // favor variety of positions: one card per open position first, then fill
    const inEra = shuffle(r, elig.filter(p => p.dec === era)), ids = [], seenPos = new Set();
    inEra.forEach(p => { if (ids.length < 5 && !seenPos.has(p.slot)) { ids.push(p.n); seenPos.add(p.slot); } });
    inEra.forEach(p => { if (ids.length < 5 && !ids.includes(p.n)) ids.push(p.n); });
    st.offer = { era, ids };
  }
  function slotBoard(st, compact) {
    const cell = (s, i) => `<div class="gslot ${s.p ? 'full' : ''}" data-i="${i}"><span class="gslot-pos">${s.pos === 'DL' ? 'DT' : s.pos}</span>${s.p ? `<b>${esc(s.p.n)}</b><span class="dim">${s.p.y} · ${s.p.ovr}</span>` : '<span class="dim">Open</span>'}</div>`;
    const off = st.slots.map((s, i) => [s, i]).filter(([s]) => ['QB', 'RB', 'WR', 'TE'].includes(s.pos));
    const def = st.slots.map((s, i) => [s, i]).filter(([s]) => !['QB', 'RB', 'WR', 'TE'].includes(s.pos));
    return `<div class="gboard ${compact ? 'compact' : ''}">${off.length ? `<div><div class="glabel">Offense</div><div class="gslots">${off.map(([s, i]) => cell(s, i)).join('')}</div></div>` : ''}
      ${def.length ? `<div><div class="glabel">Defense</div><div class="gslots">${def.map(([s, i]) => cell(s, i)).join('')}</div></div>` : ''}</div>`;
  }
  function playerCard(p, extra) {
    return `<button class="gpcard" data-n="${esc(p.n)}"><span class="gpc-top"><span class="gpos">${p.slot === 'DL' ? 'DT' : p.slot}</span><span class="govr" title="Rating for this season">${p.ovr}</span></span>
      <b class="gpc-name">${esc(p.n)}</b><span class="gpc-yr">${p.y} · ${esc(p.coach)}</span>
      <span class="gpc-line">${esc(statLine(p))}</span><span class="gpc-hon">${honorChips(p.hon, 2)}</span>${extra || ''}</button>`;
  }
  function runDraft(body) {
    const st = RUN.st, open = openSlots(st);
    const offer = st.offer || { ids: [] };
    const cards = offer.ids.map(n => BYNAME[n.toLowerCase()]).filter(Boolean);
    body.innerHTML = `${st.daily ? '<div class="gtag">Daily challenge · ' + esc(st.date) + '</div>' : ''}
      ${slotBoard(st)}
      <div class="box gspin">
        <div class="gspin-head"><div><div class="eyebrow">Spin ${st.spin + 1} of ${st.slots.length}</div><h3 id="spinEra">${offer.era ? eraLabel(offer.era) + ' Vols' : 'No Vols left in these eras'}</h3></div>
          <button class="btn" id="reroll" ${st.rerolls ? '' : 'disabled'}>Re-spin (${st.rerolls} left)</button></div>
        <p class="dim">Pick one. He fills an open ${open.length > 1 ? 'spot' : esc(SLOT_NAME[open[0]] || 'spot').toLowerCase()} on your roster.</p>
        <div class="gcards-row">${cards.map(p => playerCard(p)).join('') || '<p>Nobody fits your open spots in these eras. Use a re-spin or start over with more eras.</p>'}</div>
      </div>
      <div class="grow"><button class="glink" id="runQuit">Start over</button></div>`;
    const era = body.querySelector('#spinEra');
    if (era && offer.era && !st.animated) { st.animated = true; spinAnim(era, offer.era); }
    body.querySelectorAll('.gpcard').forEach(b => b.addEventListener('click', () => {
      const p = BYNAME[b.dataset.n.toLowerCase()], slot = st.slots.find(s => !s.p && s.pos === p.slot);
      if (!slot) return; slot.p = p; st.spin++; st.animated = false;
      if (st.slots.every(s => s.p)) { st.phase = 'season'; buildSeason(); } else runSpin();
      VI_RENDER_GAMES();
    }));
    const rr = body.querySelector('#reroll'); rr.addEventListener('click', () => { if (!st.rerolls) return; st.rerolls--; st.animated = false; runSpin(); VI_RENDER_GAMES(); });
    body.querySelector('#runQuit').addEventListener('click', () => { if (st.daily && !confirm("Start over? Today's daily spins stay the same.")) return; RUN.st = null; VI_RENDER_GAMES(); });
  }
  function spinAnim(el, era) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const final = el.textContent; let i = 0; el.classList.add('spinning');
    const t = setInterval(() => { el.textContent = eraLabel(ERAS[i++ % ERAS.length]) + ' Vols'; if (i > 9) { clearInterval(t); el.textContent = final; el.classList.remove('spinning'); } }, 55);
  }

  // ---- season ----
  function teamRatings(st) {
    const avg = arr => arr.length ? arr.reduce((a, p) => a + p.ovr, 0) / arr.length : null;
    const off = avg(st.slots.filter(s => ['QB', 'RB', 'WR', 'TE'].includes(s.pos)).map(s => s.p));
    const def = avg(st.slots.filter(s => !['QB', 'RB', 'WR', 'TE'].includes(s.pos)).map(s => s.p));
    return { off: off == null ? 84 : off, def: def == null ? 84 : def, genericOff: off == null, genericDef: def == null };
  }
  function buildSeason() {
    const st = RUN.st, r = rngFrom(st.seed + '|schedule');
    const sec = shuffle(r, D.opponents.filter(o => o.sec)), non = shuffle(r, D.opponents.filter(o => !o.sec));
    const games = sec.slice(0, 9).map(o => ({ o: o.id, conf: true })).concat(non.slice(0, 3).map(o => ({ o: o.id, conf: false })));
    const order = shuffle(r, games);
    order.forEach((g, i) => { g.home = i % 2 === 0; g.wk = i + 1; });
    st.games = order; st.played = 0; st.post = []; st.used = order.map(g => g.o);
  }
  const OPP = id => D.opponents.find(o => o.id === id);
  function playGame(seedKey, me, o, site) {
    // site: 1 home, 0 neutral, -1 away. Opponent ratings are squeezed toward 78 so they sit on the same scale as
    // single-season Vol ratings; each point of edge on a side of the ball is worth 1.1 points on the scoreboard.
    // Calibration (12-game regular season): roster 87 ≈ 6 wins, 90 ≈ 8, 93 ≈ 10, 95 ≈ 11 (about 3 in 10 go 12-0).
    const r = rngFrom(seedKey);
    const sq = v => 78 + (v - 78) * 0.7, oo = sq(o.off), od = sq(o.deff);
    const edge = (x, y) => (x - y) * 1.1, hfa = site * 1.6;
    let us = 27 + edge(me.off, od) + hfa + gauss(r) * 9;
    let them = 27 + edge(oo, me.def) - hfa + gauss(r) * 9;
    const score = v => { v = Math.max(0, Math.round(v)); if ([1, 2, 4, 5].includes(v)) v = v <= 2 ? 3 : v === 4 ? 3 : 6; return v; };
    us = score(us); them = score(them); let ot = false;
    if (us === them) { ot = true; const pUs = 0.5 + (edge(me.off, od) - edge(oo, me.def)) / 60; if (r() < pUs) us += r() < .6 ? 7 : 3; else them += r() < .6 ? 7 : 3; }
    return { us, them, w: us > them, ot };
  }
  function runSeason(body) {
    const st = RUN.st, me = teamRatings(st);
    const wins = st.games.slice(0, st.played).filter(g => g.res.w).length, losses = st.played - wins;
    const confG = st.games.slice(0, st.played).filter(g => g.conf), cw = confG.filter(g => g.res.w).length;
    body.innerHTML = `${st.daily ? '<div class="gtag">Daily challenge · ' + esc(st.date) + '</div>' : ''}
      <div class="grid g2"><div class="box gteam"><div class="eyebrow">Your Vols</div>
        <div class="grat"><div><span>${Math.round(me.off)}</span>Offense${me.genericOff ? ' <i class="dim">(stock)</i>' : ''}</div><div><span>${Math.round(me.def)}</span>Defense${me.genericDef ? ' <i class="dim">(stock)</i>' : ''}</div><div><span>${wins}-${losses}</span>Record</div><div><span>${cw}-${confG.length - cw}</span>SEC</div></div>
        ${slotBoard(st, true)}</div>
      <div class="box gsched"><div class="gsched-head"><h3>Regular season</h3>${st.played < st.games.length ? `<div><button class="btn" id="simOne">Play week ${st.played + 1}</button> <button class="btn primary" id="simAll">Sim the rest</button></div>` : ''}</div>
        <ol class="glist">${st.games.map((g, i) => gameRow(g, i < st.played)).join('')}</ol>
        ${st.played >= st.games.length ? `<div class="grow"><button class="btn primary big" id="toPost">Postseason →</button></div>` : ''}</div></div>`;
    const step = n => { for (let k = 0; k < n && st.played < st.games.length; k++) { const g = st.games[st.played]; g.res = playGame(st.seed + '|' + rosterKey(st) + '|g' + g.wk, me, OPP(g.o), g.home ? 1 : -1); st.played++; } VI_RENDER_GAMES(); };
    const a = body.querySelector('#simOne'); if (a) a.addEventListener('click', () => step(1));
    const b = body.querySelector('#simAll'); if (b) b.addEventListener('click', () => step(99));
    const c = body.querySelector('#toPost'); if (c) c.addEventListener('click', () => { runPostseason(); VI_RENDER_GAMES(); });
  }
  const rosterKey = st => st.slots.map(s => s.p ? s.p.n : '-').join(',');
  function gameRow(g, done, label) {
    const o = OPP(g.o);
    const where = g.site === 0 || g.neutral ? 'vs.' : g.home ? 'vs.' : 'at';
    const SHORT = { 'SEC Championship': 'SEC title', 'CFP first round': 'CFP 1st rd', 'CFP quarterfinal': 'CFP QF', 'CFP semifinal': 'CFP semi', 'National championship': 'Title game' };
    return `<li class="${done ? (g.res.w ? 'w' : 'l') : ''}"><span class="gwk">${esc(label ? SHORT[label] || label : 'Wk ' + g.wk)}</span>
      <span class="gopp"><b>${where} ${o.y} ${esc(o.team)}</b> <span class="dim">(${esc(o.rec)})${g.conf ? ' · SEC' : ''}</span><span class="gstars">${esc(o.stars.join(', '))}</span></span>
      <span class="gres">${done ? `<b>${g.res.w ? 'W' : 'L'}</b> ${g.res.us}-${g.res.them}${g.res.ot ? ' OT' : ''}` : ''}</span></li>`;
  }
  function runPostseason() {
    const st = RUN.st, me = teamRatings(st), r = rngFrom(st.seed + '|' + rosterKey(st) + '|post');
    const losses = st.games.filter(g => !g.res.w).length, confL = st.games.filter(g => g.conf && !g.res.w).length;
    const unused = shuffle(r, D.opponents.filter(o => !st.used.includes(o.id)));
    const take = pred => { const i = unused.findIndex(pred); return i < 0 ? unused.shift() : unused.splice(i, 1)[0]; };
    st.notes = [];
    // SEC title game: top two in the 16-team SEC
    let secChamp = false, inSCG = confL <= 1 || (confL === 2 && r() < .35);
    if (confL === 2) st.notes.push(inSCG ? 'Tied at 7-2 and won the tiebreaker for a spot in Atlanta.' : 'Tied at 7-2 but lost the tiebreaker. No trip to Atlanta.');
    if (inSCG) {
      const o = take(x => x.sec); const g = { o: o.id, conf: false, neutral: true, label: 'SEC Championship' };
      g.res = playGame(st.seed + '|' + rosterKey(st) + '|scg', me, o, 0); st.post.push(g); secChamp = g.res.w;
    }
    const totalL = losses + (inSCG && !secChamp ? 1 : 0);
    // committee seed (straight seeding; five best conference champions are in)
    let seed = null;
    if (totalL === 0) seed = 1;
    else if (totalL === 1) seed = secChamp ? 1 + Math.floor(r() * 2) : 3 + Math.floor(r() * 4);
    else if (totalL === 2) seed = secChamp ? 4 + Math.floor(r() * 3) : 6 + Math.floor(r() * 4);
    else if (totalL === 3) seed = secChamp ? 9 + Math.floor(r() * 2) : (r() < .6 ? 10 + Math.floor(r() * 3) : null);
    else if (secChamp) seed = 12;
    st.seed12 = seed;
    if (!seed) { st.notes.push(totalL >= 4 ? 'Four losses against this schedule is still four losses. Left out of the playoff.' : 'The committee left you just outside the 12-team field.'); st.phase = 'done'; return finishRun(); }
    const rounds = [];
    if (seed > 4) rounds.push({ label: 'CFP first round', site: seed <= 8 ? 1 : -1 });
    rounds.push({ label: 'CFP quarterfinal', site: 0 }, { label: 'CFP semifinal', site: 0 }, { label: 'National championship', site: 0 });
    for (const rd of rounds) {
      const o = take(() => true); const g = { o: o.id, neutral: rd.site === 0, home: rd.site === 1, label: rd.label };
      g.res = playGame(st.seed + '|' + rosterKey(st) + '|' + rd.label, me, o, rd.site); st.post.push(g);
      if (!g.res.w) break;
    }
    st.phase = 'done'; finishRun();
  }
  const TIERS = [
    [w => w.perfect, 'Neyland Immortals', 'Perfect season. National champions. Nobody touched you.'],
    [w => w.title, 'National Champions', 'Hoist it. The trophy is coming to Knoxville.'],
    [w => w.reached === 'National championship', 'Title game', 'One win from a national title.'],
    [w => w.reached === 'CFP semifinal', 'Final Four', 'A semifinal run against the best teams of the era.'],
    [w => w.reached && w.reached.startsWith('CFP'), 'Playoff team', 'You made the 12-team field.'],
    [w => w.wins >= 9, 'Bowl bound', 'A winning season against an all-time schedule.'],
    [w => w.wins >= 6, 'Bowl eligible', 'Six wins against legends is no small thing.'],
    [() => true, 'Rebuilding', 'This schedule is brutal. Spin again.'],
  ];
  function summary(st) {
    const all = st.games.concat(st.post || []);
    const wins = all.filter(g => g.res.w).length, losses = all.length - wins;
    const last = (st.post || []).slice(-1)[0];
    const title = !!(last && last.label === 'National championship' && last.res.w);
    const cfp = (st.post || []).filter(g => g.label.startsWith('CFP') || g.label === 'National championship');
    const reached = cfp.length ? cfp[cfp.length - 1].label : null;
    const secChamp = (st.post || []).some(g => g.label === 'SEC Championship' && g.res.w);
    const w = { wins, losses, title, perfect: title && losses === 0, reached, secChamp };
    const tier = TIERS.find(t => t[0](w)); w.tier = tier[1]; w.tierText = tier[2];
    return w;
  }
  function finishRun() {
    const st = RUN.st, s = summary(st), me = teamRatings(st);
    const sq = st.games.map(g => g.res.w ? '🟧' : '⬛').join('') + (st.post.length ? ' ' + st.post.map(g => g.res.w ? '🟧' : '⬛').join('') : '');
    st.share = `🏈 Checkerboard Run${st.daily ? ' ' + st.date : ''}: ${s.wins}-${s.losses} · ${s.tier}\n${sq}\nOFF ${Math.round(me.off)} · DEF ${Math.round(me.def)}\n${SITE}`;
    if (st.daily) store.set('run-daily-' + st.date, { final: JSON.parse(JSON.stringify(st)), share: st.share });
    const hist = store.get('run-stats', { played: 0, titles: 0, perfect: 0, best: null });
    hist.played++; if (s.title) hist.titles++; if (s.perfect) hist.perfect++;
    if (!hist.best || s.wins - s.losses > hist.best.w - hist.best.l) hist.best = { w: s.wins, l: s.losses, tier: s.tier };
    store.set('run-stats', hist);
  }
  function runResults(body, fromSave) {
    const st = RUN.st;
    // saved runs come back as plain JSON: re-link players
    st.slots.forEach(s => { if (s.p && !s.p.st) s.p = BYNAME[s.p.n.toLowerCase()] || s.p; });
    const s = summary(st), me = teamRatings(st), hist = store.get('run-stats', { played: 0, titles: 0, perfect: 0 });
    const dsv = store.get('run-daily-' + etDate(), null);
    body.innerHTML = `${modeBar(RUN.mode, !!(dsv && dsv.final))}
      <div class="box gfinal ${s.title ? 'champ' : ''}"><div class="eyebrow">${st.daily ? 'Daily challenge · ' + esc(st.date) : 'Free play'}</div>
        <h2>${s.wins}-${s.losses}</h2><div class="gtier">${esc(s.tier)}</div><p>${esc(s.tierText)}</p>
        ${(st.notes || []).map(n => `<p class="dim">${esc(n)}</p>`).join('')}
        ${st.seed12 ? `<p class="dim">Playoff seed: No. ${st.seed12}${s.secChamp ? ' · SEC champions' : ''}</p>` : ''}
        <div class="grow"><button class="btn primary" id="runShare">Copy result</button> <button class="btn" id="runAgain">${st.daily ? 'Free play' : 'Play again'}</button></div>
        <p class="dim small">Your runs: ${hist.played} played · ${hist.titles} titles · ${hist.perfect} perfect</p></div>
      <div class="grid g2"><div class="box gteam"><div class="eyebrow">Your Vols · OFF ${Math.round(me.off)} · DEF ${Math.round(me.def)}</div>${slotBoard(st, true)}</div>
        <div class="box gsched"><h3>Season</h3><ol class="glist">${st.games.map(g => gameRow(g, true)).join('')}${(st.post || []).map(g => gameRow(g, true, g.label)).join('')}</ol></div></div>`;
    bindMode(body, m => { RUN.mode = m; RUN.st = null; VI_RENDER_GAMES(); });
    body.querySelector('#runShare').addEventListener('click', e => copyText(st.share || '', e.currentTarget));
    body.querySelector('#runAgain').addEventListener('click', () => { RUN.mode = 'free'; RUN.st = null; VI_RENDER_GAMES(); });
  }

  /* =====================================================================================
     VOL GUESSER
     ===================================================================================== */
  const GUESS_MAX = 8;
  const GS = { mode: 'daily', st: null };
  const draftRd = p => p.draft ? (p.draft[1] === 0 ? 'UDFA' : 'Rd ' + p.draft[1]) : '—';
  const honLevel = p => { const h = p.honAll || []; return h.some(x => /^AA[uc1]$/.test(x)) ? 3 : h.includes('AA2') ? 2 : h.includes('SEC') ? 1 : 0; };
  const HON_LV = ['None', 'All-SEC', 'All-America (2nd/3rd)', 'All-American'];
  const POS_SIDE = s => ['QB', 'RB', 'WR', 'TE'].includes(s) ? 'O' : 'D';
  function renderGuesser(app) {
    const g = GAMES[1], today = etDate();
    const body = frame(app, g, '', 'Guess any Vol. Each guess shows how close you are. Orange is a match, light orange is close, arrows point to the answer.');
    const saved = store.get('guesser-daily-' + today, null);
    if (!GS.st || GS.st.mode !== GS.mode || (GS.mode === 'daily' && GS.st.date !== today)) {
      if (GS.mode === 'daily' && saved) GS.st = saved.state;
      else {
        const r = rngFrom(GS.mode === 'daily' ? 'guess-' + today : freeSeed());
        const cands = POOL.filter(p => p.ovr >= 82 || honLevel(p) >= 1);
        GS.st = { mode: GS.mode, date: today, ans: pick(r, cands).n, guesses: [], done: false };
      }
    }
    const st = GS.st, ans = BYNAME[st.ans.toLowerCase()];
    const cmpRow = p => {
      const c = (ok, near) => ok ? 'hit' : near ? 'near' : '';
      const arrow = (a, b) => a === b ? '' : (b > a ? ' ↑' : ' ↓');
      const dA = ans.draft ? (ans.draft[1] || 8) : 9, dP = p.draft ? (p.draft[1] || 8) : 9;
      return `<tr><th scope="row" class="${p.n === ans.n ? 'hit' : ''}">${esc(p.n)}</th>
        <td class="${c(p.slot === ans.slot, POS_SIDE(p.slot) === POS_SIDE(ans.slot))}">${p.slot === 'DL' ? 'DT' : p.slot}</td>
        <td class="${c(p.y === ans.y, Math.abs(p.y - ans.y) <= 3)}">${p.y}${arrow(p.y, ans.y)}</td>
        <td class="${c(p.coach === ans.coach, false)}">${esc(p.coach.split(' ').pop())}</td>
        <td class="${c(honLevel(p) === honLevel(ans), Math.abs(honLevel(p) - honLevel(ans)) === 1)}">${HON_LV[honLevel(p)]}${arrow(honLevel(p), honLevel(ans))}</td>
        <td class="${c(dP === dA, Math.abs(dP - dA) === 1)}">${draftRd(p)}${dP === dA ? '' : (dA < dP ? ' ↑' : ' ↓')}</td></tr>`;
    };
    const won = st.guesses.includes(ans.n);
    body.innerHTML = `${modeBar(GS.mode, !!(saved && saved.state.done))}
      <div class="box gguess">
        <div class="gguess-top"><div class="eyebrow">Guess ${Math.min(st.guesses.length + 1, GUESS_MAX)} of ${GUESS_MAX}</div>
          ${st.done ? '' : '<div id="gsrch"></div>'}</div>
        ${st.done ? `<div class="greveal ${won ? 'win' : ''}"><div class="eyebrow">${won ? 'Got him in ' + st.guesses.length : 'The answer'}</div><h3>${esc(ans.n)}</h3>
          <p>${esc(SLOT_NAME[ans.slot])} · best season ${ans.y} · ${esc(statLine(ans))}</p><p>${honorChips(ans.honAll, 4)}</p>
          <div class="grow"><button class="btn primary" id="gShare">Copy result</button> <button class="btn" id="gNew">New player (free play)</button></div></div>` : ''}
        <div class="gtable-wrap"><table class="gtable"><thead><tr><th>Player</th><th>Pos</th><th>Prime</th><th>Coach</th><th>Honors</th><th>Draft</th></tr></thead>
          <tbody>${st.guesses.slice().reverse().map(n => cmpRow(BYNAME[n.toLowerCase()])).join('') || '<tr><td colspan="6" class="dim">Start typing a name. Any Vol from 1980 to today.</td></tr>'}</tbody></table></div>
        ${!st.done && st.guesses.length >= 5 ? `<p class="ghint">Hint: his initials are <b>${esc(ans.n.split(' ').map(w => w[0]).join('.'))}.</b></p>` : ''}
      </div>
      <p class="dim small">Prime = the player's best season at Tennessee. Coach = head coach that season. Draft arrows point toward the answer's round (↑ earlier).</p>`;
    bindMode(body, m => { GS.mode = m; GS.st = null; VI_RENDER_GAMES(); });
    if (!st.done) searchBox(body.querySelector('#gsrch'), ALL.map(p => p.n).filter(n => !st.guesses.includes(n)).sort(), n => {
      st.guesses.push(n);
      if (n === ans.n || st.guesses.length >= GUESS_MAX) {
        st.done = true;
        const won = n === ans.n;
        st.share = `🔎 Vol Guesser${st.mode === 'daily' ? ' ' + st.date : ''}: ${won ? st.guesses.length + '/' + GUESS_MAX : 'X/' + GUESS_MAX}\n${st.guesses.map(x => x === ans.n ? '🟧' : '⬛').join('')}\n${SITE}`;
      }
      if (st.mode === 'daily') store.set('guesser-daily-' + st.date, { state: st, share: st.share });
      VI_RENDER_GAMES();
      const i = document.querySelector('#gsrch input'); if (i) i.focus();
    }, 'Guess a Vol');
    const sh = body.querySelector('#gShare'); if (sh) sh.addEventListener('click', e => copyText(st.share, e.currentTarget));
    const nw = body.querySelector('#gNew'); if (nw) nw.addEventListener('click', () => { GS.mode = 'free'; GS.st = null; VI_RENDER_GAMES(); });
  }

  /* =====================================================================================
     POWER T GRID
     ===================================================================================== */
  const CAT = {
    QB: { l: 'Quarterback', f: p => p.slot === 'QB', t: 'pos' }, RB: { l: 'Running back', f: p => p.slot === 'RB', t: 'pos' },
    WRTE: { l: 'Receiver (WR/TE)', f: p => p.slot === 'WR' || p.slot === 'TE', t: 'pos' }, DLINE: { l: 'Defensive line', f: p => p.slot === 'DL' || p.slot === 'EDGE', t: 'pos' },
    LB: { l: 'Linebacker', f: p => p.slot === 'LB', t: 'pos' }, DB: { l: 'Defensive back', f: p => p.slot === 'CB' || p.slot === 'S', t: 'pos' },
    E80: { l: 'Played in the 1980s', f: p => p.yrs.some(y => y < 1990), t: 'era' }, E90: { l: 'Played in the 1990s', f: p => p.yrs.some(y => y >= 1990 && y < 2000), t: 'era' },
    E00: { l: 'Played in the 2000s', f: p => p.yrs.some(y => y >= 2000 && y < 2010), t: 'era' }, E10: { l: 'Played in the 2010s', f: p => p.yrs.some(y => y >= 2010 && y < 2020), t: 'era' },
    E20: { l: 'Played in the 2020s', f: p => p.yrs.some(y => y >= 2020), t: 'era' },
    MAJ: { l: 'Played for Johnny Majors', f: p => p.yrs.some(y => y <= 1992), t: 'era' }, FUL: { l: 'Played for Phillip Fulmer', f: p => p.yrs.some(y => y >= 1993 && y <= 2008), t: 'era' },
    BJ: { l: 'Played for Butch Jones', f: p => p.yrs.some(y => y >= 2013 && y <= 2017), t: 'era' }, HEU: { l: 'Played for Josh Heupel', f: p => p.yrs.some(y => y >= 2021), t: 'era' },
    AA: { l: 'First-team All-American', f: p => p.fl.includes('aa'), t: 'ach' }, SEC: { l: 'First-team All-SEC', f: p => p.fl.includes('sec'), t: 'ach' },
    R1: { l: 'NFL first-round pick', f: p => p.fl.includes('r1'), t: 'ach' }, DR: { l: 'Drafted into the NFL', f: p => p.fl.includes('drafted'), t: 'ach' },
    K1: { l: '1,000-yard season', f: p => p.fl.includes('k1000'), t: 'ach' }, TD12: { l: '12+ rush/rec TD season', f: p => p.fl.includes('td12'), t: 'ach' },
    T100: { l: '100-tackle season', f: p => p.fl.includes('t100'), t: 'ach' }, S10: { l: '10-sack season', f: p => p.fl.includes('s10'), t: 'ach' },
    I5: { l: '5-INT season', f: p => p.fl.includes('i5'), t: 'ach' },
  };
  const GR = { mode: 'daily', st: null };
  function makeGrid(r) {
    const keys = Object.keys(CAT);
    for (let tries = 0; tries < 4000; tries++) {
      const rows = shuffle(r, keys.filter(k => CAT[k].t !== 'era')).slice(0, 3);
      const cols = shuffle(r, keys.filter(k => CAT[k].t !== 'pos' && !rows.includes(k))).slice(0, 3);
      if (rows.filter(k => CAT[k].t === 'pos').length < 1 || cols.filter(k => CAT[k].t === 'era').length < 1) continue;
      const cells = []; let ok = true;
      for (const a of rows) for (const b of cols) { const n = ALL.filter(p => CAT[a].f(p) && CAT[b].f(p)).length; if (n < 2) { ok = false; break; } cells.push(n); if (!ok) break; }
      if (ok) return { rows, cols };
    }
    return { rows: ['QB', 'RB', 'WRTE'], cols: ['E90', 'E00', 'SEC'] };
  }
  function renderGrid(app) {
    const g = GAMES[2], today = etDate();
    const body = frame(app, g, '', 'Pick a square, then name a Vol who fits both its row and its column. Nine guesses. Each player counts once.');
    const saved = store.get('grid-daily-' + today, null);
    if (!GR.st || GR.st.mode !== GR.mode || (GR.mode === 'daily' && GR.st.date !== today)) {
      if (GR.mode === 'daily' && saved) GR.st = saved.state;
      else { const r = rngFrom(GR.mode === 'daily' ? 'grid-' + today : freeSeed()); GR.st = Object.assign({ mode: GR.mode, date: today, cells: Array(9).fill(null), left: 9, used: [], sel: null, done: false }, makeGrid(r)); }
    }
    const st = GR.st;
    const head = k => `<div class="gt-h">${esc(CAT[k].l)}</div>`;
    const cell = (i) => {
      const v = st.cells[i], row = Math.floor(i / 3), col = i % 3, t = row === 0 || col === 1;
      if (v) return `<div class="gt-c ok ${t ? 't' : ''}"><b>${esc(v)}</b></div>`;
      if (st.done) { const a = answers(i); return `<div class="gt-c miss ${t ? 't' : ''}"><span class="dim small">${a.length} possible${a.length ? ': ' + esc(a.slice(0, 2).join(', ')) : ''}</span></div>`; }
      return `<button class="gt-c ${t ? 't' : ''} ${st.sel === i ? 'sel' : ''}" data-i="${i}" aria-label="${esc(CAT[st.rows[row]].l + ' and ' + CAT[st.cols[col]].l)}"></button>`;
    };
    const answers = i => ALL.filter(p => CAT[st.rows[Math.floor(i / 3)]].f(p) && CAT[st.cols[i % 3]].f(p) && !st.used.includes(p.n)).map(p => p.n);
    const score = st.cells.filter(Boolean).length;
    body.innerHTML = `${modeBar(GR.mode, !!(saved && saved.state.done))}
      <div class="box ggrid-box">
        <div class="ggrid-top"><div class="eyebrow">${st.done ? 'Final: ' + score + '/9' : 'Guesses left: ' + st.left}</div>${!st.done ? '<button class="glink" id="gGive">Give up</button>' : ''}</div>
        <div class="ggrid"><div class="gt-corner" aria-hidden="true"><span>T</span></div>${st.cols.map(head).join('')}
          ${[0, 1, 2].map(r => head(st.rows[r]) + [0, 1, 2].map(c => cell(r * 3 + c)).join('')).join('')}</div>
        ${!st.done ? `<div class="ggrid-in">${st.sel === null ? '<p class="dim">Tap a square to start.</p>' : `<p><b>${esc(CAT[st.rows[Math.floor(st.sel / 3)]].l)}</b> + <b>${esc(CAT[st.cols[st.sel % 3]].l)}</b></p><div id="gsrch"></div><p class="gmsg" id="gmsg" role="status"></p>`}</div>` : `<div class="grow"><button class="btn primary" id="gShare">Copy result</button> <button class="btn" id="gNew">New grid (free play)</button></div>`}
      </div>
      <p class="dim small">"Played in" and coach squares count every season we have for a player. Honors and draft come from the UT record book.</p>`;
    bindMode(body, m => { GR.mode = m; GR.st = null; VI_RENDER_GAMES(); });
    body.querySelectorAll('button.gt-c').forEach(b => b.addEventListener('click', () => { st.sel = +b.dataset.i; VI_RENDER_GAMES(); const i = document.querySelector('#gsrch input'); if (i) i.focus(); }));
    const save = () => { if (st.mode === 'daily') store.set('grid-daily-' + st.date, { state: st, share: st.share }); };
    const finish = () => {
      st.done = true; st.sel = null;
      const sq = [0, 1, 2].map(r => [0, 1, 2].map(c => st.cells[r * 3 + c] ? '🟧' : '⬜').join('')).join('\n');
      st.share = `🟧 Power T Grid${st.mode === 'daily' ? ' ' + st.date : ''}: ${st.cells.filter(Boolean).length}/9\n${sq}\n${SITE}`; save();
    };
    if (st.sel !== null && !st.done) searchBox(body.querySelector('#gsrch'), ALL.map(p => p.n).filter(n => !st.used.includes(n)).sort(), n => {
      const p = BYNAME[n.toLowerCase()], i = st.sel, ok = CAT[st.rows[Math.floor(i / 3)]].f(p) && CAT[st.cols[i % 3]].f(p);
      st.left--;
      if (ok) { st.cells[i] = p.n; st.used.push(p.n); st.sel = null; }
      if (!st.left || st.cells.every(Boolean)) finish(); else save();
      VI_RENDER_GAMES();
      if (!ok && !st.done) { const m = document.getElementById('gmsg'); if (m) m.textContent = `${n} doesn't fit that square. ${st.left} guesses left.`; const inp = document.querySelector('#gsrch input'); if (inp) inp.focus(); }
    }, 'Name a Vol');
    const gv = body.querySelector('#gGive'); if (gv) gv.addEventListener('click', () => { if (confirm('End this grid and see the answers?')) { finish(); VI_RENDER_GAMES(); } });
    const sh = body.querySelector('#gShare'); if (sh) sh.addEventListener('click', e => copyText(st.share, e.currentTarget));
    const nw = body.querySelector('#gNew'); if (nw) nw.addEventListener('click', () => { GR.mode = 'free'; GR.st = null; VI_RENDER_GAMES(); });
  }

  /* =====================================================================================
     VFL CAREER
     ===================================================================================== */
  const CR = { mode: 'daily', st: null };
  const CAREER_MAX = 6;
  function renderCareer(app) {
    const g = GAMES[3], today = etDate();
    const body = frame(app, g, '', 'Vol for Life. Name the former Vol from the NFL teams he played for, in order. Each wrong guess unlocks a clue.');
    const saved = store.get('career-daily-' + today, null);
    if (!CR.st || CR.st.mode !== CR.mode || (CR.mode === 'daily' && CR.st.date !== today)) {
      if (CR.mode === 'daily' && saved) CR.st = saved.state;
      else { const r = rngFrom(CR.mode === 'daily' ? 'career-' + today : freeSeed()); CR.st = { mode: CR.mode, date: today, ans: pick(r, D.careers).n, guesses: [], done: false }; }
    }
    const st = CR.st, c = D.careers.find(x => x.n === st.ans), p = BYNAME[c.n.toLowerCase()];
    const posName = { QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end', OL: 'Offensive line', DL: 'Defensive tackle', EDGE: 'Defensive end', LB: 'Linebacker', CB: 'Cornerback', S: 'Safety' }[c.pos];
    const dr = c.draft.rd === 0 ? `Undrafted free agent (${c.draft.y})` : `${c.draft.y} NFL Draft, round ${c.draft.rd}${c.draft.pick ? ', pick ' + c.draft.pick : ''}`;
    const clues = [
      ['At Tennessee', c.ut],
      ['Position', posName],
      ['NFL Draft', dr],
      ['Best UT season', p ? `${p.y}: ${statLine(p)}` : 'Lineman, no stat line'],
      ['Initials', c.n.split(' ').map(w => w[0]).join('.') + '.'],
    ];
    const misses = st.guesses.filter(x => x !== c.n).length, won = st.guesses.includes(c.n);
    const shown = st.done ? clues.length : Math.min(misses, clues.length);
    body.innerHTML = `${modeBar(CR.mode, !!(saved && saved.state.done))}
      <div class="box gcareer">
        <div class="eyebrow">NFL career${c.teams.length > 1 ? ' · ' + c.teams.length + ' teams' : ''}</div>
        <div class="gteams">${c.teams.map((t, i) => `<span class="gteam-chip"><i>${i + 1}</i>${esc(t)}</span>`).join('<span class="garr" aria-hidden="true">→</span>')}</div>
        <dl class="gclues">${clues.map((cl, i) => i < shown ? `<div><dt>${esc(cl[0])}</dt><dd>${esc(cl[1])}</dd></div>` : `<div class="locked"><dt>${esc(cl[0])}</dt><dd>Unlocks after ${i + 1} miss${i ? 'es' : ''}</dd></div>`).join('')}</dl>
        ${st.done ? `<div class="greveal ${won ? 'win' : ''}"><div class="eyebrow">${won ? 'Correct in ' + st.guesses.length : 'The answer'}</div><h3>${esc(c.n)}</h3>
          <div class="grow"><button class="btn primary" id="gShare">Copy result</button> <button class="btn" id="gNew">Another career (free play)</button></div></div>`
        : `<div class="eyebrow">Guess ${st.guesses.length + 1} of ${CAREER_MAX}</div><div id="gsrch"></div>`}
        ${st.guesses.length ? `<ul class="gmisses">${st.guesses.map(x => `<li class="${x === c.n ? 'hit' : ''}">${esc(x)}</li>`).join('')}</ul>` : ''}
      </div>
      <p class="dim small">NFL teams from the UT record book's "Vols in Pro Football", using today's team names (Washington is listed as the Commanders).</p>`;
    bindMode(body, m => { CR.mode = m; CR.st = null; VI_RENDER_GAMES(); });
    const names = Array.from(new Set(D.careers.map(x => x.n).concat(ALL.map(x => x.n)))).sort();
    if (!st.done) searchBox(body.querySelector('#gsrch'), names.filter(n => !st.guesses.includes(n)), n => {
      st.guesses.push(n);
      if (n === c.n || st.guesses.length >= CAREER_MAX) {
        st.done = true; const w = n === c.n;
        st.share = `🏟️ VFL Career${st.mode === 'daily' ? ' ' + st.date : ''}: ${w ? st.guesses.length + '/' + CAREER_MAX : 'X/' + CAREER_MAX}\n${st.guesses.map(x => x === c.n ? '🟧' : '⬛').join('')}\n${SITE}`;
      }
      if (st.mode === 'daily') store.set('career-daily-' + st.date, { state: st, share: st.share });
      VI_RENDER_GAMES(); const i = document.querySelector('#gsrch input'); if (i) i.focus();
    }, 'Name the VFL');
    const sh = body.querySelector('#gShare'); if (sh) sh.addEventListener('click', e => copyText(st.share, e.currentTarget));
    const nw = body.querySelector('#gNew'); if (nw) nw.addEventListener('click', () => { CR.mode = 'free'; CR.st = null; VI_RENDER_GAMES(); });
  }

  /* =====================================================================================
     ROCKY TOP RANKINGS
     ===================================================================================== */
  const RK_CATS = [
    { k: 'yds', l: 'Passing yards', slots: ['QB'] }, { k: 'td', l: 'Passing touchdowns', slots: ['QB'] },
    { k: 'ryds', l: 'Rushing yards', slots: ['RB', 'QB'] }, { k: 'rtd', l: 'Rushing touchdowns', slots: ['RB', 'QB'] },
    { k: 'cyds', l: 'Receiving yards', slots: ['WR', 'TE', 'RB'] }, { k: 'rec', l: 'Receptions', slots: ['WR', 'TE', 'RB'] },
    { k: 'ctd', l: 'Receiving touchdowns', slots: ['WR', 'TE'] }, { k: 'tot', l: 'Tackles', slots: ['LB', 'S', 'CB', 'DL', 'EDGE'] },
    { k: 'sk', l: 'Sacks', slots: ['EDGE', 'DL', 'LB'] }, { k: 'ints', l: 'Interceptions', slots: ['S', 'CB', 'LB'] },
  ];
  const RK_TRIES = 3;
  const RK = { mode: 'daily', st: null };
  function makeRanking(r) {
    for (let t = 0; t < 500; t++) {
      const cat = pick(r, RK_CATS);
      const minv = { yds: 1200, td: 8, ryds: 400, rtd: 4, cyds: 350, rec: 25, ctd: 3, tot: 50, sk: 3, ints: 2 }[cat.k];
      const rows = shuffle(r, D.seasons.filter(s => cat.slots.includes(s.slot) && (s.st[cat.k] || 0) >= minv));
      const chosen = [], vals = new Set();
      for (const s of rows) { const v = s.st[cat.k]; if (vals.has(v) || chosen.some(c => c.n === s.n)) continue; chosen.push(s); vals.add(v); if (chosen.length === 5) break; }
      if (chosen.length === 5) return { cat: cat.k, items: chosen.map(s => ({ n: s.n, y: s.y, slot: s.slot, v: s.st[cat.k] })) };
    }
  }
  function renderRankings(app) {
    const g = GAMES[4], today = etDate();
    const body = frame(app, g, '', 'Order these five Tennessee seasons from most to least. Use the arrows to move a row. Correct spots lock in orange.');
    const saved = store.get('rankings-daily-' + today, null);
    if (!RK.st || RK.st.mode !== RK.mode || (RK.mode === 'daily' && RK.st.date !== today)) {
      if (RK.mode === 'daily' && saved) RK.st = saved.state;
      else { const r = rngFrom(RK.mode === 'daily' ? 'rank-' + today : freeSeed()); const z = makeRanking(r); RK.st = { mode: RK.mode, date: today, cat: z.cat, items: z.items, order: shuffle(r, [0, 1, 2, 3, 4]), locked: [], tries: 0, done: false, hist: [] }; }
    }
    const st = RK.st, cat = RK_CATS.find(c => c.k === st.cat);
    const correct = st.items.map((x, i) => i).sort((a, b) => st.items[b].v - st.items[a].v);
    body.innerHTML = `${modeBar(RK.mode, !!(saved && saved.state.done))}
      <div class="box grank">
        <div class="grank-top"><div><div class="eyebrow">Most to least</div><h3>${esc(cat.l)} in a season</h3></div><div class="eyebrow">Try ${Math.min(st.tries + 1, RK_TRIES)} of ${RK_TRIES}</div></div>
        <ol class="grank-list">${st.order.map((idx, pos) => {
          const it = st.items[idx], lock = st.locked.includes(pos) || st.done, right = correct[pos] === idx;
          return `<li class="${st.done ? (st.solved ? 'ok' : 'rev') : lock && right ? 'ok' : ''}"><span class="grank-n">${pos + 1}</span><span class="grank-p"><b>${esc(it.n)}</b><span class="dim">${it.y} · ${it.slot === 'DL' ? 'DT' : it.slot}</span></span>
            ${st.done ? `<span class="grank-v">${fmt(it.v)}</span>` : (st.locked.includes(pos) ? '<span class="grank-v">🔒</span>' : `<span class="grank-mv"><button data-mv="${pos}" data-d="-1" aria-label="Move up" ${pos === 0 ? 'disabled' : ''}>▲</button><button data-mv="${pos}" data-d="1" aria-label="Move down" ${pos === 4 ? 'disabled' : ''}>▼</button></span>`)}</li>`;
        }).join('')}</ol>
        ${st.done ? `<p class="gtier">${st.solved ? (st.tries === 1 ? 'Perfect on the first try.' : 'Solved in ' + st.tries + '.') : 'Out of tries. Here is the right order.'}</p>
          <div class="grow"><button class="btn primary" id="gShare">Copy result</button> <button class="btn" id="gNew">New ranking (free play)</button></div>`
        : `<div class="grow"><button class="btn primary big" id="rkGo">Lock it in</button></div>`}
      </div>
      <p class="dim small">Seasons 2004 on use full box-score stats; earlier seasons come from the UT record book's year-by-year leaders.</p>`;
    bindMode(body, m => { RK.mode = m; RK.st = null; VI_RENDER_GAMES(); });
    body.querySelectorAll('[data-mv]').forEach(b => b.addEventListener('click', () => {
      const a = +b.dataset.mv; let t = a + (+b.dataset.d);
      while (t >= 0 && t < 5 && st.locked.includes(t)) t += +b.dataset.d;   // skip over locked rows
      if (t < 0 || t > 4) return;
      [st.order[a], st.order[t]] = [st.order[t], st.order[a]]; VI_RENDER_GAMES();
    }));
    const go = body.querySelector('#rkGo');
    if (go) go.addEventListener('click', () => {
      st.tries++;
      const row = st.order.map((idx, pos) => correct[pos] === idx);
      st.locked = row.map((ok, i) => ok ? i : -1).filter(i => i >= 0);
      st.hist.push(row.map(ok => ok ? '🟧' : '⬛').join(''));
      if (st.locked.length === 5 || st.tries >= RK_TRIES) {
        st.done = true;
        st.share = `📊 Rocky Top Rankings${st.mode === 'daily' ? ' ' + st.date : ''}: ${st.locked.length === 5 ? st.tries + '/' + RK_TRIES : 'X/' + RK_TRIES} · ${cat.l}\n${st.hist.join('\n')}\n${SITE}`;
        st.solved = st.locked.length === 5; st.order = correct.slice();
      }
      if (st.mode === 'daily') store.set('rankings-daily-' + st.date, { state: st, share: st.share });
      VI_RENDER_GAMES();
    });
    const sh = body.querySelector('#gShare'); if (sh) sh.addEventListener('click', e => copyText(st.share, e.currentTarget));
    const nw = body.querySelector('#gNew'); if (nw) nw.addEventListener('click', () => { RK.mode = 'free'; RK.st = null; VI_RENDER_GAMES(); });
  }

  /* ---------- entry ---------- */
  let lastApp = null, lastTab = null;
  function VI_RENDER_GAMES() { if (lastApp) render(lastApp, lastTab, true); }
  function render(app, tab, keepScroll) {
    lastApp = app; lastTab = tab;
    const y = window.scrollY;
    if (!window.VI_GAMES_DATA) { app.innerHTML = '<div class="wrap hub-hero"><div class="eyebrow">Games</div><h1>Loading…</h1></div>'; return loadData(() => render(app, tab)); }
    initData();
    if (tab === 'run') renderRun(app);
    else if (tab === 'guesser') renderGuesser(app);
    else if (tab === 'grid') renderGrid(app);
    else if (tab === 'career') renderCareer(app);
    else if (tab === 'rankings') renderRankings(app);
    else renderHub(app);
    if (keepScroll) window.scrollTo(0, y);
  }
  window.renderGames = (app, tab) => render(app, tab, false);
})();
