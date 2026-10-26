import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRenderer, nextTick, type Component, type ComponentPublicInstance } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { transpileModule, ModuleKind } from 'typescript';
import { largestCropInsideRotatedImage, type CropRect } from '../crop.ts';

// Exercise the overlay's real setup and watchers without requiring a browser DOM.
const source = await readFile(new URL('../../components/editor/CropOverlay.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = compileScript(descriptor, { id: 'crop-overlay-test' }).content
    .replace('__expose();', '')
    .replace('return __returned__', '__expose(__returned__); return __returned__');
const compiled = transpileModule(script, { compilerOptions: { module: ModuleKind.ESNext } }).outputText
    .replaceAll("'vue'", JSON.stringify(import.meta.resolve('vue')))
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
    onFormInput: globalThis.EventListener
}

function markManual(state: CropState) {
    const event = new Event('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: { getAttribute: () => 'Crop width' } });
    state.onFormInput(event);
}

for (const image of [{ width: 800, height: 600 }, { width: 600, height: 800 }]) {
    for (const direction of [-1, 1]) {
        test(`straighten expands an automatically constrained manual crop: ${image.width}x${image.height}, direction ${direction}`, async (t) => {
            const app = renderer.createApp({ ...overlay, render: () => null }, { image, disabled: false, panMode: false });
            const state = app.mount({}) as CropState;
            t.after(() => app.unmount());

            state.crop.width -= 20;
            markManual(state);
            await nextTick();

            state.angle = direction * 15;
            await nextTick();
            const shrunkWidth = state.crop.width;
            assert.deepEqual(state.crop, largestCropInsideRotatedImage(image, direction * 15));

            state.angle = direction * 5;
            await nextTick();
            assert.ok(state.crop.width > shrunkWidth, 'rotating back must expand the crop');
            assert.deepEqual(state.crop, largestCropInsideRotatedImage(image, direction * 5));

            state.angle = 0;
            await nextTick();
            assert.deepEqual(state.crop, { x: 0, y: 0, ...image });
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
