<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const props = defineProps<{ remaining: number; total: number; text: string }>()
const offset = computed(() => 100 * (1 - Math.min(1, Math.max(0, props.remaining / props.total))))
const label = computed(() => `Открыть «Фокус». Осталось ${Math.floor(props.remaining / 60)} мин ${props.remaining % 60} сек`)
</script>

<template>
  <Button type="button" variant="outline" class="focus-chip" :aria-label="label" title="Вернуться к таймеру">
    <svg class="focus-chip-ring" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="11.5" fill="none" stroke="#51473a" stroke-width="2" />
      <circle class="focus-chip-arc" cx="14" cy="14" r="11.5" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"
        pathLength="100" stroke-dasharray="100" :stroke-dashoffset="offset" transform="rotate(-90 14 14)" />
    </svg>
    <span class="focus-chip-time" aria-hidden="true">{{ text }}</span>
    <ArrowUpRight class="focus-chip-arrow" aria-hidden="true" />
  </Button>
</template>
