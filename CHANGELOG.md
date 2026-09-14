# @kubb-labs/action

## 0.2.0

### Minor Changes

- bc071ce: Connect to Kubb Studio directly with `@kubb/studio`'s client instead of spawning `npx kubb studio` as a subprocess, and wait for its `studio:ready` acknowledgement before requesting a snapshot.

  The action previously spawned the CLI and waited a fixed 3 seconds before asking Studio for a snapshot, guessing at when the agent would be registered. It now connects in-process and awaits the real readiness signal (with a 15-second timeout), so the snapshot request only fires once Studio has actually registered the connection.

### Patch Changes

- 81b1f6a: Bundle `@kubb/studio` and `jiti` into the GitHub Action output so the action can run without installing runtime dependencies.

## 0.1.0

### Minor Changes

- 7976118: Implement Kubb Studio snapshot publishing from GitHub Actions.
