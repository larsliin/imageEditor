export type ColorMode = 'grayscale' | 'bitmap';

export const COLOR_MODES: readonly { id: ColorMode, label: string, description: string }[] = [
    { id: 'grayscale', label: 'Grayscale', description: 'Discard color and keep shades of gray.' },
    { id: 'bitmap', label: 'Bitmap (50% threshold)', description: 'Pure black and white pixels.' },
];

export const BITMAP_THRESHOLD = 128;

export function luminance(r: number, g: number, b: number): number {
    return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

/**
 * Converts pixels in place. Grayscale preserves alpha; bitmap composites transparent
 * pixels onto white and maps each pixel to black or white at the 50% threshold.
 */
export function applyColorModeToPixels(data: Uint8ClampedArray, mode: ColorMode): void {
    for (let i = 0; i < data.length; i += 4) {
        const luma = luminance(data[i]!, data[i + 1]!, data[i + 2]!);
        if (mode === 'grayscale') {
            data[i] = data[i + 1] = data[i + 2] = luma;
            continue;
        }
        const alpha = data[i + 3]! / 255;
        const value = luma * alpha + 255 * (1 - alpha) >= BITMAP_THRESHOLD ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = value;
        data[i + 3] = 255;
    }
}
