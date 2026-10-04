/**
 * The one way Playwright specs find the app under test. Precedence, first match wins:
 *
 * 1. `PLAYWRIGHT_BASE_URL` — explicit override for CI, automation, or a remote target.
 * 2. This worktree's Portless URL for the port recorded in `.dev-frontend-port`.
 * 3. `http://127.0.0.1:<port>` from that same `.dev-frontend-port`.
 *
 * Anything else throws with the fix. There is deliberately no hardcoded port or
 * hostname fallback: in a worktree that silently tests the main checkout's (or
 * another worktree's) server. Steps 2–3 match `resolveOrigin()` in
 * `.agents/skills/vpk-verify/scripts/lib/origin.js`, i.e. what `control-vpk url` prints.
 *
 * Imports stay relative so `node --test tests/helpers/origin.test.ts` can load
 * this file without the `@/` resolver.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { findPortlessUrl, loadPortlessRoutes } from "../../scripts/lib/portless-routes.js";

export const APP_ORIGIN_ENV = "PLAYWRIGHT_BASE_URL";
export const FRONTEND_PORT_FILE = ".dev-frontend-port";

export type AppOriginOptions = Readonly<{
	env?: Readonly<Record<string, string | undefined>>;
	/** Worktree root that owns `.dev-frontend-port`; defaults to the nearest `package.json` at or above the cwd. */
	repoRoot?: string;
	/** Portless route table; defaults to `~/.portless/routes.json`. */
	routes?: Parameters<typeof findPortlessUrl>[0];
}>;

function findRepoRoot(start: string): string {
	for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
		if (existsSync(path.join(dir, "package.json"))) return dir;
		if (path.dirname(dir) === dir) return path.resolve(start);
	}
}

function readFrontendPort(file: string): string {
	try {
		return readFileSync(file, "utf8").trim();
	} catch {
		return "";
	}
}

/** Origin (no trailing slash) of the app under test. Throws instead of guessing. */
export function resolveAppOrigin({
	env = process.env,
	repoRoot = findRepoRoot(process.cwd()),
	routes,
}: AppOriginOptions = {}): string {
	const override = env[APP_ORIGIN_ENV]?.trim();
	if (override) {
		if (!URL.canParse(override)) {
			throw new Error(`${APP_ORIGIN_ENV}="${override}" is not an absolute URL (for example https://<worktree>.localhost).`);
		}
		return override.replace(/\/+$/u, "");
	}

	const portFile = path.join(repoRoot, FRONTEND_PORT_FILE);
	const port = readFrontendPort(portFile);
	if (!port) {
		throw new Error(
			`No app origin for ${repoRoot}: ${FRONTEND_PORT_FILE} is missing or empty. `
				+ `Start this worktree's dev server (pnpm run dev:tmux:start), or set ${APP_ORIGIN_ENV} to the origin under test.`,
		);
	}
	if (!/^\d+$/u.test(port)) {
		throw new Error(
			`${portFile} holds "${port}", not a port. `
				+ `Restart this worktree's dev server (pnpm run dev:tmux:start), or set ${APP_ORIGIN_ENV}.`,
		);
	}
	return findPortlessUrl(routes ?? loadPortlessRoutes(), port) ?? `http://127.0.0.1:${port}`;
}

/** Absolute URL for a root-relative app route: `appUrl("/jira-team-eu26")`. */
export function appUrl(route: string, options?: AppOriginOptions): string {
	if (!route.startsWith("/")) {
		throw new Error(`appUrl expects a root-relative route such as "/jira-team-eu26", got "${route}".`);
	}
	return `${resolveAppOrigin(options)}${route}`;
}
