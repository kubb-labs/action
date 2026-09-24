import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const runCommand = vi.fn().mockResolvedValue(undefined)
vi.mock('../src/utils/process.js', () => ({ runCommand }))

const existsSync = vi.fn()
const mkdirSync = vi.fn()
const renameSync = vi.fn()
vi.mock('node:fs', () => ({ existsSync, mkdirSync, renameSync }))

const listPulls = vi.fn().mockResolvedValue([])
const createPull = vi.fn().mockResolvedValue(undefined)
const listComments = vi.fn().mockResolvedValue([])
const updateIssueComment = vi.fn().mockResolvedValue(undefined)
const createIssueComment = vi.fn().mockResolvedValue(undefined)
const paginate = vi.fn((fn: unknown, options: unknown) => (fn === listComments ? listComments(options) : listPulls(options)))
const getOctokit = vi.fn(() => ({
  rest: { pulls: { list: listPulls, create: createPull }, issues: { listComments, updateComment: updateIssueComment, createComment: createIssueComment } },
  paginate,
}))

let issueNumber: number | undefined = 42

const payload: { repository: { default_branch: string }; pull_request?: { head: { sha: string } } } = { repository: { default_branch: 'main' } }

vi.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'kubb-labs', repo: 'action' },
    payload,
    runId: 321,
    get issue() {
      return { owner: 'kubb-labs', repo: 'action', number: issueNumber }
    },
    sha: '9f3e2a1bbccdd00112233445566778899aabbcc',
  },
  getOctokit,
}))

const { initConfig, updateComment, updateFailureComment } = await import('../src/utils/github.js')

beforeEach(() => {
  vi.clearAllMocks()
  issueNumber = 42
  delete payload.pull_request
  listPulls.mockResolvedValue([])
  listComments.mockResolvedValue([])
  paginate.mockImplementation((fn: unknown, options: unknown) => (fn === listComments ? listComments(options) : listPulls(options)))
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

test('does nothing off a pull request, where there is no comment to update', async () => {
  issueNumber = undefined

  await updateComment(snapshot, 'gh-token')

  expect(createIssueComment).not.toHaveBeenCalled()
})

test('creates the comment on the first snapshot, with no changes block', async () => {
  await updateComment(snapshot, 'gh-token')

  expect(createIssueComment).toHaveBeenCalledOnce()
  const body = createIssueComment.mock.calls[0]![0].body as string
  expect(body).toContain('npm i https://kubb.studio/packages/brave-otter/%40acme%2Fapi.tgz')
  expect(body).not.toContain('Changes since')
  expect(body).not.toContain('First snapshot')
})

test('reports a first snapshot when Studio sent changes with no base', async () => {
  await updateComment({ ...snapshot, changes: { base: null, added: ['pet.ts', 'user.ts'], changed: [], removed: [] } }, 'gh-token')

  const body = createIssueComment.mock.calls[0]![0].body as string
  expect(body).toContain('**First snapshot for this pull request**: 2 files generated')
  expect(body).not.toContain('<details>')
})

test('summarizes and lists changes against the previous snapshot, linking its commit', async () => {
  await updateComment(
    {
      ...snapshot,
      changes: {
        base: { id: 'snap-0', version: '1.0.0', commit: '9f3e2a1bbccdd00112233445566778899aabbcc', createdAt: '2026-01-01T00:00:00.000Z' },
        added: ['models/PetStatus.ts'],
        changed: ['clients/updatePet.ts'],
        removed: ['models/LegacyPetStatus.ts'],
      },
    },
    'gh-token',
  )

  const body = createIssueComment.mock.calls[0]![0].body as string
  expect(body).toContain(
    '**Changes since [`9f3e2a1`](https://github.com/kubb-labs/action/commit/9f3e2a1bbccdd00112233445566778899aabbcc)**: 1 added · 1 changed · 1 removed',
  )
  expect(body).toContain('| Added | `models/PetStatus.ts` |')
  expect(body).toContain('| Changed | `clients/updatePet.ts` |')
  expect(body).toContain('| Removed | `models/LegacyPetStatus.ts` |')
  expect(body).toContain('<summary>3 generated files changed</summary>')
})

test('reports no changes without a file list when nothing changed', async () => {
  await updateComment(
    {
      ...snapshot,
      changes: { base: { id: 'snap-0', version: '1.0.0', createdAt: '2026-01-01T00:00:00.000Z' }, added: [], changed: [], removed: [] },
    },
    'gh-token',
  )

  const body = createIssueComment.mock.calls[0]![0].body as string
  expect(body).toContain('**No changes since 2026-01-01T00:00:00.000Z**')
  expect(body).not.toContain('<details>')
})

test('caps the listed files and says how many more, past the GitHub comment size limit', async () => {
  const added = Array.from({ length: 62 }, (_, index) => `file-${index}.ts`)

  await updateComment(
    {
      ...snapshot,
      changes: { base: { id: 'snap-0', version: '1.0.0', createdAt: '2026-01-01T00:00:00.000Z' }, added, changed: [], removed: [] },
    },
    'gh-token',
  )

  const body = createIssueComment.mock.calls[0]![0].body as string
  expect(body).toContain('file-49.ts')
  expect(body).not.toContain('file-50.ts')
  expect(body).toContain('…and 12 more files. Install the package to see everything.')
})

test('updates the existing comment instead of creating a second one', async () => {
  listComments.mockResolvedValue([{ id: 7, body: '<!-- kubb-studio-snapshot -->\nold' }])

  await updateComment(snapshot, 'gh-token')

  expect(updateIssueComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 7 }))
  expect(createIssueComment).not.toHaveBeenCalled()
})

