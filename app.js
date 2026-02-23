/**
 * app.js
 * UI controller for the Schoology Patch Marketplace web app.
 *
 * Responsibilities:
 *   - Render patch cards from PATCH_CATALOG
 *   - Track which patches the user has toggled on
 *   - Trigger bookmarklet generation and display the result
 *   - Persist toggle state to localStorage so selections survive refresh
 */

// ── State ──────────────────────────────────────────────────────────────────

/** Set of enabled patch IDs. Populated from localStorage on init. */
var enabledIds = new Set(JSON.parse(localStorage.getItem('spm_enabled') || '[]'));

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  renderPatches();
  updateGenerateButton();

  document.getElementById('generate-btn').addEventListener('click', handleGenerate);
});

// ── Rendering ──────────────────────────────────────────────────────────────

function renderPatches() {
  var list = document.getElementById('patch-list');
  list.innerHTML = '';

  PATCH_CATALOG.forEach(function(patch, i) {
    var card = buildCard(patch, i);
    list.appendChild(card);
  });
}

function buildCard(patch, index) {
  var enabled = enabledIds.has(patch.id);

  var card = document.createElement('div');
  card.className = 'patch-card' + (enabled ? ' is-enabled' : '');
  card.style.animationDelay = (index * 60) + 'ms';

  var ruleCount = patch.rules ? patch.rules.length : 0;

  card.innerHTML =
    '<div class="card-inner">' +
      '<div class="card-body">' +
        '<div class="patch-name">' + escHtml(patch.name) + '</div>' +
        '<div class="patch-desc">' + escHtml(patch.description) + '</div>' +
        '<div class="rule-count">' + ruleCount + ' rule' + (ruleCount !== 1 ? 's' : '') + '</div>' +
      '</div>' +
      '<label class="toggle" title="Enable this patch">' +
        '<input type="checkbox" class="toggle-input"' + (enabled ? ' checked' : '') + ' data-id="' + patch.id + '">' +
        '<span class="toggle-track"><span class="toggle-thumb"></span></span>' +
      '</label>' +
    '</div>';

  // Toggle handler
  var checkbox = card.querySelector('.toggle-input');
  checkbox.addEventListener('change', function() {
    if (this.checked) {
      enabledIds.add(patch.id);
      card.classList.add('is-enabled');
    } else {
      enabledIds.delete(patch.id);
      card.classList.remove('is-enabled');
    }
    persistState();
    updateGenerateButton();
    clearOutput(); // reset output when selection changes
  });

  return card;
}

// ── Generate ───────────────────────────────────────────────────────────────

function handleGenerate() {
  var selected = PATCH_CATALOG.filter(function(p) { return enabledIds.has(p.id); });

  if (selected.length === 0) {
    showError('Select at least one patch first.');
    return;
  }

  var btn = document.getElementById('generate-btn');
  btn.textContent = 'Generating…';
  btn.disabled = true;

  BookmarkletGenerator.generate(
    selected,
    function(linkEl) {
      btn.textContent = 'Regenerate Bookmarklet';
      btn.disabled = false;
      showOutput(linkEl, selected.length);
    },
    function(errMsg) {
      btn.textContent = 'Generate Bookmarklet';
      btn.disabled = false;
      showError(errMsg);
    }
  );
}

// ── Output display ─────────────────────────────────────────────────────────

function showOutput(linkEl, count) {
  var area = document.getElementById('output-area');
  area.innerHTML = '';

  var wrapper = document.createElement('div');
  wrapper.className = 'output-wrapper';

  var instructions = document.createElement('p');
  instructions.className = 'output-instructions';
  instructions.innerHTML =
    '<span class="step">1</span> Drag the button below to your <strong>bookmarks bar</strong>.' +
    '<span class="step">2</span> Go to <strong>schoology.com</strong>.' +
    '<span class="step">3</span> Click the bookmark. Patches apply instantly.';

  var dragZone = document.createElement('div');
  dragZone.className = 'drag-zone';
  dragZone.appendChild(linkEl);

  var note = document.createElement('p');
  note.className = 'output-note';
  note.textContent = count + ' patch' + (count !== 1 ? 'es' : '') + ' bundled · Re-generate after changing selections';

  wrapper.appendChild(instructions);
  wrapper.appendChild(dragZone);
  wrapper.appendChild(note);
  area.appendChild(wrapper);
}

function showError(msg) {
  var area = document.getElementById('output-area');
  area.innerHTML = '<p class="error-msg">⚠ ' + escHtml(msg) + '</p>';
}

function clearOutput() {
  document.getElementById('output-area').innerHTML = '';
}

// ── Helpers ────────────────────────────────────────────────────────────────

function updateGenerateButton() {
  var btn = document.getElementById('generate-btn');
  var count = enabledIds.size;
  if (count === 0) {
    btn.textContent = 'Select patches above ↑';
    btn.classList.add('btn-dim');
  } else {
    btn.textContent = 'Generate Bookmarklet (' + count + ' selected)';
    btn.classList.remove('btn-dim');
  }
}

function persistState() {
  localStorage.setItem('spm_enabled', JSON.stringify(Array.from(enabledIds)));
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
