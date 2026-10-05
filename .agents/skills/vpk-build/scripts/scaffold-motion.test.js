const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("motion adaptation preserves other imports, aliases and source outside the import", async t => {
	const { prepareHydrationSafeMotion, MOTION_HARNESS_PATH } = await import("./scaffold-motion.mjs");
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-motion-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	fs.mkdirSync(path.join(root, "components"));
	const file = path.join(root, "components", "card.tsx");
	const body = '\nexport const Card = () => useMotionPreference();\n';
	fs.writeFileSync(file, 'import Motion, { motion, type Variants, useReducedMotion as useMotionPreference } from "motion/react";' + body);
	assert.deepEqual(prepareHydrationSafeMotion(root), ["components/card.tsx"]);
	const ts = require("typescript");
	const updated = fs.readFileSync(file, "utf8");
	const parsed = ts.createSourceFile(file, updated, ts.ScriptTarget.Latest, true);
	const imports = parsed.statements.filter(ts.isImportDeclaration);
	assert.equal(imports[0].importClause.name.text, "Motion");
	assert.deepEqual(imports[0].importClause.namedBindings.elements.map(item => item.name.text), ["motion", "Variants"]);
	assert.equal(imports[1].importClause.namedBindings.elements[0].name.text, "useMotionPreference");
	assert.equal(imports[1].moduleSpecifier.text, "@/" + MOTION_HARNESS_PATH.replace(/\.ts$/u, ""));
	assert.equal(updated.endsWith(body), true);
	assert.deepEqual(prepareHydrationSafeMotion(root), []);
});

test("motion adaptation does not overwrite an unrelated existing harness", async t => {
	const { prepareHydrationSafeMotion, MOTION_HARNESS_PATH } = await import("./scaffold-motion.mjs");
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-motion-conflict-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	fs.mkdirSync(path.join(root, "hooks")); fs.mkdirSync(path.join(root, "components"));
	fs.writeFileSync(path.join(root, MOTION_HARNESS_PATH), "local override");
	const file = path.join(root, "components/card.tsx");
	const source = 'import { useReducedMotion } from "motion/react";';
	fs.writeFileSync(file, source);
	assert.throws(() => prepareHydrationSafeMotion(root), /Refusing to overwrite/u);
	assert.equal(fs.readFileSync(file, "utf8"), source);
});

test("generated motion hook hydrates without errors and follows preference changes", async () => {
	const { MOTION_HARNESS_SOURCE } = await import("./scaffold-motion.mjs");
	const { GlobalRegistrator } = require("@happy-dom/global-registrator");
	GlobalRegistrator.register();
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	const React = require("react");
	const { renderToString } = require("react-dom/server");
	const { hydrateRoot } = require("react-dom/client");
	const ts = require("typescript");
	const compiled = { exports: {} };
	const code = ts.transpileModule(MOTION_HARNESS_SOURCE, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	new Function("require", "module", "exports", code)(require, compiled, compiled.exports);
	const useReducedMotion = compiled.exports.useReducedMotion;
	function Probe() {
		const preference = useReducedMotion();
		return React.createElement("span", null, preference === null ? "unknown" : preference ? "reduce" : "normal");
	}
	let preference = true;
	const listeners = new Set();
	window.matchMedia = () => ({ matches: preference,
		addEventListener: (_, listener) => listeners.add(listener),
		removeEventListener: (_, listener) => listeners.delete(listener),
	});
	const container = document.createElement("div"); document.body.append(container);
	const errors = [];
	const originalError = console.error;
	console.error = (...args) => errors.push(args.map(String).join(" "));
	let root;
	try {
		container.innerHTML = renderToString(React.createElement(Probe));
		assert.equal(container.textContent, "unknown");
		await React.act(async () => { root = hydrateRoot(container, React.createElement(Probe), { onRecoverableError: error => errors.push(error.message) }); });
		assert.equal(container.textContent, "reduce");
		await React.act(async () => { preference = false; for (const listener of listeners) listener(); });
		assert.equal(container.textContent, "normal");
		assert.deepEqual(errors, []);
		await React.act(async () => root.unmount()); root = null;
		assert.equal(listeners.size, 0);
	} finally {
		if (root) await React.act(async () => root.unmount());
		console.error = originalError; container.remove(); GlobalRegistrator.unregister();
	}
});
