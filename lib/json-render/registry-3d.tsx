"use client";

// 3D scene components for the json-render registry; three.js and drei stay lazy-loaded.
import { Suspense, lazy } from "react";
import { nu, toSafeText } from "./registry-values";
import type { Components } from "@json-render/react";
import type { catalog } from "./catalog";

// ── 3D (lazy-loaded) ──────────────────────────────────────────
const Scene3DImpl = lazy(() => import("./scene-3d"));

// ── Lazy wrappers for drei components ──────────────────────────
const StarsImpl = lazy(() =>
	import("@react-three/drei").then((mod) => ({
		default: (p: { count?: number; radius?: number; depth?: number }) => <mod.Stars count={p.count} radius={p.radius} depth={p.depth} />,
	})),
);

const Label3DImpl = lazy(() =>
	import("@react-three/drei").then((mod) => ({
		default: (p: { text: string; position?: [number, number, number]; color?: string; fontSize?: number }) => (
			<mod.Text position={p.position} color={p.color} fontSize={p.fontSize} anchorX="center" anchorY="middle">
				{p.text}
			</mod.Text>
		),
	})),
);


export const threeDComponents = {
	// ── 3D ─────────────────────────────────────────
	Scene3D: ({ props, children }) => (
		<Suspense
			fallback={
				<div className="flex items-center justify-center bg-bg-neutral rounded-lg" style={{ height: nu(props.height) }}>
					Loading 3D scene...
				</div>
			}
		>
			<Scene3DImpl props={{ background: nu(props.background), cameraPosition: nu(props.cameraPosition), height: nu(props.height), orbitControls: nu(props.orbitControls) }}>{children}</Scene3DImpl>
		</Suspense>
	),

	Group3D: ({ props, children }) => (
		<group position={nu(props.position)} rotation={nu(props.rotation)} userData={{ animate: props.animate }}>
			{children}
		</group>
	),

	Box: ({ props }) => (
		<mesh position={nu(props.position)}>
			<boxGeometry args={props.size ?? [1, 1, 1]} />
			<meshStandardMaterial color={nu(props.color)} />
		</mesh>
	),

	Sphere: ({ props }) => (
		<mesh position={nu(props.position)}>
			<sphereGeometry args={[nu(props.radius), 32, 32]} />
			<meshStandardMaterial color={nu(props.color)} />
		</mesh>
	),

	Cylinder: ({ props }) => (
		<mesh position={nu(props.position)}>
			<cylinderGeometry args={[nu(props.radiusTop), nu(props.radiusBottom), nu(props.height), 32]} />
			<meshStandardMaterial color={nu(props.color)} />
		</mesh>
	),

	Cone: ({ props }) => (
		<mesh position={nu(props.position)}>
			<coneGeometry args={[nu(props.radius), nu(props.height), 32]} />
			<meshStandardMaterial color={nu(props.color)} />
		</mesh>
	),

	Torus: ({ props }) => (
		<mesh position={nu(props.position)}>
			<torusGeometry args={[nu(props.radius), nu(props.tube), 16, 48]} />
			<meshStandardMaterial color={nu(props.color)} />
		</mesh>
	),

	Plane: ({ props }) => (
		<mesh position={nu(props.position)} rotation={nu(props.rotation)}>
			<planeGeometry args={props.size ?? [10, 10]} />
			<meshStandardMaterial color={nu(props.color)} />
		</mesh>
	),

	Ring: ({ props }) => (
		<mesh position={nu(props.position)} rotation={nu(props.rotation)}>
			<ringGeometry args={[nu(props.innerRadius), nu(props.outerRadius), 32]} />
			<meshStandardMaterial color={nu(props.color)} side={2} />
		</mesh>
	),

	AmbientLight: ({ props }) => <ambientLight intensity={nu(props.intensity)} color={nu(props.color)} />,

	PointLight: ({ props }) => <pointLight position={nu(props.position)} intensity={nu(props.intensity)} color={nu(props.color)} />,

	DirectionalLight: ({ props }) => <directionalLight position={nu(props.position)} intensity={nu(props.intensity)} color={nu(props.color)} />,

	Stars: ({ props }) => (
		<Suspense fallback={null}>
			<StarsImpl count={nu(props.count)} radius={nu(props.radius)} depth={nu(props.depth)} />
		</Suspense>
	),

	Label3D: ({ props }) => (
		<Suspense fallback={null}>
			<Label3DImpl text={toSafeText(props.text)} position={nu(props.position)} color={nu(props.color)} fontSize={nu(props.fontSize)} />
		</Suspense>
	),
} satisfies Partial<Components<typeof catalog>>;
