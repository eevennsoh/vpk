// The Streamdown math plugin renders KaTeX markup but leaves its stylesheet to the host
// (`getStyles()` only names it). Importing the plugin from here brings the stylesheet with
// it, so only routes that can render math load KaTeX CSS.
import "katex/dist/katex.min.css";

export { math } from "@streamdown/math";
