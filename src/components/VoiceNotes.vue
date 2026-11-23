<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { Mic, Square, Trash2 } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Bubble, BubbleContent, BubbleGroup } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteVoiceNote, listVoiceNotes, saveVoiceNote, type VoiceNote } from '@/lib/voice-notes'
import { MAX_VOICE_MS, recordVoice, releaseMicrophone } from '@/lib/voice-recorder'

const props = defineProps<{ active: boolean }>()
type Phase = 'idle' | 'requesting' | 'recording' | 'saving'
type Preview = VoiceNote & { url: string }

const titleId = useId()
const hintId = useId()
const phase = ref<Phase>('idle')
const elapsed = ref(0)
const notes = shallowRef<Preview[]>([])
const draft = shallowRef<Preview | null>(null)
const deleting = shallowRef<Preview | null>(null)
const removing = ref(false)
const loading = ref(false)
const errorText = ref('')
const storageError = ref('')
const feedback = ref('')
const secureContext = window.isSecureContext
const available = secureContext && typeof navigator.mediaDevices?.getUserMedia === 'function'
  && typeof window.MediaRecorder === 'function' && typeof window.indexedDB !== 'undefined'
const stamp = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const urls = new Set<string>()
let attempt: AbortController | undefined
let mode: 'hold' | 'toggle' | undefined
let pointerId: number | undefined
let ticker: number | undefined
let player: HTMLAudioElement | undefined
let loaded = false
let disposed = false

const live = computed(() => phase.value === 'requesting' || phase.value === 'recording')
const disabled = computed(() => !available || loading.value || phase.value === 'saving' || !!draft.value)
const status = computed(() => {
  switch (phase.value) {
    case 'requesting': return 'Подключаю микрофон…'
    case 'recording': return 'Запись идёт'
    case 'saving': return 'Сохраняю запись…'
    default: return feedback.value || 'Зажми микрофон и говори'
  }
})

function timeText(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function makePreview(note: VoiceNote): Preview {
  const url = URL.createObjectURL(note.audio)
  urls.add(url)
  return { ...note, url }
}

function releasePreview(note: Preview) {
  if (player?.src === note.url) {
    player.pause()
    player = undefined
  }
  URL.revokeObjectURL(note.url)
  urls.delete(note.url)
}

async function load() {
  if (loaded || loading.value || !window.indexedDB) return
  loading.value = true
  try {
    const found = await listVoiceNotes()
    if (disposed) return
    notes.value = found.map(makePreview)
    loaded = true
    storageError.value = ''
  } catch {
    if (!disposed) storageError.value = 'Не удалось открыть сохранённые голосовые заметки.'
  } finally {
    loading.value = false
  }
}

function microphoneError(error: unknown) {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Доступ к микрофону закрыт. Разреши его в настройках сайта и попробуй снова.'
  }
  if (name === 'NotFoundError') return 'Микрофон не найден. Подключи его и попробуй снова.'
  if (name === 'NotReadableError' || name === 'AbortError') return 'Микрофон занят или недоступен. Проверь настройки устройства.'
  return 'Не удалось включить микрофон. Попробуй ещё раз.'
}

async function persist(note: Preview) {
  phase.value = 'saving'
  errorText.value = ''
  try {
    const { id, createdAt, durationMs, audio } = note
    await saveVoiceNote({ id, createdAt, durationMs, audio })
    if (disposed) return
    notes.value = [note, ...notes.value.filter(item => item.id !== note.id)]
    draft.value = null
    feedback.value = 'Голосовая заметка сохранена'
  } catch {
    if (!disposed) {
      draft.value = note
      errorText.value = 'Не удалось сохранить запись. Её можно прослушать и попробовать сохранить ещё раз.'
    }
  } finally {
    phase.value = 'idle'
  }
}

function stop() {
  attempt?.abort()
}

function visibilityChanged() {
  if (document.hidden) {
    stop()
    player?.pause()
  }
}

function windowBlurred() {
  if (mode === 'hold') stop()
}

async function start(kind: 'hold' | 'toggle') {
  if (!props.active || disabled.value || phase.value !== 'idle' || attempt) return
  errorText.value = ''
  feedback.value = ''
  elapsed.value = 0
  player?.pause()
  const controller = new AbortController()
  attempt = controller
  mode = kind
  phase.value = 'requesting'
  let acquired = false
  let createdAt = Date.now()

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    acquired = true
    if (controller.signal.aborted || disposed || !props.active || document.hidden) {
      releaseMicrophone(stream)
      if (!disposed) feedback.value = 'Микрофон готов. Запусти запись ещё раз.'
      return
    }
    const clip = await recordVoice(stream, controller.signal, startedAt => {
      createdAt = Date.now()
      phase.value = 'recording'
      ticker = window.setInterval(() => {
        elapsed.value = Math.min(MAX_VOICE_MS, performance.now() - startedAt)
      }, 100)
    }, () => {
      window.clearInterval(ticker)
      phase.value = 'saving'
    })
    if (!clip) {
      if (!disposed) feedback.value = 'Слишком короткая запись. Зажми и подержи чуть дольше.'
      return
    }
    const note: VoiceNote = { ...clip, id: crypto.randomUUID(), createdAt }
    if (disposed) {
      await saveVoiceNote(note)
    } else {
      await persist(makePreview(note))
    }
  } catch (error) {
    if (!disposed) errorText.value = acquired && error instanceof Error ? error.message : microphoneError(error)
  } finally {
    window.clearInterval(ticker)
    attempt = undefined
    mode = undefined
    phase.value = 'idle'
  }
}

