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

test("retired control-plane paths return 404 before stale static pages or app fallback", async () => {
	const publicPath = createTempPublicDir();
	try {
		writeFile(path.join(publicPath, "index.html"), "<main>App</main>");
		writeFile(path.join(publicPath, "rovo/jobs/index.html"), "<main>Stale jobs</main>");
		await withStaticServer(publicPath, async (baseUrl) => {
			for (const retired of ["/rovo/jobs", "/rovo/%6aobs", "/studio/%73kills/local/test", "/rovo/%", "/rovo/jobs/", "/studio/memories", "/rovo/skills/local/test", "/studio/settings", "/jobs", "/memories", "/settings"]) {
				const response = await fetch(`${baseUrl}${retired}`);
				assert.equal(response.status, 404, retired);
				assert.equal(await response.text(), "Not found");
			}
			for (const retained of ["/rovo", "/rovo/real-thread", "/studio", "/skills"]) {
				assert.equal((await fetch(`${baseUrl}${retained}`)).status, 200, retained);
			}
		});
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

// The Next.js static export writes `a/b.html` beside an `a/b/` directory of RSC segment files,
// and links address the page as `/a/b`. express.static alone redirects `/a/b` to the directory.
function writeExportFixture(publicPath) {
	writeFile(path.join(publicPath, "index.html"), "<main>Home</main>");
	writeFile(path.join(publicPath, "a/b.html"), "<main>Page B</main>".repeat(100));
	writeFile(path.join(publicPath, "a/b/__next._full.txt"), "segment");
	writeFile(path.join(publicPath, "a/b/__next._tree.txt"), "segment");
	writeFile(path.join(publicPath, "secret.txt"), "outside a page");
}

test("an extensionless export path serves its .html page without a redirect", async () => {
	const publicPath = createTempPublicDir();
	try {
		writeExportFixture(publicPath);
		await withStaticServer(publicPath, async (baseUrl) => {
			for (const pagePath of ["/a/b", "/a/b/", "/a/b?tab=1"]) {
				const response = await fetch(`${baseUrl}${pagePath}`, { redirect: "manual" });
				assert.equal(response.status, 200, pagePath);
				assert.match(await response.text(), /Page B/u, pagePath);
				assert.match(response.headers.get("content-type"), /text\/html/u, pagePath);
			}
			const home = await fetch(`${baseUrl}/`, { redirect: "manual" });
			assert.equal(home.status, 200);
			assert.equal(await home.text(), "<main>Home</main>");
			const segment = await fetch(`${baseUrl}/a/b/__next._full.txt`);
			assert.equal(await segment.text(), "segment", "segment files stay reachable");
		});
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

test("clean URLs keep the fallback, API 404s, retired routes and path containment", async () => {
	const publicPath = createTempPublicDir();
	try {
		writeExportFixture(publicPath);
		writeFile(path.join(publicPath, "rovo/jobs.html"), "<main>Stale jobs</main>");
		await withStaticServer(publicPath, async (baseUrl) => {
			const unknown = await fetch(`${baseUrl}/no/such/page`, { redirect: "manual" });
			assert.equal(unknown.status, 200);
			assert.equal(await unknown.text(), "<main>Home</main>", "unknown paths still get the app fallback");
			const api = await fetch(`${baseUrl}/api/unknown`);
			assert.equal(api.status, 404);
			assert.deepEqual(await api.json(), { error: "API route not found: /api/unknown" });
			assert.equal((await fetch(`${baseUrl}/rovo/jobs`)).status, 404, "retired control-plane paths still 404");
			for (const escape of ["/a/..%2F..%2Fetc%2Fpasswd", "/a%2Fb", "/..%2Fsecret", "/%2e%2e/secret"]) {
				const response = await fetch(`${baseUrl}${escape}`, { redirect: "manual" });
				assert.doesNotMatch(await response.text(), /Page B|outside a page|root:/u, escape);
			}
		});
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

test("clean URLs still use the page's precompressed variants", async () => {
	const publicPath = createTempPublicDir();
	try {
		writeExportFixture(publicPath);
		const page = path.join(publicPath, "a/b.html");
		writeFile(`${page}.br`, zlib.brotliCompressSync(fs.readFileSync(page)));
		writeFile(`${page}.gz`, zlib.gzipSync(fs.readFileSync(page)));
		await withStaticServer(publicPath, async (baseUrl) => {
			for (const [encoding, decode] of [["br", zlib.brotliDecompressSync], ["gzip", zlib.gunzipSync]]) {
				const response = await rawRequest(`${baseUrl}/a/b`, { "Accept-Encoding": encoding });
				assert.equal(response.status, 200, encoding);
				assert.equal(response.headers["content-encoding"], encoding);
				assert.match(response.headers["content-type"], /text\/html/u);
				assert.match(decode(response.body).toString(), /Page B/u);
			}
		});
	} finally {
		fs.rmSync(publicPath, { force: true, recursive: true });
	}
});

// Agent worktrees live under `.claude/worktrees/`; send() refuses an absolute path with a dot
// segment unless the file is sent relative to a root.
test("a public directory under a dot-named parent still serves the fallback and compressed pages", async () => {
	const parent = fs.mkdtempSync(path.join(os.tmpdir(), ".vpk-dot-parent-"));
	const publicPath = path.join(parent, "public");
	try {
		writeExportFixture(publicPath);
		const index = path.join(publicPath, "index.html");
		writeFile(index, "<main>Home</main>".repeat(100));
		writeFile(`${index}.gz`, zlib.gzipSync(fs.readFileSync(index)));
		await withStaticServer(publicPath, async (baseUrl) => {
			const fallback = await fetch(`${baseUrl}/no/such/page`, { headers: { "Accept-Encoding": "identity" } });
			assert.equal(fallback.status, 200);
			assert.match(await fallback.text(), /Home/u);
			assert.doesNotMatch(await (await fetch(`${baseUrl}/projects/rovo`)).text(), /VPK Service/u);
			const compressed = await rawRequest(`${baseUrl}/no/such/page`, { "Accept-Encoding": "gzip" });
			assert.equal(compressed.status, 200);
			assert.equal(compressed.headers["content-encoding"], "gzip");
			assert.match(zlib.gunzipSync(compressed.body).toString(), /Home/u);
		});
	} finally {
		fs.rmSync(parent, { force: true, recursive: true });
	}
});
