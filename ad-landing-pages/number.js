/* Dynamic call number for Google Ads visitors (TTR-1339; copied from Pro Wildlife, Alpha values). A visitor who arrives from an ad (gclid in the address) gets one number
   from the pool for about 30 minutes after their last activity; calls to it are matched to the click in TTR OS.
   Anything else (no gclid, pool busy, error, slow answer, no JavaScript): the page keeps its default number. */
(function () {
  var DEFAULT = { tel: '+14722033284', display: '(472) 203-3284' };
  var KEY = '8ntBK6QgvLkKLHNYnBTF8Q';   // TTR OS site key for Alpha Hardscapes (public, it is in the page)
  var API = 'https://ttr-portal.vercel.app/api/site/number';
  var STORE = 'alpha_call_number', HOLD_MS = 30 * 60 * 1000, WAIT_MS = 1500;

  function read() { try { var s = JSON.parse(localStorage.getItem(STORE) || 'null'); return s && s.exp > Date.now() && s.tel && s.display ? s : null; } catch (e) { return null; } }
  function write(n) { try { localStorage.setItem(STORE, JSON.stringify({ tel: n.tel, display: n.display, exp: Date.now() + HOLD_MS })); } catch (e) {} }

  function apply(n) {
    var links = document.querySelectorAll('a[href^="tel:"]');
    for (var i = 0; i < links.length; i++) links[i].setAttribute('href', 'tel:' + n.tel);
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), node, todo = [];
    while ((node = walker.nextNode())) { if (node.nodeValue.indexOf(DEFAULT.display) > -1 && !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentNode.nodeName)) todo.push(node); }
    for (var j = 0; j < todo.length; j++) todo[j].nodeValue = todo[j].nodeValue.split(DEFAULT.display).join(n.display);
    document.documentElement.setAttribute('data-call-number', n.tel);
  }

  function run() {
    var held = read();
    if (held) { write(held); apply(held); return; }   // keep it, and renew the hold on activity
    var q = new URLSearchParams(location.search), gclid = q.get('gclid');
    if (!gclid) return;
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, WAIT_MS);
    fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ k: KEY, gclid: gclid, campaign: q.get('campaign_id') || '', adgroup: q.get('ad_group_id') || '',
        page: location.pathname, referrer: document.referrer || '' }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (n) { clearTimeout(timer); if (n && /^\+1\d{10}$/.test(n.number || '') && n.display) { var v = { tel: n.number, display: n.display }; write(v); apply(v); } })
      .catch(function () { clearTimeout(timer); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  ['click', 'scroll', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { var h = read(); if (h) write(h); }, { passive: true, once: false }); });
})();
