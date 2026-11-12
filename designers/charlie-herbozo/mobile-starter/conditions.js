/**
 * conditions.js — Floating scenario / condition switcher for reviewers.
 *
 * Hooks into FlowRouter.getConditions() and displays a non-intrusive HUD
 * allowing reviewers to simulate error states, network drops, and edge cases.
 */
(function () {
  'use strict';

  if (window.__stageConditionsLoaded) return;
  window.__stageConditionsLoaded = true;

  function initPanel() {
    if (!window.FlowRouter || typeof window.FlowRouter.getConditions !== 'function') {
      return;
    }

    var conditions = window.FlowRouter.getConditions();
    var keys = Object.keys(conditions);
    if (keys.length === 0) return;

    var style = document.createElement('style');
    style.textContent = `
      #stage-cond-root {
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 999;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
      }
      #stage-cond-fab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: rgba(24, 26, 32, 0.85);
        color: #e6e8ec;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        cursor: pointer;
        backdrop-filter: blur(12px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
      }
      #stage-cond-fab:hover {
        background: rgba(35, 38, 47, 0.95);
        border-color: rgba(255, 255, 255, 0.25);
      }
      #stage-cond-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #8b92a2;
        transition: background 0.2s ease;
      }
      #stage-cond-root.active #stage-cond-dot {
        background: #f59e0b;
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
      }
      #stage-cond-menu {
        display: none;
        position: absolute;
        bottom: 46px;
        left: 0;
        width: 280px;
        background: #181a20;
        border: 1px solid #282c37;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      }
      #stage-cond-root.open #stage-cond-menu {
        display: block;
      }
      .stage-cond-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #8b92a2;
        margin-bottom: 8px;
        font-weight: 600;
      }
      .stage-cond-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        cursor: pointer;
        color: #e6e8ec;
      }
      .stage-cond-item:hover {
        color: #ffffff;
      }
      .stage-cond-switch {
        position: relative;
        display: inline-block;
        width: 32px;
        height: 18px;
      }
      .stage-cond-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .stage-cond-slider {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: #2e323e;
        transition: .2s;
        border-radius: 18px;
      }
      .stage-cond-slider:before {
        position: absolute;
        content: "";
        height: 12px;
        width: 12px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .2s;
        border-radius: 50%;
      }
      input:checked + .stage-cond-slider {
        background-color: #6366f1;
      }
      input:checked + .stage-cond-slider:before {
        transform: translateX(14px);
      }
    `;
    document.head.appendChild(style);

    var container = document.createElement('div');
    container.id = 'stage-cond-root';
    container.innerHTML = `
      <div id="stage-cond-menu">
        <div class="stage-cond-title">Flow Scenarios & Conditions</div>
        <div id="stage-cond-list"></div>
      </div>
      <button id="stage-cond-fab" type="button">
        <span id="stage-cond-dot"></span>
        <span id="stage-cond-label">Scenarios (${keys.length})</span>
      </button>
    `;
    document.body.appendChild(container);

    var list = document.getElementById('stage-cond-list');
    keys.forEach(function (key) {
      var item = conditions[key];
      var row = document.createElement('label');
      row.className = 'stage-cond-item';
      row.innerHTML = `
        <span>${item.label || key}</span>
        <span class="stage-cond-switch">
          <input type="checkbox" data-cond-key="${key}">
          <span class="stage-cond-slider"></span>
        </span>
      `;
      var checkbox = row.querySelector('input');
      checkbox.addEventListener('change', function () {
        window.FlowRouter.toggleCondition(key, checkbox.checked);
        updateState();
      });
      list.appendChild(row);
    });

    var fab = document.getElementById('stage-cond-fab');
    fab.addEventListener('click', function (e) {
      e.stopPropagation();
      container.classList.toggle('open');
    });

    document.addEventListener('click', function (e) {
      if (!container.contains(e.target)) {
        container.classList.remove('open');
      }
    });

    function updateState() {
      var active = window.FlowRouter.getActiveConditions();
      var count = Object.values(active).filter(Boolean).length;
      if (count > 0) {
        container.classList.add('active');
        document.getElementById('stage-cond-label').textContent = 'Scenarios (' + count + ' on)';
      } else {
        container.classList.remove('active');
        document.getElementById('stage-cond-label').textContent = 'Scenarios (' + keys.length + ')';
      }
    }

    window.addEventListener('stage:conditionchange', updateState);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPanel);
  } else {
    setTimeout(initPanel, 50);
  }
})();
