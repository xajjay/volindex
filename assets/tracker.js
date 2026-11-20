/* The Vol Index — live game tracker (volindex.net/live, /live/football, /live/mbb ...).
   Follows Tennessee's game in real time from ESPN's public feeds (scoreboard for the situation, summary for plays, drives,
   win probability and box score), the same source as the live banner. Refreshes every 10 s while a game is on.
   Football gets the full view: a field with the ball, first-down line and drive trail, win probability against our own pregame
   model, every play grouped by drive, team stats. Other sports get the scoreboard, line score, plays, stats and leaders.
   Fans can turn on score alerts, keep the screen awake and share the link.
   Preview without a real game: /live/football?livedemo=1 replays a simulated Tennessee game (speed with &speed=3). */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/';
  const PATH = { football: ['football/college-football', '&groups=80'], mbb: ['basketball/mens-college-basketball', '&groups=50'], wbb: ['basketball/womens-college-basketball', '&groups=50'],
    baseball: ['baseball/college-baseball', ''], softball: ['softball/college-softball', ''], volleyball: ['volleyball/womens-college-volleyball', ''], soccer: ['soccer/usa.ncaa.w.1', ''] };
  const NAME = { football: 'Football', mbb: "Men's Hoops", wbb: "Women's Hoops", baseball: 'Baseball', softball: 'Softball', volleyball: 'Volleyball', soccer: 'Soccer' };
  const ORANGE = '#FF8200';
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const etDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const etHour = () => +new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }) % 24;
  const isTN = c => c && c.team && (c.team.abbreviation === 'TENN' || c.team.location === 'Tennessee');
  const href = k => window.VI_ROUTER ? window.VI_ROUTER.href(k) : '#' + k;
  const qs = new URLSearchParams(location.search), DEMO = qs.get('livedemo'), DSPEED = Math.max(0.5, +qs.get('speed') || 1);
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const toSec = v => { const m = /^(\d+):(\d+)$/.exec(String(v || '')); return m ? +m[1] * 60 + +m[2] : parseFloat(v); };

  let T = null;          // current tracker: { sport, timer, tick, S, ... }
  let filter = 'all', alerts = LS.get('vi-trk-alerts') === '1', wake = null, seen = new Set(), first = true;

  function schedOf(k) {
    if (k === 'football') return (window.fbData && window.fbData() || (window.SITE || {}).football || {}).schedule || [];
    return ((window.SITE || {})[k] || {}).schedule || [];
  }

  /* ================= ESPN → one shape ================= */
  const side = (c, k) => {
    const t = c.team || {}, tn = isTN(c);
    return { id: t.id, abbr: t.abbreviation || '', name: tn ? 'Tennessee' : (t.location || t.shortDisplayName || t.displayName || ''), tn,
      color: tn ? ORANGE : (t.color ? '#' + t.color : '#555'), alt: t.alternateColor ? '#' + t.alternateColor : '#333', score: +c.score || 0,
      rank: c.curatedRank && c.curatedRank.current && c.curatedRank.current < 99 ? c.curatedRank.current : null,
      record: ((c.record || [])[0] || {}).displayValue || (c.records && c.records[0] && c.records[0].summary) || '', lines: (c.linescores || []).map(x => x.displayValue), winner: !!c.winner };
  };
  function fromEspn(k, sum, ev) {
    const hc = ((sum.header || {}).competitions || [])[0] || (ev && ev.competitions[0]); if (!hc) return null;
    const cs = hc.competitors, hh = cs.find(c => c.homeAway === 'home'), aa = cs.find(c => c.homeAway === 'away');
    const home = side(hh, k), away = side(aa, k), st = hc.status || (ev && ev.status) || {}, ty = st.type || {};
    const S = { sport: k, id: (ev && ev.id) || (sum.header || {}).id, state: ty.state || 'pre', detail: ty.shortDetail || ty.detail || '', clock: st.displayClock || '', period: st.period || 0,
      start: hc.date || (ev && ev.date), home, away, us: home.tn ? 'home' : 'away', plays: [], drives: [], wp: [], wpIds: [], stats: [], leaders: [], poss: null, venue: ((sum.gameInfo || {}).venue || {}).fullName || '',
      tv: (((hc.broadcasts || [])[0] || {}).names || []).join(', ') || (((hc.broadcast || '')) || '') };
    // situation (the scoreboard carries it; the summary's current drive is the fallback)
    const sit = (ev && ev.competitions[0].situation) || {};
    if (S.state === 'in') {
      const pid = sit.possession || (sum.drives && sum.drives.current && sum.drives.current.team && sum.drives.current.team.id);
      S.poss = pid ? (pid === home.id ? 'home' : pid === away.id ? 'away' : null) : null;
      S.down = sit.down; S.dist = sit.distance; S.dd = sit.downDistanceText || sit.shortDownDistanceText || ''; S.red = !!sit.isRedZone;
      S.to = [sit.awayTimeouts, sit.homeTimeouts];
      const m = /([A-Z&]{2,6})\s+(\d{1,2})\s*$/.exec(sit.possessionText || S.dd || ''), me = S.poss && S[S.poss];
      if (m && me) S.ytg = m[1] === me.abbr ? 100 - +m[2] : +m[2];
      else if (sit.yardsToEndzone != null) S.ytg = sit.yardsToEndzone;
      if (/50$/.test(sit.possessionText || '')) S.ytg = 50;
      S.last = (sit.lastPlay && sit.lastPlay.text) || '';
    }
    // plays, grouped by drive for football
    const mapPlay = (p, drv, di) => ({ id: p.id, per: (p.period && p.period.number) || 0, clk: (p.clock && p.clock.displayValue) || '', text: p.text || p.shortText || '', type: (p.type && p.type.text) || '',
      scoring: !!p.scoringPlay, hs: p.homeScore, as: p.awayScore, yds: p.statYardage, d: di, team: (p.start && p.start.team && p.start.team.id) || (drv && drv.team && drv.team.id) || (p.team && p.team.id) || null,
      down: p.start && p.start.down, dist: p.start && p.start.distance, ytg: p.start && p.start.yardsToEndzone });
    const dr = sum.drives ? (sum.drives.previous || []).concat(sum.drives.current ? [sum.drives.current] : []) : [];
    if (dr.length) dr.forEach((d, di) => {
      S.drives.push({ team: d.team && d.team.id, desc: d.description || '', n: d.offensivePlays, yds: d.yards, top: d.timeElapsed && d.timeElapsed.displayValue, result: d.displayResult || d.result || '', score: !!d.isScore, cur: d === sum.drives.current && S.state === 'in' });
      (d.plays || []).forEach(p => S.plays.push(mapPlay(p, d, di)));
    });
    else (sum.plays || sum.keyEvents || []).forEach(p => S.plays.push(mapPlay(p, null, -1)));
    S.plays = S.plays.filter(p => p.text);
    // win probability (home %)
    (sum.winprobability || []).forEach(w => { S.wp.push(Math.round((w.homeWinPercentage ?? 0.5) * 1000) / 10); S.wpIds.push(w.playId); });
    // team stats
    const bt = (sum.boxscore || {}).teams || [], tt = x => bt.find(b => b.team && b.team.id === x.id), a = tt(away), h = tt(home);
    if (a && h) {
      const WANT = [['totalYards', 'Total yards'], ['yardsPerPlay', 'Yards per play'], ['rushingYards', 'Rushing yards'], ['netPassingYards', 'Passing yards'], ['firstDowns', 'First downs'], ['thirdDownEff', '3rd down'],
        ['turnovers', 'Turnovers'], ['totalPenaltiesYards', 'Penalties'], ['possessionTime', 'Time of possession'], ['fieldGoalPct', 'FG %'], ['threePointFieldGoalPct', '3-pt %'], ['totalRebounds', 'Rebounds'], ['assists', 'Assists'], ['hits', 'Hits'], ['errors', 'Errors']];
      WANT.forEach(([n, l]) => { const x = (a.statistics || []).find(s => s.name === n), y = (h.statistics || []).find(s => s.name === n); if (x && y && x.displayValue != null) S.stats.push({ l, a: x.displayValue, h: y.displayValue, low: /turnover|penalt|error/i.test(l) }); });
    }
    // leaders
    ((sum.leaders || [])).forEach(L => {
      (L.leaders || []).forEach(c => { const e = (c.leaders || [])[0]; if (!e) return; const row = S.leaders.find(r => r.l === c.displayName) || (S.leaders.push({ l: c.displayName, away: '', home: '' }), S.leaders[S.leaders.length - 1]);
        const txt = `${(e.athlete || {}).shortName || (e.athlete || {}).displayName || ''} <i>${esc(e.displayValue || '')}</i>`;
        if (L.team && L.team.id === home.id) row.home = txt; else row.away = txt; });
    });
    return S;
  }
  function preFromSchedule(k) {
    const s = schedOf(k), t = etDate(), g = s.find(x => x.date >= t && !x.result) || s[s.length - 1]; if (!g) return null;
    const mk = (n, tn) => ({ id: n, abbr: tn ? 'TENN' : String(g.opp || '').slice(0, 4).toUpperCase(), name: tn ? 'Tennessee' : g.opp, tn, color: tn ? ORANGE : '#555', alt: '#333', score: 0, rank: null, record: '', lines: [] });
    const homeUs = !/^at|@/.test(g.site || '') && g.site !== 'A' && g.home !== false && !/away/i.test(g.site || '');
    const us = mk('ut', true), them = mk('opp', false);
    return { sport: k, id: null, state: 'pre', detail: g.time || '', start: g.dateTime || null, date: g.date, home: homeUs ? us : them, away: homeUs ? them : us, us: homeUs ? 'home' : 'away', plays: [], drives: [], wp: [], wpIds: [], stats: [], leaders: [], tv: g.tv || '', venue: '' };
  }

  /* ================= demo feed: a simulated game played back live ================= */
  function demoFeed(k) {
    const prof = (i) => VP._profile(null, i, 10), Ms = [VP._matchup(prof(0), prof(1)), VP._matchup(prof(1), prof(0))], rec = [];
    VP._sim(Ms, 4242 + Math.floor(Date.now() / 36e5) % 50, rec, [{ team: 'Tennessee' }, { team: 'LSU' }]);
    const plays = rec.filter(p => p.type !== 'pat').map((p, i) => ({ id: 'd' + i, per: p.q > 4 ? 4 : p.q, clk: mmss(p.clk || 0), text: p.text, type: p.type, scoring: !!(p.td || p.good || p.td6 || p.safety) && p.type !== 'ko' || false, hs: p.sc[0], as: p.sc[1],
      yds: p.y, d: 0, team: p.o === 0 ? 'home' : 'away', down: p.down, dist: p.togo, ytg: 100 - p.ball, big: Math.abs(p.y) >= 20, raw: p }));
    let n = 3; const t0 = Date.now();
    return async () => {
      n = Math.min(plays.length, 3 + Math.floor((Date.now() - t0) / (3000 / DSPEED)));
      const vis = plays.slice(0, n), last = vis[vis.length - 1], nx = plays[n], done = n >= plays.length;
      const home = { id: 'h', abbr: 'TENN', name: 'Tennessee', tn: true, color: ORANGE, alt: '#fff', score: last.hs, rank: 12, record: '8-2', lines: [] }, away = { id: 'a', abbr: 'LSU', name: 'LSU', tn: false, color: '#461D7C', alt: '#FDD023', score: last.as, rank: 14, record: '7-3', lines: [] };
      const sc = [[0, 0, 0, 0], [0, 0, 0, 0]]; vis.forEach(p => { });
      let tot = [0, 0], rush = [0, 0], pass = [0, 0], tov = [0, 0];
      vis.forEach(p => { const o = p.team === 'home' ? 0 : 1; if (p.type === 'run' || p.type === 'pass') { tot[o] += p.yds; (p.type === 'run' ? rush : pass)[o] += p.yds; } if (/int|fum/i.test(p.type + p.raw.to)) tov[o]++; });
      const left = last.per > 4 ? 0.02 : Math.max(0.01, ((4 - last.per) * 900 + toSec(last.clk)) / 3600), m = 1.6, wp = vis.map(p => { const l = p.per > 4 ? 0.02 : Math.max(0.01, ((4 - p.per) * 900 + toSec(p.clk)) / 3600); const z = (p.hs - p.as + m * l) / (15 * Math.sqrt(l) + 1.2); return Math.round(1000 / (1 + Math.exp(-1.702 * z))) / 10; });
      const live = !done && nx && nx.type !== 'ko';
      return { sport: k, id: 'demo', state: done ? 'post' : 'in', detail: done ? 'Final' : `Q${last.per} ${last.clk}`, clock: last.clk, period: last.per, start: new Date().toISOString(), home, away, us: 'home', demo: true,
        poss: live ? (nx.team) : null, down: nx && nx.down, dist: nx && nx.dist, ytg: nx && nx.ytg, dd: nx && nx.down ? `${['', '1st', '2nd', '3rd', '4th'][nx.down]} & ${nx.dist}` : '', red: nx && nx.ytg <= 20, to: [3, 3],
        last: last.text, plays: vis.map(p => Object.assign({}, p, { team: p.team === 'home' ? 'h' : 'a' })), drives: [], wp, wpIds: vis.map(p => p.id),
        stats: [{ l: 'Total yards', a: String(tot[1]), h: String(tot[0]) }, { l: 'Rushing yards', a: String(rush[1]), h: String(rush[0]) }, { l: 'Passing yards', a: String(pass[1]), h: String(pass[0]) }, { l: 'Turnovers', a: String(tov[1]), h: String(tov[0]), low: true }],
        leaders: [], tv: 'ESPN (demo)', venue: 'Neyland Stadium · simulated game' };
    };
  }

  /* ================= data loop ================= */
  async function getJson(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw 0; return r.json(); }
  async function findEvent(k) {
    const [p, q] = PATH[k], days = [etDate()]; if (etHour() < 4) days.unshift(etDate(new Date(Date.now() - 864e5)));
    for (const d of days) {
      try { const j = await getJson(`${ESPN}${p}/scoreboard?dates=${d.replace(/-/g, '')}&limit=500${q}`); const ev = (j.events || []).find(e => e.competitions && e.competitions[0].competitors.some(isTN)); if (ev) return ev; } catch (e) { }
    }
    return null;
  }
  function pickSport(want) {
    if (want && PATH[want]) return want;
    const L = window.VI_LIVE || {}, live = Object.keys(L).find(k => L[k].state === 'in'); if (live) return live;
    const t = etDate(), tod = Object.keys(PATH).find(k => schedOf(k).some(g => g.date === t)); if (tod) return tod;
    return 'football';
  }
  async function load() {
    const k = T.sport; let S = null;
    try {
      if (DEMO && k === 'football') { T.feed = T.feed || demoFeed(k); S = await T.feed(); }
      else {
        const ev = await findEvent(k);
        if (ev) {
          let sum = {}; try { sum = await getJson(`${ESPN}${PATH[k][0]}/summary?event=${ev.id}`); } catch (e) { }
          S = fromEspn(k, sum, ev);
        }
      }
    } catch (e) { if (DEMO) console.error('tracker demo:', e && e.stack || e); }
    if (!S) S = preFromSchedule(k);
    T.S = S; T.at = Date.now(); T.err = !S;
    paint();
    clearTimeout(T.timer);
    if (S && S.state === 'in') T.timer = setTimeout(load, DEMO ? 2000 : 10e3);
    else if (S && S.state === 'pre') { const ms = S.start ? new Date(S.start) - Date.now() : 1e9; T.timer = setTimeout(load, ms < 20 * 60e3 ? 30e3 : 5 * 60e3); }
    else if (S && S.state === 'post' && !DEMO) T.timer = null;
  }

  /* ================= rendering ================= */
  const rk = t => t.rank ? `<i class="trk-rk">${t.rank}</i>` : '';
  const fld = { X: y => 100 + y * 10 };
  function fieldSvg() {
    let s = `<svg class="trk-field" viewBox="0 0 1200 380" role="img" aria-label="Football field showing the ball, line of scrimmage and first-down line"><defs><linearGradient id="trkgrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E7D3B"/><stop offset="1" stop-color="#256B31"/></linearGradient></defs>
      <rect x="0" y="0" width="1200" height="380" rx="14" fill="url(#trkgrass)"/>
      <rect id="trkEzA" x="0" y="0" width="100" height="380" fill="#555" opacity=".92"/><rect id="trkEzH" x="1100" y="0" width="100" height="380" fill="#555" opacity=".92"/>
      <text id="trkEzAt" x="50" y="190" transform="rotate(-90 50 190)" text-anchor="middle" class="trk-ez"></text><text id="trkEzHt" x="1150" y="190" transform="rotate(90 1150 190)" text-anchor="middle" class="trk-ez"></text>`;
    for (let y = 0; y <= 100; y += 5) s += `<line x1="${fld.X(y)}" x2="${fld.X(y)}" y1="0" y2="380" stroke="#fff" stroke-opacity="${y % 10 === 0 ? .75 : .3}" stroke-width="${y === 0 || y === 100 ? 5 : 2}"/>`;
    for (let y = 10; y <= 90; y += 10) { const n = y <= 50 ? y : 100 - y; s += `<text x="${fld.X(y)}" y="352" text-anchor="middle" class="trk-yd">${n}</text><text x="${fld.X(y)}" y="46" text-anchor="middle" class="trk-yd" transform="rotate(180 ${fld.X(y)} 34)">${n}</text>`; }
    for (let y = 1; y < 100; y++) if (y % 5) s += `<line x1="${fld.X(y)}" x2="${fld.X(y)}" y1="150" y2="160" stroke="#fff" stroke-opacity=".35"/><line x1="${fld.X(y)}" x2="${fld.X(y)}" y1="220" y2="230" stroke="#fff" stroke-opacity=".35"/>`;
    s += `<rect id="trkRed" x="0" y="0" width="0" height="380" fill="#E0201B" opacity="0"/><g id="trkTrail"><rect id="trkTr" x="0" y="172" width="0" height="36" fill="#FF8200" opacity=".38" rx="6"/></g>
      <g id="trkLos" class="trk-mv"><line x1="0" x2="0" y1="0" y2="380" stroke="#2F6BFF" stroke-width="5"/></g><g id="trkFd" class="trk-mv"><line x1="0" x2="0" y1="0" y2="380" stroke="#FFD21F" stroke-width="6"/></g>
      <g id="trkBall" class="trk-mv"><ellipse cx="0" cy="190" rx="26" ry="15" fill="#7A3E12" stroke="#fff" stroke-width="3"/><path d="M-9 190h18M-4 184v12M0 184v12M4 184v12" stroke="#fff" stroke-width="2"/><path id="trkArrow" d="M34 190l-14-12v24z" fill="#fff"/></g></svg>`;
    return s;
  }
  function wpSvg(S, pre) {
    const w = S.wp.map(v => S.us === 'home' ? v : 100 - v), n = w.length; if (n < 2) return `<p class="dim trk-empty">The win-probability chart starts once the game is under way.</p>`;
    const W = 640, H = 190, px = i => 6 + (W - 12) * i / (n - 1), py = v => 8 + (H - 16) * (1 - v / 100);
    const pts = w.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`), line = 'M' + pts.join('L'), area = `${line}L${px(n - 1)},${py(50)}L${px(0)},${py(50)}Z`;
    let marks = '', q = 0; S.plays.forEach((p, i) => { const j = S.wpIds.indexOf(p.id); if (j < 0) return; if (p.per > q && p.per <= 4) { q = p.per; if (q > 1) marks += `<line x1="${px(j)}" x2="${px(j)}" y1="8" y2="${H - 8}" stroke="var(--line-strong)" stroke-dasharray="3 4"/><text x="${px(j) + 4}" y="20" class="trk-q">Q${q}</text>`; }
      if (p.scoring) marks += `<circle cx="${px(j)}" cy="${py(w[j])}" r="4.5" fill="${ORANGE}" stroke="var(--surface)" stroke-width="1.5"/>`; });
    return `<div class="trk-wp" id="trkWp"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Tennessee win probability over the game"><defs><clipPath id="wU"><rect x="0" y="0" width="${W}" height="${py(50)}"/></clipPath><clipPath id="wD"><rect x="0" y="${py(50)}" width="${W}" height="${H}"/></clipPath></defs>
      <line x1="6" x2="${W - 6}" y1="${py(50)}" y2="${py(50)}" stroke="var(--line-strong)"/>${pre != null ? `<line x1="6" x2="${W - 6}" y1="${py(pre)}" y2="${py(pre)}" stroke="var(--muted)" stroke-dasharray="5 5"/>` : ''}
      <path d="${area}" fill="${ORANGE}" opacity=".28" clip-path="url(#wU)"/><path d="${area}" fill="#777" opacity=".25" clip-path="url(#wD)"/>${marks}<path d="${line}" fill="none" stroke="${ORANGE}" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><div class="trk-wptip" id="trkWpTip" hidden></div></div>`;
  }
  const modelFor = S => {
    if (S.sport !== 'football' || !window.MODEL_FB || !window.MODEL_FB.games) return null;
    const opp = (S.us === 'home' ? S.away : S.home).name; return window.MODEL_FB.games.find(g => g.opp === opp) || null;
  };
  const tmOf = (S, id) => id === 'h' || id === S.home.id ? S.home : S.away;
  function teamRow(S, t) {
    const hasBall = S.state === 'in' && S.poss && S[S.poss] === t;
    return `<div class="trk-team${t.tn ? ' ut' : ''}${S.state === 'post' && t.winner ? ' won' : ''}"><span class="trk-dot" style="background:${esc(t.color)}"></span><span class="trk-nm">${rk(t)}${esc(t.name)}${hasBall ? '<i class="poss" title="Has the ball"></i>' : ''}<small>${esc(t.record)}</small></span><b class="trk-sc">${t.score}</b></div>`;
  }
  function head(S) {
    const live = S.state === 'in', fin = S.state === 'post', st = live ? `<span class="livedot"></span><b>LIVE</b> · ${esc(S.detail)}` : fin ? '<b>Final</b>' : `<b>${esc(S.detail || 'Upcoming')}</b>`;
    const sit = live && S.dd ? `<div class="trk-sit">${esc(S.dd)}${S.red ? ' · <b class="red">Red zone</b>' : ''}</div>` : '';
    return `<div class="trk-board"><div class="trk-st">${st}</div>${teamRow(S, S.away)}${teamRow(S, S.home)}${sit}<div class="trk-meta">${[S.tv, S.venue].filter(Boolean).map(esc).join(' · ')}</div></div>`;
  }
  function stickyBar(S) {
    const live = S.state === 'in';
    return `${live ? '<span class="livedot"></span>' : ''}<b>${esc(S.away.abbr)} ${S.away.score}</b> <span>·</span> <b>${esc(S.home.abbr)} ${S.home.score}</b> <em>${live ? esc(S.detail) : S.state === 'post' ? 'Final' : esc(S.detail || 'Upcoming')}</em>`;
  }
  function pregame(S) {
    const g = modelFor(S), ms = S.start ? new Date(S.start) - Date.now() : null;
    const when = S.start ? new Date(S.start).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : (S.date ? new Date(S.date + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : '');
    const cd = ms > 0 ? (d => `${d.d ? d.d + 'd ' : ''}${d.h}h ${String(d.m).padStart(2, '0')}m ${String(d.s).padStart(2, '0')}s`)({ d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 }) : '';
    const tnWin = g ? Math.round(g.win * 100) : null;
    return `<div class="trk-card trk-pre"><div class="eyebrow">Pregame</div><h2>${esc(S.away.name)} at ${esc(S.home.name)}</h2><p class="dim">${esc(when)}${S.tv ? ' · ' + esc(S.tv) : ''}</p>
      ${cd ? `<div class="trk-cd" id="trkCd">${cd}</div>` : ''}
      ${g ? `<div class="trk-model"><b>${tnWin}%</b> Tennessee win chance in our model · projected ${Math.round(g.ptsU)}–${Math.round(g.ptsO)}<br><a href="${href('football-schedule')}">See the full prediction and simulation ›</a></div>` : ''}
      <p class="dim small">This page switches to live play-by-play the moment the game kicks off. Keep it open, turn on score alerts below, and it will keep the score, the field, the win probability and every drive up to date.</p></div>`;
  }
  const FILT = [['all', 'All plays'], ['score', 'Scoring'], ['big', 'Big plays'], ['tov', 'Turnovers'], ['ut', 'Tennessee']];
  const isBig = p => p.big || (p.yds != null && p.yds >= 20), isTov = p => /intercept|fumble|turnover on downs|safety/i.test(p.type + ' ' + p.text);
  function playsHtml(S) {
    if (!S.plays.length) return S.state === 'pre' ? '' : '<p class="dim">Plays will appear here as they happen.</p>';
    const utId = (S.us === 'home' ? S.home : S.away), ok = p => filter === 'all' || (filter === 'score' && p.scoring) || (filter === 'big' && isBig(p)) || (filter === 'tov' && isTov(p)) || (filter === 'ut' && p.team != null && tmOf(S, p.team) === utId);
    const row = p => `<li class="${p.scoring ? 'sc' : ''}${isTov(p) ? ' tov' : ''}${isBig(p) ? ' big' : ''}"><span class="trk-t">${p.per ? (p.per > 4 ? 'OT' : 'Q' + p.per) : ''} ${esc(p.clk)}</span><span class="trk-x">${p.down ? `<small>${['', '1st', '2nd', '3rd', '4th'][p.down] || ''} &amp; ${p.dist}</small> ` : ''}${esc(p.text)}${p.scoring && p.hs != null ? ` <b class="trk-ss">${S.away.abbr} ${p.as} – ${S.home.abbr} ${p.hs}</b>` : ''}</span></li>`;
    if (S.drives.length) {
      const out = []; for (let di = S.drives.length - 1; di >= 0; di--) {
        const d = S.drives[di], ps = S.plays.filter(p => p.d === di && ok(p)); if (!ps.length) continue; const t = tmOf(S, d.team);
        out.push(`<div class="trk-drive${d.cur ? ' cur' : ''}"><div class="trk-dh" style="border-color:${esc(t.color)}"><b>${esc(t.name)}</b> <span>${d.n != null ? d.n + ' plays, ' : ''}${d.yds != null ? d.yds + ' yds' : ''}${d.top ? ', ' + esc(d.top) : ''}</span> <em class="${d.score ? 'tdp' : ''}">${d.cur ? 'In progress' : esc(d.result)}</em></div><ol>${ps.slice().reverse().map(row).join('')}</ol></div>`);
      }
      return out.join('') || '<p class="dim">No plays match this filter yet.</p>';
    }
    const ps = S.plays.filter(ok).slice(-80).reverse(); return ps.length ? `<ol class="trk-flat">${ps.map(row).join('')}</ol>` : '<p class="dim">No plays match this filter yet.</p>';
  }
  function statsHtml(S) {
    if (!S.stats.length) return '';
    return `<div class="trk-card"><h3>Team stats</h3><div class="trk-sh"><b style="color:${esc(S.away.color)}">${esc(S.away.abbr)}</b><b style="color:${esc(S.home.color)}">${esc(S.home.abbr)}</b></div>${S.stats.map(r => {
      const a = toSec(r.a), h = toSec(r.h), tot = (a || 0) + (h || 0), pa = tot > 0 && isFinite(a) && isFinite(h) ? Math.round(100 * a / tot) : 50;
      return `<div class="trk-sr"><span>${esc(r.a)}</span><div class="trk-bar"><i style="width:${pa}%;background:${esc(S.away.color)}"></i><i style="width:${100 - pa}%;background:${esc(S.home.color)}"></i></div><span>${esc(r.h)}</span><small>${esc(r.l)}</small></div>`; }).join('')}</div>`;
  }
  function lineHtml(S) {
    const n = Math.max(S.home.lines.length, S.away.lines.length); if (!n) return '';
    const h = Array.from({ length: n }, (_, i) => `<th class="n">${i + 1}</th>`).join(''), r = t => `<tr class="${t.tn ? 'me' : ''}"><td><b>${esc(t.abbr)}</b></td>${Array.from({ length: n }, (_, i) => `<td class="n">${esc(t.lines[i] ?? '')}</td>`).join('')}<td class="n"><b>${t.score}</b></td></tr>`;
    return `<div class="trk-card"><h3>Line score</h3><div class="tablewrap"><table class="lbx-line"><thead><tr><th></th>${h}<th class="n">T</th></tr></thead><tbody>${r(S.away)}${r(S.home)}</tbody></table></div></div>`;
  }
  function leadersHtml(S) {
    if (!S.leaders.length) return '';
    return `<div class="trk-card"><h3>Leaders</h3><div class="tablewrap"><table><thead><tr><th>${esc(S.away.abbr)}</th><th></th><th>${esc(S.home.abbr)}</th></tr></thead><tbody>${S.leaders.map(r => `<tr><td>${r.away}</td><td class="dim small">${esc(r.l)}</td><td>${r.home}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function chips(k) {
    const live = window.VI_LIVE || {};
    return Object.keys(PATH).map(s => `<a class="trk-chip${s === k ? ' on' : ''}" href="${href('live-' + s)}">${live[s] && live[s].state === 'in' ? '<span class="livedot"></span>' : ''}${NAME[s]}</a>`).join('');
  }

  function skeleton(el, k) {
    el.innerHTML = `<main class="trk" id="trk"><div class="trk-top"><h1>Live tracker</h1><div class="trk-chips">${chips(k)}</div></div>
      <div class="trk-sticky" id="trkSticky" hidden></div>
      <div id="trkHead"></div><div id="trkToast" class="trk-toast" hidden></div>
      <div class="trk-grid"><div class="trk-main">
        <div class="trk-card" id="trkFieldCard" hidden><div class="trk-fh"><span id="trkFieldTxt"></span></div>${fieldSvg()}<div class="trk-last" id="trkLast"></div></div>
        <div id="trkPre"></div>
        <div class="trk-card" id="trkWpCard" hidden><div class="trk-wh"><h3>Win probability</h3><div class="trk-wn"><b id="trkWpNow"></b><small id="trkWpPre"></small></div></div><div id="trkWpBox"></div></div>
        <div class="trk-card" id="trkPlayCard" hidden><div class="trk-ph"><h3>Play by play</h3><div class="trk-filt" id="trkFilt">${FILT.map(f => `<button type="button" data-f="${f[0]}" class="${f[0] === filter ? 'on' : ''}">${f[1]}</button>`).join('')}</div></div><div id="trkPlays"></div></div>
      </div><aside class="trk-side" id="trkSide"></aside></div>
      <div class="trk-foot"><div class="trk-tools"><button type="button" class="btn" id="trkAlerts"></button><button type="button" class="btn" id="trkWake">Keep screen on</button><button type="button" class="btn" id="trkShare">Share</button><a class="btn" id="trkEspn" target="_blank" rel="noopener" hidden>Open on ESPN ›</a></div>
      <p class="dim small" id="trkUpd"></p><p class="dim small">Scores, plays and win probability come from ESPN's public game feed and refresh every 10 seconds. Our model's pregame win chance is the dashed line on the chart. Updates can lag the TV broadcast by a minute or two.</p></div></main>`;
    document.getElementById('trkFilt').addEventListener('click', e => { const b = e.target.closest('button[data-f]'); if (!b) return; filter = b.dataset.f; document.querySelectorAll('#trkFilt button').forEach(x => x.classList.toggle('on', x === b)); T.hp = ''; paint(); });
    document.getElementById('trkAlerts').addEventListener('click', toggleAlerts); document.getElementById('trkWake').addEventListener('click', toggleWake);
    document.getElementById('trkShare').addEventListener('click', share);
    const box = document.getElementById('trkWpBox'); box.addEventListener('pointermove', wpTip); box.addEventListener('pointerleave', () => { const t = document.getElementById('trkWpTip'); if (t) t.hidden = true; });
    updAlertBtn();
    const sb = document.getElementById('trkSticky'), hd = document.getElementById('trkHead');
    if ('IntersectionObserver' in window) { T.io = new IntersectionObserver(es => { sb.hidden = es[0].isIntersecting || !T.S || T.S.state === 'pre'; }, { threshold: 0 }); T.io.observe(hd); }
  }
  function set(id, html, key) { const el = document.getElementById(id); if (!el) return; const h = key == null ? html : key; if (el.dataset.h !== String(h)) { el.dataset.h = h; el.innerHTML = html; } }
  function paint() {
    const S = T && T.S, root = document.getElementById('trk'); if (!root) return;
    if (!S) { set('trkHead', `<div class="trk-card"><h2>No ${esc(NAME[T.sport])} game to follow right now</h2><p class="dim">Pick another sport above, or check the schedule.</p></div>`); return; }
    const live = S.state === 'in', fin = S.state === 'post';
    set('trkHead', head(S)); const sb = document.getElementById('trkSticky'); if (sb) sb.innerHTML = stickyBar(S);
    document.getElementById('trkPre').innerHTML = S.state === 'pre' ? pregame(S) : '';
    document.body.classList.add('trk-on');
    // field (football)
    const fc = document.getElementById('trkFieldCard'), isFb = S.sport === 'football';
    fc.hidden = !(isFb && (live || (fin && S.plays.length)));
    if (!fc.hidden) {
      const ez = (id, tid, t) => { document.getElementById(id).setAttribute('fill', t.color); document.getElementById(tid).textContent = t.name.toUpperCase(); };
      ez('trkEzA', 'trkEzAt', S.home); ez('trkEzH', 'trkEzHt', S.away);   // home defends the left end zone and attacks right
      const ball = document.getElementById('trkBall'), los = document.getElementById('trkLos'), fd = document.getElementById('trkFd'), tr = document.getElementById('trkTr'), red = document.getElementById('trkRed');
      const on = live && S.poss && S.ytg != null && isFinite(S.ytg), ids = [ball, los, fd, tr, red];
      ids.forEach(e => e.style.opacity = on ? '' : '0');
      if (on) {
        const right = S.poss === 'home', pos = right ? 100 - S.ytg : S.ytg, x = fld.X(pos), fdPos = right ? Math.min(100, pos + (S.dist || 0)) : Math.max(0, pos - (S.dist || 0));
        ball.style.transform = `translateX(${x}px)`; los.style.transform = `translateX(${x}px)`; fd.style.transform = `translateX(${fld.X(fdPos)}px)`; fd.style.opacity = S.down ? '' : '0';
        document.getElementById('trkArrow').setAttribute('d', right ? 'M30 190l-12-11v22z' : 'M-30 190l12-11v22z');
        const o = S[S.poss];
        if (!T.driveStart || T.driveStart.team !== S.poss || T.driveStart.d !== (S.plays.length ? S.plays[S.plays.length - 1].d : -1)) T.driveStart = { team: S.poss, d: S.plays.length ? S.plays[S.plays.length - 1].d : -1, pos };
        const a = fld.X(Math.min(pos, T.driveStart.pos)), b = fld.X(Math.max(pos, T.driveStart.pos)); tr.setAttribute('x', a); tr.setAttribute('width', Math.max(0, b - a)); tr.setAttribute('fill', o.color);
        const zx = right ? fld.X(80) : fld.X(0), zw = 200; red.setAttribute('x', zx); red.setAttribute('width', S.red ? zw : 0); red.style.opacity = S.red ? '.18' : '0';
        document.getElementById('trkFieldTxt').innerHTML = `<b>${esc(o.name)}</b> ball · ${esc(S.dd || '')} · ${pos >= 50 ? 'at the ' + esc(S[right ? 'away' : 'home'].abbr) + ' ' + (100 - pos) : 'at its own ' + pos}`.replace(/at the (\w+) 50/, 'at midfield');
      } else document.getElementById('trkFieldTxt').textContent = fin ? 'Final' : 'Waiting for the next snap';
      set('trkLast', S.plays.length ? `<b>Last play</b> ${esc((S.plays[S.plays.length - 1] || {}).text || S.last || '')}` : esc(S.last || ''));
    }
    // win probability
    const wc = document.getElementById('trkWpCard'), g = modelFor(S), pre = g ? Math.round(g.win * 100) : null;
    wc.hidden = !(S.wp.length > 1); if (!wc.hidden) {
      set('trkWpBox', wpSvg(S, pre), S.wp.length + ':' + S.wp[S.wp.length - 1]);
      const v = S.wp[S.wp.length - 1], ut = Math.round(S.us === 'home' ? v : 100 - v); document.getElementById('trkWpNow').textContent = ut + '%'; document.getElementById('trkWpPre').textContent = (pre != null ? `Tennessee · our pregame model ${pre}%` : 'Tennessee') + (S.demo ? '' : ' · ESPN live');
    }
    // plays
    const pc = document.getElementById('trkPlayCard'); pc.hidden = !S.plays.length;
    if (S.plays.length) set('trkPlays', playsHtml(S), S.plays.length + ':' + filter + ':' + S.state + ':' + (S.plays[S.plays.length - 1].text || '').length);
    set('trkSide', lineHtml(S) + statsHtml(S) + leadersHtml(S) + (S.state === 'pre' ? '' : `<div class="trk-card trk-links"><a href="${href('football-schedule')}">Our prediction for this game ›</a></div>`), JSON.stringify([S.home.score, S.away.score, S.stats.length && S.stats[0].a, S.state, S.leaders.length]));
    const es = document.getElementById('trkEspn'); if (es && S.id) { es.href = `https://www.espn.com/${S.sport === 'football' ? 'college-football' : 'college-' + (S.sport === 'mbb' ? 'basketball' : S.sport)}/game/_/gameId/${S.id}`; es.hidden = S.demo; }
    // scoring alerts
    const sc = S.plays.filter(p => p.scoring);
    if (first) { sc.forEach(p => seen.add(p.id)); first = false; }
    else sc.forEach(p => { if (seen.has(p.id)) return; seen.add(p.id); celebrate(S, p); });
    updUpd();
  }
  function celebrate(S, p) {
    const el = document.getElementById('trkToast'), mine = p.team != null && tmOf(S, p.team).tn;
    if (el) { el.className = 'trk-toast ' + (mine ? 'ut' : 'opp'); el.innerHTML = `<b>${/touchdown/i.test(p.text + p.type) ? 'TOUCHDOWN' : /field goal/i.test(p.text + p.type) ? 'FIELD GOAL' : 'SCORE'}</b> ${esc(p.text)}`; el.hidden = false; clearTimeout(T.toast); T.toast = setTimeout(() => { el.hidden = true; }, 7000); }
    if (alerts) { try { if (navigator.vibrate) navigator.vibrate(mine ? [120, 60, 120] : 60); } catch (e) {} try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(`${S.away.abbr} ${S.away.score}, ${S.home.abbr} ${S.home.score}`, { body: p.text, icon: 'assets/icons/icon-192.png' }); } catch (e) {} }
  }
  function updAlertBtn() { const b = document.getElementById('trkAlerts'); if (b) b.textContent = alerts ? 'Score alerts: on' : 'Turn on score alerts'; if (b) b.classList.toggle('primary', alerts); }
  async function toggleAlerts() {
    if (!alerts) { try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) { } alerts = true; } else alerts = false;
    LS.set('vi-trk-alerts', alerts ? '1' : '0'); updAlertBtn();
    const u = document.getElementById('trkUpd'); if (u && alerts) u.dataset.note = ('Notification' in window && Notification.permission === 'granted') ? 'Alerts buzz your phone and notify you while this page is open in the background.' : 'Alerts will vibrate your phone and flash on screen while this page is open. Allow notifications in your browser to get them in the background.';
  }
  async function toggleWake() {
    const b = document.getElementById('trkWake'); if (!('wakeLock' in navigator)) { b.textContent = 'Not supported on this browser'; return; }
    try { if (wake) { await wake.release(); wake = null; b.textContent = 'Keep screen on'; b.classList.remove('primary'); } else { wake = await navigator.wakeLock.request('screen'); b.textContent = 'Screen stays on'; b.classList.add('primary'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { b.textContent = 'Couldn\'t keep screen on'; }
  }
  async function share() {
    const S = T.S, u = location.origin + location.pathname, t = S ? `${S.away.abbr} ${S.away.score}, ${S.home.abbr} ${S.home.score} — follow live on The Vol Index` : 'Follow Tennessee live on The Vol Index';
    try { if (navigator.share) await navigator.share({ title: 'Vol Index live tracker', text: t, url: u }); else { await navigator.clipboard.writeText(u); document.getElementById('trkShare').textContent = 'Link copied'; } } catch (e) { }
  }
  function wpTip(e) {
    const S = T.S, box = document.getElementById('trkWpBox'), tip = document.getElementById('trkWpTip'); if (!S || !tip || S.wp.length < 2) return;
    const r = box.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), i = Math.round(f * (S.wp.length - 1)), p = S.plays.find(x => x.id === S.wpIds[i]), v = S.wp[i], ut = Math.round(S.us === 'home' ? v : 100 - v);
    tip.hidden = false; tip.style.left = Math.min(r.width - 170, Math.max(0, f * r.width - 80)) + 'px'; tip.innerHTML = `<b>${ut}%</b> ${p ? (p.per ? 'Q' + p.per + ' ' + esc(p.clk) + ' · ' : '') + esc(p.text).slice(0, 110) : ''}`;
  }
  function updUpd() { const u = document.getElementById('trkUpd'); if (!u || !T) return; const s = Math.round((Date.now() - T.at) / 1000); u.textContent = (T.S && T.S.state === 'in' ? `Updated ${s} second${s === 1 ? '' : 's'} ago.` : T.S && T.S.state === 'post' ? 'Final.' : '') + (u.dataset.note ? ' ' + u.dataset.note : ''); const cd = document.getElementById('trkCd'); if (cd && T.S && T.S.start) { const ms = new Date(T.S.start) - Date.now(); if (ms > 0) cd.textContent = `${Math.floor(ms / 864e5) ? Math.floor(ms / 864e5) + 'd ' : ''}${Math.floor(ms / 36e5) % 24}h ${String(Math.floor(ms / 6e4) % 60).padStart(2, '0')}m ${String(Math.floor(ms / 1e3) % 60).padStart(2, '0')}s`; } }

  function stop() { if (!T) return; clearTimeout(T.timer); clearInterval(T.tick); if (T.io) T.io.disconnect(); T = null; document.body.classList.remove('trk-on'); if (wake) { try { wake.release(); } catch (e) { } wake = null; } }
  window.renderTracker = function (app, want) {
    stop(); const k = pickSport(want); first = true; seen = new Set(); filter = 'all';
    T = { sport: k, at: Date.now() }; skeleton(app, k);
    T.tick = setInterval(updUpd, 1000); load();
  };
  window.addEventListener('vi:route', () => { const key = window.VI_ROUTER ? window.VI_ROUTER.key() : (location.hash || '').slice(1); if (T && !/^live(-|$)/.test(key)) stop(); });
  document.addEventListener('visibilitychange', () => { if (T && !document.hidden) { load(); if (wake === null && document.getElementById('trkWake') && document.getElementById('trkWake').classList.contains('primary')) toggleWake(); } });
  // the nav link pulses while Tennessee is on
  setInterval(() => { const a = document.querySelector('.sportnav a[data-sport="live"]'); if (a) a.classList.toggle('has-live', Object.values(window.VI_LIVE || {}).some(g => g.state === 'in')); }, 4000);
})();
