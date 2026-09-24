# Kubb GitHub Action

The Kubb GitHub Action generates a package snapshot from CI and publishes it to Kubb Studio. It
reuses one CI agent per pull request, updates one pull-request comment, and skips fork pull
requests because their secrets are unavailable.

It runs `kubb studio snapshot`, the same command any CI can run directly (GitLab, Bitbucket,
Jenkins, and others). This action handles the GitHub-specific parts: opening an init pull request
when a repository has no `kubb.config.ts` yet, and posting the snapshot as a pull-request comment.

```yaml
name: Kubb snapshot

on:
  pull_request:
  # Snapshots of main are what pull requests compare with.
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

# One run per pull request or branch at a time: runs of the same one share a Studio agent.
concurrency:
  group: kubb-snapshot-${{ github.ref }}
  cancel-in-progress: true

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

The pull-request comment links to the generated package and its Studio agent, so reviewers can
install and inspect the result without recreating the workflow locally. Below the install line it
shows what changed in the generated files, each with a collapsed file list:

| Section                     | Compared with                                         | Needs                                            |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| **Changes against `main`**  | The latest snapshot of the pull request's base branch | The workflow running on pushes to that branch    |
| **Changes since `abc1234`** | The previous snapshot on the same pull request        | Nothing: the first push reports a first snapshot |

Snapshots expire after a week, so add a `schedule` trigger if the base branch can go a week
without a push. When a snapshot fails, the comment shows the error and links the run. See the
[Kubb Studio guide](https://kubb.dev/docs/5.x/guide/integrations/studio) and the
[GitHub Actions guide](https://kubb.dev/docs/5.x/guide/integrations/github-actions).

## Resolving `kubb`

The action runs `kubb studio snapshot` from the repository's own `node_modules/.bin/kubb` when one
exists, so it uses the same Kubb version the repository's config and plugins are built against.
When a repository has no local install, it falls back to
`npx --package @kubb/cli --package @kubb/studio kubb studio snapshot`. The changes since the
previous snapshot need Kubb 5.3.16 or later, and the base branch comparison needs the release
after it (kubb-labs/kubb#4100); with an older local install the comment leaves
them out.
