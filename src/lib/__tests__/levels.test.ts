import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyLevelsToPixels,
    buildLevelsLut,
    computeHistogram,
    gammaFromMidpoint,
    isValidLevels,
    midpointFromGamma,
} from '../levels.ts';

test('identity levels produce an identity lookup table', () => {
    const lut = buildLevelsLut({ black: 0, gamma: 1, white: 255 });
    for (let i = 0; i < 256; i++) assert.equal(lut[i], i);
});

test('black and white points clip and stretch', () => {
    const lut = buildLevelsLut({ black: 50, gamma: 1, white: 200 });
    assert.equal(lut[50], 0);
    assert.equal(lut[30], 0);
    assert.equal(lut[200], 255);
    assert.equal(lut[250], 255);
});

test('gamma above 1 brightens midtones', () => {
    const lut = buildLevelsLut({ black: 0, gamma: 2, white: 255 });
    assert.ok(lut[128]! > 128);
});

test('midpoint and gamma convert both ways', () => {
    assert.equal(midpointFromGamma({ black: 0, gamma: 1, white: 255 }), 127.5);
    const gamma = gammaFromMidpoint(63.75, 0, 255);
    assert.ok(Math.abs(gamma - 2) < 1e-9);
});

test('rejects inverted or out-of-range levels', () => {
    assert.equal(isValidLevels({ black: 100, gamma: 1, white: 100 }), false);
    assert.equal(isValidLevels({ black: 0, gamma: 0, white: 255 }), false);
    assert.equal(isValidLevels({ black: -1, gamma: 1, white: 255 }), false);
    assert.equal(isValidLevels({ black: 0, gamma: 1, white: 255 }), true);
});

test('applying levels preserves alpha', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 77]);
    applyLevelsToPixels(data, { black: 100, gamma: 1, white: 200 });
    assert.deepEqual([...data], [0, 0, 0, 77]);
});

test('histogram ignores transparent pixels', () => {
    const hist = computeHistogram(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]));
    assert.equal(hist[255], 1);
    assert.equal(hist[0], 0);
});
