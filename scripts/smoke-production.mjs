import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
const child = spawn(process.execPath, ['dist-server/index.js'], {
  env: { ...process.env, PORT: '0', HOST: '127.0.0.1', REPORT_ENABLED: 'false', DATA_MODE: 'mock' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
const ready = new Promise((resolve, reject) => {
  child.stdout.on('data', chunk => { output += chunk; if (output.includes('Mission Control API:')) resolve() })
  child.stderr.on('data', chunk => { output += chunk })
  child.once('error', reject)
  child.once('exit', code => reject(new Error('Production server exited: ' + code + '\n' + output)))
})
const timeout = setTimeout(() => child.kill(), 15000)
try { await ready; assert(child.exitCode === null); console.log('Production bundle starts successfully with native node:sqlite') }
finally { clearTimeout(timeout); child.kill(); await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve) }) }
