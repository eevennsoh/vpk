"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { clamp } from "@/lib/math";

export interface RippleProps {
	imageSrc?: string;
	radius?: number;
	fade?: number;
	softness?: number;
	strength?: number;
	decay?: number;
	displace?: number;
	dispersion?: number;
	click?: boolean;
	speed?: number;
	className?: string;
	style?: CSSProperties;
}

export const DEFAULT_RIPPLE_IMAGE_SRC = "/ambient/ado/combo/primary/blue.svg";

const CLICK_SLOTS = 9;
const SPRING_STIFFNESS = 58;
const SPRING_DAMPING = 15;
const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
	v_uv = a_position * 0.5 + 0.5;
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const RIPPLE_TRAIL_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_rippleTrail_buffer;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_deltaTime;
uniform vec4 u_mousePosition;
uniform float u_mousePointerDown;
uniform float u_mouseHover;
uniform float u_trailRadius;
uniform float u_centerFade;
uniform float u_trailSoftness;
uniform float u_trailStrength;
uniform float u_trailDecay;

void main() {
	vec2 uv = v_uv;
	vec2 res = u_resolution.xy / u_pixelRatio;

	// Aspect/scale-independent reference length
	float ref = sqrt(res.x * res.y);

	// Fixed simulation grid with constant cell count, square cells in screen space
	const float simDetail = 800.;
	vec2 simRes = res / ref * simDetail;
	vec2 px = 1.0 / simRes;

	vec4 prevData = texture(u_rippleTrail_buffer, uv);
	float current = prevData.r;
	float previous = prevData.g;

	float left  = texture(u_rippleTrail_buffer, uv - vec2(px.x, 0.0)).r;
	float right = texture(u_rippleTrail_buffer, uv + vec2(px.x, 0.0)).r;
	float down  = texture(u_rippleTrail_buffer, uv - vec2(0.0, px.y)).r;
	float up    = texture(u_rippleTrail_buffer, uv + vec2(0.0, px.y)).r;

	float neighborAverage = (left + right + down + up) * 0.25;
	float r = u_deltaTime * 60.0;
	float decay = pow(mix(0.95, 0.99, u_trailDecay), r);
	float next = (neighborAverage * 2.0 - previous) * decay;

	// Distance measured in reference units
	vec2 p     = uv * res / ref;
	vec2 mouse = u_mousePosition.xy * res / ref;
	float dist = distance(p, mouse);

	// --- drag stamp (shows while pressing + moving) ---
	float stamp = 1.0 - smoothstep(u_trailRadius * (1.0 - u_trailSoftness), u_trailRadius, dist);
	float centerFade = smoothstep(0.0, u_centerFade * 0.2, dist);

	float speed = length(u_mousePosition.zw);
	float speedAmount = clamp(speed * u_trailStrength, 0.0, 1.0);
	float pressAmount = 1.0 + u_mousePointerDown * 1.5;

	next += stamp * centerFade * u_mouseHover * speedAmount * pressAmount * min(r, 3.0); //*r for fps normalization

	fragColor = vec4(next, current, 0.0, 1.0);
}
`;

export const CLICK_STATE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_clickState_buffer;
uniform float u_deltaTime;
uniform vec4 u_mousePosition;
uniform float u_mousePointerDown;
uniform float u_trailDecay;

const int SLOTS = 9; // band 0 reserved + 8 ripples, keep in sync with main pass

vec4 readSlot(int i) {
	return texture(u_clickState_buffer, vec2((float(i) + 0.5) / float(SLOTS), 0.5));
}

// Ripple lifetime derived from the shared Decay prop.
float clickLifetime() {
	float f = mix(0.9, 0.95, u_trailDecay);
	return -3.0 / (log(f) / log(10.0)) / 60.0;
}

void main() {
	int s = int(clamp(floor(v_uv.x * float(SLOTS)), 0.0, float(SLOTS - 1)));

	float life = clickLifetime();

	// u_mousePointerDown is an EASED Motion spring value, not a hard 0/1.
	// Detect the leading edge of the rise instead.
	float down = u_mousePointerDown;

	// Band 0 holds last frame's state:
	//   .r = previous eased value   .g = was-rising flag   .b = seconds since last spawn
	vec4  g         = readSlot(0);
	float prevDown  = g.r;
	float wasRising = g.g;
	float cooldown  = g.b;
	if (all(equal(g, vec4(0.0)))) cooldown = 100.0; // fresh buffer: allow the first spawn

	float delta    = down - prevDown;
	bool  rising    = (delta > 0.003);                  // real upward impulse, tunable
	bool  spawnNow  = rising && (wasRising < 0.5)       // just started rising = a new press
	                  && (cooldown > 0.05);             // debounce spring ringing / double-fire

	if (s == 0) {
		// Carry the eased value + trend forward, and reset the spawn cooldown.
		float nextCooldown = spawnNow ? 0.0 : min(cooldown + u_deltaTime, 100.0);
		fragColor = vec4(down, rising ? 1.0 : 0.0, nextCooldown, 0.0);
		return;
	}

	// --- ripple bands ---
	vec4 next = readSlot(s);
	if (all(equal(next, vec4(0.0)))) next = vec4(0.0, 0.0, -1.0, 0.0); // first-touch init

	// Age + expire.
	if (next.b >= 0.0) {
		float a = next.b + u_deltaTime;
		next.b = (a > life) ? -1.0 : a;
	}

	// Pick target ripple slot: free first, else oldest active.
	int   target = 1;
	float best   = -1e9;
	for (int i = 1; i < SLOTS; i++) {
		float age   = readSlot(i).b;
		float score = (age < 0.0) ? 1e6 : age;
		if (score > best) { best = score; target = i; }
	}

	// Spawn at the live cursor on the leading edge of a press.
	// u_mousePosition.xy (not g.rg) because band 0 only commits the new
	// origin this frame, while every band reads last frame's buffer.
	if (spawnNow && s == target) {
		next.rg = u_mousePosition.xy;
		next.b  = 0.0;
	}

	fragColor = next;
}
`;

const FINAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform sampler2D u_rippleTrail_buffer;
uniform sampler2D u_clickState_buffer;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_trailRadius;
uniform float u_trailDecay;
uniform float u_trailDisplacement;
uniform float u_trailStrength;
uniform float u_dispersion;
uniform float u_clickRipple;
uniform float u_clickSpeed;

const int SLOTS = 9; // keep in sync with clickState

vec2 coverFit(vec2 uv) {
	vec2 flipped = vec2(uv.x, 1.0 - uv.y);
	vec2 texRes = vec2(textureSize(u_texture, 0));
	vec2 ratio = u_resolution.xy / texRes;
	float maxRatio = max(ratio.x, ratio.y);
	return (flipped - 0.5) * (ratio / maxRatio) + 0.5;
}

// Ripple lifetime derived from the shared Decay prop.
// Must match clickState's clickLifetime() exactly.
float clickLifetime() {
	float f = mix(0.9, 0.95, u_trailDecay);
	return -3.0 / (log(f) / log(10.0)) / 60.0;
}

// Analytic expanding ring for one ripple
vec2 clickRingOffset(vec2 uv, vec2 res, float ref, vec2 originUV, float age) {
	vec2 p      = uv * res / ref;
	vec2 origin = originUV * res / ref;
	vec2 d      = p - origin;
	float dist  = length(d);
	if (dist < 1e-5) return vec2(0.0);
	vec2 dir    = d / dist;

	float life = clickLifetime();

	// Normalized progress
	float t = clamp(u_clickSpeed * age / life, 0.0, 1.0);

	float reach = u_trailRadius * 3.0;
	float front = reach * t;
	float k    = 6.2831853 / max(0.25 * reach, 1e-4); // wavelength
	float band = max(0.25 * reach, 1e-3);              // bandwidth

	float x        = dist - front;
	float envelope = exp(-(x * x) / (band * band));
	float fade     = 1.0 - smoothstep(life * 0.6, life, age);
	float wave     = cos(k * x) * envelope * fade;

	vec2 dirUV = normalize(dir * ref / res);
	return dirUV * wave * u_trailStrength * 0.02;
}

