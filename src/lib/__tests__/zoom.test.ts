import assert from 'node:assert/strict'
import test from 'node:test'
import { displaySize, fitZoom, MAX_ZOOM, MIN_ZOOM } from '../zoom.ts'

test('fit to window enlarges smaller images while preserving aspect ratio', () => {
  const viewport = { width: 1200, height: 800 }
  for (const [image, expectedZoom, expectedSize] of [
    [{ width: 400, height: 200 }, 3, { width: 1200, height: 600 }],
    [{ width: 200, height: 400 }, 2, { width: 400, height: 800 }],
    [{ width: 400, height: 400 }, 2, { width: 800, height: 800 }],
  ] as const) {
    const zoom = fitZoom(image, viewport)
    assert.equal(zoom, expectedZoom)
    assert.deepEqual(displaySize(image, zoom), expectedSize)
  }
})

test('fit to window still reduces larger images and keeps exact fits at 100%', () => {
  const viewport = { width: 1200, height: 800 }
  assert.equal(fitZoom({ width: 2400, height: 1200 }, viewport), 0.5)
  assert.equal(fitZoom({ width: 1200, height: 1600 }, viewport), 0.5)
  assert.equal(fitZoom(viewport, viewport), 1)
})

test('fit to window respects the existing zoom limits', () => {
  assert.equal(fitZoom({ width: 1, height: 1 }, { width: 1200, height: 800 }), MAX_ZOOM)
  assert.equal(fitZoom({ width: 10000, height: 10000 }, { width: 1, height: 1 }), MIN_ZOOM)
})

test('fit to window keeps the initial zoom until image and viewport sizes are available', () => {
  const size = { width: 800, height: 600 }
  assert.equal(fitZoom({ width: 0, height: 600 }, size), 1)
  assert.equal(fitZoom({ width: 800, height: 0 }, size), 1)
  assert.equal(fitZoom(size, { width: 0, height: 600 }), 1)
  assert.equal(fitZoom(size, { width: 800, height: 0 }), 1)
})
