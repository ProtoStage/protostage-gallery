/**
 * shell.js — Generic mobile application shell.
 *
 * Implements the base screen slots:
 * - Header Slot (title, back button, trailing actions)
 * - Content Slot (scrollable body injected by flow-router)
 * - Footer Slot (tabs or floating CTA)
 */
(function () {
  'use strict';

  var shellEl = null;
  var headerEl = null;
  var contentEl = null;
  var footerEl = null;

  var AppShell = {
    init: function () {
      shellEl = document.getElementById('app-shell');
      if (!shellEl) return;

      headerEl = document.getElementById('header-slot');
      contentEl = document.getElementById('content-slot');
      footerEl = document.getElementById('footer-slot');
    },

    mount: function (options) {
      options = options || {};
      if (!headerEl || !contentEl) this.init();

      // Configure Header
      if (headerEl) {
        var title = options.title || 'App';
        var showBack = !!options.showBack;

        headerEl.innerHTML = `
          <div class="shell-header">
            ${showBack ? '<button class="shell-back-btn" data-back="true">‹</button>' : '<div class="shell-header-spacer"></div>'}
            <h1 class="shell-title">${title}</h1>
            <div class="shell-header-actions">${options.headerAction || ''}</div>
          </div>
        `;
      }

      // Configure Footer / Nav
      if (footerEl) {
        if (options.hideFooter) {
          footerEl.style.display = 'none';
        } else {
          footerEl.style.display = 'block';
          this.renderFooter(options.activeTab || 'home');
        }
      }
    },

    setContent: function (htmlOrElement) {
      if (!contentEl) this.init();
      if (!contentEl) return;

      if (typeof htmlOrElement === 'string') {
        contentEl.innerHTML = htmlOrElement;
      } else if (htmlOrElement instanceof HTMLElement) {
        contentEl.innerHTML = '';
        contentEl.appendChild(htmlOrElement);
      }
    },

    renderFooter: function (activeTab) {
      if (!footerEl) return;
      footerEl.innerHTML = `
        <nav class="shell-bottom-nav">
          <button class="shell-nav-item ${activeTab === 'home' ? 'active' : ''}" data-goto="home">
            <span class="shell-nav-icon">🏠</span>
            <span class="shell-nav-label">Home</span>
          </button>
          <button class="shell-nav-item ${activeTab === 'explore' ? 'active' : ''}" data-goto="explore">
            <span class="shell-nav-icon">🔍</span>
            <span class="shell-nav-label">Explore</span>
          </button>
          <button class="shell-nav-item ${activeTab === 'activity' ? 'active' : ''}" data-goto="activity">
            <span class="shell-nav-icon">⚡</span>
            <span class="shell-nav-label">Activity</span>
          </button>
          <button class="shell-nav-item ${activeTab === 'profile' ? 'active' : ''}" data-goto="profile">
            <span class="shell-nav-icon">👤</span>
            <span class="shell-nav-label">Profile</span>
          </button>
        </nav>
      `;
    }
  };

  window.AppShell = AppShell;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { AppShell.init(); });
  } else {
    AppShell.init();
  }
})();