const main = { id: 'snap-main', version: '1.0.0', commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', createdAt: '2026-01-01T00:00:00.000Z' }

function commentBody(): string {
  return (createIssueComment.mock.calls[0]![0] as { body: string }).body
}

test('leads with the changes against the base branch, linking its snapshot commit', async () => {
  await updateComment(
    {
      ...snapshot,
      branchChanges: { branch: 'main', base: main, added: ['models/PetStatus.ts'], changed: ['models/Pet.ts'], removed: [] },
      changes: { base: null, added: ['models/Pet.ts', 'models/PetStatus.ts'], changed: [], removed: [] },
    },
    'gh-token',
  )

  const body = commentBody()
  expect(body).toContain(
    '**Changes against `main`** ([`a1b2c3d`](https://github.com/kubb-labs/action/commit/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678)): 1 added · 1 changed · 0 removed',
  )
  expect(body).toContain('| Added | `models/PetStatus.ts` |')
  expect(body.indexOf('Changes against')).toBeLessThan(body.indexOf('First snapshot for this pull request'))
})

test('says when the pull request changes nothing against the base branch', async () => {
  await updateComment({ ...snapshot, branchChanges: { branch: 'main', base: { ...main, commit: undefined }, added: [], changed: [], removed: [] } }, 'gh-token')

  expect(commentBody()).toContain('**No changes against `main`**')
  expect(commentBody()).not.toContain('<details>')
})

test('says how to get a base branch snapshot when there is none yet', async () => {
  await updateComment({ ...snapshot, branchChanges: { branch: 'main', base: null, added: [], changed: [], removed: [] } }, 'gh-token')

  expect(commentBody()).toContain('**No snapshot of `main` to compare with yet.** Run this workflow on pushes to `main` to compare pull requests with it.')
})

test('compares with the committed generated files when asked', async () => {
  await updateComment({ ...snapshot, diskChanges: { added: [], changed: ['src/gen/models/Pet.ts'], removed: [] } }, 'gh-token')
  expect(commentBody()).toContain('**Differs from the committed generated files**: 0 added · 1 changed · 0 removed')
  expect(commentBody()).toContain('| Changed | `src/gen/models/Pet.ts` |')

  createIssueComment.mockClear()
  await updateComment({ ...snapshot, diskChanges: { added: [], changed: [], removed: [] } }, 'gh-token')
  expect(commentBody()).toContain('**Matches the committed generated files**')
})

test("links the pull request's head commit, not the merge commit the run checks out", async () => {
  payload.pull_request = { head: { sha: 'feedface00112233445566778899aabbccddeeff' } }

  await updateComment(snapshot, 'gh-token')

  expect(commentBody()).toContain(
    'commit <a href="https://github.com/kubb-labs/action/commit/feedface00112233445566778899aabbccddeeff"><code>feedfac</code></a>',
  )
})

test('replaces the comment with the failure, redacting secrets and linking the run', async () => {
  listComments.mockResolvedValue([{ id: 7, body: '<!-- kubb-studio-snapshot -->\nold' }])

  await updateFailureComment({ message: 'Snapshot job failed: key ci-secret rejected', token: 'gh-token', secrets: ['ci-secret'] })

  const body = (updateIssueComment.mock.calls[0]![0] as { body: string }).body
  expect(body).toContain('### Kubb snapshot failed')
  expect(body).toContain('Snapshot job failed: key *** rejected')
  expect(body).not.toContain('ci-secret')
  expect(body).toContain('https://github.com/kubb-labs/action/actions/runs/321')
  expect(body).not.toContain('npm i')
})

test('keeps only the end of a long failure', async () => {
  await updateFailureComment({ message: `${'x'.repeat(3_000)}the actual error`, token: 'gh-token' })

  expect(commentBody()).toContain('the actual error')
  expect(commentBody()).not.toContain('x'.repeat(2_100))
})
