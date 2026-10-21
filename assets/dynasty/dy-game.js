/* The Vol Index — Vol Dynasty: the live game screen.
   Scouting report and game plan, then every snap on a canvas field: real formations and personnel, players moving at
   football speed (routes, blocks, pursuit, tackles), kicks with coverage and return walls, results called on the field
   as they happen. Play calling (formation + named play), timeouts and tempo, halftime adjustments, sim controls, and a
   Madden-style drive chart (the whole view when you watch on fast). */
(function (root) {
  'use strict';
  const DY = root.DY;
  const DYG = root.DYG = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduce = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let S = null;

  /* ---------- colors ---------- */
  const lum = hex => { const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const ink = hex => lum(hex) > 0.6 ? '#141414' : '#FFFFFF';
  function teamPaint(GM, s) {
    const t = GM.T[s];
    if (s === 'h') return { fill: t.c1, stroke: t.c2 === '#FFFFFF' && lum(t.c1) > 0.7 ? '#141414' : t.c2, num: ink(t.c1) };
    const clash = Math.abs(lum(t.c1) - lum(GM.T.h.c1)) < 0.18;
    return clash ? { fill: '#FFFFFF', stroke: t.c1, num: t.c1 === '#FFFFFF' ? '#141414' : t.c1 } : { fill: t.c1, stroke: '#FFFFFF', num: ink(t.c1) };
  }

  /* ---------- open / close ---------- */
  DYG.open = (el, x, opts) => {
    opts = opts || {};
    const g = DY.G;
    let GM = opts.GM || null;
    if (!GM && g.live && g.live.id === x.id) { try { GM = DY.unpackLive(g.live); } catch (e) { GM = null; } }
    if (!GM) GM = DY.startGame(x, true);
    S = { GM, x, el, speed: g.settings.speed || 'slow', paused: false, timer: null, raf: null, by: 26.67, cam: null, camY: 26.67, script: null, onDone: opts.onDone, tab: 'pbp', pendTO: false, tempo: null, lastRes: null, form: 'auto', sel: {} };
    el.innerHTML = shell();
    S.cv = el.querySelector('canvas'); S.ctx = S.cv.getContext('2d');
    bind();
    sizeCanvas(); drawStatic();
    S.ro = root.ResizeObserver ? new root.ResizeObserver(() => { if (!S) return; sizeCanvas(); if (!S.script) drawStatic(); }) : null;
    if (S.ro) S.ro.observe(el.querySelector('.dyg-fieldwrap'));
    renderBoard(); renderTab(); barsMode();
    if (GM.plays.length === 0) showCaption({ tag: GM.rival ? GM.rival.toUpperCase() : 'KICKOFF', text: intro(GM) });
    setTimeout(loop, 400);
  };
  DYG.close = () => { if (!S) return; clearTimeout(S.timer); cancelAnimationFrame(S.raf); if (S.ro) S.ro.disconnect(); S = null; };
  DYG.live = () => S && S.GM;
  function intro(GM) {
    const r = GM.ranks, a = GM.T.a, h = GM.T.h;
    const nm = (t, rk) => (rk ? `No. ${rk} ` : '') + t.name;
    return `${nm(a, r.a)} at ${nm(h, r.h)}${GM.neutral ? ' (neutral site)' : ''}${GM.title ? ' · ' + GM.title : ''}. ${GM.T[GM.tossWinner].name} won the toss and deferred.${GM.crowd > 0.8 && h.name === 'Tennessee' ? ' 101,915 in Neyland Stadium.' : ''}`;
  }
  function shell() {
    return `<div class="dyg">
      <div class="dyg-board" id="dygBoard"></div>
      <div class="dyg-wp" title="Win probability"><span id="dygWp"></span></div>
      <div class="dyg-fieldwrap"><canvas aria-label="Field"></canvas><div class="dyg-banner" id="dygBanner"></div><div class="dyg-noise" id="dygNoise"></div><div class="dyg-pop" id="dygPop"></div></div>
      <div class="dyg-bars" id="dygBars" hidden></div>
      <div class="dyg-cap" id="dygCap" aria-live="polite"></div>
      <div class="dyg-ctrl" id="dygCtrl"></div>
      <div class="dyg-simbar" id="dygSim"></div>
      <div class="dyg-tabs" role="tablist"><button data-tab="pbp" aria-selected="true">Play-by-play</button><button data-tab="chart">Drive chart</button><button data-tab="box">Box score</button></div>
      <div class="dyg-panel" id="dygPanel"></div>
    </div>`;
  }
  // watching on fast: drive bars instead of the field
  const isBars = () => S && S.GM.coach === 'watch' && S.speed === 'fast';
  function barsMode() {
    if (!S) return;
    const on = isBars();
    S.el.querySelector('.dyg-fieldwrap').hidden = on;
    const b = S.el.querySelector('#dygBars'); b.hidden = !on;
    if (on) b.innerHTML = driveChart(S.GM, 6);
  }

  /* ---------- the loop ---------- */
  function loop() {
    if (!S) return;
    if (!document.body.contains(S.el)) return DYG.close();
    const GM = S.GM;
    clearTimeout(S.timer);
    if (GM.over) return finish();
    const need = DY.needs(GM);
    renderPanel(need);
    if (need) { if (!S.script && !isBars()) drawStatic(); return; }
    if (S.paused) return;
    S.timer = setTimeout(() => doStep({}), isBars() ? 160 : S.speed === 'fast' ? 300 : 900);
  }
  function doStep(uc) {
    if (!S || S.busy) return;
    const GM = S.GM, pre = { poss: GM.poss, ball: GM.ball, down: GM.down, togo: GM.togo, next: GM.next, by: S.by, q: GM.q, kicker: GM.kicker };
    if (S.pendTO) { uc.timeout = true; S.pendTO = false; }
    const r = DY.step(GM, uc);
    if (!r) return loop();
    S.lastRes = r;
    const done = () => {
      if (!S) return;
      S.busy = false;
      showCaption(r); renderBoard(); renderTab(); if (isBars()) S.el.querySelector('#dygBars').innerHTML = driveChart(GM, 6);
      if (r.final || GM.over) return finish();
      if (S.pendSim) { const k = S.pendSim; S.pendSim = null; const s0 = SIMS[k]; return simUntil(s0[0], s0[1]); }
      loop();
    };
    if (isBars()) { S.busy = true; return setTimeout(done, 20); }
    S.busy = true;
    renderPanel('busy');
    const script = buildScript(GM, r, pre);
    const bigThird = pre.next === 'scrim' && pre.down === 3 && GM.big && GM.crowd > 0.7 && pre.poss === 'a' && DY.G.settings.shake !== false && !reduce();
    if (bigThird) shake();
    animate(script, done);
  }
  function shake() {
    const w = S.el.querySelector('.dyg-fieldwrap'); w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake');
    const n = S.el.querySelector('#dygNoise'); n.textContent = S.GM.T.h.name === 'Tennessee' ? 'Neyland is ROCKING' : 'The crowd is on its feet'; n.classList.add('on'); setTimeout(() => n && n.classList.remove('on'), 1800);
  }
  function simUntil(cond, label) {
    const GM = S.GM; clearTimeout(S.timer);
    const coach = GM.coach; GM.coach = 'watch';
    let n = 0, r = null;
    const start = { poss: GM.poss, q: GM.q, drives: GM.drives.length };
    while (!GM.over && n++ < 700) { r = DY.step(GM, {}); if (r) S.lastRes = r; if (cond(GM, r, start)) break; }
    GM.coach = coach;
    if (r) { S.by = 26.67; showCaption(Object.assign({}, r, { tag: r.tag || label })); }
    renderBoard(); renderTab(); barsMode(); if (!isBars()) drawStatic();
    if (GM.over) return finish();
    loop();
  }
  const SIMS = {
    drive: [(GM, r, st) => GM.drives.length > st.drives || GM.poss !== st.poss || GM.next === 'kick' || GM.next === 'pat' || GM.over, 'END OF DRIVE'],
    quarter: [(GM, r, st) => GM.q !== st.q || GM.over, 'END OF QUARTER'],
    half: [(GM, r, st) => (st.q <= 2 ? GM.q >= 3 : GM.over) || GM.over, 'HALF'],
    big: [(GM) => (DY.bigMoment(GM) && GM.next === 'scrim') || GM.over, 'BIG MOMENT'],
    end: [(GM) => GM.over, 'FINAL'],
  };
  function finish() {
    if (!S) return;
    const GM = S.GM; clearTimeout(S.timer);
    const g = DY.G, x = S.x;
    if (!x.res) { DY.bankGame(x, GM); g.live = null; }
    renderBoard();
    const us = GM.user, them = us === 'h' ? 'a' : 'h', won = GM.score[us] > GM.score[them];
    showCaption({ tag: 'FINAL', text: `${GM.T.a.name} ${GM.score.a}, ${GM.T.h.name} ${GM.score.h}${GM.q >= 5 ? ' (' + (GM.q - 4 > 1 ? GM.q - 4 : '') + 'OT)' : ''}.` });
    const top = DY.topPerf(GM).find(t => t.s === us);
    S.el.querySelector('#dygCtrl').innerHTML = `<div class="dyg-final ${won ? 'w' : 'l'}"><div class="dyg-final-h"><b>${won ? 'WIN' : 'LOSS'}</b> <span>${esc(GM.T[us].name)} ${GM.score[us]}, ${esc(GM.T[them].name)} ${GM.score[them]}</span></div>
      ${top ? `<div class="dyg-top">${['qb', 'rb', 'wr', 'df'].filter(k => top[k]).map(k => `<span><b>${esc(DY.P(top[k][0]).n)}</b> ${esc(top[k][1])}</span>`).join('')}</div>` : ''}
      <div class="grow"><button class="btn primary big" id="dygDone">Continue</button></div></div>`;
    S.el.querySelector('#dygSim').innerHTML = '';
    S.el.querySelector('#dygDone').onclick = () => { const cb = S.onDone; DYG.close(); if (cb) cb(GM); };
    S.tab = 'box'; renderTab();
    S.el.querySelectorAll('.dyg-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === 'box'));
  }

  /* ---------- scoreboard, caption, on-field calls ---------- */
  function renderBoard() {
    const GM = S.GM, el = S.el.querySelector('#dygBoard');
    const side = s => {
      const t = GM.T[s], rk = GM.ranks[s], poss = GM.poss === s && !GM.over && GM.next !== 'kick';
      return `<div class="dyg-team ${s}" style="--tc:${t.c1};--ti:${ink(t.c1)}">
        <div class="dyg-tn"><span class="dyg-chip">${esc(t.abbr)}</span><span class="dyg-name">${rk ? `<small>${rk}</small> ` : ''}${esc(t.name)}</span>${poss ? '<span class="dyg-poss" title="Possession">●</span>' : ''}</div>
        <div class="dyg-sc">${GM.score[s]}</div>
        <div class="dyg-to" title="Timeouts">${[0, 1, 2].map(i => `<i class="${i < GM.to[s] ? 'on' : ''}"></i>`).join('')}</div></div>`;
    };
    const qn = GM.q <= 4 ? ['1st', '2nd', '3rd', '4th'][GM.q - 1] : (GM.q - 4 > 1 ? GM.q - 4 : '') + 'OT';
    const situ = GM.over ? 'FINAL' : GM.next === 'kick' || GM.next === 'free' ? 'Kickoff' : GM.next === 'pat' ? 'Try' : DY.downStr(GM.down, GM.togo, GM.ball) + ' · ' + DY.spotName(GM, GM.poss, GM.ball);
    el.innerHTML = `${side('a')}<div class="dyg-mid"><div class="dyg-q">${GM.over ? 'FINAL' : qn}</div><div class="dyg-clock">${GM.q <= 4 ? DY.clockStr(GM.clock) : ''}</div><div class="dyg-situ">${esc(situ)}</div></div>${side('h')}`;
    const wp = DY.winProb(GM), bar = S.el.querySelector('#dygWp');
    bar.style.width = (100 - wp * 100).toFixed(1) + '%'; bar.style.background = GM.T.a.c1; bar.parentNode.style.background = GM.T.h.c1;
    bar.parentNode.title = `Win probability: ${GM.T.h.abbr} ${Math.round(wp * 100)}%, ${GM.T.a.abbr} ${Math.round(100 - wp * 100)}%`;
  }
  function showCaption(r) {
    const c = S.el.querySelector('#dygCap');
    const play = r.play ? `<span class="dyg-call">${esc(S.GM.T[r.s] ? S.GM.T[r.s].abbr : '')}: ${esc(r.form ? r.form + ' · ' : '')}${esc(r.play)}${r.cov ? ' vs ' + esc(r.cov) : ''}${r.pm > 0 ? ' <b class="dyg-good">✓ good call</b>' : r.pm < 0 ? ' <b class="dyg-bad">✗ they had it covered</b>' : ''}</span>` : '';
    c.innerHTML = `${r.head ? `<div class="dyg-head">${esc(r.head)}</div>` : ''}<div class="dyg-text">${r.tag ? `<b class="dyg-tag">${esc(r.tag)}</b> ` : ''}${esc(r.text || '')}</div>${(r.events || []).length ? `<div class="dyg-ev">${r.events.map(esc).join(' ')}</div>` : ''}${play}`;
    if (r.tag && /TOUCHDOWN|PICK-SIX|INTERCEPTED|FUMBLE|SAFETY|BLOCKED|FIELD GOAL|NO GOOD|TURNOVER|HALFTIME|OVERTIME|FINAL|ONSIDE|MUFF|GOOD/.test(r.tag) && !isBars()) banner(r.tag, r.s);
  }
  function banner(tag, s) {
    const b = S.el.querySelector('#dygBanner'), t = S.GM.T[s] || S.GM.T.h;
    b.textContent = tag; b.style.setProperty('--bc', t.c1); b.style.setProperty('--bi', ink(t.c1));
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  }
  function pop(text, cls) {
    if (!S) return;
    const p = S.el.querySelector('#dygPop'); p.textContent = text; p.className = 'dyg-pop ' + (cls || '');
    void p.offsetWidth; p.classList.add('on');
  }

  /* ---------- control panels ---------- */
  const RUNS = [['in', 'Inside run', 'Between the tackles'], ['out', 'Outside run', 'To the edge'], ['qb', 'QB run', 'Keepers, QB power, draws']];
  const PASSES = [['quick', 'Quick pass', 'Ball out fast: beats the blitz'], ['med', 'Medium pass', 'Needs a clean pocket'], ['deep', 'Deep shot', 'Big play or bust'], ['screen', 'Screen', 'Let them rush, throw behind them'], ['pa', 'Play action', 'Best when they load the box']];
  const playSel = cat => `<select class="dyg-psel" data-psel="${cat}" aria-label="Play"><option value="">Auto</option>${DY.BOOK[cat].map(b => `<option ${S.sel[cat] === b.n ? 'selected' : ''}>${esc(b.n)}</option>`).join('')}</select>`;
  function renderPanel(need) {
    const GM = S.GM, el = S.el.querySelector('#dygCtrl'), sim = S.el.querySelector('#dygSim');
    if (GM.over) return;
    const us = GM.user, them = us === 'h' ? 'a' : 'h';
    sim.innerHTML = need === 'plan' ? '' : `<div class="dyg-sims"><span class="dyg-lab">Sim to</span>${[['drive', 'End of drive'], ['quarter', 'End of quarter'], ['half', 'End of half'], ['big', 'Big moment'], ['end', 'Final']].map(([k, l]) => `<button data-sim="${k}">${l}</button>`).join('')}</div>
      <div class="dyg-speed"><span class="dyg-lab">Speed</span><button data-speed="slow" aria-pressed="${S.speed === 'slow'}">Slow</button><button data-speed="fast" aria-pressed="${S.speed === 'fast'}">Fast</button>
      <button data-watch="1" aria-pressed="${GM.coach === 'watch'}" title="The CPU calls your plays too">Watch only</button>
      ${need === 'off' || need === 'def' || need === 'pat' || need === 'half' ? '' : `<button data-pause="1">${S.paused ? 'Resume' : 'Pause'}</button>`}</div>`;
    if (need === 'busy') { el.innerHTML = `<div class="dyg-wait">${S.lastRes && S.lastRes.play ? esc(S.lastRes.play) + '…' : '…'}</div>`; return; }
    const toBtn = GM.next === 'scrim' && GM.q <= 4 && GM.to[us] > 0 ? `<button class="dyg-to-btn ${S.pendTO ? 'on' : ''}" data-to="1" ${GM.running ? '' : 'disabled title="The clock is stopped"'}>Timeout (${GM.to[us]})${S.pendTO ? ' ✓' : ''}</button>` : '';
    if (need === 'plan') { el.innerHTML = scoutHtml(GM); return; }
    if (need === 'half') { el.innerHTML = halfHtml(GM); return; }
    if (need === 'pat') {
      const k = DY.lineup(GM.T[us]).K[0], xp = Math.round(Math.min(99.5, 94.5 + ((k ? k.at.kac : 65) - 70) / 3));
      const forced = GM.ot && GM.ot.n >= 2;
      el.innerHTML = `<div class="dyg-call-h">Touchdown! The try:</div><div class="dyg-btns">${forced ? '' : `<button class="dyg-big" data-pat="xp">Kick the extra point<small>${xp}%</small></button>`}<button class="dyg-big" data-pat="2pt">Go for two<small>${forced ? 'required in 2OT+' : 'about 45%'}</small></button></div>
        <div class="dyg-2pt" hidden><div class="dyg-call-h">Two-point play:</div><div class="dyg-btns"><button data-two="run">Run it in</button><button data-two="qb">QB keeper</button><button data-two="quick">Quick pass</button><button data-two="pa">Play action</button></div></div>`;
      return;
    }
    if (need === 'def') {
      const dt = GM.tend[them], early = Math.round(dt.e[1] / (dt.e[0] + dt.e[1]) * 100);
      el.innerHTML = `<div class="dyg-call-h">Defense: ${esc(DY.downStr(GM.down, GM.togo, GM.ball))} at ${esc(DY.spotName(GM, GM.poss, GM.ball))} <span class="dyg-tip">They pass ${early}% on early downs.</span></div>
        <div class="dyg-btns">${Object.entries(DY.DCALLS).map(([k, d]) => `<button class="dyg-big" data-dcall="${k}">${esc(d.label)}<small>${esc(d.sub)}</small></button>`).join('')}</div><div class="dyg-extra">${toBtn}</div>`;
      return;
    }
    if (need === 'off') {
      const P = DY.lineup(GM.T[us]), k = P.K[0], dist = Math.round(100 - GM.ball + 17), fgp = Math.round(DY.fgProb(GM, k, dist) * 100);
      const dt = GM.dtend[them], dTot = Object.values(dt).reduce((a, b) => a + b, 0);
      let tip = '';
      if (dTot >= 6) { const box = ((dt.bear || 0) + (dt.c3b || 0)) / dTot, bl = (dt.blitz || 0) / dTot, two = ((dt.c2 || 0) + (dt.t2 || 0) + (dt.c4 || 0)) / dTot; tip = bl > 0.3 ? 'They are blitzing a lot: screens and quick throws.' : box > 0.35 ? 'They are loading the box: try play action.' : two > 0.45 ? 'Two-high shells: run it or hit the middle.' : ''; }
      const lc = GM.lastCall[us]; if (lc.length >= 2 && lc[lc.length - 1] === lc[lc.length - 2]) tip = 'You called that twice in a row; they may be sitting on it.';
      const late = (GM.q === 2 || GM.q === 4) && GM.clock <= 120;
      const tab = S.calltab || (GM.down === 4 ? 'special' : 'run');
      const forms = Object.keys(DY.FORMS);
      el.innerHTML = `<div class="dyg-call-h">${esc(DY.downStr(GM.down, GM.togo, GM.ball))} at ${esc(DY.spotName(GM, GM.poss, GM.ball))}${tip ? ` <span class="dyg-tip">${esc(tip)}</span>` : ''}</div>
        <div class="dyg-forms"><span class="dyg-lab">Formation</span><button data-form="auto" aria-pressed="${S.form === 'auto'}">Auto</button>${forms.map(f => `<button data-form="${f}" aria-pressed="${S.form === f}" title="${esc(DY.FORMS[f].pers)} personnel">${esc(DY.FORMS[f].name.replace(/ \(\d+\)$/, ''))} <small>${DY.FORMS[f].pers}</small></button>`).join('')}</div>
        <div class="dyg-ctabs">${['run', 'pass', 'special'].map(t => `<button data-ctab="${t}" aria-selected="${tab === t}">${t === 'special' ? 'Special teams' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
        <div class="dyg-cbody">${tab === 'run' ? RUNS.map(([t, l, d]) => `<div class="dyg-row"><div class="dyg-rl"><b>${l}</b><small>${d}</small>${playSel(t)}</div><div class="dyg-dirs">${(t === 'out' ? ['L', 'R'] : ['L', 'M', 'R']).map(dd => `<button data-run="${t}" data-dir="${dd}">${{ L: 'Left', M: 'Middle', R: 'Right' }[dd]}</button>`).join('')}</div></div>`).join('')
          : tab === 'pass' ? `<div class="dyg-btns">${PASSES.map(([t, l, d]) => `<div class="dyg-pb"><button class="dyg-big" data-pass="${t}">${l}<small>${d}</small></button>${playSel(t)}</div>`).join('')}</div>`
            : `<div class="dyg-btns"><button class="dyg-big" data-sp="punt">Punt<small>${P.P[0] ? esc(DY.lastName(P.P[0])) : ''}</small></button><button class="dyg-big" data-sp="fg" ${dist > 68 ? 'disabled' : ''}>Field goal<small>${dist} yds · ${fgp}%</small></button><button class="dyg-big" data-sp="spike" ${GM.running && GM.down < 4 ? '' : 'disabled'}>Spike<small>stop the clock</small></button><button class="dyg-big" data-sp="kneel">Kneel<small>run clock</small></button></div>`}</div>
        <div class="dyg-extra"><span class="dyg-lab">Tempo</span>${[['', 'Normal'], ['hurry', 'Hurry-up'], ['chew', 'Chew clock']].map(([k, l]) => `<button data-tempo="${k}" aria-pressed="${(S.tempo || '') === k}">${l}</button>`).join('')}${toBtn}${late ? '<span class="dyg-tip">Two-minute drill: incompletions and sidelines stop the clock; first downs stop it inside 2:00.</span>' : ''}</div>`;
      return;
    }
    el.innerHTML = `<div class="dyg-wait">${S.paused ? 'Paused.' : GM.poss === us ? 'Your offense (CPU calling)…' : 'Defense on the field…'}</div><div class="dyg-extra">${S.paused ? '<button class="btn primary" data-next="1">Next play</button>' : ''}${toBtn}</div>`;
  }
  // pre-game: scouting report and your game plan
  function scoutHtml(GM) {
    const us = GM.user, them = us === 'h' ? 'a' : 'h', o = GM.T[them], me = GM.T[us];
    const st = DY.STYLES[o.style] || DY.STYLES.spread, forms = Object.entries(st.forms).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => DY.FORMS[f].name);
    const L = DY.lineup(o), best = o.roster.map(DY.P).sort((a, b) => b.ovr - a.ovr);
    const offStar = best.find(p => DY.SIDE(p.pos) === 'O' && p.pos !== 'OT' && p.pos !== 'IOL'), defStar = best.find(p => DY.SIDE(p.pos) === 'D');
    const A = GM.ovr[us], B = GM.ovr[them];
    const myL = DY.lineup(me), edge = L.EDGE[0], myOT = myL.OT[0];
    const blitz = Math.round(20 + (o.aggr != null ? o.aggr : 0.55) * 30);
    return `<div class="dyg-scout"><div class="dyg-call-h">Scouting report: ${esc(o.name)}${GM.ranks[them] ? ' (No. ' + GM.ranks[them] + ')' : ''}</div>
      <div class="dyg-sgrid">
        <div><div class="dyg-lab">Their offense</div><p><b>${esc(st.name)}</b>, passes about ${Math.round(st.pass * 100)}% of the time. Favorite looks: ${forms.map(esc).join(', ')}.</p><p>QB ${esc(L.QB[0].n)} (${L.QB[0].ovr}, ${esc(L.QB[0].arch)})${offStar && offStar !== L.QB[0] ? `. Weapon: ${esc(offStar.n)} (${offStar.pos}, ${offStar.ovr})` : ''}.</p></div>
        <div><div class="dyg-lab">Their defense</div><p>Blitzes about ${blitz}% of the time. Best player: ${defStar ? esc(defStar.n) + ' (' + defStar.pos + ', ' + defStar.ovr + ')' : '—'}.</p>${edge && myOT ? `<p>Key matchup: ${esc(edge.n)} (${edge.ovr}) off the edge against your LT ${esc(myOT.n)} (${myOT.ovr}).</p>` : ''}</div>
        <div><div class="dyg-lab">Ratings</div><p>Offense ${A.off} vs their defense ${B.def}<br>Defense ${A.def} vs their offense ${B.off}${GM.crowd > 0.6 && us === 'a' ? '<br><b>Loud road crowd:</b> expect false starts.' : ''}</p></div>
      </div>
      <div class="dyg-call-h">Your game plan</div>
      <div class="dyg-btns">${Object.entries(DY.PLANS).map(([k, p]) => `<button class="dyg-big" data-plan="${k}">${esc(p.name)}<small>${esc(p.desc)}</small></button>`).join('')}</div></div>`;
  }
  function halfHtml(GM) {
    const us = GM.user, them = us === 'h' ? 'a' : 'h', T = GM.ts[us], O = GM.ts[them];
    const ypc = t => t.ra ? (t.ry / t.ra).toFixed(1) : '0.0', ypa = t => t.pa ? (t.py / t.pa).toFixed(1) : '0.0';
    const sug = DY.aiAdjust(GM, us);
    S.adj = S.adj || { o: sug.o, d: sug.d };
    return `<div class="dyg-scout"><div class="dyg-call-h">Halftime adjustments</div>
      <table class="dyt dyg-half"><thead><tr><th></th><th>Rush (YPC)</th><th>Pass (YPA)</th><th>Sacks</th><th>3rd down</th></tr></thead><tbody>
      <tr><td><b>${esc(GM.T[us].abbr)}</b></td><td>${T.ry} (${ypc(T)})</td><td>${T.py} (${ypa(T)})</td><td>${T.sk} allowed</td><td>${T.c3}/${T.a3}</td></tr>
      <tr><td><b>${esc(GM.T[them].abbr)}</b></td><td>${O.ry} (${ypc(O)})</td><td>${O.py} (${ypa(O)})</td><td>${O.sk} allowed</td><td>${O.c3}/${O.a3}</td></tr></tbody></table>
      <div class="dyg-lab">Offense</div><div class="dyg-forms">${Object.entries(DY.ADJ_O).map(([k, a]) => `<button data-adjo="${k}" aria-pressed="${S.adj.o === k}">${esc(a.name)}${sug.o === k && k !== 'none' ? ' <small>staff pick</small>' : ''}</button>`).join('')}</div>
      <div class="dyg-lab">Defense</div><div class="dyg-forms">${Object.entries(DY.ADJ_D).map(([k, a]) => `<button data-adjd="${k}" aria-pressed="${S.adj.d === k}">${esc(a.name)}${sug.d === k && k !== 'none' ? ' <small>staff pick</small>' : ''}</button>`).join('')}</div>
      <div class="grow"><button class="btn primary big" data-half="1">Start the second half</button></div></div>`;
  }
  function bind() {
    S.el.addEventListener('change', e => { const t = e.target; if (t.dataset.psel) { S.sel[t.dataset.psel] = t.value || null; } });
    S.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !S) return;
      const GM = S.GM;
      if (b.dataset.tab) { S.tab = b.dataset.tab; S.el.querySelectorAll('.dyg-tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); renderTab(); return; }
      if (S.busy && b.dataset.sim) { S.pendSim = b.dataset.sim; b.textContent = 'After this play…'; return; }
      if (S.busy && !b.dataset.speed && !b.dataset.pause) return;
      if (b.dataset.plan) return doStep({ plan: b.dataset.plan });
      if (b.dataset.adjo) { S.adj.o = b.dataset.adjo; return renderPanel('half'); }
      if (b.dataset.adjd) { S.adj.d = b.dataset.adjd; return renderPanel('half'); }
      if (b.dataset.half) { const a = S.adj; S.adj = null; return doStep({ adj: a }); }
      if (b.dataset.ctab) { S.calltab = b.dataset.ctab; renderPanel(DY.needs(GM)); return; }
      if (b.dataset.form) { S.form = b.dataset.form; renderPanel(DY.needs(GM)); return; }
      if (b.dataset.tempo != null) { S.tempo = b.dataset.tempo || null; renderPanel(DY.needs(GM)); return; }
      if (b.dataset.to) { if (!GM.running) return; S.pendTO = !S.pendTO; renderPanel(DY.needs(GM)); return; }
      if (b.dataset.speed) { S.speed = b.dataset.speed; DY.G.settings.speed = S.speed; barsMode(); renderPanel(S.busy ? 'busy' : DY.needs(GM)); if (!S.busy) loop(); return; }
      if (b.dataset.watch) { GM.coach = GM.coach === 'watch' ? DY.G.settings.coachMode : 'watch'; if (GM.coach === 'watch') S.paused = false; barsMode(); loop(); return; }
      if (b.dataset.pause) { S.paused = !S.paused; loop(); return; }
      if (b.dataset.next) { doStep({}); return; }
      if (b.dataset.sim) { const s0 = SIMS[b.dataset.sim]; simUntil(s0[0], s0[1]); return; }
      const call = { tempo: S.tempo, f: S.form === 'auto' ? null : S.form };
      if (b.dataset.run) { Object.assign(call, { k: 'run', t: b.dataset.run, dir: b.dataset.dir, play: S.sel[b.dataset.run] || null }); S.calltab = 'run'; return doStep({ call }); }
      if (b.dataset.pass) { Object.assign(call, { k: 'pass', t: b.dataset.pass, play: S.sel[b.dataset.pass] || null }); S.calltab = 'pass'; return doStep({ call }); }
      if (b.dataset.sp) { Object.assign(call, { k: b.dataset.sp }); if (b.dataset.sp === 'kneel') call.tempo = 'chew'; S.calltab = null; return doStep({ call }); }
      if (b.dataset.dcall) return doStep({ dcall: b.dataset.dcall });
      if (b.dataset.pat === 'xp') return doStep({ pat: 'xp' });
      if (b.dataset.pat === '2pt') { S.el.querySelector('.dyg-2pt').hidden = false; S.el.querySelectorAll('[data-pat]').forEach(x => x.disabled = true); return; }
      if (b.dataset.two) { GM.patCall = b.dataset.two === 'run' ? { k: 'run', t: 'in', dir: 'M' } : b.dataset.two === 'qb' ? { k: 'run', t: 'qb', dir: 'M' } : { k: 'pass', t: b.dataset.two }; return doStep({ pat: '2pt' }); }
    });
  }

  /* ---------- tabs ---------- */
  function renderTab() {
    const GM = S.GM, el = S.el.querySelector('#dygPanel');
    if (S.tab === 'pbp') {
      const rows = GM.plays.slice().reverse().slice(0, 160);
      el.innerHTML = `<ol class="dyg-pbp">${rows.map(p => `<li class="${p.big ? 'big' : ''} ${p.tag && /TOUCHDOWN|PICK|GOOD|FIELD GOAL|SAFETY/.test(p.tag) ? 'score' : ''}"><span class="dyg-pq">${p.q <= 4 ? 'Q' + p.q : 'OT'}</span><span class="dyg-pt" style="--tc:${GM.T[p.s] ? GM.T[p.s].c1 : '#888'}">${GM.T[p.s] ? esc(GM.T[p.s].abbr) : ''}</span><span>${p.head ? `<small>${esc(p.head)}</small> ` : ''}${esc(p.text)}${p.events && p.events.length ? `<em> ${p.events.map(esc).join(' ')}</em>` : ''}</span></li>`).join('')}</ol>`;
    } else if (S.tab === 'box') el.innerHTML = DYG.boxHtml(GM.T, GM.ts, GM.lineScore, GM.ps);
    else el.innerHTML = driveChart(GM);
  }
  // Madden-style drive chart: each drive on its own field strip, one bar per play (blue run, red pass, grey incomplete, yellow flag/sack)
  function driveChart(GM, lastN) {
    const by = {};
    GM.plays.forEach(p => { if (p.di == null || !p.anim || p.anim.los == null) return; (by[p.di] = by[p.di] || []).push(p); });
    let drives = GM.drives.map((d, i) => ({ d, i, plays: by[i] || [] })).filter(x => x.plays.length);
    if (lastN) drives = drives.slice(-lastN);
    const col = p => { const a = p.anim; if (a.wiped || p.type === 'pen') return 'flag'; if (a.kind === 'sack') return 'sack'; if (a.kind === 'run') return 'run'; if (a.kind === 'pass') return a.int ? 'to' : a.inc ? 'inc' : 'pass'; if (a.kind === 'kick') return 'kick'; return 'st'; };
    return `<div class="dyg-chart">${drives.reverse().map(({ d, plays }) => {
      const t = GM.T[d.s];
      return `<div class="dyg-dr"><div class="dyg-drh"><b style="--tc:${t.c1}">${esc(t.abbr)}</b><span>Q${d.q <= 4 ? d.q : 'OT'} · ${plays.filter(p => p.anim.kind !== 'kick').length} plays · ${Math.round(d.yds || 0)} yds</span><em class="r-${(d.res || '').replace(/\W/g, '')}">${esc(d.res || 'In progress')}</em></div>
        <div class="dyg-strip"><i class="ez l"></i><i class="ez r"></i>${plays.map(p => { const a = p.anim; const from = Math.max(0, Math.min(100, a.los)), to = Math.max(0, Math.min(100, a.end == null ? a.los : a.end)); const l = Math.min(from, to), w = Math.max(0.8, Math.abs(to - from)); return `<span class="dyg-seg ${col(p)} ${to < from ? 'neg' : ''}" style="left:${l}%;width:${w}%" title="${esc(p.text)}"></span>`; }).join('')}</div></div>`;
    }).join('') || '<p class="dim">Drives show up here as they happen.</p>'}<div class="dyg-legend"><span class="run">Run</span><span class="pass">Pass</span><span class="inc">Incomplete</span><span class="sack">Sack / flag</span><span class="to">Turnover</span></div></div>`;
  }
  DYG.driveChart = driveChart;
  DYG.boxHtml = (T, ts, ls, ps) => {
    const n = id => { const p = DY.P(+id); return p ? esc(p.n) : '?'; };
    const lines = s => Object.entries(ps).filter(([id, l]) => l.t === T[s].id);
    const tbl = (s, title, cols, f, sort) => { const rs = lines(s).filter(([, l]) => f(l)).sort((a, b) => sort(b[1]) - sort(a[1])); if (!rs.length) return ''; return `<table class="dyt"><thead><tr><th>${title}</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rs.map(([id, l]) => `<tr><td><a href="#" data-pid="${id}" class="dy-pl${T[s].user ? '' : ' o'}">${n(id)}</a></td>${cols.map(c => `<td>${c[1](l)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; };
    const v = (l, k) => l[k] || 0;
    const side = s => `<div class="dyg-boxside"><h4 style="color:${T[s].c1}">${esc(T[s].name)}</h4>
      ${tbl(s, 'Passing', [['C/A', l => v(l, 'pc') + '/' + v(l, 'pa')], ['Yds', l => v(l, 'py')], ['TD', l => v(l, 'ptd')], ['INT', l => v(l, 'pi')], ['Sk', l => v(l, 'sk')]], l => l.pa, l => v(l, 'pa'))}
      ${tbl(s, 'Rushing', [['Car', l => v(l, 'ra')], ['Yds', l => v(l, 'ry')], ['TD', l => v(l, 'rtd')], ['Lg', l => v(l, 'rlg')]], l => l.ra, l => v(l, 'ry'))}
      ${tbl(s, 'Receiving', [['Rec', l => v(l, 'rc')], ['Yds', l => v(l, 'rcy')], ['TD', l => v(l, 'rctd')], ['Tgt', l => v(l, 'tg')]], l => l.rc || l.tg, l => v(l, 'rcy'))}
      ${tbl(s, 'Defense', [['Tkl', l => v(l, 'tk')], ['TFL', l => v(l, 'tfl')], ['Sck', l => v(l, 'sck')], ['INT', l => v(l, 'int')], ['PD', l => v(l, 'pd')], ['FF', l => v(l, 'ff')]], l => l.tk || l.sck || l.int || l.pd, l => v(l, 'tk') + v(l, 'sck') * 2 + v(l, 'int') * 3)}
      ${tbl(s, 'Kicking', [['FG', l => v(l, 'fgm') + '/' + v(l, 'fga')], ['Lg', l => v(l, 'fglg')], ['XP', l => v(l, 'xpm') + '/' + v(l, 'xpa')]], l => l.fga || l.xpa, l => 1)}
      ${tbl(s, 'Punting', [['No', l => v(l, 'pn')], ['Avg', l => l.pn ? (l.pny / l.pn).toFixed(1) : '0'], ['In 20', l => v(l, 'i20')]], l => l.pn, l => 1)}
      ${tbl(s, 'Returns', [['KR', l => v(l, 'kr') + '-' + v(l, 'kry')], ['PR', l => v(l, 'pr') + '-' + v(l, 'pry')], ['TD', l => v(l, 'rttd')]], l => l.kr || l.pr, l => v(l, 'kry') + v(l, 'pry'))}</div>`;
    const q = ls ? `<table class="dyt dyg-ls"><thead><tr><th></th>${ls.h.map((_, i) => `<th>${i < 4 ? i + 1 : 'OT'}</th>`).join('')}<th>T</th></tr></thead><tbody>${['a', 'h'].map(s => `<tr><td><b>${esc(T[s].abbr)}</b></td>${ls[s].map(x => `<td>${x || 0}</td>`).join('')}<td><b>${ls[s].reduce((a, b) => a + (b || 0), 0)}</b></td></tr>`).join('')}</tbody></table>` : '';
    const t = ts ? `<table class="dyt"><thead><tr><th></th><th>${esc(T.a.abbr)}</th><th>${esc(T.h.abbr)}</th></tr></thead><tbody>${[['First downs', 'fd'], ['Total yards', 'yds'], ['Rushing', x => x.ra + '-' + x.ry], ['Passing', x => x.pc + '/' + x.pa + ', ' + x.py], ['3rd down', x => x.c3 + '/' + x.a3], ['4th down', x => x.c4 + '/' + x.a4], ['Turnovers', 'to'], ['Sacks allowed', 'sk'], ['Penalties', x => x.pen + '-' + x.peny], ['Possession', x => DY.clockStr(x.top)]].map(([l, k]) => `<tr><td>${l}</td><td>${typeof k === 'function' ? k(ts.a) : ts.a[k]}</td><td>${typeof k === 'function' ? k(ts.h) : ts.h[k]}</td></tr>`).join('')}</tbody></table>` : '';
    return `<div class="dyg-box">${q}${t}<div class="dyg-boxsides">${side('a')}${side('h')}</div></div>`;
  };

  /* ---------- canvas: camera, field, players ---------- */
  function sizeCanvas() {
    const wrap = S.el.querySelector('.dyg-fieldwrap'), w = wrap.clientWidth || S.el.clientWidth || 360, dpr = Math.min(2, root.devicePixelRatio || 1);
    // broadcast camera: ~45-66 yards across; phones get a tighter shot so players are big enough to read
    const yards = w < 520 ? 44 : w < 900 ? 56 : 66;
    let ppy = Math.max(6.5, w / yards);
    const vw = Math.min(120, w / ppy); ppy = w / vw;
    const h = Math.min(53.33 * ppy, Math.max(w < 520 ? 270 : 300, Math.min(500, root.innerHeight * 0.55)));
    S.vw = vw; S.vh = h / ppy; S.ppy = ppy; S.cw = w; S.ch = h;
    S.cv.width = Math.round(w * dpr); S.cv.height = Math.round(h * dpr); S.cv.style.height = h + 'px';
    S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (S.cam == null) S.cam = 60;
    S.camY = camYTo(S.camY);
  }
  const dirOf = s => s === 'h' ? 1 : -1;
  const X = (s, yd) => s === 'h' ? 10 + yd : 110 - yd;
  const camTo = x => { const h = S.vw / 2; return Math.max(h, Math.min(120 - h, x)); };
  const camYTo = y => { const h = S.vh / 2; return Math.max(h, Math.min(53.33 - h, y)); };
  const sx = x => (x - (S.cam - S.vw / 2)) * S.ppy, sy = y => (y - (S.camY - S.vh / 2)) * S.ppy;
  function drawField() {
    const c = S.ctx, GM = S.GM, ppy = S.ppy;
    c.fillStyle = '#1f5a26'; c.fillRect(0, 0, S.cw, S.ch);
    for (let x = 10; x < 110; x += 5) { c.fillStyle = (x / 5) % 2 ? '#2f7d36' : '#2b7432'; c.fillRect(sx(x), sy(0), 5 * ppy + 1, 53.33 * ppy); }
    endzone(0, GM.T.h); endzone(110, GM.T.a);
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(sx(0), sy(0), 120 * ppy, 53.33 * ppy);
    for (let x = 10; x <= 110; x += 5) { c.beginPath(); c.moveTo(sx(x), sy(0)); c.lineTo(sx(x), sy(53.33)); c.lineWidth = x === 10 || x === 110 ? 2.4 : x % 10 === 0 ? 1.5 : 1; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.75)';
    for (let x = 11; x < 110; x++) { if (x % 5 === 0) continue; [[0.4, 1.0], [19.6, 20.4], [32.9, 33.7], [52.3, 52.9]].forEach(([a, b]) => c.fillRect(sx(x) - 0.5, sy(a), 1, (b - a) * ppy)); }
    c.font = `700 ${Math.round(Math.max(11, ppy * 1.9))}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,.85)';
    for (let x = 20; x <= 100; x += 10) { const n = x <= 60 ? x - 10 : 110 - x; c.fillText(String(n), sx(x), sy(9)); c.save(); c.translate(sx(x), sy(44.3)); c.rotate(Math.PI); c.fillText(String(n), 0, 0); c.restore(); }
    c.save(); c.globalAlpha = 0.35; c.fillStyle = GM.T.h.c1; c.beginPath(); c.arc(sx(60), sy(26.67), Math.max(9, ppy * 2.4), 0, Math.PI * 2); c.fill(); c.restore();
    c.strokeStyle = '#F2D600'; c.lineWidth = 3;
    [0.4, 119.6].forEach(x => { c.beginPath(); c.moveTo(sx(x), sy(23.6)); c.lineTo(sx(x), sy(29.7)); c.stroke(); });
  }
  function endzone(x0, t) {
    const c = S.ctx, ppy = S.ppy;
    if (t.name === 'Tennessee' && x0 === 0) {
      const s = 2.5;
      for (let i = 0; i < 4; i++) for (let j = 0; j < Math.ceil(53.33 / s); j++) { c.fillStyle = (i + j) % 2 ? '#FFFFFF' : '#FF8200'; c.fillRect(sx(x0 + i * s), sy(j * s), s * ppy + 0.5, s * ppy + 0.5); }
      return;
    }
    c.fillStyle = t.c1; c.fillRect(sx(x0), sy(0), 10 * ppy, 53.33 * ppy);
    c.save(); c.translate(sx(x0 + 5), sy(26.67)); c.rotate(x0 === 0 ? -Math.PI / 2 : Math.PI / 2);
    c.fillStyle = ink(t.c1); c.font = `900 ${Math.round(Math.max(10, ppy * 4.2))}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.9;
    c.fillText(t.name.toUpperCase().slice(0, 14), 0, 0); c.restore();
  }
  function drawLines(los, first) {
    const c = S.ctx;
    if (los != null) { c.strokeStyle = '#2F6BFF'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(sx(los), sy(0)); c.lineTo(sx(los), sy(53.33)); c.stroke(); }
    if (first != null && first > 10 && first < 110) { c.strokeStyle = '#F2D600'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(sx(first), sy(0)); c.lineTo(sx(first), sy(53.33)); c.stroke(); }
  }
  function dot(x, y, paint, num, hl, down) {
    const c = S.ctx, r = Math.max(4.2, S.ppy * 0.85);
    if (hl) { c.beginPath(); c.arc(sx(x), sy(y), r + 3.5, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.4)'; c.fill(); }
    c.beginPath(); c.arc(sx(x) + 1, sy(y) + 1.5, r, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,.25)'; c.fill();
    c.beginPath(); if (down) c.ellipse(sx(x), sy(y), r * 1.25, r * 0.7, 0.6, 0, Math.PI * 2); else c.arc(sx(x), sy(y), r, 0, Math.PI * 2);
    c.fillStyle = paint.fill; c.fill(); c.lineWidth = 1.7; c.strokeStyle = paint.stroke; c.stroke();
    if (num != null && num !== '' && r >= 5.5) { c.fillStyle = paint.num; c.font = `800 ${Math.round(r * 1.05)}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(num), sx(x), sy(y) + 0.5); }
  }
  function ballDot(x, y, z) {
    const c = S.ctx, k = S.ppy;
    if (z > 0.05) { c.beginPath(); c.ellipse(sx(x), sy(y), 0.45 * k, 0.25 * k, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill(); }
    const yy = sy(y) - z * k * 0.55, sc = 1 + z * 0.05;
    c.beginPath(); c.ellipse(sx(x), yy, Math.max(3.2, 0.55 * k * sc), Math.max(2.1, 0.34 * k * sc), 0, 0, Math.PI * 2); c.fillStyle = '#8B4513'; c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx(x) - 0.2 * k, yy); c.lineTo(sx(x) + 0.2 * k, yy); c.stroke();
  }
  function burst(x, y, u) {
    const c = S.ctx; c.save(); c.globalAlpha = Math.max(0, 1 - u); c.strokeStyle = '#FFFFFF'; c.lineWidth = 2;
    c.beginPath(); c.arc(sx(x), sy(y), S.ppy * (1.2 + u * 2.4), 0, Math.PI * 2); c.stroke(); c.restore();
  }

  /* ---------- formations ---------- */
  const OL = { LT: [-0.9, -2.6], LG: [-0.7, -1.3], C: [-0.6, 0], RG: [-0.7, 1.3], RT: [-0.9, 2.6] };
  const SKILL = {
    trips: { QB: [-5, 0], RB: [-5.3, 1.6], TE: [-1, 3.9], WR1: [-0.8, -16], WR2: [-0.8, 15.5], WR3: [-1, 8.5] },
    doubles: { QB: [-5, 0], RB: [-5.3, -1.6], TE: [-1, 3.9], WR1: [-0.8, -16], WR3: [-1, -9], WR2: [-0.8, 15.5] },
    pistol: { QB: [-4, 0], RB: [-7, 0], TE: [-1, 3.9], WR1: [-0.8, -16], WR2: [-0.8, 15.5], WR3: [-1, 8.5] },
    ace12: { QB: [-1.2, 0], RB: [-6.5, 0], TE: [-1, 3.9], TE2: [-1, -3.9], WR1: [-0.8, -15], WR2: [-0.8, 14] },
    iform: { QB: [-1.2, 0], FB: [-4, 0], RB: [-7, 0], TE: [-1, 3.9], WR1: [-0.8, -15], WR2: [-0.8, 14] },
    spread: { QB: [-5, 0], RB: [-5.3, 1.6], WR1: [-0.8, -17], WR4: [-1, -9.5], WR3: [-1, 9], WR2: [-0.8, 16.5] },
    empty: { QB: [-5, 0], TE: [-1, 4.2], WR1: [-0.8, -17], WR4: [-1, -10], WR3: [-1, 9], WR2: [-0.8, 16.5] },
    goal: { QB: [-1.2, 0], RB: [-5.5, 0], FB: [-3.5, 1], TE: [-1, 3.9], TE2: [-1, -3.9], WR1: [-0.8, -10] },
  };
  const DEFL = {
    nickel: { DE1: [1.3, -3.8], DT1: [1.1, -1.25], DT2: [1.1, 1.3], DE2: [1.3, 3.9], LB1: [5, -2.6], LB2: [5, 2.8], CB1: [7, -16], CB2: [7, 15.5], NB: [5.5, 8.5], S1: [12.5, -8], S2: [12.5, 8] },
    base: { DE1: [1.3, -3.8], DT1: [1.1, -1.25], DT2: [1.1, 1.3], DE2: [1.3, 3.9], LB1: [4.5, -2.4], LB2: [4.5, 2.6], CB1: [7, -15], CB2: [7, 14], NB: [4, 5.5], S1: [11, -7], S2: [11, 7] },
    dime: { DE1: [1.3, -3.8], DT1: [1.1, -1.25], DT2: [1.1, 1.3], DE2: [1.3, 3.9], LB1: [5.5, 0], LB2: [8, -9], CB1: [7, -16], CB2: [7, 16], NB: [6, 9], S1: [13.5, -8], S2: [13.5, 8] },
    goal: { DE1: [1, -3.8], DT1: [1, -1.2], DT2: [1, 1.2], DE2: [1, 3.8], LB1: [3, -2.5], LB2: [3, 2.5], CB1: [3, -9], CB2: [3, 8], NB: [2.5, 5.5], S1: [5, -4], S2: [5, 4] },
  };
  function people(GM, s) {
    const L = GM.L[s];
    return {
      LT: L.OT[0], LG: L.IOL[0], C: L.IOL[1], RG: L.IOL[2], RT: L.OT[1], QB: L.QB[0], RB: L.RB[0], FB: L.RB[1] || L.TE[1], TE: L.TE[0], TE2: L.TE[1] || L.OT[2],
      WR1: L.WR[0], WR2: L.WR[1], WR3: L.WR[2], WR4: L.WR[3] || L.WR[2], WR5: L.WR[4] || L.WR[0],
      DE1: L.EDGE[0], DT1: L.DT[0], DT2: L.DT[1], DE2: L.EDGE[1], LB1: L.LB[0], LB2: L.LB[1], CB1: L.CB[0], CB2: L.CB[1], NB: L.NB, S1: L.S[0], S2: L.S[1],
    };
  }
  // the 22 on the field, at the line: offense in formation fk, the defense aligned over it
  function lineUp(GM, s, los, by, fk, r) {
    const d = dirOf(s), o = people(GM, s), df = people(GM, s === 'h' ? 'a' : 'h');
    const F = DY.FORMS[fk] || DY.FORMS.trips, lay = SKILL[fk] || SKILL.trips, dl = DEFL[F.dpers] || DEFL.nickel;
    const place = (f, l) => [los + f * d, Math.max(0.8, Math.min(52.5, by + l * d))];
    const out = [], po = teamPaint(GM, s), pd = teamPaint(GM, s === 'h' ? 'a' : 'h');
    const rr = r && r.r;
    if (rr) {
      const swap = (map, p, keys) => { if (!p || Object.values(map).includes(p)) return; const k = keys.find(k => map[k] && map[k].pos === p.pos) || keys[0]; map[k] = p; };
      if (rr.carrier && rr.carrier.pos !== 'QB') swap(o, rr.carrier, rr.carrier.pos === 'RB' ? ['RB'] : ['WR1', 'WR2', 'WR3']);
      if (rr.target) swap(o, rr.target, rr.target.pos === 'TE' ? ['TE', 'TE2'] : rr.target.pos === 'RB' ? ['RB', 'FB'] : ['WR1', 'WR2', 'WR3', 'WR4']);
      const tk = rr.tackler || rr.sackBy || rr.defender;
      if (tk) swap(df, tk, tk.pos === 'EDGE' ? ['DE1', 'DE2'] : tk.pos === 'DT' ? ['DT1', 'DT2'] : tk.pos === 'LB' ? ['LB1', 'LB2'] : tk.pos === 'S' ? ['S1', 'S2'] : ['CB1', 'CB2', 'NB']);
    }
    for (const k in OL) { const [x, y] = place(OL[k][0], OL[k][1]); out.push({ role: k, side: 'o', p: o[k], num: o[k] ? o[k].num : '', paint: po, pts: [[0, x, y]] }); }
    for (const k in lay) { const [x, y] = place(lay[k][0], lay[k][1]); out.push({ role: k, side: 'o', p: o[k], num: o[k] ? o[k].num : '', paint: po, pts: [[0, x, y]] }); }
    // defenders line up over the receivers they cover
    const recv = Object.keys(lay).filter(k => /WR|TE2/.test(k)).map(k => ({ k, l: lay[k][1] })).sort((a, b) => a.l - b.l);
    const leftOut = recv[0], rightOut = recv[recv.length - 1], slot = recv.filter(x => x !== leftOut && x !== rightOut).sort((a, b) => Math.abs(b.l) - Math.abs(a.l))[0];
    const cov = { CB1: leftOut ? leftOut.l : -16, CB2: rightOut ? rightOut.l : 15.5, NB: slot ? slot.l : dl.NB[1] };
    for (const k in dl) {
      let f = dl[k][0], l = dl[k][1];
      if (cov[k] != null && F.dpers !== 'goal') l = cov[k] + (cov[k] < 0 ? -0.6 : 0.6);
      const [x, y] = place(f, l); out.push({ role: k, side: 'd', p: df[k], num: df[k] ? df[k].num : '', paint: pd, pts: [[0, x, y]], covers: k === 'CB1' ? (leftOut && leftOut.k) : k === 'CB2' ? (rightOut && rightOut.k) : k === 'NB' ? (slot && slot.k) : k === 'LB1' ? 'TE' : k === 'LB2' ? 'RB' : null });
    }
    return out;
  }
  function drawStatic() {
    if (!S) return;
    const GM = S.GM;
    if (isBars()) return;
    if (GM.over || GM.next !== 'scrim') { S.cam = camTo(S.cam || 60); drawField(); return; }
    const s = GM.poss, d = dirOf(s), los = X(s, GM.ball), first = GM.ball + GM.togo >= 100 ? null : X(s, GM.ball + GM.togo);
    S.cam = camTo(los + d * 7); S.camY = camYTo(S.by);
    drawField(); drawLines(los, first);
    const fk = S.form !== 'auto' && GM.user === s ? S.form : (S.lastForm && S.lastForm[s]) || Object.keys((GM.style[s] || DY.STYLES.spread).forms)[0];
    lineUp(GM, s, los, S.by, fk, null).forEach(t => dot(t.pts[0][1], t.pts[0][2], t.paint, t.num));
    ballDot(los, S.by, 0);
  }

  /* ---------- choreography: plays timed in seconds at football speed ---------- */
  const V = { run: 7.4, rec: 7.6, def: 7.2, line: 2.2, ball: 22, kick: 24 };
  const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const lastPt = t => t.pts[t.pts.length - 1];
  function at(t, sec) { const L = t.pts[t.pts.length - 1]; if (sec > L[0]) t.pts.push([sec, L[1], L[2]]); }
  function go(t, x, y, spd, start) { const L = lastPt(t); const t0 = Math.max(start == null ? L[0] : start, L[0]); if (t0 > L[0]) t.pts.push([t0, L[1], L[2]]); const tt = t0 + dist2([L[1], L[2]], [x, y]) / spd; t.pts.push([tt, x, y]); return tt; }
  function goBy(t, x, y, tEnd) { const L = lastPt(t); t.pts.push([Math.max(L[0] + 0.05, tEnd), x, y]); return tEnd; }
  // move toward a target but no faster than spd, arriving by tEnd
  function chase(t, x, y, spd, tEnd, stopShort) {
    const L = lastPt(t), avail = Math.max(0, tEnd - L[0]), d = dist2([L[1], L[2]], [x, y]) - (stopShort || 0);
    if (d <= 0) return at(t, tEnd);
    const k = Math.min(1, (spd * avail) / d);
    t.pts.push([tEnd, L[1] + (x - L[1]) * k, L[2] + (y - L[2]) * k]);
  }
  function sample(pts, t) {
    if (!pts.length) return [60, 26.67, 0];
    if (t <= pts[0][0]) return pts[0].slice(1);
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) { const a = pts[i - 1], b = pts[i], u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]); return a.slice(1).map((v, k) => v + ((b[k + 1] == null ? v : b[k + 1]) - v) * u); }
    }
    return pts[pts.length - 1].slice(1);
  }
  function buildScript(GM, r, pre) {
    const a = r.anim || { kind: 'none' }, kind = a.kind || 'none';
    const sc = { tracks: [], ball: [], lines: null, flag: null, kind, events: [], T: 0.6 };
    if (kind === 'none') return sc;
    if (kind === 'kick' || kind === 'onside') return kickScript(GM, r, pre, sc);
    const s = pre.poss, d = dirOf(s), los = X(s, pre.ball), by = pre.by;
    sc.lines = [los, pre.ball + pre.togo >= 100 ? null : X(s, pre.ball + pre.togo)];
    const fk = a.f || (kind === 'punt' || kind === 'fg' || kind === 'xp' ? 'ace12' : kind === 'kneel' || kind === 'spike' ? 'ace12' : 'trips');
    S.lastForm = S.lastForm || {}; if (a.f) S.lastForm[s] = a.f;
    const T = lineUp(GM, s, los, by, fk, r);
    const tr = role => T.find(t => t.role === role);
    const P = (f, l) => [los + f * d, Math.max(0.6, Math.min(52.7, by + l * d))];
    const toF = x => (x - los) * d, toL = y => (y - by) * d;
    const SNAP = 0.25;
    T.forEach(t => at(t, SNAP));
    const endYd = a.end != null ? a.end : pre.ball + (a.yards || 0);
    const fEnd = Math.max(-pre.ball - 9, Math.min(100 - pre.ball + 9, endYd - pre.ball + (r.td ? 2.5 : 0)));
    const ol = ['LT', 'LG', 'C', 'RG', 'RT'], dls = ['DE1', 'DT1', 'DT2', 'DE2'];
    const lineFight = (push, until) => {
      ol.forEach(k => { const t = tr(k), st = t.pts[0]; go(t, ...P(toF(st[1]) + push, toL(st[2])), V.line, SNAP); at(t, until); });
      dls.forEach((k, i) => { const t = tr(k), st = t.pts[0]; go(t, ...P(toF(st[1]) - 0.7 + push * 0.3, toL(st[2])), V.line, SNAP); });
    };
    const tackleAt = (tkRole, x, y, tEnd) => {
      T.filter(t => t.side === 'd').forEach(t => {
        if (t.role === tkRole) { t.hl = true; chase(t, x + 0.5 * d, y + 0.4, 12, tEnd - 0.02); at(t, tEnd); return; }
        const L0 = lastPt(t); const dd = dist2([L0[1], L0[2]], [x, y]);
        chase(t, x, y, V.def, tEnd, dd < 6 ? 1.2 : 2.2);
      });
    };
    const roleOf = p => { if (!p) return null; const t = T.find(x => x.side === 'd' && x.p === p); return t ? t.role : null; };
    if (kind === 'pen') { sc.flag = P(-1, -3); sc.events.push({ t: 0.2, text: 'FLAG', cls: 'flag' }); sc.ball = [[0, ...P(0, 0), 0]]; sc.T = 1.2; return fin(sc, T); }
    if (kind === 'kneel' || kind === 'spike') {
      const q = tr('QB'); go(q, ...P(-1.2, 0), 6, 0); lineFight(0.3, 1);
      sc.ball = [[0, ...P(-0.2, 0), 0], [SNAP + 0.1, ...P(-1.2, 0), 0.4], [SNAP + 0.5, ...P(kind === 'spike' ? -0.6 : -1.5, 0), 0.1]];
      sc.events.push({ t: SNAP + 0.5, text: kind === 'spike' ? 'SPIKE' : 'KNEEL' }); sc.T = 1.2; return fin(sc, T);
    }
    if (kind === 'run') {
      const t = a.t, dir = a.dir || 'M', isQB = t === 'qb' || t === 'scr' || (r.r && r.r.carrier && r.r.carrier.pos === 'QB');
      const gap = t === 'out' ? (dir === 'L' ? -9 : 9) : t === 'scr' ? (dir === 'L' ? -6 : 6) : ({ L: -2.3, M: 0.2, R: 2.5 }[dir]);
      const endL = gap + (Math.abs(fEnd) > 8 ? (Math.random() - 0.5) * 10 : (Math.random() - 0.5) * 2.5);
      lineFight(t === 'scr' ? -0.8 : 1.3, 3);
      const q = tr('QB'), rb = tr('RB') || tr('FB');
      let tEnd;
      if (isQB) {
        if (t === 'scr') { go(q, ...P(-7, 0), 4, SNAP); go(q, ...P(-5, gap * 0.8), 6); }
        else { go(q, ...P(lastPt(q) && toF(lastPt(q)[1]) - 0.5, gap * 0.3), 5, SNAP); if (rb) { go(rb, ...P(-2.5, -gap * 0.5), 6, SNAP); go(rb, ...P(-0.5, -gap), 6); } }
        go(q, ...P(0.3, gap), V.run);
        if (a.broke) go(q, ...P(fEnd * 0.55, gap + (endL - gap) * 0.5 + 1.6), V.run);
        tEnd = go(q, ...P(fEnd, endL), V.run);
      } else {
        const qs = lastPt(q); go(q, ...P(toF(qs[1]) + 0.2, 0.5), 3, SNAP);
        const mesh = SNAP + 0.45; goBy(rb, ...P(Math.min(-3, toF(lastPt(rb)[1]) + 1.5), 0.4), mesh);
        go(rb, ...P(-0.3, gap), V.run);
        if (a.broke) go(rb, ...P(fEnd * 0.55, gap + (endL - gap) * 0.5 - 1.6), V.run * 0.9);
        tEnd = go(rb, ...P(fEnd, endL), V.run);
        go(q, ...P(-6.5, -2), 4, mesh + 0.1);
        const fb = tr('FB'); if (fb && fb !== rb) { go(fb, ...P(1.5, gap), 7, SNAP); go(fb, ...P(3.5, gap + 0.5), 4); }
      }
      ['WR1', 'WR2', 'WR3', 'WR4', 'TE', 'TE2'].forEach(k => { const w = tr(k); if (!w || w === rb) return; const st = w.pts[0]; go(w, ...P(toF(st[1]) + (/TE/.test(k) ? 1.5 : 4.5), toL(st[2])), 5, SNAP); });
      ['LB1', 'LB2'].forEach(k => { const lb = tr(k); go(lb, ...P(3.2, gap + (k === 'LB1' ? -1.2 : 1.2)), 6, SNAP + 0.15); });
      const car = isQB ? q : rb; car.hl = true;
      tackleAt(roleOf(r.r && r.r.tackler), ...sample(car.pts, tEnd), tEnd);
      sc.ball = [[0, ...P(-0.2, 0), 0], [SNAP + 0.15, ...P(isQB ? toF(q.pts[0][1]) : -4.6, 0), 0.6]];
      const hand = isQB ? SNAP + 0.15 : SNAP + 0.45;
      for (let i = hand; i <= tEnd + 0.001; i += 0.05) { const [x, y] = sample(car.pts, i); sc.ball.push([i, x, y, 0.5]); }
      endCalls(sc, r, tEnd, pre);
      sc.T = tEnd + 0.55; sc.tackle = r.td ? null : { t: tEnd, xy: sample(car.pts, tEnd) };
      return fin(sc, T);
    }
    if (kind === 'sack' || kind === 'pass') {
      const t = a.t || 'med', inc = !!a.inc, int = !!a.int, sack = kind === 'sack';
      const q = tr('QB'), q0 = toF(q.pts[0][1]);
      const drop = t === 'quick' ? Math.min(q0, -6) : t === 'screen' ? -6.5 : -7.6;
      if (t === 'pa' && tr('RB')) { go(q, ...P(q0 + 0.5, 0.6), 4, SNAP); go(tr('RB'), ...P(toF(tr('RB').pts[0][1]) + 1.5, 0.4), 5, SNAP); go(tr('RB'), ...P(-1, -1.5), 5); }
      const tDrop = go(q, ...P(drop, 0), 5.5, t === 'pa' ? SNAP + 0.45 : SNAP);
      lineFight(t === 'screen' ? -1.6 : -1.3, 6);
      // routes (forward f, lateral toward the middle for receivers outside)
      const R = {
        quick: { WR: [[5, 0], [7, 3.5]], SL: [[5, 0], [5.5, -4]], TE: [[2, 2], [3, 5.5]], RB: [[-1, 5]] },
        med: { WR: [[12, 0], [13, 8]], SL: [[10, 0], [12, -6]], TE: [[9, 0], [10, -4]], RB: [[1, 4]] },
        deep: { WR: [[14, 0.5], [34, 2]], SL: [[12, 0], [26, 6]], TE: [[10, 0], [15, -2]], RB: [[0, 4]] },
        pa: { WR: [[12, 0], [28, 6]], SL: [[10, 0], [19, -6]], TE: [[3, -4], [8, -10]], RB: [[-1, -1]] },
        screen: { WR: [[3, 1], [4, 2]], SL: [[-1, -2], [0, -3]], TE: [[2, 2]], RB: [[-4, 3], [-3.5, 8]] },
      }[t] || {};
      const kindOf = k => /^WR[12]$/.test(k) ? 'WR' : /^WR/.test(k) ? 'SL' : /TE/.test(k) ? 'TE' : 'RB';
      const recvs = ['WR1', 'WR2', 'WR3', 'WR4', 'TE', 'TE2', 'RB', 'FB'].filter(k => tr(k) && !(t === 'pa' && k === 'RB'));
      recvs.forEach(k => {
        const w = tr(k), st = w.pts[0], f0 = toF(st[1]), l0 = toL(st[2]), inside = l0 < 0 ? 1 : -1;
        const route = R[kindOf(k)] || [[5, 0]];
        let tt = SNAP;
        route.forEach(([df, dl]) => { tt = go(w, ...P(f0 + df, l0 + dl * (kindOf(k) === 'WR' ? inside : kindOf(k) === 'SL' ? -inside : 1)), V.rec, tt); });
        if (k === 'RB' && t !== 'screen') { go(w, ...P(lastPt(w) ? toF(lastPt(w)[1]) + 1 : 0, toL(lastPt(w)[2])), 2); }
      });
      // coverage
      const man = r.dcall && DY.DEFS[r.dcall.d] && DY.DEFS[r.dcall.d].man;
      T.filter(x => x.side === 'd' && x.covers).forEach(D0 => {
        const O0 = tr(D0.covers); if (!O0) return;
        if (man) for (let i = SNAP + 0.35; i <= 3.2; i += 0.35) { const [ox, oy] = sample(O0.pts, i - 0.15); D0.pts.push([i, ox + d * 1.1, oy + (toL(oy) < 0 ? -0.7 : 0.7) * d]); }
        else { const st = D0.pts[0]; go(D0, ...P(toF(st[1]) + (D0.role.startsWith('LB') ? 5 : 7), toL(st[2]) * 0.85), 5.5, SNAP + 0.1); }
      });
      ['S1', 'S2'].forEach(k => { const st = tr(k).pts[0]; go(tr(k), ...P(toF(st[1]) + (t === 'deep' || t === 'pa' ? 7 : 3), toL(st[2]) * 1.1), 5.5, SNAP + 0.1); });
      const blitz = r.dcall && DY.DEFS[r.dcall.d] && DY.DEFS[r.dcall.d].blitz;
      if (blitz) go(tr('LB1'), ...P(drop + 1, 0.8), 7.5, SNAP + 0.1);
      dls.forEach(k => { const t0 = tr(k); go(t0, ...P(drop + 2.2, toL(t0.pts[0][2]) * 0.4), 2.2, SNAP + 0.5); });
      sc.ball = [[0, ...P(-0.2, 0), 0], [SNAP + 0.12, ...P(q0, 0), 0.7]];
      const qbBall = (from, to) => { for (let i = from; i <= to + 0.001; i += 0.05) { const [x, y] = sample(q.pts, i); sc.ball.push([i, x, y, 0.7]); } };
      if (sack) {
        const skR = roleOf(r.r && r.r.sackBy) || 'DE1', sk = tr(skR); sk.hl = true;
        const tS = tDrop + 0.45 + Math.random() * 0.5;
        at(q, tS - 0.15);
        const [qx, qy] = sample(q.pts, tS);
        goBy(sk, qx + 0.6 * d, qy + 0.3, tS);
        goBy(q, ...P(Math.max(fEnd, drop - 2.5), 0.5), tS + 0.35); goBy(sk, ...P(Math.max(fEnd, drop - 2.5) + 0.4, 0.8), tS + 0.35);
        qbBall(SNAP + 0.12, tS + 0.35);
        sc.events.push({ t: tS, text: 'SACK', cls: 'bad' });
        sc.T = tS + 0.9; sc.tackle = { t: tS + 0.35, xy: sample(q.pts, tS + 0.35) };
        return fin(sc, T);
      }
      if (!a.role && inc) {
        const thr = tDrop + 0.5; qbBall(SNAP + 0.12, thr);
        const [qx, qy] = sample(q.pts, thr); const [ex, ey] = P(7, by > 26 ? -(by - 0.5) : 53 - by);
        sc.ball.push([thr + 0.35, (qx + ex) / 2, (qy + ey) / 2, 3]); sc.ball.push([thr + 0.7, ex, ey, 0]);
        sc.events.push({ t: thr + 0.7, text: 'THROWN AWAY', cls: 'meh' }); sc.T = thr + 1.3; return fin(sc, T);
      }
      const O = tr(a.role) || tr('WR1');
      const air = a.air != null ? a.air : (t === 'deep' ? 26 : t === 'quick' ? 5 : t === 'screen' ? -2 : 12);
      // where the receiver can be at catch time, running his route at speed
      const thrMin = t === 'screen' ? tDrop - 0.1 : t === 'quick' ? tDrop : tDrop + 0.2;
      const st = O.pts[0], f0 = toF(st[1]), l0 = toL(st[2]);
      const latC = toL(sample(O.pts, Math.min(lastPt(O)[0], thrMin + 0.6))[1]);
      const routeLen = dist2([f0, l0], [air, latC]);
      const tCatch = Math.max(thrMin + Math.max(0.3, Math.abs(air - drop) / V.ball), SNAP + routeLen / V.rec);
      const thr = tCatch - Math.max(0.3, Math.abs(air - drop) / V.ball);
      at(q, thr); qbBall(SNAP + 0.12, thr);
      O.pts = [O.pts[0], [SNAP, O.pts[0][1], O.pts[0][2]]];
      goBy(O, ...P(air, latC), tCatch);
      const [cx, cy] = P(air, latC), [qx, qy] = sample(q.pts, thr);
      const hgt = 1.2 + Math.abs(air) * 0.12;
      for (let i = 1; i <= 10; i++) { const u = i / 10; sc.ball.push([thr + (tCatch - thr) * u, qx + (cx - qx) * u, qy + (cy - qy) * u, 0.7 + Math.sin(Math.PI * u) * hgt]); }
      // defenders break on the throw
      const covD = T.find(x => x.side === 'd' && x.covers === O.role) || tr('CB1');
      T.filter(x => x.side === 'd' && !dls.includes(x.role)).forEach(D0 => { const L0 = lastPt(D0); D0.pts = D0.pts.filter(p => p[0] <= thr); chase(D0, cx, cy, V.def, tCatch + 0.25, D0 === covD ? 0.8 : 3); });
      if (int) {
        const dR = roleOf(r.r && r.r.defender) || covD.role, D0 = tr(dR); D0.hl = true;
        D0.pts = D0.pts.filter(p => p[0] <= thr); goBy(D0, cx + 0.5 * d, cy, tCatch);
        const ret = Math.min(a.ret || 0, 100), rf = a.ret >= 999 ? -pre.ball - 3 : Math.max(-pre.ball - 3, air - Math.min(ret, 60));
        const tR = go(D0, ...P(rf, latC + (Math.random() - 0.5) * 10), V.run);
        for (let i = tCatch; i <= tR + 0.001; i += 0.05) { const [x, y] = sample(D0.pts, i); sc.ball.push([i, x, y, 0.5]); }
        T.filter(x => x.side === 'o').forEach(x => chase(x, ...sample(D0.pts, tR), V.def, tR, 1.5));
        sc.events.push({ t: tCatch, text: 'INTERCEPTED', cls: 'bad' });
        sc.T = tR + 0.6; sc.tackle = a.ret >= 999 ? null : { t: tR, xy: sample(D0.pts, tR) };
        return fin(sc, T);
      }
      if (inc) {
        const [fx, fy] = P(air + 1.6, latC + 1);
        sc.ball.push([tCatch + 0.15, fx, fy, 0.3]); sc.ball.push([tCatch + 0.4, fx + d * 0.6, fy, 0]);
        go(O, ...P(air + 2, latC), 5);
        if (covD) { covD.hl = true; }
        sc.events.push({ t: tCatch, text: r.r && r.r.drop ? 'DROPPED' : 'INCOMPLETE', cls: 'meh' });
        if (a.flag) { sc.flag = P(air, latC); sc.events.push({ t: tCatch + 0.15, text: 'FLAG', cls: 'flag' }); }
        sc.T = tCatch + 1.0; return fin(sc, T);
      }
      const endL = latC + (Math.random() - 0.5) * Math.min(12, Math.max(2, (fEnd - air) * 0.4));
      const tEnd = go(O, ...P(fEnd, endL), V.run); O.hl = true;
      for (let i = tCatch; i <= tEnd + 0.001; i += 0.05) { const [x, y] = sample(O.pts, i); sc.ball.push([i, x, y, 0.5]); }
      tackleAt(roleOf(r.r && r.r.tackler), ...sample(O.pts, tEnd), tEnd);
      if (fEnd - air >= 1 && !a.wiped) sc.events.push({ t: tCatch, text: 'CAUGHT', cls: 'good small' });
      endCalls(sc, r, tEnd, pre);
      sc.T = tEnd + 0.55; sc.tackle = r.td ? null : { t: tEnd, xy: sample(O.pts, tEnd) };
      return fin(sc, T);
    }
    if (kind === 'punt') {
      const p = tr('QB'); p.pts = [[0, ...P(-14, 0)]]; at(p, 0.4);
      const land = a.land != null ? a.land - pre.ball : 40, recvF = Math.min(land, 100 - pre.ball + 4), ret = r.r && r.r.ret != null ? r.r.ret : 0;
      const endF = a.blocked ? -12 : recvF - ret;
      const PR = tr('S1'); PR.pts = [[0, ...P(Math.min(recvF, 100 - pre.ball - 1) + 3, 0)]]; PR.hl = true;
      const hang = 2.6, tLand = 0.55 + hang;
      goBy(PR, ...P(Math.min(recvF, 100 - pre.ball - 1), 0), tLand - 0.2); at(PR, tLand);
      const tEnd = go(PR, ...P(endF, (Math.random() - 0.5) * 12), V.run);
      // gunners fly, the rest release and cover; the return team jams and forms a wall
      const gun = ['WR1', 'WR2'];
      T.filter(x => x.side === 'o' && x.role !== 'QB').forEach((x, i) => { const st = x.pts[0]; const g0 = gun.includes(x.role); go(x, ...P(recvF - (g0 ? 2 : 9) + (i % 3), toL(st[2]) * (g0 ? 0.6 : 0.4)), g0 ? 8 : 6.5, g0 ? 0.2 : 0.7); chase(x, ...sample(PR.pts, tEnd), 7.5, tEnd, 1.2); });
      T.filter(x => x.side === 'd' && x !== PR).forEach((x, i) => { const st = x.pts[0]; go(x, ...P(recvF - 12 + (i % 4) * 1.5, toL(st[2]) * 0.5), 6, 0.8); at(x, tLand + 0.3); chase(x, ...sample(PR.pts, tEnd), 5, tEnd, 2.5); });
      sc.ball = [[0, ...P(-0.2, 0), 0.3], [0.35, ...P(-13.5, 0), 0.8], [0.55, ...P(-13.5, 0), 1]];
      for (let i = 1; i <= 12; i++) { const u = i / 12; sc.ball.push([0.55 + hang * u, ...P(-13.5 + (recvF + 13.5) * u, 0), 1 + Math.sin(Math.PI * u) * 16]); }
      for (let i = tLand; i <= tEnd + 0.001; i += 0.05) { const [x, y] = sample(PR.pts, i); sc.ball.push([i, x, y, 0.5]); }
      if (a.blocked) { sc.ball = sc.ball.slice(0, 3); sc.ball.push([0.8, ...P(-11, 2), 0.3]); sc.ball.push([1.4, ...P(-13, 4), 0]); }
      sc.events.push({ t: tLand, text: r.r && r.r.tb ? 'TOUCHBACK' : 'PUNT', cls: 'meh' });
      sc.T = Math.max(tEnd, tLand) + 0.6; sc.tackle = { t: tEnd, xy: sample(PR.pts, tEnd) };
      return fin(sc, T);
    }
    if (kind === 'fg' || kind === 'xp') {
      const toPost = 100 - pre.ball + 10;
      const h = tr('QB'), k = tr('RB') || tr('FB'); h.pts = [[0, ...P(-7, 0)]]; if (k) { k.pts = [[0, ...P(-9.5, -1.5)]]; go(k, ...P(-7.6, -0.4), 4, 0.35); }
      lineFight(-0.3, 2);
      const okk = a.ok, lat = okk ? (Math.random() - 0.5) * 3 : (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3);
      const short = !okk && a.dist >= 50 && Math.random() < 0.5;
      const endF = short ? toPost - 6 : toPost + 2, flight = 1.25;
      sc.ball = [[0, ...P(-0.2, 0), 0.3], [0.3, ...P(-7, 0), 0.2], [0.55, ...P(-7, 0), 0.2]];
      for (let i = 1; i <= 12; i++) { const u = i / 12; sc.ball.push([0.55 + flight * u, ...P(-7 + (endF + 7) * u, lat * u), 0.3 + Math.sin(Math.PI * u * (short ? 1 : 0.65)) * (6 + toPost * 0.12)]); }
      if (a.blocked) { sc.ball = sc.ball.slice(0, 3); sc.ball.push([0.8, ...P(-5, 1), 1]); sc.ball.push([1.5, ...P(-9, 3), 0]); }
      sc.events.push({ t: 0.55 + flight, text: a.blocked ? 'BLOCKED' : okk ? 'GOOD' : 'NO GOOD', cls: okk ? 'good' : 'bad' });
      sc.T = 0.55 + flight + 0.7; sc.camEnd = los + Math.min(endF, toPost) * d;
      return fin(sc, T);
    }
    sc.ball = [[0, ...P(0, 0), 0]]; sc.T = 0.6; return fin(sc, T);
  }
  function endCalls(sc, r, tEnd, pre) {
    const y = r.anim && r.anim.yards != null ? r.anim.yards : 0;
    if (r.anim && r.anim.wiped) { sc.events.push({ t: tEnd * 0.6, text: 'FLAG', cls: 'flag' }); sc.events.push({ t: tEnd, text: 'PLAY WIPED OUT', cls: 'flag' }); return; }
    if (r.td) return;
    if (r.turnover && r.tag === 'FUMBLE') { sc.events.push({ t: tEnd, text: 'FUMBLE', cls: 'bad' }); return; }
    if (r.firstDown) sc.events.push({ t: tEnd, text: (y > 0 ? '+' + y + ' · ' : '') + 'FIRST DOWN', cls: 'good' });
    else sc.events.push({ t: tEnd, text: y > 0 ? '+' + y : y < 0 ? String(y) : 'NO GAIN', cls: y > 0 ? 'good small' : 'meh' });
  }
  function kickScript(GM, r, pre, sc) {
    const a = r.anim, ks = pre.kicker || (r.s === 'h' ? 'a' : 'h'), rs = ks === 'h' ? 'a' : 'h';
    const dk = dirOf(ks), from = X(ks, a.from || 35);
    const pK = teamPaint(GM, ks), pR = teamPaint(GM, rs);
    const L = GM.L[ks], R = GM.L[rs];
    const kickers = [L.K[0], ...L.LB, ...L.S, ...L.CB, ...L.WR.slice(0, 2), L.RB[1] || L.RB[0], L.TE[0]].filter(Boolean).slice(0, 11);
    const recvs = [R.KR, ...R.OT.slice(0, 2), ...R.IOL.slice(0, 2), R.TE[0], ...R.LB.slice(0, 2), ...R.WR.slice(0, 2), R.RB[1] || R.RB[0]].filter(Boolean).slice(0, 11);
    const onside = a.kind === 'onside';
    const landX = onside ? from + dk * 11 : X(rs, Math.max(-6, a.land));
    const endX = onside ? landX : X(rs, Math.min(100, a.end != null ? a.end : 25));
    const tb = a.tb, ret = !tb && !a.fc && !onside;
    const hang = onside ? 0.8 : 2.7, tKick = 0.7, tLand = tKick + hang;
    const wallX = X(rs, Math.max(18, Math.min(40, (a.end || 25) - 6)));
    const tracks = [];
    // the return team: retreat into a wall in front of the returner
    const KRt = { side: 'd', p: recvs[0], num: recvs[0].num, paint: pR, pts: [[0, landX + dirOf(rs) * -3, 26.67]], hl: true };
    recvs.slice(1).forEach((p, i) => { const y = 7 + i * 4.3; const t = { side: 'd', p, num: p.num, paint: pR, pts: [[0, X(rs, 44 - (i % 3) * 4), y]] }; go(t, wallX, 15 + (i % 5) * 5.5, 6, tKick); tracks.push(t); });
    // the kicking team: kicker's approach, coverage sprints downfield, meets the wall and fights through
    kickers.forEach((p, i) => {
      const y = i === 0 ? 26.67 : 3 + i * 4.8; const t = { side: 'o', p, num: p.num, paint: pK, pts: [[0, from - dk * (i === 0 ? 7 : 1), y]] };
      go(t, from + dk * 0.5, y, i === 0 ? 10 : 5, 0);
      if (ret) { const meet = wallX - dirOf(rs) * 1.2; go(t, meet, y * 0.7 + 8, 7.4); at(t, tLand + 0.6); }
      else go(t, from + dk * (onside ? 11 : 25), y, 7.4);
      tracks.push(t);
    });
    tracks.unshift(KRt);
    goBy(KRt, landX, 26.67, tLand - 0.1); at(KRt, tLand);
    let tEnd = tLand;
    if (ret) { const mid = wallX + dirOf(rs) * 2; go(KRt, mid, 26.67 + (Math.random() - 0.5) * 6, V.run); tEnd = go(KRt, endX, 26.67 + (Math.random() - 0.5) * 16, V.run); }
    else if (tb) { at(KRt, tLand + 0.6); tEnd = tLand + 0.6; }
    // after the return breaks, everyone pursues
    if (ret) tracks.forEach(t => { if (t === KRt) return; chase(t, endX, lastPt(KRt)[2], t.side === 'o' ? 6.5 : 4, tEnd, t.side === 'o' ? 1.3 : 3); });
    const bt = [[0, from, 26.67, 0], [tKick, from, 26.67, 0.2]];
    const top = onside ? 2 : 18;
    for (let i = 1; i <= 14; i++) { const u = i / 14; bt.push([tKick + hang * u, from + (landX - from) * u, 26.67, Math.sin(Math.PI * u) * top]); }
    if (ret) for (let i = tLand; i <= tEnd + 0.001; i += 0.05) { const [x, y] = sample(KRt.pts, i); bt.push([i, x, y, 0.5]); }
    sc.ball = bt; sc.tracks = tracks; sc.cam0 = from;
    sc.events.push({ t: tLand, text: onside ? (r.tag === 'ONSIDE' && r.s === ks ? 'RECOVERED!' : 'ONSIDE KICK') : tb ? 'TOUCHBACK' : a.fc ? 'FAIR CATCH' : 'RETURN', cls: 'meh' });
    if (ret && !r.td) sc.events.push({ t: tEnd, text: 'RETURN ' + Math.round(a.ret || 0), cls: 'good small' });
    sc.T = tEnd + 0.6; sc.tackle = ret && !r.td ? { t: tEnd, xy: [endX, lastPt(KRt)[2]] } : null;
    sc.kick = true;
    tracks.forEach(t => t.pts.sort((a, b) => a[0] - b[0])); sc.ball.sort((a, b) => a[0] - b[0]);
    return sc;
  }
  function fin(sc, T) {
    sc.tracks = T;
    const tMax = Math.max(sc.T, ...T.map(t => lastPt(t)[0]), ...(sc.ball.length ? [sc.ball[sc.ball.length - 1][0]] : [0]));
    sc.T = Math.min(tMax + 0.15, sc.T + 0.8);
    T.forEach(t => { t.pts.sort((a, b) => a[0] - b[0]); });
    sc.ball.sort((a, b) => a[0] - b[0]);
    return sc;
  }
  function animate(sc, done) {
    cancelAnimationFrame(S.raf);
    S.script = sc;
    const pace = (S.speed === 'fast' ? 0.42 : 0.8) * (reduce() ? 0.6 : 1);
    if (sc.kind === 'none' || !sc.tracks.length) { S.script = null; drawStatic(); return setTimeout(done, 250); }
    const t0 = performance.now(), Tms = sc.T * 1000 * pace;
    const fired = new Set();
    if (sc.cam0 != null) S.cam = camTo(sc.cam0);
    const step = now => {
      if (!S) return;
      if (!document.body.contains(S.el)) return DYG.close();
      const el = Math.min(Tms, now - t0), sec = el / 1000 / pace;
      const [bx, by, bz] = sample(sc.ball, sec);
      S.cam = S.cam + (camTo(bx + (sc.lines ? 0 : 0)) - S.cam) * 0.09;
      S.camY = S.camY + (camYTo(by) - S.camY) * 0.07;
      drawField();
      if (sc.lines) drawLines(sc.lines[0], sc.lines[1]);
      const tk = sc.tackle && sec >= sc.tackle.t;
      sc.tracks.forEach(t => { const [x, y] = sample(t.pts, sec); dot(x, y, t.paint, t.num, t.hl && sec > 0.6, tk && t.hl && sec > sc.tackle.t + 0.15); });
      if (sc.flag && sec > 0.4) { S.ctx.fillStyle = '#F2D600'; S.ctx.beginPath(); S.ctx.arc(sx(sc.flag[0]), sy(sc.flag[1]), Math.max(3.5, S.ppy * 0.5), 0, Math.PI * 2); S.ctx.fill(); }
      ballDot(bx, by, bz || 0);
      if (tk) burst(sc.tackle.xy[0], sc.tackle.xy[1], Math.min(1, (sec - sc.tackle.t) / 0.4));
      sc.events.forEach((e, i) => { if (!fired.has(i) && sec >= e.t) { fired.add(i); pop(e.text, e.cls); } });
      if (el < Tms) S.raf = requestAnimationFrame(step);
      else {
        S.script = null;
        S.by = Math.max(20, Math.min(33.3, by));
        setTimeout(() => { if (S && !S.busy && !S.script) drawStatic(); }, S.speed === 'fast' ? 150 : 500);
        setTimeout(done, S.speed === 'fast' ? 60 : 220);
      }
    };
    S.raf = requestAnimationFrame(step);
  }
})(typeof window !== 'undefined' ? window : globalThis);
