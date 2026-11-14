import type { NeuralPoint, NeuralViewport } from "./camera";
import {
	isRayOnlyNeuralGraphInteraction,
	type NeuralGraphInteractionState,
} from "./interaction-dynamics";
import type { NeuralGraphParams } from "./params";
import {
	getSelectedNeighborhood,
	getVisibleGraphEdges,
	getVisibleGraphNodes,
	type NeuralGraphEdge,
	type NeuralGraphNode,
	type NeuralGraphStore,
} from "./store";
import { lerp } from "@/lib/math";

export interface NeuralLayoutNode extends NeuralPoint {
	alpha: number;
	baseSize: number;
	depthScale: number;
	id: string;
	node: NeuralGraphNode;
	phase: number;
	z: number;
}

export interface NeuralLayoutEdge {
	edge: NeuralGraphEdge;
	id: string;
	source: NeuralLayoutNode;
	target: NeuralLayoutNode;
}

export interface NeuralLayoutTreeBranch {
	edge: NeuralGraphEdge | null;
	id: string;
	source: NeuralLayoutNode | null;
	sourceId: string | null;
	target: NeuralLayoutNode;
	targetId: string;
}

export interface NeuralGraphLayout {
	crossEdges?: NeuralLayoutEdge[];
	edges: NeuralLayoutEdge[];
	layoutShape?: "cone" | "radialCluster";
	nodes: NeuralLayoutNode[];
	nodesById: Map<string, NeuralLayoutNode>;
	origin: NeuralPoint;
	treeBranches?: NeuralLayoutTreeBranch[];
	viewport: NeuralViewport;
}

const DEG_TO_RAD = Math.PI / 180;
const FULL_RADIAL_ARC_EPSILON = 0.001;
const RELAXATION_ITERATIONS = 18;
const TAU = Math.PI * 2;

function clampFocusProgress(value = 0) {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}

function clampInteractionProgress(interaction: NeuralGraphInteractionState | null | undefined, reduceMotion: boolean) {
	if (reduceMotion || !interaction || isRayOnlyNeuralGraphInteraction(interaction)) return 0;
	return Math.min(1.5, Math.max(0, interaction.intensity)) * Math.max(0, interaction.flowBoost);
}

function hashString(value: string) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function unitHash(value: string, salt: string) {
	return hashString(`${salt}:${value}`) / 0xffffffff;
}

function signedHash(value: string, salt: string) {
	return unitHash(value, salt) * 2 - 1;
}

function isFullRadialArc(arcAngle: number) {
	return arcAngle >= TAU - FULL_RADIAL_ARC_EPSILON;
}

function waveNoise(
	node: NeuralGraphNode,
	params: NeuralGraphParams,
	time: number,
	reduceMotion: boolean,
	interaction?: NeuralGraphInteractionState | null,
) {
	if (reduceMotion || params.amplitude <= 0 || params.speed <= 0) return { x: 0, y: 0 };

	const interactionProgress = clampInteractionProgress(interaction, reduceMotion);
	const velocity = Math.max(0, interaction?.velocity ?? 0);
	const speed = params.speed * (1 + interactionProgress * (0.42 + velocity * 0.3));
	const amplitude = params.amplitude * (1 + interactionProgress * 0.32);
	let x = 0;
	let y = 0;
	let weight = 1;
	let frequency = params.frequency;

	for (let octave = 0; octave < params.octaves; octave += 1) {
		const phase = unitHash(node.id, `phase-${octave}`) * Math.PI * 2;
		const tick = time * speed * frequency + phase;
		x += Math.cos(tick) * weight;
		y += Math.sin(tick * 0.84 + phase) * weight;
		weight *= 0.5;
		frequency *= 1.72;
	}

	const scale = params.spread * amplitude * 0.1;
	return { x: x * scale, y: y * scale };
}

function getLayoutNodeBaseSize(params: NeuralGraphParams) {
	return Math.max(2.5, params.nodeSize);
}

