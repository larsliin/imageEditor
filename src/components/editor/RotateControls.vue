<script setup lang="ts">
    import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';
    import type { QuarterTurns } from '@/lib/rotate';
    import FloatingToolbar from './FloatingToolbar.vue';

    const props = defineProps<{
        disabled: boolean
        error: string | null
    }>();

    const emit = defineEmits<{
        preview: [turns: QuarterTurns]
        apply: [turns: QuarterTurns]
        cancel: []
    }>();

    const turns = shallowRef<QuarterTurns>(0);
    const clockwise = useTemplateRef<HTMLButtonElement>('clockwise');
    let previousFocus: HTMLElement | null = null;

    onMounted(() => {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        clockwise.value?.focus();
    });

    onBeforeUnmount(() => {
        void nextTick(() => {
            if (previousFocus?.isConnected) previousFocus.focus();
        });
    });

    function rotate(direction: 1 | -1) {
        if (props.disabled) return;
        const rotations: readonly QuarterTurns[] = [0, 1, 2, 3];
        turns.value = rotations[(turns.value + direction + 4) % 4]!;
        emit('preview', turns.value);
    }

    function apply() {
        if (!props.disabled && turns.value !== 0) emit('apply', turns.value);
    }

    function cancel() {
        if (!props.disabled) emit('cancel');
    }
</script>

<template>
    <Teleport defer to="#editor-tool-controls">
        <FloatingToolbar label="Rotate toolbar" @keydown.esc.stop.prevent="cancel">
            <form class="rotate-form" aria-label="Rotate image" :aria-busy="disabled" @submit.prevent="apply">
                <fieldset class="rotate-controls" :disabled="disabled">
                    <button ref="clockwise" type="button" class="icon-button rotate-button" aria-label="Rotate clockwise"
                        title="Rotate 90 degrees clockwise" @click="rotate(1)">
                        <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
                        Clockwise
                    </button>
                    <button type="button" class="icon-button rotate-button" aria-label="Rotate counterclockwise"
                        title="Rotate 90 degrees counterclockwise" @click="rotate(-1)">
                        <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                        Counterclockwise
                    </button>
                    <span class="rotate-divider" role="separator" aria-orientation="vertical"></span>
                    <button type="submit" class="icon-button icon-button--apply" aria-label="Apply rotation"
                        title="Apply rotation" :disabled="turns === 0">
                        <i class="bi bi-check-lg" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="icon-button" aria-label="Cancel rotation" title="Cancel rotation" @click="cancel">
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </fieldset>
                <p v-if="error" class="rotate-error" role="alert">{{ error }}</p>
                <p v-if="disabled" class="rotate-status" role="status">Processing image...</p>
            </form>
        </FloatingToolbar>
    </Teleport>
</template>

<style scoped>
.rotate-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.rotate-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
}

.rotate-divider {
    height: 24px;
    border-left: 1px solid var(--color-border);
}

.icon-button {
    width: 30px;
    height: 30px;
    padding: 0;
    color: var(--color-text);
    background: var(--color-button-secondary);
    border: 1px solid var(--color-button-secondary-border);
    border-radius: var(--radius-button);
    font: inherit;
    cursor: pointer;
}

.icon-button--apply {
    color: #fff;
    background: var(--color-accent);
}

.rotate-button {
    display: flex;
    align-items: center;
    gap: 6px;
    width: auto;
    padding: 4px 8px;
    font-size: 12px;
}

.icon-button:hover:not(:disabled) {
    filter: brightness(1.15);
}

.icon-button:not(.icon-button--apply):hover:not(:disabled) {
    background: var(--color-button-secondary-hover);
    border-color: var(--color-button-secondary-border-hover);
    filter: none;
}

.icon-button:disabled {
    opacity: var(--opacity-button-secondary-disabled);
    cursor: not-allowed;
}

.icon-button:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
}

.rotate-error {
    max-width: 400px;
    white-space: normal;
    color: #fecaca;
}

.rotate-status {
    color: var(--color-text-muted);
}
</style>
