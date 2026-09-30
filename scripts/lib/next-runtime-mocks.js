// Minimal, safe stand-ins for Next.js runtime modules, as esbuild module sources keyed by
// specifier. Shared by bundlers that run VPK components outside Next.js (the node:test
// render harness and standalone single-file HTML exports).
const NEXT_RUNTIME_MOCKS = {
	"next/image": `import { createElement } from "react";
		export default function Image({ blurDataURL, fill, loader, placeholder, priority, quality, src, unoptimized, ...props }) {
			return createElement("img", { ...props, src: typeof src === "object" ? src.src : src });
		}`,
	"next/link": `import { createElement } from "react";
		export default function Link({ href, legacyBehavior, locale, passHref, prefetch, replace, scroll, shallow, ...props }) {
			return createElement("a", { ...props, href: typeof href === "object" ? href.pathname ?? "" : href });
		}`,
	"next/navigation": `const router = { back() {}, forward() {}, prefetch() {}, push() {}, refresh() {}, replace() {} };
		export const useRouter = () => router;
		export const usePathname = () => "/";
		export const useSearchParams = () => new URLSearchParams();
		export const useParams = () => ({});
		export function notFound() { throw new Error("notFound() called"); }
		export function redirect(url) { throw new Error("redirect(" + url + ") called"); }`,
};

module.exports = { NEXT_RUNTIME_MOCKS };
