<script setup lang="ts">
    import { computed, ref, watch } from 'vue';
    import EditorInfoBar from './components/editor/EditorInfoBar.vue';
    import EditorToolbar from './components/editor/EditorToolbar.vue';
    import EditorCanvas from './components/editor/EditorCanvas.vue';
    import ZoomControls from './components/editor/ZoomControls.vue';
    import ResizeControls from './components/editor/ResizeControls.vue';
    import { useImageDocument } from './composables/useImageDocument';
    import { useZoom } from './composables/useZoom';
    import type { Size } from './lib/zoom';
    import type { ToolId } from './types/editor';
    import type { CropRect } from './lib/crop';
    import LevelsControls from './components/editor/LevelsControls.vue';
    import type { LevelsParams } from './lib/levels';
    import CurvesControls from './components/editor/CurvesControls.vue';
    import type { CurvesParams } from './lib/curves';

    const {
        bitmap, info, documentId, status, error, isBusy, importImage, exportImage, cropImage, rotateImage,
        resizeImage, levelsImage, curvesImage, renameImage, dismissError,
    }
        = useImageDocument();

    const viewportSize = ref<Size>({ width: 0, height: 0 });
    const imageSize = computed<Size | null>(() =>
        bitmap.value ? { width: bitmap.value.width, height: bitmap.value.height } : null,
    );
    const { zoom, isFit, canZoomIn, canZoomOut, zoomIn, zoomOut, fitToView, actualSize } = useZoom(
        imageSize,
        viewportSize,
        documentId,
    );

    const activeTool = ref<ToolId | null>(null);

    function selectTool(tool: ToolId) {
        if (isBusy.value) return;
        activeTool.value = activeTool.value === tool ? null : tool;
    }

    async function applyCrop(crop: CropRect, angle: number) {
        if (await cropImage(crop, angle)) activeTool.value = null;
    }

    async function applyResize(size: Size) {
        if (await resizeImage(size)) activeTool.value = null;
    }

    async function applyLevels(levels: LevelsParams) {
        if (await levelsImage(levels)) activeTool.value = null;
    }

    const levelsPreview = ref<LevelsParams | null>(null);
    const curvesPreview = ref<CurvesParams | null>(null);

    async function applyCurves(curves: CurvesParams) {
        if (await curvesImage(curves)) activeTool.value = null;
    }

    watch(activeTool, () => {
        levelsPreview.value = null;
        curvesPreview.value = null;
    });

    watch(bitmap, () => {
        activeTool.value = null;
    });
</script>

<template>
    <div class="editor">
        <EditorInfoBar :key="documentId" class="editor__info" :image="info" :busy="isBusy" @rename="renameImage" />
        <EditorToolbar
            class="editor__toolbar"
            :active-tool="activeTool"
            :has-image="bitmap !== null"
            :busy="isBusy"
            :can-zoom-in="canZoomIn"
            :can-zoom-out="canZoomOut"
            @select-tool="selectTool"
            @import="importImage"
            @export="exportImage"
            @rotate-image="rotateImage"
            @zoom-in="zoomIn"
            @zoom-out="zoomOut"
        />
        <EditorCanvas
            :key="documentId"
            class="editor__canvas"
            :bitmap="bitmap"
            :zoom="zoom"
            :pan-enabled="activeTool === 'pan'"
            :crop-enabled="activeTool === 'crop'"
            :busy="isBusy"
            :loading="status === 'loading'"
            :error="error"
            :levels-preview="levelsPreview"
            :curves-preview="curvesPreview"
            @import="importImage"
            @dismiss-error="dismissError"
            @viewport-resize="viewportSize = $event"
            @zoom-in="zoomIn"
            @zoom-out="zoomOut"
            @crop="(crop, angle) => applyCrop(crop, angle)"
            @cancel-crop="activeTool = null"
        >
            <template #overlay>
                <ZoomControls :zoom="zoom" :is-fit="isFit" @fit="fitToView" @actual-size="actualSize" />
            </template>
        </EditorCanvas>
        <ResizeControls
            v-if="activeTool === 'resize' && imageSize"
            :image="imageSize"
            :disabled="isBusy"
            :error="error"
            @apply="applyResize"
            @cancel="activeTool = null"
        />
        <LevelsControls
            v-if="activeTool === 'levels' && bitmap"
            :image="bitmap"
            :disabled="isBusy"
            :error="error"
            @preview="levelsPreview = $event"
            @apply="applyLevels"
            @cancel="activeTool = null"
        />
        <CurvesControls
            v-if="activeTool === 'curves' && bitmap"
            :image="bitmap"
            :disabled="isBusy"
            :error="error"
            @preview="curvesPreview = $event"
            @apply="applyCurves"
            @cancel="activeTool = null"
        />
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
