/* The Vol Index — Football Dynasty: saves. Three slots in this browser (IndexedDB, gzip-compressed, localStorage
   fallback), export/import as a file, and a game in progress is saved too so you can pick it back up. */
(function (root) {
  'use strict';
  const DY = root.DY;
  DY.SLOTS = 3;
  const DBN = 'vi-dynasty', ST = 'saves', META = 'vi-dynasty-meta';
  function db() {
    return new Promise((res, rej) => {
      if (!root.indexedDB) return rej(new Error('no idb'));
      const r = root.indexedDB.open(DBN, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(ST); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  const idbPut = (k, v) => db().then(d => new Promise((res, rej) => { const tx = d.transaction(ST, 'readwrite'); tx.objectStore(ST).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }));
  const idbGet = k => db().then(d => new Promise((res, rej) => { const tx = d.transaction(ST, 'readonly'); const q = tx.objectStore(ST).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
  const idbDel = k => db().then(d => new Promise((res) => { const tx = d.transaction(ST, 'readwrite'); tx.objectStore(ST).delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }));
  function gzip(txt) {
    if (!root.CompressionStream) return Promise.resolve(new root.TextEncoder().encode(txt));
    const cs = new root.CompressionStream('gzip'), w = cs.writable.getWriter(); w.write(new root.TextEncoder().encode(txt)); w.close();
    return new root.Response(cs.readable).arrayBuffer().then(b => new Uint8Array(b));
  }
  function gunzip(bytes) {
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return Promise.resolve(new root.TextDecoder().decode(bytes));
    const ds = new root.DecompressionStream('gzip'), w = ds.writable.getWriter(); w.write(bytes); w.close();
    return new root.Response(ds.readable).text();
  }
  DY.readMeta = () => { try { return JSON.parse(root.localStorage.getItem(META) || '{}') || {}; } catch (e) { return {}; } };
  function writeMeta(m) { try { root.localStorage.setItem(META, JSON.stringify(m)); } catch (e) { /* ignore */ } }

  /* a game in progress: swap object references for ids */
  DY.packLive = GM => {
    if (!GM || GM.over) return null;
    const L = {};
    for (const s of ['h', 'a']) { L[s] = {}; for (const k in GM.L[s]) { const v = GM.L[s][k]; L[s][k] = Array.isArray(v) ? v.map(p => p.id) : v ? v.id : null; } }
    const o = Object.assign({}, GM, { T: { h: GM.T.h.id, a: GM.T.a.id }, L, plays: GM.plays.slice(-180).map(p => ({ text: p.text, head: p.head, tag: p.tag, s: p.s, q: p.q, events: p.events, big: p.big, di: p.di, type: p.type, anim: p.anim ? { kind: p.anim.kind, los: p.anim.los, end: p.anim.end, inc: p.anim.inc, int: p.anim.int, wiped: p.anim.wiped } : null })), style: null, ovr: GM.ovr });
    o.styleKey = { h: GM.T.h.style, a: GM.T.a.style };
    return o;
  };
  DY.unpackLive = o => {
    if (!o) return null;
    const GM = Object.assign({}, o);
    GM.T = { h: DY.T(o.T.h), a: DY.T(o.T.a) };
    GM.L = {};
    for (const s of ['h', 'a']) { GM.L[s] = {}; for (const k in o.L[s]) { const v = o.L[s][k]; GM.L[s][k] = Array.isArray(v) ? v.map(DY.P).filter(Boolean) : v != null ? DY.P(v) : null; } }
    GM.style = { h: DY.STYLES[o.styleKey.h || 'spread'], a: DY.STYLES[o.styleKey.a || 'spread'] };
    return GM;
  };
  DY.pack = g => JSON.stringify(g, (k, v) => (typeof v === 'number' && !Number.isInteger(v)) ? Math.round(v * 100) / 100 : v);
  DY.saveSlot = (n, live) => {
    const g = DY.G; if (!g) return Promise.resolve('Nothing to save.');
    g.rs = DY.rstate(); g.live = live ? DY.packLive(live) : null; g.savedAt = Date.now(); g.slot = n;
    const txt = DY.pack(g); let cloudBytes = null;
    return gzip(txt).then(bytes => { cloudBytes = bytes; return bytes; }).then(bytes => idbPut('slot' + n, bytes).then(() => null).catch(() => {
      // fallback: localStorage (base64)
      try { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); root.localStorage.setItem('vi-dynasty-s' + n, root.btoa(s)); return null; } catch (e) { return 'Your browser storage is full. Export your save to keep it.'; }
    })).then(err => {
      if (err) return err;
      const ut = DY.userT(), m = DY.readMeta();
      m[n] = { team: ut.name, coach: g.coach.name, season: g.season, label: DY.weekLabel(), rec: ut.w + '-' + ut.l, natl: g.hist.filter(h => h.finish === 'National champions').length, at: Date.now(), kb: Math.round(txt.length / 1024) };
      writeMeta(m);
      if (root.VI_CLOUD) root.VI_CLOUD.save('football', n, cloudBytes, m[n]);      // a backup in the player's account when signed in
      return null;
    });
  };
  DY.loadSlot = n => {
    return idbGet('slot' + n).catch(() => null).then(bytes => {
      if (!bytes) { const b = root.localStorage.getItem('vi-dynasty-s' + n); if (!b) return null; const bin = root.atob(b); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); }
      return gunzip(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    }).then(txt => txt ? DY.fromText(txt) : null).then(g => DY.histReady ? DY.histReady(g) : g);
  };
  // one-time repairs for saves made before a fix (g.fx remembers which have run)
  DY.migrate = g => {
    g.fx = g.fx || {};
    if (!g.fx.potG) {   // potential grades were all A+ (a name clash in the engine); re-scout everyone
      Object.values(g.P || {}).forEach(p => { if (p && p.ceil) p.potG = DY.scoutGrade(p.ceil); });
      if (g.recruit && g.recruit.pool) Object.values(g.recruit.pool).forEach(p => { if (p && p.ceil) p.potG = DY.scoutGrade(p.ceil); });
      g.fx.potG = 1;
    }
  };
  DY.fromText = txt => {
    const g = JSON.parse(txt);
    if (!g || g.v !== DY.VERSION || !g.teams) throw new Error('Not a dynasty save from this version.');
    DY.G = g; DY.seed(g.rs || g.seed);
    if (DY.seedPast) DY.seedPast(g);
    DY.migrate(g);
    return g;
  };
  DY.fromBytes = bytes => gunzip(bytes).then(DY.fromText).then(g => DY.histReady ? DY.histReady(g) : g);
  DY.deleteSlot = n => { idbDel('slot' + n); try { root.localStorage.removeItem('vi-dynasty-s' + n); } catch (e) { /* */ } const m = DY.readMeta(); delete m[n]; writeMeta(m); };
  DY.exportBlob = live => { const g = DY.G; g.rs = DY.rstate(); g.live = live ? DY.packLive(live) : null; return gzip(DY.pack(g)).then(b => new root.Blob([b], { type: 'application/gzip' })); };
  DY.importFile = file => file.arrayBuffer().then(b => gunzip(new Uint8Array(b))).then(DY.fromText).then(g => DY.histReady ? DY.histReady(g) : g);
})(typeof window !== 'undefined' ? window : globalThis);
