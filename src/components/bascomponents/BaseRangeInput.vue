<script setup lang="ts">
    import { useAttrs, useTemplateRef } from 'vue';
    import '@/assets/range-slider.css';

    const model = defineModel<number>();
    const attrs = useAttrs();
    const input = useTemplateRef<HTMLInputElement>('input');

    defineExpose({ focus: () => input.value?.focus() });

    function updateValue(event: Event) {
        if ('value' in attrs) return;
        if (event.target instanceof HTMLInputElement) model.value = event.target.valueAsNumber;
    }
</script>

<template>
    <input ref="input" type="range" :value="model" @input="updateValue" />
</template>
