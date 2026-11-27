---
'@kubb-labs/action': patch
---

When a pull request closes, the action deletes its CI agent through Kubb Studio's public API, `DELETE /v1/agents` on `api.kubb.studio`, when the Studio reports one in `GET /api/settings`. Without one, or when that lookup fails, it calls `DELETE /api/agents` as before.
