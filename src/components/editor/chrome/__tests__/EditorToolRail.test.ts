import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { createRenderer, markRaw, nextTick, type Component } from 'vue';
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc';
import { ModuleKind, transpileModule } from 'typescript';
import { fileURLToPath, pathToFileURL } from 'node:url';

const componentUrls = new Map<string, Promise<string>>();

function replaceImport(source: string, specifier: string, replacement: string): string {
    const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return source.replaceAll(new RegExp(`(['"])${escaped}\\1`, 'g'), JSON.stringify(replacement));
}

function resolveAliasPath(specifier: string): string {
    let path = resolve(process.cwd(), 'src', specifier.slice(2));
    if (!extname(path)) {
        if (existsSync(`${path}.ts`)) path += '.ts';
        else if (existsSync(`${path}.vue`)) path += '.vue';
    }
    return path;
}

function loadComponentUrl(path: string): Promise<string> {
    const absolutePath = resolve(path);
    const cached = componentUrls.get(absolutePath);
    if (cached) return cached;

    const url = (async () => {
        const source = await readFile(absolutePath, 'utf8');
        const { descriptor } = parse(source, { filename: absolutePath });
        const script = descriptor.script || descriptor.scriptSetup
            ? compileScript(descriptor, { id: absolutePath, inlineTemplate: true }).content
            : `${compileTemplate({
                source: descriptor.template?.content ?? '',
                filename: absolutePath,
                id: absolutePath,
            }).code}\nexport default { render };`;
        let compiled = transpileModule(script, {
            compilerOptions: { module: ModuleKind.ESNext },
        }).outputText.replaceAll(/import ['"][^'"]+\.css['"];?/g, '');
        const imports = [...compiled.matchAll(/from\s+(['"])([^'"]+)\1/g)].map((match) => match[2]).filter(Boolean);

        for (const specifier of imports) {
            let replacement: string;
            if (specifier === 'vue') {
                replacement = import.meta.resolve('vue');
            } else if (specifier.startsWith('@/')) {
                const aliasPath = resolveAliasPath(specifier);
                replacement = aliasPath.endsWith('.vue')
                    ? await loadComponentUrl(aliasPath)
                    : pathToFileURL(aliasPath).href;
            } else if (specifier.endsWith('.vue')) {
                replacement = await loadComponentUrl(resolve(dirname(absolutePath), specifier));
            } else {
                throw new Error(`Unexpected component test import: ${specifier}`);
            }
            compiled = replaceImport(compiled, specifier, replacement);
        }

        return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
    })();
    componentUrls.set(absolutePath, url);
    return url;
}

const editorToolRail: Component = (await import(
    await loadComponentUrl(fileURLToPath(new URL('../EditorToolRail.vue', import.meta.url))),
)).default;

interface RailSize {
    clientHeight: number
    scrollHeight: number
}

class TestElement {
    readonly props: Record<string, unknown> = {};
    readonly children: TestElement[] = [];
    readonly style: Record<string, string> = {};
    parent: TestElement | null = null;
    text = '';
    clientHeight = 0;
    scrollHeight = 0;
    readonly type: string;

    constructor(type: string, railSize: RailSize) {
        this.type = type;
        if (type === 'nav') {
            this.clientHeight = railSize.clientHeight;
            this.scrollHeight = railSize.scrollHeight;
        }
    }

    getBoundingClientRect() {
        return { top: 24, right: 48 } as DOMRect;
    }
}

interface RailProps {
    activeTool?: string | null
    hasImage?: boolean
    busy?: boolean
    popupOpen?: boolean
    canZoomIn?: boolean
    canZoomOut?: boolean
    canUndo?: boolean
    canRedo?: boolean
}

interface EmittedEvent {
    name: string
    value?: string
}

function mountRail(railSize: RailSize, props: RailProps = {}) {
    const emitted: EmittedEvent[] = [];
    const renderer = createRenderer<TestElement, TestElement>({
        createElement: (type) => markRaw(new TestElement(type, railSize)),
        createText: (text) => {
            const element = new TestElement('#text', railSize);
            element.text = text;
            return markRaw(element);
        },
        createComment: (text) => {
            const element = new TestElement('#comment', railSize);
            element.text = text;
            return markRaw(element);
        },
        insert(child, parent, anchor) {
            if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
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
            if (key === 'style' && next && typeof next === 'object') {
                Object.assign(node.style, next);
            }
        },
        parentNode: (node) => node.parent,
        nextSibling: (node) => {
            const siblings = node.parent?.children;
            return siblings ? siblings[siblings.indexOf(node) + 1] ?? null : null;
        },
    });
    const app = renderer.createApp(editorToolRail, {
        activeTool: null,
        hasImage: true,
        busy: false,
        popupOpen: false,
        canZoomIn: true,
        canZoomOut: true,
        canUndo: true,
        canRedo: true,
        ...props,
        onImport: () => emitted.push({ name: 'import' }),
        onExport: () => emitted.push({ name: 'export' }),
        onUndo: () => emitted.push({ name: 'undo' }),
        onRedo: () => emitted.push({ name: 'redo' }),
        onZoomIn: () => emitted.push({ name: 'zoom-in' }),
        onZoomOut: () => emitted.push({ name: 'zoom-out' }),
        onSelectTool: (tool: string) => emitted.push({ name: 'select-tool', value: tool }),
    });
    const root = markRaw(new TestElement('root', railSize));
    app.mount(root);
    return { app, emitted, root };
}

function findElement(root: TestElement, property: string, value: string): TestElement | null {
    if (property === 'tag' ? root.type === value : root.props[property] === value) return root;
    for (const child of root.children) {
        const match = findElement(child, property, value);
        if (match) return match;
    }
    return null;
}

function findElements(root: TestElement, property: string, value: string): TestElement[] {
    const matches = (property === 'tag' ? root.type === value : root.props[property] === value) ? [root] : [];
    return matches.concat(...root.children.map((child) => findElements(child, property, value)));
}

function findFoldoutPanel(root: TestElement): TestElement | null {
    if (root.props.role === 'group' && root.props['aria-label'] === 'More tools') return root;
    for (const child of root.children) {
        const match = findFoldoutPanel(child);
        if (match) return match;
    }
    return null;
}

function isWithin(element: TestElement, ancestor: TestElement): boolean {
    let current = element.parent;
    while (current) {
        if (current === ancestor) return true;
        current = current.parent;
    }
    return false;
}

async function click(element: TestElement | null) {
    assert.ok(element, 'the target button should render');
    const handler = element.props.onClick;
    assert.ok(typeof handler === 'function' || Array.isArray(handler), 'the button should have a click handler');
    for (const callback of Array.isArray(handler) ? handler : [handler]) {
        if (typeof callback === 'function') await callback(new Event('click'));
    }
}

function installBrowserMocks() {
    class TestResizeObserver {
        private readonly callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) { this.callback = callback; }
        observe() { this.callback([], this as unknown as ResizeObserver); }
        disconnect() {}
    }
    Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: TestResizeObserver });
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { innerWidth: 1280, innerHeight: 420, addEventListener() {}, removeEventListener() {} },
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { addEventListener() {}, removeEventListener() {} },
    });
}

