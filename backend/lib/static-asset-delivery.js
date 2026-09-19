"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

function isImmutableNextAssetPath(relative) {
	// Next export assets have content-hashed or build-scoped URLs. Fixed root
	// manifests and development assets must still revalidate.
	return relative.startsWith("_next/static/")
		&& !relative.startsWith("_next/static/development/")
		&& !/^_next\/static\/(?:_buildManifest|_ssgManifest)\.js$/u.test(relative);
}

function setStaticCacheHeaders(res, filePath, publicPath) {
	const relative = path.relative(publicPath, filePath).split(path.sep).join("/").replace(/\.(?:gz|br)$/u, "");
	const immutable = isImmutableNextAssetPath(relative);
	res.setHeader("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "public, max-age=0");
}

async function statFile(file) {
	try {
		const stat = await fs.stat(file);
		return stat.isFile() ? stat : null;
	} catch (error) {
		if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
		throw error;
	}
}

async function sendPrecompressedFile(req, res, file, publicPath) {
	if (!["GET", "HEAD"].includes(req.method) || !/\.(?:html|css|m?js|json|svg|txt|xml)$/iu.test(file)) return false;
	const original = await statFile(file);
	if (!original) return false;
	res.vary("Accept-Encoding");
	// Byte ranges refer to the original representation.
	if (req.headers.range || !req.headers["accept-encoding"]) return false;
	const variants = [];
	for (const [encoding, extension] of [["br", "br"], ["gzip", "gz"]]) {
		const sibling = `${file}.${extension}`;
		const stat = await statFile(sibling);
		if (stat && stat.size < original.size && stat.mtimeMs >= original.mtimeMs) variants.push({ encoding, sibling });
	}
	const encoding = req.acceptsEncodings(...variants.map((variant) => variant.encoding), "identity");
	if (!encoding) {
		res.sendStatus(406);
		return true;
	}
	if (encoding === "identity") return false;
	const selected = variants.find((variant) => variant.encoding === encoding);
	res.type(path.extname(file));
	res.setHeader("Content-Encoding", encoding);
	setStaticCacheHeaders(res, file, publicPath);
	try {
		await new Promise((resolve, reject) => {
			res.sendFile(selected.sibling, { cacheControl: false }, (error) => error ? reject(error) : resolve());
		});
	} catch (error) {
		if (!res.headersSent) {
			res.removeHeader("Content-Encoding");
			res.removeHeader("Cache-Control");
		}
		throw error;
	}
	return true;
}

function createPrecompressedMiddleware(publicPath) {
	const root = path.resolve(publicPath);
	return async function precompressedMiddleware(req, res, next) {
		if (req.path.startsWith("/api/")) return next();
		try {
			const decoded = decodeURIComponent(req.path);
			if (decoded.split("/").some((segment) => segment.startsWith("."))) return next();
			const file = path.resolve(root, `.${decoded.endsWith("/") ? `${decoded}index.html` : decoded}`);
			if (!file.startsWith(`${root}${path.sep}`)) return next();
			if (!await sendPrecompressedFile(req, res, file, root)) next();
		} catch (error) {
			// Let express.static handle malformed URLs with its established status.
			if (error instanceof URIError) next();
			else next(error);
		}
	};
}

module.exports = { createPrecompressedMiddleware, isImmutableNextAssetPath, sendPrecompressedFile, setStaticCacheHeaders };
