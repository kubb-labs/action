import { afterEach, expect, test, vi } from 'vitest'
import { absoluteUrl, createSnapshot, machineToken } from '../src/utils/studio'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('derives a stable per-PR machine token and resolves Studio URLs', () => {
  expect(machineToken('repo:1')).toBe(machineToken('repo:1'))
  expect(machineToken('repo:1')).not.toBe(machineToken('repo:2'))
  expect(absoluteUrl('/packages/snapshot.tgz')).toBe('https://kubb.studio/packages/snapshot.tgz')
})

test('creates a snapshot through the async jobs API', async () => {
  vi.useFakeTimers()
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ job: { id: 'job-1', status: 'queued' } }), { status: 202, headers: { 'content-type': 'application/json' } }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ job: { id: 'job-1', status: 'running' } }), { headers: { 'content-type': 'application/json' } }))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          job: {
            id: 'job-1',
            status: 'success',
            snapshot: {
              id: 'snap-1',
              name: '@kubb/demo',
              version: '1.0.0',
              integrity: 'sha512-abc',
              url: '/packages/demo.tgz',
              snapshotIdUrl: '/packages/snap-1/snapshot.tgz',
              expiresAt: '2026-01-01',
            },
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    )
  vi.stubGlobal('fetch', fetchMock)

  const promise = createSnapshot('agent-1', 'ci-token', { name: '@kubb/demo', version: '1.0.0' })
  await vi.advanceTimersByTimeAsync(1000)

  await expect(promise).resolves.toMatchObject({ id: 'snap-1', name: '@kubb/demo', version: '1.0.0' })
  expect(fetchMock.mock.calls[0]?.[0]).toBe('https://kubb.studio/api/jobs')
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
    type: 'snapshot',
    agentId: 'agent-1',
    name: '@kubb/demo',
    version: '1.0.0',
  })
  expect(fetchMock.mock.calls[1]?.[0]).toBe('https://kubb.studio/api/jobs/job-1')
})
