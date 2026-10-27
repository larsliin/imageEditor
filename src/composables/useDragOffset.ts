import { computed, shallowRef } from 'vue';
import type { Point } from '@/lib/crop';

/** Tracks an unbounded pointer-drag offset; elements may be moved outside the window. */
export function useDragOffset(options: { onEnd?: () => void } = {}) {
    const offset = shallowRef<Point>({ x: 0, y: 0 });
    const dragging = shallowRef(false);
    let pointerId: number | null = null;
    let origin: Point = { x: 0, y: 0 };
    let startOffset: Point = { x: 0, y: 0 };

    function onPointerDown(event: PointerEvent) {
        if (pointerId !== null || event.button !== 0 || !(event.currentTarget instanceof Element)) return;
        event.preventDefault();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Capture can fail for inactive pointers; dragging still works while over the grip.
        }
        pointerId = event.pointerId;
        origin = { x: event.clientX, y: event.clientY };
        startOffset = offset.value;
        dragging.value = true;
    }

    function onPointerMove(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;
        offset.value = {
            x: startOffset.x + event.clientX - origin.x,
            y: startOffset.y + event.clientY - origin.y,
        };
    }

    function onPointerEnd(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;
        if (event.currentTarget instanceof Element && event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        pointerId = null;
        dragging.value = false;
        options.onEnd?.();
    }

    function nudge(dx: number, dy: number) {
        offset.value = { x: offset.value.x + dx, y: offset.value.y + dy };
    }

    function reset() {
        offset.value = { x: 0, y: 0 };
    }

    return {
        offset: computed(() => offset.value),
        dragging: computed(() => dragging.value),
        transform: computed(() => `translate(${offset.value.x}px, ${offset.value.y}px)`),
        onPointerDown,
        onPointerMove,
        onPointerEnd,
        nudge,
        reset,
    };
}
