"use client";

import type { RovoDataParts } from "@/lib/rovo-ui-messages";

export const SCREEN_ASSISTANT_TARGET_ATTR = "data-screen-assistant-target";
export const SCREEN_ASSISTANT_AGENT_FIELD_ATTR = "data-agent-field";

export type StudioScreenAssistantCoordinateSpace = "viewport";

export interface StudioScreenAssistantPoint {
	x: number;
	y: number;
	label: string;
	coordinateSpace?: StudioScreenAssistantCoordinateSpace;
}

export interface StudioScreenAssistantRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface StudioScreenAssistantRegionPoint {
	x: number;
	y: number;
}

export interface StudioScreenAssistantTarget {
	id?: string;
	fieldId?: string;
	label?: string;
	role?: string;
	rect?: StudioScreenAssistantRect;
}

export interface StudioScreenAssistantPointerContext {
	x: number | null;
	y: number | null;
	viewport: {
		width: number;
		height: number;
		scrollX: number;
		scrollY: number;
	};
	target: StudioScreenAssistantTarget | null;
}

export interface StudioScreenAssistantVisibleTarget extends StudioScreenAssistantTarget {
	id: string;
}

export interface StudioScreenAssistantRegion {
	createdAt: number;
	id: string;
	label: string;
	path: StudioScreenAssistantRegionPoint[];
	rect: StudioScreenAssistantRect;
	targetHints: StudioScreenAssistantVisibleTarget[];
}

export interface StudioScreenAssistantScreenContext {
	route: "/studio";
	activePanel: string;
	selectedAgent?: {
		id: string;
		name: string;
	};
	composer?: {
		placeholder?: string;
		hasPrefill?: boolean;
	};
	activeAgentDraft?: Pick<
		RovoDataParts["agent-result"],
		| "agentId"
		| "name"
		| "description"
		| "summary"
		| "instructions"
		| "contextDescription"
		| "trigger"
		| "guardrail"
		| "tools"
		| "triggers"
		| "skills"
		| "apps"
		| "knowledge"
		| "subagents"
		| "avatarSrc"
		| "memoryMode"
		| "reasoningMode"
		| "knowledgeMode"
		| "conversationStarters"
		| "action"
	>;
}

export interface StudioScreenAssistantSnapshot {
	activeRegion?: StudioScreenAssistantRegion;
	screenContext: StudioScreenAssistantScreenContext;
	pointerContext: StudioScreenAssistantPointerContext | null;
	visibleTargets: StudioScreenAssistantVisibleTarget[];
}

export interface StudioScreenAssistantResult {
	turnId: string;
	text: string;
	point?: StudioScreenAssistantPoint;
	target?: StudioScreenAssistantTarget;
	agentDraftPatch?: Partial<RovoDataParts["agent-result"]>;
}

export interface StudioScreenAssistantSnapshotInput {
	activeAgentDraft?: RovoDataParts["agent-result"] | null;
	activeRegion?: StudioScreenAssistantRegion | null;
	activePanel: string;
	composer?: {
		placeholder?: string;
		hasPrefill?: boolean;
	};
	pointer?: {
		x: number;
		y: number;
	} | null;
	selectedAgent?: {
		id: string;
		name: string;
	} | null;
}

function normalizeText(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSearchText(value: unknown): string | undefined {
	const normalized = normalizeText(value)
		?.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
	return normalized && normalized.length > 0 ? normalized : undefined;
}

function getSearchTokens(value: unknown): string[] {
	return normalizeSearchText(value)?.split(/\s+/u).filter(Boolean) ?? [];
}

function textMatchesSearch(candidate: unknown, query: string): boolean {
	const normalizedCandidate = normalizeSearchText(candidate);
	const normalizedQuery = normalizeSearchText(query);
	if (!normalizedCandidate || !normalizedQuery) {
		return false;
	}
	if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
		return true;
	}

	const candidateTokens = new Set(getSearchTokens(normalizedCandidate));
	const queryTokens = getSearchTokens(normalizedQuery);
	return queryTokens.length > 0 && queryTokens.every((token) => candidateTokens.has(token));
}

function targetMatchesSearch(target: StudioScreenAssistantTarget, query: string): boolean {
	return [target.id, target.fieldId, target.label, ...getTargetSearchAliases(target)].some((candidate) =>
		textMatchesSearch(candidate, query),
	);
}

