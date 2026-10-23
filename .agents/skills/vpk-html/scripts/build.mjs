#!/usr/bin/env node
/*
 * vpk-html build/validate — Node port of kami's build.py, scoped to the
 * HTML-first output we ship. PDF is supported as an OPTIONAL, derived export
 * via headless Chromium (--pdf, see scripts/pdf.mjs) — never WeasyPrint/Python,
 * and it never changes the single-file HTML contract.
 *
 * Usage:
 *   node scripts/build.mjs                          # run all checks on all templates
 *   node scripts/build.mjs --check-placeholders <file>
 *   node scripts/build.mjs --sync                  # check CSS token drift
 *   node scripts/build.mjs --check-templates       # CSS / token / font sanity across templates
 *   node scripts/build.mjs --check-evals           # eval corpus + catalog documentation health
 *   node scripts/build.mjs --verify <file>         # Playwright render + load check
 *   node scripts/build.mjs --pdf <file> [--out <f.pdf>]  # optional derived PDF export
 *   node scripts/build.mjs --github <file> [--repo owner/name] [--private] [--include-review] [--allow-local-paths]  # publish to GitHub Pages (runs the publish preflight)
 *   node scripts/build.mjs --doctor [--json] [--online] [--no-launch]   # environment + capability check
 *   node scripts/build.mjs --check-content <file.html|content.json> [<file.html>] [--json]   # contract + content IR + coverage
 *   node scripts/build.mjs --playbook [<template>] [--json]   # list or print template playbooks
 *   node scripts/build.mjs --screenshot <file> [--out <dir>] [--theme light|dark|both] [--viewport WxH]   # review captures
 *   node scripts/build.mjs --publish <artifacts|gist> <file> [--confirm] [--access private|open|shared] [--name <t>] [--description <t>] [--new] [--public|--private] [--include-review] [--allow-local-paths]
 *   node scripts/build.mjs --write-styles          # regenerate styles.css from tokens.json
 *   node scripts/build.mjs --refresh-library [--check]  # refresh every committed skill HTML through the runtime pipeline (--check: drift guard)
 *   node scripts/build.mjs --inject-runtime <file...>  # apply the runtime pipeline (fonts, theme, nav, runtime modules, enhancements) to artifacts
 *   node scripts/build.mjs --build-hero <file> [--audit] [--check] [--json]   # rebuild anatomy hero regions from _figures/<id>.hero.mjs (anatomy/build-hero.mjs)
 *   node scripts/build.mjs --check-figures <file> [--strict] [--json]   # figure-engine record, anatomy structure and advisories (figures/check-figures.mjs)
 *   node scripts/build.mjs --check-iso <file> [--strict] [--json]   # iso-kit figure audit A1–A12, A15–A17 (iso/audit.mjs); advisory unless --strict
 *   node scripts/build.mjs --inject-review <file.html>... [--seed <s>] [--ledger <path>|--no-ledger] [--new-doc-id]   # make reviewable (review/cli.mjs)
 *   node scripts/build.mjs --review <review.json|reviewed.html>... <artifact.html> [--format md|json] [--include-resolved] [--out <f>] [--force-doc] [--browser]
 *   node scripts/build.mjs --stamp <artifact.html> [--from <prev.html|ledger.json>] [--revision-label <t>] [--summary <t>] [--addresses <ids|files>...] [--no-revision]
 *   node scripts/build.mjs --embed-review <review.json|reviewed.html>... <artifact.html>   |   --strip-review <file.html> [--out <f>] [--all]
 *   node scripts/lab/kit.mjs --inject|--check <file.html…>   # vpk-lab kit block (film, cue sheet, Gantt, labs); refreshed by the runtime pipeline step "lab"
 *   node scripts/lab/render-case-study.mjs <content.json> --into <file.html> [--check]   # motion-case-study regions + data-vpk-content island from the content IR
 *   node scripts/media/{capture,encode,embed}.mjs …   # captured film: capture → encode → embed (references/media-pipeline.md)
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectColorTokenIssues, collectPresentationIssues, collectSelfReferentialCustomPropertyIssues, collectSmilMotionIssues, collectSvgGrammarIssues, collectTemplateReviewIssues, validateHtmlFile } from "./check-html.mjs";
import { collectFontFaceIssues, verifyRegisteredFonts } from "./font-faces.mjs";
import { formatHtmlWeight, measureHtmlWeight, weightWarnings } from "./media/size-budget.mjs";
import { listSmilElements, verifySmilMotion } from "./runtime/smil-starter.mjs";
import { checkStyleConsumers, checkStyleSource, collectFaviconIssues, writeStylesCssFromTokens } from "./shared.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, "..");
const TEMPLATES_DIR = path.join(SKILL_ROOT, "assets", "templates");

const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}/g;

// vpk identity check — required tokens that should appear in templates.
const REQUIRED_FONT_FACES = ["Geist", "Geist Mono", "Geist Mono Numeric"];
const FORBIDDEN_KAMI_LEAKAGE = [
	{ pattern: /Charlie (?:Display|Text)/, label: "legacy Charlie font family" },
	{ pattern: /Atlassian Mono/, label: "legacy Atlassian Mono font family" },
	{ pattern: /Geist Pixel|--font-pixel/, label: "legacy Geist Pixel garnish" },
	{ pattern: /#0c66e4/i, label: "legacy ADS blue #0c66e4" },
	{ pattern: /#579dff/i, label: "legacy ADS blue #579dff" },
	{ pattern: /#0055cc/i, label: "legacy ADS blue #0055cc" },
	{ pattern: /#e9f2ff/i, label: "legacy ADS blue tint #e9f2ff" },
	{ pattern: /#2f6f4f/i, label: "legacy v1 green accent #2f6f4f" },
	{ pattern: /#5a9e7c/i, label: "legacy v1 green accent #5a9e7c" },
	{ pattern: /rgba\(\s*47\s*,\s*111\s*,\s*79\s*,\s*(?:0?\.\d+|1(?:\.0+)?)\s*\)/i, label: "legacy v1 green accent wash" },
	{ pattern: /rgba\(\s*90\s*,\s*158\s*,\s*124\s*,\s*(?:0?\.\d+|1(?:\.0+)?)\s*\)/i, label: "legacy v1 dark green accent wash" },
	{ pattern: /--primary-blue\b/, label: "legacy primary-blue token alias" },
	{ pattern: /var\(--ds-(?!brand-override\b)/, label: "legacy ADS token wrapper" },
	{ pattern: /font-family:\s*Charter\b/, label: "kami Charter serif (should be Geist)" },
	{ pattern: /TsangerJinKai02/, label: "kami CJK font TsangerJinKai02" },
	{ pattern: /cdn\.jsdelivr\.net|cdnjs|fonts\.googleapis|fonts\.gstatic/i, label: "remote font/asset URL (violates offline rule)" },
	{ pattern: /<meta\s+name="generator"\s+content="Kami"/i, label: "kami generator tag (should be vpk-html)" },
];

// ws1 review commands (whole-token match): everything from the command on goes to review/cli.mjs.
const REVIEW_COMMANDS = new Set(["--inject-review", "--review", "--stamp", "--embed-review", "--strip-review"]);

function parseArgs(argv) {
	const args = {
		mode: "default", file: null, files: [], out: null, gate: null, strict: false, check: false, origin: null, repo: null, visibility: "public",
		json: false, online: false, launch: true, html: null, target: null, confirm: false, access: null, name: null, description: null, forceNew: false,
		includeReview: false, allowLocalPaths: false, theme: "both", viewport: null, playbook: null, visibilityExplicit: false, audit: false,
	};
	const GATE_FLAGS = {
		"--check-density": "density",
		"--check-resume-balance": "resume-balance",
		"--check-rhythm": "rhythm",
		"--check-orphans": "orphans",
		"--check-focal": "focal",
		"--check-motion-budget": "motion-budget",
		"--check-caption-echo": "caption-echo",
		"--check-layout": "layout",
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (REVIEW_COMMANDS.has(arg)) { args.mode = "review"; args.reviewArgv = argv.slice(i); break; }
		else if (arg === "--check-placeholders") { args.mode = "placeholders"; args.file = argv[++i]; }
		else if (arg === "--sync" || arg === "--check-theme") { args.mode = "sync"; }
		else if (arg === "--write-styles" || arg === "--write-theme") { args.mode = "write-styles"; }
		else if (arg === "--check-templates") { args.mode = "templates"; }
		else if (arg === "--check-evals") { args.mode = "evals"; }
		else if (arg === "--verify") { args.mode = "verify"; args.file = argv[++i]; }
		else if (arg === "--pdf") { args.mode = "pdf"; args.file = argv[++i]; }
		else if (arg === "--landing") { args.mode = "landing"; args.file = argv[++i]; }
		else if (arg === "--github") { args.mode = "github"; args.file = argv[++i]; }
		else if (arg === "--inject-runtime") { args.mode = "inject-runtime"; args.files = argv.slice(i + 1); break; }
		else if (arg === "--refresh-library") { args.mode = "refresh-library"; }
		else if (arg === "--check") { args.check = true; }
		else if (arg in GATE_FLAGS) { args.mode = "gate"; args.gate = GATE_FLAGS[arg]; args.file = argv[++i]; }
		else if (arg === "--doctor") { args.mode = "doctor"; }
		else if (arg === "--check-content") { args.mode = "content"; args.file = argv[++i]; if (argv[i + 1] && !argv[i + 1].startsWith("--")) args.html = argv[++i]; }
		else if (arg === "--playbook") { args.mode = "playbook"; if (argv[i + 1] && !argv[i + 1].startsWith("--")) args.playbook = argv[++i]; }
		else if (arg === "--publish") { args.mode = "publish"; args.target = argv[++i]; args.file = argv[++i]; }
		else if (arg === "--screenshot") { args.mode = "screenshot"; args.file = argv[++i]; }
		else if (arg === "--build-hero") { args.mode = "build-hero"; args.file = argv[++i]; }
		else if (arg === "--check-figures") { args.mode = "check-figures"; args.file = argv[++i]; }
		else if (arg === "--check-iso") { args.mode = "check-iso"; args.file = argv[++i]; }
		else if (arg === "--audit") { args.audit = true; }
		else if (arg === "--json") { args.json = true; }
		else if (arg === "--online") { args.online = true; }
		else if (arg === "--no-launch") { args.launch = false; }
		else if (arg === "--confirm") { args.confirm = true; }
		else if (arg === "--access") { args.access = argv[++i]; }
		else if (arg === "--name") { args.name = argv[++i]; }
		else if (arg === "--description") { args.description = argv[++i]; }
		else if (arg === "--new") { args.forceNew = true; }
		else if (arg === "--include-review") { args.includeReview = true; }
		else if (arg === "--allow-local-paths") { args.allowLocalPaths = true; }
		else if (arg === "--theme") { args.theme = argv[++i]; }
		else if (arg === "--viewport") { args.viewport = argv[++i]; }
		else if (arg === "--out") { args.out = argv[++i]; }
		else if (arg === "--origin") { args.origin = argv[++i]; }
		else if (arg === "--repo") { args.repo = argv[++i]; }
		else if (arg === "--public") { args.visibility = "public"; args.visibilityExplicit = true; }
		else if (arg === "--private") { args.visibility = "private"; args.visibilityExplicit = true; }
		else if (arg === "--strict") { args.strict = true; }
		else if (arg === "--help" || arg === "-h") { args.mode = "help"; }
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function listTemplates() {
	if (!fs.existsSync(TEMPLATES_DIR)) return [];
	return fs.readdirSync(TEMPLATES_DIR)
		.filter(name => name.endsWith(".html"))
		.map(name => path.join(TEMPLATES_DIR, name));
}

/* ============ --check-placeholders ============ */

