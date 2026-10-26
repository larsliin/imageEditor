import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';

function isTextInput(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    );
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

    function onKeyDown(event: KeyboardEvent) {
        if (event.code !== 'Space' || isTextInput(event.target)) return;
        // Let Space still activate focused buttons; otherwise suppress page scrolling.
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        isSpaceHeld.value = true;
    }

    function onKeyUp(event: KeyboardEvent) {
        if (event.code === 'Space') isSpaceHeld.value = false;
    }

    function onBlur() {
        isSpaceHeld.value = false;
    }

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
