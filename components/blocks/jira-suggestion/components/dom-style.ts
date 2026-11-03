/**
 * The inline style of a measured element, for hooks that write geometry straight to the DOM on scroll or resize
 * (where a React render per frame would be the wrong tool). The function boundary keeps those writes out of render.
 */
export function styleOf(element: HTMLElement): CSSStyleDeclaration {
	return element.style;
}
