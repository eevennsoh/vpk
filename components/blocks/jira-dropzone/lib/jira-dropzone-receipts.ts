import type {
	FlightProfile,
	JiraDropzoneChannel,
	JiraDropzoneFieldEvent,
	JiraDropzoneFieldState,
	JiraDropzoneBouncePlayback,
	JiraDropzoneDropPlayback,
	JiraDropzonePhase,
	JiraDropzonePhaseInput,
	JiraDropzoneReceiveOutcome,
	QueuedDropzoneReceive,
	SessionDropReceipt,
	SessionFlight,
	SessionFlightKey,
	SessionReceiptId,
	SessionReceiptIdParts,
	ViewportPoint,
} from "./jira-dropzone-types";

const EMPTY_CHANNEL: JiraDropzoneChannel = {
	flights: [],
	impacts: 0,
	lastReceipt: null,
	queued: [],
	settling: false,
};

export const JIRA_DROPZONE_FIELD_INITIAL_STATE: JiraDropzoneFieldState = {
	channels: new Map(),
	latestReceipt: null,
	seen: new Set(),
};

export function sessionReceiptId(parts: SessionReceiptIdParts): SessionReceiptId {
	return `${parts.cohortKey}::${parts.title}::${parts.from.x},${parts.from.y}` as SessionReceiptId;
}

export function resolveJiraDropzonePhase(input: JiraDropzonePhaseInput): JiraDropzonePhase {
	if (input.receiving && input.holdOpenWhileReceiving !== false) {
		return "receiving";
	}
	if (input.drag === "armed") {
		return "armed";
	}
	if (input.proximate && input.drag !== "idle") {
		return "proximate";
	}
	if (input.drag === "active") {
		return "active";
	}
	return "resting";
}

export function resolveJiraDropzoneSurface(
	phase: JiraDropzonePhase,
	holdingOpen: boolean,
): "open" | "resting" {
	return phase === "resting" && !holdingOpen ? "resting" : "open";
}

export function resolveJiraDropzoneCopy(
	phase: JiraDropzonePhase,
): "label" | "none" {
	return phase === "resting" ? "none" : "label";
}

export function resolveJiraDropzoneDrop(
	receipt: SessionDropReceipt | null | undefined,
): JiraDropzoneDropPlayback {
	return receipt?.drop ?? "cohort";
}

export function resolveJiraDropzoneBounce(
	receipt: SessionDropReceipt | null | undefined,
): JiraDropzoneBouncePlayback {
	return receipt?.bounce ?? "once";
}

export function shouldImpulseDropzoneChrome(input: {
	readonly bounce: JiraDropzoneBouncePlayback;
	readonly impacts: number;
	readonly receiving: boolean;
}): boolean {
	return input.bounce !== "off" && input.impacts > 0 && input.receiving;
}

export const JIRA_DROPZONE_COLLAPSE_MS = 150;

export function resolveJiraDropzoneCollapseMs(
	shouldReduceMotion: boolean | null,
): number {
	return shouldReduceMotion ? 0 : JIRA_DROPZONE_COLLAPSE_MS;
}

export function isReceiving(channel: JiraDropzoneChannel | undefined): boolean {
	if (!channel) {
		return false;
	}
	return channel.flights.length > 0 || channel.settling || channel.queued.length > 0;
}

export function settlingChannelTitles(state: JiraDropzoneFieldState): readonly string[] {
	return [...state.channels]
		.filter(([, channel]) => channel.settling && channel.flights.length === 0)
		.map(([title]) => title);
}

export function classifyReceipt(
	state: JiraDropzoneFieldState,
	receipt: SessionDropReceipt,
): JiraDropzoneReceiveOutcome {
	if (!state.channels.has(receipt.title)) {
		return "no-dropzone";
	}
	if (state.seen.has(receipt.id)) {
		return "duplicate";
	}
	return "accepted";
}

