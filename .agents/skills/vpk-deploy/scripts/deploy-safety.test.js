const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
	chmodSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const REQUIRED_STASHES = [
	"AI_GATEWAY_URL",
	"AI_GATEWAY_USE_CASE_ID",
	"AI_GATEWAY_CLOUD_ID",
	"AI_GATEWAY_USER_ID",
	"ASAP_KID",
	"ASAP_ISSUER",
	"ASAP_PRIVATE_KEY",
	"OPENAI_REALTIME_MODEL",
	"OPENAI_REALTIME_WS_URL",
	"OPENAI_REALTIME_VOICE",
	"ALLOWED_ORIGINS",
	"VPK_RUNTIME_ADMIN_TOKEN",
];

function writeExecutable(filePath, source) {
	writeFileSync(filePath, source);
	chmodSync(filePath, 0o755);
}

function descriptorFor(serviceName, extraSsmService) {
	const environment = REQUIRED_STASHES.map(
		(name) => `      ${name}: ((ssm:/${serviceName}/${name}))`,
	).join("\n");

	return [
		'description: "VPK Service"',
		"buildNumber: ${VERSION}",
		"compose:",
		"  app:",
		`    image: docker.atl-paas.net/${serviceName}`,
		"    tag: app-${VERSION}",
		"    environment:",
		environment,
		'      PORT: "8080"',
		extraSsmService ? `      EXTRA_SHARED_VALUE: ((ssm:/${extraSsmService}/EXTRA_SHARED_VALUE))` : "",
		"",
	].join("\n");
}

function createFixture(options = {}) {
	const root = mkdtempSync(path.join(os.tmpdir(), "vpk-deploy-safety-"));
	const skillScripts = path.join(root, ".agents/skills/vpk-deploy/scripts");
	const scripts = path.join(root, "scripts");
	const fakeBin = path.join(root, "fake-bin");
	mkdirSync(skillScripts, { recursive: true });
	mkdirSync(scripts, { recursive: true });
	mkdirSync(path.join(root, "backend"), { recursive: true });
	mkdirSync(fakeBin, { recursive: true });

	for (const relativePath of [
		".agents/skills/vpk-deploy/scripts/deploy.sh",
		".agents/skills/vpk-deploy/scripts/verify-initial-theme.mjs",
		"scripts/dev-deploy-fast.sh",
		"scripts/prepare-static-export.mjs",
	]) {
		cpSync(path.join(REPO_ROOT, relativePath), path.join(root, relativePath));
	}

	const deployLib = path.join(REPO_ROOT, ".agents/skills/vpk-deploy/scripts/deploy-lib.sh");
	try {
		cpSync(deployLib, path.join(skillScripts, "deploy-lib.sh"));
	} catch (error) {
		if (error.code !== "ENOENT") {
			throw error;
		}
	}

	writeExecutable(
		path.join(skillScripts, "deploy-check.sh"),
		"#!/bin/bash\nexit 0\n",
	);
	writeFileSync(
		path.join(root, "service-descriptor.yml"),
		descriptorFor(options.descriptorService || "example-service", options.extraSsmService),
	);
	writeFileSync(path.join(root, "backend/Dockerfile"), "FROM scratch\n");
	writeFileSync(
		path.join(root, ".deploy.local"),
		[
			'SERVICE_NAME="example-service"',
			'ENV="pdev-west2"',
			'DOCKER_USERNAME="fixture-user"',
			'DOCKER_PASSWORD="fixture-password"',
			"",
		].join("\n"),
	);

	const logPath = path.join(root, "calls.log");
	const stashPath = path.join(root, "stashes.txt");
	writeFileSync(stashPath, (options.stashes || REQUIRED_STASHES).join("\n") + "\n");
	writeFileSync(logPath, "");

	writeExecutable(
		path.join(fakeBin, "atlas"),
		[
			"#!/bin/bash",
			'printf \'atlas %s\\n\' "$*" >> "$FAKE_CALL_LOG"',
			'if [ "${1:-}" = "micros" ] && [ "${2:-}" = "--help" ]; then',
			'  if [ "${FAKE_WRONG_ATLAS:-no}" = "yes" ]; then exit 1; fi',
			'  if [ "${FAKE_HELP_STDERR:-no}" = "yes" ]; then',
			"    printf 'service stash events\\n' >&2",
			"  else",
			"    printf 'service stash events\\n'",
			"  fi",
			"  exit 0",
			"fi",
			'if [ "${1:-}" = "micros" ] && [ "${2:-}" = "service" ] && [ "${3:-}" = "show" ]; then',
			'  if [ "${FAKE_SERVICE_EXISTS:-yes}" = "yes" ]; then',
			'    printf \'{"stacks":{}}\\n\'',
			"    exit 0",
			"  fi",
			"  exit 1",
			"fi",
			'if [ "${1:-}" = "micros" ] && [ "${2:-}" = "stash" ] && [ "${3:-}" = "list" ]; then',
			'  cat "$FAKE_STASH_FILE"',
			"fi",
			"exit 0",
			"",
		].join("\n"),
	);

	writeExecutable(
		path.join(fakeBin, "docker"),
		[
			"#!/bin/bash",
			'printf \'docker %s\\n\' "$*" >> "$FAKE_CALL_LOG"',
			"exit 0",
			"",
		].join("\n"),
	);

	writeExecutable(
		path.join(fakeBin, "corepack"),
		[
			"#!/bin/bash",
			'printf \'corepack %s\\n\' "$*" >> "$FAKE_CALL_LOG"',
			"mkdir -p out",
			": > out/index.html",
			'if [ "${FAKE_UNSTYLED_EXPORT:-no}" = "yes" ]; then',
			'  printf \'<html data-color-mode="light"><head><style data-theme="spacing">:root{--ds-space-200:1rem}</style></head></html>\' > out/index.html',
			"fi",
			"exit 0",
			"",
		].join("\n"),
	);

	writeExecutable(
		path.join(fakeBin, "date"),
		"#!/bin/bash\nprintf '20260824T010203Z\\n'\n",
	);

	return { fakeBin, logPath, root, stashPath };
}

