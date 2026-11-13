const assert = require("node:assert/strict");
const test = require("node:test");

const { STATIC_EXPORT_WRAPPER_ENV, assertStaticExportThroughWrapper } = require("./static-export-guard.js");

test("a raw NEXT_OUTPUT=export build is refused and points at the wrapper", () => {
	assert.throws(() => assertStaticExportThroughWrapper({ NEXT_OUTPUT: "export" }), /pnpm run build:export/u);
	assert.throws(() => assertStaticExportThroughWrapper({ NEXT_OUTPUT: "export", [STATIC_EXPORT_WRAPPER_ENV]: "0" }), /pnpm run build:export/u);
});

test("the wrapper's export build and every non-export build load the config", () => {
	assert.doesNotThrow(() => assertStaticExportThroughWrapper({ NEXT_OUTPUT: "export", [STATIC_EXPORT_WRAPPER_ENV]: "1" }));
	assert.doesNotThrow(() => assertStaticExportThroughWrapper({}));
	assert.doesNotThrow(() => assertStaticExportThroughWrapper({ NEXT_OUTPUT: "standalone" }));
});
