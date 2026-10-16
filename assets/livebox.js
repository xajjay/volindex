/* The Vol Index — live box score window. Click "Live box score" on a live or final game card to see the
   line score, team stats, player stats and recent plays straight from ESPN. Refreshes every 20 s while the game is on. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/';
  let timer = null, cur = null;

  function line(h) {
    const cs = (((h || {}).competitions || [])[0] || {}).competitors || [];
    if (!cs.length || !cs.some(c => (c.linescores || []).length)) return '';
    const n = Math.max(...cs.map(c => (c.linescores || []).length));
    const head = Array.from({ length: n }, (_, i) => `<th class="n">${i + 1}</th>`).join('');
    return `<div class="tablewrap"><table class="lbx-line"><thead><tr><th></th>${head}<th class="n">T</th></tr></thead><tbody>${cs.map(c => `<tr class="${c.team && c.team.abbreviation === 'TENN' ? 'me' : ''}"><td><b>${esc(c.team ? c.team.displayName || c.team.location : '')}</b></td>${Array.from({ length: n }, (_, i) => `<td class="n num">${esc(((c.linescores || [])[i] || {}).displayValue ?? '')}</td>`).join('')}<td class="n num"><b>${esc(c.score ?? '')}</b></td></tr>`).join('')}</tbody></table></div>`;
  }
  function teamStats(b) {
    const T = (b && b.teams) || []; if (T.length < 2 || !(T[0].statistics || []).length) return '';
    const rows = T[0].statistics.map(s => [s.label || s.name, s.displayValue, (T[1].statistics.find(x => (x.name || x.label) === (s.name || s.label)) || {}).displayValue]).filter(r => r[0] && r[1] != null);
    return `<h4>Team stats</h4><div class="tablewrap"><table><thead><tr><th>${esc(T[0].team.abbreviation)}</th><th></th><th class="n">${esc(T[1].team.abbreviation)}</th></tr></thead><tbody>${rows.map(r => `<tr><td class="num"><b>${esc(r[1])}</b></td><td class="dim">${esc(r[0])}</td><td class="n num"><b>${esc(r[2] ?? '—')}</b></td></tr>`).join('')}</tbody></table></div>`;
  }
  function players(b) {
    return ((b && b.players) || []).map(t => (t.statistics || []).filter(c => (c.athletes || []).length).map(c => {
      const labels = c.labels || [];
      return `<h4>${esc(t.team.displayName)}${c.name ? ' · ' + esc(String(c.name).replace(/([A-Z])/g, ' $1').replace(/^./, x => x.toUpperCase())) : ''}</h4><div class="tablewrap"><table><thead><tr><th>Player</th>${labels.map(l => `<th class="n">${esc(l)}</th>`).join('')}</tr></thead><tbody>${c.athletes.slice(0, 15).map(a => `<tr><td>${esc((a.athlete || {}).displayName || '')}${(a.athlete || {}).jersey ? ` <span class="dim">#${esc(a.athlete.jersey)}</span>` : ''}</td>${labels.map((_, i) => `<td class="n num">${esc((a.stats || [])[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }).join('')).join('');
  }
  function plays(d) {
    const P = (d.scoringPlays && d.scoringPlays.length ? d.scoringPlays : d.keyEvents && d.keyEvents.length ? d.keyEvents : d.plays || []).slice(-12).reverse();
    if (!P.length) return '';
    return `<h4>${d.scoringPlays && d.scoringPlays.length ? 'Scoring plays' : 'Recent plays'}</h4><ol class="lbx-plays">${P.map(p => `<li><span class="dim">${esc((p.period && p.period.displayValue ? p.period.displayValue + ' ' : '') + ((p.clock || {}).displayValue || ''))}</span> ${esc(p.text || p.shortText || (p.type || {}).text || '')}</li>`).join('')}</ol>`;
  }
  async function load() {
    const g = window.VI_LIVE[cur], body = document.getElementById('lbxBody'); if (!g || !body) return;
    const P = window.VI_LIVE_PATH[cur];
    try {
      if (!g.id) throw 0;
      const r = await fetch(`${ESPN}${P[0]}/summary?event=${g.id}`, { cache: 'no-store' }); if (!r.ok) throw 0;
      const d = await r.json(), st = (((d.header || {}).competitions || [])[0] || {}).status || {};
      const live = g.state === 'in';
      const html = `<div class="lbx-status">${live ? '<span class="livedot"></span><b>LIVE</b> · ' : ''}${esc((st.type || {}).detail || g.detail || '')}${live ? ' · updates every 20 seconds' : ''}</div>${line(d.header)}${plays(d)}${teamStats(d.boxscore)}${players(d.boxscore) || '<p class="dim small">Player stats appear here once ESPN posts them.</p>'}<p class="dim small">Live data from ESPN. It may lag the broadcast by a minute or so.</p>`;
      if (body.dataset.h !== html) { body.dataset.h = html; body.innerHTML = html; }
    } catch (e) { body.innerHTML = '<p class="dim">Live box score isn\'t available right now.' + (g.link ? ` <a href="${esc(g.link)}" target="_blank" rel="noopener">Open on ESPN ›</a>` : '') + '</p>'; }
    clearTimeout(timer); if (document.getElementById('lbx') && g.state === 'in') timer = setTimeout(load, 20e3);
  }
  function close() { clearTimeout(timer); const m = document.getElementById('lbx'); if (m) m.remove(); document.body.classList.remove('lbx-lock'); }
  function open(k) {
    const g = window.VI_LIVE[k]; if (!g) return; cur = k; close();
    const m = document.createElement('div'); m.id = 'lbx'; m.className = 'lbx'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = `<div class="lbx-card"><div class="lbx-top"><b>${esc(g.us.abbr)} ${esc(g.us.score ?? 0)}, ${esc(g.them.abbr)} ${esc(g.them.score ?? 0)}</b><span class="dim">${g.state === 'in' ? 'Live box score' : 'Final box score'}</span><button type="button" class="lbx-x" aria-label="Close">×</button></div><div id="lbxBody"><p class="dim">Loading…</p></div></div>`;
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('.lbx-x')) close(); });
    document.body.appendChild(m); document.body.classList.add('lbx-lock'); load();
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-livebox]'); if (b) { e.preventDefault(); open(b.dataset.livebox); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('lbx')) load(); });
})();
