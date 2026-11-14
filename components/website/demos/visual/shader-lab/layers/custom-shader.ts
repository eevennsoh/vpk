import type { ShaderLabEffectDefinition } from "../types";

const SHADER_LAB_CUSTOM_SHADER_STARTER = `export const sketch = Fn(() => {
  const uv0 = screenAspectUV(screenSize)
  const color = vec3(
    uv0.x.add(0.5),
    uv0.y.add(0.5),
    sin(time).mul(0.5).add(0.5)
  ).toVar()

  color.assign(technicolorTonemap(color))

  return color
})
`;

export const CUSTOM_SHADER_LAYER = {
	type: "custom-shader",
	kind: "source",
	label: "Custom Shader",
	description: "Shader Lab custom shader source layer that compiles pasted TSL code with source/effect mode, entry export, source file name, and revision controls.",
	params: [
		{ key: "effectMode", label: "Effect Mode", type: "boolean", defaultValue: false, group: "Code" },
		{ key: "sourceMode", label: "Source Mode", type: "select", defaultValue: "paste", group: "Code", options: [
			{ label: "Paste", value: "paste" },
			{ label: "File", value: "file" },
		] },
		{ key: "sourceCode", label: "Source Code", type: "text", defaultValue: SHADER_LAB_CUSTOM_SHADER_STARTER, group: "Code" },
		{ key: "sourceFileName", label: "Source File", type: "text", defaultValue: "", group: "Code" },
		{ key: "entryExport", label: "Entry Export", type: "text", defaultValue: "sketch", group: "Code" },
		{ key: "sourceRevision", label: "Source Revision", type: "number", defaultValue: 0, min: 0, max: Number.MAX_SAFE_INTEGER, step: 1, group: "Code" },
	],
} as const satisfies ShaderLabEffectDefinition;
