import * as core from '@actions/core'
import { context } from '@actions/github'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initConfig, updateComment } from './utils/github.js'
import { packageMetadata } from './utils/package.js'
import { startStudio, stop } from './utils/process.js'
import { createAgent, createSnapshot, snapshotDetails, studioUrl } from './utils/studio.js'

type Json = Record<string, unknown>

export async function run(): Promise<void> {
  if (context.payload.pull_request?.head?.repo?.fork) {
    core.info('Skipping Kubb snapshot: GitHub does not expose repository secrets to fork pull requests.')
    return
  }
  const apiKey = core.getInput('token', { required: true })
  const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN || ''
  if (await initConfig(githubToken)) {
    core.info('Kubb configuration needs to merge before snapshot generation can run.')
    return
  }

  const metadata = packageMetadata()
  const repositoryId = String(context.payload.repository?.id ?? context.repo.repo)
  const agent = await createAgent(apiKey, `${context.repo.owner}/${context.repo.repo}`, repositoryId)
  const agentInfo = (agent.agent ?? agent) as Json
  const agentId = String(agentInfo.id)
  const agentSlug = String(agentInfo.slug)
  core.setSecret(String(agent.token))
  const child = startStudio(studioUrl, String(agent.token))
  try {
    const snapshot = snapshotDetails(await createSnapshot(agentId, apiKey, metadata), agentId)
    core.setOutput('snapshot-id', snapshot.id)
    core.setOutput('package-name', snapshot.name)
    core.setOutput('package-version', snapshot.version)
    core.setOutput('tarball-url', snapshot.url)
    core.setOutput('integrity', snapshot.integrity)
    core.setOutput('agent-url', `${studioUrl}/agents/${agentSlug}`)
    await updateComment(snapshot, agentSlug, githubToken)
  } finally {
    stop(child)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run().catch((error: unknown) => core.setFailed(error instanceof Error ? error.message : String(error)))
}
