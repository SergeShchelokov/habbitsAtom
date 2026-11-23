<script setup lang="ts">
import { useId } from 'vue'
import type { Mood } from '@/lib/mood'

defineProps<{ mood: Mood; reveal: boolean }>()
const id = useId()
const shell = 'M80 9C92 9 95 21 104 25C113 29 124 23 132 31C140 39 133 51 137 59C141 67 152 70 152 81C152 93 140 97 136 105C132 113 137 124 129 132C121 140 110 134 102 138C94 142 91 152 80 152C68 152 65 141 57 137C49 133 37 139 29 131C21 123 27 111 23 103C19 95 8 91 8 80C8 69 20 64 24 56C28 48 22 38 30 30C38 22 50 28 58 24C66 20 69 9 80 9Z'
</script>

<template>
  <svg viewBox="0 0 160 160" class="mood-face" :class="{ 'mood-face--reveal': reveal }" :data-mood="mood.score" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient :id="`${id}-gel`" x1="15%" y1="0%" x2="79%" y2="100%">
        <stop :stop-color="mood.light" />
        <stop offset=".46" :stop-color="mood.color" />
        <stop offset="1" :stop-color="mood.shade" />
      </linearGradient>
      <radialGradient :id="`${id}-light`" cx="39%" cy="27%" r="58%">
        <stop :stop-color="mood.light" stop-opacity=".9" />
        <stop offset=".56" :stop-color="mood.light" stop-opacity=".2" />
        <stop offset="1" :stop-color="mood.light" stop-opacity="0" />
      </radialGradient>
      <radialGradient :id="`${id}-rim`" cx="56%" cy="47%" r="56%">
        <stop offset=".64" :stop-color="mood.color" stop-opacity="0" />
        <stop offset=".89" :stop-color="mood.light" stop-opacity=".25" />
        <stop offset="1" :stop-color="mood.light" stop-opacity=".72" />
      </radialGradient>
    </defs>
    <g class="face-body">
      <path :d="shell" :fill="`url(#${id}-gel)`" />
      <path :d="shell" :fill="`url(#${id}-light)`" />
      <path :d="shell" :fill="`url(#${id}-rim)`" />
      <path :d="shell" fill="none" :stroke="mood.light" stroke-opacity=".38" stroke-width=".9" />
      <g v-if="reveal" class="face-neutral" fill="none" stroke="currentColor" stroke-linecap="round">
        <path d="M56 76 h1 M103 76 h1" stroke-width="8" />
        <path d="M73 97 Q80 99 87 97" stroke-width="4.6" />
      </g>
      <g class="face-expression">
        <g v-if="mood.cheeks" class="face-cheeks" fill="#df715f" opacity=".35">
          <ellipse cx="42" cy="91" rx="9" ry="5" /><ellipse cx="118" cy="91" rx="9" ry="5" />
        </g>
        <path v-if="mood.brows" class="face-brows" :d="mood.brows" stroke="currentColor" stroke-width="4.9" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <path class="face-eyes" :d="mood.eyes" stroke="currentColor" :stroke-width="[6, 8, 10].includes(mood.score) ? 9 : 5.7" stroke-linecap="round" fill="none" />
        <path class="face-mouth" :d="mood.mouth" stroke="currentColor" :stroke-width="mood.mouthFill ? 1.8 : 5" stroke-linecap="round" stroke-linejoin="round" :fill="mood.mouthFill ? 'currentColor' : 'none'" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.mood-face {
  display: block;
  width: 100%;
  overflow: visible;
  color: #20101b;
}
.face-body, .face-eyes, .face-brows, .face-mouth, .face-expression, .face-cheeks {
  transform-box: fill-box;
  transform-origin: center;
}
.face-neutral { opacity: 0; }
.mood-face--reveal .face-body { animation: mood-body 580ms cubic-bezier(.25,.61,.36,1) both; }
.mood-face--reveal .face-neutral { animation: mood-neutral 440ms ease-out both; }
.mood-face--reveal .face-expression { animation: mood-express 510ms ease-out both; }
.mood-face--reveal .face-eyes { animation: mood-eyes 580ms ease both; }
.mood-face--reveal .face-brows { animation: mood-brows 580ms ease both; }
.mood-face--reveal .face-mouth { animation: mood-mouth 580ms cubic-bezier(.22,.72,.32,1.2) both; }
.mood-face--reveal .face-cheeks { animation: mood-cheeks 580ms ease-out both; }

[data-mood="1"] { --body-squash: .95; --body-stretch: 1.05; --brow-y: 6px; --mouth-y: .76; }
[data-mood="2"] { --body-tilt: -7deg; --brow-y: -6px; }
[data-mood="3"] { --body-squash: 1.04; --body-stretch: .91; --brow-y: 5px; --mouth-y: .63; }
[data-mood="4"] { --body-tilt: 6deg; --brow-y: -7px; --mouth-x: .8; }
[data-mood="5"] { --body-squash: 1.035; --body-stretch: .965; --eye-y: .08; --mouth-y: .86; }
[data-mood="6"] { --body-squash: 1.01; --body-stretch: .99; --brow-y: -2px; }
[data-mood="7"] { --body-tilt: -4deg; --eye-y: .26; --mouth-x: .7; }
[data-mood="8"] { --body-tilt: 5deg; --brow-y: -8px; --mouth-x: .73; }
[data-mood="9"] { --body-squash: .95; --body-stretch: 1.085; --brow-y: -10px; --mouth-y: .3; }
[data-mood="10"] { --body-tilt: -4deg; --body-stretch: 1.06; --brow-y: -7px; --mouth-y: .28; }

@keyframes mood-body {
  0% { transform: translateY(6px) scale(.93, .95); }
  52% { transform: rotate(var(--body-tilt, 0deg)) scale(var(--body-squash, 1), var(--body-stretch, 1.035)); }
  100% { transform: none; }
}
@keyframes mood-neutral { 0%, 17% { opacity: 1; } 40%, 100% { opacity: 0; } }
@keyframes mood-express { 0%, 18% { opacity: 0; } 46%, 100% { opacity: 1; } }
@keyframes mood-eyes { 0%, 30% { transform: scaleY(var(--eye-y, .14)); } 62%, 100% { transform: none; } }
@keyframes mood-brows {
  0%, 23% { transform: translateY(4px); opacity: 0; }
  58% { transform: translateY(var(--brow-y, -5px)); opacity: 1; }
  100% { transform: none; }
}
@keyframes mood-mouth { 0%, 25% { transform: scale(var(--mouth-x, .65), var(--mouth-y, .5)); } 100% { transform: none; } }
@keyframes mood-cheeks { 0%, 30% { opacity: 0; } 65%, 100% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) {
  .mood-face--reveal * { animation: none; }
}
</style>
