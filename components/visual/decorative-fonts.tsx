/* eslint-disable @next/next/no-page-custom-font -- Display fonts are deliberately scoped to their art/demo consumers through React stylesheet resources. */

/** React hoists and deduplicates this stylesheet for its actual consumers. */
export function DecorativeFonts() {
	return (
		// oxlint-disable-next-line react-doctor/nextjs-no-css-link -- These optional display fonts retain their authored Google font families and load only on surfaces that use them.
		<link
			rel="stylesheet"
			href="https://fonts.googleapis.com/css2?family=BBH+Bartle&family=Bitcount+Grid+Single:wght@100..900&family=DotGothic16&family=JetBrains+Mono:wght@400;500;600&display=swap"
			precedence="decorative-fonts"
			crossOrigin="anonymous"
		/>
	);
}
