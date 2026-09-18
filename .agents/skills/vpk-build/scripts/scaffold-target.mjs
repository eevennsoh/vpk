#!/usr/bin/env node
/**
 * scaffold-target.mjs
 *
 * Reads an extraction plan produced by trace-imports.mjs and materializes a
 * standalone sibling Next.js project. Copies files verbatim (preserving
 * repo-relative paths so `@/*` imports resolve without rewriting), fills in
 * templated scaffold files, copies the public asset tree, and initializes a git repo.
 *
 * Usage:
 *   node scaffold-target.mjs <plan.json> [--target <dir>] [--force]
 *
 * The route entry (app/<route>/page.tsx) is promoted to app/page.tsx so the
 * extracted project serves the prototype at `/`. The original route's import
 * of loadDemoComponent is rewritten to import the demo component directly,
 * since the demo-registry-loader.ts dispatcher is intentionally not copied.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, execSync } from "node:child_process";
import { writeBackendDeploymentHarness, writeBackendServiceDescriptor } from "./backend-deploy-harness.mjs";
import { validateScaffoldTarget } from "./scaffold-target-safety.mjs";

const SKILL_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const SCAFFOLD_DIR = path.join(SKILL_ROOT, "references", "scaffold");
const MICROS_DIR = path.join(SKILL_ROOT, "references", "micros");

// -------- CLI ------------------------------------------------------------

function parseArgs(argv) {
	const args = { plan: null, target: null, force: false, backendBacked: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--target") args.target = argv[++i];
		else if (a === "--force") args.force = true;
		else if (a === "--backend-backed") args.backendBacked = true;
		else if (a.startsWith("--")) throw new Error(`Unknown flag: ${a}`);
		else if (!args.plan) args.plan = a;
	}
	if (!args.plan) {
		throw new Error("Usage: scaffold-target.mjs <plan.json> [--target <dir>] [--backend-backed] [--force]");
	}
	return args;
}

function readJSON(p) {
	return JSON.parse(fs.readFileSync(p, "utf8"));
}

// -------- Route promotion -------------------------------------------------

/**
 * Rewrite `app/<route>/page.tsx` so it renders directly without going through
 * loadDemoComponent. We replace the blacklisted dispatcher call with a direct
 * import from components/website/demos/<category>/<slug>-demo. If the page
 * doesn't use loadDemoComponent, we copy it verbatim.
 */
function rewriteRoutePage(sourceCode) {
	// Match a loadDemoComponent("slug", "category") call site
	const callMatch = sourceCode.match(
		/loadDemoComponent\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]\s*\)/,
	);
	if (!callMatch) return sourceCode;

	const [, slug, category] = callMatch;
	const demoImportPath = `@/components/website/demos/${category}/${slug}-demo`;
	const demoIdentifier = toPascalCase(`${slug}-demo`);

	// Strip the dispatcher import, Suspense/use ceremony, and render the demo
	// component directly. This produces a tiny client page that any extracted
	// route can use regardless of what the original VPK wrapper looked like.
	return `"use client";

import ${demoIdentifier} from "${demoImportPath}";

export default function Page() {
	return <${demoIdentifier} />;
}
`;
}

