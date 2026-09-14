<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ label: string; speed?: number }>(), { speed: 26 })
const viewport = ref<HTMLElement>()
let frame = 0
let previous = 0
let position = 0
let direction = 1
let pauseUntil = 0
let lastMaximum = 0

// Move at a fixed number of design pixels per second; pause at both ends for reading.
// One DOM copy keeps counts/accessibility accurate, even when live data changes.
function tick(now: number) {
  const element = viewport.value
  const delta = previous ? Math.min(now - previous, 100) : 0
  previous = now
  if (element) {
    const maximum = Math.max(0, element.scrollHeight - element.clientHeight)
    if (maximum !== lastMaximum) {
      position = Math.min(position, maximum)
      lastMaximum = maximum
      pauseUntil = now + 3000
    }
    if (now < pauseUntil) position = element.scrollTop
    if (!document.hidden && maximum > 1 && now >= pauseUntil) {
      position = Math.max(0, Math.min(maximum, position + direction * props.speed * delta / 1000))
      element.scrollTop = position
      if (position >= maximum || position <= 0) {
        direction *= -1
        pauseUntil = now + 4000
      }
    }
  }
  frame = requestAnimationFrame(tick)
}
function manualPause() {
  pauseUntil = performance.now() + 15000
  if (viewport.value) position = viewport.value.scrollTop
}
onMounted(() => {
  pauseUntil = performance.now() + 4000
  frame = requestAnimationFrame(tick)
})
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <div ref="viewport" class="auto-scroll" role="region" :aria-label="label" tabindex="0" @wheel.passive="manualPause" @keydown="manualPause" @pointerdown="manualPause">
    <div class="auto-scroll-content"><slot /></div>
  </div>
</template>
