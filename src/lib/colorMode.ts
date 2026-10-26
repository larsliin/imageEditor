export type ColorMode = 'grayscale' | 'bitmap';

export const COLOR_MODES: readonly { id: ColorMode, label: string, description: string }[] = [
    { id: 'grayscale', label: 'Grayscale', description: 'Discard color and keep shades of gray.' },
    { id: 'bitmap', label: 'Bitmap (50% threshold)', description: 'Pure black and white pixels. Exports as BMP.' },
];

export const BITMAP_THRESHOLD = 128;

export function luminance(r: number, g: number, b: number): number {
    return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

/**
 * Converts pixels in place. Grayscale preserves alpha; bitmap composites onto white
 * (BMP has no alpha) and maps each pixel to black or white at the 50% threshold.
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

function isBlackAndWhite(data: Uint8ClampedArray): boolean {
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        if ((r !== 0 && r !== 255) || data[i + 1] !== r || data[i + 2] !== r || data[i + 3] !== 255) return false;
    }
    return true;
}

/**
 * Encodes RGBA pixels as an uncompressed bottom-up BMP. Pure black-and-white opaque images
 * are written as 1-bit monochrome; anything else as 24-bit, composited onto white.
 */
export function encodeBmp(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
    if (width < 1 || height < 1 || data.length !== width * height * 4) {
        throw new Error('The image could not be encoded as BMP.');
    }
    const monochrome = isBlackAndWhite(data);
    const bitsPerPixel = monochrome ? 1 : 24;
    const paletteSize = monochrome ? 8 : 0;
    const rowSize = Math.ceil((width * bitsPerPixel) / 32) * 4;
    const pixelOffset = 14 + 40 + paletteSize;
    const fileSize = pixelOffset + rowSize * height;

    const buffer = new Uint8Array(fileSize);
    const view = new DataView(buffer.buffer);
    buffer[0] = 0x42; // 'B'
    buffer[1] = 0x4d; // 'M'
    view.setUint32(2, fileSize, true);
    view.setUint32(10, pixelOffset, true);
    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, height, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, bitsPerPixel, true);
    view.setUint32(34, rowSize * height, true);
    view.setInt32(38, 2835, true); // 72 DPI
    view.setInt32(42, 2835, true);
    if (monochrome) {
        view.setUint32(46, 2, true);
        // Palette: index 0 = black, index 1 = white (BGRA).
        buffer.set([0, 0, 0, 0, 255, 255, 255, 0], 54);
    }

    for (let y = 0; y < height; y++) {
        const rowStart = pixelOffset + (height - 1 - y) * rowSize;
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (monochrome) {
                if (data[i] === 255) buffer[rowStart + (x >> 3)]! |= 0x80 >> (x & 7);
                continue;
            }
            const alpha = data[i + 3]! / 255;
            const o = rowStart + x * 3;
            buffer[o] = Math.round(data[i + 2]! * alpha + 255 * (1 - alpha));
            buffer[o + 1] = Math.round(data[i + 1]! * alpha + 255 * (1 - alpha));
            buffer[o + 2] = Math.round(data[i]! * alpha + 255 * (1 - alpha));
        }
    }
    return buffer;
}
