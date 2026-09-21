const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repo = process.env.VPK_UPLOAD_TEST_ROOT ?? path.resolve(__dirname, "../../../..");
const lib = path.join(repo, ".agents/skills/vpk-deploy/scripts/deploy-lib.sh");
const digest = `sha256:${"a".repeat(64)}`;

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-image-upload-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const bin = path.join(root, "bin");
	fs.mkdirSync(bin);
	fs.mkdirSync(path.join(root, "tmp"));
	const config = JSON.stringify({ architecture: "amd64", os: "linux", rootfs: { diff_ids: [digest] }, config: { Env: ["DO_NOT_LOG=fixture-secret"] } });
	const configDigest = `sha256:${createHash("sha256").update(config).digest("hex")}`;
	fs.writeFileSync(path.join(root, "config.json"), config);
	fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify([{ Config: "config.json", Layers: ["layer.tar"] }]));
	const archive = path.join(root, "image.tar");
	assert.equal(spawnSync("tar", ["-cf", archive, "config.json", "manifest.json"], { cwd: root }).status, 0);
	const log = path.join(root, "calls.log");
	fs.writeFileSync(log, "");
	const executable = (name, body) => {
		const file = path.join(bin, name);
		fs.writeFileSync(file, `#!/bin/bash\nprintf '${name} %s\\n' "$*" >> "$CALL_LOG"\n${body}\n`);
		fs.chmodSync(file, 0o755);
	};
	executable("docker", `case "$*" in
push*) if [ "\$FAIL_DOCKER" = yes ]; then echo 'Head registry blob: EOF' >&2; exit 1; fi ;;
'image save'*)
  shift 2
  while [ "$#" -gt 0 ]; do
    if [ "$1" = --output ]; then cp "$IMAGE_ARCHIVE" "$2"; break; fi
    shift
  done ;;
esac`);
	executable("crane", `case "$1" in
push) if [ "$FAIL_CRANE" = yes ]; then echo 'host upload failed' >&2; exit 1; fi ;;
manifest) touch "$TAG_SEEN"; printf '{"config":{"digest":"%s"},"layers":[{}]}' "$CONFIG_DIGEST" ;;
digest) if [ "\${CHANGED_TAG:-no}" = yes ] && [ -f "$TAG_SEEN" ]; then printf 'sha256:${"c".repeat(64)}\\n'; else printf '%s\\n' '${digest}'; fi ;;
esac`);
	const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, VPK_CRANE_BIN: path.join(bin, "crane"), CALL_LOG: log, IMAGE_ARCHIVE: archive, CONFIG_DIGEST: configDigest, FAIL_DOCKER: "no", FAIL_CRANE: "no", TAG_SEEN: path.join(root, "tag-seen"), TMPDIR: path.join(root, "tmp") };
	const run = (via, overrides = {}) => spawnSync("/bin/bash", ["-c", 'source "$1"; vpk_push_image example-service 1.2.3 docker.atl-paas.net "$2"', "upload-test", lib, via], { cwd: root, encoding: "utf8", env: { ...env, ...overrides } });
	return { root, log, env, run, executable };
}

test("Docker EOF stops without a speculative host retry", t => {
	const f = fixture(t);
	const result = f.run("docker", { FAIL_DOCKER: "yes" });
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /EOF/u);
	assert.doesNotMatch(fs.readFileSync(f.log, "utf8"), /crane|image save/u);
});

test("selected host upload saves linux/amd64 and verifies the registry configuration", t => {
	const f = fixture(t);
	const result = f.run("crane", { FAIL_DOCKER: "yes" });
	assert.equal(result.status, 0, result.stdout + result.stderr);
	const calls = fs.readFileSync(f.log, "utf8");
	assert.match(calls, /docker image save --platform linux\/amd64/u);
	assert.doesNotMatch(calls, /docker push|buildx/u);
	const report = JSON.parse(fs.readFileSync(path.join(f.root, "output/image-upload-1.2.3.json"), "utf8"));
	assert.equal(report.digest, digest);
	assert.equal(report.immutableReference, `docker.atl-paas.net/example-service@${digest}`);
	assert.equal(report.platform, "linux/amd64");
	assert.equal(report.configDigest, f.env.CONFIG_DIGEST);
	assert.equal(report.reference, "docker.atl-paas.net/example-service:app-1.2.3");
	assert.doesNotMatch(JSON.stringify(report) + result.stdout + result.stderr, /fixture-secret/u);
	assert.deepEqual(fs.readdirSync(path.join(f.root, "tmp")), []);
});

for (const [label, env] of [
	["failed host transfer", { FAIL_CRANE: "yes" }],
	["registry configuration mismatch", { CONFIG_DIGEST: `sha256:${"b".repeat(64)}` }],
	["tag changes during verification", { CHANGED_TAG: "yes" }],
]) {
	test(`${label} cannot produce a verified upload and cleans the archive`, t => {
		const f = fixture(t);
		const result = f.run("crane", env);
		assert.notEqual(result.status, 0);
		assert.equal(fs.existsSync(path.join(f.root, "output/image-upload-1.2.3.json")), false);
		assert.deepEqual(fs.readdirSync(path.join(f.root, "tmp")), []);
		assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret/u);
	});
}

