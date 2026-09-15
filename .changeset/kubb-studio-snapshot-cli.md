---
'@kubb-labs/action': minor
---

Run the shared `kubb studio snapshot` command instead of talking to Studio directly.

- Delegates the agent, job, and polling logic to `kubb studio snapshot` (from `kubb-labs/kubb`), the same command any CI can run directly. This action now only owns the GitHub-specific parts: the init pull request and the snapshot comment.
- Resolves `kubb` from the repository's own `node_modules/.bin/kubb` first, falling back to `npx --package @kubb/cli --package @kubb/studio kubb` when the repository has no local install.
- No change to the action's inputs or outputs.
