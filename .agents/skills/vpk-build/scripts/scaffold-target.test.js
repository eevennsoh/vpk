const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SCAFFOLD_TARGET_PATH = path.resolve(__dirname, "scaffold-target.mjs");

function writeDeliveryInputs(repoRoot) {
	for (const relative of ["backend/lib/static-export-serving.js", "backend/lib/static-asset-delivery.js", "scripts/prepare-static-export.mjs"]) {
		writeFile(path.join(repoRoot, relative), fs.readFileSync(path.resolve(__dirname, "../../../..", relative), "utf8"));
	}
}

function writeFile(filePath, contents) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, contents, "utf8");
}

async function renderGeneratedLayout(layout) {
	const ts = require("typescript");
	const { renderToStaticMarkup } = require("react-dom/server");
	const { outputText } = ts.transpileModule(layout, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
	});
	const generatedModule = { exports: {} };
	const previousFlags = globalThis.__PLATFORM_FEATURE_FLAGS__;
	const requireLayout = (specifier) => {
		switch (specifier) {
			case "./feature-flags-shim":
				globalThis.__PLATFORM_FEATURE_FLAGS__ = { booleanResolver: () => false };
				return {};
			case "./globals.css": return {};
			case "next/font/google": return { Geist: () => ({ variable: "fixture-geist" }) };
			case "next/font/local": return () => ({ variable: "fixture-local-font" });
			case "@/components/utils/theme-wrapper": return { ThemeWrapper: ({ children }) => children };
			case "@/lib/utils": return { cn: (...classes) => classes.filter(Boolean).join(" ") };
			case "./feature-flags-shim-client": return { FeatureFlagsShim: () => null };
			case "motion/react": return { MotionConfig: ({ children }) => children };
			default: return require(specifier);
		}
	};
	try {
		// Run the generated root with real React and ADS token loading. Font and
		// client-only wrappers are irrelevant to stylesheet selection in this test.
		new Function("require", "exports", "module", outputText)(requireLayout, generatedModule.exports, generatedModule);
		return renderToStaticMarkup(await generatedModule.exports.default({ children: null }));
	} finally {
		if (previousFlags === undefined) delete globalThis.__PLATFORM_FEATURE_FLAGS__;
		else globalThis.__PLATFORM_FEATURE_FLAGS__ = previousFlags;
	}
}

function createFixture({ includeMotion = false, extraPackages = {}, sourceLock = null } = {}) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-build-scaffold-"));
	const repoRoot = path.join(tempDir, "repo");
	const targetDir = path.join(tempDir, "output");
	const planPath = path.join(tempDir, "plan.json");

	try {
		writeDeliveryInputs(repoRoot);
		writeFile(
			path.join(repoRoot, "app", "awake", "page.tsx"),
			`import { createElement, use } from "react";
import { loadDemoComponent } from "@/components/website/demo-registry-loader";

export default function AwakePage() {
	const Demo = use(loadDemoComponent("awake", "arts"));

	return createElement(Demo);
}

`,
		);
		writeFile(
			path.join(repoRoot, "app", "tailwind-theme.css"),
			":root { --fixture-color: #fff; }\n",
		);
		writeFile(
			path.join(repoRoot, "components", "utils", "theme-wrapper.tsx"),
			`export function ThemeWrapper({ children }) {
	return children;
}
`,
		);
		writeFile(
			path.join(repoRoot, "lib", "utils.ts"),
			`export function cn(...classes) {
	return classes.filter(Boolean).join(" ");
}
`,
		);
		writeFile(
			path.join(repoRoot, "public", "fonts", "ark-es", "ARK-ES-SolidLight.woff"),
			"solid-light-font\n",
		);
		writeFile(
			path.join(repoRoot, "public", "fonts", "ark-es", "ARK-ES-Bold.woff"),
			"bold-font\n",
		);
		writeFile(
			path.join(repoRoot, "public", "3p", "google-drive", "16-borderless.svg"),
			"<svg />\n",
		);
		for (const favicon of ["favicon-fallback.svg", "favicon-dark.svg", "favicon-light.svg"]) {
			writeFile(path.join(repoRoot, "public", "website", favicon), "<svg width=\"32\" />\n");
		}
		for (const skill of ["vpk-setup", "vpk-deploy"]) {
			writeFile(path.join(repoRoot, ".agents", "skills", skill, "SKILL.md"), `name: ${skill}\n`);
		}
		if (sourceLock) writeFile(path.join(repoRoot, "pnpm-lock.yaml"), sourceLock);
		writeFile(
			planPath,
			JSON.stringify(
				{
					repoRoot,
					route: "/awake",
					entry: "app/awake/page.tsx",
					layout: null,
					files: [
						"app/awake/page.tsx",
						"components/utils/theme-wrapper.tsx",
						"lib/utils.ts",
					],
					assets: [],
					npmPackages: {
						next: "16.2.4",
						react: "19.2.5",
						...(includeMotion ? { motion: "^13.1.1" } : {}),
						...extraPackages,
					},
					contextFiles: [],
				},
				null,
				2,
			),
		);

		execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
		execFileSync("git", ["config", "user.email", "test@example.com"], {
			cwd: repoRoot,
			stdio: "ignore",
		});
		execFileSync("git", ["config", "user.name", "Test User"], {
			cwd: repoRoot,
			stdio: "ignore",
		});
		execFileSync("git", ["add", "."], { cwd: repoRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: repoRoot, stdio: "ignore" });

		return {
			repoRoot,
			targetDir,
			planPath,
			cleanup() {
				fs.rmSync(tempDir, { recursive: true, force: true });
			},
		};
	} catch (error) {
		fs.rmSync(tempDir, { recursive: true, force: true });
		throw error;
	}
}

