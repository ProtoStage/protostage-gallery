/**
 * embed-frame.js — Universal embed loader for ProtoStage prototypes.
 *
 * Scans host pages for [data-protostage] elements and mounts a fluid,
 * responsive iframe with lazy loading, device frame scaling, and message dispatch.
 *
 * Usage:
 *   <div data-protostage="https://your-gallery-host/designers/name/slug/embed.html"
 *        data-theme="dark"
 *        style="width: 100%; max-width: 430px; height: 920px;"></div>
 *   <script src="https://your-gallery-host/embed/embed-frame.js" async></script>
 */
(function() {
  'use strict';

  function mountProtoStageEmbeds() {
    const targets = document.querySelectorAll('[data-protostage]:not([data-proto-mounted])');

    targets.forEach((container) => {
      container.setAttribute('data-proto-mounted', 'true');

      let embedUrl = container.getAttribute('data-protostage');
      if (!embedUrl) return;

      const theme = container.getAttribute('data-theme');
      if (theme) {
        const urlObj = new URL(embedUrl, window.location.href);
        urlObj.searchParams.set('theme', theme);
        embedUrl = urlObj.toString();
      }

      // Container styling default
      if (!container.style.position) {
        container.style.position = 'relative';
      }
      if (!container.style.display || container.style.display === 'inline') {
        container.style.display = 'block';
      }

      const iframe = document.createElement('iframe');
      iframe.src = embedUrl;
      iframe.title = container.getAttribute('data-title') || 'ProtoStage Live Prototype';
      iframe.loading = 'lazy';
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute('allow', 'clipboard-write');

      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.minHeight = container.style.height || '880px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '24px';
      iframe.style.overflow = 'hidden';
      iframe.style.display = 'block';
      iframe.style.backgroundColor = 'transparent';

      container.appendChild(iframe);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountProtoStageEmbeds);
  } else {
    mountProtoStageEmbeds();
  }

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'protostage:ready') {
      // Prototype loaded successfully inside iframe
    }
  });
})();
