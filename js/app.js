// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
//
// THE STORE — a shop window over DATABASE.server.BIM. Every view is a hash
// (logic.parseHash), so a view is a link and the back button walks them.
// Nothing here knows a device: the departments, makers, connectors and every
// count come from the server; no prices, because the library keeps none.

import {
  SORTS, PAGE_SIZE, API_STORAGE_KEY, parseHash, buildHash, partsQuery, facetsQuery,
  toggleFilter, activeChips, removeChip, emptyFilters, resolveApiBase, cardImage, cardFacts,
  specSections, groupPorts, portTotal, documentLinks, galleryImages, portalLinks, safeHref,
  editorUrl, escapeHtml as h, fmtNum, fmtUnit, ruLabel, pageCount, pageWindow, rangeLabel,
  departmentIcon,
} from './logic.js';
import { createApi } from './api.js';

const app = document.getElementById('app');
const searchForm = document.getElementById('site-search');
const searchInput = document.getElementById('site-q');
const apiPill = document.getElementById('api-pill');

let api;
let state = parseHash(location.hash);
let renderToken = 0;
const makerNames = {}; // slug → display name, filled from facets and /makers

// ---- boot -----------------------------------------------------------------

function boot() {
  let stored = null;
  try { stored = localStorage.getItem(API_STORAGE_KEY); } catch { /* storage may be blocked */ }
  const { base, remember } = resolveApiBase(location.search, stored);
  try {
    if (remember === null) localStorage.removeItem(API_STORAGE_KEY);
    else if (remember !== undefined) localStorage.setItem(API_STORAGE_KEY, remember);
  } catch { /* the override still holds for this visit */ }
  api = createApi(base);

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    const filters = { ...emptyFilters(), q };
    go({ view: 'catalog', filters, sort: q ? 'featured' : state.sort, page: 1, layout: state.layout });
  });
  window.addEventListener('hashchange', render);
  // a missing photo falls back to the panel drawing; a missing drawing to a glyph
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fallback) {
      img.src = img.dataset.fallback;
      img.dataset.fallback = '';
      img.classList.remove('photo');
      img.classList.add('panel');
      img.parentElement?.classList.replace('photo', 'panel');
    } else {
      img.replaceWith(Object.assign(document.createElement('span'), { className: 'noimg', textContent: '📦' }));
    }
  }, true);
  app.addEventListener('click', onClick);
  app.addEventListener('change', onChange);
  app.addEventListener('input', onInput);

  api.stats().then((s) => {
    apiPill.textContent = `${fmtNum(s.parts, 0)} parts`;
    apiPill.title = `Library: ${api.base}`;
    apiPill.dataset.state = 'online';
  }).catch((err) => {
    apiPill.textContent = 'offline';
    apiPill.title = err.message;
    apiPill.dataset.state = 'dead';
  });
  render();
}

function go(next) {
  const hash = buildHash(next);
  if (hash === location.hash || (hash === '#/' && !location.hash)) render();
  else location.hash = hash;
}

// ---- dispatch ---------------------------------------------------------------

async function render() {
  state = parseHash(location.hash);
  const token = ++renderToken;
  const live = () => token === renderToken;
  searchInput.value = state.view === 'catalog' ? state.filters.q : '';
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === state.view));
  app.setAttribute('aria-busy', 'true');
  document.title = 'BIM Store';
  try {
    if (state.view === 'part') await renderPart(live);
    else if (state.view === 'catalog') await renderCatalog(live);
    else if (state.view === 'maker') await renderCatalog(live, state.maker);
    else if (state.view === 'makers') await renderMakers(live);
    else await renderHome(live);
  } catch (err) {
    if (live()) app.innerHTML = errorBlock(err);
  } finally {
    if (live()) app.removeAttribute('aria-busy');
  }
}

function errorBlock(err) {
  return `<section class="notice dead"><h2>Something went wrong</h2><p>${h(err.message || err)}</p>
    <p class="dim">Library: <code>${h(api.base)}</code> — open the store with <code>?api=http://127.0.0.1:8150/api/bim</code> to point it at a hand-run server.</p></section>`;
}

function skeleton(n = 8) {
  return `<div class="grid">${'<div class="card skel"><div class="fig"></div><div class="body"><i></i><i></i><i></i></div></div>'.repeat(n)}</div>`;
}

// ---- pieces -------------------------------------------------------------------

