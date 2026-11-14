import type { VaultNodeKind } from "../personal-graph-types";
import { getNeuralOrigin, worldToViewport, type NeuralCamera, type NeuralPoint, type NeuralViewport } from "./camera";
import { getNeuralGraphColorFallback, isNeuralGraphColorValue } from "./colors";
import {
	isRayOnlyNeuralGraphInteraction,
	type NeuralGraphInteractionState,
} from "./interaction-dynamics";
import { getClosestPointOnOrganicRay, getNodeViewportRadius, getOrganicRayCurve, type NeuralRayCurve } from "./interaction";
import type { NeuralGraphLayout, NeuralLayoutEdge, NeuralLayoutNode, NeuralLayoutTreeBranch } from "./layout";
import { getPersonalGraphNodeTypeAccentToken } from "./node-type-colors";
import type { NeuralGraphParams } from "./params";
import {
	getAutomationWorkflowNodeType,
	getRadialLabelNodes,
	getRadialLeafNodeIds,
	type NeuralGraphLabelStrategy,
} from "./workflow-label-strategy";
import { lerp } from "@/lib/utils";

export type { NeuralGraphLabelStrategy } from "./workflow-label-strategy";

const KIND_COLOR_PARAM_KEY: Record<VaultNodeKind, keyof NeuralGraphParams> = {
	concept: "colorConcept",
	entity: "colorEntity",
	raw: "colorRaw",
	source: "colorSource",
	synthesis: "colorSynthesis",
};

export type NeuralGraphThemeMode = "light" | "dark";
export type NeuralGraphBackgroundMode = "default" | "transparent";

export interface NeuralRayElasticState {
	distance?: number;
	hitProgress?: number;
	intensity?: number;
	nodeId?: string | null;
	point: NeuralPoint;
	progress: number;
	velocity?: number;
}

export interface NeuralGraphRenderOptions {
	animationTime?: number;
	background?: NeuralGraphBackgroundMode;
	camera: NeuralCamera;
	focusProgress: number;
	hoveredNodeId: string | null;
	interaction?: NeuralGraphInteractionState | null;
	labelStrategy?: NeuralGraphLabelStrategy;
	labelNodeId?: string | null;
	labelRevealProgress?: number;
	params: NeuralGraphParams;
	rayElastic?: NeuralRayElasticState | null;
	rayOriginY?: number;
	resolveColor?: (color: string) => string;
	selectedNodeId: string | null;
	theme: NeuralGraphThemeMode;
	viewport: NeuralViewport;
}

type NeuralGraphFrameRenderOptions = NeuralGraphRenderOptions & {
	resolvedColorCache?: Map<string, string>;
};

const PALETTES = {
	light: {
		backgroundBottom: "#DDF3FF",
		backgroundMid: "#F5F6F2",
		backgroundTop: "#FFD08A",
		label: "rgba(23, 43, 77, 0.9)",
		labelSubtle: "rgba(68, 84, 111, 0.74)",
	},
	dark: {
		backgroundBottom: "#051B2C",
		backgroundMid: "#111722",
		backgroundTop: "#291D33",
		label: "rgba(244, 246, 248, 0.92)",
		labelSubtle: "rgba(182, 194, 207, 0.72)",
	},
} as const;

function getEdgeLineWidth(params: NeuralGraphParams) {
	return {
		active: params.edgeWidth,
		focused: params.edgeWidth,
		idle: params.edgeWidth,
	};
}

const SIGNAL_ACTIVE_RATIO = 0.18;
const SIGNAL_HEAD_ALPHA = 0.95;
const SIGNAL_MIN_EDGE_LENGTH = 18;
const SIGNAL_SEGMENT_MAX = 72;
const SIGNAL_SEGMENT_MIN = 22;

