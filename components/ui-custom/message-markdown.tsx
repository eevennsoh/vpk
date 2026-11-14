"use client";

import type { ComponentProps, ComponentType, MouseEvent, ReactNode } from "react";
import { Component, memo, Suspense, use, useState } from "react";

import type { MessageResponseProps } from "./message-markdown-runtime";
import { cn } from "@/lib/utils";

export type { MessageResponseProps } from "./message-markdown-runtime";

type MarkdownRuntime = Pick<typeof import("./message-markdown-runtime"), "MessageResponse" | "streamdownComponents">;

// The Streamdown runtime with its plugins (math with KaTeX, mermaid, code, CJK) is about 1.2 MB,
// so it loads with the first message that renders instead of with every route that can show
// one. A route whose page is messages (Rovo, Studio) imports the runtime statically instead; the
// runtime registers itself when it evaluates, so messages there render without a lazy boundary.
let loadedRuntime: MarkdownRuntime | null = null;
let runtimeLoad: Promise<MarkdownRuntime> | null = null;
let runtimeLoadFailed = false;

class MessageMarkdownLoadError extends Error {}

export function registerMessageMarkdownRuntime(runtime: MarkdownRuntime) {
	loadedRuntime = runtime;
	runtimeLoad = Promise.resolve(runtime);
	runtimeLoadFailed = false;
}

function loadRuntime(): Promise<MarkdownRuntime> {
	runtimeLoad ??= import("./message-markdown-runtime").then(
		(runtime) => {
			loadedRuntime = runtime;
			return runtime;
		},
		(error: unknown) => {
			runtimeLoadFailed = true;
			throw new MessageMarkdownLoadError("The message markdown runtime failed to load", { cause: error });
		},
	);
	return runtimeLoad;
}

// A failed load stays cached until a message has shown its fallback for it: React re-renders a
// suspended message before committing, and a fresh import on each of those would refetch a failing
// chunk in a loop. After that, the next render that needs the runtime loads it again.
function forgetFailedRuntimeLoad() {
	if (runtimeLoadFailed) {
		runtimeLoad = null;
		runtimeLoadFailed = false;
	}
}

// For user intent that predicts a reply (opening a chat, typing); retries a load that failed.
export function preloadMessageMarkdown(): Promise<MarkdownRuntime> {
	forgetFailedRuntimeLoad();
	return loadRuntime();
}

function DeferredMessageResponse(props: Readonly<MessageResponseProps>) {
	// Always through use(): skipping it once the runtime has loaded would change the hooks a
	// suspended render called.
	const RuntimeMessageResponse = use(loadRuntime()).MessageResponse;
	return <RuntimeMessageResponse {...props} />;
}

type LoadBoundaryProps = Readonly<{ children: ReactNode; fallback: ReactNode; retryKey: unknown }>;

// Catches only a failed runtime load: the message shows its text unformatted, and the next render
// with new props (the next streamed chunk, for one) tries the load again. Render errors from the
// runtime itself go on to the boundaries above, as they do when the runtime is imported directly.
class MessageMarkdownLoadBoundary extends Component<LoadBoundaryProps, { error: unknown }> {
	state = { error: null as unknown };

	static getDerivedStateFromError(error: unknown) {
		return { error };
	}

	componentDidCatch() {
		forgetFailedRuntimeLoad();
	}

	componentDidUpdate(previous: LoadBoundaryProps) {
		if (this.state.error !== null && previous.retryKey !== this.props.retryKey) {
			this.setState({ error: null });
		}
	}

	render() {
		if (this.state.error === null) {
			return this.props.children;
		}
		if (!(this.state.error instanceof MessageMarkdownLoadError)) {
			throw this.state.error;
		}
		return this.props.fallback;
	}
}

// While the runtime loads, the message keeps its box with the text laid out but not shown, so
// raw markdown never flashes and the content does not jump when the formatted text lands. If the
// load failed, the text is shown as it is rather than not at all.
function MessageResponsePlainText({ children, className, plain, state }: Readonly<Pick<MessageResponseProps, "children" | "className" | "plain"> & { state: "pending" | "unavailable" }>) {
	return (
		<div
			aria-busy={state === "pending" ? "true" : undefined}
			className={cn(!plain && "typeset typeset-chat", state === "pending" && "invisible", "size-full whitespace-pre-wrap", className)}
			data-message-markdown={state}
		>
			{typeof children === "string" ? children : null}
		</div>
	);
}

