# Kubb GitHub Action

The Kubb GitHub Action generates a package snapshot from CI and publishes it to Kubb Studio.

The action is currently scaffolded. Snapshot generation and publishing will be added in the implementation task.

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
      - uses: kubb-labs/action@main
        with:
          token: ${{ secrets.KUBB_TOKEN }}
```
