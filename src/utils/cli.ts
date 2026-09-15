import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { captureCommand } from './process.js'

export const studioUrl = (process.env.KUBB_STUDIO_URL ?? 'https://kubb.studio').replace(/\/$/, '')

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

  return { command: 'npx', args: ['--yes', '--package', '@kubb/cli', '--package', '@kubb/studio', 'kubb'] }
}

/**
 * Runs `kubb studio snapshot --json` and returns the parsed snapshot.
 *
 * The CI API key travels through the child's environment, never argv. The CLI accepts the Studio
 * URL through its `--url` option.
 */
export async function runSnapshot({
  workingDirectory,
  config,
  token,
  id,
}: {
  workingDirectory: string
  config: string
  token: string
  id: string
}): Promise<SnapshotDetails> {
  const { command, args } = resolveKubbBinary(workingDirectory)
  console.info(`Kubb Studio snapshot: binary=${command}, url=${studioUrl}, id=${id}`)
  const stdout = await captureCommand(command, [...args, 'studio', 'snapshot', '--json', '--config', config, '--id', id, '--url', studioUrl], {
    ...process.env,
    KUBB_TOKEN: token,
  })

  const json = stdout.trim().split(/\r?\n/).find((line) => line.startsWith('{'))

  return JSON.parse(json ?? stdout.trim()) as SnapshotDetails
}
