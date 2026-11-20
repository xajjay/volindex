/* The Vol Index — live game tracker. Opens from a live game (the "Live box score" button, the live banner, a live game on the schedule),
   at volindex.net/live/<sport>. Follows Tennessee's game in real time from ESPN's public feeds (scoreboard for the situation, summary for
   plays, drives, win probability and box score) and refreshes every 10 seconds while the game is on.
     Football: the field (a camera follows the ball on phones), first-down line, drive trail, and the players in each play by name.
     Basketball: a shot chart court with every made and missed shot, the shooter's name, and scoring runs.
     Baseball and softball: a diamond with runners, batter, pitcher, the count, outs and where each ball was hit.
   All sports: win probability against our pregame model (football), every play, team stats, line score, leaders, score alerts.
   Preview without a real game: /live/football?livedemo=1 (also mbb, wbb, baseball, softball); add &speed=3 to run faster. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/';
  const PATH = { football: ['football/college-football', '&groups=80'], mbb: ['basketball/mens-college-basketball', '&groups=50'], wbb: ['basketball/womens-college-basketball', '&groups=50'],
    baseball: ['baseball/college-baseball', ''], softball: ['softball/college-softball', ''], volleyball: ['volleyball/womens-college-volleyball', ''], soccer: ['soccer/usa.ncaa.w.1', ''] };
  const NAME = { football: 'Football', mbb: "Men's Hoops", wbb: "Women's Hoops", baseball: 'Baseball', softball: 'Softball', volleyball: 'Volleyball', soccer: 'Soccer' };
  const ORANGE = '#FF8200';
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const etDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const etHour = () => +new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }) % 24;
  const isTN = c => c && c.team && (c.team.abbreviation === 'TENN' || c.team.location === 'Tennessee');
  const href = k => window.VI_ROUTER ? window.VI_ROUTER.href(k) : '#' + k;
  const qs = new URLSearchParams(location.search), DEMO = qs.get('livedemo'), DSPEED = Math.max(0.5, +qs.get('speed') || 1);
  const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
  const toSec = v => { const m = /^(\d+):(\d+)$/.exec(String(v || '')); return m ? +m[1] * 60 + +m[2] : parseFloat(v); };
  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const rnd = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let T = null;          // the open tracker: { sport, timer, tick, S, at, ... }
  let filter = 'all', alerts = LS.get('vi-trk-alerts') === '1', wake = null, seen = new Set(), first = true;

  function schedOf(k) {
    if (k === 'football') return (window.fbData && window.fbData() || (window.SITE || {}).football || {}).schedule || [];
    return ((window.SITE || {})[k] || {}).schedule || [];
  }
  const rosterOf = k => { const s = (window.SITE || {})[k] || {}; return (k === 'football' ? s.players : s.roster) || []; };

  /* ================= names in a play's text ================= */
  const N = "[A-Z][A-Za-z'.\\-]+(?: (?:[A-Z][A-Za-z'.\\-]+|II|III|IV|Jr\\.?|Sr\\.?)){1,3}";
  const m1 = (re, t) => { const m = re.exec(t); return m ? m[1] : null; };
  function whoIn(text) {
    const t = String(text || ''), o = {};
    o.passer = m1(new RegExp('^(' + N + ') pass (?:complete|incomplete|intercepted)'), t);
    o.receiver = m1(new RegExp('pass (?:complete|incomplete) to (' + N + ')'), t);
    o.rusher = m1(new RegExp('^(' + N + ') (?:run|rush|scramble)\\w* for', 'i'), t);
    const sk = new RegExp('^(' + N + ') sacked(?: by (' + N + ')(?: and (' + N + '))?)?').exec(t);
    if (sk) { o.passer = sk[1]; o.sacker = [sk[2], sk[3]].filter(Boolean); }
    o.interceptor = m1(new RegExp('intercepted (' + N + ')'), t);
    o.kicker = m1(new RegExp('^(' + N + ') (?:\\d+ yd field goal|punt|kickoff)', 'i'), t);
    o.returner = m1(new RegExp('(?:returns?|returned by) (' + N + ')'), t);
    const par = /\(([^)]+)\)\s*(?:\.|$)/.exec(t);
    o.tacklers = par ? par[1].split(/[;,]/).map(x => x.trim()).filter(x => new RegExp('^' + N + '$').test(x)).slice(0, 2) : [];
    return o;
  }
  const SUF = /^(II|III|IV|Jr\.?|Sr\.?)$/;
  const shortName = n => { const p = String(n).split(' ').filter(x => !SUF.test(x)); return p.length < 2 ? n : p[0][0] + '. ' + p[p.length - 1]; };

  /* ================= ESPN → one shape ================= */
  const side = c => {
    const t = c.team || {}, tn = isTN(c);
    return { id: t.id, abbr: t.abbreviation || '', name: tn ? 'Tennessee' : (t.location || t.shortDisplayName || t.displayName || ''), tn,
      color: tn ? ORANGE : (t.color ? '#' + t.color : '#555'), alt: t.alternateColor ? '#' + t.alternateColor : '#333', score: +c.score || 0,
      rank: c.curatedRank && c.curatedRank.current && c.curatedRank.current < 99 ? c.curatedRank.current : null,
      record: ((c.record || [])[0] || {}).displayValue || (c.records && c.records[0] && c.records[0].summary) || '', lines: (c.linescores || []).map(x => x.displayValue), winner: !!c.winner };
  };
  function fromEspn(k, sum, ev) {
    const hc = ((sum.header || {}).competitions || [])[0] || (ev && ev.competitions[0]); if (!hc) return null;
    const cs = hc.competitors, hh = cs.find(c => c.homeAway === 'home'), aa = cs.find(c => c.homeAway === 'away');
    const home = side(hh), away = side(aa), st = hc.status || (ev && ev.status) || {}, ty = st.type || {};
    const S = { sport: k, id: (ev && ev.id) || (sum.header || {}).id, state: ty.state || 'pre', detail: ty.shortDetail || ty.detail || '', clock: st.displayClock || '', period: st.period || 0,
      start: hc.date || (ev && ev.date), home, away, us: home.tn ? 'home' : 'away', plays: [], drives: [], wp: [], wpIds: [], stats: [], leaders: [], poss: null, venue: ((sum.gameInfo || {}).venue || {}).fullName || '',
      tv: (((hc.broadcasts || [])[0] || {}).names || []).join(', ') || '' };
    const sit = (ev && ev.competitions[0].situation) || {};
    if (S.state === 'in' && k === 'football') {
      const pid = sit.possession || (sum.drives && sum.drives.current && sum.drives.current.team && sum.drives.current.team.id);
      S.poss = pid ? (pid === home.id ? 'home' : pid === away.id ? 'away' : null) : null;
      S.down = sit.down; S.dist = sit.distance; S.dd = sit.downDistanceText || sit.shortDownDistanceText || ''; S.red = !!sit.isRedZone; S.to = [sit.awayTimeouts, sit.homeTimeouts];
      const m = /([A-Z&]{2,6})\s+(\d{1,2})\s*$/.exec(sit.possessionText || S.dd || ''), me = S.poss && S[S.poss];
      if (m && me) S.ytg = m[1] === me.abbr ? 100 - +m[2] : +m[2]; else if (sit.yardsToEndzone != null) S.ytg = sit.yardsToEndzone;
      if (/\b50$/.test(sit.possessionText || '')) S.ytg = 50;
      S.last = (sit.lastPlay && sit.lastPlay.text) || '';
    }
    if (k === 'baseball' || k === 'softball') {
      const nm = x => x && ((x.athlete || {}).displayName || (x.athlete || {}).fullName || x.displayName || x.name) || '';
      S.bs = { outs: sit.outs != null ? sit.outs : null, balls: sit.balls, strikes: sit.strikes, on: [sit.onFirst, sit.onSecond, sit.onThird].map(b => b ? (typeof b === 'object' ? nm(b) || '•' : '•') : null), batter: nm(sit.batter), pitcher: nm(sit.pitcher),
        top: /^top/i.test(S.detail), mid: /^(mid|end)/i.test(S.detail) };
    }
    const mapPlay = (p, drv, di) => ({ id: p.id, per: (p.period && p.period.number) || 0, clk: (p.clock && p.clock.displayValue) || p.periodText || '', text: p.text || p.shortText || '', type: (p.type && p.type.text) || '',
      scoring: !!p.scoringPlay, hs: p.homeScore, as: p.awayScore, yds: p.statYardage, d: di, team: (p.start && p.start.team && p.start.team.id) || (drv && drv.team && drv.team.id) || (p.team && p.team.id) || null,
      down: p.start && p.start.down, dist: p.start && p.start.distance, ytg: p.start && p.start.yardsToEndzone, eytg: p.end && p.end.yardsToEndzone, pts: p.scoreValue, coord: p.coordinate, shoot: !!p.shootingPlay });
    const dr = sum.drives ? (sum.drives.previous || []).concat(sum.drives.current ? [sum.drives.current] : []) : [];
    if (dr.length) dr.forEach((d, di) => {
      S.drives.push({ team: d.team && d.team.id, desc: d.description || '', n: d.offensivePlays, yds: d.yards, top: d.timeElapsed && d.timeElapsed.displayValue, result: d.displayResult || d.result || '', score: !!d.isScore, cur: d === sum.drives.current && S.state === 'in' });
      (d.plays || []).forEach(p => S.plays.push(mapPlay(p, d, di)));
    });
    else (sum.plays || sum.keyEvents || []).forEach(p => S.plays.push(mapPlay(p, null, -1)));
    S.plays = S.plays.filter(p => p.text);
    if (k === 'mbb' || k === 'wbb') shotsFrom(S);
    (sum.winprobability || []).forEach(w => { S.wp.push(Math.round((w.homeWinPercentage ?? 0.5) * 1000) / 10); S.wpIds.push(w.playId); });
    const bt = (sum.boxscore || {}).teams || [], tt = x => bt.find(b => b.team && b.team.id === x.id), a = tt(away), h = tt(home);
    if (a && h) {
      const WANT = [['totalYards', 'Total yards'], ['yardsPerPlay', 'Yards per play'], ['rushingYards', 'Rushing yards'], ['netPassingYards', 'Passing yards'], ['firstDowns', 'First downs'], ['thirdDownEff', '3rd down'],
        ['turnovers', 'Turnovers'], ['totalPenaltiesYards', 'Penalties'], ['possessionTime', 'Time of possession'], ['fieldGoalPct', 'FG %'], ['threePointFieldGoalPct', '3-pt %'], ['freeThrowPct', 'FT %'], ['totalRebounds', 'Rebounds'], ['assists', 'Assists'], ['hits', 'Hits'], ['errors', 'Errors']];
      WANT.forEach(([n, l]) => { const x = (a.statistics || []).find(s => s.name === n), y = (h.statistics || []).find(s => s.name === n); if (x && y && x.displayValue != null) S.stats.push({ l, a: x.displayValue, h: y.displayValue, low: /turnover|penalt|error/i.test(l) }); });
    }
    (sum.leaders || []).forEach(L => (L.leaders || []).forEach(c => {
      const e = (c.leaders || [])[0]; if (!e) return; let row = S.leaders.find(r => r.l === c.displayName); if (!row) { row = { l: c.displayName, away: '', home: '' }; S.leaders.push(row); }
      const txt = `${esc((e.athlete || {}).shortName || (e.athlete || {}).displayName || '')} <i>${esc(e.displayValue || '')}</i>`; if (L.team && L.team.id === home.id) row.home = txt; else row.away = txt; }));
    return S;
  }
  // basketball: every shot with a spot on the floor (ESPN gives x 0-50 across, y 0-94 along the court); both teams are drawn on one half court
  function shotsFrom(S) {
    S.shots = [];
    S.plays.forEach(p => {
      const c = p.coord; if (!c || c.x == null || c.y == null || c.x < -100 || c.y < -100) return;
      const made = /\bmade\b/i.test(p.text) && !/missed/i.test(p.text); if (!made && !/missed/i.test(p.text)) return;
      let x = +c.x, y = +c.y; if (y > 47) { y = 94 - y; x = 50 - x; }
      S.shots.push({ id: p.id, x: clamp(x, 0, 50), y: clamp(y, 0, 47), made, three: /three point/i.test(p.text) || (p.pts === 3 && made), team: p.team, name: m1(new RegExp('^(' + N + ') (?:made|missed)'), p.text) || '', text: p.text });
    });
  }
  function preFromSchedule(k) {
    const s = schedOf(k), t = etDate(), g = s.find(x => x.date >= t && !x.result) || s[s.length - 1]; if (!g) return null;
    const mk = (n, tn) => ({ id: n, abbr: tn ? 'TENN' : String(g.opp || '').slice(0, 4).toUpperCase(), name: tn ? 'Tennessee' : g.opp, tn, color: tn ? ORANGE : '#555', alt: '#333', score: 0, rank: null, record: '', lines: [] });
    const homeUs = !/^at|@/.test(g.site || '') && g.site !== 'A' && g.home !== false && !/away/i.test(g.site || '');
    const us = mk('ut', true), them = mk('opp', false);
    return { sport: k, id: null, state: 'pre', detail: g.time || '', start: g.dateTime || null, date: g.date, home: homeUs ? us : them, away: homeUs ? them : us, us: homeUs ? 'home' : 'away', plays: [], drives: [], wp: [], wpIds: [], stats: [], leaders: [], tv: g.tv || '', venue: '' };
  }

  /* ================= demo games: a simulated Tennessee game played back live ================= */
  const OPP_NAMES = ['Marcus Hill', 'Devin Cole', 'Jalen Ross', 'Cam Fisher', 'Tyrese Boone', 'Eli Shaw', 'Kobe Grant', 'Reggie Lane', 'Dante Pierce', 'Cole Barnes'];
  const pickPos = (k, re, n) => rosterOf(k).filter(p => re.test(p.pos || '')).slice(0, n).map(p => p.name);
  const demoTeams = (oppName, oppAbbr, oc) => ({
    home: { id: 'h', abbr: 'TENN', name: 'Tennessee', tn: true, color: ORANGE, alt: '#fff', score: 0, rank: 12, record: '8-2', lines: [] },
    away: { id: 'a', abbr: oppAbbr, name: oppName, tn: false, color: oc, alt: '#FDD023', score: 0, rank: 14, record: '7-3', lines: [] } });
  function demoFootball(k) {
    const qb = pickPos(k, /^QB/, 1)[0] || 'Quarterback One', rbs = pickPos(k, /^RB/, 3), wrs = pickPos(k, /^WR/, 4), dls = pickPos(k, /^(DL|DE|EDGE)/, 3), dbs = pickPos(k, /^(DB|S|CB|LB)/, 4), kick = pickPos(k, /^(K|P)/, 1)[0] || 'Kicker One';
    const G = (a, i, d) => a.length ? a[i % a.length] : d, O = OPP_NAMES;
    const prof = i => VP._profile(null, i, 10), Ms = [VP._matchup(prof(0), prof(1)), VP._matchup(prof(1), prof(0))], rec = [];
    VP._sim(Ms, 4242 + Math.floor(Date.now() / 36e5) % 50, rec, [{ team: 'Tennessee', qb, rb: G(rbs, 0, 'Running Back'), wr: G(wrs, 0, 'Receiver') }, { team: 'LSU', qb: O[0], rb: O[1], wr: O[2] }]);
    const plays = []; let i = 0;
    rec.forEach(p => {
      if (p.type === 'pat') return; i++;
      const us = p.o === 0, q = us ? qb : O[0], dtk = us ? O[3 + (i % 4)] : G(dbs, i, 'Defender'), dsk = us ? O[7] : G(dls, i, 'Lineman');
      const ball = p.ball, y = p.y || 0, endB = clamp(ball + y, 0, 100); let text = p.text;
      const rb = us ? G(rbs, i % 3 ? 0 : 1, 'Running Back') : O[1 + (i % 2)], wr = us ? G(wrs, i, 'Receiver') : O[2 + (i % 3)], tdTag = p.td ? ' for a TD' : '';
      if (p.type === 'run' && !p.scr) text = `${rb} run for ${y} yds${tdTag}${p.td ? '' : ` (${dtk})`}`;
      else if (p.type === 'run' && p.scr) text = `${q} run for ${y} yds${tdTag}`;
      else if (p.type === 'pass') text = `${q} pass complete to ${wr} for ${y} yds${tdTag}${p.td ? '' : ` (${dtk})`}`;
      else if (p.type === 'inc') text = `${q} pass incomplete to ${wr}`;
      else if (p.type === 'sack') text = `${q} sacked by ${dsk} for a loss of ${-y} yds`;
      else if (p.type === 'int') text = `${q} pass intercepted ${dtk} return for ${p.ret || 0} yds`;
      else if (p.type === 'fg') text = `${us ? kick : 'Cole Harper'} ${p.dist} yd field goal ${p.good ? 'GOOD' : 'NO GOOD'}`;
      else if (p.type === 'punt') text = `${us ? kick : 'Cole Harper'} punt for ${p.net} yds`;
      plays.push({ id: 'd' + i, per: p.q > 4 ? 4 : p.q, clk: mmss(p.clk || 0), text, type: p.type, scoring: !!(p.td || (p.type === 'fg' && p.good) || p.td6 || p.safety), hs: p.sc[0], as: p.sc[1],
        yds: y, d: 0, team: us ? 'h' : 'a', down: p.down, dist: p.togo, ytg: 100 - ball, eytg: 100 - endB, big: Math.abs(y) >= 20, raw: p });
    });
    const tm = demoTeams('LSU', 'LSU', '#461D7C'); let n = 3; const t0 = Date.now();
    return async () => {
      n = Math.min(plays.length, 3 + Math.floor((Date.now() - t0) / (3000 / DSPEED)));
      const vis = plays.slice(0, n), last = vis[vis.length - 1], nx = plays[n], done = n >= plays.length;
      const home = Object.assign({}, tm.home, { score: last.hs }), away = Object.assign({}, tm.away, { score: last.as });
      const tot = [0, 0], rush = [0, 0], pass = [0, 0], tov = [0, 0];
      vis.forEach(p => { const o = p.team === 'h' ? 0 : 1; if (p.type === 'run' || p.type === 'pass') { tot[o] += p.yds; (p.type === 'run' ? rush : pass)[o] += p.yds; } if (p.raw.to) tov[o]++; });
      const wp = vis.map(p => { const l = p.per > 4 ? 0.02 : Math.max(0.01, ((4 - p.per) * 900 + toSec(p.clk)) / 3600); return Math.round(1000 / (1 + Math.exp(-1.702 * ((p.hs - p.as + 1.6 * l) / (15 * Math.sqrt(l) + 1.2))))) / 10; });
      const live = !done && nx && nx.type !== 'ko';
      return { sport: k, id: 'demo', state: done ? 'post' : 'in', detail: done ? 'Final' : `Q${last.per} ${last.clk}`, period: last.per, start: new Date().toISOString(), home, away, us: 'home', demo: true,
        poss: live ? (nx.team === 'h' ? 'home' : 'away') : null, down: nx && nx.down, dist: nx && nx.dist, ytg: nx && nx.ytg, dd: nx && nx.down ? `${['', '1st', '2nd', '3rd', '4th'][nx.down]} & ${nx.dist}` : '', red: nx && nx.ytg <= 20,
        last: last.text, plays: vis, drives: [], wp, wpIds: vis.map(p => p.id),
        stats: [{ l: 'Total yards', a: String(tot[1]), h: String(tot[0]) }, { l: 'Rushing yards', a: String(rush[1]), h: String(rush[0]) }, { l: 'Passing yards', a: String(pass[1]), h: String(pass[0]) }, { l: 'Turnovers', a: String(tov[1]), h: String(tov[0]), low: true }],
        leaders: [], tv: 'ESPN (demo)', venue: 'Neyland Stadium · simulated game' };
    };
  }
  function demoBasketball(k) {
    const R = rnd(901 + (k === 'wbb' ? 5 : 0)), ours = rosterOf(k).slice(0, 9).map(p => p.name), them = OPP_NAMES.slice(0, 8), ev = [];
    const W = ours.length ? ours : ['Player One', 'Player Two', 'Player Three', 'Player Four', 'Player Five'], tm = demoTeams('Kentucky', 'UK', '#0033A0'), pf = a => a[Math.floor(R() * a.length)];
    let hs = 0, as = 0, clk = 1200, half = 1, off = 1, id = 0;
    while (true) {
      clk -= 10 + R() * 16; if (clk <= 0) { if (half === 2) break; half = 2; clk = 1200; }
      const us = off === 1, nm = pf(us ? W : them), r = R(), base = { id: 'b' + (id++), per: half, clk: mmss(clk), team: us ? 'h' : 'a' };
      if (r < 0.12) { ev.push(Object.assign(base, { text: `${nm} Turnover.`, type: 'turnover', hs, as })); off = 1 - off; continue; }
      const three = R() < 0.36, made = R() < (three ? 0.35 : 0.52), pts = made ? (three ? 3 : 2) : 0;
      let sx, sy; if (three) { const a = (R() - 0.5) * 2.7; sx = 25 + Math.sin(a) * 23.5; sy = 5.25 + Math.cos(a) * 23.5; if (sy < 5) sy = 3 + R() * 2; } else if (R() < 0.45) { sx = 25 + (R() - 0.5) * 8; sy = 2 + R() * 4; } else { sx = 25 + (R() - 0.5) * 30; sy = 6 + R() * 12; }
      if (us) hs += pts; else as += pts;
      ev.push(Object.assign(base, { text: `${nm} ${made ? 'made' : 'missed'} ${three ? 'Three Point Jumper' : sy < 6 ? 'Layup' : 'Jumper'}.`, type: 'shot', scoring: made, hs, as, pts, coord: { x: clamp(sx, 1, 49), y: clamp(sy, 1, 40) }, shoot: true }));
      if (!made) { const offReb = R() < 0.27, rt = (offReb ? us : !us); ev.push({ id: 'b' + (id++), per: half, clk: mmss(clk), team: rt ? 'h' : 'a', text: `${pf(rt ? W : them)} ${offReb ? 'Offensive' : 'Defensive'} Rebound.`, type: 'rebound', hs, as }); if (!offReb) off = 1 - off; } else off = 1 - off;
    }
    let n = 4; const t0 = Date.now();
    return async () => {
      n = Math.min(ev.length, 4 + Math.floor((Date.now() - t0) / (1400 / DSPEED))); const vis = ev.slice(0, n), last = vis[n - 1], done = n >= ev.length;
      const home = Object.assign({}, tm.home, { score: last.hs }), away = Object.assign({}, tm.away, { score: last.as });
      const wp = vis.map(p => { const left = p.per === 1 ? (1200 + toSec(p.clk)) / 2400 : toSec(p.clk) / 2400; return Math.round(1000 / (1 + Math.exp(-((p.hs - p.as + 2.5 * left) / (9 * Math.sqrt(Math.max(0.03, left)) + 1))))) / 10; });
      const S = { sport: k, id: 'demo', state: done ? 'post' : 'in', detail: done ? 'Final' : `${last.per === 1 ? '1st' : '2nd'} Half ${last.clk}`, period: last.per, start: new Date().toISOString(), home, away, us: 'home', demo: true,
        plays: vis, drives: [], wp, wpIds: vis.map(p => p.id), stats: [], leaders: [], tv: 'ESPN (demo)', venue: 'Thompson-Boling Arena · simulated game' };
      shotsFrom(S); const fg = (t, three) => { const s = S.shots.filter(x => x.team === t && (!three || x.three)); return `${s.filter(x => x.made).length}-${s.length}`; };
      S.stats = [{ l: 'FG', a: fg('a'), h: fg('h') }, { l: '3-pt', a: fg('a', 1), h: fg('h', 1) }, { l: 'Turnovers', a: String(vis.filter(p => p.type === 'turnover' && p.team === 'a').length), h: String(vis.filter(p => p.type === 'turnover' && p.team === 'h').length), low: true }];
      return S;
    };
  }
  function demoBaseball(k) {
    const R = rnd(5150 + (k === 'softball' ? 3 : 0)), hitters = rosterOf(k).filter(p => !/^(P|RHP|LHP)/.test(p.pos || '')).slice(0, 9).map(p => p.name), pit = rosterOf(k).find(p => /^(P|RHP|LHP)/.test(p.pos || ''));
    const FILL = ['Hitter Nine', 'Hitter Eight', 'Hitter Seven', 'Hitter Six', 'Hitter Five', 'Hitter Four', 'Hitter Three', 'Hitter Two', 'Hitter One'], US = hitters.concat(FILL).slice(0, 9), TH = OPP_NAMES.slice(0, 9), INN = k === 'baseball' ? 9 : 7;
    const tm = demoTeams(k === 'baseball' ? 'LSU' : 'Oklahoma', k === 'baseball' ? 'LSU' : 'OU', k === 'baseball' ? '#461D7C' : '#841617'), ev = [];
    let hs = 0, as = 0, id = 0; const bi = { h: 0, a: 0 };
    const LOC = ['left field', 'center field', 'right field', 'left center', 'right center', 'down the left field line', 'down the right field line'], GRD = ['shortstop', 'third base', 'second base', 'first base', 'pitcher'];
    const ABB = { 'shortstop': 'ss', 'third base': '3b', 'second base': '2b', 'first base': '1b', 'pitcher': 'p', 'left field': 'lf', 'center field': 'cf', 'right field': 'rf', 'left center': 'lf', 'right center': 'rf', 'down the left field line': 'lf', 'down the right field line': 'rf' };
    for (let inn = 1; ; inn++) {
      for (const half of ['top', 'bot']) {
        if (inn >= INN && half === 'bot' && hs > as) break;
        const key = half === 'top' ? 'a' : 'h', bat = half === 'top' ? TH : US, pitcher = half === 'top' ? (pit ? pit.name : 'Pitcher One') : 'Matt Reed';
        let outs = 0, run = [null, null, null];
        const add = n => { if (key === 'h') hs += n; else as += n; };
        const adv = n => { let sc = 0; const nr = [null, null, null]; for (let i = 2; i >= 0; i--) if (run[i]) { const j = i + n; if (j >= 3) sc++; else nr[j] = run[i]; } return [nr, sc]; };
        while (outs < 3) {
          const b = bat[bi[key]++ % 9], r = R(), nxt = bat[bi[key] % 9]; let text, rbi = 0, hit = null, kind = 'out';
          if (r < 0.21) { outs++; text = `${b} struck out ${R() < 0.55 ? 'swinging' : 'looking'}.`; kind = 'k'; }
          else if (r < 0.30) { const forced = run[0] && run[1] && run[2]; if (run[0]) { if (run[1]) { if (run[2]) rbi = 1; run[2] = run[1]; } run[1] = run[0]; } run[0] = b; if (forced) add(1); text = `${b} walked${forced ? ', 1 RBI' : ''}.`; kind = 'bb'; }
          else if (r < 0.45) { const [nr, s] = adv(1); run = nr; run[0] = b; rbi = s; add(s); hit = { loc: LOC[Math.floor(R() * 5)] }; text = `${b} singled to ${hit.loc}${s ? ', ' + s + ' RBI' : ''}.`; kind = 'h1'; }
          else if (r < 0.50) { const [nr, s] = adv(2); run = nr; run[1] = b; rbi = s; add(s); hit = { loc: LOC[Math.floor(R() * 7)] }; text = `${b} doubled to ${hit.loc}${s ? ', ' + s + ' RBI' : ''}.`; kind = 'h2'; }
          else if (r < 0.505) { const [nr, s] = adv(3); run = nr; run[2] = b; rbi = s; add(s); hit = { loc: LOC[Math.floor(R() * 5)] }; text = `${b} tripled to ${hit.loc}${s ? ', ' + s + ' RBI' : ''}.`; kind = 'h3'; }
          else if (r < 0.54) { const s = 1 + run.filter(Boolean).length; run = [null, null, null]; rbi = s; add(s); hit = { loc: LOC[Math.floor(R() * 5)] }; text = `${b} homered to ${hit.loc}, ${s} RBI.`; kind = 'hr'; }
          else if (r < 0.78) { outs++; hit = { loc: GRD[Math.floor(R() * 5)] }; text = `${b} grounded out to ${ABB[hit.loc]}.`;
            if (run[0] && outs < 3 && R() < 0.3) { outs++; run[0] = null; text = `${b} grounded into a double play, ${ABB[hit.loc]} to 2b.`; } else if (run[2] && outs < 3 && R() < 0.4) { add(1); rbi = 1; run[2] = null; text += ' 1 RBI.'; } }
          else { outs++; hit = { loc: LOC[Math.floor(R() * 5)] }; text = `${b} flied out to ${ABB[hit.loc]}.`; if (run[2] && outs < 3 && R() < 0.5) { add(1); rbi = 1; run[2] = null; text += ' 1 RBI, sacrifice fly.'; } }
          ev.push({ id: 'p' + id++, per: inn, clk: `${half === 'top' ? 'Top' : 'Bot'} ${inn}`, half, text, type: kind, scoring: rbi > 0, hs, as, team: key, hit, bs: { outs: Math.min(outs, 3), on: run.slice(), batter: nxt, pitcher, top: half === 'top', mid: outs >= 3 } });
        }
      }
      if (inn >= INN && (hs !== as || inn >= INN + 3)) break;
    }
    let n = 2; const t0 = Date.now();
    return async () => {
      n = Math.min(ev.length, 2 + Math.floor((Date.now() - t0) / (3200 / DSPEED))); const vis = ev.slice(0, n), last = vis[n - 1], done = n >= ev.length, rr = rnd(n * 17 + 3);
      const home = Object.assign({}, tm.home, { score: last.hs }), away = Object.assign({}, tm.away, { score: last.as });
      const lines = t => { const a = []; let prev = 0; vis.forEach(p => { if (p.team === t) { const cur = t === 'h' ? p.hs : p.as; a[p.per - 1] = (a[p.per - 1] || 0) + (cur - prev); prev = cur; } }); return Array.from(a, v => String(v || 0)); };
      home.lines = lines('h'); away.lines = lines('a');
      const mid = last.bs.mid, bs = Object.assign({}, last.bs, { balls: Math.floor(rr() * 4), strikes: Math.floor(rr() * 3), top: mid ? !last.bs.top : last.bs.top, outs: mid ? 0 : last.bs.outs, on: mid ? [null, null, null] : last.bs.on });
      const cnt = t => String(vis.filter(p => /^h/.test(p.type) && p.team === t).length);
      const wp = vis.map(p => { const left = Math.max(0.05, (INN - p.per + 0.5) / INN); return Math.round(1000 / (1 + Math.exp(-((p.hs - p.as + 0.4 * left) / (2.6 * Math.sqrt(left) + 0.4))))) / 10; });
      const detail = done ? 'Final' : `${last.half === 'top' ? (mid ? 'Mid' : 'Top') : (mid ? 'End' : 'Bot')} ${last.per}`;
      return { sport: k, id: 'demo', state: done ? 'post' : 'in', detail, period: last.per, start: new Date().toISOString(), home, away, us: 'home', demo: true, bs,
        plays: vis, drives: [], wp, wpIds: vis.map(p => p.id), stats: [{ l: 'Hits', a: cnt('a'), h: cnt('h') }], leaders: [], tv: 'SEC Network (demo)', venue: (k === 'baseball' ? 'Lindsey Nelson Stadium' : 'Sherri Parker Lee Stadium') + ' · simulated game' };
    };
  }
  const demoFeed = k => k === 'football' ? demoFootball(k) : (k === 'mbb' || k === 'wbb') ? demoBasketball(k) : (k === 'baseball' || k === 'softball') ? demoBaseball(k) : null;

  /* ================= data loop ================= */
  async function getJson(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw 0; return r.json(); }
  async function findEvent(k) {
    const [p, q] = PATH[k], days = [etDate()]; if (etHour() < 4) days.unshift(etDate(new Date(Date.now() - 864e5)));
    for (const d of days) {
      try { const j = await getJson(`${ESPN}${p}/scoreboard?dates=${d.replace(/-/g, '')}&limit=500${q}`); const ev = (j.events || []).find(e => e.competitions && e.competitions[0].competitors.some(isTN)); if (ev) return ev; } catch (e) { }
    }
    return null;
  }
  function pickSport(want) {
    if (want && PATH[want]) return want;
    const L = window.VI_LIVE || {}, live = Object.keys(L).find(k => L[k].state === 'in'); if (live) return live;
    const t = etDate(), tod = Object.keys(PATH).find(k => schedOf(k).some(g => g.date === t)); if (tod) return tod;
    return 'football';
  }
  async function load() {
    if (!T) return; const k = T.sport; let S = null;
    try {
      if (DEMO && demoFeed(k)) { T.feed = T.feed || demoFeed(k); S = await T.feed(); }
      else {
        const ev = await findEvent(k);
        if (ev) { let sum = {}; try { sum = await getJson(`${ESPN}${PATH[k][0]}/summary?event=${ev.id}`); } catch (e) { } S = fromEspn(k, sum, ev); }
      }
    } catch (e) { if (DEMO) console.error('tracker demo:', e && e.stack || e); }
    if (!T) return; if (!S) S = preFromSchedule(k);
    T.S = S; T.at = Date.now(); paint();
    clearTimeout(T.timer);
    if (S && S.state === 'in') T.timer = setTimeout(load, DEMO ? 1500 : 10e3);
    else if (S && S.state === 'pre') { const ms = S.start ? new Date(S.start) - Date.now() : 1e9; T.timer = setTimeout(load, ms < 20 * 60e3 ? 30e3 : 5 * 60e3); }
  }

  /* ================= shared pieces ================= */
  const rk = t => t.rank ? `<i class="trk-rk">${t.rank}</i>` : '';
  const tmOf = (S, id) => id === 'h' || id === S.home.id ? S.home : S.away;
  const modelFor = S => { if (S.sport !== 'football' || !window.MODEL_FB || !window.MODEL_FB.games) return null; const opp = (S.us === 'home' ? S.away : S.home).name; return window.MODEL_FB.games.find(g => g.opp === opp) || null; };
  function teamRow(S, t) {
    const hasBall = S.state === 'in' && S.poss && S[S.poss] === t;
    return `<div class="trk-team${t.tn ? ' ut' : ''}${S.state === 'post' && t.winner ? ' won' : ''}"><span class="trk-dot" style="background:${esc(t.color)}"></span><span class="trk-nm">${rk(t)}${esc(t.name)}${hasBall ? '<i class="poss" title="Has the ball"></i>' : ''}<small>${esc(t.record)}</small></span><b class="trk-sc">${t.score}</b></div>`;
  }
  function head(S) {
    const live = S.state === 'in', fin = S.state === 'post', st = live ? `<span class="livedot"></span><b>LIVE</b> · ${esc(S.detail)}` : fin ? '<b>Final</b>' : `<b>${esc(S.detail || 'Upcoming')}</b>`;
    const sit = live && S.dd ? `<div class="trk-sit">${esc(S.dd)}${S.red ? ' · <b class="red">Red zone</b>' : ''}</div>` : '';
    return `<div class="trk-board"><div class="trk-st">${st}</div>${teamRow(S, S.away)}${teamRow(S, S.home)}${sit}<div class="trk-meta">${[S.tv, S.venue].filter(Boolean).map(esc).join(' · ')}</div></div>`;
  }
  const stickyBar = S => `${S.state === 'in' ? '<span class="livedot"></span>' : ''}<b>${esc(S.away.abbr)} ${S.away.score}</b> <span>·</span> <b>${esc(S.home.abbr)} ${S.home.score}</b> <em>${S.state === 'in' ? esc(S.detail) : S.state === 'post' ? 'Final' : esc(S.detail || 'Upcoming')}</em>`;
  const cdText = ms => `${Math.floor(ms / 864e5) ? Math.floor(ms / 864e5) + 'd ' : ''}${Math.floor(ms / 36e5) % 24}h ${String(Math.floor(ms / 6e4) % 60).padStart(2, '0')}m ${String(Math.floor(ms / 1e3) % 60).padStart(2, '0')}s`;
  function pregame(S) {
    const g = modelFor(S), ms = S.start ? new Date(S.start) - Date.now() : null;
    const when = S.start ? new Date(S.start).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : (S.date ? new Date(S.date + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : '');
    const what = S.sport === 'football' ? 'the field and every drive' : S.sport === 'mbb' || S.sport === 'wbb' ? 'the shot chart and every shot' : S.sport === 'baseball' || S.sport === 'softball' ? 'the diamond, the count and every at-bat' : 'every play';
    return `<div class="trk-card trk-pre"><div class="eyebrow">Pregame</div><h2>${esc(S.away.name)} at ${esc(S.home.name)}</h2><p class="dim">${esc(when)}${S.tv ? ' · ' + esc(S.tv) : ''}</p>
      ${ms > 0 ? `<div class="trk-cd" id="trkCd">${cdText(ms)}</div>` : ''}
      ${g ? `<div class="trk-model"><b>${Math.round(g.win * 100)}%</b> Tennessee win chance in our model · projected ${Math.round(g.ptsU)}–${Math.round(g.ptsO)}<br><a href="${href('football-schedule')}">See the full prediction and simulation ›</a></div>` : ''}
      <p class="dim small">This page switches to live play-by-play the moment the game starts: the score, ${what}. Keep it open and turn on score alerts below.</p></div>`;
  }
  function wpSvg(S, pre) {
    const w = S.wp.map(v => S.us === 'home' ? v : 100 - v), n = w.length; if (n < 2) return '';
    const W = 640, H = 190, px = i => 6 + (W - 12) * i / (n - 1), py = v => 8 + (H - 16) * (1 - v / 100);
    const line = 'M' + w.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join('L'), area = `${line}L${px(n - 1)},${py(50)}L${px(0)},${py(50)}Z`;
    let marks = '', q = 0; S.plays.forEach(p => { const j = S.wpIds.indexOf(p.id); if (j < 0) return;
      if (S.sport === 'football' && p.per > q && p.per <= 4) { q = p.per; if (q > 1) marks += `<line x1="${px(j)}" x2="${px(j)}" y1="8" y2="${H - 8}" stroke="var(--line-strong)" stroke-dasharray="3 4"/><text x="${px(j) + 4}" y="20" class="trk-q">Q${q}</text>`; }
      if (p.scoring) marks += `<circle cx="${px(j)}" cy="${py(w[j])}" r="4.5" fill="${ORANGE}" stroke="var(--surface)" stroke-width="1.5"/>`; });
    return `<div class="trk-wp"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Tennessee win probability over the game"><defs><clipPath id="wU"><rect x="0" y="0" width="${W}" height="${py(50)}"/></clipPath><clipPath id="wD"><rect x="0" y="${py(50)}" width="${W}" height="${H}"/></clipPath></defs>
      <line x1="6" x2="${W - 6}" y1="${py(50)}" y2="${py(50)}" stroke="var(--line-strong)"/>${pre != null ? `<line x1="6" x2="${W - 6}" y1="${py(pre)}" y2="${py(pre)}" stroke="var(--muted)" stroke-dasharray="5 5"/>` : ''}
      <path d="${area}" fill="${ORANGE}" opacity=".28" clip-path="url(#wU)"/><path d="${area}" fill="#777" opacity=".25" clip-path="url(#wD)"/>${marks}<path d="${line}" fill="none" stroke="${ORANGE}" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><div class="trk-wptip" id="trkWpTip" hidden></div></div>`;
  }
  const FILT = [['all', 'All plays'], ['score', 'Scoring'], ['big', 'Big plays'], ['tov', 'Turnovers'], ['ut', 'Tennessee']];
  const isBig = p => p.big || (S_isFb() && p.yds != null && p.yds >= 20 && /rush|run|pass|reception/i.test(p.type + ' ' + p.text)), isTov = p => /intercept|fumble|turnover|steal/i.test((p.type || '') + ' ' + p.text) && !/no turnover/i.test(p.text);
  const S_isFb = () => T && T.sport === 'football';
  function playsHtml(S) {
    if (!S.plays.length) return S.state === 'pre' ? '' : '<p class="dim">Plays will appear here as they happen.</p>';
    const me = S.us === 'home' ? S.home : S.away, ok = p => filter === 'all' || (filter === 'score' && p.scoring) || (filter === 'big' && isBig(p)) || (filter === 'tov' && isTov(p)) || (filter === 'ut' && p.team != null && tmOf(S, p.team) === me);
    const per = p => S.sport === 'baseball' || S.sport === 'softball' ? esc(p.clk) : (p.per ? (S.sport === 'football' ? (p.per > 4 ? 'OT' : 'Q' + p.per) : S.sport === 'mbb' || S.sport === 'wbb' ? 'H' + p.per : 'P' + p.per) : '') + ' ' + esc(p.clk);
    const row = p => `<li class="${p.scoring ? 'sc' : ''}${isTov(p) ? ' tov' : ''}${isBig(p) ? ' big' : ''}"><span class="trk-t">${per(p)}</span><span class="trk-x">${p.down ? `<small>${['', '1st', '2nd', '3rd', '4th'][p.down] || ''} &amp; ${p.dist}</small> ` : ''}${esc(p.text)}${p.scoring && p.hs != null ? ` <b class="trk-ss">${esc(S.away.abbr)} ${p.as} – ${esc(S.home.abbr)} ${p.hs}</b>` : ''}</span></li>`;
    if (S.drives.length) {
      const out = []; for (let di = S.drives.length - 1; di >= 0; di--) {
        const d = S.drives[di], ps = S.plays.filter(p => p.d === di && ok(p)); if (!ps.length) continue; const t = tmOf(S, d.team);
        out.push(`<div class="trk-drive${d.cur ? ' cur' : ''}"><div class="trk-dh" style="border-color:${esc(t.color)}"><b>${esc(t.name)}</b> <span>${d.n != null ? d.n + ' plays, ' : ''}${d.yds != null ? d.yds + ' yds' : ''}${d.top ? ', ' + esc(d.top) : ''}</span> <em class="${d.score ? 'tdp' : ''}">${d.cur ? 'In progress' : esc(d.result)}</em></div><ol>${ps.slice().reverse().map(row).join('')}</ol></div>`);
      } return out.join('') || '<p class="dim">No plays match this filter yet.</p>';
    }
    const ps = S.plays.filter(ok).slice(-120).reverse(); return ps.length ? `<ol class="trk-flat">${ps.map(row).join('')}</ol>` : '<p class="dim">No plays match this filter yet.</p>';
  }
  function statsHtml(S) {
    if (!S.stats.length) return '';
    return `<div class="trk-card"><h3>Team stats</h3><div class="trk-sh"><b style="color:${esc(S.away.color)}">${esc(S.away.abbr)}</b><b style="color:${esc(S.home.color)}">${esc(S.home.abbr)}</b></div>${S.stats.map(r => {
      const a = toSec(r.a), h = toSec(r.h), tot = (a || 0) + (h || 0), pa = tot > 0 && isFinite(a) && isFinite(h) ? Math.round(100 * a / tot) : 50;
      return `<div class="trk-sr"><span>${esc(r.a)}</span><div class="trk-bar"><i style="width:${pa}%;background:${esc(S.away.color)}"></i><i style="width:${100 - pa}%;background:${esc(S.home.color)}"></i></div><span>${esc(r.h)}</span><small>${esc(r.l)}</small></div>`; }).join('')}</div>`;
  }
  function lineHtml(S) {
    const n = Math.max(S.home.lines.length, S.away.lines.length); if (!n) return '';
    const h = Array.from({ length: n }, (_, i) => `<th class="n">${i + 1}</th>`).join(''), r = t => `<tr class="${t.tn ? 'me' : ''}"><td><b>${esc(t.abbr)}</b></td>${Array.from({ length: n }, (_, i) => `<td class="n">${esc(t.lines[i] ?? '')}</td>`).join('')}<td class="n"><b>${t.score}</b></td></tr>`;
    return `<div class="trk-card"><h3>Line score</h3><div class="tablewrap"><table class="lbx-line"><thead><tr><th></th>${h}<th class="n">T</th></tr></thead><tbody>${r(S.away)}${r(S.home)}</tbody></table></div></div>`;
  }
  const leadersHtml = S => S.leaders.length ? `<div class="trk-card"><h3>Leaders</h3><div class="tablewrap"><table><thead><tr><th>${esc(S.away.abbr)}</th><th></th><th>${esc(S.home.abbr)}</th></tr></thead><tbody>${S.leaders.map(r => `<tr><td>${r.away}</td><td class="dim small">${esc(r.l)}</td><td>${r.home}</td></tr>`).join('')}</tbody></table></div></div>` : '';

  /* ================= stages (each sport's picture) ================= */
  const STAGE = {};
  const chipHtml = (c, cls) => `<div class="trk-pl ${cls || ''}" style="--c:${esc(c.color)};left:${c.x0}%;top:${c.y0}%"><i>${esc(c.role)}</i><b><span class="f">${esc(c.name)}</span><span class="s">${esc(shortName(c.name))}</span></b></div>`;

  /* ---- football ---- */
  const FH = 520, FX = y => 100 + y * 10;
  STAGE.football = {
    html() {
      let s = `<svg class="trk-field" viewBox="0 0 1200 ${FH}" role="img" aria-label="Football field"><defs><linearGradient id="trkgrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E7D3B"/><stop offset="1" stop-color="#256B31"/></linearGradient></defs>
        <rect width="1200" height="${FH}" fill="url(#trkgrass)"/>`;
      for (let y = 0; y < 100; y += 10) s += `<rect x="${FX(y)}" y="0" width="100" height="${FH}" fill="#fff" opacity="${(y / 10) % 2 ? .035 : 0}"/>`;
      s += `<rect id="trkEzA" x="0" y="0" width="100" height="${FH}" fill="#555" opacity=".95"/><rect id="trkEzH" x="1100" y="0" width="100" height="${FH}" fill="#555" opacity=".95"/>
        <text id="trkEzAt" x="50" y="${FH / 2}" transform="rotate(-90 50 ${FH / 2})" text-anchor="middle" class="trk-ez"></text><text id="trkEzHt" x="1150" y="${FH / 2}" transform="rotate(90 1150 ${FH / 2})" text-anchor="middle" class="trk-ez"></text>`;
      for (let y = 0; y <= 100; y += 5) s += `<line x1="${FX(y)}" x2="${FX(y)}" y1="0" y2="${FH}" stroke="#fff" stroke-opacity="${y % 10 === 0 ? .75 : .3}" stroke-width="${y === 0 || y === 100 ? 5 : 2}"/>`;
      for (let y = 10; y <= 90; y += 10) { const n = y <= 50 ? y : 100 - y; s += `<text x="${FX(y)}" y="${FH - 22}" text-anchor="middle" class="trk-yd">${n}</text><text x="${FX(y)}" y="46" text-anchor="middle" class="trk-yd" transform="rotate(180 ${FX(y)} 34)">${n}</text>`; }
      for (let y = 1; y < 100; y++) if (y % 5) s += `<line x1="${FX(y)}" x2="${FX(y)}" y1="${FH / 2 - 40}" y2="${FH / 2 - 30}" stroke="#fff" stroke-opacity=".35"/><line x1="${FX(y)}" x2="${FX(y)}" y1="${FH / 2 + 30}" y2="${FH / 2 + 40}" stroke="#fff" stroke-opacity=".35"/>`;
      s += `<rect id="trkRed" x="0" y="0" width="0" height="${FH}" fill="#E0201B" opacity="0"/><rect id="trkTr" x="0" y="${FH / 2 - 22}" width="0" height="44" fill="#FF8200" opacity=".38" rx="8"/>
        <g id="trkLos" class="trk-mv"><line x1="0" x2="0" y1="0" y2="${FH}" stroke="#2F6BFF" stroke-width="5"/></g><g id="trkFd" class="trk-mv"><line x1="0" x2="0" y1="0" y2="${FH}" stroke="#FFD21F" stroke-width="6"/></g>
        <g id="trkBall" class="trk-mv"><ellipse cx="0" cy="${FH / 2}" rx="26" ry="15" fill="#7A3E12" stroke="#fff" stroke-width="3"/><path d="M-9 ${FH / 2}h18M-4 ${FH / 2 - 6}v12M0 ${FH / 2 - 6}v12M4 ${FH / 2 - 6}v12" stroke="#fff" stroke-width="2"/><path id="trkArrow" d="M30 ${FH / 2}l-12-11v22z" fill="#fff"/></g></svg>`;
      return `<div class="trk-fh"><span id="trkFieldTxt"></span><button type="button" class="trk-fs" id="trkExpand" aria-label="Make the field full screen">⤢ Full screen</button></div><div class="trk-vp" id="trkVp"><div class="trk-cam" id="trkCam">${s}<div class="trk-chips" id="trkChips"></div><div class="trk-flyball" id="trkFly"></div></div></div><div class="trk-last" id="trkLast"></div>`;
    },
    init() {
      const b = document.getElementById('trkExpand');
      b.addEventListener('click', () => { const c = document.getElementById('trkStage'), on = c.classList.toggle('trk-full'); document.body.classList.toggle('trk-lock', on); b.textContent = on ? '✕ Close' : '⤢ Full screen'; camSet(T.lastPos ?? 50); });
      window.addEventListener('resize', () => camSet(T && T.lastPos != null ? T.lastPos : 50));
    },
    update(S) {
      const live = S.state === 'in', fin = S.state === 'post', on = live && S.poss && S.ytg != null && isFinite(S.ytg);
      const ez = (id, tid, t) => { document.getElementById(id).setAttribute('fill', t.color); document.getElementById(tid).textContent = t.name.toUpperCase(); };
      ez('trkEzA', 'trkEzAt', S.home); ez('trkEzH', 'trkEzHt', S.away);            // home defends the left end zone and attacks right
      const ball = document.getElementById('trkBall'), los = document.getElementById('trkLos'), fd = document.getElementById('trkFd'), tr = document.getElementById('trkTr'), red = document.getElementById('trkRed');
      [ball, los, fd, tr, red].forEach(e => e.style.opacity = on ? '' : '0');
      let pos = T.lastPos != null ? T.lastPos : 50;
      if (on) {
        const right = S.poss === 'home'; pos = right ? 100 - S.ytg : S.ytg; const fdPos = right ? Math.min(100, pos + (S.dist || 0)) : Math.max(0, pos - (S.dist || 0)), x = FX(pos), o = S[S.poss];
        ball.style.transform = `translateX(${x}px)`; los.style.transform = `translateX(${x}px)`; fd.style.transform = `translateX(${FX(fdPos)}px)`; fd.style.opacity = S.down ? '' : '0';
        document.getElementById('trkArrow').setAttribute('d', right ? `M30 ${FH / 2}l-12-11v22z` : `M-30 ${FH / 2}l12-11v22z`);
        const lp0 = S.plays[S.plays.length - 1], dkey = (lp0 ? lp0.d : -1) + ':' + S.poss; if (!T.drive || T.drive.key !== dkey) T.drive = { key: dkey, pos };
        const a = FX(Math.min(pos, T.drive.pos)), b = FX(Math.max(pos, T.drive.pos)); tr.setAttribute('x', a); tr.setAttribute('width', Math.max(0, b - a)); tr.setAttribute('fill', o.color);
        red.setAttribute('x', right ? FX(80) : FX(0)); red.setAttribute('width', S.red ? 200 : 0); red.style.opacity = S.red ? '.18' : '0';
        const own = right ? pos : 100 - pos, opp = right ? S.away : S.home, d = own === 50 ? 'at midfield' : own < 50 ? 'at its own ' + own : 'at the ' + opp.abbr + ' ' + (100 - own);
        document.getElementById('trkFieldTxt').innerHTML = `<b>${esc(o.name)}</b> ball · ${esc(S.dd || '')} · ${d}`;
      } else document.getElementById('trkFieldTxt').textContent = fin ? 'Final' : 'Waiting for the next snap';
      T.lastPos = pos; camSet(pos);
      const lp = S.plays[S.plays.length - 1]; set('trkLast', lp ? `<b>Last play</b> ${esc(lp.text)}` : esc(S.last || ''));
      if (lp && lp.id !== T.animId) { T.animId = lp.id; animFootball(S, lp); }
    } };
  // the camera: the whole field on a wide screen, a window that follows the ball on a phone
  function camSet(pos) {
    const vp = document.getElementById('trkVp'), cam = document.getElementById('trkCam'), stg = document.getElementById('trkStage'); if (!vp || !cam || !stg) return;
    const full = stg.classList.contains('trk-full'), W = vp.clientWidth || 360, k = W < 720 ? 2.4 : 1, contentH = W * FH / 1200;
    cam.style.width = W + 'px'; cam.style.setProperty('--k', k);
    const h = full ? Math.max(260, window.innerHeight - 130) : (k > 1 ? Math.round(W * 0.74) : contentH); vp.style.height = h + 'px';
    const tx = k > 1 ? clamp(W / 2 - (FX(pos) / 1200) * W * k, -(k - 1) * W, 0) : 0, ty = (h - contentH * k) / 2;
    cam.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
  }
  // a play, acted out with the players named in it
  function animFootball(S, p) {
    const box = document.getElementById('trkChips'), fly = document.getElementById('trkFly'); if (!box) return;
    const w = whoIn(p.text), off = tmOf(S, p.team), def = off === S.home ? S.away : S.home, right = off === S.home;
    const sp = p.ytg != null ? (right ? 100 - p.ytg : p.ytg) : (T.lastPos != null ? T.lastPos : 50), ep = p.eytg != null ? (right ? 100 - p.eytg : p.eytg) : clamp(sp + (right ? 1 : -1) * (p.yds || 0), 0, 100);
    const dir = right ? 1 : -1, X = y => (FX(clamp(y, -9, 109)) / 1200) * 100, lane = (hash(p.id + 'a') % 40) + 30, lane2 = (hash(p.id + 'b') % 40) + 30, inc = /incomplete/i.test(p.text);
    const L = [], add = (name, role, color, x0, y0, x1, y1) => { if (name) L.push({ name, role, color, x0: X(x0), y0, x1: X(x1), y1 }); };
    if (w.passer) add(w.passer, 'QB', off.color, sp - 5 * dir, 50, w.sacker ? ep : sp - 6 * dir, 50);
    if (w.rusher) add(w.rusher, 'RB', off.color, sp - 4 * dir, 50, ep, lane);
    if (w.receiver) add(w.receiver, 'WR', off.color, sp + 1 * dir, lane2, inc ? sp + 12 * dir : ep, lane);
    (w.sacker || []).forEach((n, i) => add(n, 'DEF', def.color, sp + 3 * dir, 40 + i * 20, ep, 40 + i * 14));
    w.tacklers.forEach((n, i) => add(n, 'DEF', def.color, ep + 5 * dir, 30 + i * 35, ep + 1 * dir, lane + (i ? 14 : -14)));
    if (w.interceptor) add(w.interceptor, 'DEF', def.color, sp + 25 * dir, 50, ep, 50);
    if (w.kicker) add(w.kicker, 'K', off.color, sp - 7 * dir, 50, sp - 7 * dir, 50);
    if (w.returner) add(w.returner, 'RET', def.color, ep + 10 * dir, 50, ep, 50);
    box.innerHTML = L.map(c => chipHtml(c, '')).join('');
    const els = [...box.children]; if (!els.length) { fly.style.opacity = 0; return; }
    requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((el, i) => { el.classList.add('go'); el.style.left = L[i].x1 + '%'; el.style.top = L[i].y1 + '%'; })));
    if (w.passer && (w.receiver || w.interceptor) && !w.sacker) {
      const tgt = L.find(c => c.role === 'WR') || L.find(c => w.interceptor && c.name === w.interceptor);
      fly.style.transition = 'none'; fly.style.left = X(sp - 5 * dir) + '%'; fly.style.top = '50%'; fly.style.opacity = 1;
      requestAnimationFrame(() => requestAnimationFrame(() => { fly.style.transition = ''; fly.style.left = (tgt ? tgt.x1 : X(ep)) + '%'; fly.style.top = (tgt ? tgt.y1 : 50) + '%'; }));
    } else fly.style.opacity = 0;
  }

  /* ---- basketball ---- */
  STAGE.mbb = STAGE.wbb = {
    html() {
      const s = `<svg class="trk-court" viewBox="-10 -10 520 490" role="img" aria-label="Shot chart"><rect x="-10" y="-10" width="520" height="490" fill="#C98F55" rx="14"/><rect x="0" y="0" width="500" height="470" fill="#D9A56B" stroke="#fff" stroke-width="4"/>
        <rect x="170" y="0" width="160" height="190" fill="#B5471D" opacity=".45" stroke="#fff" stroke-width="3"/><circle cx="250" cy="190" r="60" fill="none" stroke="#fff" stroke-width="3"/>
        <path d="M30 0V141.9A237.5 237.5 0 0 0 470 141.9V0" fill="none" stroke="#fff" stroke-width="3"/><path d="M210 52.5A40 40 0 0 0 290 52.5" fill="none" stroke="#fff" stroke-width="3"/>
        <line x1="220" x2="280" y1="40" y2="40" stroke="#fff" stroke-width="5"/><circle cx="250" cy="52.5" r="9" fill="none" stroke="#FF5A1F" stroke-width="4"/>
        <g id="trkShots"></g><g id="trkLastShot"></g></svg>`;
      return `<div class="trk-fh"><span id="trkFieldTxt"></span></div><div class="trk-cw"><div class="trk-cc">${s}<div class="trk-chips" id="trkCt"></div></div><div class="trk-cs" id="trkCs"></div></div><div class="trk-last" id="trkLast"></div>`;
    },
    init() {},
    update(S) {
      const sh = S.shots || [], me = S.us === 'home' ? S.home : S.away, X = v => v * 10;
      document.getElementById('trkShots').innerHTML = sh.map(s => { const t = tmOf(S, s.team), c = t.tn ? ORANGE : t.color, x = X(s.x), y = X(s.y); return s.made ? `<circle cx="${x}" cy="${y}" r="9" fill="${c}" stroke="#fff" stroke-width="2.5"/>` : `<g stroke="${c}" stroke-width="3.5" opacity=".85"><path d="M${x - 6} ${y - 6}l12 12M${x + 6} ${y - 6}l-12 12"/></g>`; }).join('');
      const ls = sh[sh.length - 1], lg = document.getElementById('trkLastShot'), ct = document.getElementById('trkCt');
      if (ls && ls.id !== T.lastShotShown) {
        T.lastShotShown = ls.id; const t = tmOf(S, ls.team);
        lg.innerHTML = `<circle cx="${X(ls.x)}" cy="${X(ls.y)}" r="9" fill="none" stroke="#fff" stroke-width="4"><animate attributeName="r" from="9" to="40" dur="1.1s" repeatCount="3"/><animate attributeName="opacity" from="1" to="0" dur="1.1s" repeatCount="3"/></circle>`;
        if (ls.name) { const x0 = clamp((X(ls.x) + 10) / 520 * 100, 16, 84), y0 = clamp((X(ls.y) + 10) / 490 * 100 + 7, 8, 94); ct.innerHTML = chipHtml({ name: ls.name, role: ls.made ? (ls.three ? '3PT' : 'MADE') : 'MISS', color: t.tn ? ORANGE : t.color, x0, y0 }, 'static'); }
      }
      const own = sh.filter(s => tmOf(S, s.team) === me), opp = sh.filter(s => tmOf(S, s.team) !== me), f = a => `${a.filter(s => s.made).length}-${a.length}`, t3 = a => `${a.filter(s => s.made && s.three).length}-${a.filter(s => s.three).length}`;
      // the run: points in a row since the other team last scored
      let run = 0, who = null, prevH = 0, prevA = 0; const sc = [];
      S.plays.forEach(p => { if (p.hs == null) return; if (p.scoring) { const dh = p.hs - prevH, da = p.as - prevA; sc.push({ t: dh > 0 ? 'h' : 'a', n: Math.max(dh, da) }); } prevH = p.hs; prevA = p.as; });
      for (let i = sc.length - 1; i >= 0; i--) { if (who == null) who = sc[i].t; if (sc[i].t !== who) break; run += sc[i].n; }
      set('trkCs', `<div class="trk-cl"><span><i class="d" style="background:${ORANGE}"></i>Tennessee made</span><span><i class="x" style="color:${ORANGE}">✕</i>missed</span></div>
        <div class="trk-cs-row"><b>${esc(me.abbr)}</b> shooting <b>${f(own)}</b> (3-pt ${t3(own)})</div><div class="trk-cs-row"><b>${esc((me === S.home ? S.away : S.home).abbr)}</b> shooting <b>${f(opp)}</b> (3-pt ${t3(opp)})</div>
        ${run >= 6 && who ? `<div class="trk-run"><b>${run}-0 run</b> by ${esc(tmOf(S, who).name)}</div>` : ''}`);
      const lp = S.plays[S.plays.length - 1]; document.getElementById('trkFieldTxt').innerHTML = S.state === 'in' ? `<b>${esc(S.detail)}</b> · every shot this game` : 'Shot chart · every shot this game';
      set('trkLast', lp ? `<b>Last play</b> ${esc(lp.text)}` : '');
    } };

  /* ---- baseball and softball ---- */
  const SPOT = { 'left field': [130, 190], 'center field': [300, 100], 'right field': [470, 190], 'left center': [210, 130], 'right center': [390, 130], 'down the left field line': [70, 250], 'down the right field line': [530, 250],
    lf: [130, 190], cf: [300, 100], rf: [470, 190], ss: [232, 290], '3b': [170, 340], '2b': [368, 285], '1b': [430, 340], p: [300, 335], c: [300, 470], shortstop: [232, 290], 'third base': [170, 340], 'second base': [368, 285], 'first base': [430, 340], pitcher: [300, 335] };
  const BASE = { 1: [420, 310], 2: [300, 190], 3: [180, 310] };
  STAGE.baseball = STAGE.softball = {
    html() {
      return `<div class="trk-fh"><span id="trkFieldTxt"></span></div><div class="trk-dw"><div class="trk-dc"><svg class="trk-diamond" viewBox="0 0 600 500" role="img" aria-label="Baseball diamond"><rect width="600" height="500" fill="#1F6B31" rx="14"/>
        <path d="M300 470L30 200A380 380 0 0 1 570 200Z" fill="#2E8B3E"/><path d="M300 470L30 200A380 380 0 0 1 570 200Z" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>
        <path d="M300 460L452 310L300 160L148 310Z" fill="#B98B5A"/><path d="M300 442L436 308L300 174L164 308Z" fill="#2E8B3E"/><circle cx="300" cy="320" r="22" fill="#B98B5A"/><path d="M300 470L30 200M300 470L570 200" stroke="#fff" stroke-width="3"/>
        <g fill="#fff" stroke="#999" stroke-width="2"><rect id="trkB1" x="406" y="296" width="28" height="28" transform="rotate(45 420 310)"/><rect id="trkB2" x="286" y="176" width="28" height="28" transform="rotate(45 300 190)"/><rect id="trkB3" x="166" y="296" width="28" height="28" transform="rotate(45 180 310)"/></g>
        <path d="M300 456l14-10v-10h-28v10z" fill="#fff"/><g id="trkHit"></g></svg><div class="trk-chips" id="trkBd"></div></div>
        <div class="trk-ds" id="trkDs"></div></div><div class="trk-last" id="trkLast"></div>`;
    },
    init() {},
    update(S) {
      const b = S.bs || { outs: 0, on: [null, null, null] }, live = S.state === 'in';
      const bat = b.top ? S.away : S.home; [1, 2, 3].forEach(i => { const e = document.getElementById('trkB' + i), on = live && b.on[i - 1]; e.setAttribute('fill', on ? bat.color : '#fff'); e.setAttribute('stroke', on ? '#fff' : '#999'); });
      const bx = (x, y) => [(x / 600) * 100, (y / 500) * 100], chips = [];
      if (live) {
        if (b.pitcher) { const [x, y] = bx(300, 352); chips.push({ name: b.pitcher, role: 'P', color: b.top ? S.home.color : S.away.color, x0: x, y0: y }); }
        if (b.batter) { const [x, y] = bx(215, 445); chips.push({ name: b.batter, role: 'AB', color: b.top ? S.away.color : S.home.color, x0: x, y0: y }); }
        b.on.forEach((n, i) => { if (n && n !== '•') { const [x, y] = bx(BASE[i + 1][0], BASE[i + 1][1] - 34); chips.push({ name: n, role: ['1B', '2B', '3B'][i], color: bat.color, x0: x, y0: y }); } });
      }
      const sig = JSON.stringify(chips.map(c => c.name + c.role)); if (T.bdSig !== sig) { T.bdSig = sig; document.getElementById('trkBd').innerHTML = chips.map(c => chipHtml(c, 'static')).join(''); }
      const lp = S.plays[S.plays.length - 1], hit = document.getElementById('trkHit');
      if (lp && lp.id !== T.animId) {
        T.animId = lp.id; const txt = lp.text.toLowerCase();
        const m = /(?:to|down the) (left field line|right field line|left field|center field|right field|left center|right center|shortstop|third base|second base|first base|ss|3b|2b|1b|lf|cf|rf|pitcher|p|c)\b/.exec(txt);
        const loc = m && !/struck|walked|hit by pitch/.test(txt) ? SPOT[m[1] === 'left field line' ? 'down the left field line' : m[1] === 'right field line' ? 'down the right field line' : m[1]] : null;
        if (loc) {
          const hr = /homer/.test(txt), fly = /flied|lined|popped|homer|singled|doubled|tripled/.test(txt), c = /out/.test(txt) ? '#fff' : ORANGE, ty = hr ? loc[1] - 70 : loc[1];
          hit.innerHTML = `<path d="M300 456Q${(300 + loc[0]) / 2} ${fly ? Math.min(456, ty) - 90 : (456 + ty) / 2 + 10} ${loc[0]} ${ty}" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="7 7" opacity=".85"/><circle cx="${loc[0]}" cy="${ty}" r="10" fill="#fff" stroke="${c}" stroke-width="4"><animate attributeName="r" from="3" to="11" dur=".5s" fill="freeze"/></circle>${hr ? `<text x="${loc[0]}" y="${ty - 18}" text-anchor="middle" class="trk-hr">HOME RUN</text>` : ''}`;
        } else hit.innerHTML = '';
      }
      const dots = (n, max, c) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}" style="--c:${c}"></i>`).join(''), half = b.top ? '▲' : '▼';
      set('trkDs', `<div class="trk-count"><div class="trk-cnt"><span>Inning</span><b>${live ? `${half} ${esc(S.detail.replace(/^(Top|Bot|Mid|End)\s*/i, ''))}` : esc(S.detail)}</b></div>${live && b.balls != null ? `<div class="trk-cnt"><span>Balls</span><div>${dots(b.balls, 4, '#2E7D3B')}</div></div><div class="trk-cnt"><span>Strikes</span><div>${dots(b.strikes, 3, '#E0A21B')}</div></div>` : ''}${live && b.outs != null ? `<div class="trk-cnt"><span>Outs</span><div>${dots(b.outs, 3, '#E0201B')}</div></div>` : ''}</div>`);
      document.getElementById('trkFieldTxt').innerHTML = live ? `<b>${b.top ? esc(S.away.name) : esc(S.home.name)}</b> batting${b.batter ? ' · ' + esc(b.batter) + ' up' : ''}${b.pitcher ? ' against ' + esc(b.pitcher) : ''}` : S.state === 'post' ? 'Final' : 'Waiting for first pitch';
      set('trkLast', lp ? `<b>Last play</b> ${esc(lp.text)}` : '');
    } };
  const stageFor = k => STAGE[k] || null;

  /* ================= the page ================= */
  function chips(k) { const live = window.VI_LIVE || {}; return Object.keys(PATH).map(s => `<a class="trk-chip${s === k ? ' on' : ''}" href="${href('live-' + s)}${DEMO ? '?livedemo=1' : ''}">${live[s] && live[s].state === 'in' ? '<span class="livedot"></span>' : ''}${NAME[s]}</a>`).join(''); }
  function skeleton(el, k) {
    const st = stageFor(k);
    el.innerHTML = `<main class="trk" id="trk"><div class="trk-top"><h1>${DEMO ? 'Live game · demo' : 'Live game'}</h1><div class="trk-chips-nav">${chips(k)}</div></div>
      <div class="trk-sticky" id="trkSticky" hidden></div><div id="trkHead"></div><div id="trkToast" class="trk-toast" hidden></div>
      ${st ? `<div class="trk-card trk-stage" id="trkStage" hidden>${st.html()}</div>` : ''}
      <div id="trkPre"></div>
      <div class="trk-grid"><div class="trk-main">
        <div class="trk-card" id="trkWpCard" hidden><div class="trk-wh"><h3>Win probability</h3><div class="trk-wn"><b id="trkWpNow"></b><small id="trkWpPre"></small></div></div><div id="trkWpBox"></div></div>
        <div class="trk-card" id="trkPlayCard" hidden><div class="trk-ph"><h3>Play by play</h3><div class="trk-filt" id="trkFilt">${FILT.map(f => `<button type="button" data-f="${f[0]}" class="${f[0] === filter ? 'on' : ''}">${f[1]}</button>`).join('')}</div></div><div id="trkPlays"></div></div>
      </div><aside class="trk-side" id="trkSide"></aside></div>
      <div class="trk-foot"><div class="trk-tools"><button type="button" class="btn" id="trkAlerts"></button><button type="button" class="btn" id="trkWake">Keep screen on</button><button type="button" class="btn" id="trkShare">Share</button><a class="btn" id="trkEspn" target="_blank" rel="noopener" hidden>Open on ESPN ›</a></div>
      <p class="dim small" id="trkUpd"></p><p class="dim small">Scores, plays and win probability come from ESPN's public game feed and refresh every 10 seconds. Updates can lag the TV broadcast by a minute or two.${k === 'football' ? " Our model's pregame win chance is the dashed line on the chart." : ''}</p></div></main>`;
    if (st) st.init();
    document.getElementById('trkFilt').addEventListener('click', e => { const b = e.target.closest('button[data-f]'); if (!b) return; filter = b.dataset.f; document.querySelectorAll('#trkFilt button').forEach(x => x.classList.toggle('on', x === b)); paint(); });
    document.getElementById('trkAlerts').addEventListener('click', toggleAlerts); document.getElementById('trkWake').addEventListener('click', toggleWake); document.getElementById('trkShare').addEventListener('click', share);
    const box = document.getElementById('trkWpBox'); box.addEventListener('pointermove', wpTip); box.addEventListener('pointerleave', () => { const t = document.getElementById('trkWpTip'); if (t) t.hidden = true; });
    updAlertBtn();
    const sb = document.getElementById('trkSticky'), hd = document.getElementById('trkHead');
    if ('IntersectionObserver' in window) { T.io = new IntersectionObserver(es => { sb.hidden = es[0].isIntersecting || !T.S || T.S.state === 'pre'; }, { threshold: 0 }); T.io.observe(hd); }
  }
  function set(id, html, key) { const el = document.getElementById(id); if (!el) return; const h = key == null ? html : key; if (el.dataset.h !== String(h)) { el.dataset.h = h; el.innerHTML = html; } }
  function paint() {
    const S = T && T.S, root = document.getElementById('trk'); if (!root) return;
    if (!S) { set('trkHead', `<div class="trk-card"><h2>No ${esc(NAME[T.sport])} game to follow right now</h2><p class="dim">Pick another sport above, or check the schedule.</p></div>`); return; }
    const live = S.state === 'in', fin = S.state === 'post';
    set('trkHead', head(S)); const sb = document.getElementById('trkSticky'); if (sb) sb.innerHTML = stickyBar(S);
    document.getElementById('trkPre').innerHTML = S.state === 'pre' ? pregame(S) : '';
    const stg = document.getElementById('trkStage'), st = stageFor(S.sport);
    if (stg && st) { const wasHidden = stg.hidden; stg.hidden = !(live || (fin && S.plays.length)); if (!stg.hidden) { st.update(S); if (wasHidden && S.sport === 'football') camSet(T.lastPos != null ? T.lastPos : 50); } }
    const wc = document.getElementById('trkWpCard'), g = modelFor(S), pre = g ? Math.round(g.win * 100) : null;
    wc.hidden = !(S.wp.length > 1); if (!wc.hidden) {
      set('trkWpBox', wpSvg(S, pre), S.wp.length + ':' + S.wp[S.wp.length - 1]);
      const v = S.wp[S.wp.length - 1], ut = Math.round(S.us === 'home' ? v : 100 - v); document.getElementById('trkWpNow').textContent = ut + '%'; document.getElementById('trkWpPre').textContent = (pre != null ? `Tennessee · our pregame model ${pre}%` : 'Tennessee') + (S.demo ? '' : ' · ESPN live');
    }
    const pc = document.getElementById('trkPlayCard'); pc.hidden = !S.plays.length;
    if (S.plays.length) set('trkPlays', playsHtml(S), S.plays.length + ':' + filter + ':' + S.state + ':' + (S.plays[S.plays.length - 1].text || '').length);
    set('trkSide', lineHtml(S) + statsHtml(S) + leadersHtml(S) + (S.state === 'pre' || S.sport !== 'football' ? '' : `<div class="trk-card trk-links"><a href="${href('football-schedule')}">Our prediction for this game ›</a></div>`), JSON.stringify([S.home.score, S.away.score, S.stats.length && S.stats[0].a, S.state, S.leaders.length, S.home.lines.join(',')]));
    const es = document.getElementById('trkEspn'); if (es && S.id) { es.href = `https://www.espn.com/${S.sport === 'football' ? 'college-football' : S.sport === 'mbb' ? 'mens-college-basketball' : S.sport === 'wbb' ? 'womens-college-basketball' : 'college-' + S.sport}/game/_/gameId/${S.id}`; es.hidden = !!S.demo; }
    const sc = S.plays.filter(p => p.scoring);
    if (first) { sc.forEach(p => seen.add(p.id)); first = false; } else sc.forEach(p => { if (seen.has(p.id)) return; seen.add(p.id); celebrate(S, p); });
    updUpd();
  }
  function celebrate(S, p) {
    const el = document.getElementById('trkToast'), mine = p.team != null && tmOf(S, p.team).tn, bb = S.sport === 'mbb' || S.sport === 'wbb';
    const big = /touchdown/i.test(p.text + p.type) ? 'TOUCHDOWN' : /field goal/i.test(p.text + p.type) ? 'FIELD GOAL' : /homer/i.test(p.text) ? 'HOME RUN' : /three point/i.test(p.text) ? 'THREE!' : 'SCORE';
    if (el && (!bb || big === 'THREE!')) { el.className = 'trk-toast ' + (mine ? 'ut' : 'opp'); el.innerHTML = `<b>${big}</b> ${esc(p.text)}`; el.hidden = false; clearTimeout(T.toast); T.toast = setTimeout(() => { el.hidden = true; }, 6000); }
    if (alerts) { try { if (navigator.vibrate) navigator.vibrate(mine ? [120, 60, 120] : 60); } catch (e) {} try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(`${S.away.abbr} ${S.away.score}, ${S.home.abbr} ${S.home.score}`, { body: p.text, icon: 'assets/icons/icon-192.png' }); } catch (e) {} }
  }
  function updAlertBtn() { const b = document.getElementById('trkAlerts'); if (!b) return; b.textContent = alerts ? 'Score alerts: on' : 'Turn on score alerts'; b.classList.toggle('primary', alerts); }
  async function toggleAlerts() {
    if (!alerts) { try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) { } alerts = true; } else alerts = false;
    LS.set('vi-trk-alerts', alerts ? '1' : '0'); updAlertBtn();
    const u = document.getElementById('trkUpd'); if (u && alerts) u.dataset.note = ('Notification' in window && Notification.permission === 'granted') ? 'Alerts buzz your phone and notify you while this page is open in the background.' : 'Alerts vibrate your phone and flash on screen while this page is open. Allow notifications in your browser to get them in the background.';
  }
  async function toggleWake() {
    const b = document.getElementById('trkWake'); if (!('wakeLock' in navigator)) { b.textContent = 'Not supported on this browser'; return; }
    try { if (wake) { await wake.release(); wake = null; b.textContent = 'Keep screen on'; b.classList.remove('primary'); } else { wake = await navigator.wakeLock.request('screen'); b.textContent = 'Screen stays on'; b.classList.add('primary'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { b.textContent = "Couldn't keep screen on"; }
  }
  async function share() {
    const S = T.S, u = location.origin + location.pathname, t = S ? `${S.away.abbr} ${S.away.score}, ${S.home.abbr} ${S.home.score} — follow live on The Vol Index` : 'Follow Tennessee live on The Vol Index';
    try { if (navigator.share) await navigator.share({ title: 'Vol Index live game', text: t, url: u }); else { await navigator.clipboard.writeText(u); document.getElementById('trkShare').textContent = 'Link copied'; } } catch (e) { }
  }
  function wpTip(e) {
    const S = T.S, box = document.getElementById('trkWpBox'), tip = document.getElementById('trkWpTip'); if (!S || !tip || S.wp.length < 2) return;
    const r = box.getBoundingClientRect(), f = clamp((e.clientX - r.left) / r.width, 0, 1), i = Math.round(f * (S.wp.length - 1)), p = S.plays.find(x => x.id === S.wpIds[i]), v = S.wp[i], ut = Math.round(S.us === 'home' ? v : 100 - v);
    tip.hidden = false; tip.style.left = clamp(f * r.width - 80, 0, r.width - 170) + 'px'; tip.innerHTML = `<b>${ut}%</b> ${p ? esc(p.text).slice(0, 110) : ''}`;
  }
  function updUpd() {
    const u = document.getElementById('trkUpd'); if (!u || !T) return; const s = Math.round((Date.now() - T.at) / 1000);
    u.textContent = (T.S && T.S.state === 'in' ? `Updated ${s} second${s === 1 ? '' : 's'} ago.` : T.S && T.S.state === 'post' ? 'Final.' : '') + (u.dataset.note ? ' ' + u.dataset.note : '');
    const cd = document.getElementById('trkCd'); if (cd && T.S && T.S.start) { const ms = new Date(T.S.start) - Date.now(); if (ms > 0) cd.textContent = cdText(ms); }
  }
  function stop() { if (!T) return; clearTimeout(T.timer); clearInterval(T.tick); if (T.io) T.io.disconnect(); T = null; document.body.classList.remove('trk-on', 'trk-lock'); if (wake) { try { wake.release(); } catch (e) { } wake = null; } }
  window.renderTracker = function (app, want) {
    stop(); const k = pickSport(want); first = true; seen = new Set(); filter = 'all';
    T = { sport: k, at: Date.now() }; document.body.classList.add('trk-on'); skeleton(app, k);
    T.tick = setInterval(updUpd, 1000); load();
  };
  window.addEventListener('vi:route', () => { const key = window.VI_ROUTER ? window.VI_ROUTER.key() : (location.hash || '').slice(1); if (T && !/^live(-|$)/.test(key)) stop(); });
  document.addEventListener('visibilitychange', () => { if (T && !document.hidden) { load(); if (wake === null && document.getElementById('trkWake') && document.getElementById('trkWake').classList.contains('primary')) toggleWake(); } });
})();
