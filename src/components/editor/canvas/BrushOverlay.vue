<script setup lang="ts">
    import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
    import { drawBrushStroke, type BrushPoint, type BrushSettings, type BrushStroke } from '@/lib/brush';

    const props = defineProps<{
        image: ImageBitmap
        settings: BrushSettings
        strokes: readonly BrushStroke[]
    }>();

    const emit = defineEmits<{
        stroke: [stroke: BrushStroke]
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
    const cursor = shallowRef<{ x: number; y: number; diameter: number } | null>(null);
    // Committed strokes are rasterized once per change, not on every pointer move.
    const committedLayer = document.createElement('canvas');
    let committedValid = false;
    let activeStroke: DraftStroke | null = null;
    let axisLock: AxisLock | null = null;
    let lastPointer: BrushPoint | null = null;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;

    function redraw() {
        cancelAnimationFrame(frame);
        frame = 0;
        const element = canvas.value;
        const context = element?.getContext('2d');
        const layer = committedLayer.getContext('2d');
        if (!element || !context || !layer || props.image.width <= 0 || props.image.height <= 0) return;

        const bounds = element.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return;
        const pixelRatio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(bounds.width * pixelRatio));
        const height = Math.max(1, Math.round(bounds.height * pixelRatio));
        if (element.width !== width || element.height !== height) {
            element.width = width;
            element.height = height;
            committedLayer.width = width;
            committedLayer.height = height;
            committedValid = false;
        }

        const scale = bounds.width / props.image.width;
        if (!committedValid) {
            layer.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            layer.clearRect(0, 0, bounds.width, bounds.height);
            for (const stroke of props.strokes) drawBrushStroke(layer, stroke, scale);
            committedValid = true;
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, width, height);
        context.drawImage(committedLayer, 0, 0);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        if (activeStroke) drawBrushStroke(context, activeStroke, scale);
    }

    function scheduleRedraw() {
        if (!frame) frame = requestAnimationFrame(redraw);
    }

    function invalidateCommitted() {
        committedValid = false;
        redraw();
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
        // leaves the constrained end point in place and freehand resumes from it.
        axisLock = locked ? { start: activeStroke.points.length, axis: null } : null;
    }

    function extendStroke(point: BrushPoint) {
        if (!activeStroke) return;
        const points = activeStroke.points;
        if (!axisLock) {
            const previous = points.at(-1);
            if (previous && previous.x === point.x && previous.y === point.y) return;
            points.push(point);
        } else {
            const anchor = points[axisLock.start - 1];
            if (!anchor) return;
            const dx = point.x - anchor.x;
            const dy = point.y - anchor.y;
            if (!axisLock.axis && (dx !== 0 || dy !== 0)) axisLock.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
            if (!axisLock.axis) return;
            // A locked segment is a single line from the anchor, replaced as the pointer moves.
            points.length = axisLock.start;
            points.push(axisLock.axis === 'x' ? { x: point.x, y: anchor.y } : { x: anchor.x, y: point.y });
        }
        scheduleRedraw();
    }

    function onKey(event: KeyboardEvent) {
        if (event.key !== 'Shift' || event.repeat) return;
        setAxisLock(event.type === 'keydown');
        if (lastPointer) extendStroke(lastPointer);
    }

    function startStroke(event: PointerEvent) {
        if (!event.isPrimary || event.button !== 0 || activeStroke) return;
        const mapped = imagePoint(event);
        const element = canvas.value;
        if (!mapped || !element) return;
        event.preventDefault();
        element.setPointerCapture(event.pointerId);
        activeStroke = { ...props.settings, points: [mapped.point] };
        lastPointer = mapped.point;
        setAxisLock(event.shiftKey);
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKey);
        updateCursor(event);
        redraw();
    }

    function moveStroke(event: PointerEvent) {
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
        axisLock = null;
        lastPointer = null;
        if (!activeStroke) return;
        const stroke = activeStroke;
        activeStroke = null;
        emit('stroke', stroke);
        redraw();
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
        if (!element?.parentElement) return;
        resizeObserver = new ResizeObserver(redraw);
        resizeObserver.observe(element.parentElement);
        window.addEventListener('blur', finishStroke);
        redraw();
    });

    onBeforeUnmount(() => {
        resizeObserver?.disconnect();
        cancelAnimationFrame(frame);
        window.removeEventListener('blur', finishStroke);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        committedLayer.width = 0;
        committedLayer.height = 0;
    });

    watch(() => [props.image, props.strokes], invalidateCommitted);
</script>

<template>
    <Teleport defer to=".image-surface">
        <div class="brush-overlay">
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
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
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
