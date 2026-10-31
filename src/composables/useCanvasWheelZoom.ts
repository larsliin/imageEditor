import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { isZoomWheel } from '../lib/shortcuts.ts';

export interface WheelZoomAnchor {
    clientX: number
    clientY: number
    imageX: number
    imageY: number
}

export function useCanvasWheelZoom(
    viewportRef: Readonly<Ref<HTMLElement | null>>,
    imageSurfaceRef: Readonly<Ref<HTMLElement | null>>,
    hasImage: () => boolean,
    // eslint-disable-next-line no-unused-vars
    zoomAtPointer: (event: WheelEvent, anchor: WheelZoomAnchor | null) => void,
) {
    function handleWheel(event: WheelEvent) {
        if (!isZoomWheel(event)) return;
        event.preventDefault();
        if (event.deltaY === 0) return;

        const viewport = viewportRef.value;
        const bounds = imageSurfaceRef.value?.getBoundingClientRect();
        const scrollable = viewport
            && (viewport.scrollWidth > viewport.clientWidth || viewport.scrollHeight > viewport.clientHeight);
        // Capture image-relative pointer coordinates only when the viewport is scrollable.
        const anchor = bounds && bounds.width > 0 && bounds.height > 0 && scrollable ? {
            clientX: event.clientX,
            clientY: event.clientY,
            imageX: (event.clientX - bounds.left) / bounds.width,
            imageY: (event.clientY - bounds.top) / bounds.height,
        } : null;
        zoomAtPointer(event, anchor);
    }

    // Dialogs make the canvas inert; route wheel zoom here when it cannot reach the viewport.
    function handleModalWheel(event: WheelEvent) {
        if (!isZoomWheel(event) || !hasImage()) return;
        const viewport = viewportRef.value;
        if (!viewport || !(event.target instanceof Node) || viewport.contains(event.target)) return;
        const overDialog = event.target instanceof Element && event.target.closest('dialog[open]') !== null;
        const bounds = viewport.getBoundingClientRect();
        const overInertViewport = viewport.closest('[inert]') !== null
            && event.clientX >= bounds.left && event.clientX <= bounds.right
            && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
        if (overDialog || overInertViewport) handleWheel(event);
    }

    onMounted(() => window.addEventListener('wheel', handleModalWheel, { passive: false }));
    onBeforeUnmount(() => window.removeEventListener('wheel', handleModalWheel));

    return { handleWheel };
}