function createInitialNode(
	node: NeuralGraphNode,
	index: number,
	total: number,
	params: NeuralGraphParams,
	time: number,
	reduceMotion: boolean,
	viewport: NeuralViewport,
	interaction?: NeuralGraphInteractionState | null,
): NeuralLayoutNode {
	const t = total <= 1 ? 0.5 : index / (total - 1);
	const interactionProgress = clampInteractionProgress(interaction, reduceMotion);
	const velocity = Math.max(0, interaction?.velocity ?? 0);
	const pointerX = interaction?.pointer ? interaction.pointer.x / Math.max(1, viewport.width) - 0.5 : 0;
	const pointerY = interaction?.pointer ? interaction.pointer.y / Math.max(1, viewport.height) - 0.5 : 0;
	const breath = Math.sin(time * (1.2 + velocity * 1.6) + unitHash(node.id, "breath") * Math.PI * 2)
		* interactionProgress
		* 0.02;
	const effectiveSpread = params.spread * (1 + interactionProgress * 0.045 + breath);
	const coneAngle = params.coneAngle * (1 + interactionProgress * 0.05) * DEG_TO_RAD;
	const angleJitter = signedHash(node.id, "angle") * coneAngle * 0.08;
	const angle = -Math.PI / 2 + (t - 0.5) * coneAngle + angleJitter + params.tiltZ * DEG_TO_RAD * 0.1 + pointerX * interactionProgress * 0.075;
	const radiusRange = Math.max(0, params.radiusMax - params.radiusMin) / 100;
	const radiusMin = params.radiusMin / 100;
	const radius = effectiveSpread * (radiusMin + unitHash(node.id, "radius") * radiusRange);
	const z = signedHash(node.id, "depth") * params.depthZ;
	const depthScale = params.perspective / Math.max(1, params.perspective + z);
	const tiltOffset = Math.sin(params.tiltX * DEG_TO_RAD) * z * 0.4 + pointerY * interactionProgress * params.spread * 0.012;
	const flow = waveNoise(node, params, time, reduceMotion, interaction);

	return {
		alpha: 1,
		baseSize: getLayoutNodeBaseSize(params),
		depthScale,
		id: node.id,
		node,
		phase: unitHash(node.id, "phase"),
		x: Math.cos(angle) * radius * depthScale + flow.x,
		y: Math.sin(angle) * radius * depthScale + tiltOffset + flow.y,
		z,
	};
}

interface RadialClusterTreeNode {
	angle: number;
	children: RadialClusterTreeNode[];
	depth: number;
	edge: NeuralGraphEdge | null;
	leafCount: number;
	node: NeuralGraphNode;
	parentId: string | null;
	radius: number;
}

function getVisibleNeighbors({
	nodeId,
	store,
	visibleNodeIds,
}: {
	nodeId: string;
	store: NeuralGraphStore;
	visibleNodeIds: ReadonlySet<string>;
}) {
	return (store.adjacency.get(nodeId) ?? [])
		.filter(({ node }) => visibleNodeIds.has(node.id));
}

function isAutomationWorkflowRootNode(node: NeuralGraphNode) {
	return node.original.frontmatter?.type === "AutomationWorkflowRoot";
}

function getRadialClusterRootCandidates({
	selectedNodeId,
	store,
	visibleNodeIds,
}: {
	selectedNodeId: string | null;
	store: NeuralGraphStore;
	visibleNodeIds: ReadonlySet<string>;
}) {
	const selected = selectedNodeId ? store.nodesById.get(selectedNodeId) : null;
	const candidates: NeuralGraphNode[] = [];
	const candidateIds = new Set<string>();
	const addCandidate = (node: NeuralGraphNode | null | undefined) => {
		if (!node || !visibleNodeIds.has(node.id) || candidateIds.has(node.id)) return;
		candidates.push(node);
		candidateIds.add(node.id);
	};

	addCandidate(selected);

	for (const node of store.nodes) {
		if (isAutomationWorkflowRootNode(node)) {
			addCandidate(node);
		}
	}

	for (const node of store.rankedNodes) {
		addCandidate(node);
	}

	return candidates;
}

