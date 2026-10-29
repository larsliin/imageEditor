import type { ExportMimeType } from '@/lib/imageIO';

export type ToolId = 'crop' | 'resize' | 'rotate' | 'levels' | 'curves' | 'color-mode' | 'brightness-contrast' | 'pan';

export interface ToolDefinition {
    id: ToolId
    label: string
    icon: string
}

export interface ImageInfo {
    fileName: string
    width: number
    height: number
    exportMimeType: ExportMimeType
}

export const EDIT_TOOLS: readonly ToolDefinition[] = [
    { id: 'crop', label: 'Crop', icon: 'bi-crop' },
    { id: 'resize', label: 'Resize', icon: 'bi-arrows-angle-expand' },
    { id: 'rotate', label: 'Rotate image', icon: 'bi-arrow-clockwise' },
    { id: 'levels', label: 'Levels', icon: 'bi-shadows' },
    { id: 'curves', label: 'Curves', icon: 'bi-bezier' },
    { id: 'brightness-contrast', label: 'Brightness/Contrast', icon: 'bi-sun' },
    { id: 'color-mode', label: 'Color mode', icon: 'bi-circle-half' },
];

export const PAN_TOOL: ToolDefinition = { id: 'pan', label: 'Pan', icon: 'bi-arrows-move' };