test("staged public assets remain independent from the source when either copy is edited", () => {
	const fixture = createFixture();
	try {
		const relative = "public/runtime asset.bin";
		const original = Buffer.alloc(8192, 37);
		fs.writeFileSync(path.join(fixture.repoRoot, relative), original);
		execFileSync(process.execPath, [SCAFFOLD_TARGET_PATH, fixture.planPath, "--target", fixture.targetDir], { stdio: "pipe" });
		assert.deepEqual(fs.readFileSync(path.join(fixture.targetDir, relative)), original);
		fs.writeFileSync(path.join(fixture.targetDir, relative), "target edit");
		assert.deepEqual(fs.readFileSync(path.join(fixture.repoRoot, relative)), original);
		fs.writeFileSync(path.join(fixture.repoRoot, relative), "source edit");
		assert.equal(fs.readFileSync(path.join(fixture.targetDir, relative), "utf8"), "target edit");
	} finally { fixture.cleanup(); }
});

test("scaffold-target emits the updated layout, shim, config, and fonts for extracted routes", async () => {
	const fixture = createFixture();

	try {
		execFileSync(process.execPath, [SCAFFOLD_TARGET_PATH, fixture.planPath, "--target", fixture.targetDir], {
			encoding: "utf8",
			env: {
				...process.env,
				GIT_AUTHOR_NAME: "Test User",
				GIT_AUTHOR_EMAIL: "test@example.com",
				GIT_COMMITTER_NAME: "Test User",
				GIT_COMMITTER_EMAIL: "test@example.com",
			},
			stdio: "pipe",
		});

		const page = fs.readFileSync(path.join(fixture.targetDir, "app", "page.tsx"), "utf8");
		const layout = fs.readFileSync(path.join(fixture.targetDir, "app", "layout.tsx"), "utf8");
		const featureFlagsShim = fs.readFileSync(
			path.join(fixture.targetDir, "app", "feature-flags-shim.ts"),
			"utf8",
		);
		const nextConfig = fs.readFileSync(path.join(fixture.targetDir, "next.config.ts"), "utf8");
		const targetPackage = JSON.parse(fs.readFileSync(path.join(fixture.targetDir, "package.json"), "utf8"));
		const generatedTsconfig = JSON.parse(fs.readFileSync(path.join(fixture.targetDir, "tsconfig.json"), "utf8"));

		assert.match(
			page,
			/import \{ lazy, Suspense \} from "react";/,
		);
		assert.match(
			page,
			/const AwakeDemo = lazy\(\(\) => import\("@\/components\/website\/demos\/arts\/awake-demo"\)\);/,
		);
		assert.match(page, /return <Suspense><AwakeDemo \/><\/Suspense>;/);
		assert.equal(targetPackage.scripts.build, "NEXT_OUTPUT=export next build --webpack");
		assert.ok(generatedTsconfig.exclude.includes("out"));

		assert.ok(
			layout.includes('import "./feature-flags-shim";'),
			"layout should import the feature flag shim",
		);
		assert.ok(
			layout.indexOf('import "./feature-flags-shim";') < layout.indexOf('import type { Metadata } from "next";'),
			"feature flag shim should load before other imports",
		);
		assert.match(layout, /import \{ Geist \} from "next\/font\/google";/);
		assert.match(layout, /import localFont from "next\/font\/local";/);
		assert.match(layout, /import \{ getThemeStyles \} from "@atlaskit\/tokens\/get-theme-styles";/);
		assert.match(layout, /const geist = Geist\(\{ subsets: \["latin"\], variable: "--font-sans" \}\);/);
		assert.match(layout, /src: "\.\.\/public\/fonts\/ark-es\/ARK-ES-SolidLight\.woff"/);
		const renderedLayout = await renderGeneratedLayout(layout);
		assert.match(layout, /<ThemeWrapper>[\s\S]*<main id="main-content">/);
		assert.match(layout, /<\/main>[\s\S]*<\/ThemeWrapper>/);
		assert.doesNotMatch(layout, /MotionConfig/);
		assert.match(renderedLayout, /<main id="main-content">/);
		assert.match(renderedLayout, /<html[^>]*data-color-mode="light"/);
		assert.match(renderedLayout, /<style data-theme="light">/);
		assert.match(renderedLayout, /<style data-theme="dark">/);
		assert.match(renderedLayout, /\[data-subtree-theme\]\[data-color-mode="dark"\]\[data-theme~="dark:dark"\]/);
		assert.match(layout, /import \{ getThemeHtmlAttrs \} from "@atlaskit\/tokens\/get-theme-html-attrs";/);
		assert.match(layout, /<html[^>]*\{\.\.\.getThemeHtmlAttrs\(THEME_STATE\)\}/);
		assert.match(layout, /href="\/website\/favicon-fallback\.svg"/);
		assert.match(layout, /media="\(prefers-color-scheme: light\)" href="\/website\/favicon-dark\.svg"/);
		assert.match(layout, /media="\(prefers-color-scheme: dark\)" href="\/website\/favicon-light\.svg"/);
		assert.doesNotMatch(layout, /next\/script/);
		assert.doesNotMatch(layout, /clientShim/);
		assert.doesNotMatch(layout, /fonts\.googleapis\.com\/css2/);

		assert.match(featureFlagsShim, /__PLATFORM_FEATURE_FLAGS__/);
		assert.match(featureFlagsShim, /booleanResolver: \(\) => false/);

		assert.equal(
			fs.readFileSync(
				path.join(fixture.targetDir, "public", "fonts", "ark-es", "ARK-ES-SolidLight.woff"),
				"utf8",
			),
			"solid-light-font\n",
		);
		assert.equal(
			fs.readFileSync(
				path.join(fixture.targetDir, "public", "fonts", "ark-es", "ARK-ES-Bold.woff"),
				"utf8",
			),
			"bold-font\n",
		);
		assert.equal(
			fs.readFileSync(
				path.join(fixture.targetDir, "public", "3p", "google-drive", "16-borderless.svg"),
				"utf8",
			),
			"<svg />\n",
		);
		assert.equal(
			fs.readFileSync(path.join(fixture.targetDir, "public", "website", "favicon-fallback.svg"), "utf8"),
			"<svg width=\"32\" />\n",
		);
		for (const skill of ["vpk-setup", "vpk-deploy"]) {
			assert.equal(
				fs.realpathSync(path.join(fixture.targetDir, ".agents", "skills", skill)),
				fs.realpathSync(path.join(fixture.repoRoot, ".agents", "skills", skill)),
			);
		}
		for (const provider of [".claude", ".cursor", ".codex"]) {
			assert.equal(fs.readlinkSync(path.join(fixture.targetDir, provider, "skills")), "../.agents/skills");
		}
		const deployWrapper = path.join(fixture.targetDir, "scripts", "deploy.sh");
		assert.match(fs.readFileSync(deployWrapper, "utf8"), /\.agents\/skills\/vpk-deploy\/scripts\/deploy\.sh/);
		assert.notEqual(fs.statSync(deployWrapper).mode & 0o111, 0);
		assert.equal(
			fs.readFileSync(path.join(fixture.targetDir, "app", "tailwind-theme.css"), "utf8"),
			":root { --fixture-color: #fff; }\n",
		);

		assert.match(nextConfig, /root: process\.cwd\(\),/);
		assert.doesNotMatch(nextConfig, /root:\s*fileURLToPath\(/);
		assert.match(nextConfig, /allowedDevOrigins:\s*\[\s*"127\.0\.2\.2",\s*"localhost"\s*\]/);
		const tsconfig = JSON.parse(fs.readFileSync(path.join(fixture.targetDir, "tsconfig.json"), "utf8"));
		assert.ok(tsconfig.include.includes(".next/dev/types/**/*.ts"));
		// Copied helpers use explicit .ts imports so Node can load their tests too.
		// Exercise the emitted compiler config instead of checking a flag string.
		const ts = require("typescript");
		const extensionEntry = path.join(fixture.targetDir, "lib", "extension-entry.ts");
		writeFile(path.join(fixture.targetDir, "lib", "extension-fixture.ts"), "export const value = 42;\n");
		writeFile(extensionEntry, 'import { value } from "./extension-fixture.ts";\nexport const copiedValue: number = value;\n');
		const { options } = ts.convertCompilerOptionsFromJson(tsconfig.compilerOptions, fixture.targetDir);
		const program = ts.createProgram([extensionEntry], options);
		assert.deepEqual(
			program.getSemanticDiagnostics(program.getSourceFile(extensionEntry)).map((diagnostic) => ({
				code: diagnostic.code,
				message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
			})),
			[],
		);
		assert.match(fs.readFileSync(path.join(fixture.targetDir, ".gitignore"), "utf8"), /^output\/$/m);
		assert.match(fs.readFileSync(path.join(fixture.targetDir, ".gitignore"), "utf8"), /^backend\/data\/$/m);

		const nextEnv = fs.readFileSync(path.join(fixture.targetDir, "next-env.d.ts"), "utf8");
		assert.match(nextEnv, /\/\/\/ <reference types="next" \/>/);
		assert.doesNotMatch(nextEnv, /\.next\/dev/);

		const jsxNamespace = fs.readFileSync(
			path.join(fixture.targetDir, "types", "jsx-namespace.d.ts"),
			"utf8",
		);
		assert.match(jsxNamespace, /namespace JSX/);
		assert.match(jsxNamespace, /type Element = ReactJSX\.Element/);
	} finally {
		fixture.cleanup();
	}
});

test("--force refuses to overwrite an owned checkout or configured deployment", () => {
	for (const signal of [".git", ".deploy.local", "service-descriptor.yml"]) {
		const fixture = createFixture();
		try {
			const marker = path.join(fixture.targetDir, "README.md");
			writeFile(marker, "preserve target notes\n");
			if (signal === ".git") fs.mkdirSync(path.join(fixture.targetDir, ".git"));
			else if (signal === ".deploy.local") writeFile(path.join(fixture.targetDir, signal), "SERVICE_NAME=example\n");
			else writeFile(path.join(fixture.targetDir, signal), "image: docker.atl-paas.net/example-service\n");

			const result = spawnSync(process.execPath, [SCAFFOLD_TARGET_PATH, fixture.planPath, "--target", fixture.targetDir, "--force"], {
				encoding: "utf8",
			});
			assert.notEqual(result.status, 0, `${signal} must protect the target`);
			assert.match(result.stderr, /existing checkout or configured deployment/u);
			assert.equal(fs.readFileSync(marker, "utf8"), "preserve target notes\n");
		} finally {
			fixture.cleanup();
		}
	}
});

test("scaffold refuses a trace plan from a different source Git revision before writing", () => {
	const fixture = createFixture();
	try {
		const plan = JSON.parse(fs.readFileSync(fixture.planPath, "utf8"));
		plan.sourceRevision = "0".repeat(40);
		plan.sourceWasDirty = false;
		fs.writeFileSync(fixture.planPath, JSON.stringify(plan));
		const result = spawnSync(process.execPath, [SCAFFOLD_TARGET_PATH, fixture.planPath, "--target", fixture.targetDir], {
			encoding: "utf8",
		});
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Source Git revision changed since tracing/u);
		assert.equal(fs.existsSync(fixture.targetDir), false);
	} finally {
		fixture.cleanup();
	}
});