function buildRadialClusterForest({
	selectedNodeId,
	store,
	visibleNodeIds,
}: {
	selectedNodeId: string | null;
	store: NeuralGraphStore;
	visibleNodeIds: ReadonlySet<string>;
}) {
	const visitedNodeIds = new Set<string>();
	const roots: RadialClusterTreeNode[] = [];

	function createTreeNode(
		node: NeuralGraphNode,
		parentId: string | null,
		edge: NeuralGraphEdge | null,
		depth: number,
	): RadialClusterTreeNode {
		return {
			angle: 0,
			children: [],
			depth,
			edge,
			leafCount: 1,
			node,
			parentId,
			radius: 0,
		};
	}

	for (const rootCandidate of getRadialClusterRootCandidates({ selectedNodeId, store, visibleNodeIds })) {
		if (visitedNodeIds.has(rootCandidate.id)) continue;
		const root = createTreeNode(rootCandidate, null, null, 1);
		const queue = [root];
		visitedNodeIds.add(rootCandidate.id);
		roots.push(root);

		for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
			const treeNode = queue[queueIndex];
			for (const neighbor of getVisibleNeighbors({ nodeId: treeNode.node.id, store, visibleNodeIds })) {
				if (neighbor.node.id === treeNode.parentId || visitedNodeIds.has(neighbor.node.id)) {
					continue;
				}
				const child = createTreeNode(neighbor.node, treeNode.node.id, neighbor.edge, treeNode.depth + 1);
				treeNode.children.push(child);
				visitedNodeIds.add(neighbor.node.id);
				queue.push(child);
			}
		}
	}

	return roots;
}

function countRadialLeaves(node: RadialClusterTreeNode): number {
	if (node.children.length === 0) {
		node.leafCount = 1;
		return node.leafCount;
	}

	node.leafCount = node.children.reduce((sum, child) => sum + countRadialLeaves(child), 0);
	return node.leafCount;
}

function getMaxRadialDepth(node: RadialClusterTreeNode): number {
	return node.children.reduce(
		(maxDepth, child) => Math.max(maxDepth, getMaxRadialDepth(child)),
		node.depth,
	);
}

function assignRadialLeafAngles({
	arcAngle,
	nextLeafIndex,
	node,
	startAngle,
	totalLeaves,
}: {
	arcAngle: number;
	nextLeafIndex: { current: number };
	node: RadialClusterTreeNode;
	startAngle: number;
	totalLeaves: number;
}) {
	if (node.children.length === 0) {
		if (totalLeaves <= 1) {
			node.angle = startAngle + arcAngle / 2;
		} else if (isFullRadialArc(arcAngle)) {
			node.angle = startAngle + (arcAngle * nextLeafIndex.current) / totalLeaves;
		} else {
			node.angle = startAngle + (arcAngle * nextLeafIndex.current) / (totalLeaves - 1);
		}
		nextLeafIndex.current += 1;
		return node.angle;
	}

	let weightedX = 0;
	let weightedY = 0;
	let fallbackAngle = 0;
	for (const child of node.children) {
		const childAngle = assignRadialLeafAngles({
			arcAngle,
			nextLeafIndex,
			node: child,
			startAngle,
			totalLeaves,
		});
		weightedX += Math.cos(childAngle) * child.leafCount;
		weightedY += Math.sin(childAngle) * child.leafCount;
		fallbackAngle += childAngle * child.leafCount;
	}
	const vectorLength = Math.hypot(weightedX, weightedY);
	node.angle = vectorLength > 0.0001
		? Math.atan2(weightedY, weightedX)
		: fallbackAngle / Math.max(1, node.leafCount);
	return node.angle;
}

function assignRadialRadii({
	maxDepth,
	node,
	outerRadius,
	params,
	pinRootToOrigin,
	rootRadius,
}: {
	maxDepth: number;
	node: RadialClusterTreeNode;
	outerRadius: number;
	params: NeuralGraphParams;
	pinRootToOrigin: boolean;
	rootRadius: number;
}) {
	if (node.children.length === 0) {
		node.radius = outerRadius;
	} else if (node.depth <= 1) {
		node.radius = pinRootToOrigin ? 0 : rootRadius;
	} else {
		const depthProgress = maxDepth <= 1 ? 1 : (node.depth - 1) / Math.max(1, maxDepth - 1);
		const curvedProgress = Math.pow(Math.max(0, Math.min(1, depthProgress)), params.radialDepthCurve);
		node.radius = lerp(rootRadius, outerRadius, curvedProgress);
	}

	for (const child of node.children) {
		assignRadialRadii({ maxDepth, node: child, outerRadius, params, pinRootToOrigin: false, rootRadius });
	}
}

