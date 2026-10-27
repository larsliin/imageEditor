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

export function renderToCanvas(source: ImageBitmap): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas 2D rendering is not available in this browser.');
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

export async function rotateCropImageBitmap(
    source: ImageBitmap,
    angleDegrees: number,
    crop: { x: number; y: number; width: number; height: number },
): Promise<ImageBitmap> {
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
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

export function canvasToBlob(canvas: HTMLCanvasElement, mimeType: ExportMimeType): Promise<Blob> {
    const quality = mimeType === 'image/png' ? undefined : LOSSY_EXPORT_QUALITY;
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded.'))),
            mimeType,
            quality,
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
