import { onScopeDispose, watch, type Ref } from 'vue';
import type { ToolId } from '@/types/editor';
import type { BrushStroke } from '@/lib/brush';
import { useBrushSession } from './useBrushSession';
import type { PendingEditAction } from './usePendingEdits';

/* eslint-disable no-unused-vars */
interface BrushOptions {
    activeTool: Ref<ToolId | null>
    bitmap: Readonly<Ref<ImageBitmap | null>>
    isBusy: Readonly<Ref<boolean>>
    brushImage: (strokes: readonly BrushStroke[]) => Promise<boolean>
    performAction: (action: PendingEditAction) => Promise<void>
}
/* eslint-enable no-unused-vars */

export function useBrushTools(options: BrushOptions) {
    const brushSession = useBrushSession();

    function finish() {
        options.activeTool.value = null;
    }

    function requestAction(action: PendingEditAction) {
        if (options.isBusy.value) return;
        void brushSession.requestAction(action, options.performAction);
    }

    function apply() {
        if (options.isBusy.value) return;
        void brushSession.applyAndContinue(options.brushImage, options.performAction, finish);
    }

    function discard() {
        if (options.isBusy.value) return;
        void brushSession.discardAndContinue(options.performAction, finish);
    }

    function cancel() {
        if (options.isBusy.value) return;
        brushSession.reset();
        finish();
    }

    function keepEditing() {
        brushSession.keepEditing();
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key !== 'Escape' || event.isComposing || options.activeTool.value !== 'brush'
            || options.isBusy.value || brushSession.promptOpen.value) return;
        event.preventDefault();
        cancel();
    }

    watch(options.bitmap, brushSession.reset);
    watch(options.activeTool, (tool, previous) => {
        if (previous === 'brush' && tool !== 'brush') brushSession.reset();
    });
    window.addEventListener('keydown', onKeydown);
    onScopeDispose(() => window.removeEventListener('keydown', onKeydown));

    return {
        brushSession,
        hasPending: brushSession.hasPending,
        promptOpen: brushSession.promptOpen,
        requestAction,
        apply,
        discard,
        cancel,
        keepEditing,
    };
}
