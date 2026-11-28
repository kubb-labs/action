---
'@kubb-labs/action': patch
---

When a pull request closes, the action deletes its CI agent through Studio's public API without asking Studio for the address: `DELETE /v1/agents` on the `KUBB_STUDIO_URL` host with `api.` in front, so `https://kubb.studio` uses `https://api.kubb.studio` and `https://dev.kubb.studio` uses `https://api.dev.kubb.studio`. A Studio on `localhost` takes it on its own origin.
