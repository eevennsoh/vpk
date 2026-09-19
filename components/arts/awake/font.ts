import localFont from "next/font/local";

export const arkEsSolidLight = localFont({
	src: "../../../public/fonts/ark-es/ARK-ES-SolidLight.woff",
	display: "swap",
	// The catalog loader reaches every demo; preload only the site font globally.
	preload: false,
});
