// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
//
// THE STORE'S PURE LOGIC — no DOM, no fetch, so `node --test` can hold it.
//
//   hash  ⇄ state      #/catalog?category=Audio&maker=q-sys,shure&sort=name&page=2&layout=list
//   state → API query  /parts?category=Audio&maker=q-sys,shure&sort=name&offset=48&limit=48
//   part  → rows       the spec table, the grouped ports, the maker's portal links
//
// The server (DATABASE.server.BIM, SRC/bim/server.py) is the contract: its
// multi-value filters are comma-joined, its flags are `=1`, and an unknown
// field is ABSENT — so every formatter here prints nothing rather than 0.

/** The multi-value filters the server splits on commas (server.py MULTI). */
export const MULTI = ['maker', 'category', 'class', 'stage', 'connector', 'ru'];
/** The yes/no filters (server.py `has_image`, `has_ports`). */
export const FLAGS = ['has_image', 'has_ports'];
/** The sorts the server knows (store.py Library.SORTS). */
export const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'name', label: 'Maker & model' },
  { value: 'model', label: 'Model' },
  { value: 'ports', label: 'Most ports' },
  { value: 'ru', label: 'Rack height' },
  { value: 'updated', label: 'Recently updated' },
];
export const PAGE_SIZE = 48;
export const VIEWS = ['home', 'catalog', 'part', 'maker', 'makers'];

/** A department's tile glyph. A department the table does not name still gets one. */
const DEPARTMENT_ICON = {
  Audio: '🎛️', Microphones: '🎙️', Video: '🎬', Network: '🌐', Control: '🕹️', Power: '🔌',
  Infrastructure: '🗄️', 'Test & Measurement': '📈', Computing: '💻', Accessories: '🧰', Other: '📦',
};
export function departmentIcon(category) {
  return DEPARTMENT_ICON[category] || '📦';
}

export function emptyFilters() {
  const f = { q: '' };
  for (const k of MULTI) f[k] = [];
  for (const k of FLAGS) f[k] = false;
  return f;
}

function splitList(raw) {
  return String(raw || '').split(',').map((v) => v.trim()).filter(Boolean);
}

function isTrue(raw) {
  return ['1', 'true', 'yes'].includes(String(raw || '').toLowerCase());
}

/** Read filters (and sort/page/layout) off a URLSearchParams-like query string. */
export function filtersFromQuery(query) {
  const params = new URLSearchParams(query || '');
  const filters = emptyFilters();
  filters.q = (params.get('q') || '').trim();
  for (const k of MULTI) filters[k] = [...new Set(params.getAll(k).flatMap(splitList))];
  for (const k of FLAGS) filters[k] = isTrue(params.get(k));
  const sort = params.get('sort');
  const page = parseInt(params.get('page') || '1', 10);
  return {
    filters,
    sort: SORTS.some((s) => s.value === sort) ? sort : 'featured',
    page: Number.isFinite(page) && page > 0 ? page : 1,
    layout: params.get('layout') === 'list' ? 'list' : 'grid',
  };
}

/** The filter part of a query, in a fixed key order so equal states give equal strings. */
export function filtersToParams(filters, { skip = [] } = {}) {
  const params = new URLSearchParams();
  const f = filters || {};
  if (f.q && f.q.trim()) params.set('q', f.q.trim());
  for (const k of MULTI) {
    if (skip.includes(k)) continue;
    const values = (f[k] || []).filter(Boolean);
    if (values.length) params.set(k, values.join(','));
  }
  for (const k of FLAGS) if (f[k]) params.set(k, '1');
  return params;
}

/**
 * Parse a location hash into a view state.
 *   #/                      home
 *   #/catalog?…             catalog with filters
 *   #/maker/<slug>?…        a maker's page + its catalog
 *   #/makers?q=…            every maker
 *   #/part/<maker>/<model>  a product page
 */
