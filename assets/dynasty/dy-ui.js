/* The Vol Index — Vol Dynasty: the hub (setup, saves, dashboard, schedule, roster, depth chart, recruiting,
   rankings, standings, stats, NIL, history, settings, the offseason stages, player and prospect cards). */
(function (root) {
  'use strict';
  const DY = root.DY;
  const UI = root.VI_DYN = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let APP = null;
  const V = { recs: 'season', tab: 'home', rpos: 'ALL', rsort: 'ovr', conf: null, rfind: { pos: 'ALL', stars: 0, mine: false, q: '' }, ppos: 'ALL', prpos: 'ALL', statk: 'py', stab: 'team', more: {}, dview: 'off', setup: null, msg: null };
  const G = () => DY.G;
  const T = id => DY.T(id);
  const YR = ['', 'Fr.', 'So.', 'Jr.', 'Sr.', '5th', '5th'];
  const yrLabel = p => YR[Math.min(6, p.yr)] || '5th';
  const stars = n => '★'.repeat(n || 0) + '<span class="dy-off">' + '★'.repeat(Math.max(0, 5 - (n || 0))) + '</span>';
  const recLabel = p => !p.rec || p.rec.walkon ? '<span class="dy-wo">Walk-on</span>' : `<span class="dy-stars">${stars(p.rec.stars)}</span>`;
  const ovrCls = o => o >= 90 ? 'e' : o >= 84 ? 'g' : o >= 76 ? 'm' : 'l';
  const ovrB = o => `<span class="dy-ovr ${ovrCls(o)}">${o}</span>`;
  const tlink = (id, rk) => { const t = T(id); if (!t) return ''; const r = rk === false ? null : DY.apRank(id); return `<span class="dy-t" style="--tc:${t.c1}">${r ? `<small>${r}</small> ` : ''}${esc(t.name)}</span>`; };
  const plink = (p, txt) => p ? `<a href="#" class="dy-pl${p.t === G().user || p.t0 === G().user ? '' : ' o'}" data-pid="${p.id}">${esc(txt || p.n)}</a>${p.captain && p.t === G().user ? ' <span class="dy-cap" title="Captain">C</span>' : ''}` : '';
  const tag = t => t ? `<span class="dy-tag">${esc(t)}</span>` : '';
  // stats for the current season, or the one just finished in the offseason
  const sStats = p => p.s || (G().phase === 'offseason' && p.car && p.car[G().season]) || null;

  UI.render = app => {
    APP = app;
    document.title = 'Vol Dynasty · Football · The Vol Index';
    if (root.DYG && root.DYG.live() && APP.querySelector('.dyg')) return;
    if (!DY.G) return landing();
    hub();
  };
  function busy(label, fn, after) {
    const o = document.createElement('div'); o.className = 'dy-busy'; o.innerHTML = `<div><span class="dy-spin"></span>${esc(label)}</div>`;
    document.body.appendChild(o);
    setTimeout(() => { try { fn(); } catch (e) { console.error(e); V.msg = 'Something went wrong: ' + e.message; } o.remove(); if (after) after(); else hub(); autosave(); }, 40);
  }
  function autosave() { const g = G(); if (g && g.settings.autosave !== false) DY.saveSlot(g.slot || 1, root.DYG && root.DYG.live()).then(err => { if (err) V.msg = err; }); }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && G() && root.DYG && root.DYG.live()) DY.saveSlot(G().slot || 1, root.DYG.live()); });

  /* ---------- landing + setup ---------- */
  function landing() {
    const m = DY.readMeta();
    APP.innerHTML = `<div class="wrap games dy">
      <div class="gcrumb"><a href="#games">Games</a> › <a href="#games-football">Football</a> › Vol Dynasty</div>
      <div class="dy-hero"><span class="gtag">Preview</span><h1>Vol Dynasty</h1><p>Take over Tennessee with the real 2026 roster and depth chart. Call every play, sign the real 2027 class and recruit the ones after it, work the portal and your NIL budget, and chase the playoff year after year.</p></div>
      <div class="dy-slots">${[1, 2, 3].map(n => { const s = m[n]; return `<div class="box dy-slot ${s ? '' : 'empty'}"><div class="glabel">Slot ${n}</div>${s ? `<h3>Coach ${esc(s.coach)}</h3><p class="dim">${s.team && s.team !== 'Tennessee' ? esc(s.team) + ' · ' : ''}${esc(s.label)} · ${esc(s.rec)}${s.natl ? ` · ${s.natl} national title${s.natl > 1 ? 's' : ''}` : ''}</p><p class="dim small">Saved ${new Date(s.at).toLocaleString()}</p><div class="grow"><button class="btn primary" data-load="${n}">Continue</button><button class="btn" data-del="${n}">Delete</button></div>` : `<p class="dim">Empty</p><div class="grow"><button class="btn primary" data-new="${n}">New dynasty</button></div>`}</div>`; }).join('')}</div>
      <div class="grow"><label class="btn"><input type="file" accept=".gz,.vdyn,application/gzip" id="dyImport" hidden>Import a save file</label></div>
      <div class="gnote small">Saves live in this browser. Export one from Settings to move it to another device. This is an early preview: expect balance changes, and saves from a later version may not load.</div>
    </div>`;
    APP.firstElementChild.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.new) { V.setup = { slot: +b.dataset.new }; setup(); }
      if (b.dataset.load) { const n = +b.dataset.load; b.disabled = true; b.textContent = 'Loading…'; DY.loadSlot(n).then(g => { if (!g) { alert('That save could not be read.'); return landing(); } g.slot = n; V.tab = 'home'; hub(); }).catch(err => { alert(err.message); landing(); }); }
      if (b.dataset.del) { if (b.dataset.sure) { DY.deleteSlot(+b.dataset.del); landing(); } else { b.dataset.sure = 1; b.textContent = 'Tap again to delete'; } }
    };
    const imp = APP.querySelector('#dyImport');
    imp.onchange = () => { const f = imp.files[0]; if (!f) return; DY.importFile(f).then(g => { g.slot = g.slot || 1; DY.saveSlot(g.slot); hub(); }).catch(err => alert('Could not import: ' + err.message)); };
  }
  function setup() {
    const s = V.setup;
    const def = { team: 'Tennessee', start: 'pre', coach: '', arch: 'motivator', diff: 'varsity', cfp: 'real', coachMode: 'offense', recruiting: 'manual', portal: 'manual', nil: 'manual', injuries: true, speed: 'slow', shake: true, offStyle: 'power', watchSeason: false };
    for (const k in def) if (s[k] == null) s[k] = def[k];
    const seg = (key, opts) => `<div class="gseg" data-key="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(s[key]) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
    APP.innerHTML = `<div class="wrap games dy"><div class="gcrumb"><a href="#" data-back="1">Vol Dynasty</a> › New dynasty</div>
      <div class="dy-hero"><h1>New dynasty</h1><p>${s.team === 'Tennessee' ? 'Tennessee, 2026. The real roster, depth chart and schedule; the real 2027 recruiting class already committed.' : `${esc(s.team)}, 2026. A generated roster and schedule (no real-life stats or history), in the same league as everyone else. Tennessee keeps its real roster as an opponent.`}</p></div>
      <div class="box gsetup dy-setup">
        <div class="gfield"><div class="glabel">Team</div><select id="dyTeam" class="dy-in">${(() => { const ts = DY.TEAMS, cs = [...new Set(ts.map(t => t.conf))].sort((a, b) => a === 'SEC' ? -1 : b === 'SEC' ? 1 : a.localeCompare(b)); return cs.map(c => `<optgroup label="${esc(c === 'IND' ? 'Independents' : c)}">${ts.filter(t => t.conf === c).sort((a, b) => a.name.localeCompare(b.name)).map(t => `<option ${t.name === s.team ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join(''); })()}</select><p class="dim small">${s.team === 'Tennessee' ? 'The default: Tennessee with its real players, stats and history.' : 'Every school other than Tennessee gets generated players and no real-life stats.'}</p></div>
        ${DY.canStartToday() ? (() => { const F = root.SITE_AUTO.football, pl = F.schedule.filter(x => x.result), w = pl.filter(x => x.result === 'W').length; return `<div class="gfield"><div class="glabel">Start</div>${seg('start', [['pre', '2026 preseason'], ['today', s.team === 'Tennessee' ? `Today: take over at ${w}-${pl.length - w}` : 'Today: this week of the real season']])}<p class="dim small">${s.start === 'today' ? `Take the job this week. Tennessee's real results, scores and player stats so far; every FBS team's real record and the real AP poll (as of ${esc(root.DY_TODAY.asOf)}). The rest of the season is yours.` : 'Start from the first week of the 2026 season.'}</p></div>`; })() : ''}
        <div class="gfield"><div class="glabel">Coach name</div><input id="dyCoach" class="dy-in" maxlength="28" placeholder="Your name" value="${esc(s.coach)}"></div>
        <div class="gfield"><div class="glabel">Coaching style</div><div class="dy-archs">${Object.entries(DY.COACH_ARCH).map(([k, a]) => `<button type="button" class="dy-arch" data-arch="${k}" aria-pressed="${s.arch === k}"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></button>`).join('')}</div></div>
        <div class="gfield"><div class="glabel">Offensive identity</div>${seg('offStyle', DY.USER_STYLES.map(k => [k, DY.STYLES[k].name]))}${s.team === 'Tennessee' ? '<p class="dim small">Tennessee leans on the run and plays at a slower pace this season. You can change it any time in Settings.</p>' : ''}</div>
        <div class="gfield"><div class="glabel">Difficulty</div>${seg('diff', [['freshman', 'Freshman (easier)'], ['varsity', 'Varsity (default)'], ['heisman', 'Heisman (hard)']])}<p class="dim small">Varsity is balanced. Heisman gives CPU players a boost in your games; Freshman takes a little off.</p></div>
        <div class="gfield"><div class="glabel">Playoff</div>${seg('cfp', [['real', 'Real format (12 in 2026, 24 from 2027)'], [2, '2 teams (BCS)'], [4, '4 teams'], [8, '8 teams'], [12, '12 teams'], [24, '24 teams']])}</div>
        <div class="gfield"><div class="glabel">Play calling</div>${seg('coachMode', [['offense', 'Offense (your DC calls defense)'], ['full', 'Offense and defense'], ['watch', 'Just watch']])}</div>
        <div class="gfield"><div class="glabel">Season watch</div>${seg('watchSeason', [[false, 'Play my games'], [true, 'Sim my games, I run the program']])}</div>
        <div class="gfield"><div class="glabel">Recruiting</div>${seg('recruiting', [['manual', 'I recruit'], ['auto', 'Auto'], ['off', 'Off']])}${s.team === 'Tennessee' ? '<p class="dim small">Year one is the real 2027 class, locked in.</p>' : ''}</div>
        <div class="gfield"><div class="glabel">Transfer portal</div>${seg('portal', [['manual', 'I manage it'], ['auto', 'Auto'], ['off', 'Off']])}</div>
        <div class="gfield"><div class="glabel">NIL</div>${seg('nil', [['manual', 'I approve raises'], ['auto', 'Auto']])}</div>
        <div class="gfield"><div class="glabel">Game speed</div>${seg('speed', [['slow', 'Slow'], ['fast', 'Fast']])}</div>
        <div class="gfield"><div class="glabel">Injuries</div>${seg('injuries', [[true, 'On'], [false, 'Off']])}</div>
        <div class="gfield"><div class="glabel">Third-down screen shake in big home games</div>${seg('shake', [[true, 'On'], [false, 'Off']])}</div>
        <div class="grow"><button class="btn primary big" id="dyStart">Start the dynasty</button><button class="btn" data-back="1">Back</button></div>
      </div></div>`;
    APP.querySelector('#dyTeam').onchange = ev => { s.team = ev.target.value; s.coach = APP.querySelector('#dyCoach').value; setup(); };
    APP.firstElementChild.onclick = e => {
      const b = e.target.closest('button,a'); if (!b) return;
      if (b.dataset.back) { e.preventDefault(); return landing(); }
      if (b.dataset.arch) { s.coach = APP.querySelector('#dyCoach').value; s.arch = b.dataset.arch; return setup(); }
      const segEl = b.closest('.gseg');
      if (segEl && b.dataset.v != null) { const v = b.dataset.v; s[segEl.dataset.key] = v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? +v : v; s.coach = APP.querySelector('#dyCoach').value; s.team = APP.querySelector('#dyTeam').value; return setup(); }
      if (b.id === 'dyStart') {
        s.coach = APP.querySelector('#dyCoach').value.trim() || 'Coach';
        busy('Building the 2026 season: 136 teams, 7,400 players…', () => {
          DY.newDynasty({ team: s.team, coach: s.coach, arch: s.arch, settings: { cfp: s.cfp, coachMode: s.coachMode, recruiting: s.recruiting, portal: s.portal, nil: s.nil, injuries: s.injuries, speed: s.speed, shake: s.shake, difficulty: s.diff, offStyle: s.offStyle, watchSeason: s.watchSeason } });
          G().slot = s.slot; V.tab = 'home';
          if (s.start === 'today' && DY.canStartToday()) { const err = DY.startToday(); if (err) V.msg = err; }
        });
      }
    };
  }

  /* ---------- hub ---------- */
  const TABS = [['home', 'Home'], ['schedule', 'Schedule'], ['roster', 'Roster'], ['depth', 'Depth chart'], ['recruit', 'Recruiting'], ['polls', 'Rankings'], ['standings', 'Standings'], ['stats', 'Stats'], ['nil', 'NIL'], ['history', 'History'], ['settings', 'Settings']];
  function hub() {
    const g = G(); if (!g) return landing();
    const ut = DY.userT(), rk = DY.apRank(ut.id);
    const act = primaryAction();
    const canSimAhead = g.phase === 'season' || g.phase === 'ccg' || g.phase === 'post' || g.phase === 'preseason';
    APP.innerHTML = `<div class="dy dyhub">
      <div class="dyh" style="--tc:${ut.c1}">
        <div class="wrap dyh-in">
          <div class="dyh-id"><span class="dyh-badge">${esc(ut.abbr)}</span><div><div class="dyh-name">${rk ? `<small>No. ${rk}</small> ` : ''}${esc(ut.name)}</div><div class="dyh-sub">Coach ${esc(g.coach.name)} · ${esc(DY.weekLabel())}</div></div></div>
          <div class="dyh-rec"><b>${ut.w}-${ut.l}</b><small>${ut.cw}-${ut.cl} ${esc(ut.conf)}</small></div>
          <div class="dyh-act">${act ? `<button class="btn primary big" data-act="main">${esc(act.label)}</button>${act.sim ? `<button class="btn" data-act="sim">${esc(act.sim)}</button>` : ''}` : ''}
            ${canSimAhead ? `<div class="dy-menu"><button class="btn" data-act="simmenu" aria-haspopup="true">Sim ahead ▾</button><div class="dy-menu-in" hidden><p class="small dim" style="margin:2px 8px 6px">Your games get simmed too.</p>${g.phase === 'season' && g.week < 7 || g.phase === 'preseason' ? '<button data-ahead="mid">To midseason (week 7)</button>' : ''}${g.phase === 'season' || g.phase === 'preseason' ? '<button data-ahead="reg">To end of the regular season</button>' : ''}<button data-ahead="end">To the end of the season</button></div></div>` : ''}
            <button class="btn" data-act="save" title="Save to slot ${g.slot || 1}">Save</button></div>
        </div>
        <nav class="wrap dyh-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${V.tab === k}">${l}${k === 'recruit' && g.phase !== 'offseason' && g.recruit && !g.recruit.signed && !g.recruit.locked && g.settings.recruiting === 'manual' ? ` <small>${DY.HOURS() - DY.hoursUsed()}h</small>` : ''}</button>`).join('')}</nav>
      </div>
      ${V.msg ? `<div class="wrap"><div class="gnote dy-msg">${esc(V.msg)} <button class="glink" data-act="msgx">Dismiss</button></div></div>` : ''}
      <div class="wrap dy-body" id="dyBody"></div>
      <div class="dy-modal" id="dyModal" hidden><div class="dy-modal-in" role="dialog" aria-modal="true"><button class="dy-x" data-act="close" aria-label="Close">×</button><div id="dyModalBody"></div></div></div>
    </div>`;
    const body = APP.querySelector('#dyBody');
    ({ home, schedule, roster, depth, recruit, polls, standings, stats, nil, history, settings })[V.tab](body);
    APP.firstElementChild.onclick = onClick; APP.firstElementChild.onchange = onChange;
    const cq = APP.querySelector('#dyCampQ');
    if (cq) {
      const run = () => { const q = cq.value.trim().toLowerCase(); let n = 0; APP.querySelectorAll('#dyCampT tr').forEach(tr => { const show = q.length > 0 && tr.dataset.campq.split(/\s+/).some(w => w.startsWith(q)) || (q.length > 1 && tr.dataset.campq.includes(q)); tr.hidden = !show || n >= 25; if (show) n++; }); APP.querySelector('#dyCampHint').textContent = q ? (n ? `${n} match${n > 1 ? 'es' : ''}` : 'No players match.') : 'Type to find a player.'; V.campq = cq.value; };
      cq.oninput = run; if (V.campq) { cq.value = V.campq; run(); }
    }
    const at = APP.querySelector('.dyh-tabs [aria-selected="true"]'); if (at && at.scrollIntoView && root.innerWidth < 900) at.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function primaryAction() {
    const g = G(), watch = g.settings.watchSeason;
    if (g.phase === 'preseason') return { label: `Kick off the ${g.season} season`, main: () => { DY.autoCamp && DY.autoCamp(); DY.startSeason(); hub(); } };
    if (g.phase === 'season') {
      const x = DY.userGames(g.week)[0];
      if (x && !x.res) return watch ? { label: `Sim: ${x.h === g.user ? 'vs' : 'at'} ${T(DY.oppOf(x)).name}`, x, simOnly: true, sim: 'Play it instead' } : { label: `Play: ${x.h === g.user ? 'vs' : 'at'} ${T(DY.oppOf(x)).name}`, sim: 'Sim game', x };
      return { label: `Sim week ${g.week}${x ? '' : ' (bye)'}` };
    }
    if (g.phase === 'ccg') { const x = DY.postUserGame(); return x ? (watch ? { label: `Sim: ${x.title}`, x, simOnly: true, sim: 'Play it instead' } : { label: `Play: ${x.title}`, sim: 'Sim game', x }) : { label: 'Sim championship week' }; }
    if (g.phase === 'post') { const x = DY.postUserGame(); if (x) { const nm = x.title.replace(/ \(CFP.*\)/, '') + (/CFP/.test(x.title) ? ' (CFP)' : ''); return watch ? { label: 'Sim: ' + nm, x, simOnly: true, sim: 'Play it instead' } : { label: 'Play: ' + nm, sim: 'Sim game', x }; } return { label: `Sim: ${g.post.label}` }; }
    if (g.phase === 'offseason') { const i = DY.OFF_ORDER.indexOf(g.off.stage); return { label: i >= DY.OFF_ORDER.length - 1 ? `Start ${g.season + 1}` : `Continue: ${DY.OFF_LABEL[DY.OFF_ORDER[i + 1]]}` }; }
    return null;
  }
  function advanceAfterGame() {
    const g = G();
    if (g.phase === 'season') DY.finishWeek();
    else if (g.phase === 'ccg') DY.finishCCG();
    else if (g.phase === 'post') DY.finishRound();
  }
  function mainAction(alt) {
    const g = G(), a = primaryAction(); if (!a) return;
    if (a.main) return a.main();
    if (g.phase === 'offseason') {
      if (g.off.stage === 'cuts' && DY.cutsNeeded() > (g.off.cut || []).length && !V.cutOk) { V.cutOk = true; V.msg = `You are ${DY.cutsNeeded() - (g.off.cut || []).length} over the ${DY.rosterMax()}-man limit. Pick your cuts, or press Continue again and the staff will cut the lowest-rated players.`; return hub(); }
      V.cutOk = false;
      return busy('Working…', () => DY.offNext());
    }
    const play = a.x && (a.simOnly ? alt : !alt);
    if (play) return playGame(a.x);
    if (a.x) return busy('Simulating…', () => { DY.simGame(a.x); advanceAfterGame(); V.tab = 'home'; });
    busy(g.phase === 'season' ? `Simulating week ${g.week}…` : 'Simulating…', () => advanceAfterGame());
  }
  // sim several weeks at once
  function simAhead(to) {
    const g = G();
    const lab = { mid: 'midseason', reg: 'the end of the regular season', end: 'the end of the season' }[to];
    busy(`Simming to ${lab}…`, () => {
      if (g.phase === 'preseason') { if (DY.autoCamp) DY.autoCamp(); DY.startSeason(); }
      let n = 0;
      while (n++ < 60) {
        if (to === 'mid' && (g.phase !== 'season' || g.week >= 7)) break;
        if (to === 'reg' && g.phase !== 'season') break;
        if (to === 'end' && g.phase === 'offseason') break;
        if (g.phase === 'season') { const x = DY.userGames(g.week)[0]; if (x && !x.res) DY.simGame(x); DY.finishWeek(); }
        else if (g.phase === 'ccg') { const x = DY.postUserGame(); if (x) DY.simGame(x); DY.finishCCG(); }
        else if (g.phase === 'post') { const x = DY.postUserGame(); if (x) DY.simGame(x); DY.finishRound(); }
        else break;
      }
      V.tab = 'home';
    });
  }
  function playGame(x) {
    APP.innerHTML = `<div class="dy dygame"><div class="wrap"><div class="gcrumb"><a href="#" data-leave="1">‹ Back to the dynasty</a> <span class="dim small">(the game is saved where you leave it)</span></div><div class="dy-game"></div></div><div class="dy-modal" id="dyModal" hidden><div class="dy-modal-in" role="dialog" aria-modal="true"><button class="dy-x" data-act="close" aria-label="Close">×</button><div id="dyModalBody"></div></div></div></div>`;
    APP.firstElementChild.onclick = e => {
      const a = e.target.closest('[data-leave]'); if (a) { e.preventDefault(); const live = root.DYG.live(); if (live) DY.saveSlot(G().slot || 1, live); root.DYG.close(); hub(); return; }
      const pl = e.target.closest('[data-pid]'); if (pl) { e.preventDefault(); playerCard(+pl.dataset.pid); return; }
      if (e.target.closest('[data-act="close"]')) closeModal();
    };
    root.DYG.open(APP.querySelector('.dy-game'), x, { onDone: () => { busy('Finishing the week…', () => { advanceAfterGame(); V.tab = 'home'; }); } });
    root.scrollTo(0, 0);
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const el = e.target.closest('[data-tab],[data-act],[data-pid],[data-pedit],[data-psave],[data-push],[data-rid],[data-box],[data-sort],[data-rpos],[data-dmove],[data-ract],[data-roffer],[data-radd],[data-rrm],[data-nilans],[data-retain],[data-poffer],[data-conf],[data-ppos],[data-prpos],[data-statk],[data-stab],[data-more],[data-slot],[data-set],[data-rfind],[data-goto],[data-recs],[data-ahead],[data-dview],[data-nilstep],[data-persuade],[data-cut],[data-camp],[data-nilf],[data-dunit],[data-dproj],[data-gside]');
    if (!el) { const m = APP.querySelector('.dy-menu-in'); if (m && !m.hidden && !e.target.closest('.dy-menu')) m.hidden = true; return; }
    const g = G(), d = el.dataset;
    if (el.tagName === 'A') e.preventDefault();
    if (d.tab) { V.tab = d.tab; V.msg = null; return hub(); }
    if (d.goto) { V.tab = d.goto; root.scrollTo(0, 0); return hub(); }
    if (d.act === 'main') return mainAction(false);
    if (d.act === 'sim') return mainAction(true);
    if (d.act === 'simmenu') { const m = el.parentNode.querySelector('.dy-menu-in'); m.hidden = !m.hidden; return; }
    if (d.ahead) return simAhead(d.ahead);
    if (d.act === 'save') { el.disabled = true; el.textContent = 'Saving…'; return DY.saveSlot(g.slot || 1, null).then(err => { V.msg = err || `Saved to slot ${g.slot || 1}.`; hub(); }); }
    if (d.act === 'msgx') { V.msg = null; return hub(); }
    if (d.act === 'close') return closeModal();
    if (d.act === 'resume') { const x = g.sched.concat(g.post ? (g.post.games || []).concat(g.post.cur || [], g.post.bowls || []) : []).find(y => y.id === g.live.id); if (x) return playGame(x); }
    if (d.act === 'quit') { DY.G = null; return landing(); }
    if (d.act === 'export') return DY.exportBlob(null).then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `vol-dynasty-${g.season}.vdyn`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
    if (d.act === 'autodepth') { const t = DY.userT(); t.depthEdited = false; DY.refreshDepth(t); return keep(); }
    if (d.act === 'portalround') return busy('Players are making their decisions…', () => DY.resolvePortal(false));
    if (d.act === 'ncauto') { g.nonconfPick[g.season + 1] = DY.autoNonconf(g.season + 1); return keep(); }
    if (d.act === 'autocuts') { g.off.cut = []; const need = DY.cutsNeeded(); DY.userT().roster.map(DY.P).sort((a, b) => DY.cutScore(a) - DY.cutScore(b)).slice(0, need).forEach(p => g.off.cut.push(p.id)); return keep(); }
    if (d.push) { V.msg = DY.encourage(+d.push); closeModal(); return keep(); }
    if (d.pedit) return editCard(+d.pedit);
    if (d.psave) { V.msg = saveEdit(+d.psave); closeModal(); return keep(); }
    if (d.pid) return playerCard(+d.pid);
    if (d.rid) return prospectCard(+d.rid);
    if (d.box) return boxModal(d.box);
    if (d.sort) { V.rsort = d.sort; return keep(); }
    if (d.rpos) { V.rpos = d.rpos; return keep(); }
    if (d.ppos) { V.ppos = d.ppos; return keep(); }
    if (d.prpos) { V.prpos = d.prpos; return keep(); }
    if (d.statk) { V.statk = d.statk; return keep(); }
    if (d.stab) { V.stab = d.stab; return keep(); }
    if (d.more) { V.more[d.more] = !V.more[d.more]; return keep(); }
    if (d.recs) { V.recs = d.recs; return keep(); }
    if (d.nilf) { V.nilf = d.nilf; return keep(); }
    if (d.dunit) { V.dunit = d.dunit; return keep(); }
    if (d.dproj) { V.dproj = d.dproj === '1'; return keep(); }
    if (d.gside) { V.gside = d.gside; return keep(); }
    if (d.dview) { V.dview = d.dview; return keep(); }
    if (d.conf) { V.conf = d.conf; return keep(); }
    if (d.slot) { const n = +d.slot; g.slot = n; return DY.saveSlot(n, null).then(err => { V.msg = err || `Saved to slot ${n}.`; hub(); }); }
    if (d.dmove) { const [pos, id, dir] = d.dmove.split('|'); const t = DY.userT(), arr = t.depth[pos], i = arr.indexOf(+id), j = i + (+dir); if (j >= 0 && j < arr.length) { [arr[i], arr[j]] = [arr[j], arr[i]]; t.depthEdited = true; } return keep(); }
    if (d.ract) { const [id, act] = d.ract.split('|'); const p = DY.RP(+id); V.msg = DY.setAct(+id, act, !p.acts[act]); return keep(); }
    if (d.roffer) { V.msg = DY.offer(+d.roffer); return keep(); }
    if (d.radd) { V.msg = DY.boardAdd(+d.radd); return keep(); }
    if (d.rrm) { DY.boardRemove(+d.rrm); return keep(); }
    if (d.rfind) { const [k, v] = d.rfind.split('|'); V.rfind[k] = k === 'stars' ? +v : k === 'mine' ? !V.rfind.mine : v; return keep(); }
    if (d.nilans) { const [id, yes] = d.nilans.split('|'); DY.answerNil(+id, yes === '1'); return keep(); }
    if (d.nilstep) { const [id, dir] = d.nilstep.split('|'); const p = DY.P(+id); const step = Math.max(5000, Math.round(Math.max(p.nil, 20000) * 0.1 / 5000) * 5000); V.msg = DY.adjustNil(+id, p.nil + (+dir) * step); return keep(); }
    if (d.persuade) { const inp = APP.querySelector(`[data-persamt="${d.persuade}"]`); V.msg = DY.persuade(+d.persuade, +(inp && inp.value) || 0); return keep(); }
    if (d.retain) { const inp = APP.querySelector(`[data-retainamt="${d.retain}"]`); V.msg = DY.retain(+d.retain, +(inp && inp.value) || 0); return keep(); }
    if (d.poffer) { const inp = APP.querySelector(`[data-pofferamt="${d.poffer}"]`); V.msg = DY.portalOffer(+d.poffer, +(inp && inp.value) || 0) || 'Offer made.'; return keep(); }
    if (d.cut) { DY.toggleCut(+d.cut); return keep(); }
    if (d.camp) { const [id, f] = d.camp.split('|'); V.msg = DY.campPlayer(+id, f); return keep(); }
    if (d.set) { const [k, v] = d.set.split('|'); g.settings[k] = v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? +v : v; if (k === 'difficulty') g.settings.diffBoost = DY.DIFF[v] || 0; if (k === 'offStyle') DY.userT().style = v; return keep(); }
  }
  function keep() { const y = root.scrollY; hub(); root.scrollTo(0, y); }
  function onChange(e) {
    const el = e.target, g = G();
    if (el.dataset.ret) { const t = DY.userT(); t[el.dataset.ret] = el.value ? +el.value : null; return keep(); }
    if (el.dataset.rot) { const t = DY.userT(); t.rot = Object.assign({}, DY.ROT_DEFAULT, t.rot || {}); t.rot[el.dataset.rot] = +el.value; V.rotOpen = true; return keep(); }
    if (el.dataset.rnil) { V.msg = DY.setNil(+el.dataset.rnil, +el.value); return keep(); }
    if (el.dataset.rvisit) { V.msg = DY.setVisit(+el.dataset.rvisit, +el.value) || 'Official visit scheduled.'; return keep(); }
    if (el.dataset.nc) { const [i, k] = el.dataset.nc.split('|'); const arr = g.nonconfPick[g.season + 1]; arr[+i][k] = k === 'home' ? el.value === '1' : +el.value; return keep(); }
    if (el.dataset.mvpos) { const p = DY.P(+el.dataset.mvpos); if (el.value) { DY.changePos(p, el.value); const t = DY.userT(); t.depthEdited = true; DY.refreshDepth(t); V.msg = `${p.n} moved to ${el.value}${p.pos0 && DY.posFit(p, el.value) === 'poor' ? ' (out of position: big ratings hit)' : ''}. Overall at ${el.value}: ${p.ovr}.`; } return keep(); }
    if (el.id === 'dyRfq') { V.rfind.q = el.value; return keep(); }
    if (el.dataset.rfsel) { V.rfind[el.dataset.rfsel] = el.value; return keep(); }
    if (el.dataset.campsel) { const [id] = el.dataset.campsel.split('|'); if (el.value) { V.msg = DY.campPlayer(+id, el.value); keep(); } }
  }

  /* ---------- modal ---------- */
  function modal(html) { const m = APP.querySelector('#dyModal'); if (!m) return; APP.querySelector('#dyModalBody').innerHTML = html; m.hidden = false; m.onclick = e => { if (e.target === m) closeModal(); const pl = e.target.closest('[data-pid]'); if (pl && e.target.closest('#dyModalBody')) { e.preventDefault(); e.stopPropagation(); playerCard(+pl.dataset.pid); } }; document.body.classList.add('dy-noscroll'); }
  function closeModal() { const m = APP && APP.querySelector('#dyModal'); if (m) m.hidden = true; document.body.classList.remove('dy-noscroll'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && APP && APP.querySelector('#dyModal:not([hidden])')) closeModal(); });

  /* ---------- home ---------- */
  function home(b) {
    const g = G(), ut = DY.userT();
    if (g.phase === 'offseason') return offseason(b);
    const L = [], R = [];
    if (g.live && !(root.DYG && root.DYG.live())) L.push(`<div class="box dy-resume"><b>Game in progress</b> <span class="dim">${esc(T(g.live.T.a).name)} ${g.live.score.a}, ${esc(T(g.live.T.h).name)} ${g.live.score.h} · Q${Math.min(4, g.live.q)}</span> <button class="btn primary" data-act="resume">Resume</button></div>`);
    const a = primaryAction();
    if (a && a.x) L.push(nextGameCard(a.x, a));
    else if (g.phase === 'preseason') L.push(preseasonCard());
    else if (g.phase === 'season') L.push(`<div class="box"><div class="glabel">Week ${g.week}</div><h3>Bye week</h3><p class="dim">Rest up. Recruiting actions still count this week.</p></div>`);
    if (g.phase === 'post' || g.phase === 'ccg') L.push(bracketCard());
    const last = DY.teamGames(ut.id).filter(x => x.res).slice(-1)[0];
    if (last) L.push(lastGameCard(last));
    L.push(aroundCard(), newsCard(), fieldCard());
    R.push(pollMini(), standMini(), injuriesMini(), recruitMini(), leadersMini(), captainsMini());
    b.innerHTML = `<div class="dy-grid"><div class="dy-col">${L.join('')}</div><div class="dy-col">${R.join('')}</div></div>`;
  }
  function matchBars(a, b) {
    const A = DY.teamOvr(a), B = DY.teamOvr(b);
    const row = (l, x, y) => `<div class="dy-mrow"><span>${x}</span><div class="dy-mbar"><i style="width:${Math.max(8, Math.min(92, 50 + (x - y) * 3))}%;background:${a.c1}"></i><i style="background:${b.c1}"></i></div><span>${y}</span><small>${l}</small></div>`;
    return `<div class="dy-match">${row('Overall', A.ovr, B.ovr)}${row('Offense', A.off, B.off)}${row('Defense', A.def, B.def)}</div>`;
  }
  function nextGameCard(x, a) {
    const g = G(), ut = DY.userT(), o = T(DY.oppOf(x)), home = x.h === ut.id;
    const L = DY.lineup(o), qb = L.QB[0];
    const star = o.roster.map(DY.P).sort((a, b) => b.ovr - a.ovr)[0];
    const opts = DY.gameOpts(x), sr = g.series && g.series[o.name];
    const date = x.post ? '' : DY.dateStr(DY.weekDate(g.season, x.wk));
    return `<div class="box dy-next" style="--tc:${o.c1}">
      <div class="dy-next-top"><span class="glabel">${x.post ? esc(x.title) : `Week ${x.wk} · ${date}`}</span>${opts.rival ? tag(opts.rival) : ''}${opts.big ? tag('Big game') : ''}</div>
      <div class="dy-vs"><div class="dy-vs-t">${tlink(ut.id)}<small>${ut.w}-${ut.l}</small></div><b>${x.neutral ? 'vs' : home ? 'vs' : 'at'}</b><div class="dy-vs-t r">${tlink(o.id)}<small>${o.fbs ? o.w + '-' + o.l + ' · ' : ''}${esc(DY.CONF_NAME[o.conf])}</small></div></div>
      <p class="dim small">${x.neutral ? 'Neutral site' + (x.tag && /Neutral/.test(x.tag) ? ' · ' + esc(x.tag.replace('Neutral: ', '')) : '') : home ? 'Neyland Stadium, Knoxville' : esc(o.name) + ' home game'} · ${esc((DY.STYLES[o.style] || DY.STYLES.spread).name)} offense${sr ? ` · Series in this dynasty: ${sr.w}-${sr.l}` : ''}</p>
      ${matchBars(ut, o)}
      <p class="small">Players to watch: ${plink(qb, qb.n)} (QB, ${qb.ovr})${star && star !== qb ? `, ${plink(star)} (${star.pos}, ${star.ovr})` : ''}</p>
      <div class="grow"><button class="btn primary big" data-act="main">${a && a.simOnly ? 'Sim the game' : 'Play the game'}</button><button class="btn" data-act="sim">${a && a.simOnly ? 'Play it instead' : 'Sim it'}</button></div></div>`;
  }
  function preseasonCard() {
    const g = G(), ut = DY.userT(), o = DY.teamOvr(ut), games = DY.userGames();
    const camp = (g.camp && g.camp.y === g.season ? g.camp.list : []) || [];
    const cands = ut.roster.map(DY.P).filter(p => !camp.some(c => c.id === p.id)).sort((a, b) => a.n.localeCompare(b.n));
    return `<div class="box"><div class="glabel">${g.season} season preview</div><h3>${esc(ut.name)} opens No. ${DY.apRank(ut.id) || 'NR'}</h3>
      <p class="dim">Team overall ${o.ovr} (offense ${o.off}, defense ${o.def}). ${esc((DY.STYLES[ut.style] || DY.STYLES.power).name)} offense. NIL budget ${DY.money(ut.budget)}.</p>
      <ol class="dy-sched-mini">${games.map(x => `<li><span>Wk ${x.wk}</span> ${x.h === ut.id ? 'vs' : 'at'} ${tlink(DY.oppOf(x))}${x.tag ? ' ' + tag(x.tag) : ''}</li>`).join('')}</ol></div>
      <div class="box"><div class="glabel">Preseason camp · ${camp.length}/${DY.CAMP_MAX} spots</div><p class="dim small">Send up to four players to a camp focus for a small boost (or work on raising one player's ceiling). Unused spots are filled by your staff when the season starts.</p>
      ${camp.length ? `<ul class="dy-mini">${camp.map(c => `<li>${plink(DY.P(c.id))} <small>${esc(DY.CAMP_FOCUS[c.f][0])} · ${c.d >= 0 ? '+' : ''}${c.d}</small></li>`).join('')}</ul>` : ''}
      ${camp.length < DY.CAMP_MAX ? `<input id="dyCampQ" class="dy-in" type="search" placeholder="Search a player or position (e.g. Bishop, WR)" autocomplete="off"><p class="dim small" id="dyCampHint">Type to find a player.</p><div class="dy-scroll"><table class="dyt dy-tight" id="dyCampT"><tbody>${cands.map(p => `<tr hidden data-campq="${esc((p.n + ' ' + p.pos).toLowerCase())}"><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></td><td>${ovrB(p.ovr)} <span class="dy-pot">${p.potG}</span></td><td><select data-campsel="${p.id}"><option value="">Camp focus…</option>${Object.entries(DY.CAMP_FOCUS).filter(([k, f]) => k === 'pot' || f[1].some(a => p.at[a] != null)).map(([k, f]) => `<option value="${k}">${esc(f[0])}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="grow"><button class="btn primary big" data-act="main">Kick off the season</button><button class="btn" data-goto="depth">Set the depth chart</button></div></div>`;
  }
  function lastGameCard(x) {
    const ut = DY.userT(), us = x.h === ut.id ? x.res.h : x.res.a, th = x.h === ut.id ? x.res.a : x.res.h, o = DY.oppOf(x);
    const top = x.box && x.box.top && x.box.top.find(t => t.s === (x.h === ut.id ? 'h' : 'a'));
    return `<div class="box"><div class="glabel">Last game</div><h3 class="${us > th ? 'dy-w' : 'dy-l'}">${us > th ? 'W' : 'L'} ${us}-${th} ${x.h === ut.id ? 'vs' : 'at'} ${tlink(o)}${x.res.ot ? ' (OT)' : ''}</h3>
      ${top ? `<div class="dy-top">${['qb', 'rb', 'wr', 'df'].filter(k => top[k]).map(k => `<span>${plink(DY.P(top[k][0]))} ${esc(top[k][1])}</span>`).join('')}</div>` : ''}
      ${x.box && x.box.ts ? `<button class="glink" data-box="${x.id}">Box score</button>` : ''}</div>`;
  }
  function aroundCard() {
    const g = G(), w = g.phase === 'season' ? g.week - 1 : null;
    let games = [];
    if (g.phase === 'season' && w >= 0) games = DY.weekGames(w).filter(x => x.res && (DY.apRank(x.h) || DY.apRank(x.a)));
    else if (g.post) games = ((g.post.rounds || []).length ? g.post.rounds[g.post.rounds.length - 1] : (g.post.games || [])).filter(x => x.res);
    if (!games.length) return '';
    return `<div class="box"><div class="glabel">Around the country${w ? ' · Week ' + w : ''}</div><ul class="dy-scores">${games.slice(0, 10).map(x => { const hw = x.res.h > x.res.a; return `<li><span class="${hw ? '' : 'dy-win'}">${tlink(x.a)} ${x.res.a}</span><span class="${hw ? 'dy-win' : ''}">${tlink(x.h)} ${x.res.h}</span>${x.title ? `<em>${esc(x.title)}</em>` : ''}</li>`; }).join('')}</ul></div>`;
  }
  function newsCard() {
    const g = G(), n = V.more.news ? 30 : 6;
    return `<div class="box"><div class="glabel">News</div><ul class="dy-news">${g.news.slice(0, n).map(n => `<li class="n-${n.type}"><b>${esc(n.h)}</b>${n.b ? `<span>${esc(n.b)}</span>` : ''}<small>${n.y} · ${n.ph === 'season' ? 'Week ' + n.w : esc(n.ph)}</small></li>`).join('')}</ul>${g.news.length > 6 ? `<button class="glink" data-more="news">${V.more.news ? 'Show less' : 'More news'}</button>` : ''}</div>`;
  }
  // starters on a field, Madden-style
  function fieldCard() {
    const ut = DY.userT(), L = DY.lineup(ut), off = V.dview !== 'def';
    const P = (p, x, y, lab) => p ? `<a href="#" class="dy-fp${p.ovr >= 90 ? ' star' : ''}" data-pid="${p.id}" style="left:${x}%;top:${y}%"><b>${p.ovr}</b><span>${esc(DY.lastName(p))}</span><i>${lab}</i></a>` : '';
    const offHtml = [
      P(L.WR[0], 7, 16, 'WR'), P(L.OT[0], 31, 16, 'LT'), P(L.IOL[0], 40.5, 16, 'LG'), P(L.IOL[1], 50, 16, 'C'), P(L.IOL[2], 59.5, 16, 'RG'), P(L.OT[1], 69, 16, 'RT'), P(L.TE[0], 79, 22, 'TE'), P(L.WR[1], 93, 16, 'WR'),
      P(L.WR[2], 17, 42, 'SLOT'), P(L.QB[0], 50, 52, 'QB'), P(L.RB[0], 50, 78, 'RB'),
    ].join('');
    const defHtml = [
      P(L.CB[0], 6, 74, 'CB'), P(L.EDGE[0], 31, 76, 'EDGE'), P(L.DT[0], 43.5, 76, 'DT'), P(L.DT[1], 56.5, 76, 'DT'), P(L.EDGE[1], 69, 76, 'EDGE'), P(L.CB[1], 94, 74, 'CB'),
      P(L.LB[0], 40, 46, 'LB'), P(L.LB[1], 60, 46, 'LB'), P(L.NB, 19, 62, 'NB'), P(L.S[0], 27, 15, 'FS'), P(L.S[1], 73, 15, 'SS'),
    ].join('');
    const o = DY.teamOvr(ut);
    return `<div class="box"><div class="glabel">Starters <span class="gseg dy-seg-sm"><button data-dview="off" aria-pressed="${off}">Offense ${o.off}</button><button data-dview="def" aria-pressed="${!off}">Defense ${o.def}</button></span></div>
      <div class="dy-field ${off ? 'o' : 'd'}"><div class="dy-los"></div>${off ? offHtml : defHtml}</div><button class="glink" data-goto="depth">Edit the depth chart</button></div>`;
  }
  function pollMini() {
    const g = G();
    return `<div class="box"><div class="glabel">AP Top 25 <button class="glink" data-goto="polls">All</button></div><ol class="dy-poll">${g.polls.ap.slice(0, 10).map((x, i) => `<li class="${x.t === g.user ? 'me' : ''}"><span>${i + 1}</span>${tlink(x.t, false)}<small>${T(x.t).w}-${T(x.t).l}</small></li>`).join('')}</ol>${DY.apRank(g.user) > 10 ? `<p class="small">${esc(DY.UN())}: No. ${DY.apRank(g.user)}</p>` : ''}</div>`;
  }
  function standMini() {
    const st = DY.standings(DY.userT().conf), me = st.findIndex(t => t.user);
    const rows = st.slice(0, 10); if (me >= 10) rows.push(st[me]);
    return `<div class="box"><div class="glabel">SEC standings <button class="glink" data-goto="standings">All 16</button></div><table class="dyt dy-tight"><tbody>${rows.map(t => `<tr class="${t.user ? 'me' : ''}"><td>${st.indexOf(t) + 1}</td><td>${tlink(t.id, false)}${t.ap ? ` <small class="dim">(${t.ap})</small>` : ''}</td><td>${t.cw}-${t.cl}</td><td class="dim">${t.w}-${t.l}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function recruitMini() {
    const g = G(), R = g.recruit; if (!R) return '';
    const c = DY.myCommits().sort((a, b) => b.rec.c - a.rec.c);
    return `<div class="box"><div class="glabel">Class of ${R.year} <button class="glink" data-goto="recruit">Recruiting</button></div><p><b>No. ${R.classRank || '—'}</b> class · ${c.length} commits${R.locked ? ' · locked' : g.settings.recruiting === 'manual' && !R.signed ? ` · ${DY.HOURS() - DY.hoursUsed()} hours left` : ''}</p><ul class="dy-mini">${c.slice(0, 4).map(p => `<li><span class="dy-stars">${stars(p.rec.stars)}</span> <a href="#" class="dy-pl" data-rid="${p.id}">${esc(p.n)}</a> <small>${p.pos}</small></li>`).join('')}</ul></div>`;
  }
  function leadersMini() {
    const ut = DY.userT(), ps = ut.roster.map(DY.P).filter(p => sStats(p));
    const best = (k, l, f) => { const p = ps.filter(x => sStats(x)[k]).sort((a, b) => sStats(b)[k] - sStats(a)[k])[0]; return p ? `<li><small>${l}</small> ${plink(p)} ${f(sStats(p))}</li>` : ''; };
    const html = best('py', 'Passing', s => `${s.py} yds, ${s.ptd || 0} TD`) + best('ry', 'Rushing', s => `${s.ry} yds, ${s.rtd || 0} TD`) + best('rcy', 'Receiving', s => `${s.rcy} yds, ${s.rctd || 0} TD`) + best('tk', 'Tackles', s => s.tk) + best('sck', 'Sacks', s => s.sck);
    return html ? `<div class="box"><div class="glabel">Team leaders <button class="glink" data-goto="stats">Stats</button></div><ul class="dy-mini">${html}</ul></div>` : '';
  }
  function injuriesMini() {
    const ut = DY.userT(), inj = ut.roster.map(DY.P).filter(p => p.inj && p.inj.wks > 0).sort((a, b) => b.ovr - a.ovr);
    return `<div class="box"><div class="glabel">Injury report</div>${inj.length ? `<ul class="dy-mini">${inj.map(p => `<li>${plink(p)} <small>${p.pos} · ${esc(p.inj.what)} · out ${p.inj.wks >= 12 ? 'for the season' : p.inj.wks + ' wk'}</small></li>`).join('')}</ul>` : '<p class="dim small">Everyone is healthy.</p>'}</div>`;
  }
  function captainsMini() {
    const ut = DY.userT(), caps = ut.roster.map(DY.P).filter(p => p.captain);
    return caps.length ? `<div class="box"><div class="glabel">Team captains</div><ul class="dy-mini">${caps.map(p => `<li>${plink(p)} <small>${p.pos} · ${yrLabel(p)} · leadership ${p.tr.lead}</small></li>`).join('')}</ul><p class="dim small">Captains steady the team in big moments and on the road.</p></div>` : '';
  }
  function bracketCard() {
    const g = G(), P = g.post; if (!P) return '';
    if (P.stage === 'ccg') return `<div class="box"><div class="glabel">Championship week</div><ul class="dy-scores">${P.games.map(x => `<li><span>${tlink(x.a)} ${x.res ? x.res.a : ''}</span><span>${tlink(x.h)} ${x.res ? x.res.h : ''}</span><em>${esc(x.title)}</em></li>`).join('')}</ul></div>`;
    const rounds = P.rounds.concat(P.cur && !P.rounds.includes(P.cur) ? [P.cur] : []);
    const seed = id => P.seeds.indexOf(id) + 1;
    const mine = P.bowls.find(x => x.h === g.user || x.a === g.user);
    return `<div class="box"><div class="glabel">College Football Playoff · ${P.size} teams</div>
      <ol class="dy-seeds">${P.seeds.map((id, i) => `<li class="${id === g.user ? 'me' : ''}"><span>${i + 1}</span>${tlink(id, false)}<small>${T(id).w}-${T(id).l}${T(id).champ === g.season ? ' · champ' : ''}${P.size === 24 && i < 8 ? ' · bye' : P.size === 12 && i < 4 ? ' · bye' : ''}</small></li>`).join('')}</ol>
      ${rounds.map(rd => `<div class="dy-round"><div class="glabel">${esc((rd[0] && rd[0].title || '').replace(/^.*\(|\)$/g, '').replace(/^(Rose|Sugar|Orange|Cotton|Fiesta|Peach) Bowl /, '') || 'Round')}</div>${rd.map(x => `<div class="dy-bm ${x.res ? 'done' : ''}"><span class="${x.res && x.res.a > x.res.h ? 'dy-win' : ''}">(${seed(x.a)}) ${tlink(x.a, false)} ${x.res ? x.res.a : ''}</span><span class="${x.res && x.res.h > x.res.a ? 'dy-win' : ''}">(${seed(x.h)}) ${tlink(x.h, false)} ${x.res ? x.res.h : ''}</span><em>${esc(x.title.replace(/ \(CFP.*/, ''))}${x.neutral ? '' : ' · on campus'}</em></div>`).join('')}</div>`).join('')}
      ${mine ? `<p><b>${esc(DY.UN())}'s bowl:</b> ${esc(mine.title)} vs ${tlink(mine.h === g.user ? mine.a : mine.h)}${mine.res ? ` · ${mine.h === g.user ? mine.res.h + '-' + mine.res.a : mine.res.a + '-' + mine.res.h}` : ''}</p>` : ''}</div>`;
  }

  /* ---------- schedule ---------- */
  function schedule(b) {
    const g = G(), ut = DY.userT();
    const games = DY.userGames().concat(g.post ? [...(g.post.games || []), ...(g.post.rounds || []).flat(), ...(g.post.cur && !(g.post.rounds || []).includes(g.post.cur) ? g.post.cur : []), ...(g.post.bowls || [])].filter((x, i, arr) => (x.h === ut.id || x.a === ut.id) && arr.indexOf(x) === i) : []);
    b.innerHTML = `<div class="box"><div class="glabel">${g.season} schedule</div><table class="dyt dy-sched"><thead><tr><th>Wk</th><th>Date</th><th>Opponent</th><th>Result</th><th class="hide-s"></th></tr></thead><tbody>${games.map(x => {
      const o = DY.oppOf(x), home = x.h === ut.id, r = x.res, us = r && (home ? r.h : r.a), th = r && (home ? r.a : r.h);
      return `<tr class="${g.phase === 'season' && x.wk === g.week ? 'cur' : ''}"><td>${x.post ? '—' : x.wk}</td><td>${x.post ? '' : DY.dateStr(DY.weekDate(g.season, x.wk))}</td><td>${x.neutral ? 'vs' : home ? 'vs' : 'at'} ${tlink(o)} <small class="dim">${T(o).fbs ? T(o).w + '-' + T(o).l : 'FCS'}</small>${x.title ? ' ' + tag(x.title) : x.tag ? ' ' + tag(x.tag) : ''}</td><td>${r ? `<b class="${us > th ? 'dy-w' : 'dy-l'}">${us > th ? 'W' : 'L'} ${us}-${th}${r.ot ? ' OT' : ''}</b>` : ''}</td><td class="hide-s">${r && x.box && x.box.ts ? `<button class="glink" data-box="${x.id}">Box</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function boxModal(id) {
    const g = G(), x = g.sched.concat(g.post ? [...(g.post.games || []), ...(g.post.rounds || []).flat(), ...(g.post.bowls || [])] : []).find(y => y.id === id);
    if (!x || !x.box) return;
    modal(`<h3>${esc(T(x.a).name)} ${x.res.a}, ${esc(T(x.h).name)} ${x.res.h}</h3>${root.DYG.boxHtml({ h: T(x.h), a: T(x.a) }, x.box.ts, x.box.ls, x.box.ps || {})}`);
  }

  /* ---------- roster ---------- */
  function roster(b) {
    const ut = DY.userT();
    let ps = ut.roster.map(DY.P);
    if (V.rpos === 'INJ') ps = ps.filter(p => p.inj && p.inj.wks > 0); else if (V.rpos !== 'ALL') ps = ps.filter(p => p.pos === V.rpos);
    const sorters = { ovr: (a, b) => b.ovr - a.ovr, pot: (a, b) => DY.gradeIdx(a.potG) - DY.gradeIdx(b.potG) || b.ovr - a.ovr, yr: (a, b) => b.yr - a.yr || b.ovr - a.ovr, num: (a, b) => a.num - b.num, name: (a, b) => a.n.localeCompare(b.n), nil: (a, b) => (b.nil || 0) - (a.nil || 0) };
    ps.sort(sorters[V.rsort] || sorters.ovr);
    const posList = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'IOL', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P', 'INJ'];
    const th = (k, l) => `<th><button class="dy-sortb ${V.rsort === k ? 'on' : ''}" data-sort="${k}">${l}</button></th>`;
    b.innerHTML = `<div class="box"><div class="glabel">Roster · ${ut.roster.length} of ${DY.rosterMax()} · team ${DY.teamOvr(ut).ovr} OVR</div>
      <div class="gchips dy-chips">${posList.map(p => `<button data-rpos="${p}" aria-pressed="${V.rpos === p}">${p === 'ALL' ? 'All' : p === 'INJ' ? 'Injured' : p}</button>`).join('')}</div>
      <div class="dy-scroll"><table class="dyt dy-roster"><thead><tr>${th('num', '#')}${th('name', 'Name')}<th>Pos</th>${th('yr', 'Class')}${th('ovr', 'OVR')}${th('pot', 'POT')}<th class="hide-s">Recruit</th><th class="hide-s">Type</th><th class="hide-s">Personality</th>${th('nil', 'NIL')}</tr></thead><tbody>
      ${ps.map(p => `<tr class="${p.inj && p.inj.wks > 0 ? 'inj' : ''}"><td>${p.num}</td><td>${plink(p)}${p.prevT != null ? ' <small class="dim">TR</small>' : ''}${p.inj && p.inj.wks > 0 ? ' <small class="dy-l">INJ</small>' : ''}</td><td>${p.pos}${p.pos0 ? `<small class="dim"> (${p.pos0})</small>` : ''}</td><td>${yrLabel(p)}</td><td>${ovrB(p.ovr)}</td><td><span class="dy-pot">${p.potG}</span></td><td class="hide-s">${recLabel(p)}</td><td class="hide-s small">${esc(p.arch)}</td><td class="hide-s small">${esc(DY.persLabel(p)[0])}</td><td class="small">${DY.money(p.nil || 0)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }

  /* ---------- player card ---------- */
  // editing a generated player: name, number and bio (never the ratings)
  function editCard(id) {
    const p = DY.P(id); if (!p || p.real) return;
    const f = (k, l, v, extra) => `<label class="dy-edrow"><span>${l}</span><input class="dy-in" data-ed="${k}" value="${esc(v == null ? '' : v)}" ${extra || ''}></label>`;
    modal(`<h3>Edit ${esc(p.n)}</h3><p class="small dim">Ratings, potential and personality can't be changed here. Two players can share a number only if one plays offense and the other defense; kickers, punters and snappers need their own.</p>
      ${f('n', 'Name', p.n, 'maxlength="32"')}${f('num', 'Number', p.num, 'inputmode="numeric" maxlength="2"')}${f('home', 'Hometown', p.home, 'maxlength="40"')}${f('hs', 'High school', p.hs || '', 'maxlength="40"')}
      ${f('ht', 'Height (ft-in)', Math.floor(p.ht / 12) + '-' + p.ht % 12, 'maxlength="5"')}${f('wt', 'Weight (lbs)', p.wt, 'inputmode="numeric" maxlength="3"')}
      <div class="grow"><button class="btn primary" data-psave="${p.id}">Save</button><button class="btn" data-pid="${p.id}">Cancel</button></div>`);
  }
  function saveEdit(id) {
    const p = DY.P(id), val = k => { const el = APP.querySelector(`[data-ed="${k}"]`); return el ? el.value.trim() : null; };
    if (!p || p.real) return null;
    const msgs = [];
    const n = val('n'); if (n && n.length >= 2) p.n = n.replace(/\s+/g, ' ');
    const home = val('home'); if (home) p.home = home;
    const hs = val('hs'); if (hs != null) p.hs = hs || p.hs;
    const num = val('num');
    if (num !== '' && num != null) {
      const v = parseInt(num, 10), t = p.t != null ? T(p.t) : null, side = DY.SIDE(p.pos);
      const taken = t && t.roster.map(DY.P).find(q => q && q !== p && q.num === v && (side === 'ST' || DY.SIDE(q.pos) === 'ST' || DY.SIDE(q.pos) === side));
      if (!(v >= 0 && v <= 99)) msgs.push('Numbers run 0-99.');
      else if (taken) msgs.push(`No. ${v} belongs to ${taken.n} (${taken.pos}).`);
      else p.num = v;
    }
    const ht = val('ht'); if (ht) { const m = ht.match(/^(\d)\D+(\d{1,2})$/); if (m && +m[2] < 12) p.ht = +m[1] * 12 + +m[2]; else msgs.push('Height looks like 6-2.'); }
    const wt = parseInt(val('wt'), 10); if (wt >= 140 && wt <= 400) p.wt = wt; else if (val('wt')) msgs.push('Weight runs 140-400.');
    return msgs.length ? `Saved, except: ${msgs.join(' ')}` : `${p.n} updated.`;
  }
  function playerCard(id) {
    const p = DY.P(id); if (!p) return;
    const t = p.t != null ? T(p.t) : (p.t0 != null ? T(p.t0) : null), g = G();
    const hideT = !!(p.portal && p.portal.from !== g.user);
    const [pl, pd] = DY.persLabel(p);
    const keys = Object.keys(DY.W[p.pos]).concat((DY.EXTRA[p.pos] || []).map(x => x[0])).filter((k, i, a) => a.indexOf(k) === i && p.at[k] != null);
    const bar = (l, v) => `<div class="dy-attr"><span>${esc(l)}</span><div class="dy-ab"><i class="${ovrCls(v)}" style="width:${v}%"></i></div><b>${v}</b></div>`;
    const car = Object.entries(p.car || {}).sort((a, b) => a[0] - b[0]);
    const cols = statCols(p.pos);
    const seasonRows = car.map(([y, s]) => `<tr class="${s.real ? 'real' : ''}"><td>${y}${s.real ? ' <small class="dim">real</small>' : ''}</td><td>${esc(s.t || '')}</td><td>${s.gp || 0}</td>${cols.map(c => `<td>${c[1](s)}</td>`).join('')}</tr>`).join('') + (p.s ? `<tr class="cur"><td>${g.season}</td><td>${t ? esc(t.abbr) : ''}</td><td>${p.s.gp || 0}</td>${cols.map(c => `<td>${c[1](p.s)}</td>`).join('')}</tr>` : '');
    const totS = {}; car.forEach(([, s]) => { for (const k in s) if (typeof s[k] === 'number') totS[k] = (totS[k] || 0) + s[k]; }); if (p.s) for (const k in p.s) if (typeof p.s[k] === 'number') totS[k] = (totS[k] || 0) + p.s[k];
    const careerRow = car.length + (p.s ? 1 : 0) > 1 ? `<tr class="tot"><td><b>Career</b></td><td></td><td>${totS.gp || 0}</td>${cols.map(c => `<td><b>${c[1](totS)}</b></td>`).join('')}</tr>` : '';
    const chase = p.t === g.user && g.rec ? Object.entries(DY.REC_MAP).map(([name, k]) => { const r = g.rec.career[k], v = DY.careerTotal(p, k, true); if (!r || !v) return ''; if (r.pid === p.id) return `<li><b>${esc(DY.UN())}'s all-time leader</b> in career ${esc(name.toLowerCase())} (${v}).</li>`; return v >= r.v * 0.45 ? `<li>${v} career ${esc(name.toLowerCase())}: <b>${r.v - v + 1}</b> to pass ${esc(r.n)} (${r.v}) for the school record.</li>` : ''; }).join('') : '';
    const realCar = p.realCar ? Object.entries(p.realCar).filter(([y]) => +y < g.startSeason).map(([y, s]) => `${y}: ${s.pass ? s.pass[2] + ' pass yds' : ''}${s.rush ? ' ' + s.rush[1] + ' rush yds' : ''}${s.rec ? ' ' + s.rec[1] + ' rec yds' : ''}${s.def ? ' ' + s.def[0] + ' tkl' : ''}`).join(' · ') : '';
    const gl = (p.gl || []).filter(x => x.y === g.season).slice(-14);
    const rec = p.rec && !p.rec.walkon ? `${'★'.repeat(p.rec.stars || 0)} ${p.rec.c ? p.rec.c.toFixed(4) : ''}${p.rec.nat ? ' · No. ' + p.rec.nat + ' nationally' : ''}${p.rec.cls ? ' (' + p.rec.cls + ')' : ''}` : 'Walk-on';
    modal(`<div class="dy-pc" style="--tc:${t ? t.c1 : '#888'}">
      <div class="dy-pc-head"><div class="dy-pc-num">${p.num}</div><div><h3>${esc(p.n)}${p.captain ? ' <span class="dy-cap">C</span>' : ''}</h3><div class="dim">${esc(DY.POS_NAME[p.pos])}${p.pos0 ? ' (from ' + p.pos0 + ')' : ''} · ${yrLabel(p)} · ${DY.htStr(p.ht)}, ${p.wt} lbs · ${esc(p.home)}${p.hs ? ' · ' + esc(p.hs) : ''}</div><div class="small">${t ? esc(t.name) : 'Left the program'}${p.prev ? ' · previously ' + esc(p.prev) : ''}${p.draft ? ` · Drafted ${p.draft.y}, round ${p.draft.rd} (No. ${p.draft.pk})` : ''}</div></div>
        ${hideT ? `<div class="dy-pc-ovr"><span class="dy-tstars big">${'★'.repeat(DY.tStars(p))}</span><small>Transfer · OVR ${DY.tRange(p).join('-')}</small></div>` : `<div class="dy-pc-ovr">${ovrB(p.ovr)}<small>OVR</small><span class="dy-pot big">${p.potG}</span><small>Potential</small></div>`}</div>
      <div class="dy-pc-tags"><span class="chip">${esc(p.arch)}</span><span class="chip" title="${esc(pd)}">${esc(pl)}</span><span class="chip">${rec}</span>${p.nil ? `<span class="chip">NIL ${DY.money(p.nil)}</span>` : ''}${p.inj && p.inj.wks > 0 ? `<span class="chip dy-l">${esc(p.inj.what)} · ${p.inj.wks} wk</span>` : ''}${p.el ? `<span class="chip">${p.el} season${p.el > 1 ? 's' : ''} of eligibility</span>` : ''}</div>
      ${g.phase === 'offseason' && p.t === g.user && g.off && ['recap', 'nil', 'portal'].includes(g.off.stage) && p.tin !== g.season && !(g.off.portal && g.off.portal.round > 1) ? `<p><button class="btn" data-push="${p.id}">${p.pushOut ? 'Undo: keep him' : 'Encourage to transfer'}</button> <small class="dim">He enters the portal and frees his roster spot and NIL money.</small></p>` : ''}
      ${!p.real ? `<p><button class="btn" data-pedit="${p.id}">Edit player</button> <small class="dim">Name, number and bio. Ratings stay as they are.</small></p>` : ''}
      <p class="dy-scout"><b>Scouting report:</b> ${esc(DY.scoutReport(p))}${p.note ? ' ' + esc(p.note) : ''} <i>${esc(pd)}</i></p>
      ${p.aw && p.aw.length ? `<p class="small"><b>Honors:</b> ${p.aw.map(a => a.y + ' ' + esc(DY.AWARD_NAME[a.a] || a.a)).join(' · ')}</p>` : ''}
      ${p.honReal && p.honReal.length ? `<p class="small dim">Before the dynasty: ${esc(p.honReal.join('; '))}</p>` : ''}
      ${p.draftNote ? `<p class="small dim">Draft outlook (real): ${esc(p.draftNote)}</p>` : ''}
      <div class="dy-pc-cols"><div><div class="glabel">Ratings</div>${hideT ? '<p class="small dim">In the portal: your scouts only have a star rating and an overall range. You will see his true ratings when he signs.</p>' : keys.map(k => bar(DY.ATTR_NAME[k] || k, p.at[k])).join('')}</div>
      <div><div class="glabel">Personality</div>${Object.keys(DY.TRAITS).map(k => bar(DY.TRAITS[k], p.tr[k])).join('')}</div></div>
      ${seasonRows ? `<div class="glabel">Stats</div><div class="dy-scroll"><table class="dyt"><thead><tr><th>Year</th><th>Team</th><th>GP</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${seasonRows}${careerRow}</tbody></table></div><p class="small dim">Rows marked real are his actual Tennessee stats (cfbstats.com); the rest are this dynasty.</p>` : ''}
      ${chase ? `<div class="glabel">Record chase</div><ul class="dy-mini">${chase}</ul>` : ''}
      ${realCar ? `<p class="small dim">Real stats before 2026: ${esc(realCar)}</p>` : ''}
      ${gl.length ? `<div class="glabel">${g.season} game log</div><div class="dy-scroll"><table class="dyt"><thead><tr><th>Wk</th><th>Opp</th><th>Result</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${gl.map(x => `<tr><td>${x.w}</td><td>${x.h ? 'vs' : 'at'} ${esc(x.o)}</td><td>${x.r} ${x.sc}</td>${cols.map(c => `<td>${c[1](x.l)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      ${p.why && p.why.length ? `<div class="glabel">Last offseason</div><p class="small">${esc(p.why.join(' · '))}</p>` : ''}
      ${p.log && p.log.length ? `<div class="glabel">Timeline</div><ul class="dy-mini">${p.log.slice(0, 10).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    </div>`);
  }
  function statCols(pos) { const c = statCols0(pos); return c.concat([['Snaps', s => s.sn || '—'], ['Grade', s => gchip(DY.gradeOf(s, pos))]]); }
  function statCols0(pos) {
    const v = (s, k) => s[k] || 0;
    if (pos === 'QB') return [['Cmp/Att', s => v(s, 'pc') + '/' + v(s, 'pa')], ['Yds', s => v(s, 'py')], ['TD', s => v(s, 'ptd')], ['INT', s => v(s, 'pi')], ['Rush', s => v(s, 'ry')], ['RTD', s => v(s, 'rtd')]];
    if (pos === 'RB') return [['Car', s => v(s, 'ra')], ['Yds', s => v(s, 'ry')], ['Avg', s => s.ra ? (s.ry / s.ra).toFixed(1) : '-'], ['TD', s => v(s, 'rtd')], ['Rec', s => v(s, 'rc')], ['RecYds', s => v(s, 'rcy')]];
    if (pos === 'WR' || pos === 'TE') return [['Rec', s => v(s, 'rc')], ['Yds', s => v(s, 'rcy')], ['Avg', s => s.rc ? (s.rcy / s.rc).toFixed(1) : '-'], ['TD', s => v(s, 'rctd')], ['Lg', s => v(s, 'rclg')]];
    if (pos === 'K') return [['FG', s => v(s, 'fgm') + '/' + v(s, 'fga')], ['Lg', s => v(s, 'fglg')], ['XP', s => v(s, 'xpm') + '/' + v(s, 'xpa')]];
    if (pos === 'P') return [['Punts', s => v(s, 'pn')], ['Avg', s => s.pn ? (s.pny / s.pn).toFixed(1) : '-'], ['In 20', s => v(s, 'i20')]];
    if (pos === 'OT' || pos === 'IOL') return [['GP', s => v(s, 'gp')], ['Pen', s => v(s, 'pen')]];
    return [['Tkl', s => v(s, 'tk')], ['TFL', s => v(s, 'tfl')], ['Sck', s => v(s, 'sck')], ['INT', s => v(s, 'int')], ['PD', s => v(s, 'pd')], ['FF', s => v(s, 'ff')]];
  }

  /* ---------- depth chart + next season ---------- */
  function depth(b) {
    const ut = DY.userT(), g = G();
    const NAMES = { QB: 'Quarterback', RB: 'Running back', WR: 'Wide receivers', TE: 'Tight end', OT: 'Tackles (LT, RT)', IOL: 'Interior line (LG, C, RG)', EDGE: 'Edge', DT: 'Defensive tackle', LB: 'Linebackers', CB: 'Cornerbacks (3rd plays nickel)', S: 'Safeties', K: 'Kicker', P: 'Punter' };
    const moveSel = p => `<select class="dy-mv" data-mvpos="${p.id}" aria-label="Move ${esc(p.n)} to another position"><option value="">Move…</option>${Object.keys(DY.STARTERS).filter(x => x !== p.pos).map(x => { const fit = DY.posFit(p, x); return `<option value="${x}">${x}${fit === 'natural' ? ' (natural)' : fit === 'ok' ? '' : ' (out of position)'} · ${DY.ovrAt(p, x).ovr}</option>`; }).join('')}</select>`;
    // next season: who is left at each spot, by class
    const next = Object.keys(DY.STARTERS).map(pos => {
      const ps = ut.roster.map(DY.P).filter(p => p.pos === pos && p.el > 1 && !p.leave);
      const commits = g.recruit && !g.recruit.signed ? DY.myCommits().filter(p => p.pos === pos).length : 0;
      const need = Math.max(1, Math.round(DY.STARTERS[pos] * 2.2));
      const by = [1, 2, 3, 4].map(y => ps.filter(p => Math.min(5, p.yr + 1) === y + 1).length);
      const leaving = ut.roster.map(DY.P).filter(p => p.pos === pos && p.el <= 1);
      const startersLeaving = (ut.depth[pos] || []).slice(0, DY.STARTERS[pos]).map(DY.P).filter(p => p && p.el <= 1);
      return { pos, n: ps.length, commits, need, by, leaving, startersLeaving, thin: ps.length + commits < need };
    });
    const SLOT = { QB: ['QB1'], RB: ['RB1'], WR: ['X', 'Z', 'Slot'], TE: ['TE1'], OT: ['LT', 'RT'], IOL: ['LG', 'C', 'RG'], EDGE: ['Edge L', 'Edge R'], DT: ['DT', 'DT'], LB: ['Mike', 'Will'], CB: ['CB1', 'CB2', 'Nickel'], S: ['FS', 'SS'], K: ['K'], P: ['P'] };
    const offs = g.phase === 'offseason';
    const proj = V.dproj != null ? V.dproj : offs;
    const PJ = proj ? DY.projRoster() : null;
    const D = pos => proj ? PJ.by[pos].map(x => x.p) : (ut.depth[pos] || []).map(DY.P).filter(Boolean).filter(x => !(x.inj && x.inj.wks > 0));
    const isNew = p => proj && PJ.by[p.pos] && PJ.by[p.pos].some(x => x.p === p && x.nw);
    const at = (pos, i) => { const p = D(pos)[i]; return p ? `<a href="#" data-pid="${p.id}" class="dy-sl ${isNew(p) ? 'nw' : ''}"><i>${SLOT[pos][i]}</i><b>${esc(DY.lastName(p))}</b><small>${p.ovr}${isNew(p) ? ' · new' : ''}</small></a>` : `<span class="dy-sl empty"><i>${SLOT[pos][i]}</i><b>—</b></span>`; };
    const projBar = `<div class="dy-niltabs"><button data-dproj="0" aria-pressed="${!proj}">Current depth chart</button><button data-dproj="1" aria-pressed="${proj}">Projected ${g.season + 1}</button></div>${proj ? `<p class="small dim">Projected ${g.season + 1} roster: <b>${PJ.n}</b> players (limit ${DY.rosterMax()}). ${PJ.out} leaving or gone${PJ.inc ? `, ${PJ.inc} commits coming` : ''}. Updates as players decide to stay or go, transfers commit and recruits sign. Ratings are today's (before offseason growth).</p>` : ''}`;
    const unit = V.dunit || 'off';
    const UNITS = { off: ['QB', 'RB', 'WR', 'TE', 'OT', 'IOL'], def: ['EDGE', 'DT', 'LB', 'CB', 'S'], st: ['K', 'P'] };
    // the starters where they line up on the field
    const fp = (pos, i, x, y, lab) => { const p = D(pos)[i]; return p ? `<a href="#" class="dy-fp${p.ovr >= 90 ? ' star' : ''}${isNew(p) ? ' nw' : ''}" data-pid="${p.id}" style="left:${x}%;top:${y}%"><b>${p.ovr}</b><span>${esc(DY.lastName(p))}</span><i>${lab}</i></a>` : `<span class="dy-fp empty" style="left:${x}%;top:${y}%"><b>—</b><i>${lab}</i></span>`; };
    const lineup = unit === 'off'
      ? `<div class="dy-field o dy-lufield"><div class="dy-los"></div>${fp('WR', 0, 6, 20, 'X')}${fp('WR', 2, 17, 42, 'SLOT')}${fp('OT', 0, 31, 20, 'LT')}${fp('IOL', 0, 40.5, 20, 'LG')}${fp('IOL', 1, 50, 20, 'C')}${fp('IOL', 2, 59.5, 20, 'RG')}${fp('OT', 1, 69, 20, 'RT')}${fp('TE', 0, 79, 27, 'TE')}${fp('WR', 1, 94, 20, 'Z')}${fp('QB', 0, 50, 52, 'QB')}${fp('RB', 0, 50, 82, 'RB')}</div>`
      : unit === 'def'
      ? `<div class="dy-field d dy-lufield"><div class="dy-los"></div>${fp('CB', 0, 6, 74, 'CB')}${fp('CB', 2, 19, 62, 'NICKEL')}${fp('EDGE', 0, 31, 76, 'EDGE')}${fp('DT', 0, 43.5, 76, 'DT')}${fp('DT', 1, 56.5, 76, 'DT')}${fp('EDGE', 1, 69, 76, 'EDGE')}${fp('CB', 1, 94, 74, 'CB')}${fp('LB', 0, 40, 46, 'MIKE')}${fp('LB', 1, 60, 46, 'WILL')}${fp('S', 0, 27, 15, 'FS')}${fp('S', 1, 73, 15, 'SS')}</div>`
      : (() => { const LU = DY.lineup(ut), fq = (p, x, y, lab) => p ? `<a href="#" class="dy-fp${p.ovr >= 90 ? ' star' : ''}" data-pid="${p.id}" style="left:${x}%;top:${y}%"><b>${p.ovr}</b><span>${esc(DY.lastName(p))}</span><i>${lab}</i></a>` : `<span class="dy-fp empty" style="left:${x}%;top:${y}%"><b>—</b><i>${lab}</i></span>`;
          return `<div class="dy-field o dy-lufield st"><div class="dy-los"></div>${fp('K', 0, 22, 30, 'K')}${fp('P', 0, 42, 30, 'P')}${fq(LU.KR, 66, 72, 'KR')}${fq(LU.PR, 86, 50, 'PR')}</div>${proj ? '' : retBox(ut, LU)}`; })();
    const ut2 = ut, risks = ut2.roster.map(DY.P).map(p => ({ p, c: DY.declareChance(p) })).filter(x => x.c >= 0.15).sort((a, b) => b.c - a.c);
    const maxRaise = p => Math.max(0, Math.min(ut2.budget * 1.02 - DY.payroll(ut2), (p.nilV || DY.nilValue(p, ut2)) * 1.5));
    const draftBox = risks.length ? `<div class="box"><div class="glabel">Draft watch: could leave early</div><p class="small dim">Juniors and older with NFL draft grades. If one declares, you get one pitch in the offseason; "even with a raise" is the best case with the biggest raise your budget allows today.</p>
      <div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>OVR</th><th>Projection</th><th>Chance he declares</th><th>Chance to keep him, even with a raise</th></tr></thead><tbody>${risks.map(({ p, c }) => { const keep = DY.persuadeChance(p, maxRaise(p)); return `<tr><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></td><td>${ovrB(p.ovr)}</td><td>${DY.draftProj(p)}</td><td><span class="dy-risk ${c >= 0.5 ? 'high' : c >= 0.25 ? 'medium' : 'low'}">${Math.round(c * 100)}%</span></td><td><span class="dy-risk ${keep < 0.25 ? 'high' : keep < 0.45 ? 'medium' : 'low'}">${Math.round(keep * 100)}%</span></td></tr>`; }).join('')}</tbody></table></div></div>` : '';
    b.innerHTML = `<div class="box"><div class="glabel">Depth chart ${ut.depthEdited ? '<span class="chip">Custom</span>' : '<span class="chip">By overall</span>'} <button class="glink" data-act="autodepth">Reset by overall</button> <button class="glink" data-more="mv">${V.more.mv ? 'Done changing positions' : 'Change positions'}</button></div><p class="dim small">Starters are highlighted. Injured players are skipped on game day. Tap Change positions to move a player to another spot: natural moves keep most of his rating; out-of-position moves (a defensive lineman at safety) take a big hit.</p>
      <div class="dy-niltabs">${(() => { const o = DY.teamOvr(ut); return [['off', 'Offense', o.off], ['def', 'Defense', o.def], ['st', 'Special teams', o.st]].map(([k, l, r]) => `<button data-dunit="${k}" aria-pressed="${unit === k}">${l} <b class="dy-unitovr">${r}</b></button>`).join(''); })()}</div>
      ${projBar}${lineup}
      ${proj ? '' : (() => { const R = Object.assign({}, DY.ROT_DEFAULT, ut.rot || {}); return `<details class="dy-rot" ${V.rotOpen ? "open" : ""}><summary>Rotation: how much the backups play</summary><p class="small dim">Share of snaps the backup gets in a close game. Stars stay on the field more (a backup well behind the starter plays less); the quarterback plays every snap unless he is hurt or it is a blowout. Garbage time empties the bench.</p>${DY.ROT_GROUPS.map(([k, l]) => `<label class="dy-rotrow"><span>${l}</span><input type="range" min="0" max="50" step="2" value="${R[k]}" data-rot="${k}"><b>${R[k]}%</b></label>`).join('')}</details>`; })()}
      ${proj ? `<div class="dy-depth">${UNITS[unit].map(pos => `<div class="dy-dg"><h4>${NAMES[pos]}</h4><ol>${PJ.by[pos].map((x, i) => `<li class="${i < DY.STARTERS[pos] + (pos === 'CB' ? 1 : 0) ? 'st' : ''}"><span class="dy-dn">${SLOT[pos][i] || i + 1}</span><span class="dy-dname">${plink(x.p)} <small>${x.commit ? 'Commit' : yrLabel(x.p)}${x.nw && !x.commit ? ' · new' : ''}</small></span>${ovrB(x.p.ovr)}</li>`).join('') || '<li class="dim">Nobody yet</li>'}</ol></div>`).join('')}</div>` : ''}
      <div class="dy-depth" ${proj ? 'hidden' : ''}>${UNITS[unit].map(pos => `<div class="dy-dg"><h4>${NAMES[pos]}</h4><ol>${(ut.depth[pos] || []).map(DY.P).filter(Boolean).map((p, i, arr) => `<li class="${i < DY.STARTERS[pos] + (pos === 'CB' ? 1 : 0) ? 'st' : ''} ${p.inj && p.inj.wks > 0 ? 'inj' : ''}"><span class="dy-dn">${SLOT[pos][i] || i + 1}</span><span class="dy-dname">${plink(p)} <small>${yrLabel(p)}${p.pos0 ? ' · from ' + p.pos0 : ''}</small></span>${ovrB(p.ovr)}<span class="dy-dmv"><button data-dmove="${pos}|${p.id}|-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button data-dmove="${pos}|${p.id}|1" ${i === arr.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button></span>${V.more.mv ? moveSel(p) : ''}</li>`).join('')}</ol></div>`).join('')}</div></div>
      ${offs ? '' : `<div class="box"><div class="glabel">Next season preview · ${g.season + 1}</div>
        <p>Roster limit: <b>${DY.rosterMax()}</b>. Now: ${ut.roster.length}. Out of eligibility after this season: ${ut.roster.map(DY.P).filter(p => p.el <= 1).length}. Commits: ${g.recruit && !g.recruit.signed ? DY.myCommits().length : 0} (max ${DY.CAP.hs} high school signees and ${DY.CAP.tin} transfers, ${DY.CAP.newcomers} newcomers in all).</p>
        <div class="dy-scroll"><table class="dyt"><thead><tr><th>Pos</th><th>Returning</th><th>So</th><th>Jr</th><th>Sr</th><th>5th</th><th>Commits</th><th>Losing</th><th></th></tr></thead><tbody>${next.map(r => `<tr class="${r.thin ? 'thin' : ''}"><td><b>${r.pos}</b></td><td>${r.n}</td>${r.by.map(x => `<td>${x || ''}</td>`).join('')}<td>${r.commits || ''}</td><td class="small">${r.leaving.length ? r.leaving.map(p => esc(DY.lastName(p))).join(', ') : ''}${risks.filter(x => x.p.pos === r.pos && x.c >= 0.25).map(x => `${r.leaving.length ? ', ' : ''}<i title="Could leave for the NFL">${esc(DY.lastName(x.p))} (NFL ${Math.round(x.c * 100)}%)</i>`).join('')}</td><td>${r.thin ? '<b class="dy-l">Thin</b>' : r.startersLeaving.length ? '<span class="dy-warn">Starter leaving</span>' : ''}</td></tr>`).join('')}</tbody></table></div></div>${draftBox}`}`;
  }

  // kick and punt returners: the staff's pick (fastest, shiftiest) or yours
  const retRating = p => Math.round(Math.min(99, (p.at.spd * 1 + p.at.acc * 0.5 + (p.at.elu || 60) * 0.4 + (p.at.cth || 60) * 0.25) / 2.15));
  function retBox(t, LU) {
    const cands = t.roster.map(DY.P).filter(p => p && ['RB', 'WR', 'CB', 'S', 'TE', 'LB', 'QB'].includes(p.pos)).sort((a, b) => retRating(b) - retRating(a)).slice(0, 18);
    const sel = (k, cur) => `<select data-ret="${k}"><option value="">Staff's choice${!t[k] && cur ? ` (${esc(cur.n)})` : ''}</option>${cands.map(p => `<option value="${p.id}" ${t[k] === p.id ? 'selected' : ''}>${esc(p.n)} · ${p.pos} · return ${retRating(p)}</option>`).join('')}</select>`;
    return `<div class="dy-rets"><label class="dy-rotrow"><span>Kick returner</span>${sel('kr', LU.KR)}<b></b></label><label class="dy-rotrow"><span>Punt returner</span>${sel('pr', LU.PR)}<b></b></label><p class="small dim">Return rating: speed, acceleration, elusiveness and hands. Staff's choice picks the best healthy returner each week.</p></div>`;
  }

  /* ---------- recruiting ---------- */
  function recruit(b) {
    const g = G(), R = g.recruit, ut = DY.userT();
    if (!R) { b.innerHTML = '<div class="box">No recruiting class yet.</div>'; return; }
    const commits = DY.myCommits().sort((a, b) => b.rec.c - a.rec.c);
    const promised = commits.reduce((s, p) => s + (p.nilOffer || 0), 0);
    const budgetBox = `<div class="dy-stats4"><div><b>No. ${R.classRank || '—'}</b><small>Class rank</small></div><div><b>${commits.length}/${DY.CAP.hs}</b><small>Commits</small></div><div><b>${DY.money(promised)}</b><small>NIL promised</small></div><div><b>${DY.money(Math.max(0, ut.budget - DY.payroll(ut)))}</b><small>NIL budget open</small></div></div>
      <p class="small dim">Roster limit ${DY.rosterMax()}: ${ut.roster.length} now, ${ut.roster.map(DY.P).filter(p => p.el <= 1).length} out of eligibility after the season.</p>`;
    if (R.locked) {
      b.innerHTML = `<div class="box"><div class="glabel">Class of ${R.year} · the real class, locked in for year one</div>${budgetBox}
        <p>The ${commits.length} real commitments sign with Tennessee on signing day, each with an NIL promise sized to his On3-style value. Recruiting opens for the class of ${R.year + 1} next season. If a spot on the roster is thin, the staff adds a late signee there.</p>
        <div class="dy-scroll"><table class="dyt"><thead><tr><th>Prospect</th><th>Pos</th><th class="hide-s">Hometown</th><th>Rank</th><th>NIL promise</th></tr></thead><tbody>${commits.map(p => `<tr><td><span class="dy-stars">${stars(p.rec.stars)}</span> <a href="#" class="dy-pl" data-rid="${p.id}">${esc(p.n)}</a></td><td>${p.pos}</td><td class="hide-s small">${esc(p.home)}</td><td class="small">${p.realNat ? 'No. ' + p.realNat : '—'} · ${p.rec.c.toFixed(4)}</td><td><b>${DY.money(p.nilOffer || 0)}</b></td></tr>`).join('')}</tbody></table></div></div>`;
      return;
    }
    if (g.settings.recruiting === 'off') { b.innerHTML = `<div class="box"><div class="glabel">Recruiting is off</div><p>${esc(DY.UN())} signs a class automatically on signing day. Turn it on in Settings.</p><button class="btn" data-set="recruiting|manual">Turn recruiting on</button></div>`; return; }
    const used = DY.hoursUsed(), hrs = DY.HOURS(), board = R.board.map(DY.RP).filter(Boolean);
    const homeGames = DY.userGames().filter(x => x.h === g.user && !x.res && x.wk >= g.week);
    const ranked = p => Object.entries(p.interest).sort((a, b) => b[1] - a[1]);
    const leaders = p => { const r = ranked(p); const top = r[0] ? r[0][1] : 1; return r.slice(0, 4).map(([tid, v]) => `<div class="dy-int ${+tid === g.user ? 'me' : ''}"><span>${esc(T(+tid).abbr)}</span><i style="width:${Math.max(3, v / Math.max(top, 160) * 100)}%;background:${T(+tid).c1}"></i></div>`).join(''); };
    const status = p => p.commit === g.user ? '<b class="dy-w">Committed</b>' : p.commit != null ? `Committed: ${esc(T(p.commit).name)}` : (ranked(p)[0] && +ranked(p)[0][0] === g.user ? 'Leaning ' + esc(DY.UN()) : ranked(p)[0] ? 'Leader: ' + esc(T(+ranked(p)[0][0]).abbr) : 'Open');
    const auto = g.settings.recruiting === 'auto';
    const closed = R.signed || g.phase === 'offseason';
    const actBtns = p => closed || p.commit === g.user && p.firm ? '' : Object.entries(DY.ACTIONS).map(([k, a]) => `<button class="dy-ra ${p.acts[k] ? 'on' : ''}" data-ract="${p.id}|${k}" ${k === 'scout' && p.scout >= 3 ? 'disabled' : ''} title="${esc(a.name)}: ${a.hrs} hours">${esc(a.name.replace('Head coach visit', 'HC visit').replace('Social media', 'DM').replace('Phone call', 'Call'))} <small>${a.hrs}h</small></button>`).join('');
    const nilSel = p => `<select data-rnil="${p.id}" aria-label="NIL promise">${[0, 25000, 50000, 100000, 250000, 500000, 1000000].map(v => `<option value="${v}" ${p.nilOffer === v ? 'selected' : ''}>${v ? 'NIL ' + DY.money(v) : 'No NIL promise'}</option>`).join('')}</select>`;
    const visSel = p => p.visit ? `<small>Visit: wk ${p.visit}${p.visited ? ' ✓' : ''}</small>` : homeGames.length && !closed ? `<select data-rvisit="${p.id}" aria-label="Official visit"><option value="">Official visit…</option>${homeGames.map(x => `<option value="${x.wk}">Wk ${x.wk} vs ${esc(T(DY.oppOf(x)).abbr)}</option>`).join('')}</select>` : '';
    const row = p => `<tr class="${p.commit === g.user ? 'me' : ''}"><td><span class="dy-stars">${stars(p.rec.stars)}</span><br><a href="#" class="dy-pl" data-rid="${p.id}"><b>${esc(p.n)}</b></a> <small>${p.pos}</small>${p.real ? ' <small class="chip">Real</small>' : ''}<br><small class="dim">No. ${p.rec.nat} · ${esc(p.home)}</small></td>
      <td class="dy-intc">${leaders(p)}<small>${status(p)}</small></td>
      <td>${p.offer ? '<small class="dy-w">Offered</small>' : closed ? '' : `<button class="dy-ra" data-roffer="${p.id}">Offer</button>`}${closed ? '' : nilSel(p) + visSel(p)}</td>
      <td class="dy-acts">${actBtns(p)}${p.commit === g.user && p.real ? '' : `<button class="glink" data-rrm="${p.id}">Remove</button>`}</td></tr>`;
    const F = V.rfind;
    let pool = Object.values(R.pool).filter(p => !R.board.includes(p.id));
    if (F.pos !== 'ALL') pool = pool.filter(p => p.pos === F.pos);
    if (F.stars) pool = pool.filter(p => p.rec.stars === F.stars);
    if (F.st && F.st !== 'ALL') pool = pool.filter(p => p.st === F.st);
    if (F.mine) pool = pool.filter(p => p.interest[g.user] != null);
    if (F.q) pool = pool.filter(p => p.n.toLowerCase().includes(F.q.toLowerCase()));
    pool.sort((a, b) => b.rec.c - a.rec.c);
    const states = [...new Set(Object.values(R.pool).map(p => p.st))].sort();
    b.innerHTML = `<div class="dy-grid"><div class="dy-col wide">
      <div class="box"><div class="glabel">Class of ${R.year}${auto ? ' · <span class="chip">Auto</span>' : ''}</div>${budgetBox}
        ${closed ? '<p>Signing day has passed for this class.</p>' : `<div class="dy-hours"><div><b>${hrs - used}</b> of ${hrs} hours left this week</div><div class="dy-ab"><i style="width:${used / hrs * 100}%"></i></div><small class="dim">Actions happen when the week is played. Head coach visits: 4 a week. Official visits are for home games; a win (especially a big one) sells.</small></div>`}</div>
      <div class="box"><div class="glabel">Recruiting board (${board.length}/${DY.BOARD_MAX})</div><div class="dy-scroll"><table class="dyt dy-board"><thead><tr><th>Prospect</th><th>Interest</th><th>Offer</th><th>This week</th></tr></thead><tbody>${board.sort((a, b) => (b.commit === g.user) - (a.commit === g.user) || b.rec.c - a.rec.c).map(row).join('') || '<tr><td colspan="4" class="dim">Add prospects from the list below.</td></tr>'}</tbody></table></div></div>
      <div class="box"><div class="glabel">Find prospects</div>
        <div class="dy-filt"><input id="dyRfq" class="dy-in" placeholder="Name" value="${esc(F.q)}"><select data-rfsel="pos">${['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'IOL', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P'].map(x => `<option ${F.pos === x ? 'selected' : ''}>${x}</option>`).join('')}</select><select data-rfsel="st"><option value="ALL">All states</option>${states.map(s => `<option ${F.st === s ? 'selected' : ''}>${s}</option>`).join('')}</select>${[0, 5, 4, 3].map(s => `<button data-rfind="stars|${s}" aria-pressed="${F.stars === s}">${s ? s + '★' : 'All'}</button>`).join('')}<button data-rfind="mine|1" aria-pressed="${F.mine}">Interested in UT</button></div>
        <div class="dy-scroll"><table class="dyt"><thead><tr><th>Rk</th><th>Prospect</th><th>Pos</th><th class="hide-s">Home</th><th>Comp.</th><th>Status</th><th></th></tr></thead><tbody>${pool.slice(0, V.more.pool ? 120 : 40).map(p => `<tr><td>${p.rec.nat}</td><td><span class="dy-stars">${stars(p.rec.stars)}</span> <a href="#" class="dy-pl o" data-rid="${p.id}">${esc(p.n)}</a></td><td>${p.pos}</td><td class="hide-s small">${esc(p.home)}</td><td class="small">${p.rec.c.toFixed(4)}</td><td class="small">${p.commit != null ? esc(T(p.commit).abbr) : (p.interest[g.user] != null ? 'Interested' : '')}</td><td>${closed ? '' : `<button class="dy-ra" data-radd="${p.id}" ${p.commit != null && p.commit !== g.user && p.firm ? 'disabled' : ''}>Add</button>`}</td></tr>`).join('')}</tbody></table></div>${pool.length > 40 ? `<button class="glink" data-more="pool">${V.more.pool ? 'Show fewer' : 'Show more'}</button>` : ''}</div>
      </div><div class="dy-col">
      <div class="box"><div class="glabel">Commits</div><ul class="dy-mini">${commits.map(p => `<li><span class="dy-stars">${stars(p.rec.stars)}</span> <a href="#" class="dy-pl" data-rid="${p.id}">${esc(p.n)}</a> <small>${p.pos}${p.nilOffer ? ' · ' + DY.money(p.nilOffer) : ''}</small></li>`).join('') || '<li class="dim">None yet</li>'}</ul></div>
      <div class="box"><div class="glabel">Top classes</div><ol class="dy-poll">${(R.ranks || []).slice(0, 15).map((t, i) => `<li class="${t === g.user ? 'me' : ''}"><span>${i + 1}</span>${tlink(t, false)}<small>${(R.commits[t] || []).length}</small></li>`).join('')}</ol></div>
      <div class="box"><div class="glabel">Recruiting log</div><ul class="dy-mini">${(R.log || []).slice(0, 20).map(l => `<li>${esc(l)}</li>`).join('') || '<li class="dim">Nothing yet</li>'}</ul></div>
      </div></div>`;
  }
  function prospectCard(id) {
    const g = G(), p = DY.RP(id) || DY.P(id); if (!p) return;
    if (!p.pros) return playerCard(id);
    const ut = DY.userT(), f = DY.fit(ut, p), lvl = p.real ? 3 : p.scout;
    const ovrTxt = lvl >= 3 ? `${p.ovr}` : lvl === 2 ? `${p.ovr - 2}-${p.ovr + 2}` : lvl === 1 ? `${p.ovr - 5}-${p.ovr + 5}` : '??';
    const pot = lvl >= 2 ? p.potG : '?';
    const tg = lvl >= 3 ? (p.gem ? '<span class="chip dy-w">GEM</span>' : p.bust ? '<span class="chip dy-l">BUST risk</span>' : '<span class="chip">As advertised</span>') : '';
    const ints = Object.entries(p.interest).sort((a, b) => b[1] - a[1]), top = ints[0] ? ints[0][1] : 1;
    modal(`<div class="dy-pc"><div class="dy-pc-head"><div class="dy-pc-num">${p.pos}</div><div><h3>${esc(p.n)}</h3><div class="dim">${DY.htStr(p.ht)}, ${p.wt} lbs · ${esc(p.home)} · ${esc(p.hs)}</div>
      <div><span class="dy-stars">${stars(p.rec.stars)}</span> ${p.rec.c.toFixed(4)} composite · No. ${p.rec.nat} nationally · No. ${p.rec.posRank} ${p.pos} · No. ${p.rec.stRank} in ${p.st}</div></div>
      <div class="dy-pc-ovr"><span class="dy-ovr m">${ovrTxt}</span><small>OVR now</small><span class="dy-pot big">${pot}</span><small>Potential</small></div></div>
      <div class="dy-pc-tags">${tg}<span class="chip">${esc(p.arch)}</span><span class="chip">Scouted ${lvl}/3</span>${p.commit != null ? `<span class="chip">Committed: ${esc(T(p.commit).name)}</span>` : ''}${p.nilOffer ? `<span class="chip">NIL promise ${DY.money(p.nilOffer)}${p.nilLocked ? ' (locked)' : ''}</span>` : ''}</div>
      ${lvl >= 1 ? `<p class="dy-scout"><b>Scouting report:</b> ${esc(DY.scoutReport(p))}</p>` : '<p class="dim">Scout him to see a report and his real ratings.</p>'}
      <div class="dy-pc-cols"><div><div class="glabel">What he wants</div>${p.pref.top.map((k, i) => `<div class="dy-pref"><b>${i + 1}. ${esc(DY.PREFS[k])}</b> <span>${esc(DY.userT().abbr)}: ${DY.grade(f[k])}</span></div>`).join('')}${p.pref.deal ? `<p class="small"><b>Dealbreaker:</b> ${esc(DY.PREFS[p.pref.deal])}</p>` : ''}<p class="small">Overall fit: <b>${DY.grade(DY.fitScore(ut, p))}</b></p></div>
      <div><div class="glabel">Schools in the mix</div>${ints.slice(0, 8).map(([tid, v]) => `<div class="dy-int ${+tid === g.user ? 'me' : ''}"><span>${esc(T(+tid).name)}</span><i style="width:${Math.max(3, v / Math.max(top, 160) * 100)}%;background:${T(+tid).c1}"></i></div>`).join('')}</div></div>
      ${lvl >= 2 ? `<div class="glabel">Ratings</div>${Object.keys(DY.W[p.pos]).map(k => `<div class="dy-attr"><span>${esc(DY.ATTR_NAME[k])}</span><div class="dy-ab"><i class="${ovrCls(p.at[k])}" style="width:${p.at[k]}%"></i></div><b>${p.at[k]}</b></div>`).join('')}` : ''}
    </div>`);
  }

  /* ---------- rankings, standings ---------- */
  function polls(b) {
    const g = G();
    const list = (rows, title, cfp) => `<div class="box"><div class="glabel">${title}</div><table class="dyt"><thead><tr><th>#</th><th>Team</th><th>Rec</th>${cfp ? '' : '<th class="hide-s">Pts</th>'}<th>Prev</th></tr></thead><tbody>${rows.map((x, i) => `<tr class="${x.t === g.user ? 'me' : ''}"><td>${i + 1}</td><td>${tlink(x.t, false)}${!cfp && x.fp ? ` <small class="dim">(${x.fp})</small>` : ''}</td><td>${T(x.t).w}-${T(x.t).l}</td>${cfp ? '' : `<td class="hide-s">${x.pts}</td>`}<td>${x.prev ? (x.prev > i + 1 ? `<span class="dy-w">▲${x.prev - i - 1}</span>` : x.prev < i + 1 ? `<span class="dy-l">▼${i + 1 - x.prev}</span>` : '—') : '<small>NR</small>'}</td></tr>`).join('')}</tbody></table></div>`;
    const others = g.teams.filter(t => !t.ap).sort((a, b) => DY.apKey(b) - DY.apKey(a)).slice(0, 8);
    b.innerHTML = `<div class="dy-grid"><div class="dy-col">${list(g.polls.ap, 'AP Top 25')}<p class="small dim">Others receiving votes: ${others.map(t => esc(t.name) + ' ' + t.w + '-' + t.l).join(', ')}</p></div><div class="dy-col">${g.polls.cfp ? list(g.polls.cfp, `College Football Playoff rankings${g.polls.cfpWeek === 14 ? ' · final' : ' · after week ' + g.polls.cfpWeek}`, true) : `<div class="box"><div class="glabel">College Football Playoff rankings</div><p class="dim">The committee's first rankings come out the first Tuesday of November (after week ${DY.CFP_WEEKS[0]}).</p><p class="small">Playoff this season: ${DY.cfpSize()} teams${DY.cfpSize() === 24 ? ' (no conference title games; seeds 1-8 get byes, first and second rounds on campus)' : DY.cfpSize() === 12 ? ' (seeds 1-4 get byes, first round on campus)' : DY.cfpSize() === 8 ? ' (the top eight; quarterfinals on campus)' : DY.cfpSize() === 4 ? ' (the top four; semifinals in New Year’s Six bowls)' : ' (No. 1 vs. No. 2 for the title)'}.</p></div>`}</div></div>`;
  }
  function standings(b) {
    const confs = Object.keys(DY.CONF_GAMES);
    if (!V.conf || V.conf === 'IND') V.conf = DY.userT().conf === 'IND' ? 'SEC' : DY.userT().conf;
    const st = DY.standings(V.conf);
    b.innerHTML = `<div class="box"><div class="gchips dy-chips">${confs.map(c => `<button data-conf="${c}" aria-pressed="${V.conf === c}">${esc(DY.CONF_NAME[c])}</button>`).join('')}</div>
      <table class="dyt"><thead><tr><th>#</th><th>Team</th><th>Conf</th><th>Overall</th><th class="hide-s">PF</th><th class="hide-s">PA</th></tr></thead><tbody>${st.map((t, i) => `<tr class="${t.user ? 'me' : ''}"><td>${i + 1}</td><td>${tlink(t.id)}${t.champ === G().season ? ' ' + tag('Champ') : ''}</td><td>${t.cw}-${t.cl}</td><td>${t.w}-${t.l}</td><td class="hide-s">${t.pf}</td><td class="hide-s">${t.pa}</td></tr>`).join('')}</tbody></table>
      <p class="small dim">Tiebreakers: conference record, head-to-head, overall record, then the committee's rankings. ${DY.cfpSize() === 24 ? 'No title games in the 24-team era: the regular-season leader is the champion.' : 'The top two meet in the title game.'}</p></div>`;
  }

  /* ---------- stats ---------- */
  const STATK = [['py', 'Passing yards'], ['ptd', 'Passing TDs'], ['ry', 'Rushing yards'], ['rtd', 'Rushing TDs'], ['rcy', 'Receiving yards'], ['rc', 'Receptions'], ['rctd', 'Receiving TDs'], ['tk', 'Tackles'], ['sck', 'Sacks'], ['tfl', 'Tackles for loss'], ['int', 'Interceptions'], ['fgm', 'Field goals']];
  // Index grades: snaps and a PFF-style grade for every Tennessee player
  const gchip = gr => gr == null ? '<span class="dim">—</span>' : `<span class="dy-grade ${DY.gradeCls(gr)}">${gr.toFixed(1)}</span>`;
  function gradeTable(ps) {
    const rows = ps.map(p => ({ p, s: sStats(p) })).filter(x => x.s && x.s.sn >= 10).map(x => Object.assign(x, { gr: DY.gradeOf(x.s, x.p.pos) })).filter(x => x.gr != null);
    if (!rows.length) return '';
    const side = V.gside || 'O', list = rows.filter(x => (side === 'O' ? DY.SIDE(x.p.pos) === 'O' : DY.SIDE(x.p.pos) === 'D')).sort((a, b) => b.gr - a.gr);
    return `<div class="box"><div class="glabel">Index grades and snaps <span class="gseg dy-seg-sm"><button data-gside="O" aria-pressed="${side === 'O'}">Offense</button><button data-gside="D" aria-pressed="${side === 'D'}">Defense</button></span></div>
      <p class="small dim">A PFF-style grade built from every snap: did he win his block, beat his man, make the tackle, make the right throw. 60-65 is average, 80+ very good, 90+ elite.</p>
      <div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>Pos</th><th>Snaps</th><th>Grade</th></tr></thead><tbody>${list.map(x => `<tr><td>${plink(x.p)}</td><td>${x.p.pos}</td><td>${x.s.sn}</td><td>${gchip(x.gr)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function stats(b) {
    const g = G(), ut = DY.userT();
    const yrNote = g.phase === 'offseason' ? ` · ${g.season} final` : '';
    const tabs = `<div class="gchips dy-chips">${[['team', DY.UN()], ['sec', (DY.userT().conf === 'IND' ? 'Independent' : DY.userT().conf) + ' leaders'], ['nat', 'National leaders']].map(([k, l]) => `<button data-stab="${k}" aria-pressed="${V.stab === k}">${l}</button>`).join('')}</div>`;
    if (V.stab === 'team') {
      // season team totals from Tennessee's box scores
      const games = DY.teamGames(ut.id).filter(x => x.res && x.box && x.box.ts);
      const sum = { us: DY.teamLine(), them: DY.teamLine() }, pts = { us: 0, them: 0 };
      games.forEach(x => { const me = x.h === ut.id ? 'h' : 'a', op = me === 'h' ? 'a' : 'h'; for (const k in sum.us) { sum.us[k] += x.box.ts[me][k] || 0; sum.them[k] += x.box.ts[op][k] || 0; } pts.us += x.res[me]; pts.them += x.res[op]; });
      const n = Math.max(1, games.length), pg = v => (v / n).toFixed(1);
      const teamRows = [['Points per game', pg(pts.us), pg(pts.them)], ['Total yards per game', pg(sum.us.yds), pg(sum.them.yds)], ['Rushing yards per game', pg(sum.us.ry), pg(sum.them.ry)], ['Yards per carry', sum.us.ra ? (sum.us.ry / sum.us.ra).toFixed(1) : '-', sum.them.ra ? (sum.them.ry / sum.them.ra).toFixed(1) : '-'], ['Passing yards per game', pg(sum.us.py), pg(sum.them.py)], ['Completion %', sum.us.pa ? Math.round(sum.us.pc / sum.us.pa * 100) + '%' : '-', sum.them.pa ? Math.round(sum.them.pc / sum.them.pa * 100) + '%' : '-'], ['Yards per pass', sum.us.pa ? (sum.us.py / sum.us.pa).toFixed(1) : '-', sum.them.pa ? (sum.them.py / sum.them.pa).toFixed(1) : '-'], ['First downs per game', pg(sum.us.fd), pg(sum.them.fd)], ['3rd down', sum.us.a3 ? Math.round(sum.us.c3 / sum.us.a3 * 100) + '%' : '-', sum.them.a3 ? Math.round(sum.them.c3 / sum.them.a3 * 100) + '%' : '-'], ['Turnovers', sum.us.to, sum.them.to], ['Sacks allowed', sum.us.sk, sum.them.sk], ['Penalties per game', pg(sum.us.pen), pg(sum.them.pen)], ['Time of possession', DY.clockStr(sum.us.top / n), DY.clockStr(sum.them.top / n)]];
      const ps = ut.roster.concat(Object.values(g.P).filter(p => p.t0 === ut.id && p.gone === g.season).map(p => p.id)).map(DY.P).filter(p => p && sStats(p));
      const tbl = (title, f, cols, sort) => { const rs = ps.filter(p => f(sStats(p))).sort((a, b) => sort(sStats(b)) - sort(sStats(a))); if (!rs.length) return ''; return `<div class="box"><div class="glabel">${title}</div><div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>GP</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rs.map(p => `<tr><td>${plink(p)} <small>${p.pos}</small></td><td>${sStats(p).gp || 0}</td>${cols.map(c => `<td>${c[1](sStats(p))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`; };
      const v = (s, k) => s[k] || 0;
      b.innerHTML = `${tabs}<div class="box"><div class="glabel">Team stats${yrNote} · ${games.length} games</div><table class="dyt"><thead><tr><th></th><th>${esc(DY.UN())}</th><th>Opponents</th></tr></thead><tbody>${teamRows.map(r => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div>
        ${gradeTable(ps)}
        ${tbl('Passing', s => s.pa, [['C/A', s => v(s, 'pc') + '/' + v(s, 'pa')], ['Yds', s => v(s, 'py')], ['TD', s => v(s, 'ptd')], ['INT', s => v(s, 'pi')], ['Y/A', s => s.pa ? (s.py / s.pa).toFixed(1) : '-']], s => v(s, 'py'))}
        ${tbl('Rushing', s => s.ra, [['Car', s => v(s, 'ra')], ['Yds', s => v(s, 'ry')], ['Avg', s => s.ra ? (s.ry / s.ra).toFixed(1) : '-'], ['TD', s => v(s, 'rtd')], ['Lg', s => v(s, 'rlg')]], s => v(s, 'ry'))}
        ${tbl('Receiving', s => s.rc, [['Rec', s => v(s, 'rc')], ['Yds', s => v(s, 'rcy')], ['Avg', s => s.rc ? (s.rcy / s.rc).toFixed(1) : '-'], ['TD', s => v(s, 'rctd')], ['Lg', s => v(s, 'rclg')]], s => v(s, 'rcy'))}
        ${tbl('Defense', s => s.tk || s.sck || s.int, [['Tkl', s => v(s, 'tk')], ['TFL', s => v(s, 'tfl')], ['Sck', s => v(s, 'sck')], ['INT', s => v(s, 'int')], ['PD', s => v(s, 'pd')], ['FF', s => v(s, 'ff')]], s => v(s, 'tk'))}
        ${tbl('Kicking and punting', s => s.fga || s.xpa || s.pn, [['FG', s => v(s, 'fgm') + '/' + v(s, 'fga')], ['Lg', s => v(s, 'fglg')], ['XP', s => v(s, 'xpm') + '/' + v(s, 'xpa')], ['Punts', s => v(s, 'pn')], ['Avg', s => s.pn ? (s.pny / s.pn).toFixed(1) : '-']], s => v(s, 'fgm') + v(s, 'pn'))}
        ${tbl('Returns', s => s.kr || s.pr, [['KR', s => v(s, 'kr')], ['Yds', s => v(s, 'kry')], ['PR', s => v(s, 'pr')], ['Yds', s => v(s, 'pry')], ['TD', s => v(s, 'rttd')]], s => v(s, 'kry') + v(s, 'pry'))}`;
      return;
    }
    const pool = [];
    g.teams.forEach(t => { if (V.stab === 'sec' && t.conf !== DY.userT().conf) return; t.roster.forEach(id => { const p = DY.P(id); const s = sStats(p); if (s && s[V.statk]) pool.push(p); }); });
    pool.sort((a, b) => sStats(b)[V.statk] - sStats(a)[V.statk]);
    const heis = [];
    g.teams.forEach(t => t.roster.forEach(id => { const p = DY.P(id); if (!p.s) return; const sc = DY.awardScore(p, t); if (sc > 0 && ['QB', 'RB', 'WR'].includes(p.pos)) heis.push({ p, h: sc * ({ QB: 1, RB: 0.92, WR: 0.82 }[p.pos]) + (t.ap && t.ap <= 4 ? 18 : t.ap && t.ap <= 12 ? 9 : 0) + (t.w - 8) * 5 }); }));
    heis.sort((a, b) => b.h - a.h);
    const n = V.more.lead ? 25 : 10;
    b.innerHTML = `${tabs}<div class="dy-grid"><div class="dy-col wide"><div class="box"><div class="glabel">${V.stab === 'sec' ? esc(DY.userT().conf) : 'National'} leaders${yrNote}</div><div class="gchips dy-chips">${STATK.map(([k, l]) => `<button data-statk="${k}" aria-pressed="${V.statk === k}">${l}</button>`).join('')}</div>
      <table class="dyt"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>${esc((STATK.find(x => x[0] === V.statk) || [])[1])}</th><th>GP</th></tr></thead><tbody>${pool.slice(0, n).map((p, i) => `<tr class="${p.t === g.user ? 'me' : ''}"><td>${i + 1}</td><td>${plink(p)} <small>${p.pos}</small></td><td>${tlink(p.t, false)}</td><td><b>${sStats(p)[V.statk]}</b></td><td>${sStats(p).gp || 0}</td></tr>`).join('') || '<tr><td colspan="5" class="dim">No games yet.</td></tr>'}</tbody></table>${pool.length > 10 ? `<button class="glink" data-more="lead">${V.more.lead ? 'Top 10' : 'Show top 25'}</button>` : ''}</div></div>
      <div class="dy-col"><div class="box"><div class="glabel">Heisman watch</div><ol class="dy-mini">${heis.slice(0, 6).map(x => `<li>${plink(x.p)} <small>${x.p.pos}, ${esc(T(x.p.t).abbr)} · ${x.p.pos === 'QB' ? (x.p.s.py || 0) + ' pass yds, ' + (x.p.s.ptd || 0) + ' TD' : x.p.pos === 'RB' ? (x.p.s.ry || 0) + ' rush yds, ' + (x.p.s.rtd || 0) + ' TD' : (x.p.s.rcy || 0) + ' rec yds, ' + (x.p.s.rctd || 0) + ' TD'}</small></li>`).join('') || '<li class="dim">During the season.</li>'}</ol></div></div></div>`;
  }

  /* ---------- NIL ---------- */
  // NIL filter tabs: at-risk players first, then every position
  const NIL_TABS = [['risk', 'At risk'], ['all', 'All'], ['QB', 'QB'], ['RB', 'RB'], ['WR', 'WR'], ['TE', 'TE'], ['OT', 'OT'], ['IOL', 'IOL'], ['EDGE', 'EDGE'], ['DT', 'DT'], ['LB', 'LB'], ['CB', 'CB'], ['S', 'S'], ['ST', 'K/P/LS']];
  function nilFilter(ps, asks) {
    const f = V.nilf || 'risk', risky = p => (asks && asks[p.id]) || DY.nilRisk(p, p.nil || 0) >= 0.12;
    const count = k => k === 'risk' ? ps.filter(risky).length : k === 'all' ? ps.length : k === 'ST' ? ps.filter(p => /^(K|P|LS)$/.test(p.pos)).length : ps.filter(p => p.pos === k).length;
    const bar = `<div class="dy-niltabs" role="tablist">${NIL_TABS.map(([k, l]) => `<button data-nilf="${k}" aria-pressed="${f === k}">${l}<small>${count(k)}</small></button>`).join('')}</div>`;
    const list = f === 'risk' ? ps.filter(risky).sort((a, b) => DY.nilRisk(b, b.nil || 0) - DY.nilRisk(a, a.nil || 0)) : f === 'all' ? ps : f === 'ST' ? ps.filter(p => /^(K|P|LS)$/.test(p.pos)) : ps.filter(p => p.pos === f);
    return { bar, list, empty: f === 'risk' && !list.length ? '<p class="dim small">Nobody is at real risk of leaving over money right now.</p>' : '' };
  }
  function nil(b) {
    const ut = DY.userT(), pay = DY.payroll(ut), ps = ut.roster.map(DY.P).sort((a, b) => (b.nil || 0) - (a.nil || 0));
    ps.forEach(p => { p.nilV = DY.nilValue(p, ut); });
    const NF = nilFilter(ps, null);
    b.innerHTML = `<div class="box"><div class="glabel">NIL and revenue sharing</div>
      <div class="dy-stats4"><div><b>${DY.money(ut.budget)}</b><small>Budget</small></div><div><b>${DY.money(pay)}</b><small>Committed</small></div><div><b>${DY.money(Math.max(0, ut.budget - pay))}</b><small>Open</small></div><div><b>${ps.filter(p => p.nilV > (p.nil || 0) * 1.35).length}</b><small>Underpaid</small></div></div>
      <div class="dy-ab"><i style="width:${Math.min(100, pay / ut.budget * 100)}%"></i></div>
      <p class="small dim">Budgets combine the House settlement revenue-sharing cap (about $21.6M a school in 2026-27) and collective money; Tennessee's sits in the national top ten. Market values follow On3-style valuations: quarterbacks first, then edge rushers, receivers, tackles and corners. Contracts change in the offseason (NIL & budget stage).</p>
      ${NF.bar}${NF.empty}<div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>Pos</th><th>OVR</th><th>Contract</th><th>Market value</th><th>Risk</th></tr></thead><tbody>${NF.list.map(p => { const rk = DY.riskLabel(DY.nilRisk(p, p.nil || 0)); return `<tr><td>${plink(p)}</td><td>${p.pos}</td><td>${ovrB(p.ovr)}</td><td>${DY.money(p.nil || 0)}</td><td class="${p.nilV > (p.nil || 0) * 1.35 ? 'dy-l' : 'dim'}">${DY.money(p.nilV)}</td><td><span class="dy-risk ${rk.toLowerCase()}">${rk}</span></td></tr>`; }).join('')}</tbody></table></div></div>`;
  }

  /* ---------- history ---------- */
  function history(b) {
    const g = G();
    const c = g.coach, titles = g.hist.filter(h => h.finish === 'National champions').length, secT = g.hist.filter(h => h.sec).length, cfp = g.hist.filter(h => h.cfpSeed).length;
    const recRows = scope => Object.entries(DY.REC_MAP).map(([name, k]) => { const r = g.rec[scope][k]; return r ? `<tr class="${r.real ? '' : 'me'}"><td>${esc(name)}</td><td>${r.pid ? plink(DY.P(r.pid), r.n) : esc(r.n)}</td><td><b>${r.v}</b></td><td class="small">${esc(r.y)}${r.note ? ' · ' + esc(r.note) : ''}${r.prev ? ' · broke ' + esc(r.prev) + "'s record" : ''}</td></tr>` : ''; }).join('');
    const leg = DY.legacyBoard(10);
    const ser = g.series || {};
    const riv = DY.UT_RIVALS.filter(n => ser[n]).map(n => ({ n, ...ser[n] })).concat(Object.entries(ser).filter(([n]) => !DY.UT_RIVALS.includes(n)).map(([n, v]) => ({ n, ...v })).sort((a, b) => (b.w + b.l) - (a.w + a.l)).slice(0, 6));
    const trophies = Object.entries(g.trophy || {}).map(([k, tid]) => `<li><b>${esc(DY.TROPHIES[k])}</b> <small>${esc(k.replace('|', ' vs '))} · held by ${esc(T(tid).name)}</small></li>`).join('');
    b.innerHTML = `<div class="dy-grid"><div class="dy-col wide">
      <div class="box"><div class="glabel">Coach ${esc(c.name)}</div><div class="dy-stats4"><div><b>${c.w}-${c.l}</b><small>Record</small></div><div><b>${titles}</b><small>National titles</small></div><div><b>${secT}</b><small>${esc(DY.userT().conf)} titles</small></div><div><b>${cfp}</b><small>Playoff trips</small></div></div></div>
      <div class="box"><div class="glabel">Season by season</div><div class="dy-scroll"><table class="dyt"><thead><tr><th>Year</th><th>Record</th><th>Conf</th><th>AP</th><th>Finish</th><th class="hide-s">Champion</th><th class="hide-s">Heisman</th></tr></thead><tbody>${g.hist.slice().reverse().map(h => `<tr><td>${h.y}</td><td>${h.w}-${h.l}</td><td>${h.cw}-${h.cl}${h.sec ? ' 🏆' : ''}</td><td>${h.ap || '—'}</td><td>${esc(h.finish)}</td><td class="hide-s small">${esc(h.champ)}</td><td class="hide-s small">${esc(h.heis || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="dim">Finish a season to start the history book.</td></tr>'}</tbody></table></div></div>
      <div class="box"><div class="glabel">${DY.isTN() ? 'Tennessee records (real record book + your dynasty)' : esc(DY.UN()) + ' records (since you took over)'}</div><div class="gchips dy-chips">${['game', 'season', 'career'].map(s => `<button data-recs="${s}" aria-pressed="${V.recs === s}">${s === 'game' ? 'Single game' : s === 'season' ? 'Season' : 'Career'}</button>`).join('')}</div><table class="dyt"><tbody>${recRows(V.recs)}</tbody></table><p class="small dim">Highlighted rows were set in this dynasty.</p></div>
      </div><div class="dy-col">
      <div class="box"><div class="glabel">Legacy: the best players you've coached</div><ol class="dy-mini">${leg.map(x => `<li>${plink(x.p)} <small>${x.p.pos} · ${x.v} pts${x.p.aw.some(a => a.a === 'AA1') ? ' · All-American' : ''}${x.p.draft ? ' · Rd ' + x.p.draft.rd + ' pick' : ''}</small></li>`).join('') || '<li class="dim">Built from awards, production, peak rating, wins and the draft.</li>'}</ol></div>
      <div class="box"><div class="glabel">Rivalries (this dynasty)</div>${riv.length ? `<table class="dyt dy-tight"><tbody>${riv.map(r => `<tr><td>${esc(r.n)}${DY.RIVAL_NAME[[r.n, DY.UN()].sort().join('|')] ? ` <small class="dim">${esc(DY.RIVAL_NAME[[r.n, DY.UN()].sort().join('|')])}</small>` : ''}</td><td><b>${r.w}-${r.l}</b></td><td class="small">${r.streak > 0 ? 'Won ' + r.streak : 'Lost ' + -r.streak}</td></tr>`).join('')}</tbody></table>` : '<p class="dim small">Records start with your first games.</p>'}</div>
      ${trophies ? `<div class="box"><div class="glabel">Rivalry trophies around the country</div><ul class="dy-mini">${trophies}</ul></div>` : ''}
      <div class="box"><div class="glabel">National champions</div><ul class="dy-mini">${g.hist.slice().reverse().map(h => `<li>${h.y}: ${esc(h.champ)}</li>`).join('') || '<li class="dim">—</li>'}</ul></div>
      <div class="box"><div class="glabel">${DY.isTN() ? 'Vols' : esc(DY.UN())} in the NFL Draft</div><ul class="dy-mini">${Object.entries(g.draftHist || {}).reverse().map(([y, l]) => l.filter(x => x[1] === g.user).map(x => `<li>${y}: ${plink(DY.P(x[0]))} <small>Rd ${DY.P(x[0]).draft.rd}, No. ${DY.P(x[0]).draft.pk}</small></li>`).join('')).join('') || '<li class="dim">After the first season.</li>'}</ul></div>
      </div></div>`;
  }

  /* ---------- settings ---------- */
  function settings(b) {
    const g = G(), s = g.settings, m = DY.readMeta(), ut = DY.userT();
    const seg = (k, opts, cur) => `<div class="gseg">${opts.map(([v, l]) => `<button data-set="${k}|${v}" aria-pressed="${String(cur != null ? cur : s[k]) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
    b.innerHTML = `<div class="dy-grid"><div class="dy-col"><div class="box"><div class="glabel">Save</div>${[1, 2, 3].map(n => `<div class="dy-slotrow"><b>Slot ${n}</b> <span class="dim small">${m[n] ? esc(m[n].coach) + ' · ' + esc(m[n].label) : 'Empty'}</span> <button class="btn" data-slot="${n}">${g.slot === n ? 'Save here (current)' : 'Save here'}</button></div>`).join('')}
      <div class="grow"><button class="btn" data-act="export">Export save file</button><button class="btn" data-act="quit">Quit to menu</button></div><div class="gfield"><div class="glabel">Autosave after every week</div>${seg('autosave', [[true, 'On'], [false, 'Off']])}</div></div></div>
      <div class="dy-col"><div class="box"><div class="glabel">Options</div>
      <div class="gfield"><div class="glabel">Offensive identity</div>${seg('offStyle', DY.USER_STYLES.map(k => [k, DY.STYLES[k].name]), ut.style)}<p class="dim small">${esc((DY.STYLES[ut.style] || {}).desc || '')}</p>${''}</div>
      <div class="gfield"><div class="glabel">Play calling</div>${seg('coachMode', [['offense', 'Offense'], ['full', 'Offense + defense'], ['watch', 'Watch']])}</div>
      <div class="gfield"><div class="glabel">Season watch (sim my games)</div>${seg('watchSeason', [[false, 'Off'], [true, 'On']])}</div>
      <div class="gfield"><div class="glabel">Game speed</div>${seg('speed', [['slow', 'Slow'], ['fast', 'Fast']])}</div>
      <div class="gfield"><div class="glabel">Recruiting</div>${seg('recruiting', [['manual', 'Manual'], ['auto', 'Auto'], ['off', 'Off']])}</div>
      <div class="gfield"><div class="glabel">Transfer portal</div>${seg('portal', [['manual', 'Manual'], ['auto', 'Auto'], ['off', 'Off']])}</div>
      <div class="gfield"><div class="glabel">NIL raises</div>${seg('nil', [['manual', 'I decide'], ['auto', 'Auto']])}</div>
      <div class="gfield"><div class="glabel">Playoff (from the next selection day)</div>${seg('cfp', [['real', 'Real format'], [2, '2'], [4, '4'], [8, '8'], [12, '12'], [24, '24']])}</div>
      <div class="gfield"><div class="glabel">Difficulty</div>${seg('difficulty', [['freshman', 'Freshman'], ['varsity', 'Varsity (default)'], ['heisman', 'Heisman (hard)']])}</div>
      <div class="gfield"><div class="glabel">Injuries</div>${seg('injuries', [[true, 'On'], [false, 'Off']])}</div>
      <div class="gfield"><div class="glabel">Screen shake</div>${seg('shake', [[true, 'On'], [false, 'Off']])}</div></div></div></div>`;
  }

  /* ---------- offseason ---------- */
  function offseason(b) {
    const g = G(), o = g.off, ut = DY.userT(), st = o.stage;
    const steps = `<ol class="dy-steps">${DY.OFF_ORDER.map(k => `<li class="${k === st ? 'on' : DY.OFF_ORDER.indexOf(k) < DY.OFF_ORDER.indexOf(st) ? 'done' : ''}">${esc(DY.OFF_LABEL[k])}</li>`).join('')}</ol>`;
    let html = '';
    if (st === 'recap') html = recapHtml();
    else if (st === 'nil') {
      const ps = ut.roster.map(DY.P).sort((a, b) => (b.nil || 0) - (a.nil || 0));
      const asks = {}; o.nilAsk.forEach(a => { asks[a.id] = a; });
      const NF = nilFilter(ps, asks);
      html = `<div class="box"><div class="glabel">NIL: contracts for ${g.season + 1}</div><div class="dy-stats4"><div><b>${DY.money(ut.budget)}</b><small>New budget</small></div><div><b>${DY.money(DY.payroll(ut))}</b><small>Committed</small></div><div><b>${DY.money(Math.max(0, ut.budget - DY.payroll(ut)))}</b><small>Open</small></div><div><b>${o.nilAsk.length}</b><small>Raise requests</small></div></div>
        <p class="small dim">Raise or lower any deal. Players paid well below their value (or cut when they did nothing wrong) may get unhappy and test the portal. Answer the raise requests or they are decided for you when you continue.</p>
        ${NF.bar}${NF.empty}<div class="dy-scroll"><table class="dyt dy-niltab"><thead><tr><th>Player</th><th>OVR</th><th>Value</th><th>Contract</th><th>Risk</th><th>Request</th></tr></thead><tbody>${NF.list.map(p => { const a = asks[p.id], risk = DY.nilRisk(p, p.nil); return `<tr class="${a ? 'me' : ''}"><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></td><td>${ovrB(p.ovr)}</td><td class="small dy-nv">${DY.money(p.nilV || DY.nilValue(p, ut))}</td><td class="dy-nilc"><button class="dy-ra" data-nilstep="${p.id}|-1" aria-label="Lower">−</button><b>${DY.money(p.nil || 0)}</b><button class="dy-ra" data-nilstep="${p.id}|1" aria-label="Raise">+</button></td><td><span class="dy-risk ${DY.riskLabel(risk).toLowerCase()}">${DY.riskLabel(risk)}</span></td><td>${a ? `${DY.money(a.ask)} ${g.settings.nil === 'auto' ? '<small>Auto</small>' : `<button class="dy-ra ${a.ans === true ? 'on' : ''}" data-nilans="${a.id}|1">Pay</button><button class="dy-ra ${a.ans === false ? 'on' : ''}" data-nilans="${a.id}|0">No</button>`}` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    } else if (st === 'portal') {
      const P = o.portal, mine = DY.portalPlayers().filter(p => p.portal.from === g.user), avail = DY.portalPlayers().filter(p => p.portal.from !== g.user);
      const pf = V.ppos, list = avail.filter(p => pf === 'ALL' || p.pos === pf).sort((a, b) => DY.tStars(b) - DY.tStars(a) || DY.tRange(b)[1] - DY.tRange(a)[1]).slice(0, V.more.portal ? 120 : 40);
      html = `<div class="box"><div class="glabel">Transfer portal · round ${P.round} of ${P.rounds}</div><div class="dy-stats4"><div><b>${DY.rosterRoom()}</b><small>Roster spots</small></div><div><b>${DY.transfersIn()}/${DY.CAP.tin}</b><small>Transfer offers</small></div><div><b>${DY.newcomers()}/${DY.CAP.newcomers}</b><small>Newcomers</small></div><div><b>${DY.money(Math.max(0, ut.budget - DY.payroll(ut) - Object.values(P.mine).reduce((s, v) => s + v, 0)))}</b><small>NIL room</small></div></div>${g.settings.portal === 'auto' ? '<p><span class="chip">Auto</span> Your staff makes the offers.</p>' : ''}
        <div class="grow">${P.round < P.rounds ? '<button class="btn" data-act="portalround">Play out this round</button>' : ''}<span class="small dim">Continue closes the portal: everyone left picks a school.</span></div></div>
        <div class="box"><div class="glabel">Your players in the portal (${mine.length})</div><table class="dyt"><tbody>${mine.map(p => `<tr><td>${plink(p)} <small>${p.pos} · ${p.ovr} · ${yrLabel(p)}</small></td><td><small>${esc(p.portal.why)}</small></td><td>${P.retain[p.id] != null ? '<small>Pitch made</small>' : `<select data-retainamt="${p.id}">${[0, 25000, 50000, 100000, 250000, 500000].map(v => `<option value="${v}">${v ? '+' + DY.money(v) : 'No raise'}</option>`).join('')}</select><button class="dy-ra" data-retain="${p.id}">Ask him to stay</button>`}</td></tr>`).join('') || '<tr><td class="dim">Nobody left. Good culture.</td></tr>'}</tbody></table></div>
        <div class="box"><div class="glabel">Available transfers</div><div class="gchips dy-chips">${['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'IOL', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P'].map(x => `<button data-ppos="${x}" aria-pressed="${pf === x}">${x === 'ALL' ? 'All' : x}</button>`).join('')}</div>
        <div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>From</th><th>Transfer rating</th><th>Class</th><th>Value</th><th>Your offer</th></tr></thead><tbody>${list.map(p => `<tr class="${P.mine[p.id] != null ? 'me' : ''}"><td>${plink(p)} <small>${p.pos}</small></td><td>${tlink(p.portal.from, false)}</td><td><span class="dy-tstars">${'★'.repeat(DY.tStars(p))}</span> <small>${DY.tRange(p).join('-')}</small></td><td>${yrLabel(p)} <small>${p.el} left</small></td><td class="small">${DY.money(DY.nilValue(p, ut))}</td><td>${P.mine[p.id] != null ? `<b>${DY.money(P.mine[p.id])}</b> ` : ''}<select data-pofferamt="${p.id}">${[25000, 50000, 100000, 200000, 400000, 750000, 1000000, 1500000, 2500000].map(v => `<option value="${v}" ${Math.abs(v - DY.nilValue(p, ut)) < v * 0.3 ? 'selected' : ''}>${DY.money(v)}</option>`).join('')}</select><button class="dy-ra" data-poffer="${p.id}">Offer</button></td></tr>`).join('')}</tbody></table></div>${avail.length > 40 ? `<button class="glink" data-more="portal">${V.more.portal ? 'Show fewer' : 'Show more'}</button>` : ''}</div>
        <div class="box"><div class="glabel">Portal news</div><ul class="dy-mini">${P.log.slice(0, 15).map(l => `<li>${esc(l)}</li>`).join('') || '<li class="dim">Nothing yet.</li>'}</ul></div>`;
    } else if (st === 'signing') {
      const mine = ut.roster.map(DY.P).filter(p => p.firstY === g.season + 1).sort((a, b) => (b.rec ? b.rec.c || 0 : 0) - (a.rec ? a.rec.c || 0 : 0));
      const transfers = ut.roster.map(DY.P).filter(p => p.tin === g.season);
      html = `<div class="dy-recap-hero sm"><div><span class="glabel">Signing day · class of ${g.recruit.year}</span><h2>No. ${g.recruit.finalRank || '—'} class</h2><p>${mine.length} high school signees · ${transfers.length} transfers · roster ${ut.roster.length} of ${DY.rosterMax()}</p></div></div>
        <div class="box"><div class="dy-scroll"><table class="dyt"><tbody>${mine.map(p => `<tr><td>${recLabel(p)}</td><td>${plink(p)} <small>${p.pos}${p.walkon ? ' · walk-on' : p.late ? ' · late addition' : ''}</small></td><td class="small hide-s">${esc(p.home)}</td><td>${ovrB(p.ovr)} <small class="dy-pot">${p.potG}</small></td><td class="small">${DY.money(p.nil || 0)}</td></tr>`).join('')}</tbody></table></div></div>
        ${transfers.length ? `<div class="box"><div class="glabel">Transfers in</div><ul class="dy-mini">${transfers.map(p => `<li>${plink(p)} <small>${p.pos} · ${p.ovr} · from ${esc(T(p.prevT).name)}</small></li>`).join('')}</ul></div>` : ''}`;
    } else if (st === 'draft') {
      const D = o.draft, mine = D.picks.filter(x => x.t === g.user);
      html = `<div class="dy-recap-hero sm"><div><span class="glabel">${D.y} NFL Draft</span><h2>${mine.length} Vol${mine.length === 1 ? '' : 's'} drafted</h2></div></div><div class="box"><ul class="dy-mini">${mine.map(x => `<li>Round ${x.rd}, No. ${x.pk}: ${plink(DY.P(x.id))} <small>${DY.P(x.id).pos}</small></li>`).join('') || '<li class="dim">None this year.</li>'}</ul></div>
        <div class="box"><div class="glabel">First round</div><ol class="dy-mini dy-cols2">${D.picks.slice(0, 32).map(x => `<li>${plink(DY.P(x.id))} <small>${DY.P(x.id).pos} · ${esc(T(x.t) ? T(x.t).abbr : '')}</small></li>`).join('')}</ol></div>`;
    } else if (st === 'progress') {
      const pf = V.prpos;
      const rows = o.prog.filter(r => pf === 'ALL' || DY.P(r.id).pos === pf);
      const up = o.prog.filter(r => r.delta > 0).length, avg = o.prog.length ? (o.prog.reduce((s, r) => s + r.delta, 0) / o.prog.length).toFixed(1) : 0;
      html = `<div class="box"><div class="glabel">Offseason development</div><div class="dy-stats4"><div><b>${avg > 0 ? '+' : ''}${avg}</b><small>Average change</small></div><div><b>${up}</b><small>Improved</small></div><div><b>${o.prog.filter(r => r.why && r.why.some(w => /BOOM/.test(w))).length}</b><small>Breakouts</small></div><div><b>${o.prog.filter(r => r.why && r.why.some(w => /BUST/.test(w))).length}</b><small>Stalled</small></div></div>
        <p class="dim small">Most players follow the path their potential sets. Production on the field and trophies speed it up; barely playing slows it down; a few boom or stall. Jumps past +7 are rare.</p>
        <div class="gchips dy-chips">${['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'IOL', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P'].map(x => `<button data-prpos="${x}" aria-pressed="${pf === x}">${x === 'ALL' ? 'All' : x}</button>`).join('')}</div>
        <div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>Pos</th><th>Change</th><th>Potential</th><th>Why</th></tr></thead><tbody>${rows.map(r => { const p = DY.P(r.id); return `<tr><td>${plink(p)} <small>${yrLabel(p)}</small></td><td>${p.pos}</td><td><b class="${r.delta > 0 ? 'dy-w' : r.delta < 0 ? 'dy-l' : ''}">${r.delta > 0 ? '+' : ''}${r.delta}</b> <small>${r.before} → ${r.after}</small></td><td><span class="dy-pot">${p.potG}</span>${r.ceil > r.ceil0 + 1 ? ' <small class="dy-w">▲</small>' : r.ceil < r.ceil0 - 1 ? ' <small class="dy-l">▼</small>' : ''}</td><td class="small">${esc((r.why || []).join(' · '))}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    } else if (st === 'cuts') {
      const need = DY.cutsNeeded(), sel = o.cut || [];
      const ps = ut.roster.map(DY.P).sort((a, b) => (a.tin === g.season) - (b.tin === g.season) || DY.cutScore(a) - DY.cutScore(b));
      html = `<div class="box"><div class="glabel">Roster cut-down</div><div class="dy-stats4"><div><b>${ut.roster.length}</b><small>On the roster</small></div><div><b>${DY.rosterMax()}</b><small>Limit</small></div><div><b>${need}</b><small>Must cut</small></div><div><b>${sel.length}</b><small>Selected</small></div></div>
        ${need ? `<p>Pick ${need} player${need > 1 ? 's' : ''} to release (sorted with the most likely cuts first), or let the staff do it.</p><div class="grow"><button class="btn" data-act="autocuts">Staff picks</button></div>` : '<p>You are under the limit. Nobody has to go.</p>'}
        ${need ? `<div class="dy-scroll"><table class="dyt"><thead><tr><th></th><th>Player</th><th>Pos</th><th>Class</th><th>OVR</th><th>POT</th></tr></thead><tbody>${ps.slice(0, 40).map(p => `<tr class="${sel.includes(p.id) ? 'cut' : ''}"><td>${p.tin === g.season ? '<small class="dim">New transfer</small>' : `<button class="dy-ra ${sel.includes(p.id) ? 'on' : ''}" data-cut="${p.id}">${sel.includes(p.id) ? 'Cut' : 'Keep'}</button>`}</td><td>${plink(p)}</td><td>${p.pos}</td><td>${yrLabel(p)}</td><td>${ovrB(p.ovr)}</td><td><span class="dy-pot">${p.potG}</span></td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
    } else if (st === 'schedule' && !DY.isTN()) {
      html = `<div class="box"><div class="glabel">${g.season + 1} schedule</div><p>${esc(DY.UN())}'s ${esc(DY.userT().conf === 'IND' ? 'independent' : DY.userT().conf)} and non-conference games are scheduled for you. Continue to start the new season.</p></div>`;
    } else if (st === 'schedule') {
      const arr = g.nonconfPick[g.season + 1], y = g.season + 1;
      const groups = [['Power 4 & Notre Dame', g.teams.filter(t => (DY.P4.includes(t.conf) && t.conf !== 'SEC') || t.abbr === 'ND')], ['Group of Six', g.teams.filter(t => !DY.P4.includes(t.conf) && t.abbr !== 'ND')], ['FCS', DY.FCS]];
      const cyc = DY.UT_SEC[2026 + ((y - 2026) % 4 + 4) % 4];
      html = `<div class="box"><div class="glabel">${y} non-conference schedule</div><p>Three non-conference games in weeks 0-5. Your ${esc(DY.userT().conf)} slate is set: home ${cyc.H.join(', ')}; away ${cyc.A.join(', ')}. Alabama is the third Saturday in October; Vanderbilt closes the regular season. ${y >= 2027 && DY.cfpSize() === 24 ? 'The playoff is 24 teams from ' + y + ' on.' : ''}</p>
        ${arr.map((x, i) => `<div class="dy-nc"><b>Game ${i + 1}</b><select data-nc="${i}|o">${groups.map(([l, ts]) => `<optgroup label="${l}">${ts.map(t => `<option value="${t.id}" ${t.id === x.o ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join('')}</select><select data-nc="${i}|home"><option value="1" ${x.home ? 'selected' : ''}>Home</option><option value="0" ${!x.home ? 'selected' : ''}>Away</option></select><select data-nc="${i}|wk">${[0, 1, 2, 3, 4, 5].map(w => `<option value="${w}" ${w === x.wk ? 'selected' : ''}>Week ${w}</option>`).join('')}</select></div>`).join('')}
        <div class="grow"><button class="btn" data-act="ncauto">Auto-generate</button></div>${new Set(arr.map(x => x.wk)).size < 3 ? '<p class="dy-l small">Two games are in the same week; pick different weeks (or they will be moved).</p>' : ''}</div>`;
    }
    b.innerHTML = `${steps}${html}<div class="grow"><button class="btn primary big" data-act="main">${esc(primaryAction().label)}</button><button class="btn" data-goto="depth">Projected ${g.season + 1} depth chart</button></div>`;
  }
  function recapHtml() {
    const g = G(), o = g.off, ut = DY.userT(), h = g.hist[g.hist.length - 1], A = g.awards[g.season] || {};
    const mineAw = ut.roster.concat(o.leaving.map(x => x.id)).map(DY.P).filter((p, i, a) => p && a.indexOf(p) === i && p.aw.some(x => x.y === g.season));
    const games = h.games || [];
    const ppg = games.length ? (games.reduce((s, x) => s + x.us, 0) / games.length).toFixed(1) : 0, papg = games.length ? (games.reduce((s, x) => s + x.th, 0) / games.length).toFixed(1) : 0;
    const best = (k) => { const ps = ut.roster.concat(o.leaving.map(x => x.id)).map(DY.P).filter(p => p && p.car[g.season] && p.car[g.season][k]); return ps.sort((a, b) => b.car[g.season][k] - a.car[g.season][k])[0]; };
    const tiles = [['py', 'passing yds'], ['ry', 'rushing yds'], ['rcy', 'receiving yds'], ['tk', 'tackles'], ['sck', 'sacks']].map(([k, l]) => { const p = best(k); return p ? `<div class="dy-tile"><b>${p.car[g.season][k]}</b><span>${l}</span>${plink(p)}</div>` : ''; }).join('');
    const nfl = o.leaving.filter(x => x.why === 'nfl').map(x => DY.P(x.id)), grads = o.leaving.filter(x => x.why === 'grad').map(x => DY.P(x.id));
    const champ = h.finish === 'National champions';
    return `<div class="dy-recap-hero ${champ ? 'champ' : ''}" style="--tc:${ut.c1}"><div><span class="glabel">${g.season} season in review</span><h2>${h.w}-${h.l}${h.sec ? ' · ' + esc(DY.userT().conf) + ' champions' : ''}</h2><p class="dy-finish">${esc(h.finish)}</p>
      <p>Final AP: ${h.ap ? 'No. ' + h.ap : 'unranked'} · ${ppg} points a game, ${papg} allowed · National champion: ${esc(h.champ)}</p></div>
      ${A.heis ? `<div class="dy-heis"><span class="glabel">Heisman Trophy</span><b>${plink(DY.P(A.heis.id))}</b><small>${A.heis.pos}, ${esc(T(A.heis.t).name)}</small></div>` : ''}</div>
      <div class="dy-results">${games.map(x => `<span class="${x.us > x.th ? 'w' : 'l'}" title="${esc(x.on)}">${x.us > x.th ? 'W' : 'L'} <b>${esc(x.o)}</b> ${x.us}-${x.th}</span>`).join('')}</div>
      <div class="dy-tiles">${tiles}</div>
      <div class="dy-grid"><div class="dy-col">
        <div class="box"><div class="glabel">${esc(DY.UN())} honors</div><ul class="dy-mini">${mineAw.map(p => `<li>${plink(p)} <small>${p.aw.filter(x => x.y === g.season).map(x => esc(DY.AWARD_NAME[x.a])).join(', ')}</small></li>`).join('') || '<li class="dim">None this year.</li>'}</ul></div>
        <div class="box"><div class="glabel">Declared for the NFL Draft (${nfl.length})</div>${nfl.length ? `<p class="small dim">Make a pitch to bring one back: an NIL raise against his draft stock and loyalty.</p><table class="dyt"><tbody>${nfl.map(p => `<tr><td>${plink(p)} <small>${p.pos} · ${p.ovr} · ${yrLabel(p)}</small></td><td class="small">Return chance ${Math.round(DY.persuadeChance(p) * 100)}% · with +$1M: ${Math.round(DY.persuadeChance(p, 1000000) * 100)}%</td><td>${o.pitched[p.id] != null ? `<small>${o.pitched[p.id] ? 'Coming back!' : 'Staying in the draft'}</small>` : `<select data-persamt="${p.id}">${[0, 100000, 250000, 500000, 1000000, 2000000].map(v => `<option value="${v}">${v ? '+' + DY.money(v) : 'No raise'}</option>`).join('')}</select><button class="dy-ra" data-persuade="${p.id}">Make the pitch</button>`}</td></tr>`).join('')}</tbody></table>` : '<p class="dim small">Nobody left early.</p>'}</div>
        <div class="box"><div class="glabel">Out of eligibility (${grads.length})</div><ul class="dy-mini dy-cols2">${grads.map(p => `<li>${plink(p)} <small>${p.pos} · ${p.ovr}</small></li>`).join('') || '<li class="dim">Nobody.</li>'}</ul></div>
      </div><div class="dy-col">
        <div class="box"><div class="glabel">All-America first team</div><ul class="dy-mini">${(A.aa1 || []).map(DY.P).map(p => `<li><small>${p.pos}</small> ${plink(p)} <small>${esc(T(p.t).abbr)}</small></li>`).join('')}</ul></div>
      </div></div>`;
  }
})(typeof window !== 'undefined' ? window : globalThis);
