const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
	getRandomAgentAvatarSrc,
	getUnmaskedAgentAvatarSrc,
	getDeterministicAgentAvatarSrc,
	DEFAULT_AGENT_PROFILE_AVATAR_SRC,
	getAgentAvatarAccent,
	getDeterministicAgentBannerSrc,
	getAgentProfileBannerSrc,
	getAgentBannerColor,
} = require("./agent-avatars.ts");

const SOURCE = fs.readFileSync(path.join(__dirname, "agent-avatars.ts"), "utf8");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

test("Agent Profile banner resolution includes the component fallback avatar", () => {
	assert.equal(
		getAgentProfileBannerSrc(undefined),
		getDeterministicAgentBannerSrc(
			DEFAULT_AGENT_PROFILE_AVATAR_SRC,
			DEFAULT_AGENT_PROFILE_AVATAR_SRC,
		),
	);
});

function extractAvatarSrcs() {
	const match = SOURCE.match(/export const AGENT_AVATAR_SRCS = \[([\s\S]*?)\] as const;/u);
	assert.ok(match, "AGENT_AVATAR_SRCS literal not found");
	return [...match[1].matchAll(/"([^"]+)"/gu)].map((entry) => entry[1]);
}

test("every avatar in the pool exists under /public", () => {
	const srcs = extractAvatarSrcs();
	assert.ok(srcs.length > 0, "expected a non-empty avatar pool");
	for (const src of srcs) {
		assert.ok(src.startsWith("/avatar-agent-new/"), `unexpected avatar path: ${src}`);
		const filePath = path.join(PUBLIC_DIR, src);
		assert.ok(fs.existsSync(filePath), `missing avatar file on disk: ${src}`);
	}
});

test("the avatar pool covers all five agent families for color variety", () => {
	const srcs = extractAvatarSrcs();
	const groups = new Set(srcs.map((src) => src.split("/")[2]));
	for (const family of ["lime", "purple", "yellow", "orange", "blue"]) {
		assert.ok(groups.has(family), `pool missing family: ${family}`);
	}
});

test("the avatar pool has no duplicate entries", () => {
	const srcs = extractAvatarSrcs();
	assert.equal(new Set(srcs).size, srcs.length, "duplicate avatar paths found");
});

test("getRandomAgentAvatarSrc only ever returns paths from the pool", () => {
	const srcs = extractAvatarSrcs();
	const pool = new Set(srcs);

	for (const sequence of [[0, 0], [0.999999, 0.999999], [0.4, 0.6]]) {
		const originalRandom = Math.random;
		let callIndex = 0;
		Math.random = () => sequence[callIndex++] ?? 0;
		try {
			assert.ok(pool.has(getRandomAgentAvatarSrc()));
		} finally {
			Math.random = originalRandom;
		}
	}
});

test("getRandomAgentAvatarSrc balances random selection by family first", () => {
	const srcs = extractAvatarSrcs();
	const families = [];
	for (const src of srcs) {
		const family = src.split("/")[2];
		let bucket = families.find((entry) => entry.id === family);
		if (!bucket) {
			bucket = { id: family, srcs: [] };
			families.push(bucket);
		}
		bucket.srcs.push(src);
	}

	for (let familyIndex = 0; familyIndex < families.length; familyIndex += 1) {
		const family = families[familyIndex];
		const originalRandom = Math.random;
		let callIndex = 0;
		const sequence = [
			(familyIndex + 0.01) / families.length,
			0.999999,
		];
		Math.random = () => sequence[callIndex++] ?? 0;
		try {
			assert.equal(getRandomAgentAvatarSrc(), family.srcs.at(-1));
			assert.equal(callIndex, 2, "expected one random draw for family and one for avatar");
		} finally {
			Math.random = originalRandom;
		}
	}
});

test("getDeterministicAgentAvatarSrc only ever returns paths from the pool", () => {
	const pool = new Set(extractAvatarSrcs());
	for (const seed of ["product-requirements-guide", "rca-agent", "a", "", "   ", "🙂-agent"]) {
		assert.ok(pool.has(getDeterministicAgentAvatarSrc(seed)), `out-of-pool avatar for seed: ${JSON.stringify(seed)}`);
	}
});

// The bug this guards: the streamed result card and the persisted session entry
// each independently fall back to a derived avatar when the model omits one. If
// those fallbacks disagree, the card shows a different avatar/banner than the
// final agent. Both call sites pass the same agentId, so a stable mapping from
// identity -> avatar is exactly what keeps them aligned.
test("getDeterministicAgentAvatarSrc is stable for the same identity", () => {
	for (const seed of ["product-requirements-guide", "okr-generator", "my-custom-agent-7"]) {
		assert.equal(
			getDeterministicAgentAvatarSrc(seed),
			getDeterministicAgentAvatarSrc(seed),
			`avatar drifted for repeated seed: ${seed}`,
		);
	}
});

