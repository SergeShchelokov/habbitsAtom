<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import MoodFace from './MoodFace.vue'
import { MOODS, moodByScore, type MoodScore } from '@/lib/mood'

const score = defineModel<MoodScore>({ required: true })
const current = computed(() => moodByScore(score.value))
const dots = ref<HTMLElement | null>(null)
const instructions = useId()
const reaction = ref(0)
const drag = ref(0)
const dragging = ref(false)
const jumping = ref(false)
let contact: { id: number; x: number; y: number } | undefined
let suppressClick = false

function select(next: MoodScore) {
  jumping.value = Math.abs(next - score.value) > 1
  score.value = next
  reaction.value++
}

function cardClick(next: MoodScore) {
  if (!suppressClick) select(next)
}

function moveTo(next: number) {
  const bounded = MOODS[Math.max(0, Math.min(MOODS.length - 1, next - 1))]!
  if (bounded.score !== score.value) select(bounded.score)
}

async function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') moveTo(score.value - 1)
  else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') moveTo(score.value + 1)
  else if (event.key === 'Home') moveTo(1)
  else if (event.key === 'End') moveTo(MOODS.length)
  else return
  event.preventDefault()
  await nextTick()
  dots.value?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true })
}

function start(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) return
  suppressClick = false
  contact = { id: event.pointerId, x: event.clientX, y: event.clientY }
}

function move(event: PointerEvent) {
  if (!contact || contact.id !== event.pointerId) return
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) { release(event, true); return }
  const dx = event.clientX - contact.x
  const dy = event.clientY - contact.y
  if (!dragging.value) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 9) return
    suppressClick = true
    if (Math.abs(dy) >= Math.abs(dx)) { contact = undefined; return }
    const stage = event.currentTarget as HTMLElement
    stage.setPointerCapture(event.pointerId)
    dragging.value = true
  }
  const atEnd = (score.value === 1 && dx > 0) || (score.value === MOODS.length && dx < 0)
  drag.value = Math.max(-90, Math.min(90, dx * (atEnd ? .22 : .68)))
}

function release(event: PointerEvent, cancelled = false) {
  if (!contact || contact.id !== event.pointerId) return
  const delta = event.clientX - contact.x
  if (dragging.value && !cancelled && Math.abs(delta) >= 37) moveTo(score.value + (delta < 0 ? 1 : -1))
  contact = undefined
  dragging.value = false
  drag.value = 0
}
</script>

<template>
  <div class="mood-picker">
    <div
      class="mood-stage"
      :class="{ 'mood-stage--dragging': dragging, 'mood-stage--jumping': jumping }"
      :style="{ '--drag': `${drag}px` }"
      aria-hidden="true"
      @pointerdown="start"
      @pointermove="move"
      @pointerup="release($event)"
      @pointercancel="release($event, true)"
      @lostpointercapture="release($event, true)"
    >
      <div
        v-for="mood in MOODS"
        :key="mood.score"
        class="mood-card"
        :class="{
          'mood-card--selected': mood.score === score,
          'mood-card--neighbor': Math.abs(mood.score - score) === 1,
        }"
        :style="{
          '--distance': mood.score - score,
          '--direction': Math.sign(mood.score - score),
          '--face-tint': mood.color,
        }"
        :data-mood-card="mood.score"
        @click="cardClick(mood.score)"
      >
        <div class="mood-card-art">
          <MoodFace :key="mood.score === score ? reaction : 'still'" :mood="mood" :reveal="mood.score === score" />
        </div>
      </div>
    </div>

    <p :id="instructions" class="sr-only">Десять настроений. Листай, нажимай на карточки или пользуйся стрелками на клавиатуре.</p>
    <div ref="dots" class="mood-dots" role="radiogroup" aria-label="Настроение" :aria-describedby="instructions" @keydown="onKey">
      <button
        v-for="mood in MOODS"
        :key="mood.score"
        class="mood-dot"
        type="button"
        role="radio"
        :title="mood.label"
        :aria-label="`${mood.score} из ${MOODS.length} — ${mood.label}`"
        :aria-checked="score === mood.score"
        :tabindex="score === mood.score ? 0 : -1"
        @click="select(mood.score)"
      ><span /></button>
    </div>
    <div class="mood-copy" aria-live="polite" aria-atomic="true">
      <p class="mood-name">{{ current.label }}</p>
      <p class="mood-description">{{ current.description }}</p>
    </div>
  </div>
