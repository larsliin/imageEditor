import type { Size } from './zoom'

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export function isValidCrop(crop: CropRect, image: Size): boolean {
  return (
    [crop.x, crop.y, crop.width, crop.height].every(Number.isSafeInteger) &&
    crop.x >= 0 &&
    crop.y >= 0 &&
    crop.width > 0 &&
    crop.height > 0 &&
    crop.x + crop.width <= image.width &&
    crop.y + crop.height <= image.height
  )
}

export function previewToImagePoint(
  point: Point,
  preview: { left: number; top: number; width: number; height: number },
  image: Size,
): Point {
  if (preview.width <= 0 || preview.height <= 0) {
    throw new Error('The image preview has no drawable area.')
  }
  return {
    x: Math.round(Math.max(0, Math.min(image.width, (point.x - preview.left) * image.width / preview.width))),
    y: Math.round(Math.max(0, Math.min(image.height, (point.y - preview.top) * image.height / preview.height))),
  }
}

export function cropFromPoints(start: Point, end: Point): CropRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }

}

export function squareCropFromPoints(start: Point, end: Point, image: Size): CropRect {
  const directionX = end.x < start.x ? -1 : 1
  const directionY = end.y < start.y ? -1 : 1
  const side = Math.min(
    Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)),
    directionX < 0 ? start.x : image.width - start.x,
    directionY < 0 ? start.y : image.height - start.y,
  )
  return cropFromPoints(start, {
    x: start.x + directionX * side,
    y: start.y + directionY * side,
  })
}

export function moveCrop(crop: CropRect, delta: Point, image: Size): CropRect {
  return {
    ...crop,
    x: Math.max(0, Math.min(image.width - crop.width, crop.x + delta.x)),
    y: Math.max(0, Math.min(image.height - crop.height, crop.y + delta.y)),
  }

}

export function resizeCrop(crop: CropRect, handle: CropHandle, delta: Point, image: Size, square = false): CropRect {
  let left = crop.x
  let top = crop.y
  let right = crop.x + crop.width
  let bottom = crop.y + crop.height
  if (handle.includes('w')) left = Math.max(0, Math.min(right - 1, left + delta.x))
  if (handle.includes('e')) right = Math.min(image.width, Math.max(left + 1, right + delta.x))
  if (handle.includes('n')) top = Math.max(0, Math.min(bottom - 1, top + delta.y))
  if (handle.includes('s')) bottom = Math.min(image.height, Math.max(top + 1, bottom + delta.y))
  if (square && handle.length === 2) {
    const west = handle.includes('w')
    const north = handle.includes('n')
    const anchorX = west ? right : left
    const anchorY = north ? bottom : top
    const side = Math.min(
      Math.max(right - left, bottom - top),
      west ? anchorX : image.width - anchorX,
      north ? anchorY : image.height - anchorY,
    )
    return {
      x: west ? anchorX - side : anchorX,
      y: north ? anchorY - side : anchorY,
      width: side,
      height: side,
    }
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}
