<script setup lang="ts">
import { computed } from 'vue'
const p = defineProps<{ remaining: number; total: number; text: string; caption: string; state: string }>()
const ratio = computed(() => Math.min(1, Math.max(0, p.remaining / p.total)))
const marker = computed(() => ({ x: 201 + 192 * Math.sin(ratio.value * Math.PI * 2), y: 199.5 - 192 * Math.cos(ratio.value * Math.PI * 2) }))
const assets = import.meta.env.BASE_URL + 'assets/figma/'
</script>
<template>
  <div class="focus-dial" role="progressbar" aria-label="Оставшееся время" :aria-valuemin="0" :aria-valuemax="total" :aria-valuenow="remaining" :aria-valuetext="`${text} ${caption}`">
    <svg viewBox="0 0 401 399" aria-hidden="true" class="size-full overflow-visible">
      <defs><linearGradient id="focus-charge" x1="0" x2="1" y1="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#ffda65"/><stop offset=".55" stop-color="#ffd453"/><stop offset="1" stop-color="#f5c849"/></linearGradient></defs>
      <image :href="assets + 'timer-track.svg'" x="4" y="4" width="393" height="391" />
      <g v-if="ratio > 0">
        <circle class="focus-arc" cx="201" cy="199.5" r="192" fill="none" stroke="url(#focus-charge)" stroke-width="13" pathLength="100" stroke-dasharray="100" :stroke-dashoffset="100 - ratio * 100" transform="rotate(-90 201 199.5)"/>
        <image :href="assets + 'progress-glow.svg'" :x="marker.x - 22" :y="marker.y - 22" width="44" height="44" />
        <image :href="assets + 'progress-marker.svg'" :x="marker.x - 6" :y="marker.y - 6" width="12" height="12" />
      </g>
    </svg>
    <div class="focus-dial-copy" aria-hidden="true"><span>{{ state }}</span><strong>{{ text }}</strong><small>{{ caption }}</small></div>
  </div>
</template>
