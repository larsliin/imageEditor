import type { Point } from './crop';
import type { Size } from './zoom';

export function clampGripOffset(
    next: Point,
    current: Point,
    grip: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
    viewport: Size,
): Point {
    const baseLeft = grip.left - current.x;
    const baseTop = grip.top - current.y;
    return {
        x: Math.max(0, Math.min(baseLeft + next.x, Math.max(0, viewport.width - grip.width))) - baseLeft,
        y: Math.max(0, Math.min(baseTop + next.y, Math.max(0, viewport.height - grip.height))) - baseTop,
    };
}
