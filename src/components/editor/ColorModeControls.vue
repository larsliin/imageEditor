<script setup lang="ts">
    import { ref, useId, watch } from 'vue';
    import { COLOR_MODES, type ColorMode } from '@/lib/colorMode';
    import ToolModal from './ToolModal.vue';

    const props = defineProps<{
        disabled: boolean
        error: string | null
    }>();

    const emit = defineEmits<{
        preview: [mode: ColorMode | null]
        apply: [mode: ColorMode]
        cancel: []
    }>();

    const idPrefix = useId();
    const mode = ref<ColorMode>('grayscale');

    watch(mode, (value) => emit('preview', value), { immediate: true });

    function apply() {
        if (!props.disabled) emit('apply', mode.value);
    }

    function cancel() {
        emit('preview', null);
        emit('cancel');
    }
</script>

<template>
    <ToolModal
        title="Color mode"
        :apply-label="mode === 'bitmap' ? 'Convert to bitmap' : 'Convert to grayscale'"
        :can-apply="true"
        :busy="disabled"
        :error="error"
        @apply="apply"
        @cancel="cancel"
    >
        <div class="modes" role="radiogroup" aria-label="Color mode">
            <label v-for="item in COLOR_MODES" :key="item.id" class="mode" :for="`${idPrefix}-${item.id}`">
                <input
                    :id="`${idPrefix}-${item.id}`"
                    v-model="mode"
                    class="mode__input"
                    type="radio"
                    :name="`${idPrefix}-mode`"
                    :value="item.id"
                    :aria-describedby="`${idPrefix}-${item.id}-desc`"
                />
                <span class="mode__text">
                    <span class="mode__label">{{ item.label }}</span>
                    <span :id="`${idPrefix}-${item.id}-desc`" class="mode__description">{{ item.description }}</span>
                </span>
            </label>
        </div>
    </ToolModal>
</template>

<style scoped>
.modes {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.mode {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
}

.mode:hover {
    background-color: var(--color-hover);
}

.mode:has(.mode__input:checked) {
    border-color: var(--color-accent);
}

.mode__input {
    margin: 3px 0 0;
    accent-color: var(--color-accent);
}

.mode__input:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
}

.mode__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.mode__label {
    font-weight: 600;
}

.mode__description {
    color: var(--color-text-muted);
    font-size: 0.875rem;
}
</style>
