import { createHash } from 'node:crypto'

type Agent = { id: string; slug: string; token: string }
type ErrorResponse = { message?: string; data?: { upgradeUrl?: string } }
type JobStatus = 'queued' | 'running' | 'success' | 'failed'
type Job = {
  id: string
  status: JobStatus
  error?: string
  snapshot?: Snapshot
}

export type Snapshot = {
  id: string
  integrity: string | null
  expiresAt: string
  url: string
  name?: string | null
  packageName?: string
  version?: string | null
  packageVersion?: string
  snapshotIdUrl?: string
}
export type SnapshotDetails = { id: string; integrity: string; expiresAt: string; name: string; version: string; url: string }

export const studioUrl = (process.env.KUBB_STUDIO_URL ?? 'https://kubb.studio').replace(/\/$/, '')

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${studioUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'x-api-key': token, 'content-type': 'application/json', ...init.headers },
  })
  const text = await response.text()
  let body: ErrorResponse = {}
  try {
    body = JSON.parse(text) as ErrorResponse
  } catch {
    // Keep the status useful when the server returns a proxy error page.
  }
  if (!response.ok) {
    const upgradeUrl = body.data?.upgradeUrl
    const detail = upgradeUrl ? ` Agent limit reached; upgrade at ${String(upgradeUrl)}.` : ''
    throw new Error(`Kubb Studio ${response.status}: ${String(body.message ?? text).slice(0, 500)}${detail}`)
  }
  return body as T
}

export function machineSecret(repositoryId: string): string {
  return `gh:${repositoryId}`
}

export function machineToken(repositoryId: string): string {
  return createHash('sha256').update(machineSecret(repositoryId)).digest('hex')
}

export function absoluteUrl(path: string): string {
  return new URL(path, `${studioUrl}/`).toString()
}

export async function createAgent(token: string, name: string, repositoryId: string): Promise<Agent> {
  return request('/api/agents', token, { method: 'POST', body: JSON.stringify({ name, machineToken: machineToken(repositoryId) }) })
}

/**
 * Queues a snapshot job on Studio and polls until it finishes. Replaces the old synchronous
 * `POST /api/snapshots` call.
 */
export async function createSnapshot(agentId: string, token: string, metadata: { name: string; version: string }): Promise<Snapshot> {
  const { job } = await request<{ job: Job }>('/api/jobs', token, {
    method: 'POST',
    body: JSON.stringify({ type: 'snapshot', agentId, name: metadata.name, version: metadata.version }),
  })

  for (let attempt = 0; attempt < 60; attempt++) {
    const { job: current } = await request<{ job: Job }>(`/api/jobs/${job.id}`, token)

    if (current.status === 'success') {
      if (!current.snapshot) throw new Error('Snapshot job succeeded without a snapshot')
      return current.snapshot
    }
    if (current.status === 'failed') throw new Error(current.error ?? 'Snapshot job failed')

    await new Promise((resolveWait) => setTimeout(resolveWait, 1000))
  }

  throw new Error('Timed out waiting for the snapshot job')
}

export function snapshotDetails(snapshot: Snapshot, agentId: string): SnapshotDetails {
  return {
    id: snapshot.id,
    integrity: snapshot.integrity ?? '',
    expiresAt: snapshot.expiresAt,
    name: snapshot.packageName ?? snapshot.name ?? `@kubb/snapshot-${agentId}`,
    version: snapshot.packageVersion ?? snapshot.version ?? '0.0.0',
    url: absoluteUrl(snapshot.url),
  }
}
