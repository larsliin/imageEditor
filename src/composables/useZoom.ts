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
 * Zoom state for the image preview. Starts in "fit" mode (follows viewport size)
 * and switches to a fixed zoom level once the user zooms in or out.
 */
export function useZoom(imageSize: Ref<Size | null>, viewportSize: Ref<Size>) {
    const isFit = ref(true);
    const manualZoom = ref(1);

    const fit = computed(() =>
        imageSize.value ? fitZoom(imageSize.value, viewportSize.value) : 1,
    );
    const zoom = computed(() => (isFit.value ? fit.value : manualZoom.value));
    const canZoomIn = computed(() => imageSize.value !== null && canZoomInFrom(zoom.value));
    const canZoomOut = computed(() => imageSize.value !== null && canZoomOutFrom(zoom.value));

    function setZoom(value: number) {
        manualZoom.value = value;
        isFit.value = false;
    }

    function zoomIn() {
        if (canZoomIn.value) setZoom(nextZoomIn(zoom.value));
    }

    function zoomOut() {
        if (canZoomOut.value) setZoom(nextZoomOut(zoom.value));
    }

    function fitToView() {
        isFit.value = true;
    }

    function actualSize() {
        if (imageSize.value) setZoom(1);
    }

    watch(imageSize, (nextSize, previousSize) => {
        if (!nextSize || !previousSize) fitToView();
    });

    return { zoom, isFit, canZoomIn, canZoomOut, zoomIn, zoomOut, fitToView, actualSize };
}
