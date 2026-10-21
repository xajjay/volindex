/* The Vol Index — Football Dynasty: the live game screen.
   A canvas field with 22 players drawn from the real formations: snaps, handoffs, routes against man or zone, pass rush,
   kicks and returns, each play animated from what the engine decided. You call the plays (or watch), manage timeouts
   and tempo, and can sim to the end of the drive, quarter or half, to the big moments, or to the end. */
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

  /* ---------- open a game ---------- */
  DYG.open = (el, x, opts) => {
    opts = opts || {};
    const g = DY.G;
    let GM = opts.GM || null;
    if (!GM && g.live && g.live.id === x.id) { try { GM = DY.unpackLive(g.live); } catch (e) { GM = null; } }
    if (!GM) GM = DY.startGame(x, true);
    S = { GM, x, el, speed: g.settings.speed || 'slow', paused: false, timer: null, raf: null, by: 26.67, cam: null, script: null, onDone: opts.onDone, tab: 'pbp', pendTO: false, tempo: null, lastRes: null, calls: 0 };
    root.DY_LIVE = GM;
    el.innerHTML = shell();
    S.cv = el.querySelector('canvas'); S.ctx = S.cv.getContext('2d');
    bind();
    sizeCanvas(); drawField(); drawStatic();
    S.ro = root.ResizeObserver ? new root.ResizeObserver(() => { sizeCanvas(); if (!S.script) { drawField(); drawStatic(); } }) : null;
    if (S.ro) S.ro.observe(el.querySelector('.dyg-fieldwrap'));
    renderBoard(); renderPanel(); renderTab();
    if (GM.plays.length === 0) showCaption({ tag: GM.rival ? GM.rival.toUpperCase() : 'KICKOFF', text: intro(GM) });
    setTimeout(loop, 600);
  };
  DYG.close = () => { if (!S) return; clearTimeout(S.timer); cancelAnimationFrame(S.raf); if (S.ro) S.ro.disconnect(); S = null; root.DY_LIVE = null; };
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
      <div class="dyg-fieldwrap"><canvas aria-label="Field"></canvas><div class="dyg-banner" id="dygBanner"></div><div class="dyg-noise" id="dygNoise"></div></div>
      <div class="dyg-cap" id="dygCap" aria-live="polite"></div>
      <div class="dyg-ctrl" id="dygCtrl"></div>
      <div class="dyg-simbar" id="dygSim"></div>
      <div class="dyg-tabs" role="tablist"><button data-tab="pbp" aria-selected="true">Play-by-play</button><button data-tab="box">Box score</button><button data-tab="drives">Drives</button></div>
      <div class="dyg-panel" id="dygPanel"></div>
    </div>`;
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
    if (need) { if (!S.script) drawStatic(); return; }
    if (S.paused) return;
    S.timer = setTimeout(() => doStep({}), S.speed === 'fast' ? 350 : 1100);
  }
  function doStep(uc) {
    if (!S || S.busy) return;
    const GM = S.GM, pre = { poss: GM.poss, ball: GM.ball, down: GM.down, togo: GM.togo, next: GM.next, by: S.by, q: GM.q, kicker: GM.kicker };
    if (S.pendTO) { uc.timeout = true; S.pendTO = false; }
    const r = DY.step(GM, uc);
    if (!r) return loop();
    S.lastRes = r;
    S.busy = true;
    renderPanel('busy');
    const script = buildScript(GM, r, pre);
    const bigThird = pre.next === 'scrim' && pre.down === 3 && GM.big && GM.crowd > 0.7 && pre.poss === 'a' && DY.G.settings.shake !== false && !reduce();
    if (bigThird) shake();
    animate(script, () => {
      S.busy = false;
      showCaption(r); renderBoard(); renderTab(); if (r.final || GM.over) return finish();
      if (S.pendSim) { const k = S.pendSim; S.pendSim = null; const s0 = SIMS[k]; return simUntil(s0[0], s0[1]); }
      loop();
    });
  }
  function shake() {
    const w = S.el.querySelector('.dyg-fieldwrap'); w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake');
    const n = S.el.querySelector('#dygNoise'); n.textContent = S.GM.T.h.name === 'Tennessee' ? 'Neyland is ROCKING' : 'The crowd is on its feet'; n.classList.add('on'); setTimeout(() => n.classList.remove('on'), 1800);
  }
  // sim with no animation until a condition
  function simUntil(cond, label) {
    const GM = S.GM; clearTimeout(S.timer);
    const coach = GM.coach; GM.coach = 'watch';
    let n = 0, r = null;
    const start = { poss: GM.poss, q: GM.q, drives: GM.drives.length, score: GM.score.h + GM.score.a };
    while (!GM.over && n++ < 600) { r = DY.step(GM, {}); if (r) S.lastRes = r; if (cond(GM, r, start)) break; }
    GM.coach = coach;
    if (r) { S.by = 26.67; showCaption(Object.assign({}, r, { tag: r.tag || label })); }
    renderBoard(); renderTab(); drawField(); drawStatic();
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
    renderBoard(); renderTab();
    const us = GM.user, won = GM.score[us] > GM.score[us === 'h' ? 'a' : 'h'];
    showCaption({ tag: 'FINAL', text: `${GM.T.a.name} ${GM.score.a}, ${GM.T.h.name} ${GM.score.h}${GM.q >= 5 ? ' (' + (GM.q - 4 > 1 ? GM.q - 4 : '') + 'OT)' : ''}.` });
    const top = DY.topPerf(GM).find(t => t.s === us);
    S.el.querySelector('#dygCtrl').innerHTML = `<div class="dyg-final ${won ? 'w' : 'l'}"><b>${won ? 'WIN' : 'LOSS'}</b> ${esc(GM.T[us].name)} ${GM.score[us]}, ${esc(GM.T[us === 'h' ? 'a' : 'h'].name)} ${GM.score[us === 'h' ? 'a' : 'h']}
      ${top ? `<div class="dyg-top">${['qb', 'rb', 'wr', 'df'].filter(k => top[k]).map(k => `<span><b>${esc(DY.P(top[k][0]).n)}</b> ${esc(top[k][1])}</span>`).join('')}</div>` : ''}
      <div class="grow"><button class="btn primary big" id="dygDone">Continue</button></div></div>`;
    S.el.querySelector('#dygSim').innerHTML = '';
    S.el.querySelector('#dygDone').onclick = () => { const cb = S.onDone; DYG.close(); if (cb) cb(GM); };
    S.tab = 'box'; renderTab();
    S.el.querySelectorAll('.dyg-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === 'box'));
  }

  /* ---------- scoreboard, caption, panels ---------- */
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
    const wp = DY.winProb(GM);
    const bar = S.el.querySelector('#dygWp');
    bar.style.width = (100 - wp * 100).toFixed(1) + '%'; bar.style.background = GM.T.a.c1; bar.parentNode.style.background = GM.T.h.c1;
    bar.parentNode.title = `Win probability: ${GM.T.h.abbr} ${Math.round(wp * 100)}%, ${GM.T.a.abbr} ${Math.round(100 - wp * 100)}%`;
  }
  function showCaption(r) {
    const c = S.el.querySelector('#dygCap');
    const play = r.play ? `<span class="dyg-call">${esc(S.GM.T[r.s] ? S.GM.T[r.s].abbr : '')}: ${esc(r.play)}${r.cov ? ' vs ' + esc(r.cov) : ''}</span>` : '';
    c.innerHTML = `${r.head ? `<div class="dyg-head">${esc(r.head)}</div>` : ''}<div class="dyg-text">${r.tag ? `<b class="dyg-tag">${esc(r.tag)}</b> ` : ''}${esc(r.text || '')}</div>${(r.events || []).length ? `<div class="dyg-ev">${r.events.map(esc).join(' ')}</div>` : ''}${play}`;
    if (r.tag && /TOUCHDOWN|PICK-SIX|INTERCEPTED|FUMBLE|SAFETY|BLOCKED|FIELD GOAL|NO GOOD|TURNOVER|HALFTIME|OVERTIME|FINAL|SACK|ONSIDE|MUFF|GOOD/.test(r.tag)) banner(r.tag, r.s);
  }
  function banner(tag, s) {
    const b = S.el.querySelector('#dygBanner'), t = S.GM.T[s] || S.GM.T.h;
    b.textContent = tag; b.style.setProperty('--bc', t.c1); b.style.setProperty('--bi', ink(t.c1));
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  }
  const RUNS = [['in', 'Inside run', 'Zone, duo, power: between the tackles'], ['out', 'Outside run', 'Toss, sweep, stretch to the edge'], ['qb', 'QB run', 'Read keeps, QB power, draw']];
  const PASSES = [['quick', 'Quick pass', 'Slants, hitches, RPO: ball out fast, beats the blitz'], ['med', 'Medium pass', 'Digs, mesh, curl-flat: needs a clean pocket'], ['deep', 'Deep shot', 'Verticals and posts: big play or bust, beats single-high'], ['screen', 'Screen', 'Let them rush, then throw behind them'], ['pa', 'Play action', 'Fake the run: best when they are loading the box']];
  function renderPanel(need) {
    const GM = S.GM, el = S.el.querySelector('#dygCtrl'), sim = S.el.querySelector('#dygSim');
    if (GM.over) return;
    const us = GM.user, them = us === 'h' ? 'a' : 'h';
    sim.innerHTML = `<div class="dyg-sims"><span class="dyg-lab">Sim to</span>${[['drive', 'End of drive'], ['quarter', 'End of quarter'], ['half', 'End of half'], ['big', 'Big moment'], ['end', 'Final']].map(([k, l]) => `<button data-sim="${k}">${l}</button>`).join('')}</div>
      <div class="dyg-speed"><span class="dyg-lab">Speed</span><button data-speed="slow" aria-pressed="${S.speed === 'slow'}">Slow</button><button data-speed="fast" aria-pressed="${S.speed === 'fast'}">Fast</button>
      <button data-watch="1" aria-pressed="${GM.coach === 'watch'}" title="Coach mode off: the CPU calls your plays too">Watch only</button>
      ${need === 'off' || need === 'def' || need === 'pat' ? '' : `<button data-pause="1">${S.paused ? 'Resume' : 'Pause'}</button>`}</div>`;
    if (need === 'busy') { el.innerHTML = `<div class="dyg-wait">${S.lastRes && S.lastRes.play ? esc(S.lastRes.play) + '…' : '…'}</div>`; return; }
    const toBtn = GM.next === 'scrim' && GM.q <= 4 && GM.to[us] > 0 ? `<button class="dyg-to-btn ${S.pendTO ? 'on' : ''}" data-to="1" ${GM.running ? '' : 'disabled title="The clock is stopped"'}>Timeout (${GM.to[us]})${S.pendTO ? ' ✓' : ''}</button>` : '';
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
      el.innerHTML = `<div class="dyg-call-h">${esc(DY.downStr(GM.down, GM.togo, GM.ball))} at ${esc(DY.spotName(GM, GM.poss, GM.ball))}${tip ? ` <span class="dyg-tip">${esc(tip)}</span>` : ''}</div>
        <div class="dyg-ctabs">${['run', 'pass', 'special'].map(t => `<button data-ctab="${t}" aria-selected="${tab === t}">${t === 'special' ? 'Special teams' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
        <div class="dyg-cbody">${tab === 'run' ? RUNS.map(([t, l, d]) => `<div class="dyg-row"><div class="dyg-rl"><b>${l}</b><small>${d}</small></div><div class="dyg-dirs">${(t === 'out' ? ['L', 'R'] : ['L', 'M', 'R']).map(dd => `<button data-run="${t}" data-dir="${dd}">${{ L: 'Left', M: 'Middle', R: 'Right' }[dd]}</button>`).join('')}</div></div>`).join('')
          : tab === 'pass' ? `<div class="dyg-btns">${PASSES.map(([t, l, d]) => `<button class="dyg-big" data-pass="${t}">${l}<small>${d}</small></button>`).join('')}</div>`
            : `<div class="dyg-btns"><button class="dyg-big" data-sp="punt">Punt<small>${P.P[0] ? esc(DY.lastName(P.P[0])) : ''}</small></button><button class="dyg-big" data-sp="fg" ${dist > 68 ? 'disabled' : ''}>Field goal<small>${dist} yds · ${fgp}%</small></button><button class="dyg-big" data-sp="spike" ${GM.running && GM.down < 4 ? '' : 'disabled'}>Spike<small>stop the clock</small></button><button class="dyg-big" data-sp="kneel">Kneel<small>run clock</small></button></div>`}</div>
        <div class="dyg-extra"><span class="dyg-lab">Tempo</span>${[['', 'Normal'], ['hurry', 'Hurry-up'], ['chew', 'Chew clock']].map(([k, l]) => `<button data-tempo="${k}" aria-pressed="${(S.tempo || '') === k}">${l}</button>`).join('')}${toBtn}${late ? '<span class="dyg-tip">Two-minute drill: incompletions and sidelines stop the clock; first downs stop it inside 2:00.</span>' : ''}</div>`;
      return;
    }
    el.innerHTML = `<div class="dyg-wait">${S.paused ? 'Paused.' : GM.poss === us ? 'Your offense (CPU calling)…' : 'Defense on the field…'}</div><div class="dyg-extra">${S.paused ? '<button class="btn primary" data-next="1">Next play</button>' : ''}${toBtn}</div>`;
  }
  function bind() {
    S.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !S) return;
      const GM = S.GM;
      if (b.dataset.tab) { S.tab = b.dataset.tab; S.el.querySelectorAll('.dyg-tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); renderTab(); return; }
      if (S.busy && b.dataset.sim) { S.pendSim = b.dataset.sim; b.textContent = 'Simming after this play…'; return; }
      if (S.busy && !b.dataset.speed && !b.dataset.pause) return;
      if (b.dataset.ctab) { S.calltab = b.dataset.ctab; renderPanel(DY.needs(GM)); return; }
      if (b.dataset.tempo != null) { S.tempo = b.dataset.tempo || null; renderPanel(DY.needs(GM)); return; }
      if (b.dataset.to) { if (!GM.running) return; S.pendTO = !S.pendTO; renderPanel(DY.needs(GM)); return; }
      if (b.dataset.speed) { S.speed = b.dataset.speed; DY.G.settings.speed = S.speed; renderPanel(S.busy ? 'busy' : DY.needs(GM)); return; }
      if (b.dataset.watch) { GM.coach = GM.coach === 'watch' ? DY.G.settings.coachMode : 'watch'; if (GM.coach === 'watch') S.paused = false; loop(); return; }
      if (b.dataset.pause) { S.paused = !S.paused; loop(); return; }
      if (b.dataset.next) { doStep({}); return; }
      if (b.dataset.sim) { const s0 = SIMS[b.dataset.sim]; simUntil(s0[0], s0[1]); return; }
      const call = { tempo: S.tempo };
      if (b.dataset.run) { Object.assign(call, { k: 'run', t: b.dataset.run, dir: b.dataset.dir }); S.calltab = 'run'; return doStep({ call }); }
      if (b.dataset.pass) { Object.assign(call, { k: 'pass', t: b.dataset.pass }); S.calltab = 'pass'; return doStep({ call }); }
      if (b.dataset.sp) { Object.assign(call, { k: b.dataset.sp }); if (b.dataset.sp === 'kneel') call.tempo = 'chew'; S.calltab = null; return doStep({ call }); }
      if (b.dataset.dcall) return doStep({ dcall: b.dataset.dcall });
      if (b.dataset.pat === 'xp') return doStep({ pat: 'xp' });
      if (b.dataset.pat === '2pt') { S.el.querySelector('.dyg-2pt').hidden = false; S.el.querySelectorAll('[data-pat]').forEach(x => x.disabled = true); return; }
      if (b.dataset.two) { GM.patCall = b.dataset.two === 'run' ? { k: 'run', t: 'in', dir: 'M' } : b.dataset.two === 'qb' ? { k: 'run', t: 'qb', dir: 'M' } : { k: 'pass', t: b.dataset.two }; return doStep({ pat: '2pt' }); }
    });
  }

  /* ---------- tabs: play-by-play, box score, drives ---------- */
  function renderTab() {
    const GM = S.GM, el = S.el.querySelector('#dygPanel');
    if (S.tab === 'pbp') {
      const rows = GM.plays.slice().reverse().slice(0, 160);
      el.innerHTML = `<ol class="dyg-pbp">${rows.map(p => `<li class="${p.big ? 'big' : ''} ${p.tag && /TOUCHDOWN|PICK|GOOD|FIELD GOAL|SAFETY/.test(p.tag) ? 'score' : ''}"><span class="dyg-pq">${p.q <= 4 ? 'Q' + p.q : 'OT'}</span><span class="dyg-pt" style="--tc:${GM.T[p.s] ? GM.T[p.s].c1 : '#888'}">${GM.T[p.s] ? esc(GM.T[p.s].abbr) : ''}</span><span>${p.head ? `<small>${esc(p.head)}</small> ` : ''}${esc(p.text)}${p.events && p.events.length ? `<em> ${p.events.map(esc).join(' ')}</em>` : ''}</span></li>`).join('')}</ol>`;
    } else if (S.tab === 'box') el.innerHTML = DYG.boxHtml(GM.T, GM.ts, GM.lineScore, GM.ps);
    else {
      el.innerHTML = `<table class="dyt"><thead><tr><th>Team</th><th>Q</th><th>Start</th><th>Plays</th><th>Yds</th><th>Result</th></tr></thead><tbody>${GM.drives.slice().reverse().map(d => `<tr><td><b style="color:${GM.T[d.s].c1}">${esc(GM.T[d.s].abbr)}</b></td><td>${d.q <= 4 ? d.q : 'OT'}</td><td>${esc(DY.spotName(GM, d.s, d.start))}</td><td>${d.plays}</td><td>${Math.round(d.yds)}</td><td>${esc(d.res || '…')}</td></tr>`).join('')}</tbody></table>`;
    }
  }
  DYG.boxHtml = (T, ts, ls, ps) => {
    const n = id => { const p = DY.P(+id); return p ? esc(p.n) : '?'; };
    const lines = s => Object.entries(ps).filter(([id, l]) => l.t === T[s].id);
    const tbl = (s, title, cols, f, sort) => { const rs = lines(s).filter(([, l]) => f(l)).sort((a, b) => sort(b[1]) - sort(a[1])); if (!rs.length) return ''; return `<table class="dyt"><thead><tr><th>${title}</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rs.map(([id, l]) => `<tr><td><a href="#" data-pid="${id}">${n(id)}</a></td>${cols.map(c => `<td>${c[1](l)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; };
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

  /* ---------- canvas: field and camera ---------- */
  function sizeCanvas() {
    const wrap = S.el.querySelector('.dyg-fieldwrap'), w = wrap.clientWidth || 360, dpr = Math.min(2, root.devicePixelRatio || 1);
    // broadcast camera: about 60-70 yards of field across, following the ball; on wide screens it crops the sidelines
    let ppy = Math.max(5.8, Math.min(15, w / 66));
    const vw = Math.min(120, w / ppy); ppy = w / vw;
    const h = Math.min(53.33 * ppy, Math.max(300, Math.min(480, root.innerHeight * 0.52)));
    S.vw = vw; S.vh = h / ppy; S.ppy = ppy; S.cw = w; S.ch = h; S.dpr = dpr;
    if (S.camY == null) S.camY = 26.67;
    S.cv.width = Math.round(w * dpr); S.cv.height = Math.round(h * dpr); S.cv.style.height = h + 'px';
    S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (S.cam == null) S.cam = 60;
    S.camY = camYTo(S.camY);
  }
  const dirOf = s => s === 'h' ? 1 : -1;
  const X = (s, yd) => s === 'h' ? 10 + yd : 110 - yd;
  function camTo(x) { const half = S.vw / 2; return Math.max(half, Math.min(120 - half, x)); }
  const sx = x => (x - (S.cam - S.vw / 2)) * S.ppy, sy = y => (y - (S.camY - S.vh / 2)) * S.ppy;
  function camYTo(y) { const h = S.vh / 2; return Math.max(h, Math.min(53.33 - h, y)); }
  function drawField() {
    const c = S.ctx, GM = S.GM, ppy = S.ppy;
    c.clearRect(0, 0, S.cw, S.ch);
    c.fillStyle = '#1f5a26'; c.fillRect(0, 0, S.cw, S.ch);
    for (let x = 10; x < 110; x += 5) { c.fillStyle = (x / 5) % 2 ? '#2f7d36' : '#2b7432'; c.fillRect(sx(x), sy(0), 5 * ppy + 1, 53.33 * ppy); }
    // end zones
    endzone(0, GM.T.h); endzone(110, GM.T.a);
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(sx(0), sy(0), 120 * ppy, 53.33 * ppy);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.2;
    for (let x = 10; x <= 110; x += 5) { c.beginPath(); c.moveTo(sx(x), sy(0)); c.lineTo(sx(x), sy(53.33)); c.lineWidth = x === 10 || x === 110 ? 2.4 : x % 10 === 0 ? 1.4 : 1; c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.75)';
    for (let x = 11; x < 110; x++) { if (x % 5 === 0) continue; [[0.4, 1.0], [19.6, 20.4], [32.9, 33.7], [52.3, 52.9]].forEach(([a, b]) => c.fillRect(sx(x) - 0.5, sy(a), 1, sy(b) - sy(a))); }
    if (ppy >= 4.5) {
      c.font = `700 ${Math.round(Math.max(10, ppy * 2))}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,.85)';
      for (let x = 20; x <= 100; x += 10) { const n = x <= 60 ? x - 10 : 110 - x; c.fillText(String(n), sx(x), sy(9)); c.save(); c.translate(sx(x), sy(44.3)); c.rotate(Math.PI); c.fillText(String(n), 0, 0); c.restore(); }
    }
    // midfield mark
    c.save(); c.globalAlpha = 0.4; c.fillStyle = GM.T.h.c1; c.beginPath(); c.arc(sx(60), sy(26.67), Math.max(9, ppy * 2.4), 0, Math.PI * 2); c.fill();
    c.fillStyle = ink(GM.T.h.c1); c.font = `800 ${Math.round(Math.max(8, ppy * 1.2))}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(GM.T.h.abbr, sx(60), sy(26.67)); c.restore();
    // goal posts
    c.strokeStyle = '#F2D600'; c.lineWidth = 3;
    [0.4, 119.6].forEach(x => { c.beginPath(); c.moveTo(sx(x), sy(23.6)); c.lineTo(sx(x), sy(29.7)); c.stroke(); });
  }
  function endzone(x0, t) {
    const c = S.ctx, ppy = S.ppy;
    if (t.name === 'Tennessee' && x0 === 0) {
      const s = 2.5;
      for (let i = 0; i < 4; i++) for (let j = 0; j < Math.ceil(53.33 / s); j++) { c.fillStyle = (i + j) % 2 ? '#FFFFFF' : '#FF8200'; c.fillRect(sx(x0 + i * s), sy(j * s), s * ppy + 0.5, s * ppy + 0.5); }
    } else { c.fillStyle = t.c1; c.fillRect(sx(x0), sy(0), 10 * ppy, 53.33 * ppy); }
    c.save(); c.translate(sx(x0 + 5), sy(26.67)); c.rotate(x0 === 0 ? -Math.PI / 2 : Math.PI / 2);
    c.fillStyle = t.name === 'Tennessee' && x0 === 0 ? '#141414' : ink(t.c1); c.font = `900 ${Math.round(Math.max(10, ppy * 4.2))}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.globalAlpha = t.name === 'Tennessee' && x0 === 0 ? 0.0 : 0.9;
    c.fillText(t.name.toUpperCase().slice(0, 14), 0, 0); c.restore();
    if (t.name === 'Tennessee' && x0 === 0) { c.save(); c.translate(sx(5), sy(26.67)); c.rotate(-Math.PI / 2); c.fillStyle = 'rgba(20,20,20,.0)'; c.restore(); }
  }
  function drawLines(los, first, s) {
    const c = S.ctx;
    if (los != null) { c.strokeStyle = '#2F6BFF'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(sx(los), sy(0)); c.lineTo(sx(los), sy(53.33)); c.stroke(); }
    if (first != null && first > 10 && first < 110) { c.strokeStyle = '#F2D600'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(sx(first), sy(0)); c.lineTo(sx(first), sy(53.33)); c.stroke(); }
  }
  function dot(x, y, paint, num, hl) {
    const c = S.ctx, r = Math.max(3.2, S.ppy * 0.88);
    if (hl) { c.beginPath(); c.arc(sx(x), sy(y), r + 3, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill(); }
    c.beginPath(); c.arc(sx(x), sy(y), r, 0, Math.PI * 2); c.fillStyle = paint.fill; c.fill(); c.lineWidth = 1.6; c.strokeStyle = paint.stroke; c.stroke();
    if (num != null && r >= 6) { c.fillStyle = paint.num; c.font = `800 ${Math.round(r * 1.05)}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(num), sx(x), sy(y) + 0.5); }
  }
  function ball(x, y, z) {
    const c = S.ctx, k = S.ppy;
    if (z > 0.05) { c.beginPath(); c.ellipse(sx(x), sy(y), 0.45 * k, 0.25 * k, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,.28)'; c.fill(); }
    const yy = sy(y) - z * k * 0.55, sc = 1 + z * 0.06;
    c.beginPath(); c.ellipse(sx(x), yy, Math.max(3, 0.55 * k * sc), Math.max(2, 0.34 * k * sc), 0, 0, Math.PI * 2); c.fillStyle = '#8B4513'; c.fill(); c.strokeStyle = '#FFFFFF'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx(x) - 0.2 * k, yy); c.lineTo(sx(x) + 0.2 * k, yy); c.stroke();
  }
  // the pre-snap picture: both teams lined up at the ball
  function drawStatic() {
    const GM = S.GM;
    if (GM.over || GM.next !== 'scrim') { S.cam = camTo(S.cam || 60); drawField(); return; }
    const s = GM.poss, d = dirOf(s), los = X(s, GM.ball), first = GM.ball + GM.togo >= 100 ? null : X(s, GM.ball + GM.togo);
    S.cam = camTo(los + d * 8); S.camY = camYTo(S.by); drawField(); drawLines(los, first, s);
    const F = formation(GM, s, los, S.by, d, null);
    F.forEach(t => dot(t.pts[0][1], t.pts[0][2], t.paint, t.num));
    ball(los, S.by, 0);
  }

  /* ---------- choreography: turn a result into tracks ---------- */
  const OFF = { LT: [-0.9, -2.6], LG: [-0.7, -1.3], C: [-0.6, 0], RG: [-0.7, 1.3], RT: [-0.9, 2.6], TE: [-1.0, 3.9], QB: [-5, 0], RB: [-5.3, 1.6], WR1: [-0.8, -16], WR2: [-0.8, 15.5], WR3: [-1.0, 8.5] };
  const DEF = { DE1: [1.3, -3.8], DT1: [1.1, -1.25], DT2: [1.1, 1.3], DE2: [1.3, 3.9], LB1: [5, -2.6], LB2: [5, 2.8], CB1: [7, -16], CB2: [7, 15.5], NB: [5.5, 8.5], S1: [12.5, -8], S2: [12.5, 8] };
  function onField(GM, s) {
    const L = GM.L[s], o = s === GM.poss;
    if (o) return { LT: L.OT[0], LG: L.IOL[0], C: L.IOL[1], RG: L.IOL[2], RT: L.OT[1], TE: L.TE[0], QB: L.QB[0], RB: L.RB[0], WR1: L.WR[0], WR2: L.WR[1], WR3: L.WR[2] };
    return { DE1: L.EDGE[0], DT1: L.DT[0], DT2: L.DT[1], DE2: L.EDGE[1], LB1: L.LB[0], LB2: L.LB[1], CB1: L.CB[0], CB2: L.CB[1], NB: L.NB, S1: L.S[0], S2: L.S[1] };
  }
  function formation(GM, s, los, by, d, r) {
    const o = onField(GM, s), df = onField(GM, s === 'h' ? 'a' : 'h'), po = teamPaint(GM, s), pd = teamPaint(GM, s === 'h' ? 'a' : 'h');
    const place = (f, l) => [los + f * d, Math.max(1, Math.min(52.3, by + l * d))];
    const out = [];
    // put the actual ball carrier / target / tackler in the right slot
    const swapIn = (map, p, slots) => { if (!p) return; if (Object.values(map).includes(p)) return; const k = slots.find(k => map[k] && map[k].pos === p.pos) || slots[0]; map[k] = p; };
    if (r && r.r) {
      const rr = r.r;
      if (rr.carrier && rr.carrier.pos !== 'QB') swapIn(o, rr.carrier, rr.carrier.pos === 'RB' ? ['RB'] : ['WR1', 'WR2', 'WR3']);
      if (rr.target) swapIn(o, rr.target, rr.target.pos === 'TE' ? ['TE'] : rr.target.pos === 'RB' ? ['RB'] : ['WR1', 'WR2', 'WR3']);
      const tk = rr.tackler || rr.sackBy || rr.defender;
      if (tk) swapIn(df, tk, tk.pos === 'EDGE' ? ['DE1', 'DE2'] : tk.pos === 'DT' ? ['DT1', 'DT2'] : tk.pos === 'LB' ? ['LB1', 'LB2'] : tk.pos === 'S' ? ['S1', 'S2'] : ['CB1', 'CB2', 'NB']);
    }
    for (const k in OFF) { const [x, y] = place(OFF[k][0], OFF[k][1]); out.push({ role: k, side: 'o', p: o[k], num: o[k] ? o[k].num : '', paint: po, pts: [[0, x, y]] }); }
    for (const k in DEF) { const [x, y] = place(DEF[k][0], DEF[k][1]); out.push({ role: k, side: 'd', p: df[k], num: df[k] ? df[k].num : '', paint: pd, pts: [[0, x, y]] }); }
    return out;
  }
  const DUR = { run: 2500, pass: 3100, sack: 2400, kick: 3600, punt: 3700, fg: 2500, xp: 2000, pen: 1400, kneel: 1000, spike: 900, onside: 2200, none: 500 };
  function buildScript(GM, r, pre) {
    const a = r.anim || { kind: 'none' };
    const kind = a.kind || 'none';
    const fast = S.speed === 'fast', k = fast ? 0.42 : 1;
    const sc = { dur: (DUR[kind] || 1500) * k * (reduce() ? 0.5 : 1), tracks: [], ball: [], lines: null, flag: null, kind };
    if (kind === 'none') return sc;
    if (kind === 'kick' || kind === 'onside') return kickScript(GM, r, pre, sc);
    const s = pre.poss, d = dirOf(s), los = X(s, pre.ball), by = pre.by;
    sc.lines = [los, pre.ball + pre.togo >= 100 ? null : X(s, pre.ball + pre.togo)];
    sc.cam0 = los + d * 8;
    const T = formation(GM, s, los, by, d, r);
    const tr = role => T.find(t => t.role === role);
    const P = (f, l) => [los + f * d, Math.max(0.6, Math.min(52.7, by + l * d))];
    const add = (role, t, f, l) => { const x = tr(role); const [px, py] = P(f, l); x.pts.push([t, px, py]); };
    const rel = (role, t, df, dl) => { const x = tr(role); const st = x.pts[0]; const f0 = (st[1] - los) * d, l0 = (st[2] - by) * d; add(role, t, f0 + df, l0 + dl); };
    const at = (role, t) => sample(tr(role).pts, t);
    const toF = x => (x - los) * d, toL = y => (y - by) * d;
    const endYd = a.end != null ? a.end : pre.ball + (a.yards || 0);
    const pos = GM.poss === s; // offense kept the ball
    const fEnd = clampF(endYd - pre.ball + (r.td ? 2.5 : 0));
    function clampF(f) { return Math.max(-pre.ball - 9, Math.min(100 - pre.ball + 9, f)); }
    const lineMoves = (push) => {
      ['LT', 'LG', 'C', 'RG', 'RT'].forEach((rl, i) => { rel(rl, 0.3, push, 0); rel(rl, 0.95, push + 0.3, 0); });
      ['DE1', 'DT1', 'DT2', 'DE2'].forEach(rl => { rel(rl, 0.3, -0.6, 0); });
    };
    const converge = (endF, endL, tkRole, tEnd, others) => {
      T.filter(t => t.side === 'd').forEach(t => {
        const last = t.pts[t.pts.length - 1];
        if (t.role === tkRole) { const [x, y] = P(endF + 0.7, endL + 0.4); t.pts.push([tEnd, x, y]); t.hl = true; return; }
        const lf = toF(last[1]), ll = toL(last[2]);
        const w = others == null ? 0.65 : others;
        const [x, y] = P(lf + (endF + 1.5 - lf) * w, ll + (endL - ll) * w);
        t.pts.push([Math.max(last[0] + 0.05, tEnd), x, y]);
      });
    };
    const tkRole = p => { if (!p) return null; const t = T.find(x => x.side === 'd' && x.p === p); return t ? t.role : null; };
    if (kind === 'pen') {
      sc.flag = P(-1, -3); return finalizeTracks(sc, T, [[0, ...P(0, 0), 0]]);
    }
    if (kind === 'kneel' || kind === 'spike') {
      add('QB', 0, -1, 0); add('RB', 0, -5, 0);
      add('QB', 0.4, -1.5, 0); lineMoves(0.2);
      return finalizeTracks(sc, T, [[0, ...P(0, 0), 0], [0.15, ...P(-1, 0), 0.4], [0.5, ...P(kind === 'spike' ? -0.6 : -1.5, 0), kind === 'spike' ? 0 : 0.3], [1, ...P(kind === 'spike' ? -0.6 : -1.5, 0), 0]]);
    }
    if (kind === 'run') {
      const t = a.t, dir = a.dir || 'M', isQB = t === 'qb' || t === 'scr' || (r.r && r.r.carrier && r.r.carrier.pos === 'QB');
      const gap = t === 'out' ? (dir === 'L' ? -9 : 9) : t === 'scr' ? (dir === 'L' ? -6 : 6) : ({ L: -2.2, M: 0.2, R: 2.4 }[dir]);
      const endL = gap + (Math.random() - 0.5) * (Math.abs(fEnd) > 8 ? 10 : 3);
      const car = isQB ? 'QB' : 'RB';
      lineMoves(t === 'scr' ? -0.5 : 1.2);
      if (isQB) {
        if (t === 'scr') { add('QB', 0.3, -6.5, 0); add('QB', 0.48, -5, gap * 0.8); }
        else { add('QB', 0.25, -3.5, gap * 0.4); add('RB', 0.3, -2.5, -gap * 0.5); add('RB', 0.6, -1, -gap * 0.8); }
        add('QB', 0.55, 0.3, gap);
        if (a.broke) add('QB', 0.72, fEnd * 0.6, gap + (endL - gap) * 0.4 + 1.5);
        add('QB', 0.92, fEnd, endL); add('QB', 1, fEnd + 0.4, endL);
      } else {
        add('QB', 0.15, -4.6, 0.6); add('QB', 0.4, -6.2, -1.6); add('QB', 0.7, -6.6, -2);
        add('RB', 0.17, -4.2, 0.5); add('RB', 0.36, -0.4, gap);
        if (a.broke) add('RB', 0.6, fEnd * 0.55, gap + (endL - gap) * 0.5 - 1.5);
        add('RB', 0.92, fEnd, endL); add('RB', 1, fEnd + 0.4, endL);
      }
      ['WR1', 'WR2', 'WR3', 'TE'].forEach(rl => { rel(rl, 0.5, rl === 'TE' ? 1.5 : 5, 0); rel(rl, 0.95, rl === 'TE' ? 2 : 6, 0); });
      ['LB1', 'LB2'].forEach(rl => { add(rl, 0.32, 3.4, gap + (rl === 'LB1' ? -1.2 : 1.2)); });
      ['S1', 'S2', 'CB1', 'CB2', 'NB'].forEach(rl => rel(rl, 0.45, -2, 0));
      converge(fEnd, endL, tkRole(r.r && r.r.tackler), 0.93);
      const C = tr(car);
      const bt = [[0, ...P(-0.2, 0), 0], [isQB ? 0.12 : 0.12, ...P(isQB ? -4.8 : -4.8, 0), 0.6]];
      for (let i = isQB ? 0.14 : 0.18; i <= 1.0001; i += 0.04) { const [x, y] = sample(C.pts, i); bt.push([i, x, y, 0.5]); }
      C.hl = true;
      sc.endX = los + fEnd * d;
      return finalizeTracks(sc, T, bt);
    }
    if (kind === 'sack' || kind === 'pass') {
      const t = a.t || 'med', inc = !!a.inc, int = !!a.int, sack = kind === 'sack';
      const drop = t === 'quick' ? -6 : t === 'screen' ? -6.5 : -7.6;
      if (t === 'pa') { add('QB', 0.12, -4.6, 0.5); add('RB', 0.16, -3.6, 0.4); add('RB', 0.35, -1, -1); }
      add('QB', t === 'pa' ? 0.3 : 0.22, drop, 0);
      lineMoves(t === 'screen' ? -1.5 : -1.2);
      const thr = { quick: 0.3, med: 0.42, deep: 0.5, pa: 0.5, screen: 0.27 }[t] || 0.42;
      // routes
      const routes = {
        quick: { WR1: [[0.3, 4, 0], [0.5, 6, 3]], WR2: [[0.3, 5, 0], [0.45, 5.5, -1]], WR3: [[0.3, 4.5, 0], [0.5, 5, -4]], TE: [[0.35, 2, 3], [0.55, 3, 6]], RB: [[0.4, -1, 5]] },
        med: { WR1: [[0.33, 12, 0], [0.6, 13, 8]], WR2: [[0.35, 13, 0], [0.55, 14, -3]], WR3: [[0.35, 10, 0], [0.6, 12, -7]], TE: [[0.4, 9, 0], [0.6, 10, -4]], RB: [[0.45, 1, 4]] },
        deep: { WR1: [[0.35, 14, 1], [0.7, 32, 2]], WR2: [[0.35, 14, -1], [0.7, 32, -2]], WR3: [[0.35, 12, 0], [0.65, 24, 6]], TE: [[0.45, 10, 0], [0.65, 14, -2]], RB: [[0.45, 0, 4]] },
        pa: { WR1: [[0.35, 12, 0], [0.7, 26, 6]], WR2: [[0.35, 14, 0], [0.7, 30, -2]], WR3: [[0.4, 10, 0], [0.65, 18, -6]], TE: [[0.4, 4, -4], [0.65, 8, -10]], RB: [[0.35, -1, -1]] },
        screen: { WR1: [[0.3, 3, 1], [0.6, 4, 2]], WR2: [[0.3, 3, -1], [0.6, 4, -2]], WR3: [[0.2, -1, -2], [0.4, 0, -3]], TE: [[0.3, 2, 2]], RB: [[0.18, -4, 3], [0.3, -3.5, 8]] },
      }[t] || {};
      const tgtRole = a.role || 'WR1';
      ['WR1', 'WR2', 'WR3', 'TE', 'RB'].forEach(rl => { (routes[rl] || []).forEach(([tt, df, dl]) => { const x = tr(rl), st = x.pts[0]; const l0 = toL(st[2]), f0 = toF(st[1]); const sgn = (rl === 'RB' || rl === 'TE') ? 1 : (l0 < 0 ? 1 : -1); add(rl, tt, f0 + df, l0 + dl * sgn); }); });
      // coverage: man shadows, zone drops
      const man = r.dcall && DY.DEFS[r.dcall.d] && DY.DEFS[r.dcall.d].man;
      const cov = { CB1: 'WR1', CB2: 'WR2', NB: 'WR3', LB1: 'TE', LB2: 'RB' };
      for (const dr in cov) {
        const D0 = tr(dr), O0 = tr(cov[dr]);
        if (man) [0.3, 0.5, 0.7].forEach(tt => { const [ox, oy] = sample(O0.pts, Math.max(0, tt - 0.06)); const f = toF(ox) + 1, l = toL(oy) + (toL(oy) < 0 ? -0.8 : 0.8); add(dr, tt, f, l); });
        else { const st = D0.pts[0]; const f0 = toF(st[1]), l0 = toL(st[2]); add(dr, 0.45, f0 + (dr.startsWith('LB') ? 4 : 6), l0 * 0.9); }
      }
      ['S1', 'S2'].forEach(rl => rel(rl, 0.5, t === 'deep' || t === 'pa' ? 8 : 4, 0));
      if (r.dcall && DY.DEFS[r.dcall.d] && DY.DEFS[r.dcall.d].blitz) { add('LB1', 0.45, -5, -1.2); }
      const ballT = [[0, ...P(-0.2, 0), 0], [0.08, ...P(-4.5, 0), 0.6]];
      const qbAt = tt => sample(tr('QB').pts, tt);
      if (sack) {
        const sk = tkRole(r.r && r.r.sackBy) || 'DE1';
        add(sk, 0.5, drop + 0.6, 0.4); tr(sk).hl = true;
        add('QB', 0.55, drop - 0.3, 0.2); add('QB', 0.7, fEnd, 0.4);
        add(sk, 0.72, fEnd + 0.3, 0.6);
        for (let i = 0.1; i <= 1.0001; i += 0.05) { const [x, y] = qbAt(i); ballT.push([i, x, y, 0.6]); }
        converge(fEnd, 0, sk, 0.75, 0.35);
        return finalizeTracks(sc, T, ballT);
      }
      if (!a.role && inc) {
        // thrown away
        add('QB', thr, drop, a.away ? 1 : 0);
        const [qx, qy] = qbAt(thr); ballT.push([thr, qx, qy, 0.8]);
        const [ex, ey] = P(6, by > 26 ? -(by - 1) : 52 - by); ballT.push([thr + 0.25, ex, ey, 0.3]); ballT.push([1, ex, ey, 0]);
        return finalizeTracks(sc, T, ballT);
      }
      const O = tr(tgtRole);
      const air = a.air != null ? a.air : (t === 'deep' ? 26 : t === 'quick' ? 5 : t === 'screen' ? -2 : 12);
      const flight = 0.07 + Math.abs(air) / 160;
      const tc = Math.min(0.88, thr + flight);
      // receiver gets to the catch point at tc
      const [rx0, ry0] = sample(O.pts, tc);
      const catchL = toL(ry0);
      O.pts = O.pts.filter(p => p[0] < tc); const [cx, cy] = P(air, catchL); O.pts.push([tc, cx, cy]);
      for (let i = 0; i <= 1.0001; i += 0.05) { if (i <= thr) { const [x, y] = qbAt(i); ballT.push([Math.max(0.09, i), x, y, 0.8]); } }
      const [qx, qy] = qbAt(thr);
      const hgt = 1.2 + Math.abs(air) * 0.11;
      for (let i = 1; i <= 8; i++) { const u = i / 8; ballT.push([thr + (tc - thr) * u, qx + (cx - qx) * u, qy + (cy - qy) * u, 0.8 + Math.sin(Math.PI * u) * hgt]); }
      if (int) {
        const dfr = tkRole(r.r && r.r.defender) || 'CB1', D0 = tr(dfr);
        D0.pts = D0.pts.filter(p => p[0] < tc - 0.05); D0.pts.push([tc, cx + 0.6 * d, cy]); D0.hl = true;
        const ret = Math.min(a.ret || 0, 100);
        const rf = air - Math.min(ret, 60) * (a.ret >= 999 ? 0 : 1) - (a.ret >= 999 ? 100 : 0);
        const [ix, iy] = P(Math.max(-pre.ball - 6, rf), catchL + (Math.random() - 0.5) * 8);
        D0.pts.push([0.98, ix, iy]);
        for (let i = tc; i <= 1.0001; i += 0.04) { const [x, y] = sample(D0.pts, i); ballT.push([i, x, y, 0.5]); }
        T.filter(x => x.side === 'o').forEach(x => { const l0 = x.pts[x.pts.length - 1]; x.pts.push([Math.max(l0[0] + 0.05, 0.98), l0[1] + (ix - l0[1]) * 0.55, l0[2] + (iy - l0[2]) * 0.55]); });
        sc.endX = ix;
        return finalizeTracks(sc, T, ballT);
      }
      if (inc) {
        const [fx, fy] = P(air + 1.5, catchL + 1);
        ballT.push([tc + 0.06, fx, fy, 0.3]); ballT.push([1, fx, fy, 0]);
        const dfr = tkRole(r.r && r.r.defender); if (dfr) { const D0 = tr(dfr); D0.pts = D0.pts.filter(p => p[0] < tc - 0.05); D0.pts.push([tc, cx + 0.8 * d, cy + 0.5]); D0.hl = true; }
        O.pts.push([Math.min(1, tc + 0.15), ...P(air + 1, catchL)]);
        return finalizeTracks(sc, T, ballT);
      }
      // catch and run
      const endL = catchL + (Math.random() - 0.5) * Math.min(12, Math.max(2, (fEnd - air) * 0.4));
      const [ex, ey] = P(fEnd, endL);
      O.pts.push([0.94, ex, ey]); O.hl = true;
      for (let i = tc; i <= 1.0001; i += 0.04) { const [x, y] = sample(O.pts, i); ballT.push([i, x, y, 0.5]); }
      converge(fEnd, endL, tkRole(r.r && r.r.tackler), 0.95);
      sc.endX = ex;
      return finalizeTracks(sc, T, ballT);
    }
    if (kind === 'punt') {
      add('QB', 0, -14, 0); add('QB', 0.2, -13, 0);
      const land = a.land != null ? a.land - pre.ball : 40;
      const ret = r.r && r.r.ret != null ? r.r.ret : 0;
      const recvF = Math.min(land, 100 - pre.ball + 5);
      const endF = recvF - (a.blocked ? 0 : ret);
      const PR = tr('S1'); PR.pts = [[0, ...P(Math.min(recvF, 100 - pre.ball - 1), 0)]]; PR.hl = true;
      PR.pts.push([0.62, ...P(Math.min(recvF, 100 - pre.ball - 1), 0)]); PR.pts.push([0.95, ...P(endF, (Math.random() - 0.5) * 12)]);
      T.filter(x => x.side === 'o' && x.role !== 'QB').forEach((x, i) => { const st = x.pts[0]; x.pts.push([0.62, ...P(recvF - 6 + (i % 3) * 2, toL(st[2]) * 0.5)]); x.pts.push([0.95, ...P(endF + 1.5, toL(st[2]) * 0.2)]); });
      const bt = [[0, ...P(-0.2, 0), 0.3], [0.12, ...P(-13.5, 0), 0.8]];
      for (let i = 1; i <= 10; i++) { const u = i / 10; bt.push([0.2 + 0.42 * u, ...P(-13.5 + (recvF + 13.5) * u, 0), 1 + Math.sin(Math.PI * u) * 14]); }
      for (let i = 0.64; i <= 1.0001; i += 0.04) { const [x, y] = sample(PR.pts, i); bt.push([i, x, y, 0.5]); }
      if (a.blocked) { bt.length = 2; bt.push([0.3, ...P(-10, 2), 0.3]); bt.push([1, ...P(-12, 4), 0]); }
      return finalizeTracks(sc, T, bt);
    }
    if (kind === 'fg' || kind === 'xp') {
      const toPost = 100 - pre.ball + 10;
      add('QB', 0, -7, 0); add('RB', 0, -9.5, -1.5); add('RB', 0.2, -7.6, -0.4);
      lineMoves(-0.3);
      const okk = a.ok, lat = okk ? (Math.random() - 0.5) * 3 : (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3);
      const short = !okk && a.dist >= 50 && Math.random() < 0.5;
      const bt = [[0, ...P(-0.2, 0), 0.3], [0.12, ...P(-7, 0), 0.2], [0.22, ...P(-7, 0), 0.2]];
      const endF = short ? toPost - 6 : toPost + 2;
      for (let i = 1; i <= 10; i++) { const u = i / 10; bt.push([0.22 + 0.62 * u, ...P(-7 + (endF + 7) * u, lat * u), 0.3 + Math.sin(Math.PI * u * (short ? 1 : 0.65)) * (6 + toPost * 0.12)]); }
      bt.push([1, ...P(endF, lat), short ? 0 : 3]);
      if (a.blocked) { bt.length = 3; bt.push([0.35, ...P(-5, 1), 1]); bt.push([1, ...P(-9, 3), 0]); }
      sc.endX = los + endF * d;
      return finalizeTracks(sc, T, bt);
    }
    return finalizeTracks(sc, T, [[0, ...P(0, 0), 0]]);
  }
  function kickScript(GM, r, pre, sc) {
    const a = r.anim, ks = pre.kicker || (r.s === 'h' ? 'a' : 'h'), rs = ks === 'h' ? 'a' : 'h';
    const dk = dirOf(ks), from = X(ks, a.from || 35);
    const pK = teamPaint(GM, ks), pR = teamPaint(GM, rs);
    const L = GM.L[ks], R = GM.L[rs];
    const kickers = [L.K[0], ...L.LB, ...L.S, ...L.CB, ...L.WR.slice(0, 2), L.RB[1] || L.RB[0], L.TE[0]].filter(Boolean).slice(0, 11);
    const recvs = [R.KR, ...R.OT.slice(0, 2), ...R.IOL.slice(0, 2), R.TE[0], ...R.LB.slice(0, 2), ...R.WR.slice(0, 2), R.RB[1] || R.RB[0]].filter(Boolean).slice(0, 11);
    const tracks = [];
    const landX = a.kind === 'onside' ? from + dk * 11 : X(rs, Math.max(-6, a.land));
    const endX = a.kind === 'onside' ? landX : X(rs, Math.min(100, a.end != null ? a.end : 25));
    const tb = a.tb, ret = !tb && !a.fc;
    kickers.forEach((p, i) => { const y = 3 + i * 4.7; tracks.push({ side: 'o', p, num: p.num, paint: pK, pts: [[0, from - dk * (i === 0 ? 6 : 1), i === 0 ? 26.67 : y], [0.15, from + dk * 1, i === 0 ? 26.67 : y], [0.55, landX - dk * 14, y * 0.6 + 10], [0.95, endX - dk * 2, 26.67 + (y - 26.67) * 0.25]] }); });
    recvs.forEach((p, i) => { const isKR = i === 0; const y = isKR ? 26.67 : 6 + (i - 1) * 4.4; const sx0 = isKR ? landX : X(rs, 40 - (i % 3) * 5); const pts = [[0, sx0, y], [0.5, isKR ? landX : sx0 + dirOf(rs) * 3, y]]; if (isKR && ret) { pts.push([0.55, landX, 26.67]); pts.push([0.95, endX, 26.67 + (Math.random() - 0.5) * 16]); } else pts.push([0.95, sx0 + dirOf(rs) * (ret ? 10 : 2), y]); tracks.push({ side: 'd', p, num: p.num, paint: pR, pts, hl: isKR }); });
    const bt = [[0, from, 26.67, 0], [0.12, from, 26.67, 0.2]];
    const top = a.kind === 'onside' ? 2 : 18;
    for (let i = 1; i <= 12; i++) { const u = i / 12; bt.push([0.12 + 0.42 * u, from + (landX - from) * u, 26.67, Math.sin(Math.PI * u) * top]); }
    if (ret) { const KR = tracks.find(t => t.hl); for (let i = 0.56; i <= 1.0001; i += 0.04) { const [x, y] = sample(KR.pts, i); bt.push([i, x, y, 0.5]); } }
    else bt.push([1, landX, 26.67, 0]);
    sc.cam0 = from; sc.endX = endX;
    sc.tracks = tracks; sc.ball = bt;
    return sc;
  }
  function finalizeTracks(sc, T, ballT) {
    T.forEach(t => { t.pts.sort((a, b) => a[0] - b[0]); if (t.pts[t.pts.length - 1][0] < 1) t.pts.push([1, t.pts[t.pts.length - 1][1], t.pts[t.pts.length - 1][2]]); });
    sc.tracks = T; sc.ball = ballT.sort((a, b) => a[0] - b[0]);
    return sc;
  }
  function sample(pts, t) {
    if (!pts.length) return [60, 26.67, 0];
    if (t <= pts[0][0]) return pts[0].slice(1);
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) { const a = pts[i - 1], b = pts[i], u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]), e = u * u * (3 - 2 * u); return a.slice(1).map((v, k) => v + ((b[k + 1] == null ? v : b[k + 1]) - v) * e); }
    }
    return pts[pts.length - 1].slice(1);
  }
  function animate(sc, done) {
    cancelAnimationFrame(S.raf);
    S.script = sc;
    if (sc.kind === 'none' || !sc.tracks.length) { S.script = null; drawStatic(); return setTimeout(done, sc.dur || 300); }
    const t0 = performance.now();
    const step = now => {
      if (!S) return;
      if (!document.body.contains(S.el)) return DYG.close();
      const u = Math.min(1, (now - t0) / sc.dur);
      const [bx, by, bz] = sample(sc.ball, u);
      const target = camTo(bx + (sc.cam0 != null && u < 0.15 ? 0 : 0));
      S.cam = S.cam == null ? target : S.cam + (target - S.cam) * 0.08;
      S.camY = S.camY + (camYTo(by) - S.camY) * 0.06;
      drawField();
      if (sc.lines) drawLines(sc.lines[0], sc.lines[1]);
      sc.tracks.forEach(t => { const [x, y] = sample(t.pts, u); dot(x, y, t.paint, t.num, t.hl && u > 0.3); });
      if (sc.flag && u > 0.2) { S.ctx.fillStyle = '#F2D600'; S.ctx.beginPath(); S.ctx.arc(sx(sc.flag[0]), sy(sc.flag[1]), Math.max(3, S.ppy * 0.5), 0, Math.PI * 2); S.ctx.fill(); }
      ball(bx, by, bz || 0);
      if (u < 1) S.raf = requestAnimationFrame(step);
      else {
        S.script = null;
        // next snap: ball spotted between the hashes where the play ended
        S.by = Math.max(20, Math.min(33.3, by));
        if (!S.GM.over && S.GM.next === 'scrim') setTimeout(() => { if (S && !S.busy) drawStatic(); }, S.speed === 'fast' ? 120 : 450);
        setTimeout(done, S.speed === 'fast' ? 80 : 250);
      }
    };
    if (S.cam == null) S.cam = 60;
    if (sc.cam0 != null) S.cam = camTo(sc.cam0);
    if (sc.kind === 'kick') S.camY = camYTo(26.67);
    S.raf = requestAnimationFrame(step);
  }
})(typeof window !== 'undefined' ? window : globalThis);
