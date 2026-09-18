"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, type ReactElement } from "react";
import { arc } from "motion/react";

import { JiraDropzoneFlight } from "@/components/blocks/jira-dropzone/jira-dropzone-flight";

import {
	flightsFromLinkingDrop,
	JIRA_LINKING_FULL_DROP_PROFILE,
	resolveJiraLinkingArcOptions,
	type JiraLinkingDrop,
	type JiraLinkingFlightKey,
	type JiraLinkingPoint,
} from "./drop";
import type { JiraLinkingTarget } from "./lifecycle";

export function JiraLinkingDropFlights({
	drop,
	onSettled,
	resolveTarget,
	target,
}: Readonly<{
	drop: JiraLinkingDrop;
	onSettled?: () => void;
	resolveTarget?: () => JiraLinkingTarget | null;
	target: JiraLinkingTarget | null;
}>): ReactElement | null {
	const profile = JIRA_LINKING_FULL_DROP_PROFILE;
	const flights = useMemo(
		() => flightsFromLinkingDrop(drop, profile),
		[drop, profile],
	);
	const flyPath = useMemo(
		() => arc(resolveJiraLinkingArcOptions(profile)),
		[profile],
	);
	const landing = target?.anchor ?? null;
	const resolveLandingPoint = useCallback(
		(): JiraLinkingPoint | null => resolveTarget ? resolveTarget()?.anchor ?? null : landing,
		[landing, resolveTarget],
	);
	const landedRef = useRef(new Set<JiraLinkingFlightKey>());
	const settledRef = useRef(false);

	useLayoutEffect(() => {
		landedRef.current = new Set();
		settledRef.current = false;
	}, [flights]);

	const onLanded = useCallback((key: JiraLinkingFlightKey) => {
		if (landedRef.current.has(key)) {
			return;
		}
		landedRef.current.add(key);
		if (landedRef.current.size < flights.length || settledRef.current) {
			return;
		}
		settledRef.current = true;
		onSettled?.();
	}, [flights.length, onSettled]);

	if (flights.length === 0) {
		return null;
	}

	return (
		<>
			{flights.map((flight) => (
				<JiraDropzoneFlight
					flyPath={flyPath}
					flight={flight}
					key={flight.key}
					kind="link"
					onLanded={onLanded}
					profile={profile}
					resolveLandingPoint={resolveLandingPoint}
				/>
			))}
		</>
	);
}
