# Architecture — DATABASE.BIM.Store

```
index.html ── js/app.js ──┬── js/logic.js   pure: hash ⇄ state, queries, formatting, paging, errors
                          └── js/api.js     fetch → JSON, ApiError(status, sentence), GET cache
                                   │
                                   ▼
             DATABASE.server.BIM  /api/bim/{stats,facets,parts,makers,schema}
                                  /api/bim/parts/<maker>/<model>[.svg|.ifc|.json]
```

- **Routing.** `hashchange` → `render()` → `parseHash(location.hash)` → one of `renderHome`, `renderCatalog` (also the maker page, with the maker pinned), `renderMakers`, `renderPart`. A render token drops answers that arrive after the visitor has moved on.
- **Catalogue.** One `/parts?…&offset&limit=48` and one `/facets?…` per view. Facets are counted by the server with every *other* filter applied, so a ticked maker still shows its siblings. A ticked value the counts no longer list stays shown so it can be unticked.
- **Product.** `/parts/<id>` first; the maker record and a "more from this maker" shelf follow without blocking. Ports are grouped by `block` (the panel section), else `group`, else side. Downloads fetch to a blob so the file gets a proper name, falling back to opening the URL.
- **API base.** `resolveApiBase(location.search, localStorage)` — `?api=` wins and is remembered; storage access is wrapped so a blocked store still works.
- **Writes.** `PUT`/`DELETE` through `api.save` / `api.remove`; errors are sentences from `describeError` (401 → the bench credential).
