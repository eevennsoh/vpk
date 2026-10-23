/*
 * publish: plan-then-confirm publishing to Atlassian Artifacts or a gist, and the shared
 * preflight that --github also runs (ws6 §5.5, integration K24).
 *
 *   node scripts/build.mjs --publish <artifacts|gist> <file> [--confirm] [--access private|open|shared]
 *     [--name <t>] [--description <t>] [--new] [--public|--private] [--include-review] [--allow-local-paths]
 *
 * Without --confirm nothing is published: the preflight, the viewer check (Artifacts) and
 * the plan are printed. Every side effect goes through `deps` (C15), so tests never launch
 * Chromium, touch the network or write ~/.config/vpk. build.mjs passes its own
 * checkPlaceholders, verify and validateHtmlFile; an absent one is skipped.
 */

import { execFile as execFileCallback, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { extractJsonScript, parseJsonIsland } from "./json-island.mjs";
import { resolveRepoRoot } from "./repo-root.mjs";
import { screenshotDirFor } from "./screenshot.mjs";
import { scanSecrets } from "./secret-scan.mjs";

export const PUBLISH_TARGETS = Object.freeze(["artifacts", "gist"]);
export const ACCESS_LEVELS = Object.freeze(["private", "open", "shared"]);
export const DRY_RUN_LINE = "Dry run — nothing was published. Re-run with --confirm after the user agrees.";
export const VIEWER_LINE = "In Atlassian Artifacts, storage, downloads and popups may be blocked; reviewers can copy, not download. Send the file itself for full review.";
export const GIST_NOTE = "GitHub shows gist HTML as source: recipients open Raw, save the file, and open it in a browser. Anyone with a secret gist's link can read it.";
const SIZE_NOTE = "Artifacts and Pages load it normally; data: URL previews render it blank";
const LOCAL_PATH_PATTERNS = [/(?<![\w.-])\/Users\/[\w.-]+\//g, /(?<![\w.-])\/home\/[\w.-]+\//g, /\b[A-Za-z]:\\Users\\/g, /file:\/\/\//g];
const LOCAL_URL_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|[a-z0-9-]+\.localhost)(?::\d+)?/gi;

const blank = match => " ".repeat(match.length);
const relPath = file => path.relative(process.cwd(), file).split(path.sep).join("/") || file;
const kilobytes = text => Math.round(Buffer.byteLength(text) / 1024);
const quote = value => (/^[\w./:@=-]+$/.test(value) ? value : JSON.stringify(value));

export function defaultPublishDeps() {
	return {
		checkContent: async (...args) => (await import("./content-ir.mjs")).checkContent(...args),
		weightWarnings: async (html, options) => (await import("./media/size-budget.mjs")).weightWarnings(html, options),
		spawnNode: (script, args, { stream = false } = {}) => new Promise(resolve => {
			// Real path: the repo scripts guard main() with import.meta.url, which a symlinked argv[1] would not match.
			let target = script;
			try { target = fs.realpathSync(script); } catch { /* spawn reports the missing file */ }
			const child = spawn(process.execPath, [target, ...args], { stdio: stream ? "inherit" : ["ignore", "pipe", "pipe"] });
			let stdout = "";
			let stderr = "";
			child.stdout?.on("data", chunk => { stdout += chunk; });
			child.stderr?.on("data", chunk => { stderr += chunk; });
			child.on("error", error => resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` }));
			child.on("close", code => resolve({ code: code ?? 1, stdout, stderr }));
		}),
		execFile: (command, args, options = {}) => new Promise(resolve => {
			execFileCallback(command, args, { maxBuffer: 16 * 1024 * 1024, ...options }, (error, stdout, stderr) => resolve({
				code: error ? (Number.isInteger(error.code) ? error.code : 1) : 0,
				stdout: String(stdout ?? ""),
				stderr: String(stderr ?? "") || (error ? error.message : ""),
			}));
		}),
		importModule: file => import(pathToFileURL(file).href),
		fs: { existsSync: fs.existsSync, readFileSync: fs.readFileSync, writeFileSync: fs.writeFileSync, mkdirSync: fs.mkdirSync },
		env: process.env,
		now: () => new Date(),
		repoRoot: resolveRepoRoot(),
		log: console.log,
		error: console.error,
	};
}

function decodeText(value) {
	const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", mdash: "—", ndash: "–", middot: "·", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
	return value
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
		.replace(/&([a-z]+);/gi, (whole, name) => named[name] ?? whole)
		.replace(/\s+/g, " ")
		.trim();
}

export function readDocumentMeta(html) {
	const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
	const tag = (html.match(/<meta\b[^>]*>/gi) ?? []).find(candidate => /\bname\s*=\s*["']description["']/i.test(candidate));
	const description = tag ? /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag) : null;
	return {
		title: title ? decodeText(title) || null : null,
		description: description ? decodeText(description[1] ?? description[2]) || null : null,
	};
}

// P1–P6 on the HTML with data: URIs blanked (length-preserving, so offsets stay true).
export function prepublishScan(html, { includeReview = false, allowLocalPaths = false, label = "document", weightWarnings = null } = {}) {
	const findings = [];
	const add = (id, rule, severity, message) => findings.push({ id, rule, severity, message });
	const stripped = String(html).replace(/\bdata:[^"')\s]+/g, blank);
	for (const secret of scanSecrets(stripped, { stripDataUris: false })) add("P1", "secret", "error", `${secret.label} at offset ${secret.index} (${secret.preview})`);
	const withoutUrls = stripped.replace(/\b(?!file:)[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)]*/gi, blank);
	const localPaths = LOCAL_PATH_PATTERNS.flatMap(pattern => [...withoutUrls.matchAll(pattern)]).sort((a, b) => a.index - b.index);
	if (localPaths.length > 0) {
		const [first] = localPaths;
		add("P2", "local-path", allowLocalPaths ? "warning" : "error", `local path "${first[0]}" at offset ${first.index}${localPaths.length > 1 ? ` (${localPaths.length} occurrences)` : ""}${allowLocalPaths ? "" : "; remove it or pass --allow-local-paths"}`);
	}
	const localUrls = [...stripped.matchAll(LOCAL_URL_PATTERN)];
	if (localUrls.length > 0) add("P3", "local-url", "warning", `local URL ${localUrls[0][0]} at offset ${localUrls[0].index}${localUrls.length > 1 ? ` (${localUrls.length} occurrences)` : ""}; it will not resolve for readers`);
	const reviewRaw = extractJsonScript(String(html), "data-vpk-review");
	if (reviewRaw !== null) {
		let comments = null;
		try { comments = parseJsonIsland(reviewRaw)?.comments; } catch { add("P4", "review-data", includeReview ? "warning" : "error", "the data-vpk-review island is not valid JSON"); }
		if (Array.isArray(comments) && comments.length > 0) {
			add("P4", "review-data", includeReview ? "warning" : "error", includeReview
				? `publishing ${comments.length} embedded review comment${comments.length === 1 ? "" : "s"} (--include-review)`
				: `${comments.length} embedded review comment${comments.length === 1 ? "" : "s"} would be published; strip them (--strip-review) or pass --include-review`);
		}
	}
	const gaps = String(html).split("[DATA NEEDED:").length - 1;
	if (gaps > 0) add("P5", "data-needed", "warning", `${gaps} [DATA NEEDED: …] marker${gaps === 1 ? "" : "s"} remain`);
	for (const message of typeof weightWarnings === "function" ? weightWarnings(String(html), { label }) ?? [] : []) add("P6", "size", "warning", `${message}. ${SIZE_NOTE}`);
	return findings;
}

// --publish runs steps 1–4; --github has already run step 1 (target "github").
export async function runPreflight(file, { target = null, includeReview = false, allowLocalPaths = false } = {}, deps = {}) {
	const d = { ...defaultPublishDeps(), ...deps };
	const abs = path.resolve(file);
	const label = relPath(abs);
	const findings = [];
	const skipped = [];
	const add = (id, rule, severity, message) => findings.push({ id, rule, severity, message });
	const attempt = async (rule, run) => {
		try { await run(); } catch (problem) { add("check", rule, "error", problem?.message ?? String(problem)); }
	};
	if (target !== "github") {
		const standard = [
			["placeholders", d.checkPlaceholders, result => `${result?.count ?? "some"} unfilled placeholders`],
			["verify", d.verify, result => (result?.issues ?? []).join("; ") || "render check failed"],
			["check-html", d.validateHtmlFile, result => (result?.failures ?? []).join("; ") || "check-html failed"],
		];
		for (const [rule, check, describe] of standard) {
			if (typeof check !== "function") { skipped.push(rule); continue; }
			await attempt(rule, async () => {
				const result = await check(abs);
				if (!result?.ok) add("check", rule, "error", describe(result));
			});
		}
	}
	await attempt("content", async () => {
		const result = await d.checkContent({ htmlPath: abs });
		for (const item of result?.findings ?? []) {
			if (item.severity !== "info") add("check", "content", item.severity === "error" ? "error" : "warning", `${item.rule} ${item.path}: ${item.message}`);
		}
	});
	const html = String(d.fs.readFileSync(abs, "utf8"));
	let sizeMessages = [];
	try { sizeMessages = (await d.weightWarnings(html, { label })) ?? []; }
	catch (problem) { add("P6", "size", "warning", `size budget unavailable (${problem?.code ?? problem?.message ?? problem})`); }
	findings.push(...prepublishScan(html, { includeReview, allowLocalPaths, label, weightWarnings: () => sizeMessages }));
	return { ok: findings.every(item => item.severity !== "error"), findings, skipped };
}

export function formatPreflight(result) {
	const lines = result.findings.map(item => `${item.severity === "error" ? "✗" : "⚠"} ${item.id === "check" ? "" : `${item.id} `}${item.rule}: ${item.message}`);
	const errors = result.findings.filter(item => item.severity === "error").length;
	const warnings = result.findings.length - errors;
	const skipped = result.skipped?.length ? ` (skipped: ${result.skipped.join(", ")})` : "";
	lines.push(errors > 0
		? `✗ publish preflight: ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}${skipped}`
		: `✓ publish preflight passed${warnings ? ` with ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}${skipped}`);
	return lines.join("\n");
}

export function gistRegistryPath(env = process.env, home = os.homedir()) {
	return env.VPK_GIST_REGISTRY ?? path.join(home, ".config", "vpk", "gists.json");
}

export function planGistPublish({ entry = null, file, title, isPublic = false, forceNew = false }) {
	if (entry && !forceNew) {
		return { mode: "update", entry, public: Boolean(entry.public), args: ["gist", "edit", entry.id, "--filename", entry.fileName, file] };
	}
	return { mode: "create", entry: null, public: isPublic, args: ["gist", "create", file, "--desc", `vpk-html: ${title}`, ...(isPublic ? ["--public"] : [])] };
}

export function parseGistCreateOutput(stdout) {
	const url = /https?:\/\/\S+/.exec(String(stdout))?.[0];
	if (!url) return null;
	const id = new URL(url).pathname.split("/").filter(Boolean).pop();
	return id ? { url, id } : null;
}

export function planArtifactPublish({ publishModule, registry = {}, file, name, access = null, description = null, forceNew = false }) {
	const slug = publishModule.slugForFile(file);
	const plan = publishModule.planPublish({ access: access ?? undefined, description: description ?? undefined, entry: registry[slug], file, forceNew, name });
	return { ...plan, slug, accessLabel: plan.mode === "update" ? (access ?? "keeps current access") : (access ?? "private") };
}

function readJsonFile(fileSystem, file) {
	if (!fileSystem.existsSync(file)) return {};
	return JSON.parse(String(fileSystem.readFileSync(file, "utf8")));
}

async function viewerCheck(file, scripts, args, d) {
	if (!d.fs.existsSync(scripts.verify)) { d.log("⚠ scripts/verify-artifact-html.mjs not found; skipping the Artifacts viewer check"); return 0; }
	const out = path.join(screenshotDirFor(file, { repoRoot: d.repoRoot }), "artifact-viewer.png");
	const run = await d.spawnNode(scripts.verify, [file, "--out", out]);
	let report = null;
	try { report = JSON.parse(run.stdout.slice(run.stdout.indexOf("{"))); } catch { /* not JSON: the check could not run */ }
	if (!report) {
		const reason = (run.stderr || run.stdout).trim().split("\n")[0] || `exit ${run.code}`;
		const message = `Artifacts viewer check did not run (${reason}); Chromium may need an unsandboxed shell (build.mjs --doctor)`;
		if (args.confirm) { d.error(`✗ ${message}`); return 1; }
		d.log(`⚠ ${message}`);
		return 0;
	}
	for (const url of report.blockedRequests ?? []) d.log(`⚠ viewer CSP blocks ${url}`);
	const errors = [
		...(report.missingAssets ?? []).map(asset => `missing asset in the viewer: ${asset}`),
		...(report.pageErrors ?? []).map(problem => `page error in the viewer: ${problem}`),
		...(!report.rendered || report.rendered.elements === 0 ? ["the Artifacts harness rendered nothing"] : []),
	];
	for (const problem of errors) d.error(`✗ ${problem}`);
	if (errors.length > 0) return 1;
	d.log(`✓ Artifacts viewer check: rendered under sandbox="${report.sandbox ?? "allow-scripts"}" (${report.screenshot ?? out})`);
	return 0;
}

async function publishArtifact(file, html, meta, args, d) {
	const scripts = d.repoRoot ? { verify: path.join(d.repoRoot, "scripts", "verify-artifact-html.mjs"), publish: path.join(d.repoRoot, "scripts", "publish-artifact.mjs") } : null;
	const name = args.name ?? meta.title ?? path.basename(file);
	const description = args.description ?? meta.description ?? null;
	if (!scripts || !d.fs.existsSync(scripts.publish)) {
		d.log(`Equivalent command: twg --env prod artifacts file create ${quote(file)} --name ${quote(name)}${description ? ` --description ${quote(description)}` : ""} --access ${args.access ?? "private"} -o json`);
		d.error("publish-artifact.mjs not found; run the printed twg command or follow the MCP flow in references/publish.md");
		return 1;
	}
	if (await viewerCheck(file, scripts, args, d) !== 0) return 1;
	d.log(VIEWER_LINE);
	const publishModule = await d.importModule(scripts.publish);
	const registry = readJsonFile(d.fs, publishModule.registryPath(d.env));
	const plan = planArtifactPublish({ publishModule, registry, file, name, access: args.access, description, forceNew: args.forceNew });
	d.log(`Plan: ${plan.mode} Atlassian Artifact "${plan.name}" (${plan.accessLabel}) from ${relPath(file)} (${kilobytes(html)} KB)`);
	if (!args.confirm) { d.log(DRY_RUN_LINE); return 0; }
	const spawnArgs = [file, "--name", plan.name, ...(args.access ? ["--access", args.access] : []), ...(description ? ["--description", description] : []), ...(args.forceNew ? ["--new"] : [])];
	const result = await d.spawnNode(scripts.publish, spawnArgs, { stream: true });
	if (result.stdout) d.log(result.stdout.trimEnd());
	if (result.stderr) d.error(result.stderr.trimEnd());
	return result.code === 0 ? 0 : 1;
}

async function publishGist(file, html, meta, args, d) {
	const registryFile = gistRegistryPath(d.env);
	const registry = readJsonFile(d.fs, registryFile);
	const slug = path.basename(file, path.extname(file));
	const isPublic = Boolean(args.visibilityExplicit && args.visibility === "public");
	const plan = planGistPublish({ entry: registry[slug] ?? null, file, title: meta.title ?? slug, isPublic, forceNew: args.forceNew });
	d.log(plan.mode === "update"
		? `Plan: update gist ${plan.entry.id} (${plan.entry.fileName}) from ${relPath(file)} (${kilobytes(html)} KB)`
		: `Plan: create ${isPublic ? "public" : "secret"} gist "vpk-html: ${meta.title ?? slug}" from ${relPath(file)} (${kilobytes(html)} KB)`);
	if (!args.confirm) { d.log(DRY_RUN_LINE); return 0; }
	const result = await d.execFile("gh", plan.args);
	if (result.code !== 0) {
		d.error(`✗ gh ${plan.args.slice(0, 2).join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
		if (d.env.GITHUB_TOKEN) d.error("A GITHUB_TOKEN env var overrides stored gh auth; re-run under env -u GITHUB_TOKEN.");
		return 1;
	}
	const now = d.now().toISOString();
	let entry = { ...plan.entry, file, updatedAt: now };
	if (plan.mode === "create") {
		const created = parseGistCreateOutput(result.stdout);
		if (!created) { d.error(`✗ gh gist create printed no gist URL:\n${result.stdout.slice(0, 300)}`); return 1; }
		entry = { id: created.id, url: created.url, fileName: path.basename(file), file, public: isPublic, createdAt: now, updatedAt: now };
	}
	registry[slug] = entry;
	d.fs.mkdirSync(path.dirname(registryFile), { recursive: true });
	d.fs.writeFileSync(registryFile, `${JSON.stringify(registry, null, "\t")}\n`);
	d.log(`✓ ${plan.mode === "create" ? "Created" : "Updated"} gist: ${entry.url}`);
	d.log(`Recorded as "${slug}" in ${registryFile}`);
	d.log(GIST_NOTE);
	return 0;
}

// Returns an exit code: 0 plan or publish succeeded, 1 preflight or publish failure, 2 usage.
export async function runPublish(args = {}, deps = {}) {
	const d = { ...defaultPublishDeps(), ...deps };
	if (args.target === "github") { d.error("--publish github is not a target: use --github <file>, which runs the same preflight"); return 2; }
	if (!PUBLISH_TARGETS.includes(args.target)) { d.error(`--publish needs a target: ${PUBLISH_TARGETS.join(" or ")} (got ${args.target ?? "nothing"})`); return 2; }
	if (!args.file || !d.fs.existsSync(path.resolve(args.file))) { d.error(`--publish ${args.target} needs an existing file (got ${args.file ?? "nothing"})`); return 2; }
	if (args.access && !ACCESS_LEVELS.includes(args.access)) { d.error(`--access must be one of ${ACCESS_LEVELS.join(", ")}`); return 2; }
	const file = path.resolve(args.file);
	const preflight = await runPreflight(file, { target: args.target, includeReview: args.includeReview, allowLocalPaths: args.allowLocalPaths }, d);
	d.log(formatPreflight(preflight));
	if (!preflight.ok) return 1;
	const html = String(d.fs.readFileSync(file, "utf8"));
	const meta = readDocumentMeta(html);
	return args.target === "artifacts" ? publishArtifact(file, html, meta, args, d) : publishGist(file, html, meta, args, d);
}
