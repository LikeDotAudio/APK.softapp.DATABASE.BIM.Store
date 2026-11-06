// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseHash, buildHash, partsQuery, facetsQuery, toggleFilter, activeChips, removeChip,
  emptyFilters, resolveApiBase, partUrl, cardImage, cardFacts, specSections, groupPorts,
  portTotal, documentLinks, galleryImages, portalLinks, safeHref, editorUrl, escapeHtml,
  fmtNum, fmtUnit, ruLabel, pageCount, pageWindow, rangeLabel, describeError, filtersFromQuery,
  PAGE_SIZE,
} from '../js/logic.js';

test('an empty hash is the storefront', () => {
  for (const h of ['', '#', '#/', '#!/']) assert.equal(parseHash(h).view, 'home');
  assert.equal(buildHash({ view: 'home' }), '#/');
});

test('catalog hash round-trips filters, sort, page and layout', () => {
  const s = parseHash('#/catalog?q=xlr%201u&category=Audio,Test%20%26%20Measurement&maker=q-sys&maker=shure&ru=1&has_image=1&sort=name&page=3&layout=list');
  assert.equal(s.view, 'catalog');
  assert.equal(s.filters.q, 'xlr 1u');
  assert.deepEqual(s.filters.category, ['Audio', 'Test & Measurement']);
  assert.deepEqual(s.filters.maker, ['q-sys', 'shure']);
  assert.deepEqual(s.filters.ru, ['1']);
  assert.equal(s.filters.has_image, true);
  assert.equal(s.filters.has_ports, false);
  assert.equal(s.sort, 'name');
  assert.equal(s.page, 3);
  assert.equal(s.layout, 'list');
  const again = parseHash(buildHash(s));
  assert.deepEqual(again, s);
});

test('defaults are left out of the hash so equal views give equal links', () => {
  assert.equal(buildHash({ view: 'catalog', filters: emptyFilters(), sort: 'featured', page: 1, layout: 'grid' }), '#/catalog');
});

test('junk sort/page/layout fall back to the defaults', () => {
  const s = filtersFromQuery('sort=price&page=-4&layout=table');
  assert.equal(s.sort, 'featured');
  assert.equal(s.page, 1);
  assert.equal(s.layout, 'grid');
});

test('part and maker hashes', () => {
  const p = parseHash('#/part/q-sys/core-110f-dsp');
  assert.equal(p.view, 'part');
  assert.equal(p.id, 'q-sys/core-110f-dsp');
  assert.equal(buildHash(p), '#/part/q-sys/core-110f-dsp');
  const m = parseHash('#/maker/shure?category=Microphones');
  assert.equal(m.view, 'maker');
  assert.equal(m.maker, 'shure');
  assert.deepEqual(m.filters.category, ['Microphones']);
  // the maker page pins its maker, so the hash does not repeat it
  assert.equal(buildHash({ ...m, filters: { ...m.filters, maker: ['shure'] } }), '#/maker/shure?category=Microphones');
  assert.equal(parseHash('#/part/only-maker').view, 'home');
});

test('API queries comma-join multi filters and page by offset', () => {
  const s = parseHash('#/catalog?maker=a,b&connector=XLR&has_ports=1&page=2&sort=ports');
  assert.equal(partsQuery(s), `/parts?maker=a%2Cb&connector=XLR&has_ports=1&sort=ports&offset=${PAGE_SIZE}&limit=${PAGE_SIZE}`);
  assert.equal(facetsQuery(s), '/facets?maker=a%2Cb&connector=XLR&has_ports=1');
  assert.equal(facetsQuery(parseHash('#/catalog')), '/facets');
  const m = parseHash('#/maker/shure');
  assert.match(partsQuery(m), /maker=shure/);
  assert.equal(facetsQuery(m), '/facets?maker=shure');
});

test('toggling a filter adds, removes and goes back to page 1', () => {
  let s = parseHash('#/catalog?page=4');
  s = toggleFilter(s, 'category', 'Video');
  assert.deepEqual(s.filters.category, ['Video']);
  assert.equal(s.page, 1);
  s = toggleFilter(s, 'category', 'Audio');
  s = toggleFilter(s, 'category', 'Video');
  assert.deepEqual(s.filters.category, ['Audio']);
  s = toggleFilter(s, 'has_image');
  assert.equal(s.filters.has_image, true);
  s = toggleFilter(s, 'nonsense', 'x');
  assert.deepEqual(Object.keys(s.filters).sort(), Object.keys(emptyFilters()).sort());
});

