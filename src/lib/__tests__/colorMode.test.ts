import assert from 'node:assert/strict';
import test from 'node:test';
import { applyColorModeToPixels, encodeBmp } from '../colorMode.ts';

test('grayscale sets equal RGB channels and preserves alpha', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 77, 0, 255, 0, 255]);
    applyColorModeToPixels(data, 'grayscale');
    assert.deepEqual([...data], [54, 54, 54, 77, 182, 182, 182, 255]);
});

test('bitmap thresholds at 50% and becomes opaque', () => {
    const data = new Uint8ClampedArray([127, 127, 127, 255, 128, 128, 128, 255, 0, 0, 0, 0]);
    applyColorModeToPixels(data, 'bitmap');
    assert.deepEqual([...data], [0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
});

test('encodes pure black and white as 1-bit BMP with padded rows', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
    const bmp = encodeBmp(data, 3, 1);
    const view = new DataView(bmp.buffer);
    assert.equal(String.fromCharCode(bmp[0]!, bmp[1]!), 'BM');
    assert.equal(view.getUint16(28, true), 1);
    assert.equal(view.getUint32(10, true), 62);
    assert.equal(bmp.length, 62 + 4);
    assert.equal(bmp[62], 0b0110_0000);
});

test('encodes non black-and-white images as 24-bit BMP composited on white', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]);
    const bmp = encodeBmp(data, 1, 2);
    const view = new DataView(bmp.buffer);
    assert.equal(view.getUint16(28, true), 24);
    // Bottom-up: first stored row is the transparent pixel (white), then red in BGR.
    assert.deepEqual([...bmp.slice(54, 57)], [255, 255, 255]);
    assert.deepEqual([...bmp.slice(58, 61)], [0, 0, 255]);
});
