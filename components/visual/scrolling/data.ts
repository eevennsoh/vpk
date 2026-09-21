import type { Transition } from "motion/react";

import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { AgentListAgent } from "@/components/blocks/agent-list";

/**
 * Gap between the detached cards, in px. `12` is ADS `space.150`.
 *
 * Ticker's `gap` prop takes a raw number (it feeds both the flex `gap` and the
 * loop wrap arithmetic), so it cannot be a token class or a `var()`.
 */
export const SCROLLING_GAP_PX = 12;

/**
 * Pixels one `WheelEvent.deltaMode === DOM_DELTA_LINE` unit is worth.
 *
 * `20` is ADS `space.250`, which is also the line-height of the `font.body`
 * ramp the session rows are set in (`14px/20px`) — so a Firefox line-mode notch
 * (3 units) advances three lines of card text, which is what the same notch
 * moves in any ordinary text scroller.
 *
 * Deliberately NOT the card pitch. A "line" in `WheelEvent` is a line of TEXT,
 * not a row of content: paying a whole 74px card per unit would send one notch
 * 222px, most of the way across the 480px default scrollport.
 */
export const SCROLLING_WHEEL_LINE_PX = 20;

/**
 * Depth of the edge fade mask, in px. Roughly one card tall, so the loop seam
 * and the top of the entrance stack both resolve out of a soft edge rather than
 * a hard clip line. Also a raw-number Ticker prop.
 */
export const SCROLLING_FADE_PX = 72;

/**
 * Default scrollport height, in px.
 *
 * Kept well under a typical window: Ticker measures
 * `containerLength = Math.min(container.offsetHeight, window.innerHeight)`, so a
 * viewport taller than the window silently clamps and the stack centre drifts.
 */
export const SCROLLING_VIEWPORT_PX = 480;

/**
 * One shared unfurl for every card — the reference recording starts every card
 * boundary on the same frame, so there is deliberately no per-card stagger.
 *
 * `visualDuration` is the PERCEIVED arrival, so this reads as a 600ms
 * extra-large transition (the top of the VPK duration ladder) while keeping the
 * long, soft settle tail. `bounce` is low because the reference lands with no
 * visible overshoot ripple.
 */
export const SCROLLING_ENTRANCE_SPRING = {
	bounce: 0.16,
	type: "spring",
	visualDuration: 0.6,
} as const satisfies Transition;

/**
 * Depth of the edge zone that triggers the scale-and-tuck tail, in px.
 *
 * Deliberately a little over two cards plus their gaps, so two or three cards
 * are mid-tuck at any moment and the tail reads as a deck rather than as one
 * card abruptly shrinking. Matching {@link SCROLLING_FADE_PX} exactly would
 * hide the effect inside the fade, so the zone is set wider than the mask.
 */
export const SCROLLING_DEPTH_ZONE_PX = 160;

/**
 * Floor the depth tail scales a card down to.
 *
 * Shallow on purpose. The tuck plus the perspective it implies is what sells the
 * stack; a deeper shrink starts to read as the card falling away from the list
 * rather than sliding under it.
 */
export const SCROLLING_DEPTH_MIN_SCALE = 0.88;

/**
 * How far the deepest card in the tail is pulled back toward the zone boundary,
 * in px.
 *
 * Slightly under one card height (~62px) plus the gap, so the deepest card tucks
 * most of the way behind its neighbour without ever fully disappearing under it.
 */
export const SCROLLING_DEPTH_LIFT_PX = 56;

const CLAUDE_AGENT = {
	brandName: "claude",
	id: "claude",
	kind: "agent",
	name: "Claude",
} as const satisfies AgentListAgent;

const CURSOR_AGENT = {
	brandName: "cursor",
	id: "cursor",
	kind: "agent",
	name: "Cursor",
} as const satisfies AgentListAgent;

const CODEX_AGENT = {
	brandName: "openai-codex",
	id: "openai-codex",
	kind: "agent",
	name: "Codex",
} as const satisfies AgentListAgent;

