/* Installable app: registers the service worker and shows a one-time "Add to Home Screen" tip on iPhone. */
(function () {
  if (!/^https?:$/.test(location.protocol)) return;
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  var standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
  var seen; try { seen = localStorage.getItem('vi-install-tip'); } catch (e) { seen = '1'; }
  if (!ios || standalone || seen) return;
  setTimeout(function () {
    var d = document.createElement('div'); d.className = 'installtip'; d.setAttribute('role', 'dialog');
    d.innerHTML = '<img src="assets/icons/icon-192.png" alt=""><div><b>Get The Vol Index app</b><span>Tap <svg viewBox="0 0 24 24" aria-label="Share"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Share, then <b>Add to Home Screen</b>.</span></div><button aria-label="Close">✕</button>';
    d.querySelector('button').onclick = function () { d.remove(); try { localStorage.setItem('vi-install-tip', '1'); } catch (e) {} };
    document.body.appendChild(d);
  }, 4000);
})();
