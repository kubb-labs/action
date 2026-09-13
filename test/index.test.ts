import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { expect, test } from 'vitest'
import { stop } from '../src/utils/process'
import { absoluteUrl, machineToken } from '../src/utils/studio'

test('derives a stable per-PR machine token and resolves Studio URLs', () => {
  expect(machineToken('repo:1')).toBe(machineToken('repo:1'))
  expect(machineToken('repo:1')).not.toBe(machineToken('repo:2'))
  expect(absoluteUrl('/packages/snapshot.tgz')).toBe('https://kubb.studio/packages/snapshot.tgz')
})

test('stops the Studio process before the action exits', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: process.platform !== 'win32', stdio: 'ignore' })
  await once(child, 'spawn')
  await stop(child)
  expect(child.signalCode).toBe('SIGTERM')
})
