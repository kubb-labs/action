# @kubb-labs/action

## 0.3.1

### Patch Changes

- 32baacf: Stop computing the CI agent id ourselves and let `kubb studio snapshot` detect it, and show the pull-request comment's changes since the previous snapshot when the CLI reports them (kubb-labs/kubb#4098): a summary line plus a collapsed file list (capped at 50 rows), and the new `files-added`, `files-changed`, `files-removed` outputs. With an older CLI or Studio, the comment is unchanged.

## 0.3.0

### Minor Changes

- e251edf: Run the shared `kubb studio snapshot` command instead of talking to Studio directly.

  - Delegates the agent, job, and polling logic to `kubb studio snapshot` (from `kubb-labs/kubb`), the same command any CI can run directly. This action now only owns the GitHub-specific parts: the init pull request and the snapshot comment.
  - Resolves `kubb` from the repository's own `node_modules/.bin/kubb` first, falling back to `npx --package @kubb/cli --package @kubb/studio kubb` when the repository has no local install.
  - No change to the action's inputs or outputs.

## 0.2.1

### Patch Changes

- c469466: Create snapshots through Studio's async `/api/jobs` API instead of `POST /api/snapshots`.

## 0.2.0

### Minor Changes

- bc071ce: Connect to Kubb Studio directly with `@kubb/studio`'s client instead of spawning `npx kubb studio` as a subprocess, and wait for its `studio:ready` acknowledgement before requesting a snapshot.

  The action previously spawned the CLI and waited a fixed 3 seconds before asking Studio for a snapshot, guessing at when the agent would be registered. It now connects in-process and awaits the real readiness signal (with a 15-second timeout), so the snapshot request only fires once Studio has actually registered the connection.

### Patch Changes

- 81b1f6a: Bundle `@kubb/studio` and `jiti` into the GitHub Action output so the action can run without installing runtime dependencies.

## 0.1.0

### Minor Changes

- 7976118: Implement Kubb Studio snapshot publishing from GitHub Actions.
