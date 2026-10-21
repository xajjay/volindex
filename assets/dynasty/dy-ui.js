/* The Vol Index — Football Dynasty: the hub (setup, saves, dashboard, schedule, roster, depth chart, recruiting,
   polls, standings, stats, NIL, history, settings, the offseason stages, player and prospect cards). */
(function (root) {
  'use strict';
  const DY = root.DY;
  const UI = root.VI_DYN = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let APP = null;
  const V = { recs: 'season', tab: 'home', rpos: 'ALL', rsort: 'ovr', conf: 'SEC', rfind: { pos: 'ALL', stars: 0, mine: false, q: '' }, ppos: 'ALL', statk: 'py', setup: null, msg: null };
  const G = () => DY.G;
  const T = id => DY.T(id);
  const yrLabel = p => (p.rs ? 'RS ' : '') + (['', 'Fr.', 'So.', 'Jr.', 'Sr.', 'Gr.', 'Gr.'][Math.min(6, p.yr)] || 'Gr.');
  const stars = n => '★'.repeat(n || 0) + '<span class="dy-off">' + '★'.repeat(Math.max(0, 5 - (n || 0))) + '</span>';
  const ovrCls = o => o >= 90 ? 'e' : o >= 84 ? 'g' : o >= 76 ? 'm' : 'l';
  const ovrB = o => `<span class="dy-ovr ${ovrCls(o)}">${o}</span>`;
  const tlink = (id, rk) => { const t = T(id); if (!t) return ''; const r = rk === false ? null : DY.apRank(id); return `<span class="dy-t" style="--tc:${t.c1}">${r ? `<small>${r}</small> ` : ''}${esc(t.name)}</span>`; };
  const plink = (p, txt) => p ? `<a href="#" class="dy-pl" data-pid="${p.id}">${esc(txt || p.n)}</a>` : '';
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  UI.render = app => {
    APP = app;
    document.title = 'Vol Dynasty · Football · The Vol Index';
    if (root.DYG && root.DYG.live() && APP.querySelector('.dyg')) return;
    if (!DY.G) return landing();
    hub();
  };

  /* ---------- busy overlay ---------- */
  function busy(label, fn) {
    const o = document.createElement('div'); o.className = 'dy-busy'; o.innerHTML = `<div><span class="dy-spin"></span>${esc(label)}</div>`;
    document.body.appendChild(o);
    setTimeout(() => { try { fn(); } catch (e) { console.error(e); V.msg = 'Something went wrong: ' + e.message; } o.remove(); hub(); autosave(); }, 40);
  }
  function autosave() { const g = G(); if (g && g.settings.autosave !== false) DY.saveSlot(g.slot || 1, root.DYG && root.DYG.live()).then(err => { if (err) { V.msg = err; } }); }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && G() && root.DYG && root.DYG.live()) DY.saveSlot(G().slot || 1, root.DYG.live()); });

  /* ---------- landing: slots and new dynasty ---------- */
  function landing() {
    const m = DY.readMeta();
    APP.innerHTML = `<div class="wrap games dy">
      <div class="gcrumb"><a href="#games">Games</a> › <a href="#games-football">Football</a> › Vol Dynasty</div>
      <div class="ghead"><span class="gtag">Preview</span><h1>Vol Dynasty</h1><p>Take over Tennessee with the real 2026 roster and depth chart. Call every play, recruit the real 2027 class and the classes after it, work the portal and your NIL budget, and chase the playoff year after year.</p></div>
      <div class="dy-slots">${[1, 2, 3].map(n => { const s = m[n]; return `<div class="box dy-slot ${s ? '' : 'empty'}"><div class="glabel">Slot ${n}</div>${s ? `<h3>Coach ${esc(s.coach)}</h3><p class="dim">${esc(s.label)} · ${esc(s.rec)}${s.natl ? ` · ${s.natl} national title${s.natl > 1 ? 's' : ''}` : ''}</p><p class="dim small">Saved ${new Date(s.at).toLocaleString()}</p><div class="grow"><button class="btn primary" data-load="${n}">Continue</button><button class="btn" data-del="${n}">Delete</button></div>` : `<p class="dim">Empty</p><div class="grow"><button class="btn primary" data-new="${n}">New dynasty</button></div>`}</div>`; }).join('')}</div>
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
    s.coach = s.coach || ''; s.arch = s.arch || 'motivator'; s.diff = s.diff || 'varsity'; s.cfp = s.cfp || 12; s.coachMode = s.coachMode || 'offense';
    s.recruiting = s.recruiting || 'manual'; s.portal = s.portal || 'manual'; s.nil = s.nil || 'manual'; s.injuries = s.injuries == null ? true : s.injuries; s.speed = s.speed || 'slow'; s.shake = s.shake == null ? true : s.shake;
    const seg = (key, opts) => `<div class="gseg" data-key="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(s[key]) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
    APP.innerHTML = `<div class="wrap games dy"><div class="gcrumb"><a href="#games-football-dynasty" data-back="1">Vol Dynasty</a> › New dynasty</div>
      <div class="ghead"><h1>New dynasty</h1><p>Tennessee, 2026. The real roster, depth chart and schedule; the real 2027 recruiting class already committed.</p></div>
      <div class="box gsetup dy-setup">
        <div class="gfield"><div class="glabel">Coach name</div><input id="dyCoach" class="dy-in" maxlength="28" placeholder="Your name" value="${esc(s.coach)}"></div>
        <div class="gfield"><div class="glabel">Coaching style</div><div class="dy-archs">${Object.entries(DY.COACH_ARCH).map(([k, a]) => `<button type="button" class="dy-arch" data-arch="${k}" aria-pressed="${s.arch === k}"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></button>`).join('')}</div></div>
        <div class="gfield"><div class="glabel">Difficulty</div>${seg('diff', [['freshman', 'Freshman'], ['varsity', 'Varsity'], ['allamerican', 'All-American'], ['heisman', 'Heisman']])}<p class="dim small">Higher levels give CPU players a small boost on every snap.</p></div>
        <div class="gfield"><div class="glabel">Playoff</div>${seg('cfp', [[12, '12 teams (real 2026 format)'], [24, '24 teams']])}</div>
        <div class="gfield"><div class="glabel">Play calling</div>${seg('coachMode', [['full', 'Offense and defense'], ['offense', 'Offense (your DC calls defense)'], ['watch', 'Just watch']])}</div>
        <div class="gfield"><div class="glabel">Recruiting</div>${seg('recruiting', [['manual', 'I recruit'], ['auto', 'Auto'], ['off', 'Off']])}</div>
        <div class="gfield"><div class="glabel">Transfer portal</div>${seg('portal', [['manual', 'I manage it'], ['auto', 'Auto'], ['off', 'Off']])}</div>
        <div class="gfield"><div class="glabel">NIL</div>${seg('nil', [['manual', 'I approve raises'], ['auto', 'Auto']])}</div>
        <div class="gfield"><div class="glabel">Game speed</div>${seg('speed', [['slow', 'Slow'], ['fast', 'Fast']])}</div>
        <div class="gfield"><div class="glabel">Injuries</div>${seg('injuries', [[true, 'On'], [false, 'Off']])}</div>
        <div class="gfield"><div class="glabel">Third-down screen shake in big home games</div>${seg('shake', [[true, 'On'], [false, 'Off']])}</div>
        <div class="grow"><button class="btn primary big" id="dyStart">Start the dynasty</button><button class="btn" data-back="1">Back</button></div>
      </div></div>`;
    APP.firstElementChild.onclick = e => {
      const b = e.target.closest('button,a'); if (!b) return;
      if (b.dataset.back) { e.preventDefault(); return landing(); }
      if (b.dataset.arch) { s.arch = b.dataset.arch; return setup(); }
      const segEl = b.closest('.gseg');
      if (segEl && b.dataset.v != null) { const v = b.dataset.v; s[segEl.dataset.key] = v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? +v : v; s.coach = APP.querySelector('#dyCoach').value; return setup(); }
      if (b.id === 'dyStart') {
        s.coach = APP.querySelector('#dyCoach').value.trim() || 'Coach';
        busy('Building the 2026 season: 136 teams, 7,400 players…', () => {
          DY.newDynasty({ coach: s.coach, arch: s.arch, settings: { cfp: s.cfp, coachMode: s.coachMode, recruiting: s.recruiting, portal: s.portal, nil: s.nil, injuries: s.injuries, speed: s.speed, shake: s.shake, difficulty: s.diff } });
          G().slot = s.slot; V.tab = 'home';
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
    APP.innerHTML = `<div class="dy dyhub">
      <div class="dyh" style="--tc:${ut.c1}">
        <div class="wrap dyh-in">
          <div class="dyh-id"><span class="dyh-badge">TENN</span><div><div class="dyh-name">${rk ? `<small>No. ${rk}</small> ` : ''}Tennessee</div><div class="dyh-sub">Coach ${esc(g.coach.name)} · ${esc(DY.weekLabel())}</div></div></div>
          <div class="dyh-rec"><b>${ut.w}-${ut.l}</b><small>${ut.cw}-${ut.cl} SEC</small></div>
          <div class="dyh-act">${act ? `<button class="btn primary big" data-act="main">${esc(act.label)}</button>${act.sim ? `<button class="btn" data-act="sim">${esc(act.sim)}</button>` : ''}` : ''}<button class="btn" data-act="save" title="Save to slot ${g.slot || 1}">Save</button></div>
        </div>
        <nav class="wrap dyh-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${V.tab === k}">${l}${k === 'recruit' && g.phase !== 'offseason' && g.recruit && !g.recruit.signed ? ` <small>${DY.HOURS() - DY.hoursUsed()}h</small>` : ''}</button>`).join('')}</nav>
      </div>
      ${V.msg ? `<div class="wrap"><div class="gnote dy-msg">${esc(V.msg)} <button class="glink" data-act="msgx">Dismiss</button></div></div>` : ''}
      <div class="wrap dy-body" id="dyBody"></div>
      <div class="dy-modal" id="dyModal" hidden><div class="dy-modal-in" role="dialog" aria-modal="true"><button class="dy-x" data-act="close" aria-label="Close">×</button><div id="dyModalBody"></div></div></div>
    </div>`;
    const body = APP.querySelector('#dyBody');
    ({ home, schedule, roster, depth, recruit, polls, standings, stats, nil, history, settings })[V.tab](body);
    APP.firstElementChild.onclick = onClick; APP.firstElementChild.onchange = onChange; APP.firstElementChild.oninput = onInput;
    const at = APP.querySelector('.dyh-tabs [aria-selected="true"]'); if (at && at.scrollIntoView) at.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function primaryAction() {
    const g = G();
    if (g.phase === 'preseason') return { label: `Kick off the ${g.season} season`, main: () => { DY.startSeason(); hub(); } };
    if (g.phase === 'season') {
      const x = DY.userGames(g.week)[0];
      if (x && !x.res) return { label: `Play: ${x.h === g.user ? 'vs' : 'at'} ${T(DY.oppOf(x)).name}`, sim: 'Sim game', x };
      return { label: `Sim week ${g.week}${x ? '' : ' (bye)'}` };
    }
    if (g.phase === 'ccg') { const x = DY.postUserGame(); return x ? { label: `Play: ${x.title}`, sim: 'Sim game', x } : { label: 'Sim championship week' }; }
    if (g.phase === 'post') { const x = DY.postUserGame(); if (x) return { label: `Play: ${x.title.replace(/ \(CFP.*\)/, '')}${/CFP/.test(x.title) ? ' (CFP)' : ''}`, sim: 'Sim game', x }; return { label: `Sim: ${g.post.label}` }; }
    if (g.phase === 'offseason') { const i = DY.OFF_ORDER.indexOf(g.off.stage); return { label: i >= DY.OFF_ORDER.length - 1 ? `Start ${g.season + 1}` : `Continue: ${DY.OFF_LABEL[DY.OFF_ORDER[i + 1]]}` }; }
    return null;
  }
  function advanceAfterGame() {
    const g = G();
    if (g.phase === 'season') DY.finishWeek();
    else if (g.phase === 'ccg') DY.finishCCG();
    else if (g.phase === 'post') DY.finishRound();
  }
  function mainAction(sim) {
    const g = G(), a = primaryAction(); if (!a) return;
    if (a.main) return a.main();
    if (g.phase === 'offseason') return busy('Working…', () => DY.offNext());
    if (a.x && !sim) return playGame(a.x);
    if (a.x && sim) return busy('Simulating…', () => { DY.simGame(a.x); advanceAfterGame(); V.tab = 'home'; });
    busy(g.phase === 'season' ? `Simulating week ${g.week}…` : 'Simulating…', () => advanceAfterGame());
  }
  function playGame(x) {
    APP.innerHTML = `<div class="dy dygame"><div class="wrap"><div class="gcrumb"><a href="#" data-leave="1">‹ Back to the dynasty</a> <span class="dim small">(the game is saved where you leave it)</span></div><div class="dy-game"></div></div></div>`;
    APP.firstElementChild.onclick = e => { const a = e.target.closest('[data-leave]'); if (a) { e.preventDefault(); const live = root.DYG.live(); if (live) DY.saveSlot(G().slot || 1, live); root.DYG.close(); hub(); } const pl = e.target.closest('[data-pid]'); if (pl && !a) { e.preventDefault(); } };
    root.DYG.open(APP.querySelector('.dy-game'), x, { onDone: () => { busy('Finishing the week…', () => { advanceAfterGame(); V.tab = 'home'; }); } });
    root.scrollTo(0, 0);
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const el = e.target.closest('[data-tab],[data-act],[data-pid],[data-rid],[data-box],[data-sort],[data-rpos],[data-dmove],[data-ract],[data-roffer],[data-radd],[data-rrm],[data-nilans],[data-retain],[data-poffer],[data-conf],[data-ppos],[data-statk],[data-slot],[data-set],[data-rfind],[data-nc],[data-goto],[data-recs]');
    if (!el) return;
    const g = G(), d = el.dataset;
    if (el.tagName === 'A') e.preventDefault();
    if (d.tab) { V.tab = d.tab; V.msg = null; return hub(); }
    if (d.goto) { V.tab = d.goto; return hub(); }
    if (d.act === 'main') return mainAction(false);
    if (d.act === 'sim') return mainAction(true);
    if (d.act === 'save') { el.disabled = true; el.textContent = 'Saving…'; return DY.saveSlot(g.slot || 1, null).then(err => { V.msg = err || `Saved to slot ${g.slot || 1}.`; hub(); }); }
    if (d.act === 'msgx') { V.msg = null; return hub(); }
    if (d.act === 'close') return closeModal();
    if (d.act === 'resume') { const x = g.sched.concat(g.post ? (g.post.games || []).concat(g.post.cur || [], g.post.bowls || []) : []).find(y => y.id === g.live.id); if (x) return playGame(x); }
    if (d.act === 'quit') { DY.G = null; return landing(); }
    if (d.act === 'export') return DY.exportBlob(null).then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `vol-dynasty-${g.season}.vdyn`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
    if (d.act === 'autodepth') { const t = DY.userT(); t.depthEdited = false; DY.refreshDepth(t); return hub(); }
    if (d.act === 'portalround') return busy('Players are making their decisions…', () => DY.resolvePortal(false));
    if (d.act === 'ncauto') { g.nonconfPick[g.season + 1] = DY.autoNonconf(g.season + 1); return hub(); }
    if (d.pid) return playerCard(+d.pid);
    if (d.rid) return prospectCard(+d.rid);
    if (d.box) return boxModal(d.box);
    if (d.sort) { V.rsort = d.sort; return hub(); }
    if (d.rpos) { V.rpos = d.rpos; return hub(); }
    if (d.ppos) { V.ppos = d.ppos; return hub(); }
    if (d.statk) { V.statk = d.statk; return hub(); }
    if (d.recs) { V.recs = d.recs; return hub(); }
    if (d.conf) { V.conf = d.conf; return hub(); }
    if (d.slot) { const n = +d.slot; g.slot = n; return DY.saveSlot(n, null).then(err => { V.msg = err || `Saved to slot ${n}.`; hub(); }); }
    if (d.dmove) { const [pos, id, dir] = d.dmove.split('|'); const t = DY.userT(), arr = t.depth[pos], i = arr.indexOf(+id), j = i + (+dir); if (j >= 0 && j < arr.length) { [arr[i], arr[j]] = [arr[j], arr[i]]; t.depthEdited = true; } return hub(); }
    if (d.ract) { const [id, act] = d.ract.split('|'); const p = DY.RP(+id); const err = DY.setAct(+id, act, !p.acts[act]); V.msg = err; return rerenderKeep(); }
    if (d.roffer) { V.msg = DY.offer(+d.roffer); return rerenderKeep(); }
    if (d.radd) { V.msg = DY.boardAdd(+d.radd); return rerenderKeep(); }
    if (d.rrm) { DY.boardRemove(+d.rrm); return rerenderKeep(); }
    if (d.rfind) { const [k, v] = d.rfind.split('|'); V.rfind[k] = k === 'stars' ? +v : k === 'mine' ? !V.rfind.mine : v; return rerenderKeep(); }
    if (d.nilans) { const [id, yes] = d.nilans.split('|'); DY.answerNil(+id, yes === '1'); return hub(); }
    if (d.retain) { const inp = APP.querySelector(`[data-retainamt="${d.retain}"]`); V.msg = DY.retain(+d.retain, +(inp && inp.value) || 0); return hub(); }
    if (d.poffer) { const inp = APP.querySelector(`[data-pofferamt="${d.poffer}"]`); V.msg = DY.portalOffer(+d.poffer, +(inp && inp.value) || 0) || 'Offer made.'; return hub(); }
    if (d.set) { const [k, v] = d.set.split('|'); g.settings[k] = v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? +v : v; if (k === 'difficulty') g.settings.diffBoost = { freshman: -3, varsity: 0, allamerican: 1.5, heisman: 3 }[v] || 0; return hub(); }
    if (d.nc) { /* handled in change */ }
  }
  function rerenderKeep() { const y = root.scrollY; hub(); root.scrollTo(0, y); }
  function onChange(e) {
    const el = e.target, g = G();
    if (el.dataset.rnil) { DY.setNil(+el.dataset.rnil, +el.value); return rerenderKeep(); }
    if (el.dataset.rvisit) { V.msg = DY.setVisit(+el.dataset.rvisit, +el.value) || 'Official visit scheduled.'; return rerenderKeep(); }
    if (el.dataset.nc) { const [i, k] = el.dataset.nc.split('|'); const arr = g.nonconfPick[g.season + 1]; arr[+i][k] = k === 'home' ? el.value === '1' : +el.value; return hub(); }
    if (el.id === 'dyRfq') { V.rfind.q = el.value; return rerenderKeep(); }
    if (el.dataset.rfsel) { V.rfind[el.dataset.rfsel] = el.value; return rerenderKeep(); }
  }
  function onInput() { }

  /* ---------- modal ---------- */
  function modal(html) { const m = APP.querySelector('#dyModal'); APP.querySelector('#dyModalBody').innerHTML = html; m.hidden = false; m.onclick = e => { if (e.target === m) closeModal(); }; document.body.classList.add('dy-noscroll'); }
  function closeModal() { const m = APP.querySelector('#dyModal'); if (m) m.hidden = true; document.body.classList.remove('dy-noscroll'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && APP && APP.querySelector('#dyModal:not([hidden])')) closeModal(); });

  /* ---------- home ---------- */
  function home(b) {
    const g = G(), ut = DY.userT();
    if (g.phase === 'offseason') return offseason(b);
    const parts = [];
    if (g.live && !(root.DYG && root.DYG.live())) parts.push(`<div class="box dy-resume"><b>Game in progress</b> <span class="dim">${esc(T(g.live.T.a).name)} ${g.live.score.a}, ${esc(T(g.live.T.h).name)} ${g.live.score.h} · Q${Math.min(4, g.live.q)}</span> <button class="btn primary" data-act="resume">Resume</button></div>`);
    // next game
    const a = primaryAction();
    if (a && a.x) parts.push(nextGameCard(a.x));
    else if (g.phase === 'preseason') parts.push(preseasonCard());
    else if (g.phase === 'season') parts.push(`<div class="box"><div class="glabel">Week ${g.week}</div><h3>Bye week</h3><p class="dim">Rest up. Recruiting actions still count this week.</p></div>`);
    if (g.phase === 'post' || g.phase === 'ccg') parts.push(bracketCard());
    const last = DY.teamGames(ut.id).filter(x => x.res).slice(-1)[0];
    const col1 = parts.join('') + (last ? lastGameCard(last) : '') + aroundCard() + newsCard();
    const col2 = pollMini() + standMini() + recruitMini() + leadersMini() + injuriesMini();
    b.innerHTML = `<div class="dy-grid"><div class="dy-col">${col1}</div><div class="dy-col">${col2}</div></div>`;
  }
  function matchBars(a, b) {
    const A = DY.teamOvr(a), B = DY.teamOvr(b);
    const row = (l, x, y) => `<div class="dy-mrow"><span>${x}</span><div class="dy-mbar"><i style="width:${50 + (x - y) * 3}%;background:${a.c1}"></i></div><span>${y}</span><small>${l}</small></div>`;
    return `<div class="dy-match">${row('Overall', A.ovr, B.ovr)}${row('Offense', A.off, B.off)}${row('Defense', A.def, B.def)}</div>`;
  }
  function nextGameCard(x) {
    const g = G(), ut = DY.userT(), o = T(DY.oppOf(x)), home = x.h === ut.id;
    const L = DY.lineup(o), qb = L.QB[0];
    const star = o.roster.map(DY.P).sort((a, b) => b.ovr - a.ovr)[0];
    const opts = DY.gameOpts(x);
    const date = x.post ? '' : DY.dateStr(DY.weekDate(g.season, x.wk));
    return `<div class="box dy-next" style="--tc:${o.c1}">
      <div class="glabel">${x.post ? esc(x.title) : `Week ${x.wk} · ${date}`}${opts.rival ? ` · <span class="dy-riv">${esc(opts.rival)}</span>` : ''}</div>
      <div class="dy-vs"><div>${tlink(ut.id)}<small>${ut.w}-${ut.l}</small></div><b>${x.neutral ? 'vs' : home ? 'vs' : 'at'}</b><div>${tlink(o.id)}<small>${o.fbs ? o.w + '-' + o.l + ' · ' : ''}${esc(DY.CONF_NAME[o.conf])}</small></div></div>
      <p class="dim small">${x.neutral ? 'Neutral site' + (x.tag && /Neutral/.test(x.tag) ? ' · ' + esc(x.tag.replace('Neutral: ', '')) : '') : home ? 'Neyland Stadium, Knoxville' : esc(o.name) + ' home game · ' + o.cap + ',000 seats'}${opts.big ? ' · <b>Big game</b>' : ''} · ${esc(DY.STYLES[o.style].name)} offense${o.fbs ? ' · Coach ' + esc(o.coach) : ''}</p>
      ${matchBars(ut, o)}
      <p class="small">Players to watch: ${plink(qb, qb.n)} (QB, ${qb.ovr})${star && star !== qb ? `, ${plink(star)} (${star.pos}, ${star.ovr})` : ''}</p>
      <div class="grow"><button class="btn primary big" data-act="main">Play the game</button><button class="btn" data-act="sim">Sim it</button></div></div>`;
  }
  function preseasonCard() {
    const g = G(), ut = DY.userT(), o = DY.teamOvr(ut), games = DY.userGames();
    return `<div class="box"><div class="glabel">${g.season} season preview</div><h3>Tennessee opens No. ${DY.apRank(ut.id) || 'NR'}</h3>
      <p class="dim">Team overall ${o.ovr} (offense ${o.off}, defense ${o.def}). ${esc(DY.STYLES[ut.style].name)} offense. NIL budget ${DY.money(ut.budget)}.</p>
      <ol class="dy-sched-mini">${games.map(x => `<li><span>Wk ${x.wk}</span> ${x.h === ut.id ? 'vs' : 'at'} ${tlink(DY.oppOf(x))}${x.tag ? ` <em>${esc(x.tag)}</em>` : ''}</li>`).join('')}</ol>
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
    else if (g.post) games = (g.post.rounds.length ? g.post.rounds[g.post.rounds.length - 1] : (g.post.games || [])).filter(x => x.res);
    if (!games.length) return '';
    return `<div class="box"><div class="glabel">Around the country${w ? ' · Week ' + w : ''}</div><ul class="dy-scores">${games.slice(0, 14).map(x => { const hw = x.res.h > x.res.a; return `<li><span class="${hw ? '' : 'dy-win'}">${tlink(x.a)} ${x.res.a}</span><span class="${hw ? 'dy-win' : ''}">${tlink(x.h)} ${x.res.h}</span>${x.title ? `<em>${esc(x.title)}</em>` : ''}</li>`; }).join('')}</ul></div>`;
  }
  function newsCard() {
    const g = G();
    return `<div class="box"><div class="glabel">News</div><ul class="dy-news">${g.news.slice(0, 12).map(n => `<li class="n-${n.type}"><b>${esc(n.h)}</b>${n.b ? `<span>${esc(n.b)}</span>` : ''}<small>${n.y} · ${n.ph === 'season' ? 'Week ' + n.w : esc(n.ph)}</small></li>`).join('')}</ul></div>`;
  }
  function pollMini() {
    const g = G();
    return `<div class="box"><div class="glabel">AP Top 25 <button class="glink" data-goto="polls">All</button></div><ol class="dy-poll">${g.polls.ap.slice(0, 10).map((x, i) => `<li class="${x.t === g.user ? 'me' : ''}"><span>${i + 1}</span>${tlink(x.t, false)}<small>${T(x.t).w}-${T(x.t).l}</small></li>`).join('')}</ol>${DY.apRank(g.user) > 10 ? `<p class="small">Tennessee: No. ${DY.apRank(g.user)}</p>` : ''}</div>`;
  }
  function standMini() {
    const st = DY.standings('SEC');
    return `<div class="box"><div class="glabel">SEC standings <button class="glink" data-goto="standings">All</button></div><table class="dyt dy-tight"><tbody>${st.map((t, i) => `<tr class="${t.user ? 'me' : ''}"><td>${i + 1}</td><td>${tlink(t.id, false)}${t.ap ? ` <small class="dim">(${t.ap})</small>` : ''}</td><td>${t.cw}-${t.cl}</td><td class="dim">${t.w}-${t.l}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function recruitMini() {
    const g = G(), R = g.recruit; if (!R) return '';
    const c = DY.myCommits().sort((a, b) => b.rec.c - a.rec.c);
    return `<div class="box"><div class="glabel">Class of ${R.year} <button class="glink" data-goto="recruit">Recruiting</button></div><p><b>No. ${R.classRank || '—'}</b> class · ${c.length} commits${g.settings.recruiting === 'manual' && !R.signed ? ` · ${DY.HOURS() - DY.hoursUsed()} hours left this week` : ''}</p><ul class="dy-mini">${c.slice(0, 5).map(p => `<li><span class="dy-stars">${stars(p.rec.stars)}</span> <a href="#" data-rid="${p.id}">${esc(p.n)}</a> <small>${p.pos} · ${esc(p.home)}</small></li>`).join('')}</ul></div>`;
  }
  function leadersMini() {
    const ut = DY.userT(), ps = ut.roster.map(DY.P).filter(p => p.s);
    const best = (k, l, f) => { const p = ps.filter(x => x.s[k]).sort((a, b) => b.s[k] - a.s[k])[0]; return p ? `<li><small>${l}</small> ${plink(p)} ${f(p.s)}</li>` : ''; };
    const html = best('py', 'Passing', s => `${s.py} yds, ${s.ptd || 0} TD`) + best('ry', 'Rushing', s => `${s.ry} yds, ${s.rtd || 0} TD`) + best('rcy', 'Receiving', s => `${s.rcy} yds, ${s.rctd || 0} TD`) + best('tk', 'Tackles', s => s.tk) + best('sck', 'Sacks', s => s.sck) + best('int', 'Interceptions', s => s.int);
    return html ? `<div class="box"><div class="glabel">Team leaders</div><ul class="dy-mini">${html}</ul></div>` : '';
  }
  function injuriesMini() {
    const ut = DY.userT(), inj = ut.roster.map(DY.P).filter(p => p.inj && p.inj.wks > 0);
    return inj.length ? `<div class="box"><div class="glabel">Injuries</div><ul class="dy-mini">${inj.map(p => `<li>${plink(p)} <small>${p.pos} · ${esc(p.inj.what)} · ${p.inj.wks >= 12 ? 'season' : p.inj.wks + ' wk'}</small></li>`).join('')}</ul></div>` : '';
  }
  function bracketCard() {
    const g = G(), P = g.post; if (!P) return '';
    if (P.stage === 'ccg') return `<div class="box"><div class="glabel">Championship week</div><ul class="dy-scores">${P.games.map(x => `<li><span>${tlink(x.a)} ${x.res ? x.res.a : ''}</span><span>${tlink(x.h)} ${x.res ? x.res.h : ''}</span><em>${esc(x.title)}</em></li>`).join('')}</ul></div>`;
    const rounds = P.rounds.concat(P.cur && !P.rounds.includes(P.cur) ? [P.cur] : []);
    const seed = id => P.seeds.indexOf(id) + 1;
    const mine = P.bowls.find(x => x.h === g.user || x.a === g.user);
    return `<div class="box"><div class="glabel">College Football Playoff · ${P.size} teams</div>
      <ol class="dy-seeds">${P.seeds.map((id, i) => `<li class="${id === g.user ? 'me' : ''}"><span>${i + 1}</span>${tlink(id, false)}<small>${T(id).w}-${T(id).l}${T(id).champ === g.season ? ' · champ' : ''}</small></li>`).join('')}</ol>
      ${rounds.map(rd => `<div class="dy-round"><div class="glabel">${esc((rd[0] && rd[0].title || '').replace(/^.*\(|\)$/g, '').replace(/^(Rose|Sugar|Orange|Cotton|Fiesta|Peach) Bowl /, '') || 'Round')}</div>${rd.map(x => `<div class="dy-bm ${x.res ? 'done' : ''}"><span class="${x.res && x.res.a > x.res.h ? 'dy-win' : ''}">(${seed(x.a)}) ${tlink(x.a, false)} ${x.res ? x.res.a : ''}</span><span class="${x.res && x.res.h > x.res.a ? 'dy-win' : ''}">(${seed(x.h)}) ${tlink(x.h, false)} ${x.res ? x.res.h : ''}</span><em>${esc(x.title.replace(/ \(CFP.*/, ''))}${x.neutral ? '' : ' · campus'}</em></div>`).join('')}</div>`).join('')}
      ${mine ? `<p><b>Tennessee's bowl:</b> ${esc(mine.title)} vs ${tlink(mine.h === g.user ? mine.a : mine.h)}${mine.res ? ` · ${mine.h === g.user ? mine.res.h + '-' + mine.res.a : mine.res.a + '-' + mine.res.h}` : ''}</p>` : ''}</div>`;
  }

  /* ---------- schedule ---------- */
  function schedule(b) {
    const g = G(), ut = DY.userT();
    const games = DY.userGames().concat(g.post ? [...(g.post.games || []), ...(g.post.rounds || []).flat(), ...(g.post.cur && !g.post.rounds.includes(g.post.cur) ? g.post.cur : []), ...(g.post.bowls || [])].filter((x, i, arr) => (x.h === ut.id || x.a === ut.id) && arr.indexOf(x) === i) : []);
    b.innerHTML = `<div class="box"><div class="glabel">${g.season} schedule</div><table class="dyt dy-sched"><thead><tr><th>Wk</th><th>Date</th><th>Opponent</th><th>Result</th><th class="hide-s"></th></tr></thead><tbody>${games.map(x => {
      const o = DY.oppOf(x), home = x.h === ut.id, r = x.res, us = r && (home ? r.h : r.a), th = r && (home ? r.a : r.h);
      return `<tr class="${g.phase === 'season' && x.wk === g.week ? 'cur' : ''}"><td>${x.post ? '—' : x.wk}</td><td>${x.post ? '' : DY.dateStr(DY.weekDate(g.season, x.wk))}</td><td>${x.neutral ? 'vs' : home ? 'vs' : 'at'} ${tlink(o)} <small class="dim">${T(o).fbs ? T(o).w + '-' + T(o).l : 'FCS'}</small>${x.title ? `<br><small>${esc(x.title)}</small>` : x.tag ? `<br><small>${esc(x.tag)}</small>` : ''}</td><td>${r ? `<b class="${us > th ? 'dy-w' : 'dy-l'}">${us > th ? 'W' : 'L'} ${us}-${th}${r.ot ? ' OT' : ''}</b>` : ''}</td><td class="hide-s">${r && x.box && x.box.ts ? `<button class="glink" data-box="${x.id}">Box</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function boxModal(id) {
    const g = G(), x = g.sched.concat(g.post ? [...(g.post.games || []), ...(g.post.rounds || []).flat(), ...(g.post.bowls || [])] : []).find(y => y.id === id) || (g.lastPost || []).find(y => y.id === id);
    if (!x || !x.box) return;
    modal(`<h3>${esc(T(x.a).name)} ${x.res.a}, ${esc(T(x.h).name)} ${x.res.h}</h3>${root.DYG.boxHtml({ h: T(x.h), a: T(x.a) }, x.box.ts, x.box.ls, x.box.ps || {})}`);
  }

  /* ---------- roster ---------- */
  function roster(b) {
    const ut = DY.userT();
    let ps = ut.roster.map(DY.P);
    if (V.rpos !== 'ALL') ps = ps.filter(p => p.pos === V.rpos);
    const sorters = { ovr: (a, b) => b.ovr - a.ovr, pot: (a, b) => DY.gradeIdx(a.potG) - DY.gradeIdx(b.potG) || b.ovr - a.ovr, yr: (a, b) => b.yr - a.yr || b.ovr - a.ovr, num: (a, b) => a.num - b.num, name: (a, b) => a.n.localeCompare(b.n), nil: (a, b) => (b.nil || 0) - (a.nil || 0) };
    ps.sort(sorters[V.rsort] || sorters.ovr);
    const posList = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'IOL', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P'];
    const th = (k, l) => `<th><button class="dy-sortb ${V.rsort === k ? 'on' : ''}" data-sort="${k}">${l}</button></th>`;
    b.innerHTML = `<div class="box"><div class="glabel">Roster · ${ut.roster.length} players · team ${DY.teamOvr(ut).ovr} OVR</div>
      <div class="gchips dy-chips">${posList.map(p => `<button data-rpos="${p}" aria-pressed="${V.rpos === p}">${p === 'ALL' ? 'All' : p}</button>`).join('')}</div>
      <div class="dy-scroll"><table class="dyt dy-roster"><thead><tr>${th('num', '#')}${th('name', 'Name')}<th>Pos</th>${th('yr', 'Class')}${th('ovr', 'OVR')}${th('pot', 'POT')}<th class="hide-s">Type</th><th class="hide-s">Ht/Wt</th><th class="hide-s">Personality</th>${th('nil', 'NIL')}</tr></thead><tbody>
      ${ps.map(p => `<tr class="${p.inj && p.inj.wks > 0 ? 'inj' : ''}"><td>${p.num}</td><td>${plink(p)}${p.real ? '' : p.prevT != null ? ' <small class="dim">TR</small>' : ''}${p.inj && p.inj.wks > 0 ? ' <small class="dy-l">INJ</small>' : ''}</td><td>${p.pos}</td><td>${yrLabel(p)}</td><td>${ovrB(p.ovr)}</td><td><span class="dy-pot">${p.potG}</span></td><td class="hide-s small">${esc(p.arch)}</td><td class="hide-s small">${DY.htStr(p.ht)} ${p.wt}</td><td class="hide-s small">${esc(DY.persLabel(p)[0])}</td><td class="small">${DY.money(p.nil || 0)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }

  /* ---------- player card ---------- */
  function playerCard(id) {
    const p = DY.P(id); if (!p) return;
    const t = p.t != null ? T(p.t) : (p.t0 != null ? T(p.t0) : null), g = G();
    const [pl, pd] = DY.persLabel(p);
    const keys = Object.keys(DY.W[p.pos]).concat((DY.EXTRA[p.pos] || []).map(x => x[0])).filter((k, i, a) => a.indexOf(k) === i && p.at[k] != null);
    const bar = (l, v) => `<div class="dy-attr"><span>${esc(l)}</span><div class="dy-ab"><i class="${ovrCls(v)}" style="width:${v}%"></i></div><b>${v}</b></div>`;
    const car = Object.entries(p.car || {}).sort((a, b) => a[0] - b[0]);
    const cols = statCols(p.pos);
    const seasonRows = car.map(([y, s]) => `<tr><td>${y}</td><td>${esc(s.t || '')}</td><td>${s.gp || 0}</td>${cols.map(c => `<td>${c[1](s)}</td>`).join('')}</tr>`).join('') + (p.s ? `<tr class="cur"><td>${g.season}</td><td>${t ? esc(t.abbr) : ''}</td><td>${p.s.gp || 0}</td>${cols.map(c => `<td>${c[1](p.s)}</td>`).join('')}</tr>` : '');
    const realCar = p.realCar ? Object.entries(p.realCar).filter(([y]) => +y < g.startSeason).map(([y, s]) => `${y}: ${s.pass ? s.pass[2] + ' pass yds' : ''}${s.rush ? ' ' + s.rush[1] + ' rush yds' : ''}${s.rec ? ' ' + s.rec[1] + ' rec yds' : ''}${s.def ? ' ' + s.def[0] + ' tkl' : ''}`).join(' · ') : '';
    const gl = (p.gl || []).filter(x => x.y === g.season).slice(-14);
    modal(`<div class="dy-pc" style="--tc:${t ? t.c1 : '#888'}">
      <div class="dy-pc-head"><div class="dy-pc-num">${p.num}</div><div><h3>${esc(p.n)}</h3><div class="dim">${esc(DY.POS_NAME[p.pos])} · ${yrLabel(p)} · ${DY.htStr(p.ht)}, ${p.wt} lbs · ${esc(p.home)}${p.hs ? ' · ' + esc(p.hs) : ''}</div><div class="small">${t ? esc(t.name) : 'Left the program'}${p.prev ? ' · previously ' + esc(p.prev) : ''}${p.draft ? ` · Drafted ${p.draft.y}, round ${p.draft.rd} (No. ${p.draft.pk})` : ''}</div></div>
        <div class="dy-pc-ovr">${ovrB(p.ovr)}<small>OVR</small><span class="dy-pot big">${p.potG}</span><small>Potential</small></div></div>
      <div class="dy-pc-tags"><span class="chip">${esc(p.arch)}</span><span class="chip" title="${esc(pd)}">${esc(pl)}</span>${p.rec ? `<span class="chip">${'★'.repeat(p.rec.stars || 0)} ${p.rec.c ? p.rec.c.toFixed(4) : ''}${p.rec.nat ? ' · No. ' + p.rec.nat : ''}</span>` : ''}${p.nil ? `<span class="chip">NIL ${DY.money(p.nil)}</span>` : ''}${p.inj && p.inj.wks > 0 ? `<span class="chip dy-l">${esc(p.inj.what)} · ${p.inj.wks} wk</span>` : ''}${p.el ? `<span class="chip">${p.el} season${p.el > 1 ? 's' : ''} of eligibility</span>` : ''}</div>
      <p class="dy-scout"><b>Scouting report:</b> ${esc(DY.scoutReport(p))} <i>${esc(pd)}</i></p>
      ${p.aw && p.aw.length ? `<p class="small"><b>Honors:</b> ${p.aw.map(a => a.y + ' ' + esc(DY.AWARD_NAME[a.a] || a.a)).join(' · ')}</p>` : ''}
      ${p.honReal && p.honReal.length ? `<p class="small dim">Before the dynasty: ${esc(p.honReal.join('; '))}</p>` : ''}
      ${p.draftNote ? `<p class="small dim">Draft outlook (real): ${esc(p.draftNote)}</p>` : ''}
      <div class="dy-pc-cols"><div><div class="glabel">Ratings</div>${keys.map(k => bar(DY.ATTR_NAME[k] || k, p.at[k])).join('')}</div>
      <div><div class="glabel">Personality</div>${Object.keys(DY.TRAITS).map(k => bar(DY.TRAITS[k], p.tr[k])).join('')}</div></div>
      ${seasonRows ? `<div class="glabel">Stats</div><div class="dy-scroll"><table class="dyt"><thead><tr><th>Year</th><th>Team</th><th>GP</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${seasonRows}</tbody></table></div>` : ''}
      ${realCar ? `<p class="small dim">Real stats before 2026: ${esc(realCar)}</p>` : ''}
      ${gl.length ? `<div class="glabel">${g.season} game log</div><div class="dy-scroll"><table class="dyt"><thead><tr><th>Wk</th><th>Opp</th><th>Result</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${gl.map(x => `<tr><td>${x.w}</td><td>${x.h ? 'vs' : 'at'} ${esc(x.o)}</td><td>${x.r} ${x.sc}</td>${cols.map(c => `<td>${c[1](x.l)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      ${p.log && p.log.length ? `<div class="glabel">Development</div><ul class="dy-mini">${p.log.slice(0, 10).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    </div>`);
  }
  function statCols(pos) {
    const v = (s, k) => s[k] || 0;
    if (pos === 'QB') return [['Cmp/Att', s => v(s, 'pc') + '/' + v(s, 'pa')], ['Yds', s => v(s, 'py')], ['TD', s => v(s, 'ptd')], ['INT', s => v(s, 'pi')], ['Rush', s => v(s, 'ry')], ['RTD', s => v(s, 'rtd')]];
    if (pos === 'RB') return [['Car', s => v(s, 'ra')], ['Yds', s => v(s, 'ry')], ['Avg', s => s.ra ? (s.ry / s.ra).toFixed(1) : '-'], ['TD', s => v(s, 'rtd')], ['Rec', s => v(s, 'rc')], ['RecYds', s => v(s, 'rcy')]];
    if (pos === 'WR' || pos === 'TE') return [['Rec', s => v(s, 'rc')], ['Yds', s => v(s, 'rcy')], ['Avg', s => s.rc ? (s.rcy / s.rc).toFixed(1) : '-'], ['TD', s => v(s, 'rctd')], ['Lg', s => v(s, 'rclg')]];
    if (pos === 'K') return [['FG', s => v(s, 'fgm') + '/' + v(s, 'fga')], ['Lg', s => v(s, 'fglg')], ['XP', s => v(s, 'xpm') + '/' + v(s, 'xpa')]];
    if (pos === 'P') return [['Punts', s => v(s, 'pn')], ['Avg', s => s.pn ? (s.pny / s.pn).toFixed(1) : '-'], ['In 20', s => v(s, 'i20')]];
    if (pos === 'OT' || pos === 'IOL') return [['Pen', s => v(s, 'pen')]];
    return [['Tkl', s => v(s, 'tk')], ['TFL', s => v(s, 'tfl')], ['Sck', s => v(s, 'sck')], ['INT', s => v(s, 'int')], ['PD', s => v(s, 'pd')], ['FF', s => v(s, 'ff')]];
  }

  /* ---------- depth chart ---------- */
  function depth(b) {
    const ut = DY.userT();
    const NAMES = { QB: 'Quarterback', RB: 'Running back', WR: 'Wide receivers', TE: 'Tight end', OT: 'Tackles (LT, RT)', IOL: 'Interior line (LG, C, RG)', EDGE: 'Edge', DT: 'Defensive tackle', LB: 'Linebackers', CB: 'Cornerbacks (3rd plays nickel)', S: 'Safeties', K: 'Kicker', P: 'Punter' };
    b.innerHTML = `<div class="box"><div class="glabel">Depth chart ${ut.depthEdited ? '<span class="chip">Custom</span>' : '<span class="chip">By overall</span>'} <button class="glink" data-act="autodepth">Reset by overall</button></div><p class="dim small">Starters are highlighted. Injured players are skipped on game day. Backups rotate in on the line, at running back and in garbage time; true freshmen who play four games or fewer keep their redshirt.</p>
      <div class="dy-depth">${Object.keys(DY.STARTERS).map(pos => `<div class="dy-dg"><h4>${NAMES[pos]}</h4><ol>${(ut.depth[pos] || []).map(DY.P).filter(Boolean).map((p, i, arr) => `<li class="${i < DY.STARTERS[pos] + (pos === 'CB' ? 1 : 0) ? 'st' : ''} ${p.inj && p.inj.wks > 0 ? 'inj' : ''}"><span class="dy-dn">${i + 1}</span>${plink(p)} <small>${yrLabel(p)}</small>${ovrB(p.ovr)}<span class="dy-dmv"><button data-dmove="${pos}|${p.id}|-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button data-dmove="${pos}|${p.id}|1" ${i === arr.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button></span></li>`).join('')}</ol></div>`).join('')}</div></div>`;
  }

  /* ---------- recruiting ---------- */
  function recruit(b) {
    const g = G(), R = g.recruit, ut = DY.userT();
    if (!R) { b.innerHTML = '<div class="box">No recruiting class yet.</div>'; return; }
    if (g.settings.recruiting === 'off') { b.innerHTML = `<div class="box"><div class="glabel">Recruiting is off</div><p>Tennessee signs a class automatically on signing day. Turn it on in Settings.</p><button class="btn" data-set="recruiting|manual">Turn recruiting on</button></div>`; return; }
    const used = DY.hoursUsed(), hrs = DY.HOURS(), board = R.board.map(DY.RP).filter(Boolean);
    const homeGames = DY.userGames().filter(x => x.h === g.user && !x.res && x.wk >= g.week);
    const ranked = (p) => Object.entries(p.interest).sort((a, b) => b[1] - a[1]);
    const leaders = p => { const r = ranked(p); const top = r[0] ? r[0][1] : 1; return r.slice(0, 4).map(([tid, v]) => `<div class="dy-int ${+tid === g.user ? 'me' : ''}"><span>${esc(T(+tid).abbr)}</span><i style="width:${Math.max(3, v / Math.max(top, 160) * 100)}%;background:${T(+tid).c1}"></i></div>`).join(''); };
    const status = p => p.commit === g.user ? '<b class="dy-w">Committed</b>' : p.commit != null ? `Committed: ${esc(T(p.commit).name)}` : (ranked(p)[0] && +ranked(p)[0][0] === g.user ? 'Leaning Tennessee' : ranked(p)[0] ? 'Leader: ' + esc(T(+ranked(p)[0][0]).abbr) : 'Open');
    const auto = g.settings.recruiting === 'auto';
    const closed = R.signed || g.phase === 'offseason';
    const actBtns = p => closed || p.commit === g.user && p.firm ? '' : Object.entries(DY.ACTIONS).map(([k, a]) => `<button class="dy-ra ${p.acts[k] ? 'on' : ''}" data-ract="${p.id}|${k}" ${k === 'scout' && p.scout >= 3 ? 'disabled' : ''} title="${esc(a.name)}: ${a.hrs} hours">${esc(a.name.replace('Head coach visit', 'HC visit').replace('Social media', 'DM').replace('Phone call', 'Call'))} <small>${a.hrs}h</small></button>`).join('');
    const nilSel = p => `<select data-rnil="${p.id}" aria-label="NIL promise">${[0, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000].map(v => `<option value="${v}" ${p.nilOffer === v ? 'selected' : ''}>${v ? 'NIL ' + DY.money(v) : 'No NIL promise'}</option>`).join('')}</select>`;
    const visSel = p => p.visit ? `<small>Visit: wk ${p.visit}${p.visited ? ' ✓' : ''}</small>` : homeGames.length && !closed ? `<select data-rvisit="${p.id}" aria-label="Official visit"><option value="">Official visit…</option>${homeGames.map(x => `<option value="${x.wk}">Wk ${x.wk} vs ${esc(T(DY.oppOf(x)).abbr)}</option>`).join('')}</select>` : '';
    const row = p => `<tr class="${p.commit === g.user ? 'me' : ''}"><td><span class="dy-stars">${stars(p.rec.stars)}</span><br><a href="#" data-rid="${p.id}"><b>${esc(p.n)}</b></a> <small>${p.pos}</small>${p.real ? ' <small class="chip">Real</small>' : ''}<br><small class="dim">No. ${p.rec.nat} · ${esc(p.home)}</small></td>
      <td class="dy-intc">${leaders(p)}<small>${status(p)}</small></td>
      <td>${p.offer ? '<small class="dy-w">Offered</small>' : closed ? '' : `<button class="dy-ra" data-roffer="${p.id}">Offer</button>`}${closed ? '' : nilSel(p) + visSel(p)}</td>
      <td class="dy-acts">${actBtns(p)}${p.commit === g.user && p.real ? '' : `<button class="glink" data-rrm="${p.id}">Remove</button>`}</td></tr>`;
    // search
    const F = V.rfind;
    let pool = Object.values(R.pool).filter(p => !R.board.includes(p.id));
    if (F.pos !== 'ALL') pool = pool.filter(p => p.pos === F.pos);
    if (F.stars) pool = pool.filter(p => p.rec.stars === F.stars);
    if (F.st && F.st !== 'ALL') pool = pool.filter(p => p.st === F.st);
    if (F.mine) pool = pool.filter(p => p.interest[g.user] != null);
    if (F.q) pool = pool.filter(p => p.n.toLowerCase().includes(F.q.toLowerCase()));
    pool.sort((a, b) => b.rec.c - a.rec.c);
    const states = [...new Set(Object.values(R.pool).map(p => p.st))].sort();
    const commits = DY.myCommits().sort((a, b) => b.rec.c - a.rec.c);
    b.innerHTML = `<div class="dy-grid"><div class="dy-col wide">
      <div class="box"><div class="glabel">Class of ${R.year} · No. ${R.classRank || '—'} nationally · ${commits.length} commits${auto ? ' · <span class="chip">Auto</span>' : ''}</div>
        ${closed ? '<p>Signing day has passed for this class.</p>' : `<div class="dy-hours"><div><b>${hrs - used}</b> of ${hrs} hours left this week</div><div class="dy-ab"><i style="width:${used / hrs * 100}%"></i></div><small class="dim">Actions happen when the week is played. Head coach visits: 4 a week. Official visits are for home games; a win (especially a big one) sells.</small></div>`}
        <p class="small dim">What each player cares about shows on his card, with Tennessee's grade on each. Composite and stars are 247-style; scouting reveals the real talent (and gems and busts).</p></div>
      <div class="box"><div class="glabel">Recruiting board (${board.length}/${DY.BOARD_MAX})</div><div class="dy-scroll"><table class="dyt dy-board"><thead><tr><th>Prospect</th><th>Interest</th><th>Offer</th><th>This week</th></tr></thead><tbody>${board.sort((a, b) => (b.commit === g.user) - (a.commit === g.user) || b.rec.c - a.rec.c).map(row).join('') || '<tr><td colspan="4" class="dim">Add prospects from the list below.</td></tr>'}</tbody></table></div></div>
      <div class="box"><div class="glabel">Find prospects</div>
        <div class="dy-filt"><input id="dyRfq" class="dy-in" placeholder="Name" value="${esc(F.q)}"><select data-rfsel="pos">${['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'IOL', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P'].map(x => `<option ${F.pos === x ? 'selected' : ''}>${x}</option>`).join('')}</select><select data-rfsel="st"><option value="ALL">All states</option>${states.map(s => `<option ${F.st === s ? 'selected' : ''}>${s}</option>`).join('')}</select>${[0, 5, 4, 3].map(s => `<button data-rfind="stars|${s}" aria-pressed="${F.stars === s}">${s ? s + '★' : 'All'}</button>`).join('')}<button data-rfind="mine|1" aria-pressed="${F.mine}">Interested in UT</button></div>
        <div class="dy-scroll"><table class="dyt"><thead><tr><th>Rk</th><th>Prospect</th><th>Pos</th><th class="hide-s">Home</th><th>Comp.</th><th>Status</th><th></th></tr></thead><tbody>${pool.slice(0, 60).map(p => `<tr><td>${p.rec.nat}</td><td><span class="dy-stars">${stars(p.rec.stars)}</span> <a href="#" data-rid="${p.id}">${esc(p.n)}</a></td><td>${p.pos}</td><td class="hide-s small">${esc(p.home)}</td><td class="small">${p.rec.c.toFixed(4)}</td><td class="small">${p.commit != null ? esc(T(p.commit).abbr) : (p.interest[g.user] != null ? 'Interested' : '')}</td><td>${closed ? '' : `<button class="dy-ra" data-radd="${p.id}" ${p.commit != null && p.commit !== g.user && p.firm ? 'disabled' : ''}>Add</button>`}</td></tr>`).join('')}</tbody></table></div></div>
      </div><div class="dy-col">
      <div class="box"><div class="glabel">Commits</div><ul class="dy-mini">${commits.map(p => `<li><span class="dy-stars">${stars(p.rec.stars)}</span> <a href="#" data-rid="${p.id}">${esc(p.n)}</a> <small>${p.pos} · ${esc(p.home)}${p.real ? ' · real commit' : ''}</small></li>`).join('') || '<li class="dim">None yet</li>'}</ul></div>
      <div class="box"><div class="glabel">Top classes</div><ol class="dy-poll">${(R.ranks || []).slice(0, 15).map((t, i) => `<li class="${t === g.user ? 'me' : ''}"><span>${i + 1}</span>${tlink(t, false)}<small>${(R.commits[t] || []).length}</small></li>`).join('')}</ol></div>
      <div class="box"><div class="glabel">Recruiting log</div><ul class="dy-mini">${(R.log || []).slice(0, 20).map(l => `<li>${esc(l)}</li>`).join('') || '<li class="dim">Nothing yet</li>'}</ul></div>
      </div></div>`;
  }
  function prospectCard(id) {
    const g = G(), p = DY.RP(id) || DY.P(id); if (!p) return;
    if (!p.pros) return playerCard(id);
    const ut = DY.userT(), f = DY.fit(ut, p), lvl = p.scout;
    const ovrTxt = lvl >= 3 ? `${p.ovr}` : lvl === 2 ? `${p.ovr - 2}-${p.ovr + 2}` : lvl === 1 ? `${p.ovr - 5}-${p.ovr + 5}` : '??';
    const pot = lvl >= 2 ? p.potG : '?';
    const tag = lvl >= 3 ? (p.gem ? '<span class="chip dy-w">GEM</span>' : p.bust ? '<span class="chip dy-l">BUST risk</span>' : '<span class="chip">As advertised</span>') : '';
    const ints = Object.entries(p.interest).sort((a, b) => b[1] - a[1]), top = ints[0] ? ints[0][1] : 1;
    modal(`<div class="dy-pc"><div class="dy-pc-head"><div class="dy-pc-num">${p.pos}</div><div><h3>${esc(p.n)}</h3><div class="dim">${DY.htStr(p.ht)}, ${p.wt} lbs · ${esc(p.home)} · ${esc(p.hs)}</div>
      <div><span class="dy-stars">${stars(p.rec.stars)}</span> ${p.rec.c.toFixed(4)} composite · No. ${p.rec.nat} nationally · No. ${p.rec.posRank} ${p.pos} · No. ${p.rec.stRank} in ${p.st}</div></div>
      <div class="dy-pc-ovr"><span class="dy-ovr m">${ovrTxt}</span><small>OVR now</small><span class="dy-pot big">${pot}</span><small>Potential</small></div></div>
      <div class="dy-pc-tags">${tag}<span class="chip">${esc(p.arch)}</span><span class="chip">Scouted ${lvl}/3</span>${p.commit != null ? `<span class="chip">Committed: ${esc(T(p.commit).name)}</span>` : ''}</div>
      ${lvl >= 1 ? `<p class="dy-scout"><b>Scouting report:</b> ${esc(DY.scoutReport(p))}</p>` : '<p class="dim">Scout him to see a report and his real ratings.</p>'}
      <div class="dy-pc-cols"><div><div class="glabel">What he wants</div>${p.pref.top.map((k, i) => `<div class="dy-pref"><b>${i + 1}. ${esc(DY.PREFS[k])}</b> <span>Tennessee: ${DY.grade(f[k])}</span></div>`).join('')}${p.pref.deal ? `<p class="small"><b>Dealbreaker:</b> ${esc(DY.PREFS[p.pref.deal])}</p>` : ''}<p class="small">Overall fit: <b>${DY.grade(DY.fitScore(ut, p))}</b></p></div>
      <div><div class="glabel">Schools in the mix</div>${ints.slice(0, 8).map(([tid, v]) => `<div class="dy-int ${+tid === g.user ? 'me' : ''}"><span>${esc(T(+tid).name)}</span><i style="width:${Math.max(3, v / Math.max(top, 160) * 100)}%;background:${T(+tid).c1}"></i></div>`).join('')}</div></div>
      ${lvl >= 2 ? `<div class="glabel">Ratings</div>${Object.keys(DY.W[p.pos]).map(k => `<div class="dy-attr"><span>${esc(DY.ATTR_NAME[k])}</span><div class="dy-ab"><i class="${ovrCls(p.at[k])}" style="width:${p.at[k]}%"></i></div><b>${p.at[k]}</b></div>`).join('')}` : ''}
    </div>`);
  }

  /* ---------- rankings, standings, stats ---------- */
  function polls(b) {
    const g = G();
    const list = (rows, title, cfp) => `<div class="box"><div class="glabel">${title}</div><table class="dyt"><thead><tr><th>#</th><th>Team</th><th>Rec</th>${cfp ? '' : '<th class="hide-s">Pts</th>'}<th>Prev</th></tr></thead><tbody>${rows.map((x, i) => `<tr class="${x.t === g.user ? 'me' : ''}"><td>${i + 1}</td><td>${tlink(x.t, false)}${!cfp && x.fp ? ` <small class="dim">(${x.fp})</small>` : ''}</td><td>${T(x.t).w}-${T(x.t).l}</td>${cfp ? '' : `<td class="hide-s">${x.pts}</td>`}<td>${x.prev ? (x.prev > i + 1 ? `<span class="dy-w">▲${x.prev - i - 1}</span>` : x.prev < i + 1 ? `<span class="dy-l">▼${i + 1 - x.prev}</span>` : '—') : '<small>NR</small>'}</td></tr>`).join('')}</tbody></table></div>`;
    const others = g.teams.filter(t => !t.ap).sort((a, b) => DY.apKey(b) - DY.apKey(a)).slice(0, 8);
    b.innerHTML = `<div class="dy-grid"><div class="dy-col">${list(g.polls.ap, 'AP Top 25')}<p class="small dim">Others receiving votes: ${others.map(t => esc(t.name) + ' ' + t.w + '-' + t.l).join(', ')}</p></div><div class="dy-col">${g.polls.cfp ? list(g.polls.cfp, `College Football Playoff rankings${g.polls.cfpWeek === 14 ? ' · final' : ' · after week ' + g.polls.cfpWeek}`, true) : `<div class="box"><div class="glabel">College Football Playoff rankings</div><p class="dim">The committee's first rankings come out the first Tuesday of November (after week ${DY.CFP_WEEKS[0]}).</p></div>`}</div></div>`;
  }
  function standings(b) {
    const confs = Object.keys(DY.CONF_GAMES);
    const st = DY.standings(V.conf);
    b.innerHTML = `<div class="box"><div class="gchips dy-chips">${confs.map(c => `<button data-conf="${c}" aria-pressed="${V.conf === c}">${esc(DY.CONF_NAME[c])}</button>`).join('')}</div>
      <table class="dyt"><thead><tr><th>#</th><th>Team</th><th>Conf</th><th>Overall</th><th class="hide-s">PF</th><th class="hide-s">PA</th></tr></thead><tbody>${st.map((t, i) => `<tr class="${t.user ? 'me' : ''}"><td>${i + 1}</td><td>${tlink(t.id)}${t.champ === G().season ? ' <small class="chip">Champ</small>' : ''}</td><td>${t.cw}-${t.cl}</td><td>${t.w}-${t.l}</td><td class="hide-s">${t.pf}</td><td class="hide-s">${t.pa}</td></tr>`).join('')}</tbody></table>
      <p class="small dim">Tiebreakers: conference record, head-to-head, overall record, then the committee's rankings. Top two meet in the title game.</p></div>`;
  }
  const STATK = [['py', 'Passing yards'], ['ptd', 'Passing TDs'], ['ry', 'Rushing yards'], ['rtd', 'Rushing TDs'], ['rcy', 'Receiving yards'], ['rc', 'Receptions'], ['rctd', 'Receiving TDs'], ['tk', 'Tackles'], ['sck', 'Sacks'], ['tfl', 'Tackles for loss'], ['int', 'Interceptions'], ['fgm', 'Field goals']];
  function stats(b) {
    const g = G(), ut = DY.userT();
    const all = [];
    g.teams.forEach(t => t.roster.forEach(id => { const p = DY.P(id); if (p.s && p.s[V.statk]) all.push(p); }));
    all.sort((a, b) => b.s[V.statk] - a.s[V.statk]);
    const heis = [];
    g.teams.forEach(t => t.roster.forEach(id => { const p = DY.P(id); const sc = DY.awardScore(p, t); if (sc > 0 && ['QB', 'RB', 'WR'].includes(p.pos)) heis.push({ p, h: sc * ({ QB: 1, RB: 0.92, WR: 0.82 }[p.pos]) + (t.ap && t.ap <= 4 ? 18 : t.ap && t.ap <= 12 ? 9 : 0) + (t.w - 8) * 5 }); }));
    heis.sort((a, b) => b.h - a.h);
    const mine = ut.roster.map(DY.P).filter(p => p.s);
    const tl = (k, l) => { const p = mine.filter(x => x.s[k]).sort((a, b) => b.s[k] - a.s[k]).slice(0, 3); return p.length ? `<tr><td>${l}</td><td>${p.map(x => plink(x) + ' ' + x.s[k]).join(', ')}</td></tr>` : ''; };
    b.innerHTML = `<div class="dy-grid"><div class="dy-col wide"><div class="box"><div class="glabel">National leaders</div><div class="gchips dy-chips">${STATK.map(([k, l]) => `<button data-statk="${k}" aria-pressed="${V.statk === k}">${l}</button>`).join('')}</div>
      <table class="dyt"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>${esc((STATK.find(x => x[0] === V.statk) || [])[1])}</th><th>GP</th></tr></thead><tbody>${all.slice(0, 25).map((p, i) => `<tr class="${p.t === g.user ? 'me' : ''}"><td>${i + 1}</td><td>${plink(p)} <small>${p.pos}</small></td><td>${tlink(p.t, false)}</td><td><b>${p.s[V.statk]}</b></td><td>${p.s.gp || 0}</td></tr>`).join('') || '<tr><td colspan="5" class="dim">No games yet.</td></tr>'}</tbody></table></div></div>
      <div class="dy-col"><div class="box"><div class="glabel">Heisman watch</div><ol class="dy-mini">${heis.slice(0, 8).map(x => `<li>${plink(x.p)} <small>${x.p.pos}, ${esc(T(x.p.t).abbr)} · ${x.p.pos === 'QB' ? (x.p.s.py || 0) + ' pass yds, ' + (x.p.s.ptd || 0) + ' TD' : x.p.pos === 'RB' ? (x.p.s.ry || 0) + ' rush yds, ' + (x.p.s.rtd || 0) + ' TD' : (x.p.s.rcy || 0) + ' rec yds, ' + (x.p.s.rctd || 0) + ' TD'}</small></li>`).join('') || '<li class="dim">After a few games.</li>'}</ol></div>
      <div class="box"><div class="glabel">Tennessee leaders</div><table class="dyt dy-tight"><tbody>${tl('py', 'Passing')}${tl('ry', 'Rushing')}${tl('rcy', 'Receiving')}${tl('tk', 'Tackles')}${tl('sck', 'Sacks')}${tl('int', 'INT')}</tbody></table></div></div></div>`;
  }

  /* ---------- NIL ---------- */
  function nil(b) {
    const ut = DY.userT(), pay = DY.payroll(ut), ps = ut.roster.map(DY.P).sort((a, b) => (b.nil || 0) - (a.nil || 0));
    ps.forEach(p => { p.nilV = DY.nilValue(p, ut); });
    b.innerHTML = `<div class="box"><div class="glabel">NIL and revenue sharing</div>
      <div class="dy-hours"><div><b>${DY.money(pay)}</b> committed of a <b>${DY.money(ut.budget)}</b> budget · ${DY.money(Math.max(0, ut.budget - pay))} open</div><div class="dy-ab"><i style="width:${Math.min(100, pay / ut.budget * 100)}%"></i></div></div>
      <p class="small dim">Budgets combine the House settlement revenue-sharing cap (about $21.6M a school in 2026-27) and collective money; Tennessee's sits in the national top ten. Market values follow On3-style valuations: quarterbacks first, then edge rushers, receivers, tackles and corners. Players ask for raises in the offseason when their value outgrows their deal.</p>
      <div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>Pos</th><th>OVR</th><th>Contract</th><th>Market value</th></tr></thead><tbody>${ps.map(p => `<tr><td>${plink(p)}</td><td>${p.pos}</td><td>${ovrB(p.ovr)}</td><td>${DY.money(p.nil || 0)}</td><td class="${p.nilV > (p.nil || 0) * 1.35 ? 'dy-l' : 'dim'}">${DY.money(p.nilV)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  /* ---------- history ---------- */
  function history(b) {
    const g = G();
    const c = g.coach, titles = g.hist.filter(h => h.finish === 'National champions').length, secT = g.hist.filter(h => h.sec).length, cfp = g.hist.filter(h => h.cfpSeed).length;
    const recRows = scope => Object.entries(DY.REC_MAP).map(([name, k]) => { const r = g.rec[scope][k]; return r ? `<tr class="${r.real ? '' : 'me'}"><td>${esc(name)}</td><td>${r.pid ? plink(DY.P(r.pid), r.n) : esc(r.n)}</td><td><b>${r.v}</b></td><td class="small">${esc(r.y)}${r.note ? ' · ' + esc(r.note) : ''}${r.prev ? ' · broke ' + esc(r.prev) + "'s record" : ''}</td></tr>` : ''; }).join('');
    const leg = DY.legacyBoard(10);
    const natl = {}; g.teams.forEach(t => { if (t.natl) natl[t.name] = t.natl; });
    b.innerHTML = `<div class="dy-grid"><div class="dy-col wide">
      <div class="box"><div class="glabel">Coach ${esc(c.name)}</div><div class="dy-stats4"><div><b>${c.w}-${c.l}</b><small>Record</small></div><div><b>${titles}</b><small>National titles</small></div><div><b>${secT}</b><small>SEC titles</small></div><div><b>${cfp}</b><small>Playoff trips</small></div></div></div>
      <div class="box"><div class="glabel">Season by season</div><table class="dyt"><thead><tr><th>Year</th><th>Record</th><th>SEC</th><th>AP</th><th>Finish</th><th class="hide-s">Champion</th><th class="hide-s">Heisman</th></tr></thead><tbody>${g.hist.slice().reverse().map(h => `<tr><td>${h.y}</td><td>${h.w}-${h.l}</td><td>${h.cw}-${h.cl}${h.sec ? ' 🏆' : ''}</td><td>${h.ap || '—'}</td><td>${esc(h.finish)}</td><td class="hide-s small">${esc(h.champ)}</td><td class="hide-s small">${esc(h.heis || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="dim">Finish a season to start the history book.</td></tr>'}</tbody></table></div>
      <div class="box"><div class="glabel">Tennessee records (real record book + your dynasty)</div><div class="gchips dy-chips">${['game', 'season', 'career'].map(s => `<button data-recs="${s}" aria-pressed="${V.recs === s}">${s === 'game' ? 'Single game' : s === 'season' ? 'Season' : 'Career'}</button>`).join('')}</div><table class="dyt"><tbody>${recRows(V.recs)}</tbody></table><p class="small dim">Highlighted rows were set in this dynasty.</p></div>
      </div><div class="dy-col">
      <div class="box"><div class="glabel">Legacy: the best players you've coached</div><ol class="dy-mini">${leg.map(x => `<li>${plink(x.p)} <small>${x.p.pos} · ${x.v} pts${x.p.aw.some(a => a.a === 'AA1') ? ' · All-American' : ''}${x.p.draft ? ' · Rd ' + x.p.draft.rd + ' pick' : ''}</small></li>`).join('') || '<li class="dim">Built from awards, production, peak rating, wins and the draft.</li>'}</ol></div>
      <div class="box"><div class="glabel">National champions</div><ul class="dy-mini">${g.hist.slice().reverse().map(h => `<li>${h.y}: ${esc(h.champ)}</li>`).join('') || '<li class="dim">—</li>'}</ul></div>
      <div class="box"><div class="glabel">Vols in the NFL Draft</div><ul class="dy-mini">${Object.entries(g.draftHist || {}).reverse().map(([y, l]) => l.filter(x => x[1] === g.user).map(x => `<li>${y}: ${plink(DY.P(x[0]))} <small>Rd ${DY.P(x[0]).draft.rd}, No. ${DY.P(x[0]).draft.pk}</small></li>`).join('')).join('') || '<li class="dim">After the first season.</li>'}</ul></div>
      </div></div>`;
  }

  /* ---------- settings ---------- */
  function settings(b) {
    const g = G(), s = g.settings, m = DY.readMeta();
    const seg = (k, opts) => `<div class="gseg">${opts.map(([v, l]) => `<button data-set="${k}|${v}" aria-pressed="${String(s[k]) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
    b.innerHTML = `<div class="dy-grid"><div class="dy-col"><div class="box"><div class="glabel">Save</div>${[1, 2, 3].map(n => `<div class="dy-slotrow"><b>Slot ${n}</b> <span class="dim small">${m[n] ? esc(m[n].coach) + ' · ' + esc(m[n].label) : 'Empty'}</span> <button class="btn" data-slot="${n}">${g.slot === n ? 'Save here (current)' : 'Save here'}</button></div>`).join('')}
      <div class="grow"><button class="btn" data-act="export">Export save file</button><button class="btn" data-act="quit">Quit to menu</button></div><p class="small dim">Autosave after every week: ${seg('autosave', [[true, 'On'], [false, 'Off']])}</p></div></div>
      <div class="dy-col"><div class="box"><div class="glabel">Options</div>
      <div class="gfield"><div class="glabel">Play calling</div>${seg('coachMode', [['full', 'Offense + defense'], ['offense', 'Offense'], ['watch', 'Watch']])}</div>
      <div class="gfield"><div class="glabel">Game speed</div>${seg('speed', [['slow', 'Slow'], ['fast', 'Fast']])}</div>
      <div class="gfield"><div class="glabel">Recruiting</div>${seg('recruiting', [['manual', 'Manual'], ['auto', 'Auto'], ['off', 'Off']])}</div>
      <div class="gfield"><div class="glabel">Transfer portal</div>${seg('portal', [['manual', 'Manual'], ['auto', 'Auto'], ['off', 'Off']])}</div>
      <div class="gfield"><div class="glabel">NIL raises</div>${seg('nil', [['manual', 'I decide'], ['auto', 'Auto']])}</div>
      <div class="gfield"><div class="glabel">Playoff (applies from next selection day)</div>${seg('cfp', [[12, '12 teams'], [24, '24 teams']])}</div>
      <div class="gfield"><div class="glabel">Difficulty</div>${seg('difficulty', [['freshman', 'Freshman'], ['varsity', 'Varsity'], ['allamerican', 'All-American'], ['heisman', 'Heisman']])}</div>
      <div class="gfield"><div class="glabel">Injuries</div>${seg('injuries', [[true, 'On'], [false, 'Off']])}</div>
      <div class="gfield"><div class="glabel">Screen shake</div>${seg('shake', [[true, 'On'], [false, 'Off']])}</div></div></div></div>`;
  }

  /* ---------- offseason ---------- */
  function offseason(b) {
    const g = G(), o = g.off, ut = DY.userT(), st = o.stage;
    const steps = `<ol class="dy-steps">${DY.OFF_ORDER.map(k => `<li class="${k === st ? 'on' : DY.OFF_ORDER.indexOf(k) < DY.OFF_ORDER.indexOf(st) ? 'done' : ''}">${esc(DY.OFF_LABEL[k])}</li>`).join('')}</ol>`;
    let html = '';
    if (st === 'recap') {
      const h = g.hist[g.hist.length - 1], A = g.awards[g.season] || {};
      const mineAw = ut.roster.concat(o.leaving.map(x => x.id)).map(DY.P).filter((p, i, a) => p && a.indexOf(p) === i && p.aw.some(x => x.y === g.season));
      html = `<div class="box"><div class="glabel">${g.season} in review</div><h2>${h.w}-${h.l} · ${esc(h.finish)}</h2><p>${h.sec ? 'SEC champions. ' : ''}Final AP: ${h.ap ? 'No. ' + h.ap : 'unranked'}. National champion: ${esc(h.champ)}. Heisman: ${A.heis ? plink(DY.P(A.heis.id)) + ' (' + esc(T(A.heis.t).name) + ')' : '—'}.</p></div>
        <div class="box"><div class="glabel">Tennessee honors</div><ul class="dy-mini">${mineAw.map(p => `<li>${plink(p)} <small>${p.aw.filter(x => x.y === g.season).map(x => esc(DY.AWARD_NAME[x.a])).join(', ')}</small></li>`).join('') || '<li class="dim">None this year.</li>'}</ul></div>
        <div class="box"><div class="glabel">All-America first team</div><ul class="dy-mini dy-cols2">${(A.aa1 || []).map(DY.P).map(p => `<li><small>${p.pos}</small> ${plink(p)} <small>${esc(T(p.t).abbr)}</small></li>`).join('')}</ul></div>
        <div class="box"><div class="glabel">Leaving the program</div><ul class="dy-mini">${o.leaving.map(x => { const p = DY.P(x.id); return `<li>${plink(p)} <small>${p.pos} · ${p.ovr} · ${x.why === 'nfl' ? 'declared for the NFL Draft' : 'out of eligibility'}</small></li>`; }).join('') || '<li class="dim">Nobody.</li>'}</ul></div>`;
    } else if (st === 'nil') {
      html = `<div class="box"><div class="glabel">NIL: raises and the new budget</div><p>New budget: <b>${DY.money(ut.budget)}</b> · committed ${DY.money(DY.payroll(ut))}. Players who outplayed their deals want more. Say no and they may test the portal.</p>
        <table class="dyt"><thead><tr><th>Player</th><th>Now</th><th>Asking</th><th></th></tr></thead><tbody>${o.nilAsk.map(a => { const p = DY.P(a.id); return `<tr><td>${plink(p)} <small>${p.pos} · ${p.ovr}</small></td><td>${DY.money(p.nil)}</td><td><b>${DY.money(a.ask)}</b></td><td>${g.settings.nil === 'auto' ? '<small>Auto</small>' : `<button class="dy-ra ${a.ans === true ? 'on' : ''}" data-nilans="${a.id}|1">Pay him</button><button class="dy-ra ${a.ans === false ? 'on' : ''}" data-nilans="${a.id}|0">Decline</button>`}</td></tr>`; }).join('') || '<tr><td colspan="4" class="dim">No requests this year.</td></tr>'}</tbody></table><p class="small dim">Unanswered requests are decided for you when you continue.</p></div>`;
    } else if (st === 'portal') {
      const P = o.portal, mine = DY.portalPlayers().filter(p => p.portal.from === g.user), avail = DY.portalPlayers().filter(p => p.portal.from !== g.user);
      const pf = V.ppos;
      const list = avail.filter(p => pf === 'ALL' || p.pos === pf).sort((a, b) => b.ovr - a.ovr).slice(0, 60);
      html = `<div class="box"><div class="glabel">Transfer portal · round ${P.round} of ${P.rounds}</div><p>Room on the roster: <b>${DY.rosterRoom()}</b> (105-man limit, signees counted) · NIL room: <b>${DY.money(Math.max(0, ut.budget - DY.payroll(ut) - Object.values(P.mine).reduce((s, v) => s + v, 0)))}</b>${g.settings.portal === 'auto' ? ' · <span class="chip">Auto</span>' : ''}</p>
        <div class="grow">${P.round < P.rounds ? '<button class="btn" data-act="portalround">Play out this round</button>' : ''}<span class="small dim">Continue closes the portal: everyone left picks a school.</span></div></div>
        <div class="box"><div class="glabel">Your players in the portal</div><table class="dyt"><tbody>${mine.map(p => `<tr><td>${plink(p)} <small>${p.pos} · ${p.ovr} · ${yrLabel(p)}</small></td><td><small>${esc(p.portal.why)}</small></td><td>${P.retain[p.id] != null ? '<small>Pitch made</small>' : `<select data-retainamt="${p.id}">${[0, 25000, 50000, 100000, 250000, 500000].map(v => `<option value="${v}">${v ? '+' + DY.money(v) : 'No raise'}</option>`).join('')}</select><button class="dy-ra" data-retain="${p.id}">Ask him to stay</button>`}</td></tr>`).join('') || '<tr><td class="dim">Nobody left. Good culture.</td></tr>'}</tbody></table></div>
        <div class="box"><div class="glabel">Available transfers</div><div class="gchips dy-chips">${['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'IOL', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P'].map(x => `<button data-ppos="${x}" aria-pressed="${pf === x}">${x === 'ALL' ? 'All' : x}</button>`).join('')}</div>
        <div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>From</th><th>OVR</th><th>Class</th><th>Value</th><th>Your offer</th></tr></thead><tbody>${list.map(p => `<tr class="${P.mine[p.id] != null ? 'me' : ''}"><td>${plink(p)} <small>${p.pos}</small></td><td>${tlink(p.portal.from, false)}</td><td>${ovrB(p.ovr)} <small class="dy-pot">${p.potG}</small></td><td>${yrLabel(p)} <small>${p.el} left</small></td><td class="small">${DY.money(DY.nilValue(p, ut))}</td><td>${P.mine[p.id] != null ? `<b>${DY.money(P.mine[p.id])}</b> ` : ''}<select data-pofferamt="${p.id}">${[25000, 50000, 100000, 200000, 400000, 750000, 1000000, 1500000, 2500000].map(v => `<option value="${v}" ${Math.abs(v - DY.nilValue(p, ut)) < v * 0.3 ? 'selected' : ''}>${DY.money(v)}</option>`).join('')}</select><button class="dy-ra" data-poffer="${p.id}">Offer</button></td></tr>`).join('')}</tbody></table></div></div>
        <div class="box"><div class="glabel">Portal news</div><ul class="dy-mini">${P.log.slice(0, 15).map(l => `<li>${esc(l)}</li>`).join('') || '<li class="dim">Nothing yet.</li>'}</ul></div>`;
    } else if (st === 'signing') {
      const mine = ut.roster.map(DY.P).filter(p => p.firstY === g.season + 1).sort((a, b) => (b.rec ? b.rec.c : 0) - (a.rec ? a.rec.c : 0));
      html = `<div class="box"><div class="glabel">Signing day · class of ${g.recruit.year}</div><h2>No. ${g.recruit.finalRank || '—'} class · ${mine.length} signees</h2><table class="dyt"><tbody>${mine.map(p => `<tr><td><span class="dy-stars">${stars(p.rec ? p.rec.stars : 0)}</span></td><td>${plink(p)} <small>${p.pos}${p.walkon ? ' · walk-on' : ''}</small></td><td class="small">${esc(p.home)}</td><td>${ovrB(p.ovr)} <small class="dy-pot">${p.potG}</small></td></tr>`).join('')}</tbody></table></div>`;
    } else if (st === 'draft') {
      const D = o.draft, mine = D.picks.filter(x => x.t === g.user);
      html = `<div class="box"><div class="glabel">${D.y} NFL Draft</div><h2>${mine.length} Vol${mine.length === 1 ? '' : 's'} drafted</h2><ul class="dy-mini">${mine.map(x => `<li>Round ${x.rd}, No. ${x.pk}: ${plink(DY.P(x.id))} <small>${DY.P(x.id).pos}</small></li>`).join('') || '<li class="dim">None this year.</li>'}</ul></div>
        <div class="box"><div class="glabel">First round</div><ol class="dy-mini dy-cols2">${D.picks.slice(0, 32).map(x => `<li>${plink(DY.P(x.id))} <small>${DY.P(x.id).pos} · ${esc(T(x.t) ? T(x.t).abbr : '')}</small></li>`).join('')}</ol></div>`;
    } else if (st === 'progress') {
      html = `<div class="box"><div class="glabel">Offseason development</div><p class="dim">Most players follow the usual path. Some boom, some stall, and a big season (or a trophy) speeds things up.</p><div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>Pos</th><th>Change</th><th>Potential</th><th>Notes</th></tr></thead><tbody>${o.prog.map(r => { const p = DY.P(r.id); return `<tr><td>${plink(p)}</td><td>${p.pos}</td><td><b class="${r.delta > 0 ? 'dy-w' : r.delta < 0 ? 'dy-l' : ''}">${r.delta > 0 ? '+' : ''}${r.delta}</b> <small>${r.before} → ${r.after}</small></td><td><span class="dy-pot">${p.potG}</span>${r.ceil > r.ceil0 + 1 ? ' <small class="dy-w">▲</small>' : r.ceil < r.ceil0 - 1 ? ' <small class="dy-l">▼</small>' : ''}</td><td class="small">${esc(r.notes.join('; '))}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    } else if (st === 'schedule') {
      const arr = g.nonconfPick[g.season + 1], y = g.season + 1;
      const groups = [['Power 4 & Notre Dame', g.teams.filter(t => (DY.P4.includes(t.conf) && t.conf !== 'SEC') || t.abbr === 'ND')], ['Group of Six', g.teams.filter(t => !DY.P4.includes(t.conf) && t.abbr !== 'ND')], ['FCS', DY.FCS]];
      const cyc = DY.UT_SEC[2026 + ((y - 2026) % 4 + 4) % 4];
      html = `<div class="box"><div class="glabel">${y} non-conference schedule</div><p>Three non-conference games in weeks 0-5. Your SEC slate is set: home ${cyc.H.join(', ')}; away ${cyc.A.join(', ')}. Alabama is the third Saturday in October; Vanderbilt closes the regular season.</p>
        ${arr.map((x, i) => `<div class="dy-nc"><b>Game ${i + 1}</b><select data-nc="${i}|o">${groups.map(([l, ts]) => `<optgroup label="${l}">${ts.map(t => `<option value="${t.id}" ${t.id === x.o ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join('')}</select><select data-nc="${i}|home"><option value="1" ${x.home ? 'selected' : ''}>Home</option><option value="0" ${!x.home ? 'selected' : ''}>Away</option></select><select data-nc="${i}|wk">${[0, 1, 2, 3, 4, 5].map(w => `<option value="${w}" ${w === x.wk ? 'selected' : ''}>Week ${w}</option>`).join('')}</select></div>`).join('')}
        <div class="grow"><button class="btn" data-act="ncauto">Auto-generate</button></div>${new Set(arr.map(x => x.wk)).size < 3 ? '<p class="dy-l small">Two games are in the same week; pick different weeks.</p>' : ''}</div>`;
    }
    b.innerHTML = `${steps}${html}<div class="grow"><button class="btn primary big" data-act="main">${esc(primaryAction().label)}</button></div>`;
  }
})(typeof window !== 'undefined' ? window : globalThis);
