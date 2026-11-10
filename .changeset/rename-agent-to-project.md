---
'@kubb-labs/action': patch
---

Rename the CI agent to a project, following Kubb Studio. The action has a new `project-url` output and still sets `agent-url` to the same value, so existing workflows keep working. It deletes a closed pull request's CI project through `DELETE /api/projects`, and reads `projectUrl` from `kubb studio snapshot --json`, with a fallback to `agentUrl` for older Kubb CLI versions.
