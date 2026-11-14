"use client";

import { ShaderLabEffect } from "./shader-lab-effect-demo";
import { BLOB_TRACKING_LAYER } from "./shader-lab/layers/blob-tracking";

export default function BlobTrackingDemo() {
	return <ShaderLabEffect definition={BLOB_TRACKING_LAYER} />;
}