export const MessageResponse = memo(function MessageResponse(props: Readonly<MessageResponseProps>) {
	// Decided once per instance: an instance never switches from the lazy path to the direct one,
	// which would remount a streaming message.
	const [runtimeAtMount] = useState(() => loadedRuntime);
	if (runtimeAtMount) {
		const RuntimeMessageResponse = runtimeAtMount.MessageResponse;
		return <RuntimeMessageResponse {...props} />;
	}
	const plainText = (state: "pending" | "unavailable") => (
		<MessageResponsePlainText className={props.className} plain={props.plain} state={state}>{props.children}</MessageResponsePlainText>
	);
	// `props` is a new object exactly when this memoized component re-renders with new props.
	return (
		<MessageMarkdownLoadBoundary fallback={plainText("unavailable")} retryKey={props}>
			<Suspense fallback={plainText("pending")}>
				<DeferredMessageResponse {...props} />
			</Suspense>
		</MessageMarkdownLoadBoundary>
	);
});

// Streamdown renders these only inside a MessageResponse (or another Streamdown), so the
// runtime is already loaded when they render; each forwards to the runtime's component of the
// same name. The keys must match the runtime's map (message-markdown.behavior.test.js).
const STREAMDOWN_COMPONENT_NAMES = [
	"a", "code", "inlineCode", "p", "pre", "img",
	"h1", "h2", "h3", "h4", "h5", "h6",
	"ul", "ol", "li", "blockquote", "hr",
	"table", "thead", "tbody", "tr", "th", "td",
] as const;

type StreamdownComponentName = (typeof STREAMDOWN_COMPONENT_NAMES)[number];
type StreamdownComponentMap = MarkdownRuntime["streamdownComponents"];

function createStreamdownComponentProxy<Name extends StreamdownComponentName>(name: Name): StreamdownComponentMap[Name] {
	function StreamdownComponentProxy(props: Record<string, unknown>) {
		const runtime = loadedRuntime ?? use(loadRuntime());
		const Component = runtime.streamdownComponents[name] as ComponentType<Record<string, unknown>>;
		return <Component {...props} />;
	}
	StreamdownComponentProxy.displayName = `StreamdownComponent(${name})`;
	return StreamdownComponentProxy as unknown as StreamdownComponentMap[Name];
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This module intentionally exports colocated non-component API used by consumers.
export const streamdownComponents = Object.fromEntries(
	STREAMDOWN_COMPONENT_NAMES.map((name) => [name, createStreamdownComponentProxy(name)]),
) as unknown as StreamdownComponentMap;

type MarkdownAnchorProps = ComponentProps<"a"> & { node?: unknown };

// Links in chat markdown. Kept outside the runtime: it needs nothing from Streamdown, and canvas
// links ("#rovo-canvas-<id>") open the artifact through a window event.
export function MarkdownAnchor({
	href,
	onClick,
	node,
	className,
	...props
}: Readonly<MarkdownAnchorProps>) {
	void node;
	// Drop Streamdown's baked-in `text-primary underline` utilities and own ADS
	// text-link chrome here (blue, no underline until hover). Also backed by
	// nested `.typeset-chat & a` rules in globals.css.
	void className;
	const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
		onClick?.(event);
		if (event.defaultPrevented || typeof href !== "string") {
			return;
		}

		const prefix = "#rovo-canvas-";
		if (!href.startsWith(prefix)) {
			return;
		}

		event.preventDefault();
		let documentId: string;
		try {
			documentId = decodeURIComponent(href.slice(prefix.length));
		} catch {
			documentId = href.slice(prefix.length);
		}

		window.dispatchEvent(new CustomEvent("rovo:open-canvas-artifact", {
			cancelable: true,
			detail: {
				documentId,
			},
		}));
	};

	return (
		<a
			aria-label={typeof props.children === "string" ? props.children : href}
			className="text-link no-underline hover:underline active:text-link-pressed"
			{...props}
			href={href}
			onClick={handleClick}
		/>
	);
}
