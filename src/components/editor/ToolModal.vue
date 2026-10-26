<script setup lang="ts">
    import { nextTick, onBeforeUnmount, onMounted, useId, useTemplateRef } from 'vue';

    const props = withDefaults(defineProps<{
        title: string
        applyLabel?: string
        canApply: boolean
        busy: boolean
        error?: string | null
        dim?: boolean
    }>(), {
        applyLabel: 'Apply',
        error: null,
        dim: true,
    });

    const emit = defineEmits<{
        apply: []
        cancel: []
    }>();

    const titleId = useId();
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
            :class="{ 'tool-modal--clear': !dim }"
            :aria-labelledby="titleId"
            @cancel.prevent="cancel"
            @keydown.esc.stop.prevent="cancel"
        >
            <form class="tool-modal__form" :aria-busy="busy" @submit.prevent="apply">
                <header class="tool-modal__header">
                    <h2 :id="titleId" class="tool-modal__title">{{ title }}</h2>
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
  background: rgb(0 0 0 / 60%);
}

.tool-modal--clear {
  box-shadow: 0 24px 80px rgb(0 0 0 / 80%), 0 0 0 1px rgb(0 0 0 / 40%);
}

.tool-modal--clear::backdrop {
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
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
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

.tool-modal__button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-modal__button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
</style>
