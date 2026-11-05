# 🏬 BIM Store (`DATABASE.BIM.Store`)

> **Type**: Softapp — static HTML/CSS/ES modules, no build step, no runtime dependencies.
> **Opens at**: `APK:Softapps/DATABASE/DATABASE.BIM.Store/index.html` ([display.json](display.json))
> **Reads**: `DATABASE.server.BIM` (`PODS/POD.database/DATABASE.server.BIM`) at `/api/bim`

The BIM device library shown as a web store: a storefront, a faceted catalogue, product
pages and maker pages over every `apk.bim.part/1` part the library holds. There are no prices,
because the library keeps none.

| View | Hash | What it shows |
|---|---|---|
| Storefront | `#/` | hero search, departments with counts, a Featured shelf (parts with photos first), browse by maker, recently updated |
| Catalogue | `#/catalog?q=&category=&maker=&connector=&ru=&class=&stage=&has_image=1&has_ports=1&sort=&page=&layout=list` | left rail of facet checkboxes with counts (maker, connector and class each have a search box), sort, grid/list, pages |
| Maker | `#/maker/<maker>?…` | the maker's header (icon, sector, aka, portal links) and that maker's catalogue |
| Makers | `#/makers` | every maker, searchable |
| Product | `#/part/<maker>/<model>` | gallery (photos + the front panel drawn in mm), spec table (mm, kg, W, BTU/hr, ext blocks), ports grouped by panel block, manuals and product page, IFC/JSON/SVG downloads, Edit in Device Editor, maker card, more from this maker |

Every view is a hash, so a view is a link and the back button walks them.

## Pointing it at a library

Same-origin `/api/bim` by default (the gateway forwards it to the container). For a hand-run
server, open the page once with `?api=http://127.0.0.1:8150/api/bim`; the choice is remembered in
`localStorage` (`apk.bim.store.api`), and `?api=` with no value forgets it.

```sh
cd PODS/POD.database/DATABASE.server.BIM/SRC && python3 -m bim.server --library library --port 8150
cd PODS/POD.THIN/Softapps && python3 -m http.server 8761
# http://127.0.0.1:8761/DATABASE/DATABASE.BIM.Store/index.html?api=http://127.0.0.1:8150/api/bim
```

## Writes

The product page's **Manage** box can edit a part's JSON (`PUT`) or delete it (`DELETE`). The
gateway refuses writes without the bench credential; a 401 is shown as that sentence rather than
a status code. Port and panel editing belongs in the Device Editor, which the product page links
(`../../EDITORS/EDITORS.Device/index.html?part=<id>`).

## Files

| Path | What |
|---|---|
| `index.html` | the shell: top bar, `#app`, the JSON dialog |
| `css/store.css` | the dark ground with the `#F4902C` accent |
| `js/logic.js` | pure logic — hash ⇄ state, API query strings, spec/port/link formatting, paging, error sentences |
| `js/api.js` | the only file that fetches |
| `js/app.js` | the views |
| `tests/` | `npm test` → `node --test tests/*.test.mjs` |

## 📚 Wiki
Principles, architecture and delivery: [Documentation/README.md](Documentation/README.md).

## On the bench — the device's own panel

A product page whose part has devices on the bench lists them (online, gone dark) from
`/api/bim/parts/<id>/live`, each with **▶ Open its panel**: the default GUI the device presents on the bus,
opened in the OS shell through the shared picker module's `openDefaultGui`. Outside the OS it names the panel.

<!-- wiki:smoke -->
**Smoke test** — ✅ PASS 2/2 since 2026-11-04 21:31 EST — [results](Documentation/%F0%9F%A7%A9Manual%20and%20Artifacts/SMOKE.md)
<!-- /wiki:smoke -->