function beginHold(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0 || pointerId !== undefined) return
  if (mode === 'toggle' && live.value) {
    stop()
    return
  }
  if (phase.value !== 'idle' || disabled.value) return
  pointerId = event.pointerId
  const target = event.currentTarget as HTMLElement
  try {
    target.setPointerCapture(event.pointerId)
  } catch {
    // Window listeners also catch release when capture is unavailable.
  }
  void start('hold')
}

function endHold(event: PointerEvent) {
  if (event.pointerId !== pointerId) return
  pointerId = undefined
  if (mode === 'hold') stop()
}

function toggle() {
  if (live.value) stop()
  else void start('toggle')
}

function keyboardClick(event: MouseEvent) {
  if (event.detail === 0) toggle()
}

function onPlay(event: Event) {
  const current = event.currentTarget as HTMLAudioElement
  if (!props.active || live.value) {
    current.pause()
    return
  }
  if (player !== current) player?.pause()
  player = current
}

function discardDraft() {
  if (!draft.value || phase.value === 'saving') return
  releasePreview(draft.value)
  draft.value = null
  errorText.value = ''
  feedback.value = 'Черновик удалён'
}

async function remove() {
  const note = deleting.value
  if (!note || removing.value) return
  removing.value = true
  errorText.value = ''
  try {
    await deleteVoiceNote(note.id)
    if (disposed) return
    notes.value = notes.value.filter(item => item.id !== note.id)
    releasePreview(note)
    deleting.value = null
    feedback.value = 'Запись удалена'
  } catch {
    if (!disposed) errorText.value = 'Не удалось удалить запись. Попробуй снова.'
  } finally {
    removing.value = false
  }
}

watch(() => props.active, active => {
  if (active) void load()
  else {
    stop()
    player?.pause()
    deleting.value = null
    pointerId = undefined
  }
}, { immediate: true, flush: 'sync' })

onMounted(() => {
  document.addEventListener('visibilitychange', visibilityChanged)
  window.addEventListener('blur', windowBlurred)
  window.addEventListener('pagehide', stop)
  window.addEventListener('pointerup', endHold)
  window.addEventListener('pointercancel', endHold)
})
onBeforeUnmount(() => {
  disposed = true
  stop()
  player?.pause()
  for (const url of urls) URL.revokeObjectURL(url)
  urls.clear()
  document.removeEventListener('visibilitychange', visibilityChanged)
  window.removeEventListener('blur', windowBlurred)
  window.removeEventListener('pagehide', stop)
  window.removeEventListener('pointerup', endHold)
  window.removeEventListener('pointercancel', endHold)
})
</script>

