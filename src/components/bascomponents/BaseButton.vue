<script setup lang="ts">
    import { useTemplateRef } from 'vue';

    withDefaults(defineProps<{
        type?: 'button' | 'submit' | 'reset'
        variant?: 'tool' | 'secondary'
    }>(), { type: 'button' });

    const button = useTemplateRef<HTMLButtonElement>('button');

    defineExpose({
        focus: () => button.value?.focus(),
        getBoundingClientRect: () => button.value?.getBoundingClientRect(),
    });
</script>

<template>
    <button ref="button" :type="type" :class="{ 'tool-button': variant === 'tool', 'secondary-button': variant === 'secondary' }">
        <slot />
    </button>
</template>

<style scoped>
.tool-button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    font-size: 18px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
}

.tool-button:hover:not(:disabled) {
    background-color: var(--color-hover);
}

.tool-button.is-active {
    background-color: var(--color-active);
    border-color: var(--color-accent);
}

.tool-button:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 1px;
}

.tool-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.secondary-button {
    color: var(--color-text);
    background: var(--color-button-secondary);
    border: 1px solid var(--color-button-secondary-border);
    border-radius: var(--radius-button);
    cursor: pointer;
}

.secondary-button:hover:not(:disabled) {
    background: var(--color-button-secondary-hover);
    border-color: var(--color-button-secondary-border-hover);
}

.secondary-button:disabled {
    opacity: var(--opacity-button-secondary-disabled);
    cursor: not-allowed;
}

.secondary-button:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
}
</style>