test("getDeterministicAgentAvatarSrc ignores surrounding whitespace in the seed", () => {
	assert.equal(
		getDeterministicAgentAvatarSrc("product-requirements-guide"),
		getDeterministicAgentAvatarSrc("  product-requirements-guide  "),
	);
});

test("getDeterministicAgentAvatarSrc spreads identities across all families", () => {
	const seeds = Array.from({ length: 200 }, (_, index) => `generated-agent-${index}`);
	const families = new Set(seeds.map((seed) => getAgentAvatarAccent(getDeterministicAgentAvatarSrc(seed))));
	assert.equal(families.size, 5, "expected deterministic picks to cover all five family colors");
});

test("new avatar colors have distinct matching accents", () => {
	const colors = ["lime", "purple", "yellow", "orange", "blue"];
	const accents = colors.map((color) => getAgentAvatarAccent(`/avatar-agent-new/${color}/default.svg`));
	assert.equal(new Set(accents).size, colors.length);
});

// Banner color is derived from the avatar family; grey is never a banner color.
const BANNER_COLORS = ["blue", "lime", "orange", "purple", "yellow"];

// Representative avatar per family -> expected banner color.
const FAMILY_BANNER_COLOR = {
	"/avatar-agent-new/lime/feature-flag.svg": "lime",
	"/avatar-agent-new/purple/customer-insight.svg": "purple",
	"/avatar-agent-new/yellow/ops-agent.svg": "yellow",
	"/avatar-agent-new/orange/research-scout.svg": "orange",
	"/avatar-agent-new/blue/backlog-buddy.svg": "blue",
};

function extractBannerSrcs() {
	const match = SOURCE.match(/const SMART_FOLDER_BANNER_SRCS_BY_COLOR = \{([\s\S]*?)\} as const satisfies/u);
	assert.ok(match, "SMART_FOLDER_BANNER_SRCS_BY_COLOR literal not found");
	return [...match[1].matchAll(/"([^"]+)"/gu)].map((entry) => entry[1]);
}

function bannerColor(src) {
	// Path shape is `/smart-folders/<color>/<design>.svg`; the color is the subfolder.
	return src.split("/")[2];
}

function bannerDesign(src) {
	// Path shape is `/smart-folders/<color>/<design>-<color>.svg`; strip the
	// `-<color>.svg` suffix so the design can be compared across colors.
	const color = bannerColor(src);
	return src.split("/").pop().replace(new RegExp(`-${color}\\.svg$`, "u"), "");
}

test("every banner in the pool exists under /public", () => {
	const srcs = extractBannerSrcs();
	assert.ok(srcs.length > 0, "expected a non-empty banner pool");
	for (const src of srcs) {
		assert.ok(src.startsWith("/smart-folders/"), `unexpected banner path: ${src}`);
		assert.ok(fs.existsSync(path.join(PUBLIC_DIR, src)), `missing banner file on disk: ${src}`);
	}
});

