import type { NextConfig } from "next";

import packageMetadata from "./package.json";

const projectRoot = process.cwd();
const projectName = packageMetadata.name.replace(/^@[^/]+\//, "");

const nextConfig: NextConfig = {
	devIndicators: false,
	allowedDevOrigins: [
		// control-vpk and Playwright fall back to the IPv4 loopback when Portless is off;
		// without it Next blocks dev chunks and the page never hydrates.
		"127.0.0.1",
		`${projectName}.localhost`,
		`*.${projectName}.localhost`,
		// Atlas Tunnel public hosts are ephemeral (`<id>.public.atlastunnel.com`).
		"*.public.atlastunnel.com",
		"*.atlastunnel.com",
	],
	...(process.env.NODE_ENV === "development" && {
		env: {
			NEXT_PUBLIC_VPK_REPO_ROOT: projectRoot,
		},
	}),

	experimental: {
		// VPK typechecks with native TypeScript 7, while Next uses the official
		// TypeScript 6 compatibility API for tsconfig paths and plugin support.
		useTypeScriptCli: false,
		// Rewrite named barrel imports to deep paths at build time so only the
		// used symbols ship to the client. recharts (~86 files) and the motion
		// package (~175 files) are NOT in Next's default optimizePackageImports
		// list (the older framer-motion was); date-fns benefits too. Preserves
		// types and autocomplete with zero source changes.
		optimizePackageImports: ["recharts", "motion/react", "date-fns"],
	},

	turbopack: {
		// 16.3 Turbopack memory eviction is default-on; disable with experimental.turbopackMemoryEviction: false if it regresses.
		// Prevent Turbopack from inferring the wrong workspace root.
		root: projectRoot,
	},

	images: {
		unoptimized: true,
	},

	// Static export for production deployment
	// Enabled when NEXT_OUTPUT=export is set (during Docker build)
	...(process.env.NEXT_OUTPUT === "export" && {
		output: "export",
	}),
};

export default nextConfig;
