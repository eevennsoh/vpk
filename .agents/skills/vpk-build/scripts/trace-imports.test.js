const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TRACE_IMPORTS_PATH = path.resolve(__dirname, "trace-imports.mjs");

function writeFile(filePath, contents) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, contents, "utf8");
}

function createFixture() {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-build-trace-"));
	const repoRoot = path.join(tempDir, "repo");
	const planPath = path.join(tempDir, "plan.json");

	try {
		writeFile(
			path.join(repoRoot, "package.json"),
			JSON.stringify(
				{
					dependencies: {
						next: "16.2.6",
						react: "19.2.6",
					},
					devDependencies: {
						typescript: "6.0.3",
					},
				},
				null,
				2,
			),
		);
		writeFile(
			path.join(repoRoot, "app", "studio", "[[...id]]", "page.tsx"),
			`import { SAMPLE_AGENT_PEOPLE } from "@/app/data/directory/people";

export default function Page() {
	return <div>{SAMPLE_AGENT_PEOPLE[0].name}</div>;
}
`,
		);
		writeFile(
			path.join(repoRoot, "app", "data", "directory", "people.ts"),
			`import peopleData from "./people.json";

export const SAMPLE_AGENT_PEOPLE = peopleData;
`,
		);
		writeFile(
			path.join(repoRoot, "app", "data", "directory", "people.json"),
			JSON.stringify(
				[
					{
						name: "Maia Ma",
						avatarSrc: "/avatar-human/maia-ma.png",
						profileAvatarSrc: "/avatar-agent/dev-agents/feature-flag-cleaner.svg",
						apps: [
							{
								name: "Slack",
								iconSrc: "/3p/slack/16.svg",
							},
							{
								name: "Notion",
								iconSrc: "/3p/notion/16.svg",
							},
						],
					},
				],
				null,
				2,
			),
		);
		writeFile(
			path.join(repoRoot, "public", "avatar-agent-unmasked", "dev-agents", "feature-flag-cleaner.svg"),
			"<svg />",
		);
		writeFile(
			path.join(repoRoot, "public", "3p", "notion", "16-borderless.svg"),
			"<svg />",
		);

		return {
			planPath,
			repoRoot,
			cleanup() {
				fs.rmSync(tempDir, { recursive: true, force: true });
			},
		};
	} catch (error) {
		fs.rmSync(tempDir, { recursive: true, force: true });
		throw error;
	}
}

test("trace-imports follows imported JSON files and records their public asset references", () => {
	const fixture = createFixture();

	try {
		execFileSync(
			process.execPath,
			[
				TRACE_IMPORTS_PATH,
				"/studio/[[...id]]",
				"--repo",
				fixture.repoRoot,
				"--out",
				fixture.planPath,
			],
			{ encoding: "utf8", stdio: "pipe" },
		);

		const plan = JSON.parse(fs.readFileSync(fixture.planPath, "utf8"));

		assert.ok(
			plan.files.includes("app/data/directory/people.json"),
			"imported JSON should be copied as source data",
		);
		assert.ok(
			plan.assets.includes("/avatar-human/maia-ma.png"),
			"asset paths inside JSON should be traced",
		);
		assert.ok(
			plan.assets.includes("/3p/slack/16.svg"),
			"nested asset paths inside JSON should be traced",
		);
		assert.ok(
			plan.assets.includes("/avatar-agent-unmasked/dev-agents/feature-flag-cleaner.svg"),
			"unmasked avatar companion assets should be traced",
		);
		assert.ok(
			plan.assets.includes("/3p/notion/16-borderless.svg"),
			"third-party borderless logo companion assets should be traced",
		);
		assert.ok(
			!plan.assets.includes("/app/data/directory/people.json"),
			"imported JSON should not be treated as a public asset",
		);
	} finally {
		fixture.cleanup();
	}
});

function runTrace(repoRoot, route, planPath) {
	execFileSync(
		process.execPath,
		[TRACE_IMPORTS_PATH, route, "--repo", repoRoot, "--out", planPath],
		{ encoding: "utf8", stdio: "pipe" },
	);
	return JSON.parse(fs.readFileSync(planPath, "utf8"));
}