test('active chips name what is picked and remove it', () => {
  const s = parseHash('#/catalog?q=dante&maker=q-sys&ru=2&has_image=1');
  const chips = activeChips(s.filters, { maker: { 'q-sys': 'Q-SYS' } });
  assert.deepEqual(chips.map((c) => c.label), ['“dante”', 'Q-SYS', '2 RU', 'Has photo']);
  const after = removeChip(s, chips[0]);
  assert.equal(after.filters.q, '');
  assert.deepEqual(removeChip(s, chips[1]).filters.maker, []);
});

test('the API base: ?api= wins and is remembered, empty forgets, else stored, else same-origin', () => {
  assert.deepEqual(resolveApiBase('?api=http://127.0.0.1:8150/api/bim/', null), { base: 'http://127.0.0.1:8150/api/bim', remember: 'http://127.0.0.1:8150/api/bim' });
  assert.deepEqual(resolveApiBase('?api=', 'http://x/api/bim'), { base: '/api/bim', remember: null });
  assert.deepEqual(resolveApiBase('', 'http://x/api/bim'), { base: 'http://x/api/bim', remember: undefined });
  assert.deepEqual(resolveApiBase('', null), { base: '/api/bim', remember: undefined });
});

test('part URLs and the card picture fall back to the panel drawing', () => {
  assert.equal(partUrl('/api/bim/', 'q-sys/core-110f', '.ifc'), '/api/bim/parts/q-sys/core-110f.ifc');
  assert.equal(partUrl('', 'a/b'), '/parts/a/b');
  assert.deepEqual(cardImage({ id: 'a/b', image: null }, '/api/bim'), { src: '/api/bim/parts/a/b.svg', fallback: '', kind: 'panel' });
  assert.deepEqual(cardImage({ id: 'a/b', image: 'https://x/p.jpg' }, '/api/bim'), { src: 'https://x/p.jpg', fallback: '/api/bim/parts/a/b.svg', kind: 'photo' });
  assert.equal(editorUrl('q-sys/core-110f'), '../../EDITORS/EDITORS.Device/index.html?part=q-sys%2Fcore-110f');
});

test('card facts: RU badge, port count, stub badge, connector overflow', () => {
  const f = cardFacts({ id: 'a/b', manufacturer: 'A', model: 'B', category: 'Audio', class: 'DSP', stage: 'stub', rack_units: 1, port_count: 12, connectors: ['1', '2', '3', '4', '5', '6', '7', '8'] });
  assert.deepEqual(f.badges.map((b) => b.text), ['1U', '12 ports', 'stub']);
  assert.equal(f.sub, 'Audio · DSP');
  assert.equal(f.connectors.length, 6);
  assert.equal(f.moreConnectors, 2);
  assert.deepEqual(cardFacts({ id: 'a/b', port_count: 1 }).badges.map((b) => b.text), ['1 port']);
  assert.deepEqual(cardFacts({ id: 'a/b', port_count: 0 }).badges, []);
});

test('unknown is absent: formatters print nothing, never 0', () => {
  assert.equal(fmtNum(undefined), '');
  assert.equal(fmtNum(null), '');
  assert.equal(fmtNum(1234.567), '1,234.57');
  assert.equal(fmtUnit(undefined, 'mm'), '');
  assert.equal(fmtUnit(482.6, 'mm'), '482.6 mm');
  assert.equal(ruLabel(2), '2U');
  assert.equal(ruLabel(undefined), '');
});

test('spec sections keep only what the part has, ext blocks included', () => {
  const part = {
    id: 'a/b', manufacturer: 'A', model: 'B', category: 'Audio', stage: 'declared',
    physical: { rack_units: 1, width_mm: 482.6, height_mm: 44.45, weight_kg: 4.1 },
    power: { watts: 120, btu_hr: 409 },
    ext: { patch_panel: { normalling: 'half', rows: 2, labels: ['a', 'b'] } },
  };
  const s = specSections(part);
  assert.deepEqual(s.map((x) => x.section), ['Identity', 'Physical', 'Power & heat', 'Patch Panel']);
  const phys = Object.fromEntries(s[1].rows);
  assert.equal(phys.Width, '482.6 mm');
  assert.equal(phys.Depth, undefined);
  assert.equal(Object.fromEntries(s[2].rows).Heat, '409 BTU/hr');
  assert.equal(Object.fromEntries(s[3].rows).Labels, 'a, b');
  assert.deepEqual(specSections({ id: 'x/y', model: 'Y' }).map((x) => x.section), ['Identity']);
});

