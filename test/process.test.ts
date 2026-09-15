import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureCommand } from '../src/utils/process.js'

afterEach(() => vi.restoreAllMocks())

describe('captureCommand', () => {
  it('logs and returns stdout', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await expect(captureCommand(process.execPath, ['-e', "process.stdout.write('snapshot output')"])).resolves.toBe('snapshot output')
    expect(write).toHaveBeenCalledWith(expect.any(Buffer))
  })
})
