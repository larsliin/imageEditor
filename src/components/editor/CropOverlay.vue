<script setup lang="ts">
    import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue';
    import { cropFromPoints, squareCropFromPoints, moveCrop, resizeCrop, snapCropToPixels, isValidCrop, previewToImagePoint, isCropInsideRotatedImage, isValidAngle, largestCropInsideRotatedImage, type CropRect, type CropHandle, type Point } from '@/lib/crop';
    import type { Size } from '@/lib/zoom';
    import CropControls from './CropControls.vue';

    const props = defineProps<{
        image: Size
        disabled: boolean
        panMode: boolean
    }>();

    const angle = defineModel<number>('angle', { default: 0 });
    const snapPreferenceKey = 'image-editor-crop-snap-to-pixel';

    function loadSnapPreference(): boolean {
        try {
            const preference = localStorage.getItem(snapPreferenceKey);
            if (preference === null) return false;
            if (preference === 'true') return true;
            if (preference === 'false') return false;
            console.warn('Ignoring an invalid saved crop snap preference:', preference);
        } catch (error) {
            console.warn('Unable to restore the saved crop snap preference:', error);
        }
        return false;
    }

    const snapToPixel = shallowRef(loadSnapPreference());
    watch(snapToPixel, (value) => {
        if (value && isValidCrop(crop.value, props.image)) {
            crop.value = snapCropToPixels(crop.value, props.image);
        }
        try {
            localStorage.setItem(snapPreferenceKey, String(value));
        } catch (error) {
            console.warn('Unable to save the crop snap preference:', error);
        }
    });

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

    // Automatic crops follow the current angle until the user adjusts the selection.
    let autoCrop = true;

    watch(angle, (value) => {
        if (!isValidAngle(value)) return;
        if (autoCrop) {
            crop.value = largestCropInsideRotatedImage(props.image, value);
            return;
        }
        if (rectValid.value && !isCropInsideRotatedImage(crop.value, props.image, value)) {
            autoCrop = true;
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
            snapToPixel.value,
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
    <CropControls
        :image="image"
        :crop="crop"
        :disabled="disabled"
        :dragging="dragging"
        :valid="valid"
        :unchanged="unchanged"
        v-model:angle="angle"
        v-model:snap-to-pixel="snapToPixel"
        @update:crop="crop = $event"
        @manual-change="onFormInput"
        @apply="apply"
        @cancel="emit('cancel')"
    />
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

.crop-surface:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
}
</style>
