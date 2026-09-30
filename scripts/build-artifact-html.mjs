#!/usr/bin/env node
// Packages a VPK demo into one offline HTML file for Atlassian Artifacts: the React bundle
// (rendered inside the app's Providers), Tailwind/ADS CSS, the fonts it uses, and public/
// sounds and images are all inlined.
//
//   node scripts/build-artifact-html.mjs --demo arts/awake [--title Awake] [--out <path>]
//   node scripts/build-artifact-html.mjs --entry components/foo/bar.tsx --slug bar
//
// `--demo <category>/<slug>` resolves components/website/demos/<category>/<slug>-demo.tsx;
// `--entry` takes any module whose default export is the component to render. Output
// defaults to the ignored output/artifact-html/<slug>/<slug>.html because the file is
// regenerable; automation must not write under artifacts/, so pass `--out` only for a
// destination the user chose. Fonts are fetched from the ADS and Google Fonts CDNs at build
// time, so the build needs network access. Demo-specific build hooks live in
// scripts/lib/artifact-targets/.
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import esbuild from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { installPlatformFeatureFlags, installStorageFallback, invokeInBanner } from "./lib/artifact-runtime.mjs";

const require = createRequire(import.meta.url);
const { NEXT_RUNTIME_MOCKS } = require("./lib/next-runtime-mocks.js");

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");
const GLOBALS_CSS = path.join(REPO_ROOT, "app/globals.css");
const TSCONFIG = path.join(REPO_ROOT, "tsconfig.json");

// Demo-specific hooks, keyed by `<category>/<slug>`. A hook's `prepare()` may return a
// runtime `banner` and a build `summary` line.
const TARGET_HOOKS = {
	"arts/awake": () => import("./lib/artifact-targets/awake.mjs"),
};

// The CDN font stylesheets app/layout.tsx links; keep in sync with it.
const FONT_STYLESHEETS = [
	"https://ds-cdn.prod-east.frontend.public.atl-paas.net/assets/font-rules/v5/atlassian-fonts.css",
	"https://fonts.googleapis.com/css2?family=BBH+Bartle&family=Bitcount+Grid+Single:wght@100..900&family=DotGothic16&family=JetBrains+Mono:wght@400;500;600&display=swap",
];
// The next/font/local fonts app/layout.tsx exposes as CSS variables on <html>.
const LOCAL_FONTS = [
	{ family: "ARK ES", file: "fonts/ark-es/ARK-ES-SolidLight.woff", variable: "--font-ark-es" },
	{ family: "Affigere", file: "fonts/affigere/Affigere-Regular.woff2", variable: "--font-affigere" },
	{ family: "Departure Mono", file: "fonts/DepartureMono/DepartureMono-Regular.woff2", variable: "--font-departure-mono" },
];
const FONT_SUBSETS = new Set(["latin", "latin-ext"]);
// Google Fonts only serves woff2 to user agents it recognizes as modern browsers.
const BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const MIME_TYPES = {
	".gif": "image/gif",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".mp3": "audio/mpeg",
	".mp4": "video/mp4",
	".ogg": "audio/ogg",
	".otf": "font/otf",
	".png": "image/png",
	".svg": "image/svg+xml",
	".ttf": "font/ttf",
	".wav": "audio/wav",
	".webm": "video/webm",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
};
const ASSET_EXTENSIONS = Object.keys(MIME_TYPES).map((extension) => extension.slice(1)).join("|");
// A quoted or url()-wrapped root-relative asset path, with an optional cache-busting query.
const PUBLIC_ASSET_PATTERN = new RegExp(`(["'\`(])(/[\\w./-]+\\.(?:${ASSET_EXTENSIONS}))(\\?[^"'\`)\\s]*)?(?=["'\`)])`, "gu");
// A template literal that builds a root-relative asset path at runtime (`/3p/${name}/24.svg`).
const DYNAMIC_ASSET_PATTERN = /`(\/[\w./-]*\$\{[^`]*)`/gu;

export const toDataUri = (bytes, mimeType) => `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;

