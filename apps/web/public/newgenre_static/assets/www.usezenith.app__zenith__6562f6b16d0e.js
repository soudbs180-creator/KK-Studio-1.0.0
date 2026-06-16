(function() {
  'use strict';

  var _s = document.currentScript;

  var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
  if (dnt === '1' || dnt === 'yes') return;

  var _domains = _s && _s.getAttribute('data-domains');
  if (_domains) {
    var allowed = _domains.split(',').map(function(d) { return d.trim().toLowerCase(); });
    if (allowed.indexOf(window.location.hostname.toLowerCase()) === -1) return;
  }

  var SITE_ID = "jd748mn4ndwf1f2swh568vyk7d80nb7j";
  var API_URL = (_s && _s.getAttribute('data-api')) || 'https://www.usezenith.app/api/collect';
  var AUTO_TRACK = {"clicks":true,"forms":true,"frustration":true,"outbound":true,"sampleErrorsPct":10,"sampleFrustrationPct":10,"sampleWebVitalsPct":10,"scrollDepth":true,"scrollDepthThresholds":[25,50,75,100],"webVitals":true};

  function shouldSample(percent) {
    if (typeof percent !== 'number') return false;
    if (percent >= 100) return true;
    if (percent <= 0) return false;
    return Math.random() * 100 < percent;
  }

  function getUtmParams() {
    var utmKey = '_zu_' + SITE_ID;
    var params = {};
    var search = window.location.search;
    var clickIdKeys = ['gclid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id', 'twclid'];

    if (search) {
      var pairs = search.substring(1).split('&');
      var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      for (var i = 0; i < pairs.length; i++) {
        var parts = pairs[i].split('=');
        var key = decodeURIComponent(parts[0]);
        if (utmKeys.indexOf(key) !== -1 && parts[1]) {
          params[key] = decodeURIComponent(parts[1]).substring(0, 200);
        }
        if (clickIdKeys.indexOf(key) !== -1 && parts[1]) {
          params[key] = decodeURIComponent(parts[1]).substring(0, 100);
        }
      }
    }

    if (Object.keys(params).length > 0) {
      sessionStorage.setItem(utmKey, JSON.stringify(params));
    } else {
      var stored = sessionStorage.getItem(utmKey);
      if (stored) {
        try { params = JSON.parse(stored); } catch(e) {}
      }
    }

    return params;
  }

  var _queue = [];
  var _flushTimer = null;
  var FLUSH_MS = 2000;
  var STASH_KEY = '_zq_' + SITE_ID;
  var MAX_STASH = 50;

  function stashEvents(events) {
    try {
      var existing = JSON.parse(sessionStorage.getItem(STASH_KEY) || '[]');
      var merged = existing.concat(events).slice(-MAX_STASH);
      sessionStorage.setItem(STASH_KEY, JSON.stringify(merged));
    } catch(e) {}
  }

  function drainStash() {
    try {
      var stashed = sessionStorage.getItem(STASH_KEY);
      if (stashed) {
        var events = JSON.parse(stashed);
        sessionStorage.removeItem(STASH_KEY);
        if (events.length) _queue = events.concat(_queue);
      }
    } catch(e) {}
  }

  var _cacheToken = null;

  function flushQueue(useBeacon) {
    if (_queue.length === 0) return;
    var batch = _queue.splice(0);
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }

    var json = JSON.stringify(batch);

    if (useBeacon && navigator.sendBeacon) {
      var beaconPayload = _cacheToken ? JSON.stringify({ _ct: _cacheToken, e: batch }) : json;
      var blob = new Blob([beaconPayload], { type: 'application/json' });
      navigator.sendBeacon(API_URL, blob);
      return;
    }

    if (typeof fetch === 'function') {
      var fetchHeaders = { 'Content-Type': 'application/json' };
      if (_cacheToken) fetchHeaders['x-zenith-cache'] = _cacheToken;
      fetch(API_URL, { method: 'POST', headers: fetchHeaders, body: json, keepalive: true })
        .then(function(res) {
          var token = res.headers.get('x-zenith-cache');
          if (token) _cacheToken = token;
        })
        .catch(function() { stashEvents(batch); });
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (_cacheToken) xhr.setRequestHeader('x-zenith-cache', _cacheToken);
    xhr.onerror = function() { stashEvents(batch); };
    xhr.onload = function() {
      if (xhr.status >= 400) { stashEvents(batch); return; }
      var token = xhr.getResponseHeader('x-zenith-cache');
      if (token) _cacheToken = token;
    };
    xhr.send(json);
  }

  function track(eventType, metadata, pathOverride) {
    var payload = {
      siteId: SITE_ID,
      eventType: eventType,
      path: pathOverride || window.location.pathname
    };
    if (document.referrer) payload.referrer = document.referrer;
    if (metadata) payload.metadata = metadata;

    if (eventType === 'pageview') {
      var utm = getUtmParams();
      if (utm.utm_source) payload.utmSource = utm.utm_source;
      if (utm.utm_medium) payload.utmMedium = utm.utm_medium;
      if (utm.utm_campaign) payload.utmCampaign = utm.utm_campaign;
      if (utm.utm_content) payload.utmContent = utm.utm_content;
      if (utm.utm_term) payload.utmTerm = utm.utm_term;
      var clickIdKeys = ['gclid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id', 'twclid'];
      for (var ci = 0; ci < clickIdKeys.length; ci++) {
        if (utm[clickIdKeys[ci]]) { payload.clickId = utm[clickIdKeys[ci]]; break; }
      }
    }

    var _beforeSend = _s && _s.getAttribute('data-before-send');
    if (_beforeSend && typeof window[_beforeSend] === 'function') {
      payload = window[_beforeSend](payload);
      if (!payload) return;
    }

    _queue.push(payload);
    if (eventType === 'pageview') { flushQueue(false); return; }
    if (!_flushTimer) _flushTimer = setTimeout(function() { flushQueue(false); }, FLUSH_MS);
  }

  drainStash();

  function getPathKey() {
    return window.location.pathname + window.location.search;
  }

  function getScrollDepthPercent() {
    var doc = document.documentElement;
    var body = document.body;
    var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
    var viewportHeight = window.innerHeight || doc.clientHeight || 0;
    var scrollHeight = Math.max(
      body.scrollHeight, body.offsetHeight,
      doc.clientHeight, doc.scrollHeight, doc.offsetHeight
    );
    var scrollableHeight = scrollHeight - viewportHeight;
    if (scrollableHeight <= 0) return 100;
    var percent = Math.round((scrollTop / scrollableHeight) * 100);
    if (percent < 1) return 1;
    if (percent > 100) return 100;
    return percent;
  }

  var scrollDepthState = {
    path: window.location.pathname,
    pathKey: getPathKey(),
    maxDepth: 1,
    lastThresholdSent: 0
  };

  function resetScrollDepthForCurrentPage() {
    scrollDepthState.path = window.location.pathname;
    scrollDepthState.pathKey = getPathKey();
    scrollDepthState.maxDepth = 1;
    scrollDepthState.lastThresholdSent = 0;
  }

  function updateScrollDepthMax() {
    if (!AUTO_TRACK.scrollDepth) return;
    if (scrollDepthState.pathKey !== getPathKey()) {
      resetScrollDepthForCurrentPage();
    }
    var currentDepth = getScrollDepthPercent();
    if (currentDepth > scrollDepthState.maxDepth) {
      scrollDepthState.maxDepth = currentDepth;
    }
  }

  function getScrollThresholds() {
    var thresholds = AUTO_TRACK.scrollDepthThresholds;
    if (!Array.isArray(thresholds) || thresholds.length === 0) return [25, 50, 75, 100];
    return thresholds
      .map(function(value) { return Math.round(Number(value)); })
      .filter(function(value) { return Number.isFinite(value) && value >= 1 && value <= 100; })
      .sort(function(left, right) { return left - right; });
  }

  function flushScrollDepthThresholds() {
    if (!AUTO_TRACK.scrollDepth) return;
    var thresholds = getScrollThresholds();
    for (var ti = 0; ti < thresholds.length; ti++) {
      var threshold = thresholds[ti];
      if (threshold <= scrollDepthState.lastThresholdSent) continue;
      if (scrollDepthState.maxDepth < threshold) break;
      scrollDepthState.lastThresholdSent = threshold;
      track('scroll_depth', { depthPercent: threshold }, scrollDepthState.path);
    }
  }

  function flushScrollDepthFinal() {
    if (!AUTO_TRACK.scrollDepth) return;
    if (scrollDepthState.maxDepth <= scrollDepthState.lastThresholdSent) return;
    scrollDepthState.lastThresholdSent = scrollDepthState.maxDepth;
    track('scroll_depth', { depthPercent: scrollDepthState.maxDepth }, scrollDepthState.path);
  }

  var _lastPvPath = null;
  var _lastPvTime = 0;

  function trackPageview() {
    var now = Date.now();
    if (window.location.pathname === _lastPvPath && (now - _lastPvTime) < 500) return;
    _lastPvPath = window.location.pathname;
    _lastPvTime = now;
    resetScrollDepthForCurrentPage();
    track('pageview');
    if (AUTO_TRACK.scrollDepth) {
      setTimeout(function() {
        updateScrollDepthMax();
        flushScrollDepthThresholds();
      }, 0);
    }
  }

  trackPageview();

  var pushState = history.pushState;
  history.pushState = function() {
    if (AUTO_TRACK.scrollDepth) {
      updateScrollDepthMax();
      flushScrollDepthFinal();
    }
    pushState.apply(history, arguments);
    lastPathname = window.location.pathname;
    trackPageview();
  };

  var replaceState = history.replaceState;
  var lastPathname = window.location.pathname;
  history.replaceState = function() {
    if (AUTO_TRACK.scrollDepth) {
      updateScrollDepthMax();
      flushScrollDepthFinal();
    }
    replaceState.apply(history, arguments);
    var newPathname = window.location.pathname;
    if (newPathname !== lastPathname) {
      lastPathname = newPathname;
      trackPageview();
    }
  };

  window.addEventListener('popstate', function() {
    if (AUTO_TRACK.scrollDepth) {
      flushScrollDepthFinal();
    }
    lastPathname = window.location.pathname;
    trackPageview();
  });

  window.__p = {
    track: function(eventName, data) {
      var metadata = { label: eventName };
      if (data && typeof data === 'object') {
        if (typeof data.revenue === 'number' && isFinite(data.revenue)) metadata.revenue = data.revenue;
        if (typeof data.currency === 'string') metadata.currency = data.currency.substring(0, 3).toUpperCase();
      }
      track('custom', metadata);
    }
  };

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    var cn = el.className;
    if (cn && typeof cn === 'string') {
      var classes = cn.trim().split(/\s+/).slice(0, 3);
      if (classes.length && classes[0]) return el.tagName.toLowerCase() + '.' + classes.join('.');
    }
    return el.tagName.toLowerCase();
  }

  function getLabel(el) {
    return (el.innerText || el.textContent || '').trim().substring(0, 200);
  }

  function findAncestor(el, test) {
    while (el && el !== document) {
      if (test(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  if (AUTO_TRACK.clicks) {
    document.addEventListener('click', function(e) {
      var el = findAncestor(e.target, function(node) {
        var tag = node.tagName;
        if (tag === 'BUTTON') return true;
        if (tag === 'INPUT' && (node.type === 'button' || node.type === 'submit')) return true;
        if (tag === 'A' && (!node.hostname || node.hostname === window.location.hostname)) return true;
        return false;
      });
      if (el) {
        track('click', { label: getLabel(el), selector: getSelector(el) });
      }
    }, true);
  }

  if (AUTO_TRACK.outbound) {
    document.addEventListener('click', function(e) {
      var el = findAncestor(e.target, function(node) {
        return node.tagName === 'A' && node.hostname && node.hostname !== window.location.hostname;
      });
      if (el) {
        track('outbound', { href: el.href, label: getLabel(el) });
      }
    }, true);
  }

  if (AUTO_TRACK.forms) {
    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (form && form.tagName === 'FORM') {
        track('form_submit', {
          action: form.action || window.location.href,
          method: (form.method || 'GET').toUpperCase(),
          formId: form.id || undefined
        });
      }
    }, true);
  }

  if (AUTO_TRACK.scrollDepth) {
    var scrollTicking = false;
    var onScrollLikeEvent = function() {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(function() {
        updateScrollDepthMax();
        flushScrollDepthThresholds();
        scrollTicking = false;
      });
    };

    window.addEventListener('scroll', onScrollLikeEvent, { passive: true });
    window.addEventListener('resize', onScrollLikeEvent);

    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        updateScrollDepthMax();
        flushScrollDepthFinal();
      }
    });

    window.addEventListener('pagehide', function() {
      updateScrollDepthMax();
      flushScrollDepthFinal();
    });

    window.addEventListener('beforeunload', function() {
      updateScrollDepthMax();
      flushScrollDepthFinal();
    });
  }

  if (AUTO_TRACK.webVitals) {
    var _vitalsSent = {};
    function sendVital(name, value) {
      if (_vitalsSent[name]) return;
      if (!shouldSample(AUTO_TRACK.sampleWebVitalsPct)) return;
      _vitalsSent[name] = true;
      track('web_vital', { vitalName: name, vitalValue: Math.round(name === 'CLS' ? value * 1000 : value) / (name === 'CLS' ? 1000 : 1) });
    }

    try {
      var navEntries = performance.getEntriesByType('navigation');
      if (navEntries && navEntries.length > 0) {
        var nav = navEntries[0];
        if (typeof nav.responseStart === 'number' && nav.responseStart > 0) {
          sendVital('TTFB', nav.responseStart);
        }
      }
    } catch(e) {}

    try {
      var paintEntries = performance.getEntriesByType('paint');
      for (var pi = 0; pi < paintEntries.length; pi++) {
        if (paintEntries[pi].name === 'first-contentful-paint') {
          sendVital('FCP', paintEntries[pi].startTime);
          break;
        }
      }
    } catch(e) {}

    try {
      var lcpValue = 0;
      var lcpObs = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        if (entries.length > 0) lcpValue = entries[entries.length - 1].startTime;
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
      var lcpVis = function() {
        if (document.visibilityState === 'hidden' && lcpValue > 0) {
          sendVital('LCP', lcpValue);
          lcpObs.disconnect();
          document.removeEventListener('visibilitychange', lcpVis);
        }
      };
      document.addEventListener('visibilitychange', lcpVis);
    } catch(e) {}

    try {
      var clsValue = 0;
      var clsSessionValue = 0;
      var clsSessionEntries = [];
      var clsObs = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        for (var ci = 0; ci < entries.length; ci++) {
          var entry = entries[ci];
          if (entry.hadRecentInput) continue;
          if (clsSessionEntries.length > 0 &&
              entry.startTime - clsSessionEntries[clsSessionEntries.length - 1].startTime >= 1000) {
            clsSessionValue = 0;
            clsSessionEntries = [];
          }
          if (clsSessionEntries.length > 0 &&
              entry.startTime - clsSessionEntries[0].startTime >= 5000) {
            clsSessionValue = 0;
            clsSessionEntries = [];
          }
          clsSessionEntries.push(entry);
          clsSessionValue += entry.value;
          if (clsSessionValue > clsValue) clsValue = clsSessionValue;
        }
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
      var clsVis = function() {
        if (document.visibilityState === 'hidden') {
          sendVital('CLS', clsValue);
          clsObs.disconnect();
          document.removeEventListener('visibilitychange', clsVis);
        }
      };
      document.addEventListener('visibilitychange', clsVis);
    } catch(e) {}

    try {
      var inpValue = 0;
      var inpObs = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        for (var ii = 0; ii < entries.length; ii++) {
          var dur = entries[ii].duration;
          if (dur > inpValue) inpValue = dur;
        }
      });
      inpObs.observe({ type: 'event', buffered: true, durationThreshold: 16 });
      var inpVis = function() {
        if (document.visibilityState === 'hidden' && inpValue > 0) {
          sendVital('INP', inpValue);
          inpObs.disconnect();
          document.removeEventListener('visibilitychange', inpVis);
        }
      };
      document.addEventListener('visibilitychange', inpVis);
    } catch(e) {}
  }

  if (AUTO_TRACK.frustration) {
    var _rageBuffer = [];
    var _rageCooldown = 0;
    var RAGE_WINDOW = 800;
    var RAGE_THRESHOLD = 3;
    var RAGE_RADIUS = 30;
    var RAGE_COOLDOWN_MS = 1000;

    document.addEventListener('click', function(e) {
      var now = Date.now();
      if (now < _rageCooldown) return;

      var el = e.target;
      var sel = '';
      try { sel = el && el.tagName ? getSelector(el) : ''; } catch(err) {}

      _rageBuffer.push({ ts: now, x: e.clientX, y: e.clientY, sel: sel, el: el });

      var cutoff = now - RAGE_WINDOW;
      var filtered = [];
      for (var ri = 0; ri < _rageBuffer.length; ri++) {
        if (_rageBuffer[ri].ts >= cutoff) filtered.push(_rageBuffer[ri]);
      }
      _rageBuffer = filtered;

      if (_rageBuffer.length >= RAGE_THRESHOLD) {
        var sameSelector = 0;
        var nearby = 0;
        var first = _rageBuffer[0];
        for (var rj = 0; rj < _rageBuffer.length; rj++) {
          if (_rageBuffer[rj].sel === sel && sel) sameSelector++;
          var dx = _rageBuffer[rj].x - first.x;
          var dy = _rageBuffer[rj].y - first.y;
          if (Math.sqrt(dx * dx + dy * dy) <= RAGE_RADIUS) nearby++;
        }

        if (sameSelector >= RAGE_THRESHOLD || nearby >= RAGE_THRESHOLD) {
          var rageEl = el;
          var rageLabel = '';
          try { rageLabel = rageEl ? getLabel(rageEl) : ''; } catch(err) {}
          if (shouldSample(AUTO_TRACK.sampleFrustrationPct)) {
            track('rage_click', { selector: sel, label: rageLabel, rageClickCount: _rageBuffer.length });
          }
          _rageBuffer = [];
          _rageCooldown = now + RAGE_COOLDOWN_MS;
        }
      }
    }, true);

    var _errorsSent = {};
    var _errorCount = 0;
    var MAX_ERRORS = 10;

    window.addEventListener('error', function(e) {
      if (_errorCount >= MAX_ERRORS) return;
      if (!shouldSample(AUTO_TRACK.sampleErrorsPct)) return;
      var msg = (e.message || '').substring(0, 500);
      if (!msg || _errorsSent[msg]) return;
      _errorsSent[msg] = true;
      _errorCount++;
      var src = '';
      if (e.filename) src = e.filename + ':' + (e.lineno || 0) + ':' + (e.colno || 0);
      track('js_error', { errorMessage: msg, errorSource: src.substring(0, 200) });
    });

    window.addEventListener('unhandledrejection', function(e) {
      if (_errorCount >= MAX_ERRORS) return;
      if (!shouldSample(AUTO_TRACK.sampleErrorsPct)) return;
      var reason = e.reason;
      var msg = '';
      if (reason && typeof reason === 'object' && reason.message) {
        msg = String(reason.message).substring(0, 500);
      } else if (typeof reason === 'string') {
        msg = reason.substring(0, 500);
      }
      if (!msg || _errorsSent[msg]) return;
      _errorsSent[msg] = true;
      _errorCount++;
      track('js_error', { errorMessage: msg, errorSource: 'unhandledrejection' });
    });
  }

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') flushQueue(true);
  });
  window.addEventListener('pagehide', function() { flushQueue(true); });

})();