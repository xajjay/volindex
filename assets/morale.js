/* The Vol Index — locker room: player morale, relationships, personalities and coach promises, shared by the football dynasty (DY) and the basketball / baseball / softball
   dynasties (SD). Optional (Settings > Locker room), default off. Built so it stays out of the way: concerns arrive as quiet alerts (never a pop-up or a blocker), only a
   few a season, and every effect is a nudge on decisions players already make (NIL asks, transfers, going pro, recruiting).

   Ideas
   - status: how good the player (and his recruiting profile) says he is. Stars expect a role and money that fit it; low-rated players know where they stand and rarely ask.
   - depth: who is ahead of him. A five-star behind a stack of better players expects to wait a year; one who is about as good as the starters wants to play now.
   - personality (motives): wins / money / role / patience / loyalty, plus his own ego and loyalty traits.
   - relationship (p.rel): trust with this coach. High: he accepts less playing time or money and stays. Low: small things become problems. Promises kept and unexpected
     opportunities build it (most for young players and players who were not the top option), and loyal personalities become more loyal.
   Adapter A (per game): g(), roster(), name(p), ovr(p), pos(p), yr(p), stars(p), group(p) (teammates competing for his job, best first), slots(p) (starters at his spot),
     rot(p) (rotation size), role(p) {start, rot, share, usage, gp}, nil(p), nilValue(p), winPct(), expWin(), news(kind, head, body), cap (concerns per season). */
