import { expect, test } from 'vitest'
import { absoluteUrl, machineToken } from '../src/utils/studio'

test('derives a stable machine token and resolves Studio URLs', () => {
  expect(machineToken('123')).toBe(machineToken('123'))
  expect(machineToken('123')).not.toBe(machineToken('456'))
  expect(absoluteUrl('/packages/snapshot.tgz')).toBe('https://kubb.studio/packages/snapshot.tgz')
})
