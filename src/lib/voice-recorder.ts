export const MAX_VOICE_MS = 60_000
const MIN_VOICE_MS = 300
// Leave a little room for the last encoded audio frame at the minute mark.
const STOP_AFTER_MS = MAX_VOICE_MS - 150

export type RecordedVoice = { audio: Blob; durationMs: number }

export function releaseMicrophone(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop()
}

function createRecorder(stream: MediaStream) {
  const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const mimeType of types) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mimeType)) {
      try {
        return new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 })
      } catch {
        // Let the browser choose a working container if its advertised one fails.
      }
    }
  }
  return new MediaRecorder(stream)
}

// Owns the acquired stream. Stopping flushes the final chunk and releases
// the microphone before the calling component writes anything to storage.
export async function recordVoice(
  stream: MediaStream,
  stopSignal: AbortSignal,
  onStart: (start: number) => void,
  onStop: () => void,
): Promise<RecordedVoice | null> {
  let released = false
  const release = () => {
    if (released) return
    released = true
    releaseMicrophone(stream)
  }

  try {
    if (stopSignal.aborted) return null
    const recorder = createRecorder(stream)
    return await new Promise((resolve, reject) => {
      const chunks: Blob[] = []
      let startedAt = performance.now()
      let stoppedAt: number | undefined
      let timer: ReturnType<typeof setTimeout> | undefined

      function cleanup() {
        clearTimeout(timer)
        stopSignal.removeEventListener('abort', requestStop)
        recorder.removeEventListener('dataavailable', collect)
        recorder.removeEventListener('stop', finish)
        recorder.removeEventListener('error', fail)
        release()
      }
      function collect(event: BlobEvent) {
        if (event.data.size > 0) chunks.push(event.data)
      }
      function finish() {
        if (stoppedAt === undefined) onStop()
        const durationMs = Math.round((stoppedAt ?? performance.now()) - startedAt)
        cleanup()
        // If the page was suspended and missed the cutoff, don't keep an
        // overlong clip or report a shorter duration than we recorded.
        if (durationMs > MAX_VOICE_MS) {
          reject(new Error('Запись прервалась и превысила минуту. Попробуй ещё раз, не сворачивая вкладку.'))
          return
        }
        if (durationMs < MIN_VOICE_MS || !chunks.length) {
          resolve(null)
          return
        }
        const audio = new Blob(chunks, { type: chunks[0]?.type || recorder.mimeType })
        resolve({ audio, durationMs })
      }
      function fail() {
        cleanup()
        reject(new Error('Не удалось закончить запись. Попробуй ещё раз.'))
      }
      function requestStop() {
        if (stoppedAt !== undefined) return
        stoppedAt = performance.now()
        clearTimeout(timer)
        onStop()
        try {
          if (recorder.state !== 'inactive') recorder.stop()
        } catch {
          fail()
        } finally {
          release()
        }
      }

      recorder.addEventListener('dataavailable', collect)
      recorder.addEventListener('stop', finish, { once: true })
      recorder.addEventListener('error', fail, { once: true })
      stopSignal.addEventListener('abort', requestStop, { once: true })

      try {
        startedAt = performance.now()
        recorder.start()
        timer = setTimeout(requestStop, STOP_AFTER_MS)
        onStart(startedAt)
      } catch {
        fail()
      }
    })
  } finally {
    release()
  }
}
