import type { Size } from './zoom';

export type QuarterTurns = 0 | 1 | 2 | 3;

export function rotatedSize(source: Size, turns: QuarterTurns): Size {
    return turns % 2 === 0
        ? { width: source.width, height: source.height }
        : { width: source.height, height: source.width };
}

export function drawRotatedImage(context: CanvasRenderingContext2D, source: ImageBitmap, turns: QuarterTurns, flipH = false, flipV = false) {
    const size = rotatedSize(source, turns);
    context.save();
    context.translate(size.width / 2, size.height / 2);
    context.rotate(turns * Math.PI / 2);
    if (flipH || flipV) context.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    context.drawImage(source, -source.width / 2, -source.height / 2);
    context.restore();
}
