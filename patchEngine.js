/**
 * patchEngine.js
 * The patch engine that actually mutates the DOM on Schoology.
 *
 * This file is bundled into the bookmarklet. It must:
 *   - Be self-contained (no imports, no external deps)
 *   - Work when injected into any page via javascript: protocol
 *   - Handle errors gracefully — never crash the host page
 *   - Be reasonably concise (gets inlined into a URL)
 */

var RuleEngine = {
  /**
   * Apply a single rule to the live DOM.
   * Returns true if at least one element was found and acted on.
   */
  apply: function(rule) {
    try {
      switch (rule.type) {
        case 'hide':        return this._hide(rule);
        case 'css':         return this._css(rule);
        case 'addClass':    return this._addClass(rule);
        case 'removeClass': return this._removeClass(rule);
        default:
          return false;
      }
    } catch(e) {
      return false;
    }
  },

  _hide: function(rule) {
    var els = this._query(rule.selector);
    els.forEach(function(el) { el.style.display = 'none'; });
    return els.length > 0;
  },

  _css: function(rule) {
    if (!rule.styles) return false;
    var els = this._query(rule.selector);
    els.forEach(function(el) { el.style.cssText += rule.styles; });
    return els.length > 0;
  },

  _addClass: function(rule) {
    if (!rule.className) return false;
    var els = this._query(rule.selector);
    els.forEach(function(el) { el.classList.add(rule.className); });
    return els.length > 0;
  },

  _removeClass: function(rule) {
    if (!rule.className) return false;
    var els = this._query(rule.selector);
    els.forEach(function(el) { el.classList.remove(rule.className); });
    return els.length > 0;
  },

  _query: function(selector) {
    if (!selector) return [];
    try {
      return Array.prototype.slice.call(document.querySelectorAll(selector));
    } catch(e) {
      return [];
    }
  }
};

var PatchManager = {
  _patches: [],
  _observer: null,
  _debounce: null,

  /**
   * Entry point. Call with array of patch objects to apply.
   * Applies immediately, then watches for SPA navigation.
   */
  run: function(patches) {
    this._patches = patches || [];
    this._applyAll();
    this._watch();
  },

  _applyAll: function() {
    var self = this;
    this._patches.forEach(function(patch) {
      if (!Array.isArray(patch.rules)) return;
      patch.rules.forEach(function(rule) {
        RuleEngine.apply(rule);
      });
    });
  },

  /**
   * MutationObserver re-applies patches after Schoology dynamically
   * loads new content (SPA routing, lazy widgets, etc.).
   * Debounced to 200ms to avoid hammering on large DOM updates.
   */
  _watch: function() {
    if (this._observer) return; // already watching
    var self = this;
    this._observer = new MutationObserver(function() {
      clearTimeout(self._debounce);
      self._debounce = setTimeout(function() {
        self._applyAll();
      }, 200);
    });
    this._observer.observe(document.body, { childList: true, subtree: true });
  }
};
