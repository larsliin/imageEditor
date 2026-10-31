<script setup lang="ts">
    import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
    import { drawBrushStroke, type BrushPoint, type BrushSettings, type BrushStroke } from '@/lib/brush';

    const props = defineProps<{
        disabled?: boolean
        image: ImageBitmap
        settings: BrushSettings
        strokes: readonly BrushStroke[]
    }>();

    const emit = defineEmits<{
        stroke: [stroke: BrushStroke]
        drawing: [value: boolean]
    }>();

    interface DraftStroke extends Omit<BrushStroke, 'points'> {
        points: BrushPoint[]
    }

    // Shift constrains the stroke to one axis from the last painted point.
    interface AxisLock {
        start: number
        axis: 'x' | 'y' | null
    }

    const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
    const committedCanvas = useTemplateRef<HTMLCanvasElement>('committed');
    const MIN_POINT_SPACING = 2;
    const cursor = shallowRef<{ x: number; y: number; diameter: number } | null>(null);
    const magnified = shallowRef(false);
    // Both layers are image-resolution and scaled by CSS like the preview canvas, so zooming never
    // re-rasterizes strokes and the preview uses the same pixels as export.
    let drawnStrokes: readonly BrushStroke[] = [];
    let activeStroke: DraftStroke | null = null;
    let axisLock: AxisLock | null = null;
    let lastPointer: BrushPoint | null = null;
    // Minimum distance between recorded points, in image pixels (2 screen pixels).
    let pointSpacing = 1;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;

    function fitToImage(element: HTMLCanvasElement) {
        if (element.width === props.image.width && element.height === props.image.height) return false;
        element.width = props.image.width;
        element.height = props.image.height;
        return true;
    }

    function drawActive() {
        cancelAnimationFrame(frame);
        frame = 0;
        const element = canvas.value;
        const context = element?.getContext('2d');
        if (!element || !context) return;
        if (!fitToImage(element)) context.clearRect(0, 0, element.width, element.height);
        if (activeStroke) drawBrushStroke(context, activeStroke);
    }

    function scheduleRedraw() {
        if (!frame) frame = requestAnimationFrame(drawActive);
    }

    function drawCommitted() {
        const element = committedCanvas.value;
        const context = element?.getContext('2d');
        if (!element || !context) return;
        const resized = fitToImage(element);
        // Adding a stroke only rasterizes the new one; undo or a new image repaints the layer.
        const appended = !resized
            && props.strokes.length >= drawnStrokes.length
            && drawnStrokes.every((stroke, index) => props.strokes[index] === stroke);
        if (!appended) context.clearRect(0, 0, element.width, element.height);
        for (const stroke of props.strokes.slice(appended ? drawnStrokes.length : 0)) drawBrushStroke(context, stroke);
        drawnStrokes = props.strokes;
    }

    function imagePoint(event: PointerEvent): { point: BrushPoint; bounds: DOMRect } | null {
        const element = canvas.value;
        const bounds = element?.getBoundingClientRect();
        if (!element || !bounds || bounds.width <= 0 || bounds.height <= 0) return null;
        const x = Math.max(0, Math.min(props.image.width, (event.clientX - bounds.left) * props.image.width / bounds.width));
        const y = Math.max(0, Math.min(props.image.height, (event.clientY - bounds.top) * props.image.height / bounds.height));
        return { point: { x, y }, bounds };
    }

    function updateCursor(event: PointerEvent) {
        const mapped = imagePoint(event);
        if (!mapped) return;
        cursor.value = {
            x: event.clientX - mapped.bounds.left,
            y: event.clientY - mapped.bounds.top,
            diameter: props.settings.thickness * mapped.bounds.width / props.image.width,
        };
    }

    function setAxisLock(locked: boolean) {
        if (!activeStroke || locked === Boolean(axisLock)) return;
        // Starting from the last painted point keeps the stroke continuous; releasing
        // resumes freehand from the last constrained point.
        axisLock = locked ? { start: activeStroke.points.length, axis: null } : null;
    }

    function extendStroke(point: BrushPoint, force = false) {
        if (!activeStroke) return;
        const points = activeStroke.points;
        let next = point;
        if (axisLock) {
            const anchor = points[axisLock.start - 1];
            if (!anchor) return;
            const dx = point.x - anchor.x;
            const dy = point.y - anchor.y;
            if (!axisLock.axis && (dx !== 0 || dy !== 0)) axisLock.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
            if (!axisLock.axis) return;
            // Locked points are painted like freehand ones, just projected onto the axis, so moving
            // back along the line keeps what was already painted.
            next = axisLock.axis === 'x' ? { x: point.x, y: anchor.y } : { x: anchor.x, y: point.y };
        }
        const previous = points.at(-1);
        const distance = previous ? Math.hypot(next.x - previous.x, next.y - previous.y) : Infinity;
        // Skipping tiny moves keeps whole-pixel pointer jitter from becoming stair steps.
        if (distance === 0 || (!force && distance <= pointSpacing)) return;
        points.push(next);
        scheduleRedraw();
    }

    function onKey(event: KeyboardEvent) {
        if (event.key !== 'Shift' || event.repeat) return;
        setAxisLock(event.type === 'keydown');
        if (lastPointer) extendStroke(lastPointer, true);
    }

    function startStroke(event: PointerEvent) {
        if (props.disabled || !event.isPrimary || event.button !== 0 || activeStroke) return;
        const mapped = imagePoint(event);
        const element = canvas.value;
        if (!mapped || !element) return;
        event.preventDefault();
        element.setPointerCapture(event.pointerId);
        activeStroke = { ...props.settings, points: [mapped.point] };
        emit('drawing', true);
        lastPointer = mapped.point;
        pointSpacing = MIN_POINT_SPACING * props.image.width / mapped.bounds.width;
        setAxisLock(event.shiftKey);
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKey);
        updateCursor(event);
        drawActive();
    }

    function moveStroke(event: PointerEvent) {
        if (props.disabled) return;
        updateCursor(event);
        if (!activeStroke) return;
        const mapped = imagePoint(event);
        if (!mapped) return;
        lastPointer = mapped.point;
        // Pointer modifier state resyncs the lock if a key event was missed (e.g. focus change).
        setAxisLock(event.shiftKey);
        extendStroke(mapped.point);
    }

    function finishStroke() {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        // Keep the true end point that point spacing may have skipped.
        if (lastPointer) extendStroke(lastPointer, true);
        axisLock = null;
        lastPointer = null;
        if (!activeStroke) return;
        const stroke = activeStroke;
        activeStroke = null;
        emit('drawing', false);
        // The parent appends the stroke synchronously, and the committed layer is drawn before paint.
        emit('stroke', stroke);
        drawActive();
    }

    function endStroke(event: PointerEvent) {
        const element = canvas.value;
        if (element?.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
        finishStroke();
    }

    function hideCursor() {
        if (!activeStroke) cursor.value = null;
    }

    onMounted(() => {
        const element = canvas.value;
        if (!element) return;
        // Only toggles pixelated scaling to match the preview; it never redraws strokes.
        resizeObserver = new ResizeObserver(() => {
            magnified.value = element.clientWidth > props.image.width;
        });
        resizeObserver.observe(element);
        window.addEventListener('blur', finishStroke);
        drawCommitted();
        drawActive();
    });

    onBeforeUnmount(() => {
        emit('drawing', false);
        resizeObserver?.disconnect();
        cancelAnimationFrame(frame);
        window.removeEventListener('blur', finishStroke);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
    });

    watch(() => [props.image, props.strokes], () => {
        drawCommitted();
        drawActive();
    });
</script>

<template>
    <Teleport defer to=".image-surface">
        <div class="brush-overlay" :inert="disabled" :class="{ 'is-magnified': magnified }">
            <canvas ref="committed" class="brush-overlay__canvas" aria-hidden="true"></canvas>
            <canvas
                ref="canvas"
                class="brush-overlay__canvas"
                aria-label="Brush painting surface. Use the pointer to paint on the image."
                @pointerdown="startStroke"
                @pointermove="moveStroke"
                @pointerup="endStroke"
                @pointercancel="endStroke"
                @lostpointercapture="finishStroke"
                @pointerleave="hideCursor"
            ></canvas>
            <span
                v-if="cursor"
                class="brush-overlay__cursor"
                :style="{
                    left: `${cursor.x}px`,
                    top: `${cursor.y}px`,
                    width: `${Math.max(4, cursor.diameter)}px`,
                    height: `${Math.max(4, cursor.diameter)}px`,
                }"
                aria-hidden="true"
            ></span>
        </div>
    </Teleport>
</template>

<style scoped>
.brush-overlay {
    position: absolute;
    z-index: 1;
    inset: 0;
    overflow: hidden;
    cursor: none;
    touch-action: none;
}

.brush-overlay__canvas {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
}

.brush-overlay.is-magnified .brush-overlay__canvas {
    image-rendering: pixelated;
}

.brush-overlay__cursor {
    position: absolute;
    border: 1px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px #111;
    pointer-events: none;
    transform: translate(-50%, -50%);
}
</style>
