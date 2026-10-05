"use client";

// oxlint-disable react-doctor/no-multi-comp -- This module intentionally colocates coupled component parts as a compound component or demo surface API.

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

import {
	DEFAULT_THEME_STORAGE_KEY,
	getStoredTheme,
	isTheme,
	type Theme,
} from "@/components/utils/theme-storage";
import { setGlobalTheme } from "@atlaskit/tokens/set-global-theme";
import DevicesIcon from "@atlaskit/icon/core/devices";
import ThemeIcon from "@atlaskit/icon/core/theme";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";


interface ThemeContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	actualTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeWrapperProps {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
}

const THEME_SYNC_MESSAGE_TYPE = "vpk:theme-sync";

const broadcastThemeToFrames = (theme: Theme) => {
	if (typeof document === "undefined") return;
	const message = { type: THEME_SYNC_MESSAGE_TYPE, theme };
	document.querySelectorAll("iframe").forEach((frame) => {
		try {
			frame.contentWindow?.postMessage(message, window.location.origin);
		} catch {
			// Cross-origin iframe — postMessage to a specific origin fails silently here.
		}
	});
};

const resolveActualTheme = (theme: Theme): "light" | "dark" => {
	if (theme === "system") {
		return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	}
	return theme;
};

export function ThemeWrapper({ children, defaultTheme = "light", storageKey = DEFAULT_THEME_STORAGE_KEY }: Readonly<ThemeWrapperProps>) {
	// Initial render must match the server, which always renders `defaultTheme`
	// (it has no access to localStorage). The stored theme is applied in the
	// effect below, once the component has mounted on the client.
	const [theme, setTheme] = useState<Theme>(defaultTheme);
	const [actualTheme, setActualTheme] = useState<"light" | "dark">(() => resolveActualTheme(defaultTheme));

	// Apply the stored theme preference after mount. Runs unconditionally (no
	// ref-gating) so React's dev-mode double-invoke of effects can't drop the
	// update — every invocation reads storage fresh and calls setTheme with the
	// same result.
	useEffect(() => {
		const storedTheme = getStoredTheme(storageKey);
		if (storedTheme) {
			setTheme(storedTheme);
		}
	}, [storageKey]);

	// Update actual theme based on current theme setting
	useEffect(() => {
		let unbind: (() => void) | undefined;

		const updateActualTheme = () => {
			const newActualTheme = resolveActualTheme(theme);
			setActualTheme(newActualTheme);

			// Update document class for Tailwind dark mode + color-scheme
			if (typeof document !== "undefined") {
				const root = document.documentElement;
				root.setAttribute("data-color-mode", newActualTheme);
				root.classList.remove("light", "dark");
				root.classList.add(newActualTheme);
				root.style.colorScheme = newActualTheme;
			}
		};

		updateActualTheme();
		void setGlobalTheme({
			colorMode: theme === "system" ? "auto" : theme,
			light: "light",
			dark: "dark",
			spacing: "spacing",
			typography: "typography",
			shape: "shape",
		}).then((nextUnbind) => {
			unbind = nextUnbind;
		});

		// Listen for system theme changes when in system mode
		if (theme === "system") {
			const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			mediaQuery.addEventListener("change", updateActualTheme);
			return () => {
				mediaQuery.removeEventListener("change", updateActualTheme);
				unbind?.();
			};
		}

		return () => {
			unbind?.();
		};
	}, [storageKey, theme]);

	// Sync theme across documents.
	// - `storage` event handles tab ↔ tab (different windows).
	// - `message` event handles parent ↔ iframe, where storage events are unreliable.
	useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== storageKey) return;
			if (event.newValue && isTheme(event.newValue)) {
				setTheme(event.newValue);
			}
		};

		const handleMessage = (event: MessageEvent) => {
			if (event.origin !== window.location.origin) return;
			const data = event.data as { type?: unknown; theme?: unknown } | null;
			if (data?.type === THEME_SYNC_MESSAGE_TYPE && typeof data.theme === "string" && isTheme(data.theme)) {
				setTheme(data.theme);
			}
		};

		window.addEventListener("storage", handleStorage);
		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("storage", handleStorage);
			window.removeEventListener("message", handleMessage);
		};
	}, [storageKey]);

	// Update theme and persist to localStorage
	const updateTheme = useCallback((newTheme: Theme) => {
		setTheme(newTheme);
		if (typeof window !== "undefined") {
			localStorage.setItem(storageKey, newTheme);
			broadcastThemeToFrames(newTheme);
		}
	}, [storageKey]);

	const value = useMemo<ThemeContextType>(() => ({
		theme,
		setTheme: updateTheme,
		actualTheme,
	}), [actualTheme, theme, updateTheme]);

	return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
	const context = use(ThemeContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeWrapper");
	}
	return context;
}

// Theme toggle component for easy integration
interface ThemeToggleProps {
	className?: string;
	label?: string;
	appearance?: "button" | "menu-item";
}

export function ThemeToggle({ className, label, appearance = "button" }: Readonly<ThemeToggleProps> = {}) {
	const { theme, setTheme } = useTheme();

	const handleToggle = () => {
		if (theme === "light") {
			setTheme("dark");
		} else if (theme === "dark") {
			setTheme("system");
		} else {
			setTheme("light");
		}
	};

	function getThemeLabel() {
		if (theme === "light") return "Light theme";
		if (theme === "dark") return "Dark theme";
		return "System theme";
	}

	const themeLabel = getThemeLabel();
	const accessibleLabel = label ? `${label}: ${themeLabel}` : themeLabel;
	const icon = theme === "system"
		? <DevicesIcon label="" />
		: <ThemeIcon label="" />;

	if (appearance === "menu-item") {
		return (
			<DropdownMenuItem
				aria-label={accessibleLabel}
				className={className}
				closeOnClick={false}
				elemAfter={icon}
				onSelect={handleToggle}
			>
				{label ?? themeLabel}
			</DropdownMenuItem>
		);
	}

	return (
		<Button
			aria-label={accessibleLabel}
			className={className}
			onClick={handleToggle}
			variant="ghost"
			size={label ? "default" : "icon"}
		>
			{label ? <span>{label}</span> : null}
			{icon}
		</Button>
	);
}

// Theme selector dropdown component
const themeOptions = [
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
	{ value: "system", label: "System" },
] as const;

export function ThemeSelector() {
	const { theme, setTheme } = useTheme();

	const selectedOption = themeOptions.find((opt) => opt.value === theme);

	return (
		<Select
			value={selectedOption?.value}
			onValueChange={(nextValue) => setTheme(nextValue as Theme)}
		>
			<SelectTrigger aria-label="Select theme">
				<SelectValue placeholder="Select theme" />
			</SelectTrigger>
			<SelectContent>
				{themeOptions.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
