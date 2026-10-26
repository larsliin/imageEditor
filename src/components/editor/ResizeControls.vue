<script setup lang="ts">
    import { computed, ref, shallowRef } from 'vue';
    import { MAX_RESIZE_DIMENSION, dimensionForPercentage, heightForWidth, isValidResize, widthForHeight } from '@/lib/resize';
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

    type Dimension = 'width' | 'height';
    type InputDimensions = Record<Dimension, number | string>;

    const size = ref<InputDimensions>({ width: props.image.width, height: props.image.height });
    const percentages = ref<InputDimensions>({ width: 100, height: 100 });
    const lockRatio = shallowRef(true);

    const outputSize = computed(() => {
        const { width, height } = size.value;
        if (typeof width !== 'number' || typeof height !== 'number') return null;
        const result = { width, height };
        return isValidResize(result) ? result : null;
    });
    const valid = computed(() => outputSize.value !== null);
    const unchanged = computed(() =>
        outputSize.value?.width === props.image.width && outputSize.value?.height === props.image.height,
    );

    function percentageForDimension(dimension: Dimension): number | string {
        const value = size.value[dimension];
        return typeof value === 'number' && Number.isFinite(value) && value > 0
            ? Number((value / props.image[dimension] * 100).toFixed(4))
            : '';
    }

    function onDimensionInput(dimension: Dimension, unit: 'pixels' | 'percentage') {
        const other = dimension === 'width' ? 'height' : 'width';
        if (unit === 'percentage') {
            const percentage = percentages.value[dimension];
            size.value[dimension] = typeof percentage === 'number'
                ? dimensionForPercentage(props.image[dimension], percentage) ?? ''
                : '';
            if (lockRatio.value) {
                percentages.value[other] = percentage;
                size.value[other] = typeof percentage === 'number'
                    ? dimensionForPercentage(props.image[other], percentage) ?? ''
                    : '';
            }
            return;
        }
        percentages.value[dimension] = percentageForDimension(dimension);
        const value = size.value[dimension];
        if (lockRatio.value && typeof value === 'number' && Number.isSafeInteger(value) && value >= 1) {
            size.value[other] = dimension === 'width'
                ? heightForWidth(value, props.image)
                : widthForHeight(value, props.image);
            percentages.value[other] = percentageForDimension(other);
        }
    }

    function toggleLock() {
        lockRatio.value = !lockRatio.value;
        if (lockRatio.value) onDimensionInput('width', 'pixels');
    }

    function apply() {
        if (!props.disabled && outputSize.value && !unchanged.value) emit('apply', { ...outputSize.value });
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
                Width px
                <input v-model.number="size.width" class="dimension-input" aria-label="Resize width" type="number" min="1"
                    :max="MAX_RESIZE_DIMENSION" required step="1" autofocus @input="onDimensionInput('width', 'pixels')" />
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
                Height px
                <input v-model.number="size.height" class="dimension-input" aria-label="Resize height" type="number" min="1"
                    :max="MAX_RESIZE_DIMENSION" required step="1" @input="onDimensionInput('height', 'pixels')" />
            </label>
            <label class="dimension-label">
                Width %
                <input v-model.number="percentages.width" class="dimension-input" aria-label="Resize width percentage"
                    type="number" min="0" step="any" required @input="onDimensionInput('width', 'percentage')" />
            </label>
            <label class="dimension-label dimension-label--height-percentage">
                Height %
                <input v-model.number="percentages.height" class="dimension-input" aria-label="Resize height percentage"
                    type="number" min="0" step="any" required @input="onDimensionInput('height', 'percentage')" />
            </label>
        </div>
        <p v-if="!valid" class="validation-message" role="alert">
            Enter whole-pixel dimensions between 1 and {{ MAX_RESIZE_DIMENSION }} px, or positive percentages within those bounds.
        </p>
    </ToolModal>
</template>

<style scoped>
.dimension-label--height-percentage {
  grid-column: 3;
}

.resize-controls {
  --label-gap: 6px;

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: end;
  gap: 12px;
}

.dimension-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: var(--label-gap);
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
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  /* Center between input edges, excluding the first row's label and label gap. */
  translate: 0 calc((1lh + var(--label-gap)) / 2);
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

.dimension-input:focus-visible {
  outline: 1px solid var(--color-focus);
  outline-offset: 0;
}

.lock-button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}

.validation-message {
  margin-top: 12px;
  color: #fecaca;
}
</style>
