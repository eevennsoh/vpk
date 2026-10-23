// The one figure camera shared by both figure engines (integration K12, R2).
//
// Iso-kit figures (scripts/iso/) and anatomy heroes (scripts/anatomy/) draw at the same angle, and
// both engine roots carry data-vpk-camera="<azimuth> <elevation>" in cameraAttr() format. This module
// only names the convention; projection maths come from the vendored anatomy kit
// (scripts/anatomy/vendor/kit/iso-kit.mjs iso/fitProjection, whose AZIMUTH and ELEVATION equal
// FIGURE_CAMERA). No imports and no file reads, so importing it is free.

// Degrees. 45/30 is the dimetric camera (edges at 26.57 degrees); ws3 CAMERA_PRESETS.dimetric
// deep-equals it.
export const FIGURE_CAMERA = Object.freeze({ azimuth: 45, elevation: 30 });

// Parity tolerance for cross-engine camera checks (ws4b A2).
export const CAMERA_TOLERANCE = 1e-6;

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

function checkAngles(azimuth, elevation) {
	return Number.isFinite(azimuth) && Number.isFinite(elevation)
		&& azimuth >= -360 && azimuth <= 360
		&& elevation >= -90 && elevation <= 90;
}

// "45 30": each angle in its shortest round-trip decimal form, so 35.26 stays "35.26" and -0 is "0".
export function cameraAttr({ azimuth, elevation } = FIGURE_CAMERA) {
	if (!checkAngles(azimuth, elevation)) {
		throw new RangeError(`cameraAttr: expected finite degrees with azimuth in [-360, 360] and elevation in [-90, 90], got ${azimuth} ${elevation}`);
	}
	return `${String(azimuth + 0)} ${String(elevation + 0)}`;
}

// Inverse of cameraAttr: exactly two decimal numbers separated by whitespace (surrounding whitespace
// allowed). Anything else, including the five-value data-vpk-anatomy-camera form, returns null.
export function parseCameraAttr(value) {
	if (typeof value !== "string") return null;
	const parts = value.trim().split(/\s+/);
	if (parts.length !== 2 || !parts.every(part => NUMBER.test(part))) return null;
	const azimuth = Number(parts[0]) + 0;
	const elevation = Number(parts[1]) + 0;
	return checkAngles(azimuth, elevation) ? { azimuth, elevation } : null;
}

// True when both cameras exist and their angles agree within tolerance.
export function sameCamera(a, b, tolerance = CAMERA_TOLERANCE) {
	if (!a || !b) return false;
	return Math.abs(a.azimuth - b.azimuth) <= tolerance && Math.abs(a.elevation - b.elevation) <= tolerance;
}