function partHref(id) {
  return buildHash({ view: 'part', id });
}

function makerHref(slug) {
  return buildHash({ view: 'maker', maker: slug, filters: emptyFilters() });
}

function catalogHref(filters) {
  return buildHash({ view: 'catalog', filters: { ...emptyFilters(), ...filters } });
}

function card(s) {
  const f = cardFacts(s);
  const img = cardImage(s, api.base);
  return `<a class="card" href="${partHref(s.id)}">
    <div class="fig ${img.kind}"><img class="${img.kind}" loading="lazy" alt="" src="${h(img.src)}" data-fallback="${h(img.fallback)}">
      ${f.badges.map((b) => `<span class="badge ${b.kind}">${h(b.text)}</span>`).join('')}</div>
    <div class="body">
      <div class="maker">${h(f.maker)}</div>
      <div class="title">${s.symbol ? `<span class="sym">${h(s.symbol)}</span>` : ''}${h(f.title)}</div>
      ${f.sub ? `<div class="sub">${h(f.sub)}</div>` : ''}
      ${s.description ? `<p class="desc">${h(s.description)}</p>` : ''}
      ${f.connectors.length ? `<div class="chips">${f.connectors.map((c) => `<span class="chip">${h(c)}</span>`).join('')}${f.moreConnectors ? `<span class="chip more">+${f.moreConnectors}</span>` : ''}</div>` : ''}
    </div></a>`;
}

function shelf(title, items, moreHref, moreText = 'See all') {
  if (!items || !items.length) return '';
  return `<section class="shelf"><header><h2>${h(title)}</h2>${moreHref ? `<a href="${moreHref}">${h(moreText)} →</a>` : ''}</header>
    <div class="rail-scroll">${items.map(card).join('')}</div></section>`;
}

function makerIcon(icon, name) {
  const src = safeHref(icon);
  if (src && /[./]/.test(icon)) return `<img class="micon" alt="" src="${h(src)}">`;
  if (icon) return `<span class="micon">${h(icon)}</span>`;
  return `<span class="micon letter">${h((name || '?').trim().charAt(0).toUpperCase())}</span>`;
}

// ---- home -------------------------------------------------------------------

async function renderHome(live) {
  app.innerHTML = `<section class="hero"><h1>The device library</h1><p class="dim">Loading the catalogue…</p></section>${skeleton(6)}`;
  const [stats, makers, featured, updated] = await Promise.all([
    api.stats(),
    api.makers().catch(() => []),
    api.parts('/parts?sort=featured&has_image=1&limit=12'),
    api.parts('/parts?sort=updated&limit=12').catch(() => ({ items: [] })),
  ]);
  let shopWindow = featured.items;
  let windowTitle = 'Featured';
  if (!shopWindow.length) {
    // no photos yet: the best-described parts are the window instead
    shopWindow = (await api.parts('/parts?sort=featured&has_ports=1&limit=12')).items;
    windowTitle = 'Featured — best described';
  }
  if (!live()) return;
  for (const m of makers) makerNames[m.id] = m.name;
  const depts = Object.entries(stats.by_category || {});
  const topMakers = [...makers].sort((a, b) => b.parts - a.parts).slice(0, 24);
  app.innerHTML = `
    <section class="hero">
      <h1>The device library</h1>
      <p>${fmtNum(stats.parts, 0)} parts from ${fmtNum(stats.makers, 0)} makers — ${fmtNum(stats.declared, 0)} fully described, ${fmtNum(stats.ports, 0)} ports drawn. Every one a front panel in mm, an IFC4 download and a port list.</p>
      <form class="hero-search" data-hero-search><input name="q" type="search" placeholder="Search model, maker, connector… e.g. “XLR 1U preamp”" aria-label="Search the library"><button>Search</button></form>
    </section>
    <section class="depts"><header><h2>Departments</h2><a href="#/catalog">Browse everything →</a></header>
      <div class="tiles">${depts.map(([cat, n]) => `<a class="tile" href="${catalogHref({ category: [cat] })}"><span class="ticon">${departmentIcon(cat)}</span><span class="tname">${h(cat)}</span><span class="tcount">${fmtNum(n, 0)}</span></a>`).join('')}</div>
    </section>
    ${shelf(windowTitle, shopWindow, buildHash({ view: 'catalog', filters: { ...emptyFilters(), has_image: featured.items.length > 0 }, sort: 'featured' }))}
    <section class="makers-strip"><header><h2>Browse by maker</h2><a href="#/makers">All ${fmtNum(makers.length, 0)} makers →</a></header>
      <div class="mstrip">${topMakers.map((m) => `<a class="mchip" href="${makerHref(m.id)}">${makerIcon(m.icon, m.name)}<span>${h(m.name)}</span><b>${fmtNum(m.parts, 0)}</b></a>`).join('')}</div>
    </section>
    ${shelf('Recently updated', updated.items, buildHash({ view: 'catalog', filters: emptyFilters(), sort: 'updated' }))}`;
  app.querySelector('[data-hero-search]').addEventListener('submit', (e) => {
    e.preventDefault();
    go({ view: 'catalog', filters: { ...emptyFilters(), q: e.target.q.value.trim() }, page: 1 });
  });
}