const GEMINI_AGENT = {
	brandName: "google-gemini",
	id: "google-gemini",
	kind: "agent",
	name: "Gemini",
} as const satisfies AgentListAgent;

const COPILOT_AGENT = {
	brandName: "github-copilot",
	id: "github-copilot",
	kind: "agent",
	name: "Copilot",
} as const satisfies AgentListAgent;

const ROVO_AGENT = {
	id: "rovo-dev",
	kind: "agent",
	name: "Rovo",
	vpkLogo: "rovo",
} as const satisfies AgentListAgent;

const READINESS_AGENT = {
	avatarSrc: "/avatar-agent/teamwork-agents/readiness-checker.svg",
	id: "readiness-checker",
	kind: "agent",
	name: "Readiness Checker",
} as const satisfies AgentListAgent;

/**
 * Payments-codebase sessions for the looping scroller.
 *
 * Three deliberate constraints, all of them load-bearing:
 *
 * 1. **Every row sets `timeLabel`.** Without it `AgentListTime` falls through to
 *    `Date.now()` and can mount a live one-second `ElapsedTime` per row — an
 *    SSR/client hydration mismatch multiplied by every loop clone.
 * 2. **No row sets `summary`.** A summary switches the row to `items-start` and
 *    adds 28px+, giving ragged card heights; omitting it keeps every card at a
 *    uniform 62px so the fixed gap and the deck-collapse maths stay symmetric.
 * 3. **Mostly `state: "complete"`.** `running` mounts a `PixelLoader` and
 *    `needs-input` mounts a title `Shimmer` plus `AnimatedDots`; one of each is
 *    enough variety without N x (1 + cloneCount) animated subtrees competing
 *    with the entrance spring.
 * 4. **One avatar and one machine per person.** All eight cards are on screen at
 *    once and the loop shows each of them repeatedly, so a person appearing with
 *    two different avatars — or borrowing someone else's laptop name — reads as a
 *    rendering bug rather than as fixture noise. Andrew Park and Chloe Lee are
 *    each invoked twice; keep their `invokedBy.avatarSrc` and `machineName`
 *    identical across both rows.
 */
