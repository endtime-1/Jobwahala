import { spawn } from 'node:child_process'
import process from 'node:process'

const children = []
let shuttingDown = false

const startProcess = (name, args) => {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm'
  const commandArgs =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `npm ${args.join(' ')}`]
      : args

  const child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) return

    const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`
    console.error(`[jobwahala:${name}] exited with ${detail}`)
    shutdown(code ?? 0)
  })

  child.on('error', (error) => {
    if (shuttingDown) return

    console.error(`[jobwahala:${name}] failed to start: ${error.message}`)
    shutdown(1)
  })

  children.push(child)
}

const shutdown = (exitCode = 0) => {
  if (shuttingDown) return
  shuttingDown = true

  const activeChildren = children.filter((child) => child.exitCode === null && !child.killed)

  if (activeChildren.length === 0) {
    process.exit(exitCode)
    return
  }

  let remaining = activeChildren.length
  const finalize = () => {
    remaining -= 1
    if (remaining <= 0) {
      process.exit(exitCode)
    }
  }

  for (const child of activeChildren) {
    child.once('exit', finalize)
    child.kill('SIGTERM')
  }

  setTimeout(() => {
    for (const child of activeChildren) {
      if (child.killed) continue
      child.kill('SIGKILL')
    }
  }, 2000).unref()
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

startProcess('backend', ['run', 'dev:backend'])
startProcess('frontend', ['run', 'dev:frontend'])
