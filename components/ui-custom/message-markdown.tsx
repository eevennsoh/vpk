"use client";

import type { ComponentProps, ComponentType, MouseEvent } from "react";
import { lazy, memo, Suspense, use, useState } from "react";

import type { MessageResponseProps } from "./message-markdown-runtime";
import { cn } from "@/lib/utils";

export type { MessageResponseProps } from "./message-markdown-runtime";

type MarkdownRuntime = Pick<typeof import("./message-markdown-runtime"), "MessageResponse" | "streamdownComponents">;

// The Streamdown runtime with its plugins (math with KaTeX, mermaid, code, CJK) is about 1.2 MB,
// so it loads with the first message that renders instead of with every route that can show
// one. A route whose page is messages (Rovo, Studio) imports the runtime statically instead; the
// runtime registers itself when it evaluates, so messages there render without a lazy boundary.
// A failed load is forgotten, so the next render retries it.
let loadedRuntime: MarkdownRuntime | null = null;
let runtimeLoad: Promise<MarkdownRuntime> | null = null;

export function registerMessageMarkdownRuntime(runtime: MarkdownRuntime) {
	loadedRuntime = runtime;
	runtimeLoad ??= Promise.resolve(runtime);
}

export function preloadMessageMarkdown(): Promise<MarkdownRuntime> {
	runtimeLoad ??= import("./message-markdown-runtime").then(
		(runtime) => {
			loadedRuntime = runtime;
			return runtime;
		},
		(error: unknown) => {
			runtimeLoad = null;
			throw error;
		},
	);
	return runtimeLoad;
}

const LazyMessageResponse = lazy(() => preloadMessageMarkdown().then((runtime) => ({ default: runtime.MessageResponse })));

// While the runtime loads, the message keeps its box with the text laid out but not shown, so
// raw markdown never flashes and the content does not jump when the formatted text lands.
function MessageResponsePending({ children, className, plain }: Readonly<Pick<MessageResponseProps, "children" | "className" | "plain">>) {
	return (
		<div
			aria-busy="true"
			className={cn(!plain && "typeset typeset-chat", "invisible size-full whitespace-pre-wrap", className)}
			data-message-markdown="pending"
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
	return (
		<Suspense fallback={<MessageResponsePending className={props.className} plain={props.plain}>{props.children}</MessageResponsePending>}>
			<LazyMessageResponse {...props} />
		</Suspense>
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
		const runtime = loadedRuntime ?? use(preloadMessageMarkdown());
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
