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
    // Wait 500ms for Schoology's JS to finish rendering the sidebar
    setTimeout(function(){ self._refreshData(); }, 500);
    return true;
  },

  _injectStyles: function() {
    if (document.getElementById('spm-styles')) return;
    var s = document.createElement('style');
    s.id = 'spm-styles';
    s.textContent = [
      /* Tab button — sits inline in Schoology's own tab strip */
      '#spm-tab{display:inline-flex;align-items:center;padding:10px 16px;',
      'font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;',
      'color:#888;border-bottom:3px solid transparent;cursor:pointer;user-select:none;',
      'vertical-align:bottom;transition:color .15s,border-color .15s;}',
      '#spm-tab:hover{color:#1c458e;}',
      '#spm-tab.on{color:#1c458e;border-bottom-color:#1c458e;}',

      /* Panel */
      '#spm-panel{display:none;padding:18px 0;animation:spmIn .2s ease;}',
      '#spm-panel.on{display:block;}',
      '@keyframes spmIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}',

      /* Section headers */
      '.spm-h{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;',
      'color:#999;padding:0 0 7px;border-bottom:1px solid #e5e5e5;margin:0 0 10px;}',
      '.spm-h+.spm-h,.spm-spacer{margin-top:22px;}',

      /* Item rows */
      '.spm-row{display:flex;align-items:flex-start;gap:10px;',
      'padding:10px 12px;margin-bottom:6px;border-radius:6px;',
      'border-left:3px solid #ddd;background:#f8f8f8;}',
      '.spm-row.ov{border-left-color:#e53935;background:#fff8f8;}',
      '.spm-row.up{border-left-color:#1c458e;background:#f5f8ff;}',
      '.spm-row.ev{border-left-color:#f5a623;background:#fffbf2;}',

      /* Dot */
      '.spm-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;}',
      '.spm-row.ov .spm-dot{background:#e53935;}',
      '.spm-row.up .spm-dot{background:#1c458e;}',
      '.spm-row.ev .spm-dot{background:#f5a623;}',

      /* Text */
      '.spm-title{font-size:13px;font-weight:600;color:#222;line-height:1.4;}',
      '.spm-title a{color:inherit;text-decoration:none;}',
      '.spm-title a:hover{text-decoration:underline;}',
      '.spm-meta{font-size:11px;color:#888;margin-top:2px;line-height:1.4;}',

      /* Badge */
      '.spm-badge{display:inline-block;font-size:9px;font-weight:700;',
      'background:#1c458e;color:#fff;border-radius:8px;padding:1px 5px;margin-left:5px;vertical-align:middle;}',

      /* Empty state */
      '.spm-empty{font-size:13px;color:#aaa;text-align:center;padding:40px 0;}',
    ].join('');
    document.head.appendChild(s);
  },

  _buildUI: function() {
    if (document.getElementById('spm-tab')) return;

    /* -- Tab button -- */
    var btn = document.createElement('span');
    btn.id = 'spm-tab';
    btn.textContent = 'Agenda';
    var self = this;
    btn.addEventListener('click', function(){ self._toggle(); });

    /*
     * Find Schoology's tab strip.
     * The "Recent Activity / Course Dashboard" tabs live inside
     * .s-tabbed-navigation which is inside #center-top.
     * We try progressively broader selectors.
     */
    var strip = _one('.s-tabbed-navigation')
             || _one('#center-top ul')
             || _one('#center-top');

    if (strip) {
      strip.appendChild(btn);
    } else {
      // Absolute fallback: float above the feed
      var anchor = _one('#content-wrapper') || _one('#main-inner');
      if (anchor) anchor.insertAdjacentElement('afterbegin', btn);
    }

    /* -- Panel -- */
    var panel = document.createElement('div');
    panel.id = 'spm-panel';

    // Insert panel as sibling after the feed div
    var feedDiv = _one('.feed') || _one('#main-inner');
    if (feedDiv) {
      feedDiv.parentNode.insertBefore(panel, feedDiv.nextSibling);
    } else {
      var cw = _one('#content-wrapper') || _one('#center-wrapper');
      if (cw) cw.appendChild(panel);
    }
  },

  _toggle: function() {
    var btn    = document.getElementById('spm-tab');
    var panel  = document.getElementById('spm-panel');
    var feed   = _one('.feed');
    var isOn   = panel && panel.classList.contains('on');

    if (isOn) {
      panel.classList.remove('on');
      btn.classList.remove('on');
      if (feed) feed.style.display = '';
    } else {
      panel.classList.add('on');
      btn.classList.add('on');
      if (feed) feed.style.display = 'none';
      this._refreshData();
    }
  },

  _refreshData: function() {
    var panel = document.getElementById('spm-panel');
    if (!panel || !panel.classList.contains('on')) return;
    var overdue  = this._scrapeOverdue();
    var upcoming = this._scrapeUpcoming();
    var events   = this._scrapeEvents();
    this._render(panel, overdue, upcoming, events);
  },

  /* ── SCRAPE OVERDUE ─────────────────────────────────────────────
   * Confirmed: overdue items are div.upcoming-event.upcoming-event-block
   * that appear BEFORE the h4.submissions-title "UPCOMING" header.
   * The assignment link is at: span.event-title > a
   * The course is in the aria-label of the parent span.infotip:
   *   aria-label="COURSE : section School"
   * Days overdue text is in the sibling span inside span.event-title.
   */
  _scrapeOverdue: function() {
    var items = [];
    var seen  = {};

    // Find where UPCOMING starts so we don't bleed into it
    var upcomingHeader = _one('h4.submissions-title');
    
    _query('.upcoming-list .upcoming-event').forEach(function(block) {
      // Skip if this block comes after the UPCOMING header
      if (upcomingHeader && upcomingHeader.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) {
        // block is AFTER upcomingHeader — skip (it's upcoming, not overdue)
        // Note: compareDocumentPosition returns FOLLOWING if block follows header
        // We want to skip blocks that appear AFTER the header
        return;
      }
      // Actually flip the logic: upcomingHeader PRECEDES block means block is upcoming
      if (upcomingHeader &&
          (upcomingHeader.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_PRECEDING) === 0 &&
          upcomingHeader !== block) {
        // header does NOT precede block, meaning block is before header = overdue ✓
      }

      var link = block.querySelector('span.event-title > a');
      if (!link) return;
      var title = link.textContent.trim();
      if (!title || seen[title]) return;
      seen[title] = true;

      // Course from aria-label: "COURSE : section School"
      var tooltip = block.querySelector('span.infotip[aria-label]');
      var course  = '';
      if (tooltip) {
        var lbl = tooltip.getAttribute('aria-label') || '';
        course  = lbl.split(':')[0].trim();
      }

      // Days overdue — the span sibling next to the <a> inside event-title
      var eventTitleSpan = block.querySelector('span.event-title');
      var daysSpan = eventTitleSpan ? eventTitleSpan.querySelector('span') : null;
      var days = daysSpan ? daysSpan.textContent.trim() : '';

      var meta = [course, days].filter(Boolean).join(' · ');
      items.push({ title: title, href: link.getAttribute('href'), meta: meta, cls: 'ov' });
    });

    return items;
  },

  /* ── SCRAPE UPCOMING ────────────────────────────────────────────
   * Same div.upcoming-event structure but they appear after
   * h4.submissions-title "UPCOMING".
   * date-header divs have id="upcoming_submissions" between groups.
   */
  _scrapeUpcoming: function() {
    var items = [];
    var seen  = {};

    var upcomingHeader = _one('h4.submissions-title');
    if (!upcomingHeader) return items;

    // Get the upcoming-list that contains the header
    var upcomingList = upcomingHeader.closest('.upcoming-list')
                    || upcomingHeader.parentNode;

    // Walk all upcoming-event blocks inside the upcoming section
    // Since overdue and upcoming share the same .upcoming-list, we need
    // to only grab blocks that appear AFTER the h4
    var allBlocks = _query('.upcoming-list .upcoming-event');
    var passedHeader = false;

    allBlocks.forEach(function(block) {
      if (!passedHeader) {
        // Check if we've passed the UPCOMING header in DOM order
        // by seeing if the header precedes this block
        if (upcomingHeader.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) {
          passedHeader = true;
        } else {
          return; // still before UPCOMING header
        }
      }

      var link = block.querySelector('span.event-title > a');
      if (!link) return;
      var title = link.textContent.trim();
      if (!title || seen[title]) return;
      seen[title] = true;

      var tooltip = block.querySelector('span.infotip[aria-label]');
      var course  = '';
      if (tooltip) {
        var lbl = tooltip.getAttribute('aria-label') || '';
        course  = lbl.split(':')[0].trim();
      }

      // Due date: look for a date-header preceding this block
      // The date-header div with id="upcoming_submissions" holds the date text
      // Walk backwards to find the most recent date header
      var dateText = '';
      var prev = block.previousElementSibling;
      while (prev) {
        if (prev.id === 'upcoming_submissions' || prev.classList.contains('date-header')) {
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

  /* ── SCRAPE FEED EVENTS ─────────────────────────────────────────
   * Walk feed posts, detect event-like keywords in body text.
   */
  _scrapeEvents: function() {
    var events  = [];
    var pattern = /\b(\d{1,2}[\/\-]\d{1,2}|\d{1,2}:\d{2}\s*[ap]m|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|meeting|event|bingo|game|practice|concert|club|deadline|test|quiz|exam|room\s*\d|auditorium|cafeteria|gym|library)\b/i;

    _query('li[id^="edge-assoc-"]').forEach(function(li) {
      var bodyEl = li.querySelector('.update-body.s-rte');
      if (!bodyEl) return;
      var text = (bodyEl.innerText || bodyEl.textContent || '').replace(/\s+/g,' ').trim();
      if (!text || text.length < 10 || !pattern.test(text)) return;

      var nameEl = li.querySelector('.long-username, .edge-sentence a');
      var name   = nameEl ? nameEl.textContent.trim() : 'Feed';
      var title  = text.length > 140 ? text.substring(0,137)+'…' : text;

      events.push({ title: title, href: null, meta: 'From: '+name, cls: 'ev' });
    });

    return events;
  },

  /* ── RENDER ─────────────────────────────────────────────────────── */
  _render: function(panel, overdue, upcoming, events) {
    var html = '';
    var gap  = false;

    if (overdue.length) {
      html += '<div class="spm-h">Overdue <span class="spm-badge">'+overdue.length+'</span></div>';
      overdue.slice(0,10).forEach(function(i){ html += AgendaPanel._row(i); });
      if (overdue.length > 10)
        html += '<div class="spm-meta" style="text-align:center;padding:4px 0;color:#aaa;font-size:11px;">+'+(overdue.length-10)+' more in the To Do panel</div>';
      gap = true;
    }

    if (upcoming.length) {
      html += '<div class="spm-h'+(gap?' spm-spacer':'')+'">Upcoming <span class="spm-badge">'+upcoming.length+'</span></div>';
      upcoming.slice(0,12).forEach(function(i){ html += AgendaPanel._row(i); });
      gap = true;
    }

    if (events.length) {
      html += '<div class="spm-h'+(gap?' spm-spacer':'')+'">Events in Feed <span class="spm-badge">'+events.length+'</span></div>';
      events.forEach(function(i){ html += AgendaPanel._row(i); });
    }

    if (!html) {
      html = '<div class="spm-empty">Nothing found yet.<br><small>Make sure the feed and To Do sidebar are loaded, then click Agenda again.</small></div>';
    }

    panel.innerHTML = html;
  },

  _row: function(item) {
    var titleInner = item.href
      ? '<a href="'+_esc(item.href)+'">'+_esc(item.title)+'</a>'
      : _esc(item.title);
    return '<div class="spm-row '+item.cls+'">'
         + '<div class="spm-dot"></div>'
         + '<div>'
         + '<div class="spm-title">'+titleInner+'</div>'
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
