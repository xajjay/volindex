/* The Vol Index — Hoops and Diamond Dynasty: core (random numbers, players, ratings, personality, potential, NIL,
   the real Tennessee rosters, generated rosters for everyone else). One file for all four sports; the sport's "kind"
   (hoops or diamond) picks the ratings and positions. Runs in the browser and in Node (for tests). */
(function (root) {
  'use strict';
  const SD = root.SD = root.SD || {};

  /* ---------- random numbers (seeded, so a save replays the same) ---------- */
  let seed = 1;
  SD.seed = s => { seed = (s >>> 0) || 1; };
  SD.rstate = () => seed;
  const rnd = SD.rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = SD.gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const clamp = SD.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const chance = SD.chance = p => rnd() < p;
  const rr = SD.rr = (a, b) => a + rnd() * (b - a);
  const ri = SD.ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  const pick = SD.pick = a => a[Math.floor(rnd() * a.length)];
  SD.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  SD.wpick = (list, w) => { const ws = list.map(w), tot = ws.reduce((a, b) => a + Math.max(0, b), 0); let r = rnd() * tot; for (let i = 0; i < list.length; i++) { r -= Math.max(0, ws[i]); if (r <= 0) return list[i]; } return list[list.length - 1]; };
  const G = () => SD.G;
  SD.P = id => G().P[id];
  SD.T = id => G().teams[id] || (G().guests && G().guests[id]);
  SD.SP = () => SD.SPORTS[G().sport];
  SD.kind = () => SD.SP().kind;

  /* ---------- ratings ---------- */
  SD.ATTR = {
    hoops: { ins: 'Finishing', mid: 'Mid-range', thr: 'Three-point', ft: 'Free throw', pas: 'Passing', hnd: 'Ball handling', reb: 'Rebounding', pdf: 'Perimeter defense', idf: 'Interior defense', stl: 'Steals', blk: 'Blocks', ath: 'Athleticism', iq: 'Basketball IQ', sta: 'Stamina' },
    bat: { con: 'Contact', pow: 'Power', eye: 'Plate discipline', spd: 'Speed', fld: 'Fielding', arm: 'Arm' },
    pit: { vel: 'Velocity', stf: 'Stuff', ctl: 'Control', sta: 'Stamina' },
  };
  // position weights for the overall
  SD.W = {
    PG: { thr: 0.13, mid: 0.07, ins: 0.08, pas: 0.19, hnd: 0.19, pdf: 0.12, stl: 0.06, ath: 0.08, iq: 0.08 },
    SG: { thr: 0.22, mid: 0.11, ins: 0.12, pas: 0.07, hnd: 0.1, pdf: 0.13, stl: 0.06, ath: 0.1, iq: 0.09 },
    SF: { thr: 0.16, mid: 0.09, ins: 0.14, pas: 0.06, hnd: 0.06, reb: 0.08, pdf: 0.14, ath: 0.13, iq: 0.07, blk: 0.03, stl: 0.04 },
    PF: { ins: 0.18, mid: 0.07, thr: 0.07, reb: 0.17, idf: 0.15, blk: 0.08, ath: 0.13, iq: 0.07, pdf: 0.04, pas: 0.04 },
    C: { ins: 0.2, reb: 0.21, idf: 0.19, blk: 0.14, ath: 0.12, iq: 0.07, mid: 0.03, pas: 0.04 },
    C_: { con: 0.26, pow: 0.18, eye: 0.13, fld: 0.27, arm: 0.16 },
    '1B': { con: 0.32, pow: 0.33, eye: 0.17, fld: 0.12, arm: 0.03, spd: 0.03 },
    '2B': { con: 0.3, pow: 0.15, eye: 0.15, spd: 0.12, fld: 0.2, arm: 0.08 },
    SS: { con: 0.25, pow: 0.13, eye: 0.13, spd: 0.13, fld: 0.24, arm: 0.12 },
    '3B': { con: 0.27, pow: 0.24, eye: 0.14, spd: 0.05, fld: 0.18, arm: 0.12 },
    LF: { con: 0.3, pow: 0.27, eye: 0.15, spd: 0.12, fld: 0.1, arm: 0.06 },
    CF: { con: 0.27, pow: 0.16, eye: 0.14, spd: 0.2, fld: 0.17, arm: 0.06 },
    RF: { con: 0.28, pow: 0.27, eye: 0.14, spd: 0.1, fld: 0.1, arm: 0.11 },
    DH: { con: 0.38, pow: 0.42, eye: 0.2 },
    SP: { vel: 0.26, stf: 0.32, ctl: 0.28, sta: 0.14 },
    RP: { vel: 0.33, stf: 0.37, ctl: 0.27, sta: 0.03 },
  };
  SD.POS = { hoops: ['PG', 'SG', 'SF', 'PF', 'C'], diamond: ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH', 'SP', 'RP'] };
  const wkey = pos => pos === 'C' && SD.kind() === 'diamond' ? 'C_' : pos;
  SD.isPit = p => p.pos === 'SP' || p.pos === 'RP';
  SD.calcOvr = p => { const w = SD.W[wkey(p.pos)]; let s = 0, t = 0; for (const k in w) { s += w[k] * (p.at[k] || 60); t += w[k]; } return Math.round(clamp(s / t, 40, 99)); };
  SD.setOvr = p => { p.ovr = SD.calcOvr(p); return p.ovr; };
  // build attributes around a target overall (some spread, a little archetype flavor)
  function fillAttrs(pos, target, kind) {
    const at = {};
    const keys = kind === 'hoops' ? Object.keys(SD.ATTR.hoops) : SD.isPit({ pos }) ? Object.keys(SD.ATTR.pit).concat(['con', 'pow', 'eye', 'spd', 'fld', 'arm']) : Object.keys(SD.ATTR.bat);
    const w = SD.W[pos === 'C' && kind === 'diamond' ? 'C_' : pos];
    keys.forEach(k => { const inW = w[k] != null; at[k] = Math.round(clamp(target + (inW ? 0 : -8) + gauss() * (inW ? 6 : 8), 50, 99)); });
    if (kind === 'diamond' && SD.isPit({ pos })) ['con', 'pow', 'eye'].forEach(k => { at[k] = Math.round(clamp(45 + gauss() * 5, 50, 70)); });
    // pull the weighted overall onto the target
    for (let it = 0; it < 6; it++) { let s = 0, t = 0; for (const k in w) { s += w[k] * at[k]; t += w[k]; } const d = target - s / t; if (Math.abs(d) < 0.4) break; for (const k in w) at[k] = Math.round(clamp(at[k] + d, 50, 99)); }
    if (kind === 'hoops') at.sta = Math.round(clamp(70 + gauss() * 9, 50, 99));
    return at;
  }

  /* ---------- personality (same traits as Vol Dynasty football, 50-99, about 70 on average; ego: lower is better) ---------- */
  SD.TRAITS = { disc: 'Discipline', clutch: 'Clutch', cons: 'Consistency', ego: 'Ego', lead: 'Leadership', work: 'Work ethic', tough: 'Toughness', loyal: 'Loyalty' };
  SD.makeTraits = () => { const t = {}; for (const k in SD.TRAITS) t[k] = k === 'ego' ? Math.round(clamp(52 + gauss() * 14, 20, 95)) : Math.round(clamp(70 + gauss() * 9.5, 50, 99)); return t; };
  SD.persLabel = p => {
    const t = p.tr;
    if (t.clutch >= 88) return ['Ice Water', 'Wants the ball with the game on the line.'];
    if (t.lead >= 88) return ['Floor General', 'The voice in the huddle; steadies the team on the road.'];
    if (t.work >= 90) return ['Gym Rat', 'First one in, last one out. Develops faster than his peers.'];
    if (t.ego >= 80) return ['Showman', 'Loves the moment and the camera. Big NIL asks.'];
    if (t.cons >= 88) return ['Steady', 'You know what you are getting every night.'];
    if (t.cons <= 55) return ['Streaky', 'Can take over a game or disappear in it.'];
    if (t.loyal >= 90) return ['Lifer', "Bleeds orange. Won't leave in the portal."];
    if (t.tough >= 90) return ['Iron Man', 'Plays through bumps and bruises.'];
    return ['Team First', 'Does his job.'];
  };

  /* ---------- potential ---------- */
  SD.GRADES = [['A+', 97], ['A', 92], ['A-', 88], ['B+', 84], ['B', 80], ['B-', 76], ['C+', 72], ['C', 68], ['C-', 64], ['D', 0]];
  SD.gradeOfCeil = c => (SD.GRADES.find(g => c >= g[1]) || SD.GRADES[SD.GRADES.length - 1])[0];
  SD.setCeil = (p, grade) => { const yrsLeft = Math.max(0, (p.el || 1) - 1); p.ceil = Math.round(clamp(p.ovr + yrsLeft * (2.2 + (grade - 85) * 0.18) + gauss() * 2.5, p.ovr, 99)); p.potG = SD.gradeOfCeil(p.ceil); };
  SD.starsOf = c => c >= 0.9834 ? 5 : c >= 0.89 ? 4 : c >= 0.797 ? 3 : 2;

  /* ---------- players ---------- */
  let nextId = 1;
  SD.nameOf = () => (SD.SP().he === 'she' ? pick(SD.FIRST_W) : pick(SD.FIRST_M)) + ' ' + pick(SD.LAST);
  SD.makePlayer = (pos, ovr, o) => {
    o = o || {};
    const g = G(), kind = SD.kind(), id = g.nextId = (g.nextId || 1) + 1;
    const town = o.home ? null : pick(SD.TOWNS);
    const at = fillAttrs(pos, ovr, kind);
    const p = { id, n: o.n || SD.nameOf(), pos, t: o.t == null ? null : o.t, yr: o.yr || 1, el: o.el == null ? 5 - (o.yr || 1) : o.el, num: o.num != null ? o.num : ri(0, 55),
      ht: o.ht || htFor(pos, kind), home: o.home || (town[0] + ', ' + town[1]), st: o.st || (town ? town[1] : 'TN'), at, tr: SD.makeTraits(), ovr: 0, rec: o.rec || null, nil: 0, s: null, car: {}, aw: [], log: [], inj: null, bt: o.bt || (kind === 'diamond' ? (chance(0.3) ? 'L' : 'R') + '/' + (chance(0.25) ? 'L' : 'R') : null) };
    if (o.at) Object.assign(p.at, o.at);
    SD.setOvr(p);
    SD.setCeil(p, o.grade || (p.rec && p.rec.g) || 82);
    g.P[id] = p;
    return p;
  };
  function htFor(pos, kind) {
    const w = SD.SP().he === 'she';
    if (kind === 'hoops') { const base = { PG: 74, SG: 76, SF: 78, PF: 80, C: 82 }[pos] - (w ? 5 : 0); return Math.round(base + gauss() * 1.6); }
    return Math.round((w ? 66 : 72) + gauss() * 2);
  }
  SD.htStr = h => h ? Math.floor(h / 12) + "'" + (h % 12) + '"' : '';
  const htIn = s => { const m = /(\d+)'\s*(\d+)/.exec(s || ''); return m ? +m[1] * 12 + +m[2] : null; };
  SD.YR = ['', 'Fr.', 'So.', 'Jr.', 'Sr.', '5th', '6th'];

  /* ---------- NIL ---------- */
  SD.nilValue = (p, t) => {
    const k = SD.kind(), base = k === 'hoops' ? (SD.SP().he === 'she' ? 60000 : 140000) : 25000;
    const v = base * Math.pow(1.13, (p.ovr - 70)) * (t && t.prestige ? 0.7 + t.prestige / 300 : 1) * (p.pos === 'SP' ? 1.6 : 1);
    return Math.round(clamp(v, 5000, k === 'hoops' ? 5e6 : 1.2e6) / 5000) * 5000;
  };
  SD.budgetFor = t => { const k = SD.kind(), w = SD.SP().he === 'she'; const b = (k === 'hoops' ? (w ? 2.2e6 : 8e6) : (w ? 0.8e6 : 2.5e6)) * Math.pow(1.035, t.prestige - 70); return Math.round(b / 50000) * 50000; };
  SD.payroll = t => t.roster.reduce((s, id) => s + (SD.P(id).nil || 0), 0);
  SD.money = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M' : '$' + Math.round(v / 1000) + 'K';

  /* ---------- the real Tennessee rosters ---------- */
  const CLS = { 'Fr.': 1, 'So.': 2, 'Jr.': 3, 'Sr.': 4, '5th': 5, '6th': 6, 'Gr.': 5 };
  const lastSeason = sport => { const C = root.SITE_AUTO && root.SITE_AUTO[sport] && root.SITE_AUTO[sport].career; if (!C) return null; const y = Object.keys(C).sort().pop(); return { y, d: C[y] }; };
  const num = v => +String(v == null ? 0 : v).replace(/[^\d.-]/g, '') || 0;
  function hoopsPos(rp, ht) {
    const p = (rp.pos || 'G').toUpperCase(), w = SD.SP().he === 'she', h = ht || 76;
    if (p.startsWith('C')) return 'C';
    if (p.startsWith('F') || p === 'F/C') return h >= (w ? 75 : 81) ? 'C' : h >= (w ? 72 : 79) ? 'PF' : 'SF';
    if (p === 'G/F') return 'SF';
    return h <= (w ? 68 : 74) ? 'PG' : 'SG';
  }
  // men's and women's hoops: 247 / ESPN ratings plus production last season (at Tennessee or elsewhere)
  function importHoops(team) {
    const sport = G().sport, S = root.SITE && root.SITE[sport], R = root.BB_RATINGS && root.BB_RATINGS[sport] ? root.BB_RATINGS[sport].players : {};
    const LS = lastSeason(sport), stats = {};
    if (LS) (LS.d.individualStats || []).forEach(r => { stats[r.name.replace(/’/g, "'")] = r.s; });
    const L = root.LINEUP && root.LINEUP[sport], starters = new Set();
    if (L) (L.chart['Starting five'] || []).forEach(([, list]) => starters.add(list[0]));
    const ids = [];
    (S ? S.roster : []).forEach(rp => {
      const ht = htIn(rp.ht), pos = hoopsPos(rp, ht), yr = CLS[rp.cls] || 2;
      const r = R[rp.name] || {}, rating = r.tr ? r.tr.rating : r.hs ? (r.hs.own || r.hs.grade || 85) : (yr === 1 ? 84 : 82);
      const st = stats[rp.name], ppgNote = /([\d.]+)\s*(career\s*)?ppg/.exec(rp.note || '');
      const ppg = st ? num(st.pointsPerGame) : ppgNote ? +ppgNote[1] : 0, mpg = st ? num(st.minutesPerGame) : ppg ? 26 : 0;
      let ovr = 59.5 + (rating - 80) * 1.15 + Math.min(7, ppg * 0.42) + Math.min(2, mpg / 14) + (yr - 1) * 0.8;
      if (starters.has(rp.name)) ovr = Math.max(ovr, 75);
      ovr = Math.round(clamp(ovr, 58, 92));
      const comp = r.hs && r.hs.comp ? r.hs.comp : r.hs && r.hs.grade ? clamp(0.8 + (r.hs.grade - 85) * 0.015, 0.8, 0.999) : 0.86;
      const p = SD.makePlayer(pos, ovr, { n: rp.name, t: team.id, yr, el: Math.max(1, (yr >= 5 ? 6 : 5) - yr), num: rp.num, ht: ht || undefined, home: rp.home, rec: { c: comp, stars: r.hs ? r.hs.stars || SD.starsOf(comp) : SD.starsOf(comp), g: comp * 100, natl: r.hs ? r.hs.natl : null, tr: r.tr || null } });
      p.real = true; p.prev = rp.prev || null; p.note = rp.note || null;
      // shooting split from real numbers when we have them
      if (st) {
        const tp = num(st.threePointFieldGoalPercentage), ft = num(st.freeThrowPercentage), tpa = num(st.threePointFieldGoalsAttempted), gp = num(st.gamesPlayed) || 1;
        if (tpa / gp >= 1.2 && tp) p.at.thr = Math.round(clamp(55 + (tp - 0.30) * 300, 50, 97));
        if (ft) p.at.ft = Math.round(clamp(50 + (ft - 0.6) * 140, 50, 97));
        const apg = num(st.assistsPerGame), rpg = num(st.reboundsPerGame), bpg = num(st.blocksPerGame), spg = num(st.stealsPerGame);
        if (apg) p.at.pas = Math.round(clamp(p.at.pas + (apg - 2) * 3, 50, 97));
        if (rpg) p.at.reb = Math.round(clamp(p.at.reb + (rpg - 4.5) * 2.5, 50, 97));
        if (bpg) p.at.blk = Math.round(clamp(p.at.blk + (bpg - 0.6) * 6, 50, 97));
        if (spg) p.at.stl = Math.round(clamp(p.at.stl + (spg - 0.9) * 6, 50, 97));
        p.realLast = { y: LS.y, ppg, rpg, apg, mpg, gp };
        // the season before, as his first line of career stats at Tennessee
        p.car[LS.y] = { t: 'TENN', real: true, gp, pts: Math.round(ppg * gp), reb: Math.round(rpg * gp), ast: Math.round(apg * gp), tpm: num(st.threePointFieldGoals), fgm: num(st.fieldGoals), fga: num(st.fieldGoalsAttempted), min: num(st.minutesPlayed) };
      }
      SD.setOvr(p); if (p.ovr > ovr + 2 || p.ovr < ovr - 2) { const d = ovr - p.ovr, w = SD.W[p.pos]; for (const k in w) p.at[k] = Math.round(clamp(p.at[k] + d, 50, 99)); SD.setOvr(p); } SD.setCeil(p, rating);
      ids.push(p.id);
    });
    return ids;
  }
  // baseball and softball: last season's hitting and pitching at Tennessee; newcomers from the roster notes
  function importDiamond(team) {
    const sport = G().sport, S = root.SITE && root.SITE[sport], LS = lastSeason(sport), hit = {}, pit = {};
    if (LS) { (LS.d['individualStats.individualHittingStats'] || []).forEach(r => { hit[r.name] = r.s; }); (LS.d['individualStats.individualPitchingStats'] || []).forEach(r => { pit[r.name] = r.s; }); }
    const L = root.LINEUP && root.LINEUP[sport], role = {};
    if (L) { (L.chart.Lineup || []).forEach(([spot, list]) => list.forEach((n, i) => { if (!role[n]) role[n] = { spot, start: i === 0 }; })); (L.chart['Pitching staff'] || L.chart.Circle || []).forEach(([spot, list]) => list.forEach((n, i) => { role[n] = { spot: /Ace|No\. 2|No\. 3/.test(spot) ? 'Friday' : spot === 'Depth' ? 'Setup' : spot, start: i === 0, pit: true }; })); }
    const soft = sport === 'softball', ids = [];
    (S ? S.roster : []).forEach(rp => {
      const yr = CLS[rp.cls] || 2, rl = role[rp.name] || {}, rawPos = (rp.pos || 'UTL').toUpperCase();
      const isP = rl.pit || /^(RHP|LHP|P)/.test(rawPos);
      let pos = isP ? (/Friday|Saturday|Sunday|Midweek/.test(rl.spot || '') ? 'SP' : rl.spot ? 'RP' : 'SP') : rl.spot && rl.spot !== 'DH' ? rl.spot : rawPos.startsWith('C') ? 'C' : rawPos.startsWith('OF') ? pick(['LF', 'CF', 'RF']) : rawPos.startsWith('INF') ? pick(['2B', 'SS', '3B', '1B']) : 'DH';
      if (rl.spot === 'DH' || rl.spot === 'DP') pos = 'DH';
      if (!SD.W[pos === 'C' ? 'C_' : pos]) pos = isP ? 'RP' : 'DH';
      const h = hit[rp.name], pt = pit[rp.name];
      let ovr = 72 + (yr - 1) * 1.6;
      const noteNum = /\.(\d{3})/.exec(rp.note || ''), noteHr = /(\d+)\s*HR/.exec(rp.note || '');
      if (!isP && h && num(h.atBats) >= 40) { const ops = num(h.ops), hr = num(h.homeRuns); ovr = 67 + (ops - 0.75) * 55 + Math.min(8, hr * 0.5) + Math.min(4, num(h.atBats) / 60); }
      else if (!isP && noteNum) ovr = 64 + (+('0.' + noteNum[1]) - 0.26) * 80 + (noteHr ? Math.min(6, +noteHr[1] * 0.4) : 0);
      if (isP && pt && num(pt.inningsPitched) >= 10) { const era = num(pt.earnedRunAverage), ip = num(pt.inningsPitched), k = num(pt.strikeouts); ovr = 76 + (soft ? (2.6 - era) * 4 : (5.2 - era) * 3) + Math.min(6, ip / 15) + Math.min(5, (k / Math.max(1, ip) * 9 - (soft ? 6 : 8)) * 1.2); }
      if (rl.start) ovr = Math.max(ovr, isP ? 81 : 79);
      if (/WCWS|All-|Freshman All|Golden Spikes/.test(rp.note || '')) ovr += 3;
      ovr = Math.round(clamp(ovr, 58, 92));
      const p = SD.makePlayer(pos, ovr, { n: rp.name, t: team.id, yr, el: Math.max(1, (yr >= 5 ? 6 : 5) - yr), num: rp.num, home: rp.home, bt: rp.bt || undefined, rec: { c: 0.9, stars: 3, g: 85 } });
      p.real = true; p.prev = rp.prev || null; p.note = rp.note || null;
      if (h && num(h.atBats)) { const ab = num(h.atBats); p.car[LS.y] = { t: 'TENN', real: true, gp: num(h.gamesPlayed), ab, h: num(h.hits), hr: num(h.homeRuns), rbi: num(h.runsBattedIn), bb: num(h.walks), so: num(h.strikeouts), sb: num(h.stolenBases), d2: num(h.doubles), d3: num(h.triples), r: num(h.runs) }; p.at.con = Math.round(clamp(p.at.con + (num(h.battingAverage) - 0.28) * 120, 50, 97)); p.at.pow = Math.round(clamp(p.at.pow + (num(h.homeRuns) / Math.max(30, ab) * 100 - 3) * 3, 50, 97)); }
      if (pt && num(pt.inningsPitched)) { const ip = num(pt.inningsPitched); p.car[LS.y] = Object.assign(p.car[LS.y] || { t: 'TENN', real: true }, { app: num(pt.appearances), gs: num(pt.gamesStarted), ipo: Math.round(Math.floor(ip) * 3 + (ip % 1) * 10), er: num(pt.earnedRunsAllowed), k: num(pt.strikeouts), bbp: num(pt.walksAllowed), w: num(pt.wins), l: num(pt.losses), sv: num(pt.saves) }); }
      SD.setOvr(p); SD.setCeil(p, 86 + (ovr - 75) * 0.4);
      ids.push(p.id);
    });
    return ids;
  }
  SD.importTennessee = team => SD.kind() === 'hoops' ? importHoops(team) : importDiamond(team);

  /* ---------- generated rosters ---------- */
  SD.genRoster = team => {
    const kind = SD.kind(), mu = 38 + team.prestige * 0.47, ids = [];
    const make = (pos, bump) => { const yr = ri(1, 4), ovr = Math.round(clamp(mu + (yr - 2.5) * 2.4 + (bump || 0) + gauss() * 5, 50, 93)); const g = clamp(78 + (team.prestige - 50) / 2.5 + gauss() * 5, 70, 99.9); const c = clamp(0.7 + (g - 70) * 0.01, 0.7, 0.9999); const p = SD.makePlayer(pos, ovr, { t: team.id, yr, el: 5 - yr, rec: { c, stars: SD.starsOf(c), g } }); ids.push(p.id); };
    if (kind === 'hoops') { ['PG', 'SG', 'SF', 'PF', 'C'].forEach(p => make(p, 4)); ['PG', 'SG', 'SF', 'PF', 'C', 'SG', 'SF', 'PF'].forEach(p => make(p, -2)); ['PG', 'C'].forEach(p => make(p, -8)); }
    else {
      ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH'].forEach(p => make(p, 3)); ['C', 'SS', '2B', 'LF', 'RF', '1B'].forEach(p => make(p, -4));
      ['SP', 'SP', 'SP'].forEach(p => make(p, 5)); ['SP', 'SP'].forEach(p => make(p, -1)); const nRp = G().sport === 'softball' ? 3 : 9; for (let i = 0; i < nRp; i++) make('RP', i < 3 ? 1 : -4);
      if (G().sport === 'baseball') ['C', '2B', 'CF', 'RP', 'RP', 'RP'].forEach(p => make(p, -9));
    }
    return ids;
  };
  // a guest opponent (a school outside the league on Tennessee's schedule): weak, generated, kept on file
  SD.guest = name => {
    const g = G(); g.guests = g.guests || {};
    const ex = Object.values(g.guests).find(t => t.name === name); if (ex) return ex;
    const id = 5000 + Object.keys(g.guests).length;
    const t = { id, name, abbr: SD.abbrOf(name), conf: 'IND', prestige: /Walters|Roane|Carson|Lee Univ|Northeast Alabama|Northwest Florida|College/.test(name) ? 30 : 44, c1: SD.hashColor(name), c2: '#FFFFFF', st: 'TN', guest: true, w: 0, l: 0, cw: 0, cl: 0 };
    g.guests[id] = t; t.roster = SD.genRoster(t); t.elo = 1200 + t.prestige * 4; return t;
  };

  /* ---------- the lineup: starters and rotation ---------- */
  SD.lineup = t => {
    const ps = t.roster.map(SD.P).filter(p => p && !(p.inj && p.inj.g > 0));
    if (SD.kind() === 'hoops') {
      if (t.rot && t.rot.length) { const keep = t.rot.map(SD.P).filter(p => p && ps.includes(p)); const rest = ps.filter(p => !keep.includes(p)).sort((a, b) => b.ovr - a.ovr); return keep.concat(rest); }
      // best five by position, then the bench by overall
      const five = [], used = new Set();
      ['PG', 'SG', 'SF', 'PF', 'C'].forEach(pos => { const c = ps.filter(p => !used.has(p) && p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0] || ps.filter(p => !used.has(p)).sort((a, b) => b.ovr - a.ovr)[0]; if (c) { five.push(c); used.add(c); } });
      // a much better bench player starts over a weak starter
      const bench = ps.filter(p => !used.has(p)).sort((a, b) => b.ovr - a.ovr);
      for (let i = 0; i < five.length; i++) { const b0 = bench[0]; if (b0 && b0.ovr >= five[i].ovr + 6) { bench.shift(); bench.push(five[i]); five[i] = b0; bench.sort((a, b) => b.ovr - a.ovr); } }
      return five.concat(bench);
    }
    return null;
  };
  // baseball / softball: the nine, the order, the rotation and the bullpen
  SD.diamondLineup = t => {
    const ps = t.roster.map(SD.P).filter(p => p && !(p.inj && p.inj.g > 0));
    const hit = ps.filter(p => !SD.isPit(p)), pit = ps.filter(p => SD.isPit(p));
    // short on position players: the worst pitchers hit
    if (hit.length < 9) pit.slice().sort((a, b) => a.ovr - b.ovr).slice(0, 9 - hit.length).forEach(p => hit.push(p));
    const D = t.dl || {};
    const field = {}, used = new Set();
    ['C', 'SS', 'CF', '2B', '3B', '1B', 'LF', 'RF'].forEach(pos => {
      const want = D.field && D.field[pos] ? SD.P(D.field[pos]) : null;
      let c = want && hit.includes(want) && !used.has(want) ? want : hit.filter(p => !used.has(p) && p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0];
      if (!c) c = hit.filter(p => !used.has(p) && p.pos !== 'C').sort((a, b) => SD.ovrAt(b, pos) - SD.ovrAt(a, pos))[0];
      if (c) { field[pos] = c; used.add(c); }
    });
    const dhW = D.field && D.field.DH ? SD.P(D.field.DH) : null;
    field.DH = dhW && hit.includes(dhW) && !used.has(dhW) ? dhW : hit.filter(p => !used.has(p)).sort((a, b) => (b.at.con + b.at.pow) - (a.at.con + a.at.pow))[0];
    if (field.DH) used.add(field.DH);
    // batting order: OBP guys up top, power in the middle
    const nine = Object.values(field).filter(Boolean);
    const score = p => p.at.con * 0.5 + p.at.eye * 0.3 + p.at.spd * 0.2, slug = p => p.at.pow * 0.6 + p.at.con * 0.4;
    let order = D.order && D.order.length === 9 && D.order.every(id => nine.some(p => p.id === id)) ? D.order.map(SD.P) : null;
    if (!order) {
      const by = nine.slice().sort((a, b) => slug(b) - slug(a)), heart = by.slice(0, 3), rest = nine.filter(p => !heart.includes(p)).sort((a, b) => score(b) - score(a));
      order = [rest[0], rest[1], heart[1], heart[0], heart[2], ...rest.slice(2)].filter(Boolean);
    }
    const sp = pit.filter(p => p.pos === 'SP').sort((a, b) => b.ovr - a.ovr), rp = pit.filter(p => p.pos === 'RP').sort((a, b) => b.ovr - a.ovr);
    const rotation = (D.rot && D.rot.length ? D.rot.map(SD.P).filter(p => pit.includes(p)) : []).concat(sp).filter((p, i, a) => a.indexOf(p) === i).slice(0, 5);
    const closer = D.closer && pit.includes(SD.P(D.closer)) ? SD.P(D.closer) : rp[0] || sp[4];
    const pen = pit.filter(p => !rotation.slice(0, 4).includes(p) && p !== closer).sort((a, b) => b.ovr - a.ovr);
    const bench = hit.filter(p => !used.has(p)).sort((a, b) => b.ovr - a.ovr);
    return { field, order, rotation, closer, pen, bench };
  };
  // playing out of position: a shortstop can play anywhere, a first baseman cannot
  SD.ovrAt = (p, pos) => {
    if (SD.isPit(p)) return 40;
    const fit = { C: { C: 0 }, SS: { SS: 0, '2B': -1, '3B': -2, CF: -4 }, '2B': { '2B': 0, SS: -5, '3B': -4 }, '3B': { '3B': 0, '1B': -2, SS: -6 }, CF: { CF: 0, LF: -1, RF: -1 }, LF: { LF: 0, RF: -2, '1B': -4 }, RF: { RF: 0, LF: -1, '1B': -4 }, '1B': { '1B': 0, LF: -6 }, DH: { DH: 0, '1B': -5 } };
    const f = (fit[p.pos] || {})[pos]; const w = SD.W[pos === 'C' ? 'C_' : pos]; let s = 0, t = 0; for (const k in w) { s += w[k] * (p.at[k] || 60); t += w[k]; }
    return Math.round(s / t + (f == null ? -10 : f));
  };

  /* ---------- team strength ---------- */
  SD.teamOvr = t => {
    if (SD.kind() === 'hoops') { const L = SD.lineup(t); const w = [1, 1, 1, 1, 1, 0.6, 0.45, 0.35, 0.2]; let s = 0, n = 0; L.slice(0, 9).forEach((p, i) => { s += p.ovr * w[i]; n += w[i]; }); return Math.round(s / n); }
    const D = SD.diamondLineup(t), soft = G().sport === 'softball', nr = soft ? 2 : 4, nb = soft ? 2 : 4; const av = (a, n) => a.length ? a.slice(0, n).reduce((s, p) => s + p.ovr, 0) / Math.min(n, a.length) : 60; const h = av(D.order, 9), r = av(D.rotation, nr), b = av(D.pen, nb);
    return { off: Math.round(h), rot: Math.round(r), pen: Math.round(b || 60), ovr: Math.round(h * 0.5 + r * (soft ? 0.42 : 0.35) + (b || 60) * (soft ? 0.08 : 0.15)) };
  };
  SD.teamRating = t => { const o = SD.teamOvr(t); return typeof o === 'number' ? o : o.ovr; };
})(typeof window !== 'undefined' ? window : globalThis);