function runFixture(fixture, scriptPath, args = [], options = {}) {
	const env = {
		FAKE_CALL_LOG: fixture.logPath,
		FAKE_SERVICE_EXISTS: options.serviceExists === false ? "no" : "yes",
		FAKE_STASH_FILE: fixture.stashPath,
		FAKE_WRONG_ATLAS: options.wrongAtlas ? "yes" : "no",
		FAKE_HELP_STDERR: options.helpStderr ? "yes" : "no",
		FAKE_UNSTYLED_EXPORT: options.unstyledExport ? "yes" : "no",
		VPK_DOCKER_NO_CACHE: options.noCache ? "1" : "0",
		VPK_ATLAS_BIN: path.join(fixture.fakeBin, "atlas"),
		PATH: `${fixture.fakeBin}${path.delimiter}${process.env.PATH || "/usr/bin:/bin"}`,
	};
	if (options.home !== undefined) {
		env.HOME = options.home;
	}

	return spawnSync("/bin/bash", [scriptPath, ...args], {
		cwd: fixture.root,
		encoding: "utf8",
		env,
	});
}

function callsFor(fixture) {
	return readFileSync(fixture.logPath, "utf8");
}

function assertNoMutationCalls(calls) {
	assert.doesNotMatch(calls, /atlas packages permission grant/u);
	assert.doesNotMatch(calls, /docker login/u);
	assert.doesNotMatch(calls, /docker buildx/u);
	assert.doesNotMatch(calls, /docker push/u);
	assert.doesNotMatch(calls, /atlas micros service deploy/u);
}

for (const noCache of [false, true]) {
	test(`runtime Docker builds ${noCache ? "honor an explicit clean rebuild" : "reuse cache by default"}`, () => {
		withFixture({}, (fixture) => {
			const result = runFixture(fixture, "scripts/dev-deploy-fast.sh", ["1.0.1"], { home: "", noCache });
			assert.equal(result.status, 0, result.stdout + result.stderr);
			const build = callsFor(fixture).split("\n").find((line) => line.startsWith("docker buildx build"));
			assert.match(build, /--platform linux\/amd64/u);
			assert.equal(build.includes("--no-cache"), noCache);
			assert.equal(build.includes("--pull"), noCache);
		});
	});
}

