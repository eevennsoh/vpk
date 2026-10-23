import { inlineIcon } from "./icons.mjs";
import { insertBeforeBodyEnd, replaceMarkedBlock } from "./runtime/blocks.mjs";

// Inline @atlaskit contrast/theme glyph baked in at build time (pure HTML — no React import).
const ICON_THEME = inlineIcon("theme");

const STORAGE_KEY = "vpk-html-theme";
const INIT_START = "<!-- vpk-theme-init:start -->";
const INIT_END = "<!-- vpk-theme-init:end -->";
const RUNTIME_START = "<!-- vpk-theme-runtime:start -->";
const RUNTIME_END = "<!-- vpk-theme-runtime:end -->";

export function buildThemeInitScript() {
	return `(() => {
\tconst key = "${STORAGE_KEY}";
\tconst valid = new Set(["light", "dark", "system"]);
\tfunction readChoice() {
\t\ttry {
\t\t\tconst stored = localStorage.getItem(key);
\t\t\treturn valid.has(stored) ? stored : "system";
\t\t} catch {
\t\t\treturn "system";
\t\t}
\t}
\tfunction systemPrefersDark() {
\t\treturn window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
\t}
\tfunction apply(choice) {
\t\tconst next = valid.has(choice) ? choice : "system";
\t\tdocument.documentElement.dataset.vpkThemeChoice = next;
\t\tif (next === "dark" || (next === "system" && systemPrefersDark())) {
\t\t\tdocument.documentElement.dataset.theme = "dark";
\t\t} else {
\t\t\tdocument.documentElement.removeAttribute("data-theme");
\t\t}
\t}
\tapply(readChoice());
})();`;
}

export function buildThemeRuntimeScript() {
	return `(() => {
\tconst key = "${STORAGE_KEY}";
\tconst states = ["system", "light", "dark"];
\tconst labels = { system: "system", light: "light", dark: "dark" };
\tconst valid = new Set(states);
\tconst media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

\tfunction readChoice() {
\t\ttry {
\t\t\tconst stored = localStorage.getItem(key);
\t\t\treturn valid.has(stored) ? stored : "system";
\t\t} catch {
\t\t\treturn "system";
\t\t}
\t}

\tfunction writeChoice(choice) {
\t\ttry { localStorage.setItem(key, choice); }
\t\tcatch { /* noop */ }
\t}

\tfunction systemPrefersDark() {
\t\treturn media ? media.matches : false;
\t}

\tfunction apply(choice) {
\t\tconst next = valid.has(choice) ? choice : "system";
\t\tdocument.documentElement.dataset.vpkThemeChoice = next;
\t\tif (next === "dark" || (next === "system" && systemPrefersDark())) {
\t\t\tdocument.documentElement.dataset.theme = "dark";
\t\t} else {
\t\t\tdocument.documentElement.removeAttribute("data-theme");
\t\t}
\t\tupdateToggle(next);
\t}

\tfunction ensureToggle() {
\t\tlet button = document.querySelector("[data-vpk-theme-toggle]");
\t\tif (button) return button;
\t\tbutton = document.createElement("button");
\t\tbutton.type = "button";
\t\tbutton.className = "vpk-theme-toggle";
\t\tbutton.setAttribute("data-vpk-theme-toggle", "true");
\t\tbutton.innerHTML = ${JSON.stringify(ICON_THEME)};
\t\tbutton.addEventListener("click", () => {
\t\t\tconst current = readChoice();
\t\t\tconst next = states[(states.indexOf(current) + 1) % states.length];
\t\t\twriteChoice(next);
\t\t\tapply(next);
\t\t});
\t\tdocument.body.appendChild(button);
\t\treturn button;
\t}

\tfunction updateToggle(choice) {
\t\tconst button = ensureToggle();
\t\tconst state = button.querySelector(".vpk-theme-toggle__state");
\t\tconst next = states[(states.indexOf(choice) + 1) % states.length];
\t\tif (state) state.textContent = labels[choice];
\t\tbutton.dataset.vpkThemeChoice = choice;
\t\tbutton.setAttribute("aria-label", "Theme: " + labels[choice] + ". Activate for " + labels[next] + ".");
\t\tbutton.removeAttribute("aria-pressed");
\t}

\tfunction init() {
\t\tapply(readChoice());
\t\tif (!media) return;
\t\tconst onChange = () => {
\t\t\tif (readChoice() === "system") apply("system");
\t\t};
\t\tif (media.addEventListener) media.addEventListener("change", onChange);
\t\telse if (media.addListener) media.addListener(onChange);
\t}

\tif (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
\telse init();
})();`;
}

export function buildThemeInitBlock() {
	return `${INIT_START}
<script data-vpk-theme-init>
${buildThemeInitScript()}
</script>
${INIT_END}`;
}

export function buildThemeRuntimeBlock() {
	return `${RUNTIME_START}
<script data-vpk-theme-runtime>
${buildThemeRuntimeScript()}
</script>
${RUNTIME_END}`;
}

export function retrofitThemeRuntime(html) {
	const initBlock = buildThemeInitBlock();
	const runtimeBlock = buildThemeRuntimeBlock();
	let out = replaceMarkedBlock(html, INIT_START, INIT_END, initBlock) ?? html.replace(/(<style\b)/i, `${initBlock}\n$1`);
	out = replaceMarkedBlock(out, RUNTIME_START, RUNTIME_END, runtimeBlock) ?? insertBeforeBodyEnd(out, runtimeBlock);
	return out;
}

export { STORAGE_KEY as THEME_STORAGE_KEY };