function toPascalCase(kebab) {
	return kebab
		.split(/[-_]/)
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

// -------- Context + layout composition ----------------------------------

/**
 * Grep a context file's source for exported provider components. The VPK
 * convention is `export function <Name>Provider(...) { ... }`. We return the
 * set of Provider names to wrap the layout with.
 */
function parseProviderExports(source) {
	const names = new Set();
	const re = /export\s+function\s+([A-Z][A-Za-z0-9_]*Provider)\s*\(/g;
	let match;
	while ((match = re.exec(source)) !== null) names.add(match[1]);
	return [...names];
}

const PROVIDERS_REQUIRING_INSTANCE_PROPS = new Set(["WorkItemModalProvider"]);

/**
 * Skip providers that cannot mount from `{children}` alone. Parse the
 * colocated `*ProviderProps` type when present; always skip known
 * instance-owned providers such as WorkItemModalProvider.
 */
function providerNeedsInstanceProps(source, name) {
	if (PROVIDERS_REQUIRING_INSTANCE_PROPS.has(name)) return true;
	const inlineRe = new RegExp(
		`export\\s+function\\s+${name}\\s*\\(\\s*\\{[^}]*\\}\\s*:\\s*(?:Readonly\\s*<\\s*)?\\{([\\s\\S]*?)\\}\\s*>?\\s*\\)`,
	);
	const inline = source.match(inlineRe);
	if (inline && hasRequiredNonChildrenProp(inline[1])) return true;
	const ifaceRe = new RegExp(
		`(?:interface|type)\\s+${name}Props\\b[^{]*\\{([\\s\\S]*?)\\n\\}`,
	);
	const iface = source.match(ifaceRe);
	if (!iface) return false;
	return hasRequiredNonChildrenProp(iface[1]);
}

function hasRequiredNonChildrenProp(typeBody) {
	const propRe = /^\s*([A-Za-z0-9_]+)(\?)?\s*:/gm;
	let match;
	while ((match = propRe.exec(typeBody)) !== null) {
		if (match[1] === "children") continue;
		if (!match[2]) return true;
	}
	return false;
}

function readPnpmCatalog(repoRoot) {
	const yamlPath = path.join(repoRoot, "pnpm-workspace.yaml");
	if (!fs.existsSync(yamlPath)) return {};
	const catalog = {};
	let inCatalog = false;
	for (const rawLine of fs.readFileSync(yamlPath, "utf8").split("\n")) {
		const line = rawLine.replace(/\s+#.*$/, "");
		if (!inCatalog) {
			if (/^catalog:\s*$/.test(line)) inCatalog = true;
			continue;
		}
		if (/^\S/.test(line) && line.trim() !== "") break;
		const match = line.match(/^\s+['"]?([^'"#:]+)['"]?\s*:\s*['"]?([^'"#\s]+)['"]?\s*$/);
		if (match) catalog[match[1].trim()] = match[2].trim();
	}
	return catalog;
}

function readPnpmYamlSection(repoRoot, sectionName) {
	const yamlPath = path.join(repoRoot, "pnpm-workspace.yaml");
	if (!fs.existsSync(yamlPath)) return "";
	const lines = fs.readFileSync(yamlPath, "utf8").split("\n");
	const start = lines.findIndex((line) => line === `${sectionName}:`);
	if (start < 0) return "";
	let end = start + 1;
	while (end < lines.length && (lines[end] === "" || /^\s/.test(lines[end]))) end += 1;
	return `${lines.slice(start, end).join("\n").trimEnd()}\n`;
}

function resolveCatalogSpecifier(pkgName, version, catalog) {
	if (version !== "catalog:") return version;
	return catalog[pkgName] || version;
}

function resolvePinnedVersion(pkgName, rootManifest) {
	const deps = rootManifest.dependencies || {};
	const dev = rootManifest.devDependencies || {};
	return deps[pkgName] || dev[pkgName] || null;
}

function collectLocalCssImportsFromText(cssText, fromDir) {
	const found = [];
	const re = /@import\s+["'](\.\.?\/[^"']+\.css)["']/g;
	let match;
	while ((match = re.exec(cssText)) !== null) {
		found.push(path.posix.normalize(path.posix.join(fromDir, match[1])));
	}
	return found;
}

function rewriteShadcnCssImport(css) {
	return css.replace(
		/@import\s+["']shadcn\/tailwind\.css["']/g,
		'@import "../node_modules/shadcn/dist/tailwind.css"',
	);
}

/**
 * Build a layout.tsx that injects @atlaskit/tokens CSS at runtime (the
 * package ships no static CSS file — all tokens are generated via the
 * getThemeStyles JS API), imports Tailwind's semantic theme, wraps with
 * ThemeWrapper, and nests any detected providers. Providers wrap in
 * alphabetical order (the order contextFiles came out of the trace);
 * if a provider needs to be inside another, the user reorders manually.
 */
function composeLayout({ targetName, routeSlug, providers, includeDemoGoogleFonts }) {
	const providerImports = providers
		.map(p => `import { ${p.name} } from "${p.importPath}";`)
		.join("\n");

	// Build nested JSX: outermost provider opens first, innermost wraps {children}.
	let body = `{children}`;
	for (let i = providers.length - 1; i >= 0; i--) {
		const { name } = providers[i];
		body = `<${name}>\n\t\t\t\t\t${body}\n\t\t\t\t</${name}>`;
	}
	body = `<ThemeWrapper>\n\t\t\t\t${body}\n\t\t\t</ThemeWrapper>`;
	const demoGoogleFontLinks = includeDemoGoogleFonts ? `
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link href="https://fonts.googleapis.com/css2?family=BBH+Bartle&family=Bitcount+Grid+Single:wght@100..900&family=DotGothic16&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />` : "";

	// Client-side FeatureGates shim is rendered inside <body> as a trivial
	// component. Its module-level side effect installs the resolver on the
	// client's globalThis before @atlaskit/tokens runs during hydration —
	// mirrors what VPK's providers.tsx does. Without it the browser
	// logs "error checking the feature gate" the first time a token lookup
	// fires. Using a component (not a bare <script>) avoids React's
	// "encountered a script tag while rendering" dev warning.

	return `// IMPORTANT: this import MUST come first. It's a side-effect import that
// installs a FeatureGates resolver on globalThis before @atlaskit/tokens
// loads. ES modules hoist imports to the top of module execution order, so
// a bare assignment earlier in this file would still run AFTER the tokens
// package's own top-level init. Splitting the shim into a separate file
// and importing it first is the only way to guarantee side-effect order.
import "./feature-flags-shim";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { getThemeHtmlAttrs } from "@atlaskit/tokens/get-theme-html-attrs";
import { getThemeStyles } from "@atlaskit/tokens/get-theme-styles";

// globals.css orchestrates the CSS pipeline:
//   1. tailwind-theme.css  — @theme vars aliased to --ds-* tokens
//   2. shadcn-theme.css    — shadcn/ui semantic tokens (bg-card, text-foreground)
//   3. @import "tailwindcss" — actually emits utility classes. Without this,
//      @theme defines vars but no .flex / .bg-surface rules exist.
//   4. tw-animate-css       — animate-in/fade-in utilities for dropdowns/tooltips
// --ds-* variable *values* come from the runtime-injected styles below
// (getThemeStyles). @atlaskit/tokens ships no static CSS.
import "./globals.css";

import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { cn } from "@/lib/utils";
// Client-side counterpart to feature-flags-shim.ts — installs the resolver
// on the browser globalThis during hydration.
import { FeatureFlagsShim } from "./feature-flags-shim-client";
${providerImports ? "\n" + providerImports + "\n" : ""}
// Fonts — VPK prototypes reference --font-sans and --font-ark-es as CSS
// variables. Without these declarations the fonts fall back to browser
// defaults and the prototype's typography looks wrong (big display digits
// in particular lose the ARK-ES character).
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const arkEsSolidLight = localFont({
	src: "../public/fonts/ark-es/ARK-ES-SolidLight.woff",
	variable: "--font-ark-es",
	display: "swap",
});

const THEME_STATE = {
	colorMode: "light" as const,
	light: "light" as const,
	dark: "dark" as const,
	spacing: "spacing" as const,
	typography: "typography" as const,
	shape: "shape" as const,
};

export const metadata: Metadata = {
	title: "${targetName}",
	description: "Extracted from VPK /${routeSlug}",
};

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const themeStyles = await getThemeStyles(THEME_STATE);

	return (
		<html lang="en" className="light" {...getThemeHtmlAttrs(THEME_STATE)} suppressHydrationWarning>
			<head>
				{themeStyles.map((style) => (
					<style
						key={style.id}
						{...style.attrs}
						dangerouslySetInnerHTML={{ __html: style.css }}
					/>
				))}
				{/* Atlassian Sans — the ADS token runtime references this family. */}
				<link rel="preconnect" href="https://ds-cdn.prod-east.frontend.public.atl-paas.net" />
				<link rel="preload" href="https://ds-cdn.prod-east.frontend.public.atl-paas.net/assets/fonts/atlassian-sans/v3/AtlassianSans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
				<link rel="preload stylesheet" href="https://ds-cdn.prod-east.frontend.public.atl-paas.net/assets/font-rules/v5/atlassian-fonts.css" as="style" crossOrigin="anonymous" />
				${demoGoogleFontLinks}
			</head>
			<body className={cn("min-h-svh bg-bg-neutral text-text antialiased font-sans", geist.variable, arkEsSolidLight.variable)}>
				<FeatureFlagsShim />
				${body}
			</body>
		</html>
	);
}
`;
}

function routeUsesDemoGoogleFonts(repoRoot, files) {
	const fontFamily = /BBH Bartle|Bitcount Grid Single|DotGothic16|JetBrains Mono/;
	const queued = new Set(files), seen = new Set();
	while (queued.size > 0) {
		const rel = queued.values().next().value;
		queued.delete(rel);
		if (seen.has(rel)) continue;
		seen.add(rel);
		const abs = path.join(repoRoot, rel);
		if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
		const source = fs.readFileSync(abs, "utf8");
		if (fontFamily.test(source)) return true;
		if (!rel.endsWith(".css")) continue;
		for (const imported of collectLocalCssImportsFromText(source, path.posix.dirname(rel))) queued.add(imported);
	}
	return false;
}

// -------- CSS pipeline --------------------------------------------------

// Package names that are always present in extracted projects (either as
// runtime deps or devDeps in the scaffold templates), so their @import /
// @source lines should never be stripped.
const ALWAYS_AVAILABLE_PACKAGES = new Set([
	"tailwindcss",
	"@tailwindcss/postcss",
	"tw-animate-css", // auto-injected into the dep block by the scaffolder
	"shadcn", // owns data-* custom variants; never strip (Turbopack needs the node_modules path)
]);

/**
 * Extract the npm package name an `@import` / `@source` directive depends
 * on. Returns `null` for relative paths (which don't need filtering) and
 * for lines that don't reference an external package.
 */
function extractPackageFromCssDirective(line) {
	// Relative file or glob: "./foo.css" or "../foo/**" — no package dep.
	const relativeMatch = line.match(/["']\s*\.{1,2}\/(?!node_modules\/)/);
	if (relativeMatch) return null;

	// ../node_modules/<pkg>/… — <pkg> may be scoped (@scope/name) or plain.
	const nmMatch = line.match(
		/["']\s*(?:\.{1,2}\/)*node_modules\/(@[^/"']+\/[^/"']+|[^/"']+)/,
	);
	if (nmMatch) return nmMatch[1];

	// Bare specifier: "pkg" or "pkg/sub". Ignore TS/JS-style comments and
	// CSS keywords (source, none, etc.) — they never start with a quote.
	const bareMatch = line.match(/["']\s*(@[^/"']+\/[^/"']+|[a-z0-9][^"'/]*)/);
	if (bareMatch) return bareMatch[1];

	return null;
}

/**
 * Start from VPK's `app/globals.css` verbatim and strip only the
 * `@import` / `@source` lines whose packages aren't in the resolved dep
 * set. Keeps a single source of truth (VPK's file) while avoiding
 * build-time failures for heavy optional deps (excalidraw, streamdown,
 * katex, leaflet, etc.) that the extracted route doesn't pull in.
 * `shadcn` is always kept — its Tailwind preset owns `data-horizontal`,
 * `data-open`, and `data-active` variants.
 *
 * Stripped lines are replaced with a commented marker so diffs against
 * the source stay readable.
 */
function buildGlobalsCssFromSource(sourceCss, availablePackages) {
	const directive = /^(\s*)@(import|source)\s+.+$/;
	const lines = sourceCss.split("\n");
	const stripped = [];

	const out = lines.map((line) => {
		const match = line.match(directive);
		if (!match) return line;
		const pkg = extractPackageFromCssDirective(line);
		if (!pkg) return line; // Relative path — always keep.
		if (ALWAYS_AVAILABLE_PACKAGES.has(pkg)) return line;
		if (availablePackages.has(pkg)) return line;
		stripped.push(pkg);
		return `${match[1]}/* vpk-build: stripped @${match[2]} for missing dep "${pkg}" */`;
	});

	if (stripped.length > 0) {
		console.error(
			`  Stripped ${stripped.length} CSS directive(s) for deps not in plan: ${[...new Set(stripped)].join(", ")}`,
		);
	}

	return rewriteShadcnCssImport(out.join("\n"));
}

// -------- Copy helpers ---------------------------------------------------

function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

function copyFileVerbatim(srcAbs, destAbs) {
	ensureDir(path.dirname(destAbs));
	fs.copyFileSync(srcAbs, destAbs);
}

function writeFileEnsuring(destAbs, contents) {
	ensureDir(path.dirname(destAbs));
	fs.writeFileSync(destAbs, contents);
}

// -------- Template substitution ------------------------------------------

function substituteTemplate(text, vars) {
	return text.replace(/\{\{([A-Z_]+)\}\}/g, (_m, key) => {
		if (key in vars) return String(vars[key]);
		return `{{${key}}}`;
	});
}

function buildDependenciesBlock(npmPackages) {
	// Produce a 2-space indented JSON block. The template already has a tab
	// before {{DEPENDENCIES_JSON}}, so we just output the object body.
	const entries = Object.entries(npmPackages).sort(([a], [b]) => a.localeCompare(b));
	if (entries.length === 0) return "{}";
	const lines = entries.map(([name, version]) => `\t\t"${name}": "${version}"`);
	return `{\n${lines.join(",\n")}\n\t}`;
}

const HOST_PACKAGE_PEERS = [
	{ host: "react-leaflet", runtime: ["leaflet"], types: ["@types/leaflet"] },
	{ host: "three", runtime: [], types: ["@types/three"] },
];

function resolveExtractedDependencies({ planPackages, sourceManifest, catalog }) {
	const resolved = {};
	for (const [name, version] of Object.entries(planPackages || {})) {
		resolved[name] = resolveCatalogSpecifier(name, version, catalog);
	}
	const fromSource = (pkgName) => {
		const raw = resolvePinnedVersion(pkgName, sourceManifest);
		return raw ? resolveCatalogSpecifier(pkgName, raw, catalog) : null;
	};
	if (!resolved["tw-animate-css"]) {
		resolved["tw-animate-css"] = fromSource("tw-animate-css") || "^1.4.0";
	}
	if (!resolved.shadcn) {
		const shadcnVersion = fromSource("shadcn");
		if (shadcnVersion) resolved.shadcn = shadcnVersion;
	}
	for (const { host, runtime, types } of HOST_PACKAGE_PEERS) {
		if (!resolved[host]) continue;
		for (const peer of [...runtime, ...types]) {
			if (resolved[peer]) continue;
			const version = fromSource(peer);
			if (version) resolved[peer] = version;
		}
	}
	return resolved;
}

function resolveBackendDependencies({ sourceManifest, backendManifest, catalog }) {
	const dependencies = {};
	for (const [name, version] of Object.entries({
		...sourceManifest.dependencies,
		...backendManifest.dependencies,
	})) {
		// Frontend-only libraries are retained only when the route trace uses them.
		if (["motion-plus", "ansi-to-react"].includes(name)) continue;
		const resolved = resolveCatalogSpecifier(name, version, catalog);
		if (resolved === "catalog:") {
			throw new Error(`Backend dependency ${name} has no catalog version`);
		}
		dependencies[name] = resolved;
	}
	return dependencies;
}

function writeTargetPackageJson({ targetDir, tmpl, targetName, dependencies }) {
	const runtimeDeps = {};
	const typeDeps = {};
	for (const [name, version] of Object.entries(dependencies)) {
		if (name.startsWith("@types/")) typeDeps[name] = version;
		else runtimeDeps[name] = version;
	}
	const pkgFilled = substituteTemplate(tmpl, {
		TARGET_NAME: targetName,
		DEPENDENCIES_JSON: buildDependenciesBlock(runtimeDeps),
	});
	const pkg = JSON.parse(pkgFilled);
	pkg.devDependencies = Object.fromEntries(
		Object.entries({ ...pkg.devDependencies, ...typeDeps }).sort(([a], [b]) => a.localeCompare(b)),
	);
	fs.writeFileSync(path.join(targetDir, "package.json"), `${JSON.stringify(pkg, null, "\t")}\n`);
}

function copySiblingDeclarationFile(repoRoot, targetDir, rel) {
	if (!/\.(mjs|cjs|js)$/.test(rel)) return;
	const dtsRel = rel.replace(/\.(mjs|cjs|js)$/, ".d.ts");
	const srcAbs = path.join(repoRoot, dtsRel);
	if (!fs.existsSync(srcAbs)) return;
	copyFileVerbatim(srcAbs, path.join(targetDir, dtsRel));
}

function copyLocalCssGraph({ repoRoot, targetDir, cssImports, globalsCss }) {
	const queued = new Set();
	for (const spec of cssImports) {
		queued.add(spec);
	}
	for (const rel of collectLocalCssImportsFromText(globalsCss, "app")) {
		queued.add(rel);
	}
	const copied = new Set();
	while (queued.size > 0) {
		const rel = queued.values().next().value;
		queued.delete(rel);
		if (copied.has(rel)) continue;
		copied.add(rel);
		if (rel.includes("node_modules")) continue;
		const srcAbs = path.join(repoRoot, rel);
		if (!fs.existsSync(srcAbs) || !fs.statSync(srcAbs).isFile()) continue;
		copyFileVerbatim(srcAbs, path.join(targetDir, rel));
		for (const imported of collectLocalCssImportsFromText(
			fs.readFileSync(srcAbs, "utf8"), path.posix.dirname(rel)
		)) {
			if (!copied.has(imported)) queued.add(imported);
		}
	}
}

function copyAmbientTypeGraph(repoRoot, targetDir) {
	const typesDir = path.join(repoRoot, "types");
	if (fs.existsSync(typesDir) && fs.statSync(typesDir).isDirectory()) {
		copyTreeVerbatim(typesDir, path.join(targetDir, "types"));
	}
}

function writeHarnessTypeFiles(targetDir) {
	writeFileEnsuring(
		path.join(targetDir, "next-env.d.ts"),
		`/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`,
	);
	writeFileEnsuring(
		path.join(targetDir, "types", "jsx-namespace.d.ts"),
		`import type { JSX as ReactJSX } from "react";

declare global {
	namespace JSX {
		type Element = ReactJSX.Element;
	}
}

export {};
`,
	);
}

function copySourceNpmrc(repoRoot, targetDir) {
	const npmrcSrc = path.join(repoRoot, ".npmrc");
	if (!fs.existsSync(npmrcSrc)) return;
	copyFileVerbatim(npmrcSrc, path.join(targetDir, ".npmrc"));
}

// -------- Main ----------------------------------------------------------

function main() {
	const args = parseArgs(process.argv.slice(2));
	const plan = readJSON(path.resolve(args.plan));
	const repoRoot = plan.repoRoot;
	const route = plan.route;
	const routeSlug = route.replace(/^\//, "").replace(/\//g, "-");
	const targetName = `vpk-${routeSlug}`;
	const targetDir = args.target
		? path.resolve(args.target)
		: path.resolve(repoRoot, "..", targetName);

	validateScaffoldTarget(targetDir, args.force);
	ensureDir(targetDir);

	console.error(`Scaffolding ${targetName} at ${targetDir}`);
	console.error(`  Source: ${repoRoot}`);
	console.error(`  Route: ${route} | Files: ${plan.files.length} | npm: ${Object.keys(plan.npmPackages).length} | Assets: ${plan.assets.length}`);

	// ---- 1. Copy source files verbatim (preserve repo-relative paths) ----
	const entryRel = plan.entry; // e.g. "app/awake/page.tsx"
	const layoutRel = plan.layout; // e.g. "app/awake/layout.tsx" or null
	const entryAbs = path.join(repoRoot, entryRel);
	const layoutAbs = layoutRel ? path.join(repoRoot, layoutRel) : null;

	for (const rel of plan.files) {
		const srcAbs = path.join(repoRoot, rel);
		// Route entry + route layout get special handling — skip here.
		if (srcAbs === entryAbs || srcAbs === layoutAbs) continue;
		if (!fs.existsSync(srcAbs)) continue;

		const destAbs = path.join(targetDir, rel);
		copyFileVerbatim(srcAbs, destAbs);
		copySiblingDeclarationFile(repoRoot, targetDir, rel);
	}

	// ---- 2. Promote the route to the root ----
	// app/<route>/page.tsx → app/page.tsx (with loadDemoComponent rewritten)
	const originalPage = fs.readFileSync(entryAbs, "utf8");
	const rewrittenPage = rewriteRoutePage(originalPage);
	writeFileEnsuring(path.join(targetDir, "app", "page.tsx"), rewrittenPage);

	// ---- 3a. Write feature-flags-shim.ts alongside layout.tsx ----
	// Imported as a side-effect from layout.tsx. Runs BEFORE @atlaskit/tokens
	// loads so the FeatureGates global is installed in time. See the comment
	// at the top of the generated layout for the "why".
	writeFileEnsuring(
		path.join(targetDir, "app", "feature-flags-shim.ts"),
		`// Auto-generated by /vpk-build. Sets up a FeatureGates resolver that
// disables all flags, preventing "Client must be initialized" errors
// thrown by @atlaskit/tokens during SSR when a real FeatureGates client
// isn't wired up (extracted projects have no client by design).
(globalThis as Record<string, unknown>).__PLATFORM_FEATURE_FLAGS__ = {
\tbooleanResolver: () => false,
};
`,
	);

	// Client-side counterpart. The server shim above runs only during SSR;
	// @atlaskit/tokens ALSO runs in the browser (during hydration) and checks
	// the same globalThis — so without a client-bundled equivalent we log a
	// one-time "error checking the feature gate" warning in the browser
	// console. Mounting <FeatureFlagsShim /> inside <body> bundles this
	// module into the client chunk, making its module-level side effect run
	// before tokens does its first client-side lookup.
	writeFileEnsuring(
		path.join(targetDir, "app", "feature-flags-shim-client.tsx"),
		`"use client";

// Auto-generated by /vpk-build. See feature-flags-shim.ts for the server
// counterpart and the rationale for splitting the shim across runtimes.
(globalThis as Record<string, unknown>).__PLATFORM_FEATURE_FLAGS__ = {
\tbooleanResolver: () => false,
};

export function FeatureFlagsShim() {
\treturn null;
}
`,
	);

	// ---- 3b. Compose app/layout.tsx dynamically from detected contexts ----
	// If the plan found contextFiles (under app/contexts/), parse each for
	// exported *Provider components and wrap the layout with them. If none,
	// fall back to the slim template with just ThemeWrapper.
	const providers = [];
	for (const ctxRel of plan.contextFiles || []) {
		const ctxAbs = path.join(repoRoot, ctxRel);
		if (!fs.existsSync(ctxAbs)) continue;
		const ctxSource = fs.readFileSync(ctxAbs, "utf8");
		const providerNames = parseProviderExports(ctxSource);
		// Convert "app/contexts/context-rovo-chat.tsx" -> "@/app/contexts/context-rovo-chat"
		const importPath = "@/" + ctxRel.replace(/\.(tsx|ts|jsx|js)$/, "");
		for (const name of providerNames) {
			if (providerNeedsInstanceProps(ctxSource, name)) {
				console.error(`  Skipping ${name} — required props are not children-only`);
				continue;
			}
			providers.push({ name, importPath });
		}
	}
	writeFileEnsuring(
		path.join(targetDir, "app", "layout.tsx"),
		composeLayout({
			targetName, routeSlug, providers,
			includeDemoGoogleFonts: routeUsesDemoGoogleFonts(
				repoRoot, [...plan.files, ...(plan.cssImports || []), "app/globals.css", "app/tailwind-theme.css"]
			),
		}),
	);

	// ---- 4. CSS pipeline: copy tailwind-theme + shadcn-theme verbatim,
	//         filter VPK's globals.css to drop imports for deps that
	//         aren't in the extracted project ----
	// Just copying tailwind-theme.css is NOT enough: @theme inline {…} only
	// declares CSS vars. Tailwind v4 utility classes are emitted only by
	// whatever file runs `@import "tailwindcss"`. VPK's globals.css does
	// that. We start from that file verbatim and strip @import/@source lines
	// whose packages aren't resolvable in the extracted dep set (excalidraw,
	// streamdown, etc.), keeping a single source of truth.
	const themeCssSrc = path.join(repoRoot, "app", "tailwind-theme.css");
	if (fs.existsSync(themeCssSrc)) {
		copyFileVerbatim(themeCssSrc, path.join(targetDir, "app", "tailwind-theme.css"));
	}
	const shadcnCssSrc = path.join(repoRoot, "app", "shadcn-theme.css");
	if (fs.existsSync(shadcnCssSrc)) {
		copyFileVerbatim(shadcnCssSrc, path.join(targetDir, "app", "shadcn-theme.css"));
	}
	const globalsCssSrc = path.join(repoRoot, "app", "globals.css");
	const sourceGlobalsCss = fs.existsSync(globalsCssSrc)
		? fs.readFileSync(globalsCssSrc, "utf8")
		: "";
	const sourceManifest = fs.existsSync(path.join(repoRoot, "package.json"))
		? readJSON(path.join(repoRoot, "package.json"))
		: { dependencies: {}, devDependencies: {} };
	const catalog = readPnpmCatalog(repoRoot);
	const augmentedNpm = resolveExtractedDependencies({
		planPackages: plan.npmPackages,
		sourceManifest,
		catalog,
	});
	if (args.backendBacked) {
		const backendManifestPath = path.join(repoRoot, "backend", "package.json");
		if (!fs.existsSync(backendManifestPath)) {
			throw new Error("Backend-backed extraction requires source backend/package.json");
		}
		Object.assign(augmentedNpm, resolveBackendDependencies({
			sourceManifest,
			backendManifest: readJSON(backendManifestPath),
			catalog,
		}));
	}
	const availablePackages = new Set(Object.keys(augmentedNpm));
	const generatedGlobalsCss = buildGlobalsCssFromSource(sourceGlobalsCss, availablePackages);
	writeFileEnsuring(
		path.join(targetDir, "app", "globals.css"),
		generatedGlobalsCss,
	);
	copyLocalCssGraph({
		repoRoot,
		targetDir,
		cssImports: plan.cssImports || [],
		globalsCss: generatedGlobalsCss,
	});
	copyAmbientTypeGraph(repoRoot, targetDir);
	writeHarnessTypeFiles(targetDir);
	copySourceNpmrc(repoRoot, targetDir);

	// ---- 4b. Copy public/ (if any) ----
	// Studio and catalog surfaces derive some image URLs at runtime from ids
	// and data records. A traced asset allow-list is too brittle for those
	// routes, so standalone builds carry the source public tree verbatim.
	const publicDir = path.join(repoRoot, "public");
	if (fs.existsSync(publicDir)) {
		copyTreeVerbatim(publicDir, path.join(targetDir, "public"));
	}

	// ---- 5. Copy traced public assets ----
	// Kept for older plans and for source repos that do not have a complete
	// public tree. If public/ was copied above these writes are no-ops.
	for (const assetPath of plan.assets) {
		const rel = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
		const srcAbs = path.join(repoRoot, "public", rel);
		if (!fs.existsSync(srcAbs)) continue; // Asset might have been a regex false-positive
		copyFileVerbatim(srcAbs, path.join(targetDir, "public", rel));
	}

	// ---- 6. Copy static scaffold files (next.config.ts, tsconfig, etc.) ----
	const staticScaffolds = [
		"next.config.ts",
		"tsconfig.json",
		"postcss.config.mjs",
		"tailwind.config.ts",
		".gitignore",
	];
	for (const name of staticScaffolds) {
		copyFileVerbatim(path.join(SCAFFOLD_DIR, name), path.join(targetDir, name));
	}

	// ---- 7. Fill and write package.json from template ----
	// `augmentedNpm` was built above in step 4 — it's the same set that
	// drove CSS filtering, so dep list and resolved CSS imports stay in
	// sync by construction.
	const pkgTmpl = fs.readFileSync(path.join(SCAFFOLD_DIR, "package.json.tmpl"), "utf8");
	writeTargetPackageJson({
		targetDir,
		tmpl: pkgTmpl,
		targetName,
		dependencies: augmentedNpm,
	});
	if (args.backendBacked) {
		writeBackendDeploymentHarness({
			repoRoot, targetDir, packageManager: sourceManifest.packageManager,
			buildPolicy: readPnpmYamlSection(repoRoot, "overrides") + readPnpmYamlSection(repoRoot, "allowBuilds"),
		});
	}

	// ---- 8. Fill and write README.md from template ----
	const sha = safeGitSha(repoRoot);
	const readmeTmpl = fs.readFileSync(path.join(SCAFFOLD_DIR, "README.md.tmpl"), "utf8");
	const readmeFilled = substituteTemplate(readmeTmpl, {
		TARGET_NAME: targetName,
		ROUTE_NAME: routeSlug,
		GENERATED_DATE: new Date().toISOString().slice(0, 10),
		SOURCE_SHA: sha,
	});
	fs.writeFileSync(path.join(targetDir, "README.md"), readmeFilled);

	// ---- 9. Copy Micros deploy scaffold ----
	if (fs.existsSync(MICROS_DIR)) {
		copyTreeVerbatim(MICROS_DIR, targetDir);
	}
	if (args.backendBacked) {
		copyTrackedRuntimeFiles(repoRoot, targetDir);
		writeBackendServiceDescriptor(targetDir);
		const devTemplate = fs.readFileSync(
			path.join(SCAFFOLD_DIR, "backend-backed-dev.mjs"), "utf8",
		);
		writeFileEnsuring(
			path.join(targetDir, "scripts", "dev-backend-backed.mjs"),
			substituteTemplate(devTemplate, {
				SOURCE_RELATIVE_PATH: JSON.stringify(path.relative(targetDir, repoRoot)),
			}),
		);
		copyFileVerbatim(
			path.join(SCAFFOLD_DIR, "backend-backed.Dockerfile"),
			path.join(targetDir, "backend", "Dockerfile"),
		);
		copyFileVerbatim(
			path.join(SCAFFOLD_DIR, "backend-backed-cross-route-redirects.js"),
			path.join(targetDir, "backend", "extracted-cross-route-redirects.js"),
		);
		const sourceServer = fs.readFileSync(path.join(repoRoot, "backend", "server.js"), "utf8");
		const staticServingCall = "\tregisterStaticExportServing(runtime.app, {";
		if (!sourceServer.includes(staticServingCall)) {
			throw new Error("Source backend/server.js no longer has the static-serving insertion point");
		}
		const extractedServer = sourceServer
			.replace(
				"const express = require(\"express\");",
				"const { registerCrossRouteRedirects } = require(\"./extracted-cross-route-redirects\");\nconst express = require(\"express\");",
			)
			.replace(staticServingCall,
				"\tregisterCrossRouteRedirects(runtime.app);\n" + staticServingCall);
		writeFileEnsuring(path.join(targetDir, "backend", "extracted-server.js"), extractedServer);
		fs.appendFileSync(path.join(targetDir, "README.md"), `
## Backend-backed runtime

\`pnpm dev\` serves the extracted route at \`http://localhost:3001\` and proxies
\`/api/*\` to the source VPK backend. The adjacent source checkout is discovered
automatically; set \`VPK_ROOT\` (or legacy \`VPK_ROVO_ROOT\`) if it moves. The
launcher starts \`pnpm run dev:backend\` in the source when no healthy backend
is running. \`VPK_ORIGIN\` points cross-route Create actions to the source app;
locally it falls back to the source frontend port file. Set \`VPK_ORIGIN\` and
\`ALLOWED_ORIGINS\` to the public hosts before deployment. The production image
runs the copied source Express backend, including API and WebSocket routes.
`);
	}

	// ---- 9b. Wire VPK skill access ----
	// The extracted project needs paths for every surface that may resolve
	// each wired skill:
	//   - `.agents/skills/<skill>`     — canonical path; orchestrator-agnostic
	//   - `.claude/skills/<skill>`     — Claude Code slash-command lookup
	//   - `.cursor/skills/<skill>`     — Cursor
	//   - `.codex/skills/<skill>`      — Codex
	//   - `pnpm run deploy:micros`     — calls ./scripts/deploy.sh wrapper
	// Mirror VPK's own layout: `.agents/` is the canonical source, and
	// each provider dir symlinks its `skills/` to `../.agents/skills`. A
	// single source + many views means fixes to VPK's skills propagate
	// to every orchestrator without per-provider duplication. Trade-off:
	// this keeps the hard requirement that VPK stays adjacent, since
	// all symlinks ultimately resolve back to <repoRoot>/.agents/skills/.
	//
	// Allow-list of skills wired into extractions. Explicit > "symlink the
	// whole skills dir" because most VPK skills (vpk-build itself, vpk-tidy,
	// vpk-design, vpk-component, vpk-component-ext) assume VPK's
	// own component library, Figma pipeline, or provider contexts — they
	// don't apply inside an extracted standalone. Wire only the skills a
	// user would reasonably invoke from the extracted project:
	//   - vpk-setup:  prerequisite for deploy (creates .env.local, .asap-config)
	//   - vpk-deploy: Micros deployment (reads .deploy.local from setup)
	// Adding a future prerequisite is a one-line array edit.
	const WIRED_SKILLS = ["vpk-setup", "vpk-deploy"];
	const agentsSkillsDir = path.join(targetDir, ".agents", "skills");
	let anyWired = false;
	for (const skillName of WIRED_SKILLS) {
		const skillSrc = path.join(repoRoot, ".agents", "skills", skillName);
		if (!fs.existsSync(skillSrc)) {
			console.error(`scaffold-target: skipping ${skillName} — not found in VPK`);
			continue;
		}
		ensureDir(agentsSkillsDir);
		const canonicalLink = path.join(agentsSkillsDir, skillName);
		if (!fs.existsSync(canonicalLink)) {
			fs.symlinkSync(
				path.relative(agentsSkillsDir, skillSrc),
				canonicalLink,
			);
		}
		anyWired = true;
	}
	if (anyWired) {
		// Per-orchestrator views: each provider dir's `skills` symlinks to
		// `.agents/skills` so all wired skills are discoverable regardless
		// of which agent opens the extracted project.
		for (const providerDir of [".claude", ".cursor", ".codex"]) {
			const providerRoot = path.join(targetDir, providerDir);
			ensureDir(providerRoot);
			const providerSkillsLink = path.join(providerRoot, "skills");
			if (!fs.existsSync(providerSkillsLink)) {
				fs.symlinkSync("../.agents/skills", providerSkillsLink);
			}
		}
		// `scripts/deploy.sh` wrapper so `pnpm run deploy:micros` works and
		// forwards any args the user passes (service name, version, env).
		const scriptsDir = path.join(targetDir, "scripts");
		ensureDir(scriptsDir);
		const wrapperPath = path.join(scriptsDir, "deploy.sh");
		fs.writeFileSync(
			wrapperPath,
			`#!/bin/bash
# Auto-generated by /vpk-build. Forwards to the vpk-deploy skill's deploy.sh
# via the .agents/skills/vpk-deploy symlink so the extracted project stays
# aligned with VPK's canonical deploy script.
set -euo pipefail
exec "$(dirname "$0")/../.agents/skills/vpk-deploy/scripts/deploy.sh" "$@"
`,
		);
		fs.chmodSync(wrapperPath, 0o755);
	}

	// ---- 10. git init + initial commit ----
	try {
		execSync("git init -q", { cwd: targetDir, stdio: "inherit" });
		execSync("git add -A", { cwd: targetDir, stdio: "inherit" });
		execSync(
			`git commit -q -m "Extract ${route} from VPK at ${sha}"`,
			{ cwd: targetDir, stdio: "inherit" },
		);
	} catch (err) {
		console.error(`git init/commit failed: ${err.message}`);
		// Non-fatal — the scaffolded project is still usable without git.
	}

	console.error(`\n✅ Scaffold complete: ${targetDir}`);
	console.error(`Next steps:`);
	console.error(`  cd ${path.relative(process.cwd(), targetDir)}`);
	console.error(`  pnpm install`);
	console.error(`  pnpm dev`);
}

function copyTreeVerbatim(srcDir, destDir) {
	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const srcAbs = path.join(srcDir, entry.name);
		const destAbs = path.join(destDir, entry.name);
		if (entry.isDirectory()) {
			ensureDir(destAbs);
			copyTreeVerbatim(srcAbs, destAbs);
		} else {
			copyFileVerbatim(srcAbs, destAbs);
		}
	}
}

function copyTrackedRuntimeFiles(repoRoot, targetDir) {
	const files = execFileSync("git", ["ls-files", "-z", "--", "backend", "lib", "rovo", "scripts/lib"], {
		cwd: repoRoot, encoding: "utf8",
	}).split("\0");
	for (const rel of files) {
		if (!rel || /\.(ts|tsx|mts|cts)$/.test(rel)) continue;
		if (rel.split("/").some((part) => ["node_modules", ".next", "public"].includes(part))) continue;
		const srcAbs = path.join(repoRoot, rel);
		if (!fs.existsSync(srcAbs) || !fs.statSync(srcAbs).isFile()) continue;
		copyFileVerbatim(srcAbs, path.join(targetDir, rel));
	}
}

function safeGitSha(repoRoot) {
	try {
		return execSync("git rev-parse --short HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
	} catch {
		return "unknown";
	}
}

try {
	main();
} catch (err) {
	console.error(`scaffold-target: ${err.message}`);
	process.exit(1);
}
