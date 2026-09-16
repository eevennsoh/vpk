const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SCAFFOLD_TARGET_PATH = path.resolve(__dirname, "scaffold-target.mjs");

function writeFile(filePath, contents) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, contents, "utf8");
}

function createFixture() {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-build-scaffold-"));
	const repoRoot = path.join(tempDir, "repo");
	const targetDir = path.join(tempDir, "output");
	const planPath = path.join(tempDir, "plan.json");

	try {
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

test("scaffold-target emits the updated layout, shim, config, and fonts for extracted routes", () => {
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

		assert.match(
			page,
			/import AwakeDemo from "@\/components\/website\/demos\/arts\/awake-demo";/,
		);
		assert.match(page, /return <AwakeDemo \/>;/);

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
		assert.match(layout, /const themeStyles = await getThemeStyles\(THEME_STATE\);/);
		assert.doesNotMatch(layout, /next\/script/);
		assert.doesNotMatch(layout, /clientShim/);

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
			fs.readFileSync(path.join(fixture.targetDir, "app", "tailwind-theme.css"), "utf8"),
			":root { --fixture-color: #fff; }\n",
		);

		assert.match(nextConfig, /root: process\.cwd\(\),/);
		assert.doesNotMatch(nextConfig, /root:\s*fileURLToPath\(/);
		assert.match(nextConfig, /allowedDevOrigins:\s*\[\s*"127\.0\.2\.2",\s*"localhost"\s*\]/);

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
		writeFile(
			path.join(repoRoot, "package.json"),
			JSON.stringify(
				{
					dependencies: {
						next: "16.3.0",
						react: "19.2.8",
						"@tiptap/core": "catalog:",
						"react-leaflet": "^5.0.0",
						leaflet: "^1.9.4",
						three: "^0.185.1",
						"tw-animate-css": "^1.4.0",
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
		writeFile(
			path.join(repoRoot, "pnpm-workspace.yaml"),
			`packages:
  - .
catalog:
  '@tiptap/core': 3.30.0
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
		writeFile(path.join(repoRoot, "app", "typeset.css"), "/* typeset */\n");
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
			"/* typeset */\n",
		);
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
		assert.equal(targetPackage.scripts.dev, "node scripts/dev-backend-backed.mjs");
		assert.equal(targetPackage.scripts.start, "node backend/extracted-server.js");
		assert.equal(fs.readFileSync(path.join(fixture.targetDir, "pnpm-workspace.yaml"), "utf8"),
			"allowBuilds:\n  protobufjs: true\n  better-sqlite3: false\n");
		assert.equal(fs.existsSync(path.join(fixture.targetDir, "backend", "node_modules")), false);
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
