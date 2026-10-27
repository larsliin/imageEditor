<script setup lang="ts">
    import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
    import { displaySize, type Size } from '@/lib/zoom';
    import { usePan } from '@/composables/usePan';
    import CropOverlay from './CropOverlay.vue';
    import type { CropRect } from '@/lib/crop';
    import { applyLevelsToPixels, type LevelsParams } from '@/lib/levels';
    import { applyCurvesToPixels, type CurvesParams } from '@/lib/curves';
    import { applyColorModeToPixels, type ColorMode } from '@/lib/colorMode';
    import { drawRotatedImage, rotatedSize, type QuarterTurns } from '@/lib/rotate';

    const props = defineProps<{
        bitmap: ImageBitmap | null
        zoom: number
        panEnabled: boolean
        cropEnabled: boolean
        busy: boolean
        loading: boolean
        error: string | null
        levelsPreview?: LevelsParams | null
        curvesPreview?: CurvesParams | null
        colorModePreview?: ColorMode | null
        rotationPreview?: QuarterTurns
    }>();

    const emit = defineEmits<{
        import: [file?: File]
        'dismiss-error': []
        'viewport-resize': [size: Size]
        crop: [crop: CropRect, angle: number]
        'cancel-crop': []
        'zoom-in': []
        'zoom-out': []
    }>();

    const isDropActive = ref(false);
    let dragDepth = 0;

    function handleDragEnter(event: DragEvent) {
        event.preventDefault();
        dragDepth += 1;
        isDropActive.value = true;
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }

    function handleDragLeave(event: DragEvent) {
        event.preventDefault();
        dragDepth = Math.max(0, dragDepth - 1);
        isDropActive.value = dragDepth > 0;
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        dragDepth = 0;
        isDropActive.value = false;
        if (props.bitmap) return;
        const file = event.dataTransfer?.files[0];
        if (file) emit('import', file);
    }

    const cropAngle = ref(0);
    watch(() => props.cropEnabled, () => {
        cropAngle.value = 0;
    });
    watch(() => props.bitmap, () => {
        cropAngle.value = 0;
    });

    const viewportRef = useTemplateRef<HTMLDivElement>('viewport');
    const imageSurfaceRef = useTemplateRef<HTMLDivElement>('image-surface');
    const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas');

    const { isPanMode, isDragging, stopMomentum } = usePan(viewportRef, {
        enabled: () => props.panEnabled,
        available: () => props.bitmap !== null && !props.busy,
    });

    watch([() => props.zoom, () => props.bitmap], stopMomentum, { flush: 'sync' });

    const previewStyle = computed(() => {
        if (!props.bitmap) return undefined;
        const size = displaySize(rotatedSize(props.bitmap, props.rotationPreview ?? 0), props.zoom);
        return { width: `${size.width}px`, height: `${size.height}px` };
    });

    function handleWheel(event: WheelEvent) {
        if (!event.ctrlKey) return;

        event.preventDefault();
        if (event.deltaY === 0) return;

        const surface = imageSurfaceRef.value;
        const bounds = surface?.getBoundingClientRect();
        if (bounds && bounds.width > 0 && bounds.height > 0) {
            pointerAnchor = {
                clientX: event.clientX,
                clientY: event.clientY,
                imageX: (event.clientX - bounds.left) / bounds.width,
                imageY: (event.clientY - bounds.top) / bounds.height,
            };
        }

        const previousZoom = props.zoom;
        if (event.deltaY < 0) emit('zoom-in');
        else emit('zoom-out');
        void nextTick(() => {
            if (props.zoom === previousZoom) pointerAnchor = null;
        });
    }

    let resizeObserver: ResizeObserver | null = null;

    onMounted(() => {
        resizeObserver = new ResizeObserver(([entry]) => {
            if (!entry) return;
            // contentRect excludes the viewport padding, i.e. the area the image may occupy.
            emit('viewport-resize', { width: entry.contentRect.width, height: entry.contentRect.height });
        });
        if (viewportRef.value) resizeObserver.observe(viewportRef.value);
    });

    onBeforeUnmount(() => resizeObserver?.disconnect());

    // Keep the point at the viewport center stable when zooming.
    let centerRatio: { x: number; y: number } | null = null;
    let pointerAnchor: { clientX: number; clientY: number; imageX: number; imageY: number } | null = null;

    watch(
        () => props.zoom,
        () => {
            if (pointerAnchor) {
                centerRatio = null;
                return;
            }
            const viewport = viewportRef.value;
            if (!viewport || viewport.scrollWidth === 0 || viewport.scrollHeight === 0) return;
            centerRatio = {
                x: (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth,
                y: (viewport.scrollTop + viewport.clientHeight / 2) / viewport.scrollHeight,
            };
        },
        { flush: 'pre' },
    );

    watch(
        () => props.zoom,
        () => {
            const viewport = viewportRef.value;
            if (!viewport) return;
            if (pointerAnchor) {
                const surfaceBounds = imageSurfaceRef.value?.getBoundingClientRect();
                if (surfaceBounds) {
                    viewport.scrollLeft += surfaceBounds.left + pointerAnchor.imageX * surfaceBounds.width - pointerAnchor.clientX;
                    viewport.scrollTop += surfaceBounds.top + pointerAnchor.imageY * surfaceBounds.height - pointerAnchor.clientY;
                }
                pointerAnchor = null;
                return;
            }
            if (!centerRatio) return;
            viewport.scrollLeft = centerRatio.x * viewport.scrollWidth - viewport.clientWidth / 2;
            viewport.scrollTop = centerRatio.y * viewport.scrollHeight - viewport.clientHeight / 2;
            centerRatio = null;
        },
        { flush: 'post' },
    );

    watch(
        [() => props.bitmap, canvasRef, () => props.levelsPreview, () => props.curvesPreview, () => props.colorModePreview, () => props.rotationPreview],
        ([bitmap, canvas, levels, curves, colorMode, rotation]) => {
            if (!bitmap || !canvas) return;
            const size = rotatedSize(bitmap, rotation ?? 0);
            if (canvas.width !== size.width || canvas.height !== size.height) {
                canvas.width = size.width;
                canvas.height = size.height;
            }
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) return;
            context.clearRect(0, 0, canvas.width, canvas.height);
            drawRotatedImage(context, bitmap, rotation ?? 0);
            if (!levels && !curves && !colorMode) return;
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            if (levels) applyLevelsToPixels(imageData.data, levels);
            if (curves) applyCurvesToPixels(imageData.data, curves);
            if (colorMode) applyColorModeToPixels(imageData.data, colorMode);
            context.putImageData(imageData, 0, 0);
        },
        { flush: 'post' },
    );
