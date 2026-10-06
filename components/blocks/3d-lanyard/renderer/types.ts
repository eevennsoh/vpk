export interface Vec2 {
	x: number;
	y: number;
}

export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

/** Orthonormal frame: local x, y and z axes expressed in world space. */
export type Axes = readonly [Vec3, Vec3, Vec3];

export type LanyardSurface = HTMLImageElement | HTMLCanvasElement;

/** One textured triangle, carrying both its projected and world-space vertices. */
export interface Face {
	image: LanyardSurface;
	s: Vec2[];
	d: Vec2[];
	v: Vec3[];
	z: number;
	shade: number;
	n: Vec3[] | null;
	backdrop?: number;
}

export type CardTheme = "light" | "dark";

/** Everything the back card paints; the badge image comes from `asset`. */
export interface AgentCardArt {
	id: string;
	name: string;
	/** Provider line shown under the name, uppercased on the card. */
	role: string;
	asset: AgentAssetKey;
	/** Wrapped to the card width; "\n" forces a break. */
	description: string;
}

export type AgentAssetKey = "claude" | "codex" | "cursor" | "copilot" | "rovo";

/** Lines of text and any raster art a card face needs to draw itself. */
export interface CardContent {
	name: string;
	role: string;
	/** Portrait URL; null draws the presenter's initials instead. */
	photo: string | null;
}

export interface LanyardConfig extends CardContent {
	background: string;
	format: LanyardFormat;
	swing: number;
	/**
	 * The swing the stage is framed for; defaults to `swing`. Pin it to the
	 * largest swing a sequence of drops uses and the card keeps one size while
	 * each drop's swing varies.
	 */
	framingSwing?: number;
	revealAngle: number;
	backCard: AgentCardArt;
	backCardTheme: CardTheme;
}

export type LanyardFormat = "portrait" | "wide" | "square";

export interface Strand {
	anchor: Vec3;
	local: Vec3;
	width: number;
	rear: boolean;
	length: number;
}

export interface Pose {
	x: number;
	y: number;
	z: number;
	angle: number;
	yaw: number;
	pitch: number;
	strapAngle: number;
	strapYaw: number;
	strapPitch: number;
	body: Axes;
	collar: Axes;
	ropes: Vec3[][];
}

/** Asks `physics.worker.ts` to simulate these swing amounts. */
export interface PhysicsRequest {
	amounts: readonly number[];
}

/** One simulated swing amount, as `physics.worker.ts` posts it back. */
export interface PhysicsResult {
	amount: number;
	simulation: Simulation;
}

export interface Simulation {
	data: Float32Array;
	count: number;
	body: number[];
	chains: number[][];
}