function checkPlaceholders(filePath) {
	if (!filePath) throw new Error("--check-placeholders requires a file path");
	const abs = path.resolve(filePath);
	if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);

	const content = fs.readFileSync(abs, "utf8");
	const matches = [...content.matchAll(PLACEHOLDER_PATTERN)];
	if (matches.length === 0) {
		console.log(`✓ ${path.relative(process.cwd(), abs)} — no unfilled placeholders`);
		return { ok: true, count: 0 };
	}

	console.log(`✗ ${path.relative(process.cwd(), abs)} — ${matches.length} unfilled placeholder${matches.length === 1 ? "" : "s"}:`);
	const samples = matches.slice(0, 10);
	for (const m of samples) {
		const lineNumber = content.slice(0, m.index).split("\n").length;
		const preview = m[0].length > 80 ? `${m[0].slice(0, 77)}…` : m[0];
		console.log(`  line ${lineNumber}: ${preview}`);
	}
	if (matches.length > samples.length) {
		console.log(`  …and ${matches.length - samples.length} more`);
	}
	return { ok: false, count: matches.length };
}

/* ============ --inject-runtime ============ */

// The runtime pipeline (scripts/runtime/pipeline.mjs) picks the steps by each file's kind.
async function injectRuntime(filePaths) {
	const { injectRuntimeFiles } = await import("./runtime/pipeline.mjs");
	return injectRuntimeFiles(filePaths);
}

