import localFont from "next/font/local";

export const affigere = localFont({
	src: "../../../public/fonts/affigere/Affigere-Regular.woff2",
	display: "swap",
	// The catalog loader reaches every demo; preload only the site font globally.
	preload: false,
});

export const departureMono = localFont({
	src: "../../../public/fonts/DepartureMono/DepartureMono-Regular.woff2",
	display: "swap",
	// The catalog loader reaches every demo; preload only the site font globally.
	preload: false,
});
