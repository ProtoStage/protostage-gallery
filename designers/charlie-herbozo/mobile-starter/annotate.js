/**
 * annotate.js — In-prototype click-to-comment review & feedback layer.
 *
 * Modes (set via data-comments on the <script> tag or .proto.json):
 *   "local"   — localStorage + .annotations.json on local dev server (default)
 *   "issues"  — GitHub Issues integration for published prototypes
 *   "off"     — Comment FAB hidden entirely
 *
 * Local mode:  Pin-drop → localStorage → POST /api/comments on dev server
 * Issues mode: Pin-drop → localStorage for display → "Submit" opens a
 *              pre-filled GitHub Issue. On load, fetches existing issues
 *              from the GitHub API and renders them as pins.
 *
 * Config attributes on the <script> tag:
 *   data-proto      — Prototype identifier (slug or author/slug)
 *   data-comments   — "local" | "issues" | "off"
 *   data-repo       — GitHub repo for Issues mode (e.g. "Charlie-HV97/protostage")
 *   data-labels     — Comma-separated GitHub Issue labels (default: "comment,prototype-feedback")
 */
(function () {
  'use strict';

  if (window.__stageAnnotateLoaded) return;
  window.__stageAnnotateLoaded = true;

  var script = document.currentScript;
  var PROTO = (script && script.dataset.proto) || window.location.pathname.replace(/\/$/, '').split('/').pop() || 'prototype';
  var COMMENTS_MODE = (script && script.dataset.comments) || 'local';
  var GITHUB_REPO = (script && script.dataset.repo) || '';
  var GITHUB_LABELS = (script && script.dataset.labels) || 'comment,prototype-feedback';
  var STORAGE_KEY = 'proto-annotations:' + PROTO;
  var AUTHOR_KEY = 'proto-reviewer-name';

  // --- Early exit if comments are off ---
  if (COMMENTS_MODE === 'off') return;

  // --- Embedded detection: never show comments inside an iframe ---
  if (window.parent && window.parent !== window) {
    try {
      // If we can't access parent origin, we're cross-origin embedded
      void window.parent.location.href;
    } catch (e) {
      return; // Cross-origin iframe — don't show comment UI
    }
    // Same-origin iframe (e.g. embed.html preview) — still skip
    if (document.body.classList.contains('proto-embed-body')) return;
  }

  var localComments = loadLocalComments();
  var githubComments = [];
  var isAnnotateMode = false;
  var pendingComments = []; // Comments awaiting GitHub Issue submission

  // =========================================================================
  // LocalStorage persistence (works in all modes as a cache)
  // =========================================================================
  function loadLocalComments() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalComments(comments) {
    localComments = comments;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
    } catch (e) {}
    renderPins();
  }

  function getAuthor() {
    var author = localStorage.getItem(AUTHOR_KEY);
    if (!author) {
      author = prompt('Please enter your name for review comments:', '') || 'Anonymous';
      localStorage.setItem(AUTHOR_KEY, author);
    }
    return author;
  }

  // =========================================================================
  // All displayable comments (local + GitHub, deduplicated by id)
  // =========================================================================
  function allComments() {
    if (COMMENTS_MODE === 'local') return localComments;

    var merged = [];
    var seen = {};

    // GitHub comments take priority (they're the "source of truth" once submitted)
    githubComments.forEach(function (c) {
      merged.push(c);
      if (c.id) seen[c.id] = true;
    });

    // Add local-only comments (not yet submitted to GitHub)
    localComments.forEach(function (c) {
      if (!seen[c.id]) {
        merged.push(c);
      }
    });

    return merged;
  }

  // =========================================================================
  // Local dev server sync (POST /api/comments)
  // =========================================================================
  function syncToLocalServer(comment, eventType) {
    var payload = {
      prototype: PROTO,
      event: eventType || 'created',
      comment: comment
    };

    fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function () {
      // Server not available — that's fine, localStorage has it
    });
  }

  // =========================================================================
  // GitHub Issues: READ (fetch existing comments from public repo)
  // =========================================================================
  function fetchGitHubComments() {
    if (COMMENTS_MODE !== 'issues' || !GITHUB_REPO) return;

    var labels = GITHUB_LABELS + ',' + PROTO;
    var apiUrl = 'https://api.github.com/repos/' + GITHUB_REPO +
                 '/issues?labels=' + encodeURIComponent(labels) +
                 '&state=open&per_page=50&sort=created&direction=desc';

    fetch(apiUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    })
    .then(function (res) {
      if (!res.ok) return [];
      return res.json();
    })
    .then(function (issues) {
      githubComments = [];
      (issues || []).forEach(function (issue) {
        var parsed = parseIssueBody(issue);
        if (parsed) {
          githubComments.push(parsed);
        }
      });
      renderPins();
    })
    .catch(function () {
      // API unavailable or rate-limited — display local comments only
    });
  }

  /**
   * Parse a GitHub Issue body back into a comment object.
   * The issue body format (created by our pre-fill URL) is:
   *
   *   **Prototype:** `slug`
   *   **Screen:** `step-id`
   *   **Pin:** `(x%, y%)`
   *   **Author:** `name`
   *
   *   ---
   *
   *   Comment text here...
   *
   *   ---
   *   _Submitted via ProtoStage annotate_
   */
  function parseIssueBody(issue) {
    var body = issue.body || '';

    var xMatch = body.match(/\*\*Pin:\*\*\s*\(?([\d.]+)%?,?\s*([\d.]+)%?\)?/);
    var stepMatch = body.match(/\*\*Screen:\*\*\s*`?([^`\n]+)`?/);
    var authorMatch = body.match(/\*\*Author:\*\*\s*(.+)/);

    // Extract the actual comment text (between the two --- separators)
    var commentText = '';
    var parts = body.split(/^---$/m);
    if (parts.length >= 2) {
      commentText = parts[1].trim();
    } else {
      // Fallback: use the issue title
      commentText = issue.title.replace(/^\[Comment\]\s*/, '');
    }

    if (!xMatch) return null;

    return {
      id: 'gh_' + issue.number,
      author: authorMatch ? authorMatch[1].trim() : (issue.user ? issue.user.login : 'Unknown'),
      text: commentText,
      x: parseFloat(xMatch[1]),
      y: parseFloat(xMatch[2]),
      stepId: stepMatch ? stepMatch[1].trim() : null,
      createdAt: issue.created_at,
      issueUrl: issue.html_url,
      source: 'github'
    };
  }

  // =========================================================================
  // GitHub Issues: WRITE (open pre-filled new issue URL)
  // =========================================================================
  function openGitHubIssue(comment) {
    if (!GITHUB_REPO) {
      alert('GitHub repository not configured. Set data-repo on the annotate.js script tag.');
      return;
    }

    var title = '[Comment] ' + PROTO + ': ' + comment.text.substring(0, 80);
    var body = [
      '**Prototype:** `' + PROTO + '`',
      '**Screen:** `' + (comment.stepId || 'unknown') + '`',
      '**Pin:** (' + comment.x + '%, ' + comment.y + '%)',
      '**Author:** ' + comment.author,
      '',
      '---',
      '',
      comment.text,
      '',
      '---',
      '_Submitted via ProtoStage annotate_'
    ].join('\n');

    var labels = GITHUB_LABELS + ',' + PROTO;

    var url = 'https://github.com/' + GITHUB_REPO + '/issues/new?' +
      'title=' + encodeURIComponent(title) +
      '&body=' + encodeURIComponent(body) +
      '&labels=' + encodeURIComponent(labels);

    window.open(url, '_blank', 'noopener');
  }

  // =========================================================================
  // Pin rendering
  // =========================================================================
  function renderPins() {
    var screen = document.querySelector('.device-frame__screen') || document.body;
    var existingPins = screen.querySelectorAll('.stage-comment-pin');
    existingPins.forEach(function (p) { p.remove(); });

    var currentStep = null;
    if (window.FlowRouter && typeof window.FlowRouter.getCurrentStep === 'function') {
      var step = window.FlowRouter.getCurrentStep();
      currentStep = step ? step.id : null;
    }

    var comments = allComments();
    comments.forEach(function (c, idx) {
      if (c.stepId && currentStep && c.stepId !== currentStep) {
        return;
      }

      var pin = document.createElement('div');
      pin.className = 'stage-comment-pin';
      if (c.source === 'github') {
        pin.classList.add('stage-comment-pin--github');
      }
      if (c.pending) {
        pin.classList.add('stage-comment-pin--pending');
      }
      pin.textContent = String(idx + 1);
      pin.style.left = c.x + '%';
      pin.style.top = c.y + '%';
      pin.title = c.author + ': ' + c.text;

      pin.addEventListener('click', function (e) {
        e.stopPropagation();
        showCommentDetail(c);
      });

      screen.appendChild(pin);
    });
  }

  // =========================================================================
  // Comment detail popover
  // =========================================================================
  function showCommentDetail(comment) {
    // Remove any existing popover
    var existing = document.querySelector('.stage-comment-popover');
    if (existing) existing.remove();

    var popover = document.createElement('div');
    popover.className = 'stage-comment-popover';

    var sourceTag = '';
    if (comment.source === 'github') {
      sourceTag = ' <a href="' + comment.issueUrl + '" target="_blank" rel="noopener" class="stage-comment-popover__link">View Issue ↗</a>';
    } else if (comment.pending) {
      sourceTag = ' <span class="stage-comment-popover__pending">⏳ Not yet submitted</span>';
    }

    popover.innerHTML =
      '<div class="stage-comment-popover__header">' +
        '<strong>' + escapeHtml(comment.author) + '</strong>' +
        '<span class="stage-comment-popover__time">' + formatTime(comment.createdAt) + '</span>' +
        sourceTag +
      '</div>' +
      '<div class="stage-comment-popover__body">' + escapeHtml(comment.text) + '</div>' +
      '<button class="stage-comment-popover__close" type="button">✕</button>';

    document.body.appendChild(popover);

    popover.querySelector('.stage-comment-popover__close').addEventListener('click', function () {
      popover.remove();
    });

    // Auto-dismiss on outside click
    setTimeout(function () {
      document.addEventListener('click', function dismiss(e) {
        if (!popover.contains(e.target)) {
          popover.remove();
          document.removeEventListener('click', dismiss);
        }
      });
    }, 100);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
             d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  // =========================================================================
  // Comment export (JSON download)
  // =========================================================================
  function exportComments() {
    var data = {
      prototype: PROTO,
      exportedAt: new Date().toISOString(),
      comments: allComments()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = PROTO + '-comments.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // UI Initialization
  // =========================================================================
  function initUI() {
    var style = document.createElement('style');
    style.textContent = '\n' +
      '#stage-annotate-root {\n' +
      '  position: fixed;\n' +
      '  bottom: 24px;\n' +
      '  right: 24px;\n' +
      '  z-index: 999;\n' +
      '  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;\n' +
      '}\n' +
      '#stage-annotate-fab {\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  gap: 8px;\n' +
      '  padding: 9px 18px;\n' +
      '  background: #6366f1;\n' +
      '  color: #ffffff;\n' +
      '  border: none;\n' +
      '  border-radius: 999px;\n' +
      '  font-size: 13px;\n' +
      '  font-weight: 600;\n' +
      '  cursor: pointer;\n' +
      '  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);\n' +
      '  transition: all 0.2s ease;\n' +
      '}\n' +
      '#stage-annotate-fab:hover {\n' +
      '  background: #4f46e5;\n' +
      '  transform: translateY(-1px);\n' +
      '}\n' +
      '#stage-annotate-fab.active {\n' +
      '  background: #ef4444;\n' +
      '  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);\n' +
      '}\n' +
      '.stage-annotate-toolbar {\n' +
      '  display: none;\n' +
      '  gap: 6px;\n' +
      '  margin-top: 8px;\n' +
      '  justify-content: flex-end;\n' +
      '}\n' +
      '.stage-annotate-toolbar.visible { display: flex; }\n' +
      '.stage-annotate-toolbar button {\n' +
      '  padding: 6px 12px;\n' +
      '  background: rgba(255,255,255,0.1);\n' +
      '  border: 1px solid rgba(255,255,255,0.15);\n' +
      '  color: #e2e8f0;\n' +
      '  border-radius: 8px;\n' +
      '  font-size: 12px;\n' +
      '  font-weight: 500;\n' +
      '  cursor: pointer;\n' +
      '  font-family: inherit;\n' +
      '  transition: background 0.15s;\n' +
      '}\n' +
      '.stage-annotate-toolbar button:hover { background: rgba(255,255,255,0.18); }\n' +
      '.stage-comment-pin {\n' +
      '  position: absolute;\n' +
      '  width: 24px;\n' +
      '  height: 24px;\n' +
      '  background: #6366f1;\n' +
      '  color: white;\n' +
      '  border: 2px solid white;\n' +
      '  border-radius: 50%;\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  justify-content: center;\n' +
      '  font-size: 11px;\n' +
      '  font-weight: bold;\n' +
      '  transform: translate(-50%, -50%);\n' +
      '  cursor: pointer;\n' +
      '  z-index: 100;\n' +
      '  box-shadow: 0 2px 6px rgba(0,0,0,0.3);\n' +
      '  transition: transform 0.15s ease;\n' +
      '}\n' +
      '.stage-comment-pin:hover { transform: translate(-50%, -50%) scale(1.15); }\n' +
      '.stage-comment-pin--github {\n' +
      '  background: #16a34a;\n' +
      '  border-color: #bbf7d0;\n' +
      '}\n' +
      '.stage-comment-pin--pending {\n' +
      '  background: #f59e0b;\n' +
      '  border-color: #fef3c7;\n' +
      '  animation: stage-pin-pulse 2s infinite;\n' +
      '}\n' +
      '@keyframes stage-pin-pulse {\n' +
      '  0%, 100% { opacity: 1; }\n' +
      '  50% { opacity: 0.6; }\n' +
      '}\n' +
      '.stage-annotate-crosshair {\n' +
      '  cursor: crosshair !important;\n' +
      '}\n' +
      '.stage-comment-popover {\n' +
      '  position: fixed;\n' +
      '  bottom: 80px;\n' +
      '  right: 24px;\n' +
      '  z-index: 1000;\n' +
      '  background: #1e1e2e;\n' +
      '  border: 1px solid rgba(255,255,255,0.12);\n' +
      '  border-radius: 14px;\n' +
      '  padding: 14px 16px;\n' +
      '  max-width: 320px;\n' +
      '  min-width: 220px;\n' +
      '  color: #e2e8f0;\n' +
      '  font-size: 13px;\n' +
      '  box-shadow: 0 12px 30px rgba(0,0,0,0.5);\n' +
      '  animation: stage-popover-in 0.15s ease;\n' +
      '}\n' +
      '@keyframes stage-popover-in { from { opacity: 0; transform: translateY(6px); } }\n' +
      '.stage-comment-popover__header {\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  gap: 8px;\n' +
      '  margin-bottom: 8px;\n' +
      '  flex-wrap: wrap;\n' +
      '}\n' +
      '.stage-comment-popover__time {\n' +
      '  font-size: 11px;\n' +
      '  color: #64748b;\n' +
      '}\n' +
      '.stage-comment-popover__link {\n' +
      '  font-size: 11px;\n' +
      '  color: #818cf8;\n' +
      '  text-decoration: none;\n' +
      '}\n' +
      '.stage-comment-popover__link:hover { text-decoration: underline; }\n' +
      '.stage-comment-popover__pending {\n' +
      '  font-size: 11px;\n' +
      '  color: #f59e0b;\n' +
      '}\n' +
      '.stage-comment-popover__body {\n' +
      '  line-height: 1.5;\n' +
      '  white-space: pre-wrap;\n' +
      '}\n' +
      '.stage-comment-popover__close {\n' +
      '  position: absolute;\n' +
      '  top: 8px;\n' +
      '  right: 10px;\n' +
      '  background: none;\n' +
      '  border: none;\n' +
      '  color: #64748b;\n' +
      '  cursor: pointer;\n' +
      '  font-size: 14px;\n' +
      '}\n' +
      '.stage-comment-popover__close:hover { color: #fff; }\n' +
      '.stage-annotate-count {\n' +
      '  display: inline-flex;\n' +
      '  align-items: center;\n' +
      '  justify-content: center;\n' +
      '  min-width: 18px;\n' +
      '  height: 18px;\n' +
      '  background: rgba(255,255,255,0.2);\n' +
      '  border-radius: 9999px;\n' +
      '  font-size: 11px;\n' +
      '  font-weight: 700;\n' +
      '  padding: 0 5px;\n' +
      '}\n';
    document.head.appendChild(style);

    var container = document.createElement('div');
    container.id = 'stage-annotate-root';
    container.innerHTML =
      '<button id="stage-annotate-fab" type="button">' +
        '<span>💬 Review</span>' +
        '<span class="stage-annotate-count" id="stage-annotate-count">0</span>' +
      '</button>' +
      '<div class="stage-annotate-toolbar" id="stage-annotate-toolbar">' +
        (COMMENTS_MODE === 'issues' ? '<button type="button" id="stage-annotate-submit">Submit to GitHub</button>' : '') +
        '<button type="button" id="stage-annotate-export">Export JSON</button>' +
        '<button type="button" id="stage-annotate-clear">Clear Local</button>' +
      '</div>';
    document.body.appendChild(container);

    var fab = document.getElementById('stage-annotate-fab');
    var toolbar = document.getElementById('stage-annotate-toolbar');
    var countBadge = document.getElementById('stage-annotate-count');
    var screen = document.querySelector('.device-frame__screen') || document.body;

    function updateCount() {
      var c = allComments();
      countBadge.textContent = String(c.length);
      countBadge.style.display = c.length > 0 ? '' : 'none';
    }

    // Override renderPins to also update count
    var _origRenderPins = renderPins;
    renderPins = function () {
      _origRenderPins();
      updateCount();
    };

    fab.addEventListener('click', function () {
      isAnnotateMode = !isAnnotateMode;
      if (isAnnotateMode) {
        fab.classList.add('active');
        fab.querySelector('span:first-child').textContent = '✕ Done';
        screen.classList.add('stage-annotate-crosshair');
        toolbar.classList.add('visible');
      } else {
        fab.classList.remove('active');
        fab.querySelector('span:first-child').textContent = '💬 Review';
        screen.classList.remove('stage-annotate-crosshair');
        toolbar.classList.remove('visible');
      }
    });

    screen.addEventListener('click', function (e) {
      if (!isAnnotateMode) return;
      if (e.target.closest('#stage-annotate-root') || e.target.closest('#stage-cond-root')) return;

      var rect = screen.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;

      var text = prompt('Enter comment for this screen element:');
      if (!text) return;

      var currentStep = null;
      if (window.FlowRouter && typeof window.FlowRouter.getCurrentStep === 'function') {
        var step = window.FlowRouter.getCurrentStep();
        currentStep = step ? step.id : null;
      }

      var comment = {
        id: 'c_' + Date.now(),
        author: getAuthor(),
        text: text,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        stepId: currentStep,
        createdAt: new Date().toISOString()
      };

      if (COMMENTS_MODE === 'issues') {
        comment.pending = true;
        pendingComments.push(comment);
      }

      saveLocalComments(localComments.concat([comment]));

      if (COMMENTS_MODE === 'local') {
        syncToLocalServer(comment, 'created');
      }
    });

    // Submit pending comments to GitHub Issues
    var submitBtn = document.getElementById('stage-annotate-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        if (pendingComments.length === 0) {
          // Check for any local comments not yet on GitHub
          var localOnly = localComments.filter(function (c) { return c.pending; });
          if (localOnly.length === 0) {
            alert('No pending comments to submit.');
            return;
          }
          pendingComments = localOnly;
        }

        // Open GitHub Issues for each pending comment
        pendingComments.forEach(function (c) {
          openGitHubIssue(c);
        });

        // Mark as no longer pending
        var submittedIds = {};
        pendingComments.forEach(function (c) { submittedIds[c.id] = true; });
        localComments = localComments.map(function (c) {
          if (submittedIds[c.id]) {
            var updated = Object.assign({}, c);
            delete updated.pending;
            return updated;
          }
          return c;
        });
        saveLocalComments(localComments);
        pendingComments = [];
      });
    }

    // Export
    var exportBtn = document.getElementById('stage-annotate-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportComments);
    }

    // Clear local
    var clearBtn = document.getElementById('stage-annotate-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!confirm('Clear all local comments for this prototype?')) return;
        saveLocalComments([]);
        pendingComments = [];
      });
    }

    // Listen for screen navigation changes
    window.addEventListener('stage:stepchange', function () {
      renderPins();
    });

    // Initial render
    renderPins();

    // Fetch GitHub comments if in issues mode
    if (COMMENTS_MODE === 'issues') {
      fetchGitHubComments();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    setTimeout(initUI, 50);
  }
})();