function labelReferencesActiveRegion(label: string | undefined): boolean {
	const normalizedLabel = normalizeSearchText(label);
	if (!normalizedLabel) {
		return false;
	}

	return [
		"this",
		"this area",
		"this part",
		"highlighted area",
		"highlighted part",
		"painted area",
		"painted part",
		"selected area",
		"selected part",
		"region",
	].some((candidate) => textMatchesSearch(candidate, normalizedLabel));
}

const SCREEN_ASSISTANT_FIELD_ALIASES: Record<string, readonly string[]> = {
	avatar: ["agent avatar", "change agent avatar", "avatar picker", "profile avatar"],
	name: ["agent name", "name field", "agent title"],
	description: ["agent description", "description field"],
	instructions: ["agent instructions", "instructions field"],
};

function getTargetSearchAliases(target: StudioScreenAssistantTarget): readonly string[] {
	if (!target.fieldId) {
		return [];
	}

	return SCREEN_ASSISTANT_FIELD_ALIASES[target.fieldId] ?? [];
}

function normalizeRect(rect: DOMRect | ClientRect): StudioScreenAssistantRect | null {
	if (rect.width <= 0 || rect.height <= 0) {
		return null;
	}
	return {
		x: Math.round(rect.x),
		y: Math.round(rect.y),
		width: Math.round(rect.width),
		height: Math.round(rect.height),
	};
}

function getElementText(element: Element): string | undefined {
	const ariaLabel = normalizeText(element.getAttribute("aria-label"));
	if (ariaLabel) {
		return ariaLabel;
	}

	const labelledBy = normalizeText(element.getAttribute("aria-labelledby"));
	if (labelledBy && typeof document !== "undefined") {
		const label = labelledBy
			.split(/\s+/u)
			.map((id) => document.getElementById(id)?.textContent ?? "")
			.join(" ");
		const normalizedLabel = normalizeText(label);
		if (normalizedLabel) {
			return normalizedLabel;
		}
	}

	const placeholder = normalizeText((element as { placeholder?: unknown }).placeholder);
	if (placeholder) {
		return placeholder;
	}

	const title = normalizeText(element.getAttribute("title"));
	if (title) {
		return title;
	}

	const innerText = normalizeText((element as { innerText?: unknown }).innerText);
	if (innerText) {
		return innerText.slice(0, 160);
	}

	return normalizeText(element.textContent)?.slice(0, 160);
}

function targetFromElement(element: Element): StudioScreenAssistantTarget | null {
	const rect = normalizeRect(element.getBoundingClientRect());
	if (!rect) {
		return null;
	}

	const id =
		normalizeText(element.getAttribute(SCREEN_ASSISTANT_TARGET_ATTR)) ??
		normalizeText(element.getAttribute("data-testid")) ??
		normalizeText(element.id);
	const fieldId = normalizeText(element.getAttribute(SCREEN_ASSISTANT_AGENT_FIELD_ATTR));
	const label = getElementText(element);
	const role = normalizeText(element.getAttribute("role")) ?? element.tagName.toLowerCase();

	return {
		...(id ? { id } : {}),
		...(fieldId ? { fieldId } : {}),
		...(label ? { label } : {}),
		role,
		rect,
	};
}

export function getStudioScreenAssistantPointerContext(
	pointer?: { x: number; y: number } | null,
): StudioScreenAssistantPointerContext | null {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return null;
	}

	const viewport = {
		width: window.innerWidth,
		height: window.innerHeight,
		scrollX: window.scrollX,
		scrollY: window.scrollY,
	};
	const x = pointer ? Math.round(pointer.x) : null;
	const y = pointer ? Math.round(pointer.y) : null;
	const element = x !== null && y !== null ? document.elementFromPoint(x, y) : null;

	return {
		x,
		y,
		viewport,
		target: element ? targetFromElement(element) : null,
	};
}

// Interactive/landmark elements worth surfacing to the model even when they
// are not explicitly tagged with a screen-assistant attribute. This lets the
// assistant "see" and point at general chrome (profile avatar, nav, search,
// Create button, agent cards) — not only the composer.
const AUTO_TARGET_SELECTOR = [
	"button",
	"a[href]",
	"[role='button']",
	"[role='link']",
	"[role='tab']",
	"[role='menuitem']",
	"[role='switch']",
	"input:not([type='hidden'])",
	"select",
	"textarea",
	"img[alt]",
	"[aria-label]",
	"[data-testid]",
].join(", ");

