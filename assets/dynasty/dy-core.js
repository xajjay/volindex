/* The Vol Index — Football Dynasty: core (random numbers, players, attributes, overall, potential, personality, NIL,
   the real Tennessee roster, generated CPU rosters, depth charts). Runs in the browser and in Node (for tests). */
(function (root) {
  'use strict';
  const DY = root.DY = root.DY || {};
  DY.VERSION = 1;
  DY.SAVE_KEY = 'vi-dynasty';

  /* ---------- random numbers (seeded; the state lives in the save so a dynasty replays the same way) ---------- */
  let RS = 1;
  DY.seed = s => { RS = (s >>> 0) || 1; };
  DY.rstate = () => RS;
  DY.r = () => { RS = (RS + 0x6D2B79F5) >>> 0; let t = RS; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // independent stream from a string (for things that must not shift the main stream, e.g. FCS rosters)
  DY.rngFrom = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } let s = h >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  let R = DY.r;
  DY.withRng = (fn, f) => { const old = R; R = fn; try { return f(); } finally { R = old; } };
  const rnd = () => R();
  DY.rr = (a, b) => a + rnd() * (b - a);
  DY.ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  DY.chance = p => rnd() < p;
  DY.pick = arr => arr[Math.floor(rnd() * arr.length)];
  DY.gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  DY.wpick = (items, wf) => { let tot = 0; const ws = items.map(x => { const w = Math.max(0, wf(x)); tot += w; return w; }); let t = rnd() * tot; for (let i = 0; i < items.length; i++) { t -= ws[i]; if (t <= 0) return items[i]; } return items[items.length - 1]; };
  DY.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  DY.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const { rr, ri, chance, pick, gauss, clamp } = DY;

  /* ---------- positions and attributes ---------- */
  DY.POS = ['QB', 'RB', 'WR', 'TE', 'OT', 'IOL', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P', 'LS'];
  DY.POS_NAME = { QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end', OT: 'Offensive tackle', IOL: 'Interior lineman', EDGE: 'Edge rusher',
    DT: 'Defensive tackle', LB: 'Linebacker', CB: 'Cornerback', S: 'Safety', K: 'Kicker', P: 'Punter', LS: 'Long snapper' };
  DY.SIDE = p => ['QB', 'RB', 'WR', 'TE', 'OT', 'IOL'].includes(p) ? 'O' : ['K', 'P', 'LS'].includes(p) ? 'ST' : 'D';
  DY.ATTR_NAME = { spd: 'Speed', acc: 'Acceleration', agi: 'Agility', str: 'Strength', awr: 'Awareness', thp: 'Throw power', sac: 'Short accuracy',
    mac: 'Medium accuracy', dac: 'Deep accuracy', tup: 'Throw under pressure', car: 'Carrying', btk: 'Break tackle', elu: 'Elusiveness', bcv: 'Ball-carrier vision',
    cth: 'Catching', cit: 'Catch in traffic', srr: 'Short routes', drr: 'Deep routes', rls: 'Release', spc: 'Spectacular catch', rbk: 'Run block', pbk: 'Pass block',
    pmv: 'Power moves', fmv: 'Finesse moves', bsh: 'Block shedding', tak: 'Tackling', pur: 'Pursuit', prc: 'Play recognition', mcv: 'Man coverage', zcv: 'Zone coverage',
    prs: 'Press', hit: 'Hit power', kpw: 'Kick power', kac: 'Kick accuracy', snp: 'Snapping' };
  // overall weights per position
  DY.W = {
    QB: { thp: .13, sac: .16, mac: .16, dac: .12, tup: .12, awr: .18, spd: .07, agi: .06 },
    RB: { spd: .16, acc: .12, agi: .10, elu: .14, btk: .12, car: .10, bcv: .14, cth: .06, str: .06 },
    WR: { spd: .16, acc: .08, agi: .06, cth: .16, cit: .08, srr: .14, drr: .12, rls: .10, spc: .04, elu: .06 },
    TE: { cth: .16, cit: .10, srr: .10, rbk: .18, pbk: .10, spd: .12, str: .12, awr: .12 },
    OT: { pbk: .30, rbk: .24, str: .18, awr: .14, agi: .14 },
    IOL: { pbk: .24, rbk: .30, str: .22, awr: .14, agi: .10 },
    EDGE: { pmv: .16, fmv: .18, bsh: .14, spd: .16, str: .10, tak: .10, pur: .08, awr: .08 },
    DT: { pmv: .20, fmv: .10, bsh: .22, str: .20, tak: .10, pur: .06, awr: .08, spd: .04 },
    LB: { tak: .18, pur: .14, bsh: .10, prc: .16, zcv: .12, mcv: .06, spd: .12, hit: .06, awr: .06 },
    CB: { mcv: .20, zcv: .16, prs: .10, spd: .18, acc: .08, agi: .08, cth: .08, prc: .06, tak: .06 },
    S: { zcv: .18, mcv: .10, prc: .14, spd: .14, tak: .14, hit: .10, cth: .08, awr: .06, acc: .06 },
    K: { kpw: .5, kac: .5 }, P: { kpw: .5, kac: .5 }, LS: { snp: .7, awr: .3 },
  };
  // attributes a position carries that do not count toward its overall: [attr, offset from overall]
  DY.EXTRA = {
    QB: [['str', -12], ['car', -4], ['acc', -6]], RB: [['pbk', -18], ['awr', -6]], WR: [['str', -14], ['awr', -6], ['car', -4]],
    TE: [['agi', -10], ['car', -6], ['elu', -16], ['drr', -14], ['acc', -8]], OT: [['spd', -28]], IOL: [['spd', -30]],
    EDGE: [['zcv', -26], ['hit', -6], ['acc', -4]], DT: [['acc', -18], ['zcv', -40]], LB: [['pmv', -12], ['str', -6], ['acc', -4], ['cth', -24]],
    CB: [['hit', -16], ['str', -22], ['awr', -6]], S: [['prs', -14], ['str', -16], ['agi', -4]], K: [['awr', -10]], P: [['awr', -10]], LS: [['str', -10]],
  };
  // speed relative to the overall by position (a 80 WR is faster than a 80 tackle)
  DY.SPD_ADJ = { QB: -9, RB: 5, WR: 7, TE: -7, EDGE: -2, DT: -16, LB: -2, CB: 7, S: 3 };
  DY.ARCH = {
    QB: [['Pocket Passer', { thp: 3, sac: 2, dac: 2, spd: -10, agi: -6 }], ['Dual Threat', { spd: 12, agi: 8, thp: -1, sac: -2, tup: -2 }], ['Field General', { awr: 5, sac: 3, tup: 3, thp: -3, spd: -3 }], ['Gunslinger', { thp: 6, dac: 4, awr: -4, sac: -2 }]],
    RB: [['Power Back', { str: 8, btk: 8, spd: -4, elu: -5 }], ['Elusive Back', { elu: 8, agi: 6, acc: 3, btk: -5, str: -5 }], ['Receiving Back', { cth: 12, elu: 3, btk: -3 }], ['Speed Back', { spd: 6, acc: 5, bcv: -3 }]],
    WR: [['Deep Threat', { spd: 6, drr: 6, srr: -4, cit: -4 }], ['Possession', { cth: 5, cit: 7, srr: 4, spd: -5 }], ['Route Technician', { srr: 6, drr: 3, rls: 5, spc: -3 }], ['Physical', { cit: 5, str: 6, spc: 6, agi: -3 }], ['Gadget', { elu: 8, acc: 5, agi: 6, drr: -5, cit: -5 }]],
    TE: [['Vertical Threat', { spd: 5, cth: 4, srr: 4, rbk: -8, pbk: -6 }], ['Blocking', { rbk: 8, pbk: 6, str: 5, cth: -6, spd: -4 }], ['Possession', { cth: 5, cit: 5, srr: 2, spd: -2 }]],
    OT: [['Pass Protector', { pbk: 6, agi: 3, rbk: -4 }], ['Road Grader', { rbk: 6, str: 5, pbk: -4 }], ['Agile', { agi: 6, pbk: 2, str: -4 }]],
    IOL: [['Pass Protector', { pbk: 6, agi: 3, rbk: -4 }], ['Road Grader', { rbk: 6, str: 5, pbk: -4 }], ['Agile', { agi: 6, pbk: 2, str: -4 }]],
    EDGE: [['Speed Rusher', { fmv: 7, spd: 5, pmv: -4, bsh: -5 }], ['Power Rusher', { pmv: 7, str: 5, fmv: -4, spd: -3 }], ['Run Stopper', { bsh: 7, tak: 4, fmv: -5 }]],
    DT: [['Run Stopper', { bsh: 6, str: 5, fmv: -5 }], ['Pass Rusher', { fmv: 6, pmv: 4, bsh: -4 }], ['Power', { pmv: 6, str: 6, spd: -4 }]],
    LB: [['Field General', { prc: 6, awr: 5, spd: -3 }], ['Thumper', { hit: 8, tak: 5, zcv: -5 }], ['Pass Coverage', { zcv: 6, mcv: 6, spd: 4, bsh: -6 }], ['Blitzer', { pmv: 12, bsh: 3, zcv: -5 }]],
    CB: [['Man to Man', { mcv: 6, prs: 4, zcv: -3 }], ['Zone', { zcv: 6, prc: 4, mcv: -4 }], ['Bump & Run', { prs: 8, mcv: 2, spd: -3 }], ['Ballhawk', { cth: 8, prc: 3, tak: -4 }]],
    S: [['Hybrid', { tak: 3, mcv: 3 }], ['Run Support', { hit: 6, tak: 6, zcv: -4 }], ['Coverage', { zcv: 6, cth: 4, hit: -4 }], ['Ballhawk', { cth: 8, prc: 3, tak: -2 }]],
    K: [['Power', { kpw: 6, kac: -3 }], ['Accurate', { kac: 6, kpw: -3 }]], P: [['Power', { kpw: 6, kac: -3 }], ['Accurate', { kac: 6, kpw: -3 }]], LS: [['Snapper', {}]],
  };
  DY.calcOvr = p => { const w = DY.W[p.pos]; let s = 0; for (const k in w) s += w[k] * (p.at[k] || 50); return Math.round(clamp(s, 25, 99)); };
  DY.setOvr = p => { p.ovr = DY.calcOvr(p); return p.ovr; };
  // build attributes that land on a target overall
  DY.makeAttrs = (pos, target, archName) => {
    const arch = (DY.ARCH[pos].find(a => a[0] === archName) || pick(DY.ARCH[pos]));
    const w = DY.W[pos], at = {};
    for (const k in w) at[k] = target + (arch[1][k] || 0) + gauss() * 3.4 + (k === 'spd' ? (DY.SPD_ADJ[pos] || 0) : 0);
    const p = { pos, at };
    for (let it = 0; it < 4; it++) {
      let s = 0; for (const k in w) s += w[k] * at[k];
      const d = target - s; for (const k in w) at[k] = clamp(at[k] + d, 50, 99);
    }
    for (const [k, off] of DY.EXTRA[pos] || []) at[k] = clamp(target + off + (arch[1][k] || 0) + gauss() * 4, 50, 95);
    if (!at.spd) at.spd = clamp(target - 25 + gauss() * 4, 50, 80);
    if (!at.awr) at.awr = clamp(target - 4 + gauss() * 4, 25, 95);
    if (!at.str) at.str = clamp(target - 10 + gauss() * 5, 25, 95);
    if (!at.tak && DY.SIDE(pos) === 'O') at.tak = clamp(30 + gauss() * 6, 15, 60);
    for (const k in at) at[k] = Math.round(at[k]);
    return { at, arch: arch[0] };
  };

  /* ---------- potential ---------- */
  DY.GRADES = [['A+', 93], ['A', 90], ['A-', 87], ['B+', 84], ['B', 81], ['B-', 78], ['C+', 75], ['C', 72], ['C-', 69], ['D', 0]];
  DY.gradeOf = ceil => (DY.GRADES.find(g => ceil >= g[1]) || DY.GRADES[DY.GRADES.length - 1])[0];
  DY.gradeIdx = g => DY.GRADES.findIndex(x => x[0] === g);
  // scouts see the ceiling with some error: sometimes a grade too high (bust risk) or too low (a gem)
  DY.scoutGrade = ceil => { let i = DY.gradeIdx(DY.gradeOf(ceil)); const r = rnd(); if (r < .13) i--; else if (r < .26) i++; return DY.GRADES[clamp(i, 0, DY.GRADES.length - 1)][0]; };
  DY.setCeil = (p, grade) => {
    const yrsLeft = Math.min(3.6, Math.max(0, p.el - 1) * 0.9);
    const per = 3.7 + clamp((grade - 80) / 7, -0.8, 2.7);
    p.ceil = Math.round(clamp(p.ovr + yrsLeft * per + gauss() * 3.6, p.ovr, 99));
    p.potG = DY.scoutGrade(p.ceil);
  };

  /* ---------- personality (Burger Town-style traits that explain what happens on the field) ---------- */
  DY.TRAITS = { disc: 'Discipline', clutch: 'Clutch', cons: 'Consistency', ego: 'Ego', lead: 'Leadership', work: 'Work ethic', tough: 'Toughness', loyal: 'Loyalty' };
  // personality on the same 50-99 scale as ratings (about 70 on average); ego is the one where lower is better
  DY.makeTraits = () => { const t = {}; for (const k in DY.TRAITS) t[k] = k === 'ego' ? Math.round(clamp(52 + gauss() * 14, 20, 95)) : Math.round(clamp(70 + gauss() * 9.5, 50, 99)); return t; };
  DY.persLabel = p => {
    const t = p.tr;
    if (t.ego >= 80 && t.disc <= 58) return ['Hot Head', 'Plays with an edge that can boil over: personal fouls and taunting flags follow him.'];
    if (t.clutch >= 88) return ['Ice Water', 'Gets better when the lights are brightest: late, close, third down.'];
    if (t.lead >= 88 && (p.pos === 'QB' || p.pos === 'LB')) return ['Field General', 'Runs the huddle; his calm keeps the offense on time in hostile stadiums.'];
    if (t.work >= 90) return ['Gym Rat', 'First one in, last one out. Develops faster than his peers.'];
    if (t.ego >= 80) return ['Showman', 'Loves the moment and the camera. Big plays, big celebrations, big NIL asks.'];
    if (t.cons >= 88) return ['Steady', 'You know what you are getting every Saturday.'];
    if (t.cons <= 55) return ['Streaky', 'Can take over a game or disappear in it.'];
    if (t.loyal >= 90) return ['Lifer', 'Bleeds his school\'s colors. Will not leave in the portal.'];
    if (t.loyal <= 56 && t.ego >= 62) return ['Mercenary', 'Follows the money and the playing time.'];
    if (t.tough >= 90) return ['Iron Man', 'Plays through bumps and bruises.'];
    if (t.disc >= 88) return ['Quiet Pro', 'Rarely makes the mental mistake.'];
    if (t.lead >= 86) return ['Captain', 'Teammates follow him.'];
    return ['Team First', 'Does his job.'];
  };

  /* ---------- bodies, numbers, names ---------- */
  const BODY = { QB: [74, 2, 212, 14], RB: [70.5, 1.8, 205, 13], WR: [72.5, 2.4, 192, 14], TE: [76, 1.4, 245, 12], OT: [77.5, 1.2, 312, 14], IOL: [75.5, 1.2, 312, 13],
    EDGE: [75.5, 1.4, 255, 14], DT: [75, 1.3, 300, 16], LB: [73.5, 1.4, 230, 10], CB: [71.5, 1.6, 186, 9], S: [72.5, 1.4, 202, 10], K: [72.5, 2, 190, 12], P: [74, 2, 205, 12], LS: [73.5, 1.5, 235, 10] };
  DY.htStr = h => `${Math.floor(h / 12)}'${h % 12}"`;
  const NUMS = { QB: [1, 19], RB: [0, 39], WR: [0, 19], TE: [80, 89], OT: [50, 79], IOL: [50, 79], EDGE: [5, 99], DT: [90, 99], LB: [0, 59], CB: [0, 39], S: [0, 39], K: [10, 49], P: [10, 49], LS: [40, 69] };
  // jersey numbers: two players may share a number only if one plays offense and the other defense (they are never on the
  // field together). Kickers, punters and snappers get a number of their own. Real players keep their real numbers.
  DY.fixNums = team => {
    if (!team || !team.roster) return;
    const ps = team.roster.map(DY.P).filter(Boolean).sort((a, b) => (b.real ? 1 : 0) - (a.real ? 1 : 0) || b.yr - a.yr || a.id - b.id);
    const used = { O: new Set(), D: new Set(), ST: new Set() };
    const clash = (side, n) => side === 'ST' ? used.O.has(n) || used.D.has(n) || used.ST.has(n) : used[side].has(n) || used.ST.has(n);
    ps.forEach(p => {
      const side = DY.SIDE(p.pos);
      if (p.num == null || (clash(side, p.num) && !p.real)) {
        const r = NUMS[p.pos] || [0, 99], free = [];
        for (let n = r[0]; n <= r[1]; n++) if (!clash(side, n)) free.push(n);
        if (!free.length) for (let n = 0; n <= 99; n++) if (!clash(side, n)) free.push(n);
        if (free.length) p.num = pick(free);
      }
      used[side].add(p.num);
    });
  };
  DY.makeName = () => {
    let n = pick(DY.FIRST) + ' ' + pick(DY.LAST);
    if (chance(0.045)) n += ' ' + pick(DY.SUFFIX);
    else if (chance(0.03)) n = pick(DY.FIRST).slice(0, 1) + '.' + pick(DY.FIRST).slice(0, 1) + '. ' + pick(DY.LAST);
    return n;
  };
  DY.makeHome = st => { st = st || DY.wpick(DY.RECRUIT_STATES, x => x[1])[0]; const towns = DY.TOWNS[st] || ['Springfield']; return { st, home: pick(towns) + ', ' + st }; };
  DY.makeHS = home => { const town = home.split(',')[0]; return chance(0.55) ? town + ' ' + pick(DY.HS_WORDS) : pick(DY.LAST) + ' ' + pick(DY.HS_WORDS); };

  /* ---------- making players ---------- */
  DY.G = null;
  DY.P = id => DY.G.P[id] || (DY.TMP && DY.TMP[id]);
  DY.newId = () => DY.G.nextId++;
  // yr: academic year 1-5; el: seasons of eligibility left including this one; rsAvail: can still redshirt this season
  DY.makePlayer = (pos, ovr, opts) => {
    opts = opts || {};
    const b = BODY[pos], { at, arch } = DY.makeAttrs(pos, ovr, opts.arch);
    const ho = opts.home ? { st: opts.st, home: opts.home } : DY.makeHome(opts.st);
    const p = {
      id: opts.tmp ? opts.tmp : DY.newId(), n: opts.n || DY.makeName(), pos, t: opts.t == null ? null : opts.t,
      yr: opts.yr || 1, el: opts.el == null ? 5 : opts.el,
      num: opts.num == null ? ri(NUMS[pos][0], NUMS[pos][1]) : opts.num,
      ht: opts.ht || Math.round(b[0] + gauss() * b[1]), wt: opts.wt || Math.round(b[2] + gauss() * b[3] / 1.5),
      home: ho.home, st: ho.st, hs: opts.hs || DY.makeHS(ho.home), at, arch, ovr: 0, tr: DY.makeTraits(),
      rec: opts.rec || null, nil: 0, s: null, car: {}, aw: [], log: [], inj: null, gp: 0,
    };
    for (const k in p.at) if (p.at[k] < 50) p.at[k] = 50;   // the scale is 50-99
    DY.setOvr(p);
    DY.setCeil(p, opts.grade || (p.rec ? p.rec.g : 82));
    if (opts.ceil) { p.ceil = Math.max(p.ovr, opts.ceil); p.potG = DY.scoutGrade(p.ceil); }
    return p;
  };
  // 247-style composite (0.7000-1.0000) and stars
  DY.starsOf = (c, pos) => { const st = c >= 0.9834 ? 5 : c >= 0.89 ? 4 : c >= 0.797 ? 3 : 2; return pos === 'K' || pos === 'P' || pos === 'LS' ? Math.min(3, st) : st; };   // specialists top out at three stars
  DY.compStr = c => c.toFixed(4);

  /* ---------- NIL ---------- */
  DY.NIL_POS = { QB: 3.2, EDGE: 1.5, WR: 1.35, OT: 1.3, CB: 1.25, DT: 1.15, RB: 1.1, S: 1.0, LB: 1.0, TE: 0.95, IOL: 0.95, K: 0.35, P: 0.3, LS: 0.15 };
  DY.nilValue = (p, team) => {
    const pr = team ? team.prestige : 70;
    let v = 12000 * Math.exp((p.ovr - 60) / 6.8) * DY.NIL_POS[p.pos];
    let hype = 0;
    if (p.rec && p.rec.stars >= 5 && p.yr <= 2) hype += 0.35; else if (p.rec && p.rec.stars === 4 && p.yr <= 1) hype += 0.12;
    (p.aw || []).forEach(a => { if (/AA1|HEIS/.test(a.a)) hype += 0.35; else if (/AA2|FRAA|SEC1|POY/.test(a.a)) hype += 0.15; });
    if (p.tr && p.tr.ego > 75) hype += 0.1;
    v *= (1 + Math.min(hype, 0.8)) * (0.78 + pr / 400);
    return Math.round(clamp(v, 5000, 7000000) / 5000) * 5000;
  };
  DY.teamBudget = t => {
    if (!t.fbs) return 1e6;
    let b;
    if (DY.P4.includes(t.conf) || t.abbr === 'ND') b = 21.58e6 * (0.75 + t.prestige / 400) + Math.max(0, t.prestige - 60) * 0.36e6;
    else b = 3e6 + t.prestige * 0.07e6;
    if (t.abbr === 'TTU') b += 6e6;
    return Math.round(b / 1e5) * 1e5;
  };
  // NIL for a signee, from his composite (On3-style: 5-stars around $400K-$900K, top 4-stars $150K-$300K, 3-stars $20K-$60K)
  DY.recruitNil = p => { const c = p.rec && p.rec.c || 0.84; const v = 25000 * Math.exp((c - 0.85) * 24) * Math.sqrt(DY.NIL_POS[p.pos] || 1); return Math.round(clamp(v, 5000, 1500000) / 5000) * 5000; };
  DY.money = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M' : v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : '$' + Math.round(v);

  /* ---------- scouting report text ---------- */
  const GOOD = { spd: 'true long speed', acc: 'an explosive first step', agi: 'loose hips and quick feet', str: 'a strong, sturdy frame', awr: 'a high football IQ',
    thp: 'a big arm that drives the ball outside the numbers', sac: 'pinpoint accuracy on short throws', mac: 'touch and timing over the middle', dac: 'the arm talent to drop it in the bucket deep',
    tup: 'poise when the pocket collapses', car: 'excellent ball security', btk: 'contact balance that breaks arm tackles', elu: 'make-you-miss ability in space', bcv: 'patience and vision as a runner',
    cth: 'soft, reliable hands', cit: 'toughness at the catch point', srr: 'crisp short-area routes', drr: 'a deep route tree that stacks defenders', rls: 'a quick release off press',
    spc: 'a big catch radius', rbk: 'nastiness as a run blocker', pbk: 'a calm, square pass set', pmv: 'heavy hands and a violent bull rush', fmv: 'bend and a deep bag of rush moves',
    bsh: 'violent hands that shed blocks', tak: 'sure, wrap-up tackling', pur: 'a relentless motor in pursuit', prc: 'quick diagnosis of what he sees', mcv: 'sticky man coverage',
    zcv: 'great zone instincts', prs: 'physical jams at the line', hit: 'punishing hits', kpw: 'a booming leg', kac: 'a repeatable, accurate stroke', snp: 'clean, consistent snaps' };
  const BAD = { spd: 'lacks top-end speed', acc: 'slow to get going', agi: 'stiff in space', str: 'needs to add strength', awr: 'still learning to read the field',
    thp: 'average arm strength', sac: 'misses easy throws at times', mac: 'inconsistent over the middle', dac: 'deep ball can float', tup: 'gets rattled under pressure',
    car: 'ball security is a concern', btk: 'goes down on first contact too often', elu: 'not much wiggle', bcv: 'misses cutback lanes', cth: 'concentration drops',
    cit: 'can be knocked off the ball', srr: 'rounds off routes', drr: 'limited route tree deep', rls: 'struggles with press', spc: 'small catch radius', rbk: 'leans and lunges in the run game',
    pbk: 'can be beaten by speed off the edge', pmv: 'lacks power at the point', fmv: 'one-move rusher', bsh: 'stays blocked too long', tak: 'misses tackles in space',
    pur: 'motor runs hot and cold', prc: 'bites on play-action', mcv: 'grabby in man coverage', zcv: 'can lose track in zone', prs: 'soft at the line', hit: 'not a physical tackler',
    kpw: 'limited range', kac: 'inconsistent from distance', snp: '' };
  DY.scoutReport = p => {
    const w = DY.W[p.pos], ks = Object.keys(w).filter(k => p.at[k] != null).sort((a, b) => (p.at[b] - p.ovr - (b === 'spd' ? DY.SPD_ADJ[p.pos] || 0 : 0)) - (p.at[a] - p.ovr - (a === 'spd' ? DY.SPD_ADJ[p.pos] || 0 : 0)));
    const g = ks.slice(0, 2).map(k => GOOD[k]), b = BAD[ks[ks.length - 1]];
    const size = p.wt >= 300 ? 'massive' : p.ht >= 77 ? 'long' : p.ht <= 70 ? 'compact' : 'well-built';
    return `A ${size} ${p.arch.toLowerCase()} with ${g.join(' and ')}. ${b ? b.charAt(0).toUpperCase() + b.slice(1) + '.' : ''}`.trim();
  };

  /* ---------- real Tennessee roster ---------- */
  const htIn = s => { const m = /(\d+)['-](\d+)/.exec(s || ''); return m ? +m[1] * 12 + +m[2] : null; };
  const ELIG = { FR: 1, SO: 2, JR: 3, SR: 4, GR: 4 };
  const CLS = { 'Fr.': 1, 'So.': 2, 'Jr.': 3, 'Sr.': 4, '5th': 5 };
  function slotsOf(depth) {
    const out = {};
    for (const grp in depth) depth[grp].forEach(([slot, names]) => names.forEach((n, i) => { (out[n] = out[n] || []).push({ slot, i }); }));
    return out;
  }
  function prodScore(rp, pos) {
    const s = rp.stats || {}, car = rp.career || {}, gp = (s.def && s.def.gp) || 6;
    let v = 0;
    const prior = car['2025'] || {};
    if (pos === 'QB' && s.pass && s.pass[1] >= 40) { v = clamp((s.pass[6] - 125) / 40, -0.8, 1.3) * 5 + clamp(s.pass[1] / gp / 32, 0, 1.2) * 2.5; if (s.rush && s.rush[1] / gp > 25) v += 1; }
    else if (pos === 'RB' && s.rush && s.rush[0] >= 12) v = clamp((s.rush[1] / gp) / 85, 0, 1.5) * 5 + clamp(s.rush[4] / gp, 0, 1.5) * 1.6 + clamp(s.rush[2] - 4.6, -2, 2.5) * 0.8;
    else if ((pos === 'WR' || pos === 'TE') && s.rec && s.rec[0] >= 4) v = clamp((s.rec[1] / gp) / (pos === 'TE' ? 45 : 65), 0, 1.6) * 5 + clamp(s.rec[4] / gp, 0, 1) * 2.4;
    else if (s.def && s.def.tot >= 6) {
      const d = s.def;
      if (pos === 'EDGE' || pos === 'DT') v = clamp((d.tfl * 1.5 + d.sacks * 2 + d.qbh * 0.5 + d.ff) / gp, 0, 3) * 2.4 + d.tot / gp / 5;
      else if (pos === 'LB') v = clamp(d.tot / gp / 7, 0, 1.4) * 4 + clamp((d.tfl + d.sacks) / gp, 0, 1.5) * 1.6;
      else v = clamp((d.int * 4 + d.pbu * 1.5 + d.ff * 2) / gp, 0, 3) * 1.6 + clamp(d.tot / gp / 5, 0, 1.2) * 1.8;
    } else if (pos === 'K' && s.kick && s.kick[1]) v = (s.kick[0] / s.kick[1] - 0.78) * 14 + (s.kick[4] - 42) / 4;
    else if (pos === 'P' && s.punt && s.punt[0]) v = (s.punt[2] - 42.5) * 1.3;
    // a little credit for 2025 production
    if (prior.pass && prior.pass[2] > 1000) v += 1.2;
    if (prior.rush && prior.rush[1] > 500) v += 1.2;
    if (prior.rec && prior.rec[1] > 500) v += 1.2;
    if (prior.def && prior.def[0] > 40) v += 1;
    return clamp(v, -3, 8);
  }
  const soft = x => x > 8 ? 8 + (x - 8) * 0.4 : x;
  function realPos(rp, slots) {
    const sl = (slots[rp.name] || []).map(x => x.slot), wt = rp.wt || 0, ht = htIn(rp.ht) || 74;
    switch (rp.pos) {
      case 'OL': return sl.some(s => s === 'LT' || s === 'RT') ? 'OT' : sl.some(s => /LG|RG|^C$/.test(s)) ? 'IOL' : ht >= 78 ? 'OT' : 'IOL';
      case 'DL': return sl.includes('DE') ? 'EDGE' : sl.includes('DT') ? 'DT' : wt >= 282 ? 'DT' : 'EDGE';
      case 'DB': return sl.includes('S') ? 'S' : sl.some(s => s === 'CB' || s === 'NICKEL') ? 'CB' : wt >= 199 ? 'S' : 'CB';
      case 'PK': case 'P/PK': return 'K';
      default: return rp.pos;
    }
  }
  function realArch(pos, rp) {
    const s = rp.stats || {};
    if (pos === 'QB') return s.rush && s.rush[1] > 120 ? 'Dual Threat' : (htIn(rp.ht) || 74) >= 77 ? 'Pocket Passer' : null;
    if (pos === 'RB') return rp.wt >= 215 ? 'Power Back' : rp.wt <= 195 ? 'Elusive Back' : null;
    if (pos === 'WR') return s.rec && s.rec[2] >= 16 ? 'Deep Threat' : s.rec && s.rec[0] >= 20 && s.rec[2] < 12 ? 'Possession' : null;
    if (pos === 'TE') return s.rec && s.rec[1] > 150 ? 'Vertical Threat' : null;
    if (pos === 'EDGE') return rp.wt >= 265 ? 'Power Rusher' : 'Speed Rusher';
    return null;
  }
  // AJ's corrections to the real roster (class, role, ratings); 5-in-5 eligibility: Fr, So, Jr, Sr, 5th
  DY.UT_FIX = {
    'George MacIntyre': { yr: 2 }, 'DeSean Bishop': { yr: 4, walkon: true, ovr: 92, tr: { cons: 90, ego: 30, lead: 92, work: 95, disc: 88, clutch: 90 }, note: 'Former walk-on turned Heisman candidate.' }, 'Braylon Staley': { yr: 3 }, 'Jesse Perry': { yr: 3, at: { rbk: 85, pbk: 75 }, note: 'A natural guard playing tackle.' },
    'Sam Pendleton': { yr: 4 }, 'Nic Moore': { yr: 2 }, 'Tyree Weathersby': { yr: 4, ovr: 87 }, 'Jordan Norman': { yr: 4 }, 'Christian Gass': { yr: 2 },
    'Xavier Gilliam': { yr: 3, ovr: 95 }, 'Carson Gentle': { yr: 3 }, 'Nathan Robinson': { yr: 4 }, 'Edwin Spillman': { yr: 3 }, 'Tevis Metcalf': { yr: 4 },
    'Daune Morris': { ovr: 82, arch: 'Elusive Back' }, 'Javin Gordon': { ovr: 75 }, 'David Sanders Jr.': { ovr: 92, arch: 'Pass Protector' },
    'JJ Finch': { ovr: 75 }, 'Ethan Utley': { ovr: 75 }, 'Jeremiah Telander': { pos: 'EDGE', tr: { lead: 96 }, note: 'Hybrid edge/linebacker.' },
    'Arion Carter': { ovr: 88, at: { mcv: 79 }, tr: { lead: 99, work: 94, clutch: 90, disc: 92, tough: 94, loyal: 94, cons: 88, ego: 35 }, captain: true },
    'Amare Campbell': { ovr: 87, at: { tak: 91, pur: 90 } }, 'Ty Redmond': { ovr: 87, at: { mcv: 88, awr: 86, tak: 82 } },
    'Dejuan Lane': { ovr: 90, at: { zcv: 92, awr: 90, tak: 88 }, tr: { lead: 90 } }, 'Edrees Farooq': { ovr: 85 },
  };
  // AJ's rating notes (Oct. 26): applied after the overall is set. at/tr = exact values, atd/trd = changes, alt = positions he plays without a penalty
  DY.UT_POST = {
    'Xavier Gilliam': { tr: { tough: 80, cons: 90 } },
    'DeSean Bishop': { at: { spd: 88 }, ovr: 92, tr: { ego: 30, tough: 92, loyal: 95 } },
    'David Sanders Jr.': { tr: { cons: 90 } },
    'Mike Matthews': { tr: { tough: 90, cons: 80 } },
    'Daevin Hobbs': { tr: { work: 92 } },
    'Dejuan Lane': { tr: { disc: 92, clutch: 92, cons: 92, work: 94, tough: 92 } },
    'Kayin Lee': { tr: { cons: 88 } },
    'Amare Campbell': { tr: { disc: 88, clutch: 87, cons: 86, lead: 86, work: 89, tough: 88, loyal: 87, ego: 40 } },
    'Ty Redmond': { tr: { cons: 95 } },
    'Tyree Weathersby': { tr: { loyal: 93, clutch: 88, cons: 88, lead: 88, work: 90, tough: 90, ego: 38 } },
    'Jeremiah Telander': { tr: { tough: 92, work: 94 }, alt: ['LB'] },
    'DaSaahn Brame': { atd: { spd: 8, elu: 8, acc: 8 } },
    'Ethan Davis': { atd: { pbk: -4, str: -4, spd: 10, acc: 8, agi: 3, elu: 3 }, tr: { loyal: 95 }, trd: { lead: 8 } },
    'Daune Morris': { at: { spd: 92 } },
    'Qua Moss': { atd: { prs: -6, spd: 10, tak: 6, hit: 6, prc: 6, str: 5, awr: 5 } },
    'Faizon Brandon': { at: { thp: 95, tup: 70, awr: 72, spd: 89, agi: 91, acc: 88 }, tr: { work: 99, tough: 90, loyal: 90 } },
    'George MacIntyre': { at: { thp: 92, sac: 84, mac: 85, dac: 81, spd: 79, agi: 83, str: 60 }, trd: { cons: 10 }, tr: { loyal: 95 } },
    'Jesse Perry': { at: { pbk: 78, rbk: 90 }, alt: ['IOL'] },
    'Shamurad Umarov': { at: { rbk: 75, pbk: 70 }, atd: { agi: -15 } },
    'Justin Baker': { at: { spd: 95, acc: 93 }, atd: { elu: 6 }, ovrd: 4 },
    'Javin Gordon': { atd: { spd: 5, elu: 6 } },
    'TK Keys': { atd: { cit: 8, spc: 8 } },
    'Wendell Moe Jr.': { ovr: 82 },
  };
  DY.applyPost = p => {
    const x = DY.UT_POST[p.n]; if (!x) return;
    const o0 = p.ovr;
    if (x.at) for (const k in x.at) p.at[k] = x.at[k];
    if (x.atd) for (const k in x.atd) if (p.at[k] != null) p.at[k] = Math.round(clamp(p.at[k] + x.atd[k], 50, 99));
    if (x.ovr || x.ovrd) { const fixed = Object.assign({}, x.at || {}); for (const k in x.atd || {}) fixed[k] = p.at[k]; DY.fitOvr(p, x.ovr || o0 + x.ovrd, fixed); }
    if (x.tr) Object.assign(p.tr, x.tr);
    if (x.trd) for (const k in x.trd) p.tr[k] = Math.round(clamp(p.tr[k] + x.trd[k], 50, 99));
    if (x.alt) p.alt = x.alt;
    DY.setOvr(p); if (p.ceil < p.ovr) p.ceil = p.ovr;
  };
  DY.UT_CUTS = ['Mason Phillips', 'Will Rajecki', 'Cole Harrison', 'Charlie Powell III', 'Thomas Storm', 'Michael Kostantonov', 'CJ Edwards', 'Nuk Simmons', 'Darryl Rivers',
    'Grier Short', 'Ryan Scott', 'Grady Dangerfield', 'Javonte Smith', 'Jackson Mathews', 'Isaiah Hardge', 'Luke Thompson', 'Lane Cope'];
  DY.WR_KEEP = 8;
  // hold some attributes and move the rest until the overall lands on a target
  DY.fitOvr = (p, target, fixed) => {
    const w = DY.W[p.pos]; fixed = fixed || {};
    for (let it = 0; it < 8; it++) {
      const o = DY.calcOvr(p); const d = target - o; if (Math.abs(d) < 0.5) break;
      const free = Object.keys(w).filter(k => fixed[k] == null);
      const wsum = free.reduce((s, k) => s + w[k], 0) || 1;
      free.forEach(k => { p.at[k] = Math.round(clamp(p.at[k] + d / wsum * 1, 50, 99)); });
    }
    DY.setOvr(p);
  };
  DY.importTennessee = (team) => {
    const F = root.SITE && root.SITE.football, depth = root.DEPTH && root.DEPTH.football && root.DEPTH.football.current.chart;
    const HS = (root.SITE_AUTO && root.SITE_AUTO.football && root.SITE_AUTO.football.ratings) || {};
    if (!F) throw new Error('Tennessee roster data is missing.');
    const slots = slotsOf(depth || {}), ids = [];
    F.players.forEach(rp => {
      if (DY.UT_CUTS.includes(rp.name)) return;
      const fx = DY.UT_FIX[rp.name] || {};
      const pos = fx.pos || realPos(rp, slots);
      const yr = fx.yr || Math.min(5, CLS[rp.cls] || 2);
      let el = 6 - yr;
      if (rp.leaving && yr >= 5) el = 1;
      const hr = HS[rp.name] || {}, hs = hr.hs, tr = hr.transfer;
      const walkon = fx.walkon || (!hs && !(rp.rating && rp.rating.src === '247') && !(tr && tr.stars));
      const g = hs ? hs.grade : rp.rating && rp.rating.src === '247' ? rp.rating.grade : tr && tr.grade ? tr.grade - 1 : 72;
      const yrsIn = Math.max(0, yr - 1);
      let base = 61.5 + (g - 80) * 0.7 + yrsIn * 2.9;
      let bonus = prodScore(rp, pos);
      const sl = slots[rp.name] || [];
      const starter = sl.some(x => x.i === 0 && !/KO|^H$|KR|PR/.test(x.slot)), second = sl.some(x => x.i === 1 && !/KO|^H$|KR|PR/.test(x.slot));
      if (starter) bonus += 4; else if (second) bonus += 1.2;
      bonus += Math.min(2.5, (rp.honors || []).filter(h => /All-SEC|All-America|watch list|Player of the Week/i.test(h)).length * 0.8);
      bonus += Math.min(3, (rp.natRanks || []).length * 1);
      if (rp.draft) bonus += rp.draft.level === 'High' ? 4 : rp.draft.level === 'Medium' ? 2.5 : 1;
      if (rp.rating && rp.rating.src === 'on3' && rp.rating.rank) bonus += rp.rating.rank <= 50 ? 4 : rp.rating.rank <= 150 ? 2.5 : 1.5;
      let ovr = base + soft(bonus);
      if (starter) ovr = Math.max(ovr, 77);
      ovr = Math.round(clamp(fx.ovr || ovr, 50, 96));
      const stars = walkon ? 0 : hs ? hs.stars : tr && tr.stars ? tr.stars : rp.rating ? rp.rating.stars : 3;
      const comp = walkon ? null : hs ? Math.round(hs.grade * 100) / 1e4 : clamp(0.70 + (g - 70) * 0.01, 0.7, 0.9999);
      const hm = /,\s*([A-Za-z.]+)$/.exec(rp.home || '');
      const p = DY.makePlayer(pos, ovr, {
        n: rp.name, t: team.id, yr, el, num: rp.num, ht: htIn(rp.ht) || undefined, wt: rp.wt || undefined,
        home: rp.home || 'Knoxville, TN', st: hm ? stAbbr(hm[1]) : 'TN', hs: rp.hs || '', arch: fx.arch || realArch(pos, rp), grade: walkon ? 74 : g,
        rec: walkon ? { walkon: true, stars: 0 } : { c: comp, stars, g, nat: hs ? hs.nat : null, cls: hs ? hs.cls : null, src: hs ? '247 Composite' : 'rating' },
      });
      if (fx.tr) Object.assign(p.tr, fx.tr);
      if (fx.at) Object.assign(p.at, fx.at);
      DY.fitOvr(p, ovr, fx.at);
      DY.applyPost(p);
      if (p.ceil < p.ovr) p.ceil = p.ovr;
      if (fx.ovr && p.ceil < p.ovr + 2 && p.el > 1) { p.ceil = p.ovr + Math.max(2, (p.el - 1) * 2); p.potG = DY.scoutGrade(p.ceil); }
      p.real = rp.id; p.prev = rp.prev || null; p.honReal = rp.honors || []; if (fx.note) p.note = fx.note; if (fx.captain) p.captain = true;
      if (tr && tr.origin) p.prev = p.prev || tr.origin;
      if (rp.draft) p.draftNote = rp.draft.note;
      if (rp.career) p.realCar = rp.career;
      ids.push(p.id); DY.G.P[p.id] = p;
    });
    // receivers: keep the top eight
    const wrs = ids.map(id => DY.G.P[id]).filter(p => p.pos === 'WR').sort((a, b) => b.ovr - a.ovr);
    const cutWr = new Set(wrs.slice(DY.WR_KEEP).map(p => p.id));
    cutWr.forEach(id => delete DY.G.P[id]);
    team.roster = ids.filter(id => !cutWr.has(id));
    team.depth = DY.autoDepth(team, depth ? realDepthOrder(depth, team.roster) : null);
    DY.G.rosterMax = 85;
    return team.roster;
  };
  const ST_FULL = { 'Tenn.': 'TN', 'Ga.': 'GA', 'Fla.': 'FL', 'Ala.': 'AL', 'Va.': 'VA', 'Md.': 'MD', 'N.C.': 'NC', 'S.C.': 'SC', 'Ky.': 'KY', 'Miss.': 'MS', 'La.': 'LA',
    'Texas': 'TX', 'Ohio': 'OH', 'Calif.': 'CA', 'Wis.': 'WI', 'Ill.': 'IL', 'Mich.': 'MI', 'Pa.': 'PA', 'N.J.': 'NJ', 'Ariz.': 'AZ', 'Mo.': 'MO', 'Ind.': 'IN', 'Okla.': 'OK',
    'Ark.': 'AR', 'Australia': 'TN', 'Colo.': 'CO', 'Wash.': 'WA', 'Minn.': 'MN', 'Iowa': 'IA', 'Kan.': 'KS', 'Neb.': 'NE', 'Nev.': 'NV', 'Utah': 'UT', 'N.Y.': 'NY', 'Mass.': 'MA', 'Conn.': 'CT', 'D.C.': 'DC' };
  function stAbbr(s) { if (/^[A-Z]{2}$/.test(s)) return s; return ST_FULL[s] || ST_FULL[s + '.'] || 'TN'; }
  DY.stAbbr = stAbbr;
  function realDepthOrder(chart, ids) {
    const byName = {}; ids.forEach(id => { byName[DY.G.P[id].n] = id; });
    const want = { QB: ['QB'], RB: ['RB'], WR: ['WR-X', 'WR-Z', 'WR-SL'], TE: ['TE'], OT: ['LT', 'RT'], IOL: ['LG', 'C', 'RG'], EDGE: ['DE'], DT: ['DT'], LB: ['MIKE', 'WILL'], CB: ['CB', 'NICKEL'], S: ['S'], K: ['PK'], P: ['P'] };
    const out = {};
    const rows = []; for (const g in chart) chart[g].forEach(r => rows.push(r));
    for (const pos in want) {
      const lists = rows.filter(r => want[pos].includes(r[0])).map(r => r[1]);
      const order = [];
      // starters first (row 1 of each slot), then 2nd string, ...
      for (let d = 0; d < 4; d++) lists.forEach(l => { const n = l[d]; if (n && byName[n] != null && DY.G.P[byName[n]].pos === pos && !order.includes(byName[n])) order.push(byName[n]); });
      out[pos] = order;
    }
    return out;
  }

  /* ---------- position changes ---------- */
  // natural moves keep most of a player's value; a defensive tackle at safety does not
  DY.COMPAT = { QB: ['RB', 'WR'], RB: ['WR', 'S', 'LB'], WR: ['RB', 'CB', 'TE'], TE: ['WR', 'OT', 'IOL', 'EDGE', 'LB'], OT: ['IOL', 'TE'], IOL: ['OT', 'DT'],
    EDGE: ['DT', 'LB', 'TE'], DT: ['EDGE', 'IOL'], LB: ['EDGE', 'S', 'RB'], CB: ['S', 'WR'], S: ['CB', 'LB', 'RB'], K: ['P'], P: ['K'], LS: [] };
  DY.posFit = (p, pos) => { const home = p.pos0 || p.pos; return pos === home || (p.alt || []).includes(pos) ? 'natural' : (DY.COMPAT[home] || []).includes(pos) ? 'ok' : 'poor'; };
  DY.ovrAt = (p, pos) => {
    const home = p.pos0 || p.pos, base = p.at0 || p.at, alt = (p.alt || []).includes(pos), fit = pos === home || alt ? 0 : (DY.COMPAT[home] || []).includes(pos) ? 6 : 20;
    const at = Object.assign({}, base);
    for (const k in DY.W[pos]) if (at[k] == null) at[k] = Math.round(clamp((p.ovr0 || p.ovr) - (alt ? 1 : 8) - fit, 50, 92));
    // body: big men lose speed-based value at skill spots, small men lose strength at the line
    let sum = 0; for (const k in DY.W[pos]) sum += DY.W[pos][k] * at[k];
    return { ovr: Math.round(clamp(sum - (pos === home || alt ? 0 : fit * 0.25), 40, 99)), at };
  };
  DY.changePos = (p, pos) => {
    if (!DY.W[pos] || pos === p.pos) return;
    if (!p.pos0) { p.pos0 = p.pos; p.at0 = Object.assign({}, p.at); p.ovr0 = p.ovr; }
    if (pos === p.pos0) { p.pos = pos; p.at = p.at0; delete p.pos0; delete p.at0; delete p.ovr0; DY.setOvr(p); return; }
    const r = DY.ovrAt(p, pos); p.pos = pos; p.at = r.at; DY.setOvr(p);
    if (p.ceil < p.ovr) p.ceil = p.ovr;
  };

  /* ---------- depth chart ---------- */
  DY.STARTERS = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, IOL: 3, EDGE: 2, DT: 2, LB: 2, CB: 2, S: 2, K: 1, P: 1 };
  DY.healthy = p => !p.inj || p.inj.wks <= 0;
  DY.autoDepth = (team, seed) => {
    const d = {};
    for (const pos in DY.STARTERS) {
      const all = team.roster.map(DY.P).filter(p => p && p.pos === pos);
      const first = seed && seed[pos] ? seed[pos].map(DY.P).filter(p => p && p.pos === pos) : [];
      const rest = all.filter(p => !first.includes(p)).sort((a, b) => b.ovr - a.ovr);
      d[pos] = first.concat(rest).map(p => p.id);
    }
    return d;
  };
  // re-sort a CPU depth chart by overall each week; the user's chart keeps its order (injured players skipped at game time)
  // real Tennessee stats from before the dynasty (2023-25) go into each player's career line, so the record chase is real
  DY.seedPast = g => {
    const past = root.DY_PAST; if (!past || !g || g.pastSeeded) return;
    const start = g.startSeason || 2026;
    Object.values(g.P).forEach(p => {
      if (!p || !p.real) return; const rows = past[p.n]; if (!rows) return;
      p.car = p.car || {};
      for (const y in rows) if (+y < start && !p.car[y]) p.car[y] = Object.assign({ t: 'TENN', real: true }, rows[y]);
      const ys = Object.keys(rows).map(Number); if (ys.length) p.firstY = Math.min(p.firstY || 9999, ...ys);
    });
    g.pastSeeded = true;
  };
  DY.refreshDepth = team => {
    const old = team.depth || {};
    for (const pos in DY.STARTERS) {
      const have = team.roster.map(DY.P).filter(p => p && p.pos === pos);
      if (team.user && team.depthEdited) {
        const keep = (old[pos] || []).filter(id => have.some(p => p.id === id));
        have.forEach(p => { if (!keep.includes(p.id)) keep.push(p.id); });
        team.depth[pos] = keep;
      } else team.depth[pos] = have.sort((a, b) => b.ovr - a.ovr).map(p => p.id);
    }
  };
  // the 11 + specialists for a game
  DY.lineup = team => {
    const d = team.depth, ok = id => { const p = DY.P(id); return p && DY.healthy(p) && team.roster.includes(id); };
    const take = (pos, n) => (d[pos] || []).filter(ok).slice(0, n).map(DY.P);
    const L = {
      QB: take('QB', 2), RB: take('RB', 3), WR: take('WR', 5), TE: take('TE', 2), OT: take('OT', 3), IOL: take('IOL', 4),
      EDGE: take('EDGE', 4), DT: take('DT', 4), LB: take('LB', 3), CB: take('CB', 4), S: take('S', 3), K: take('K', 1), P: take('P', 1),
    };
    // fill holes from other positions so a game can always be played
    const fill = (pos, n, from) => { while (L[pos].length < n) { let alt = from.map(f => (d[f] || []).filter(ok).map(DY.P).find(p => !used(p))).find(Boolean); if (!alt) alt = from.map(f => (d[f] || []).filter(ok).map(DY.P).find(p => !L[pos].includes(p))).find(Boolean); if (!alt) alt = team.roster.map(DY.P).find(p => p && DY.healthy(p) && !L[pos].includes(p)); if (!alt) break; L[pos].push(alt); } };
    const used = p => Object.values(L).some(a => a.includes(p));
    fill('QB', 1, ['RB', 'WR']); fill('RB', 1, ['WR', 'S']); fill('WR', 3, ['TE', 'RB', 'CB']); fill('TE', 1, ['IOL', 'OT', 'WR']);
    fill('OT', 2, ['IOL']); fill('IOL', 3, ['OT', 'DT']); fill('EDGE', 2, ['DT', 'LB']); fill('DT', 2, ['EDGE', 'IOL']); fill('LB', 2, ['S', 'EDGE']);
    fill('CB', 2, ['S', 'WR']); fill('S', 2, ['CB', 'LB']); fill('K', 1, ['P']); fill('P', 1, ['K']);
    // nickel: the 3rd corner, else the 3rd safety
    L.NB = L.CB[2] || L.S[2] || L.CB[1];
    const ret = team.roster.map(DY.P).filter(p => p && DY.healthy(p) && ['RB', 'WR', 'CB', 'S'].includes(p.pos));
    const qbIds = L.QB.map(p => p.id);
    const starters = [L.QB[0], L.RB[0], ...L.WR.slice(0, 3), L.TE[0]];
    const kr = ret.filter(p => !qbIds.includes(p.id) && !starters.slice(0, 1).includes(p)).sort((a, b) => (b.at.spd + b.at.acc * 0.5 + (b.at.elu || 60) * 0.4) - (a.at.spd + a.at.acc * 0.5 + (a.at.elu || 60) * 0.4));
    L.KR = team.kr && ok(team.kr) ? DY.P(team.kr) : kr[0] || L.RB[0];
    L.PR = team.pr && ok(team.pr) ? DY.P(team.pr) : kr.sort((a, b) => (b.at.agi + (b.at.cth || 60)) - (a.at.agi + (a.at.cth || 60)))[0] || L.WR[0];
    return L;
  };
  // team strength snapshot (for polls, previews, recruiting)
  DY.teamOvr = team => {
    const L = DY.lineup(team), avg = a => { a = a.filter(Boolean); return a.reduce((s, p) => s + p.ovr, 0) / Math.max(1, a.length); };
    const off = avg([L.QB[0], L.QB[0], L.RB[0], ...L.WR.slice(0, 3), L.TE[0], ...L.OT.slice(0, 2), ...L.IOL.slice(0, 3)]);
    const def = avg([...L.EDGE.slice(0, 2), ...L.DT.slice(0, 2), ...L.LB.slice(0, 2), ...L.CB.slice(0, 2), L.NB, ...L.S.slice(0, 2)]);
    const st = avg([L.K[0], L.P[0]]);
    return { off: Math.round(off), def: Math.round(def), st: Math.round(st), ovr: Math.round(off * 0.48 + def * 0.46 + st * 0.06) };
  };

  /* ---------- CPU rosters ---------- */
  DY.ROSTER_MIX = { QB: 3, RB: 4, WR: 7, TE: 3, OT: 4, IOL: 6, EDGE: 5, DT: 5, LB: 5, CB: 6, S: 4, K: 1, P: 1 };
  DY.teamMu = pr => 52 + pr * 0.36;
  const CLASS_DIST = [[1, .27], [2, .24], [3, .21], [4, .17], [5, .11]];
  const CLASS_ADJ = { 1: -13, 2: -5.5, 3: -1.5, 4: 1.5, 5: 2.5 };
  DY.genPlayerFor = (team, pos, yr, opts) => {
    opts = opts || {};
    const mu = team.fcsMu ? 61 + team.prestige * 0.25 : DY.teamMu(team.prestige);
    const ovr = Math.round(clamp(mu + CLASS_ADJ[yr] + gauss() * 4.6 + (opts.bump || 0) - (pos === 'K' || pos === 'P' ? 7 : 0), 42, 95));     // specialists rate lower
    const el = 6 - yr;
    const g = clamp(80 + (team.prestige - 50) / 3.2 + gauss() * 4.5, 70, 99.9);
    const comp = clamp(0.70 + (g - 70) * 0.01, 0.7, 0.9999);
    const st = chance(0.55) ? team.st : undefined;
    return DY.makePlayer(pos, ovr, Object.assign({ t: team.id, yr, el, grade: g, st, rec: { c: comp, stars: DY.starsOf(comp, pos), g } }, opts));
  };
  DY.genRoster = (team, tmpPrefix) => {
    const ids = [];
    let tmp = tmpPrefix;
    for (const pos in DY.ROSTER_MIX) for (let i = 0; i < DY.ROSTER_MIX[pos]; i++) {
      const yr = DY.wpick(CLASS_DIST, x => x[1])[0];
      const p = DY.genPlayerFor(team, pos, pos === 'K' || pos === 'P' ? Math.max(2, yr) : yr, tmp ? { tmp: tmp-- } : null);
      if (tmp) DY.TMP[p.id] = p; else DY.G.P[p.id] = p;
      ids.push(p.id);
    }
    team.roster = ids; team.depth = DY.autoDepth(team);
    // starters at QB: make sure the starter is not a true freshman project unless the team is thin
    return ids;
  };
  // the user's team, when it isn't Tennessee: a full roster (CPU teams carry about 54-60 for speed)
  DY.fillRoster = (team, n) => {
    const mix = Object.entries(DY.ROSTER_MIX).filter(([pos]) => !['K', 'P', 'LS'].includes(pos)), pr0 = team.prestige;
    team.prestige = Math.max(30, pr0 - 18);   // the extra bodies are depth: walk-ons and lower-rated signees
    while (team.roster.length < n) {
      const pos = DY.wpick(mix, x => x[1])[0], yr = DY.wpick(CLASS_DIST, x => x[1])[0];
      const p = DY.genPlayerFor(team, pos, yr, null); DY.G.P[p.id] = p; team.roster.push(p.id);
    }
    team.prestige = pr0;
    team.depth = DY.autoDepth(team);
  };
  // an FCS team for one game, built from a fixed seed (not saved)
  DY.TMP = {};
  DY.fcsTeam = (fcs, season) => {
    const t = Object.assign({}, fcs, { roster: [], depth: {}, style: 'spread', tmp: true, w: 0, l: 0, cw: 0, cl: 0, coach: 'staff', fcsMu: true });
    DY.withRng(DY.rngFrom(fcs.name + '|' + season), () => DY.genRoster(t, -1000 - (fcs.id - 1000) * 100));
    return t;
  };
  DY.coachName = () => pick(DY.FIRST.filter(n => n.length > 3)) + ' ' + pick(DY.LAST);
})(typeof window !== 'undefined' ? window : globalThis);