// ---- catalog (and a maker's page) -----------------------------------------------

const FACETS = [
  { key: 'category', title: 'Department' },
  { key: 'maker', title: 'Maker', search: true },
  { key: 'connector', title: 'Connector', search: true },
  { key: 'ru', title: 'Rack height' },
  { key: 'class', title: 'Class', search: true },
  { key: 'stage', title: 'Data' },
];
const FACET_SHOW = 10;
const openFacets = new Set(); // facets the visitor expanded ("show all")
const facetSearch = {};

async function renderCatalog(live, makerSlug = null) {
  const hadRail = app.querySelector('.catalog');
  if (!hadRail) app.innerHTML = `<div class="catalog"><aside class="rail"></aside><main class="results">${skeleton(12)}</main></div>`;
  else app.querySelector('.results .grid, .results .list')?.classList.add('stale');
  const [page, facets, maker] = await Promise.all([
    api.parts(partsQuery(state)),
    api.facets(facetsQuery(state)),
    makerSlug ? api.maker(makerSlug).catch(() => null) : null,
  ]);
  if (!live()) return;
  for (const row of facets.maker || []) makerNames[row.value] = row.label || row.value;
  const labels = { maker: makerNames, stage: { stub: 'Stubs', declared: 'Fully described' } };
  const chips = activeChips(state.view === 'maker' ? { ...state.filters, maker: [] } : state.filters, labels);
  const pages = pageCount(page.total, PAGE_SIZE);
  const header = makerSlug ? makerHeader(makerSlug, maker, page.total) : catalogHeader();
  app.innerHTML = `${header}
    <div class="catalog ${document.body.classList.contains('rail-open') ? 'rail-open' : ''}">
      <aside class="rail" aria-label="Filters">
        <div class="rail-head"><b>Filters</b>${chips.length ? '<button class="link" data-clear>Clear all</button>' : ''}</div>
        ${FACETS.filter((f) => !(makerSlug && f.key === 'maker')).map((f) => facetBlock(f, facets[f.key] || [], labels)).join('')}
        <div class="facet"><h3>Pictures &amp; ports</h3>
          <label class="opt"><input type="checkbox" data-flag="has_image" ${state.filters.has_image ? 'checked' : ''}><span>Has a photo</span></label>
          <label class="opt"><input type="checkbox" data-flag="has_ports" ${state.filters.has_ports ? 'checked' : ''}><span>Has a port list</span></label>
        </div>
      </aside>
      <main class="results">
        <div class="toolbar">
          <button class="filters-btn" data-toggle-rail>☰ Filters${chips.length ? ` (${chips.length})` : ''}</button>
          <span class="count">${rangeLabel(page.offset, page.items.length, page.total)}</span>
          <span class="grow"></span>
          <label class="sort">Sort <select data-sort>${SORTS.map((s) => `<option value="${s.value}" ${s.value === state.sort ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
          <span class="seg" role="group" aria-label="Layout">
            <button data-layout="grid" class="${state.layout === 'grid' ? 'on' : ''}" title="Grid">▦</button>
            <button data-layout="list" class="${state.layout === 'list' ? 'on' : ''}" title="List">☰</button>
          </span>
        </div>
        ${chips.length ? `<div class="active">${chips.map((c, i) => `<button class="achip" data-chip="${i}">${h(c.label)} ✕</button>`).join('')}</div>` : ''}
        ${page.items.length
          ? `<div class="${state.layout === 'list' ? 'list' : 'grid'}">${page.items.map(card).join('')}</div>`
          : `<section class="notice"><h2>Nothing matches</h2><p>No part has all of these. Remove a filter${state.filters.q ? ' or try fewer words' : ''}.</p></section>`}
        ${pager(state.page, pages)}
      </main>
    </div>`;
  app._chips = chips;
  if (state.page > 1 || hadRail) app.querySelector('.results')?.scrollIntoView({ block: 'start', behavior: 'instant' });
}

function catalogHeader() {
  const cat = state.filters.category.length === 1 ? state.filters.category[0] : null;
  if (cat) return `<header class="page-head"><nav class="crumbs"><a href="#/">Store</a> › <span>${h(cat)}</span></nav><h1>${departmentIcon(cat)} ${h(cat)}</h1></header>`;
  if (state.filters.q) return `<header class="page-head"><nav class="crumbs"><a href="#/">Store</a> › <span>Search</span></nav><h1>Results for “${h(state.filters.q)}”</h1></header>`;
  return `<header class="page-head"><nav class="crumbs"><a href="#/">Store</a> › <span>Catalogue</span></nav><h1>The catalogue</h1></header>`;
}

function makerHeader(slug, m, total) {
  const name = (m && m.name) || makerNames[slug] || slug;
  const links = portalLinks(m && (m.portal || m.portals || m.links || m.website)).filter((l) => safeHref(l.url));
  return `<header class="maker-head">
    <nav class="crumbs"><a href="#/">Store</a> › <a href="#/makers">Makers</a> › <span>${h(name)}</span></nav>
    <div class="mh">${makerIcon(m && m.icon, name)}<div>
      <h1>${h(name)}</h1>
      <p class="dim">${[m && m.sector, `${fmtNum(total, 0)} part${total === 1 ? '' : 's'}`].filter(Boolean).map(h).join(' · ')}</p>
      ${m && m.aka && m.aka.length ? `<p class="aka">Also known as ${m.aka.map(h).join(', ')}</p>` : ''}
      ${links.length ? `<p class="links">${links.map((l) => `<a href="${h(safeHref(l.url))}" target="_blank" rel="noopener">${h(l.label)} ↗</a>`).join('')}</p>` : ''}
    </div></div></header>`;
}

function facetBlock(f, rows, labels) {
  const picked = new Set(state.filters[f.key] || []);
  // a picked value the counts no longer list still shows, ticked, so it can be unticked
  const all = [...rows];
  for (const v of picked) if (!all.some((r) => r.value === v)) all.push({ value: v, count: 0 });
  if (f.key === 'ru') all.sort((a, b) => Number(a.value) - Number(b.value));
  const needle = (facetSearch[f.key] || '').toLowerCase();
  const label = (r) => (labels[f.key] && labels[f.key][r.value]) || r.label || (f.key === 'ru' ? ruLabel(r.value) : r.value);
  const filtered = needle ? all.filter((r) => String(label(r)).toLowerCase().includes(needle)) : all;
  const open = openFacets.has(f.key) || needle;
  const shown = open ? filtered : filtered.filter((r, i) => i < FACET_SHOW || picked.has(r.value));
  if (!all.length) return '';
  return `<div class="facet" data-facet="${f.key}"><h3>${h(f.title)}</h3>
    ${f.search && all.length > FACET_SHOW ? `<input class="fsearch" type="search" placeholder="Find a ${h(f.title.toLowerCase())}…" data-fsearch="${f.key}" value="${h(facetSearch[f.key] || '')}">` : ''}
    <div class="opts">${shown.map((r) => `<label class="opt"><input type="checkbox" data-facet-key="${f.key}" value="${h(r.value)}" ${picked.has(r.value) ? 'checked' : ''}><span>${h(label(r))}</span><b>${fmtNum(r.count, 0)}</b></label>`).join('') || '<p class="dim small">None match.</p>'}</div>
    ${!needle && filtered.length > FACET_SHOW ? `<button class="link" data-more="${f.key}">${open ? 'Show fewer' : `Show all ${fmtNum(filtered.length, 0)}`}</button>` : ''}
  </div>`;
}

function pager(page, pages) {
  if (pages <= 1) return '';
  const link = (p, text = p, cls = '') => `<a class="${cls}" href="${buildHash({ ...state, page: p })}">${text}</a>`;
  return `<nav class="pager" aria-label="Pages">
    ${page > 1 ? link(page - 1, '‹ Prev') : '<span class="off">‹ Prev</span>'}
    ${pageWindow(page, pages).map((p) => (p === '…' ? '<span class="gap">…</span>' : link(p, p, p === page ? 'on' : ''))).join('')}
    ${page < pages ? link(page + 1, 'Next ›') : '<span class="off">Next ›</span>'}
  </nav>`;
}

// ---- makers index -------------------------------------------------------------

let makersFilter = '';

async function renderMakers(live) {
  app.innerHTML = `<header class="page-head"><h1>Makers</h1></header>${skeleton(8)}`;
  const makers = await api.makers();
  if (!live()) return;
  for (const m of makers) makerNames[m.id] = m.name;
  makersFilter = state.filters.q || makersFilter;
  app.innerHTML = `<header class="page-head"><nav class="crumbs"><a href="#/">Store</a> › <span>Makers</span></nav>
      <h1>Makers</h1><p class="dim">${fmtNum(makers.length, 0)} makers in the library.</p>
      <input class="fsearch big" type="search" placeholder="Find a maker…" data-makers-q value="${h(makersFilter)}"></header>
    <div class="maker-grid" data-maker-grid></div>`;
  const grid = app.querySelector('[data-maker-grid]');
  const draw = () => {
    const needle = makersFilter.toLowerCase();
    const rows = needle ? makers.filter((m) => m.name.toLowerCase().includes(needle) || m.id.includes(needle)) : makers;
    grid.innerHTML = rows.map((m) => `<a class="mtile" href="${makerHref(m.id)}">${makerIcon(m.icon, m.name)}<span class="mname">${h(m.name)}</span><span class="dim small">${[m.sector, `${fmtNum(m.parts, 0)} parts`].filter(Boolean).map(h).join(' · ')}</span></a>`).join('') || '<p class="dim">No maker by that name.</p>';
  };
  draw();
  app.querySelector('[data-makers-q]').addEventListener('input', (e) => { makersFilter = e.target.value; draw(); });
}

// ---- product page ---------------------------------------------------------------

async function renderPart(live) {
  app.innerHTML = `<div class="product loading"><div class="gallery"><div class="stage skel"></div></div><div class="buy"><div class="skel line"></div><div class="skel line"></div></div></div>`;
  const id = state.id;
  const part = await api.part(id);
  if (!live()) return;
  const makerSlug = part.maker || id.split('/')[0];
  const gallery = galleryImages(part, api.base);
  const sections = specSections(part);
  const groups = groupPorts(part.ports);
  const docs = documentLinks(part).filter((d) => safeHref(d.url));
  const phys = part.physical || {};
  const power = part.power || {};
  const facts = [
    phys.rack_units && ['Height', ruLabel(phys.rack_units)],
    part.ports && part.ports.length && ['Ports', fmtNum(portTotal(part.ports), 0)],
    phys.weight_kg && ['Weight', fmtUnit(phys.weight_kg, 'kg', 3)],
    power.watts && ['Power', fmtUnit(power.watts, 'W', 1)],
    power.btu_hr && ['Heat', fmtUnit(power.btu_hr, 'BTU/hr', 0)],
  ].filter(Boolean);
  document.title = `${part.name || part.model} · BIM Store`;
  app.innerHTML = `
    <nav class="crumbs"><a href="#/">Store</a> ›
      ${part.category ? `<a href="${catalogHref({ category: [part.category] })}">${h(part.category)}</a> ›` : ''}
      <a href="${makerHref(makerSlug)}">${h(part.manufacturer || makerSlug)}</a> › <span>${h(part.model)}</span></nav>
    <div class="product">
      <div class="gallery">
        <div class="stage ${gallery[0].kind}"><img data-stage class="${gallery[0].kind}" alt="${h(part.name)}" src="${h(gallery[0].src)}" data-fallback="${gallery[0].kind === 'photo' ? h(gallery[gallery.length - 1].src) : ''}"></div>
        ${gallery.length > 1 ? `<div class="thumbs">${gallery.map((g, i) => `<button class="thumb ${i === 0 ? 'on' : ''}" data-thumb="${h(g.src)}" data-kind="${g.kind}" title="${h(g.label)}"><img class="${g.kind}" loading="lazy" alt="${h(g.label)}" src="${h(g.src)}"></button>`).join('')}</div>` : `<p class="dim small">${h(gallery[0].label)} — drawn from the part's own dimensions and ports.</p>`}
      </div>
      <div class="buy">
        <a class="maker-link" href="${makerHref(makerSlug)}">${h(part.manufacturer || makerSlug)}</a>
        <h1>${part.symbol ? `<span class="sym">${h(part.symbol)}</span>` : ''}${h(part.name || part.model)}</h1>
        <p class="pn">${part.part_number ? `Part no. <code>${h(part.part_number)}</code> · ` : ''}<code class="dim">${h(part.id)}</code></p>
        <div class="badges">${part.category ? `<span class="badge cat">${h(part.category)}</span>` : ''}${part.class ? `<span class="badge">${h(part.class)}</span>` : ''}${part.stage === 'stub' ? '<span class="badge stub" title="Name only: no dimensions or ports yet">stub</span>' : '<span class="badge good">fully described</span>'}</div>
        ${part.description ? `<p class="lede">${h(part.description)}</p>` : ''}
        ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${h(v)}</dd></div>`).join('')}</dl>` : ''}
        <div class="live" data-live hidden></div>
        <div class="actions">
          <a class="btn primary" href="${h(api.url(id, '.ifc'))}" data-download="${h(id.replace('/', '_'))}.ifc">⬇ Download IFC</a>
          <a class="btn" href="${h(api.url(id, '.json'))}" data-download="${h(id.replace('/', '_'))}.bim.json">⬇ Download JSON</a>
          <a class="btn" href="${h(api.url(id, '.svg'))}" data-download="${h(id.replace('/', '_'))}.svg">⬇ Panel SVG</a>
          <a class="btn" href="${h(editorUrl(id))}">✎ Edit in Device Editor</a>
        </div>
        ${part.aka && part.aka.length ? `<p class="aka small dim">Also sold as ${part.aka.map(h).join(', ')}</p>` : ''}
        <p class="noprice small dim">No prices: the library describes the metal, not the deal.</p>
      </div>
    </div>
    <div class="detail">
      <section class="specs"><h2>Specifications</h2>
        ${sections.map((s) => `<table class="spec"><caption>${h(s.section)}</caption><tbody>${s.rows.map(([k, v]) => `<tr><th>${h(k)}</th><td>${h(v)}</td></tr>`).join('')}</tbody></table>`).join('')}
      </section>
      <section class="maker-card" data-maker-card><h2>The maker</h2><p class="dim">…</p></section>
      <section class="ports"><h2>Ports ${part.ports && part.ports.length ? `<span class="dim">(${fmtNum(portTotal(part.ports), 0)})</span>` : ''}</h2>
        ${groups.length ? `<table class="ptable"><thead><tr><th>Port</th><th>Connector</th><th>Signal</th><th>Direction</th><th>Domain</th><th class="num">Count</th></tr></thead>
          ${groups.map((g) => `<tbody><tr class="ghead"><th colspan="5">${h(g.group)}</th><th class="num">${fmtNum(g.total, 0)}</th></tr>
            ${g.rows.map((r) => `<tr><td>${h(r.name)}</td><td>${h(r.connector)}${r.face ? ` <span class="dim small">${h(r.face)}</span>` : ''}</td><td>${h(r.signal)}</td><td><span class="dir ${h(r.direction)}">${h(r.direction)}</span></td><td>${r.domain ? `<span class="dom" data-domain="${h(r.domain)}">${h(r.domain)}</span>` : ''}</td><td class="num">${fmtNum(r.count, 0)}</td></tr>
            ${r.labels.length ? `<tr class="labels"><td></td><td colspan="5">${r.labels.slice(0, 64).map(h).join(' · ')}${r.labels.length > 64 ? ' …' : ''}</td></tr>` : ''}`).join('')}</tbody>`).join('')}
        </table>` : '<p class="dim">No port list yet. <a href="' + h(editorUrl(id)) + '">Add one in the Device Editor</a>.</p>'}
      </section>
      <section class="docs"><h2>Documents</h2>
        ${docs.length ? `<ul class="doclist">${docs.map((d) => `<li><a href="${h(safeHref(d.url))}" target="_blank" rel="noopener">${d.kind === 'manual' ? '📄' : '🔗'} ${h(d.label)}</a> <span class="dim small">${h(hostname(d.url))}</span></li>`).join('')}</ul>` : '<p class="dim">No manuals or product page linked yet.</p>'}
        ${part.sources && part.sources.length ? `<p class="small dim">Sources: ${part.sources.map(h).join(', ')}${part.updated_at ? ` · updated ${h(part.updated_at.slice(0, 10))}` : ''}</p>` : ''}
        ${part.note ? `<p class="small">${h(part.note)}</p>` : ''}
      </section>
      <section class="manage"><h2>Manage</h2>
        <p class="small dim">Changes go to the shared library through the gateway, which asks for the bench credential.</p>
        <button class="btn" data-edit-json>{ } Edit JSON</button> <button class="btn danger" data-delete>Delete part</button>
        <p class="msg" data-manage-msg></p>
      </section>
    </div>
    <div data-more-shelf></div>`;
  app._part = part;
  window.scrollTo({ top: 0, behavior: 'instant' });
  showLive(id, part, live);

  // the maker card and the shelf follow; the page is already readable
  const [maker, more] = await Promise.all([
    api.maker(makerSlug).catch(() => null),
    api.parts(`/parts?maker=${encodeURIComponent(makerSlug)}&sort=featured&limit=13`).catch(() => ({ items: [], total: 0 })),
  ]);
  if (!live()) return;
  const name = (maker && maker.name) || part.manufacturer || makerSlug;
  const links = portalLinks(maker && (maker.portal || maker.portals || maker.links || maker.website)).filter((l) => safeHref(l.url));
  app.querySelector('[data-maker-card]').innerHTML = `<h2>The maker</h2>
    <a class="mcard" href="${makerHref(makerSlug)}">${makerIcon(maker && maker.icon, name)}<div><b>${h(name)}</b>
      <span class="dim small">${[maker && maker.sector, `${fmtNum(more.total, 0)} parts in the library`].filter(Boolean).map(h).join(' · ')}</span></div></a>
    ${maker && maker.aka && maker.aka.length ? `<p class="small dim">Also ${maker.aka.map(h).join(', ')}</p>` : ''}
    ${links.length ? `<p class="links">${links.map((l) => `<a href="${h(safeHref(l.url))}" target="_blank" rel="noopener">${h(l.label)} ↗</a>`).join('')}</p>` : ''}`;
  const others = more.items.filter((s) => s.id !== id).slice(0, 12);
  app.querySelector('[data-more-shelf]').innerHTML = shelf(`More from ${name}`, others, makerHref(makerSlug), `All ${fmtNum(more.total, 0)}`);
}

function hostname(url) {
  try { return new URL(url, location.href).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// ---- events -------------------------------------------------------------------

function onClick(e) {
  const t = e.target.closest('button, a');
  if (!t) return;
  if (t.matches('[data-clear]')) {
    go({ ...state, filters: emptyFilters(), page: 1 });
  } else if (t.matches('[data-chip]')) {
    go(removeChip(state, app._chips[Number(t.dataset.chip)]));
  } else if (t.matches('[data-layout]')) {
    go({ ...state, layout: t.dataset.layout });
  } else if (t.matches('[data-more]')) {
    const key = t.dataset.more;
    if (openFacets.has(key)) openFacets.delete(key); else openFacets.add(key);
    render();
  } else if (t.matches('[data-toggle-rail]')) {
    document.body.classList.toggle('rail-open');
    app.querySelector('.catalog')?.classList.toggle('rail-open', document.body.classList.contains('rail-open'));
  } else if (t.matches('[data-thumb]')) {
    const stage = app.querySelector('[data-stage]');
    stage.src = t.dataset.thumb;
    stage.className = t.dataset.kind;
    stage.parentElement.className = `stage ${t.dataset.kind}`;
    app.querySelectorAll('.thumb').forEach((b) => b.classList.toggle('on', b === t));
  } else if (t.matches('[data-download]')) {
    e.preventDefault();
    download(t.href, t.dataset.download);
  } else if (t.matches('[data-edit-json]')) {
    editJson(app._part);
  } else if (t.matches('[data-delete]')) {
    deletePart(app._part);
  }
}

function onChange(e) {
  const t = e.target;
  if (t.matches('[data-facet-key]')) go(toggleFilter(state, t.dataset.facetKey, t.value));
  else if (t.matches('[data-flag]')) go(toggleFilter(state, t.dataset.flag));
  else if (t.matches('[data-sort]')) go({ ...state, sort: t.value, page: 1 });
}

let facetTimer = 0;
function onInput(e) {
  const t = e.target;
  if (!t.matches('[data-fsearch]')) return;
  facetSearch[t.dataset.fsearch] = t.value;
  clearTimeout(facetTimer);
  facetTimer = setTimeout(() => {
    // redraw only that facet so the box keeps focus
    const key = t.dataset.fsearch;
    const f = FACETS.find((x) => x.key === key);
    const block = app.querySelector(`[data-facet="${key}"]`);
    if (!f || !block) return;
    api.facets(facetsQuery(state)).then((facets) => {
      const labels = { maker: makerNames, stage: { stub: 'Stubs', declared: 'Fully described' } };
      const tmp = document.createElement('div');
      tmp.innerHTML = facetBlock(f, facets[key] || [], labels);
      block.querySelector('.opts').replaceWith(tmp.querySelector('.opts'));
      const more = block.querySelector('[data-more]');
      const newMore = tmp.querySelector('[data-more]');
      if (more && !newMore) more.remove();
    });
  }, 120);
}

async function download(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

// ---- writes -------------------------------------------------------------------

function manageMsg(text, tone = '') {
  const el = app.querySelector('[data-manage-msg]');
  if (el) { el.textContent = text; el.dataset.tone = tone; }
}

function editJson(part) {
  const dlg = document.getElementById('json-dialog');
  const area = dlg.querySelector('textarea');
  const msg = dlg.querySelector('[data-dlg-msg]');
  area.value = JSON.stringify(part, null, 1);
  msg.textContent = '';
  dlg.showModal();
  dlg.querySelector('[data-dlg-save]').onclick = async (e) => {
    e.preventDefault();
    let body;
    try { body = JSON.parse(area.value); } catch (err) { msg.textContent = `Not JSON: ${err.message}`; return; }
    msg.textContent = 'Saving…';
    try {
      await api.save(part.id, body);
      dlg.close();
      render();
    } catch (err) {
      msg.textContent = err.message;
    }
  };
  dlg.querySelector('[data-dlg-cancel]').onclick = (e) => { e.preventDefault(); dlg.close(); };
}

async function deletePart(part) {
  if (!confirm(`Delete ${part.name || part.id} from the shared library? Every tool that reads it loses it.`)) return;
  manageMsg('Deleting…');
  try {
    await api.remove(part.id);
    go({ view: 'maker', maker: part.maker, filters: emptyFilters() });
  } catch (err) {
    manageMsg(err.message, 'dead');
  }
}

boot();

/* ON THE BENCH — connected, discovered, known: go for its default GUI.
   The library knows which bench devices are this part and which panel each
   presents on the bus (/api/bim/parts/<id>/live); "Open its panel" asks the OS
   shell for that device's console through the shared picker module. */
async function showLive(id, part, live) {
  let devices = [];
  let lib = null;
  try {
    lib = await import(`${api.base}/ui/picker.js`);
    devices = await lib.liveDevices(id);
  } catch (_) { return; }
  if (!live() || !devices.length) return;
  const box = app.querySelector('[data-live]');
  if (!box) return;
  const inShell = window.top !== window;
  box.hidden = false;
  box.innerHTML = `<h3>On the bench <span class="dim">(${devices.length})</span></h3>
    <ul>${devices.map((d, i) => `<li class="${h(d.state)}"><span class="dot" title="${h(d.state)}"></span>
      <span class="who">${h(d.name)}${d.serial ? ` <span class="dim small">#${h(d.serial)}</span>` : ''}<br><span class="dim small">${h(d.address || d.resource || '')}${d.state !== 'online' ? ` · ${h(d.state)}` : ''}</span></span>
      ${d.panel ? (inShell ? `<button class="btn ${d.state === 'online' ? 'primary' : ''}" data-open-gui="${i}" title="Its default GUI: the panel it presents (${h((d.panel.at || []).join(', '))})">▶ Open its panel</button>`
        : `<span class="small dim" title="Open this store inside the OS to open it">panel: ${h(d.panel.key)}</span>`) : '<span class="small dim">no panel yet</span>'}</li>`).join('')}</ul>`;
  box.querySelectorAll('[data-open-gui]').forEach((b) => b.addEventListener('click', () => {
    const d = devices[Number(b.dataset.openGui)];
    if (!lib.openDefaultGui(d, d.name)) b.textContent = 'Open the store inside the OS to open panels';
  }));
}
