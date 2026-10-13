/* The Vol Index — About page (volindex.net/about) with a corrections & suggestions form (volindex.net/about/fix).
   The site has no server, so the form writes the message for the visitor and opens their email app,
   or a pre-filled post to @Volindex on X. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EMAIL = 'thevolindex@gmail.com';
  const X = 'Volindex';
  const SPORTS = ['Football', 'Volleyball', 'Soccer', "Men's basketball", "Women's basketball", 'Baseball', 'Softball', 'The whole site'];
  const href = k => window.VI_ROUTER ? window.VI_ROUTER.href(k) : '#' + k;

  window.renderAbout = function (app, tab) {
    app.innerHTML = `
    <div class="wrap hub-hero about-hero"><div class="eyebrow">About</div><h1>The Vol <span>Index</span></h1>
      <p>A free, fan-made home for Tennessee athletics: rosters, depth charts, lineups, recruits, ratings, schedules, standings, live scores and history for football, volleyball, soccer, men's and women's basketball, baseball and softball, all in one place.</p></div>
    <div class="wrap about">
      <div class="about-main">
        <section><h2>Why it exists</h2>
          <p>Following the Vols usually means bouncing between a dozen sites: utsports.com for rosters, 247Sports and On3 for recruiting, ESPN for scores, message boards for depth charts. The Vol Index puts it all in one place, kept up to date, simple enough for a brand-new fan and deep enough for a diehard.</p>
          <p>It's built by a fan, for fans. It's free and has no ads.</p></section>
        <section><h2>Who's behind it</h2>
          <p>I'm AJ, a student at the University of Tennessee studying business analytics. The Vol Index started as a personal project that I wanted to share with Vol Nation, and I keep it running in my free time.</p>
          <p>I'm a diehard Tennessee fan who wants to know more about every UT team, not just football. I hope The Vol Index helps you do the same.</p></section>
        <section><h2>How it works</h2>
          <p>Most numbers update automatically every morning from public sources like ESPN, utsports.com, 247Sports, On3 and CollegeFootballData, and scores update live during games. Depth charts and projected lineups are The Vol Index's own projections and are labeled unofficial. Every source is listed on <a href="${href('sources')}">Sources &amp; credits</a>.</p>
          <p class="dim small">The Vol Index is an independent fan site. It is not affiliated with or endorsed by the University of Tennessee, the SEC or any of its sources.</p></section>
      </div>
      <aside class="about-side">
        <div class="box fixbox" id="fix">
          <div class="eyebrow">Corrections &amp; suggestions</div>
          <h2>See something wrong? Have an idea?</h2>
          <p>A wrong jersey number, a transfer I missed, a depth chart you'd change, a feature you want. Tell me and I'll fix it or look into it.</p>
          <form id="fixForm" novalidate>
            <div class="fx-row"><span class="fx-l">This is a</span>
              <div class="seg fx-type" role="radiogroup" aria-label="Type of message">${['Correction', 'Suggestion', 'Other'].map((t, i) => `<button type="button" role="radio" data-t="${t}" aria-pressed="${i === 0}">${t}</button>`).join('')}</div></div>
            <label class="fx-row" for="fxSport"><span class="fx-l">Sport</span><select id="fxSport">${SPORTS.map(s => `<option>${esc(s)}</option>`).join('')}</select></label>
            <label class="fx-row fx-col" for="fxMsg"><span class="fx-l">What should change?</span>
              <textarea id="fxMsg" rows="4" placeholder="Example: Football roster lists #4 as a junior, he's a redshirt sophomore."></textarea></label>
            <label class="fx-row fx-col" for="fxSrc"><span class="fx-l">Source <em>(optional)</em></span>
              <input id="fxSrc" type="text" placeholder="A link that shows it, like utsports.com or a 247 page"></label>
            <p class="fx-err" id="fxErr" hidden>Write a quick note about what should change first.</p>
            <div class="fx-send"><button type="submit" class="btn primary" data-via="email">Send by email</button><button type="button" class="btn" data-via="x">Post to @${X}</button></div>
          </form>
          <p class="dim small">Email opens your mail app with the message filled in. Posting to X is public; for a private note, DM <a href="https://x.com/${X}" target="_blank" rel="noopener">@${X}</a>.</p>
        </div>
        <div class="box contactbox">
          <div class="eyebrow">Contact</div>
          <dl class="kv"><dt>Email</dt><dd><a href="mailto:${EMAIL}">${EMAIL}</a></dd>
            <dt>X</dt><dd><a href="https://x.com/${X}" target="_blank" rel="noopener">@${X}</a></dd></dl>
        </div>
      </aside>
    </div>`;
    let type = 'Correction';
    app.querySelectorAll('.fx-type [data-t]').forEach(b => b.addEventListener('click', () => {
      type = b.dataset.t; app.querySelectorAll('.fx-type [data-t]').forEach(x => x.setAttribute('aria-pressed', x === b));
      app.querySelector('#fxMsg').placeholder = type === 'Suggestion' ? "Example: Add each player's high school stats to their card." : type === 'Correction' ? "Example: Football roster lists #4 as a junior, he's a redshirt sophomore." : 'Anything on your mind about the site.';
    }));
    const compose = via => {
      const msg = app.querySelector('#fxMsg').value.trim(), src = app.querySelector('#fxSrc').value.trim(), sport = app.querySelector('#fxSport').value;
      const err = app.querySelector('#fxErr'); err.hidden = !!msg; if (!msg) { app.querySelector('#fxMsg').focus(); return; }
      if (via === 'x') {
        const t = `@${X} ${type} (${sport}): ${msg}${src ? ' ' + src : ''}`.slice(0, 280);
        window.open('https://x.com/intent/post?text=' + encodeURIComponent(t), '_blank', 'noopener');
      } else {
        const body = `${type} · ${sport}\n\n${msg}${src ? '\n\nSource: ' + src : ''}\n\n(Sent from volindex.net)`;
        location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(`Vol Index ${type.toLowerCase()}: ${sport}`)}&body=${encodeURIComponent(body)}`;
      }
    };
    app.querySelector('#fixForm').addEventListener('submit', e => { e.preventDefault(); compose('email'); });
    app.querySelector('[data-via="x"]').addEventListener('click', () => compose('x'));
    if (tab === 'fix') setTimeout(() => { const f = document.getElementById('fix'); f && f.scrollIntoView({ block: 'start' }); }, 0);
    else window.scrollTo(0, 0);
  };
})();
