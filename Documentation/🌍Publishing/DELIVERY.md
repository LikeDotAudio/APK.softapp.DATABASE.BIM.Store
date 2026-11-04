# Delivery — DATABASE.BIM.Store

Nothing is built: the folder is served as it is.

| Destination | How |
|---|---|
| Launch Pad | `display.json` (`app`: `APK:Softapps/DATABASE/DATABASE.BIM.Store/index.html`), walked by WEB.OsApi |
| The page | served by WEB.Frontend-Assets, which carries the Softapps; after an edit run `up-stack.sh WEB.Frontend-Assets` |
| The data | `DATABASE.server.BIM` behind the gateway at `/api/bim` |
| Tests | `npm test` (`node --test tests/*.test.mjs`) |
