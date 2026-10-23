---
'@kubb-labs/action': patch
---

Install `tsdown` with `@kubb/cli` and `@kubb/studio` when the action falls back to `npx`. Newer `@kubb/studio` versions no longer install `tsdown`, which `kubb studio snapshot` needs.
