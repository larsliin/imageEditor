import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RESIZE_DIMENSION, dimensionForPercentage, heightForWidth, isValidResize, sizeForPercentage, widthForHeight } from '../resize.ts';

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

test('scales landscape and portrait images by percentage of their current size', () => {
    assert.deepEqual(sizeForPercentage({ width: 800, height: 600 }, 50), { width: 400, height: 300 });
    assert.deepEqual(sizeForPercentage({ width: 600, height: 900 }, 200), { width: 1200, height: 1800 });
    assert.deepEqual(sizeForPercentage({ width: 800, height: 600 }, 100), { width: 800, height: 600 });
});

test('supports fractional percentages and rounds each side to at least one pixel', () => {
    assert.deepEqual(sizeForPercentage({ width: 1000, height: 333 }, 12.5), { width: 125, height: 42 });
    assert.deepEqual(sizeForPercentage({ width: 1000, height: 1 }, 0.01), { width: 1, height: 1 });
});

test('converts independent width and height percentages within pixel bounds', () => {
    assert.equal(dimensionForPercentage(800, 50), 400);
    assert.equal(dimensionForPercentage(600, 125), 750);
    assert.equal(dimensionForPercentage(333, 12.5), 42);
    assert.equal(dimensionForPercentage(1, 0.01), 1);
    for (const percentage of [0, -1, NaN, Infinity, 3000]) {
        assert.equal(dimensionForPercentage(800, percentage), null);
    }
});

test('rejects invalid percentages and output beyond the resize limit', () => {
    for (const percentage of [0, -1, Number.NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
        assert.equal(sizeForPercentage({ width: 800, height: 600 }, percentage), null);
    }
    assert.deepEqual(sizeForPercentage({ width: 8192, height: 4096 }, 200), {
        width: MAX_RESIZE_DIMENSION, height: 8192,
    });
    assert.equal(sizeForPercentage({ width: 8192, height: 4096 }, 200.02), null);
    assert.equal(sizeForPercentage({ width: 4096, height: 8192 }, 200.02), null);
});
