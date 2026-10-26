/* The Vol Index — Hoops Dynasty: the live court, in the style of a tracking view (think NBA Pulse). Each possession from
   the engine becomes a short piece of choreography: the ten players run from wherever the last possession left them, the
   ball is brought up (or pushed in transition), the play develops (screens, drives, kick-outs, post entries, cuts, ball
   reversals), the shot goes up and the rebound is fought for. Players move along smooth curves; the ball carries a trail;
   shots leave a mark on the floor. All positions are in feet on a 94 x 50 court. */
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

  /* ---------- choreography: keyframes {t, pos: {id: [x, y]}, hold: id | null, ball: [x, y], arc} ---------- */
  SDC.choreo = (GM, r, from) => {
    const s = r.s, d = other(s), F = frameOf(GM, s, r.per), P = F.P;
    const O = byPos(GM.on[s]), D = byPos(GM.on[d]);
    const id = p => p && p.id;
    const shooter = id(r.shooter), passer = id(r.ast) || id(r.passer);
    const zone = GM.coach[d].def === 'zone', press = GM.coach[d].def === 'press';
    const five = r.play === 'spot' || GM.coach[s].focus === 'three';
    const SPOT = five ? [[24, 25], [21, 6], [21, 44], [3, 47], [6, 17]] : [[24, 25], [21, 6], [21, 44], [13, 34], [5.5, 17]];
    const ZONE = [[18, 18], [18, 32], [7, 7], [7, 43], [4.5, 25]];
    const kf = []; let t = 0;
    const cur = {};                                   // where everyone is now
    const start = id0 => from && from[id0] ? from[id0].slice() : [47 + rnd(-2, 2), 51];
    O.concat(D).forEach(x => { cur[x] = start(x); });
    let ballAt = from && from._ball ? from._ball.slice() : cur[O[0]].slice();
    // defense: stay between your man and the basket (man), hold the zone shifted toward the ball, or pressure
    const defend = (holdId, tight) => {
      const bpos = holdId ? cur[holdId] : ballAt;
      D.forEach((dd, i) => {
        if (zone) { const z = P(ZONE[i][0], ZONE[i][1]); cur[dd] = [z[0], z[1] + (bpos[1] - 25) * 0.25]; return; }
        const man = cur[O[i]] || P(20, 25), gap = man === bpos ? 3 : (tight ? 2.5 : 4.5);
        let p = toward(man, F.rim, Math.min(gap, dist(man, F.rim) * 0.6));
        if (O[i] !== holdId && dist(man, bpos) > 12) p = toward(p, bpos, 2.5);   // sag toward the ball
        cur[dd] = p;
      });
    };
    const push = (dt, hold, extra) => { t += dt; const pos = {}; for (const k in cur) pos[k] = cur[k].slice(); const b = hold ? cur[hold].slice() : ballAt.slice(); if (hold) ballAt = b; kf.push(Object.assign({ t, pos, hold: hold || null, ball: b, arc: 0 }, extra || {})); };
    const handler = O[0];
    const spotOf = i => P(SPOT[i][0] + rnd(-1.2, 1.2), SPOT[i][1] + rnd(-1.5, 1.5));
    // 0: where the possession starts (the ball with whoever is nearest it: the rebounder, the inbounder, the thief)
    let first = O.slice().sort((a, b) => dist(cur[a], ballAt) - dist(cur[b], ballAt))[0];
    push(0, first);
    const flow = r.kind === 'ft' && !r.shooter ? 'half' : (r.flow || 'half');
    // 1: bring it up
    if (flow === 'trans') {
      const lanes = [[20, 25], [9, 7], [9, 43], [30, 18], [40, 32]];
      O.forEach((x, i) => { cur[x] = P(lanes[i][0] + rnd(-2, 2), lanes[i][1] + rnd(-2, 2)); });
      D.forEach((dd, i) => { cur[dd] = P(lanes[i][0] + 10 + i * 3, lanes[i][1] * 0.6 + 10); });
      if (first !== handler) { push(0.6, first); }
      push(1.5, handler);
    } else {
      O.forEach((x, i) => { cur[x] = P(SPOT[i][0] + 18 + rnd(-3, 3), SPOT[i][1] * 0.8 + 5); });
      if (press) D.forEach((dd, i) => { cur[dd] = toward(cur[O[i]], F.rim, 2); }); else defend(null);
      if (first !== handler) push(0.7, first);
      push(flow === 'early' ? 1.3 : 1.6, handler);
      O.forEach((x, i) => { cur[x] = spotOf(i); }); defend(handler);
      push(flow === 'early' ? 1.0 : 1.5, handler);
    }
    const passTo = (to, dt) => { if (!to) return; push(dt || 0.7, to, { arc: 2.5 }); defend(to); };
    const atShot = () => {
      if (!shooter) return null;
      const sp = cur[shooter];
      if (r.type === 'rim') return P(rnd(2.5, 4.5), 25 + rnd(-3, 3));
      if (r.type === 'mid') { const ang = Math.atan2(sp[1] - 25, Math.abs(sp[0] - F.bx) || 1); return P(Math.max(4, 14 * Math.cos(ang)), 25 + 14 * Math.sin(ang)); }
      const y = sp[1]; if (Math.abs(y - 25) > 17) return P(3, y < 25 ? 2.5 : 47.5);   // a corner three
      const ang = Math.atan2(y - 25, Math.max(4, Math.abs(sp[0] - F.bx))); return P(23.4 * Math.cos(ang), 25 + 23.4 * Math.sin(ang));
    };
    // 2: the action
    if (r.kind === 'to' && !r.thief) {
      // a violation or an offensive foul: the whistle stops it
      push(1.4, handler); return finish();
    }
    if (flow === 'half' || flow === 'call') {
      // ball reversal and off-ball movement first (always in motion, and before most sets)
      const swings = r.motion ? 2 : (r.play === 'iso' ? 0 : Math.random() < 0.55 ? 1 : 0);
      let h = handler;
      for (let k = 0; k < swings; k++) {
        const a = 1 + Math.floor(Math.random() * 2), b2 = 3 + Math.floor(Math.random() * 2);   // a wing and a big swap spots: a screen away
        const tmp = cur[O[a]]; cur[O[a]] = cur[O[b2]]; cur[O[b2]] = tmp;
        const to = O[[1, 2, 0][k % 3]] === h ? O[2] : O[[1, 2, 0][k % 3]];
        passTo(to, 0.9); h = to;
      }
      if (r.play === 'pnr') {
        const big = O[3] && SD.P(O[3]).pos !== 'PG' ? (shooter && shooter !== handler && shooter !== h ? shooter : O[4] || O[3]) : O[4];
        if (h !== handler) passTo(handler, 0.8);
        cur[big] = toward(cur[handler], F.rim, 2.5); defend(handler); push(1.0, handler);                    // the screen
        cur[handler] = P(13, cur[handler][1] < 25 ? 30 : 20); cur[big] = P(7, 25 + rnd(-4, 4));               // the drive and the roll
        const bm = D[O.indexOf(big)]; defend(handler); if (bm) cur[bm] = toward(cur[handler], F.rim, 2);       // the hedge
        push(1.1, handler);
      } else if (r.play === 'drive' || r.play === 'trans') {
        if (shooter && shooter !== h) passTo(shooter, 0.8);
      } else if (r.play === 'post') {
        const big = shooter || O[4];
        cur[big] = P(6, cur[big][1] < 25 ? 18 : 32); defend(h, true); push(1.0, h);
        passTo(big, 0.8); cur[big] = toward(cur[big], F.rim, 2); defend(big, true); push(1.2, big);           // backing down
      } else if (r.play === 'spot') {
        if (h !== handler && passer !== h) passTo(handler, 0.7);
        const drv = passer || handler; cur[drv] = P(11, 25 + rnd(-5, 5)); defend(drv);
        const di = O.indexOf(drv); D.forEach((dd, i) => { if (i !== di && Math.random() < 0.4) cur[dd] = toward(cur[dd], cur[drv], 4); });   // the help collapses
        push(1.1, drv);
      } else if (r.play === 'iso') {
        const iso = shooter || handler; if (iso !== h) passTo(iso, 0.8);
        O.forEach((x, i) => { if (x !== iso) cur[x] = P(i % 2 ? 4 : 22, i < 3 ? 4 : 46); });                // clear out
        cur[iso] = P(22, cur[iso][1] < 25 ? 12 : 38); defend(iso, true); push(1.4, iso);
        push(1.0, iso);                                                                                       // the jab, the hesitation
      } else if (r.play === 'cut') {
        const cutter = shooter || O[2]; if (passer && passer !== h) passTo(passer, 0.8);
        cur[cutter] = P(16, cur[cutter][1] < 25 ? 6 : 44); defend(passer || h); push(0.8, passer || h);
      }
    } else if (flow === 'early') {
      if (r.play === 'spot' && passer && passer !== handler) { cur[passer] = P(13, 25 + rnd(-4, 4)); defend(passer); push(0.8, passer); }
    }
    // 3: the shot (or the steal)
    if (r.kind === 'to') {
      const thief = id(r.thief), victim = id(r.who) || handler;
      cur[thief] = toward(cur[victim], F.rim, 1); push(0.6, victim);
      const away = [F.bx - F.sg * 40, 25 + rnd(-6, 6)];
      cur[thief] = away; D.forEach(dd => { if (dd !== thief) cur[dd] = toward(cur[dd], away, 14); }); O.forEach(x => { cur[x] = toward(cur[x], away, 9); });
      push(1.4, thief); return finish();
    }
    if (!shooter) { push(1.2, handler); return finish(); }
    const shotAt = atShot(), fromP = (passer && passer !== shooter) ? passer : null;
    if (fromP && fromP !== kf[kf.length - 1].hold) push(0.6, fromP);
    cur[shooter] = shotAt; defend(fromP || shooter);
    const sd = D[O.indexOf(shooter)]; if (sd) cur[sd] = toward(shotAt, F.rim, 1.6);                         // the contest
    if (r.type === 'rim' && r.blk) { const bl = id(r.blk); cur[bl] = toward(shotAt, F.rim, 1.2); }
    push(fromP ? 0.8 : 1.1, shooter, fromP ? { arc: 2.5 } : null);
    const mark = { at: shotAt.slice(), made: r.pts > 0 && r.kind === 'shot', three: r.type === '3', s };
    // the ball in the air
    if (r.blk) { ballAt = toward(shotAt, F.rim, -3).map((v, i) => v + rnd(-2, 2)); push(0.4, null, { arc: 3, mark }); }
    else { ballAt = F.rim.slice(); push(r.type === '3' ? 1.0 : r.type === 'mid' ? 0.85 : 0.6, null, { arc: r.type === '3' ? 12 : r.type === 'mid' ? 8 : 4, mark }); }
    const made = r.pts > 0 && r.kind === 'shot';
    if (r.kind === 'ft') {
      // to the line: the shooter at the stripe, the rest on the lane
      const lane = [[7, 19], [7, 31], [10, 19], [10, 31], [13, 19], [13, 31]];
      cur[shooter] = P(15, 25); let li = 0;
      D.concat(O.filter(x => x !== shooter)).forEach((x, i) => { cur[x] = i < 6 ? P(lane[li][0], lane[li++][1]) : P(26, 25 + (i - 6) * 8); });
      ballAt = cur[shooter].slice(); push(1.4, shooter);
      ballAt = F.rim.slice(); push(0.8, null, { arc: 5 }); push(0.5, shooter, { arc: 3 }); ballAt = F.rim.slice(); push(0.8, null, { arc: 5 });
      ballAt = P(1.5, 25); push(0.5, null); return finish();
    }
    if (made) {
      ballAt = P(1, 25 + rnd(-1, 1)); O.forEach(x => { cur[x] = toward(cur[x], [F.bx - F.sg * 60, 25], 5); }); push(0.6, null);
      return finish();
    }
    // the rebound: everyone crashes, the rebounder comes up with it
    const rb = id(r.orb) || id(r.drb), spot = P(rnd(4, 9), 25 + rnd(-8, 8));
    O.concat(D).forEach(x => { if (x !== shooter && dist(cur[x], F.rim) < 26) cur[x] = toward(cur[x], F.rim, 3); });
    if (rb) cur[rb] = spot;
    ballAt = spot; push(0.7, null, { arc: 3 });
    if (rb) push(0.3, rb);
    return finish();
    function finish() { return { kf, T: t, F, ball: ballAt }; }
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
      if (hold && r >= 7) { c.font = `600 ${Math.max(9, r * 0.85)}px "IBM Plex Sans", system-ui, sans-serif`; c.fillStyle = 'rgba(236,240,245,.92)'; c.fillText(SD.H.last(pl), X(p[0]), Y(p[1]) + r + Math.max(8, r * 0.9)); }
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
  // Catmull-Rom through the keyframes: smooth paths with no stops at each keyframe
  const cr = (p0, p1, p2, p3, u) => { const u2 = u * u, u3 = u2 * u; return [0, 1].map(i => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3)); };
  SDC.state = (C, tm, side) => {
    const kf = C.kf; let i = 0; while (i < kf.length - 2 && kf[i + 1].t <= tm) i++;
    const A = kf[i], B = kf[Math.min(i + 1, kf.length - 1)], span = Math.max(0.01, B.t - A.t), u = clamp((tm - A.t) / span, 0, 1);
    const A0 = kf[Math.max(0, i - 1)], B1 = kf[Math.min(kf.length - 1, i + 2)];
    const pos = {};
    for (const id in A.pos) { const p1 = A.pos[id], p2 = B.pos[id] || p1; pos[id] = cr((A0.pos[id] || p1), p1, p2, (B1.pos[id] || p2), u); }
    // the ball: with the holder (a little dribble), or in the air between two places
    let ball, z = 0, hold = null;
    if (A.hold && A.hold === B.hold) { hold = A.hold; const p = pos[hold]; ball = [p[0] + 0.9, p[1] + 0.5]; z = Math.abs(Math.sin(tm * 9)) * 1.2; }
    else { const a = A.hold ? pos[A.hold] : A.ball, b = B.hold ? pos[B.hold] : B.ball; ball = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; z = (B.arc || 0) * 4 * u * (1 - u); hold = u > 0.97 ? B.hold : null; }
    return { pos, ball, z, hold, i, side };
  };
})(typeof window !== 'undefined' ? window : globalThis);
