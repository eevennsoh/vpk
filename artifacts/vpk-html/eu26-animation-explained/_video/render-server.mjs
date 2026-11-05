import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { jsonIsland } from "../_layout/story-shell.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const variants = new Set(["paper"]);
const themes = new Set(["light", "dark"]);

export function runHyperframes({ project, output, log }) {
	return new Promise((resolve, reject) => {
		const child = spawn("npx", ["--yes", "hyperframes@0.7.62", "render", project, "--quality", "high", "--fps", "60", "--output", output], { cwd: directory, stdio: ["ignore", "pipe", "pipe"] });
		child.stdout.on("data", data => log(data.toString()));
		child.stderr.on("data", data => log(data.toString()));
		child.on("error", reject);
		child.on("exit", code => code === 0 ? resolve() : reject(new Error(`HyperFrames exited with code ${code}`)));
	});
}

export async function createRenderService({ root = directory, port = 0, runner = runHyperframes, token = crypto.randomBytes(32).toString("hex") } = {}) {
	const jobs = new Map();
	let active = null;
	let origin = "", config;
	const exportsRoot = path.join(root, "exports");
	const send = (response, status, value) => {
		response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
		response.end(JSON.stringify(value));
	};
	const jobState = job => ({ id: job.id, status: job.status, statusUrl: `${origin}/api/jobs/${job.id}?key=${token}`, ...(job.status === "complete" ? { downloadUrl: `${origin}/api/jobs/${job.id}/download?key=${token}` } : {}), ...(job.error ? { error: job.error } : {}) });
	const execute = async job => {
		job.status = "running";
		try {
			const folder = path.join(exportsRoot, job.id);
			const project = path.join(folder, "project");
			await fs.mkdir(folder, { recursive: true });
			await fs.cp(path.join(root, "project"), project, { recursive: true });
			await fs.writeFile(path.join(project, "assets", "render-config.js"), `window.__eu26ExportSettings = ${JSON.stringify({ variant: job.variant, theme: job.theme })};\n`);
			await runner({ project, output: job.output, log: text => { job.log = (job.log + text).slice(-12000); } });
			const stat = await fs.stat(job.output);
			if (!stat.size) throw new Error("HyperFrames produced an empty file");
			job.status = "complete";
		} catch (error) {
			job.status = "failed";
			job.error = `${error.message}${job.log ? `\n${job.log.slice(-2000)}` : ""}`;
		} finally { active = null; }
	};
	const server = http.createServer(async (request, response) => {
		const requestOrigin = request.headers.origin;
		if (requestOrigin && requestOrigin !== "null" && requestOrigin !== origin) return send(response, 403, { error: "Origin is not allowed" });
		if (requestOrigin) response.setHeader("access-control-allow-origin", requestOrigin);
		response.setHeader("vary", "Origin");
		response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
		response.setHeader("access-control-allow-headers", "Content-Type, X-VPK-Render-Key");
		response.setHeader("access-control-allow-private-network", "true");
		if (request.method === "OPTIONS") { response.writeHead(204); return response.end(); }
		const url = new URL(request.url, origin);
		try {
			if (request.method === "POST" && url.pathname === "/api/render") {
				if (request.headers["x-vpk-render-key"] !== token) return send(response, 403, { error: "Invalid render capability" });
				if (active) return send(response, 409, { error: "A render is already running", ...jobState(jobs.get(active)) });
				let body = "";
				for await (const chunk of request) {
					body += chunk;
					if (body.length > 1024) return send(response, 413, { error: "Request is too large" });
				}
				let settings;
				try { settings = JSON.parse(body); } catch { return send(response, 400, { error: "Expected JSON settings" }); }
				if (!settings || typeof settings !== "object" || Array.isArray(settings) || !variants.has(settings.variant) || !themes.has(settings.theme) || Object.keys(settings).some(key => !["variant", "theme"].includes(key))) return send(response, 400, { error: "Expected variant paper and theme light or dark" });
				const id = crypto.randomBytes(12).toString("hex");
				const job = { id, ...settings, status: "queued", output: path.join(exportsRoot, id, "eu26-animation.mp4"), log: "" };
				jobs.set(id, job); active = id;
				send(response, 202, jobState(job));
				setImmediate(() => execute(job));
				return;
			}
			const jobMatch = url.pathname.match(/^\/api\/jobs\/([a-f0-9]{24})(\/download)?$/);
			if (request.method === "GET" && jobMatch) {
				if (url.searchParams.get("key") !== token) return send(response, 403, { error: "Invalid render capability" });
				const job = jobs.get(jobMatch[1]);
				if (!job) return send(response, 404, { error: "Unknown render" });
				if (!jobMatch[2]) return send(response, 200, jobState(job));
				if (job.status !== "complete") return send(response, 409, { error: "Video is not ready" });
				response.writeHead(200, { "content-type": "video/mp4", "content-disposition": 'attachment; filename="eu26-animation.mp4"', "cache-control": "no-store" });
				return response.end(await fs.readFile(job.output));
			}
			if (request.method === "GET" && url.pathname === "/api/status") return send(response, 200, { status: "ready", rendering: Boolean(active), automaticRendering: false });
			if (request.method === "GET" && ["/preview/", "/preview/assets/gsap.min.js", "/preview/assets/render-config.js"].includes(url.pathname)) {
				const relative = url.pathname === "/preview/" ? "index.html" : url.pathname.slice("/preview/".length);
				response.writeHead(200, { "content-type": relative.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8", "cache-control": "no-store" });
				return response.end(await fs.readFile(path.join(root, "project", relative)));
			}
			if (request.method === "GET" && url.pathname === "/") {
				const html = await fs.readFile(path.join(root, "..", "eu26-animation-explained.html"), "utf8");
				const island = /(<script type="application\/json" data-vpk-video-export>)[\s\S]*?(<\/script>)/;
				if (!island.test(html)) return send(response, 500, { error: "Preview is missing its video configuration" });
				response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
				return response.end(html.replace(island, (_match, start, end) => `${start}${jsonIsland(config)}${end}`));
			}
			return send(response, 404, { error: "Not found" });
		} catch (error) { return send(response, 500, { error: error.message }); }
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); });
	});
	origin = `http://127.0.0.1:${server.address().port}`;
	config = { endpoint: `${origin}/api/render`, token, status: `${origin}/api/status`, artifact: `${origin}/`, preview: `${origin}/preview/` };
	return { server, config, jobs, close: () => new Promise(resolve => server.close(resolve)) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const service = await createRenderService();
	console.log(`Preview: ${service.config.artifact}`);
	console.log("Ready. No video is rendered until an authorized Generate video POST.");
}
