"use client";

import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lozenge } from "@/components/ui/lozenge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ADMIN_ICONS } from "@/components/blocks/product-sidebar/data/admin-navigation";
import { ADMIN_AUDIT_LOGS, type AdminAuditStatus } from "../data/admin-data";
import { AdminCard, AdminPageShell, AdminViewHeader } from "./view-primitives";

const STATUS_OPTIONS = [
	{ label: "All statuses", value: "all" },
	{ label: "Success", value: "success" },
	{ label: "Failure", value: "failure" },
	{ label: "Warning", value: "warning" },
] as const;

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "UTC",
});

export function AuditLogView() {
	const [actionFilter, setActionFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [userFilter, setUserFilter] = useState("");
	const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());

	const actionOptions = useMemo(() => {
		const actions = Array.from(new Set(ADMIN_AUDIT_LOGS.map((log) => log.action))).sort();
		return [{ label: "All actions", value: "all" }, ...actions.map((action) => ({ label: action, value: action }))];
	}, []);

	const filteredLogs = useMemo(() => {
		return ADMIN_AUDIT_LOGS.filter((log) => {
			if (actionFilter !== "all" && log.action !== actionFilter) {
				return false;
			}
			if (statusFilter !== "all" && log.status !== statusFilter) {
				return false;
			}
			if (userFilter.trim() && !log.user.toLowerCase().includes(userFilter.trim().toLowerCase())) {
				return false;
			}
			return true;
		});
	}, [actionFilter, statusFilter, userFilter]);

	function toggleRow(id: number) {
		setExpandedRows((previousRows) => {
			const nextRows = new Set(previousRows);
			if (nextRows.has(id)) {
				nextRows.delete(id);
			} else {
				nextRows.add(id);
			}
			return nextRows;
		});
	}

	return (
		<AdminPageShell>
			<AdminViewHeader
				title="Audit log"
				description="Track all administrative actions and system events across your organization."
			/>

			<AdminCard>
				<CardContent className="grid gap-4 md:grid-cols-3">
					<FilterSelect
						label="Action"
						value={actionFilter}
						options={actionOptions}
						onValueChange={setActionFilter}
					/>
					<FilterSelect
						label="Status"
						value={statusFilter}
						options={STATUS_OPTIONS}
						onValueChange={setStatusFilter}
					/>
					<label className="flex flex-col gap-1 text-xs font-semibold text-text">
						User
						<Input
							autoComplete="off"
							isCompact
							name="audit-log-user-filter"
							placeholder="Filter by email…"
							spellCheck={false}
							type="search"
							value={userFilter}
							onChange={(event) => setUserFilter(event.currentTarget.value)}
						/>
					</label>
				</CardContent>
			</AdminCard>

			<AdminCard>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-10" />
								<TableHead>Timestamp</TableHead>
								<TableHead>User</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Resource</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredLogs.map((log) => {
								const isExpanded = expandedRows.has(log.id);
								return (
									<Fragment key={log.id}>
										<TableRow>
											<TableCell>
												<Button
													aria-label={isExpanded ? `Collapse ${log.action}` : `Expand ${log.action}`}
													aria-expanded={isExpanded}
													size="icon"
													variant="ghost"
													onClick={() => toggleRow(log.id)}
												>
													{isExpanded ? (
														<ADMIN_ICONS.chevronDown label="" />
													) : (
														<ADMIN_ICONS.chevronRight label="" />
													)}
												</Button>
											</TableCell>
											<TableCell>{formatTimestamp(log.timestamp)}</TableCell>
											<TableCell>{log.user}</TableCell>
											<TableCell>{log.action}</TableCell>
											<TableCell>{log.resource}</TableCell>
											<TableCell>
												<StatusLozenge status={log.status} />
											</TableCell>
										</TableRow>
										{isExpanded ? (
											<TableRow>
												<TableCell colSpan={6} className="bg-surface-sunken">
													<div className="flex flex-col gap-1 whitespace-normal text-sm text-text-subtle">
														<span><strong>Details:</strong> {log.details}</span>
														<span><strong>IP address:</strong> {log.ipAddress}</span>
														<span><strong>Full timestamp:</strong> {log.timestamp}</span>
													</div>
												</TableCell>
											</TableRow>
										) : null}
									</Fragment>
								);
							})}
							{filteredLogs.length === 0 ? (
								<TableRow>
									<TableCell colSpan={6} className="py-10 text-center text-sm text-text-subtlest">
										No audit logs match the current filters.
									</TableCell>
								</TableRow>
							) : null}
						</TableBody>
					</Table>
				</CardContent>
			</AdminCard>
		</AdminPageShell>
	);
}

function FilterSelect({
	label,
	value,
	options,
	onValueChange,
}: Readonly<{
	label: string;
	value: string;
	options: ReadonlyArray<{ label: string; value: string }>;
	onValueChange: (value: string) => void;
}>) {
	return (
		<label className="flex flex-col gap-1 text-xs font-semibold text-text">
			{label}
			<Select value={value} onValueChange={(nextValue) => onValueChange(nextValue ?? "all")}>
				<SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</label>
	);
}

function StatusLozenge({ status }: Readonly<{ status: AdminAuditStatus }>) {
	const variant = status === "success" ? "success" : status === "failure" ? "danger" : "warning";
	const label = status.charAt(0).toUpperCase() + status.slice(1);

	return <Lozenge variant={variant}>{label}</Lozenge>;
}

function formatTimestamp(timestamp: string): string {
	return DATE_TIME_FORMATTER.format(new Date(timestamp));
}
