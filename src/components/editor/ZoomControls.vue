<script setup lang="ts">
import { computed } from 'vue'
import { formatZoom } from '@/lib/zoom'

const props = defineProps<{
  zoom: number
  isFit: boolean
}>()

const emit = defineEmits<{
  fit: []
  'actual-size': []
}>()

const label = computed(() => formatZoom(props.zoom))
const isActualSize = computed(() => props.zoom === 1)
</script>

<template>
  <div class="zoom-controls" role="group" aria-label="Zoom">
    <output class="zoom-level" aria-live="polite" :aria-label="`Zoom ${label}`">
      <i class="bi bi-search" aria-hidden="true"></i>
      <span>{{ label }}</span>
    </output>
    <button
      type="button"
      class="zoom-button"
      aria-label="Fit to window"
      title="Fit to window"
      :aria-pressed="isFit"
      :disabled="isFit"
      @click="emit('fit')"
    >
      <i class="bi bi-arrows-angle-contract" aria-hidden="true"></i>
    </button>
    <button
      type="button"
      class="zoom-button"
      aria-label="Actual size (100%)"
      title="Actual size (100%)"
      :aria-pressed="isActualSize"
      :disabled="isActualSize"
      @click="emit('actual-size')"
    >
      <i class="bi bi-1-square" aria-hidden="true"></i>
    </button>
  </div>
</template>

<style scoped>
.zoom-controls {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  font-size: 12px;
  background-color: rgb(43 43 43 / 85%);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.zoom-level {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 64px;
  padding: 0 6px;
  font-variant-numeric: tabular-nums;
}

.zoom-button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 22px;
  padding: 0;
  font-size: 13px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
}

.zoom-button:hover:not(:disabled) {
  background-color: var(--color-hover);
}

.zoom-button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 1px;
}

.zoom-button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
