// SLAuth credentials for the deploy verifiers. A Micros deploy sits behind the Service
// Proxy with SLAuth (service-descriptor.yml `serviceProxy`), so automation sends the same
// token `atlas slauth curl --aud vpk` would: `Authorization: Bearer <slauth token>`.
// The token is never logged.

import { execFileSync } from "node:child_process";

export const DEFAULT_SLAUTH_AUDIENCE = "vpk";

/** The audience to use by default: `vpk` for a Micros host, none for anything else (localhost). */
export function defaultSlauthAudience(url) {
	return /\.atl-paas\.net$/iu.test(url.hostname) ? DEFAULT_SLAUTH_AUDIENCE : null;
}

/** The SLAuth environment (`atlas slauth token -e`) that issues tokens for a Micros host. */
export function slauthEnvForHost(hostname) {
	const host = hostname.toLowerCase();
	if (host.includes(".platdev.")) return "platdev";
	if (host.includes(".staging.")) return "staging";
	if (host.includes(".dev.")) return "dev";
	return "prod";
}

/**
 * Reads `--slauth-aud <aud>` and `--no-slauth` from argv at `index`. Returns the number of
 * arguments consumed (0 when the argument is not an SLAuth option).
 */
export function readSlauthOption(argv, index, options) {
	const arg = argv[index];
	if (arg === "--no-slauth") {
		options.audience = null;
		options.explicit = true;
		return 1;
	}
	if (arg === "--slauth-aud") {
		const value = argv[index + 1];
		if (!value || value.startsWith("--")) throw new Error("--slauth-aud needs an audience");
		options.audience = value;
		options.explicit = true;
		return 2;
	}
	return 0;
}

/**
 * The headers that authenticate automation to the service, or {} when no audience applies.
 * VPK_SLAUTH_TOKEN, when set, is used as the token as it is (for a token issued
 * elsewhere); otherwise `atlas slauth token --aud <aud> -e <env>` issues one.
 */
export function resolveSlauthHeaders(url, options, {
	env = process.env,
	exec = execFileSync,
} = {}) {
	const audience = options.explicit ? options.audience : defaultSlauthAudience(url);
	if (!audience) return {};
	let token = typeof env.VPK_SLAUTH_TOKEN === "string" ? env.VPK_SLAUTH_TOKEN.trim() : "";
	if (!token) {
		const atlas = env.VPK_ATLAS_BIN || "atlas";
		let output;
		try {
			output = exec(atlas, ["slauth", "token", "--aud", audience, "-e", slauthEnvForHost(url.hostname)], {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "inherit"],
			});
		} catch {
			throw new Error(`Could not issue an SLAuth token (atlas slauth token --aud ${audience}); log in with atlas or pass --no-slauth`);
		}
		token = String(output).trim().split(/\r?\n/u).filter(Boolean).pop() || "";
	}
	if (!token) throw new Error(`atlas slauth token --aud ${audience} returned no token`);
	return { Authorization: `Bearer ${token}` };
}
