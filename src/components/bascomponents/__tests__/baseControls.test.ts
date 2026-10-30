import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer, nextTick, type Component } from 'vue';
import { baseControlUrl } from './loadBaseControl.ts';

class TestInput {
    value = '0';
    checked = false;
    focusCount = 0;
    get valueAsNumber() { return Number(this.value); }
    focus() { this.focusCount += 1; }
}
Object.defineProperty(globalThis, 'HTMLInputElement', { configurable: true, value: TestInput });

async function loadControl(name: string): Promise<Component> {
    return (await import(await baseControlUrl(name))).default;
}

interface TestElement {
    tag: string
    props: Record<string, unknown>
    valuePatches?: number
    focus?: () => void
    getBoundingClientRect?: () => DOMRect
}

function mountControl(component: Component, props: Record<string, unknown>) {
    const elements: TestElement[] = [];
    const renderer = createRenderer<TestElement, TestElement>({
        createElement(tag) {
            const element = { tag, props: {} };
            elements.push(element);
            return element;
        },
        createText: () => ({ tag: '#text', props: {} }),
        createComment: () => ({ tag: '#comment', props: {} }),
        insert() {},
        remove() {},
        setText() {},
        setElementText() {},
        patchProp(element, key, _previous, next) {
            element.props[key] = next;
            if (key === 'value') element.valuePatches = (element.valuePatches ?? 0) + 1;
        },
        parentNode: () => null,
        nextSibling: () => null,
    });
    const app = renderer.createApp(component, props);
    app.mount({ tag: 'root', props: {} });
    const element = elements[0];
    assert.ok(element);
    return { element, app };
}

function dispatch(element: TestElement, name: string, target: TestInput) {
    const event = new Event(name.slice(2).toLowerCase());
    Object.defineProperty(event, 'target', { value: target });
    const listeners = element.props[name];
    assert.ok(listeners);
    for (const listener of Array.isArray(listeners) ? listeners : [listeners]) listener(event);
    return event;
}

test('range keeps a native root, numeric model, attributes and single native event delivery', async () => {
    const updates: number[] = [];
    const events: Event[] = [];
    const { element, app } = mountControl(await loadControl('BaseRangeInput'), {
        modelValue: 12, min: -100, max: 100, step: 1, disabled: true,
        class: 'existing-slider', style: { width: '120px' }, 'aria-label': 'Brightness',
        'onUpdate:modelValue': (value: number) => updates.push(value),
        onInput: (event: Event) => events.push(event),
    });
    try {
        assert.equal(element.tag, 'input');
        assert.equal(element.props.type, 'range');
        assert.equal(element.props.value, 12);
        assert.equal(element.props.min, -100);
        assert.equal(element.props.max, 100);
        assert.equal(element.props.step, 1);
        assert.equal(element.props.disabled, true);
        assert.equal(element.props.class, 'existing-slider');
        assert.deepEqual(element.props.style, { width: '120px' });
        assert.equal(element.props['aria-label'], 'Brightness');
        const input = new TestInput();
        input.value = '24';
        const event = dispatch(element, 'onInput', input);
        assert.deepEqual(updates, [24]);
        assert.deepEqual(events, [event]);
        assert.equal(events[0]?.target, input);
    } finally { app.unmount(); }
});

test('range supports controlled native value/change without a model', async () => {
    const events: Event[] = [];
    const { element, app } = mountControl(await loadControl('BaseRangeInput'), {
        value: 30, onChange: (event: Event) => events.push(event),
    });
    try {
        assert.equal(element.props.value, 30);
        const patches = element.valuePatches;
        const input = new TestInput();
        input.value = '40';
        dispatch(element, 'onInput', input);
        await nextTick();
        assert.equal(element.valuePatches, patches, 'editing must not re-render the old controlled value before change');
        const event = dispatch(element, 'onChange', input);
        assert.deepEqual(events, [event]);
    } finally { app.unmount(); }
});

