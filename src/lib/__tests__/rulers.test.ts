import assert from 'node:assert/strict';
import test from 'node:test';
import { rulerTicks } from '../rulers.ts';

test('rulers map image pixels to actual rounded display dimensions', () => {
    for (const [imageLength, displayLength] of [[1200, 800], [801, 267], [600, 1200], [1, 32]] as const) {
        const ticks = rulerTicks(imageLength, displayLength, 24, displayLength + 48);
        assert.equal(ticks.find((tick) => tick.value === 0)?.position, 24);
        for (const tick of ticks) {
            assert.ok(Math.abs(tick.position - (24 + tick.value * displayLength / imageLength)) < 1e-8);
            assert.equal(Number.isInteger(tick.value), true);
        }
    }
});

test('panning clips ticks to the viewport rather than the image interval', () => {
    const ticks = rulerTicks(2000, 4000, -900, 600);
    assert.ok(ticks.length > 0);
    for (const tick of ticks) {
        assert.ok(tick.position >= 0 && tick.position <= 600);
        assert.equal(tick.position, tick.value * 2 - 900);
    }
    const beforeImage = rulerTicks(100, 100, 700, 600);
    assert.ok(beforeImage.length > 0);
    assert.ok(beforeImage.every((tick) => tick.value < 0 && tick.position >= 0 && tick.position <= 600));
    const afterImage = rulerTicks(100, 100, -700, 600);
    assert.ok(afterImage.length > 0);
    assert.ok(afterImage.every((tick) => tick.value > 100 && tick.position >= 0 && tick.position <= 600));
});

test('both axes continue on either side of centered landscape and portrait images', () => {
    for (const [imageLength, displayLength, offset, viewportLength] of [
        [1200, 600, 150, 900],
        [600, 300, 250, 800],
    ] as const) {
        const ticks = rulerTicks(imageLength, displayLength, offset, viewportLength);
        assert.ok(ticks.some((tick) => tick.value < 0));
        assert.ok(ticks.some((tick) => tick.value > imageLength));
        assert.equal(ticks.find((tick) => tick.value === 0)?.position, offset);
    }
});

test('tick counts and major label spacing stay bounded throughout the zoom range', () => {
    for (const zoom of [0.01, 0.125, 1 / 3, 1, 4, 16, 32]) {
        const ticks = rulerTicks(16384, Math.round(16384 * zoom), 0, 1200);
        assert.ok(ticks.length < 120);
        const majors = ticks.filter((tick) => tick.major);
        for (const [index, tick] of majors.entries()) {
            const previous = majors[index - 1];
            if (previous) assert.ok(tick.position - previous.position >= 64 - 1e-8);
        }
    }
});

test('invalid geometry is rejected explicitly', () => {
    for (const length of [0, -1, NaN, Infinity]) {
        assert.throws(() => rulerTicks(length, 100, 0, 600), RangeError);
        assert.throws(() => rulerTicks(100, length, 0, 600), RangeError);
    }
    assert.throws(() => rulerTicks(100, 100, NaN, 600), RangeError);
    assert.throws(() => rulerTicks(100, 100, 0, -1), RangeError);
});