test('ports group by group, else by side, with totals', () => {
  const ports = [
    { group: 'Mic In', side: 'input', connector: 'XLR-3F', signal: 'mic', domain: 'audio', count: 8 },
    { group: 'Mic In', side: 'input', connector: 'TRS', count: 2 },
    { side: 'supply', connector: 'IEC C14', domain: 'power' },
  ];
  const g = groupPorts(ports);
  assert.deepEqual(g.map((x) => [x.group, x.total]), [['Mic In', 10], ['Supply', 1]]);
  assert.equal(g[0].rows[0].direction, 'input');
  assert.equal(portTotal(ports), 11);
  assert.deepEqual(groupPorts(undefined), []);
  const blocks = groupPorts([
    { block: 'Video', group: 'INPUT 1', side: 'input', connector: 'HDMI', count: 1 },
    { block: 'Video', group: 'INPUT 2', side: 'input', connector: 'HDMI', count: 1 },
    { block: 'Networking-Control', group: 'LAN', side: 'input', connector: 'RJ45', count: 1 },
  ]);
  assert.deepEqual(blocks.map((x) => [x.group, x.total]), [['Video', 2], ['Networking-Control', 1]]);
  assert.equal(blocks[0].rows[1].name, 'INPUT 2');
  assert.equal(g[0].rows[0].name, '');
});

test('documents, gallery and maker portal links', () => {
  const part = { id: 'a/b', media: { product_page: 'https://a.com/b', manuals: [{ type: 'user manual', url: 'https://a.com/b.pdf' }, { type: 'x' }], images: [{ view: 'front', url: 'https://a.com/b.jpg' }] } };
  assert.deepEqual(documentLinks(part).map((d) => d.label), ['Product page', 'User Manual']);
  const gal = galleryImages(part, '/api/bim');
  assert.deepEqual(gal.map((g) => g.kind), ['photo', 'panel']);
  assert.equal(gal[1].src, '/api/bim/parts/a/b.svg');
  assert.deepEqual(portalLinks('https://www.shure.com/x'), [{ label: 'shure.com', url: 'https://www.shure.com/x' }]);
  assert.deepEqual(portalLinks({ support: 'https://s.com', downloads: 'https://d.com', note: 'n/a' }).map((l) => l.label), ['Support', 'Downloads']);
  assert.deepEqual(portalLinks([{ label: 'Docs', url: 'https://d.com' }, 'https://e.com']).map((l) => l.label), ['Docs', 'e.com']);
  assert.deepEqual(portalLinks(null), []);
});

test('only safe hrefs and escaped text reach the page', () => {
  assert.equal(safeHref('javascript:alert(1)'), '');
  assert.equal(safeHref('//evil.example'), '');
  assert.equal(safeHref('https://ok.example'), 'https://ok.example');
  assert.equal(safeHref('/api/bim/x'), '/api/bim/x');
  assert.equal(escapeHtml('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  assert.equal(escapeHtml(undefined), '');
});

test('paging', () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(97, 48), 3);
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(10, 40), [1, '…', 8, 9, 10, 11, 12, '…', 40]);
  assert.equal(rangeLabel(48, 48, 20113), 'Showing 49–96 of 20,113');
  assert.equal(rangeLabel(0, 0, 0), 'No parts');
});

test('errors read as sentences; a refused write names the bench credential', () => {
  assert.match(describeError(401, null, 'PUT'), /bench credential/);
  assert.match(describeError(401, null, 'DELETE'), /gateway/);
  assert.match(describeError(0, null), /could not be reached/);
  assert.match(describeError(422, { error: 'model is required' }, 'PUT'), /model is required/);
  assert.equal(describeError(404, { error: 'no part a/b' }), 'no part a/b');
  assert.equal(describeError(500, null), 'The library answered 500.');
});

test('the Concepts department has its own tile glyph', async () => {
  const { departmentIcon } = await import('../js/logic.js');
  assert.equal(departmentIcon('Concepts'), '💡');
});