function getResolvedColor(color: string, options: NeuralGraphFrameRenderOptions) {
	const cached = options.resolvedColorCache?.get(color);
	if (cached !== undefined) return cached;

	const resolved = options.resolveColor
		? options.resolveColor(color)
		: /^rgba?\(/i.test(color.trim())
			? color
			: getNeuralGraphColorFallback(color);
	options.resolvedColorCache?.set(color, resolved);
	return resolved;
}

function colorToRgb(color: string) {
	const rgbMatch = color.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
	if (rgbMatch) {
		return {
			b: Math.round(Number(rgbMatch[3])),
			g: Math.round(Number(rgbMatch[2])),
			r: Math.round(Number(rgbMatch[1])),
		};
	}

	const normalized = color.replace("#", "");
	const value = Number.parseInt(normalized, 16);
	return {
		b: value & 255,
		g: (value >> 8) & 255,
		r: (value >> 16) & 255,
	};
}

function colorWithAlpha(color: string, alpha: number) {
	const rgb = colorToRgb(color);
	return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function getNodeGraphColor(node: NeuralLayoutNode, options: NeuralGraphRenderOptions) {
	const graphColor = node.node.original.frontmatter.graphColor;
	return isNeuralGraphColorValue(graphColor) ? getResolvedColor(graphColor, options) : null;
}

function getNodeMetadataTypeColor(node: NeuralLayoutNode, options: NeuralGraphRenderOptions) {
	const accentToken = getPersonalGraphNodeTypeAccentToken(node.node.original);
	return isNeuralGraphColorValue(accentToken) ? getResolvedColor(accentToken, options) : null;
}

function getKindColor(kind: VaultNodeKind, options: NeuralGraphRenderOptions) {
	const value = options.params[KIND_COLOR_PARAM_KEY[kind]];
	return isNeuralGraphColorValue(value) ? getResolvedColor(value, options) : null;
}

function getNodeTypeColor(node: NeuralLayoutNode, options: NeuralGraphRenderOptions) {
	return (
		getNodeMetadataTypeColor(node, options)
		?? getKindColor(node.node.kind, options)
		?? getNodeGraphColor(node, options)
		?? getResolvedColor(options.params.nodeColor, options)
	);
}

function shouldRevealNodeTypeColors(options: NeuralGraphRenderOptions) {
	return options.hoveredNodeId !== null || options.selectedNodeId !== null;
}

function getLabelNodeId(options: NeuralGraphRenderOptions) {
	return options.labelNodeId ?? options.hoveredNodeId;
}

function getLabelRevealProgress(options: NeuralGraphRenderOptions) {
	if (options.labelStrategy === "workflowTree") return 1;
	return clampAlpha(options.labelRevealProgress ?? (options.hoveredNodeId ? 1 : 0));
}

function shouldRevealLabels(options: NeuralGraphRenderOptions) {
	if (options.labelStrategy === "workflowTree") return true;
	return getLabelRevealProgress(options) > 0.001 && getLabelNodeId(options) !== null;
}

function getNodeColor(
	node: NeuralLayoutNode,
	options: NeuralGraphRenderOptions,
) {
	if (options.labelStrategy === "workflowTree" || shouldRevealNodeTypeColors(options)) return getNodeTypeColor(node, options);
	return getResolvedColor(options.params.nodeColor, options);
}

function smoothProgress(progress: number) {
	return progress * progress * (3 - 2 * progress);
}

function clampAlpha(value: number) {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}

function getInteractionIntensity(options: NeuralGraphRenderOptions) {
	const interaction = options.interaction;
	if (!interaction || isRayOnlyNeuralGraphInteraction(interaction)) return 0;
	return Math.min(1.5, Math.max(0, interaction.intensity)) * Math.max(0, interaction.flowBoost);
}

function hashStringToUnit(value: string) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 4294967295;
}

function getFocusProgress(options: NeuralGraphRenderOptions) {
	if (!options.selectedNodeId || !Number.isFinite(options.focusProgress)) return 0;
	return Math.min(1, Math.max(0, options.focusProgress));
}

interface SelectedRelationshipIds {
	edgeIds: ReadonlySet<string>;
	nodeIds: ReadonlySet<string>;
}

const EMPTY_SELECTED_RELATIONSHIP_IDS: SelectedRelationshipIds = {
	edgeIds: new Set<string>(),
	nodeIds: new Set<string>(),
};

function getSelectedRelationshipIds(layout: NeuralGraphLayout, selectedNodeId: string | null) {
	const edgeIds = new Set<string>();
	const nodeIds = new Set<string>();
	if (!selectedNodeId) {
		return EMPTY_SELECTED_RELATIONSHIP_IDS;
	}

	nodeIds.add(selectedNodeId);
	for (const edge of layout.edges) {
		if (edge.source.id !== selectedNodeId && edge.target.id !== selectedNodeId) {
			continue;
		}
		edgeIds.add(edge.id);
		nodeIds.add(edge.source.id);
		nodeIds.add(edge.target.id);
	}

	return { edgeIds, nodeIds };
}

function getDrawableGraphEdges(layout: NeuralGraphLayout) {
	return layout.treeBranches?.length ? layout.crossEdges ?? [] : layout.edges;
}

function isRadialClusterLayout(layout: NeuralGraphLayout) {
	return layout.layoutShape === "radialCluster";
}

function getFallbackNormal(curve: NeuralRayCurve) {
	const dx = curve.target.x - curve.origin.x;
	const dy = curve.target.y - curve.origin.y;
	const distance = Math.hypot(dx, dy);
	if (distance <= 0.001) return { x: 0, y: -1 };
	return { x: -dy / distance, y: dx / distance };
}

function getElasticRayCurve(
	curve: NeuralRayCurve,
	options: NeuralGraphRenderOptions,
): NeuralRayCurve {
	const elastic = options.rayElastic;
	const strength = options.params.rayElasticStrength;
	const radius = options.params.rayElasticRadius;
	if (!elastic || elastic.progress <= 0 || strength <= 0 || radius <= 0) return curve;

	const closest = getClosestPointOnOrganicRay(curve, elastic.point);
	if (closest.distance > radius) return curve;

	const falloff = smoothProgress(1 - closest.distance / radius);
	const velocityBoost = 1 + Math.max(0, elastic.velocity ?? 0) * 0.68;
	const force = strength * 1.34 * falloff * elastic.progress * velocityBoost;
	if (force <= 0.001) return curve;

	const dx = elastic.point.x - closest.point.x;
	const dy = elastic.point.y - closest.point.y;
	const distance = Math.hypot(dx, dy);
	const fallbackNormal = getFallbackNormal(curve);
	const direction = distance > 0.001
		? { x: dx / distance, y: dy / distance }
		: fallbackNormal;
	const anchorProgress = Math.min(1, Math.max(0, elastic.hitProgress ?? closest.progress));
	const sourceAnchor = Math.max(0.18, anchorProgress - 0.18);
	const targetAnchor = Math.min(0.9, anchorProgress + 0.18);
	const sourceWeight = Math.max(0, 1 - Math.abs(closest.progress - sourceAnchor) / 0.6);
	const targetWeight = Math.max(0, 1 - Math.abs(closest.progress - targetAnchor) / 0.6);
	const ripple = Math.sin((closest.progress - anchorProgress) * Math.PI * 3.2)
		* force
		* 0.26
		* Math.max(0, elastic.velocity ?? 0);

	return {
		...curve,
		sourceControl: {
			x: curve.sourceControl.x + direction.x * force * sourceWeight + fallbackNormal.x * ripple * sourceWeight,
			y: curve.sourceControl.y + direction.y * force * sourceWeight + fallbackNormal.y * ripple * sourceWeight,
		},
		targetControl: {
			x: curve.targetControl.x + direction.x * force * targetWeight - fallbackNormal.x * ripple * targetWeight,
			y: curve.targetControl.y + direction.y * force * targetWeight - fallbackNormal.y * ripple * targetWeight,
		},
	};
}

function drawOrganicRayPath(ctx: CanvasRenderingContext2D, curve: NeuralRayCurve) {
	ctx.beginPath();
	ctx.moveTo(curve.origin.x, curve.origin.y);
	ctx.bezierCurveTo(
		curve.sourceControl.x,
		curve.sourceControl.y,
		curve.targetControl.x,
		curve.targetControl.y,
		curve.target.x,
		curve.target.y,
	);
}

function drawStraightEdgePath(
	ctx: CanvasRenderingContext2D,
	source: NeuralPoint,
	target: NeuralPoint,
) {
	ctx.beginPath();
	ctx.moveTo(source.x, source.y);
	ctx.lineTo(target.x, target.y);
}

function drawBackground(
	ctx: CanvasRenderingContext2D,
	viewport: NeuralViewport,
	params: NeuralGraphParams,
	theme: NeuralGraphThemeMode,
	resolveColor?: NeuralGraphRenderOptions["resolveColor"],
) {
	const palette = PALETTES[theme];
	const background = ctx.createLinearGradient(0, 0, 0, viewport.height);
	background.addColorStop(0, palette.backgroundTop);
	background.addColorStop(0.58, palette.backgroundMid);
	background.addColorStop(1, palette.backgroundBottom);
	ctx.fillStyle = background;
	ctx.fillRect(0, 0, viewport.width, viewport.height);

	const origin = getNeuralOrigin(viewport, params);
	const glow = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, Math.max(viewport.width, viewport.height));
	glow.addColorStop(0, colorWithAlpha(resolveColor?.(params.nodeColor) ?? params.nodeColor, theme === "dark" ? 0.24 : 0.18));
	glow.addColorStop(0.36, theme === "dark" ? "rgba(80, 180, 255, 0.18)" : "rgba(128, 215, 255, 0.34)");
	glow.addColorStop(1, "rgba(0, 0, 0, 0)");
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, viewport.width, viewport.height);
}

