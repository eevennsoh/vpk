/*
 * review/runtime/styles: CSS for the review runtime (ws1 4.2, 4.8, 4.9, 4.10). Node only.
 *
 *   reviewDocumentCss() -> the <style data-vpk-review-style> half of the `review` block:
 *     ::highlight() tints per reviewer tone and the print rules that hide the UI host.
 *   reviewContentCss()  -> the `review-content` block (kept by --strip-review): decision
 *     fieldset styles plus print rules for the runtime's suggested tags and state borders.
 *   reviewShadowCss()   -> the shadow-root UI, shipped inside the escaped runtime config.
 *
 * Every value is a vpk token (with a token fallback where generated artifacts may lack the
 * enhancement control palette), so check-html's colour, stripe and motion rules stay green:
 * no raw colours, no side stripes over 1.6px, durations from --vpk-dur-* tokens, no bare
 * ease-in, and reduced motion turns every transition and animation off.
 */

const TONE_UNDERLINE = [
	"underline solid 1px var(--ink)",
	"underline dashed 1px var(--ink)",
	"underline dotted 2px var(--ink)",
	"underline double 3px var(--ink)",
	"underline wavy 1px var(--ink)",
	"underline solid 2px var(--muted-text)",
];

export function reviewDocumentCss() {
	const tones = TONE_UNDERLINE.map((decoration, tone) => `::highlight(vpk-review-${tone}) { background-color: color-mix(in srgb, var(--math-highlight) 85%, transparent); text-decoration: ${decoration}; }`);
	const names = [0, 1, 2, 3, 4, 5].map(tone => `::highlight(vpk-review-${tone})`).concat("::highlight(vpk-review-active)").join(", ");
	return [
		...tones,
		"::highlight(vpk-review-active) { background-color: var(--math-highlight); color: var(--ink); text-decoration: underline solid 2px var(--ink); }",
		"@media print {",
		"\t[data-vpk-review-ui] { display: none !important; }",
		`\t${names} { background-color: transparent; text-decoration: none; }`,
		"}",
	].join("\n");
}

export function reviewContentCss() {
	return `:where(fieldset.vpk-decision) { margin: 24px 0; padding: 14px 18px 16px; border: 1px solid var(--rule); border-radius: 10px; background: var(--surface-raised); color: var(--ink); }
:where(fieldset.vpk-decision) > legend { padding: 0 6px; font-weight: 600; color: var(--headline, var(--ink)); }
:where(fieldset.vpk-decision) label { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; padding: 6px 0; cursor: pointer; }
:where(fieldset.vpk-decision) label small { color: var(--muted-text); }
:where(fieldset.vpk-decision) :is(input, select, textarea) { accent-color: var(--ink); font: inherit; }
:where(fieldset.vpk-decision) .vpk-decision__suggested { margin-left: auto; padding: 0 8px; border: 1px solid var(--rule); border-radius: 999px; font-size: 12px; line-height: 20px; color: var(--muted-text); }
:where(fieldset.vpk-decision)[data-vpk-decision-state="todo"] { border-style: dashed; border-color: var(--rule-strong); }
@media print {
	.vpk-decision__suggested { display: none !important; }
	:where(fieldset.vpk-decision)[data-vpk-decision-state] { border-style: solid; border-color: var(--rule); }
}`;
}

