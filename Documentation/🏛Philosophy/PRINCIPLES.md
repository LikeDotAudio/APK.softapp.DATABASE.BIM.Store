# Principles — DATABASE.BIM.Store

1. **The server is the vocabulary.** Departments, makers, connectors, classes, rack heights and every count come from `/stats`, `/facets` and `/makers`; the page lists no device and no maker of its own (`js/app.js`). The only local table is a glyph per department (`departmentIcon` in `js/logic.js`), and a department it does not name still gets one.
2. **Unknown is absent.** A part leaves out what nobody knows; the store prints nothing for it, never `0` (`fmtNum`, `specSections` in `js/logic.js`, tested in `tests/logic.test.mjs`).
3. **No prices.** The library describes the metal, not the deal; the store has no price field, cart or checkout.
4. **A view is a link.** Every view, filter, sort, page and layout is in the hash (`parseHash` / `buildHash`), and `buildHash` leaves defaults out so equal views give equal links.
5. **A picture always.** A part without a photo shows its front panel drawn in mm (`.svg`); a photo that fails to load falls back to the same drawing (`cardImage`, the error listener in `js/app.js`).
6. **Pure logic is tested.** Everything that is not DOM or fetch lives in `js/logic.js` and is held by `node --test`.
