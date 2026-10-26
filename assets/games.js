/* The Vol Index — Games.
   Football (data/games-data.js, written by tools/build_games.py):
     · 16-0               draft ten Vols, play a 12-game season, the SEC title game and the 12-team playoff (assets/games-run.js)
     · Vol Guesser        find the mystery Vol from position, era, coach, honors and draft clues
     · Power T Grid       fill a 3x3 grid with Vols who fit the row and the column
     · VFL Career         name the Vol from his college path and NFL teams
     · Rocky Top Rankings put five Vol seasons in order of a stat
     · Vol Trivia         ten questions, easy / medium / hard
   Beta sports (data/games-<sport>.js): Guesser, Rankings and Trivia for basketball, baseball and softball;
   Rankings and Trivia for volleyball and soccer.
   Every game has a daily challenge (same for everyone, new at midnight Eastern) and free play with era filters.
   Results stay in this browser (localStorage). Nothing is sent anywhere. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const etDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const SITE = 'volindex.net/games';
  const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- seeded random ---------- */
  function hashStr(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; }; }
  function rngFrom(seed) { let a = hashStr(String(seed))(); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const freeSeed = () => Math.random().toString(36).slice(2, 9);   // short, so it fits in a challenge link
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function wpick(r, arr, w) { const ws = arr.map(w), t = ws.reduce((a, b) => a + b, 0); let x = r() * t; for (let i = 0; i < arr.length; i++) { x -= ws[i]; if (x <= 0) return arr[i]; } return arr[arr.length - 1]; }
  function wsample(r, arr, n, w) { const pool = arr.slice(), out = []; while (out.length < n && pool.length) { const p = wpick(r, pool, w); out.push(p); pool.splice(pool.indexOf(p), 1); } return out; }
  // newer eras get a light boost: 2020s x1.25, 2010s x1.12
  const ERA_BOOST = d => d >= 2020 ? 1.25 : d >= 2010 ? 1.12 : 1;
  const decOf = y => Math.floor(y / 10) * 10;
  const slug = n => (window.VI_SLUG ? window.VI_SLUG(n) : String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-'));

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
  // two-tap confirm instead of a browser dialog
  function twoTap(btn, label, fn) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (btn.dataset.armed) return fn();
      btn.dataset.armed = '1'; const o = btn.textContent; btn.textContent = label;
      setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = o; } }, 3000);
    });
  }

  /* ---------- sports + games ---------- */
  const SPORTS = [
    { key: 'football', name: 'Football', icon: '🏈', file: 'data/games-data.js', games: ['dynasty', 'run', 'guesser', 'grid', 'career', 'rankings', 'duel', 'trivia'] },
    { key: 'mbb', name: "Men's Basketball", icon: '🏀', beta: true, file: 'data/games-mbb.js', games: ['dynasty', 'run', 'guesser', 'rankings', 'duel', 'trivia'] },
    { key: 'wbb', name: "Women's Basketball", icon: '🏀', beta: true, file: 'data/games-wbb.js', games: ['dynasty', 'run', 'guesser', 'rankings', 'duel', 'trivia'], lady: true },
    { key: 'baseball', name: 'Baseball', icon: '⚾', beta: true, file: 'data/games-baseball.js', games: ['dynasty', 'run', 'guesser', 'rankings', 'duel', 'trivia'] },
    { key: 'softball', name: 'Softball', icon: '🥎', beta: true, file: 'data/games-softball.js', games: ['dynasty', 'run', 'guesser', 'rankings', 'duel', 'trivia'] },
    { key: 'volleyball', name: 'Volleyball', icon: '🏐', beta: true, file: 'data/games-volleyball.js', games: ['guesser', 'rankings', 'duel', 'trivia'] },
    { key: 'soccer', name: 'Soccer', icon: '⚽', beta: true, file: 'data/games-soccer.js', games: ['guesser', 'rankings', 'duel', 'trivia'] },
  ];
  const SP = k => SPORTS.find(s => s.key === k);
  const GAME_ICON = { dynasty: '🏟️', run: '🏈', guesser: '🔎', grid: '🟧', career: '🏟️', rankings: '📊', duel: '↕️', trivia: '❓' };
  // the undefeated-run game is named for a perfect season in that sport: 16-0 football, 40-0 basketball
  // (31 regular season + 3 SEC tournament + 6 NCAA), 69-0 baseball and softball (56 + 3 SEC + 3 regional + 2 super + 3 CWS + 2 finals)
  const RUN_NAME = { football: '16-0', mbb: '40-0', wbb: '40-0', baseball: '69-0', softball: '69-0' };
  const RUN_ICON = { football: '🏈', mbb: '🏀', wbb: '🏀', baseball: '⚾', softball: '🥎' };
  const gIcon = (sport, g) => g === 'run' ? RUN_ICON[sport] : GAME_ICON[g];
  function gameName(sport, g) {
    const v = SP(sport).lady ? 'Lady Vol' : 'Vol';
    return { dynasty: { football: 'Vol Dynasty', mbb: 'Vol Hoops Dynasty', wbb: 'Lady Vols Dynasty', baseball: 'Vol Diamond Dynasty', softball: 'Lady Vols Softball Dynasty' }[sport], run: RUN_NAME[sport], guesser: v + ' Guesser', grid: 'Power T Grid', career: 'VFL Career', rankings: 'Rocky Top Rankings', duel: 'Higher or Lower', trivia: v + ' Trivia' }[g];
  }
  function gameBlurb(sport, g) {
    const fb = sport === 'football';
    return {
      dynasty: fb ? 'Take over Tennessee with the real 2026 roster. Call the plays in a live, animated sim, recruit the real 2027 class and beyond, manage NIL and the portal, and chase the playoff for as many seasons as you want.'
        : sport === 'mbb' || sport === 'wbb' ? `Take over ${SP(sport).lady ? 'the Lady Vols' : 'Tennessee'} with the real 2026-27 roster and schedule. Coach every possession on a live court, recruit, work the portal and NIL, and chase the SEC title and March Madness, season after season.`
        : `Take over Tennessee ${sport} with the real 2027 roster and schedule. Manage every at-bat on a live diamond, recruit, work the portal and NIL, and chase ${sport === 'softball' ? 'Oklahoma City' : 'Omaha'}, season after season.`,
      run: fb ? 'Spin an era, draft five Vols on offense and five on defense at their best, then play 12 games against all-time great teams. Win the SEC and run the 12-team playoff.'
        : sport === 'mbb' || sport === 'wbb' ? `Spin an era and draft a starting five plus a sixth ${SP(sport).lady ? 'Lady Vol' : 'man'} at their best season. Play a 31-game schedule of real Tennessee opponents, the SEC Tournament and the 64-team NCAA Tournament.`
        : `Spin an era and draft a lineup and a pitching staff at their best season. Play a 56-game schedule of real Tennessee opponents, the SEC Tournament, regionals, super regionals and the ${sport === 'softball' ? "Women's " : ''}College World Series.`,
      guesser: fb ? 'Find the mystery Vol. Every guess shows how close you are on position, prime season, head coach, honors and NFL draft.'
        : 'Find the mystery player. Every guess shows how close you are on position, best season, coach, hometown and a key stat.',
      grid: 'Fill a 3×3 grid with Vols who fit both the row and the column. Nine guesses, no repeats.',
      career: 'Name the Vol for Life from his path: where he started, Tennessee, then every NFL team he played for.',
      rankings: 'Put five Tennessee seasons in order of a stat. Correct spots lock in orange. Three tries.',
      duel: 'Two Tennessee seasons, one stat. Did the second player finish higher or lower? Build the longest streak you can.',
      trivia: 'Ten questions on Tennessee ' + (fb ? 'football' : SP(sport).name.toLowerCase()) + '. Pick easy, medium, hard or a mix.',
    }[g];
  }
  // daily keys: football keeps the short form, other sports are prefixed
  const dkey = (sport, g, date) => (sport === 'football' ? '' : sport + '-') + g + '-daily-' + (date || etDate());
  const dailyDone = (sport, g) => { const sv = store.get(dkey(sport, g), null); return !!(sv && (sv.final || (sv.state && sv.state.done))); };

  /* ---------- data ---------- */
  let D = null, ALL = [], POOL = [], STARS = [], BYNAME = {};
  const SDATA = {};
  function loadScript(src, ready, cb, fail) {
    if (ready()) return cb();
    let s = document.querySelector(`script[data-g="${src}"]`);
    if (!s) { s = document.createElement('script'); s.src = src; s.dataset.g = src; document.head.appendChild(s); }
    s.addEventListener('load', cb, { once: true });
    s.addEventListener('error', fail, { once: true });
  }
  function initFootball() {
    if (D) return; D = window.VI_GAMES_DATA;
    ALL = D.players; POOL = ALL.filter(p => p.pool); STARS = ALL.filter(p => p.star);
    ALL.forEach(p => { BYNAME[p.n.toLowerCase()] = p; p.dec = decOf(p.y); });
  }
  function initSport(k) {
    if (SDATA[k]) return SDATA[k];
    const S = window.VI_GAMES_SPORT[k];
    S.by = {}; S.players.forEach(p => { S.by[p.n.toLowerCase()] = p; p.dec = decOf(p.y); });
    S.rows.forEach(r => { r.dec = decOf(r.y); });
    return (SDATA[k] = S);
  }
  const FB_ERAS = [1980, 1990, 2000, 2010, 2020];
  function sportEras(k) {
    if (k === 'football') return FB_ERAS;
    const S = SDATA[k]; return Array.from(new Set(S.rows.map(r => r.dec))).sort();
  }
  const SET = store.get('settings', {});
  function getEras(k) { const all = sportEras(k), s = (SET[k] && SET[k].eras || []).filter(e => all.includes(e)); return s.length ? s : all.slice(); }
  function setEras(k, eras) { SET[k] = Object.assign({}, SET[k], { eras }); store.set('settings', SET); }
  function getDiff(k) { return (SET[k] && SET[k].diff) || 'mix'; }
  function setDiff(k, d) { SET[k] = Object.assign({}, SET[k], { diff: d }); store.set('settings', SET); }
  const eraKey = k => getEras(k).join(',');

  /* ---------- football helpers ---------- */
  const SLOT_NAME = { QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end', DL: 'Defensive tackle', EDGE: 'Edge rusher', LB: 'Linebacker', CB: 'Cornerback', S: 'Safety' };
  const posLabel = s => s === 'DL' ? 'DT' : s;
  const HON_LABEL = { AAu: 'Unanimous All-American', AAc: 'Consensus All-American', AA1: 'All-American', AA2: 'All-America 2nd/3rd team', SEC: 'First-team All-SEC', SEC2: 'Second-team All-SEC', POY: 'SEC Player of the Year', OPOY: 'SEC Offensive POY', DPOY: 'SEC Defensive POY', H2: 'Heisman runner-up', H5: 'Heisman top 5', H8: 'Heisman top 10' };
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
  function honRank(h) { const i = ['AAu', 'AAc', 'W:', 'AA1', 'H2', 'POY', 'OPOY', 'DPOY', 'H5', 'AA2', 'SEC', 'F:', 'H8', 'SEC2'].findIndex(x => h.startsWith(x)); return i < 0 ? 99 : i; }
  const honorChips = (h, max = 3) => (h || []).slice().sort((a, b) => honRank(a) - honRank(b)).slice(0, max).map(x => `<span class="chip honor">${esc(honText(x))}</span>`).join('');
  const initials = n => n.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(/[ -]/).filter(Boolean).map(w => w[0]).join('.') + '.';

  /* ---------- sport helpers ---------- */
  const f3 = v => (v == null ? '—' : Number(v).toFixed(3).replace(/^0/, ''));
  const f2 = v => (v == null ? '—' : Number(v).toFixed(2));
  function keyStat(sport, p) {
    const s = p.st || {};
    if (sport === 'mbb' || sport === 'wbb') return { l: 'PPG', v: +((s.pts || 0) / (s.gp || 1)).toFixed(1), k: 'X' };
    if (sport === 'baseball' || sport === 'softball') return p.k === 'H' ? { l: 'AVG', v: s.avg, txt: f3(s.avg), k: 'H' } : { l: 'ERA', v: s.era, txt: f2(s.era), k: 'P', low: true };
    if (sport === 'volleyball') return { l: 'Kills/set', v: +((s.k || 0) / (s.sp || 1)).toFixed(2), k: 'X' };
    return p.k === 'GK' ? { l: 'GAA', v: s.gaa, txt: f2(s.gaa), k: 'GK', low: true } : { l: 'Points', v: s.pts || 0, k: 'F' };
  }
  const isPitcher = pos => /(^|\/)(R|L)?HP$|(^|\/)P$/.test(pos || '');
  function posNear(sport, a, b) {
    if (sport === 'baseball' || sport === 'softball') return isPitcher(a) === isPitcher(b);
    const ta = (a || '').split('/'), tb = (b || '').split('/');
    return ta.some(x => tb.includes(x));
  }

  /* ---------- autocomplete search box ---------- */
  function searchBox(el, names, onPick, placeholder) {
    el.innerHTML = `<div class="gsearch"><input type="text" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder || 'Type a player name')}" aria-label="${esc(placeholder || 'Player name')}"><ul role="listbox"></ul></div>`;
    const inp = el.querySelector('input'), ul = el.querySelector('ul'); let hits = [], sel = 0;
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '');
    const draw = () => { ul.innerHTML = hits.map((h, i) => `<li role="option" data-i="${i}" class="${i === sel ? 'on' : ''}">${esc(h)}</li>`).join(''); ul.hidden = !hits.length; };
    inp.addEventListener('input', () => {
      const q = norm(inp.value.trim());
      hits = q.length < 2 ? [] : names.filter(n => { const m = norm(n); return m.split(' ').some(w => w.startsWith(q)) || m.startsWith(q) || m.includes(q); }).slice(0, 8);
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
  const refocus = () => { const i = document.querySelector('#gsrch input'); if (i) i.focus({ preventScroll: true }); };

  /* ---------- shared page frame ---------- */
  function betaNote(sport) {
    const s = SP(sport);
    return s.beta ? `<div class="gbeta-note"><span class="gbeta">Beta</span> ${esc(s.name)} games are a work in progress. Expect rough edges while we add more seasons and more games. More are coming soon.</div>` : '';
  }
  function frame(app, sport, g, sub) {
    const s = SP(sport);
    app.innerHTML = `<div class="wrap games">
      <nav class="gcrumb"><a href="#games">Games</a> <span aria-hidden="true">›</span> <a href="#games-${sport}">${esc(s.name)}</a> <span aria-hidden="true">›</span> <b>${esc(gameName(sport, g))}</b></nav>
      <header class="ghead"><h1><span aria-hidden="true">${gIcon(sport, g)}</span> ${esc(gameName(sport, g))}${s.beta ? ' <span class="gbeta">Beta</span>' : ''}</h1>${sub ? `<p>${sub}</p>` : ''}</header>
      <div id="gbody"></div></div>`;
    return app.querySelector('#gbody');
  }
  function modeBar(mode, done) {
    return `<div class="gmode" role="tablist" aria-label="Game mode">
      <button role="tab" data-mode="daily" aria-selected="${mode === 'daily'}">Daily challenge${done ? ' ✓' : ''}</button>
      <button role="tab" data-mode="free" aria-selected="${mode === 'free'}">Free play</button></div>`;
  }
  function bindMode(root, cb) { root.querySelectorAll('.gmode [data-mode]').forEach(b => b.addEventListener('click', () => cb(b.dataset.mode))); }
  // era chips for free play (daily always uses every era)
  function eraChips(sport, extra) {
    const all = sportEras(sport), sel = getEras(sport);
    return `<div class="gfree"><div class="gfree-row"><span class="glabel">Eras</span><div class="gchips">
      ${all.map(e => `<button data-era="${e}" aria-pressed="${sel.includes(e)}">${e}s</button>`).join('')}
      ${sel.length < all.length ? '<button class="glink" data-era-all>All eras</button>' : ''}</div></div>${extra || ''}</div>`;
  }
  function bindEras(root, sport, onChange) {
    root.querySelectorAll('[data-era]').forEach(b => b.addEventListener('click', () => {
      const e = +b.dataset.era, sel = getEras(sport);
      const next = sel.includes(e) ? sel.filter(x => x !== e) : sel.concat(e).sort();
      if (!next.length) return;            // keep at least one era
      setEras(sport, next); onChange();
    }));
    const a = root.querySelector('[data-era-all]'); if (a) a.addEventListener('click', () => { setEras(sport, sportEras(sport).slice()); onChange(); });
  }
  // per game state: { mode, st }. make(r, eras) builds a fresh game.
  const GST = {};
  // ?c=<seed>.<eras> in the address = a friend's challenge link: free play with exactly their puzzle
  function challenge() {
    let c = null; try { c = new URLSearchParams(location.search).get('c'); } catch (e) {}
    if (!c || !/^[a-z0-9]{3,12}(\.[0-9-]+)?$/.test(c)) return null;
    const [seed, e] = c.split('.');
    return { seed, eras: e ? e.split('-').map(x => +x < 50 ? 2000 + +x : 1900 + +x) : null, raw: c };
  }
  function gameState(sport, g, make) {
    const key = sport + '|' + g, G = GST[key] || (GST[key] = { mode: 'daily', st: null }), today = etDate();
    const ch = challenge();
    if (ch && G.chUsed !== ch.raw) { G.chUsed = ch.raw; G.mode = 'free'; G.st = null; G.ch = ch; }
    const saved = store.get(dkey(sport, g, today), null);
    const stale = !G.st || G.st.mode !== G.mode || (G.mode === 'daily' && G.st.date !== today) || (G.mode === 'free' && G.st.eraKey !== 'ch' && G.st.eraKey !== eraKey(sport));
    if (stale) {
      if (G.mode === 'daily' && saved && saved.state) G.st = saved.state;
      else {
        const daily = G.mode === 'daily', c = !daily && G.ch;
        const eras = daily ? sportEras(sport) : c && c.eras ? c.eras.filter(e => sportEras(sport).includes(e)) : getEras(sport);
        const seed = daily ? sport + '-' + g + '-' + today : (c ? c.seed : freeSeed());
        const r = rngFrom(daily ? seed : 'free-' + sport + '-' + g + '-' + seed);
        G.st = Object.assign({ mode: G.mode, date: today, eraKey: daily ? 'all' : c ? 'ch' : eraKey(sport), eras: eras.length ? eras : sportEras(sport), seed, sp: sport, g, fromChallenge: !!c }, make(r, eras.length ? eras : sportEras(sport), daily));
        G.ch = null;
      }
    }
    return { G, st: G.st, saved };
  }
  // the share text, plus a link that drops a friend into the same free-play puzzle
  function challengeLink(st) {
    const all = sportEras(st.sp), eras = (st.eras || all);
    const e = eras.length === all.length ? '' : '.' + eras.map(x => String(x).slice(2)).join('-');
    return `https://www.volindex.net/games/${SPORT_PATH[st.sp]}/${st.g}?c=${st.seed}${e}`;
  }
  function copyShare(st, btn) {
    const txt = (st.share || '') + (st.mode === 'free' && st.seed ? `\nSame puzzle: ${challengeLink(st)}` : '');
    if (window.VI_TRACK) window.VI_TRACK('share/' + st.sp + '/' + st.g);
    copyText(txt, btn);
  }
  const SPORT_PATH = { football: 'football', mbb: 'mens-basketball', wbb: 'womens-basketball', baseball: 'baseball', softball: 'softball', volleyball: 'volleyball', soccer: 'soccer' };
  function saveDaily(sport, g, st) {
    if (st.mode === 'daily') store.set(dkey(sport, g, st.date), { state: st, share: st.share });
    if (st.done && !st.tracked) {   // count a finished game once (analytics) and sync a signed-in player's progress
      st.tracked = 1;
      if (window.VI_TRACK) window.VI_TRACK('finish/' + sport + '/' + g + '/' + st.mode);
      if (st.mode === 'daily' && window.VI_SYNC) window.VI_SYNC();
      if (st.mode === 'daily') store.set(dkey(sport, g, st.date), { state: st, share: st.share });
    }
  }
  function topBar(body, sport, G, saved, extra) {
    const chal = G.mode === 'free' && G.st && G.st.fromChallenge ? '<div class="gchal">🤝 You\'re playing a friend\'s challenge: the exact same puzzle they got.</div>' : '';
    return `${modeBar(G.mode, !!(saved && saved.state && saved.state.done))}${chal}${G.mode === 'free' && !(G.st && G.st.fromChallenge) ? eraChips(sport, extra) : ''}`;
  }
  function bindTop(body, sport, G) {
    bindMode(body, m => { G.mode = m; G.st = null; rerender(); });
    bindEras(body, sport, () => { G.st = null; rerender(); });
  }

  /* =====================================================================================
     HUBS
     ===================================================================================== */
  function renderHome(app) {
    const today = etDate();
    app.innerHTML = `<div class="wrap hub-hero games-hero"><div class="eyebrow">Play</div><h1>Vol <span>Games</span></h1>
      <p>Daily games built on Tennessee history. Pick a sport. Every game has a daily challenge that everyone gets the same, plus free play with era filters. New dailies drop at midnight Eastern.</p></div>
      <div class="wrap"><a class="box gme" href="#me"><span class="gicon" aria-hidden="true">🔥</span><span><b>My games</b><span class="dim">Your streak, today's dailies, titles and stats${window.VI_AUTH_CONFIG ? '. Sign in to sync them across devices.' : '.'}</span></span><span class="btn">Open ›</span></a></div>
      <div class="wrap gsports">${SPORTS.map(s => {
        const done = s.games.filter(g => dailyDone(s.key, g)).length;
        return `<a class="box gsport ${s.key === 'football' ? 'lead' : ''}" href="#games-${s.key}">
          <span class="gicon" aria-hidden="true">${s.icon}</span>
          <span class="gsport-t"><b>${esc(s.name)}</b><span class="dim">${s.games.length} games${done ? ` · ${done} done today` : ''}</span></span>
          ${s.beta ? '<span class="gbeta">Beta</span>' : '<span class="chip new">Full</span>'}</a>`;
      }).join('')}</div>
      <div class="wrap gfoot"><button class="btn" id="gShareAll">Copy today's results</button>
        <p class="dim">Football games use the Tennessee record book, utsports.com, ESPN and CollegeFootballData.com. Basketball, baseball, softball, volleyball and soccer games are in beta and use utsports.com season stats; more games for every sport are coming soon. Spotted a mistake? Email <a href="mailto:thevolindex@gmail.com">thevolindex@gmail.com</a>.</p></div>`;
    app.querySelector('#gShareAll').addEventListener('click', e => {
      const lines = [];
      SPORTS.forEach(s => s.games.forEach(g => { const r = store.get(dkey(s.key, g, today), null); if (r && r.share) lines.push(r.share.split('\n')[0]); }));
      copyText(lines.length ? `Vol Index games · ${today}\n${lines.join('\n')}\n${SITE}` : `No daily games finished yet today. ${SITE}`, e.currentTarget);
    });
  }
  const COVERAGE = {
    football: 'Every Vol from 1980 to today appears at his best season. 1980s and early 1990s stats come from the UT record book; 1995 on use full season stats from utsports.com, ESPN and CollegeFootballData.com.',
    mbb: 'Full season stats from 1990-91 to today: the 1990s from Sports-Reference (top seven scorers each season), 2000-01 on from utsports.com.',
    wbb: 'Full season stats from 1990-91 to today (utsports.com year-by-year stats and all-time rosters), so Holdsclaw, Catchings and Parker are all here. 1998-99 comes from Sports-Reference.',
    baseball: 'Full season stats from 2000 to today: 2000-2016 from The Baseball Cube (top six hitters and top four pitchers each season), 2017 on from utsports.com. No 2020 season.',
    softball: '2000-2026 season stats from the softball media guide and utsports.com, including the Monica Abbott years. No 2020 season.',
    volleyball: 'Season stats from utsports.com, 2006 to 2025. Earlier seasons are not online yet.',
    soccer: 'Season stats from utsports.com, 2001 to 2025.',
  };
  function renderSportHub(app, sport) {
    const s = SP(sport);
    app.innerHTML = `<div class="wrap games">
      <nav class="gcrumb"><a href="#games">Games</a> <span aria-hidden="true">›</span> <b>${esc(s.name)}</b></nav>
      <header class="ghead"><h1><span aria-hidden="true">${s.icon}</span> ${esc(s.name)} games${s.beta ? ' <span class="gbeta">Beta</span>' : ''}</h1>
        <p>${esc(COVERAGE[sport])}</p></header>
      ${betaNote(sport)}
      <div class="grid g3 gcards">${s.games.map(g => `<a class="box gcard" href="#games-${sport}-${g}"><div class="gcard-top"><span class="gicon" aria-hidden="true">${gIcon(sport, g)}</span>${g === 'dynasty' ? '<span class="chip new">Preview</span>' : dailyDone(sport, g) ? '<span class="chip new">Today ✓</span>' : '<span class="chip">Daily</span>'}</div>
          <h3>${esc(gameName(sport, g))}</h3><p>${esc(gameBlurb(sport, g))}</p><span class="btn primary">Play</span></a>`).join('')}
        ${s.beta ? `<div class="box gcard soon"><div class="gcard-top"><span class="gicon" aria-hidden="true">🔜</span><span class="chip">Soon</span></div><h3>More games</h3><p>Grids, career paths and sims for ${esc(s.name.toLowerCase())} are on the way.</p></div>` : ''}</div>
      <p class="gfoot dim"><a href="#games">← All sports</a> · <a href="#me">My games: streaks and stats ›</a> · <a href="#players-${sport}">${esc(s.name)} player pages ›</a></p></div>`;
  }

  /* =====================================================================================
     GUESSER (football + basketball / baseball / softball)
     ===================================================================================== */
  const GUESS_MAX = 8;
  const draftRd = p => p.draft ? (p.draft[1] === 0 ? 'UDFA' : 'Rd ' + p.draft[1]) : '—';
  const honLevel = p => { const h = p.honAll || []; return h.some(x => /^AA[uc1]$/.test(x)) ? 3 : h.includes('AA2') ? 2 : h.includes('SEC') ? 1 : 0; };
  const HON_LV = ['None', 'All-SEC', 'All-America (2nd/3rd)', 'All-American'];
  const POS_SIDE = s => ['QB', 'RB', 'WR', 'TE'].includes(s) ? 'O' : 'D';
  const arrow = (a, b) => a === b ? '' : (b > a ? ' ↑' : ' ↓');
  const cls = (ok, near) => ok ? 'hit' : near ? 'near' : '';
  function guessAdapter(sport) {
    if (sport === 'football') return {
      cands: eras => STARS.filter(p => eras.includes(p.dec)),
      all: () => ALL.map(p => p.n), get: n => BYNAME[n.toLowerCase()], weight: p => ERA_BOOST(p.dec),
      head: ['Pos', 'Prime', 'Coach', 'Honors', 'Draft'],
      cells: (p, a) => {
        const dA = a.draft ? (a.draft[1] || 8) : 9, dP = p.draft ? (p.draft[1] || 8) : 9;
        return [
          [cls(p.slot === a.slot, POS_SIDE(p.slot) === POS_SIDE(a.slot)), posLabel(p.slot)],
          [cls(p.y === a.y, Math.abs(p.y - a.y) <= 3), p.y + arrow(p.y, a.y)],
          [cls(p.coach === a.coach, false), p.coach.split(' ').pop()],
          [cls(honLevel(p) === honLevel(a), Math.abs(honLevel(p) - honLevel(a)) === 1), HON_LV[honLevel(p)] + arrow(honLevel(p), honLevel(a))],
          [cls(dP === dA, Math.abs(dP - dA) === 1), draftRd(p) + (dP === dA ? '' : (dA < dP ? ' ↑' : ' ↓'))],
        ];
      },
      hints: a => [['Years at UT', a.ut], ['Best season', a.y + ': ' + statLine(a)], ['Initials', initials(a.n)]],
      reveal: a => `${SLOT_NAME[a.slot]} · best season ${a.y} · ${statLine(a)}`,
      chips: a => honorChips(a.honAll, 4),
      foot: 'Prime = his best season at Tennessee. Coach = head coach that season. Draft arrows point toward the answer\'s round (↑ earlier).',
      any: 'Any Vol from 1980 to today',
    };
    const S = SDATA[sport];
    return {
      cands: eras => { const ps = S.players.filter(p => eras.includes(p.dec)); const cut = ps.slice().sort((a, b) => b.ovr - a.ovr); return cut.slice(0, Math.max(12, Math.ceil(cut.length * .7))); },
      all: () => S.players.map(p => p.n), get: n => S.by[n.toLowerCase()], weight: p => ERA_BOOST(p.dec),
      head: ['Pos', 'Best season', 'Coach', 'Home', 'Transfer', 'Stat'],
      cells: (p, a) => {
        const kp = keyStat(sport, p), ka = keyStat(sport, a), same = kp.k === ka.k;
        let statCls = '', statTxt = (kp.txt || kp.v) + ' ' + kp.l;
        if (same && kp.v != null && ka.v != null) {
          if (kp.v === ka.v) statCls = 'hit';
          else { statCls = Math.abs(kp.v - ka.v) <= Math.abs(ka.v) * 0.12 ? 'near' : ''; statTxt += (ka.v > kp.v ? ' ↑' : ' ↓'); }
        }
        return [
          [cls(p.pos === a.pos, posNear(sport, p.pos, a.pos)), p.pos || '—'],
          [cls(p.y === a.y, Math.abs(p.y - a.y) <= 2), p.s + arrow(p.y, a.y)],
          [cls(p.coach === a.coach, false), (p.coach || '—').split(' ').pop()],
          [cls(!!p.home && p.home === a.home, false), p.home || '—'],
          [cls(!!p.prev === !!a.prev, false), p.prev ? 'Yes' : 'No'],
          [statCls, statTxt],
        ];
      },
      hints: a => [['Seasons at UT', a.seasons.join(', ')], ['Best season', a.s + ': ' + a.line], ['Initials', initials(a.n)]],
      reveal: a => `${a.pos} · best season ${a.s} · ${a.line}${a.prev ? ' · transferred from ' + a.prev : ''}`,
      chips: () => '',
      foot: 'Best season = the player\'s top season at Tennessee in our data. Home = home state or country. Transfer = came from another four-year school or junior college. Stat arrows only show when both players are the same type (hitter vs. pitcher).',
      any: 'Any player in our ' + SP(sport).name.toLowerCase() + ' data (' + S.first + ' to ' + S.last + ')',
    };
  }
  function renderGuesser(app, sport) {
    const A = guessAdapter(sport);
    const body = frame(app, sport, 'guesser', 'Guess any player. Each guess shows how close you are: orange is a match, light orange is close, arrows point to the answer. A new hint unlocks every two misses.');
    const { G, st, saved } = gameState(sport, 'guesser', (r, eras) => {
      let c = A.cands(eras); if (!c.length) c = A.cands(sportEras(sport));
      return { ans: wpick(r, c, A.weight).n, guesses: [], done: false, pool: c.length };
    });
    const ans = A.get(st.ans);
    const won = st.guesses.includes(ans.n), misses = st.guesses.filter(n => n !== ans.n).length;
    const hints = A.hints(ans), shown = st.done ? hints.length : Math.min(hints.length, Math.floor(misses / 2));
    const row = p => `<tr><th scope="row" class="${p.n === ans.n ? 'hit' : ''}">${esc(p.n)}</th>${A.cells(p, ans).map(([c, t]) => `<td class="${c}">${esc(t)}</td>`).join('')}</tr>`;
    body.innerHTML = `${topBar(body, sport, G, saved)}
      <div class="box gguess">
        <div class="gguess-top"><div class="eyebrow">Guess ${Math.min(st.guesses.length + 1, GUESS_MAX)} of ${GUESS_MAX} · ${st.pool || ''} possible answers</div>
          ${st.done ? '' : '<div id="gsrch"></div>'}</div>
        ${st.done ? `<div class="greveal ${won ? 'win' : ''}"><div class="eyebrow">${won ? 'Got it in ' + st.guesses.length : st.gaveUp ? 'You gave up. The answer' : 'The answer'}</div><h3>${esc(ans.n)}</h3>
          <p>${esc(A.reveal(ans))}</p><p>${A.chips(ans)}</p><p><a href="#players-${sport}-${slug(ans.n)}">Player page ›</a></p>
          <div class="grow"><button class="btn primary" id="gShare">Copy result</button> <button class="btn" id="gNew">New player (free play)</button></div></div>` : ''}
        <div class="ghints">${hints.map((h, i) => i < shown ? `<div class="ghint on"><b>${esc(h[0])}</b> ${esc(h[1])}</div>` : `<div class="ghint"><b>${esc(h[0])}</b> <span class="dim">after ${(i + 1) * 2} misses</span></div>`).join('')}</div>
        <div class="gtable-wrap"><table class="gtable"><thead><tr><th>Player</th>${A.head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${st.guesses.slice().reverse().map(n => row(A.get(n))).join('') || `<tr><td colspan="${A.head.length + 1}" class="dim">Start typing a name. ${esc(A.any)}.</td></tr>`}</tbody></table></div>
        ${!st.done ? '<div class="grow"><button class="glink" id="gGive">Give up</button></div>' : ''}
      </div>
      <p class="dim small">${esc(A.foot)}</p>`;
    bindTop(body, sport, G);
    const finish = (gaveUp) => {
      st.done = true; st.gaveUp = !!gaveUp; const w = st.guesses.includes(ans.n);
      st.share = `${GAME_ICON.guesser} ${gameName(sport, 'guesser')}${st.mode === 'daily' ? ' ' + st.date : ''}: ${w ? st.guesses.length + '/' + GUESS_MAX : 'X/' + GUESS_MAX}\n${st.guesses.map(x => x === ans.n ? '🟧' : '⬛').join('')}\n${SITE}`;
    };
    if (!st.done) searchBox(body.querySelector('#gsrch'), A.all().filter(n => !st.guesses.includes(n)).sort(), n => {
      st.guesses.push(n);
      if (n === ans.n || st.guesses.length >= GUESS_MAX) finish(false);
      saveDaily(sport, 'guesser', st); rerender(); refocus();
    }, 'Guess a player');
    twoTap(body.querySelector('#gGive'), 'Tap again to reveal', () => { finish(true); saveDaily(sport, 'guesser', st); rerender(); });
    const sh = body.querySelector('#gShare'); if (sh) sh.addEventListener('click', e => copyShare(st, e.currentTarget));
    const nw = body.querySelector('#gNew'); if (nw) nw.addEventListener('click', () => { G.mode = 'free'; G.st = null; rerender(); });
  }

  /* =====================================================================================
     POWER T GRID (football)
     ===================================================================================== */
  const CAT = {
    QB: { l: 'Quarterback', f: p => p.slot === 'QB', t: 'pos' }, RB: { l: 'Running back', f: p => p.slot === 'RB', t: 'pos' },
    WRTE: { l: 'Receiver (WR/TE)', f: p => p.slot === 'WR' || p.slot === 'TE', t: 'pos' }, DLINE: { l: 'Defensive line', f: p => p.slot === 'DL' || p.slot === 'EDGE', t: 'pos' },
    LB: { l: 'Linebacker', f: p => p.slot === 'LB', t: 'pos' }, DB: { l: 'Defensive back', f: p => p.slot === 'CB' || p.slot === 'S', t: 'pos' },
    E80: { l: 'Played in the 1980s', f: p => p.yrs.some(y => y < 1990), t: 'era', e: [1980] }, E90: { l: 'Played in the 1990s', f: p => p.yrs.some(y => y >= 1990 && y < 2000), t: 'era', e: [1990] },
    E00: { l: 'Played in the 2000s', f: p => p.yrs.some(y => y >= 2000 && y < 2010), t: 'era', e: [2000] }, E10: { l: 'Played in the 2010s', f: p => p.yrs.some(y => y >= 2010 && y < 2020), t: 'era', e: [2010] },
    E20: { l: 'Played in the 2020s', f: p => p.yrs.some(y => y >= 2020), t: 'era', e: [2020] },
    MAJ: { l: 'Played for Johnny Majors', f: p => p.yrs.some(y => y <= 1992), t: 'era', e: [1980, 1990] }, FUL: { l: 'Played for Phillip Fulmer', f: p => p.yrs.some(y => y >= 1993 && y <= 2008), t: 'era', e: [1990, 2000] },
    BJ: { l: 'Played for Butch Jones', f: p => p.yrs.some(y => y >= 2013 && y <= 2017), t: 'era', e: [2010] }, HEU: { l: 'Played for Josh Heupel', f: p => p.yrs.some(y => y >= 2021), t: 'era', e: [2020] },
    AA: { l: 'First-team All-American', f: p => p.fl.includes('aa'), t: 'ach' }, SEC: { l: 'First-team All-SEC', f: p => p.fl.includes('sec'), t: 'ach' },
    R1: { l: 'NFL first-round pick', f: p => p.fl.includes('r1'), t: 'ach' }, DR: { l: 'Drafted into the NFL', f: p => p.fl.includes('drafted'), t: 'ach' },
    K1: { l: '1,000-yard season', f: p => p.fl.includes('k1000'), t: 'ach' }, TD12: { l: '12+ rush/rec TD season', f: p => p.fl.includes('td12'), t: 'ach' },
    T100: { l: '100-tackle season', f: p => p.fl.includes('t100'), t: 'ach' }, S10: { l: '10-sack season', f: p => p.fl.includes('s10'), t: 'ach' },
    I5: { l: '5-INT season', f: p => p.fl.includes('i5'), t: 'ach' },
  };
  function gridPlayers(eras) { return ALL.filter(p => p.yrs.some(y => eras.includes(decOf(y)))); }
  function makeGrid(r, eras) {
    const players = gridPlayers(eras);
    const keys = Object.keys(CAT).filter(k => !CAT[k].e || CAT[k].e.some(e => eras.includes(e)));
    const fits = (a, b) => players.filter(p => CAT[a].f(p) && CAT[b].f(p)).length;
    for (let tries = 0; tries < 5000; tries++) {
      const rows = shuffle(r, keys.filter(k => CAT[k].t !== 'era')).slice(0, 3);
      const cols = shuffle(r, keys.filter(k => CAT[k].t !== 'pos' && !rows.includes(k))).slice(0, 3);
      if (rows.filter(k => CAT[k].t === 'pos').length < 1) continue;
      if (eras.length > 1 && cols.filter(k => CAT[k].t === 'era').length < 1) continue;
      let ok = true;
      for (const a of rows) { for (const b of cols) if (fits(a, b) < 2) { ok = false; break; } if (!ok) break; }
      if (ok) return { rows, cols };
    }
    return { rows: ['QB', 'RB', 'WRTE'], cols: ['SEC', 'DR', 'K1'] };
  }
  function renderGrid(app) {
    const sport = 'football';
    const body = frame(app, sport, 'grid', 'Pick a square, then name a Vol who fits both its row and its column. Nine guesses. Each player counts once.');
    const { G, st, saved } = gameState(sport, 'grid', (r, eras) => Object.assign({ cells: Array(9).fill(null), left: 9, used: [], sel: null, done: false }, makeGrid(r, eras)));
    const players = gridPlayers(st.eras || FB_ERAS);
    const answers = i => players.filter(p => CAT[st.rows[Math.floor(i / 3)]].f(p) && CAT[st.cols[i % 3]].f(p) && !st.used.includes(p.n)).map(p => p.n);
    const head = k => `<div class="gt-h">${esc(CAT[k].l)}</div>`;
    const cell = i => {
      const v = st.cells[i], row = Math.floor(i / 3), col = i % 3, t = row === 0 || col === 1;
      if (v) return `<div class="gt-c ok ${t ? 't' : ''}"><b>${esc(v)}</b></div>`;
      if (st.done) { const a = answers(i); return `<div class="gt-c miss ${t ? 't' : ''}"><span class="dim small">${a.length} possible${a.length ? ': ' + esc(a.slice(0, 2).join(', ')) : ''}</span></div>`; }
      return `<button class="gt-c ${t ? 't' : ''} ${st.sel === i ? 'sel' : ''}" data-i="${i}" aria-label="${esc(CAT[st.rows[row]].l + ' and ' + CAT[st.cols[col]].l)}"></button>`;
    };
    const score = st.cells.filter(Boolean).length;
    body.innerHTML = `${topBar(body, sport, G, saved)}
      <div class="box ggrid-box">
        <div class="ggrid-top"><div class="eyebrow">${st.done ? 'Final: ' + score + '/9' : 'Guesses left: ' + st.left}</div>${!st.done ? '<button class="glink" id="gGive">Give up</button>' : ''}</div>
        <div class="ggrid"><div class="gt-corner" aria-hidden="true"><span>T</span></div>${st.cols.map(head).join('')}
          ${[0, 1, 2].map(r => head(st.rows[r]) + [0, 1, 2].map(c => cell(r * 3 + c)).join('')).join('')}</div>
        ${!st.done ? `<div class="ggrid-in">${st.sel === null ? '<p class="dim">Tap a square to start.</p>' : `<p><b>${esc(CAT[st.rows[Math.floor(st.sel / 3)]].l)}</b> + <b>${esc(CAT[st.cols[st.sel % 3]].l)}</b></p><div id="gsrch"></div><p class="gmsg" id="gmsg" role="status"></p>`}</div>` : `<div class="grow"><button class="btn primary" id="gShare">Copy result</button> <button class="btn" id="gNew">New grid (free play)</button></div>`}
      </div>
      <p class="dim small">"Played in" and coach squares count every season we have for a player.${G.mode === 'free' && st.eras.length < FB_ERAS.length ? ' Only Vols from your selected eras count.' : ''} Honors and draft come from the UT record book.</p>`;
    bindTop(body, sport, G);
    body.querySelectorAll('button.gt-c').forEach(b => b.addEventListener('click', () => { st.sel = +b.dataset.i; rerender(); refocus(); }));
    const finish = () => {
      st.done = true; st.sel = null;
      const sq = [0, 1, 2].map(r => [0, 1, 2].map(c => st.cells[r * 3 + c] ? '🟧' : '⬜').join('')).join('\n');
      st.share = `🟧 Power T Grid${st.mode === 'daily' ? ' ' + st.date : ''}: ${st.cells.filter(Boolean).length}/9\n${sq}\n${SITE}`; saveDaily(sport, 'grid', st);
    };
    if (st.sel !== null && !st.done) searchBox(body.querySelector('#gsrch'), ALL.map(p => p.n).filter(n => !st.used.includes(n)).sort(), n => {
      const p = BYNAME[n.toLowerCase()], i = st.sel, ok = players.includes(p) && CAT[st.rows[Math.floor(i / 3)]].f(p) && CAT[st.cols[i % 3]].f(p);
      st.left--;
      if (ok) { st.cells[i] = p.n; st.used.push(p.n); st.sel = null; }
      if (!st.left || st.cells.every(Boolean)) finish(); else saveDaily(sport, 'grid', st);
      rerender();
      if (!ok && !st.done) { const m = document.getElementById('gmsg'); if (m) m.textContent = `${n} doesn't fit that square. ${st.left} guesses left.`; refocus(); }
    }, 'Name a Vol');
    twoTap(body.querySelector('#gGive'), 'Tap again to end', () => { finish(); rerender(); });
    const sh = body.querySelector('#gShare'); if (sh) sh.addEventListener('click', e => copyShare(st, e.currentTarget));
    const nw = body.querySelector('#gNew'); if (nw) nw.addEventListener('click', () => { G.mode = 'free'; G.st = null; rerender(); });
  }

  /* =====================================================================================
     VFL CAREER (football)
     ===================================================================================== */
  const CAREER_MAX = 6;
  function careerEnd(c) { const m = /^(\d{4})(?:-(\d{2}))?/.exec(c.ut || ''); if (!m) return 2000; return m[2] ? +(m[1].slice(0, 2) + m[2]) : +m[1]; }
  function renderCareer(app) {
    const sport = 'football';
    const body = frame(app, sport, 'career', 'Vol for Life. Name the former Vol from his path: where he started, Tennessee, then every NFL team he played for. Each wrong guess unlocks a clue.');
    const { G, st, saved } = gameState(sport, 'career', (r, eras) => {
      const notable = D.careers.filter(c => c.notable);
      let c = notable.filter(x => eras.includes(decOf(careerEnd(x)))); if (!c.length) c = notable;
      return { ans: wpick(r, c, x => ERA_BOOST(decOf(careerEnd(x)))).n, guesses: [], done: false, pool: c.length };
    });
    const c = D.careers.find(x => x.n === st.ans), p = BYNAME[c.n.toLowerCase()];
    const posName = { QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end', OL: 'Offensive line', DL: 'Defensive tackle', EDGE: 'Defensive end', LB: 'Linebacker', CB: 'Cornerback', S: 'Safety' }[c.pos] || c.pos;
    const dr = c.draft.rd === 0 ? `Undrafted free agent (${c.draft.y})` : `${c.draft.y} NFL Draft, round ${c.draft.rd}${c.draft.pick ? ', pick ' + c.draft.pick : ''}`;
    const clues = [['At Tennessee', c.ut], ['Position', posName], ['NFL Draft', dr], ['Best UT season', p ? `${p.y}: ${statLine(p)}` : 'Lineman, no stat line'], ['Initials', initials(c.n)]];
    const misses = st.guesses.filter(x => x !== c.n).length, won = st.guesses.includes(c.n);
    const shown = st.done ? clues.length : Math.min(misses, clues.length);
    const path = (c.from ? c.from.split(' → ').map(t => `<span class="gteam-chip col">${esc(t)}</span>`).join('<span class="garr" aria-hidden="true">→</span>') + '<span class="garr" aria-hidden="true">→</span>' : '')
      + '<span class="gteam-chip ut">Tennessee</span><span class="garr" aria-hidden="true">→</span>'
      + c.teams.map((t, i) => `<span class="gteam-chip"><i>${i + 1}</i>${esc(t)}</span>`).join('<span class="garr" aria-hidden="true">→</span>');
    body.innerHTML = `${topBar(body, sport, G, saved)}
      <div class="box gcareer">
        <div class="eyebrow">Career path${c.teams.length > 1 ? ' · ' + c.teams.length + ' NFL teams' : ''} · ${st.pool || ''} notable VFLs in this pool</div>
        <div class="gteams">${path}</div>
        <dl class="gclues">${clues.map((cl, i) => i < shown ? `<div><dt>${esc(cl[0])}</dt><dd>${esc(cl[1])}</dd></div>` : `<div class="locked"><dt>${esc(cl[0])}</dt><dd>Unlocks after ${i + 1} miss${i ? 'es' : ''}</dd></div>`).join('')}</dl>
        ${st.done ? `<div class="greveal ${won ? 'win' : ''}"><div class="eyebrow">${won ? 'Correct in ' + st.guesses.length : st.gaveUp ? 'You gave up. The answer' : 'The answer'}</div><h3>${esc(c.n)}</h3>${p ? `<p><a href="#players-football-${slug(c.n)}">Player page ›</a></p>` : ''}
          <div class="grow"><button class="btn primary" id="gShare">Copy result</button> <button class="btn" id="gNew">Another career (free play)</button></div></div>`
        : `<div class="eyebrow">Guess ${st.guesses.length + 1} of ${CAREER_MAX}</div><div id="gsrch"></div><div class="grow"><button class="glink" id="gGive">Give up</button></div>`}
        ${st.guesses.length ? `<ul class="gmisses">${st.guesses.map(x => `<li class="${x === c.n ? 'hit' : ''}">${esc(x)}</li>`).join('')}</ul>` : ''}
      </div>
      <p class="dim small">NFL teams from the UT record book's "Vols in Pro Football", using today's team names (Washington is listed as the Commanders). Schools before Tennessee are shown for transfers and junior college players.</p>`;
    bindTop(body, sport, G);
    const finish = gaveUp => {
      st.done = true; st.gaveUp = !!gaveUp; const w = st.guesses.includes(c.n);
      st.share = `🏟️ VFL Career${st.mode === 'daily' ? ' ' + st.date : ''}: ${w ? st.guesses.length + '/' + CAREER_MAX : 'X/' + CAREER_MAX}\n${st.guesses.map(x => x === c.n ? '🟧' : '⬛').join('')}\n${SITE}`;
    };
    const names = Array.from(new Set(D.careers.map(x => x.n).concat(ALL.map(x => x.n)))).sort();
    if (!st.done) searchBox(body.querySelector('#gsrch'), names.filter(n => !st.guesses.includes(n)), n => {
      st.guesses.push(n);
      if (n === c.n || st.guesses.length >= CAREER_MAX) finish(false);
      saveDaily(sport, 'career', st); rerender(); refocus();
    }, 'Name the VFL');
    twoTap(body.querySelector('#gGive'), 'Tap again to reveal', () => { finish(true); saveDaily(sport, 'career', st); rerender(); });
    const sh = body.querySelector('#gShare'); if (sh) sh.addEventListener('click', e => copyShare(st, e.currentTarget));
    const nw = body.querySelector('#gNew'); if (nw) nw.addEventListener('click', () => { G.mode = 'free'; G.st = null; rerender(); });
  }

  /* =====================================================================================
     ROCKY TOP RANKINGS (every sport)
     ===================================================================================== */
  const RK_FB = [
    { k: 'yds', l: 'Passing yards', slots: ['QB'], min: 1200 }, { k: 'td', l: 'Passing touchdowns', slots: ['QB'], min: 8 },
    { k: 'ryds', l: 'Rushing yards', slots: ['RB', 'QB'], min: 400 }, { k: 'rtd', l: 'Rushing touchdowns', slots: ['RB', 'QB'], min: 4 },
    { k: 'cyds', l: 'Receiving yards', slots: ['WR', 'TE', 'RB'], min: 350 }, { k: 'rec', l: 'Receptions', slots: ['WR', 'TE', 'RB'], min: 25 },
    { k: 'ctd', l: 'Receiving touchdowns', slots: ['WR', 'TE'], min: 3 }, { k: 'tot', l: 'Tackles', slots: ['LB', 'S', 'CB', 'DL', 'EDGE'], min: 50 },
    { k: 'sk', l: 'Sacks', slots: ['EDGE', 'DL', 'LB'], min: 3 }, { k: 'ints', l: 'Interceptions', slots: ['S', 'CB', 'LB'], min: 2 },
    { k: 'tfl', l: 'Tackles for loss', slots: ['EDGE', 'DL', 'LB'], min: 6 },
  ];
  const RK_SPORT = {
    hoops: [{ k: 'ppg', l: 'Points per game', min: 8, fmt: v => Number(v).toFixed(1) }, { k: 'rpg', l: 'Rebounds per game', min: 4, fmt: v => Number(v).toFixed(1) }, { k: 'apg', l: 'Assists per game', min: 2, fmt: v => Number(v).toFixed(1) }, { k: 'pts', l: 'Points', min: 200 }, { k: 'reb', l: 'Rebounds', min: 100 }, { k: 'ast', l: 'Assists', min: 60 }, { k: 'tpm', l: '3-pointers made', min: 25 }, { k: 'blk', l: 'Blocks', min: 15 }, { k: 'stl', l: 'Steals', min: 25 }],
    diamond: [{ k: 'h', l: 'Hits', kind: 'H', min: 40 }, { k: 'hr', l: 'Home runs', kind: 'H', min: 3 }, { k: 'rbi', l: 'RBI', kind: 'H', min: 20 }, { k: 'sb', l: 'Stolen bases', kind: 'H', min: 5 },
      { k: 'avg', l: 'Batting average', kind: 'H', min: .2, fmt: f3, need: s => (s.ab || 0) >= 100 }, { k: 'so', l: 'Strikeouts (pitching)', kind: 'P', min: 40 }, { k: 'w', l: 'Wins (pitching)', kind: 'P', min: 4 },
      { k: 'era', l: 'ERA', kind: 'P', min: .1, asc: true, fmt: f2, need: s => (s.ip || 0) >= 50 }, { k: 'ip', l: 'Innings pitched', kind: 'P', min: 40 }],
    volleyball: [{ k: 'k', l: 'Kills', min: 150 }, { k: 'a', l: 'Assists', min: 500 }, { k: 'd', l: 'Digs', min: 150 }, { k: 'b', l: 'Blocks', min: 50 }, { k: 'sa', l: 'Service aces', min: 15 }],
    soccer: [{ k: 'g', l: 'Goals', kind: 'F', min: 4 }, { k: 'a', l: 'Assists', kind: 'F', min: 3 }, { k: 'pts', l: 'Points', kind: 'F', min: 10 }, { k: 'sv', l: 'Saves (keepers)', kind: 'GK', min: 40 }, { k: 'sho', l: 'Shutouts (keepers)', kind: 'GK', min: 4 }],
  };
  const rkCats = sport => sport === 'football' ? RK_FB : RK_SPORT[sport === 'mbb' || sport === 'wbb' ? 'hoops' : sport === 'baseball' || sport === 'softball' ? 'diamond' : sport];
  function rkRows(sport, cat, eras) {
    if (sport === 'football') return D.seasons.filter(s => cat.slots.includes(s.slot) && (s.st[cat.k] || 0) >= cat.min && eras.includes(decOf(s.y))).map(s => ({ n: s.n, y: s.y, s: String(s.y), pos: posLabel(s.slot), v: s.st[cat.k] }));
    return SDATA[sport].rows.filter(r => (!cat.kind || r.k === cat.kind) && r.st[cat.k] != null && r.st[cat.k] >= cat.min && (!cat.need || cat.need(r.st)) && eras.includes(r.dec))
      .map(r => ({ n: r.n, y: r.y, s: r.s, pos: r.pos, v: r.st[cat.k] }));
  }
  const RK_TRIES = 3;
  function makeRanking(r, sport, eras) {
    for (let t = 0; t < 600; t++) {
      const cat = pick(r, rkCats(sport));
      const rows = shuffle(r, rkRows(sport, cat, eras));
      const chosen = [], vals = new Set();
      for (const s of rows) { if (vals.has(s.v) || chosen.some(c => c.n === s.n)) continue; chosen.push(s); vals.add(s.v); if (chosen.length === 5) break; }
      if (chosen.length === 5) return { cat: cat.k + (cat.kind ? ':' + cat.kind : ''), items: chosen };
    }
    return null;
  }
  function renderRankings(app, sport) {
    const body = frame(app, sport, 'rankings', 'Order these five Tennessee seasons from best to worst. Use the arrows to move a row. Correct spots lock in orange.');
    const { G, st, saved } = gameState(sport, 'rankings', (r, eras) => {
      const z = makeRanking(r, sport, eras) || makeRanking(r, sport, sportEras(sport));
      return { cat: z.cat, items: z.items, order: shuffle(r, [0, 1, 2, 3, 4]), locked: [], tries: 0, done: false, hist: [] };
    });
    const [ck, kind] = st.cat.split(':'), cat = rkCats(sport).find(c => c.k === ck && (c.kind || '') === (kind || ''));
    const fmtV = v => cat.fmt ? cat.fmt(v) : fmt(v);
    const correct = st.items.map((x, i) => i).sort((a, b) => cat.asc ? st.items[a].v - st.items[b].v : st.items[b].v - st.items[a].v);
    body.innerHTML = `${topBar(body, sport, G, saved)}
      <div class="box grank">
        <div class="grank-top"><div><div class="eyebrow">${cat.asc ? 'Lowest to highest' : 'Most to least'}</div><h3>${esc(cat.l)} in a season</h3></div><div class="eyebrow">Try ${Math.min(st.tries + 1, RK_TRIES)} of ${RK_TRIES}</div></div>
        <ol class="grank-list">${st.order.map((idx, pos) => {
          const it = st.items[idx], right = correct[pos] === idx;
          return `<li class="${st.done ? (st.solved ? 'ok' : 'rev') : st.locked.includes(pos) && right ? 'ok' : ''}"><span class="grank-n">${pos + 1}</span><span class="grank-p"><b>${esc(it.n)}</b><span class="dim">${esc(it.s)} · ${esc(it.pos || '')}</span></span>
            ${st.done ? `<span class="grank-v">${fmtV(it.v)}</span>` : (st.locked.includes(pos) ? '<span class="grank-v">🔒</span>' : `<span class="grank-mv"><button data-mv="${pos}" data-d="-1" aria-label="Move up" ${pos === 0 ? 'disabled' : ''}>▲</button><button data-mv="${pos}" data-d="1" aria-label="Move down" ${pos === 4 ? 'disabled' : ''}>▼</button></span>`)}</li>`;
        }).join('')}</ol>
        ${st.done ? `<p class="gtier">${st.solved ? (st.tries === 1 ? 'Perfect on the first try.' : 'Solved in ' + st.tries + '.') : 'Out of tries. Here is the right order.'}</p>
          <div class="grow"><button class="btn primary" id="gShare">Copy result</button> <button class="btn" id="gNew">New ranking (free play)</button></div>`
        : `<div class="grow"><button class="btn primary big" id="rkGo">Lock it in</button></div>`}
      </div>
      <p class="dim small">${sport === 'football' ? 'Seasons from 1995 on use full season stats; earlier seasons come from the UT record book\'s year-by-year leaders.' : 'Season totals from utsports.com.'}</p>`;
    bindTop(body, sport, G);
    body.querySelectorAll('[data-mv]').forEach(b => b.addEventListener('click', () => {
      const a = +b.dataset.mv; let t = a + (+b.dataset.d);
      while (t >= 0 && t < 5 && st.locked.includes(t)) t += +b.dataset.d;
      if (t < 0 || t > 4) return;
      [st.order[a], st.order[t]] = [st.order[t], st.order[a]]; rerender();
    }));
    const go = body.querySelector('#rkGo');
    if (go) go.addEventListener('click', () => {
      st.tries++;
      const row = st.order.map((idx, pos) => correct[pos] === idx);
      st.locked = row.map((ok, i) => ok ? i : -1).filter(i => i >= 0);
      st.hist.push(row.map(ok => ok ? '🟧' : '⬛').join(''));
      if (st.locked.length === 5 || st.tries >= RK_TRIES) {
        st.done = true; st.solved = st.locked.length === 5; st.order = correct.slice();
        st.share = `📊 Rocky Top Rankings${sport === 'football' ? '' : ' (' + SP(sport).name + ')'}${st.mode === 'daily' ? ' ' + st.date : ''}: ${st.solved ? st.tries + '/' + RK_TRIES : 'X/' + RK_TRIES} · ${cat.l}\n${st.hist.join('\n')}\n${SITE}`;
      }
      saveDaily(sport, 'rankings', st); rerender();
    });
    const sh = body.querySelector('#gShare'); if (sh) sh.addEventListener('click', e => copyShare(st, e.currentTarget));
    const nw = body.querySelector('#gNew'); if (nw) nw.addEventListener('click', () => { G.mode = 'free'; G.st = null; rerender(); });
  }

  /* =====================================================================================
     HIGHER OR LOWER (every sport)
     ===================================================================================== */
  const DUEL_DAILY = 10;
  function duelPair(r, sport, eras) {
    for (let t = 0; t < 400; t++) {
      const cat = pick(r, rkCats(sport)), rows = rkRows(sport, cat, eras);
      if (rows.length < 6) continue;
      const a = pick(r, rows), b = pick(r, rows.filter(x => x.n !== a.n && x.v !== a.v));
      if (b) return { cat: cat.k + (cat.kind ? ':' + cat.kind : ''), a, b };
    }
    return null;
  }
  function renderDuel(app, sport) {
    const body = frame(app, sport, 'duel', 'One stat, two seasons. The first value is shown. Did the second player finish higher or lower? Daily is ten rounds; free play runs until you miss.');
    const { G, st, saved } = gameState(sport, 'duel', (r, eras, daily) => {
      const rounds = []; const n = daily ? DUEL_DAILY : 1;
      for (let i = 0; i < n; i++) rounds.push(duelPair(r, sport, eras) || duelPair(r, sport, sportEras(sport)));
      return { rounds, i: 0, picks: [], done: false, endless: !daily };
    });
    const best = store.get('duel-best-' + sport, 0);
    const rd = st.rounds[st.i], [ck, kind] = rd.cat.split(':'), cat = rkCats(sport).find(c => c.k === ck && (c.kind || '') === (kind || ''));
    const fmtV = v => cat.fmt ? cat.fmt(v) : fmt(v);
    const answered = st.picks.length > st.i;
    const truth = x => x.b.v > x.a.v ? 'higher' : 'lower';   // numeric, even for ERA-style stats
    const right = st.picks.filter((p, i) => p === truth(st.rounds[i])).length;
    const side = (x, show) => `<div class="dside ${show ? 'show' : ''}"><span class="eyebrow">${esc(x.s)} · ${esc(x.pos || '')}</span><b>${esc(x.n)}</b><span class="dval">${show ? fmtV(x.v) : '?'}</span></div>`;
    const ok = answered && st.picks[st.i] === truth(rd);
    body.innerHTML = `${topBar(body, sport, G, saved)}
      <div class="box gduel">
        <div class="gtriv-top"><div class="eyebrow">${st.endless ? 'Streak: ' + right + ' · best ' + best : 'Round ' + Math.min(st.i + 1, st.rounds.length) + ' of ' + st.rounds.length + ' · ' + right + ' right'}</div></div>
        ${st.done ? `<div class="greveal ${right >= 7 || (st.endless && right >= 5) ? 'win' : ''}"><div class="eyebrow">${st.mode === 'daily' ? 'Daily · ' + esc(st.date) : 'Free play'}</div><h3>${st.endless ? 'Streak of ' + right : right + ' / ' + st.rounds.length}</h3>
            <div class="grow"><button class="btn primary" id="gShare">Copy result</button> <button class="btn" id="gNew">${st.mode === 'daily' ? 'Free play (endless)' : 'Play again'}</button></div></div>` : ''}
        <h3 class="dq">${esc(cat.l)}${cat.asc ? ' (lower is better)' : ''} in a season</h3>
        <div class="dduel">${side(rd.a, true)}<div class="dvs">vs.</div>${side(rd.b, answered)}</div>
        ${!answered && !st.done ? `<div class="grow dbtns"><button class="btn primary big" data-hl="higher">${cat.asc ? '▲ Higher (worse)' : '▲ Higher'}</button><button class="btn big" data-hl="lower">${cat.asc ? '▼ Lower (better)' : '▼ Lower'}</button></div>` : ''}
        ${answered && !st.done ? `<p class="tfb ${ok ? 'ok' : 'no'}" role="status">${ok ? 'Correct!' : 'Nope.'} ${esc(rd.b.n)}: ${fmtV(rd.b.v)} vs. ${esc(rd.a.n)}: ${fmtV(rd.a.v)}.</p><div class="grow"><button class="btn primary" id="dNext">${st.endless ? (ok ? 'Next →' : 'See streak') : st.i + 1 < st.rounds.length ? 'Next →' : 'See results'}</button></div>` : ''}
      </div>
      <p class="dim small">${sport === 'football' ? 'Football seasons from 1980 on; early seasons come from the UT record book.' : esc(COVERAGE[sport])}</p>`;
    bindTop(body, sport, G);
    body.querySelectorAll('[data-hl]').forEach(b => b.addEventListener('click', () => { st.picks.push(b.dataset.hl); saveDaily(sport, 'duel', st); rerender(); }));
    const nx = body.querySelector('#dNext');
    if (nx) nx.addEventListener('click', () => {
      const wasOk = st.picks[st.i] === truth(rd);
      if (st.endless) {
        if (wasOk) { const r = rngFrom(st.seed + '|round' + (st.i + 1)); st.rounds.push(duelPair(r, sport, st.eras) || duelPair(r, sport, sportEras(sport))); st.i++; }
        else st.done = true;
      } else if (st.i + 1 < st.rounds.length) st.i++; else st.done = true;
      if (st.done) {
        const sc = st.picks.filter((p, i) => p === truth(st.rounds[i])).length;
        if (st.endless && sc > best) store.set('duel-best-' + sport, sc);
        st.share = `↕️ Higher or Lower${sport === 'football' ? '' : ' (' + SP(sport).name + ')'}${st.mode === 'daily' ? ' ' + st.date + ': ' + sc + '/' + st.rounds.length : ': streak of ' + sc}\n${st.picks.map((p, i) => p === truth(st.rounds[i]) ? '🟧' : '⬛').join('')}\n${SITE}`;
      }
      saveDaily(sport, 'duel', st); rerender();
    });
    const sh = body.querySelector('#gShare'); if (sh) sh.addEventListener('click', e => copyShare(st, e.currentTarget));
    const nw = body.querySelector('#gNew'); if (nw) nw.addEventListener('click', () => { G.mode = 'free'; G.st = null; rerender(); });
  }

  /* =====================================================================================
     TRIVIA (every sport)
     ===================================================================================== */
  const TRIVIA_N = 10;
  const DIFFS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['mix', 'Mix']];
  function triviaBank(sport) { return sport === 'football' ? D.trivia : SDATA[sport].trivia; }
  // Daily trivia walks through the whole bank in a fixed shuffled order, a few questions per day, so nothing repeats
  // until every question at that difficulty has been used. Free play skips questions this browser has seen recently.
  const dayNum = () => Math.floor(Date.parse(etDate() + 'T12:00:00Z') / 864e5);
  function makeTrivia(r, sport, eras, diff, daily) {
    const all = sportEras(sport), allEras = eras.length === all.length;
    const bank = triviaBank(sport).filter(q => q.y == null || allEras || eras.includes(decOf(q.y)) || (q.y < all[0] && eras.includes(all[0])));
    const seenKey = 'triv-seen-' + sport, seen = new Set(daily ? [] : store.get(seenKey, []));
    const PER_DAY = { easy: 3, medium: 4, hard: 3 };
    const by = d => {
      const list = bank.filter(q => q.d === d);
      if (daily) {   // fixed cycle: day N starts where day N-1 stopped
        const cyc = shuffle(rngFrom('trivia-cycle-' + sport + '-' + d), list); if (!cyc.length) return cyc;
        const start = (dayNum() * PER_DAY[d]) % cyc.length;
        return cyc.slice(start).concat(cyc.slice(0, start));
      }
      const fresh = shuffle(r, list.filter(q => !seen.has(q.q))), old = shuffle(r, list.filter(q => seen.has(q.q)));
      return fresh.concat(old);
    };
    let plan;
    if (diff === 'mix') plan = [['easy', 3], ['medium', 4], ['hard', 3]];
    else plan = [[diff, TRIVIA_N]];
    const out = [], usedA = new Set(), usedQ = new Set();
    const take = (list, n) => { for (const q of list) { if (n <= 0) break; if (usedA.has(q.a) || usedQ.has(q.q)) continue; out.push(q); usedA.add(q.a); usedQ.add(q.q); n--; } return n; };
    plan.forEach(([d, n]) => {
      let left = take(by(d), n);
      const order = d === 'easy' ? ['medium', 'hard'] : d === 'hard' ? ['medium', 'easy'] : ['easy', 'hard'];
      for (const o of order) if (left > 0) left = take(by(o), left);
    });
    // curated questions first within each difficulty feel more like trivia; keep a light mix
    const qs = out.slice(0, TRIVIA_N).map(q => ({ q: q.q, a: q.a, d: q.d, opts: shuffle(r, [q.a].concat(q.w.slice(0, 3))) }));
    if (!daily) store.set(seenKey, qs.map(q => q.q).concat(Array.from(seen)).slice(0, 400));
    return { qs, i: 0, picks: [], done: false, diff };
  }
  function renderTrivia(app, sport) {
    const body = frame(app, sport, 'trivia', 'Ten questions. Daily is a mix (three easy, four medium, three hard) and works through the whole question bank before anything repeats. In free play, pick a difficulty and the eras you want.');
    const diffNow = getDiff(sport);
    const { G, st, saved } = gameState(sport, 'trivia', (r, eras, daily) => makeTrivia(r, sport, eras, daily ? 'mix' : diffNow, daily));
    if (G.mode === 'free' && st.diff !== diffNow && !st.picks.length) { G.st = null; return renderTrivia(app, sport); }
    const extra = `<div class="gfree-row"><span class="glabel">Difficulty</span><div class="gchips">${DIFFS.map(([k, l]) => `<button data-diff="${k}" aria-pressed="${diffNow === k}">${l}</button>`).join('')}</div></div>`;
    const q = st.qs[st.i], answered = st.picks.length > st.i;
    const score = st.picks.filter((p, i) => p === st.qs[i].a).length;
    const dots = st.qs.map((x, i) => `<span class="tdot ${i < st.picks.length ? (st.picks[i] === x.a ? 'ok' : 'no') : i === st.i ? 'cur' : ''}"></span>`).join('');
    body.innerHTML = `${topBar(body, sport, G, saved, extra)}
      <div class="box gtrivia">
        <div class="gtriv-top"><div class="tdots" aria-label="Progress">${dots}</div><div class="eyebrow">${st.done ? 'Final' : 'Question ' + (st.i + 1) + ' of ' + st.qs.length} · ${score} right</div></div>
        ${st.done ? `<div class="greveal ${score >= 7 ? 'win' : ''}"><div class="eyebrow">${st.mode === 'daily' ? 'Daily trivia · ' + esc(st.date) : 'Free play · ' + esc((DIFFS.find(d => d[0] === st.diff) || [0, 'Mix'])[1])}</div>
            <h3>${score} / ${st.qs.length}</h3><p>${score === st.qs.length ? 'Perfect. You know your Vols.' : score >= 8 ? 'Excellent. Rocky Top approves.' : score >= 6 ? 'Solid showing.' : score >= 4 ? 'Not bad. Run it back.' : 'Tough set. Try easy mode.'}</p>
            <div class="grow"><button class="btn primary" id="gShare">Copy result</button> <button class="btn" id="gNew">${st.mode === 'daily' ? 'Free play' : 'Play again'}</button></div></div>
          <ol class="trev">${st.qs.map((x, i) => `<li class="${st.picks[i] === x.a ? 'ok' : 'no'}"><span class="tdiff ${x.d}">${x.d}</span> ${esc(x.q)} <b>${esc(x.a)}</b>${st.picks[i] !== x.a ? ` <span class="dim">(you: ${esc(st.picks[i])})</span>` : ''}</li>`).join('')}</ol>`
        : `<div class="tq" ${answered ? '' : 'data-anim="1"'}><span class="tdiff ${q.d}">${q.d}</span><h3>${esc(q.q)}</h3>
            <div class="topts">${q.opts.map((o, k) => { const c = answered ? (o === q.a ? 'ok' : o === st.picks[st.i] ? 'no' : 'off') : ''; return `<button class="topt ${c}" data-o="${k}" ${answered ? 'disabled' : ''}>${esc(o)}</button>`; }).join('')}</div>
            ${answered ? `<p class="tfb ${st.picks[st.i] === q.a ? 'ok' : 'no'}" role="status">${st.picks[st.i] === q.a ? 'Correct!' : 'Not quite. The answer is <b>' + esc(q.a) + '</b>.'}</p><div class="grow"><button class="btn primary" id="tNext">${st.i + 1 < st.qs.length ? 'Next question →' : 'See results'}</button></div>` : ''}</div>`}
      </div>
      <p class="dim small">Questions come from the record books and from season stats in our data. Some stat questions describe a player's best season.${sport === 'football' ? '' : ' ' + esc(COVERAGE[sport])}</p>`;
    bindTop(body, sport, G);
    body.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => { setDiff(sport, b.dataset.diff); G.st = null; rerender(); }));
    body.querySelectorAll('.topt').forEach(b => b.addEventListener('click', () => {
      if (answered) return;
      st.picks.push(q.opts[+b.dataset.o]); saveDaily(sport, 'trivia', st); rerender();
      const nx = document.getElementById('tNext'); if (nx) nx.focus({ preventScroll: true });
    }));
    const nx = body.querySelector('#tNext');
    if (nx) nx.addEventListener('click', () => {
      if (st.i + 1 < st.qs.length) st.i++;
      else {
        st.done = true; const sc = st.picks.filter((p, i) => p === st.qs[i].a).length;
        const lab = st.mode === 'daily' ? ' ' + st.date : ' (' + ((DIFFS.find(d => d[0] === st.diff) || [0, 'Mix'])[1]) + ')';
        st.share = `❓ ${gameName(sport, 'trivia')}${sport === 'football' || SP(sport).lady ? '' : ' · ' + SP(sport).name}${lab}: ${sc}/${st.qs.length}\n${st.qs.map((x, i) => st.picks[i] === x.a ? '🟧' : '⬛').join('')}\n${SITE}`;
      }
      saveDaily(sport, 'trivia', st); rerender();
    });
    const sh = body.querySelector('#gShare'); if (sh) sh.addEventListener('click', e => copyShare(st, e.currentTarget));
    const nw = body.querySelector('#gNew'); if (nw) nw.addEventListener('click', () => { G.mode = 'free'; G.st = null; rerender(); });
  }

  /* ---------- entry ---------- */
  // Vol Dynasty: its own scripts and stylesheet, loaded the first time you open it
  const DYN_FILES = ['dy-data', 'dy-past', 'dy-today', 'dy-core', 'dy-engine', 'dy-sim', 'dy-league', 'dy-off', 'dy-save', 'dy-game', 'dy-ui'];
  function renderDynasty(app) {
    if (!document.querySelector('link[data-dyn]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'assets/dynasty/dynasty.css?v=4'; l.dataset.dyn = 1; document.head.appendChild(l); }
    if (window.VI_DYN && window.DYG) return window.VI_DYN.render(app);
    loading(app, 'Loading Vol Dynasty…');
    let i = 0;
    const next = () => { if (i >= DYN_FILES.length) return window.VI_DYN.render(app); const f = 'assets/dynasty/' + DYN_FILES[i++] + '.js?v=4'; loadScript(f, () => false, next, () => loading(app, 'Could not load Vol Dynasty. Refresh to try again.')); };
    next();
  }
  // Hoops and Diamond Dynasty (basketball, baseball, softball): one set of scripts for all four, plus the football
  // stylesheet and team colors
  const SDYN_FILES = ['sd-data', 'sd-core', 'sd-hoops', 'sd-diamond', 'sd-league', 'sd-off', 'sd-save', 'sd-court', 'sd-game', 'sd-ui'];
  function renderSdyn(app, sport) {
    if (!document.querySelector('link[data-dyn]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'assets/dynasty/dynasty.css?v=4'; l.dataset.dyn = 1; document.head.appendChild(l); }
    if (!document.querySelector('link[data-sdyn]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'assets/sdyn/sdyn.css?v=3'; l.dataset.sdyn = 1; document.head.appendChild(l); }
    if (window.VI_SDYN && window.SDG) return window.VI_SDYN.render(app, sport);
    loading(app, 'Loading the dynasty…');
    const files = (window.DY && window.DY.TEAMS ? [] : ['assets/dynasty/dy-data.js']).concat(SDYN_FILES.map(f => 'assets/sdyn/' + f + '.js'));
    let i = 0;
    const next = () => { if (i >= files.length) return window.VI_SDYN.render(app, sport); loadScript(files[i++] + '?v=3', () => false, next, () => loading(app, 'Could not load the dynasty. Refresh to try again.')); };
    next();
  }
  let last = null;
  function rerender() { if (last) render(last.app, last.sport, last.game, true); }
  function loading(app, msg) { app.innerHTML = `<div class="wrap hub-hero"><div class="eyebrow">Games</div><h1>${esc(msg || 'Loading…')}</h1></div>`; }
  function render(app, sport, game, keepScroll) {
    last = { app, sport, game };
    const y = window.scrollY;
    if (!sport) return renderHome(app);
    const s = SP(sport);
    if (!s) return renderHome(app);
    if (game && !s.games.includes(game)) game = null;
    if (sport === 'football' && game === 'dynasty') return renderDynasty(app);
    if (game === 'dynasty') return renderSdyn(app, sport);
    // football data is needed for every football game; beta sports load their own file
    const ready = sport === 'football' ? () => !!window.VI_GAMES_DATA : () => !!(window.VI_GAMES_SPORT && window.VI_GAMES_SPORT[sport]);
    if (!ready()) { loading(app); return loadScript(s.file, ready, () => render(app, sport, game), () => loading(app, 'Could not load the games data. Refresh to try again.')); }
    if (sport === 'football') initFootball(); else initSport(sport);
    if (!game) renderSportHub(app, sport);
    else if (game === 'run' && sport === 'football') window.VI_RUN ? window.VI_RUN.render(app) : loading(app);
    else if (game === 'run') window.VI_RUN2 ? window.VI_RUN2.render(app, sport) : loading(app);
    else if (game === 'guesser') renderGuesser(app, sport);
    else if (game === 'grid') renderGrid(app);
    else if (game === 'career') renderCareer(app);
    else if (game === 'rankings') renderRankings(app, sport);
    else if (game === 'duel') renderDuel(app, sport);
    else if (game === 'trivia') renderTrivia(app, sport);
    if (keepScroll) window.scrollTo(0, y);
  }
  // route: #games · #games-<sport> · #games-<sport>-<game> · legacy #games-<game> (football)
  window.renderGames = (app, a, b) => {
    if (a && !SP(a) && GAME_ICON[a]) { b = a; a = 'football'; }
    render(app, a || null, b || null, false);
  };
  // shared helpers for assets/games-run.js
  window.VIG = {
    esc, etDate, SITE, reduceMotion, rngFrom, freeSeed, pick, shuffle, gauss, wpick, wsample, ERA_BOOST, decOf, store, copyText, twoTap,
    frame, modeBar, bindMode, dkey, challenge, FB_ERAS, SLOT_NAME, posLabel, statLine, honorChips, getEras, setEras, eraChips, bindEras,
    data: () => ({ D, ALL, POOL, BYNAME }), rerender, initFootball, initSport, SP, RUN_NAME, gameName,
  };
})();
