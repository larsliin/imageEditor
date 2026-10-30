<script setup lang="ts">
    import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';
    import type { QuarterTurns } from '@/lib/rotate';
    import FloatingToolbar from '../chrome/FloatingToolbar.vue';
    import BaseButton from '@/components/bascomponents/BaseButton.vue';

    const props = defineProps<{
        disabled: boolean
        error: string | null
    }>();

    const emit = defineEmits<{
        preview: [turns: QuarterTurns, flipH: boolean, flipV: boolean]
        apply: [turns: QuarterTurns, flipH: boolean, flipV: boolean]
        cancel: []
    }>();

    const turns = shallowRef<QuarterTurns>(0);
    const flipH = shallowRef(false);
    const flipV = shallowRef(false);
    const clockwise = useTemplateRef<InstanceType<typeof BaseButton>>('clockwise');
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
        emit('preview', turns.value, flipH.value, flipV.value);
    }

    function toggleFlipH() {
        if (props.disabled) return;
        flipH.value = !flipH.value;
        emit('preview', turns.value, flipH.value, flipV.value);
    }

    function toggleFlipV() {
        if (props.disabled) return;
        flipV.value = !flipV.value;
        emit('preview', turns.value, flipH.value, flipV.value);
    }

    function apply() {
        if (!props.disabled && (turns.value !== 0 || flipH.value || flipV.value)) emit('apply', turns.value, flipH.value, flipV.value);
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
                    <BaseButton ref="clockwise" class="icon-button" aria-label="Rotate clockwise"
                        title="Rotate 90 degrees clockwise" @click="rotate(1)">
                        <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
                    </BaseButton>
                    <BaseButton class="icon-button" aria-label="Rotate counterclockwise"
                        title="Rotate 90 degrees counterclockwise" @click="rotate(-1)">
                        <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                    </BaseButton>
                    <span class="rotate-divider" role="separator" aria-orientation="vertical"></span>
                    <BaseButton class="icon-button" :class="{ active: flipH }" aria-label="Flip horizontally"
                        title="Flip image horizontally (mirror left-right)" @click="toggleFlipH">
                        <i class="bi bi-symmetry-horizontal" aria-hidden="true"></i>
                    </BaseButton>
                    <BaseButton class="icon-button" :class="{ active: flipV }" aria-label="Flip vertically"
                        title="Flip image vertically (mirror top-bottom)" @click="toggleFlipV">
                        <i class="bi bi-symmetry-vertical" aria-hidden="true"></i>
                    </BaseButton>
                    <span class="rotate-divider" role="separator" aria-orientation="vertical"></span>
                    <BaseButton type="submit" class="icon-button icon-button--apply" aria-label="Apply rotation"
                        title="Apply rotation" :disabled="turns === 0 && !flipH && !flipV">
                        <i class="bi bi-check-lg" aria-hidden="true"></i>
                    </BaseButton>
                    <BaseButton class="icon-button" aria-label="Cancel rotation" title="Cancel rotation" @click="cancel">
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </BaseButton>
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

.icon-button.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: #fff;
}

.icon-button--apply {
    color: #fff;
    background: var(--color-accent);
}

.icon-button:hover:not(:disabled) {
    filter: brightness(1.15);
}

.icon-button:not(.icon-button--apply):not(.active):hover:not(:disabled) {
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