test("missing uploader and unsupported transport stop before an image is saved or pushed", t => {
	const f = fixture(t);
	for (const [via, overrides] of [["crane", { VPK_CRANE_BIN: path.join(f.root, "missing") }], ["guess", {}]]) {
		const result = f.run(via, overrides);
		assert.notEqual(result.status, 0);
	}
	assert.equal(fs.readFileSync(f.log, "utf8"), "");
});

function deployFixture(t) {
	const f = fixture(t);
	const names = ["AI_GATEWAY_URL", "AI_GATEWAY_USE_CASE_ID", "AI_GATEWAY_CLOUD_ID", "AI_GATEWAY_USER_ID", "ASAP_KID", "ASAP_ISSUER", "ASAP_PRIVATE_KEY", "OPENAI_REALTIME_MODEL", "OPENAI_REALTIME_WS_URL", "OPENAI_REALTIME_VOICE", "ALLOWED_ORIGINS", "VPK_RUNTIME_ADMIN_TOKEN"];
	const scripts = path.join(f.root, ".agents/skills/vpk-deploy/scripts");
	fs.mkdirSync(scripts, { recursive: true });
	fs.mkdirSync(path.join(f.root, "scripts"));
	for (const name of ["deploy-lib.sh", "deploy.sh", "verify-initial-theme.mjs"]) fs.copyFileSync(path.join(repo, ".agents/skills/vpk-deploy/scripts", name), path.join(scripts, name));
	fs.copyFileSync(path.join(repo, "scripts/dev-deploy-fast.sh"), path.join(f.root, "scripts/dev-deploy-fast.sh"));
	fs.writeFileSync(path.join(scripts, "deploy-check.sh"), "#!/bin/bash\nexit 0\n");
	fs.writeFileSync(path.join(f.root, "scripts/prepare-static-export.mjs"), "process.exit(0);\n");
	fs.writeFileSync(path.join(f.root, "service-descriptor.yml"), ["buildNumber: ${VERSION}", "image: docker.atl-paas.net/example-service", "tag: app-${VERSION}", ...names.map(name => `${name}: ((ssm:/example-service/${name}))`)].join("\n"));
	fs.writeFileSync(path.join(f.root, ".deploy.local"), 'SERVICE_NAME=example-service\nENV=pdev-west2\nDOCKER_USERNAME=fixture-user\nDOCKER_PASSWORD=fixture-password\n');
	f.executable("atlas", `case "$*" in
'micros --help') echo 'service stash events' ;;
*'stash list'*) printf '%s\\n' ${names.join(" ")} ;;
*'service show'*) echo '{"stacks":{}}' ;;
esac`);
	f.executable("corepack", "mkdir -p out; printf '<html></html>' > out/index.html");
	f.env.VPK_ATLAS_BIN = path.join(f.root, "bin/atlas");
	f.deploy = (script, flags, overrides = {}) => spawnSync("/bin/bash", [path.join(f.root, script), ...(script.startsWith(".agents/") ? ["example-service", "1.2.3", "pdev-west2"] : ["1.2.3"]), ...flags], { cwd: f.root, encoding: "utf8", env: { ...f.env, ...overrides } });
	return f;
}

for (const script of [".agents/skills/vpk-deploy/scripts/deploy.sh", "scripts/dev-deploy-fast.sh"]) {
	test(`${script} supports the selected host upload and stops on verification failure`, t => {
		for (const mismatch of [false, true]) {
			const f = deployFixture(t);
			const result = f.deploy(script, ["--push-via=crane"], mismatch ? { CONFIG_DIGEST: `sha256:${"b".repeat(64)}` } : {});
			assert.equal(result.status, mismatch ? 1 : 0, result.stdout + result.stderr);
			const calls = fs.readFileSync(f.log, "utf8");
			assert.doesNotMatch(calls, /docker push/u);
			if (mismatch) assert.doesNotMatch(calls, /atlas micros service deploy/u);
			else assert.match(calls, /atlas micros service deploy .*--mode=cutover/u);
		}
	});
	test(`${script} rejects invalid or missing host tooling before build or registry mutation`, t => {
		for (const [flags, overrides] of [
			[["--push-via=guess"], {}],
			[["--push-via=crane", "--push-via=docker"], {}],
			[["--push-via=crane"], { VPK_CRANE_BIN: "/missing/crane" }],
		]) {
			const f = deployFixture(t);
			const result = f.deploy(script, flags, overrides);
			assert.notEqual(result.status, 0);
			assert.doesNotMatch(fs.readFileSync(f.log, "utf8"), /corepack|docker login|buildx|crane push|service deploy/u);
		}
	});
}
