#!/usr/bin/env node

import fs from "node:fs";
import { pathToFileURL } from "node:url";

function attribute(tag, name) {
	return tag?.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, "iu"))?.[1];
}

// Check server HTML only; client-side setGlobalTheme cannot repair first paint.
export function verifyInitialTheme(html, required = false) {
	const root = html.match(/<html\b[^>]*>/iu)?.[0];
	const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/iu)?.[1] || "";
	const styles = [...head.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/giu)];
	const themes = new Map(styles.map((match) => [attribute(match[1], "data-theme"), match[2]]));
	const dataTheme = attribute(root, "data-theme") || "";
	const detected = ["light", "dark", "spacing", "typography", "shape"].some((id) => themes.has(id));
	if (!required && !detected) return { checked: false, errors: [] };

	const errors = [];
	const colorMode = attribute(root, "data-color-mode");
	if (!["light", "dark"].includes(colorMode)) errors.push("initial HTML needs an explicit light/dark data-color-mode");
	const entries = new Map(dataTheme.split(/\s+/u).filter(Boolean).map((entry) => entry.split(":")));
	for (const role of [colorMode, "spacing", "typography", "shape"].filter(Boolean)) {
		const id = entries.get(role);
		if (!id) errors.push(`initial HTML does not activate the ${role} theme`);
		else if (!themes.get(id)?.includes("--ds-")) errors.push(`initial head lacks the active ${role} theme CSS`);
	}
	return { checked: true, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const [htmlPath, option, ...extra] = process.argv.slice(2);
		if (!htmlPath || (option && option !== "--if-present") || extra.length) {
			throw new Error("Usage: verify-initial-theme.mjs <exported-html> [--if-present]");
		}
		const result = verifyInitialTheme(fs.readFileSync(htmlPath, "utf8"), option !== "--if-present");
		if (result.errors.length) throw new Error(result.errors.join("; "));
		console.log(result.checked ? "Initial ADS theme HTML passed" : "Initial ADS theme check skipped: no inline ADS theme detected");
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
