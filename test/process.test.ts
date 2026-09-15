import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureCommand } from '../src/utils/process.js'

afterEach(() => vi.restoreAllMocks())

describe('captureCommand', () => {
  it('captures stdout and routes stderr', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await expect(captureCommand(process.execPath, ['-e', "process.stdout.write('snapshot output'); process.stderr.write('snapshot error')"])).resolves.toBe(
      'snapshot output',
    )
    expect(stdout).not.toHaveBeenCalled()
    expect(stderr).toHaveBeenCalledWith(expect.any(Buffer))
  })
})
