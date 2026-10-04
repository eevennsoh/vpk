"use strict";

// capture: one-command proof (screenshot, ARIA snapshot, console, page errors,
// a11y audit and manifest.json) for an exact mapped route.

const fs = require("node:fs");
const path = require("node:path");

const {
	browserSessionId,
	classifyAgentBrowserFailure,
	executeBrowserCommand,
	failureText,
	parseBrowserTimeoutMs,
	quotedCommand,
	runAgentBrowser,
} = require("./browser.js");
const { plural, splitOptions, usageError } = require("./cli.js");
const { targetBrowserArguments } = require("./origin.js");
const { EVIDENCE_DIR, REPO_ROOT, toPosix } = require("./repo.js");

const CAPTURE_USAGE = "Usage: control-vpk capture <route> [--id <label>] [--viewport WxH] [--media light|dark] [--variant <id>[=on|off]]... [--wait-text <text>] [--headed] [--strict-a11y]";
const DEFAULT_CAPTURE_VIEWPORT = Object.freeze({ width: 1280, height: 720 });
// `?variants=id,-id` forces design variants for one page load without storage
// writes; components/utils/design-variants.ts owns the grammar and the ids.
const VARIANT_FLAG = "--variant";
const DESIGN_VARIANTS_QUERY_PARAM = "variants";
const DESIGN_VARIANTS_SOURCE = path.join(REPO_ROOT, "components/utils/design-variants.ts");
const VARIANT_VALUE_PATTERN = /^([A-Za-z][A-Za-z0-9-]*)(?:=(on|off))?$/u;
const CAPTURE_MEDIA = ["light", "dark"];
const CAPTURE_FILES = Object.freeze({
	screenshot: "capture.png",
	snapshot: "capture.aria.txt",
	console: "capture.console.json",
	errors: "capture.errors.json",
	a11y: "capture.a11y.json",
	manifest: "manifest.json",
});
const COLOR_MODE_EXPRESSION = "document.documentElement.getAttribute('data-color-mode')";
// Client-loaded routes go network-idle while only the shell (a skip link) is painted,
// so proof waits for real text or media before it screenshots.
const RENDERED_CONTENT_EXPRESSION = "document.body !== null && (document.body.innerText.replace('Skip to content', '').trim().length > 40 || [...document.querySelectorAll('canvas, video, img, svg')].some((element) => element.getBoundingClientRect().width * element.getBoundingClientRect().height > 40000))";
const OPEN_TIMEOUT_HINT = "A freshly started dev server may still be compiling this route: rerun capture, or raise VPK_VERIFY_BROWSER_TIMEOUT_MS (ms, max 300000).";
const BLANK_PAGE_DETAIL = "The route painted only the app shell (no text or media) before timing out, so the screenshot would prove nothing. Check the page in a browser, or pass --wait-text for a slow route.";
const SESSION_LOST = new Set(["timeout", "stale_session", "missing_binary"]);

