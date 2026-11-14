/**
 * Ambient module types for `@atlassian/logo-third-party` deep ESM entry points.
 *
 * The package (Atlassian Platform Labs) ships only `dist/` with no `exports`
 * map and no root entry-point stubs, so its documented bare imports
 * (`@atlassian/logo-third-party/figma`) only resolve inside the
 * atlassian-frontend monorepo's custom `atlassian-conventions` resolver. In
 * this standalone Next app we import the real ESM files directly from
 * `@atlassian/logo-third-party/dist/esm/entry-points/<brand>` (verified to
 * resolve at runtime) and supply the types here, keyed by the same specifier.
 *
 * Each entry point exports a single PascalCase `<Brand>Icon` component
 * (`FigmaIcon`, `SlackIcon`, …) sharing the narrow Tile-backed prop surface.
 * The wildcard types every entry point as a record so a brand can be looked up
 * by its generated export name in `logo-third-party-icons.ts`.
 */
declare module "@atlassian/logo-third-party/dist/esm/entry-points/*" {
	const icons: Record<
		string,
		import("react").ComponentType<{
			size?: "xxsmall" | "xsmall" | "small" | "medium" | "large" | "xlarge";
			label?: string;
			testId?: string;
		}>
	>;
	export = icons;
}

/**
 * The shared wrappers that `components/ui/data/logo-wrappers.ts` keeps with the page. They are
 * only referenced there, never rendered, so their shape is not needed.
 */
declare module "@atlassian/logo-third-party/dist/esm/wrapper" {
	export const ThirdPartyLogoWrapper: unknown;
}

declare module "@atlaskit/logo/dist/esm/utils/icon-wrapper" {
	export const IconWrapper: unknown;
}

declare module "@atlaskit/logo/dist/esm/utils/logo-wrapper" {
	export const LogoWrapper: unknown;
}

declare module "@atlaskit/logo/dist/esm/wrapper" {
	const Wrapper: unknown;
	export default Wrapper;
}
