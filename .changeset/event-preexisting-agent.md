---
'@kubb-labs/action': patch
---

Fix the snapshot comment telling a pull request to "Run this workflow on pushes to `main`" even when that workflow already runs there and a CI agent for `main` exists — it just has no snapshot of this package yet, such as a package newly added in the pull request. The comment now says "No snapshot of `main` for this package yet" in that case, and keeps the original wording only when no agent for the base branch has run at all.
