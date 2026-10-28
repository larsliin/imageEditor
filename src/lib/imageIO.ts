import { applyLevelsToPixels, type LevelsParams } from './levels';
import { applyCurvesToPixels, type CurvesParams } from './curves';
import { applyColorModeToPixels, type ColorMode } from './colorMode';
import { drawRotatedImage, rotatedSize, type QuarterTurns } from './rotate';

export type ExportMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

const EXPORT_EXTENSIONS: Record<ExportMimeType, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
};

const LOSSY_EXPORT_QUALITY = 0.92;

export interface PreparedExport {
    bitmap: ImageBitmap
    mimeType: ExportMimeType
    blob: Blob
}

export const EXPORT_QUALITY_PRESETS = [
    { label: 'Very High', value: 0.92 },
    { label: 'High', value: 0.8 },
    { label: 'Medium', value: 0.6 },
    { label: 'Low', value: 0.4 },
] as const;

export function pickImageFile(): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
        input.addEventListener('cancel', () => resolve(null), { once: true });
        input.click();
    });
}

export async function decodeImageFile(file: File): Promise<ImageBitmap> {
    if (!file.type.startsWith('image/')) {
        throw new Error(`"${file.name}" is not an image file.`);
    }
    try {
        return await createImageBitmap(file);
    } catch {
        throw new Error(`"${file.name}" could not be decoded. The file may be corrupt or the format is not supported.`);
    }
}

export function resolveExportMimeType(sourceMimeType: string): ExportMimeType {
    return sourceMimeType in EXPORT_EXTENSIONS ? (sourceMimeType as ExportMimeType) : 'image/png';
}

export function exportFileName(sourceFileName: string, mimeType: ExportMimeType): string {
    const dot = sourceFileName.lastIndexOf('.');
    const baseName = dot > 0 ? sourceFileName.slice(0, dot) : sourceFileName;
    return `${baseName || 'image'}.${EXPORT_EXTENSIONS[mimeType]}`;
}

export function exportFileNameFromBase(baseName: string, mimeType: ExportMimeType): string {
    return `${baseName}.${EXPORT_EXTENSIONS[mimeType]}`;
}

export function renderToCanvas(source: ImageBitmap, background?: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas 2D rendering is not available in this browser.');
    }
    if (background) {
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(source, 0, 0);
    return canvas;
}

export async function rotateImageBitmap(source: ImageBitmap, turns: QuarterTurns = 1): Promise<ImageBitmap> {
    const canvas = document.createElement('canvas');
    const size = rotatedSize(source, turns);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas 2D rendering is not available in this browser.');
    }
    drawRotatedImage(context, source, turns);
    return createImageBitmap(canvas);
}

export async function cropImageBitmap(
    source: ImageBitmap,
    crop: { x: number; y: number; width: number; height: number },
): Promise<ImageBitmap> {
    if ([crop.x, crop.y, crop.width, crop.height].every(Number.isSafeInteger)) {
        return createImageBitmap(source, crop.x, crop.y, crop.width, crop.height);
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.width));
    canvas.height = Math.max(1, Math.round(crop.height));
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas 2D rendering is not available in this browser.');
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    return createImageBitmap(canvas);
}

export async function rotateCropImageBitmap(
    source: ImageBitmap,
    angleDegrees: number,
    crop: { x: number; y: number; width: number; height: number },
): Promise<ImageBitmap> {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.width));
    canvas.height = Math.max(1, Math.round(crop.height));
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas 2D rendering is not available in this browser.');
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.translate(-crop.x, -crop.y);
    context.translate(source.width / 2, source.height / 2);
    context.rotate(angleDegrees * Math.PI / 180);
    context.drawImage(source, -source.width / 2, -source.height / 2);
    return createImageBitmap(canvas);
}

export async function resizeImageBitmap(source: ImageBitmap, width: number, height: number): Promise<ImageBitmap> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas 2D rendering is not available in this browser.');
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, width, height);
    return createImageBitmap(canvas);
}

export async function levelsImageBitmap(source: ImageBitmap, levels: LevelsParams): Promise<ImageBitmap> {
    const canvas = renderToCanvas(source);
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas 2D rendering is not available in this browser.');
    }
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    applyLevelsToPixels(imageData.data, levels);
    context.putImageData(imageData, 0, 0);
    return createImageBitmap(canvas);
}

export async function curvesImageBitmap(source: ImageBitmap, curves: CurvesParams): Promise<ImageBitmap> {
    const canvas = renderToCanvas(source);
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas 2D rendering is not available in this browser.');
    }
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    applyCurvesToPixels(imageData.data, curves);
    context.putImageData(imageData, 0, 0);
    return createImageBitmap(canvas);
}

export async function colorModeImageBitmap(source: ImageBitmap, mode: ColorMode): Promise<ImageBitmap> {
    const canvas = renderToCanvas(source);
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas 2D rendering is not available in this browser.');
    }
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    applyColorModeToPixels(imageData.data, mode);
    context.putImageData(imageData, 0, 0);
    return createImageBitmap(canvas);
}

export function canvasToBlob(
    canvas: HTMLCanvasElement,
    mimeType: ExportMimeType,
    quality = LOSSY_EXPORT_QUALITY,
): Promise<Blob> {
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
        return Promise.reject(new Error('Export quality must be between 0 and 1.'));
    }
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) reject(new Error('The image could not be encoded.'));
                else if (blob.type !== mimeType) reject(new Error('This browser does not support the selected export format.'));
                else resolve(blob);
            },
            mimeType,
            mimeType === 'image/png' ? undefined : quality,
        );
    });
}

export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