function createMinimalRepo(extraFiles = {}) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-build-trace-"));
	const repoRoot = path.join(tempDir, "repo");
	const planPath = path.join(tempDir, "plan.json");
	try {
		writeFile(
			path.join(repoRoot, "package.json"),
			JSON.stringify(
				{
					dependencies: {
						next: "16.2.6",
						react: "19.2.6",
						"@tiptap/core": "catalog:",
						"react-leaflet": "^5.0.0",
						leaflet: "^1.9.4",
						three: "^0.185.1",
					},
					devDependencies: {
						typescript: "6.0.3",
						"@types/leaflet": "^1.9.22",
						"@types/three": "^0.185.4",
					},
				},
				null,
				2,
			),
		);
		writeFile(
			path.join(repoRoot, "pnpm-workspace.yaml"),
			`packages:
  - .
catalog:
  '@tiptap/core': 3.30.0
  '@json-render/core': 0.19.0
  remotion: 4.0.508
`,
		);
		writeFile(
			path.join(repoRoot, "app", "globals.css"),
			`@import "./tailwind-theme.css";
@import "./dash-4-2.css";
@import "./typeset.css";
`,
		);
		writeFile(path.join(repoRoot, "app", "dash-4-2.css"), "/* dash */\n");
		writeFile(path.join(repoRoot, "app", "typeset.css"), "/* typeset */\n");
		writeFile(path.join(repoRoot, "app", "tailwind-theme.css"), "/* theme */\n");
		writeFile(path.join(repoRoot, "types", "speech-recognition.d.ts"), "interface SpeechRecognition {}\n");
		writeFile(path.join(repoRoot, "types", "atlassian-logo-third-party.d.ts"), "export {};\n");
		writeFile(
			path.join(repoRoot, "lib", "studio-agent-data-flow.js"),
			`export function normalizeAgentDataFlowConfig(value) { return value; }\n`,
		);
		writeFile(
			path.join(repoRoot, "lib", "studio-agent-data-flow.d.ts"),
			`export function normalizeAgentDataFlowConfig(value: unknown): unknown;\n`,
		);
		writeFile(
			path.join(repoRoot, "app", "demo", "page.tsx"),
			`import { Editor } from "@tiptap/core";
import { MapContainer } from "react-leaflet";
import { Scene } from "three";
import { normalizeAgentDataFlowConfig } from "@/lib/studio-agent-data-flow";
import "./panel.module.css";

export default function Page() {
	return <div>{String(Editor)}{String(MapContainer)}{String(Scene)}{String(normalizeAgentDataFlowConfig)}</div>;
}
`,
		);
		writeFile(path.join(repoRoot, "app", "demo", "panel.module.css"), ".panel { display: flex; }\n");
		for (const [rel, contents] of Object.entries(extraFiles)) {
			writeFile(path.join(repoRoot, rel), contents);
		}
		return {
			planPath,
			repoRoot,
			cleanup() {
				fs.rmSync(tempDir, { recursive: true, force: true });
			},
		};
	} catch (error) {
		fs.rmSync(tempDir, { recursive: true, force: true });
		throw error;
	}
}

test("trace plan records the selected Git revision and working-tree state", () => {
	const fixture = createMinimalRepo();
	try {
		execFileSync("git", ["init", "-q"], { cwd: fixture.repoRoot });
		execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: fixture.repoRoot });
		execFileSync("git", ["config", "user.name", "Test User"], { cwd: fixture.repoRoot });
		execFileSync("git", ["add", "-A"], { cwd: fixture.repoRoot });
		execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: fixture.repoRoot });
		const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: fixture.repoRoot, encoding: "utf8" }).trim();
		const cleanPlan = runTrace(fixture.repoRoot, "/demo", fixture.planPath);
		assert.equal(cleanPlan.sourceRevision, revision);
		assert.equal(cleanPlan.sourceWasDirty, false);
		writeFile(path.join(fixture.repoRoot, "app", "demo", "panel.module.css"), ".panel { display: grid; }\n");
		const dirtyPlan = runTrace(fixture.repoRoot, "/demo", fixture.planPath);
		assert.equal(dirtyPlan.sourceRevision, revision);
		assert.equal(dirtyPlan.sourceWasDirty, true);
	} finally {
		fixture.cleanup();
	}
});

test("trace-imports resolves catalog: versions and host-package peers", () => {
	const fixture = createMinimalRepo();

	try {
		const plan = runTrace(fixture.repoRoot, "/demo", fixture.planPath);

		assert.equal(plan.npmPackages["@tiptap/core"], "3.30.0");
		assert.notEqual(plan.npmPackages["@tiptap/core"], "catalog:");
		assert.equal(plan.npmPackages.leaflet, "^1.9.4");
		assert.equal(plan.npmPackages["@types/leaflet"], "^1.9.22");
		assert.equal(plan.npmPackages["@types/three"], "^0.185.4");
	} finally {
		fixture.cleanup();
	}
});

test("trace-imports adds ambient dts, sibling dts, and local CSS imports", () => {
	const fixture = createMinimalRepo();

	try {
		const plan = runTrace(fixture.repoRoot, "/demo", fixture.planPath);

		assert.ok(plan.files.includes("types/speech-recognition.d.ts"));
		assert.ok(plan.files.includes("types/atlassian-logo-third-party.d.ts"));
		assert.ok(plan.files.includes("lib/studio-agent-data-flow.js"));
		assert.ok(plan.files.includes("lib/studio-agent-data-flow.d.ts"));
		assert.ok(plan.cssImports.includes("app/demo/panel.module.css"));
		assert.ok(plan.cssImports.includes("app/dash-4-2.css"));
		assert.ok(plan.cssImports.includes("app/typeset.css"));
	} finally {
		fixture.cleanup();
	}
});
