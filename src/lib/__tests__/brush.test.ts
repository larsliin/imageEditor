import assert from 'node:assert/strict';
import test from 'node:test';
import { brushMaskSampleScale, isValidBrushStrokes, type BrushStroke } from '../brush.ts';

const stroke: BrushStroke = { thickness: 10, hardness: 50, color: '#ff8800', points: [{ x: 5, y: 5 }] };

test('brushMaskSampleScale supersamples thin strokes and not wide ones', () => {
    assert.equal(brushMaskSampleScale(20, 20, 0.5), 4);
    assert.equal(brushMaskSampleScale(20, 20, 1), 2);
    assert.equal(brushMaskSampleScale(200, 200, 50), 1);
});

test('brushMaskSampleScale stays within mask memory limits', () => {
    assert.equal(brushMaskSampleScale(4096, 10, 0.5), 1);
    assert.equal(brushMaskSampleScale(3000, 3000, 0.5), 1);
    assert.equal(brushMaskSampleScale(Number.NaN, 10, 1), 1);
});

test('isValidBrushStrokes accepts strokes inside the image', () => {
    assert.equal(isValidBrushStrokes([stroke], 10, 10), true);
});

test('isValidBrushStrokes rejects empty, out-of-bounds or malformed strokes', () => {
    assert.equal(isValidBrushStrokes([], 10, 10), false);
    assert.equal(isValidBrushStrokes([{ ...stroke, points: [] }], 10, 10), false);
    assert.equal(isValidBrushStrokes([{ ...stroke, points: [{ x: 11, y: 5 }] }], 10, 10), false);
    assert.equal(isValidBrushStrokes([{ ...stroke, thickness: 0 }], 10, 10), false);
    assert.equal(isValidBrushStrokes([{ ...stroke, hardness: 101 }], 10, 10), false);
    assert.equal(isValidBrushStrokes([{ ...stroke, color: 'red' }], 10, 10), false);
    assert.equal(isValidBrushStrokes([stroke], 0, 10), false);
});
