"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { FLASH_BLUR_LEVELS, FLASH_GLSL, FLASH_MAX_OCCLUDERS, FLASH_PASS_GLSL, flashPrintRect, flashRingUniforms, flashUniforms, flashVisible, type FlashColumn, type FlashOccluder } from "@/components/projects/jira-team-eu26-end/finale/lib/finale-column-flash";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { parseRgb } from "../lib/finale-math";

const vertexShader = /* glsl */ `
uniform vec4 uCanvasRect;
varying vec2 vPx;

void main() {
	// uv is y-up; viewport px are y-down.
	vPx = vec2(uCanvasRect.x + uv.x * uCanvasRect.z, uCanvasRect.y + (1.0 - uv.y) * uCanvasRect.w);
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
${FLASH_GLSL}
${FLASH_PASS_GLSL}
varying vec2 vPx;

float flashDither(vec2 fragCoord) {
	float a = fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453);
	float b = fract(sin(dot(fragCoord, vec2(39.3468, 11.1353))) * 24634.6345);
	return (a + b - 1.0) / 255.0;
}

void main() {
	vec4 colour = flashPass(vPx);
	// Dither only where the pass draws, so the canvas never touches what it leaves alone.
	float lit = step(0.004, colour.a);
	float alpha = clamp(colour.a + flashDither(gl_FragCoord.xy + 0.5) * lit * 0.5, 0.0, 1.0);
	gl_FragColor = vec4(clamp(colour.rgb + flashDither(gl_FragCoord.yx) * lit, vec3(0.0), vec3(alpha)), alpha);
}
`;

interface FinaleColumnFlashProps {
	/** The Done column at frame 0 (`snapshot.column`), viewport px. */
	readonly column: FlashColumn;
	/** The column printed at the hand-off: header, surface and the cards it shows. */
	readonly print: HTMLCanvasElement | undefined;
	/** Floating chrome over the column (the Rovo FAB): the pass leaves it on top. */
	readonly occluders?: readonly FlashOccluder[];
}

const NO_OCCLUDERS: readonly FlashOccluder[] = [];

function printTexture(print: HTMLCanvasElement): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(print);
	// Raw sRGB bytes in and out: the resting print matches the live DOM.
	texture.colorSpace = THREE.NoColorSpace;
	texture.premultiplyAlpha = true;
	texture.generateMipmaps = false;
	texture.minFilter = THREE.LinearFilter;
	return texture;
}

/** Three bounded Gaussian levels, owned by this snapshot and disposed with its renderer. */
function softPrintTexture(print: HTMLCanvasElement, radius: number, cssWidth: number): THREE.CanvasTexture {
	const soft = document.createElement("canvas");
	soft.width = print.width;
	soft.height = print.height;
	const context = soft.getContext("2d");
	if (!context) return printTexture(print);
	context.filter = `blur(${radius * print.width / cssWidth}px)`;
	context.drawImage(print, 0, 0);
	return printTexture(soft);
}

interface FlashGl {
	readonly renderer: THREE.WebGLRenderer;
	readonly scene: THREE.Scene;
	readonly camera: THREE.OrthographicCamera;
	readonly material: THREE.ShaderMaterial;
}

/**
 * The flash as one full-column pass over the column print, above the resting
 * card sheets: refraction, band blur, glare, the dark lens, highlight halos
 * and coloured edge light, all from one field (`lib/finale-column-flash.ts`).
 * The silhouette can bend by a few pixels; grading remains on the refracted
 * column and only a faint narrow bloom carries past it. Sampling padding is
 * plain backdrop, so no neighbouring column/header can enter the wave. It
 * draws only where the field is active and is transparent elsewhere, so the
 * live board and the GL sheets beneath show through untouched; it is hidden
 * outside its window and gone from the toss.
 */
export function FinaleColumnFlash({ column, print, occluders = NO_OCCLUDERS }: Readonly<FinaleColumnFlashProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const glRef = useRef<FlashGl | null>(null);
	const visibleRef = useRef(false);
	// The column plus room for the light's soft falloff past it, snapped to whole px so the canvas composites without resampling.
	const rect = useMemo(() => flashPrintRect(column), [column]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !print) return undefined;
		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true });
		} catch {
			return undefined;
		}
		renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(rect.width, rect.height, false);
		renderer.setClearColor(0x000000, 0);
		const texture = printTexture(print);
		const backdrop = parseRgb(print.dataset.finaleBackdrop ?? "rgb(255, 255, 255)");
		const [soft, blur, bloom] = FLASH_BLUR_LEVELS.map((radius) => softPrintTexture(print, radius, rect.width));
		const material = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader,
			blending: THREE.NoBlending,
			depthTest: false,
			depthWrite: false,
			uniforms: {
				uPrint: { value: texture },
				uBackdrop: { value: new THREE.Vector3(...backdrop.map((channel) => channel / 255)) },
				uPrintRect: { value: new THREE.Vector4(rect.x, rect.y, rect.width, rect.height) },
				uPrintSoft: { value: soft },
				uPrintBlur: { value: blur },
				uPrintBloom: { value: bloom },
				uCanvasRect: { value: new THREE.Vector4(rect.x, rect.y, rect.width, rect.height) },
				uFlashColumn: { value: new THREE.Vector4(column.x, column.y, column.width, column.height) },
				uFlashState: { value: new THREE.Vector3(0, 0, 0) },
				uFlashRing: { value: new THREE.Vector3(0, 0, 0) },
				uOccluders: { value: Array.from({ length: FLASH_MAX_OCCLUDERS }, (_, index) => {
					const occluder = occluders[index];
					return occluder ? new THREE.Vector4(occluder.x, occluder.y, occluder.width, occluder.height) : new THREE.Vector4(0, 0, 0, 0);
				}) },
				uOccluderRadii: { value: new THREE.Vector4(occluders[0]?.radius ?? 0, occluders[1]?.radius ?? 0, occluders[2]?.radius ?? 0, occluders[3]?.radius ?? 0) },
				uOccluderCount: { value: Math.min(occluders.length, FLASH_MAX_OCCLUDERS) },
			},
		});
		const geometry = new THREE.PlaneGeometry(2, 2);
		const scene = new THREE.Scene();
		scene.add(new THREE.Mesh(geometry, material));
		const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		glRef.current = { renderer, scene, camera, material };
		// Compile/upload on a transparent, hidden frame before the finale clock
		// starts; the first visible frame then begins at the foot, without a jump.
		renderer.render(scene, camera);
		return () => {
			glRef.current = null;
			geometry.dispose();
			material.dispose();
			texture.dispose();
			soft.dispose();
			blur.dispose();
			bloom.dispose();
			renderer.dispose();
		};
	}, [column, occluders, print, rect]);

	useFinaleFrame((time) => {
		const canvas = canvasRef.current;
		const gl = glRef.current;
		const visible = flashVisible(time) && gl !== null;
		if (canvas && visible !== visibleRef.current) {
			canvas.style.visibility = visible ? "visible" : "hidden";
			visibleRef.current = visible;
		}
		if (!visible || !gl) return;
		gl.material.uniforms.uFlashState.value.set(...flashUniforms(time, column).state);
		gl.material.uniforms.uFlashRing.value.set(...flashRingUniforms(time, column));
		gl.renderer.render(gl.scene, gl.camera);
	});

	return (
		<canvas
			ref={canvasRef}
			aria-hidden
			className="pointer-events-none absolute"
			style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, visibility: "hidden" }}
			data-finale-column-flash=""
		/>
	);
}
