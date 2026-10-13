/* The Vol Index — "Ask the Index" search box and the Social & Media pages.
   Answers questions from the site's own data (schedules, results, rosters, records, rankings,
   recruiting, social links) and jumps to the right page. Everything runs in the browser. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso, o) => { if (!iso) return 'TBA'; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-US', o || { weekday: 'short', month: 'short', day: 'numeric' }); };
  const today = () => new Date().toISOString().slice(0, 10);
  const KEYS = ['football', 'volleyball', 'soccer', 'mbb', 'wbb', 'baseball', 'softball'];
  const NAME = { football: 'Football', volleyball: 'Volleyball', soccer: 'Soccer', mbb: "Men's Basketball", wbb: "Lady Vols Basketball", baseball: 'Baseball', softball: 'Softball' };
  const S = () => window.SOCIAL || {};

  /* =====================================================================
     Social & Media
     ===================================================================== */
  const linkRow = e => `<li><div class="grow"><b>${esc(e.name)}</b><div class="dim small">${esc(e.about || '')}</div></div><div class="medialinks">${e.links.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)}</a>`).join('')}</div></li>`;
  function volIndexX() {
    const h = S().volIndexX; if (!h) return '';
    return `<a class="vix" href="https://x.com/${esc(h)}" target="_blank" rel="noopener"><b>𝕏</b> Follow The Vol Index <span>@${esc(h)}</span></a>`;
  }
  window.renderMedia = function (k) {
    const M = S()[k] || {}, G = S().general || {};
    return `<div class="panel-head"><div><h2>Social & Media</h2><p>Where to follow ${esc(NAME[k])}: official team accounts, the reporters and creators who cover the team, news sites and the best stat sites. Links open in a new tab.</p></div>${volIndexX()}</div>
      <div class="grid g2">
        <div class="box"><div class="lb"><h4>Official ${esc(NAME[k])}</h4></div><ul class="list media">${(M.official || []).map(linkRow).join('')}</ul></div>
        <div class="box"><div class="lb"><h4>Reporters, creators & podcasts</h4></div><ul class="list media">${(M.creators || []).map(linkRow).join('') || '<li class="dim">Suggestions welcome.</li>'}</ul></div>
      </div>
      ${M.resources && M.resources.length ? `<div class="section"><h3>Stats, rankings & data sites</h3><ul class="srclist">${M.resources.map(([l, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)}</a></li>`).join('')}</ul></div>` : ''}
      <div class="section"><h3>Tennessee news sites <small>Cover every sport</small></h3><div class="box"><ul class="list media">${(G.news || []).map(linkRow).join('')}</ul></div></div>
      <div class="section"><h3>Official Tennessee Athletics</h3><div class="box"><ul class="list media">${(G.official || []).map(linkRow).join('')}</ul></div></div>
      <p class="dim small" style="margin-top:14px">Links to outside accounts and sites are for fans' convenience; The Vol Index isn't affiliated with any of them. "Find on X" opens an X people-search for that name.</p>`;
  };
  window.mediaHub = function () {
    const order = KEYS.filter(k => S()[k]);
    if (!order.length) return '';
    return `<div class="wrap section hubmedia"><div class="panel-head"><div><h2>Follow the Vols</h2><p>Official accounts for every team. Each sport's <b>Social & Media</b> tab has its reporters, podcasts and creators.</p></div>${volIndexX()}</div>
      <div class="grid g4">${order.map(k => { const o = (S()[k].official || [])[0]; return o ? `<div class="box mediacard"><div class="eyebrow"><a href="#${k}-media">${esc(NAME[k])} ›</a></div><div class="medialinks">${o.links.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)}</a>`).join('')}</div></div>` : ''; }).join('')}
        <div class="box mediacard"><div class="eyebrow">News</div><div class="medialinks">${((S().general || {}).news || []).slice(0, 5).map(e => `<a href="${esc(e.links[0][1])}" target="_blank" rel="noopener">${esc(e.name)}</a>`).join('')}</div></div></div></div>`;
  };

  /* =====================================================================
     The index the search reads from
     ===================================================================== */
  const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9&+ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanOpp = o => String(o || '').replace(/\s*\((No\.|Exh|Exhibition|Scrimmage)[^)]*\)/gi, '').replace(/^(at|vs\.?)\s+/i, '').replace(/\s*\(\d+ games?\)/i, '').trim();
  let IDX = null;
  function sportData(k) {
    if (k === 'football') return window.fbData ? window.fbData() : window.SITE && window.SITE.football;
    return window.sportData ? window.sportData(k) : window.SITE && window.SITE[k];
  }
  function build() {
    if (IDX) return IDX;
    const players = [], opps = new Map();
    KEYS.forEach(k => {
      const D = sportData(k); if (!D) return;
      (k === 'football' ? D.players || [] : D.roster || []).forEach(p => players.push({ k, p, n: norm(p.name), last: norm(String(p.name).split(' ').filter(w => !/^(jr|sr|ii|iii|iv)\.?$/i.test(w)).pop()) }));
      const addOpp = o => { const c = cleanOpp(o); const n = norm(c); if (n.length > 2 && !opps.has(n)) opps.set(n, c); };
      (D.schedule || []).forEach(g => addOpp(g.opp));
      const H = window.SITE_AUTO && window.SITE_AUTO[k + 'History'];
      if (H) Object.values(H.seasons || H).forEach(rows => Array.isArray(rows) && rows.forEach(g => addOpp(g[1])));
    });
    return (IDX = { players, opps });
  }

  /* =====================================================================
     Understanding the question
     ===================================================================== */
  const SPORT_WORDS = [
    ['wbb', /\b(lady ?vols?|womens?|girls?)\s*(basketball|hoops|bball|b ball)\b|\bwbb\b|\bkim caldwell\b|\bcaldwell\b/],
    ['softball', /\bsoftball\b|\bkaren weekly\b/],
    ['volleyball', /\bvolley ?ball\b|\bv ?ball\b|\bvb\b/],
    ['soccer', /\bsoccer\b/],
    ['baseball', /\bbaseball\b|\belander\b|\bomaha\b/],
    ['mbb', /\b(mens?\s*)?(basketball|hoops|bball|b ball)\b|\bmbb\b|\brick barnes\b|\bbarnes\b|\bkenpom\b|\bevan ?miya\b|\btorvik\b|\bbpi\b/],
    ['football', /\bfootball\b|\bcfb\b|\bheupel\b|\bneyland\b|\bquarterback\b|\bqb\b|\btouchdowns?\b|\bpassing\b|\brushing\b|\breceiving\b|\bbowl\b/],
  ];
  const TOPICS = [
    ['media', /\bsocial\b|\btwitter\b|\bx account\b|\binstagram\b|\btiktok\b|\byoutube\b|\bfacebook\b|\bpodcasts?\b|\bfollow\b|\bcreators?\b|\breporters?\b|\bwriters?\b|\bbeat\b|\binsiders?\b|\bvolquest\b|\b247\b|\bnews\b|\bwebsites?\b|\baccounts?\b/],
    ['recruiting', /\brecruit|\bcommits?\b|\bcommitments?\b|\bclass of\b|\bsigning\b|\bsignees?\b|\bincoming\b|\bstars?\b|\bfreshm[ae]n\b/],
    ['moves', /\bdepart|\bwho left\b|\btransferred\b|\btransfers? out\b|\bleaving\b|\bportal\b|\bdraft\b|\bdrafted\b|\bnba\b|\bmlb\b|\bnfl\b/],
    ['advanced', /\badvanced\b|\befficien|\bbpr\b|\bkenpom\b|\bevan ?miya\b|\btorvik\b|\bmassey\b|\bpear\b|\bfpi\b|\bsp\+?\b/],
    ['ratings', /\brank(ed|ing|ings)?\b|\bpolls?\b|\bap\b|\bratings?\b|\bnet\b|\brpi\b|\bbpi\b|\bavca\b|\btop 25\b/],
    ['lineup', /\blineup\b|\bstart(ers|ing|s)?\b|\bdepth\b|\brotation\b|\bstarting five\b|\bxi\b/],
    ['roster', /\broster\b|\bplayers\b|\bwho plays\b|\bteam list\b|\bwhos on\b|\bjersey\b|\bnumber\b/],
    ['stats', /\bstats?\b|\bstatistics\b|\bleaders?\b|\bleading\b|\bleads\b|\btop scorer\b|\bmost\b|\bppg\b|\bbatting\b|\bera\b|\bkills\b|\bgoals\b/],
    ['history', /\bhistory\b|\bchampionships?\b|\btitles?\b|\bnational champ|\bretired\b|\bseason by season\b|\bfinal four\b|\bwcws\b|\bcollege world series\b|\bsweet 16\b|\belite eight\b/],
    ['watch', /\bwatch\b|\btv\b|\bchannel\b|\bstream|\bnetwork\b|\bradio\b/],
    ['schedule', /\bschedul|\bgames?\b|\bwhen\b|\bnext\b|\bupcoming\b|\bcalendar\b|\bplay(ing|s)?\b|\bmatch(es)?\b|\btonight\b|\btoday\b|\bthis week(end)?\b|\bkick ?off\b|\btip ?off\b/],
    ['record', /\brecord\b|\bhow (are|is|did|have)\b|\bdoing\b|\bwins?\b|\blosses\b|\bw l\b|\bstanding/],
    ['review', /\blast (season|year)\b|\breview\b/],
  ];
  const ABBR = { bama: 'alabama', uk: 'kentucky', uga: 'georgia', vandy: 'vanderbilt', 'a&m': 'texas a&m', tamu: 'texas a&m', uf: 'florida', gators: 'florida', dawgs: 'georgia', 'ole miss': 'ole miss', mizzou: 'missouri', 'miss st': 'mississippi state', 'miss state': 'mississippi state', msu: 'mississippi state', 'south car': 'south carolina', gamecocks: 'south carolina', 'georgia tech': 'georgia tech', hogs: 'arkansas', razorbacks: 'arkansas', tide: 'alabama', 'texas am': 'texas a&m', lsu: 'lsu', unc: 'north carolina', okla: 'oklahoma', sooners: 'oklahoma', longhorns: 'texas', tigers: 'auburn' };
  const RECORD_WORDS = { pass: 'passing', passes: 'passing', throwing: 'passing', rush: 'rushing', run: 'rushing', running: 'rushing', receive: 'receiving', catches: 'receptions', catch: 'receptions', td: 'tds', tds: 'tds', touchdown: 'tds', touchdowns: 'tds', picks: 'interceptions', ints: 'interceptions', int: 'interceptions', fg: 'field goals', fgs: 'field goals', tackle: 'tackles', sack: 'sacks', yard: 'yards', yds: 'yards' };

  function parse(q) {
    const n = ' ' + norm(q) + ' ';
    let sports = SPORT_WORDS.filter(([, re]) => re.test(n)).map(([k]) => k);
    if (sports.includes('wbb')) sports = sports.filter(k => k !== 'mbb');
    if (!sports.length && /\blady ?vols?\b/.test(n)) sports = ['wbb'];
    const topics = TOPICS.filter(([, re]) => re.test(n)).map(([t]) => t);
    // opponent
    const { opps, players } = build();
    let opp = null;
    const nAb = Object.entries(ABBR).reduce((s, [a, b]) => s.replace(new RegExp(' ' + a.replace(/[&+]/g, '\\$&') + ' ', 'g'), ' ' + b + ' '), n);
    const qOpp = nAb.replace(/ (tennessee|vols?|volunteers|lady vols?|ut) /g, ' ');
    [...opps.keys()].sort((a, b) => b.length - a.length).some(o => { if (qOpp.includes(' ' + o + ' ') && !/^(women|men|state|tech|the|and)$/.test(o)) { opp = opps.get(o); return true; } return false; });
    // player
    const hits = players.filter(p => n.includes(' ' + p.n + ' '));
    let pl = hits;
    if (!pl.length) { const lasts = players.filter(p => p.last.length > 3 && n.includes(' ' + p.last + ' ') && !(opp && norm(opp).includes(p.last))); pl = lasts.length <= 4 ? lasts : []; }
    if (sports.length) { const f = pl.filter(p => sports.includes(p.k)); if (f.length) pl = f; }
    // football record-book question?
    let rec = null; const R = window.SITE && window.SITE.footballRecords;
    if (R && /\b(record|most|all time|alltime|career|single|best|ever|highest)\b/.test(n) && (!sports.length || sports.includes('football'))) {
      const words = n.trim().split(' ').map(w => RECORD_WORDS[w] || w);
      const score = cat => norm(cat).split(' ').map(w => RECORD_WORDS[w] || w).filter(w => w.length > 1 && words.includes(w)).length;
      let best = null, bs = 0;
      ['game', 'season', 'career'].forEach(sc => (R[sc] || []).forEach(r => { const s = score(r[0]); if (s > bs) { bs = s; best = r[0]; } }));
      if (best) rec = { cat: best, scope: /\bgame\b|\bsingle game\b|\bin a game\b/.test(n) ? 'game' : /\bseason\b|\bsingle season\b|\bin a season\b|\bone season\b/.test(n) ? 'season' : /\bcareer\b/.test(n) ? 'career' : null };
    }
    return { q, n, sports, topics, opp, players: pl.slice(0, 4), rec };
  }

  /* =====================================================================
     Answers: { title, html, go (hash), open: {type, k, ...}, score }
     ===================================================================== */
  const TAB = {
    football: { schedule: 'schedule', watch: 'schedule', roster: 'roster', lineup: 'depth', stats: 'stats', ratings: 'overview', advanced: 'advanced', recruiting: 'recruits', moves: 'next', history: 'history', record: 'overview', media: 'media', review: 'history' },
    other: { schedule: 'schedule', watch: 'schedule', roster: 'roster', lineup: 'lineup', stats: 'stats', ratings: 'advanced', advanced: 'advanced', recruiting: 'recruiting', moves: 'moves', history: 'history', record: 'overview', media: 'media', review: 'review' },
  };
  const tabFor = (k, t) => (k === 'football' ? TAB.football : TAB.other)[t] || 'overview';
  const TAB_LABEL = { schedule: 'schedule', roster: 'roster', lineup: 'projected lineup', depth: 'depth chart', stats: 'stats', ratings: 'rankings & ratings', advanced: 'advanced stats', recruiting: 'recruiting', recruits: 'recruiting', moves: 'roster moves', next: '2027 preview', history: 'history', overview: 'overview', media: 'social & media', review: 'season review' };
  const resStr = g => g.result ? `<span class="${g.result}">${g.result}</span> ${g.us ?? ''}${g.us != null ? '–' : ''}${g.them ?? ''}` : '';
  const vs = g => g.site === 'A' ? 'at' : 'vs.';
  function schedRows(k, D, games, max) {
    return `<table class="mini asktable"><tbody>${games.slice(0, max).map(g => `<tr><td class="num">${fmtDate(g.date, { month: 'short', day: 'numeric' })}</td><td><b>${vs(g)} ${esc(cleanOpp(g.opp))}</b>${g.kind === 'exh' ? ' <span class="chip">Exh.</span>' : ''}</td><td class="num">${g.result ? resStr(g) : esc(g.time ? g.time + ' ET' : (k === 'football' && g.espn && g.espn.kick ? new Date(g.espn.kick).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' ET' : 'TBA'))}</td><td class="dim small">${esc(g.tv || (g.espn && g.espn.tv) || '')}</td></tr>`).join('')}</tbody></table>`;
  }
  function recordOf(k, D) {
    if (k === 'football') return { rec: D.team.record, sec: D.team.sec, season: D.season };
    const r = window.sportRecord && window.sportRecord(k); return r;
  }
  function sportAnswer(k, topic) {
    const D = sportData(k); if (!D) return null;
    const tab = tabFor(k, topic); const go = `#${k}-${tab}`; const nm = NAME[k];
    const sched = D.schedule || [];
    const nextG = sched.find(g => !g.result && g.date >= today());
    if (topic === 'schedule' || topic === 'watch') {
      const done = sched.filter(g => g.result), up = sched.filter(g => !g.result);
      const list = sched.length <= 18 ? sched : done.slice(-3).concat(up.slice(0, 12));
      return { title: `${nm} ${D.season} schedule`, html: `${nextG ? `<p><b>Next:</b> ${vs(nextG)} ${esc(cleanOpp(nextG.opp))}, ${fmtDate(nextG.date, { weekday: 'long', month: 'long', day: 'numeric' })}${nextG.time ? ' · ' + esc(nextG.time) + ' ET' : ''}${(nextG.tv || (nextG.espn && nextG.espn.tv)) ? ' · 📺 ' + esc(nextG.tv || nextG.espn.tv) : ''}</p>` : ''}${schedRows(k, D, list, 18)}${sched.length > list.length ? `<p class="dim small">${sched.length} dates in all. The full list is on the schedule page.</p>` : ''}`, go };
    }
    if (topic === 'record' || topic === 'review') {
      const r = recordOf(k, D);
      if (topic === 'record' && r && sched.some(g => g.result)) return { title: `${nm}: ${r.rec}${r.sec ? ` (${r.sec} SEC)` : ''}`, html: `<p>${esc(nm)} is <b>${esc(r.rec)}</b>${r.sec ? `, <b>${esc(r.sec)}</b> in the SEC,` : ''} in ${esc(r.season)}.${nextG ? ` Next: ${vs(nextG)} ${esc(cleanOpp(nextG.opp))} on ${fmtDate(nextG.date, { month: 'short', day: 'numeric' })}.` : ''}</p>${schedRows(k, D, sched.filter(g => g.result).slice(-5).reverse(), 5)}`, go: `#${k}-schedule` };
      if (k !== 'football' && D.last) return { title: `${nm} ${D.last.label}: ${D.last.record}`, html: `<p>${esc(D.last.label)}: <b>${esc(D.last.record)}</b> · ${esc(D.last.conf)} · ${esc(D.last.finish)}. ${esc(D.last.rank || '')}</p>${D.inSeason ? '' : `<p class="dim small">The ${esc(D.season)} season hasn't started yet.</p>`}`, go: `#${k}-review` };
    }
    if (topic === 'ratings' && k !== 'football') {
      const E = (window.EXTRAS || {})[k] || {}; const rows = (E.ratings || (D.ratings && D.ratings.rows) || []).filter(r => !/check/i.test(r[1])).slice(0, 6);
      return { title: `${nm} rankings & ratings`, html: `<ul class="list">${D.header.slice(0, 2).map(h => `<li><b class="grow">${esc(h[1])}</b><span class="num">${esc(h[0])}</span></li>`).join('')}${rows.map(r => `<li><span class="grow">${esc(r[0])}</span><b class="num">${esc(r[1])}</b></li>`).join('')}</ul>`, go };
    }
    if (topic === 'stats' && k !== 'football' && window.sportInfo) {
      const I = window.sportInfo(k);
      if (I && I.leaders.length) { const seen = new Set(); const top = I.leaders.filter(l => !seen.has(l.label) && seen.add(l.label));
        return { title: `${nm} stat leaders${I.lastStats ? ` (${I.lastStats}, current roster)` : ''}`, html: `<ul class="list">${top.map(l => `<li><span class="chip">${esc(l.label)}</span><b class="grow">${esc(l.name)}</b><span class="num">${esc(l.val)} ${esc(l.unit)}</span></li>`).join('')}</ul>`, go }; }
    }
    if (topic === 'recruiting') {
      if (k === 'football') { const rc = D.recruitClass || {}; return { title: 'Football recruiting', html: `<p>${(D.recruits || []).length} commitments in the 2027 class${rc.rank ? `, ranked <b>No. ${esc(rc.rank)}</b>` : ''}.</p><ul class="list">${(D.recruits || []).slice(0, 6).map(r => `<li><b class="grow">${esc(r.name)}</b><span class="dim">${esc(r.pos || '')}</span><span class="num">${r.rating && r.rating.stars ? '★'.repeat(r.rating.stars) : ''}</span></li>`).join('')}</ul>`, go }; }
      const R = (window.RECRUITING || {})[k] || {};
      const cls = R.classes || [{ year: R.year, commits: R.commits || [] }];
      return { title: `${nm} recruiting`, html: cls.map(c => `<p><b>Class of ${esc(c.year)}:</b> ${c.commits.length ? c.commits.length + ' commitments' : esc(R.none || 'none public yet')}${c.rank ? ' · ' + esc(c.rank) : ''}</p>${c.commits.length ? `<ul class="list">${c.commits.slice(0, 5).map(x => `<li><b class="grow">${esc(x.name)}</b><span class="dim">${esc(x.pos)}</span><span class="small">${esc(x.rank || '')}</span></li>`).join('')}</ul>` : ''}`).join(''), go };
    }
    if (topic === 'media') {
      const M = S()[k] || {}; const all = (M.official || []).concat(M.creators || []);
      return { title: `Follow ${nm}`, html: `<ul class="list media">${all.slice(0, 5).map(linkRow).join('')}</ul>`, go };
    }
    if (topic === 'history' && k !== 'football' && D.history) {
      return { title: `${nm} history`, html: `<ul class="list">${(D.history.titles || []).slice(0, 6).map(t => `<li><b class="num">${esc(t[0])}</b><span class="grow">${esc(t[1])}</span></li>`).join('')}</ul>`, go };
    }
    return { title: `${nm} ${TAB_LABEL[tab] || tab}`, html: `<p>Open the ${esc(nm)} ${esc(TAB_LABEL[tab] || tab)} page.</p>`, go };
  }
  function gameAnswers(opp, sports) {
    const out = []; const on = norm(opp);
    (sports.length ? sports : KEYS).forEach(k => {
      const D = sportData(k); if (!D) return;
      const games = (D.schedule || []).map((g, i) => ({ g, i })).filter(({ g }) => norm(cleanOpp(g.opp)) === on);
      const H = window.SITE_AUTO && window.SITE_AUTO[k + 'History'];
      let past = [];
      if (H) Object.entries(H.seasons || H).forEach(([s, rows]) => Array.isArray(rows) && rows.forEach(r => { if (norm(cleanOpp(r[1])) === on) past.push(k === 'football' ? { date: r[0], site: r[2], us: r[3], them: r[4], result: r[3] > r[4] ? 'W' : r[3] < r[4] ? 'L' : 'T' } : { date: r[0], site: r[2], result: r[3], us: r[4], them: r[5] }); }));
      past = past.filter(p => p.result && !games.some(({ g }) => g.date === p.date)).sort((a, b) => a.date < b.date ? 1 : -1);
      if (!games.length && !past.length) return;
      const ser = k !== 'football' && D.series && Object.entries(D.series).find(([o]) => norm(cleanOpp(o)) === on);
      const lines = games.map(({ g, i }) => `<li><b class="num">${fmtDate(g.date, { month: 'short', day: 'numeric', year: 'numeric' })}</b><span class="grow">${vs(g)} ${esc(cleanOpp(g.opp))}</span><span class="num">${g.result ? resStr(g) : esc(g.time ? g.time + ' ET' : 'Upcoming')}</span></li>`).join('');
      const pastL = past.slice(0, 5).map(p => `<li><b class="num">${fmtDate(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}</b><span class="grow">${p.site === 'A' ? 'at' : p.site === 'N' ? 'neutral' : 'home'}</span><span class="num"><span class="${p.result}">${p.result}</span> ${p.us}–${p.them}</span></li>`).join('');
      const first = games[0];
      out.push({
        k, title: `${NAME[k]}: Tennessee vs. ${opp}`,
        html: `${ser ? `<p>All-time: Tennessee is <b>${ser[1].w}-${ser[1].l}${ser[1].t ? '-' + ser[1].t : ''}</b> against ${esc(opp)}.</p>` : ''}${lines ? `<ul class="list">${lines}</ul>` : ''}${pastL ? `<h5 class="subhead">${lines ? 'Earlier meetings' : 'Recent meetings'}</h5><ul class="list">${pastL}</ul>` : ''}`,
        go: `#${k}-schedule`, open: first ? (k === 'football' ? { type: 'fbgame', opp: first.g.opp } : { type: 'game', k, i: first.i }) : null,
        openLabel: first ? (first.g.result ? 'Open box score' : 'Open game preview') : null,
        score: (games.length ? 50 : 20) + (games.some(({ g }) => g.result) ? 5 : 0),
      });
    });
    return out;
  }
  function playerAnswer(h) {
    const { k, p } = h; const tab = k === 'football' ? 'roster' : 'roster';
    const E = (window.EXTRAS || {})[k] || {};
    const hon = (p.honors && p.honors[0]) || ((E.honors || {})[p.name] || [])[0];
    return { title: `${p.name} · ${NAME[k]}`, html: `<p><b>#${esc(p.num)}</b> · ${esc(p.pos)} · ${esc((m => m ? 'RS ' + { FR: 'Fr.', SO: 'So.', JR: 'Jr.', SR: 'Sr.' }[m[1]] : p.cls)(/^RS (FR|SO|JR|SR)/.exec(p.elig || '')))}${p.ht ? ' · ' + esc(p.ht) : ''}${p.home ? ' · ' + esc(p.home) : ''}${p.prev ? ' · from ' + esc(p.prev) : ''}</p>${hon ? `<p><span class="chip honor">Honor</span> ${esc(hon)}</p>` : ''}${p.note ? `<p class="dim small">${esc(p.note)}</p>` : ''}`,
      go: `#${k}-${tab}`, open: k === 'football' ? { type: 'fbplayer', name: p.name } : { type: 'player', k, name: p.name }, openLabel: 'Open player card', score: 60 };
  }
  function recordAnswer(rec) {
    const R = window.SITE.footballRecords; const scopes = rec.scope ? [rec.scope] : ['game', 'season', 'career'];
    const rows = scopes.map(sc => [sc, (R[sc] || []).find(r => r[0] === rec.cat)]).filter(x => x[1]);
    const top = rows[0] && rows[0][1];
    return { title: `Tennessee football record: ${rec.cat}`, html: `${rec.scope && top ? `<p class="lede"><b>${esc(top[1])}</b> holds the ${rec.scope === 'game' ? 'single-game' : rec.scope === 'season' ? 'single-season' : 'career'} record with <b>${esc(top[2])}</b> ${esc(rec.cat.toLowerCase())} (${esc(top[3])}${top[4] ? ', ' + esc(top[4]) : ''}).</p>` : ''}
      <ul class="list">${rows.map(([sc, r]) => `<li><span class="chip">${sc === 'game' ? 'Game' : sc === 'season' ? 'Season' : 'Career'}</span><b class="grow">${esc(r[1])}</b><span class="num">${esc(r[2])}</span><span class="dim small">${esc(r[3])}${r[4] ? ' · ' + esc(r[4]) : ''}</span></li>`).join('')}</ul><p class="dim small">${esc(R.asOf || '')} · UT record book via Wikipedia.</p>`, go: '#football-history', score: 90 };
  }
  function upcomingAll(days) {
    const end = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10), t = today();
    const rows = [];
    KEYS.forEach(k => { const D = sportData(k); (D && D.schedule || []).forEach(g => { if (!g.result && g.date >= t && g.date <= end) rows.push({ k, g }); }); });
    rows.sort((a, b) => a.g.date < b.g.date ? -1 : 1);
    return { title: days <= 1 ? 'Vols games today' : `Vols games in the next ${days} days`, html: rows.length ? `<table class="mini asktable"><tbody>${rows.map(({ k, g }) => `<tr><td class="num">${fmtDate(g.date)}</td><td><span class="chip">${esc(NAME[k])}</span></td><td><b>${vs(g)} ${esc(cleanOpp(g.opp))}</b></td><td class="num">${esc(g.time ? g.time + ' ET' : (g.espn && g.espn.kick) ? new Date(g.espn.kick).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' ET' : 'TBA')}</td><td class="dim small">${esc(g.tv || (g.espn && g.espn.tv) || '')}</td></tr>`).join('')}</tbody></table>` : '<p>No games scheduled in that window.</p>', go: '#home', score: 70 };
  }
  function answer(q) {
    const P = parse(q); const out = [];
    if (!P.n) return out;
    if (P.rec) out.push(recordAnswer(P.rec));
    P.players.forEach(h => out.push(playerAnswer(h)));
    if (P.opp) gameAnswers(P.opp, P.sports).forEach(a => out.push(a));
    if (/\b(today|tonight)\b/.test(P.n) && !P.sports.length) out.push(upcomingAll(0));
    else if (/\b(this week(end)?|next few days|coming up|upcoming)\b/.test(P.n) && !P.sports.length) out.push(upcomingAll(7));
    const topics = P.topics.filter(t => !(P.opp && (t === 'schedule' || t === 'record')) && !(P.rec && (t === 'record' || t === 'stats' || t === 'history')) && !(P.players.length && t === 'roster'));
    if (P.sports.length) {
      const ts = topics.length ? topics : (P.opp || P.players.length || P.rec ? [] : ['overview']);
      P.sports.forEach(k => ts.forEach((t, i) => { const a = t === 'overview' ? { title: `${NAME[k]}`, html: (s => `<p>${esc(s || '')}</p>`)(k === 'football' ? null : window.sportStatus && window.sportStatus(k)), go: `#${k}` } : sportAnswer(k, t); if (a) { a.score = (a.score || 40) - i; out.push(a); } }));
    } else if (topics.length && !P.opp && !P.players.length && !P.rec) {
      // a topic with no sport: one line per sport
      const t = topics[0];
      if (t === 'media') out.push({ title: 'Follow the Vols', html: `<ul class="list media">${((S().general || {}).official || []).concat((S().general || {}).news || []).slice(0, 7).map(linkRow).join('')}</ul>`, go: '#home', score: 45 });
      else if ((t === 'schedule' || t === 'watch') && !out.length) out.push(upcomingAll(10));
      if (out.some(a => /games (today|in the next)/.test(a.title))) return out;
      out.push({ title: `Which sport? (${TAB_LABEL[tabFor('mbb', t)] || t})`, html: `<div class="controls">${KEYS.map(k => `<a class="chip click" href="#${k}-${tabFor(k, t)}">${esc(NAME[k])}</a>`).join('')}</div>`, go: null, score: 30 });
    }
    return out.sort((a, b) => (b.score || 40) - (a.score || 40)).slice(0, 6);
  }
  window.askIndex = answer; // handy for testing

  /* =====================================================================
     UI: top-bar button, panel, home-page box, pinned answer
     ===================================================================== */
  const EX = ['Football Roster', 'Volleyball Schedule', 'Basketball Recruiting', 'Lady Vols basketball schedule', 'Arkansas vs Tennessee', 'Who has the passing yards record?', 'Juke Harris', 'Vols games this week'];
  function card(a, i) {
    return `<div class="askcard" data-i="${i}"><div class="askcard-h"><b>${esc(a.title)}</b>${a.go ? `<a class="golink" href="${esc(a.go)}" data-askgo="${i}">Go to page ›</a>` : ''}</div><div class="askcard-b">${a.html}</div>${a.open ? `<button class="btn small" data-askopen="${i}">${esc(a.openLabel || 'Open')}</button>` : ''}</div>`;
  }
  function doOpen(o) {
    if (!o) return;
    setTimeout(() => {
      if (o.type === 'player' && window.sportOpenPlayer) window.sportOpenPlayer(o.k, o.name);
      else if (o.type === 'game' && window.sportOpenGame) window.sportOpenGame(o.k, o.i);
      else if (o.type === 'fbplayer' && window.fbOpenPlayer) window.fbOpenPlayer(o.name);
      else if (o.type === 'fbgame' && window.fbOpenGame) window.fbOpenGame(o.opp);
    }, 80);
  }
  function go(a, open) {
    closePanel();
    pin(a);
    if (a.go && '#' + window.VI_ROUTER.key() !== a.go) window.VI_ROUTER.go(a.go.slice(1));
    if (open) doOpen(a.open);
  }
  let pinned = null;
  function pin(a) {
    let el = document.getElementById('askPin');
    if (!el) { el = document.createElement('div'); el.id = 'askPin'; document.getElementById('app').before(el); }
    pinned = a;
    el.innerHTML = `<div class="wrap"><div class="askpin"><div class="askpin-h"><span class="eyebrow">Ask the Index</span><button class="x" aria-label="Close answer">✕</button></div>${card(a, 0).replace(/<a class="golink"[^>]*>.*?<\/a>/, '')}</div></div>`;
    el.querySelector('.x').addEventListener('click', () => { el.innerHTML = ''; pinned = null; });
    const ob = el.querySelector('[data-askopen]'); ob && ob.addEventListener('click', () => doOpen(a.open));
  }
  window.addEventListener('vi:route', () => { const el = document.getElementById('askPin'); if (el && pinned && '#' + window.VI_ROUTER.key() !== pinned.go) { el.innerHTML = ''; pinned = null; } });

  let panel, results = [];
  function draw(q) {
    const box = panel.querySelector('.askres');
    results = q.trim().length > 1 ? answer(q) : [];
    box.innerHTML = results.length ? results.map(card).join('') : q.trim().length > 1
      ? `<p class="dim">No direct answer for that yet. Try a sport plus a topic, like "soccer schedule" or "baseball roster".</p>`
      : `<div class="askex"><span class="dim small">Try:</span>${EX.map(e => `<button class="chip click" data-ex="${esc(e)}">${esc(e)}</button>`).join('')}</div>`;
    box.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { panel.querySelector('input').value = b.dataset.ex; draw(b.dataset.ex); }));
    box.querySelectorAll('[data-askgo]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); go(results[+b.dataset.askgo]); }));
    box.querySelectorAll('[data-askopen]').forEach(b => b.addEventListener('click', () => go(results[+b.dataset.askopen], true)));
    box.querySelectorAll('a[href^="#"]:not([data-askgo])').forEach(a => a.addEventListener('click', () => closePanel()));
  }
  function openPanel(q) {
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'askPanel'; panel.hidden = true;
      panel.innerHTML = `<div class="askback"></div><div class="askbox" role="dialog" aria-label="Ask the Index"><div class="askin"><span aria-hidden="true">⌕</span><input type="text" enterkeyhint="search" placeholder="Ask the Index: “Football Roster”, “Volleyball Schedule”, “Basketball Recruiting”" aria-label="Ask a question" autocomplete="off"><button class="x" aria-label="Close">✕</button></div><div class="askres"></div><p class="dim small askfoot">Answers come from The Vol Index's own data. Press Enter to jump to the top answer's page.</p></div>`;
      document.body.appendChild(panel);
      const inp = panel.querySelector('input');
      inp.addEventListener('input', () => draw(inp.value));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && results[0]) go(results[0], false); if (e.key === 'Escape') closePanel(); });
      panel.querySelector('.askback').addEventListener('click', closePanel);
      panel.querySelector('.x').addEventListener('click', closePanel);
    }
    panel.hidden = false; document.body.classList.add('asking');
    const inp = panel.querySelector('input'); inp.value = q || ''; draw(inp.value); setTimeout(() => inp.focus(), 0);
  }
  function closePanel() { if (panel) { panel.hidden = true; document.body.classList.remove('asking'); } }
  window.openAsk = openPanel;
  document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openPanel(''); } });
  // top-bar button
  const bar = document.querySelector('.topbar-in');
  if (bar && !document.getElementById('askBtn')) {
    const b = document.createElement('button'); b.id = 'askBtn'; b.className = 'askbtn'; b.type = 'button'; b.innerHTML = '<span aria-hidden="true">⌕</span> Ask';
    b.setAttribute('aria-label', 'Ask the Index: search the site'); b.addEventListener('click', () => openPanel(''));
    const theme = document.getElementById('themeBtn'); theme ? bar.insertBefore(b, theme) : bar.appendChild(b);
  }
  // big box on the home page
  window.askHero = () => `<form class="askhero" id="askHero" role="search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Ask the Index: “Football Roster”, “Volleyball Schedule”, “Basketball Recruiting”" aria-label="Ask the Index"><button class="btn primary" type="submit">Ask</button></form>`;
  window.wireAskHero = () => {
    const f = document.getElementById('askHero'); if (!f) return;
    const i = f.querySelector('input');
    f.addEventListener('submit', e => { e.preventDefault(); openPanel(i.value); });
    i.addEventListener('input', () => { if (i.value.length > 1) { const v = i.value; i.value = ''; openPanel(v); } });
  };
})();
