import { getNeuralOrigin, type NeuralCamera, type NeuralViewport } from "./camera";
import type { NeuralGraphLayout, NeuralLayoutNode } from "./layout";
import type { NeuralGraphParams } from "./params";
import { lerp } from "@/lib/utils";

export const NEURAL_GRAPH_FIT_PADDING = 48;

const NEURAL_GRAPH_FIT_MIN_ZOOM = 0.1;
const NEURAL_GRAPH_FIT_MAX_ZOOM = 4;
const NEURAL_GRAPH_RADIAL_FIT_MAX_ZOOM = 0.84;
const NEURAL_GRAPH_RADIAL_LABEL_FIT_PADDING_MAX = 360;
const NEURAL_GRAPH_RADIAL_LABEL_FIT_PADDING_MIN = 160;
const NEURAL_GRAPH_RADIAL_LABEL_FIT_PADDING_RATIO = 0.3;
const ZERO_EXTENT_EPSILON = 0.0001;

export interface NeuralLayoutBounds {
	maxX: number;
	maxY: number;
	minX: number;
	minY: number;
}

export function getNeuralLayoutBounds(
	nodes: ReadonlyArray<NeuralLayoutNode>,
): NeuralLayoutBounds | null {
	if (nodes.length === 0) return null;

	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const node of nodes) {
		if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
		if (node.x < minX) minX = node.x;
		if (node.x > maxX) maxX = node.x;
		if (node.y < minY) minY = node.y;
		if (node.y > maxY) maxY = node.y;
	}

	if (
		!Number.isFinite(minX)
		|| !Number.isFinite(maxX)
		|| !Number.isFinite(minY)
		|| !Number.isFinite(maxY)
	) {
		return null;
	}

	return { maxX, maxY, minX, minY };
}

function clampFitZoom(zoom: number) {
	if (!Number.isFinite(zoom) || zoom <= 0) return 1;
	return Math.min(NEURAL_GRAPH_FIT_MAX_ZOOM, Math.max(NEURAL_GRAPH_FIT_MIN_ZOOM, zoom));
}

function clampPadding(padding: number, viewport: NeuralViewport) {
	if (!Number.isFinite(padding) || padding < 0) return 0;
	const ceiling = Math.max(0, Math.min(viewport.width, viewport.height) / 2 - 1);
	return Math.min(padding, ceiling);
}

function getRadialFitPadding(safePadding: number, viewport: NeuralViewport, params: NeuralGraphParams) {
	if (!params.showLabels || viewport.width < 700) return safePadding;
	const viewportScaledPadding = Math.min(viewport.width, viewport.height) * NEURAL_GRAPH_RADIAL_LABEL_FIT_PADDING_RATIO;
	return Math.max(
		safePadding,
		Math.min(
			NEURAL_GRAPH_RADIAL_LABEL_FIT_PADDING_MAX,
			Math.max(NEURAL_GRAPH_RADIAL_LABEL_FIT_PADDING_MIN, viewportScaledPadding),
		),
	);
}

function getScreenSpaceCameraDelta(camera: NeuralCamera, target: NeuralCamera) {
	return Math.hypot(
		(target.x - camera.x) * target.zoom,
		(target.y - camera.y) * target.zoom,
	);
}

function settleCameraFit({
	amount,
	camera,
	positionDeadbandPx,
	target,
	zoomDeadband,
}: {
	amount: number;
	camera: NeuralCamera;
	positionDeadbandPx: number;
	target: NeuralCamera;
	zoomDeadband: number;
}) {
	const blendAmount = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 1));
	if (blendAmount >= 1) return target;
	if (blendAmount <= 0) return camera;

	const screenDelta = getScreenSpaceCameraDelta(camera, target);
	const zoomDelta = Math.abs(target.zoom - camera.zoom);
	const nextZoom = zoomDelta <= zoomDeadband ? camera.zoom : lerp(camera.zoom, target.zoom, blendAmount);
	const nextPosition = screenDelta <= positionDeadbandPx
		? { x: camera.x, y: camera.y }
		: {
			x: lerp(camera.x, target.x, blendAmount),
			y: lerp(camera.y, target.y, blendAmount),
		};

	return {
		...target,
		...nextPosition,
		zoom: clampFitZoom(nextZoom),
	};
}

