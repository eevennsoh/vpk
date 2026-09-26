import type {
	RuntimeHealth,
	RuntimeStatusSnapshot,
	RuntimeSurfaceName,
	RuntimeSurfaceStatus,
} from "@/lib/rovo-runtime-types";

type RuntimeSurfaceKey = keyof RuntimeStatusSnapshot["surfaces"];

const SURFACE_DEFAULTS: Record<RuntimeSurfaceKey, { message: string; name: RuntimeSurfaceName }> = {
	rovo: {
		message: "Rovo status unavailable.",
		name: "rovo",
	},
};

function getString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

function isRuntimeHealth(value: unknown): value is RuntimeHealth {
	return value === "ok" || value === "degraded" || value === "down";
}

function isRuntimeSurfaceName(value: unknown): value is RuntimeSurfaceName {
	return value === "rovo";
}

function normalizeRuntimeSurfaceStatus(
	key: RuntimeSurfaceKey,
	payload: unknown,
): RuntimeSurfaceStatus {
	const surface = payload && typeof payload === "object"
		? payload as Partial<RuntimeSurfaceStatus>
		: null;
	const fallback = SURFACE_DEFAULTS[key];
	const available = surface?.available === true;
	const health = isRuntimeHealth(surface?.health)
		? surface.health
		: available
			? "ok"
			: "down";
	const name = isRuntimeSurfaceName(surface?.name)
		? surface.name
		: fallback.name;
	const details = surface?.details && typeof surface.details === "object"
		? surface.details
		: undefined;

	return {
		available,
		...(details ? { details } : {}),
		health,
		message: getString(surface?.message) ?? fallback.message,
		name,
		status: getString(surface?.status) ?? (available ? "ready" : "unavailable"),
		url: getString(surface?.url),
	};
}

function deriveOverallRuntimeHealth(
	surfaces: RuntimeStatusSnapshot["surfaces"],
): RuntimeHealth {
	const degradedSurfaceCount = Object.values(surfaces).filter((surface) => surface.health !== "ok").length;

	if (degradedSurfaceCount === 0) {
		return "ok";
	}

	if (degradedSurfaceCount === Object.keys(surfaces).length) {
		return "down";
	}

	return "degraded";
}

export function normalizeRuntimeStatusSnapshot(payload: unknown): RuntimeStatusSnapshot {
	const snapshot = payload && typeof payload === "object"
		? payload as Partial<RuntimeStatusSnapshot>
		: null;
	const surfacesPayload: Partial<RuntimeStatusSnapshot["surfaces"]> = snapshot?.surfaces && typeof snapshot.surfaces === "object"
		? snapshot.surfaces
		: {};
	const surfaces: RuntimeStatusSnapshot["surfaces"] = {
		rovo: normalizeRuntimeSurfaceStatus("rovo", surfacesPayload.rovo),
	};
	const derivedStatus = deriveOverallRuntimeHealth(surfaces);

	return {
		degradedSurfaces: Object.values(surfaces)
			.filter((surface) => surface.health !== "ok")
			.map((surface) => surface.name),
		status: isRuntimeHealth(snapshot?.status)
			? snapshot.status
			: derivedStatus,
		surfaces,
		timestamp: getString(snapshot?.timestamp) ?? new Date().toISOString(),
	};
}
