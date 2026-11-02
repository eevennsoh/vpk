import { motionDuration, motionEase } from "@/lib/motion";

/** Shared by the field rows and the filling bar so they move as one rail. Linear because Accept all chains steps back to back; an eased step would brake at every row. */
export const DETAILS_RAIL_GLIDE = { layout: { duration: motionDuration.slower, ease: motionEase.linear } } as const;
