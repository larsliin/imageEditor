<script setup lang="ts">
    import { ADJUSTMENT_TOOLS, PAINT_TOOLS, TRANSFORM_TOOLS, type ToolId } from '@/types/editor';
    import CurvesIcon from '@/components/editor/icons/CurvesIcon.vue';
    import BaseButton from '@/components/bascomponents/BaseButton.vue';

    defineProps<{
        activeTool: ToolId | null
        hasImage: boolean
        busy: boolean
        layout: 'rail' | 'foldout'
    }>();

    const emit = defineEmits<{
        'select-tool': [tool: ToolId]
    }>();

    const TOOL_GROUPS = [
        { label: 'Transform tools', tools: TRANSFORM_TOOLS },
        { label: 'Paint tools', tools: PAINT_TOOLS },
        { label: 'Adjustment tools', tools: ADJUSTMENT_TOOLS },
    ] as const;
</script>

<template>
    <div class="tool-groups" :class="`tool-groups--${layout}`">
        <template v-for="(group, index) in TOOL_GROUPS" :key="group.label">
            <div class="tool-group" role="group" :aria-label="group.label">
                <BaseButton
                    v-for="tool in group.tools"
                    :key="tool.id"
                    variant="tool"
                    :class="{ 'is-active': activeTool === tool.id }"
                    :aria-pressed="activeTool === tool.id"
                    :aria-label="tool.label"
                    :title="tool.label"
                    :disabled="!hasImage || busy"
                    @click="emit('select-tool', tool.id)"
                >
                    <CurvesIcon v-if="tool.id === 'curves'" />
                    <i v-else class="bi" :class="tool.icon" aria-hidden="true"></i>
                </BaseButton>
            </div>

            <hr v-if="layout === 'rail' || index < TOOL_GROUPS.length - 1" class="separator" />
        </template>
    </div>
</template>

<style scoped src="./toolButtons.css"></style>

<style scoped>
.tool-groups {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

.tool-groups--foldout,
.tool-groups--foldout .tool-group {
    flex-direction: row;
}

.tool-groups--foldout {
    flex-wrap: wrap;
}

.tool-groups--foldout .separator {
    align-self: center;
    width: 0;
    height: 28px;
    margin: 0 2px;
    border-top: none;
    border-left: 1px solid var(--color-border);
}
</style>