function getRayOrigin(viewport: NeuralViewport, params: NeuralGraphParams, rayOriginY?: number) {
	return {
		...getNeuralOrigin(viewport, params),
		y: rayOriginY ?? viewport.height * params.rayOriginY,
	};
}

function getRadialBranchSource(
	branch: NeuralLayoutTreeBranch,
	origin: NeuralPoint,
	options: NeuralGraphRenderOptions,
) {
	return branch.source
		? worldToViewport(branch.source, options.camera, options.viewport, options.params)
		: origin;
}

function getPolarPoint(origin: NeuralPoint, angle: number, radius: number): NeuralPoint {
	return {
		x: origin.x + Math.cos(angle) * radius,
		y: origin.y + Math.sin(angle) * radius,
	};
}

function getShortestAngleDelta(startAngle: number, endAngle: number) {
	let delta = endAngle - startAngle;
	while (delta > Math.PI) delta -= Math.PI * 2;
	while (delta < -Math.PI) delta += Math.PI * 2;
	return delta;
}

function getRadialBranchStrokeColor(
	branch: NeuralLayoutTreeBranch,
	options: NeuralGraphFrameRenderOptions,
	fallbackColor: string,
) {
	if (options.labelStrategy !== "workflowTree") return fallbackColor;
	const nodeType = getAutomationWorkflowNodeType(branch.target);
	if (nodeType === "AutomationWorkflowRoot" || nodeType === "AutomationWorkflowCandidate") {
		return getResolvedColor(options.params.colorSynthesis, options);
	}
	if (nodeType === "AutomationDraftAction") {
		return getResolvedColor(options.params.colorConcept, options);
	}
	if (nodeType === "AutomationWorkflowEvidence") {
		return getResolvedColor(options.params.colorSource, options);
	}
	return fallbackColor;
}