function flattenRadialClusterForest(roots: RadialClusterTreeNode[]) {
	const flattened: RadialClusterTreeNode[] = [];

	function collect(node: RadialClusterTreeNode) {
		flattened.push(node);
		for (const child of node.children) {
			collect(child);
		}
	}

	for (const root of roots) {
		collect(root);
	}

	return flattened;
}

function createRadialLayoutNode({
	interaction,
	node,
	params,
	reduceMotion,
	time,
	viewport,
}: {
	interaction?: NeuralGraphInteractionState | null;
	node: RadialClusterTreeNode;
	params: NeuralGraphParams;
	reduceMotion: boolean;
	time: number;
	viewport: NeuralViewport;
}): NeuralLayoutNode {
	const interactionProgress = clampInteractionProgress(interaction, reduceMotion);
	const pointerX = interaction?.pointer ? interaction.pointer.x / Math.max(1, viewport.width) - 0.5 : 0;
	const pointerY = interaction?.pointer ? interaction.pointer.y / Math.max(1, viewport.height) - 0.5 : 0;
	const z = signedHash(node.node.id, "radial-depth") * params.depthZ * 0.44;
	const depthScale = params.perspective / Math.max(1, params.perspective + z);
	const angle = node.angle + params.tiltZ * DEG_TO_RAD * 0.035 + pointerX * interactionProgress * 0.035;
	const flow = waveNoise(node.node, params, time, reduceMotion, interaction);
	const flowScale = params.layoutShape === "radialCluster" ? 0.18 : 1;
	const tiltOffset = Math.sin(params.tiltX * DEG_TO_RAD) * z * 0.16 + pointerY * interactionProgress * params.spread * 0.006;
	const isOriginAnchor = node.depth <= 1 && node.radius <= 0.001;
	const originOffsetX = isOriginAnchor ? 0 : flow.x * flowScale;
	const originOffsetY = isOriginAnchor ? 0 : flow.y * flowScale + tiltOffset;

	return {
		alpha: 1,
		baseSize: getLayoutNodeBaseSize(params),
		depthScale,
		id: node.node.id,
		node: node.node,
		phase: unitHash(node.node.id, "phase"),
		x: Math.cos(angle) * node.radius + originOffsetX,
		y: Math.sin(angle) * node.radius + originOffsetY,
		z,
	};
}

function createLayoutTreeBranches(
	branches: ReadonlyArray<NeuralLayoutTreeBranch>,
	nodesById: Map<string, NeuralLayoutNode>,
) {
	const layoutBranches: NeuralLayoutTreeBranch[] = [];

	for (const branch of branches) {
		const target = nodesById.get(branch.targetId);
		const source = branch.sourceId ? nodesById.get(branch.sourceId) ?? null : null;
		if (!target || (branch.sourceId && !source)) {
			continue;
		}
		layoutBranches.push({
			...branch,
			source,
			target,
		});
	}

	return layoutBranches;
}

