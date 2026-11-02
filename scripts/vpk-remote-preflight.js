#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);
const SCHEMA = { type: "object", properties: { value: { type: "string", enum: ["ok"] } }, required: ["value"], additionalProperties: false };

function resolveModel(value, defaults) {
	const alias = `ALIAS_${value.replace(/[-.]/gu, "_")}`;
	for (const line of defaults.split("\n")) {
		const match = line.match(/^([A-Z_a-z0-9]+)=(?:"([^"\n]*)"|'([^'\n]*)'|([^\s#]+))\s*(?:#.*)?$/u);
		if (match?.[1] === alias) value = match[2] ?? match[3] ?? match[4];
	}
	if (!/^(?:gpt-|claude-|o\d)[A-Za-z0-9.\[\]-]+$/u.test(value)) throw new Error(`Unsupported model: ${value}`);
	return value;
}

function createProbe({ app, model, key, baseUrl }) {
	if (!["codex", "claude"].includes(app)) throw new Error("--app must be codex or claude");
	const native = (app === "claude") === model.startsWith("claude-");
	const base = baseUrl ?? (native ? (app === "claude" ? "http://localhost:29576/vertex/claude" : "http://localhost:29576/openai/v1") : "http://127.0.0.1:4000/v1");
	const parsed = new URL(base);
	if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || parsed.username || parsed.password || parsed.search || parsed.hash) {
		throw new Error("Preflight endpoints must be HTTP loopback URLs without credentials, query, or fragment");
	}
	if (!native && !key) throw new Error("Translator key is missing; check ~/.config/litellm-proximity/master_key");
	const headers = { "Content-Type": "application/json" };
	if (!native) headers.Authorization = `Bearer ${key}`;
	if (app === "claude") {
		headers["anthropic-version"] = "2023-06-01";
		headers["x-api-key"] = native ? "proximity" : key;
		return {
			url: `${base.replace(/\/$/u, "")}${native ? "/v1" : ""}/messages`, headers,
			body: { model, stream: true, max_tokens: 256, messages: [{ role: "user", content: 'Call probe once with value "ok". Do not respond with text.' }], tools: [{ name: "probe", description: "Verify tool transport only; no side effects.", input_schema: SCHEMA }], tool_choice: { type: "auto" } },
		};
	}
	const tools = ["vpk_remote", "vpk_other"].map((name) => ({ type: "namespace", name, description: "Verify distinct tool namespaces.", tools: [{ type: "function", name: "probe", description: "Verify transport only; no side effects.", parameters: SCHEMA }] }));
	return {
		url: `${base.replace(/\/$/u, "")}/responses`, headers,
		body: {
			model, stream: true, max_output_tokens: 1024,
			input: native ? 'Call vpk_remote.probe with value "ok". Do not call vpk_other.probe.' : [
				{ role: "user", content: 'Call vpk_remote.probe with value "ok". Do not call vpk_other.probe.' },
				{ type: "additional_tools", tools: [tools[0]] },
			],
			tools,
			tool_choice: "required",
		},
	};
}

function classify(status, body) {
	try {
		const data = JSON.parse(body);
		body = data.error?.message ?? data.message ?? body;
	} catch { /* Plain-text upstream errors have no envelope. */ }
	if (/tool names must be unique|duplicate.*tool/iu.test(body)) return { code: "duplicate-tools", message: "Translator produced duplicate tool names. Check namespace translation; do not drop conflicting tools. Use a native Claude worker for this task while repairing the handoff." };
	if (/cloudid/iu.test(body)) return { code: "cloud-id", message: "Gateway CloudID is invalid or not provisioned. This is an upstream routing issue; changing prompts will not fix it." };
	if ([401, 403].includes(status)) return { code: "authentication", message: "Selected route rejected authentication. Check the local translator key or Proximity login; no fallback login was attempted." };
	if (/model.*(?:not found|not supported|unknown|invalid|not available)/iu.test(body)) return { code: "model", message: "Selected model was rejected. Check the exact alias and gateway model routing; no model substitution was attempted." };
	return { code: RETRYABLE.has(status) ? "upstream" : "request", message: `Selected inference route returned HTTP ${status}. Inspect its local logs; no worker was launched.` };
}

function validToolReply(data, app) {
	if (app === "claude") return Array.isArray(data.content) && data.content.some((v) => v?.type === "tool_use" && v.name === "probe" && v.input?.value === "ok");
	if (data.status !== "completed") return false;
	return Array.isArray(data.output) && data.output.some((v) => {
		if (v?.type !== "function_call" || v.name !== "probe" || v.namespace !== "vpk_remote") return false;
		try { return JSON.parse(v.arguments).value === "ok"; } catch { return false; }
	});
}

