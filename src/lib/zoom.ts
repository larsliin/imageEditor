export interface Size {
    width: number
    height: number
}

export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 32;

/** Photoshop-like zoom steps; zooming in/out snaps to the next step. */
export const ZOOM_STEPS: readonly number[] = [
    0.01, 0.02, 0.03, 0.04, 0.05, 1 / 12, 1 / 8, 1 / 6, 0.25, 1 / 3, 0.5, 2 / 3, 1, 2, 3, 4, 5, 6, 7,
    8, 12, 16, 24, 32,
];

const EPSILON = 1e-6;

/** Largest scale within the zoom limits at which the image fits inside the viewport. */
export function fitZoom(image: Size, viewport: Size): number {
    if (image.width <= 0 || image.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
        return 1;
    }
    const scale = Math.min(viewport.width / image.width, viewport.height / image.height);
    return clampZoom(scale);
}

export function clampZoom(zoom: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function nextZoomIn(zoom: number): number {
    return ZOOM_STEPS.find((step) => step > zoom + EPSILON) ?? MAX_ZOOM;
}

export function nextZoomOut(zoom: number): number {
    return [...ZOOM_STEPS].reverse().find((step) => step < zoom - EPSILON) ?? MIN_ZOOM;
}

export function canZoomIn(zoom: number): boolean {
    return zoom < MAX_ZOOM - EPSILON;
}

export function canZoomOut(zoom: number): boolean {
    return zoom > MIN_ZOOM + EPSILON;
}

/** Displayed (CSS pixel) size of the image at the given zoom. */
export function displaySize(image: Size, zoom: number): Size {
    return {
        width: Math.max(1, Math.round(image.width * zoom)),
        height: Math.max(1, Math.round(image.height * zoom)),
    };
}

export function formatZoom(zoom: number): string {
    const percent = Math.round(zoom * 1000) / 10;
    return `${percent}%`;
}