<template>
  <Card class="panel" role="region" :aria-labelledby="titleId">
    <CardHeader>
      <div class="panel-heading-row">
        <CardTitle class="panel-title"><h2 :id="titleId">Голосовые заметки</h2></CardTitle>
        <Badge variant="outline" class="counter-badge">До минуты</Badge>
      </div>
    </CardHeader>
    <CardContent class="voice-content">
      <template v-if="available">
        <div class="voice-capture" :data-recording="phase === 'recording' || undefined">
          <div class="voice-input">
            <Button
              type="button"
              size="icon"
              class="voice-mic"
              :variant="live ? 'outline' : 'default'"
              :disabled="disabled"
              :aria-label="live ? 'Остановить запись' : 'Записать голосовую заметку'"
              :aria-describedby="hintId"
              @pointerdown="beginHold"
              @pointerup="endHold"
              @pointercancel="endHold"
              @lostpointercapture="endHold"
              @contextmenu.prevent
              @click="keyboardClick"
            >
              <Square v-if="live" class="size-[18px]" fill="currentColor" aria-hidden="true" />
              <Mic v-else class="size-[22px]" aria-hidden="true" />
            </Button>
            <div class="voice-copy">
              <strong role="status">{{ status }}</strong>
              <p :id="hintId">
                {{ phase === 'recording' ? (mode === 'hold' ? 'Отпусти кнопку, чтобы сохранить' : 'Нажми «Остановить», чтобы сохранить') : 'Отпусти кнопку — запись сохранится' }}
              </p>
            </div>
            <span v-if="phase === 'recording' || phase === 'saving'" class="voice-clock" aria-hidden="true">
              {{ timeText(elapsed) }} / {{ timeText(MAX_VOICE_MS) }}
            </span>
          </div>
          <div v-if="phase === 'recording'" class="voice-meter" aria-hidden="true">
            <span :style="{ width: `${elapsed / MAX_VOICE_MS * 100}%` }" />
          </div>
        </div>
        <div class="voice-actions">
          <Button
            type="button"
            variant="ghost"
            class="voice-alt"
            :disabled="disabled"
            @click="toggle"
          >{{ live ? 'Остановить' : 'Без удержания' }}</Button>
          <span>Только в этом браузере</span>
        </div>
      </template>
      <p v-else class="voice-hint">
        {{ !secureContext
          ? 'Открой приложение по HTTPS или на localhost, чтобы записать голос.'
          : 'В этом браузере голосовая запись недоступна. Текстовые идеи можно добавлять как обычно.' }}
      </p>

      <p v-if="errorText || storageError" class="error voice-error" role="alert">{{ errorText || storageError }}</p>
      <div v-if="draft" class="voice-draft">
        <audio :src="draft.url" controls preload="none" aria-label="Прослушать несохранённую запись" @play="onPlay" />
        <div class="voice-actions">
          <Button type="button" size="sm" :disabled="phase === 'saving'" @click="persist(draft)">Сохранить ещё раз</Button>
          <Button type="button" variant="ghost" size="sm" :disabled="phase === 'saving'" @click="discardDraft">Удалить черновик</Button>
        </div>
      </div>

      <BubbleGroup v-if="notes.length" as="ul" class="diary-list voice-list" aria-label="Сохранённые голосовые заметки">
        <Bubble v-for="note in notes" :key="note.id" as="li" variant="muted" class="diary-bubble">
          <BubbleContent class="diary-bubble-content">
            <div class="voice-note-head">
              <div class="voice-note-info">
                <time :datetime="new Date(note.createdAt).toISOString()">{{ stamp.format(note.createdAt) }}</time>
                <Badge variant="outline" class="counter-badge">{{ note.durationMs < 1000 ? '< 1 с' : timeText(note.durationMs) }}</Badge>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" class="voice-remove"
                :aria-label="`Удалить запись от ${stamp.format(note.createdAt)}`" @click="deleting = note">
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <audio :src="note.url" controls preload="none" :aria-label="`Прослушать запись от ${stamp.format(note.createdAt)}`" @play="onPlay" />
          </BubbleContent>
        </Bubble>
      </BubbleGroup>

      <Dialog :open="!!deleting" @update:open="open => { if (!open && !removing) deleting = null }">
        <DialogContent :show-close-button="false">
          <DialogHeader>
            <DialogTitle>Удалить голосовую заметку?</DialogTitle>
            <DialogDescription>Запись будет удалена из этого браузера.</DialogDescription>
          </DialogHeader>
          <p v-if="errorText" class="error" role="alert">{{ errorText }}</p>
          <DialogFooter>
            <Button type="button" variant="outline" :disabled="removing" @click="deleting = null">Отмена</Button>
            <Button type="button" variant="destructive" :disabled="removing" @click="remove">Удалить запись</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>
</template>

<style scoped>
.voice-content { display: grid; gap: 9px; }
.voice-capture {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--background);
  padding: 12px;
}
.voice-capture[data-recording] { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); }
.voice-input { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.voice-mic {
  height: 48px;
  width: 48px;
  border-radius: 50%;
  touch-action: none;
  -webkit-touch-callout: none;
  user-select: none;
}
.voice-mic[data-variant="outline"] { color: var(--primary); }
.voice-copy { flex: 1 1 135px; min-width: 0; }
.voice-copy strong { display: block; font-size: .92rem; font-weight: 620; }
.voice-copy p, .voice-hint, .voice-actions > span { color: var(--muted-foreground); font-size: .8rem; }
.voice-clock { color: var(--primary); font-size: .83rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.voice-meter { background: var(--muted); margin-top: 10px; height: 3px; border-radius: 999px; overflow: hidden; }
.voice-meter span { display: block; height: 100%; background: var(--primary); }
.voice-actions, .voice-note-head, .voice-note-info { display: flex; align-items: center; gap: 8px; }
.voice-actions, .voice-note-head { justify-content: space-between; flex-wrap: wrap; }
.voice-actions .voice-alt { min-height: 40px; margin-inline-start: -4px; }
.voice-note-info { color: var(--muted-foreground); font-size: .79rem; }
.voice-remove { min-height: 36px; min-width: 36px; color: var(--muted-foreground); }
.voice-error { margin: 0; }
.voice-list { margin-top: 4px; }
.voice-list audio, .voice-draft audio { display: block; width: 100%; min-width: 0; height: 38px; }
.voice-note-head { margin-bottom: 6px; }
.voice-draft { display: grid; gap: 8px; }
@media (max-width: 767px) {
  .voice-actions .voice-alt, .voice-remove { min-height: 44px; }
  .voice-remove { min-width: 44px; }
}
</style>
