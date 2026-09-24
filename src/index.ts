import * as core from '@actions/core'
import { context } from '@actions/github'
import { delimiter, resolve } from 'node:path'
import Module from 'node:module'
import { fileURLToPath } from 'node:url'
import { initConfig, updateComment, updateFailureComment } from './utils/github.js'
import { runSnapshot } from './utils/cli.js'
import { CommandError } from './utils/process.js'

export async function run(): Promise<void> {
  if (context.payload.pull_request?.head?.repo?.fork) {
    core.info('Skipping Kubb snapshot: GitHub does not expose repository secrets to fork pull requests.')
    return
  }
  process.chdir(resolve(process.cwd(), core.getInput('working-directory') || '.'))
  const config = resolve(process.cwd(), core.getInput('config') || 'kubb.config.ts')
  // `kubb` resolves from the target repository's own node_modules first (see resolveKubbBinary),
  // so this also fixes up resolution for that spawned process, the same way it always has for
  // the config Studio loads in-process.
  process.env.NODE_PATH = [process.env.NODE_PATH, resolve(process.cwd(), 'node_modules')].filter(Boolean).join(delimiter)
  ;(Module as typeof Module & { _initPaths(): void })._initPaths()
  const apiKey = core.getInput('token', { required: true })
  core.setSecret(apiKey)
  const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN || ''
  if (await initConfig(githubToken, config)) {
    core.info('Kubb configuration needs to merge before snapshot generation can run.')
    return
  }

  const compareCommitted = core.getInput('compare-committed') === 'true'
  const snapshot = await core
    .group('Kubb Studio snapshot', () => runSnapshot({ workingDirectory: process.cwd(), config, token: apiKey, compareCommitted }))
    .catch(async (error: unknown) => {
      // Best effort: a failed comment must not hide the snapshot failure itself.
      await updateFailureComment({ message: failureMessage(error), token: githubToken, secrets: [apiKey] }).catch((commentError: unknown) =>
        core.warning(`Could not report the failure on the pull request: ${commentError instanceof Error ? commentError.message : String(commentError)}`),
      )
      throw error
    })

  core.info(
    [
      'Snapshot published',
      `  Package: ${snapshot.name ?? '(unnamed)'}@${snapshot.version ?? '0.0.0'}`,
      `  Tarball: ${snapshot.url}`,
      `  Agent: ${snapshot.agentUrl}`,
      `  Expires: ${snapshot.expiresAt}`,
    ].join('\n'),
  )

  core.setOutput('snapshot-id', snapshot.id)
  core.setOutput('package-name', snapshot.name)
  core.setOutput('package-version', snapshot.version)
  core.setOutput('tarball-url', snapshot.url)
  core.setOutput('integrity', snapshot.integrity)
  core.setOutput('agent-url', snapshot.agentUrl)
  core.setOutput('files-added', String(snapshot.changes?.added.length ?? 0))
  core.setOutput('files-changed', String(snapshot.changes?.changed.length ?? 0))
  core.setOutput('files-removed', String(snapshot.changes?.removed.length ?? 0))
  core.setOutput('branch-files-added', String(snapshot.branchChanges?.added.length ?? 0))
  core.setOutput('branch-files-changed', String(snapshot.branchChanges?.changed.length ?? 0))
  core.setOutput('branch-files-removed', String(snapshot.branchChanges?.removed.length ?? 0))
  await updateComment(snapshot, githubToken)
}

/**
 * The reason a snapshot failed, from the end of the CLI's own output when it wrote one.
 */
function failureMessage(error: unknown): string {
  if (error instanceof CommandError && error.stderr) return error.stderr
  return error instanceof Error ? error.message : String(error)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run().catch((error: unknown) => core.setFailed(error instanceof Error ? error.message : String(error)))
}
