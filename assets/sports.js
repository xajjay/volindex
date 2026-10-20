/* The Vol Index — shared team page for volleyball, soccer, basketball, baseball and softball.
   Data: data/<sport>.js (window.SITE[sport]) + editable data/<sport>-lineup.js (window.LINEUP[sport]). */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const fmtDate = (iso, o) => { if (!iso) return 'TBA'; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-US', o || { weekday: 'short', month: 'short', day: 'numeric' }); };
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // Eastern time
  const COLS = { num: '#', name: 'Name', pos: 'Pos', rate: 'Rating', bt: 'B/T', ht: 'Ht', wt: 'Wt', cls: 'Class', home: 'Hometown', hs: 'High school', prev: 'Previous school', note: 'Notes' };
  const HIDE_SM = new Set(['bt', 'wt', 'home', 'hs', 'prev', 'note']);

  let S, key, lineup, editing = false, rosterQ = '';
  const LKEY = k => 'vi-lineup-' + k + '-v1';

  const NO_REVIEW = new Set(['volleyball', 'soccer', 'mbb', 'wbb']); // last-season review tab removed for these
  function tabs(D) {
    const t = [['overview', 'Overview'], ['schedule', 'Schedule & Standings'], ['roster', 'Roster'], ['lineup', D.lineupTab || (D.key === 'baseball' || D.key === 'softball' ? 'Projected Lineup' : 'Projected Starters')]];
    if (D.stats || D.statsAuto) t.push(['stats', 'Stats']);
    return t.concat(X(D).advanced ? [['advanced', 'Advanced']] : [['ratings', 'Rankings & Ratings']], [['recruiting', 'Recruiting'], ...(NO_REVIEW.has(D.key) ? [] : [['review', D.prevLabel + ' Review']]), ['moves', 'Roster Moves'], ['history', 'History'], ['media', 'Social & Media']]);
  }
  function header(D, tab) {
    return `<div class="teamhead"><div class="wrap">
      <div><div class="eyebrow">Tennessee Volunteers · SEC · ${esc(D.season)}</div><h1>${esc(D.name)}</h1></div>
      <div class="scoreline" aria-label="Snapshot">${D.header.map(h => `<div><b>${esc(h[0])}</b><small>${esc(h[1])}</small></div>`).join('')}</div>
      <nav class="tabs" aria-label="${esc(D.name)} sections">${tabs(D).map(([k, l]) => `<a href="#${D.key}-${k}" aria-current="${k === tab ? 'page' : 'false'}">${esc(l)}</a>`).join('')}</nav>
    </div></div><div class="checker" aria-hidden="true"></div>`;
  }
  function footer(D) {
    return `<footer><div class="wrap">Data gathered ${fmtDate(window.lastUpdated ? window.lastUpdated(D.key) : D.updated, { month: 'long', day: 'numeric', year: 'numeric' })}. Sources:
      <ul>${D.sources.map(s => `<li>${esc(s[0])}: <a href="${s[2]}" target="_blank" rel="noopener">${esc(s[1])}</a></li>`).join('')}</ul>
      Fan site, not affiliated with the University of Tennessee.</div></footer>`;
  }
  const vsat = g => g.site === 'H' ? 'vs' : g.site === 'A' ? 'at' : 'vs';
  const kindChip = g => g.kind === 'exh' ? '<span class="chip">Exhibition</span>' : g.kind === 'conf' ? '<span class="chip">SEC</span>' : g.kind === 'event' ? '<span class="chip new">Event</span>' : '';
  const nextGame = D => D.schedule.find(g => !g.result && g.date >= today()) || null;
  window.sportNext = k => (window.SITE && window.SITE[k]) ? nextGame(applyAuto(window.SITE[k])) : null;
  const resStr = g => g.result ? `<span class="${g.result}">${g.result}</span>${g.us != null ? ' ' + g.us + '–' + g.them : ''}` : '';
  // header record (and the overview's record sentence) from the schedule
  function setRecord(D) {
    const real = D.schedule.filter(g => g.result && g.kind !== 'exh');
    const rec = arr => { const w = arr.filter(g => g.result === 'W').length, l = arr.filter(g => g.result === 'L').length, t = arr.filter(g => g.result === 'T').length; return `${w}-${l}${t ? '-' + t : ''}`; };
    if (!real.length) return;
    D.header = D.header.map(h => /record/i.test(h[1]) && (!/^\d{4}/.test(h[1]) || h[1].startsWith(D.season)) ? [rec(real), h[1]] : h[1] === 'SEC' ? [rec(real.filter(g => g.kind === 'conf')), 'SEC'] : h);
    D.inSeason = true;
    const sec = rec(real.filter(g => g.kind === 'conf'));
    if (D.quick && D.quick[0]) D.quick = [D.quick[0].replace(/<b>\d+-\d+(?:-\d+)?<\/b>( \(\d+-\d+(?:-\d+)? SEC\))?/, `<b>${rec(real)}</b> (${sec} SEC)`)].concat(D.quick.slice(1));
  }
  // a final from the live scoreboard (assets/live.js): show the result and new record right away,
  // before the data update lands. Returns true when something changed.
  window.sportFinal = function (k, date, result, us, them) {
    const D = applyAuto(window.SITE && window.SITE[k]); if (!D) return false;
    const g = D.schedule.find(x => x.date === date && !x.result && x.kind !== 'event'); if (!g) return false;
    Object.assign(g, { result, us: +us, them: +them, liveFinal: true });
    setRecord(D); return true;
  };
  /* ---------- auto data (data/<sport>-auto.js from tools/update_sports.py) ---------- */
  const merged = new Set();
  function applyAuto(D) {
    if (!D || merged.has(D.key)) return D; merged.add(D.key);
    const A = window.SITE_AUTO && window.SITE_AUTO[D.key];
    D.histGames = (window.SITE_AUTO && window.SITE_AUTO[D.key + 'History']) || null;
    if (!A) return D;
    try {
      if (A.schedule && A.schedule.length && A.season === D.season) {
        const oldByDate = new Map(D.schedule.map(g => [g.date + '|' + g.opp.replace(/ \(.*\)$/, ''), g]));
        D.schedule = A.schedule.map(g => {
          const old = oldByDate.get(g.date + '|' + g.opp) || {};
          return Object.assign({}, old, {
            date: g.date, opp: g.opp.replace(/\s*\((Exh\.?|Exhibition|Scrimmage)\)/i, ''), site: g.site, loc: g.loc || old.loc, tv: g.tv || old.tv || null,
            time: g.time && !/TBD|TBA/i.test(g.time) ? g.time.replace(/ ?ET$/i, '').replace(/\./g, '').replace(/ ?pm$/i, ' PM').replace(/ ?am$/i, ' AM') : old.time || null,
            kind: g.exh || /\((Exh|Exhibition|Scrimmage)/i.test(g.opp) || /^(E|S)$/.test(g.type || '') ? 'exh' : g.conf ? 'conf' : (old.kind === 'exh' ? 'nonconf' : old.kind || 'nonconf'),
            result: g.result || null, us: g.us != null ? +g.us : null, them: g.them != null ? +g.them : null,
            gid: g.id, hasBox: !!(A.box && A.box[String(g.id)]), watch: g.watch, live: g.live, event: g.tournament, note: g.note,
          });
        });
        setRecord(D);
      }
      if (A.stats) D.statsAuto = A.stats;
      if (A.box) D.box = A.box;
      { const yr = parseInt(D.season, 10), st = /baseball|softball/.test(D.key) ? `${yr}-01-01` : `${yr}-08-01`;
        if (A.rpi && A.rpi.date && A.rpi.date >= st) D.rpiAuto = A.rpi;
        if (A.poll && A.poll.date && A.poll.date >= st) D.pollCur = A.poll; }
      if (A.series) D.series = A.series;
      if (A.poll) {
        D.pollAuto = A.poll;
        const yr = parseInt(D.season, 10), start = /baseball|softball/.test(D.key) ? `${yr}-01-01` : `${yr}-08-01`;
        if (A.poll.date && A.poll.date >= start) {
          const i = D.header.findIndex(h => /AVCA|Soccer Coaches|AP Top|poll/i.test(h[1]));
          const label = `${A.poll.poll} (${fmtDate(A.poll.date, { month: 'short', day: 'numeric' })})`;
          const val = typeof A.poll.rank === 'number' ? 'No. ' + A.poll.rank : 'NR';
          if (i >= 0) D.header[i] = [val, label]; else D.header.unshift([val, label]);
        }
      }
      if (A.updated) D.updated = A.updated > (D.updated || '') ? A.updated : D.updated;
    } catch (e) { console.warn('Auto data skipped for ' + D.key, e); }
    return D;
  }
  window.sportData = k => applyAuto(window.SITE && window.SITE[k]);

  /* ---------- stat definitions per sport: [category, table, [[label, field], ...], default sort field] ---------- */
  const BB = [
    ['Scoring', 'individualStats', [['GP', 'gamesPlayed'], ['GS', 'gamesStarted'], ['MIN', 'minutesPerGame'], ['PTS', 'points'], ['PPG', 'pointsPerGame'], ['FG%', 'fieldGoalsPercentage'], ['3PM', 'threePointFieldGoals'], ['3P%', 'threePointFieldGoalsPercentage'], ['FT%', 'freeThrowsPercentage'], ['High', 'highestPoints']], 'pointsPerGame'],
    ['Rebounding', 'individualStats', [['GP', 'gamesPlayed'], ['REB', 'rebounds'], ['RPG', 'reboundsPerGame'], ['OREB', 'reboundsOffensive'], ['DREB', 'reboundsDefensive']], 'reboundsPerGame'],
    ['Playmaking', 'individualStats', [['GP', 'gamesPlayed'], ['AST', 'assists'], ['APG', 'assistsPerGame'], ['TO', 'turnovers'], ['A/TO', 'assistOverTurnovers']], 'assistsPerGame'],
    ['Defense', 'individualStats', [['GP', 'gamesPlayed'], ['STL', 'steals'], ['SPG', 'stealsPerGame'], ['BLK', 'blocks'], ['BPG', 'blocksPerGame'], ['PF', 'personalFouls']], 'steals'],
  ];
  const DIA = [
    ['Hitting', 'individualStats.individualHittingStats', [['G', 'gamesPlayed'], ['AB', 'atBats'], ['R', 'runs'], ['H', 'hits'], ['2B', 'doubles'], ['HR', 'homeRuns'], ['RBI', 'runsBattedIn'], ['BB', 'walks'], ['SO', 'strikeouts'], ['SB', 'stolenBases'], ['AVG', 'battingAverage'], ['OBP', 'onBasePercentage'], ['SLG', 'sluggingPercentage'], ['OPS', 'ops']], 'ops'],
    ['Pitching', 'individualStats.individualPitchingStats', [['APP', 'appearances'], ['GS', 'gamesStarted'], ['W', 'wins'], ['L', 'losses'], ['SV', 'saves'], ['IP', 'inningsPitched'], ['H', 'hitsAllowed'], ['ER', 'earnedRunsAllowed'], ['BB', 'walksAllowed'], ['SO', 'strikeouts'], ['ERA', 'earnedRunAverage'], ['WHIP', 'whip'], ['OBA', 'opponentsBattingAverage']], 'inningsPitched'],
    ['Fielding', 'individualStats.individualFieldingStats', [['G', 'gamesPlayed'], ['TC', 'totalChances'], ['PO', 'putouts'], ['A', 'assists'], ['E', 'errors'], ['FLD%', 'fieldingPercentage'], ['SB-ATT', 'stolenBasesAgainst'], ['CS', 'caughtStealingBy']], 'totalChances'],
  ];
  const STATCFG = {
    volleyball: [
      ['Attacking', 'individualStats', [['SP', 'setsPlayed'], ['K', 'attackStatsKills'], ['K/S', 'attackStatsKillsPerSet'], ['E', 'attackStatsErrors'], ['TA', 'attackStatsTotalAttempts'], ['PCT', 'attackStatsHittingPercentage']], 'attackStatsKills'],
      ['Setting', 'individualStats', [['SP', 'setsPlayed'], ['A', 'setStatsAssists'], ['A/S', 'setStatsAssistsPerSet'], ['Errors', 'setStatsSetErrors']], 'setStatsAssists'],
      ['Serving', 'individualStats', [['SP', 'setsPlayed'], ['Aces', 'serveStatsServiceAces'], ['Aces/S', 'serveStatsServiceAcesPerSet'], ['Errors', 'serveStatsServiceErrors'], ['Attempts', 'serveStatsTotalServeAttempts']], 'serveStatsServiceAces'],
      ['Defense', 'individualStats', [['SP', 'setsPlayed'], ['Digs', 'defenseStatsDigs'], ['Digs/S', 'defenseStatsDigsPerSet'], ['Rec. err', 'defenseStatsReceptionErrors'], ['Rec. %', 'defenseStatsReceptionPercentage']], 'defenseStatsDigs'],
      ['Blocking', 'individualStats', [['SP', 'setsPlayed'], ['Solo', 'blockStatsSolos'], ['Assist', 'blockStatsAssists'], ['Total', 'blockStatsTotalBlocks'], ['Blk/S', 'blockStatsBlocksPerSet']], 'blockStatsTotalBlocks'],
      ['Points', 'individualStats', [['SP', 'setsPlayed'], ['PTS', 'miscStatsPoints'], ['PTS/S', 'miscStatsPointsPerSet']], 'miscStatsPoints'],
    ],
    soccer: [
      ['Scoring', 'individualOffensiveStats', [['GP', 'gamesPlayed'], ['GS', 'gamesStarted'], ['MIN', 'minutesPlayed'], ['G', 'goals'], ['A', 'assists'], ['PTS', 'points'], ['GW', 'gameWinners'], ['PK', 'penaltyKicksAndAttempts']], 'points'],
      ['Shooting', 'individualOffensiveStats', [['GP', 'gamesPlayed'], ['SH', 'shots'], ['SOG', 'shotsOnGoal'], ['SOG%', 'shotsOnGoalPercentage'], ['SH%', 'shotPercentage'], ['YC-RC', 'yellowCardsRedCards']], 'shots'],
      ['Goalkeeping', 'goalieStats', [['GP', 'gamesPlayed'], ['MIN', 'minutesPlayed'], ['GA', 'goalsAllowed'], ['GAA', 'goalsAgainstAverage'], ['SV', 'saves'], ['SV%', 'savesPercentage'], ['W', 'wins'], ['L', 'losses'], ['T', 'ties'], ['SHO', 'shutouts']], 'minutesPlayed'],
    ],
    mbb: BB, wbb: BB, baseball: DIA, softball: DIA,
  };
  // what an "impact player" is per sport: [label, table, field, unit]
  const IMPACT = {
    volleyball: [['Kills', 'individualStats', 'attackStatsKills', 'kills'], ['Assists', 'individualStats', 'setStatsAssists', 'assists'], ['Digs', 'individualStats', 'defenseStatsDigs', 'digs'], ['Blocks', 'individualStats', 'blockStatsTotalBlocks', 'blocks'], ['Aces', 'individualStats', 'serveStatsServiceAces', 'aces']],
    soccer: [['Goals', 'individualOffensiveStats', 'goals', 'goals'], ['Assists', 'individualOffensiveStats', 'assists', 'assists'], ['Shots', 'individualOffensiveStats', 'shotsOnGoal', 'shots on goal'], ['Saves', 'goalieStats', 'saves', 'saves']],
    mbb: [['Points', 'individualStats', 'pointsPerGame', 'ppg'], ['Rebounds', 'individualStats', 'reboundsPerGame', 'rpg'], ['Assists', 'individualStats', 'assistsPerGame', 'apg'], ['Steals', 'individualStats', 'steals', 'steals'], ['Blocks', 'individualStats', 'blocks', 'blocks']],
    baseball: [['Home runs', 'individualStats.individualHittingStats', 'homeRuns', 'HR'], ['RBI', 'individualStats.individualHittingStats', 'runsBattedIn', 'RBI'], ['OPS', 'individualStats.individualHittingStats', 'ops', 'OPS'], ['Strikeouts', 'individualStats.individualPitchingStats', 'strikeouts', 'K'], ['Innings', 'individualStats.individualPitchingStats', 'inningsPitched', 'IP']],
  };
  IMPACT.wbb = IMPACT.mbb; IMPACT.softball = IMPACT.baseball;
  const numv = v => { if (v == null || v === '') return null; const m = String(v).match(/-?\d*\.?\d+/); return m ? parseFloat(m[0]) : null; };
  const human = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace(/ Pct$/, ' %').replace(/ Per /g, ' per ').trim();
  const tableRows = (D, table) => ((D.statsAuto && D.statsAuto.tables) || {})[table] || [];
  function leadersOf(D, n = 1) {
    return (IMPACT[D.key] || []).map(([label, table, field, unit]) => {
      const rows = tableRows(D, table).filter(r => numv(r.s[field]) > 0).sort((a, b) => numv(b.s[field]) - numv(a.s[field]));
      return rows.slice(0, n).map(r => ({ label, name: r.name, val: r.s[field], unit }));
    }).flat();
  }
  /* ---------- stats (auto) ---------- */
  let sCat = 0, sView = 'player', sQ = '', sSort = null;
  function statsAuto(D) {
    const S = D.statsAuto;
    const label = S.season === D.season ? `${D.season} Stats` : `${S.season} Stats`;
    const note = S.season === D.season ? `Every Vol with a stat this season${S.record ? ' (' + esc(S.record) + ')' : ''}. Click a column to sort.` : `The ${esc(D.season)} season hasn't started, so these are last season's numbers. They switch to ${esc(D.season)} automatically after the first game.`;
    return `<div class="panel-head"><div><h2>${esc(label)}</h2><p>${note}</p></div>
      <div class="controls"><div class="seg" role="group" aria-label="Stats view">${[['player', 'Player stats'], ['team', 'Team stats']].map(([k, l]) => `<button data-sv="${k}" aria-pressed="${sView === k}">${l}</button>`).join('')}</div></div></div>
      <div id="sStats"></div>
      <p class="dim small">Stats: <a href="https://utsports.com/sports/${esc(SLUG[D.key])}/stats/${esc(S.season)}" target="_blank" rel="noopener">utsports.com cumulative stats</a>.</p>`;
  }
  const SLUG = { volleyball: 'womens-volleyball', soccer: 'womens-soccer', mbb: 'mens-basketball', wbb: 'womens-basketball', baseball: 'baseball', softball: 'softball' };
  function playerTable(D) {
    const cfg = STATCFG[D.key] || []; const c = cfg[sCat] || cfg[0]; if (!c) return '';
    const [, table, cols, def] = c; const q = sQ.toLowerCase();
    let rows = tableRows(D, table).filter(r => cols.some(([, f]) => numv(r.s[f]) && !/^(gamesPlayed|setsPlayed|appearances)$/.test(f)) && (!q || r.name.toLowerCase().includes(q)));
    const si = sSort && sSort.cat === sCat ? sSort.f : def, dir = sSort && sSort.cat === sCat ? sSort.dir : -1;
    const low = /earnedRunAverage|whip|opponentsBattingAverage|goalsAgainstAverage|errors|turnovers/i.test(si);
    // rate stats (AVG, ERA, PCT, FG% ...) only rank players with enough volume; the rest sort after them
    const VOL = { Hitting: 'atBats', Pitching: 'inningsPitched', Fielding: 'totalChances', Attacking: 'attackStatsTotalAttempts', Shooting: 'shots', Goalkeeping: 'minutesPlayed', Scoring: D.key === 'soccer' ? 'minutesPlayed' : 'gamesPlayed' };
    const vf = VOL[c[0]] || cols[0][1]; const maxV = Math.max(1, ...rows.map(r => numv(r.s[vf]) || 0));
    const isRate = rows.some(r => /^-?\d*\.\d+$/.test(String(r.s[si] || '')) && String(r.s[si]).startsWith('.')) || /Percentage|Average|whip|ops|PerGame|PerSet/i.test(si);
    const qual = r => !isRate || (numv(r.s[vf]) || 0) >= maxV * 0.25;
    rows.sort((a, b) => (qual(b) - qual(a)) || (si === 'name' ? dir * a.name.localeCompare(b.name) : (low && !sSort ? 1 : dir) * ((numv(a.s[si]) ?? -1e9) - (numv(b.s[si]) ?? -1e9))));
    const roster = new Map(D.roster.map(p => [p.name.toLowerCase(), p]));
    return `<div class="tablewrap"><table><thead><tr><th><button data-ss="name">Player</button></th>${cols.map(([l, f]) => `<th class="n"><button data-ss="${f}">${esc(l)}${si === f ? (dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => { const p = roster.get(r.name.toLowerCase()); return `<tr class="${qual(r) ? '' : 'unq'}" title="${qual(r) ? '' : 'Below the playing-time minimum for rate-stat rankings'}"><td>${p ? `<a href="#" data-sp="${esc(p.name)}"><b>${esc(r.name)}</b></a>` : `<b>${esc(r.name)}</b>`} <span class="dim small">${p ? esc(p.pos + ' · ' + p.cls) : r.num ? '#' + esc(r.num) : ''}</span></td>${cols.map(([, f]) => `<td class="n">${esc(r.s[f] ?? '—')}</td>`).join('')}</tr>`; }).join('') || `<tr><td colspan="${cols.length + 1}">No players match.</td></tr>`}</tbody></table></div>`;
  }
  function teamTable(D) {
    const T = D.statsAuto.team || {}; const us = T.us || {}, op = T.opp || {};
    const keys = Object.keys(us).filter(k => k in op && !/Attendance|Streak|HomeGames|DatesAndAverage|^TotalScoringConf/i.test(k));
    return `<div class="tablewrap"><table class="mini"><thead><tr><th>Stat</th><th class="n">Tennessee</th><th class="n">Opponents</th></tr></thead>
      <tbody>${keys.map(k => { const a = numv(us[k]), b = numv(op[k]); return `<tr><td>${esc(human(k))}</td><td class="n"><b>${esc(us[k])}</b></td><td class="n">${esc(op[k])}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function wireStatsAuto(D) {
    const draw = () => {
      const box = $('#sStats');
      if (sView === 'team') { box.innerHTML = teamTable(D); return; }
      const cfg = STATCFG[D.key] || [];
      box.innerHTML = `<div class="controls" style="margin-bottom:12px"><div class="seg" role="group" aria-label="Stat category">${cfg.map((c, i) => `<button data-sc="${i}" aria-pressed="${i === sCat}">${esc(c[0])}</button>`).join('')}</div>
        <input type="search" id="sStatQ" placeholder="Filter by name" value="${esc(sQ)}" aria-label="Filter players"></div><div id="sStatT">${playerTable(D)}</div>`;
      const wireT = () => wirePlayersSport(D, $('#sStatT')) || $('#sStatT').querySelectorAll('[data-ss]').forEach(b => b.addEventListener('click', () => {
        const f = b.dataset.ss; sSort = sSort && sSort.cat === sCat && sSort.f === f ? { cat: sCat, f, dir: -sSort.dir } : { cat: sCat, f, dir: f === 'name' ? 1 : -1 };
        $('#sStatT').innerHTML = playerTable(D); wireT();
      }));
      wireT();
      box.querySelectorAll('[data-sc]').forEach(b => b.addEventListener('click', () => { sCat = +b.dataset.sc; sSort = null; draw(); }));
      $('#sStatQ').addEventListener('input', e => { sQ = e.target.value; $('#sStatT').innerHTML = playerTable(D); wireT(); });
    };
    document.querySelectorAll('[data-sv]').forEach(b => b.addEventListener('click', () => { sView = b.dataset.sv; document.querySelectorAll('[data-sv]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }));
    draw();
  }

  /* ---------- game dialogs ---------- */
  const BOXCOLS = {
    volleyball: [['K', 'attackStatsKills'], ['E', 'attackStatsErrors'], ['TA', 'attackStatsTotalAttempts'], ['PCT', 'attackStatsHittingPercentage'], ['A', 'setStatsAssists'], ['SA', 'serveStatsServiceAces'], ['Digs', 'defenseStatsDigs'], ['BS', 'blockStatsSolos'], ['BA', 'blockStatsAssists'], ['PTS', 'miscStatsPoints']],
    soccer: [['MIN', 'minutesPlayed'], ['SH', 'shotsNumberOfShots'], ['SOG', 'shotsShotsOnGoal'], ['G', 'shotsGoals'], ['A', 'shotsAssists'], ['YC', 'penaltiesYellow'], ['SV', 'goalieSaves'], ['GA', 'goalieGoalsAllowed']],
    mbb: [['MIN', 'minutesPlayed'], ['PTS', 'points'], ['FG', 'fieldGoals'], ['FGA', 'fieldGoalsAttempted'], ['3P', 'threePointFieldGoals'], ['3PA', 'threePointFieldGoalsAttempted'], ['FT', 'freeThrows'], ['FTA', 'freeThrowsAttempted'], ['REB', 'rebounds'], ['AST', 'assists'], ['STL', 'steals'], ['BLK', 'blocks'], ['TO', 'turnovers']],
    baseball: [['AB', 'atBats'], ['R', 'runs'], ['H', 'hits'], ['RBI', 'runsBattedIn'], ['BB', 'walks'], ['SO', 'strikeouts'], ['HR', 'homeRuns']],
  };
  BOXCOLS.wbb = BOXCOLS.mbb; BOXCOLS.softball = BOXCOLS.baseball;
  function boxCols(D, players) {
    const want = BOXCOLS[D.key] || [];
    const has = f => players.some(p => p.s[f] != null && p.s[f] !== '');
    const cols = want.filter(([, f]) => has(f));
    if (cols.length >= 3) return cols;
    const keys = {}; players.forEach(p => Object.keys(p.s).forEach(k => { if (numv(p.s[k]) != null && !/PerSet|PerGame|gamePlayed|gameStarted/i.test(k)) keys[k] = (keys[k] || 0) + 1; }));
    return Object.keys(keys).sort((a, b) => keys[b] - keys[a]).slice(0, 10).map(k => [human(k).replace(/^(Attack|Set|Serve|Defense|Block|Misc) Stats /, ''), k]);
  }
  function openBoxSport(D, g) {
    const B = D.box && D.box[String(g.gid)];
    const head = `<div><div class="eyebrow">Final · ${fmtDate(g.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div><h3>Tennessee ${g.us ?? ''}, ${esc(g.opp)} ${g.them ?? ''}</h3></div>`;
    if (!B) { window.showDialog(head, `<p>Full box score loads with the next automatic update.</p>`); return; }
    const T = B.teams;
    const per = B.periods && B.periods.length ? `<div class="tablewrap"><table class="mini box-line"><thead><tr><th>Team</th>${B.periods.map(p => `<th class="n">${esc(p)}</th>`).join('')}<th class="n">${D.key === 'volleyball' ? 'Sets' : 'F'}</th></tr></thead>
      <tbody>${[['away', B.periodsAway], ['home', B.periodsHome]].map(([side, sc], i) => { const t = T.find(x => x.home === (side === 'home')) || {}; return `<tr class="${/Tennessee/.test(t.name || '') ? 'me' : ''}"><td><b>${esc(t.name || '')}</b></td>${(sc || []).map(v => `<td class="n">${esc(v)}</td>`).join('')}<td class="n"><b>${esc(t.score ?? '')}</b></td></tr>`; }).join('')}</tbody></table></div>` : '';
    const ptable = t => { const cols = boxCols(D, t.players || []); return `<div class="tablewrap"><table class="mini"><thead><tr><th>${esc(t.name)}</th>${cols.map(([l]) => `<th class="n">${esc(l)}</th>`).join('')}</tr></thead>
      <tbody>${(t.players || []).map(p => `<tr><td>${p.num ? '<span class="dim small">' + esc(p.num) + '</span> ' : ''}${esc(p.name)}</td>${cols.map(([, f]) => `<td class="n">${esc(/^-?NaN$/.test(String(p.s[f])) ? '' : (p.s[f] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; };
    const ut = T.find(t => /Tennessee/.test(t.name || '')) || T[1], op = T.find(t => t !== ut) || T[0];
    window.showDialog(head, `<p class="dim small">${esc([B.stadium, B.location].filter(Boolean).join(', '))}${B.attendance ? ' · Attendance ' + Number(B.attendance).toLocaleString() : ''}</p>${per}
      <div class="seg" role="group" style="margin:14px 0 10px">${[['ut', 'Tennessee'], ['op', esc(op ? op.name : 'Opponent')]].map(([k, l], i) => `<button data-bx="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
      <div data-bxp="ut">${ut ? ptable(ut) : ''}</div><div data-bxp="op" hidden>${op ? ptable(op) : ''}</div>
      <p class="dim small">Box score: <a href="${esc(B.url)}" target="_blank" rel="noopener">utsports.com</a>.</p>`, true);
    window.wireDialogTabs('bx');
  }
  function openPreviewSport(D, g) {
    const w = window.howToWatch ? window.howToWatch(g.tv) : null;
    const S = (D.series || {})[g.opp];
    const played = D.schedule.filter(x => x.result && x.kind !== 'exh');
    const last5 = played.slice(-5);
    const rs = rosterSet(D);
    let lead = leadersOf(D, 3).filter(l => rs.has(norm(l.name)));
    lead = (IMPACT[D.key] || []).map(([label]) => lead.find(l => l.label === label)).filter(Boolean);
    const lastYr = D.statsAuto && D.statsAuto.season !== D.season;
    const watch = playersToKnow(D).slice(0, 4);
    const pear = ((X(D).advanced || {}).pearGames || []).find(x => x[0] === g.date);
    const head = `<div><div class="eyebrow">Preview · ${fmtDate(g.date, { weekday: 'long', month: 'long', day: 'numeric' })}${g.time ? ' · ' + esc(g.time) + ' ET' : ''}</div><h3>${g.site === 'A' ? 'Tennessee at ' + esc(g.opp) : esc(g.opp) + (g.site === 'N' ? ' vs. Tennessee' : ' at Tennessee')}</h3></div>`;
    const rec = played.length ? `${played.filter(x => x.result === 'W').length}-${played.filter(x => x.result === 'L').length}${played.some(x => x.result === 'T') ? '-' + played.filter(x => x.result === 'T').length : ''}` : null;
    const text = [
      `Tennessee ${g.site === 'A' ? 'travels to ' + esc((g.loc || g.opp).replace(/\.$/, '')) : g.site === 'H' ? 'hosts ' + esc(g.opp) + ' at ' + esc(D.venue) : 'meets ' + esc(g.opp) + ' in ' + esc(g.loc || 'a neutral site')}${g.event ? ' (' + esc(g.event) + ')' : ''}.`,
      rec ? `The ${D.short || 'Vols'} are ${rec} this season${last5.length ? `, ${last5.filter(x => x.result === 'W').length}-${last5.filter(x => x.result !== 'W').length} in the last ${last5.length}` : ''}.` : '',
      S ? `Tennessee is ${S.w}-${S.l}${S.t ? '-' + S.t : ''} all-time against ${esc(g.opp)}${S.last && S.last.length ? `; the last meeting (${S.last[S.last.length - 1][0].slice(0, 4)}) was a ${S.last[S.last.length - 1][1] === 'W' ? 'Tennessee win' : S.last[S.last.length - 1][1] === 'T' ? 'tie' : 'loss'}, ${S.last[S.last.length - 1][2]}-${S.last[S.last.length - 1][3]}` : ''}.` : '',
      watch.length ? `Players to watch: ${watch.slice(0, 3).map(p => esc(p.name)).join(', ')}.` : '',
      pear ? `PEAR gives Tennessee a ${pear[3].toFixed(1)}% chance to win (opponent PEAR rank: No. ${pear[2]}).` : '',
    ].filter(Boolean).join(' ');
    window.showDialog(head, `<div class="tiles" style="margin-bottom:14px">
        <div class="tile"><b style="font-size:22px">${w ? esc(w.net) : 'TBA'}</b><span>How to watch</span><em>${w ? esc(w.stream) : 'Usually announced 1–2 weeks out'}</em></div>
        <div class="tile"><b style="font-size:22px">${S ? `${S.w}-${S.l}${S.t ? '-' + S.t : ''}` : '—'}</b><span>All-time vs. ${esc(g.opp)}</span><em>${S && S.first ? 'Since ' + esc(S.first) : ''}</em></div>
        <div class="tile"><b style="font-size:22px">${rec || '0-0'}</b><span>Tennessee record</span><em>${esc(g.loc || '')}</em></div></div>
      <p class="lede">${text}</p>
      ${watch.length ? `<h5 class="subhead">Players to watch</h5><ul class="list">${watch.map(p => `<li><b class="namecol">${esc(p.name)}</b><span class="dim">${esc(p.pos)}</span><span class="grow small">${whyPlayer(D, p)}</span></li>`).join('')}</ul>` : ''}
      ${lead.length ? `<h5 class="subhead">Returning leaders <small class="dim">${lastYr ? esc(D.statsAuto.season) + ' stats, current roster only' : 'this season'}</small></h5><ul class="list">${lead.map(l => `<li><span class="chip">${esc(l.label)}</span><b class="grow">${esc(l.name)}</b><span class="num">${esc(l.val)} ${esc(l.unit)}</span></li>`).join('')}</ul>` : ''}
      ${S && S.last && S.last.length ? `<h5 class="subhead">Recent meetings</h5><ul class="list">${S.last.slice().reverse().map(x => `<li><b class="num">${esc(x[0].slice(0, 4))}</b><span class="grow">${x[4] === 'H' ? 'Home' : x[4] === 'A' ? 'Away' : 'Neutral'}</span><span class="num">${esc(x[2])}-${esc(x[3])}</span><span class="${x[1]}">${x[1]}</span></li>`).join('')}</ul>` : ''}
      <p class="small">${g.watch ? `<a href="${esc(g.watch)}" target="_blank" rel="noopener">Watch link</a> · ` : ''}${g.live ? `<a href="${esc(g.live)}" target="_blank" rel="noopener">Live stats</a> · ` : ''}<span class="dim">Data: utsports.com</span></p>`, true);
  }
  function openGameSport(D, i) {
    const g = D.schedule[i]; if (!g) return;
    if (g.result) openBoxSport(D, g); else openPreviewSport(D, g);
  }
  function openSeasonSport(D, season) {
    const H = D.histGames && D.histGames[season];
    const row = D.history.seasons.find(s => String(s.season) === String(season));
    const head = `<div><div class="eyebrow">${esc(D.name)} · ${esc(season)}${row ? ' · ' + esc(row.coach) : ''}</div><h3>${esc(season)}: ${row ? esc(row.overall) : ''}</h3></div>`;
    if (!H || !H.length) { window.showDialog(head, `<p>Game-by-game results for this season load with the next automatic update${row && row.post ? '' : ''}.</p>`); return; }
    window.showDialog(head, `<div class="tablewrap"><table class="mini"><thead><tr><th>Date</th><th>Opponent</th><th class="n">Result</th><th>Note</th></tr></thead>
      <tbody>${H.map(g => `<tr><td class="num">${fmtDate(g[0], { month: 'short', day: 'numeric' })}</td><td><b>${g[2] === 'A' ? 'at ' : g[2] === 'N' ? 'vs. ' : ''}${esc(g[1])}</b>${g[6] ? ' <span class="chip">SEC</span>' : ''}</td><td class="n">${g[3] ? `<span class="${g[3]}">${g[3]}</span> ${esc(g[4])}–${esc(g[5])}` : '—'}</td><td class="dim small">${esc(g[7] || '')}</td></tr>`).join('')}</tbody></table></div>
      <p class="dim small">Results: <a href="https://utsports.com/sports/${esc(SLUG[D.key])}/schedule/${esc(season)}" target="_blank" rel="noopener">utsports.com ${esc(season)} schedule</a>.</p>`, true);
  }

  /* ---------- researched extras (data/extras.js): ratings, honors, draft, recruit ratings, departures ---------- */
  const X = D => (window.EXTRAS || {})[D.key] || {};
  const norm = s => String(s || '').toLowerCase().replace(/[.'’]/g, '').replace(/\s+(jr|sr|ii|iii|iv)$/, '').replace(/\s+/g, ' ').trim();
  const rosterSet = D => new Set(D.roster.map(p => norm(p.name)));
  // the stat lines a card / lineup shows for each sport: [table, label, [[short, field], ...], test field]
  const LINES = {
    volleyball: [['individualStats', '', [['K', 'attackStatsKills'], ['PCT', 'attackStatsHittingPercentage'], ['A', 'setStatsAssists'], ['Digs', 'defenseStatsDigs'], ['Blk', 'blockStatsTotalBlocks'], ['SA', 'serveStatsServiceAces'], ['PTS', 'miscStatsPoints']], 'setsPlayed']],
    soccer: [['individualOffensiveStats', '', [['GP', 'gamesPlayed'], ['GS', 'gamesStarted'], ['G', 'goals'], ['A', 'assists'], ['SH', 'shots'], ['MIN', 'minutesPlayed']], 'gamesPlayed'], ['goalieStats', 'GK', [['GAA', 'goalsAgainstAverage'], ['SV%', 'savesPercentage'], ['SHO', 'shutouts'], ['W-L-T', null]], 'minutesPlayed']],
    mbb: [['individualStats', '', [['GP', 'gamesPlayed'], ['PPG', 'pointsPerGame'], ['RPG', 'reboundsPerGame'], ['APG', 'assistsPerGame'], ['FG%', 'fieldGoalsPercentage'], ['3P%', 'threePointFieldGoalsPercentage'], ['MIN', 'minutesPerGame']], 'gamesPlayed']],
    baseball: [['individualStats.individualHittingStats', 'Hitting', [['AVG', 'battingAverage'], ['HR', 'homeRuns'], ['RBI', 'runsBattedIn'], ['OBP', 'onBasePercentage'], ['SLG', 'sluggingPercentage'], ['AB', 'atBats']], 'atBats'], ['individualStats.individualPitchingStats', 'Pitching', [['ERA', 'earnedRunAverage'], ['W-L', null], ['IP', 'inningsPitched'], ['SO', 'strikeouts'], ['WHIP', 'whip'], ['SV', 'saves']], 'inningsPitched']],
  };
  LINES.wbb = LINES.mbb; LINES.softball = LINES.baseball;
  function statRow(tables, table, name) { return ((tables || {})[table] || []).find(r => norm(r.name) === norm(name)); }
  function lineFor(D, tables, name) {
    return (LINES[D.key] || []).map(([table, label, cols, test]) => {
      const r = statRow(tables, table, name); if (!r || !(numv(r.s[test]) > 0)) return null;
      const bits = cols.map(([l, f]) => {
        if (l === 'W-L') return r.s.wins != null ? `${r.s.wins}-${r.s.losses}` : null;
        if (l === 'W-L-T') return r.s.wins != null ? `${r.s.wins}-${r.s.losses}-${r.s.ties || 0} record` : null;
        const v = r.s[f]; return v == null || v === '' ? null : `${v} ${l}`;
      }).filter(Boolean);
      return { label, text: bits.join(' · ') };
    }).filter(Boolean);
  }
  function seasonLine(D, name) {
    const S = D.statsAuto; if (!S) return null;
    const ls = lineFor(D, S.tables, name); if (!ls.length) return null;
    return { season: S.season, lines: ls };
  }
  const statusChip = p => p && p.status ? ` <span class="chip risk-Watch" title="${esc(p.note || p.status)}">${esc(p.status)}</span>` : '';
  // last season at a previous school (basketball transfers), from data/transfer-stats.js
  /* ---------- basketball player ratings (data/ratings-bb.js + data/ratings-wbb-auto.js) ---------- */
  const RATED = new Set(['mbb', 'wbb']);
  const starStr = n => n ? `<span class="stars" aria-label="${n} stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>` : '';
  function bbRatings(D) {
    if (!RATED.has(D.key)) return null;
    const B = (window.BB_RATINGS || {})[D.key] || { players: {} }, P = Object.assign({}, B.players);
    return { B, P };
  }
  const hsGrade = h => h ? (h.comp ? Math.floor(h.comp * 100) : (h.grade || h.own)) : null;
  const hsLabel = h => h.src === 'espn' ? `ESPN grade (SC Next 100), class of ${h.cls}${h.natl ? ' · No. ' + h.natl + ' nationally' : ''}`
    : h.comp ? `247Sports Composite ${h.comp.toFixed(4).replace(/^0/, '')}, class of ${h.cls}${h.natl ? ' · No. ' + h.natl + ' nationally' : ''}`
    : `247Sports rating, class of ${h.cls}${h.natl ? ' · No. ' + h.natl + ' nationally' : ''}`;
  const bbRate = (D, p) => { const R = bbRatings(D); if (!R || !p) return null; return R.P[p.name] || { none: true }; };
  const curScore = r => r && !r.none ? (r.tr ? r.tr.rating : hsGrade(r.hs)) : null;
  const curStars = r => r && !r.none ? (r.tr ? r.tr.stars : r.hs && r.hs.stars) : null;
  function trBadge(t, compact) { return `<span class="rate tr" title="247Sports transfer rating, ${t.year} portal · No. ${t.ovr} overall"><span class="g">${t.rating}</span>${compact ? 'TR' : 'Transfer'}${compact ? '' : ' ' + starStr(t.stars)}</span>`; }
  function hsBadge(h) { return `<span class="rate" title="${esc(hsLabel(h))}"><span class="g">${hsGrade(h)}</span>${starStr(h.stars)}</span>`; }
  function bbBadge(D, p, compact) {
    const r = bbRate(D, p); if (!r) return '';
    if (r.none || (!r.tr && !r.hs)) return '<span class="rate" title="No rating listed"><span class="g">NR</span></span>';
    return r.tr ? trBadge(r.tr, compact) : hsBadge(r.hs);
  }
  function bbRatingRows(D, p) {
    const r = bbRate(D, p); if (!r) return '';
    const hsTxt = h => `${hsBadge(h)} <span class="small">${h.src === 'espn' ? `ESPN grade ${h.grade}` : h.comp ? `247 Composite ${h.comp.toFixed(4).replace(/^0/, '')}` : `247Sports ${h.own}`}${h.stars ? ' · ' + h.stars + '-star' : ''}${h.natl ? ' · No. ' + h.natl + ' nationally' : ''} · class of ${h.cls}${h.comp && h.own ? ` · 247's own rating ${h.own}` : ''}</span>`;
    const none = D.key === 'wbb' ? 'Not in ESPN\'s top 100 for her class' : 'No recruiting rating listed';
    if (r.none) return `<dt>${p.prev ? 'High school rating' : 'Rating'}</dt><dd class="dim">${none}</dd>` + (p.prev && D.key === 'wbb' ? `<dt>Transfer rating</dt><dd class="dim">Not published for women's basketball</dd>` : '');
    return (r.tr ? `<dt>Transfer rating</dt><dd>${trBadge(r.tr)} <span class="small">247Sports, ${r.tr.year} portal · No. ${r.tr.ovr} overall</span></dd>` : '')
      + (r.hs ? `<dt>High school rating</dt><dd>${hsTxt(r.hs)}</dd>` : p.prev ? `<dt>High school rating</dt><dd class="dim">Not rated coming out of high school</dd>` : '')
      + (!r.tr && p.prev && D.key === 'wbb' ? `<dt>Transfer rating</dt><dd class="dim">Not published for women's basketball</dd>` : '');
  }
  function teamComposite(D) {
    const R = bbRatings(D); if (!R) return '';
    const rows = D.roster.map(p => ({ p, r: R.P[p.name] })).filter(x => x.r && curScore(x.r) != null).sort((a, b) => curScore(b.r) - curScore(a.r));
    if (!rows.length) return `<div class="section"><h3>Team composite</h3><p class="dim">Player ratings load with the next automatic update.</p></div>`;
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const cur = avg(rows.map(x => curScore(x.r))), comps = rows.map(x => x.r.hs && x.r.hs.comp).filter(Boolean), espn = rows.map(x => x.r.hs && x.r.hs.src === 'espn' && x.r.hs.grade).filter(Boolean), trs = rows.map(x => x.r.tr && x.r.tr.rating).filter(Boolean);
    const st = [5, 4, 3].map(n => [n, rows.filter(x => curStars(x.r) === n).length]).filter(([, c]) => c);
    return `<div class="section" id="teamComposite"><h3>Team composite <small>${rows.length} of ${D.roster.length} players rated</small></h3>
      <div class="tiles" style="margin-bottom:12px"><div class="tile"><b>${cur.toFixed(1)}</b><span>Team composite</span><em>Avg. of each player's most recent rating</em></div>
        ${comps.length ? `<div class="tile"><b>${avg(comps).toFixed(4).replace(/^0/, '')}</b><span>Avg. 247 HS Composite</span><em>${comps.length} players</em></div>` : ''}
        ${espn.length && trs.length ? `<div class="tile"><b>${avg(espn).toFixed(1)}</b><span>Avg. ESPN HS grade</span><em>${espn.length} players</em></div>` : ''}
        ${trs.length ? `<div class="tile"><b>${avg(trs).toFixed(1)}</b><span>Avg. transfer rating</span><em>${trs.length} transfers · 247Sports</em></div>` : ''}
        ${st.map(([n, c]) => `<div class="tile"><b>${c}</b><span>${n}-star players</span></div>`).join('')}</div>
      <div class="tablewrap"><table><thead><tr><th>Name</th><th>Pos</th><th>Most recent</th><th class="hide-sm">High school</th>${trs.length ? '<th class="hide-sm">Transfer</th>' : ''}</tr></thead>
        <tbody>${rows.map(({ p, r }) => `<tr><td><a href="#" data-sp="${esc(p.name)}"><b>${esc(p.name)}</b></a></td><td>${esc(p.pos)}</td><td>${bbBadge(D, p)}</td>
          <td class="hide-sm small">${r.hs ? `${r.hs.comp ? r.hs.comp.toFixed(4).replace(/^0/, '') : hsGrade(r.hs)}${r.hs.stars ? ' · ' + r.hs.stars + '★' : ''}${r.hs.natl ? ' · No. ' + r.hs.natl : ''} · ${r.hs.cls}` : '—'}</td>
          ${trs.length ? `<td class="hide-sm small">${r.tr ? `${r.tr.rating} · ${r.tr.stars}★ · No. ${r.tr.ovr} overall` : '—'}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      <p class="dim small">${trs.length ? 'Most recent rating = the 247Sports transfer rating for transfers, otherwise the high school rating (247Sports Composite × 100).' : 'Ratings are ESPN SC Next 100 high school grades.'} The team composite is The Vol Index's average of those, not an official ranking. ${R.B.note ? esc(R.B.note) + ' ' : ''}Source: <a href="${esc(R.B.src)}" target="_blank" rel="noopener">${esc(R.B.srcName)}</a>.</p></div>`;
  }
  const transferLine = (D, p) => { const T = p && (((window.SITE_AUTO || {}).transfers || {})[D.key] || {})[p.name]; if (!T) return null;
    const n = v => v == null || v === '' ? null : String(v);
    if (T.bat || T.pitch) { // baseball: batting and/or pitching line
      const b = T.bat || {}, q = T.pitch || {}, pitcherFirst = /P/.test(p.pos || '') && T.pitch;
      const bt = T.bat && [n(b.AVG) && b.AVG + ' AVG', n(b.HR) && b.HR + ' HR', n(b.RBI) && b.RBI + ' RBI'].filter(Boolean).join(' · ');
      let pt = T.pitch && [n(q.ERA) && q.ERA + ' ERA', n(q.IP) && q.IP + ' IP', n(q.SO) && q.SO + ' K'].filter(Boolean).join(' · ');
      const tiles = [];
      if (T.pitch) tiles.push(['ERA', q.ERA], ['IP', q.IP], ['K', q.SO], ['W-L', q['W-L']]);
      if (T.bat) tiles.push(['AVG', b.AVG], ['HR', b.HR], ['RBI', b.RBI], ['OPS', b.OPS]);
      if (pitcherFirst === false && T.pitch && T.bat) tiles.push(...tiles.splice(0, 4));
      if (T.pitch && !n(q.ERA) && n(q['W-L'])) pt = [q['W-L'] + ' record', n(q.SV) && q.SV + ' saves', n(q.IP) && q.IP + ' IP', n(q.SO) && q.SO + ' K'].filter(Boolean).join(' · ');
      if (T.pitch && !n(q.ERA) && !n(q['W-L'])) pt = [n(q['APP-GS']) && q['APP-GS'], n(q.IP) && q.IP + ' IP', n(q.SO) && q.SO + ' K'].filter(Boolean).join(' · ');
      if (T.pitch && !n(q.ERA)) { tiles.splice(0, 4, ['W-L', q['W-L']], ['SV', q.SV], ['IP', q.IP], ['K', q.SO]); }
      return { season: T.season, text: [pitcherFirst ? pt : bt, pitcherFirst ? bt : pt].filter(Boolean).join(' / ') + (T.team ? ' at ' + T.team : '') + (T.note ? ' (' + T.note.replace(/^./, c => c.toLowerCase()) + ')' : ''), team: T.team, T, tiles: tiles.filter(([, v]) => n(v)) };
    }
    if (T.ppg == null) return null;
    return { season: T.season, text: [n(T.ppg) && n(T.ppg) + ' PPG', n(T.rpg) && n(T.rpg) + ' RPG', n(T.apg) && n(T.apg) + ' APG'].filter(Boolean).join(' · ') + (T.team ? ' at ' + T.team : ''), gp: T.gp, team: T.team, T }; };
  function playersToKnow(D) {
    const E = X(D), names = new Set();
    if ((E.playersToKnow || []).length) return E.playersToKnow.map(n => D.roster.find(p => norm(p.name) === norm(n))).filter(Boolean); // hand-picked list, in order
    (E.playersToKnow || []).forEach(n => names.add(n));
    Object.keys(E.honors || {}).forEach(n => names.add(n)); Object.keys(E.draft || {}).forEach(n => names.add(n));
    const rs = rosterSet(D);
    const lead = leadersOf(D, 1).filter(l => rs.has(norm(l.name))); lead.forEach(l => names.add(l.name));
    D.roster.filter(p => p.note && p.note !== 'Freshman').forEach(p => names.add(p.name));
    return [...names].map(n => D.roster.find(p => norm(p.name) === norm(n))).filter(Boolean).slice(0, 12);
  }
  function whyPlayer(D, p) {
    const E = X(D); const h = (E.honors || {})[p.name], d = (E.draft || {})[p.name], sl = seasonLine(D, p.name);
    if (h) return `<span class="chip honor">Honor</span> ${esc(h[0])}`;
    if (d) return `<span class="chip risk-${d.level}">Pro</span> ${esc(d.note)}`;
    if (sl) return `<b>${esc(sl.season)}:</b> ${esc(sl.lines[0].text)}`;
    const tl = transferLine(D, p); if (tl) return `<b>${esc(tl.season)}:</b> ${esc(tl.text)}`;
    return esc(p.note || '');
  }
  function pcardSport(D, p) {
    const E = X(D), rec = (E.recruit || {})[p.name];
    return `<button class="pcard" data-sp="${esc(p.name)}"><div class="pcard-top"><span class="jersey">${esc(p.num)}</span><div><div class="nm">${esc(p.name)}${statusChip(p)}</div><div class="sub">${esc(p.pos)} · ${esc(p.cls)}${p.prev ? ' · from ' + esc(String(p.prev).split(' / ').pop()) : ''}</div></div></div>
      ${rec ? (m => `<div class="tagrow"><span class="chip new">${esc(m ? m[1] : 'Recruit')}</span> <span class="small dim">${esc(m ? m[2] : rec)}</span></div>`)(rec.match(/^([^:]{1,16}):\s*(.+)$/)) : ''}
      ${RATED.has(D.key) ? `<div class="tagrow">${bbBadge(D, p)}</div>` : ''}
      <div class="why">${whyPlayer(D, p)}</div></button>`;
  }
  function openPlayerSport(D, name) {
    const p = D.roster.find(x => norm(x.name) === norm(name));
    const E = X(D); const honors = (E.honors || {})[p ? p.name : name] || [], draft = (E.draft || {})[p ? p.name : name], rec = (E.recruit || {})[p ? p.name : name];
    const S = D.statsAuto, inSzn = !!(S && S.season === D.season);
    const groups = S ? (LINES[D.key] || []).map(([table, label, cols, test]) => { const r = statRow(S.tables, table, name); if (!r || !(numv(r.s[test]) > 0)) return null;
      return { label, tiles: cols.map(([l, f]) => [l, l === 'W-L' ? (r.s.wins != null ? `${r.s.wins}-${r.s.losses}` : null) : l === 'W-L-T' ? (r.s.wins != null ? `${r.s.wins}-${r.s.losses}-${r.s.ties || 0}` : null) : r.s[f]]).filter(([, v]) => v != null && v !== '') }; }).filter(Boolean) : [];
    const tLine = !groups.length ? transferLine(D, p) : null;
    const prevLine = !groups.length && !tLine && p && p.prev && /\d/.test(p.note || '') ? p.note : null;
    const statTitle = tLine && S && tLine.season !== S.season ? `${tLine.season} stats · last season played` : S ? (inSzn ? `${S.season} stats` : `${S.season} stats · last season`) : 'Stats';
    const inLineup = []; Object.values((lineup && lineup.chart) || {}).forEach(rows => rows.forEach(([pos, ns]) => { const i = ns.findIndex(n => norm(n) === norm(name)); if (i >= 0) inLineup.push(`${pos} (${i === 0 ? 'starter' : ordn(i + 1)})`); }));
    const head = `<span class="jersey">${esc(p ? p.num : '')}</span><div><h3>${esc(p ? p.name : name)}${statusChip(p)}</h3><p>${p ? esc([p.pos, p.cls, p.ht && p.ht + (p.wt ? ', ' + p.wt + ' lb' : ''), p.bt && 'B/T ' + p.bt].filter(Boolean).join(' · ')) : esc(D.name)}</p></div>`;
    const body = `${rec ? `<div class="tagrow"><span class="chip new">Recruiting</span> <span class="small">${esc(rec)}</span></div>` : ''}
      <dl class="kv">${p ? `<dt>Hometown</dt><dd>${esc(p.home || '—')}</dd>${p.hs ? `<dt>High school</dt><dd>${esc(p.hs)}</dd>` : ''}${p.prev ? `<dt>Previous school</dt><dd>${esc(p.prev)}</dd>` : ''}${bbRatingRows(D, p)}` : ''}
        <dt>${esc(lineup ? lineup.label : 'Lineup')}</dt><dd>${inLineup.join(', ') || 'Not in the projected lineup'}</dd>
        ${draft ? `<dt>Pro outlook</dt><dd><span class="chip risk-${draft.level}">${esc(draft.level)}</span> ${esc(draft.note)}${draft.src ? ` (<a href="${esc(draft.src)}" target="_blank" rel="noopener">source</a>)` : ''}</dd>` : ''}
        ${p && p.note ? `<dt>Notes</dt><dd>${esc(p.note)}</dd>` : ''}</dl>
      ${honors.length ? `<div><h4>Honors & watch lists</h4><ul>${honors.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
      <div><h4>${esc(statTitle)}</h4>${groups.length ? groups.map(g => `${g.label ? `<div class="eyebrow" style="margin:6px 0 4px">${esc(g.label)}</div>` : ''}<div class="tiles four statgrid">${g.tiles.map(([l, v]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>`).join('')
        : tLine ? `<div class="tiles four statgrid">${(tLine.tiles || [['PPG', tLine.T.ppg], ['RPG', tLine.T.rpg], ['APG', tLine.T.apg], ['GP', tLine.T.gp]]).filter(([, v]) => v != null && v !== '').map(([l, v]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div><p class="dim small">At ${esc(tLine.team || String(p.prev).split(' / ').pop())} (${esc(tLine.season)}). Tennessee stats start with the first game.</p>`
        : prevLine ? `<p>${esc(prevLine)}${/ at /.test(prevLine) ? '' : ` (at ${esc(String(p.prev).split(' / ').pop())})`}</p><p class="dim small">Last season was at another school; Tennessee stats start with the first game.</p>`
        : `<p class="dim small">${p && p.prev && !inSzn ? `Played last season at ${esc(String(p.prev).split(' / ').pop())}; Tennessee stats start with the first game.` : p && /Fr/.test(p.cls || '') ? 'Freshman: no college stats yet.' : inSzn ? 'Hasn\'t recorded a stat yet this season.' : 'No stats last season.'}</p>`}</div>
      <p class="dim small">Stats: utsports.com${RATED.has(D.key) ? (D.key === 'wbb' ? ' · ratings: ESPN' : ' · ratings: 247Sports') : ''}${rec ? ' · recruiting ratings as listed' : ''}.</p>`;
    window.showDialog(head, body, false);
  }
  const ordn = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  function wirePlayersSport(D, root) {
    root.querySelectorAll('[data-sp]').forEach(el => { if (el._w) return; el._w = true; el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPlayerSport(D, el.dataset.sp); }); });
  }
  function departures(D) {
    const E = X(D), cur = D.roster.map(p => norm(p.name));
    const listed = new Map((E.departures || []).map(([n, r]) => [norm(n), [n, r]]));
    (D.moves.lost || []).forEach(([n, r]) => { if (!/^\d+ players|Entire/.test(n) && !listed.has(norm(n))) listed.set(norm(n), [n, r]); });
    // anyone who played last season and isn't on this roster
    const S = D.statsAuto && D.statsAuto.season !== D.season ? D.statsAuto : null;
    const career = (window.SITE_AUTO && window.SITE_AUTO[D.key] && window.SITE_AUTO[D.key].career) || {};
    const lastSeason = S ? S.season : Object.keys(career).filter(s => s !== D.season).sort().pop();
    const tables = S ? S.tables : career[lastSeason];
    const seen = new Set();
    Object.values(tables || {}).forEach(rows => rows.forEach(r => {
      const k = norm(r.name); if (seen.has(k) || cur.includes(k) || listed.has(k)) return; seen.add(k);
      listed.set(k, [r.name, `Not on the ${D.season} roster (graduated, out of eligibility or left the program)`]);
    }));
    return [...listed.values()];
  }

  /* ---------- advanced ---------- */
  function advancedSport(D) {
    const A = X(D).advanced; const auto = [D.rpiAuto, D.pollCur].filter(Boolean).filter(a => !A.teams.some(t => t.src === a.poll && (t.rank = a.rank, t.date = 'through ' + fmtDate(a.date, { month: 'short', day: 'numeric' }), t.rating = a.record ? a.record + ' record' : t.rating, true)));
    return `<div class="panel-head"><div><h2>Advanced</h2><p>${esc(A.intro || '')}</p></div></div>
      <div class="grid g3">${A.teams.map(t => `<div class="box adv"><div class="eyebrow"><a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.src)}</a> · ${esc(t.date || '')}</div>
        <div class="advrank"><b>No. ${esc(t.rank)}</b><span>${esc(t.rating || '')}</span></div>
        ${t.off ? `<div class="advsplit"><div><small>Offense</small><b>${esc(t.off[0])}</b><em>No. ${esc(t.off[1])}</em></div><div><small>Defense</small><b>${esc(t.def[0])}</b><em>No. ${esc(t.def[1])}</em></div></div>` : ''}
        ${t.extra ? `<p class="small dim">${esc(t.extra)}</p>` : ''}</div>`).join('')}
        ${auto.map(a => `<div class="box adv"><div class="eyebrow"><a href="${esc(a.source || '#')}" target="_blank" rel="noopener">${esc(a.poll)}</a> · automatic${a.date ? ' · ' + fmtDate(a.date, { month: 'short', day: 'numeric' }) : ''}</div><div class="advrank"><b>${typeof a.rank === 'number' ? 'No. ' + a.rank : esc(a.rank)}</b><span>${esc(a.record || '')}</span></div>${a.prev ? `<p class="small dim">Previous: ${esc(a.prev)}</p>` : ''}</div>`).join('')}</div>
      ${A.conf ? `<div class="section"><h3>${esc(A.confTitle)}</h3><div class="tablewrap"><table class="mini"><thead><tr><th>Team</th>${A.confCols.map(c => `<th class="n">${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${A.conf.map(r => `<tr class="${r[0] === 'Tennessee' ? 'me' : ''}"><td><b>${esc(r[0])}</b></td>${r.slice(1).map(v => `<td class="n">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : ''}
      ${A.players ? `<div class="section"><h3>${esc(A.playersTitle)}</h3><div class="tablewrap"><table class="mini"><thead><tr><th>Player</th>${A.playerCols.map(c => `<th class="n">${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${A.players.slice().sort((a, b) => (b[1] ?? -9) - (a[1] ?? -9)).map(r => `<tr><td><a href="#" data-sp="${esc(r[0])}"><b>${esc(r[0])}</b></a></td>${r.slice(1).map(v => `<td class="n">${v == null ? '—' : esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="dim small">${esc(A.playersNote || '')}</p></div>` : ''}
      ${A.pearGames ? `<div class="section"><h3>Game-by-game projections <small>PEAR win chance for Tennessee · opponent's PEAR rank</small></h3><div class="tablewrap"><table class="mini"><thead><tr><th>Date</th><th>Opponent</th><th class="n">Opp. rank</th><th>Win chance</th></tr></thead>
        <tbody>${A.pearGames.map(g => `<tr><td class="num">${fmtDate(g[0], { month: 'short', day: 'numeric' })}</td><td><b>${esc(g[1])}</b></td><td class="n">${g[2]}</td><td><span class="winbar"><i style="width:${g[3]}%"></i></span> <b class="num">${g[3].toFixed(1)}%</b></td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${(rows => rows.length ? `<div class="section"><h3>Polls & rankings <small>Media polls, preseason rankings and other ratings</small></h3><div class="tablewrap"><table><thead><tr><th>Source</th><th class="n">Tennessee</th><th>Notes</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td><a href="${esc(r[3])}" target="_blank" rel="noopener"><b>${esc(r[0])}</b></a></td><td class="n"><b>${esc(r[1])}</b></td><td class="dim">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div></div>` : '')(ratingRows(D).filter(r => !A.teams.some(t => r[0].toLowerCase().split(' ')[0] === t.src.toLowerCase().split(' ')[0] && !/poll|projected/i.test(r[0]))))}
      ${A.glossary ? `<details class="box gloss"><summary>What do these numbers mean?</summary><dl>${A.glossary.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>` : ''}`;
  }

  /* ---------- recruiting ---------- */
  function recruiting(D) {
    const R = (window.RECRUITING || {})[D.key] || {};
    const fr = D.roster.filter(p => /^(Fr|RS Fr)/i.test(p.cls || '')); const rec = X(D).recruit || {};
    const ctable = c => `<div class="tablewrap"><table><thead><tr><th>Name</th><th>Pos</th><th class="hide-sm">From</th><th>Rating / rank</th><th class="hide-sm">Committed</th></tr></thead>
          <tbody>${c.commits.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.pos)}</td><td class="hide-sm">${esc(c.from || '')}</td><td>${esc(c.rank || '—')}</td><td class="hide-sm">${c.src ? `<a href="${esc(c.src)}" target="_blank" rel="noopener">${esc(c.date || 'Source')}</a>` : esc(c.date || '')}</td></tr>`).join('')}</tbody></table></div>`;
    const classes = R.classes ? R.classes.map((c, i) => `<div class="section" ${i ? '' : 'style="margin-top:0"'}><h3>Class of ${esc(c.year)} <small>${c.commits.length} commitments</small></h3>
        ${c.rank ? `<div class="classrank"><b>${esc(c.rank.replace(/^On3 class rank /, ''))}</b><span>${esc(/On3/.test(c.rank) ? 'On3 class ranking' : 'Class ranking')}${/\(/.test(c.rank) ? '' : ''}</span></div>` : ''}
        ${ctable(c)}${c.src ? `<p class="dim small">Source: <a href="${esc(c.src)}" target="_blank" rel="noopener">On3 industry comparison, ${esc(c.year)}</a></p>` : ''}</div>`).join('') : null;
    return `<div class="panel-head"><div><h2>Recruiting</h2><p>${esc(R.intro || 'Commitments for upcoming classes, this year\'s freshmen and where to follow recruiting.')}</p></div></div>
      ${classes || `<div class="section" style="margin-top:0"><h3>Class of ${esc(R.year || '2027')} <small>${R.commits && R.commits.length ? R.commits.length + ' public commitments' : 'No public commitments confirmed yet'}</small></h3>
        ${R.commits && R.commits.length ? `<div class="tablewrap"><table><thead><tr><th>Name</th><th>Pos</th><th class="hide-sm">From</th><th>Rating / rank</th><th class="hide-sm">Committed</th></tr></thead>
          <tbody>${R.commits.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.pos)}</td><td class="hide-sm">${esc(c.from || '')}</td><td>${esc(c.rank || '—')}</td><td class="hide-sm">${c.src ? `<a href="${esc(c.src)}" target="_blank" rel="noopener">${esc(c.date || 'Source')}</a>` : esc(c.date || '')}</td></tr>`).join('')}</tbody></table></div>` : `<p class="dim">${esc(R.none || 'Nothing public yet. Check the trackers below.')}</p>`}
        ${R.note ? `<p class="dim small">${esc(R.note)}</p>` : ''}</div>`}
      ${R.targets ? `<div class="section"><h3>${esc(R.targets.title)} <small>${R.targets.rows.length} prospects</small></h3><div class="tablewrap"><table><thead><tr><th class="n">#</th><th>Name</th><th>Pos</th><th class="hide-sm">Ht / Wt</th><th class="hide-sm">School</th><th>Rating / rank</th></tr></thead>
        <tbody>${R.targets.rows.map((c, i) => `<tr><td class="n num"><b>${i + 1}</b></td><td><b>${c.src ? `<a href="${esc(c.src)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}</b></td><td>${esc(c.pos)}</td><td class="hide-sm num">${esc(c.ht || '')}</td><td class="hide-sm">${esc(c.from || '')}</td><td class="small">${esc(c.rank || '—')}</td></tr>`).join('')}</tbody></table></div>${R.targets.note ? `<p class="dim small">${esc(R.targets.note)}</p>` : ''}</div>` : ''}
      ${teamComposite(D)}
      ${R.lastClass ? `<div class="section"><h3>${esc(R.lastClass.title)}</h3><div class="box"><ul class="list">${R.lastClass.rows.map(r => `<li><b class="grow">${D.roster.some(p => norm(p.name) === norm(r[0])) ? `<a href="#" data-sp="${esc(r[0])}">${esc(r[0])}</a>` : esc(r[0])}</b><span class="dim">${esc(r[1])}</span><span class="small">${esc(r[2] || '')}</span></li>`).join('')}</ul></div>${R.lastClass.src ? `<p class="dim small">Source: <a href="${esc(R.lastClass.src)}" target="_blank" rel="noopener">${esc(R.lastClass.srcName || 'link')}</a></p>` : ''}</div>` : ''}
      ${fr.length ? `<div class="section"><h3>This year's freshmen <small>${fr.length} on the ${esc(D.season)} roster</small></h3><div class="box"><ul class="list">${fr.map(p => `<li><b class="grow"><a href="#" data-sp="${esc(p.name)}">${esc(p.name)}</a></b><span class="dim">${esc(p.pos)}</span><span class="small">${esc([p.hs, p.home].filter(Boolean).join(' · '))}</span>${rec[p.name] ? `<span class="chip new">${esc(rec[p.name].replace(/^On3: /, ''))}</span>` : ''}</li>`).join('')}</ul></div></div>` : ''}
      ${R.trackers ? `<div class="section"><h3>Follow recruiting</h3><ul class="srclist">${R.trackers.map(t => `<li><span>${esc(t[0])}</span> <a href="${esc(t[2])}" target="_blank" rel="noopener">${esc(t[1])}</a></li>`).join('')}</ul></div>` : ''}`;
  }

  /* ---------- overview ---------- */
  function overview(D) {
    const n = nextGame(D);
    const ptk = playersToKnow(D); const E = X(D);
    const hon = Object.entries(E.honors || {}), pro = Object.entries(E.draft || {});
    return `<div class="box quick"><div class="eyebrow">The quick read</div><ul>${D.quick.map(q => `<li>${q}</li>`).join('')}</ul></div>
      <div class="grid g2">
        ${n ? `<div class="box nextgame matchup click" data-sg="${D.schedule.indexOf(n)}" tabindex="0" role="button"><div class="eyebrow">${n.kind === 'exh' ? 'Next exhibition' : 'Next up'} · ${fmtDate(n.date, { weekday: 'long', month: 'long', day: 'numeric' })}${n.time ? ' · ' + esc(n.time) + ' ET' : ''}${n.tv ? ' · ' + esc(n.tv) : ''}</div>
          <div class="vs">${vsat(n)} ${esc(n.opp)}</div><div class="meta">${esc(n.loc)} ${kindChip(n)}</div>
          ${(w => w ? `<div class="meta"><b>📺 How to watch: ${esc(w.net)}</b> · ${esc(w.stream)}</div>` : '<div class="meta">📺 TV: TBA (usually announced 1–2 weeks out)</div>')(window.howToWatch && window.howToWatch(n.tv))}
          <div class="golink" style="margin-top:8px">Preview: series history, leaders, how to watch ›</div></div>` : ''}
        ${D.inSeason ? (() => { const played = D.schedule.filter(g => g.result && g.kind !== 'exh'); const sp = window.secPlace && window.secPlace(D.key);
          return window.resultsBox({ games: played.map(g => ({ date: g.date, opp: g.opp.replace(/ \(No\. \d+\)/, ''), site: g.site, result: g.result, us: g.us, them: g.them, attr: `data-sg="${D.schedule.indexOf(g)}"` })),
            sub: sp && sp.conf && !sp.final ? sp.conf + ' SEC' : '', max: 5, more: played.length > 5 ? [window.VI_ROUTER ? window.VI_ROUTER.href(D.key + '-schedule') : '#' + D.key + '-schedule', 'Full schedule and results'] : null,
            meta: esc(D.header.map(h => h[1] + ': ' + h[0]).slice(0, 3).join(' · ')) }); })() : `<div class="box nextgame"><div class="eyebrow">Last season · ${esc(D.last.label)}</div>
          <div class="vs">${esc(D.last.record)}</div><div class="meta">${esc(D.last.conf)} · ${esc(D.last.finish)}</div><div class="meta">${esc(D.last.rank)}</div></div>`}
      </div>
      ${ptk.length ? `<div class="section"><h3>Players to know <small>Click a player for bio, honors and stats at Tennessee</small></h3>
        <div class="grid g4">${ptk.map(p => pcardSport(D, p)).join('')}</div></div>` : ''}
      ${hon.length || pro.length ? `<div class="grid g2 section">
        <div class="box"><div class="lb"><h4>Honors & watch lists <span>${hon.length}</span></h4></div>${hon.length ? `<ul class="list">${hon.map(([n, h]) => `<li><b class="namecol"><a href="#" data-sp="${esc(n)}">${esc(n)}</a></b><span class="grow small">${h.map(esc).join('<br>')}</span></li>`).join('')}</ul>` : '<p class="dim small">None announced yet.</p>'}</div>
        <div class="box"><div class="lb"><h4>Pro prospects <span>${pro.length}</span></h4></div>${pro.length ? `<ul class="list">${pro.map(([n, d]) => `<li><b class="namecol"><a href="#" data-sp="${esc(n)}">${esc(n)}</a></b><span class="chip risk-${esc(d.level)}">${esc(d.level)}</span><span class="grow small">${esc(d.note)}${d.src ? ` · <a href="${esc(d.src)}" target="_blank" rel="noopener">source</a>` : ''}</span></li>`).join('')}</ul>` : `<p class="dim small">${esc(E.draftNote || 'No Vols on the major draft boards for this sport.')}</p>`}${E.draftNote && pro.length ? `<p class="dim small">${esc(E.draftNote)}</p>` : ''}</div></div>` : ''}
      <div class="section"><h3>Coaching staff</h3><div class="box"><ul class="list">${D.staff.map(s => `<li><b class="grow">${esc(s[0])}</b><span class="dim">${esc(s[1])}</span></li>`).join('')}</ul></div></div>`;
  }

  /* ---------- roster ---------- */
  const rcols = D => RATED.has(D.key) ? D.rosterCols.flatMap(c => c === 'pos' ? ['pos', 'rate'] : [c]) : D.rosterCols;
  function roster(D) {
    return `<div class="panel-head"><div><h2>${esc(D.season)} Roster</h2><p>${D.roster.length} players.${RATED.has(D.key) ? ` ${D.key === 'wbb' ? 'Ratings: ESPN high school grade (NR = not in ESPN\'s top 100 for the class).' : 'Ratings: each player\'s most recent rating ("TR" = 247Sports transfer rating, otherwise high school).'} <a href="${esc(window.VI_ROUTER ? window.VI_ROUTER.href(D.key + '-recruiting') : '#' + D.key + '-recruiting')}">Team composite ›</a>` : ''}</p></div>
      <div class="controls"><input type="search" id="sRosterQ" placeholder="Search name, hometown or school" value="${esc(rosterQ)}" aria-label="Search roster"></div></div>
      <div class="tablewrap"><table><thead><tr>${rcols(D).map(c => `<th class="${c === 'num' ? 'n' : ''} ${HIDE_SM.has(c) ? 'hide-sm' : ''}">${COLS[c]}</th>`).join('')}</tr></thead><tbody id="sRosterBody"></tbody></table></div>`;
  }
  function wireRoster(D) {
    const draw = () => {
      const q = rosterQ.toLowerCase();
      $('#sRosterBody').innerHTML = D.roster.filter(p => !q || Object.values(p).join(' ').toLowerCase().includes(q)).map(p =>
        `<tr>${rcols(D).map(c => c === 'rate' ? `<td>${bbBadge(D, p, true)}</td>` : c === 'num' ? `<td class="n"><b>${esc(p.num)}</b></td>` : c === 'name' ? `<td><a href="#" data-sp="${esc(p.name)}"><b>${esc(p.name)}</b></a>${statusChip(p)}${(X(D).honors || {})[p.name] ? ' <span class="chip honor" title="Honors">★</span>' : ''}</td>` : `<td class="${HIDE_SM.has(c) ? 'hide-sm' : ''}${c === 'note' ? ' dim small' : ''}">${esc(p[c] || (c === 'prev' ? '' : '—'))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${rcols(D).length}">No players match.</td></tr>`;
    };
    $('#sRosterQ').addEventListener('input', e => { rosterQ = e.target.value; draw(); wirePlayersSport(D, $('#sRosterBody')); });
    draw();
  }

  /* ---------- lineup (editable) ---------- */
  function loadLineup(k) {
    let d = store.get(LKEY(k));
    // a saved draft that now matches the file (or predates a newer file) is dropped, so the file is the default
    if (d && (JSON.stringify(d.chart) === JSON.stringify(window.LINEUP[k].chart) || (d.rev || 0) < (window.LINEUP[k].rev || 0) || (d.updated && window.LINEUP[k].updated && d.updated < window.LINEUP[k].updated))) { store.del(LKEY(k)); d = null; }
    const l = d || JSON.parse(JSON.stringify(window.LINEUP[k])); l._draft = !!d; return l; }
  function lineupPanel(D) {
    const L = lineup, byName = new Map(D.roster.map(p => [p.name, p]));
    const pool = D.roster.map(p => [p.name, `${p.name} · ${p.pos} #${p.num}`]).sort((a, b) => a[0].localeCompare(b[0]));
    return `${L._draft ? `<div class="notice"><span><b>Unsaved edits.</b> These lineup changes live only in this browser. Save them to the data file to make them permanent.</span><button class="btn small" data-la="export">Save to file</button><button class="btn small" data-la="reset">Discard my edits</button></div>` : ''}
      <div class="panel-head"><div><h2>${esc(L.label)}</h2><p>${esc(L.basedOn)}. Updated ${fmtDate(L.updated, { month: 'short', day: 'numeric', year: 'numeric' })}. The first name at each spot is the projected starter. ${D.statsAuto ? (D.statsAuto.season === D.season ? 'Stat lines are this season\'s.' : `Stat lines are from ${esc(D.statsAuto.season)}, the last season played.`) : ''} Click a player for their card.</p></div>
        <div class="controls">${editing ? '' : '<button class="btn" data-la="edit">Edit lineup</button>'}</div></div>
      ${editing ? `<div class="editbar"><p>Editing. Use ↑ ↓ to reorder, ✕ to remove, and the menu under each spot to add a player. Changes stay in this browser until you save them to the file.</p>
        <button class="btn primary" data-la="done">Done</button><button class="btn" data-la="export">Save to file</button><button class="btn" data-la="reset">Reset to file version</button></div>` : ''}
      <div id="lExport"></div>
      <div class="${editing ? 'editing' : ''}">${Object.entries(L.chart).map(([grp, rows]) => `<div class="side-title">${esc(grp)}</div>
        <div class="dgrid">${rows.map(([pos, names], ri) => `<div class="dpos"><div class="dpos-h"><b>${esc(pos)}</b><span>${names.length} listed</span></div>
          <ol>${names.map((n, i) => { const p = byName.get(n); return `<li><span class="ord">${i + 1}</span><div class="pn">${p ? `<b class="num pnum">${esc(p.num)}</b>` : ''}${editing ? esc(n) : `<a href="#" data-sp="${esc(n)}">${esc(n)}</a>`}<small>${esc(p ? p.cls : '')}</small>
            <div class="tags">${bbBadge(D, p, true)}${statusChip(p)}${p ? (p.prev && !/^20\d\d:|last season/i.test(p.note || '') ? '<span class="chip">Transfer</span>' : p.cls === 'Fr.' ? '<span class="chip new">Freshman</span>' : '<span class="chip">Returner</span>') : '<span class="chip risk-Watch">Not on roster</span>'}</div>${(sl => sl ? `<div class="statline"><b>${esc(sl.season)}</b> ${sl.lines.map(l => (l.label ? esc(l.label) + ': ' : '') + esc(l.text)).join(' / ')}</div>` + (p && p.note && i === 0 ? `<div class="dim small">${esc(p.note)}</div>` : '')
              : transferLine(D, p) ? (tl => `<div class="statline"><b>${esc(tl.season)}</b> ${esc(tl.text)}</div>`)(transferLine(D, p))
              : p && p.prev && /\d/.test(p.note || '') ? `<div class="statline">${D.statsAuto && D.statsAuto.season !== D.season ? `<b>${esc(D.statsAuto.season)}</b> ` : ''}${esc(p.note)}${/ at /i.test(p.note) ? '' : ` at ${esc(String(p.prev).split(' / ').pop())}`}</div>`
              : (p && p.note && i === 0 ? `<div class="dim small">${esc(p.note)}</div>` : ''))(seasonLine(D, n))}</div>
            ${editing ? `<div class="edit-tools" data-g="${esc(grp)}" data-r="${ri}" data-i="${i}"><button data-m="up" aria-label="Move ${esc(n)} up">↑</button><button data-m="down" aria-label="Move ${esc(n)} down">↓</button><button data-m="rm" aria-label="Remove ${esc(n)}">✕</button></div>` : '<span></span>'}</li>`; }).join('')}</ol>
          ${editing ? `<div class="addrow"><select data-add="${esc(grp)}|${ri}" aria-label="Add player to ${esc(pos)}"><option value="">+ Add player…</option>${pool.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>` : ''}
        </div>`).join('')}</div>`).join('')}</div>`;
  }
  function lineupText(D) {
    const L = lineup;
    const rows = Object.entries(L.chart).map(([g, rs]) => `    "${g}": [\n` + rs.map(([p, n]) => `      ["${p}", ${JSON.stringify(n)}]`).join(',\n') + '\n    ]').join(',\n');
    return `/* ============================================================
   ${D.name.toUpperCase()} PROJECTED LINEUP  (this is the file you edit)
   Easiest: open the site > ${D.name} > Lineup > "Edit lineup",
   then "Save to file" and replace this file.
   By hand: each row is ["SPOT", ["starter", "backup", ...]].
   Names must match the roster exactly.
   ============================================================ */
window.LINEUP = window.LINEUP || {};
window.LINEUP.${D.key} = {
  "label": ${JSON.stringify(L.label)},
  "updated": "${today()}",
  "rev": ${(L.rev || 0) + 1},
  "basedOn": ${JSON.stringify(L.basedOn)},
  "chart": {
${rows}
  }
};
`;
  }
  async function exportLineup(D) {
    const text = lineupText(D);
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: D.key + '-lineup.js', types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }] });
        const w = await h.createWritable(); await w.write(text); await w.close();
        store.del(LKEY(D.key)); lineup._draft = false; editing = false; render(D.key, 'lineup');
        $('#lExport').innerHTML = `<div class="notice ok"><span>Saved. If you saved over <b>data/${D.key}-lineup.js</b>, the site now uses your lineup.</span></div>`;
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    $('#lExport').innerHTML = `<div class="box" style="padding:12px;margin-bottom:12px;display:grid;gap:8px"><b>Copy this into data/${D.key}-lineup.js (replace everything in the file)</b>
      <textarea class="export" id="lText" readonly>${esc(text)}</textarea><div class="controls"><button class="btn primary" id="lCopy">Copy text</button><span id="lMsg" class="dim"></span></div></div>`;
    $('#lCopy').addEventListener('click', () => {
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => { $('#lMsg').textContent = 'Copied.'; })
        .catch(() => { const t = $('#lText'); t.focus(); t.select(); $('#lMsg').textContent = 'Text selected. Press Ctrl+C to copy.'; });
    });
  }
  function wireLineup(D) {
    const save = () => { lineup._draft = true; store.set(LKEY(D.key), lineup); render(D.key, 'lineup'); };
    document.querySelectorAll('[data-la]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.la;
      if (a === 'edit') { editing = true; render(D.key, 'lineup'); }
      else if (a === 'done') { editing = false; render(D.key, 'lineup'); }
      else if (a === 'export') exportLineup(D);
      else if (a === 'reset') { store.del(LKEY(D.key)); lineup = loadLineup(D.key); render(D.key, 'lineup'); }
    }));
    document.querySelectorAll('.edit-tools button').forEach(b => b.addEventListener('click', () => {
      const t = b.parentElement, list = lineup.chart[t.dataset.g][+t.dataset.r][1], i = +t.dataset.i;
      if (b.dataset.m === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      else if (b.dataset.m === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
      else if (b.dataset.m === 'rm') list.splice(i, 1);
      save();
    }));
    document.querySelectorAll('[data-add]').forEach(s => s.addEventListener('change', () => {
      if (!s.value) return; const [g, r] = s.dataset.add.split('|'); const list = lineup.chart[g][+r][1];
      if (!list.includes(s.value)) list.push(s.value); save();
    }));
  }

  /* ---------- schedule ---------- */
  function schedule(D) {
    const n = nextGame(D);
    const conf = D.schedule.filter(g => g.kind === 'conf').length, home = D.schedule.filter(g => g.site === 'H' && g.kind !== 'exh').length;
    return `<div class="panel-head"><div><h2>${esc(D.season)} Schedule & Standings</h2><p>${D.scheduleNote ? esc(D.scheduleNote) + ' ' : ''}Home games at ${esc(D.venue)}. Times Eastern. Click a game for its box score or preview.${(sp => sp ? ` <a href="#standings" class="jump" data-goto-stand>Tennessee is ${sp.text} in the SEC${sp.final ? ' (' + sp.season + ' final)' : ''}${sp.conf ? ', ' + sp.conf : ''} ›</a>` : '')(window.secPlace && window.secPlace(D.key))}</p></div><div class="controls">${window.standSwitch ? window.standSwitch() : ''}</div></div>
      <div data-view="standings" ${window.standCur && window.standCur() !== 'standings' ? 'hidden' : ''}>${window.standingsHtml ? window.standingsHtml(D.key) : ''}</div>
      <div data-view="schedule" ${window.standCur && window.standCur() !== 'schedule' ? 'hidden' : ''}><div class="tiles four" style="margin-bottom:16px"><div class="tile"><b>${D.schedule.filter(g => g.kind !== 'exh').length}</b><span>${D.key === 'baseball' || D.key === 'softball' ? 'Dates / series listed' : 'Games'}</span></div>
        <div class="tile"><b>${conf}</b><span>SEC ${D.key === 'baseball' || D.key === 'softball' ? 'series' : 'games'}</span></div><div class="tile"><b>${home}</b><span>Home dates</span></div>
        <div class="tile"><b>${n ? fmtDate(n.date, { month: 'short', day: 'numeric' }) : '—'}</b><span>Next: ${n ? esc(n.opp) : 'TBA'}</span></div></div>
      <div class="tablewrap"><table><thead><tr><th>Date</th><th>Opponent</th><th class="hide-sm">Location</th><th>${D.inSeason ? 'Result / Time' : 'Time'}</th><th class="hide-sm">TV</th><th></th></tr></thead>
      <tbody>${D.schedule.map((g, i) => { const link = g.result || g.date >= today(); return `<tr class="${link ? 'click ' : ''}${n && g === n ? 'me' : ''}" ${link ? `data-sg="${i}" tabindex="0"` : ''}><td class="num">${fmtDate(g.date)}</td><td><b>${vsat(g)} ${esc(g.opp)}</b> ${kindChip(g)}</td><td class="hide-sm">${esc(g.loc)}</td><td class="num">${g.result ? resStr(g) : esc(g.time ? g.time + ' ET' : g.kind === 'exh' ? '—' : 'TBA')}</td><td class="hide-sm">${esc(g.tv || '—')}</td><td class="n">${link ? `<span class="golink">${g.result ? (g.hasBox ? 'Box score ›' : 'Result ›') : 'Preview ›'}</span>` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  }

  /* ---------- stats ---------- */
  function stats(D) {
    if (D.statsAuto) return statsAuto(D);
    const T = D.stats; const rows = T.rows.slice().sort((a, b) => (b[T.sort] ?? -1) - (a[T.sort] ?? -1));
    return `<div class="panel-head"><div><h2>${esc(T.title)}</h2><p>${esc(T.note || '')}</p></div></div>
      <div class="tablewrap"><table><thead><tr><th>Player</th>${T.cols.map(c => `<th class="n">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => { const p = D.roster.find(x => x.name === r[0]); return `<tr><td><b>${esc(r[0])}</b> <span class="dim small">${p ? esc(p.pos + ' · ' + p.cls) : ''}</span></td>${r.slice(1).map(v => `<td class="n">${v == null ? '—' : esc(v)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
  }

  /* ---------- ratings ---------- */
  function ratingRows(D) {
    const R = D.ratings; const E = X(D);
    let rows = (E.ratings || R.rows).map(r => r.slice());
    [D.pollCur, D.rpiAuto].filter(Boolean).forEach(a => {
      const val = typeof a.rank === 'number' ? 'No. ' + a.rank : 'NR';
      const note = `Automatic · ${a.date ? 'through ' + fmtDate(a.date, { month: 'short', day: 'numeric' }) : ''}${a.record ? ' · record ' + a.record : ''}${a.prev ? ' · previous: ' + a.prev : ''}`;
      const word = a.poll.split(' ')[0] === 'NCAA' ? a.poll : a.poll.split(' ')[0];
      const i = rows.findIndex(r => r[0].toLowerCase().startsWith(word.toLowerCase()) && !/preseason/i.test(r[0]));
      const row = [a.poll, val, note, a.source || (i >= 0 ? rows[i][3] : '#')];
      if (i >= 0) rows[i] = row; else rows.unshift(row);
    });
    return rows.filter(r => !/^check$/i.test(String(r[1])));
  }
  function ratings(D) {
    const R = D.ratings; const E = X(D); const rows = ratingRows(D);
    return `<div class="panel-head"><div><h2>Rankings & Ratings</h2><p>${esc(R.intro)}${E.advanced ? ` Team-strength numbers (offense, defense, projections) are on the <a href="#${D.key}-advanced">Advanced</a> tab.` : ''}</p></div></div>
      <div class="tablewrap"><table><thead><tr><th>Source</th><th class="n">Tennessee</th><th>Notes</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td><a href="${r[3]}" target="_blank" rel="noopener"><b>${esc(r[0])}</b></a></td><td class="n"><b>${esc(r[1])}</b></td><td class="dim">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>
      ${R.compare && R.compare.length ? `<div class="section"><h3>${esc(R.compareTitle)}</h3><div class="box"><div class="lb"><ol>${R.compare.map(([t, r]) => `<li class="${t === 'Tennessee' ? 'me-li' : ''}"><span><b>${esc(t)}</b></span><b class="num">No. ${r}</b><span class="bar"><i style="width:${Math.max(4, 100 - (r - 1) * (96 / Math.max(...R.compare.map(c => c[1]))))}%"></i></span></li>`).join('')}</ol></div></div></div>` : ''}
      <details class="box gloss"><summary>What do these ratings mean?</summary><dl>${R.glossary.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>`;
  }

  /* ---------- review ---------- */
  function review(D) {
    const L = D.last;
    const w = (L.results || []).filter(r => r.result === 'W').length;
    return `<div class="panel-head"><div><h2>${esc(L.label)} Season Review</h2><p>${esc(L.finish)}.</p></div></div>
      <div class="tiles four" style="margin-bottom:16px"><div class="tile"><b>${esc(L.record)}</b><span>Overall</span></div><div class="tile"><b>${esc(L.conf.split(' ')[0])}</b><span>${esc(L.conf.split(' ').slice(1).join(' '))}</span></div>
        <div class="tile"><b>${esc(L.rank.split(' (')[0])}</b><span>${esc((L.rank.split(' (')[1] || 'Final ranking').replace(')', ''))}</span></div><div class="tile"><b>${esc(L.finish.split(' (')[0].replace('NCAA ', ''))}</b><span>Postseason</span></div></div>
      <div class="box quick" style="background:var(--surface-2)"><ul>${L.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
      ${L.leaders.length ? `<div class="section"><h3>Standouts</h3><div class="box"><ul class="list">${L.leaders.map(l => `<li><b class="namecol">${esc(l[0])}</b><span class="dim" style="min-width:40px">${esc(l[1])}</span><span class="grow num">${esc(l[2])}</span><span class="dim">${esc(l[3])}</span></li>`).join('')}</ul></div></div>` : ''}
      ${L.hitting ? `<div class="section"><h3>Top hitters <small>${esc(L.label)}</small></h3><div class="tablewrap"><table><thead><tr><th>Player</th><th class="n">AVG</th><th class="n">HR</th><th class="n">RBI</th><th class="n">OBP</th><th class="n">SLG</th><th>2027</th></tr></thead>
        <tbody>${L.hitting.map(h => `<tr><td><b>${esc(h[0])}</b></td><td class="n">${h[1]}</td><td class="n">${h[2]}</td><td class="n">${h[3]}</td><td class="n">${h[4]}</td><td class="n">${h[5]}</td><td>${h[6] === 'Returns' ? '<span class="chip">Returns</span>' : h[6] ? `<span class="chip leave">${esc(h[6])}</span>` : '—'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${L.results && L.results.length ? `<div class="section"><h3>Game by game <small>${w}-${L.results.length - w}</small></h3><div class="tablewrap" style="max-height:560px"><table><thead><tr><th>Date</th><th>Opponent</th><th>Result</th></tr></thead>
        <tbody>${L.results.map(r => `<tr><td class="num">${fmtDate(r.date, { month: 'short', day: 'numeric' })}</td><td>${esc(r.opp)} ${r.kind === 'conf' ? '<span class="chip">SEC</span>' : r.kind === 'post' ? '<span class="chip honor">Postseason</span>' : ''}</td><td class="num"><span class="${r.result}">${r.result}</span> ${r.us}–${r.them}${r.note ? ' ' + esc(r.note) : ''}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  }

  /* ---------- moves ---------- */
  function moves(D) {
    const M = D.moves; const lost = departures(D);
    return `<div class="panel-head"><div><h2>Roster Moves</h2><p>Who arrived, who left, and who's committed for next year.</p></div></div>
      <div class="grid g2">
        <div class="box"><div class="lb"><h4>Additions <span>${M.added.length}</span></h4></div><ul class="list">${M.added.map(a => `<li><b class="grow">${esc(a[0])}</b><span class="dim">${esc(a[1])}</span>${a[2] ? `<span class="num small">${esc(a[2])}</span>` : ''}</li>`).join('')}</ul></div>
        <div class="box"><div class="lb"><h4>Departures <span>${lost.length}</span></h4></div><ul class="list">${lost.map(a => `<li><b class="grow">${esc(a[0])}</b><span class="dim">${esc(a[1])}</span></li>`).join('') || '<li class="dim">Not tracked yet.</li>'}</ul></div>
      </div>
      <p class="dim" style="margin-top:14px">Commitments and incoming classes are on the <a href="#${D.key}-recruiting">Recruiting</a> tab.</p>`;
  }

  /* ---------- history ---------- */
  function history(D) {
    const H = D.history;
    return `<div class="panel-head"><div><h2>History</h2><p>Program honors and season-by-season results since ${esc(H.seasons[H.seasons.length - 1].season)}.</p></div></div>
      <div class="grid g4">${H.titles.map(t => `<div class="box titlebox"><b>${esc(t[0])}</b><div class="eyebrow">${esc(t[1])}</div><p>${esc(t[2])}</p></div>`).join('')}</div>
      ${H.retired && H.retired.length ? `<div class="section"><h3>Retired jerseys</h3><div class="grid g4">${H.retired.map(r => `<div class="box retired"><span class="rnum">${esc(r[0])}</span><div><b>${esc(r[1])}</b></div></div>`).join('')}</div></div>` : ''}
      ${H.notable ? `<p class="dim" style="margin-top:16px">${esc(H.notable)}</p>` : ''}
      <div class="section"><h3>Season by season <small>Click a season for its schedule and results</small></h3><div class="tablewrap" style="max-height:600px"><table><thead><tr><th>Season</th><th>Coach</th><th>Overall</th><th>SEC</th><th>Postseason</th></tr></thead>
      <tbody>${H.seasons.map(s => `<tr class="click" data-season="${esc(s.season)}" tabindex="0"><td class="num"><b>${esc(s.season)}</b></td><td>${esc(s.coach)}</td><td class="num">${esc(s.overall)}</td><td class="num">${esc(s.conf || '—')}</td><td>${/champion/i.test(s.post || '') ? `<span class="chip honor">${esc(s.post)}</span>` : esc(s.post || '—')}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function render(k, tab) {
    const D = applyAuto(window.SITE[k]); const app = document.getElementById('app');
    if (key !== k) { key = k; editing = false; rosterQ = ''; lineup = loadLineup(k); }
    if (tab === 'ratings' && X(D).advanced) tab = 'advanced';
    if (!tabs(D).find(t => t[0] === tab)) tab = 'overview';
    const body = { overview, roster, lineup: lineupPanel, schedule, stats, ratings, advanced: advancedSport, recruiting, review, moves, history, media: () => window.renderMedia(D.key) }[tab](D);
    app.innerHTML = header(D, tab) + `<main class="wrap">${body}</main>` + footer(D);
    if (tab === 'roster') wireRoster(D);
    if (tab === 'lineup') wireLineup(D);
    if (tab === 'stats' && D.statsAuto) wireStatsAuto(D);
    app.querySelectorAll('[data-sg]').forEach(el => { const go = () => openGameSport(D, +el.dataset.sg); el.addEventListener('click', go); el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
    wirePlayersSport(D, app);
    app.querySelectorAll('[data-season]').forEach(el => { const go = () => openSeasonSport(D, el.dataset.season); el.addEventListener('click', go); el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
  }
  window.renderSport = render;
  window.sportOpenPlayer = (k, n) => { const D = applyAuto(window.SITE[k]); if (key !== k) { key = k; lineup = loadLineup(k); } openPlayerSport(D, n); };
  window.sportOpenGame = (k, i) => openGameSport(applyAuto(window.SITE[k]), i);
  window.sportInfo = k => { const D = applyAuto(window.SITE && window.SITE[k]); if (!D) return null; const rs = rosterSet(D);
    return { D, next: nextGame(D), leaders: leadersOf(D, 3).filter(l => rs.has(norm(l.name))), ptk: playersToKnow(D), lastStats: D.statsAuto && D.statsAuto.season !== D.season ? D.statsAuto.season : null }; };
  window.sportRecord = function (k) {
    const D = applyAuto(window.SITE && window.SITE[k]); if (!D || !D.inSeason) return null;
    const r = D.header.find(h => /record/i.test(h[1])), c = D.header.find(h => h[1] === 'SEC');
    return r ? { season: D.season, rec: r[0], sec: c ? c[0] : null } : null;
  };
  window.sportStatus = function (k) {
    const D = applyAuto(window.SITE && window.SITE[k]); if (!D) return null;
    const n = nextGame(D);
    const cur = D.inSeason ? (() => { const r = D.header.find(h => /record/i.test(h[1])); const c = D.header.find(h => h[1] === 'SEC'); return `${D.season}: ${r ? r[0] : ''}${c ? ' (' + c[0] + ' SEC)' : ''}`; })() : `${D.prevLabel}: ${D.last.record}`;
    return `${cur}${n ? ' · Next: ' + n.opp.replace(/ \(\d games\)/, '') + ' ' + fmtDate(n.date, { month: 'short', day: 'numeric' }) : ''}`;
  };
})();