</script>

<template>
    <main class="workspace" :aria-busy="busy">
        <div v-if="error" class="error-banner" role="alert">
            <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
            <span>{{ error }}</span>
            <button type="button" class="dismiss-button" aria-label="Dismiss error" @click="emit('dismiss-error')">
                <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
        </div>

        <div
            ref="viewport"
            class="viewport"
            :class="{
                'is-pan-mode': isPanMode,
                'is-dragging': isDragging,
                'is-drop-active': !bitmap && isDropActive,
            }"
            :tabindex="bitmap ? 0 : undefined"
            :aria-label="bitmap ? 'Image viewport, use arrow keys to pan' : undefined"
            @wheel="handleWheel"
            @dragenter="handleDragEnter"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
        >
            <p v-if="loading" class="status-message" role="status">
                <i class="bi bi-hourglass-split" aria-hidden="true"></i>
                <span>Loading image…</span>
            </p>
            <div
                v-else-if="bitmap"
                ref="image-surface"
                class="image-surface"
                :style="previewStyle"
            >
                <canvas
                    ref="canvas"
                    class="preview"
                    :class="{ 'is-magnified': zoom > 1 }"
                    aria-label="Image preview"
                    :style="cropEnabled && cropAngle !== 0 ? { transform: `rotate(${cropAngle}deg)` } : undefined"
                ></canvas>
                <CropOverlay
                    v-if="cropEnabled"
                    v-model:angle="cropAngle"
                    :image="bitmap"
                    :disabled="busy"
                    :pan-mode="isPanMode"
                    @apply="(crop, angle) => emit('crop', crop, angle)"
                    @cancel="emit('cancel-crop')"
                />
            </div>
            <div v-else class="empty-state">
                <div class="empty-state__icon" aria-hidden="true">
                    <i class="bi bi-cloud-arrow-up"></i>
                </div>
                <h1 class="empty-state__title">Drop an image</h1>
                <button type="button" class="import-button" @click="emit('import')">
                    <i class="bi bi-folder2-open" aria-hidden="true"></i>
                    <span>Choose an image</span>
                </button>
            </div>
        </div>

        <slot v-if="bitmap && !loading" name="overlay" />
    </main>
