import type { Size } from './zoom';

/** Conservative per-side limit that canvas and ImageBitmap support across major browsers. */
export const MAX_RESIZE_DIMENSION = 16384;

export function isValidResize(size: Size): boolean {
    return [size.width, size.height].every(
        (value) => Number.isSafeInteger(value) && value >= 1 && value <= MAX_RESIZE_DIMENSION,
    );
}

function scaleDimension(value: number, from: number, to: number): number {
    return Math.max(1, Math.round(value * to / from));
}

/** Height matching `width` while keeping the aspect ratio of `source`. */
export function heightForWidth(width: number, source: Size): number {
    return scaleDimension(width, source.width, source.height);
}

/** Width matching `height` while keeping the aspect ratio of `source`. */
export function widthForHeight(height: number, source: Size): number {
    return scaleDimension(height, source.height, source.width);
}
