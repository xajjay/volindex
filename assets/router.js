/* The Vol Index — clean addresses.
   Pages live at volindex.net/football/depth-chart, /mens-basketball/lineup, /sources, etc.
   Internally every page still has a short key like "football-depth" or "mbb-lineup"; this file
   translates between the two, updates the address bar, and tells the app when the page changes
   (event "vi:route"). Old links like volindex.net/#football-depth still work and are cleaned up.
   Off the real site (artifact previews, local files) it falls back to #key addresses. */
(function () {
  'use strict';
  var SPORT = { football: 'football', volleyball: 'volleyball', soccer: 'soccer', mbb: 'mens-basketball', wbb: 'womens-basketball', baseball: 'baseball', softball: 'softball' };
  var TAB = { schedule: 'schedule', roster: 'roster', depth: 'depth-chart', next: '2027-preview', stats: 'stats', advanced: 'advanced',
    recruits: 'recruiting', recruiting: 'recruiting', leaders: 'leaders-honors', history: 'history', media: 'social', lineup: 'lineup',
    review: 'review', moves: 'roster-moves', ratings: 'advanced' };
  var SPORT_BACK = {}, TAB_BACK = {};
  Object.keys(SPORT).forEach(function (k) { SPORT_BACK[SPORT[k]] = k; });
  Object.keys(TAB).forEach(function (k) { if (k !== 'recruits' && k !== 'ratings') TAB_BACK[TAB[k]] = k; });
  var KEY_RE = /^(games(-[a-z0-9]+){0,2}|home|sources|about|football|volleyball|soccer|mbb|wbb|baseball|softball)(-[a-z0-9]+)?$/;

  var host = location.hostname, BASE = null;
  if (/^https?:$/.test(location.protocol)) {
    if (/(^|\.)volindex\.net$/.test(host) || host === 'localhost' || host === '127.0.0.1') BASE = '/';
    else if (/\.github\.io$/.test(host)) BASE = '/volindex/';
  }
  var pathMode = !!BASE;
  // relative links (assets/, data/) must resolve from the site root even at /football/depth-chart
  if (pathMode && !document.querySelector('base')) { var bse = document.createElement('base'); bse.href = BASE; document.head.insertBefore(bse, document.head.firstChild); }

  function pathOf(key) {
    if (!key || key === 'home') return BASE;
    if (key === 'sources') return BASE + 'sources';
    if (/^games(-|$)/.test(key)) { var g = key.split('-'); return BASE + 'games' + (g[1] ? '/' + (SPORT[g[1]] || g[1]) : '') + (g[2] ? '/' + g[2] : ''); }
    var i = key.indexOf('-'), s = i < 0 ? key : key.slice(0, i), t = i < 0 ? '' : key.slice(i + 1);
    var p = BASE + (SPORT[s] || s);
    if (t && t !== 'overview') p += '/' + (TAB[t] || t);
    return p;
  }
  function keyOfPath(pathname) {
    var rest = pathname.indexOf(BASE) === 0 ? pathname.slice(BASE.length) : pathname.replace(/^\//, '');
    var parts = rest.replace(/\/+$/, '').replace(/\/index\.html$/, '').split('/').filter(Boolean);
    if (!parts.length || parts[0] === 'index.html') return 'home';
    if (parts[0] === 'sources') return 'sources';
    if (parts[0] === 'games') return ['games'].concat(parts[1] ? [SPORT_BACK[parts[1]] || parts[1]] : [], parts[2] ? [parts[2]] : []).join('-');
    var s = SPORT_BACK[parts[0]] || parts[0];
    if (!parts[1]) return s;
    var t = TAB_BACK[parts[1]] || parts[1];
    if (s === 'football' && t === 'recruiting') t = 'recruits';
    return s + '-' + t;
  }
  function current() {
    if (!pathMode) return (location.hash || '#home').slice(1) || 'home';
    return keyOfPath(location.pathname);
  }
  function fire() { window.dispatchEvent(new Event('vi:route')); }
  function go(key, replace) {
    key = String(key || 'home').replace(/^#/, '');
    if (!pathMode) { if (location.hash.slice(1) !== key) location.hash = '#' + key; else fire(); return; }
    var p = pathOf(key);
    if (p !== location.pathname) history[replace ? 'replaceState' : 'pushState']({ key: key }, '', p);
    fire();
  }
  window.VI_ROUTER = { key: current, go: go, href: function (k) { return pathMode ? pathOf(k) : '#' + k; }, pathMode: pathMode, path: function (k) { return pathOf(k).slice((BASE || '/').length - 1); } };

  if (pathMode) {
    // old #links become clean addresses
    var h = location.hash.slice(1);
    if (h && KEY_RE.test(h)) history.replaceState({ key: h }, '', pathOf(h));
    window.addEventListener('popstate', fire);
    // clicks on in-site links change the page without reloading
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]'); if (!a || a.target === '_blank') return;
      var href = a.getAttribute('href'), key = null;
      if (href.charAt(0) === '#') { if (KEY_RE.test(href.slice(1))) key = href.slice(1); }
      else if (a.origin === location.origin && a.pathname.indexOf(BASE) === 0 && !/\.[a-z0-9]+$/i.test(a.pathname)) key = keyOfPath(a.pathname);
      if (!key) return;
      e.preventDefault(); go(key);
    });
    // show clean addresses on links (hover, long-press, copy link)
    var fix = function (root) {
      (root.querySelectorAll ? root.querySelectorAll('a[href^="#"]') : []).forEach(function (a) {
        var k = a.getAttribute('href').slice(1); if (KEY_RE.test(k)) a.setAttribute('href', pathOf(k));
      });
    };
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches('a[href^="#"]')) fix(n.parentNode || n); fix(n); } }); }); })
      .observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () { fix(document); });
  } else {
    window.addEventListener('hashchange', fire);
  }
})();
