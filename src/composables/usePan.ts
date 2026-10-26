import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';

const NON_TEXT_INPUT_TYPES = ['button', 'checkbox', 'radio', 'range', 'reset', 'submit'];
const SAMPLE_WINDOW_MS = 100;
const MOMENTUM_DECAY_MS = 240;
const MIN_SPEED = 0.02;
const MAX_SPEED = 3;

interface PanSample {
    x: number;
    y: number;
    time: number;
}

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
    let samples: PanSample[] = [];
    let animationFrame: number | null = null;

    function stopMomentum() {
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    function recordSample(event: PointerEvent) {
        samples.push({ x: event.clientX, y: event.clientY, time: event.timeStamp });
        while (samples.length > 2 && samples[1]!.time < event.timeStamp - SAMPLE_WINDOW_MS) {
            samples.shift();
        }
    }

    function startMomentum(event: PointerEvent) {
        const first = samples[0];
        const last = samples.at(-1);
        if (!first || !last || event.timeStamp - last.time > 80
            || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const elapsed = event.timeStamp - first.time;
        if (elapsed <= 0) return;
        let velocityX = (first.x - event.clientX) / elapsed;
        let velocityY = (first.y - event.clientY) / elapsed;
        const speed = Math.hypot(velocityX, velocityY);
        if (speed < MIN_SPEED) return;
        if (speed > MAX_SPEED) {
            velocityX *= MAX_SPEED / speed;
            velocityY *= MAX_SPEED / speed;
        }

        let previousTime = performance.now();
        function animate(time: number) {
            animationFrame = null;
            const element = container.value;
            if (!element) return;
            const decay = Math.exp(-(time - previousTime) / MOMENTUM_DECAY_MS);
            const distance = MOMENTUM_DECAY_MS * (1 - decay);
            const maxX = Math.max(0, element.scrollWidth - element.clientWidth);
            const maxY = Math.max(0, element.scrollHeight - element.clientHeight);
            element.scrollLeft = Math.max(0, Math.min(maxX, element.scrollLeft + velocityX * distance));
            element.scrollTop = Math.max(0, Math.min(maxY, element.scrollTop + velocityY * distance));
            velocityX = (velocityX < 0 && element.scrollLeft <= 0) || (velocityX > 0 && element.scrollLeft >= maxX)
                ? 0 : velocityX * decay;
            velocityY = (velocityY < 0 && element.scrollTop <= 0) || (velocityY > 0 && element.scrollTop >= maxY)
                ? 0 : velocityY * decay;
            previousTime = time;
            if (Math.hypot(velocityX, velocityY) >= MIN_SPEED) animationFrame = requestAnimationFrame(animate);
        }
        animationFrame = requestAnimationFrame(animate);
    }

    function onPointerDown(event: PointerEvent) {
        const element = container.value;
        if (!element || !isPanMode.value || event.button !== 0 || pointerId !== null) return;
        event.preventDefault();
        stopMomentum();
        pointerId = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        samples = [];
        recordSample(event);
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
        recordSample(event);
    }

    function cancelDrag(element = container.value) {
        const capturedPointer = pointerId;
        pointerId = null;
        isDragging.value = false;
        if (capturedPointer !== null && element?.hasPointerCapture(capturedPointer)) {
            element.releasePointerCapture(capturedPointer);
        }
        samples = [];
    }

    function endDrag(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;
        if (event.type === 'pointerup') startMomentum(event);
        else stopMomentum();
        cancelDrag();
    }

    // Tracks whether focus last moved via pointer (true) or Tab navigation (false).
    let focusedByPointer = false;

    function onAnyPointerDown() {
        focusedByPointer = true;
        stopMomentum();
    }

    function onKeyDown(event: KeyboardEvent) {
        // Holding Space repeats keydown; this continues the pan gesture, not a new interaction.
        if (event.code === 'Space' && event.repeat && isSpaceHeld.value) {
            event.preventDefault();
            return;
        }
        stopMomentum();
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
        stopMomentum();
        cancelDrag();
        isSpaceHeld.value = false;
    }

    function onVisibilityChange() {
        if (document.hidden) onBlur();
    }

    window.addEventListener('pointerdown', onAnyPointerDown, true);
    window.addEventListener('wheel', stopMomentum, { capture: true, passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    watch(
        [() => toValue(options.enabled), () => toValue(options.available)],
        () => {
            stopMomentum();
            cancelDrag();
        },
        { flush: 'sync' },
    );

    watch(
        container,
        (element, previous) => {
            stopMomentum();
            cancelDrag(previous);
            previous?.removeEventListener('pointerdown', onPointerDown);
            previous?.removeEventListener('pointermove', onPointerMove);
            previous?.removeEventListener('pointerup', endDrag);
            previous?.removeEventListener('pointercancel', endDrag);
            previous?.removeEventListener('lostpointercapture', endDrag);
            element?.addEventListener('pointerdown', onPointerDown);
            element?.addEventListener('pointermove', onPointerMove);
            element?.addEventListener('pointerup', endDrag);
            element?.addEventListener('pointercancel', endDrag);
            element?.addEventListener('lostpointercapture', endDrag);
        },
        { immediate: true },
    );

    onScopeDispose(() => {
        stopMomentum();
        cancelDrag();
        window.removeEventListener('pointerdown', onAnyPointerDown, true);
        window.removeEventListener('wheel', stopMomentum, true);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        const element = container.value;
        element?.removeEventListener('pointerdown', onPointerDown);
        element?.removeEventListener('pointermove', onPointerMove);
        element?.removeEventListener('pointerup', endDrag);
        element?.removeEventListener('pointercancel', endDrag);
        element?.removeEventListener('lostpointercapture', endDrag);
    });

    return { isPanMode, isDragging, stopMomentum };
}
