import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const inputs: Record<string, string> = { token: 'ci-token', config: 'kubb.config.ts' }
const outputs: Record<string, string> = {}
const setFailed = vi.fn()

vi.mock('@actions/core', () => ({
  getInput: vi.fn((name: string) => inputs[name] ?? ''),
  getBooleanInput: vi.fn((name: string) => inputs[name] === 'true'),
  setSecret: vi.fn(),
  setOutput: vi.fn((name: string, value: string) => {
    outputs[name] = value
  }),
  setFailed,
  info: vi.fn(),
  group: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
}))

const payload: { pull_request?: { number: number; head?: { repo?: { fork: boolean } } }; repository?: { id: number } } = {
  pull_request: { number: 42 },
  repository: { id: 123456 },
}

vi.mock('@actions/github', () => ({
  context: {
    get payload() {
      return payload
    },
    repo: { owner: 'acme', repo: 'api' },
    issue: { owner: 'acme', repo: 'api', number: 42 },
    sha: 'a'.repeat(40),
    runId: 999,
  },
  getOctokit: vi.fn(),
}))

vi.mock('../src/utils/github.js', () => ({
  initConfig: vi.fn().mockResolvedValue(false),
  updateComment: vi.fn().mockResolvedValue(undefined),
}))

const snapshot = {
  id: 'snap-1',
  name: '@acme/api',
  version: '1.0.0',
  integrity: 'sha512-abc',
  url: 'https://kubb.studio/packages/brave-otter/%40acme%2Fapi.tgz',
  snapshotIdUrl: 'https://kubb.studio/packages/snap-1/snapshot.tgz',
  expiresAt: '2026-01-08T00:00:00.000Z',
  agentUrl: 'https://kubb.studio/agents/brave-otter',
}

vi.mock('../src/utils/cli.js', () => ({
  runSnapshot: vi.fn().mockResolvedValue(snapshot),
  runPublish: vi.fn().mockResolvedValue({ jobId: 'job-1', snapshotId: 'snap-1', name: '@kubb/demo', version: '1.0.0', registry: 'https://registry.npmjs.org', agentUrl: 'https://kubb.studio/agents/brave-otter' }),
  studioUrl: 'https://kubb.studio',
}))

const { initConfig, updateComment } = await import('../src/utils/github.js')
const { runPublish, runSnapshot } = await import('../src/utils/cli.js')
const { run } = await import('../src/index.js')

beforeEach(() => {
  payload.pull_request = { number: 42 }
  for (const key of Object.keys(inputs)) delete inputs[key]
  Object.assign(inputs, { token: 'ci-token', config: 'kubb.config.ts' })
  for (const key of Object.keys(outputs)) delete outputs[key]
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('run', () => {
  it('skips fork pull requests, since their secrets are unavailable', async () => {
    payload.pull_request = { number: 42, head: { repo: { fork: true } } }

    await run()

    expect(runSnapshot).not.toHaveBeenCalled()
  })

  it('reproduces the id this action has always registered agents under', async () => {
    await run()

    expect(vi.mocked(runSnapshot)).toHaveBeenCalledWith(expect.objectContaining({ id: 'gh:123456:42', token: 'ci-token' }))
  })

  it('maps the snapshot onto the action outputs and updates the comment', async () => {
    await run()

    expect(outputs['tarball-url']).toBe(snapshot.url)
    expect(outputs['agent-url']).toBe(snapshot.agentUrl)
    expect(vi.mocked(updateComment)).toHaveBeenCalledWith(snapshot, expect.any(String), { published: false, registry: 'https://registry.npmjs.org' })
    expect(vi.mocked(await import('@actions/core')).info).toHaveBeenCalledWith(expect.stringContaining('Snapshot published'))
  })

  it('publishes a newly created snapshot and exposes publish outputs', async () => {
    Object.assign(inputs, { publish: 'true', 'npm-token': 'npm-token' })

    await run()

    expect(runPublish).toHaveBeenCalledWith(expect.objectContaining({ snapshotId: snapshot.id, npmToken: 'npm-token' }))
    expect(outputs.published).toBe('true')
    expect(outputs.registry).toBe('https://registry.npmjs.org')
  })

  it('publishes an existing snapshot without creating another one', async () => {
    Object.assign(inputs, { publish: 'true', 'npm-token': 'npm-token', 'snapshot-id': 'snap-existing' })

    await run()

    expect(runSnapshot).not.toHaveBeenCalled()
    expect(runPublish).toHaveBeenCalledWith(expect.objectContaining({ snapshotId: 'snap-existing', npmToken: 'npm-token' }))
  })

  it('stops before a snapshot when the config still needs an init PR', async () => {
    vi.mocked(initConfig).mockResolvedValueOnce(true)

    await run()

    expect(runSnapshot).not.toHaveBeenCalled()
  })
})
