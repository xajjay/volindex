/* The Vol Index — Vol Dynasty: the live game screen.
   The scoreboard and the field stay pinned at the top (like the NBA app's live tracking view); the play call sits right under
   the field so you never scroll away to call a play. Every snap you see is the 22-man simulation replayed frame by frame:
   blocks held and shed, routes and coverage, the throw, the catch, the tackle. The ball carrier's name rides under his dot.
   Watching on fast switches to a Madden-style drive view: the field with a bar for every play (blue run, gold pass, red loss)
   and the play log, with nothing moving the page. */
(function (root) {
  'use strict';
  const DY = root.DY;
  const DYG = root.DYG = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduce = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let S = null;

  /* ---------- colors ---------- */
  const lum = hex => { const h = (hex || '#888888').replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const ink = hex => lum(hex) > 0.6 ? '#141414' : '#FFFFFF';
  function teamPaint(GM, s) {
    const t = GM.T[s];
    if (s === 'h') return { fill: t.c1, stroke: t.c2 === '#FFFFFF' && lum(t.c1) > 0.7 ? '#141414' : (t.c2 || '#FFFFFF'), num: ink(t.c1) };
    const clash = Math.abs(lum(t.c1) - lum(GM.T.h.c1)) < 0.18;
    return clash ? { fill: '#FFFFFF', stroke: t.c1, num: t.c1 === '#FFFFFF' ? '#141414' : t.c1 } : { fill: t.c1, stroke: '#FFFFFF', num: ink(t.c1) };
  }

  /* ---------- sound: everything is synthesized with Web Audio (no files), off until you turn it on ---------- */
  const SND = DYG.sound = (() => {
    let ac = null, master = null, bed = null, noiseBuf = null;
    const on = () => false;   // sound was removed from Vol Dynasty
    function ctx() {
      if (ac) return ac;
      const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6 + (Math.random() * 2 - 1) * 0.15; }
      return ac;
    }
    // a crowd: filtered noise with a slow swell
    function crowd(level, secs, freq, attack) {
      const a = ctx(); if (!a || !on()) return;
      const src = a.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq || 900; bp.Q.value = 0.6;
      const g = a.createGain(), t = a.currentTime; g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + (attack || 0.35)); g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
      src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + secs + 0.1);
      // a few whoops on top
      if (level > 0.5) for (let i = 0; i < 5; i++) tone(700 + Math.random() * 700, t + 0.2 + Math.random() * secs * 0.5, 0.18, 'sawtooth', 0.025, 1.3);
    }
    function tone(f, t, dur, type, vol, slide) {
      const a = ctx(); if (!a || !on()) return;
      const o = a.createOscillator(), g = a.createGain(); o.type = type || 'triangle'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    function claps(n, gap) {
      const a = ctx(); if (!a || !on()) return; const t0 = a.currentTime;
      for (let i = 0; i < n; i++) for (let k = 0; k < 14; k++) {
        const t = t0 + i * gap + Math.random() * 0.05, src = a.createBufferSource(); src.buffer = noiseBuf;
        const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400 + Math.random() * 900;
        const g = a.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        src.connect(hp); hp.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + 0.09);
      }
    }
    return {
      unlock() { const a = ctx(); if (a && a.state === 'suspended') a.resume(); },
      // a low murmur under the whole game
      bed(start) {
        const a = ctx(); if (!a) return;
        if (bed) { try { bed.stop(); } catch (e) { /* already stopped */ } bed = null; }
        if (!start || !on()) return;
        const src = a.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
        const g = a.createGain(); g.gain.value = 0.05; src.connect(lp); lp.connect(g); g.connect(master); src.start(); bed = src;
      },
      roar() { crowd(0.9, 3.2, 950, 0.25); },
      cheer() { crowd(0.45, 1.8, 900, 0.2); },
      groan() { const a = ctx(); if (!a || !on()) return; crowd(0.35, 1.6, 420, 0.15); tone(260, a.currentTime, 0.9, 'sawtooth', 0.03, 0.6); },
      // the home crowd on a big down when the visitors have the ball
      loud() { crowd(0.6, 2.6, 1100, 0.8); claps(6, 0.42); },
      // a touchdown fanfare: a bright brass-like arpeggio
      fanfare() { const a = ctx(); if (!a || !on()) return; const t = a.currentTime + 0.05; [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.12 + (i > 3 ? 0.1 : 0), i === 5 ? 0.6 : 0.16, 'square', 0.06)); },
      sting() { const a = ctx(); if (!a || !on()) return; const t = a.currentTime; [880, 660, 440].forEach((f, i) => tone(f, t + i * 0.09, 0.14, 'square', 0.05)); },
      whistle() { const a = ctx(); if (!a || !on()) return; const t = a.currentTime; tone(2900, t, 0.35, 'sine', 0.05); tone(3100, t + 0.03, 0.3, 'sine', 0.025); },
      thud() { const a = ctx(); if (!a || !on()) return; tone(90, a.currentTime, 0.18, 'sine', 0.25, 0.5); },
    };
  })();
  // what the crowd does after a play: it is the HOME crowd (Neyland on a Tennessee home game)
  function soundFor(r, pre) {
    if (!DY.G.settings.sound) return;
    const GM = S.GM, home = 'h', good = s => s === home;
    const big = r.big || (r.anim && Math.abs(r.anim.yards || 0) >= 20);
    if (r.td) { if (good(r.s)) { SND.roar(); SND.fanfare(); } else SND.groan(); return; }
    if (r.turnover) { if (good(r.s)) SND.groan(); else { SND.roar(); SND.sting(); } return; }
    if (r.tag === 'GOOD' || r.tag === 'FIELD GOAL') { if (good(r.s)) SND.cheer(); return; }
    if (r.r && r.r.kind === 'sack') { if (!good(r.s)) SND.roar(); else SND.groan(); return; }
    if (big) { if (good(r.s)) SND.roar(); else SND.groan(); return; }
    if (r.firstDown && good(r.s)) SND.cheer();
    else if (pre.down >= 3 && !r.firstDown && !good(r.s) && pre.next === 'scrim') SND.cheer();   // a stop on third down
  }

  /* ---------- open / close ---------- */
  DYG.open = (el, x, opts) => {
    opts = opts || {};
    const g = DY.G;
    let GM = opts.GM || null;
    if (!GM && g.live && g.live.id === x.id) { try { GM = DY.unpackLive(g.live); } catch (e) { GM = null; } }
    if (!GM) GM = DY.startGame(x, true);
    GM.live = true; if (GM.by == null) GM.by = 26.67;
    S = { GM, x, el, speed: g.settings.speed || 'slow', paused: false, timer: null, raf: null, cam: 60, camY: 26.67, onDone: opts.onDone, tab: 'pbp', pendTO: false, tempo: null, lastRes: null,
      form: 'auto', otab: null, osub: { run: 'auto', pass: 'auto', rpo: 'auto', st: null }, dir: 'A', play: {}, dg: 'zone', dk: 'auto', dst: 'safe', clockShow: null };
    el.innerHTML = shell();
    S.cv = el.querySelector('canvas'); S.ctx = S.cv.getContext('2d');
    bind();
    sizeCanvas(); drawStatic();
    S.ro = root.ResizeObserver ? new root.ResizeObserver(() => { if (!S) return; sizeCanvas(); if (!S.anim) drawStatic(); }) : null;
    if (S.ro) S.ro.observe(el.querySelector('.dyg-fieldwrap'));
    renderBoard(); renderTab(); barsMode();
    if (GM.plays.length === 0) showCaption({ tag: GM.rival ? GM.rival.toUpperCase() : 'KICKOFF', text: intro(GM) });
    setTimeout(loop, 300);
  };
  DYG.close = () => { if (!S) return; SND.bed(false); document.documentElement.classList.remove('dyg-noscroll'); clearTimeout(S.timer); cancelAnimationFrame(S.raf); if (S.ro) S.ro.disconnect(); S = null; };
  DYG.live = () => S && S.GM;
  function intro(GM) {
    const r = GM.ranks, a = GM.T.a, h = GM.T.h;
    const nm = (t, rk) => (rk ? `No. ${rk} ` : '') + t.name;
    return `${nm(a, r.a)} at ${nm(h, r.h)}${GM.neutral ? ' (neutral site)' : ''}${GM.title ? ' · ' + GM.title : ''}. ${GM.T[GM.tossWinner].name} won the toss and deferred.${GM.crowd > 0.8 && h.name === 'Tennessee' ? ' 101,915 in Neyland Stadium.' : ''}`;
  }
  function shell() {
    return `<div class="dyg">
      <div class="dyg-stick">
        <div class="dyg-board" id="dygBoard"></div>
        <div class="dyg-wp" title="Win probability"><span id="dygWp"></span></div>
        <div class="dyg-fieldwrap"><canvas aria-label="Field: live play"></canvas><div class="dyg-banner" id="dygBanner"></div><div class="dyg-noise" id="dygNoise"></div><div class="dyg-pop" id="dygPop"></div><div class="dyg-cap" id="dygCap" aria-live="polite"></div></div>
        <div class="dyg-bars" id="dygBars" hidden></div>
        <div class="dyg-fullbar"><button data-fullx="1">✕ Exit full screen</button><button data-pause="1" class="dyg-fp-pause">❚❚ / ▶</button></div>
      </div>
      <div class="dyg-ctrl" id="dygCtrl"></div>
      <div class="dyg-simbar" id="dygSim"></div>
      <div class="dyg-tabs" role="tablist"><button data-tab="pbp" aria-selected="true">Play-by-play</button><button data-tab="chart">Drive chart</button><button data-tab="box">Box score</button></div>
      <div class="dyg-panel" id="dygPanel"></div>
    </div>`;
  }
  // watching on fast: the drive view instead of the field
  const isBars = () => S && S.GM.coach === 'watch' && S.speed === 'fast' && !S.watchOne;
  function barsMode() {
    if (!S) return;
    const on = isBars();
    S.el.querySelector('.dyg-fieldwrap').hidden = on;
    const b = S.el.querySelector('#dygBars'); b.hidden = !on;
    if (on) b.innerHTML = barsView(S.GM);
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
    if (need) { if (!S.anim && !isBars()) drawStatic(); return; }
    if (S.paused) return;
    S.timer = setTimeout(() => doStep({}), isBars() ? 650 : S.speed === 'fast' ? 260 : 700);
  }
  function doStep(uc) {
    if (!S || S.busy) return;
    const GM = S.GM, pre = { poss: GM.poss, ball: GM.ball, down: GM.down, togo: GM.togo, next: GM.next, q: GM.q, kicker: GM.kicker, clock: GM.clock, by: GM.by, running: GM.running, score: Object.assign({}, GM.score) };
    if (S.pendTO) { uc.timeout = true; S.pendTO = false; }
    const r = DY.step(GM, uc);
    if (!r) return loop();
    S.lastRes = r;
    const done = () => {
      if (!S) return;
      S.busy = false; S.anim = null;
      // the tracking data is big: keep it only for the play on screen
      if (r.anim && r.anim.trk) { S.lastTrk = r.anim.trk; delete r.anim.trk; }
      if (r.r && r.r.anim && r.r.anim.trk) delete r.r.anim.trk;
      showCaption(r); liveRecords(); renderBoard(); renderTab(); if (isBars()) S.el.querySelector('#dygBars').innerHTML = barsView(GM);
      if (S.watchOne) { S.watchOne = false; barsMode(); }
      if (r.final || GM.over) return finish();
      if (S.pendSim) { const k = S.pendSim; S.pendSim = null; const s0 = SIMS[k]; return simUntil(s0[0], s0[1]); }
      loop();
    };
    if (isBars()) { S.busy = true; return setTimeout(done, 20); }
    S.busy = true;
    renderPanel('busy');
    const bigThird = pre.next === 'scrim' && pre.down === 3 && GM.big && GM.crowd > 0.7 && pre.poss === 'a' && DY.G.settings.shake !== false && !reduce();
    if (bigThird) noise();
    // home crowd gets loud on a big down when the visitors have the ball
    play(r, pre, done);
  }
  // full screen: the field takes the whole screen (best with Watch only on Slow); the caption sits on top of it
  function toggleFull(on) {
    if (!S) return;
    const el = S.el.querySelector('.dyg');
    el.classList.toggle('dyg-full', on);
    document.documentElement.classList.toggle('dyg-noscroll', on);
    try { if (on && el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* not allowed in this frame */ }
    if (on && S.speed === 'fast' && S.GM.coach === 'watch') { S.speed = 'slow'; barsMode(); }
    setTimeout(() => { if (!S) return; sizeCanvas(); if (!S.anim) drawStatic(); }, 120);
  }
  document.addEventListener('fullscreenchange', () => { if (S && !document.fullscreenElement && S.el.querySelector('.dyg-full')) toggleFull(false); });
  // record chase: the moment a Tennessee player passes a school record during the game
  function liveRecords() {
    const GM = S.GM, g = DY.G; if (!g.rec || !GM.user) return;
    const uid = GM.T[GM.user].id; S.recSeen = S.recSeen || {};
    for (const id in GM.ps) {
      const p = DY.P(+id), l = GM.ps[id]; if (!p || p.t !== uid) continue;
      for (const name in DY.REC_MAP) {
        const k = DY.REC_MAP[name]; if (!l[k]) continue;
        for (const scope of ['season', 'career']) {
          const rec = g.rec[scope][k]; if (!rec || rec.pid === p.id) continue;
          const tot = (scope === 'career' ? DY.careerTotal(p, k, true) : ((p.s && p.s[k]) || 0)) + l[k];
          const key = scope + k + id;
          if (tot > rec.v && !S.recSeen[key]) {
            S.recSeen[key] = 1;
            banner('RECORD!', GM.user);
            const c = S.el.querySelector('#dygCap'); c.insertAdjacentHTML('beforeend', `<div class="dyg-recb">🏆 ${esc(p.n)} passes ${esc(rec.n)} (${rec.v}) for Tennessee's ${scope === 'career' ? 'all-time career' : 'single-season'} ${esc(name.toLowerCase())} record: ${tot}.</div>`);
            shake(1);
          }
        }
      }
    }
  }
  function noise() {
    const n = S.el.querySelector('#dygNoise'); n.textContent = S.GM.T.h.name === 'Tennessee' ? 'Neyland is ROCKING' : 'The crowd is on its feet'; n.classList.add('on'); setTimeout(() => n && n.classList.remove('on'), 1800);
    shake(1);
  }
  function shake(k) {
    if (!S || reduce() || DY.G.settings.shake === false) return;
    const w = S.el.querySelector('.dyg-fieldwrap'); w.classList.remove('shake', 'shake2'); void w.offsetWidth; w.classList.add(k === 2 ? 'shake2' : 'shake');
  }
  function simUntil(cond, label) {
    const GM = S.GM; clearTimeout(S.timer);
    const coach = GM.coach; GM.coach = 'watch';
    let n = 0, r = null;
    const start = { poss: GM.poss, q: GM.q, drives: GM.drives.length };
    while (!GM.over && n++ < 700) { r = DY.step(GM, {}); if (r) { S.lastRes = r; if (r.anim) delete r.anim.trk; if (r.r && r.r.anim) delete r.r.anim.trk; } if (cond(GM, r, start)) break; }
    GM.coach = coach;
    if (r) showCaption(Object.assign({}, r, { tag: r.tag || label }));
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
  function renderBoard(pre) {
    if (!S) return;
    const GM = pre ? Object.assign(Object.create(S.GM), { down: pre.down, togo: pre.togo, ball: pre.ball, poss: pre.poss, next: pre.next, clock: pre.clock, score: pre.score, q: pre.q }) : S.GM, el = S.el.querySelector('#dygBoard');
    const side = s => {
      const t = GM.T[s], rk = GM.ranks[s], poss = GM.poss === s && !GM.over && GM.next !== 'kick';
      return `<div class="dyg-team ${s}" style="--tc:${t.c1};--ti:${ink(t.c1)}">
        <div class="dyg-tn"><span class="dyg-chip">${esc(t.abbr)}</span><span class="dyg-name">${rk ? `<small>${rk}</small> ` : ''}${esc(t.name)}</span>${poss ? '<span class="dyg-poss" title="Possession">●</span>' : ''}</div>
        <div class="dyg-sc">${GM.score[s]}</div>
        <div class="dyg-to" title="Timeouts">${[0, 1, 2].map(i => `<i class="${i < GM.to[s] ? 'on' : ''}"></i>`).join('')}</div></div>`;
    };
    const qn = GM.q <= 4 ? ['1st', '2nd', '3rd', '4th'][GM.q - 1] : (GM.q - 4 > 1 ? GM.q - 4 : '') + 'OT';
    const situ = GM.over ? 'FINAL' : GM.next === 'kick' || GM.next === 'free' ? 'Kickoff' : GM.next === 'pat' ? 'Try' : DY.downStr(GM.down, GM.togo, GM.ball) + ' · ' + DY.spotName(GM, GM.poss, GM.ball);
    const clk = GM.clock;
    const pc = S.playClock;
    el.innerHTML = `${side('a')}<div class="dyg-mid"><div class="dyg-q">${GM.over ? 'FINAL' : qn}</div><div class="dyg-clock" id="dygClock">${GM.q <= 4 ? DY.clockStr(clk) : ''}</div><div class="dyg-situ">${esc(situ)}${pc != null && !GM.over ? ` <span class="dyg-pc" title="Play clock at the snap">:${String(pc).padStart(2, '0')}</span>` : ''}</div></div>${side('h')}`;
    const wp = DY.winProb(S.GM), bar = S.el.querySelector('#dygWp');
    bar.style.width = (100 - wp * 100).toFixed(1) + '%'; bar.style.background = GM.T.a.c1; bar.parentNode.style.background = GM.T.h.c1;
    bar.parentNode.title = `Win probability: ${GM.T.h.abbr} ${Math.round(wp * 100)}%, ${GM.T.a.abbr} ${Math.round(100 - wp * 100)}%`;
  }
  function setClock(c) { const el = S && S.el.querySelector('#dygClock'); if (el && S.GM.q <= 4) el.textContent = DY.clockStr(Math.max(0, c)); }
  function showCaption(r) {
    const c = S.el.querySelector('#dygCap');
    const call = r.play ? `<span class="dyg-call">${esc(S.GM.T[r.s] ? S.GM.T[r.s].abbr : '')}: ${esc(r.form ? r.form + ' · ' : '')}${esc(r.play)}${r.cov ? ' vs ' + esc(r.cov) : ''}${r.pm > 0 ? ' <b class="dyg-good">✓</b>' : r.pm < 0 ? ' <b class="dyg-bad">✗</b>' : ''}</span>` : '';
    c.innerHTML = `${r.head ? `<div class="dyg-head">${esc(r.head)}</div>` : ''}<div class="dyg-text">${r.tag ? `<b class="dyg-tag">${esc(r.tag)}</b> ` : ''}${esc(r.text || '')}</div>${(r.events || []).length ? `<div class="dyg-ev">${r.events.map(esc).join(' ')}</div>` : ''}${call}`;
    if (r.tag && /TOUCHDOWN|PICK-SIX|INTERCEPTED|FUMBLE|SAFETY|BLOCKED|FIELD GOAL|NO GOOD|TURNOVER|HALFTIME|OVERTIME|FINAL|ONSIDE|MUFF|GOOD/.test(r.tag) && !isBars()) banner(r.tag, r.s);
  }
  function banner(tag, s) {
    const b = S.el.querySelector('#dygBanner'), t = S.GM.T[s] || S.GM.T.h;
    b.textContent = tag; b.style.setProperty('--bc', t.c1); b.style.setProperty('--bi', ink(t.c1));
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  }
  function pop(text, cls) {
    if (!S || !text) return;
    const p = S.el.querySelector('#dygPop'); p.textContent = text; p.className = 'dyg-pop ' + (cls || '');
    void p.offsetWidth; p.classList.add('on');
  }

  /* ---------- the play call ---------- */
  const RUNSUB = [['auto', 'Auto'], ['in', 'Inside'], ['out', 'Outside'], ['qb', 'QB run'], ['opt', 'Option']];
  const PASSSUB = [['auto', 'Auto'], ['quick', 'Quick'], ['med', 'Medium'], ['deep', 'Deep'], ['screen', 'Screen'], ['pa', 'Play action']];
  const OPT = ['Zone Read Keep', 'Speed Option', 'Triple Option', 'Midline Option'];
  const DESC = { auto: 'Your coordinator calls it: down, distance, the score, what the defense is showing and what has been working.', in: 'Between the tackles', out: 'Stretch it to the edge', qb: 'Draws, QB power, keepers', opt: 'Read the end: give, keep or pitch', quick: 'Out fast: beats the blitz', med: 'Needs a clean pocket', deep: 'A shot downfield', screen: 'Let them rush, throw behind them', pa: 'Best when they load the box' };
  function playList(kind) { return kind === 'opt' ? OPT : (DY.BOOK[kind] || []).map(b => b.n).filter(n => kind !== 'qb' || !OPT.includes(n)); }
  function renderPanel(need) {
    const GM = S.GM, el = S.el.querySelector('#dygCtrl'), sim = S.el.querySelector('#dygSim');
    if (GM.over) return;
    const us = GM.user, them = us === 'h' ? 'a' : 'h';
    sim.innerHTML = need === 'plan' ? '' : `<div class="dyg-sims"><span class="dyg-lab">Sim to</span>${[['drive', 'End of drive'], ['quarter', 'End of quarter'], ['half', 'End of half'], ['big', 'Big moment'], ['end', 'Final']].map(([k, l]) => `<button data-sim="${k}">${l}</button>`).join('')}</div>
      <div class="dyg-speed"><span class="dyg-lab">View</span><button data-speed="slow" aria-pressed="${S.speed === 'slow'}">Slow</button><button data-speed="fast" aria-pressed="${S.speed === 'fast'}">Fast</button>
      <button data-watch="1" aria-pressed="${GM.coach === 'watch'}" title="The CPU calls your plays too">Watch only</button>
      <button data-full="1" title="Full-screen field">⛶ Full screen</button>
      ${isBars() ? '<button data-watchone="1">Watch next play</button>' : ''}
      ${need === 'off' || need === 'def' || need === 'pat' || need === 'half' ? '' : `<button data-pause="1" class="${S.paused ? 'on' : ''}">${S.paused ? '▶ Resume' : '❚❚ Pause'}</button>`}</div>`;
    if (need === 'busy') { el.innerHTML = `<div class="dyg-wait">${S.lastRes && S.lastRes.play ? esc(S.lastRes.play) + '…' : '…'}</div>`; return; }
    const toBtn = GM.next === 'scrim' && GM.q <= 4 && GM.to[us] > 0 ? `<button class="dyg-chipb ${S.pendTO ? 'on' : ''}" data-to="1" ${GM.running ? '' : 'disabled title="The clock is stopped"'}>Timeout (${GM.to[us]})${S.pendTO ? ' ✓' : ''}</button>` : '';
    if (need === 'plan') { el.innerHTML = scoutHtml(GM); return; }
    if (need === 'half') { el.innerHTML = halfHtml(GM); return; }
    if (need === 'pat') {
      const k = DY.lineup(GM.T[us]).K[0], xp = Math.round(Math.min(99.5, 94.5 + ((k ? k.at.kac : 65) - 70) / 3));
      const forced = GM.ot && GM.ot.n >= 2;
      el.innerHTML = `<div class="dyg-call-h">Touchdown! The try</div><div class="dyg-grid2">${forced ? '' : `<button class="dyg-big" data-pat="xp">Kick the extra point<small>${xp}%</small></button>`}<button class="dyg-big" data-pat="2pt">Go for two<small>${forced ? 'required in 2OT+' : 'about 45%'}</small></button></div>
        <div class="dyg-2pt" hidden><div class="dyg-call-h">Two-point play</div><div class="dyg-chips"><button data-two="run">Run it in</button><button data-two="qb">QB keeper</button><button data-two="quick">Quick pass</button><button data-two="pa">Play action</button><button data-two="rpo">RPO</button></div></div>`;
      return;
    }
    if (need === 'def') { el.innerHTML = defHtml(GM, us, them, toBtn); return keepSnapVisible(); }
    if (need === 'off') { el.innerHTML = offHtml(GM, us, them, toBtn); return keepSnapVisible(); }
    el.innerHTML = `<div class="dyg-wait">${S.paused ? 'Paused.' : GM.poss === us ? 'Your offense (the CPU is calling it)…' : 'Defense on the field…'}</div><div class="dyg-extra">${S.paused ? '<button class="btn primary" data-next="1">Next play</button>' : ''}${toBtn}</div>`;
  }
  // the field is pinned at the top; make sure the SNAP button is on screen under it (phones)
  function keepSnapVisible() {
    const b = S.el.querySelector('.dyg-snap'); if (!b) return;
    const r = b.getBoundingClientRect(), vh = root.innerHeight || 800;
    if (r.bottom > vh - 8) root.scrollBy(0, r.bottom - vh + 16);
  }
  // the staff's call: the same logic the CPU uses (situation, tendencies, what is working), kept to the run or pass you asked for
  function staffCall(GM, tab) {
    for (let i = 0; i < 12; i++) { const c = DY.aiOff(GM, GM.user); if ((tab === 'run' && c.k === 'run') || (tab === 'pass' && c.k === 'pass')) return { k: c.k, t: c.t, dir: c.dir || autoDir(GM, c.t), play: c.play || null }; }
    return tab === 'run' ? { k: 'run', t: 'in', dir: autoDir(GM, 'in') } : { k: 'pass', t: GM.togo >= 8 ? 'med' : 'quick' };
  }
  // run direction: away from where the defense has been loading up, toward the wide side of the field on outside runs
  function autoDir(GM, sub) {
    const them = GM.user === 'h' ? 'a' : 'h', lean = GM.lastLean && GM.lastLean[them];
    const wide = (GM.by || 26.67) < 26.67 ? (GM.poss === 'h' ? 'R' : 'L') : (GM.poss === 'h' ? 'L' : 'R');
    if (sub === 'out' || sub === 'opt') return Math.random() < 0.65 ? wide : (wide === 'L' ? 'R' : 'L');
    const opts = ['L', 'M', 'R'].filter(d => d !== lean);
    return Math.random() < 0.45 ? 'M' : opts[Math.floor(Math.random() * opts.length)];
  }
  // RPO: against a loaded box the staff likes the quick-throw tags; against two-high, the inside run tags
  function staffRpo(GM) {
    const list = DY.BOOK.rpo.map(b => b.n), them = GM.user === 'h' ? 'a' : 'h', dt = GM.dtend[them] || {}, tot = Object.values(dt).reduce((a, b) => a + b, 0) || 1;
    const box = ((dt.run || 0) + (dt.bear || 0) + (dt.blitz || 0)) / tot;
    return box > 0.3 ? (Math.random() < 0.5 ? 'Slant RPO' : 'Bubble Read') : list[Math.floor(Math.random() * list.length)];
  }
  function tipFor(GM, us, them) {
    const dt = GM.dtend[them], dTot = Object.values(dt).reduce((a, b) => a + b, 0);
    let tip = '';
    if (dTot >= 6) { const box = ((dt.bear || 0) + (dt.c3b || 0) + (dt.gl || 0)) / dTot, bl = ((dt.blitz || 0)) / dTot, two = ((dt.c2 || 0) + (dt.t2 || 0) + (dt.c4 || 0) + (dt.c6 || 0)) / dTot, man = ((dt.c1 || 0) + (dt.c0 || 0) + (dt.c2m || 0)) / dTot;
      tip = bl > 0.3 ? 'They are blitzing a lot: screens, quick game, RPOs.' : box > 0.35 ? 'They are loading the box: play action and RPOs.' : two > 0.45 ? 'Two-high safeties: run it, or hit the middle.' : man > 0.4 ? 'Lots of man coverage: crossers (Mesh, Y-Cross) and the QB run.' : ''; }
    const lc = GM.lastCall[us]; if (lc.length >= 2 && lc[lc.length - 1] === lc[lc.length - 2]) tip = 'You called that twice in a row; they may be sitting on it.';
    if (GM.down === 4) { const dec = DY.fourthDown(GM, us); tip = `Analytics: ${dec === 'go' ? 'go for it' : dec === 'fg' ? 'kick the field goal' : 'punt'} (${Math.round(DY.convProb(GM, us, GM.togo) * 100)}% to convert).`; }
    return tip;
  }
  function offHtml(GM, us, them, toBtn) {
    const P = DY.lineup(GM.T[us]), k = P.K[0], dist = Math.round(100 - GM.ball + 17), fgp = Math.round(DY.fgProb(GM, k, dist) * 100);
    const tip = tipFor(GM, us, them);
    const late = (GM.q === 2 || GM.q === 4) && GM.clock <= 120;
    const tab = S.otab || (GM.down === 4 ? 'st' : 'run');
    const sub = S.osub[tab] || (tab === 'run' ? 'in' : tab === 'pass' ? 'quick' : null);
    const forms = Object.keys(DY.FORMS);
    let body = '';
    if (tab === 'run' || tab === 'pass') {
      const subs = tab === 'run' ? RUNSUB : PASSSUB, list = sub === 'auto' ? [] : playList(sub);
      const dirs = tab === 'run' && sub !== 'auto' ? (sub === 'out' || sub === 'opt' ? ['A', 'L', 'R'] : ['A', 'L', 'M', 'R']) : null;
      const dir = dirs && !dirs.includes(S.dir) ? 'A' : S.dir;
      body = `<div class="dyg-chips dyg-sub">${subs.map(([k2, l]) => `<button data-osub="${k2}" aria-pressed="${sub === k2}">${l}</button>`).join('')}</div>
        <div class="dyg-desc">${esc(DESC[sub] || '')}</div>
        <div class="dyg-row3">
          ${dirs ? `<div class="dyg-chips dyg-dir"><span class="dyg-lab">Direction</span>${dirs.map(d => `<button data-dir="${d}" aria-pressed="${dir === d}">${{ A: 'Auto', L: '◀ Left', M: 'Middle', R: 'Right ▶' }[d]}</button>`).join('')}</div>` : ''}
          ${sub === 'auto' ? '' : `<label class="dyg-sel"><span class="dyg-lab">Play</span><select data-pick="${sub}"><option value="">Auto (staff picks)</option>${list.map(n => `<option ${S.play[sub] === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`}
          <label class="dyg-sel"><span class="dyg-lab">Formation</span><select data-form="1"><option value="auto">Auto</option>${forms.map(f => `<option value="${f}" ${S.form === f ? 'selected' : ''}>${esc(DY.FORMS[f].name)}</option>`).join('')}</select></label>
        </div>
        <button class="dyg-snap" data-snap="${tab}">SNAP <small>${esc(sub === 'auto' ? (tab === 'run' ? 'Run: staff call' : 'Pass: staff call') : S.play[sub] || (tab === 'run' ? subs.find(x => x[0] === sub)[1] + ' run' : subs.find(x => x[0] === sub)[1] + ' pass'))}${dirs ? ' · ' + { A: 'auto direction', L: 'left', M: 'middle', R: 'right' }[dir] : ''}</small></button>`;
    } else if (tab === 'rpo') {
      const list = ['auto'].concat(DY.BOOK.rpo.map(b => b.n)), cur = S.osub.rpo || 'auto';
      body = `<div class="dyg-chips dyg-sub">${list.map(n => `<button data-orpo="${esc(n)}" aria-pressed="${cur === n}">${n === 'auto' ? 'Auto' : esc(n)}</button>`).join('')}</div>
        <div class="dyg-desc">The quarterback reads one defender: if he plays the run, throw it; if he drops, hand it off.</div>
        <button class="dyg-snap" data-snap="rpo">SNAP <small>${esc(cur === 'auto' ? 'RPO: staff call' : cur)}</small></button>`;
    } else {
      body = `<div class="dyg-grid4"><button class="dyg-big" data-sp="punt">Punt<small>${P.P[0] ? esc(DY.lastName(P.P[0])) : ''}</small></button><button class="dyg-big" data-sp="fg" ${dist > 68 ? 'disabled' : ''}>Field goal<small>${dist} yds · ${fgp}%</small></button><button class="dyg-big" data-sp="spike" ${GM.running && GM.down < 4 ? '' : 'disabled'}>Spike<small>stop the clock</small></button><button class="dyg-big" data-sp="kneel">Kneel<small>run clock</small></button></div>`;
    }
    return `<div class="dyg-call-h"><span>${esc(DY.downStr(GM.down, GM.togo, GM.ball))} at ${esc(DY.spotName(GM, GM.poss, GM.ball))}</span>${tip ? ` <span class="dyg-tip">${esc(tip)}</span>` : ''}</div>
      <div class="dyg-ctabs">${[['run', 'Run'], ['pass', 'Pass'], ['rpo', 'RPO'], ['st', 'Special teams']].map(([t, l]) => `<button data-otab="${t}" aria-selected="${tab === t}">${l}</button>`).join('')}</div>
      <div class="dyg-cbody">${body}</div>
      <div class="dyg-extra"><span class="dyg-lab">Tempo</span>${[['', 'Normal'], ['hurry', 'Hurry-up'], ['chew', 'Chew clock']].map(([k2, l]) => `<button class="dyg-chipb" data-tempo="${k2}" aria-pressed="${(S.tempo || '') === k2}">${l}</button>`).join('')}${toBtn}${late ? '<span class="dyg-tip">Two-minute drill: incompletions and the sideline stop the clock; first downs stop it inside 2:00.</span>' : ''}</div>`;
  }
  function defHtml(GM, us, them, toBtn) {
    const dt = GM.tend[them], early = Math.round(dt.e[1] / (dt.e[0] + dt.e[1]) * 100);
    const G = DY.DPKG[S.dg] || DY.DPKG.zone;
    const puntDown = GM.down === 4 && GM.togo >= 3 && GM.ball < 60;
    return `<div class="dyg-call-h"><span>Defense: ${esc(DY.downStr(GM.down, GM.togo, GM.ball))} at ${esc(DY.spotName(GM, GM.poss, GM.ball))}</span> <span class="dyg-tip">They pass ${early}% on early downs.</span></div>
      <div class="dyg-ctabs">${Object.entries(DY.DPKG).map(([k, d]) => `<button data-dg="${k}" aria-selected="${S.dg === k}">${esc(d.label)}</button>`).join('')}</div>
      <div class="dyg-cbody"><div class="dyg-chips dyg-sub"><button data-dk="auto" aria-pressed="${S.dk === 'auto'}">Auto</button>${G.items.map(it => `<button data-dk="${it.k}" aria-pressed="${S.dk === it.k}" title="${esc(it.note)}">${esc(it.name)}</button>`).join('')}</div>
      <div class="dyg-desc">${esc(S.dk === 'auto' ? 'Your coordinator picks the package for the down and distance.' : (G.items.find(i => i.k === S.dk) || {}).note || '')}</div>
      ${puntDown ? `<div class="dyg-chips"><span class="dyg-lab">If they punt</span><button data-dst="safe" aria-pressed="${S.dst === 'safe'}">Set up the return</button><button data-dst="block" aria-pressed="${S.dst === 'block'}">Rush the punt</button></div>` : ''}
      <button class="dyg-snap d" data-dsnap="1">SNAP <small>${esc(G.label)}${S.dk !== 'auto' ? ' · ' + esc((G.items.find(i => i.k === S.dk) || {}).name || '') : ''}</small></button></div>
      <div class="dyg-extra">${toBtn}</div>`;
  }
  // pre-game: the scouting report, your coordinator's suggestion and your game plan
  function scoutHtml(GM) {
    const us = GM.user, them = us === 'h' ? 'a' : 'h', o = GM.T[them], me = GM.T[us];
    const st = DY.STYLES[o.style] || DY.STYLES.spread, forms = Object.entries(st.forms).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => DY.FORMS[f].name);
    const L = DY.lineup(o), M = DY.lineup(me), best = o.roster.map(DY.P).sort((a, b) => b.ovr - a.ovr);
    const offStar = best.find(p => DY.SIDE(p.pos) === 'O' && p.pos !== 'OT' && p.pos !== 'IOL'), defStar = best.find(p => DY.SIDE(p.pos) === 'D');
    const A = GM.ovr[us], B = GM.ovr[them];
    const avgO = (arr, ks) => Math.round(arr.filter(Boolean).reduce((s, p) => s + ks.reduce((t, k) => t + (p.at[k] || p.ovr - 10), 0) / ks.length, 0) / Math.max(1, arr.filter(Boolean).length));
    const theirRunD = avgO([...L.DT.slice(0, 2), ...L.EDGE.slice(0, 2), ...L.LB.slice(0, 2)], ['bsh', 'tak', 'str']), theirPassD = avgO([...L.CB.slice(0, 2), ...L.S.slice(0, 2)], ['mcv', 'zcv', 'spd']);
    const myOL = avgO([...M.OT.slice(0, 2), ...M.IOL.slice(0, 3)], ['rbk', 'pbk', 'str']), myRush = avgO([...M.EDGE.slice(0, 2), ...M.DT.slice(0, 2)], ['pmv', 'fmv', 'spd']), theirOL = avgO([...L.OT.slice(0, 2), ...L.IOL.slice(0, 3)], ['pbk', 'rbk', 'str']);
    const theirAir = st.pass >= 0.52, myRunG = avgO([...M.RB.slice(0, 1)], ['bcv', 'btk', 'spd']);
    let pick = 'bal', why = 'No clear weakness: take what they give you.';
    if (theirRunD + 3 < theirPassD && myRunG >= 80) { pick = 'run'; why = `Their front (${theirRunD}) is softer than their secondary (${theirPassD}) and your backs can punish it.`; }
    else if (theirPassD + 3 < theirRunD) { pick = 'air'; why = `Their secondary (${theirPassD}) is the weak spot; their front is tougher (${theirRunD}).`; }
    if (myRush > theirOL + 4 && pick === 'bal') { pick = 'pressure'; why = `Your pass rush (${myRush}) should win against their line (${theirOL}).`; }
    if (theirAir && B.off > A.def + 2 && pick === 'bal') { pick = 'bend'; why = `They throw it a lot (${Math.round(st.pass * 100)}%) and their offense rates higher than your defense: keep it in front.`; }
    const edge = L.EDGE[0], myOT = M.OT[0];
    return `<div class="dyg-scout"><div class="dyg-step">Before kickoff: <b>pick your game plan</b> below to start the game.</div>
      <div class="dyg-call-h">Scouting report: ${esc(o.name)}${GM.ranks[them] ? ' (No. ' + GM.ranks[them] + ')' : ''}</div>
      <div class="dyg-sgrid">
        <div><div class="dyg-lab">Their offense</div><p><b>${esc(st.name)}</b>, passes about ${Math.round(st.pass * 100)}% of the time. Favorite looks: ${forms.map(esc).join(', ')}.</p><p>QB ${esc(L.QB[0].n)} (${L.QB[0].ovr}, ${esc(L.QB[0].arch)})${offStar && offStar !== L.QB[0] ? `. Weapon: ${esc(offStar.n)} (${offStar.pos}, ${offStar.ovr})` : ''}.</p></div>
        <div><div class="dyg-lab">Their defense</div><p>Front ${theirRunD} · secondary ${theirPassD}. Blitzes about ${Math.round(20 + (o.aggr != null ? o.aggr : 0.55) * 30)}% of the time. Best player: ${defStar ? esc(defStar.n) + ' (' + defStar.pos + ', ' + defStar.ovr + ')' : '—'}.</p>${edge && myOT ? `<p>Key matchup: ${esc(edge.n)} (${edge.ovr}) off the edge vs. your LT ${esc(myOT.n)} (${myOT.ovr}).</p>` : ''}</div>
        <div><div class="dyg-lab">Ratings</div><p>Your offense ${A.off} vs. their defense ${B.def}<br>Your defense ${A.def} vs. their offense ${B.off}${GM.crowd > 0.6 && us === 'a' ? '<br><b>Loud road crowd:</b> expect false starts.' : ''}</p></div>
      </div>
      <div class="dyg-call-h">Your game plan <span class="dyg-tip">Coordinator's pick: <b>${esc(DY.PLANS[pick].name)}</b>. ${esc(why)}</span></div>
      <div class="dyg-grid2">${Object.entries(DY.PLANS).map(([k, p]) => `<button class="dyg-big ${k === pick ? 'rec' : ''}" data-plan="${k}">${k === pick ? '<em>Coordinator\'s pick</em>' : ''}${esc(p.name)}<small>${esc(p.desc)}</small></button>`).join('')}</div></div>`;
  }
  function halfHtml(GM) {
    const us = GM.user, them = us === 'h' ? 'a' : 'h', T = GM.ts[us], O = GM.ts[them];
    const ypc = t => t.ra ? (t.ry / t.ra).toFixed(1) : '0.0', ypa = t => t.pa ? (t.py / t.pa).toFixed(1) : '0.0';
    const sug = DY.aiAdjust(GM, us);
    S.adj = S.adj || { o: sug.o, d: sug.d };
    return `<div class="dyg-scout"><div class="dyg-step">Halftime: <b>make your adjustments</b>, then start the second half.</div>
      <div class="dy-scroll"><table class="dyt dyg-half"><thead><tr><th></th><th>Rush (YPC)</th><th>Pass (YPA)</th><th>Sacks</th><th>3rd down</th></tr></thead><tbody>
      <tr><td><b>${esc(GM.T[us].abbr)}</b></td><td>${T.ry} (${ypc(T)})</td><td>${T.py} (${ypa(T)})</td><td>${T.sk} allowed</td><td>${T.c3}/${T.a3}</td></tr>
      <tr><td><b>${esc(GM.T[them].abbr)}</b></td><td>${O.ry} (${ypc(O)})</td><td>${O.py} (${ypa(O)})</td><td>${O.sk} allowed</td><td>${O.c3}/${O.a3}</td></tr></tbody></table></div>
      <div class="dyg-lab">Offense</div><div class="dyg-chips">${Object.entries(DY.ADJ_O).map(([k, a]) => `<button data-adjo="${k}" aria-pressed="${S.adj.o === k}">${esc(a.name)}${sug.o === k && k !== 'none' ? ' <small>staff pick</small>' : ''}</button>`).join('')}</div>
      <div class="dyg-lab">Defense</div><div class="dyg-chips">${Object.entries(DY.ADJ_D).map(([k, a]) => `<button data-adjd="${k}" aria-pressed="${S.adj.d === k}">${esc(a.name)}${sug.d === k && k !== 'none' ? ' <small>staff pick</small>' : ''}</button>`).join('')}</div>
      <div class="grow"><button class="btn primary big" data-half="1">Start the second half</button></div></div>`;
  }
  function bind() {
    S.el.addEventListener('change', e => {
      const t = e.target; if (!S) return;
      if (t.dataset.pick) { S.play[t.dataset.pick] = t.value || null; renderPanel(DY.needs(S.GM)); }
      if (t.dataset.form) { S.form = t.value; renderPanel(DY.needs(S.GM)); }
    });
    S.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !S) return;
      const GM = S.GM, d = b.dataset;
      if (d.tab) { S.tab = d.tab; S.el.querySelectorAll('.dyg-tabs button').forEach(x => x.setAttribute('aria-selected', x === b)); renderTab(); return; }
      if (S.busy && d.sim) { S.pendSim = d.sim; b.textContent = 'After this play…'; return; }
      if (d.pause) { S.paused = !S.paused; if (!S.busy) loop(); else renderPanel('busy'); return; }
      if (d.speed) { S.speed = d.speed; DY.G.settings.speed = S.speed; barsMode(); renderPanel(S.busy ? 'busy' : DY.needs(GM)); if (!S.busy) loop(); return; }
      if (d.watch) { GM.coach = GM.coach === 'watch' ? (DY.G.settings.coachMode === 'watch' ? 'offense' : DY.G.settings.coachMode) : 'watch'; if (GM.coach === 'watch') S.paused = false; barsMode(); if (!S.busy) loop(); return; }
      if (d.full) { toggleFull(true); return; }
      if (d.fullx) { toggleFull(false); return; }
      if (d.watchone) { S.watchOne = true; barsMode(); clearTimeout(S.timer); if (!S.busy) doStep({}); return; }
      if (S.busy) return;
      if (d.plan) return doStep({ plan: d.plan });
      if (d.adjo) { S.adj.o = d.adjo; return renderPanel('half'); }
      if (d.adjd) { S.adj.d = d.adjd; return renderPanel('half'); }
      if (d.half) { const a = S.adj; S.adj = null; return doStep({ adj: a }); }
      if (d.otab) { S.otab = d.otab; return renderPanel(DY.needs(GM)); }
      if (d.osub) { S.osub[S.otab || 'run'] = d.osub; return renderPanel(DY.needs(GM)); }
      if (d.orpo) { S.osub.rpo = d.orpo; return renderPanel(DY.needs(GM)); }
      if (d.dir) { S.dir = d.dir; return renderPanel(DY.needs(GM)); }
      if (d.tempo != null) { S.tempo = d.tempo || null; return renderPanel(DY.needs(GM)); }
      if (d.to) { if (!GM.running) return; S.pendTO = !S.pendTO; return renderPanel(DY.needs(GM)); }
      if (d.dg) { S.dg = d.dg; S.dk = 'auto'; return renderPanel(DY.needs(GM)); }
      if (d.dk) { S.dk = d.dk; return renderPanel(DY.needs(GM)); }
      if (d.dst) { S.dst = d.dst; return renderPanel(DY.needs(GM)); }
      if (d.next) { doStep({}); return; }
      if (d.sim) { const s0 = SIMS[d.sim]; simUntil(s0[0], s0[1]); return; }
      const call = { tempo: S.tempo, f: S.form === 'auto' ? null : S.form };
      if (d.snap) {
        const tab = d.snap;
        if (tab === 'rpo') { const n = S.osub.rpo && S.osub.rpo !== 'auto' ? S.osub.rpo : staffRpo(GM); Object.assign(call, { k: 'rpo', t: 'rpo', play: n, dir: S.dir === 'A' ? autoDir(GM, 'in') : S.dir }); return doStep({ call }); }
        const sub = S.osub[tab] || 'auto';
        if (sub === 'auto') { Object.assign(call, staffCall(GM, tab), { tempo: S.tempo || null, f: call.f }); return doStep({ call }); }
        if (tab === 'run') {
          const dirs = sub === 'out' || sub === 'opt' ? ['L', 'R'] : ['L', 'M', 'R'];
          const dir = S.dir === 'A' || !dirs.includes(S.dir) ? autoDir(GM, sub) : S.dir;
          if (sub === 'opt') Object.assign(call, { k: 'run', t: 'qb', dir, play: S.play.opt || OPT[Math.floor(Math.random() * OPT.length)] });
          else Object.assign(call, { k: 'run', t: sub, dir, play: S.play[sub] || null });
        } else Object.assign(call, { k: 'pass', t: sub, play: S.play[sub] || null });
        return doStep({ call });
      }
      if (d.sp) { Object.assign(call, { k: d.sp }); if (d.sp === 'kneel') call.tempo = 'chew'; S.otab = null; return doStep({ call }); }
      if (d.dsnap) return doStep({ dcall: { g: S.dg, k: S.dk === 'auto' ? null : S.dk, st: S.dst } });
      if (d.pat === 'xp') return doStep({ pat: 'xp' });
      if (d.pat === '2pt') { S.el.querySelector('.dyg-2pt').hidden = false; S.el.querySelectorAll('[data-pat]').forEach(x => x.disabled = true); return; }
      if (d.two) { GM.patCall = d.two === 'run' ? { k: 'run', t: 'in', dir: 'M' } : d.two === 'qb' ? { k: 'run', t: 'qb', dir: 'M' } : d.two === 'rpo' ? { k: 'rpo', t: 'rpo' } : { k: 'pass', t: d.two }; return doStep({ pat: '2pt' }); }
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
  const colOf = p => { const a = p.anim || {}; if (a.wiped || p.type === 'pen') return 'flag'; if (a.kind === 'sack') return 'neg'; if (p.turnover || (a.int)) return 'to'; if (a.kind === 'run') return (a.yards || 0) < 0 ? 'neg' : 'run'; if (a.kind === 'pass') return a.inc ? 'inc' : (a.yards || 0) < 0 ? 'neg' : 'pass'; if (a.kind === 'kick' || a.kind === 'punt') return 'st'; return 'st'; };
  // the drive chart: each drive on its own strip
  function driveChart(GM, lastN) {
    const by = {};
    GM.plays.forEach(p => { if (p.di == null || !p.anim || p.anim.los == null) return; (by[p.di] = by[p.di] || []).push(p); });
    let drives = GM.drives.map((d, i) => ({ d, i, plays: by[i] || [] })).filter(x => x.plays.length);
    if (lastN) drives = drives.slice(-lastN);
    return `<div class="dyg-chart">${drives.reverse().map(({ d, plays }) => {
      const t = GM.T[d.s];
      return `<div class="dyg-dr"><div class="dyg-drh"><b style="--tc:${t.c1}">${esc(t.abbr)}</b><span>Q${d.q <= 4 ? d.q : 'OT'} · ${plays.filter(p => p.anim.kind !== 'kick').length} plays · ${Math.round(d.yds || 0)} yds</span><em class="r-${(d.res || '').replace(/\W/g, '')}">${esc(d.res || 'In progress')}</em></div>
        <div class="dyg-strip"><i class="ez l"></i><i class="ez r"></i>${plays.map(p => { const a = p.anim; const from = Math.max(0, Math.min(100, a.los)), to = Math.max(0, Math.min(100, a.end == null ? a.los : a.end)); const l = Math.min(from, to), w = Math.max(0.8, Math.abs(to - from)); return `<span class="dyg-seg ${colOf(p)}" style="left:${l}%;width:${w}%" title="${esc(p.text)}"></span>`; }).join('')}</div></div>`;
    }).join('') || '<p class="dim">Drives show up here as they happen.</p>'}<div class="dyg-legend"><span class="run">Run</span><span class="pass">Pass</span><span class="inc">Incomplete</span><span class="neg">Loss / sack</span><span class="flag">Flag</span><span class="to">Turnover</span></div></div>`;
  }
  DYG.driveChart = driveChart;
  // watching on fast: the Madden/NCAA drive view — the whole field, a bar for every play of this drive, the play log
  function barsView(GM) {
    const di = GM.drives.length - 1, d = GM.drives[di];
    const plays = GM.plays.filter(p => p.di === di && p.anim && p.anim.los != null && p.anim.kind !== 'kick').slice(-14);
    const t = d ? GM.T[d.s] : GM.T[GM.poss], home = GM.T.h;
    const flip = d && d.s === 'a';   // the drive goes left to right on screen
    const xp = yd => (flip ? 100 - yd : yd);
    const rows = plays.map((p, i) => { const a = p.anim, f = xp(Math.max(0, Math.min(100, a.los))), e = xp(Math.max(0, Math.min(100, a.end == null ? a.los : a.end))); const l = Math.min(f, e), w = Math.max(0.9, Math.abs(e - f)); return `<span class="dyb-bar ${colOf(p)}" style="left:${10 + l * 0.8}%;width:${w * 0.8}%;top:${8 + i * (78 / Math.max(8, plays.length))}%" title="${esc(p.text)}"></span>`; }).join('');
    const los = GM.next === 'scrim' && GM.drive ? xp(GM.ball) : null;
    const log = GM.plays.slice(-7).reverse();
    return `<div class="dyb"><div class="dyb-field" style="--hc:${home.c1};--hi:${ink(home.c1)}">
        <div class="dyb-ez l"><span>${esc(home.name.toUpperCase())}</span></div><div class="dyb-ez r"><span>${esc(home.name.toUpperCase())}</span></div>
        ${[10, 20, 30, 40, 50, 60, 70, 80, 90].map(y => `<i class="dyb-yl" style="left:${10 + y * 0.8}%"><b>${y <= 50 ? y : 100 - y}</b></i>`).join('')}
        ${rows}${los != null ? `<i class="dyb-los" style="left:${10 + los * 0.8}%"></i>` : ''}
        <div class="dyb-legend"><span class="run">Run</span><span class="pass">Pass</span><span class="neg">Negative</span><span class="to">Turnover</span></div>
        <div class="dyb-drive"><b style="--tc:${t.c1}">${esc(t.abbr)}</b> drive · ${plays.length} plays · ${d ? Math.round(d.yds || 0) : 0} yds</div></div>
      <ol class="dyb-log">${log.map(p => `<li><span class="dyg-pt" style="--tc:${GM.T[p.s] ? GM.T[p.s].c1 : '#888'}">${GM.T[p.s] ? esc(GM.T[p.s].abbr) : ''}</span>${p.head ? `<small>${esc(p.head)}</small> ` : ''}${esc(p.text)}</li>`).join('')}</ol></div>`;
  }
  DYG.boxHtml = (T, ts, ls, ps) => {
    const n = id => { const p = DY.P(+id); return p ? esc(p.n) : '?'; };
    const lines = s => Object.entries(ps).filter(([id, l]) => l.t === T[s].id);
    const tbl = (s, title, cols, f, sort) => { const rs = lines(s).filter(([, l]) => f(l)).sort((a, b) => sort(b[1]) - sort(a[1])); if (!rs.length) return ''; return `<div class="dy-scroll"><table class="dyt"><thead><tr><th>${title}</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rs.map(([id, l]) => `<tr><td><a href="#" data-pid="${id}" class="dy-pl${T[s].user ? '' : ' o'}">${n(id)}</a></td>${cols.map(c => `<td>${c[1](l)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; };
    const v = (l, k) => l[k] || 0;
    const side = s => `<div class="dyg-boxside"><h4 style="color:${T[s].c1}">${esc(T[s].name)}</h4>
      ${tbl(s, 'Passing', [['C/A', l => v(l, 'pc') + '/' + v(l, 'pa')], ['Yds', l => v(l, 'py')], ['TD', l => v(l, 'ptd')], ['INT', l => v(l, 'pi')], ['Sk', l => v(l, 'sk')]], l => l.pa, l => v(l, 'pa'))}
      ${tbl(s, 'Rushing', [['Car', l => v(l, 'ra')], ['Yds', l => v(l, 'ry')], ['TD', l => v(l, 'rtd')], ['Lg', l => v(l, 'rlg')]], l => l.ra, l => v(l, 'ry'))}
      ${tbl(s, 'Receiving', [['Rec', l => v(l, 'rc')], ['Yds', l => v(l, 'rcy')], ['TD', l => v(l, 'rctd')], ['Tgt', l => v(l, 'tg')]], l => l.rc || l.tg, l => v(l, 'rcy'))}
      ${tbl(s, 'Defense', [['Tkl', l => v(l, 'tk')], ['TFL', l => v(l, 'tfl')], ['Sck', l => v(l, 'sck')], ['INT', l => v(l, 'int')], ['PD', l => v(l, 'pd')], ['FF', l => v(l, 'ff')]], l => l.tk || l.sck || l.int || l.pd, l => v(l, 'tk') + v(l, 'sck') * 2 + v(l, 'int') * 3)}
      ${tbl(s, 'Kicking', [['FG', l => v(l, 'fgm') + '/' + v(l, 'fga')], ['Lg', l => v(l, 'fglg')], ['XP', l => v(l, 'xpm') + '/' + v(l, 'xpa')]], l => l.fga || l.xpa, l => 1)}
      ${tbl(s, 'Punting', [['No', l => v(l, 'pn')], ['Avg', l => l.pn ? (l.pny / l.pn).toFixed(1) : '0'], ['In 20', l => v(l, 'i20')]], l => l.pn, l => 1)}
      ${tbl(s, 'Returns', [['KR', l => v(l, 'kr') + '-' + v(l, 'kry')], ['PR', l => v(l, 'pr') + '-' + v(l, 'pry')], ['TD', l => v(l, 'rttd')]], l => l.kr || l.pr, l => v(l, 'kry') + v(l, 'pry'))}</div>`;
    const q = ls ? `<div class="dy-scroll"><table class="dyt dyg-ls"><thead><tr><th></th>${ls.h.map((_, i) => `<th>${i < 4 ? i + 1 : 'OT'}</th>`).join('')}<th>T</th></tr></thead><tbody>${['a', 'h'].map(s => `<tr><td><b>${esc(T[s].abbr)}</b></td>${ls[s].map(x => `<td>${x || 0}</td>`).join('')}<td><b>${ls[s].reduce((a, b) => a + (b || 0), 0)}</b></td></tr>`).join('')}</tbody></table></div>` : '';
    const t = ts ? `<div class="dy-scroll"><table class="dyt"><thead><tr><th></th><th>${esc(T.a.abbr)}</th><th>${esc(T.h.abbr)}</th></tr></thead><tbody>${[['First downs', 'fd'], ['Total yards', 'yds'], ['Rushing', x => x.ra + '-' + x.ry], ['Passing', x => x.pc + '/' + x.pa + ', ' + x.py], ['3rd down', x => x.c3 + '/' + x.a3], ['4th down', x => x.c4 + '/' + x.a4], ['Turnovers', 'to'], ['Sacks allowed', 'sk'], ['Penalties', x => x.pen + '-' + x.peny], ['Possession', x => DY.clockStr(x.top)]].map(([l, k]) => `<tr><td>${l}</td><td>${typeof k === 'function' ? k(ts.a) : ts.a[k]}</td><td>${typeof k === 'function' ? k(ts.h) : ts.h[k]}</td></tr>`).join('')}</tbody></table></div>` : '';
    const grd = sd => { const rs = lines(sd).map(([id, l]) => ({ p: DY.P(+id), l })).filter(x => x.p && x.l.sn).map(x => Object.assign(x, { g: DY.gradeOf(x.l, x.p.pos) })).sort((a, b) => (b.g || 0) - (a.g || 0));
      if (!rs.length) return '';
      const cell = x => `<tr><td><a href="#" data-pid="${x.p.id}" class="dy-pl${T[sd].user ? '' : ' o'}">${esc(x.p.n)}</a> <small class="dim">${x.p.pos}</small></td><td>${x.l.sn}</td><td>${x.g == null ? '—' : `<span class="dy-grade ${DY.gradeCls(x.g)}">${x.g.toFixed(1)}</span>`}</td></tr>`;
      return `<div class="dy-scroll"><table class="dyt"><thead><tr><th>Index grades</th><th>Snaps</th><th>Grade</th></tr></thead><tbody>${rs.slice(0, 26).map(cell).join('')}</tbody></table></div>`; };
    const gsides = `<div class="dyg-boxsides"><div class="dyg-boxside"><h4 style="color:${T.a.c1}">${esc(T.a.name)}: snaps and grades</h4>${grd('a')}</div><div class="dyg-boxside"><h4 style="color:${T.h.c1}">${esc(T.h.name)}: snaps and grades</h4>${grd('h')}</div></div>`;
    return `<div class="dyg-box">${q}${t}<div class="dyg-boxsides">${side('a')}${side('h')}</div>${gsides}</div>`;
  };

  /* ---------- canvas: camera, field, players ---------- */
  function sizeCanvas() {
    const wrap = S.el.querySelector('.dyg-fieldwrap'), w = wrap.clientWidth || S.el.clientWidth || 360, dpr = Math.min(2, root.devicePixelRatio || 1);
    // a broadcast camera about 40 yards wide on a phone, 60 on a desktop
    const yards = w < 520 ? 40 : w < 900 ? 52 : 62;
    let ppy = Math.max(7, w / yards);
    const vw = Math.min(120, w / ppy); ppy = w / vw;
    const vh0 = root.innerHeight || 800;
    const full = !!S.el.querySelector('.dyg-full');
    const h = full ? Math.round(Math.min(53.33 * ppy * 1.0, Math.max(200, vh0 - (w < 520 ? 150 : 175)))) : Math.round(Math.min(53.33 * ppy, w < 520 ? Math.max(200, Math.min(vh0 * 0.31, w * 0.62)) : Math.max(260, Math.min(420, vh0 * 0.42))));
    S.vw = vw; S.vh = h / ppy; S.ppy = ppy; S.cw = w; S.ch = h;
    S.cv.width = Math.round(w * dpr); S.cv.height = Math.round(h * dpr); S.cv.style.height = h + 'px';
    S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    // the home team's end zones at both ends (a neutral site gets one for each team)
    if (GM.neutral) { endzone(0, GM.T.a); endzone(110, GM.T.h); } else { endzone(0, GM.T.h); endzone(110, GM.T.h, true); }
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(sx(0), sy(0), 120 * ppy, 53.33 * ppy);
    for (let x = 10; x <= 110; x += 5) { c.beginPath(); c.moveTo(sx(x), sy(0)); c.lineTo(sx(x), sy(53.33)); c.lineWidth = x === 10 || x === 110 ? 2.4 : x % 10 === 0 ? 1.5 : 1; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.75)';
    for (let x = 11; x < 110; x++) { if (x % 5 === 0) continue; [[0.4, 1.0], [19.6, 20.4], [32.9, 33.7], [52.3, 52.9]].forEach(([a, b]) => c.fillRect(sx(x) - 0.5, sy(a), 1, (b - a) * ppy)); }
    c.font = `700 ${Math.round(Math.max(11, ppy * 1.9))}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,.85)';
    for (let x = 20; x <= 100; x += 10) { const n = x <= 60 ? x - 10 : 110 - x; c.fillText(String(n), sx(x), sy(9)); c.save(); c.translate(sx(x), sy(44.3)); c.rotate(Math.PI); c.fillText(String(n), 0, 0); c.restore(); }
    // midfield: the home team's mark
    const h = GM.T.h;
    if (h.name === 'Tennessee') { c.save(); c.fillStyle = '#FF8200'; c.font = `900 ${Math.round(Math.max(14, ppy * 4.6))}px "Archivo", Arial, sans-serif`; c.globalAlpha = 0.9; c.fillText('T', sx(60), sy(26.67)); c.restore(); }
    else { c.save(); c.globalAlpha = 0.45; c.fillStyle = h.c1; c.beginPath(); c.arc(sx(60), sy(26.67), Math.max(9, ppy * 2.6), 0, Math.PI * 2); c.fill(); c.globalAlpha = 0.9; c.fillStyle = ink(h.c1); c.font = `900 ${Math.round(Math.max(9, ppy * 1.6))}px "Archivo", Arial, sans-serif`; c.fillText(h.abbr, sx(60), sy(26.67)); c.restore(); }
    c.strokeStyle = '#F2D600'; c.lineWidth = 3;
    [0.4, 119.6].forEach(x => { c.beginPath(); c.moveTo(sx(x), sy(23.6)); c.lineTo(sx(x), sy(29.7)); c.stroke(); });
  }
  function endzone(x0, t, second) {
    const c = S.ctx, ppy = S.ppy;
    if (t.name === 'Tennessee') {
      const s = 2.5;
      for (let i = 0; i < 4; i++) for (let j = 0; j < Math.ceil(53.33 / s); j++) { c.fillStyle = (i + j) % 2 ? '#FFFFFF' : '#FF8200'; c.fillRect(sx(x0 + i * s), sy(j * s), s * ppy + 0.5, s * ppy + 0.5); }
      return;
    }
    c.fillStyle = t.c1; c.fillRect(sx(x0), sy(0), 10 * ppy, 53.33 * ppy);
    c.save(); c.translate(sx(x0 + 5), sy(26.67)); c.rotate(x0 === 0 ? -Math.PI / 2 : Math.PI / 2);
    c.fillStyle = ink(t.c1); c.font = `900 ${Math.round(Math.max(10, ppy * 4.2))}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.92;
    const word = second && t.mascot ? t.mascot : t.name;
    c.fillText(word.toUpperCase().slice(0, 14), 0, 0); c.restore();
  }
  function drawLines(los, first) {
    const c = S.ctx;
    if (los != null) { c.strokeStyle = '#2F6BFF'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(sx(los), sy(0)); c.lineTo(sx(los), sy(53.33)); c.stroke(); }
    if (first != null && first > 10 && first < 110) { c.strokeStyle = '#F2D600'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(sx(first), sy(0)); c.lineTo(sx(first), sy(53.33)); c.stroke(); }
  }
  function dot(x, y, paint, num, hl, down, label) {
    const c = S.ctx, r = Math.max(4.4, S.ppy * 0.82);
    if (hl) { c.beginPath(); c.arc(sx(x), sy(y), r + 3.5, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill(); }
    c.beginPath(); c.arc(sx(x) + 1, sy(y) + 1.5, r, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,.25)'; c.fill();
    c.beginPath(); if (down) c.ellipse(sx(x), sy(y), r * 1.3, r * 0.68, 0.6, 0, Math.PI * 2); else c.arc(sx(x), sy(y), r, 0, Math.PI * 2);
    c.fillStyle = paint.fill; c.fill(); c.lineWidth = 1.7; c.strokeStyle = paint.stroke; c.stroke();
    if (num != null && num !== '' && r >= 5.5 && !down) { c.fillStyle = paint.num; c.font = `800 ${Math.round(r * 1.02)}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(num), sx(x), sy(y) + 0.5); }
    if (label) {
      c.font = `800 ${Math.round(Math.max(10, r * 1.15))}px "Archivo", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'top';
      const ty = sy(y) + r + 3, w = c.measureText(label).width + 8;
      c.fillStyle = 'rgba(20,20,20,.78)'; c.fillRect(sx(x) - w / 2, ty - 1, w, Math.max(13, r * 1.5));
      c.fillStyle = '#FFFFFF'; c.fillText(label, sx(x), ty + 1);
    }
  }
  function ballDot(x, y, z) {
    const c = S.ctx, k = S.ppy;
    if (z > 0.05) { c.beginPath(); c.ellipse(sx(x), sy(y), 0.45 * k, 0.25 * k, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill(); }
    const yy = sy(y) - z * k * 0.5, sc = 1 + z * 0.04;
    c.beginPath(); c.ellipse(sx(x), yy, Math.max(3.4, 0.55 * k * sc), Math.max(2.2, 0.34 * k * sc), 0, 0, Math.PI * 2); c.fillStyle = '#8B4513'; c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx(x) - 0.2 * k, yy); c.lineTo(sx(x) + 0.2 * k, yy); c.stroke();
  }
  function burst(x, y, u) {
    const c = S.ctx; c.save(); c.globalAlpha = Math.max(0, 1 - u); c.strokeStyle = '#FFFFFF'; c.lineWidth = 2;
    c.beginPath(); c.arc(sx(x), sy(y), S.ppy * (1.2 + u * 2.4), 0, Math.PI * 2); c.stroke(); c.restore();
  }
  function flagAt(x, y) { const c = S.ctx; c.fillStyle = '#F2D600'; c.beginPath(); c.arc(sx(x), sy(y), Math.max(3.8, S.ppy * 0.5), 0, Math.PI * 2); c.fill(); c.strokeStyle = '#141414'; c.lineWidth = 1; c.stroke(); }
  // the pre-snap picture: both teams lined up as the simulation will start the play
  function drawStatic() {
    if (!S) return;
    const GM = S.GM;
    if (isBars()) return;
    if (GM.over || GM.next !== 'scrim') { S.cam = camTo(S.cam || 60); drawField(); return; }
    const s = GM.poss, d = dirOf(s), los = X(s, GM.ball), first = GM.ball + GM.togo >= 100 ? null : X(s, GM.ball + GM.togo);
    S.cam = camTo(los + d * 8); S.camY = camYTo(GM.by || 26.67);
    drawField(); drawLines(los, first);
    const fk = S.form !== 'auto' && GM.user === s ? S.form : (S.lastForm && S.lastForm[s]) || Object.keys((GM.style[s] || DY.STYLES.spread).forms)[0];
    let al = null; try { al = DY.SIM.align(GM, s, fk, null); } catch (e) { al = null; }
    if (al) {
      const po = teamPaint(GM, s), pd = teamPaint(GM, s === 'h' ? 'a' : 'h');
      al.ag.forEach(a => dot(X(s, GM.ball + a.f), al.by + a.l * d, a.side === 'o' ? po : pd, a.p ? a.p.num : ''));
    }
    ballDot(los, GM.by || 26.67, 0);
  }

  /* ---------- playing a snap on the field ---------- */
  function play(r, pre, done) {
    const a = r.anim || { kind: 'none' };
    const trk = a.trk || (r.r && r.r.anim && r.r.anim.trk);
    if (a.f) { S.lastForm = S.lastForm || {}; S.lastForm[pre.poss] = a.f; }
    S.playClock = pre.next === 'scrim' && GM_running(pre) ? Math.max(1, Math.round(40 - (S.GM.lastRunoff || 25))) : null;
    renderBoard(pre);
    if (trk && trk.fr && trk.fr.length) return replay(r, pre, trk, done);
    return scripted(r, pre, done);
  }
  const GM_running = pre => pre.running;
  function replay(r, pre, trk, done) {
    const GM = S.GM, ret = !!trk.ret, a = r.anim || {};
    const s = trk.s, d = dirOf(s);
    const toXY = (f, l) => ret ? [X(s, f), 26.67 + l * d] : [X(s, trk.ball + f), trk.by + l * d];
    const po = teamPaint(GM, s), pd = teamPaint(GM, s === 'h' ? 'a' : 'h');
    const n = trk.ids.length;
    const paints = trk.ids.map(id => id[0] === 'o' ? po : pd);
    const names = trk.ids.map(id => { const p = id[3] ? DY.P(id[3]) : null; return p ? DY.lastName(p) : ''; });
    const fr = trk.fr, T = fr[fr.length - 1][0];
    // kicks: the ball in the air first, the coverage running down, the return team setting up
    const isPunt = ret && r.type !== 'kick';
    // a punt: the punt formation, the snap, the kick, then the ball in the air while the gunners run and the returner settles under it
    const snapT = isPunt ? 1.25 : 0, flightT = isPunt ? Math.max(2.2, Math.min(3.4, (trk.hang || 4) * 0.75)) : 0;
    const pre0 = ret ? (isPunt ? snapT + flightT : Math.max(1.6, trk.hang || 3)) : 0;
    let starts = null, kickFrom = null, losP = null;
    if (ret) {
      const f0 = fr[0][1];
      const kickYd = r.type === 'kick' ? 100 - ((a.from) || 35) : Math.min(99, 100 - pre.ball);
      kickFrom = toXY(r.type === 'kick' ? kickYd : kickYd + 14, 0);
      if (isPunt) {
        losP = toXY(kickYd, 0);
        const P_SPOT = [[14, 0], [0.5, -22], [0.5, 22], [0, 0], [0.4, -1.3], [0.4, 1.3], [0.5, -2.6], [0.5, 2.6], [1.4, -4.2], [1.4, 4.2], [5, 0]];
        const R_SPOT = [[-1.5, -20], [-1.5, 20], [-1, -5], [-1, -3], [-1, -1], [-1, 1], [-1, 3], [-1, 5], [-9, -6], [-9, 6]];
        let ki = 0, bi = 0;
        starts = trk.ids.map((id, i) => {
          if (id[0] === 'd') { const sp = P_SPOT[Math.min(P_SPOT.length - 1, ki++)]; return toXY(Math.min(99.5, kickYd + sp[0]), sp[1]); }
          if (id[1] === 'KR') return toXY(fr[0][2] - 2, 0);
          const sp = R_SPOT[Math.min(R_SPOT.length - 1, bi++)]; return toXY(Math.max(0.5, kickYd + sp[0]), sp[1]);
        });
      } else starts = trk.ids.map((id, i) => id[0] === 'd' ? toXY(Math.min(99, kickYd + 0.5 + (i % 3) * 0.6), f0[i * 2 + 1] * 0.95) : id[1] === 'KR' ? toXY(f0[i * 2] - 1, 0) : toXY(Math.min(99, f0[i * 2] + 12), f0[i * 2 + 1] * 0.8));
    }
    const lines = ret ? null : [X(s, pre.ball), pre.ball + pre.togo >= 100 ? null : X(s, pre.ball + pre.togo)];
    const pace = (S.speed === 'fast' ? 1.9 : 1) * (reduce() ? 1.5 : 1);
    const evs = (trk.ev || []).slice();
    const tk = trk.tk;
    const shakeT = (r.td || /PICK|INTERCEPT/.test(r.tag || '')) ? (evs.find(e => /INTERCEPTED/.test(e.text)) || { t: T - 0.6 }).t : null;
    const clock0 = pre.clock, clock1 = GM.clock, running = GM.q <= 4 && pre.next === 'scrim';
    const total = pre0 + T + 0.5;
    const t0 = performance.now(), fired = new Set();
    let shook = false;
    S.cam = camTo(ret ? (kickFrom ? kickFrom[0] : 60) : X(s, pre.ball) + d * 6);
    cancelAnimationFrame(S.raf);
    S.anim = true;
    const step = now => {
      if (!S) return;
      if (!document.body.contains(S.el)) return DYG.close();
      const sec = Math.max(0, (now - t0) / 1000 * pace);
      const ts = sec - pre0;     // time inside the tracked frames
      let bx, by, bz, holder = -1, pos;
      if (ret && ts < 0 && isPunt) {
        const land = toXY(fr[0][2], fr[0][3]), krI = trk.ids.findIndex(id => id[1] === 'KR');
        if (sec < snapT) {
          // the snap: everyone set, the ball goes back to the punter
          pos = starts.map(st => st.slice());
          const u = Math.min(1, sec / 0.35); bx = losP[0] + (kickFrom[0] - losP[0]) * u; by = losP[1]; bz = 0.6;
          holder = sec >= 0.35 ? 0 : -1;
        } else {
          const u = Math.max(0, Math.min(1, (sec - snapT) / flightT));
          pos = starts.map((st, i) => { const e = toXY(fr[0][1][i * 2], fr[0][1][i * 2 + 1]); const uu = trk.ids[i][1] === 'KR' ? Math.min(1, u * 1.4) : u; return [st[0] + (e[0] - st[0]) * uu, st[1] + (e[1] - st[1]) * uu]; });
          bx = kickFrom[0] + (land[0] - kickFrom[0]) * u; by = kickFrom[1] + (land[1] - kickFrom[1]) * u; bz = Math.sin(Math.PI * u) * 16;
          holder = -1;
        }
        var krLabel = krI;
      } else if (ret && ts < 0) {
        // kick pre-roll
        const u = Math.max(0, Math.min(1, sec / pre0)), land = toXY(fr[0][2], 0);
        pos = starts.map((st, i) => { const e = toXY(fr[0][1][i * 2], fr[0][1][i * 2 + 1]); return [st[0] + (e[0] - st[0]) * u, st[1] + (e[1] - st[1]) * u]; });
        bx = kickFrom[0] + (land[0] - kickFrom[0]) * u; by = kickFrom[1] + (land[1] - kickFrom[1]) * u; bz = Math.sin(Math.PI * u) * 14;
        var krLabel = trk.ids.findIndex(id => id[1] === 'KR');
      } else {
        const k = Math.min(fr.length - 2, Math.floor(ts / 0.1)), A0 = fr[Math.max(0, k)], B0 = fr[Math.min(fr.length - 1, k + 1)];
        const u = Math.max(0, Math.min(1, (ts - A0[0]) / Math.max(0.001, B0[0] - A0[0])));
        pos = new Array(n);
        for (let i = 0; i < n; i++) pos[i] = toXY(A0[1][i * 2] + (B0[1][i * 2] - A0[1][i * 2]) * u, A0[1][i * 2 + 1] + (B0[1][i * 2 + 1] - A0[1][i * 2 + 1]) * u);
        [bx, by] = toXY(A0[2] + (B0[2] - A0[2]) * u, A0[3] + (B0[3] - A0[3]) * u);
        bz = A0[4] + (B0[4] - A0[4]) * u; holder = A0[5];
        var downs = A0[6];
      }
      S.cam += (camTo(bx) - S.cam) * 0.08; S.camY += (camYTo(by) - S.camY) * 0.06;
      drawField();
      if (lines) drawLines(lines[0], lines[1]);
      const tkd = tk && ts >= tk.t;
      for (let i = 0; i < n; i++) {
        const isH = holder === i, dn = downs ? downs[i] === '1' || downs[i] === '3' : false;
        const lab = (isH || (ts < 0 && typeof krLabel !== 'undefined' && krLabel === i)) && names[i] ? names[i] : null;
        dot(pos[i][0], pos[i][1], paints[i], trk.ids[i][2], isH || (tkd && (tk.i === i || tk.a === i)) || lab != null, dn, lab);
      }
      if (trk.flag && ts >= trk.flag.t) { const fxy = toXY(trk.flag.x, trk.flag.y); flagAt(fxy[0], fxy[1]); }
      ballDot(bx, by, bz || 0);
      if (tkd) burst(bx, by, Math.min(1, (ts - tk.t) / 0.45));
      evs.forEach((e, i) => { if (!fired.has(i) && ts >= e.t) { fired.add(i); pop(e.text, e.cls); } });
      if (shakeT != null && !shook && ts >= shakeT) { shook = true; shake(2); }
      if (running && ts >= 0) setClock(clock0 - Math.min(clock0 - clock1, (clock0 - clock1) * Math.min(1, ts / Math.max(0.5, T))));
      if (sec < total) S.raf = requestAnimationFrame(step);
      else {
        S.anim = null;
        if (!ret && pre.next === 'scrim') endPop(r, pre);
        setTimeout(() => { if (S && !S.busy && !S.anim) drawStatic(); }, S.speed === 'fast' ? 200 : 650);
        setTimeout(done, S.speed === 'fast' ? 80 : 260);
      }
    };
    S.raf = requestAnimationFrame(step);
  }
  function endPop(r, pre) {
    const y = r.anim && r.anim.yards != null ? r.anim.yards : 0;
    if (r.anim && r.anim.wiped) return pop('PLAY WIPED OUT', 'flag');
    if (r.td) { pop('TOUCHDOWN', 'good'); return; }
    if (r.turnover && r.tag === 'FUMBLE') return pop('FUMBLE', 'bad');
    if (r.tag === 'TURNOVER ON DOWNS') return pop('TURNOVER ON DOWNS', 'bad');
    if (r.r && (r.r.kind === 'inc' || r.r.kind === 'int' || r.r.kind === 'dpi')) return;
    if (r.firstDown) return pop((y > 0 ? '+' + y + ' · ' : '') + 'FIRST DOWN', 'good');
    if (r.r && r.r.kind === 'sack') return pop('SACK ' + y, 'bad');
    pop(y > 0 ? '+' + y : y < 0 ? String(y) : 'NO GAIN', y > 0 ? 'good small' : 'meh');
  }
  // plays without tracking: kicks that are not returned, field goals, kneels, spikes, flags before the snap
  function scripted(r, pre, done) {
    const GM = S.GM, a = r.anim || { kind: 'none' }, kind = a.kind || 'none';
    if (kind === 'none') { S.anim = null; drawStatic(); return setTimeout(done, 200); }
    const s = r.type === 'kick' ? (pre.kicker || (r.s === 'h' ? 'a' : 'h')) : pre.poss, d = dirOf(s);
    const los = r.type === 'kick' ? X(s, a.from || 35) : X(s, pre.ball), by = pre.by || 26.67;
    let al = null; try { if (r.type !== 'kick' && kind !== 'punt') al = DY.SIM.align(GM, s, kind === 'fg' || kind === 'xp' ? 'goal' : 'ace12', null); } catch (e) { al = null; }
    if (kind === 'punt') {
      // the punt formation (and the return team, with the returner deep)
      const PS = [[14, 0], [0.5, -22], [0.5, 22], [0, 0], [0.4, -1.3], [0.4, 1.3], [0.5, -2.6], [0.5, 2.6], [1.4, -4.2], [1.4, 4.2], [5, 0]];
      const RS = [[-1.5, -20], [-1.5, 20], [-1, -5], [-1, -3], [-1, -1], [-1, 1], [-1, 3], [-1, 5], [-9, -6], [-9, 6]];
      const Lk = GM.L[s], Lr = GM.L[s === 'h' ? 'a' : 'h'], pr = Lr.PR || Lr.KR || (Lr.WR || [])[0];
      const ag = PS.map((sp, i) => ({ side: 'o', f: -sp[0], l: sp[1], p: i === 0 ? (Lk.P || [])[0] : null }));
      RS.forEach(sp => ag.push({ side: 'd', f: -sp[0], l: sp[1], p: null }));
      ag.push({ side: 'd', f: Math.min(100 - pre.ball, (a.land || pre.ball + 40) - pre.ball), l: 0, p: pr, ret: true });
      al = { ag, by: 26.67 };
    }
    const po = teamPaint(GM, s), pd = teamPaint(GM, s === 'h' ? 'a' : 'h');
    const pace = S.speed === 'fast' ? 1.9 : 1;
    let T = 1.2, ball;
    if (kind === 'kick' || kind === 'onside') {
      const land = a.tb ? X(s === 'h' ? 'a' : 'h', -4) : X(s === 'h' ? 'a' : 'h', Math.max(1, a.land || 20));
      T = kind === 'onside' ? 1.2 : 2.6; ball = u => [los + (land - los) * u, 26.67, Math.sin(Math.PI * u) * (kind === 'onside' ? 1.5 : 15)];
    } else if (kind === 'punt') {
      const land = X(s, Math.min(110, a.land || pre.ball + 40)); T = 3.2; ball = u => [los - d * 13 + (land - los + d * 13) * u, by, Math.sin(Math.PI * u) * 17];
    } else if (kind === 'fg' || kind === 'xp') {
      const post = X(s, 110), endx = a.ok ? post + d * 2 : post - d * 3; T = 1.6; ball = u => [los - d * 7 + (endx - los + d * 7) * u, by + (a.ok ? 0 : (Math.random() < 0.5 ? -1 : 1) * 4 * u), Math.sin(Math.PI * u * 0.7) * 9];
    } else { T = 1.0; ball = u => [los - d * 1.5 * u, by, 0.4]; }
    const t0 = performance.now(), evPopped = { v: false };
    S.cam = camTo(los + d * 10); S.anim = true;
    const step = now => {
      if (!S) return;
      const sec = Math.max(0, (now - t0) / 1000 * pace), u = Math.min(1, sec / T);
      const [bx, bY, bz] = ball(u);
      S.cam += (camTo(bx) - S.cam) * 0.08;
      drawField();
      if (r.type !== 'kick') drawLines(X(s, pre.ball), null);
      if (al) al.ag.forEach(p => dot(X(s, pre.ball + p.f + (p.ret ? 0 : (p.side === 'o' ? 0.2 : -0.2) * u)), al.by + p.l * d, p.side === 'o' ? po : pd, p.p ? p.p.num : '', !!p.ret, false, p.ret && p.p ? DY.lastName(p.p) : null));
      if (r.type === 'pen' && sec > 0.3) flagAt(X(s, pre.ball) - d, by - 3);
      ballDot(bx, bY, bz);
      if (!evPopped.v && u >= 0.95) { evPopped.v = true; const tx = kind === 'fg' || kind === 'xp' ? (a.blocked ? 'BLOCKED' : a.ok ? 'GOOD' : 'NO GOOD') : kind === 'kick' ? (a.tb ? 'TOUCHBACK' : a.fc ? 'FAIR CATCH' : '') : kind === 'punt' ? (a.fc ? 'FAIR CATCH' : '') : r.type === 'pen' ? 'FLAG' : kind === 'kneel' ? 'KNEEL' : kind === 'spike' ? 'SPIKE' : ''; pop(tx, kind === 'fg' || kind === 'xp' ? (a.ok ? 'good' : 'bad') : 'meh'); }
      if (sec < T + 0.4) S.raf = requestAnimationFrame(step);
      else { S.anim = null; setTimeout(() => { if (S && !S.busy && !S.anim) drawStatic(); }, 400); setTimeout(done, 120); }
    };
    S.raf = requestAnimationFrame(step);
  }
})(typeof window !== 'undefined' ? window : globalThis);
