import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function packageMetadata(): { name: string; version: string } {
  let directory = process.cwd()
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
  throw new Error('No package.json with name and version found for the current working directory')
}