function computeRadialClusterLayout({
	focusNodeId,
	focusProgress,
	interaction,
	params,
	reduceMotion,
	selectedNodeId,
	store,
	time,
	viewport,
	visibleEdges,
	visibleNodes,
}: {
	focusNodeId?: string | null;
	focusProgress?: number;
	interaction?: NeuralGraphInteractionState | null;
	params: NeuralGraphParams;
	reduceMotion: boolean;
	selectedNodeId: string | null;
	store: NeuralGraphStore;
	time: number;
	viewport: NeuralViewport;
	visibleEdges: NeuralGraphEdge[];
	visibleNodes: NeuralGraphNode[];
}): NeuralGraphLayout {
	const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
	const forest = buildRadialClusterForest({ selectedNodeId, store, visibleNodeIds });
	for (const root of forest) {
		countRadialLeaves(root);
	}
	const totalLeaves = forest.reduce((sum, root) => sum + root.leafCount, 0);
	const arcAngle = Math.min(360, Math.max(60, params.radialArcAngle)) * DEG_TO_RAD;
	const startAngle = -Math.PI / 2 - arcAngle / 2;
	const nextLeafIndex = { current: 0 };
	const outerRadius = params.spread * Math.max(0.2, params.radiusMax / 100);
	const rootRadius = Math.min(
		outerRadius * 0.34,
		params.spread * Math.max(0.08, params.radiusMin / 100) * 0.42,
	);
	const maxDepth = forest.reduce((depth, root) => Math.max(depth, getMaxRadialDepth(root)), 1);

	for (const [rootIndex, root] of forest.entries()) {
		assignRadialLeafAngles({
			arcAngle,
			nextLeafIndex,
			node: root,
			startAngle,
			totalLeaves,
		});
		assignRadialRadii({
			maxDepth,
			node: root,
			outerRadius,
			params,
			pinRootToOrigin: rootIndex === 0,
			rootRadius,
		});
	}

	const treeNodes = flattenRadialClusterForest(forest);
	const layoutNodes = treeNodes.map((node) =>
		createRadialLayoutNode({ interaction, node, params, reduceMotion, time, viewport }),
	);
	const nodesById = new Map(layoutNodes.map((node) => [node.id, node]));
	const treeEdgeIds = new Set<string>();
	const treeBranchTemplates: NeuralLayoutTreeBranch[] = [];

	for (const treeNode of treeNodes) {
		if (treeNode.edge) {
			treeEdgeIds.add(treeNode.edge.id);
		}
		const target = nodesById.get(treeNode.node.id);
		const source = treeNode.parentId ? nodesById.get(treeNode.parentId) ?? null : null;
		if (!target) continue;
		treeBranchTemplates.push({
			edge: treeNode.edge,
			id: treeNode.edge?.id ?? `origin-${treeNode.node.id}`,
			source,
			sourceId: treeNode.parentId,
			target,
			targetId: treeNode.node.id,
		});
	}

	const layoutEdges = createLayoutEdges(visibleEdges, nodesById);
	const crossEdges = createLayoutEdges(
		visibleEdges.filter((edge) => !treeEdgeIds.has(edge.id)),
		nodesById,
	);

	applySelectionFocusLayout({
		focusProgress,
		nodes: layoutNodes,
		params,
		selectedNodeId: focusNodeId ?? selectedNodeId,
		store,
	});

	const focusedNodesById = new Map(layoutNodes.map((node) => [node.id, node]));

	return {
		crossEdges: createLayoutEdges(crossEdges.map((edge) => edge.edge), focusedNodesById),
		edges: createLayoutEdges(layoutEdges.map((edge) => edge.edge), focusedNodesById),
		layoutShape: "radialCluster",
		nodes: layoutNodes,
		nodesById: focusedNodesById,
		origin: { x: 0, y: 0 },
		treeBranches: createLayoutTreeBranches(treeBranchTemplates, focusedNodesById),
		viewport,
	};
}

function relaxLayout(
	nodes: NeuralLayoutNode[],
	edges: NeuralGraphEdge[],
	params: NeuralGraphParams,
	interaction?: NeuralGraphInteractionState | null,
	reduceMotion = false,
) {
	if (nodes.length < 2) return;

	const interactionProgress = clampInteractionProgress(interaction, reduceMotion);
	const indexById = new Map(nodes.map((node, index) => [node.id, index]));
	const velocity = nodes.map(() => ({ x: 0, y: 0 }));
	const restById = new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
	const attraction = 0.0038;
	const repulsion = params.spread * (1 + interactionProgress * 0.06) * 0.028;
	const gravity = 0.018;

	for (let iteration = 0; iteration < RELAXATION_ITERATIONS; iteration += 1) {
		for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
			for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
				const left = nodes[leftIndex];
				const right = nodes[rightIndex];
				const dx = left.x - right.x;
				const dy = left.y - right.y;
				const distanceSq = Math.max(36, dx * dx + dy * dy);
				const force = (repulsion * left.node.mass * right.node.mass) / distanceSq;
				velocity[leftIndex].x += dx * force;
				velocity[leftIndex].y += dy * force;
				velocity[rightIndex].x -= dx * force;
				velocity[rightIndex].y -= dy * force;
			}
		}

		for (const edge of edges) {
			const sourceIndex = indexById.get(edge.source);
			const targetIndex = indexById.get(edge.target);
			if (sourceIndex === undefined || targetIndex === undefined) continue;
			const source = nodes[sourceIndex];
			const target = nodes[targetIndex];
			const dx = target.x - source.x;
			const dy = target.y - source.y;
			velocity[sourceIndex].x += dx * attraction * edge.weight;
			velocity[sourceIndex].y += dy * attraction * edge.weight;
			velocity[targetIndex].x -= dx * attraction * edge.weight;
			velocity[targetIndex].y -= dy * attraction * edge.weight;
		}

		for (let index = 0; index < nodes.length; index += 1) {
			const node = nodes[index];
			const rest = restById.get(node.id) ?? { x: 0, y: 0 };
			velocity[index].x += (rest.x - node.x) * gravity;
			velocity[index].y += (rest.y - node.y) * gravity;
			node.x += velocity[index].x;
			node.y += velocity[index].y;
			velocity[index].x *= 0.52;
			velocity[index].y *= 0.52;
		}
	}
}

