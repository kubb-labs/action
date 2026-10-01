import { hash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { captureCommand } from './process.js'

export const studioUrl = (process.env.KUBB_STUDIO_URL ?? 'https://kubb.studio').replace(/\/$/, '')

/**
 * How generated files differ from an earlier snapshot. `base` is `null` when there is none.
 */
export type SnapshotChanges = {
  base: { id: string; version: string | null; commit?: string; createdAt: string } | null
  added: Array<string>
  changed: Array<string>
  removed: Array<string>
}

/**
 * `SnapshotChanges` against the pull request's base branch. `baseFound` tells apart the two reasons
 * `base` can be `null`: `false` when no CI agent is registered for the branch yet (the workflow has
 * never run there), `true` when that agent exists but has no snapshot of this package to compare with.
 */
export type BranchSnapshotChanges = SnapshotChanges & { branch: string; baseFound: boolean }

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
   * Absent when the CLI or Studio predates it, like the one below.
   */
  changes?: SnapshotChanges
  /** Against the pull request's base branch. */
  branchChanges?: BranchSnapshotChanges
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

  return { command: 'npx', args: ['--yes', '--package', '@kubb/cli@^5.4.2', '--package', '@kubb/studio@^5.4.2', 'kubb'] }
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

/**
 * Machine token of a pull request's CI agent. It repeats the identity `kubb studio snapshot`
 * derives on GitHub (`gh:<repositoryId>:<prNumber>`, hashed with SHA-256), so both name one agent.
 */
export function pullRequestMachineToken(prNumber: number, env: Record<string, string | undefined> = process.env): string {
  return hash('sha256', `gh:${env.GITHUB_REPOSITORY_ID ?? env.GITHUB_REPOSITORY ?? ''}:${prNumber}`)
}

/**
 * Deletes the pull request's CI agent from Studio (`DELETE /api/agents`).
 *
 * Returns `false` when Studio has no such agent, like a pull request that never ran the workflow
 * or one cleaned up already. The CI API key goes in `x-api-key`, never in the URL.
 */
export async function releaseAgent({ token, prNumber }: { token: string; prNumber: number }): Promise<boolean> {
  const response = await fetch(`${studioUrl}/api/agents`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', 'x-api-key': token },
    body: JSON.stringify({ machineToken: pullRequestMachineToken(prNumber) }),
  })

  if (response.status === 404) return false
  if (!response.ok) throw new Error(`Kubb Studio could not delete the agent (HTTP ${response.status})`)

  return true
}
