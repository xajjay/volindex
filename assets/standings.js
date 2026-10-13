/* SEC standings table (shown on each sport's Schedule & Standings tab, behind the "SEC Standings" switch).
   Data: data/standings-auto.js (ESPN for football and basketball, secsports.com for the rest). */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wl = r => { const p = String(r || '').split('-').map(Number); const [w = 0, l = 0, t = 0] = p; const g = w + l + t; return { w, l, t, g, pct: g ? (w + t / 2) / g : 0 }; };
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const isUT = r => /^Tennessee$/i.test(r.team || '') || /Tennessee (Volunteers|Lady Volunteers|Lady Vols)/i.test(r.name || '');
  // school colors + short labels for the team badges (plain colored badges, no logos)
  const SCHOOL = {
    'Alabama': ['#9E1B32', 'BAMA'], 'Arkansas': ['#9D2235', 'ARK'], 'Auburn': ['#0C2340', 'AUB'], 'Florida': ['#0021A5', 'UF'],
    'Georgia': ['#BA0C2F', 'UGA'], 'Kentucky': ['#0033A0', 'UK'], 'LSU': ['#461D7C', 'LSU'], 'Mississippi State': ['#660000', 'MSU'],
    'Missouri': ['#F1B82D', 'MIZ', '#000'], 'Oklahoma': ['#841617', 'OU'], 'Ole Miss': ['#CE1126', 'MISS'], 'South Carolina': ['#73000A', 'SC'],
    'Tennessee': ['#FF8200', 'TENN'], 'Texas': ['#BF5700', 'TEX'], 'Texas A&M': ['#500000', 'A&M'], 'Vanderbilt': ['#866D4B', 'VU'],
  };
  const SHORT = { 'Mississippi State': 'MS State' };
  const badge = r => { const s = SCHOOL[r.team] || ['#4B4B4B', (r.abbr || r.team || '?').slice(0, 4).toUpperCase()]; return `<span class="tbadge" style="background:${s[0]};color:${s[2] || '#fff'}" aria-hidden="true">${esc(s[1])}</span>`; };
  function placed(rows) {
    // place by conference win %, ties share a place
    let last = null, place = 0;
    return rows.map((r, i) => { const p = wl(r.conf).pct; if (last === null || p !== last) { place = i + 1; last = p; } return Object.assign({ place }, r); })
      .map((r, i, a) => Object.assign(r, { tie: a.filter(x => x.place === r.place).length > 1 }));
  }
  function data(k) { return ((window.SITE_AUTO || {}).standings || {})[k]; }
  window.secPlace = function (k) {
    const S = data(k); if (!S) return null;
    const rows = placed(S.rows), me = rows.find(isUT); if (!me) return null;
    return { text: (me.tie ? 'T-' : '') + ord(me.place), of: rows.length, season: S.season, final: S.final, conf: me.conf };
  };
  window.standingsHtml = function (k) {
    const S = data(k);
    if (!S || !S.rows || !S.rows.length) return `<div class="section" id="standings"><h3>SEC standings</h3><p class="dim">Standings load with the next automatic update.</p></div>`;
    const rows = placed(S.rows), me = rows.find(isUT);
    const has = f => rows.some(r => r[f]);
    const src = S.source ? `<a href="${esc(S.source.replace(/\/apis\/.*$/, '').replace('site.api.espn.com', 'www.espn.com'))}" target="_blank" rel="noopener">${esc(S.sourceName || 'ESPN')}</a>` : esc(S.sourceName || 'ESPN');
    return `<div class="section" id="standings" style="margin-top:0">
      ${me ? `<div class="standhead"><span class="tbadge big" style="background:#FF8200">TENN</span><div><b>Tennessee is ${me.tie ? 'T-' : ''}${ord(me.place)} in the SEC</b><span>${esc(me.conf)} SEC · ${esc(me.overall)} overall${S.final ? ` · ${esc(S.season)} final standings (this season hasn't started yet)` : ` · ${esc(S.season)} · updated ${new Date(S.updated + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</span></div></div>` : ''}
      <div class="tablewrap standings"><table><thead><tr><th>Team</th><th class="n">Conf</th><th class="n">Overall</th>${has('home') ? '<th class="n hide-sm">Home</th>' : ''}${has('away') ? '<th class="n hide-sm">Away</th>' : ''}${has('streak') ? '<th class="n">Strk</th>' : ''}</tr></thead>
      <tbody>${rows.map(r => `<tr class="${isUT(r) ? 'me' : ''}"><td><span class="tcell" title="${r.tie ? 'T-' : ''}${ord(r.place)} in the SEC">${badge(r)}<b>${esc(SHORT[r.team] || r.team)}</b></span></td><td class="n num"><b>${esc(r.conf || '—')}</b></td><td class="n num">${esc(r.overall || '—')}</td>${has('home') ? `<td class="n num hide-sm">${esc(r.home || '—')}</td>` : ''}${has('away') ? `<td class="n num hide-sm">${esc(r.away || '—')}</td>` : ''}${has('streak') ? `<td class="n num">${esc(r.streak || '')}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      <p class="dim small">Sorted by SEC winning percentage; ties share a place (official tiebreakers aren't applied). Source: ${src}.</p></div>`;
  };
  // "Schedule | SEC Standings" switch at the top of each Schedule & Standings tab
  let view = 'schedule';
  window.standSwitch = function () {
    return `<div class="seg standseg" role="group" aria-label="Schedule or standings"><button data-sv="schedule" aria-pressed="${view === 'schedule'}">Schedule</button><button data-sv="standings" aria-pressed="${view === 'standings'}">SEC Standings</button></div>`;
  };
  window.standCur = () => view;
  window.standView = function (v) {
    if (v) view = v;
    document.querySelectorAll('[data-view]').forEach(el => { el.hidden = el.dataset.view !== view; });
    document.querySelectorAll('.standseg [data-sv]').forEach(b => b.setAttribute('aria-pressed', b.dataset.sv === view));
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.standseg [data-sv], [data-goto-stand]'); if (!b) return;
    e.preventDefault(); window.standView(b.dataset.sv || 'standings');
  });
})();

