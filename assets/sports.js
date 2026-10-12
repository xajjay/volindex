/* The Vol Index — shared team page for basketball, baseball and softball.
   Data: data/<sport>.js (window.SITE[sport]) + editable data/<sport>-lineup.js (window.LINEUP[sport]). */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const fmtDate = (iso, o) => { if (!iso) return 'TBA'; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-US', o || { weekday: 'short', month: 'short', day: 'numeric' }); };
  const today = () => new Date().toISOString().slice(0, 10);
  const COLS = { num: '#', name: 'Name', pos: 'Pos', bt: 'B/T', ht: 'Ht', wt: 'Wt', cls: 'Class', home: 'Hometown', hs: 'High school', prev: 'Previous school', note: 'Notes' };
  const HIDE_SM = new Set(['bt', 'wt', 'home', 'hs', 'prev', 'note']);

  let S, key, lineup, editing = false, rosterQ = '';
  const LKEY = k => 'vi-lineup-' + k + '-v1';

  function tabs(D) {
    const t = [['overview', 'Overview'], ['roster', 'Roster'], ['lineup', D.lineupTab || (D.key === 'baseball' || D.key === 'softball' ? 'Projected Lineup' : 'Projected Starters')],
      ['schedule', 'Schedule']];
    if (D.stats) t.push(['stats', 'Stats']);
    return t.concat([['ratings', 'Rankings & Ratings'], ['review', D.prevLabel + ' Review'], ['moves', 'Roster Moves'], ['history', 'History']]);
  }
  function header(D, tab) {
    return `<div class="teamhead"><div class="wrap">
      <div><div class="eyebrow">Tennessee Volunteers · SEC · ${esc(D.season)}</div><h1>${esc(D.name)}</h1></div>
      <div class="scoreline" aria-label="Snapshot">${D.header.map(h => `<div><b>${esc(h[0])}</b><small>${esc(h[1])}</small></div>`).join('')}</div>
      <nav class="tabs" aria-label="${esc(D.name)} sections">${tabs(D).map(([k, l]) => `<a href="#${D.key}-${k}" aria-current="${k === tab ? 'page' : 'false'}">${esc(l)}</a>`).join('')}</nav>
    </div></div><div class="checker" aria-hidden="true"></div>`;
  }
  function footer(D) {
    return `<footer><div class="wrap">Data gathered ${fmtDate(window.lastUpdated ? window.lastUpdated(D.key) : D.updated, { month: 'long', day: 'numeric', year: 'numeric' })}. Sources:
      <ul>${D.sources.map(s => `<li>${esc(s[0])}: <a href="${s[2]}" target="_blank" rel="noopener">${esc(s[1])}</a></li>`).join('')}</ul>
      Fan site, not affiliated with the University of Tennessee.</div></footer>`;
  }
  const vsat = g => g.site === 'H' ? 'vs' : g.site === 'A' ? 'at' : 'vs';
  const kindChip = g => g.kind === 'exh' ? '<span class="chip">Exhibition</span>' : g.kind === 'conf' ? '<span class="chip">SEC</span>' : g.kind === 'event' ? '<span class="chip new">Event</span>' : '';
  const nextGame = D => D.schedule.find(g => !g.result && g.date >= today()) || null;
  window.sportNext = k => (window.SITE && window.SITE[k]) ? nextGame(window.SITE[k]) : null;
  const resStr = g => g.result ? `<span class="${g.result}">${g.result}</span>${g.us != null ? ' ' + g.us + '–' + g.them : ''}` : '';

  /* ---------- overview ---------- */
  function overview(D) {
    const n = nextGame(D);
    const newcomers = D.roster.filter(p => p.note && p.note !== 'Freshman').slice(0, 8);
    return `<div class="box quick"><div class="eyebrow">The quick read</div><ul>${D.quick.map(q => `<li>${q}</li>`).join('')}</ul></div>
      <div class="grid g2">
        ${n ? `<div class="box nextgame matchup"><div class="eyebrow">${n.kind === 'exh' ? 'Next exhibition' : 'Next up'} · ${fmtDate(n.date, { weekday: 'long', month: 'long', day: 'numeric' })}${n.time ? ' · ' + esc(n.time) + ' ET' : ''}${n.tv ? ' · ' + esc(n.tv) : ''}</div>
          <div class="vs">${vsat(n)} ${esc(n.opp)}</div><div class="meta">${esc(n.loc)} ${kindChip(n)}</div>
          ${(w => w ? `<div class="meta"><b>📺 How to watch: ${esc(w.net)}</b> · ${esc(w.stream)}</div>` : '<div class="meta">📺 TV: TBA (usually announced 1–2 weeks out)</div>')(window.howToWatch && window.howToWatch(n.tv))}</div>` : ''}
        ${D.inSeason ? (() => { const played = D.schedule.filter(g => g.result && g.kind !== 'exh'); return `<div class="box nextgame"><div class="eyebrow">This season · ${esc(D.season)}</div>
          <div class="controls">${played.slice(-6).map(g => `<span class="chip">${resStr(g)} ${vsat(g) === 'at' ? '@' : 'v'} ${esc(g.opp.replace(/ \(No\. \d+\)/, ''))}</span>`).join('')}</div>
          <div class="meta">${esc(D.header.map(h => h[1] + ': ' + h[0]).slice(0, 3).join(' · '))}</div></div>`; })() : `<div class="box nextgame"><div class="eyebrow">Last season · ${esc(D.last.label)}</div>
          <div class="vs">${esc(D.last.record)}</div><div class="meta">${esc(D.last.conf)} · ${esc(D.last.finish)}</div><div class="meta">${esc(D.last.rank)}</div></div>`}
      </div>
      ${newcomers.length ? `<div class="section"><h3>Players to know <small>Key returners and newcomers</small></h3>
        <div class="grid g4">${newcomers.map(p => `<div class="pcard" style="cursor:default"><div class="pcard-top"><span class="jersey">${esc(p.num)}</span><div><div class="nm">${esc(p.name)}</div><div class="sub">${esc(p.pos)} · ${esc(p.cls)}${p.prev ? ' · from ' + esc(p.prev.split(' / ').pop()) : ''}</div></div></div><div class="why">${esc(p.note)}</div></div>`).join('')}</div></div>` : ''}
      <div class="section"><h3>Coaching staff</h3><div class="box"><ul class="list">${D.staff.map(s => `<li><b class="grow">${esc(s[0])}</b><span class="dim">${esc(s[1])}</span></li>`).join('')}</ul></div></div>`;
  }

  /* ---------- roster ---------- */
  function roster(D) {
    return `<div class="panel-head"><div><h2>${esc(D.season)} Roster</h2><p>${D.roster.length} players.</p></div>
      <div class="controls"><input type="search" id="sRosterQ" placeholder="Search name, hometown or school" value="${esc(rosterQ)}" aria-label="Search roster"></div></div>
      <div class="tablewrap"><table><thead><tr>${D.rosterCols.map(c => `<th class="${c === 'num' ? 'n' : ''} ${HIDE_SM.has(c) ? 'hide-sm' : ''}">${COLS[c]}</th>`).join('')}</tr></thead><tbody id="sRosterBody"></tbody></table></div>`;
  }
  function wireRoster(D) {
    const draw = () => {
      const q = rosterQ.toLowerCase();
      $('#sRosterBody').innerHTML = D.roster.filter(p => !q || Object.values(p).join(' ').toLowerCase().includes(q)).map(p =>
        `<tr>${D.rosterCols.map(c => c === 'num' ? `<td class="n"><b>${esc(p.num)}</b></td>` : c === 'name' ? `<td><b>${esc(p.name)}</b></td>` : `<td class="${HIDE_SM.has(c) ? 'hide-sm' : ''}${c === 'note' ? ' dim small' : ''}">${esc(p[c] || (c === 'prev' ? '' : '—'))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${D.rosterCols.length}">No players match.</td></tr>`;
    };
    $('#sRosterQ').addEventListener('input', e => { rosterQ = e.target.value; draw(); });
    draw();
  }

  /* ---------- lineup (editable) ---------- */
  function loadLineup(k) { const d = store.get(LKEY(k)); const l = d || JSON.parse(JSON.stringify(window.LINEUP[k])); l._draft = !!d; return l; }
  function lineupPanel(D) {
    const L = lineup, byName = new Map(D.roster.map(p => [p.name, p]));
    const pool = D.roster.map(p => [p.name, `${p.name} · ${p.pos} #${p.num}`]).sort((a, b) => a[0].localeCompare(b[0]));
    return `${L._draft ? `<div class="notice"><span><b>Unsaved edits.</b> These lineup changes live only in this browser. Save them to the data file to make them permanent.</span><button class="btn small" data-la="export">Save to file</button><button class="btn small" data-la="reset">Discard my edits</button></div>` : ''}
      <div class="panel-head"><div><h2>${esc(L.label)}</h2><p>${esc(L.basedOn)}. Updated ${fmtDate(L.updated, { month: 'short', day: 'numeric', year: 'numeric' })}. The first name at each spot is the projected starter.</p></div>
        <div class="controls">${editing ? '' : '<button class="btn" data-la="edit">Edit lineup</button>'}</div></div>
      ${editing ? `<div class="editbar"><p>Editing. Use ↑ ↓ to reorder, ✕ to remove, and the menu under each spot to add a player. Changes stay in this browser until you save them to the file.</p>
        <button class="btn primary" data-la="done">Done</button><button class="btn" data-la="export">Save to file</button><button class="btn" data-la="reset">Reset to file version</button></div>` : ''}
      <div id="lExport"></div>
      <div class="${editing ? 'editing' : ''}">${Object.entries(L.chart).map(([grp, rows]) => `<div class="side-title">${esc(grp)}</div>
        <div class="dgrid">${rows.map(([pos, names], ri) => `<div class="dpos"><div class="dpos-h"><b>${esc(pos)}</b><span>${names.length} listed</span></div>
          <ol>${names.map((n, i) => { const p = byName.get(n); return `<li><span class="ord">${i + 1}</span><div class="pn">${p ? `<b class="num pnum">${esc(p.num)}</b>` : ''}${esc(n)}<small>${esc(p ? p.cls : '')}</small>
            <div class="tags">${p ? (p.prev && !/^20\d\d:|last season/i.test(p.note || '') ? '<span class="chip">Transfer</span>' : p.cls === 'Fr.' ? '<span class="chip new">Freshman</span>' : '<span class="chip">Returner</span>') : '<span class="chip risk-Watch">Not on roster</span>'}</div>${p && p.note && i === 0 ? `<div class="dim small">${esc(p.note)}</div>` : ''}</div>
            ${editing ? `<div class="edit-tools" data-g="${esc(grp)}" data-r="${ri}" data-i="${i}"><button data-m="up" aria-label="Move ${esc(n)} up">↑</button><button data-m="down" aria-label="Move ${esc(n)} down">↓</button><button data-m="rm" aria-label="Remove ${esc(n)}">✕</button></div>` : '<span></span>'}</li>`; }).join('')}</ol>
          ${editing ? `<div class="addrow"><select data-add="${esc(grp)}|${ri}" aria-label="Add player to ${esc(pos)}"><option value="">+ Add player…</option>${pool.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>` : ''}
        </div>`).join('')}</div>`).join('')}</div>`;
  }
  function lineupText(D) {
    const L = lineup;
    const rows = Object.entries(L.chart).map(([g, rs]) => `    "${g}": [\n` + rs.map(([p, n]) => `      ["${p}", ${JSON.stringify(n)}]`).join(',\n') + '\n    ]').join(',\n');
    return `/* ============================================================
   ${D.name.toUpperCase()} PROJECTED LINEUP  (this is the file you edit)
   Easiest: open the site > ${D.name} > Lineup > "Edit lineup",
   then "Save to file" and replace this file.
   By hand: each row is ["SPOT", ["starter", "backup", ...]].
   Names must match the roster exactly.
   ============================================================ */
window.LINEUP = window.LINEUP || {};
window.LINEUP.${D.key} = {
  "label": ${JSON.stringify(L.label)},
  "updated": "${today()}",
  "basedOn": ${JSON.stringify(L.basedOn)},
  "chart": {
${rows}
  }
};
`;
  }
  async function exportLineup(D) {
    const text = lineupText(D);
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: D.key + '-lineup.js', types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }] });
        const w = await h.createWritable(); await w.write(text); await w.close();
        store.del(LKEY(D.key)); lineup._draft = false; editing = false; render(D.key, 'lineup');
        $('#lExport').innerHTML = `<div class="notice ok"><span>Saved. If you saved over <b>data/${D.key}-lineup.js</b>, the site now uses your lineup.</span></div>`;
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    $('#lExport').innerHTML = `<div class="box" style="padding:12px;margin-bottom:12px;display:grid;gap:8px"><b>Copy this into data/${D.key}-lineup.js (replace everything in the file)</b>
      <textarea class="export" id="lText" readonly>${esc(text)}</textarea><div class="controls"><button class="btn primary" id="lCopy">Copy text</button><span id="lMsg" class="dim"></span></div></div>`;
    $('#lCopy').addEventListener('click', () => {
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => { $('#lMsg').textContent = 'Copied.'; })
        .catch(() => { const t = $('#lText'); t.focus(); t.select(); $('#lMsg').textContent = 'Text selected. Press Ctrl+C to copy.'; });
    });
  }
  function wireLineup(D) {
    const save = () => { lineup._draft = true; store.set(LKEY(D.key), lineup); render(D.key, 'lineup'); };
    document.querySelectorAll('[data-la]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.la;
      if (a === 'edit') { editing = true; render(D.key, 'lineup'); }
      else if (a === 'done') { editing = false; render(D.key, 'lineup'); }
      else if (a === 'export') exportLineup(D);
      else if (a === 'reset') { store.del(LKEY(D.key)); lineup = loadLineup(D.key); render(D.key, 'lineup'); }
    }));
    document.querySelectorAll('.edit-tools button').forEach(b => b.addEventListener('click', () => {
      const t = b.parentElement, list = lineup.chart[t.dataset.g][+t.dataset.r][1], i = +t.dataset.i;
      if (b.dataset.m === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      else if (b.dataset.m === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
      else if (b.dataset.m === 'rm') list.splice(i, 1);
      save();
    }));
    document.querySelectorAll('[data-add]').forEach(s => s.addEventListener('change', () => {
      if (!s.value) return; const [g, r] = s.dataset.add.split('|'); const list = lineup.chart[g][+r][1];
      if (!list.includes(s.value)) list.push(s.value); save();
    }));
  }

  /* ---------- schedule ---------- */
  function schedule(D) {
    const n = nextGame(D);
    const conf = D.schedule.filter(g => g.kind === 'conf').length, home = D.schedule.filter(g => g.site === 'H' && g.kind !== 'exh').length;
    return `<div class="panel-head"><div><h2>${esc(D.season)} Schedule</h2><p>${D.scheduleNote ? esc(D.scheduleNote) + ' ' : ''}Home games at ${esc(D.venue)}. Times Eastern.</p></div></div>
      <div class="tiles four" style="margin-bottom:16px"><div class="tile"><b>${D.schedule.filter(g => g.kind !== 'exh').length}</b><span>${D.key === 'baseball' || D.key === 'softball' ? 'Dates / series listed' : 'Games'}</span></div>
        <div class="tile"><b>${conf}</b><span>SEC ${D.key === 'baseball' || D.key === 'softball' ? 'series' : 'games'}</span></div><div class="tile"><b>${home}</b><span>Home dates</span></div>
        <div class="tile"><b>${n ? fmtDate(n.date, { month: 'short', day: 'numeric' }) : '—'}</b><span>Next: ${n ? esc(n.opp) : 'TBA'}</span></div></div>
      <div class="tablewrap"><table><thead><tr><th>Date</th><th>Opponent</th><th class="hide-sm">Location</th><th>${D.inSeason ? 'Result / Time' : 'Time'}</th><th class="hide-sm">TV</th></tr></thead>
      <tbody>${D.schedule.map(g => `<tr class="${n && g === n ? 'me' : ''}"><td class="num">${fmtDate(g.date)}</td><td><b>${vsat(g)} ${esc(g.opp)}</b> ${kindChip(g)}</td><td class="hide-sm">${esc(g.loc)}</td><td class="num">${g.result ? resStr(g) : esc(g.time ? g.time + ' ET' : g.kind === 'exh' ? '—' : 'TBA')}</td><td class="hide-sm">${esc(g.tv || '—')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- stats ---------- */
  function stats(D) {
    const T = D.stats; const rows = T.rows.slice().sort((a, b) => (b[T.sort] ?? -1) - (a[T.sort] ?? -1));
    return `<div class="panel-head"><div><h2>${esc(T.title)}</h2><p>${esc(T.note || '')}</p></div></div>
      <div class="tablewrap"><table><thead><tr><th>Player</th>${T.cols.map(c => `<th class="n">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => { const p = D.roster.find(x => x.name === r[0]); return `<tr><td><b>${esc(r[0])}</b> <span class="dim small">${p ? esc(p.pos + ' · ' + p.cls) : ''}</span></td>${r.slice(1).map(v => `<td class="n">${v == null ? '—' : esc(v)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
  }

  /* ---------- ratings ---------- */
  function ratings(D) {
    const R = D.ratings;
    return `<div class="panel-head"><div><h2>Rankings & Ratings</h2><p>${esc(R.intro)}</p></div></div>
      <div class="tablewrap"><table><thead><tr><th>Source</th><th class="n">Tennessee</th><th>Notes</th></tr></thead>
      <tbody>${R.rows.map(r => `<tr><td><a href="${r[3]}" target="_blank" rel="noopener"><b>${esc(r[0])}</b></a></td><td class="n"><b>${esc(r[1])}</b></td><td class="dim">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>
      ${R.compare && R.compare.length ? `<div class="section"><h3>${esc(R.compareTitle)}</h3><div class="box"><div class="lb"><ol>${R.compare.map(([t, r]) => `<li class="${t === 'Tennessee' ? 'me-li' : ''}"><span><b>${esc(t)}</b></span><b class="num">No. ${r}</b><span class="bar"><i style="width:${Math.max(4, 100 - (r - 1) * (96 / Math.max(...R.compare.map(c => c[1]))))}%"></i></span></li>`).join('')}</ol></div></div></div>` : ''}
      <details class="box gloss"><summary>What do these ratings mean?</summary><dl>${R.glossary.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>`;
  }

  /* ---------- review ---------- */
  function review(D) {
    const L = D.last;
    const w = (L.results || []).filter(r => r.result === 'W').length;
    return `<div class="panel-head"><div><h2>${esc(L.label)} Season Review</h2><p>${esc(L.finish)}.</p></div></div>
      <div class="tiles four" style="margin-bottom:16px"><div class="tile"><b>${esc(L.record)}</b><span>Overall</span></div><div class="tile"><b>${esc(L.conf.split(' ')[0])}</b><span>${esc(L.conf.split(' ').slice(1).join(' '))}</span></div>
        <div class="tile"><b>${esc(L.rank.split(' (')[0])}</b><span>${esc((L.rank.split(' (')[1] || 'Final ranking').replace(')', ''))}</span></div><div class="tile"><b>${esc(L.finish.split(' (')[0].replace('NCAA ', ''))}</b><span>Postseason</span></div></div>
      <div class="box quick" style="background:var(--surface-2)"><ul>${L.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
      ${L.leaders.length ? `<div class="section"><h3>Standouts</h3><div class="box"><ul class="list">${L.leaders.map(l => `<li><b class="namecol">${esc(l[0])}</b><span class="dim" style="min-width:40px">${esc(l[1])}</span><span class="grow num">${esc(l[2])}</span><span class="dim">${esc(l[3])}</span></li>`).join('')}</ul></div></div>` : ''}
      ${L.hitting ? `<div class="section"><h3>Top hitters <small>${esc(L.label)}</small></h3><div class="tablewrap"><table><thead><tr><th>Player</th><th class="n">AVG</th><th class="n">HR</th><th class="n">RBI</th><th class="n">OBP</th><th class="n">SLG</th><th>2027</th></tr></thead>
        <tbody>${L.hitting.map(h => `<tr><td><b>${esc(h[0])}</b></td><td class="n">${h[1]}</td><td class="n">${h[2]}</td><td class="n">${h[3]}</td><td class="n">${h[4]}</td><td class="n">${h[5]}</td><td>${h[6] === 'Returns' ? '<span class="chip">Returns</span>' : h[6] ? `<span class="chip leave">${esc(h[6])}</span>` : '—'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${L.results && L.results.length ? `<div class="section"><h3>Game by game <small>${w}-${L.results.length - w}</small></h3><div class="tablewrap" style="max-height:560px"><table><thead><tr><th>Date</th><th>Opponent</th><th>Result</th></tr></thead>
        <tbody>${L.results.map(r => `<tr><td class="num">${fmtDate(r.date, { month: 'short', day: 'numeric' })}</td><td>${esc(r.opp)} ${r.kind === 'conf' ? '<span class="chip">SEC</span>' : r.kind === 'post' ? '<span class="chip honor">Postseason</span>' : ''}</td><td class="num"><span class="${r.result}">${r.result}</span> ${r.us}–${r.them}${r.note ? ' ' + esc(r.note) : ''}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  }

  /* ---------- moves ---------- */
  function moves(D) {
    const M = D.moves;
    return `<div class="panel-head"><div><h2>Roster Moves</h2><p>Who arrived, who left, and who's committed for next year.</p></div></div>
      <div class="grid g2">
        <div class="box"><div class="lb"><h4>Additions <span>${M.added.length}</span></h4></div><ul class="list">${M.added.map(a => `<li><b class="grow">${esc(a[0])}</b><span class="dim">${esc(a[1])}</span>${a[2] ? `<span class="num small">${esc(a[2])}</span>` : ''}</li>`).join('')}</ul></div>
        <div class="box"><div class="lb"><h4>Departures <span>${M.lost.length}</span></h4></div><ul class="list">${M.lost.map(a => `<li><b class="grow">${esc(a[0])}</b><span class="dim">${esc(a[1])}</span></li>`).join('') || '<li class="dim">Not tracked yet.</li>'}</ul></div>
      </div>
      <div class="section"><h3>Recruiting <small>${esc(M.recruitNote || '')}</small></h3>
        ${M.recruits.length ? `<div class="box"><ul class="list">${M.recruits.map(r => `<li><b class="grow">${esc(r.name)}</b><span class="dim">${esc(r.pos)}</span><span class="small">${esc(r.note)}</span></li>`).join('')}</ul></div>` : `<p class="dim">${esc(M.recruitNote || 'No commitments listed yet.')}</p>`}</div>`;
  }

  /* ---------- history ---------- */
  function history(D) {
    const H = D.history;
    return `<div class="panel-head"><div><h2>History</h2><p>Program honors and season-by-season results since ${esc(H.seasons[H.seasons.length - 1].season)}.</p></div></div>
      <div class="grid g4">${H.titles.map(t => `<div class="box titlebox"><b>${esc(t[0])}</b><div class="eyebrow">${esc(t[1])}</div><p>${esc(t[2])}</p></div>`).join('')}</div>
      ${H.retired && H.retired.length ? `<div class="section"><h3>Retired jerseys</h3><div class="grid g4">${H.retired.map(r => `<div class="box retired"><span class="rnum">${esc(r[0])}</span><div><b>${esc(r[1])}</b></div></div>`).join('')}</div></div>` : ''}
      ${H.notable ? `<p class="dim" style="margin-top:16px">${esc(H.notable)}</p>` : ''}
      <div class="section"><h3>Season by season</h3><div class="tablewrap" style="max-height:600px"><table><thead><tr><th>Season</th><th>Coach</th><th>Overall</th><th>SEC</th><th>Postseason</th></tr></thead>
      <tbody>${H.seasons.map(s => `<tr><td class="num"><b>${esc(s.season)}</b></td><td>${esc(s.coach)}</td><td class="num">${esc(s.overall)}</td><td class="num">${esc(s.conf || '—')}</td><td>${/champion/i.test(s.post || '') ? `<span class="chip honor">${esc(s.post)}</span>` : esc(s.post || '—')}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function render(k, tab) {
    const D = window.SITE[k]; const app = document.getElementById('app');
    if (key !== k) { key = k; editing = false; rosterQ = ''; lineup = loadLineup(k); }
    if (!tabs(D).find(t => t[0] === tab)) tab = 'overview';
    const body = { overview, roster, lineup: lineupPanel, schedule, stats, ratings, review, moves, history }[tab](D);
    app.innerHTML = header(D, tab) + `<main class="wrap">${body}</main>` + footer(D);
    if (tab === 'roster') wireRoster(D);
    if (tab === 'lineup') wireLineup(D);
  }
  window.renderSport = render;
  window.sportStatus = function (k) {
    const D = window.SITE && window.SITE[k]; if (!D) return null;
    const n = nextGame(D);
    const cur = D.inSeason ? (() => { const r = D.header.find(h => /record/i.test(h[1])); const c = D.header.find(h => h[1] === 'SEC'); return `${D.season}: ${r ? r[0] : ''}${c ? ' (' + c[0] + ' SEC)' : ''}`; })() : `${D.prevLabel}: ${D.last.record}`;
    return `${cur}${n ? ' · Next: ' + n.opp.replace(/ \(\d games\)/, '') + ' ' + fmtDate(n.date, { month: 'short', day: 'numeric' }) : ''}`;
  };
})();
