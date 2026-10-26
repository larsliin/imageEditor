# Image Editor

## Purpose and scope

Build a lightweight Vue 3 image editor for basic cropping, scaling/resizing,
and simple color adjustments. Keep the interface approachable and focused on
these operations. Do not introduce advanced editing tools, layers, accounts,
or backend services unless explicitly requested.

## Stack and implementation

- Use Vue 3 single-file components with the Composition API and
  `<script setup lang="ts">`.
- Vue component and composable files must not exceed 500 lines. If a file
  would exceed this limit, split components into smaller focused components
  and composable logic into smaller composables or focused utilities.
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

### Git: never commit or push without permission

If multiple files have been edited, first ask: "Should the files be committed as one commit or in related commits?"

**Never** run `git commit` or `git push` (or any equivalent) on your own — not even when you have permission to execute commands without confirmation. Always ask the user first and wait for an explicit "yes" before committing or pushing. This applies to every branch, every change, and every situation, no exceptions.

Do not ask the user to provide or approve a commit message. Infer a concise, appropriate commit message from the changes.

When asking for permission or gathering additional information needed for the commit:
- Use the `vscode_askQuestions` tool to present options and collect structured user input
- Offer predefined options for commit grouping, target branch, or push destination when applicable
- Clearly describe what will happen and why you need confirmation
- Wait for the user's response before proceeding with the git operation

After a commit is successfully created, the next action must be a `vscode_askQuestions` call asking whether to push the commit(s). Do not end the turn with a status-only message or run `git push` before receiving the user's answer. Use predefined yes/no options to make this as simple as possible, and only push after an explicit yes.
