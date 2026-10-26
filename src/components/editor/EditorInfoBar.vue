<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'
import type { ImageInfo } from '@/types/editor'

const props = defineProps<{
  image: ImageInfo | null
  busy: boolean
}>()

const emit = defineEmits<{
  rename: [fileName: string]
}>()

const isEditing = shallowRef(false)
const draftName = shallowRef('')
const filenameInput = useTemplateRef<HTMLInputElement>('filenameInput')
const renameButton = useTemplateRef<HTMLButtonElement>('renameButton')

const PLACEHOLDER = '—'

const fileName = computed(() => props.image?.fileName ?? 'No image')
const displayedName = computed({
  get: () => isEditing.value ? draftName.value : fileName.value,
  set: (value: string) => { draftName.value = value },
})
const width = computed(() => (props.image ? `${props.image.width} px` : PLACEHOLDER))
const height = computed(() => (props.image ? `${props.image.height} px` : PLACEHOLDER))

async function startRenaming() {
  if (!props.image || props.busy) return
  draftName.value = props.image.fileName
  isEditing.value = true
  await nextTick()
  filenameInput.value?.focus()
  const dot = draftName.value.lastIndexOf('.')
  filenameInput.value?.setSelectionRange(0, dot > 0 ? dot : draftName.value.length)
}

async function finishRenaming(cancel = false, restoreFocus = false) {
  if (!isEditing.value) return
  if (!cancel) {
    const input = filenameInput.value
    input?.setCustomValidity(draftName.value.trim() ? '' : 'Enter a filename.')
    if (input && !input.reportValidity()) return
    emit('rename', draftName.value.trim())
  }
  isEditing.value = false
  if (restoreFocus) {
    await nextTick()
    renameButton.value?.focus()
  }
}
</script>

<template>
  <header class="info-bar">
    <dl class="info-list">
      <div class="info-item info-item--file">
        <dt><i class="bi bi-file-earmark-image" aria-hidden="true"></i><span>File</span></dt>
        <dd class="filename">
          <input
            ref="filenameInput"
            v-model="displayedName"
            class="filename-input"
            type="text"
            aria-label="Filename"
            required
            :readonly="!isEditing"
            :tabindex="isEditing ? 0 : -1"
            :title="fileName"
            :disabled="busy"
            @input="filenameInput?.setCustomValidity('')"
            @blur="finishRenaming()"
            @keydown.enter.prevent="finishRenaming(false, true)"
            @keydown.esc.prevent="finishRenaming(true, true)"
          />
          <button
              v-if="image"
              ref="renameButton"
              type="button"
              class="rename-button"
              aria-label="Rename file"
              title="Rename file"
              :disabled="busy || isEditing"
              @click="startRenaming"
            >
              <i class="bi bi-pencil" aria-hidden="true"></i>
          </button>
        </dd>
      </div>
      <div class="info-item">
        <dt><span>Width</span></dt>
        <dd>{{ width }}</dd>
      </div>
      <div class="info-item">
        <dt><span>Height</span></dt>
        <dd>{{ height }}</dd>
      </div>
    </dl>
    <div id="editor-tool-controls" class="tool-controls"></div>
  </header>
</template>

<style scoped>
.info-bar {
  display: flex;
  align-items: center;
  gap: 8px 24px;
  height: 44px;
  overflow-x: auto;
  padding: 0 12px;
  background-color: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
}

.tool-controls {
  flex-shrink: 0;
  margin-left: auto;
}

.tool-controls:empty {
  display: none;
}

.info-list {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 24px;
  min-width: 0;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

dt {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted);
}

dt span::after {
  content: ':';
}

dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.filename {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.filename-input {
  field-sizing: content;
  min-width: 4rem;
  max-width: min(32rem, 40vw);
  padding: 2px 6px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font: inherit;
  color: inherit;
  background-color: var(--color-bg);
}

.filename-input:read-only {
  border-color: transparent;
  background-color: transparent;
  text-overflow: ellipsis;
  pointer-events: none;
}

.rename-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.rename-button:hover:not(:disabled) {
  color: var(--color-text);
  background-color: var(--color-hover);
}

.rename-button .bi {
  display: inline-flex;
  font-size: 12px;
  line-height: 1;
}

.rename-button .bi::before {
  display: block;
  vertical-align: initial;
}

.rename-button:disabled {
  opacity: 0.4;
  cursor: default;
}

.filename-input:focus-visible,
.rename-button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .info-list {
    gap: 12px;
  }
}
</style>