void main() {
	vec2 uv = v_uv;
	vec2 res = u_resolution.xy / u_pixelRatio;
	float ref = sqrt(res.x * res.y);

	// Must match the buffer pass.
	const float simDetail = 800.0;
	vec2 simRes = res / ref * simDetail;
	vec2 px = 1.0 / simRes;

	float hL = texture(u_rippleTrail_buffer, uv - vec2(px.x, 0.0)).r;
	float hR = texture(u_rippleTrail_buffer, uv + vec2(px.x, 0.0)).r;
	float hD = texture(u_rippleTrail_buffer, uv - vec2(0.0, px.y)).r;
	float hU = texture(u_rippleTrail_buffer, uv + vec2(0.0, px.y)).r;

	// Drag trail: gradient of the simulated height field.
	vec2 grad = vec2(hL - hR, hD - hU);
	vec2 dragOffset = grad * u_trailDisplacement * ref / res;

	// Click ripples: sum every active analytic ring (bands 1..SLOTS-1).
	vec2 clickOffset = vec2(0.0);
	if (u_clickRipple > 0.5) {
		float life = clickLifetime();
		for (int i = 1; i < SLOTS; i++) {
			vec4 slot = texture(u_clickState_buffer, vec2((float(i) + 0.5) / float(SLOTS), 0.5));
			float age = slot.b;
			if (age < 0.0 || age > life) continue;
			clickOffset += clickRingOffset(uv, res, ref, slot.rg, age);
		}
	}

	vec2 baseOffset = dragOffset + clickOffset;

	vec2 offsetR = baseOffset * (1.0 - u_dispersion * 0.5);
	vec2 offsetG = baseOffset;
	vec2 offsetB = baseOffset * (1.0 + u_dispersion * 0.5);

	float r = texture(u_texture, coverFit(uv + offsetR)).r;
	float g = texture(u_texture, coverFit(uv + offsetG)).g;
	float b = texture(u_texture, coverFit(uv + offsetB)).b;

	fragColor = vec4(r, g, b, 1.0);
}
`;

type PointerState = {
	x: number;
	y: number;
	vx: number;
	vy: number;
};

type SpringState = {
	value: number;
	velocity: number;
	target: number;
};

type ClickRipple = {
	x: number;
	y: number;
	age: number;
};

type RenderTarget = {
	texture: WebGLTexture;
	framebuffer: WebGLFramebuffer;
	width: number;
	height: number;
};

type TargetPair = {
	read: RenderTarget;
	write: RenderTarget;
	width: number;
	height: number;
};

type ProgramInfo = {
	program: WebGLProgram;
	uniforms: Map<string, WebGLUniformLocation | null>;
};

function getClickLifetime(decay: number): number {
	const falloff = 0.9 + (0.95 - 0.9) * decay;
	return -3 / (Math.log(falloff) / Math.log(10)) / 60;
}

function createDefaultTexture(): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = 1024;
	canvas.height = 1024;
	const context = canvas.getContext("2d");
	if (!context) return canvas;

	const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
	gradient.addColorStop(0, "#83E6FF");
	gradient.addColorStop(0.3, "#0A0A0B");
	gradient.addColorStop(0.62, "#0C66E4");
	gradient.addColorStop(1, "#FF7A90");
	context.fillStyle = gradient;
	context.fillRect(0, 0, canvas.width, canvas.height);

	context.fillStyle = "rgb(255 255 255 / 0.72)";
	context.beginPath();
	context.ellipse(512, 504, 190, 420, -0.18, 0, Math.PI * 2);
	context.fill();

	return canvas;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentSource: string, uniformNames: readonly string[]): ProgramInfo | null {
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	if (!fragmentShader) return null;

	const program = gl.createProgram();
	if (!program) {
		gl.deleteShader(fragmentShader);
		return null;
	}

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.deleteShader(fragmentShader);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
		return null;
	}

	return {
		program,
		uniforms: new Map(uniformNames.map((name) => [name, gl.getUniformLocation(program, name)])),
	};
}

function getUniform(program: ProgramInfo, name: string): WebGLUniformLocation | null {
	return program.uniforms.get(name) ?? null;
}

function createRenderTarget(gl: WebGL2RenderingContext, width: number, height: number, filter: number): RenderTarget | null {
	const texture = gl.createTexture();
	const framebuffer = gl.createFramebuffer();
	if (!texture || !framebuffer) return null;

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

	if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		gl.deleteFramebuffer(framebuffer);
		gl.deleteTexture(texture);
		return null;
	}

	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return { texture, framebuffer, width, height };
}

function createTargetPair(gl: WebGL2RenderingContext, width: number, height: number, filter: number): TargetPair | null {
	const read = createRenderTarget(gl, width, height, filter);
	const write = createRenderTarget(gl, width, height, filter);
	if (!read || !write) {
		if (read) deleteRenderTarget(gl, read);
		if (write) deleteRenderTarget(gl, write);
		return null;
	}
	return { read, write, width, height };
}

function deleteRenderTarget(gl: WebGL2RenderingContext, target: RenderTarget) {
	gl.deleteFramebuffer(target.framebuffer);
	gl.deleteTexture(target.texture);
}

function deleteTargetPair(gl: WebGL2RenderingContext, targetPair: TargetPair | null) {
	if (!targetPair) return;
	deleteRenderTarget(gl, targetPair.read);
	deleteRenderTarget(gl, targetPair.write);
}

function swapTargetPair(targetPair: TargetPair) {
	const previousRead = targetPair.read;
	targetPair.read = targetPair.write;
	targetPair.write = previousRead;
}

function updateSpring(state: SpringState, deltaSeconds: number, stiffness = SPRING_STIFFNESS, damping = SPRING_DAMPING) {
	state.velocity += (state.target - state.value) * stiffness * deltaSeconds;
	state.velocity *= Math.exp(-damping * deltaSeconds);
	state.value += state.velocity * deltaSeconds;
	state.value = clamp(state.value, 0, 1);
}

function updatePointerSpring(pointer: PointerState, target: PointerState, deltaSeconds: number) {
	pointer.vx += (target.x - pointer.x) * SPRING_STIFFNESS * deltaSeconds;
	pointer.vy += (target.y - pointer.y) * SPRING_STIFFNESS * deltaSeconds;
	pointer.vx *= Math.exp(-SPRING_DAMPING * deltaSeconds);
	pointer.vy *= Math.exp(-SPRING_DAMPING * deltaSeconds);
	pointer.x += pointer.vx * deltaSeconds;
	pointer.y += pointer.vy * deltaSeconds;
}

function getCanvasPointer(canvas: HTMLCanvasElement, event: PointerEvent) {
	const rect = canvas.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return null;
	const insideCanvas = event.clientX >= rect.left
		&& event.clientX <= rect.right
		&& event.clientY >= rect.top
		&& event.clientY <= rect.bottom;
	if (!insideCanvas) return null;

	return {
		x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
		y: clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1),
	};
}

function setCommonUniforms(
	gl: WebGL2RenderingContext,
	program: ProgramInfo,
	width: number,
	height: number,
	pixelRatio: number,
	deltaSeconds: number,
	pointer: PointerState,
	pointerDown: number,
	hover: number,
	radius: number,
	fade: number,
	softness: number,
	strength: number,
	decay: number,
) {
	gl.uniform2f(getUniform(program, "u_resolution"), width, height);
	gl.uniform1f(getUniform(program, "u_pixelRatio"), pixelRatio);
	gl.uniform1f(getUniform(program, "u_deltaTime"), deltaSeconds);
	gl.uniform4f(getUniform(program, "u_mousePosition"), pointer.x, pointer.y, pointer.vx, pointer.vy);
	gl.uniform1f(getUniform(program, "u_mousePointerDown"), pointerDown);
	gl.uniform1f(getUniform(program, "u_mouseHover"), hover);
	gl.uniform1f(getUniform(program, "u_trailRadius"), radius);
	gl.uniform1f(getUniform(program, "u_centerFade"), fade);
	gl.uniform1f(getUniform(program, "u_trailSoftness"), softness);
	gl.uniform1f(getUniform(program, "u_trailStrength"), strength);
	gl.uniform1f(getUniform(program, "u_trailDecay"), decay);
}

export default function Ripple({
	imageSrc = DEFAULT_RIPPLE_IMAGE_SRC,
	radius = 0.1,
	fade = 0.25,
	softness = 0.5,
	strength = 0.5,
	decay = 0.5,
	displace = 0.03,
	dispersion = 0,
	click = true,
	speed = 1,
	className,
	style,
}: Readonly<RippleProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animationRef = useRef<number>(0);
	const pointerTargetRef = useRef<PointerState>({ x: 0.5, y: 0.5, vx: 0, vy: 0 });
	const pointerRef = useRef<PointerState>({ x: 0.5, y: 0.5, vx: 0, vy: 0 });
	const hoverRef = useRef<SpringState>({ value: 0, velocity: 0, target: 0 });
	const pointerDownRef = useRef<SpringState>({ value: 0, velocity: 0, target: 0 });
	const pointerDownImpulseRef = useRef(0);
	const clickRipplesRef = useRef<ClickRipple[]>([]);
	const reducedMotion = useReducedMotion();
	const [inView, setInView] = useState(false);
	const [tabVisible, setTabVisible] = useState(
		typeof document === "undefined" ? true : document.visibilityState === "visible",
	);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const observer = new IntersectionObserver(
			([entry]) => setInView(entry.isIntersecting),
			{ rootMargin: "200px" },
		);
		observer.observe(canvas);

		const handleVisibilityChange = () => {
			setTabVisible(document.visibilityState === "visible");
		};
		const updatePointer = (event: PointerEvent) => {
			const nextPointer = getCanvasPointer(canvas, event);
			if (!nextPointer) {
				hoverRef.current.target = 0;
				return;
			}
			const target = pointerTargetRef.current;
			target.vx = nextPointer.x - target.x;
			target.vy = nextPointer.y - target.y;
			target.x = nextPointer.x;
			target.y = nextPointer.y;
			hoverRef.current.target = 1;
		};
		const handlePointerLeave = () => {
			hoverRef.current.target = 0;
			pointerDownRef.current.target = 0;
		};
		const handlePointerDown = (event: PointerEvent) => {
			updatePointer(event);
			pointerDownRef.current.value = Math.max(pointerDownRef.current.value, 0.08);
			pointerDownRef.current.velocity = Math.max(pointerDownRef.current.velocity, 1);
			pointerDownRef.current.target = 1;
			pointerDownImpulseRef.current = 1;
			clickRipplesRef.current.unshift({
				x: pointerTargetRef.current.x,
				y: pointerTargetRef.current.y,
				age: 0,
			});
			clickRipplesRef.current = clickRipplesRef.current.slice(0, CLICK_SLOTS - 1);
		};
		const handlePointerUp = () => {
			pointerDownRef.current.target = 0;
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		canvas.addEventListener("pointerenter", updatePointer);
		canvas.addEventListener("pointerleave", handlePointerLeave);
		canvas.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("pointermove", updatePointer, { passive: true });
		window.addEventListener("pointerup", handlePointerUp);
		window.addEventListener("pointercancel", handlePointerUp);

		return () => {
			observer.disconnect();
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			canvas.removeEventListener("pointerenter", updatePointer);
			canvas.removeEventListener("pointerleave", handlePointerLeave);
			canvas.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("pointermove", updatePointer);
			window.removeEventListener("pointerup", handlePointerUp);
			window.removeEventListener("pointercancel", handlePointerUp);
		};
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext("webgl2", {
			alpha: false,
			antialias: true,
			premultipliedAlpha: false,
		});
		if (!gl) return;

		const colorBufferFloat = gl.getExtension("EXT_color_buffer_float");
		if (!colorBufferFloat) return;

		const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
		if (!vertexShader) return;

		const sharedUniforms = [
			"u_resolution",
			"u_pixelRatio",
			"u_deltaTime",
			"u_mousePosition",
			"u_mousePointerDown",
			"u_mouseHover",
			"u_trailRadius",
			"u_centerFade",
			"u_trailSoftness",
			"u_trailStrength",
			"u_trailDecay",
		];
		const trailProgram = createProgram(gl, vertexShader, RIPPLE_TRAIL_FRAGMENT_SHADER, [
			"u_rippleTrail_buffer",
			...sharedUniforms,
		]);
		const finalProgram = createProgram(gl, vertexShader, FINAL_FRAGMENT_SHADER, [
			"u_texture",
			"u_rippleTrail_buffer",
			"u_clickState_buffer",
			"u_resolution",
			"u_pixelRatio",
			"u_trailRadius",
			"u_trailDecay",
			"u_trailDisplacement",
			"u_trailStrength",
			"u_dispersion",
			"u_clickRipple",
			"u_clickSpeed",
		]);
		gl.deleteShader(vertexShader);

		if (!trailProgram || !finalProgram) return;

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

		for (const programInfo of [trailProgram, finalProgram]) {
			gl.useProgram(programInfo.program);
			const positionLocation = gl.getAttribLocation(programInfo.program, "a_position");
			gl.enableVertexAttribArray(positionLocation);
			gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
		}

		const sourceTexture = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, createDefaultTexture());

		const clickStateTexture = gl.createTexture();
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, clickStateTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, CLICK_SLOTS, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(CLICK_SLOTS * 4));

		let imageCancelled = false;
		if (imageSrc) {
			const image = new Image();
			image.crossOrigin = "anonymous";
			image.onload = () => {
				if (imageCancelled) return;
				gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			};
			image.src = imageSrc;
		}

		let trailTargets: TargetPair | null = null;
		let lastFrame = performance.now();

		const ensureTargets = (width: number, height: number) => {
			if (!trailTargets || trailTargets.width !== width || trailTargets.height !== height) {
				deleteTargetPair(gl, trailTargets);
				trailTargets = createTargetPair(gl, width, height, gl.LINEAR);
			}
			return Boolean(trailTargets && clickStateTexture);
		};

		const drawFullScreen = () => {
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		};

		const render = (now: number) => {
			const rawDeltaSeconds = Math.min((now - lastFrame) / 1000, 0.05);
			lastFrame = now;
			const shouldAnimate = !reducedMotion && inView && tabVisible;
			const deltaSeconds = shouldAnimate ? rawDeltaSeconds : 0;
			const pixelRatio = window.devicePixelRatio || 1;
			const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
			const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));

			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
			}
			if (!ensureTargets(width, height) || !trailTargets || !clickStateTexture) {
				animationRef.current = requestAnimationFrame(render);
				return;
			}

			updatePointerSpring(pointerRef.current, pointerTargetRef.current, rawDeltaSeconds);
			updateSpring(hoverRef.current, rawDeltaSeconds);
			updateSpring(pointerDownRef.current, rawDeltaSeconds, 100, 18);
			pointerDownImpulseRef.current = Math.max(0, pointerDownImpulseRef.current - rawDeltaSeconds * 8);
			const clickLifetime = getClickLifetime(decay);
			for (const clickRipple of clickRipplesRef.current) {
				clickRipple.age += deltaSeconds;
			}
			clickRipplesRef.current = clickRipplesRef.current.filter((clickRipple) => clickRipple.age <= clickLifetime);

			const pointer = pointerRef.current;
			const pointerDown = Math.max(pointerDownRef.current.value, pointerDownImpulseRef.current);
			const hover = hoverRef.current.value;
			const clickStateData = new Float32Array(CLICK_SLOTS * 4);
			clickStateData[0] = pointerDown;
			clickStateData[2] = 100;
			for (let index = 1; index < CLICK_SLOTS; index++) {
				const clickRipple = clickRipplesRef.current[index - 1];
				const offset = index * 4;
				if (clickRipple) {
					clickStateData[offset] = clickRipple.x;
					clickStateData[offset + 1] = clickRipple.y;
					clickStateData[offset + 2] = clickRipple.age;
				} else {
					clickStateData[offset + 2] = -1;
				}
			}
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, clickStateTexture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, CLICK_SLOTS, 1, 0, gl.RGBA, gl.FLOAT, clickStateData);

			gl.disable(gl.BLEND);
			gl.disable(gl.DEPTH_TEST);

			gl.useProgram(trailProgram.program);
			gl.bindFramebuffer(gl.FRAMEBUFFER, trailTargets.write.framebuffer);
			gl.viewport(0, 0, trailTargets.write.width, trailTargets.write.height);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, trailTargets.read.texture);
			gl.uniform1i(getUniform(trailProgram, "u_rippleTrail_buffer"), 0);
			setCommonUniforms(
				gl,
				trailProgram,
				width,
				height,
				pixelRatio,
				deltaSeconds,
				pointer,
				pointerDown,
				hover,
				radius,
				fade,
				softness,
				strength,
				decay,
			);
			drawFullScreen();

			gl.useProgram(finalProgram.program);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, width, height);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
			gl.uniform1i(getUniform(finalProgram, "u_texture"), 0);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, trailTargets.write.texture);
			gl.uniform1i(getUniform(finalProgram, "u_rippleTrail_buffer"), 1);
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, clickStateTexture);
			gl.uniform1i(getUniform(finalProgram, "u_clickState_buffer"), 2);
			gl.uniform2f(getUniform(finalProgram, "u_resolution"), width, height);
			gl.uniform1f(getUniform(finalProgram, "u_pixelRatio"), pixelRatio);
			gl.uniform1f(getUniform(finalProgram, "u_trailRadius"), radius);
			gl.uniform1f(getUniform(finalProgram, "u_trailDecay"), decay);
			gl.uniform1f(getUniform(finalProgram, "u_trailDisplacement"), displace);
			gl.uniform1f(getUniform(finalProgram, "u_trailStrength"), strength);
			gl.uniform1f(getUniform(finalProgram, "u_dispersion"), dispersion);
			gl.uniform1f(getUniform(finalProgram, "u_clickRipple"), click ? 1 : 0);
			gl.uniform1f(getUniform(finalProgram, "u_clickSpeed"), speed);
			drawFullScreen();

			swapTargetPair(trailTargets);
			animationRef.current = requestAnimationFrame(render);
		};

		animationRef.current = requestAnimationFrame(render);

		return () => {
			imageCancelled = true;
			cancelAnimationFrame(animationRef.current);
			deleteTargetPair(gl, trailTargets);
			gl.deleteTexture(sourceTexture);
			gl.deleteTexture(clickStateTexture);
			gl.deleteBuffer(buffer);
			gl.deleteProgram(trailProgram.program);
			gl.deleteProgram(finalProgram.program);
		};
	}, [click, decay, displace, dispersion, fade, imageSrc, inView, radius, reducedMotion, softness, speed, strength, tabVisible]);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			className={cn("block h-full w-full touch-none", className)}
			style={style}
		/>
	);
}
