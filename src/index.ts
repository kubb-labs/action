import * as core from '@actions/core'
import { context } from '@actions/github'
import { delimiter, resolve } from 'node:path'
import Module from 'node:module'
import { fileURLToPath } from 'node:url'
import { initConfig, updateComment } from './utils/github.js'
import { runSnapshot } from './utils/cli.js'

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

  // Reproduces the identity this action has always registered CI agents under, so a repository
  // that already has one open keeps reusing it here instead of registering a new one.
  const repositoryId = String(context.payload.repository?.id ?? context.repo.repo)
  const pullRequestId = String(context.payload.pull_request?.number ?? context.runId)
  const id = `gh:${repositoryId}:${pullRequestId}`

  const snapshot = await core.group('Kubb Studio snapshot', () => runSnapshot({ workingDirectory: process.cwd(), config, token: apiKey, id }))

  core.info([
    'Snapshot published',
    `  Package: ${snapshot.name ?? '(unnamed)'}@${snapshot.version ?? '0.0.0'}`,
    `  Tarball: ${snapshot.url}`,
    `  Agent: ${snapshot.agentUrl}`,
    `  Expires: ${snapshot.expiresAt}`,
  ].join('\n'))

  core.setOutput('snapshot-id', snapshot.id)
  core.setOutput('package-name', snapshot.name)
  core.setOutput('package-version', snapshot.version)
  core.setOutput('tarball-url', snapshot.url)
  core.setOutput('integrity', snapshot.integrity)
  core.setOutput('agent-url', snapshot.agentUrl)
  await updateComment(snapshot, githubToken)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run().catch((error: unknown) => core.setFailed(error instanceof Error ? error.message : String(error)))
}
