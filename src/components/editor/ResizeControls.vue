<script setup lang="ts">
    import { computed, ref, shallowRef } from 'vue';
    import { MAX_RESIZE_DIMENSION, heightForWidth, isValidResize, widthForHeight } from '@/lib/resize';
    import type { Size } from '@/lib/zoom';
    import ToolModal from './ToolModal.vue';

    const props = defineProps<{
        image: Size
        disabled: boolean
        error: string | null
    }>();

    const emit = defineEmits<{
        apply: [size: Size]
        cancel: []
    }>();

    const size = ref<Size>({ width: props.image.width, height: props.image.height });
    const lockRatio = shallowRef(true);

    const valid = computed(() => isValidResize(size.value));
    const unchanged = computed(() =>
        size.value.width === props.image.width && size.value.height === props.image.height,
    );

    function isPositiveInteger(value: number): boolean {
        return Number.isSafeInteger(value) && value >= 1;
    }

    function onWidthInput() {
        if (lockRatio.value && isPositiveInteger(size.value.width)) {
            size.value.height = heightForWidth(size.value.width, props.image);
        }
    }

    function onHeightInput() {
        if (lockRatio.value && isPositiveInteger(size.value.height)) {
            size.value.width = widthForHeight(size.value.height, props.image);
        }
    }

    function toggleLock() {
        lockRatio.value = !lockRatio.value;
        onWidthInput();
    }

    function apply() {
        if (!props.disabled && valid.value && !unchanged.value) emit('apply', { ...size.value });
    }
</script>

<template>
    <ToolModal
        title="Resize image"
        apply-label="Apply resize"
        :can-apply="valid && !unchanged"
        :busy="disabled"
        :error="error"
        @apply="apply"
        @cancel="emit('cancel')"
    >
        <div class="resize-controls">
            <label class="dimension-label">
                Width (px)
                <input v-model.number="size.width" class="dimension-input" aria-label="Resize width" type="number" min="1"
                    :max="MAX_RESIZE_DIMENSION" required step="1" autofocus @input="onWidthInput" />
            </label>
            <button
                type="button"
                class="lock-button"
                :aria-pressed="lockRatio"
                :aria-label="lockRatio ? 'Aspect ratio locked' : 'Aspect ratio unlocked'"
                :title="lockRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'"
                @click="toggleLock"
            >
                <i aria-hidden="true" class="bi" :class="lockRatio ? 'bi-lock-fill' : 'bi-unlock'"></i>
            </button>
            <label class="dimension-label">
                Height (px)
                <input v-model.number="size.height" class="dimension-input" aria-label="Resize height" type="number" min="1"
                    :max="MAX_RESIZE_DIMENSION" required step="1" @input="onHeightInput" />
            </label>
        </div>
        <p v-if="!valid" class="validation-message" role="alert">Enter a width and height between 1 and {{ MAX_RESIZE_DIMENSION }} px.</p>
    </ToolModal>
</template>

<style scoped>
.resize-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: end;
  gap: 12px;
}

.dimension-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 6px;
}

.dimension-input,
.lock-button {
  min-height: 34px;
  padding: 6px 10px;
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  font: inherit;
}

.dimension-input {
  width: 100%;
  min-width: 0;
}

.lock-button {
  display: grid;
  place-items: center;
  width: 34px;
  padding: 0;
  background: var(--color-button-secondary);
  border-color: var(--color-button-secondary-border);
  border-radius: var(--radius-button);
  cursor: pointer;
}

.lock-button:hover:not(:disabled) {
  background: var(--color-button-secondary-hover);
  border-color: var(--color-button-secondary-border-hover);
}

.lock-button[aria-pressed='true'] {
  border-color: var(--color-accent);
}

.lock-button:disabled {
  opacity: var(--opacity-button-secondary-disabled);
  cursor: not-allowed;
}

.dimension-input:focus-visible,
.lock-button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}

.validation-message {
  margin-top: 12px;
  color: #fecaca;
}
</style>
