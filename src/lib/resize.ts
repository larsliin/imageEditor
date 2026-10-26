import type { Size } from './zoom';

/** Conservative per-side limit that canvas and ImageBitmap support across major browsers. */
export const MAX_RESIZE_DIMENSION = 16384;

export function isValidResize(size: Size): boolean {
    return [size.width, size.height].every(
        (value) => Number.isSafeInteger(value) && value >= 1 && value <= MAX_RESIZE_DIMENSION,
    );
}

export function dimensionForPercentage(source: number, percentage: number): number | null {
    if (!Number.isFinite(percentage) || percentage <= 0) return null;
    const dimension = Math.max(1, Math.round(source * percentage / 100));
    return Number.isSafeInteger(dimension) && dimension <= MAX_RESIZE_DIMENSION ? dimension : null;
}

export function sizeForPercentage(source: Size, percentage: number): Size | null {
    const width = dimensionForPercentage(source.width, percentage);
    const height = dimensionForPercentage(source.height, percentage);
    if (width === null || height === null) return null;
    const size = {
        width,
        height,
    };
    return isValidResize(size) ? size : null;
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
