<script setup lang="ts">
    import { computed, shallowRef, useTemplateRef, watch } from 'vue';
    import { PAN_TOOL, EDIT_TOOLS, PAINT_TOOLS, type ToolId } from '@/types/editor';
    import { useOverflowCollapse } from '@/composables/useOverflowCollapse';
    import EditorToolGroups from './EditorToolGroups.vue';
    import EditorToolFoldout from './EditorToolFoldout.vue';
    import PanIcon from '@/components/editor/icons/PanIcon.vue';
    import UndoIcon from '@/components/editor/icons/UndoIcon.vue';
    import RedoIcon from '@/components/editor/icons/RedoIcon.vue';
    import BaseButton from '@/components/bascomponents/BaseButton.vue';
    import { shortcutModifierLabel } from '@/lib/shortcuts';

    const modifier = shortcutModifierLabel();

    const props = defineProps<{
        activeTool: ToolId | null
        hasImage: boolean
        busy: boolean
        popupOpen: boolean
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

    const FOLDOUT_TOOL_IDS: readonly ToolId[] = [
        ...EDIT_TOOLS.map((tool) => tool.id),
        ...PAINT_TOOLS.map((tool) => tool.id),
    ];

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
        <fieldset class="tool-rail__controls" :disabled="popupOpen" aria-label="Editor tools">
            <div class="tool-group" role="group" aria-label="File">
                <BaseButton
                    variant="tool"
                    aria-label="Import image"
                    title="Import image"
                    :disabled="busy"
                    @click="emit('import')"
                >
                    <i class="bi bi-folder2-open" aria-hidden="true"></i>
                </BaseButton>
                <BaseButton
                    variant="tool"
                    aria-label="Export"
                    title="Export"
                    :disabled="!hasImage || busy"
                    @click="emit('export')"
                >
                    <i class="bi bi-download" aria-hidden="true"></i>
                </BaseButton>
            </div>

            <hr class="separator" />

            <div class="tool-group" role="group" aria-label="Edit history">
                <BaseButton
                    variant="tool"
                    aria-label="Undo"
                    :title="`Undo last edit (${modifier}+Z)`"
                    :disabled="!hasImage || busy || !canUndo"
                    @click="emit('undo')"
                >
                    <UndoIcon />
                </BaseButton>
                <BaseButton
                    variant="tool"
                    aria-label="Redo"
                    :title="`Redo last undone edit (${modifier}+Y or ${modifier}+Shift+Z)`"
                    :disabled="!hasImage || busy || !canRedo"
                    @click="emit('redo')"
                >
                    <RedoIcon />
                </BaseButton>
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
                    @select-tool="selectTool"
                />
            </EditorToolFoldout>
            <EditorToolGroups
                v-else
                layout="rail"
                :active-tool="activeTool"
                :has-image="hasImage"
                :busy="busy"
                @select-tool="selectTool"
            />

            <hr v-if="collapsed" class="separator" />

            <div class="tool-group" role="group" aria-label="View tools">
                <BaseButton
                    variant="tool"
                    aria-label="Zoom in"
                    :title="`Zoom in (${modifier}++)`"
                    :disabled="!canZoomIn"
                    @click="emit('zoom-in')"
                >
                    <i class="bi bi-zoom-in" aria-hidden="true"></i>
                </BaseButton>
                <BaseButton
                    variant="tool"
                    aria-label="Zoom out"
                    :title="`Zoom out (${modifier}+-)`"
                    :disabled="!canZoomOut"
                    @click="emit('zoom-out')"
                >
                    <i class="bi bi-zoom-out" aria-hidden="true"></i>
                </BaseButton>
                <BaseButton
                    variant="tool"
                    :class="{ 'is-active': activeTool === PAN_TOOL.id }"
                    :aria-pressed="activeTool === PAN_TOOL.id"
                    :aria-label="PAN_TOOL.label"
                    :title="PAN_TOOL.label"
                    :disabled="!hasImage || busy"
                    @click="selectTool(PAN_TOOL.id)"
                >
                    <PanIcon />
                </BaseButton>
            </div>
        </fieldset>
    </nav>
</template>

<style scoped src="./toolButtons.css"></style>

<style scoped>
.tool-rail__controls {
    display: contents;
}

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
