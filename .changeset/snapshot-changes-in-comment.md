---
'@kubb-labs/action': patch
---

Stop computing the CI agent id ourselves and let `kubb studio snapshot` detect it, and show the pull-request comment's changes since the previous snapshot when the CLI reports them (kubb-labs/kubb#4098): a summary line plus a collapsed file list (capped at 50 rows), and the new `files-added`, `files-changed`, `files-removed` outputs. With an older CLI or Studio, the comment is unchanged.
