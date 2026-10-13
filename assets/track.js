/* Tab-level visit counts with GoatCounter (no cookies). Each sport/tab is recorded as its own "page",
   e.g. /football/depth or /mbb/lineup, so the GoatCounter dashboard shows which sections people use.
   Set GOATCOUNTER_CODE to the site code from goatcounter.com (the part before .goatcounter.com). */
(function () {
  var GOATCOUNTER_CODE = 'xajjay';
  var CF_TOKEN = '6374609cae57421890ac9a644142eb26'; // Cloudflare Web Analytics
  if (!/volindex\.net$|github\.io$/.test(location.hostname)) return; // only count the real site

  /* Don't count my own devices: open volindex.net/#notrack once on each phone/computer/browser.
     Opening it again turns counting back on. Applies to both Cloudflare and GoatCounter. */
  var ls = null; try { ls = window.localStorage; } catch (e) {}
  function get(k) { try { return ls && ls.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (!ls) return; v == null ? ls.removeItem(k) : ls.setItem(k, v); } catch (e) {} }
  if (location.hash === '#notrack') {
    var off = get('vi-notrack') !== '1';
    set('vi-notrack', off ? '1' : null); set('skipgc', off ? 't' : null); // skipgc is GoatCounter's own opt-out flag
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    var note = document.createElement('div');
    note.textContent = off ? 'This browser is no longer counted in The Vol Index analytics.' : 'This browser is counted in analytics again.';
    note.setAttribute('role', 'status');
    note.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99;background:#141414;color:#fff;padding:10px 16px;border-radius:10px;font:600 14px system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.25);max-width:90vw;text-align:center';
    (document.body || document.documentElement).appendChild(note);
    setTimeout(function () { note.remove(); }, 4000);
  }
  if (get('vi-notrack') === '1') return; // owner's device: count nothing

  // Cloudflare Web Analytics beacon
  var cf = document.createElement('script');
  cf.defer = true; cf.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  cf.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_TOKEN }));
  document.head.appendChild(cf);
  if (!GOATCOUNTER_CODE) return;
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
