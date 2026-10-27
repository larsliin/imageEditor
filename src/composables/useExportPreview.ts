import { onScopeDispose, shallowRef, watch, type Ref } from 'vue';
import { canvasToBlob, renderToCanvas, type ExportMimeType, type PreparedExport } from '@/lib/imageIO';

export function useExportPreview(
    image: () => ImageBitmap,
    mimeType: Ref<ExportMimeType>,
    quality: Ref<number>,
) {
    const result = shallowRef<PreparedExport | null>(null);
    const previewUrl = shallowRef<string | null>(null);
    const calculating = shallowRef(false);
    const error = shallowRef<string | null>(null);
    let canvas: HTMLCanvasElement | null = null;
    let canvasBitmap: ImageBitmap | null = null;
    let canvasIsJpeg = false;
    let generation = 0;
    let running = false;
    let disposed = false;

    function clearResult() {
        result.value = null;
        if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
        previewUrl.value = null;
    }

    function releaseCanvas() {
        if (canvas) {
            canvas.width = 0;
            canvas.height = 0;
        }
        canvas = null;
        canvasBitmap = null;
    }

    async function encode() {
        if (running) return;
        running = true;
        try {
            let completedGeneration: number;
            do {
                completedGeneration = generation;
                const bitmap = image();
                const type = mimeType.value;
                const selectedQuality = quality.value;
                try {
                    if (!canvas || canvasBitmap !== bitmap || canvasIsJpeg !== (type === 'image/jpeg')) {
                        releaseCanvas();
                        canvas = renderToCanvas(bitmap, type === 'image/jpeg' ? '#fff' : undefined);
                        canvasBitmap = bitmap;
                        canvasIsJpeg = type === 'image/jpeg';
                    }
                    const blob = await canvasToBlob(canvas, type, selectedQuality);
                    if (!disposed && completedGeneration === generation) {
                        previewUrl.value = URL.createObjectURL(blob);
                        result.value = { bitmap, mimeType: type, blob };
                    }
                } catch (e) {
                    if (!disposed && completedGeneration === generation) {
                        error.value = e instanceof Error ? e.message : 'The export preview could not be created.';
                    }
                }
            } while (!disposed && completedGeneration !== generation);
        } finally {
            running = false;
            if (disposed) releaseCanvas();
            else calculating.value = false;
        }
    }

    watch([image, mimeType, () => mimeType.value === 'image/png' ? null : quality.value], () => {
        generation += 1;
        clearResult();
        error.value = null;
        calculating.value = true;
        void encode();
    }, { immediate: true, flush: 'sync' });

    onScopeDispose(() => {
        disposed = true;
        clearResult();
        if (!running) releaseCanvas();
    });

    return { result, previewUrl, calculating, error };
}
