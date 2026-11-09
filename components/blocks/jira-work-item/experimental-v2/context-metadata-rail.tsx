"use client";

import {
	createContext,
	use,
	useCallback,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";

import type { ActivityRailChrome } from "@/components/blocks/jira-work-item/experimental-v2/components/activity-panel";
import type { MetadataRailView } from "@/components/blocks/jira-work-item/experimental-v2/lib/metadata-rail-view";

/** One-shot request to expand a PR artifact-pane section (e.g. CI checks). */
export interface PullRequestSectionExpandRequest {
	nonce: number;
	pullRequestIdentity: string;
	sectionId: string;
}

/** One-shot request to show Activity and scroll to a feed entry. */
export interface ActivityRevealRequest {
	nonce: number;
	/**
	 * When set, scroll this entry into view (e.g. Claude Code card header on
	 * Build). Otherwise scroll to the newest feed row.
	 */
	entryId?: string;
}

interface MetadataRailContextValue {
	panelView: MetadataRailView;
	activePanelView: MetadataRailView;
	setPanelView: (view: MetadataRailView) => void;
	activityChrome: ActivityRailChrome | null;
	setActivityChrome: (chrome: ActivityRailChrome | null) => void;
	/** Latest request to expand a pull-request details-rail section. */
	pullRequestSectionExpandRequest: PullRequestSectionExpandRequest | null;
	/** Ask one PR details rail to open a collapsible section. */
	requestExpandPullRequestSection: (pullRequestIdentity: string, sectionId: string) => void;
	/** Acknowledge a handled request without clearing a newer request. */
	consumePullRequestSectionExpandRequest: (nonce: number) => void;
	/** Latest request to open Activity and scroll to a feed entry. */
	activityRevealRequest: ActivityRevealRequest | null;
	/**
	 * Switch to Activity and ask the feed to scroll. Omit `entryId` to target
	 * the newest row; pass one to anchor a specific entry (e.g. agent card).
	 */
	requestRevealLatestActivity: (entryId?: string) => void;
	/** Acknowledge a handled activity reveal without clearing a newer request. */
	consumeActivityRevealRequest: (nonce: number) => void;
	/**
	 * When true, `revealActivityKey` changes do not auto-switch the panel to
	 * Activity (e.g. while a pull-request detail is open). Manual tab changes
	 * and explicit `requestRevealLatestActivity` calls are unchanged.
	 */
	setSuppressActivityPanelReveal: (suppressed: boolean) => void;
}

const MetadataRailContext = createContext<MetadataRailContextValue | null>(null);

interface MetadataRailProviderProps {
	children: ReactNode;
	/**
	 * When this key changes to a non-null value, open Activity and scroll to the
	 * latest entry (e.g. jira-golden-journey-v2 Plan orchestration reveal), or to
	 * `revealActivityEntryId` when that prop is set.
	 */
	revealActivityKey?: string | number | null;
	/**
	 * Optional Activity entry id to scroll into view when `revealActivityKey`
	 * changes (e.g. `activity-story-session-claude-code` on Build).
	 */
	revealActivityEntryId?: string | null;
}

/**
 * View-state owner for the metadata rail's Details / Activity tabs and the
 * Activity chrome published onto the MetadataRailToggle row.
 *
 * Shared between `MetadataRailToggle` (toggle UI), `MetadataRail` (panel body),
 * and pull-request detail surfaces that need to expand rail sections (e.g. CI
 * checks from the header "Checks running" primary).
 */
export function MetadataRailProvider({
	children,
	revealActivityKey = null,
	revealActivityEntryId = null,
}: Readonly<MetadataRailProviderProps>) {
	const [panelView, setPanelView] = useState<MetadataRailView>("details");
	const [activityChrome, setActivityChrome] = useState<ActivityRailChrome | null>(null);
	const [pullRequestSectionExpandRequest, setPullRequestSectionExpandRequest] =
		useState<PullRequestSectionExpandRequest | null>(null);
	const [activityRevealRequest, setActivityRevealRequest] =
		useState<ActivityRevealRequest | null>(null);
	// Ref so reveal-key handling can skip panel switches without re-subscribing
	// when PR detail opens/closes mid-staging. Written only from event handlers.
	const suppressActivityPanelRevealRef = useRef(false);
	const requestExpandPullRequestSection = useCallback((pullRequestIdentity: string, sectionId: string) => {
		setPullRequestSectionExpandRequest((current) => ({
			nonce: (current?.nonce ?? 0) + 1,
			pullRequestIdentity,
			sectionId,
		}));
	}, []);
	const consumePullRequestSectionExpandRequest = useCallback((nonce: number) => {
		setPullRequestSectionExpandRequest((current) => current?.nonce === nonce ? null : current);
	}, []);
	const requestRevealLatestActivity = useCallback((entryId?: string) => {
		setPanelView("activity");
		setActivityRevealRequest((current) => ({
			nonce: (current?.nonce ?? 0) + 1,
			...(entryId ? { entryId } : {}),
		}));
	}, []);
	const consumeActivityRevealRequest = useCallback((nonce: number) => {
		setActivityRevealRequest((current) => current?.nonce === nonce ? null : current);
	}, []);
	const [suppressActivityPanelReveal, setSuppressActivityPanelRevealState] = useState(false);
	const setSuppressActivityPanelReveal = useCallback((suppressed: boolean) => {
		suppressActivityPanelRevealRef.current = suppressed;
		setSuppressActivityPanelRevealState(suppressed);
	}, []);
	// Chapter/orchestration keys open Activity during render so the panel does not
	// flash Details. Track the previous key in state (not a ref) so render stays pure.
	const [trackedRevealActivityKey, setTrackedRevealActivityKey] = useState<
		string | number | null | undefined
	>(revealActivityKey);
	if (!Object.is(trackedRevealActivityKey, revealActivityKey)) {
		setTrackedRevealActivityKey(revealActivityKey);
		if (revealActivityKey != null && revealActivityKey !== "" && !suppressActivityPanelReveal) {
			setPanelView("activity");
			setActivityRevealRequest((current) => ({
				nonce: (current?.nonce ?? 0) + 1,
				...(revealActivityEntryId ? { entryId: revealActivityEntryId } : {}),
			}));
		}
	}
	const value = useMemo<MetadataRailContextValue>(
		() => ({
			activePanelView: panelView,
			activityChrome,
			activityRevealRequest,
			consumeActivityRevealRequest,
			consumePullRequestSectionExpandRequest,
			panelView,
			pullRequestSectionExpandRequest,
			requestExpandPullRequestSection,
			requestRevealLatestActivity,
			setActivityChrome,
			setPanelView,
			setSuppressActivityPanelReveal,
		}),
		[
			activityChrome,
			activityRevealRequest,
			consumeActivityRevealRequest,
			consumePullRequestSectionExpandRequest,
			panelView,
			pullRequestSectionExpandRequest,
			requestExpandPullRequestSection,
			requestRevealLatestActivity,
			setSuppressActivityPanelReveal,
		],
	);

	return <MetadataRailContext value={value}>{children}</MetadataRailContext>;
}

export function useMetadataRail(): MetadataRailContextValue {
	const context = use(MetadataRailContext);
	if (context === null) {
		throw new Error("useMetadataRail must be used within a MetadataRailProvider");
	}
	return context;
}
