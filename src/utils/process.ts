import { spawn } from 'node:child_process'

export function runCommand(command: string, args: string[], env = process.env): Promise<void> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolveCommand() : reject(new Error(`${command} exited with ${code}`))))
  })
}

/**
 * Runs a command, mirrors all output to the Actions log, and returns stdout for structured parsing.
 */
export function captureCommand(command: string, args: string[], env = process.env): Promise<string> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk)
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk))
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolveCommand(stdout) : reject(new Error(`${command} exited with ${code}`))))
  })
}
