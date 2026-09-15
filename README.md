# Kubb GitHub Action

The Kubb GitHub Action generates a package snapshot from CI and publishes it to Kubb Studio. It reuses one CI agent per pull request, updates one pull-request comment, and skips fork pull requests because their secrets are unavailable.

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

The repository needs `KUBB_TOKEN` in Actions secrets. Set `KUBB_STUDIO_URL` only for a self-hosted Studio deployment; the default is `https://kubb.studio`.

GitLab and other CI runners can generate directly with Kubb:

```yaml
generate:
  image: node:22
  script:
    - npx kubb generate
```

For a merge-request package snapshot, use `npx kubb studio snapshot` with `KUBB_TOKEN`.
