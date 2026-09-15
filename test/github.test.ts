import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const runCommand = vi.fn().mockResolvedValue(undefined)
vi.mock('../src/utils/process.js', () => ({ runCommand }))

const existsSync = vi.fn()
const mkdirSync = vi.fn()
const renameSync = vi.fn()
vi.mock('node:fs', () => ({ existsSync, mkdirSync, renameSync }))

const listPulls = vi.fn().mockResolvedValue([])
const createPull = vi.fn().mockResolvedValue(undefined)
const paginate = vi.fn((_fn: unknown, options: unknown) => listPulls(options))
const getOctokit = vi.fn(() => ({ rest: { pulls: { list: listPulls, create: createPull } }, paginate }))

vi.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'kubb-labs', repo: 'action' },
    payload: { repository: { default_branch: 'main' } },
  },
  getOctokit,
}))

const { initConfig } = await import('../src/utils/github.js')

beforeEach(() => {
  vi.clearAllMocks()
  listPulls.mockResolvedValue([])
  paginate.mockImplementation((_fn: unknown, options: unknown) => listPulls(options))
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('does nothing when a Kubb config already exists', async () => {
  existsSync.mockReturnValue(true)

  await expect(initConfig('gh-token', 'kubb.config.ts')).resolves.toBe(false)
  expect(runCommand).not.toHaveBeenCalled()
})

test('runs `kubb init --yes` and opens an initialization pull request when no config exists', async () => {
  existsSync.mockReturnValue(false)

  await expect(initConfig('gh-token', 'kubb.config.ts')).resolves.toBe(true)

  expect(runCommand).toHaveBeenCalledWith('npx', ['kubb', 'init', '--yes'])
  const commandNames = runCommand.mock.calls.map((call) => call[0])
  expect(commandNames).toEqual(['git', 'git', 'npx', 'git', 'git', 'git', 'git', 'git'])
  expect(createPull).toHaveBeenCalledWith(expect.objectContaining({ owner: 'kubb-labs', repo: 'action', base: 'main', title: 'chore: initialize Kubb' }))
})

test('skips creating another pull request when one is already open', async () => {
  existsSync.mockReturnValue(false)
  listPulls.mockResolvedValue([{ head: { ref: 'kubb/init-1', repo: { full_name: 'kubb-labs/action' } } }])

  await expect(initConfig('gh-token', 'kubb.config.ts')).resolves.toBe(true)

  expect(runCommand).not.toHaveBeenCalled()
  expect(createPull).not.toHaveBeenCalled()
})
