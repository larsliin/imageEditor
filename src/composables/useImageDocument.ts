import { computed, onScopeDispose, readonly, ref, shallowRef } from 'vue'
import type { ImageInfo } from '@/types/editor'
import { isValidCrop, type CropRect } from '@/lib/crop'
import {
  canvasToBlob,
  decodeImageFile,
  downloadBlob,
  exportFileName,
  pickImageFile,
  renderToCanvas,
  resolveExportMimeType,
} from '@/lib/imageIO'

export type DocumentStatus = 'idle' | 'loading' | 'processing' | 'exporting'

interface LoadedDocument {
  original: ImageBitmap
  bitmap: ImageBitmap
  fileName: string
  mimeType: string
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function useImageDocument() {
  const current = shallowRef<LoadedDocument | null>(null)
  const status = ref<DocumentStatus>('idle')
  const error = ref<string | null>(null)
  const revision = shallowRef(0)
  const savedRevision = shallowRef(0)
  const savedFileName = shallowRef('')
  let nextRevision = 0
  let disposed = false

  const bitmap = computed(() => current.value?.bitmap ?? null)
  const info = computed<ImageInfo | null>(() =>
    current.value
      ? {
          fileName: current.value.fileName,
          width: current.value.bitmap.width,
          height: current.value.bitmap.height,
        }
      : null,
  )
  const isBusy = computed(() => status.value !== 'idle')
  const isDirty = computed(() =>
    revision.value !== savedRevision.value ||
    (current.value !== null && current.value.fileName !== savedFileName.value),
  )
  const canReset = computed(() => current.value !== null && current.value.bitmap !== current.value.original)

  function replaceDocument(next: LoadedDocument | null) {
    const previous = current.value
    if (previous?.bitmap !== previous?.original) previous?.bitmap.close()
    previous?.original.close()
    current.value = next
  }

  async function importImage() {
    if (isBusy.value) return
    const file = await pickImageFile()
    if (!file || isBusy.value || disposed) return
    if (isDirty.value && !window.confirm('Discard unsaved changes and open another image?')) return

    status.value = 'loading'
    error.value = null
    try {
      const decoded = await decodeImageFile(file)
      if (disposed) {
        decoded.close()
        return
      }
      replaceDocument({ original: decoded, bitmap: decoded, fileName: file.name, mimeType: file.type })
      revision.value = 0
      savedRevision.value = 0
      savedFileName.value = file.name
      nextRevision = 0
    } catch (e) {
      error.value = errorMessage(e, 'The image could not be opened.')
    } finally {
      status.value = 'idle'
    }
  }

  async function cropImage(crop: CropRect): Promise<boolean> {
    const doc = current.value
    if (!doc || isBusy.value) return false
    if (!isValidCrop(crop, doc.bitmap)) {
      error.value = 'Select a non-empty crop inside the image bounds.'
      return false
    }
    if (crop.x === 0 && crop.y === 0 && crop.width === doc.bitmap.width && crop.height === doc.bitmap.height) {
      return true
    }
    status.value = 'processing'
    error.value = null
    try {
      const cropped = await createImageBitmap(doc.bitmap, crop.x, crop.y, crop.width, crop.height)
      if (disposed) {
        cropped.close()
        return false
      }
      if (doc.bitmap !== doc.original) doc.bitmap.close()
      current.value = { ...doc, bitmap: cropped }
      revision.value = ++nextRevision
      return true
    } catch (e) {
      error.value = errorMessage(e, 'The image could not be cropped.')
      return false
    } finally {
      status.value = 'idle'
    }
  }

  function resetImage() {
    const doc = current.value
    if (!doc || !canReset.value || isBusy.value) return
    if (!window.confirm('Reset all edits to the original image?')) return
    doc.bitmap.close()
    current.value = { ...doc, bitmap: doc.original }
    revision.value = 0
    error.value = null
  }

  function renameImage(fileName: string) {
    const doc = current.value
    if (!doc || isBusy.value) return
    const name = fileName.trim()
    if (!name) {
      error.value = 'Enter a filename.'
      return
    }
    current.value = { ...doc, fileName: name }
    error.value = null
  }

  async function exportImage() {
    const doc = current.value
    if (!doc || isBusy.value) return

    status.value = 'exporting'
    error.value = null
    try {
      const mimeType = resolveExportMimeType(doc.mimeType)
      const blob = await canvasToBlob(renderToCanvas(doc.bitmap), mimeType)
      if (disposed) return
      downloadBlob(blob, exportFileName(doc.fileName, mimeType))
      savedRevision.value = revision.value
      savedFileName.value = doc.fileName
    } catch (e) {
      error.value = errorMessage(e, 'The image could not be saved.')
    } finally {
      status.value = 'idle'
    }
  }

  function dismissError() {
    error.value = null
  }

  function warnBeforeUnload(event: BeforeUnloadEvent) {
    if (!isDirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }

  window.addEventListener('beforeunload', warnBeforeUnload)
  onScopeDispose(() => {
    disposed = true
    window.removeEventListener('beforeunload', warnBeforeUnload)
    replaceDocument(null)
  })

  return {
    bitmap,
    info,
    status: readonly(status),
    error: readonly(error),
    isBusy,
    isDirty,
    canReset,
    importImage,
    cropImage,
    resetImage,
    renameImage,
    exportImage,
    dismissError,
  }
}
