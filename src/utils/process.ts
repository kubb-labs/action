import { spawn, type ChildProcess } from 'node:child_process'

export function runCommand(command: string, args: string[], env = process.env): Promise<void> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolveCommand() : reject(new Error(`${command} exited with ${code}`))))
  })
}

export function startStudio(url: string, agentToken: string, config = 'kubb.config.ts'): ChildProcess {
  const { INPUT_TOKEN: _inputToken, KUBB_TOKEN: _kubbToken, ...safeEnv } = process.env
  return spawn('npx', ['kubb', 'studio', '--url', url, '--config', config], { env: { ...safeEnv, KUBB_AGENT_TOKEN: agentToken }, stdio: 'inherit' })
}

export function stop(child: ChildProcess): void {
  if (!child.killed) child.kill('SIGTERM')
}
