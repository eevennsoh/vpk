#!/usr/bin/env node
/*
 * doctor: environment and capability report for vpk-html (ws6 §5.6, C2). The check list
 * and verdict follow kami's build.py --doctor (MIT).
 *
 *   node scripts/build.mjs --doctor [--json] [--online] [--no-launch]
 *
 * Offline by default; --online adds the gh and twg auth probes. Read-only: files are read
 * through deps.fs only, and ensure-fonts.mjs (which rewrites MANIFEST.md) is never called.
 * Exit 0 when every required check is ok or skipped, 1 otherwise.
 */

import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { resolveRepoRoot, SKILL_ROOT } from "./repo-root.mjs";
import { FONT_FILES, checkStyleSource } from "./shared.mjs";

export const DOCTOR_CHECK_IDS = Object.freeze(["node", "skill-files", "fonts", "styles-sync", "playwright", "chromium", "chromium-launch", "git", "gh", "twg", "artifact-scripts", "ffmpeg", "ffprobe"]);
const SANDBOX_FAILURE = /Target page, context or browser has been closed|EPERM|Operation not permitted/;
const SANDBOX_FIX = "Chromium could not start: inside an OS sandbox, run Chromium commands unsandboxed";
const CHROMIUM_PURPOSE = "--verify, --pdf, gates, --screenshot";

function playwrightVersion() {
	try { return createRequire(import.meta.url)("@playwright/test/package.json").version; } catch { return undefined; }
}

export function defaultDoctorDeps() {
	return {
		execFile: (command, args) => new Promise(resolve => {
			execFile(command, args, { timeout: 5000 }, (error, stdout, stderr) => resolve({
				code: error ? (Number.isInteger(error.code) ? error.code : 127) : 0,
				stdout: String(stdout ?? ""),
				stderr: String(stderr ?? "") || (error ? error.message : ""),
			}));
		}),
		fs: { existsSync: fs.existsSync, readFileSync: fs.readFileSync, readdirSync: fs.readdirSync },
		importPlaywright: async () => ({ chromium: (await import("@playwright/test")).chromium, version: playwrightVersion() }),
		launchProbe: async ({ timeout = 15000 } = {}) => {
			const { chromium } = await import("@playwright/test");
			const browser = await chromium.launch({ timeout });
			await browser.close();
		},
		checkStyleSource,
		env: process.env,
		repoRoot: resolveRepoRoot(),
		skillRoot: SKILL_ROOT,
		homedir: os.homedir(),
		nodeVersion: process.versions.node,
		fontFiles: FONT_FILES,
	};
}

const versionOf = output => /\d+(?:\.\d+)+/.exec(String(output))?.[0];
const firstLine = value => String(value ?? "").trim().split("\n")[0].slice(0, 200);

function readManifest(fileSystem, file) {
	const rows = new Map();
	for (const line of String(fileSystem.readFileSync(file, "utf8")).split("\n")) {
		const cells = line.split("|").map(cell => cell.trim());
		if (cells.length < 11 || !cells[1] || cells[1] === "Family" || /^-+$/.test(cells[1])) continue;
		rows.set(cells[1], { file: cells[2], bytes: Number(cells[8]), sha256: cells[9] });
	}
	return rows;
}

function fontCheck(d) {
	const manifestFile = path.join(d.skillRoot, "assets", "fonts", "MANIFEST.md");
	const base = { id: "fonts", label: "Embedded fonts", required: true, purpose: "offline font embedding", fix: "restore assets/fonts/ from git, then run node .agents/skills/vpk-html/scripts/ensure-fonts.mjs" };
	if (!d.fs.existsSync(manifestFile)) return { ...base, status: "missing", detail: "assets/fonts/MANIFEST.md is missing" };
	const manifest = readManifest(d.fs, manifestFile);
	const missing = [];
	const drift = [];
	for (const font of d.fontFiles) {
		const file = path.join(d.skillRoot, "assets", "fonts", font.file);
		const bytes = d.fs.existsSync(file) ? d.fs.readFileSync(file) : null;
		if (!bytes || bytes.length === 0) { missing.push(font.file); continue; }
		const row = manifest.get(font.family);
		const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
		if (!row || row.file !== font.file || row.bytes !== bytes.length || row.sha256 !== sha256) drift.push(`${font.family} (${font.file})`);
	}
	if (missing.length) return { ...base, status: "missing", detail: `missing or empty: ${[...new Set(missing)].join(", ")}` };
	if (drift.length) return { ...base, status: "degraded", detail: `size or SHA-256 differs from MANIFEST.md: ${drift.join(", ")}` };
	const { fix, ...ok } = base;
	return { ...ok, status: "ok", detail: `${d.fontFiles.length} faces match MANIFEST.md` };
}

