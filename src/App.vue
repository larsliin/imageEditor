<script setup lang="ts">
    import { computed, ref, watch } from 'vue';
    import EditorInfoBar from './components/editor/EditorInfoBar.vue';
    import EditorToolbar from './components/editor/EditorToolbar.vue';
    import EditorCanvas from './components/editor/EditorCanvas.vue';
    import ZoomControls from './components/editor/ZoomControls.vue';
    import { useImageDocument } from './composables/useImageDocument';
    import { useZoom } from './composables/useZoom';
    import type { Size } from './lib/zoom';
    import type { ToolId } from './types/editor';
    import type { CropRect } from './lib/crop';

    const { bitmap, info, status, error, isBusy, canReset, importImage, exportImage, cropImage, resetImage, renameImage, dismissError }
        = useImageDocument();

    const viewportSize = ref<Size>({ width: 0, height: 0 });
    const imageSize = computed<Size | null>(() =>
        bitmap.value ? { width: bitmap.value.width, height: bitmap.value.height } : null,
    );
    const { zoom, isFit, canZoomIn, canZoomOut, zoomIn, zoomOut, fitToView, actualSize } = useZoom(
        imageSize,
        viewportSize,
    );

    const activeTool = ref<ToolId | null>(null);

    function selectTool(tool: ToolId) {
        if (isBusy.value) return;
        activeTool.value = activeTool.value === tool ? null : tool;
    }

    async function applyCrop(crop: CropRect) {
        if (await cropImage(crop)) activeTool.value = null;
    }

    watch(bitmap, () => {
        activeTool.value = null;
    });
</script>

<template>
    <div class="editor">
        <EditorInfoBar class="editor__info" :image="info" :busy="isBusy" @rename="renameImage" />
        <EditorToolbar
            class="editor__toolbar"
            :active-tool="activeTool"
            :has-image="bitmap !== null"
            :busy="isBusy"
            :can-reset="canReset"
            :can-zoom-in="canZoomIn"
            :can-zoom-out="canZoomOut"
            @select-tool="selectTool"
            @import="importImage"
            @export="exportImage"
            @reset="resetImage"
            @zoom-in="zoomIn"
            @zoom-out="zoomOut"
        />
        <EditorCanvas
            class="editor__canvas"
            :bitmap="bitmap"
            :zoom="zoom"
            :pan-enabled="activeTool === 'pan'"
            :crop-enabled="activeTool === 'crop'"
            :busy="isBusy"
            :loading="status === 'loading'"
            :error="error"
            @import="importImage"
            @dismiss-error="dismissError"
            @viewport-resize="viewportSize = $event"
            @crop="applyCrop"
            @cancel-crop="activeTool = null"
        >
            <template #overlay>
                <ZoomControls :zoom="zoom" :is-fit="isFit" @fit="fitToView" @actual-size="actualSize" />
            </template>
        </EditorCanvas>
    </div>
</template>

<style scoped>
.editor {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    'info info'
    'toolbar canvas';
  height: 100%;
}

.editor__info {
  grid-area: info;
}

.editor__toolbar {
  grid-area: toolbar;
}

.editor__canvas {
  grid-area: canvas;
}
</style>
