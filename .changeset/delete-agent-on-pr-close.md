---
'@kubb-labs/action': minor
---

Delete the pull request's Kubb Studio agent when the pull request closes. Add `closed` to the
workflow's `pull_request` types, since GitHub leaves it out by default. A failed delete only logs a
warning. This needs a Studio release that supports `DELETE /api/agents` with a CI API key.
