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
  // plain-JS inflate, for older phone browsers that have no DecompressionStream (older iPhones, some in-app browsers)
  function inflateRaw(src, pos) {
    let out = new Uint8Array(src.length * 6), op = 0, bb = 0, bc = 0;
    const need = n => { if (op + n > out.length) { const o = new Uint8Array(Math.max(out.length * 2, op + n)); o.set(out); out = o; } };
    const bits = n => { while (bc < n) { bb |= src[pos++] << bc; bc += 8; } const v = bb & ((1 << n) - 1); bb >>>= n; bc -= n; return v; };
    const build = lens => { const cnt = new Uint16Array(16), offs = new Uint16Array(16), sym = new Uint16Array(lens.length); lens.forEach(l => cnt[l]++); cnt[0] = 0; for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + cnt[i - 1]; lens.forEach((l, i) => { if (l) sym[offs[l]++] = i; }); return { cnt, sym }; };
    const dec = h => { let code = 0, first = 0, idx = 0; for (let l = 1; l < 16; l++) { code |= bits(1); const c = h.cnt[l]; if (code - c < first) return h.sym[idx + (code - first)]; idx += c; first += c; first <<= 1; code <<= 1; } throw new Error('bad data'); };
    const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258], LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577], DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    const fl = new Array(288).fill(8, 0, 144).fill(9, 144, 256).fill(7, 256, 280).fill(8, 280), FIXL = build(fl), FIXD = build(new Array(30).fill(5));
    const block = (lc, dc) => { for (;;) { const s = dec(lc); if (s < 256) { need(1); out[op++] = s; } else if (s === 256) return; else { const i = s - 257, len = LB[i] + bits(LE[i]), d = dec(dc), dist = DB[d] + bits(DE[d]); need(len); for (let k = 0; k < len; k++, op++) out[op] = out[op - dist]; } } };
    let last;
    do {
      last = bits(1); const t = bits(2);
      if (t === 0) { bb = 0; bc = 0; const len = src[pos] | (src[pos + 1] << 8); pos += 4; need(len); out.set(src.subarray(pos, pos + len), op); op += len; pos += len; }
      else if (t === 1) block(FIXL, FIXD);
      else if (t === 2) { const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, ORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], cl = new Array(19).fill(0); for (let i = 0; i < nc; i++) cl[ORD[i]] = bits(3);
        const ch = build(cl), ls = []; while (ls.length < nl + nd) { const s = dec(ch); if (s < 16) ls.push(s); else { let r, v = 0; if (s === 16) { v = ls[ls.length - 1]; r = 3 + bits(2); } else if (s === 17) r = 3 + bits(3); else r = 11 + bits(7); while (r--) ls.push(v); } }
        block(build(ls.slice(0, nl)), build(ls.slice(nl))); }
      else throw new Error('bad data');
    } while (!last);
    return out.subarray(0, op);
  }
  function gunzip(bytes) {
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return Promise.resolve(new root.TextDecoder().decode(bytes));
    if (!root.DecompressionStream) return new Promise(res => { let p = 10; const fl = bytes[3]; if (fl & 4) p += 2 + (bytes[p] | (bytes[p + 1] << 8)); if (fl & 8) while (bytes[p++]); if (fl & 16) while (bytes[p++]); if (fl & 2) p += 2; setTimeout(() => res(new root.TextDecoder().decode(inflateRaw(bytes, p))), 0); });
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
  DY.migrate2 = g => {
    g.fx = g.fx || {};
    if (!g.fx.tr2) {   // personalities were too low (work ethic in the 60s): stretch every player to 65-99 around a low-80s average (ego is left alone)
      const f = tr => { if (!tr) return; for (const k in tr) if (k !== 'ego') tr[k] = Math.max(65, Math.min(99, Math.round(82 + (tr[k] - 70) * 0.9))); };
      Object.values(g.P || {}).forEach(p => p && f(p.tr)); if (g.recruit && g.recruit.pool) Object.values(g.recruit.pool).forEach(p => p && f(p.tr));
      g.fx.tr2 = 1;
    }
    if (!g.fx.rtn1) {   // return ratings are new: give every returner-type player one (from speed, agility and elusiveness, plus a spread so real specialists exist)
      const f = p => { if (p && p.at && DY.RTN_POS.includes(p.pos) && p.at.rtn == null) p.at.rtn = DY.rtnCalc(p.at, p.ovr, DY.gauss() * 6.5); };
      Object.values(g.P || {}).forEach(f); if (g.recruit && g.recruit.pool) Object.values(g.recruit.pool).forEach(f);
      g.fx.rtn1 = 1;
    }
    if (!g.fx.roster1 && DY.ensureRoster) {   // CPU rosters with no kicker/punter, 1 corner, 10 running backs: rebalance every team once
      g.teams.forEach(t => { if (t.fbs !== false) DY.ensureRoster(t, t.user ? { minOnly: true } : { trim: true }); });
      g.fx.roster1 = 1;
    }
  };
  DY.fromText = txt => {
    const g = JSON.parse(txt);
    if (g && g.sport) throw new Error('That is a ' + ({ mbb: "men's basketball", wbb: "women's basketball", baseball: 'baseball', softball: 'softball' }[g.sport] || g.sport) + ' dynasty save. Import it on that sport\'s dynasty page.');
    if (!g || g.v !== DY.VERSION || !g.teams) throw new Error('Not a dynasty save from this version.');
    DY.G = g; DY.seed(g.rs || g.seed);
    if (DY.seedPast) DY.seedPast(g);
    DY.migrate(g); DY.migrate2(g);
    return g;
  };
  DY.fromBytes = bytes => gunzip(bytes).then(DY.fromText).then(g => DY.histReady ? DY.histReady(g) : g);
  DY.deleteSlot = n => { idbDel('slot' + n); try { root.localStorage.removeItem('vi-dynasty-s' + n); } catch (e) { /* */ } const m = DY.readMeta(); delete m[n]; writeMeta(m); };
  DY.exportBlob = live => { const g = DY.G; g.rs = DY.rstate(); g.live = live ? DY.packLive(live) : null; return gzip(DY.pack(g)).then(b => new root.Blob([b], { type: 'application/gzip' })); };
  DY.importFile = file => file.arrayBuffer().then(b => gunzip(new Uint8Array(b))).then(DY.fromText).then(g => DY.histReady ? DY.histReady(g) : g);
})(typeof window !== 'undefined' ? window : globalThis);
