import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { type TestContext } from 'node:test';
import { effectScope } from 'vue';
import { defaultCurves } from '../curves.ts';

// Resolve the app's Vite aliases and extensionless imports for Node's TS runner.
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

const { useImageDocument } = await import('../../composables/useImageDocument.ts');

class TestBitmap {
    closes = 0;
    width: number;
    height: number;
    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }
    close() {
        this.closes += 1;
        assert.equal(this.closes, 1, 'each bitmap must be closed exactly once');
    }
}

function setup(t: TestContext) {
    const bitmaps: TestBitmap[] = [];
    const files = [{ name: 'landscape.png', type: 'image/png', width: 80, height: 40 }];
    const context = {
        drawImage() {},
        translate() {},
        rotate() {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData() {},
    };
    const browserWindow = Object.assign(new EventTarget(), { confirm: () => true });
    const browserDocument = {
        createElement(tag: string) {
            if (tag === 'input') {
                return Object.assign(new EventTarget(), {
                    files,
                    click() { this.dispatchEvent(new Event('change')); },
                });
            }
            if (tag === 'a') return { click() {} };
            assert.equal(tag, 'canvas');
            return {
                width: 0,
                height: 0,
                getContext: () => context,
                toBlob: (callback: globalThis.BlobCallback) => callback(new Blob(['image'])),
            };
        },
    };
    let failProcessing = false;
    const globals = {
        window: browserWindow,
        document: browserDocument,
        createImageBitmap: async (source: { width: number; height: number }, ...crop: number[]) => {
            if (failProcessing) throw new Error('Test processing failure');
            const bitmap = new TestBitmap(crop[2] ?? source.width, crop[3] ?? source.height);
            bitmaps.push(bitmap);
            return bitmap;
        },
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
    const scope = effectScope();
    const editor = scope.run(useImageDocument)!;
    t.after(() => {
        try {
            scope.stop();
            for (const bitmap of bitmaps) assert.equal(bitmap.closes, 1);
        } finally {
            for (const restore of restoreGlobals) restore();
        }
    });
    return {
        editor, scope, bitmaps, files,
        fail: () => { failProcessing = true; },
    };
}

test('only the last three edits can be undone and all three can be redone', async (t) => {
    const { editor, bitmaps } = setup(t);
    assert.equal(editor.canUndo.value, false);
    assert.equal(editor.canRedo.value, false);
    await editor.importImage();
    for (const width of [70, 60, 50, 40, 30]) {
        assert.equal(await editor.resizeImage({ width, height: 20 }), true);
    }
    assert.equal(bitmaps[1]!.closes, 1);
    assert.equal(bitmaps[0]!.closes, 0, 'the original stays available for reset');
    for (const width of [40, 50, 60]) {
        editor.undo();
        assert.equal(editor.bitmap.value?.width, width);
    }
    assert.equal(editor.canUndo.value, false);
    editor.undo();
    assert.equal(editor.bitmap.value?.width, 60);
    for (const width of [50, 40, 30]) {
        editor.redo();
        assert.equal(editor.bitmap.value?.width, width);
    }
    assert.equal(editor.canRedo.value, false);
});

test('a new edit clears redo and releases abandoned bitmaps, but not shared ones', async (t) => {
    const { editor, bitmaps } = setup(t);
    await editor.importImage();
    await editor.resizeImage({ width: 60, height: 30 });
    await editor.resizeImage({ width: 40, height: 20 });
    editor.undo();
    editor.renameImage('renamed');
    assert.equal(editor.canRedo.value, false);
    assert.equal(bitmaps[2]!.closes, 1);
    assert.equal(bitmaps[1]!.closes, 0);
    editor.undo();
    assert.equal(editor.info.value?.fileName, 'landscape.png');
    editor.redo();
    assert.equal(editor.info.value?.fileName, 'renamed.png');
});

test('no-op and failed edits preserve history; undo and redo are blocked while processing', async (t) => {
    const { editor, fail } = setup(t);
    await editor.importImage();
    await editor.resizeImage({ width: 60, height: 30 });
    editor.undo();
    await editor.resizeImage({ width: 80, height: 40 });
    await editor.cropImage({ x: 0, y: 0, width: 80, height: 40 });
    editor.renameImage('landscape');
    editor.setExportMimeType('image/png');
    assert.equal(editor.canRedo.value, true);
    await editor.resizeImage({ width: 0, height: 0 });
    assert.equal(editor.canRedo.value, true);
    fail();
    const pending = editor.rotateImage();
    assert.equal(editor.canUndo.value, false);
    assert.equal(editor.canRedo.value, false);
    editor.redo();
    assert.equal(editor.bitmap.value?.width, 80);
    assert.equal(await pending, false);
    assert.equal(editor.canRedo.value, true);
    assert.equal(editor.error.value, 'Test processing failure');
    editor.redo();
    assert.equal(editor.bitmap.value?.width, 60);
    assert.equal(editor.error.value, null);
});

test('crop, rotation, levels, curves and color-mode edits restore exact bitmap references', async (t) => {
    const { editor } = setup(t);
    await editor.importImage();
    const applyAndRestore = async (apply: () => Promise<boolean>) => {
        const before = editor.bitmap.value;
        assert.equal(await apply(), true);
        const after = editor.bitmap.value;
        assert.notEqual(after, before);
        editor.undo();
        assert.equal(editor.bitmap.value, before);
        editor.redo();
        assert.equal(editor.bitmap.value, after);
    };
    await applyAndRestore(() => editor.cropImage({ x: 1, y: 1, width: 60, height: 30 }));
    await applyAndRestore(() => editor.rotateImage());
    assert.deepEqual([editor.bitmap.value?.width, editor.bitmap.value?.height], [30, 60]);
    await applyAndRestore(() => editor.levelsImage({ black: 10, white: 240, gamma: 1 }));
    await applyAndRestore(() => editor.curvesImage({
        ...defaultCurves(),
        rgb: [{ x: 0, y: 0 }, { x: 128, y: 160 }, { x: 255, y: 255 }],
    }));
    await applyAndRestore(() => editor.colorModeImage('bitmap'));
    assert.equal(editor.info.value?.exportMimeType, 'image/bmp');
    editor.undo();
    assert.equal(editor.info.value?.exportMimeType, 'image/png');
    assert.equal(editor.info.value?.fileName, 'landscape.png');
});

test('reset is undoable and format and filename follow history', async (t) => {
    const { editor } = setup(t);
    await editor.importImage();
    const original = editor.bitmap.value;
    await editor.resizeImage({ width: 30, height: 60 });
    const resized = editor.bitmap.value;
    editor.setExportMimeType('image/jpeg');
    editor.renameImage('portrait');
    editor.resetImage();
    assert.equal(editor.bitmap.value, original);
    assert.equal(editor.info.value?.fileName, 'portrait.jpg');
    editor.undo();
    assert.equal(editor.bitmap.value, resized);
    editor.undo();
    assert.equal(editor.info.value?.fileName, 'landscape.jpg');
    editor.undo();
    assert.equal(editor.info.value?.exportMimeType, 'image/png');
});

test('import clears history and releases old resources; disposal closes an in-flight result', async (t) => {
    const { editor, scope, bitmaps, files } = setup(t);
    await editor.importImage();
    await editor.rotateImage();
    editor.undo();
    files[0] = { name: 'portrait.png', type: 'image/png', width: 40, height: 80 };
    await editor.importImage();
    assert.equal(editor.canUndo.value, false);
    assert.equal(editor.canRedo.value, false);
    assert.equal(editor.isDirty.value, false);
    assert.equal(bitmaps[0]!.closes, 1);
    assert.equal(bitmaps[1]!.closes, 1);
    const pending = editor.rotateImage();
    scope.stop();
    assert.equal(await pending, false);
});

test('undoing to an exported state is clean and redo restores its saved revision', async (t) => {
    const { editor } = setup(t);
    await editor.importImage();
    await editor.rotateImage();
    await editor.exportImage();
    assert.equal(editor.isDirty.value, false);
    await editor.resizeImage({ width: 10, height: 20 });
    assert.equal(editor.isDirty.value, true);
    editor.undo();
    assert.equal(editor.isDirty.value, false);
    editor.undo();
    assert.equal(editor.isDirty.value, true);
    editor.redo();
    assert.equal(editor.isDirty.value, false);
});
