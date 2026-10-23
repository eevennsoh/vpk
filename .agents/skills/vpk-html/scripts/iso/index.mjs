// iso/index — the iso-kit API (engine id `iso-kit`; references/illustrations.md § Using the kit).
//
// Build time (Node):
//   validateBrief(brief) → string[]                 vpk-iso-brief/1 checks (scene.mjs)
//   buildScene(brief) → Scene                        camera fit, painter order, layers, guides, labels
//   renderFigure(scene, { src }) → { region, svg, sizes }
//   renderIsoFigure(brief, { src }) → { region, sizes: { region, svg } }   (ws4b engine demo)
//   buildFigure({ brief, … }) → page / fragment      build-figure.mjs; never writes
//   injectIsoFigures(file, { check })                --inject: rebuild src regions, meta, pipeline
//   auditHtml(html) / auditHtmlFile(file) / formatFindings(result)   A1–A12, A15–A17
//   isoStyleTag(), isoRuntimeScript(), isoRuntimeBlock(), hasIsoFigures(html)   the `vpk-iso` block
// Browser: window.vpkIso (runtime.mjs), motion through window.vpkFrameLoop (runtime/frame-loop.mjs).
// Camera: figures/camera.mjs FIGURE_CAMERA; page shell: figures/page.mjs illustrationPage().

export { CAMERA_PRESETS, BRIEF_SCHEMA_ID, ENGINE_ID, BriefError, buildScene, projectionFor, resolveCamera, validateBrief } from "./scene.mjs";
export { ALLOWED_ISO_TOKENS, DARK_TONE_OVERRIDES, ISO_PRESET, KIT_STYLE, STROKE_SET, isAllowedIsoPaint, presetFor, rolesFor } from "./palette.mjs";
export { enterAnimation, fadeAnimation, manualTiming } from "./motion.mjs";
export { renderDefs, renderFigure, renderLabels, renderPart, renderPlate, renderRegion, renderSvg } from "./emit.mjs";
export { auditHtml, auditHtmlFile, auditScene, auditSvg, formatFindings } from "./audit.mjs";
export { ISO_BUDGET_BYTES, ISO_RUNTIME_ID, hasIsoFigures, isoRuntimeBlock, isoRuntimeBlockBody, isoRuntimeScript, isoStyleTag } from "./inline.mjs";
export { buildFigure, injectIsoFigures, injectIsoRegions, loadBrief, renderIsoFigure } from "./build-figure.mjs";
export { ISO_CSS } from "./runtime-css.mjs";
