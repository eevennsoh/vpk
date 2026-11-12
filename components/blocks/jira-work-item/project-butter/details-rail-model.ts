import { clamp } from "@/lib/utils";

export const DETAILS_DEFAULT_WIDTH_PX = 420;
export const DETAILS_MIN_WIDTH_PX = 280;
export const DETAILS_MAX_WIDTH_PX = 640;
/** The description column always keeps this much room, however wide the rail is dragged. */
const MAIN_COLUMN_MIN_WIDTH_PX = 480;

/** The widest the Details rail may grow inside a layout of `layoutWidth`, never below its own minimum. */
export function projectButterDetailsMaxWidth(layoutWidth: number): number {
	return clamp(layoutWidth - MAIN_COLUMN_MIN_WIDTH_PX, DETAILS_MIN_WIDTH_PX, DETAILS_MAX_WIDTH_PX);
}
