/* The Vol Index — CourtViz: three ways to watch a basketball game.
     'shotmap' = a half court with every shot, the shooter's name and the ball's flight on the latest one, zone shooting.
     'court'   = the full court, ten players and a ball acting out each play (shot, miss, rebound, turnover, free throws).
     'flow'    = the game flow chart (lead over time with scoring runs shaded), who is hot, and a small shot map.
   ESPN gives play text and, for shots, a spot on the floor. It does not track players, so the full-court view is a reconstruction:
   the shooter is exactly where ESPN says, the other nine bodies are stand-ins.
   Events: { id, per, clk, sec, team:'h'|'a', type:'shot'|'rebound'|'turnover'|'foul'|'ft'|'other', text, name, assist, steal, made, three, pts, coord:{x:0-50 across,y:0-94 along}, hs, as } */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const SUF = /^(II|III|IV|Jr\.?|Sr\.?)$/;
  const shortName = n => { const p = String(n || '').split(' ').filter(x => !SUF.test(x)); return p.length < 2 ? (n || '') : p[0][0] + '. ' + p[p.length - 1]; };
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function track(kfs) { // smooth path through {t,x,y,stop}
    kfs = kfs.slice().sort((a, b) => a.t - b.t).reduce((o, k) => { if (o.length && k.t - o[o.length - 1].t < 0.1) o[o.length - 1] = k; else o.push(k); return o; }, []); const n = kfs.length;
    const tan = kfs.map((k, i) => { if (!i || i === n - 1 || k.stop) return { x: 0, y: 0 }; const p = kfs[i - 1], q = kfs[i + 1], dt = (q.t - p.t) || 1; return { x: (q.x - p.x) / dt, y: (q.y - p.y) / dt }; });
    return t => { if (t <= kfs[0].t) return { x: kfs[0].x, y: kfs[0].y }; if (t >= kfs[n - 1].t) return { x: kfs[n - 1].x, y: kfs[n - 1].y };
      let i = 0; while (kfs[i + 1].t < t) i++; const a = kfs[i], b = kfs[i + 1], h = (b.t - a.t) || 1e-6, u = (t - a.t) / h, u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      return { x: h00 * a.x + h10 * h * tan[i].x + h01 * b.x + h11 * h * tan[i + 1].x, y: h00 * a.y + h10 * h * tan[i].y + h01 * b.y + h11 * h * tan[i + 1].y }; };
  }
  const WOOD = '#D9A56B', PAINT = '#B5471D', LINE = '#fff';

  /* ---------- court drawings (10 units per foot) ---------- */
  function halfCourt(svg, W = 500, H = 470) {
    el('rect', { x: -10, y: -10, width: W + 20, height: H + 20, fill: '#C98F55', rx: 14 }, svg); const g = el('g', {}, svg);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: WOOD, stroke: LINE, 'stroke-width': 4 }, g);
    el('rect', { x: 170, y: 0, width: 160, height: 190, fill: PAINT, opacity: 0.45, stroke: LINE, 'stroke-width': 3 }, g);
    el('path', { d: 'M190 190A60 60 0 0 0 310 190', fill: 'none', stroke: LINE, 'stroke-width': 3 }, g); el('path', { d: 'M190 190A60 60 0 0 1 310 190', fill: 'none', stroke: LINE, 'stroke-width': 3, 'stroke-dasharray': '8 8' }, g);
    el('path', { d: 'M30 0V141.9A237.5 237.5 0 0 0 470 141.9V0', fill: 'none', stroke: LINE, 'stroke-width': 3 }, g); el('path', { d: 'M210 52.5A40 40 0 0 0 290 52.5', fill: 'none', stroke: LINE, 'stroke-width': 3 }, g);
    el('line', { x1: 220, x2: 280, y1: 40, y2: 40, stroke: LINE, 'stroke-width': 5 }, g); el('circle', { cx: 250, cy: 52.5, r: 9, fill: 'none', stroke: '#FF5A1F', 'stroke-width': 4 }, g);
    return g;
  }
  function fullCourt(svg) {
    el('rect', { x: -12, y: -12, width: 964, height: 524, fill: '#C98F55', rx: 16 }, svg); const g = el('g', {}, svg);
    el('rect', { x: 0, y: 0, width: 940, height: 500, fill: WOOD, stroke: LINE, 'stroke-width': 4 }, g); el('line', { x1: 470, x2: 470, y1: 0, y2: 500, stroke: LINE, 'stroke-width': 3 }, g); el('circle', { cx: 470, cy: 250, r: 60, fill: 'none', stroke: LINE, 'stroke-width': 3 }, g);
    const side = (tf) => { const s = el('g', { transform: tf }, g);
      el('rect', { x: 0, y: 170, width: 190, height: 160, fill: PAINT, opacity: 0.45, stroke: LINE, 'stroke-width': 3 }, s); el('path', { d: 'M190 190A60 60 0 0 1 190 310', fill: 'none', stroke: LINE, 'stroke-width': 3 }, s); el('path', { d: 'M190 190A60 60 0 0 0 190 310', fill: 'none', stroke: LINE, 'stroke-width': 3, 'stroke-dasharray': '8 8' }, s);
      el('path', { d: 'M0 30H141.9A237.5 237.5 0 0 1 141.9 470H0', fill: 'none', stroke: LINE, 'stroke-width': 3 }, s); el('path', { d: 'M52.5 210A40 40 0 0 1 52.5 290', fill: 'none', stroke: LINE, 'stroke-width': 3 }, s);
      el('line', { x1: 40, x2: 40, y1: 220, y2: 280, stroke: LINE, 'stroke-width': 5 }, s); el('circle', { cx: 52.5, cy: 250, r: 9, fill: 'none', stroke: '#FF5A1F', 'stroke-width': 4 }, s); };
    side(''); side('translate(940 0) scale(-1 1)'); return g;
  }
  const fold = c => { let x = +c.x, y = +c.y; if (y > 47) { y = 94 - y; x = 50 - x; } return { x: clamp(x, 0, 50), y: clamp(y, 0, 47) }; };
  const zoneOf = (e, f) => e.three ? 'three' : (Math.abs(f.x - 25) <= 8 && f.y <= 19) || Math.hypot(f.x - 25, f.y - 5.25) <= 6 ? 'paint' : 'mid';
  const sumShots = (evs, team) => { const z = { paint: [0, 0], mid: [0, 0], three: [0, 0] }; evs.forEach(e => { if (e.type !== 'shot' || e.team !== team || !e.coord) return; const f = fold(e.coord), k = zoneOf(e, f); z[k][1]++; if (e.made) z[k][0]++; }); return z; };

  /* ---------- A: shot map ---------- */
  function shotmap(host, o) {
    const svg = el('svg', { viewBox: '-10 -10 520 490', class: 'cv-svg', role: 'img', 'aria-label': 'Shot chart' }, host); halfCourt(svg);
    const shots = el('g', {}, svg), fx = el('g', {}, svg), ball = el('ellipse', { rx: 11, ry: 8, fill: '#C25A12', stroke: '#fff', 'stroke-width': 2.5, opacity: 0 }, fx), pill = el('g', { opacity: 0 }, fx), pbg = el('rect', { rx: 9, fill: '#111', opacity: 0.88 }, pill), ptx = el('text', { class: 'cv-lab', fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, pill);
    const info = document.createElement('div'); info.className = 'cv-info'; host.appendChild(info);
    let seen = new Set(), anim = null, first = true, evs = [];
    const col = t => t === 'h' ? o.home.color : o.away.color, X = v => v * 10;
    function draw() {
      shots.innerHTML = '';
      evs.forEach(e => { if (e.type !== 'shot' || !e.coord) return; const f = fold(e.coord), x = X(f.x), y = X(f.y), c = col(e.team);
        if (e.made) el('circle', { cx: x, cy: y, r: 9, fill: c, stroke: '#fff', 'stroke-width': 2.4 }, shots); else el('path', { d: `M${x - 6} ${y - 6}l12 12M${x + 6} ${y - 6}l-12 12`, stroke: c, 'stroke-width': 3.4, opacity: 0.85, fill: 'none' }, shots); });
      const me = o.us === 'a' ? 'a' : 'h', th = me === 'h' ? 'a' : 'h', a = sumShots(evs, me), b = sumShots(evs, th), fm = v => `${v[0]}-${v[1]}`, chip = (l, v) => `<span><i>${l}</i><b>${fm(v)}</b></span>`;
      const hot = (() => { const by = {}; evs.filter(e => e.type === 'shot' && e.team === me && e.name).forEach(e => (by[e.name] = by[e.name] || []).push(e.made)); let best = null; Object.keys(by).forEach(n => { const l = by[n].slice(-4); if (l.length >= 3) { const m = l.filter(Boolean).length; if (m >= 3 && (!best || m > best.m)) best = { n, m, k: l.length }; } }); return best; })();
      info.innerHTML = `<div class="cv-legend"><span><i class="cv-d" style="background:${col(me)}"></i>${esc(o.names[me])} made</span><span><i class="cv-x" style="color:${col(me)}">✕</i>missed</span><span><i class="cv-d" style="background:${col(th)}"></i>${esc(o.names[th])}</span></div>
        <div class="cv-zones"><b>${esc(o.names[me])}</b>${chip('Paint', a.paint)}${chip('Mid', a.mid)}${chip('3-pt', a.three)}</div><div class="cv-zones"><b>${esc(o.names[th])}</b>${chip('Paint', b.paint)}${chip('Mid', b.mid)}${chip('3-pt', b.three)}</div>${hot ? `<div class="cv-hot"><b>Hot hand</b> ${esc(hot.n)} has hit ${hot.m} of his last ${hot.k}</div>` : ''}`;
    }
    function fly(e) {
      const f = fold(e.coord), a = { x: X(f.x), y: X(f.y) }, rim = { x: 250, y: 52.5 }, t0 = performance.now(), dur = 900, nm = e.name ? shortName(e.name) : '', fs = 13 * (500 / (host.clientWidth || 500)) * 1.0;
      ptx.textContent = (nm ? nm + ' · ' : '') + (e.made ? (e.three ? 'three' : 'bucket') : 'miss'); ptx.style.fontSize = fs + 'px'; const w = ptx.textContent.length * fs * 0.6 + fs * 1.2; pbg.setAttribute('width', w); pbg.setAttribute('height', fs * 1.9); pbg.setAttribute('x', -w / 2); pbg.setAttribute('y', -fs * 0.95);
      pill.setAttribute('transform', `translate(${clamp(a.x, w / 2 + 6, 500 - w / 2 - 6)} ${clamp(a.y + 30, 24, 460)})`); pill.setAttribute('opacity', 1);
      anim = { t0, dur, a, rim, e };
    }
    function frame(now) { if (anim) { const u = clamp((now - anim.t0) / anim.dur, 0, 1), x = lerp(anim.a.x, anim.rim.x, u), y = lerp(anim.a.y, anim.rim.y, u) - Math.sin(u * Math.PI) * 90, s = 1 + Math.sin(u * Math.PI) * 0.5; ball.setAttribute('opacity', u < 1 ? 1 : 0); ball.setAttribute('transform', `translate(${x} ${y}) scale(${s})`);
        if (u >= 1) { if (anim.e.made) { const r = el('circle', { cx: 250, cy: 52.5, r: 10, fill: 'none', stroke: '#fff', 'stroke-width': 5 }, fx); r.innerHTML = '<animate attributeName="r" from="10" to="55" dur=".7s" fill="freeze"/><animate attributeName="opacity" from="1" to="0" dur=".7s" fill="freeze"/>'; setTimeout(() => r.remove(), 800); } setTimeout(() => pill.setAttribute('opacity', 0), 2600); anim = null; } }
      if (!o.dead) requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
    return { update(list) { evs = list; draw(); list.forEach(e => { if (seen.has(e.id)) return; seen.add(e.id); if (!first && e.type === 'shot' && e.coord) fly(e); }); first = false; }, stop() { o.dead = true; } };
  }

  /* ---------- B: full court acted out ---------- */
  const HOOP = [{ x: 52.5, y: 250 }, { x: 887.5, y: 250 }];
  function court(host, o) {
    const V = !!o.vertical, svg = el('svg', { viewBox: V ? '-12 -12 524 964' : '-12 -12 964 524', class: 'cv-svg', role: 'img', 'aria-label': 'Basketball court' }, host), rg = el('g', { transform: V ? 'translate(500 0) rotate(90)' : '' }, svg); fullCourt(rg);
    const g = el('g', {}, rg), pls = { h: [], a: [] }, W = 940;
    const ballG = el('g', { opacity: 1 }, g), shadow = el('ellipse', { rx: 11, ry: 6.5, fill: '#000', opacity: 0.3 }, ballG), ballE = el('circle', { r: 14, fill: '#E8590C', stroke: '#111', 'stroke-width': 3 }, ballG), seam = el('path', { d: 'M-14 0h28M0 -14v28', stroke: '#111', 'stroke-width': 1.8, fill: 'none' }, ballG);
    for (const t of ['h', 'a']) for (let i = 0; i < 5; i++) { const gg = el('g', {}, g), c = el('circle', { r: 16, fill: t === 'h' ? o.home.color : o.away.color, stroke: '#fff', 'stroke-width': 2.5 }, gg), lab = el('g', { opacity: 0 }, gg), bg = el('rect', { rx: 9, fill: '#111', opacity: 0.88 }, lab), tx = el('text', { class: 'cv-lab', fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, lab); pls[t].push({ gg, c, lab, bg, tx, x: 470, y: 250, name: '', last: 0 }); }
    const pop = el('g', { opacity: 0 }, g), ptx = el('text', { class: 'cv-pop', 'text-anchor': 'middle' }, pop);
    const slotOf = { h: {}, a: {} }; let clock = 0;
    const assign = (t, name) => { if (!name) return null; const m = slotOf[t]; if (m[name] != null) { pls[t][m[name]].last = clock; return m[name]; } let used = Object.values(m), free = [0, 1, 2, 3, 4].filter(i => !used.includes(i)), idx = free.length ? free[0] : (() => { let b = 0; pls[t].forEach((p, i) => { if (p.last < pls[t][b].last) b = i; }); for (const k in m) if (m[k] === b) delete m[k]; return b; })(); m[name] = idx; pls[t][idx].name = name; pls[t][idx].last = clock; return idx; };
    const dirOf = { h: null, a: null }; // which hoop (0 left,1 right) each team attacks
    const hoopFor = e => { if (e.coord && e.type === 'shot') { const h = e.coord.y > 47 ? 1 : 0; dirOf[e.team] = h; dirOf[e.team === 'h' ? 'a' : 'h'] = 1 - h; return h; } if (dirOf[e.team] != null) return dirOf[e.team]; const h = e.team === 'h' ? 0 : 1; return h; };
    // ball state: held by (t,i) or free at a point
    const B = { x: 470, y: 250, h: 0, hold: null };
    const q = []; let cur = null, t0 = null, speed = o.speed || 1, last = performance.now(), seen = new Set(), first = true;
    const spots = hp => { const s = hp === 0 ? 1 : -1, x = k => (hp === 0 ? HOOP[0].x : HOOP[1].x) + s * k; return [{ x: x(300), y: 250 }, { x: x(200), y: 80 }, { x: x(200), y: 420 }, { x: x(60), y: 40 }, { x: x(60), y: 460 }, { x: x(110), y: 190 }, { x: x(110), y: 310 }]; };
    function build(e) {
      clock++; const R = rng(hash(e.id)), hp = hoopFor(e), off = e.team, def = off === 'h' ? 'a' : 'h', sp = spots(hp), s = hp === 0 ? 1 : -1;
      const nm = e.name, mi = assign(off, nm), ai = e.assist ? assign(off, e.assist) : null, si = e.steal ? assign(def, e.steal) : null;
      const cur5 = t => pls[t].map(p => ({ x: p.x, y: p.y }));
      const K = { h: pls.h.map(p => [{ t: 0, x: p.x, y: p.y, stop: true }]), a: pls.a.map(p => [{ t: 0, x: p.x, y: p.y, stop: true }]) };
      const k = (t, i, tt, x, y, st) => K[t][i].push({ t: tt, x, y, stop: st });
      let maxd = 0; const go = (t, i, x, y, tt) => { const p = pls[t][i]; maxd = Math.max(maxd, Math.hypot(x - p.x, y - p.y) / 10); k(t, i, tt, x, y, true); return [x, y]; };
      const ph = { ball: [] };
      let dur = 2.4;
      // targets for the offense: the shooter goes to his spot, the rest fill the other spots
      const shotPt = e.type === 'shot' && e.coord ? { x: (hp === 1 ? e.coord.y : (e.coord.y > 47 ? 94 - e.coord.y : e.coord.y)) * 10, y: (hp === 1 ? e.coord.x : (e.coord.y > 47 ? 50 - e.coord.x : e.coord.x)) * 10 } : null;
      if (shotPt) { shotPt.x = clamp(e.coord.y * 10, 20, 920); shotPt.y = clamp(e.coord.x * 10, 12, 488); }
      const place = (extra) => { const taken = []; const mine = []; const order = [0, 1, 2, 3, 4].filter(i => i !== mi); const pts = sp.slice().sort(() => R() - 0.5);
        order.forEach((i, j) => { const pt = pts[j % pts.length], jx = pt.x + (R() - 0.5) * 30, jy = clamp(pt.y + (R() - 0.5) * 30, 25, 475); mine.push([i, jx, jy]); }); return mine; };
      // pre-compute the time to get everyone there
      const offPos = place(), tgtOff = {}; offPos.forEach(([i, x, y]) => { tgtOff[i] = { x, y }; });
      if (mi != null) tgtOff[mi] = shotPt || (e.type === 'ft' ? { x: HOOP[hp].x + s * 190, y: 250 } : { x: sp[0].x, y: sp[0].y });
      for (let i = 0; i < 5; i++) if (!tgtOff[i]) tgtOff[i] = { x: sp[i % sp.length].x, y: sp[i % sp.length].y };
      if (e.type === 'turnover' || e.type === 'rebound' || e.type === 'foul') { /* handled below */ }
      let tMove = 0;
      const dist = (t, i) => Math.hypot(tgtOff[i].x - pls[t][i].x, tgtOff[i].y - pls[t][i].y);
      if (e.type === 'shot' || e.type === 'ft') {
        for (let i = 0; i < 5; i++) tMove = Math.max(tMove, dist(off, i) / 10 / 15);
        tMove = clamp(tMove, 0.9, 3.4); const tHand = tMove + 0.35, tShot = tHand + 0.45, fl = 0.85 + (shotPt ? Math.hypot(shotPt.x - HOOP[hp].x, shotPt.y - HOOP[hp].y) / 600 : 0.2), tEnd = tShot + fl;
        for (let i = 0; i < 5; i++) { k(off, i, tMove, tgtOff[i].x, tgtOff[i].y, true); if (i === mi) { k(off, i, tShot, tgtOff[i].x + s * 4, tgtOff[i].y, true); k(off, i, tEnd + 0.9, tgtOff[i].x + s * 4, tgtOff[i].y, true); } else if (e.type === 'shot') { k(off, i, tEnd, tgtOff[i].x + (HOOP[hp].x - tgtOff[i].x) * 0.1, tgtOff[i].y + (250 - tgtOff[i].y) * 0.1); } }
        // defenders pick up their man, a step toward the hoop
        for (let i = 0; i < 5; i++) { const t = tgtOff[i], dx = HOOP[hp].x - t.x, dy = 250 - t.y, L = Math.hypot(dx, dy) || 1, off2 = i === mi ? 24 : 30; go(def, i, t.x + dx / L * off2, t.y + dy / L * off2 + (i === mi ? 6 : 0), tMove); k(def, i, tEnd, t.x + dx / L * off2 * 0.7, t.y + dy / L * off2 * 0.7, true); }
        // ball: carried by a handler, passed to the shooter, then flies
        const hI = (() => { let b = ai != null ? ai : (mi + 1 + Math.floor(R() * 4)) % 5; return b === mi ? (mi + 1) % 5 : b; })();
        const start = B.hold ? B.hold : null;
        const at = (t, i, tt) => { const p = track(K[t][i])(tt); return { x: p.x, y: p.y }; };
        const rim = { x: HOOP[hp].x, y: HOOP[hp].y }, made = e.made, rebound = { x: rim.x + s * (60 + R() * 100), y: clamp(250 + (R() - 0.5) * 240, 40, 460) };
        ph.ball = [{ t0: 0, t1: tHand - 0.05, kind: 'carry', from: start, t: off, i: hI, free: B.hold ? null : { x: B.x, y: B.y } }, { t0: tHand - 0.05, t1: tShot, kind: 'pass', t: off, i1: hI, i2: mi == null ? hI : mi, h: 0.5 }];
        if (e.type === 'ft') ph.ball.push({ t0: tShot, t1: tEnd, kind: 'fly', t: off, i1: mi, to: rim, h: 9 });
        else ph.ball.push({ t0: tShot, t1: tEnd, kind: 'fly', t: off, i1: mi, to: rim, h: 11 + (e.three ? 3 : 0) });
        if (made) ph.ball.push({ t0: tEnd, t1: tEnd + 0.7, kind: 'drop', at: rim }), ph.end = { free: { x: rim.x, y: rim.y } }; else { ph.ball.push({ t0: tEnd, t1: tEnd + 0.9, kind: 'bounce', from: rim, to: rebound }); ph.end = { free: rebound }; }
        dur = tEnd + 1.0; ph.result = { t: tEnd, made, pts: e.pts || (e.three ? 3 : e.type === 'ft' ? 1 : 2), name: nm, rim, off };
        ph.ballOwner = (tt) => null; ph.hI = hI; ph.mi = mi;
      } else if (e.type === 'rebound') {
        const at0 = B.free || { x: B.x, y: B.y }, rr = mi, tgt = { x: at0.x, y: at0.y }; const teamHoop = hoopFor({ team: off, type: 'x' }); const sx = teamHoop === 0 ? 1 : -1;
        for (let i = 0; i < 5; i++) { const t = i === rr ? tgt : { x: lerp(pls[off][i].x, HOOP[teamHoop].x + sx * 260, 0.5) + (R() - 0.5) * 60, y: clamp(pls[off][i].y + (R() - 0.5) * 140, 30, 470) }; tgtOff[i] = t; tMove = Math.max(tMove, Math.hypot(t.x - pls[off][i].x, t.y - pls[off][i].y) / 10 / 15); }
        tMove = clamp(tMove, 0.8, 2.6); for (let i = 0; i < 5; i++) k(off, i, tMove, tgtOff[i].x, tgtOff[i].y, true);
        // the other team boxes out then drifts away
        for (let i = 0; i < 5; i++) { const p = pls[def][i]; k(def, i, tMove, lerp(p.x, tgt.x, 0.3) + (R() - 0.5) * 80, clamp(lerp(p.y, tgt.y, 0.3) + (R() - 0.5) * 80, 30, 470), true); }
        ph.ball = [{ t0: 0, t1: 0.35, kind: 'free', at: at0 }, { t0: 0.35, t1: tMove, kind: 'carryto', t: off, i: rr }]; dur = tMove + 0.7; ph.pop = { text: 'Rebound', name: nm, at: tgt, t: tMove };
        ph.holdEnd = { t: off, i: rr }; ph.end = { hold: { t: off, i: rr } };
      } else if (e.type === 'turnover') {
        const target = hoopFor({ team: def, type: 'x' }) === 0 ? 0 : 1, mid = { x: 470, y: 250 };
        for (let i = 0; i < 5; i++) { const p = pls[off][i]; tgtOff[i] = { x: lerp(p.x, 470, 0.3) + (R() - 0.5) * 80, y: clamp(p.y + (R() - 0.5) * 120, 30, 470) }; tMove = Math.max(tMove, Math.hypot(tgtOff[i].x - p.x, tgtOff[i].y - p.y) / 10 / 12); k(off, i, 1.6, tgtOff[i].x, tgtOff[i].y, true); }
        for (let i = 0; i < 5; i++) { const p = pls[def][i]; k(def, i, 1.6, lerp(p.x, 470, 0.25) + (R() - 0.5) * 100, clamp(p.y + (R() - 0.5) * 100, 30, 470), true); }
        const th = si != null ? si : Math.floor(R() * 5); dur = 2.1;
        ph.ball = [{ t0: 0, t1: 0.9, kind: 'carry', from: B.hold, t: off, i: mi != null ? mi : 0, free: B.hold ? null : { x: B.x, y: B.y } }, { t0: 0.9, t1: 1.5, kind: 'pass', t: off, i1: mi != null ? mi : 0, i2b: { t: def, i: th }, h: 0.3 }];
        ph.pop = { text: e.steal ? 'Steal' : 'Turnover', name: e.steal || nm, at: { x: pls[off][mi != null ? mi : 0].x, y: pls[off][mi != null ? mi : 0].y }, t: 0.9 }; ph.end = { hold: { t: def, i: th } }; ph.stealTo = { t: def, i: th };
      } else { // foul and everything else: players settle where they are
        for (let i = 0; i < 5; i++) { k(off, i, 1.2, pls[off][i].x + (R() - 0.5) * 30, pls[off][i].y + (R() - 0.5) * 30, true); k(def, i, 1.2, pls[def][i].x + (R() - 0.5) * 30, pls[def][i].y + (R() - 0.5) * 30, true); }
        dur = 1.6; ph.ball = [{ t0: 0, t1: 99, kind: 'keep' }]; if (e.type === 'foul') ph.pop = { text: 'Foul', name: nm, at: { x: pls[off][mi != null ? mi : 0].x, y: pls[off][mi != null ? mi : 0].y }, t: 0.1 };
      }
      const paths = { h: K.h.map(track), a: K.a.map(track) };
      // roles
      const roles = {}; if (mi != null) roles[off + mi] = nm; if (ai != null) roles[off + ai] = e.assist; if (si != null) roles[def + si] = e.steal; if (e.type === 'rebound' && mi != null) roles[off + mi] = nm;
      return { dur, paths, ph, roles, e, off, def, hp, s };
    }
    function ballAt(tl, t) {
      const P = tl.paths, f = (tm, i, tt) => P[tm][i](tt), ph = tl.ph.ball; const p = ph.find(x => t >= x.t0 && t < x.t1) || ph[ph.length - 1];
      const hold = (tm, i, dx = 0) => { const q = f(tm, i, t); return { x: q.x + 10, y: q.y + 8, h: 0 }; };
      if (!p) return { x: B.x, y: B.y, h: 0 };
      if (p.kind === 'carry') { if (p.free) { const hI = p.i, q = f(p.t, hI, 0); const u = clamp((t - p.t0) / Math.max(0.3, p.t1 - p.t0), 0, 1), tgt = f(p.t, hI, t); return { x: lerp(p.free.x, tgt.x + 10, u), y: lerp(p.free.y, tgt.y + 8, u), h: 0 }; } return hold(p.t, p.i); }
      if (p.kind === 'carryto') { const q = f(p.t, p.i, t); const u = clamp((t - p.t0) / Math.max(0.2, p.t1 - p.t0), 0, 1), a = tl.ph.ball[0].at; return { x: lerp(a.x, q.x + 10, u * u), y: lerp(a.y, q.y + 8, u * u), h: Math.sin(u * Math.PI) * 0.6 }; }
      if (p.kind === 'free') return { x: p.at.x, y: p.at.y, h: 0 };
      if (p.kind === 'pass') { const u = clamp((t - p.t0) / (p.t1 - p.t0), 0, 1), a = f(p.t, p.i1, t), b = p.i2b ? f(p.i2b.t, p.i2b.i, t) : f(p.t, p.i2, t); return { x: lerp(a.x + 10, b.x + 10, u), y: lerp(a.y + 8, b.y + 8, u), h: Math.sin(u * Math.PI) * (p.h || 0.4) * 4 }; }
      if (p.kind === 'fly') { const u = clamp((t - p.t0) / (p.t1 - p.t0), 0, 1), a = f(p.t, p.i1, p.t0); return { x: lerp(a.x + 10, p.to.x, u), y: lerp(a.y + 8, p.to.y, u), h: Math.sin(u * Math.PI) * p.h * 2.4 + 2.2 * (1 - u) + 0.8 }; }
      if (p.kind === 'drop') { const u = clamp((t - p.t0) / (p.t1 - p.t0), 0, 1); return { x: p.at.x, y: p.at.y + u * 40, h: 1.2 * (1 - u) }; }
      if (p.kind === 'bounce') { const u = clamp((t - p.t0) / (p.t1 - p.t0), 0, 1); return { x: lerp(p.from.x, p.to.x, u), y: lerp(p.from.y, p.to.y, u), h: Math.abs(Math.sin(u * Math.PI * 2)) * 2.2 * (1 - u) + 0.3 }; }
      return { x: B.x, y: B.y, h: 0 };
    }
    function drawPlayers(tl, t) {
      const unit = (V ? 524 : 964) / (host.clientWidth || 524), fz = 12.5 * unit;
      ['h', 'a'].forEach(tm => pls[tm].forEach((p, i) => { const q = tl ? tl.paths[tm][i](t) : p; p.x = q.x; p.y = q.y; p.gg.setAttribute('transform', `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`);
        const nm = tl && tl.roles[tm + i]; if (nm) { p.lab.setAttribute('opacity', 1); const tt = shortName(nm), w = tt.length * fz * 0.6 + fz * 1.2; p.tx.textContent = tt; p.tx.style.fontSize = fz + 'px'; p.bg.setAttribute('width', w); p.bg.setAttribute('height', fz * 1.9); p.bg.setAttribute('x', -w / 2); p.bg.setAttribute('y', -fz * 0.95);
          if (V) { const dyc = clamp(q.y, w / 2 + 6, 500 - w / 2 - 6) - q.y, upS = q.x > 120 ? -1 : 1; p.lab.setAttribute('transform', `translate(${upS * (16 + fz * 1.2)} ${dyc}) rotate(-90)`); }
          else { const dx = clamp(q.x, w / 2 + 6, 940 - w / 2 - 6) - q.x, up = q.y > 100 ? -1 : 1; p.lab.setAttribute('transform', `translate(${dx} ${up * (16 + fz * 1.2)})`); } } else p.lab.setAttribute('opacity', 0); }));
    }
    function setBall(b) { ballG.setAttribute('transform', `translate(${(V ? b.x - b.h * 8 : b.x).toFixed(1)} ${(V ? b.y : b.y - b.h * 8).toFixed(1)}) scale(${(1 + b.h * 0.1).toFixed(3)})`); shadow.setAttribute('transform', `translate(${V ? (b.h * 8).toFixed(1) : 0} ${V ? 0 : (b.h * 8).toFixed(1)})`); B.x = b.x; B.y = b.y; B.h = b.h; }
    let popT = 0, resultDone = false;
    function frame(now) {
      if (o.dead) return; const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (cur) { if (t0 == null) t0 = now; const t = (now - t0) / 1000 * speed; drawPlayers(cur, t); const b = ballAt(cur, t); setBall(b);
        const r = cur.ph.result; if (r && t >= r.t && !resultDone) { resultDone = true; if (r.made) { const c = el('circle', { cx: r.rim.x, cy: r.rim.y, r: 10, fill: 'none', stroke: '#fff', 'stroke-width': 6 }, g); c.innerHTML = '<animate attributeName="r" from="10" to="70" dur=".8s" fill="freeze"/><animate attributeName="opacity" from="1" to="0" dur=".8s" fill="freeze"/>'; setTimeout(() => c.remove(), 900); showPop(`+${r.pts}`, r.name ? shortName(r.name) : '', r.rim.x + cur.s * 90, r.rim.y - 40, r.off); } else if (cur.e.type === 'shot') showPop('Miss', r.name ? shortName(r.name) : '', r.rim.x + cur.s * 90, r.rim.y - 40, r.off); }
        const pp = cur.ph.pop; if (pp && t >= pp.t && !pp.done) { pp.done = true; showPop(pp.text, pp.name ? shortName(pp.name) : '', clamp(pp.at.x, 80, 860), clamp(pp.at.y - 46, 40, 460)); }
        if (t > cur.dur) { // finish: remember where the ball ended
          const en = cur.ph.end; if (en && en.hold) { B.hold = en.hold; } else if (en && en.free) { B.hold = null; B.free = en.free; B.x = en.free.x; B.y = en.free.y; }
          opts_onEnd && opts_onEnd(cur.e); cur = null; next(); } }
      else { drawPlayers(null, 0); }
      if (!o.dead) requestAnimationFrame(frame);
    }
    let opts_onEnd = o.onEnd;
    function showPop(a, b, x, y, off) { ptx.innerHTML = ''; const t1 = el('tspan', { x: 0, dy: 0, class: 'cv-pop1' }, ptx); t1.textContent = a; if (b) { const t2 = el('tspan', { x: 0, dy: 56, class: 'cv-pop2' }, ptx); t2.textContent = b; } pop.setAttribute('transform', `translate(${x} ${y})${V ? ' rotate(-90)' : ''}`); pop.setAttribute('opacity', 1); pop.style.transition = 'none'; clearTimeout(showPop.tm); showPop.tm = setTimeout(() => { pop.style.transition = 'opacity .6s'; pop.setAttribute('opacity', 0); }, 1700); }
    function next() { const e = q.shift(); if (!e) { cur = null; return; } cur = build(e); t0 = null; resultDone = false; o.onPlay && o.onPlay(e); }
    // line the teams up at center court
    const init = () => { for (const t of ['h', 'a']) pls[t].forEach((p, i) => { const x = 470 + (t === 'h' ? -1 : 1) * (60 + i * 25), y = 90 + i * 80; p.x = x; p.y = y; p.gg.setAttribute('transform', `translate(${x} ${y})`); }); setBall({ x: 470, y: 250, h: 0 }); }; init();
    requestAnimationFrame(frame);
    return { update(list) { list.forEach(e => { if (seen.has(e.id)) return; seen.add(e.id); if (first) return; if (e.type === 'other') return; q.push(e); }); if (first) { first = false; } if (!cur) next(); if (q.length > 6) q.splice(0, q.length - 3); speed = q.length > 4 ? 2.4 : q.length > 2 ? 1.6 : (o.speed || 1); }, speed(v) { o.speed = v; speed = v; }, stop() { o.dead = true; } };
  }

  /* ---------- C: game flow, who is hot, small shot map ---------- */
  function flow(host, o) {
    const box = document.createElement('div'); box.className = 'cv-flow'; host.appendChild(box);
    return { update(evs) {
      const me = o.us === 'a' ? 'a' : 'h', sgn = me === 'h' ? 1 : -1, pts = [{ s: 0, m: 0 }]; evs.forEach(e => { if (e.hs != null) pts.push({ s: e.sec, m: (e.hs - e.as) * sgn, e }); });
      const W = 640, H = 230, last = pts[pts.length - 1], maxS = Math.max(2400, last.s + 60), mm = Math.max(10, ...pts.map(p => Math.abs(p.m))) + 2, px = s => 8 + (W - 16) * s / maxS, py = m => H / 2 - (H / 2 - 18) * m / mm;
      const line = 'M' + pts.map(p => `${px(p.s).toFixed(1)},${py(p.m).toFixed(1)}`).join('L'), area = `${line}L${px(last.s)},${py(0)}L${px(0)},${py(0)}Z`;
      // scoring runs: consecutive points by one team (8+ with no reply)
      const runs = []; let cs = null, st = 0, pt = 0; evs.forEach(e => { if (e.hs == null || !e.pts) return; if (cs !== e.team) { if (cs && pt >= 8) runs.push({ team: cs, pts: pt, a: st, b: e.sec }); cs = e.team; st = e.sec; pt = 0; } pt += e.pts; }); if (cs && pt >= 8) runs.push({ team: cs, pts: pt, a: st, b: last.s });
      const runSvg = runs.map(r => { const mine = r.team === me; return `<rect x="${px(r.a)}" y="6" width="${Math.max(4, px(r.b) - px(r.a))}" height="${H - 12}" fill="${mine ? '#FF8200' : '#777'}" opacity=".13"/><text x="${(px(r.a) + px(r.b)) / 2}" y="${mine ? 18 : H - 8}" text-anchor="middle" class="cv-run" fill="${mine ? '#B45A00' : '#555'}">${r.pts}-0</text>`; }).join('');
      const half = `<line x1="${px(1200)}" x2="${px(1200)}" y1="6" y2="${H - 6}" stroke="var(--line-strong,#bbb)" stroke-dasharray="4 5"/><text x="${px(1200) + 4}" y="${H - 8}" class="cv-q">Half</text>`;
      const grid = [-10, 0, 10].map(m => `<line x1="8" x2="${W - 8}" y1="${py(m)}" y2="${py(m)}" stroke="var(--line-strong,#ccc)" opacity="${m ? .35 : .9}"/><text x="${W - 8}" y="${py(m) - 3}" text-anchor="end" class="cv-q">${m > 0 ? '+' + m : m}</text>`).join('');
      const lead = last.m, leadTxt = lead === 0 ? 'Tied' : (lead > 0 ? o.names[me] + ' +' + lead : o.names[me === 'h' ? 'a' : 'h'] + ' +' + (-lead));
      // who is hot
      const by = {}; evs.filter(e => e.type === 'shot' && e.team === me && e.name).forEach(e => { const b = by[e.name] = by[e.name] || { n: e.name, pts: 0, sh: [] }; b.sh.push(e.made ? 1 : 0); if (e.made) b.pts += e.pts || (e.three ? 3 : 2); });
      evs.filter(e => e.type === 'ft' && e.team === me && e.name && e.made).forEach(e => { (by[e.name] = by[e.name] || { n: e.name, pts: 0, sh: [] }).pts += 1; });
      const top = Object.values(by).sort((a, b) => b.pts - a.pts).slice(0, 5);
      const hot = top.map(p => { const l = p.sh.slice(-6), m = l.filter(Boolean).length, hotp = l.length >= 3 && m >= Math.ceil(l.length * 0.66); return `<div class="cv-hp${hotp ? ' hot' : ''}"><b>${esc(shortName(p.n))}</b><span>${p.pts} pts</span><div class="cv-dots">${l.map(v => `<i class="${v ? 'm' : 'x'}"></i>`).join('')}</div>${hotp ? '<em>Hot</em>' : ''}</div>`; }).join('');
      const a = sumShots(evs, me), fm = v => `${v[0]}/${v[1]}`;
      box.innerHTML = `<div class="cv-fh"><h3>Game flow</h3><b>${esc(leadTxt)}</b></div><svg viewBox="0 0 ${W} ${H}" class="cv-flowsvg" role="img" aria-label="Lead over time">${grid}${runSvg}${half}<defs><clipPath id="cvU"><rect x="0" y="0" width="${W}" height="${py(0)}"/></clipPath><clipPath id="cvD"><rect x="0" y="${py(0)}" width="${W}" height="${H}"/></clipPath></defs><path d="${area}" fill="#FF8200" opacity=".3" clip-path="url(#cvU)"/><path d="${area}" fill="#777" opacity=".28" clip-path="url(#cvD)"/><path d="${line}" fill="none" stroke="#FF8200" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${px(last.s)}" cy="${py(last.m)}" r="5" fill="#FF8200" stroke="#fff" stroke-width="2"/></svg>
        <div class="cv-legend"><span>${esc(o.names[me])} lead</span><span>Shaded = scoring runs of 8 or more</span></div><h3 class="cv-h3">Who's hot <small>last six shots</small></h3><div class="cv-hots">${hot || '<p class="dim">Shooters appear here as shots go up.</p>'}</div>
        <div class="cv-zones"><b>${esc(o.names[me])}</b><span><i>Paint</i><b>${fm(a.paint)}</b></span><span><i>Mid</i><b>${fm(a.mid)}</b></span><span><i>3-pt</i><b>${fm(a.three)}</b></span></div>`;
    }, stop() { } };
  }

  /* ---------- D: live board = half court with only the latest shots + pop-ups, and a feed with each player's updated stats ---------- */
  function statRows(evs) {
    const P = {}, get = (t, n) => (P[t + n] = P[t + n] || { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, tov: 0, pf: 0 }), rows = [];
    evs.forEach(e => {
      if (e.type === 'other' || !e.name) { rows.push(null); return; }
      const a = get(e.team, e.name); let line = '', tag = '', cls = '', txt = '';
      if (e.type === 'shot') { a.fga++; if (e.three) a.tpa++; if (e.made) { a.fgm++; a.pts += e.pts || (e.three ? 3 : 2); if (e.three) a.tpm++; }
        line = `${a.pts} PTS · ${a.fgm}-${a.fga} FG` + (a.tpa ? ` · ${a.tpm}-${a.tpa} 3PT` : ''); tag = e.made ? (e.three ? 'MADE 3' : 'MADE') : 'MISS'; cls = e.made ? 'made' : 'miss'; txt = (e.three ? 'three-pointer' : 'shot') + (e.made ? '' : ' missed');
        if (e.made && e.assist) { const b = get(e.team, e.assist); b.ast++; txt += ` · assist ${shortName(e.assist)} (${b.ast} AST)`; } }
      else if (e.type === 'ft') { a.fta++; if (e.made) { a.ftm++; a.pts++; } line = `${a.pts} PTS · ${a.ftm}-${a.fta} FT`; tag = e.made ? 'FT' : 'FT MISS'; cls = e.made ? 'made' : 'miss'; txt = 'free throw'; }
      else if (e.type === 'rebound') { a.reb++; line = `${a.reb} REB`; tag = 'REB'; cls = 'reb'; txt = e.offReb ? 'offensive rebound' : 'defensive rebound'; }
      else if (e.type === 'turnover') { a.tov++; line = `${a.tov} TO`; tag = 'TO'; cls = 'to'; txt = 'turnover'; if (e.steal) { const b = get(e.team === 'h' ? 'a' : 'h', e.steal); b.stl++; txt += ` · stolen by ${shortName(e.steal)} (${b.stl} STL)`; } }
      else if (e.type === 'foul') { a.pf++; line = `${a.pf} PF`; tag = 'FOUL'; cls = 'foul'; txt = 'foul'; }
      else { rows.push(null); return; }
      rows.push({ e, line, tag, cls, txt });
    });
    return rows;
  }
  function live(host, o) {
    const wrap = document.createElement('div'); wrap.className = 'cv-court'; host.appendChild(wrap);
    const svg = el('svg', { viewBox: '-10 -10 520 490', class: 'cv-svg', role: 'img', 'aria-label': 'Latest shots' }, wrap); halfCourt(svg);
    const marks = el('g', {}, svg), fx = el('g', {}, svg), ball = el('ellipse', { rx: 12, ry: 9, fill: '#E8590C', stroke: '#111', 'stroke-width': 2.5, opacity: 0 }, fx), pops = el('g', {}, svg);
    const feed = document.createElement('div'); feed.className = 'cv-feed'; host.appendChild(feed);
    const col = t => t === 'h' ? o.home.color : o.away.color, X = v => v * 10, nameOf = t => o.names[t];
    let all = [], rows = [], shown = 0, first = true, queue = [], busy = false, anim = null, seenIds = new Set(), newId = null;
    const unit = () => 500 / (svg.clientWidth || host.clientWidth || 500);
    function drawMarks() {
      marks.innerHTML = ''; const sh = []; for (let i = 0; i < shown; i++) { const e = all[i]; if (e && e.type === 'shot' && e.coord) sh.push(e); } const rec = sh.slice(-4);
      rec.forEach((e, k) => { const f = fold(e.coord), x = X(f.x), y = X(f.y), c = col(e.team), age = rec.length - 1 - k, op = [1, 0.7, 0.45, 0.28][age];
        if (e.made) el('circle', { cx: x, cy: y, r: age ? 9 : 12, fill: c, stroke: '#fff', 'stroke-width': 2.6, opacity: op }, marks); else el('path', { d: `M${x - 7} ${y - 7}l14 14M${x + 7} ${y - 7}l-14 14`, stroke: c, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: op, fill: 'none' }, marks); });
    }
    function drawFeed() {
      const list = []; for (let i = shown - 1; i >= 0 && list.length < 7; i--) if (rows[i]) list.push(rows[i]);
      feed.innerHTML = `<div class="cv-feedh"><h3>Recent activity</h3><small>updated stats for each player</small></div>` + (list.length ? '<ol>' + list.map(r => { const e = r.e, c = col(e.team); return `<li class="cv-r ${r.cls}${e.id === newId ? ' new' : ''}" style="--c:${c}"><span class="cv-tag">${esc(r.tag)}</span><div class="cv-rb"><b>${esc(shortName(e.name))}</b><em>${esc(nameOf(e.team))} · ${esc(r.txt)}</em></div><div class="cv-st">${esc(r.line)}</div><time>${esc(e.clk || '')}</time></li>`; }).join('') + '</ol>' : '<p class="dim">Plays appear here as they happen.</p>');
    }
    function pop(e, kind, x, y, sub) {
      const u = unit(), fs = 15 * u, big = kind === 'made', g = el('g', { opacity: 0 }, pops), t = rows[all.indexOf(e)], c = col(e.team);
      const t1 = e.name ? shortName(e.name) : '', title = kind === 'made' ? `+${e.pts || (e.three ? 3 : 2)}  ${t1}` : kind === 'miss' ? `Miss · ${t1}` : kind === 'reb' ? `${e.offReb ? 'Off.' : 'Def.'} rebound · ${t1}` : kind === 'steal' ? `Steal · ${shortName(e.steal)}` : kind === 'to' ? `Turnover · ${t1}` : kind === 'foul' ? `Foul · ${t1}` : kind === 'ft' ? `${e.made ? 'FT good' : 'FT miss'} · ${t1}` : t1;
      const f2 = fs * (big ? 1.25 : 1), w = title.length * f2 * 0.58 + f2 * 1.8, h = f2 * (sub ? 3.1 : 2), bg = el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: f2 * 0.8, fill: kind === 'miss' ? '#2b2b2b' : (kind === 'made' ? c : kind === 'steal' || kind === 'reb' ? c : '#2b2b2b'), stroke: '#fff', 'stroke-width': 2.5 }, g);
      const tx = el('text', { class: 'cv-lab', fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central', y: sub ? -f2 * 0.5 : 0 }, g); tx.textContent = title; tx.style.fontSize = f2 + 'px'; tx.style.fontWeight = 800;
      if (sub) { const t2 = el('text', { class: 'cv-lab', fill: '#fff', 'text-anchor': 'middle', 'dominant-baseline': 'central', y: f2 * 0.75, opacity: 0.9 }, g); t2.textContent = sub; t2.style.fontSize = f2 * 0.78 + 'px'; t2.style.fontWeight = 600; }
      const cx = clamp(x, w / 2 + 6, 500 - w / 2 - 6), cy = clamp(y, h / 2 + 6, 462 - h / 2); g.setAttribute('transform', `translate(${cx} ${cy + 14})`); g.style.transition = 'opacity .25s, transform .25s'; requestAnimationFrame(() => { g.setAttribute('opacity', 1); g.setAttribute('transform', `translate(${cx} ${cy})`); });
      setTimeout(() => { g.style.transition = 'opacity .5s'; g.setAttribute('opacity', 0); setTimeout(() => g.remove(), 600); }, big ? 2600 : 2100);
    }
    function step() {
      if (busy) return; const e = queue.shift(); if (!e) return; busy = true; const idx = all.indexOf(e), dwell = queue.length > 3 ? 600 : queue.length > 1 ? 1100 : 1700;
      const done = () => { shown = Math.max(shown, idx + 1); newId = e.id; drawMarks(); drawFeed(); setTimeout(() => { busy = false; step(); }, dwell); };
      if (e.type === 'shot' && e.coord) { const f = fold(e.coord), a = { x: X(f.x), y: X(f.y) }, t0 = performance.now(), dur = queue.length > 2 ? 450 : 850; anim = { t0, dur, a, e, fin: () => { pop(e, e.made ? 'made' : 'miss', a.x, a.y + 46, e.made && e.assist ? 'assist ' + shortName(e.assist) : ''); if (e.made) { const r = el('circle', { cx: 250, cy: 52.5, r: 10, fill: 'none', stroke: '#fff', 'stroke-width': 5 }, fx); r.innerHTML = '<animate attributeName="r" from="10" to="60" dur=".7s" fill="freeze"/><animate attributeName="opacity" from="1" to="0" dur=".7s" fill="freeze"/>'; setTimeout(() => r.remove(), 800); } done(); } }; }
      else { if (e.type === 'shot') pop(e, e.made ? 'made' : 'miss', 250, 150, e.made && e.assist ? 'assist ' + shortName(e.assist) : ''); else if (e.type === 'rebound') pop(e, 'reb', 250, 118); else if (e.type === 'turnover') { if (e.steal) pop(e, 'steal', 250, 250); else pop(e, 'to', 250, 250); } else if (e.type === 'foul') pop(e, 'foul', 250, 236); else if (e.type === 'ft') pop(e, 'ft', 250, 150); done(); }
    }
    function frame(now) { if (o.dead) return; if (anim) { const u = clamp((now - anim.t0) / anim.dur, 0, 1), x = lerp(anim.a.x, 250, u), y = lerp(anim.a.y, 52.5, u) - Math.sin(u * Math.PI) * 100, sc = 1 + Math.sin(u * Math.PI) * 0.55; ball.setAttribute('opacity', u < 1 ? 1 : 0); ball.setAttribute('transform', `translate(${x} ${y}) scale(${sc})`); if (u >= 1) { const f = anim.fin; anim = null; f(); } } requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
    return { update(list) {
      all = list; rows = statRows(list);
      if (first) { first = false; shown = list.length; list.forEach(e => seenIds.add(e.id)); drawMarks(); drawFeed(); return; }
      list.forEach(e => { if (seenIds.has(e.id)) return; seenIds.add(e.id); if (e.type === 'other') { shown = Math.max(shown, all.indexOf(e) + 1); return; } queue.push(e); });
      if (queue.length > 8) { const keep = queue.splice(-3); shown = Math.max(shown, all.indexOf(keep[0])); queue = keep; drawMarks(); drawFeed(); }
      step();
    }, stop() { o.dead = true; } };
  }
  function mount(host, o) {
    o = Object.assign({ style: 'shotmap', speed: 1 }, o); host.classList.add('cv', 'cv-style-' + o.style); host.innerHTML = '';
    o.names = o.names || { h: o.home.name, a: o.away.name };
    const impl = o.style === 'court' ? court(host, o) : o.style === 'flow' ? flow(host, o) : o.style === 'live' ? live(host, o) : shotmap(host, o);
    return impl;
  }
  window.CourtViz = { mount, shortName, _stats: statRows };
})();
