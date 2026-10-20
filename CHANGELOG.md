# @kubb-labs/action

## 0.5.3

### Patch Changes

- 3a77750: Link pull-request snapshots directly to the read-only Studio editor and expose the URL through `editor-url`.

## 0.5.2

### Patch Changes

- 7ec5cb1: Make the pull-request comment easier to read: the changes since the previous snapshot say so instead of only naming a commit, zero counts are left out, the file list summary reads "Show N files", the package link says it downloads, and dates show without the time.

## 0.5.1

### Patch Changes

- aeba8e8: Run the `npx` fallback on Kubb 5.6.1, which publishes the snapshot in one request instead of connecting an agent and polling a job. Overlapping runs of one pull request no longer end each other's session, so workflows need no `concurrency` group for the action.

## 0.5.0

### Minor Changes

- f8b077d: Delete the pull request's Kubb Studio agent when the pull request closes. Add `closed` to the
  workflow's `pull_request` types, since GitHub leaves it out by default. A failed delete only logs a
  warning. This needs a Studio release that supports `DELETE /api/agents` with a CI API key.

## 0.4.1

### Patch Changes

- 02392c8: Fix the snapshot comment telling a pull request to "Run this workflow on pushes to `main`" even when that workflow already runs there and a CI agent for `main` exists — it just has no snapshot of this package yet, such as a package newly added in the pull request. The comment now says "No snapshot of `main` for this package yet" in that case, and keeps the original wording only when no agent for the base branch has run at all.

## 0.4.0

### Minor Changes

- 122a5f5: Show what a pull request changes against its base branch, and report failed snapshots on the pull request.

  - The comment leads with **Changes against `main`**, the pull request's snapshot compared with the base branch's latest one. Run the workflow on pushes to the base branch to get one.
  - The comment links the pull request's head commit instead of the merge commit.
  - A failed snapshot replaces the comment with the error and a link to the run.

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
