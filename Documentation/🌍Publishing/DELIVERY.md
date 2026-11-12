# Delivery — DATABASE.BIM.Store

Nothing is built: the folder is served as it is.

| Destination | How |
|---|---|
| Launch Pad | `display.json` (`app`: `APK:Softapps/DATABASE/DATABASE.BIM.Store/index.html`), walked by WEB.OsApi |
| The page | served by WEB.Frontend-Assets, which carries the Softapps; after an edit run `up-stack.sh WEB.Frontend-Assets` |
| The data | `DATABASE.server.BIM` behind the gateway at `/api/bim` |
| Tests | `npm test` (`node --test tests/*.test.mjs`) |

## Delivered 2026-11-11 – 2026-11-12

From this repository's own commits (the commit message is the record):

- vendor: apk-contracts web bundle refreshed from contracts/generated/web (report.ts: LogLine + ProblemRecord, System/Problems family) (`8029624`)
- vendor/apk-softapp: re-vendored — every problem card is reported through the SDK (ROAD-3695 step 2) (`d1de381`)
- vendor: apk-contracts web bundle refreshed from contracts/generated/web (five report codes, ROAD-3695; unit-gate, ROAD-3684) (`5433e80`)
- re-vendor apk-contracts web bundle: contracts 2.4.0 retires APK.audio/Tests/{suite} (ROAD-3729) (`f0e3b74`)
- vendor: apk-contracts re-vendored (contracts gained the youtube_audio problem codes, root f013ba68a) (`185669d`)
- vendor/apk-contracts: refresh to contracts/generated/web after ROAD-3759 (contracts split; CHAT_TOPIC origin note) (`67e8c6d`)
- vendor: apk-softapp / apk-table re-joined from their parts (one GENERATED banner line; ROAD-3762) (`785f627`)

## Releases
- **Released `2.0.0`, tag `v2.0.0`** (2026-11-05, ROAD-3452, the owner's V2) — no SDK pin; every manifest says 2.0.0; GitHub release `v2.0.0`.
