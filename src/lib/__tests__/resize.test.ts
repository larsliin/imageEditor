import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RESIZE_DIMENSION, heightForWidth, isValidResize, widthForHeight } from '../resize.ts';

test('accepts positive integer sizes up to the maximum dimension', () => {
    assert.equal(isValidResize({ width: 1, height: 1 }), true);
    assert.equal(isValidResize({ width: MAX_RESIZE_DIMENSION, height: 600 }), true);
});

test('rejects zero, negative, fractional, non-finite, and oversized sizes', () => {
    for (const size of [
        { width: 0, height: 100 },
        { width: 100, height: -1 },
        { width: 10.5, height: 100 },
        { width: Number.NaN, height: 100 },
        { width: 100, height: Number.POSITIVE_INFINITY },
        { width: MAX_RESIZE_DIMENSION + 1, height: 100 },
    ]) {
        assert.equal(isValidResize(size), false, JSON.stringify(size));
    }
});

test('keeps landscape and portrait aspect ratios', () => {
    const landscape = { width: 800, height: 600 };
    assert.equal(heightForWidth(400, landscape), 300);
    assert.equal(widthForHeight(300, landscape), 400);

    const portrait = { width: 600, height: 900 };
    assert.equal(heightForWidth(200, portrait), 300);
    assert.equal(widthForHeight(450, portrait), 300);
});

test('rounds to whole pixels and never returns zero', () => {
    const image = { width: 1000, height: 333 };
    assert.equal(heightForWidth(500, image), 167);
    assert.equal(heightForWidth(1, image), 1);
    assert.equal(widthForHeight(1, { width: 10, height: 1000 }), 1);
});