/* "Results so far" scoreboard list, shared by football and the other sports' overview pages. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const rec = gs => { const w = gs.filter(g => g.result === 'W').length, l = gs.filter(g => g.result === 'L').length, t = gs.filter(g => g.result === 'T').length; return `${w}-${l}${t ? '-' + t : ''}`; };
  // games: [{date, opp, site:'H'|'A'|'N', result:'W'|'L'|'T', us, them, attr:'data-game="…"'}]
  window.resultsBox = function ({ games, record, sub, meta, max = 5, more }) {
    const shown = games.slice(-max);
    const home = games.filter(g => g.site === 'H'), away = games.filter(g => g.site === 'A');
    const subTxt = [sub, home.length ? rec(home) + ' home' : '', away.length ? rec(away) + ' away' : ''].filter(Boolean).join(' · ');
    return `<div class="box rbox"><div class="eyebrow">${games.length > shown.length ? `Last ${shown.length} results` : 'Results so far'} · click a game for the box score</div>
      <div class="rhead"><span class="big">${esc(record || rec(games))}</span><span class="dim">${esc(subTxt)}</span></div>
      <ol class="rlist">${shown.map(g => `<li ${g.attr} tabindex="0" role="button" title="Box score"><span class="d">${fmt(g.date)}</span><span class="wl ${g.result}">${g.result}</span><span class="o">${g.site === 'A' ? 'at' : 'vs'} ${esc(g.opp)}</span><span class="sc">${g.us != null ? g.us + '-' + g.them : ''}</span><span class="go" aria-hidden="true">›</span></li>`).join('')}</ol>
      ${more ? `<a class="golink" href="${esc(more[0])}">${esc(more[1])} ›</a>` : ''}
      ${meta ? `<div class="meta">${meta}</div>` : ''}</div>`;
  };
})();
