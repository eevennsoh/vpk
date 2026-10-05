"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { FINALE_COLORS } from "../data/finale-palette";
import type { FinaleRect } from "../data/finale-stories";
import { cameraBasis, finaleCameraRig, toView } from "../lib/finale-camera";
import { finaleCardSheetsShown } from "../lib/finale-column-flash";
import {
	FINALE_CAMERA_FOV,
	cameraDistance,
	cardPose,
	cardVelocity,
	chromaStrength,
	fogAtDepth,
	sphereWarp,
	lensFade,
	poseToWorld,
	restClipUv,
	landingShadow,
	heroShadowGround,
	slideShadowGround,
	tileHandoff,
	type FinaleCardInput,
	type FinaleViewport,
} from "../lib/finale-card-motion";
import { latePrintResolvers } from "../lib/finale-late-prints";
import {
	createLensMaterial,
	createShadowMaterial,
	createSheetMaterial,
	fallbackPrint,
	placeShadow,
	poseSheet,
	rgbUnit,
	setCloth,
	setLandingWave,
	textureFrom,
	type SheetMesh,
} from "../lib/finale-sheet-gl";
import { finaleFieldPixelRatio } from "../lib/finale-stage-fit";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { wallActive } from "../lib/finale-wall-motion";

export interface FinaleGlCard {
	readonly key: string;
	readonly input: FinaleCardInput;
	/** Print of the card; echoes share their donor's print. */
	readonly printKey: string;
	readonly print?: HTMLCanvasElement;
	/** Late lookup: a print that finishes after the finale starts replaces the stand-in sheet. */
	readonly resolvePrint?: () => HTMLCanvasElement | undefined;
	/** Landing order for tiles (hero = 0), used for the DOM hand-off. */
	readonly tileOrder?: number;
}

interface FinaleCardSpaceGlProps {
	readonly cards: readonly FinaleGlCard[];
	/** Done column scroll viewport (DOM px) that clips resting cards. */
	readonly clip: FinaleRect;
	/** What the camera frames for the long zoom (the hero card's rect). */
	readonly subject: FinaleRect;
	readonly viewport: FinaleViewport;
	/** Bento tile corner radius in viewport px. */
	readonly tileRadius: number;
}

interface GlState {
	readonly renderer: THREE.WebGLRenderer;
	readonly scene: THREE.Scene;
	readonly camera: THREE.PerspectiveCamera;
	readonly sheets: readonly {
		mesh: SheetMesh;
		/** Landing tiles cast a drop shadow on the slide. */
		shadow: SheetMesh | null;
		printKey: string;
		cardAspect: number;
	}[];
	/** Prints still showing a stand-in, and how to fetch the real one. */
	readonly pending: Map<string, { texture: THREE.CanvasTexture; resolve: () => HTMLCanvasElement | undefined }>;
	readonly target: THREE.WebGLRenderTarget;
	readonly post: { scene: THREE.Scene; camera: THREE.OrthographicCamera; material: THREE.ShaderMaterial };
}

/**
 * The finale's 3D layer: every Done card as a sheet of printed paper in one
 * WebGL scene, plus the spectral dispersion pass. Rendered from the finale
 * clock (not its own loop) so every frame is deterministic and scrubbable.
 */
