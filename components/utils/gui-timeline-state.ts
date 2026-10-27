import {
	createDialTimeline,
	DialStore,
	type DialTimelineController,
	type DialTimelineValues,
	type TimelineConfig,
	type CreateDialTimelineOptions,
} from "dialkit/vanilla";

export type GUITimelineConfig = TimelineConfig;
export type GUITimelineOptions = Readonly<Pick<CreateDialTimelineOptions, "autoplay" | "loop">>;
export type GUITimelineValues<T extends GUITimelineConfig> = DialTimelineValues<T> & Readonly<{
	id: string;
	reset: () => void;
	setValue: (path: string, value: number) => void;
}>;

export function createGUITimelineState<T extends GUITimelineConfig>() {
	let controller: DialTimelineController<T> | null = null;
	let snapshot: GUITimelineValues<T> | null = null;
	let configKey = "";
	let reducedMotion = false;
	let publishing = false;
	const listeners = new Set<() => void>();
	const notify = () => listeners.forEach((listener) => listener());

	const publish = (provided?: DialTimelineValues<T>) => {
		if (!controller || publishing) return;
		publishing = true;
		let values = provided ?? controller.getValues();
		if (reducedMotion && values.playing) {
			controller.pause();
			controller.seek(values.duration);
			values = controller.getValues();
		}
		snapshot = { ...values, id: controller.id, ...actions };
		publishing = false;
		notify();
	};

	const settle = () => {
		if (!controller) return;
		publishing = true;
		controller.pause();
		controller.seek(controller.getValues().duration);
		publishing = false;
		publish();
	};

	const actions = {
		play() {
			if (reducedMotion) settle();
			else controller?.play();
		},
		pause() {
			controller?.pause();
		},
		replay() {
			if (reducedMotion) settle();
			else controller?.replay();
		},
		seek(time: number) {
			controller?.seek(time);
		},
		reset() {
			if (!controller) return;
			publishing = true;
			controller.pause();
			DialStore.resetValues(controller.id);
			controller.seek(reducedMotion ? controller.getValues().duration : 0);
			publishing = false;
			publish();
		},
		setValue(path: string, value: number) {
			if (controller && Number.isFinite(value)) DialStore.updateValue(controller.id, path, value);
		},
	};

	return {
		getSnapshot: () => snapshot,
		getServerSnapshot: () => null,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		mount(name: string, config: T, options: GUITimelineOptions, reduce: boolean) {
			reducedMotion = reduce;
			configKey = JSON.stringify(config);
			const mounted = createDialTimeline(name, config, { ...options, autoplay: options.autoplay === true && !reduce });
			controller = mounted;
			const unsubscribe = mounted.subscribe(publish, false);
			if (reduce) settle();
			else publish();
			return () => {
				if (controller !== mounted) return;
				controller = null;
				snapshot = null;
				unsubscribe();
				mounted.destroy();
				notify();
			};
		},
		updateConfig(config: T) {
			const nextKey = JSON.stringify(config);
			if (!controller || nextKey === configKey) return;
			configKey = nextKey;
			controller.updateConfig(config);
			if (reducedMotion) settle();
		},
		setReducedMotion(reduce: boolean) {
			if (reduce === reducedMotion) return;
			reducedMotion = reduce;
			if (reduce) settle();
		},
	};
}
