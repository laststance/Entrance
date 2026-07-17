import { mkdirSync, writeFileSync } from 'node:fs'

import WebSocket from 'ws'

/**
 * QA driver for Entrance's OWN renderer via the dev-only remote-debugging port.
 * Connects ONLY to the app-window page target (localhost:5173) — never to the
 * recorded webview target (spec decision 8: Entrance is the sole CDP client of
 * the target). Usage:
 *   node scripts/qa-drive.mjs eval  "<js expression>"
 *   node scripts/qa-drive.mjs shot  /absolute/path.png
 */

const DEBUG_HTTP = 'http://127.0.0.1:9222'
const APP_RENDERER_URL_PREFIX = 'http://localhost:5173'
const COMMAND_TIMEOUT_MS = 15000

async function findAppPageTarget() {
  const response = await fetch(`${DEBUG_HTTP}/json/list`)
  const targets = await response.json()
  const appPage = targets.find(
    (t) => t.type === 'page' && (t.url ?? '').startsWith(APP_RENDERER_URL_PREFIX),
  )
  if (!appPage) {
    throw new Error(
      `app renderer target not found; pages: ${targets.map((t) => `${t.type}:${t.url}`).join(', ')}`,
    )
  }
  return appPage
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl, { maxPayload: 256 * 1024 * 1024 })
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

function sendCommand(socket, id, method, params) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`timeout: ${method}`)),
      COMMAND_TIMEOUT_MS,
    )
    const onMessage = (data) => {
      const message = JSON.parse(data.toString())
      if (message.id !== id) return
      clearTimeout(timeout)
      socket.off('message', onMessage)
      if (message.error) reject(new Error(`${method}: ${JSON.stringify(message.error)}`))
      else resolve(message.result)
    }
    socket.on('message', onMessage)
    socket.send(JSON.stringify({ id, method, params }))
  })
}

const [, , command, argument] = process.argv
const target = await findAppPageTarget()
const socket = await connect(target.webSocketDebuggerUrl)

try {
  if (command === 'eval') {
    const result = await sendCommand(socket, 1, 'Runtime.evaluate', {
      expression: argument,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      console.error('EXCEPTION:', JSON.stringify(result.exceptionDetails))
      process.exitCode = 1
    } else {
      console.log(JSON.stringify(result.result?.value ?? null))
    }
  } else if (command === 'shot') {
    const shot = await sendCommand(socket, 1, 'Page.captureScreenshot', { format: 'png' })
    writeFileSync(argument, Buffer.from(shot.data, 'base64'))
    console.log(`saved ${argument}`)
  } else if (command === 'burst') {
    // Motion QA (house rule: verify replay/animation from frames, not statics):
    // capture a frame series over ONE socket — assemble/inspect with ffmpeg.
    //   node scripts/qa-drive.mjs burst <dir> <frameCount> <intervalMs>
    const [, , , frameDir, frameCountRaw, intervalRaw] = process.argv
    const frameCount = Number(frameCountRaw ?? 30)
    const intervalMs = Number(intervalRaw ?? 300)
    mkdirSync(frameDir, { recursive: true })
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const startedAt = Date.now()
      const frame = await sendCommand(socket, 10 + frameIndex, 'Page.captureScreenshot', {
        format: 'png',
      })
      writeFileSync(
        `${frameDir}/frame_${String(frameIndex).padStart(3, '0')}.png`,
        Buffer.from(frame.data, 'base64'),
      )
      const elapsed = Date.now() - startedAt
      if (elapsed < intervalMs) await new Promise((r) => setTimeout(r, intervalMs - elapsed))
    }
    console.log(`saved ${frameCount} frames to ${frameDir}`)
  } else if (command === 'click') {
    // Trusted click on the APP renderer (Base UI poppers ignore synthetic
    // events): node scripts/qa-drive.mjs click <x> <y>
    const [, , , clickX, clickY] = process.argv
    const base = { x: Number(clickX), y: Number(clickY), button: 'left', clickCount: 1 }
    await sendCommand(socket, 1, 'Input.dispatchMouseEvent', { ...base, type: 'mousePressed' })
    await sendCommand(socket, 2, 'Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' })
    console.log(`clicked ${clickX},${clickY}`)
  } else {
    console.error('usage: qa-drive.mjs eval "<expr>" | shot <path.png> | burst <dir> <n> <ms> | click <x> <y>')
    process.exitCode = 1
  }
} finally {
  socket.close()
}
