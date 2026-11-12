"use strict";

const dns = require("node:dns");
const fs = require("node:fs");
const { BlockList } = require("node:net");
const path = require("node:path");
const { execFile } = require("node:child_process");

const { getVaultRoot, writeRaw } = require("./personal-graph-vault");

function runAgentBrowser(args) {
	return new Promise((resolve, reject) => {
		const bin = path.resolve(__dirname, "..", "..", "node_modules", ".bin", "agent-browser");
		execFile(bin, args, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(`agent-browser ${args[0]} failed: ${stderr || error.message}`));
				return;
			}
			resolve(stdout.trim());
		});
	});
}

class CliAgentBrowser {
	open(url) {
		return runAgentBrowser(["open", url]);
	}
	snapshot() {
		return runAgentBrowser(["snapshot"]);
	}
	getTitle() {
		return runAgentBrowser(["get", "title"]);
	}
	screenshot(filePath) {
		return runAgentBrowser(["screenshot", filePath]);
	}
	close() {
		return runAgentBrowser(["close"]);
	}
}

function sanitizeSlug(value) {
	return String(value ?? "source")
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/gu, "")
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/gu, "")
		.slice(0, 80) || "source";
}

function formatDatePrefix(date = new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		timeZone: "Australia/Sydney",
		year: "numeric",
	}).format(date);
}

const NON_PUBLIC_ADDRESSES = new BlockList();
for (const [address, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["224.0.0.0", 4],
	["240.0.0.0", 4],
]) {
	NON_PUBLIC_ADDRESSES.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
	["::", 128],
	["::1", 128],
	["64:ff9b::", 96],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8],
]) {
	NON_PUBLIC_ADDRESSES.addSubnet(address, prefix, "ipv6");
}

function isNonPublicAddress(address, family) {
	return NON_PUBLIC_ADDRESSES.check(address, family === 6 ? "ipv6" : "ipv4");
}

function createInvalidUrlError(message) {
	const error = new Error(message);
	error.code = "INVALID_URL";
	return error;
}

async function assertPublicHttpUrl(url, { lookup = dns.promises.lookup } = {}) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		throw createInvalidUrlError("A valid URL is required.");
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw createInvalidUrlError("Only http and https URLs can be captured.");
	}
	const hostname = parsed.hostname.replace(/^\[(.*)\]$/u, "$1");
	let addresses;
	try {
		addresses = await lookup(hostname, { all: true, verbatim: true });
	} catch {
		throw createInvalidUrlError(`Could not resolve ${hostname}.`);
	}
	if (addresses.length === 0 || addresses.some(({ address, family }) => isNonPublicAddress(address, family))) {
		throw createInvalidUrlError("Only public internet addresses can be captured.");
	}
	return parsed.toString();
}

async function captureUrl(url, { BrowserClass = CliAgentBrowser, date = new Date(), lookup } = {}) {
	const resolvedUrl = await assertPublicHttpUrl(url, { lookup });
	const browser = new BrowserClass();
	let title = "";
	let snapshot = "";
	let assetPath = null;
	try {
		await browser.open(resolvedUrl);
		title = (await browser.getTitle()) || new URL(resolvedUrl).hostname;
		snapshot = (await browser.snapshot()) || "";
		const slug = `${formatDatePrefix(date)}-${sanitizeSlug(title)}`;
		const vaultRoot = getVaultRoot();
		const relativeAssetPath = `raw/assets/${slug}.png`;
		assetPath = path.join(vaultRoot, relativeAssetPath);
		fs.mkdirSync(path.dirname(assetPath), { recursive: true });
		await browser.screenshot(assetPath);
		const rawBody = [
			"---",
			`title: ${JSON.stringify(title)}`,
			`url: ${resolvedUrl}`,
			`captured: ${date.toISOString()}`,
			`asset: ${relativeAssetPath}`,
			"---",
			"",
			snapshot,
			"",
		].join("\n");
		const raw = writeRaw(`${slug}.md`, rawBody);
		return {
			assetPath: relativeAssetPath,
			frontmatter: { asset: relativeAssetPath, captured: date.toISOString(), title, url: resolvedUrl },
			rawPath: raw.relativePath,
			slug,
		};
	} finally {
		if (typeof browser.close === "function") {
			await browser.close().catch(() => {});
		}
	}
}

module.exports = {
	CliAgentBrowser,
	assertPublicHttpUrl,
	captureUrl,
	sanitizeSlug,
};
