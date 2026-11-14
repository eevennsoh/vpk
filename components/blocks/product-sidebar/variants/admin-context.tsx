"use client";

// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props once before user edits take ownership.

import {
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

const ADMIN_ROVO_CHAT_STORAGE_KEY = "vpk-admin-rovo-chat-enabled";

export interface AdminState {
	selectedItem: string;
	rovoChatEnabled: boolean;
}

export interface AdminActions {
	setSelectedItem: (item: string) => void;
	setRovoChatEnabled: (enabled: boolean) => void;
}

interface AdminContextValue {
	state: AdminState;
	actions: AdminActions;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: Readonly<{ children: ReactNode }>) {
	const [selectedItem, setSelectedItem] = useState("Overview");
	const [rovoChatEnabled, setRovoChatEnabledState] = useState(false);

	useEffect(() => {
		const savedRovoChatEnabled = window.localStorage.getItem(ADMIN_ROVO_CHAT_STORAGE_KEY);
		if (savedRovoChatEnabled !== null) {
			setRovoChatEnabledState(savedRovoChatEnabled === "true");
		}
	}, []);

	const setRovoChatEnabled = useCallback((enabled: boolean) => {
		setRovoChatEnabledState(enabled);
		window.localStorage.setItem(ADMIN_ROVO_CHAT_STORAGE_KEY, String(enabled));
	}, []);

	const state = useMemo(
		() => ({ selectedItem, rovoChatEnabled }),
		[selectedItem, rovoChatEnabled],
	);
	const actions = useMemo(
		() => ({ setSelectedItem, setRovoChatEnabled }),
		[setSelectedItem, setRovoChatEnabled],
	);
	const value = useMemo(() => ({ state, actions }), [state, actions]);

	return <AdminContext value={value}>{children}</AdminContext>;
}

function useAdminContext(): AdminContextValue {
	const context = use(AdminContext);
	if (context === null) {
		throw new Error("useAdmin must be used within an AdminProvider");
	}

	return context;
}

export function useAdminState(): AdminState {
	return useAdminContext().state;
}

export function useAdminActions(): AdminActions {
	return useAdminContext().actions;
}

export function useAdmin(): AdminState & AdminActions {
	const { state, actions } = useAdminContext();
	return { ...state, ...actions };
}