test('number input emits numbers or empty strings before native input listeners', async () => {
    const calls: unknown[] = [];
    const { element, app } = mountControl(await loadControl('BaseNumberInput'), {
        modelValue: 4, min: 1, max: 255, required: true, 'aria-label': 'Shadows',
        'onUpdate:modelValue': (value: number | string) => calls.push(value),
        onInput: (event: Event) => calls.push(event.target),
        onBlur: (event: Event) => calls.push(event),
    });
    try {
        assert.equal(element.tag, 'input');
        assert.equal(element.props.type, 'number');
        assert.equal(element.props.required, true);
        assert.equal(element.props.min, 1);
        assert.equal(element.props.max, 255);
        const input = new TestInput();
        input.value = '1.25';
        dispatch(element, 'onInput', input);
        input.value = '';
        dispatch(element, 'onInput', input);
        const blur = dispatch(element, 'onBlur', input);
        assert.deepEqual(calls, [1.25, input, '', input, blur]);
        let focuses = 0;
        element.focus = () => { focuses += 1; };
        const instance = app._instance?.exposed;
        assert.ok(instance);
        instance.focus();
        assert.equal(focuses, 1);
    } finally { app.unmount(); }
});

test('number input preserves controlled value and change targets without a model', async () => {
    const events: Event[] = [];
    const { element, app } = mountControl(await loadControl('BaseNumberInput'), {
        value: 128, disabled: true, class: 'field__input',
        onChange: (event: Event) => events.push(event),
    });
    try {
        assert.equal(element.props.value, 128);
        assert.equal(element.props.disabled, true);
        assert.equal(element.props.class, 'field__input');
        const input = new TestInput();
        input.value = '30';
        const patches = element.valuePatches;
        dispatch(element, 'onInput', input);
        await nextTick();
        assert.equal(element.valuePatches, patches, 'editing must not re-render the old controlled value before change');
        const event = dispatch(element, 'onChange', input);
        assert.deepEqual(events, [event]);
        assert.equal(event.target, input);
    } finally { app.unmount(); }
});

test('checkbox emits one boolean update and forwards the original native change once', async () => {
    const updates: boolean[] = [];
    const events: Event[] = [];
    const { element, app } = mountControl(await loadControl('BaseCheckbox'), {
        modelValue: true, id: 'preview', name: 'preview', disabled: true,
        'onUpdate:modelValue': (value: boolean) => updates.push(value),
        onChange: (event: Event) => events.push(event),
    });
    try {
        assert.equal(element.tag, 'input');
        assert.equal(element.props.type, 'checkbox');
        assert.equal(element.props.checked, true);
        assert.equal(element.props.id, 'preview');
        assert.equal(element.props.name, 'preview');
        assert.equal(element.props.disabled, true);
        const input = new TestInput();
        const event = dispatch(element, 'onChange', input);
        input.checked = true;
        dispatch(element, 'onChange', input);
        assert.deepEqual(updates, [false, true]);
        assert.equal(events.length, 2);
        assert.equal(events[0], event);
    } finally { app.unmount(); }
});

test('button defaults to non-submit, forwards native attributes/events, and exposes focus', async () => {
    let clicks = 0;
    const { element, app } = mountControl(await loadControl('BaseButton'), {
        disabled: true, title: 'Undo', 'aria-pressed': false, variant: 'tool',
        class: 'is-active', onClick: () => { clicks += 1; },
    });
    try {
        assert.equal(element.tag, 'button');
        assert.equal(element.props.type, 'button');
        assert.equal(element.props.disabled, true);
        assert.equal(element.props.title, 'Undo');
        assert.equal(element.props['aria-pressed'], false);
        assert.equal(element.props.class, 'tool-button is-active');
        dispatch(element, 'onClick', new TestInput());
        assert.equal(clicks, 1);
        let focuses = 0;
        element.focus = () => { focuses += 1; };
        const instance = app._instance?.exposed;
        assert.ok(instance);
        instance.focus();
        assert.equal(focuses, 1);
    } finally { app.unmount(); }
});

test('button preserves explicit submit/reset types', async () => {
    const component = await loadControl('BaseButton');
    for (const type of ['submit', 'reset']) {
        const { element, app } = mountControl(component, { type });
        try { assert.equal(element.props.type, type); }
        finally { app.unmount(); }
    }
});
