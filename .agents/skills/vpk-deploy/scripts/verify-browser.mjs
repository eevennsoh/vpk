#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function parseJson(value, label) {
	try { return JSON.parse(value); }
	catch { throw new Error(`Invalid ${label} JSON`); }
}

const messageText = message => (message.parts ?? []).filter(part => part.type === "text").map(part => part.text).join("");

function ownsThread(thread, id, prompt) {
	const users = (thread?.messages ?? []).filter(message => message.role === "user");
	return thread?.id === id && users.length === 1 && messageText(users[0]) === prompt;
}

export async function verifyChat(adapter, baseUrl, { token = `VPK_VERIFY_${randomUUID().slice(0, 8)}`, timeoutMs = 30000, openLabel = "Open Rovo chat", composerLabel = "Chat message input", submitLabel = "Submit" } = {}) {
	const prompt = `Reply exactly ${token}. Do not use tools.`;
	let threadId, owned = false, assistantVerified = false;
	const deadline = Date.now() + timeoutMs;
	await adapter.click(openLabel);
	await adapter.clearRequests();
	try {
		await adapter.fill(composerLabel, prompt);
		await adapter.click(submitLabel);
		while (Date.now() < deadline) {
			if (!threadId) {
				const candidates = (await adapter.requests()).filter(request => request.method === "POST" && new URL(request.url, baseUrl).origin === baseUrl.origin && new URL(request.url, baseUrl).pathname === "/api/rovo/threads");
				if (candidates.length > 1) throw new Error("Chat probe thread ownership is ambiguous");
				if (candidates.length) {
					const body = parseJson(candidates[0].postData ?? "{}", "chat probe request");
					if (!/^[a-f0-9-]{36}$/iu.test(body.id ?? "")) throw new Error("Chat probe thread ID is invalid");
					threadId = body.id;
				}
			}
			if (threadId) {
				const response = await adapter.request(`/api/rovo/threads/${threadId}`);
				if (response.status === 200) {
					const thread = response.body?.thread;
					if ((thread?.messages ?? []).some(message => message.role === "user") && !ownsThread(thread, threadId, prompt)) throw new Error("Chat probe ownership/prompt validation failed");
					owned = ownsThread(thread, threadId, prompt);
					if (owned) {
						if (thread.messages.flatMap(message => message.parts ?? []).some(part => part.type?.startsWith("tool-"))) throw new Error("Chat probe unexpectedly used a tool");
						const persisted = thread.messages.some(message => message.role === "assistant" && messageText(message).trim() === token);
						const visible = await adapter.evaluate(expected => [...document.querySelectorAll('[data-rovo-chat-placement="floating"] p')].some(element => element.textContent.trim() === expected), token);
						if (persisted && visible) { assistantVerified = true; break; }
					}
				} else if (response.status !== 404) throw new Error(`Chat probe API returned ${response.status}`);
			}
			await sleep(Math.min(200, Math.max(1, deadline - Date.now())));
		}
		if (!assistantVerified) throw new Error("Actual assistant response timed out");
	} finally {
		if (threadId && owned) {
			// Re-read before deletion: an ID alone never proves ownership.
			const current = await adapter.request(`/api/rovo/threads/${threadId}`);
			if (!ownsThread(current.body?.thread, threadId, prompt)) throw new Error("Chat cleanup ownership validation failed");
			const removed = await adapter.request(`/api/rovo/threads/${threadId}`, "DELETE");
			const after = await adapter.request(`/api/rovo/threads/${threadId}`);
			if (removed.status !== 200 || after.status !== 404) throw new Error("Synthetic chat cleanup failed");
		}
	}
	return { assistantVerified, threadRemoved: owned, toolParts: 0 };
}

