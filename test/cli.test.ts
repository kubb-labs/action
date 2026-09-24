import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/utils/process.js', () => ({ captureCommand: vi.fn() }))

const { captureCommand } = await import('../src/utils/process.js')
const { resolveKubbBinary, runSnapshot } = await import('../src/utils/cli.js')

const tempDirs: Array<string> = []

function makeProject(withLocalBinary: boolean): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'kubb-action-'))
  tempDirs.push(dir)

  if (withLocalBinary) {
    mkdirSync(path.join(dir, 'node_modules', '.bin'), { recursive: true })
    writeFileSync(path.join(dir, 'node_modules', '.bin', 'kubb'), '#!/usr/bin/env node\n')
  }

  return dir
}

afterEach(() => {
  vi.clearAllMocks()
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('resolveKubbBinary', () => {
  it("prefers the project's own kubb binary when it has one", () => {
    const project = makeProject(true)

    expect(resolveKubbBinary(project)).toEqual({ command: path.join(project, 'node_modules', '.bin', 'kubb'), args: [] })
  })

  it('falls back to npx with both @kubb/cli and @kubb/studio when the project has no local kubb', () => {
    const project = makeProject(false)

    expect(resolveKubbBinary(project)).toEqual({ command: 'npx', args: ['--yes', '--package', '@kubb/cli', '--package', '@kubb/studio', 'kubb'] })
  })
})

describe('runSnapshot', () => {
  it('runs kubb studio snapshot with --json and parses the result', async () => {
    const project = makeProject(true)
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.mocked(captureCommand).mockResolvedValue(
      `${JSON.stringify({
        id: 'snap-1',
        name: '@kubb/demo',
        version: '1.0.0',
        integrity: 'sha512-abc',
        url: 'https://kubb.studio/packages/demo.tgz',
        snapshotIdUrl: 'https://kubb.studio/packages/snap-1/snapshot.tgz',
        expiresAt: '2026-01-08T00:00:00.000Z',
        agentUrl: 'https://kubb.studio/agents/brave-otter',
      })}\n[four-walls-vanish] Disconnected from Studio\n`,
    )

    const snapshot = await runSnapshot({ workingDirectory: project, config: '/repo/kubb.config.ts', token: 'ci-token' })

    expect(snapshot).toMatchObject({ id: 'snap-1', name: '@kubb/demo' })
    const [command, args, env] = vi.mocked(captureCommand).mock.calls[0]!
    expect(command).toBe(path.join(project, 'node_modules', '.bin', 'kubb'))
    // No --id: the CLI detects the CI agent identity from the environment on its own.
    expect(args).toEqual(['studio', 'snapshot', '--json', '--config', '/repo/kubb.config.ts', '--url', 'https://kubb.studio'])
    expect(env?.KUBB_TOKEN).toBe('ci-token')
    expect(info).toHaveBeenCalledWith(`Kubb Studio snapshot: binary=${command}, url=https://kubb.studio`)
  })

  it('passes the changes the CLI reports through untouched', async () => {
    const project = makeProject(true)
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const changes = {
      base: { id: 'snap-0', version: '1.0.0', commit: '9f3e2a1', createdAt: '2026-01-01T00:00:00.000Z' },
      added: ['a.ts'],
      changed: [],
      removed: [],
    }
    vi.mocked(captureCommand).mockResolvedValue(
      JSON.stringify({
        id: 'snap-1',
        name: '@kubb/demo',
        version: '1.0.0',
        integrity: 'sha512-abc',
        url: 'https://kubb.studio/packages/demo.tgz',
        snapshotIdUrl: 'https://kubb.studio/packages/snap-1/snapshot.tgz',
        expiresAt: '2026-01-08T00:00:00.000Z',
        agentUrl: 'https://kubb.studio/agents/brave-otter',
        changes,
      }),
    )

    const snapshot = await runSnapshot({ workingDirectory: project, config: '/repo/kubb.config.ts', token: 'ci-token' })

    expect(snapshot.changes).toEqual(changes)
  })
})