const GIT_TEST_ENV = {
	...process.env,
	GIT_AUTHOR_NAME: "Test User",
	GIT_AUTHOR_EMAIL: "test@example.com",
	GIT_COMMITTER_NAME: "Test User",
	GIT_COMMITTER_EMAIL: "test@example.com",
};

function initGitRepo(repoRoot) {
	execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
	execFileSync("git", ["config", "user.email", "test@example.com"], {
		cwd: repoRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["config", "user.name", "Test User"], {
		cwd: repoRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["add", "."], { cwd: repoRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: repoRoot, stdio: "ignore" });
}

function runScaffold(planPath, targetDir) {
	execFileSync(process.execPath, [SCAFFOLD_TARGET_PATH, planPath, "--target", targetDir], {
		encoding: "utf8",
		env: GIT_TEST_ENV,
		stdio: "pipe",
	});
}

function createContractFixture() {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-build-scaffold-contract-"));
	const repoRoot = path.join(tempDir, "repo");
	const targetDir = path.join(tempDir, "output");
	const planPath = path.join(tempDir, "plan.json");

	try {
		writeDeliveryInputs(repoRoot);
		writeFile(
			path.join(repoRoot, "package.json"),
			JSON.stringify(
				{
					packageManager: "pnpm@11.25.0",
					dependencies: {
						next: "16.3.0",
						react: "19.2.8",
						"@tiptap/core": "catalog:",
						"react-leaflet": "^5.0.0",
						leaflet: "^1.9.4",
						three: "^0.185.1",
						"tw-animate-css": "^1.4.0",
						"motion-plus": "2.11.2",
						"ansi-to-react": "^6.2.6",
					},
					devDependencies: {
						shadcn: "^4.16.2",
						"@types/leaflet": "^1.9.22",
						"@types/three": "^0.185.4",
					},
				},
				null,
				2,
			),
		);
		writeFile(
			path.join(repoRoot, "backend", "package.json"),
			JSON.stringify({ dependencies: { express: "^5.2.1", cors: "^2.8.5" } }),
		);
		writeFile(
			path.join(repoRoot, "backend", "server.js"),
			`const express = require("express");
function start(runtime) {
\tregisterStaticExportServing(runtime.app, {
\t\texpressImpl: express,
\t});
}
`,
		);
		writeFile(path.join(repoRoot, "backend", "node_modules", "cors", "sentinel"), "installed\n");
		writeFile(path.join(repoRoot, "lib", "untraced-source.ts"), "export const hidden = true;\n");
		writeFile(path.join(repoRoot, "app", "contexts", "context-required-inline.tsx"),
			`export function RequiredInlineProvider({ value, children }: Readonly<{
\tvalue: string;
\tchildren: unknown;
}>) { return children; }
`);
		writeFile(path.join(repoRoot, "rovo", "config.js"), "module.exports = {};\n");
		writeFile(path.join(repoRoot, "scripts", "lib", "worktree-ports.js"), "module.exports = {};\n");
		writeFile(path.join(repoRoot, "scripts", "build-static-export.mjs"), "// export wrapper\n");
		writeFile(path.join(repoRoot, "scripts", "dev-deploy-fast.sh"), "#!/bin/bash\n# canonical deploy\n");
		writeFile(
			path.join(repoRoot, "pnpm-workspace.yaml"),
			`packages:
  - .
catalog:
  '@tiptap/core': 3.30.0
overrides:
  lodash-es: ^4.18.1
allowBuilds:
  protobufjs: true
  better-sqlite3: false
`,
		);
		writeFile(
			path.join(repoRoot, ".npmrc"),
			`registry=https://registry.npmjs.org/
@atlaskit:registry=https://registry.npmjs.org/
@atlassian:registry=https://packages.atlassian.com/artifactory/api/npm/atlassian-npm/
`,
		);
		writeFile(
			path.join(repoRoot, "app", "awake", "page.tsx"),
			`export default function Page() {
	return <div>awake</div>;
}
`,
		);
		writeFile(
			path.join(repoRoot, "app", "globals.css"),
			`@import "./tailwind-theme.css";
@import "./dash-4-2.css";
@import "./typeset.css";
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "../node_modules/@excalidraw/excalidraw/dist/prod/index.css";
`,
		);
		writeFile(path.join(repoRoot, "app", "tailwind-theme.css"),
			`@import "./tailwind-theme-agent-loading.css";
:root { --fixture-color: #fff; }
`);
		writeFile(path.join(repoRoot, "app", "tailwind-theme-agent-loading.css"),
			".agent-loading { opacity: 1; }\n");
		writeFile(path.join(repoRoot, "app", "dash-4-2.css"), "/* dash */\n");
		writeFile(path.join(repoRoot, "app", "typeset.css"),
			"code { font-family: \"JetBrains Mono\"; }\n");
		writeFile(
			path.join(repoRoot, "components", "projects", "shared", "components", "chat-messages.module.css"),
			".chat { display: flex; }\n",
		);
		writeFile(
			path.join(repoRoot, "components", "utils", "theme-wrapper.tsx"),
			`export function ThemeWrapper({ children }) {
	return children;
}
`,
		);
		writeFile(
			path.join(repoRoot, "lib", "utils.ts"),
			`export function cn(...classes) {
	return classes.filter(Boolean).join(" ");
}
`,
		);
		writeFile(
			path.join(repoRoot, "lib", "studio-agent-data-flow.js"),
			`export function normalizeAgentDataFlowConfig(value) { return value; }\n`,
		);
		writeFile(
			path.join(repoRoot, "lib", "studio-agent-data-flow.d.ts"),
			`export function normalizeAgentDataFlowConfig(value: unknown): unknown;\n`,
		);
		writeFile(path.join(repoRoot, "types", "speech-recognition.d.ts"), "interface SpeechRecognition {}\n");
		writeFile(
			path.join(repoRoot, "app", "contexts", "context-creation-mode.tsx"),
			`export function CreationModeProvider({ children }: { children: unknown }) {
	return children;
}
`,
		);
		writeFile(
			path.join(repoRoot, "app", "contexts", "context-work-item-modal.tsx"),
			`interface WorkItemModalProviderProps {
	children: unknown;
	isOpen: boolean;
	onClose: () => void;
	workItem: { id: string };
}

export function WorkItemModalProvider({
	children,
	isOpen,
	onClose,
	workItem,
}: WorkItemModalProviderProps) {
	return children;
}
`,
		);
		writeFile(
			path.join(repoRoot, "public", "fonts", "ark-es", "ARK-ES-SolidLight.woff"),
			"solid-light-font\n",
		);
		writeFile(
			planPath,
			JSON.stringify(
				{
					repoRoot,
					route: "/awake",
					entry: "app/awake/page.tsx",
					layout: null,
					files: [
						"app/awake/page.tsx",
						"components/utils/theme-wrapper.tsx",
						"lib/utils.ts",
						"lib/studio-agent-data-flow.js",
						"app/contexts/context-creation-mode.tsx",
						"app/contexts/context-work-item-modal.tsx",
						"app/contexts/context-required-inline.tsx",
					],
					assets: [],
					cssImports: [
						"components/projects/shared/components/chat-messages.module.css",
					],
					npmPackages: {
						next: "16.3.0",
						react: "19.2.8",
						"@tiptap/core": "catalog:",
						"react-leaflet": "^5.0.0",
						three: "^0.185.1",
					},
					contextFiles: [
						"app/contexts/context-creation-mode.tsx",
						"app/contexts/context-work-item-modal.tsx",
						"app/contexts/context-required-inline.tsx",
					],
				},
				null,
				2,
			),
		);
		initGitRepo(repoRoot);
		writeFile(path.join(repoRoot, "backend", "data", "rovo-app", "threads", "local", "thread.json"),
			"{\"local\":true}\n");
		return {
			targetDir,
			planPath,
			cleanup() {
				fs.rmSync(tempDir, { recursive: true, force: true });
			},
		};
	} catch (error) {
		fs.rmSync(tempDir, { recursive: true, force: true });
		throw error;
	}
}

test("scaffold-target resolves catalog versions, copies npmrc, and adds host peers", () => {
	const fixture = createContractFixture();

	try {
		runScaffold(fixture.planPath, fixture.targetDir);
		const pkg = JSON.parse(fs.readFileSync(path.join(fixture.targetDir, "package.json"), "utf8"));

		assert.equal(pkg.dependencies["@tiptap/core"], "3.30.0");
		assert.notEqual(pkg.dependencies["@tiptap/core"], "catalog:");
		assert.equal(pkg.dependencies.leaflet, "^1.9.4");
		assert.equal(pkg.dependencies.shadcn, "^4.16.2");
		assert.equal(pkg.devDependencies["@types/leaflet"], "^1.9.22");
		assert.equal(pkg.devDependencies["@types/three"], "^0.185.4");
		assert.equal(
			fs.readFileSync(path.join(fixture.targetDir, ".npmrc"), "utf8"),
			`registry=https://registry.npmjs.org/
@atlaskit:registry=https://registry.npmjs.org/
@atlassian:registry=https://packages.atlassian.com/artifactory/api/npm/atlassian-npm/
`,
		);
	} finally {
		fixture.cleanup();
	}
});

test("scaffold-target pins extracted direct dependencies to source lockfile versions", () => {
	const fixture = createFixture({
		includeMotion: true,
		extraPackages: { express: "^5.2.1" },
		sourceLock: [
			"lockfileVersion: '9.0'",
			"importers:",
			"  .:",
			"    dependencies:",
			"      motion:",
			"        specifier: ^13.1.1",
			"        version: 13.1.1(react-dom@19.2.8(react@19.2.8))(react@19.2.8)",
			"  backend:",
			"    dependencies:",
			"      express:",
			"        specifier: ^5.2.1",
			"        version: 5.2.0",
			"packages:",
		].join("\n"),
	});

	try {
		execFileSync(process.execPath, [SCAFFOLD_TARGET_PATH, fixture.planPath, "--target", fixture.targetDir], {
			encoding: "utf8",
			env: GIT_TEST_ENV,
			stdio: "pipe",
		});

		const targetPackage = JSON.parse(fs.readFileSync(path.join(fixture.targetDir, "package.json"), "utf8"));
		assert.equal(targetPackage.dependencies.motion, "13.1.1");
		assert.equal(targetPackage.dependencies.express, "5.2.0");
	} finally {
		fixture.cleanup();
	}
});

test("scaffold-target wraps motion routes in the source reduced-motion provider", async () => {
	const fixture = createFixture({ includeMotion: true });

	try {
		execFileSync(process.execPath, [SCAFFOLD_TARGET_PATH, fixture.planPath, "--target", fixture.targetDir], {
			encoding: "utf8",
			env: GIT_TEST_ENV,
			stdio: "pipe",
		});

		const layout = fs.readFileSync(path.join(fixture.targetDir, "app", "layout.tsx"), "utf8");
		const renderedLayout = await renderGeneratedLayout(layout);
		const motionConfig = layout.indexOf("<MotionConfig reducedMotion=\"user\">");
		const themeWrapper = layout.indexOf("<ThemeWrapper>");
		const main = layout.indexOf("<main id=\"main-content\">");

		assert.match(layout, /import \{ MotionConfig \} from "motion\/react";/);
		assert.ok(motionConfig >= 0 && motionConfig < themeWrapper && themeWrapper < main);
		assert.match(renderedLayout, /<main id="main-content">/);
	} finally {
		fixture.cleanup();
	}
});

test("scaffold-target copies local CSS and never strips shadcn", () => {
	const fixture = createContractFixture();

	try {
		runScaffold(fixture.planPath, fixture.targetDir);
		const globals = fs.readFileSync(path.join(fixture.targetDir, "app", "globals.css"), "utf8");

		assert.match(globals, /@import "\.\.\/node_modules\/shadcn\/dist\/tailwind\.css"/);
		assert.doesNotMatch(globals, /@import "shadcn\/tailwind\.css"/);
		assert.doesNotMatch(globals, /stripped @import for missing dep "shadcn"/);
		assert.equal(
			fs.readFileSync(path.join(fixture.targetDir, "app", "dash-4-2.css"), "utf8"),
			"/* dash */\n",
		);
		assert.equal(
			fs.readFileSync(path.join(fixture.targetDir, "app", "typeset.css"), "utf8"),
			"code { font-family: \"JetBrains Mono\"; }\n",
		);
		assert.match(fs.readFileSync(path.join(fixture.targetDir, "app", "layout.tsx"), "utf8"),
			/fonts\.googleapis\.com\/css2/);
		assert.equal(
			fs.readFileSync(path.join(fixture.targetDir, "app", "tailwind-theme-agent-loading.css"), "utf8"),
			".agent-loading { opacity: 1; }\n",
		);
		assert.equal(
			fs.readFileSync(
				path.join(
					fixture.targetDir,
					"components",
					"projects",
					"shared",
					"components",
					"chat-messages.module.css",
				),
				"utf8",
			),
			".chat { display: flex; }\n",
		);
	} finally {
		fixture.cleanup();
	}
});

test("scaffold-target wraps children-only providers and copies ambient dts", () => {
	const fixture = createContractFixture();

	try {
		runScaffold(fixture.planPath, fixture.targetDir);
		const layout = fs.readFileSync(path.join(fixture.targetDir, "app", "layout.tsx"), "utf8");

		assert.match(layout, /import \{ CreationModeProvider \} from "@\/app\/contexts\/context-creation-mode";/);
		assert.match(layout, /<CreationModeProvider>/);
		assert.doesNotMatch(layout, /WorkItemModalProvider/);
		assert.equal(
			fs.readFileSync(path.join(fixture.targetDir, "lib", "studio-agent-data-flow.d.ts"), "utf8"),
			`export function normalizeAgentDataFlowConfig(value: unknown): unknown;\n`,
		);
		assert.equal(
			fs.readFileSync(path.join(fixture.targetDir, "types", "speech-recognition.d.ts"), "utf8"),
			"interface SpeechRecognition {}\n",
		);
	} finally {
		fixture.cleanup();
	}
});

test("backend-backed scaffold preserves source backend and generates proxy/deployment harness", () => {
	const fixture = createContractFixture();
	try {
		execFileSync(process.execPath, [
			SCAFFOLD_TARGET_PATH,
			fixture.planPath,
			"--target",
			fixture.targetDir,
			"--backend-backed",
		], { env: GIT_TEST_ENV, stdio: "pipe" });
		const targetPackage = JSON.parse(fs.readFileSync(path.join(fixture.targetDir, "package.json"), "utf8"));
		assert.equal(targetPackage.dependencies.express, "^5.2.1");
		assert.equal(targetPackage.dependencies.cors, "^2.8.5");
		assert.equal(targetPackage.dependencies["motion-plus"], undefined);
		assert.equal(targetPackage.dependencies["ansi-to-react"], undefined);
		assert.equal(targetPackage.scripts.dev, "node scripts/dev-backend-backed.mjs");
		assert.equal(targetPackage.scripts.start, "node backend/extracted-server.js");
		assert.equal(targetPackage.scripts.build, "next build --webpack");
		assert.equal(targetPackage.packageManager, "pnpm@11.25.0");
		assert.equal(targetPackage.scripts["build:export"], "node scripts/build-static-export.mjs");
		assert.equal(targetPackage.scripts["deploy:micros"], "./scripts/dev-deploy-fast.sh");
		assert.match(fs.readFileSync(path.join(fixture.targetDir, "next.config.ts"), "utf8"), /NEXT_OUTPUT/);
		const descriptorPath = path.join(fixture.targetDir, "service-descriptor.yml");
		const descriptor = fs.readFileSync(descriptorPath, "utf8");
		assert.match(descriptor, /ALLOWED_ORIGINS: \(\(ssm:\/YOUR-SERVICE-NAME\/ALLOWED_ORIGINS\)\)/);
		fs.writeFileSync(descriptorPath, descriptor.replaceAll("YOUR-SERVICE-NAME", "example-service"));
		execFileSync("/bin/bash", ["-c", 'source "$1"; vpk_validate_descriptor_identity example-service "$2"', "validate-generated-descriptor",
			path.resolve(__dirname, "../../vpk-deploy/scripts/deploy-lib.sh"), descriptorPath], { stdio: "pipe" });
		assert.equal(fs.readFileSync(path.join(fixture.targetDir, "scripts", "build-static-export.mjs"), "utf8"), "// export wrapper\n");
		assert.equal(fs.readFileSync(path.join(fixture.targetDir, "pnpm-workspace.yaml"), "utf8"),
			"overrides:\n  lodash-es: ^4.18.1\nallowBuilds:\n  protobufjs: true\n  better-sqlite3: false\n");
		assert.equal(fs.existsSync(path.join(fixture.targetDir, "backend", "node_modules")), false);
		assert.equal(fs.existsSync(path.join(fixture.targetDir, "backend", "data")), false);
		assert.equal(fs.existsSync(path.join(fixture.targetDir, "lib", "untraced-source.ts")), false);
		const layout = fs.readFileSync(path.join(fixture.targetDir, "app", "layout.tsx"), "utf8");
		assert.doesNotMatch(layout, /RequiredInlineProvider/);
		assert.equal(
			fs.readFileSync(path.join(fixture.targetDir, "backend", "server.js"), "utf8"),
			fs.readFileSync(path.join(path.dirname(fixture.planPath), "repo", "backend", "server.js"), "utf8"),
		);
		const extractedServer = fs.readFileSync(path.join(fixture.targetDir, "backend", "extracted-server.js"), "utf8");
		assert.match(extractedServer, /registerCrossRouteRedirects\(runtime\.app\)/);
		assert.match(extractedServer, /registerStaticExportServing\(runtime\.app/);
		const dev = fs.readFileSync(path.join(fixture.targetDir, "scripts", "dev-backend-backed.mjs"), "utf8");
		assert.match(dev, /\/api\/health/);
		assert.match(dev, /proxyUpgrade/);
		assert.match(dev, /api\/realtime\/ws-url/);
		assert.match(dev, /process\.env\.VPK_ROOT/);
		assert.doesNotMatch(dev, /VPK_ROVO_ROOT/);
		assert.doesNotMatch(fs.readFileSync(path.join(fixture.targetDir, "README.md"), "utf8"), /VPK_ROVO_ROOT/);
		assert.doesNotMatch(dev, /\{\{SOURCE_RELATIVE_PATH\}\}/);
		execFileSync(process.execPath, ["--check", path.join(fixture.targetDir, "scripts", "dev-backend-backed.mjs")]);
		assert.match(fs.readFileSync(path.join(fixture.targetDir, "backend", "Dockerfile"), "utf8"),
			/CMD \["node", "backend\/extracted-server\.js"\]/);
		assert.equal(fs.readFileSync(path.join(fixture.targetDir, "rovo", "config.js"), "utf8"),
			"module.exports = {};\n");
	} finally {
		fixture.cleanup();
	}
});

test("scaffold carries a declared hydration adapter and asset audit into the target", () => {
	const fixture = createFixture({ includeMotion: true });
	try {
		const relative = "components/fixture-motion.tsx";
		const original = 'import { motion, useReducedMotion } from "motion/react";\nexport const readPreference = () => useReducedMotion();\n';
		writeFile(path.join(fixture.repoRoot, relative), original);
		const plan = JSON.parse(fs.readFileSync(fixture.planPath, "utf8"));
		plan.files.push(relative);
		fs.writeFileSync(fixture.planPath, JSON.stringify(plan));
		execFileSync(process.execPath, [SCAFFOLD_TARGET_PATH, fixture.planPath, "--target", fixture.targetDir], { stdio: "pipe" });
		const provenance = JSON.parse(fs.readFileSync(path.join(fixture.targetDir, ".vpk-source.json"), "utf8"));
		assert.deepEqual(provenance.harnessAdaptations.hydrationSafeMotion, [relative]);
		assert.equal(fs.existsSync(path.join(fixture.targetDir, "hooks/use-extraction-reduced-motion.ts")), true);
		assert.equal(fs.existsSync(path.join(fixture.targetDir, "scripts/audit-public-assets.mjs")), true);
		assert.equal(fs.readFileSync(path.join(fixture.repoRoot, relative), "utf8"), original);
		execFileSync(process.execPath, ["--check", path.join(fixture.targetDir, "scripts/audit-public-assets.mjs")]);
	} finally { fixture.cleanup(); }
});
