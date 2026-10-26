# Image Editor

A browser-based image editor for making straightforward edits without sending
images to a server. The current working version focuses on cropping and on a
reliable image-preview, import, and export workflow.

## Current features

- **Import images** from your device. Image decoding and editing happen locally
  in the browser; files are not uploaded.
- **Crop** by dragging over the preview or entering exact X, Y, width, and height
  values in image pixels in the top bar. Apply with **Apply crop** or Enter; use **Cancel** or
  Escape to discard the selection. Switching tools also cancels an unapplied
  selection. Hold **Shift** while dragging to constrain the selection to a
  1:1 square; press or release Shift mid-drag to toggle the constraint.
  Drag inside a selected area to move it without resizing; movement stays inside
  the image. Drag outside the selection to draw a new crop.
  Drag any corner or side handle to resize the crop. Hold **Shift** while
  dragging a corner to resize to a 1:1 square with the opposite corner fixed.
  Press or release Shift mid-drag to toggle the constraint. Focus a handle and
  use arrow keys for one-pixel adjustments. Resizing cannot cross the opposite edge
  or extend outside the image.
- **Zoom and pan** around the preview, including fit-to-window and actual-size
  views. Fit-to-window scales smaller images up and larger images down to the
  available preview area, within the 1%-3200% zoom range. Actual size shows the
  image at 100%. Hold Space to pan while using the crop tool.
- **Resize** opens a modal with synchronized width and height fields in both
  pixels and percentages, visible together. Editing either unit updates the other.
  The aspect-ratio lock is centered between both rows and is locked by default;
  unlock it to set dimensions independently in either unit. Percentages are relative
  to the image size when the dialog opens (100%) and support fractional values.
  Results are rounded to the
  nearest whole pixel, with a minimum of 1 pixel. Each side must be between 1
  and 16384 pixels. **Apply resize** or Enter applies
  the change; **Cancel** or Escape discards it. Processing failures are shown
  inside the modal without discarding the entered dimensions.
- **Download the edited image** at its full pixel resolution. PNG, JPEG, and WebP
  files are exported in their original format; other formats are exported as
  PNG. Downloading creates a new file and does not overwrite the source.
- **Rename the image** with the pen icon next to the filename. Press Enter or
  click away to save, or Escape to cancel. The input sizes to its content up to
  32rem (or 40% of the viewport). Downloads use the new name with the extension
  matching the export format. Renaming does not change the source file, and
  resetting image edits keeps the chosen name.
- **Reset to original** to discard edits and restore the imported image.
- **Undo and redo** from the left toolbar. History keeps only the last three
  applied edits, including reset, filename, and export-format changes. Unapplied
  previews do not count. A new edit after undo clears redo; opening another image
  clears all history. Discarded history bitmaps are released to limit memory use.
- **Unsaved-edit protection** warns before opening another image or leaving the
  page if edits have not been downloaded. The browser cannot confirm whether a
  download finishes.

Levels and Curves are shown in the toolbar but are not implemented yet.

Tool dialogs share `src/components/editor/ToolModal.vue`: provide a title,
apply label, validity, busy/error state, and tool-specific fields through its
default slot. It emits `apply` and `cancel` and handles modal focus, keyboard
navigation, and shared actions. Mount it conditionally while the tool is open.
All tool dialogs use the same panel styling and a transparent backdrop so the
image preview is never dimmed while a dialog is open.

## Development

Requires Node.js 22.18+ (or 24.12+).

```sh
npm install
npm run dev
```

## Build and type-check

```sh
npm run build
```

## Tests

Run the crop-coordinate and zoom tests with Node.js 22.18 or later:

```sh
node --test src/lib/__tests__/crop.test.ts src/lib/__tests__/zoom.test.ts src/lib/__tests__/useZoom.test.ts
```

Run the bounded undo/redo history and bitmap-lifecycle regression tests:

```sh
node --test src/lib/__tests__/useImageDocument.test.ts
```

## Tech stack

Vue 3, TypeScript, and Vite. Image rendering and export use browser APIs,
including `ImageBitmap` and canvas.