async function playwrightAdapter(options) {
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch({ headless: !options.headed });
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: false });
	const page = await context.newPage();
	page.setDefaultTimeout(options.timeoutMs);
	let requests = [];
	const errors = [];
	page.on("request", request => { if (["POST", "PUT"].includes(request.method()) && new URL(request.url()).pathname.startsWith("/api/rovo/threads")) requests.push({ method: request.method(), url: request.url(), postData: request.postData() }); });
	page.on("pageerror", () => errors.push("pageerror"));
	page.on("console", message => { if (message.type() === "error") errors.push(/#418/u.test(message.text()) ? "React #418" : "console-error"); });
	return {
		goto: url => page.goto(url, { waitUntil: "networkidle" }),
		abortScripts: () => page.route("**/_next/**/*.js*", route => route.abort()),
		unroute: () => page.unroute("**/_next/**/*.js*"),
		evaluate: (expression, argument) => page.evaluate(expression, argument),
		click: label => page.getByRole("button", { name: label, exact: true }).click(),
		fill: (label, value) => page.getByRole("textbox", { name: label, exact: true }).fill(value),
		clearRequests: async () => { requests = []; }, requests: async () => requests,
		request: async (pathname, method = "GET") => { const response = await context.request.fetch(new URL(pathname, options.url).href, { method, timeout: options.timeoutMs }); return { status: response.status(), body: response.status() === 200 ? await response.json() : null }; },
		viewport: (width, height) => page.setViewportSize({ width, height }),
		reducedMotion: () => page.emulateMedia({ reducedMotion: "reduce" }),
		screenshot: filename => page.screenshot({ path: filename }),
		clearErrors: async () => { errors.length = 0; }, errors: async () => [...errors],
		close: () => browser.close(),
	};
}

function agentAdapter(options) {
	const session = `vpkv-${randomUUID().slice(0, 8)}`;
	const run = (args, input) => {
		const result = spawnSync("agent-browser", ["--session", session, "--json", ...args], { encoding: "utf8", input, timeout: options.timeoutMs + 3000, maxBuffer: 8 * 1024 * 1024 });
		if (result.status !== 0) throw new Error("Agent browser command failed; use the isolated Playwright fallback");
		const parsed = parseJson(result.stdout, "agent browser result");
		if (!parsed.success) throw new Error("Agent browser session failed");
		return parsed.data;
	};
	const evaluate = async (expression, argument) => {
		const data = run(["eval", "--stdin"], `(${expression.toString()})(${JSON.stringify(argument) ?? "undefined"})`);
		return data.result;
	};
	return {
		goto: async url => run(["open", url, ...(options.headed ? ["--headed"] : [])]),
		abortScripts: async () => run(["network", "route", "**/_next/**/*.js*", "--abort"]), unroute: async () => run(["network", "unroute"]), evaluate,
		click: async label => run(["find", "role", "button", "click", "--name", label, "--exact"]),
		fill: async (label, value) => run(["find", "role", "textbox", "fill", value, "--name", label, "--exact"]),
		clearRequests: async () => run(["network", "requests", "--clear"]), requests: async () => run(["network", "requests", "--filter", "/api/rovo/threads"]).requests ?? [],
		request: (pathname, method = "GET") => evaluate(async ({ url, operation }) => { const response = await fetch(url, { method: operation }); return { status: response.status, body: response.status === 200 ? await response.json() : null }; }, { url: new URL(pathname, options.url).href, operation: method }),
		viewport: async (width, height) => run(["set", "viewport", String(width), String(height)]), reducedMotion: async () => run(["set", "media", "light", "reduced-motion"]),
		screenshot: async filename => run(["screenshot", filename]), clearErrors: async () => run(["console", "--clear"]),
		errors: async () => (run(["console"]).messages ?? []).filter(message => message.type === "error").map(() => "console-error"),
		close: async () => { try { run(["close"]); } catch { /* Retain the original failure. */ } },
	};
}

async function auditAccessibility(url, timeoutMs) {
	const session = `vpka-${randomUUID().slice(0, 8)}`;
	try {
		const result = spawnSync("agent-browser", ["--session", session, "a11y", url.href, "--json"], { encoding: "utf8", timeout: timeoutMs + 3000, maxBuffer: 16 * 1024 * 1024 });
		if (result.status !== 0) throw new Error("Accessibility audit did not complete; retain browser evidence and use the documented ADS/CLI alternative");
		const parsed = parseJson(result.stdout, "agent browser result");
		if (!parsed.success || !parsed.data?.counts) throw new Error("Accessibility audit returned an incomplete result");
		return { completed: true, counts: parsed.data.counts, violations: (parsed.data.violations ?? []).map(finding => finding.id), incomplete: (parsed.data.incomplete ?? []).map(finding => finding.id) };
	} finally { spawnSync("agent-browser", ["--session", session, "close"], { timeout: 5000, stdio: "ignore" }); }
}

async function measure(adapter) {
	return adapter.evaluate(async () => {
		await document.fonts.ready;
		const style = getComputedStyle(document.documentElement);
		return {
			url: location.href, heading: document.querySelector("h1")?.textContent?.trim() ?? "", width: innerWidth, bodyWidth: document.body.scrollWidth,
			textToken: style.getPropertyValue("--ds-text").trim(), spacingToken: style.getPropertyValue("--ds-space-200").trim(),
			tabDirections: [...document.querySelectorAll('[data-slot="tabs"][data-horizontal]')].map(element => getComputedStyle(element).flexDirection),
			fonts: [...document.fonts].filter(font => font.status === "loaded").map(font => font.family), reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
		};
	});
}

function assertRoute(metadata, expected) {
	const actual = new URL(metadata?.url ?? "about:blank");
	if (actual.origin !== expected.origin || actual.pathname.replace(/\/$/u, "") !== expected.pathname.replace(/\/$/u, "")) throw new Error("Browser page lost or navigated outside the selected route");
}

export async function verifyBrowser(options) {
	const url = new URL(options.url);
	if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Use an HTTP(S) route URL without credentials");
	if (!options.marker) throw new Error("An exact heading marker is required");
	const settings = { timeoutMs: 30000, engine: "agent-browser", ...options, url };
	const output = path.resolve(options.outputDirectory);
	if (!output.includes(`${path.sep}output${path.sep}agent-browser${path.sep}`)) throw new Error("Store browser evidence under ignored output/agent-browser");
	await fs.mkdir(output, { recursive: true });
	let adapter, chatStarted = false;
	const report = { url: `${url.origin}${url.pathname}`, engine: settings.engine, firstPaint: null, desktop: null, narrow: null, chat: null, errors: [] };
	try {
		adapter = settings.engine === "playwright" ? await playwrightAdapter(settings) : agentAdapter(settings);
		await adapter.goto("about:blank");
		await adapter.abortScripts();
		await adapter.goto(url.href);
		report.firstPaint = await measure(adapter);
		assertRoute(report.firstPaint, url);
		if (settings.checkAdsTheme && (!report.firstPaint.textToken || !report.firstPaint.spacingToken)) throw new Error("Initial ADS theme is inactive");
		await adapter.screenshot(path.join(output, "first-paint.png"));
		await adapter.unroute();
		await adapter.clearErrors();
		await adapter.goto(url.href);
		await adapter.viewport(1440, 900);
		report.desktop = await measure(adapter);
		assertRoute(report.desktop, url);
		if (report.desktop.heading !== settings.marker) throw new Error("Selected route heading marker did not match");
		if (report.desktop.tabDirections.some(direction => direction !== "column")) throw new Error("Horizontal header tabs lost column layout");
		if (settings.expectedFont && !report.desktop.fonts.some(font => font.replace(/["']/gu, "") === settings.expectedFont)) throw new Error("Expected browser font did not load");
		await adapter.screenshot(path.join(output, "desktop.png"));
		if (settings.chat) { chatStarted = true; report.chat = await verifyChat(adapter, url, settings); await adapter.goto(url.href); }
		await adapter.viewport(390, 844);
		await adapter.reducedMotion();
		report.narrow = await measure(adapter);
		assertRoute(report.narrow, url);
		if (report.narrow.bodyWidth > report.narrow.width + 1 || !report.narrow.reducedMotion) throw new Error("Narrow reduced-motion layout failed");
		await adapter.screenshot(path.join(output, "narrow.png"));
		report.errors = await adapter.errors();
		if (report.errors.length) throw new Error("Normal browser navigation reported console/page errors");
		await adapter.close();
		adapter = null;
		if (settings.a11y) report.accessibility = await auditAccessibility(url, settings.timeoutMs);
		for (const state of [report.firstPaint, report.desktop, report.narrow]) state.url = report.url;
		await fs.writeFile(path.join(output, "browser-report.json"), `${JSON.stringify(report, null, 2)}\n`);
		return report;
	} catch (error) {
		if (settings.engine === "agent-browser" && !chatStarted && /Agent browser|Browser page lost/u.test(error.message)) {
			await adapter?.close();
			// The fallback stays on this route and cannot duplicate a started chat.
			return verifyBrowser({ ...options, engine: "playwright" });
		}
		throw error;
	} finally { await adapter?.close(); }
}

async function main(args) {
	const options = { url: args.shift(), outputDirectory: path.resolve("output/agent-browser", `release-${Date.now()}`) };
	for (let index = 0; index < args.length; index++) {
		const flag = args[index];
		if (flag === "--headed") options.headed = true;
		else if (flag === "--chat") options.chat = true;
		else if (flag === "--a11y") options.a11y = true;
		else if (flag === "--check-ads-theme") options.checkAdsTheme = true;
		else {
			const value = args[++index];
			if (!value || value.startsWith("--")) throw new Error("Browser verification option value is required");
			if (flag === "--marker") options.marker = value;
			else if (flag === "--expected-font") options.expectedFont = value;
			else if (flag === "--out-dir") options.outputDirectory = value;
			else if (flag === "--engine" && ["agent-browser", "playwright"].includes(value)) options.engine = value;
			else if (flag === "--timeout-ms" && Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 60000) options.timeoutMs = Number(value);
			else if (flag === "--chat-open-label") options.openLabel = value;
			else if (flag === "--composer-label") options.composerLabel = value;
			else if (flag === "--submit-label") options.submitLabel = value;
			else throw new Error("Unsupported browser verification option");
		}
	}
	const result = await verifyBrowser(options);
	console.log(JSON.stringify({ verified: true, url: result.url, engine: result.engine, chat: result.chat, evidence: options.outputDirectory }));
}

if (process.argv[1] && await fs.realpath(process.argv[1]).catch(() => null) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 2; });
