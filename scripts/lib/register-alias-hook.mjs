// Loaded with `node --import ./scripts/lib/register-alias-hook.mjs` for every unit batch.
// It resolves the tsconfig `@/*` alias to the repo root, and an extensionless specifier to
// the `.ts`/`.tsx`/`.js` file or `index` that TypeScript would pick, so a module a suite
// loads directly may use the same imports as the app. Real Node resolution runs first;
// the hook only answers specifiers Node could not resolve.

import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".cjs", ".json"];

function isFile(filePath) {
	return existsSync(filePath) && statSync(filePath).isFile();
}

// The file TypeScript's bundler resolution would choose for `base`, or null.
export function resolveFile(base) {
	if (isFile(base)) return base;
	for (const extension of EXTENSIONS) if (isFile(`${base}${extension}`)) return `${base}${extension}`;
	for (const extension of EXTENSIONS) if (isFile(`${base}/index${extension}`)) return `${base}/index${extension}`;
	// `./x.js` written for a `.ts` source.
	const withoutJs = base.replace(/\.(?:js|jsx|mjs|cjs)$/u, "");
	if (withoutJs !== base) for (const extension of [".ts", ".tsx", ".mts"]) if (isFile(`${withoutJs}${extension}`)) return `${withoutJs}${extension}`;
	return null;
}

export function aliasTarget(specifier, parentURL, root = REPO_ROOT) {
	if (specifier.startsWith("@/")) return resolveFile(`${root}${specifier.slice(2)}`);
	if ((specifier.startsWith("./") || specifier.startsWith("../")) && parentURL?.startsWith("file:")) {
		return resolveFile(fileURLToPath(new URL(specifier, parentURL)));
	}
	return null;
}

export function resolve(specifier, context, nextResolve) {
	try {
		return nextResolve(specifier, context);
	} catch (error) {
		if (error?.code !== "ERR_MODULE_NOT_FOUND" && error?.code !== "MODULE_NOT_FOUND" && error?.code !== "ERR_UNSUPPORTED_DIR_IMPORT") throw error;
		const target = aliasTarget(specifier, context.parentURL);
		if (!target) throw error;
		// require() resolves paths and import resolves URLs; answer each in its own form.
		return nextResolve(context.conditions?.includes("require") ? target : pathToFileURL(target).href, context);
	}
}

registerHooks({ resolve });
