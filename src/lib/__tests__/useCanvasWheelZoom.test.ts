import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer, shallowRef } from 'vue';
import { useCanvasWheelZoom, type WheelZoomAnchor } from '../../composables/useCanvasWheelZoom.ts';

const renderer = createRenderer<object, object>({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
});

for (const platform of ['MacIntel', 'Win32', 'Linux x86_64']) {
    test(`canvas wheel and modal/inert routing: ${platform}`, (t) => {
        const mac = platform === 'MacIntel';
        const oppositeModifier = mac
            ? { ctrlKey: true, metaKey: false }
            : { ctrlKey: false, metaKey: true };
        class TestNode extends EventTarget {}
        class TestElement extends TestNode {
            dialog = false;
            inert = false;
            inside = false;
            scrollWidth = 600;
            scrollHeight = 600;
            clientWidth = 300;
            clientHeight = 300;
            closest(selector: string) {
                return (selector === 'dialog[open]' ? this.dialog : this.inert) ? this : null;
            }
            contains(node: TestNode) { return node === this || (node instanceof TestElement && node.inside); }
            getBoundingClientRect() { return { left: 100, right: 400, top: 100, bottom: 400, width: 300, height: 300 }; }
        }
        const browserWindow = new EventTarget();
        const globals = { navigator: { platform }, window: browserWindow, Node: TestNode, Element: TestElement };
        for (const [name, value] of Object.entries(globals)) {
            const saved = Object.getOwnPropertyDescriptor(globalThis, name);
            Object.defineProperty(globalThis, name, { configurable: true, value });
            t.after(() => {
                if (saved) Object.defineProperty(globalThis, name, saved);
                else Reflect.deleteProperty(globalThis, name);
            });
        }
        const viewport = new TestElement();
        // The composable only uses the viewport's containment and geometry APIs.
        const viewportRef = shallowRef<HTMLElement | null>(viewport as unknown as HTMLElement);
        const surfaceRef = shallowRef<HTMLElement | null>(viewport as unknown as HTMLElement);
        let hasImage = true;
        const zoomEvents: WheelEvent[] = [];
        const anchors: Array<WheelZoomAnchor | null> = [];
        // eslint-disable-next-line no-unused-vars
        let handleWheel: (event: WheelEvent) => void = () => {};
        const app = renderer.createApp({
            setup() {
                ({ handleWheel } = useCanvasWheelZoom(viewportRef, surfaceRef, () => hasImage, (event, anchor) => {
                    zoomEvents.push(event);
                    anchors.push(anchor);
                }));
                return () => null;
            },
        });
        app.mount({});
        t.after(() => app.unmount());

        function wheel(target: TestNode, modifiers: Record<string, unknown> = {}, direct = false) {
            const event = new Event('wheel', { cancelable: true });
            Object.defineProperties(event, Object.fromEntries(Object.entries({
                ctrlKey: !mac, metaKey: mac,
                deltaY: -10, clientX: 200, clientY: 200, ...modifiers,
            }).map(([key, value]) => [key, { value }])));
            if (direct) {
                Object.defineProperty(event, 'target', { value: target });
                handleWheel(event as WheelEvent);
            } else {
                // Window listeners see the original bubbling target in browsers.
                Object.defineProperty(event, 'target', { value: target });
                browserWindow.dispatchEvent(event);
            }
            return event;
        }
        assert.equal(wheel(viewport, {}, true).defaultPrevented, true);
        assert.equal(wheel(viewport, { deltaY: 10 }, true).defaultPrevented, true);
        assert.deepEqual(zoomEvents.splice(0).map((event) => event.deltaY), [-10, 10]);
        assert.deepEqual(anchors.splice(0), [
            { clientX: 200, clientY: 200, imageX: 1 / 3, imageY: 1 / 3 },
            { clientX: 200, clientY: 200, imageX: 1 / 3, imageY: 1 / 3 },
        ], 'wheel zoom retains image-relative pointer anchoring');
        viewport.scrollWidth = viewport.clientWidth;
        viewport.scrollHeight = viewport.clientHeight;
        wheel(viewport, {}, true);
        assert.equal(anchors.pop(), null, 'unscrollable images use centered zoom');
        zoomEvents.splice(0);
        assert.equal(wheel(viewport, { ctrlKey: false, metaKey: false }, true).defaultPrevented, false);
        assert.equal(wheel(viewport, { ctrlKey: true, metaKey: false, altKey: true }, true).defaultPrevented, !mac,
            'Alt+Ctrl wheel follows the platform modifier policy');
        assert.equal(wheel(viewport, oppositeModifier, true).defaultPrevented, false,
            'the other platform modifier does not zoom');
        assert.equal(wheel(viewport, { ctrlKey: true, metaKey: true }, true).defaultPrevented, false,
            'combined modifiers do not zoom');
        zoomEvents.splice(0);
        assert.equal(wheel(viewport, { deltaY: 0 }, true).defaultPrevented, true);
        assert.deepEqual(zoomEvents, []);

        const dialog = new TestElement();
        dialog.dialog = true;
        const outside = new TestElement();
        assert.equal(wheel(dialog).defaultPrevented, true);
        assert.equal(wheel(dialog, oppositeModifier).defaultPrevented, false);
        assert.equal(wheel(outside).defaultPrevented, false);
        viewport.inert = true;
        assert.equal(wheel(outside).defaultPrevented, true);
        assert.equal(wheel(outside, { clientX: 50 }).defaultPrevented, false);
        const child = new TestElement();
        child.inside = true;
        assert.equal(wheel(child).defaultPrevented, false, 'window routing must not duplicate viewport handling');
        assert.equal(zoomEvents.splice(0).length, 2);
        hasImage = false;
        assert.equal(wheel(dialog).defaultPrevented, false);
        hasImage = true;
        viewportRef.value = null;
        assert.equal(wheel(dialog).defaultPrevented, false);
        viewportRef.value = viewport as unknown as HTMLElement;
        app.unmount();
        assert.equal(wheel(dialog).defaultPrevented, false, 'unmount removes the window listener');
        assert.deepEqual(zoomEvents, []);
    });
}