function getRadialBranchLineWidth(branch: NeuralLayoutTreeBranch, options: NeuralGraphFrameRenderOptions) {
	const baseWidth = Math.max(options.params.rayWidth * 0.9, options.params.edgeWidth * 0.62);
	if (options.labelStrategy !== "workflowTree") return baseWidth;
	const nodeType = getAutomationWorkflowNodeType(branch.target);
	if (nodeType === "AutomationWorkflowCandidate") {
		return Math.max(baseWidth, options.params.edgeWidth * 1.12);
	}
	if (nodeType === "AutomationDraftAction") {
		return Math.max(baseWidth * 0.92, options.params.edgeWidth * 0.82);
	}
	if (nodeType === "AutomationWorkflowEvidence") {
		return Math.max(baseWidth * 0.82, options.params.edgeWidth * 0.72);
	}
	return baseWidth;
}

function drawRadialBranchPath(
	ctx: CanvasRenderingContext2D,
	origin: NeuralPoint,
	source: NeuralPoint,
	target: NeuralPoint,
) {
	const sourceRadius = Math.hypot(source.x - origin.x, source.y - origin.y);
	const targetRadius = Math.hypot(target.x - origin.x, target.y - origin.y);
	const sourceAngle = sourceRadius <= 0.001 ? Math.atan2(target.y - origin.y, target.x - origin.x) : Math.atan2(source.y - origin.y, source.x - origin.x);
	const targetAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
	const controlRadius = lerp(sourceRadius, targetRadius, 0.5);
	const sourceControl = getPolarPoint(origin, sourceAngle, controlRadius);
	const angleDelta = getShortestAngleDelta(sourceAngle, targetAngle);
	const targetControl = getPolarPoint(origin, sourceAngle + angleDelta, controlRadius);

	ctx.beginPath();
	ctx.moveTo(source.x, source.y);
	ctx.bezierCurveTo(sourceControl.x, sourceControl.y, targetControl.x, targetControl.y, target.x, target.y);
}

function drawRadialBranches(
	ctx: CanvasRenderingContext2D,
	layout: NeuralGraphLayout,
	options: NeuralGraphRenderOptions,
	selectedRelationships: SelectedRelationshipIds,
) {
	const branches = layout.treeBranches ?? [];
	if (branches.length === 0) return;

	const origin = worldToViewport(layout.origin, options.camera, options.viewport, options.params);
	const focusProgress = getFocusProgress(options);
	const activeNodeId = options.selectedNodeId ?? options.hoveredNodeId;
	const baseAlpha = options.labelStrategy === "workflowTree"
		? Math.max(0.68, options.params.rayOpacity * 6, options.params.edgeOpacity * 1.18)
		: Math.max(0.24, options.params.rayOpacity * 6, options.params.edgeOpacity * 1.25);
	const activeAlpha = Math.max(baseAlpha, options.params.edgeOpacityActive);
	const rayColor = getResolvedColor(options.params.rayColor, options);
	const selectedColor = getResolvedColor(options.params.edgeSelectedColor, options);
	const hoverColor = getResolvedColor(options.params.edgeHoverColor, options);

	ctx.save();
	ctx.lineCap = "round";

	for (const branch of branches) {
		const target = worldToViewport(branch.target, options.camera, options.viewport, options.params);
		const source = getRadialBranchSource(branch, origin, options);
		const branchColor = getRadialBranchStrokeColor(branch, options, rayColor);
		const isRelated = selectedRelationships.nodeIds.has(branch.targetId)
			|| Boolean(branch.sourceId && selectedRelationships.nodeIds.has(branch.sourceId));
		const isSelectedEdge = Boolean(branch.edge && selectedRelationships.edgeIds.has(branch.edge.id));
		const isActive = Boolean(activeNodeId && (branch.targetId === activeNodeId || branch.sourceId === activeNodeId || isSelectedEdge));
		const focusAlpha = focusProgress > 0
			? isRelated
				? lerp(1, 0.82, focusProgress)
				: lerp(1, 0.1, focusProgress)
			: 1;

		ctx.globalAlpha = clampAlpha((isActive ? activeAlpha : baseAlpha) * focusAlpha);
		ctx.lineWidth = getRadialBranchLineWidth(branch, options);
		ctx.strokeStyle = isSelectedEdge ? selectedColor : isActive ? hoverColor : branchColor;
		drawRadialBranchPath(ctx, origin, source, target);
		ctx.stroke();
	}

	ctx.restore();
}

