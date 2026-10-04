const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { motionDuration, motionEase, motionRecipe } = require("./motion.ts");

const THEME_CSS = fs.readFileSync(path.join(__dirname, "..", "app", "tailwind-theme.css"), "utf8");

function readCssToken(name) {
	const match = THEME_CSS.match(new RegExp(`--${name}:\\s*([^;]+);`, "u"));
	assert.ok(match, `app/tailwind-theme.css is missing --${name}`);
	return match[1].trim();
}

const EASE_TOKENS = {
	linear: "ease-linear",
	in: "ease-in",
	out: "ease-out",
	outPractical: "ease-out-practical",
	inOut: "ease-in-out",
};

test("motionEase mirrors every cubic-bezier --ease-* token", () => {
	assert.deepEqual(Object.keys(motionEase).sort(), Object.keys(EASE_TOKENS).sort());
	for (const [key, token] of Object.entries(EASE_TOKENS)) {
		const css = readCssToken(token).match(/^cubic-bezier\(([^)]+)\)$/u);
		assert.ok(css, `--${token} is no longer a cubic-bezier; update lib/motion.ts`);
		assert.deepEqual([...motionEase[key]], css[1].split(",").map(Number), `motionEase.${key} drifted from --${token}`);
	}
});

test("motionDuration mirrors every --duration-* token in seconds", () => {
	const cssKeys = [...THEME_CSS.matchAll(/--duration-([a-z]+):/gu)].map((match) => match[1]);
	assert.deepEqual(Object.keys(motionDuration).sort(), [...new Set(cssKeys)].sort());
	for (const [key, seconds] of Object.entries(motionDuration)) {
		const css = readCssToken(`duration-${key}`).match(/^(\d+)ms$/u);
		assert.ok(css, `--duration-${key} must stay a millisecond value`);
		assert.equal(seconds, Number(css[1]) / 1000, `motionDuration.${key} drifted from --duration-${key}`);
	}
});

test("every recipe exits faster than it enters, on the practical exit curve", () => {
	for (const [role, recipe] of Object.entries(motionRecipe)) {
		assert.ok(recipe.exit.duration < recipe.enter.duration, `${role} exit must be shorter than its enter`);
		assert.equal(recipe.exit.ease, motionEase.in, `${role} exits with ease-in`);
	}
});
