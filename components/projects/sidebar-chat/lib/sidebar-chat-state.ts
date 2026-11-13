import type { StudioScreenAssistantRegion } from "@/components/projects/rovo-core/lib/screen-assistant";

interface DictationPresentationState {
	isActive: boolean;
	transcriptPreview: string | null;
}

interface ScreenAssistantRegionState {
	painting: boolean;
	region: StudioScreenAssistantRegion | null;
}

type ScreenAssistantRegionAction =
	| { type: "reset" }
	| { type: "set-painting"; painting: boolean }
	| { type: "set-region"; region: StudioScreenAssistantRegion | null };

type DictationPresentationAction =
	| { type: "preview"; transcript: string | null }
	| { type: "start" }
	| { type: "stop" };

export function subscribeToUserActivation(onActivation: (event: Event) => void): () => void {
	const options: AddEventListenerOptions = { capture: true };
	window.addEventListener("pointerdown", onActivation, options);
	window.addEventListener("keydown", onActivation, options);
	window.addEventListener("touchstart", onActivation, options);
	return () => {
		window.removeEventListener("pointerdown", onActivation, options);
		window.removeEventListener("keydown", onActivation, options);
		window.removeEventListener("touchstart", onActivation, options);
	};
}

export function reduceScreenAssistantRegion(
	state: ScreenAssistantRegionState,
	action: ScreenAssistantRegionAction,
): ScreenAssistantRegionState {
	switch (action.type) {
		case "reset":
			if (!state.painting && state.region === null) return state;
			return { painting: false, region: null };
		case "set-painting":
			if (state.painting === action.painting) return state;
			return { ...state, painting: action.painting };
		case "set-region":
			if (state.region === action.region) return state;
			return { ...state, region: action.region };
		default:
			return state;
	}
}

export function reduceDictationPresentation(
	state: DictationPresentationState,
	action: DictationPresentationAction,
): DictationPresentationState {
	switch (action.type) {
		case "preview":
			if (state.transcriptPreview === action.transcript) return state;
			return { ...state, transcriptPreview: action.transcript };
		case "start":
			if (state.isActive && state.transcriptPreview === null) return state;
			return { isActive: true, transcriptPreview: null };
		case "stop":
			if (!state.isActive && state.transcriptPreview === null) return state;
			return { isActive: false, transcriptPreview: null };
		default:
			return state;
	}
}
