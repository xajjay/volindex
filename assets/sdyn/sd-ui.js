/* The Vol Index — Hoops and Diamond Dynasty: the hub (saves, setup, home, schedule, roster, lineup, recruiting, rankings,
   standings, stats, NIL, history, settings, the offseason stages and player cards). Uses the Vol Dynasty stylesheet. */
(function (root) {
  'use strict';
  const SD = root.SD;
  const UI = root.VI_SDYN = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let APP = null, SPORT = null;
  const V = { tab: 'home', msg: null, rpos: 'ALL', statk: null, stab: 'team', nilf: 'all', ppos: 'ALL', rfind: { pos: 'ALL', stars: 0, q: '' }, more: {}, setup: null };
  const G = () => SD.G;
  const T = id => SD.T(id);
  const hoops = () => SD.kind() === 'hoops';
  const yrLabel = p => SD.YR[Math.min(6, p.yr)] || 'Gr.';
  const stars = n => '★'.repeat(n || 0) + '<span class="dy-off">' + '★'.repeat(Math.max(0, 5 - (n || 0))) + '</span>';
  const ovrCls = o => o >= 90 ? 'e' : o >= 84 ? 'g' : o >= 76 ? 'm' : 'l';
  const ovrB = o => `<span class="dy-ovr ${ovrCls(o)}">${o}</span>`;
  const tlink = (id, rk) => { const t = T(id); if (!t) return ''; const r = rk === false ? null : SD.apRank(id); return `<span class="dy-t" style="--tc:${t.c1}">${r ? `<small>${r}</small> ` : ''}${esc(t.name)}</span>`; };
  const plink = (p, txt) => p ? `<a href="#" class="dy-pl${p.t === G().user ? '' : ' o'}" data-pid="${p.id}">${esc(txt || p.n)}</a>` : '';
  const sStats = p => p.s || (G().phase === 'offseason' && p.car && p.car[G().season]) || null;
  const f1 = (a, b) => b ? (a / b).toFixed(1) : '0.0';
  const avg3 = (h, ab) => ab ? (h / ab).toFixed(3).replace(/^0/, '') : '.000';

  UI.render = (app, sport) => {
    APP = app; SPORT = sport;
    document.title = SD.SPORTS[sport].title + ' · The Vol Index';
    if (root.SDG && root.SDG.live()) { if (APP.querySelector('.dyg')) return; return root.SDG.leave(); }
    if (!SD.G || SD.G.sport !== sport) return landing();
    hub();
  };
  function busy(label, fn, after) {
    const o = document.createElement('div'); o.className = 'dy-busy'; o.innerHTML = `<div><span class="dy-spin"></span>${esc(label)}</div>`;
    document.body.appendChild(o);
    setTimeout(() => { try { fn(); } catch (e) { console.error(e); V.msg = 'Something went wrong: ' + e.message; } o.remove(); if (after) after(); else hub(); autosave(); }, 40);
  }
  function autosave() { const g = G(); if (g && g.settings.autosave !== false) SD.saveSlot(g.slot || 1).then(err => { if (err) V.msg = err; }); }

  /* ---------- landing + setup ---------- */
  function landing() {
    const sp = SD.SPORTS[SPORT], m = SD.readMeta(SPORT);
    const crumbSport = { mbb: "Men's Basketball", wbb: "Women's Basketball", baseball: 'Baseball', softball: 'Softball' }[SPORT];
    APP.innerHTML = `<div class="wrap games dy">
      <div class="gcrumb"><a href="#games">Games</a> › <a href="#games-${SPORT}">${crumbSport}</a> › ${esc(sp.title)}</div>
      <div class="dy-hero"><span class="gtag">Preview</span><h1>${esc(sp.title)}</h1><p>${esc(blurb(sp))}</p></div>
      <div class="dy-slots">${[1, 2, 3].map(n => { const s = m[n]; return `<div class="box dy-slot ${s ? '' : 'empty'}"><div class="glabel">Slot ${n}</div>${s ? `<h3>Coach ${esc(s.coach)}</h3><p class="dim">${s.team && s.team !== 'Tennessee' ? esc(s.team) + ' · ' : ''}${esc(s.label)} · ${esc(s.rec)}${s.titles ? ` · ${s.titles} title${s.titles > 1 ? 's' : ''}` : ''}</p><div class="grow"><button class="btn primary" data-load="${n}">Continue</button><button class="btn" data-del="${n}">Delete</button></div>` : `<p class="dim">Empty</p><div class="grow"><button class="btn primary" data-new="${n}">New dynasty</button></div>`}</div>`; }).join('')}</div>
      <div class="grow"><label class="btn"><input type="file" accept=".gz,application/gzip" id="sdImport" hidden>Import a save file</label></div>
      <div class="gnote small">Saves live in this browser. This is an early preview: expect balance changes.</div></div>`;
    APP.firstElementChild.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.new) { V.setup = { slot: +b.dataset.new }; setup(); }
      if (b.dataset.load) { b.disabled = true; b.textContent = 'Loading…'; SD.loadSlot(SPORT, +b.dataset.load).then(g => { if (!g) return landing(); g.slot = +b.dataset.load; V.tab = 'home'; hub(); }).catch(err => { V.msg = 'That save could not be read: ' + err.message; landing(); }); }
      if (b.dataset.del) { if (b.dataset.sure) { SD.deleteSlot(SPORT, +b.dataset.del); landing(); } else { b.dataset.sure = 1; b.textContent = 'Tap again to delete'; } }
    };
    const imp = APP.querySelector('#sdImport');
    imp.onchange = () => { const f = imp.files[0]; if (!f) return; SD.importFile(f).then(g => { if (g.sport !== SPORT) { V.msg = 'That save is for another sport.'; return landing(); } g.slot = g.slot || 1; SD.saveSlot(g.slot); hub(); }).catch(err => { V.msg = 'Could not import: ' + err.message; landing(); }); };
  }
  function blurb(sp) {
    return sp.kind === 'hoops' ? `Take over ${sp.he === 'she' ? 'the Lady Vols' : 'Tennessee'} with the real ${sp.label(sp.season)} roster and schedule. Coach the games possession by possession on a live court (pace, defense, focus, timeouts, your rotation), recruit, work the portal and NIL, and chase the SEC title and March Madness.`
      : `Take over Tennessee ${sp.key === 'softball' ? 'softball' : 'baseball'} with the real ${sp.season} roster and schedule. Manage every at-bat on a live diamond (lineup, rotation, bullpen, steals, bunts, pinch hitters), recruit, work the portal and NIL, and chase ${sp.ncaa.wsSite}.`;
  }
  function setup() {
    const s = V.setup, sp = SD.SPORTS[SPORT];
    const def = { team: 'Tennessee', diff: 'varsity', coach: '', mode: 'coach', recruiting: 'manual', portal: 'manual', nil: 'manual', speed: 'slow' };
    for (const k in def) if (s[k] == null) s[k] = def[k];
    const seg = (key, opts) => `<div class="gseg" data-key="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(s[key]) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
    const A = root.SITE_AUTO && root.SITE_AUTO[SPORT], played = A && A.schedule ? A.schedule.filter(x => x.result && !x.exh).length : 0;
    APP.innerHTML = `<div class="wrap games dy"><div class="gcrumb"><a href="#" data-back="1">${esc(sp.title)}</a> › New dynasty</div>
      <div class="dy-hero"><h1>New dynasty</h1><p>${s.team === 'Tennessee' ? `${esc(sp.name)} at Tennessee, ${sp.label(sp.season)}: the real roster and schedule${played ? `, with the ${played} real game${played > 1 ? 's' : ''} already played` : ''}.` : `${esc(sp.name)} at ${esc(s.team)}, ${sp.label(sp.season)}: a generated roster and schedule. Tennessee keeps its real roster as an opponent.`}</p></div>
      <div class="box gsetup dy-setup">
        <div class="gfield"><div class="glabel">Start</div>${played ? seg('start', [['today', 'Today: take over mid-season']]) + `<p class="dim small">The season is under way: you take over with the real results so far.</p>` : `<p class="dim small" style="margin:0">The ${sp.label(sp.season)} season hasn't started, so you begin in the preseason (camp, then the opener on ${new Date(Date.UTC(sp.season, +sp.start.slice(0, 2) - 1, +sp.start.slice(3))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}). Preseason rankings are the real ones where they are out.</p>`}</div>
        <div class="gfield"><div class="glabel">Difficulty</div>${seg('diff', [['freshman', 'Freshman (easier)'], ['varsity', 'Varsity (default)'], ['heisman', 'Heisman (hard)']])}<p class="dim small">Heisman gives CPU teams a boost in your games and makes recruiting tougher.</p></div>
        <div class="gfield"><div class="glabel">Team</div><select id="sdTeam" class="dy-in">${(() => { const ts = SD.teamsFor(SPORT), confs = [...new Set(ts.map(t => t.conf))].sort((a, b) => (a === 'SEC' ? -1 : b === 'SEC' ? 1 : (SD.CONF_NAME[a] || a).localeCompare(SD.CONF_NAME[b] || b))); return confs.map(c => `<optgroup label="${esc(SD.CONF_NAME[c] || c)}">${ts.filter(t => t.conf === c).sort((a, b) => a.name.localeCompare(b.name)).map(t => `<option ${t.name === s.team ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join(''); })()}</select><p class="dim small">${s.team === 'Tennessee' ? 'Tennessee comes with its real players, stats and schedule.' : 'Every other school gets generated players and a generated schedule, with no real-life stats or history.'}</p></div>
        <div class="gfield"><div class="glabel">Coach name</div><input id="sdCoach" class="dy-in" maxlength="28" placeholder="Your name" value="${esc(s.coach)}"></div>
        <div class="gfield"><div class="glabel">In games</div>${seg('mode', [['coach', hoops0() ? 'I coach (strategy, timeouts, rotation)' : 'I manage (lineup, bullpen, steals, bunts)'], ['watch', 'Just watch']])}</div>
        <div class="gfield"><div class="glabel">Recruiting</div>${seg('recruiting', [['manual', 'I recruit'], ['auto', 'Auto'], ['off', 'Off']])}</div>
        <div class="gfield"><div class="glabel">Transfer portal</div>${seg('portal', [['manual', 'I manage it'], ['auto', 'Auto']])}</div>
        <div class="gfield"><div class="glabel">NIL raises</div>${seg('nil', [['manual', 'I decide'], ['auto', 'Auto']])}</div>
        <div class="gfield"><div class="glabel">Game speed</div>${seg('speed', [['slow', 'Slow'], ['fast', 'Fast']])}</div>
        <div class="grow"><button class="btn primary big" id="sdStart">Start the dynasty</button><button class="btn" data-back="1">Back</button></div>
      </div></div>`;
    APP.querySelector('#sdTeam').onchange = ev => { s.team = ev.target.value; s.coach = APP.querySelector('#sdCoach').value; setup(); };
    APP.firstElementChild.onclick = e => {
      const b = e.target.closest('button,a'); if (!b) return;
      if (b.dataset.back) { e.preventDefault(); return landing(); }
      const segEl = b.closest('.gseg');
      if (segEl && b.dataset.v != null) { s[segEl.dataset.key] = b.dataset.v; s.coach = APP.querySelector('#sdCoach').value; s.team = APP.querySelector('#sdTeam').value; return setup(); }
      if (b.id === 'sdStart') {
        s.coach = APP.querySelector('#sdCoach').value.trim() || 'Coach';
        busy('Building the season…', () => {
          SD.newDynasty({ sport: SPORT, coach: s.coach, slot: s.slot, team: s.team, settings: { difficulty: s.diff, coachMode: s.mode, recruiting: s.recruiting, portal: s.portal, nil: s.nil, speed: s.speed } });
          if (SD.startToday) SD.startToday();
          V.tab = 'home';
        });
      }
    };
  }
  const hoops0 = () => SD.SPORTS[SPORT].kind === 'hoops';

  /* ---------- hub ---------- */
  const TABS = () => (G() && G().post && G().post.seen !== false ? [['tourney', 'NCAA Tournament']] : []).concat([['home', 'Home'], ['schedule', 'Schedule'], ['roster', 'Roster'], ['lineup', hoops() ? 'Rotation' : 'Lineup'], ['recruit', 'Recruiting'], ['polls', 'Rankings'], ['standings', 'Standings'], ['stats', 'Stats'], ['nil', 'NIL'], ['history', 'History'], ['settings', 'Settings']]);
  function hub() {
    const g = G(); if (!g) return landing();
    const ut = SD.userT(), rk = SD.apRank(ut.id), sp = SD.SP();
    const act = primaryAction();
    APP.innerHTML = `<div class="dy dyhub">
      <div class="dyh" style="--tc:${ut.c1}">
        <div class="wrap dyh-in">
          <div class="dyh-id"><span class="dyh-badge">${esc(ut.abbr)}</span><div><div class="dyh-name">${rk ? `<small>No. ${rk}</small> ` : ''}${SD.isTN() && sp.he === 'she' && hoops() ? 'Lady Vols' : esc(ut.name)}</div><div class="dyh-sub">Coach ${esc(g.coach.name)} · ${esc(SD.phaseLabel())}</div></div></div>
          <div class="dyh-rec"><b>${ut.w}-${ut.l}</b><small>${ut.cw}-${ut.cl} ${esc(SD.UC())}</small></div>
          <div class="dyh-act">${act ? `<button class="btn primary big" data-act="main">${esc(act.label)}</button>${act.sim ? `<button class="btn" data-act="sim">${esc(act.sim)}</button>` : ''}` : ''}
            ${g.phase !== 'offseason' ? `<div class="dy-menu"><button class="btn" data-act="simmenu">Sim ahead ▾</button><div class="dy-menu-in" hidden><p class="small dim" style="margin:2px 8px 6px">Your games get simmed too.</p>${g.phase === 'season' || g.phase === 'preseason' ? '<button data-ahead="7">One week</button><button data-ahead="reg">End of the regular season</button>' : ''}<button data-ahead="end">End of the season</button></div></div>` : ''}
            <button class="btn" data-act="save">Save</button></div>
        </div>
        <nav class="wrap dyh-tabs" role="tablist">${TABS().map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${V.tab === k}">${l}</button>`).join('')}</nav>
      </div>
      ${V.msg ? `<div class="wrap"><div class="gnote dy-msg">${esc(V.msg)} <button class="glink" data-act="msgx">Dismiss</button></div></div>` : ''}
      <div class="wrap dy-body" id="dyBody"></div>
      <div class="dy-modal" id="dyModal" hidden><div class="dy-modal-in" role="dialog" aria-modal="true"><button class="dy-x" data-act="close" aria-label="Close">×</button><div id="dyModalBody"></div></div></div>
    </div>`;
    const body = APP.querySelector('#dyBody');
    if (V.tab === 'tourney' && !(g.post && g.post.seen !== false)) V.tab = 'home';
    ({ home, schedule, roster, lineup, recruit, polls, standings, stats, nil, history, settings, tourney })[V.tab](body);
    APP.firstElementChild.onclick = onClick; APP.firstElementChild.onchange = onChange;
    const at = APP.querySelector('.dyh-tabs [aria-selected="true"]'); if (at && at.scrollIntoView && root.innerWidth < 900) at.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function primaryAction() {
    const g = G();
    if (g.phase === 'offseason') { const st = g.off.stage; return { label: st === 'schedule' ? `Start the ${SD.SP().label(g.season + 1)} season` : 'Continue: ' + SD.OFF_LABEL[SD.OFF_ORDER[SD.OFF_ORDER.indexOf(st) + 1]], main: () => busy('Working…', () => SD.offNext()) }; }
    if (g.post && g.post.seen === false) return { label: hoops() ? 'Watch Selection Sunday' : 'Watch the selection show', main: () => { V.tab = 'home'; hub(); } };
    const nx = SD.nextUserGame();
    if (!nx) {
      if (g.phase === 'ncaa' && !(g.post && g.post.field.includes(g.user) && alive(g.user))) return { label: 'Play out the tournament', main: () => busy('Playing out the tournament…', () => SD.simToEnd('end')) };
      if (g.phase === 'ncaa') return { label: 'Continue to your next game', main: () => busy('Moving ahead…', () => { SD.advanceToUser(); }) };
      const lab = g.phase === 'ct' ? (hoops() ? 'Continue to Selection Sunday' : 'Continue to the NCAA field announcement') : g.phase === 'season' ? 'Continue to the conference tournaments' : 'Continue';
      return { label: lab, main: () => busy('Moving ahead…', () => { SD.advanceToUser(); }) };
    }
    const o = T(SD.oppOf(nx));
    return { label: `${g.settings.coachMode === 'watch' ? 'Watch' : 'Play'}: ${nx.h === g.user && !nx.neutral ? 'vs' : nx.neutral ? 'vs' : 'at'} ${o.name}`, sim: 'Sim it', x: nx, main: () => { busy('Getting to game day…', () => { SD.advanceToUser(); }, () => { const x = SD.nextUserGame(); if (x) playGame(x); else hub(); }); } };
  }
  function playGame(x) {
    APP.innerHTML = `<div class="dy dygame"><div class="wrap"><div class="gcrumb"><a href="#" data-leave="1">‹ Back to the dynasty</a> <span class="dim small">(leaving sims the rest of the game)</span></div><div class="dy-game"></div></div><div class="dy-modal" id="dyModal" hidden><div class="dy-modal-in" role="dialog" aria-modal="true"><button class="dy-x" data-act="close" aria-label="Close">×</button><div id="dyModalBody"></div></div></div></div>`;
    APP.firstElementChild.onclick = e => {
      const a = e.target.closest('[data-leave]'); if (a) { e.preventDefault(); root.SDG.leave(); return; }
      const pl = e.target.closest('[data-pid]'); if (pl) { e.preventDefault(); playerCard(+pl.dataset.pid); return; }
      if (e.target.closest('[data-act="close"]')) closeModal();
    };
    root.SDG.open(APP.querySelector('.dy-game'), x, { onDone: () => { busy('Finishing the day…', () => { SD.afterUserGame(x); V.tab = 'home'; }); } });
    root.scrollTo(0, 0);
  }
  UI.playGame = playGame;

  /* ---------- events ---------- */
  function onClick(e) {
    const el = e.target.closest('[data-tab],[data-act],[data-pid],[data-treg],[data-team],[data-push],[data-ncadd],[data-ncrm],[data-campf],[data-campp],[data-pedit],[data-psave],[data-ahead],[data-more],[data-rpos],[data-statk],[data-stab],[data-conf],[data-ract],[data-radd],[data-rrm],[data-roffer],[data-rfind],[data-nilf],[data-nilans],[data-nilstep],[data-persuade],[data-poffer],[data-ppos],[data-cut],[data-set],[data-box],[data-rot],[data-ord],[data-gid]'); if (!el) return;
    const d = el.dataset, g = G();
    if (el.tagName === 'A') e.preventDefault();
    if (d.tab) { V.tab = d.tab; V.msg = null; return hub(); }
    if (d.pedit) return editCard(+d.pedit);
    if (d.psave) { V.msg = saveEdit(+d.psave); closeModal(); return keep(); }
    if (d.pid) return playerCard(+d.pid);
    if (d.gid) return boxCard(d.gid);
    if (d.act === 'close') return closeModal();
    if (d.act === 'msgx') { V.msg = null; return hub(); }
    if (d.act === 'ssdone') { if (g.post) g.post.seen = true; V.tab = 'tourney'; V.treg = null; autosave(); return hub(); }
    if (d.treg) { V.treg = d.treg; return keep(); }
    if (d.team) return teamCard(+d.team);
    if (d.push) { V.msg = SD.encourage(+d.push); V.more.push = true; return keep(); }
    if (d.ncadd) { const y = g.season + 1, ut = SD.userT(), o = g.teams.filter(t => t.conf !== ut.conf).sort((a, b) => b.prestige - a.prestige)[g.ncPick[y].length * 3]; g.ncPick[y].push({ o: o.id, site: 'H' }); return keep(); }
    if (d.ncrm != null && d.ncrm !== '') { g.ncPick[g.season + 1].splice(+d.ncrm, 1); return keep(); }
    if (d.campf) { SD.campState().focus = d.campf; return keep(); }
    if (d.campp) { const C = SD.campState(), id = +d.campp, i = C.picks.indexOf(id); if (i >= 0) C.picks.splice(i, 1); else if (C.picks.length < 3) C.picks.push(id); else V.msg = 'Three players max: tap one to take him out.'; return keep(); }
    if (d.act === 'camp') { SD.runCamp(false); autosave(); return keep(); }
    if (d.act === 'main') { const a = primaryAction(); if (a) a.main(); return; }
    if (d.act === 'sim') { return busy('Simming…', () => { const x = SD.simNext(); if (x) { const me = x.h === g.user ? 'h' : 'a'; V.msg = `Final: ${T(x.a).name} ${x.res.a}, ${T(x.h).name} ${x.res.h}.`; } }); }
    if (d.act === 'simmenu') { const m = el.parentNode.querySelector('.dy-menu-in'); m.hidden = !m.hidden; return; }
    if (d.ahead) return busy('Simming…', () => {
      if (d.ahead === 'end') SD.simToEnd('end');
      else if (d.ahead === 'reg') { let n = 0; while (g.phase !== 'ct' && g.phase !== 'offseason' && n++ < 80) { if (!SD.simNext()) break; } }
      else { const until = SD.addDays(g.date, 7); let n = 0; while (g.date < until && g.phase !== 'offseason' && n++ < 20) { const nx = SD.nextUserGame(); if (!nx || nx.d >= until) { SD.simTo(until, false); break; } SD.simNext(); } }
    });
    if (d.act === 'save') { el.disabled = true; return SD.saveSlot(g.slot || 1).then(err => { V.msg = err || `Saved to slot ${g.slot || 1}.`; hub(); }); }
    if (d.act === 'export') return SD.exportBlob().then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${g.sport}-dynasty-${g.season}.gz`; a.click(); });
    if (d.more) { V.more[d.more] = !V.more[d.more]; return keep(); }
    if (d.rpos) { V.rpos = d.rpos; return keep(); }
    if (d.statk) { V.statk = d.statk; return keep(); }
    if (d.stab) { V.stab = d.stab; return keep(); }
    if (d.conf) { V.conf = d.conf; return keep(); }
    if (d.nilf) { V.nilf = d.nilf; return keep(); }
    if (d.ppos) { V.ppos = d.ppos; return keep(); }
    if (d.rfind) { const [k, v] = d.rfind.split('|'); V.rfind[k] = k === 'stars' ? +v : v; return keep(); }
    if (d.radd) { V.msg = SD.boardAdd(+d.radd); return keep(); }
    if (d.rrm) { SD.boardRemove(+d.rrm); return keep(); }
    if (d.ract) { const [id, a] = d.ract.split('|'); const p = g.recruit.pool[id]; V.msg = SD.setAct(+id, a, !p.acts[a]); return keep(); }
    if (d.roffer) { V.msg = SD.offer(+d.roffer); return keep(); }
    if (d.nilans) { const [id, v] = d.nilans.split('|'); const a = g.off.nilAsk.find(x => x.id === +id); if (a) a.ans = v === '1'; return keep(); }
    if (d.nilstep) { const [id, k] = d.nilstep.split('|'); const p = SD.P(+id); V.msg = SD.adjustNil(+id, (p.nil || 0) + (+k) * Math.max(5000, Math.round((p.nil || 20000) * 0.1 / 5000) * 5000)); return keep(); }
    if (d.persuade) { const sel = APP.querySelector(`[data-pamt="${d.persuade}"]`); V.msg = SD.persuade(+d.persuade, sel ? +sel.value : 0); return keep(); }
    if (d.poffer) { const sel = APP.querySelector(`[data-pofferamt="${d.poffer}"]`); V.msg = SD.portalOffer(+d.poffer, +sel.value) || 'Offer made.'; return keep(); }
    if (d.cut) { V.msg = SD.toggleCut(+d.cut); return keep(); }
    if (d.set) { const [k, v] = d.set.split('|'); g.settings[k] = v === 'true' ? true : v === 'false' ? false : v; return keep(); }
    if (d.rot) { // rotation order (hoops): move up/down
      const [id, dir] = d.rot.split('|'), t = SD.userT(), L = SD.lineup(t).map(p => p.id), i = L.indexOf(+id), j = i + (+dir);
      if (i >= 0 && j >= 0 && j < L.length) { [L[i], L[j]] = [L[j], L[i]]; t.rot = L; } return keep();
    }
    if (d.ord) { const [id, dir] = d.ord.split('|'), t = SD.userT(), D = SD.diamondLineup(t), O = D.order.map(p => p.id), i = O.indexOf(+id), j = i + (+dir); if (i >= 0 && j >= 0 && j < O.length) { [O[i], O[j]] = [O[j], O[i]]; t.dl = Object.assign(t.dl || {}, { order: O }); } return keep(); }
  }
  function onChange(e) {
    const el = e.target, g = G(), t = SD.userT();
    if (el.dataset.ncp) { const [i, k] = el.dataset.ncp.split('|'); const a = g.ncPick[g.season + 1][+i]; a[k] = k === 'o' ? +el.value : el.value; return keep(); }
    if (el.dataset.rnil) { const p = g.recruit.pool[el.dataset.rnil]; p.nilOffer = +el.value; return keep(); }
    if (el.dataset.rvisit) { V.msg = SD.setVisit(+el.dataset.rvisit, el.value) || 'Official visit set.'; return keep(); }
    if (el.dataset.fpos) { const D = SD.diamondLineup(t); const field = Object.fromEntries(Object.entries(D.field).map(([k, p]) => [k, p ? p.id : null])); const pid = +el.value; for (const k in field) if (field[k] === pid) field[k] = null; field[el.dataset.fpos] = pid; t.dl = Object.assign(t.dl || {}, { field, order: null }); return keep(); }
    if (el.dataset.rotsp) { const D = SD.diamondLineup(t); const rot = D.rotation.map(p => p.id); rot[+el.dataset.rotsp] = +el.value; t.dl = Object.assign(t.dl || {}, { rot: rot.filter((x, i, a) => a.indexOf(x) === i) }); return keep(); }
    if (el.dataset.closer) { t.dl = Object.assign(t.dl || {}, { closer: +el.value }); return keep(); }
    if (el.dataset.coach) { t.coach = Object.assign({}, t.coach || {}, { [el.dataset.coach]: el.value }); return keep(); }
    if (el.id === 'sdRq') { V.rfind.q = el.value; return keep(true); }
  }
  function keep(focus) { const y = root.scrollY; hub(); root.scrollTo(0, y); if (focus) { const q = APP.querySelector('#sdRq'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } }
  function modal(html) { const m = APP.querySelector('#dyModal'); APP.querySelector('#dyModalBody').innerHTML = html; m.hidden = false; }
  function closeModal() { const m = APP.querySelector('#dyModal'); if (m) m.hidden = true; }
  UI.modal = html => modal(html);

  /* ---------- home ---------- */
  function home(b) {
    const g = G(), ut = SD.userT();
    if (g.phase === 'offseason') return offseason(b);
    if (g.post && g.post.seen === false) return selectionShow(b);
    const L = [], R = [];
    const nx = SD.nextUserGame();
    if (g.phase === 'preseason') L.push(campCard(), depthPreview());
    if (nx) L.push(nextGameCard(nx));
    if (g.phase === 'ct' || g.phase === 'ncaa') L.push(postCard());
    const last = SD.userGames().filter(x => x.res).slice(-1)[0];
    if (last) L.push(`<div class="box"><div class="glabel">Last game · ${SD.dateStr(last.d)}</div><p><b class="${(last.h === g.user) === (last.res.h > last.res.a) ? 'dy-w' : 'dy-l'}">${(last.h === g.user) === (last.res.h > last.res.a) ? 'W' : 'L'} ${last.h === g.user ? last.res.h + '-' + last.res.a : last.res.a + '-' + last.res.h}</b> ${last.h === g.user ? 'vs' : 'at'} ${tlink(SD.oppOf(last))}${last.res.ot ? (hoops() ? ' (OT)' : ` (${last.res.inn} inn.)`) : ''} ${last.box ? `<button class="glink" data-gid="${last.id}">Box score</button>` : ''}</p></div>`);
    L.push(newsCard());
    R.push(pollMini(), standMini(), leadersMini(), recruitMini());
    b.innerHTML = `<div class="dy-grid"><div class="dy-col">${L.join('')}</div><div class="dy-col">${R.join('')}</div></div>`;
  }
  /* ---------- the NCAA Tournament: your path, the top seeds and the bracket ---------- */
  const PAIRS = [[1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]];
  const ncaaGame = (a, b) => G().sched.find(x => x.kind === 'ncaa' && ((x.h === a && x.a === b) || (x.h === b && x.a === a)) && x.res) || null;
  const winOf = (a, b) => { if (a == null || b == null) return null; const x = ncaaGame(a, b); return x ? (x.res.h > x.res.a ? x.h : x.a) : null; };
  const netOf = id => (T(id) && T(id).net ? T(id).net.rank : 999);
  const likely = ids => ids.filter(x => x != null).sort((a, b) => netOf(a) - netOf(b))[0];
  function hoopsBracket() {
    const P = G().post, regs = ['East', 'West', 'South', 'Midwest'], seed = {}, out = {};
    regs.forEach(rg => {
      const slot = sd => { const x = P.R[rg].find(y => y.seed === sd); if (!x) return null; if (x.ff) x.ff.forEach(t => { seed[t] = sd; }); if (x.t != null) { seed[x.t] = sd; return x.t; } return x.ff ? (winOf(x.ff[0], x.ff[1])) : null; };
      const r0 = PAIRS.map(([a, b]) => ({ a: slot(a), b: slot(b), sa: a, sb: b, ff: (P.R[rg].find(y => y.seed === a && y.ff) || P.R[rg].find(y => y.seed === b && y.ff) || {}).ff || null }));
      const rounds = [r0];
      for (let k = 1; k < 4; k++) { const prev = rounds[k - 1], nx = []; for (let i = 0; i < prev.length; i += 2) { const A = winOf(prev[i].a, prev[i].b), B = winOf(prev[i + 1].a, prev[i + 1].b); nx.push({ a: A, b: B, sa: seed[A], sb: seed[B] }); } rounds.push(nx); }
      const last = rounds[3][0]; out[rg] = { rounds, champ: winOf(last.a, last.b) };
    });
    const f4 = [{ a: out.East.champ, b: out.West.champ }, { a: out.South.champ, b: out.Midwest.champ }];
    const fin = { a: winOf(f4[0].a, f4[0].b), b: winOf(f4[1].a, f4[1].b) };
    return { regs, out, f4, fin, seed, champ: P.champ };
  }
  // every team inside a block of first-round pairs (to name the likely opponent when it isn't decided yet)
  const blockTeams = (r0, from, n) => { const ids = []; for (let i = from; i < from + n; i++) { const m = r0[i]; if (!m) continue; [m.a, m.b].concat(m.ff || []).forEach(x => { if (x != null && !ids.includes(x)) ids.push(x); }); } return ids; };
  const alive = id => {
    const g = G(), P = g.post; if (!P) return true;
    if (SD.kind() === 'hoops') return !g.sched.some(x => x.kind === 'ncaa' && x.res && ((x.h === id && x.res.h < x.res.a) || (x.a === id && x.res.a < x.res.h)));
    // double elimination: two losses in a regional or World Series bracket; a lost super regional or finals series
    const pods = (P.regs || []).concat(P.ws || []);
    if (pods.some(R => R.teams.includes(id) && R.de && (R.de.losses[id] || 0) >= 2)) return false;
    if (P.regs && P.regs.some(R => R.teams.includes(id) && R.champ != null && R.champ !== id)) return false;
    if (P.sup && P.sup.some(S => (S.a === id || S.b === id) && S.champ != null && S.champ !== id)) return false;
    if (P.ws && P.ws.some(R => R.teams.includes(id) && R.champ != null && R.champ !== id)) return false;
    if (P.fin && (P.fin.a === id || P.fin.b === id) && P.fin.champ != null && P.fin.champ !== id) return false;
    return P.field.includes(id);
  };
  function hoopsPath(B) {
    const g = G(), me = g.user, rg = B.regs.find(r => B.out[r].rounds[0].some(m => m.a === me || m.b === me || (m.ff || []).includes(me)));
    if (!rg) return null;
    const r0 = B.out[rg].rounds[0], idx = r0.findIndex(m => m.a === me || m.b === me || (m.ff || []).includes(me)), steps = [];
    const names = ['First round', 'Second round', 'Sweet 16', 'Elite Eight', 'Final Four', 'National championship'];
    for (let k = 0; k < 4; k++) {
      let opp;
      if (k === 0) { const m = r0[idx]; opp = m.a === me ? m.b : m.a; if (opp == null && m.ff) opp = likely(m.ff.filter(x => x !== me && alive(x))); }
      else { const size = Math.pow(2, k - 1), blk = Math.floor(idx / size) ^ 1; const ids = blockTeams(r0, blk * size, size).filter(alive); const real = B.out[rg].rounds[k][Math.floor(idx / Math.pow(2, k))]; opp = real ? (real.a === me ? real.b : real.a) : null; if (opp == null) opp = likely(ids); }
      steps.push({ round: names[k], opp, game: opp != null ? ncaaGame(me, opp) : null, known: k === 0 || B.out[rg].rounds[k][Math.floor(idx / Math.pow(2, k))] && (B.out[rg].rounds[k][Math.floor(idx / Math.pow(2, k))].a === me || B.out[rg].rounds[k][Math.floor(idx / Math.pow(2, k))].b === me) });
    }
    const semi = (rg === 'East' || rg === 'West') ? 0 : 1, otherR = ['West', 'East', 'Midwest', 'South'][B.regs.indexOf(rg)];
    const f4opp = B.out[otherR].champ != null ? B.out[otherR].champ : likely(blockTeams(B.out[otherR].rounds[0], 0, 8).filter(alive));
    steps.push({ round: names[4], opp: f4opp, game: ncaaGame(me, f4opp), known: B.out[rg].champ === me && B.out[otherR].champ != null });
    const os = B.f4[1 - semi], fo = B.fin[semi === 0 ? 'b' : 'a'] != null ? B.fin[semi === 0 ? 'b' : 'a'] : likely([os.a, os.b].concat(semi === 0 ? blockTeams(B.out.South.rounds[0], 0, 8).concat(blockTeams(B.out.Midwest.rounds[0], 0, 8)) : blockTeams(B.out.East.rounds[0], 0, 8).concat(blockTeams(B.out.West.rounds[0], 0, 8))).filter(x => x != null && alive(x)));
    steps.push({ round: names[5], opp: fo, game: ncaaGame(me, fo), known: false });
    return { rg, steps };
  }
  function tourney(b) {
    const g = G(), P = g.post, me = g.user, ut = SD.userT();
    if (!P) { b.innerHTML = '<div class="box">The field is announced after the conference tournaments.</div>'; return; }
    const tbtn = id => id == null ? '<span class="tb-tm tbd">TBD</span>' : `<button class="tb-tm ${id === me ? 'me' : ''} ${alive(id) ? '' : 'out'}" data-team="${id}" style="--tc:${T(id).c1}">${esc(T(id).name)}</button>`;
    const inField = P.field.includes(me), champ = P.champ != null ? T(P.champ) : null;
    let status;
    if (champ && champ.id === me) status = `<b>${esc(ut.name)} are national champions!</b>`;
    else if (!inField) status = `${esc(ut.name)} missed the field. Follow the bracket below.`;
    else if (!alive(me)) { const lg = g.sched.filter(x => x.kind === 'ncaa' && (x.h === me || x.a === me) && x.res).pop(); status = `${esc(ut.name)}'s run ended in the ${esc((lg && lg.title || '').replace(/^NCAA (East|West|South|Midwest) /, '').replace('NCAA ', '') || 'tournament')}.`; }
    else { const nx = SD.nextUserGame(); status = nx ? `Next: ${nx.title ? esc(nx.title.replace(/^NCAA /, '')) + ' · ' : ''}${SD.dayStr(nx.d)} vs ${esc(T(SD.oppOf(nx)).name)}` : 'Still alive. Waiting on the next round.'; }
    let hero = `<div class="tb-hero"><div><span class="glabel">${hoops() ? 'Road to the Final Four' : 'Road to ' + esc(SD.SP().ncaa.wsSite)}${champ ? ' · Champion: ' + esc(champ.name) : ' · ' + esc(P.label || '')}</span><h2>${inField ? (hoops() ? `No. ${P.seedOf[me] || '?'} seed${P.regionOf[me] ? ', ' + esc(P.regionOf[me]) + ' Region' : ''}` : `No. ${P.seedOf[me]} overall seed`) : 'Not in the field'}</h2><p>${status}</p></div>${inField && alive(me) && !champ ? '<span class="tb-alive">Alive</span>' : ''}</div>`;
    let tops = '', path = '', bracket = '';
    if (hoops()) {
      const B = hoopsBracket();
      const ones = B.regs.map(r => ({ r, t: B.out[r].rounds[0][0].a }));
      tops = `<div class="box"><div class="glabel">The No. 1 seeds</div><div class="tb-tops">${ones.map((o, i) => o.t == null ? '' : `<button class="tb-top ${o.t === me ? 'me' : ''} ${alive(o.t) ? '' : 'out'}" data-team="${o.t}" style="--tc:${T(o.t).c1}"><small>${o.r}${i === 0 && P.field[0] === o.t ? ' · overall No. 1' : ''}</small><b>${esc(T(o.t).name)}</b><span>${T(o.t).w}-${T(o.t).l} · NET ${netOf(o.t)}</span></button>`).join('')}</div></div>`;
      const PA = inField ? hoopsPath(B) : null;
      if (PA) path = `<div class="box"><div class="glabel">${esc(ut.name)}'s path</div><ol class="tb-path">${PA.steps.map(st0 => { const x = st0.game, won = x && ((x.h === me) === (x.res.h > x.res.a)); return `<li class="${x ? (won ? 'won' : 'lost') : ''}"><span class="tb-rd">${st0.round}</span>${st0.opp != null ? `${x ? '' : `<small>${st0.known ? 'vs' : 'likely'}</small> `}${tbtn(st0.opp)} <small>(${B.seed[st0.opp] || '?'})</small>` : '<span class="tbd">TBD</span>'}${x ? ` <b>${won ? 'W' : 'L'} ${x.h === me ? x.res.h + '-' + x.res.a : x.res.a + '-' + x.res.h}</b>` : ''}</li>`; }).join('')}</ol></div>`;
      const myR = PA ? PA.rg : null, sel = V.treg && (B.regs.includes(V.treg) || V.treg === 'F4') ? V.treg : (myR || 'East');
      const match = (m, k, i, onPath) => { const x = m.a != null && m.b != null ? ncaaGame(m.a, m.b) : null, w = x ? (x.res.h > x.res.a ? x.h : x.a) : null, sc = id => x ? (x.h === id ? x.res.h : x.res.a) : '';
        const row = (id, sd, ff) => `<div class="tb-row ${w != null && id === w ? 'w' : ''} ${w != null && id !== w ? 'l' : ''}"><span class="tb-sd">${sd || ''}</span>${id == null && ff ? `<span class="tb-tm tbd">${ff.map(t => esc(T(t).abbr)).join(' / ')}</span>` : tbtn(id)}<b>${sc(id)}</b></div>`;
        return `<div class="tb-m ${onPath ? 'path' : ''}">${row(m.a, m.sa != null ? m.sa : B.seed[m.a], k === 0 && m.ff && m.a == null ? m.ff : null)}${row(m.b, m.sb != null ? m.sb : B.seed[m.b], k === 0 && m.ff && m.b == null ? m.ff : null)}</div>`; };
      const chips = `<div class="gchips dy-chips">${B.regs.concat(['F4']).map(r => `<button data-treg="${r}" aria-pressed="${sel === r}">${r === 'F4' ? 'Final Four' : r}${r === myR ? ' ★' : ''}</button>`).join('')}</div>`;
      if (sel === 'F4') {
        bracket = `<div class="box"><div class="glabel">Final Four & national championship</div>${chips}<div class="tb-br f4"><div class="tb-col"><h4>Final Four</h4>${B.f4.map((m, i) => match(m, 4, i, false)).join('')}</div><div class="tb-col"><h4>Championship</h4>${match(B.fin, 5, 0, false)}${B.champ != null ? `<div class="tb-champ">🏆 ${esc(T(B.champ).name)}</div>` : ''}</div></div></div>`;
      } else {
        const R = B.out[sel], idx = myR === sel && PA ? R.rounds[0].findIndex(m => m.a === me || m.b === me || (m.ff || []).includes(me)) : -1;
        bracket = `<div class="box"><div class="glabel">${sel} Region</div>${chips}<div class="dy-scroll"><div class="tb-br">${R.rounds.map((rd, k) => `<div class="tb-col"><h4>${['First round', 'Second round', 'Sweet 16', 'Elite Eight'][k]}</h4>${rd.map((m, i) => match(m, k, i, idx >= 0 && Math.floor(idx / Math.pow(2, k)) === i)).join('')}</div>`).join('')}<div class="tb-col"><h4>Regional champion</h4><div class="tb-m">${R.champ != null ? `<div class="tb-row w"><span class="tb-sd">${B.seed[R.champ] || ''}</span>${tbtn(R.champ)}<b></b></div>` : '<div class="tb-row"><span class="tb-sd"></span><span class="tb-tm tbd">TBD</span><b></b></div>'}</div></div></div></div></div>`;
      }
    } else {
      const myReg = (P.regs || []).find(R => R.teams.includes(me));
      tops = `<div class="box"><div class="glabel">The top national seeds</div><div class="tb-tops">${P.field.slice(0, 8).map((t, i) => `<button class="tb-top ${t === me ? 'me' : ''} ${alive(t) ? '' : 'out'}" data-team="${t}" style="--tc:${T(t).c1}"><small>No. ${i + 1} national seed</small><b>${esc(T(t).name)}</b><span>${T(t).w}-${T(t).l} · RPI ${netOf(t)}</span></button>`).join('')}</div></div>`;
      const pod = R => { const de = R.de || { losses: {} }; return `<div class="tb-pod ${R.teams.includes(me) ? 'mine' : ''}"><div class="glabel">${R.host != null ? esc(T(R.host).name) + ' Regional' + (R.nat ? ' · No. ' + R.nat : '') : 'Bracket'}</div>${R.teams.map((t, i) => { const gs = (de.games || []).filter(x => x.res && (x.h === t || x.a === t)), w = gs.filter(x => (x.h === t) === (x.res.h > x.res.a)).length; return `<div class="tb-row ${de.done === t || R.champ === t ? 'w' : ''} ${(de.losses[t] || 0) >= 2 ? 'l' : ''}"><span class="tb-sd">${i + 1}</span>${tbtn(t)}<b>${gs.length ? w + '-' + (gs.length - w) : ''}</b></div>`; }).join('')}</div>`; };
      const sups = P.sup ? P.sup.map(S => `<div class="tb-pod ${S.a === me || S.b === me ? 'mine' : ''}"><div class="glabel">Super regional at ${esc(T(S.host).name)}</div>${[S.a, S.b].map(t => `<div class="tb-row ${S.champ === t ? 'w' : ''} ${S.champ != null && S.champ !== t ? 'l' : ''}">${tbtn(t)}<b>${S.wins[t]}</b></div>`).join('')}</div>`).join('') : '';
      const supOf = i => { const order = [[0, 15], [7, 8], [3, 12], [4, 11], [1, 14], [6, 9], [2, 13], [5, 10]]; return order.findIndex(p => p.includes(i)); };
      if (myReg) {
        const ri = P.regs.indexOf(myReg), si = supOf(ri), pr = [[0, 15], [7, 8], [3, 12], [4, 11], [1, 14], [6, 9], [2, 13], [5, 10]][si], other = P.regs[pr[0] === ri ? pr[1] : pr[0]];
        const supOpp = P.sup ? (P.sup[si].a === me ? P.sup[si].b : P.sup[si].a) : likely(other.teams.filter(alive));
        const wsSide = si < 4 ? 0 : 1, wsOpps = P.ws ? P.ws[wsSide].teams.filter(t => t !== me) : [];
        path = `<div class="box"><div class="glabel">${esc(ut.name)}'s path</div><ol class="tb-path"><li class="${myReg.champ === me ? 'won' : (myReg.de && (myReg.de.losses[me] || 0) >= 2) ? 'lost' : ''}"><span class="tb-rd">Regional</span>${myReg.host === me ? 'Hosting the ' : 'At the '}${esc(T(myReg.host).name)} Regional: ${myReg.teams.filter(t => t !== me).map(tbtn).join(', ')}</li>
          <li class="${P.sup && P.sup[si].champ === me ? 'won' : P.sup && P.sup[si].champ != null ? 'lost' : ''}"><span class="tb-rd">Super regional</span>${P.sup ? 'vs' : '<small>likely</small>'} ${tbtn(supOpp)}${P.sup ? ` <b>${P.sup[si].wins[me] != null ? P.sup[si].wins[me] + '-' + P.sup[si].wins[supOpp] : ''}</b>` : ''}</li>
          <li><span class="tb-rd">${esc(SD.SP().ncaa.wsName)}</span>${wsOpps.length ? `Bracket ${wsSide + 1}: ${wsOpps.map(tbtn).join(', ')}` : '<span class="tbd">Eight teams in ' + esc(SD.SP().ncaa.wsSite) + '</span>'}</li><li><span class="tb-rd">Finals</span><span class="tbd">Best of three</span></li></ol></div>`;
      }
      const sel = V.treg && ['REG', 'SUP', 'WS'].includes(V.treg) ? V.treg : (P.ws ? 'WS' : P.sup ? 'SUP' : 'REG');
      const chips = `<div class="gchips dy-chips">${[['REG', 'Regionals'], ['SUP', 'Super regionals'], ['WS', SD.SP().ncaa.wsName]].map(([k, l]) => `<button data-treg="${k}" aria-pressed="${sel === k}">${l}</button>`).join('')}</div>`;
      const body = sel === 'REG' ? `<div class="tb-pods">${P.regs.slice().sort((x, y) => (y.teams.includes(me) ? 1 : 0) - (x.teams.includes(me) ? 1 : 0)).map(pod).join('')}</div>` : sel === 'SUP' ? (sups ? `<div class="tb-pods">${sups}</div>` : '<p class="dim">Set after the regionals.</p>') : (P.ws ? `<div class="tb-pods">${P.ws.map(pod).join('')}${P.fin ? `<div class="tb-pod"><div class="glabel">Finals (best of three)</div>${[P.fin.a, P.fin.b].map(t => `<div class="tb-row ${P.fin.champ === t ? 'w' : ''}">${tbtn(t)}<b>${P.fin.wins[t]}</b></div>`).join('')}</div>` : ''}</div>${P.champ != null ? `<div class="tb-champ">🏆 ${esc(T(P.champ).name)}</div>` : ''}` : '<p class="dim">Eight teams reach the World Series after the supers.</p>');
      bracket = `<div class="box"><div class="glabel">The bracket</div>${chips}${body}</div>`;
    }
    b.innerHTML = `${hero}<div class="dy-grid"><div class="dy-col">${path || tops}</div><div class="dy-col">${path ? tops : ''}</div></div>${bracket}`;
  }
  function teamCard(id) {
    const t = T(id); if (!t) return;
    const ps = t.roster.map(SD.P).filter(Boolean).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    const n = t.net || {};
    modal(`<div class="dy-pc" style="--tc:${t.c1}"><h3>${esc(t.name)}</h3><p class="dim">${esc(SD.CONF_NAME[t.conf] || t.conf)} · ${t.w}-${t.l} (${t.cw}-${t.cl} conference)${t.confChamp === G().season ? ' · conference champion' : ''}</p>
      <div class="dy-stats4"><div><b>${n.rank || '—'}</b><small>${SD.netName()}</small></div><div><b>${n.sos || '—'}</b><small>Schedule rank</small></div><div><b>${SD.teamRating(t)}</b><small>Team rating</small></div><div><b>${G().post && G().post.seedOf ? G().post.seedOf[id] || '—' : '—'}</b><small>${hoops() ? 'Seed' : 'National seed'}</small></div></div>
      ${hoops() && n.q ? `<p class="small">Quad 1: <b>${n.q[0][0]}-${n.q[0][1]}</b> · Quad 2: ${n.q[1][0]}-${n.q[1][1]} · Quad 3: ${n.q[2][0]}-${n.q[2][1]} · Quad 4: ${n.q[3][0]}-${n.q[3][1]}</p>` : ''}
      <div class="glabel">Best players</div><ul class="dy-mini">${ps.map(p => `<li>${plink(p)} <small>${p.pos} · ${yrLabel(p)} · ${p.ovr}</small></li>`).join('')}</ul></div>`);
  }

  /* ---------- the selection show ---------- */
  function selectionShow(b) {
    const g = G(), P = g.post, me = g.user, ut = SD.userT(), net = t => T(t).net ? T(t).net.rank : '';
    const line = (seed, tid, ff, i) => {
      const nm = ff ? ff.map(id => esc(T(id).name)).join(' / ') : esc(T(tid).name), mine = ff ? ff.includes(me) : tid === me;
      const rec = ff ? 'First Four' : `${T(tid).w}-${T(tid).l} · ${SD.netName()} ${net(tid)}`;
      return `<li class="ss-ln ${mine ? 'me' : ''}" style="--d:${i}"><span class="ss-sd">${seed}</span><span class="ss-tm" style="--tc:${T(ff ? ff[0] : tid).c1}">${nm}</span><small>${rec}</small></li>`;
    };
    let body = '', mineTxt = '', i = 0;
    if (hoops()) {
      const regs = ['East', 'West', 'South', 'Midwest'], myR = P.regionOf[me], order = regs.filter(r => r !== myR).concat(myR ? [myR] : []);
      const ones = order.map(r => P.R[r].find(x => x.seed === 1)).filter(Boolean);
      body += `<div class="ss-box"><div class="glabel">The No. 1 seeds</div><ol class="ss-list">${ones.map((x, j) => line(1, x.t, x.ff, i++)).join('')}</ol></div>`;
      body += `<div class="ss-regs">${order.map(r => `<div class="ss-box ${r === myR ? 'mine' : ''}"><div class="glabel">${r} Region</div><ol class="ss-list">${P.R[r].slice().sort((a, b) => a.seed - b.seed).map(x => line(x.seed, x.t, x.ff, i++)).join('')}</ol></div>`).join('')}</div>`;
      mineTxt = P.field.includes(me) ? `${esc(ut.name)} is a No. ${P.seedOf[me] || (P.R[myR] || []).find(x => x.ff && x.ff.includes(me))?.seed || '?'} seed in the ${myR || (Object.keys(P.R).find(r => P.R[r].some(x => x.ff && x.ff.includes(me))) || '')} Region${P.seedOf[me] ? '' : ' (First Four)'}` : `${esc(ut.name)} is not in the field`;
    } else {
      const regs = P.regs.slice(), myR = regs.find(R => R.teams.includes(me)), order = regs.filter(R => R !== myR).concat(myR ? [myR] : []);
      body += `<div class="ss-regs four">${order.map(R => `<div class="ss-box ${R === myR ? 'mine' : ''}"><div class="glabel">${esc(T(R.host).name)} Regional · No. ${R.nat} national seed</div><ol class="ss-list">${R.teams.map((t, j) => line(j + 1, t, null, i++)).join('')}</ol></div>`).join('')}</div>`;
      mineTxt = myR ? `${esc(ut.name)} is the No. ${P.seedOf[me]} overall seed${myR.host === me ? ' and hosts a regional' : ` in the ${esc(T(myR.host).name)} Regional`}` : `${esc(ut.name)} is not in the field`;
    }
    const bub = P.bubble || { lastIn: [], firstOut: [] };
    body += `<div class="ss-box"><div class="glabel">On the bubble</div><div class="ss-bub"><div><b>Last four in</b><ol class="ss-list">${bub.lastIn.map(t => line('', t, null, i++)).join('')}</ol></div><div><b>First four out</b><ol class="ss-list">${bub.firstOut.map(t => line('', t, null, i++)).join('')}</ol></div></div></div>`;
    b.innerHTML = `<div class="ss" id="ssRoot" style="--n:${i}"><div class="ss-hero"><span class="glabel">${hoops() ? 'Selection Sunday' : 'NCAA Tournament selection show'} · ${SD.dateStr(g.date)}</span><h2>${hoops() ? 'The field of 68' : 'The field of 64'}</h2><p>${P.autos.length} automatic bids, ${P.field.length - P.autos.length} at-large picks. The committee ranks teams by the ${SD.netName()}${hoops() ? ' (results by quadrant, scoring margin and strength of schedule)' : ' (winning percentage and strength of schedule, road wins count more)'}.</p><button class="btn" id="ssSkip">Skip to the bracket</button></div>
      ${body}
      <div class="ss-me ${P.field.includes(me) ? 'in' : 'out'}"><b>${mineTxt}</b><button class="btn primary big" data-act="ssdone">Open the bracket</button></div></div>`;
    const root = b.querySelector('#ssRoot');
    b.querySelector('#ssSkip').onclick = () => root.classList.add('done');
  }
  function campCard() {
    const g = G(), C = SD.campState(), ut = SD.userT(), F = SD.CAMP[SD.kind()];
    if (C.done) return `<div class="box"><div class="glabel">Preseason camp: ${esc(F[C.focus][0])}</div><ul class="dy-mini">${(C.res || []).slice(0, 8).map(x => `<li>${plink(SD.P(x.id))} <small>${x.before} → <b>${x.after}</b>${x.extra ? ' · extra reps' : ''}</small></li>`).join('')}</ul></div>`;
    const ps = ut.roster.map(SD.P).sort((a, b) => b.ovr - a.ovr);
    return `<div class="box"><div class="glabel">Preseason camp</div><p class="small dim">Pick a team focus and up to three players for extra reps (young players with a high ceiling gain the most). Work ethic matters. If you skip it, your staff runs camp when the season starts.</p>
      <div class="gchips dy-chips">${Object.entries(F).map(([k, v]) => `<button data-campf="${k}" aria-pressed="${C.focus === k}">${esc(v[0])}</button>`).join('')}</div>
      <div class="dy-scroll" style="max-height:260px"><table class="dyt dy-tight"><tbody>${ps.map(p => `<tr class="${C.picks.includes(p.id) ? 'me' : ''}"><td><button class="dy-ra ${C.picks.includes(p.id) ? 'on' : ''}" data-campp="${p.id}">${C.picks.includes(p.id) ? 'Extra reps ✓' : 'Extra reps'}</button></td><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></td><td>${ovrB(p.ovr)}</td><td><span class="dy-pot">${p.potG}</span></td><td class="small">Work ${p.tr.work}</td></tr>`).join('')}</tbody></table></div>
      <div class="grow"><button class="btn primary" data-act="camp">Run camp</button><span class="small dim">${C.picks.length}/3 picked</span></div></div>`;
  }
  function depthPreview() {
    const ut = SD.userT(), o = SD.teamOvr(ut);
    if (hoops()) {
      const L = SD.lineup(ut);
      return `<div class="box"><div class="glabel">Preseason depth chart <button class="glink" data-tab="lineup">Edit rotation</button></div><p class="small">Team rating <b>${SD.teamRating(ut)}</b></p>
        <div class="dy-depth"><div class="dy-dg"><h4>Starting five</h4><ol>${L.slice(0, 5).map(p => `<li class="st"><span class="dy-dn">${p.pos}</span><span class="dy-dname">${plink(p)} <small>${yrLabel(p)}</small></span>${ovrB(p.ovr)}</li>`).join('')}</ol></div>
        <div class="dy-dg"><h4>Bench</h4><ol>${L.slice(5, 10).map((p, i) => `<li><span class="dy-dn">${i + 6}</span><span class="dy-dname">${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></span>${ovrB(p.ovr)}</li>`).join('')}</ol></div></div></div>`;
    }
    const D = SD.diamondLineup(ut), posOf = p => Object.keys(D.field).find(k => D.field[k] === p) || 'DH';
    return `<div class="box"><div class="glabel">Preseason depth chart <button class="glink" data-tab="lineup">Edit lineup</button></div><p class="small">Offense <b>${o.off}</b> · Rotation <b>${o.rot}</b> · Bullpen <b>${o.pen}</b></p>
      <div class="dy-depth"><div class="dy-dg"><h4>Batting order</h4><ol>${D.order.map((p, i) => `<li class="st"><span class="dy-dn">${i + 1}</span><span class="dy-dname">${plink(p)} <small>${posOf(p)}</small></span>${ovrB(p.ovr)}</li>`).join('')}</ol></div>
      <div class="dy-dg"><h4>${G().sport === 'softball' ? 'The circle' : 'Rotation'}</h4><ol>${D.rotation.slice(0, G().sport === 'softball' ? 3 : 4).map((p, i) => `<li class="st"><span class="dy-dn">${G().sport === 'softball' ? ['Ace', 'No. 2', 'No. 3'][i] : ['Fri', 'Sat', 'Sun', 'Mid'][i]}</span><span class="dy-dname">${plink(p)}</span>${ovrB(p.ovr)}</li>`).join('')}${D.closer ? `<li><span class="dy-dn">CL</span><span class="dy-dname">${plink(D.closer)}</span>${ovrB(D.closer.ovr)}</li>` : ''}</ol></div></div></div>`;
  }
  function nextGameCard(x) {
    const g = G(), ut = SD.userT(), o = T(SD.oppOf(x)), home = x.h === ut.id && !x.neutral;
    const ro = SD.teamRating(o), ru = SD.teamRating(ut);
    const star = o.roster.map(SD.P).sort((a, b) => b.ovr - a.ovr)[0];
    return `<div class="box dy-next" style="--tc:${o.c1}">
      <div class="dy-next-top"><span class="glabel">${x.title ? esc(x.title) + ' · ' : ''}${SD.dayStr(x.d)}</span>${x.conf ? `<span class="dy-tag">${esc(SD.UC())}</span>` : ''}</div>
      <div class="dy-vs"><div class="dy-vs-t">${tlink(ut.id)}<small>${ut.w}-${ut.l}</small></div><b>${home ? 'vs' : x.neutral ? 'vs' : 'at'}</b><div class="dy-vs-t r">${tlink(o.id)}<small>${o.w != null ? o.w + '-' + o.l + ' · ' : ''}${o.guest ? 'Non-league' : esc(SD.CONF_NAME[o.conf] || o.conf)}</small></div></div>
      <p class="dim small">${x.neutral ? 'Neutral site' : home ? (!SD.isTN() ? esc(ut.name) + ' home ' + (hoops() ? 'court' : 'field') : hoops() ? (SD.SP().he === 'she' ? 'Thompson-Boling Arena' : 'Food City Center at Thompson-Boling') : g.sport === 'softball' ? 'Sherri Parker Lee Stadium' : 'Lindsey Nelson Stadium') : esc(o.name) + ' home game'} · Team rating ${ru} vs. ${ro}${star ? ` · Watch: ${plink(star)} (${star.pos}, ${star.ovr})` : ''}</p>
      <div class="grow"><button class="btn primary big" data-act="main">${g.settings.coachMode === 'watch' ? 'Watch the game' : 'Play the game'}</button><button class="btn" data-act="sim">Sim it</button></div></div>`;
  }
  function postCard() {
    const g = G();
    if (g.phase === 'ct') { const C = g.ct && g.ct[SD.UC()]; if (!C) return ''; return `<div class="box"><div class="glabel">${esc(C.name)}</div><ol class="dy-seeds">${C.seeds.map((id, i) => `<li class="${id === g.user ? 'me' : ''}"><span>${i + 1}</span>${tlink(id, false)}<small>${T(id).cw}-${T(id).cl}</small></li>`).join('')}</ol></div>`; }
    const P = g.post; if (!P) return '';
    const me = P.field.includes(g.user);
    return `<div class="box"><div class="glabel">NCAA Tournament · ${esc(P.label)}</div><p>${me ? (hoops() ? `${esc(SD.UN())}: No. ${P.seedOf[g.user]} seed, ${esc(P.regionOf[g.user])} Region.` : `${esc(SD.UN())}: No. ${P.seedOf[g.user]} overall seed.`) : `${esc(SD.UN())} is not in the field.`}</p>
      <div class="dy-scroll"><table class="dyt dy-tight"><tbody>${(P.cur || []).slice(0, 24).map(x => `<tr class="${x.h === g.user || x.a === g.user ? 'me' : ''}"><td class="small">${esc(x.title || '')}</td><td>${tlink(x.h, false)}${P.seedOf[x.h] ? ` <small>(${P.seedOf[x.h]})</small>` : ''}</td><td>${tlink(x.a, false)}${P.seedOf[x.a] ? ` <small>(${P.seedOf[x.a]})</small>` : ''}</td><td>${x.res ? x.res.h + '-' + x.res.a : SD.dateStr(x.d)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function newsCard() { const g = G(), n = V.more.news ? 30 : 6; return `<div class="box"><div class="glabel">News</div><ul class="dy-news">${g.news.slice(0, n).map(x => `<li class="n-${x.type}"><b>${esc(x.h)}</b>${x.b ? `<span>${esc(x.b)}</span>` : ''}<small>${x.d ? SD.dateStr(x.d) : x.y}</small></li>`).join('')}</ul>${g.news.length > 6 ? `<button class="glink" data-more="news">${V.more.news ? 'Show less' : 'More news'}</button>` : ''}</div>`; }
  function pollMini() { const g = G(); return `<div class="box"><div class="glabel">${hoops() ? 'AP Top 25' : 'Top 25'} <button class="glink" data-tab="polls">All</button></div><ol class="dy-poll">${g.polls.ap.slice(0, 10).map((x, i) => `<li class="${x.t === g.user ? 'me' : ''}"><span>${i + 1}</span>${tlink(x.t, false)}<small>${T(x.t).w}-${T(x.t).l}</small></li>`).join('')}</ol></div>`; }
  function standMini() { const st = SD.standings(SD.UC()); return `<div class="box"><div class="glabel">${esc(SD.UCN())} standings <button class="glink" data-tab="standings">All</button></div><ol class="dy-poll">${st.slice(0, 10).map((t, i) => `<li class="${t.id === G().user ? 'me' : ''}"><span>${i + 1}</span>${tlink(t.id)}<small>${t.cw}-${t.cl}</small></li>`).join('')}</ol></div>`; }
  function leadersMini() {
    const ut = SD.userT(), ps = ut.roster.map(SD.P).filter(p => sStats(p));
    const best = (f, fmt) => { const r = ps.filter(p => f(sStats(p)) > 0).sort((a, b) => f(sStats(b)) - f(sStats(a)))[0]; return r ? `<li>${plink(r)} <small>${fmt(sStats(r))}</small></li>` : ''; };
    const rows = hoops() ? [best(s => s.pts / s.gp, s => f1(s.pts, s.gp) + ' ppg'), best(s => (s.orb + s.drb) / s.gp, s => f1(s.orb + s.drb, s.gp) + ' rpg'), best(s => s.ast / s.gp, s => f1(s.ast, s.gp) + ' apg')]
      : [best(s => s.ab >= 20 ? s.h / s.ab : 0, s => avg3(s.h, s.ab) + ' AVG'), best(s => s.hr, s => s.hr + ' HR'), best(s => s.ipo >= 30 ? 100 - s.er * 9 / (s.ipo / 3) : 0, s => (s.er * (G().sport === 'softball' ? 7 : 9) / (s.ipo / 3)).toFixed(2) + ' ERA')];
    return `<div class="box"><div class="glabel">Team leaders <button class="glink" data-tab="stats">Stats</button></div><ul class="dy-mini">${rows.join('') || '<li class="dim">After the first game.</li>'}</ul></div>`;
  }
  function recruitMini() { const g = G(), R = g.recruit; if (!R) return ''; const c = SD.myCommits(); return `<div class="box"><div class="glabel">Class of ${R.year} <button class="glink" data-tab="recruit">Recruiting</button></div><p>${R.classRank ? `No. ${R.classRank} class · ` : ''}${c.length} commit${c.length === 1 ? '' : 's'}</p><ul class="dy-mini">${c.slice(0, 5).map(p => `<li><span class="dy-stars">${stars(p.rec.stars)}</span> ${esc(p.n)} <small>${p.pos}</small></li>`).join('')}</ul></div>`; }

  /* ---------- schedule ---------- */
  function schedule(b) {
    const g = G(), ut = SD.userT();
    const rows = SD.userGames().map(x => { const o = T(SD.oppOf(x)), home = x.h === ut.id, won = x.res && (home === (x.res.h > x.res.a)); return `<tr class="${x.res ? '' : 'up'}"><td>${SD.dayStr(x.d)}</td><td>${x.neutral ? 'vs' : home ? 'vs' : 'at'} ${tlink(o.id)}${x.title ? ` <small class="dim">${esc(x.title)}</small>` : x.conf ? ` <small class="dim">${esc(SD.UC())}</small>` : ''}</td><td>${x.res ? `<b class="${won ? 'dy-w' : 'dy-l'}">${won ? 'W' : 'L'}</b> ${home ? x.res.h + '-' + x.res.a : x.res.a + '-' + x.res.h}${x.res.ot ? (hoops() ? ' OT' : ` (${x.res.inn})`) : ''}${x.box ? ` <button class="glink" data-gid="${x.id}">Box</button>` : ''}` : ''}</td></tr>`; }).join('');
    b.innerHTML = `<div class="box"><div class="glabel">${SD.SP().label(g.season)} schedule · ${ut.w}-${ut.l}</div><div class="dy-scroll"><table class="dyt"><tbody>${rows}</tbody></table></div></div>`;
  }
  function boxCard(id) {
    const g = G(), x = g.sched.find(y => y.id === id); if (!x || !x.box) return;
    modal(`<h3>${esc(T(x.a).name)} ${x.res.a}, ${esc(T(x.h).name)} ${x.res.h}</h3><p class="dim">${SD.dayStr(x.d)}${x.title ? ' · ' + esc(x.title) : ''}</p>${root.SDG ? root.SDG.boxHtml({ h: T(x.h), a: T(x.a) }, x.box.ps, x.box.ls) : ''}`);
  }

  /* ---------- roster ---------- */
  function roster(b) {
    const ut = SD.userT(), pos = SD.POS[SD.kind()];
    const ps = ut.roster.map(SD.P).filter(p => V.rpos === 'ALL' || p.pos === V.rpos || (V.rpos === 'P' && SD.isPit(p))).sort((a, b) => b.ovr - a.ovr);
    const posBtns = ['ALL'].concat(hoops() ? pos : ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH', 'P']);
    b.innerHTML = `<div class="box"><div class="glabel">Roster · ${ut.roster.length} of ${SD.LIMIT[G().sport]}</div><div class="gchips dy-chips">${posBtns.map(x => `<button data-rpos="${x}" aria-pressed="${V.rpos === x}">${x === 'ALL' ? 'All' : x}</button>`).join('')}</div>
      <div class="dy-scroll"><table class="dyt"><thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Class</th><th>${hoops() ? 'Ht' : 'B/T'}</th><th>OVR</th><th>POT</th><th class="hide-s">Personality</th><th class="hide-s">NIL</th></tr></thead><tbody>${ps.map(p => `<tr><td class="dim">${p.num}</td><td>${plink(p)}${p.real ? '' : ' <small class="dim">*</small>'}</td><td>${p.pos}</td><td>${yrLabel(p)}</td><td>${hoops() ? SD.htStr(p.ht) : esc(p.bt || '')}</td><td>${ovrB(p.ovr)}</td><td><span class="dy-pot">${p.potG}</span></td><td class="hide-s small">${esc(SD.persLabel(p)[0])}</td><td class="hide-s small">${SD.money(p.nil || 0)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small dim">* not on the real roster (recruits, transfers and walk-ons in your dynasty).</p></div>`;
  }

  /* ---------- the lineup (hoops: rotation and strategy; diamond: the nine, the order, the rotation, the closer) ---------- */
  function lineup(b) {
    const ut = SD.userT(), c = Object.assign({ pace: 'normal', focus: 'bal', def: 'man', depth: '9' }, ut.coach || {});
    if (hoops()) {
      const L = SD.lineup(ut);
      const sel = (k, opts) => `<select data-coach="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(c[k]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      b.innerHTML = `<div class="dy-grid"><div class="dy-col"><div class="box"><div class="glabel">Rotation</div><p class="small dim">The first five start; the order sets who gets minutes. Stars play more, foul trouble and fatigue change it in the game, and the closing lineup is your best five.</p>
        <div class="dy-scroll"><table class="dyt"><tbody>${L.map((p, i) => `<tr class="${i < 5 ? 'st' : ''}"><td class="dim">${i < 5 ? 'Starter' : i + 1}</td><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></td><td>${ovrB(p.ovr)}</td><td><button class="dy-ra" data-rot="${p.id}|-1" ${i === 0 ? 'disabled' : ''}>▲</button><button class="dy-ra" data-rot="${p.id}|1" ${i === L.length - 1 ? 'disabled' : ''}>▼</button></td></tr>`).join('')}</tbody></table></div></div></div>
        <div class="dy-col"><div class="box"><div class="glabel">Team strategy</div>
        <div class="gfield"><div class="glabel">Pace</div>${sel('pace', [['slow', 'Slow it down'], ['normal', 'Normal'], ['fast', 'Push the pace']])}</div>
        <div class="gfield"><div class="glabel">Offense</div>${sel('focus', [['bal', 'Balanced'], ['rim', 'Attack the rim'], ['three', 'Let it fly (threes)'], ['post', 'Feed the post'], ['star', 'Ride the star']])}</div>
        <div class="gfield"><div class="glabel">Defense</div>${sel('def', [['man', 'Man-to-man'], ['zone', '2-3 zone'], ['press', 'Full-court press']])}</div>
        <div class="gfield"><div class="glabel">Rotation depth</div>${sel('depth', [['7', '7 players'], ['8', '8 players'], ['9', '9 players'], ['10', '10 players']])}</div></div></div></div>`;
      return;
    }
    const D = SD.diamondLineup(ut), hit = ut.roster.map(SD.P).filter(p => !SD.isPit(p)), pit = ut.roster.map(SD.P).filter(SD.isPit);
    const posSel = pos => `<select data-fpos="${pos}">${hit.map(p => `<option value="${p.id}" ${D.field[pos] === p ? 'selected' : ''}>${esc(p.n)} (${p.pos}, ${pos === 'DH' ? p.ovr : SD.ovrAt(p, pos)})</option>`).join('')}</select>`;
    const posOf = p => Object.keys(D.field).find(k => D.field[k] === p) || '';
    b.innerHTML = `<div class="dy-grid"><div class="dy-col"><div class="box"><div class="glabel">Batting order</div><div class="dy-scroll"><table class="dyt"><tbody>${D.order.map((p, i) => `<tr><td class="dim">${i + 1}</td><td>${plink(p)} <small>${posOf(p)}</small></td><td class="small">${esc(p.bt || '')}</td><td>${ovrB(p.ovr)}</td><td><button class="dy-ra" data-ord="${p.id}|-1" ${i === 0 ? 'disabled' : ''}>▲</button><button class="dy-ra" data-ord="${p.id}|1" ${i === 8 ? 'disabled' : ''}>▼</button></td></tr>`).join('')}</tbody></table></div></div>
      <div class="box"><div class="glabel">The field</div>${['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH'].map(pos => `<label class="dy-rotrow"><span>${pos === 'DH' && G().sport === 'softball' ? 'DP' : pos}</span>${posSel(pos)}<b></b></label>`).join('')}<p class="small dim">Out of position costs a player a few points (a shortstop can play anywhere; a first baseman cannot).</p></div></div>
      <div class="dy-col"><div class="box"><div class="glabel">${G().sport === 'softball' ? 'The circle' : 'Weekend rotation'}</div>${D.rotation.slice(0, G().sport === 'softball' ? 3 : 4).map((p, i) => `<label class="dy-rotrow"><span>${G().sport === 'softball' ? ['Ace', 'No. 2', 'No. 3'][i] : ['Friday', 'Saturday', 'Sunday', 'Midweek'][i]}</span><select data-rotsp="${i}">${pit.map(q => `<option value="${q.id}" ${q === p ? 'selected' : ''}>${esc(q.n)} (${q.ovr})</option>`).join('')}</select><b></b></label>`).join('')}
      <label class="dy-rotrow"><span>Closer</span><select data-closer="1">${pit.map(q => `<option value="${q.id}" ${q === D.closer ? 'selected' : ''}>${esc(q.n)} (${q.ovr})</option>`).join('')}</select><b></b></label></div>
      <div class="box"><div class="glabel">Bullpen</div><ul class="dy-mini">${D.pen.map(p => `<li>${plink(p)} <small>${p.pos} · ${p.ovr} · velo ${p.at.vel}, stuff ${p.at.stf}, control ${p.at.ctl}</small></li>`).join('')}</ul></div></div></div>`;
  }

  /* ---------- recruiting ---------- */
  function recruit(b) {
    const g = G(), R = g.recruit, ut = SD.userT();
    if (!R) { b.innerHTML = '<div class="box">No recruiting class yet.</div>'; return; }
    const commits = SD.myCommits(), F = V.rfind;
    const board = R.board.map(id => R.pool[id]).filter(Boolean);
    const homeGames = SD.userGames().filter(x => x.h === ut.id && !x.neutral && !x.res && x.d > g.date);
    const card = p => { const lead = Object.entries(p.interest).sort((a, b) => b[1] - a[1])[0], mine = p.interest[ut.id] || 0; return `<tr><td><span class="dy-stars">${stars(p.rec.stars)}</span> ${esc(p.n)} <small>${p.pos} · No. ${p.rec.natl} · ${esc(p.home)}</small><br><small class="dim">Wants: ${p.pref.map(k => ({ pt: 'playing time', nil: 'NIL', champ: 'a contender', prox: 'close to home', brand: 'exposure', dev: 'development' })[k]).join(', ')}</small></td>
      <td>${p.commit != null ? `<b>${p.commit === g.user ? 'Committed' : 'To ' + esc(T(p.commit).name)}</b>` : lead ? `${esc(T(+lead[0]).abbr)} leads<br><small>you ${Math.round(mine)} · top ${Math.round(lead[1])}</small>` : ''}</td>
      <td>${p.commit === g.user ? '' : `${p.offer ? '<small>Offered</small>' : `<button class="dy-ra" data-roffer="${p.id}">Offer</button>`} ${Object.entries(SD.ACTIONS).map(([k, a]) => `<button class="dy-ra ${p.acts[k] ? 'on' : ''}" data-ract="${p.id}|${k}" title="${a.hrs} hours">${a.name}</button>`).join('')}
        <select data-rnil="${p.id}"><option value="0">No NIL</option>${[10000, 25000, 50000, 100000, 200000, 400000].map(v => `<option value="${v}" ${p.nilOffer === v ? 'selected' : ''}>NIL ${SD.money(v)}</option>`).join('')}</select>
        ${p.visit ? `<small>Visit ${SD.dateStr(p.visit)}</small>` : homeGames.length ? `<select data-rvisit="${p.id}"><option value="">Official visit…</option>${homeGames.slice(0, 8).map(x => `<option value="${x.d}">${SD.dateStr(x.d)} vs ${esc(T(x.a).abbr)}</option>`).join('')}</select>` : ''}
        <button class="dy-ra" data-rrm="${p.id}">Remove</button>`}</td></tr>`; };
    const pool = Object.values(R.pool).filter(p => !R.board.includes(p.id) && p.commit !== g.user && (F.pos === 'ALL' || p.pos === F.pos) && (!F.stars || p.rec.stars === F.stars) && (!F.q || p.n.toLowerCase().includes(F.q.toLowerCase()))).sort((a, b) => a.rec.natl - b.rec.natl).slice(0, V.more.rpool ? 120 : 30);
    b.innerHTML = `<div class="box"><div class="glabel">Class of ${R.year}</div><div class="dy-stats4"><div><b>${R.classRank ? 'No. ' + R.classRank : '—'}</b><small>Class rank</small></div><div><b>${commits.length}/${SD.CLASS[g.sport]}</b><small>Commits</small></div><div><b>${SD.HOURS() - SD.hoursUsed()}</b><small>Hours left this week</small></div><div><b>${board.length}/20</b><small>Board</small></div></div>
      ${g.settings.recruiting === 'auto' ? '<p><span class="chip">Auto</span> Your staff runs the board.</p>' : '<p class="small dim">Each week (Mondays) your calls, visits and NIL promises add interest. Four- and five-stars want an official visit to a home game before they commit. Other programs are recruiting the same kids.</p>'}
      ${commits.length ? `<ul class="dy-mini">${commits.map(p => `<li><span class="dy-stars">${stars(p.rec.stars)}</span> ${esc(p.n)} <small>${p.pos} · No. ${p.rec.natl}${p.real ? ' · real commitment' : ''}</small></li>`).join('')}</ul>` : ''}</div>
      <div class="box"><div class="glabel">Your board</div><div class="dy-scroll"><table class="dyt"><tbody>${board.map(card).join('') || '<tr><td class="dim">Add prospects from the list below.</td></tr>'}</tbody></table></div></div>
      <div class="box"><div class="glabel">Prospects</div><div class="gchips dy-chips">${['ALL'].concat(SD.POS[SD.kind()]).map(x => `<button data-rfind="pos|${x}" aria-pressed="${F.pos === x}">${x === 'ALL' ? 'All' : x}</button>`).join('')} ${[0, 5, 4, 3, 2].map(s => `<button data-rfind="stars|${s}" aria-pressed="${F.stars === s}">${s ? s + '★' : 'Any'}</button>`).join('')}</div>
        <input id="sdRq" class="dy-in" placeholder="Search by name" value="${esc(F.q)}">
        <div class="dy-scroll"><table class="dyt"><tbody>${pool.map(p => `<tr><td><span class="dy-stars">${stars(p.rec.stars)}</span> ${esc(p.n)} <small>${p.pos} · No. ${p.rec.natl} · ${esc(p.home)}</small></td><td>${p.commit != null ? '<small>Committed to ' + esc(T(p.commit).name) + '</small>' : `<button class="dy-ra" data-radd="${p.id}">Add to board</button>`}</td></tr>`).join('')}</tbody></table></div><button class="glink" data-more="rpool">${V.more.rpool ? 'Fewer' : 'More prospects'}</button></div>`;
  }

  /* ---------- rankings, standings ---------- */
  function polls(b) {
    const g = G(), net = SD.netRank(), me = net.findIndex(t => t.id === g.user), n = V.more.net ? 100 : 30;
    const q = t => t.net.q.map(x => `${x[0]}-${x[1]}`);
    const rows = net.slice(0, n).concat(me >= n ? [net[me]] : []);
    b.innerHTML = `<div class="dy-grid"><div class="dy-col"><div class="box"><div class="glabel">${hoops() ? 'AP Top 25' : 'Top 25'}</div><ol class="dy-poll">${g.polls.ap.map((x, i) => `<li class="${x.t === g.user ? 'me' : ''}"><span>${i + 1}</span>${tlink(x.t, false)}<small>${T(x.t).w}-${T(x.t).l}${x.prev ? ` · was ${x.prev}` : ''}</small></li>`).join('')}</ol></div></div>
      <div class="dy-col"><div class="box"><div class="glabel">${SD.netName()}: the selection committee's ranking</div><p class="small dim">${hoops() ? 'Built from results by quadrant (who you beat and where), scoring margin adjusted for the opponent, and strength of schedule. Quad 1 is a home game against a top-30 team, neutral top 50, or road top 75.' : 'Rating percentage index: 25% your winning percentage, 50% your opponents\', 25% their opponents\'. Road wins count more. The committee picks at-large teams and seeds from it.'}</p>
      <div class="dy-scroll"><table class="dyt dy-tight"><thead><tr><th>${SD.netName()}</th><th>Team</th><th>W-L</th><th>SOS</th>${hoops() ? '<th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th>' : ''}</tr></thead><tbody>${rows.map(t => `<tr class="${t.id === g.user ? 'me' : ''}"><td>${t.net.rank}</td><td>${tlink(t.id, false)}</td><td>${t.w}-${t.l}</td><td>${t.net.sos}</td>${hoops() ? q(t).map(x => `<td>${x}</td>`).join('') : ''}</tr>`).join('')}</tbody></table></div>
      <button class="glink" data-more="net">${V.more.net ? 'Top 30' : 'Top 100'}</button></div></div></div>`;
  }
  function standings(b) {
    const c = V.conf || SD.UC(), st = SD.standings(c);
    b.innerHTML = `<div class="box"><div class="gchips dy-chips">${SD.confs().filter(x => x !== 'IND').map(x => `<button data-conf="${x}" aria-pressed="${c === x}">${esc(SD.CONF_NAME[x] || x)}</button>`).join('')}</div>
      <div class="dy-scroll"><table class="dyt"><thead><tr><th></th><th>Team</th><th>Conf</th><th>Overall</th><th>Rating</th></tr></thead><tbody>${st.map((t, i) => `<tr class="${t.id === G().user ? 'me' : ''}"><td>${i + 1}</td><td>${tlink(t.id)}</td><td>${t.cw}-${t.cl}</td><td>${t.w}-${t.l}</td><td>${SD.teamRating(t)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  /* ---------- stats ---------- */
  const HCOLS = [['GP', s => s.gp], ['MIN', s => f1(s.min, s.gp)], ['PTS', s => f1(s.pts, s.gp)], ['REB', s => f1(s.orb + s.drb, s.gp)], ['AST', s => f1(s.ast, s.gp)], ['STL', s => f1(s.stl, s.gp)], ['BLK', s => f1(s.blk, s.gp)], ['FG%', s => s.fga ? (s.fgm / s.fga * 100).toFixed(1) : '-'], ['3P%', s => s.tpa ? (s.tpm / s.tpa * 100).toFixed(1) : '-'], ['FT%', s => s.fta ? (s.ftm / s.fta * 100).toFixed(1) : '-']];
  const BCOLS = [['G', s => s.gp], ['AVG', s => avg3(s.h, s.ab)], ['OBP', s => avg3(s.h + s.bb + s.hbp, s.ab + s.bb + s.hbp)], ['SLG', s => avg3(s.h + s.d2 + s.d3 * 2 + s.hr * 3, s.ab)], ['AB', s => s.ab], ['H', s => s.h], ['HR', s => s.hr], ['RBI', s => s.rbi], ['R', s => s.r], ['BB', s => s.bb], ['SO', s => s.so], ['SB', s => s.sb]];
  const PCOLS = () => [['APP', s => s.gp], ['GS', s => s.gs || 0], ['W-L', s => (s.w || 0) + '-' + (s.l || 0)], ['SV', s => s.sv || 0], ['IP', s => Math.floor(s.ipo / 3) + '.' + s.ipo % 3], ['ERA', s => s.ipo ? (s.er * (G().sport === 'softball' ? 7 : 9) / (s.ipo / 3)).toFixed(2) : '-'], ['K', s => s.k], ['BB', s => s.bbp], ['H', s => s.ha], ['WHIP', s => s.ipo ? ((s.ha + s.bbp) / (s.ipo / 3)).toFixed(2) : '-']];
  function stats(b) {
    const g = G(), ut = SD.userT();
    const ps = ut.roster.map(SD.P).filter(p => sStats(p));
    const tbl = (title, list, cols) => list.length ? `<div class="box"><div class="glabel">${title}</div><div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${list.map(p => `<tr><td>${plink(p)} <small>${p.pos}</small></td>${cols.map(c => `<td>${c[1](sStats(p))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : '';
    const tabs = `<div class="gchips dy-chips">${[['team', SD.UN()], ['sec', SD.UCN() + ' leaders'], ['nat', 'National leaders']].map(([k, l]) => `<button data-stab="${k}" aria-pressed="${V.stab === k}">${l}</button>`).join('')}</div>`;
    if (V.stab === 'team') {
      if (hoops()) b.innerHTML = tabs + tbl(`${SD.SP().label(g.season)} · per game`, ps.filter(p => sStats(p).gp).sort((a, b) => sStats(b).pts / sStats(b).gp - sStats(a).pts / sStats(a).gp), HCOLS);
      else b.innerHTML = tabs + tbl('Hitting', ps.filter(p => sStats(p).pa).sort((a, b) => sStats(b).pa - sStats(a).pa), BCOLS) + tbl('Pitching', ps.filter(p => sStats(p).bf).sort((a, b) => sStats(b).ipo - sStats(a).ipo), PCOLS());
      if (!ps.length) b.innerHTML = tabs + '<div class="box dim">Stats start with the first game.</div>';
      return;
    }
    const keys = hoops() ? [['ppg', 'Points', s => s.gp >= 3 ? s.pts / s.gp : 0, v => v.toFixed(1)], ['rpg', 'Rebounds', s => s.gp >= 3 ? (s.orb + s.drb) / s.gp : 0, v => v.toFixed(1)], ['apg', 'Assists', s => s.gp >= 3 ? s.ast / s.gp : 0, v => v.toFixed(1)], ['tpm', 'Threes made', s => s.tpm, v => v]]
      : [['avg', 'Batting average', s => s.ab >= 40 ? s.h / s.ab : 0, v => v.toFixed(3)], ['hr', 'Home runs', s => s.hr, v => v], ['rbi', 'RBI', s => s.rbi, v => v], ['k', 'Strikeouts (pitching)', s => s.k, v => v], ['era', 'ERA (30+ IP)', s => s.ipo >= 90 ? 30 - s.er * 9 / (s.ipo / 3) : -99, v => (30 - v).toFixed(2)]];
    const k = keys.find(x => x[0] === V.statk) || keys[0];
    const pool = []; g.teams.forEach(t => { if (V.stab === 'sec' && t.conf !== SD.UC()) return; t.roster.forEach(id => { const p = SD.P(id), s = sStats(p); if (s && k[2](s) > (k[0] === 'era' ? -99 : 0)) pool.push(p); }); });
    pool.sort((a, b) => k[2](sStats(b)) - k[2](sStats(a)));
    b.innerHTML = `${tabs}<div class="gchips dy-chips">${keys.map(x => `<button data-statk="${x[0]}" aria-pressed="${k === x}">${x[1]}</button>`).join('')}</div><div class="box"><ol class="dy-poll">${pool.slice(0, 25).map((p, i) => `<li class="${p.t === g.user ? 'me' : ''}"><span>${i + 1}</span>${plink(p)} <small>${esc(T(p.t).abbr)} · ${p.pos}</small><small>${k[3](k[2](sStats(p)))}</small></li>`).join('')}</ol></div>`;
  }

  /* ---------- NIL ---------- */
  function nil(b) {
    const ut = SD.userT(), pay = SD.payroll(ut), ps = ut.roster.map(SD.P);
    const risky = p => SD.nilRisk(p, p.nil || 0) >= 0.12, f = V.nilf;
    const list = (f === 'risk' ? ps.filter(risky) : f === 'all' ? ps : ps.filter(p => p.pos === f || (f === 'P' && SD.isPit(p)))).sort((a, b) => (b.nil || 0) - (a.nil || 0));
    const tabs = [['risk', 'At risk'], ['all', 'All']].concat((hoops() ? SD.POS.hoops : ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH', 'P']).map(x => [x, x]));
    b.innerHTML = `<div class="box"><div class="glabel">NIL and revenue sharing</div><div class="dy-stats4"><div><b>${SD.money(ut.budget)}</b><small>Budget</small></div><div><b>${SD.money(pay)}</b><small>Committed</small></div><div><b>${SD.money(Math.max(0, ut.budget - pay))}</b><small>Open</small></div><div><b>${ps.filter(risky).length}</b><small>At risk</small></div></div>
      <div class="dy-niltabs">${tabs.map(([k, l]) => `<button data-nilf="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
      <div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>OVR</th><th>Contract</th><th>Value</th><th>Risk</th></tr></thead><tbody>${list.map(p => { const rk = SD.riskLabel(SD.nilRisk(p, p.nil || 0)); return `<tr><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></td><td>${ovrB(p.ovr)}</td><td>${SD.money(p.nil || 0)}</td><td class="small">${SD.money(SD.nilValue(p, ut))}</td><td><span class="dy-risk ${rk.toLowerCase()}">${rk}</span></td></tr>`; }).join('') || '<tr><td class="dim">Nobody here.</td></tr>'}</tbody></table></div><p class="small dim">Contracts change in the offseason (NIL & budget stage).</p></div>`;
  }

  /* ---------- history, settings ---------- */
  function history(b) {
    const g = G();
    b.innerHTML = `<div class="box"><div class="glabel">Coach ${esc(g.coach.name)} · ${g.coach.w}-${g.coach.l}</div><div class="dy-scroll"><table class="dyt"><thead><tr><th>Season</th><th>Record</th><th>Conf</th><th>Rank</th><th>Finish</th><th class="hide-s">Champion</th></tr></thead><tbody>${g.hist.slice().reverse().map(h => `<tr><td>${SD.SP().label(h.y)}</td><td>${h.w}-${h.l}</td><td>${h.cw}-${h.cl}${h.secReg ? ' 🏆' : ''}${h.secT ? ' (T)' : ''}</td><td>${h.ap || '—'}</td><td>${esc(h.finish)}</td><td class="hide-s small">${esc(h.champ || '')}</td></tr>`).join('') || '<tr><td class="dim">Your first season is under way.</td></tr>'}</tbody></table></div></div>`;
  }
  function settings(b) {
    const g = G(), s = g.settings;
    const seg = (k, opts) => `<div class="gseg">${opts.map(([v, l]) => `<button data-set="${k}|${v}" aria-pressed="${String(s[k]) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
    b.innerHTML = `<div class="box gsetup"><div class="glabel">Settings</div>
      <div class="gfield"><div class="glabel">Difficulty</div>${seg('difficulty', [['freshman', 'Freshman'], ['varsity', 'Varsity (default)'], ['heisman', 'Heisman (hard)']])}</div>
      <div class="gfield"><div class="glabel">In games</div>${seg('coachMode', [['coach', hoops() ? 'I coach' : 'I manage'], ['watch', 'Just watch']])}</div>
      <div class="gfield"><div class="glabel">Game speed</div>${seg('speed', [['slow', 'Slow'], ['fast', 'Fast']])}</div>
      ${hoops() ? '' : `<div class="gfield"><div class="glabel">Bullpen</div>${seg('autoPen', [[true, 'Staff makes pitching changes'], [false, 'I make them']])}</div>`}
      <div class="gfield"><div class="glabel">Recruiting</div>${seg('recruiting', [['manual', 'I recruit'], ['auto', 'Auto'], ['off', 'Off']])}</div>
      <div class="gfield"><div class="glabel">Transfer portal</div>${seg('portal', [['manual', 'I manage it'], ['auto', 'Auto']])}</div>
      <div class="gfield"><div class="glabel">NIL raises</div>${seg('nil', [['manual', 'I decide'], ['auto', 'Auto']])}</div>
      <div class="grow"><button class="btn" data-act="export">Export save file</button></div></div>`;
  }

  /* ---------- the offseason ---------- */
  function offseason(b) {
    const g = G(), o = g.off, ut = SD.userT(), st = o.stage;
    const steps = `<ol class="dy-steps">${SD.OFF_ORDER.map(k => `<li class="${k === st ? 'on' : SD.OFF_ORDER.indexOf(k) < SD.OFF_ORDER.indexOf(st) ? 'done' : ''}">${esc(SD.OFF_LABEL[k])}</li>`).join('')}</ol>`;
    let html = '';
    if (st === 'recap') {
      const h = g.hist[g.hist.length - 1] || {};
      html = `<div class="dy-recap-hero"><div><span class="glabel">${SD.SP().label(h.y)} in review</span><h2>${h.w}-${h.l} · ${esc(h.finish || '')}</h2><p>${h.cw}-${h.cl} ${esc(SD.UC())}${h.ap ? ` · No. ${h.ap} in the final poll` : ''}${h.champ ? ` · National champion: ${esc(h.champ)}` : ''}</p></div></div>
        <div class="box"><div class="glabel">Leaving</div><div class="dy-scroll"><table class="dyt"><tbody>${o.leaving.map(x => { const p = SD.P(x.id); return `<tr><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)} · ${p.ovr}</small></td><td>${x.why === 'grad' ? 'Out of eligibility' : `Turning pro (${esc(SD.SP().draft)})`}</td><td>${x.why === 'pro' && o.pitched[x.id] == null ? `<select data-pamt="${x.id}">${[0, 50000, 100000, 250000, 500000].map(v => `<option value="${v}">${v ? '+' + SD.money(v) : 'No raise'}</option>`).join('')}</select><button class="dy-ra" data-persuade="${x.id}">Ask him back</button> <small>${Math.round(SD.persuadeChance(p, 0) * 100)}%</small>` : ''}</td></tr>`; }).join('') || '<tr><td class="dim">Nobody.</td></tr>'}</tbody></table></div></div>`.replace('Ask him back', SD.SP().he === 'she' ? 'Ask her back' : 'Ask him back');
    } else if (st === 'nil') {
      const asks = {}; o.nilAsk.forEach(a => { asks[a.id] = a; });
      html = `<div class="box"><div class="glabel">NIL: next season</div><p class="small dim">Answer the raise requests. Unhappy players are portal risks.</p><div class="dy-scroll"><table class="dyt"><tbody>${ut.roster.map(SD.P).sort((a, b) => (b.nil || 0) - (a.nil || 0)).map(p => { const a = asks[p.id]; return `<tr class="${a ? 'me' : ''}"><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></td><td>${ovrB(p.ovr)}</td><td><button class="dy-ra" data-nilstep="${p.id}|-1">−</button><b>${SD.money(p.nil || 0)}</b><button class="dy-ra" data-nilstep="${p.id}|1">+</button></td><td>${a ? `Asks ${SD.money(a.ask)} <button class="dy-ra ${a.ans === true ? 'on' : ''}" data-nilans="${a.id}|1">Pay</button><button class="dy-ra ${a.ans === false ? 'on' : ''}" data-nilans="${a.id}|0">No</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    } else if (st === 'portal') {
      const P = o.portal, mine = SD.portalPlayers().filter(p => p.portal.from === g.user), avail = SD.portalPlayers().filter(p => p.portal.from !== g.user && (V.ppos === 'ALL' || p.pos === V.ppos)).sort((a, b) => SD.tStars(b) - SD.tStars(a) || SD.tRange(b)[1] - SD.tRange(a)[1]).slice(0, 60);
      html = `<div class="box"><div class="glabel">Transfer portal</div><p>Newcomers ${SD.newcomers()} of ${SD.NEW_CAP[g.sport]} · roster ${ut.roster.length} (limit ${SD.LIMIT[g.sport]}: extra players are trimmed at the roster limit stage; new transfers can't be cut).</p>
        <p class="small">Your players in the portal: ${mine.map(p => esc(p.n) + ' (' + p.pos + ')' + (p.portal.pushed ? ' <small class="dim">(encouraged)</small>' : '')).join(', ') || 'none'}.</p>
        <details ${V.more.push ? 'open' : ''}><summary class="small"><b>Encourage players to transfer</b> (frees a roster spot and his NIL money)</summary><div class="dy-scroll"><table class="dyt dy-tight"><tbody>${ut.roster.map(SD.P).filter(p => p.tin !== g.season).sort((a, b) => a.ovr - b.ovr).map(p => `<tr><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></td><td>${ovrB(p.ovr)}</td><td class="small">${SD.money(p.nil || 0)}</td><td><button class="dy-ra ${p.pushOut ? 'on' : ''}" data-push="${p.id}">${p.pushOut ? 'Encouraged: undo' : 'Encourage to transfer'}</button></td></tr>`).join('')}</tbody></table></div></details></div>
        <div class="box"><div class="gchips dy-chips">${['ALL'].concat(SD.POS[SD.kind()]).map(x => `<button data-ppos="${x}" aria-pressed="${V.ppos === x}">${x === 'ALL' ? 'All' : x}</button>`).join('')}</div><div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>From</th><th>Transfer rating</th><th>Offer</th></tr></thead><tbody>${avail.map(p => `<tr class="${P.mine[p.id] != null ? 'me' : ''}"><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></td><td>${tlink(p.portal.from, false)}</td><td><span class="dy-tstars">${'★'.repeat(SD.tStars(p))}</span> <small>${SD.tRange(p).join('-')}</small></td><td>${P.mine[p.id] != null ? `<b>${SD.money(P.mine[p.id])}</b> ` : ''}<select data-pofferamt="${p.id}">${[10000, 25000, 50000, 100000, 250000, 500000, 1000000].map(v => `<option value="${v}">${SD.money(v)}</option>`).join('')}</select><button class="dy-ra" data-poffer="${p.id}">Offer</button></td></tr>`).join('')}</tbody></table></div></div>`;
    } else if (st === 'signing') {
      const c = SD.myCommits();
      html = `<div class="box"><div class="glabel">Signing day · class of ${g.recruit.year}</div><p>No. ${g.recruit.classRank || '—'} class</p><ul class="dy-mini">${c.map(p => `<li><span class="dy-stars">${stars(p.rec.stars)}</span> ${esc(p.n)} <small>${p.pos} · ${p.ovr} · ${p.potG}</small></li>`).join('') || '<li class="dim">No signees.</li>'}</ul></div>`;
    } else if (st === 'draft') {
      const mine = (o.draft || []).filter(x => x.t === g.user);
      html = `<div class="box"><div class="glabel">${esc(SD.SP().draft)}</div><ul class="dy-mini">${mine.map(x => `<li>No. ${x.pk}: ${plink(SD.P(x.id))} <small>${SD.P(x.id).pos}</small></li>`).join('') || `<li class="dim">No ${esc(SD.UN())} players taken.</li>`}</ul></div>`;
    } else if (st === 'progress') {
      const pr = o.prog || [], ch = x => x.after - x.before, avg = pr.length ? (pr.reduce((a, x) => a + ch(x), 0) / pr.length).toFixed(1) : 0;
      html = `<div class="box"><div class="glabel">Player development</div><div class="dy-stats4"><div><b>${avg > 0 ? '+' : ''}${avg}</b><small>Average change</small></div><div><b>${pr.filter(x => ch(x) > 0).length}</b><small>Improved</small></div><div><b>${pr.filter(x => ch(x) >= 6).length}</b><small>Breakouts</small></div><div><b>${pr.filter(x => ch(x) <= 0).length}</b><small>Stalled</small></div></div>
        <p class="small dim">Growth comes from potential (room to his ceiling), work ethic and playing time. Seniors and fifth-years grow less.</p>
        <div class="dy-scroll"><table class="dyt"><thead><tr><th>Player</th><th>Before</th><th>Now</th><th>Change</th><th class="hide-s">Why</th></tr></thead><tbody>${pr.map(x => { const p = SD.P(x.id); if (!p) return ''; const c = ch(x); return `<tr><td>${plink(p)} <small>${p.pos} · ${yrLabel(p)}</small></td><td>${x.before}</td><td>${ovrB(x.after)}</td><td><b class="${c > 0 ? 'dy-w' : c < 0 ? 'dy-l' : ''}">${c > 0 ? '+' : ''}${c}</b></td><td class="hide-s small">${esc((x.why || []).join(', '))}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    } else if (st === 'cuts') {
      const need = SD.cutsNeeded();
      html = `<div class="box"><div class="glabel">Roster limit: ${SD.LIMIT[g.sport]}</div><p>${ut.roster.length} on the roster. ${need ? `Pick ${need} to release, or let the staff do it.` : 'You are under the limit.'}</p>${need ? `<div class="dy-scroll"><table class="dyt"><tbody>${ut.roster.map(SD.P).sort((a, b) => a.ovr - b.ovr).slice(0, 30).map(p => `<tr class="${o.cut.includes(p.id) ? 'cut' : ''}"><td>${p.tin === g.season ? '<small class="dim">New transfer</small>' : `<button class="dy-ra ${o.cut.includes(p.id) ? 'on' : ''}" data-cut="${p.id}">${o.cut.includes(p.id) ? 'Cut' : 'Keep'}</button>`}</td><td>${plink(p)}</td><td>${p.pos}</td><td>${yrLabel(p)}</td><td>${ovrB(p.ovr)}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
    } else if (st === 'schedule') {
      const y = g.season + 1, nmax = hoops() ? 4 : 3; g.ncPick = g.ncPick || {}; const arr = g.ncPick[y] = g.ncPick[y] || [];
      const opts = g.teams.filter(t => t.conf !== ut.conf).sort((a, b) => b.prestige - a.prestige);
      const ncHtml = `<div class="box"><div class="glabel">${SD.SP().label(y)} non-conference schedule</div><p class="small dim">Pick up to ${nmax} ${hoops() ? 'marquee games (home, away or neutral site); the rest of the non-conference slate fills in around them' : 'early-season weekend series; midweek games fill in around them'}. Conference games are set by the league.</p>
        ${arr.map((x, i) => `<div class="dy-nc"><b>${hoops() ? 'Game' : 'Series'} ${i + 1}</b><select data-ncp="${i}|o">${opts.map(t => `<option value="${t.id}" ${t.id === x.o ? 'selected' : ''}>${esc(t.name)} (${esc(t.conf)})</option>`).join('')}</select><select data-ncp="${i}|site">${[['H', 'Home'], ['A', 'Away'], ['N', 'Neutral']].map(([v, l]) => `<option value="${v}" ${x.site === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="dy-ra" data-ncrm="${i}">Remove</button></div>`).join('')}
        ${arr.length < nmax ? `<button class="btn" data-ncadd="1">Add a ${hoops() ? 'game' : 'series'}</button>` : ''}</div>`;
      html = ncHtml + `<div class="box"><div class="glabel">Next season</div><p>Roster set: ${ut.roster.length} players, team rating ${SD.teamRating(ut)}. Continue to build the ${SD.SP().label(g.season + 1)} schedule.</p></div>`;
    }
    b.innerHTML = `${steps}${html}<div class="grow"><button class="btn primary big" data-act="main">${esc(primaryAction().label)}</button></div>`;
  }

  /* ---------- editing a generated player (not the ratings) ---------- */
  function editCard(id) {
    const p = SD.P(id); if (!p || p.real) return;
    const f = (k, l, v, extra) => `<label class="dy-edrow"><span>${l}</span><input class="dy-in" data-ed="${k}" value="${esc(v == null ? '' : v)}" ${extra || ''}></label>`;
    modal(`<h3>Edit ${esc(p.n)}</h3><p class="small dim">Ratings, potential and personality can't be changed here.</p>
      ${f('n', 'Name', p.n, 'maxlength="32"')}${f('num', 'Number', p.num, 'inputmode="numeric" maxlength="2"')}${f('home', 'Hometown', p.home, 'maxlength="40"')}
      ${hoops() ? f('ht', 'Height (ft-in)', SD.htStr(p.ht).replace(/[′″'"]/g, m => m === '′' || m === "'" ? '-' : '').replace(/-$/, ''), 'maxlength="5"') : f('bt', 'Bats/throws (e.g. R/R)', p.bt || '', 'maxlength="3"')}
      <div class="grow"><button class="btn primary" data-psave="${p.id}">Save</button><button class="btn" data-pid="${p.id}">Cancel</button></div>`);
  }
  function saveEdit(id) {
    const p = SD.P(id), val = k => { const el = APP.querySelector(`[data-ed="${k}"]`); return el ? el.value.trim() : null; };
    if (!p || p.real) return null;
    const msgs = [];
    const n = val('n'); if (n && n.length >= 2) p.n = n.replace(/\s+/g, ' ');
    const home = val('home'); if (home) p.home = home;
    const num = val('num');
    if (num !== '' && num != null) {
      const v = parseInt(num, 10), t = p.t != null ? T(p.t) : null;
      const taken = t && t.roster.map(SD.P).find(q => q && q !== p && q.num === v);
      if (!(v >= 0 && v <= 99)) msgs.push('Numbers run 0-99.');
      else if (taken) msgs.push(`No. ${v} belongs to ${taken.n}.`);
      else p.num = v;
    }
    const ht = val('ht'); if (ht) { const m = ht.match(/^(\d)\D+(\d{1,2})$/); if (m && +m[2] < 12) p.ht = +m[1] * 12 + +m[2]; else msgs.push('Height looks like 6-4.'); }
    const bt = val('bt'); if (bt) { const m = bt.toUpperCase().match(/^([LRS])\/?([LR])$/); if (m) p.bt = m[1] + '/' + m[2]; else msgs.push('Bats/throws looks like R/R or L/L (S for switch).'); }
    return msgs.length ? `Saved, except: ${msgs.join(' ')}` : `${p.n} updated.`;
  }

  /* ---------- player card ---------- */
  function playerCard(id) {
    const p = SD.P(id); if (!p) return;
    const g = G(), t = p.t != null ? T(p.t) : null, [pl, pd] = SD.persLabel(p);
    const hideT = !!(p.portal && p.portal.from !== g.user);
    const keys = SD.kind() === 'hoops' ? Object.keys(SD.ATTR.hoops) : SD.isPit(p) ? Object.keys(SD.ATTR.pit) : Object.keys(SD.ATTR.bat);
    const names = Object.assign({}, SD.ATTR.hoops, SD.ATTR.bat, SD.ATTR.pit);
    const bar = (l, v) => `<div class="dy-attr"><span>${esc(l)}</span><div class="dy-ab"><i class="${ovrCls(v)}" style="width:${v}%"></i></div><b>${v}</b></div>`;
    const cols = hoops() ? HCOLS : SD.isPit(p) ? PCOLS() : BCOLS;
    const car = Object.entries(p.car || {}).sort((a, b) => a[0] < b[0] ? -1 : 1);
    const rows = car.map(([y, s]) => `<tr><td>${y}${s.real ? ' <small class="dim">real</small>' : ''}</td>${cols.map(c => `<td>${s.gp || s.real ? safe(() => c[1](Object.assign({ gp: 1, min: 0, pts: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, fga: 0, tpa: 0, fta: 0, ab: 0, h: 0, bb: 0, hbp: 0, d2: 0, d3: 0, hr: 0, ipo: 0, er: 0, k: 0, bbp: 0, ha: 0 }, s, hoops() && s.reb != null ? { drb: s.reb } : {}, !hoops() && s.so == null ? {} : {}))) : ''}</td>`).join('')}</tr>`).join('') + (p.s ? `<tr class="cur"><td>${g.season}</td>${cols.map(c => `<td>${safe(() => c[1](p.s))}</td>`).join('')}</tr>` : '');
    modal(`<div class="dy-pc" style="--tc:${t ? t.c1 : '#888'}">
      <div class="dy-pc-head"><div class="dy-pc-num">${p.num}</div><div><h3>${esc(p.n)}</h3><div class="dim">${p.pos} · ${yrLabel(p)} · ${hoops() ? SD.htStr(p.ht) : esc(p.bt || '')} · ${esc(p.home)}${t ? ' · ' + esc(t.name) : ''}${p.prev ? ' · from ' + esc(p.prev) : ''}</div></div>
        ${hideT ? `<div class="dy-pc-ovr"><span class="dy-tstars big">${'★'.repeat(SD.tStars(p))}</span><small>Transfer · OVR ${SD.tRange(p).join('-')}</small></div>` : `<div class="dy-pc-ovr">${ovrB(p.ovr)}<small>OVR</small><span class="dy-pot big">${p.potG}</span><small>Potential</small></div>`}</div>
      <div class="dy-pc-tags"><span class="chip" title="${esc(pd)}">${esc(pl)}</span>${p.rec && !p.rec.walkon ? `<span class="chip">${'★'.repeat(p.rec.stars || 0)}${p.rec.natl ? ' · No. ' + p.rec.natl : ''}</span>` : '<span class="chip">Walk-on</span>'}${p.nil ? `<span class="chip">NIL ${SD.money(p.nil)}</span>` : ''}</div>
      ${p.note ? `<p class="small dim">${esc(p.note)}</p>` : ''}
      ${g.phase === 'offseason' && p.t === g.user && g.off && ['recap', 'nil', 'portal'].includes(g.off.stage) && p.tin !== g.season ? `<p><button class="btn" data-push="${p.id}">${p.pushOut ? 'Undo: keep him' : 'Encourage to transfer'}</button> <small class="dim">He enters the portal and frees his roster spot and NIL money.</small></p>` : ''}
      ${!p.real ? `<p><button class="btn" data-pedit="${p.id}">Edit player</button> <small class="dim">Name, number and bio. Ratings stay as they are.</small></p>` : ''}
      ${p.aw && p.aw.length ? `<p class="small"><b>Honors:</b> ${p.aw.map(a => a.y + ' ' + ({ POY: 'National Player of the Year', AA1: 'All-American', SEC1: 'All-SEC', SECPOY: 'SEC Player of the Year', SECFR: 'SEC Freshman of the Year' }[a.a] || a.a)).join(' · ')}</p>` : ''}
      <div class="dy-pc-cols"><div><div class="glabel">Ratings</div>${hideT ? '<p class="small dim">In the portal: a star rating and a range until he signs.</p>' : keys.map(k => bar(names[k], p.at[k])).join('')}</div>
      <div><div class="glabel">Personality</div>${Object.keys(SD.TRAITS).map(k => bar(SD.TRAITS[k], p.tr[k])).join('')}</div></div>
      ${rows ? `<div class="glabel">Stats</div><div class="dy-scroll"><table class="dyt"><thead><tr><th>Year</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : ''}</div>`);
  }
  const safe = f => { try { const v = f(); return v == null || Number.isNaN(v) ? '-' : v; } catch (e) { return '-'; } };
})(typeof window !== 'undefined' ? window : globalThis);