function decodeReply(body, app) {
	if (body.trim().startsWith("{")) return JSON.parse(body);
	const events = body.split(/\r?\n/u).filter((line) => line.startsWith("data: ") && line !== "data: [DONE]").map((line) => JSON.parse(line.slice(6)));
	const failure = events.find((event) => event.error || event.type === "response.failed");
	if (failure) return { error: failure.error ?? failure.response?.error ?? { type: "stream_failed" } };
	if (app === "codex") return events.find((event) => event.type === "response.completed")?.response ?? {};
	if (!events.some((event) => event.type === "message_stop")) return {};
	const blocks = new Map();
	for (const event of events) {
		if (event.type === "content_block_start") blocks.set(event.index, { ...event.content_block, json: "" });
		if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta" && blocks.has(event.index)) blocks.get(event.index).json += event.delta.partial_json;
	}
	return { content: [...blocks.values()].map(({ json, ...block }) => ({ ...block, input: json ? JSON.parse(json) : block.input })) };
}

async function preflight(options, dependencies = {}) {
	const fetch = dependencies.fetch ?? globalThis.fetch;
	const sleep = dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	const probe = createProbe(options);
	for (let attempt = 1; attempt <= 2; attempt++) {
		let response;
		try {
			response = await fetch(probe.url, { method: "POST", headers: probe.headers, body: JSON.stringify(probe.body), signal: AbortSignal.timeout(options.timeoutMs ?? 20_000), redirect: "error" });
			const body = await response.text();
			if (!response.ok) {
				const failure = { ok: false, ...classify(response.status, body), status: response.status, attempts: attempt, app: options.app, model: options.model, endpoint: probe.url };
				if (failure.code !== "upstream" || !RETRYABLE.has(response.status) || attempt === 2) return failure;
			} else {
				let data;
				try { data = decodeReply(body, options.app); } catch { return { ok: false, code: "invalid-response", message: "Inference returned malformed JSON or stream events.", endpoint: probe.url }; }
				if (!data || typeof data !== "object") return { ok: false, code: "invalid-response", message: "Inference returned no response object.", endpoint: probe.url };
				if (data.error) {
					const errorType = data.error.type ?? "stream_error";
					const transientStatus = { overloaded_error: 529, rate_limit_error: 429, api_error: 500 }[errorType];
					const detail = classify(transientStatus ?? 0, typeof data.error === "string" ? data.error : JSON.stringify(data.error));
					if (["upstream", "request"].includes(detail.code)) detail.message = "Selected inference stream reported an error. Inspect the local translator/gateway logs; no worker was launched.";
					const failure = { ok: false, ...detail, status: response.status, errorType, attempts: attempt, endpoint: probe.url };
					if (failure.code !== "upstream" || attempt === 2) return failure;
				} else {
					if (!validToolReply(data, options.app)) return { ok: false, code: "tool-round-trip", message: "Inference did not return the expected tool name, namespace, and arguments. Do not claim this route is ready.", endpoint: probe.url };
					return { ok: true, app: options.app, model: options.model, endpoint: probe.url, attempts: attempt, message: "Selected model completed a tool-call round-trip. This does not certify every installed plugin or a later worker run." };
				}
			}
		} catch {
			if (attempt === 2) return { ok: false, code: "transport", message: "Selected inference route is unreachable, timed out, or redirected. Check Proximity and the translator process.", endpoint: probe.url, attempts: attempt };
		}
		await sleep(250);
	}
}

async function main(args = process.argv.slice(2)) {
	const options = {};
	for (let index = 0; index < args.length; index += 2) {
		const flag = args[index];
		const value = args[index + 1];
		if (!["--app", "--model", "--base-url", "--timeout-ms"].includes(flag) || !value) throw new Error("Usage: node scripts/vpk-remote-preflight.js --app codex|claude --model <alias|id> [--base-url <loopback-url>] [--timeout-ms <ms>]");
		options[{ "--app": "app", "--model": "model", "--base-url": "baseUrl", "--timeout-ms": "timeoutMs" }[flag]] = value;
	}
	if (!options.model) throw new Error("--model is required; use the exact requested model or a configured alias");
	const configDir = path.join(os.homedir(), ".config/litellm-proximity");
	const defaultsFile = path.join(configDir, "defaults.env");
	options.model = resolveModel(options.model, fs.existsSync(defaultsFile) ? fs.readFileSync(defaultsFile, "utf8") : "").replace(/\[1m\]$/u, "");
	if (options.timeoutMs !== undefined) {
		options.timeoutMs = Number(options.timeoutMs);
		if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 60_000) throw new Error("--timeout-ms must be an integer from 1 to 60000");
	}
	if ((options.app === "claude") !== options.model.startsWith("claude-")) options.key = fs.readFileSync(path.join(configDir, "master_key"), "utf8").trim();
	const result = await preflight(options);
	process.stdout.write(`${JSON.stringify(result)}\n`);
	return result.ok ? 0 : 1;
}

if (require.main === module) main().then((code) => { process.exitCode = code; }).catch(() => {
	process.stderr.write("Preflight configuration error. Check --app, --model, timeout, loopback URL, and local defaults/key files. No worker was launched.\n");
	process.exitCode = 2;
});

module.exports = { createProbe, preflight, resolveModel };
