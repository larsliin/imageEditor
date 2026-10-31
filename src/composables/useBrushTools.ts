import { computed, readonly, shallowRef, watch, type Ref } from 'vue';
import type { ToolId } from '@/types/editor';
import { DEFAULT_BRUSH_SETTINGS, isValidBrushSettings, type BrushSettings, type BrushStroke } from '@/lib/brush';

/* eslint-disable no-unused-vars */
interface BrushOptions {
    activeTool: Ref<ToolId | null>
    bitmap: Readonly<Ref<ImageBitmap | null>>
    isBusy: Readonly<Ref<boolean>>
    brushImage: (strokes: readonly BrushStroke[]) => Promise<boolean>
}
/* eslint-enable no-unused-vars */

const settingsStorageKey = 'image-editor-brush';

function restoreSettings(): BrushSettings {
    try {
        const saved = localStorage.getItem(settingsStorageKey);
        if (saved === null) return { ...DEFAULT_BRUSH_SETTINGS };
        const parsed: unknown = JSON.parse(saved);
        const candidate = { ...DEFAULT_BRUSH_SETTINGS, ...(typeof parsed === 'object' ? parsed : {}) };
        const settings: BrushSettings = { thickness: candidate.thickness, color: candidate.color };
        if (isValidBrushSettings(settings)) return settings;
        console.warn('Ignoring invalid saved brush settings:', saved);
    } catch (error) {
        console.warn('Unable to restore the saved brush settings:', error);
    }
    return { ...DEFAULT_BRUSH_SETTINGS };
}

// Pending strokes live only while the Brush tool is active; leaving the tool discards them.
export function useBrushTools(options: BrushOptions) {
    const settings = shallowRef<BrushSettings>(restoreSettings());
    const strokes = shallowRef<BrushStroke[]>([]);
    const drawing = shallowRef(false);
    const dirty = computed(() => drawing.value || strokes.value.length > 0);
    const hasPending = computed(() => strokes.value.length > 0);

    function clear() {
        drawing.value = false;
        strokes.value = [];
    }

    function updateSettings(value: BrushSettings) {
        settings.value = value;
        try {
            localStorage.setItem(settingsStorageKey, JSON.stringify(value));
        } catch (error) {
            console.warn('Unable to save the brush settings:', error);
        }
    }

    function addStroke(stroke: BrushStroke) {
        strokes.value = [...strokes.value, stroke];
    }

    function undoStroke() {
        strokes.value = strokes.value.slice(0, -1);
    }

    async function apply() {
        if (options.isBusy.value || drawing.value || !hasPending.value) return false;
        return options.brushImage(strokes.value);
    }

    watch(options.bitmap, clear);
    watch(options.activeTool, (tool) => {
        if (tool !== 'brush') clear();
    });

    return {
        settings: readonly(settings),
        strokes: readonly(strokes),
        hasPending,
        drawing: readonly(drawing),
        dirty,
        setDrawing: (value: boolean) => { drawing.value = value; },
        updateSettings,
        addStroke,
        undoStroke,
        apply,
    };
}
