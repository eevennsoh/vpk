import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { pinVersion, readPinnedVersions, vpkGrabTarballUrl } from "./update-vpk-grab.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the react-grab dependency and the loaded script are the same vpk-grab release", () => {
	const { dependency, loaderVersion } = readPinnedVersions({
		packageJsonText: read("../package.json"),
		loaderText: read("../components/utils/dev-react-grab.ts"),
	});
	assert.ok(loaderVersion, "dev-react-grab.ts declares VPK_GRAB_VERSION");
	assert.equal(dependency, vpkGrabTarballUrl(loaderVersion));
});

test("pinVersion moves the dependency and the loader together", () => {
	const current = {
		packageJsonText: `{ "dependencies": { "react-grab": "${vpkGrabTarballUrl("0.2.0-vpk.1")}" } }`,
		loaderText: 'export const VPK_GRAB_VERSION = "0.2.0-vpk.1";\n',
	};
	const next = pinVersion(current, "0.3.0-vpk.1");
	assert.deepEqual(readPinnedVersions(next), { dependency: vpkGrabTarballUrl("0.3.0-vpk.1"), loaderVersion: "0.3.0-vpk.1" });
});

test("pinVersion refuses files it cannot find the pins in", () => {
	assert.throws(() => pinVersion({ packageJsonText: "{}", loaderText: 'export const VPK_GRAB_VERSION = "1";' }, "2"), /no react-grab dependency/u);
});
