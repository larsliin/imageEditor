<script setup lang="ts">
    import { computed, nextTick, shallowRef, useTemplateRef } from 'vue';
    import type { ImageInfo } from '@/types/editor';
    import type { ExportMimeType } from '@/lib/imageIO';

    const props = defineProps<{
        image: ImageInfo | null
        busy: boolean
        isDarkMode: boolean
    }>();

    const emit = defineEmits<{
        rename: [fileName: string]
        'export-format-change': [mimeType: ExportMimeType]
        'toggle-theme': []
    }>();

    const isEditing = shallowRef(false);
    const draftName = shallowRef('');
    const filenameInput = useTemplateRef<HTMLInputElement>('filenameInput');

    const fileName = computed(() => props.image?.fileName ?? 'No image');
    const fileNameBase = computed(() => {
        const dot = fileName.value.lastIndexOf('.');
        return dot > 0 ? fileName.value.slice(0, dot) : fileName.value;
    });
    const displayedName = computed({
        get: () => isEditing.value ? draftName.value : fileNameBase.value,
        set: (value: string) => { draftName.value = value; },
    });
    async function startRenaming() {
        if (!props.image || props.busy) return;
        draftName.value = fileNameBase.value;
        isEditing.value = true;
        await nextTick();
        filenameInput.value?.focus();
        filenameInput.value?.setSelectionRange(0, draftName.value.length);
    }

    async function finishRenaming(cancel = false, restoreFocus = false) {
        if (!isEditing.value) return;
        if (!cancel) {
            const input = filenameInput.value;
            const name = draftName.value.trim().replace(/\.(?:jpe?g|png|webp)$/i, '');
            input?.setCustomValidity(name ? '' : 'Enter a filename without an extension.');
            if (input && !input.reportValidity()) return;
            emit('rename', name);
        }
        isEditing.value = false;
        if (restoreFocus) {
            await nextTick();
            filenameInput.value?.focus();
        }
    }

    function updateExportFormat(event: Event) {
        const select = event.currentTarget;
        if (!(select instanceof HTMLSelectElement)) return;
        if (select.value === 'image/jpeg' || select.value === 'image/png') {
            emit('export-format-change', select.value);
        }
    }
</script>

<template>
    <header class="top-bar">
        <dl class="document-details">
            <div class="document-detail document-detail--file">
                <dt><i class="bi bi-file-earmark-image" aria-hidden="true"></i><span>File</span></dt>
                <dd class="filename-controls">
                    <input
                        ref="filenameInput"
                        v-model="displayedName"
                        class="filename-input"
                        type="text"
                        aria-label="Filename without extension"
                        required
                        :readonly="!isEditing"
                        :tabindex="image ? 0 : -1"
                        :title="fileName"
                        :disabled="busy || !image"
                        @input="filenameInput?.setCustomValidity('')"
                        @blur="finishRenaming()"
                        @click="!isEditing && startRenaming()"
                        @keydown.enter.prevent="isEditing ? finishRenaming(false, true) : startRenaming()"
                        @keydown.esc.prevent="finishRenaming(true, true)"
                    />
                    <span v-if="image" class="filename-extension-separator" aria-hidden="true">.</span>
                    <select
                        v-if="image"
                        class="export-format"
                        aria-label="Export file type"
                        :value="image?.exportMimeType ?? 'image/png'"
                        :disabled="busy || !image"
                        @change="updateExportFormat"
                    >
                        <option value="image/jpeg">JPG</option>
                        <option value="image/png">PNG</option>
                    </select>
                </dd>
            </div>
        </dl>
        <button
            class="theme-toggle"
            type="button"
            :aria-label="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
            :title="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="emit('toggle-theme')"
        >
            <i :class="isDarkMode ? 'bi bi-sun' : 'bi bi-moon'" aria-hidden="true"></i>
        </button>
    </header>
</template>

<style scoped>
.top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    height: 48px;
    overflow-x: auto;
    padding: 0 12px;
    background-color: var(--color-panel);
    border-bottom: 1px solid var(--color-border);
}

.document-details {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 16px;
    min-width: 0;
}

.theme-toggle {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 30px;
    height: 30px;
    margin-left: auto;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text-muted);
    background-color: var(--color-panel-raised);
    cursor: pointer;
}

.theme-toggle:hover {
    color: var(--color-text);
    background-color: var(--color-hover);
}

.theme-toggle:focus-visible {
    outline: 1px solid var(--color-focus);
    outline-offset: 1px;
}

.document-detail {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--color-text-muted);
}

.document-detail dt {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-muted);
}

.document-detail dt span::after {
    content: ':';
}

.document-detail dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    font-size: 0.875rem;
}

.filename-controls {
    display: flex;
    align-items: center;
    gap: 0;
    flex: 0 0 auto;
}

.filename-input {
    width: auto;
    field-sizing: content;
    min-width: 1.5rem;
    max-width: min(18rem, 40vw);
    height: 22px;
    padding: 4px 0 4px 1px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    font: inherit;
    font-size: 12px;
    color: var(--color-text-muted);
    background-color: var(--color-bg);
}

.filename-input:read-only {
    border-color: transparent;
    background-color: transparent;
    text-overflow: ellipsis;
    cursor: pointer;
}

.filename-input:read-only:hover:not(:disabled) {
    color: var(--color-text);
}

.filename-input:disabled {
    cursor: default;
}

.export-format {
    width: 50px;
    min-width: 0;
    height: 24px;
    margin-left: 2px;
    padding: 2px 0;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    font: inherit;
    font-size: 12px;
    color: var(--color-text-muted);
    background-color: var(--color-panel-raised);
    cursor: pointer;
}

.export-format option:disabled {
    color: #666;
}

.export-format:hover:not(:disabled) {
    color: var(--color-text);
    background-color: var(--color-hover);
}

.export-format:disabled {
    opacity: 0.5;
    cursor: default;
}

.filename-input:focus-visible,
.export-format:focus-visible {
    outline: 1px solid var(--color-focus);
    outline-offset: 0;
}

.filename-extension-separator {
    margin: 0 1px;
    color: var(--color-text-muted);
}

@media (max-width: 640px) {
    .document-details {
        gap: 10px;
    }
}
</style>
