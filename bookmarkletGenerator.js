/**
 * bookmarkletGenerator.js
 * Bundles the patch engine + selected patches into a single javascript: URL.
 *
 * Strategy:
 *   1. Fetch the patchEngine.js source text (via fetch, since we're on
 *      the same origin as the web app).
 *   2. Serialize the selected patches to a JSON literal.
 *   3. Concatenate: engineSource + patchData + PatchManager.run(patches)
 *   4. Wrap in an IIFE and encode as a javascript: URL.
 *   5. Output an <a> the user can drag to their bookmarks bar.
 *
 * No external minifier is used. We do a minimal whitespace strip that's
 * safe for the code we control.
 */

var BookmarkletGenerator = {

  /**
   * Main entry point.
   * @param {Array}  selectedPatches  - array of patch objects to bundle
   * @param {Function} onSuccess      - called with the generated <a> element
   * @param {Function} onError        - called with an error message string
   */
  generate: function(selectedPatches, onSuccess, onError) {
    if (!selectedPatches || selectedPatches.length === 0) {
      onError('Select at least one patch before generating.');
      return;
    }

    // Fetch the engine source from our own server (same origin, always works)
    fetch('patchEngine.js')
      .then(function(res) {
        if (!res.ok) throw new Error('Could not load patchEngine.js');
        return res.text();
      })
      .then(function(engineSource) {
        var bookmarkletHref = BookmarkletGenerator._build(engineSource, selectedPatches);
        var linkEl = BookmarkletGenerator._makeLink(bookmarkletHref, selectedPatches.length);
        onSuccess(linkEl);
      })
      .catch(function(err) {
        onError('Failed to generate bookmarklet: ' + err.message);
      });
  },

  /**
   * Assemble the full bookmarklet javascript: string.
   */
  _build: function(engineSource, patches) {
    // Light strip: remove single-line comments and collapse whitespace.
    // Safe because we wrote the engine and know it has no regex with // in it.
    var stripped = this._strip(engineSource);

    // Serialize patches as a compact JSON literal
    var patchesJson = JSON.stringify(patches);

    // Build the IIFE body:
    //   1. Guard: only run on schoology.com
    //   2. Prevent double-injection by checking a sentinel flag
    //   3. Inject engine + data + runner
    var body = [
      "if(location.hostname.indexOf('schoology.com')===-1){alert('This bookmarklet only works on schoology.com');return;}",
      "if(window.__scPatched){console.log('[Patch] Already applied.');return;}",
      "window.__scPatched=true;",
      stripped,
      "var __patches=" + patchesJson + ";",
      "PatchManager.run(__patches);"
    ].join('');

    // Wrap in IIFE and prefix with javascript: protocol
    return 'javascript:(function(){' + encodeURIComponent(body) + '})();';
  },

  /**
   * Minimal safe strip: removes // line comments and squashes whitespace.
   * Does NOT attempt to strip block comments or be a real minifier.
   */
  _strip: function(src) {
    return src
      .split('\n')
      .map(function(line) {
        // Remove lines that are only comments or blank
        var trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed === '') return '';
        // Strip trailing inline comments (naive but safe for our code)
        var commentIdx = trimmed.indexOf(' //');
        if (commentIdx > 0) trimmed = trimmed.substring(0, commentIdx);
        return trimmed;
      })
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  },

  /**
   * Create a styled <a> element the user drags to their bookmarks bar.
   */
  _makeLink: function(href, patchCount) {
    var a = document.createElement('a');
    a.href = href;
    a.textContent = '🩹 Schoology Patch (' + patchCount + ')';
    a.className = 'bookmarklet-link';
    a.title = 'Drag this to your bookmarks bar';
    // Prevent clicking the link on the generator page from navigating
    a.addEventListener('click', function(e) {
      e.preventDefault();
      alert('Drag this link to your bookmarks bar — don\'t click it here.');
    });
    return a;
  }
};
