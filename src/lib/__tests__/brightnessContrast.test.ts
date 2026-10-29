import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyBrightnessContrastToPixels,
    isIdentityBrightnessContrast,
    isValidBrightnessContrast,
} from '../brightnessContrast.ts';

test('identity brightness and contrast produce no change', () => {
    const data = new Uint8ClampedArray([128, 64, 192, 255, 0, 255, 0, 128]);
    const original = [...data];
    applyBrightnessContrastToPixels(data, { brightness: 0, contrast: 0 });
    assert.deepEqual([...data], original);
});

test('positive brightness increases all RGB values', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    applyBrightnessContrastToPixels(data, { brightness: 50, contrast: 0 });
    const [r, g, b] = data;
    assert.ok(r! > 100 && g! > 100 && b! > 100);
    assert.equal(data[3], 255); // alpha unchanged
});

test('negative brightness decreases all RGB values', () => {
    const data = new Uint8ClampedArray([150, 150, 150, 255]);
    applyBrightnessContrastToPixels(data, { brightness: -50, contrast: 0 });
    const [r, g, b] = data;
    assert.ok(r! < 150 && g! < 150 && b! < 150);
    assert.equal(data[3], 255); // alpha unchanged
});

test('brightness clamps to 0-255 range', () => {
    const data = new Uint8ClampedArray([200, 200, 200, 255]);
    applyBrightnessContrastToPixels(data, { brightness: 100, contrast: 0 });
    assert.ok(data[0]! <= 255 && data[1]! <= 255 && data[2]! <= 255);
});

test('positive contrast expands tones around midtone', () => {
    // Values below 128 should become darker, above should become lighter
    const data = new Uint8ClampedArray([100, 150, 200, 255]);
    const original = [...data];
    applyBrightnessContrastToPixels(data, { brightness: 0, contrast: 50 });
    assert.ok(data[0]! < original[0]!); // 100 becomes darker
    assert.ok(data[2]! > original[2]!); // 200 becomes lighter
});

test('negative contrast flattens tones toward midtone', () => {
    const data = new Uint8ClampedArray([50, 128, 200, 255]);
    const original = [...data];
    applyBrightnessContrastToPixels(data, { brightness: 0, contrast: -50 });
    // All values should move toward 128
    assert.ok(Math.abs(data[0]! - 128) < Math.abs(original[0]! - 128));
    assert.ok(Math.abs(data[2]! - 128) < Math.abs(original[2]! - 128));
});

test('midtone (128) stays unchanged with contrast', () => {
    const data = new Uint8ClampedArray([128, 128, 128, 255]);
    const original = [...data];
    applyBrightnessContrastToPixels(data, { brightness: 0, contrast: 100 });
    assert.deepEqual([...data], original);
});

test('alpha channel is always preserved', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 77, 200, 200, 200, 200]);
    applyBrightnessContrastToPixels(data, { brightness: 50, contrast: 50 });
    assert.equal(data[3], 77);
    assert.equal(data[7], 200);
});

test('isValidBrightnessContrast validates range', () => {
    assert.equal(isValidBrightnessContrast({ brightness: 0, contrast: 0 }), true);
    assert.equal(isValidBrightnessContrast({ brightness: -100, contrast: 100 }), true);
    assert.equal(isValidBrightnessContrast({ brightness: 100, contrast: -100 }), true);
    assert.equal(isValidBrightnessContrast({ brightness: -101, contrast: 0 }), false);
    assert.equal(isValidBrightnessContrast({ brightness: 101, contrast: 0 }), false);
    assert.equal(isValidBrightnessContrast({ brightness: 0, contrast: -101 }), false);
    assert.equal(isValidBrightnessContrast({ brightness: 0, contrast: 101 }), false);
});

test('isValidBrightnessContrast requires integers', () => {
    assert.equal(isValidBrightnessContrast({ brightness: 0.5, contrast: 0 }), false);
    assert.equal(isValidBrightnessContrast({ brightness: 0, contrast: 50.5 }), false);
    assert.equal(isValidBrightnessContrast({ brightness: 50, contrast: 50 }), true);
});

test('isIdentityBrightnessContrast detects no-op adjustments', () => {
    assert.equal(isIdentityBrightnessContrast({ brightness: 0, contrast: 0 }), true);
    assert.equal(isIdentityBrightnessContrast({ brightness: 50, contrast: 0 }), false);
    assert.equal(isIdentityBrightnessContrast({ brightness: 0, contrast: 50 }), false);
    assert.equal(isIdentityBrightnessContrast({ brightness: 50, contrast: 50 }), false);
});

test('brightness and contrast stack together', () => {
    const data = new Uint8ClampedArray([128, 128, 128, 255]);
    applyBrightnessContrastToPixels(data, { brightness: 50, contrast: 50 });
    // Should be brighter (from +50 brightness) and same midtone stays at 128
    assert.ok(data[0]! >= 128);
});

test('extreme contrast does not crash', () => {
    const data = new Uint8ClampedArray([50, 100, 150, 200, 255, 255, 255, 255]);
    assert.doesNotThrow(() => {
        applyBrightnessContrastToPixels(data, { brightness: 100, contrast: 100 });
    });
});
