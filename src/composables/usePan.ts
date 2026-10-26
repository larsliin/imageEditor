import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';

const NON_TEXT_INPUT_TYPES = ['button', 'checkbox', 'radio', 'range', 'reset', 'submit'];

function isTextInput(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.includes(target.type);
    return target.isContentEditable || ['TEXTAREA', 'SELECT'].includes(target.tagName);
}

// Buttons, checkboxes, etc. that Space would otherwise activate.
function isControl(target: EventTarget | null): boolean {
    return target instanceof HTMLButtonElement || target instanceof HTMLInputElement;
}

/**
 * Drag-to-pan for a scroll container. Panning is active while `enabled` is true
 * (e.g. the Pan tool is selected) or while Space is held, like Photoshop.
 */
export function usePan(
    container: Readonly<Ref<HTMLElement | null>>,
    options: { enabled: MaybeRefOrGetter<boolean>; available: MaybeRefOrGetter<boolean> },
) {
    const isSpaceHeld = ref(false);
    const isDragging = ref(false);

    const isPanMode = computed(
        () => toValue(options.available) && (toValue(options.enabled) || isSpaceHeld.value),
    );

    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    function onPointerDown(event: PointerEvent) {
        const element = container.value;
        if (!element || !isPanMode.value || event.button !== 0) return;
        event.preventDefault();
        pointerId = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        element.setPointerCapture(event.pointerId);
        isDragging.value = true;
    }

    function onPointerMove(event: PointerEvent) {
        const element = container.value;
        if (!element || event.pointerId !== pointerId) return;
        element.scrollLeft -= event.clientX - lastX;
        element.scrollTop -= event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
    }

    function endDrag(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;
        if (container.value?.hasPointerCapture(event.pointerId)) {
            container.value.releasePointerCapture(event.pointerId);
        }
        pointerId = null;
        isDragging.value = false;
    }

    // Tracks whether focus last moved via pointer (true) or Tab navigation (false).
    let focusedByPointer = false;

    function onAnyPointerDown() {
        focusedByPointer = true;
    }

    function onKeyDown(event: KeyboardEvent) {
        if (event.code !== 'Space') {
            if (event.key === 'Tab') focusedByPointer = false;
            return;
        }
        if (isTextInput(event.target)) return;
        if (!isSpaceHeld.value && isControl(event.target) && !focusedByPointer) return;
        // Suppress page scrolling and click activation of mouse-focused controls.
        event.preventDefault();
        isSpaceHeld.value = true;
    }

    function onKeyUp(event: KeyboardEvent) {
        if (event.code !== 'Space' || !isSpaceHeld.value) return;
        event.preventDefault();
        isSpaceHeld.value = false;
    }

    function onBlur() {
        isSpaceHeld.value = false;
    }

    window.addEventListener('pointerdown', onAnyPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    watch(
        container,
        (element, previous) => {
            previous?.removeEventListener('pointerdown', onPointerDown);
            previous?.removeEventListener('pointermove', onPointerMove);
            previous?.removeEventListener('pointerup', endDrag);
            previous?.removeEventListener('pointercancel', endDrag);
            element?.addEventListener('pointerdown', onPointerDown);
            element?.addEventListener('pointermove', onPointerMove);
            element?.addEventListener('pointerup', endDrag);
            element?.addEventListener('pointercancel', endDrag);
        },
        { immediate: true },
    );

    onScopeDispose(() => {
        window.removeEventListener('pointerdown', onAnyPointerDown, true);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        const element = container.value;
        element?.removeEventListener('pointerdown', onPointerDown);
        element?.removeEventListener('pointermove', onPointerMove);
        element?.removeEventListener('pointerup', endDrag);
        element?.removeEventListener('pointercancel', endDrag);
    });

    return { isPanMode, isDragging };
}
