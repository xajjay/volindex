/* The Vol Index — Vol Dynasty: the live field simulation.
   Every snap of a game you watch is played out by 22 players on the field, ten times a second. Speed and acceleration come
   from ratings; linemen engage and stay engaged (blocks are won, held, shed or flagged); pullers kick out; receivers run real
   routes against man (trailing with a lag set by coverage vs. route running) or zone (landmarks, then matching what comes
   into the zone); the quarterback reads a progression, feels pressure, steps up, scrambles or takes the sack; the ball flies
   at a speed set by arm strength with an error set by accuracy; catches are contested; ball carriers read space, cut and
   break tackles; one to three defenders make the tackle. What the sim produces is the result: the yards, the tackler, the
   catch, the flag. The game screen replays the recorded frames exactly.
   Coordinates: f = yards from the line of scrimmage toward the offense's goal; l = yards from the ball, + = the offense's right. */
(function (root) {
  'use strict';
  const DY = root.DY;
  const { gauss, clamp, pick } = DY;
  const rnd = () => DY.r();
  const chance = p => rnd() < p;
  const SIM = DY.SIM = {};
  // tuning (calibrated against FBS averages: see the notes at the bottom of the file)
  const tkOf = W => W.tackle ? { t: W.tackle.t, i: W.ag.indexOf(W.tackle.by), a: W.tackle.ast && typeof W.tackle.ast === 'object' ? W.ag.indexOf(W.tackle.ast) : -1 } : null;
  const K = SIM.K = { tk0: 0.84, tkD: 95, tkHead: 0.06, tkBack: 0.1, tkHelp: 0.08, tkEng: 0.16, runShed: 0.6, runShedD: 46, nearShed: 0.06, passShed: 0.37, passShedD: 44,
    engW: 0.6, whiff: 0.34, pen0: 0.15, holdP: 0.016, holdR: 0.022, catch0: 0.97, contest: 0.32, intOnTop: 0.08, intCont: 0.045, lag0: 0.26, openNeed: 1.15, sackP: 0.86 };
  const DT = 0.1, W53 = 53.33, hyp = Math.hypot;
  const last = p => (p ? DY.lastName(p) : '?');
  const unit = (x, y) => { const d = hyp(x, y) || 1; return { x: x / d, y: y / d }; };

  /* ---------- formations ---------- */
  SIM.OL = { LT: [-0.9, -2.7], LG: [-0.7, -1.35], C: [-0.6, 0], RG: [-0.7, 1.35], RT: [-0.9, 2.7] };
  SIM.SKILL = {
    trips: { QB: [-5, 0], RB: [-5.3, 1.6], TE: [-1, 3.9], WR1: [-0.8, -16], WR2: [-0.8, 15.5], WR3: [-1, 8.5] },
    doubles: { QB: [-5, 0], RB: [-5.3, -1.6], TE: [-1, 3.9], WR1: [-0.8, -16], WR3: [-1, -9], WR2: [-0.8, 15.5] },
    pistol: { QB: [-4, 0], RB: [-7, 0], TE: [-1, 3.9], WR1: [-0.8, -16], WR2: [-0.8, 15.5], WR3: [-1, 8.5] },
    ace12: { QB: [-1.2, 0], RB: [-6.5, 0], TE: [-1, 3.9], TE2: [-1, -3.9], WR1: [-0.8, -15], WR2: [-0.8, 14] },
    iform: { QB: [-1.2, 0], FB: [-4, 0], RB: [-7, 0], TE: [-1, 3.9], WR1: [-0.8, -15], WR2: [-0.8, 14] },
    spread: { QB: [-5, 0], RB: [-5.3, 1.6], WR1: [-0.8, -17], WR4: [-1, -9.5], WR3: [-1, 9], WR2: [-0.8, 16.5] },
    empty: { QB: [-5, 0], TE: [-1, 4.2], WR1: [-0.8, -17], WR4: [-1, -10], WR3: [-1, 9], WR2: [-0.8, 16.5] },
    goal: { QB: [-1.2, 0], RB: [-5.5, 0], FB: [-3.5, 1], TE: [-1, 3.9], TE2: [-1, -3.9], WR1: [-0.8, -10] },
    flexbone: { QB: [-1.2, 0], RB: [-5, 0], FB: [-2.4, -3.8], TE2: [-2.4, 3.8], WR1: [-0.8, -14], WR2: [-0.8, 13] },
  };
  const ELIG = ['WR1', 'WR2', 'WR3', 'WR4', 'TE', 'TE2', 'RB', 'FB'];

  /* ---------- the playbook as routes and run schemes ---------- */
  // route waypoints: [forward, inside] (inside = toward the ball; negative = toward the sideline)
  const RT = {
    go: [[16, -0.6], [45, -1]], fade: [[16, -2], [40, -3.5]], post: [[11, 0], [32, 9]], corner: [[11, 0], [25, -9]], dig: [[12, 0], [12.5, 13]],
    out: [[10, 0], [10, -9]], curl: [[12, 0], [10.5, 1.5]], comeback: [[15, 0], [12.5, -3.5]], slant: [[2.5, 0], [10, 7]], hitch: [[6, 0], [5, 0.3]],
    qout: [[5, 0], [5, -8]], flat: [[1.5, -2], [3, -11]], seam: [[20, 0.4], [42, 1]], drag: [[3, 1.5], [5, 19]], cross: [[7, 2], [11, 21]],
    wheel: [[1, -5], [5, -8], [26, -9]], stick: [[6, 0], [6, -1.2]], snag: [[5, 2.5], [6, 3]], bubble: [[-1, -2.5], [0, -5], [1, -6]],
    tunnel: [[0.5, 1.5], [-0.5, 3.5], [1, 5]], check: [[1, -3], [4, -4.5]], swing: [[-1.5, -4], [1, -9]], screen: [[-2.5, -4], [-2, -7]],
    glance: [[6, 0], [17, 4]], sluggo: [[3, 0], [5, 3], [30, 1]], mesh: [[3, 1], [4.5, 17]], angle: [[0.5, -3], [5, 1]], boot: [[2, 1], [5, 16]],
    dagdig: [[14, 0], [15, 13]], skinny: [[10, 0], [26, 3]],
  };
  SIM.CONCEPT = {
    'Stick': { WR1: 'hitch', WR2: 'hitch', WR3: 'stick', WR4: 'flat', TE: 'stick', TE2: 'flat', RB: 'flat', ord: ['WR3', 'TE', 'WR4', 'WR2', 'WR1', 'RB'] },
    'Slant-Flat': { WR1: 'slant', WR2: 'slant', WR3: 'flat', WR4: 'flat', TE: 'flat', RB: 'check', ord: ['WR1', 'WR2', 'WR3', 'WR4', 'TE', 'RB'] },
    'Hitch': { WR1: 'hitch', WR2: 'hitch', WR3: 'seam', WR4: 'seam', TE: 'seam', RB: 'check', ord: ['WR1', 'WR2', 'WR3', 'TE', 'RB'] },
    'Bubble RPO': { WR1: 'go', WR2: 'slant', WR3: 'bubble', WR4: 'bubble', TE: 'seam', RB: 'check', ord: ['WR3', 'WR4', 'WR2', 'TE', 'RB'] },
    'Snag': { WR1: 'go', WR2: 'qout', WR3: 'snag', WR4: 'snag', TE: 'flat', RB: 'check', ord: ['WR3', 'TE', 'WR2', 'WR1', 'RB'] },
    'Quick Out': { WR1: 'qout', WR2: 'qout', WR3: 'hitch', WR4: 'hitch', TE: 'stick', RB: 'check', ord: ['WR1', 'WR2', 'WR3', 'TE', 'RB'] },
    'Mesh': { WR1: 'drag', WR2: 'mesh', WR3: 'curl', WR4: 'curl', TE: 'mesh', RB: 'swing', ord: ['WR1', 'WR2', 'TE', 'WR3', 'RB'] },
    'Dagger': { WR1: 'dagdig', WR2: 'go', WR3: 'seam', WR4: 'seam', TE: 'seam', RB: 'check', ord: ['WR3', 'WR1', 'WR2', 'TE', 'RB'] },
    'Smash': { WR1: 'hitch', WR2: 'hitch', WR3: 'corner', WR4: 'corner', TE: 'corner', RB: 'check', ord: ['WR3', 'WR1', 'WR2', 'TE', 'RB'] },
    'Curl-Flat': { WR1: 'curl', WR2: 'curl', WR3: 'flat', WR4: 'flat', TE: 'flat', RB: 'check', ord: ['WR1', 'WR2', 'WR3', 'TE', 'RB'] },
    'Y-Cross': { WR1: 'post', WR2: 'curl', WR3: 'out', WR4: 'out', TE: 'cross', TE2: 'flat', RB: 'check', ord: ['TE', 'WR1', 'WR3', 'WR2', 'RB'] },
    'Four Verticals': { WR1: 'go', WR2: 'go', WR3: 'seam', WR4: 'seam', TE: 'seam', RB: 'check', ord: ['WR3', 'WR4', 'TE', 'WR1', 'WR2', 'RB'] },
    'Post-Wheel': { WR1: 'post', WR2: 'go', WR3: 'wheel', WR4: 'dig', TE: 'dig', RB: 'check', ord: ['WR1', 'WR3', 'WR2', 'TE', 'RB'] },
    'Go/Fade': { WR1: 'fade', WR2: 'fade', WR3: 'hitch', WR4: 'hitch', TE: 'stick', RB: 'check', ord: ['WR1', 'WR2', 'WR3', 'TE', 'RB'] },
    'Mills': { WR1: 'post', WR2: 'go', WR3: 'dig', WR4: 'dig', TE: 'seam', RB: 'check', ord: ['WR1', 'WR3', 'WR2', 'TE', 'RB'] },
    'Double Move': { WR1: 'sluggo', WR2: 'go', WR3: 'hitch', WR4: 'hitch', TE: 'stick', RB: 'check', ord: ['WR1', 'WR2', 'WR3', 'TE', 'RB'] },
    'RB Screen': { WR1: 'go', WR2: 'go', WR3: 'seam', WR4: 'seam', TE: 'seam', RB: 'screen', ord: ['RB'], screen: 'RB' },
    'WR Tunnel Screen': { WR1: 'tunnel', WR2: 'go', WR3: 'block', WR4: 'block', TE: 'seam', RB: 'check', ord: ['WR1'], screen: 'WR1' },
    'Bubble Screen': { WR1: 'block', WR2: 'go', WR3: 'bubble', WR4: 'bubble', TE: 'seam', RB: 'check', ord: ['WR3', 'WR4'], screen: 'WR3' },
    'PA Boot': { WR1: 'post', WR2: 'comeback', WR3: 'corner', WR4: 'corner', TE: 'boot', TE2: 'flat', RB: 'flat', ord: ['TE', 'WR2', 'WR1', 'RB'], boot: true },
    'PA Post': { WR1: 'post', WR2: 'dig', WR3: 'seam', WR4: 'seam', TE: 'seam', TE2: 'block', RB: 'block', ord: ['WR1', 'WR2', 'TE', 'WR3'] },
    'PA Crossers': { WR1: 'cross', WR2: 'post', WR3: 'go', WR4: 'go', TE: 'drag', RB: 'flat', ord: ['WR1', 'TE', 'WR2', 'RB'] },
    'RPO Glance': { WR1: 'glance', WR2: 'glance', WR3: 'seam', WR4: 'seam', TE: 'block', RB: 'run', ord: ['WR1'], rpo: 'WR1', key: 'LB1' },
    'Slant RPO': { WR1: 'slant', WR2: 'slant', WR3: 'block', WR4: 'block', TE: 'block', RB: 'run', ord: ['WR1'], rpo: 'WR1', key: 'LB1' },
    'Bubble Read': { WR1: 'block', WR2: 'block', WR3: 'bubble', WR4: 'bubble', TE: 'block', RB: 'run', ord: ['WR3'], rpo: 'WR3', key: 'NB' },
    'Stick RPO': { WR1: 'go', WR2: 'go', WR3: 'stick', WR4: 'stick', TE: 'block', RB: 'run', ord: ['WR3'], rpo: 'WR3', key: 'NB' },
  };
  // run schemes: ap = aiming point (yards toward the play side), pull = who pulls (bs = backside, ps = playside)
  SIM.RUN = {
    'Inside Zone': { sch: 'zone', ap: 1.8 }, 'Duo': { sch: 'duo', ap: 1.1 }, 'Power': { sch: 'gap', ap: 2.6, pull: ['bsG'] }, 'Counter': { sch: 'gap', ap: 2.7, pull: ['bsG', 'bsT'], cnt: true },
    'Trap': { sch: 'trap', ap: 0.9, pull: ['bsG'] }, 'Iso': { sch: 'iso', ap: 1.2 }, 'Dart': { sch: 'gap', ap: 2.2, pull: ['bsT'] },
    'Outside Zone': { sch: 'ozone', ap: 7 }, 'Toss Crack': { sch: 'toss', ap: 9.5 }, 'Jet Sweep': { sch: 'jet', ap: 12 }, 'Pin & Pull': { sch: 'ozone', ap: 8, pull: ['psG'] },
    'Stretch': { sch: 'ozone', ap: 6.5 }, 'Buck Sweep': { sch: 'gap', ap: 6, pull: ['psG', 'bsG'] },
    'Zone Read Keep': { sch: 'read', ap: 1.8, qb: true }, 'QB Power': { sch: 'gap', ap: 2.4, pull: ['bsG'], qb: true }, 'QB Draw': { sch: 'draw', ap: 0.5, qb: true },
    'Speed Option': { sch: 'speedopt', ap: 10, qb: true }, 'QB Counter': { sch: 'gap', ap: 2.7, pull: ['bsG', 'bsT'], qb: true, cnt: true }, 'Bash Keep': { sch: 'read', ap: 7, qb: true, bash: true },
    'Triple Option': { sch: 'triple', ap: 4, qb: true }, 'Midline Option': { sch: 'read', ap: 0.6, qb: true, midline: true }, 'Rocket Toss': { sch: 'toss', ap: 11 },
  };

  /* ---------- the coverages: who rushes, who plays man, and the zone landmarks ---------- */
  // zone landmarks in field terms: d = depth, z = which part of the field ('L3' deep left third ... ) resolved against the hashes
  const ZL = {
    dL3: { d: 13, z: 'L3' }, dM3: { d: 14, z: 'M' }, dR3: { d: 13, z: 'R3' }, dLh: { d: 14, z: 'Lh' }, dRh: { d: 14, z: 'Rh' },
    qL1: { d: 12, z: 'L4' }, qL2: { d: 12.5, z: 'L4i' }, qR2: { d: 12.5, z: 'R4i' }, qR1: { d: 12, z: 'R4' },
    flL: { d: 5, z: 'Lf' }, flR: { d: 5, z: 'Rf' }, cuL: { d: 9, z: 'Lc' }, cuR: { d: 9, z: 'Rc' }, hkL: { d: 8, z: 'Lk' }, hkR: { d: 8, z: 'Rk' }, hkM: { d: 9, z: 'M' },
    mid: { d: 15, z: 'M' }, pdL: { d: 20, z: 'L3' }, pdR: { d: 20, z: 'R3' }, pdLi: { d: 24, z: 'Lh' }, pdRi: { d: 24, z: 'Rh' }, puL: { d: 11, z: 'Lc' }, puR: { d: 11, z: 'Rc' }, puM: { d: 13, z: 'M' },
    rob: { d: 8, z: 'M' }, spy: { d: 5, z: 'M' },
  };
  // per coverage: man = defenders in man (matched to receivers), zone = role -> landmark, rush = extra rushers, deep = deep players, press = corners press
  SIM.COV = {
    c0: { man: ['CB1', 'CB2', 'NB', 'S2', 'LB1'], rush: ['LB2', 'S1'], press: true },
    c1: { man: ['CB1', 'CB2', 'NB', 'LB1', 'LB2'], zone: { S2: 'dM3', S1: 'rob' }, press: true },
    c1f: { rush: ['LB1'], zone: { CB1: 'dL3', CB2: 'dR3', S2: 'dM3', S1: 'hkL', NB: 'cuR', LB2: 'hkR', DE2: 'flR' }, drop: ['DE2'] },
    c2: { zone: { CB1: 'flL', CB2: 'flR', S1: 'dLh', S2: 'dRh', LB1: 'hkL', LB2: 'hkR', NB: 'hkM' } },
    c2m: { man: ['CB1', 'CB2', 'NB', 'LB1', 'LB2'], zone: { S1: 'dLh', S2: 'dRh' }, press: true },
    t2: { zone: { CB1: 'flL', CB2: 'flR', S1: 'dLh', S2: 'dRh', LB1: 'mid', LB2: 'hkR', NB: 'hkL' } },
    c3: { zone: { CB1: 'dL3', CB2: 'dR3', S2: 'dM3', S1: 'cuL', NB: 'cuR', LB1: 'hkL', LB2: 'hkR' } },
    c3b: { zone: { CB1: 'dL3', CB2: 'dR3', S2: 'dM3', S1: 'hkL', NB: 'cuR', LB1: 'flL', LB2: 'hkR' } },
    c4: { zone: { CB1: 'qL1', S1: 'qL2', S2: 'qR2', CB2: 'qR1', NB: 'cuR', LB1: 'hkL', LB2: 'hkR' } },
    c6: { zone: { CB1: 'qL1', S1: 'qL2', S2: 'dRh', CB2: 'flR', NB: 'hkR', LB1: 'hkL', LB2: 'hkM' } },
    bear: { man: ['CB1', 'CB2', 'NB', 'LB2'], zone: { S2: 'dM3' }, rush: ['LB1', 'S1'], press: true },
    ncb: { man: ['CB1', 'CB2', 'S1', 'LB1', 'LB2'], zone: { S2: 'dM3' }, rush: ['NB'], press: true },
    sfb: { man: ['CB1', 'CB2', 'NB', 'LB1', 'LB2'], zone: { S2: 'dM3' }, rush: ['S1'] },
    zb: { rush: ['NB', 'LB1'], zone: { CB1: 'dL3', CB2: 'dR3', S2: 'dM3', S1: 'cuR', LB2: 'hkM', DE1: 'flL', DT2: 'hkR' }, drop: ['DE1', 'DT2'] },
    prev: { zone: { CB1: 'pdL', CB2: 'pdR', S1: 'pdLi', S2: 'pdRi', NB: 'puM', LB1: 'puL', LB2: 'puR', DT2: 'spy' }, drop: ['DT2'] },
    dman: { man: ['CB1', 'CB2', 'NB', 'LB1', 'LB2'], zone: { S1: 'pdLi', S2: 'pdRi' } },
    gl: { man: ['CB1', 'CB2', 'LB2', 'S1', 'S2'], rush: ['LB1'] },
  };

  /* ---------- agents ---------- */
  const topSpd = v => 5.0 + (clamp(v || 60, 30, 99) - 50) * 0.094;
  const accOf = p => { const a = p.at.acc != null ? p.at.acc : p.at.agi != null ? p.at.agi : p.ovr - 6; return 4.4 + (clamp(a, 30, 99) - 50) * 0.085; };
  function agent(W, p, side, role, f, l) {
    const a = {
      p, side, role, x: f, y: l, vx: 0, vy: 0, top: topSpd(p ? p.at.spd : 60), acc: p ? accOf(p) : 5, agi: p ? (p.at.agi || p.ovr - 6) : 60,
      eng: null, stun: 0, down: 0, slow: 0, hist: [], tries: {}, path: null, pi: 0, task: null, i: W.ag.length, x0: f, y0: l,
    };
    W.ag.push(a); W.by[role] = a; return a;
  }
  // 0.1 s step toward a point (with arrival), limited by acceleration
  function steer(a, tx, ty, frac, arrive) {
    if (a.down > 0 || a.stun > 0) { a.vx *= 0.55; a.vy *= 0.55; return; }
    const dx = tx - a.x, dy = ty - a.y, d = hyp(dx, dy);
    let sp = a.top * (frac == null ? 1 : frac) * (a.slow > 0 ? 0.62 : 1);
    if (arrive !== false) sp = Math.min(sp, d / 0.28);
    accel(a, d > 1e-4 ? dx / d * sp : 0, d > 1e-4 ? dy / d * sp : 0);
  }
  function accel(a, wx, wy) {
    const dvx = wx - a.vx, dvy = wy - a.vy, dm = hyp(dvx, dvy);
    const lim = (a.acc * 1.55 + a.agi * 0.05) * DT;
    const k = dm > lim ? lim / dm : 1;
    a.vx += dvx * k; a.vy += dvy * k;
  }
  const spd = a => hyp(a.vx, a.vy);
  const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
  const past = (a, lag) => { const n = a.hist.length; if (!n) return { x: a.x, y: a.y }; const i = Math.max(0, n - 1 - Math.round(lag / DT)); return { x: a.hist[i][0], y: a.hist[i][1] }; };
  // where a runner following its path will be in t seconds
  function predict(a, t) {
    if (!a.path || a.pi >= a.path.length) return { x: a.x + a.vx * t, y: a.y + a.vy * t };
    const v = spd(a), vv = v < a.top ? (v + a.top) / 2 : v;
    let x = a.x, y = a.y, rem = vv * t, i = a.pi;
    while (rem > 0 && i < a.path.length) { const w = a.path[i], d = hyp(w.x - x, w.y - y); if (d >= rem) { x += (w.x - x) / d * rem; y += (w.y - y) / d * rem; rem = 0; } else { x = w.x; y = w.y; rem -= d; i++; } }
    if (rem > 0 && i > 0 && !a.stopAtEnd) { const w0 = i >= 2 ? a.path[i - 2] : { x: a.x0, y: a.y0 }, w1 = a.path[i - 1], u = unit(w1.x - w0.x, w1.y - w0.y); x += u.x * rem; y = clamp(y + u.y * rem, W_ ? W_.lmin + 1 : -99, W_ ? W_.lmax - 1 : 99); }
    return { x, y };
  }
  function follow(a, frac) {
    if (!a.path || a.pi >= a.path.length) {
      // settle routes sit down in the hole; everything else keeps running through the route
      if (a.stopAtEnd || !a.path) { steer(a, a.x + a.vx * 0.1, a.y + a.vy * 0.1, 0.25); return true; }
      const n = a.path.length, w1 = a.path[n - 1], w0 = n >= 2 ? a.path[n - 2] : { x: a.x0, y: a.y0 }, u = unit(w1.x - w0.x, w1.y - w0.y);
      let tx = a.x + u.x * 5, ty = a.y + u.y * 5;
      if (ty < W_.lmin + 1 || ty > W_.lmax - 1) { ty = clamp(ty, W_.lmin + 1, W_.lmax - 1); tx = a.x + 4; }
      steer(a, tx, ty, frac == null ? 1 : frac, false); return true;
    }
    const w = a.path[a.pi];
    if (hyp(w.x - a.x, w.y - a.y) < 0.6) { a.pi++; if (a.pi >= a.path.length) return true; }
    const n = a.path[Math.min(a.pi, a.path.length - 1)];
    steer(a, n.x, n.y, frac == null ? 1 : frac, a.pi >= a.path.length - 1 && a.stopAtEnd);
    return false;
  }

  /* ---------- building the snap ---------- */
  let W_ = null;
  function newWorld(GM, s, opt) {
    const d = s === 'h' ? 1 : -1, by = GM.by || 26.67;
    const lmin = Math.min(-by * d, (W53 - by) * d), lmax = Math.max(-by * d, (W53 - by) * d);
    const W = { GM, s, ds: s === 'h' ? 'a' : 'h', t: 0, ag: [], by: {}, pairs: [], ev: [], frames: [], flags: [], lmin, lmax, ballOn: GM.ball, toGoal: 100 - GM.ball, own: -GM.ball,
      ball: { x: -0.2, y: 0, z: 0.3, holder: null, fl: null }, carrier: null, phase: 'pre', done: null, opt: opt || {}, boost: { run: 0, pro: 0, rush: 0, box: 0, sep: 0, read: 0 }, tackles: [], dir: d };
    W.R = (p, k) => DY._E(GM, p, k, GM.T.h.roster.includes(p.id) ? 'h' : 'a');
    W_ = W;
    return W;
  }
  // landmarks against the field
  function zoneXY(W, key) {
    const z = ZL[key], L = W.lmin, R = W.lmax, wdt = R - L, mid = (L + R) / 2;
    const yy = { L3: L + wdt / 6, M: mid, R3: R - wdt / 6, Lh: L + wdt / 4, Rh: R - wdt / 4, L4: L + wdt / 8, L4i: L + wdt * 3 / 8, R4i: R - wdt * 3 / 8, R4: R - wdt / 8, Lf: L + 5.5, Rf: R - 5.5, Lc: L + 13, Rc: R - 13, Lk: Math.max(L + 15, -5), Rk: Math.min(R - 15, 5) }[z.z];
    return { x: Math.min(z.d, W.toGoal + 9), y: yy };
  }
  function unique(GM, side, list) {
    const used = new Set();
    return list.map(([role, p, alts]) => {
      let q = p;
      if (!q || used.has(q.id)) q = (alts || []).find(x => x && !used.has(x.id)) || null;
      if (q) used.add(q.id);
      return [role, q];
    });
  }
  function setupOffense(W, P, fk) {
    const GM = W.GM, L = GM.L[W.s], lay = SIM.SKILL[fk] || SIM.SKILL.trips;
    const ppl = unique(GM, W.s, [['LT', P.OL[0], L.OT], ['LG', P.OL[1], L.IOL], ['C', P.OL[2], L.IOL], ['RG', P.OL[3], L.IOL], ['RT', P.OL[4], L.OT],
      ['QB', P.QB, L.QB], ['RB', P.RB, L.RB], ['FB', P.FB, [...L.RB, ...L.TE]], ['TE', P.TE, L.TE], ['TE2', P.TE2, [...L.TE, ...L.OT]],
      ['WR1', P.WR[0], L.WR], ['WR2', P.WR[1], L.WR], ['WR3', P.WR[2], L.WR], ['WR4', P.WR4, L.WR]]);
    const map = {}; ppl.forEach(([r, p]) => { map[r] = p; });
    const spare = [...L.OT, ...L.IOL, ...L.TE].filter(p => p && !Object.values(map).includes(p));
    for (const k in SIM.OL) agent(W, map[k] || spare.shift() || L.IOL[0], 'o', k, SIM.OL[k][0], SIM.OL[k][1]);
    for (const k in lay) { if (!map[k]) continue; const l = clamp(lay[k][1], W.lmin + 1.5, W.lmax - 1.5); agent(W, map[k], 'o', k, lay[k][0], l); }
    W.qb = W.by.QB;
  }
  function setupDefense(W, P, pkg, cov) {
    const GM = W.GM, L = GM.L[W.ds];
    const dp = pkg || 'nickel';
    let nb = P.NB, lb2 = P.LB[1], extra = null;
    if (dp === 'base') nb = L.LB[2] || P.NB;
    if (dp === 'goal' || dp === 'heavy') { nb = L.DT[2] || L.EDGE[2] || L.LB[2] || P.NB; }
    if (dp === 'dime') lb2 = L.CB[3] || L.S[2] || P.LB[1];
    const ppl = unique(GM, W.ds, [['DE1', P.DL[0], L.EDGE], ['DT1', P.DL[1], L.DT], ['DT2', P.DL[2], L.DT], ['DE2', P.DL[3], L.EDGE], ['LB1', P.LB[0], L.LB], ['LB2', lb2, [...L.LB, ...L.S]],
      ['CB1', P.CB[0], L.CB], ['CB2', P.CB[1], L.CB], ['NB', nb, [...L.CB, ...L.S, ...L.LB]], ['S1', P.S[0], L.S], ['S2', P.S[1], [...L.S, ...L.CB]]]);
    const O = W.by, rec = ELIG.filter(k => O[k] && k !== 'RB' && k !== 'FB').map(k => O[k]).sort((a, b) => a.y - b.y);
    const outL = rec[0], outR = rec[rec.length - 1];
    const slots = rec.filter(r => r !== outL && r !== outR);
    const slot = slots.sort((a, b) => Math.abs(b.y) - Math.abs(a.y))[0] || null;
    const C = SIM.COV[cov] || SIM.COV.c3;
    const twoHigh = C.zone && ((C.zone.S1 && /^d|^q|^pd/.test(C.zone.S1)) && (C.zone.S2 && /^d[LR]h|^q|^pd/.test(C.zone.S2)));
    const tes = [O.TE, O.TE2].filter(Boolean), teR = tes.find(t => t.y > 2), teL = tes.find(t => t.y < -2);
    const pos = {
      DE1: [1.2, (teL ? teL.y - 1.1 : -3.9)], DT1: [1.1, -1.0], DT2: [1.1, 1.35], DE2: [1.2, (teR ? teR.y + 1.1 : 3.9)],
      LB1: [dp === 'goal' ? 3 : 4.6, -2.4], LB2: [dp === 'goal' ? 3 : 4.6, 2.5],
      CB1: [C.press ? 1.2 : 6.5, outL ? outL.y - 0.6 : -15], CB2: [C.press ? 1.2 : 6.5, outR ? outR.y + 0.6 : 15],
      NB: slot ? [C.press ? 1.5 : 5, slot.y + (slot.y < 0 ? -0.5 : 0.5)] : [dp === 'goal' ? 1.1 : 3.8, teR ? teR.y + 2.5 : 5.5],
      S1: twoHigh ? [12.5, -9] : [7.5, -4.5], S2: twoHigh ? [12.5, 9] : [13.5, 0],
    };
    if (dp === 'goal') { pos.NB = [1.1, 0.15]; pos.DT1 = [1.1, -1.6]; pos.DT2 = [1.1, 1.6]; pos.S1 = [4.5, -4]; pos.S2 = [5, 4]; pos.CB1[0] = Math.min(pos.CB1[0], 3); pos.CB2[0] = Math.min(pos.CB2[0], 3); }
    if (dp === 'dime') { pos.LB2 = [6.5, 6]; }
    if (cov === 'prev') { pos.CB1 = [11, pos.CB1[1]]; pos.CB2 = [11, pos.CB2[1]]; pos.S1 = [20, -8]; pos.S2 = [20, 8]; pos.LB1 = [7, -4]; pos.LB2 = [7, 4]; }
    if (cov === 'bear') { pos.LB1 = [3.5, -1.5]; pos.S1 = [5, 3.5]; }
    // the defense never lines up past the back of the end zone
    for (const [k, p] of ppl) {
      if (!p) continue;
      const q = pos[k] || [5, 0];
      agent(W, p, 'd', k, Math.min(q[0], W.toGoal + 9.5), clamp(q[1], W.lmin + 1, W.lmax - 1));
    }
    W.cov = cov; W.C = C; W.dp = dp; W.twoHigh = twoHigh;
  }
  SIM.align = (GM, s, fk, dc) => {
    const W = newWorld(GM, s);
    const P = DY._pers(GM, s), D = DY._pers(GM, W.ds);
    setupOffense(W, P, fk); setupDefense(W, D, (dc && dc.pkg) || (DY.FORMS[fk] || DY.FORMS.trips).dpers, (dc && dc.d) || 'c3');
    return { ag: W.ag.map(a => ({ role: a.role, side: a.side, p: a.p, f: a.x, l: a.y })), by: GM.by || 26.67 };
  };

  /* ---------- engagements ---------- */
  // Index grades: credit and blame from what actually happened on the field this snap
  const GR = (W, a, v) => { if (!a || !a.p || !v) return; W.gr = W.gr || {}; W.gr[a.p.id] = (W.gr[a.p.id] || 0) + v; };
  function engage(W, b, d, mode, push) {
    if (b.eng || d.eng) return null;
    // in space a quick second-level defender can slip a block (the blocker lunges and misses)
    if (mode === 'run' && d.x > 2.4 && !b.tried) {
      b.tried = d;
      const dq = (W.R(d.p, 'spd') + W.R(d.p, 'prc') + (W.R(d.p, 'bsh') || 60)) / 3, bq = (W.R(b.p, 'agi') + W.R(b.p, 'rbk')) / 2;
      if (chance(clamp(K.whiff + (dq - bq) / 100, 0.08, 0.6))) { b.stun = 0.45; b.tried = d; d.slow = 0.15; GR(W, b, -0.45); GR(W, d, 0.3); return null; }
    }
    const o = unit(d.x - b.x, d.y - b.y);
    const pr = { b, d, mode, prog: 0, thr: 0.85 + rnd() * 0.6, push: push || { x: 1, y: 0 }, o, t0: W.t };
    // the first punch: a defensive lineman can win the rep right away (slant, swim, a blown assignment)
    if (mode === 'run' && /DE|DT/.test(d.role) && b.side === 'o') {
      const bs = W.R(b.p, 'rbk') * 0.7 + W.R(b.p, 'str') * 0.3 + W.boost.run, ds = W.R(d.p, 'bsh') * 0.6 + W.R(d.p, 'str') * 0.25 + W.R(d.p, 'agi') * 0.15 + W.boost.box;
      if (chance(clamp(K.pen0 + (ds - bs) / 80, 0.04, 0.35))) pr.prog = pr.thr - 0.08 - rnd() * 0.12;
    }
    b.eng = pr; d.eng = pr; W.pairs.push(pr); (W.allPairs = W.allPairs || []).push(pr);
    return pr;
  }
  function shed(W, pr, why) {
    pr.done = true; pr.b.eng = null; pr.d.eng = null;
    pr.b.stun = 0.35 + rnd() * 0.3;
    pr.d.freed = W.t;
    if (why) pr.d.sheddedBy = pr.b;
    if (why) {
      // a lost rep: in pass protection before the throw it is a pressure; in the run game it is a lost gap
      const early = pr.mode === 'pass' ? W.phase !== 'air' && !W.throwT : !W.carrier || W.carrier.x < pr.d.x + 1;
      GR(W, pr.b, early ? (pr.mode === 'pass' ? -0.55 : -0.4) : -0.08); GR(W, pr.d, early ? (pr.mode === 'pass' ? 0.5 : 0.4) : 0.08);
    }
  }
  function runPairs(W) {
    for (const pr of W.pairs) {
      if (pr.done) continue;
      const b = pr.b, d = pr.d;
      let bs, ds, dir, v;
      if (pr.mode === 'pass') {
        bs = W.R(b.p, 'pbk') * 0.72 + W.R(b.p, 'str') * 0.14 + W.R(b.p, 'agi') * 0.14 + W.boost.pro;
        const fin = W.R(d.p, 'fmv') * 0.62 + W.R(d.p, 'spd') * 0.38, pow = W.R(d.p, 'pmv') * 0.62 + W.R(d.p, 'str') * 0.38;
        ds = Math.max(fin, pow) * 0.88 + W.R(d.p, 'awr') * 0.12 + W.boost.rush;
        const q = W.carrier && W.carrier !== W.qb ? W.carrier : W.qb;
        dir = unit(q.x - d.x, q.y - d.y);
        v = clamp(0.35 + (ds - bs) / 20 + gauss() * 0.15, -0.2, 2.4);
      } else {
        bs = W.R(b.p, 'rbk') * 0.7 + W.R(b.p, 'str') * 0.3 + W.boost.run;
        ds = W.R(d.p, 'bsh') * 0.6 + W.R(d.p, 'str') * 0.4 + W.boost.box;
        // the defender fights across toward the ball; the blocker drives him along the block
        const c = W.carrier || W.by.RB || W.qb;
        const toward = c ? unit(c.x - d.x, c.y - d.y) : { x: -1, y: 0 };
        const win = clamp(0.55 + (bs - ds) / 26 + gauss() * 0.3, -1.6, 2.4);
        dir = win >= 0 ? pr.push : toward;
        v = Math.abs(win) * (win >= 0 ? 0.9 : 0.45);
        if (W.t - pr.t0 < 0.25) v *= 0.4;
      }
      const mx = dir.x * v * DT, my = dir.y * v * DT;
      b.x += mx; b.y += my; d.x = b.x + pr.o.x * 0.95; d.y = b.y + pr.o.y * 0.95; d.x += mx * 0.02;
      // the contact point slowly turns toward where the defender wants to go
      const want = pr.mode === 'pass' ? unit(W.qb.x - b.x, W.qb.y - b.y) : unit(-pr.push.x, -pr.push.y);
      pr.o = unit(pr.o.x * 0.9 - want.x * 0.1 * (pr.mode === 'pass' ? -1 : -1), pr.o.y * 0.9 - want.y * 0.1 * (pr.mode === 'pass' ? -1 : -1));
      b.vx = mx / DT; b.vy = my / DT; d.vx = b.vx; d.vy = b.vy;
      // shedding: the edge in the matchup plus a little luck each tenth of a second
      const rate = pr.mode === 'pass' ? K.passShed + (ds - bs) / K.passShedD : K.runShed + (ds - bs) / K.runShedD;
      pr.prog += Math.max(0.03, rate + gauss() * 0.3) * DT;
      // a ball carrier running right past him: the defender can rip off the block to make the play
      if (pr.mode !== 'pass' && W.carrier && dist(d, W.carrier) < 1.8) pr.prog += K.nearShed + (W.R(d.p, 'bsh') - 70) / 500;
      if (pr.prog >= pr.thr) {
        // holding: a beaten blocker grabs
        const disc = b.p ? b.p.tr.disc : 60;
        const close = pr.mode === 'pass' ? true : (W.carrier && dist(d, W.carrier) < 3);
        if (!W.flag && close && W.phase !== 'dead' && chance((pr.mode === 'pass' ? K.holdP : K.holdR) * (1 + (60 - disc) / 55))) {
          W.flag = { on: 'o', kind: 'hold', p: b.p, t: W.t, x: b.x, y: b.y };
          W.ev.push({ t: W.t, text: 'FLAG', cls: 'flag' });
          pr.prog = pr.thr - 0.35; continue;
        }
        shed(W, pr, true);
      }
    }
    W.pairs = W.pairs.filter(p => !p.done);
  }
  function separate(W) {
    const A = W.ag;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i], b = A[j];
      if (a.eng && a.eng === b.eng) continue;
      if (a === W.carrier || b === W.carrier) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
      if (d < 0.7 && d > 1e-4) { const k = (0.7 - d) / 2 / d; if (!a.eng) { a.x -= dx * k; a.y -= dy * k; } if (!b.eng) { b.x += dx * k; b.y += dy * k; } }
    }
  }

  /* ---------- the ball carrier: read the space, pick a lane ---------- */
  function carry(W, c, gdir) {
    gdir = gdir || 1;
    const look = 0.75, vis = c.p ? W.R(c.p, 'bcv') : 70;
    const pursuers = W.ag.filter(a => a.side !== c.side && a.down <= 0);
    const late = W.GM.q === 4 || W.GM.q === 2;
    const lead = W.GM.score[W.s] - W.GM.score[W.ds];
    const wantOut = late && W.GM.clock <= 150 && lead <= 0 && W.ret == null && gdir === 1;
    let best = null, bestS = -1e9;
    const cur = Math.atan2(c.vy, c.vx * gdir);
    for (let k = -6; k <= 6; k++) {
      const th = k * 0.24;
      const ux = Math.cos(th) * gdir, uy = Math.sin(th);
      const sp = c.top * look;
      const px = c.x + ux * sp, py = c.y + uy * sp;
      let s = ux * gdir * sp * 1.05;
      for (const d of pursuers) {
        const w = d.eng ? K.engW : d.stun > 0 ? 0.4 : 1;
        const dx = d.x + d.vx * look * 0.55 - px, dy = d.y + d.vy * look * 0.55 - py;
        const dd = hyp(dx, dy);
        s -= w * 4.6 * Math.exp(-dd / 2.1);
        // closer defenders straight ahead matter more
        const nx = d.x - c.x, ny = d.y - c.y, nd = hyp(nx, ny);
        if (nd < 4 && nd > 0.1) { const cos = (nx * ux + ny * uy) / nd; if (cos > 0.6) s -= w * (4 - nd) * cos * 0.9; }
      }
      const marg = Math.min(py - W.lmin, W.lmax - py);
      if (marg < 2.2) s -= wantOut ? -(2.2 - marg) * 0.8 : (2.2 - marg) * 2.6;
      if (gdir === 1 && px >= W.toGoal) s += 3;
      s -= Math.abs(th - cur) * 0.9;            // keep momentum: hard cuts cost speed
      s += gauss() * (100 - vis) / 55;
      if (s > bestS) { bestS = s; best = { ux, uy, th }; }
    }
    const turn = Math.abs(best.th - cur);
    if (turn > 0.8 && spd(c) > 5) c.slow = Math.max(c.slow, 0.12 * (1 + (75 - c.agi) / 60));
    steer(c, c.x + best.ux * 6, c.y + best.uy * 6, 0.96, false);
  }
  // pursuit: aim where the runner will be, with a smarter angle for better pursuit/recognition
  function pursue(W, d, c, contain) {
    if (d.eng || d.stun > 0 || d.down > 0) return;
    const pur = d.p ? W.R(d.p, 'pur') : 65;
    // the intercept: when can I get to where he will be? (solve |c + v t - d| = my speed * t)
    const rx = c.x - d.x, ry = c.y - d.y, vx = c.vx, vy = c.vy, sp = d.top;
    const a = vx * vx + vy * vy - sp * sp, b = 2 * (rx * vx + ry * vy), cc = rx * rx + ry * ry;
    let t = null;
    if (Math.abs(a) < 1e-6) t = b < 0 ? -cc / b : null;
    else { const disc = b * b - 4 * a * cc; if (disc >= 0) { const r1 = (-b - Math.sqrt(disc)) / (2 * a), r2 = (-b + Math.sqrt(disc)) / (2 * a); t = [r1, r2].filter(x => x > 0).sort((x, y) => x - y)[0] || null; } }
    if (t == null) t = 2.5;
    // better pursuit players take a better angle; poor ones chase where he is
    const q = clamp(0.84 + (pur - 60) / 220 + gauss() * 0.04, 0.7, 1);
    t = Math.min(t, 3) * q;
    let tx = c.x + vx * t, ty = c.y + vy * t;
    if (contain) ty += contain * 1.2;
    tx = Math.max(tx, c.x - 0.5 * (c.gdir || 1));
    steer(d, tx, ty, 1, false);
  }
  // tackles: a defender within reach makes an attempt (one try per half-second); gang tackles help
  function tackles(W) {
    const c = W.carrier || (W.phase === 'pass' && W.ball.holder === W.qb ? W.qb : null); if (!c || W.phase === 'air' || W.done || W.phase === 'pitch') return;
    const near = W.ag.filter(a => a.side !== c.side && a.stun <= 0 && a.down <= 0 && dist(a, c) < (a.eng ? 0.95 : 1.05));
    near.sort((a, b) => dist(a, c) - dist(b, c));
    for (const d of near) {
      if ((d.tries[c.i] || -9) > W.t - 0.5) continue;
      d.tries[c.i] = W.t;
      const tq = W.R(d.p, 'tak') * 0.62 + W.R(d.p, 'hit') * 0.13 + W.R(d.p, 'pur') * 0.1 + W.R(d.p, 'str') * 0.15;
      const power = W.R(c.p, 'btk') * 0.62 + W.R(c.p, 'str') * 0.38, wiggle = W.R(c.p, 'elu') * 0.7 + W.R(c.p, 'agi') * 0.3;
      const cv = Math.max(power, wiggle);
      const cu = unit(c.vx || 1e-3, c.vy), toD = unit(d.x - c.x, d.y - c.y);
      const head = cu.x * toD.x + cu.y * toD.y; // > 0: the defender is in front
      const helpers = W.ag.filter(a => a !== d && a.side !== c.side && !a.eng && a.down <= 0 && dist(a, c) < 1.7).length;
      const sp = spd(c);
      let p = K.tk0 + (tq - cv) / K.tkD + (head > 0.3 ? K.tkHead : head < -0.3 ? -K.tkBack : 0) + helpers * K.tkHelp - Math.max(0, sp - 7) * 0.03;
      if (c === W.qb && W.phase === 'pass') p = K.sackP + (tq - (W.R(c.p, 'agi') * 0.5 + W.R(c.p, 'str') * 0.5)) / 90;
      p = clamp(p, 0.45, 0.97);
      // a defender still engaged with a blocker can only reach out for him
      if (d.eng) { p *= K.tkEng; }
      if (chance(p)) {
        const ast = W.ag.filter(a => a !== d && a.side !== c.side && !a.eng && a.down <= 0 && dist(a, c) < 1.6).sort((a, b) => dist(a, c) - dist(b, c))[0] || null;
        const fall = clamp(0.35 + (W.R(c.p, 'str') - W.R(d.p, 'hit')) / 70 + sp * 0.07 + (head > 0.3 ? -0.5 : 0.2) + gauss() * 0.35, -0.8, 2.3);
        const gd = c.gdir || 1;
        c.x += gd * fall * (Math.abs(cu.x) > 0.3 ? Math.sign(cu.x * gd) : 1);
        c.down = 2; d.down = 1.2; if (ast) ast.down = 1;
        if (d.eng) { const pr = d.eng; pr.done = true; pr.b.eng = null; pr.d.eng = null; }
        W.tackle = { by: d, ast, t: W.t, eng: !!d.eng, freed: d.freed != null, unb: !d.freed && !d.eng };
        // fumbles come out on the hits
        const fp = 0.0105 * (1 + (72 - (c.p.at.car || 65)) / 28) * ((d.p.at.hit || 65) / 72) * (helpers ? 1.25 : 1);
        if (chance(fp)) W.fumble = { by: d, t: W.t };
        return end(W, 'tackle');
      }
      if (d.eng) { c.slow = 0.2; continue; }
      d.down = 0.75 + rnd() * 0.35; d.stun = 0.4; c.slow = 0.25;
      W.broke = W.broke || [];
      W.broke.push({ d, how: power >= wiggle ? 'breaks the tackle of' : 'makes ' + last(d.p) + ' miss' }); GR(W, d, -0.8); GR(W, c, 0.5);
      W.ev.push({ t: W.t, text: power >= wiggle ? 'BROKEN TACKLE' : 'MISSED TACKLE', cls: 'good small' });
    }
  }
  function end(W, why) {
    if (W.done) return;
    W.done = why; W.phase = 'dead'; W.tEnd = W.t;
  }

  /* ---------- the defense before and after the snap ---------- */
  function defAssign(W) {
    const C = W.C, O = W.by;
    const elig = ELIG.map(k => O[k]).filter(a => a && a.side === 'o');
    const man = {};
    if (C.man) {
      const wants = elig.slice();
      const take = (role, pred) => { const i = wants.findIndex(pred); if (i < 0) return null; const r = wants[i]; wants.splice(i, 1); return r; };
      const outL = elig.filter(a => !/RB|FB/.test(a.role)).sort((a, b) => a.y - b.y)[0], outR = elig.filter(a => !/RB|FB/.test(a.role)).sort((a, b) => b.y - a.y)[0];
      C.man.forEach(role => {
        const d = W.by[role]; if (!d || d.side !== 'd') return;
        let r = null;
        if (role === 'CB1') r = take(role, a => a === outL);
        else if (role === 'CB2') r = take(role, a => a === outR);
        if (!r && /CB|NB|S/.test(role)) r = take(role, a => /WR/.test(a.role)) || take(role, a => /TE/.test(a.role));
        if (!r && /LB/.test(role)) r = take(role, a => /TE/.test(a.role)) || take(role, a => /RB|FB/.test(a.role));
        if (!r) r = take(role, () => true);
        if (r) { man[role] = r; d.man = r; d.task = 'man'; } else { d.task = 'zone'; d.zone = 'hkM'; }
      });
    }
    if (C.zone) for (const role in C.zone) { const d = W.by[role]; if (d && d.side === 'd' && !d.man) { d.task = 'zone'; d.zone = C.zone[role]; } }
    const rushers = ['DE1', 'DT1', 'DT2', 'DE2'].filter(r => !(C.drop || []).includes(r)).concat(C.rush || []);
    rushers.forEach(r => { const d = W.by[r]; if (d && d.side === 'd') { d.task = 'rush'; d.zone = null; d.man = null; } });
    W.ag.filter(a => a.side === 'd' && !a.task).forEach(a => { a.task = 'zone'; a.zone = /S/.test(a.role) ? 'dM3' : 'hkM'; });
    W.rushers = W.ag.filter(a => a.side === 'd' && a.task === 'rush');
    // recognition time for each defender (play recognition; play action and RPOs slow the second level)
    W.ag.filter(a => a.side === 'd').forEach(a => { a.rec = clamp(0.55 - (W.R(a.p, 'prc') - 60) / 140 + gauss() * 0.08 - W.boost.read, 0.12, 0.95); });
  }
  // zone and man coverage, run fits and the pass rush, before the defense knows (or after it knows) what the play is
  function defense(W) {
    const run = W.isRun && W.t > 0.15;
    // on a run the defense plays the ball wherever it is (the mesh, then the runner)
    const c = W.carrier || (W.isRun && W.phase === 'run' ? (W.ball.holder || W.by.RB || W.qb) : null);
    for (const d of W.ag) {
      if (d.side !== 'd' || d.eng || d.stun > 0 || d.down > 0) continue;
      const knows = W.t >= d.rec + (W.pa && /LB|S|NB/.test(d.role) ? W.pa : 0);
      // after a throw: break on the ball
      if (W.phase === 'air' && W.ball.fl) {
        if (W.t >= W.ball.fl.t0 + (d.rb || 0.3)) { const L = W.ball.fl; const tleft = L.t1 - W.t; const reach = dist(d, { x: L.x1, y: L.y1 }) <= d.top * (tleft + 0.35); steer(d, reach ? L.x1 : L.x1 + (d.x - L.x1) * 0.2, reach ? L.y1 : L.y1 + (d.y - L.y1) * 0.2, 1, false); continue; }
      }
      if (c && (W.phase === 'run' || W.phase === 'yac' || W.phase === 'scr') && (knows || dist(d, c) < 4) && !(W.isRun && !W.carrier && d.task === 'rush')) {
        // deep players protect the deep part of the field until the runner gets close
        const deep = d.zone && /^d|^q|^pd|mid/.test(d.zone);
        if (deep && c.x < 3 && W.t < 1.2 && W.phase === 'run') { steer(d, Math.max(d.x - 0.4, 7), d.y * 0.9 + c.y * 0.1, 0.5); continue; }
        // a man defender whose receiver is blocking him sticks with the receiver until he recognizes the run
        const contain = /DE|CB/.test(d.role) && Math.abs(c.y - d.y) < 6 && c.x < 1 ? Math.sign(d.y - c.y) : 0;
        pursue(W, d, c, contain);
        continue;
      }
      if (d.task === 'rush') {
        const q = W.qb;
        if (!run || !knows) { const tx = q.x + (d.y < q.y ? -0.4 : 0.4), ty = q.y + (d.y < q.y ? -0.6 : 0.6); steer(d, tx, ty, 1, false); }
        else if (c) pursue(W, d, c);
        continue;
      }
      if (d.task === 'man' && d.man) {
        const r = d.man;
        if (run && knows && c) { pursue(W, d, c); continue; }
        const mcv = W.R(d.p, 'mcv'), rr = r.p ? W.R(r.p, r.route && /go|fade|seam|post|corner|wheel|sluggo/.test(r.route) ? 'drr' : 'srr') : 70;
        let lag = clamp(0.26 + (rr - mcv) / 95 + (topSpd(r.p.at.spd) - d.top) * 0.05 + (d.beat || 0) - W.boost.sep * 0.08, 0.05, 0.8);
        if (r.route === 'block' || (r.task === 'block' && r.eng)) lag = 0.2;
        const pp = past(r, lag), pv = past(r, lag + 0.1);
        const vx = (pp.x - pv.x) / 0.1, vy = (pp.y - pv.y) / 0.1;
        const inside = r.y < 0 ? 1 : -1;
        const cushion = r.x > 8 ? 0.9 : 0.4;
        steer(d, pp.x + vx * lag * 0.85 + cushion, pp.y + vy * lag * 0.85 + inside * 0.5, 1, false);
        continue;
      }
      // zone
      const Z = zoneXY(W, d.zone || 'hkM');
      const deepZ = /^d|^q|^pd|mid/.test(d.zone || '');
      // play-action / run fake: the second level steps up first
      if (W.pa && W.t < W.pa && /LB|S1|NB/.test(d.role) && !deepZ) { steer(d, d.x - 0.8, d.y, 0.5); continue; }
      if (!knows) { steer(d, d.x + (deepZ ? 0.6 : 0.2), d.y, 0.4); continue; }
      // match the most dangerous receiver in or near the zone
      const recv = W.ag.filter(a => a.side === 'o' && a.route && a.route !== 'block' && a !== W.qb);
      let tgt = null, best = 1e9;
      const zw = { L3: 9.5, R3: 9.5, M: 9, Lh: 13.5, Rh: 13.5, L4: 7.5, L4i: 7.5, R4i: 7.5, R4: 7.5 }[ZL[d.zone || 'hkM'].z] || 7.5;
      for (const r of recv) {
        const inZone = deepZ ? (r.x > Z.x - 7 && Math.abs(r.y - Z.y) < zw + (r.x > 15 ? 2 : 0)) : (Math.abs(r.y - Z.y) < 7.5 && r.x < Z.x + 7 && r.x > -1);
        if (!inZone) continue;
        const dd = hyp(r.x - Z.x, r.y - Z.y) - (deepZ ? r.x * 0.3 : 0);
        if (dd < best) { best = dd; tgt = r; }
      }
      const zcv = W.R(d.p, 'zcv');
      if (tgt) {
        const pr = past(tgt, clamp(0.35 - (zcv - 60) / 150, 0.08, 0.5));
        // deep: stay on top with a cushion; underneath: wall off the route from the landmark, not on top of him
        if (deepZ) { const fut = predict(tgt, 0.4); steer(d, Math.max(fut.x + 2.2, Z.x), fut.y * 0.7 + Z.y * 0.3, 1, false); }
        else steer(d, clamp(pr.x * 0.55 + Z.x * 0.45, Z.x - 2.5, Z.x + 3.5), pr.y * 0.55 + Z.y * 0.45, 0.95, true);
      } else {
        // nobody here: sink to the landmark and watch the quarterback
        const q = W.qb; const ly = Z.y * 0.85 + q.y * 0.15;
        steer(d, Z.x, ly, deepZ ? 0.9 : 0.75);
      }
    }
  }

  /* ---------- the run game ---------- */
  function runBlocking(W, scheme, sgn) {
    const O = W.by;
    const ol = ['LT', 'LG', 'C', 'RG', 'RT'].map(k => O[k]);
    const front = W.ag.filter(a => a.side === 'd' && a.x < 7.5 && Math.abs(a.y) < 9.5 && !/^S2$/.test(a.role) && !(a.zone && /^d|^q|^pd/.test(a.zone)));
    const claimed = new Set();
    const order = sgn > 0 ? ol.slice().reverse() : ol.slice();
    const push = { x: 0.55, y: sgn * 0.84 };
    const readKey = scheme.sch === 'read' || scheme.sch === 'triple' || scheme.sch === 'speedopt' ? (scheme.sch === 'speedopt' || scheme.sch === 'triple' ? (sgn > 0 ? W.by.DE2 : W.by.DE1) : (sgn > 0 ? W.by.DE1 : W.by.DE2)) : null;
    if (readKey) { claimed.add(readKey); W.readKey = readKey; }
    // pullers
    const pullRoles = (scheme.pull || []).map(x => ({ bsG: sgn > 0 ? 'LG' : 'RG', bsT: sgn > 0 ? 'LT' : 'RT', psG: sgn > 0 ? 'RG' : 'LG', psT: sgn > 0 ? 'RT' : 'LT' })[x]);
    const hole = sgn * scheme.ap;
    order.forEach(b => {
      if (!b) return;
      if (pullRoles.includes(b.role)) {
        b.task = 'pull';
        const kick = scheme.sch === 'gap' && pullRoles.indexOf(b.role) === 0;
        b.path = [{ x: -1.7, y: b.y + sgn * 0.6 }, { x: -1.2, y: hole - sgn * (kick ? 0.6 : 1.4) }, { x: 1.2, y: hole + sgn * (kick ? 1.6 : 0.4) }];
        b.pi = 0; return;
      }
      // the defender in my playside gap, else the man over me, else climb to a linebacker
      const gapY = b.y + sgn * (scheme.sch === 'ozone' || scheme.sch === 'toss' ? 1.8 : 0.9);
      let tgt = null, best = 9;
      for (const d of front) {
        if (claimed.has(d) || d.x > 3) continue;
        const dd = Math.abs(d.y - gapY) + (d.x - 1) * 0.3;
        if (dd < best && Math.abs(d.y - b.y) < 3.2) { best = dd; tgt = d; }
      }
      if (!tgt) {
        let b2 = 99;
        for (const d of front) { if (claimed.has(d) || d.x <= 3) continue; const dd = Math.abs(d.y - (b.y + sgn * 1.2)); if (dd < b2 && Math.abs(d.y - b.y) < 6) { b2 = dd; tgt = d; } }
        b.climb = 0.45;
      }
      if (tgt) claimed.add(tgt);
      b.task = 'rblock'; b.tgt = tgt; b.push = push;
    });
    // tight ends and fullbacks: the edge and the linebacker in the hole
    ['TE', 'TE2', 'FB'].forEach(k => {
      const a = O[k]; if (!a) return;
      const ps = Math.sign(a.y || sgn) === sgn;
      let tgt = null, best = 99;
      for (const d of front) {
        if (claimed.has(d)) continue;
        const want = k === 'FB' ? hole : a.y + sgn * 0.8;
        const dd = Math.abs(d.y - want) + (k === 'FB' ? Math.max(0, 3 - d.x) * 0.4 : 0);
        if (dd < best) { best = dd; tgt = d; }
      }
      if (tgt) claimed.add(tgt);
      a.task = 'rblock'; a.tgt = tgt; a.push = ps ? push : { x: 0.7, y: -sgn * 0.7 }; a.route = null;
      if (k === 'FB') a.lead = true;
    });
    // receivers stalk the defensive backs over them
    ['WR1', 'WR2', 'WR3', 'WR4'].forEach(k => {
      const a = O[k]; if (!a || a === W.carrier || a.task === 'carry') return;
      const cands = W.ag.filter(d => d.side === 'd' && /CB|NB|S/.test(d.role) && !claimed.has(d));
      let tgt = null, best = 99;
      for (const d of cands) { const dd = dist(a, d); if (dd < best) { best = dd; tgt = d; } }
      if (tgt) claimed.add(tgt);
      a.task = 'stalk'; a.tgt = tgt; a.push = { x: 0.8, y: Math.sign(a.y) * 0.6 };
    });
  }
  function offBlock(W) {
    for (const a of W.ag) {
      if (a.side !== 'o' || a.eng || a.stun > 0 || a.down > 0) continue;
      if (a.task === 'pull') {
        const done = follow(a, 0.92);
        const free = W.ag.filter(d => d.side === 'd' && !d.eng && d.down <= 0 && dist(a, d) < 1.6);
        if (free.length) { engage(W, a, free[0], 'run', { x: 0.3, y: Math.sign(free[0].y - a.y) || 1 }); continue; }
        if (done) a.task = 'climb';
        continue;
      }
      if (a.task === 'rblock' || a.task === 'stalk' || a.task === 'climb') {
        if (a.climb && W.t < a.climb) { steer(a, a.x + 0.4, a.y + (a.push ? a.push.y * 0.4 : 0), 0.5); continue; }
        let t = a.tgt;
        if (!t || t.eng || t.down > 0 || (a.task === 'climb')) {
          // find someone to block near the ball
          const c = W.carrier || W.by.RB || W.qb;
          let best = 99; t = null;
          for (const d of W.ag) { if (d.side !== 'd' || d.eng || d.down > 0) continue; const dd = dist(a, d) + dist(d, c) * 0.5; if (dd < best && dist(a, d) < 6) { best = dd; t = d; } }
          a.tgt = t;
        }
        if (!t) { steer(a, a.x + 0.8, a.y, 0.4); continue; }
        const range = a.task === 'stalk' ? 1.2 : 1.05;
        if (dist(a, t) < range) {
          const pr = engage(W, a, t, 'run', a.push || { x: 1, y: 0 });
          if (pr && a.task === 'stalk') pr.thr += 0.6;
          continue;
        }
        // at the line: fire straight into him; at the second level: take an angle between him and the ball (never backward)
        const c = W.carrier || W.by.RB || W.qb;
        if (t.x < 2.6 && a.task !== 'stalk') { steer(a, t.x, t.y + (a.push ? -a.push.y * 0.3 : 0), 1, false); continue; }
        const k = a.task === 'stalk' ? 0.22 : 0.25;
        steer(a, Math.max(t.x + (c.x - t.x) * k, a.x + 0.2), t.y + (c.y - t.y) * k, a.task === 'stalk' ? 0.85 : 1, false);
        continue;
      }
      if (a.task === 'pro') protect(W, a);
    }
  }

  /* ---------- the pass game ---------- */
  function passPro(W) {
    const ol = ['LT', 'LG', 'C', 'RG', 'RT'].map(k => W.by[k]).filter(Boolean);
    const rush = W.rushers.slice().sort((a, b) => a.y - b.y);
    const extra = ['TE', 'TE2', 'RB', 'FB'].map(k => W.by[k]).filter(a => a && a.route === 'block');
    const blockers = ol.concat(extra);
    blockers.forEach(b => { b.task = 'pro'; b.tgt = null; b.route = null; });
    // inside-out: each rusher to the nearest free blocker by width
    const free = blockers.slice();
    rush.slice().sort((a, b) => Math.abs(a.y) - Math.abs(b.y)).forEach(r => {
      let bi = -1, best = 99;
      free.forEach((b, i) => { const dd = Math.abs(b.y - r.y) + (b.role === 'RB' ? 1.5 : 0); if (dd < best) { best = dd; bi = i; } });
      if (bi >= 0 && best < 5.5) { free[bi].tgt = r; free.splice(bi, 1); }
    });
    W.unblocked = rush.filter(r => !blockers.some(b => b.tgt === r));
  }
  function protect(W, b) {
    const q = W.qb;
    let t = b.tgt;
    if (!t || t.eng || t.down > 0 || t.task !== 'rush') {
      let best = 99; t = null;
      for (const d of W.ag) { if (d.side !== 'd' || d.eng || d.down > 0 || d.task !== 'rush') continue; const dd = dist(b, d); if (dd < best && dd < 4.5) { best = dd; t = d; } }
      b.tgt = t;
    }
    // set: get between the rusher and the quarterback (tackles kick-slide)
    const home = { x: Math.max(q.x + 2.6, b.x0 - 1.4 - (/T$/.test(b.role) ? 0.6 : 0)), y: b.y0 * 1.05 };
    if (!t) { steer(b, home.x, home.y, 0.5); return; }
    if (dist(b, t) < 1.0) { engage(W, b, t, 'pass'); return; }
    const k = 0.42;
    steer(b, t.x + (q.x - t.x) * k, t.y + (q.y - t.y) * k, 0.95);
  }
  function routes(W, concept) {
    for (const k of ELIG) {
      const a = W.by[k]; if (!a || a === W.qb) continue;
      let rt = concept[k] || (k === 'RB' || k === 'FB' ? 'check' : 'go');
      if (rt === 'run') rt = 'block';
      a.route = rt;
      if (rt === 'block') { if (!W.isRun) a.task = /WR/.test(k) ? 'stalk' : 'pro'; continue; }
      const side = a.y < -0.5 ? -1 : a.y > 0.5 ? 1 : (k === 'RB' ? (a.y0 >= 0 ? 1 : -1) : 1);
      const inside = -side;
      const pts = RT[rt] || RT.go;
      a.path = pts.map(([f, l]) => ({ x: Math.min(a.x0 + f, W.toGoal + 9.4), y: clamp(a.y0 + l * inside * (k === 'RB' || k === 'FB' ? -1 : 1), W.lmin + 0.8, W.lmax - 0.8) }));
      a.pi = 0; a.task = 'route';
      // when the route is ready to be thrown: at the break (vertical routes once they are past the defender's cushion)
      const w0 = a.path[0], d0 = hyp(w0.x - a.x0, w0.y - a.y0);
      a.breakT = a.path.length > 1 ? d0 / (a.top * 0.8) + 0.45 : 1.6;
      if (/bubble|screen|tunnel|swing|flat|check/.test(rt)) a.breakT = Math.min(a.breakT, 0.7);
      a.stopAtEnd = /hitch|curl|stick|snag|comeback|spot/.test(rt);
      // press at the line: release vs press
      const cb = W.ag.find(d => d.side === 'd' && d.man === a);
      if (cb && W.C.press && /WR/.test(k)) {
        const edge = (W.R(a.p, 'rls') || 65) - (W.R(cb.p, 'prs') || 65);
        if (edge < 0 && chance(0.55)) a.jam = clamp(0.25 - edge / 90, 0.1, 0.6); else if (edge > 4 && chance(0.4)) cb.beat = 0.12;
      }
    }
  }
  function receivers(W) {
    for (const a of W.ag) {
      if (a.side !== 'o' || a === W.qb || a === W.carrier || a.task !== 'route' || a.eng) continue;
      if (a.jam && W.t < a.jam) { steer(a, a.x + 0.2, a.y, 0.3); continue; }
      // once the ball is in the air to someone else, everyone else turns into a blocker
      if (W.phase === 'air' && W.ball.fl && W.ball.fl.to !== a) { steer(a, W.ball.fl.x1, W.ball.fl.y1, 0.7); continue; }
      if (W.phase === 'air' && W.ball.fl && W.ball.fl.to === a) {
        // the receiver keeps running his route and tracks the ball late in its flight
        const L = W.ball.fl;
        if (W.t >= Math.max(L.t0 + 0.15, L.t1 - 0.7)) { steer(a, L.x1, L.y1, 1, W.t > L.t1 - 0.3); continue; }
      }
      if (W.phase === 'yac' || W.phase === 'scr') { // block for the runner
        const c = W.carrier; let best = 99, t = null;
        for (const d of W.ag) { if (d.side !== 'd' || d.eng || d.down > 0) continue; const dd = dist(a, d) + dist(d, c) * 0.6; if (dd < best) { best = dd; t = d; } }
        if (t && dist(a, t) < 1.1 && dist(t, c) < 8) { engage(W, a, t, 'run', unit(t.x - c.x, t.y - c.y)); continue; }
        if (t) steer(a, t.x + (c.x - t.x) * 0.3, t.y + (c.y - t.y) * 0.3, 0.9, false);
        continue;
      }
      // scramble drill: break off and find space
      if (W.scramble) { steer(a, a.x + 2, a.y + (W.qb.y - a.y) * 0.15, 0.6); continue; }
      follow(a, 1);
    }
  }
  // how open would a receiver be when a throw got there?
  function openness(W, r) {
    const q = W.qb, vb = W.vb;
    let C = predict(r, 0.6);
    for (let k = 0; k < 2; k++) { const tf = hyp(C.x - q.x, C.y - q.y) / vb + 0.12; C = predict(r, tf); }
    const tf = hyp(C.x - q.x, C.y - q.y) / vb + 0.12;
    let dmin = 99;
    for (const d of W.ag) {
      if (d.side !== 'd' || d.down > 0) continue;
      const reach = d.eng ? 0 : Math.min(d.top * tf * 0.55, 3.5);
      const dd = hyp(d.x + d.vx * tf * 0.5 - C.x, d.y + d.vy * tf * 0.5 - C.y) - reach * 0.35;
      if (dd < dmin) dmin = dd;
      // lanes: a defender sitting in the path of the throw
      const lx = C.x - q.x, ly = C.y - q.y, L2 = lx * lx + ly * ly;
      if (L2 > 4 && !d.eng) { const u = ((d.x - q.x) * lx + (d.y - q.y) * ly) / L2; if (u > 0.2 && u < 0.9) { const px = q.x + lx * u, py = q.y + ly * u, off = hyp(d.x - px, d.y - py); if (off < 1.1 && C.x > 5) dmin = Math.min(dmin, off + 0.4); } }
    }
    return { C, tf, open: dmin };
  }
  function qbBrain(W) {
    const q = W.qb, GM = W.GM;
    if (q !== W.ball.holder || W.phase !== 'pass') return;
    const t = W.t, awr = W.R(q.p, 'awr');
    // pressure: the nearest free rusher (a quarterback needs a moment to feel it; blindside rushers take longer)
    let pr = null, pd = 99;
    for (const d of W.ag) { if (d.side !== 'd' || d.eng || d.down > 0 || d.stun > 0) continue; const dd = dist(d, q); if (dd < pd && d.x < q.x + 4) { pd = dd; pr = d; } }
    const near = pd < 3.2;
    if (near && W.feel == null) W.feel = t + clamp(0.32 - (awr - 70) / 200 + (pr && pr.y < q.y - 1 ? 0.1 : 0) + gauss() * 0.06, 0.08, 0.6);
    if (!near) W.feel = null;
    const pressured = near && t >= W.feel;
    if (pressured && !W.pressure) { W.pressure = true; W.pressT = t; }
    // the quarterback processes in beats, not every instant
    if (W.nextLook != null && t < W.nextLook && !(pressured && pd < 1.4)) { if (t >= W.dropT) steer(q, W.dropTo.x + 0.6, W.dropTo.y, 0.25); return; }
    W.nextLook = t + 0.2;
    // the drop, then the pocket: slide away from pressure, step up
    if (t < W.dropT) { steer(q, W.dropTo.x, W.dropTo.y, 0.9, true); }
    else if (pr && pd < 4.5) { const away = unit(q.x - pr.x, q.y - pr.y); steer(q, q.x + away.x * 1.5 + 0.5, clamp(q.y + away.y * 1.8, -4.5, 4.5), 0.55); }
    else steer(q, W.dropTo.x + 0.8, W.dropTo.y, 0.3);
    if (t < W.readT) {
      if (pressured && pd < 1.6) return decide(W, q, pr, pd, true);
      return;
    }
    return decide(W, q, pr, pd, pressured);
  }
  function decide(W, q, pr, pd, pressured) {
    const t = W.t, awr = W.R(q.p, 'awr'), GM = W.GM;
    const order = W.order;
    const per = clamp(0.56 - (awr - 70) / 260, 0.36, 0.72);
    const idx = Math.min(order.length - 1, Math.floor((t - W.readT) / per));
    const sticks = GM.down >= 3 ? GM.togo : 0;
    const gun = q.p.arch === 'Gunslinger' ? 0.35 : 0;
    // look at the receivers through the progression (with a peek at the next one)
    const look = order.slice(0, idx + 2);
    // the checkdown: when he is pressured or the first reads are taking too long, the back in the flat is always an option
    if (pressured || t - W.readT > 0.9) order.forEach(r => { if (r && /RB|FB/.test(r.role) && !look.includes(r)) look.push(r); });
    let best = null, bestScore = -9;
    for (let i = 0; i < look.length; i++) {
      const r = look[i]; if (!r || r.eng || r.down > 0) continue;
      if (W.t < (r.breakT || 0) - (awr - 60) / 160) continue;      // not into his route yet (smart passers throw it a beat early)
      const o = openness(W, r);
      const depth = o.C.x;
      let need = depth > 17 ? 2.1 : depth > 8 ? 1.5 : 1.15;
      need -= (t - W.readT) * 0.22 + (pressured ? 0.55 : 0) + gun;
      if (i > idx && !/RB|FB/.test(r.role)) need += 0.6;
      if (/RB|FB/.test(r.role) && r.route === 'check') need -= 0.3;    // the dump-off is an easy throw
      if (/RB|FB/.test(r.role) && i < order.length - 1) need += 0.25;    // backs are the outlet, not the first read
      if (sticks && depth < sticks - 0.5 && t < W.readT + 1.2) need += 0.75;
      if (depth > W.toGoal + 8) continue;
      const seen = o.open + gauss() * (100 - awr) / 55;
      const score = seen - need + Math.min(depth, 25) * 0.02;
      if (seen >= need && score > bestScore) { bestScore = score; best = { r, o }; }
    }
    if (best) return throwTo(W, best.r, best.o, pressured);
    // under pressure with nothing there: escape, throw it away or go down
    if (pressured) {
      const qs = W.R(q.p, 'spd'), lane = W.ag.filter(d => d.side === 'd' && !d.eng && d.down <= 0 && d.x > q.x && d.x < q.x + 5 && Math.abs(d.y - q.y) < 3.2).length === 0;
      if ((qs >= 76 || (qs >= 68 && chance(0.35))) && lane && chance(0.55)) { W.phase = 'scr'; W.carrier = q; W.scramble = true; W.ev.push({ t: W.t, text: 'SCRAMBLE', cls: 'meh' }); return; }
      if ((t > W.readT + 1.2 || q.x > -3 || Math.abs(q.y) > 4) && chance(0.35 + (W.R(q.p, 'tup') - 60) / 120)) return throwAway(W);
    }
    if (t > 6.2) return throwAway(W);
  }
  function throwTo(W, r, o, pressured) {
    const q = W.qb, GM = W.GM;
    const depth = o.C.x;
    const acc = W.R(q.p, depth > 18 ? 'dac' : depth > 9 ? 'mac' : 'sac');
    const moving = spd(q) > 2.5 ? 1.2 : 1;
    let sd = (0.42 + Math.max(0, depth) * 0.022 + Math.max(0, depth - 15) * 0.03) * (1 + (82 - acc) / 42) * (pressured ? 1.35 : 1) * moving;
    if (pressured && q.p.tr.tup < 45) sd *= 1.2;
    sd = clamp(sd, 0.25, 3.2);
    const x1 = o.C.x + gauss() * sd * 0.9, y1 = o.C.y + gauss() * sd;
    const tf = hyp(x1 - q.x, y1 - q.y) / W.vb + 0.12;
    W.ball.fl = { x0: q.x, y0: q.y, x1, y1, t0: W.t, t1: W.t + tf, to: r, peak: 0.6 + Math.max(0, hyp(x1 - q.x, y1 - q.y)) * 0.07, sd, pressured };
    W.ball.holder = null; W.phase = 'air'; W.throwT = W.t; W.target = r; W.air = Math.round(x1);
    // defenders react to the throw at different speeds
    W.ag.forEach(d => { if (d.side === 'd') d.rb = clamp(0.46 - (W.R(d.p, 'prc') - 60) / 220 - (W.R(d.p, (d.man ? 'mcv' : 'zcv')) - 60) / 450 + gauss() * 0.06, 0.18, 0.7); });
  }
  function throwAway(W) {
    const q = W.qb;
    const side = q.y >= 0 ? 1 : -1;
    W.ball.fl = { x0: q.x, y0: q.y, x1: Math.max(q.x + 6, 2), y1: side > 0 ? W.lmax + 2 : W.lmin - 2, t0: W.t, t1: W.t + 0.9, to: null, peak: 3, away: true };
    W.ball.holder = null; W.phase = 'air'; W.throwT = W.t; W.away = true;
    W.ev.push({ t: W.t + 0.9, text: 'THROWN AWAY', cls: 'meh' });
  }
  function catchBall(W) {
    const L = W.ball.fl, r = L.to;
    if (L.away || !r) { W.result = 'inc'; W.incNote = 'away'; return end(W, 'inc'); }
    const bx = L.x1, by = L.y1;
    // out of bounds or past the end line
    if (by < W.lmin || by > W.lmax || bx > W.toGoal + 10) { W.result = 'inc'; W.ev.push({ t: W.t, text: 'INCOMPLETE', cls: 'meh' }); return end(W, 'inc'); }
    const dr = hyp(r.x - bx, r.y - by);
    let defs = W.ag.filter(d => d.side === 'd' && d.down <= 0 && !d.eng).map(d => ({ d, dd: hyp(d.x - bx, d.y - by) })).sort((a, b) => a.dd - b.dd);
    const top = defs[0];
    const reach = 1.05 + ((r.p.at.spc || 60) - 60) / 110;
    const cth = W.R(r.p, 'cth'), cit = W.R(r.p, 'cit') || cth;
    const crad = bx > 15 ? 2.4 : 1.8;
    const contested = top && top.dd < crad;
    W.catchDiag = { dr, dd: top ? top.dd : 99 };
    // a defender clearly in better position than the receiver: a pick or a breakup
    if (top && top.dd < 0.9 && top.dd < dr - 0.35) {
      const dc = W.R(top.d.p, 'cth') || 55;
      if (chance(clamp(K.intOnTop + (dc - 60) / 260, 0.04, 0.3) * (bx > 15 ? 0.7 : 1))) return intercept(W, top.d);
      if (chance(0.42)) { W.result = 'inc'; W.pd = top.d; W.ev.push({ t: W.t, text: 'BROKEN UP', cls: 'meh' }); return end(W, 'inc'); }
    }
    if (dr > reach + 0.6) {
      if (top && top.dd < 0.8 && chance(0.1 * ((W.R(top.d.p, 'cth') || 55) / 70))) return intercept(W, top.d);
      W.result = 'inc'; W.overthrow = true; W.ev.push({ t: W.t, text: 'INCOMPLETE', cls: 'meh' }); return end(W, 'inc');
    }
    let pc = K.catch0 - Math.max(0, dr - 0.5) * 0.26 - (100 - cth) / 420;
    if (contested) pc -= (crad - top.dd) * K.contest * (1 + ((W.R(top.d.p, top.d.man ? 'mcv' : 'zcv') - cit) / 70)) * (bx > 15 ? 1.15 : 1);
    if (bx > 18) pc -= 0.08;     // tracking a deep ball over the shoulder
    if (L.pressured) pc -= 0.03;
    pc = clamp(pc, 0.06, 0.97);
    if (!chance(pc)) {
      if (contested) {
        // the defender knocks it away (or picks it) - or got there through the receiver
        if (chance(K.intCont * ((W.R(top.d.p, 'cth') || 55) / 70))) return intercept(W, top.d);
        if (bx > 6 && top.d.man && chance(0.075 + (W.R(top.d.p, 'prs') < 65 ? 0.02 : 0))) { W.result = 'inc'; W.dpi = top.d; W.flag = { on: 'd', kind: 'dpi', p: top.d.p, t: W.t, x: bx, y: by }; W.ev.push({ t: W.t, text: 'FLAG', cls: 'flag' }); return end(W, 'inc'); }
        W.result = 'inc'; W.pd = top.d; W.ev.push({ t: W.t, text: 'BROKEN UP', cls: 'meh' }); return end(W, 'inc');
      }
      if (dr > 0.95) { W.result = 'inc'; W.ev.push({ t: W.t, text: 'INCOMPLETE', cls: 'meh' }); return end(W, 'inc'); }
      W.result = 'inc'; W.drop = true; W.ev.push({ t: W.t, text: 'DROPPED', cls: 'meh' }); return end(W, 'inc');
    }
    // caught
    r.x = bx + (r.x - bx) * 0.3; r.y = by + (r.y - by) * 0.3;
    W.ball.holder = r; W.ball.fl = null; W.phase = 'yac'; W.carrier = r; r.gdir = 1;
    W.catchX = bx; W.caught = true;
    // pass interference? a man defender who arrived early and through the receiver
    W.ev.push({ t: W.t, text: 'CAUGHT', cls: 'good small' });
    if (contested && top && chance(0.3)) { /* contact on the catch: a fight for extra yards */ r.slow = 0.3; }
  }
  function intercept(W, d) {
    W.ball.holder = d; W.ball.fl = null; W.phase = 'ret'; W.carrier = d; d.gdir = -1; d.task = 'carry';
    W.int = d; W.intX = d.x; W.ret = 0;
    W.ev.push({ t: W.t, text: 'INTERCEPTED', cls: 'bad' });
  }

  /* ---------- running the snap ---------- */
  function record(W) {
    const f = new Array(W.ag.length * 2);
    W.ag.forEach((a, i) => { f[i * 2] = Math.round(a.x * 100) / 100; f[i * 2 + 1] = Math.round(a.y * 100) / 100; });
    const b = W.ball;
    let bx, by, bz, h = -1;
    if (b.holder) { bx = b.holder.x; by = b.holder.y; bz = 0.6; h = b.holder.i; }
    else if (b.fl) { const u = clamp((W.t - b.fl.t0) / (b.fl.t1 - b.fl.t0), 0, 1); bx = b.fl.x0 + (b.fl.x1 - b.fl.x0) * u; by = b.fl.y0 + (b.fl.y1 - b.fl.y0) * u; bz = 0.8 + Math.sin(Math.PI * u) * b.fl.peak * 2.2; }
    else { bx = b.x; by = b.y; bz = b.z || 0.2; }
    W.frames.push([Math.round(W.t * 100) / 100, f, Math.round(bx * 100) / 100, Math.round(by * 100) / 100, Math.round(bz * 100) / 100, h, W.ag.map(a => (a.down > 0 ? 1 : 0) + (a.eng ? 2 : 0)).join('')]);
  }
  function stepWorld(W, brain) {
    W.t = Math.round((W.t + DT) * 100) / 100;
    brain(W);
    if (SIM.dbg) SIM.dbg(W);
    if (!W.done) {
      W.ag.forEach(a => { if (!a.eng) { a.x += a.vx * DT; a.y += a.vy * DT; } });
      runPairs(W);
      separate(W);
      W.ag.forEach(a => { a.stun = Math.max(0, a.stun - DT); a.down = Math.max(0, a.down - DT); a.slow = Math.max(0, a.slow - DT); a.hist.push([a.x, a.y]); if (a.hist.length > 12) a.hist.shift(); });
      // the ball in the air
      if (W.phase === 'air' && W.ball.fl && W.t >= W.ball.fl.t1 - 1e-6) catchBall(W);
      // the runner: boundaries, the goal line, contact
      const c = W.carrier;
      if (c && !W.done && W.phase !== 'air') {
        const gd = c.gdir || 1;
        if (gd === 1 && c.x >= W.toGoal && W.phase !== 'pass') { W.td = true; end(W, 'td'); }
        else if (gd === -1 && c.x <= W.own) { W.td = true; end(W, 'td'); }
        else if (c.y <= W.lmin + 0.1 || c.y >= W.lmax - 0.1) { W.oob = true; c.y = clamp(c.y, W.lmin, W.lmax); end(W, 'oob'); }
      }
      if (!W.done && W.phase !== 'air') tackles(W);
    }
    record(W);
  }
  function snapBall(W, to, at) { W.ball.holder = to; W.ballSnap = at; }

  // a run (or an RPO / option that may turn into one)
  function runPlay(W, call, ctx) {
    const GM = W.GM, scheme = SIM.RUN[ctx.pl] || (call.t === 'out' ? SIM.RUN['Outside Zone'] : call.t === 'qb' ? SIM.RUN['QB Draw'] : SIM.RUN['Inside Zone']);
    const dir = call.dir || 'M';
    let sgn = dir === 'L' ? -1 : dir === 'R' ? 1 : (chance(0.5) ? 1 : -1);
    const ap = dir === 'M' ? Math.min(scheme.ap, 1.0) : scheme.ap;
    W.isRun = true; W.phase = 'run';
    const q = W.qb, rb = W.by.RB || W.by.FB;
    const gun = q.x < -3;
    runBlocking(W, Object.assign({}, scheme, { ap }), sgn);
    if (scheme.qb && !(scheme.sch === 'read' || scheme.sch === 'triple' || scheme.sch === 'speedopt') && W.by.RB) {
      const b = W.by.RB; b.task = 'rblock'; b.tgt = null; b.lead = true; b.push = { x: 0.7, y: sgn * 0.7 };
      b.path = null; b.climb = 0.2;
    }
    let car = scheme.qb ? q : (scheme.sch === 'jet' ? (W.by.WR3 || W.by.WR1) : rb) || q;
    const hole = { x: 0.5, y: sgn * ap };
    W.ball.holder = q;
    const mesh = gun ? { x: q.x + 0.4, y: q.y + (rb ? Math.sign(rb.y || -sgn) * 0.9 : 0) } : { x: -3.8, y: sgn * 0.7 };
    const tMesh = gun ? 0.55 : 0.85;
    const opt = scheme.sch === 'read' || scheme.sch === 'triple' || scheme.sch === 'speedopt';
    let handed = false, keep = scheme.qb && !opt, pitchMan = null, pitched = false;
    if (scheme.sch === 'jet') { const j = car; j.x = -1.2; j.y = -sgn * 6; j.vx = 0; j.vy = sgn * j.top * 0.9; }
    if (scheme.sch === 'speedopt' || scheme.sch === 'triple') pitchMan = rb;
    // RPO: read the conflict defender; throw if he plays the run
    const C = ctx.concept;
    if (C && C.rpo) { routes(W, C); W.rpo = C; W.order = [W.by[C.rpo]].filter(Boolean); }
    W.vb = 15.5 + (W.R(q.p, 'thp') - 50) * 0.17;
    const brain = W => {
      const t = W.t;
      if (W.rpoPass) {
        if (W.phase === 'yac' || W.phase === 'ret') carry(W, W.carrier, W.carrier.gdir || 1);
        offBlock(W); receivers(W); defense(W);
        if (W.phase === 'ret') for (const a of W.ag) { if (a.side === 'o' && !a.eng && a.down <= 0 && a.stun <= 0) pursue(W, a, W.carrier); }
        return;
      }
      // the quarterback and the backs before the handoff
      if (!handed && !W.carrier) {
        if (W.rpo && t >= 0.45 && t < 0.55) {
          const key = W.by[W.rpo.key];
          const rcv = W.by[W.rpo.rpo];
          const fills = key && (key.x < key.x0 - 0.5 || W.t > key.rec);
          const box = W.ag.filter(d => d.side === 'd' && d.x < 6 && Math.abs(d.y) < 5).length;
          const throwIt = rcv && (fills && box >= 7 ? chance(0.75) : box >= 7 ? chance(0.55) : chance(0.18));
          if (throwIt) {
            W.isRun = false; W.phase = 'pass'; W.readT = t; W.dropT = t; W.dropTo = { x: q.x, y: q.y };
            W.ev.push({ t, text: 'RPO: PULL AND THROW', cls: 'meh' });
            W.rpoPass = true;
            // offensive linemen downfield on a pass are only legal within 3 yards: they are already engaged, so nothing to do
            const o = openness(W, rcv); return throwTo(W, rcv, o, false);
          }
        }
        if (scheme.sch === 'toss' && rb && t >= 0.25 && !pitched) {
          pitched = true; W.ball.holder = null; const to = rb; const tf = 0.35; W.ball.fl = { x0: q.x, y0: q.y, x1: to.x - 0.3, y1: to.y + sgn * 2.5, t0: t, t1: t + tf, to, peak: 0.3, pitch: true }; W.phase = 'pitch';
        }
        if (scheme.sch === 'jet' && t >= 0.3) { handed = true; W.ball.holder = car; W.carrier = car; car.task = 'carry'; car.gdir = 1; }
        if (scheme.sch === 'draw' && t < 0.55) steer(q, -5.8, q.y, 0.45);
        if (!opt && !scheme.qb && scheme.sch !== 'toss' && scheme.sch !== 'jet' && t >= tMesh) { handed = true; W.ball.holder = car; W.carrier = car; car.task = 'carry'; car.gdir = 1; }
        if (scheme.qb && !opt && t >= (scheme.sch === 'draw' ? 0.55 : 0.25)) { handed = true; W.carrier = q; q.task = 'carry'; q.gdir = 1; }
        if (opt && t >= tMesh) {
          // the read: the key defender crashes on the dive -> keep; stays home -> give
          const key = W.readKey;
          let give = true;
          if (key) {
            const crash = key.vx < -1.2 || Math.abs(key.y - (rb ? rb.y : 0)) < 2.6;
            const qbr = W.R(q.p, 'awr') * 0.5 + W.R(q.p, 'prc') * 0.0 + 35;
            give = crash ? chance(0.18 - (qbr - 70) / 300) : chance(0.82 + (qbr - 70) / 300);
            if (scheme.sch === 'speedopt') give = false;
          }
          if (scheme.midline && key) give = !(key.vx < -0.8);
          if (give && rb && scheme.sch !== 'speedopt') { handed = true; W.ball.holder = rb; W.carrier = rb; rb.task = 'carry'; rb.gdir = 1; W.ev.push({ t, text: 'GIVE', cls: 'meh small' }); }
          else { handed = true; W.carrier = q; q.task = 'carry'; q.gdir = 1; W.ev.push({ t, text: scheme.sch === 'speedopt' ? 'OPTION' : 'KEEP', cls: 'meh small' }); W.optKeep = true; W.ballSide = sgn; W.keepT = t; }
        }
        // backs to the mesh
        if (rb && !W.carrier && scheme.sch !== 'toss') {
          if (scheme.sch === 'speedopt' || scheme.sch === 'triple') steer(rb, -4.5, sgn * 4, 0.9);
          else steer(rb, mesh.x, mesh.y + (gun ? 0 : 0), 0.95, false);
        }
        if (rb && scheme.sch === 'toss' && !W.carrier) steer(rb, -4.3, sgn * 6, 1, false);
        if (!scheme.qb && scheme.sch !== 'toss' && scheme.sch !== 'jet' && t < tMesh) steer(q, mesh.x + (gun ? -0.2 : 0.4), mesh.y - (gun ? 0.3 * Math.sign(mesh.y || 1) : 0), 0.7);
      }
      // the pitch on a toss / option
      if (W.phase === 'pitch' && W.ball.fl && t >= W.ball.fl.t1) { const to = W.ball.fl.to; W.ball.fl = null; W.ball.holder = to; W.carrier = to; to.task = 'carry'; to.gdir = 1; W.phase = 'run'; to.slow = 0.35; W.ag.forEach(d => { if (d.side === 'd') d.rec = Math.min(d.rec, W.t); }); }
      // option pitch read on the edge
      if (W.optKeep && pitchMan && !pitched && W.carrier === q && q.x < 2) {
        const pk = W.by[sgn > 0 ? 'DE2' : 'DE1'] || W.by[sgn > 0 ? 'LB2' : 'LB1'];
        steer(pitchMan, q.x - 1.2, q.y + sgn * 4, 1, false);
        if (pk && dist(pk, q) < 2.3 && pk.down <= 0 && !pk.eng) {
          pitched = true; W.ball.holder = null; W.carrier = null; W.ball.fl = { x0: q.x, y0: q.y, x1: pitchMan.x + 0.6, y1: pitchMan.y, t0: t, t1: t + 0.3, to: pitchMan, peak: 0.25, pitch: true }; W.phase = 'pitch';
          W.ev.push({ t, text: 'PITCH', cls: 'meh small' });
        }
      }
      // the ball carrier
      const c = W.carrier;
      if (c && W.phase !== 'pitch') {
        if (W.phase === 'pass') return;
        const pre = c.x < -0.2 && t < (handed ? tMesh + 0.7 : 1.2);
        if (pre && !W.optKeep && scheme.sch !== 'jet' && scheme.sch !== 'toss') {
          // press the hole: run at the aiming point, then read it
          steer(c, hole.x + 0.6, hole.y, 1, false);
        } else if (W.optKeep && c === q && c.x < 0.5 && t < W.keepT + 1.1) {
          steer(c, 1.5, W.ballSide * (scheme.sch === 'read' ? -Math.max(5, scheme.ap) : scheme.ap * 0.6), 1, false);
        } else carry(W, c, 1);
      }
      offBlock(W);
      defense(W);
      receivers(W);
      // after a handoff the quarterback carries out the fake
      if (W.carrier && W.carrier !== q && q !== W.carrier) steer(q, q.x - 0.3, q.y - sgn * 2.5, 0.35);
    };
    return brain;
  }
  // a dropback (quick, medium, deep, play action, screen)
  function passPlayBrain(W, call, ctx) {
    const GM = W.GM, q = W.qb; let C = ctx.concept || SIM.CONCEPT['Curl-Flat'];
    const t0 = call.t;
    W.phase = 'pass'; W.ball.holder = q;
    const gun = q.x < -3;
    const drops = { quick: gun ? 0.95 : 1.15, med: gun ? 1.55 : 1.8, deep: gun ? 1.95 : 2.25, pa: 2.25, screen: 0.9 };
    W.dropT = drops[t0] || 1.1;
    W.dropTo = { x: gun ? (t0 === 'quick' ? -5.4 : -6.6) : (t0 === 'quick' ? -4.2 : t0 === 'deep' ? -7.4 : -6.5), y: 0 };
    if (C.boot) W.dropTo = { x: -4.5, y: 5.5 };
    W.readT = W.dropT + (t0 === 'pa' ? 0.15 : 0.05);
    W.vb = 15.5 + (W.R(q.p, 'thp') - 50) * 0.17;
    if (t0 === 'pa') W.pa = 0.32 + (ctx.F && ctx.F.pa ? ctx.F.pa * 0.15 : 0);
    // blitz pickup: the back stays in when they bring more than the line can block
    const extraRush = W.rushers.length > 5;
    // backs are part of the passing game: some calls release him on a swing or into the flat as a real read
    let relRB = false;
    if (!C.screen && W.by.RB && (!C.RB || C.RB === 'check') && t0 !== 'deep' && chance(t0 === 'quick' ? 0.4 : 0.32)) { C = Object.assign({}, C, { RB: chance(0.5) ? 'swing' : 'flat' }); relRB = true; }
    routes(W, C);
    if (extraRush && !relRB && W.by.RB && W.by.RB.route === 'check' && !C.screen && chance(0.45)) { W.by.RB.route = 'block'; W.by.RB.path = null; }
    if (ctx.F && ctx.F.pro >= 0.45 && W.by.TE2 && W.by.TE2.route && chance(0.5)) { W.by.TE2.route = 'block'; W.by.TE2.path = null; }
    passPro(W);
    W.order = C.ord.map(k => W.by[k]).filter(a => a && a.route && a.route !== 'block');
    if (!W.order.length) W.order = ELIG.map(k => W.by[k]).filter(a => a && a.route && a.route !== 'block');
    if (relRB) { const rb = W.by.RB, i = W.order.indexOf(rb); if (i > 1) { W.order.splice(i, 1); W.order.splice(Math.min(2, W.order.length), 0, rb); } }
    // screens: the line lets them through, then releases to block in space
    if (C.screen) {
      W.screen = true; W.readT = 1.25; W.dropT = 0.9;
      ['LG', 'C', 'RG'].forEach(k => { const a = W.by[k]; if (a) a.release = 0.9 + rnd() * 0.2; });
    }
    const brain = W => {
      if (W.phase === 'pass') {
        qbBrain(W);
        if (W.screen && W.t >= W.readT && W.phase === 'pass') { const r = W.order[0]; if (r) { const o = openness(W, r); throwTo(W, r, o, false); } }
      } else if (W.phase === 'scr' || W.phase === 'yac' || W.phase === 'ret') carry(W, W.carrier, W.carrier.gdir || 1);
      // the line: protect (screens: release)
      for (const a of W.ag) {
        if (a.side !== 'o' || a.eng || a.stun > 0) continue;
        if (a.release && W.t >= a.release && a.task === 'pro') { a.task = 'rblock'; a.tgt = null; a.push = { x: 0.6, y: 0 }; }
      }
      if (W.phase === 'pass' || W.phase === 'air') {
        for (const a of W.ag) if (a.side === 'o' && a.task === 'pro' && !a.eng && a.stun <= 0 && a !== W.qb) protect(W, a);
        for (const a of W.ag) if (a.side === 'o' && (a.task === 'rblock') && !a.eng) offBlock(W);
      } else offBlock(W);
      receivers(W);
      defense(W);
      // an interception return: the offense turns into tacklers
      if (W.phase === 'ret') for (const a of W.ag) { if (a.side === 'o' && !a.eng && a.down <= 0 && a.stun <= 0) pursue(W, a, W.carrier); }
    };
    return brain;
  }

  /* ---------- results back to the engine ---------- */
  SIM.play = (GM, s, O, D, call, dc, def, ctx) => {
    const W = newWorld(GM, s);
    const fk = ctx.fk || 'trips';
    setupOffense(W, O, fk);
    const pkg = (dc && dc.pkg) || (ctx.F && ctx.F.dpers) || 'nickel';
    setupDefense(W, D, pkg, dc.d);
    // the call against the defense, the plans and the adjustments
    const mo = ctx.mo || {}, md = ctx.md || {};
    W.boost = { run: (mo.run || 0) * 2 + (ctx.F ? ctx.F.run : 0) * 1.5 + Math.max(0, ctx.pm || 0) * 2.5, pro: (mo.pro || 0) * 2 + (ctx.F ? ctx.F.pro : 0) * 2, rush: (md.rush || 0) * 2.5 + (def.rush || 0) * 0.8,
      box: (md.box || 0) * 2 + Math.max(0, -(ctx.pm || 0)) * 2.5, sep: (mo.sep || 0) + (ctx.pm || 0) * 0.45 + (ctx.F ? ctx.F.sep : 0), read: (md.box || 0) * 0.05 + (dc.read ? 0.12 : 0) };
    defAssign(W);
    SIM._W = W;
    const isRun = call.k === 'run' || call.k === 'rpo';
    const conceptName = ctx.pname;
    ctx.concept = SIM.CONCEPT[conceptName] || (call.k === 'pass' ? SIM.CONCEPT[{ quick: 'Slant-Flat', med: 'Curl-Flat', deep: 'Four Verticals', screen: 'RB Screen', pa: 'PA Post' }[call.t] || 'Curl-Flat'] : null);
    if (call.k === 'rpo') ctx.pl = (SIM.RUN[call.run] ? call.run : 'Inside Zone');
    else ctx.pl = ctx.pname;
    const brain = isRun ? runPlay(W, call, ctx) : passPlayBrain(W, call, ctx);
    record(W);
    let n = 0;
    while (!W.done && n++ < 130) stepWorld(W, brain);
    if (!W.done) end(W, 'time');
    // a couple of frames after the whistle (players pull up)
    for (let k = 0; k < 6; k++) { W.t = Math.round((W.t + DT) * 100) / 100; W.ag.forEach(a => { if (!a.eng) { a.vx *= 0.6; a.vy *= 0.6; a.x += a.vx * DT; a.y += a.vy * DT; } a.down = Math.max(0, a.down - DT * 0.3); }); record(W); }
    return toResult(W, call, ctx);
  };
  function toResult(W, call, ctx) {
    const GM = W.GM, ev = [], s = W.s;
    const c = W.carrier, q = W.qb;
    const trk = { s, ball: GM.ball, by: GM.by || 26.67, ids: W.ag.map(a => [a.side, a.role, a.p ? a.p.num : '', a.p ? a.p.id : 0]), fr: W.frames, ev: W.ev.filter(e => e.text), flag: W.flag ? { t: W.flag.t, x: W.flag.x, y: W.flag.y } : null, tk: tkOf(W) };
    const anim = { trk };
    const tk = W.tackle ? W.tackle.by.p : null, ast = W.tackle && W.tackle.ast ? W.tackle.ast.p : null;
    (W.broke || []).slice(0, 2).forEach(b => ev.push(`${last(c && c.p)} ${b.how}${/breaks/.test(b.how) ? ' ' + last(b.d.p) : ''}.`));
    const yards = v => Math.round(v);
    const time = Math.max(3, Math.round((W.tEnd || W.t) + 1));
    // blocks that held to the end of the play
    (W.allPairs || []).forEach(pr => { if (pr.done) return; if (pr.mode === 'pass') { GR(W, pr.b, 0.12); GR(W, pr.d, -0.04); } else { GR(W, pr.b, 0.15); GR(W, pr.d, -0.08); } });
    const base = { gr: W.gr || null, tkd: W.tackle ? { t: W.tackle.t, eng: W.tackle.eng, freed: W.tackle.freed, unb: W.tackle.unb, role: W.tackle.by.role, cx: c ? c.x : 0 } : null, cd: W.catchDiag, events: ev, time, anim, sim: true, endL: c ? c.y : 0, flagHold: W.flag && W.flag.kind === 'hold' ? W.flag.p : null };
    if (W.int) {
      const d = W.int;
      const caught = W.intX;
      const pick6 = !!W.td;
      const retY = Math.max(0, Math.round(caught - d.x));
      anim.kind = 'pass'; anim.int = true; anim.air = Math.round(caught);
      return Object.assign(base, { kind: 'int', t: call.t, passer: q.p, target: W.target ? W.target.p : null, defender: d.p, yards: 0, ret: pick6 ? 999 : retY, pick6, turnover: true, intTB: d.x >= W.toGoal, intEnd: d.x, text0: `${last(q.p)} pass to ${last(W.target && W.target.p)} INTERCEPTED by ${last(d.p)}`, endL: d.y });
    }
    if (W.dpi) {
      anim.kind = 'pass'; anim.inc = true; anim.flag = true;
      ev.push(`Flag: pass interference on #${W.dpi.p.num} ${last(W.dpi.p)}.`);
      return Object.assign(base, { kind: 'dpi', t: call.t, passer: q.p, target: W.target ? W.target.p : null, defender: W.dpi.p, yards: Math.max(1, Math.min(15, W.air || 10, W.toGoal - 1)), firstDown: true, pen: true, endL: 0,
        text0: `${last(q.p)} pass to ${last(W.target && W.target.p)} — pass interference, ${last(W.dpi.p)}` });
    }
    if (W.done === 'inc' || (W.phase === 'air')) {
      anim.kind = 'pass'; anim.inc = true;
      const tg = W.target;
      if (W.away) ev.push(`Under pressure, ${last(q.p)} throws it away.`);
      if (W.drop && tg) ev.push(`DROPPED. ${last(tg.p)} had it in his hands${tg.p.tr.cons < 58 ? ' (Streaky: the focus comes and goes)' : ''}.`);
      if (W.pd) ev.push(`Broken up by ${last(W.pd.p)}.`);
      const deep = W.air >= 15;
      return Object.assign(base, { kind: 'inc', t: call.t, passer: q.p, target: tg ? tg.p : null, defender: W.pd ? W.pd.p : null, yards: 0, inc: true, drop: !!W.drop, pressured: !!W.pressure, endL: 0,
        text0: W.away ? `${last(q.p)} pass incomplete (thrown away)` : `${last(q.p)} pass ${deep ? 'deep' : 'short'} ${sideWord(W.target)} to ${last(tg && tg.p)} incomplete` });
    }
    // sacks: the quarterback down behind the line before a throw
    if (W.done === 'tackle' && W.tackle && W.ball.holder === q && !W.carrier && !W.caught && !W.int) {
      const y = Math.min(-1, yards(q.x));
      anim.kind = 'sack';
      const sk = W.tackle.by.p;
      if (q.p.tr.tup < 45 && chance(0.4)) ev.push(`${last(q.p)} held it too long (he gets jumpy under pressure).`);
      else ev.push(`${last(sk)} got home${W.tackle.by.sheddedBy ? ' after beating ' + last(W.tackle.by.sheddedBy.p) : ' untouched'}.`);
      return Object.assign(base, { kind: 'sack', t: call.t, passer: q.p, tackler: sk, sackBy: sk, ast, yards: y, fum: !!W.fumble && chance(0.85), events: ev, text0: `${last(q.p)} SACKED by ${last(sk)}` });
    }
    const endX = W.td ? W.toGoal : c ? c.x : 0;
    let y = yards(endX);
    if (W.td) y = W.toGoal;
    if (W.caught && c) {
      anim.kind = 'pass'; anim.air = Math.round(W.catchX);
      return Object.assign(base, { kind: 'pass', t: call.t, passer: q.p, target: c.p, tackler: W.oob || W.td ? null : tk, ast, yards: Math.max(y, Math.round(W.catchX) <= y ? y : y), air: Math.round(W.catchX), fum: !!W.fumble, oob: !!W.oob,
        text0: `${last(q.p)} pass ${call.t === 'screen' || W.screen ? 'screen' : W.catchX >= 15 ? 'deep' : 'short'} ${sideWord(c)} complete to ${last(c.p)}` });
    }
    // runs (designed, option keeps, scrambles)
    anim.kind = 'run'; anim.t = W.scramble ? 'scr' : call.t;
    const t = W.scramble ? 'scr' : (c === q ? 'qb' : call.t === 'qb' ? 'in' : call.t);
    const dirW = c ? (c.y < -3 ? 'left' : c.y > 3 ? 'right' : 'up the middle') : 'up the middle';
    const text0 = W.scramble ? `${last(q.p)} scrambles` : c === q ? `${last(q.p)} keeps it ${dirW === 'up the middle' ? 'up the middle' : dirW}` : `${last(c && c.p)} runs ${dirW === 'up the middle' ? 'up the middle' : (Math.abs(c.y) > 7 ? 'wide ' : '') + dirW}`;
    if (y <= -1 && W.tackle && !W.scramble) ev.push(`${last(tk)} blew it up in the backfield.`);
    return Object.assign(base, { kind: 'run', t, dir: call.dir || 'M', carrier: c ? c.p : q.p, tackler: W.oob || W.td ? null : tk, ast, yards: y, fum: !!W.fumble, oob: !!W.oob, broke: !!(W.broke && W.broke.length), big: y >= 20, text0 });
  }
  const sideWord = a => (!a ? 'middle' : a.y < -5 ? 'left' : a.y > 5 ? 'right' : 'middle');

  /* ---------- kick and punt returns ---------- */
  // receiving team frame: x = the receiving team's yard line, + toward the end zone it attacks
  SIM.returnPlay = (GM, rs, k) => {
    const ks = rs === 'h' ? 'a' : 'h';
    const d = rs === 'h' ? 1 : -1;
    const W = { GM, s: rs, ds: ks, t: 0, ag: [], by: {}, pairs: [], ev: [], frames: [], lmin: -26.67, lmax: 26.67, toGoal: 100, own: 0, ball: { x: 0, y: 0, z: 0, holder: null, fl: null }, carrier: null, phase: 'kick', boost: { run: 0, pro: 0, rush: 0, box: 0, sep: 0, read: 0 }, dir: d, ret: true };
    W.R = (p, key) => DY._E(GM, p, key, rs);
    const L = GM.L[ks], R = GM.L[rs];
    const kicker = k.kind === 'punt' ? (L.P[0] || L.K[0]) : L.K[0];
    const cover = [kicker, ...L.LB.slice(0, 3), ...L.S.slice(0, 2), ...L.CB.slice(0, 2), ...L.WR.slice(0, 2), L.RB[1] || L.RB[0], L.TE[0], L.EDGE[0]].filter(Boolean).filter((p, i, a) => a.indexOf(p) === i).slice(0, 11);
    const retr = k.returner;
    const block = [...R.OT.slice(0, 2), ...R.IOL.slice(0, 2), R.TE[0], ...R.LB.slice(0, 2), ...R.WR.slice(1, 3), R.RB[1] || R.RB[0], R.S[1] || R.S[0], R.CB[2] || R.CB[0]].filter(Boolean).filter(p => p !== retr).filter((p, i, a) => a.indexOf(p) === i).slice(0, 10);
    const land = k.land, hang = k.hang;
    // positions when the ball comes down
    const r = { p: retr }; const ra = agent(W, retr, 'o', 'KR', land - 1.5, 0); ra.gdir = 1;
    // coverage players: spread across the field, arriving as the ball comes down
    cover.forEach((p, i) => {
      const lane = -24 + i * (48 / Math.max(1, cover.length - 1));
      const ahead = k.kind === 'punt' ? (i < 2 ? 3 : 12 + (i % 4) * 2) : 12 + (i % 3) * 3;
      const a = agent(W, p, 'd', 'C' + i, land + ahead + (i === 0 ? 14 : 0), lane * (i < 2 && k.kind === 'punt' ? 0.9 : 0.85));
      a.vx = -a.top * 0.92; a.task = 'cover';
    });
    // the wall: blockers turned to face the coverage
    block.forEach((p, i) => {
      const lane = -20 + i * (40 / Math.max(1, block.length - 1));
      const a = agent(W, p, 'o', 'B' + i, land + (k.kind === 'punt' ? 6 + (i % 3) * 2 : 8 + (i % 2) * 4), lane * 0.8);
      a.task = 'rblock'; a.push = { x: 0.2, y: Math.sign(lane) * 0.9 };
    });
    // assign each blocker the nearest coverage man (by lane)
    const cov = W.ag.filter(a => a.side === 'd');
    W.ag.filter(a => a.side === 'o' && a.task === 'rblock').forEach(b => { let best = 99, t = null; cov.forEach(c => { if (c.taken) return; const dd = Math.abs(c.y - b.y); if (dd < best) { best = dd; t = c; } }); if (t) { t.taken = true; b.tgt = t; } });
    W.ball.holder = ra; W.carrier = ra; W.phase = 'yac'; ra.task = 'carry';
    W.ev.push({ t: 0, text: k.kind === 'punt' ? 'PUNT RETURN' : 'KICK RETURN', cls: 'meh small' });
    const brain = W => {
      carry(W, W.carrier, 1);
      for (const a of W.ag) {
        if (a.eng || a.stun > 0 || a.down > 0) continue;
        if (a.side === 'd') { pursue(W, a, W.carrier); continue; }
        if (a.task === 'rblock') {
          const t = a.tgt && !a.tgt.eng && a.tgt.down <= 0 ? a.tgt : null;
          if (!t) { let best = 99, u = null; for (const c of W.ag) { if (c.side !== 'd' || c.eng || c.down > 0) continue; const dd = dist(a, c) + dist(c, W.carrier) * 0.5; if (dd < best) { best = dd; u = c; } } a.tgt = u; }
          const tt = a.tgt;
          if (!tt) continue;
          if (dist(a, tt) < 1.1) { engage(W, a, tt, 'run', unit(0.25, Math.sign(tt.y - W.carrier.y) || 1)); continue; }
          steer(a, tt.x + (W.carrier.x - tt.x) * 0.35, tt.y + (W.carrier.y - tt.y) * 0.35, 1, false);
        }
      }
    };
    record(W);
    let n = 0;
    while (!W.done && n++ < 140) stepWorld(W, brain);
    if (!W.done) end(W, 'time');
    for (let i = 0; i < 6; i++) { W.t = Math.round((W.t + DT) * 100) / 100; W.ag.forEach(a => { if (!a.eng) { a.vx *= 0.6; a.vy *= 0.6; a.x += a.vx * DT; a.y += a.vy * DT; } }); record(W); }
    const endX = W.td ? 100 : ra.x;
    return {
      ret: Math.round(endX - land), td: !!W.td, oob: !!W.oob, tackler: W.tackle ? W.tackle.by.p : null, fum: !!W.fumble, time: Math.round(W.t),
      trk: { s: rs, ret: true, by: 26.67, land, hang, ids: W.ag.map(a => [a.side, a.role, a.p ? a.p.num : '', a.p ? a.p.id : 0]), fr: W.frames, ev: W.ev.filter(e => e.text), flag: null, tk: tkOf(W) },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
