/** Figma 355:14716: clockwise drawing, then slow continuous rotation. */
export const RING_START_SECONDS = 0.12;
export const RING_DRAW_SECONDS = 0.84;
export const HEX_START_SECONDS = 1.06;
export const HEX_DRAW_SECONDS = 0.5;
export const HEX_FILL_SECONDS = 0.2;
export const DOT_START_SECONDS = 1.8;
export const GREEN_START_SECONDS = 1.94;
export const PURPLE_START_SECONDS = 2.04;
export const POSTER_SECONDS = 2.4;
export const MOMENT_SECONDS = 12;
export const RING_TURN_SECONDS = 90;
export const PURPLE_TURN_SECONDS = 45;
const clamp = (value) => Math.max(0, Math.min(1, value));
const out = (value) => 1 - (1 - clamp(value)) ** 3;
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** All drawing and both steady rotations use the same seekable film clock. */
export function syncFrame(seconds) {
	const time = Math.max(0, seconds);
	const rotationTime = Math.max(0, time - POSTER_SECONDS);
	return {
		ring: smooth((time - RING_START_SECONDS) / RING_DRAW_SECONDS),
		outline: smooth((time - HEX_START_SECONDS) / HEX_DRAW_SECONDS),
		fill: out((time - HEX_START_SECONDS - HEX_DRAW_SECONDS) / HEX_FILL_SECONDS),
		dot: out((time - DOT_START_SECONDS) / 0.1),
		green: smooth((time - GREEN_START_SECONDS) / 0.28),
		purple: smooth((time - PURPLE_START_SECONDS) / 0.36),
		ringAngle: rotationTime * 360 / RING_TURN_SECONDS % 360,
		purpleAngle: rotationTime * 360 / PURPLE_TURN_SECONDS % 360,
	};
}

/** Live keeps rotating; explicit once/loop settings use the kit's moment contract. */
export function syncTime(seconds, { play = "live", length = MOMENT_SECONDS, rest = 1.5 } = {}) {
	const time = Math.max(0, seconds);
	if (play === "live") return time;
	return Math.min(play === "loop" ? time % (length + rest) : time, length);
}

