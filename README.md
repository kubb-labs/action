# Kubb GitHub Action

The Kubb GitHub Action generates a package snapshot from CI and publishes it to Kubb Studio. It
reuses one CI agent per pull request, updates one pull-request comment, and skips fork pull
requests because their secrets are unavailable.

It runs `kubb studio snapshot`, the same command any CI can run directly (GitLab, Bitbucket,
Jenkins, and others). This action handles the GitHub-specific parts: opening an init pull request
when a repository has no `kubb.config.ts` yet, and posting the snapshot as a pull-request comment.

```yaml
name: Kubb snapshot

on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: kubb-labs/action@v1
        with:
          token: ${{ secrets.KUBB_TOKEN }}
```

The repository needs `KUBB_TOKEN` in Actions secrets: an organization CI API key, sent as
`x-api-key`. Set `KUBB_STUDIO_URL` only for a self-hosted Studio deployment; the default is
`https://kubb.studio`.

The pull-request comment links to the generated package and its Studio agent. Reviewers can install and inspect the result without recreating the workflow locally. It also shows what changed since the previous snapshot on the same pull request — files added, changed, and removed — behind a collapsed file list, along with the `files-added`, `files-changed`, and `files-removed` outputs. See the [Kubb Studio guide](https://kubb.dev/docs/5.x/guide/integrations/studio) and the [GitHub Actions guide](https://kubb.dev/docs/5.x/guide/integrations/github-actions).

## Resolving `kubb`

The action runs `kubb studio snapshot` from the repository's own `node_modules/.bin/kubb` when one
exists, so it uses the same Kubb version the repository's config and plugins are built against.
When a repository has no local install, it falls back to
`npx --package @kubb/cli --package @kubb/studio kubb studio snapshot`.
