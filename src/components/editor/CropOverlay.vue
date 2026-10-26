<script setup lang="ts">
    import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue';
    import { cropFromPoints, squareCropFromPoints, moveCrop, resizeCrop, isValidCrop, previewToImagePoint, isCropInsideRotatedImage, isValidAngle, largestCropInsideRotatedImage, MAX_STRAIGHTEN_ANGLE, type CropRect, type CropHandle, type Point } from '@/lib/crop';
    import type { Size } from '@/lib/zoom';

    const props = defineProps<{
        image: Size
        disabled: boolean
        panMode: boolean
    }>();

    const angle = defineModel<number>('angle', { default: 0 });

    const emit = defineEmits<{
        apply: [crop: CropRect, angle: number]
        cancel: []
    }>();

    const surface = useTemplateRef<HTMLDivElement>('surface');
    const crop = ref<CropRect>({ x: 0, y: 0, width: props.image.width, height: props.image.height });
    const dragging = shallowRef(false);
    const moving = shallowRef(false);
    const resizing = shallowRef<CropHandle | null>(null);
    const handles: { id: CropHandle; label: string; x: number; y: number; cursor: string }[] = [
        { id: 'nw', label: 'top left', x: 0, y: 0, cursor: 'nwse-resize' },
        { id: 'n', label: 'top', x: 50, y: 0, cursor: 'ns-resize' },
        { id: 'ne', label: 'top right', x: 100, y: 0, cursor: 'nesw-resize' },
        { id: 'e', label: 'right', x: 100, y: 50, cursor: 'ew-resize' },
        { id: 'se', label: 'bottom right', x: 100, y: 100, cursor: 'nwse-resize' },
        { id: 's', label: 'bottom', x: 50, y: 100, cursor: 'ns-resize' },
        { id: 'sw', label: 'bottom left', x: 0, y: 100, cursor: 'nesw-resize' },
        { id: 'w', label: 'left', x: 0, y: 50, cursor: 'ew-resize' },
    ];
    let start: Point | null = null;
    let end: Point | null = null;
    let pointerId: number | null = null;
    let previousCrop: CropRect | null = null;

    const rectValid = computed(() => isValidCrop(crop.value, props.image));
    const angleValid = computed(() => isValidAngle(angle.value));
    const valid = computed(() =>
        rectValid.value && angleValid.value && isCropInsideRotatedImage(crop.value, props.image, angle.value),
    );
    const unchanged = computed(() =>
        angle.value === 0
        && crop.value.x === 0 && crop.value.y === 0
        && crop.value.width === props.image.width && crop.value.height === props.image.height,
    );

    // Keep the selection inside the image when X/Y or width/height are edited numerically.
    watch(() => [crop.value.x, crop.value.y] as const, ([x, y]) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const width = Math.max(1, Math.min(crop.value.width, props.image.width - x));
        const height = Math.max(1, Math.min(crop.value.height, props.image.height - y));
        if (Number.isFinite(width) && width !== crop.value.width) crop.value.width = width;
        if (Number.isFinite(height) && height !== crop.value.height) crop.value.height = height;
    });

    watch(() => [crop.value.width, crop.value.height] as const, ([width, height]) => {
        if (!Number.isFinite(width) || !Number.isFinite(height)) return;
        const maxWidth = props.image.width - crop.value.x;
        const maxHeight = props.image.height - crop.value.y;
        if (maxWidth >= 1 && width > maxWidth) crop.value.width = maxWidth;
        if (maxHeight >= 1 && height > maxHeight) crop.value.height = maxHeight;
    });

    // While the crop is untouched by the user, it follows the largest safe crop for the current angle.
    let autoCrop = true;

    watch(angle, (value) => {
        if (!isValidAngle(value)) return;
        if (autoCrop) {
            crop.value = largestCropInsideRotatedImage(props.image, value);
            return;
        }
        if (rectValid.value && !isCropInsideRotatedImage(crop.value, props.image, value)) {
            crop.value = largestCropInsideRotatedImage(props.image, value);
        }
    });
    // Keep showing the last valid selection (and grid) while a field is empty or invalid.
    const displayCrop = shallowRef<CropRect>({ ...crop.value });
    watch(crop, (value) => {
        if (isValidCrop(value, props.image)) displayCrop.value = { ...value };
        else if (dragging.value) displayCrop.value = { x: 0, y: 0, width: 0, height: 0 };
    }, { deep: true });

    const selectionStyle = computed(() => ({
        left: `${displayCrop.value.x / props.image.width * 100}%`,
        top: `${displayCrop.value.y / props.image.height * 100}%`,
        width: `${displayCrop.value.width / props.image.width * 100}%`,
        height: `${displayCrop.value.height / props.image.height * 100}%`,
    }));

    function point(event: PointerEvent): Point {
        const element = surface.value;
        if (!element) throw new Error('The crop selection is not available.');
        return previewToImagePoint(
            { x: event.clientX, y: event.clientY },
            element.getBoundingClientRect(),
            props.image,
        );
    }

    function beginSelection(event: PointerEvent, handle: CropHandle | null = null) {
        if (props.disabled || props.panMode || pointerId !== null || event.button !== 0 || !surface.value) return;
        event.preventDefault();
        autoCrop = false;
        surface.value.focus({ preventScroll: true });
        surface.value.setPointerCapture(event.pointerId);
        pointerId = event.pointerId;
        previousCrop = { ...crop.value };
        start = point(event);
        end = start;
        resizing.value = handle;
        moving.value = !handle && valid.value && !unchanged.value
            && start.x >= crop.value.x && start.x <= crop.value.x + crop.value.width
            && start.y >= crop.value.y && start.y <= crop.value.y + crop.value.height;
        dragging.value = true;
        if (!moving.value && !handle) crop.value = cropFromPoints(start, start);
    }

    function updateSelection(event: PointerEvent) {
        if (event.pointerId !== pointerId || !start) return;
        end = point(event);
        updateConstraint(event.shiftKey);
    }

    function updateConstraint(square: boolean) {
        if (!start || !end) return;
        if (resizing.value && previousCrop) {
            crop.value = resizeCrop(previousCrop, resizing.value, { x: end.x - start.x, y: end.y - start.y }, props.image, square);
            return;
        }
        if (moving.value && previousCrop) {
            crop.value = moveCrop(previousCrop, { x: end.x - start.x, y: end.y - start.y }, props.image);
            return;
        }
        crop.value = square
            ? squareCropFromPoints(start, end, props.image)
            : cropFromPoints(start, end);
    }

    function onShiftChange(event: KeyboardEvent) {
        if (event.key === 'Shift') updateConstraint(event.shiftKey);
    }

    function endSelection(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;
        if (event.type === 'pointerup') updateSelection(event);
        if ((event.type !== 'pointerup' || !valid.value) && previousCrop) crop.value = previousCrop;
        const capturedId = pointerId;
        pointerId = null;
        start = null;
        end = null;
        dragging.value = false;
        moving.value = false;
        resizing.value = null;
        if (capturedId !== null && surface.value?.hasPointerCapture(capturedId)) {
            surface.value.releasePointerCapture(capturedId);
        }
    }

    function resizeWithKeyboard(event: KeyboardEvent, handle: CropHandle) {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (props.disabled || props.panMode || dragging.value) return;
        autoCrop = false;
        crop.value = resizeCrop(crop.value, handle, {
            x: event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0,
            y: event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0,
        }, props.image, event.shiftKey);
    }

    function zeroIfEmpty(event: FocusEvent, field: keyof CropRect | 'angle') {
        if ((event.target as HTMLInputElement).value !== '') return;
        if (field === 'angle') angle.value = 0;
        else crop.value[field] = 0;
    }

    function onFormInput(event: Event) {
        const label = (event.target as HTMLElement).getAttribute('aria-label') ?? '';
        if (label.startsWith('Crop ')) autoCrop = false;
    }

    function apply() {
        if (!props.disabled && !dragging.value && valid.value && !unchanged.value) {
            emit('apply', { ...crop.value }, angle.value);
        }
    }
