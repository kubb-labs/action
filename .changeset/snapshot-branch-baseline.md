---
'@kubb-labs/action': minor
---

Show what a pull request changes against its base branch, and report failed snapshots on the pull request (kubb-labs/kubb#4100).

- The comment leads with **Changes against `main`**: the pull request's snapshot compared with the latest snapshot of its base branch. Run the workflow on pushes to the base branch to get one; until then the comment says so. The `branch-files-added`, `branch-files-changed`, and `branch-files-removed` outputs count it.
- The new `compare-committed` input also compares the snapshot with the generated files checked out with the repository, for repositories that commit generated code.
- The comment links the pull request's head commit instead of the temporary merge commit.
- A failed snapshot replaces the comment with the end of the CLI output and a link to the run, so it is visible even when the step is allowed to fail.
