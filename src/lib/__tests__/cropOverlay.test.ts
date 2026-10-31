import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRenderer, nextTick, type Component, type ComponentPublicInstance } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { transpileModule, ModuleKind } from 'typescript';
import { isCropInsideRotatedImage, isValidCrop, type CropRect } from '../crop.ts';

// Exercise the overlay's real setup and watchers without requiring a browser DOM.
const source = await readFile(new URL('../../components/editor/canvas/CropOverlay.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = compileScript(descriptor, { id: 'crop-overlay-test' }).content
    .replace("import CropControls from '../controls/CropControls.vue';", 'const CropControls = {};')
    .replace('__expose();', '')
    .replace('return __returned__', '__expose(__returned__); return __returned__');
const compiled = transpileModule(script, { compilerOptions: { module: ModuleKind.ESNext } }).outputText
    .replaceAll("'vue'", JSON.stringify(import.meta.resolve('vue')))
    .replaceAll("'@/composables/useToolDraft'", JSON.stringify(new URL('../../composables/useToolDraft.ts', import.meta.url).href))
    .replaceAll("'@/lib/crop'", JSON.stringify(new URL('../crop.ts', import.meta.url).href));
const { default: overlay }: { default: Component } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const renderer = createRenderer<object, object>({
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    insert() {},
    remove() {},
    setText() {},
    setElementText() {},
    patchProp() {},
    parentNode: () => null,
    nextSibling: () => null,
});

interface CropState extends ComponentPublicInstance {
    crop: CropRect
    angle: number
    snapToPixel: boolean
    onFormInput: globalThis.EventListener
    // eslint-disable-next-line no-unused-vars
    resizeWithKeyboard(event: KeyboardEvent, handle: 'e'): void
}

function markManual(state: CropState) {
    const event = new Event('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: { getAttribute: () => 'Crop width' } });
    state.onFormInput(event);
}

test('enabling pixel snapping immediately rounds existing fractional crop edges', async (t) => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const saved = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) },
    });
    t.after(() => {
        if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    });
    for (const image of [{ width: 800, height: 600 }, { width: 600, height: 800 }]) {
        saved.clear();
        const app = renderer.createApp({ ...overlay, render: () => null }, { image, disabled: false, panMode: false });
        const state = app.mount({}) as CropState;
        try {
            assert.equal(state.snapToPixel, false);
            state.crop = { x: 10.4, y: 20.6, width: 20.2, height: 21.2 };
            markManual(state);
            await nextTick();

            state.snapToPixel = true;
            await nextTick();
            assert.deepEqual(state.crop, { x: 10, y: 21, width: 21, height: 21 });
            assert.equal(saved.get('image-editor-crop-snap-to-pixel'), 'true');

            const arrow = new Event('keydown');
            Object.defineProperties(arrow, { key: { value: 'ArrowRight' }, shiftKey: { value: false } });
            state.resizeWithKeyboard(arrow as KeyboardEvent, 'e');
            await nextTick();
            assert.deepEqual(state.crop, { x: 10, y: 21, width: 22, height: 21 });

            state.snapToPixel = false;
            await nextTick();
            state.crop = { x: 10.4, y: 20.6, width: 20.2, height: 21.2 };
            await nextTick();
            assert.equal(state.crop.x, 10.4, 'unsnapped selections retain fractional coordinates');

            state.crop = { x: image.width - 1.4, y: image.height - 1.4, width: 1.3, height: 1.3 };
            await nextTick();
            state.snapToPixel = true;
            await nextTick();
            assert.deepEqual(state.crop, { x: image.width - 1, y: image.height - 1, width: 1, height: 1 });
        } finally {
            app.unmount();
        }
    }
});

for (const image of [{ width: 800, height: 600 }, { width: 600, height: 800 }]) {
    for (const direction of [-1, 1]) {
        test(`straighten constrains and restores the manual crop: ${image.width}x${image.height}, direction ${direction}`, async (t) => {
            const app = renderer.createApp({ ...overlay, render: () => null }, { image, disabled: false, panMode: false });
            const state = app.mount({}) as CropState;
            t.after(() => app.unmount());

            state.crop.width -= 20;
            markManual(state);
            await nextTick();
            const manualCrop = { ...state.crop };

            state.angle = direction * 15;
            await nextTick();
            const shrunkWidth = state.crop.width;
            assert.ok(state.crop.width <= manualCrop.width);
            assert.ok(state.crop.height <= manualCrop.height);
            assert.equal(isValidCrop(state.crop, image), true);
            assert.equal(isCropInsideRotatedImage(state.crop, image, direction * 15), true);

            state.angle = direction * 5;
            await nextTick();
            assert.ok(state.crop.width > shrunkWidth, 'rotating back must expand the crop');
            assert.ok(state.crop.width <= manualCrop.width);
            assert.ok(state.crop.height <= manualCrop.height);
            assert.equal(isCropInsideRotatedImage(state.crop, image, direction * 5), true);

            state.angle = 0;
            await nextTick();
            assert.deepEqual(state.crop, manualCrop);
        });
    }
}

test('straighten preserves a manual crop that still fits inside the rotated image', async (t) => {
    const image = { width: 800, height: 600 };
    const app = renderer.createApp({ ...overlay, render: () => null }, { image, disabled: false, panMode: false });
    const state = app.mount({}) as CropState;
    t.after(() => app.unmount());
    const manualCrop = { x: 300, y: 200, width: 200, height: 200 };
    state.crop = { ...manualCrop };
    markManual(state);
    await nextTick();

    for (const angle of [15, 5, -5, 0]) {
        state.angle = angle;
        await nextTick();
        assert.deepEqual(state.crop, manualCrop);
    }
});

test('editing a constrained crop replaces the remembered manual selection', async (t) => {
    const image = { width: 800, height: 600 };
    const app = renderer.createApp({ ...overlay, render: () => null }, { image, disabled: false, panMode: false });
    const state = app.mount({}) as CropState;
    t.after(() => app.unmount());
    state.crop = { x: 0, y: 0, width: 200, height: 100 };
    markManual(state);
    state.angle = 15;
    await nextTick();

    const editedCrop = { x: 300, y: 200, width: 100, height: 80 };
    state.crop = { ...editedCrop };
    markManual(state);
    await nextTick();
    state.angle = 0;
    await nextTick();
    assert.deepEqual(state.crop, editedCrop);
});
