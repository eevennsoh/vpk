#!/usr/bin/env node
/*
 * Phase 2 template generator for the html-effectiveness catalog.
 *
 * The upstream repo is treated as a use-case inventory, not a source file to
 * copy. These templates are original vpk-html shells that map the same
 * engineering document shapes into the local offline template-edit contract.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFaviconLinkBlock, buildFontFaceBlock, FONT_STACKS, readStylesCss, wrapSharedCss } from "./shared.mjs";
import { retrofitDocumentNav } from "./presentation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const TEMPLATES_DIR = path.join(SKILL_ROOT, "assets", "templates");
const UPSTREAM = "https://github.com/ThariqS/html-effectiveness";

const CATALOG = [
	{
		slug: "exploration-code-approaches",
		source: "01-exploration-code-approaches.html",
		title: "Exploration · Code Approaches",
		category: "Exploration",
		route: "technical approach comparison / implementation options / code approach exploration",
		summary: "Compare competing implementation approaches before a team commits to one.",
		stats: ["{{OPTION_COUNT}} approaches", "{{RECOMMENDED_OPTION}} recommended", "{{DECISION_DATE}} decision date"],
		sections: [
			["Problem Frame", ["{{What decision has to be made?}}", "{{What constraints matter most: time, safety, compatibility, cost, team familiarity?}}"]],
			["Approach Matrix", ["{{Approach A: mechanics, scope, upside, downside.}}", "{{Approach B: mechanics, scope, upside, downside.}}", "{{Approach C: mechanics, scope, upside, downside.}}"]],
			["Recommendation", ["{{Recommended approach and why it wins under the stated constraints.}}", "{{Fallback path if the recommendation proves wrong.}}"]],
		],
		checklist: ["Decision criteria are explicit", "Tradeoffs are concrete", "Fallback is named"],
	},
	{
		slug: "exploration-visual-designs",
		source: "02-exploration-visual-designs.html",
		title: "Exploration · Visual Designs",
		category: "Exploration",
		route: "visual directions / UI concept comparison / design exploration",
		summary: "Compare UI directions with rationale, constraints, and selection criteria.",
		stats: ["{{DIRECTION_COUNT}} directions", "{{TARGET_SURFACE}} surface", "{{REVIEW_STAGE}} stage"],
		sections: [
			["Design Brief", ["{{Audience, workflow, and emotional tone the design must serve.}}", "{{Hard constraints: brand, density, accessibility, device, and platform.}}"]],
			["Directions", ["{{Direction A: visual idea, strengths, weaknesses, best-fit scenario.}}", "{{Direction B: visual idea, strengths, weaknesses, best-fit scenario.}}", "{{Direction C: visual idea, strengths, weaknesses, best-fit scenario.}}"]],
			["Selection", ["{{Chosen direction and why.}}", "{{Open questions for design or implementation.}}"]],
		],
		checklist: ["Audience is named", "Each option has a real tradeoff", "Selection criteria are visible"],
	},
	{
		slug: "code-review-pr",
		source: "03-code-review-pr.html",
		title: "Code Review · Pull Request",
		category: "Review",
		route: "code review / PR review / review findings",
		summary: "Lead with review findings, then evidence, validation, and remaining risk.",
		stats: ["{{PR_NUMBER}}", "{{FINDING_COUNT}} findings", "{{VALIDATION_STATUS}} validation"],
		sections: [
			["Findings", ["{{P0/P1 finding: file, line, behavior, and concrete impact.}}", "{{P2/P3 finding: file, line, behavior, and concrete impact.}}"]],
			["Validation Readout", ["{{Commands or checks reviewed. Include pass/fail/blocked state.}}", "{{Coverage gaps or residual risk.}}"]],
			["Reviewer Focus", ["{{What should the author fix first?}}", "{{What can wait or is informational only?}}"]],
		],
		checklist: ["Findings first", "Severity is justified", "File/line evidence included"],
	},
	{
		slug: "code-understanding",
		source: "04-code-understanding.html",
		title: "Code Understanding",
		category: "Review",
		route: "explain this code / codebase map / module walkthrough",
		summary: "Explain how a code path works without turning it into generic documentation.",
		stats: ["{{ENTRYPOINT_COUNT}} entrypoints", "{{MODULE_COUNT}} modules", "{{CONFIDENCE_LEVEL}} confidence"],
		sections: [
			["Entry Points", ["{{Where execution starts and what calls into this code.}}", "{{Inputs, outputs, and side effects.}}"]],
			["Flow", ["{{Step-by-step behavior through the main path.}}", "{{Important branch or failure path.}}"]],
			["Integration Notes", ["{{Dependencies and ownership boundaries.}}", "{{What to inspect before changing this code.}}"]],
		],
		checklist: ["Entrypoints verified", "Data flow is concrete", "Change hazards named"],
	},
	{
		slug: "design-system",
		source: "05-design-system.html",
		title: "Design System",
		category: "Design",
		route: "design system / token contract / component system",
		summary: "Document a narrow design system contract for implementation teams.",
		stats: ["{{TOKEN_COUNT}} tokens", "{{COMPONENT_COUNT}} components", "{{ADOPTION_STATUS}} adoption"],
		sections: [
			["Principles", ["{{Design principles that constrain choices.}}", "{{What is intentionally out of scope.}}"]],
			["Tokens and Components", ["{{Color, type, spacing, radius, elevation, and motion token guidance.}}", "{{Core components and variant rules.}}"]],
			["Adoption", ["{{Migration path, compatibility constraints, and owner.}}", "{{Validation or review checklist.}}"]],
		],
		checklist: ["Tokens beat raw values", "Component ownership is clear", "Migration path exists"],
	},
	{
		slug: "component-variants",
		source: "06-component-variants.html",
		title: "Component Variants",
		category: "Design",
		route: "component variants / UI state matrix / component spec",
		summary: "Specify variants, states, and behavioral expectations for one component.",
		stats: ["{{VARIANT_COUNT}} variants", "{{STATE_COUNT}} states", "{{A11Y_STATUS}} a11y"],
		sections: [
			["Component Contract", ["{{Component purpose and where it should be used.}}", "{{Props, slots, and composition constraints.}}"]],
			["Variant Matrix", ["{{Variant 1: visual treatment, behavior, and constraints.}}", "{{Variant 2: visual treatment, behavior, and constraints.}}", "{{State coverage: hover, focus, disabled, loading, error.}}"]],
			["Implementation Notes", ["{{Accessibility requirements.}}", "{{Testing and visual QA expectations.}}"]],
		],
		checklist: ["States are complete", "A11y behavior is explicit", "Usage boundaries are named"],
	},
	{
		slug: "prototype-animation",
		source: "07-prototype-animation.html",
		title: "Prototype · Animation",
		category: "Prototype",
		route: "motion prototype / animation concept / interaction motion",
		summary: "Describe an animation prototype with timing, state changes, and acceptance criteria.",
		stats: ["{{MOTION_COUNT}} motions", "{{DURATION_RANGE}} duration", "{{PERF_BUDGET}} budget"],
		sections: [
			["Intent", ["{{What the motion communicates or clarifies.}}", "{{Which user action or system state triggers it.}}"]],
			["Motion Spec", ["{{Timeline, easing, duration, delay, and affected properties.}}", "{{Reduced-motion behavior.}}"]],
			["Acceptance", ["{{How to verify it feels correct and remains performant.}}", "{{Known edge cases or browser/device constraints.}}"]],
		],
		checklist: ["Motion has a job", "Reduced-motion path exists", "Performance budget named"],
	},
	{
		slug: "prototype-interaction",
		source: "08-prototype-interaction.html",
		title: "Prototype · Interaction",
		category: "Prototype",
		route: "interaction prototype / UI behavior prototype / flow prototype",
		summary: "Describe an interactive prototype with states, user flows, and validation notes.",
		stats: ["{{FLOW_COUNT}} flows", "{{STATE_COUNT}} states", "{{TEST_DEVICE}} device"],
		sections: [
			["Scenario", ["{{User goal and starting state.}}", "{{Primary action path.}}"]],
			["Interaction Model", ["{{State transitions and controls.}}", "{{Error, empty, loading, and disabled behavior.}}"]],
			["Evaluation", ["{{What makes the prototype successful.}}", "{{Risks that should not ship unchanged.}}"]],
		],
		checklist: ["States are named", "Primary flow is testable", "Non-happy paths exist"],
	},
	{
		slug: "slide-deck",
		source: "09-slide-deck.html",
		title: "Engineering Slide Deck",
		category: "Presentation",
		route: "engineering deck / technical slides / presentation",
		summary: "Plan an assertion-evidence technical deck before building the visual slides.",
		stats: ["{{SLIDE_COUNT}} slides", "{{AUDIENCE}} audience", "{{TALK_LENGTH}} length"],
		sections: [
			["Narrative Arc", ["{{Opening assertion and why the audience should care.}}", "{{Middle proof sequence.}}", "{{Closing decision or takeaway.}}"]],
			["Slide Inventory", ["{{Slide 1: assertion, evidence, visual.}}", "{{Slide 2: assertion, evidence, visual.}}", "{{Slide N: assertion, evidence, visual.}}"]],
			["Speaker Notes", ["{{Timing, transitions, and anticipated questions.}}", "{{Evidence or appendix gaps.}}"]],
		],
		checklist: ["Titles make claims", "Evidence supports every claim", "Ask is clear"],
	},
	{
		slug: "svg-illustrations",
		source: "10-svg-illustrations.html",
		title: "SVG Illustrations",
		category: "Presentation",
		route: "svg illustration brief / technical illustration / visual explainer",
		summary: "Specify a technical illustration before drawing SVG assets.",
		stats: ["{{ILLUSTRATION_COUNT}} figures", "{{CANVAS_SIZE}} canvas", "{{STYLE_CONSTRAINT}} style"],
		sections: [
			["Visual Job", ["{{What the illustration must explain.}}", "{{What should be omitted to keep it readable.}}"]],
			["Composition", ["{{Primary objects, labels, hierarchy, and focal path.}}", "{{Color, stroke, typography, and responsive constraints.}}"]],
			["Export Notes", ["{{Where the SVG will be embedded.}}", "{{Accessibility label, title, and fallback requirements.}}"]],
		],
		checklist: ["Figure teaches more than prose", "Labels are legible", "A11y text exists"],
	},
	{
		slug: "status-report",
		source: "11-status-report.html",
		title: "Status Report",
		category: "Delivery",
		route: "status report / weekly update / project update",
		summary: "Summarize progress, blockers, confidence, and next actions for an engineering audience.",
		stats: ["{{REPORTING_PERIOD}}", "{{CONFIDENCE}} confidence", "{{BLOCKER_COUNT}} blockers"],
		sections: [
			["Executive Readout", ["{{What changed since the last update.}}", "{{Current confidence and why.}}"]],
			["Progress and Blockers", ["{{Shipped or completed work.}}", "{{Blocked or slipping work with owner and next action.}}"]],
			["Next Window", ["{{What happens next and what decision/help is needed.}}", "{{Validation or delivery milestones.}}"]],
		],
		checklist: ["Status is evidence-backed", "Blockers have owners", "Next action is explicit"],
	},
	{
		slug: "incident-report",
		source: "12-incident-report.html",
		title: "Incident Report",
		category: "Delivery",
		route: "incident report / postmortem / outage report",
		summary: "Capture incident impact, timeline, root cause, remediation, and follow-up owners.",
		stats: ["{{INCIDENT_DATE}}", "{{DURATION}} duration", "{{SEVERITY}} severity"],
		sections: [
			["Impact", ["{{Who or what was affected, for how long, and how it was detected.}}", "{{Customer, revenue, data, or operational impact.}}"]],
			["Timeline and Root Cause", ["{{Chronological timeline with timestamps.}}", "{{Root cause and contributing factors.}}"]],
			["Actions", ["{{Completed mitigations.}}", "{{Follow-up action items with owners and due dates.}}"]],
		],
		checklist: ["Impact quantified", "Timeline is dated", "Actions have owners"],
	},
	{
		slug: "flowchart-diagram",
		source: "13-flowchart-diagram.html",
		title: "Flowchart Diagram",
		category: "Diagram",
		route: "flowchart / decision flow / process diagram",
		summary: "Plan a flowchart so the embedded SVG has a clear focal path and decision structure.",
		stats: ["{{NODE_COUNT}} nodes", "{{DECISION_COUNT}} decisions", "{{FOCAL_PATH}} focal path"],
		sections: [
			["Flow Purpose", ["{{What process or decision the flowchart explains.}}", "{{Audience and expected use.}}"]],
			["Nodes and Branches", ["{{Start, end, and key process nodes.}}", "{{Decision branches and labels.}}"]],
			["Diagram Notes", ["{{Focal path, labels, and visual hierarchy.}}", "{{What should stay as prose instead of diagram.}}"]],
		],
		checklist: ["Start/end are clear", "Branch labels are verbs", "Focal path is visible"],
	},
	{
		slug: "research-feature-explainer",
		source: "14-research-feature-explainer.html",
		title: "Research · Feature Explainer",
		category: "Research",
		route: "feature explainer / technical research brief / product capability explainer",
		summary: "Explain a feature with context, mechanics, evidence, and implementation implications.",
		stats: ["{{FEATURE_NAME}}", "{{READING_TIME}} read", "{{EVIDENCE_COUNT}} sources"],
		sections: [
			["Context", ["{{What the feature is and why it matters now.}}", "{{Who needs to understand it.}}"]],
			["How It Works", ["{{Core mechanics, data flow, and dependencies.}}", "{{Diagram or example that makes the mechanism concrete.}}"]],
			["Implications", ["{{Product, engineering, operational, or risk implications.}}", "{{Open questions or source gaps.}}"]],
		],
		checklist: ["Mechanism is concrete", "Evidence is cited", "Implications are explicit"],
	},
	{
		slug: "research-concept-explainer",
		source: "15-research-concept-explainer.html",
		title: "Research · Concept Explainer",
		category: "Research",
		route: "concept explainer / technical concept / research note",
		summary: "Teach a technical concept with definitions, examples, misconceptions, and references.",
		stats: ["{{CONCEPT_NAME}}", "{{AUDIENCE_LEVEL}} level", "{{SOURCE_COUNT}} sources"],
		sections: [
			["Definition", ["{{Precise definition in plain language.}}", "{{What it is not.}}"]],
			["Worked Example", ["{{Concrete example, formula, code, or scenario.}}", "{{Why the example reveals the concept.}}"]],
			["Misconceptions and Sources", ["{{Common misconception and correction.}}", "{{Primary sources or further reading.}}"]],
		],
		checklist: ["Definition is precise", "Example is worked", "Source trail is visible"],
	},
	{
		slug: "implementation-plan",
		source: "16-implementation-plan.html",
		title: "Implementation Plan",
		category: "Planning",
		route: "implementation plan / engineering plan / rollout plan",
		summary: "Turn a target change into a decision-complete implementation plan.",
		stats: ["{{PHASE_COUNT}} phases", "{{OWNER}} owner", "{{RISK_LEVEL}} risk"],
		sections: [
			["Goal and Scope", ["{{What will be true when this is done.}}", "{{Explicitly out-of-scope work.}}"]],
			["Implementation Steps", ["{{Step 1: files/subsystems, behavior, and data flow.}}", "{{Step 2: files/subsystems, behavior, and data flow.}}", "{{Migration or compatibility notes.}}"]],
			["Validation and Rollout", ["{{Tests, checks, and manual acceptance scenarios.}}", "{{Rollout, monitoring, and rollback notes.}}"]],
		],
		checklist: ["Scope is bounded", "Steps are ordered", "Validation is concrete"],
	},
	{
		slug: "pr-writeup",
		source: "17-pr-writeup.html",
		title: "Pull Request Writeup",
		category: "Planning",
		route: "PR writeup / pull request description / change summary",
		summary: "Prepare a high-signal PR description with change summary, validation, and reviewer focus.",
		stats: ["{{PR_NUMBER}}", "{{FILES_CHANGED}} files", "{{VALIDATION_STATUS}} validation"],
		sections: [
			["Summary", ["{{What changed and why.}}", "{{User-visible or operator-visible behavior.}}"]],
			["Implementation Details", ["{{Key files, APIs, or data flow changes.}}", "{{Compatibility and migration notes.}}"]],
			["Validation", ["{{Commands run and results.}}", "{{Review focus and remaining risk.}}"]],
		],
		checklist: ["Why is clear", "Validation is exact", "Reviewer focus is named"],
	},
	{
		slug: "editor-triage-board",
		source: "18-editor-triage-board.html",
		title: "Editor · Triage Board",
		category: "Editor",
		route: "triage board / issue board / bug triage",
		summary: "Create a static triage board snapshot with priority, owner, evidence, and next action.",
		stats: ["{{ITEM_COUNT}} items", "{{P0_P1_COUNT}} urgent", "{{UPDATED_AT}} updated"],
		sections: [
			["Board Rules", ["{{How items are prioritized and moved.}}", "{{Definitions for severity and ownership.}}"]],
			["Queues", ["{{Now: highest priority items with owner and next action.}}", "{{Next: scheduled items with blocker or dependency.}}", "{{Later: parked items with revisit trigger.}}"]],
			["Decision Log", ["{{Decisions made during triage and why.}}", "{{Risks or unresolved questions.}}"]],
		],
		checklist: ["Every item has owner", "Severity definitions are explicit", "Next action exists"],
	},
	{
		slug: "editor-feature-flags",
		source: "19-editor-feature-flags.html",
		title: "Editor · Feature Flags",
		category: "Editor",
		route: "feature flag matrix / rollout controls / flag plan",
		summary: "Document feature flag state, audience, rollout controls, and cleanup plan.",
		stats: ["{{FLAG_COUNT}} flags", "{{ROLLOUT_PERCENT}} rollout", "{{CLEANUP_DATE}} cleanup"],
		sections: [
			["Flag Inventory", ["{{Flag name, owner, default, audience, and purpose.}}", "{{Dependencies or mutually exclusive flags.}}"]],
			["Rollout Plan", ["{{Ramp schedule, guardrails, and stop conditions.}}", "{{Monitoring signals and alert thresholds.}}"]],
			["Cleanup", ["{{Removal criteria and deadline.}}", "{{Code paths or docs to delete after rollout.}}"]],
		],
		checklist: ["Defaults are stated", "Stop condition exists", "Cleanup is scheduled"],
	},
	{
		slug: "editor-prompt-tuner",
		source: "20-editor-prompt-tuner.html",
		title: "Editor · Prompt Tuner",
		category: "Editor",
		route: "prompt tuning / prompt eval / AI instruction editor",
		summary: "Capture prompt variants, eval cases, failure modes, and chosen instruction changes.",
		stats: ["{{VARIANT_COUNT}} variants", "{{EVAL_CASES}} evals", "{{WINNER}} winner"],
		sections: [
			["Objective", ["{{Behavior the prompt should produce.}}", "{{Known failure modes or regressions.}}"]],
			["Variants and Evals", ["{{Variant A: instruction changes and result.}}", "{{Variant B: instruction changes and result.}}", "{{Eval cases, pass/fail notes, and observed tradeoffs.}}"]],
			["Selected Prompt", ["{{Chosen prompt text or delta.}}", "{{Residual risk and follow-up evals.}}"]],
		],
		checklist: ["Eval cases are real", "Prompt delta is explicit", "Regression risk is named"],
	},
];

function renderSections(sections) {
	return sections.map(([heading, prompts], index) => `\t<section>
\t\t<p class="section-kicker">${String(index + 1).padStart(2, "0")} · ${heading}</p>
\t\t<h2>${heading}</h2>
\t\t<div class="prompt-list">
${prompts.map((prompt, promptIndex) => `\t\t\t<div class="prompt-row">
\t\t\t\t<span>${String.fromCharCode(65 + promptIndex)}</span>
\t\t\t\t<p>${prompt}</p>
\t\t\t</div>`).join("\n")}
\t\t</div>
\t</section>`).join("\n");
}

function renderChecklist(items) {
	return items.map(item => `\t\t\t<li>${item}</li>`).join("\n");
}

function renderStats(items) {
	return items.map(item => `\t\t<div data-vpk-block><strong>${item}</strong><span>metric</span></div>`).join("\n");
}

function renderTemplate(def, sharedCss) {
	const html = `<!doctype html>
<!--
TEMPLATE · ${def.title} (vpk-html Phase 2)
Pattern reference: ${UPSTREAM}/blob/main/${def.source}
This is an original vpk-html template shell based on the upstream use-case
catalog. It does not copy upstream HTML, CSS, or prose.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{DOC_TITLE}}</title>
<meta name="author" content="{{AUTHOR}}">
<meta name="description" content="{{DESCRIPTION}}">
<meta name="keywords" content="{{KEYWORDS}}">
<meta name="generator" content="vpk-html">
${buildFaviconLinkBlock()}
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${sharedCss}

:root {
\t--parchment: var(--paper);
\t--ivory: var(--surface-raised);
\t--near-black: var(--ink);
\t--dark-warm: var(--ink);
\t--olive: var(--muted-text);
\t--stone: var(--subtlest-text);
\t--brand: var(--accent);
\t--border: var(--rule);
\t--tag-bg: var(--accent-soft);
\t--shadow-hard: var(--shadow);
\t--serif: ${FONT_STACKS.body};
\t--sans: var(--serif);
\t--mono: ${FONT_STACKS.mono};
\t--display: ${FONT_STACKS.display};
\t--numeric: ${FONT_STACKS.numeric};
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html {
\tbackground: var(--paper-background);
\tcolor: var(--near-black);
\tfont-family: "Geist Mono Numeric", var(--serif);
\tline-height: 1.6;
}

body {
\tbackground: var(--paper-background);
\tfont-size: 17px;
\tmin-height: 100vh;
}

a {
\tcolor: var(--link);
\ttext-decoration-line: underline;
\ttext-decoration-color: transparent;
\ttext-decoration-thickness: 0.08em;
\ttext-underline-offset: 0.18em;
\ttransition: color 180ms var(--ease-out), text-decoration-color 180ms var(--ease-out);
}

a:hover {
\tcolor: var(--ink);
\ttext-decoration-color: currentColor;
}

a:focus-visible {
\tborder-radius: 2px;
\tbox-shadow: 0 0 0 2px var(--focus-ring);
\toutline: 0;
\ttext-decoration-color: currentColor;
}

.page {
\tmargin: 0 auto;
\tmax-width: 48rem;
\tpadding: clamp(24px, 4vw, 48px);
}

.masthead {
\tborder-bottom: 1px solid var(--near-black);
\tdisplay: grid;
\tgap: 28px;
\tgrid-template-columns: minmax(0, 1fr) minmax(220px, 0.38fr);
\tpadding: 28px 0 34px;
}

.eyebrow,
.section-kicker {
\tcolor: var(--muted-text);
\tfont-family: var(--mono);
\tfont-size: 12px;
\tfont-weight: 600;
\tletter-spacing: 2px;
\tline-height: 1.4;
\ttext-transform: uppercase;
}

.source-label,
.stat span,
.prompt-row span,
.checklist h2 {
\tcolor: var(--muted-text);
\tfont-family: var(--serif);
\tfont-size: 13px;
\tfont-weight: 400;
\tletter-spacing: 0;
\tline-height: 1.4;
}

h1,
h2,
h3 {
\tcolor: var(--headline);
\tfont-family: var(--display);
\tfont-weight: 500;
\tletter-spacing: 0;
\tline-height: 1.18;
}

h1 {
\tfont-size: 36px;
\tmargin: 10px 0 16px;
}

.summary {
\tcolor: var(--dark-warm);
\tfont-size: 17px;
\tline-height: 1.6;
\tmax-width: 26em;
}

.meta-card {
\talign-self: end;
\tbackground: var(--ivory);
\tborder: 1px solid var(--near-black);
\tborder-radius: 6px;
\tbox-shadow: none;
\tpadding: 16px;
}

.meta-card p {
\tcolor: var(--olive);
\tfont-size: 14px;
\tline-height: 1.5;
\tmargin-top: 8px;
}

.stat {
\tborder-bottom: 1px solid var(--border);
\tdisplay: grid;
\tgap: 12px;
\tgrid-template-columns: repeat(3, minmax(0, 1fr));
\tpadding: 18px 0;
}

.stat div {
\tborder-right: 1px solid var(--border);
\tpadding-right: 14px;
}

.stat div:last-child { border-right: 0; }

.stat strong {
\tdisplay: block;
\tfont-family: var(--numeric);
\tfont-size: 15px;
\tfont-weight: 400;
\tline-height: 1.35;
}

main {
\tdisplay: grid;
\tgap: 34px;
\tpadding-top: 34px;
}

section {
\tbreak-inside: avoid;
\tborder-bottom: 1px solid var(--border);
\tdisplay: grid;
\tgap: 16px;
\tgrid-template-columns: minmax(0, 1fr);
\tpadding-bottom: 30px;
}

section h2 {
\tfont-size: 26px;
}

.prompt-list {
\tgrid-column: 1;
\tdisplay: grid;
\tgap: 10px;
}

.prompt-row {
\tbackground: color-mix(in srgb, var(--ivory) 82%, transparent);
\tborder: 1px solid var(--border);
\tborder-radius: 6px;
\tdisplay: grid;
\tgap: 12px;
\tgrid-template-columns: 32px minmax(0, 1fr);
\tpadding: 14px;
}

.prompt-row p {
\tcolor: var(--near-black);
\tfont-size: 17px;
\tline-height: 1.6;
}

.checklist {
\tbackground: var(--ivory);
\tborder: 1px solid var(--near-black);
\tborder-radius: 6px;
\tbox-shadow: none;
\tpadding: 18px;
}

.checklist ul {
\tdisplay: grid;
\tgap: 8px;
\tlist-style: none;
\tmargin-top: 12px;
}

.checklist li {
\tborder-top: 1px solid var(--border);
\tfont-size: 15px;
\tpadding-top: 8px;
}

@media print {
\tbody { background: var(--parchment); font-size: 10.5pt; }
\t.page { max-width: none; padding: 16mm 18mm; }
\t.meta-card,
\t.checklist { box-shadow: none; }
}

@media (max-width: 760px) {
\t.masthead,
\tsection,
\t.stat {
\t\tgrid-template-columns: 1fr;
\t}

\t.prompt-list { grid-column: 1; }
\t.stat div { border-bottom: 1px solid var(--border); border-right: 0; padding: 0 0 12px; }
\t.stat div:last-child { border-bottom: 0; padding-bottom: 0; }
}
</style>
</head>
<body>
<div class="page">
\t<main>
\t<header class="masthead">
\t\t<div>
\t\t\t<p class="eyebrow">${def.category} · Phase 2 engineering template</p>
\t\t\t<h1>{{DOC_TITLE}}</h1>
\t\t\t<p class="summary">${def.summary}</p>
\t\t</div>
\t\t<aside class="meta-card">
\t\t\t<p class="source-label">Route hint</p>
\t\t\t<p>${def.route}</p>
\t\t\t<p class="source-label" style="margin-top:14px">Owner</p>
\t\t\t<p>{{AUTHOR}} · {{TEAM_OR_CONTEXT}} · {{DATE}}</p>
\t\t</aside>
\t</header>

\t<div class="stat" aria-label="Document metrics">
${renderStats(def.stats)}
\t</div>

${renderSections(def.sections)}
\t\t<aside class="checklist">
\t\t\t<h2>Acceptance checklist</h2>
\t\t\t<ul>
${renderChecklist(def.checklist)}
\t\t\t</ul>
\t\t</aside>
\t</main>

</div>
</body>
</html>
`;
	return retrofitDocumentNav(html);
}

function main() {
	fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
	const sharedCss = `${buildFontFaceBlock()}\n${wrapSharedCss(readStylesCss())}`;
	for (const entry of CATALOG) {
		const target = path.join(TEMPLATES_DIR, `${entry.slug}.html`);
		fs.writeFileSync(target, renderTemplate(entry, sharedCss), "utf8");
		console.log(`wrote ${path.relative(process.cwd(), target)}`);
	}
	console.log(`${CATALOG.length} html-effectiveness template shells generated`);
}

main();