const escapeHtml = (text) => text.replace(/[&<>"]/gu, (character) => ({ "\"": "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]);

async function fileExists(filePath) {
	try {
		return (await stat(filePath)).isFile();
	} catch {
		return false;
	}
}

async function fetchOk(url, init) {
	const response = await fetch(url, init);
	if (!response.ok) {
		throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
	}
	return response;
}

/**
 * Resolves CLI options into the module to render, the slug, and the hook key.
 * `--demo` wins over `--entry`; the slug defaults to the demo slug or entry file name.
 */
export function resolveTarget({ demo, entry, slug }, repoRoot = REPO_ROOT) {
	if (demo) {
		const match = /^([a-z][\w-]*)\/([a-z0-9][\w-]*)$/u.exec(demo);
		if (!match) {
			throw new Error(`--demo must look like <category>/<slug>, got "${demo}"`);
		}
		const [, category, demoSlug] = match;
		return {
			entryFile: path.join(repoRoot, "components/website/demos", category, `${demoSlug}-demo.tsx`),
			hookKey: `${category}/${demoSlug}`,
			slug: slug ?? demoSlug,
		};
	}
	if (entry) {
		const entryFile = path.resolve(repoRoot, entry);
		return { entryFile, hookKey: null, slug: slug ?? path.basename(entryFile).replace(/\.[cm]?[jt]sx?$/u, "") };
	}
	throw new Error("Pass --demo <category>/<slug> or --entry <path>.");
}

/**
 * Replaces quoted or url()-wrapped root-relative asset paths that exist under public/ with
 * data URIs. A cache-busting query (`?v=…`) is dropped along with the path.
 */
export async function inlinePublicAssets(text, { inlined = new Set(), publicDir = PUBLIC_DIR } = {}) {
	const replacements = new Map();
	for (const [, , assetPath] of text.matchAll(PUBLIC_ASSET_PATTERN)) {
		const filePath = path.join(publicDir, assetPath);
		if (!replacements.has(assetPath) && await fileExists(filePath)) {
			replacements.set(assetPath, toDataUri(await readFile(filePath), MIME_TYPES[path.extname(assetPath)]));
			inlined.add(assetPath);
		}
	}
	return text.replace(PUBLIC_ASSET_PATTERN, (match, quote, assetPath) => (replacements.has(assetPath) ? quote + replacements.get(assetPath) : match));
}

/**
 * Lists template literals that assemble public/ asset paths at runtime. They cannot be
 * inlined statically and will 404 inside the viewer's srcdoc frame, so the build reports
 * them. Only prefixes whose first segment is a real public/ folder count, which skips
 * `/api/${id}`-style routes.
 */
export async function findDynamicAssetPaths(text, { publicDir = PUBLIC_DIR } = {}) {
	const found = new Set();
	for (const [, template] of text.matchAll(DYNAMIC_ASSET_PATTERN)) {
		const firstSegment = template.split("/")[1];
		if (firstSegment && !firstSegment.includes("${")) {
			try {
				if ((await stat(path.join(publicDir, firstSegment))).isDirectory()) found.add(template);
			} catch {
				// Not a public/ folder.
			}
		}
	}
	return [...found].sort();
}

/**
 * Picks the @font-face blocks worth embedding from a CDN stylesheet: wanted unicode subsets
 * (blocks without a subset comment are kept) of families the page actually references.
 */
export function selectFontFaces(css, { isUsed = () => true, subsets = FONT_SUBSETS } = {}) {
	return [...css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?(@font-face\s*\{[^}]*\})/gu)]
		.filter(([, subset]) => subset === undefined || subsets.has(subset))
		.map(([, , block]) => block)
		.filter((block) => {
			const family = block.match(/font-family:\s*['"]?([^;'"]+)['"]?/u)?.[1]?.trim();
			return family === undefined || isUsed(family);
		});
}

