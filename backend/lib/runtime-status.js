"use strict";

const RUNTIME_SURFACE_NAMES = ["rovo"];

function normalizeRuntimeSurfaceStatus(surface) {
	const available = surface?.available === true;
	const explicitHealth = surface?.health;
	const health =
		explicitHealth === "ok" || explicitHealth === "degraded" || explicitHealth === "down"
			? explicitHealth
			: available
				? "ok"
				: "down";
	const normalizedName = RUNTIME_SURFACE_NAMES.includes(surface?.name)
		? surface.name
		: "rovo";

	return {
		name: normalizedName,
		available,
		health,
		status:
			typeof surface?.status === "string" && surface.status.trim()
				? surface.status.trim()
				: available
					? "ready"
					: "unavailable",
		message:
			typeof surface?.message === "string" && surface.message.trim()
				? surface.message.trim()
				: null,
		url:
			typeof surface?.url === "string" && surface.url.trim()
				? surface.url.trim()
				: null,
		details:
			surface?.details && typeof surface.details === "object"
				? surface.details
				: {},
	};
}

function buildRuntimeStatusSnapshot(input) {
	const rovo = normalizeRuntimeSurfaceStatus({
		...input?.rovo,
		name: "rovo",
	});
	const degradedSurfaces = [rovo]
		.filter((surface) => surface.health !== "ok")
		.map((surface) => surface.name);

	const status = degradedSurfaces.length === 0
		? "ok"
		: rovo.health === "down"
			? "down"
			: "degraded";

	return {
		status,
		timestamp: new Date().toISOString(),
		surfaces: {
			rovo,
		},
		degradedSurfaces,
	};
}

module.exports = {
	buildRuntimeStatusSnapshot,
	normalizeRuntimeSurfaceStatus,
};