(function (root) {
  'use strict';
  const M = root.MORALE = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = () => (root.DY && root.DY.r ? root.DY.r() : (root.SD && root.SD.r ? root.SD.r() : Math.random()));
  const hash = (id, k) => { let h = (Number(id) * 2654435761 + k * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

  M.TYPES = {
    start: { name: 'A starting job', short: 'Start', boost: 12 },
    rot: { name: 'A rotation role', short: 'Rotation', boost: 6 },
    focal: { name: 'The main option', short: 'Focal point', boost: 14 },
    captain: { name: 'Team captain', short: 'Captain', boost: 5 },
    nil: { name: 'An NIL raise', short: 'NIL', boost: 8 },
    redshirt: { name: 'A redshirt year', short: 'Redshirt', boost: 2 },
  };
  M.on = g => !!(g && g.settings && g.settings.morale === 'on');
  M.state = g => (g.mor = g.mor || { trust: 60, kept: 0, broke: 0, log: [], unread: 0, asks: 0, y: null, n: 0 });
  const mor = p => (p.mor == null ? (p.mor = 66) : p.mor);
  const rel = p => (p.rel == null ? (p.rel = 52) : p.rel);
  M.moraleOf = mor; M.relOf = rel;
  M.label = v => v >= 80 ? 'Thrilled' : v >= 65 ? 'Happy' : v >= 50 ? 'Content' : v >= 35 ? 'Restless' : 'Unhappy';
  M.relLabel = v => v >= 80 ? 'Devoted' : v >= 65 ? 'Trusts you' : v >= 45 ? 'Neutral' : v >= 30 ? 'Guarded' : 'Distrusts you';
  M.trustLabel = v => v >= 80 ? 'Players trust you' : v >= 60 ? 'Solid reputation' : v >= 40 ? 'Mixed reputation' : 'Players doubt you';
  M.mood = p => ({ v: Math.round(mor(p)), label: M.label(mor(p)), rel: Math.round(rel(p)), relLabel: M.relLabel(rel(p)) });
  const log = (g, msg) => { const S = M.state(g); S.log = [`${g.season || ''}: ${msg}`].concat(S.log).slice(0, 40); };

  /* ---- who he is ---- */
  M.motives = p => {
    const t = p.tr || {}, ego = t.ego == null ? 55 : t.ego, loy = t.loyal == null ? 80 : t.loyal, lead = t.lead == null ? 80 : t.lead;
    return {
      win: Math.round(clamp(50 + hash(p.id, 1) * 45 + (lead - 80) * 0.3, 20, 99)),
      money: Math.round(clamp(25 + ego * 0.5 + hash(p.id, 2) * 38 - (loy - 80) * 0.3, 10, 99)),
      role: Math.round(clamp(20 + ego * 0.7 + hash(p.id, 3) * 24, 10, 99)),
      pat: Math.round(clamp(loy * 0.45 + (100 - ego) * 0.45 + hash(p.id, 4) * 18 - 4, 10, 99)),
    };
  };
  // personality tag shown on the player card (replaces the old clutch/leadership tags with what matters in a locker room)
  M.persona = p => {
    const t = p.tr || {}, m = M.motives(p), ego = t.ego == null ? 55 : t.ego, loy = t.loyal == null ? 80 : t.loyal;
    if (loy >= 92 && ego <= 58) return ['Loyal Soldier', 'Sticks with his coach through anything. Rarely complains, hard to pry away.'];
    if (m.win >= 86) return ['Plays for a Winner', 'Happiest on a contender. Gets restless fast on a losing team.'];
    if (m.money >= 80 && loy < 82) return ['Hired Gun', 'Follows the NIL money. Wants to be paid what he is worth.'];
    if (m.role >= 78 && ego >= 62) return ['Needs the Ball', 'Wants to be the guy. Restless if he is not the focal point.'];
    if (m.pat >= 82) return ['Patient', 'Will wait his turn if he can see a path to the job.'];
    if (loy <= 62) return ['Free Spirit', 'Always looking at the next, better situation.'];
    if (t.lead >= 88) return ['Locker Room Leader', 'Teammates follow him. Steadies the room when things get tense.'];
    if (ego >= 75) return ['Showman', 'Loves the spotlight, and a bigger NIL check.'];
    if (ego <= 40) return ['Team First', 'Happy to do his job. Asks for little.'];
    return ['Even Keel', 'Takes things as they come.'];
  };

  /* ---- what he expects ---- */
  // 0..1: how big a deal he is. Recruiting stars, how high his rating is, and how high his ceiling is.
  M.status = (A, p) => {
    const o = A.ovr(p), st = A.stars ? A.stars(p) : 0;
    return clamp((o - 72) / 20 * 0.55 + (st >= 5 ? 0.4 : st === 4 ? 0.22 : st === 3 ? 0.08 : 0) + (p.ceil ? clamp((p.ceil - 80) / 20, 0, 1) * 0.1 : 0), 0, 1);
  };
  // the role he thinks he has earned: { tier: 'start'|'rot'|'bench', patient, why }
  M.expect = (A, p) => {
    const grp = A.group(p), i = grp.indexOf(p), s = A.slots(p), r = A.rot(p), o = A.ovr(p), st = M.status(A, p), m = M.motives(p), young = (A.yr(p) || 2) <= 2;
    const ahead = grp.slice(0, Math.max(0, i)), gap = ahead.length ? ahead.slice(-Math.max(1, s)).reduce((a, q) => a + A.ovr(q), 0) / Math.min(ahead.length, Math.max(1, s)) - o : -3;
    let tier = i < s ? 'start' : i < r ? 'rot' : 'bench', patient = false, why = '';
    // a real prospect who is close to the starters wants the job now
    if (tier !== 'start' && st >= 0.6 && gap < 4 && i <= s + 1) { tier = 'start'; why = 'He is right in the mix with the starters and thinks he has earned a job.'; }
    // behind clearly better players: he understands, especially if he is young or patient
    if (tier === 'start' && i >= s) {/* no-op */}
    if (gap >= 6 && i >= s) { patient = young || m.pat >= 65; if (patient) { tier = i < r ? 'rot' : 'bench'; why = 'He sees the players ahead of him and knows he may have to wait.'; } }
    if (tier === 'bench' && st >= 0.75 && gap < 9 && !patient) { tier = 'rot'; why = 'A player with his profile expects a real role.'; }
    return { tier, patient, gap, st, why, rank: i };
  };
  M.shareFor = (A, tier) => (A.tierShare ? A.tierShare(tier) : { start: 0.62, rot: 0.32, bench: 0.06 }[tier]);
  M.entitle = (A, p) => { const m = M.motives(p), st = M.status(A, p); return (0.2 + 0.9 * st) * (0.7 + m.role / 140); };
  M.tolerance = p => clamp((rel(p) - 50) / 100 * 0.3, -0.12, 0.15);   // relationship: more minutes/money he'll put up with

  /* ---- in-season and end-of-season update ---- */
  // frac: how much of the evidence to apply (a mid-season tick applies less than the season's end)
  M.update = (A, k) => {
    const g = A.g(), S = M.state(g), me = A.roster(), win = A.winPct(), exp = A.expWin(), res = [];
    me.forEach(p => {
      const r = A.role(p), e = M.expect(A, p), m = M.motives(p), need = M.shareFor(A, e.tier), ent = M.entitle(A, p), ego = (p.tr && p.tr.ego) || 60;
      const gap = need - (r.share || 0) - M.tolerance(p);
      let target = 64;
      target += gap <= 0.03 ? 6 + Math.min(8, -gap * 20) : -gap * 70 * ent * (1 + (ego - 60) / 120);
      target += (win - 0.5) * (10 + m.win / 4) + (win - exp) * 14;
      const v = A.nilValue(p); if (v > 0) { const ratio = A.nil(p) / v; target += ratio >= 0.9 ? 3 : -(0.9 - ratio) * 28 * (m.money / 70) * (0.4 + M.status(A, p)); }
      target += (rel(p) - 50) / 7 + (S.trust - 60) / 20;
      if (p.pr && p.pr.st === 'open') target += 5;
      p.mor = clamp(mor(p) + (target - mor(p)) * k, 5, 99);
      p.ex = { need, share: r.share || 0, why: e.why, patient: e.patient, tier: e.tier };
      res.push(p);
    });
    return res;
  };

  M.kept = (A, p) => {
    const r = A.role(p), pr = p.pr; if (!pr) return null;
    if (pr.type === 'start') return !!r.start;
    if (pr.type === 'rot') return !!(r.start || r.rot);
    if (pr.type === 'focal') return r.usage != null && r.usage <= 2 && r.gp > 0;
    if (pr.type === 'captain') return r.gp > 0 && (r.start || r.rot);
    if (pr.type === 'nil') return A.nil(p) >= (pr.amt || 0) * 0.98;
    if (pr.type === 'redshirt') return (r.share || 0) <= 0.15;
    return true;
  };
  // is an open promise on track right now? (for the alert and the room list)
  M.onTrack = (A, p) => { const r = A.role(p); if (!p.pr || p.pr.st !== 'open') return null; if (!r.gp) return true; return M.kept(A, p); };

  const concern = (A, p, out) => {
    const g = A.g(), r = A.role(p), e = M.expect(A, p), v = A.nilValue(p), m = M.motives(p);
    let type = 'rot', why = e.why;
    if (r.share < M.shareFor(A, e.tier) - 0.1) type = e.tier === 'start' ? 'start' : 'rot';
    else if (v > 0 && A.nil(p) < v * 0.8 && m.money >= 55) type = 'nil';
    else if (e.st > 0.6 && r.start && (r.usage || 9) > 2 && (!A.canFocal || A.canFocal(p))) type = 'focal';
    const amt = type === 'nil' ? Math.round(Math.max(A.nil(p) * 1.25, v) / 5000) * 5000 : 0;
    p.ask = { type, amt, open: true, yr: g.season, why }; p.askY = g.season; out.push(p);
    const S = M.state(g); S.asks++; S.unread++;
    A.news('locker', `${A.name(p)} wants to talk`, `${M.TYPES[type].short === 'NIL' ? 'He feels underpaid for what he brings.' : 'He feels his role does not match his talent.'} Open the Locker Room tab whenever it suits you. Nothing is forced.`);
  };
  // concerns: at most one at a time and a few a season; stars, egos and unhappy players first. Players who know their level rarely raise anything.
  M.concerns = (A, opts) => {
    const g = A.g(), S = M.state(g), me = A.roster(), out = [];
    if (S.y !== g.season) { S.y = g.season; S.n = 0; }
    const cap = Math.max(1, A.cap - (S.trust >= 75 ? 1 : 0) + (S.trust < 40 ? 1 : 0));
    if (S.n >= cap) return out;
    const c = me.filter(p => mor(p) < (A.line || 46) && p.askY !== g.season && !(p.ask && p.ask.open) && A.ovr(p) >= 62 && M.status(A, p) >= 0.18 && (!opts || !opts.onlyOne || true))
      .map(p => [p, (50 - mor(p)) * 1.3 + M.status(A, p) * 40 + (((p.tr && p.tr.ego) || 60) - 50) * 0.3 - (rel(p) - 50) * 0.25]).sort((a, b) => b[1] - a[1]);
    if (c.length) { concern(A, c[0][0], out); S.n++; }
    return out;
  };
  M.tick = A => { const g = A.g(); if (!M.on(g)) return []; M.update(A, 0.35); return M.concerns(A); };

  M.seasonEnd = A => {
    const g = A.g(); if (!M.on(g)) return { asks: [], kept: [], broke: [] };
    const S = M.state(g), me = A.roster(), out = { asks: [], kept: [], broke: [] };
    M.update(A, 0.5);
    me.forEach(p => {
      const r = A.role(p), e = M.expect(A, p), m = M.motives(p), underdog = (A.yr(p) || 3) <= 2 || e.rank > 0;
      if (p.pr && p.pr.st === 'open') {
        if (M.kept(A, p)) {
          const grat = 8 + (underdog ? 7 : 0) + (m.pat - 50) / 12;
          p.pr.st = 'kept'; p.mor = clamp(mor(p) + 10, 5, 99); p.rel = clamp(rel(p) + grat, 0, 100); S.trust = clamp(S.trust + 5, 0, 100); S.kept++; out.kept.push(p);
          if (p.tr) p.tr.loyal = Math.min(99, Math.round((p.tr.loyal || 80) + 1 + m.pat / 40));
          log(g, `${A.name(p)}: promise kept (${M.TYPES[p.pr.type].short}).`);
        } else {
          p.pr.st = 'broken'; p.mor = clamp(mor(p) - 20, 5, 99); p.rel = clamp(rel(p) - 20, 0, 100); p.grudge = g.season; S.trust = clamp(S.trust - 9, 0, 100); S.broke++; out.broke.push(p);
          if (p.tr) p.tr.loyal = Math.max(40, Math.round((p.tr.loyal || 80) - 3));
          log(g, `${A.name(p)}: promise broken (${M.TYPES[p.pr.type].short}).`);
          A.news('locker', `${A.name(p)} feels let down`, `You promised him ${M.TYPES[p.pr.type].name.toLowerCase()} and it did not happen.`);
        }
      } else if (r.gp >= 6 && (r.share || 0) > M.shareFor(A, e.tier) + 0.18 && underdog) {
        p.rel = clamp(rel(p) + 5 + (m.pat - 50) / 20, 0, 100);   // an unexpected chance pays off in gratitude
      }
      if (p.ask && p.ask.open) { p.ask.open = false; p.mor = clamp(mor(p) - 4, 5, 99); p.rel = clamp(rel(p) - 3, 0, 100); }
      if (r.gp >= 6 && mor(p) >= 60) p.rel = clamp(rel(p) + 1.5 + (((p.tr && p.tr.loyal) || 80) - 80) / 20, 0, 100);   // a good year together
    });
    const c = M.concerns(A); out.asks = c; S.y = g.season; S.n = 0;
    return out;
  };

  /* ---- the coach's side ---- */
  M.canPromise = (A, p, type) => {
    const g = A.g(), n = A.roster().filter(q => q.pr && q.pr.st === 'open').length;
    if (!M.on(g)) return 'The locker room is switched off in Settings.';
    if (p.pr && p.pr.st === 'open') return 'You already made him a promise.';
    if (n >= 4) return 'You have four open promises. Keep a few before you make more.';
    if (type === 'nil' && !(A.nilValue(p) > 0)) return 'NIL is off.';
    if (type === 'focal' && A.canFocal && !A.canFocal(p)) return 'That is not a focal-point position.';
    return null;
  };
  M.promise = (A, p, type, amt) => {
    const g = A.g(), why = M.canPromise(A, p, type); if (why) return why;
    if (type === 'nil' && A.raise) { const amt0 = Math.round((amt || (p.ask && p.ask.amt) || A.nil(p) * 1.2) / 5000) * 5000, err = A.raise(p, amt0); if (err) return err; }
    p.pr = { type, amt: type === 'nil' ? Math.round((amt || (p.ask && p.ask.amt) || A.nil(p) * 1.2) / 5000) * 5000 : 0, st: 'open', yr: g.season };
    p.mor = clamp(mor(p) + 12, 5, 99); p.rel = clamp(rel(p) + 3, 0, 100); if (p.ask) p.ask.open = false;
    log(g, `Promised ${A.name(p)}: ${M.TYPES[type].short}.`);
    return `Promised ${A.name(p)}: ${M.TYPES[type].name.toLowerCase()}. Keep it and he will trust you more; break it and he will not forget.`;
  };
  M.talk = (A, p) => {
    const g = A.g(), S = M.state(g); if (!M.on(g)) return 'The locker room is switched off in Settings.';
    if (p.talkY === g.season) return 'You already talked to him this season.';
    p.talkY = g.season;
    const e = M.expect(A, p), m = M.motives(p);
    const ok = rnd() < clamp(0.4 + S.trust / 220 + (rel(p) - 50) / 200 + (e.patient ? 0.15 : 0) + (m.pat - 60) / 300 - (((p.tr && p.tr.ego) || 60) - 60) / 250 - (p.grudge === g.season - 1 ? 0.1 : 0), 0.15, 0.9);
    if (p.ask) p.ask.open = false;
    if (ok) { p.mor = clamp(mor(p) + 10, 5, 99); p.rel = clamp(rel(p) + 3, 0, 100); p.grudge = null; return `${A.name(p)} appreciates the honesty${e.why ? ': ' + e.why : ''}. He is in a better place.`; }
    p.mor = clamp(mor(p) - 2, 5, 99); return `${A.name(p)} heard you out, but nothing changed.`;
  };
  M.ignore = (A, p) => { if (p.ask) p.ask.open = false; p.mor = clamp(mor(p) - 4, 5, 99); p.rel = clamp(rel(p) - 3, 0, 100); return `${A.name(p)} did not like being brushed off.`; };

  /* ---- effects on the decisions players already make (1.0 = neutral; with the locker room off, nothing changes) ---- */
  M.leaveMult = (g, p) => { if (!M.on(g)) return 1; return clamp(1 + (55 - mor(p)) / 60 - (rel(p) - 50) / 110 - (M.state(g).trust - 60) / 300, 0.45, 2.4); };
  M.nilMult = (g, p) => { if (!M.on(g)) return 1; return clamp(1 + (55 - mor(p)) / 90 - (rel(p) - 50) / 200, 0.5, 1.8); };
  M.nilSlack = (g, p) => (M.on(g) ? clamp((rel(p) - 50) / 200, -0.2, 0.25) : 0);   // loyal, trusting players accept a lower number before they ask
  // recruiting promises: a prospect weighs what you offer him more when your word is good, and big prospects care most
  M.RP_TYPES = ['start', 'rot', 'focal', 'redshirt'];
  M.recruitMult = (g, type, stars) => { if (!M.on(g) || !type) return 1; const t = M.state(g).trust; return 1 + (M.TYPES[type].boost / 100) * (0.5 + t / 100) * (0.7 + 0.15 * (stars || 3)); };
  M.setRP = (g, pool, p, type, canFocal) => {
    if (!M.on(g)) return 'The locker room is switched off in Settings.';
    if (!type) { p.rpromise = null; return 'Promise withdrawn.'; }
    if (type === 'focal' && canFocal === false) return 'That is not a focal-point position.';
    const n = Object.values(pool).filter(q => q.rpromise && q.id !== p.id && q.commit !== -1 && !q.dropped).length;
    if (n >= 3) return 'You already have three recruiting promises out. Withdraw one first. They are binding once he signs.';
    p.rpromise = type; return `Promised ${p.n}: ${M.TYPES[type].name.toLowerCase()}. It counts if he signs, and he will hold you to it.`;
  };
  M.signed = (g, p, type) => { if (!M.on(g)) return; p.mor = 74; p.rel = 55 + (type ? 8 : 0); if (type) p.pr = { type, amt: 0, st: 'open', yr: g.season + 1, recruit: true }; p.rpromise = null; };
})(typeof window !== 'undefined' ? window : globalThis);
