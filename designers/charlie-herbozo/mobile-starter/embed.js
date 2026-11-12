/**
 * embed.js — Runtime engine for embedded ProtoStage prototypes.
 *
 * Handles:
 * - Fluid auto-scaling of 418x872 device frame to container/iframe bounds
 * - Attribution hydration (ProtoStage GitHub + Designer Portfolio)
 * - Flow restart & fullscreen triggers
 * - Query param configurations (?theme, ?author, ?portfolio, ?scale)
 */
(function() {
  'use strict';

  const FRAME_WIDTH = 418;
  const FRAME_HEIGHT = 872;

  function initEmbed() {
    const params = new URLSearchParams(window.location.search);

    // 1. Theme configuration
    const theme = params.get('theme');
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }

    // 2. Attribution override from query params if specified
    const authorParam = params.get('author');
    const portfolioParam = params.get('portfolio');
    const repoParam = params.get('repo');

    const authorLink = document.getElementById('proto-embed-author');
    if (authorLink) {
      if (authorParam) {
        authorLink.textContent = authorParam;
      }
      if (portfolioParam) {
        authorLink.href = portfolioParam;
      }
    }

    const brandLink = document.getElementById('proto-embed-brand');
    if (brandLink && repoParam) {
      brandLink.href = repoParam;
    }

    // 3. Responsive scaling setup
    const viewport = document.querySelector('.proto-embed-viewport') || document.querySelector('.stage-center');
    const frame = document.querySelector('.device-frame');

    function applyScale() {
      if (!frame || !viewport) return;

      const disableScale = params.get('scale') === 'none';
      if (disableScale) {
        frame.style.transform = '';
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const availW = Math.max(100, rect.width - 16);
      const availH = Math.max(100, rect.height - 16);

      const scaleW = availW / FRAME_WIDTH;
      const scaleH = availH / FRAME_HEIGHT;
      const scale = Math.min(1, Math.min(scaleW, scaleH));

      // Guard against degenerate zero bounds during initial mount
      if (scale > 0.05 && scale <= 1.0) {
        frame.style.transform = `scale(${scale.toFixed(4)})`;
      } else if (scale > 1.0) {
        frame.style.transform = 'scale(1)';
      }
    }

    window.addEventListener('resize', applyScale, { passive: true });
    window.addEventListener('orientationchange', applyScale, { passive: true });

    if (window.ResizeObserver && viewport) {
      const observer = new ResizeObserver(() => applyScale());
      observer.observe(viewport);
    }

    // Initial scale pass
    setTimeout(applyScale, 10);
    setTimeout(applyScale, 150);

    // 4. Flow restart handler
    const restartBtn = document.getElementById('proto-embed-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        restartFlow();
      });
    }

    // 5. Parent iframe notification (handshake)
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({
          type: 'protostage:ready',
          slug: document.body.dataset.proto || window.location.pathname
        }, '*');
      } catch (_) {}
    }
  }

  function restartFlow() {
    // Check if flow-router is active and reset to first screen
    if (window.FlowRouter && typeof window.FlowRouter.goTo === 'function') {
      window.FlowRouter.goTo(0);
      return;
    }
    if (window.ProtoFlow && typeof window.ProtoFlow.goTo === 'function') {
      window.ProtoFlow.goTo(0);
      return;
    }

    // Fallback: look for data-goto or back buttons, or re-render initial screen
    const firstScreenBtn = document.querySelector('[data-goto="1"], [data-goto="step-1"], [data-screen="1"]');
    if (firstScreenBtn) {
      firstScreenBtn.click();
      return;
    }

    // Clean page reload if no in-memory router state
    window.location.reload();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmbed);
  } else {
    initEmbed();
  }
})();