/* ============ --check-templates ============ */

function syncCheck() {
	const issues = [
		...checkStyleSource(),
		...checkStyleConsumers(),
	];
	if (issues.length === 0) {
		console.log("OK: styles.css in sync with references/tokens.json and generated HTML");
		return { ok: true, failures: 0 };
	}

	console.log("✗ shared CSS drift");
	for (const issue of issues) console.log(`  ${issue}`);
	return { ok: false, failures: issues.length };
}

function checkTemplate(filePath) {
	const content = fs.readFileSync(filePath, "utf8");
	const failures = [];

	for (const family of REQUIRED_FONT_FACES) {
		if (!content.includes(`font-family: "${family}"`)) {
			failures.push(`missing @font-face declaration for "${family}"`);
		}
	}
	failures.push(...collectFontFaceIssues(content));

	for (const { pattern, label } of FORBIDDEN_KAMI_LEAKAGE) {
		if (pattern.test(content)) failures.push(`kami leakage: ${label}`);
	}

	failures.push(...collectColorTokenIssues(content, filePath));
	failures.push(...collectSelfReferentialCustomPropertyIssues(content));
	failures.push(...collectPresentationIssues(content));
	failures.push(...collectSmilMotionIssues(content));
	failures.push(...collectSvgGrammarIssues(content));
	failures.push(...collectTemplateReviewIssues(content));

	if (!/--ease-out:\s*cubic-bezier\(0\.16,1,0\.3,1\)/.test(content)) {
		failures.push("missing vpk motion easing token --ease-out");
	}
	if (!/--vpk-dur-enter:\s*140ms/.test(content)) {
		failures.push("missing vpk motion duration token --vpk-dur-enter");
	}
	if (!/@media\s+print\s*\{[\s\S]*?(?:animation|transition|transform):\s*none\s*!important/i.test(content)) {
		failures.push("missing print motion neutralizer");
	}
	if (!/@media\s+\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?--vpk-enter-y:\s*0px/i.test(content)) {
		failures.push("missing reduced-motion movement override");
	}
	if (/(^|[^-])ease-in(?!-)/i.test(content)) {
		failures.push("contains bare ease-in timing; use --ease-out or --ease-in-out");
	}
	if (!/<body\b[^>]*\bdata-vpk-motion=/i.test(content)) {
		failures.push("missing data-vpk-motion body attribute");
	}

	if (!/<meta\s+name="generator"\s+content="vpk-html"/i.test(content)) {
		failures.push("missing or wrong <meta name=\"generator\"> (should be \"vpk-html\")");
	}

	failures.push(...collectFaviconIssues(content));

	if (!/<main\b/i.test(content)) {
		failures.push("missing <main> landmark");
	}

	return failures;
}

function checkTemplates() {
	const syncResult = syncCheck();
	const files = listTemplates();
	if (files.length === 0) {
		console.log(`No templates found in ${path.relative(process.cwd(), TEMPLATES_DIR)}`);
		return { ok: syncResult.ok, total: 0, failures: syncResult.failures };
	}
	let failures = 0;
	for (const file of files) {
		const issues = checkTemplate(file);
		const rel = path.relative(process.cwd(), file);
		if (issues.length === 0) {
			console.log(`✓ ${rel}`);
		} else {
			failures += 1;
			console.log(`✗ ${rel}`);
			for (const issue of issues) console.log(`  ${issue}`);
		}
	}
	console.log(`${files.length - failures}/${files.length} templates clean`);
	return { ok: syncResult.ok && failures === 0, total: files.length, failures: failures + syncResult.failures };
}

/* ============ --verify ============ */

async function verify(filePath) {
	if (!filePath) throw new Error("--verify requires a file path");
	const abs = path.resolve(filePath);
	if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);

	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
	const page = await ctx.newPage();
	const consoleErrors = [];
	page.on("pageerror", error => consoleErrors.push(`pageerror: ${error.message}`));
	page.on("console", message => {
		if (message.type() === "error") consoleErrors.push(`console.error: ${message.text()}`);
	});
	const failedRequests = [];
	page.on("requestfailed", request => failedRequests.push(`${request.url()} (${request.failure()?.errorText})`));

	try {
		await page.goto(pathToFileURL(abs).href, { waitUntil: "domcontentloaded", timeout: 15_000 });
		try { await page.waitForLoadState("networkidle", { timeout: 4_000 }); } catch { /* fine */ }
		await page.waitForTimeout(400);
		// document.fonts.check() is true when no face matches, so require a registered face per family.
		const fontsReady = await verifyRegisteredFonts(page);

		const issues = [];
		for (const { family, loaded, error } of fontsReady) {
			if (!loaded) issues.push(`font "${family}" did not load${error ? ` (${error})` : ""}`);
		}

		const rel = path.relative(process.cwd(), abs);
		const html = fs.readFileSync(abs, "utf8");
		const warnings = weightWarnings(html, { label: rel });
		if (listSmilElements(html).length > 0) {
			const smil = await verifySmilMotion({ browser, url: pathToFileURL(abs).href, html });
			issues.push(...smil.issues);
			warnings.push(...smil.warnings);
		}
		issues.push(...consoleErrors);
		issues.push(...failedRequests.map(req => `failed request: ${req}`));

		if (issues.length === 0) {
			console.log(`✓ ${rel} — renders clean, fonts loaded, no console errors`);
		} else {
			console.log(`✗ ${rel}`);
			for (const issue of issues) console.log(`  ${issue}`);
		}
		console.log(`  page weight ${formatHtmlWeight(measureHtmlWeight(html))}`);
		for (const warning of warnings) console.log(`  ⚠ ${warning}`);
		return { ok: issues.length === 0, issues, warnings };
	} finally {
		await ctx.close();
		await browser.close();
	}
}

