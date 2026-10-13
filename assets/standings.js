/* SEC standings section (shown on each sport's Schedule & Standings tab). Data: data/standings-auto.js (ESPN). */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wl = r => { const p = String(r || '').split('-').map(Number); const [w = 0, l = 0, t = 0] = p; const g = w + l + t; return { w, l, t, g, pct: g ? (w + t / 2) / g : 0 }; };
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const isUT = r => /^Tennessee$/i.test(r.team || '') || /Tennessee (Volunteers|Lady Volunteers|Lady Vols)/i.test(r.name || '');
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
    const rows = placed(S.rows); const hasStreak = rows.some(r => r.streak);
    return `<div class="section" id="standings"><h3>SEC standings <small>${S.final ? esc(S.season) + ' final (this season hasn\'t started yet)' : esc(S.season) + ' · updated ' + new Date(S.updated + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></h3>
      <div class="tablewrap standings"><table><thead><tr><th class="n">#</th><th>Team</th><th class="n">SEC</th><th class="n">Overall</th>${hasStreak ? '<th class="n hide-sm">Streak</th>' : ''}</tr></thead>
      <tbody>${rows.map(r => `<tr class="${isUT(r) ? 'me' : ''}"><td class="n num">${r.tie ? 'T-' : ''}${r.place}</td><td><b>${esc(r.team)}</b></td><td class="n num"><b>${esc(r.conf || '—')}</b></td><td class="n num">${esc(r.overall || '—')}</td>${hasStreak ? `<td class="n num hide-sm">${esc(r.streak || '')}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      <p class="dim small">Sorted by SEC winning percentage; ties share a place (official tiebreakers aren't applied). Source: ${S.source ? `<a href="${esc(S.source.replace(/\/apis\/.*$/, '').replace('site.api.espn.com', 'www.espn.com'))}" target="_blank" rel="noopener">${esc(S.sourceName || 'ESPN')}</a>` : esc(S.sourceName || 'ESPN')}.</p></div>`;
  };
})();
