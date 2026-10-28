import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test, { type TestContext } from 'node:test';
import { createRenderer, nextTick, type Component } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { transpileModule, ModuleKind } from 'typescript';

const source = await readFile(new URL('../../components/editor/ToolModal.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = compileScript(descriptor, { id: 'tool-modal-drag-test', inlineTemplate: true }).content;
const compiled = transpileModule(script, { compilerOptions: { module: ModuleKind.ESNext } }).outputText
    .replaceAll(/(['"])vue\1/g, JSON.stringify(import.meta.resolve('vue')))
    .replaceAll("'@/composables/useDragOffset'", JSON.stringify(new URL('../../composables/useDragOffset.ts', import.meta.url).href));
const { default: modal }: { default: Component } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

class HostElement extends EventTarget {
    tag: string;
    props: Record<string, unknown> = {};
    captures = new Set<number>();
    captureError = false;

    constructor(tag: string) {
        super();
        this.tag = tag;
    }

    showModal() {}
    close() {}
    focus() {}

    setPointerCapture(id: number) {
        if (this.captureError) throw new DOMException('Inactive pointer', 'NotFoundError');
        this.captures.add(id);
    }

    hasPointerCapture(id: number) {
        return this.captures.has(id);
    }

    releasePointerCapture(id: number) {
        this.captures.delete(id);
        this.send('lostpointercapture', { pointerId: id });
    }

    getBoundingClientRect() {
        const style = this.props.style as { transform?: string } | undefined;
        const translation = /translate\(([-.\d]+)px, ([-.\d]+)px\)/.exec(style?.transform ?? '');
        return {
            left: 200 + Number(translation?.[1] ?? 0),
            top: 150 + Number(translation?.[2] ?? 0),
            width: 420,
            height: 300,
        };
    }

    send(type: string, values: Record<string, unknown> = {}) {
        const event = new Event(type, { cancelable: true });
        for (const [key, value] of Object.entries({ button: 0, buttons: 1, pointerId: 1, clientX: 410, clientY: 167, ...values })) {
            Object.defineProperty(event, key, { value });
        }
        this.addEventListener(type, (received) => {
            const handler = this.props[`on${type[0]!.toUpperCase()}${type.slice(1)}`];
            assert.equal(typeof handler, 'function', `the real template must wire ${type}`);
            if (typeof handler === 'function') handler(received);
        }, { once: true });
        this.dispatchEvent(event);
    }
}

function setup(t: TestContext) {
    const elements: HostElement[] = [];
    const body = new HostElement('body');
    const browserWindow = Object.assign(new EventTarget(), { innerWidth: 1000, innerHeight: 800 });
    const browserDocument = Object.assign(new EventTarget(), { hidden: false, activeElement: null });
    const globals = { Element: HostElement, HTMLElement: HostElement, window: browserWindow, document: browserDocument };
    const restoreGlobals: (() => void)[] = [];
    for (const [key, value] of Object.entries(globals)) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        restoreGlobals.push(() => {
            if (previous) Object.defineProperty(globalThis, key, previous);
            else Reflect.deleteProperty(globalThis, key);
        });
    }
    const renderer = createRenderer<HostElement, HostElement>({
        createElement(tag) {
            const element = new HostElement(tag);
            elements.push(element);
            return element;
        },
        createText: () => new HostElement('#text'),
        createComment: () => new HostElement('#comment'),
        insert() {},
        remove() {},
        setText() {},
        setElementText() {},
        patchProp(element, key, _previous, next) { element.props[key] = next; },
        parentNode: () => null,
        nextSibling: () => null,
        querySelector: () => body,
    });
    const app = renderer.createApp(modal, { title: 'Levels', canApply: true, busy: false });
    app.mount(new HostElement('root'));
    t.after(() => {
        app.unmount();
        for (const restore of restoreGlobals) restore();
    });
    const dialog = elements.find(element => element.tag === 'dialog')!;
    const grip = elements.find(element => element.props.class === 'tool-modal__grip')!;
    const isDragging = () => String(dialog.props.class).includes('is-dragging');
    return { app, dialog, grip, isDragging, browserWindow, browserDocument };
}

test('a captured popup drag continues outside the window and resumes inside with the button held', async (t) => {
    const { dialog, grip, isDragging } = setup(t);
    grip.send('pointerdown');
    await nextTick();
    assert.equal(isDragging(), true);
    for (const position of [
        { clientX: 410, clientY: -100 },
        { clientX: -100, clientY: 200 },
        { clientX: 1100, clientY: 200 },
        { clientX: 410, clientY: 900 },
    ]) {
        grip.send('pointermove', position);
        await nextTick();
        assert.equal(isDragging(), true, 'leaving the viewport must not end pointer capture');
        assert.equal(grip.hasPointerCapture(1), true);
        grip.send('pointermove', { clientX: 410, clientY: 217 });
        await nextTick();
        assert.equal(dialog.getBoundingClientRect().top, 200, 'the popup must follow the held pointer on reentry');
    }
    grip.send('pointerup', { buttons: 0 });
    await nextTick();
    assert.equal(isDragging(), false);
    assert.equal(grip.hasPointerCapture(1), false);
});

test('returning after a missed mouse release ends dragging without moving the popup', async (t) => {
    const { dialog, grip, isDragging } = setup(t);
    grip.send('pointerdown');
    grip.send('pointermove', { clientY: 100 });
    await nextTick();
    const top = dialog.getBoundingClientRect().top;
    grip.send('pointermove', { clientY: 300, buttons: 0 });
    await nextTick();
    assert.equal(isDragging(), false);
    assert.equal(dialog.getBoundingClientRect().top, top);
    assert.equal(grip.hasPointerCapture(1), false);
    grip.send('pointerdown', { clientY: 100 });
    grip.send('pointermove', { clientY: 120 });
    await nextTick();
    assert.equal(dialog.getBoundingClientRect().top, top + 20, 'a new drag must work immediately');
});

for (const interruption of ['blur', 'hidden', 'pointercancel', 'lostpointercapture', 'unmount']) {
    test(`${interruption} releases popup drag state and ignores stale movement`, async (t) => {
        const { app, dialog, grip, isDragging, browserWindow, browserDocument } = setup(t);
        grip.send('pointerdown');
        grip.send('pointermove', { clientY: 100 });
        await nextTick();
        const top = dialog.getBoundingClientRect().top;
        if (interruption === 'blur') browserWindow.dispatchEvent(new Event('blur'));
        else if (interruption === 'hidden') {
            browserDocument.hidden = true;
            browserDocument.dispatchEvent(new Event('visibilitychange'));
        } else if (interruption === 'unmount') app.unmount();
        else grip.send(interruption);
        await nextTick();
        if (interruption !== 'unmount') assert.equal(isDragging(), false);
        assert.equal(grip.hasPointerCapture(1), false);
        grip.send('pointermove', { clientY: 300 });
        await nextTick();
        assert.equal(dialog.getBoundingClientRect().top, top);
    });
}

test('failed pointer capture is reported and does not start a partial drag', async (t) => {
    const { grip, isDragging } = setup(t);
    const warn = t.mock.method(console, 'warn', () => {});
    grip.captureError = true;
    grip.send('pointerdown');
    await nextTick();
    assert.equal(isDragging(), false);
    assert.equal(grip.captures.size, 0);
    assert.equal(warn.mock.callCount(), 1);
});

test('unrelated pointers cannot move or end a popup drag', async (t) => {
    const { dialog, grip, isDragging } = setup(t);
    grip.send('pointerdown');
    grip.send('pointermove', { pointerId: 2, clientY: 300 });
    grip.send('pointerup', { pointerId: 2 });
    await nextTick();
    assert.equal(dialog.getBoundingClientRect().top, 150);
    assert.equal(isDragging(), true);
    grip.send('pointerup');
});
