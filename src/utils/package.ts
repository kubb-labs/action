import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function findPackageJson(startDirectory: string): { name: string; version: string } {
  let directory = startDirectory
  while (true) {
    const file = join(directory, 'package.json')
    if (existsSync(file)) {
      const packageJson = JSON.parse(readFileSync(file, 'utf8')) as Partial<{ name: string; version: string }>
      if (packageJson.name && packageJson.version) return { name: packageJson.name, version: packageJson.version }
    }
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  throw new Error(`No package.json with name and version found above ${startDirectory}`)
}

/**
 * This action's own version. Walks up from the running file's own directory rather than
 * `process.cwd()` (the target repo's checkout, which is what {@link packageMetadata} reads), so it
 * finds `action/package.json` whether running bundled from `dist/` or unbundled from `src/utils/`.
 */
export function actionVersion(): string {
  return findPackageJson(dirname(fileURLToPath(import.meta.url))).version
}

export function packageMetadata(): { name: string; version: string } {
  return findPackageJson(process.cwd())
}
