export type RuntimeHealth = "ok" | "degraded" | "down";
export type RuntimeSurfaceName = "rovo";

export interface RuntimeSurfaceStatus {
	name: RuntimeSurfaceName;
	available: boolean;
	health: RuntimeHealth;
	status: string;
	message: string | null;
	url: string | null;
	details?: Record<string, unknown>;
}

export interface RuntimeStatusSnapshot {
	status: RuntimeHealth;
	timestamp: string;
	surfaces: {
		rovo: RuntimeSurfaceStatus;
	};
	degradedSurfaces: RuntimeSurfaceName[];
}

export interface SessionSearchResult {
	threadId: string;
	title: string;
	snippet: string;
	matchCount: number;
	lastMessageAt: string;
}

export interface Checkpoint {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
}