</script>

<template>
    <div
        ref="surface"
        class="crop-surface"
        :class="{ 'is-panning': panMode, 'is-moving': moving }"
        tabindex="0"
        aria-label="Crop selection. Drag inside to move or outside to select. Hold Shift for square. Enter applies; Escape cancels."
        @pointerdown="beginSelection($event)"
        @pointermove="updateSelection"
        @pointerup="endSelection"
        @pointercancel="endSelection"
        @lostpointercapture="endSelection"
        @keydown="onShiftChange"
        @keyup="onShiftChange"
        @keydown.enter.prevent="apply"
        @keydown.esc.prevent="emit('cancel')"
    >
        <div
            v-if="displayCrop.width > 0 && displayCrop.height > 0"
            class="crop-selection"
            :class="{ 'is-movable': !unchanged && !panMode }"
            :style="selectionStyle"
        >
            <span class="crop-grid" aria-hidden="true"></span>
            <template v-if="!panMode">
                <button
                    v-for="handle in handles"
                    :key="handle.id"
                    type="button"
                    class="crop-handle"
                    :aria-label="`Resize crop ${handle.label}`"
                    :title="`Resize ${handle.label}; use arrow keys for pixel adjustments`"
                    :disabled="disabled"
                    :style="{ left: `${handle.x}%`, top: `${handle.y}%`, cursor: handle.cursor }"
                    @pointerdown.stop="beginSelection($event, handle.id)"
                    @keydown="resizeWithKeyboard($event, handle.id)"
                ></button>
            </template>
        </div>
    </div>
    <Teleport defer to="#editor-tool-controls">
        <form class="crop-controls" aria-label="Crop controls" @submit.prevent="apply" @input="onFormInput" @keydown.esc.prevent="emit('cancel')">
            <fieldset :disabled="disabled || dragging">
                <div class="crop-fields">
                    <label>X <input v-model.number="crop.x" aria-label="Crop X" type="number" min="0" :max="image.width - 1" required step="1" @blur="zeroIfEmpty($event, 'x')" /></label>
                    <label>Y <input v-model.number="crop.y" aria-label="Crop Y" type="number" min="0" :max="image.height - 1" required step="1" @blur="zeroIfEmpty($event, 'y')" /></label>
                    <label>Width <input v-model.number="crop.width" aria-label="Crop width" type="number" min="1"
                        :max="image.width - crop.x" required step="1" @blur="zeroIfEmpty($event, 'width')" /></label>
                    <label>Height <input v-model.number="crop.height" aria-label="Crop height" type="number" min="1"
                        :max="image.height - crop.y" required step="1" @blur="zeroIfEmpty($event, 'height')" /></label>
                    <span class="crop-divider" role="separator" aria-orientation="vertical"></span>
                    <label class="crop-angle-slider">Straighten
                        <input v-model.number="angle" class="crop-angle-range" aria-label="Straighten angle slider" type="range"
                            :min="-MAX_STRAIGHTEN_ANGLE" :max="MAX_STRAIGHTEN_ANGLE" step="0.1" />
                    </label>
                    <label><input v-model.number="angle" aria-label="Straighten angle in degrees" type="number"
                        :min="-MAX_STRAIGHTEN_ANGLE" :max="MAX_STRAIGHTEN_ANGLE" step="0.1" required @blur="zeroIfEmpty($event, 'angle')" /> deg</label>
                    <button type="button" class="icon-button" aria-label="Reset angle" title="Reset angle" :disabled="angle === 0" @click="angle = 0">
                        <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                    </button>
                </div>
                <p v-if="!valid && !dragging" class="crop-error" role="alert" :title="`Enter a non-empty crop inside the image bounds and an angle within ±${MAX_STRAIGHTEN_ANGLE}°.`">
                    <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i> Invalid crop or angle
                </p>
                <div class="crop-actions">
                    <button type="submit" :disabled="!valid || unchanged">Apply crop</button>
                    <button type="button" @click="emit('cancel')">Cancel</button>
                </div>
            </fieldset>
        </form>
    </Teleport>
