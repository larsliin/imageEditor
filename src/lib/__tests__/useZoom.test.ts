import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, nextTick, shallowRef } from 'vue';
import { useZoom } from '../../composables/useZoom.ts';

test('changing image dimensions preserves manually selected zoom', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 800, height: 400 });
    const viewportSize = shallowRef({ width: 1000, height: 700 });
    const zoomState = scope.run(() => useZoom(imageSize, viewportSize));
    assert.ok(zoomState);

    zoomState.zoomIn();
    const manualZoom = zoomState.zoom.value;
    imageSize.value = { width: 400, height: 800 };
    await nextTick();

    assert.equal(zoomState.isFit.value, false);
    assert.equal(zoomState.zoom.value, manualZoom);
    scope.stop();
});

test('fit mode continues to recalculate zoom when image dimensions change', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 800, height: 400 });
    const viewportSize = shallowRef({ width: 1000, height: 700 });
    const zoomState = scope.run(() => useZoom(imageSize, viewportSize));
    assert.ok(zoomState);

    imageSize.value = { width: 400, height: 800 };
    await nextTick();

    assert.equal(zoomState.isFit.value, true);
    assert.equal(zoomState.zoom.value, 0.875);
    scope.stop();
});
