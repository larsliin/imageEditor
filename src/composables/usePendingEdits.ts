import { readonly, shallowRef, type ComputedRef } from 'vue';
import type { ToolId } from '@/types/editor';

export type PendingEditAction = { type: 'select-tool'; tool: ToolId | null }
    | { type: 'import'; file?: File }
    | { type: 'export' }
    | { type: 'close' };

/* eslint-disable no-unused-vars */
type ActionHandler = (action: PendingEditAction) => Promise<void>;
/* eslint-enable no-unused-vars */

export function usePendingEdits(hasPending: ComputedRef<boolean>, clear: () => void) {
    const promptOpen = shallowRef(false);
    let deferredAction: PendingEditAction | null = null;

    function reset() {
        clear();
        deferredAction = null;
        promptOpen.value = false;
    }

    async function requestAction(action: PendingEditAction, performAction: ActionHandler) {
        if (hasPending.value) {
            deferredAction = action;
            promptOpen.value = true;
            return;
        }
        await performAction(action);
    }

    async function applyAndContinue(apply: () => Promise<boolean>, performAction: ActionHandler, onApplied: () => void) {
        if (!hasPending.value) return;
        const action = deferredAction;
        if (!(await apply())) return;
        reset();
        onApplied();
        if (action) await performAction(action);
    }

    async function discardAndContinue(performAction: ActionHandler, onDiscarded: () => void) {
        const action = deferredAction;
        reset();
        onDiscarded();
        if (action) await performAction(action);
    }

    function keepEditing() {
        deferredAction = null;
        promptOpen.value = false;
    }

    return { promptOpen: readonly(promptOpen), reset, requestAction, applyAndContinue, discardAndContinue, keepEditing };
}
