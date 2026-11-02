// Regression: the answer-sources player looked for one stylesheet marker and wrote
// another, so every mount (the wall remounts its copies as it glides) appended
// another <link>. It must add its stylesheet once, however often it mounts.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { GlobalRegistrator } = require("@happy-dom/global-registrator");

test("the answer-sources player adds its stylesheet once across repeated mounts", (t) => {
	GlobalRegistrator.register({ url: "http://localhost/" });
	t.after(() => GlobalRegistrator.unregister());
	globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} };
	window.HTMLCanvasElement.prototype.getContext = () => null;
	const source = readFileSync(path.join(process.cwd(), "public/1p/finale-pieces/answer-sources.js"), "utf8");
	vm.runInThisContext(source, { filename: "answer-sources.js" });

	for (let mount = 0; mount < 3; mount += 1) {
		const piece = document.createElement("answer-sources");
		document.body.append(piece);
		piece.remove();
	}
	const links = document.head.querySelectorAll("link[rel='stylesheet'][href$='/1p/finale-pieces/answer-sources.css']");
	assert.equal(links.length, 1);
});
