import path from 'node:path'
import type { Config, PossibleConfig } from '@kubb/core'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url, { moduleCache: false })

/**
 * Extracts the module specifier Node couldn't resolve from a `MODULE_NOT_FOUND` error message,
 * e.g. `Cannot find module '@kubb/plugin-ts'` → `@kubb/plugin-ts`.
 */
function getMissingModule(error: NodeJS.ErrnoException): string | undefined {
  return /Cannot find module '([^']+)'/.exec(error.message ?? '')?.[1]
}

/**
 * Loads the Kubb config at `configPath` and returns the first config it defines.
 *
 * The action is pointed at one explicit file (the `config` input), so there is no discovery here:
 * that is the CLI's job, and `kubb.config.ts`'s own devDependencies (e.g. `kubb`) resolve relative
 * to it since the action runs from inside the checked-out repo.
 */
export async function loadConfig(configPath: string): Promise<Config> {
  const absolutePath = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath)

  try {
    const mod = (await jiti.import(absolutePath, { default: true })) as PossibleConfig
    const resolved = await (typeof mod === 'function' ? mod() : mod)
    const [config] = Array.isArray(resolved) ? resolved : [resolved]

    if (!config) {
      throw new Error(`No config exported from "${absolutePath}"`)
    }

    return { ...config, plugins: config.plugins ?? [] }
  } catch (error) {
    const e = error as NodeJS.ErrnoException
    const isModuleNotFound = e.code === 'MODULE_NOT_FOUND' || e.code === 'ERR_MODULE_NOT_FOUND'
    const missingModule = isModuleNotFound ? getMissingModule(e) : undefined

    const message = missingModule
      ? `Kubb config at "${absolutePath}" imports "${missingModule}", which is not installed. Add it to the repository's dependencies.`
      : (e.message ?? String(error))

    throw new Error('Config failed loading', { cause: message === e.message ? error : new Error(message, { cause: error }) })
  }
}