/* ============ main ============ */

function help() {
	console.log(`vpk-html build & verify

Usage:
  node scripts/build.mjs                          # check all templates
  node scripts/build.mjs --check-placeholders <file>
  node scripts/build.mjs --sync                    # check CSS token drift
  node scripts/build.mjs --check-templates
  node scripts/build.mjs --check-evals
  node scripts/build.mjs --verify <file>
  node scripts/build.mjs --pdf <file> [--out <file.pdf>]   # optional derived PDF export
  node scripts/build.mjs --landing <file> [--out <dir>] [--origin <url>]   # emit companions + responsive verify
  node scripts/build.mjs --github <file> [--repo owner/name] [--public|--private] [--include-review] [--allow-local-paths]   # publish index.html to GitHub Pages (runs the publish preflight)
  node scripts/build.mjs --doctor [--json] [--online] [--no-launch]   # environment + capability check
  node scripts/build.mjs --check-content <file.html|content.json> [<file.html>] [--json]   # contract + content IR + coverage
  node scripts/build.mjs --playbook [<template>] [--json]   # list or print template playbooks
  node scripts/build.mjs --screenshot <file> [--out <dir>] [--theme light|dark|both] [--viewport WxH]   # review captures, light + dark + mobile
  node scripts/build.mjs --publish <artifacts|gist> <file> [--confirm] [--access private|open|shared] [--name <t>] [--description <t>] [--new] [--public|--private] [--include-review] [--allow-local-paths]   # plan, then --confirm
  node scripts/build.mjs --refresh-library [--check]   # refresh committed skill HTML through the runtime pipeline; --check fails on drift
  node scripts/build.mjs --inject-runtime <file...>   # apply the runtime pipeline (fonts, theme, nav, runtime modules, enhancements) to artifacts
  node scripts/build.mjs --build-hero <file> [--audit] [--check] [--json]   # rebuild anatomy hero regions from their _figures/<id>.hero.mjs; --check fails when stale
  node scripts/build.mjs --check-figures <file> [--strict] [--json]   # figure-engine record (E1–E3), anatomy structure (H1–H8) and advisories (A1–A6)
  node scripts/build.mjs --check-iso <file> [--strict] [--json]   # iso-kit figure audit (A1–A12, A15–A17); advisory, --strict exits 1 on errors
  node scripts/build.mjs --inject-review <file.html>... [--seed <s>] [--ledger <path>|--no-ledger] [--new-doc-id]   # make reviewable: doc id, block ids, ledger, review runtime
  node scripts/build.mjs --review <review.json|reviewed.html>... <artifact.html> [--format md|json] [--include-resolved] [--out <f>] [--force-doc] [--browser]   # numbered task list (--browser: statuses from Chromium)
  node scripts/build.mjs --stamp <artifact.html> [--from <prev.html|ledger.json>] [--revision-label <t>] [--summary <t>] [--addresses <ids|files>...] [--no-revision]   # carry ids, record a revision
  node scripts/build.mjs --embed-review <review.json|reviewed.html>... <artifact.html>   # carry merged comments into the file
  node scripts/build.mjs --strip-review <file.html> [--out <clean.html>] [--all]   # remove the runtime and embedded comments (--all: every review mark)
  node scripts/lab/kit.mjs --inject|--check <file.html...>   # add/refresh or check the vpk-lab kit block (references/lab-kit.md)
  node scripts/lab/render-case-study.mjs <content.json> --into <file.html> [--check]   # render motion-case-study regions and island from the content IR
  node scripts/media/capture.mjs <spec.mjs> | --url <url> --end <s> [--fps 30] [--virtual] [--cursor]   # held, virtual-clock or CDP screencast frames → frames.ffconcat + capture.json
  node scripts/media/encode.mjs <capture-dir|frames.ffconcat|film.mp4> [--preset film|lite|hq] [--target-bytes N]   # H.264 film, no audio, + encode.json; hq is a derived 1920-wide MP4, never embedded
  node scripts/media/embed.mjs <file.html> --film <film.mp4> [--manifest capture.json] [--lite auto|always|never]   # embed the film; over budget also writes <slug>.lite.html
  node scripts/build.mjs --check-density|--check-resume-balance|--check-rhythm|--check-orphans|--check-focal|--check-motion-budget|--check-caption-echo|--check-layout <file> [--strict]
  node scripts/build.mjs --write-styles
  node scripts/build.mjs --help`);
}

