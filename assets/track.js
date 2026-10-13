/* Tab-level visit counts with GoatCounter (no cookies). Each sport/tab is recorded as its own "page",
   e.g. /football/depth or /mbb/lineup, so the GoatCounter dashboard shows which sections people use.
   Set GOATCOUNTER_CODE to the site code from goatcounter.com (the part before .goatcounter.com). */
(function () {
  var GOATCOUNTER_CODE = 'xajjay';
  if (!GOATCOUNTER_CODE || !/volindex\.net$|github\.io$/.test(location.hostname)) return; // only count the real site
  var last = null;
  function path() { var k = window.VI_ROUTER ? window.VI_ROUTER.key() : ((location.hash || '#home').slice(1) || 'home'); return k === 'home' ? '/' : window.VI_ROUTER.path(k); }
  function send() {
    var p = path(); if (p === last || !window.goatcounter || !window.goatcounter.count) return; last = p;
    window.goatcounter.count({ path: p, title: document.title + ' · ' + p.slice(1).replace('/', ' › '), event: false });
  }
  window.goatcounter = { no_onload: true };
  var s = document.createElement('script');
  s.async = true; s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', 'https://' + GOATCOUNTER_CODE + '.goatcounter.com/count');
  s.onload = send;
  document.head.appendChild(s);
  window.addEventListener('vi:route', function () { setTimeout(send, 50); });
})();
