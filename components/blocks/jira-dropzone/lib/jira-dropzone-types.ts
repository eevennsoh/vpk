import type { AgentListInvoker } from "@/components/blocks/agent-list";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

export interface ViewportPoint {
	readonly x: number;
	readonly y: number;
}

export interface JiraDropzoneMember {
	readonly avatarSrc?: string;
	readonly brandName?: ThirdPartyLogoName;
	readonly id: string;
	/** Human who invoked the session, so the flight chip keeps the face. */
	readonly invoker?: AgentListInvoker;
	readonly name: string;
	readonly vpkLogo?: "rovo";
}

export type SessionReceiptId = string & { readonly __brand: "SessionReceiptId" };

export type JiraDropzoneDropPlayback = "cohort" | "stagger";

export type JiraDropzoneBouncePlayback = "each" | "off" | "once";

export interface SessionDropReceipt {
	readonly bounce?: JiraDropzoneBouncePlayback;
	readonly drop?: JiraDropzoneDropPlayback;
	readonly from: ViewportPoint;
	readonly id: SessionReceiptId;
	readonly members: readonly [JiraDropzoneMember, ...JiraDropzoneMember[]];
	readonly title: string;
}

export type JiraDropzoneReceiveOutcome = "accepted" | "duplicate" | "no-dropzone";

export interface SessionReceiptIdParts {
	readonly cohortKey: string;
	readonly from: ViewportPoint;
	readonly title: string;
}

export type JiraDropzoneDragState = "active" | "armed" | "idle";

export type JiraDropzonePhase = "active" | "armed" | "proximate" | "receiving" | "resting";

export interface JiraDropzonePhaseInput {
	readonly drag: JiraDropzoneDragState;
	/** Optional immediate-collapse policy; normal drop targets stay open through receipt playback. */
	readonly holdOpenWhileReceiving?: boolean;
	readonly proximate: boolean;
	readonly receiving: boolean;
}

export type SessionFlightKey = string & { readonly __brand: "SessionFlightKey" };

export interface SessionFlight {
	readonly delayMs: number;
	readonly from: ViewportPoint;
	readonly key: SessionFlightKey;
	readonly members: SessionDropReceipt["members"];
	readonly receiptId: SessionReceiptId;
}

export type FlightTravel = "arc" | "linear" | "none";

/** Motion `arc()` side. `"automatic"` omits `direction` so Motion picks a stable screen-space bulge. */
export type JiraDropzoneArcDirection = "automatic" | "ccw" | "cw";

export interface JiraDropzoneArcOptions {
	readonly direction?: Exclude<JiraDropzoneArcDirection, "automatic">;
	readonly peak: number;
	readonly rotate?: number;
	readonly strength: number;
}

export interface ImpactProfile {
	readonly damping: number;
	readonly impulseXPx: number;
	readonly impulseYPx: number;
	readonly stiffness: number;
}

export interface FlightProfile {
	readonly arcDirection: JiraDropzoneArcDirection;
	readonly arcPeak: number;
	readonly arcRotate: number;
	readonly arcStrength: number;
	readonly durationMs: number;
	readonly ease: readonly [number, number, number, number];
	readonly impact: ImpactProfile | null;
	readonly launchSpreadPx: number;
	readonly settleHoldMs: number;
	readonly staggerMs: number;
	readonly travel: FlightTravel;
}

export interface QueuedDropzoneReceive {
	readonly profile: FlightProfile;
	readonly receipt: SessionDropReceipt;
}

export interface JiraDropzoneChannel {
	readonly flights: readonly SessionFlight[];
	readonly impacts: number;
	readonly lastReceipt: SessionDropReceipt | null;
	readonly queued: readonly QueuedDropzoneReceive[];
	readonly settling: boolean;
}

export interface JiraDropzoneFieldState {
	readonly channels: ReadonlyMap<string, JiraDropzoneChannel>;
	readonly latestReceipt: SessionDropReceipt | null;
	readonly seen: ReadonlySet<SessionReceiptId>;
}

export type JiraDropzoneFieldEvent =
	| { readonly flightKey: SessionFlightKey; readonly kind: "land"; readonly title: string }
	| {
		readonly kind: "receive";
		readonly profile: FlightProfile;
		readonly receipt: SessionDropReceipt;
	}
	| { readonly kind: "register"; readonly title: string }
	| { readonly kind: "settle"; readonly title: string }
	| { readonly kind: "unregister"; readonly title: string };
