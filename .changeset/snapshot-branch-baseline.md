---
'@kubb-labs/action': minor
---

Show what a pull request changes against its base branch, and report failed snapshots on the pull request.

- The comment leads with **Changes against `main`**, the pull request's snapshot compared with the base branch's latest one. Run the workflow on pushes to the base branch to get one.
- The comment links the pull request's head commit instead of the merge commit.
- A failed snapshot replaces the comment with the error and a link to the run.