test('collapsed rail keeps view tools outside the edit foldout and preserves tool actions', async (context) => {
    installBrowserMocks();
    const { app, emitted, root } = mountRail({ clientHeight: 100, scrollHeight: 500 });
    context.after(() => app.unmount());
    await nextTick();

    const toggle = findElement(root, 'aria-label', 'More tools');
    const zoomIn = findElement(root, 'aria-label', 'Zoom in');
    const zoomOut = findElement(root, 'aria-label', 'Zoom out');
    const pan = findElement(root, 'aria-label', 'Pan');
    assert.ok(toggle && zoomIn && zoomOut && pan);
    const panel = findFoldoutPanel(root);
    assert.ok(panel);
    assert.equal(panel.props['aria-label'], 'More tools');
    assert.equal(isWithin(zoomIn, panel), false);
    assert.equal(isWithin(zoomOut, panel), false);
    assert.equal(isWithin(pan, panel), false);

    await click(toggle);
    await nextTick();
    assert.equal(toggle.props['aria-expanded'], true);
    assert.equal(findElements(panel, 'tag', 'hr').length, 2, 'More tools should keep only internal separators');
    for (const label of [
        'Crop', 'Resize', 'Rotate image', 'Brush', 'Levels', 'Curves', 'Brightness/Contrast', 'Color mode',
    ]) {
        assert.ok(findElement(panel, 'aria-label', label), `${label} should be available in More tools`);
    }
    for (const label of ['Import image', 'Export', 'Undo', 'Redo', 'Zoom in', 'Zoom out', 'Pan']) {
        assert.equal(findElement(panel, 'aria-label', label), null, `${label} should stay outside More tools`);
    }

    await click(pan);
    await nextTick();
    assert.equal(toggle.props['aria-expanded'], false);
    assert.deepEqual(emitted, [{ name: 'select-tool', value: 'pan' }]);

    await click(zoomIn);
    await click(zoomOut);
    assert.deepEqual(emitted, [
        { name: 'select-tool', value: 'pan' },
        { name: 'zoom-in' },
        { name: 'zoom-out' },
    ]);

    const panActive = mountRail(
        { clientHeight: 100, scrollHeight: 500 },
        { activeTool: 'pan' },
    );
    context.after(() => panActive.app.unmount());
    await nextTick();
    const activeToggle = findElement(panActive.root, 'aria-label', 'More tools');
    assert.ok(activeToggle);
    assert.equal(activeToggle.props['aria-expanded'], false);
    assert.doesNotMatch(String(activeToggle.props.class), /\bis-active\b/);
});