test("the banner pool never includes grey", () => {
	for (const src of extractBannerSrcs()) {
		assert.ok(!/\/(gray|grey)\//u.test(src), `grey banner must never be referenced: ${src}`);
	}
});

test("each banner color ships the same 8 designs with no duplicates", () => {
	const srcs = extractBannerSrcs();
	assert.equal(new Set(srcs).size, srcs.length, "duplicate banner paths found");
	const perColor = new Map(BANNER_COLORS.map((color) => [color, 0]));
	for (const src of srcs) {
		const color = bannerColor(src);
		assert.ok(perColor.has(color), `banner ${src} uses an unexpected color: ${color}`);
		perColor.set(color, perColor.get(color) + 1);
	}
	for (const [color, count] of perColor) {
		assert.equal(count, 8, `expected 8 designs for ${color}, saw ${count}`);
	}
});

test("getAgentBannerColor matches the avatar family and falls back to blue", () => {
	for (const [avatarSrc, color] of Object.entries(FAMILY_BANNER_COLOR)) {
		assert.equal(getAgentBannerColor(avatarSrc), color, `wrong banner color for ${avatarSrc}`);
	}
	assert.equal(getAgentBannerColor("/avatar-agent/unknown-family/x.svg"), "blue", "unknown family should fall back to blue");
	assert.equal(getAgentBannerColor(undefined), "blue", "missing avatar should fall back to blue");
});

test("getDeterministicAgentBannerSrc only ever returns in-pool, non-grey banners", () => {
	const pool = new Set(extractBannerSrcs());
	const avatars = [...Object.keys(FAMILY_BANNER_COLOR), undefined, "/avatar-agent/unknown/x.svg"];
	for (const avatarSrc of avatars) {
		for (const seed of ["rfp-drafting-agent", "okr-generator", "a", "", "   ", "🙂-agent", null, undefined]) {
			const src = getDeterministicAgentBannerSrc(avatarSrc, seed);
			assert.ok(pool.has(src), `out-of-pool banner for ${JSON.stringify({ avatarSrc, seed })}: ${src}`);
			assert.ok(!/\/(gray|grey)\//u.test(src), `picker returned a grey banner: ${src}`);
		}
	}
});

test("getDeterministicAgentBannerSrc colors the banner to match the avatar family", () => {
	for (const [avatarSrc, color] of Object.entries(FAMILY_BANNER_COLOR)) {
		for (const seed of ["rfp-drafting-agent", "agent-123", "another-seed"]) {
			assert.equal(bannerColor(getDeterministicAgentBannerSrc(avatarSrc, seed)), color, `banner color drifted from family for ${avatarSrc}`);
		}
	}
});

// Same contract as the avatar picker: two surfaces that independently render the
// same agent id must land on the same banner, so it never flickers on re-render.
test("getDeterministicAgentBannerSrc is stable for the same identity", () => {
	const avatarSrc = "/avatar-agent-new/lime/feature-flag.svg";
	for (const seed of ["rfp-drafting-agent", "okr-generator", "my-custom-agent-7"]) {
		assert.equal(
			getDeterministicAgentBannerSrc(avatarSrc, seed),
			getDeterministicAgentBannerSrc(avatarSrc, seed),
			`banner drifted for repeated seed: ${seed}`,
		);
	}
});

test("getDeterministicAgentBannerSrc ignores surrounding whitespace in the seed", () => {
	const avatarSrc = "/avatar-agent-new/lime/feature-flag.svg";
	assert.equal(
		getDeterministicAgentBannerSrc(avatarSrc, "rfp-drafting-agent"),
		getDeterministicAgentBannerSrc(avatarSrc, "  rfp-drafting-agent  "),
	);
});

test("getDeterministicAgentBannerSrc varies the design across identities within a family", () => {
	const avatarSrc = "/avatar-agent-new/blue/backlog-buddy.svg";
	const seeds = Array.from({ length: 200 }, (_, index) => `generated-agent-${index}`);
	const designs = new Set(seeds.map((seed) => getDeterministicAgentBannerSrc(avatarSrc, seed)));
	assert.ok(designs.size >= 6, `expected deterministic picks to cover most of the 8 designs, saw ${designs.size}`);
});

// Regression: the design must move when the AVATAR changes, not just the color.
// Previously the design seeded on the identity (agentId) alone, so editing one
// agent and swapping its avatar to change the color left a single design merely
// recolored across every color ("same design, just different color").
test("getDeterministicAgentBannerSrc varies the design when the avatar changes, holding identity fixed", () => {
	const fixedSeed = "studio-demo-agent";

	// Avatars in the SAME family share a color, so a design change here is purely
	// an avatar-driven design change — exactly the case the old seeding pinned.
	const sameColorAvatars = [
		"/avatar-agent-new/blue/backlog-buddy.svg",
		"/avatar-agent-new/blue/backlog-buddy.svg",
		"/avatar-agent-new/blue/product-requirements.svg",
		"/avatar-agent-new/blue/okr-oracle.svg",
	];
	const sameColorDesigns = new Set(
		sameColorAvatars.map((avatarSrc) => bannerDesign(getDeterministicAgentBannerSrc(avatarSrc, fixedSeed))),
	);
	assert.ok(sameColorDesigns.size >= 2, `same-color avatar swaps must change the design, saw ${sameColorDesigns.size}`);

	// Across families (color changes too) the design should likewise vary, rather
	// than one design recolored per color.
	const crossFamilyDesigns = new Set(
		Object.keys(FAMILY_BANNER_COLOR).map((avatarSrc) => bannerDesign(getDeterministicAgentBannerSrc(avatarSrc, fixedSeed))),
	);
	assert.ok(crossFamilyDesigns.size >= 3, `avatar/color swaps must vary the design, saw ${crossFamilyDesigns.size}`);
});


test("each selectable avatar has container-less artwork for profile covers", () => {
	for (const src of extractAvatarSrcs()) {
		const coverSrc = getUnmaskedAgentAvatarSrc(src);
		assert.ok(coverSrc.startsWith("/avatar-agent-new-unmasked/"));
		const artwork = fs.readFileSync(path.join(PUBLIC_DIR, coverSrc), "utf8");
		assert.doesNotMatch(artwork, /<use xlink:href="#stroke/);
	}
	assert.equal(getUnmaskedAgentAvatarSrc("/custom/avatar.svg"), "/custom/avatar.svg");
	assert.equal(getUnmaskedAgentAvatarSrc("/avatar-agent/teamwork-agents/blocker-checker.svg"), "/avatar-agent-unmasked/teamwork-agents/blocker-checker.svg");
});