function defaultCaptureId(route) {
	const slug = String(route).split(/[?#]/u)[0].toLowerCase()
		.replace(/[^a-z0-9._-]+|\.{2,}/gu, "-")
		.replace(/-+/gu, "-")
		.replace(/^[-.]+|[-.]+$/gu, "");
	return slug.slice(0, 80) || "root";
}

// The ids live in a TypeScript `as const` array; read them from source so a
// typo fails here instead of the page silently ignoring it. [] when unreadable.
function readDesignVariantIds(sourcePath = DESIGN_VARIANTS_SOURCE) {
	let source = "";
	try {
		source = fs.readFileSync(sourcePath, "utf8");
	} catch {
		return [];
	}
	const block = /export const DESIGN_VARIANTS = \[([\s\S]*?)\] as const;/u.exec(source)?.[1] ?? "";
	return [...block.matchAll(/\bid:\s*"([^"]+)"/gu)].map((match) => match[1]);
}

// `--variant` is repeatable, which splitOptions (last value wins) cannot express.
function extractVariantFlags(args) {
	const rest = [];
	const values = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		const inline = arg.startsWith(`${VARIANT_FLAG}=`);
		if (arg !== VARIANT_FLAG && !inline) {
			rest.push(arg);
			continue;
		}
		const value = inline ? arg.slice(VARIANT_FLAG.length + 1) : args[index + 1];
		if (!inline) index += 1;
		if (typeof value !== "string" || value === "" || (!inline && value.startsWith("--"))) {
			throw usageError(`${VARIANT_FLAG} requires a value.`, CAPTURE_USAGE);
		}
		values.push(value);
	}
	return { rest, values };
}

// `id` / `id=on` -> "id", `id=off` -> "-id"; a repeated id keeps its last value.
function designVariantTokens(values, knownIds) {
	const tokenById = new Map();
	for (const value of values) {
		const match = VARIANT_VALUE_PATTERN.exec(value);
		if (!match) {
			throw usageError(`${VARIANT_FLAG} must be <id>, <id>=on or <id>=off, not "${value}".`, CAPTURE_USAGE);
		}
		const [, id, state = "on"] = match;
		if (knownIds.length > 0 && !knownIds.includes(id)) {
			throw usageError(`Unknown design variant "${id}". Known ids: ${knownIds.join(", ")}.`, CAPTURE_USAGE);
		}
		tokenById.delete(id);
		tokenById.set(id, state === "on" ? id : `-${id}`);
	}
	return [...tokenById.values()];
}

function decodeQueryPart(text) {
	try {
		return decodeURIComponent(text.replace(/\+/gu, " "));
	} catch {
		return text;
	}
}

// Merge variant tokens into the route's `variants` param, keeping every other
// query pair verbatim and the hash last. Tokens win over the route's own tokens
// for the same id, matching the page's last-token-wins rule.
function routeWithDesignVariants(route, tokens) {
	if (tokens.length === 0) return route;
	const hashStart = route.indexOf("#");
	const hash = hashStart === -1 ? "" : route.slice(hashStart);
	const beforeHash = hashStart === -1 ? route : route.slice(0, hashStart);
	const queryStart = beforeHash.indexOf("?");
	const pathname = queryStart === -1 ? beforeHash : beforeHash.slice(0, queryStart);
	const pairs = queryStart === -1 ? [] : beforeHash.slice(queryStart + 1).split("&").filter(Boolean);
	const tokenById = new Map();
	const addToken = (token) => {
		const enabled = !token.startsWith("-");
		const id = (enabled ? token : token.slice(1)).trim();
		if (id === "") return;
		tokenById.delete(id);
		tokenById.set(id, enabled ? id : `-${id}`);
	};
	const kept = [];
	for (const pair of pairs) {
		const separator = pair.indexOf("=");
		if (decodeQueryPart(separator === -1 ? pair : pair.slice(0, separator)) !== DESIGN_VARIANTS_QUERY_PARAM) {
			kept.push(pair);
			continue;
		}
		for (const token of decodeQueryPart(separator === -1 ? "" : pair.slice(separator + 1)).split(",")) {
			addToken(token.trim());
		}
	}
	for (const token of tokens) addToken(token);
	kept.push(`${DESIGN_VARIANTS_QUERY_PARAM}=${[...tokenById.values()].map(encodeURIComponent).join(",")}`);
	return `${pathname}?${kept.join("&")}${hash}`;
}

function parseCaptureArgs(args, { designVariantIds } = {}) {
	const { rest, values: variantValues } = extractVariantFlags(args);
	const variants = variantValues.length === 0
		? []
		: designVariantTokens(variantValues, designVariantIds ?? readDesignVariantIds());
	const { flags, positional } = splitOptions(rest, {
		booleanFlags: ["--headed", "--strict-a11y"],
		usageText: CAPTURE_USAGE,
		valueFlags: ["--id", "--viewport", "--media", "--wait-text"],
	});
	if (positional.length !== 1) throw usageError("capture requires exactly one route.", CAPTURE_USAGE);
	const [route] = positional;
	let viewport = { ...DEFAULT_CAPTURE_VIEWPORT };
	if (flags["--viewport"] !== undefined) {
		const match = /^(\d{3,5})x(\d{3,5})$/u.exec(flags["--viewport"]);
		const [width, height] = match ? [Number(match[1]), Number(match[2])] : [0, 0];
		if (!match || width > 7680 || height > 7680) {
			throw usageError("--viewport must be WIDTHxHEIGHT between 100 and 7680, e.g. 390x844.", CAPTURE_USAGE);
		}
		viewport = { width, height };
	}
	const media = flags["--media"] ?? "light";
	if (!CAPTURE_MEDIA.includes(media)) throw usageError("--media must be light or dark.", CAPTURE_USAGE);
	const id = flags["--id"] ?? defaultCaptureId(route);
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(id) || id.includes("..")) {
		throw usageError("--id must be 1-80 letters, digits, dots, dashes or underscores.", CAPTURE_USAGE);
	}
	return {
		headed: flags["--headed"] === true,
		id,
		media,
		route,
		strictA11y: flags["--strict-a11y"] === true,
		variants,
		viewport,
		waitText: flags["--wait-text"] ?? null,
	};
}