function drawRadialRayTails(
	ctx: CanvasRenderingContext2D,
	layout: NeuralGraphLayout,
	options: NeuralGraphRenderOptions,
	selectedRelationships: SelectedRelationshipIds,
) {
	const leafNodeIds = getRadialLeafNodeIds(layout);
	if (leafNodeIds.size === 0) return;

	const origin = getRayOrigin(options.viewport, options.params, options.rayOriginY);
	const focusProgress = getFocusProgress(options);
	const interactionIntensity = getInteractionIntensity(options);
	ctx.save();
	ctx.lineCap = "round";
	ctx.lineWidth = options.params.rayWidth;
	ctx.strokeStyle = getResolvedColor(options.params.rayColor, options);

	for (const node of layout.nodes) {
		if (!leafNodeIds.has(node.id)) continue;
		const point = worldToViewport(node, options.camera, options.viewport, options.params);
		const isRelated = selectedRelationships.nodeIds.has(node.id);
		const focusAlpha = focusProgress > 0 ? (isRelated ? lerp(1, 0.72, focusProgress) : lerp(1, 0.05, focusProgress)) : 1;
		const activeRayProgress = options.rayElastic?.nodeId === node.id
			? Math.min(1.5, Math.max(0, options.rayElastic.progress))
			: 0;
		const emphasis = activeRayProgress * Math.max(0, options.interaction?.rayEmphasis ?? 1);
		const baseAlpha = (options.params.rayOpacity + node.depthScale * 0.018 + interactionIntensity * 0.016) * focusAlpha;
		ctx.globalAlpha = clampAlpha(activeRayProgress > 0 ? lerp(baseAlpha, 0.72, Math.min(1, emphasis)) : baseAlpha);
		drawOrganicRayPath(ctx, getElasticRayCurve(getOrganicRayCurve(origin, point), options));
		ctx.stroke();
	}

	ctx.restore();
}

function drawRays(
	ctx: CanvasRenderingContext2D,
	layout: NeuralGraphLayout,
	options: NeuralGraphRenderOptions,
	selectedRelationships: SelectedRelationshipIds,
) {
	if (isRadialClusterLayout(layout)) {
		if (options.params.showRays) {
			drawRadialRayTails(ctx, layout, options, selectedRelationships);
		}
		drawRadialBranches(ctx, layout, options, selectedRelationships);
		return;
	}
	if (!options.params.showRays) return;
	const origin = getRayOrigin(options.viewport, options.params, options.rayOriginY);
	const focusProgress = getFocusProgress(options);
	const interactionIntensity = getInteractionIntensity(options);
	ctx.save();
	ctx.lineCap = "round";
	ctx.strokeStyle = getResolvedColor(options.params.rayColor, options);
	for (const node of layout.nodes) {
		const point = worldToViewport(node, options.camera, options.viewport, options.params);
		const isRelated = selectedRelationships.nodeIds.has(node.id);
		const focusAlpha = focusProgress > 0 ? (isRelated ? lerp(1, 0.72, focusProgress) : lerp(1, 0.05, focusProgress)) : 1;
		const activeRayProgress = options.rayElastic?.nodeId === node.id
			? Math.min(1.5, Math.max(0, options.rayElastic.progress))
			: 0;
		const emphasis = activeRayProgress * Math.max(0, options.interaction?.rayEmphasis ?? 1);
		const baseAlpha = (options.params.rayOpacity + node.depthScale * 0.03 + interactionIntensity * 0.025) * focusAlpha;
		ctx.lineWidth = options.params.rayWidth;
		ctx.globalAlpha = clampAlpha(activeRayProgress > 0 ? lerp(baseAlpha, 1, Math.min(1, emphasis)) : baseAlpha);
		drawOrganicRayPath(ctx, getElasticRayCurve(getOrganicRayCurve(origin, point), options));
		ctx.stroke();
	}
	ctx.restore();
}

function isActiveEdge(sourceId: string, targetId: string, selectedNodeId: string | null, hoveredNodeId: string | null) {
	const activeNodeId = selectedNodeId ?? hoveredNodeId;
	return activeNodeId === null || sourceId === activeNodeId || targetId === activeNodeId;
}

function getEdgeColor(edge: NeuralLayoutEdge, options: NeuralGraphRenderOptions, selectedRelationships: SelectedRelationshipIds) {
	if (options.selectedNodeId && selectedRelationships.edgeIds.has(edge.id)) {
		return getResolvedColor(options.params.edgeSelectedColor, options);
	}
	if (
		!options.selectedNodeId
		&& options.hoveredNodeId
		&& isActiveEdge(edge.source.id, edge.target.id, null, options.hoveredNodeId)
	) {
		return getResolvedColor(options.params.edgeHoverColor, options);
	}
	return getResolvedColor(options.params.edgeColor, options);
}

