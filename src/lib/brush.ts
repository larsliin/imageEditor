export interface BrushPoint {
    x: number
    y: number
}

export interface BrushSettings {
    thickness: number
    hardness: number
    color: string
}

export interface BrushStroke extends BrushSettings {
    points: readonly BrushPoint[]
}

export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
    thickness: 20,
    hardness: 100,
    color: '#000000',
};

function isValidBrushSettings(settings: BrushSettings): boolean {
    return Number.isFinite(settings.thickness)
        && settings.thickness >= 1
        && settings.thickness <= 500
        && Number.isFinite(settings.hardness)
        && settings.hardness >= 0
        && settings.hardness <= 100
        && /^#[\da-f]{6}$/i.test(settings.color);
}

export function isValidBrushStrokes(strokes: readonly BrushStroke[], width: number, height: number): boolean {
    return Number.isSafeInteger(width)
        && width > 0
        && Number.isSafeInteger(height)
        && height > 0
        && strokes.length > 0
        && strokes.every((stroke) =>
            isValidBrushSettings(stroke)
            && stroke.points.length > 0
            && stroke.points.every((point) =>
                Number.isFinite(point.x)
                && Number.isFinite(point.y)
                && point.x >= 0
                && point.x <= width
                && point.y >= 0
                && point.y <= height,
            ),
        );
}

// Shared falloff for round tips and segment bodies: opaque core, smoothstep fade to the rim.
const FALLOFF_STEPS = 8;

function profileStops(hardness: number): [offset: number, gray: number][] {
    const core = hardness / 100;
    const stops: [number, number][] = [[0, 255], [core, 255]];
    for (let step = 1; step <= FALLOFF_STEPS && core < 1; step++) {
        const t = step / FALLOFF_STEPS;
        const fade = 1 - t * t * (3 - 2 * t);
        stops.push([core + (1 - core) * t, Math.round(255 * fade)]);
    }
    return stops;
}

const gray = (value: number) => `rgb(${value},${value},${value})`;
const MAX_RETAINED_MASK_PIXELS = 4096 * 4096;
const MAX_MASK_DIMENSION = 4096;
const MAX_SUPERSAMPLE = 4;
let maskCanvas: HTMLCanvasElement | null = null;

export function brushMaskSampleScale(width: number, height: number, physicalRadius: number): number {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return 1;
    const safeRadius = Math.max(0, physicalRadius);
    const byDimension = Math.floor(MAX_MASK_DIMENSION / Math.max(width, height));
    const byArea = Math.floor(Math.sqrt(MAX_RETAINED_MASK_PIXELS / (width * height)));
    return Math.max(
        1,
        Math.min(MAX_SUPERSAMPLE, Math.max(1, Math.ceil(2 / Math.max(safeRadius, Number.EPSILON))), byDimension, byArea),
    );
}

/**
 * Draws one stroke as a soft round brush. The coverage mask is built with `lighten`
 * (per-pixel max), so overlapping segments never build up alpha within a stroke.
 */
export function drawBrushStroke(
    context: CanvasRenderingContext2D,
    stroke: BrushStroke,
    scale = 1,
): void {
    const points = stroke.points.map((point) => ({ x: point.x * scale, y: point.y * scale }));
    if (points.length === 0) return;
    const radius = stroke.thickness * scale / 2;

    const transform = context.getTransform();
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const point of points) {
        for (const corner of [
            transform.transformPoint({ x: point.x - radius, y: point.y - radius }),
            transform.transformPoint({ x: point.x + radius, y: point.y + radius }),
        ]) {
            minX = Math.min(minX, corner.x); minY = Math.min(minY, corner.y);
            maxX = Math.max(maxX, corner.x); maxY = Math.max(maxY, corner.y);
        }
    }
    const left = Math.max(0, Math.floor(minX));
    const top = Math.max(0, Math.floor(minY));
    const width = Math.min(context.canvas.width, Math.ceil(maxX)) - left;
    const height = Math.min(context.canvas.height, Math.ceil(maxY)) - top;
    if (width <= 0 || height <= 0) return;

    const physicalRadius = radius * Math.max(Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d));
    const sampleScale = brushMaskSampleScale(width, height, physicalRadius);
    const maskWidth = width * sampleScale;
    const maskHeight = height * sampleScale;

    maskCanvas ??= document.createElement('canvas');
    if (maskCanvas.width < maskWidth || maskCanvas.height < maskHeight) {
        maskCanvas.width = Math.max(maskCanvas.width, maskWidth);
        maskCanvas.height = Math.max(maskCanvas.height, maskHeight);
    }
    const mask = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!mask) return;

    mask.setTransform(1, 0, 0, 1, 0, 0);
    mask.globalCompositeOperation = 'copy';
    mask.fillStyle = '#000';
    mask.fillRect(0, 0, maskWidth, maskHeight);
    mask.globalCompositeOperation = 'lighten';
    mask.setTransform(
        transform.a * sampleScale,
        transform.b * sampleScale,
        transform.c * sampleScale,
        transform.d * sampleScale,
        (transform.e - left) * sampleScale,
        (transform.f - top) * sampleScale,
    );

    const stops = profileStops(stroke.hardness);
    for (const point of points) {
        const tip = mask.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        for (const [offset, value] of stops) tip.addColorStop(offset, gray(value));
        mask.fillStyle = tip;
        mask.beginPath();
        mask.arc(point.x, point.y, radius, 0, Math.PI * 2);
        mask.fill();
    }
    for (let index = 1; index < points.length; index++) {
        const from = points[index - 1];
        const to = points[index];
        if (!from || !to) continue;
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        if (length === 0) continue;
        // Unit normal across the segment; the body gradient mirrors the tip profile.
        const nx = -(to.y - from.y) / length * radius;
        const ny = (to.x - from.x) / length * radius;
        const body = mask.createLinearGradient(from.x - nx, from.y - ny, from.x + nx, from.y + ny);
        for (const [offset, value] of stops) {
            body.addColorStop(0.5 - offset / 2, gray(value));
            body.addColorStop(0.5 + offset / 2, gray(value));
        }
        mask.fillStyle = body;
        mask.beginPath();
        mask.moveTo(from.x - nx, from.y - ny);
        mask.lineTo(to.x - nx, to.y - ny);
        mask.lineTo(to.x + nx, to.y + ny);
        mask.lineTo(from.x + nx, from.y + ny);
        mask.closePath();
        mask.fill();
    }

    const pixels = mask.getImageData(0, 0, maskWidth, maskHeight);
    const data = pixels.data;
    const red = Number.parseInt(stroke.color.slice(1, 3), 16);
    const green = Number.parseInt(stroke.color.slice(3, 5), 16);
    const blue = Number.parseInt(stroke.color.slice(5, 7), 16);
    for (let offset = 0; offset < data.length; offset += 4) {
        data[offset + 3] = data[offset] ?? 0;
        data[offset] = red;
        data[offset + 1] = green;
        data[offset + 2] = blue;
    }
    mask.setTransform(1, 0, 0, 1, 0, 0);
    mask.putImageData(pixels, 0, 0);

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(maskCanvas, 0, 0, maskWidth, maskHeight, left, top, width, height);
    context.restore();
    // Do not keep export-sized scratch memory alive after a large render.
    if (maskCanvas.width * maskCanvas.height > MAX_RETAINED_MASK_PIXELS) maskCanvas = null;
}
