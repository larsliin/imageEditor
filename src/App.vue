<script setup lang="ts">
    import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
    import EditorTopBar from './components/editor/chrome/EditorTopBar.vue';
    import EditorToolRail from './components/editor/chrome/EditorToolRail.vue';
    import EditorCanvas from './components/editor/canvas/EditorCanvas.vue';
    import ZoomControls from './components/editor/controls/ZoomControls.vue';
    import ResizeControls from './components/editor/controls/ResizeControls.vue';
    import RotateControls from './components/editor/controls/RotateControls.vue';
    import { rotatedSize, type QuarterTurns } from './lib/rotate';
    import { useImageDocument } from './composables/useImageDocument';
    import { useAnimatedZoom } from './composables/useAnimatedZoom';
    import type { Size } from './lib/zoom';
    import type { ToolId } from './types/editor';
    import type { CropRect } from './lib/crop';
    import LevelsControls from './components/editor/controls/LevelsControls.vue';
    import type { LevelsParams } from './lib/levels';
    import CurvesControls from './components/editor/controls/CurvesControls.vue';
    import type { CurvesParams } from './lib/curves';
    import ColorModeControls from './components/editor/controls/ColorModeControls.vue';
    import BrightnessContrastControls from './components/editor/controls/BrightnessContrastControls.vue';
    import BrushControls from './components/editor/controls/BrushControls.vue';
    import BrushOverlay from './components/editor/canvas/BrushOverlay.vue';
    import type { BrightnessContrastParams } from './lib/brightnessContrast';
    import ExportDialog from './components/editor/dialogs/ExportDialog.vue';
    import type { PreparedExport } from './lib/imageIO';
    import type { ColorMode } from './lib/colorMode';
    import { useBrushTools } from './composables/useBrushTools';

    const {
        bitmap, info, documentId, status, error, isBusy, importImage, exportImage, cropImage, rotateImage,
        resizeImage, levelsImage, curvesImage, colorModeImage, flipImage, brightnessContrastImage, brushImage,
        renameImage, dismissError, closeImage,
        canUndo, canRedo, undo, redo, originalFileSize,
    } = useImageDocument();

    const viewportSize = ref<Size>({ width: 0, height: 0 });
    const rotationPreview = ref<QuarterTurns>(0);
    const flipHPreview = ref(false);
    const flipVPreview = ref(false);
    const imageSize = computed<Size | null>(() =>
        bitmap.value ? rotatedSize(bitmap.value, rotationPreview.value) : null,
    );
    const { zoom, targetZoom, isFit, canZoomIn, canZoomOut, zoomIn, zoomOut, fitToView, actualSize, setZoom } = useAnimatedZoom(
        imageSize,
        viewportSize,
        documentId,
    );

    const activeTool = ref<ToolId | null>(null);
    const exportOpen = ref(false);
    const brush = useBrushTools({ activeTool, bitmap, isBusy, brushImage });
    const { settings: brushSettings, strokes: brushStrokes, hasPending: hasPendingBrush } = brush;
    const popupOpen = computed(() => exportOpen.value
        || activeTool.value === 'levels'
        || activeTool.value === 'curves'
        || activeTool.value === 'color-mode'
        || activeTool.value === 'brightness-contrast');
    const rulersEnabled = shallowRef(false);
    const rulersStorageKey = 'image-editor-rulers';

    try {
        const savedRulers = localStorage.getItem(rulersStorageKey);
        if (savedRulers === 'true' || savedRulers === 'false') {
            rulersEnabled.value = savedRulers === 'true';
        } else if (savedRulers !== null) {
            console.warn('Ignoring an invalid saved rulers preference:', savedRulers);
        }
    } catch (error) {
        console.warn('Unable to restore the saved rulers preference:', error);
    }

    function toggleRulers() {
        rulersEnabled.value = !rulersEnabled.value;
        try {
            localStorage.setItem(rulersStorageKey, String(rulersEnabled.value));
        } catch (error) {
            console.warn('Unable to save the rulers preference:', error);
        }
    }

    function openExport() {
        if (!bitmap.value || isBusy.value) return;
        activeTool.value = null;
        dismissError();
        exportOpen.value = true;
    }

    // Pending brush strokes are undone one at a time before document history.
    const canUndoEdit = computed(() => hasPendingBrush.value || canUndo.value);
    const canRedoEdit = computed(() => !hasPendingBrush.value && canRedo.value);

    function undoEdit() {
        if (hasPendingBrush.value) brush.undoStroke();
        else undo();
    }

    function redoEdit() {
        if (canRedoEdit.value) redo();
    }

    async function downloadExport(prepared: PreparedExport) {
        if (await exportImage(prepared)) exportOpen.value = false;
    }
    const isDarkMode = ref(true);
    const themeStorageKey = 'image-editor-theme';

    try {
        const savedTheme = localStorage.getItem(themeStorageKey);
        if (savedTheme === 'light' || savedTheme === 'dark') {
            isDarkMode.value = savedTheme === 'dark';
        } else if (savedTheme !== null) {
            console.warn('Ignoring an invalid saved theme preference:', savedTheme);
        }
    } catch (error) {
        console.warn('Unable to restore the saved theme preference:', error);
    }

    document.documentElement.dataset.theme = isDarkMode.value ? 'dark' : 'light';

    function toggleTheme() {
        isDarkMode.value = !isDarkMode.value;
        const theme = isDarkMode.value ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem(themeStorageKey, theme);
        } catch (error) {
            console.warn('Unable to save the theme preference:', error);
        }
    }

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

    async function applyRotation(turns: QuarterTurns) {
        if (await rotateImage(turns)) activeTool.value = null;
    }

    async function applyRotationWithFlips(turns: QuarterTurns, flipH: boolean, flipV: boolean) {
        if (flipH && !(await flipImage(true))) return;
        if (flipV && !(await flipImage(false))) return;
        if (turns !== 0 && !(await rotateImage(turns))) return;
        activeTool.value = null;
    }

    async function applyLevels(levels: LevelsParams) {
        if (await levelsImage(levels)) activeTool.value = null;
    }

    const levelsPreview = ref<LevelsParams | null>(null);
    const curvesPreview = ref<CurvesParams | null>(null);
    const colorModePreview = ref<ColorMode | null>(null);
    const brightnessContrastPreview = ref<BrightnessContrastParams | null>(null);

    async function applyBrightnessContrast(params: BrightnessContrastParams) {
        if (await brightnessContrastImage(params)) activeTool.value = null;
    }

    async function applyCurves(curves: CurvesParams) {
        if (await curvesImage(curves)) activeTool.value = null;
    }

    async function applyColorMode(mode: ColorMode) {
        if (await colorModeImage(mode)) activeTool.value = null;
    }

    watch(activeTool, () => {
        rotationPreview.value = 0;
        flipHPreview.value = false;
        flipVPreview.value = false;
        levelsPreview.value = null;
        curvesPreview.value = null;
        colorModePreview.value = null;
        brightnessContrastPreview.value = null;
    });

    watch(bitmap, () => {
        activeTool.value = null;
        exportOpen.value = false;
    });

    function handleEditorShortcut(event: KeyboardEvent) {
        if (!event.ctrlKey || event.altKey || event.metaKey) return;
        const target = event.target;
        if (
            target instanceof HTMLElement
            && (target.isContentEditable
                || target instanceof HTMLInputElement
                || target instanceof HTMLTextAreaElement
                || target instanceof HTMLSelectElement)
        ) return;

        const key = event.key.toLowerCase();
        if (key === '+' || key === '=') {
            event.preventDefault();
            if (canZoomIn.value) zoomIn();
        } else if (key === '-') {
            event.preventDefault();
            if (canZoomOut.value) zoomOut();
        } else if (key === 'z' && !event.shiftKey) {
            event.preventDefault();
            if (!popupOpen.value && canUndoEdit.value) undoEdit();
        } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
            event.preventDefault();
            if (!popupOpen.value) redoEdit();
        }
    }

    function warnBeforeUnloadWithBrushStrokes(event: BeforeUnloadEvent) {
        if (!hasPendingBrush.value) return;
        event.preventDefault();
        event.returnValue = '';
    }

    onMounted(() => {
        window.addEventListener('keydown', handleEditorShortcut);
        window.addEventListener('beforeunload', warnBeforeUnloadWithBrushStrokes);
    });
    onBeforeUnmount(() => {
        window.removeEventListener('keydown', handleEditorShortcut);
        window.removeEventListener('beforeunload', warnBeforeUnloadWithBrushStrokes);
    });