function drawEdges(
	ctx: CanvasRenderingContext2D,
	layout: NeuralGraphLayout,
	options: NeuralGraphRenderOptions,
	selectedRelationships: SelectedRelationshipIds,
) {
	if (!options.params.showEdges) return;
	const edges = getDrawableGraphEdges(layout);
	const radialCluster = isRadialClusterLayout(layout);
	const hasFocus = radialCluster ? Boolean(options.selectedNodeId) : Boolean(options.selectedNodeId ?? options.hoveredNodeId);
	const crossLinkOpacityScale = radialCluster ? (hasFocus ? 0.1 : 0) : 1;
	const edgeWidths = getEdgeLineWidth(options.params);
	const idleOpacity = options.params.edgeOpacity * crossLinkOpacityScale;
	const activeOpacity = options.params.edgeOpacityActive * (radialCluster ? 0.34 : 1);
	const idleLineWidth = radialCluster ? edgeWidths.idle * 0.42 : edgeWidths.idle;
	const activeLineWidth = radialCluster ? edgeWidths.active * 0.72 : edgeWidths.active;
	const focusedLineWidth = radialCluster ? edgeWidths.focused * 0.72 : edgeWidths.focused;
	const focusProgress = getFocusProgress(options);
	const drawEdge = (edge: NeuralLayoutEdge) => {
		const source = worldToViewport(edge.source, options.camera, options.viewport, options.params);
		const target = worldToViewport(edge.target, options.camera, options.viewport, options.params);
		const focusActive = focusProgress > 0 && selectedRelationships.edgeIds.has(edge.id);
		const active = focusProgress > 0 ? focusActive : hasFocus && isActiveEdge(edge.source.id, edge.target.id, options.selectedNodeId, options.hoveredNodeId);
		const inactiveAlpha = focusProgress > 0 ? lerp(idleOpacity, idleOpacity * 0.11, focusProgress) : idleOpacity;
		const alpha = active ? lerp(activeOpacity, Math.min(1, activeOpacity + 0.2), focusProgress) : inactiveAlpha;
		if (alpha <= 0.001) return;
		ctx.strokeStyle = getEdgeColor(edge, options, selectedRelationships);
		ctx.lineWidth = active ? lerp(activeLineWidth, focusedLineWidth, focusProgress) : idleLineWidth;
		ctx.globalAlpha = alpha;
		drawStraightEdgePath(ctx, source, target);
		ctx.stroke();
	};

	ctx.save();
	ctx.lineCap = "round";
	if (selectedRelationships.edgeIds.size > 0) {
		for (const edge of edges) {
			if (!selectedRelationships.edgeIds.has(edge.id)) drawEdge(edge);
		}
		for (const edge of edges) {
			if (selectedRelationships.edgeIds.has(edge.id)) drawEdge(edge);
		}
	} else {
		for (const edge of edges) {
			drawEdge(edge);
		}
	}
	ctx.restore();
}

function getSignalStreakProgress(edge: NeuralLayoutEdge, options: NeuralGraphRenderOptions) {
	const animationTime = options.animationTime;
	if (typeof animationTime !== "number" || !Number.isFinite(animationTime)) return null;

	const cycleSeed = hashStringToUnit(`${edge.id}:cycle`);
	const phaseSeed = hashStringToUnit(`${edge.id}:phase`);
	const cycleDuration = 2.25 + cycleSeed * 3.1;
	const boostedFrequency = Math.max(0, options.params.signalFrequency) * (1 + getInteractionIntensity(options) * 1.15);
	const cycleProgress = ((animationTime * boostedFrequency + phaseSeed * cycleDuration) % cycleDuration) / cycleDuration;
	if (cycleProgress > SIGNAL_ACTIVE_RATIO) return null;

	const progress = cycleProgress / SIGNAL_ACTIVE_RATIO;
	return {
		alpha: Math.sin(progress * Math.PI),
		forward: hashStringToUnit(`${edge.id}:direction`) >= 0.5,
		progress: smoothProgress(progress),
	};
}

function interpolatePoint(source: NeuralPoint, target: NeuralPoint, progress: number) {
	return {
		x: lerp(source.x, target.x, progress),
		y: lerp(source.y, target.y, progress),
	};
}

