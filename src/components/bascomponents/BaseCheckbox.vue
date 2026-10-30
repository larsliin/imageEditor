<script setup lang="ts">
    const model = defineModel<boolean>();

    function updateChecked(event: Event) {
        if (event.target instanceof HTMLInputElement) model.value = event.target.checked;
    }
</script>

<template>
    <input type="checkbox" :checked="model" @change="updateChecked" />
</template>