export function FinaleCardSpaceGl({ cards, clip, subject, viewport, tileRadius }: Readonly<FinaleCardSpaceGlProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const stateRef = useRef<GlState | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;
		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
		} catch {
			return undefined;
		}
		renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
		const ratio = finaleFieldPixelRatio(viewport.width, viewport.height, window.devicePixelRatio);
		renderer.setPixelRatio(ratio);
		renderer.setSize(viewport.width, viewport.height, false);
		renderer.setClearColor(0x000000, 0);
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(FINALE_CAMERA_FOV, viewport.width / viewport.height, 10, 20000);
		camera.position.set(0, 0, cameraDistance(viewport));
		camera.lookAt(0, 0, 0);
		const geometry = new THREE.PlaneGeometry(1, 1, 48, 32);
		const shadowGeometry = new THREE.PlaneGeometry(1, 1);
		const tileColor = rgbUnit(FINALE_COLORS.tile);
		const fogColor = rgbUnit(FINALE_COLORS.slide);
		const textures = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>();
		const pending: GlState["pending"] = new Map();
		const lateResolvers = latePrintResolvers(cards);
		const sheets = cards.map((card) => {
			let entry = textures.get(card.printKey);
			if (!entry) {
				const source = card.print ?? fallbackPrint(card.input.rect.width, card.input.rect.height, 8);
				entry = { texture: textureFrom(source), aspect: source.width / source.height };
				textures.set(card.printKey, entry);
				const resolve = card.print ? undefined : lateResolvers.get(card.printKey);
				if (resolve) pending.set(card.printKey, { texture: entry.texture, resolve });
			}
			const material = createSheetMaterial({
				texture: entry.texture,
				radius: tileRadius,
				tileColor,
				fogColor,
				viewport,
				pixelRatio: ratio,
				clipRect: new THREE.Vector4(clip.x, clip.y, clip.x + clip.width, clip.y + clip.height),
				clipUv: new THREE.Vector4(...restClipUv(card.input.rect, clip)),
			});
			const mesh = new THREE.Mesh(geometry, material);
			scene.add(mesh);
			let shadow: SheetMesh | null = null;
			if (card.tileOrder !== undefined) {
				shadow = new THREE.Mesh(shadowGeometry, createShadowMaterial(tileRadius));
				shadow.visible = false;
				scene.add(shadow);
			}
			return { mesh, shadow, printKey: card.printKey, cardAspect: entry.aspect };
		});

		const target = new THREE.WebGLRenderTarget(Math.round(viewport.width * ratio), Math.round(viewport.height * ratio), { samples: 4 });
		const postMaterial = createLensMaterial({ scene: target.texture, aspect: viewport.width / viewport.height, background: fogColor });
		const postGeometry = new THREE.PlaneGeometry(2, 2);
		const postScene = new THREE.Scene();
		postScene.add(new THREE.Mesh(postGeometry, postMaterial));
		const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

		// Nothing draws until the toss, so without this the toss itself paid for
		// every program link, print upload and the multisampled post target (a
		// ~200ms first-run stall mid-burst). The finale mounts well before the
		// toss, so do that work now, off the burst: both render targets' program
		// variants, every print, and the post target.
		for (const { shadow } of sheets) if (shadow) shadow.visible = true;
		renderer.compile(scene, camera);
		renderer.setRenderTarget(target);
		renderer.compile(scene, camera);
		renderer.setRenderTarget(null);
		renderer.compile(postScene, postCamera);
		for (const { texture } of textures.values()) renderer.initTexture(texture);
		renderer.initRenderTarget(target);
		// Then draw once through both of the toss's paths (the post target, and
		// straight to the canvas): ANGLE builds a program's GPU pipeline only at
		// its first draw into a target, and three checks each program on first
		// use with a blocking GPU round trip, which otherwise cost the toss two
		// frames. The sheets sit at the origin, in view; the canvas is cleared
		// before this task presents anything.
		renderer.setRenderTarget(target);
		renderer.render(scene, camera);
		renderer.setRenderTarget(null);
		renderer.render(postScene, postCamera);
		renderer.render(scene, camera);
		renderer.clear();
		for (const { shadow } of sheets) if (shadow) shadow.visible = false;

		stateRef.current = { renderer, scene, camera, sheets, pending, target, post: { scene: postScene, camera: postCamera, material: postMaterial } };
		return () => {
			stateRef.current = null;
			for (const { mesh, shadow } of sheets) {
				shadow?.material.dispose();
				mesh.material.uniforms.uCard.value.dispose();
				mesh.material.dispose();
			}
			for (const { texture } of textures.values()) texture.dispose();
			geometry.dispose();
			shadowGeometry.dispose();
			postGeometry.dispose();
			postMaterial.dispose();
			target.dispose();
			renderer.dispose();
		};
	}, [cards, clip, tileRadius, viewport]);

	useFinaleFrame((time) => {
		const state = stateRef.current;
		if (!state) return;
		// A card printed after the finale started swaps its stand-in for the real print.
		for (const [printKey, entry] of state.pending) {
			const print = entry.resolve();
			if (!print) continue;
			const texture = textureFrom(print);
			for (const sheet of state.sheets) {
				if (sheet.printKey !== printKey) continue;
				sheet.mesh.material.uniforms.uCard.value = texture;
				sheet.cardAspect = print.width / print.height;
			}
			entry.texture.dispose();
			state.pending.delete(printKey);
		}
		// Until the toss the live DOM cards are what shows: prints rasterise text a
		// hair differently on real displays, so the sheets take over only at the
		// hand-off, as they start to move (the board's own cards leave then too).
		// Every sheet has handed over to its DOM tile by the curtain call; the wall needs no GL.
		if (!finaleCardSheetsShown(time) || wallActive(time)) {
			if (canvasRef.current && canvasRef.current.style.visibility !== "hidden") canvasRef.current.style.visibility = "hidden";
			return;
		}
		// Film the world through the shot's camera.
		const rig = finaleCameraRig(time, viewport, subject);
		const basis = cameraBasis(rig);
		state.camera.position.set(rig.position.x, rig.position.y, rig.position.z);
		state.camera.up.set(0, 1, 0);
		state.camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
		state.camera.rotateZ(rig.roll);
		let anyVisible = false;
		cards.forEach((card, index) => {
			const sheet = state.sheets[index];
			if (!sheet) return;
			const pose = cardPose(time, card.input, viewport);
			const world = poseToWorld(pose, viewport);
			const depth = toView(world, rig, basis).z;
			const handoff = card.tileOrder === undefined ? 0 : tileHandoff(time, card.tileOrder);
			const opacity = pose.opacity * (1 - handoff) * lensFade(depth, viewport);
			const { mesh } = sheet;
			mesh.visible = opacity > 0.002;
			if (sheet.shadow) sheet.shadow.visible = false;
			if (!mesh.visible) return;
			anyVisible = true;
			poseSheet(mesh, pose, world, sheet.cardAspect);
			// Far to near from the lens; the tie-break keeps overlapping sheets stable.
			mesh.renderOrder = -Math.round(depth) * 64 + index;
			if (sheet.shadow) sheet.shadow.renderOrder = mesh.renderOrder - 32;
			const uniforms = mesh.material.uniforms;
			uniforms.uFog.value = fogAtDepth(depth, viewport);
			uniforms.uOpacity.value = opacity;
			uniforms.uClip.value = pose.clip;
			uniforms.uTime.value = time;
			setLandingWave(uniforms, pose);
			if (sheet.shadow) {
				// The tiles land on the slide; the hero lands while the camera returns, so its
				// ground is a plane square to the lens just behind it that becomes the slide.
				const order = card.tileOrder ?? 0;
				const ground = order === 0 ? heroShadowGround(world, basis, depth, pose.lift) : slideShadowGround(viewport);
				placeShadow(sheet.shadow, landingShadow(time, order, pose, viewport, ground, tileRadius), ground, opacity);
			}
			// Motion as the camera sees it, into the sheet's own frame, saturating softly.
			const velocity = cardVelocity(time, card.input, viewport, subject);
			setCloth(uniforms.uCloth.value, velocity, velocity.weight, mesh.rotation);
		});
		const strength = chromaStrength(time, viewport, subject);
		const warp = sphereWarp(time);
		if ((strength > 0.001 || warp > 0.001) && anyVisible) {
			state.post.material.uniforms.uStrength.value = strength;
			state.post.material.uniforms.uWarp.value = warp;
			state.post.material.uniforms.uTime.value = time;
			state.renderer.setRenderTarget(state.target);
			state.renderer.render(state.scene, state.camera);
			state.renderer.setRenderTarget(null);
			state.renderer.render(state.post.scene, state.post.camera);
		} else {
			state.renderer.render(state.scene, state.camera);
		}
		if (canvasRef.current) canvasRef.current.style.visibility = anyVisible ? "visible" : "hidden";
	});

	return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}
