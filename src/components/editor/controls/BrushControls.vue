<script setup lang="ts">
    import FloatingToolbar from '../chrome/FloatingToolbar.vue';
    import BaseButton from '@/components/bascomponents/BaseButton.vue';
    import BaseRangeInput from '@/components/bascomponents/BaseRangeInput.vue';
    import type { BrushSettings } from '@/lib/brush';

    const props = defineProps<{
        settings: BrushSettings
        disabled: boolean
        canApply: boolean
        error: string | null
    }>();

    const emit = defineEmits<{
        'update:settings': [settings: BrushSettings]
        apply: []
        cancel: []
    }>();

    function updateSetting<K extends keyof BrushSettings>(key: K, value: BrushSettings[K]) {
        emit('update:settings', { ...props.settings, [key]: value });
    }
</script>

<template>
    <Teleport defer to="#editor-tool-controls">
        <FloatingToolbar label="Brush toolbar">
            <form class="brush-controls" aria-label="Brush controls" :aria-busy="disabled" @submit.prevent="emit('apply')">
                <fieldset class="brush-controls__fields" :disabled="disabled">
                    <label class="brush-control">
                        <span>Thickness</span>
                        <BaseRangeInput
                            :model-value="settings.thickness"
                            aria-label="Brush thickness in pixels"
                            min="1"
                            max="500"
                            step="1"
                            @update:model-value="updateSetting('thickness', $event ?? settings.thickness)"
                        />
                        <output>{{ settings.thickness }} px</output>
                    </label>
                    <label class="brush-control">
                        <span>Hardness</span>
                        <BaseRangeInput
                            :model-value="settings.hardness"
                            aria-label="Brush hardness percentage"
                            min="0"
                            max="100"
                            step="1"
                            @update:model-value="updateSetting('hardness', $event ?? settings.hardness)"
                        />
                        <output>{{ settings.hardness }}%</output>
                    </label>
                    <label class="brush-control brush-control--color">
                        <span>Color</span>
                        <input
                            type="color"
                            :value="settings.color"
                            aria-label="Brush color"
                            @input="updateSetting('color', ($event.target as HTMLInputElement).value)"
                        />
                        <output>{{ settings.color.toUpperCase() }}</output>
                    </label>
                    <span class="brush-controls__divider" role="separator" aria-orientation="vertical"></span>
                    <BaseButton type="submit" class="brush-controls__action brush-controls__action--apply"
                        aria-label="Apply brush strokes" title="Apply brush strokes" :disabled="!canApply">
                        <i class="bi bi-check-lg" aria-hidden="true"></i>
                    </BaseButton>
                    <BaseButton class="brush-controls__action" aria-label="Cancel brush strokes"
                        title="Cancel brush strokes" @click="emit('cancel')">
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </BaseButton>
                </fieldset>
                <p v-if="error" class="brush-controls__error" role="alert">{{ error }}</p>
                <p v-if="disabled" class="brush-controls__status" role="status">Processing image...</p>
            </form>
        </FloatingToolbar>
    </Teleport>
</template>

<style scoped>
.brush-controls {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 12px;
    width: max-content;
    padding: 0;
    white-space: nowrap;
}

.brush-controls__fields {
    display: flex;
    flex: 1;
    flex-wrap: nowrap;
    align-items: center;
    gap: 10px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
}

.brush-control {
    display: grid;
    flex: 0 0 auto;
    grid-template-columns: auto 120px auto;
    align-items: center;
    gap: 6px;
    color: var(--color-text);
    font-size: 12px;
}

.brush-control output {
    min-width: 42px;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    text-align: center;
}

.brush-control--color {
    grid-template-columns: auto 32px auto;
}

.brush-control--color input {
    width: 30px;
    height: 30px;
    padding: 2px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    cursor: pointer;
}

.brush-control--color output {
    min-width: 56px;
}

.brush-controls__divider {
    flex: 0 0 auto;
    height: 24px;
    border-left: 1px solid var(--color-border);
}

.brush-controls__action {
    flex: 0 0 30px;
    width: 30px;
    height: 30px;
    padding: 0;
    color: var(--color-text);
    background: var(--color-button-secondary);
    border: 1px solid var(--color-button-secondary-border);
    border-radius: var(--radius-button);
}

.brush-controls__action--apply {
    color: #fff;
    background: var(--color-accent);
    border-color: var(--color-accent);
}

.brush-controls__action:focus-visible,
.brush-control--color input:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
}

.brush-controls__error {
    flex: 0 0 auto;
    margin: 0;
    color: #fecaca;
    font-size: 12px;
    white-space: nowrap;
}

.brush-controls__status {
    flex: 0 0 auto;
    margin: 0;
    color: var(--color-text-muted);
    font-size: 12px;
    white-space: nowrap;
}

@media (max-width: 1400px) {
    .brush-control {
        grid-template-columns: auto 80px auto;
    }

    .brush-control--color {
        grid-template-columns: auto 32px;
    }

    .brush-control--color output {
        display: none;
    }
}
</style>
