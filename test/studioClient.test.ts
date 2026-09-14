import { afterEach, beforeEach, expect, test, vi } from 'vitest'

type Hook = (ctx: unknown) => void

vi.mock('../src/utils/loadConfig.js', () => ({ loadConfig: vi.fn() }))

const hooks = new Map<string, Hook>()
const connect = vi.fn().mockResolvedValue(undefined)
const disconnect = vi.fn()

vi.mock('@kubb/studio', () => ({
  createClient: vi.fn((options: { installLogger: (hooks: { hook: (name: string, cb: Hook) => void }) => void }) => {
    options.installLogger({ hook: (name, cb) => hooks.set(name, cb) })
    return { connect, disconnect }
  }),
}))

const { connectAndWaitUntilReady, READY_TIMEOUT_MS } = await import('../src/utils/studioClient.js')

beforeEach(() => {
  hooks.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('resolves once Studio confirms the agent is ready', async () => {
  const result = connectAndWaitUntilReady('kubb.config.ts', 'agent-token')

  // createClient runs its installLogger synchronously, before any await, so the hook is
  // already registered by the time this line runs.
  hooks.get('studio:ready')!({})

  await expect(result).resolves.toMatchObject({ connect, disconnect })
})

test('rejects when Studio never confirms readiness in time', async () => {
  const result = connectAndWaitUntilReady('kubb.config.ts', 'agent-token')
  const assertion = expect(result).rejects.toThrow('Timed out waiting for Kubb Studio to confirm the agent was ready')

  await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS)

  await assertion
})
