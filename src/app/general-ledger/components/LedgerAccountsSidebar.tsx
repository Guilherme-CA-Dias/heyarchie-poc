"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LedgerAccount } from "../types";

interface LedgerAccountsSidebarProps {
	selectedLedgerAccountId: string | null;
	onLedgerAccountSelect: (accountId: string) => void;
	onLedgerAccountClear: () => void;
	onReloadData: (reloadFn: () => void) => void;
}

export default function LedgerAccountsSidebar({
	selectedLedgerAccountId,
	onLedgerAccountSelect,
	onLedgerAccountClear,
	onReloadData,
}: LedgerAccountsSidebarProps) {
	const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
	const [ledgerAccountSearchTerm, setLedgerAccountSearchTerm] = useState("");
	const [activeLedgerAccountTab, setActiveLedgerAccountTab] =
		useState<string>("all");
	const [ledgerAccountCounts, setLedgerAccountCounts] = useState<{
		[key: string]: { count: number; name: string };
	}>({});
	const [
		availableLedgerAccountIntegrations,
		setAvailableLedgerAccountIntegrations,
	] = useState<string[]>([]);

	// Load ledger accounts from MongoDB
	const loadLedgerAccounts = async () => {
		try {
			// First get counts
			const countsResponse = await fetch("/api/ledger-accounts?countOnly=true");
			if (countsResponse.ok) {
				const countsData = await countsResponse.json();

				// Update counts
				const countsMap: { [key: string]: { count: number; name: string } } =
					{};
				countsData.counts?.forEach((item: any) => {
					countsMap[item.integrationId] = {
						count: item.count,
						name: item.integrationName,
					};
				});
				setLedgerAccountCounts(countsMap);
				setAvailableLedgerAccountIntegrations(
					countsData.counts?.map((item: any) => item.integrationId) || []
				);
			}

			// Then get all ledger accounts (no pagination for sidebar)
			const response = await fetch("/api/ledger-accounts?limit=1000&offset=0");
			if (response.ok) {
				const data = await response.json();
				setLedgerAccounts(data.ledgerAccounts || []);
			} else {
				console.error("Failed to load ledger accounts");
			}
		} catch (error) {
			console.error("Error loading ledger accounts:", error);
		}
	};

	// Load ledger accounts for a specific integration
	const loadLedgerAccountsForIntegration = async (integrationId: string) => {
		try {
			if (integrationId === "all") {
				// Load all ledger accounts
				const response = await fetch(
					"/api/ledger-accounts?limit=1000&offset=0"
				);
				if (response.ok) {
					const data = await response.json();
					setLedgerAccounts(data.ledgerAccounts || []);
				}
			} else {
				// Load ledger accounts for specific integration
				const response = await fetch(
					`/api/ledger-accounts?integrationId=${integrationId}&limit=1000&offset=0`
				);
				if (response.ok) {
					const data = await response.json();
					setLedgerAccounts(data.ledgerAccounts || []);
				}
			}
		} catch (error) {
			console.error("Error loading ledger accounts for integration:", error);
		}
	};

	// Load ledger accounts on component mount
	useEffect(() => {
		loadLedgerAccounts();
	}, []);

	// Register the reload function with parent component
	useEffect(() => {
		onReloadData(loadLedgerAccounts);
	}, []);

	// Filter ledger accounts based on search term
	const filteredLedgerAccounts = ledgerAccounts.filter((account) => {
		if (!ledgerAccountSearchTerm) return true;

		const searchLower = ledgerAccountSearchTerm.toLowerCase();

		// Search in ID
		if (account.id?.toLowerCase().includes(searchLower)) return true;

		// Search in name
		if (account.name?.toLowerCase().includes(searchLower)) return true;

		// Search in type
		if (account.type?.toLowerCase().includes(searchLower)) return true;

		// Search in classification
		if (account.classification?.toLowerCase().includes(searchLower))
			return true;

		// Search in integration name
		if (account.integrationName?.toLowerCase().includes(searchLower))
			return true;

		return false;
	});

	return (
		<div className="lg:col-span-1">
			<div className="sticky top-16">
				<Card>
					<CardHeader>
						<CardTitle>Ledger Accounts</CardTitle>
						<p className="text-sm text-gray-500">
							{ledgerAccounts.length} accounts stored
						</p>
						<input
							type="text"
							placeholder="Search ledger accounts..."
							value={ledgerAccountSearchTerm}
							onChange={(e) => setLedgerAccountSearchTerm(e.target.value)}
							className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>

						{/* Ledger Account Integration Tabs */}
						{availableLedgerAccountIntegrations.length > 0 && (
							<div className="mt-4 border-b overflow-x-auto">
								<div className="flex space-x-1 min-w-max">
									<button
										onClick={() => {
											setActiveLedgerAccountTab("all");
											loadLedgerAccountsForIntegration("all");
										}}
										className={cn(
											"px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap",
											activeLedgerAccountTab === "all"
												? "bg-blue-100 text-blue-700 border-b-2 border-blue-700"
												: "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
										)}
									>
										All ({ledgerAccounts.length})
									</button>
									{availableLedgerAccountIntegrations.map((integrationId) => {
										const integrationData = ledgerAccountCounts[integrationId];
										const integrationName =
											integrationData?.name || integrationId;
										const count = integrationData?.count || 0;

										return (
											<button
												key={integrationId}
												onClick={() => {
													setActiveLedgerAccountTab(integrationId);
													loadLedgerAccountsForIntegration(integrationId);
												}}
												className={cn(
													"px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap",
													activeLedgerAccountTab === integrationId
														? "bg-blue-100 text-blue-700 border-b-2 border-blue-700"
														: "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
												)}
											>
												{integrationName} ({count})
											</button>
										);
									})}
								</div>
							</div>
						)}
					</CardHeader>
					<CardContent>
						<div className="space-y-2 max-h-96 overflow-y-auto">
							{filteredLedgerAccounts.map((account) => (
								<div
									key={`${account.integrationId}-${account.id}-${account.connectionId}`}
									className={cn(
										"p-3 border rounded-lg cursor-pointer transition-colors",
										selectedLedgerAccountId === account.id
											? "bg-blue-50 border-blue-200"
											: "hover:bg-gray-50"
									)}
									onClick={() => onLedgerAccountSelect(account.id)}
								>
									<div className="flex justify-between items-start">
										<div className="flex-1 min-w-0">
											<p className="font-medium text-sm truncate">
												{account.name}
											</p>
											<p className="text-xs text-gray-500 truncate">
												ID: {account.id}
											</p>
											<p className="text-xs text-gray-500 truncate">
												Type: {account.type}
											</p>
											{account.classification && (
												<p className="text-xs text-gray-500 truncate">
													Classification: {account.classification}
												</p>
											)}
											{account.integrationName && (
												<p className="text-xs text-purple-600 truncate">
													{account.integrationName}
												</p>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
