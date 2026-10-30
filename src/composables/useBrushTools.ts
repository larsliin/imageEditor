import { computed, onScopeDispose, readonly, shallowRef, watch, type Ref } from 'vue';
import type { ToolId } from '@/types/editor';
import { DEFAULT_BRUSH_SETTINGS, type BrushSettings, type BrushStroke } from '@/lib/brush';

/* eslint-disable no-unused-vars */
interface BrushOptions {
    activeTool: Ref<ToolId | null>
    bitmap: Readonly<Ref<ImageBitmap | null>>
    isBusy: Readonly<Ref<boolean>>
    brushImage: (strokes: readonly BrushStroke[]) => Promise<boolean>
}
/* eslint-enable no-unused-vars */

// Pending strokes live only while the Brush tool is active; leaving the tool discards them.
export function useBrushTools(options: BrushOptions) {
    const settings = shallowRef<BrushSettings>({ ...DEFAULT_BRUSH_SETTINGS });
    const strokes = shallowRef<BrushStroke[]>([]);
    const hasPending = computed(() => strokes.value.length > 0);

    function clear() {
        strokes.value = [];
    }

    function updateSettings(value: BrushSettings) {
        settings.value = value;
    }

    function addStroke(stroke: BrushStroke) {
        strokes.value = [...strokes.value, stroke];
    }

    function undoStroke() {
        strokes.value = strokes.value.slice(0, -1);
    }

    async function apply() {
        if (options.isBusy.value || !hasPending.value) return;
        if (await options.brushImage(strokes.value)) options.activeTool.value = null;
    }

    function cancel() {
        if (options.isBusy.value) return;
        options.activeTool.value = null;
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key !== 'Escape' || event.isComposing || options.activeTool.value !== 'brush') return;
        event.preventDefault();
        cancel();
    }

    watch(options.bitmap, clear);
    watch(options.activeTool, (tool) => {
        if (tool !== 'brush') clear();
    });
    window.addEventListener('keydown', onKeydown);
    onScopeDispose(() => window.removeEventListener('keydown', onKeydown));

    return {
        settings: readonly(settings),
        strokes: readonly(strokes),
        hasPending,
        updateSettings,
        addStroke,
        undoStroke,
        apply,
        cancel,
    };
}
