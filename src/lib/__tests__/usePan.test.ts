import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { effectScope, shallowRef } from 'vue';
import { usePan } from '../../composables/usePan.ts';

function setup(t: TestContext, reducedMotion = false) {
    const frames = new Map<number, globalThis.FrameRequestCallback>();
    const captures = new Set<number>();
    let frameId = 0;
    let now = 0;
    const browserWindow = Object.assign(new EventTarget(), {
        matchMedia: () => ({ matches: reducedMotion }),
    });
    const browserDocument = Object.assign(new EventTarget(), { hidden: false });
    const viewport: Partial<HTMLElement> = Object.assign(new EventTarget(), {
        scrollLeft: 500,
        scrollTop: 500,
        scrollWidth: 2000,
        scrollHeight: 2000,
        clientWidth: 500,
        clientHeight: 500,
        setPointerCapture: (id: number) => { captures.add(id); },
        hasPointerCapture: (id: number) => captures.has(id),
        releasePointerCapture: (id: number) => { captures.delete(id); },
    });
    const globals = {
        window: browserWindow,
        document: browserDocument,
        HTMLElement: class extends EventTarget {},
        HTMLInputElement: class extends EventTarget {},
        HTMLButtonElement: class extends EventTarget {},
        requestAnimationFrame: (callback: globalThis.FrameRequestCallback) => {
            frames.set(++frameId, callback);
            return frameId;
        },
        cancelAnimationFrame: (id: number) => { frames.delete(id); },
    };
    const restoreGlobals: (() => void)[] = [];
    for (const [key, value] of Object.entries(globals)) {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        restoreGlobals.push(() => {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        });
    }
    t.mock.method(performance, 'now', () => now);
    const enabled = shallowRef(true);
    const available = shallowRef(true);
    // Only scroll, event, and pointer-capture APIs are needed from the DOM.
    const container = shallowRef<HTMLElement | null>(viewport as HTMLElement);
    const scope = effectScope();
    const pan = scope.run(() => usePan(container, { enabled, available }))!;
    t.after(() => {
        scope.stop();
        assert.equal(frames.size, 0, 'disposing the scope cancels animation');
        assert.equal(captures.size, 0, 'disposing the scope releases pointer capture');
        for (const restore of restoreGlobals) restore();
    });

    function pointer(type: string, x: number, y: number, time: number, pointerId = 1) {
        now = time;
        const event = new Event(type, { cancelable: true });
        Object.defineProperties(event, {
            clientX: { value: x },
            clientY: { value: y },
            timeStamp: { value: time },
            pointerId: { value: pointerId },
            button: { value: 0 },
        });
        viewport.dispatchEvent!(event);
    }

    function step(milliseconds = 16) {
        now += milliseconds;
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback(now);
    }

    function throwPreview() {
        pointer('pointerdown', 200, 200, 0);
        pointer('pointermove', 180, 190, 20);
        pointer('pointermove', 160, 180, 40);
        pointer('pointerup', 160, 180, 40);
    }

    function key(type: string, code = 'Space', repeat = false) {
        const event = new Event(type, { cancelable: true });
        Object.defineProperties(event, {
            code: { value: code },
            key: { value: code === 'Space' ? ' ' : code },
            repeat: { value: repeat },
        });
        browserWindow.dispatchEvent(event);
        return event;
    }

    return {
        viewport, pointer, key, step, frames, captures, pan, throwPreview,
        browserWindow, browserDocument, enabled, available, scope,
    };
}

for (const releaseSpaceFirst of [false, true]) {
    test(`Space panning retains momentum with Space released ${releaseSpaceFirst ? 'before' : 'after'} the mouse`, (t) => {
        const { enabled, key, pointer, step, viewport, pan, frames } = setup(t);
        enabled.value = false;
        key('keydown');
        assert.equal(pan.isPanMode.value, true);
        pointer('pointerdown', 200, 200, 0);
        pointer('pointermove', 180, 190, 20);
        pointer('pointermove', 160, 180, 40);
        if (releaseSpaceFirst) key('keyup');
        pointer('pointerup', 160, 180, 40);
        const releasedX = viewport.scrollLeft!;
        if (!releaseSpaceFirst) {
            for (let i = 0; i < 5; i++) {
                assert.equal(key('keydown', 'Space', true).defaultPrevented, true);
                step();
            }
            key('keyup');
        }
        step();
        assert.ok(viewport.scrollLeft! > releasedX, 'the shared momentum animation must continue');
        assert.equal(pan.isPanMode.value, false);
        assert.equal(pan.isDragging.value, false);
        assert.equal(frames.size, 1);
        key('keydown');
        assert.equal(frames.size, 0, 'a fresh Space press still interrupts the throw');
    });
}

test('release continues in the drag direction, decelerates, and stops', (t) => {
    const { viewport, pan, throwPreview, step, frames } = setup(t);
    throwPreview();
    assert.equal(pan.isDragging.value, false);
    assert.equal(viewport.scrollLeft, 540);
    assert.equal(viewport.scrollTop, 520);
    step();
    const firstX = viewport.scrollLeft!;
    const firstDistance = firstX - 540;
    assert.ok(firstDistance > 0);
    assert.ok(viewport.scrollTop! > 520);
    step();
    assert.ok(viewport.scrollLeft! - firstX < firstDistance);
    for (let i = 0; i < 200 && frames.size; i++) step();
    assert.equal(frames.size, 0);
    assert.ok(viewport.scrollLeft! > 770 && viewport.scrollLeft! < 780);
});

