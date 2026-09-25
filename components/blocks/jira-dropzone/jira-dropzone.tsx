"use client";

import { useCallback, useMemo, useRef, useState, type ReactElement, type ReactNode, type RefObject } from "react";
import { AnimatePresence, arc, motion, useIsPresent, useMotionValueEvent, useReducedMotion } from "motion/react";
import AddIcon from "@atlaskit/icon/core/add";

import { Icon } from "@/components/ui/icon";
import { useMagneticProximity } from "@/components/ui-custom/hooks/use-magnetic-proximity";
import type { MagneticPointerRelation } from "@/components/ui-custom/hooks/magnetic-proximity-model";
import { cn } from "@/lib/utils";

import { JiraDropzoneAntsStroke } from "./jira-dropzone-ants-stroke";
import { useJiraDropzoneChannel } from "./jira-dropzone-field";
import { JiraDropzoneFlight } from "./jira-dropzone-flight";
import { JIRA_DROPZONE_ANTS_CLASS } from "./lib/jira-dropzone-ants";
import {
	JIRA_DROPZONE_HOVER_AREA_PX,
	JIRA_DROPZONE_OPEN_HEIGHT_PX,
	JIRA_DROPZONE_WELL_ENTER,
	JIRA_DROPZONE_WELL_ENTER_REDUCED,
	JIRA_DROPZONE_WELL_EXIT,
	JIRA_DROPZONE_WELL_HIDDEN,
	JIRA_DROPZONE_WELL_VISIBLE,
	resolveJiraDropzoneArcOptions,
	resolveJiraDropzoneLandingPoint,
} from "./lib/jira-dropzone-motion";
import {
	resolveJiraDropzoneBounce,
	resolveJiraDropzoneCopy,
	resolveJiraDropzoneDrop,
	resolveJiraDropzonePhase,
	resolveJiraDropzoneSurface,
	shouldImpulseDropzoneChrome,
} from "./lib/jira-dropzone-receipts";
import type {
	FlightProfile,
	JiraDropzoneChannel,
	JiraDropzoneDragState,
	SessionFlight,
	ViewportPoint,
} from "./lib/jira-dropzone-types";

export const JIRA_DROPZONE_WELL_CHROME_CLASS = "rounded-lg border border-dashed";

export interface JiraDropzoneControlProps {
	active: boolean;
	children: ReactNode;
	className: string;
	label: string;
	minHeight: number;
	reducedMotion: boolean;
	selected: boolean;
}

