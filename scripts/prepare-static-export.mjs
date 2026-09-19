#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
const textExtension = /\.(?:html|css|m?js|json|svg|txt|xml)$/iu;

function filesIn(root) {
	const files = [];
	function walk(directory) {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const absolute = path.join(directory, entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Symlink in export: ${path.relative(root, absolute)}`);
			if (entry.isDirectory()) walk(absolute);
			else if (entry.isFile()) files.push(absolute);
		}
	}
	walk(root);
	return files;
}

export function staticReferences(html) {
	return [...new Set([...html.matchAll(/["'](\/_next\/static\/[^"']+)/gu)]
		.map((match) => match[1].replace(/\\$/u, "")))];
}

function resolveReference(root, ref) {
	const url = new URL(ref, "https://export.invalid");
	const relative = decodeURIComponent(url.pathname).replace(/^\//u, "");
	const absolute = path.resolve(root, relative);
	if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error("Asset reference escapes export");
	return { absolute, relative };
}

function assetSize(root, absolute) {
	const rawBytes = fs.statSync(absolute).size;
	return {
		path: path.relative(root, absolute).split(path.sep).join("/"),
		rawBytes,
		gzipBytes: fs.existsSync(`${absolute}.gz`) ? fs.statSync(`${absolute}.gz`).size : null,
		brotliBytes: fs.existsSync(`${absolute}.br`) ? fs.statSync(`${absolute}.br`).size : null,
	};
}

export function inspectExport(exportDirectory) {
	const root = path.resolve(exportDirectory);
	if (!fs.existsSync(path.join(root, "index.html"))) throw new Error("Export needs index.html");
	const files = filesIn(root);
	const routes = [];
	for (const absolute of files.filter((file) => file.endsWith(".html"))) {
		const refs = staticReferences(fs.readFileSync(absolute, "utf8"));
		const assets = refs.map((ref) => {
			const resolved = resolveReference(root, ref);
			if (!fs.existsSync(resolved.absolute) || !fs.statSync(resolved.absolute).isFile()) {
				throw new Error(`Missing referenced asset in ${path.relative(root, absolute)}: ${resolved.relative}`);
			}
			return assetSize(root, resolved.absolute);
		});
		const html = assetSize(root, absolute);
		routes.push({
			html,
			assetCount: assets.length,
			jsBytes: assets.filter((asset) => /\.m?js$/iu.test(asset.path)).reduce((sum, asset) => sum + asset.rawBytes, 0),
			cssBytes: assets.filter((asset) => asset.path.endsWith(".css")).reduce((sum, asset) => sum + asset.rawBytes, 0),
			fontBytes: assets.filter((asset) => /\.(?:woff2?|ttf|otf)$/iu.test(asset.path)).reduce((sum, asset) => sum + asset.rawBytes, 0),
			assets,
			largestAssets: [...assets].sort((a, b) => b.rawBytes - a.rawBytes).slice(0, 5),
		});
	}
	const representationBytes = { identity: 0, gzip: 0, brotli: 0 };
	const originalAssets = [];
	for (const absolute of files) {
		const bytes = fs.statSync(absolute).size;
		const codec = absolute.endsWith(".gz") ? "gzip" : absolute.endsWith(".br") ? "brotli" : null;
		if (codec && fs.existsSync(absolute.slice(0, -3))) representationBytes[codec] += bytes;
		else { representationBytes.identity += bytes; originalAssets.push({ path: path.relative(root, absolute).split(path.sep).join("/"), rawBytes: bytes }); }
	}
	return {
		schemaVersion: 1,
		kind: "static-export-inventory",
		measurement: "HTML-referenced Next assets; includes serialized references, not observed browser transfers or latency",
		packagedFiles: files.length,
		packagedBytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0),
		routes,
		representationBytes,
		compressionOverheadBytes: representationBytes.gzip + representationBytes.brotli,
		largestPackagedAssets: originalAssets.sort((a, b) => b.rawBytes - a.rawBytes).slice(0, 10),
	};
}

export async function prepareExport(exportDirectory) {
	const root = path.resolve(exportDirectory);
	// Validate the complete export before writing any compression siblings.
	inspectExport(root);
	for (const file of filesIn(root).filter((absolute) => textExtension.test(absolute))) {
		const sourceStat = fs.statSync(file);
		const source = fs.readFileSync(file);
		const [gz, br] = await Promise.all([
			gzipAsync(source, { level: 9 }),
			brotliAsync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }),
		]);
		for (const [extension, bytes] of [["gz", gz], ["br", br]]) {
			// Always refresh both codecs, including small files. Delta images must
			// replace prior siblings even when the new source compresses poorly.
			fs.writeFileSync(`${file}.${extension}`, bytes);
			const modified = new Date(Math.max(Date.now(), sourceStat.mtimeMs) + 5);
			fs.utimesSync(`${file}.${extension}`, modified, modified);
		}
	}
	return inspectExport(root);
}

export async function main(argv) {
	let directory = "out";
	let compress = false;
	let report;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--compress") compress = true;
		else if (arg === "--report") {
			report = argv[++index];
			if (!report || report.startsWith("--")) throw new Error("--report needs a path");
		} else if (!arg.startsWith("-") && index === 0) directory = arg;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	const root = path.resolve(directory);
	if (report && (path.resolve(report) === root || path.resolve(report).startsWith(`${root}${path.sep}`))) {
		throw new Error("Report must be outside the packaged export");
	}
	const inventory = compress ? await prepareExport(root) : inspectExport(root);
	if (report) {
		fs.mkdirSync(path.dirname(path.resolve(report)), { recursive: true });
		fs.writeFileSync(report, `${JSON.stringify(inventory, null, 2)}\n`);
	}
	console.log(`Export verified: ${inventory.routes.length} HTML files, ${inventory.packagedFiles} packaged files, ${inventory.packagedBytes} bytes${compress ? "; gzip/Brotli prepared" : ""}`);
	if (report) console.log(`Export inventory: ${report}`);
	return inventory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main(process.argv.slice(2)).catch((error) => {
		console.error(`Export preparation failed: ${error.message}`);
		process.exitCode = 1;
	});
}
