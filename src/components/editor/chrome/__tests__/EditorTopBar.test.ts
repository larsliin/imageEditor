import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test, { type TestContext } from 'node:test';
import { createRenderer, markRaw, type Component } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { transpileModule, ModuleKind } from 'typescript';
import type { ImageInfo } from '@/types/editor';
import { baseControlUrl } from '../../../bascomponents/__tests__/loadBaseControl.ts';

// This parameter is part of the callback type and is intentionally not referenced here.
// eslint-disable-next-line no-unused-vars
type TestEventListener = (event: Event) => void;

class TestDocument {
    activeElement: TestElement | null = null;
}
Object.defineProperty(globalThis, 'Document', {
    configurable: true,
    value: TestDocument,
});

class TestElement {
    readonly props: Record<string, unknown> = {};
    readonly children: TestElement[] = [];
    readonly selectionRanges: Array<[number, number]> = [];
    readonly validityMessages: string[] = [];
    readonly eventListeners = new Map<string, TestEventListener[]>();
    parent: TestElement | null = null;
    text = '';
    value = '';
    focusCount = 0;
    validityReportCount = 0;
    validityResult = true;
    readonly type: string;

    constructor(type: string) {
        this.type = type;
    }

    getRootNode() {
        return new TestDocument();
    }

    addEventListener(type: string, listener: TestEventListener) {
        const listeners = this.eventListeners.get(type) ?? [];
        listeners.push(listener);
        this.eventListeners.set(type, listeners);
    }

    focus() {
        this.focusCount += 1;
    }

    setSelectionRange(start: number, end: number) {
        this.selectionRanges.push([start, end]);
    }

    setCustomValidity(message: string) {
        this.validityMessages.push(message);
    }

    reportValidity() {
        this.validityReportCount += 1;
        return this.validityResult;
    }
}

class TestSelectElement extends TestElement {}
Object.defineProperty(globalThis, 'HTMLSelectElement', {
    configurable: true,
    value: TestSelectElement,
});