export const SCROLLING_ITEMS: readonly AgentSessionItem[] = [
	{
		agent: CLAUDE_AGENT,
		branch: "pay/3ds-retry-guard",
		host: "local",
		id: "pay-3ds-retry-guard",
		invokedBy: {
			avatarSrc: "/avatar-user/priya-hansra/color/asow-service-yellow.png",
			name: "Priya Hansra",
		},
		machineName: "Priya’s MacBook",
		prStatus: "merged",
		sessionDetails: {
			host: "local",
			issueKey: "PAY-204",
			issueStatus: "Done",
			issueSummary: "3-D Secure retry loop double-charges on the second attempt",
			worktreePath: ".worktrees/pay-204-3ds-retry",
		},
		shortTitle: "3-D Secure retry guard",
		state: "complete",
		timeLabel: "9m ago",
		title: "3-D Secure retry loop double-charges when the issuer times out twice",
	},
	{
		agent: CURSOR_AGENT,
		branch: "pay/idempotency-key-ttl",
		host: "local",
		id: "pay-idempotency-key-ttl",
		invokedBy: {
			avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
			name: "Andrew Park",
		},
		machineName: "Work Laptop",
		sessionDetails: {
			host: "local",
			issueKey: "PAY-188",
			issueStatus: "In review",
			issueSummary: "Idempotency keys expire before the settlement webhook lands",
			worktreePath: ".worktrees/pay-188-idempotency",
		},
		shortTitle: "Idempotency key TTL",
		state: "complete",
		timeLabel: "42m ago",
		title: "Idempotency keys expire before the settlement webhook ever lands",
	},
	{
		agent: ROVO_AGENT,
		branch: "pay/refund-ledger-drift",
		host: "cloud",
		id: "pay-refund-ledger-drift",
		invokedBy: {
			avatarSrc: "/avatar-user/dev-rana/color/asow-product-purple.png",
			name: "Dev Rana",
		},
		sessionDetails: {
			host: "cloud",
			issueKey: "PAY-231",
			issueStatus: "In progress",
			issueSummary: "Partial refunds drift by a cent against the ledger",
		},
		shortTitle: "Refund ledger drift",
		state: "running",
		timeLabel: "Running 6m",
		title: "Partial refunds drift by one cent against the ledger on split captures",
	},
	{
		agent: CODEX_AGENT,
		branch: "pay/webhook-replay-window",
		host: "local",
		id: "pay-webhook-replay-window",
		invokedBy: {
			avatarSrc: "/avatar-user/chloe-lee/color/asow-strategy-orange.png",
			name: "Chloe Lee",
		},
		machineName: "MBP-M4-MAX",
		prStatus: "created",
		sessionDetails: {
			host: "local",
			issueKey: "PAY-176",
			issueStatus: "In review",
			issueSummary: "Webhook replay window drops events older than five minutes",
			worktreePath: ".worktrees/pay-176-replay-window",
		},
		shortTitle: "Webhook replay window",
		state: "complete",
		timeLabel: "Yesterday",
		title: "Webhook replay silently drops settlement events older than five minutes",
	},
	{
		agent: READINESS_AGENT,
		host: "cloud",
		id: "pay-sandbox-key-rotation",
		invokedBy: {
			avatarSrc: "/avatar-user/brian-lin/color/asow-teamwork-blue.png",
			name: "Brian Lin",
		},
		sessionDetails: {
			host: "cloud",
			issueKey: "PAY-212",
			issueStatus: "Blocked",
			issueSummary: "Sandbox key rotation needs a confirmed retention window",
		},
		shortTitle: "Sandbox key rotation",
		state: "needs-input",
		timeLabel: "2h ago",
		title: "Sandbox key rotation is waiting on a confirmed retention window",
	},
	{
		agent: GEMINI_AGENT,
		branch: "pay/currency-rounding-jpy",
		host: "local",
		id: "pay-currency-rounding-jpy",
		invokedBy: {
			avatarSrc: "/avatar-user/darius-pavri/color/asow-strategy-orange.png",
			name: "Darius Pavri",
		},
		machineName: "Darius’ Mac mini",
		sessionDetails: {
			host: "local",
			issueKey: "PAY-149",
			issueStatus: "Done",
			issueSummary: "Zero-decimal currencies round to the wrong minor unit",
			worktreePath: ".worktrees/pay-149-jpy-rounding",
		},
		shortTitle: "Zero-decimal rounding",
		state: "complete",
		timeLabel: "Tue 18 Aug",
		title: "Zero-decimal currencies round JPY captures to the wrong minor unit",
	},
	{
		agent: COPILOT_AGENT,
		branch: "pay/chargeback-evidence-upload",
		host: "local",
		id: "pay-chargeback-evidence-upload",
		invokedBy: {
			avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
			name: "Andrew Park",
		},
		machineName: "Work Laptop",
		prStatus: "merged",
		sessionDetails: {
			host: "local",
			issueKey: "PAY-160",
			issueStatus: "Done",
			issueSummary: "Chargeback evidence upload times out on multi-page PDFs",
			worktreePath: ".worktrees/pay-160-chargeback-evidence",
		},
		shortTitle: "Chargeback evidence",
		state: "complete",
		timeLabel: "Last week",
		title: "Chargeback evidence upload times out on anything past a four-page PDF",
	},
	{
		agent: CLAUDE_AGENT,
		branch: "pay/payout-batch-backoff",
		host: "local",
		id: "pay-payout-batch-backoff",
		invokedBy: {
			avatarSrc: "/avatar-user/chloe-lee/color/asow-strategy-orange.png",
			name: "Chloe Lee",
		},
		machineName: "MBP-M4-MAX",
		sessionDetails: {
			host: "local",
			issueKey: "PAY-198",
			issueStatus: "In review",
			issueSummary: "Payout batches retry without backoff after a provider 503",
			worktreePath: ".worktrees/pay-198-payout-backoff",
		},
		shortTitle: "Payout batch backoff",
		state: "complete",
		timeLabel: "Last week",
		title: "Payout batches retry without backoff the moment the provider returns 503",
	},
];