async function inlineFontStylesheet(url, isUsed) {
	const css = await (await fetchOk(url, { headers: { "User-Agent": BROWSER_USER_AGENT } })).text();
	const embedded = await Promise.all(selectFontFaces(css, { isUsed }).map(async (block) => {
		const fontUrl = block.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/u)?.[1];
		if (!fontUrl) return block;
		const resolved = new URL(fontUrl, url);
		const bytes = await (await fetchOk(resolved)).arrayBuffer();
		return block.replace(fontUrl, toDataUri(bytes, MIME_TYPES[path.extname(resolved.pathname)] ?? "font/woff2"));
	}));
	return embedded.join("\n");
}

async function inlineLocalFonts(isVariableUsed) {
	const faces = await Promise.all(LOCAL_FONTS.filter((font) => isVariableUsed(font.variable)).map(async (font) => {
		const extension = path.extname(font.file);
		const bytes = await readFile(path.join(PUBLIC_DIR, font.file));
		return `@font-face{font-family:"${font.family}";src:url(${toDataUri(bytes, MIME_TYPES[extension])}) format("${extension.slice(1)}");font-display:swap}:root{${font.variable}:"${font.family}"}`;
	}));
	return faces.join("\n");
}

/** Bundles a TS module source (with `@/` imports) for build-time use by target hooks. */
async function loadSourceModule(contents) {
	const result = await esbuild.build({
		bundle: true,
		format: "esm",
		logLevel: "warning",
		platform: "neutral",
		stdin: { contents, loader: "ts", resolveDir: REPO_ROOT },
		tsconfig: TSCONFIG,
		write: false,
	});
	return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

async function bundleScript({ banner, entryFile, workDir }) {
	const mockPlugin = {
		name: "next-runtime-mocks",
		setup(build) {
			// esbuild filters are Go regular expressions, so no `u` flag here.
			build.onResolve({ filter: /^next\/(image|link|navigation)$/ }, (args) => ({ namespace: "next-mock", path: args.path }));
			build.onLoad({ filter: /.*/, namespace: "next-mock" }, (args) => ({ contents: NEXT_RUNTIME_MOCKS[args.path], loader: "tsx", resolveDir: REPO_ROOT }));
		},
	};
	const entry = `import { createRoot } from "react-dom/client";
import { Providers } from "@/app/providers";
import Demo from ${JSON.stringify(entryFile)};

createRoot(document.getElementById("root")).render(
	<Providers>
		<main id="main-content"><Demo /></main>
	</Providers>,
);`;
	const result = await esbuild.build({
		banner: { js: banner },
		bundle: true,
		define: { "process.env.NODE_ENV": JSON.stringify("production") },
		format: "esm",
		jsx: "automatic",
		legalComments: "none",
		loader: Object.fromEntries(Object.keys(MIME_TYPES).map((extension) => [extension, "dataurl"])),
		logLevel: "warning",
		minify: true,
		outdir: workDir,
		platform: "browser",
		plugins: [mockPlugin],
		stdin: { contents: entry, loader: "tsx", resolveDir: REPO_ROOT, sourcefile: "artifact-entry.tsx" },
		target: "es2022",
		tsconfig: TSCONFIG,
		write: false,
	});
	const js = result.outputFiles.find((file) => file.path.endsWith(".js"))?.text ?? "";
	const css = result.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "";
	return { css, js };
}

/** Compiles app/globals.css with Tailwind scanning only the bundled script for class candidates. */
async function compileTailwind(bundlePath) {
	const source = (await readFile(GLOBALS_CSS, "utf8"))
		.replace(/^@source\s+[^;]+;\s*$/gmu, "")
		.replace(/^@import\s+"[^"]*excalidraw[^"]*";\s*$/gmu, "")
		.replace(/(@import\s+"tailwindcss"\s+source\(none\);)/u, `$1\n@source "${bundlePath}";`);
	const result = await postcss([tailwindcss({ optimize: { minify: true } })]).process(source, { from: GLOBALS_CSS });
	return result.css;
}

export async function buildArtifactHtml({ demo, entry, out, slug: slugOption, title: titleOption }) {
	const { entryFile, hookKey, slug } = resolveTarget({ demo, entry, slug: slugOption });
	if (!await fileExists(entryFile)) {
		throw new Error(`No module at ${path.relative(REPO_ROOT, entryFile)}. Pass --entry <path> for components without a website demo.`);
	}
	const title = titleOption ?? slug.replace(/[-_]+/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
	const outFile = path.resolve(out ?? path.join(REPO_ROOT, "output/artifact-html", slug, `${slug}.html`));

	const hook = hookKey && TARGET_HOOKS[hookKey] ? await TARGET_HOOKS[hookKey]() : null;
	const prepared = hook ? await hook.prepare({ fetchOk, loadSourceModule }) : {};
	const banner = [invokeInBanner(installPlatformFeatureFlags), invokeInBanner(installStorageFallback), prepared.banner].filter(Boolean).join("\n");

	const workDir = await mkdtemp(path.join(process.env.TMPDIR ?? tmpdir(), "artifact-html-"));
	try {
		const { css: componentCss, js: rawJs } = await bundleScript({ banner, entryFile, workDir });
		const bundlePath = path.join(workDir, "bundle.js");
		await writeFile(bundlePath, rawJs);
		const tailwindCss = await compileTailwind(bundlePath);

		// Only embed fonts the bundle or its CSS mention by family name or CSS variable.
		const usedText = `${rawJs}\n${tailwindCss}\n${componentCss}`;
		const isUsed = (needle) => usedText.includes(needle);
		const [cdnFontCss, localFontCss] = await Promise.all([
			Promise.all(FONT_STYLESHEETS.map((url) => inlineFontStylesheet(url, isUsed))).then((sheets) => sheets.join("\n")),
			inlineLocalFonts(isUsed),
		]);
		const fontCss = `${cdnFontCss}\n${localFontCss}`;

		const inlined = new Set();
		const dynamicAssetPaths = await findDynamicAssetPaths(rawJs);
		const js = (await inlinePublicAssets(rawJs, { inlined })).replaceAll("</script", "<\\/script");
		const css = (await inlinePublicAssets(`${tailwindCss}\n${componentCss}`, { inlined })).replaceAll("</style", "<\\/style");

		const html = `<!doctype html>
<html lang="en" class="light font-sans" data-color-mode="light" style="color-scheme:light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style data-source="fonts">${fontCss}</style>
<style data-source="styles">${css}</style>
</head>
<body class="antialiased">
<div id="root"></div>
<script type="module">${js}</script>
</body>
</html>
`;
		await mkdir(path.dirname(outFile), { recursive: true });
		await writeFile(outFile, html);

		const kib = (text) => `${(Buffer.byteLength(text) / 1024).toFixed(0)} KiB`;
		const lines = [
			`Wrote ${path.relative(REPO_ROOT, outFile)} (${kib(html)}: js ${kib(js)}, css ${kib(css)}, fonts ${kib(fontCss)})`,
			`Inlined public assets: ${[...inlined].sort().join(", ") || "none"}`,
			prepared.summary,
			dynamicAssetPaths.length > 0
				? `WARNING: runtime-built public/ asset paths cannot be inlined and will be missing in the viewer: ${dynamicAssetPaths.join(", ")}`
				: null,
		].filter(Boolean);
		return { dynamicAssetPaths, lines, outFile, slug, title };
	} finally {
		await rm(workDir, { force: true, recursive: true });
	}
}

async function main() {
	const { values } = parseArgs({
		options: {
			demo: { type: "string" },
			entry: { type: "string" },
			out: { type: "string" },
			slug: { type: "string" },
			title: { type: "string" },
		},
	});
	const { lines } = await buildArtifactHtml(values);
	for (const line of lines) console.log(line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
