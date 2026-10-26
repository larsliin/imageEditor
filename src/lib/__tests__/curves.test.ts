import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyCurvesToPixels,
    buildCurveLut,
    defaultCurve,
    defaultCurves,
    insertPoint,
    isIdentityCurves,
    isValidCurve,
    movePoint,
    removePoint,
} from '../curves.ts';

test('default curve is identity', () => {
    const lut = buildCurveLut(defaultCurve());
    for (let i = 0; i < 256; i++) assert.equal(lut[i], i);
    assert.equal(isIdentityCurves(defaultCurves()), true);
});

test('curve passes through its control points and stays monotone', () => {
    const lut = buildCurveLut([{ x: 0, y: 0 }, { x: 64, y: 100 }, { x: 192, y: 210 }, { x: 255, y: 255 }]);
    assert.equal(lut[64], 100);
    assert.equal(lut[192], 210);
    for (let i = 1; i < 256; i++) assert.ok(lut[i]! >= lut[i - 1]!);
});

test('lifting the midpoint brightens midtones', () => {
    const lut = buildCurveLut([{ x: 0, y: 0 }, { x: 128, y: 180 }, { x: 255, y: 255 }]);
    assert.ok(lut[100]! > 100);
});

test('values outside the end points stay flat', () => {
    const lut = buildCurveLut([{ x: 50, y: 20 }, { x: 200, y: 240 }]);
    assert.equal(lut[0], 20);
    assert.equal(lut[255], 240);
});

test('inserting keeps points sorted and replaces duplicates', () => {
    const points = defaultCurve();
    assert.equal(insertPoint(points, 100, 150), 1);
    assert.equal(insertPoint(points, 100, 160), 1);
    assert.deepEqual(points.map((p) => p.x), [0, 100, 255]);
    assert.equal(points[1]!.y, 160);
});

test('moving is bounded by neighbours and removal keeps two points', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 255, y: 255 }];
    movePoint(points, 1, 400, -20);
    assert.deepEqual(points[1], { x: 254, y: 0 });
    assert.equal(removePoint(points, 1), true);
    assert.equal(removePoint(points, 0), false);
    assert.equal(isValidCurve(points), true);
});

test('rejects unordered or out-of-range points', () => {
    assert.equal(isValidCurve([{ x: 10, y: 0 }, { x: 10, y: 5 }]), false);
    assert.equal(isValidCurve([{ x: 0, y: 0 }, { x: 300, y: 5 }]), false);
    assert.equal(isValidCurve([{ x: 0, y: 0 }]), false);
});

test('applying curves preserves alpha and applies channel before composite', () => {
    const curves = defaultCurves();
    curves.red = [{ x: 0, y: 255 }, { x: 255, y: 255 }];
    const data = new Uint8ClampedArray([10, 20, 30, 77]);
    applyCurvesToPixels(data, curves);
    assert.deepEqual([...data], [255, 20, 30, 77]);
});