function applySelectionFocusLayout({
	focusProgress,
	nodes,
	params,
	selectedNodeId,
	store,
}: {
	focusProgress?: number;
	nodes: NeuralLayoutNode[];
	params: NeuralGraphParams;
	selectedNodeId: string | null;
	store: NeuralGraphStore;
}) {
	const progress = clampFocusProgress(focusProgress);
	if (!selectedNodeId || progress <= 0) return;

	const selectedNode = nodes.find((node) => node.id === selectedNodeId);
	if (!selectedNode) return;

	selectedNode.x = lerp(selectedNode.x, 0, progress);
	selectedNode.y = lerp(selectedNode.y, 0, progress);

	const selectedAnchor = { x: selectedNode.x, y: selectedNode.y };
	const visibleNodeIds = new Set(nodes.map((node) => node.id));
	const focusNeighbors = getSelectedNeighborhood(store, selectedNodeId, nodes.length)
		.filter(({ node }) => visibleNodeIds.has(node.id));
	const neighborOrder = new Map(focusNeighbors.map(({ node }, index) => [node.id, index]));
	const linkedCount = Math.max(1, focusNeighbors.length);
	const ringRadiusX = params.spread * 0.34;
	const ringRadiusY = params.spread * 0.24;
	const maxArc = Math.PI * 0.9;
	const angleStep = linkedCount <= 1 ? 0 : maxArc / (linkedCount - 1);
	const startAngle = -Math.PI / 2 - angleStep * (linkedCount - 1) * 0.5;
	const focusBlend = progress * 0.86;
	const retreatBlend = progress * 0.92;

	for (const node of nodes) {
		if (node.id === selectedNodeId) {
			continue;
		}

		const order = neighborOrder.get(node.id);
		if (order !== undefined) {
			const angle = startAngle + angleStep * order;
			const targetX = selectedAnchor.x + Math.cos(angle) * ringRadiusX;
			const targetY = selectedAnchor.y + Math.sin(angle) * ringRadiusY;
			node.x = lerp(node.x, targetX, focusBlend);
			node.y = lerp(node.y, targetY, focusBlend);
			continue;
		}

		const dx = node.x - selectedAnchor.x;
		const dy = node.y - selectedAnchor.y;
		const distance = Math.hypot(dx, dy);
		const fallbackX = signedHash(node.id, "focus-away-x");
		const fallbackY = signedHash(node.id, "focus-away-y");
		const unitX = distance > 1 ? dx / distance : fallbackX;
		const unitY = distance > 1 ? dy / distance : fallbackY;
		const push = params.spread * (0.44 + unitHash(node.id, "focus-away") * 0.28);
		const targetX = node.x + unitX * push;
		const targetY = node.y + unitY * push * 0.7;
		node.x = lerp(node.x, targetX, retreatBlend);
		node.y = lerp(node.y, targetY, retreatBlend);
	}
}

function createLayoutEdges(edges: NeuralGraphEdge[], nodesById: Map<string, NeuralLayoutNode>) {
	const layoutEdges: NeuralLayoutEdge[] = [];

	for (const edge of edges) {
		const source = nodesById.get(edge.source);
		const target = nodesById.get(edge.target);
		if (!source || !target) {
			continue;
		}

		layoutEdges.push({ edge, id: edge.id, source, target });
	}

	return layoutEdges;
}

