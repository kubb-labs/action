import { expect, test } from 'vitest'
import { absoluteUrl, machineToken } from '../src/utils/studio'

test('derives a stable per-PR machine token and resolves Studio URLs', () => {
  expect(machineToken('repo:1')).toBe(machineToken('repo:1'))
  expect(machineToken('repo:1')).not.toBe(machineToken('repo:2'))
  expect(absoluteUrl('/packages/snapshot.tgz')).toBe('https://kubb.studio/packages/snapshot.tgz')
})
