"use client";

import { useEffect, useRef } from "react";

import type { FinaleRect } from "../data/finale-stories";
import type { FinaleViewport } from "../lib/finale-card-motion";
import { TILE_GLOW_FRAGMENT, TILE_GLOW_VERTEX, tileGlowDraws, tileGlowUniforms } from "../lib/finale-tile-glow";
import { useFinaleFrame } from "./finale-frame";

interface GlowGl {
	readonly canvas: HTMLCanvasElement;
	readonly gl: WebGLRenderingContext;
	readonly ratio: number;
	readonly uniforms: Record<"quad" | "viewport" | "rect" | "radius" | "length" | "spotA" | "spotB" | "spotC" | "spotD" | "look" | "look2" | "look3" | "look4" | "envelope" | "time" | "scale", WebGLUniformLocation | null>;
	drawn: boolean;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
	console.error(gl.getShaderInfoLog(shader));
	gl.deleteShader(shader);
	return null;
}

function createGlowGl(canvas: HTMLCanvasElement, ratio: number): GlowGl | null {
	const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
	if (!gl) return null;
	const vertex = compile(gl, gl.VERTEX_SHADER, TILE_GLOW_VERTEX);
	const fragment = compile(gl, gl.FRAGMENT_SHADER, TILE_GLOW_FRAGMENT);
	const program = gl.createProgram();
	if (!vertex || !fragment || !program) return null;
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
	gl.useProgram(program);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
	const corner = gl.getAttribLocation(program, "aCorner");
	gl.enableVertexAttribArray(corner);
	gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	gl.clearColor(0, 0, 0, 0);
	const at = (name: string) => gl.getUniformLocation(program, name);
	return {
		canvas,
		gl,
		ratio,
		uniforms: {
			quad: at("uQuad"),
			viewport: at("uViewport"),
			rect: at("uRect"),
			radius: at("uRadius"),
			length: at("uLength"),
			spotA: at("uSpotA"),
			spotB: at("uSpotB"),
			spotC: at("uSpotC"),
			spotD: at("uSpotD"),
			look: at("uLook"),
			look2: at("uLook2"),
			look3: at("uLook3"),
			look4: at("uLook4"),
			envelope: at("uEnvelope"),
			time: at("uTime"),
			scale: at("uScale"),
		},
		drawn: false,
	};
}

interface FinaleTileGlowProps {
	/** Bento slots in landing order (viewport px). */
	readonly tiles: readonly FinaleRect[];
	/** Tile corner radius in viewport px. */
	readonly radius: number;
	/** Stage-to-viewport scale. */
	readonly scale: number;
	readonly viewport: FinaleViewport;
}

/**
 * One shared WebGL layer, above the DOM tiles, that lights each tile's whole
 * border once as it settles — Paper's Pulsing Border, alive for that moment:
 * orbiting spots, flowing smoke, a heartbeat, each tile with its own seeded
 * spots, speeds, colours, bloom and tone (see `lib/finale-tile-glow`). It
 * draws one quad per glowing tile, and nothing — hidden — when none is.
 */
export function FinaleTileGlow({ tiles, radius, scale, viewport }: Readonly<FinaleTileGlowProps>) {
	const hostRef = useRef<HTMLDivElement>(null);
	const glRef = useRef<GlowGl | null>(null);
	const lastTimeRef = useRef<number | null>(null);

	const render = (time: number) => {
		const state = glRef.current;
		if (!state) return;
		const { gl, canvas, uniforms } = state;
		const draws = tileGlowDraws(time, tiles, radius, scale);
		const visibility = draws.length > 0 ? "visible" : "hidden";
		if (canvas.style.visibility !== visibility) canvas.style.visibility = visibility;
		if (draws.length === 0 && !state.drawn) return;
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.COLOR_BUFFER_BIT);
		state.drawn = draws.length > 0;
		gl.uniform2f(uniforms.viewport, viewport.width, viewport.height);
		gl.uniform1f(uniforms.scale, scale);
		// Paper's shader time is the finale clock, so the motion scrubs.
		gl.uniform1f(uniforms.time, time);
		for (const draw of draws) {
			const { quad, shape } = draw;
			gl.uniform4f(uniforms.quad, quad.x, quad.y, quad.width, quad.height);
			gl.uniform4f(uniforms.rect, shape.rect.x, shape.rect.y, shape.rect.width, shape.rect.height);
			gl.uniform1f(uniforms.radius, shape.radius);
			gl.uniform1f(uniforms.length, shape.length);
			const look = tileGlowUniforms(draw.look, scale);
			gl.uniform4fv(uniforms.spotA, look.spotA);
			gl.uniform4fv(uniforms.spotB, look.spotB);
			gl.uniform4fv(uniforms.spotC, look.spotC);
			gl.uniform4fv(uniforms.spotD, look.spotD);
			gl.uniform4f(uniforms.look, ...look.look);
			gl.uniform4f(uniforms.look2, ...look.look2);
			gl.uniform4f(uniforms.look3, ...look.look3);
			gl.uniform4f(uniforms.look4, ...look.look4);
			gl.uniform1f(uniforms.envelope, draw.level.envelope);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
	};

	useFinaleFrame((time) => {
		lastTimeRef.current = time;
		render(time);
	});

	// The canvas is created here (not in JSX) so a remount always gets a fresh
	// context, and its context is released at once on unmount.
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return undefined;
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		const canvas = document.createElement("canvas");
		canvas.width = Math.round(viewport.width * ratio);
		canvas.height = Math.round(viewport.height * ratio);
		Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", visibility: "hidden" });
		host.append(canvas);
		const state = createGlowGl(canvas, ratio);
		glRef.current = state;
		return () => {
			glRef.current = null;
			state?.gl.getExtension("WEBGL_lose_context")?.loseContext();
			canvas.remove();
		};
	}, [viewport.height, viewport.width]);

	// A held clock never ticks again: paint the frame it is holding.
	useEffect(() => {
		if (lastTimeRef.current !== null) render(lastTimeRef.current);
	});

	return <div ref={hostRef} aria-hidden className="pointer-events-none absolute inset-0" />;
}
