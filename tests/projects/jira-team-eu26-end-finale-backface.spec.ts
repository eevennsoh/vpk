import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Compile the production fragment shader: source inspection alone cannot prove
// winding, premultiplied alpha, or the pixels a backwards sheet actually draws.
const source = readFileSync("components/projects/jira-team-eu26-end/finale/components/finale-card-space-gl.tsx", "utf8");
const fragment = source.match(/const sheetFragmentShader = \/\* glsl \*\/ `([\s\S]*?)`;/)?.[1];
if (!fragment) throw new Error("Finale sheet fragment shader not found");

test("finale sheets keep their print on the front and blank white paper on the back", async ({ page }) => {
	const samples = await page.evaluate((fragmentShader) => {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 64;
		const gl = canvas.getContext("webgl", { premultipliedAlpha: true });
		if (!gl) throw new Error("WebGL is required to verify the finale shader");
		const compile = (type: number, code: string) => {
			const shader = gl.createShader(type)!;
			gl.shaderSource(shader, code);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile failed");
			return shader;
		};
		const vertex = compile(gl.VERTEX_SHADER, `
			attribute vec2 position;
			varying vec2 vUv;
			varying vec3 vNormal;
			varying vec3 vFlatNormal;
			void main() {
				vUv = position * 0.5 + 0.5;
				vNormal = vFlatNormal = vec3(0.0, 0.0, 1.0);
				gl_Position = vec4(position, 0.0, 1.0);
			}
		`);
		const shader = compile(gl.FRAGMENT_SHADER, fragmentShader);
		const program = gl.createProgram()!;
		gl.attachShader(program, vertex);
		gl.attachShader(program, shader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Shader link failed");
		gl.useProgram(program);
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
		const position = gl.getAttribLocation(program, "position");
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

		// A rounded, opaque print with different artwork on each half.
		const print = document.createElement("canvas");
		print.width = print.height = 64;
		const ink = print.getContext("2d")!;
		ink.beginPath();
		ink.roundRect(0, 0, 64, 64, 8);
		ink.clip();
		ink.fillStyle = "red";
		ink.fillRect(0, 0, 32, 64);
		ink.fillStyle = "blue";
		ink.fillRect(32, 0, 32, 64);
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, print);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		const uniform = (name: string) => gl.getUniformLocation(program, name);
		gl.uniform1i(uniform("uCard"), 0);
		gl.uniform2f(uniform("uCardFit"), 1, 1);
		gl.uniform2f(uniform("uSize"), 64, 64);
		gl.uniform1f(uniform("uRadius"), 8);
		gl.uniform3f(uniform("uTileColor"), 1, 1, 1);
		gl.uniform2f(uniform("uViewport"), 64, 64);
		gl.uniform1f(uniform("uPixelRatio"), 1);
		const pixel = (x: number, y: number) => {
			const rgba = new Uint8Array(4);
			gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
			return Array.from(rgba);
		};
		const result = [0, 0.5, 1].flatMap(face => [false, true].flatMap(back => [1, 0.5].map(opacity => {
			gl.frontFace(back ? gl.CW : gl.CCW);
			gl.uniform1f(uniform("uFace"), face);
			gl.uniform1f(uniform("uOpacity"), opacity);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
			return { face, back, opacity, left: pixel(16, 32), right: pixel(48, 32), corner: pixel(0, 0) };
		})));
		gl.deleteTexture(texture);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		gl.deleteShader(vertex);
		gl.deleteShader(shader);
		gl.getExtension("WEBGL_lose_context")?.loseContext();
		return result;
	}, fragment);

	for (const sample of samples) {
		const full = Math.round(255 * sample.opacity);
		const fadedInk = Math.round(255 * sample.face * sample.opacity);
		expect(sample.left, JSON.stringify(sample)).toEqual(sample.back ? [full, full, full, full] : [full, fadedInk, fadedInk, full]);
		expect(sample.right).toEqual(sample.back ? [full, full, full, full] : [fadedInk, fadedInk, full, full]);
		expect(sample.corner).toEqual([0, 0, 0, 0]);
	}
});
