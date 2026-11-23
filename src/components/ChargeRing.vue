<script setup lang="ts">
import { computed } from 'vue'
const p = defineProps<{ value: number; max: number; label: string; caption: string; text: string }>()
const offset = computed(() => 100 - 100 * Math.max(0, Math.min(1, p.value / p.max)))
</script>
<template>
  <div class="charge-ring" role="progressbar" :aria-label="label" :aria-valuemin="0" :aria-valuemax="max" :aria-valuenow="value" :aria-valuetext="`${text} ${caption}`">
    <svg viewBox="0 0 130 130" aria-hidden="true" class="size-full">
      <circle cx="65" cy="65" r="59" fill="none" stroke="var(--secondary)" stroke-width="7"/>
      <circle class="ring-arc" cx="65" cy="65" r="59" fill="none" stroke="var(--primary)" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="100" :stroke-dashoffset="offset" :opacity="value > 0 ? 1 : 0" transform="rotate(-90 65 65)"/>
    </svg>
    <span class="ring-text" aria-hidden="true"><strong>{{ text }}</strong><small>{{ caption }}</small></span>
  </div>
</template>