function isVisibleInViewport(element: Element): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	const rect = element.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) {
		return false;
	}
	// Must intersect the current viewport.
	if (
		rect.bottom <= 0 ||
		rect.right <= 0 ||
		rect.top >= window.innerHeight ||
		rect.left >= window.innerWidth
	) {
		return false;
	}
	const style = window.getComputedStyle(element);
	if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") {
		return false;
	}
	return true;
}

function slugifyTargetId(role: string, label: string): string {
	const base = `${role}-${label}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/(^-+|-+$)/gu, "")
		.slice(0, 60);
	return `auto:${base || role}`;
}

function getTargetIdForElement(
	element: Element,
	target = targetFromElement(element),
): string | null {
	if (!target) {
		return null;
	}
	return target.id ?? (target.label ? slugifyTargetId(target.role ?? "element", target.label) : null);
}

export function getStudioScreenAssistantVisibleTargets(
	limit = 60,
): StudioScreenAssistantVisibleTarget[] {
	if (typeof document === "undefined") {
		return [];
	}

	const targets: StudioScreenAssistantVisibleTarget[] = [];
	const seenElements = new Set<Element>();
	const seenIds = new Set<string>();

	const push = (element: Element, id: string, target: StudioScreenAssistantTarget) => {
		if (seenElements.has(element) || seenIds.has(id)) {
			return;
		}
		seenElements.add(element);
		seenIds.add(id);
		targets.push({ ...target, id });
	};

	// 1) Explicitly tagged targets take priority (stable ids/fieldIds).
	const tagged = Array.from(
		document.querySelectorAll(
			`[${SCREEN_ASSISTANT_TARGET_ATTR}], [${SCREEN_ASSISTANT_AGENT_FIELD_ATTR}]`,
		),
	);
	for (const element of tagged) {
		if (targets.length >= limit) {
			return targets;
		}
		const target = targetFromElement(element);
		const id =
			target?.id ??
			target?.fieldId ??
			normalizeText(element.getAttribute(SCREEN_ASSISTANT_TARGET_ATTR)) ??
			normalizeText(element.getAttribute(SCREEN_ASSISTANT_AGENT_FIELD_ATTR));
		if (target && id) {
			push(element, id, target);
		}
	}

	// 2) Auto-detected interactive/landmark elements visible in the viewport.
	const auto = Array.from(document.querySelectorAll(AUTO_TARGET_SELECTOR));
	for (const element of auto) {
		if (targets.length >= limit) {
			break;
		}
		if (seenElements.has(element) || !isVisibleInViewport(element)) {
			continue;
		}
		const target = targetFromElement(element);
		if (!target) {
			continue;
		}
		// Require something the model can refer to: a label, an explicit id, or a
		// test id. Skip unlabeled structural noise.
		const label = target.label;
		const id = getTargetIdForElement(element, target);
		if (!id || (!label && !target.id)) {
			continue;
		}
		push(element, id, target);
	}

	return targets;
}

export function groundStudioScreenAssistantTarget(input: {
	activeRegion?: StudioScreenAssistantRegion | null;
	fieldId?: string;
	id?: string;
	label?: string;
	pointerTarget?: StudioScreenAssistantTarget | null;
	visibleTargets: readonly StudioScreenAssistantVisibleTarget[];
}): StudioScreenAssistantTarget | null {
	const hasExplicitLocator = Boolean(
		normalizeText(input.id) ?? normalizeText(input.fieldId) ?? normalizeText(input.label),
	);

	const byId = input.id
		? input.visibleTargets.find((target) => target.id === input.id)
		: null;
	if (byId) {
		return byId;
	}

	const byField = input.fieldId
		? input.visibleTargets.find((target) => target.fieldId === input.fieldId || target.id === input.fieldId)
		: null;
	if (byField) {
		return byField;
	}

	const normalizedLabel = normalizeText(input.label);
	const byLabel = normalizedLabel
		? input.visibleTargets.find((target) => targetMatchesSearch(target, normalizedLabel))
		: null;
	if (byLabel) {
		return byLabel;
	}

	if (normalizedLabel && labelReferencesActiveRegion(normalizedLabel)) {
		return input.activeRegion?.targetHints[0] ?? null;
	}

	if (hasExplicitLocator) {
		return null;
	}

	return input.pointerTarget ?? null;
}

function escapeAttributeSelectorValue(value: string): string {
	return value
		.replace(/\\/gu, "\\\\")
		.replace(/"/gu, '\\"')
		.replace(/\n/gu, "\\a ");
}

function queryScreenAssistantTargetElement(id: string): Element | null {
	if (typeof document === "undefined") {
		return null;
	}
	const escapedId = escapeAttributeSelectorValue(id);
	const directlyTagged = document.querySelector(
		`[${SCREEN_ASSISTANT_TARGET_ATTR}="${escapedId}"], [data-testid="${escapedId}"], [id="${escapedId}"]`,
	);
	if (directlyTagged) {
		return directlyTagged;
	}

	return Array.from(document.querySelectorAll(AUTO_TARGET_SELECTOR)).find((element) => (
		isVisibleInViewport(element) && getTargetIdForElement(element) === id
	)) ?? null;
}

function queryAgentFieldElement(fieldId: string): Element | null {
	if (typeof document === "undefined") {
		return null;
	}
	const escapedFieldId = escapeAttributeSelectorValue(fieldId);
	return document.querySelector(
		`[${SCREEN_ASSISTANT_AGENT_FIELD_ATTR}="${escapedFieldId}"], [${SCREEN_ASSISTANT_TARGET_ATTR}="${escapedFieldId}"]`,
	);
}

function queryElementForGroundedTarget(target: StudioScreenAssistantTarget | null): Element | null {
	if (!target) {
		return null;
	}
	if (target.id) {
		const byId = queryScreenAssistantTargetElement(target.id);
		if (byId) {
			return byId;
		}
	}
	if (target.fieldId) {
		return queryAgentFieldElement(target.fieldId);
	}
	return null;
}

function pickActivatedTarget(
	target: StudioScreenAssistantTarget | null,
): Pick<StudioScreenAssistantTarget, "fieldId" | "id" | "label"> | null {
	if (!target) {
		return null;
	}
	return {
		...(target.fieldId ? { fieldId: target.fieldId } : {}),
		...(target.id ? { id: target.id } : {}),
		...(target.label ? { label: target.label } : {}),
	};
}

export function activateStudioScreenAssistantTarget(input: {
	fieldId?: string;
	id?: string;
	label?: string;
	pointerTarget?: StudioScreenAssistantTarget | null;
	visibleTargets: readonly StudioScreenAssistantVisibleTarget[];
}): {
	activated: Pick<StudioScreenAssistantTarget, "fieldId" | "id" | "label"> | null;
	error?: string;
	ok: boolean;
} {
	if (typeof document === "undefined") {
		return { activated: null, error: "document_unavailable", ok: false };
	}

	const directElement =
		input.id ? queryScreenAssistantTargetElement(input.id) : input.fieldId ? queryAgentFieldElement(input.fieldId) : null;
	const grounded = directElement
		? targetFromElement(directElement)
		: groundStudioScreenAssistantTarget(input);
	const element = directElement ?? queryElementForGroundedTarget(grounded);
	if (!element) {
		return { activated: null, error: "target_not_found", ok: false };
	}

	const scrollIntoView = (element as { scrollIntoView?: (options?: ScrollIntoViewOptions) => void }).scrollIntoView;
	scrollIntoView?.call(element, { block: "center", inline: "nearest" });
	const click = (element as { click?: () => void }).click;
	if (typeof click !== "function") {
		return {
			activated: pickActivatedTarget(grounded),
			error: "target_not_activatable",
			ok: false,
		};
	}

	click.call(element);
	const activated = targetFromElement(element) ?? grounded;
	return {
		activated: pickActivatedTarget(activated),
		ok: true,
	};
}

export function getStudioScreenAssistantRegionRect(
	path: readonly StudioScreenAssistantRegionPoint[],
): StudioScreenAssistantRect | null {
	const points = path.filter((point) => (
		Number.isFinite(point.x) &&
		Number.isFinite(point.y)
	));
	if (points.length < 2) {
		return null;
	}

	let minX = points[0]?.x ?? 0;
	let minY = points[0]?.y ?? 0;
	let maxX = minX;
	let maxY = minY;
	for (const point of points) {
		minX = Math.min(minX, point.x);
		minY = Math.min(minY, point.y);
		maxX = Math.max(maxX, point.x);
		maxY = Math.max(maxY, point.y);
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

function rectsIntersect(a: StudioScreenAssistantRect, b: StudioScreenAssistantRect): boolean {
	const aRight = a.x + a.width;
	const aBottom = a.y + a.height;
	const bRight = b.x + b.width;
	const bBottom = b.y + b.height;

	return a.x <= bRight && aRight >= b.x && a.y <= bBottom && aBottom >= b.y;
}

export function getStudioScreenAssistantRegionTargetHints(input: {
	rect: StudioScreenAssistantRect;
	visibleTargets: readonly StudioScreenAssistantVisibleTarget[];
}): StudioScreenAssistantVisibleTarget[] {
	return input.visibleTargets.filter((target) => (
		target.rect ? rectsIntersect(input.rect, target.rect) : false
	));
}

export function createStudioScreenAssistantRegion(input: {
	createdAt?: number;
	id: string;
	label?: string;
	path: readonly StudioScreenAssistantRegionPoint[];
	visibleTargets: readonly StudioScreenAssistantVisibleTarget[];
}): StudioScreenAssistantRegion | null {
	const rect = getStudioScreenAssistantRegionRect(input.path);
	if (!rect || rect.width < 4 || rect.height < 4) {
		return null;
	}

	const path = input.path
		.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
		.map((point) => ({ x: point.x, y: point.y }));

	return {
		createdAt: input.createdAt ?? Date.now(),
		id: input.id,
		label: input.label ?? "Painted screen area",
		path,
		rect,
		targetHints: getStudioScreenAssistantRegionTargetHints({
			rect,
			visibleTargets: input.visibleTargets,
		}),
	};
}

function summarizeAgentDraft(
	draft: RovoDataParts["agent-result"] | null | undefined,
): StudioScreenAssistantScreenContext["activeAgentDraft"] | undefined {
	if (!draft) {
		return undefined;
	}

	return {
		agentId: draft.agentId,
		name: draft.name,
		description: draft.description,
		summary: draft.summary,
		instructions: draft.instructions,
		contextDescription: draft.contextDescription,
		trigger: draft.trigger,
		guardrail: draft.guardrail,
		tools: draft.tools,
		triggers: draft.triggers,
		// Capability arrays + modes + avatar are surfaced so the model can make
		// ADDITIVE edits: apply_agent_draft_patch replaces a field's whole array, so
		// to "add a skill" the model must read the current names and resend them all.
		skills: draft.skills,
		apps: draft.apps,
		knowledge: draft.knowledge,
		subagents: draft.subagents,
		avatarSrc: draft.avatarSrc,
		memoryMode: draft.memoryMode,
		reasoningMode: draft.reasoningMode,
		knowledgeMode: draft.knowledgeMode,
		conversationStarters: draft.conversationStarters,
		action: draft.action,
	};
}

export function createStudioScreenAssistantSnapshot({
	activeAgentDraft,
	activeRegion,
	activePanel,
	composer,
	pointer,
	selectedAgent,
}: StudioScreenAssistantSnapshotInput): StudioScreenAssistantSnapshot {
	const visibleTargets = getStudioScreenAssistantVisibleTargets();

	return {
		...(activeRegion ? { activeRegion } : {}),
		screenContext: {
			route: "/studio",
			activePanel,
			...(selectedAgent ? { selectedAgent } : {}),
			...(composer ? { composer } : {}),
			...(activeAgentDraft ? { activeAgentDraft: summarizeAgentDraft(activeAgentDraft) } : {}),
		},
		pointerContext: getStudioScreenAssistantPointerContext(pointer),
		visibleTargets,
	};
}

/** A screen-assistant tool call the Realtime session asks a shell to run. */
export type StudioScreenAssistantToolCall = {
	args: Record<string, unknown>;
	callId: string;
	name: string;
};

export type StudioScreenAssistantToolResponder = (output: unknown, createResponse?: boolean) => void;

/** The centre of a grounded target, in viewport coordinates, for the Clicky cursor to point at. */
export function getViewportPointFromScreenAssistantTarget(
	target: StudioScreenAssistantTarget | null | undefined,
): { x: number; y: number; label: string; coordinateSpace: "viewport" } | null {
	if (!target?.rect) {
		return null;
	}

	return {
		x: target.rect.x + target.rect.width / 2,
		y: target.rect.y + target.rect.height / 2,
		label: target.label ?? target.fieldId ?? target.id ?? "Target",
		coordinateSpace: "viewport",
	};
}
