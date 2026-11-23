import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_VOICE_MS, recordVoice } from '../src/lib/voice-recorder.ts'

function simulatedRecorder(t) {
  let now = 0
  let released = 0
  let started = 0
  let stopped = 0
  const original = globalThis.MediaRecorder
  t.after(() => { globalThis.MediaRecorder = original })
  t.mock.method(performance, 'now', () => now)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  globalThis.MediaRecorder = class extends EventTarget {
    state = 'inactive'
    mimeType = 'audio/webm'
    static isTypeSupported() { return true }
    start() {
      started++
      this.state = 'recording'
    }
    stop() {
      stopped++
      this.state = 'inactive'
      queueMicrotask(() => {
        const chunk = new Event('dataavailable')
        Object.defineProperty(chunk, 'data', { value: new Blob(['synthetic clip'], { type: this.mimeType }) })
        this.dispatchEvent(chunk)
        this.dispatchEvent(new Event('stop'))
      })
    }
  }
  const stream = { getTracks: () => [{ stop: () => { released++ } }] }
  const controller = new AbortController()
  return {
    controller, stream,
    at: value => { now = value },
    counts: () => ({ released, started, stopped }),
  }
}

test('releasing the button flushes the final chunk and releases the microphone before saving', async t => {
  const device = simulatedRecorder(t)
  const clip = recordVoice(device.stream, device.controller.signal, () => {}, () => {})
  device.at(840)
  device.controller.abort()
  assert.deepEqual(device.counts(), { released: 1, started: 1, stopped: 1 })
  const note = await clip
  assert.equal(note.durationMs, 840)
  assert.equal(await note.audio.text(), 'synthetic clip')
  t.mock.timers.tick(MAX_VOICE_MS)
  assert.equal(device.counts().stopped, 1)
})

test('releasing before the permission prompt is answered does not start capture', async t => {
  const device = simulatedRecorder(t)
  device.controller.abort()
  assert.equal(await recordVoice(device.stream, device.controller.signal, () => {}, () => {}), null)
  assert.deepEqual(device.counts(), { released: 1, started: 0, stopped: 0 })
})

test('the recorder stops after a minute even when the button is still held', async t => {
  const device = simulatedRecorder(t)
  const clip = recordVoice(device.stream, device.controller.signal, () => {}, () => {})
  device.at(MAX_VOICE_MS - 150)
  t.mock.timers.tick(MAX_VOICE_MS)
  assert.deepEqual(device.counts(), { released: 1, started: 1, stopped: 1 })
  const note = await clip
  assert.ok(note.durationMs <= MAX_VOICE_MS)
  assert.equal(device.controller.signal.aborted, false)
})

test('a suspended tab that misses the cutoff does not save an overlong clip', async t => {
  const device = simulatedRecorder(t)
  const clip = recordVoice(device.stream, device.controller.signal, () => {}, () => {})
  device.at(MAX_VOICE_MS + 5000)
  t.mock.timers.tick(MAX_VOICE_MS)
  await assert.rejects(clip, /превысила минуту/)
  assert.equal(device.counts().released, 1)
})