function withFixture(options, callback) {
	const fixture = createFixture(options);
	try {
		callback(fixture);
	} finally {
		rmSync(fixture.root, { recursive: true, force: true });
	}
}

test("manual identity and stash guards also work when sourced from zsh", { skip: !existsSync("/bin/zsh") }, () => {
	withFixture({}, (fixture) => {
		const result = spawnSync("/bin/zsh", ["-c",
			"set -e; source .agents/skills/vpk-deploy/scripts/deploy-lib.sh; " +
			"vpk_validate_descriptor_identity example-service; " +
			"vpk_require_service_and_stashes example-service pdev-west2",
		], {
			cwd: fixture.root,
			encoding: "utf8",
			env: {
				...process.env,
				VPK_ATLAS_BIN: path.join(fixture.fakeBin, "atlas"),
				FAKE_CALL_LOG: fixture.logPath,
				FAKE_STASH_FILE: fixture.stashPath,
			},
		});
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.match(result.stdout, /all required stashes are present/u);
	});
	withFixture({ extraSsmService: "foreign-service" }, (fixture) => {
		const result = spawnSync("/bin/zsh", ["-c",
			"set -e; source .agents/skills/vpk-deploy/scripts/deploy-lib.sh; " +
			"vpk_validate_descriptor_identity example-service",
		], { cwd: fixture.root, encoding: "utf8" });
		assert.notEqual(result.status, 0);
		assert.match(result.stdout, /foreign SSM service prefix/u);
	});
});

test("canonical deploy accepts an existing service with no stack yet", () => {
	withFixture({}, (fixture) => {
		const result = runFixture(
			fixture,
			".agents/skills/vpk-deploy/scripts/deploy.sh",
			["example-service", "1.2.3", "pdev-west2"],
			{ home: "" },
		);

		assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
		assert.match(callsFor(fixture), /atlas micros service deploy/u);
	});
});

test("both deploy paths recognize Micros help written to stderr", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2"]],
		["scripts/dev-deploy-fast.sh", ["1.2.3"]],
	]) {
		withFixture({}, (fixture) => {
			const result = runFixture(fixture, scriptPath, args, { helpStderr: true });
			assert.equal(result.status, 0, result.stdout + result.stderr);
			assert.match(callsFor(fixture), /atlas micros service deploy/u);
		});
	}
});

test("both deploy paths reject descriptor identity drift before mutation", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2"]],
		["scripts/dev-deploy-fast.sh", ["1.2.3"]],
	]) {
		withFixture({ descriptorService: "different-service" }, (fixture) => {
			const result = runFixture(fixture, scriptPath, args, { home: "" });

			assert.notEqual(result.status, 0, `${scriptPath} should reject descriptor drift`);
			assert.match(`${result.stdout}\n${result.stderr}`, /descriptor.*example-service/iu);
			assertNoMutationCalls(callsFor(fixture));
		});
	}
});

test("both deploy paths reject any foreign descriptor SSM prefix before mutation", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2"]],
		["scripts/dev-deploy-fast.sh", ["1.2.3"]],
	]) {
		withFixture({ extraSsmService: "other-service" }, (fixture) => {
			const result = runFixture(fixture, scriptPath, args, { home: "" });

			assert.notEqual(result.status, 0, `${scriptPath} should reject a foreign SSM prefix`);
			assert.match(`${result.stdout}\n${result.stderr}`, /foreign SSM service prefix.*other-service/iu);
			assertNoMutationCalls(callsFor(fixture));
		});
	}
});

test("Dockerfile lets Corepack honor the packageManager pnpm version", () => {
	const dockerfile = readFileSync(path.join(REPO_ROOT, "backend/Dockerfile"), "utf8");
	const packageJson = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
	const pinnedVersion = packageJson.packageManager?.match(/^pnpm@([^+]+)/u)?.[1];
	const preparedVersion = dockerfile.match(/corepack prepare pnpm@([^\s]+) --activate/u)?.[1];

	assert.ok(pinnedVersion, "package.json must pin pnpm through packageManager");
	assert.equal(
		preparedVersion ?? pinnedVersion,
		pinnedVersion,
		`Dockerfile prepares pnpm ${preparedVersion} but package.json pins ${pinnedVersion}`,
	);
	assert.match(dockerfile, /\bcorepack enable\b/u);
	assert.doesNotMatch(
		dockerfile,
		/corepack prepare pnpm@/u,
		"Dockerfile must not override the packageManager pin",
	);
});

