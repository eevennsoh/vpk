const test = require("node:test");
const assert = require("node:assert/strict");

const { findBlockedLockfileRegistryUrls } = require("./verify-pnpm-lockfile");

test("accepts npmjs tarball URLs for public Atlaskit packages", () => {
	const findings = findBlockedLockfileRegistryUrls(`
packages:
  '@atlaskit/icon@34.3.0':
    resolution: {tarball: https://registry.npmjs.org/@atlaskit/icon/-/icon-34.3.0.tgz}
`);

	assert.deepEqual(findings, []);
});

test("rejects npm-remote tarball URLs for public packages", () => {
	const findings = findBlockedLockfileRegistryUrls(`
packages:
  '@example/package@1.0.0':
    resolution: {tarball: https://packages.atlassian.com/api/npm/npm-remote/@example/package/-/package-1.0.0.tgz}
`);

	assert.equal(findings.length, 1);
	assert.equal(findings[0].line, 4);
	assert.match(findings[0].text, /npm-remote/u);
});

test("rejects npm-remote tarball URLs for public Atlaskit packages", () => {
	const findings = findBlockedLockfileRegistryUrls(`
packages:
  '@atlaskit/icon@34.3.0':
    resolution: {tarball: https://packages.atlassian.com/artifactory/api/npm/npm-remote/@atlaskit/icon/-/icon-34.3.0.tgz}
`);

	assert.equal(findings.length, 1);
	assert.equal(findings[0].line, 4);
	assert.match(findings[0].text, /npm-remote/u);
});

test("rejects atlassian-npm tarball URLs", () => {
	const findings = findBlockedLockfileRegistryUrls(`
packages:
  '@atlaskit/icon@34.3.0':
    resolution: {tarball: https://packages.atlassian.com/api/npm/atlassian-npm/@atlaskit/icon/-/icon-34.3.0.tgz}
`);

	assert.equal(findings.length, 1);
	assert.equal(findings[0].line, 4);
	assert.match(findings[0].text, /atlassian-npm/u);
});

test("accepts atlassian-npm tarball URLs for allowed internal packages", () => {
	const findings = findBlockedLockfileRegistryUrls(`
packages:
  '@atlassian/logo-third-party@0.1.2':
    resolution: {tarball: https://packages.atlassian.com/api/npm/atlassian-npm/@atlassian/logo-third-party/-/@atlassian/logo-third-party-0.1.2.tgz}
`);

	assert.deepEqual(findings, []);
});

test("rejects atlassian-npm tarball URLs for other Atlassian packages", () => {
	const findings = findBlockedLockfileRegistryUrls(`
packages:
  '@atlassian/platform-feature-flags@2.0.0':
    resolution: {tarball: https://packages.atlassian.com/api/npm/atlassian-npm/@atlassian/platform-feature-flags/-/@atlassian/platform-feature-flags-2.0.0.tgz}
`);

	assert.equal(findings.length, 1);
	assert.equal(findings[0].line, 4);
	assert.match(findings[0].text, /atlassian-npm/u);
});

test("rejects tarball URLs that embed a credential", () => {
	const findings = findBlockedLockfileRegistryUrls(`
packages:
  motion-plus@https://api.motion.dev/registry?package=motion-plus&version=2.11.2&token=example:
    resolution: {tarball: https://api.motion.dev/registry?package=motion-plus&version=2.11.2&token=example}
`);

	assert.equal(findings.length, 2);
	assert.equal(findings[0].line, 3);
	assert.match(findings[0].explanation, /embeds a credential/u);
});

test("accepts Motion+ tarballs from the private registry", () => {
	const findings = findBlockedLockfileRegistryUrls(`
packages:
  '@motionplus/core@2.12.0':
    resolution: {tarball: https://api.motion.dev/npm/@motionplus/core/-/core-2.12.0.tgz}
`);

	assert.deepEqual(findings, []);
});
