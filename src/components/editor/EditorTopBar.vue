<script setup lang="ts">
    import { computed, nextTick, shallowRef, useTemplateRef } from 'vue';
    import type { ImageInfo } from '@/types/editor';

    const props = defineProps<{
        image: ImageInfo | null
        busy: boolean
        isDarkMode: boolean
        rulersEnabled: boolean
    }>();

    const emit = defineEmits<{
        rename: [fileName: string]
        'toggle-theme': []
        'toggle-rulers': []
    }>();

    const isEditing = shallowRef(false);
    const draftName = shallowRef('');
    const filenameInput = useTemplateRef<HTMLInputElement>('filenameInput');

    const fileName = computed(() => props.image?.fileName ?? 'No image');
    const fileNameBase = computed(() => {
        const dot = fileName.value.lastIndexOf('.');
        return dot > 0 ? fileName.value.slice(0, dot) : fileName.value;
    });
    const fileExtension = computed(() => {
        if (!props.image) return '';
        const dot = fileName.value.lastIndexOf('.');
        return dot > 0 ? fileName.value.slice(dot) : '';
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

</script>

<template>
    <header class="top-bar">
        <div class="top-bar__brand" aria-hidden="true">
            <img class="top-bar__logo" src="/favicon.svg" alt="" />
        </div>
        <dl class="document-details">
            <div class="document-detail document-detail--file">
                <dt>
                    <i class="document-detail__icon bi bi-file-earmark-image" aria-hidden="true"></i>
                </dt>
                <dd class="filename-controls" :class="{ 'filename-controls--editing': isEditing }">
                    <div class="filename-field">
                        <div class="filename-base">
                            <input
                                ref="filenameInput"
                                v-model="displayedName"
                                class="filename-input"
                                type="text"
                                aria-label="Filename"
                                required
                                :readonly="!isEditing"
                                :tabindex="image ? 0 : -1"
                                :title="fileName"
                                :disabled="busy || !image"
                                :class="{ 'filename-input--empty': !image }"
                                @input="filenameInput?.setCustomValidity('')"
                                @blur="finishRenaming()"
                                @click="!isEditing && startRenaming()"
                                @keydown.enter.prevent="isEditing ? finishRenaming(false, true) : startRenaming()"
                                @keydown.esc.prevent="finishRenaming(true, true)"
                            />
                        </div>
                        <span v-if="fileExtension" class="filename-extension">{{ fileExtension }}</span>
                    </div>
                    <i v-if="image" class="filename-edit-indicator bi bi-pencil" aria-hidden="true"></i>
                </dd>
            </div>
        </dl>
        <button
            class="rulers-toggle"
            type="button"
            aria-label="Pixel rulers"
            :aria-pressed="rulersEnabled"
            :title="rulersEnabled ? 'Hide pixel rulers' : 'Show pixel rulers'"
            :disabled="busy || !image"
            @click="emit('toggle-rulers')"
        >
            <i class="bi bi-rulers" aria-hidden="true"></i>
            <span>px</span>
        </button>
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
    gap: 0;
    height: 48px;
    overflow-x: auto;
    padding: 0 12px 0 0;
    background-color: var(--color-panel);
    border-bottom: 1px solid var(--color-border);
}

.top-bar__brand {
    display: grid;
    flex: 0 0 48px;
    place-items: center;
    align-self: stretch;
    border-right: 1px solid var(--color-border);
}

.top-bar__logo {
    display: block;
    width: 28px;
    height: 28px;
    opacity: 0.88;
}

:global(:root[data-theme='light'] .top-bar__logo) {
    opacity: 0.62;
}

.document-details {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 12px;
    min-width: 0;
    margin-left: 14px;
}

.theme-toggle,
.rulers-toggle {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text-muted);
    background-color: var(--color-panel-raised);
    cursor: pointer;
}

.rulers-toggle {
    display: flex;
    justify-content: center;
    gap: 5px;
    width: auto;
    margin-left: auto;
    margin-right: 8px;
    padding: 0 8px;
    font-size: 0.75rem;
}

.rulers-toggle[aria-pressed='true'] {
    color: var(--color-text);
    background-color: var(--color-active);
    border-color: var(--color-focus);
}

.rulers-toggle:disabled {
    opacity: var(--opacity-button-secondary-disabled);
    cursor: default;
}

.theme-toggle:hover,
.rulers-toggle:hover:not(:disabled) {
    color: var(--color-text);
    background-color: var(--color-hover);
}

.theme-toggle:focus-visible,
.rulers-toggle:focus-visible {
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
    height: 28px;
    color: var(--color-text-muted);
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 18px;
    letter-spacing: 0.045em;
    text-transform: uppercase;
    white-space: nowrap;
}

.document-detail__icon {
    display: grid;
    flex: 0 0 24px;
    align-self: center;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background-color: var(--color-panel-raised);
    font-size: 12px;
}

.document-detail dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
}

.filename-controls {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 0 1 auto;
    min-width: 0;
}

.filename-field {
    display: flex;
    align-items: center;
    height: 28px;
    padding: 0 3px;
    border: 1px solid transparent;
    border-radius: 5px;
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 18px;
    color: var(--color-text);
    transition: background-color 120ms ease, border-color 120ms ease;
}

.filename-field:has(.filename-input:not(:disabled)):hover,
.filename-controls--editing .filename-field {
    border-color: var(--color-border);
    background-color: var(--color-panel-raised);
}

.filename-field:has(.filename-input:focus-visible) {
    outline: 2px solid var(--color-focus);
    outline-offset: 1px;
}

.filename-base {
    display: flex;
    min-width: 0;
}

.filename-input {
    field-sizing: content;
    width: auto;
    min-width: 1.5rem;
    max-width: min(18rem, 40vw);
    height: 18px;
    padding: 0;
    border: 0;
    outline: none;
    font: inherit;
    color: inherit;
    background-color: transparent;
}

.filename-input:read-only {
    text-overflow: ellipsis;
    cursor: pointer;
}

.filename-input:disabled {
    cursor: default;
    color: var(--color-text-muted);
}

.filename-input--empty {
    transform: translateY(1px);
}

.filename-edit-indicator {
    flex: 0 0 auto;
    color: var(--color-text-muted);
    font-size: 10px;
    opacity: 0.55;
    transition: color 120ms ease, opacity 120ms ease;
}

.filename-controls:hover .filename-edit-indicator,
.filename-controls:focus-within .filename-edit-indicator {
    color: var(--color-text);
    opacity: 1;
}

.filename-extension {
    flex: 0 0 auto;
    color: var(--color-text-muted);
}

@media (max-width: 640px) {
    .document-details {
        gap: 10px;
    }
}
</style>
