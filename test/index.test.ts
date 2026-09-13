import { expect, test } from 'vitest'
import { live, machineToken } from '../src/index'

test('derives a stable machine token and detects live sessions', () => {
  expect(machineToken('secret', '123')).toBe(machineToken('secret', '123'))
  expect(machineToken('secret', '123')).not.toBe(machineToken('secret', '456'))
  expect(live({ wsUrl: 'wss://studio/session' })).toBe(true)
  expect(live({ status: 'offline' })).toBe(false)
})
