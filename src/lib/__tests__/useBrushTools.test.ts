import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { type TestContext } from 'node:test';
import { effectScope, nextTick, shallowRef } from 'vue';
import type { ToolId } from '../../types/editor.ts';
import type { BrushStroke } from '../brush.ts';

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('@/')) return nextResolve(new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href, context);
        return nextResolve(specifier, context);
    },
});
const { useBrushTools } = await import('../../composables/useBrushTools.ts');

function setup(t: TestContext) {
    const saved = new Map<string, string>();
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) },
    });
    const activeTool = shallowRef<ToolId | null>('brush');
    const bitmap = shallowRef<ImageBitmap | null>(null);
    const isBusy = shallowRef(false);
    const scope = effectScope();
    let success = true;
    const applied: (readonly BrushStroke[])[] = [];
    const brush = scope.run(() => useBrushTools({ activeTool, bitmap, isBusy,
        brushImage: async strokes => { applied.push(strokes); return success; },
    }))!;
    t.after(() => {
        scope.stop();
        if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    });
    return { brush, activeTool, isBusy, saved, applied, fail: () => { success = false; } };
}

const stroke: BrushStroke = { thickness: 20, color: '#000000', points: [{ x: 10, y: 20 }] };

test('persisted brush preferences are not document edits and survive discarding strokes', async t => {
    const { brush, activeTool, saved } = setup(t);
    const preferences = { thickness: 35, color: '#ffffff' };
    brush.updateSettings(preferences);
    assert.equal(brush.dirty.value, false);
    brush.addStroke(stroke);
    assert.equal(brush.dirty.value, true);
    activeTool.value = 'curves';
    await nextTick();
    assert.equal(brush.dirty.value, false);
    assert.deepEqual(brush.strokes.value, []);
    assert.deepEqual(brush.settings.value, preferences);
    assert.equal(saved.get('image-editor-brush'), JSON.stringify(preferences));
});

test('an in-progress stroke is dirty and cannot be applied until finished', async t => {
    const { brush, applied } = setup(t);
    brush.setDrawing(true);
    assert.equal(brush.dirty.value, true);
    assert.equal(await brush.apply(), false);
    assert.equal(applied.length, 0);
    brush.setDrawing(false);
    assert.equal(brush.dirty.value, false);
});

test('undoing every pending stroke returns to the empty opening baseline', t => {
    const { brush } = setup(t);
    brush.addStroke(stroke);
    brush.addStroke(stroke);
    brush.undoStroke();
    assert.equal(brush.dirty.value, true);
    brush.undoStroke();
    assert.equal(brush.dirty.value, false);
});

test('Apply failures preserve strokes; successful result leaves closing to the guard', async t => {
    const { brush, activeTool, isBusy, applied, fail } = setup(t);
    brush.addStroke(stroke);
    isBusy.value = true;
    assert.equal(await brush.apply(), false);
    assert.equal(applied.length, 0);
    isBusy.value = false;
    assert.equal(await brush.apply(), true);
    assert.equal(activeTool.value, 'brush');
    fail();
    assert.equal(await brush.apply(), false);
    assert.equal(brush.strokes.value.length, 1);
    assert.equal(brush.dirty.value, true);
});