// Original Figma SVGs, embedded intact for path drawing and offline blob modules.
export const HEXAGON_SVG = "<svg preserveAspectRatio=\"none\" overflow=\"visible\" style=\"display: block;\" width=\"81.9\" height=\"90.9\" viewBox=\"0 0 81.9 90.9\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path id=\"Vector\" opacity=\"0.75\" d=\"M40.95 0.45C43.0827 0.450028 45.1778 1.01287 47.0247 2.08196L75.3753 18.4918C77.2222 19.5608 78.7559 21.0984 79.8223 22.9501C80.8886 24.8017 81.45 26.9022 81.45 29.0403V61.8598C81.45 63.9979 80.8886 66.0984 79.8223 67.95C78.7559 69.8017 77.2222 71.3393 75.3753 72.4083L47.0247 88.8181C45.1778 89.8872 43.0827 90.45 40.95 90.45C38.8173 90.45 36.7222 89.8872 34.8753 88.8181L6.5247 72.4083C4.67777 71.3393 3.14406 69.8017 2.07773 67.95C1.0114 66.0984 0.450016 63.9979 0.45 61.8598V29.0403C0.450016 26.9022 1.0114 24.8017 2.07773 22.9501C3.14406 21.0984 4.67777 19.5608 6.5247 18.4918L34.8753 2.08196C36.7222 1.01287 38.8173 0.450028 40.95 0.45Z\" fill=\"white\" stroke-width=\"0.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#7D818A\"/>\n</svg>\n";
export const DOTTED_RING_SVG = "<svg preserveAspectRatio=\"none\" overflow=\"visible\" style=\"display: block;\" width=\"133.35\" height=\"134.35\" viewBox=\"0 0 133.35 134.35\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path id=\"Vector\" d=\"M66.6733 0.675C66.6739 0.675 66.6744 0.675 66.675 0.675C66.6756 0.675 66.6761 0.675 66.6767 0.675M63.945 0.731852C63.9439 0.731898 63.9428 0.731944 63.9417 0.73199M61.2186 0.902475C61.2175 0.902567 61.2164 0.902659 61.2153 0.902752M58.502 1.1866C58.5009 1.18674 58.4998 1.18687 58.4987 1.18701M55.799 1.58383C55.7979 1.58401 55.7968 1.5842 55.7957 1.58438M53.1152 2.09336C53.1141 2.09359 53.113 2.09382 53.1119 2.09405M50.455 2.71425C50.454 2.71453 50.4529 2.7148 50.4518 2.71508M47.8229 3.44543C47.8218 3.44575 47.8208 3.44607 47.8197 3.44639M45.2235 4.28549C45.2224 4.28586 45.2214 4.28622 45.2203 4.28658M42.6613 5.23291C42.6603 5.23332 42.6592 5.23372 42.6582 5.23413M40.1406 6.286C40.1396 6.28645 40.1386 6.28689 40.1376 6.28734M37.666 7.44282C37.665 7.44331 37.664 7.4438 37.663 7.44429M35.2414 8.70138C35.2404 8.70191 35.2394 8.70244 35.2384 8.70297M32.871 10.0595C32.87 10.06 32.8691 10.0606 32.8681 10.0612M30.5591 11.5145C30.5582 11.5151 30.5573 11.5157 30.5564 11.5163M28.3094 13.0641C28.3085 13.0648 28.3076 13.0654 28.3067 13.0661M26.1256 14.7058C26.1247 14.7064 26.1238 14.7071 26.123 14.7078M24.012 16.4359C24.0111 16.4366 24.0103 16.4373 24.0094 16.438M21.9714 18.2521C21.9706 18.2528 21.9698 18.2536 21.969 18.2543M20.0071 20.1512C20.0067 20.1516 20.0063 20.152 20.0059 20.1524C20.0056 20.1528 20.0052 20.1532 20.0048 20.1536M18.1139 22.1393C18.1131 22.1401 18.1124 22.141 18.1116 22.1418M16.3048 24.2037C16.3041 24.2046 16.3034 24.2054 16.3027 24.2063M14.5828 26.341C14.5821 26.3419 14.5814 26.3427 14.5808 26.3436M12.9503 28.5479C12.9497 28.5489 12.949 28.5498 12.9484 28.5507M11.4105 30.8203C11.4099 30.8212 11.4092 30.8222 11.4086 30.8231M9.9657 33.1541C9.96514 33.1551 9.96457 33.156 9.964 33.157M8.61826 35.5456C8.61773 35.5466 8.6172 35.5476 8.61668 35.5486M7.37042 37.9905C7.36994 37.9915 7.36945 37.9925 7.36896 37.9935M6.2242 40.4847C6.22375 40.4857 6.22331 40.4867 6.22286 40.4877M5.18142 43.0238C5.18102 43.0249 5.18062 43.0259 5.18022 43.0269M4.24382 45.6036C4.24346 45.6047 4.2431 45.6057 4.24274 45.6068M3.41287 48.2198C3.41255 48.2208 3.41224 48.2219 3.41192 48.223M2.68994 50.8679C2.68967 50.869 2.6894 50.8701 2.68913 50.8711M2.0763 53.5432C2.07607 53.5443 2.07585 53.5454 2.07562 53.5465M1.57287 56.2416C1.57268 56.2427 1.5725 56.2438 1.57232 56.2449M1.18046 58.9586C1.18032 58.9597 1.18019 58.9608 1.18005 58.9619M0.899819 61.6888C0.899727 61.6899 0.899636 61.691 0.899545 61.6921M0.731253 64.4285C0.731208 64.4296 0.731162 64.4308 0.731117 64.4319M0.675 67.1733C0.675 67.1739 0.675 67.1744 0.675 67.175C0.675 67.1756 0.675 67.1761 0.675 67.1767M0.731117 69.9181C0.731162 69.9193 0.731208 69.9204 0.731254 69.9215M0.899546 72.6579C0.899637 72.659 0.899728 72.6601 0.899819 72.6612M1.18005 75.3881C1.18019 75.3892 1.18032 75.3903 1.18046 75.3914M1.57232 78.1051C1.5725 78.1062 1.57268 78.1073 1.57287 78.1084M2.07562 80.8035C2.07585 80.8046 2.07608 80.8057 2.0763 80.8068M2.68913 83.4789C2.6894 83.48 2.68967 83.481 2.68994 83.4821M3.41192 86.127C3.41224 86.1281 3.41255 86.1292 3.41287 86.1302M4.24274 88.7432C4.2431 88.7443 4.24346 88.7453 4.24382 88.7464M5.18022 91.3231C5.18062 91.3241 5.18102 91.3251 5.18142 91.3262M6.22287 93.8623C6.22331 93.8633 6.22375 93.8643 6.2242 93.8653M7.36896 96.3565C7.36945 96.3575 7.36994 96.3585 7.37042 96.3595M8.61668 98.8014C8.61721 98.8024 8.61773 98.8034 8.61826 98.8044M9.964 101.193C9.96457 101.194 9.96514 101.195 9.96571 101.196M11.4086 103.527C11.4093 103.528 11.4099 103.529 11.4105 103.53M12.9484 105.799C12.949 105.8 12.9497 105.801 12.9503 105.802M14.5808 108.006C14.5815 108.007 14.5821 108.008 14.5828 108.009M16.3027 110.144C16.3034 110.145 16.3041 110.145 16.3048 110.146M18.1116 112.208C18.1124 112.209 18.1132 112.21 18.1139 112.211M20.0048 114.196C20.0052 114.197 20.0056 114.197 20.0059 114.198C20.0063 114.198 20.0067 114.198 20.0071 114.199M21.969 116.096C21.9698 116.096 21.9706 116.097 21.9714 116.098M24.0094 117.912C24.0103 117.913 24.0111 117.913 24.012 117.914M26.123 119.642C26.1238 119.643 26.1247 119.644 26.1256 119.644M28.3067 121.284C28.3076 121.285 28.3085 121.285 28.3094 121.286M30.5564 122.834C30.5573 122.834 30.5582 122.835 30.5591 122.836M32.8681 124.289C32.8691 124.289 32.87 124.29 32.871 124.291M35.2384 125.647C35.2394 125.648 35.2404 125.648 35.2414 125.649M37.663 126.906C37.664 126.906 37.665 126.907 37.666 126.907M40.1376 128.063C40.1386 128.063 40.1396 128.064 40.1406 128.064M42.6582 129.116C42.6592 129.116 42.6603 129.117 42.6613 129.117M45.2203 130.063C45.2214 130.064 45.2224 130.064 45.2235 130.065M47.8197 130.904C47.8208 130.904 47.8218 130.904 47.8229 130.905M50.4518 131.635C50.4529 131.635 50.454 131.635 50.455 131.636M53.1119 132.256C53.113 132.256 53.1141 132.256 53.1152 132.257M55.7957 132.766C55.7968 132.766 55.7979 132.766 55.799 132.766M58.4987 133.163C58.4998 133.163 58.5009 133.163 58.502 133.163M61.2153 133.447C61.2164 133.447 61.2175 133.447 61.2186 133.448M63.9417 133.618C63.9428 133.618 63.9439 133.618 63.945 133.618M66.6733 133.675C66.6739 133.675 66.6744 133.675 66.675 133.675C66.6756 133.675 66.6761 133.675 66.6767 133.675M69.405 133.618C69.4061 133.618 69.4072 133.618 69.4083 133.618M72.1314 133.448C72.1325 133.447 72.1336 133.447 72.1347 133.447M74.848 133.163C74.8491 133.163 74.8502 133.163 74.8513 133.163M77.551 132.766C77.5521 132.766 77.5532 132.766 77.5543 132.766M80.2348 132.257C80.2359 132.256 80.237 132.256 80.2381 132.256M82.8949 131.636C82.896 131.635 82.8971 131.635 82.8982 131.635M85.5271 130.905C85.5282 130.904 85.5292 130.904 85.5303 130.904M88.1265 130.065C88.1276 130.064 88.1286 130.064 88.1297 130.063M90.6887 129.117C90.6897 129.117 90.6908 129.116 90.6918 129.116M93.2093 128.064C93.2104 128.064 93.2114 128.063 93.2124 128.063M95.684 126.907C95.685 126.907 95.686 126.906 95.687 126.906M98.1086 125.649C98.1096 125.648 98.1106 125.648 98.1115 125.647M100.479 124.291C100.48 124.29 100.481 124.289 100.482 124.289M102.791 122.836C102.792 122.835 102.793 122.834 102.794 122.834M105.041 121.286C105.041 121.285 105.042 121.285 105.043 121.284M107.224 119.644C107.225 119.644 107.226 119.643 107.227 119.642M109.338 117.914C109.339 117.913 109.34 117.913 109.341 117.912M111.379 116.098C111.379 116.097 111.38 116.096 111.381 116.096M113.343 114.199C113.343 114.198 113.344 114.198 113.344 114.198C113.344 114.197 113.345 114.197 113.345 114.196M115.236 112.211C115.237 112.21 115.238 112.209 115.238 112.208M117.045 110.146C117.046 110.145 117.047 110.145 117.047 110.144M118.767 108.009C118.768 108.008 118.769 108.007 118.769 108.006M120.4 105.802C120.4 105.801 120.401 105.8 120.402 105.799M121.94 103.53C121.94 103.529 121.941 103.528 121.941 103.527M123.384 101.196C123.385 101.195 123.385 101.194 123.386 101.193M124.732 98.8044C124.732 98.8034 124.733 98.8024 124.733 98.8014M125.98 96.3595C125.98 96.3585 125.981 96.3575 125.981 96.3565M127.126 93.8653C127.126 93.8643 127.127 93.8633 127.127 93.8623M128.169 91.3262C128.169 91.3251 128.169 91.3241 128.17 91.3231M129.106 88.7464C129.107 88.7453 129.107 88.7443 129.107 88.7432M129.937 86.1302C129.937 86.1292 129.938 86.1281 129.938 86.127M130.66 83.4821C130.66 83.481 130.661 83.48 130.661 83.4789M131.274 80.8068C131.274 80.8057 131.274 80.8046 131.274 80.8035M131.777 78.1084C131.777 78.1073 131.777 78.1062 131.778 78.1051M132.17 75.3914C132.17 75.3903 132.17 75.3892 132.17 75.3881M132.45 72.6612C132.45 72.6601 132.45 72.659 132.45 72.6578M132.619 69.9215C132.619 69.9203 132.619 69.9192 132.619 69.9181M132.675 67.1767C132.675 67.1761 132.675 67.1756 132.675 67.175C132.675 67.1744 132.675 67.1739 132.675 67.1733M132.619 64.4319C132.619 64.4308 132.619 64.4296 132.619 64.4285M132.45 61.6921C132.45 61.691 132.45 61.6899 132.45 61.6888M132.17 58.9619C132.17 58.9608 132.17 58.9597 132.17 58.9586M131.778 56.2449C131.777 56.2438 131.777 56.2427 131.777 56.2416M131.274 53.5465C131.274 53.5454 131.274 53.5443 131.274 53.5432M130.661 50.8711C130.661 50.87 130.66 50.869 130.66 50.8679M129.938 48.223C129.938 48.2219 129.937 48.2208 129.937 48.2198M129.107 45.6068C129.107 45.6057 129.107 45.6047 129.106 45.6036M128.17 43.0269C128.169 43.0259 128.169 43.0249 128.169 43.0238M127.127 40.4877C127.127 40.4867 127.126 40.4857 127.126 40.4847M125.981 37.9935C125.981 37.9925 125.98 37.9915 125.98 37.9905M124.733 35.5486C124.733 35.5476 124.732 35.5466 124.732 35.5456M123.386 33.157C123.385 33.156 123.385 33.1551 123.384 33.1541M121.941 30.8231C121.941 30.8222 121.94 30.8212 121.94 30.8203M120.402 28.5507C120.401 28.5498 120.4 28.5489 120.4 28.548M118.769 26.3436C118.769 26.3427 118.768 26.3419 118.767 26.341M117.047 24.2063C117.047 24.2054 117.046 24.2046 117.045 24.2037M115.238 22.1418C115.238 22.141 115.237 22.1401 115.236 22.1393M113.345 20.1536C113.345 20.1532 113.344 20.1528 113.344 20.1524C113.344 20.152 113.343 20.1516 113.343 20.1512M111.381 18.2543C111.38 18.2536 111.379 18.2528 111.379 18.2521M109.341 16.4381C109.34 16.4373 109.339 16.4366 109.338 16.4359M107.227 14.7078C107.226 14.7071 107.225 14.7064 107.224 14.7058M105.043 13.0661C105.042 13.0654 105.041 13.0648 105.041 13.0641M102.794 11.5163C102.793 11.5157 102.792 11.5151 102.791 11.5145M100.482 10.0612C100.481 10.0606 100.48 10.06 100.479 10.0595M98.1115 8.70297C98.1106 8.70244 98.1096 8.70191 98.1086 8.70137M95.687 7.44429C95.686 7.4438 95.685 7.44331 95.684 7.44282M93.2124 6.28734C93.2114 6.28689 93.2104 6.28644 93.2093 6.28599M90.6918 5.23413C90.6908 5.23372 90.6897 5.23332 90.6887 5.23291M88.1296 4.28658C88.1286 4.28622 88.1276 4.28586 88.1265 4.28549M85.5303 3.44639C85.5292 3.44607 85.5282 3.44575 85.5271 3.44543M82.8982 2.71508C82.8971 2.7148 82.896 2.71453 82.895 2.71425M80.2381 2.09405C80.237 2.09382 80.2359 2.09359 80.2348 2.09336M77.5543 1.58438C77.5532 1.5842 77.5521 1.58401 77.551 1.58383M74.8513 1.18701C74.8502 1.18687 74.8491 1.18673 74.848 1.1866M72.1347 0.902751C72.1336 0.902658 72.1324 0.902566 72.1313 0.902474M69.4083 0.73199C69.4072 0.731944 69.406 0.731897 69.4049 0.731851\" stroke-width=\"1.35\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"url(#paint0_radial_0_60)\"/>\n<defs>\n<radialGradient id=\"paint0_radial_0_60\" cx=\"0\" cy=\"0\" r=\"1\" gradientTransform=\"matrix(-66 -7.101 3.18714 -147.049 66.675 7.776)\" gradientUnits=\"userSpaceOnUse\">\n<stop stop-color=\"#A0A5AB\" stop-opacity=\"0\"/>\n<stop offset=\"1\" stop-color=\"#A0A5AB\" stop-opacity=\"0.95\"/>\n</radialGradient>\n</defs>\n</svg>\n";
export const CENTER_DOT_SVG = "<svg preserveAspectRatio=\"none\" overflow=\"visible\" style=\"display: block;\" width=\"3.6\" height=\"3.6\" viewBox=\"0 0 3.6 3.6\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<circle id=\"Ellipse 1907\" cx=\"1.8\" cy=\"1.8\" r=\"1.8\" fill=\"#101214\"/>\n</svg>\n";
const asset = (name) => new URL(`/1p/finale-pieces/assets/principle-sync/${name}`, document.baseURI).href;
const stylesheet = new URL("/1p/finale-pieces/principle-sync.css", document.baseURI).href;
const SVG_NS = "http://www.w3.org/2000/svg";
let instance = 0;

class PrincipleSync extends HTMLElement {
	static observedAttributes = ["time", "paused", "scale", "appearance", "surface", "play", "rest", "length"];
	#styles;
	#stage;
	#ring;
	#ringPivot;
	#ringReveal;
	#ringLength;
	#hex;
	#hexLength;
	#dot;
	#green;
	#purple;
	#purplePivot;
	#frame = 0;
	#elapsed = 0;
	#lastTick = null;
	#visible = true;
	#observer;
	#motion = matchMedia("(prefers-reduced-motion: reduce)");
	#refresh = () => this.redraw();

	connectedCallback() {
		if (!document.querySelector("link[data-principle-sync-style]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = stylesheet;
			link.dataset.principleSyncStyle = "";
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
		this.setAttribute("aria-label", "Principle sync. A dotted circle draws clockwise, followed by a white hexagon, a centre dot and two hands. The gradient ring and purple hand rotate slowly clockwise while the green hand stays fixed.");
		this.#stage = document.createElement("div");
		this.#stage.className = "sync-stage";
		this.#stage.setAttribute("aria-hidden", "true");
		this.#stage.innerHTML = `<span class="sync-detail"><img src="${asset("user-avatar.svg")}" alt=""></span>
			<svg class="sync-diagram" width="236" height="145" viewBox="0 0 236 145" xmlns="${SVG_NS}">
				<g class="sync-ring-pivot">${DOTTED_RING_SVG}</g>
				<g class="sync-hexagon">${HEXAGON_SVG}</g>
				<g class="sync-green"><rect x="116.15" y="44.4" width="2.7" height="27.9" fill="#82B536"/></g>
				<g class="sync-purple-pivot"><g class="sync-purple"><rect x="0" y="-0.9" width="36.9" height="1.8" fill="#BF63F3"/></g></g>
				<g class="sync-dot">${CENTER_DOT_SVG}</g>
			</svg>`;
		const svg = this.#stage.querySelector(".sync-diagram");
		const prefix = `principle-sync-${++instance}`;
		const ids = new Map();
		svg.querySelectorAll("[id]").forEach((node, index) => {
			// The supplied ring and hexagon both have a path called Vector.
			const original = node.id;
			node.id = `${prefix}-shape-${index}`;
			ids.set(original, node.id);
		});
		svg.querySelectorAll("[stroke]").forEach((node) => {
			const id = node.getAttribute("stroke").match(/^url\(#(.+)\)$/)?.[1];
			if (id && ids.has(id)) node.setAttribute("stroke", `url(#${ids.get(id)})`);
		});
		this.#ringPivot = svg.querySelector(".sync-ring-pivot");
		const ringSvg = this.#ringPivot.firstElementChild;
		ringSvg.setAttribute("x", "51.325"); ringSvg.setAttribute("y", "4.425");
		this.#ring = ringSvg.querySelector("path");
		const mask = document.createElementNS(SVG_NS, "mask");
		mask.id = `${prefix}-ring-reveal`;
		mask.setAttribute("maskUnits", "userSpaceOnUse");
		mask.setAttribute("x", "-1"); mask.setAttribute("y", "-1");
		mask.setAttribute("width", "135.35"); mask.setAttribute("height", "136.35");
		this.#ringReveal = document.createElementNS(SVG_NS, "path");
		this.#ringReveal.setAttribute("d", "M66.675 0.675A66 66.5 0 1 1 66.675 133.675A66 66.5 0 1 1 66.675 0.675");
		this.#ringReveal.setAttribute("stroke", "white");
		this.#ringReveal.setAttribute("stroke-width", "3");
		this.#ringReveal.setAttribute("fill", "none");
		this.#ringLength = this.#ringReveal.getTotalLength?.() ?? Math.PI * (3 * (66 + 66.5) - Math.sqrt((3 * 66 + 66.5) * (66 + 3 * 66.5)));
		this.#ringReveal.setAttribute("stroke-dasharray", String(this.#ringLength));
		mask.append(this.#ringReveal);
		ringSvg.querySelector("defs").append(mask);
		this.#ring.setAttribute("mask", `url(#${mask.id})`);
		const hexSvg = svg.querySelector(".sync-hexagon svg");
		hexSvg.setAttribute("x", "76.55"); hexSvg.setAttribute("y", "26.55");
		this.#hex = hexSvg.querySelector("path");
		this.#hexLength = this.#hex.getTotalLength?.() ?? 270;
		this.#hex.setAttribute("stroke-dasharray", String(this.#hexLength));
		const dotSvg = svg.querySelector(".sync-dot svg");
		dotSvg.setAttribute("x", "115.7"); dotSvg.setAttribute("y", "70.5");
		this.#dot = svg.querySelector(".sync-dot");
		this.#green = svg.querySelector(".sync-green");
		this.#purple = svg.querySelector(".sync-purple");
		this.#purplePivot = svg.querySelector(".sync-purple-pivot");
		this.replaceChildren(this.#stage);
	}

	#number(name, fallback) {
		const value = this.getAttribute(name);
		return value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	#paint() {
		const settings = this.#styles?.principleSync ?? {};
		const scale = Math.max(0.01, this.#number("scale", 1));
		this.style.width = `${236 * scale}px`;
		this.style.height = `${145 * scale}px`;
		this.#stage.style.transform = `scale(${scale})`;
		const surface = this.getAttribute("surface");
		this.#stage.classList.toggle("no-surface", surface === "off" || (surface !== "on" && settings.surface === false));
		const reduced = this.#motion.matches;
		const time = reduced ? POSTER_SECONDS : this.#number("time", this.#elapsed);
		const play = reduced ? "live" : this.getAttribute("play") ?? settings.play ?? "live";
		const length = Math.max(0.1, this.#number("length", settings.length ?? MOMENT_SECONDS));
		const pose = syncFrame(syncTime(time, { play, length, rest: Math.max(0, this.#number("rest", settings.rest ?? 1.5)) }));
		this.#ringPivot.setAttribute("transform", `rotate(${pose.ringAngle} 118 71.6)`);
		this.#ring.setAttribute("opacity", pose.ring > 0 ? "1" : "0");
		this.#ringReveal.setAttribute("stroke-dasharray", pose.ring === 1 ? "none" : String(this.#ringLength));
		this.#ringReveal.setAttribute("stroke-dashoffset", String((1 - pose.ring) * this.#ringLength));
		this.#hex.setAttribute("stroke-dasharray", pose.outline === 1 ? "none" : String(this.#hexLength));
		this.#hex.setAttribute("stroke-dashoffset", String((1 - pose.outline) * this.#hexLength));
		this.#hex.setAttribute("stroke-opacity", pose.outline > 0 ? "1" : "0");
		this.#hex.setAttribute("fill-opacity", String(pose.fill));
		this.#dot.setAttribute("opacity", String(pose.dot));
		this.#green.setAttribute("transform", `translate(117.5 72.3) scale(1 ${pose.green}) translate(-117.5 -72.3)`);
		this.#green.setAttribute("opacity", pose.green > 0 ? "1" : "0");
		this.#purple.setAttribute("transform", `translate(117.1341 72.2686) rotate(15.08) scale(${pose.purple} 1)`);
		this.#purple.setAttribute("opacity", pose.purple > 0 ? "1" : "0");
		this.#purplePivot.setAttribute("transform", `rotate(${pose.purpleAngle} 117.5 72.3)`);
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

if (!customElements.get("principle-sync")) customElements.define("principle-sync", PrincipleSync);
