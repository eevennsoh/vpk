const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const receipts = import("./release-receipt.mjs");

async function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-release-receipt-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	for (const directory of ["app", "public", "out/_next/static", "output"]) fs.mkdirSync(path.join(root, directory), { recursive: true });
	fs.writeFileSync(path.join(root, "package.json"), '{"name":"fixture"}');
	fs.writeFileSync(path.join(root, "app/page.tsx"), "export default function Page() {}\n");
	fs.writeFileSync(path.join(root, "public/runtime.svg"), "<svg>original</svg>");
	fs.writeFileSync(path.join(root, ".env.local"), "NEXT_PUBLIC_API_URL=/api\n");
	fs.writeFileSync(path.join(root, ".deploy.local"), "DOCKER_PASSWORD=not-a-real-secret\n");
	fs.writeFileSync(path.join(root, ".vpk-source.json"), JSON.stringify({ version: 1, sourceRevision: "a".repeat(40), route: "/fixture", sourceWasDirty: false }));
	fs.writeFileSync(path.join(root, "out/index.html"), '<script src="/_next/static/app.js"></script>');
	fs.writeFileSync(path.join(root, "out/_next/static/app.js"), "const value = 1;\n".repeat(100));
	const { prepareExport } = await import("../../../../scripts/prepare-static-export.mjs");
	const inventory = await prepareExport(path.join(root, "out"));
	fs.writeFileSync(path.join(root, "output/export-inventory.json"), JSON.stringify(inventory));
	return root;
}

const options = { checks: ["install", "typecheck", "export", "inventory", "compression"], buildScript: "build:export", environment: { NEXT_PUBLIC_API_URL: "/api" } };

test("a verified prepared export can be consumed without rebuilding or exposing configuration values", async (t) => {
	const root = await fixture(t);
	const { captureBuildInputs, createReleaseReceipt, verifyReleaseReceipt } = await receipts;
	const receipt = createReleaseReceipt(root, { ...options, inputSnapshot: captureBuildInputs(root, options) });
	assert.equal(receipt.source.sourceRevision, "a".repeat(40));
	assert.equal(receipt.buildScript, "build:export");
	assert.equal(verifyReleaseReceipt(root, receipt, options).verified, true);
	assert.ok(receipt.inputs[".env.local"]);
	assert.equal(receipt.inputs[".deploy.local"], undefined);
	assert.equal(JSON.stringify(receipt).includes("not-a-real-secret"), false);
	assert.equal(JSON.stringify(receipt).includes("NEXT_PUBLIC_API_URL=/api"), false);
});

for (const relative of ["app/page.tsx", "package.json", "public/runtime.svg", ".env.local", "out/index.html", "out/_next/static/app.js.br", "output/export-inventory.json"]) {
	test(`a changed ${relative} invalidates a receipt`, async (t) => {
		const root = await fixture(t);
		const { captureBuildInputs, createReleaseReceipt, verifyReleaseReceipt } = await receipts;
		const receipt = createReleaseReceipt(root, { ...options, inputSnapshot: captureBuildInputs(root, options) });
		fs.appendFileSync(path.join(root, relative), "later edit");
		assert.throws(() => verifyReleaseReceipt(root, receipt, options), /changed|invalid|inventory/u);
	});
}

test("new and deleted build inputs invalidate a receipt while generated caches do not", async (t) => {
	const root = await fixture(t);
	const { captureBuildInputs, createReleaseReceipt, verifyReleaseReceipt } = await receipts;
	const receipt = createReleaseReceipt(root, { ...options, inputSnapshot: captureBuildInputs(root, options) });
	fs.writeFileSync(path.join(root, "tsconfig.tsbuildinfo"), "cache");
	fs.writeFileSync(path.join(root, "next-env.d.ts"), "dev types");
	assert.equal(verifyReleaseReceipt(root, receipt, options).verified, true);
	fs.writeFileSync(path.join(root, "app/new.ts"), "new source");
	assert.throws(() => verifyReleaseReceipt(root, receipt, options), /changed/u);
	fs.unlinkSync(path.join(root, "app/new.ts"));
	fs.unlinkSync(path.join(root, "public/runtime.svg"));
	assert.throws(() => verifyReleaseReceipt(root, receipt, options), /changed/u);
});

test("target identity, build environment, validation gates, and schema are required", async (t) => {
	const root = await fixture(t);
	const { captureBuildInputs, createReleaseReceipt, verifyReleaseReceipt } = await receipts;
	const receipt = createReleaseReceipt(root, { ...options, inputSnapshot: captureBuildInputs(root, options) });
	assert.throws(() => createReleaseReceipt(root, { ...options, checks: ["export"] }), /checks/u);
	assert.throws(() => verifyReleaseReceipt(root, { ...receipt, version: 999 }, options), /receipt/u);
	assert.throws(() => verifyReleaseReceipt(root, { ...receipt, version: 1 }, options), /receipt/u);
	assert.throws(() => verifyReleaseReceipt(root, { ...receipt, target: path.dirname(root) }, options), /target/u);
	assert.throws(() => verifyReleaseReceipt(root, receipt, { environment: { NEXT_PUBLIC_API_URL: "/other" } }), /environment/u);
});

test("symlinked source or export bytes cannot bypass input comparison", async (t) => {
	const root = await fixture(t);
	const { captureBuildInputs, createReleaseReceipt, verifyReleaseReceipt } = await receipts;
	const receipt = createReleaseReceipt(root, { ...options, inputSnapshot: captureBuildInputs(root, options) });
	fs.symlinkSync(path.join(root, "app/page.tsx"), path.join(root, "app/alias.tsx"));
	assert.throws(() => verifyReleaseReceipt(root, receipt, options), /symlink/u);
});


