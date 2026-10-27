import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { type TestContext } from 'node:test';
import { effectScope, shallowRef } from 'vue';
import type { ExportMimeType } from '../imageIO.ts';

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('@/')) {
            return nextResolve(new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href, context);
        }
        if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
            return nextResolve(`${specifier}.ts`, context);
        }
        return nextResolve(specifier, context);
    },
});

const { useExportPreview } = await import('../../composables/useExportPreview.ts');
const { canvasToBlob, EXPORT_QUALITY_PRESETS } = await import('../imageIO.ts');

function setup(t: TestContext) {
    const pending: { callback: globalThis.BlobCallback; type: string; quality?: number }[] = [];
    const canvases: { width: number; height: number }[] = [];
    const backgrounds: string[] = [];
    const revoked: string[] = [];
    let urlId = 0;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            createElement() {
                const context = {
                    fillStyle: '',
                    fillRect() { backgrounds.push(this.fillStyle); },
                    drawImage() {},
                };
                const canvas = {
                    width: 0,
                    height: 0,
                    getContext: () => context,
                    toBlob(callback: globalThis.BlobCallback, type: string, quality?: number) {
                        pending.push({ callback, type, quality });
                    },
                };
                canvases.push(canvas);
                return canvas;
            },
        },
    });
    t.mock.method(URL, 'createObjectURL', () => `blob:preview-${++urlId}`);
    t.mock.method(URL, 'revokeObjectURL', (url: string) => { revoked.push(url); });
    const scope = effectScope();
    const image = shallowRef<ImageBitmap>({ width: 80, height: 40, close() {} });
    const mimeType = shallowRef<ExportMimeType>('image/jpeg');
    const quality = shallowRef<number>(0.92);
    const preview = scope.run(() => useExportPreview(() => image.value, mimeType, quality))!;
    t.after(() => {
        scope.stop();
        if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
        else Reflect.deleteProperty(globalThis, 'document');
    });
    async function finish(blob?: Blob | null) {
        const request = pending.shift();
        assert.ok(request, 'one encoding request should be pending');
        request.callback(blob === undefined ? new Blob(['encoded pixels'], { type: request.type }) : blob);
        await Promise.resolve();
        await Promise.resolve();
    }
    return { scope, image, mimeType, quality, preview, pending, canvases, backgrounds, revoked, finish };
}

test('quality presets use the intended encoder values and PNG ignores quality', async (t) => {
    const state = setup(t);
    assert.deepEqual(EXPORT_QUALITY_PRESETS.map((preset) => preset.value), [0.92, 0.8, 0.6, 0.4]);
    assert.equal(state.pending[0]?.quality, 0.92);
    await state.finish();
    state.mimeType.value = 'image/png';
    assert.equal(state.pending[0]?.quality, undefined);
    await state.finish();
    state.quality.value = 0.4;
    assert.equal(state.pending.length, 0);
    assert.equal(state.preview.calculating.value, false);
});

test('changing quality reuses the canvas and clears stale sizes and URLs immediately', async (t) => {
    const state = setup(t);
    const blob = new Blob(['exact output'], { type: 'image/jpeg' });
    await state.finish(blob);
    assert.equal(state.preview.result.value?.blob, blob);
    assert.equal(state.preview.result.value?.blob.size, 12);
    assert.deepEqual(state.backgrounds, ['#fff']);
    state.quality.value = 0.4;
    assert.equal(state.preview.result.value, null);
    assert.equal(state.preview.previewUrl.value, null);
    assert.equal(state.preview.calculating.value, true);
    assert.deepEqual(state.revoked, ['blob:preview-1']);
    assert.equal(state.canvases.length, 1);
    assert.equal(state.pending[0]?.quality, 0.4);
    await state.finish();
    state.scope.stop();
    assert.deepEqual(state.revoked, ['blob:preview-1', 'blob:preview-2']);
    assert.deepEqual([state.canvases[0]?.width, state.canvases[0]?.height], [0, 0]);
});

test('rapid changes serialize encoding, skip intermediate settings, and never publish stale results', async (t) => {
    const state = setup(t);
    state.quality.value = 0.8;
    state.quality.value = 0.6;
    state.quality.value = 0.4;
    assert.equal(state.pending.length, 1);
    await state.finish();
    assert.equal(state.preview.result.value, null);
    assert.equal(state.pending.length, 1);
    assert.equal(state.pending[0]?.quality, 0.4);
    await state.finish();
    assert.equal(state.preview.result.value?.mimeType, 'image/jpeg');
    assert.equal(state.preview.calculating.value, false);
});

test('image and format changes regenerate output and preserve alpha for PNG and WebP', async (t) => {
    const state = setup(t);
    await state.finish();
    state.mimeType.value = 'image/png';
    await state.finish();
    assert.deepEqual(state.backgrounds, ['#fff'], 'only JPEG is flattened onto white');
    state.mimeType.value = 'image/webp';
    await state.finish();
    assert.equal(state.canvases.length, 2, 'PNG and WebP share the alpha-preserving canvas');
    state.image.value = { width: 40, height: 80, close() {} };
    assert.equal(state.preview.result.value, null);
    await state.finish();
    assert.equal(state.preview.result.value?.bitmap, state.image.value);
    assert.deepEqual([state.canvases[2]?.width, state.canvases[2]?.height], [40, 80]);
});

test('encoding failures and unsupported formats are visible and recover on a new selection', async (t) => {
    const state = setup(t);
    await state.finish(null);
    assert.match(state.preview.error.value!, /could not be encoded/);
    assert.equal(state.preview.result.value, null);
    state.mimeType.value = 'image/webp';
    await state.finish(new Blob(['fallback'], { type: 'image/png' }));
    assert.match(state.preview.error.value!, /does not support/);
    state.mimeType.value = 'image/png';
    await state.finish();
    assert.equal(state.preview.error.value, null);
    assert.ok(state.preview.result.value);
});

test('closing during encoding suppresses results and releases the canvas after encoding finishes', async (t) => {
    const state = setup(t);
    state.scope.stop();
    await state.finish();
    assert.equal(state.preview.result.value, null);
    assert.equal(state.preview.previewUrl.value, null);
    assert.deepEqual([state.canvases[0]?.width, state.canvases[0]?.height], [0, 0]);
});

test('invalid quality is rejected rather than silently using the browser default', async (t) => {
    const state = setup(t);
    await state.finish();
    const canvas = document.createElement('canvas');
    for (const quality of [-1, 2, NaN, Infinity]) {
        await assert.rejects(canvasToBlob(canvas, 'image/jpeg', quality), /between 0 and 1/);
    }
    assert.equal(state.pending.length, 0);
});
