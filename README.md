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

## Publishing a snapshot to npm

Set `publish: true` and provide an npm token. The action publishes the generated Studio snapshot
tarball and exposes `published` and `registry` outputs:

```yaml
name: Release generated package

on:
  push:
    tags: ['v*']

permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - uses: kubb-labs/action@v1
        with:
          token: ${{ secrets.KUBB_TOKEN }}
          publish: true
          npm-token: ${{ secrets.NPM_TOKEN }}
```

To publish a snapshot created by an earlier job, pass its `snapshot-id` input. Set
`NPM_CONFIG_REGISTRY` to publish to a compatible npm registry other than npmjs.org.

## Resolving `kubb`

The action runs `kubb studio snapshot` from the repository's own `node_modules/.bin/kubb` when one
exists, so it uses the same Kubb version the repository's config and plugins are built against.
When a repository has no local install, it falls back to
`npx --package @kubb/cli --package @kubb/studio kubb studio snapshot`.
