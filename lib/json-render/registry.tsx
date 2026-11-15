"use client";

import { defineRegistry } from "@json-render/react";
import { getByPath, setByPath } from "@json-render/core";
import { catalog } from "./catalog";
import { layoutComponents } from "./registry-layout";
import { dataDisplayComponents } from "./registry-data-display";
import { compoundComponents } from "./registry-compound";
import { chartComponents } from "./registry-charts";
import { interactiveComponents } from "./registry-interactive";
import { threeDComponents } from "./registry-3d";
import { cloneStateModel } from "./registry-values";

// ── Registry ───────────────────────────────────────────────────
// Each component group lives in its own registry-*.tsx module; defineRegistry
// checks that together they cover every component the catalog declares.

export const { registry } = defineRegistry(catalog, {
	components: {
		...layoutComponents,
		...dataDisplayComponents,
		...compoundComponents,
		...chartComponents,
		...interactiveComponents,
		...threeDComponents,
	},
	actions: {
		push: async (params, setState) => {
			if (!params) return;
			setState((prev) => {
				const currentScreenValue = getByPath(prev, "/currentScreen");
				const currentScreen = typeof currentScreenValue === "string" ? currentScreenValue : "";
				const navStackValue = getByPath(prev, "/navStack");
				const navStack = Array.isArray(navStackValue) ? navStackValue : [];
				const next = cloneStateModel(prev);
				setByPath(next, "/navStack", [...navStack, currentScreen]);
				setByPath(next, "/currentScreen", params.screen);
				return next;
			});
		},
		pop: async (_params, setState) => {
			setState((prev) => {
				const navStackValue = getByPath(prev, "/navStack");
				if (!Array.isArray(navStackValue) || navStackValue.length === 0) {
					return prev;
				}

				const next = cloneStateModel(prev);
				const previousScreen = navStackValue[navStackValue.length - 1];
				setByPath(next, "/navStack", navStackValue.slice(0, -1));
				setByPath(next, "/currentScreen", typeof previousScreen === "string" ? previousScreen : "");
				return next;
			});
		},
	},
});