function manualVerificationRequested(env = process.env) {
	return String(env.VPK_VERIFY ?? "").trim().toLowerCase() === "manual";
}

function parseJsonOutput(stdout) {
	try {
		return JSON.parse(String(stdout ?? "").trim());
	} catch {
		return undefined;
	}
}

function parseEvalString(stdout) {
	const text = String(stdout ?? "").trim();
	const parsed = parseJsonOutput(text);
	const value = typeof parsed === "string" ? parsed : text;
	return value && value !== "null" && value !== "undefined" ? value : null;
}

// agent-browser --json wraps results as { success, data }; accept bare arrays too.
function payloadEntries(payload, keys) {
	const data = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
	if (Array.isArray(data)) return data;
	for (const key of keys) {
		if (Array.isArray(data?.[key])) return data[key];
	}
	return [];
}

function entryText(entry) {
	const text = typeof entry === "string" ? entry : entry?.text ?? entry?.message ?? entry?.description;
	return (typeof text === "string" ? text : JSON.stringify(entry)).slice(0, 300);
}

function consoleErrorEntries(payload) {
	return payloadEntries(payload, ["messages", "logs", "entries", "console"])
		.filter((entry) => String(entry?.level ?? entry?.type ?? "").toLowerCase() === "error");
}

function pageErrorEntries(payload) {
	return payloadEntries(payload, ["errors", "pageErrors", "entries"]);
}

// Dev-only overlays never ship, so axe findings inside them are not product findings.
// `.ph-no-capture` is the shadow host react-grab mounts in development.
const DEV_TOOLING_HOSTS = [".ph-no-capture"];

function isDevToolingNode(node) {
	const first = Array.isArray(node?.target) ? node.target[0] : null;
	const host = Array.isArray(first) ? first[0] : first;
	return typeof host === "string" && DEV_TOOLING_HOSTS.some((selector) => host.includes(selector));
}

function a11yViolationSummary(payload) {
	const data = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
	const violations = Array.isArray(data?.violations) ? data.violations : null;
	if (violations && violations.length > 0) {
		const product = violations.filter((violation) => {
			const nodes = Array.isArray(violation?.nodes) ? violation.nodes : [];
			return nodes.length === 0 || nodes.some((node) => !isDevToolingNode(node));
		});
		return { count: product.length, devToolingExcluded: violations.length - product.length };
	}
	if (typeof data?.counts?.violations === "number") return { count: data.counts.violations, devToolingExcluded: 0 };
	return { count: violations ? 0 : null, devToolingExcluded: 0 };
}

