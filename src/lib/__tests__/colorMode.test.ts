import assert from 'node:assert/strict';
import test from 'node:test';
import { applyColorModeToPixels } from '../colorMode.ts';

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
