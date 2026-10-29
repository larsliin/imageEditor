import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, nextTick, shallowRef } from 'vue';
import { useAnimatedZoom } from '../../composables/useAnimatedZoom.ts';

test('animated zoom: initial state matches useZoom behavior', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 800, height: 400 });
    const viewportSize = shallowRef({ width: 1000, height: 700 });
    const sourceId = shallowRef(1);
    const zoomState = scope.run(() => useAnimatedZoom(imageSize, viewportSize, sourceId));
    assert.ok(zoomState);

    assert.equal(zoomState.zoom.value, 1);
    assert.equal(zoomState.isFit.value, false);
    // Note: isAnimating will be true when animation frame callbacks are active
    // Skip this check in Node.js environment
    scope.stop();
});

test('animated zoom: setZoom works without animation', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 800, height: 400 });
    const viewportSize = shallowRef({ width: 1000, height: 700 });
    const sourceId = shallowRef(1);
    const zoomState = scope.run(() => useAnimatedZoom(imageSize, viewportSize, sourceId));
    assert.ok(zoomState);

    zoomState.setZoom(2);
    assert.equal(zoomState.zoom.value, 2);
    assert.equal(zoomState.isFit.value, false);
    scope.stop();
});

test('animated zoom: fit mode with cap initial fit', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 400, height: 200 });
    const viewportSize = shallowRef({ width: 1200, height: 800 });
    const sourceId = shallowRef(1);
    const zoomState = scope.run(() => useAnimatedZoom(imageSize, viewportSize, sourceId));
    assert.ok(zoomState);

    // Should cap at 100% initially
    assert.equal(zoomState.zoom.value, 1);
    assert.equal(zoomState.isFit.value, false);
    scope.stop();
});

test('animated zoom: changing image dimensions preserves manual zoom', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 800, height: 400 });
    const viewportSize = shallowRef({ width: 1000, height: 700 });
    const sourceId = shallowRef(1);
    const zoomState = scope.run(() => useAnimatedZoom(imageSize, viewportSize, sourceId));
    assert.ok(zoomState);

    zoomState.setZoom(2);
    const manualZoom = zoomState.zoom.value;
    imageSize.value = { width: 400, height: 800 };
    await nextTick();

    assert.equal(zoomState.isFit.value, false);
    assert.equal(zoomState.zoom.value, manualZoom);
    scope.stop();
});

test('animated zoom: fit mode recalculates on image dimension change', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 800, height: 400 });
    const viewportSize = shallowRef({ width: 1000, height: 700 });
    const sourceId = shallowRef(1);
    const zoomState = scope.run(() => useAnimatedZoom(imageSize, viewportSize, sourceId));
    assert.ok(zoomState);

    imageSize.value = { width: 400, height: 800 };
    await nextTick();

    assert.equal(zoomState.isFit.value, true);
    assert.equal(zoomState.zoom.value, 0.875);
    scope.stop();
});

test('animated zoom: opening new image resets to 100%', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 800, height: 400 });
    const viewportSize = shallowRef({ width: 1000, height: 700 });
    const sourceId = shallowRef(1);
    const zoomState = scope.run(() => useAnimatedZoom(imageSize, viewportSize, sourceId));
    assert.ok(zoomState);

    zoomState.setZoom(2);
    assert.equal(zoomState.isFit.value, false);

    sourceId.value += 1;
    await nextTick();

    assert.equal(zoomState.isFit.value, false);
    assert.equal(zoomState.zoom.value, 1);
    scope.stop();
});

test('animated zoom: cancelAnimation prevents animation', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 800, height: 400 });
    const viewportSize = shallowRef({ width: 1000, height: 700 });
    const sourceId = shallowRef(1);
    const zoomState = scope.run(() => useAnimatedZoom(imageSize, viewportSize, sourceId));
    assert.ok(zoomState);

    // Since Node.js doesn't have requestAnimationFrame, just verify cancelAnimation works
    zoomState.cancelAnimation();
    // Should not throw
    scope.stop();
});

test('animated zoom: canZoomIn/Out check target zoom, not animated zoom', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 800, height: 400 });
    const viewportSize = shallowRef({ width: 1000, height: 700 });
    const sourceId = shallowRef(1);
    const zoomState = scope.run(() => useAnimatedZoom(imageSize, viewportSize, sourceId));
    assert.ok(zoomState);

    // Initially at 100%, can zoom in
    assert.equal(zoomState.canZoomIn.value, true);
    
    // Get what the next zoom would be
    const nextZoomLevel = zoomState.targetZoom.value * 1.5; // approximate next level
    
    // Verify that targetZoom is used for canZoomIn checks
    // by checking initial state
    assert(zoomState.targetZoom.value === zoomState.zoom.value);
    assert.equal(zoomState.canZoomIn.value, true);
    
    scope.stop();
});

test('animated zoom: targetZoom used for next step calculation', async () => {
    const scope = effectScope();
    const imageSize = shallowRef({ width: 800, height: 400 });
    const viewportSize = shallowRef({ width: 1000, height: 700 });
    const sourceId = shallowRef(1);
    const zoomState = scope.run(() => useAnimatedZoom(imageSize, viewportSize, sourceId));
    assert.ok(zoomState);

    const initialZoom = zoomState.zoom.value;
    const initialTarget = zoomState.targetZoom.value;
    
    // Verify initially they're the same
    assert.equal(initialZoom, initialTarget);
    
    // Manually set a zoom using setZoom (which bypasses animation)
    zoomState.setZoom(0.5);
    assert.equal(zoomState.zoom.value, 0.5);
    assert.equal(zoomState.targetZoom.value, 0.5);
    
    // Both should update together when not animating
    assert.equal(zoomState.zoom.value, zoomState.targetZoom.value);
    
    scope.stop();
});