test("Dockerfile combines tracked registry routing with an optional user auth secret", () => {
	const dockerfile = readFileSync(path.join(REPO_ROOT, "backend/Dockerfile"), "utf8");
	const projectNpmrc = readFileSync(path.join(REPO_ROOT, ".npmrc"), "utf8");

	assert.match(dockerfile, /^# syntax=docker\/dockerfile:/u);
	assert.match(projectNpmrc, /^registry=https:\/\/registry\.npmjs\.org\/$/mu);
	assert.match(
		projectNpmrc,
		/^@atlassian:registry=https:\/\/packages\.atlassian\.com\/artifactory\/api\/npm\/atlassian-npm\/$/mu,
	);
	assert.doesNotMatch(
		projectNpmrc,
		/(?:_auth(?:Token)?|_password|password|token|username)\s*=/iu,
		"tracked registry routing must remain credential-free before Docker copies it",
	);
	assert.match(
		dockerfile,
		/^COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml \.npmrc \.\/$/mu,
		"Dockerfile must copy the tracked token-free registry routing",
	);
	assert.match(
		dockerfile,
		/RUN --mount=type=secret,id=npmrc,[^\n]*required=false[^\n]*\\?\n(?:.*\n)*?\s*pnpm install --prod/u,
	);
	assert.ok(
		dockerfile.indexOf("COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./") <
			dockerfile.indexOf("RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false"),
		"tracked routing must be present before the auth-only secret mount is consumed",
	);
});

test("both deploy paths work under macOS Bash 3 when HOME is unset", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2"]],
		["scripts/dev-deploy-fast.sh", ["1.2.3"]],
	]) {
		withFixture({}, (fixture) => {
			const result = runFixture(fixture, scriptPath, args);
			assert.equal(result.status, 0, `${scriptPath}: ${result.stdout}\n${result.stderr}`);
			assert.doesNotMatch(callsFor(fixture), /--secret/u);
		});
	}
});

test("canonical deploy requires an explicit tag-valid version", () => {
	withFixture({}, (fixture) => {
		const missing = runFixture(
			fixture,
			".agents/skills/vpk-deploy/scripts/deploy.sh",
			["example-service"],
			{ home: "" },
		);
		assert.notEqual(missing.status, 0);
		assert.match(`${missing.stdout}\n${missing.stderr}`, /version.*required/iu);
		assertNoMutationCalls(callsFor(fixture));
	});

	withFixture({}, (fixture) => {
		const invalid = runFixture(
			fixture,
			".agents/skills/vpk-deploy/scripts/deploy.sh",
			["example-service", "release/latest", "pdev-west2"],
			{ home: "" },
		);
		assert.notEqual(invalid.status, 0);
		assert.match(`${invalid.stdout}\n${invalid.stderr}`, /invalid.*version/iu);
		assertNoMutationCalls(callsFor(fixture));
	});
});

test("fast deploy auto-versions are collision-safe and Docker-tag-valid", () => {
	const versions = [];
	for (let index = 0; index < 2; index += 1) {
		withFixture({}, (fixture) => {
			const result = runFixture(fixture, "scripts/dev-deploy-fast.sh", [], { home: "" });
			assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
			const match = callsFor(fixture).match(/docker buildx .*:app-([^\s]+) /u);
			assert.ok(match, callsFor(fixture));
			versions.push(match[1]);
		});
	}

	assert.notEqual(versions[0], versions[1]);
	for (const version of versions) {
		assert.match(`app-${version}`, /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/u);
	}
});

