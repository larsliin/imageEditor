<script setup lang="ts">
    import { useAttrs, useTemplateRef } from 'vue';

    defineProps<{ variant?: 'field' }>();

    const model = defineModel<number | string>();
    const attrs = useAttrs();
    const input = useTemplateRef<HTMLInputElement>('input');

    defineExpose({ focus: () => input.value?.focus() });

    function updateValue(event: Event) {
        if ('value' in attrs || !(event.target instanceof HTMLInputElement)) return;
        const value = Number.parseFloat(event.target.value);
        model.value = Number.isNaN(value) ? event.target.value : value;
    }
</script>

<template>
    <input ref="input" type="number" :value="model" :class="{ 'number-field': variant === 'field' }" @input="updateValue" />
</template>

<style scoped>
.number-field {
    width: 100%;
    min-width: 0;
    min-height: 34px;
    padding: 6px 10px;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 3px;
    font: inherit;
}

.number-field:focus-visible {
    outline: 1px solid var(--color-focus);
    outline-offset: 0;
}
</style>
