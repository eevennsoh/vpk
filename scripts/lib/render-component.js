// Behavioral test harness for React components under `node --test`: bundles a real TSX
// entry with esbuild, renders it into a happy-dom document through react-dom/client, and
// drives it with browser-like interactions. Prefer it over asserting on source text.
//
// - CSS is not applied: assert roles, names, focus, attributes, and callbacks, not class-driven visibility.
// - Assert on strings and booleans (accessibleName, tabOrder, isFocused), never on DOM nodes:
//   node:assert inspects failing operands with custom inspectors disabled, and one happy-dom
//   node expands into the whole window graph (minutes, then out of memory).
const path = require("node:path");
const { after, afterEach } = require("node:test");
const { GlobalRegistrator } = require("@happy-dom/global-registrator");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require("./esbuild-cjs-loader.js");
const { NEXT_RUNTIME_MOCKS } = require("./next-runtime-mocks.js");

const REPO_ROOT = path.resolve(__dirname, "../..");

if (!GlobalRegistrator.isRegistered) {
	const navigation = { disableChildFrameNavigation: true, disableChildPageNavigation: true, disableMainFrameNavigation: true };
	const loading = { disableCSSFileLoading: true, disableIframePageLoading: true, disableJavaScriptFileLoading: true };
	GlobalRegistrator.register({ settings: { ...loading, handleDisabledFileLoadingAsSuccess: true, navigation }, url: "http://localhost/" });
	// Web Animations marks a canceled `finished` promise as handled; happy-dom doesn't, so every
	// Motion animation stopped mid-flight became an unhandled rejection that failed the test.
	const cancelAnimation = globalThis.Animation.prototype.cancel;
	globalThis.Animation.prototype.cancel = function cancel() {
		this.finished?.catch(() => {});
		return cancelAnimation.call(this);
	};
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// react-dom reads the DOM globals when it loads, so require it after registering.
const React = require("react");
const { createRoot } = require("react-dom/client");

// Next.js runtime stand-ins. Override any of them via `mocks`.
const DEFAULT_MOCKS = NEXT_RUNTIME_MOCKS;

const FOCUSABLE = "a[href], area[href], button, input:not([type=hidden]), select, textarea, iframe, summary, [contenteditable]:not([contenteditable=\"false\"]), [tabindex]";
const BUTTON_INPUT = "input[type=button], input[type=reset], input[type=submit]";
const ENTER_ACTIVATES = `a[href], area[href], button, summary, input[type=image], ${BUTTON_INPUT}`;
const SPACE_ACTIVATES = `button, summary, input[type=checkbox], input[type=radio], ${BUTTON_INPUT}`;
const IMPLICIT_ROLES = Object.entries({
	button: `button, summary, ${BUTTON_INPUT}`,
	checkbox: "input[type=checkbox]",
	combobox: "select",
	dialog: "dialog",
	heading: "h1, h2, h3, h4, h5, h6",
	img: "img:not([alt=\"\"])",
	link: "a[href], area[href]",
	list: "ul, ol",
	listitem: "li",
	navigation: "nav",
	radio: "input[type=radio]",
	textbox: "input:not([type]), input[type=email], input[type=search], input[type=tel], input[type=text], input[type=url], textarea",
});

const bundleCache = new Map();
const mountedViews = new Set();
const reportedErrors = [];

// React and happy-dom report handler errors as window "error" events and only log them;
// collect them so the interaction that caused them rejects instead.
window.addEventListener("error", (event) => {
	reportedErrors.push(event.error ?? new Error(event.message));
	event.preventDefault();
});

async function run(callback) {
	await React.act(async () => {
		await callback();
	});
	if (reportedErrors.length > 0) {
		throw reportedErrors.splice(0)[0];
	}
}

function bundle({ entry, mocks, source }) {
	const modules = { ...DEFAULT_MOCKS, ...mocks };
	const key = JSON.stringify({ entry, modules, source });
	if (bundleCache.has(key)) {
		return bundleCache.get(key);
	}
	// `@/…` mock keys also intercept relative imports that resolve to the same file.
	const repoMocks = new Map(Object.keys(modules).filter((specifier) => specifier.startsWith("@/"))
		.map((specifier) => [path.join(REPO_ROOT, specifier.slice(2)), specifier]));
	const mockPlugin = {
		name: "render-component-mocks",
		setup(build) {
			// esbuild filters are Go regular expressions, so no `u` flag here.
			build.onResolve({ filter: /.*/ }, (args) => {
				const specifier = Object.hasOwn(modules, args.path)
					? args.path
					: args.path.startsWith(".") ? repoMocks.get(path.resolve(args.resolveDir, args.path).replace(/\.[cm]?[jt]sx?$/u, "")) : undefined;
				return specifier === undefined ? undefined : { namespace: "render-component-mock", path: specifier };
			});
			build.onLoad({ filter: /.*/, namespace: "render-component-mock" }, (args) => ({ contents: modules[args.path], loader: "tsx", resolveDir: REPO_ROOT }));
		},
	};
	const built = esbuild.build({
		...(source === undefined
			? { entryPoints: [path.resolve(REPO_ROOT, entry)] }
			: { stdin: { contents: source, loader: "tsx", resolveDir: REPO_ROOT, sourcefile: "inline-component.tsx" } }),
		bundle: true,
		external: ["react", "react-dom"],
		format: "cjs",
		jsx: "automatic",
		loader: { ".css": "empty" },
		logLevel: "silent",
		platform: "node",
		plugins: [mockPlugin],
		tsconfig: path.join(REPO_ROOT, "tsconfig.json"),
		write: false,
	}).then((result) => result.outputFiles[0].text);
	bundleCache.set(key, built);
	return built;
}

const normalize = (text) => (text ?? "").replace(/\s+/gu, " ").trim();
const matchesText = (text, matcher) => matcher === undefined || (matcher instanceof RegExp ? matcher.test(text) : text === matcher);

function contentText(node) {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent;
	}
	if (node.nodeType !== Node.ELEMENT_NODE || node.matches("[aria-hidden=\"true\"], [hidden], script, style")) {
		return "";
	}
	return node.matches("img") ? node.getAttribute("alt") ?? "" : [...node.childNodes].map(contentText).join("");
}

