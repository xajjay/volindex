/* The Vol Index — Hoops and Diamond Dynasty: saves. Three slots per sport in this browser (IndexedDB, gzip-compressed,
   localStorage fallback) and export/import as a file. */
(function (root) {
  'use strict';
  const SD = root.SD;
  const DBN = 'vi-sdyn', ST = 'saves';
  function db() { return new Promise((res, rej) => { if (!root.indexedDB) return rej(new Error('no idb')); const r = root.indexedDB.open(DBN, 1); r.onupgradeneeded = () => { r.result.createObjectStore(ST); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  const put = (k, v) => db().then(d => new Promise((res, rej) => { const tx = d.transaction(ST, 'readwrite'); tx.objectStore(ST).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }));
  const get = k => db().then(d => new Promise((res, rej) => { const tx = d.transaction(ST, 'readonly'); const q = tx.objectStore(ST).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
  const del = k => db().then(d => new Promise(res => { const tx = d.transaction(ST, 'readwrite'); tx.objectStore(ST).delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }));
  function gzip(txt) { if (!root.CompressionStream) return Promise.resolve(new root.TextEncoder().encode(txt)); const cs = new root.CompressionStream('gzip'), w = cs.writable.getWriter(); w.write(new root.TextEncoder().encode(txt)); w.close(); return new root.Response(cs.readable).arrayBuffer().then(b => new Uint8Array(b)); }
  function gunzip(bytes) { if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return Promise.resolve(new root.TextDecoder().decode(bytes)); const ds = new root.DecompressionStream('gzip'), w = ds.writable.getWriter(); w.write(bytes); w.close(); return new root.Response(ds.readable).text(); }
  const metaKey = sport => 'vi-sdyn-meta-' + sport;
  SD.readMeta = sport => { try { return JSON.parse(root.localStorage.getItem(metaKey(sport)) || '{}') || {}; } catch (e) { return {}; } };
  const writeMeta = (sport, m) => { try { root.localStorage.setItem(metaKey(sport), JSON.stringify(m)); } catch (e) { /* ignore */ } };
  SD.pack = g => JSON.stringify(g, (k, v) => (typeof v === 'number' && !Number.isInteger(v)) ? Math.round(v * 100) / 100 : v);
  SD.saveSlot = n => {
    const g = SD.G; if (!g) return Promise.resolve('Nothing to save.');
    g.rs = SD.rstate(); g.savedAt = Date.now(); g.slot = n;
    let cloudBytes = null;
    return gzip(SD.pack(g)).then(bytes => { cloudBytes = bytes; return bytes; }).then(bytes => put(g.sport + '-slot' + n, bytes).then(() => null).catch(() => {
      try { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); root.localStorage.setItem('vi-sdyn-' + g.sport + n, root.btoa(s)); return null; } catch (e) { return 'Your browser storage is full. Export your save to keep it.'; }
    })).then(err => {
      if (err) return err;
      const ut = SD.userT(), m = SD.readMeta(g.sport);
      m[n] = { team: ut.name, coach: g.coach.name, label: SD.phaseLabel(), rec: `${ut.w}-${ut.l}`, titles: g.hist.filter(h => h.finish === 'National champions').length, at: g.savedAt };
      writeMeta(g.sport, m);
      if (root.VI_CLOUD) root.VI_CLOUD.save(g.sport, n, cloudBytes, m[n]);       // a backup in the player's account when signed in
      return null;
    });
  };
  SD.loadSlot = (sport, n) => get(sport + '-slot' + n).catch(() => null).then(bytes => {
    if (!bytes) { const b64 = root.localStorage.getItem('vi-sdyn-' + sport + n); if (!b64) return null; const s = root.atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); bytes = a; }
    return gunzip(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).then(txt => SD.fromText(txt));
  });
  SD.fromText = txt => { const g = JSON.parse(txt); if (!g || g.v !== SD.VERSION || !g.teams) throw new Error('Not a save from this version.'); SD.G = g; SD.seed(g.rs || g.seed); return g; };
  SD.fromBytes = bytes => gunzip(bytes).then(SD.fromText);
  SD.deleteSlot = (sport, n) => { del(sport + '-slot' + n); try { root.localStorage.removeItem('vi-sdyn-' + sport + n); } catch (e) { /* ignore */ } const m = SD.readMeta(sport); delete m[n]; writeMeta(sport, m); };
  SD.exportBlob = () => { const g = SD.G; g.rs = SD.rstate(); return gzip(SD.pack(g)).then(b => new root.Blob([b], { type: 'application/gzip' })); };
  SD.importFile = f => f.arrayBuffer().then(b => gunzip(new Uint8Array(b))).then(SD.fromText);
})(typeof window !== 'undefined' ? window : globalThis);
