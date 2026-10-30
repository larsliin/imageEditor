<script setup lang="ts">
    import { useAttrs } from 'vue';
    import '@/assets/range-slider.css';

    const model = defineModel<number>();
    const attrs = useAttrs();

    function updateValue(event: Event) {
        if ('value' in attrs) return;
        if (event.target instanceof HTMLInputElement) model.value = event.target.valueAsNumber;
    }
</script>

<template>
    <input type="range" :value="model" @input="updateValue" />
</template>
