<script setup lang="ts">
    import { EDIT_TOOLS, PAN_TOOL, type ToolId } from '@/types/editor';

    defineProps<{
        activeTool: ToolId | null
        hasImage: boolean
        busy: boolean
        canZoomIn: boolean
        canZoomOut: boolean
    }>();

    const emit = defineEmits<{
        import: []
        export: []
        'rotate-image': []
        'select-tool': [tool: ToolId]
        'zoom-in': []
        'zoom-out': []
    }>();
</script>

<template>
    <nav class="toolbar" aria-label="Tools">
        <div class="tool-group" role="group" aria-label="File">
            <button
                type="button"
                class="tool-button"
                aria-label="Import image"
                title="Import image"
                :disabled="busy"
                @click="emit('import')"
            >
                <i class="bi bi-folder2-open" aria-hidden="true"></i>
            </button>
            <button
                type="button"
                class="tool-button"
                aria-label="Download image"
                title="Download image"
                :disabled="!hasImage || busy"
                @click="emit('export')"
            >
                <i class="bi bi-download" aria-hidden="true"></i>
            </button>
        </div>

        <hr class="separator" />

        <div class="tool-group" role="group" aria-label="Edit tools">
            <template v-for="tool in EDIT_TOOLS" :key="tool.id">
                <button
                    type="button"
                    class="tool-button"
                    :class="{ 'is-active': activeTool === tool.id }"
                    :aria-pressed="activeTool === tool.id"
                    :aria-label="tool.label"
                    :title="tool.label"
                    :disabled="!hasImage || busy"
                    @click="emit('select-tool', tool.id)"
                >
                    <i class="bi" :class="tool.icon" aria-hidden="true"></i>
                </button>
                <button
                    v-if="tool.id === 'resize'"
                    type="button"
                    class="tool-button"
                    aria-label="Rotate image"
                    title="Rotate image 90° clockwise"
                    :disabled="!hasImage || busy"
                    @click="emit('rotate-image')"
                >
                    <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
                </button>
            </template>
        </div>

        <hr class="separator" />

        <div class="tool-group" role="group" aria-label="View tools">
            <button
                type="button"
                class="tool-button"
                aria-label="Zoom in"
                title="Zoom in"
                :disabled="!canZoomIn"
                @click="emit('zoom-in')"
            >
                <i class="bi bi-zoom-in" aria-hidden="true"></i>
            </button>
            <button
                type="button"
                class="tool-button"
                aria-label="Zoom out"
                title="Zoom out"
                :disabled="!canZoomOut"
                @click="emit('zoom-out')"
            >
                <i class="bi bi-zoom-out" aria-hidden="true"></i>
            </button>
            <button
                type="button"
                class="tool-button"
                :class="{ 'is-active': activeTool === PAN_TOOL.id }"
                :aria-pressed="activeTool === PAN_TOOL.id"
                :aria-label="PAN_TOOL.label"
                :title="PAN_TOOL.label"
                :disabled="!hasImage || busy"
                @click="emit('select-tool', PAN_TOOL.id)"
            >
                <i class="bi" :class="PAN_TOOL.icon" aria-hidden="true"></i>
            </button>
        </div>
    </nav>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 48px;
  padding: 8px 0;
  background-color: var(--color-panel);
  border-right: 1px solid var(--color-border);
}

.tool-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.separator {
  width: 28px;
  border: none;
  border-top: 1px solid var(--color-border);
}

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
  color: #fff;
}

.tool-button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 1px;
}

.tool-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