</template>

<style scoped>
.crop-surface {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: crosshair;
  touch-action: none;
}

.crop-surface.is-panning {
  cursor: inherit;
}

.crop-selection {
  position: absolute;
  border: 1px solid #fff;
  outline: 1px solid #000;
  box-shadow: 0 0 0 100vmax rgb(0 0 0 / 55%);
  pointer-events: none;
}

.crop-selection.is-movable {
  pointer-events: auto;
  cursor: move;
}

.crop-surface.is-moving {
  cursor: move;
}

.crop-grid {
  pointer-events: none;
  position: absolute;
  inset: 0;
}

.crop-handle {
  position: absolute;
  z-index: 1;
  width: 12px;
  height: 12px;
  padding: 0;
  border: 1px solid #000;
  border-radius: 1px;
  background: #fff;
  pointer-events: auto;
  touch-action: none;
  transform: translate(-50%, -50%);
}

.crop-grid::before,
.crop-grid::after {
  content: '';
  position: absolute;
  border: 0 solid rgb(255 255 255 / 60%);
}

.crop-grid::before {
  inset: 0 33.333333%;
  border-left-width: 1px;
  border-right-width: 1px;
}

.crop-grid::after {
  inset: 33.333333% 0;
  border-top-width: 1px;
  border-bottom-width: 1px;
}