for (const stale of [false, true]) {
	test(`deploying a prepared receipt ${stale ? "rejects changed inputs before mutation" : "does not rebuild the export"}`, async (t) => {
		const root = await fixture(t);
		const scripts = path.join(root, ".agents/skills/vpk-deploy/scripts");
		const bin = path.join(root, "fake-bin");
		fs.mkdirSync(scripts, { recursive: true }); fs.mkdirSync(bin);
		for (const name of ["deploy-lib.sh", "release-receipt.mjs", "verify-initial-theme.mjs", "deploy.sh"]) fs.copyFileSync(path.join(__dirname, name), path.join(scripts, name));
		fs.writeFileSync(path.join(scripts, "deploy-check.sh"), "#!/bin/bash\nexit 0\n");
		const names = ["AI_GATEWAY_URL", "AI_GATEWAY_USE_CASE_ID", "AI_GATEWAY_CLOUD_ID", "AI_GATEWAY_USER_ID", "ASAP_KID", "ASAP_ISSUER", "ASAP_PRIVATE_KEY", "OPENAI_REALTIME_MODEL", "OPENAI_REALTIME_WS_URL", "OPENAI_REALTIME_VOICE", "ALLOWED_ORIGINS", "VPK_RUNTIME_ADMIN_TOKEN"];
		fs.writeFileSync(path.join(root, "service-descriptor.yml"), ["buildNumber: ${VERSION}","image: docker.atl-paas.net/example-service", "tag: app-${VERSION}", ...names.map(name => `${name}: ((ssm:/example-service/${name}))`)].join("\n"));
		for (const [name, body] of Object.entries({
			atlas: `#!/bin/bash\nprintf 'atlas %s\\n' "$*" >> "$CALL_LOG"\ncase "$*" in\n'micros --help') echo 'service stash events';;\n*'stash list'*) printf '%s\\n' ${names.join(" ")};;\n*'service show'*) echo '{"stacks":{}}';;\nesac\n`,
			docker: '#!/bin/bash\nprintf "docker %s\\n" "$*" >> "$CALL_LOG"\n',
			corepack: '#!/bin/bash\necho BUILD >> "$CALL_LOG"\n',
		})) { fs.writeFileSync(path.join(bin, name), body); fs.chmodSync(path.join(bin, name), 0o755); }
		const { captureBuildInputs, createReleaseReceipt } = await receipts;
		const receipt = createReleaseReceipt(root, { ...options, environment: process.env, inputSnapshot: captureBuildInputs(root) });
		fs.writeFileSync(path.join(root, "output/release-receipt.json"), JSON.stringify(receipt));
		if (stale) fs.appendFileSync(path.join(root, "app/page.tsx"), "changed");
		const log = path.join(root, "output/calls.log"); fs.writeFileSync(log, "");
		const result = spawnSync("bash", [path.join(scripts, "deploy.sh"), "example-service", "1.0.0", "pdev-west2", "--receipt", "output/release-receipt.json"], { cwd: root, encoding: "utf8", env: { ...process.env, VPK_ATLAS_BIN: path.join(bin, "atlas"), PATH: `${bin}:${process.env.PATH}`, CALL_LOG: log } });
		const calls = fs.readFileSync(log, "utf8");
		assert.equal(result.status, stale ? 2 : 0, result.stdout + result.stderr);
		assert.doesNotMatch(calls, /BUILD/u);
		if (stale) assert.equal(calls, "");
		else assert.match(calls, /service deploy .*--mode=cutover/u);
	});
}


test("malformed receipt and source metadata errors exclude configuration contents", async t => {
	const root = await fixture(t);
	const { main, captureBuildInputs, createReleaseReceipt } = await receipts;
	const malformed = path.join(root, "output/malformed.json");
	fs.writeFileSync(malformed, '{"configuration":"fixture-secret" invalid}');
	assert.throws(() => main(["verify", "--target", root, "--receipt", malformed]), error => error.message === "Invalid release receipt JSON");
	fs.copyFileSync(malformed, path.join(root, ".vpk-source.json"));
	assert.throws(() => createReleaseReceipt(root, { ...options, inputSnapshot: captureBuildInputs(root, options) }), error => error.message === "Invalid extraction source metadata JSON");
});


for (const relative of ["public/README.md", "public/artifacts/runtime.svg", "public/node_modules/runtime.svg"]) {
	test(`nested ${relative} remains a build input`, async t => {
		const root = await fixture(t);
		fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
		fs.writeFileSync(path.join(root, relative), "asset source");
		const { captureBuildInputs, createReleaseReceipt, verifyReleaseReceipt } = await receipts;
		const receipt = createReleaseReceipt(root, { ...options, inputSnapshot: captureBuildInputs(root, options) });
		assert.ok(receipt.inputs[relative]);
		fs.appendFileSync(path.join(root, relative), "changed");
		assert.throws(() => verifyReleaseReceipt(root, receipt, options), /changed/u);
	});
}

test("receipt object key ordering does not change verified fingerprints", async t => {
	const root = await fixture(t);
	const { captureBuildInputs, createReleaseReceipt, verifyReleaseReceipt } = await receipts;
	const receipt = createReleaseReceipt(root, { ...options, inputSnapshot: captureBuildInputs(root, options) });
	const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, reorder(value[key])])) : value;
	assert.equal(verifyReleaseReceipt(root, reorder(receipt), options).verified, true);
});
