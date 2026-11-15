const path = require("node:path");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require("./esbuild-cjs-loader.js");

/** Bundle an App Router page file and return its default export, with next/react left external. */
function loadPageComponent(pageFile) {
	const result = esbuild.buildSync({
		entryPoints: [pageFile],
		bundle: true,
		external: ["next", "react", "react-dom"],
		format: "cjs",
		jsx: "automatic",
		loader: { ".css": "empty" },
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});
	return loadCjsModuleFromText(result.outputFiles[0].text, pageFile.replace(/\.[jt]sx?$/, ".cjs")).default;
}

/**
 * Render a page that should call next/navigation redirect() and return the target URL.
 * Only the stable parts of the redirect digest are read: the NEXT_REDIRECT marker and the URL.
 */
function getRedirectTarget(Page) {
	try {
		Page();
	} catch (error) {
		const digest = typeof error?.digest === "string" ? error.digest : "";
		const [marker, , url] = digest.split(";");
		if (marker === "NEXT_REDIRECT" && url) {
			return url;
		}
		throw error;
	}
	throw new Error("Page rendered without redirecting");
}

module.exports = { getRedirectTarget, loadPageComponent };
