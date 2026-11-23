<script setup lang="ts">
import { computed } from 'vue'
import { BatteryLow, BatteryMedium, Zap } from '@lucide/vue'
import { Slider } from '@/components/ui/slider'
import { energyColor, energyLabel } from '@/lib/mood'

const level = defineModel<number>({ required: true })
const mood = computed(() => ({
  '--mood-position': `${level.value * 10}%`,
  '--mood-color': energyColor(level.value),
}))
const icon = computed(() => level.value <= 2 ? BatteryLow : level.value <= 6 ? BatteryMedium : Zap)

function change(values: number[] | undefined) {
  const next = values?.[0]
  if (next !== undefined) level.value = next
}
</script>

<template>
  <div class="mood-control" :style="mood">
    <Slider
      class="mood-slider"
      :model-value="[level]"
      :min="0"
      :max="10"
      :step="1"
      thumb-label="Уровень энергии"
      :thumb-value-text="`${level} из 10 — ${energyLabel(level)}`"
      @update:model-value="change"
    >
      <template #track>
        <span class="mood-texture" aria-hidden="true" />
      </template>
      <template #thumb><component :is="icon" class="mood-glyph" :size="15" aria-hidden="true" /></template>
    </Slider>
    <div class="mood-scale" aria-hidden="true">
      <span><b>0</b> Без сил</span>
      <span><b>5</b> Ровно</span>
      <span><b>10</b> Полон энергии</span>
    </div>
  </div>
</template>

<style>
@property --mood-position {
  syntax: '<percentage>';
  inherits: true;
  initial-value: 50%;
}
@property --mood-color {
  syntax: '<color>';
  inherits: true;
  initial-value: #dd95df;
}

.mood-control {
  transition: --mood-position 160ms ease-out, --mood-color 180ms ease-out;
}
.mood-slider {
  min-height: 52px;
  padding-inline: 5px;
  cursor: pointer;
}
.mood-slider [data-slot="slider-track"] {
  height: 11px;
  margin-inline: 14px;
  isolation: isolate;
  background:
    radial-gradient(ellipse 88px 20px at var(--mood-position) 50%, color-mix(in oklab, var(--mood-color) 84%, white), transparent 85%),
    linear-gradient(90deg,#8cb8ff 0%,#907ee1 30%,#b56cc1 50%,#e36774 70%,#f29549 87%,#ffd453 100%);
  box-shadow: inset 0 1px #fff4, inset 0 -1px #0005, 0 0 12px color-mix(in oklab, var(--mood-color) 34%, transparent);
}
.mood-slider [data-slot="slider-range"] {
  z-index: 1;
  inset-block: 0;
  border-radius: 999px;
  background: linear-gradient(90deg,#ffffff08,color-mix(in oklab, var(--mood-color) 38%, #ffffff1a));
}
.mood-texture {
  position: absolute;
  z-index: 2;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(0deg,#0004,transparent 45%,#fff2 68%,#fff4);
}
.mood-texture::before, .mood-texture::after {
  content: '';
  position: absolute;
  inset: 0 -25%;
  will-change: transform, opacity;
}
.mood-texture::before {
  background:
    radial-gradient(ellipse 90px 7px at 23% 72%, #f5efff8c, transparent),
    radial-gradient(ellipse 110px 8px at 56% 15%, #fbe4ff9c, transparent),
    radial-gradient(ellipse 100px 7px at 82% 50%, #fff2b490, transparent);
  mix-blend-mode: screen;
  animation: mood-current 4.5s ease-in-out 1 both;
}
.mood-texture::after {
  background:
    radial-gradient(circle at 7px 3px,#fffd 0 .65px,transparent 1.05px) 0 0/41px 11px,
    radial-gradient(circle at 25px 8px,#fffc 0 .55px,transparent 1.1px) 0 0/67px 11px;
  animation: mood-grain 4.1s ease-in-out 1 both;
}
.mood-slider:is(:hover,:focus-within) .mood-texture::before { animation: mood-current-hover 5.5s ease-in-out infinite; }
.mood-slider:is(:hover,:focus-within) .mood-texture::after { animation: mood-grain-hover 4.3s ease-in-out infinite; }
@keyframes mood-current {
  from { transform: translateX(-9%); opacity: .45; }
  55% { opacity: .82; }
  to { transform: translateX(12%); opacity: .55; }
}
@keyframes mood-grain { from { transform: translateX(-3%); opacity: .33; } 50% { opacity: .74; } to { transform: translateX(3%); opacity: .48; } }
@keyframes mood-current-hover { 0%,100% { transform: translateX(-9%); opacity: .55; } 50% { transform: translateX(12%); opacity: .87; } }
@keyframes mood-grain-hover { 0%,100% { transform: translateX(-3%); opacity: .48; } 50% { transform: translateX(3%); opacity: .76; } }

.mood-slider [data-slot="slider-thumb"] {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 2px solid var(--mood-color);
  background: #262327;
  color: color-mix(in oklab, var(--mood-color) 82%, white);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--mood-color) 24%, transparent), 0 3px 10px #0006;
  cursor: grab;
}
.mood-slider [data-slot="slider-thumb"]:active { cursor: grabbing; }
.mood-slider [data-slot="slider-thumb"]:focus-visible {
  outline: 2px solid var(--foreground);
  outline-offset: 4px;
}
.mood-glyph { pointer-events: none; }
.mood-scale {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: .25rem;
  color: var(--muted-foreground);
  font-size: clamp(.65rem, 2.85vw, .75rem);
  line-height: 1.3;
}
.mood-scale b { color: var(--foreground); font-weight: 600; margin-inline-end: .13em; font-variant-numeric: tabular-nums; }
.mood-scale span:last-child { text-align: right; }

@media (prefers-reduced-motion: reduce) {
  .mood-control { transition: none; }
  .mood-slider .mood-texture::before, .mood-slider .mood-texture::after { animation: none !important; opacity: .52; }
}
</style>
