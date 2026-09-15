import { spawn } from 'node:child_process'

export function runCommand(command: string, args: string[], env = process.env): Promise<void> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolveCommand() : reject(new Error(`${command} exited with ${code}`))))
  })
}

/**
 * Runs a command and returns its stdout, so a caller can parse structured output. `stderr` stays
 * on `inherit`, so the child's progress output still reaches the Actions log while stdout stays
 * clean for whatever the caller parses.
 */
export function captureCommand(command: string, args: string[], env = process.env): Promise<string> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'inherit'] })
    let stdout = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolveCommand(stdout) : reject(new Error(`${command} exited with ${code}`))))
  })
}
