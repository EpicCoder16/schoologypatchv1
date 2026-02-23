/**
 * patchEngine.js
 * Core DOM engine — injected into Schoology via bookmarklet.
 *
 * Rule types: hide, css, addClass, removeClass, highlight, move, inject, agenda
 */

function _query(sel) {
  if (!sel) return [];
  try { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  catch(e) { return []; }
}
function _one(sel) {
  if (!sel) return null;
  try { return document.querySelector(sel); }
  catch(e) { return null; }
}
function _esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── RuleEngine ──────────────────────────────────────────────────────────── */

var RuleEngine = {
  apply: function(rule) {
    try {
      switch(rule.type) {
        case 'hide':        return this._hide(rule);
        case 'css':         return this._css(rule);
        case 'addClass':    return this._addClass(rule);
        case 'removeClass': return this._removeClass(rule);
        case 'highlight':   return this._highlight(rule);
        case 'move':        return this._move(rule);
        case 'inject':      return this._inject(rule);
        case 'agenda':      return AgendaPanel.init();
        default: return false;
      }
    } catch(e) { console.warn('[Patch] Rule error:', rule.type, e); return false; }
  },

  _hide: function(r) {
    var els = _query(r.selector);
    els.forEach(function(el){ el.style.display='none'; });
    return els.length > 0;
  },

  _css: function(r) {
    if (!r.styles) return false;
    _query(r.selector).forEach(function(el){ el.style.cssText += r.styles; });
    return true;
  },

  _addClass: function(r) {
    if (!r.className) return false;
    _query(r.selector).forEach(function(el){ el.classList.add(r.className); });
    return true;
  },

  _removeClass: function(r) {
    if (!r.className) return false;
    _query(r.selector).forEach(function(el){ el.classList.remove(r.className); });
    return true;
  },

  _highlight: function(r) {
    var color = r.color || '#f5a623';
    var bg    = r.bg    || 'rgba(245,166,35,0.07)';
    _query(r.selector).forEach(function(el){
      el.style.borderLeft   = '3px solid ' + color;
      el.style.paddingLeft  = '8px';
      el.style.background   = bg;
      el.style.borderRadius = '3px';
    });
    return true;
  },

  _move: function(r) {
    if (!r.target) return false;
    var dest = _one(r.target);
    if (!dest) return false;
    _query(r.selector).forEach(function(el){
      if (r.position === 'prepend') dest.insertBefore(el, dest.firstChild);
      else dest.appendChild(el);
    });
    return true;
  },

  _inject: function(r) {
    if (!r.html || !r.target) return false;
    var t = _one(r.target);
    if (!t) return false;
    if (r.once && t.dataset.spmDone) return true;
    if (r.position === 'replace') t.innerHTML = r.html;
    else t.insertAdjacentHTML(r.position || 'beforeend', r.html);
    if (r.once) t.dataset.spmDone = '1';
    return true;
  }
};

/* ── AgendaPanel ─────────────────────────────────────────────────────────── */
/*
 * Confirmed DOM structure from DevTools inspection:
 *
 * OVERDUE section:
 *   #right-column .upcoming-list
 *     div#overdue_submissions.date-header          ← date group header
 *     div.upcoming-event.upcoming-event-block      ← one assignment
 *       h4 > span.infotip[aria-label="COURSE : section School"]
 *         span.event-title > a.sExtlink-processed  ← TITLE LINK ✓
 *         span.event-title > span                  ← days overdue badge
 *
 * UPCOMING section (after h4.submissions-title "UPCOMING"):
 *   div#upcoming_submissions.date-header           ← date group header
 *   div.upcoming-event.upcoming-event-block        ← one assignment
 *     (same structure as overdue)
 *
 * Feed events:
 *   li[id^="edge-assoc-"] .update-body.s-rte       ← post body text
 *   li[id^="edge-assoc-"] .long-username           ← poster name
 */

var AgendaPanel = {
  _built: false,

  init: function() {
    if (this._built) { this._refreshData(); return true; }
    this._built = true;
    this._injectStyles();
    this._buildUI();
    var self = this;
    setTimeout(function(){ self._refreshData(); }, 600);
    return true;
  },

  _injectStyles: function() {
    if (document.getElementById('spm-styles')) return;
    var s = document.createElement('style');
    s.id = 'spm-styles';
    s.textContent = [
      /* ── Tab li injected into ol.sgy-tabbed-navigation ── */
      '#spm-tab-li{list-style:none;}',
      '#spm-tab-li a{',
        'display:inline-block;padding:10px 16px;',
        'font-size:13px;font-weight:600;letter-spacing:.03em;',
        'color:#888;text-decoration:none;cursor:pointer;',
        'border-bottom:3px solid transparent;',
        'transition:color .15s,border-color .15s;',
        'white-space:nowrap;',
      '}',
      '#spm-tab-li a:hover{color:#1c458e;}',
      '#spm-tab-li.spm-on a{color:#1c458e;border-bottom-color:#1c458e;}',

      /* ── Floating draggable panel ── */
      '#spm-panel{',
        'position:fixed;top:70px;right:20px;z-index:99999;',
        'width:360px;max-height:calc(100vh - 100px);',
        'background:#fff;border-radius:10px;',
        'box-shadow:0 8px 32px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.1);',
        'display:none;flex-direction:column;overflow:hidden;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      '}',
      '#spm-panel.on{display:flex;}',
      '@keyframes spmIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}',
      '#spm-panel.on{animation:spmIn .2s ease;}',

      /* ── Panel header / drag handle ── */
      '#spm-panel-head{',
        'display:flex;align-items:center;justify-content:space-between;',
        'padding:12px 14px 11px;',
        'background:#1c458e;color:#fff;',
        'cursor:grab;user-select:none;border-radius:10px 10px 0 0;',
        'flex-shrink:0;',
      '}',
      '#spm-panel-head:active{cursor:grabbing;}',
      '#spm-panel-title{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;}',
      '#spm-panel-close{',
        'background:rgba(255,255,255,.2);border:none;color:#fff;',
        'width:22px;height:22px;border-radius:50%;cursor:pointer;',
        'font-size:14px;line-height:22px;text-align:center;',
        'transition:background .15s;padding:0;',
      '}',
      '#spm-panel-close:hover{background:rgba(255,255,255,.35);}',

      /* ── Scrollable body ── */
      '#spm-panel-body{overflow-y:auto;padding:14px 14px 18px;flex:1;}',
      '#spm-panel-body::-webkit-scrollbar{width:4px;}',
      '#spm-panel-body::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px;}',

      /* ── Section headers ── */
      '.spm-h{',
        'font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;',
        'color:#aaa;padding:0 0 6px;border-bottom:1px solid #eee;margin:0 0 8px;',
      '}',
      '.spm-gap{margin-top:18px;}',

      /* ── Rows ── */
      '.spm-row{',
        'display:flex;align-items:flex-start;gap:9px;',
        'padding:9px 10px;margin-bottom:5px;border-radius:6px;',
        'border-left:3px solid #ddd;background:#f8f8f8;',
      '}',
      '.spm-row.ov{border-left-color:#e53935;background:#fff8f8;}',
      '.spm-row.up{border-left-color:#1c458e;background:#f5f8ff;}',
      '.spm-row.ev{border-left-color:#f5a623;background:#fffbf2;}',
      '.spm-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:5px;}',
      '.spm-row.ov .spm-dot{background:#e53935;}',
      '.spm-row.up .spm-dot{background:#1c458e;}',
      '.spm-row.ev .spm-dot{background:#f5a623;}',
      '.spm-title{font-size:12.5px;font-weight:600;color:#222;line-height:1.4;}',
      '.spm-title a{color:inherit;text-decoration:none;}',
      '.spm-title a:hover{text-decoration:underline;}',
      '.spm-meta{font-size:11px;color:#999;margin-top:2px;line-height:1.35;}',
      '.spm-badge{',
        'display:inline-block;font-size:9px;font-weight:700;',
        'background:#1c458e;color:#fff;border-radius:8px;',
        'padding:1px 5px;margin-left:4px;vertical-align:middle;',
      '}',
      '.spm-empty{font-size:12px;color:#bbb;text-align:center;padding:32px 0;}',
    ].join('');
    document.head.appendChild(s);
  },

  _buildUI: function() {
    if (document.getElementById('spm-panel')) return;

    /* ── Tab in Schoology's ol.sgy-tabbed-navigation ── */
    var ol = document.querySelector('ol.sgy-tabbed-navigation');
    if (ol) {
      var li = document.createElement('li');
      li.id = 'spm-tab-li';
      var a = document.createElement('a');
      a.textContent = 'Agenda';
      a.href = '#';
      var self = this;
      a.addEventListener('click', function(e){ e.preventDefault(); self._toggle(); });
      li.appendChild(a);
      ol.appendChild(li);
    } else {
      /* Fallback: floating trigger button if tab strip not found */
      var trigger = document.createElement('button');
      trigger.id = 'spm-trigger';
      trigger.textContent = '📅';
      trigger.title = 'Open Agenda';
      trigger.style.cssText = 'position:fixed;top:68px;right:20px;z-index:99999;width:36px;height:36px;border-radius:50%;background:#1c458e;color:#fff;border:none;font-size:16px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);';
      var self = this;
      trigger.addEventListener('click', function(){ self._toggle(); });
      document.body.appendChild(trigger);
    }

    /* ── Floating panel ── */
    var panel = document.createElement('div');
    panel.id = 'spm-panel';

    /* Header / drag handle */
    var head = document.createElement('div');
    head.id = 'spm-panel-head';
    head.innerHTML = '<span id="spm-panel-title">📅 Agenda</span><button id="spm-panel-close" title="Close">✕</button>';
    panel.appendChild(head);

    /* Scrollable body */
    var body = document.createElement('div');
    body.id = 'spm-panel-body';
    body.innerHTML = '<div class="spm-empty">Loading…</div>';
    panel.appendChild(body);

    document.body.appendChild(panel);

    /* Close button */
    var self = this;
    head.querySelector('#spm-panel-close').addEventListener('click', function(){ self._toggle(); });

    /* Drag to move */
    this._makeDraggable(panel, head);
  },

  /* ── Drag logic ─────────────────────────────────────────────── */
  _makeDraggable: function(panel, handle) {
    var startX, startY, startLeft, startTop;

    handle.addEventListener('mousedown', function(e) {
      if (e.target.id === 'spm-panel-close') return;
      startX = e.clientX;
      startY = e.clientY;
      var rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop  = rect.top;
      panel.style.right = 'auto'; // switch from right-anchored to left-anchored

      function onMove(e) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        panel.style.left = Math.max(0, startLeft + dx) + 'px';
        panel.style.top  = Math.max(0, startTop  + dy) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
  },

  /* ── Toggle panel open/closed ───────────────────────────────── */
  _toggle: function() {
    var panel  = document.getElementById('spm-panel');
    var tabLi  = document.getElementById('spm-tab-li');
    if (!panel) return;
    var isOn = panel.classList.contains('on');
    if (isOn) {
      panel.classList.remove('on');
      if (tabLi) tabLi.classList.remove('spm-on');
    } else {
      panel.classList.add('on');
      if (tabLi) tabLi.classList.add('spm-on');
      this._refreshData();
    }
  },

  /* ── Scrape + render ────────────────────────────────────────── */
  _refreshData: function() {
    var panel = document.getElementById('spm-panel');
    if (!panel || !panel.classList.contains('on')) return;
    var overdue  = this._scrapeOverdue();
    var upcoming = this._scrapeUpcoming();
    var events   = this._scrapeEvents();
    var body = document.getElementById('spm-panel-body');
    if (body) this._render(body, overdue, upcoming, events);
  },

  /*
   * OVERDUE — confirmed selectors from DevTools:
   *   div.upcoming-event.upcoming-event-block  (each assignment card)
   *     span.event-title > a                   (assignment link)
   *     span.infotip[aria-label]               (course in aria-label)
   * Overdue cards appear BEFORE h4.submissions-title in DOM order.
   */
  _scrapeOverdue: function() {
    var items = [];
    var seen  = {};
    var upHeader = document.querySelector('h4.submissions-title');

    document.querySelectorAll('.upcoming-event').forEach(function(block) {
      // Skip blocks that come after the UPCOMING header
      if (upHeader && (upHeader.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING)) return;

      var link = block.querySelector('span.event-title > a');
      if (!link) return;
      var title = link.textContent.trim();
      if (!title || seen[title]) return;
      seen[title] = true;

      var tooltip = block.querySelector('span.infotip[aria-label]');
      var course  = tooltip ? (tooltip.getAttribute('aria-label')||'').split(':')[0].trim() : '';
      var daysEl  = block.querySelector('span.event-title span');
      var days    = daysEl ? daysEl.textContent.trim() : '';
      var meta    = [course, days].filter(Boolean).join(' · ');

      items.push({ title: title, href: link.getAttribute('href'), meta: meta, cls: 'ov' });
    });
    return items;
  },

  /*
   * UPCOMING — same card structure, appear AFTER h4.submissions-title.
   * Date text is in preceding div[id="upcoming_submissions"].date-header siblings.
   */
  _scrapeUpcoming: function() {
    var items   = [];
    var seen    = {};
    var upHeader = document.querySelector('h4.submissions-title');
    if (!upHeader) return items;

    var passed = false;
    document.querySelectorAll('.upcoming-list > *').forEach(function(el) {
      if (!passed) {
        if (el === upHeader || el.contains(upHeader)) { passed = true; }
        return;
      }
      if (!el.classList.contains('upcoming-event')) return;

      var link = el.querySelector('span.event-title > a');
      if (!link) return;
      var title = link.textContent.trim();
      if (!title || seen[title]) return;
      seen[title] = true;

      var tooltip = el.querySelector('span.infotip[aria-label]');
      var course  = tooltip ? (tooltip.getAttribute('aria-label')||'').split(':')[0].trim() : '';

      // Walk back to find nearest date-header sibling
      var dateText = '';
      var prev = el.previousElementSibling;
      while (prev) {
        if (prev.classList && prev.classList.contains('date-header')) {
          dateText = prev.textContent.trim();
          break;
        }
        prev = prev.previousElementSibling;
      }

      var meta = [dateText, course].filter(Boolean).join(' · ');
      items.push({ title: title, href: link.getAttribute('href'), meta: meta, cls: 'up' });
    });
    return items;
  },

  /* FEED EVENTS — scan post bodies for event-like text */
  _scrapeEvents: function() {
    var events  = [];
    var pattern = /\b(\d{1,2}[\/\-]\d{1,2}|\d{1,2}:\d{2}\s*[ap]m|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|meeting|event|bingo|game|practice|concert|club|deadline|test|quiz|exam|room\s*\d|auditorium|cafeteria|gym|library)\b/i;

    document.querySelectorAll('li[id^="edge-assoc-"]').forEach(function(li) {
      var bodyEl = li.querySelector('.update-body.s-rte');
      if (!bodyEl) return;
      var text = (bodyEl.innerText||'').replace(/\s+/g,' ').trim();
      if (!text || text.length < 10 || !pattern.test(text)) return;
      var nameEl = li.querySelector('.long-username, .edge-sentence a');
      var name   = nameEl ? nameEl.textContent.trim() : 'Feed';
      events.push({ title: text.length > 130 ? text.slice(0,127)+'…' : text, href: null, meta: 'From: '+name, cls: 'ev' });
    });
    return events;
  },

  _render: function(body, overdue, upcoming, events) {
    var html = '';
    var gap  = false;

    if (overdue.length) {
      html += '<div class="spm-h">Overdue <span class="spm-badge">'+overdue.length+'</span></div>';
      overdue.slice(0,10).forEach(function(i){ html += AgendaPanel._row(i); });
      if (overdue.length > 10) html += '<div class="spm-meta" style="text-align:center;color:#bbb;font-size:11px;padding:4px 0">+'+(overdue.length-10)+' more in sidebar</div>';
      gap = true;
    }
    if (upcoming.length) {
      html += '<div class="spm-h'+(gap?' spm-gap':'')+'">Upcoming <span class="spm-badge">'+upcoming.length+'</span></div>';
      upcoming.slice(0,12).forEach(function(i){ html += AgendaPanel._row(i); });
      gap = true;
    }
    if (events.length) {
      html += '<div class="spm-h'+(gap?' spm-gap':'')+'">Events in Feed <span class="spm-badge">'+events.length+'</span></div>';
      events.forEach(function(i){ html += AgendaPanel._row(i); });
    }
    if (!html) html = '<div class="spm-empty">Nothing found yet.<br><small>Make sure the page is fully loaded, then click Agenda again.</small></div>';
    body.innerHTML = html;
  },

  _row: function(item) {
    var inner = item.href
      ? '<a href="'+_esc(item.href)+'">'+_esc(item.title)+'</a>'
      : _esc(item.title);
    return '<div class="spm-row '+item.cls+'"><div class="spm-dot"></div><div>'
         + '<div class="spm-title">'+inner+'</div>'
         + '<div class="spm-meta">'+_esc(item.meta)+'</div>'
         + '</div></div>';
  }
};

/* ── PatchManager ────────────────────────────────────────────────────────── */

var PatchManager = {
  _patches:[], _observer:null, _debounce:null,

  run: function(patches) {
    this._patches = patches||[];
    this._applyAll();
    this._watch();
  },

  _applyAll: function() {
    this._patches.forEach(function(p){
      if (!Array.isArray(p.rules)) return;
      p.rules.forEach(function(r){ RuleEngine.apply(r); });
    });
  },

  _watch: function() {
    if (this._observer) return;
    var self = this;
    this._observer = new MutationObserver(function(){
      clearTimeout(self._debounce);
      self._debounce = setTimeout(function(){ self._applyAll(); }, 250);
    });
    this._observer.observe(document.body, {childList:true, subtree:true});
  }
};
