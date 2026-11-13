#!/usr/bin/env node

"use strict";

// The dev stack's pane output, as dev-tmux-plain.sh pipes it into output/logs/<worktree>/dev.log.
// Agents read that file into their transcripts, so two rules apply on the way in:
//
// 1. Secret-shaped values are masked: bearer and basic credentials, Authorization, Cookie and
//    Set-Cookie header values, key=value or key: value pairs whose key names a token, secret,
//    password, API key, private key or session, JWTs, PEM private-key blocks, `sk-` style keys,
//    and signature/token query parameters of signed URLs. A plain run of the stack printed none
//    of these (checked when this was written); the mask is for what a debug flag or an upstream
//    error might print.
// 2. The file stays under a size cap (default 20 MB). When a write would pass it, the file is
//    rewritten to its newest half behind one marker line, so a server that runs for days keeps
//    its recent output and the pane is never interrupted.
//
//   node scripts/lib/dev-log-filter.js --out <file> [--max-bytes <n>]   (reads the pane on stdin)

const fs = require("node:fs");

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const MASK = "[masked]";
const SECRET_KEY = String.raw`[A-Za-z0-9_.-]*(?:token|secret|passw(?:or)?d|api[_-]?key|apikey|private[_-]?key|session[_-]?id|session[_-]?token|client[_-]?secret|access[_-]?key|credential)[A-Za-z0-9_.-]*`;

const RULES = [
	// -----BEGIN … PRIVATE KEY----- … -----END … PRIVATE KEY----- on one line, or its opening line.
	[/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/gu, `-----BEGIN PRIVATE KEY----- ${MASK}`],
	// Header values: Authorization, Proxy-Authorization, Cookie, Set-Cookie, X-…-Token / X-Api-Key.
	[/\b((?:proxy-)?authorization|set-cookie|cookie|x-[a-z-]*(?:token|key|secret))(["']?\s*[:=]\s*["']?)[^"'\r\n]+/giu, `$1$2${MASK}`],
	// Scheme credentials anywhere: "Bearer abc", "Basic abc".
	[/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gu, `$1 ${MASK}`],
	// JSON Web Tokens.
	[/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu, MASK],
	// Provider-style secret keys: sk-…, sk_live_…, xoxb-…, ghp_…, github_pat_….
	[/\b(?:sk|rk|pk)[-_](?:live[-_]|test[-_]|proj[-_])?[A-Za-z0-9]{16,}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/gu, MASK],
	// Signed-URL query parameters.
	[/([?&](?:X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|sig|signature|token|access_token|code|key)=)[^&\s"']+/giu, `$1${MASK}`],
	// KEY=value, "key": "value", key: value where the key names a secret. SET/MISSING stay readable.
	[new RegExp(String.raw`\b(${SECRET_KEY})(["']?\s*[:=]\s*["']?)(?!(?:SET|MISSING|true|false|null|undefined)\b)([^\s"',;]{4,})`, "giu"), `$1$2${MASK}`],
];

function maskSecrets(line) {
	return RULES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), line);
}

function createCappedWriter(file, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
	let size = 0;
	try {
		size = fs.statSync(file).size;
	} catch {
		size = 0;
	}
	return function write(text) {
		const chunk = Buffer.from(text, "utf8");
		if (size + chunk.length > maxBytes) {
			const current = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0);
			const combined = Buffer.concat([current, chunk]);
			// Keep the newest half, starting at a line boundary.
			let start = combined.length - Math.floor(maxBytes / 2);
			const newline = combined.indexOf(0x0a, Math.max(start, 0));
			start = newline === -1 ? Math.max(start, 0) : newline + 1;
			const marker = Buffer.from(`[dev-log: trimmed to its newest ${Math.round(maxBytes / 2 / 1024)} KB at ${new Date().toISOString()}]\n`, "utf8");
			const kept = Buffer.concat([marker, combined.subarray(start)]);
			fs.writeFileSync(file, kept);
			size = kept.length;
			return;
		}
		fs.appendFileSync(file, chunk);
		size += chunk.length;
	};
}

// Masks complete lines as they arrive; a trailing partial line waits for its newline (or the end).
function createLineFilter(write) {
	let pending = "";
	return {
		push(chunk) {
			pending += chunk;
			const lastNewline = pending.lastIndexOf("\n");
			if (lastNewline === -1) return;
			const complete = pending.slice(0, lastNewline + 1);
			pending = pending.slice(lastNewline + 1);
			write(complete.split("\n").map(maskSecrets).join("\n"));
		},
		end() {
			if (pending) write(maskSecrets(pending));
			pending = "";
		},
	};
}

function parseArgs(argv) {
	const options = { maxBytes: DEFAULT_MAX_BYTES, out: null };
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === "--out") options.out = argv[++index];
		else if (argv[index] === "--max-bytes") options.maxBytes = Number.parseInt(argv[++index], 10);
	}
	if (!options.out || !(options.maxBytes > 0)) throw new Error("Usage: dev-log-filter.js --out <file> [--max-bytes <n>]");
	return options;
}

if (require.main === module) {
	const options = parseArgs(process.argv.slice(2));
	const filter = createLineFilter(createCappedWriter(options.out, options));
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk) => filter.push(chunk));
	process.stdin.on("end", () => filter.end());
}

module.exports = { DEFAULT_MAX_BYTES, createCappedWriter, createLineFilter, maskSecrets };