function buildCaptureManifest({
	a11y,
	colorMode = null,
	consoleLog,
	failures = [],
	files = {},
	finalUrl = "",
	options,
	pageErrorLog,
	timestamp,
	url,
	warnings = [],
}) {
	const consoleErrors = consoleLog === undefined ? null : consoleErrorEntries(consoleLog);
	const pageErrors = pageErrorLog === undefined ? null : pageErrorEntries(pageErrorLog);
	const a11ySummary = a11y === undefined ? { count: null, devToolingExcluded: 0 } : a11yViolationSummary(a11y);
	const counts = {
		consoleErrors: consoleErrors?.length ?? null,
		pageErrors: pageErrors?.length ?? null,
		a11yViolations: a11ySummary.count,
	};
	const notes = [...warnings];
	if (a11ySummary.devToolingExcluded > 0) {
		notes.push(`${a11ySummary.devToolingExcluded} a11y finding(s) inside dev-only tooling (react-grab) excluded; they do not ship.`);
	}
	if (typeof colorMode === "string" && colorMode !== options.media) {
		notes.push(`data-color-mode is "${colorMode}", not the requested ${options.media} media; a stored theme preference may override it. Switch it with the header theme control, not storage.`);
	}
	if (counts.a11yViolations === null) {
		notes.push("a11y audit unavailable; violations were not counted.");
	} else if (counts.a11yViolations > 0 && !options.strictA11y) {
		notes.push(`${counts.a11yViolations} a11y violation(s) reported (non-fatal; pass --strict-a11y to fail).`);
	}
	const ok = failures.length === 0
		&& counts.consoleErrors === 0
		&& counts.pageErrors === 0
		&& (!options.strictA11y || counts.a11yViolations === 0);
	return {
		id: options.id,
		route: options.route,
		url: finalUrl || url,
		requestedUrl: url,
		viewport: { ...options.viewport },
		media: options.media,
		variants: [...(options.variants ?? [])],
		colorMode,
		waitText: options.waitText,
		strictA11y: options.strictA11y,
		timestamp,
		files,
		counts,
		samples: {
			consoleErrors: (consoleErrors ?? []).slice(0, 5).map(entryText),
			pageErrors: (pageErrors ?? []).slice(0, 5).map(entryText),
		},
		failures,
		warnings: notes,
		ok,
	};
}

function runCapture(options, {
	evidenceRoot = EVIDENCE_DIR,
	now = () => new Date(),
	origin,
	repoMap,
	repoRoot = REPO_ROOT,
	resolveSession = browserSessionId,
	runCommand = runAgentBrowser,
	timeoutMs = parseBrowserTimeoutMs(),
} = {}) {
	// Same validation and origin resolution as open-target; throws before any browser work.
	const target = routeWithDesignVariants(options.route, options.variants ?? []);
	const openArgs = targetBrowserArguments(target, { headed: options.headed, origin, repoMap });
	const url = openArgs.at(-1);
	const dir = path.join(evidenceRoot, options.id);
	fs.mkdirSync(dir, { recursive: true });
	for (const name of Object.values(CAPTURE_FILES)) fs.rmSync(path.join(dir, name), { force: true });
	const relative = (file) => toPosix(path.relative(repoRoot, file));
	const failures = [];
	const warnings = [];
	const files = {};
	let halted = false;
	let session = "";
	try {
		session = resolveSession();
	} catch (error) {
		failures.push({ step: "session", classification: classifyAgentBrowserFailure(error), detail: failureText(error).slice(0, 500) });
		halted = true;
	}
	const run = (step, forwarded, { failureDetail = null, required = true } = {}) => {
		if (halted) return null;
		const outcome = executeBrowserCommand(forwarded, { runCommand, session, timeoutMs });
		if (outcome.classification === null) return outcome.result;
		halted = step === "open" || SESSION_LOST.has(outcome.classification);
		const coldCompile = step === "open" && outcome.classification === "timeout" ? ` ${OPEN_TIMEOUT_HINT}` : "";
		const detail = failureDetail ?? `${failureText(outcome.result).trim().slice(0, 500)}${coldCompile}`;
		if (required || halted) {
			failures.push({ step, classification: outcome.classification, command: quotedCommand(forwarded), detail });
		} else {
			warnings.push(`${step} skipped [${outcome.classification}]: ${detail.split("\n")[0]}`);
		}
		return null;
	};
	const save = (key, result) => {
		const file = path.join(dir, CAPTURE_FILES[key]);
		fs.writeFileSync(file, String(result.stdout ?? ""));
		files[key] = relative(file);
	};

	run("open", openArgs);
	run("viewport", ["set", "viewport", String(options.viewport.width), String(options.viewport.height)]);
	run("media", ["set", "media", options.media]);
	run("clear-console", ["console", "--clear"], { required: false });
	run("clear-errors", ["errors", "--clear"], { required: false });
	// Reload so the whole load runs under the requested viewport/media with clean logs.
	run("reload", ["reload"]);
	run("settle", ["wait", "--load", "networkidle"], { required: false });
	if (options.waitText !== null) run("wait-text", ["wait", "--text", options.waitText]);
	run("content", ["wait", "--fn", RENDERED_CONTENT_EXPRESSION], { failureDetail: BLANK_PAGE_DETAIL });
	const finalUrl = String(run("url", ["get", "url"], { required: false })?.stdout ?? "").trim();
	const colorMode = parseEvalString(run("color-mode", ["eval", COLOR_MODE_EXPRESSION], { required: false })?.stdout);
	const screenshotPath = path.join(dir, CAPTURE_FILES.screenshot);
	if (run("screenshot", ["screenshot", screenshotPath])) {
		if (fs.existsSync(screenshotPath)) {
			files.screenshot = relative(screenshotPath);
		} else {
			failures.push({ step: "screenshot", classification: "assertion_failure", detail: `No file was written at ${screenshotPath}.` });
		}
	}
	const snapshot = run("snapshot", ["snapshot", "--compact"]);
	if (snapshot) save("snapshot", snapshot);
	const parsed = {};
	for (const [key, required] of [["console", true], ["errors", true], ["a11y", false]]) {
		const result = run(key, [key, "--json"], { required });
		if (!result) continue;
		save(key, result);
		parsed[key] = parseJsonOutput(result.stdout);
		if (parsed[key] === undefined && required) {
			failures.push({ step: key, classification: "assertion_failure", detail: `agent-browser ${key} --json did not return JSON.` });
		}
	}

	const manifest = buildCaptureManifest({
		a11y: parsed.a11y,
		colorMode,
		consoleLog: parsed.console,
		failures,
		files,
		finalUrl,
		options,
		pageErrorLog: parsed.errors,
		timestamp: now().toISOString(),
		url,
		warnings,
	});
	const manifestPath = path.join(dir, CAPTURE_FILES.manifest);
	manifest.files.manifest = relative(manifestPath);
	fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	return { manifest, manifestPath };
}

