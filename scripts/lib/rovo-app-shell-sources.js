// Source-contract suites that read a Rovo app shell read it through here (C-5 stopgap).
//
// C-5 moves code out of the two `rovo-app-shell.tsx` files into rovo-core. A suite that read only
// the shell file would then fail its positive assertions and, worse, keep passing its negative
// ones (`doesNotMatch`) without testing anything. Each C-5 slice adds the files it moved shell
// code into to both lists below, so the suites keep reading everything the shell is made of.
// Rendered coverage of the shells lives in `components/projects/{rovo,studio}/components/
// rovo-app-shell.behavior.test.js`; source suites are being retired separately (C-2).
"use strict";

const { readFileSync } = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../..");

// Files that now own code both shells used to carry. Slice 1: pure helpers and types.
const SHARED_SHELL_CODE_FILES = [
	"components/projects/rovo-core/lib/css-duration.ts",
	"components/projects/rovo-core/lib/rovo-app-realtime-context.ts",
	"components/projects/rovo-core/lib/rovo-app-shell-types.ts",
	"components/projects/rovo-core/lib/screen-assistant.ts",
	"lib/rovo-context.ts",
	// C-5 slice 2: sidebar chrome.
	"components/projects/rovo-core/hooks/use-rovo-app-shell-sidebar-chrome.ts",
	"components/projects/rovo-core/hooks/use-sidebar-hover-reveal.ts",
	// C-5 slice 3: artifact workspace.
	"components/projects/rovo-core/hooks/use-rovo-app-shell-artifact-workspace.ts",
	// C-5 slice 4: typed scroll anchor and timeline selection.
	"components/projects/rovo-core/hooks/use-rovo-app-shell-scroll-anchor.ts",
];

const ROVO_APP_SHELL_SOURCE_FILES = Object.freeze({
	rovo: Object.freeze(["components/projects/rovo/components/rovo-app-shell.tsx", ...SHARED_SHELL_CODE_FILES]),
	studio: Object.freeze(["components/projects/studio/components/rovo-app-shell.tsx", ...SHARED_SHELL_CODE_FILES]),
});

/** The source of the `product` shell ("rovo" or "studio") and of every file its code moved into, joined. */
function readRovoAppShellSource(product) {
	const files = ROVO_APP_SHELL_SOURCE_FILES[product];
	if (!files) {
		throw new Error(`Unknown Rovo app shell "${product}"; expected one of ${Object.keys(ROVO_APP_SHELL_SOURCE_FILES).join(", ")}.`);
	}
	return files.map((file) => readFileSync(path.join(REPO_ROOT, file), "utf8")).join("\n");
}

module.exports = { ROVO_APP_SHELL_SOURCE_FILES, readRovoAppShellSource };
