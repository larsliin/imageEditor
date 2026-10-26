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