export function fitNeuralCameraToLayout({
	camera,
	fitNodes,
	layout,
	padding = NEURAL_GRAPH_FIT_PADDING,
	params,
	positionDeadbandPx = 0,
	smoothing = 1,
	viewport,
	zoomDeadband = 0,
}: {
	camera: NeuralCamera;
	fitNodes?: ReadonlyArray<NeuralLayoutNode> | null;
	layout: NeuralGraphLayout;
	padding?: number;
	params: NeuralGraphParams;
	positionDeadbandPx?: number;
	smoothing?: number;
	viewport: NeuralViewport;
	zoomDeadband?: number;
}): NeuralCamera {
	const origin = getNeuralOrigin(viewport, params);
	const boundsNodes = fitNodes && fitNodes.length > 0 ? fitNodes : layout.nodes;
	const bounds = getNeuralLayoutBounds(boundsNodes);
	if (!bounds) {
		return { ...camera, x: 0, y: 0, zoom: clampFitZoom(1) };
	}

	const safePadding = clampPadding(padding, viewport);
	const availableWidth = Math.max(1, viewport.width - safePadding * 2);
	const availableHeight = Math.max(1, viewport.height - safePadding * 2);
	const rawWidth = bounds.maxX - bounds.minX;
	const rawHeight = bounds.maxY - bounds.minY;
	if (layout.layoutShape === "radialCluster" && boundsNodes === layout.nodes) {
		const radialPadding = getRadialFitPadding(safePadding, viewport, params);
		const zoomCandidates: number[] = [];
		if (bounds.minX < 0) zoomCandidates.push(Math.max(1, origin.x - radialPadding) / Math.abs(bounds.minX));
		if (bounds.maxX > 0) zoomCandidates.push(Math.max(1, viewport.width - origin.x - radialPadding) / bounds.maxX);
		if (bounds.minY < 0) zoomCandidates.push(Math.max(1, origin.y - radialPadding) / Math.abs(bounds.minY));
		if (bounds.maxY > 0) zoomCandidates.push(Math.max(1, viewport.height - origin.y - radialPadding) / bounds.maxY);
		const zoom = clampFitZoom(Math.min(
			NEURAL_GRAPH_RADIAL_FIT_MAX_ZOOM,
			zoomCandidates.length ? Math.min(...zoomCandidates) : NEURAL_GRAPH_RADIAL_FIT_MAX_ZOOM,
		));
		const target = {
			...camera,
			x: 0,
			y: 0,
			zoom,
		};

		return settleCameraFit({
			amount: smoothing,
			camera,
			positionDeadbandPx,
			target,
			zoomDeadband,
		});
	}
	const worldCenterX = (bounds.minX + bounds.maxX) / 2;
	const worldCenterY = (bounds.minY + bounds.maxY) / 2;

	const fitsAsPoint = rawWidth < ZERO_EXTENT_EPSILON && rawHeight < ZERO_EXTENT_EPSILON;
	const zoom = fitsAsPoint
		? clampFitZoom(1)
		: clampFitZoom(Math.min(
			availableWidth / Math.max(ZERO_EXTENT_EPSILON, rawWidth),
			availableHeight / Math.max(ZERO_EXTENT_EPSILON, rawHeight),
		));

	const target = {
		...camera,
		x: worldCenterX - (viewport.width / 2 - origin.x) / zoom,
		y: worldCenterY - (viewport.height / 2 - origin.y) / zoom,
		zoom,
	};
	return settleCameraFit({
		amount: smoothing,
		camera,
		positionDeadbandPx,
		target,
		zoomDeadband,
	});
}
