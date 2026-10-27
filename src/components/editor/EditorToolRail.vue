<script setup lang="ts">
    import { computed, shallowRef, useTemplateRef, watch } from 'vue';
    import { PAN_TOOL, EDIT_TOOLS, type ToolId } from '@/types/editor';
    import { useOverflowCollapse } from '@/composables/useOverflowCollapse';
    import EditorToolGroups from './EditorToolGroups.vue';
    import EditorToolFoldout from './EditorToolFoldout.vue';
    import UndoIcon from '@/components/icons/UndoIcon.vue';
    import RedoIcon from '@/components/icons/RedoIcon.vue';

    const props = defineProps<{
        activeTool: ToolId | null
        hasImage: boolean
        busy: boolean
        canZoomIn: boolean
        canZoomOut: boolean
        canUndo: boolean
        canRedo: boolean
    }>();

    const emit = defineEmits<{
        import: []
        export: []
        'select-tool': [tool: ToolId]
        'zoom-in': []
        'zoom-out': []
        undo: []
        redo: []
    }>();

    const FOLDOUT_TOOL_IDS: readonly ToolId[] = [...EDIT_TOOLS.map((tool) => tool.id), PAN_TOOL.id];

    const rail = useTemplateRef<HTMLElement>('rail');
    const { collapsed } = useOverflowCollapse(rail);
    const foldoutOpen = shallowRef(false);
    const foldoutToolActive = computed(() => props.activeTool !== null && FOLDOUT_TOOL_IDS.includes(props.activeTool));

    watch(collapsed, () => {
        foldoutOpen.value = false;
    });

    function selectTool(tool: ToolId) {
        foldoutOpen.value = false;
        emit('select-tool', tool);
    }
</script>

<template>
    <nav ref="rail" class="tool-rail" aria-label="Editor tools">
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
                aria-label="Export"
                title="Export"
                :disabled="!hasImage || busy"
                @click="emit('export')"
            >
                <i class="bi bi-download" aria-hidden="true"></i>
            </button>
        </div>

        <hr class="separator" />

        <div class="tool-group" role="group" aria-label="Edit history">
            <button
                type="button"
                class="tool-button"
                aria-label="Undo"
                title="Undo last edit (Ctrl+Z)"
                :disabled="!hasImage || busy || !canUndo"
                @click="emit('undo')"
            >
                <UndoIcon />
            </button>
            <button
                type="button"
                class="tool-button"
                aria-label="Redo"
                title="Redo last undone edit (Ctrl+Y or Ctrl+Shift+Z)"
                :disabled="!hasImage || busy || !canRedo"
                @click="emit('redo')"
            >
                <RedoIcon />
            </button>
        </div>

        <hr class="separator" />

        <EditorToolFoldout
            v-if="collapsed"
            v-model:open="foldoutOpen"
            label="More tools"
            :active="foldoutToolActive"
        >
            <EditorToolGroups
                layout="foldout"
                :active-tool="activeTool"
                :has-image="hasImage"
                :busy="busy"
                :can-zoom-in="canZoomIn"
                :can-zoom-out="canZoomOut"
                @select-tool="selectTool"
                @zoom-in="emit('zoom-in')"
                @zoom-out="emit('zoom-out')"
            />
        </EditorToolFoldout>
        <EditorToolGroups
            v-else
            layout="rail"
            :active-tool="activeTool"
            :has-image="hasImage"
            :busy="busy"
            :can-zoom-in="canZoomIn"
            :can-zoom-out="canZoomOut"
            @select-tool="selectTool"
            @zoom-in="emit('zoom-in')"
            @zoom-out="emit('zoom-out')"
        />
    </nav>
</template>

<style scoped src="./toolButtons.css"></style>

<style scoped>
.tool-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    width: 48px;
    min-height: 0;
    padding: 8px 0;
    overflow: hidden;
    background-color: var(--color-panel);
    border-right: 1px solid var(--color-border);
}
</style>