function blendLayoutNode(current: NeuralLayoutNode, next: NeuralLayoutNode, amount: number): NeuralLayoutNode {
	return {
		...next,
		alpha: lerp(current.alpha, next.alpha, amount),
		baseSize: lerp(current.baseSize, next.baseSize, amount),
		depthScale: lerp(current.depthScale, next.depthScale, amount),
		x: lerp(current.x, next.x, amount),
		y: lerp(current.y, next.y, amount),
		z: lerp(current.z, next.z, amount),
	};
}

export function smoothNeuralGraphLayout({
	amount,
	current,
	next,
}: {
	amount: number;
	current: NeuralGraphLayout | null | undefined;
	next: NeuralGraphLayout;
}): NeuralGraphLayout {
	if (!current) return next;
	const blendAmount = clampFocusProgress(amount);
	if (blendAmount >= 1) return next;
	if (blendAmount <= 0) return current;

	const nodes = next.nodes.map((node) => {
		const currentNode = current.nodesById.get(node.id);
		return currentNode ? blendLayoutNode(currentNode, node, blendAmount) : node;
	});
	const nodesById = new Map(nodes.map((node) => [node.id, node]));

	return {
		...next,
		crossEdges: next.crossEdges ? createLayoutEdges(next.crossEdges.map((edge) => edge.edge), nodesById) : undefined,
		edges: createLayoutEdges(next.edges.map((edge) => edge.edge), nodesById),
		nodes,
		nodesById,
		treeBranches: next.treeBranches ? createLayoutTreeBranches(next.treeBranches, nodesById) : undefined,
	};
}

export function pinNeuralGraphNodePosition({
	layout,
	nodeId,
	position,
}: {
	layout: NeuralGraphLayout;
	nodeId: string | null | undefined;
	position: NeuralLayoutNode | null | undefined;
}): NeuralGraphLayout {
	if (!nodeId || !position || !layout.nodesById.has(nodeId)) return layout;

	const nodes = layout.nodes.map((node) => node.id === nodeId
		? {
			...node,
			depthScale: position.depthScale,
			x: position.x,
			y: position.y,
			z: position.z,
		}
		: node);
	const nodesById = new Map(nodes.map((node) => [node.id, node]));

	return {
		...layout,
		crossEdges: layout.crossEdges ? createLayoutEdges(layout.crossEdges.map((edge) => edge.edge), nodesById) : undefined,
		edges: createLayoutEdges(layout.edges.map((edge) => edge.edge), nodesById),
		nodes,
		nodesById,
		treeBranches: layout.treeBranches ? createLayoutTreeBranches(layout.treeBranches, nodesById) : undefined,
	};
}

export function computeNeuralGraphLayout({
	focusNodeId,
	focusProgress = 0,
	interaction = null,
	params,
	reduceMotion = false,
	selectedNodeId,
	store,
	time = 0,
	viewport,
}: {
	focusNodeId?: string | null;
	focusProgress?: number;
	interaction?: NeuralGraphInteractionState | null;
	params: NeuralGraphParams;
	reduceMotion?: boolean;
	selectedNodeId: string | null;
	store: NeuralGraphStore;
	time?: number;
	viewport: NeuralViewport;
}): NeuralGraphLayout {
	const visibleNodes = getVisibleGraphNodes(store, selectedNodeId, params.maxVisibleNodes);
	const visibleEdges = getVisibleGraphEdges(store, visibleNodes);
	if (params.layoutShape === "radialCluster") {
		return computeRadialClusterLayout({
			focusNodeId,
			focusProgress,
			interaction,
			params,
			reduceMotion,
			selectedNodeId,
			store,
			time,
			viewport,
			visibleEdges,
			visibleNodes,
		});
	}

	const layoutNodes = visibleNodes.map((node, index) =>
		createInitialNode(node, index, visibleNodes.length, params, time, reduceMotion, viewport, interaction),
	);

	relaxLayout(layoutNodes, visibleEdges, params, interaction, reduceMotion);
	applySelectionFocusLayout({
		focusProgress,
		nodes: layoutNodes,
		params,
		selectedNodeId: focusNodeId ?? selectedNodeId,
		store,
	});

	const nodesById = new Map(layoutNodes.map((node) => [node.id, node]));
	const layoutEdges = createLayoutEdges(visibleEdges, nodesById);

	return {
		edges: layoutEdges,
		layoutShape: "cone",
		nodes: layoutNodes,
		nodesById,
		origin: { x: 0, y: 0 },
		viewport,
	};
}
