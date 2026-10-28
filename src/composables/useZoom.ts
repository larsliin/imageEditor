import { computed, ref, watch, type Ref } from 'vue';
import {
    canZoomIn as canZoomInFrom,
    canZoomOut as canZoomOutFrom,
    fitZoom,
    nextZoomIn,
    nextZoomOut,
    type Size,
} from '../lib/zoom.ts';

/**
 * Starts in fit mode capped at 100%. Explicit fit allows enlargement; manual
 * zoom switches to a fixed level.
 */
export function useZoom(
    imageSize: Ref<Size | null>,
    viewportSize: Ref<Size>,
    sourceId: Ref<number>,
) {
    const fitMode = ref(true);
    const capInitialFit = ref(true);
    const manualZoom = ref(1);

    const fit = computed(() =>
        imageSize.value ? fitZoom(imageSize.value, viewportSize.value) : 1,
    );
    const zoom = computed(() => (
        fitMode.value ? (capInitialFit.value ? Math.min(1, fit.value) : fit.value) : manualZoom.value
    ));
    const isFit = computed(() => fitMode.value && zoom.value === fit.value);
    const canZoomIn = computed(() => imageSize.value !== null && canZoomInFrom(zoom.value));
    const canZoomOut = computed(() => imageSize.value !== null && canZoomOutFrom(zoom.value));

    function setZoom(value: number) {
        manualZoom.value = value;
        fitMode.value = false;
    }

    function zoomIn() {
        if (canZoomIn.value) setZoom(nextZoomIn(zoom.value));
    }

    function zoomOut() {
        if (canZoomOut.value) setZoom(nextZoomOut(zoom.value));
    }

    function fitToView() {
        capInitialFit.value = false;
        fitMode.value = true;
    }

    function actualSize() {
        if (imageSize.value) setZoom(1);
    }

    watch([imageSize, sourceId], ([nextSize, nextSourceId], [previousSize, previousSourceId]) => {
        if (nextSourceId !== previousSourceId || !nextSize || !previousSize) {
            capInitialFit.value = true;
            fitMode.value = true;
        }
    });

    return { zoom, isFit, canZoomIn, canZoomOut, zoomIn, zoomOut, fitToView, actualSize };
}