export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#!?/, '').replace(/^\/+/, '');
  const qAt = raw.indexOf('?');
  const path = (qAt >= 0 ? raw.slice(0, qAt) : raw).split('/').filter(Boolean).map(safeDecode);
  const query = qAt >= 0 ? raw.slice(qAt + 1) : '';
  const base = filtersFromQuery(query);
  const state = { view: 'home', id: null, maker: null, ...base };
  if (path[0] === 'catalog') state.view = 'catalog';
  else if (path[0] === 'makers') state.view = 'makers';
  else if (path[0] === 'maker' && path[1]) {
    state.view = 'maker';
    state.maker = path[1];
  } else if (path[0] === 'part' && path[1] && path[2]) {
    state.view = 'part';
    state.id = `${path[1]}/${path[2]}`;
  }
  return state;
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** The hash for a view state — the inverse of parseHash for every field it reads. */
export function buildHash(state) {
  const s = state || {};
  const view = VIEWS.includes(s.view) ? s.view : 'home';
  if (view === 'part' && s.id) {
    const [maker, model] = String(s.id).split('/');
    return `#/part/${encodeURIComponent(maker)}/${encodeURIComponent(model || '')}`;
  }
  if (view === 'home') return '#/';
  const params = view === 'makers'
    ? new URLSearchParams(s.filters && s.filters.q ? { q: s.filters.q } : {})
    : filtersToParams(s.filters, { skip: view === 'maker' ? ['maker'] : [] });
  if (view !== 'makers') {
    if (s.sort && s.sort !== 'featured') params.set('sort', s.sort);
    if (s.page && s.page > 1) params.set('page', String(s.page));
    if (s.layout === 'list') params.set('layout', 'list');
  }
  const qs = params.toString();
  const path = view === 'maker' ? `maker/${encodeURIComponent(s.maker || '')}` : view;
  return `#/${path}${qs ? `?${qs}` : ''}`;
}

/** The filters a view actually asks the server for (a maker page pins its maker). */
export function effectiveFilters(state) {
  const f = { ...emptyFilters(), ...(state.filters || {}) };
  if (state.view === 'maker' && state.maker) f.maker = [state.maker];
  return f;
}

/** `/parts?…` for one page of a view. */
export function partsQuery(state, pageSize = PAGE_SIZE) {
  const params = filtersToParams(effectiveFilters(state));
  params.set('sort', state.sort || 'featured');
  params.set('offset', String(Math.max(0, ((state.page || 1) - 1) * pageSize)));
  params.set('limit', String(pageSize));
  return `/parts?${params}`;
}

/** `/facets?…` for the left rail. */
export function facetsQuery(state) {
  const qs = filtersToParams(effectiveFilters(state)).toString();
  return `/facets${qs ? `?${qs}` : ''}`;
}

/** Add or remove one value of a multi filter; any change returns to page 1. */
export function toggleFilter(state, key, value) {
  const filters = { ...emptyFilters(), ...state.filters };
  if (FLAGS.includes(key)) filters[key] = !filters[key];
  else if (MULTI.includes(key)) {
    const have = new Set(filters[key]);
    if (have.has(value)) have.delete(value); else have.add(value);
    filters[key] = [...have];
  }
  return { ...state, filters, page: 1 };
}

/** Every active filter as a removable chip: {key, value, label}. */
export function activeChips(filters, labels = {}) {
  const out = [];
  const f = filters || {};
  if (f.q) out.push({ key: 'q', value: f.q, label: `“${f.q}”` });
  for (const k of MULTI) {
    for (const v of f[k] || []) {
      const label = (labels[k] && labels[k][v]) || (k === 'ru' ? `${v} RU` : v);
      out.push({ key: k, value: v, label });
    }
  }
  if (f.has_image) out.push({ key: 'has_image', value: '1', label: 'Has photo' });
  if (f.has_ports) out.push({ key: 'has_ports', value: '1', label: 'Has ports' });
  return out;
}

export function removeChip(state, chip) {
  if (chip.key === 'q') return { ...state, filters: { ...state.filters, q: '' }, page: 1 };
  return toggleFilter(state, chip.key, chip.value);
}

// ---- the API base ---------------------------------------------------------

export const DEFAULT_API = '/api/bim';
export const API_STORAGE_KEY = 'apk.bim.store.api';

/**
 * Which server to read. `?api=<url>` wins and is remembered; `?api=` (empty)
 * forgets the remembered one; otherwise the remembered one; else same-origin.
 * Returns {base, remember} — `remember` is the value to store (null = clear,
 * undefined = leave storage alone).
 */
export function resolveApiBase(search, stored) {
  const params = new URLSearchParams(search || '');
  if (params.has('api')) {
    const given = (params.get('api') || '').trim();
    if (!given) return { base: DEFAULT_API, remember: null };
    return { base: trimSlash(given), remember: trimSlash(given) };
  }
  if (stored && String(stored).trim()) return { base: trimSlash(String(stored).trim()), remember: undefined };
  return { base: DEFAULT_API, remember: undefined };
}

function trimSlash(url) {
  return String(url).replace(/\/+$/, '');
}

/** The URL of a part or one of its derived views (.svg .ifc .oca .json). */
export function partUrl(base, id, ext = '') {
  const [maker, model] = String(id).split('/');
  return `${trimSlash(base)}/parts/${encodeURIComponent(maker)}/${encodeURIComponent(model || '')}${ext}`;
}

