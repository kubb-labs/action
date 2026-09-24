import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommandError, captureCommand } from '../src/utils/process.js'

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

  it('rejects a failed command with the end of its stderr, without color codes', async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const failure = captureCommand(process.execPath, [
      '-e',
      "process.stderr.write('Generating\\n\\u001b[31mSnapshot job failed: offline\\u001b[39m\\n'); process.exit(1)",
    ])

    await expect(failure).rejects.toBeInstanceOf(CommandError)
    await expect(failure).rejects.toMatchObject({ stderr: 'Generating\nSnapshot job failed: offline' })
  })
})
