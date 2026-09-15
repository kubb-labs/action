import { createHash } from 'node:crypto'
import { createJob, waitForJob, type StudioSnapshot } from '@kubb/studio'

type Agent = { id: string; slug: string; token: string }
type ErrorResponse = { message?: string; data?: { upgradeUrl?: string } }

export type Snapshot = StudioSnapshot
export type SnapshotDetails = { id: string; integrity: string; expiresAt: string; name: string; version: string; url: string }

export const studioUrl = (process.env.KUBB_STUDIO_URL ?? 'https://kubb.studio').replace(/\/$/, '')

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${studioUrl}${path}`, {
    ...init,
    headers: { 'x-api-key': token, 'content-type': 'application/json', ...init.headers },
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
 * Queues a snapshot job on Studio (`POST /api/jobs`) and waits until it finishes.
 *
 * Thin wrapper around {@link createJob} and {@link waitForJob} from `@kubb/studio`. Replaces the
 * old blocking `POST /api/snapshots` call.
 */
export async function createSnapshot(agentId: string, token: string, metadata: { name: string; version: string }): Promise<Snapshot> {
  const job = await createJob({
    studioUrl,
    token,
    type: 'snapshot',
    agentId,
    name: metadata.name,
    version: metadata.version,
  })

  const finished = await waitForJob({ studioUrl, token, id: job.id })

  if (finished.status === 'failed') throw new Error(finished.error ?? 'Snapshot job failed')
  if (!finished.snapshot) throw new Error('Snapshot job succeeded without a snapshot')

  return finished.snapshot
}

export function snapshotDetails(snapshot: Snapshot, agentId: string): SnapshotDetails {
  return {
    id: snapshot.id,
    integrity: snapshot.integrity ?? '',
    expiresAt: snapshot.expiresAt,
    name: snapshot.name ?? `@kubb/snapshot-${agentId}`,
    version: snapshot.version ?? '0.0.0',
    url: absoluteUrl(snapshot.url),
  }
}
