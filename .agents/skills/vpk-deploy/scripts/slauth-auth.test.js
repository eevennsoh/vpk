const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const load = () => import(pathToFileURL(path.join(__dirname, "slauth-auth.mjs")).href);

test("a Micros host defaults to audience vpk and the SLAuth environment its host names", async () => {
	const { defaultSlauthAudience, slauthEnvForHost } = await load();
	assert.equal(defaultSlauthAudience(new URL("https://vpk.us-west-2.platdev.atl-paas.net")), "vpk");
	assert.equal(defaultSlauthAudience(new URL("http://localhost:8080")), null);
	assert.equal(slauthEnvForHost("vpk.us-west-2.platdev.atl-paas.net"), "platdev");
	assert.equal(slauthEnvForHost("vpk.us-east-1.staging.atl-paas.net"), "staging");
	assert.equal(slauthEnvForHost("vpk.ap-southeast-2.dev.atl-paas.net"), "dev");
	assert.equal(slauthEnvForHost("vpk.us-east-1.prod.atl-paas.net"), "prod");
});

test("the token comes from atlas slauth token --aud vpk, as a Bearer header", async () => {
	const { resolveSlauthHeaders } = await load();
	const calls = [];
	const headers = resolveSlauthHeaders(new URL("https://vpk.us-west-2.platdev.atl-paas.net"), { explicit: false }, {
		env: {},
		exec: (command, args) => {
			calls.push([command, ...args]);
			return "issued-token\n";
		},
	});
	assert.deepEqual(headers, { Authorization: "Bearer issued-token" });
	assert.deepEqual(calls, [["atlas", "slauth", "token", "--aud", "vpk", "-e", "platdev"]]);
});

test("--no-slauth and a localhost target send nothing; a failed issue is an error that names the fix", async () => {
	const { readSlauthOption, resolveSlauthHeaders } = await load();
	const options = { audience: null, explicit: false };
	assert.equal(readSlauthOption(["--no-slauth"], 0, options), 1);
	const neverExec = () => { throw new Error("must not run"); };
	assert.deepEqual(resolveSlauthHeaders(new URL("https://vpk.us-west-2.platdev.atl-paas.net"), options, { env: {}, exec: neverExec }), {});
	assert.deepEqual(resolveSlauthHeaders(new URL("http://localhost:8080"), { explicit: false }, { env: {}, exec: neverExec }), {});
	assert.throws(
		() => resolveSlauthHeaders(new URL("http://localhost:8080"), { audience: "vpk", explicit: true }, { env: {}, exec: neverExec }),
		/--no-slauth/u,
	);
	assert.throws(() => readSlauthOption(["--slauth-aud"], 0, options), /needs an audience/u);
});
