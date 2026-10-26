/* The Vol Index — Hoops and Diamond Dynasty: the live game screen. A pinned scoreboard, the court (ten players and the
   ball, possession by possession) or the diamond (the pitch, the ball in play, fielders and runners), the play-by-play,
   the box score, and the coach's controls: pace, offense, defense, play calls and timeouts on the court; the call, the
   approach, pinch hitters, intentional walks and pitching changes on the diamond. Watch mode, two speeds, full screen. */
(function (root) {
  'use strict';
  const SD = root.SD;
  const SDG = root.SDG = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const other = s => s === 'h' ? 'a' : 'h';
  const last = p => SD.H ? SD.H.last(p) : (p ? p.n : '');
  let S = null;
  SDG.live = () => !!(S && !S.done);

  /* ---------- colors ---------- */
  const hex = c => { c = String(c || '#888').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = c => { const [r, g, b] = hex(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ink = c => lum(c) > 0.42 ? '#141414' : '#ffffff';
  const dist = (a, b) => { const x = hex(a), y = hex(b); return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2); };
  function teamColors(H, A) {
    const h = H.c1 || '#FF8200'; let a = A.c1 || '#444';
    if (dist(h, a) < 90) a = A.c2 && dist(h, A.c2) >= 90 ? A.c2 : (lum(h) > 0.4 ? '#1d2733' : '#f4f4f4');
    return { h, a };
  }

  /* ---------- open / leave ---------- */
  SDG.open = (el, x, o) => {
    const g = SD.G, side = x.h === g.user ? 'h' : 'a', watch = g.settings.coachMode === 'watch';
    const GM = SD.startGame(x, true);
    if (watch) GM.user = null;
    if (GM.kind === 'hoops') GM.firstPoss = GM.poss;
    S = { el, x, GM, side, watch, hoops: GM.kind === 'hoops', speed: g.settings.speed || 'slow', paused: false, tab: 'pbp', uc: {}, onDone: o.onDone, done: false, timer: null, raf: null, anim: null, col: teamColors(GM.T.h, GM.T.a), simTo: null, pbp: [] };
    if (!S.hoops) { S.prevBases = [null, null, null]; S.uc.approach = 'normal'; }
    shell(); drawIdle(); updateBoard(); controls(); panel();
    S.timer = setTimeout(next, 900);
  };
  SDG.leave = () => { if (!S) return; if (!S.done) { stop(); finishSim(); bank(); } const cb = S.onDone; exitFull(); S = null; if (cb) cb(); };
  function stop() { clearTimeout(S.timer); cancelAnimationFrame(S.raf); S.timer = null; S.raf = null; }
  function finishSim() { const GM = S.GM; let n = 0; while (!GM.over && n++ < 900) step(true); if (S.hoops) SD.H.finalize(GM); }
  function bank() { if (S.banked) return; S.banked = true; S.done = true; SD.bankGame(S.x, S.GM); }

  /* ---------- the screen ---------- */
  function shell() {
    const GM = S.GM, H = GM.T.h, A = GM.T.a;
    S.el.innerHTML = `<div class="dyg sdg ${S.hoops ? 'hoops' : 'diamond'}">
      <div class="dyg-stick">
        <div class="dyg-board" id="sdgBoard"></div>
        <div class="dyg-fieldwrap sdg-fieldwrap"><canvas id="sdgCv"></canvas><div class="dyg-banner" id="sdgBan"></div></div>
        <div class="dyg-cap" id="sdgCap"><div class="dyg-head">${esc(GM.title || (GM.neutral ? 'Neutral site' : H.name))}</div><div class="dyg-text">${esc(A.name)} at ${esc(H.name)}. ${S.hoops ? 'Tip-off is coming up.' : 'First pitch is coming up.'}</div></div>
        <div class="dyg-fullbar"><button data-g="pause">Pause</button><button data-g="speed">Speed</button><button data-g="full">Exit full screen</button></div>
      </div>
      <div class="box dyg-ctrl" id="sdgCtrl"></div>
      <div class="dyg-tabs" role="tablist"><button data-gtab="pbp" aria-selected="true">Play-by-play</button><button data-gtab="box" aria-selected="false">Box score</button>${S.hoops ? '<button data-gtab="floor" aria-selected="false">On the floor</button>' : ''}</div>
      <div class="dyg-panel" id="sdgPanel"></div></div>`;
    S.cv = S.el.querySelector('#sdgCv');
    S.el.onclick = onClick; S.el.onchange = onChange;
    sizeCanvas();
    if (!SDG._rs) { SDG._rs = true; root.addEventListener('resize', () => { if (S && S.cv) { sizeCanvas(); if (!S.anim) drawIdle(); } }); document.addEventListener('fullscreenchange', () => { if (S && !document.fullscreenElement && S.full) toggleFull(false); }); }
  }
  function sizeCanvas() {
    const cv = S.cv, w = cv.parentNode.clientWidth || 600, ratio = S.hoops ? 50 / 94 : 0.78;
    let h = Math.round(w * ratio);
    if (S.full) { const avail = root.innerHeight - 190; if (h > avail) h = Math.max(200, avail); }
    else { const cap = Math.round(root.innerHeight * (S.hoops ? 0.6 : 0.52)); if (h > cap) h = Math.max(220, cap); }
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    S.W = w; S.Hh = h; S.dpr = dpr;
  }

  /* ---------- the scoreboard ---------- */
  function updateBoard() {
    const GM = S.GM, b = S.el.querySelector('#sdgBoard'); if (!b) return;
    const team = s => {
      const t = GM.T[s], rk = SD.apRank(t.id), c = S.col[s];
      const poss = S.hoops ? (GM.poss === s && !GM.over ? '<span class="dyg-poss">●</span>' : '') : (!GM.over && SD.B.batting(GM) === s ? '<span class="dyg-poss">●</span>' : '');
      const extra = S.hoops ? `<div class="dyg-to" title="Timeouts">${[0, 1, 2, 3].map(i => `<i class="${i < GM.to[s] ? 'on' : ''}"></i>`).join('')}</div>`
        : `<div class="dyg-to sdg-he"><small>H ${hitsOf(s)} · E ${GM.err[s]}</small></div>`;
      return `<div class="dyg-team ${s}" style="--tc:${c};--ti:${ink(c)}"><div class="dyg-tn"><span class="dyg-chip">${esc(t.abbr)}</span><span class="dyg-name">${rk ? `<small>${rk}</small> ` : ''}${esc(t.name)}</span>${poss}</div><div class="dyg-sc">${GM.score[s]}</div>${extra}</div>`;
    };
    let mid;
    if (S.hoops) {
      const p = GM.per, np = GM.nper, lbl = GM.over ? 'Final' + (GM.ot ? (GM.ot > 1 ? ` (${GM.ot}OT)` : ' (OT)') : '') : p > np ? (p - np > 1 ? (p - np) + 'OT' : 'OT') : np === 2 ? (p === 1 ? '1st half' : '2nd half') : 'Q' + p;
      const bonusD = s => { const f = GM.tf[other(s)]; return GM.women ? f >= 5 : f >= 7; };
      mid = `<div class="dyg-mid"><div class="dyg-q">${lbl}</div><div class="dyg-clock">${GM.over ? '' : clock(GM.clock)}</div><div class="dyg-situ">${GM.over ? '' : ['a', 'h'].filter(bonusD).map(s => GM.T[s].abbr + ' in the bonus').join(' · ')}</div></div>`;
    } else {
      const lbl = GM.over ? 'Final' + (GM.inn !== GM.maxInn && !GM.mercy ? ` (${GM.inn})` : GM.inn > GM.maxInn || GM.inn < GM.maxInn ? ` (${GM.inn})` : '') : (GM.top ? 'Top ' : 'Bot ') + ord(GM.inn);
      const bs = GM.bases;
      mid = `<div class="dyg-mid"><div class="dyg-q">${lbl}</div>${GM.over ? '' : `<svg class="sdg-bases" viewBox="0 0 40 26" aria-label="Runners"><rect x="16" y="2" width="8" height="8" transform="rotate(45 20 6)" class="${bs[1] ? 'on' : ''}"/><rect x="27" y="12" width="8" height="8" transform="rotate(45 31 16)" class="${bs[0] ? 'on' : ''}"/><rect x="5" y="12" width="8" height="8" transform="rotate(45 9 16)" class="${bs[2] ? 'on' : ''}"/></svg><div class="dyg-situ">${[0, 1].map(i => `<i class="sdg-out ${i < GM.outs ? 'on' : ''}"></i>`).join('')} ${GM.outs} out${GM.outs === 1 ? '' : 's'}</div>`}</div>`;
    }
    b.innerHTML = team('a') + mid + team('h');
  }
  const clock = t => { t = Math.max(0, t); if (t < 60) return t.toFixed(1); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); };
  const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th');
  const hitsOf = s => { const GM = S.GM; let h = 0; for (const id in GM.ps) if (GM.ps[id].t === GM.T[s].id) h += GM.ps[id].h || 0; return h; };

  /* ---------- the loop ---------- */
  function step(quiet) {
    const GM = S.GM, uc = {};
    if (S.hoops) {
      if (S.uc.timeout) { uc.timeout = true; S.uc.timeout = false; }
      if (S.uc.call && GM.poss === S.side) { uc.call = S.uc.call; S.uc.call = null; }
      const r = SD.H.step(GM, quiet ? {} : uc);
      return r;
    }
    const bat = SD.B.batting(GM);
    uc.autoPitch = SD.G.settings.autoPen !== false;
    if (!quiet && GM.user) {
      if (bat === S.side) { uc.call = S.uc.call || 'auto'; uc.approach = S.uc.approach; if (S.uc.pinch) uc.pinch = S.uc.pinch; }
      else { if (S.uc.ibb) uc.call = 'ibb'; if (S.uc.pitcher) uc.pitcher = S.uc.pitcher; }
    }
    if (quiet) uc.autoPitch = true;
    S.prevBases = GM.bases.slice();
    const r = SD.B.step(GM, uc);
    if (!quiet && r) { if (r.kind === 'sub') { S.uc.pinch = null; S.uc.pitcher = null; } else { S.uc.call = null; S.uc.ibb = false; } }
    return r;
  }
  function next() {
    if (!S || S.done) return;
    S.timer = null;
    if (S.paused) return;
    const GM = S.GM;
    if (GM.over) return end();
    const pre = S.hoops ? null : { bases: GM.bases.slice(), fld: S.GM.L[GM.top ? 'h' : 'a'] && Object.assign({}, S.GM.L[GM.top ? 'h' : 'a'].field) };
    const r = step(false);
    if (!r) return end();
    log(r);
    // simming ahead: no animation until the target
    if (S.simTo && !S.simTo()) { S.timer = setTimeout(next, 0); if (S.pbpDirty++ % 20 === 0) { updateBoard(); } return; }
    if (S.simTo) { S.simTo = null; updateBoard(); controls(); panel(); }
    animate(r, pre, () => {
      updateBoard(); caption(r); panel(); controls();
      if (GM.over) return end();
      const pause = S.hoops ? (r.endPer ? 1800 : r.kind === 'to' ? 1200 : 350) : (r.endHalf ? 1600 : 450);
      S.timer = setTimeout(next, S.speed === 'fast' ? pause * 0.35 : pause);
    });
  }
  function log(r) {
    const GM = S.GM;
    const tag = S.hoops ? (r.per > GM.nper ? 'OT' : (GM.nper === 2 ? 'H' : 'Q') + r.per) : (r.top ? '▲' : '▼') + r.inn;
    const tm = S.hoops ? clock(Math.max(0, r.clock - (r.time || 0))) : (r.outs != null ? r.outs + ' out' : '');
    S.pbp.unshift({ tag, tm, s: r.s, text: r.text, big: !!r.big, pts: r.pts || 0, sc: r.score ? `${r.score.a}-${r.score.h}` : '' });
    if (S.pbp.length > 600) S.pbp.pop();
    if (r.endPer && S.hoops && !GM.over) S.pbp.unshift({ tag: '', tm: '', s: null, text: `End of the ${GM.nper === 2 ? (r.per === 1 ? 'first half' : r.per === 2 ? 'second half' : 'overtime') : r.per <= 4 ? ord(r.per) + ' quarter' : 'overtime'}: ${GM.T.a.abbr} ${GM.score.a}, ${GM.T.h.abbr} ${GM.score.h}.`, big: true, pts: 0 });
    if (r.endHalf && !S.hoops && !GM.over) S.pbp.unshift({ tag: '', tm: '', s: null, text: `${r.top ? 'Middle' : 'End'} of the ${ord(r.inn)}: ${GM.T.a.abbr} ${GM.score.a}, ${GM.T.h.abbr} ${GM.score.h}.`, big: true, pts: 0 });
  }
  function caption(r) {
    const GM = S.GM, c = S.el.querySelector('#sdgCap'); if (!c) return;
    let head;
    if (S.hoops) head = `${GM.T[r.s].abbr} ball · ${(r.per > GM.nper ? 'OT' : (GM.nper === 2 ? 'H' : 'Q') + r.per)} ${clock(Math.max(0, r.clock - (r.time || 0)))}`;
    else head = `${(r.top ? 'Top ' : 'Bot ') + ord(r.inn)} · ${r.pit ? 'Pitching: ' + esc(r.pit.n) + ` (${(GM.L[r.top ? 'h' : 'a'].pc[r.pit.id] || 0)} pitches)` : ''}`;
    c.innerHTML = `<div class="dyg-head">${head}${r.big ? ' <span class="dyg-tag">BIG</span>' : ''}</div><div class="dyg-text">${esc(r.text)}</div>${!S.hoops && !GM.over ? `<div class="dyg-ev">Up next: ${esc(SD.B.batter(GM).n)} (${esc(SD.B.batter(GM).pos)}, ${SD.B.batter(GM).ovr})</div>` : ''}`;
  }
  function banner(txt, c) { const b = S.el.querySelector('#sdgBan'); if (!b) return; b.textContent = txt; b.style.setProperty('--bc', c); b.style.setProperty('--bi', ink(c)); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
  function end() {
    if (!S || S.done && S.ended) return;
    stop(); bank(); S.ended = true;
    const GM = S.GM, g = SD.G, won = GM.score[S.side] > GM.score[other(S.side)];
    updateBoard(); panel();
    const ctrl = S.el.querySelector('#sdgCtrl');
    ctrl.innerHTML = `<div class="dyg-final"><b>${won ? 'Tennessee wins' : 'Tennessee loses'}</b>, ${GM.score[S.side]}-${GM.score[other(S.side)]}${S.hoops ? (GM.ot ? ' in ' + (GM.ot > 1 ? GM.ot + 'OT' : 'overtime') : '') : (GM.inn !== GM.maxInn ? ` (${GM.inn} innings)` : '')}.${topPerf()}<div class="grow" style="margin-top:10px"><button class="btn primary big" data-g="done">Continue</button></div></div>`;
    if (won) banner(S.hoops ? 'VOLS WIN' : 'VOLS WIN', '#FF8200');
    S.tab = 'box'; tabs(); panel();
  }
  function topPerf() {
    const GM = S.GM, me = GM.T[S.side].id;
    const ls = Object.entries(GM.ps).filter(([, l]) => l.t === me);
    if (S.hoops) { const b = ls.sort((a, b) => b[1].pts - a[1].pts)[0]; if (!b) return ''; const p = SD.P(+b[0]), l = b[1]; return ` Top scorer: ${esc(p.n)}, ${l.pts} points, ${l.orb + l.drb} rebounds, ${l.ast} assists.`; }
    const h = ls.sort((a, b) => (b[1].h * 2 + b[1].rbi + b[1].hr * 2) - (a[1].h * 2 + a[1].rbi + a[1].hr * 2))[0];
    return h ? ` Top bat: ${esc(SD.P(+h[0]).n)}, ${h[1].h} for ${h[1].ab}${h[1].hr ? `, ${h[1].hr} HR` : ''}${h[1].rbi ? `, ${h[1].rbi} RBI` : ''}.` : '';
  }

  /* ---------- controls ---------- */
  function controls() {
    const ctrl = S.el.querySelector('#sdgCtrl'); if (!ctrl || S.ended) return;
    const GM = S.GM, g = SD.G;
    const sims = `<div class="dyg-simbar"><div class="dyg-speed"><span class="dyg-lab">Speed</span><button data-g="slow" aria-pressed="${S.speed === 'slow'}">Slow</button><button data-g="fast" aria-pressed="${S.speed === 'fast'}">Fast</button></div>
      <div class="dyg-sims"><button data-g="pause">${S.paused ? 'Resume' : 'Pause'}</button>${S.hoops ? '<button data-g="simper">Sim to the end of the period</button>' : '<button data-g="siminn">Sim to the next inning</button>'}<button data-g="simend">Sim to the end</button><button data-g="full">Full screen</button></div></div>`;
    if (S.watch) { return setCtrl(ctrl, `<div class="dyg-call-h">Watching${S.paused ? ' (paused)' : ''}</div><p class="small dim">Your staff runs the game. Switch to "I coach" in Settings to call it yourself.</p>`, sims); }
    if (S.hoops) {
      const c = GM.coach[S.side];
      const seg = (k, opts) => `<div class="dyg-extra"><span class="dyg-lab">${opts.label}</span>${opts.o.map(([v, l]) => `<button data-coach="${k}|${v}" aria-pressed="${String(c[k]) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
      const calls = [['auto', 'Staff call'], ['pnr', 'Pick-and-roll'], ['drive', 'Drive'], ['post', 'Post up'], ['spot', 'Spot-up three'], ['iso', 'Isolation'], ['cut', 'Backdoor cut']];
      return setCtrl(ctrl, `<div class="dyg-call-h">Coach ${esc(g.coach.name)}${S.paused ? ' (paused)' : ''}</div>
        <div class="dyg-extra"><span class="dyg-lab">Next trip</span>${calls.map(([v, l]) => `<button data-call="${v}" aria-pressed="${(S.uc.call || 'auto') === v}">${l}</button>`).join('')}</div>
        ${seg('pace', { label: 'Pace', o: [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Push']] })}
        ${seg('focus', { label: 'Offense', o: [['bal', 'Balanced'], ['rim', 'Attack the rim'], ['three', 'Threes'], ['post', 'Post'], ['star', 'Ride the star']] })}
        ${seg('def', { label: 'Defense', o: [['man', 'Man'], ['zone', '2-3 zone'], ['press', 'Press']] })}
        <div class="dyg-extra"><span class="dyg-lab">Late</span><button data-coach="endFoul|${c.endFoul === false ? 'true' : 'false'}" aria-pressed="${c.endFoul !== false}">Foul when trailing late</button>
          <button class="dyg-to-btn ${S.uc.timeout ? 'on' : ''}" data-g="timeout" ${GM.to[S.side] > 0 ? '' : 'disabled'}>Timeout (${GM.to[S.side]} left)</button></div>`, sims);
      return;
    }
    const bat = SD.B.batting(GM), mine = bat === S.side, L = GM.L[S.side];
    if (mine) {
      const b = SD.B.batter(GM), bench = L.bench.map(SD.P).filter(Boolean);
      const calls = [['auto', 'Staff call'], ['swing', 'Swing away'], ['steal', 'Steal'], ['bunt', 'Sacrifice bunt'], ['hr', 'Hit-and-run']];
      const can = v => v === 'steal' ? (GM.bases[0] && !GM.bases[1]) || (GM.bases[1] && !GM.bases[2]) : v === 'bunt' ? GM.outs < 2 && (GM.bases[0] || GM.bases[1]) : v === 'hr' ? !!GM.bases[0] : true;
      return setCtrl(ctrl, `<div class="dyg-call-h">At the plate: ${esc(b.n)} <small class="dim">${b.pos} · ${b.ovr} · contact ${b.at.con}, power ${b.at.pow}, eye ${b.at.eye}, speed ${b.at.spd}</small></div>
        <div class="dyg-extra"><span class="dyg-lab">The call</span>${calls.map(([v, l]) => `<button data-call="${v}" aria-pressed="${(S.uc.call || 'auto') === v}" ${can(v) ? '' : 'disabled'}>${l}</button>`).join('')}</div>
        <div class="dyg-extra"><span class="dyg-lab">Approach</span>${[['normal', 'Normal'], ['patient', 'Patient'], ['aggressive', 'Aggressive']].map(([v, l]) => `<button data-appr="${v}" aria-pressed="${S.uc.approach === v}">${l}</button>`).join('')}</div>
        ${bench.length ? `<div class="dyg-extra"><span class="dyg-lab">Pinch hit</span><select data-pinch="1"><option value="">${S.uc.pinch ? 'Cancel' : 'Bench…'}</option>${bench.map(p => `<option value="${p.id}" ${S.uc.pinch === p.id ? 'selected' : ''}>${esc(p.n)} (${p.pos}, ${p.ovr})</option>`).join('')}</select></div>` : ''}`, sims);
    } else {
      const p = SD.B.pitcher(GM), pc = L.pc[p.id] || 0, f = SD.B.fatigue(GM), pen = L.pen.filter(id => !L.used.includes(id)).map(SD.P).filter(Boolean);
      const b = SD.B.batter(GM);
      return setCtrl(ctrl, `<div class="dyg-call-h">In the field: ${esc(p.n)} pitching <small class="dim">${pc} pitches · ${f < 0.15 ? 'fresh' : f < 0.5 ? 'tiring' : 'gassed'}</small></div>
        <p class="small dim">Batting: ${esc(b.n)} (${b.pos}, ${b.ovr}).</p>
        <div class="dyg-extra"><span class="dyg-lab">This batter</span><button data-g="ibb" aria-pressed="${!!S.uc.ibb}">Intentional walk</button></div>
        <div class="dyg-extra"><span class="dyg-lab">Bullpen</span>${pen.length ? `<select data-pitch="1"><option value="">${S.uc.pitcher ? 'Cancel' : 'Bring in…'}</option>${pen.map(q => `<option value="${q.id}" ${S.uc.pitcher === q.id ? 'selected' : ''}>${esc(q.n)} (${q.pos}, ${q.ovr}${q.rest > 0 ? ', tired' : ''})</option>`).join('')}</select>` : '<small class="dim">Nobody left.</small>'}
          <button data-g="autopen" aria-pressed="${g.settings.autoPen !== false}">Staff handles the bullpen</button></div>`, sims);
    }
  }
  function setCtrl(ctrl, main, sims) {
    if (!ctrl.querySelector('#sdgCall')) ctrl.innerHTML = '<div id="sdgCall"></div><div id="sdgSims"></div>';
    const a = ctrl.querySelector('#sdgCall'), b = ctrl.querySelector('#sdgSims');
    const focusSel = document.activeElement && document.activeElement.tagName === 'SELECT' && a.contains(document.activeElement);
    if (a._h !== main && !focusSel) { a.innerHTML = main; a._h = main; }
    if (b._h !== sims) { b.innerHTML = sims; b._h = sims; }
  }
  function onClick(e) {
    const el = e.target.closest('[data-g],[data-gtab],[data-call],[data-coach],[data-appr],[data-pid]'); if (!el) return;
    const d = el.dataset, GM = S.GM;
    if (d.pid) return; // the hub opens player cards
    if (d.gtab) { S.tab = d.gtab; tabs(); return panel(); }
    if (d.call) { S.uc.call = d.call === 'auto' ? null : d.call; return controls(); }
    if (d.appr) { S.uc.approach = d.appr; return controls(); }
    if (d.coach) { const [k, v] = d.coach.split('|'); GM.coach[S.side][k] = v === 'true' ? true : v === 'false' ? false : v; return controls(); }
    const g = d.g;
    if (g === 'done') { const cb = S.onDone; exitFull(); S = null; return cb && cb(); }
    if (g === 'slow' || g === 'fast') { S.speed = g; SD.G.settings.speed = g; return controls(); }
    if (g === 'speed') { S.speed = S.speed === 'fast' ? 'slow' : 'fast'; SD.G.settings.speed = S.speed; return controls(); }
    if (g === 'pause') { S.paused = !S.paused; if (!S.paused && !S.timer && !S.anim) S.timer = setTimeout(next, 100); controls(); const fb = S.el.querySelector('.dyg-fullbar [data-g="pause"]'); if (fb) fb.textContent = S.paused ? 'Resume' : 'Pause'; return; }
    if (g === 'timeout') { S.uc.timeout = !S.uc.timeout; return controls(); }
    if (g === 'ibb') { S.uc.ibb = !S.uc.ibb; return controls(); }
    if (g === 'autopen') { SD.G.settings.autoPen = SD.G.settings.autoPen === false; return controls(); }
    if (g === 'full') return toggleFull(!S.full);
    if (g === 'simend' || g === 'simper' || g === 'siminn') {
      const per = GM.per, inn = GM.inn;
      S.simTo = g === 'simend' ? () => GM.over : g === 'simper' ? () => GM.over || GM.per !== per : () => GM.over || GM.inn !== inn;
      S.pbpDirty = 0; S.paused = false;
      if (S.anim) { cancelAnimationFrame(S.raf); S.anim = null; }
      clearTimeout(S.timer); S.timer = setTimeout(next, 0); return;
    }
  }
  function onChange(e) {
    const el = e.target;
    if (el.dataset.pinch) { S.uc.pinch = el.value ? +el.value : null; return; }
    if (el.dataset.pitch) { S.uc.pitcher = el.value ? +el.value : null; return; }
  }
  function toggleFull(on) {
    S.full = on; S.el.querySelector('.dyg').classList.toggle('dyg-full', on); document.body.classList.toggle('dy-noscroll', on);
    try { const st = S.el.querySelector('.dyg-stick'); if (on && st.requestFullscreen && !document.fullscreenElement) st.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* not allowed here */ }
    setTimeout(() => { if (S) { sizeCanvas(); if (!S.anim) drawIdle(); } }, 60);
  }
  function exitFull() { if (S && S.full) { document.body.classList.remove('dy-noscroll'); try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* ignore */ } } }

  /* ---------- panels ---------- */
  function tabs() { S.el.querySelectorAll('[data-gtab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.gtab === S.tab))); }
  function panel() {
    const p = S && S.el.querySelector('#sdgPanel'); if (!p) return;
    const GM = S.GM;
    if (S.tab === 'pbp') { p.innerHTML = `<ol class="dyg-pbp">${S.pbp.slice(0, 160).map(x => `<li class="${x.big ? 'big' : ''} ${x.pts ? 'score' : ''}"><span class="dyg-pq">${esc(x.tag)}</span><span class="dyg-pq">${esc(x.tm)}</span><span>${x.s ? `<b class="dyg-pt" style="--tc:${S.col[x.s]}">${esc(GM.T[x.s].abbr)}</b> ` : ''}${esc(x.text)}${x.pts && x.sc ? ` <small>${esc(x.sc)}</small>` : ''}</span></li>`).join('') || '<li class="dim">Waiting for the first play.</li>'}</ol>`; return; }
    if (S.tab === 'box') { const mins = S.hoops ? GM.min : null; p.innerHTML = SDG.boxHtml(GM.T, GM.ps, GM.lineScore, mins, GM); return; }
    if (S.tab === 'floor') {
      const side = s => `<div class="dyg-boxside"><h4>${esc(GM.T[s].name)}</h4><table class="dyt"><tbody>${GM.L[s].map(pl => { const on = GM.on[s].includes(pl.id), l = GM.ps[pl.id] || {}, e = GM.en[pl.id] == null ? 1 : GM.en[pl.id]; return `<tr class="${on ? 'st' : ''}"><td>${on ? '●' : ''}</td><td><a href="#" data-pid="${pl.id}" class="dy-pl">${esc(last(pl))}</a> <small>${pl.pos}</small></td><td><span class="sdg-en"><i style="width:${Math.round(e * 100)}%;background:${e > 0.7 ? 'var(--win)' : e > 0.45 ? 'var(--warn)' : 'var(--loss)'}"></i></span></td><td class="small">${Math.round((GM.min[pl.id] || 0) / 60)} min · ${l.pts || 0} pts · ${l.pf || 0} PF</td></tr>`; }).join('')}</tbody></table></div>`;
      p.innerHTML = `<div class="dyg-boxsides">${side(S.side)}${side(other(S.side))}</div><p class="small dim">Energy bars: players tire on the floor and recover on the bench. Your staff subs by the rotation order on the Rotation tab, foul trouble and fatigue.</p>`;
    }
  }

  /* ---------- the box score (live and saved) ---------- */
  SDG.boxHtml = (T, ps, ls, mins, GM) => {
    const hoops = SD.kind() === 'hoops';
    const sides = ['a', 'h'];
    const rows = s => Object.entries(ps).filter(([, l]) => l.t === T[s].id).map(([id, l]) => ({ p: SD.P(+id), l }));
    let lsHtml = '';
    if (ls && ls.h) {
      const n = Math.max(ls.h.length, ls.a.length);
      const head = hoops ? Array.from({ length: n }, (_, i) => i < (SD.SP().periods) ? (SD.SP().periods === 2 ? (i + 1) + 'H' : 'Q' + (i + 1)) : 'OT' + (i - SD.SP().periods + 1 > 1 ? i - SD.SP().periods + 1 : '')) : Array.from({ length: n }, (_, i) => i + 1);
      const tot = s => (ls[s] || []).reduce((a, b) => a + b, 0);
      const hsum = s => rows(s).reduce((a, x) => a + (x.l.h || 0), 0);
      lsHtml = `<div class="dy-scroll"><table class="dyt dyg-ls"><thead><tr><th></th>${head.map(h => `<th>${h}</th>`).join('')}<th>${hoops ? 'T' : 'R'}</th>${hoops ? '' : '<th>H</th>'}</tr></thead><tbody>${sides.map(s => `<tr><td><b>${esc(T[s].abbr)}</b></td>${Array.from({ length: n }, (_, i) => `<td>${ls[s][i] != null ? ls[s][i] : (hoops || (GM && !GM.over) ? '' : 'x')}</td>`).join('')}<td><b>${tot(s)}</b></td>${hoops ? '' : `<td>${hsum(s)}</td>`}</tr>`).join('')}</tbody></table></div>`;
    }
    const pl = p => `<a href="#" data-pid="${p.id}" class="dy-pl${p.t === SD.G.user ? '' : ' o'}">${esc(p.n)}</a>`;
    const sideHtml = s => {
      const R = rows(s).filter(x => x.p);
      if (hoops) {
        R.forEach(x => { x.min = mins ? Math.round((mins[x.p.id] || 0) / 60) : x.l.min; });
        const list = R.filter(x => x.min > 0 || x.l.pts || x.l.fga).sort((a, b) => (b.l.gs || (GM && GM.L && GM.L[s].indexOf(b.p) < 5 ? 1 : 0)) - (a.l.gs || (GM && GM.L && GM.L[s].indexOf(a.p) < 5 ? 1 : 0)) || b.min - a.min);
        const t = list.reduce((a, x) => { for (const k of ['pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'to', 'pf']) a[k] = (a[k] || 0) + (x.l[k] || 0); return a; }, {});
        return `<div class="dyg-boxside"><h4>${esc(T[s].name)}</h4><div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>MIN</th><th>PTS</th><th>FG</th><th>3PT</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>PF</th><th>+/-</th></tr></thead><tbody>${list.map(x => `<tr><td>${pl(x.p)} <small>${x.p.pos}</small></td><td>${x.min}</td><td><b>${x.l.pts}</b></td><td>${x.l.fgm}-${x.l.fga}</td><td>${x.l.tpm}-${x.l.tpa}</td><td>${x.l.ftm}-${x.l.fta}</td><td>${x.l.orb + x.l.drb}</td><td>${x.l.ast}</td><td>${x.l.stl}</td><td>${x.l.blk}</td><td>${x.l.to}</td><td>${x.l.pf}</td><td>${x.l.pm > 0 ? '+' : ''}${x.l.pm || 0}</td></tr>`).join('')}<tr class="cur"><td>Team</td><td></td><td><b>${t.pts || 0}</b></td><td>${t.fgm || 0}-${t.fga || 0}</td><td>${t.tpm || 0}-${t.tpa || 0}</td><td>${t.ftm || 0}-${t.fta || 0}</td><td>${(t.orb || 0) + (t.drb || 0)}</td><td>${t.ast || 0}</td><td>${t.stl || 0}</td><td>${t.blk || 0}</td><td>${t.to || 0}</td><td>${t.pf || 0}</td><td></td></tr></tbody></table></div></div>`;
      }
      const order = GM && GM.L ? GM.L[s].order : null;
      const hit = R.filter(x => x.l.pa > 0 || (order && order.includes(x.p.id))).sort((a, b) => order ? (order.indexOf(a.p.id) + 1 || 99) - (order.indexOf(b.p.id) + 1 || 99) : b.l.pa - a.l.pa);
      const pit = R.filter(x => x.l.bf > 0).sort((a, b) => GM && GM.L ? GM.L[s].used.indexOf(a.p.id) - GM.L[s].used.indexOf(b.p.id) : (b.l.gs || 0) - (a.l.gs || 0));
      const ip = o => Math.floor(o / 3) + '.' + o % 3;
      const dec = l => l.w ? ' <small>(W)</small>' : l.l ? ' <small>(L)</small>' : l.sv ? ' <small>(S)</small>' : '';
      return `<div class="dyg-boxside"><h4>${esc(T[s].name)}</h4><div class="dy-scroll"><table class="dyt"><thead><tr><th>Batting</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>SO</th><th>HR</th></tr></thead><tbody>${hit.map(x => `<tr><td>${pl(x.p)} <small>${x.p.pos}</small></td><td>${x.l.ab}</td><td>${x.l.r}</td><td>${x.l.h}</td><td>${x.l.rbi}</td><td>${x.l.bb}</td><td>${x.l.so}</td><td>${x.l.hr || ''}</td></tr>`).join('')}</tbody></table></div>
        <div class="dy-scroll"><table class="dyt"><thead><tr><th>Pitching</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>PC</th></tr></thead><tbody>${pit.map(x => `<tr><td>${pl(x.p)}${dec(x.l)}</td><td>${ip(x.l.ipo)}</td><td>${x.l.ha}</td><td>${x.l.ra}</td><td>${x.l.er}</td><td>${x.l.bbp}</td><td>${x.l.k}</td><td>${x.l.pc}</td></tr>`).join('')}</tbody></table></div></div>`;
    };
    return `<div class="dyg-box">${lsHtml}<div class="dyg-boxsides">${sideHtml('a')}${sideHtml('h')}</div></div>`;
  };

  /* ---------- drawing ---------- */
  function ctx() { const c = S.cv.getContext('2d'); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); return c; }
  function drawIdle() { if (S.hoops) { const GM = S.GM; drawCourt(ctx()); if (S.lastFrame) drawPlayers(ctx(), S.lastFrame); else { const pos = (s, right) => GM.on[s].map((_, i) => [right ? 47 + 6 + i * 2 : 47 - 6 - i * 2, 10 + i * 7.5]); drawPlayers(ctx(), { s: 'h', o: pos('h', true), d: pos('a', false), ball: [47, 25], z: 0, onO: GM.on.h, onD: GM.on.a }); } } else { drawField(ctx()); drawFielders(ctx(), null); drawRunners(ctx(), S.GM.bases.map((id, i) => id ? { id, at: basePt(i + 1) } : null).filter(Boolean)); } }

  // the court: 94 x 50 feet
  function drawCourt(c) {
    const W = S.W, Hh = S.Hh, k = Math.min(W / 94, Hh / 50), ox = (W - 94 * k) / 2, oy = (Hh - 50 * k) / 2;
    S.ck = { k, ox, oy };
    const X = x => ox + x * k, Y = y => oy + y * k;
    c.fillStyle = '#c99a63'; c.fillRect(0, 0, W, Hh);
    c.fillStyle = '#d6a96f'; c.fillRect(X(0), Y(0), 94 * k, 50 * k);
    // planks
    c.strokeStyle = 'rgba(120,80,40,.12)'; c.lineWidth = 1; for (let y = 0; y < 50; y += 2.5) { c.beginPath(); c.moveTo(X(0), Y(y)); c.lineTo(X(94), Y(y)); c.stroke(); }
    const home = S.GM.T.h.c1 || '#FF8200';
    // paint
    c.fillStyle = home; c.globalAlpha = 0.82;
    c.fillRect(X(0), Y(19), 19 * k, 12 * k); c.fillRect(X(75), Y(19), 19 * k, 12 * k);
    c.globalAlpha = 1;
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, k * 0.18);
    c.strokeRect(X(0), Y(0), 94 * k, 50 * k);
    c.beginPath(); c.moveTo(X(47), Y(0)); c.lineTo(X(47), Y(50)); c.stroke();
    c.beginPath(); c.arc(X(47), Y(25), 6 * k, 0, Math.PI * 2); c.stroke();
    c.fillStyle = home; c.beginPath(); c.arc(X(47), Y(25), 2 * k, 0, Math.PI * 2); c.fill();
    for (const side of [0, 1]) {
      const bx = side ? 88.75 : 5.25, dir = side ? -1 : 1;
      c.strokeRect(side ? X(75) : X(0), Y(19), 19 * k, 12 * k);
      c.beginPath(); c.arc(X(side ? 75 : 19), Y(25), 6 * k, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2); c.stroke();
      // the three-point line: 22.15 ft arc, straight in the corners (3.35 ft from the sidelines)
      const r3 = 22.15, cy = 25, yc = 3.35, dx = Math.sqrt(r3 * r3 - (cy - yc) ** 2);
      c.beginPath(); c.moveTo(X(side ? 94 : 0), Y(yc)); c.lineTo(X(bx + dir * dx), Y(yc));
      const a0 = Math.atan2(yc - cy, dir * dx), a1 = Math.atan2(50 - yc - cy, dir * dx);
      c.arc(X(bx), Y(cy), r3 * k, a0, a1, side ? true : false); c.lineTo(X(side ? 94 : 0), Y(50 - yc)); c.stroke();
      // the basket
      c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(X(side ? 90 : 4), Y(22)); c.lineTo(X(side ? 90 : 4), Y(28)); c.stroke();
      c.strokeStyle = '#ff6a00'; c.beginPath(); c.arc(X(bx), Y(25), 0.75 * k, 0, Math.PI * 2); c.stroke(); c.strokeStyle = '#fff';
    }
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = `900 ${Math.max(9, k * 2.6)}px var(--f-display), system-ui, sans-serif`; c.textAlign = 'center';
    c.fillText(S.GM.neutral ? '' : (S.GM.T.h.abbr || ''), X(47), Y(25) + k * 4.6);
  }
  function drawPlayers(c, f) {
    const { k, ox, oy } = S.ck, X = x => ox + x * k, Y = y => oy + y * k, GM = S.GM;
    const so = f.s, sd = other(so), r = Math.max(6, k * 1.35);
    const dot = (pt, id, col, ring) => {
      const p = SD.P(id); if (!pt || !p) return;
      c.beginPath(); c.arc(X(pt[0]), Y(pt[1]), r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = ring ? 2.5 : 1.2; c.strokeStyle = ring ? '#F2D600' : 'rgba(0,0,0,.55)'; c.stroke();
      c.fillStyle = ink(col); c.font = `800 ${Math.max(8, r * 0.95)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(p.num == null ? '' : p.num), X(pt[0]), Y(pt[1]) + 0.5);
    };
    f.d.forEach((pt, i) => dot(pt, f.onD[i], S.col[sd], false));
    f.o.forEach((pt, i) => dot(pt, f.onO[i], S.col[so], f.holder === i));
    // the ball (bigger when it is in the air)
    const z = f.z || 0, br = Math.max(3, k * 0.75) * (1 + z / 14);
    if (z > 0) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(X(f.ball[0]), Y(f.ball[1]) + z * k * 0.15, br * 0.8, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(X(f.ball[0]) + (f.holder >= 0 && z === 0 ? r * 0.7 : 0), Y(f.ball[1]) - z * k * 0.25 - (f.holder >= 0 && z === 0 ? r * 0.5 : 0), br, 0, Math.PI * 2); c.fillStyle = '#ee6a1d'; c.fill(); c.strokeStyle = '#3a1a05'; c.lineWidth = 1; c.stroke();
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function animate(r, pre, done) {
    const GM = S.GM;
    const fast = S.speed === 'fast';
    if (S.hoops) {
      if (!(r.kind === 'shot' || r.kind === 'ft' || r.kind === 'to')) { if (r.kind === 'to' || r.kind === 'foul') drawIdle(); return done(); }
      const onO = GM.on[r.s].slice(), onD = GM.on[other(r.s)].slice();
      const F = SD.H.frames(GM, r, r.s, onO, onD);
      const scale = fast ? 0.2 : 0.55, total = Math.max(400, F.T * 1000 * scale);
      const t0 = performance.now();
      S.anim = true;
      const frame = now => {
        if (!S || !S.anim) return;
        const t = Math.min(F.T, (now - t0) / total * F.T);
        let i = 0; while (i < F.frames.length - 2 && F.frames[i + 1][0] <= t) i++;
        const A = F.frames[i], B = F.frames[Math.min(i + 1, F.frames.length - 1)], span = Math.max(0.01, B[0] - A[0]), u = ease(Math.min(1, Math.max(0, (t - A[0]) / span)));
        const mix = (P, Q) => P.map((p, j) => [lerp(p[0], Q[j][0], u), lerp(p[1], Q[j][1], u)]);
        const zz = B[5] ? Math.sin(u * Math.PI) * B[5] : 0;
        const f = { s: r.s, o: mix(A[1], B[1]), d: mix(A[2], B[2]), ball: [lerp(A[3][0], B[3][0], u), lerp(A[3][1], B[3][1], u)], holder: B[4] === -1 ? -1 : A[4], z: zz, onO, onD };
        S.lastFrame = Object.assign({}, f, { z: 0 });
        const c = ctx(); drawCourt(c); drawPlayers(c, f);
        if (t >= F.T) {
          S.anim = null;
          if (r.pts >= 3 && r.kind === 'shot') banner(r.and1 ? 'AND ONE!' : 'THREE!', S.col[r.s]);
          else if (r.and1) banner('AND ONE!', S.col[r.s]);
          else if (r.blk && r.big) banner('REJECTED', S.col[other(r.s)]);
          else if (/throws it down/.test(r.text)) banner('SLAM!', S.col[r.s]);
          else if (r.kind === 'to' && r.thief && r.big) banner('STEAL', S.col[other(r.s)]);
          return done();
        }
        S.raf = requestAnimationFrame(frame);
      };
      S.raf = requestAnimationFrame(frame);
      return;
    }
    // the diamond
    if (r.kind === 'sub') { drawIdle(); return done(); }
    const total = fast ? 650 : 1900, t0 = performance.now(), batter = r.bat ? r.bat.id : null;
    const runners = [];
    (pre.bases || []).forEach((id, i) => { if (id) runners.push({ id, from: i + 1 }); });
    if (batter && r.kind === 'pa') runners.push({ id: batter, from: 0 });
    runners.forEach(x => { const a = (r.adv || []).filter(v => v[2] === x.id); x.to = a.length ? a[a.length - 1][1] : (r.bases.indexOf(x.id) >= 0 ? r.bases.indexOf(x.id) + 1 : (x.from === 0 ? -1 : x.from)); });
    const land = r.bip ? fieldPt(Math.min(r.bip.dist, r.bip.type === 'hr' ? 9999 : 9999), r.bip.ang) : null;
    S.anim = true;
    const frame = now => {
      if (!S || !S.anim) return;
      const t = Math.min(1, (now - t0) / total), c = ctx();
      drawField(c);
      // the fielder going to the ball
      let chase = null;
      if (land && r.bip.type !== 'hr' && t > 0.25) { chase = { pt: land, u: Math.min(1, (t - 0.25) / 0.45) }; }
      drawFielders(c, chase, r.top ? 'h' : 'a');
      // runners
      const rs = runners.map(x => {
        const u = r.kind === 'sb' || r.kind === 'cs' ? Math.min(1, t / 0.8) : Math.max(0, Math.min(1, (t - 0.32) / 0.6));
        if (x.to === -1) return u >= 1 ? null : { id: x.id, at: basePt(x.from), fade: u };
        return { id: x.id, at: pathPt(x.from, x.to, ease(u)) };
      }).filter(Boolean);
      drawRunners(c, rs, r.top ? 'a' : 'h');
      // the pitch and the ball
      const mound = fieldPt(S.GM.soft ? 43 : 60.5, 0), plate = fieldPt(0, 0);
      if (t < 0.25 && r.kind !== 'sb' && r.kind !== 'cs') { const u = t / 0.25; ball(c, [lerp(mound[0], plate[0], u), lerp(mound[1], plate[1], u)], 0); }
      else if (land && t < 0.75) { const u = Math.min(1, (t - 0.25) / 0.45), hgt = r.bip.type === 'gb' ? 0 : r.bip.type === 'ld' ? 10 : r.bip.type === 'pu' ? 40 : 28; ball(c, [lerp(plate[0], land[0], u), lerp(plate[1], land[1], u)], Math.sin(u * Math.PI) * hgt * (r.bip.type === 'hr' ? 1.5 : 1)); }
      else if (land && r.bip.type !== 'hr') ball(c, land, 0);
      if (t >= 1) {
        S.anim = null;
        if (r.result === 'hr') banner(/GRAND/.test(r.text) ? 'GRAND SLAM' : 'HOME RUN', S.col[r.s]);
        else if (r.walkoff) banner('WALK-OFF!', S.col[r.s]);
        else if (r.result === 'dp') banner('DOUBLE PLAY', S.col[other(r.s)]);
        else if (r.result === 'k' && r.outs === 0 && r.endHalf && S.GM.user && other(r.s) === S.side) banner('STRIKE THREE', S.col[other(r.s)]);
        drawIdle();
        return done();
      }
      S.raf = requestAnimationFrame(frame);
    };
    S.raf = requestAnimationFrame(frame);
  }

  // the field: home plate at the bottom, the fence at about 0.82 of the height
  function geom() { const W = S.W, Hh = S.Hh, R = Math.min(Hh * 0.84, W * 0.62), fence = S.GM.soft ? 220 : 400; return { hx: W / 2, hy: Hh * 0.93, R, k: R / fence, base: S.GM.soft ? 60 : 90, fence }; }
  function fieldPt(d, ang) { const g = geom(), a = ang * Math.PI / 180, dd = Math.min(d, g.fence * 1.12); return [g.hx + Math.sin(a) * dd * g.k, g.hy - Math.cos(a) * dd * g.k]; }
  function basePt(i) { const b = geom().base; if (i === 0 || i === 4) return fieldPt(0, 0); if (i === 1) return fieldPt(b, 45); if (i === 2) return fieldPt(b * Math.SQRT2, 0); return fieldPt(b, -45); }
  function pathPt(from, to, u) { if (to <= from) return basePt(from); const segs = to - from, s = Math.min(segs - 1, Math.floor(u * segs)), v = u * segs - s; const a = basePt(from + s), b = basePt(from + s + 1); return [lerp(a[0], b[0], v), lerp(a[1], b[1], v)]; }
  function drawField(c) {
    const W = S.W, Hh = S.Hh, g = geom();
    c.fillStyle = '#1f5f2a'; c.fillRect(0, 0, W, Hh);
    // the outfield (stripes) and the warning track
    c.save(); c.beginPath(); c.moveTo(g.hx, g.hy); c.arc(g.hx, g.hy, g.R, -Math.PI / 2 - Math.PI / 4, -Math.PI / 2 + Math.PI / 4); c.closePath(); c.clip();
    c.fillStyle = '#2f8a3a'; c.fillRect(0, 0, W, Hh);
    c.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 14; i += 2) { c.beginPath(); c.arc(g.hx, g.hy, g.R * (1 - i / 14), 0, Math.PI * 2); c.arc(g.hx, g.hy, g.R * (1 - (i + 1) / 14), 0, Math.PI * 2, true); c.fill(); }
    c.strokeStyle = '#a77b4f'; c.lineWidth = g.R * 0.045; c.beginPath(); c.arc(g.hx, g.hy, g.R * 0.978, -Math.PI * 0.75, -Math.PI * 0.25); c.stroke();
    c.restore();
    // the fence
    c.strokeStyle = S.GM.T.h.c1 || '#FF8200'; c.lineWidth = 4; c.beginPath(); c.arc(g.hx, g.hy, g.R, -Math.PI * 0.75, -Math.PI * 0.25); c.stroke();
    // the infield dirt
    const b = g.base, b1 = basePt(1), b2 = basePt(2), b3 = basePt(3), hp = basePt(0);
    c.fillStyle = S.GM.soft ? '#b8774a' : '#b9855a';
    c.beginPath(); c.moveTo(hp[0], hp[1] + 6); const big = fieldPt(b * 1.65, 0), l = fieldPt(b * 1.25, -48), rgt = fieldPt(b * 1.25, 48);
    c.lineTo(l[0], l[1]); c.quadraticCurveTo(big[0], big[1] - g.k * b * 0.35, rgt[0], rgt[1]); c.closePath(); c.fill();
    if (!S.GM.soft) { c.fillStyle = '#2f8a3a'; c.beginPath(); c.moveTo(hp[0], hp[1] - g.k * 8); const i1 = fieldPt(b * 0.9, 42), i2 = fieldPt(b * 1.27, 0), i3 = fieldPt(b * 0.9, -42); c.lineTo(i1[0], i1[1]); c.lineTo(i2[0], i2[1]); c.lineTo(i3[0], i3[1]); c.closePath(); c.fill(); }
    // the mound, foul lines and bases
    const m = fieldPt(S.GM.soft ? 43 : 60.5, 0); c.fillStyle = S.GM.soft ? '#c48a5c' : '#c49065'; c.beginPath(); c.arc(m[0], m[1], g.k * (S.GM.soft ? 8 : 9), 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.5; const fl = fieldPt(g.fence * 0.99, -45), fr = fieldPt(g.fence * 0.99, 45);
    c.beginPath(); c.moveTo(hp[0], hp[1]); c.lineTo(fl[0], fl[1]); c.moveTo(hp[0], hp[1]); c.lineTo(fr[0], fr[1]); c.stroke();
    c.fillStyle = '#fff'; const sq = Math.max(4, g.k * 4);
    [b1, b2, b3].forEach(p => { c.save(); c.translate(p[0], p[1]); c.rotate(Math.PI / 4); c.fillRect(-sq / 2, -sq / 2, sq, sq); c.restore(); });
    c.beginPath(); c.moveTo(hp[0] - sq * 0.6, hp[1] - sq * 0.4); c.lineTo(hp[0] + sq * 0.6, hp[1] - sq * 0.4); c.lineTo(hp[0] + sq * 0.6, hp[1]); c.lineTo(hp[0], hp[1] + sq * 0.5); c.lineTo(hp[0] - sq * 0.6, hp[1]); c.closePath(); c.fill();
  }
  const FPOS = { P: null, C: [-0.035, 0], '1B': [0.27, 36], '2B': [0.37, 14], SS: [0.37, -14], '3B': [0.27, -36], LF: [0.7, -27], CF: [0.79, 0], RF: [0.7, 27] };
  function drawFielders(c, chase, side) {
    const GM = S.GM, g = geom(), s = side || (GM.top ? 'h' : 'a'), L = GM.L[s], col = S.col[s];
    const spots = Object.keys(FPOS).map(k => ({ k, id: k === 'P' ? L.pit : L.field[k], pt: k === 'P' ? fieldPt(GM.soft ? 43 : 60.5, 0) : fieldPt(FPOS[k][0] * g.fence, FPOS[k][1]) }));
    if (chase) { let best = null, bd = 1e9; spots.forEach(x => { if (x.k === 'C' || x.k === 'P') return; const d = Math.hypot(x.pt[0] - chase.pt[0], x.pt[1] - chase.pt[1]); if (d < bd) { bd = d; best = x; } }); if (best) best.pt = [lerp(best.pt[0], chase.pt[0], ease(chase.u)), lerp(best.pt[1], chase.pt[1], ease(chase.u))]; }
    spots.forEach(x => person(c, x.pt, col, x.id, false));
  }
  function drawRunners(c, rs, side) { const GM = S.GM, s = side || (GM.top ? 'a' : 'h'); rs.forEach(x => { c.globalAlpha = x.fade != null ? 1 - x.fade : 1; person(c, x.at, S.col[s], x.id, true); c.globalAlpha = 1; }); }
  function person(c, pt, col, id, ring) {
    const r = Math.max(6.5, S.W / 90), p = SD.P(id);
    c.beginPath(); c.arc(pt[0], pt[1], r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = ring ? 2.2 : 1; c.strokeStyle = ring ? '#F2D600' : 'rgba(0,0,0,.5)'; c.stroke();
    if (p && r >= 6) { c.fillStyle = ink(col); c.font = `800 ${Math.round(r * 0.95)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(p.num == null ? '' : p.num), pt[0], pt[1] + 0.5); }
  }
  function ball(c, pt, z) { const r = Math.max(2.5, S.W / 260) * (1 + z / 30); if (z > 0) { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.arc(pt[0], pt[1], r, 0, Math.PI * 2); c.fill(); } c.beginPath(); c.arc(pt[0], pt[1] - z, r, 0, Math.PI * 2); c.fillStyle = S.GM.soft ? '#e8ff3a' : '#ffffff'; c.fill(); c.strokeStyle = '#c0392b'; c.lineWidth = 1; c.stroke(); }
})(typeof window !== 'undefined' ? window : globalThis);
