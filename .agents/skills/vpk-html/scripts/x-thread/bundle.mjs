// Concatenating bundler for the x-thread page runtime (Node-only; never bundled itself).
//
//   bundleRuntime() → the text of <script data-vpk-x-thread-runtime>
//
// Modules are joined in BUNDLE_ORDER inside one strict IIFE. A module's top-level initializers
// may reference only earlier modules (no TDZ). Relative single-line imports of bundled modules
// and leading `export ` keywords are stripped; any other import/export at line start, or a
// non-relative import, throws. Header comments are kept, and the twitter-text notice leads.
// Test seam (C11): globalThis.__VPK_XTHREAD_TEST__ receives `exports`, and `manualBoot` skips boot.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const BUNDLE_ORDER = Object.freeze(["tlds.mjs", "twitter-text.mjs", "../json-island.mjs", "thread-model.mjs", "islands.mjs", "runtime-queue.mjs", "runtime-stretch.mjs", "runtime.mjs"]);
export const BUNDLE_NOTICE = "/* vpk-html x-thread runtime · includes a port of twitter/twitter-text (Apache-2.0, Copyright 2018 Twitter, Inc.); see the skill LICENSE */";
export const TEST_EXPORTS = Object.freeze(["parseTweet", "weightedLength", "serializeJsonIsland", "parseJsonIsland", "splitSource", "nextStep", "buildIntentUrl", "parsePostedUrl", "readIslands", "bootXThread"]);

const BUNDLED = new Set(BUNDLE_ORDER.map(file => path.resolve(HERE, file)));
const IMPORT_LINE = /^import\s+\{[^}]*\}\s+from\s+["']([^"']+)["'];?\s*$/;
const EXPORT_DECLARATION = /^export\s+(?=(?:async\s+)?function\b|const\b|let\b|class\b)/;

export function stripModule(source, file) {
	const out = [];
	for (const [index, line] of source.split("\n").entries()) {
		const where = `${path.basename(file)}:${index + 1}`;
		const imported = IMPORT_LINE.exec(line);
		if (imported) {
			const target = path.resolve(path.dirname(file), imported[1]);
			if (!/^\.\.?\//.test(imported[1])) throw new Error(`bundle: non-relative import at ${where}`);
			if (!BUNDLED.has(target)) throw new Error(`bundle: ${where} imports ${imported[1]}, which is not bundled`);
			continue;
		}
		if (EXPORT_DECLARATION.test(line)) {
			out.push(line.replace(EXPORT_DECLARATION, ""));
			continue;
		}
		if (/^(?:import|export)\b/.test(line)) throw new Error(`bundle: unsupported module syntax at ${where}: ${line.slice(0, 60)}`);
		out.push(line);
	}
	return out.join("\n").trim();
}

export function bundleRuntime() {
	const modules = BUNDLE_ORDER.map(file => {
		const abs = path.resolve(HERE, file);
		return `// ---- ${path.basename(file)} ----\n${stripModule(fs.readFileSync(abs, "utf8"), abs)}`;
	});
	return [
		"(() => {",
		"\"use strict\";",
		BUNDLE_NOTICE,
		...modules,
		"// ---- boot ----",
		"const hooks = globalThis.__VPK_XTHREAD_TEST__;",
		`if (hooks) hooks.exports = { ${TEST_EXPORTS.join(", ")} };`,
		"if (!(hooks && hooks.manualBoot) && typeof document !== \"undefined\" && document.querySelector(\"[data-vpk-x-thread]\")) bootXThread(document, window);",
		"})();",
	].join("\n");
}
