import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidBrushStrokes, smoothBrushPoints, type BrushStroke } from '../brush.ts';

const stroke: BrushStroke = { thickness: 10, color: '#ff8800', points: [{ x: 5, y: 5 }] };

test('isValidBrushStrokes accepts strokes inside the image', () => {
    assert.equal(isValidBrushStrokes([stroke], 10, 10), true);
});

test('isValidBrushStrokes rejects empty, out-of-bounds or malformed strokes', () => {
    assert.equal(isValidBrushStrokes([], 10, 10), false);
    assert.equal(isValidBrushStrokes([{ ...stroke, points: [] }], 10, 10), false);
    assert.equal(isValidBrushStrokes([{ ...stroke, points: [{ x: 11, y: 5 }] }], 10, 10), false);
    assert.equal(isValidBrushStrokes([{ ...stroke, thickness: 0 }], 10, 10), false);
    assert.equal(isValidBrushStrokes([{ ...stroke, color: 'red' }], 10, 10), false);
    assert.equal(isValidBrushStrokes([stroke], 0, 10), false);
});

test('smoothBrushPoints keeps endpoints and flattens a pixel staircase', () => {
    const staircase = Array.from({ length: 20 }, (_, index) => ({ x: index * 2, y: Math.round(index * 0.4) }));
    const smoothed = smoothBrushPoints(staircase);
    assert.deepEqual(smoothed[0], staircase[0]);
    assert.deepEqual(smoothed.at(-1), staircase.at(-1));
    const deviation = (points: { x: number; y: number }[]) =>
        Math.max(...points.slice(4, -4).map((point) => Math.abs(point.y - point.x * 0.2)));
    assert.ok(deviation(smoothed) < deviation(staircase));
});

test('smoothBrushPoints keeps a straight run straight', () => {
    const line = Array.from({ length: 10 }, (_, index) => ({ x: index * 3, y: 7 }));
    assert.ok(smoothBrushPoints(line).every((point) => point.y === 7));
});
