/* The Vol Index — Hoops Dynasty: the live court, in the style of a tracking view (think NBA Pulse or a 2K sim cast).
   Each possession from the engine is played out by a small motion simulation: ten players steering with real speeds and
   acceleration, a defense that reacts every tick, and offensive actions (the break, drag screens, ball screens, screens
   away, cuts, drives, kick-outs, post-ups) that lead into the shot, the contest and the rebound. Positions are in feet
   on a 94 x 50 court. View only: it never touches the game's seeded random numbers. */
(function (root) {
  'use strict';
  const SD = root.SD;
  const SDC = root.SDC = {};
  const other = s => s === 'h' ? 'a' : 'h';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);      // the view only: never touches the game's seeded random numbers
  const ORDER = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
  const byPos = ids => ids.slice().sort((a, b) => (ORDER[SD.P(a).pos] ?? 5) - (ORDER[SD.P(b).pos] ?? 5));

  /* ---------- geometry for one possession ---------- */
  function frameOf(GM, s, per) {
    const half2 = GM.nper === 2 ? per >= 2 : per >= 3;
    const right = (s === 'h') !== half2;
    const bx = right ? 88.75 : 5.25, sg = right ? -1 : 1;
    const P = (dx, y) => [bx + sg * dx, clamp(y, 1.5, 48.5)];
    return { right, bx, sg, P, rim: [bx, 25] };
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const toward = (a, b, ft) => { const d = dist(a, b) || 1; return [a[0] + (b[0] - a[0]) / d * ft, a[1] + (b[1] - a[1]) / d * ft]; };

  /* ---------- the motion engine ----------
     Every player is an agent with a position and a velocity. Each tick he steers toward a target (a spot, a moving point,
     a path of waypoints) with a top speed and an acceleration limit, so he speeds up, slows down and curves like a person
     instead of sliding between keyframes. Defenders are never scripted: each tick they work out where to stand from where
     their man, the ball and the rim are (man), from the ball (zone) or full court (press). The offense runs real actions:
     the ball up the floor, lanes filled on the break, a drag screen on the secondary break, ball reversal, screens away,
     basket cuts, ball screens, drives that pull help, kick-outs, post-ups, clear-outs; then the shot, the contest, the
     crash and the outlet. Possessions chain: positions and velocities carry over, so a rebound turns straight into the
     other team running the other way. The whole possession is simulated up front at 30 ticks a second. */
  const DT = 1 / 30;
  SDC._vel = {}; SDC._after = 'live';
  const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const unit = (a, b) => { const d = dist(a, b) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };

  SDC.choreo = (GM, r, from) => {
    const s = r.s, d = other(s), F = frameOf(GM, s, r.per), P = F.P, rim = F.rim, sg = F.sg;
    const O = byPos(GM.on[s]), D = byPos(GM.on[d]), all = O.concat(D);
    const isO = {}; O.forEach(x => { isO[x] = 1; });
    const id = p => p && p.id;
    const isBig = x => { const p = SD.P(x); return p && (p.pos === 'C' || p.pos === 'PF'); };
    const shooter = id(r.shooter), passer0 = id(r.ast) || id(r.passer);
    const cd = GM.coach[d] || {}, zone = cd.def === 'zone', press = cd.def === 'press';
    const five = r.play === 'spot' || (GM.coach[s] || {}).focus === 'three' || !O.some(isBig);
    const dxOf = p => (p[0] - F.bx) * sg;                                   // feet from the rim we attack, along the floor
    const frames = []; let t = 0;
    // ---- agents
    const A = {};
    all.forEach(x => {
      const p = from && from[x] ? from[x].slice() : [47 + rnd(-5, 5), 51.5];
      A[x] = { p, v: (SDC._vel[x] || [0, 0]).slice(), go: null, path: null, spd: 13, acc: 30, slow: 0, ph: rnd(0, 6.3) };
    });
    // ---- the ball
    const B = { hold: null, p: (from && from._ball ? from._ball : [47, 25]).slice(), z: 0, fl: null, dr: true };
    const after = SDC._after || 'live';
    let H = from && from._hold != null && isO[from._hold] ? +from._hold : null;
    const nearestO = pt => O.slice().sort((a, b) => dist(A[a].p, pt) - dist(A[b].p, pt))[0];
    // ---- offensive spacing (slots) and the defense
    const SP = five ? [[25, 25], [21, 7], [21, 43], [1.6, 2.6], [1.6, 47.4]] : [[25, 25], [21, 7], [21, 43], [1.6, 47.4], [4.5, 17]];
    const slot = {}; O.forEach((x, i) => { slot[x] = i; });
    const slotPt = x => { const sp = SP[slot[x]], a = A[x]; return P(sp[0] + Math.sin(t * 0.9 + a.ph) * 0.9, sp[1] + Math.cos(t * 0.7 + a.ph) * 1.1); };
    const ZONE = [[19, 17], [19, 33], [6, 9], [6, 41], [3.5, 25]];
    let defMode = 'live';            // live (man / zone / press by the coach), box (box out), ft, whistle
    let pressOn = press && (after === 'inb' || after === 'dead');
    const manOf = x => O[D.indexOf(x)];
    const defOf = x => D[O.indexOf(x)];
    const ballPt = () => B.p;
    function defTarget(x) {
      const a = A[x], man = manOf(x), mp = man != null ? A[man].p : P(20, 25), bp = ballPt();
      if (defMode === 'box') return toward(mp, rim, Math.min(2.6, dist(mp, rim) * 0.5));
      const onBall = B.hold === man;
      if (zone && !pressOn && dxOf(bp) < 42) {
        const z = P(ZONE[D.indexOf(x)][0], ZONE[D.indexOf(x)][1]);
        let p = lerp2(z, bp, 0.22);
        if (onBall || (dist(mp, z) < 7 && dist(mp, bp) < 4)) p = toward(mp, rim, 3);       // step up to the ball in your area
        return p;
      }
      if (pressOn) {
        if (onBall) return toward(mp, rim, 2.4);
        return lerp2(toward(mp, rim, 3), bp, 0.15);
      }
      const dm = dxOf(mp);
      if (dm > 36) {
        // no full-court pressure: get back first, meet them around the top of the key, stay on the line to the rim
        const want = 36 + (dm - 36) * 0.25; return lerp2(mp, rim, (dm - want) / dm);
      }
      const db = dist(mp, bp), gap = onBall ? 3.3 : db < 18 ? 3.8 : 4.6;
      let p = toward(mp, rim, Math.min(gap, dist(mp, rim) * 0.5));
      if (!onBall) {
        if (db < 18) p = toward(p, bp, 1.2);                                                   // one pass away: in the passing lane
        else { const w = clamp((db - 18) / 22, 0, 1) * 0.24; p = lerp2(p, lerp2(bp, rim, 0.6), w); }   // help side: sink a step or two
      }
      return p;
    }
    function target(x) {
      const a = A[x];
      if (a.path && a.path.length) {
        let q = a.path[0]; if (typeof q === 'function') q = q();
        if (dist(a.p, q) < (a.path.length > 1 ? 2.2 : 0.4) && a.path.length > 1) { a.path.shift(); q = a.path[0]; if (typeof q === 'function') q = q(); }
        return q;
      }
      if (a.go) return typeof a.go === 'function' ? a.go() : a.go;
      if (isO[x]) return slotPt(x);
      return defTarget(x);
    }
    const handPt = x => { const a = A[x], sp = Math.hypot(a.v[0], a.v[1]); const u = sp > 1.5 ? [a.v[0] / sp, a.v[1] / sp] : unit(a.p, rim); return [a.p[0] + u[0] * 0.8 - u[1] * 0.7, a.p[1] + u[1] * 0.8 + u[0] * 0.7]; };
    function tick(mark) {
      // steer
      for (const x of all) {
        const a = A[x], T = target(x), dv = [T[0] - a.p[0], T[1] - a.p[1]], dd = Math.hypot(dv[0], dv[1]);
        let vmax = a.spd;
        if (!isO[x]) vmax = Math.max(vmax, dd > 9 ? 19 : 14);                            // defenders react at game speed
        if (a.slow > t) vmax = Math.min(vmax, a.slowTo);                                  // caught on a screen
        if (defMode === 'whistle') vmax = Math.min(vmax, 3);
        const sp = Math.min(vmax, dd * 2.3), want = dd < 0.05 ? [0, 0] : [dv[0] / dd * sp, dv[1] / dd * sp];
        let ax = want[0] - a.v[0], ay = want[1] - a.v[1]; const am = Math.hypot(ax, ay), lim = a.acc * DT;
        if (am > lim) { ax *= lim / am; ay *= lim / am; }
        a.v[0] += ax; a.v[1] += ay;
      }
      // move, then keep bodies apart
      for (const x of all) { const a = A[x]; a.p[0] = clamp(a.p[0] + a.v[0] * DT, -3, 97); a.p[1] = clamp(a.p[1] + a.v[1] * DT, -2.5, 52.5); }
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = A[all[i]], b = A[all[j]], dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dd = Math.hypot(dx, dy) || 0.01, need = 2.3;
        if (dd < need) { const push = (need - dd) * 0.5, ux = dx / dd, uy = dy / dd; a.p[0] -= ux * push; a.p[1] -= uy * push; b.p[0] += ux * push; b.p[1] += uy * push; }
      }
      // the ball
      if (B.fl) {
        const f = B.fl, u = clamp((t + DT - f.t0) / f.dur, 0, 1), dest = f.to != null ? handPt(f.to) : f.at;
        B.p = lerp2(f.from, dest, u); B.z = f.z0 + (f.z1 - f.z0) * u + f.arc * 4 * u * (1 - u);
        if (u >= 1) { B.fl = null; B.hold = f.to != null ? f.to : null; if (f.done) f.done(); }
      } else if (B.hold != null) {
        B.p = handPt(B.hold); const sp = Math.hypot(A[B.hold].v[0], A[B.hold].v[1]);
        B.z = B.dr && sp > 1 ? Math.abs(Math.sin(t * (8 + sp * 0.35))) * 1.5 : 1.8;
      } else { B.z = Math.max(0, B.z - 0.4); }
      t += DT;
      const pos = {}; for (const x of all) pos[x] = [Math.round(A[x].p[0] * 100) / 100, Math.round(A[x].p[1] * 100) / 100];
      const fr = { t, pos, ball: B.p.slice(), z: B.z, hold: B.hold }; if (mark) fr.mark = mark;
      frames.push(fr);
    }
    const run = (sec, until) => { const end = t + sec; while (t < end - 1e-6) { tick(); if (until && until()) break; } };
    const go = (x, pt, spd) => { if (x == null) return; A[x].path = null; A[x].go = pt; A[x].st = false; if (spd) A[x].spd = spd; };
    const pathTo = (x, pts, spd) => { if (x == null) return; A[x].path = pts.slice(); A[x].go = pts[pts.length - 1]; if (spd) A[x].spd = spd; };
    const free = (x, spd) => { if (x == null) return; A[x].path = null; A[x].go = null; A[x].st = false; A[x].spd = spd || 13; };
    const freeAll = spd => all.forEach(x => free(x, spd));
    const stay = x => { go(x, A[x].p.slice(), 4); A[x].st = true; };
    const slowDown = (x, to, sec) => { if (x == null) return; A[x].slow = t + sec; A[x].slowTo = to; };
    function pass(to, opt) {
      if (to == null || B.hold === to) return;
      const o = opt || {}, fromP = B.hold != null ? handPt(B.hold) : B.p.slice(), dd = dist(fromP, A[to].p);
      B.fl = { from: fromP, z0: B.z || 1.8, z1: 1.8, to, t0: t, dur: clamp(dd / (o.v || 42), 0.22, 1.05), arc: o.arc != null ? o.arc : Math.min(2.4, dd / 14) };
      const prev = B.hold; B.hold = null; run(B.fl.dur + 0.1, () => !B.fl); H = to; B.dr = true;
      if (prev != null && A[prev].st && isO[prev]) free(prev, 13);          // pass and move: never stand and watch
    }
    const toSpot = (x, spot, spd, max) => { go(x, spot, spd); run(max || 2, () => dist(A[x].p, spot) < 1.2); };
    const atShot = (x, type) => {
      const sp = A[x].p, y = sp[1];
      if (type === 'rim') return P(rnd(2, 4), 25 + clamp((y - 25) * 0.25, -3.5, 3.5) + rnd(-1, 1));
      if (type === 'mid') { const ang = Math.atan2(y - 25, Math.max(3, dxOf(sp))); const rr = rnd(11, 16); return P(Math.max(3, rr * Math.cos(ang)), 25 + rr * Math.sin(ang)); }
      if (Math.abs(y - 25) > 17 && dxOf(sp) < 10) return P(1.6, y < 25 ? 2.6 : 47.4);   // a corner three
      const ang = Math.atan2(y - 25, Math.max(4, dxOf(sp))); return P(23.6 * Math.cos(ang), 25 + 23.6 * Math.sin(ang));
    };
    // ---------------- 0: the start of the possession ----------------
    let flow = r.kind === 'ft' && !r.type ? 'half' : (r.flow || 'half');
    if (r.kind === 'to' || r.kind === 'foul') flow = after === 'live' && r.thief && GM.trans ? 'early' : 'half';
    freeAll(12);
    const handler = O[0];
    if (after === 'inb' || after === 'dead') {
      // the ball is out of bounds: an inbounder takes it out, the guard comes to get it
      const base = after === 'inb';
      const inb = base ? (O.find(isBig) || O[4]) : O[2];
      // a dead ball: in from the sideline where it happened (frontcourt or backcourt)
      const sdx = clamp(dxOf(B.p), 8, 80), front = !base && sdx < 47, side = B.p[1] < 25 ? -1.4 : 51.4;
      const spot = base ? P(89.6, 25 + clamp(B.p[1] - 25, -5, 5)) : [F.bx + sg * sdx, side];
      B.hold = null; B.fl = null;
      if (base) { go(inb, B.p.slice(), 15); run(1.6, () => dist(A[inb].p, B.p) < 1.6); }
      else { B.p = spot.slice(); go(inb, spot, 16); run(1.6, () => dist(A[inb].p, spot) < 1.2); }
      B.hold = inb; B.dr = false; go(inb, spot, 9); H = inb;
      const recv = inb === handler ? O[1] : handler;
      // the guard comes to the ball (a V-cut: a step away, then back to it)
      const meet = base ? P(76, 25 + (spot[1] > 25 ? -10 : 10)) : [F.bx + sg * clamp(sdx + 6, 10, 88), side < 0 ? 10 : 40];
      pathTo(recv, [toward(meet, P(front ? 10 : 60, 25), 6), meet], 15);
      if (base) O.forEach(x => { if (x !== inb && x !== recv) go(x, P(clamp(dxOf(A[x].p), 45, 70), clamp(A[x].p[1], 6, 44)), 11); });
      else if (front) O.forEach(x => { if (x !== inb && x !== recv) free(x, 12); });            // everyone else in the half-court set
      else O.forEach(x => { if (x !== inb && x !== recv) go(x, P(clamp(sdx - 18, 22, 40), A[x].p[1] * 0.6 + 10), 12); });
      run(1.0, () => dist(A[inb].p, spot) < 1 && dist(A[recv].p, meet) < 2);
      pass(recv); B.dr = true; free(inb, 15);
      O.forEach(x => { if (x !== recv && x !== inb) free(x, 13); });
    } else {
      if (H == null) { H = nearestO(B.p); B.hold = H; }
      else B.hold = H;
    }
    // push it up the floor; a teammate open well ahead of the ball gets it (the ball beats the defense up the court)
    const openFt = x => Math.min(...D.map(d0 => dist(A[d0].p, A[x].p)));
    function hitAhead(max, stopDx) {
      const end = t + max; let passes = 0;
      while (t < end && dxOf(A[H].p) >= stopDx) {
        run(0.2);
        if (passes < 1 && !B.fl && dxOf(A[H].p) > 30) {
          const ahead = O.filter(x => x !== H && dxOf(A[x].p) < dxOf(A[H].p) - 12 && dxOf(A[x].p) > 4 && openFt(x) > 7).sort((a, b) => (a === shooter ? -1 : 0) - (b === shooter ? -1 : 0) || dxOf(A[a].p) - dxOf(A[b].p))[0];
          if (ahead != null) {
            const prev = H; pass(ahead, { v: 52, arc: 3 }); passes++;
            go(ahead, () => P(Math.max(stopDx - 6, dxOf(A[ahead].p) - 6), 25 + (A[ahead].p[1] - 25) * 0.6), 19);
            go(prev, () => P(Math.max(26, dxOf(A[prev].p) - 6), 25 + (A[prev].p[1] - 25) * 0.6), 17);   // the passer trails the play
          }
        }
      }
    }
    // ---------------- 1: up the floor ----------------
    const topSlot = () => { const o = O.find(x => slot[x] === 0); if (o != null && o !== H) { slot[o] = slot[H]; slot[H] = 0; } };
    const ballSide = () => (A[H].p[1] < 25 ? -1 : 1);
    if (H !== handler && isBig(H)) {
      // the outlet: the big who rebounded finds the guard leaking out
      // the guard already up the floor gets a long outlet; one close by comes to the ball on the wing, ahead of it
      if (dist(A[H].p, A[handler].p) < 26) { const side = A[H].p[1] < 25 ? -1 : 1; go(handler, () => [A[H].p[0] - sg * 9, clamp(A[H].p[1] + side * 12, 4, 46)], 17); run(0.55); }
      else { go(handler, () => [A[handler].p[0] - sg * 3, A[handler].p[1]], 12); run(0.25); }
      pass(handler, { v: 50, arc: 2 });
    }
    if (flow === 'trans') {
      // the break: the ball in the middle, wings sprinting wide, the rim runner, the trailer
      const lanes = [[25, 25], [5, 4.5], [5, 45.5], [26, 18], [4, 22]];
      const mid = H;
      O.forEach((x, i) => { if (x !== mid) { const li = x === handler ? 0 : i; go(x, P(lanes[li][0] + rnd(-2, 2), lanes[li][1] + rnd(-1.5, 1.5)), li === 3 ? 16 : 20); } });
      go(mid, () => P(Math.max(14, dxOf(A[H].p) - 6), 25 + (A[mid].p[1] - 25) * 0.8), 19);
      hitAhead(4.5, 22);
    } else if (flow === 'early') {
      // secondary break: push it, fill the lanes, a trailer for a drag screen
      O.forEach((x, i) => { if (x !== H) go(x, slotPt.bind(null, x), i === 4 || i === 3 ? 14 : 17); });
      go(H, () => P(Math.max(26, dxOf(A[H].p) - 8), 25 + (A[H].p[1] - 25) * 0.7), 16);
      hitAhead(5, 30);
    } else {
      // walk it up: everyone into the set, the handler sizes up the defense at the top
      O.forEach(x => { if (x !== H) free(x, 12.5); });
      topSlot(); const tgt = P(28, 25 + ballSide() * rnd(2, 7));
      go(H, tgt, 13.5); run(5, () => dist(A[H].p, tgt) < 3);
      pressOn = false;
      stay(H); run(0.3);
    }
    pressOn = false; topSlot();
    // ---------------- 2: the half court ----------------
    const offBall = () => O.filter(x => x !== H);
    function reversal() {
      const cands = offBall().filter(x => slot[x] <= 2 || (five && slot[x] <= 4)).sort((a, b) => dist(A[a].p, A[H].p) - dist(A[b].p, A[H].p));
      const to = cands[0]; if (to == null) return; const prev = H; stay(H); pass(to); free(prev, 13); stay(to); run(rnd(0.35, 0.6)); free(to, 12);
    }
    function screenAway() {
      const offs = offBall(); if (offs.length < 2) return;
      const a = offs[Math.floor(Math.random() * offs.length)], rest = offs.filter(x => x !== a);
      const b = rest.sort((p, q) => dist(A[p].p, A[a].p) - dist(A[q].p, A[a].p))[0];
      const db = defOf(b);
      go(a, () => toward(A[db].p, A[a].p, 2.3), 13); stay(H); run(1.1, () => dist(A[a].p, A[db].p) < 2.8);
      run(0.25);
      const sa = slot[a]; slot[a] = slot[b]; slot[b] = sa;            // they swap spots: b comes off the screen into a's spot
      const rub = [A[a].p[0] + (A[a].p[0] - A[db].p[0]) * 0.8, A[a].p[1] + (A[a].p[1] - A[db].p[1]) * 0.8];
      pathTo(b, [rub, slotPt.bind(null, b)], 17); slowDown(db, 6, 0.7);
      run(0.5); free(a, 12); A[b].path = [slotPt.bind(null, b)]; run(0.9);
      free(b, 13);
    }
    function cutThrough() {
      const c = offBall().filter(x => slot[x] === 1 || slot[x] === 2)[0]; if (c == null) return;
      const side = A[c].p[1] < 25 ? -1 : 1;
      pathTo(c, [P(15, 25 + side * 9), P(4, 25 + side * 2), P(6, 25 - side * 8), slotPt.bind(null, c)], 16);
      stay(H); run(2.0); free(c, 13); free(H, 12);
    }
    function shuffle() {     // the handler probes: a hard dribble to the wing and back, everyone shifts with him
      const s0 = A[H].p.slice(), side = s0[1] < 25 ? 1 : -1, wing = P(clamp(dxOf(s0) - 4, 18, 28), clamp(s0[1] + side * 11, 6, 44));
      go(H, wing, 12); run(1.2, () => dist(A[H].p, wing) < 1.5); stay(H); run(0.3); free(H, 12);
    }
    if (flow === 'half' || flow === 'call') {
      let n = r.time >= 23 ? 3 : r.time >= 16 ? 2 : r.time >= 9 ? 1 : 0;
      if (r.motion) n += 1;
      if (r.play === 'iso' || r.kind === 'to' || r.kind === 'foul') n = Math.min(n, 1);
      const acts = [reversal, screenAway, reversal, cutThrough, shuffle];
      for (let k = 0; k < n; k++) acts[Math.floor(Math.random() * acts.length)]();
    }
    // ---------------- 3: how it ends ----------------
    const done = () => {
      SDC._vel = {}; for (const x of all) SDC._vel[x] = A[x].v.slice();
      return { kf: frames, T: t, F, ball: B.p.slice(), hold: B.hold };
    };
    // the whistle: a violation, a non-shooting foul
    if ((r.kind === 'to' && !r.thief) || r.kind === 'foul') {
      if (/throws it away|out of bounds/.test(r.text || '')) {
        const out = [clamp(A[H].p[0] + rnd(-8, 8), 4, 90), A[H].p[1] < 25 ? -2 : 52];
        B.fl = { from: handPt(H), z0: 1.8, z1: 0.5, at: out, t0: t, dur: 0.5, arc: 1.5 }; B.hold = null; run(0.55);
      } else if (r.kind === 'foul') { const fd = id(r.fouled); if (fd != null && fd !== H && A[fd]) { go(H, () => toward(A[H].p, rim, 2), 15); run(0.6); } }
      else { go(H, toward(A[H].p, rim, 6), 14); run(0.6); }
      defMode = 'whistle'; all.forEach(x => stay(x)); run(1.0);
      SDC._after = 'dead'; return done();
    }
    // the steal
    if (r.kind === 'to') {
      const thief = id(r.thief), victim = A[id(r.who)] ? id(r.who) : H;
      if (victim !== H) pass(victim);
      if (thief != null && A[thief]) {
        // he jumps the lane or pokes it loose, and he is gone the other way
        go(thief, () => handPt(victim), 21); run(0.6, () => dist(A[thief].p, B.p) < 1.6);
        B.fl = { from: B.p.slice(), z0: B.z, z1: 1.2, to: thief, t0: t, dur: 0.25, arc: 0.6 }; B.hold = null; run(0.3);
        B.dr = true;
        const far = P(70, 25 + rnd(-6, 6));
        go(thief, far, 21);
        D.forEach((x, i) => { if (x !== thief) go(x, P(58 + i * 3, i % 2 ? 10 : 40), 19); });
        O.forEach(x => { go(x, () => toward(A[thief].p, F.bx < 47 ? [94, 25] : [0, 25], 3 + rnd(0, 2)), 19); });
        run(1.2);
      }
      SDC._after = 'live'; return done();
    }
    if (shooter == null || !A[shooter]) { run(1.2); SDC._after = 'live'; return done(); }
    const type = r.type || 'mid';
    if (r.kind === 'ft' && !r.type) { freeThrows(2, clamp(r.pts, 0, 2)); return done(); }
    const helpD = () => D.filter(x => manOf(x) !== shooter).sort((a, b) => dist(A[a].p, rim) - dist(A[b].p, rim))[0];
    // get the ball to the man who makes the play
    const passer = passer0 != null && A[passer0] && passer0 !== shooter ? passer0 : null;
    function feed(x) { if (x != null && x !== H) { stay(H); pass(x); } }
    function drive(x, end, spd) {
      // an attack: the help steps in, the shooter's man sinks
      const hd = helpD(); go(x, end, spd || 17);
      run(0.35); if (hd != null) { go(hd, () => toward(A[x].p, rim, 2.2), 17); }
      run(1.3, () => dist(A[x].p, end) < 1.6);
    }
    const play = r.play || 'iso';
    if (flow === 'trans') {
      // the finish on the break
      if (shooter !== H) {
        if (type === '3') { const spot = atShot(shooter, '3'); go(shooter, spot, 19); go(H, P(13, 25 + rnd(-3, 3)), 18); run(1.2, () => dist(A[shooter].p, spot) < 1.5); }
        else { go(shooter, P(3, 25 + (A[shooter].p[1] < 25 ? -2 : 2)), 21); go(H, P(15, 25), 18); run(0.9, () => dxOf(A[shooter].p) < 12); }
        pass(shooter, { v: 46 });
      }
    } else if (flow === 'early' && (play === 'pnr' || play === 'drive' || play === 'spot')) {
      // the drag screen: the trailer runs into a ball screen on the move
      const tr = O.filter(x => x !== H && isBig(x))[0] || O[4];
      if (tr !== H && tr != null) {
        const dh = defOf(H); go(tr, () => toward(A[dh].p, P(40, 25), 2.3), 18); run(1.1, () => dist(A[tr].p, A[dh].p) < 3);
        slowDown(dh, 7, 0.8); go(H, P(14, 25 + (A[H].p[1] < 25 ? 5 : -5)), 17);
        pathTo(tr, [P(5, 25)], 16); run(0.9);
      }
      if (passer != null && passer !== H) feed(passer);
    } else if (play === 'pnr') {
      // the ball screen: the big sets it on the handler's man, the handler turns the corner, the big rolls (or pops)
      const ballH = isBig(H) ? (O.find(x => !isBig(x)) || H) : H; feed(ballH);
      const scr = shooter !== H && isBig(shooter) ? shooter : (O.filter(x => x !== H && isBig(x))[0] || O.find(x => x !== H));
      const dh = defOf(H), side = A[H].p[1] < 25 ? 1 : -1;      // turn the corner toward the middle
      go(scr, () => { const dp = A[dh].p; return [dp[0], dp[1] + side * 2.4]; }, 14);
      stay(H); run(1.4, () => dist(A[scr].p, A[dh].p) < 3.2); run(0.35);
      const corner = [A[scr].p[0] - sg * 1.2, A[scr].p[1] + side * 2.4], attack = P(13, 25 + side * rnd(0, 5));
      pathTo(H, [corner, attack], 16); slowDown(dh, 6, 0.9);
      const ds = defOf(scr);
      if (!zone && Math.random() < 0.4) { go(ds, () => toward(A[H].p, rim, 2.5), 17); }   // the hedge
      else go(ds, () => P(10, 25 + (A[H].p[1] - 25) * 0.3), 15);                          // the drop
      run(0.5);
      const pop = shooter === scr && type !== 'rim';
      pathTo(scr, [pop ? P(type === '3' ? 23 : 15, A[scr].p[1] < 25 ? 18 : 32) : P(4, 25 - side * 2)], 15);
      run(0.9); free(ds, 15);
      if (shooter === scr) pass(scr, { arc: type === 'rim' ? 3 : 1.5 });
    } else if (play === 'post') {
      // the post-up: seal on the block, the entry from the wing, back him down
      const pp = shooter !== H && isBig(shooter) ? shooter : passer && isBig(passer) ? passer : (shooter === H ? null : shooter);
      if (pp != null) {
        const side = A[pp].p[1] < 25 ? -1 : 1, blk = P(6, 25 + side * 6.5);
        const wingMan = O.filter(x => x !== pp).sort((a, b) => dist(A[a].p, P(20, 25 + side * 17)) - dist(A[b].p, P(20, 25 + side * 17)))[0];
        go(wingMan, P(20, 25 + side * 17), 13); feed(wingMan); stay(wingMan);
        go(pp, blk, 12); run(1.4, () => dist(A[pp].p, blk) < 1.3);
        pass(pp, { arc: 1.5 }); B.dr = true;
        const dp = defOf(pp); go(dp, () => toward(A[pp].p, rim, 2.0), 10);
        go(pp, () => toward(A[pp].p, rim, 1.5), 3.5); run(1.3); free(dp, 14);
        if (shooter !== pp) { go(pp, A[pp].p.slice(), 2); pass(shooter, { arc: 1.2 }); }
      }
    } else if (play === 'iso') {
      // clear out: everyone to the weak side, the jab, the hesitation, the move
      feed(shooter);
      const side = A[shooter].p[1] < 25 ? -1 : 1;
      O.forEach(x => { if (x !== shooter) go(x, P(x === O[4] && !five ? 5 : slot[x] % 2 ? 2 : 22, 25 - side * (slot[x] === 0 ? 10 : 20) + rnd(-2, 2)), 12); });
      const top = P(22, 25 + side * 9); go(shooter, top, 9); run(1.2, () => dist(A[shooter].p, top) < 1.5);
      const p0 = A[shooter].p.slice();
      go(shooter, () => P(dxOf(p0) + Math.sin(t * 5) * 1.3, p0[1] + Math.cos(t * 3.4) * 1.6), 9); run(1.2);
    } else if (play === 'cut') {
      // the backdoor: a jab out, then hard to the rim behind the denial
      const fd = passer != null ? passer : H; feed(fd);
      if (shooter !== fd) {
        const sp = A[shooter].p.slice(), side = sp[1] < 25 ? -1 : 1, outP = toward(sp, P(30, 25 + side * 20), 3);
        pathTo(shooter, [outP, P(9, 25 + side * 4), P(3, 25 + side * 1.5)], 19); run(1.0, () => dxOf(A[shooter].p) < 12);
        pass(shooter, { v: 40, arc: 2.6 });
      }
    } else {
      // drive and kick, a spot-up three: someone gets into the paint, the help comes, the ball goes out
      const drv = passer != null ? passer : (shooter === H ? H : H); feed(drv);
      const side = A[drv].p[1] < 25 ? -1 : 1;
      if (shooter !== drv) {
        const spot = type === '3' ? atShot(shooter, '3') : atShot(shooter, type);
        go(shooter, spot, 14);
        drive(drv, P(10, 25 + side * rnd(1, 5)), 17);
        pass(shooter, { v: 44 });
      }
    }
    // the shot itself
    if (shooter !== H) feed(shooter);
    const spot = atShot(shooter, type);
    if (type === 'rim' || dist(A[shooter].p, spot) > 2.5) {
      if (type === 'rim') { const hd = helpD(); if (hd != null) go(hd, () => toward(rim, A[shooter].p, 3.2), 18); }
      go(shooter, spot, type === 'rim' ? 18 : 13); run(type === 'rim' ? 1.1 : 1.3, () => dist(A[shooter].p, spot) < (type === 'rim' ? 2 : 1.6));
    }
    // the contest: his man closes out, the rim protector comes if it is at the rim
    const sd = defOf(shooter); if (sd != null) go(sd, () => toward(A[shooter].p, rim, 2.2), 20);
    if (r.blk && A[id(r.blk)]) { const bl = id(r.blk); go(bl, () => toward(A[shooter].p, rim, 1.6), 22); }
    stay(shooter); B.dr = false; run(type === 'rim' ? 0.12 : 0.3);
    const made = r.kind === 'shot' && r.pts > 0;
    const sv = type === '3' ? 3 : 2;
    const mark = { at: A[shooter].p.slice(), made, three: type === '3', s }; let loose = null;
    // crash: bigs to the glass, guards get back, the defense boxes out
    const crash = () => {
      defMode = 'box';
      D.forEach(x => free(x, 15));
      O.forEach((x, i) => { if (x === shooter) return; if (isBig(x) || i === 2) go(x, () => toward(rim, A[x].p, 4.5), 15); else go(x, P(36 + i * 3, 25 + (i % 2 ? -10 : 10)), 14); });
    };
    if (r.blk && A[id(r.blk)]) {
      const at = toward(A[shooter].p, rim, 2.5);
      B.fl = { from: handPt(shooter), z0: 2.5, z1: 5, at, t0: t, dur: 0.18, arc: 0.5 }; B.hold = null; run(0.2);
      frames[frames.length - 1].mark = mark;
      loose = [at[0] + sg * rnd(6, 13), clamp(at[1] + rnd(-12, 12), 3, 47)];
      B.fl = { from: B.p.slice(), z0: 5, z1: 1, at: loose, t0: t, dur: 0.55, arc: 2 }; crash(); run(0.6);
    } else {
      const air = type === '3' ? 1.05 : type === 'mid' ? 0.9 : 0.55;
      B.fl = { from: handPt(shooter), z0: 3, z1: 4, at: rim.slice(), t0: t, dur: air, arc: type === '3' ? 11 : type === 'mid' ? 8 : 2.5 }; B.hold = null;
      run(0.2); free(shooter, 12);
      if (!made && r.kind !== 'ft') crash();
      run(air - 0.1, () => !B.fl);
      frames[frames.length - 1].mark = mark;
    }
    // free throws (and the and-one)
    function freeThrows(n, makes) {
      defMode = 'whistle'; all.forEach(x => stay(x)); run(0.4); defMode = 'ft';
      const lane = [[2.5, 17.6], [2.5, 32.4], [5.8, 17.6], [5.8, 32.4], [9, 17.6], [9, 32.4]];
      const others = O.filter(x => x !== shooter), order = [D[4], D[3], others[0], others[1], D[2], D[1]].filter(x => x != null);
      go(shooter, P(14.2, 25), 9);
      order.forEach((x, i) => go(x, P(lane[i][0], lane[i][1]), 9));
      all.forEach(x => { if (x !== shooter && !order.includes(x)) go(x, P(25, x === others[others.length - 1] ? 12 : 38), 9); });
      B.fl = null; B.hold = shooter; B.dr = false;
      run(1.4, () => dist(A[shooter].p, P(14.2, 25)) < 0.8); run(0.2);
      const res = []; for (let i = 0; i < n; i++) res.push(i >= n - makes);
      if (Math.random() < 0.5) res.reverse();
      let last = true;
      res.forEach((m, i) => {
        B.dr = false; B.hold = shooter; run(0.3);
        B.fl = { from: handPt(shooter), z0: 3, z1: 4, at: rim.slice(), t0: t, dur: 0.75, arc: 4.5 }; B.hold = null; run(0.8, () => !B.fl);
        B.fl = { from: B.p.slice(), z0: 4, z1: 0.3, at: m ? P(0.8, 25) : P(rnd(3, 7), 25 + rnd(-6, 6)), t0: t, dur: 0.35, arc: 0 }; run(0.4);
        last = m; if (i < n - 1) { B.hold = shooter; B.p = handPt(shooter); }
      });
      if (!last) {
        defMode = 'live'; const rb = D.slice(0).sort((a, b) => dist(A[a].p, B.p) - dist(A[b].p, B.p))[0];
        go(rb, B.p.slice(), 14); run(0.5, () => dist(A[rb].p, B.p) < 1.5); B.hold = rb; B.dr = true; freeAll(13);
        D.forEach((x, i) => { if (i < 2) go(x, P(60, i ? 12 : 38), 16); }); run(0.5);
        SDC._after = 'live';
      } else { freeAll(10); all.forEach(x => { if (!isO[x]) free(x, 12); }); run(0.5); SDC._after = 'inb'; }
    };
    if (r.kind === 'ft') {
      // fouled on the shot (the shot does not go in) or in the bonus
      const n = r.type ? (type === '3' ? 3 : 2) : 2;
      B.fl = { from: B.p.slice(), z0: B.z, z1: 0.5, at: P(rnd(2, 6), 25 + rnd(-5, 5)), t0: t, dur: 0.35, arc: 0 }; run(0.4);
      freeThrows(n, clamp(r.pts, 0, n)); return done();
    }
    if (made) {
      // through the net: the scorers turn and run back, the other team grabs it to inbound
      B.fl = { from: B.p.slice(), z0: 3.5, z1: 0, at: P(0.6, 25 + rnd(-1, 1)), t0: t, dur: 0.35, arc: 0 }; run(0.35);
      if (r.and1) { freeThrows(1, r.pts - sv > 0 ? 1 : 0); return done(); }
      defMode = 'live';
      O.forEach((x, i) => go(x, P(52 + i * 4, clamp(A[x].p[1] * 0.6 + 10, 8, 42)), 11 + (i % 3)));
      const inb = D.find(isBig) || D[4]; D.forEach(x => { if (x !== inb) go(x, P(clamp(dxOf(A[x].p) + 12, 8, 60), A[x].p[1]), 9); });
      go(inb, B.p.slice(), 13);
      run(0.7); SDC._after = 'inb'; return done();
    }
    // the rebound
    const rbId = A[id(r.orb)] ? id(r.orb) : A[id(r.drb)] ? id(r.drb) : null;
    const far = type === '3' ? rnd(7, 15) : type === 'mid' ? rnd(5, 11) : rnd(3, 8);
    const ang = rnd(-1.2, 1.2), bounce = loose || P(far * Math.cos(ang), 25 + far * Math.sin(ang) * 1.2);
    if (rbId != null) go(rbId, bounce, 20);
    if (!r.blk) { B.fl = { from: B.p.slice(), z0: 4, z1: 2.5, to: rbId, at: bounce, t0: t, dur: 0.55, arc: 2.5 }; run(0.6, () => !B.fl); }
    else if (rbId != null) { run(0.5, () => !B.fl); B.fl = { from: B.p.slice(), z0: B.z, z1: 2.2, to: rbId, t0: t, dur: 0.35, arc: 1 }; run(0.4, () => !B.fl); }
    if (rbId == null) { const nb = nearestO(B.p); B.hold = nb; }
    defMode = 'live'; B.dr = true;
    if (r.drb) {
      // the outlet: guards leak out, the other team sprints back
      const nd = rbId;
      D.forEach((x, i) => { if (x !== nd && i < 3) go(x, P(48 + i * 3, i === 1 ? 7 : i === 2 ? 43 : 22), 17); else if (x !== nd) go(x, P(40, A[x].p[1]), 12); });
      go(nd, () => toward(A[nd].p, P(60, 25), 3), 8);
      O.forEach((x, i) => go(x, P(64 + i * 2, 14 + i * 5), 16));
      run(0.55);
    } else {
      // offensive board: kick it back out and reset
      freeAll(12); run(0.45);
    }
    SDC._after = 'live';
    return done();
  };

  /* ---------- drawing ---------- */
  const COL = { floor: '#0d1520', floor2: '#101a27', line: 'rgba(214,226,240,.22)', line2: 'rgba(214,226,240,.12)', text: 'rgba(214,226,240,.35)' };
  SDC.court = (c, W, H, GM) => {
    const k = Math.min(W / 94, H / 50), ox = (W - 94 * k) / 2, oy = (H - 50 * k) / 2;
    const X = x => ox + x * k, Y = y => oy + y * k;
    c.fillStyle = COL.floor; c.fillRect(0, 0, W, H);
    c.fillStyle = COL.floor2; c.fillRect(X(0), Y(0), 94 * k, 50 * k);
    const home = GM.T.h.c1 || '#FF8200';
    c.save(); c.globalAlpha = 0.16; c.fillStyle = home; c.fillRect(X(0), Y(19), 19 * k, 12 * k); c.fillRect(X(75), Y(19), 19 * k, 12 * k); c.restore();
    c.strokeStyle = COL.line; c.lineWidth = Math.max(1, k * 0.15);
    c.strokeRect(X(0), Y(0), 94 * k, 50 * k);
    c.beginPath(); c.moveTo(X(47), Y(0)); c.lineTo(X(47), Y(50)); c.stroke();
    c.beginPath(); c.arc(X(47), Y(25), 6 * k, 0, Math.PI * 2); c.stroke();
    for (const side of [0, 1]) {
      const bx = side ? 88.75 : 5.25, dir = side ? -1 : 1;
      c.strokeRect(side ? X(75) : X(0), Y(19), 19 * k, 12 * k);
      c.beginPath(); c.arc(X(side ? 75 : 19), Y(25), 6 * k, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2); c.stroke();
      const r3 = 22.15, yc = 3.35, dx = Math.sqrt(r3 * r3 - (25 - yc) ** 2);
      c.beginPath(); c.moveTo(X(side ? 94 : 0), Y(yc)); c.lineTo(X(bx + dir * dx), Y(yc));
      c.arc(X(bx), Y(25), r3 * k, Math.atan2(yc - 25, dir * dx), Math.atan2(25 - yc, dir * dx), !!side); c.lineTo(X(side ? 94 : 0), Y(50 - yc)); c.stroke();
      c.strokeStyle = COL.line2; c.beginPath(); c.arc(X(bx), Y(25), 4 * k, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2); c.stroke(); c.strokeStyle = COL.line;
      c.beginPath(); c.moveTo(X(side ? 90 : 4), Y(22)); c.lineTo(X(side ? 90 : 4), Y(28)); c.stroke();
      c.strokeStyle = '#ff7a1a'; c.beginPath(); c.arc(X(bx), Y(25), 0.75 * k, 0, Math.PI * 2); c.stroke(); c.strokeStyle = COL.line;
    }
    c.fillStyle = COL.text; c.font = `800 ${Math.max(10, k * 3)}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (!GM.neutral) c.fillText(GM.T.h.abbr || '', X(47), Y(25));
    return { k, X, Y };
  };
  // the players, the ball (with its trail) and the shot marks
  SDC.draw = (c, g, st, GM, col, ink) => {
    const { k, X, Y } = g, r = Math.max(6.5, k * 1.45);
    // shot marks (fade over a few seconds)
    const now = performance.now();
    (st.marks || []).forEach(m => { const a = 1 - (now - m.born) / 7000; if (a <= 0) return; c.save(); c.globalAlpha = a * 0.85; c.strokeStyle = col[m.s]; c.lineWidth = 2;
      if (m.made) { c.beginPath(); c.arc(X(m.at[0]), Y(m.at[1]), k * 0.9, 0, Math.PI * 2); c.stroke(); } else { const q = k * 0.8; c.beginPath(); c.moveTo(X(m.at[0]) - q, Y(m.at[1]) - q); c.lineTo(X(m.at[0]) + q, Y(m.at[1]) + q); c.moveTo(X(m.at[0]) + q, Y(m.at[1]) - q); c.lineTo(X(m.at[0]) - q, Y(m.at[1]) + q); c.stroke(); } c.restore(); });
    st.marks = (st.marks || []).filter(m => now - m.born < 7000);
    // players: defense first, then offense; a ring on the ball handler
    const dot = (id, p, side, hold) => {
      const pl = SD.P(id); if (!pl || !p) return; const fill = col[side];
      c.beginPath(); c.arc(X(p[0]), Y(p[1]), r, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
      c.lineWidth = hold ? 2.5 : 1.2; c.strokeStyle = hold ? '#ffffff' : 'rgba(0,0,0,.55)'; c.stroke();
      c.fillStyle = ink(fill); c.font = `700 ${Math.max(8, r * 0.95)}px "IBM Plex Mono", ui-monospace, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(pl.num ?? ''), X(p[0]), Y(p[1]) + 0.5);
      if (r >= 7) { c.font = `${hold ? 700 : 500} ${Math.max(8, r * (hold ? 0.85 : 0.72))}px "IBM Plex Sans", system-ui, sans-serif`; c.fillStyle = hold ? 'rgba(255,255,255,.96)' : 'rgba(214,226,240,.55)'; c.fillText(SD.H.last(pl), X(p[0]), Y(p[1]) + r + Math.max(7, r * 0.8)); }
    };
    for (const id in st.pos) if (st.side[id] !== st.s) dot(+id, st.pos[id], st.side[id], false);
    for (const id in st.pos) if (st.side[id] === st.s) dot(+id, st.pos[id], st.side[id], +id === st.hold);
    // the ball's trail and the ball
    const tr = st.trail || []; for (let i = 1; i < tr.length; i++) { c.strokeStyle = `rgba(255,140,40,${i / tr.length * 0.5})`; c.lineWidth = Math.max(1.5, k * 0.35) * i / tr.length; c.beginPath(); c.moveTo(X(tr[i - 1][0]), Y(tr[i - 1][1]) - tr[i - 1][2] * k * 0.35); c.lineTo(X(tr[i][0]), Y(tr[i][1]) - tr[i][2] * k * 0.35); c.stroke(); }
    const b = st.ball, z = st.z || 0, br = Math.max(3.2, k * 0.62) * (1 + z / 20);
    if (z > 0.3) { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(X(b[0]), Y(b[1]), br, br * 0.6, 0, 0, Math.PI * 2); c.fill(); }
    c.save(); c.shadowColor = 'rgba(255,140,40,.9)'; c.shadowBlur = 10; c.fillStyle = '#ff8c28'; c.beginPath(); c.arc(X(b[0]), Y(b[1]) - z * k * 0.35, br, 0, Math.PI * 2); c.fill(); c.restore();
  };

  /* ---------- playing a possession on the canvas ---------- */
  // the possession was simulated at 30 ticks a second: blend the two ticks either side of the moment we are drawing
  SDC.state = (C, tm, side) => {
    const kf = C.kf, n = kf.length; if (!n) return { pos: {}, ball: [47, 25], z: 0, hold: null, side };
    const f = clamp(tm / DT - 1, 0, n - 1), i = Math.floor(f), u = f - i, A = kf[i], B = kf[Math.min(n - 1, i + 1)];
    const pos = {}; for (const id in A.pos) { const p = A.pos[id], q = B.pos[id] || p; pos[id] = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; }
    return { pos, ball: [A.ball[0] + (B.ball[0] - A.ball[0]) * u, A.ball[1] + (B.ball[1] - A.ball[1]) * u], z: A.z + (B.z - A.z) * u, hold: u < 0.5 ? A.hold : B.hold, i, side };
  };
})(typeof window !== 'undefined' ? window : globalThis);