/** A small subset of accname: aria-labelledby, aria-label, alt, <label>, button value, then content/title. */
function accessibleName(element) {
	const labelledBy = element.getAttribute("aria-labelledby");
	if (labelledBy) {
		return normalize(labelledBy.split(/\s+/u).map((id) => document.getElementById(id)?.textContent ?? "").join(" "));
	}
	if (element.getAttribute("aria-label")) {
		return normalize(element.getAttribute("aria-label"));
	}
	if (element.matches("img, area, input[type=image]")) {
		return normalize(element.getAttribute("alt"));
	}
	if (element.labels?.length > 0) {
		return normalize([...element.labels].map((label) => label.textContent).join(" "));
	}
	if (element.matches("input, select, textarea")) {
		return normalize(element.matches(BUTTON_INPUT) ? element.value : element.getAttribute("title"));
	}
	return normalize(contentText(element)) || normalize(element.getAttribute("title"));
}

const roleOf = (element) => element.getAttribute("role")?.trim().split(/\s+/u)[0]
	|| IMPLICIT_ROLES.find(([, selector]) => element.matches(selector))?.[0];
const isInaccessible = (element) => element.closest("[hidden], [inert], [aria-hidden=\"true\"]") !== null;

function isDisabledControl(element) {
	const control = element.closest("button, input, select, textarea");
	return control !== null && (control.matches(":disabled") || control.closest("fieldset[disabled]") !== null);
}

const isFocusable = (element) => element.matches(FOCUSABLE) && !isDisabledControl(element) && element.closest("[hidden], [inert]") === null;
const tabIndexOf = (element) => Number.parseInt(element.getAttribute("tabindex") ?? "0", 10) || 0;

/** Elements in sequential (Tab) focus order: positive tabindex ascending, then document order. */
function tabbables() {
	return [...document.body.querySelectorAll(FOCUSABLE)]
		.filter((element) => isFocusable(element) && tabIndexOf(element) >= 0)
		.map((element, index) => ({ element, index, order: tabIndexOf(element) || Infinity }))
		.sort((a, b) => a.order - b.order || a.index - b.index)
		.map(({ element }) => element);
}

// Queries search the whole document so portalled content (menus, tooltips) is found.
const allElements = () => [...document.body.querySelectorAll("*")];
const queryAllByRole = (role, { hidden = false, name } = {}) => allElements()
	.filter((element) => roleOf(element) === role && (hidden || !isInaccessible(element)) && matchesText(accessibleName(element), name));
// The deepest elements whose normalized text matches, so wrappers don't match too.
const queryAllByText = (matcher) => allElements().filter((element) => !element.matches("script, style")
	&& matchesText(normalize(element.textContent), matcher)
	&& ![...element.children].some((child) => matchesText(normalize(child.textContent), matcher)));

function single(matches, description, required) {
	if (matches.length > 1) {
		throw new Error(`Found ${matches.length} elements for ${description}; use getAllByRole or a narrower query.`);
	}
	if (matches.length === 0 && required) {
		const roles = allElements().filter((element) => roleOf(element) && !isInaccessible(element))
			.map((element) => `  ${roleOf(element)} "${accessibleName(element)}"`);
		throw new Error(`Found no element for ${description}. Accessible roles:\n${roles.join("\n") || "  (none)"}`);
	}
	return matches[0] ?? null;
}

