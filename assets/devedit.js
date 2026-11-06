/* Owner-only editor: a passcode temporarily unlocks editing of any player's or recruit's ratings, position and bio (football and the other sports).
   It is a convenience lock, not security: saves live in the browser, so editing only changes the editor's own dynasty. */
(function (root) {
  'use strict';
  const D = root.DEVEDIT = {}, HASH = '670f92a72f891b481253183abf64216db141994d619bf0f83ddfcb96adb230f2', KEY = 'vi_dev_until', TTL = 60 * 60 * 1000;
  let mem = 0;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  D.on = () => { let u = mem; try { u = Math.max(u, +sessionStorage.getItem(KEY) || 0); } catch (e) { } return u > Date.now(); };
  const setUntil = t => { mem = t; try { if (t) sessionStorage.setItem(KEY, String(t)); else sessionStorage.removeItem(KEY); } catch (e) { } };
  D.lock = () => setUntil(0);
  const sha = async s => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); };
  D.unlock = async code => {
    if (!root.crypto || !crypto.subtle) return 'Unlocking needs a secure (https) page.';
    if ((await sha('vi:' + String(code || '').trim())) !== HASH) return 'That code is not right.';
    setUntil(Date.now() + TTL); return null;
  };
  // the box in Settings
  D.box = () => D.on()
    ? '<div class="gfield"><div class="glabel">Editor unlocked</div><p class="dim small">Open any player or recruit card and use Edit ratings. It re-locks after an hour or when you lock it.</p><div class="grow"><button class="btn" data-devlock="1">Lock editor</button></div></div>'
    : '<div class="gfield"><div class="glabel">Owner editor</div><p class="dim small">Enter the passcode to edit player and recruit ratings, positions and info for a while.</p><div class="grow"><input id="devCode" class="dy-in" type="password" autocomplete="off" placeholder="Passcode" style="max-width:180px"><button class="btn" data-devunlock="1">Unlock</button></div></div>';
  D.btn = id => D.on() ? '<p><button class="btn" data-devedit="' + id + '">Edit ratings &amp; info (owner)</button></p>' : '';
  const row = (k, l, v, x) => '<label class="dy-edrow"><span>' + esc(l) + '</span><input class="dy-in" data-dv="' + k + '" data-o="' + esc(v == null ? '' : v) + '" value="' + esc(v == null ? '' : v) + '" ' + (x || '') + '></label>';
  const sel = (k, l, opts, cur) => (opts = opts.some(o => String(Array.isArray(o) ? o[0] : o) === String(cur)) ? opts : [[cur, cur]].concat(opts), '<label class="dy-edrow"><span>' + esc(l) + '</span><select class="dy-in" data-dv="' + k + '" data-o="' + esc(cur) + '">' + opts.map(o => { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>');
  // cfg: { posList, yrs:[[v,label]], attrs:[[key,label]], ht(p)->str, grade(ceil), setOvr(p), fit(p,target), setPos(p,pos), after(p), extra(p)->html, applyExtra(p,get) }
  D.form = (p, cfg) => {
    const num = '<input type=number>';
    let h = '<h3>Edit ' + esc(p.n) + ' <small class="dim">(owner)</small></h3><p class="small dim">Changes apply immediately. Overall is calculated from the attributes below; type a new Overall to rescale them all.</p>';
    h += row('n', 'Name', p.n) + sel('pos', 'Position', cfg.posList, p.pos) + (cfg.yrs ? sel('yr', 'Class', cfg.yrs, p.yr) : '') + row('num', 'Number', p.num, 'inputmode="numeric"') + row('home', 'Hometown', p.home) + row('hs', 'High school / prior', p.hs || '') + row('ht', 'Height (ft-in)', cfg.ht(p)) + row('wt', 'Weight', p.wt, 'inputmode="numeric"');
    h += row('ovr', 'Overall', p.ovr, 'inputmode="numeric"') + row('ceil', 'Potential (ceiling)', p.ceil, 'inputmode="numeric"');
    if (p.rec) h += sel('stars', 'Recruit stars', [1, 2, 3, 4, 5].map(x => [x, x + '★']), p.rec.stars || 3) + row('rc', 'Composite (0.70–0.9999)', p.rec.c, 'inputmode="decimal"');
    if (cfg.extra) h += cfg.extra(p);
    h += '<div class="glabel" style="margin-top:8px">Attributes</div><div class="dy-edgrid">' + cfg.attrs(p).map(a => row('at:' + a[0], a[1], p.at[a[0]], 'inputmode="numeric" style="max-width:70px"')).join('') + '</div>';
    h += '<div class="grow"><button class="btn primary" data-devsave="' + p.id + '">Save</button><button class="btn" data-pid="' + p.id + '">Cancel</button></div>';
    return h;
  };
  D.apply = (p, cfg) => {
    const els = {}; document.querySelectorAll('[data-dv]').forEach(e => { els[e.dataset.dv] = e; });
    const get = k => els[k] ? els[k].value.trim() : null, changed = k => els[k] && els[k].value.trim() !== els[k].dataset.o;
    const n = get('n'); if (n && n.length >= 2) p.n = n.replace(/\s+/g, ' ');
    ['home', 'hs'].forEach(k => { const v = get(k); if (v) p[k] = v; });
    const num = parseInt(get('num'), 10); if (num >= 0 && num <= 99) p.num = num;
    const wt = parseInt(get('wt'), 10); if (wt >= 120 && wt <= 450) p.wt = wt;
    const hm = /^(\d)\s*[-' ]\s*(\d{1,2})/.exec(get('ht') || ''); const ht = hm ? +hm[1] * 12 + +hm[2] : null;
    if (get('yr') != null && changed('yr')) p.yr = +get('yr');
    const pos = get('pos'); if (pos && pos !== p.pos) cfg.setPos(p, pos, ht && changed('ht') ? ht : null); else if (ht && changed('ht')) p.ht = ht;
    cfg.attrs(p).forEach(a => { const v = parseInt(get('at:' + a[0]), 10); if (v >= 1 && v <= 99 && p.at[a[0]] !== v && changed('at:' + a[0])) p.at[a[0]] = v; });
    cfg.setOvr(p);
    if (changed('ovr')) { const v = parseInt(get('ovr'), 10); if (v >= 30 && v <= 99) cfg.fit(p, v); }
    const ceil = parseInt(get('ceil'), 10); if (ceil >= 30 && ceil <= 99) { p.ceil = Math.max(ceil, p.ovr); if (cfg.grade) p.potG = cfg.grade(p.ceil); } else if (p.ceil < p.ovr) p.ceil = p.ovr;
    if (p.rec && els.stars) { p.rec.stars = +get('stars'); const c = parseFloat(get('rc')); if (c > 0.6 && c <= 1) { p.rec.c = Math.round(c * 1e4) / 1e4; p.rec.g = p.rec.c * 100; } }
    if (cfg.applyExtra) cfg.applyExtra(p, get, changed);
    if (cfg.after) cfg.after(p);
    return p.n + ': saved (OVR ' + p.ovr + ', ceiling ' + p.ceil + ').';
  };
})(typeof window !== 'undefined' ? window : globalThis);
