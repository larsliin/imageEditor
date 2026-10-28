<script setup lang="ts">
    import { nextTick, onBeforeUnmount, onMounted, useId, useTemplateRef } from 'vue';
    import { useDragOffset } from '@/composables/useDragOffset';
    import type { Point } from '@/lib/crop';

    const props = withDefaults(defineProps<{
        title: string
        applyLabel?: string
        canApply: boolean
        busy: boolean
        error?: string | null
        compact?: boolean
        focusTitle?: boolean
        draggable?: boolean
        wideOnShortScreens?: boolean
        scrollBody?: boolean
    }>(), {
        applyLabel: 'Apply',
        error: null,
        compact: false,
        focusTitle: false,
        draggable: true,
        wideOnShortScreens: false,
        scrollBody: false,
    });

    const emit = defineEmits<{
        apply: []
        cancel: []
    }>();

    const titleId = useId();
    const dialog = useTemplateRef<HTMLDialogElement>('dialog');
    const { offset, dragging, transform, onPointerDown, onPointerMove, onPointerEnd, nudge, reset } = useDragOffset({ clamp: clampOffset });
    // Minimum distance the grip keeps from the viewport edges so it stays reachable.
    const GRIP_MARGIN = 24;
    let previousFocus: HTMLElement | null = null;

    function clampOffset(next: Point): Point {
        const rect = dialog.value?.getBoundingClientRect();
        if (!rect) return next;
        const baseTop = rect.top - offset.value.y;
        const gripCenter = rect.left - offset.value.x + rect.width / 2;
        const limit = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
        return {
            x: limit(next.x, GRIP_MARGIN - gripCenter, window.innerWidth - GRIP_MARGIN - gripCenter),
            y: limit(next.y, -baseTop, window.innerHeight - GRIP_MARGIN * 2 - baseTop),
        };
    }

    function onGripMove(event: PointerEvent) {
        const { clientX: x, clientY: y } = event;
        if (dragging.value && (y < 0 || x < 0 || x > window.innerWidth || y > window.innerHeight)) {
            onPointerEnd(event);
            return;
        }
        onPointerMove(event);
    }

    function keepInViewport() {
        nudge(0, 0);
    }

    function moveWithKeyboard(event: KeyboardEvent) {
        const step = event.shiftKey ? 50 : 10;
        const moves: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
        };
        if (event.key === 'Home') {
            event.preventDefault();
            reset();
        } else {
            const move = moves[event.key];
            if (!move) return;
            event.preventDefault();
            nudge(...move);
        }
    }

    onMounted(() => {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.value?.showModal();
        if (props.draggable) window.addEventListener('resize', keepInViewport);
    });

    onBeforeUnmount(() => {
        window.removeEventListener('resize', keepInViewport);
        dialog.value?.close();
        void nextTick(() => {
            if (previousFocus?.isConnected) previousFocus.focus();
        });
    });

    function apply() {
        if (!props.busy && props.canApply) emit('apply');
    }

    function cancel() {
        if (!props.busy) emit('cancel');
    }
</script>

<template>
    <Teleport to="body">
        <dialog
            ref="dialog"
            class="tool-modal"
            :class="{
                'tool-modal--compact': compact,
                'tool-modal--static': !draggable,
                'tool-modal--wide-on-short-screens': wideOnShortScreens,
                'tool-modal--scroll-body': scrollBody,
                'is-dragging': dragging,
            }"
            :style="{ transform }"
            :aria-labelledby="titleId"
            @cancel.prevent="cancel"
            @keydown.esc.stop.prevent="cancel"
        >
            <form class="tool-modal__form" :aria-busy="busy" @submit.prevent="apply">
                <header class="tool-modal__header">
                    <h2 :id="titleId" class="tool-modal__title" :tabindex="focusTitle ? -1 : undefined" :autofocus="focusTitle">{{ title }}</h2>
                    <button v-if="draggable" type="button" class="tool-modal__grip"
                        :aria-label="`Move ${title} dialog. Use arrow keys to move; Home resets the position.`"
                        title="Drag to move; double-click to reset"
                        @pointerdown="onPointerDown"
                        @pointermove="onGripMove"
                        @pointerup="onPointerEnd"
                        @pointercancel="onPointerEnd"
                        @lostpointercapture="onPointerEnd"
                        @dblclick="reset"
                        @keydown="moveWithKeyboard"
                    >
                        <i class="bi bi-grip-horizontal tool-modal__grip-icon" aria-hidden="true"></i>
                    </button>
                </header>
                <fieldset class="tool-modal__fields" :disabled="busy">
                    <slot />
                </fieldset>
                <p v-if="error" class="tool-modal__error" role="alert">{{ error }}</p>
                <p v-if="busy" class="tool-modal__status" role="status">Processing image...</p>
                <footer class="tool-modal__actions">
                    <button type="button" class="tool-modal__button" :disabled="busy" @click="cancel">Cancel</button>
                    <button type="submit" class="tool-modal__button tool-modal__button--apply" :disabled="busy || !canApply">
                        {{ applyLabel }}
                    </button>
                </footer>
            </form>
        </dialog>
    </Teleport>
