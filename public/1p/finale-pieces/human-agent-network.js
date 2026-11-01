/** Figma 355:14624. Every shape stays at its original coordinates. */
export const CIRCLE_START_SECONDS = 0.12;
export const DOT_START_SECONDS = 0.36;
export const BRANCH_START_SECONDS = 0.64;
export const BRANCH_STAGGER_SECONDS = 0.18;
export const BRANCH_DRAW_SECONDS = 0.58;
export const HEX_DRAW_SECONDS = 0.44;
export const HEX_FILL_SECONDS = 0.2;
export const POSTER_SECONDS = 2.4;
export const MOMENT_SECONDS = 3;
const clamp = (value) => Math.max(0, Math.min(1, value));
const out = (value) => 1 - (1 - clamp(value)) ** 3;
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** The same restrained app-icon spring used by the other local pieces. */
function settle(seconds) {
	if (seconds <= 0) return 0;
	if (seconds >= 1) return 1;
	const omega = Math.sqrt(260 / 0.85);
	const decay = 28 / (2 * 0.85);
	const damped = Math.sqrt(omega * omega - decay * decay);
	return 1 - Math.exp(-decay * seconds) * (Math.cos(damped * seconds) + decay / damped * Math.sin(damped * seconds));
}

/** Branch → outline → fill, independently for each branch, on one seekable clock. */
export function networkFrame(seconds) {
	const time = Math.max(0, seconds);
	return {
		circle: out((time - CIRCLE_START_SECONDS) / 0.18),
		dot: { opacity: out((time - DOT_START_SECONDS) / 0.12), scale: settle(time - DOT_START_SECONDS) },
		branches: Array.from({ length: 3 }, (_, index) => {
			const elapsed = time - BRANCH_START_SECONDS - index * BRANCH_STAGGER_SECONDS;
			return {
				line: smooth(elapsed / BRANCH_DRAW_SECONDS),
				outline: smooth((elapsed - BRANCH_DRAW_SECONDS) / HEX_DRAW_SECONDS),
				fill: out((elapsed - BRANCH_DRAW_SECONDS - HEX_DRAW_SECONDS) / HEX_FILL_SECONDS),
			};
		}),
	};
}

