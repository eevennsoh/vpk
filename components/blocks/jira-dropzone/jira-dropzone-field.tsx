"use client";

import {
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactElement,
	type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";

import { resolveFlightProfile } from "./lib/jira-dropzone-motion";
import {
	JIRA_DROPZONE_FIELD_INITIAL_STATE,
	classifyReceipt,
	isReceiving,
	jiraDropzoneFieldReducer,
	settlingChannelTitles,
} from "./lib/jira-dropzone-receipts";
import type {
	FlightProfile,
	JiraDropzoneChannel,
	JiraDropzoneFieldEvent,
	JiraDropzoneFieldState,
	JiraDropzoneReceiveOutcome,
	SessionDropReceipt,
	SessionFlightKey,
} from "./lib/jira-dropzone-types";

interface JiraDropzoneFieldContextValue {
	readonly dispatch: (event: JiraDropzoneFieldEvent) => void;
	readonly profile: FlightProfile;
	readonly receive: (receipt: SessionDropReceipt) => JiraDropzoneReceiveOutcome;
	readonly state: JiraDropzoneFieldState;
}

const JiraDropzoneFieldContext = createContext<JiraDropzoneFieldContextValue | null>(null);

export function JiraDropzoneField({
	children,
	profile: profileOverride,
}: Readonly<{
	children: ReactNode;
	profile?: Partial<FlightProfile>;
}>): ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const profile = useMemo(
		() => resolveFlightProfile(shouldReduceMotion, profileOverride),
		[profileOverride, shouldReduceMotion],
	);
	const [state, setState] = useState(JIRA_DROPZONE_FIELD_INITIAL_STATE);
	const stateRef = useRef(state);

	const dispatch = useCallback((event: JiraDropzoneFieldEvent) => {
		const next = jiraDropzoneFieldReducer(stateRef.current, event);
		stateRef.current = next;
		setState(next);
	}, []);

	const receive = useCallback((receipt: SessionDropReceipt) => {
		const outcome = classifyReceipt(stateRef.current, receipt);
		if (outcome === "accepted") {
			dispatch({ kind: "receive", profile, receipt });
		}
		return outcome;
	}, [dispatch, profile]);

	const settlingKey = JSON.stringify(settlingChannelTitles(state));

	useEffect(() => {
		const titles = JSON.parse(settlingKey) as string[];
		if (titles.length === 0) {
			return;
		}
		const timers = titles.map((title) => (
			window.setTimeout(() => {
				dispatch({ kind: "settle", title });
			}, profile.settleHoldMs)
		));
		return () => {
			for (const timer of timers) {
				window.clearTimeout(timer);
			}
		};
	}, [dispatch, profile.settleHoldMs, settlingKey]);

	const value = useMemo(
		() => ({ dispatch, profile, receive, state }),
		[dispatch, profile, receive, state],
	);

	const announcement = latestAnnouncement(state);

	return (
		<JiraDropzoneFieldContext value={value}>
			{children}
			<div aria-live="polite" className="sr-only" role="status">
				{announcement}
			</div>
		</JiraDropzoneFieldContext>
	);
}

export function useJiraDropzoneReceive(): (receipt: SessionDropReceipt) => JiraDropzoneReceiveOutcome {
	return useJiraDropzoneField().receive;
}

/** Read playback without registering a second owner for the target channel. */
export function useJiraDropzoneReceiving(title: string | undefined): boolean {
	const context = use(JiraDropzoneFieldContext);
	return context && title !== undefined ? isReceiving(context.state.channels.get(title)) : false;
}

export function useJiraDropzoneField(): JiraDropzoneFieldContextValue {
	const context = use(JiraDropzoneFieldContext);
	if (!context) {
		throw new Error("JiraDropzone components must render inside JiraDropzoneField");
	}
	return context;
}

export function useJiraDropzoneChannel(title: string): {
	channel: JiraDropzoneChannel | undefined;
	onLanded: (flightKey: SessionFlightKey) => void;
	profile: FlightProfile;
	receiving: boolean;
} {
	const { dispatch, profile, state } = useJiraDropzoneField();

	useEffect(() => {
		dispatch({ kind: "register", title });
		return () => {
			dispatch({ kind: "unregister", title });
		};
	}, [dispatch, title]);

	const channel = state.channels.get(title);

	const onLanded = useCallback((flightKey: SessionFlightKey) => {
		dispatch({ flightKey, kind: "land", title });
	}, [dispatch, title]);

	return {
		channel,
		onLanded,
		profile,
		receiving: isReceiving(channel),
	};
}

function latestAnnouncement(state: JiraDropzoneFieldState): string {
	const latest = state.latestReceipt;
	if (!latest) {
		return "";
	}
	const count = latest.members.length;
	const noun = count === 1 ? "session" : "sessions";
	return `${count} ${noun} received in ${latest.title}`;
}
