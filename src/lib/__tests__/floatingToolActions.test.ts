import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'vue/compiler-sfc';
import { createSourceFile, isFunctionDeclaration, ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import type { ToolId } from '../../types/editor.ts';
import type { ToolCloseIntent } from '../toolDraft.ts';

const source = await readFile(new URL('../../App.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = createSourceFile('App.ts', descriptor.scriptSetup?.content ?? '', ScriptTarget.Latest, true);
const handler = script.statements.find(statement => isFunctionDeclaration(statement) && statement.name?.text === 'afterFloatingToolClose');
assert.ok(handler);
const compiled = transpileModule(`
    import { isFloatingTool } from ${JSON.stringify(new URL('../toolDraft.ts', import.meta.url).href)};
    export function createAction(activeTool, guard) {
        ${handler.getText(script)}
        return afterFloatingToolClose;
    }
`, { compilerOptions: { module: ModuleKind.ESNext } }).outputText;

/* eslint-disable no-unused-vars */
interface ActionGuard { request: (intent: ToolCloseIntent, action: () => void) => void }
const { createAction }: {
    createAction: (activeTool: { value: ToolId | null }, guard: ActionGuard) => (action: () => void) => void
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
/* eslint-enable no-unused-vars */

test('popup import/history/document-close actions retain their original cancellation behavior', () => {
    for (const tool of ['levels', 'curves', 'brightness-contrast', 'color-mode', null] as const) {
        const activeTool = { value: tool };
        let requests = 0;
        let actions = 0;
        const run = createAction(activeTool, { request: () => { requests += 1; } });
        run(() => { actions += 1; });
        assert.equal(requests, 0, 'popup actions bypass the floating close guard');
        assert.equal(actions, 1);
        assert.equal(activeTool.value, tool, 'a canceled document action must not preemptively close the popup');
    }
});

test('floating document actions wait for their guarded close intent', () => {
    for (const tool of ['crop', 'resize', 'rotate', 'brush'] as const) {
        const activeTool = { value: tool };
        let intent: ToolCloseIntent | undefined;
        let pending: (() => void) | undefined;
        let actions = 0;
        const run = createAction(activeTool, { request: (value, action) => { intent = value; pending = action; } });
        run(() => { actions += 1; });
        assert.deepEqual(intent, { kind: 'close' });
        assert.equal(actions, 0);
        pending?.();
        assert.equal(actions, 1);
    }
});