/** The picture for a card: the maker's photo, else the front-panel drawing. */
export function cardImage(summary, base) {
  const panel = partUrl(base, summary.id, '.svg');
  return summary.image ? { src: summary.image, fallback: panel, kind: 'photo' } : { src: panel, fallback: '', kind: 'panel' };
}

/** Where the Device editor opens this part (a sibling softapp, relative so any mount works). */
export function editorUrl(id) {
  return `../../EDITORS/EDITORS.Device/index.html?part=${encodeURIComponent(id)}`;
}

// ---- formatting -----------------------------------------------------------

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** A number for people: 1234 → "1,234"; absent stays absent (empty string). */
export function fmtNum(n, digits = 2) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function fmtUnit(n, unit, digits = 2) {
  const s = fmtNum(n, digits);
  return s ? `${s} ${unit}` : '';
}

export function ruLabel(ru) {
  const s = fmtNum(ru, 2);
  return s ? `${s}U` : '';
}

export function isStub(summary) {
  return (summary && summary.stage) === 'stub';
}

/** What a card prints: title, maker line, badges. */
export function cardFacts(summary) {
  const s = summary || {};
  const badges = [];
  if (s.rack_units) badges.push({ kind: 'ru', text: ruLabel(s.rack_units) });
  if (s.port_count) badges.push({ kind: 'ports', text: `${fmtNum(s.port_count, 0)} port${s.port_count === 1 ? '' : 's'}` });
  if (isStub(s)) badges.push({ kind: 'stub', text: 'stub' });
  return {
    title: s.model || s.name || s.id || '',
    maker: s.manufacturer || s.maker || '',
    sub: [s.category, s.class].filter(Boolean).join(' · '),
    badges,
    connectors: (s.connectors || []).slice(0, 6),
    moreConnectors: Math.max(0, (s.connectors || []).length - 6),
  };
}

/** The spec table: [{section, rows:[[label, value]]}], only the fields the part has. */
export function specSections(part) {
  const p = part || {};
  const phys = p.physical || {};
  const power = p.power || {};
  const sections = [];
  const ident = [
    ['Manufacturer', p.manufacturer],
    ['Model', p.model],
    ['Part number', p.part_number],
    ['Department', p.category],
    ['Class', p.class],
    ['Data', p.stage === 'stub' ? 'stub — name only, no measurements yet' : (p.stage === 'declared' ? 'fully described' : p.stage)],
  ];
  sections.push({ section: 'Identity', rows: ident.filter(([, v]) => v) });
  const physical = [
    ['Rack units', ruLabel(phys.rack_units)],
    ['Width', fmtUnit(phys.width_mm, 'mm')],
    ['Height', fmtUnit(phys.height_mm, 'mm')],
    ['Depth', fmtUnit(phys.depth_mm, 'mm')],
    ['Weight', fmtUnit(phys.weight_kg, 'kg', 3)],
    ['Mount', phys.mount],
  ];
  sections.push({ section: 'Physical', rows: physical.filter(([, v]) => v) });
  const pw = [
    ['Power', fmtUnit(power.watts, 'W', 1)],
    ['Heat', fmtUnit(power.btu_hr, 'BTU/hr', 0)],
    ['Voltage', fmtUnit(power.voltage_v, 'V', 1)],
    ['Current', fmtUnit(power.current_a, 'A', 3)],
  ];
  sections.push({ section: 'Power & heat', rows: pw.filter(([, v]) => v) });
  for (const [name, block] of Object.entries(p.ext || {})) {
    const rows = flatRows(block);
    if (rows.length) sections.push({ section: titleCase(name.replace(/_/g, ' ')), rows });
  }
  return sections.filter((s) => s.rows.length);
}

function flatRows(obj, prefix = '') {
  const rows = [];
  if (!obj || typeof obj !== 'object') return rows;
  for (const [k, v] of Object.entries(obj)) {
    const label = prefix + titleCase(k.replace(/_/g, ' '));
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      if (v.every((x) => typeof x !== 'object')) rows.push([label, v.join(', ')]);
      else rows.push([label, `${v.length} item${v.length === 1 ? '' : 's'}`]);
    } else if (typeof v === 'object') rows.push(...flatRows(v, `${label} · `));
    else rows.push([label, typeof v === 'number' ? fmtNum(v, 3) : String(v)]);
  }
  return rows;
}