export function JiraDropzone({
	ants = true,
	drag,
	exclusiveWinner = true,
	hoverArea = JIRA_DROPZONE_HOVER_AREA_PX,
	label,
	measuredRef,
	openMinHeight,
	pinVerticalMagnet = false,
	proximityRef,
	renderControl,
	renderResting,
	size = "default",
	title,
}: Readonly<{
	ants?: boolean;
	drag: JiraDropzoneDragState;
	exclusiveWinner?: boolean;
	/** Padding beyond the detection footprint; board hosts use a small approach margin. */
	hoverArea?: number;
	label: string;
	measuredRef?: RefObject<HTMLDivElement | null>;
	/** Available space used only in proximity or while receiving a drop. */
	openMinHeight?: number;
	/** Pin the surface vertically; the label retains its 4px lean on both axes. */
	pinVerticalMagnet?: boolean;
	/** Stable detection footprint, independent of the visible well's size. */
	proximityRef?: RefObject<HTMLDivElement | null>;
	/** A persistent button adapter shares one border across resting and drag states. */
	renderControl?: (props: JiraDropzoneControlProps) => ReactElement;
	renderResting: () => ReactElement;
	/** Compact matches a 24px create button; expanded targets retain h-16. */
	size?: "default" | "compact";
	title: string;
}>): ReactElement {
	const localRef = useRef<HTMLDivElement>(null);
	const targetRef = measuredRef ?? localRef;
	const { channel, onLanded, profile, receiving } = useJiraDropzoneChannel(title);
	const magnet = useMagneticProximity(proximityRef ?? targetRef, {
		distance: 8,
		hoverArea,
		labelRatio: 0.5, // The label travels 4px: half of the surface's 8px lean.
	});
	const [rawProximity, setRawProximity] = useState<MagneticPointerRelation>("outside");
	useMotionValueEvent(magnet.proximity, "change", setRawProximity);
	const proximity = exclusiveWinner ? rawProximity : "outside";
	const phase = resolveJiraDropzonePhase({
		drag,
		proximate: proximity !== "outside",
		receiving,
	});
	const surface = resolveJiraDropzoneSurface(phase, false);
	const copy = resolveJiraDropzoneCopy(phase);
	const flyPath = useMemo(
		() => arc(resolveJiraDropzoneArcOptions(profile)),
		[profile],
	);
	const resolveLandingPoint = useCallback((): ViewportPoint | null => {
		const rect = targetRef.current?.getBoundingClientRect();
		return rect ? resolveJiraDropzoneLandingPoint(rect) : null;
	}, [targetRef]);

	const expanded = phase === "receiving" || proximity !== "outside";
	const selected = phase === "armed" || phase === "receiving";
	const drop = resolveJiraDropzoneDrop(channel?.lastReceipt);
	const bouncePlayback = resolveJiraDropzoneBounce(channel?.lastReceipt);
	const collapsingWithoutBounce = phase === "resting" && bouncePlayback === "off";
	const pinMagnet = receiving || !exclusiveWinner || collapsingWithoutBounce;
	const bounce = shouldImpulseDropzoneChrome({
		bounce: bouncePlayback,
		impacts: channel?.impacts ?? 0,
		receiving,
	})
		? profile.impact
		: null;

	const openSurface = (
		<JiraDropzoneOpenSurface
			key="open"
			active={surface === "open"}
			ants={ants}
			bounce={bounce}
			bouncePlayback={bouncePlayback}
			channel={channel}
			copy={copy}
			drop={drop}
			expanded={expanded}
			exclusiveWinner={exclusiveWinner}
			flyPath={flyPath}
			label={label}
			magnet={magnet}
			onLanded={onLanded}
			openMinHeight={openMinHeight}
			phase={phase}
			pinMagnet={pinMagnet}
			pinVerticalMagnet={pinVerticalMagnet}
			profile={profile}
			proximity={proximity}
			receiving={receiving}
			renderControl={renderControl}
			resolveLandingPoint={resolveLandingPoint}
			selected={selected}
			size={size}
			title={title}
		/>
	);

	return (
		<div className="grid w-full items-end" ref={targetRef}>
			{renderControl ? openSurface : <AnimatePresence initial={false}>
				{surface === "open" ? (
					openSurface
				) : (
					<div className="col-start-1 row-start-1 w-full" key="resting">
						{renderResting()}
					</div>
				)}
			</AnimatePresence>}
		</div>
	);
}

type JiraDropzoneOpenSurfaceProps = Readonly<{
	active: boolean;
	ants: boolean;
	bounce: FlightProfile["impact"];
	bouncePlayback: ReturnType<typeof resolveJiraDropzoneBounce>;
	channel: JiraDropzoneChannel | undefined;
	copy: ReturnType<typeof resolveJiraDropzoneCopy>;
	drop: ReturnType<typeof resolveJiraDropzoneDrop>;
	expanded: boolean;
	exclusiveWinner: boolean;
	flyPath: ReturnType<typeof arc>;
	label: string;
	magnet: ReturnType<typeof useMagneticProximity>;
	onLanded: (key: SessionFlight["key"]) => void;
	openMinHeight?: number;
	phase: ReturnType<typeof resolveJiraDropzonePhase>;
	pinMagnet: boolean;
	pinVerticalMagnet: boolean;
	profile: FlightProfile;
	proximity: MagneticPointerRelation;
	receiving: boolean;
	renderControl?: (props: JiraDropzoneControlProps) => ReactElement;
	resolveLandingPoint: () => ViewportPoint | null;
	selected: boolean;
	size: "default" | "compact";
	title: string;
}>;