test('collapsed rail retains disabled states and expanded rail keeps tool groups', async (context) => {
    installBrowserMocks();
    const empty = mountRail(
        { clientHeight: 100, scrollHeight: 500 },
        { hasImage: false, canZoomIn: false, canZoomOut: true },
    );
    context.after(() => empty.app.unmount());
    await nextTick();
    assert.equal(findElement(empty.root, 'aria-label', 'Import image')?.props.disabled, false);
    assert.equal(findElement(empty.root, 'aria-label', 'Export')?.props.disabled, true);
    assert.equal(findElement(empty.root, 'aria-label', 'Undo')?.props.disabled, true);
    assert.equal(findElement(empty.root, 'aria-label', 'Redo')?.props.disabled, true);
    assert.equal(findElement(empty.root, 'aria-label', 'Crop')?.props.disabled, true);
    assert.equal(findElement(empty.root, 'aria-label', 'Pan')?.props.disabled, true);
    assert.equal(findElement(empty.root, 'aria-label', 'Zoom in')?.props.disabled, true);
    assert.equal(findElement(empty.root, 'aria-label', 'Zoom out')?.props.disabled, false);

    const busy = mountRail(
        { clientHeight: 100, scrollHeight: 500 },
        { busy: true, popupOpen: true },
    );
    context.after(() => busy.app.unmount());
    await nextTick();
    assert.equal(findElement(busy.root, 'tag', 'fieldset')?.props.disabled, true);
    for (const label of ['Import image', 'Export', 'Undo', 'Redo', 'Crop', 'Pan']) {
        assert.equal(findElement(busy.root, 'aria-label', label)?.props.disabled, true);
    }
    assert.equal(findElement(busy.root, 'aria-label', 'Zoom in')?.props.disabled, false);
    assert.equal(findElement(busy.root, 'aria-label', 'Zoom out')?.props.disabled, false);

    const expanded = mountRail({ clientHeight: 1000, scrollHeight: 500 });
    context.after(() => expanded.app.unmount());
    await nextTick();
    assert.equal(findElement(expanded.root, 'aria-label', 'More tools'), null);
    const transformGroup = findElement(expanded.root, 'aria-label', 'Transform tools');
    const paintGroup = findElement(expanded.root, 'aria-label', 'Paint tools');
    const adjustmentGroup = findElement(expanded.root, 'aria-label', 'Adjustment tools');
    assert.ok(transformGroup && paintGroup && adjustmentGroup, 'all expanded tool groups should remain visible');
    const groupChildren = adjustmentGroup.parent?.children ?? [];
    const adjustmentGroupIndex = groupChildren.indexOf(adjustmentGroup);
    const nextGroupElement = groupChildren
        .slice(adjustmentGroupIndex + 1)
        .find((child) => child.type !== '#text' && child.type !== '#comment');
    assert.equal(nextGroupElement?.type, 'hr', 'expanded editing groups should have a separator before View tools');
    for (const label of ['Crop', 'Resize', 'Rotate image']) {
        assert.ok(findElement(transformGroup, 'aria-label', label), `${label} should remain in the transform group`);
    }
    assert.ok(findElement(paintGroup, 'aria-label', 'Brush'), 'Brush should remain in the paint group');
    for (const label of ['Levels', 'Curves', 'Brightness/Contrast', 'Color mode']) {
        assert.ok(findElement(adjustmentGroup, 'aria-label', label), `${label} should remain in the adjustment group`);
    }
});

for (const [platform, modifier] of [['MacIntel', '⌘'], ['Win32', 'Ctrl'], ['Linux x86_64', 'Ctrl']]) {
    test(`shortcut tooltips match the platform: ${platform}`, async (context) => {
        installBrowserMocks();
        const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { platform } });
        context.after(() => {
            if (saved) Object.defineProperty(globalThis, 'navigator', saved);
            else Reflect.deleteProperty(globalThis, 'navigator');
        });
        const { app, root } = mountRail({ clientHeight: 1000, scrollHeight: 500 });
        context.after(() => app.unmount());
        await nextTick();
        for (const [label, title] of [
            ['Undo', `Undo last edit (${modifier}+Z)`],
            ['Redo', `Redo last undone edit (${modifier}+Y or ${modifier}+Shift+Z)`],
            ['Zoom in', `Zoom in (${modifier}++)`],
            ['Zoom out', `Zoom out (${modifier}+-)`],
        ]) {
            assert.equal(findElement(root, 'aria-label', label)?.props.title, title);
        }
    });
}
