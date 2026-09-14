---
'@kubb-labs/action': minor
---

Connect to Kubb Studio directly with `@kubb/studio`'s client instead of spawning `npx kubb studio` as a subprocess, and wait for its `studio:ready` acknowledgement before requesting a snapshot.

The action previously spawned the CLI and waited a fixed 3 seconds before asking Studio for a snapshot, guessing at when the agent would be registered. It now connects in-process and awaits the real readiness signal (with a 15-second timeout), so the snapshot request only fires once Studio has actually registered the connection.
