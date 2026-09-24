import { spawn } from 'node:child_process'

export function runCommand(command: string, args: string[], env = process.env): Promise<void> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolveCommand() : reject(new Error(`${command} exited with ${code}`))))
  })
}

/**
 * How much of a failed command's stderr its error keeps, so the reason can be shown elsewhere.
 */
const STDERR_TAIL_CHARS = 4_000

/**
 * A command that exited non-zero, with the end of what it wrote to stderr.
 */
export class CommandError extends Error {
  readonly stderr: string

  constructor(message: string, stderr: string) {
    super(message)
    this.name = 'CommandError'
    this.stderr = stderr
  }
}

// oxlint-disable-next-line no-control-regex -- matching the escape character is the point
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g

/**
 * Runs a command, routes stderr to the Actions log, and returns stdout for structured parsing. A
 * non-zero exit rejects with a {@link CommandError} carrying the end of stderr.
 */
export function captureCommand(command: string, args: string[], env = process.env): Promise<string> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk)
      stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL_CHARS)
    })
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0 ? resolveCommand(stdout) : reject(new CommandError(`${command} exited with ${code}`, stderr.replace(ANSI_PATTERN, '').trim())),
    )
  })
}
