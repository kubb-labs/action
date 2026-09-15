import { createHash } from 'node:crypto'

export function machineSecret(repositoryId: string): string {
  return `gh:${repositoryId}`
}

export function machineToken(repositoryId: string): string {
  return createHash('sha256').update(machineSecret(repositoryId)).digest('hex')
}