const source = await readFile(new URL('../EditorTopBar.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = compileScript(descriptor, { id: 'editor-top-bar-test', inlineTemplate: true }).content;
const compiled = transpileModule(script, { compilerOptions: { module: ModuleKind.ESNext } }).outputText
    .replaceAll("'@/components/bascomponents/BaseButton.vue'", JSON.stringify(await baseControlUrl('BaseButton')))
    .replaceAll("'vue'", JSON.stringify(import.meta.resolve('vue')))
    .replaceAll('"vue"', JSON.stringify(import.meta.resolve('vue')));
const { default: editorTopBar }: { default: Component } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`,
);
const renderer = createRenderer<TestElement, TestElement>({
    createElement: (type) => markRaw(type === 'select' ? new TestSelectElement(type) : new TestElement(type)),
    createText: (text) => {
        const element = new TestElement('#text');
        element.text = text;
        return markRaw(element);
    },
    createComment: (text) => {
        const element = new TestElement('#comment');
        element.text = text;
        return markRaw(element);
    },
    insert(child, parent, anchor) {
        child.parent?.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = parent;
        const anchorIndex = anchor ? parent.children.indexOf(anchor) : -1;
        if (anchorIndex < 0) parent.children.push(child);
        else parent.children.splice(anchorIndex, 0, child);
    },
    remove(child) {
        if (!child.parent) return;
        child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = null;
    },
    setText(node, text) {
        node.text = text;
    },
    setElementText(node, text) {
        node.text = text;
        node.children.splice(0);
    },
    patchProp(node, key, _previous, next) {
        node.props[key] = next;
        if (key === 'value') node.value = String(next ?? '');
    },
    parentNode: (node) => node.parent,
    nextSibling: (node) => {
        const siblings = node.parent?.children;
        return siblings ? siblings[siblings.indexOf(node) + 1] ?? null : null;
    },
});

interface EmittedEvent {
    name: string
    value?: string
}

function mountTopBar(
    context: TestContext,
    image: ImageInfo | null,
    busy = false,
    rulersEnabled = false,
) {
    const emitted: EmittedEvent[] = [];
    const app = renderer.createApp(
        editorTopBar,
        {
            image,
            busy,
            isDarkMode: false,
            rulersEnabled,
            onRename: (value: string) => emitted.push({ name: 'rename', value }),
            onToggleTheme: () => emitted.push({ name: 'toggle-theme' }),
            onToggleRulers: () => emitted.push({ name: 'toggle-rulers' }),
        },
    );
    const root = markRaw(new TestElement('root'));
    app.mount(root);
    context.after(() => {
        app.unmount();
    });
    const filenameInput = findElement(root, 'aria-label', 'Filename');
    assert.ok(filenameInput, 'the filename input should render');
    return { emitted, root, filenameInput };
}

function findElement(root: TestElement, property: string, value: string): TestElement | null {
    const actual = property === 'type' ? root.type : root.props[property];
    if (actual === value) return root;
    for (const child of root.children) {
        const match = findElement(child, property, value);
        if (match) return match;
    }
    return null;
}

async function invokeHandler(element: TestElement, name: string, event: Event) {
    const handler = element.props[name];
    assert.ok(typeof handler === 'function' || Array.isArray(handler), `${name} should be wired`);
    const handlers = Array.isArray(handler) ? handler : [handler];
    for (const callback of handlers) {
        if (typeof callback === 'function') await callback(event);
    }
}

async function enterFilename(input: TestElement, value: string) {
    input.value = value;
    const event = new Event('input');
    Object.defineProperty(event, 'target', { value: input });
    for (const listener of input.eventListeners.get('input') ?? []) listener(event);
    await invokeHandler(input, 'onInput', event);
}

function keyboardEvent(key: string): Event {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: key });
    return event;
}

test('shows a fallback filename and prevents renaming when there is no image', async (t) => {
    const { emitted, filenameInput, root } = mountTopBar(t, null);

    assert.equal(filenameInput.value, 'No image');
    assert.equal(filenameInput.props.disabled, true);
    assert.equal(findElement(root, 'type', 'select'), null);
    assert.equal(findElement(root, 'class', 'filename-edit-indicator bi bi-pencil'), null);
    await invokeHandler(filenameInput, 'onClick', new Event('click'));
    assert.equal(filenameInput.props.readonly, true);
    assert.deepEqual(emitted, []);
    assert.equal(findElement(root, 'aria-label', 'Pixel rulers')?.props.disabled, true);
});

test('pixel ruler toggle exposes its state and emits a toggle event', async (t) => {
    const image: ImageInfo = { fileName: 'image.png', width: 800, height: 600, exportMimeType: 'image/png' };
    const { root, emitted } = mountTopBar(t, image);
    const toggle = findElement(root, 'aria-label', 'Pixel rulers');
    assert.ok(toggle);
    assert.equal(toggle.props['aria-pressed'], false);
    assert.equal(toggle.props.disabled, false);
    await invokeHandler(toggle, 'onClick', new Event('click'));
    assert.deepEqual(emitted, [{ name: 'toggle-rulers' }]);

    const enabled = mountTopBar(t, image, false, true);
    assert.equal(findElement(enabled.root, 'aria-label', 'Pixel rulers')?.props['aria-pressed'], true);
    const busy = mountTopBar(t, image, true);
    assert.equal(findElement(busy.root, 'aria-label', 'Pixel rulers')?.props.disabled, true);
});

test('does not start renaming while the editor is busy', async (t) => {
    const { filenameInput } = mountTopBar(t, {
        fileName: 'portrait.png',
        width: 400,
        height: 600,
        exportMimeType: 'image/png',
    }, true);

    await invokeHandler(filenameInput, 'onClick', new Event('click'));

    assert.equal(filenameInput.props.disabled, true);
    assert.equal(filenameInput.props.readonly, true);
});

test('starts renaming from the extensionless filename and focuses its input', async (t) => {
    const { filenameInput, root } = mountTopBar(t, {
        fileName: 'family.photo.JPG',
        width: 400,
        height: 600,
        exportMimeType: 'image/png',
    });

    assert.equal(filenameInput.value, 'family.photo');
    const extension = findElement(root, 'class', 'filename-extension');
    await invokeHandler(filenameInput, 'onClick', new Event('click'));

    assert.equal(filenameInput.value, 'family.photo');
    assert.equal(filenameInput.props.readonly, false);
    assert.equal(filenameInput.focusCount, 1);
    assert.deepEqual(filenameInput.selectionRanges, [[0, 'family.photo'.length]]);
    assert.equal(findElement(root, 'class', 'filename-extension')?.text, '.JPG');
    assert.equal(findElement(root, 'class', 'filename-extension'), extension);
    await enterFilename(filenameInput, 'a much longer new filename');
    assert.equal(filenameInput.value, 'a much longer new filename');
    assert.equal(findElement(root, 'class', 'filename-extension'), extension);
});

test('trims a renamed filename and removes a supported extension before emitting', async (t) => {
    const { emitted, filenameInput } = mountTopBar(t, {
        fileName: 'original.png',
        width: 400,
        height: 600,
        exportMimeType: 'image/png',
    });
    await invokeHandler(filenameInput, 'onClick', new Event('click'));
    await enterFilename(filenameInput, '  Final.Name.JpEg  ');

    await invokeHandler(filenameInput, 'onBlur', new Event('blur'));

    assert.deepEqual(filenameInput.validityMessages, ['', '']);
    assert.equal(filenameInput.validityReportCount, 1);
    assert.equal(filenameInput.props.readonly, true);
    assert.deepEqual(emitted, [{ name: 'rename', value: 'Final.Name' }]);
});

test('keeps an invalid empty filename in edit mode and reports the validation message', async (t) => {
    const { emitted, filenameInput } = mountTopBar(t, {
        fileName: 'original.png',
        width: 400,
        height: 600,
        exportMimeType: 'image/png',
    });
    filenameInput.validityResult = false;
    await invokeHandler(filenameInput, 'onClick', new Event('click'));
    await enterFilename(filenameInput, '  .png  ');

    await invokeHandler(filenameInput, 'onBlur', new Event('blur'));

    assert.deepEqual(filenameInput.validityMessages, ['', 'Enter a filename without an extension.']);
    assert.equal(filenameInput.validityReportCount, 1);
    assert.equal(filenameInput.props.readonly, false);
    assert.deepEqual(emitted, []);
});

test('cancels renaming without validation or emitting and can restore input focus', async (t) => {
    const { emitted, filenameInput } = mountTopBar(t, {
        fileName: 'original.png',
        width: 400,
        height: 600,
        exportMimeType: 'image/png',
    });
    await invokeHandler(filenameInput, 'onClick', new Event('click'));

    await invokeHandler(filenameInput, 'onKeydown', keyboardEvent('Escape'));

    assert.equal(filenameInput.props.readonly, true);
    assert.equal(filenameInput.validityReportCount, 0);
    assert.equal(filenameInput.value, 'original');
    assert.equal(filenameInput.focusCount, 2);
    assert.deepEqual(emitted, []);
});

test('shows the full filename including extension when not editing', (t) => {
    const { filenameInput, root } = mountTopBar(t, {
        fileName: 'original.png',
        width: 400,
        height: 600,
        exportMimeType: 'image/png',
    });
    assert.equal(filenameInput.value, 'original');
    assert.equal(findElement(root, 'type', 'select'), null);
    assert.equal(findElement(root, 'class', 'filename-extension')?.text, '.png');
});

test('emits the theme toggle event when its button is activated', async (t) => {
    const { emitted, root } = mountTopBar(t, null);
    const themeButton = findElement(root, 'class', 'theme-toggle');
    assert.ok(themeButton);

    await invokeHandler(themeButton, 'onClick', new Event('click'));

    assert.deepEqual(emitted, [{ name: 'toggle-theme' }]);
});