test("fast deploy verifies service existence before registry authentication", () => {
	withFixture({}, (fixture) => {
		const result = runFixture(fixture, "scripts/dev-deploy-fast.sh", ["1.2.3"], {
			home: "",
			serviceExists: false,
		});

		assert.notEqual(result.status, 0);
		assert.match(`${result.stdout}\n${result.stderr}`, /service.*does not exist/iu);
		assertNoMutationCalls(callsFor(fixture));
	});
});

test("canonical deploy verifies remote prerequisites before building or mutating", () => {
	for (const [fixtureOptions, runOptions, expectedDiagnostic] of [
		[{}, { serviceExists: false }, /service.*does not exist/iu],
		[{ stashes: REQUIRED_STASHES.slice(0, -1) }, {}, /VPK_RUNTIME_ADMIN_TOKEN/u],
	]) {
		withFixture(fixtureOptions, (fixture) => {
			const result = runFixture(
				fixture,
				".agents/skills/vpk-deploy/scripts/deploy.sh",
				["example-service", "1.2.3", "pdev-west2"],
				{ home: "", ...runOptions },
			);

			assert.notEqual(result.status, 0);
			assert.match(`${result.stdout}\n${result.stderr}`, expectedDiagnostic);
			assert.doesNotMatch(callsFor(fixture), /corepack pnpm run build:export/u);
			assertNoMutationCalls(callsFor(fixture));
		});
	}
});

test("fast deploy verifies every required stash before registry authentication", () => {
	withFixture({ stashes: REQUIRED_STASHES.slice(0, -1) }, (fixture) => {
		const result = runFixture(fixture, "scripts/dev-deploy-fast.sh", ["1.2.3"], {
			home: "",
		});

		assert.notEqual(result.status, 0);
		assert.match(`${result.stdout}\n${result.stderr}`, /VPK_RUNTIME_ADMIN_TOKEN/u);
		assertNoMutationCalls(callsFor(fixture));
	});
});

test("script diagnostics point to the live deployment guide", () => {
	const canonicalScript = readFileSync(
		path.join(REPO_ROOT, ".agents/skills/vpk-deploy/scripts/deploy.sh"),
		"utf8",
	);
	assert.match(
		canonicalScript,
		/\.agents\/skills\/vpk-deploy\/references\/guide-deployment\.md/u,
	);
	assert.doesNotMatch(canonicalScript, /(^|\s)references\/guide-/u);
});

test("both deploy paths reject an explicitly selected non-Atlassian CLI before building", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2"]],
		["scripts/dev-deploy-fast.sh", ["1.2.3"]],
	]) {
		withFixture({}, (fixture) => {
			const result = runFixture(fixture, scriptPath, args, { wrongAtlas: true });
			assert.notEqual(result.status, 0);
			assert.match(result.stdout + result.stderr, /Atlassian CLI/iu);
			assert.doesNotMatch(callsFor(fixture), /corepack pnpm run build:export/u);
			assertNoMutationCalls(callsFor(fixture));
		});
	}
});

test("both deploy paths support explicit hot-swap image deployments", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2", "--hot-swap"]],
		["scripts/dev-deploy-fast.sh", ["1.2.3", "--hot-swap"]],
	]) {
		withFixture({}, (fixture) => {
			const result = runFixture(fixture, scriptPath, args);
			assert.equal(result.status, 0, result.stdout + result.stderr);
			assert.match(callsFor(fixture), /atlas micros service deploy .*--mode=hot-swap/u);
			assert.match(callsFor(fixture), /docker push .*:app-1\.2\.3/u);
		});
	}
});