</template>

<style scoped>
.workspace {
    position: relative;
    display: grid;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background-color: var(--color-bg);
}

/* Scroll container; its padded content box is the area used to compute the fit zoom. */
.viewport {
    display: flex;
    padding: 24px;
    overflow: auto;
    /* Scroll position is driven by panning, so the scrollbars themselves are hidden. */
    scrollbar-width: none;
}

.viewport::-webkit-scrollbar {
    display: none;
}

.viewport:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
}

.viewport.is-pan-mode {
    cursor: grab;
    user-select: none;
    touch-action: none;
}

.viewport.is-dragging {
    cursor: grabbing;
}

/* Auto margins center content but, unlike justify/align center, never clip it when it overflows. */
.viewport > * {
    flex-shrink: 0;
    margin: auto;
}

.image-surface {
    position: relative;
}

.preview {
    display: block;
    width: 100%;
    height: 100%;
    /* Checkerboard makes transparent areas visible. */
    background-color: #fff;
    background-image:
        linear-gradient(45deg, #ccc 25%, transparent 25%),
        linear-gradient(-45deg, #ccc 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #ccc 75%),
        linear-gradient(-45deg, transparent 75%, #ccc 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
    box-shadow: 0 2px 12px rgb(0 0 0 / 50%);
}

.preview.is-magnified {
    image-rendering: pixelated;
}

.empty-state,
.status-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--color-text-muted);
}

.status-message > .bi {
    font-size: 48px;
}

.empty-state {
    width: min(100%, 400px);
    aspect-ratio: 1;
    padding: 40px 28px;
    gap: 20px;
    justify-content: center;
    text-align: center;
    background-color: var(--color-panel);
    border: 1px dashed var(--color-border);
    border-radius: 16px;
    transition: border-color 160ms ease, background-color 160ms ease;
}

.viewport.is-drop-active .empty-state {
    background-color: color-mix(in srgb, var(--color-accent) 8%, var(--color-panel));
    border-color: var(--color-focus);
}

.empty-state__icon {
    display: grid;
    place-items: center;
    width: 60px;
    height: 60px;
    color: var(--color-focus);
    font-size: 32px;
    background-color: rgb(96 165 250 / 12%);
    border-radius: 18px;
}

.empty-state__title {
    color: var(--color-text);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.3;
}

.import-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    color: #fff;
    background-color: var(--color-accent);
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}

.import-button:hover {
    filter: brightness(1.1);
}

.import-button:focus-visible,
.dismiss-button:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
}

.error-banner {
    position: absolute;
    top: 12px;
    left: 50%;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: calc(100% - 24px);
    padding: 8px 8px 8px 12px;
    color: #fecaca;
    background-color: #3f1d1d;
    border: 1px solid #7f1d1d;
    border-radius: 4px;
    transform: translateX(-50%);
}

.dismiss-button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.dismiss-button:hover {
    background-color: rgb(255 255 255 / 10%);
}
</style>