function JiraDropzoneOpenSurface({
	active,
	ants,
	bounce,
	bouncePlayback,
	channel,
	copy,
	drop,
	expanded,
	exclusiveWinner,
	flyPath,
	label,
	magnet,
	onLanded,
	openMinHeight,
	phase,
	pinMagnet,
	pinVerticalMagnet,
	profile,
	proximity,
	receiving,
	renderControl,
	resolveLandingPoint,
	selected,
	size,
	title,
}: JiraDropzoneOpenSurfaceProps): ReactElement {
	const impacts = channel?.impacts ?? 0;

	return (
		<>
			<JiraDropzoneWell
				active={active}
				ants={ants}
				bounce={bounce}
				bouncePlayback={bouncePlayback}
				copy={copy}
				drop={drop}
				expanded={active && expanded}
				exclusiveWinner={exclusiveWinner}
				impacts={impacts}
				label={label}
				magnet={magnet}
				openMinHeight={openMinHeight}
				phase={phase}
				pinMagnet={pinMagnet || !active}
				pinVerticalMagnet={pinVerticalMagnet}
				proximity={proximity}
				receiving={receiving}
				renderControl={renderControl}
				selected={selected}
				size={size}
				title={title}
			/>
			{channel ? channel.flights.map((flight) => (
				<JiraDropzoneFlight
					flyPath={flyPath}
					flight={flight}
					key={flight.key}
					onLanded={onLanded}
					profile={profile}
					resolveLandingPoint={resolveLandingPoint}
				/>
			)) : null}
		</>
	);
}

type JiraDropzoneWellProps = Pick<
	JiraDropzoneOpenSurfaceProps,
	| "active"
	| "ants"
	| "bouncePlayback"
	| "copy"
	| "drop"
	| "expanded"
	| "exclusiveWinner"
	| "label"
	| "magnet"
	| "openMinHeight"
	| "phase"
	| "pinMagnet"
	| "pinVerticalMagnet"
	| "proximity"
	| "receiving"
	| "renderControl"
	| "selected"
	| "size"
	| "title"
> & {
	bounce: FlightProfile["impact"];
	impacts: number;
};

function JiraDropzoneWell({
	active,
	ants,
	bounce,
	bouncePlayback,
	copy,
	drop,
	expanded,
	exclusiveWinner,
	impacts,
	label,
	magnet,
	openMinHeight,
	phase,
	pinMagnet,
	pinVerticalMagnet,
	proximity,
	receiving,
	renderControl,
	selected,
	size,
	title,
}: JiraDropzoneWellProps): ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const isPresent = useIsPresent();
	const hidden = !isPresent || undefined;
	const dropTargetAttributes = isPresent && active ? {
		"data-armed": selected || undefined,
		"data-board-agent-session-create-work-item-drop-zone": title,
		"data-board-agent-session-drop-zone": "create",
	} : {};
	const marching = active && ants && !shouldReduceMotion;
	return (
		<motion.div
			animate={JIRA_DROPZONE_WELL_VISIBLE}
			aria-hidden={hidden}
			className={cn("col-start-1 row-start-1 w-full", !isPresent ? "pointer-events-none" : null)}
			data-jira-dropzone-column={title}
			data-jira-dropzone-presence={isPresent ? "present" : "exiting"}
			data-jira-dropzone-well={active ? "" : undefined}
			exit={{
				...(shouldReduceMotion ? { opacity: 0, transform: "translateY(0px)" } : JIRA_DROPZONE_WELL_HIDDEN),
				transition: shouldReduceMotion ? JIRA_DROPZONE_WELL_ENTER_REDUCED : JIRA_DROPZONE_WELL_EXIT,
			}}
			initial={shouldReduceMotion || renderControl
				? false
				: JIRA_DROPZONE_WELL_HIDDEN}
			inert={hidden}
			transition={shouldReduceMotion
				? JIRA_DROPZONE_WELL_ENTER_REDUCED
				: JIRA_DROPZONE_WELL_ENTER}
		>
			<motion.div className="w-full will-change-transform" style={{
				x: pinMagnet ? 0 : magnet.x,
				y: pinMagnet || pinVerticalMagnet ? 0 : magnet.y,
			}}>
				<div
					aria-label={renderControl ? undefined : `${label} in ${title}${selected ? ", selected drop target" : ""}`}
					className="relative w-full overflow-visible"
					{...dropTargetAttributes}
					data-board-agent-session-column-title={title}
					data-exclusive-winner={exclusiveWinner || undefined}
					data-jira-dropzone-ants={ants ? "on" : "off"}
					data-jira-dropzone-collapsing={phase === "resting" || undefined}
					data-jira-dropzone-copy={copy}
					data-jira-dropzone-bounce={bouncePlayback}
					data-jira-dropzone-drop={drop}
					data-jira-dropzone-impacts={String(impacts)}
					data-proximity={proximity}
					data-receiving={receiving || undefined}
					role={renderControl ? undefined : "img"}
				>
					{renderControl ? (
						<JiraDropzoneButtonChrome
							active={active}
							copy={copy}
							expanded={expanded && phase !== "resting"}
							label={label}
							magnet={magnet}
							marching={marching}
							openMinHeight={openMinHeight}
							pinMagnet={pinMagnet}
							pinVerticalMagnet={pinVerticalMagnet}
							renderControl={renderControl}
							selected={selected}
						/>
					) : <JiraDropzoneWellChrome
						bounce={bounce}
						copy={copy}
						expanded={expanded}
						impacts={impacts}
						label={label}
						magnet={magnet}
						openMinHeight={openMinHeight}
						marching={marching}
						phase={phase}
						pinMagnet={pinMagnet}
						pinVerticalMagnet={pinVerticalMagnet}
						selected={selected}
						size={size}
					/>}
				</div>
			</motion.div>
		</motion.div>
	);
}

