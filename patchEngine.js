/**
 * patchEngine.js
 * Core DOM engine injected into Schoology via bookmarklet.
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
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
    _query(r.selector).forEach(function(el){
      el.style.borderLeft   = '3px solid ' + color;
      el.style.paddingLeft  = '8px';
      el.style.background   = r.bg || 'rgba(245,166,35,0.07)';
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
 * Confirmed Schoology DOM structure (from DevTools inspection):
 *
 * Tab strip:   ol.sgy-tabbed-navigation > li[aria-current] > a
 * Feed:        div#home-feed-container.edge-wrapper
 * Todo:        div#right-column > .upcoming-list
 *   Overdue:   div.upcoming-event (before h4.submissions-title)
 *   Upcoming:  h4.submissions-title > div.upcoming-list > div.upcoming-event
 *              each card: span.event-title > a  (link)
 *              course:    span.infotip[aria-label="COURSE : section School"]
 *              date:      nearest preceding div.date-header sibling
 * Feed posts:  li[id^="edge-assoc-"] > .update-body.s-rte
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
    // Using concatenation to avoid any template literal issues
    var css = '';

    // Tab li — mirror Schoology's own li styles exactly
    css += '#spm-tab-li{display:inline-block;vertical-align:bottom;list-style:none;margin:0;padding:0;}';
    css += '#spm-tab-li > a{display:inline-block;padding:10px 16px 9px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#888;text-decoration:none;cursor:pointer;border-bottom:3px solid transparent;transition:color .15s,border-color .15s;white-space:nowrap;}';
    css += '#spm-tab-li > a:hover{color:#1c458e;}';
    css += '#spm-tab-li.on > a{color:#1c458e;border-bottom-color:#1c458e;}';

    // Floating panel
    css += '#spm-panel{position:fixed;top:70px;right:20px;z-index:99999;width:360px;max-height:calc(100vh - 90px);background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.1);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}';
    css += '#spm-panel.on{display:flex;animation:spmIn .2s ease;}';
    css += '@keyframes spmIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}';

    // Panel header (drag handle)
    css += '#spm-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#1c458e;color:#fff;cursor:grab;user-select:none;border-radius:10px 10px 0 0;flex-shrink:0;}';
    css += '#spm-head:active{cursor:grabbing;}';
    css += '#spm-head-title{font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;}';
    css += '#spm-close{background:rgba(255,255,255,.2);border:none;color:#fff;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:13px;line-height:22px;text-align:center;padding:0;transition:background .15s;}';
    css += '#spm-close:hover{background:rgba(255,255,255,.35);}';

    // Scrollable body
    css += '#spm-body{overflow-y:auto;padding:14px 14px 18px;flex:1;}';
    css += '#spm-body::-webkit-scrollbar{width:4px;}';
    css += '#spm-body::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:2px;}';

    // Section headers
    css += '.spm-h{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#bbb;padding:0 0 6px;border-bottom:1px solid #f0f0f0;margin:0 0 8px;}';
    css += '.spm-gap{margin-top:18px;}';

    // Rows
    css += '.spm-row{display:flex;align-items:flex-start;gap:9px;padding:9px 10px;margin-bottom:5px;border-radius:6px;border-left:3px solid #ddd;background:#f8f8f8;}';
    css += '.spm-row.ov{border-left-color:#e53935;background:#fff8f8;}';
    css += '.spm-row.up{border-left-color:#1c458e;background:#f5f8ff;}';
    css += '.spm-row.ev{border-left-color:#f5a623;background:#fffbf2;cursor:pointer;transition:background .15s;}';
    css += '.spm-row.ev:hover{background:#fff3e0;}';
    css += '.spm-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:5px;}';
    css += '.spm-row.ov .spm-dot{background:#e53935;}';
    css += '.spm-row.up .spm-dot{background:#1c458e;}';
    css += '.spm-row.ev .spm-dot{background:#f5a623;}';
    css += '.spm-title{font-size:12.5px;font-weight:600;color:#222;line-height:1.4;}';
    css += '.spm-title a{color:inherit;text-decoration:none;}';
    css += '.spm-title a:hover{text-decoration:underline;}';
    css += '.spm-meta{font-size:11px;color:#999;margin-top:2px;line-height:1.35;}';
    css += '.spm-hint{font-size:10px;color:#ccc;margin-top:3px;font-style:italic;}';
    css += '.spm-badge{display:inline-block;font-size:9px;font-weight:700;background:#1c458e;color:#fff;border-radius:8px;padding:1px 5px;margin-left:4px;vertical-align:middle;}';
    css += '.spm-empty{font-size:12px;color:#bbb;text-align:center;padding:32px 0;line-height:1.8;}';

    // Flash animation for scroll-to
    css += '@keyframes spmFlash{0%{outline:3px solid transparent;background:rgba(245,166,35,0)}25%{outline:3px solid #f5a623;background:rgba(245,166,35,0.15)}100%{outline:3px solid transparent;background:rgba(245,166,35,0)}}';
    css += '.spm-flash{animation:spmFlash 1.8s ease;border-radius:4px;}';

    // Post popup modal
    css += '#spm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:999998;display:none;}';
    css += '#spm-overlay.on{display:block;}';
    css += '#spm-post-popup{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:999999;width:min(520px,90vw);max-height:72vh;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.28);display:none;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}';
    css += '#spm-post-popup.on{display:flex;}';
    css += '#spm-post-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#f5a623;flex-shrink:0;}';
    css += '#spm-post-head-title{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;}';
    css += '#spm-post-close{background:rgba(255,255,255,.3);border:none;color:#fff;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:13px;line-height:22px;text-align:center;padding:0;}';
    css += '#spm-post-close:hover{background:rgba(255,255,255,.5);}';
    css += '#spm-post-body{overflow-y:auto;padding:18px;flex:1;font-size:13.5px;line-height:1.75;color:#333;}';
    css += '#spm-post-body img{max-width:100%;height:auto;border-radius:6px;margin:8px 0;}';

    s.textContent = css;
    document.head.appendChild(s);
  },

  _buildUI: function() {
    if (document.getElementById('spm-panel')) return;
    var self = this;

    /* Tab in ol.sgy-tabbed-navigation — confirmed selector from DevTools */
    var ol = document.querySelector('ol.sgy-tabbed-navigation');
    if (ol) {
      var li = document.createElement('li');
      li.id = 'spm-tab-li';
      var a = document.createElement('a');
      a.textContent = 'Agenda';
      a.href = '#';
      a.addEventListener('click', function(e){ e.preventDefault(); self._toggle(); });
      li.appendChild(a);
      ol.appendChild(li);
    } else {
      /* Fallback: floating pill button */
      var pill = document.createElement('button');
      pill.textContent = 'Agenda';
      pill.style.cssText = 'position:fixed;top:68px;right:80px;z-index:99999;background:#1c458e;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.04em;box-shadow:0 2px 8px rgba(0,0,0,.2);';
      pill.addEventListener('click', function(){ self._toggle(); });
      document.body.appendChild(pill);
    }

    /* Floating draggable panel */
    var panel = document.createElement('div');
    panel.id = 'spm-panel';

    var head = document.createElement('div');
    head.id = 'spm-head';
    head.innerHTML = '<span id="spm-head-title">Agenda</span><button id="spm-close">\u2715</button>';
    panel.appendChild(head);

    var body = document.createElement('div');
    body.id = 'spm-body';
    body.innerHTML = '<div class="spm-empty">Loading\u2026</div>';
    panel.appendChild(body);

    document.body.appendChild(panel);
    head.querySelector('#spm-close').addEventListener('click', function(){ self._toggle(); });
    this._makeDraggable(panel, head);

    /* Overlay + post popup */
    var overlay = document.createElement('div');
    overlay.id = 'spm-overlay';
    overlay.addEventListener('click', function(){ AgendaPanel._closePopup(); });
    document.body.appendChild(overlay);

    var popup = document.createElement('div');
    popup.id = 'spm-post-popup';
    popup.innerHTML = '<div id="spm-post-head"><span id="spm-post-head-title">Post</span><button id="spm-post-close">\u2715</button></div><div id="spm-post-body"></div>';
    document.body.appendChild(popup);
    popup.querySelector('#spm-post-close').addEventListener('click', function(){ AgendaPanel._closePopup(); });
  },

  _makeDraggable: function(panel, handle) {
    var ox, oy, ol, ot;
    handle.addEventListener('mousedown', function(e) {
      if (e.target.id === 'spm-close') return;
      var r = panel.getBoundingClientRect();
      ox = e.clientX; oy = e.clientY; ol = r.left; ot = r.top;
      panel.style.right = 'auto';
      function mv(e) {
        panel.style.left = Math.max(0, ol + e.clientX - ox) + 'px';
        panel.style.top  = Math.max(0, ot + e.clientY - oy) + 'px';
      }
      function up() {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
      e.preventDefault();
    });
  },

  _toggle: function() {
    var panel = document.getElementById('spm-panel');
    var tabLi = document.getElementById('spm-tab-li');
    if (!panel) return;
    var isOn = panel.classList.contains('on');
    panel.classList.toggle('on', !isOn);
    if (tabLi) tabLi.classList.toggle('on', !isOn);
    if (!isOn) this._refreshData();
  },

  _closePopup: function() {
    var popup   = document.getElementById('spm-post-popup');
    var overlay = document.getElementById('spm-overlay');
    if (popup)   popup.classList.remove('on');
    if (overlay) overlay.classList.remove('on');
  },

  _showPopup: function(fromName, postHtml) {
    var popup   = document.getElementById('spm-post-popup');
    var overlay = document.getElementById('spm-overlay');
    var body    = document.getElementById('spm-post-body');
    var title   = document.getElementById('spm-post-head-title');
    if (!popup || !body) return;
    if (title) title.textContent = fromName || 'Feed Post';
    // Set innerHTML directly — postHtml is the original Schoology HTML
    body.innerHTML = postHtml || '<em>No content.</em>';
    popup.classList.add('on');
    if (overlay) overlay.classList.add('on');
  },

  _scrollToPost: function(edgeId) {
    var li = document.getElementById(edgeId);
    if (!li) return false;
    li.style.display = '';
    li.scrollIntoView({ behavior: 'smooth', block: 'center' });
    li.classList.remove('spm-flash');
    void li.offsetWidth;
    li.classList.add('spm-flash');
    return true;
  },

  _refreshData: function() {
    var panel = document.getElementById('spm-panel');
    if (!panel || !panel.classList.contains('on')) return;
    var upcoming = this._scrapeUpcoming();
    var events   = this._scrapeEvents();
    var body = document.getElementById('spm-body');
    if (body) this._render(body, upcoming, events);
  },

  /*
   * Scrape upcoming assignments.
   * Confirmed structure: div.upcoming-event blocks that appear AFTER
   * h4.submissions-title in DOM order, inside #right-column.
   * Each card: span.event-title > a (link), span.infotip[aria-label] (course).
   * Only return the first 3 (soonest due).
   */
  _scrapeUpcoming: function() {
    var items    = [];
    var seen     = {};
    var upHeader = document.querySelector('h4.submissions-title');

    var blocks = document.querySelectorAll('.upcoming-event');

    blocks.forEach(function(block) {
      if (items.length >= 3) return;

      // Only include blocks that come AFTER the UPCOMING header in DOM order
      if (upHeader) {
        var pos = upHeader.compareDocumentPosition(block);
        // DOCUMENT_POSITION_FOLLOWING = 4
        if (!(pos & 4)) return;
      }

      var link = block.querySelector('span.event-title > a');
      if (!link) return;
      var title = link.textContent.trim();
      if (!title || seen[title]) return;
      seen[title] = true;

      // Course from aria-label: "AP PHYSICS I : 4(A) John Randolph Tucker High School"
      var tooltip = block.querySelector('span.infotip[aria-label]');
      var course  = '';
      if (tooltip) {
        course = (tooltip.getAttribute('aria-label') || '').split(':')[0].trim();
      }

      // Due date: walk backwards through siblings for a date-header div
      var dateText = '';
      var prev = block.previousElementSibling;
      while (prev) {
        if (prev.classList && prev.classList.contains('date-header')) {
          dateText = prev.textContent.trim();
          break;
        }
        prev = prev.previousElementSibling;
      }

      var meta = [dateText, course].filter(Boolean).join(' \u00B7 ');
      items.push({ title: title, href: link.getAttribute('href'), meta: meta, cls: 'up' });
    });

    return items;
  },

  /*
   * Scrape feed posts that look like events.
   * Stores edgeId for scroll-to and postHtml for popup display.
   */
  _scrapeEvents: function() {
    var events  = [];
    var pattern = /\b(\d{1,2}[\/\-]\d{1,2}|\d{1,2}:\d{2}\s*[ap]m|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|meeting|event|bingo|game|practice|concert|club|deadline|test|quiz|exam|room\s*\d|auditorium|cafeteria|gym|library)\b/i;

    document.querySelectorAll('li[id^="edge-assoc-"]').forEach(function(li) {
      var bodyEl = li.querySelector('.update-body.s-rte');
      if (!bodyEl) return;
      var text = (bodyEl.innerText || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 10 || !pattern.test(text)) return;

      var nameEl = li.querySelector('.long-username, .edge-sentence a');
      var name   = nameEl ? nameEl.textContent.trim() : 'Feed';
      var preview = text.length > 110 ? text.slice(0, 107) + '\u2026' : text;

      events.push({
        preview:  preview,
        from:     name,
        edgeId:   li.id,
        postHtml: bodyEl.innerHTML  // full HTML for popup
      });
    });

    return events;
  },

  _render: function(body, upcoming, events) {
    var html = '';

    // Upcoming section — always show header so user knows it's working
    html += '<div class="spm-h">Next Up <span class="spm-badge">' + upcoming.length + '</span></div>';
    if (upcoming.length) {
      upcoming.forEach(function(item) {
        var inner = item.href
          ? '<a href="' + _esc(item.href) + '">' + _esc(item.title) + '</a>'
          : _esc(item.title);
        html += '<div class="spm-row up">'
              + '<div class="spm-dot"></div>'
              + '<div>'
              + '<div class="spm-title">' + inner + '</div>'
              + '<div class="spm-meta">' + _esc(item.meta) + '</div>'
              + '</div></div>';
      });
    } else {
      html += '<div class="spm-meta" style="color:#ccc;font-size:11px;padding:2px 0 8px">No upcoming items found. Make sure the To Do sidebar is visible on the page.</div>';
    }

    // Events section
    if (events.length) {
      html += '<div class="spm-h spm-gap">Events in Feed <span class="spm-badge">' + events.length + '</span></div>';
      events.forEach(function(item, i) {
        // Store data in data-attributes — safe because we escape carefully
        html += '<div class="spm-row ev" data-idx="' + i + '">'
              + '<div class="spm-dot"></div>'
              + '<div style="min-width:0">'
              + '<div class="spm-title">' + _esc(item.preview) + '</div>'
              + '<div class="spm-meta">From: ' + _esc(item.from) + '</div>'
              + '<div class="spm-hint">Click to view full post \u2192</div>'
              + '</div></div>';
      });
    }

    if (!html) {
      html = '<div class="spm-empty">Nothing found yet.<br><small>Make sure the page is fully loaded.</small></div>';
    }

    body.innerHTML = html;

    // Attach click handlers using the events array via closure index
    if (events.length) {
      body.querySelectorAll('.spm-row.ev[data-idx]').forEach(function(row) {
        var idx = parseInt(row.getAttribute('data-idx'), 10);
        var item = events[idx];
        if (!item) return;
        row.addEventListener('click', function() {
          // Scroll to the post on the page (close panel temporarily to see it)
          AgendaPanel._scrollToPost(item.edgeId);
          // Show popup with full post content
          AgendaPanel._showPopup('From: ' + item.from, item.postHtml);
        });
      });
    }
  }
};

/* ── PatchManager ────────────────────────────────────────────────────────── */

var PatchManager = {
  _patches: [], _observer: null, _debounce: null,

  run: function(patches) {
    this._patches = patches || [];
    this._applyAll();
    this._watch();
  },

  _applyAll: function() {
    this._patches.forEach(function(p) {
      if (!Array.isArray(p.rules)) return;
      p.rules.forEach(function(r){ RuleEngine.apply(r); });
    });
  },

  _watch: function() {
    if (this._observer) return;
    var self = this;
    this._observer = new MutationObserver(function() {
      clearTimeout(self._debounce);
      self._debounce = setTimeout(function(){ self._applyAll(); }, 250);
    });
    this._observer.observe(document.body, { childList: true, subtree: true });
  }
};