function titleCase(s) {
  return String(s).replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/**
 * Ports grouped for the table: by `block` (the panel section, "Video") when the
 * part has one, else by `group` ("Mic In"), else by side — each with its total.
 * A row keeps its own `group` as its name when the block is the heading.
 */
export function groupPorts(ports) {
  const groups = new Map();
  for (const port of ports || []) {
    const name = port.block || port.group || titleCase(port.side || 'Ports');
    if (!groups.has(name)) groups.set(name, { group: name, total: 0, rows: [] });
    const g = groups.get(name);
    const count = Number.isInteger(port.count) && port.count > 0 ? port.count : 1;
    g.total += count;
    g.rows.push({
      name: port.block && port.group ? port.group : '',
      connector: port.connector || '',
      signal: port.signal || '',
      direction: port.side || '',
      domain: port.domain || '',
      face: port.face || '',
      count,
      labels: Array.isArray(port.labels) ? port.labels : [],
    });
  }
  return [...groups.values()];
}

export function portTotal(ports) {
  return (ports || []).reduce((n, p) => n + (Number.isInteger(p.count) && p.count > 0 ? p.count : 1), 0);
}

/** Documents a part links to: manuals and the product page, as {label, url}. */
export function documentLinks(part) {
  const media = (part && part.media) || {};
  const out = [];
  if (media.product_page) out.push({ label: 'Product page', url: media.product_page, kind: 'page' });
  for (const m of media.manuals || []) {
    if (m && m.url) out.push({ label: titleCase(m.type || 'manual'), url: m.url, kind: 'manual' });
  }
  return out;
}

/** Gallery: photos first, the panel drawing always last. */
export function galleryImages(part, base) {
  const images = ((part && part.media && part.media.images) || [])
    .filter((i) => i && i.url)
    .map((i) => ({ src: i.url, label: titleCase(i.view || 'photo'), kind: 'photo' }));
  images.push({ src: partUrl(base, part.id, '.svg'), label: 'Front panel (mm)', kind: 'panel' });
  return images;
}

/**
 * A maker's portal links, whatever shape the record keeps them in:
 * a URL string, a list of strings / {label,url}, or an object {label: url}.
 */
export function portalLinks(portal) {
  if (!portal) return [];
  if (typeof portal === 'string') return [{ label: hostOf(portal) || 'Website', url: portal }];
  if (Array.isArray(portal)) return portal.flatMap((p) => portalLinks(p));
  if (typeof portal === 'object') {
    if (portal.url && typeof portal.url === 'string') return [{ label: portal.label || portal.name || hostOf(portal.url), url: portal.url }];
    return Object.entries(portal)
      .filter(([, v]) => typeof v === 'string' && /^https?:/i.test(v))
      .map(([k, v]) => ({ label: titleCase(k.replace(/_/g, ' ')), url: v }));
  }
  return [];
}

function hostOf(url) {
  const m = /^https?:\/\/([^/]+)/i.exec(String(url));
  return m ? m[1].replace(/^www\./, '') : '';
}

/** Is this a link we may put in an href (http/https or a same-site path)? */
export function safeHref(url) {
  const s = String(url || '').trim();
  if (/^https?:\/\//i.test(s) || /^\/(?!\/)/.test(s) || /^\.\.?\//.test(s)) return s;
  return '';
}

// ---- paging ---------------------------------------------------------------

export function pageCount(total, size = PAGE_SIZE) {
  return Math.max(1, Math.ceil((total || 0) / size));
}

/** The page buttons to draw: numbers and '…' gaps, current page in the middle. */
export function pageWindow(page, pages, span = 2) {
  const out = [];
  const lo = Math.max(2, page - span);
  const hi = Math.min(pages - 1, page + span);
  out.push(1);
  if (lo > 2) out.push('…');
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < pages - 1) out.push('…');
  if (pages > 1) out.push(pages);
  return out;
}

/** "Showing 49–96 of 20,113". */
export function rangeLabel(offset, count, total) {
  if (!total) return 'No parts';
  return `Showing ${fmtNum(offset + 1, 0)}–${fmtNum(offset + count, 0)} of ${fmtNum(total, 0)}`;
}

// ---- errors ---------------------------------------------------------------

/** A sentence for a failed request, by status. Writes go through the gateway's bench credential. */
export function describeError(status, body, method = 'GET') {
  const said = body && typeof body === 'object' && body.error ? body.error : '';
  if (status === 0) return 'The BIM library could not be reached. Is DATABASE.server.BIM running? (Set ?api=<url> to point the store at another server.)';
  if (status === 401 || status === 403) {
    return method === 'GET'
      ? 'The gateway refused this read (it asked for a credential).'
      : 'Changing the library needs the bench credential: the gateway (WEB.Traffic-Router) refuses writes without it. Sign in when the browser asks, then try again.';
  }
  if (status === 404) return said || 'Not found in the library.';
  if (status === 409) return `The part's id does not match its address. ${said}`.trim();
  if (status === 422) return `The library would not save it: ${said || 'the part is not valid'}.`;
  if (status === 413) return said || 'That part is too big (the limit is 4 MB).';
  return said || `The library answered ${status}.`;
}
