# Known gaps — DATABASE.BIM.Store

Found while building against `DATABASE.server.BIM` on 2026-11-04 (18,413 parts).

- **Facets cap.** `/facets` returns at most 400 makers and 60 of every other facet (`store.py` `facets`), so "Show all" on Connector or Class is not every value; the facet search box only searches what came back.
- **No facet labels beyond makers.** Connector, class and stage values arrive without labels; the store prints them as they are.
- **Maker records are thin.** Most `_maker.json` files carry only `id` and `name`; icon, sector, aka and portal show only where present. Portal entries that are not URLs (e.g. `certification` text) are not shown.
- **Photo hotlinks.** Many maker photo URLs refuse to load off-site; the card falls back to the panel drawing.
