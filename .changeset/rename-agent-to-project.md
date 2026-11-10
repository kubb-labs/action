---
'@kubb-labs/action': major
---

Rename the `agent-url` output to `project-url`, following Kubb Studio's rename of "agent" to "project". Workflows that read `steps.<id>.outputs.agent-url` must read `project-url` instead. The action now deletes a closed pull request's CI project through `DELETE /api/projects`, and reads `projectUrl` from `kubb studio snapshot --json`, with a fallback to `agentUrl` for older Kubb CLI versions.
