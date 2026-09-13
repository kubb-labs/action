import { spawn, type ChildProcess } from 'node:child_process'

export function runCommand(command: string, args: string[], env = process.env): Promise<void> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolveCommand() : reject(new Error(`${command} exited with ${code}`))))
  })
}

export function startStudio(url: string, agentToken: string, config = 'kubb.config.ts', machineSecret?: string): ChildProcess {
  const { INPUT_TOKEN: _inputToken, KUBB_TOKEN: _kubbToken, ...safeEnv } = process.env
  return spawn('npx', ['kubb', 'studio', '--url', url, '--config', config], {
    detached: process.platform !== 'win32',
    env: { ...safeEnv, KUBB_AGENT_TOKEN: agentToken, ...(machineSecret ? { KUBB_AGENT_SECRET: machineSecret } : {}) },
    stdio: 'inherit',
  })
}

export async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || !child.pid) return

  const kill = (signal: NodeJS.Signals) => {
    try {
      return process.platform === 'win32' ? child.kill(signal) : process.kill(-child.pid!, signal)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      return false
    }
  }
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))

  kill('SIGTERM')
  const timeout = setTimeout(() => kill('SIGKILL'), 5_000)
  await exited.finally(() => clearTimeout(timeout))
}
