/** Photoshop-style input levels: black point, midtone gamma and white point, all in 0-255 source values. */
export interface LevelsParams {
    black: number
    gamma: number
    white: number
}

export const DEFAULT_LEVELS: Readonly<LevelsParams> = { black: 0, gamma: 1, white: 255 };
export const MIN_GAMMA = 0.1;
export const MAX_GAMMA = 9.99;
export const LEVELS_MAX_VALUE = 255;

export function isIdentityLevels(levels: LevelsParams): boolean {
    return levels.black === DEFAULT_LEVELS.black
        && levels.white === DEFAULT_LEVELS.white
        && levels.gamma === DEFAULT_LEVELS.gamma;
}

export function isValidLevels(levels: LevelsParams): boolean {
    return Number.isInteger(levels.black)
        && Number.isInteger(levels.white)
        && levels.black >= 0
        && levels.white <= LEVELS_MAX_VALUE
        && levels.black < levels.white
        && Number.isFinite(levels.gamma)
        && levels.gamma >= MIN_GAMMA
        && levels.gamma <= MAX_GAMMA;
}

export function clampGamma(gamma: number): number {
    return Math.min(MAX_GAMMA, Math.max(MIN_GAMMA, gamma));
}

/** Gamma 1 sits halfway between black and white; higher gamma moves the handle toward black (brighter). */
export function midpointFromGamma(levels: LevelsParams): number {
    return levels.black + (levels.white - levels.black) * Math.pow(0.5, levels.gamma);
}

export function gammaFromMidpoint(midpoint: number, black: number, white: number): number {
    const ratio = (midpoint - black) / (white - black);
    const clamped = Math.min(1 - 1e-6, Math.max(1e-6, ratio));
    return clampGamma(Math.round(Math.log(clamped) / Math.log(0.5) * 100) / 100);
}

export function buildLevelsLut(levels: LevelsParams): Uint8ClampedArray {
    const lut = new Uint8ClampedArray(256);
    const range = levels.white - levels.black;
    const exponent = 1 / levels.gamma;
    for (let i = 0; i < 256; i++) {
        const normalized = Math.min(1, Math.max(0, (i - levels.black) / range));
        lut[i] = Math.round(Math.pow(normalized, exponent) * 255);
    }
    return lut;
}

/** Applies levels to the RGB channels in place; alpha is preserved. */
export function applyLevelsToPixels(data: Uint8ClampedArray, levels: LevelsParams): void {
    const lut = buildLevelsLut(levels);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = lut[data[i]!]!;
        data[i + 1] = lut[data[i + 1]!]!;
        data[i + 2] = lut[data[i + 2]!]!;
    }
}

/** 256-bin luminosity histogram of non-transparent pixels. */
export function computeHistogram(data: Uint8ClampedArray): Uint32Array {
    const bins = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const luma = Math.round(0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!);
        bins[luma]!++;
    }
    return bins;
}