async function main() {
	let args;
	try { args = parseArgs(process.argv.slice(2)); }
	catch (error) { console.error(error.message); process.exitCode = 1; return; }

	if (args.mode === "help") return help();
	if (args.mode === "review") {
		const { runReviewCli } = await import("./review/cli.mjs");
		process.exitCode = await runReviewCli(args.reviewArgv);
		return;
	}
	if (args.mode === "placeholders") {
		const result = checkPlaceholders(args.file);
		if (!result.ok) process.exitCode = 1;
		return;
	}
	if (args.mode === "inject-runtime") {
		await injectRuntime(args.files);
		return;
	}
	if (args.mode === "refresh-library") {
		const { refreshLibrary, formatRefreshReport } = await import("./runtime/pipeline.mjs");
		const result = await refreshLibrary({ write: !args.check });
		console.log(formatRefreshReport(result, { check: args.check }));
		if (args.check && result.changed.length) process.exitCode = 1;
		return;
	}
	if (args.mode === "sync") {
		const result = syncCheck();
		if (!result.ok) process.exitCode = 1;
		return;
	}
	if (args.mode === "write-styles") {
		writeStylesCssFromTokens();
		console.log("✓ regenerated styles.css from references/tokens.json");
		return;
	}
	if (args.mode === "templates") {
		const result = checkTemplates();
		if (!result.ok) process.exitCode = 1;
		return;
	}
	if (args.mode === "evals") {
		const { checkEvaluationSystem } = await import("./evals.mjs");
		const result = checkEvaluationSystem();
		if (!result.ok) {
			console.log(`✗ vpk-html evaluation system: ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"}`);
			for (const issue of result.issues) console.log(`  ${issue}`);
			process.exitCode = 1;
			return;
		}
		const { demos, diagrams, templates } = result.catalogCounts;
		console.log(`✓ vpk-html evaluation system: ${result.evalCount} scenarios; ${templates} templates, ${diagrams} diagrams, ${demos} demos; ${result.playbookCount} playbooks`);
		return;
	}
	if (args.mode === "verify") {
		const result = await verify(args.file);
		if (!result.ok) process.exitCode = 1;
		return;
	}
	if (args.mode === "pdf") {
		if (!args.file) { console.error("--pdf requires a file path"); process.exitCode = 1; return; }
		const { exportPdf } = await import("./pdf.mjs");
		const result = await exportPdf(args.file, args.out);
		if (result.ok) {
			console.log(`✓ ${path.relative(process.cwd(), result.out)} — ${(result.bytes / 1024).toFixed(0)} KB`);
		} else {
			console.error(`✗ PDF export produced an empty file: ${result.out}`);
			process.exitCode = 1;
		}
		return;
	}
	if (args.mode === "landing") {
		if (!args.file) { console.error("--landing requires a file path"); process.exitCode = 1; return; }
		const { processLanding } = await import("./landing.mjs");
		const { companions, outDir, verify } = await processLanding(args.file, { out: args.out, origin: args.origin });
		console.log(`✓ emitted ${companions.length} companion files → ${path.relative(process.cwd(), outDir)} (${companions.join(", ")})`);
		if (verify.ok) {
			console.log("✓ responsive verify clean (1280/880/480: no overflow, fonts load, no console errors)");
		} else {
			console.log("✗ responsive verify");
			for (const issue of verify.issues) console.log(`  ${issue}`);
			process.exitCode = 1;
		}
		return;
	}
	if (args.mode === "github") {
		if (!args.file) { console.error("--github requires a file path"); process.exitCode = 1; return; }
		const placeholderResult = checkPlaceholders(args.file);
		if (!placeholderResult.ok) { process.exitCode = 1; return; }
		const verifyResult = await verify(args.file);
		if (!verifyResult.ok) { process.exitCode = 1; return; }
		const htmlResult = validateHtmlFile(path.resolve(args.file));
		if (!htmlResult.ok) {
			console.error(`not ok ${htmlResult.label}`);
			for (const failure of htmlResult.failures) console.error(`- ${failure}`);
			process.exitCode = 1;
			return;
		}
		console.log(`ok ${htmlResult.label}`);
		const { runPreflight, formatPreflight } = await import("./publish.mjs");
		const pre = await runPreflight(args.file, { target: "github", includeReview: args.includeReview, allowLocalPaths: args.allowLocalPaths });
		console.log(formatPreflight(pre));
		if (!pre.ok) { process.exitCode = 1; return; }
		const { publishGithubPages } = await import("./github-pages.mjs");
		const result = await publishGithubPages(args.file, { repo: args.repo, visibility: args.visibility });
		console.log(`✓ published ${result.repo} from ${path.relative(process.cwd(), result.publishDir)}`);
		console.log(`✓ GitHub Pages: ${result.htmlUrl}`);
		if (result.build?.status) {
			const buildError = result.build.error?.message ? ` (${result.build.error.message})` : "";
			const marker = result.build.status === "built" ? "✓" : result.build.status === "errored" ? "✗" : "…";
			console.log(`${marker} latest Pages build: ${result.build.status}${buildError}`);
			if (result.build.status === "errored") process.exitCode = 1;
		}
		return;
	}
	// ws6 agent tooling (references/contract.md, references/publish.md). Every runner returns an exit code and is awaited.
	if (args.mode === "doctor") { const { runDoctor } = await import("./doctor.mjs"); process.exitCode = await runDoctor(args); return; }
	if (args.mode === "content") { const { runCheckContent } = await import("./content-ir.mjs"); process.exitCode = await runCheckContent(args); return; }
	if (args.mode === "playbook") { const { runPlaybook } = await import("./playbooks.mjs"); process.exitCode = runPlaybook(args.playbook, args); return; }
	if (args.mode === "publish") { const { runPublish } = await import("./publish.mjs"); process.exitCode = await runPublish(args, { checkPlaceholders, verify, validateHtmlFile }); return; }
	if (args.mode === "screenshot") { const { runScreenshot } = await import("./screenshot.mjs"); process.exitCode = await runScreenshot(args); return; }
	// ws4b figure engines (references/figure-engines.md). Both runners return an exit code and are awaited.
	if (args.mode === "build-hero") { const { runBuildHero } = await import("./anatomy/build-hero.mjs"); process.exitCode = await runBuildHero({ file: args.file, audit: args.audit, check: args.check, json: args.json }); return; }
	if (args.mode === "check-figures") { const { runCheckFigures } = await import("./figures/check-figures.mjs"); process.exitCode = await runCheckFigures({ file: args.file, strict: args.strict, json: args.json }); return; }
	// ws3 iso kit (references/illustrations.md § Acceptance checks): advisory unless --strict. The runner returns an
	// exit code: 0 ok, 1 errors under --strict, 2 missing argument or unreadable file (a clean message, no stack).
	if (args.mode === "check-iso") { const { runCheckIso } = await import("./iso/audit.mjs"); process.exitCode = runCheckIso({ file: args.file, strict: args.strict, json: args.json }); return; }
	if (args.mode === "gate") {
		const { runGates } = await import("./gates.mjs");
		const { results } = await runGates(args.file, { gates: [args.gate] });
		let total = 0;
		for (const { gate, findings } of results) {
			if (findings.length === 0) { console.log(`✓ ${gate}: clean`); continue; }
			total += findings.length;
			console.log(`${args.strict ? "✗" : "⚠"} ${gate}: ${findings.length} finding${findings.length === 1 ? "" : "s"}`);
			for (const f of findings) console.log(`    - ${f}`);
		}
		if (total > 0 && args.strict) process.exitCode = 1;
		else if (total > 0) console.log(`(advisory — warnings only; pass --strict to fail)`);
		return;
	}

	// Default mode: run --check-templates plus a --verify on every template.
	const templatesResult = checkTemplates();
	let verifyFailures = 0;
	for (const file of listTemplates()) {
		const result = await verify(file);
		if (!result.ok) verifyFailures += 1;
	}
	if (!templatesResult.ok || verifyFailures > 0) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