for (const [label, flags, mode] of [
	["default", [], "cutover"],
	["explicit cutover", ["--mode=cutover"], "cutover"],
	["explicit hot swap", ["--mode=hot-swap"], "hot-swap"],
]) {
	test(`both deploy paths pass an explicit ${mode} mode for ${label} selection`, () => {
		for (const [scriptPath, args] of [
			[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2", ...flags]],
			["scripts/dev-deploy-fast.sh", ["1.2.3", ...flags]],
		]) {
			withFixture({}, (fixture) => {
				const result = runFixture(fixture, scriptPath, args);
				assert.equal(result.status, 0, result.stdout + result.stderr);
				const command = callsFor(fixture).split("\n").find((line) => line.startsWith("atlas micros service deploy "));
				assert.equal(command.split(" ").filter((arg) => arg === `--mode=${mode}`).length, 1, command);
				assert.match(command, /--env=pdev-west2/u);
			});
		}
	});
}

test("explicit deployment modes retain omitted optional environment and version arguments", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "--mode=cutover"]],
		["scripts/dev-deploy-fast.sh", ["--mode=cutover"]],
	]) {
		withFixture({}, (fixture) => {
			const result = runFixture(fixture, scriptPath, args);
			assert.equal(result.status, 0, result.stdout + result.stderr);
			assert.match(callsFor(fixture), /atlas micros service deploy .*--env=pdev-west2 .*--mode=cutover/u);
			assert.doesNotMatch(callsFor(fixture), /app---mode=/u);
		});
	}
});

test("both deploy paths reject duplicate, conflicting, empty, and unsupported modes before mutation", () => {
	for (const flags of [
		["--mode=cutover", "--mode=cutover"],
		["--mode=hot-swap", "--mode=hot-swap"],
		["--mode=cutover", "--mode=hot-swap"],
		["--mode=hot-swap", "--mode=cutover"],
		["--hot-swap", "--mode=hot-swap"],
		["--mode=hot-swap", "--hot-swap"],
		["--hot-swap", "--mode=cutover"],
		["--mode=cutover", "--hot-swap"],
		["--mode=debug"],
		["--mode=manual-progressive"],
		["--mode="],
	]) {
		for (const [scriptPath, args] of [
			[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", ...flags]],
			["scripts/dev-deploy-fast.sh", ["1.2.3", ...flags]],
		]) {
			withFixture({}, (fixture) => {
				const result = runFixture(fixture, scriptPath, args);
				assert.equal(result.status, 2, `${scriptPath} ${flags.join(" ")}: ${result.stdout}${result.stderr}`);
				assertNoMutationCalls(callsFor(fixture));
			});
		}
	}
});

test("hot-swap retains remote prerequisite checks before mutation", () => {
	withFixture({}, (fixture) => {
		const result = runFixture(fixture, "scripts/dev-deploy-fast.sh", ["1.2.3", "--hot-swap"], { serviceExists: false });
		assert.notEqual(result.status, 0);
		assertNoMutationCalls(callsFor(fixture));
	});
});

test("hot-swap accepts omitted optional environment or version arguments", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "--hot-swap"]],
		["scripts/dev-deploy-fast.sh", ["--hot-swap"]],
	]) {
		withFixture({}, (fixture) => {
			const result = runFixture(fixture, scriptPath, args);
			assert.equal(result.status, 0, result.stdout + result.stderr);
			assert.match(callsFor(fixture), /atlas micros service deploy .*--env=pdev-west2 .*--mode=hot-swap/u);
			assert.doesNotMatch(callsFor(fixture), /app---hot-swap/u);
		});
	}
});

test("both deploy paths reject an unstyled ADS export before image build or push", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3"]],
		["scripts/dev-deploy-fast.sh", ["1.2.3"]],
	]) {
		withFixture({}, (fixture) => {
			const result = runFixture(fixture, scriptPath, args, { unstyledExport: true });
			assert.equal(result.status, 1, result.stdout + result.stderr);
			assert.match(result.stdout + result.stderr, /initial HTML does not activate/u);
			assert.match(callsFor(fixture), /corepack pnpm run build:export/u);
			assert.doesNotMatch(callsFor(fixture), /docker (?:buildx|push)|atlas micros service deploy/u);
		});
	}
});

test("both deploy paths reject duplicate hot-swap flags and extra positional arguments", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "--hot-swap", "--hot-swap"]],
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2", "extra"]],
		["scripts/dev-deploy-fast.sh", ["--hot-swap", "--hot-swap"]],
		["scripts/dev-deploy-fast.sh", ["1.2.3", "extra"]],
	]) {
		withFixture({}, (fixture) => {
			const result = runFixture(fixture, scriptPath, args);
			assert.equal(result.status, 2, result.stdout + result.stderr);
			assertNoMutationCalls(callsFor(fixture));
		});
	}
});

