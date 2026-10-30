export interface BrushPoint {
    x: number
    y: number
}

export interface BrushSettings {
    thickness: number
    color: string
}

export interface BrushStroke extends BrushSettings {
    points: readonly BrushPoint[]
}

export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
    thickness: 20,
    color: '#000000',
};

export function isValidBrushSettings(settings: BrushSettings): boolean {
    return Number.isInteger(settings.thickness)
        && settings.thickness >= 1
        && settings.thickness <= 500
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
/**
 * Smooths pointer samples (endpoints kept): a short weighted moving average removes the staircase
 * from whole-pixel pointer positions, then Chaikin corner cutting rounds the remaining joints.
 */
export function smoothBrushPoints(points: readonly BrushPoint[]): BrushPoint[] {
    if (points.length <= 2) return [...points];
    const weights = [1, 2, 3, 2, 1];
    const reach = (weights.length - 1) / 2;
    const averaged = points.map((point, index) => {
        if (index === 0 || index === points.length - 1) return point;
        // Shrink the window near the ends so the stroke still starts and ends where drawn.
        const span = Math.min(reach, index, points.length - 1 - index);
        let x = 0; let y = 0; let total = 0;
        for (let offset = -span; offset <= span; offset++) {
            const sample = points[index + offset] as BrushPoint;
            const weight = weights[offset + reach] as number;
            x += sample.x * weight; y += sample.y * weight; total += weight;
        }
        return { x: x / total, y: y / total };
    });
    const result: BrushPoint[] = [averaged[0] as BrushPoint];
    for (let index = 1; index < averaged.length; index++) {
        const from = averaged[index - 1] as BrushPoint;
        const to = averaged[index] as BrushPoint;
        result.push(
            { x: from.x * 0.75 + to.x * 0.25, y: from.y * 0.75 + to.y * 0.25 },
            { x: from.x * 0.25 + to.x * 0.75, y: from.y * 0.25 + to.y * 0.75 },
        );
    }
    result.push(averaged.at(-1) as BrushPoint);
    return result;
}

/** Draws one stroke as an opaque round brush in source-image coordinates. */
export function drawBrushStroke(context: CanvasRenderingContext2D, stroke: BrushStroke): void {
    const [first, ...rest] = smoothBrushPoints(stroke.points);
    if (!first) return;
    context.save();
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    context.fillStyle = stroke.color;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.thickness;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    if (rest.length === 0) {
        context.arc(first.x, first.y, stroke.thickness / 2, 0, Math.PI * 2);
        context.fill();
    } else {
        context.moveTo(first.x, first.y);
        for (const point of rest) context.lineTo(point.x, point.y);
        context.stroke();
    }
    context.restore();
}