export function reviewShadowCss() {
	const tones = [
		"background: var(--ink); color: var(--inverse-text); border: 1px solid var(--ink);",
		"background: var(--paper); color: var(--ink); border: 1px solid var(--ink);",
		"background: var(--ill-tone3); color: var(--ink); border: 1px solid var(--ill-tone3);",
		"background: var(--ill-tone2); color: var(--ink); border: 1px dashed var(--ink);",
		"background: var(--ill-tone1); color: var(--ink); border: 1px dotted var(--ink);",
		"background: var(--surface-sunken); color: var(--ink); border: 3px double var(--ink);",
	].map((rule, tone) => `.vr-initials.vr-tone-${tone}, .vr-pin.vr-tone-${tone} { ${rule} }`).join("\n");
	// Overlay fallback marks sit in a fixed layer above the page and cannot blend with it (the layer
	// is its own stacking context), so they never fill: tone underlines, plus a ring when active.
	const marks = ["solid", "dashed", "dotted", "double", "dotted", "solid"].map((style, tone) => `.vr-mark.vr-tone-${tone} { border-bottom: ${tone === 3 ? 3 : 1}px ${style} var(--ink); }`).join("\n");
	return `:host { all: initial; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.vr-launcher, .vr-drawer, .vr-banner, .vr-toast, .vr-select-btn, .vr-pin { font: 13px/1.45 var(--font-sans, system-ui, sans-serif); color: var(--vpk-control-text, var(--ink)); }
button { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--vpk-control-focus, var(--focus-ring)); outline-offset: 2px; }
.vr-layer, .vr-pins { position: fixed; inset: 0; pointer-events: none; z-index: 2147483040; }
.vr-mark { position: absolute; }
.vr-mark.vr-tone-active { border-bottom: 2px solid var(--ink); box-shadow: 0 0 0 1px var(--ink); border-radius: 2px; }
${marks}
.vr-outline { position: absolute; border: 1px solid var(--ink); border-radius: 6px; }
.vr-outline-all { border: 1px dashed var(--rule-strong); }
.vr-outline-pick { border: 2px solid var(--vpk-control-focus, var(--focus-ring)); }
.vr-outline-chip { position: absolute; top: -22px; left: -1px; padding: 0 6px; border: 1px solid var(--ink); border-radius: 4px; background: var(--surface-raised); color: var(--ink); font: 11px/18px var(--font-mono, ui-monospace, monospace); white-space: nowrap; }
.vr-pin { position: absolute; top: 0; left: 0; width: 24px; height: 24px; padding: 0; border-radius: 999px; font-size: 10px; font-weight: 600; line-height: 22px; text-align: center; cursor: pointer; pointer-events: auto; }
.vr-pin.is-active { outline: 2px solid var(--ink); outline-offset: 1px; }
.vr-select-btn { position: fixed; top: 0; left: 0; z-index: 2147483050; display: inline-flex; gap: 4px; align-items: center; min-height: 26px; padding: 2px 8px; border: 1px solid var(--vpk-control-border, var(--rule)); border-radius: 999px; background: var(--surface-raised); cursor: pointer; }
.vr-launcher { position: fixed; left: 18px; bottom: 60px; z-index: 2147483050; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; border: 1px solid var(--vpk-control-border, var(--rule)); border-radius: 999px; background: var(--vpk-control-surface, var(--surface-raised)); cursor: pointer; }
.vr-launcher:hover { background: var(--vpk-control-surface-hover, var(--surface-sunken)); }
.vr-badge-count { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; background: var(--ink); color: var(--inverse-text); font-size: 11px; font-weight: 600; line-height: 18px; text-align: center; }
.vr-banner { position: fixed; left: 62px; bottom: 60px; z-index: 2147483050; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; max-width: min(560px, calc(100vw - 80px)); padding: 7px 12px; border: 1px solid var(--rule-strong); border-radius: 10px; background: var(--surface-raised); }
.vr-toast { position: fixed; left: 62px; bottom: 18px; z-index: 2147483060; display: flex; gap: 10px; align-items: center; max-width: min(520px, calc(100vw - 80px)); padding: 7px 12px; border: 1px solid var(--rule); border-radius: 10px; background: var(--surface-raised); opacity: 0; visibility: hidden; transition: opacity var(--vpk-dur-fast, 140ms) var(--ease-out, ease-out); }
.vr-toast.is-on { opacity: 1; visibility: visible; }
.vr-sr { position: fixed; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.vr-drawer { position: fixed; top: 12px; right: 12px; bottom: 12px; z-index: 2147483050; display: flex; flex-direction: column; width: min(380px, calc(100vw - 24px)); border: 1px solid var(--vpk-control-border, var(--rule)); border-radius: 12px; background: var(--surface-raised, var(--paper)); box-shadow: var(--shadow, none); animation: vr-enter var(--vpk-dur-enter, 140ms) var(--ease-out, ease-out); }
@keyframes vr-enter { from { opacity: 0; transform: translateX(8px); } }
@media (max-width: 800px) { .vr-banner { left: 18px; bottom: 102px; max-width: calc(100vw - 36px); } }
@media (max-width: 640px) { .vr-drawer { top: auto; left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 72vh; } .vr-launcher[aria-expanded="true"] { visibility: hidden; } .vr-toast { top: 12px; bottom: auto; left: 12px; right: 12px; max-width: none; flex-wrap: wrap; } .vr-toast.is-hosted { top: 56px; } }
@media (min-width: 641px) { .vr-drawer.is-hosted { top: 56px; } }
.vr-head { display: flex; gap: 8px; align-items: center; padding: 10px 10px 6px 16px; }
.vr-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--headline, var(--ink)); }
.vr-rev { color: var(--muted-text); font: 12px/1 var(--font-mono, ui-monospace, monospace); }
.vr-head .vr-icon-btn { margin-left: auto; }
.vr-notice { margin: 4px 16px 8px; padding: 8px 10px; border: 1px solid var(--rule-strong); border-radius: 8px; background: var(--surface-sunken); font-size: 12px; }
.vr-tabs { display: flex; gap: 2px; padding: 0 12px; border-bottom: 1px solid var(--rule); }
.vr-tab { min-height: 32px; padding: 6px 10px; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--muted-text); cursor: pointer; }
.vr-tab[aria-selected="true"] { border-bottom-color: var(--ink); color: var(--ink); font-weight: 600; }
.vr-panels { flex: 1; min-height: 0; overflow: auto; }
.vr-panel { padding: 10px 16px 16px; }
.vr-btn { display: inline-flex; gap: 6px; align-items: center; min-height: 28px; min-width: 28px; padding: 3px 10px; border: 1px solid var(--rule); border-radius: 8px; background: var(--paper); cursor: pointer; transition: background-color var(--vpk-dur-fast, 140ms) var(--ease-out, ease-out); }
.vr-btn:hover { background: var(--surface-sunken); }
.vr-btn[aria-pressed="true"] { border-color: var(--ink); background: var(--surface-sunken); font-weight: 600; }
.vr-btn[disabled] { opacity: .5; cursor: default; }
.vr-btn svg { flex: none; }
.vr-primary { border-color: var(--ink); background: var(--ink); color: var(--inverse-text); }
.vr-primary:hover { background: var(--ink); }
.vr-link { min-height: 24px; padding: 0 4px; border: 0; background: none; text-decoration: underline; }
.vr-icon-btn { justify-content: center; padding: 3px; border-color: transparent; background: none; }
.vr-chip-btn { min-height: 26px; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
.vr-filters, .vr-row-actions, .vr-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0 0 10px; }
.vr-actions { margin: 6px 0 0; }
.vr-threads { display: flex; flex-direction: column; }
.vr-thread { padding: 10px 2px; border-top: 1px solid var(--rule); }
.vr-thread:first-child { border-top: 0; }
.vr-thread.is-active { background: color-mix(in srgb, var(--math-highlight) 40%, transparent); }
.vr-who { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.vr-initials { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 4px; border-radius: 999px; font-size: 10px; font-weight: 600; }
.vr-name { font-weight: 600; }
.vr-time { color: var(--muted-text); font-size: 12px; }
.vr-chip { padding: 0 7px; border: 1px solid var(--rule); border-radius: 999px; color: var(--muted-text); font-size: 11px; line-height: 18px; }
.vr-quote { margin: 6px 0 0; padding: 4px 8px; border: 1px solid var(--rule); border-radius: 6px; background: var(--surface-sunken); color: var(--body-text, var(--ink)); font-style: italic; }
.vr-where { margin: 6px 0 0; color: var(--muted-text); font-size: 12px; }
.vr-body { margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.vr-reply { margin: 8px 0 0 18px; padding: 6px 0 0 10px; border-top: 1px dashed var(--rule); }
.vr-more { display: inline-flex; gap: 6px; }
.vr-more-menu { display: inline-flex; gap: 6px; }
.vr-composer, .vr-inline, .vr-dialog { margin: 0 0 12px; padding: 10px; border: 1px solid var(--rule-strong); border-radius: 10px; background: var(--paper); }
.vr-inline { margin: 8px 0 0; }
.vr-composer .vr-quote { margin: 0 0 8px; }
.vr-text, .vr-input { width: 100%; margin: 0 0 8px; padding: 6px 8px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--surface-raised); color: var(--ink); font: 13px/1.45 var(--font-sans, system-ui, sans-serif); resize: vertical; }
.vr-input-short { width: 5em; }
.vr-field { display: grid; gap: 2px; font-size: 12px; color: var(--muted-text); }
.vr-empty { color: var(--muted-text); }
.vr-sub { margin: 14px 0 6px; font-size: 13px; font-weight: 600; color: var(--headline, var(--ink)); }
.vr-loose { margin: 4px 0 0; color: var(--muted-text); font-size: 12px; }
.vr-change { padding: 6px 0 10px; border-top: 1px solid var(--rule); }
.vr-stack { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin: 0 0 14px; }
.vr-check { display: flex; gap: 6px; align-items: center; }
.vr-file { position: absolute; width: 1px; height: 1px; opacity: 0; }
.vr-drop { align-self: stretch; padding: 14px; border: 1px dashed var(--rule-strong); border-radius: 8px; color: var(--muted-text); font-size: 12px; text-align: center; }
.vr-drop.is-over { border-color: var(--ink); background: var(--surface-sunken); }
${tones}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition-duration: 0s !important; } }
@media print { :host { display: none !important; } }`;
}
