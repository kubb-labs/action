import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { captureCommand } from './process.js'

export const studioUrl = (process.env.KUBB_STUDIO_URL ?? 'https://kubb.studio').replace(/\/$/, '')

/**
 * How the snapshot's generated files differ from the previous snapshot of the same package on the
 * same agent. `base` is `null` on a first snapshot.
 */
export type SnapshotChanges = {
  base: { id: string; version: string | null; commit?: string; createdAt: string } | null
  added: Array<string>
  changed: Array<string>
  removed: Array<string>
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
   * Absent when the CLI or Studio predates it.
   */
  changes?: SnapshotChanges
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
export async function runSnapshot({ workingDirectory, config, token }: { workingDirectory: string; config: string; token: string }): Promise<SnapshotDetails> {
  const { command, args } = resolveKubbBinary(workingDirectory)
  console.info(`Kubb Studio snapshot: binary=${command}, url=${studioUrl}`)
  const stdout = await captureCommand(command, [...args, 'studio', 'snapshot', '--json', '--config', config, '--url', studioUrl], {
    ...process.env,
    KUBB_TOKEN: token,
  })

  const json = stdout
    .trim()
    .split(/\r?\n/)
    .find((line) => line.startsWith('{'))

  return JSON.parse(json ?? stdout.trim()) as SnapshotDetails
}