</template>

<style scoped>
.tool-modal {
    width: min(420px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    margin: auto;
    padding: 0;
    overflow: auto;
    color: var(--color-text);
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 16px 48px rgb(0 0 0 / 50%);
}

.tool-modal::backdrop {
    background: transparent;
}

.tool-modal__form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 24px;
}

.tool-modal__title {
    font-size: 18px;
    font-weight: 600;
}

.tool-modal--scroll-body {
    overflow: hidden;
}

.tool-modal--scroll-body .tool-modal__form {
    max-height: calc(100dvh - 34px);
}

.tool-modal--scroll-body .tool-modal__fields {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
}

.tool-modal--scroll-body .tool-modal__form > :not(.tool-modal__fields) {
    flex-shrink: 0;
}

@media (min-width: 640px) and (max-height: 740px) {
    .tool-modal--wide-on-short-screens {
        width: 560px;
    }
}

.tool-modal__header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.tool-modal.is-dragging .tool-modal__grip {
    cursor: grabbing;
}

.tool-modal__grip {
    position: absolute;
    /* Sits just below the dialog's top edge; offsets the form's top padding. */
    top: -20px;
    left: 50%;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 40px;
    height: 24px;
    padding: 0;
    color: var(--color-text-muted);
    background: transparent;
    border: 0;
    border-radius: 6px;
    transform: translateX(-50%);
    cursor: grab;
    touch-action: none;
    user-select: none;
}

.tool-modal__grip:hover {
    color: var(--color-text);
}

.tool-modal__grip-icon {
    font-size: 20px;
    line-height: 1;
    pointer-events: none;
}

.tool-modal__grip:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
}

.tool-modal--compact .tool-modal__form {
    gap: 18px;
    padding: 22px 20px;
}

.tool-modal--compact .tool-modal__grip {
    top: -21px;
}

.tool-modal--compact.tool-modal--static .tool-modal__form {
    padding-top: 20px;
}

@media (max-height: 500px) {
    .tool-modal--compact .tool-modal__form,
    .tool-modal--compact.tool-modal--static .tool-modal__form {
        gap: 12px;
        padding: 16px;
    }

    .tool-modal--compact .tool-modal__grip {
        top: -15px;
    }
}

.tool-modal__fields {
    min-width: 0;
    padding: 0;
    border: 0;
}

.tool-modal__error {
    color: #fecaca;
}

.tool-modal__status {
    color: var(--color-text-muted);
}

.tool-modal__actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
}

.tool-modal__button {
    min-height: 34px;
    padding: 6px 12px;
    background: var(--color-button-secondary);
    border: 1px solid var(--color-button-secondary-border);
    border-radius: var(--radius-button);
    cursor: pointer;
}

.tool-modal__button--apply {
    color: #fff;
    background: var(--color-accent);
    border-color: transparent;
}

.tool-modal__button:hover:not(:disabled) {
    filter: brightness(1.15);
}

.tool-modal__button:not(.tool-modal__button--apply):hover:not(:disabled) {
    background: var(--color-button-secondary-hover);
    border-color: var(--color-button-secondary-border-hover);
    filter: none;
}

.tool-modal__button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.tool-modal__button:not(.tool-modal__button--apply):disabled {
    opacity: var(--opacity-button-secondary-disabled);
}

.tool-modal__button:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
}
</style>
