# Delivery — DATABASE.BIM.Store

Nothing is built: the folder is served as it is.

| Destination | How |
|---|---|
| Launch Pad | `display.json` (`app`: `APK:Softapps/DATABASE/DATABASE.BIM.Store/index.html`), walked by WEB.OsApi |
| The page | served by WEB.Frontend-Assets, which carries the Softapps; after an edit run `up-stack.sh WEB.Frontend-Assets` |
| The data | `DATABASE.server.BIM` behind the gateway at `/api/bim` |
| Tests | `npm test` (`node --test tests/*.test.mjs`) |

## Releases
- **Released `2.0.0`, tag `v2.0.0`** (2026-11-05, ROAD-3452, the owner's V2) — no SDK pin; every manifest says 2.0.0; GitHub release `v2.0.0`.
