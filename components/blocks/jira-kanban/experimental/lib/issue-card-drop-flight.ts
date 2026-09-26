import { animateSessionChipDrop } from "@/components/blocks/jira-dropzone/lib/session-chip-drop-flight";
import { JIRA_DROPZONE_FULL_MOTION_PROFILE } from "@/components/blocks/jira-dropzone/lib/jira-dropzone-motion";
import { token } from "@/lib/tokens";
import { resolveVisibleIssueDropCodes } from "./board-card-arrival";
import { createIssueFacePreview } from "./issue-drag-preview";

export interface IssueDropPoint { readonly x: number; readonly y: number }
export interface IssueCardDropFlight {
	readonly code: string;
	readonly node: HTMLElement;
	readonly from: IssueDropPoint;
}

function findColumn(root: HTMLElement, title: string): HTMLElement | undefined {
	return [...root.querySelectorAll<HTMLElement>("[data-jira-kanban-column]")].find((node) => node.dataset.jiraKanbanColumn === title);
}

function findFace(root: HTMLElement, code: string): HTMLElement | undefined {
	return [...root.querySelectorAll<HTMLElement>('[data-slot="jira-issue-card"]')].find((node) => node.closest<HTMLElement>("[data-issue-key]")?.dataset.issueKey === code);
}

export function hasIssueDropTarget(root: HTMLElement, title: string, code: string): boolean {
	const column = findColumn(root, title);
	return column ? findFace(column, code) !== undefined : false;
}

export function resolveIssueDropLandingPoint(root: HTMLElement, title: string, code: string): IssueDropPoint | null {
	const column = findColumn(root, title);
	if (!column?.isConnected) return null;
	const face = findFace(column, code)?.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]');
	const bounds = (face ?? column.querySelector('[data-slot="board-column-header"]') ?? column).getBoundingClientRect();
	if (bounds.width <= 0 || bounds.height <= 0) return null;
	// Pending faces are scaled by their entrance; land at their unscaled centre.
	return { x: bounds.left + bounds.width / 2, y: bounds.top + (face ? face.offsetHeight / 2 : Math.min(40, bounds.height / 2)) };
}

/** Freeze the held traveller before commit; auto arrange can split its issues across columns. */
export function captureIssueCardDropFlights({ root, preview, nativePreview, pointer, grabOffset, grabbed, codes, allCards = false }: Readonly<{
	root: HTMLElement;
	preview: HTMLElement | null;
	nativePreview: HTMLElement | null;
	pointer: IssueDropPoint | null;
	grabOffset: IssueDropPoint;
	grabbed: string;
	codes: readonly string[];
	/** Auto arrange sends every issue to its own suggestion. Manual drops keep one cohort flight. */
	allCards?: boolean;
}>): IssueCardDropFlight[] {
	const lead = preview?.querySelector<HTMLElement>("[data-issue-cohort-front]");
	const travellerBounds = lead?.getBoundingClientRect();
	const visible = allCards ? codes : resolveVisibleIssueDropCodes(codes, grabbed);
	return visible.flatMap((code) => {
		const source = findFace(root, code);
		if (!source) return [];
		const surface = source.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]') ?? source;
		const bounds = surface.getBoundingClientRect();
		const width = lead?.offsetWidth || bounds.width;
		const height = code === grabbed ? lead?.offsetHeight || bounds.height : bounds.height;
		const from = travellerBounds ? { x: travellerBounds.left + travellerBounds.width / 2, y: travellerBounds.top + travellerBounds.height / 2 }
			: pointer ? { x: pointer.x - grabOffset.x + width / 2, y: pointer.y - grabOffset.y + height / 2 }
			: { x: bounds.left + width / 2, y: bounds.top + height / 2 };
		const useTravellerFace = code === grabbed && lead;
		const face = useTravellerFace ? lead.cloneNode(true) as HTMLElement : createIssueFacePreview(source, code === grabbed ? nativePreview ?? undefined : undefined);
		const rotation = useTravellerFace ? new DOMMatrix(getComputedStyle(lead).transform) : new DOMMatrix();
		rotation.m41 = rotation.m42 = 0;
		for (const attribute of ["data-issue-drag-preview", "data-issue-cohort-front", "data-issue-deck-layer"]) face.removeAttribute(attribute);
		Object.assign(face.style, {
			position: "relative", inset: "auto", left: "0", top: "0", width: `${width}px`, height: `${height}px`,
			transform: rotation.toString(), transformOrigin: "center", opacity: "1", visibility: "visible",
			boxShadow: token("elevation.shadow.overlay"), pointerEvents: "none", zIndex: "auto",
		});
		const node = root.ownerDocument.createElement("div");
		node.className = "pointer-events-none fixed left-0 top-0";
		node.dataset.issueDropFlight = code;
		node.dataset.issueDropFlightIndex = "0";
		node.setAttribute("aria-hidden", "true");
		node.inert = true;
		Object.assign(node.style, { width: "0", height: "0", zIndex: "1003", transform: `translate3d(${from.x}px, ${from.y}px, 0)`, transformOrigin: "0 0" });
		const center = root.ownerDocument.createElement("div");
		Object.assign(center.style, { position: "absolute", width: `${width}px`, height: `${height}px`, transform: "translate(-50%, -50%)" });
		center.append(face);
		node.append(center);
		return { code, node, from };
	});
}

/** Jira Linking's upward toss and falling absorption, followed by the real issue entrance. */
export function startIssueCardDropFlights(root: HTMLElement, title: string, flights: readonly IssueCardDropFlight[], onLanded: (code: string) => void, onFinished: () => void): () => void {
	let remaining = flights.length;
	const cleanups = flights.map((flight) => {
		root.ownerDocument.body.append(flight.node);
		const stop = animateSessionChipDrop(flight.node, {
			from: flight.from,
			durationMs: JIRA_DROPZONE_FULL_MOTION_PROFILE.durationMs,
			resolveLandingPoint: () => resolveIssueDropLandingPoint(root, title, flight.code),
			onLanded: () => {
				flight.node.remove();
				onLanded(flight.code);
				if (--remaining === 0) onFinished();
			},
		});
		return () => { stop(); flight.node.remove(); };
	});
	return () => cleanups.forEach((cleanup) => cleanup());
}
