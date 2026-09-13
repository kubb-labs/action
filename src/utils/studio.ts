import { context } from '@actions/github'
import { createHmac } from 'node:crypto'

type Agent = { id: string; slug: string; token: string }
type ErrorResponse = { message?: string; data?: { upgradeUrl?: string } }
export type Snapshot = {
  id: string
  integrity: string
  expiresAt: string
  url: string
  name?: string
  packageName?: string
  version?: string
  packageVersion?: string
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

export function machineToken(apiKey: string, repositoryId: string): string {
  return createHmac('sha256', apiKey).update(`gh:${repositoryId}`).digest('hex')
}

export function absoluteUrl(path: string): string {
  return new URL(path, `${studioUrl}/`).toString()
}

export async function createAgent(token: string, name: string, repositoryId: string): Promise<Agent> {
  return request('/api/agents', token, { method: 'POST', body: JSON.stringify({ name, machineToken: machineToken(token, repositoryId) }) })
}

export async function createSnapshot(agentId: string, token: string, metadata: { name: string; version: string }): Promise<Snapshot> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      return request('/api/snapshots', token, {
        method: 'POST',
        body: JSON.stringify({ agentId, name: metadata.name, version: metadata.version, commitSha: context.sha }),
      })
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith('Kubb Studio 503:'))) throw error
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000))
  }
  throw new Error('Timed out waiting for the Kubb Studio agent to connect')
}

export function snapshotDetails(snapshot: Snapshot, agentId: string): SnapshotDetails {
  return {
    id: snapshot.id,
    integrity: snapshot.integrity,
    expiresAt: snapshot.expiresAt,
    name: snapshot.packageName ?? snapshot.name ?? `@kubb/snapshot-${agentId}`,
    version: snapshot.packageVersion ?? snapshot.version ?? '0.0.0',
    url: absoluteUrl(snapshot.url),
  }
}
