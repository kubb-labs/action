import { expect, test } from 'vitest'
import { absoluteUrl, machineToken } from '../src/index'

test('derives a stable machine token and resolves Studio URLs', () => {
  expect(machineToken('secret', '123')).toBe(machineToken('secret', '123'))
  expect(machineToken('secret', '123')).not.toBe(machineToken('secret', '456'))
  expect(absoluteUrl('/packages/snapshot.tgz')).toBe('https://kubb.studio/packages/snapshot.tgz')
})
