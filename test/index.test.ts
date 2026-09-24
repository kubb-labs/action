import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const inputs: Record<string, string> = { token: 'ci-token', config: 'kubb.config.ts' }
const outputs: Record<string, string> = {}
const setFailed = vi.fn()

vi.mock('@actions/core', () => ({
  getInput: vi.fn((name: string) => inputs[name] ?? ''),
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

vi.mock('../src/utils/cli.js', () => ({ runSnapshot: vi.fn().mockResolvedValue(snapshot) }))

const { initConfig, updateComment } = await import('../src/utils/github.js')
const { runSnapshot } = await import('../src/utils/cli.js')
const { run } = await import('../src/index.js')

beforeEach(() => {
  payload.pull_request = { number: 42 }
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

  it('lets the CLI detect the CI agent identity, instead of passing an id itself', async () => {
    await run()

    expect(vi.mocked(runSnapshot)).toHaveBeenCalledWith(expect.objectContaining({ token: 'ci-token' }))
    expect(vi.mocked(runSnapshot).mock.calls[0]?.[0]).not.toHaveProperty('id')
  })

  it('maps the snapshot onto the action outputs and updates the comment', async () => {
    await run()

    expect(outputs['tarball-url']).toBe(snapshot.url)
    expect(outputs['agent-url']).toBe(snapshot.agentUrl)
    expect(outputs['files-added']).toBe('0')
    expect(outputs['files-changed']).toBe('0')
    expect(outputs['files-removed']).toBe('0')
    expect(vi.mocked(updateComment)).toHaveBeenCalledWith(snapshot, expect.any(String))
    expect(vi.mocked(await import('@actions/core')).info).toHaveBeenCalledWith(expect.stringContaining('Snapshot published'))
  })

  it('counts each kind of change into its own output', async () => {
    vi.mocked(runSnapshot).mockResolvedValueOnce({
      ...snapshot,
      changes: {
        base: { id: 'snap-0', version: '1.0.0', commit: '9f3e2a1', createdAt: '2026-01-01T00:00:00.000Z' },
        added: ['a.ts', 'b.ts'],
        changed: ['c.ts'],
        removed: [],
      },
    })

    await run()

    expect(outputs['files-added']).toBe('2')
    expect(outputs['files-changed']).toBe('1')
    expect(outputs['files-removed']).toBe('0')
  })

  it('stops before a snapshot when the config still needs an init PR', async () => {
    vi.mocked(initConfig).mockResolvedValueOnce(true)

    await run()

    expect(runSnapshot).not.toHaveBeenCalled()
  })
})
