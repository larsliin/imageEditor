/** Brightness/Contrast parameters: both range from -100 to +100. */
export interface BrightnessContrastParams {
    brightness: number
    contrast: number
}

export const DEFAULT_BRIGHTNESS_CONTRAST: Readonly<BrightnessContrastParams> = {
    brightness: 0,
    contrast: 0,
};

export const MIN_BRIGHTNESS_CONTRAST = -100;
export const MAX_BRIGHTNESS_CONTRAST = 100;

export function isIdentityBrightnessContrast(params: BrightnessContrastParams): boolean {
    return params.brightness === DEFAULT_BRIGHTNESS_CONTRAST.brightness
        && params.contrast === DEFAULT_BRIGHTNESS_CONTRAST.contrast;
}

export function isValidBrightnessContrast(params: BrightnessContrastParams): boolean {
    return Number.isInteger(params.brightness)
        && Number.isInteger(params.contrast)
        && params.brightness >= MIN_BRIGHTNESS_CONTRAST
        && params.brightness <= MAX_BRIGHTNESS_CONTRAST
        && params.contrast >= MIN_BRIGHTNESS_CONTRAST
        && params.contrast <= MAX_BRIGHTNESS_CONTRAST;
}

/**
 * Apply brightness and contrast to RGB channels in place.
 * Alpha is preserved.
 *
 * Brightness: -100 to +100 (shifts all values)
 * Contrast: -100 to +100 (expands/contracts around midtone)
 */
export function applyBrightnessContrastToPixels(
    data: Uint8ClampedArray,
    params: BrightnessContrastParams,
): void {
    // Brightness: shift value directly
    const brightnessDelta = (params.brightness / 100) * 255;

    // Contrast: factor around 128 (midtone)
    // -100 = flat gray at 128
    // 0 = no change
    // +100 = max contrast (pure black/white)
    const contrastFactor = params.contrast === 0
        ? 1
        : params.contrast > 0
            ? 1 + (params.contrast / 100) * 0.5
            : 1 + (params.contrast / 100);

    for (let i = 0; i < data.length; i += 4) {
        // Apply contrast (center on 128, the midpoint)
        let r = (data[i]! - 128) * contrastFactor + 128;
        let g = (data[i + 1]! - 128) * contrastFactor + 128;
        let b = (data[i + 2]! - 128) * contrastFactor + 128;

        // Apply brightness
        r += brightnessDelta;
        g += brightnessDelta;
        b += brightnessDelta;

        // Clamp to 0-255
        data[i] = Math.min(255, Math.max(0, Math.round(r)));
        data[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
        data[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
        // Alpha preserved at data[i + 3]
    }
}
