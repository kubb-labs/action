import * as core from '@actions/core'
import { createClient } from '@kubb/studio'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
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
  const { promise: ready, reject: markFailed, resolve: markReady } = Promise.withResolvers<void>()
  const configPath = resolve(process.cwd(), config)
  let loggedPlugins = false
  const client = createClient({
    studioUrl,
    token: agentToken,
    configPath: config,
    root: process.cwd(),
    version: actionVersion(),
    client: { kind: 'ci' },
    loadConfig: async () => {
      const loadedConfig = await loadConfig(configPath)
      if (!loggedPlugins) {
        const require = createRequire(configPath)
        const plugins = (loadedConfig.plugins ?? []).map((plugin) => {
          try {
            require.resolve(`${plugin.name}/package.json`)
            return `${plugin.name} (ok)`
          } catch {
            return `${plugin.name} (missing)`
          }
        })
        core.info(`Kubb config plugins: ${plugins.join(', ') || '(none)'}`)
        loggedPlugins = true
      }
      return loadedConfig
    },
    installLogger: (hooks) => {
      hooks.hook('studio:ready', () => markReady())
      hooks.hook('studio:connected', ({ url }) => core.info(`Connected to ${url}`))
      hooks.hook('studio:warn', ({ message }) => core.warning(message))
      hooks.hook('studio:error', ({ error }) => {
        core.warning(error.message)
        markFailed(error)
      })
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
