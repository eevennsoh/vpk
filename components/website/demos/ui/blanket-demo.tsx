"use client"

import { useState } from "react"
import { Blanket } from "@/components/ui/blanket"
import { Button } from "@/components/ui/button"

export default function BlanketDemo() {
	const [visible, setVisible] = useState(false)

	return (
		<>
			<Button variant="outline" onClick={() => setVisible(true)}>
				Show blanket
			</Button>
			{visible ? <Blanket onClick={() => setVisible(false)}>
					<div className="flex h-full items-center justify-center">
						<div className="bg-surface flex flex-col gap-3 rounded-lg p-6 shadow-lg">
							<p className="text-text">Click outside to dismiss</p>
							<Button onClick={() => setVisible(false)}>Close</Button>
						</div>
					</div>
				</Blanket> : null}
		</>
	)
}

export function BlanketDemoDefault() {
	const [visible, setVisible] = useState(false)

	return (
		<>
			<Button variant="outline" onClick={() => setVisible(true)}>
				Show tinted blanket
			</Button>
			{visible ? <Blanket onClick={() => setVisible(false)} /> : null}
		</>
	)
}

export function BlanketDemoTransparent() {
	const [visible, setVisible] = useState(false)

	return (
		<>
			<Button variant="outline" onClick={() => setVisible(true)}>
				Show transparent blanket
			</Button>
			{visible ? <Blanket isTinted={false} onClick={() => setVisible(false)} /> : null}
		</>
	)
}

export function BlanketDemoWithContent() {
	const [visible, setVisible] = useState(false)

	return (
		<>
			<Button variant="outline" onClick={() => setVisible(true)}>
				Show blanket with content
			</Button>
			{visible ? <Blanket onClick={() => setVisible(false)}>
					<div className="flex h-full items-center justify-center">
						<div className="bg-surface rounded-lg border border-border p-6">
							<p className="text-text text-sm">Content on top of the blanket</p>
						</div>
					</div>
				</Blanket> : null}
		</>
	)
}