function formatCaptureSummary(manifest, manifestPath) {
	const { counts } = manifest;
	const count = (value, noun) => (value === null ? "unavailable" : plural(value, noun));
	const lines = [
		`capture ${manifest.id}: ${manifest.ok ? "PASS" : "FAIL"}`,
		`  url      ${manifest.url}`,
		`  state    ${manifest.media} ${manifest.viewport.width}x${manifest.viewport.height}, data-color-mode=${manifest.colorMode ?? "unknown"}${manifest.variants?.length ? `, variants=${manifest.variants.join(",")}` : ""}`,
		`  console  ${count(counts.consoleErrors, "error")}`,
		`  page     ${count(counts.pageErrors, "error")}`,
		`  a11y     ${count(counts.a11yViolations, "violation")}${manifest.strictA11y ? " (strict)" : " (non-fatal)"}`,
		...manifest.failures.map((failure) => `  failed   ${failure.step} [${failure.classification}] ${String(failure.detail ?? "").split("\n")[0]}`),
		...manifest.samples.pageErrors.map((text) => `  error    ${text}`),
		...manifest.samples.consoleErrors.map((text) => `  console  ${text}`),
		...manifest.warnings.map((text) => `  warn     ${text}`),
		`manifest: ${manifestPath}`,
	];
	return `${lines.join("\n")}\n`;
}

function captureCli(args, { capture = runCapture, env = process.env, stdout = process.stdout } = {}) {
	const options = parseCaptureArgs(args);
	if (manualVerificationRequested(env)) {
		stdout.write(`VPK_VERIFY=manual: the user opted into manual verification, so capture opened no browser.\nAsk the user to check ${routeWithDesignVariants(options.route, options.variants ?? [])} on this worktree's origin (control-vpk url) and report back.\n`);
		return 0;
	}
	const { manifest, manifestPath } = capture(options);
	stdout.write(formatCaptureSummary(manifest, manifestPath));
	return manifest.ok ? 0 : 1;
}

module.exports = {
	buildCaptureManifest,
	captureCli,
	formatCaptureSummary,
	manualVerificationRequested,
	parseCaptureArgs,
	readDesignVariantIds,
	routeWithDesignVariants,
	runCapture,
};
