// hairline/runtime/kernel — the HL object a Marks figure reads (`const { … } = HL`), as the hairline-create
// kernel builds it: the package's src/core, with register() from the shared vpk frame loop (./stage.mjs) and
// the stylesheet written by the page (./styles.mjs).
export * from "../vendor/packages/hairline/src/core/iso.ts";
export * from "../vendor/packages/hairline/src/core/motion.ts";
export * from "./stage.mjs";
export * from "./styles.mjs";
