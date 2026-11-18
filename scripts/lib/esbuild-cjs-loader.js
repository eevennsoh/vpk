const Module = require("node:module");
const path = require("node:path");

function loadCjsModuleFromText(sourceText, sourcefile = "esbuild-test-harness.cjs") {
	const filename = path.isAbsolute(sourcefile)
		? sourcefile
		: path.join(process.cwd(), sourcefile);
	// No parent: a parent keeps every compiled module in its `children`, so each bundle a test
	// evaluates (a rendered suite evaluates one per render) would stay alive for the whole run.
	const compiledModule = new Module(filename);
	compiledModule.filename = filename;
	compiledModule.paths = Module._nodeModulePaths(path.dirname(filename));
	compiledModule._compile(sourceText, filename);
	return compiledModule.exports;
}

module.exports = { loadCjsModuleFromText };
