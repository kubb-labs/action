---
'@kubb-labs/action': patch
---

The action no longer asks Studio for its public API address. For the hosted Studio it deletes a pull request's CI agent with `DELETE https://api.kubb.studio/v1/agents`, and for any other `KUBB_STUDIO_URL` with `DELETE /api/agents`. Set `KUBB_STUDIO_API_URL` to use the `/v1` routes of another public API hostname.
