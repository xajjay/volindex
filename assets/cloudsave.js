/* The Vol Index — cloud saves for the dynasties. When a player is signed in (the same Supabase sign-in as My games),
   every dynasty save is also backed up to their account, and the dynasty landing page lists those backups so a save
   can be picked up on another phone or computer. Saves still live in the browser first; the cloud copy is a backup.
   Table: public.dynasty_saves (see tools/SIGNIN_SETUP.md, step 6). */
(function (root) {
  'use strict';
  const TABLE = 'dynasty_saves';
  const CFG = () => root.VI_AUTH_CONFIG;
  function signedIn() {
    const c = CFG(); if (!c) return false;
    try { const ref = (/https:\/\/([^.]+)\./.exec(c.url) || [])[1]; return !!(ref && root.localStorage.getItem('sb-' + ref + '-auth-token')); } catch (e) { return false; }
  }
  async function client() {
    const c = CFG(); if (!c) throw new Error('no sign-in');
    if (!root.supabase) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    return root._viSb || (root._viSb = root.supabase.createClient(c.url, c.anonKey));
  }
  async function user(sb) { const { data } = await sb.auth.getUser(); return data && data.user; }
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return root.btoa(s); };
  const unb64 = str => { const s = root.atob(str), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };

  // pushes are coalesced: autosave runs often, the cloud gets the latest copy a few seconds later (and on leaving the page)
  const pending = {}; let timer = null, last = 0;
  async function flush() {
    timer = null; const keys = Object.keys(pending); if (!keys.length) return;
    let sb, u; try { sb = await client(); u = await user(sb); } catch (e) { return; }
    if (!u) return;
    for (const k of keys) {
      const p = pending[k]; delete pending[k];
      try {
        const { error } = await sb.from(TABLE).upsert({ user_id: u.id, game: p.game, slot: p.slot, data: b64(p.bytes), meta: p.meta || {}, updated_at: new Date().toISOString() });
        root.VI_CLOUD.status = error ? 'error' : 'ok'; if (error) root.VI_CLOUD.err = error.message;
      } catch (e) { root.VI_CLOUD.status = 'error'; }
    }
    last = Date.now();
  }
  root.VI_CLOUD = {
    status: null,
    on: signedIn,
    save(game, slot, bytes, meta, now) {
      if (!signedIn() || !bytes) return;
      pending[game + ':' + slot] = { game, slot, bytes, meta };
      clearTimeout(timer);
      const wait = now ? 0 : Math.max(4000, 60000 - (Date.now() - last));
      timer = setTimeout(flush, wait);
    },
    flush,
    async list(game) {
      if (!signedIn()) return [];
      const sb = await client(), u = await user(sb); if (!u) return [];
      const { data, error } = await sb.from(TABLE).select('slot, meta, updated_at').eq('user_id', u.id).eq('game', game).order('slot');
      if (error) throw new Error(error.message);
      return data || [];
    },
    async pull(game, slot) {
      const sb = await client(), u = await user(sb); if (!u) throw new Error('Sign in first.');
      const { data, error } = await sb.from(TABLE).select('data').eq('user_id', u.id).eq('game', game).eq('slot', slot).maybeSingle();
      if (error) throw new Error(error.message); if (!data) throw new Error('No cloud save in that slot.');
      return unb64(data.data);
    },
    async remove(game, slot) {
      if (!signedIn()) return;
      try { const sb = await client(), u = await user(sb); if (u) await sb.from(TABLE).delete().eq('user_id', u.id).eq('game', game).eq('slot', slot); } catch (e) { /* ignore */ }
    },
    // the "In your account" panel on a dynasty landing page: lists cloud saves and loads one into its slot
    panel(el, game, localMeta, load) {
      if (!el) return;
      if (!CFG()) { el.innerHTML = ''; return; }
      if (!signedIn()) { el.innerHTML = `<p class="dim small">Saves live in this browser. <a href="${root.VI_ROUTER ? root.VI_ROUTER.href('me') : '/me'}">Sign in</a> to back them up to your account and pick them up on any device.</p>`; return; }
      el.innerHTML = '<p class="dim small">Checking your account for saves…</p>';
      root.VI_CLOUD.list(game).then(rows => {
        if (!rows.length) { el.innerHTML = '<p class="dim small">Signed in: your saves back up to your account automatically.</p>'; return; }
        const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
        el.innerHTML = `<h3>In your account</h3><div class="dy-cloud">${rows.map(r => {
          const m = r.meta || {}, loc = localMeta[r.slot], at = new Date(r.updated_at).getTime(), newer = !loc || (m.at || at) > (loc.at || 0) + 1000;
          return `<div class="dy-cloudrow"><div><b>Slot ${r.slot}</b> · Coach ${esc(m.coach)}${m.team && m.team !== 'Tennessee' ? ' · ' + esc(m.team) : ''} · ${esc(m.label)} · ${esc(m.rec)}<br><span class="dim small">Backed up ${new Date(r.updated_at).toLocaleString()}${newer ? '' : ' · same as this browser'}</span></div>${newer ? `<button class="btn" data-cload="${r.slot}">${loc ? 'Load (replaces this browser’s slot ' + r.slot + ')' : 'Load into slot ' + r.slot}</button>` : ''}</div>`;
        }).join('')}</div>`;
        el.onclick = e => {
          const b = e.target.closest('[data-cload]'); if (!b) return;
          b.disabled = true; b.textContent = 'Loading…';
          root.VI_CLOUD.pull(game, +b.dataset.cload).then(bytes => load(+b.dataset.cload, bytes)).catch(err => { b.textContent = 'Could not load: ' + err.message; });
        };
      }).catch(() => { el.innerHTML = ''; el.hidden = true; });     // no table yet, or offline: just the browser saves
    }
  };
  if (root.document) root.document.addEventListener('visibilitychange', () => { if (root.document.visibilityState === 'hidden' && Object.keys(pending).length) flush(); });
})(typeof window !== 'undefined' ? window : globalThis);
