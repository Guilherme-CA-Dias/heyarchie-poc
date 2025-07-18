"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionsListHeaderProps {
	searchTerm: string;
	setSearchTerm: (term: string) => void;
	transactionsOnlyView: boolean;
	setTransactionsOnlyView: (view: boolean) => void;
	isLoading: boolean;
	activeTab: string;
	selectedLedgerAccountId: string | null;
	filteredTransactions: any[];
	totalCount: number;
	integrationCounts: { [key: string]: { count: number; name: string } };
	availableIntegrations: string[];
	onLedgerAccountClear: () => void;
	onTabChange: (tab: string) => void;
	loadEntriesForIntegration: (integrationId: string) => void;
}

export default function TransactionsListHeader({
	searchTerm,
	setSearchTerm,
	transactionsOnlyView,
	setTransactionsOnlyView,
	isLoading,
	activeTab,
	selectedLedgerAccountId,
	filteredTransactions,
	totalCount,
	integrationCounts,
	availableIntegrations,
	onLedgerAccountClear,
	onTabChange,
	loadEntriesForIntegration,
}: TransactionsListHeaderProps) {
	const handleTabClick = (tab: string) => {
		onTabChange(tab);
		loadEntriesForIntegration(tab);
	};

	return (
		<CardHeader>
			<div className="flex justify-between items-center">
				<div>
					<CardTitle>Transactions</CardTitle>
					<p className="text-sm text-gray-500">
						{isLoading
							? `Loading ${
									activeTab === "all"
										? "all transactions"
										: `${
												integrationCounts[activeTab]?.count || 0
										  } transactions from ${
												integrationCounts[activeTab]?.name || activeTab
										  }`
							  }...`
							: selectedLedgerAccountId
							? `${filteredTransactions.length} transactions for selected account`
							: `${totalCount} transactions stored`}
						{searchTerm && ` • ${filteredTransactions.length} filtered`}
						{activeTab !== "all" &&
							!selectedLedgerAccountId &&
							` • ${filteredTransactions.length} from ${
								integrationCounts[activeTab]?.name || activeTab
							}`}
					</p>
					{selectedLedgerAccountId && (
						<button
							onClick={onLedgerAccountClear}
							className="text-xs text-blue-600 hover:text-blue-800 mt-1"
						>
							Clear ledger account filter
						</button>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant={transactionsOnlyView ? "default" : "outline"}
						size="sm"
						onClick={() => setTransactionsOnlyView(!transactionsOnlyView)}
						className="flex items-center gap-2"
					>
						{transactionsOnlyView ? (
							<>
								<FileText className="h-4 w-4" />
								Full View
							</>
						) : (
							<>
								<List className="h-4 w-4" />
								Line Items Only
							</>
						)}
					</Button>
					<input
						type="text"
						placeholder="Search transactions..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
			</div>

			{/* Integration Tabs */}
			{availableIntegrations.length > 0 && (
				<div className="flex space-x-1 mt-4 border-b">
					<button
						onClick={() => handleTabClick("all")}
						className={cn(
							"px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
							activeTab === "all"
								? "bg-blue-100 text-blue-700 border-b-2 border-blue-700"
								: "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
						)}
					>
						All (
						{selectedLedgerAccountId ? filteredTransactions.length : totalCount}
						)
					</button>
					{availableIntegrations.map((integrationId) => {
						const integrationData = integrationCounts[integrationId];
						const integrationName = integrationData?.name || integrationId;
						const originalCount = integrationData?.count || 0;

						// Calculate filtered count for this integration
						let filteredCount = originalCount;
						if (selectedLedgerAccountId) {
							// When a ledger account is selected, count transactions for this integration that match the ledger account
							filteredCount = filteredTransactions.filter(
								(transaction) => transaction.integrationId === integrationId
							).length;
						} else if (activeTab === integrationId) {
							// When viewing a specific integration tab, show the count for that integration
							filteredCount = filteredTransactions.length;
						}

						return (
							<button
								key={integrationId}
								onClick={() => handleTabClick(integrationId)}
								className={cn(
									"px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
									activeTab === integrationId
										? "bg-blue-100 text-blue-700 border-b-2 border-blue-700"
										: "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
								)}
							>
								{integrationName} ({filteredCount})
							</button>
						);
					})}
				</div>
			)}
			{/* Debug info */}
			{process.env.NODE_ENV === "development" && (
				<div className="text-xs text-gray-400 mt-2">
					Debug: {availableIntegrations.length} integrations available -{" "}
					{availableIntegrations.join(", ")}
					<br />
					Debug: {Object.keys(integrationCounts).length} integration counts -{" "}
					{Object.keys(integrationCounts).join(", ")}
				</div>
			)}
		</CardHeader>
	);
}
