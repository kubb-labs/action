---
'@kubb-labs/action': patch
---

Run the `npx` fallback on Kubb 5.6.1, which publishes the snapshot in one request instead of connecting an agent and polling a job. Overlapping runs of one pull request no longer end each other's session, so workflows need no `concurrency` group for the action.
