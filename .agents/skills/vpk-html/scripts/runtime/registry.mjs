/*
 * runtime/registry — the ordered list of in-page runtime steps the pipeline applies after
 * retrofit → font-faces → theme → nav and before enhancements (always last).
 *
 * Order is the first-insertion order. Canonical slots (integration R13):
 *   smil-starter, review, lab, iso, anatomy-hero
 * Entries are { id, kinds, apply(html, ctx) => html } or defineMarkedRuntime(...) from ./define.mjs.
 * This module imports only adapters; adapters never import it (see runtime/pipeline.mjs).
 */

import { anatomyHeroStep } from "./anatomy-hero.mjs";
import { isoRuntimeStep } from "./iso.mjs";
import { labKitStep } from "./lab.mjs";
import { reviewRuntimeStep } from "./review.mjs";
import { smilStarterStep } from "./smil-starter.mjs";

export const RUNTIME_STEPS = Object.freeze([smilStarterStep, reviewRuntimeStep, labKitStep, isoRuntimeStep, anatomyHeroStep]);
