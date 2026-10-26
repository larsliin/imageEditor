# Image Editor

## Purpose and scope

Build a lightweight Vue 3 image editor for basic cropping, scaling/resizing,
and simple color adjustments. Keep the interface approachable and focused on
these operations. Do not introduce advanced editing tools, layers, accounts,
or backend services unless explicitly requested.

## Stack and implementation

- Use Vue 3 single-file components with the Composition API and
  `<script setup lang="ts">`.
- Keep TypeScript types explicit at image-processing boundaries; avoid `any`.
- Use the existing Vite setup and npm scripts. Prefer browser APIs for image
  processing; add dependencies only when they provide a clear benefit.
- Separate image transformations and coordinate calculations from UI
  components so they can be tested independently.
- Process images locally in the browser by default. Do not upload images or
  image metadata without an explicit requirement.

## Editing behavior

- Preserve the original image so adjustments can be reset without accumulating
  quality loss.
- Distinguish source-image pixel coordinates from preview/display coordinates.
  Cropping and export must remain accurate at different preview sizes.
- Validate crop bounds and resize dimensions; prevent empty crops and invalid
  or zero-sized output. Preserve aspect ratio by default when resizing.
- Keep previews consistent with exported results, including the order of crop,
  resize, and color adjustments.
- Handle image loading, decoding, processing, and export failures with clear
  user-facing feedback. Never silently discard edits.
- Release object URLs and other image resources when no longer needed. Avoid
  unnecessary full-resolution processing during continuous UI interactions.

## Interface

- Provide labeled controls, keyboard-accessible actions, and visible focus
  states. Do not rely on color alone to convey state.
- Disable image-dependent actions until an image is ready, and communicate
  loading or processing states.

## Validation

- Run `npm run build` after code changes; it includes TypeScript checking and
  the production build. Use `npm run dev` for interactive validation.
- No test runner is configured yet. When tests are introduced, prioritize crop
  coordinate conversion, resize dimensions/aspect ratios, reset behavior, and
  preview/export consistency.
- Verify image-related changes with landscape and portrait images,
  transparency, and invalid inputs as applicable.
