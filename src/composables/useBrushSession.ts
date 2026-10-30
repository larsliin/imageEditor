import { computed, readonly, shallowRef } from 'vue';
import { DEFAULT_BRUSH_SETTINGS, type BrushSettings, type BrushStroke } from '@/lib/brush';
import { usePendingEdits, type PendingEditAction } from './usePendingEdits';

export type BrushAction = PendingEditAction;
/* eslint-disable no-unused-vars */
type BrushActionHandler = (action: PendingEditAction) => Promise<void>;
type BrushStrokeApplier = (strokes: readonly BrushStroke[]) => Promise<boolean>;
/* eslint-enable no-unused-vars */

export function useBrushSession() {
    const settings = shallowRef<BrushSettings>({ ...DEFAULT_BRUSH_SETTINGS });
    const strokes = shallowRef<BrushStroke[]>([]);
    const hasPending = computed(() => strokes.value.length > 0);
    const pending = usePendingEdits(hasPending, () => { strokes.value = []; });

    function updateSettings(value: BrushSettings) {
        settings.value = value;
    }

    function addStroke(stroke: BrushStroke) {
        strokes.value = [...strokes.value, stroke];
    }

    async function applyAndContinue(
        applyStrokes: BrushStrokeApplier,
        performAction: BrushActionHandler,
        onApplied: () => void,
    ) {
        await pending.applyAndContinue(() => applyStrokes(strokes.value), performAction, onApplied);
    }

    return {
        settings: readonly(settings),
        strokes: readonly(strokes),
        hasPending,
        ...pending,
        updateSettings,
        addStroke,
        applyAndContinue,
    };
}