export function jiraDropzoneFieldReducer(
	state: JiraDropzoneFieldState,
	event: JiraDropzoneFieldEvent,
): JiraDropzoneFieldState {
	switch (event.kind) {
		case "register":
			return registerChannel(state, event.title);
		case "unregister":
			return unregisterChannel(state, event.title);
		case "receive":
			return receiveReceipt(state, event.receipt, event.profile);
		case "land":
			return landFlight(state, event.title, event.flightKey);
		case "settle":
			return settleChannel(state, event.title);
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
}

function registerChannel(state: JiraDropzoneFieldState, title: string): JiraDropzoneFieldState {
	if (state.channels.has(title)) {
		return state;
	}
	const channels = new Map(state.channels);
	channels.set(title, EMPTY_CHANNEL);
	return { ...state, channels };
}

function unregisterChannel(state: JiraDropzoneFieldState, title: string): JiraDropzoneFieldState {
	if (!state.channels.has(title)) {
		return state;
	}
	const channels = new Map(state.channels);
	channels.delete(title);
	return { ...state, channels };
}

function receiveReceipt(
	state: JiraDropzoneFieldState,
	receipt: SessionDropReceipt,
	profile: FlightProfile,
): JiraDropzoneFieldState {
	if (classifyReceipt(state, receipt) !== "accepted") {
		return state;
	}
	const channel = state.channels.get(receipt.title);
	if (!channel) {
		return state;
	}
	const seen = new Set(state.seen);
	seen.add(receipt.id);
	const channels = new Map(state.channels);
	channels.set(
		receipt.title,
		isReceiving(channel)
			? { ...channel, queued: [...channel.queued, { profile, receipt }] }
			: startReceive(channel, receipt, profile),
	);
	return { channels, latestReceipt: receipt, seen };
}

function landFlight(
	state: JiraDropzoneFieldState,
	title: string,
	flightKey: SessionFlightKey,
): JiraDropzoneFieldState {
	const channel = state.channels.get(title);
	if (!channel) {
		return state;
	}
	const landed = channel.flights.find((flight) => flight.key === flightKey);
	if (!landed) {
		return state;
	}
	const flights = channel.flights.filter((flight) => flight.key !== flightKey);
	const channels = new Map(state.channels);
	channels.set(
		title,
		finishReceiveAfterLand(channel, flights, impactsAfterLand(channel, landed)),
	);
	return { ...state, channels };
}

function settleChannel(state: JiraDropzoneFieldState, title: string): JiraDropzoneFieldState {
	const channel = state.channels.get(title);
	if (!channel || !channel.settling || channel.flights.length > 0) {
		return state;
	}
	const channels = new Map(state.channels);
	channels.set(title, advanceQueuedReceive(channel));
	return { ...state, channels };
}

function finishReceiveAfterLand(
	channel: JiraDropzoneChannel,
	flights: readonly SessionFlight[],
	impacts: number,
): JiraDropzoneChannel {
	const landed = { ...channel, flights, impacts };
	if (flights.length > 0) {
		return landed;
	}
	const bounce = resolveJiraDropzoneBounce(channel.lastReceipt);
	switch (bounce) {
		case "off":
			return advanceQueuedReceive(landed);
		case "each":
		case "once":
			return { ...landed, settling: true };
		default: {
			const exhaustive: never = bounce;
			return exhaustive;
		}
	}
}

function advanceQueuedReceive(channel: JiraDropzoneChannel): JiraDropzoneChannel {
	const [nextQueued, ...remaining] = channel.queued;
	return nextQueued
		? startReceive(channel, nextQueued.receipt, nextQueued.profile, remaining)
		: { ...channel, settling: false };
}

function startReceive(
	channel: JiraDropzoneChannel,
	receipt: SessionDropReceipt,
	profile: FlightProfile,
	queued: readonly QueuedDropzoneReceive[] = [],
): JiraDropzoneChannel {
	return {
		...channel,
		flights: flightsFromReceipt(receipt, profile),
		lastReceipt: receipt,
		queued,
		settling: false,
	};
}

export function flightsFromReceipt(
	receipt: SessionDropReceipt,
	profile: FlightProfile,
): readonly SessionFlight[] {
	const drop = resolveJiraDropzoneDrop(receipt);
	switch (drop) {
		case "cohort":
			return [{
				delayMs: 0,
				from: receipt.from,
				key: `${receipt.id}` as SessionFlightKey,
				members: receipt.members,
				receiptId: receipt.id,
			}];
		case "stagger":
			return receipt.members.map((member, index) => ({
				delayMs: index * profile.staggerMs,
				from: fanLaunch(receipt.from, index, receipt.members.length, profile.launchSpreadPx),
				key: `${receipt.id}:${member.id}:${index}` as SessionFlightKey,
				members: [member] as SessionDropReceipt["members"],
				receiptId: receipt.id,
			}));
		default: {
			const exhaustive: never = drop;
			return exhaustive;
		}
	}
}

function impactsAfterLand(
	channel: JiraDropzoneChannel,
	landed: SessionFlight,
): number {
	const bounce = resolveJiraDropzoneBounce(channel.lastReceipt);
	switch (bounce) {
		case "each":
			return channel.impacts + 1;
		case "off":
			return channel.impacts;
		case "once": {
			// One gobble as the first chip lands — the well reacts when
			// the sequence starts, not after the last stagger delay.
			const flyingBefore = channel.flights.filter(
				(flight) => flight.receiptId === landed.receiptId,
			).length;
			return flyingBefore === receiptFlightCount(channel.lastReceipt)
				? channel.impacts + 1
				: channel.impacts;
		}
		default: {
			const exhaustive: never = bounce;
			return exhaustive;
		}
	}
}

function receiptFlightCount(receipt: SessionDropReceipt | null): number {
	if (!receipt || resolveJiraDropzoneDrop(receipt) === "cohort") {
		return 1;
	}
	return receipt.members.length;
}

function fanLaunch(
	from: ViewportPoint,
	index: number,
	count: number,
	spreadPx: number,
): ViewportPoint {
	if (count === 1 || spreadPx === 0) {
		return from;
	}
	const mid = (count - 1) / 2;
	return { x: from.x + (index - mid) * spreadPx, y: from.y };
}
