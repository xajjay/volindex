/* The Vol Index — bug reports and suggestions.
   Anyone can send one (no sign-in): a Feedback button on game pages, a notice on the games hub,
   a footer link everywhere, and window.VI_FEEDBACK.open() for any page. Reports go to the Supabase
   table "feedback" (see tools/FEEDBACK_SETUP.md); if that is not reachable, the report opens as an
   email instead so nothing is lost. AJ reads them at /about/inbox (signed in with an admin email). */
(function () {
  'use strict';
  const EMAIL = 'thevolindex@gmail.com';
  const KINDS = [['bug', 'Bug or glitch'], ['idea', 'Idea'], ['fix', 'Fix / correction'], ['other', 'Other']];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  // the last few script errors, attached to bug reports so they are easier to fix
  const ERRS = [];
  window.addEventListener('error', e => { ERRS.push(String(e.message || e.error || 'error').slice(0, 200) + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')); if (ERRS.length > 5) ERRS.shift(); });
  window.addEventListener('unhandledrejection', e => { ERRS.push('promise: ' + String(e.reason && (e.reason.message || e.reason)).slice(0, 200)); if (ERRS.length > 5) ERRS.shift(); });

  const SPORTS = { football: 'Football', 'mens-basketball': "Men's basketball", mbb: "Men's basketball", 'womens-basketball': "Women's basketball", wbb: "Women's basketball", baseball: 'Baseball', softball: 'Softball', volleyball: 'Volleyball', soccer: 'Soccer' };
  const GAMES = { dynasty: 'Dynasty', run: 'Undefeated run', guesser: 'Vol Guesser', rankings: 'Rocky Top Rankings', duel: 'Duel', trivia: 'Trivia' };
  function where() {
    const parts = (location.pathname + ' ' + location.hash).toLowerCase().split(/[\/#\s-]+/).filter(Boolean);
    const gi = parts.indexOf('games');
    if (gi >= 0) { const sp = SPORTS[parts[gi + 1]], gm = GAMES[parts[gi + 2]] || GAMES[parts[gi + 3]]; return ['Games', sp, gm].filter(Boolean).join(' · '); }
    const sp = parts.map(p => SPORTS[p]).find(Boolean);
    return sp ? sp + ' pages' : parts[0] === 'about' ? 'About' : 'Home / other';
  }
  function gameState() {
    const o = {};
    try { if (window.DY && DY.G && DY.userT) { const g = DY.G, u = DY.userT(); o.dynasty = { sport: 'football', team: u && u.name, season: g.season, phase: g.phase, week: g.week, stage: g.off && g.off.stage }; } } catch (e) {}
    try { if (window.SD && SD.G) { const g = SD.G; o.sdyn = { sport: g.sport, season: g.season, phase: g.phase, day: g.day }; } } catch (e) {}
    return o;
  }
  const onGames = () => /(^|\/|#)games(\/|-|$)/.test(location.pathname + location.hash);

  /* ---------- sending ---------- */
  async function send(r) {
    const CFG = window.VI_AUTH_CONFIG;
    const row = { kind: r.kind, area: r.area, message: r.message.slice(0, 4000), contact: (r.contact || '').slice(0, 200) || null, page: (location.pathname + location.hash).slice(0, 300),
      meta: Object.assign({ screen: innerWidth + 'x' + innerHeight, ua: navigator.userAgent.slice(0, 200), errors: r.attach ? ERRS.slice() : [] }, r.attach ? gameState() : {}) };
    if (CFG && CFG.url && CFG.anonKey) {
      try {
        const res = await fetch(CFG.url + '/rest/v1/feedback', { method: 'POST', headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + CFG.anonKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(row) });
        if (res.ok) return { ok: true };
      } catch (e) {}
    }
    return { ok: false, row };
  }
  const mailto = row => `mailto:${EMAIL}?subject=${encodeURIComponent('Vol Index ' + (KINDS.find(k => k[0] === row.kind) || ['', 'report'])[1].toLowerCase() + ': ' + row.area)}&body=${encodeURIComponent(row.message + '\n\n' + (row.contact ? 'From: ' + row.contact + '\n' : '') + 'Page: ' + row.page + '\n' + JSON.stringify(row.meta))}`;

  /* ---------- the form ---------- */
  let modal = null;
  function open(opts) {
    opts = opts || {};
    close();
    const kind0 = opts.kind || 'bug';
    modal = document.createElement('div');
    modal.className = 'fb-wrap';
    modal.innerHTML = `<div class="fb-back" data-fbx></div>
      <form class="fb-box" role="dialog" aria-modal="true" aria-labelledby="fbTitle" novalidate>
        <div class="fb-head"><h2 id="fbTitle">Report a bug or share an idea</h2><button type="button" class="fb-x" data-fbx aria-label="Close">×</button></div>
        <p class="fb-sub">No sign-in needed. It goes straight to Aj, who builds the site.</p>
        <div class="fb-kinds" role="radiogroup" aria-label="What is it?">${KINDS.map(([k, l]) => `<button type="button" role="radio" data-k="${k}" aria-pressed="${k === kind0}">${l}</button>`).join('')}</div>
        <label class="fb-l">Where<input class="fb-in" id="fbArea" value="${esc(opts.area || where())}" maxlength="120"></label>
        <label class="fb-l">What happened? <span class="fb-hint" id="fbHint"></span><textarea class="fb-in" id="fbMsg" rows="5" maxlength="4000"></textarea></label>
        <label class="fb-l">Name, email or X handle <em>(optional, only if you want a reply)</em><input class="fb-in" id="fbWho" maxlength="200" autocomplete="email"></label>
        <label class="fb-chk"><input type="checkbox" id="fbAttach" checked> Include page and game details (team, season, screen size, recent errors) to help fix it</label>
        <p class="fb-err" id="fbErr" hidden>Write a quick note first.</p>
        <div class="fb-go"><button type="submit" class="btn primary" id="fbSend">Send</button><button type="button" class="btn" data-fbx>Cancel</button></div>
      </form>`;
    document.body.appendChild(modal);
    document.documentElement.classList.add('fb-open');
    let kind = kind0;
    const hint = () => { modal.querySelector('#fbMsg').placeholder = { bug: 'What did you do, what happened, and what did you expect? Example: In my Kansas dynasty, the selection show froze after the byes.', idea: 'Example: Let me pick my own uniforms in Vol Dynasty.', fix: "Example: #11 on the baseball roster is a junior, not a sophomore.", other: 'Anything on your mind.' }[kind]; };
    hint();
    modal.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { kind = b.dataset.k; modal.querySelectorAll('[data-k]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); hint(); }));
    modal.querySelectorAll('[data-fbx]').forEach(b => b.addEventListener('click', close));
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    modal.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = modal.querySelector('#fbMsg').value.trim(), err = modal.querySelector('#fbErr');
      err.hidden = msg.length >= 3; if (msg.length < 3) { modal.querySelector('#fbMsg').focus(); return; }
      const btn = modal.querySelector('#fbSend'); btn.disabled = true; btn.textContent = 'Sending…';
      const r = await send({ kind, area: modal.querySelector('#fbArea').value.trim() || where(), message: msg, contact: modal.querySelector('#fbWho').value.trim(), attach: modal.querySelector('#fbAttach').checked });
      const box = modal.querySelector('.fb-box');
      if (r.ok) {
        store.set('vi-fb-sent', String(Date.now()));
        box.innerHTML = `<div class="fb-head"><h2>Got it. Thank you!</h2><button type="button" class="fb-x" data-fbx aria-label="Close">×</button></div>
          <p>Your ${kind === 'idea' ? 'idea' : 'report'} is in. Aj reads every one, and fixes ship in site updates.</p>
          <div class="fb-go"><button type="button" class="btn primary" data-fbx>Back to the site</button><button type="button" class="btn" id="fbMore">Send another</button></div>`;
        box.querySelector('#fbMore').addEventListener('click', () => open({ kind }));
      } else {
        box.innerHTML = `<div class="fb-head"><h2>One more step</h2><button type="button" class="fb-x" data-fbx aria-label="Close">×</button></div>
          <p>The report box isn't reachable right now. Send it by email instead; your note is already filled in.</p>
          <div class="fb-go"><a class="btn primary" href="${esc(mailto(r.row))}">Send by email</a><button type="button" class="btn" id="fbCopy">Copy text</button></div>
          <p class="fb-sub">Or DM <a href="https://x.com/Volindex" target="_blank" rel="noopener">@Volindex</a> on X.</p>`;
        box.querySelector('#fbCopy').addEventListener('click', ev => { try { navigator.clipboard.writeText(r.row.message + '\n\nPage: ' + r.row.page); ev.currentTarget.textContent = 'Copied'; } catch (x) {} });
      }
      box.querySelectorAll('[data-fbx]').forEach(b => b.addEventListener('click', close));
    });
    setTimeout(() => modal && modal.querySelector('#fbMsg').focus(), 30);
  }
  function close() { if (modal) { modal.remove(); modal = null; } document.documentElement.classList.remove('fb-open'); }

  /* ---------- where people find it ---------- */
  function decorate() {
    // floating button on game pages (hidden during a live game so it never covers the controls)
    let fab = document.getElementById('fbFab');
    if (!fab) { fab = document.createElement('button'); fab.id = 'fbFab'; fab.className = 'fb-fab'; fab.type = 'button'; fab.innerHTML = '<span aria-hidden="true">🐞</span> Feedback'; fab.title = 'Report a bug or share an idea'; fab.addEventListener('click', () => open()); document.body.appendChild(fab); }
    const live = !!document.querySelector('#dygCtrl, .dyg-fs, .sdg, .cf-show');
    fab.hidden = !onGames() || live;
    // a notice on the games pages: these are new, here's how to tell me what's broken
    const app = document.getElementById('app') || document.querySelector('main');
    if (app && onGames() && !store.get('vi-fb-note') && !app.querySelector('.fb-note')) {
      const n = document.createElement('div'); n.className = 'fb-note';
      n.innerHTML = `<span><b>Vol Games are brand new.</b> Find a bug, a glitch or have an idea? Tell me, no sign-in needed.</span><span class="fb-note-go"><button type="button" class="btn primary small" data-fbopen>Report it</button><button type="button" class="fb-x" aria-label="Dismiss" data-fbhide>×</button></span>`;
      n.querySelector('[data-fbopen]').addEventListener('click', () => open());
      n.querySelector('[data-fbhide]').addEventListener('click', () => { store.set('vi-fb-note', '1'); n.remove(); });
      app.insertBefore(n, app.firstChild);
    }
    // footer link everywhere
    const foot = document.querySelector('.sitefoot .wrap');
    if (foot && !foot.querySelector('[data-fbfoot]')) { const a = document.createElement('a'); a.href = '#'; a.dataset.fbfoot = '1'; a.textContent = 'Report a bug'; a.addEventListener('click', e => { e.preventDefault(); open(); }); const first = foot.querySelector('a'); if (first) { foot.insertBefore(a, first); foot.insertBefore(document.createTextNode(' · '), first); } else foot.appendChild(a); }
  }
  let t = null;
  const soon = () => { clearTimeout(t); t = setTimeout(decorate, 120); };
  window.addEventListener('vi:route', soon);
  window.addEventListener('popstate', soon);
  window.addEventListener('hashchange', soon);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { decorate(); new MutationObserver(soon).observe(document.body, { childList: true, subtree: false }); const a = document.getElementById('app'); if (a) new MutationObserver(soon).observe(a, { childList: true }); });
  else { decorate(); const a = document.getElementById('app'); if (a) new MutationObserver(soon).observe(a, { childList: true }); }
  // clicks anywhere on [data-feedback] open the form (games and dynasty pages use this)
  document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-feedback]'); if (el) { e.preventDefault(); open({ kind: el.dataset.feedback || 'bug' }); } });

  /* ---------- Aj's inbox: /about/inbox ---------- */
  async function inbox(app) {
    app.innerHTML = `<div class="wrap fb-inbox"><div class="eyebrow">Feedback inbox</div><h1>Bug reports and ideas</h1><div id="fbIn"><p class="dim">Loading…</p></div></div>`;
    const el = app.querySelector('#fbIn'), CFG = window.VI_AUTH_CONFIG;
    try {
      if (!window.supabase) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const sb = window._viSb || (window._viSb = window.supabase.createClient(CFG.url, CFG.anonKey));
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { el.innerHTML = `<p>Sign in with your admin email on <a href="${window.VI_ROUTER ? window.VI_ROUTER.href('me') : '#me'}">My games</a>, then come back here.</p>`; return; }
      let filter = 'open';
      const draw = async () => {
        const { data, error } = await sb.from('feedback').select('*').order('created_at', { ascending: false }).limit(300);
        if (error) { el.innerHTML = `<p>Couldn't load the inbox: ${esc(error.message)}. Check tools/FEEDBACK_SETUP.md (the admin email in the policy must match ${esc(user.email)}).</p>`; return; }
        const rows = data || [], open0 = rows.filter(r => r.status === 'new' || r.status === 'seen');
        const shown = filter === 'all' ? rows : filter === 'open' ? open0 : rows.filter(r => r.kind === filter && (r.status === 'new' || r.status === 'seen'));
        const cnt = k => open0.filter(r => r.kind === k).length;
        el.innerHTML = `<p class="dim">${rows.length} total · ${rows.filter(r => r.status === 'new').length} new · signed in as ${esc(user.email)}</p>
          <div class="fb-kinds">${[['open', `Open (${open0.length})`], ['bug', `Bugs (${cnt('bug')})`], ['idea', `Ideas (${cnt('idea')})`], ['fix', `Fixes (${cnt('fix')})`], ['other', `Other (${cnt('other')})`], ['all', 'All']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div>
          ${shown.length ? shown.map(r => `<article class="fb-item ${esc(r.status)}"><div class="fb-meta"><b>${esc((KINDS.find(k => k[0] === r.kind) || ['', r.kind])[1])}</b> · ${esc(r.area || '')} · ${new Date(r.created_at).toLocaleString()} · <span class="fb-st">${esc(r.status)}</span></div>
            <p class="fb-msg">${esc(r.message).replace(/\n/g, '<br>')}</p>
            <div class="fb-meta">${r.contact ? 'From: ' + esc(r.contact) + ' · ' : ''}<a href="${esc(r.page || '#')}">${esc(r.page || '')}</a>${r.meta ? ` · <details><summary>details</summary><pre>${esc(JSON.stringify(r.meta, null, 1))}</pre></details>` : ''}</div>
            <div class="fb-go">${['seen', 'fixed', 'wontfix', 'new'].filter(s => s !== r.status).map(s => `<button type="button" class="btn small" data-id="${r.id}" data-s="${s}">${{ seen: 'Mark seen', fixed: 'Fixed', wontfix: "Won't fix", new: 'Mark new' }[s]}</button>`).join('')}</div></article>`).join('') : '<p class="dim">Nothing here.</p>'}`;
        el.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; draw(); }));
        el.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; await sb.from('feedback').update({ status: b.dataset.s }).eq('id', +b.dataset.id); draw(); }));
      };
      draw();
    } catch (e) { el.innerHTML = '<p>The inbox needs the Supabase connection; try again in a minute.</p>'; }
  }
  const prev = window.renderAbout;
  if (prev) window.renderAbout = (app, tab) => tab === 'inbox' ? inbox(app) : prev(app, tab);

  window.VI_FEEDBACK = { open, send, close };
})();
