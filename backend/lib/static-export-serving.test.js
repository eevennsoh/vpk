"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const express = require("express");
const zlib = require("node:zlib");

const {
	FALLBACK_HTML,
	buildPreloadLinkHeader,
	registerStaticExportServing,
} = require("./static-export-serving");

function createTempPublicDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "vpk-static-export-"));
}

function writeFile(filePath, content) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content);
}

function rawRequest(url, headers = {}, method = "GET") {
	return new Promise((resolve, reject) => {
		http.get(url, { headers, method }, (response) => {
			const chunks = [];
			response.on("data", (chunk) => chunks.push(chunk));
			response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
			response.on("error", reject);
		}).on("error", reject);
	});
}

test("static delivery negotiates codecs, preserves MIME and identity, and caches generated assets", async () => {
	const publicPath = createTempPublicDir();
	try {
		const file = path.join(publicPath, "_next/static/chunks/1adyte5j1ox7c.js");
		const content = "const repeated = 123;\n".repeat(100);
		writeFile(file, content);
		writeFile(`${file}.gz`, zlib.gzipSync(content));
		writeFile(`${file}.br`, zlib.brotliCompressSync(content));
		await withStaticServer(publicPath, async (baseUrl) => {
			const url = `${baseUrl}/_next/static/chunks/1adyte5j1ox7c.js`;
			const br = await rawRequest(url, { "Accept-Encoding": "br, gzip" });
			assert.equal(br.headers["content-encoding"], "br");
			assert.match(br.headers["content-type"], /javascript/u);
			assert.match(br.headers["cache-control"], /max-age=31536000, immutable/u);
			assert.match(br.headers.vary, /Accept-Encoding/u);
			assert.equal(zlib.brotliDecompressSync(br.body).toString(), content);
			const gz = await rawRequest(url, { "Accept-Encoding": "br;q=0,gzip;q=1" });
			assert.equal(gz.headers["content-encoding"], "gzip");
			assert.equal(zlib.gunzipSync(gz.body).toString(), content);
			const identity = await rawRequest(url, { "Accept-Encoding": "identity" });
			assert.equal(identity.headers["content-encoding"], undefined);
			assert.equal(identity.body.toString(), content);
			const range = await rawRequest(url, { "Accept-Encoding": "br", Range: "bytes=0-4" });
			assert.equal(range.status, 206);
			assert.equal(range.body.toString(), content.slice(0, 5));
			const head = await rawRequest(url, { "Accept-Encoding": "br" }, "HEAD");
			assert.equal(head.headers["content-encoding"], "br");
			assert.equal(head.body.length, 0);
			const denied = await rawRequest(url, { "Accept-Encoding": "br;q=0,gzip;q=0,identity;q=0" });
			assert.equal(denied.status, 406);
		});
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

test("compressed HTML fallback revalidates and stale siblings never replace newer source", async () => {
	const publicPath = createTempPublicDir();
	try {
		const file = path.join(publicPath, "index.html");
		const content = "<main>Fresh content</main>".repeat(100);
		writeFile(file, content);
		writeFile(`${file}.gz`, zlib.gzipSync(content));
		await withStaticServer(publicPath, async (baseUrl) => {
			const response = await rawRequest(`${baseUrl}/projects/rovo`, { "Accept-Encoding": "gzip" });
			assert.equal(response.headers["content-encoding"], "gzip");
			assert.equal(response.headers["cache-control"], "public, max-age=0");
			assert.equal(zlib.gunzipSync(response.body).toString(), content);
			fs.utimesSync(`${file}.gz`, new Date(0), new Date(0));
			const fresh = await rawRequest(baseUrl, { "Accept-Encoding": "gzip" });
			assert.equal(fresh.headers["content-encoding"], undefined);
			assert.equal(fresh.body.toString(), content);
		});
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

test("all identity fallback HTML representations explicitly revalidate", async () => {
	const publicPath = createTempPublicDir();
	try {
		const file = path.join(publicPath, "index.html");
		writeFile(file, "<main>Fresh content</main>".repeat(100));
		writeFile(`${file}.gz`, zlib.gzipSync(fs.readFileSync(file)));
		fs.utimesSync(`${file}.gz`, new Date(0), new Date(0));
		await withStaticServer(publicPath, async (baseUrl) => {
			for (const headers of [{}, { "Accept-Encoding": "identity" }, { "Accept-Encoding": "gzip" }, { Range: "bytes=0-4" }]) {
				const response = await rawRequest(`${baseUrl}/projects/rovo`, headers);
				assert.equal(response.headers["content-encoding"], undefined);
				assert.equal(response.headers["cache-control"], "public, max-age=0");
			}
		});
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

async function withStaticServer(publicPath, run) {
	const app = express();
	registerStaticExportServing(app, {
		expressImpl: express,
		logger: { log() {}, warn() {} },
		publicPath,
	});

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await run(baseUrl);
	} finally {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
}

test("buildPreloadLinkHeader selects the largest CSS and chunk JS assets", () => {
	const publicPath = createTempPublicDir();
	try {
		writeFile(path.join(publicPath, "_next/static/a-small.css"), "a");
		writeFile(path.join(publicPath, "_next/static/b-large.css"), "bbbb");
		writeFile(path.join(publicPath, "_next/static/root-large.js"), "rrrrrrrr");
		writeFile(path.join(publicPath, "_next/static/chunks/chunk-small.js"), "c");
		writeFile(path.join(publicPath, "_next/static/chunks/chunk-large.js"), "cccccc");

		assert.equal(
			buildPreloadLinkHeader({
				logger: { warn() {} },
				publicPath,
			}),
			"</_next/static/b-large.css>; rel=preload; as=style, </_next/static/chunks/chunk-large.js>; rel=preload; as=script; crossorigin",
		);
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

test("buildPreloadLinkHeader returns empty when static export chunks are absent", () => {
	const publicPath = createTempPublicDir();
	try {
		assert.equal(
			buildPreloadLinkHeader({
				logger: { warn() {} },
				publicPath,
			}),
			"",
		);
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

test("static export fallback returns JSON for unmatched API routes", async () => {
	const publicPath = createTempPublicDir();
	try {
		await withStaticServer(publicPath, async (baseUrl) => {
			const response = await fetch(`${baseUrl}/api/not-real`);

			assert.equal(response.status, 404);
			assert.equal(response.headers.get("link"), null);
			assert.deepEqual(await response.json(), {
				error: "API route not found: /api/not-real",
			});
		});
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

test("static export fallback serves index.html with preload links for app routes", async () => {
	const publicPath = createTempPublicDir();
	try {
		writeFile(path.join(publicPath, "index.html"), "<main>App shell</main>");
		writeFile(path.join(publicPath, "_next/static/app.css"), "cccc");
		writeFile(path.join(publicPath, "_next/static/chunks/app.js"), "jjjj");

		await withStaticServer(publicPath, async (baseUrl) => {
			const response = await fetch(`${baseUrl}/projects/rovo`);

			assert.equal(response.status, 200);
			assert.equal(await response.text(), "<main>App shell</main>");
			assert.equal(
				response.headers.get("link"),
				"</_next/static/app.css>; rel=preload; as=style, </_next/static/chunks/app.js>; rel=preload; as=script; crossorigin",
			);
		});
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

test("static export fallback preserves service HTML when index.html is missing", async () => {
	const publicPath = createTempPublicDir();
	try {
		await withStaticServer(publicPath, async (baseUrl) => {
			const response = await fetch(`${baseUrl}/projects/rovo`);

			assert.equal(response.status, 200);
			assert.equal(await response.text(), FALLBACK_HTML);
		});
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

test("registerStaticExportServing validates required dependencies", () => {
	assert.throws(() => registerStaticExportServing(), /app.use/u);
	assert.throws(() => registerStaticExportServing({
		get() {},
		use() {},
	}, {
		publicPath: "/tmp/public",
	}), /expressImpl.static/u);
	assert.throws(() => registerStaticExportServing({
		get() {},
		use() {},
	}, {
		expressImpl: express,
	}), /publicPath/u);
});
