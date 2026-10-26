<script setup lang="ts">
    import { computed, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
    import { displaySize, type Size } from '@/lib/zoom';
    import { usePan } from '@/composables/usePan';
    import CropOverlay from './CropOverlay.vue';
    import type { CropRect } from '@/lib/crop';

    const props = defineProps<{
        bitmap: ImageBitmap | null
        zoom: number
        panEnabled: boolean
        cropEnabled: boolean
        busy: boolean
        loading: boolean
        error: string | null
    }>();

    const emit = defineEmits<{
        import: []
        'dismiss-error': []
        'viewport-resize': [size: Size]
        crop: [crop: CropRect]
        'cancel-crop': []
    }>();

    const viewportRef = useTemplateRef<HTMLDivElement>('viewport');
    const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas');

    const { isPanMode, isDragging } = usePan(viewportRef, {
        enabled: () => props.panEnabled,
        available: () => props.bitmap !== null && !props.busy,
    });

    const previewStyle = computed(() => {
        if (!props.bitmap) return undefined;
        const size = displaySize(props.bitmap, props.zoom);
        return { width: `${size.width}px`, height: `${size.height}px` };
    });

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

    watch(
        () => props.zoom,
        () => {
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
            if (!viewport || !centerRatio) return;
            viewport.scrollLeft = centerRatio.x * viewport.scrollWidth - viewport.clientWidth / 2;
            viewport.scrollTop = centerRatio.y * viewport.scrollHeight - viewport.clientHeight / 2;
            centerRatio = null;
        },
        { flush: 'post' },
    );

    watch(
        [() => props.bitmap, canvasRef],
        ([bitmap, canvas]) => {
            if (!bitmap || !canvas) return;
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
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
            :class="{ 'is-pan-mode': isPanMode, 'is-dragging': isDragging }"
            :tabindex="bitmap ? 0 : undefined"
            :aria-label="bitmap ? 'Image viewport, use arrow keys to pan' : undefined"
        >
            <p v-if="loading" class="status-message" role="status">
                <i class="bi bi-hourglass-split" aria-hidden="true"></i>
                <span>Loading image…</span>
            </p>
            <div
                v-else-if="bitmap"
                class="image-surface"
                :style="previewStyle"
            >
                <canvas
                    ref="canvas"
                    class="preview"
                    :class="{ 'is-magnified': zoom > 1 }"
                    aria-label="Image preview"
                ></canvas>
                <CropOverlay
                    v-if="cropEnabled"
                    :image="bitmap"
                    :disabled="busy"
                    :pan-mode="isPanMode"
                    @apply="emit('crop', $event)"
                    @cancel="emit('cancel-crop')"
                />
            </div>
            <div v-else class="empty-state">
                <i class="bi bi-image" aria-hidden="true"></i>
                <p>No image open</p>
                <button type="button" class="import-button" @click="emit('import')">
                    <i class="bi bi-folder2-open" aria-hidden="true"></i>
                    <span>Import image</span>
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
  gap: 8px;
  color: var(--color-text-muted);
}

.empty-state > .bi,
.status-message > .bi {
  font-size: 48px;
}

.import-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 16px;
  color: #fff;
  background-color: var(--color-accent);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
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
