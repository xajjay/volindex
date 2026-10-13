/* The Vol Index — live scores.
   On a day Tennessee plays (per each sport's schedule), the page asks ESPN's public scoreboard for that day's games
   and finds Tennessee. While the game is on it refreshes every 20 seconds:
     · a LIVE banner under the top bar on every page,
     · the sport's "Next game" card becomes a live scoreboard card, then a FINAL card once it ends (rest of game day),
     · home page: the sport's card glows orange with the live score.
   The day after, everything returns to normal and the Next game card previews the next opponent.
   Preview without a real game: add ?livedemo=football:in,volleyball:post (states: pre, in, post) to the address. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/';
  const PATH = {
    football: ['football/college-football', '&groups=80'], volleyball: ['volleyball/womens-college-volleyball', ''],
    soccer: ['soccer/usa.ncaa.w.1', ''], mbb: ['basketball/mens-college-basketball', '&groups=50'],
    wbb: ['basketball/womens-college-basketball', '&groups=50'], baseball: ['baseball/college-baseball', ''], softball: ['softball/college-softball', ''],
  };
  const NAME = { football: 'Football', volleyball: 'Volleyball', soccer: 'Soccer', mbb: "Men's Hoops", wbb: "Women's Hoops", baseball: 'Baseball', softball: 'Softball' };
  const etDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD in Eastern time
  const etHour = () => +new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }) % 24;
  const LIVE = {}; // sport -> game state
  window.VI_LIVE = LIVE;

  function schedOf(k) {
    if (k === 'football') return (window.fbData && window.fbData() || (window.SITE || {}).football || {}).schedule || [];
    return ((window.SITE || {})[k] || {}).schedule || [];
  }
  // sports with a game today (or yesterday, before 4 AM, for a game that runs past midnight)
  function gameDays() {
    const t = etDate(), y = etDate(new Date(Date.now() - 864e5)), out = [];
    Object.keys(PATH).forEach(k => {
      const s = schedOf(k);
      if (s.some(g => g.date === t)) out.push([k, t]);
      else if (etHour() < 4 && s.some(g => g.date === y)) out.push([k, y]);
    });
    return out;
  }
  const isTN = c => c && c.team && (c.team.abbreviation === 'TENN' || c.team.location === 'Tennessee');

  function parse(k, ev) {
    const c = ev.competitions[0], us = c.competitors.find(isTN), them = c.competitors.find(x => x !== us);
    if (!us || !them) return null;
    const st = ev.status || c.status || {}, ty = st.type || {};
    const rank = x => x.curatedRank && x.curatedRank.current && x.curatedRank.current < 99 ? x.curatedRank.current : null;
    const sit = c.situation || {};
    let extra = '';
    if (k === 'football' && sit.downDistanceText) extra = sit.downDistanceText;
    if ((k === 'baseball' || k === 'softball') && sit.outs != null) extra = `${sit.outs} out${sit.outs === 1 ? '' : 's'}` + ([sit.onFirst && '1st', sit.onSecond && '2nd', sit.onThird && '3rd'].filter(Boolean).length ? ' · on ' + [sit.onFirst && '1st', sit.onSecond && '2nd', sit.onThird && '3rd'].filter(Boolean).join(', ') : '');
    const tv = ((c.broadcasts || [])[0] || {}).names ? c.broadcasts[0].names.join(', ') : ((c.geoBroadcasts || [])[0] || {}).media ? c.geoBroadcasts[0].media.shortName : '';
    const link = ((ev.links || []).find(l => /game|gamecast|boxscore/.test(l.href || '')) || (ev.links || [])[0] || {}).href || null;
    return {
      sport: k, state: ty.state, // pre | in | post
      detail: ty.state === 'in' ? (ty.shortDetail || ty.detail || 'Live') : ty.state === 'post' ? (ty.shortDetail || 'Final') : ty.shortDetail,
      start: ev.date, tv, link, home: us.homeAway === 'home',
      us: { name: 'Tennessee', abbr: 'TENN', score: us.score, rank: rank(us), winner: !!us.winner },
      them: { name: them.team.location || them.team.shortDisplayName, abbr: them.team.abbreviation, score: them.score, rank: rank(them), winner: !!them.winner },
      poss: sit.possession ? (sit.possession === us.team.id ? 'us' : 'them') : null, extra,
      result: ty.state === 'post' ? (+us.score > +them.score ? 'W' : +us.score < +them.score ? 'L' : 'T') : null,
    };
  }

  async function check(k, date) {
    const [p, q] = PATH[k];
    try {
      const r = await fetch(`${ESPN}${p}/scoreboard?dates=${date.replace(/-/g, '')}&limit=500${q}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      const ev = (d.events || []).find(e => (e.competitions || [])[0] && e.competitions[0].competitors.some(isTN));
      const g = ev && parse(k, ev);
      if (g) LIVE[k] = g; else delete LIVE[k];
    } catch (e) { /* ESPN unreachable: leave the page as it is */ }
  }

  let timer = null;
  async function poll() {
    clearTimeout(timer);
    const days = demo ? [] : gameDays();
    if (!demo && !days.length) { apply(); return; }
    await Promise.all(days.map(([k, d]) => check(k, d)));
    apply();
    const games = Object.values(LIVE);
    if (demo) return;
    let wait = 5 * 60e3; // pre-game: check every 5 minutes
    if (games.some(g => g.state === 'in')) wait = 20e3;
    else if (games.some(g => g.state === 'pre' && new Date(g.start) - Date.now() < 15 * 60e3)) wait = 60e3;
    else if (games.length && games.every(g => g.state === 'post')) return; // all done for today
    timer = setTimeout(poll, wait);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !demo) poll(); else clearTimeout(timer); });

  /* ---------- rendering ---------- */
  const rk = t => t.rank ? `<i class="lrk">${t.rank}</i>` : '';
  const sideTeams = g => g.home ? [g.them, g.us] : [g.us, g.them]; // away team first (top/left), like a TV bug
  const href = k => window.VI_ROUTER ? window.VI_ROUTER.href(k) : '#' + k;

  function cardHtml(g) {
    const [a, h] = sideTeams(g), live = g.state === 'in';
    const team = (t, side) => `<div class="lteam ${side}${g.state === 'post' && t.winner ? ' won' : ''}${t === g.us ? ' ut' : ''}">
        <span class="lname">${rk(t)}${esc(t.name)}${live && g.poss === (t === g.us ? 'us' : 'them') ? '<i class="poss" title="Has the ball"></i>' : ''}</span>
        <b class="lscore">${esc(t.score ?? '0')}</b></div>`;
    return `<div class="eyebrow">${live ? '<span class="livedot"></span>Live' : '<span class="finalpill ' + (g.result || '') + '">' + (g.result === 'W' ? 'Win' : g.result === 'L' ? 'Loss' : 'Final') + '</span>Final'} · ${esc(live ? g.detail : g.detail === 'Final' ? new Date(g.start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : g.detail)}${g.tv ? ' · ' + esc(g.tv) : ''}</div>
      <div class="lboard">${team(a, 'away')}<span class="lat">at</span>${team(h, 'home')}</div>
      ${live && g.extra ? `<div class="lsit">${esc(g.extra)}</div>` : ''}
      <div class="golink">${live ? (g.link ? `<a href="${esc(g.link)}" target="_blank" rel="noopener">Follow on ESPN Gamecast ›</a>` : 'Updating every 20 seconds') : `Full box score posts on The Vol Index tomorrow morning${g.link ? ` · <a href="${esc(g.link)}" target="_blank" rel="noopener">ESPN box score ›</a>` : ''}`}</div>`;
  }
  function bannerHtml(games) {
    return `<div class="livebar-in">${games.map(g => `<a class="lb-game" href="${href(g.sport)}"><span class="livedot"></span><b>LIVE</b><span class="lb-sport">${esc(NAME[g.sport])}</span>
      <span class="lb-score">${esc(g.us.abbr)} <b>${esc(g.us.score ?? 0)}</b>, ${esc(g.them.abbr)} <b>${esc(g.them.score ?? 0)}</b></span><span class="lb-det">${esc(g.detail)}${g.tv ? ' · ' + esc(g.tv) : ''}</span><span class="lb-go">›</span></a>`).join('')}</div>`;
  }

  function apply() {
    const games = Object.values(LIVE), live = games.filter(g => g.state === 'in');
    // banner
    let bar = document.getElementById('livebar');
    if (live.length) {
      if (!bar) { bar = document.createElement('div'); bar.id = 'livebar'; bar.className = 'livebar'; const tb = document.querySelector('.topbar'); tb ? tb.after(bar) : document.body.prepend(bar); }
      bar.innerHTML = bannerHtml(live);
    } else if (bar) bar.remove();
    // the current sport page: swap the Next game card for the live / final card
    const key = window.VI_ROUTER ? window.VI_ROUTER.key() : (location.hash || '#home').slice(1);
    const [sport, tab] = key.split('-');
    const g = LIVE[sport];
    const app = document.getElementById('app'); if (!app) return;
    if (g && (g.state === 'in' || g.state === 'post') && (!tab || tab === 'overview')) {
      const card = app.querySelector('.box.nextgame.matchup');
      if (card) {
        const html = cardHtml(g);
        if (card.dataset.liveHtml !== html) {
          if (!card.dataset.live) { const c2 = card.cloneNode(false); card.replaceWith(c2); c2.className = 'box nextgame livecard' + (g.state === 'in' ? ' is-live' : ' is-final'); c2.removeAttribute('role'); c2.removeAttribute('tabindex'); c2.removeAttribute('data-game'); c2.removeAttribute('data-sg'); c2.removeAttribute('aria-label'); c2.dataset.live = '1'; c2.dataset.liveHtml = html; c2.innerHTML = html; }
          else { card.dataset.liveHtml = html; card.innerHTML = html; }
        }
      } else {
        const lc = app.querySelector('.livecard');
        if (lc && lc.dataset.liveHtml !== cardHtml(g)) { lc.dataset.liveHtml = cardHtml(g); lc.innerHTML = cardHtml(g); lc.className = 'box nextgame livecard' + (g.state === 'in' ? ' is-live' : ' is-final'); }
      }
    }
    // during and right after the game, lift the scoreboard to the top of the page
    const lc2 = app.querySelector('.livecard'), grid = lc2 && lc2.closest('.grid'), main = app.querySelector('main');
    if (grid && main && main.firstElementChild !== grid) { main.prepend(grid); grid.classList.add('lifted'); }
    // home page cards
    app.querySelectorAll('.sportcard[data-sport]').forEach(el => {
      const x = LIVE[el.dataset.sport], on = x && x.state === 'in';
      el.classList.toggle('is-live', !!on);
      let s = el.querySelector('.sc-live');
      const txt = on ? `<span class="livedot"></span><b>LIVE</b> ${esc(x.us.abbr)} ${esc(x.us.score ?? 0)}, ${esc(x.them.abbr)} ${esc(x.them.score ?? 0)} · ${esc(x.detail)}`
        : x && x.state === 'post' ? `<b class="${x.result}">${x.result === 'W' ? 'Won' : x.result === 'L' ? 'Lost' : 'Final'}</b> ${esc(x.us.score)}-${esc(x.them.score)} ${x.home ? 'vs' : 'at'} ${esc(x.them.name)} · Final` : '';
      if (txt) { if (!s) { s = document.createElement('div'); s.className = 'sc-live'; el.querySelector('.sc-name').after(s); } if (s.innerHTML !== txt) s.innerHTML = txt; }
      else if (s) s.remove();
    });
  }

  // re-apply after every page render
  let pending = false;
  const later = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; apply(); }); };
  window.addEventListener('vi:route', later); window.addEventListener('hashchange', later);
  document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    if (app) new MutationObserver(ms => { if (ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && !(n.closest && (n.closest('.livecard') || n.classList.contains('sc-live')))))) later(); }).observe(app, { childList: true, subtree: true });
    setTimeout(poll, 300);
  });

  /* ---------- preview mode ---------- */
  let demo = null;
  try { demo = new URLSearchParams(location.search).get('livedemo'); } catch (e) {}
  if (demo) {
    const OPP = { football: ['Alabama', 'ALA', 3, 'ABC', 'Q3 4:12', '2nd & 7 at ALA 35', 'us'], volleyball: ['Kentucky', 'UK', 2, 'SEC Network', 'Set 4', '', null],
      soccer: ['Georgia', 'UGA', 1, 'SECN+', "67'", '', null], mbb: ['Kentucky', 'UK', 2, 'ESPN', '2nd 8:41', '', null], wbb: ['South Carolina', 'SC', 3, 'ESPN', '3rd 2:05', '', null],
      baseball: ['LSU', 'LSU', 2, 'SEC Network', 'Top 7th', '1 out · on 2nd', null], softball: ['Oklahoma', 'OU', 2, 'SEC Network', 'Bot 5th', '2 outs', null] };
    const SC = { football: [24, 21, 31, 28], volleyball: [2, 1, 3, 1], soccer: [1, 1, 2, 1], mbb: [58, 51, 81, 74], wbb: [55, 59, 70, 64], baseball: [4, 3, 6, 5], softball: [3, 2, 5, 2] };
    demo.split(',').forEach(pair => {
      const [k, st] = pair.split(':'); const o = OPP[k]; if (!o) return;
      const s = SC[k], fin = st === 'post';
      LIVE[k] = { sport: k, state: st || 'in', detail: fin ? 'Final' : o[4], start: new Date().toISOString(), tv: o[3], link: 'https://www.espn.com/', home: true,
        us: { name: 'Tennessee', abbr: 'TENN', score: String(fin ? s[2] : s[0]), rank: k === 'football' ? 14 : 9, winner: fin },
        them: { name: o[0], abbr: o[1], score: String(fin ? s[3] : s[1]), rank: o[2], winner: false }, poss: o[6], extra: o[5], result: fin ? 'W' : null };
    });
  }
})();
