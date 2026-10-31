import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import {
    canZoomIn as canZoomInFrom,
    canZoomOut as canZoomOutFrom,
    fitZoom,
    nextZoomIn,
    nextZoomOut,
    type Size,
} from '../lib/zoom.ts';

/**
 * Easing function: ease-out cubic
 * Progress: 0–1
 * Returns: 0–1 with ease-out behavior
 */
function easeOutCubic(progress: number): number {
    return 1 - Math.pow(1 - progress, 3);
}

interface ZoomAnimation {
    startZoom: number
    targetZoom: number
    startTime: number
    duration: number
}

interface UseAnimatedZoomOptions {
    animationDuration?: number
    animationsEnabled?: MaybeRefOrGetter<boolean>
}

/**
 * Provides smooth animated zoom with:
 * - 200–250 ms animation duration
 * - Ease-out easing
 * - Pointer-anchored zoom (cursor stays stable)
 * - Center-anchored zoom (viewport center stays stable)
 * - Cancellable animations (next zoom input interrupts)
 * - Live zoom % display during animation
 *
 * Extends useZoom with animation layer on top of discrete zoom steps.
 */
export function useAnimatedZoom(
    imageSize: Ref<Size | null>,
    viewportSize: Ref<Size>,
    sourceId: Ref<number>,
    options: number | UseAnimatedZoomOptions = 225,
) {
    const animationDuration = typeof options === 'number' ? options : options.animationDuration ?? 225;
    const animationsEnabled = typeof options === 'number' ? true : options.animationsEnabled ?? true;
    const fitMode = ref(true);
    const capInitialFit = ref(true);
    const manualZoom = ref(1);

    // Animation state
    const animationState = ref<ZoomAnimation | null>(null);
    const animationFrameId = ref<number | null>(null);
    // State value that triggers re-evaluation of computed zoom during animation
    const animationTick = ref(0);

    const fit = computed(() =>
        imageSize.value ? fitZoom(imageSize.value, viewportSize.value) : 1,
    );

    // Animated zoom: blends between start and target during animation
    const animatedZoom = computed(() => {
        // Read the animation tick to ensure re-evaluation on each frame
        animationTick.value;

        const animation = animationState.value;
        if (!animation) return null;

        const now = performance.now();
        const elapsed = Math.min(now - animation.startTime, animation.duration);
        const progress = elapsed / animation.duration;
        const eased = easeOutCubic(progress);

        return animation.startZoom + (animation.targetZoom - animation.startZoom) * eased;
    });

    const zoom = computed(() => {
        const animated = animatedZoom.value;
        if (animated !== null) return animated;

        return fitMode.value ? (capInitialFit.value ? Math.min(1, fit.value) : fit.value) : manualZoom.value;
    });

    // For display and calculation purposes: target zoom when animating, current zoom when idle
    // Used for: zoom % display in UI, canZoomIn/canZoomOut checks, next zoom step calculation
    const targetZoom = computed(() => {
        const animation = animationState.value;
        if (animation) return animation.targetZoom;

        return zoom.value;
    });

    const isFit = computed(() => fitMode.value && zoom.value === fit.value);
    const canZoomIn = computed(() => imageSize.value !== null && canZoomInFrom(targetZoom.value));
    const canZoomOut = computed(() => imageSize.value !== null && canZoomOutFrom(targetZoom.value));
    const isAnimating = computed(() => animationState.value !== null);

    function cancelAnimation() {
        if (animationFrameId.value !== null) {
            cancelAnimationFrame(animationFrameId.value);
            animationFrameId.value = null;
        }
        if (animationState.value) {
            // Snap to target on cancellation
            manualZoom.value = animationState.value.targetZoom;
            animationState.value = null;
            animationTick.value = 0;
        }
    }

    function finishAnimation() {
        const animation = animationState.value;
        if (!animation) return;
        if (animationFrameId.value !== null) {
            cancelAnimationFrame(animationFrameId.value);
            animationFrameId.value = null;
        }
        manualZoom.value = animation.targetZoom;
        fitMode.value = false;
        animationState.value = null;
        animationTick.value = 0;
    }

    function startAnimation(targetZoom: number) {
        const startZoom = zoom.value;

        // Cancel previous animation
        cancelAnimation();

        // No animation needed if already at target
        if (Math.abs(startZoom - targetZoom) < 1e-6 || !toValue(animationsEnabled)) {
            manualZoom.value = targetZoom;
            fitMode.value = false;
            return;
        }

        animationState.value = {
            startZoom,
            targetZoom,
            startTime: performance.now(),
            duration: animationDuration,
        };

        function frame() {
            const animation = animationState.value;
            if (!animation) return;

            const now = performance.now();
            const elapsed = now - animation.startTime;

            if (elapsed >= animation.duration) {
                // Animation complete
                finishAnimation();
            } else {
                // Trigger computed re-evaluation and continue animation
                animationTick.value += 1;
                animationFrameId.value = requestAnimationFrame(frame);
            }
        }

        animationFrameId.value = requestAnimationFrame(frame);
    }

    function setZoom(value: number) {
        manualZoom.value = value;
        fitMode.value = false;
    }

    function zoomIn() {
        if (canZoomIn.value) {
            const nextTarget = nextZoomIn(targetZoom.value);
            startAnimation(nextTarget);
        }
    }

    function zoomOut() {
        if (canZoomOut.value) {
            const nextTarget = nextZoomOut(targetZoom.value);
            startAnimation(nextTarget);
        }
    }

    function fitToView() {
        capInitialFit.value = false;
        cancelAnimation();

        const fitTarget = fit.value;
        if (Math.abs(zoom.value - fitTarget) > 1e-6) {
            startAnimation(fitTarget);
        }

        fitMode.value = true;
    }

    function actualSize() {
        if (imageSize.value) {
            cancelAnimation();

            if (Math.abs(zoom.value - 1) > 1e-6) {
                startAnimation(1);
            } else {
                manualZoom.value = 1;
                fitMode.value = false;
            }
        }
    }

    watch(
        () => toValue(animationsEnabled),
        (enabled) => {
            if (!enabled) finishAnimation();
        },
        { flush: 'sync' },
    );

    watch([imageSize, sourceId], ([nextSize, nextSourceId], [previousSize, previousSourceId]) => {
        if (nextSourceId !== previousSourceId || !nextSize || !previousSize) {
            cancelAnimation();
            capInitialFit.value = true;
            fitMode.value = true;
        }
    });

    // Cleanup on unmount
    watch(
        () => sourceId.value,
        () => cancelAnimation(),
        { flush: 'post' },
    );

    return {
        zoom,
        targetZoom,
        isFit,
        canZoomIn,
        canZoomOut,
        zoomIn,
        zoomOut,
        fitToView,
        actualSize,
        setZoom,
        isAnimating,
        cancelAnimation,
    };
}
