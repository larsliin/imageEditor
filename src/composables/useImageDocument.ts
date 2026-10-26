import { computed, onScopeDispose, readonly, ref, shallowRef } from 'vue';
import type { ImageInfo } from '@/types/editor';
import { isCropInsideRotatedImage, isValidAngle, isValidCrop, type CropRect } from '@/lib/crop';
import { MAX_RESIZE_DIMENSION, isValidResize } from '@/lib/resize';
import { isIdentityLevels, isValidLevels, type LevelsParams } from '@/lib/levels';
import { isIdentityCurves, isValidCurves, type CurvesParams } from '@/lib/curves';
import type { Size } from '@/lib/zoom';
import {
    canvasToBlob,
    decodeImageFile,
    downloadBlob,
    exportFileName,
    exportFileNameFromBase,
    pickImageFile,
    renderToCanvas,
    resizeImageBitmap,
    levelsImageBitmap,
    curvesImageBitmap,
    resolveExportMimeType,
    rotateImageBitmap,
    rotateCropImageBitmap,
    type ExportMimeType,
} from '@/lib/imageIO';

export type DocumentStatus = 'idle' | 'loading' | 'processing' | 'exporting';

interface LoadedDocument {
    original: ImageBitmap
    bitmap: ImageBitmap
    fileName: string
    exportMimeType: ExportMimeType
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function useImageDocument() {
    const current = shallowRef<LoadedDocument | null>(null);
    const status = ref<DocumentStatus>('idle');
    const error = ref<string | null>(null);
    const documentId = ref(0);
    const revision = shallowRef(0);
    const savedRevision = shallowRef(0);
    const savedFileName = shallowRef('');
    const savedExportMimeType = shallowRef<ExportMimeType>('image/png');
    let nextRevision = 0;
    let disposed = false;

    const bitmap = computed(() => current.value?.bitmap ?? null);
    const info = computed<ImageInfo | null>(() =>
        current.value
            ? {
                fileName: current.value.fileName,
                width: current.value.bitmap.width,
                height: current.value.bitmap.height,
                exportMimeType: current.value.exportMimeType,
            }
            : null,
    );
    const isBusy = computed(() => status.value !== 'idle');
    const isDirty = computed(() =>
        revision.value !== savedRevision.value
        || (current.value !== null
            && (current.value.fileName !== savedFileName.value
                || current.value.exportMimeType !== savedExportMimeType.value)),
    );
    const canReset = computed(() => current.value !== null && current.value.bitmap !== current.value.original);

    function replaceDocument(next: LoadedDocument | null) {
        const previous = current.value;
        if (previous?.bitmap !== previous?.original) previous?.bitmap.close();
        previous?.original.close();
        current.value = next;
    }

    async function importImage() {
        if (isBusy.value) return;
        const file = await pickImageFile();
        if (!file || isBusy.value || disposed) return;
        if (isDirty.value && !window.confirm('Discard unsaved changes and open another image?')) return;

        status.value = 'loading';
        error.value = null;
        try {
            const decoded = await decodeImageFile(file);
            if (disposed) {
                decoded.close();
                return;
            }
            const exportMimeType = resolveExportMimeType(file.type);
            const fileName = exportFileName(file.name, exportMimeType);
            replaceDocument({ original: decoded, bitmap: decoded, fileName, exportMimeType });
            documentId.value += 1;
            revision.value = 0;
            savedRevision.value = 0;
            savedFileName.value = fileName;
            savedExportMimeType.value = exportMimeType;
            nextRevision = 0;
        } catch (e) {
            error.value = errorMessage(e, 'The image could not be opened.');
        } finally {
            status.value = 'idle';
        }
    }

    async function cropImage(crop: CropRect, angle = 0): Promise<boolean> {
        const doc = current.value;
        if (!doc || isBusy.value) return false;
        if (!isValidCrop(crop, doc.bitmap)) {
            error.value = 'Select a non-empty crop inside the image bounds.';
            return false;
        }
        if (!isValidAngle(angle) || !isCropInsideRotatedImage(crop, doc.bitmap, angle)) {
            error.value = 'The crop must stay inside the rotated image so no empty space is left.';
            return false;
        }
        if (angle === 0 && crop.x === 0 && crop.y === 0 && crop.width === doc.bitmap.width && crop.height === doc.bitmap.height) {
            return true;
        }
        status.value = 'processing';
        error.value = null;
        try {
            const cropped = angle === 0
                ? await createImageBitmap(doc.bitmap, crop.x, crop.y, crop.width, crop.height)
                : await rotateCropImageBitmap(doc.bitmap, angle, crop);
            if (disposed) {
                cropped.close();
                return false;
            }
            if (doc.bitmap !== doc.original) doc.bitmap.close();
            current.value = { ...doc, bitmap: cropped };
            revision.value = ++nextRevision;
            return true;
        } catch (e) {
            error.value = errorMessage(e, 'The image could not be cropped.');
            return false;
        } finally {
            status.value = 'idle';
        }
    }

    async function rotateImage(): Promise<boolean> {
        const doc = current.value;
        if (!doc || isBusy.value) return false;
        status.value = 'processing';
        error.value = null;
        try {
            const rotated = await rotateImageBitmap(doc.bitmap);
            if (disposed) {
                rotated.close();
                return false;
            }
            if (doc.bitmap !== doc.original) doc.bitmap.close();
            current.value = { ...doc, bitmap: rotated };
            revision.value = ++nextRevision;
            return true;
        } catch (e) {
            error.value = errorMessage(e, 'The image could not be rotated.');
            return false;
        } finally {
            status.value = 'idle';
        }
    }

    async function resizeImage(size: Size): Promise<boolean> {
        const doc = current.value;
        if (!doc || isBusy.value) return false;
        if (!isValidResize(size)) {
            error.value = `Enter a width and height between 1 and ${MAX_RESIZE_DIMENSION} px.`;
            return false;
        }
        if (size.width === doc.bitmap.width && size.height === doc.bitmap.height) return true;
        status.value = 'processing';
        error.value = null;
        try {
            const resized = await resizeImageBitmap(doc.bitmap, size.width, size.height);
            if (disposed) {
                resized.close();
                return false;
            }
            if (doc.bitmap !== doc.original) doc.bitmap.close();
            current.value = { ...doc, bitmap: resized };
            revision.value = ++nextRevision;
            return true;
        } catch (e) {
            error.value = errorMessage(e, 'The image could not be resized. It may be too large for this browser.');
            return false;
        } finally {
            status.value = 'idle';
        }
    }

    async function levelsImage(levels: LevelsParams): Promise<boolean> {
        const doc = current.value;
        if (!doc || isBusy.value) return false;
        if (!isValidLevels(levels)) {
            error.value = 'The black point must be below the white point, and gamma between 0.10 and 9.99.';
            return false;
        }
        if (isIdentityLevels(levels)) return true;
        status.value = 'processing';
        error.value = null;
        try {
            const adjusted = await levelsImageBitmap(doc.bitmap, levels);
            if (disposed) {
                adjusted.close();
                return false;
            }
            if (doc.bitmap !== doc.original) doc.bitmap.close();
            current.value = { ...doc, bitmap: adjusted };
            revision.value = ++nextRevision;
            return true;
        } catch (e) {
            error.value = errorMessage(e, 'The levels could not be applied.');
            return false;
        } finally {
            status.value = 'idle';
        }
    }

    async function curvesImage(curves: CurvesParams): Promise<boolean> {
        const doc = current.value;
        if (!doc || isBusy.value) return false;
        if (!isValidCurves(curves)) {
            error.value = 'The curve points are invalid.';
            return false;
        }
        if (isIdentityCurves(curves)) return true;
        status.value = 'processing';
        error.value = null;
        try {
            const adjusted = await curvesImageBitmap(doc.bitmap, curves);
            if (disposed) {
                adjusted.close();
                return false;
            }
            if (doc.bitmap !== doc.original) doc.bitmap.close();
            current.value = { ...doc, bitmap: adjusted };
            revision.value = ++nextRevision;
            return true;
        } catch (e) {
            error.value = errorMessage(e, 'The curves could not be applied.');
            return false;
        } finally {
            status.value = 'idle';
        }
    }

    function resetImage() {
        const doc = current.value;
        if (!doc || !canReset.value || isBusy.value) return;
        if (!window.confirm('Reset all edits to the original image?')) return;
        doc.bitmap.close();
        current.value = { ...doc, bitmap: doc.original };
        revision.value = 0;
        error.value = null;
    }

    function renameImage(fileName: string) {
        const doc = current.value;
        if (!doc || isBusy.value) return;
        const name = fileName.trim();
        if (!name) {
            error.value = 'Enter a filename.';
            return;
        }
        current.value = { ...doc, fileName: exportFileNameFromBase(name, doc.exportMimeType) };
        error.value = null;
    }

    function setExportMimeType(mimeType: ExportMimeType) {
        const doc = current.value;
        if (!doc || isBusy.value || doc.exportMimeType === mimeType) return;
        current.value = {
            ...doc,
            fileName: exportFileName(doc.fileName, mimeType),
            exportMimeType: mimeType,
        };
        error.value = null;
    }

    async function exportImage() {
        const doc = current.value;
        if (!doc || isBusy.value) return;

        status.value = 'exporting';
        error.value = null;
        try {
            const mimeType = doc.exportMimeType;
            const blob = await canvasToBlob(renderToCanvas(doc.bitmap), mimeType);
            if (disposed) return;
            downloadBlob(blob, exportFileName(doc.fileName, mimeType));
            savedRevision.value = revision.value;
            savedFileName.value = doc.fileName;
            savedExportMimeType.value = mimeType;
        } catch (e) {
            error.value = errorMessage(e, 'The image could not be saved.');
        } finally {
            status.value = 'idle';
        }
    }

    function dismissError() {
        error.value = null;
    }

    function warnBeforeUnload(event: BeforeUnloadEvent) {
        if (!isDirty.value) return;
        event.preventDefault();
        event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    onScopeDispose(() => {
        disposed = true;
        window.removeEventListener('beforeunload', warnBeforeUnload);
        replaceDocument(null);
    });

    return {
        bitmap,
        info,
        documentId: readonly(documentId),
        status: readonly(status),
        error: readonly(error),
        isBusy,
        isDirty,
        canReset,
        importImage,
        cropImage,
        rotateImage,
        resizeImage,
        levelsImage,
        curvesImage,
        resetImage,
        renameImage,
        setExportMimeType,
        exportImage,
        dismissError,
    };
}