const describeRole = (role, options) => `role ${role}${options?.name === undefined ? "" : ` named ${String(options.name)}`}`;
const queries = {
	getAllByRole: (role, options) => {
		const matches = queryAllByRole(role, options);
		return matches.length > 0 ? matches : [single(matches, describeRole(role, options), true)];
	},
	getByRole: (role, options) => single(queryAllByRole(role, options), describeRole(role, options), true),
	getByText: (matcher) => single(queryAllByText(matcher), `text ${String(matcher)}`, true),
	queryByRole: (role, options) => single(queryAllByRole(role, options), describeRole(role, options), false),
	queryByText: (matcher) => single(queryAllByText(matcher), `text ${String(matcher)}`, false),
};

function focusElement(element) {
	if (element && isFocusable(element)) {
		element.focus();
	} else {
		document.activeElement?.blur?.();
	}
}

const interactions = {
	/** Pointer + mouse sequence; mousedown focuses the nearest focusable ancestor, as in a browser. */
	click: (element) => run(() => {
		const init = { bubbles: true, button: 0, cancelable: true, composed: true };
		const pointer = { ...init, isPrimary: true, pointerType: "mouse" };
		element.dispatchEvent(new PointerEvent("pointerdown", pointer));
		if (isDisabledControl(element)) {
			return;
		}
		if (element.dispatchEvent(new MouseEvent("mousedown", init))) {
			let target = element;
			while (target && !isFocusable(target)) {
				target = target.parentElement;
			}
			focusElement(target);
		}
		element.dispatchEvent(new PointerEvent("pointerup", pointer));
		element.dispatchEvent(new MouseEvent("mouseup", init));
		element.click();
	}),
	/** Sets a form control's value through the native setter so React's onChange fires. */
	fill: (element, value) => run(() => {
		Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value").set.call(element, value);
		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));
	}),
	/** Moves focus only to a focusable element, as `HTMLElement.focus()` does in a browser. */
	focus: (element) => run(() => focusElement(element)),
	/** keydown/keyup on `element` (null: the focused element) with Enter/Space activation and Tab navigation. */
	press: (element, key, init = {}) => run(() => {
		const target = element ?? document.activeElement ?? document.body;
		const eventInit = { bubbles: true, cancelable: true, composed: true, key, ...init };
		const keydownAllowed = target.dispatchEvent(new KeyboardEvent("keydown", eventInit));
		if (keydownAllowed && key === "Tab") {
			const order = tabbables();
			const index = order.indexOf(document.activeElement);
			focusElement(index === -1 ? order.at(init.shiftKey ? -1 : 0) : order[index + (init.shiftKey ? -1 : 1)]);
		} else if (keydownAllowed && key === "Enter" && target.matches(ENTER_ACTIVATES)) {
			target.click();
		}
		const keyupAllowed = target.dispatchEvent(new KeyboardEvent("keyup", eventInit));
		if (keydownAllowed && keyupAllowed && key === " " && target.matches(SPACE_ACTIVATES)) {
			target.click();
		}
	}),
};

/**
 * Render `exportName` from `entry` (repo-relative TSX path) or from inline TSX `source`.
 * `mocks` maps import specifiers (bare or `@/…`) to TSX module source.
 */
async function renderComponent({ entry, exportName = "default", mocks = {}, props = {}, source } = {}) {
	if ((entry === undefined) === (source === undefined)) {
		throw new Error("renderComponent needs exactly one of `entry` or `source`.");
	}
	const exports = loadCjsModuleFromText(await bundle({ entry, mocks, source }), path.join(REPO_ROOT, `${entry ?? "inline-component"}.render.cjs`));
	const Component = exports[exportName];
	if (typeof Component !== "function" && typeof Component !== "object") {
		throw new Error(`${entry ?? "inline source"} has no component export "${exportName}".`);
	}
	const container = document.body.appendChild(document.createElement("div"));
	const root = createRoot(container);
	const view = {
		...queries,
		...interactions,
		container,
		isFocused: (element) => document.activeElement === element,
		/**
		 * Re-renders with `nextProps`, replacing (not merging) the previous props. State survives, as in
		 * an in-place entity switch; a `key` in `nextProps` remounts instead, as a host keyed by entity id would.
		 */
		rerender: (nextProps) => run(() => root.render(React.createElement(Component, nextProps))),
		/** Accessible names of everything Tab reaches, in order. */
		tabOrder: () => tabbables().map(accessibleName),
		unmount: async () => {
			if (mountedViews.delete(view)) {
				await run(() => root.unmount());
				container.remove();
			}
		},
	};
	mountedViews.add(view);
	await view.rerender(props);
	return view;
}

/** Unmounts every rendered view and empties the document. Runs automatically after each test. */
async function cleanup() {
	reportedErrors.length = 0;
	try {
		for (const view of [...mountedViews]) {
			await view.unmount();
		}
	} finally {
		mountedViews.clear();
		document.body.replaceChildren();
	}
}

afterEach(cleanup);
after(() => GlobalRegistrator.unregister());

module.exports = { accessibleName, cleanup, renderComponent };
