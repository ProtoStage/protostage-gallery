/**
 * gallery.js — ProtoStage Showcase Hub Interactive Controller
 * Zen Porcelain Connecticut & Proto Purple
 */
(function() {
  'use strict';

  let prototypes = [];
  let currentModalProto = null;
  let activeEmbedTab = 'iframe'; // 'iframe' | 'script' | 'link'
  let activeDesignerFilter = 'all';
  let activeArchetypeFilter = 'all';
  let activeDomainFilter = 'all';
  let searchQuery = '';
  let viewMode = 'unified'; // 'unified' | 'grouped'

  // DOM Elements
  const featuredGrid = document.getElementById('featured-grid');
  const repoGrid = document.getElementById('repo-grid');
  const searchInput = document.getElementById('repo-search-input');
  const designerChips = document.getElementById('designer-filter-chips');
  const archetypeChips = document.getElementById('archetype-filter-chips');
  const domainChips = document.getElementById('domain-filter-chips');
  const btnViewUnified = document.getElementById('btn-view-unified');
  const btnViewGrouped = document.getElementById('btn-view-grouped');

  // Install Snippet Copy
  const btnCopyInstall = document.getElementById('btn-copy-install');
  const installCode = document.getElementById('install-code-text');

  // Embed Modal
  const modal = document.getElementById('embed-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-proto-title');
  const codeBox = document.getElementById('embed-code-box');
  const copyBtn = document.getElementById('copy-embed-btn');
  const tabIframe = document.getElementById('tab-iframe');
  const tabScript = document.getElementById('tab-script');
  const tabLink = document.getElementById('tab-link');

  // Navigation Links
  const navLinks = document.querySelectorAll('.nav-link[data-nav]');

  async function init() {
    setupNavScrollSpy();
    setupInstallCopy();
    setupEmbedModal();
    setupFilterListeners();
    await loadPrototypes();
  }

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
          title: 'Mobile Starter — Checkout & Card Decline',
          description: 'Standard 4-screen retail flow featuring shopping cart drawer, address intake, and simulated card-declined edge case handling.',
          author: 'Charlie Herbozo-Vidal',
          authorHandle: 'CharlieHV',
          authorSlug: 'charlie-herbozo',
          portfolio: 'https://charlie-hv97.github.io',
          viewport: 'iPhone 16 Pro',
          archetype: 'Tabbed Mobile Hub',
          domain: 'E-Commerce & Retail',
          screens: 4,
          scenarios: 2,
          featured: true,
          tags: ['Mobile', 'iOS', 'Commerce', 'Checkout', 'Tabbed Hub'],
          path: 'designers/charlie-herbozo/mobile-starter',
          publishedAt: '2026-11-12'
        }
      ];
    }

    renderFeatured(prototypes);
    renderRepository();
  }

  /* -------------------------------------------------------------------------
   * Featured Projects Rendering
   * ----------------------------------------------------------------------- */
  function renderFeatured(items) {
    if (!featuredGrid) return;
    featuredGrid.innerHTML = '';

    const featuredItems = items.filter(p => p.featured);
    const toRender = featuredItems.length > 0 ? featuredItems : items.slice(0, 3);

    toRender.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'featured-card';

      const protoUrl = `./${p.path}/index.html`;

      card.innerHTML = `
        <div class="featured-card-preview">
          <div class="phone-mockup">
            <div class="mockup-island"></div>
            <div class="mockup-header-bar"></div>
            <div class="mockup-body-card"></div>
            <div class="mockup-body-card" style="height:36px; opacity:0.7;"></div>
            <div class="mockup-cta-btn"></div>
          </div>
        </div>
        <div class="featured-card-body">
          <div class="featured-card-meta">
            <span class="tag-badge archetype">${escapeHtml(p.archetype || 'Prototype')}</span>
            <span class="tag-badge domain">${escapeHtml(p.domain || 'General')}</span>
            <span class="tag-badge device">${escapeHtml(p.viewport || 'iPhone 16 Pro')}</span>
          </div>
          <h3 class="featured-card-title">${escapeHtml(p.title)}</h3>
          <p class="featured-card-desc">${escapeHtml(p.description)}</p>
          <div class="featured-card-author">
            Authored by <a href="${p.portfolio || '#'}" target="_blank" rel="noopener" class="author-link">${escapeHtml(p.author)}</a>
            ${p.authorHandle ? `(@${escapeHtml(p.authorHandle)})` : ''}
            • ${p.screens || 3} screens
          </div>
          <div class="featured-card-actions">
            <a href="${protoUrl}" target="_blank" rel="noopener" class="btn-card-launch">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Launch Flow
            </a>
            <button type="button" class="btn-card-embed" data-slug="${p.slug}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>
              Embed
            </button>
          </div>
        </div>
      `;

      card.querySelector('.btn-card-embed').addEventListener('click', () => {
        openEmbedModal(p);
      });

      featuredGrid.appendChild(card);
    });
  }

  /* -------------------------------------------------------------------------
   * Repository Filtering & Rendering
   * ----------------------------------------------------------------------- */
  function filterPrototypes() {
    return prototypes.filter((p) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title && p.title.toLowerCase().includes(q);
        const matchesDesc = p.description && p.description.toLowerCase().includes(q);
        const matchesAuthor = p.author && p.author.toLowerCase().includes(q);
        const matchesDomain = p.domain && p.domain.toLowerCase().includes(q);
        const matchesArchetype = p.archetype && p.archetype.toLowerCase().includes(q);
        const matchesTags = (p.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesAuthor && !matchesDomain && !matchesArchetype && !matchesTags) {
          return false;
        }
      }

      // Designer Filter
      if (activeDesignerFilter !== 'all') {
        const handle = (p.authorHandle || '').toLowerCase();
        const author = (p.author || '').toLowerCase();
        const target = activeDesignerFilter.toLowerCase();
        if (target === 'charliehvd') {
          if (!handle.includes('charlie') && !author.includes('charlie')) return false;
        } else if (target === 'community') {
          if (!handle.includes('community') && !author.includes('community')) return false;
        }
      }

      // Archetype Filter
      if (activeArchetypeFilter !== 'all') {
        if (!p.archetype || !p.archetype.toLowerCase().includes(activeArchetypeFilter.toLowerCase())) {
          return false;
        }
      }

      // Domain Filter
      if (activeDomainFilter !== 'all') {
        if (!p.domain || !p.domain.toLowerCase().includes(activeDomainFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }

  function renderRepository() {
    if (!repoGrid) return;
    repoGrid.innerHTML = '';

    const items = filterPrototypes();

    if (items.length === 0) {
      repoGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 56px 0; background: var(--bg-surface); border: 1px dashed var(--border-porcelain); border-radius: 14px;">
          <p style="font-family: var(--font-heading); font-size: 16px; font-weight: 600; color: var(--text-navy); margin-bottom: 6px;">No prototypes found</p>
          <p style="font-size: 13.5px;">Try adjusting your search keywords or clearing active filter chips.</p>
        </div>
      `;
      return;
    }

    if (viewMode === 'grouped') {
      renderGroupedByDesigner(items);
    } else {
      renderUnifiedGrid(items);
    }
  }

  function renderUnifiedGrid(items) {
    items.forEach((p) => {
      const card = createRepoCard(p);
      repoGrid.appendChild(card);
    });
  }

  function renderGroupedByDesigner(items) {
    // Group by author
    const groups = {};
    items.forEach((p) => {
      const author = p.author || 'Other Designers';
      if (!groups[author]) groups[author] = [];
      groups[author].push(p);
    });

    Object.keys(groups).forEach((author) => {
      const groupBlock = document.createElement('div');
      groupBlock.style.gridColumn = '1 / -1';
      groupBlock.className = 'designer-group-block';

      const initial = author.charAt(0).toUpperCase();
      const count = groups[author].length;

      groupBlock.innerHTML = `
        <div class="designer-group-header">
          <div class="designer-avatar-badge">${initial}</div>
          <h3 class="designer-name-title">${escapeHtml(author)}</h3>
          <span class="designer-count-badge">${count} prototype${count === 1 ? '' : 's'}</span>
        </div>
        <div class="repo-grid" id="group-grid-${escapeId(author)}"></div>
      `;

      const subGrid = groupBlock.querySelector(`#group-grid-${escapeId(author)}`);
      groups[author].forEach((p) => {
        subGrid.appendChild(createRepoCard(p));
      });

      repoGrid.appendChild(groupBlock);
    });
  }

  function createRepoCard(p) {
    const card = document.createElement('div');
    card.className = 'repo-card';

    const protoUrl = `./${p.path}/index.html`;
    const tagsHtml = (p.tags || []).slice(0, 3).map(t => `<span class="repo-tag">${escapeHtml(t)}</span>`).join('');

    card.innerHTML = `
      <div class="repo-card-header">
        <span class="tag-badge archetype">${escapeHtml(p.archetype || 'Flow')}</span>
        <span class="tag-badge domain">${escapeHtml(p.domain || 'General')}</span>
      </div>
      <h4 class="repo-card-title">${escapeHtml(p.title)}</h4>
      <p class="repo-card-desc">${escapeHtml(p.description)}</p>
      <div class="repo-card-tags">${tagsHtml}</div>
      <div class="repo-card-author-row">
        <span>by <a href="${p.portfolio || '#'}" target="_blank" rel="noopener" class="author-link">${escapeHtml(p.author)}</a></span>
        <span>${p.screens || 3} screens • ${p.viewport || 'Mobile'}</span>
      </div>
      <div class="repo-card-actions">
        <a href="${protoUrl}" target="_blank" rel="noopener" class="btn-repo-explore">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Explore
        </a>
        <button type="button" class="btn-repo-embed" data-slug="${p.slug}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>
          Embed Code
        </button>
      </div>
    `;

    card.querySelector('.btn-repo-embed').addEventListener('click', () => {
      openEmbedModal(p);
    });

    return card;
  }

  /* -------------------------------------------------------------------------
   * Filter Event Listeners
   * ----------------------------------------------------------------------- */
  function setupFilterListeners() {
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderRepository();
      });
    }

    if (designerChips) {
      designerChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-chip');
        if (!btn) return;
        designerChips.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeDesignerFilter = btn.dataset.designer || 'all';
        renderRepository();
      });
    }

    if (archetypeChips) {
      archetypeChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-chip');
        if (!btn) return;
        archetypeChips.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeArchetypeFilter = btn.dataset.archetype || 'all';
        renderRepository();
      });
    }

    if (domainChips) {
      domainChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-chip');
        if (!btn) return;
        domainChips.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeDomainFilter = btn.dataset.domain || 'all';
        renderRepository();
      });
    }

    if (btnViewUnified) {
      btnViewUnified.addEventListener('click', () => {
        viewMode = 'unified';
        btnViewUnified.classList.add('active');
        if (btnViewGrouped) btnViewGrouped.classList.remove('active');
        renderRepository();
      });
    }

    if (btnViewGrouped) {
      btnViewGrouped.addEventListener('click', () => {
        viewMode = 'grouped';
        btnViewGrouped.classList.add('active');
        if (btnViewUnified) btnViewUnified.classList.remove('active');
        renderRepository();
      });
    }
  }

  /* -------------------------------------------------------------------------
   * Install Command Copy
   * ----------------------------------------------------------------------- */
  function setupInstallCopy() {
    if (btnCopyInstall && installCode) {
      btnCopyInstall.addEventListener('click', () => {
        const text = installCode.textContent.trim();
        navigator.clipboard.writeText(text).then(() => {
          const original = btnCopyInstall.textContent;
          btnCopyInstall.textContent = 'Copied!';
          setTimeout(() => {
            btnCopyInstall.textContent = original;
          }, 2000);
        });
      });
    }
  }

  /* -------------------------------------------------------------------------
   * Embed Modal Controller
   * ----------------------------------------------------------------------- */
  function setupEmbedModal() {
    if (!modal) return;

    if (modalClose) {
      modalClose.addEventListener('click', closeEmbedModal);
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeEmbedModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeEmbedModal();
      }
    });

    if (tabIframe) tabIframe.addEventListener('click', () => setEmbedTab('iframe'));
    if (tabScript) tabScript.addEventListener('click', () => setEmbedTab('script'));
    if (tabLink) tabLink.addEventListener('click', () => setEmbedTab('link'));

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!codeBox) return;
        navigator.clipboard.writeText(codeBox.textContent).then(() => {
          const orig = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = orig;
          }, 2000);
        });
      });
    }
  }

  function openEmbedModal(proto) {
    currentModalProto = proto;
    if (modalTitle) {
      modalTitle.textContent = `Embed: ${proto.title}`;
    }
    setEmbedTab('iframe');
    modal.classList.add('open');
  }

  function closeEmbedModal() {
    if (modal) modal.classList.remove('open');
  }

  function setEmbedTab(tab) {
    activeEmbedTab = tab;
    [tabIframe, tabScript, tabLink].forEach(t => {
      if (t) t.classList.toggle('active', t.dataset.tab === tab);
    });

    if (!currentModalProto || !codeBox) return;

    const origin = window.location.origin;
    const pathName = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    const baseUrl = `${origin}${pathName}`;
    const embedUrl = `${baseUrl}/${currentModalProto.path}/embed.html`;
    const fullUrl = `${baseUrl}/${currentModalProto.path}/index.html`;

    if (tab === 'iframe') {
      codeBox.textContent = `<iframe\n  src="${embedUrl}"\n  width="393"\n  height="852"\n  style="border:none; border-radius:40px; box-shadow:0 12px 36px rgba(41,48,65,0.18);"\n  title="${currentModalProto.title}"\n  loading="lazy"\n  allow="clipboard-write"\n></iframe>`;
    } else if (tab === 'script') {
      codeBox.textContent = `<div data-protostage-embed="${currentModalProto.slug}"></div>\n<script src="${baseUrl}/embed/embed.js" async></script>`;
    } else if (tab === 'link') {
      codeBox.textContent = fullUrl;
    }
  }

  /* -------------------------------------------------------------------------
   * Nav Scroll Spy
   * ----------------------------------------------------------------------- */
  function setupNavScrollSpy() {
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId && targetId.startsWith('#')) {
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });

    const sections = ['hero', 'featured', 'repository', 'community'].map(id => document.getElementById(id)).filter(Boolean);
    window.addEventListener('scroll', () => {
      const scrollPos = window.scrollY + 120;
      sections.forEach(sec => {
        if (scrollPos >= sec.offsetTop && scrollPos < sec.offsetTop + sec.offsetHeight) {
          const id = sec.id;
          navLinks.forEach(l => {
            l.classList.toggle('active', l.getAttribute('href') === `#${id}`);
          });
        }
      });
    });
  }

  /* -------------------------------------------------------------------------
   * Utilities
   * ----------------------------------------------------------------------- */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeId(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
