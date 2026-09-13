import { expect, test } from 'vitest'

test('action scaffold is importable', async () => {
  expect(typeof (await import('../src/index')).run).toBe('function')
})
