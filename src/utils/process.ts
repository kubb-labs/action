import { spawn } from 'node:child_process'

export function runCommand(command: string, args: string[], env = process.env): Promise<void> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolveCommand() : reject(new Error(`${command} exited with ${code}`))))
  })
}

/**
 * Runs a command, routes stderr to the Actions log, and returns stdout for structured parsing. A
 * failure's error ends with the last of stderr, where the CLI says why it failed.
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
      stderr = (stderr + chunk.toString()).slice(-2_000)
    })
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolveCommand(stdout) : reject(new Error(`${command} exited with ${code}\n${stderr.trim()}`))))
  })
}