type JiraDropzoneWellChromeProps = Pick<
	JiraDropzoneWellProps,
	| "bounce"
	| "copy"
	| "expanded"
	| "impacts"
	| "label"
	| "magnet"
	| "openMinHeight"
	| "phase"
	| "pinMagnet"
	| "pinVerticalMagnet"
	| "selected"
	| "size"
> & {
	marching: boolean;
};

function JiraDropzoneButtonChrome({
	active,
	copy,
	expanded,
	label,
	magnet,
	marching,
	openMinHeight,
	pinMagnet,
	pinVerticalMagnet,
	renderControl,
	selected,
}: Readonly<Pick<JiraDropzoneWellProps,
	"active" | "copy" | "expanded" | "label" | "magnet" | "openMinHeight" | "pinMagnet" | "pinVerticalMagnet" | "selected"
> & {
	marching: boolean;
	renderControl: (props: JiraDropzoneControlProps) => ReactElement;
}>): ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const showLabel = active && copy === "label";
	const copyTransition = shouldReduceMotion ? JIRA_DROPZONE_WELL_ENTER_REDUCED : JIRA_DROPZONE_WELL_ENTER;
	return renderControl({
		active,
		className: cn(
			"relative w-full overflow-hidden transition-colors duration-normal ease-out-practical motion-reduce:transition-none",
			JIRA_DROPZONE_WELL_CHROME_CLASS,
			active ? "bg-surface hover:bg-surface active:bg-surface disabled:opacity-100" : null,
			selected ? "border-border-selected bg-bg-selected hover:bg-bg-selected active:bg-bg-selected text-text-selected" : null,
			marching ? JIRA_DROPZONE_ANTS_CLASS : null,
		),
		label,
		minHeight: expanded ? Math.max(JIRA_DROPZONE_OPEN_HEIGHT_PX, openMinHeight ?? 0) : active ? 32 : 0,
		reducedMotion: Boolean(shouldReduceMotion),
		selected,
		children: <>
			{marching ? <JiraDropzoneAntsStroke selected={selected} /> : null}
			<span
				className="relative grid h-5 w-full place-items-center"
			>
				{/* Both visual layers share one centered slot and the height animation's clock. */}
				<span
					aria-hidden
					className="col-start-1 row-start-1 grid w-full place-items-center"
					data-jira-dropzone-copy-motion={showLabel ? "label" : "add"}
				>
					<motion.span
						animate={{ opacity: showLabel ? 0 : 1 }}
						className="col-start-1 row-start-1 inline-flex items-center justify-center"
						data-jira-dropzone-copy-layer="add"
						initial={false}
						transition={copyTransition}
					>
						<Icon render={<AddIcon label="" size="small" />} />
					</motion.span>
					<motion.span
						animate={{ opacity: showLabel ? 1 : 0 }}
						className="col-start-1 row-start-1 inline-flex w-full items-center justify-center"
						data-jira-dropzone-copy-layer="label"
						initial={false}
						transition={copyTransition}
					>
						<motion.span
							className={cn("inline-block will-change-transform", selected ? "text-text-selected" : null)}
							style={{ x: pinMagnet ? 0 : magnet.labelX, y: pinMagnet || pinVerticalMagnet ? 0 : magnet.labelY }}
						>{label}</motion.span>
					</motion.span>
				</span>
			</span>
		</>,
	});
}