async function binaryCheck(d, { id, label, purpose, command, args, fix }) {
	const result = await d.execFile(command, args);
	return result.code === 0
		? { id, label, required: false, status: "ok", purpose, version: versionOf(result.stdout || result.stderr) }
		: { id, label, required: false, status: "missing", purpose, detail: firstLine(result.stderr), fix };
}

export async function collectDoctorReport(args = {}, deps = {}) {
	const d = { ...defaultDoctorDeps(), ...deps };
	const checks = [];
	const nodeOk = Number(String(d.nodeVersion).split(".")[0]) >= 22;
	checks.push({ id: "node", label: "Node.js", required: true, status: nodeOk ? "ok" : "missing", version: d.nodeVersion, purpose: "build scripts", ...(nodeOk ? {} : { fix: "install Node 22+" }) });

	const absent = ["SKILL.md", "styles.css", "references/tokens.json", "assets/fonts/MANIFEST.md"].filter(rel => !d.fs.existsSync(path.join(d.skillRoot, rel)));
	const templatesDir = path.join(d.skillRoot, "assets", "templates");
	const templates = d.fs.existsSync(templatesDir) ? d.fs.readdirSync(templatesDir).filter(name => name.endsWith(".html")).length : 0;
	if (templates === 0) absent.push("assets/templates/*.html");
	checks.push({ id: "skill-files", label: "Skill files", required: true, status: absent.length ? "missing" : "ok", purpose: "skill integrity", ...(absent.length ? { detail: `missing: ${absent.join(", ")}`, fix: "restore from git" } : { detail: `${templates} templates` }) });
	checks.push(fontCheck(d));

	let styleIssues = [];
	try { styleIssues = d.checkStyleSource() ?? []; } catch (problem) { styleIssues = [problem.message]; }
	checks.push({ id: "styles-sync", label: "Shared CSS mirror", required: false, status: styleIssues.length ? "degraded" : "ok", purpose: "styles.css matches references/tokens.json", ...(styleIssues.length ? { detail: firstLine(styleIssues[0]), fix: "node .agents/skills/vpk-html/scripts/build.mjs --write-styles" } : {}) });

	let playwright = null;
	try { playwright = await d.importPlaywright(); } catch (problem) {
		checks.push({ id: "playwright", label: "Playwright", required: true, status: "missing", purpose: CHROMIUM_PURPOSE, detail: firstLine(problem?.message), fix: "pnpm install" });
	}
	if (playwright) {
		checks.push({ id: "playwright", label: "Playwright", required: true, status: "ok", purpose: CHROMIUM_PURPOSE, ...(playwright.version ? { version: playwright.version } : {}) });
		let executable = null;
		try { executable = playwright.chromium.executablePath(); } catch { /* reported below */ }
		const present = Boolean(executable) && d.fs.existsSync(executable);
		checks.push({ id: "chromium", label: "Chromium binary", required: true, status: present ? "ok" : "missing", purpose: CHROMIUM_PURPOSE, ...(present ? { detail: executable } : { fix: "pnpm exec playwright install chromium" }) });
	} else {
		checks.push({ id: "chromium", label: "Chromium binary", required: true, status: "missing", purpose: CHROMIUM_PURPOSE, detail: "needs Playwright", fix: "pnpm install, then pnpm exec playwright install chromium" });
	}
	if (args.launch === false) {
		checks.push({ id: "chromium-launch", label: "Chromium launch", required: true, status: "skipped", purpose: CHROMIUM_PURPOSE, detail: "--no-launch" });
	} else if (!playwright) {
		checks.push({ id: "chromium-launch", label: "Chromium launch", required: true, status: "missing", purpose: CHROMIUM_PURPOSE, detail: "needs Playwright", fix: "pnpm install" });
	} else {
		try {
			await d.launchProbe({ timeout: 15000 });
			checks.push({ id: "chromium-launch", label: "Chromium launch", required: true, status: "ok", purpose: CHROMIUM_PURPOSE });
		} catch (problem) {
			const message = String(problem?.message ?? problem);
			checks.push({ id: "chromium-launch", label: "Chromium launch", required: true, status: "missing", purpose: CHROMIUM_PURPOSE, detail: firstLine(message), fix: SANDBOX_FAILURE.test(message) ? SANDBOX_FIX : "reinstall Chromium: pnpm exec playwright install chromium" });
		}
	}

	checks.push(await binaryCheck(d, { id: "git", label: "git", purpose: "--github", command: "git", args: ["--version"], fix: "install git" }));
	const gh = await binaryCheck(d, { id: "gh", label: "GitHub CLI", purpose: "--github, --publish gist", command: "gh", args: ["--version"], fix: "install gh, then gh auth login" });
	if (gh.status === "ok" && args.online) {
		const auth = await d.execFile("gh", ["auth", "status"]);
		if (auth.code !== 0) {
			Object.assign(gh, { status: "degraded", detail: firstLine(auth.stderr || auth.stdout) || "not signed in", fix: d.env.GITHUB_TOKEN ? "a GITHUB_TOKEN env var overrides stored auth; run `env -u GITHUB_TOKEN gh auth status`" : "gh auth login" });
		}
	}
	checks.push(gh);
	let twg = await binaryCheck(d, { id: "twg", label: "TWG CLI", purpose: "--publish artifacts", command: "twg", args: ["--version"], fix: "install twg, then twg --env prod login --site hello" });
	let twgBinary = "twg";
	if (twg.status !== "ok") {
		const local = path.join(d.homedir, ".local", "bin", "twg");
		const fallback = await binaryCheck(d, { id: "twg", label: "TWG CLI", purpose: "--publish artifacts", command: local, args: ["--version"], fix: twg.fix });
		if (fallback.status === "ok") { twg = { ...fallback, detail: local }; twgBinary = local; }
	}
	if (twg.status === "ok" && args.online) {
		const whoami = await d.execFile(twgBinary, ["--env", "prod", "whoami", "-o", "json"]);
		if (whoami.code !== 0) Object.assign(twg, { status: "degraded", detail: firstLine(whoami.stderr || whoami.stdout) || "not signed in", fix: "twg --env prod login --site hello" });
	}
	checks.push(twg);
	const scripts = d.repoRoot ? ["publish-artifact.mjs", "verify-artifact-html.mjs"].filter(name => !d.fs.existsSync(path.join(d.repoRoot, "scripts", name))) : null;
	checks.push({ id: "artifact-scripts", label: "Artifacts scripts", required: false, status: scripts && scripts.length === 0 ? "ok" : "missing", purpose: "--publish artifacts", ...(scripts && scripts.length === 0 ? {} : { detail: scripts ? `missing: ${scripts.join(", ")}` : "no VPK repository root (standalone skill)", fix: "use twg or the MCP flow in references/publish.md" }) });
	for (const id of ["ffmpeg", "ffprobe"]) {
		checks.push(await binaryCheck(d, { id, label: id, purpose: "media pipeline (capture, encode, embed)", command: id, args: ["-version"], fix: "brew install ffmpeg" }));
	}
	const ok = checks.filter(check => check.required).every(check => check.status === "ok" || check.status === "skipped");
	return { ok, skill: "vpk-html", node: d.nodeVersion, checks };
}

export function formatDoctorReport(report) {
	const word = check => (check.status === "missing" && !check.required ? "OPTIONAL-MISSING" : check.status.toUpperCase());
	const lines = report.checks.map(check => {
		const version = check.version ? ` ${check.version}` : "";
		const detail = check.detail ? ` (${check.detail})` : "";
		const fix = check.fix && check.status !== "ok" ? `\n${" ".repeat(18)}fix: ${check.fix}` : "";
		return `${word(check).padEnd(17)} ${check.id}${version}: ${check.purpose}${detail}${fix}`;
	});
	lines.push(report.ok ? "OK: core render and verification ready" : "ERROR: core capability missing: --verify, --pdf and gates will fail");
	return lines.join("\n");
}

// Returns an exit code (awaited by build.mjs): 0 ready, 1 a required capability is missing.
export async function runDoctor(args = {}, deps = {}) {
	const { log = console.log, ...rest } = deps;
	const report = await collectDoctorReport(args, rest);
	log(args.json ? JSON.stringify(report, null, 2) : formatDoctorReport(report));
	return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	const argv = process.argv.slice(2);
	process.exitCode = await runDoctor({ json: argv.includes("--json"), online: argv.includes("--online"), launch: !argv.includes("--no-launch") });
}
