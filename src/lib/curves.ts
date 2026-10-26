export type CurvesChannel = 'rgb' | 'red' | 'green' | 'blue';

export interface CurvePoint {
    x: number
    y: number
}

export type CurvesParams = Record<CurvesChannel, CurvePoint[]>;

export interface ChannelLuts {
    r: Uint8ClampedArray
    g: Uint8ClampedArray
    b: Uint8ClampedArray
}

export const CURVES_CHANNELS: readonly { id: CurvesChannel, label: string }[] = [
    { id: 'rgb', label: 'RGB' },
    { id: 'red', label: 'Red' },
    { id: 'green', label: 'Green' },
    { id: 'blue', label: 'Blue' },
];

export const CURVE_MAX = 255;

export function defaultCurve(): CurvePoint[] {
    return [{ x: 0, y: 0 }, { x: CURVE_MAX, y: CURVE_MAX }];
}

export function defaultCurves(): CurvesParams {
    return { rgb: defaultCurve(), red: defaultCurve(), green: defaultCurve(), blue: defaultCurve() };
}

export function cloneCurves(curves: CurvesParams): CurvesParams {
    return {
        rgb: curves.rgb.map((p) => ({ ...p })),
        red: curves.red.map((p) => ({ ...p })),
        green: curves.green.map((p) => ({ ...p })),
        blue: curves.blue.map((p) => ({ ...p })),
    };
}

function isByte(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= CURVE_MAX;
}

/** At least two integer points in 0-255, with strictly increasing x. */
export function isValidCurve(points: readonly CurvePoint[]): boolean {
    if (points.length < 2) return false;
    return points.every((p, i) => isByte(p.x) && isByte(p.y) && (i === 0 || p.x > points[i - 1]!.x));
}

export function isValidCurves(curves: CurvesParams): boolean {
    return (Object.values(curves) as CurvePoint[][]).every(isValidCurve);
}

function clampByte(value: number): number {
    return Math.min(CURVE_MAX, Math.max(0, Math.round(value)));
}

/** Monotone cubic (Fritsch-Carlson) interpolation; flat outside the first and last point. */
export function buildCurveLut(points: readonly CurvePoint[]): Uint8ClampedArray {
    const lut = new Uint8ClampedArray(256);
    const n = points.length;
    const first = points[0]!;
    const last = points[n - 1]!;
    const slopes: number[] = [];
    for (let k = 0; k < n - 1; k++) {
        slopes.push((points[k + 1]!.y - points[k]!.y) / (points[k + 1]!.x - points[k]!.x));
    }
    const tangents: number[] = [slopes[0]!];
    for (let k = 1; k < n - 1; k++) {
        const a = slopes[k - 1]!;
        const b = slopes[k]!;
        tangents.push(a * b <= 0 ? 0 : (a + b) / 2);
    }
    tangents.push(slopes[n - 2]!);
    for (let k = 0; k < n - 1; k++) {
        const d = slopes[k]!;
        if (d === 0) {
            tangents[k] = 0;
            tangents[k + 1] = 0;
            continue;
        }
        const a = tangents[k]! / d;
        const b = tangents[k + 1]! / d;
        const s = a * a + b * b;
        if (s > 9) {
            const t = 3 / Math.sqrt(s);
            tangents[k] = t * a * d;
            tangents[k + 1] = t * b * d;
        }
    }

    let segment = 0;
    for (let x = 0; x < 256; x++) {
        if (x <= first.x) {
            lut[x] = first.y;
            continue;
        }
        if (x >= last.x) {
            lut[x] = last.y;
            continue;
        }
        while (points[segment + 1]!.x < x) segment++;
        const p0 = points[segment]!;
        const p1 = points[segment + 1]!;
        const h = p1.x - p0.x;
        const t = (x - p0.x) / h;
        const t2 = t * t;
        const t3 = t2 * t;
        const y = (2 * t3 - 3 * t2 + 1) * p0.y
            + (t3 - 2 * t2 + t) * h * tangents[segment]!
            + (-2 * t3 + 3 * t2) * p1.y
            + (t3 - t2) * h * tangents[segment + 1]!;
        lut[x] = clampByte(y);
    }
    return lut;
}

/** Channel curve first, then the composite RGB curve. */
export function buildCurvesLuts(curves: CurvesParams): ChannelLuts {
    const master = buildCurveLut(curves.rgb);
    const combine = (points: CurvePoint[]) => {
        const channel = buildCurveLut(points);
        const lut = new Uint8ClampedArray(256);
        for (let i = 0; i < 256; i++) lut[i] = master[channel[i]!]!;
        return lut;
    };
    return { r: combine(curves.red), g: combine(curves.green), b: combine(curves.blue) };
}

export function isIdentityCurves(curves: CurvesParams): boolean {
    const { r, g, b } = buildCurvesLuts(curves);
    return [r, g, b].every((lut) => lut.every((value, i) => value === i));
}

/** Applies the curves to the RGB channels in place; alpha is preserved. */
export function applyCurvesToPixels(data: Uint8ClampedArray, curves: CurvesParams): void {
    const { r, g, b } = buildCurvesLuts(curves);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = r[data[i]!]!;
        data[i + 1] = g[data[i + 1]!]!;
        data[i + 2] = b[data[i + 2]!]!;
    }
}

/** Inserts a point (or replaces the y of an existing point at the same x); returns its index. */
export function insertPoint(points: CurvePoint[], x: number, y: number): number {
    const px = clampByte(x);
    const py = clampByte(y);
    const existing = points.findIndex((p) => p.x === px);
    if (existing >= 0) {
        points[existing]!.y = py;
        return existing;
    }
    let index = points.findIndex((p) => p.x > px);
    if (index < 0) index = points.length;
    points.splice(index, 0, { x: px, y: py });
    return index;
}

/** Moves a point, keeping x strictly between its neighbours. */
export function movePoint(points: CurvePoint[], index: number, x: number, y: number): void {
    const point = points[index];
    if (!point) return;
    const min = index > 0 ? points[index - 1]!.x + 1 : 0;
    const max = index < points.length - 1 ? points[index + 1]!.x - 1 : CURVE_MAX;
    point.x = Math.min(max, Math.max(min, clampByte(x)));
    point.y = clampByte(y);
}

/** Removes a point unless only two remain; returns whether it was removed. */
export function removePoint(points: CurvePoint[], index: number): boolean {
    if (points.length <= 2 || index < 0 || index >= points.length) return false;
    points.splice(index, 1);
    return true;
}

/** 256-bin histogram of one RGB channel (0 = red, 1 = green, 2 = blue) of non-transparent pixels. */
export function computeChannelHistogram(data: Uint8ClampedArray, channel: 0 | 1 | 2): Uint32Array {
    const bins = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        bins[data[i + channel]!]!++;
    }
    return bins;
}
