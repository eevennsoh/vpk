/**
 * Every Shader Lab layer definition, keyed by layer type. Only the server-only visual details
 * page and its tests may import the whole set (`verify:lazy-load` single-owner rule); a demo
 * imports its own `./layers` module so its chunk carries one layer.
 */
import type {
	ShaderLabEffectDefinition,
	ShaderLabRuntimeEffectType,
	ShaderLabRuntimeLayerType,
	ShaderLabRuntimeSourceType,
} from "./types";
import { BLOB_TRACKING_LAYER } from "./layers/blob-tracking";
import { BLOOM_LAYER } from "./layers/bloom";
import { CHROMATIC_ABERRATION_LAYER } from "./layers/chromatic-aberration";
import { CIRCUIT_BENT_LAYER } from "./layers/circuit-bent";
import { CRT_LAYER } from "./layers/crt";
import { CUSTOM_SHADER_LAYER } from "./layers/custom-shader";
import { DIRECTIONAL_BLUR_LAYER } from "./layers/directional-blur";
import { DISPLACEMENT_MAP_LAYER } from "./layers/displacement-map";
import { EDGE_DETECT_LAYER } from "./layers/edge-detect";
import { FLUID_LAYER } from "./layers/fluid";
import { FLUTED_GLASS_LAYER } from "./layers/fluted-glass";
import { HALFTONE_LAYER } from "./layers/halftone";
import { INK_LAYER } from "./layers/ink";
import { MAGNIFY_LENS_LAYER } from "./layers/magnify-lens";
import { MESH_GRADIENT_LAYER } from "./layers/mesh-gradient";
import { PARTICLE_GRID_LAYER } from "./layers/particle-grid";
import { PATTERN_LAYER } from "./layers/pattern";
import { PIXELATION_LAYER } from "./layers/pixelation";
import { PIXEL_SORTING_LAYER } from "./layers/pixel-sorting";
import { PIXEL_TRAIL_LAYER } from "./layers/pixel-trail";
import { PLOTTER_LAYER } from "./layers/plotter";
import { POSTERIZE_LAYER } from "./layers/posterize";
import { SLICE_LAYER } from "./layers/slice";
import { SMEAR_LAYER } from "./layers/smear";
import { THRESHOLD_LAYER } from "./layers/threshold";
import { VOXEL_LAYER } from "./layers/voxel";

export const SHADER_LAB_EFFECT_DEFINITIONS = {
	"blob-tracking": BLOB_TRACKING_LAYER,
	"bloom": BLOOM_LAYER,
	"circuit-bent": CIRCUIT_BENT_LAYER,
	"directional-blur": DIRECTIONAL_BLUR_LAYER,
	"chromatic-aberration": CHROMATIC_ABERRATION_LAYER,
	"crt": CRT_LAYER,
	"displacement-map": DISPLACEMENT_MAP_LAYER,
	"edge-detect": EDGE_DETECT_LAYER,
	"fluted-glass": FLUTED_GLASS_LAYER,
	"halftone": HALFTONE_LAYER,
	"ink": INK_LAYER,
	"particle-grid": PARTICLE_GRID_LAYER,
	"pattern": PATTERN_LAYER,
	"pixelation": PIXELATION_LAYER,
	"pixel-sorting": PIXEL_SORTING_LAYER,
	"plotter": PLOTTER_LAYER,
	"posterize": POSTERIZE_LAYER,
	"slice": SLICE_LAYER,
	"smear": SMEAR_LAYER,
	"threshold": THRESHOLD_LAYER,
	"voxel": VOXEL_LAYER
} as const satisfies Record<ShaderLabRuntimeEffectType, ShaderLabEffectDefinition>;

export const SHADER_LAB_SOURCE_DEFINITIONS = {
	"fluid": FLUID_LAYER,
	"pixel-trail": PIXEL_TRAIL_LAYER,
	"magnify-lens": MAGNIFY_LENS_LAYER,
	"mesh-gradient": MESH_GRADIENT_LAYER,
	"custom-shader": CUSTOM_SHADER_LAYER,
} as const satisfies Record<ShaderLabRuntimeSourceType, ShaderLabEffectDefinition>;

export const SHADER_LAB_LAYER_DEFINITIONS = {
	...SHADER_LAB_EFFECT_DEFINITIONS,
	...SHADER_LAB_SOURCE_DEFINITIONS,
} as const satisfies Record<ShaderLabRuntimeLayerType, ShaderLabEffectDefinition>;
