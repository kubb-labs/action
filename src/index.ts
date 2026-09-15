import * as core from '@actions/core'
import { context } from '@actions/github'
import { createCIAgent, detectCIContext, runSnapshotJob } from '@kubb/studio'
import { createHash } from 'node:crypto'
import { delimiter, resolve } from 'node:path'
import Module from 'node:module'
import { fileURLToPath } from 'node:url'
import { initConfig, updateComment } from './utils/github.js'
import { packageMetadata } from './utils/package.js'
import { machineSecret, machineToken } from './utils/identity.js'
import { loadConfig } from './utils/loadConfig.js'
import { actionVersion } from './utils/package.js'

const studioUrl = (process.env.KUBB_STUDIO_URL ?? 'https://kubb.studio').replace(/\/$/, '')

export async function run(): Promise<void> {
  if (context.payload.pull_request?.head?.repo?.fork) {
    core.info('Skipping Kubb snapshot: GitHub does not expose repository secrets to fork pull requests.')
    return
  }
  process.chdir(resolve(process.cwd(), core.getInput('working-directory') || '.'))
  const config = resolve(process.cwd(), core.getInput('config') || 'kubb.config.ts')
  process.env.NODE_PATH = [process.env.NODE_PATH, resolve(process.cwd(), 'node_modules')].filter(Boolean).join(delimiter)
  ;(Module as typeof Module & { _initPaths(): void })._initPaths()
  const apiKey = core.getInput('token', { required: true })
  const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN || ''
  if (await initConfig(githubToken, config)) {
    core.info('Kubb configuration needs to merge before snapshot generation can run.')
    return
  }

  const metadata = packageMetadata()
  const repositoryId = String(context.payload.repository?.id ?? context.repo.repo)
  const detectedContext = detectCIContext()
  if (detectedContext?.provider !== 'github') throw new Error('Kubb Action must run in GitHub Actions')
  const pullRequestId = detectedContext.pullRequest?.id ?? String(context.runId)
  const machineId = `${repositoryId}:${pullRequestId}`
  const agent = await createCIAgent({
    token: apiKey,
    studioUrl,
    name: `${detectedContext.repository}#${pullRequestId}`,
    machineToken: machineToken(machineId),
  })
  core.setSecret(agent.token)
  process.env.KUBB_AGENT_SECRET = machineSecret(machineId)
  const snapshot = await runSnapshotJob({
    token: apiKey,
    studioUrl,
    agent,
    configPath: config,
    version: actionVersion(),
    root: process.cwd(),
    context: detectedContext,
    loadConfig: () => loadConfig(config),
    installLogger: (hooks) => {
      hooks.hook('studio:connected', ({ url }) => core.info(`Connected to ${url}`))
      hooks.hook('studio:warn', ({ message }) => core.warning(message))
      hooks.hook('studio:error', ({ error }) => core.warning(error.message))
    },
    name: metadata.name,
    snapshotVersion: metadata.version,
  })
  const details = {
    id: snapshot.id,
    integrity: snapshot.integrity,
    expiresAt: snapshot.expiresAt,
    name: snapshot.packageName ?? snapshot.name ?? `@kubb/snapshot-${agent.id}`,
    version: snapshot.packageVersion ?? snapshot.version ?? '0.0.0',
    url: new URL(snapshot.url, `${studioUrl}/`).toString(),
  }
  try {
    core.setOutput('snapshot-id', details.id)
    core.setOutput('package-name', details.name)
    core.setOutput('package-version', details.version)
    core.setOutput('tarball-url', details.url)
    core.setOutput('integrity', details.integrity)
    core.setOutput('agent-url', `${studioUrl}/agents/${agent.slug}`)
    await updateComment(details, agent.slug, githubToken)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run().catch((error: unknown) => core.setFailed(error instanceof Error ? error.message : String(error)))
}
