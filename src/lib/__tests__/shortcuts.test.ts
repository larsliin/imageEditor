import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test, { type TestContext } from 'node:test';
import { parse } from 'vue/compiler-sfc';
import { createSourceFile, isFunctionDeclaration, ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { hasShortcutModifier, isZoomWheel, shortcutModifierLabel } from '../shortcuts.ts';

function setPlatform(t: TestContext, platform: string) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { platform } });
    t.after(() => {
        if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
        else Reflect.deleteProperty(globalThis, 'navigator');
    });
}

for (const platform of ['MacIntel', 'Win32', 'Linux x86_64']) {
    test(`modifier policy: ${platform}`, (t) => {
        setPlatform(t, platform);
        const mac = platform === 'MacIntel';
        assert.equal(shortcutModifierLabel(), mac ? '⌘' : 'Ctrl');
        for (const ctrlKey of [false, true]) {
            for (const metaKey of [false, true]) {
                const modifiers = { ctrlKey, metaKey };
                assert.equal(hasShortcutModifier(modifiers), mac ? metaKey && !ctrlKey : ctrlKey && !metaKey);
                assert.equal(isZoomWheel(modifiers), mac ? metaKey && !ctrlKey : ctrlKey && !metaKey);
            }
        }
    });
}

// Execute the actual App handler with only its state/action and DOM boundaries supplied.
const source = await readFile(new URL('../../App.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = createSourceFile('App.ts', descriptor.scriptSetup?.content ?? '', ScriptTarget.Latest, true);
const handler = script.statements.find((statement) =>
    isFunctionDeclaration(statement) && statement.name?.text === 'handleEditorShortcut',
);
assert.ok(handler);
const compiled = transpileModule(`
    import { hasShortcutModifier } from ${JSON.stringify(new URL('../shortcuts.ts', import.meta.url).href)};
    export function createHandler(state) {
        const { canZoomIn, canZoomOut, popupOpen, canUndoEdit, zoomIn, zoomOut, undoEdit, redoEdit } = state;
        ${handler.getText(script)}
        return handleEditorShortcut;
    }
`, { compilerOptions: { module: ModuleKind.ESNext } }).outputText;

interface ShortcutState {
    canZoomIn: { value: boolean }
    canZoomOut: { value: boolean }
    popupOpen: { value: boolean }
    canUndoEdit: { value: boolean }
    zoomIn: () => void
    zoomOut: () => void
    undoEdit: () => void
    redoEdit: () => void
}

const { createHandler }: {
    // eslint-disable-next-line no-unused-vars
    createHandler: (state: ShortcutState) => (event: KeyboardEvent) => void
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

for (const platform of ['MacIntel', 'Win32', 'Linux x86_64']) {
    test(`App shortcuts preserve guards and actions: ${platform}`, (t) => {
        setPlatform(t, platform);
        class Element extends EventTarget { isContentEditable = false; }
        class Input extends Element {}
        class Textarea extends Element {}
        class Select extends Element {}
        const classes = { HTMLElement: Element, HTMLInputElement: Input, HTMLTextAreaElement: Textarea, HTMLSelectElement: Select };
        for (const [key, value] of Object.entries(classes)) {
            const saved = Object.getOwnPropertyDescriptor(globalThis, key);
            Object.defineProperty(globalThis, key, { configurable: true, value });
            t.after(() => {
                if (saved) Object.defineProperty(globalThis, key, saved);
                else Reflect.deleteProperty(globalThis, key);
            });
        }
        const actions: string[] = [];
        const state: ShortcutState = {
            canZoomIn: { value: true }, canZoomOut: { value: true },
            popupOpen: { value: false }, canUndoEdit: { value: true },
            zoomIn: () => { actions.push('in'); }, zoomOut: () => { actions.push('out'); },
            undoEdit: () => { actions.push('undo'); }, redoEdit: () => { actions.push('redo'); },
        };
        const handle = createHandler(state);
        const mac = platform === 'MacIntel';
        function key(key: string, overrides: Record<string, unknown> = {}) {
            const event = new Event('keydown', { cancelable: true });
            Object.defineProperties(event, Object.fromEntries(Object.entries({
                key, ctrlKey: !mac, metaKey: mac, altKey: false, shiftKey: false, ...overrides,
            }).map(([name, value]) => [name, { value }])));
            handle(event as KeyboardEvent);
            return event;
        }
        for (const name of ['+', '=', '-', 'z', 'Z', 'y']) assert.equal(key(name).defaultPrevented, true);
        key('z', { shiftKey: true });
        assert.deepEqual(actions.splice(0), ['in', 'in', 'out', 'undo', 'undo', 'redo', 'redo']);
        for (const overrides of [
            { ctrlKey: false, metaKey: false }, { ctrlKey: mac, metaKey: !mac },
            { ctrlKey: true, metaKey: true }, { altKey: true },
        ]) assert.equal(key('+', overrides).defaultPrevented, false);
        const editable = new Element();
        editable.isContentEditable = true;
        for (const target of [new Input(), new Textarea(), new Select(), editable]) {
            for (const name of ['+', '-', 'z', 'y']) assert.equal(key(name, { target }).defaultPrevented, false);
        }
        assert.equal(key('q').defaultPrevented, false);
        assert.deepEqual(actions, []);

        state.popupOpen.value = true;
        for (const name of ['z', 'y']) assert.equal(key(name).defaultPrevented, true);
        key('z', { shiftKey: true });
        key('+');
        key('-');
        assert.deepEqual(actions.splice(0), ['in', 'out'], 'popups block history but not zoom');
        state.canZoomIn.value = false;
        state.canZoomOut.value = false;
        assert.equal(key('+').defaultPrevented, true);
        assert.equal(key('-').defaultPrevented, true);
        state.popupOpen.value = false;
        state.canUndoEdit.value = false;
        key('z');
        assert.deepEqual(actions, [], 'zoom limits and undo availability still guard actions');
    });
}