test("both deploy paths require the backend origin mapping and stash before mutation", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3"]],
		["scripts/dev-deploy-fast.sh", ["1.2.3"]],
	]) {
		for (const missing of ["mapping", "stash"]) {
			withFixture({ stashes: missing === "stash" ? REQUIRED_STASHES.filter((key) => key !== "ALLOWED_ORIGINS") : REQUIRED_STASHES }, (fixture) => {
				if (missing === "mapping") {
					const descriptor = path.join(fixture.root, "service-descriptor.yml");
					writeFileSync(descriptor, readFileSync(descriptor, "utf8").replace(/^ +ALLOWED_ORIGINS:.*\n/mu, ""));
				}
				const result = runFixture(fixture, scriptPath, args);
				assert.notEqual(result.status, 0, result.stdout + result.stderr);
				assert.match(result.stdout + result.stderr, /ALLOWED_ORIGINS/u);
				assert.doesNotMatch(callsFor(fixture), /corepack pnpm run build:export/u);
				assertNoMutationCalls(callsFor(fixture));
			});
		}
	}
});

test("origin settings must use SSM mappings and exist in the selected stash", () => {
	for (const name of ["ALLOWED_ORIGINS", "VPK_ORIGIN"]) {
		for (const mapping of ["https://example.localhost", `((ssm:/example-service/${name}))`]) {
			withFixture({ stashes: REQUIRED_STASHES.filter((key) => key !== name) }, (fixture) => {
				const descriptor = path.join(fixture.root, "service-descriptor.yml");
				const original = readFileSync(descriptor, "utf8").replace(new RegExp(`^ +${name}:.*\\n`, "mu"), "");
				writeFileSync(descriptor, original + `      ${name}: ${mapping}\n`);
				const result = runFixture(fixture, ".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2"]);
				assert.notEqual(result.status, 0);
				assert.match(result.stdout + result.stderr, new RegExp(name, "u"));
				assert.doesNotMatch(callsFor(fixture), /corepack pnpm run build:export/u);
				assertNoMutationCalls(callsFor(fixture));
			});
		}
	}
});

test("both deploy paths require additional declared provider stashes without requiring unused providers", () => {
	for (const [scriptPath, args] of [
		[".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2"]],
		["scripts/dev-deploy-fast.sh", ["1.2.3"]],
	]) {
		for (const present of [false, true]) {
			withFixture({ stashes: present ? [...REQUIRED_STASHES, "AI_GATEWAY_URL_GOOGLE"] : REQUIRED_STASHES }, (fixture) => {
				const descriptor = path.join(fixture.root, "service-descriptor.yml");
				writeFileSync(descriptor, readFileSync(descriptor, "utf8") + [
					"      AI_GATEWAY_URL_GOOGLE: ((ssm:/example-service/AI_GATEWAY_URL_GOOGLE))",
					"",
				].join("\n"));
				const result = runFixture(fixture, scriptPath, args);
				if (present) assert.equal(result.status, 0, result.stdout + result.stderr);
				else {
					assert.notEqual(result.status, 0);
					assert.match(result.stdout + result.stderr, /AI_GATEWAY_URL_GOOGLE/u);
					assert.doesNotMatch(callsFor(fixture), /corepack pnpm run build:export/u);
					assertNoMutationCalls(callsFor(fixture));
				}
			});
		}
	}
});


test("configured deployment mode is loaded with explicit ENV and CLI mode overrides it", () => {
	for (const flags of [[], ["--mode=cutover"]]) {
		withFixture({}, fixture => {
			const config = path.join(fixture.root, ".deploy.local");
			writeFileSync(config, readFileSync(config, "utf8") + '\nVPK_DEPLOY_MODE="hot-swap"\n');
			const result = runFixture(fixture, ".agents/skills/vpk-deploy/scripts/deploy.sh", ["example-service", "1.2.3", "pdev-west2", ...flags]);
			assert.equal(result.status, 0, result.stdout + result.stderr);
			assert.match(callsFor(fixture), new RegExp(`--mode=${flags.length ? "cutover" : "hot-swap"}`));
		});
	}
});
