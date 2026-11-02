import { FINALE_PALETTE_CSS } from "../data/finale-palette";

/** The finale's colour variables, once per document (React hoists and dedupes it into the head). */
export function FinalePaletteStyle() {
	return (
		<style href="finale-palette" precedence="default">
			{FINALE_PALETTE_CSS}
		</style>
	);
}
