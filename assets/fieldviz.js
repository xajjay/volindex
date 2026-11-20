/* The Vol Index — FieldViz: a football field that acts out each play with 22 players and a ball.
   ESPN gives us the text of a play and where it started and ended, not tracking data, so every play is a reconstruction:
   the players named in the play (QB, rusher, receiver, tackler, sacker, kicker...) are real, the other bodies are anonymous.
   Looks:  'broadcast' = the whole field, wide.  'vertical' = the whole field turned on end for a phone.  'lens' = whole-field map plus a camera that follows the ball.
   Field coordinates are yards: x 0..100 left to right (the home end zone is on the left, the home team attacks right), y 0..53.3 across. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const SUF = /^(II|III|IV|Jr\.?|Sr\.?)$/;
  const shortName = n => { const p = String(n || '').split(' ').filter(x => !SUF.test(x)); return p.length < 2 ? (n || '') : p[0][0] + '. ' + p[p.length - 1]; };
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };

  /* ---------- smooth motion: Catmull-Rom through keyframes {t,x,y,stop} ---------- */
  function track(kfs) {
    kfs = kfs.slice().sort((a, b) => a.t - b.t).reduce((o, k) => { if (o.length && k.t - o[o.length - 1].t < 0.12) o[o.length - 1] = k; else o.push(k); return o; }, []); const n = kfs.length;
    const tan = kfs.map((k, i) => { if (!i || i === n - 1 || k.stop) return { x: 0, y: 0 }; const p = kfs[i - 1], q = kfs[i + 1], dt = (q.t - p.t) || 1; return { x: (q.x - p.x) / dt, y: (q.y - p.y) / dt }; });
    return t => {
      if (t <= kfs[0].t) return { x: kfs[0].x, y: kfs[0].y }; if (t >= kfs[n - 1].t) return { x: kfs[n - 1].x, y: kfs[n - 1].y };
      let i = 0; while (kfs[i + 1].t < t) i++;
      const a = kfs[i], b = kfs[i + 1], h = (b.t - a.t) || 1e-6, u = (t - a.t) / h, u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      return { x: h00 * a.x + h10 * h * tan[i].x + h01 * b.x + h11 * h * tan[i + 1].x, y: h00 * a.y + h10 * h * tan[i].y + h01 * b.y + h11 * h * tan[i + 1].y };
    };
  }

  /* ---------- formations (slot i of a team is the same body whether it is on offense or defense) ---------- */
  // offense: 0-4 line, 5 QB, 6 RB, 7 TE, 8 WR, 9 WR, 10 slot.  defense: 0-3 line, 4-6 LB, 7-8 CB, 9-10 S
  function formation(sp, yb, d) {
    const X = k => sp - d * k, Dx = k => sp + d * k, c = v => clamp(v, 2.6, 50.7), off = [], def = [];
    for (let i = 0; i < 5; i++) off.push({ x: X(0.9), y: yb + (i - 2) * 2.3 });
    off.push({ x: X(5), y: yb }, { x: X(7.4), y: yb + (yb < 26.6 ? 1.9 : -1.9) }, { x: X(0.9), y: c(yb + 8.8) }, { x: X(0.9), y: c(yb - 19.5) }, { x: X(0.9), y: c(yb + 19.5) }, { x: X(2.3), y: c(yb - 9.6) });
    [-5.5, -1.8, 1.8, 5.5].forEach(o => def.push({ x: Dx(1.1), y: yb + o })); [-7.2, 0, 7.2].forEach(o => def.push({ x: Dx(4.6), y: c(yb + o) }));
    def.push({ x: Dx(6.6), y: c(off[8].y + 1.4) }, { x: Dx(6.6), y: c(off[9].y - 1.4) }, { x: Dx(13), y: c(yb - 9.5) }, { x: Dx(13.5), y: c(yb + 9.5) });
    return { off, def };
  }
  const specialForm = (sp, yb, d) => { // field goal / punt: everybody on the line, kicker deep
    const f = formation(sp, yb, d); [0, 1, 2, 3, 4, 7, 8, 9, 10].forEach((s, i) => { f.off[s] = { x: sp - d * 0.9, y: yb + (i - 4) * 1.55 }; }); f.def.forEach((p, i) => { if (i < 9) f.def[i] = { x: sp + d * (i < 7 ? 1.1 : 2.4), y: yb + (i - 4) * 1.7 }; }); return f;
  };
  const near = (pts, p, used) => { let best = -1, bd = 1e9; pts.forEach((q, i) => { if (used.has(i)) return; const dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < bd) { bd = dd; best = i; } }); return best; };

  /* ---------- build the choreography of one play ---------- */
  function build(play, cur, opts) {
    const R = rng(hash(play.id || play.text || 'x')), d = play.off === 'home' ? 1 : -1, off = play.off, def = off === 'home' ? 'away' : 'home';
    const sp = clamp(play.sp, 0, 100), yb = clamp(play.y0 != null ? play.y0 : 17 + (hash(String(play.id) + 'h') % 20), 6, 47), type = play.type || 'none', names = play.names || {};
    const special = type === 'fg' || type === 'punt' || type === 'kick';
    const F = special ? specialForm(sp, yb, d) : formation(sp, yb, d);
    let md = 0; if (cur) for (let i = 0; i < 11; i++) { [[off, F.off[i]], [def, F.def[i]]].forEach(([tm, f]) => { const c0 = cur[tm] && cur[tm][i]; if (c0) md = Math.max(md, Math.hypot(c0.x - f.x, c0.y - f.y)); }); }
    const TR = clamp(md / 8, 1.3, 5.5), TS = TR + 0.6, fin = (...a) => { const r = finish(...a); r.TS = TS; return r; };
    const K = { home: Array.from({ length: 11 }, () => []), away: Array.from({ length: 11 }, () => []) };
    const k = (tm, i, t, x, y, stop) => K[tm][i].push({ t, x, y, stop });
    for (let i = 0; i < 11; i++) { const co = off, dd = def; [[co, F.off[i]], [dd, F.def[i]]].forEach(([tm, f]) => { const c0 = cur && cur[tm] ? cur[tm][i] : f; k(tm, i, 0, c0.x, c0.y, true); k(tm, i, TR, f.x, f.y, true); k(tm, i, TS, f.x, f.y, true); }); }
    const O = i => F.off[i], D = i => F.def[i];
    const clampY = v => clamp(v, 2, 51.3), endX = play.td ? (d > 0 ? 104 : -4) : clamp(play.ep != null ? play.ep : sp + d * (play.yds || 0), -3, 103);
    const lane = (R() < 0.5 ? -1 : 1) * (2 + R() * 5), ey = clampY(yb + lane);
    const memo = {}, T = (tm, i) => memo[tm + i] || (memo[tm + i] = track(K[tm][i])), cpos = (tm, i) => t => { const p = T(tm, i)(t); return { x: p.x + 0.45 * d, y: p.y + 0.35 }; };
    const ball = []; // phases
    let tEnd = TS + 1.2, carrierKey = null, qbPath = null;
    ball.push({ t0: 0, t1: TS, hold: { x: sp, y: yb } });
    const used = new Set(), pursue = (tFinish, tx, ty, tackleNames, startT) => {
      // every defender runs to the ball; the ones named in the play arrive first and closest
      const cand = D ? F.def.map((p, i) => ({ i, p })) : [], named = (tackleNames || []).filter(Boolean);
      const order = cand.filter(c => c.i >= 4).sort((a, b) => Math.hypot(a.p.x - tx, a.p.y - ty) - Math.hypot(b.p.x - tx, b.p.y - ty));
      const nt = []; order.slice(0, named.length).forEach((c, j) => { nt.push(c.i); used.add(c.i); k(def, c.i, startT + 0.5, lerp(c.p.x, tx, 0.28), lerp(c.p.y, ty, 0.28)); k(def, c.i, tFinish, tx + d * (j ? -0.9 : 0.9) * 0.9, ty + (j ? 1.1 : -1.1) * 0.9, true); });
      F.def.forEach((p, i) => { if (used.has(i)) return; const dist = Math.hypot(p.x - tx, p.y - ty), rad = 1.6 + (i % 4) * 0.8; k(def, i, startT + 0.55, lerp(p.x, tx, 0.18), lerp(p.y, ty, 0.2)); k(def, i, tFinish + 0.12 + (dist > 15 ? 0.25 : 0), tx - d * rad * (i % 2 ? 1 : -1) * 0.6, ty + ((i % 3) - 1) * rad, true); });
      return nt;
    };
    const blockers = (tFinish, gain) => { // line and skill players blocking downfield
      for (let i = 0; i < 5; i++) { k(off, i, TS + 0.7, O(i).x + d * 1.4, O(i).y + (i - 2) * 0.35); k(off, i, tFinish, O(i).x + d * clamp(Math.abs(gain) * 0.5, 1.6, 8), O(i).y + (i - 2) * 0.9, true); }
    };
    const routeTargets = { 7: [5, 10], 8: [9, 18], 9: [9, 18], 10: [6, 13] };
    const pickRec = () => { const slots = [8, 9, 10, 7]; return slots[hash(String(play.id) + 'r') % 4]; };
    const flightTime = dist => clamp(0.45 + dist / 30, 0.55, 1.5);

    if (type === 'run' || type === 'scramble') {
      const scr = type === 'scramble', cs = scr ? 5 : 6, q = O(5), m = { x: sp - d * 2.3, y: yb + (O(6).y - yb) * 0.3 }, hT = TS + 0.8;
      carrierKey = { tm: off, i: cs };
      const e = { x: endX, y: ey }, start = scr ? { x: q.x - d * 2, y: yb } : m, run = Math.hypot(e.x - start.x, e.y - start.y), tRun = Math.max(1.45, run / 7.2), t1 = (scr ? TS + 1.0 : hT) + tRun;
      tEnd = t1;
      if (scr) { k(off, 5, TS + 0.4, q.x - d * 1.2, yb); k(off, 5, TS + 1.0, start.x, start.y); k(off, 5, TS + 1.0 + tRun * 0.55, lerp(start.x, e.x, 0.55), lerp(start.y, e.y, 0.5) + (R() - 0.5) * 3); k(off, 5, t1, e.x, e.y, true); k(off, 6, TS + 0.8, O(6).x, O(6).y + 1); k(off, 6, t1, lerp(O(6).x, e.x, 0.6), lerp(O(6).y, e.y, 0.6) ); }
      else { k(off, 5, TS + 0.45, q.x + d * 0.4, q.y); k(off, 5, hT + 0.3, q.x + d * 2.2, q.y + 0.6); k(off, 5, t1, q.x + d * 3, q.y + 1.2, true);
        k(off, 6, TS + 0.35, O(6).x + d * 0.9, O(6).y * 0.8 + yb * 0.2); k(off, 6, hT, m.x, m.y); k(off, 6, hT + tRun * 0.55, lerp(m.x, e.x, 0.55), lerp(m.y, e.y, 0.45) + (R() - 0.5) * 3); k(off, 6, t1, e.x, e.y, true); }
      [7, 8, 9, 10].forEach((s, j) => { k(off, s, TS + 0.9, O(s).x + d * 3.5, O(s).y + (j % 2 ? -1 : 1) * 1.5); k(off, s, t1, lerp(O(s).x + d * 4, e.x, 0.8) + d * 3, lerp(O(s).y, e.y, 0.55), true); });
      blockers(t1, e.x - sp);
      for (let i = 0; i < 4; i++) { k(def, i, TS + 0.7, D(i).x - d * 0.4, D(i).y + (i - 1.5) * 0.4); }
      const tk = pursue(t1, e.x, e.y, names.tacklers, TS + 0.4);
      ball.push({ t0: TS, t1: TS + 0.28, fly: { a: () => ({ x: sp, y: yb }), b: cpos(off, 5), h: 0.3 } });
      if (scr) ball.push({ t0: TS + 0.28, t1: t1, carry: { tm: off, i: 5 } });
      else { ball.push({ t0: TS + 0.28, t1: hT - 0.22, carry: { tm: off, i: 5 } }); ball.push({ t0: hT - 0.22, t1: hT, fly: { a: cpos(off, 5), b: cpos(off, 6), h: 0.2 } }); ball.push({ t0: hT, t1: t1, carry: { tm: off, i: 6 } }); }
      play._end = { x: e.x, y: e.y, t: t1 }; var roles = { [off + 5]: names.passer || (scr ? names.rusher : ''), [off + 6]: scr ? '' : names.rusher };
      if (scr) roles = { [off + 5]: names.rusher || names.passer };
      (names.tacklers || []).forEach((n, j) => { if (tk[j] != null) roles[def + tk[j]] = n; });
      return fin(roles, t1 + 0.9, K, ball, F, off, def, carrierKey, play, e, sp, yb);
    }

    if (type === 'pass' || type === 'inc' || type === 'int' || type === 'sack') {
      const qd = { x: sp - d * (type === 'sack' ? clamp(Math.abs(play.yds != null ? play.yds : 6) + 1.2, 3.5, 12) : 6.8 + (R() < 0.4 ? 1.6 : 0)), y: yb + (R() - 0.5) * 1.2 }, qb = O(5);
      k(off, 5, TS + 0.45, lerp(qb.x, qd.x, 0.55), lerp(qb.y, qd.y, 0.55)); k(off, 5, TS + 1.05, qd.x, qd.y);
      for (let i = 0; i < 5; i++) { k(off, i, TS + 0.55, O(i).x - d * 0.5, O(i).y + (i - 2) * 0.35); }
      k(off, 6, TS + 0.8, O(6).x + d * 0.5, O(6).y + (O(6).y > yb ? 1.3 : -1.3));
      if (type === 'sack') {
        const tS = TS + 1.9, e = { x: clamp(sp - d * clamp(Math.abs(play.yds != null ? play.yds : 6), 2, 15), -3, 103), y: qd.y + (R() - 0.5) * 2 };
        k(off, 5, TS + 1.55, qd.x - d * 0.8, qd.y + (R() - 0.5)); k(off, 5, tS, e.x, e.y, true);
        const rush = [0, 1, 2, 3, 4, 5, 6].map(i => ({ i, p: F.def[i] })).sort((a, b) => Math.hypot(a.p.x - qd.x, a.p.y - qd.y) - Math.hypot(b.p.x - qd.x, b.p.y - qd.y)), sn = (names.sacker || []).filter(Boolean), sk = [];
        rush.slice(0, Math.max(1, sn.length)).forEach((c, j) => { sk.push(c.i); used.add(c.i); k(def, c.i, TS + 0.9, lerp(c.p.x, e.x, 0.55), lerp(c.p.y, e.y, 0.6)); k(def, c.i, tS - 0.05, e.x + d * (j ? -0.8 : 0.9), e.y + (j ? 1 : -1) * 0.9, true); });
        F.def.forEach((p, i) => { if (used.has(i)) return; if (i < 4) { k(def, i, TS + 0.9, lerp(p.x, qd.x, 0.5), lerp(p.y, qd.y, 0.55)); k(def, i, tS + 0.2, e.x + d * 1.6, e.y + (i - 1.5) * 1.5, true); } else { k(def, i, TS + 1.0, p.x - d * 1.2, p.y); k(def, i, tS + 0.4, p.x - d * 2, lerp(p.y, e.y, 0.2), true); } });
        [7, 8, 9, 10].forEach(s => { k(off, s, tS, O(s).x + d * 8, O(s).y + (R() - 0.5) * 6, true); });
        ball.push({ t0: TS, t1: TS + 0.3, fly: { a: () => ({ x: sp, y: yb }), b: cpos(off, 5), h: 0.3 } }); ball.push({ t0: TS + 0.3, t1: tS + 0.4, carry: { tm: off, i: 5 } });
        const roles = { [off + 5]: names.passer }; sn.forEach((n, j) => { if (sk[j] != null) roles[def + sk[j]] = n; });
        return fin(roles, tS + 1.0, K, ball, F, off, def, { tm: off, i: 5 }, play, e, sp, yb);
      }
      // the throw
      const rs = pickRec(), r0 = O(rs), tr = TS + 1.15 + (R() < 0.4 ? 0.3 : 0);
      let yds = type === 'pass' ? (play.yds != null ? play.yds : 8) : 0, yac = type === 'pass' ? clamp(Math.round(R() * 6 + 1), 0, Math.max(0, yds)) : 0;
      if (type === 'pass' && yds <= 3) yac = Math.max(0, yds - 1);
      const air = type === 'pass' ? yds - yac : (type === 'int' ? 9 + R() * 11 : 6 + R() * 11), C = { x: clamp(sp + d * air, -2, 102), y: clampY(r0.y + (R() - 0.5) * 8 + (r0.y < 26.6 ? 4 : -4) * (air > 12 ? 1 : 0.3)) };
      const fT = flightTime(Math.hypot(C.x - qd.x, C.y - qd.y)), tc = tr + fT; let E = type === 'pass' ? { x: endX, y: clampY(C.y + (R() - 0.5) * 6) } : { x: C.x + d * 1.5, y: C.y }, tE = tc + (type === 'pass' ? Math.max(0.5, Math.abs(E.x - C.x) / 6.8) : 0.8);
      if (type === 'pass' && yac === 0) { E = { x: C.x, y: C.y }; tE = tc + 0.55; }
      // receivers run routes; the target arrives at the catch point exactly when the ball does
      [7, 8, 9, 10].forEach(s => {
        const p = O(s); if (s === rs) { k(off, s, TS + (tc - TS) * 0.35, lerp(p.x, C.x, 0.35), lerp(p.y, C.y, 0.12)); k(off, s, TS + (tc - TS) * 0.72, lerp(p.x, C.x, 0.78) , lerp(p.y, C.y, 0.65)); k(off, s, tc, C.x + (type === 'inc' ? d * 0.4 : 0), C.y, type === 'inc'); if (type === 'pass') k(off, s, tE, E.x, E.y, true); }
        else { const rt = routeTargets[s], tx = sp + d * (rt[0] + R() * (rt[1] - rt[0])), ty = clampY(p.y + (p.y < 26.6 ? 1 : -1) * (R() * 4)); k(off, s, TS + 0.8, lerp(p.x, tx, 0.4), lerp(p.y, ty, 0.2)); k(off, s, tc + 0.1, tx, ty, true); }
      });
      // defenders: cover the target, drop into zones, rush
      const coverOrder = F.def.map((p, i) => ({ i, p })).filter(c => c.i >= 4).sort((a, b) => Math.hypot(a.p.x - C.x, a.p.y - C.y) - Math.hypot(b.p.x - C.x, b.p.y - C.y)), tNames = (names.tacklers || []).filter(Boolean);
      let coverIdx = coverOrder[0].i, icp = null;
      if (type === 'int') { icp = coverIdx; }
      used.add(coverIdx); const pr = track(K[off][rs]);
      for (let t = TS + 0.4; t < tc - 0.25; t += 0.35) k(def, coverIdx, t, pr(t - 0.15).x + d * 1.5, pr(t - 0.15).y + (R() - 0.5) * 0.6);
      k(def, coverIdx, tc, C.x + d * (type === 'int' ? 0 : 0.9), C.y + (type === 'int' ? 0 : 0.8), type === 'int');
      [0, 1, 2, 3].forEach(i => { const p = D(i); k(def, i, TS + 0.8, lerp(p.x, qd.x, 0.5), lerp(p.y, qd.y, 0.55)); k(def, i, tr + 0.3, lerp(p.x, qd.x, 0.72), lerp(p.y, qd.y, 0.72)); k(def, i, tc + 0.4, lerp(p.x, C.x, 0.4), lerp(p.y, C.y, 0.3)); });
      coverOrder.slice(1).forEach((c, j) => { used.add(c.i); const dist = Math.hypot(c.p.x - C.x, c.p.y - C.y); k(def, c.i, TS + 0.8, c.p.x + d * (c.i < 7 ? 0.9 : 1.5), lerp(c.p.y, C.y, 0.2)); k(def, c.i, tc, lerp(c.p.x, C.x, 0.7), lerp(c.p.y, C.y, 0.7)); k(def, c.i, tE + 0.15 + (dist > 14 ? 0.2 : 0), E.x + d * (1.3 + j * 0.7) * (j % 2 ? -1 : 1), E.y + ((j % 3) - 1) * 1.8, true); });
      if (type === 'pass') { k(def, coverIdx, tE, E.x + d * 0.8, E.y + 0.8, true); }
      if (type === 'int') { // defender returns it
        const ret = Math.max(0, +(play.ret != null ? play.ret : 8)), RE = { x: clamp(C.x - d * ret, -3, 103), y: clampY(C.y + (R() - 0.5) * 10) }, tI = tc + Math.max(0.7, ret / 6.8); E = RE; tE = tI;
        k(def, coverIdx, tI, RE.x, RE.y, true);
        const dd = def; // offense converges on the returner
        [5, 6, 7, 8, 9, 10, 0, 1, 2, 3, 4].forEach((s, j) => { const p = O(s), cp = K[off][s]; k(off, s, tc + 0.3, lerp(p.x, C.x, 0.4), lerp(p.y, C.y, 0.4)); k(off, s, tI + 0.1, RE.x - d * (1.2 + j * 0.5) * (j % 2 ? 1 : -0.6), RE.y + ((j % 4) - 1.5) * 1.6, true); });
        ball.push({ t0: TS, t1: TS + 0.3, fly: { a: () => ({ x: sp, y: yb }), b: cpos(off, 5), h: 0.3 } }); ball.push({ t0: TS + 0.3, t1: tr, carry: { tm: off, i: 5 } });
        ball.push({ t0: tr, t1: tc, fly: { a: cpos(def === 'x' ? off : off, 5), b: cpos(def, coverIdx), h: 3 + Math.hypot(C.x - qd.x, C.y - qd.y) * 0.12 } }); ball.push({ t0: tc, t1: tI + 1, carry: { tm: def, i: coverIdx } });
        const roles = { [off + 5]: names.passer, [def + coverIdx]: names.interceptor || tNames[0] || '' }; if (names.receiver) roles[off + rs] = names.receiver;
        return fin(roles, tI + 1.0, K, ball, F, off, def, { tm: def, i: coverIdx }, play, E, sp, yb, true);
      }
      ball.push({ t0: TS, t1: TS + 0.3, fly: { a: () => ({ x: sp, y: yb }), b: cpos(off, 5), h: 0.3 } }); ball.push({ t0: TS + 0.3, t1: tr, carry: { tm: off, i: 5 } });
      const flyH = 3 + Math.hypot(C.x - qd.x, C.y - qd.y) * 0.13;
      k(off, 5, tr + 0.5, qd.x + d * 0.8, qd.y);
      if (type === 'pass') { ball.push({ t0: tr, t1: tc, fly: { a: cpos(off, 5), b: cpos(off, rs), h: flyH } }); ball.push({ t0: tc, t1: tE + 1, carry: { tm: off, i: rs } }); carrierKey = { tm: off, i: rs }; }
      else { const L = { x: C.x + d * (2.2 + R() * 2), y: clampY(C.y + (R() - 0.5) * 3) }; ball.push({ t0: tr, t1: tc + 0.45, fly: { a: cpos(off, 5), b: () => L, h: flyH } }); ball.push({ t0: tc + 0.45, t1: tc + 0.9, bounce: { p: L } }); tE = tc + 0.9; E = L; }
      blockers(tE, 2);
      const roles = { [off + 5]: names.passer }; if (names.receiver) roles[off + rs] = names.receiver; if (type === 'pass') (tNames || []).forEach(n => { roles[def + coverIdx] = n; });
      return fin(roles, tE + 0.9, K, ball, F, off, def, carrierKey, play, type === 'inc' ? { x: sp, y: yb } : E, sp, yb);
    }

    if (type === 'fg' || type === 'punt' || type === 'kick') {
      const isFg = type === 'fg', hold = O(6), kick = O(5), gp = d > 0 ? 110 : -10, good = play.good !== false;
      if (isFg) { k(off, 6, TS + 0.2, hold.x, hold.y); kick.x = sp - d * 8.6; k(off, 5, TS + 0.5, kick.x - d * 1.2, kick.y); k(off, 5, TS + 1.05, kick.x + d * 1.0, kick.y); k(off, 5, TS + 1.35, kick.x + d * 2.4, kick.y, true); }
      else { k(off, 5, TS + 0.3, O(5).x - d * 7, yb); k(off, 5, TS + 0.8, O(5).x - d * 7, yb); k(off, 5, TS + 1.0, O(5).x - d * 6.3, yb); k(off, 5, TS + 1.4, O(5).x - d * 5.2, yb, true); }
      if (isFg) {
        const post = { x: gp, y: 26.65 + (good ? (R() - 0.5) * 1.6 : (R() < 0.5 ? -1 : 1) * (2.6 + R() * 2)) }, tk = TS + 1.05, fl = 0.9 + Math.hypot(post.x - sp, 0) / 45;
        ball.push({ t0: TS, t1: TS + 0.4, fly: { a: () => ({ x: sp, y: yb }), b: t => ({ x: hold.x, y: hold.y }), h: 0.2 } }); ball.push({ t0: TS + 0.4, t1: tk, hold: { x: hold.x, y: hold.y } });
        ball.push({ t0: tk, t1: tk + fl, fly: { a: () => ({ x: hold.x, y: hold.y }), b: () => post, h: 13 } }); ball.push({ t0: tk + fl, t1: tk + fl + 1, hold: post });
        F.def.forEach((p, i) => { if (i < 9) { k(def, i, TS + 1.0, p.x + d * 0.3, p.y); k(def, i, tk + 0.8, p.x + d * (0.2 + (i % 3) * 0.6), p.y + (i - 4) * 0.15, true); } });
        return fin({ [off + 5]: names.kicker }, tk + fl + 1.0, K, ball, F, off, def, null, play, { x: sp, y: yb }, sp, yb, false, true);
      }
      const L = { x: clamp(play.ep != null ? play.ep : sp + d * 42, -8, 108), y: clampY(26.65 + (R() - 0.5) * 20) }, pk = { x: O(5).x - d * 5.2, y: yb }, tk = TS + 1.4, fl = 1.7 + Math.abs(L.x - sp) / 38, ret = D(10), tl = tk + fl;
      ball.push({ t0: TS, t1: TS + 0.6, fly: { a: () => ({ x: sp, y: yb }), b: () => ({ x: pk.x + d * 1.4, y: pk.y }), h: 0.8 } }); ball.push({ t0: TS + 0.6, t1: tk - 0.05, hold: { x: pk.x + d * 1.4, y: pk.y } });
      ball.push({ t0: tk - 0.05, t1: tl, fly: { a: () => ({ x: pk.x + d * 1.4, y: pk.y }), b: cpos(def, 10), h: 20 } });
      const rt = (names.returner ? 1 : 0); k(def, 10, tk + fl * 0.6, L.x + d * 6, L.y); k(def, 10, tl - 0.1, L.x + d * 0.5, L.y, true); k(def, 9, tl + 0.2, L.x + d * 4, L.y + 6, true);
      F.def.forEach((p, i) => { if (i < 9) { k(def, i, TS + 1.1, p.x, p.y); k(def, i, tl + 0.3, L.x + d * (4 + (i % 4) * 1.4), clampY(L.y + (i - 4) * 3), true); } });
      [0, 1, 2, 3, 4, 7, 8, 9, 10].forEach((s, j) => { k(off, s, tk, O(s).x, O(s).y); k(off, s, tl, lerp(O(s).x, L.x, 0.92), clampY(lerp(O(s).y, L.y, 0.5) + (j - 4) * 1.2), true); });
      ball.push({ t0: tl, t1: tl + 1, carry: { tm: def, i: 10 } });
      return fin({ [off + 5]: names.kicker, [def + 10]: names.returner }, tl + 1.0, K, ball, F, off, def, { tm: def, i: 10 }, play, L, sp, yb);
    }
    // anything else (penalty, timeout, kneel): line up and set the ball
    return fin({}, TS + 0.8, K, [{ t0: 0, t1: 99, hold: { x: sp, y: yb } }], F, off, def, null, play, { x: sp, y: yb }, sp, yb);
  }
  function finish(roles, dur, K, ball, F, off, def, carrier, play, E, sp, yb, flip, noEnd) {
    ['home', 'away'].forEach(tm => K[tm].forEach((kf, i) => { // nobody outruns a human: shorten any leg that is too fast (the ball carrier and named players get more room)
      const named = roles[tm + i], mine = carrier && carrier.tm === tm && carrier.i === i, vmax = mine ? 11 : named ? 11 : 8.5; kf.sort((a, b) => a.t - b.t);
      for (let j = 1; j < kf.length; j++) { const a = kf[j - 1], b = kf[j], dt = Math.max(b.t - a.t, 0.05), dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), mx = vmax * dt; if (dist > mx) { b.x = a.x + dx * mx / dist; b.y = a.y + dy * mx / dist; } }
    }));
    const P = { home: K.home.map(track), away: K.away.map(track) };
    return { K, dur, roles, carrier, F, off, def, endAt: E, sp, yb, flip: !!flip, paths: P, ball, play,
      ballAt(t) {
        let ph = ball.find(p => t >= p.t0 && t < p.t1) || ball[ball.length - 1], v = t >= ph.t1 ? 1 : 0;
        if (ph.hold) return { x: ph.hold.x, y: ph.hold.y, h: 0 };
        if (ph.carry) { const p = P[ph.carry.tm][ph.carry.i](t); return { x: p.x + 0.45 * (off === 'home' ? 1 : -1), y: p.y + 0.35, h: 0, carried: true }; }
        if (ph.bounce) { const u = clamp((t - ph.t0) / (ph.t1 - ph.t0), 0, 1); return { x: ph.bounce.p.x, y: ph.bounce.p.y, h: Math.abs(Math.sin(u * Math.PI * 2)) * 0.9 * (1 - u) }; }
        const u = clamp((t - ph.t0) / (ph.t1 - ph.t0), 0, 1), a = ph.fly.a(ph.t0), b = ph.fly.b(ph.t1), uu = u;
        return { x: lerp(a.x, b.x, uu), y: lerp(a.y, b.y, uu), h: Math.sin(uu * Math.PI) * ph.fly.h + 0.5, flying: ph.fly.h > 2, from: a, to: b, u };
      } };
  }

  /* ---------- scenes: one SVG per view; each draws the same world ---------- */
  function makeScene(host, o) {
    const V = o.orient === 'v', kY = o.kY || 1, kL = o.kL || 1;
    const P = (x, y) => V ? [y * 10, (110 - x) * 10 * kL] : [(x + 10) * 10, y * 10 * kY];
    const W = V ? 533 : 1200, H = V ? 1200 * kL : 533 * kY, svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fv-svg', role: 'img', 'aria-label': 'Football field' }, host), g = el('g', {}, svg);
    const home = o.home, away = o.away;
    el('rect', { x: 0, y: 0, width: W, height: H, fill: o.grass1 || '#2A7A38' }, g);
    for (let x = 0; x < 100; x += 10) { const a = P(x, 0), b = P(x + 10, 53.3); el('rect', { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]), fill: '#fff', opacity: (x / 10) % 2 ? 0.045 : 0 }, g); }
    const ez = (x0, x1, t, left) => { const a = P(x0, 0), b = P(x1, 53.3), r = el('rect', { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]), fill: t.color, opacity: 0.96 }, g); const c = P((x0 + x1) / 2, 26.65), tx = el('text', { x: c[0], y: c[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'fv-ez', transform: V ? '' : `rotate(${left ? -90 : 90} ${c[0]} ${c[1]})` }, g); tx.textContent = t.name.toUpperCase(); if (V) tx.style.fontSize = '60px'; return r; };
    ez(-10, 0, home, true); ez(100, 110, away, false);
    for (let x = 0; x <= 100; x += 5) { const a = P(x, 0), b = P(x, 53.3); el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#fff', 'stroke-opacity': x % 10 === 0 ? 0.8 : 0.32, 'stroke-width': x === 0 || x === 100 ? 5 : 2 }, g); }
    for (let x = 1; x < 100; x++) if (x % 5) [23.6, 29.7].forEach(y => { const a = P(x, y - 0.5), b = P(x, y + 0.5); el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#fff', 'stroke-opacity': 0.3 }, g); });
    for (let x = 10; x <= 90; x += 10) { const n = x <= 50 ? x : 100 - x; [9, 44.3].forEach(y => { const c = P(x, y), t = el('text', { x: c[0], y: c[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'fv-yd' }, g); t.textContent = n; }); }
    [0, 100].forEach(x => { const a = P(x + (x ? 10 : -10) * 1, 24.6), b = P(x + (x ? 10 : -10), 28.7); el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#FFD21F', 'stroke-width': 5 }, g); });
    const red = el('rect', { fill: '#E0201B', opacity: 0 }, g), trail = el('rect', { rx: 8, opacity: 0.32 }, g), los = el('line', { stroke: '#2F6BFF', 'stroke-width': 5, opacity: 0 }, g), fd = el('line', { stroke: '#FFD21F', 'stroke-width': 6, opacity: 0 }, g);
    const pg = el('g', {}, g), ballG = el('g', { opacity: 0 }, g), shadow = el('ellipse', { rx: 9, ry: 5.5, fill: '#000', opacity: 0.35 }, ballG), ball = el('ellipse', { rx: 10, ry: 6.3, fill: '#7A3E12', stroke: '#fff', 'stroke-width': 1.8 }, ballG), lace = el('path', { d: 'M-4 0h8', stroke: '#fff', 'stroke-width': 1.5 }, ballG);
    const arc = el('path', { fill: 'none', stroke: '#fff', 'stroke-width': 2.5, 'stroke-dasharray': '4 6', opacity: 0 }, g);
    const dots = { home: [], away: [] }, fs = o.labelPx || 11;
    ['home', 'away'].forEach(tm => { for (let i = 0; i < 11; i++) { const gg = el('g', {}, pg), c = el('circle', { r: o.dot || 9.5, fill: (tm === 'home' ? home : away).color, stroke: '#fff', 'stroke-width': 2.2 }, gg), lab = el('g', { opacity: 0 }, gg), bg = el('rect', { rx: 8, fill: '#111', opacity: 0.82 }, lab), tx = el('text', { class: 'fv-lab', 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff' }, lab); dots[tm].push({ gg, c, lab, bg, tx }); } });
    const sc = { svg, P, V, W, H, o, g, dots, ball: { g: ballG, e: ball, s: shadow, l: lace }, red, trail, los, fd, arc,
      unit() { const w = host.clientWidth || W; return (sc.vw || W) / w; },
      draw(st) {
        const u = sc.unit(), fz = fs * u * (o.labelScale || 1);
        ['home', 'away'].forEach(tm => st.players[tm].forEach((p, i) => { const d = dots[tm][i], q = P(p.x, p.y); d.gg.setAttribute('transform', `translate(${q[0].toFixed(1)} ${q[1].toFixed(1)})`); d.c.setAttribute('r', (o.dot || 9.5) * (p.carrier ? 1.25 : 1)); d.c.setAttribute('stroke', p.carrier ? '#FFD21F' : '#fff');
          if (p.name && o.labels !== false) { d.lab.setAttribute('opacity', 1); const t = o.fullNames ? p.name : shortName(p.name), w = t.length * fz * 0.58 + fz * 1.1; if (d.tx.textContent !== t) d.tx.textContent = t; d.tx.style.fontSize = fz.toFixed(1) + 'px'; d.bg.setAttribute('width', w.toFixed(1)); d.bg.setAttribute('height', (fz * 1.7).toFixed(1)); d.bg.setAttribute('x', (-w / 2).toFixed(1)); d.bg.setAttribute('y', (-fz * 0.85).toFixed(1));
            const up = p.lab === 'down' ? 1 : -1, VB = sc.vb || { x: 0, y: 0, w: W, h: H }, dx = clamp(q[0], VB.x + w / 2 + 4, VB.x + VB.w - w / 2 - 4) - q[0], oy = up * ((o.dot || 9.5) * (p.carrier ? 1.25 : 1) + fz * 1.15), dy = clamp(q[1] + oy, VB.y + fz, VB.y + VB.h - fz) - q[1] - oy; d.lab.setAttribute('transform', `translate(${dx.toFixed(1)} ${(oy + dy).toFixed(1)})`); } else d.lab.setAttribute('opacity', 0); }));
        const b = st.ball, bq = P(b.x, b.y); ballG.setAttribute('opacity', b.vis === false ? 0 : 1);
        const hs = (o.ballK || 1) * (1 + b.h * 0.09), ang = Math.atan2(st.vy || 0, st.vx || 1) * 180 / Math.PI;
        ball.setAttribute('transform', `translate(${bq[0]} ${bq[1] - b.h * 6}) rotate(${V ? 90 : 0}) scale(${hs})`); lace.setAttribute('transform', `translate(${bq[0]} ${bq[1] - b.h * 6}) rotate(${V ? 90 : 0}) scale(${hs})`);
        shadow.setAttribute('rx', 9 * (o.ballK || 1)); shadow.setAttribute('ry', 5.5 * (o.ballK || 1)); shadow.setAttribute('cx', bq[0] + b.h * 2); shadow.setAttribute('cy', bq[1] + 2); shadow.setAttribute('opacity', clamp(0.35 - b.h * 0.012, 0.1, 0.35));
        if (st.arc) { const a = P(st.arc.a.x, st.arc.a.y), c = P(st.arc.b.x, st.arc.b.y), m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 - st.arc.h * 7]; arc.setAttribute('d', `M${a[0]} ${a[1]}Q${m[0]} ${m[1]} ${c[0]} ${c[1]}`); arc.setAttribute('opacity', 0.55); } else arc.setAttribute('opacity', 0);
      },
      lines(s) { // line of scrimmage, first down line, drive trail, red zone
        const set = (ln, x, op) => { if (x == null) { ln.setAttribute('opacity', 0); return; } const a = P(x, 0), b = P(x, 53.3); ln.setAttribute('x1', a[0]); ln.setAttribute('y1', a[1]); ln.setAttribute('x2', b[0]); ln.setAttribute('y2', b[1]); ln.setAttribute('opacity', op); };
        set(los, s.los, 1); set(fd, s.fd, s.fd == null ? 0 : 1);
        if (s.driveFrom != null && s.los != null) { const a = P(Math.min(s.driveFrom, s.los), 26.65 - 2.2), b = P(Math.max(s.driveFrom, s.los), 26.65 + 2.2); trail.setAttribute('x', Math.min(a[0], b[0])); trail.setAttribute('y', Math.min(a[1], b[1])); trail.setAttribute('width', Math.abs(b[0] - a[0]) || 0); trail.setAttribute('height', Math.abs(b[1] - a[1]) || 0); trail.setAttribute('fill', s.driveColor || '#FF8200'); trail.setAttribute('opacity', 0.3); } else trail.setAttribute('opacity', 0);
        if (s.red != null) { const x0 = s.red > 0 ? 80 : 0, a = P(x0, 0), b = P(x0 + 20, 53.3); red.setAttribute('x', Math.min(a[0], b[0])); red.setAttribute('y', Math.min(a[1], b[1])); red.setAttribute('width', Math.abs(b[0] - a[0])); red.setAttribute('height', Math.abs(b[1] - a[1])); red.setAttribute('opacity', 0.14); } else red.setAttribute('opacity', 0);
      } };
    return sc;
  }

  /* ---------- the viewer ---------- */
  function mount(host, opts) {
    opts = Object.assign({ style: 'broadcast', speed: 1 }, opts);
    host.classList.add('fv', 'fv-style-' + opts.style); host.innerHTML = '';
    const scenes = [], mk = (cls, o) => { const w = document.createElement('div'); w.className = cls; host.appendChild(w); const s = makeScene(w, Object.assign({ home: opts.home, away: opts.away }, o)); s.wrap = w; scenes.push(s); return s; };
    let lens = null, mini = null, main = null;
    if (opts.style === 'vertical') main = mk('fv-view fv-view-main', { orient: 'v', kL: 0.74, labelPx: 12, dot: 10, ballK: 1.2 });
    else if (opts.style === 'lens') {
      mini = mk('fv-view fv-view-mini', { orient: 'h', kY: 1.25, labels: false, dot: 11, ballK: 1.5 });
      lens = mk('fv-view fv-view-lens', { orient: 'h', kY: 0.92, labelPx: 12, dot: 10, fullNames: true, ballK: 1.1 });
      lens.win = el('rect', { fill: 'none', stroke: '#fff', 'stroke-width': 4, rx: 8, opacity: 0.85 }, mini.g);
    } else main = mk('fv-view fv-view-main', { orient: 'h', kY: opts.tall || 1.5, labelPx: 12, dot: 14, ballK: 1.7 });
    const state = { players: { home: [], away: [] }, ball: { x: 50, y: 26.65, h: 0, vis: false } }, cur = { home: [], away: [] }, q = []; let running = null, t0 = 0, last = performance.now(), cam = { x: 50, y: 26.65 }, speed = opts.speed, lines = {}, stopped = false, id = null, driveFrom = null, lastOff = null;
    for (const tm of ['home', 'away']) for (let i = 0; i < 11; i++) { state.players[tm].push({ x: 50, y: 26.65 }); cur[tm].push({ x: 50, y: 26.65 }); }
    const api = {
      speed(v) { speed = v; }, stop() { stopped = true; cancelAnimationFrame(id); },
      play(p) { q.push(p); if (!running) next(); },
      queued() { return q.length + (running ? 1 : 0); },
      trim(n) { while (q.length > n) q.shift(); },
      // line up at a spot with no play (start of a game, a drive)
      setup(p) { const f = (p.special ? specialForm : formation)(p.sp, p.y0 || 26.65, p.off === 'home' ? 1 : -1); ['off', 'def'].forEach(r => f[r].forEach((pt, i) => { const tm = r === 'off' ? p.off : (p.off === 'home' ? 'away' : 'home'); cur[tm][i] = { x: pt.x, y: pt.y }; state.players[tm][i] = { x: pt.x, y: pt.y }; })); state.ball = { x: p.sp, y: p.y0 || 26.65, h: 0, vis: true }; lines = { los: p.sp, fd: p.fd, red: null }; scenes.forEach(s => s.lines(lines)); frame(performance.now(), true); }
    };
    function next() {
      const p = q.shift(); if (!p) { running = null; opts.onIdle && opts.onIdle(); return; }
      const tl = build(p, cur, opts); running = tl; t0 = null; const d = p.off === 'home' ? 1 : -1; if (lastOff !== p.off) { driveFrom = p.sp; lastOff = p.off; }
      lines = { los: p.sp, fd: p.fd != null ? p.fd : null, driveFrom, driveColor: p.off === 'home' ? opts.home.color : opts.away.color, red: (p.off === 'home' ? p.sp >= 80 : p.sp <= 20) ? (p.off === 'home' ? 1 : -1) : null }; scenes.forEach(s => s.lines(lines));
      opts.onPlay && opts.onPlay(p);
    }
    function frame(now, still) {
      if (stopped) return; const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (running) {
        if (t0 == null) t0 = now; const t = (now - t0) / 1000 * speed, tl = running, c = tl.carrier;
        ['home', 'away'].forEach(tm => { for (let i = 0; i < 11; i++) { const p = tl.paths[tm][i](t); state.players[tm][i] = { x: p.x, y: p.y, name: tl.roles[tm + i] || '', carrier: !!(c && c.tm === tm && c.i === i && t > tl.TS + 0.3), lab: (i % 2) ? 'down' : 'up' }; cur[tm][i] = { x: p.x, y: p.y }; } });
        const b = tl.ballAt(t); state.ball = { x: b.x, y: b.y, h: b.h, vis: true }; state.arc = b.flying && b.u < 0.98 ? { a: b.from, b: b.to, h: b.h * 1.4 } : null;
        if (t > tl.dur) { // done: move the line of scrimmage to where the play ended
          if (tl.endAt) { const dirOff = tl.play.off === 'home' ? 1 : -1; lines = Object.assign({}, lines, { los: clamp(tl.endAt.x, 0, 100) }); lines.fd = lines.fd != null ? lines.fd : null; scenes.forEach(s => s.lines(lines)); }
          opts.onEnd && opts.onEnd(tl.play); running = null; next();
        }
      }
      scenes.forEach(s => { if (s.wrap.offsetParent !== null || still) s.draw(state); });
      if (lens) { // the camera eases toward the ball and never shows past the end zones
        const b = state.ball, k = 1 - Math.exp(-dt * 3.2); cam.x += (b.x - cam.x) * k; cam.y += (b.y - cam.y) * k;
        const vw = 500, w = lens.wrap.clientWidth || 360, h = lens.wrap.clientHeight || 340, vh = vw * h / w, ctr = lens.P(clamp(cam.x, 20, 80), 26.65), x0 = clamp(ctr[0] - vw / 2, 0, lens.W - vw), y0 = clamp((lens.H - vh) / 2, 0, Math.max(0, lens.H - vh));
        lens.vw = vw; lens.vb = { x: x0, y: y0, w: vw, h: vh }; lens.svg.setAttribute('viewBox', `${x0.toFixed(1)} ${y0.toFixed(1)} ${vw} ${vh.toFixed(1)}`); lens.svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        lens.win.setAttribute('x', x0.toFixed(1)); lens.win.setAttribute('y', 3); lens.win.setAttribute('width', vw); lens.win.setAttribute('height', mini.H - 6);
      }
      if (!still) id = requestAnimationFrame(frame);
    }
    id = requestAnimationFrame(frame);
    return api;
  }
  window.FieldViz = { mount, shortName, _build: build };
})();
