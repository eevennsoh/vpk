import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const source = process.argv[2] || path.join(root, "../eu26-animation-explained.html");
const original = await fs.readFile(source, "utf8");

function isolateHero() {
	window.__eu26ExportReady = new Promise((resolve, reject) => {
		async function prepare() {
			try {
				for (let attempts = 0; !window.__eu26Explorer && attempts < 300; attempts++) await new Promise(requestAnimationFrame);
				if (!window.__eu26Explorer) throw new Error("Original EU26 animation did not initialize");
				await document.fonts.ready;
				const settings = parent.__eu26ExportSettings || { variant: "paper", theme: "light" };
				window.__vpkStory?.suspendFollowing("hyperframes-export");
				window.__eu26Explorer.pause();
				window.__eu26Explorer.clearPreview();
				window.__eu26Explorer.setVariant(settings.variant);
				document.documentElement.dataset.theme = settings.theme;
				const hero = document.querySelector('[data-vpk-figure="eu26-hero"]');
				document.body.append(hero);
				document.body.id = "animation-explorer";
				document.body.removeAttribute("data-vpk-layout");
				const style = document.createElement("style");
				style.textContent = `
					html,body{width:1200px!important;height:760px!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:var(--paper)!important}
					body>:not([data-vpk-figure="eu26-hero"]){display:none!important}
					[data-vpk-figure="eu26-hero"],[data-vpk-figure="eu26-hero"] .iso-figure,[data-vpk-figure="eu26-hero"] .iso-plate,[data-vpk-figure="eu26-hero"] .iso-stage{display:block!important;width:1200px!important;height:760px!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow:hidden!important;aspect-ratio:auto!important}
					[data-vpk-figure="eu26-hero"] .iso-svg{display:block!important;width:1200px!important;height:760px!important;max-width:none!important;max-height:none!important;margin:0!important;overflow:hidden!important}
					[data-vpk-figure="eu26-hero"] .iso-plate-corners,[data-vpk-figure="eu26-hero"] .iso-legend{display:none!important}
				`;
				document.head.append(style);
				window.scrollTo(0, 0);
				await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
				window.__eu26Explorer.seek(0);
				resolve();
			} catch (error) { reject(error); }
		}
		if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepare, { once: true });
		else prepare();
	});
}

const sourceHtml = original.replace(/<video\b[\s\S]*?<\/video>/gi, "").replace(/<\/body>/i, `<script>(${isolateHero.toString()})();<\/script></body>`);
const escapeAttribute = value => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>EU26 animation export</title>
<script src="assets/gsap.min.js"></script><script src="assets/render-config.js"></script>
<style>html,body{margin:0;width:1200px;height:760px;overflow:hidden}#root{position:relative;width:1200px;height:760px;overflow:hidden}#eu26-scene{position:absolute;inset:0;width:1200px;height:760px;border:0}</style>
</head><body>
<div id="root" data-composition-id="eu26-animation" data-start="0" data-duration="20" data-width="1200" data-height="760" data-fps="60">
<iframe id="eu26-scene" class="clip" data-start="0" data-duration="20" data-track-index="0" data-track-kind="graphics" title="EU26 animation" srcdoc="${escapeAttribute(sourceHtml)}"></iframe>
</div>
<script>
window.__timelines = window.__timelines || {};
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
const frame = document.getElementById("eu26-scene");
const ready = new Promise((resolve, reject) => frame.addEventListener("load", async () => {
	try {
		await frame.contentWindow.__eu26ExportReady;
		const clock = { seconds: 0 };
		const draw = seconds => frame.contentWindow.__eu26Explorer.seek(Math.max(0, Math.min(20, seconds)) * 1.7);
		const timeline = gsap.timeline({ paused: true });
		timeline.fromTo(clock, { seconds: 0 }, { seconds: 20, duration: 20, ease: "none", onUpdate: () => draw(clock.seconds) }, 0);
		window.addEventListener("hf-seek", event => draw(event.detail.time));
		draw(0);
		window.__timelines["eu26-animation"] = timeline;
		window.__eu26Export = { seek: draw, getState: () => frame.contentWindow.__eu26Explorer.getState() };
		resolve();
	} catch (error) { reject(error); }
}, { once: true }));
window.__hf.buildReady["eu26-animation"] = ready;
</script></body></html>\n`;
await fs.mkdir(path.join(root, "project", "assets"), { recursive: true });
await fs.copyFile(path.join(root, "assets", "gsap.min.js"), path.join(root, "project", "assets", "gsap.min.js"));
await fs.writeFile(path.join(root, "project", "index.html"), html);
await fs.writeFile(path.join(root, "project", "assets", "render-config.js"), 'window.__eu26ExportSettings = { variant: "paper", theme: "light" };\n');
await fs.writeFile(path.join(root, "project", "hyperframes.json"), `${JSON.stringify({ name: "eu26-animation", version: "1.0.0" }, null, "\t")}\n`);
console.log(`Prepared ${path.join(root, "project")} from ${source}; no video rendered.`);
