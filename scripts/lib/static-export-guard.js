"use strict";

// next.config.ts switches to `output: "export"` when NEXT_OUTPUT=export. Only
// scripts/build-static-export.mjs may set it: an export build fails on the runtime-only
// app/api routes, so the wrapper moves them aside first and restores them afterwards.
const STATIC_EXPORT_WRAPPER_ENV = "VPK_STATIC_EXPORT_WRAPPER";

function assertStaticExportThroughWrapper(env = process.env) {
	if (env.NEXT_OUTPUT === "export" && env[STATIC_EXPORT_WRAPPER_ENV] !== "1") {
		throw new Error(
			"NEXT_OUTPUT=export must run through `pnpm run build:export`, which moves the runtime-only app/api routes aside for the export build and restores them afterwards.",
		);
	}
}

module.exports = { STATIC_EXPORT_WRAPPER_ENV, assertStaticExportThroughWrapper };
