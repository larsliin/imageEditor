import type { ExportMimeType } from '@/lib/imageIO';

export type ToolId = 'crop' | 'resize' | 'levels' | 'curves' | 'pan';

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
    { id: 'levels', label: 'Levels', icon: 'bi-shadows' },
    { id: 'curves', label: 'Curves', icon: 'bi-bezier' },
];

export const PAN_TOOL: ToolDefinition = { id: 'pan', label: 'Pan', icon: 'bi-arrows-move' };
