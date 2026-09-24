import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { captureCommand } from './process.js'

export const studioUrl = (process.env.KUBB_STUDIO_URL ?? 'https://kubb.studio').replace(/\/$/, '')

/**
 * Generated files that differ between two sets, by path relative to the Kubb config's `root`.
 */
export type FileChanges = {
  added: Array<string>
  changed: Array<string>
  removed: Array<string>
}

/**
 * How the snapshot's generated files differ from an earlier snapshot of the same package. `base` is
 * `null` when there is none to compare with.
 */
export type SnapshotChanges = FileChanges & {
  base: { id: string; version: string | null; commit?: string; createdAt: string } | null
}

/**
 * Package view `kubb studio snapshot --json` prints, absolute and ready to use.
 */
export type SnapshotDetails = {
  id: string
  name: string | null
  version: string | null
  integrity: string | null
  url: string
  snapshotIdUrl: string
  expiresAt: string
  agentUrl: string
  /**
   * Since the previous snapshot on this pull request. Absent when the CLI or Studio predates it.
   */
  changes?: SnapshotChanges
  /**
   * Against the latest snapshot of the pull request's base branch, named by `branch`. Absent off a
   * pull request, or when the CLI or Studio predates it.
   */
  branchChanges?: SnapshotChanges & { branch: string }
  /**
   * Against the generated files checked out with the repository. Only with `compare-committed`.
   */
  diskChanges?: FileChanges
}

/**
 * Where to run `kubb` from: the target repository's own install when it has one, since that is
 * the Kubb version its config and plugins are built against. Falls back to `npx`, so a repository
 * with no local `@kubb/cli` still works, the same way running the action bundled its own copy did
 * before this refactor. `@kubb/studio` is an optional peer of `@kubb/cli`, and `kubb studio` loads
 * it lazily, so both packages are named on the `npx` fallback.
 */
export function resolveKubbBinary(workingDirectory: string): { command: string; args: Array<string> } {
  const localBinary = join(workingDirectory, 'node_modules', '.bin', 'kubb')

  if (existsSync(localBinary)) {
    return { command: localBinary, args: [] }
  }

  return { command: 'npx', args: ['--yes', '--package', '@kubb/cli@^5.3.16', '--package', '@kubb/studio@^5.3.16', 'kubb'] }
}

/**
 * Runs `kubb studio snapshot --json` and returns the parsed snapshot.
 *
 * The CI API key travels through the child's environment, never argv. The CLI accepts the Studio
 * URL through its `--url` option, and detects the CI agent identity from the environment on its
 * own, the same way it does for every CI provider it supports.
 */
export async function runSnapshot({
  workingDirectory,
  config,
  token,
  compareCommitted = false,
}: {
  workingDirectory: string
  config: string
  token: string
  /**
   * Lets the agent read the output directory, so the snapshot also compares with the generated files
   * checked out with the repository.
   */
  compareCommitted?: boolean
}): Promise<SnapshotDetails> {
  const { command, args } = resolveKubbBinary(workingDirectory)
  console.info(`Kubb Studio snapshot: binary=${command}, url=${studioUrl}`)
  const flags = ['--json', '--config', config, '--url', studioUrl, ...(compareCommitted ? ['--allow-read'] : [])]
  const stdout = await captureCommand(command, [...args, 'studio', 'snapshot', ...flags], {
    ...process.env,
    KUBB_TOKEN: token,
  })

  const json = stdout
    .trim()
    .split(/\r?\n/)
    .find((line) => line.startsWith('{'))

  return JSON.parse(json ?? stdout.trim()) as SnapshotDetails
}