/** Hold the finished diagram, then reset directly on replay without an ending fade. */
export function networkTime(seconds, { play = "once", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	if (play === "live") return time;
	return Math.min(play === "loop" ? time % (length + rest) : time, length);
}

// The original Figma SVG is embedded verbatim so its paths can draw without a runtime
// fetch, preserving its geometry and supporting the offline export's blob modules.
export const NETWORK_SVG = "<svg preserveAspectRatio=\"none\" overflow=\"visible\" style=\"display: block;\" width=\"166.5\" height=\"121.05\" viewBox=\"0 0 166.5 121.05\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<g id=\"Frame 2147260418\">\n<path id=\"Line 61\" d=\"M84.159 18.707L84.1559 18.7103M17.3568 87.2907L17.3599 87.2875M82.9017 19.9979L82.8955 20.0043M81.6413 21.2919L81.635 21.2983M80.3809 22.5859L80.3746 22.5924M79.1205 23.88L79.1142 23.8864M77.86 25.174L77.8538 25.1804M76.5996 26.468L76.5934 26.4745M75.3392 27.762L75.3329 27.7685M74.0788 29.0561L74.0725 29.0625M72.8184 30.3501L72.8121 30.3565M71.5579 31.6441L71.5517 31.6506M70.2975 32.9382L70.2913 32.9446M69.0371 34.2322L69.0308 34.2386M67.7767 35.5262L67.7704 35.5327M66.5163 36.8203L66.51 36.8267M65.2558 38.1143L65.2496 38.1207M63.9954 39.4083L63.9891 39.4148M62.735 40.7024L62.7287 40.7088M61.4746 41.9964L61.4683 42.0028M60.2142 43.2904L60.2079 43.2969M58.9537 44.5845L58.9475 44.5909M57.6933 45.8785L57.687 45.8849M56.4329 47.1725L56.4266 47.179M55.1725 48.4666L55.1662 48.473M53.9121 49.7606L53.9058 49.767M52.6516 51.0546L52.6454 51.0611M51.3912 52.3487L51.3849 52.3551M50.1308 53.6427L50.1245 53.6491M48.8704 54.9367L48.8641 54.9432M47.61 56.2307L47.6037 56.2372M46.3495 57.5248L46.3433 57.5312M45.0891 58.8188L45.0828 58.8253M43.8287 60.1128L43.8224 60.1193M42.5683 61.4069L42.562 61.4133M41.3078 62.7009L41.3016 62.7073M40.0474 63.9949L40.0412 64.0014M38.787 65.289L38.7807 65.2954M37.5266 66.583L37.5203 66.5894M36.2662 67.877L36.2599 67.8835M35.0057 69.1711L34.9995 69.1775M33.7453 70.4651L33.7391 70.4715M32.4849 71.7591L32.4786 71.7656M31.2245 73.0532L31.2182 73.0596M29.9641 74.3472L29.9578 74.3536M28.7036 75.6412L28.6974 75.6477M27.4432 76.9353L27.4369 76.9417M26.1828 78.2293L26.1765 78.2357M24.9224 79.5233L24.9161 79.5298M23.662 80.8174L23.6557 80.8238M22.4015 82.1114L22.3953 82.1178M21.1411 83.4054L21.1348 83.4119M19.8807 84.6995L19.8744 84.7059M18.6203 85.9935L18.614 85.9999\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#B7B9BE\"/>\n<path id=\"Line 62\" d=\"M82.3417 102.108L82.3416 102.104M80.958 18.5082L80.9581 18.5127M82.3117 100.295L82.3115 100.286M82.2816 98.478L82.2815 98.4689M82.2515 96.6606L82.2514 96.6516M82.2215 94.8432L82.2213 94.8342M82.1914 93.0258L82.1912 93.0168M82.1613 91.2084L82.1611 91.1994M82.1312 89.391L82.1311 89.382M82.1011 87.5736L82.101 87.5646M82.0711 85.7562L82.0709 85.7472M82.041 83.9388L82.0408 83.9298M82.0109 82.1215L82.0107 82.1124M81.9808 80.3041L81.9807 80.295M81.9507 78.4867L81.9506 78.4776M81.9207 76.6693L81.9205 76.6602M81.8906 74.8519L81.8904 74.8428M81.8605 73.0345L81.8604 73.0254M81.8304 71.2171L81.8303 71.208M81.8003 69.3997L81.8002 69.3907M81.7703 67.5823L81.7701 67.5733M81.7402 65.7649L81.74 65.7559M81.7101 63.9475L81.71 63.9385M81.68 62.1301L81.6799 62.1211M81.6499 60.3127L81.6498 60.3037M81.6199 58.4953L81.6197 58.4863M81.5898 56.6779L81.5896 56.6689M81.5597 54.8606L81.5596 54.8515M81.5296 53.0432L81.5295 53.0341M81.4996 51.2258L81.4994 51.2167M81.4695 49.4084L81.4693 49.3993M81.4394 47.591L81.4392 47.5819M81.4093 45.7736L81.4092 45.7645M81.3792 43.9562L81.3791 43.9471M81.3492 42.1388L81.349 42.1298M81.3191 40.3214L81.3189 40.3124M81.289 38.504L81.2888 38.495M81.2589 36.6866L81.2588 36.6776M81.2288 34.8692L81.2287 34.8602M81.1988 33.0518L81.1986 33.0428M81.1687 31.2344L81.1685 31.2254M81.1386 29.417L81.1385 29.408M81.1085 27.5996L81.1084 27.5906M81.0784 25.7823L81.0783 25.7732M81.0484 23.9649L81.0482 23.9558M81.0183 22.1475L81.0181 22.1384M80.9882 20.3301L80.9881 20.321\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#B7B9BE\"/>\n<path id=\"Line 63\" d=\"M149.143 87.2859L149.14 87.2827M83.2359 18.707L83.2389 18.7102M147.902 85.9952L147.896 85.9888M146.659 84.7013L146.653 84.6948M145.415 83.4073L145.409 83.4009M144.172 82.1134L144.166 82.107M142.928 80.8194L142.922 80.813M141.685 79.5255L141.679 79.5191M140.441 78.2316L140.435 78.2251M139.198 76.9376L139.192 76.9312M137.954 75.6437L137.948 75.6372M136.711 74.3497L136.705 74.3433M135.467 73.0558L135.461 73.0494M134.224 71.7618L134.217 71.7554M132.98 70.4679L132.974 70.4615M131.737 69.174L131.73 69.1675M130.493 67.88L130.487 67.8736M129.25 66.5861L129.243 66.5796M128.006 65.2921L128 65.2857M126.762 63.9982L126.756 63.9917M125.519 62.7042L125.513 62.6978M124.275 61.4103L124.269 61.4039M123.032 60.1163L123.026 60.1099M121.788 58.8224L121.782 58.816M120.545 57.5285L120.539 57.522M119.301 56.2345L119.295 56.2281M118.058 54.9406L118.052 54.9341M116.814 53.6466L116.808 53.6402M115.571 52.3527L115.565 52.3462M114.327 51.0587L114.321 51.0523M113.084 49.7648L113.077 49.7584M111.84 48.4708L111.834 48.4644M110.597 47.1769L110.59 47.1705M109.353 45.883L109.347 45.8765M108.11 44.589L108.103 44.5826M106.866 43.2951L106.86 43.2886M105.622 42.0011L105.616 41.9947M104.379 40.7072L104.373 40.7007M103.135 39.4132L103.129 39.4068M101.892 38.1193L101.886 38.1129M100.648 36.8254L100.642 36.8189M99.4048 35.5314L99.3986 35.525M98.1613 34.2375L98.1551 34.231M96.9178 32.9435L96.9116 32.9371M95.6742 31.6496L95.668 31.6431M94.4307 30.3556L94.4245 30.3492M93.1872 29.0617L93.181 29.0553M91.9436 27.7678L91.9375 27.7613M90.7001 26.4738L90.6939 26.4674M89.4566 25.1799L89.4504 25.1734M88.2131 23.8859L88.2069 23.8795M86.9695 22.592L86.9633 22.5856M85.726 21.298L85.7198 21.2916M84.4825 20.0041L84.4763 19.9977\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#B7B9BE\"/>\n<path id=\"Ellipse 1908\" d=\"M99 18C99 27.6926 91.1426 35.55 81.45 35.55C71.7574 35.55 63.9 27.6926 63.9 18C63.9 8.3074 71.7574 0.45 81.45 0.45C91.1426 0.45 99 8.3074 99 18Z\" fill=\"white\" stroke-width=\"0.9\" stroke=\"#7D818A\"/>\n<circle id=\"Ellipse 1909\" cx=\"81.45\" cy=\"18\" r=\"9\" fill=\"#82B536\"/>\n<path id=\"Vector\" d=\"M83.2501 84.6C84.1032 84.6 84.9412 84.8251 85.68 85.2528L97.0202 91.8167C97.759 92.2443 98.3725 92.8593 98.799 93.6C99.2255 94.3407 99.4501 95.1808 99.4501 96.0361V109.164C99.4501 110.019 99.2255 110.859 98.799 111.6C98.3725 112.341 97.759 112.956 97.0202 113.383L85.68 119.947C84.9412 120.375 84.1032 120.6 83.2501 120.6C82.397 120.6 81.559 120.375 80.8202 119.947L69.48 113.383C68.7412 112.956 68.1277 112.341 67.7012 111.6C67.2747 110.859 67.0501 110.019 67.0501 109.164V96.0361C67.0501 95.1808 67.2747 94.3407 67.7012 93.6C68.1277 92.8593 68.7412 92.2443 69.48 91.8167L80.8202 85.2528C81.559 84.8251 82.397 84.6 83.2501 84.6Z\" fill=\"white\" stroke-width=\"0.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#7D818A\"/>\n<path id=\"Vector_2\" d=\"M16.65 69C17.5031 69 18.3411 69.2251 19.0799 69.6528L30.4201 76.2167C31.1589 76.6443 31.7724 77.2594 32.1989 78C32.6254 78.7407 32.85 79.5809 32.85 80.4361V93.5639C32.85 94.4192 32.6254 95.2593 32.1989 96C31.7724 96.7407 31.1589 97.3557 30.4201 97.7833L19.0799 104.347C18.3411 104.775 17.5031 105 16.65 105C15.7969 105 14.9589 104.775 14.2201 104.347L2.87988 97.7833C2.14111 97.3557 1.52763 96.7407 1.10109 96C0.67456 95.2593 0.450006 94.4192 0.45 93.5639V80.4361C0.450006 79.5809 0.67456 78.7407 1.10109 78C1.52763 77.2594 2.14111 76.6443 2.87988 76.2167L14.2201 69.6528C14.9589 69.2251 15.7969 69 16.65 69Z\" fill=\"white\" stroke-width=\"0.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#7D818A\"/>\n<path id=\"Vector_3\" d=\"M149.85 69.3C150.703 69.3 151.541 69.5251 152.28 69.9528L163.62 76.5167C164.359 76.9443 164.972 77.5594 165.399 78.3C165.825 79.0407 166.05 79.8808 166.05 80.7361V93.8639C166.05 94.7192 165.825 95.5593 165.399 96.3C164.972 97.0407 164.359 97.6557 163.62 98.0833L152.28 104.647C151.541 105.075 150.703 105.3 149.85 105.3C148.997 105.3 148.159 105.075 147.42 104.647L136.08 98.0833C135.341 97.6557 134.727 97.0407 134.301 96.3C133.874 95.5593 133.65 94.7192 133.65 93.8639V80.7361C133.65 79.8808 133.874 79.0407 134.301 78.3C134.727 77.5594 135.341 76.9443 136.08 76.5167L147.42 69.9528C148.159 69.5251 148.997 69.3 149.85 69.3Z\" fill=\"white\" stroke-width=\"0.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#7D818A\"/>\n</g>\n</svg>\n";
const asset = (name) => new URL(`/1p/finale-pieces/assets/human-agent-network/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/human-agent-network.css", document.baseURI).href;
const SVG_NS = "http://www.w3.org/2000/svg";
const BRANCHES = [
	{ line: "Line 61", hex: "Vector_2", from: [84.159, 18.707], to: [17.3568, 87.2907] },
	{ line: "Line 62", hex: "Vector", from: [80.958, 18.5082], to: [82.3417, 102.108] },
	{ line: "Line 63", hex: "Vector_3", from: [83.2359, 18.707], to: [149.143, 87.2859] },
];
let instance = 0;

class HumanAgentNetwork extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#circle;
	#dot;
	#branches = [];
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-human-network-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.humanNetworkStyle = "";
			document.head.append(link);
		}
		if (!this.#stage) this.#build();
		this.#motion.addEventListener("change", this.#refresh);
		document.addEventListener("visibilitychange", this.#refresh);
		this.#observer = new IntersectionObserver(([entry]) => {
			this.#visible = entry.isIntersecting;
			this.redraw();
		});
		this.#observer.observe(this);
		this.redraw();
	}

	disconnectedCallback() {
		cancelAnimationFrame(this.#frame);
		this.#lastTick = null;
		this.#observer?.disconnect();
		this.#motion.removeEventListener("change", this.#refresh);
		document.removeEventListener("visibilitychange", this.#refresh);
	}

	attributeChangedCallback() { this.redraw(); }
	get pieceStyles() { return this.#styles; }
	set pieceStyles(value) { this.#styles = value; this.redraw(); }

	#build() {
		this.setAttribute("role", "img");
		this.setAttribute("aria-label", "Human and agents. A green dot appears inside a circle, then three dotted branches grow to hexagons. Each hexagon's outline draws before its white fill appears.");
		this.#stage = document.createElement("div");
		this.#stage.className = "human-network-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#stage.innerHTML = `<span class="human-network-detail"><img src="${asset("user-avatar.svg")}" alt=""></span><div class="human-network-diagram">${NETWORK_SVG}</div>`;
		const svg = this.#stage.querySelector("svg");
		const originals = new Map([...svg.querySelectorAll("[id]")].map((node) => [node.id, node]));
		const prefix = `human-network-${++instance}`;
		// IDs are private to this instance, including while the Library and wall coexist.
		[...originals.values()].forEach((node, index) => { node.id = `${prefix}-shape-${index}`; });
		this.#circle = originals.get("Ellipse 1908");
		this.#dot = originals.get("Ellipse 1909");
		this.#circle.classList.add("human-network-circle");
		this.#dot.classList.add("human-network-dot");
		const defs = document.createElementNS(SVG_NS, "defs");
		svg.prepend(defs);
		this.#branches = BRANCHES.map(({ line: lineId, hex: hexId, from, to }, index) => {
			const line = originals.get(lineId);
			const hex = originals.get(hexId);
			line.classList.add("human-network-line");
			hex.classList.add("human-network-hexagon");
			const mask = document.createElementNS(SVG_NS, "mask");
			mask.id = `${prefix}-branch-${index}`;
			mask.setAttribute("maskUnits", "userSpaceOnUse");
			mask.setAttribute("x", "-1"); mask.setAttribute("y", "-1");
			mask.setAttribute("width", "168.5"); mask.setAttribute("height", "123.05");
			const reveal = document.createElementNS(SVG_NS, "path");
			reveal.classList.add("human-network-reveal");
			reveal.setAttribute("d", `M${from.join(" ")}L${to.join(" ")}`);
			reveal.setAttribute("stroke", "white");
			reveal.setAttribute("stroke-width", "3");
			reveal.setAttribute("fill", "none");
			const lineLength = Math.hypot(to[0] - from[0], to[1] - from[1]);
			reveal.setAttribute("stroke-dasharray", String(lineLength));
			// The supplied dotted line extends underneath its hexagon. Keep it outside
			// that shape even while the requested white fill has not appeared yet.
			const cutout = hex.cloneNode();
			cutout.removeAttribute("id"); cutout.removeAttribute("class");
			cutout.setAttribute("fill", "black"); cutout.setAttribute("stroke", "none");
			mask.append(reveal, cutout);
			defs.append(mask);
			line.setAttribute("mask", `url(#${mask.id})`);
			const hexLength = hex.getTotalLength?.() ?? 108;
			hex.setAttribute("stroke-dasharray", String(hexLength));
			return { line, reveal, hex, lineLength, hexLength };
		});
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.humanAgentNetwork ?? {};
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${236 * scale}px`;
		this.style.height = `${145 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const time = this.#motion.matches ? POSTER_SECONDS : this.#number("time", this.#elapsed);
		const play = this.#motion.matches ? "once" : this.getAttribute("play") ?? settings.play ?? "once";
		const length = this.#motion.matches ? MOMENT_SECONDS : Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const pose = networkFrame(networkTime(time, { play, length, rest: Math.max(0, this.#number("rest", settings.rest ?? 1.5)) }));
		this.#circle.setAttribute("opacity", String(pose.circle));
		this.#dot.setAttribute("opacity", String(pose.dot.opacity));
		this.#dot.setAttribute("transform", `translate(81.45 18) scale(${pose.dot.scale}) translate(-81.45 -18)`);
		this.#branches.forEach(({ line, reveal, hex, lineLength, hexLength }, index) => {
			const branch = pose.branches[index];
			line.setAttribute("opacity", branch.line > 0 ? "1" : "0");
			reveal.setAttribute("stroke-dashoffset", String((1 - branch.line) * lineLength));
			hex.setAttribute("stroke-dashoffset", String((1 - branch.outline) * hexLength));
			hex.setAttribute("stroke-opacity", branch.outline > 0 ? "1" : "0");
			hex.setAttribute("fill-opacity", String(branch.fill));
		});
		return play !== "once" || time < length;
	}

	redraw() {
		cancelAnimationFrame(this.#frame);
		this.#lastTick = null;
		if (!this.isConnected || !this.#stage) return;
		const moving = this.#paint();
		if (!moving || this.hasAttribute("time") || this.hasAttribute("paused") || this.#motion.matches || !this.#visible || document.hidden) return;
		const tick = (now) => {
			if (this.#lastTick !== null) this.#elapsed += (now - this.#lastTick) / 1000;
			this.#lastTick = now;
			if (this.#paint()) this.#frame = requestAnimationFrame(tick);
		};
		this.#frame = requestAnimationFrame(tick);
	}
}

if (!customElements.get("human-agent-network")) customElements.define("human-agent-network", HumanAgentNetwork);
