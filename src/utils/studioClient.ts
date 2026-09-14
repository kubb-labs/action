import * as core from '@actions/core'
import { createClient } from '@kubb/studio'
import { loadConfig } from './loadConfig.js'
import { actionVersion } from './package.js'
import { studioUrl } from './studio.js'

/**
 * How long to wait for Studio's `studio:ready` acknowledgement after the socket opens, before
 * giving up and failing the run. Comfortably above the client's own 10s handshake-ack timeout.
 */
export const READY_TIMEOUT_MS = 15_000

/**
 * Connects to Kubb Studio and resolves once it acknowledges the agent is registered and can
 * receive jobs (`studio:ready`), not merely once the socket is open.
 */
export async function connectAndWaitUntilReady(config: string, agentToken: string): Promise<ReturnType<typeof createClient>> {
  const { promise: ready, resolve: markReady } = Promise.withResolvers<void>()
  const client = createClient({
    studioUrl,
    token: agentToken,
    configPath: config,
    root: process.cwd(),
    version: actionVersion(),
    client: { kind: 'ci' },
    loadConfig: () => loadConfig(config),
    installLogger: (hooks) => {
      hooks.hook('studio:ready', () => markReady())
      hooks.hook('studio:connected', ({ url }) => core.info(`Connected to ${url}`))
      hooks.hook('studio:warn', ({ message }) => core.warning(message))
      hooks.hook('studio:error', ({ error }) => core.warning(error.message))
    },
  })

  await client.connect()
  await Promise.race([
    ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out waiting for Kubb Studio to confirm the agent was ready')), READY_TIMEOUT_MS),
    ),
  ])

  return client
}