</script>

<template>
    <div class="editor">
        <EditorTopBar
            :key="documentId"
            class="editor__top-bar"
            :image="info"
            :busy="isBusy"
            :is-dark-mode="isDarkMode"
            :rulers-enabled="rulersEnabled"
            @rename="renameImage"
            @toggle-theme="toggleTheme"
            @toggle-rulers="toggleRulers"
            @close="closeImage"
        />
        <EditorToolRail
            class="editor__tool-rail"
            :active-tool="activeTool"
            :has-image="bitmap !== null"
            :busy="isBusy"
            :popup-open="popupOpen"
            :can-zoom-in="canZoomIn"
            :can-zoom-out="canZoomOut"
            :can-undo="canUndoEdit"
            :can-redo="canRedoEdit"
            @select-tool="selectTool"
            @import="importImage"
            @export="openExport"
            @zoom-in="zoomIn"
            @zoom-out="zoomOut"
            @undo="undoEdit"
            @redo="redoEdit"
        />
        <EditorCanvas
            :key="documentId"
            class="editor__canvas"
            :inert="popupOpen"
            :bitmap="bitmap"
            :zoom="zoom"
            :rulers-enabled="rulersEnabled"
            :pan-enabled="activeTool === 'pan'"
            :crop-enabled="activeTool === 'crop'"
            :busy="isBusy"
            :loading="status === 'loading'"
            :error="error"
            :levels-preview="levelsPreview"
            :curves-preview="curvesPreview"
            :color-mode-preview="colorModePreview"
            :brightness-contrast-preview="brightnessContrastPreview"
            :rotation-preview="rotationPreview"
            :flip-h-preview="flipHPreview"
            :flip-v-preview="flipVPreview"
            @import="importImage"
            @dismiss-error="dismissError"
            @viewport-resize="viewportSize = $event"
            @zoom-in="zoomIn"
            @zoom-out="zoomOut"
            @crop="(crop, angle) => applyCrop(crop, angle)"
            @cancel-crop="activeTool = null"
        >
            <template #overlay>
                <ZoomControls
                    :disabled="popupOpen"
                    :zoom="zoom"
                    :display-zoom="targetZoom"
                    :is-fit="isFit"
                    :image-size="imageSize"
                    :rulers-enabled="rulersEnabled"
                    @fit="fitToView"
                    @actual-size="actualSize"
                    @zoom-change="setZoom"
                />
            </template>
        </EditorCanvas>
        <BrushOverlay
            v-if="activeTool === 'brush' && bitmap"
            :image="bitmap"
            :settings="brushSettings"
            :strokes="brushStrokes"
            @stroke="brush.addStroke"
        />
        <div
            id="editor-tool-controls"
            class="floating-tool-controls"
            :class="{ 'floating-tool-controls--with-rulers': rulersEnabled && bitmap && status !== 'loading' }"
        ></div>
        <ExportDialog
            v-if="exportOpen && bitmap && info"
            :bitmap="bitmap"
            :image="info"
            :original-size="originalFileSize"
            :busy="isBusy"
            :error="error"
            @download="downloadExport"
            @cancel="exportOpen = false"
        />
        <RotateControls
            v-if="activeTool === 'rotate' && bitmap"
            :disabled="isBusy"
            :error="error"
            @preview="(turns, flipH, flipV) => {
                rotationPreview = turns;
                flipHPreview = flipH;
                flipVPreview = flipV;
            }"
            @apply="applyRotationWithFlips"
            @cancel="activeTool = null"
        />
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
        <ColorModeControls
            v-if="activeTool === 'color-mode' && bitmap"
            :disabled="isBusy"
            :error="error"
            @preview="colorModePreview = $event"
            @apply="applyColorMode"
            @cancel="activeTool = null"
        />
        <BrightnessContrastControls
            v-if="activeTool === 'brightness-contrast' && bitmap"
            :image="bitmap"
            :disabled="isBusy"
            :error="error"
            @preview="brightnessContrastPreview = $event"
            @apply="applyBrightnessContrast"
            @cancel="activeTool = null"
        />
        <BrushControls
            v-if="activeTool === 'brush' && bitmap"
            :settings="brushSettings"
            :disabled="isBusy"
            :can-apply="hasPendingBrush"
            :error="error"
            @update:settings="brush.updateSettings"
            @apply="brush.apply"
            @cancel="brush.cancel"
        />
    </div>
</template>

<style scoped>
.editor {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
    grid-template-areas:
        'top-bar top-bar'
        'tool-rail canvas';
    height: 100%;
}

.editor__top-bar {
    grid-area: top-bar;
}

.editor__tool-rail {
    grid-area: tool-rail;
}

.editor__canvas {
    grid-area: canvas;
}

.floating-tool-controls {
    position: fixed;
    top: 60px;
    right: 12px;
    left: 61px;
    z-index: 20;
    display: flex;
    justify-content: center;
    pointer-events: none;
}

.floating-tool-controls:empty {
    display: none;
}

.floating-tool-controls--with-rulers {
    top: 80px;
}

</style>
