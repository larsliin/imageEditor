<script setup lang="ts">
    import { nextTick, onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
    import BaseButton from '@/components/bascomponents/BaseButton.vue';

    withDefaults(defineProps<{
        busy?: boolean
        error?: string | null
    }>(), { busy: false, error: null });

    const emit = defineEmits<{
        apply: []
        discard: []
        keep: []
    }>();

    const dialog = useTemplateRef<HTMLDialogElement>('dialog');
    let previousFocus: HTMLElement | null = null;

    onMounted(() => {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.value?.showModal();
    });

    onBeforeUnmount(() => {
        dialog.value?.close();
        void nextTick(() => {
            if (previousFocus?.isConnected) previousFocus.focus();
        });
    });

    function keepEditing() {
        emit('keep');
    }
</script>

<template>
    <Teleport to="body">
        <dialog ref="dialog" class="brush-pending-dialog" aria-labelledby="brush-pending-title"
            :aria-busy="busy" @cancel.prevent="!busy && keepEditing()" @keydown.esc.stop.prevent="!busy && keepEditing()">
            <h2 id="brush-pending-title">Unapplied brush strokes</h2>
            <p>Apply your strokes before leaving the Brush tool, or discard them.</p>
            <p v-if="error" role="alert">{{ error }}</p>
            <div class="brush-pending-dialog__actions">
                <BaseButton class="brush-pending-dialog__apply" :disabled="busy" @click="emit('apply')">Apply and continue</BaseButton>
                <BaseButton :disabled="busy" @click="emit('discard')">Discard and continue</BaseButton>
                <BaseButton :disabled="busy" @click="keepEditing">Keep editing</BaseButton>
            </div>
        </dialog>
    </Teleport>
</template>

<style scoped>
.brush-pending-dialog {
    width: min(390px, calc(100vw - 32px));
    padding: 24px;
    color: var(--color-text);
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: var(--shadow-floating-panel);
}

.brush-pending-dialog::backdrop {
    background: rgb(0 0 0 / 55%);
}

h2 {
    margin: 0 0 12px;
    font-size: 18px;
}

p {
    margin: 0 0 20px;
    color: var(--color-text-muted);
}

.brush-pending-dialog__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
}

.brush-pending-dialog__apply {
    color: #fff;
    background: var(--color-accent);
}

.brush-pending-dialog :deep(button:focus-visible) {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
}
</style>