function JiraDropzoneWellChrome({
	bounce,
	copy,
	expanded,
	impacts,
	label,
	magnet,
	openMinHeight,
	marching,
	phase,
	pinMagnet,
	pinVerticalMagnet,
	selected,
	size,
}: JiraDropzoneWellChromeProps): ReactElement {
	return (
		<motion.div
			animate={{ x: 0, y: 0 }}
			className={cn(
				"flex w-full select-none items-center justify-center px-3 text-center font-medium will-change-transform",
				expanded ? "h-16 text-sm leading-5" : "h-8 text-sm leading-5",
				phase === "resting" ? "h-8 text-sm leading-5" : null,
				size === "compact" && (!expanded || phase === "resting") ? "h-6" : null,
				JIRA_DROPZONE_WELL_CHROME_CLASS,
				// Colour is the only transitional feedback here. The h-8 -> h-16
				// swap lands instantly: `height` is a layout property, and
				// `.agents/rules/motion-decisions.md` limits transitions to fade,
				// slide, scale, and colour. The spatial cue is already carried by
				// the magnet/bounce transform and the marching-ants stroke.
				"transition-[background-color,border-color] duration-normal ease-out-practical motion-reduce:transition-none",
				selected
					? "border-border-selected bg-bg-selected text-text-selected"
					: "border-border bg-surface text-text-subtlest",
				marching ? JIRA_DROPZONE_ANTS_CLASS : null,
			)}
			initial={bounce
				? { x: bounce.impulseXPx, y: bounce.impulseYPx }
				: { x: 0, y: 0 }}
			key={impacts}
			style={{ minHeight: expanded && phase !== "resting" ? openMinHeight : undefined }}
			transition={bounce
				? { damping: bounce.damping, stiffness: bounce.stiffness, type: "spring" }
				: { duration: 0 }}
		>
			{marching ? <JiraDropzoneAntsStroke selected={selected} /> : null}
			<JiraDropzoneWellCopy
				copy={copy}
				label={label}
				magnet={magnet}
				pinMagnet={pinMagnet}
				pinVerticalMagnet={pinVerticalMagnet}
			/>
		</motion.div>
	);
}

function JiraDropzoneWellCopy({
	copy,
	label,
	magnet,
	pinMagnet,
	pinVerticalMagnet,
}: Pick<JiraDropzoneWellProps, "copy" | "label" | "magnet" | "pinMagnet" | "pinVerticalMagnet">): ReactElement {
	return copy === "label" ? (
		<motion.span
			className="inline-block will-change-transform"
			style={{
				x: pinMagnet ? 0 : magnet.labelX,
				y: pinMagnet || pinVerticalMagnet ? 0 : magnet.labelY,
			}}
		>
			{label}
		</motion.span>
	) : (
		<Icon
			className="text-icon-subtlest"
			render={<AddIcon label="" size="small" />}
		/>
	);
}
