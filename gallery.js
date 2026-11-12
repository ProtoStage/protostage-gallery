/**
 * gallery.js — ProtoStage Showcase Hub Interactive Controller
 */
(function() {
  'use strict';

  let prototypes = [];
  let currentModalProto = null;
  let activeTab = 'iframe'; // 'iframe' | 'script' | 'link'

  const grid = document.getElementById('gallery-grid');
  const searchInput = document.getElementById('search-input');
  const modal = document.getElementById('embed-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-proto-title');
  const codeBox = document.getElementById('embed-code-box');
  const copyBtn = document.getElementById('copy-embed-btn');
  const tabIframe = document.getElementById('tab-iframe');
  const tabScript = document.getElementById('tab-script');
  const tabLink = document.getElementById('tab-link');

  async function loadPrototypes() {
    try {
      const res = await fetch('./showcase.json');
      if (res.ok) {
        prototypes = await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch showcase.json dynamically, using fallback', e);
    }

    if (!prototypes || prototypes.length === 0) {
      prototypes = [
        {
          slug: 'mobile-starter',
          title: 'Mobile Starter Flow',
          description: '4-screen checkout and payment flow with scenario conditions and review annotations.',
          author: 'Charlie Herbozo-Vidal',
          authorSlug: 'charlie-herbozo',
          portfolio: 'https://charlie-hv97.github.io',
          tags: ['Mobile', 'iOS', 'Commerce', 'Checkout'],
          path: 'designers/charlie-herbozo/mobile-starter',
          publishedAt: '2026-11-09'
        }
      ];
    }

    renderGrid(prototypes);
  }

  function renderGrid(items) {
    if (!grid) return;
    grid.innerHTML = '';

    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">No prototypes found matching your search.</div>';
      return;
    }

    items.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'proto-card';

      const protoUrl = `./${p.path}/index.html`;
      const embedUrl = `./${p.path}/embed.html`;

      const tagsHtml = (p.tags || []).map(t => `<span class="proto-card__tag">${t}</span>`).join('');

      card.innerHTML = `
        <div class="proto-card__preview">
          <div class="proto-card__frame-mockup">
            <div class="mockup-screen">
              <div class="mockup-skeleton-header"></div>
              <div class="mockup-skeleton-card"></div>
              <div class="mockup-skeleton-card" style="height: 36px; opacity: 0.6;"></div>
              <div class="mockup-skeleton-btn"></div>
            </div>
          </div>
        </div>
        <div class="proto-card__body">
          <div class="proto-card__tags">${tagsHtml}</div>
          <h3 class="proto-card__title">${escapeHtml(p.title)}</h3>
          <div class="proto-card__author">
            by <a href="${p.portfolio || '#'}" target="_blank" rel="noopener">${escapeHtml(p.author)}</a>
          </div>
          <p class="proto-card__desc">${escapeHtml(p.description)}</p>
          <div class="proto-card__actions">
            <a href="${protoUrl}" target="_blank" rel="noopener" class="btn btn-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Explore
            </a>
            <button type="button" class="btn btn-secondary get-embed-btn" data-slug="${p.slug}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>
              Get Embed Code
            </button>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });

    document.querySelectorAll('.get-embed-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const slug = btn.getAttribute('data-slug');
        const proto = prototypes.find(item => item.slug === slug);
        if (proto) {
          openEmbedModal(proto);
        }
      });
    });
  }

  function openEmbedModal(proto) {
    currentModalProto = proto;
    modalTitle.textContent = `Embed: ${proto.title}`;
    updateSnippet();
    modal.classList.add('active');
  }

  function closeModal() {
    modal.classList.remove('active');
    currentModalProto = null;
  }

  function getAbsoluteEmbedUrl(p) {
    const loc = window.location;
    const base = loc.protocol + '//' + loc.host + loc.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    return `${base}/${p.path}/embed.html`;
  }

  function updateSnippet() {
    if (!currentModalProto) return;
    const url = getAbsoluteEmbedUrl(currentModalProto);

    if (activeTab === 'iframe') {
      codeBox.textContent = `<iframe
  src="${url}"
  width="430"
  height="920"
  style="border:none; border-radius:24px; overflow:hidden;"
  allowfullscreen
  loading="lazy"
  title="${escapeHtml(currentModalProto.title)} — ProtoStage"
></iframe>`;
    } else if (activeTab === 'script') {
      const loc = window.location;
      const scriptUrl = loc.protocol + '//' + loc.host + loc.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') + '/embed/embed-frame.js';
      codeBox.textContent = `<!-- ProtoStage Universal Responsive Embed -->
<div data-protostage="${url}" style="width:100%; max-width:430px; height:920px; margin:0 auto;"></div>
<script src="${scriptUrl}" async><\/script>`;
    } else {
      codeBox.textContent = url;
    }
  }

  function setupEvents() {
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = prototypes.filter((p) => {
          return p.title.toLowerCase().includes(query) ||
                 p.description.toLowerCase().includes(query) ||
                 p.author.toLowerCase().includes(query) ||
                 (p.tags || []).some(t => t.toLowerCase().includes(query));
        });
        renderGrid(filtered);
      });
    }

    if (modalClose) {
      modalClose.addEventListener('click', closeModal);
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });

    [tabIframe, tabScript, tabLink].forEach((tab) => {
      if (!tab) return;
      tab.addEventListener('click', () => {
        [tabIframe, tabScript, tabLink].forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.getAttribute('data-tab');
        updateSnippet();
      });
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const text = codeBox.textContent;
        try {
          await navigator.clipboard.writeText(text);
          const orig = copyBtn.textContent;
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => { copyBtn.textContent = orig; }, 2000);
        } catch (_) {
          copyBtn.textContent = 'Failed';
        }
      });
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    loadPrototypes();
  });
})();