function drawSignalStreaks(
	ctx: CanvasRenderingContext2D,
	layout: NeuralGraphLayout,
	options: NeuralGraphRenderOptions,
) {
	const edges = getDrawableGraphEdges(layout);
	const radialCluster = isRadialClusterLayout(layout);
	if (
		!options.params.showEdges
		|| !options.params.showSignals
		|| options.params.signalFrequency <= 0
		|| options.params.signalOpacity <= 0
		|| edges.length === 0
		|| (radialCluster && !options.selectedNodeId)
	) return;

	const signalColor = getResolvedColor(options.params.signalColor, options);
	const signalOpacity = options.params.signalOpacity * (radialCluster ? 0.05 : 1);
	ctx.save();
	ctx.lineCap = "round";
	ctx.lineWidth = options.params.signalWidth;
	if (options.params.signalGlowEnabled) {
		ctx.shadowBlur = Math.max(8, options.params.signalWidth * 2.3);
		ctx.shadowColor = colorWithAlpha(signalColor, 0.72 * signalOpacity);
	}

	for (const edge of edges) {
		if (
			(options.selectedNodeId || options.hoveredNodeId)
			&& isActiveEdge(edge.source.id, edge.target.id, options.selectedNodeId, options.hoveredNodeId)
		) {
			continue;
		}

		const signal = getSignalStreakProgress(edge, options);
		if (!signal) continue;

		const source = worldToViewport(edge.source, options.camera, options.viewport, options.params);
		const target = worldToViewport(edge.target, options.camera, options.viewport, options.params);
		const distance = Math.hypot(target.x - source.x, target.y - source.y);
		if (distance < SIGNAL_MIN_EDGE_LENGTH) continue;

		const segmentProgress = Math.min(
			SIGNAL_SEGMENT_MAX,
			Math.max(SIGNAL_SEGMENT_MIN, distance * options.params.signalLength),
		) / distance;
		const headProgress = signal.forward ? signal.progress : 1 - signal.progress;
		const tailProgress = signal.forward
			? Math.max(0, headProgress - segmentProgress)
			: Math.min(1, headProgress + segmentProgress);
		const tail = interpolatePoint(source, target, tailProgress);
		const head = interpolatePoint(source, target, headProgress);
		const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
		const alpha = clampAlpha(signal.alpha * signalOpacity);

		gradient.addColorStop(0, colorWithAlpha(signalColor, 0));
		gradient.addColorStop(0.64, colorWithAlpha(signalColor, alpha * 0.62));
		gradient.addColorStop(1, colorWithAlpha(signalColor, alpha * SIGNAL_HEAD_ALPHA));

		ctx.strokeStyle = gradient;
		ctx.globalAlpha = 1;
		drawStraightEdgePath(ctx, tail, head);
		ctx.stroke();

		ctx.fillStyle = colorWithAlpha(signalColor, alpha * 0.72);
		ctx.beginPath();
		ctx.arc(head.x, head.y, ctx.lineWidth * 0.88, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

function drawNodeShape(
	ctx: CanvasRenderingContext2D,
	point: NeuralPoint,
	radius: number,
	params: NeuralGraphParams,
) {
	ctx.beginPath();
	if (params.nodeShape === "square") {
		drawSquareNodePath(ctx, point, radius, params.nodeRadius);
		ctx.fill();
		return;
	}

	ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
	ctx.fill();
}

function drawSquareNodePath(
	ctx: CanvasRenderingContext2D,
	point: NeuralPoint,
	radius: number,
	nodeRadius: number,
) {
	const diameter = radius * 2;
	const x = point.x - radius;
	const y = point.y - radius;
	const cornerRadius = Math.min(radius, Math.max(0, nodeRadius));

	if (cornerRadius === 0) {
		ctx.rect(x, y, diameter, diameter);
		return;
	}

	ctx.moveTo(x + cornerRadius, y);
	ctx.lineTo(x + diameter - cornerRadius, y);
	ctx.quadraticCurveTo(x + diameter, y, x + diameter, y + cornerRadius);
	ctx.lineTo(x + diameter, y + diameter - cornerRadius);
	ctx.quadraticCurveTo(x + diameter, y + diameter, x + diameter - cornerRadius, y + diameter);
	ctx.lineTo(x + cornerRadius, y + diameter);
	ctx.quadraticCurveTo(x, y + diameter, x, y + diameter - cornerRadius);
	ctx.lineTo(x, y + cornerRadius);
	ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
	ctx.closePath();
}

function drawNodes(
	ctx: CanvasRenderingContext2D,
	layout: NeuralGraphLayout,
	options: NeuralGraphRenderOptions,
	selectedRelationships: SelectedRelationshipIds,
) {
	const focusProgress = getFocusProgress(options);
	const getDrawRank = (node: NeuralLayoutNode) => {
		if (node.id === options.selectedNodeId) return 2;
		if (selectedRelationships.nodeIds.has(node.id)) return 1;
		return 0;
	};
	const sortedNodes = [...layout.nodes].sort((left, right) => {
		const rankDelta = getDrawRank(left) - getDrawRank(right);
		if (rankDelta !== 0) return rankDelta;
		return left.z - right.z;
	});

	const hoverScale = options.params.hoverScale;
	const glowSize = options.params.glowSize;
	const glowIntensity = options.params.glowIntensity;
	const glowIntensityRelated = glowIntensity * 0.5;
	for (const node of sortedNodes) {
		const isSelected = node.id === options.selectedNodeId;
		const isHovered = node.id === options.hoveredNodeId;
		const nodeColor = getNodeColor(node, options);
		const isRelated = selectedRelationships.nodeIds.has(node.id);
		let focusAlpha = 1;
		if (focusProgress > 0) {
			if (isSelected) {
				focusAlpha = 1;
			} else if (isRelated) {
				focusAlpha = lerp(1, options.params.nodeOpacityRelated, focusProgress);
			} else {
				focusAlpha = lerp(1, options.params.nodeOpacityFocused, focusProgress);
			}
		}
			const radius = getNodeViewportRadius(node, options.camera, options.params, options.selectedNodeId);
		const alpha = Math.min(1, node.alpha * (isSelected || isHovered ? 1 : options.params.nodeOpacity) * focusAlpha);
		const point = worldToViewport(node, options.camera, options.viewport, options.params);

		ctx.save();
		ctx.globalAlpha = alpha;
		if (isSelected || isHovered || (focusProgress > 0 && isRelated)) {
			const glowRadius = radius * glowSize * (isHovered ? hoverScale : 1);
			const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius);
			glow.addColorStop(0, colorWithAlpha(nodeColor, isSelected || isHovered ? glowIntensity : glowIntensityRelated));
			glow.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(point.x, point.y, glowRadius, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = nodeColor;
		drawNodeShape(ctx, point, radius, options.params);
		ctx.lineWidth = isSelected ? lerp(1.8, 2.6, focusProgress) : isRelated ? lerp(1, 1.35, focusProgress) : 1;
		ctx.strokeStyle = isSelected ? "rgba(255, 255, 255, 0.92)" : colorWithAlpha(nodeColor, isRelated ? lerp(0.42, 0.74, focusProgress) : 0.42);
		ctx.beginPath();
		if (options.params.nodeShape === "square") {
			drawSquareNodePath(ctx, point, radius, options.params.nodeRadius);
		} else {
			ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
		}
		ctx.stroke();
		ctx.restore();
	}
}

function drawLabels(
	ctx: CanvasRenderingContext2D,
	layout: NeuralGraphLayout,
	options: NeuralGraphRenderOptions,
) {
	if (!options.params.showLabels) return;
	if (!shouldRevealLabels(options)) return;
	const revealProgress = smoothProgress(getLabelRevealProgress(options));
	if (isRadialClusterLayout(layout)) {
		drawRadialLabels(ctx, layout, options, revealProgress);
		return;
	}
	const palette = PALETTES[options.theme];
	const activeNodeId = getLabelNodeId(options);
	if (!activeNodeId) return;

	const active = layout.nodesById.get(activeNodeId);
	if (!active) return;

	const labelSize = options.params.labelSize;
	const metaSize = options.params.labelMetaSize;
	const point = worldToViewport(active, options.camera, options.viewport, options.params);
	ctx.save();
	ctx.globalAlpha = revealProgress;
	ctx.font = `600 ${labelSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
	ctx.fillStyle = palette.label;
	ctx.textBaseline = "bottom";
	ctx.fillText(active.node.title, point.x + 12, point.y - 10 + (1 - revealProgress) * 4);
	ctx.font = `500 ${metaSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
	ctx.fillStyle = palette.labelSubtle;
	ctx.textBaseline = "top";
	ctx.fillText(`${active.node.kind} · ${active.node.degree} links`, point.x + 12, point.y - 8 + (1 - revealProgress) * 4);
	ctx.restore();
}

const RADIAL_LABEL_ALL_NODES_MIN_WIDTH = 700;
const RADIAL_WORKFLOW_LABEL_ALL_NODES_MIN_WIDTH = 1600;
const RADIAL_LABEL_OFFSET = 11;

function drawRadialLabels(
	ctx: CanvasRenderingContext2D,
	layout: NeuralGraphLayout,
	options: NeuralGraphRenderOptions,
	revealProgress: number,
) {
	const palette = PALETTES[options.theme];
	const activeNodeId = getLabelNodeId(options);
	const labelAllNodesMinWidth = options.labelStrategy === "workflowTree"
		? RADIAL_WORKFLOW_LABEL_ALL_NODES_MIN_WIDTH
		: RADIAL_LABEL_ALL_NODES_MIN_WIDTH;
	const shouldDrawAllLabels = options.viewport.width >= labelAllNodesMinWidth;
	const nodes = getRadialLabelNodes(layout, {
		activeNodeId,
		labelStrategy: options.labelStrategy,
		shouldDrawAllLabels,
	});
	if (nodes.length === 0) return;

	const origin = getNeuralOrigin(options.viewport, options.params);
	const labelSize = shouldDrawAllLabels ? options.params.labelSize : Math.max(10, options.params.labelSize - 1);
	ctx.save();
	ctx.font = `500 ${labelSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
	ctx.fillStyle = palette.label;
	ctx.textBaseline = "middle";

	for (const node of nodes) {
		const point = worldToViewport(node, options.camera, options.viewport, options.params);
		const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
		const isLeft = Math.cos(angle) < 0;
		const offset = RADIAL_LABEL_OFFSET + Math.max(4, node.baseSize * options.camera.zoom) + (1 - revealProgress) * 6;
		const labelPoint = {
			x: point.x + Math.cos(angle) * offset,
			y: point.y + Math.sin(angle) * offset,
		};

		ctx.save();
		ctx.globalAlpha = (node.id === activeNodeId ? 0.96 : 0.78) * revealProgress;
		ctx.translate(labelPoint.x, labelPoint.y);
		ctx.rotate(isLeft ? angle + Math.PI : angle);
		ctx.textAlign = isLeft ? "right" : "left";
		ctx.fillText(node.node.title, isLeft ? -6 : 6, 0);
		ctx.restore();
	}

	ctx.restore();
}

export function drawNeuralGraph(
	ctx: CanvasRenderingContext2D,
	layout: NeuralGraphLayout,
	options: NeuralGraphRenderOptions,
) {
	const frameOptions: NeuralGraphFrameRenderOptions = {
		...options,
		resolvedColorCache: new Map(),
	};
	const selectedRelationships = getSelectedRelationshipIds(layout, options.selectedNodeId);

	if (frameOptions.background === "transparent") {
		ctx.clearRect(0, 0, frameOptions.viewport.width, frameOptions.viewport.height);
	} else {
		drawBackground(ctx, frameOptions.viewport, frameOptions.params, frameOptions.theme, (color) => getResolvedColor(color, frameOptions));
	}
	if (isRadialClusterLayout(layout)) {
		drawEdges(ctx, layout, frameOptions, selectedRelationships);
		drawSignalStreaks(ctx, layout, frameOptions);
		drawRays(ctx, layout, frameOptions, selectedRelationships);
	} else {
		drawRays(ctx, layout, frameOptions, selectedRelationships);
		drawEdges(ctx, layout, frameOptions, selectedRelationships);
		drawSignalStreaks(ctx, layout, frameOptions);
	}
	drawNodes(ctx, layout, frameOptions, selectedRelationships);
	drawLabels(ctx, layout, frameOptions);
}