</template>

<style scoped>
.mood-picker {
  container-type: inline-size;
  display: grid;
  min-width: 0;
  justify-items: center;
}
.mood-stage {
  --card-size: clamp(124px, 49cqi, 208px);
  --stride: calc(var(--card-size) + clamp(14px, 4.7cqi, 26px));
  position: relative;
  width: 100%;
  height: calc(var(--card-size) + 26px);
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
  user-select: none;
}
.mood-card {
  position: absolute;
  z-index: 0;
  inset-block-start: 11px;
  inset-inline-start: 50%;
  display: grid;
  place-items: center;
  width: var(--card-size);
  aspect-ratio: 1;
  border: 1px solid color-mix(in srgb, var(--face-tint) 35%, #312639);
  border-radius: clamp(21px, 7cqi, 34px);
  background: radial-gradient(ellipse at 47% 48%, color-mix(in srgb, var(--face-tint) 10%, transparent), transparent 72%), #17141b;
  transform: translateX(calc(-50% + var(--stride) * var(--distance) + var(--drag))) rotate(calc(var(--direction) * 8deg)) scale(.92);
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition: transform 360ms cubic-bezier(.22,.74,.24,1), opacity 210ms ease, border-color 230ms ease;
}
.mood-card--neighbor {
  opacity: .84;
  pointer-events: auto;
}
.mood-card--selected {
  z-index: 1;
  border-color: color-mix(in srgb, var(--face-tint) 87%, #312639);
  transform: translateX(calc(-50% + var(--drag)));
  opacity: 1;
  pointer-events: auto;
}
.mood-stage--dragging .mood-card { cursor: grabbing; transition: none; }
.mood-stage--jumping:not(.mood-stage--dragging) .mood-card { transition: opacity 180ms ease, border-color 180ms ease; }
.mood-card-art {
  width: 75%;
  filter: drop-shadow(0 4px 14px color-mix(in srgb, var(--face-tint) 33%, transparent));
  pointer-events: none;
}
.mood-card--selected .mood-card-art {
  filter: drop-shadow(0 3px 18px color-mix(in srgb, var(--face-tint) 51%, transparent));
}
.mood-dots {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  width: min(100% - 32px, 320px);
  margin-block: 3px 11px;
}
.mood-dot {
  display: grid;
  place-items: center;
  min-height: 44px;
  border-radius: 10px;
}
.mood-dot span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #817688;
  transition: transform 180ms ease, background-color 180ms ease;
}
.mood-dot:hover span { background-color: #c8b9d3; }
.mood-dot[aria-checked="true"] span { transform: scale(1.43); background-color: var(--primary); }
.mood-dot:focus-visible { outline: 2px solid var(--primary); outline-offset: -4px; }
.mood-copy {
  width: 100%;
  padding-inline: 16px;
  color: #fbefdf;
  text-align: center;
}
.mood-name {
  font: 700 clamp(1.8rem, 10cqi, 3.65rem)/1.06 var(--mood-serif, Georgia, serif);
  letter-spacing: -.05em;
  overflow-wrap: anywhere;
}
.mood-description {
  margin-top: 11px;
  color: #eee2f2;
  font-size: 1rem;
  line-height: 1.4;
}
@media (max-width: 767px) and (max-height: 720px) {
  .mood-stage { --card-size: clamp(118px, 43cqi, 164px); height: calc(var(--card-size) + 20px); }
  .mood-card { inset-block-start: 7px; }
  .mood-dots { margin-block: 0 5px; }
  .mood-description { margin-top: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .mood-card, .mood-dot span { transition: none; }
}
</style>
