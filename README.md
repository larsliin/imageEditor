# ImageTrim

A browser-based image editor for cropping, resizing, rotating, and adjusting
images locally in your browser. Use it as a web app or load the optional
unpacked Chrome extension to open the editor from the browser toolbar.

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
  **Snap to pixel** aligns crop edges to whole source-image pixels. Enabling it
  also rounds an existing fractional selection immediately, keeping at least one
  pixel in each dimension. Snapping is off by default and the setting is saved
  locally in the browser.
  Toolbar width and height values display at most one decimal place without
  reducing the precision of the crop selection.
  Straightening automatically fits the crop inside the rotated image. An
  automatically fitted crop expands again when rotating back, including when
  resetting the angle to zero. Manual selections that still fit are preserved.
- **Zoom and pan** around the preview, including fit-to-window and actual-size
  views. Images initially open at natural size or scale down to fit. Fit-to-window
  remains available when a smaller image can be enlarged to fill the preview.
  Fit-to-window scales smaller images up and larger images down to the
  available preview area, within the 1%-3200% zoom range. Actual size shows the
  image at 100%. Hold Space to pan while using the crop tool. Release a moving
  drag to throw the preview with smoothly decaying momentum. A new pointer
  press, wheel scroll, or key press stops the motion, as do image, zoom, or
  tool changes. Holding Space through mouse release (including keyboard
  auto-repeat) or releasing Space does not cancel the throw.
  Reduced-motion preferences disable the throw effect.
- **Resize** opens a draggable toolbar with synchronized width and height fields in both
  pixels and percentages, visible together. Editing either unit updates the other.
  Fields appear in one row with the aspect-ratio lock beside the Apply and Cancel
  icon buttons. The ratio is locked by default;
  unlock it to set dimensions independently in either unit. Percentages are relative
  to the image size when the toolbar opens (100%) and use at most one decimal place.
  Results are rounded to the
  nearest whole pixel, with a minimum of 1 pixel. Each side must be between 1
  and 16384 pixels. **Apply resize** or Enter applies
  the change; **Cancel** or Escape discards it. Processing failures are shown
  inside the toolbar without discarding the entered dimensions. Like the crop
  toolbar, drag its grip to reposition it, or focus the grip and use arrow keys
  (Shift for larger steps). Home or double-clicking the grip resets its position.
  Floating toolbar and popup panels may overflow the viewport during pointer
  and keyboard moves, but their entire drag grip stays inside the window.
  A held drag continues outside the window and resumes on return, using the
  same capture, release, and focus-loss handling as the color-tool dialogs.
  Floating toolbars and popups keep fixed pixel positions when the browser window
  is resized until an edge meets their grip. Further shrinking moves the panel
  only enough to keep the entire grip inside; expanding leaves it in place.
  Reset restores their opening position.
- **Pixel rulers** toggle on and off with the **px** button in the header.
  The top and left rulers measure the current image in pixels from its top-left
  corner, tracking zoom, pan, resizing, cropping, and rotation previews.
  Both rulers span the full viewport, with unsigned distances before the
  image origin and continued coordinates beyond the image edges.
  Rulers are hidden by default; the toggle setting is saved locally in the
  browser and restored when the app opens. Rulers never appear in exported images.
  Crop, resize, and rotate toolbars open below the top ruler when it is visible.
  Fit-to-window accounts for the rulers and preserves a 24px gap between the
  image and the rulers. The zoom panel in the bottom-left corner shifts right
  to clear the vertical ruler.
- **Rotate** opens a draggable toolbar with clockwise and counterclockwise
  90-degree preview buttons, followed by Apply and Cancel icons. Apply commits
  the rotation as one undoable edit; Cancel, Escape, or switching tools discards
  the preview. Four quarter-turns return to the unchanged image.
- **Levels** adjusts the black point, midtone gamma, and white point with a
  luminosity histogram. Adjustments can be previewed, applied, or cancelled.
- **Curves** adjusts the composite RGB curve or individual red, green, and blue
  channels. Add and move curve points on the graph, edit a selected point with
  the keyboard or numeric fields, and preview or cancel before applying.
  On short desktop windows, the graph sits beside the controls to save vertical
  space. Narrow windows keep a stacked layout with a height-aware graph.
  The title and Cancel/Apply actions stay visible while the fields scroll when
  space is especially limited.
- **Color mode** converts an image to grayscale or to a black-and-white bitmap
  using a 50% threshold. Grayscale preserves transparency; bitmap conversion
  composites transparent pixels onto white and preserves the selected export format.
  Color-tool dialogs can be moved by their grip. Pointer capture keeps a held
  drag active outside the window and resumes movement on return, while the grip
  stays within reach. Releasing the button, losing capture or window focus, or
  hiding the page ends the drag; returning with no button held never moves the
  dialog. Focus the grip and use arrow keys to move it, or Home or a double-click
  to reset its position.
- **Popup workflow:** while Levels, Curves, Color mode, or Export is open,
  toolbar buttons are disabled and dimmed until you apply/download or cancel.
  Popups and floating toolbars share the same drop shadow, with no backdrop
  dimming or image filter. Only the area immediately around a panel is shaded by its
  shadow. The canvas is not interactive. Header controls (filename, pixel rulers, and theme) remain
  available. Crop, Resize, and Rotate keep their floating-toolbar workflow.
- **Switch between dark and light themes** with the theme button. The choice is
  saved locally in the browser.
