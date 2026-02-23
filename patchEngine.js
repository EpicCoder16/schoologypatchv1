/**
 * patchEngine.js
 * Core DOM engine — runs inside Schoology via bookmarklet injection.
 *
 * Rule types supported:
 *   hide        — display:none matching elements
 *   css         — append inline styles to matching elements
 *   addClass    — add a CSS class
 *   removeClass — remove a CSS class
 *   highlight   — apply a colored left-border + background tint
 *   move        — relocate element(s) to a new parent in the DOM
 *   inject      — insert an HTML string at/into a target element
 *   agenda      — special: scrape feed + todo, render a smart agenda tab
 */

/* ── Utility ─────────────────────────────────────────────────────────────── */

function _query(selector) {
  if (!selector) return [];
  try { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
  catch(e) { return []; }
}

function _one(selector) {
  if (!selector) return null;
  try { return document.querySelector(selector); }
  catch(e) { return null; }
}

/* ── RuleEngine ──────────────────────────────────────────────────────────── */

var RuleEngine = {

  apply: function(rule) {
    try {
      switch (rule.type) {
        case 'hide':        return this._hide(rule);
        case 'css':         return this._css(rule);
        case 'addClass':    return this._addClass(rule);
        case 'removeClass': return this._removeClass(rule);
        case 'highlight':   return this._highlight(rule);
        case 'move':        return this._move(rule);
        case 'inject':      return this._inject(rule);
        case 'agenda':      return AgendaPanel.init(rule);
        default: return false;
      }
    } catch(e) { return false; }
  },

  _hide: function(rule) {
    var els = _query(rule.selector);
    els.forEach(function(el) { el.style.display = 'none'; });
    return els.length > 0;
  },

  _css: function(rule) {
    if (!rule.styles) return false;
    var els = _query(rule.selector);
    els.forEach(function(el) { el.style.cssText += rule.styles; });
    return els.length > 0;
  },

  _addClass: function(rule) {
    if (!rule.className) return false;
    var els = _query(rule.selector);
    els.forEach(function(el) { el.classList.add(rule.className); });
    return els.length > 0;
  },

  _removeClass: function(rule) {
    if (!rule.className) return false;
    var els = _query(rule.selector);
    els.forEach(function(el) { el.classList.remove(rule.className); });
    return els.length > 0;
  },

  /**
   * highlight — draws a colored accent on matching elements.
   * rule.color  : CSS color string (default: #f5a623)
   * rule.bgAlpha: 0–1 background opacity (default: 0.07)
   */
  _highlight: function(rule) {
    var color = rule.color || '#f5a623';
    var els = _query(rule.selector);
    els.forEach(function(el) {
      el.style.borderLeft = '3px solid ' + color;
      el.style.paddingLeft = '8px';
      el.style.background = rule.bg || 'rgba(245,166,35,0.07)';
      el.style.borderRadius = '3px';
    });
    return els.length > 0;
  },

  /**
   * move — physically relocates matched elements into a target parent.
   * rule.selector : elements to move
   * rule.target   : destination parent selector
   * rule.position : 'append' (default) | 'prepend'
   */
  _move: function(rule) {
    if (!rule.target) return false;
    var dest = _one(rule.target);
    if (!dest) return false;
    var els = _query(rule.selector);
    els.forEach(function(el) {
      if (rule.position === 'prepend') dest.insertBefore(el, dest.firstChild);
      else dest.appendChild(el);
    });
    return els.length > 0;
  },

  /**
   * inject — insert HTML relative to a target element.
   * rule.target   : destination selector
   * rule.html     : HTML string to insert
   * rule.position : 'beforebegin'|'afterbegin'|'beforeend'(default)|'afterend'
   *                 OR 'replace' to swap innerHTML
   * rule.once     : if true, skip if data-spm-injected already set on target
   */
  _inject: function(rule) {
    if (!rule.html || !rule.target) return false;
    var target = _one(rule.target);
    if (!target) return false;
    if (rule.once && target.dataset.spmInjected) return true; // already done
    var pos = rule.position || 'beforeend';
    if (pos === 'replace') {
      target.innerHTML = rule.html;
    } else {
      target.insertAdjacentHTML(pos, rule.html);
    }
    if (rule.once) target.dataset.spmInjected = '1';
    return true;
  }
};

/* ── AgendaPanel ─────────────────────────────────────────────────────────── */
/**
 * Scrapes the live Schoology DOM for:
 *   1. Upcoming assignments from #right-column (.upcoming-item or similar)
 *   2. Event-like text from feed posts (.update-body.s-rte)
 * Then injects a new "AGENDA" tab next to "Recent Activity" and renders
 * a unified, sorted agenda view inside a new panel.
 */

var AgendaPanel = {

  _built: false,

  init: function(rule) {
    if (this._built) {
      // On MutationObserver re-runs, just refresh data
      this._refreshData();
      return true;
    }
    this._built = true;
    this._injectStyles();
    this._buildTab();
    this._buildPanel();
    this._refreshData();
    return true;
  },

  /* ── Inject scoped CSS so the panel looks good inside Schoology ── */
  _injectStyles: function() {
    if (document.getElementById('spm-agenda-styles')) return;
    var style = document.createElement('style');
    style.id = 'spm-agenda-styles';
    style.textContent = [
      '#spm-agenda-tab {',
      '  display:inline-block; padding:10px 16px; cursor:pointer;',
      '  font-size:13px; font-weight:600; letter-spacing:.04em; text-transform:uppercase;',
      '  color:#666; border-bottom:2px solid transparent; transition:color .15s,border-color .15s;',
      '  user-select:none;',
      '}',
      '#spm-agenda-tab.spm-active { color:#1c458e; border-bottom-color:#1c458e; }',
      '#spm-agenda-tab:hover { color:#1c458e; }',
      '#spm-agenda-panel {',
      '  display:none; padding:16px 0; animation: spmFadeIn .2s ease;',
      '}',
      '#spm-agenda-panel.spm-visible { display:block; }',
      '@keyframes spmFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }',
      '.spm-section-head {',
      '  font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;',
      '  color:#999; padding:4px 0 8px; border-bottom:1px solid #e8e8e8; margin-bottom:10px;',
      '}',
      '.spm-item {',
      '  display:flex; align-items:flex-start; gap:12px;',
      '  padding:10px 12px; margin-bottom:6px; border-radius:6px;',
      '  background:#f8f9fc; border-left:3px solid #ccc; transition:background .15s;',
      '}',
      '.spm-item:hover { background:#f0f3fb; }',
      '.spm-item.spm-overdue { border-left-color:#e53935; background:#fff8f8; }',
      '.spm-item.spm-upcoming { border-left-color:#1c458e; background:#f5f8ff; }',
      '.spm-item.spm-event { border-left-color:#f5a623; background:#fffbf2; }',
      '.spm-dot {',
      '  width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-top:5px;',
      '}',
      '.spm-item.spm-overdue .spm-dot { background:#e53935; }',
      '.spm-item.spm-upcoming .spm-dot { background:#1c458e; }',
      '.spm-item.spm-event .spm-dot { background:#f5a623; }',
      '.spm-title { font-size:13px; font-weight:600; color:#222; line-height:1.4; }',
      '.spm-meta { font-size:11px; color:#888; margin-top:2px; }',
      '.spm-empty { font-size:13px; color:#aaa; text-align:center; padding:32px 0; }',
      '.spm-count {',
      '  display:inline-block; font-size:10px; font-weight:700;',
      '  background:#1c458e; color:#fff; border-radius:10px;',
      '  padding:1px 6px; margin-left:6px; vertical-align:middle;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  },

  /* ── Add an "AGENDA" tab next to the existing tabs ─────────────── */
  _buildTab: function() {
    // Tab strip: confirmed selector from inspector
    // Schoology uses <ul class="s-tabbed-navigation-tabs"> or a generic tab list
    // We insert after whatever tab list we can find
    var tabStrip = _one('.s-tabbed-navigation-tabs, .tabs-bar, [role="tablist"], .center-top-tabs');

    var tab = document.createElement('span');
    tab.id = 'spm-agenda-tab';
    tab.textContent = 'Agenda';

    var self = this;

    tab.addEventListener('click', function() {
      self._showAgenda();
    });

    if (tabStrip) {
      tabStrip.appendChild(tab);
    } else {
      // Fallback: insert before the feed
      var feed = _one('.feed, #main-inner');
      if (feed) feed.parentNode.insertBefore(tab, feed);
    }
  },

  /* ── Build the hidden panel that will hold agenda content ───────── */
  _buildPanel: function() {
    var panel = document.createElement('div');
    panel.id = 'spm-agenda-panel';

    // Insert panel after the feed container so it takes the same space
    var feed = _one('.feed, #main-inner, #center');
    if (feed) {
      feed.parentNode.insertBefore(panel, feed.nextSibling);
    } else {
      // Last resort: append to content wrapper
      var cw = _one('#content-wrapper, #center-wrapper');
      if (cw) cw.appendChild(panel);
    }
  },

  /* ── Show the agenda panel, hide the normal feed ────────────────── */
  _showAgenda: function() {
    // Deactivate other tabs visually
    var existingActive = _one('.spm-active');
    if (existingActive) existingActive.classList.remove('spm-active');

    var tab = document.getElementById('spm-agenda-tab');
    if (tab) tab.classList.add('spm-active');

    // Hide feed, show agenda
    var feed = _one('.feed, #main-inner');
    var tabs = _one('.s-tabbed-navigation-tabs, .tabs-bar');
    var panel = document.getElementById('spm-agenda-panel');

    if (feed) feed.style.display = 'none';
    if (panel) panel.classList.add('spm-visible');

    this._refreshData();
  },

  /* ── Scrape DOM and re-render agenda content ────────────────────── */
  _refreshData: function() {
    var panel = document.getElementById('spm-agenda-panel');
    if (!panel || !panel.classList.contains('spm-visible')) return;

    var assignments = this._scrapeAssignments();
    var events      = this._scrapeEvents();

    this._render(panel, assignments, events);
  },

  /**
   * Scrape the To Do sidebar (#right-column) for assignments.
   * Returns array of { title, meta, type:'overdue'|'upcoming' }
   */
  _scrapeAssignments: function() {
    var items = [];

    // Overdue items
    _query('#right-column .overdue-header ~ * a, #right-column [class*="overdue"] a').forEach(function(a) {
      var text = a.textContent.trim();
      if (!text || text.length < 3) return;
      var metaEl = a.closest('li, .todo-item, [class*="item"]');
      var meta = metaEl ? metaEl.textContent.replace(text, '').replace(/\s+/g,' ').trim() : '';
      items.push({ title: text, meta: meta, type: 'overdue' });
    });

    // Upcoming items — Schoology renders these as links inside the right column
    // Walk all links in right-column that aren't already captured as overdue
    var seen = {};
    items.forEach(function(i) { seen[i.title] = true; });

    _query('#right-column a[href]').forEach(function(a) {
      var text = a.textContent.trim();
      if (!text || text.length < 3 || seen[text]) return;
      if (/more overdue|show all/i.test(text)) return;
      var metaEl = a.closest('li, .upcoming-item, [class*="item"], div');
      var rawMeta = metaEl ? metaEl.textContent.replace(text,'').replace(/\s+/g,' ').trim() : '';
      // Only include if meta looks like a date (contains month name or "Due")
      if (/due|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}/i.test(rawMeta)) {
        items.push({ title: text, meta: rawMeta, type: 'upcoming' });
        seen[text] = true;
      }
    });

    return items;
  },

  /**
   * Scrape the activity feed for event-like posts.
   * Looks for posts containing dates, times, or event keywords.
   * Returns array of { title, meta, type:'event', source }
   */
  _scrapeEvents: function() {
    var events = [];
    var eventPattern = /\b(\d{1,2}[\/\-]\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}:\d{2}\s*[ap]m|monday|tuesday|wednesday|thursday|friday|today|tomorrow|tonight|meeting|event|bingo|game|practice|concert|club|presentation|deadline|test|quiz|exam)\b/i;

    _query('li[id^="edge-assoc-"]').forEach(function(li) {
      var bodyEl = li.querySelector('.update-body.s-rte, .update-sentence-inner');
      if (!bodyEl) return;
      var text = bodyEl.innerText || bodyEl.textContent || '';
      text = text.replace(/\s+/g,' ').trim();
      if (!text || text.length < 10) return;
      if (!eventPattern.test(text)) return;

      // Get poster name from attribution line
      var nameEl = li.querySelector('.long-username, .update-sentence-inner a');
      var name = nameEl ? nameEl.textContent.trim() : 'Posted';

      // Truncate long text
      var title = text.length > 120 ? text.substring(0, 117) + '…' : text;

      events.push({ title: title, meta: 'From: ' + name, type: 'event' });
    });

    return events;
  },

  /* ── Render everything into the panel ──────────────────────────── */
  _render: function(panel, assignments, events) {
    var overdue  = assignments.filter(function(a) { return a.type === 'overdue'; });
    var upcoming = assignments.filter(function(a) { return a.type === 'upcoming'; });

    var html = '';

    // ── Overdue ──
    if (overdue.length > 0) {
      html += '<div class="spm-section-head">Overdue <span class="spm-count">' + overdue.length + '</span></div>';
      overdue.slice(0, 8).forEach(function(item) {
        html += AgendaPanel._itemHTML(item);
      });
      if (overdue.length > 8) {
        html += '<div class="spm-meta" style="text-align:center;padding:4px 0;">+ ' + (overdue.length - 8) + ' more — see To Do panel</div>';
      }
    }

    // ── Upcoming assignments ──
    if (upcoming.length > 0) {
      html += '<div class="spm-section-head" style="margin-top:18px">Upcoming Assignments <span class="spm-count">' + upcoming.length + '</span></div>';
      upcoming.slice(0, 10).forEach(function(item) {
        html += AgendaPanel._itemHTML(item);
      });
    }

    // ── Feed events ──
    if (events.length > 0) {
      html += '<div class="spm-section-head" style="margin-top:18px">Events in Feed <span class="spm-count">' + events.length + '</span></div>';
      events.forEach(function(item) {
        html += AgendaPanel._itemHTML(item);
      });
    }

    if (!html) {
      html = '<div class="spm-empty">Nothing found yet — make sure the feed and To Do sidebar have loaded.</div>';
    }

    panel.innerHTML = html;
  },

  _itemHTML: function(item) {
    return [
      '<div class="spm-item spm-' + item.type + '">',
      '  <div class="spm-dot"></div>',
      '  <div>',
      '    <div class="spm-title">' + AgendaPanel._esc(item.title) + '</div>',
      '    <div class="spm-meta">'  + AgendaPanel._esc(item.meta)  + '</div>',
      '  </div>',
      '</div>'
    ].join('');
  },

  _esc: function(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

/* ── PatchManager ────────────────────────────────────────────────────────── */

var PatchManager = {
  _patches: [],
  _observer: null,
  _debounce: null,

  run: function(patches) {
    this._patches = patches || [];
    this._applyAll();
    this._watch();
  },

  _applyAll: function() {
    this._patches.forEach(function(patch) {
      if (!Array.isArray(patch.rules)) return;
      patch.rules.forEach(function(rule) {
        RuleEngine.apply(rule);
      });
    });
  },

  _watch: function() {
    if (this._observer) return;
    var self = this;
    this._observer = new MutationObserver(function() {
      clearTimeout(self._debounce);
      self._debounce = setTimeout(function() { self._applyAll(); }, 200);
    });
    this._observer.observe(document.body, { childList: true, subtree: true });
  }
};