.crop-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  box-sizing: border-box;
  padding: 4px 0;
}

.crop-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 0 auto;
  font-size: 12px;
  color: #ffa3a3;
}

.crop-error + .crop-actions {
  margin-left: 0;
}

fieldset {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0;
  border: 0;
}

.crop-fields {
  display: flex;
  align-items: center;
  gap: 8px;
}

.crop-divider {
  height: 24px;
  border-left: 1px solid var(--color-border);
}

.crop-actions {
  display: flex;
  gap: 8px;
}

label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

input,
button {
  height: 30px;
  padding: 4px 8px;
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  font: inherit;
}

input[type='range'] {
  appearance: none;
  width: 140px;
  padding: 0;
  background: transparent;
  border: 0;
}

.crop-angle-range::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
}

.crop-angle-range::-moz-range-track,
.crop-angle-range::-moz-range-progress {
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
}

.crop-angle-range::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  background: var(--color-text);
  border: 0;
  border-radius: 50%;
}

.crop-angle-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--color-text);
  border: 0;
  border-radius: 50%;
}

input[type='number'] {
  width: 78px;
}

button {
  cursor: pointer;
}

.crop-controls button {
  border-radius: var(--radius-button);
}

.crop-controls button[type='button'] {
  background: var(--color-button-secondary);
  border-color: var(--color-button-secondary-border);
}

.crop-controls button[type='button']:hover:not(:disabled) {
  background: var(--color-button-secondary-hover);
  border-color: var(--color-button-secondary-border-hover);
}

.icon-button {
  width: 30px;
  padding: 0;
}

button[type='submit'] {
  background: var(--color-accent);
  color: #fff;
}

@media (max-width: 1400px) {
  .crop-angle-slider {
    display: none;
  }

  .crop-controls,
  fieldset,
  .crop-fields {
    flex-wrap: wrap;
  }

  input[type='number'] {
    width: 60px;
  }
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.crop-controls button[type='button']:disabled {
  opacity: var(--opacity-button-secondary-disabled);
}

input:focus-visible {
  outline: 1px solid var(--color-focus);
  outline-offset: 0;
}

button:focus-visible,
.crop-surface:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}
</style>