- **Export** from the download icon opens an export dialog with JPEG,
  PNG, and WebP formats. JPEG and WebP offer **Very High (92%)**, **High (80%)**,
  **Medium (60%)**, and **Low (40%)** encoder quality presets; these are not
  percentages of original quality or file size. PNG is lossless.
  The dialog shows an encoded preview, original size, exact output bytes, and
  the percentage size difference. Downloads reuse the prepared file without
  encoding again, retain full pixel dimensions, and never overwrite the source.
  The compact dialog places format and quality side by side and uses a
  stable-height preview on a checkerboard (so transparency is visible) with a
  spinner while preparing the export.
  For PNG, the quality dropdown stays visible but is empty and disabled;
  switching back to JPEG or WebP restores the previous quality selection.
  JPEG composites transparency onto white; PNG and WebP retain transparency.
  Re-encoding does not guarantee a smaller file than the original.
  Encoding runs only while the dialog is open, one request at a time; rapid
  changes skip outdated results. Cancel or Escape discards export settings
  without altering the editing pixels. Other source formats default to PNG.
- **Rename the image** with the pen icon next to the filename. Press Enter or
  click away to save, or Escape to cancel.
  The header displays the full filename with its extension; renaming edits only
  the base name, with the extension determined by the export format.
  The input sizes to its content up to 32rem (or 40% of the viewport).
  Downloads use the new name with the extension
  matching the export format. Renaming changes only the download name, not the
  source file.
- **Undo and redo** from the left toolbar. History keeps only the last three
  applied edits, including image edits and filename changes.
  Unapplied previews do not count. A new edit after undo clears redo; opening
  another image clears all history. Discarded history bitmaps are released to
  limit memory use.
- **Unsaved-edit protection** warns before opening another image or leaving the
  page if edits have not been downloaded. The browser cannot confirm whether a
  download finishes.

Previews are temporary until applied. Cancel or Escape discards the current
tool's preview; applied edits are undoable. There is not currently a command to
reset the entire document to the imported image.

Color tool dialogs share `src/components/editor/ToolModal.vue`: provide a title,
apply label, validity, busy/error state, and tool-specific fields through its
default slot. It emits `apply` and `cancel` and handles modal focus, keyboard
navigation, and shared actions. Mount it conditionally while the tool is open.
Curves opts into `wideOnShortScreens` (a wider panel at viewport widths of at
least 640px and heights up to 740px) and `scrollBody` (scrolling fields with
the title and actions outside the scrolling region).
All tool dialogs use the same panel styling and a transparent backdrop so the
image preview is never dimmed while a dialog is open.
The Export dialog stays fixed in the center. In the other dialogs, drag only the centered grip to reposition the dialog. The grip also supports arrow keys
(Shift for larger steps); Home or double-clicking the grip resets its position.
Dialogs start centered each time they open. A dialog may partly extend past the
window edges, but its grip always stays inside the window so it can be dragged back.
A drag ends as soon as the pointer leaves the browser window.

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

## Chrome extension (Manifest V3)

Build a dedicated unpacked Chrome extension with type-checking:

```sh
npm run build:extension
```

1. Run `npm run build:extension`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the generated `dist-extension` folder (not the
   project root or `public` folder).
4. Pin **ImageTrim** and click its toolbar button to open the editor in a
   full browser tab. Each click opens a new editor tab. Import an image with the
   editor's file picker; the extension does not interact with images on websites.

The manifest and toolbar service worker live in `public/manifest.json` and
`public/background.js`; Vite copies them into `dist-extension` unchanged. The production
build uses relative asset paths and excludes Vue DevTools. After rebuilding,
reload the extension on `chrome://extensions` and reopen the editor tab.
The extension output is ignored by Git and kept separate from the regular
`npm run build` output in `dist`.

The body explicitly inherits the app's root typography so Chromium's injected
extension-page font defaults do not shrink inherited text compared with localhost.

No Chrome API or website permissions are requested. Import uses a user-selected
file, export uses a normal browser download, and opening an editor tab does not
require the `tabs` permission. There are no content scripts or website access.
The extension content security policy permits only packaged scripts and
disables embedded objects; it does not allow inline JavaScript or `eval`.
All image processing remains local.

Extension icons use the same design as `public/favicon.svg`, rasterized to PNG
at 16, 32, 48, and 128 pixels for the toolbar and extension manager.

This is the initial unpacked-extension setup, not a Chrome Web Store release.
Before publishing, update the version in `public/manifest.json` alongside
`package.json`.

## Tests

Run the Levels, Curves, and color-mode processing tests with Node.js 22.18 or later:

```sh
node --test src/lib/__tests__/levels.test.ts src/lib/__tests__/curves.test.ts src/lib/__tests__/colorMode.test.ts
```

Run the crop-coordinate and zoom tests with Node.js 22.18 or later:

```sh
node --test src/lib/__tests__/crop.test.ts src/lib/__tests__/zoom.test.ts src/lib/__tests__/useZoom.test.ts src/lib/__tests__/usePan.test.ts
```

Run the crop-overlay straighten regression tests:

```sh
node --test src/lib/__tests__/cropOverlay.test.ts
```

Run the popup drag and fixed-position resize regression tests:

```sh
node --test src/lib/__tests__/toolModalDrag.test.ts
```

Run the bounded undo/redo history and bitmap-lifecycle regression tests:

```sh
node --test src/lib/__tests__/useImageDocument.test.ts
```

Run the export encoding, lifecycle, and editor top-bar rename tests:

```sh
node --test src/lib/__tests__/export.test.ts src/lib/__tests__/useImageDocument.test.ts src/components/editor/__tests__/EditorTopBar.test.ts
```

## Tech stack

Vue 3, TypeScript, and Vite. Image rendering and export use browser APIs,
including `ImageBitmap` and canvas.