test('momentum distance is independent of animation frame rate', (t) => {
    const { viewport, throwPreview, step } = setup(t);
    throwPreview();
    for (let i = 0; i < 10; i++) step(16);
    const at60Hz = viewport.scrollLeft!;
    viewport.scrollLeft = 500;
    viewport.scrollTop = 500;
    throwPreview();
    for (let i = 0; i < 20; i++) step(8);
    assert.ok(Math.abs(viewport.scrollLeft! - at60Hz) < 0.001);
});

test('stationary clicks and pausing before release do not throw', (t) => {
    const { pointer, frames } = setup(t);
    pointer('pointerdown', 200, 200, 0);
    pointer('pointerup', 200, 200, 20);
    assert.equal(frames.size, 0);
    pointer('pointerdown', 200, 200, 100);
    pointer('pointermove', 160, 180, 120);
    pointer('pointerup', 160, 180, 240);
    assert.equal(frames.size, 0);
});

test('recent movement determines the throw direction after reversing', (t) => {
    const { pointer, viewport, step } = setup(t);
    pointer('pointerdown', 200, 200, 0);
    pointer('pointermove', 100, 200, 100);
    pointer('pointermove', 120, 200, 200);
    pointer('pointermove', 160, 200, 240);
    pointer('pointerup', 160, 200, 240);
    const releasedX = viewport.scrollLeft!;
    step();
    assert.ok(viewport.scrollLeft! < releasedX);
});

test('pointer cancellation and lost capture never start momentum', (t) => {
    const { pointer, pan, frames, captures } = setup(t);
    for (const event of ['pointercancel', 'lostpointercapture']) {
        pointer('pointerdown', 200, 200, 0);
        pointer('pointermove', 160, 180, 20);
        pointer(event, 160, 180, 20);
        assert.equal(frames.size, 0);
        assert.equal(captures.size, 0);
        assert.equal(pan.isDragging.value, false);
    }
});

test('reduced motion disables momentum but preserves drag panning', (t) => {
    const { throwPreview, viewport, frames } = setup(t, true);
    throwPreview();
    assert.equal(viewport.scrollLeft, 540);
    assert.equal(frames.size, 0);
});

test('hitting one boundary preserves momentum on the other axis', (t) => {
    const { throwPreview, viewport, frames, step } = setup(t);
    throwPreview();
    viewport.scrollLeft = 1499;
    step();
    assert.equal(viewport.scrollLeft, 1500);
    assert.ok(viewport.scrollTop! > 520);
    assert.equal(frames.size, 1);
    viewport.scrollTop = 1499;
    step();
    assert.equal(viewport.scrollTop, 1500);
    assert.equal(frames.size, 0);
});

test('negative throws stop at the upper and left boundaries', (t) => {
    const { pointer, viewport, frames, step } = setup(t);
    pointer('pointerdown', 100, 100, 0);
    pointer('pointermove', 140, 140, 20);
    pointer('pointerup', 140, 140, 20);
    viewport.scrollLeft = 1;
    viewport.scrollTop = 1;
    step();
    assert.equal(viewport.scrollLeft, 0);
    assert.equal(viewport.scrollTop, 0);
    assert.equal(frames.size, 0);
});

test('very fast flicks have a bounded launch speed', (t) => {
    const { pointer, viewport, step } = setup(t);
    pointer('pointerdown', 200, 200, 0);
    pointer('pointermove', 100, 100, 1);
    pointer('pointerup', 100, 100, 1);
    const released = { x: viewport.scrollLeft!, y: viewport.scrollTop! };
    step();
    const distance = Math.hypot(viewport.scrollLeft! - released.x, viewport.scrollTop! - released.y);
    assert.ok(distance > 40 && distance <= 3 * 16);
});

test('a new drag interrupts momentum and starts from the current position', (t) => {
    const { throwPreview, pointer, viewport, step, frames, pan } = setup(t);
    throwPreview();
    step();
    const x = viewport.scrollLeft!;
    pointer('pointerdown', 200, 200, 60);
    assert.equal(frames.size, 0);
    assert.equal(pan.isDragging.value, true);
    pointer('pointermove', 210, 200, 80);
    assert.equal(viewport.scrollLeft, x - 10);
});

test('external pointer, wheel, keyboard, and focus interactions stop momentum', (t) => {
    const { throwPreview, browserWindow, frames } = setup(t);
    for (const type of ['pointerdown', 'wheel', 'keydown', 'blur']) {
        throwPreview();
        assert.equal(frames.size, 1);
        browserWindow.dispatchEvent(new Event(type));
        assert.equal(frames.size, 0, type);
    }
});

test('unavailable images, tool changes, explicit stops, and hidden pages cancel momentum', (t) => {
    const { throwPreview, enabled, available, frames, pan, browserDocument } = setup(t);
    throwPreview();
    available.value = false;
    assert.equal(frames.size, 0);
    available.value = true;
    throwPreview();
    enabled.value = false;
    assert.equal(frames.size, 0);
    enabled.value = true;
    throwPreview();
    pan.stopMomentum();
    assert.equal(frames.size, 0);
    throwPreview();
    browserDocument.hidden = true;
    browserDocument.dispatchEvent(new Event('visibilitychange'));
    assert.equal(frames.size, 0);
});

test('losing focus during a drag releases capture and prevents a later throw', (t) => {
    const { pointer, browserWindow, pan, captures, frames } = setup(t);
    pointer('pointerdown', 200, 200, 0);
    pointer('pointermove', 160, 180, 20);
    browserWindow.dispatchEvent(new Event('blur'));
    assert.equal(captures.size, 0);
    assert.equal(pan.isDragging.value, false);
    pointer('pointerup', 160, 180, 30);
    assert.equal(frames.size, 0);
});
