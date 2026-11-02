import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRenderService } from "./render-server.mjs";

async function fixture(runner) {
	const folder = await fs.mkdtemp(path.join(os.tmpdir(), "eu26-render-test-"));
	const root = path.join(folder, "_video");
	await fs.mkdir(path.join(root, "project", "assets"), { recursive: true });
	await fs.writeFile(path.join(root, "project", "index.html"), "<!doctype html><title>Mock composition</title>");
	await fs.writeFile(path.join(folder, "eu26-animation-explained.html"), '<html><body><script type="application/json" data-vpk-video-export>{}</script></body></html>');
	const service = await createRenderService({ root, runner });
	return { ...service, root, cleanup: async () => { await service.close(); await fs.rm(folder, { recursive: true, force: true }); } };
}

test("the served preview receives a temporary capability without writing it to disk", async () => {
	let calls = 0;
	const service = await fixture(async () => { calls++; });
	try {
		const response = await fetch(service.config.artifact);
		assert.equal(response.status, 200);
		const html = await response.text();
		const island = html.match(/<script type="application\/json" data-vpk-video-export>([\s\S]*?)<\/script>/);
		assert.deepEqual(JSON.parse(island[1]), service.config);
		const source = await fs.readFile(path.join(service.root, "..", "eu26-animation-explained.html"), "utf8");
		assert.ok(source.includes('data-vpk-video-export>{}</script>'));
		assert.equal(source.includes(service.config.token), false);
		await assert.rejects(fs.access(path.join(service.root, "render-endpoint.json")), { code: "ENOENT" });
		assert.equal(calls, 0);
	} finally { await service.cleanup(); }
});

test("startup, status and preflight stay idle; bad origins and capabilities cannot render", async () => {
	let calls = 0;
	const service = await fixture(async () => { calls++; });
	try {
		assert.equal(calls, 0);
		assert.equal((await fetch(service.config.status)).status, 200);
		const preflight = await fetch(service.config.endpoint, { method: "OPTIONS", headers: { origin: "null", "access-control-request-private-network": "true" } });
		assert.equal(preflight.status, 204);
		assert.equal(preflight.headers.get("access-control-allow-private-network"), "true");
		assert.equal((await fetch(service.config.endpoint, { method: "POST", headers: { origin: "https://unrelated.example", "x-vpk-render-key": service.config.token } })).status, 403);
		assert.equal((await fetch(service.config.endpoint, { method: "POST", body: "{}" })).status, 403);
		assert.equal(calls, 0);
	} finally { await service.cleanup(); }
});

test("invalid JSON, null, primitive, array and arbitrary path settings return 400 without rendering", async () => {
	let calls = 0;
	const service = await fixture(async () => { calls++; });
	try {
		for (const body of ["{", "null", "[]", '"paper"', "3", '{"variant":"paper","theme":"light","output":"/tmp/other.mp4"}', '{"variant":"unknown","theme":"light"}']) {
			const response = await fetch(service.config.endpoint, { method: "POST", headers: { "x-vpk-render-key": service.config.token, "content-type": "application/json", origin: "null" }, body });
			assert.equal(response.status, 400, body);
		}
		assert.equal(calls, 0);
	} finally { await service.cleanup(); }
});

test("only an authorized POST invokes the mock runner; one job at a time and capability downloads", async () => {
	let finish, calls = 0;
	const gate = new Promise(resolve => { finish = resolve; });
	const service = await fixture(async ({ project, output }) => {
		calls++;
		assert.ok(project.startsWith(path.join(service.root, "exports")));
		assert.ok(output.startsWith(path.join(service.root, "exports")));
		await gate;
		await fs.writeFile(output, "MOCK OUTPUT: no video render was performed");
	});
	try {
		const post = () => fetch(service.config.endpoint, { method: "POST", headers: { "x-vpk-render-key": service.config.token, "content-type": "application/json", origin: "null" }, body: JSON.stringify({ variant: "paper", theme: "light" }) });
		const accepted = await post(); assert.equal(accepted.status, 202);
		const job = await accepted.json();
		assert.equal((await post()).status, 409);
		for (let attempt = 0; calls === 0 && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
		assert.equal(calls, 1);
		assert.equal((await fetch(job.statusUrl.replace(/key=[^&]+/, "key=bad"))).status, 403);
		finish();
		let state;
		for (let attempt = 0; attempt < 100; attempt++) {
			state = await (await fetch(job.statusUrl)).json();
			if (state.status === "complete") break;
			await new Promise(resolve => setTimeout(resolve, 5));
		}
		assert.equal(state.status, "complete");
		const download = await fetch(state.downloadUrl);
		assert.equal(download.status, 200);
		assert.match(await download.text(), /^MOCK OUTPUT/);
		assert.equal(calls, 1);
	} finally { finish(); await service.cleanup(); }
});

test("mock runner errors become a failed job", async () => {
	const service = await fixture(async () => { throw new Error("Mock CLI unavailable"); });
	try {
		const response = await fetch(service.config.endpoint, { method: "POST", headers: { "x-vpk-render-key": service.config.token }, body: JSON.stringify({ variant: "outline", theme: "dark" }) });
		const job = await response.json();
		let state;
		for (let attempt = 0; attempt < 100; attempt++) {
			state = await (await fetch(job.statusUrl)).json();
			if (state.status === "failed") break;
			await new Promise(resolve => setTimeout(resolve, 5));
		}
		assert.equal(state.status, "failed");
		assert.match(state.error, /Mock CLI unavailable/);
	} finally { await service.cleanup(); }
});

test("an occupied listen port rejects service startup", async () => {
	const service = await fixture(async () => {});
	try {
		await assert.rejects(createRenderService({ root: service.root, port: service.server.address().port }), { code: "EADDRINUSE" });
	} finally { await service.cleanup(); }
});
