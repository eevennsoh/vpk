/*
 * runtime/iso — ws0 registry adapter for the iso-kit runtime block (integration K2 row `iso`, R13).
 * Upserts `<!-- vpk-iso:start/end -->` (iso CSS + runtime) when a document has an
 * svg[data-vpk-iso-id], and removes it when none remains. Placement and idempotency are ws0's:
 * replaced in place, inserted before the last </body> only when absent.
 * One block for every iso document, measured against ISO_BUDGET_BYTES.
 * Imports only define.mjs and the iso domain module; no file reads at import (R28).
 */

import { defineMarkedRuntime } from "./define.mjs";
import { hasIsoFigures, ISO_BUDGET_BYTES, ISO_RUNTIME_ID, isoRuntimeBlock } from "../iso/inline.mjs";

const KINDS = ["template", "demo", "illustration", "artifact"];

export const isoRuntimeStep = defineMarkedRuntime({ id: ISO_RUNTIME_ID, kinds: KINDS, appliesTo: hasIsoFigures, build: () => isoRuntimeBlock(), budgetBytes: ISO_BUDGET_BYTES });
