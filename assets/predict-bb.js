/* The Vol Index — game predictor for men's and women's basketball previews. The basketball twin of assets/predict.js.

     1. MODEL     Expected margin = Tennessee's level this season (last season's level, updated by every game played so far)
                  against the opponent's program strength and AP ranking, plus home court. Every number in it was fitted on
                  Tennessee's own games since 2000-01 (tools/calibrate_predictor_bb.py -> data/predict-cal-bb.js).
     2. SIMULATE  1,000 games, possession by possession: turnovers, twos and threes, fouls and free throws, offensive rebounds,
                  the clock, late fouling, overtime. Tennessee's side starts from its own four factors this season (pulled toward
                  the national average while the sample is small); shooting is tuned so the average score matches the model.
     3. REPORT    Win chance, most likely score, how the 1,000 games ended, what the winner usually did.
     4. WATCH     The simulated game closest to the middle of all 1,000, replayed on a court.

   Needs assets/predict.js (shared helpers and styles) and data/predict-cal-bb.js. No network calls. */
(function (root) {
  'use strict';
  const VP = root.VP, VPB = root.VPB = {};
  if (!VP) return;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), phi = VP.phi, rng = VP.rng, ease = VP.ease, pctl = VP.pctl;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CAL = k => (root.PREDICT_CAL_BB || {})[k];
  const UT = 'Tennessee';
  // national averages the simulation is anchored to
  const NAT = { mbb: { efg: 0.505, tov: 0.17, orb: 0.29, ftr: 0.33, r3: 0.39, p3: 0.34, ft: 0.72, pace: 68.5, periods: 2, len: 1200 },
    wbb: { efg: 0.455, tov: 0.19, orb: 0.31, ftr: 0.3, r3: 0.33, p3: 0.315, ft: 0.71, pace: 70, periods: 4, len: 600 } };
  const cleanOpp = o => { const m = /^#(\d+)(?:\/\d+)?\s+(.*)$/.exec(o || ''); return { name: (m ? m[2] : o || '').trim(), rank: m ? +m[1] : null }; };
  function teamInfo(key, name) {
    const C = root.PREDICT_CAL_BB || {}, n = (C.alias && C.alias[name]) || name, t = (C.teams || {})[n];
    const base = VP.teamOf(n);
    return { name, st: t ? t[key === 'wbb' ? 1 : 0] || null : null, col: (t && t[2]) || base.col, abbr: (t && t[3]) || base.abbr };
  }

  /* ---------- 1. the model ---------- */
  VPB.model = (D, g, adj) => {
    const key = D.key, cal = CAL(key); if (!cal) return null;
    if (!g.opp || /TBD|TBA|\/| or /i.test(g.opp)) return { pending: true };          // the opponent is not set yet (a bracket game)
    adj = adj || {};
    const rankOf = name => { const A = (root.SITE_AUTO || {})[key] || {}, top = (A.poll && A.poll.top) || (D.poll && D.poll.top) || []; const r = top.find(x => x[1] === name); return r ? r[0] : null; };
    const edge = (opp, site) => {         // what the opponent and the building are worth, in points, against an average Tennessee team
      const c = cleanOpp(opp), ti = teamInfo(key, c.name), rank = rankOf(c.name) || c.rank, st = ti.st || 42;
      return { v: -cal.b * (st - 60) - cal.c * (rank ? (26 - rank) / 25 : 0) + cal.hca * site, st, known: !!ti.st, rank, name: c.name, ti };
    };
    const siteOf = x => x.site === 'H' ? 1 : x.site === 'A' ? -1 : 0;
    // Tennessee's level: last season's, moved toward what this season's results say (each game counts; cal.k games count as much as the prior)
    const done = (D.schedule || []).filter(x => x.result && !x.exh && x.kind !== 'exh' && x.date < g.date && x.us != null && x.them != null);
    const resid = done.map(x => (+x.us - +x.them) - edge(x.opp, siteOf(x)).v);
    const est = resid.length ? resid.reduce((a, b) => a + b, 0) / resid.length : cal.lastLevel, w = resid.length / (resid.length + cal.k);
    const level = cal.lastLevel + (est - cal.lastLevel) * w;
    const e = edge(g.opp, siteOf(g)), site = siteOf(g);
    const factors = [
      { k: 'Tennessee this season', v: level, note: resid.length ? `Started from last season's level (${cal.lastLevel >= 0 ? '+' : ''}${cal.lastLevel}), moved by ${resid.length} game${resid.length === 1 ? '' : 's'} played (they say ${est >= 0 ? '+' : ''}${est.toFixed(1)}); early results count for ${Math.round(w * 100)}%` : `Last season's level (${cal.lastLevel}); no games played yet` },
      { k: `${e.name}'s program`, v: -cal.b * (e.st - 60), note: e.known ? `Program strength ${e.st} of 100 (60 is an average opponent on Tennessee's schedule)` : 'Not in the program table: treated as a low-major (42 of 100)' },
    ];
    if (e.rank) factors.push({ k: 'AP ranking', v: -cal.c * (26 - e.rank) / 25, note: `${e.name} is No. ${e.rank}` });
    factors.push({ k: site > 0 ? 'Home court' : site < 0 ? 'Road game' : 'Neutral court', v: cal.hca * site, note: site ? `${cal.hca} points: half the gap between Tennessee's home and away results against the same opponent in the same season (${cal.hcaPairs[1]} pairs)` : 'No home-court edge either way' });
    const hu = +adj.ut || 0, ho = +adj.opp || 0;
    if (hu || ho) factors.push({ k: 'Your what-if', v: hu - ho, note: `${hu ? 'Tennessee ' + hu : ''}${hu && ho ? ', ' : ''}${ho ? e.name + ' ' + ho : ''} points` });
    const margin = factors.reduce((s, f) => s + f.v, 0);
    const tots = done.map(x => +x.us + +x.them), tEst = tots.length ? tots.reduce((a, b) => a + b, 0) / tots.length : cal.avgTotal;
    const total = clamp(cal.avgTotal + (tEst - cal.avgTotal) * (tots.length / (tots.length + cal.k)), 105, 185);
    const m = clamp(margin, -total + 60, total - 60);
    return { key, cal, opp: e.name, oppInfo: e.ti, rank: e.rank, site, factors, margin, total, ptsU: (total + m) / 2, ptsO: (total - m) / 2, ratingWin: phi(margin / cal.sd), games: resid.length };
  };

  /* ---------- 2. the simulation ---------- */
  // Tennessee's four factors this season (offense and defense), pulled toward the national average: g games count against 10 of prior
  function profiles(D) {
    const key = D.key, N = NAT[key], src = key === 'mbb' ? root.SITE_CBBD : root.SITE_WBBBOX, tm = src && src.team, g = tm ? tm.games || 0 : 0, w = g / (g + 10);
    const sh = (v, nat, pct) => v == null ? nat : nat + ((pct ? v / 100 : v) - nat) * w;
    const us = (tm && tm.us) || {}, op = (tm && tm.opp) || {};
    const rows = ((D.statsAuto && D.statsAuto.tables && D.statsAuto.tables.individualStats) || []).map(r => r.s || {}), num = (s, k) => +s[k] || 0;
    const fga = rows.reduce((a, s) => a + num(s, 'fieldGoalsAttempted'), 0), tpa = rows.reduce((a, s) => a + num(s, 'threePointFieldGoalsAttempted'), 0);
    const mk = (o, r3) => ({ efg: sh(o.efg, N.efg, 1), tov: sh(o.tov, N.tov, 1), orb: sh(o.orb, N.orb, 1), ftr: sh(o.ftr, N.ftr, 1), p3: sh(o.tp, N.p3, 1), ft: sh(o.ft, N.ft, 1), r3, k: 1 });
    const ut = mk(us, fga >= 40 ? N.r3 + (tpa / fga - N.r3) * w : N.r3), opp = mk(op, N.r3);      // the opponent's offense = what Tennessee's defense allows
    const pace = tm && tm.pace ? N.pace + (tm.pace - N.pace) * w : N.pace;
    // who takes Tennessee's shots, grabs its rebounds and makes its passes: this season's shares
    const pl = rows.filter(s => num(s, 'minutesPlayed') > 0).map(s => ({ n: String(s.playerName || '').split(',')[0].trim(), two: Math.max(0.2, num(s, 'fieldGoalsAttempted') - num(s, 'threePointFieldGoalsAttempted')), three: num(s, 'threePointFieldGoalsAttempted'), ft: Math.max(0.2, num(s, 'freeThrowsAttempted')), reb: Math.max(0.3, num(s, 'rebounds')), ast: Math.max(0.2, num(s, 'assists')), stl: Math.max(0.2, num(s, 'steals')), min: num(s, 'minutesPlayed') })).sort((a, b) => b.min - a.min).slice(0, 9);
    return { t: [ut, opp], pace, players: pl, sample: g, N };
  }
  function simGame(P, seed, rec) {
    const R = rng(seed * 6151 + 29), N = P.N, gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };
    const st = { sc: [0, 0], per: 1, clk: N.len, o: R() < 0.5 ? 0 : 1, over: false, ot: 0 };
    const T = [0, 1].map(() => ({ fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, orb: 0, drb: 0, to: 0, poss: 0, q: [] }));
    const box = {}, pk = (k) => { const pl = P.players; if (!pl.length) return null; let tot = 0; for (const p of pl) tot += p[k]; let x = R() * tot; for (const p of pl) { x -= p[k]; if (x <= 0) return p.n; } return pl[0].n; };
    const cr = (n, k, v) => { if (!n) return; const b = box[n] || (box[n] = { pts: 0, reb: 0, ast: 0, tpm: 0 }); b[k] += v; };
    const secPer = (N.periods * N.len) / (2 * P.pace * (N.periods * N.len) / 2400);
    let first = null, lead0 = 0, changes = 0;
    const add = (i, n) => { st.sc[i] += n; const q = Math.min(N.periods, st.per) - 1 + (st.per > N.periods ? 1 : 0); T[i].q[q] = (T[i].q[q] || 0) + n; if (first == null) first = i; };
    const ftShot = (i, who) => { T[i].fta++; const ok = R() < P.t[i].ft; if (ok) { T[i].ftm++; add(i, 1); if (i === 0) cr(who, 'pts', 1); } return ok; };
    let guard = 0;
    while (!st.over && guard++ < 700) {
      const o = st.o, d = 1 - o, M = P.t[o], lead = st.sc[o] - st.sc[d], last = st.per >= N.periods, tn = i => i === 0 ? UT : P.oppName;
      let dur = clamp(secPer + gauss() * 4.5, 6, 29.5);
      if (last && st.clk < 120 && lead > 0) dur = Math.max(dur, 24 + R() * 5);
      if (last && st.clk < 90 && lead < 0) dur = Math.min(dur, 6 + R() * 6);
      if (st.clk < dur + 2) dur = Math.max(1, st.clk - R() * 2.5);
      const e = { o, per: st.per, clk: st.clk, dur, pts: 0, kind: 'miss', three: false, who: null, ast: null, by: null, orbs: 0, ft: null, text: '' };
      T[o].poss++;
      if (last && st.clk < 45 && lead >= 1 && lead <= 8) {
        // the trailing team fouls on purpose: two shots
        dur = Math.min(st.clk, 2 + R() * 3); e.dur = dur; e.kind = 'ft'; e.who = o === 0 ? pk('ft') : null;
        const a = ftShot(o, e.who), b = ftShot(o, e.who); e.ft = [a, b]; e.pts = (a ? 1 : 0) + (b ? 1 : 0);
        e.text = `${tn(d)} fouls on purpose. ${e.who || tn(o)} makes ${e.pts} of 2 at the line.`;
        if (!b && R() < M.orb * 0.5) { T[o].orb++; } else if (!b) T[d].drb++;
      } else if (R() < M.tov) {
        T[o].to++; e.kind = 'to'; const stl = R() < 0.55; e.by = stl && d === 0 ? pk('stl') : null; e.who = o === 0 ? pk('ast') : null; e.steal = stl;
        e.text = stl ? `${e.by || tn(d)} ${e.by ? 'steals it' : 'comes up with a steal'}${e.who ? ' from ' + e.who : ''}.` : `${e.who || tn(o)} turns it over.`;
      } else {
        for (let tries = 0; tries < 4; tries++) {
          const three = R() < clamp(M.r3 * (last && st.clk < 60 && lead <= -3 ? 1.8 : 1), 0.1, 0.92);
          const who = o === 0 ? pk(three ? 'three' : 'two') : null;
          const fouled = R() < M.ftr * (three ? 0.1 : 0.66);        // scaled so free-throw attempts per shot come out at the team's rate
          const p2 = clamp((M.efg - 1.5 * M.r3 * M.p3) / (1 - M.r3), 0.3, 0.68), p = clamp((three ? M.p3 : p2) * M.k, 0.08, 0.85);
          const made = R() < p * (fouled ? 0.55 : 1);
          e.three = three; e.who = who;
          if (!fouled || made) { T[o].fga++; if (three) T[o].tpa++; }
          if (made) {
            T[o].fgm++; if (three) T[o].tpm++; const v = three ? 3 : 2; add(o, v); e.pts = v; e.kind = 'make';
            if (o === 0) { cr(who, 'pts', v); if (three) cr(who, 'tpm', 1); if (R() < (three ? 0.8 : 0.5)) { let a = pk('ast'), n = 0; while (a === who && n++ < 4) a = pk('ast'); if (a !== who) { e.ast = a; cr(a, 'ast', 1); } } }
            if (fouled) { e.and1 = true; if (ftShot(o, who)) e.pts++; }
            const nm = who || tn(o);
            e.text = (e.orbs ? 'Second chance: ' : '') + (three ? `${nm} ${['hits a three', 'buries a three', 'knocks down the three'][Math.floor(R() * 3)]}` : `${nm} ${['scores inside', 'gets to the rim and scores', 'hits a jumper', 'lays it in'][Math.floor(R() * 4)]}`) + (e.ast ? ` (${e.ast} assist)` : '') + (e.and1 ? (e.pts > v ? ', plus the foul: three-point play' + (three ? '... make that four' : '') : ', fouled, misses the free throw') : '') + '.';
            break;
          }
          if (fouled) {
            const n = three ? 3 : 2; e.kind = 'ft'; e.ft = []; for (let i = 0; i < n; i++) e.ft.push(ftShot(o, who)); e.pts = e.ft.filter(Boolean).length;
            e.text = `${who || tn(o)} is fouled ${three ? 'on a three' : 'going up'}: ${e.pts} of ${n} at the line.`;
            if (!e.ft[n - 1] && R() < M.orb * 0.45) { T[o].orb++; } else if (!e.ft[n - 1]) T[d].drb++;
            break;
          }
          if (tries < 3 && R() < M.orb) { T[o].orb++; e.orbs++; if (o === 0) cr(pk('reb'), 'reb', 1); continue; }
          T[d].drb++; const rb = d === 0 ? pk('reb') : null; if (rb) cr(rb, 'reb', 1); e.by = rb; e.kind = 'miss';
          e.text = `${who || tn(o)} misses ${three ? 'a three' : 'inside'}${e.orbs ? ' after an offensive rebound' : ''}. ${rb || tn(d)} rebounds.`;
          break;
        }
      }
      const nl = st.sc[0] - st.sc[1]; if ((nl > 0 && lead0 < 0) || (nl < 0 && lead0 > 0)) { changes++; e.flip = true; } if (nl !== 0) lead0 = nl;
      st.clk -= e.dur; e.sc = st.sc.slice();
      if (rec) rec.push(e);
      st.o = d;
      if (st.clk <= 0.5) {
        if (st.per >= N.periods && st.sc[0] !== st.sc[1]) st.over = true;
        else { st.per++; st.clk = st.per > N.periods ? 300 : N.len; if (st.per > N.periods) st.ot++; e.endPer = true; }
      }
    }
    return { sc: st.sc, T, ot: st.ot, first, box, changes, seed };
  }
  function calibrate(P, m, N) {
    const want = [m.ptsU, m.ptsO]; let out = null;
    for (let it = 0; it < 10; it++) {
      const n = it < 4 ? 200 : N, games = []; let a = 0, b = 0;
      for (let i = 0; i < n; i++) { const r = simGame(P, 1000 + i); a += r.sc[0]; b += r.sc[1]; if (it >= 4) games.push(r); }
      a /= n; b /= n;
      if (it >= 4) { out = games; if ((Math.abs(a - want[0]) < 0.3 && Math.abs(b - want[1]) < 0.3) || it === 9) break; }
      P.t[0].k = clamp(P.t[0].k * Math.pow(want[0] / a, 0.85), 0.5, 1.7); P.t[1].k = clamp(P.t[1].k * Math.pow(want[1] / b, 0.85), 0.5, 1.7);
    }
    return out;
  }
  VPB.run = (D, g, adj, N) => {
    N = N || 1000;
    const m = VPB.model(D, g, adj); if (!m || m.pending) return m;
    const P = profiles(D); P.oppName = m.opp;
    const games = calibrate(P, m, N), sims = []; let w = 0, ot = 0, one = 0;
    const agg = [0, 1].map(() => ({ pts: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, orb: 0, drb: 0, to: 0, poss: 0 }));
    games.forEach(r => { const win = r.sc[0] > r.sc[1]; w += win; ot += r.ot ? 1 : 0; one += Math.abs(r.sc[0] - r.sc[1]) <= 5 ? 1 : 0;
      sims.push({ u: r.sc[0], o: r.sc[1], ot: r.ot, seed: r.seed, t3: r.T[0].tpm, toU: r.T[0].to, toO: r.T[1].to, rebU: r.T[0].orb + r.T[0].drb, rebO: r.T[1].orb + r.T[1].drb, first: r.first });
      [0, 1].forEach(t => { for (const k in agg[t]) agg[t][k] += k === 'pts' ? r.sc[t] : r.T[t][k]; }); });
    const mar = sims.map(s => s.u - s.o), mean = mar.reduce((a, b) => a + b, 0) / N, sd = Math.sqrt(mar.reduce((a, b) => a + (b - mean) * (b - mean), 0) / N);
    const med3 = pctl(sims.map(s => s.t3), 0.5), cond = { three: [0, 0], cold: [0, 0], to: [0, 0], toL: [0, 0], reb: [0, 0] };
    sims.forEach(s => { const win = s.u > s.o ? 1 : 0; if (s.t3 > med3) { cond.three[0] += win; cond.three[1]++; } if (s.t3 < med3) { cond.cold[0] += win; cond.cold[1]++; } if (s.toU < s.toO) { cond.to[0] += win; cond.to[1]++; } if (s.toU > s.toO) { cond.toL[0] += win; cond.toL[1]++; } if (s.rebU > s.rebO) { cond.reb[0] += win; cond.reb[1]++; } });
    const favU = w >= N / 2; let mu = pctl(sims.map(s => s.u), 0.5), mo = pctl(sims.map(s => s.o), 0.5); if ((mu > mo) !== favU || mu === mo) { if (favU) mu = mo + 1; else mo = mu + 1; }
    const near = (tu, to, wantU) => sims.slice().sort((a, b) => (Math.abs(a.u - tu) + Math.abs(a.o - to) + ((a.u > a.o) === wantU ? 0 : 80) + (a.ot ? 5 : 0)) - (Math.abs(b.u - tu) + Math.abs(b.o - to) + ((b.u > b.o) === wantU ? 0 : 80) + (b.ot ? 5 : 0)))[0];
    const upsets = sims.filter(s => (s.u > s.o) !== favU), up = upsets.length ? upsets.slice().sort((a, b) => Math.abs(Math.abs(a.u - a.o) - 4) - Math.abs(Math.abs(b.u - b.o) - 4))[0] : null;
    const wd = Math.abs(mean) > 15 ? 10 : 5, edges = [[-999, -3 * wd - 1], [-3 * wd, -2 * wd - 1], [-2 * wd, -wd - 1], [-wd, -1], [1, wd], [wd + 1, 2 * wd], [2 * wd + 1, 3 * wd], [3 * wd + 1, 999]];
    return { D, g, m, P, N, win: w / N, ot: ot / N, one: one / N, mean, sd, medU: mu, medO: mo, avg: agg.map(a => { const o = {}; for (const k in a) o[k] = a[k] / N; return o; }), cond, med3, sims, favU,
      hist: edges.map(([lo, hi]) => ({ lo, hi, n: mar.filter(x => x >= lo && x <= hi).length })), p10: pctl(mar, 0.1), p90: pctl(mar, 0.9),
      picks: { likely: near(mu, mo, favU), upset: up, best: sims.slice().sort((a, b) => (a.u - a.o) - (b.u - b.o))[Math.round(0.9 * (N - 1))] } };
  };
  VPB.game = (res, seed) => {
    const rec = [], r = simGame(res.P, seed, rec), N = res.P.N, full = N.periods * N.len;
    rec.forEach(e => { const left = e.per > N.periods ? 0.03 : clamp(((N.periods - e.per) * N.len + Math.max(0, e.clk - e.dur)) / full, 0, 1); e.wp = phi((e.sc[0] - e.sc[1] + res.m.margin * left) / (res.sd * Math.sqrt(left) + 0.8)); });
    return { rec, sc: r.sc, T: r.T, ot: r.ot, box: r.box };
  };

  /* ---------- 3. the report ---------- */
  const pc = x => Math.round(x * 100) + '%';
  function histSvg(res) {
    const W = 520, H = 190, pad = 6, top = 22, bot = 34, bw = (W - pad * 2) / res.hist.length, max = Math.max(1, ...res.hist.map(h => h.n)), o = res.m.oppInfo.abbr;
    const lab = h => h.lo < -900 ? `${o} ${-h.hi}+` : h.hi > 900 ? `UT ${h.lo}+` : h.hi < 0 ? `${o} ${-h.hi}-${-h.lo}` : `UT ${h.lo}-${h.hi}`;
    return `<svg class="vp-hist" viewBox="0 0 ${W} ${H}" role="img" aria-label="How ${res.N} simulated games ended, by margin">${res.hist.map((h, i) => {
      const bh = Math.max(2, (H - top - bot) * h.n / max), x = pad + i * bw + 3, y = H - bot - bh;
      return `<rect x="${x}" y="${y}" width="${bw - 6}" height="${bh}" rx="4" fill="${h.lo > 0 ? '#FF8200' : 'var(--vp-opp)'}"><title>${lab(h)}: ${h.n} of ${res.N} games</title></rect><text x="${x + (bw - 6) / 2}" y="${y - 5}" text-anchor="middle" font-weight="700">${h.n / res.N < 0.005 && h.n ? '<1' : Math.round(h.n / res.N * 100)}%</text><text class="ax" x="${x + (bw - 6) / 2}" y="${H - bot + 15}" text-anchor="middle">${lab(h)}</text>`;
    }).join('')}<line x1="${pad}" x2="${W - pad}" y1="${H - bot}" y2="${H - bot}" stroke="var(--line-strong)"/><text class="ax" x="${W / 2}" y="${H - 4}" text-anchor="middle">Winner and margin of victory</text></svg>`;
  }
  function report(res) {
    const m = res.m, o = m.opp, tO = m.oppInfo, a = res.avg, cal = m.cal, bt = cal.backtest, f = x => (x[1] >= 25 ? Math.round(x[0] / x[1] * 100) : null);
    const fav = res.mean >= 0 ? UT : o, sp = Math.abs(Math.round(res.mean * 2) / 2), cd = res.cond, keys = [];
    if (f(cd.three) != null && f(cd.cold) != null) keys.push(`<b>The three-point line.</b> Tennessee wins ${f(cd.three)}% of the simulated games where it makes more than ${res.med3} threes and ${f(cd.cold)}% where it makes fewer. Threes are the biggest swing in any single game.`);
    if (f(cd.to) != null && f(cd.toL) != null) keys.push(`<b>Turnovers.</b> ${f(cd.to)}% when Tennessee commits fewer than ${esc(o)}, ${f(cd.toL)}% when it commits more.`);
    if (f(cd.reb) != null) keys.push(`<b>The glass.</b> Tennessee wins ${f(cd.reb)}% of the games where it out-rebounds ${esc(o)}.`);
    const row = (l, x, y, d) => `<tr><td>${l}</td><td>${(+x).toFixed(d == null ? 0 : d)}</td><td>${(+y).toFixed(d == null ? 0 : d)}</td></tr>`, pcts = (t, n, d) => `${(a[t][n] / Math.max(1, a[t][d]) * 100).toFixed(1)}`;
    const side = v => v > 0 ? 'UT +' + v.toFixed(1) : v < 0 ? esc(tO.abbr) + ' +' + (-v).toFixed(1) : '0.0', band = v => v > 0 ? 'UT by ' + v : v < 0 ? tO.abbr + ' by ' + -v : 'even';
    return `<div class="vp-score"><div class="vp-team"><span>Tennessee</span><b>${res.medU}</b></div><div class="vp-mid">Most likely<br>final score</div><div class="vp-team r"><span>${esc(o)}</span><b>${res.medO}</b></div></div>
      <div class="vp-bar" role="img" aria-label="Tennessee wins ${pc(res.win)} of simulations"><i style="flex:${Math.max(0.14, res.win)}">Tennessee ${res.win > 0.995 ? '>99%' : pc(res.win)}</i><i style="flex:${Math.max(0.14, 1 - res.win)}">${esc(tO.abbr)} ${res.win > 0.995 ? '<1%' : pc(1 - res.win)}</i></div>
      <div class="vp-chips"><span>Spread: <b>${sp === 0 ? 'Pick’em' : esc(fav) + ' by ' + sp}</b></span><span>Total: <b>${Math.round((a[0].pts + a[1].pts) * 2) / 2}</b></span><span>Within 5 points: <b>${pc(res.one)}</b></span><span>Overtime: <b>${pc(res.ot)}</b></span><span>Middle 80% of results: <b>${esc(band(res.p10))} to ${esc(band(res.p90))}</b></span></div>
      <div class="vp-watch"><button class="vp-btn pri" data-vpw="likely">▶ Watch the most likely game</button>${res.picks.upset ? `<button class="vp-btn" data-vpw="upset">Watch ${esc(res.favU ? o : 'Tennessee')} pull the upset</button>` : ''}<button class="vp-btn" data-vpw="best">Watch Tennessee's best night</button></div>
      <div id="vpStage"></div>
      <div class="vp-two"><div><h4>${res.N.toLocaleString()} simulated games: how they ended</h4>${histSvg(res)}</div>
      <div><h4>What goes into the number</h4><table class="vp-fac"><tbody>${m.factors.map(x => `<tr><td>${esc(x.k)}<small>${esc(x.note)}</small></td><td class="n">${side(x.v)}</td></tr>`).join('')}
        <tr class="tot"><td>Expected margin<small>Expected total ${m.total.toFixed(1)}, from Tennessee's games since 2018-19 and this season's so far</small></td><td class="n">${side(m.margin)}</td></tr></tbody></table>
        <div class="vp-what"><label>What if Tennessee is <select data-vpadj="ut"><option value="0">at full strength</option><option value="-2">missing a starter (−2)</option><option value="-4">missing two starters (−4)</option><option value="-6">without its best player (−6)</option></select></label><label>and ${esc(o)} is <select data-vpadj="opp"><option value="0">at full strength</option><option value="-2">missing a starter (−2)</option><option value="-4">missing two starters (−4)</option><option value="-6">without its best player (−6)</option></select></label></div></div></div>
      ${keys.length ? `<h4>What decides it</h4><ul class="vp-keys">${keys.map(k => `<li>${k}</li>`).join('')}</ul>` : ''}
      <h4>Projected team numbers <span class="vp-note">(average of ${res.N.toLocaleString()} games)</span></h4>
      <div class="tablewrap"><table class="vp-box"><thead><tr><th></th><th>Tennessee</th><th>${esc(o)}</th></tr></thead><tbody>${row('Points', a[0].pts, a[1].pts, 1)}${row('Field goal %', pcts(0, 'fgm', 'fga'), pcts(1, 'fgm', 'fga'), 1)}${row('Threes made', a[0].tpm, a[1].tpm, 1)}${row('Three-point %', pcts(0, 'tpm', 'tpa'), pcts(1, 'tpm', 'tpa'), 1)}${row('Free throws made-attempted', 0, 0).replace(/<td>0<\/td><td>0<\/td>/, `<td>${a[0].ftm.toFixed(1)}-${a[0].fta.toFixed(1)}</td><td>${a[1].ftm.toFixed(1)}-${a[1].fta.toFixed(1)}</td>`)}${row('Rebounds', a[0].orb + a[0].drb, a[1].orb + a[1].drb, 1)}${row('Turnovers', a[0].to, a[1].to, 1)}${row('Possessions', a[0].poss, a[1].poss, 1)}</tbody></table></div>
      <details style="margin-top:14px"><summary><b>How this works, and how good it is</b></summary>
        <p>The expected margin has four parts: how good Tennessee has been (last season's level, moved by each game this season), how strong the opponent's program is, whether the opponent is ranked, and home court. The weights were fitted on ${esc(cal.fitted)}. Real games land within about ${Math.round(cal.sd)} points of that expected margin two times in three, so the simulation is given the same spread.</p>
        <p><b>What it does not know.</b> The site has no opponent-adjusted efficiency ratings for every opponent, so ${esc(o)} is measured by program strength and the AP poll, not by how this year's ${esc(o)} team has played. Expect it to be slow to notice a program having an unusually good or bad year. Tennessee's own four factors come from ${res.P.sample} game${res.P.sample === 1 ? '' : 's'}, so they are pulled most of the way to the national average.</p>
        ${bt ? `<p><b>Backtest.</b> Fitted on ${esc(bt.train)}, then asked to call ${esc(bt.test)} one at a time, using only games played before each one: it picked the winner ${bt.accuracy}% of the time, missed the margin by ${bt.mae} points on average, Brier score ${bt.brier} (0.25 is a coin flip; lower is better).</p>
        <div class="tablewrap"><table class="vp-box"><thead><tr><th>Favorite's win chance</th><th>Games</th><th>Predicted</th><th>Actually won</th></tr></thead><tbody>${bt.calibration.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}%</td><td>${r[3]}%</td></tr>`).join('')}</tbody></table></div>` : ''}
        <p class="vp-note">A simulation is an estimate, not a pick. Injuries are not in the data unless you set them with the what-if menus.</p></details>`;
  }

  /* ---------- 4. the court ---------- */
  function player(host, res, G, label) {
    const tU = VP.teamOf(UT), tO = res.m.oppInfo, ev = G.rec, N = res.P.N, men = N.periods === 2;
    host.innerHTML = `<div class="vp-stage"><div class="vp-bug"><div class="t" id="vpTu"><i style="background:${tU.col}"></i><span>TENN</span><b id="vpSu">0</b><em></em></div><div class="c"><span id="vpQ">${men ? '1st half' : 'Q1'} ${men ? '20:00' : '10:00'}</span><small>${esc(label)}</small></div><div class="t r" id="vpTo"><i style="background:${tO.col}"></i><span>${esc(tO.abbr)}</span><b id="vpSo">0</b><em></em></div></div>
      <div class="vp-dd"><span id="vpDd">Tip-off</span><span id="vpWpT">Tennessee win chance ${pc(res.win)}</span></div>
      <canvas class="vp-cv" id="vpCv" aria-label="Animated court showing the simulated game"></canvas><div class="vp-call" id="vpCall" aria-live="polite">Press play to watch.</div><canvas class="vp-wp" id="vpWp" aria-label="Tennessee win probability through the game"></canvas>
      <div class="vp-ctl"><button class="vp-btn pri" data-vpc="play">▶ Play</button><button class="vp-btn" data-vpc="mode" aria-pressed="true" title="Big plays in full, the rest in fast forward">Highlights</button><button class="vp-btn" data-vpc="speed">Speed 1×</button><button class="vp-btn" data-vpc="period">Next ${men ? 'half' : 'quarter'} ⏭</button><span class="sp"></span><button class="vp-btn" data-vpc="end">Skip to final</button></div>
      <div class="vp-log" id="vpLog" tabindex="0" aria-label="Play-by-play"></div></div><div id="vpFinal"></div>`;
    const $ = s => host.querySelector(s), cv = $('#vpCv'), c = cv.getContext('2d'), wpc = $('#vpWp'), wc = wpc.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    const size = () => { dpr = Math.min(2, root.devicePixelRatio || 1); W = cv.clientWidth || 600; H = Math.round(W * 50 / 94); cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; wpc.width = (wpc.clientWidth || W) * dpr; wpc.height = 64 * dpr; };
    size();
    const X = ft => ft / 94 * W, Y = ft => ft / 50 * H;
    // spots on the floor, measured from the baseline being attacked: point, two wings, a corner, the post
    const SPOT = [[26, 25], [20, 7], [20, 43], [4.5, 3.5], [7, 31]], FTL = [19, 25];
    const toXY = (o, d, y) => [o === 0 ? 94 - d : d, o === 0 ? y : 50 - y], rimOf = o => [o === 0 ? 88.75 : 5.25, 25];
    const dots = [0, 1].map(t => Array.from({ length: 5 }, (_, i) => ({ p: [47 + (t ? 3 : -3), 12 + i * 6.5], g: [47, 25] })));
    const ball = { p: [47, 25], z: 0, hold: null, fl: null };
    const S = { i: -1, t: 0, e: null, playing: false, speed: 1, hi: true, raf: null, last: 0, done: false, sc: [0, 0], until: null, quick: false, T: 0, steps: null, flash: null, ft: 0, curDone: true };
    function setFormation(o, e) {
      const d = 1 - o, rim = rimOf(o);
      SPOT.forEach((s, i) => { const jit = (i * 37 + S.i * 13) % 7 / 7 - 0.5; dots[o][i].g = toXY(o, s[0] + jit * 1.6, s[1] + jit * 2); });
      dots[o].forEach((p, i) => { dots[d][i].g = [p.g[0] + (rim[0] - p.g[0]) * 0.24, p.g[1] + (rim[1] - p.g[1]) * 0.2]; });
    }
    // the script for one possession: a list of [time, action]
    function script(e) {
      const o = e.o, d = 1 - o, rim = rimOf(o), st = [], sh = e.three ? [1, 2, 3, 0][(S.i * 7) % 4] : [4, 0, 1][(S.i * 5) % 3], p1 = [1, 2, 0].find(x => x !== sh);
      st.push([0, () => { setFormation(o, e); ball.hold = [o, 0]; ball.fl = null; }]);
      if (e.kind === 'to') { st.push([0.9, () => { const k = (S.i * 3) % 5; dots[d][k].g = dots[o][0].p.slice(); if (e.steal) ball.hold = [d, k]; else { ball.hold = null; ball.fl = { a: ball.p.slice(), b: [ball.p[0], dots[o][0].p[1] < 25 ? -2 : 52], t0: S.t, dur: 0.4, arc: 0 }; } }]); return { st, T: 1.6 }; }
      if (e.kind === 'ft') {
        st.push([0.2, () => { dots[o][sh].g = toXY(o, FTL[0], FTL[1]); ball.hold = [o, sh]; [0, 1, 2, 3, 4].filter(i => i !== sh).forEach((i, k) => { dots[o][i].g = toXY(o, k < 2 ? 9 + k * 4 : 30, k < 2 ? 17 : 12 + k * 9); dots[d][i].g = toXY(o, k < 2 ? 7 + k * 4 : 28, k < 2 ? 33 : 14 + k * 9); }); dots[d][sh].g = toXY(o, 5, 33); }]);
        (e.ft || []).forEach((ok, k) => { st.push([1.1 + k * 0.75, () => { ball.hold = null; ball.fl = { a: dots[o][sh].p.slice(), b: rim, t0: S.t, dur: 0.5, arc: 7 }; }]); st.push([1.6 + k * 0.75, () => { S.flash = ok ? { p: rim, t: S.t, good: true } : null; ball.fl = null; ball.hold = [o, sh]; }]); });
        return { st, T: 1.4 + (e.ft || []).length * 0.75 };
      }
      st.push([0.75, () => { ball.hold = null; ball.fl = { a: dots[o][0].p.slice(), b: dots[o][p1].g.slice(), t0: S.t, dur: 0.24, arc: 1.2, to: [o, p1] }; }]);
      const spot = e.three ? dots[o][sh].g : toXY(o, 4 + ((S.i * 11) % 5), 25 + (((S.i * 17) % 9) - 4));
      st.push([1.2, () => { if (!e.three) { dots[o][sh].g = spot; dots[d][sh].g = [spot[0] + (rim[0] - spot[0]) * 0.4, spot[1] + 1]; } if (sh !== p1) { ball.hold = null; ball.fl = { a: dots[o][p1].p.slice(), b: e.three ? spot : dots[o][sh].p.slice(), t0: S.t, dur: 0.26, arc: 1.2, to: [o, sh] }; } }]);
      st.push([1.85, () => { ball.hold = null; ball.fl = { a: dots[o][sh].p.slice(), b: rim, t0: S.t, dur: e.three ? 0.62 : 0.34, arc: e.three ? 10 : 4 }; }]);
      const tR = 1.85 + (e.three ? 0.62 : 0.34);
      if (e.kind === 'make') st.push([tR, () => { S.flash = { p: rim, t: S.t, good: true, three: e.three }; ball.fl = { a: rim, b: [rim[0], rim[1] + 0.01], t0: S.t, dur: 0.3, arc: 0 }; }]);
      else st.push([tR, () => { const k = 4, at = [rim[0] + (o === 0 ? -5 : 5), 25 + (((S.i * 7) % 11) - 5)]; dots[d][k].g = at; ball.fl = { a: rim, b: at, t0: S.t, dur: 0.35, arc: 3, to: [d, k] }; }]);
      return { st, T: tR + (e.kind === 'make' ? 0.55 : 0.6) };
    }
    function court() {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#D8A869' : '#DDB077'; c.fillRect(0, H * i / 12, W, H / 12 + 1); }
      c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = Math.max(1.2, W / 500);
      c.strokeRect(1, 1, W - 2, H - 2); c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke(); c.beginPath(); c.arc(W / 2, H / 2, X(6), 0, 6.2832); c.stroke();
      [0, 1].forEach(sd => { const dir = sd ? -1 : 1, bx = sd ? 94 : 0, rx = sd ? 88.75 : 5.25;
        c.fillStyle = sd ? 'rgba(255,130,0,.30)' : 'rgba(0,0,0,.10)'; c.fillRect(Math.min(X(bx), X(bx + dir * 19)), Y(19), X(19), Y(12)); c.strokeRect(Math.min(X(bx), X(bx + dir * 19)), Y(19), X(19), Y(12));
        c.beginPath(); c.arc(X(bx + dir * 19), Y(25), X(6), sd ? Math.PI / 2 : -Math.PI / 2, sd ? 1.5 * Math.PI : Math.PI / 2); c.stroke();
        const a = Math.asin(22 / 22.15 * 0.999); c.beginPath(); c.moveTo(X(bx), Y(3)); c.lineTo(X(rx + dir * 22.15 * Math.cos(a)), Y(3)); c.arc(X(rx), Y(25), X(22.15), sd ? Math.PI + a : -a, sd ? Math.PI - a : a, !!sd); c.lineTo(X(bx), Y(47)); c.stroke();
        c.strokeStyle = '#E8590C'; c.beginPath(); c.arc(X(rx), Y(25), X(0.9), 0, 6.2832); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.moveTo(X(bx + dir * 4), Y(22)); c.lineTo(X(bx + dir * 4), Y(28)); c.stroke(); });
      c.fillStyle = 'rgba(0,0,0,.14)'; c.font = `800 ${Math.max(12, H * 0.07)}px Archivo, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('VOL INDEX', W / 2, H * 0.5);
    }
    function draw() {
      court();
      const r = Math.max(4.5, W / 78), e = S.e;
      [1, 0].forEach(t => dots[t].forEach(d => { c.beginPath(); c.arc(X(d.p[0]), Y(d.p[1]), r, 0, 6.2832); c.fillStyle = t === 0 ? tU.col : tO.col; c.fill(); c.lineWidth = Math.max(1.4, r * 0.28); c.strokeStyle = '#fff'; c.stroke(); }));
      let bp = ball.p, z = 0;
      if (ball.fl) { const k = clamp((S.t - ball.fl.t0) / ball.fl.dur, 0, 1); bp = [ball.fl.a[0] + (ball.fl.b[0] - ball.fl.a[0]) * k, ball.fl.a[1] + (ball.fl.b[1] - ball.fl.a[1]) * k]; z = Math.sin(k * Math.PI) * ball.fl.arc; if (k >= 1 && ball.fl.to) { ball.hold = ball.fl.to; ball.fl = null; } }
      else if (ball.hold) { const d = dots[ball.hold[0]][ball.hold[1]]; bp = [d.p[0] + (ball.hold[0] === 0 ? 1 : -1), d.p[1] + 0.8]; }
      ball.p = bp;
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(X(bp[0]), Y(bp[1]) + 2, r * 0.55, r * 0.3, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#E8590C'; c.strokeStyle = '#3a1c05'; c.lineWidth = 1; c.beginPath(); c.arc(X(bp[0]), Y(bp[1]) - z * (H / 50) * 0.5, r * (0.55 + z * 0.03), 0, 6.2832); c.fill(); c.stroke();
      if (e && e.who && ball.hold && ball.hold[0] === 0 && W >= 420 && !S.quick) { const d = dots[0][ball.hold[1]]; c.font = `700 ${Math.max(10, W / 80)}px Archivo, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(e.who, X(d.p[0]), Y(d.p[1]) - r * 1.5); c.fillStyle = '#fff'; c.fillText(e.who, X(d.p[0]), Y(d.p[1]) - r * 1.5); }
      if (S.flash && S.t - S.flash.t < 0.6) { const k = (S.t - S.flash.t) / 0.6; c.strokeStyle = `rgba(255,255,255,${1 - k})`; c.lineWidth = 3; c.beginPath(); c.arc(X(S.flash.p[0]), Y(S.flash.p[1]), X(1.5 + k * (S.flash.three ? 7 : 4)), 0, 6.2832); c.stroke(); }
    }
    function wpDraw() {
      const w = wpc.width / dpr, h = 64, full = N.periods * N.len; wc.setTransform(dpr, 0, 0, dpr, 0, 0); wc.fillStyle = '#161616'; wc.fillRect(0, 0, w, h);
      wc.strokeStyle = '#444'; wc.lineWidth = 1; wc.setLineDash([3, 3]); wc.beginPath(); wc.moveTo(0, h / 2); wc.lineTo(w, h / 2); wc.stroke(); wc.setLineDash([]);
      for (let q = 1; q < N.periods; q++) { wc.strokeStyle = '#333'; wc.beginPath(); wc.moveTo(w * q / N.periods, 0); wc.lineTo(w * q / N.periods, h); wc.stroke(); }
      wc.fillStyle = '#8a8a8a'; wc.font = '10px system-ui, sans-serif'; wc.textBaseline = 'top'; wc.fillText('TENN 100%', 4, 2); wc.textBaseline = 'bottom'; wc.fillText(tO.abbr + ' 100%', 4, h - 2);
      const tx = e => clamp(e.per > N.periods ? 1 : ((e.per - 1) * N.len + (N.len - Math.max(0, e.clk - e.dur))) / full, 0, 1) * w;
      wc.strokeStyle = '#FF8200'; wc.lineWidth = 2; wc.beginPath(); wc.moveTo(0, h - res.win * h);
      for (let i = 0; i <= S.i && i < ev.length; i++) if (i < S.i || S.curDone) wc.lineTo(tx(ev[i]), h - ev[i].wp * h);
      wc.stroke();
    }
    const clk = s => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
    const perName = p => p > N.periods ? 'OT' + (p - N.periods > 1 ? p - N.periods : '') : men ? (p === 1 ? '1st half' : '2nd half') : 'Q' + p;
    function hud(e, after) {
      $('#vpQ').firstChild.nodeValue = perName(e.per) + ' ' + clk(after ? e.clk - e.dur : e.clk);
      $('#vpSu').textContent = S.sc[0]; $('#vpSo').textContent = S.sc[1];
      $('#vpTu').classList.toggle('has', e.o === 0); $('#vpTo').classList.toggle('has', e.o === 1);
      $('#vpDd').textContent = `${e.o === 0 ? 'Tennessee' : tO.name} ball`;
      if (after) $('#vpWpT').textContent = `Tennessee win chance ${e.wp > 0.995 ? '>99%' : e.wp < 0.005 ? '<1%' : pc(e.wp)}`;
    }
    const isKey = e => (e.kind === 'make' && e.three) || e.and1 || e.flip || e.per > N.periods || (e.per === N.periods && e.clk < 150 && Math.abs(e.sc[0] - e.sc[1]) <= 7) || (e.kind === 'to' && e.steal && e.by);
    function logLine(e) {
      if (!e.pts && e.kind !== 'to' && !isKey(e) && S.hi && S.until == null) { /* still logged */ }
      const el = document.createElement('div'); if (e.pts && isKey(e)) el.className = 'k';
      el.innerHTML = `<span>${perName(e.per).replace(/(\d)\w\w half/, '$1H')} ${clk(e.clk - e.dur)} ${e.o === 0 ? 'TENN' : esc(tO.abbr)}</span><p>${esc(e.text)}${e.pts ? ` <b>${e.sc[0]}-${e.sc[1]}</b>` : ''}</p>`;
      const lg = $('#vpLog'); lg.insertBefore(el, lg.firstChild); while (lg.children.length > 220) lg.removeChild(lg.lastChild);
    }
    function begin(i) {
      S.i = i; const e = ev[i]; S.e = e; S.t = 0; S.curDone = false; S.flash = null; hud(e, false);
      S.quick = S.until != null || (S.hi && !isKey(e));
      if (S.quick) { setFormation(e.o, e); ball.hold = [e.o, 0]; ball.fl = null; S.steps = []; S.T = S.until != null ? 0 : 0.22; }
      else { const sc = script(e); S.steps = sc.st.slice(); S.T = sc.T; $('#vpCall').innerHTML = `<b>${e.o === 0 ? 'Tennessee' : esc(tO.name)}</b> has the ball`; }
    }
    function finish() {
      const e = S.e; if (!e || S.curDone) return; S.curDone = true; S.sc = e.sc.slice(); hud(e, true); logLine(e);
      if (!S.quick || e.pts) $('#vpCall').textContent = e.text + (e.pts ? ` ${e.sc[0]}-${e.sc[1]}.` : '');
      if (S.until === 'period' && e.endPer) S.until = null;
    }
    function end() {
      S.playing = false; S.done = true; S.until = null; $('[data-vpc="play"]').textContent = '↺ Watch again';
      const T = G.T, won = G.sc[0] > G.sc[1], nq = Math.max(T[0].q.length, T[1].q.length), sh = (t, m, a) => `${T[t][m]}-${T[t][a]}`, row = (l, a, b) => `<tr><td>${l}</td><td>${a}</td><td>${b}</td></tr>`;
      const top = Object.entries(G.box).sort((a, b) => b[1].pts - a[1].pts).slice(0, 5);
      $('#vpCall').innerHTML = `<b>Final${G.ot ? ' (' + (G.ot > 1 ? G.ot + 'OT' : 'OT') + ')' : ''}:</b> Tennessee ${G.sc[0]}, ${esc(tO.name)} ${G.sc[1]}. ${won ? (res.D.key === 'wbb' ? 'Lady Vols' : 'Vols') + ' win.' : esc(tO.name) + ' wins.'}`;
      host.querySelector('#vpFinal').innerHTML = `<h4>This game's box score</h4><div class="tablewrap"><table class="vp-box"><thead><tr><th></th>${Array.from({ length: nq }, (_, i) => `<th>${i < N.periods ? (men ? (i + 1) + 'H' : 'Q' + (i + 1)) : 'OT'}</th>`).join('')}<th>T</th></tr></thead><tbody>${[0, 1].map(i => `<tr><td><b>${i === 0 ? 'Tennessee' : esc(tO.name)}</b></td>${Array.from({ length: nq }, (_, k) => `<td>${T[i].q[k] || 0}</td>`).join('')}<td><b>${G.sc[i]}</b></td></tr>`).join('')}</tbody></table></div>
        <div class="tablewrap"><table class="vp-box"><thead><tr><th></th><th>Tennessee</th><th>${esc(tO.name)}</th></tr></thead><tbody>${row('Field goals', sh(0, 'fgm', 'fga'), sh(1, 'fgm', 'fga'))}${row('Threes', sh(0, 'tpm', 'tpa'), sh(1, 'tpm', 'tpa'))}${row('Free throws', sh(0, 'ftm', 'fta'), sh(1, 'ftm', 'fta'))}${row('Rebounds (offensive)', `${T[0].orb + T[0].drb} (${T[0].orb})`, `${T[1].orb + T[1].drb} (${T[1].orb})`)}${row('Turnovers', T[0].to, T[1].to)}</tbody></table></div>
        ${top.length ? `<p class="small"><b>Tennessee:</b> ${top.map(([n, b]) => `${esc(n)} ${b.pts} pts${b.reb ? ', ' + b.reb + ' reb' : ''}${b.ast ? ', ' + b.ast + ' ast' : ''}`).join(' · ')}</p>` : ''}
        <p class="vp-note">One simulated game out of ${res.N.toLocaleString()}. Player lines are simulated from this season's shot, rebound and assist shares, not predictions for individuals. ${esc(tO.name)} has no player data on the site, so its plays are described by team.</p>`;
      draw(); wpDraw();
    }
    function frame(ts) {
      S.raf = null; if (!S.playing) return;
      const dt = Math.min(0.1, (ts - S.last) / 1000) * S.speed; S.last = ts;
      if (S.until != null) { if (S.e && !S.curDone) finish(); let n = 0; while (S.until != null && n++ < 900) { if (S.i + 1 >= ev.length) return end(); begin(S.i + 1); finish(); } dots.forEach(t => t.forEach(d => { d.p = d.g.slice(); })); draw(); wpDraw(); S.raf = requestAnimationFrame(frame); return; }
      if (S.i < 0 || (S.curDone && S.t >= S.T + (S.quick ? 0 : 0.35))) { if (S.i + 1 >= ev.length) return end(); begin(S.i + 1); }
      S.t += dt;
      while (S.steps && S.steps.length && S.steps[0][0] <= S.t) S.steps.shift()[1]();
      const k = Math.min(1, dt * (S.quick ? 9 : 5.5)); dots.forEach(t => t.forEach(d => { d.p[0] += (d.g[0] - d.p[0]) * k; d.p[1] += (d.g[1] - d.p[1]) * k; }));
      if (S.t >= S.T && !S.curDone) { finish(); wpDraw(); }
      draw(); S.raf = requestAnimationFrame(frame);
    }
    function reset() { S.i = -1; S.sc = [0, 0]; S.done = false; S.e = null; S.curDone = true; S.until = null; $('#vpLog').innerHTML = ''; host.querySelector('#vpFinal').innerHTML = ''; $('#vpSu').textContent = 0; $('#vpSo').textContent = 0; }
    function go() { if (S.done) reset(); S.playing = true; S.last = performance.now(); $('[data-vpc="play"]').textContent = '❚❚ Pause'; if (!S.raf) S.raf = requestAnimationFrame(frame); }
    host.querySelector('.vp-ctl').addEventListener('click', x => {
      const b = x.target.closest('[data-vpc]'); if (!b) return; const k = b.dataset.vpc;
      if (k === 'play') { if (S.playing) { S.playing = false; b.textContent = '▶ Play'; } else go(); }
      if (k === 'mode') { S.hi = !S.hi; b.setAttribute('aria-pressed', S.hi); b.textContent = S.hi ? 'Highlights' : 'Every possession'; }
      if (k === 'speed') { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; b.textContent = `Speed ${S.speed}×`; }
      if (k === 'period') { S.until = 'period'; go(); }
      if (k === 'end') { S.until = 'end'; go(); }
    });
    const onR = () => { if (!document.body.contains(cv)) { root.removeEventListener('resize', onR); S.playing = false; return; } size(); draw(); wpDraw(); };
    root.addEventListener('resize', onR);
    draw(); wpDraw();
    VP._player = { stop: () => { S.playing = false; }, state: S, go };
    if (!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) go();
  }

  VPB.mount = (el, D, g) => {
    VP.css(); const adj = { ut: 0, opp: 0 };
    const render = () => {
      if (VP._player) VP._player.stop();
      const res = VPB.run(D, g, adj);
      if (!res) { el.innerHTML = '<p class="dim small">The prediction data did not load.</p>'; return; }
      if (res.pending) { el.innerHTML = '<p class="dim small">The opponent for this game is not set yet. The prediction appears once the bracket is.</p>'; return; }
      VPB.last = res; el.className = 'vp';
      const col = res.m.oppInfo.col; el.style.setProperty('--vp-opp', /^#(0|1|2)[0-9a-f](0|1|2)[0-9a-f](0|1|2)[0-9a-f]$/i.test(col) ? '#6B6B6B' : col);
      el.innerHTML = report(res);
      el.querySelectorAll('[data-vpadj]').forEach(s => { s.value = String(adj[s.dataset.vpadj]); s.addEventListener('change', () => { adj[s.dataset.vpadj] = +s.value; render(); }); });
      el.querySelectorAll('[data-vpw]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.vpw, pk = res.picks[k]; if (!pk) return; if (VP._player) VP._player.stop();
        const stage = el.querySelector('#vpStage'); player(stage, res, VPB.game(res, pk.seed), k === 'likely' ? 'Most likely game' : k === 'upset' ? 'The upset' : "Tennessee's best night");
        stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }));
    };
    render();
  };
  VPB._sim = simGame; VPB._profiles = profiles;
})(typeof window !== 'undefined' ? window : globalThis);
