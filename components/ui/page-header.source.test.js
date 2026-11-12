const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

const PAGE_HEADER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui/page-header.tsx"),
	"utf8",
)
const PAGE_HEADER_DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/website/demos/ui/page-header-demo.tsx"),
	"utf8",
)
const PAGE_HEADER_DETAIL_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app/data/details/ui/page-header.ts"),
	"utf8",
)

test("page header fills flex-based demo containers without squashing its content", () => {
	assert.match(PAGE_HEADER_SOURCE, /className=\{cn\("w-full min-w-0", className\)\}/u)
	assert.match(PAGE_HEADER_SOURCE, /className="flex min-w-0 items-start"/u)
	assert.match(PAGE_HEADER_SOURCE, /className="mb-2 min-w-0 flex-1 space-y-1"/u)
})

test("page header keeps ADS heading, action, and bottom-bar geometry", () => {
	assert.match(PAGE_HEADER_SOURCE, /token\("font\.heading\.large"\)/u)
	assert.match(PAGE_HEADER_SOURCE, /className="mb-2 flex max-w-full shrink-0 items-center gap-1 pl-8"/u)
	assert.match(PAGE_HEADER_SOURCE, /bottomBar \? <div className="mt-4">\{bottomBar\}<\/div> : null/u)
})

test("page header docs use VPK primitives for the ADS-shaped examples", () => {
	assert.match(PAGE_HEADER_DEMO_SOURCE, /<Breadcrumb(?:\s|>)/u)
	assert.match(PAGE_HEADER_DEMO_SOURCE, /<ButtonGroup variant="separated"/u)
	assert.match(PAGE_HEADER_DEMO_SOURCE, /bottomBar=\{/u)
	assert.doesNotMatch(PAGE_HEADER_DEMO_SOURCE, /<nav/u)
	assert.match(PAGE_HEADER_DETAIL_SOURCE, /adsUrl: "https:\/\/atlassian\.design\/components\/page-header"/u)
})
