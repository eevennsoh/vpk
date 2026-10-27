// hairline/runtime/styles — stands in for vendored core/styles.ts inside the bundle. The stylesheet is not
// injected at run time: hairline/inline.mjs writes it once per page as <style data-vpk-hairline-css>, with the
// five-colour palette mapped onto vpk tokens, so inject() has nothing left to do.
export function inject() {}
