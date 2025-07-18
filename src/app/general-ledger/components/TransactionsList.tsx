"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Transaction, TransactionLineItem } from "../types";
import { useTransactions } from "../hooks/useTransactions";

interface TransactionsListProps {
	selectedLedgerAccountId: string | null;
	onLedgerAccountClear: () => void;
}

export default function TransactionsList({
	selectedLedgerAccountId,
	onLedgerAccountClear,
}: TransactionsListProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [activeTab, setActiveTab] = useState<string>("all");
	const [transactionsOnlyView, setTransactionsOnlyView] = useState(false);
	const observerRef = useRef<IntersectionObserver | null>(null);
	const lastEntryRef = useRef<HTMLDivElement | null>(null);

	const {
		transactions,
		setTransactions,
		isLoading,
		setIsLoading,
		hasMore,
		setHasMore,
		isLoadingMore,
		currentPage,
		setCurrentPage,
		totalCount,
		availableIntegrations,
		integrationCounts,
		loadMoreEntries,
		loadEntriesForIntegration,
		loadTransactionsForLedgerAccount,
		refreshAvailableIntegrations,
		loadData,
	} = useTransactions();

	// Reset pagination when search term changes (tab filtering is now handled by data loading)
	useEffect(() => {
		if (searchTerm) {
			// When searching, we show all filtered results without pagination
			setHasMore(false);
		} else if (activeTab !== "all") {
			// When on a specific integration tab, no pagination
			setHasMore(false);
		}
		// Note: hasMore is managed by loadMoreEntries and initial load, not here
	}, [searchTerm, activeTab]);

	// Intersection observer for infinite scrolling
	const lastEntryElementRef = useCallback(
		(node: HTMLDivElement | null) => {
			// Allow infinite scrolling when:
			// 1. Not currently loading more
			// 2. No search term (or we're in line items view)
			// 3. On "all" tab (or we're in line items view)
			if (isLoadingMore) return;
			if (searchTerm && !transactionsOnlyView) return;
			if (activeTab !== "all" && !transactionsOnlyView) return;

			if (observerRef.current) observerRef.current.disconnect();

			observerRef.current = new IntersectionObserver((entries) => {
				if (entries[0].isIntersecting && hasMore) {
					loadMoreEntries();
				}
			});

			if (node) observerRef.current.observe(node);
		},
		[isLoadingMore, hasMore, searchTerm, activeTab, transactionsOnlyView]
	);

	// Add useEffect to handle ledger account selection
	useEffect(() => {
		if (selectedLedgerAccountId) {
			if (searchTerm) {
				// When searching with a ledger account selected, fetch all transactions for that ledger account
				loadTransactionsForLedgerAccount(selectedLedgerAccountId);
			} else {
				// Load transactions for the selected ledger account
				loadTransactionsForLedgerAccount(selectedLedgerAccountId);
			}
		} else if (activeTab === "all") {
			// If no ledger account is selected and we're on the 'all' tab, load paginated transactions
			if (searchTerm) {
				// Fetch all transactions for searching
				setIsLoading(true);
				fetch("/api/journal-entries?limit=1000&offset=0")
					.then((res) => res.json())
					.then((data) => {
						setTransactions(data.transactions || []);
						setHasMore(false); // No infinite scroll during search
					})
					.catch((err) => {
						console.error("Failed to fetch all transactions for search:", err);
					})
					.finally(() => setIsLoading(false));
			} else {
				setIsLoading(true);
				fetch(`/api/journal-entries?limit=10&offset=0`)
					.then((res) => res.json())
					.then((data) => {
						setTransactions(data.transactions || []);
						setCurrentPage(0);
						setHasMore((data.transactions || []).length === 10);
					})
					.catch((err) => {
						console.error("Failed to reload paginated transactions:", err);
					})
					.finally(() => setIsLoading(false));
			}
		}
	}, [selectedLedgerAccountId, activeTab, searchTerm]);

	// Filter transactions based on search term (ledger account filtering is now done server-side)
	const filteredTransactions = transactions.filter((transaction) => {
		// Filter by search term only
		if (!searchTerm) return true;

		const searchLower = searchTerm.toLowerCase();

		// Search in ID
		if (transaction.id?.toLowerCase().includes(searchLower)) return true;

		// Search in memo
		if (transaction.memo?.toLowerCase().includes(searchLower)) return true;

		// Search in number
		if (transaction.number?.toLowerCase().includes(searchLower)) return true;

		// Search in classification
		if (transaction.classification?.toLowerCase().includes(searchLower))
			return true;

		// Search in line items descriptions
		if (
			transaction.lineItems?.some((line: any) =>
				line.description?.toLowerCase().includes(searchLower)
			)
		)
			return true;

		// Search in line items account names
		if (
			transaction.lineItems?.some((line: any) =>
				line.accountRef?.name?.toLowerCase().includes(searchLower)
			)
		)
			return true;

		return false;
	});

	return (
		<div className="lg:col-span-3">
			<Card>
				<CardHeader>
					<div className="flex justify-between items-center">
						<div>
							<CardTitle>Transactions</CardTitle>
							<p className="text-sm text-gray-500">
								{isLoading
									? "Loading..."
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
								onClick={() => {
									setActiveTab("all");
									loadEntriesForIntegration("all");
								}}
								className={cn(
									"px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
									activeTab === "all"
										? "bg-blue-100 text-blue-700 border-b-2 border-blue-700"
										: "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
								)}
							>
								All (
								{selectedLedgerAccountId
									? filteredTransactions.length
									: totalCount}
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
										onClick={() => {
											setActiveTab(integrationId);
											loadEntriesForIntegration(integrationId);
										}}
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
							Debug: {Object.keys(integrationCounts).length} integration counts
							- {Object.keys(integrationCounts).join(", ")}
						</div>
					)}
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
							<span className="ml-2">Loading transactions...</span>
						</div>
					) : filteredTransactions.length > 0 ? (
						<div className="space-y-3">
							{transactionsOnlyView ? (
								// Flattened Line Items Only View
								<div>
									{filteredTransactions
										.flatMap((transaction) =>
											(transaction.lineItems || [])
												.filter((line: any) => {
													// Filter out line items with null/empty account information
													const accountId = line.ledgerAccountId;
													const hasValidAccount =
														accountId &&
														accountId !== "N/A" &&
														accountId !== "" &&
														accountId !== null &&
														accountId !== undefined;

													// If a ledger account is selected, also filter by that account
													if (selectedLedgerAccountId) {
														return (
															hasValidAccount &&
															accountId === selectedLedgerAccountId
														);
													}

													return hasValidAccount;
												})
												.map((line: any, lineIndex: number) => ({
													...line,
													transactionId: transaction.id,
													transactionMemo: transaction.memo,
													transactionNumber: transaction.number,
													integrationName: transaction.integrationName,
													currency: transaction.currency,
													transactionDate: transaction.transactionDate,
													lineIndex,
												}))
										)
										.map((line: any, globalIndex: number) => {
											const uniqueKey = `${line.transactionId}-${line.id}-${globalIndex}`;
											const isLastLineItem =
												globalIndex ===
												filteredTransactions.flatMap((transaction) =>
													(transaction.lineItems || []).filter((line: any) => {
														const accountId = line.ledgerAccountId;
														const hasValidAccount =
															accountId &&
															accountId !== "N/A" &&
															accountId !== "" &&
															accountId !== null &&
															accountId !== undefined;

														// If a ledger account is selected, also filter by that account
														if (selectedLedgerAccountId) {
															return (
																hasValidAccount &&
																accountId === selectedLedgerAccountId
															);
														}

														return hasValidAccount;
													})
												).length -
													1;

											return (
												<div
													key={uniqueKey}
													className="bg-gray-50 p-3 rounded text-sm border-l-4 border-blue-200 mb-2"
													ref={isLastLineItem ? lastEntryElementRef : null}
												>
													<div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
														<div className="md:col-span-2">
															<p className="font-medium text-sm">
																{line.description || "No description"}
															</p>
															<p className="text-xs text-gray-500">
																ID: {line.id}
															</p>
															<p className="text-xs text-purple-600">
																Transaction: {line.transactionId}
															</p>
														</div>
														<div>
															<p className="text-xs text-gray-500 uppercase font-medium">
																Account
															</p>
															<p className="text-sm font-medium text-blue-600">
																{line.ledgerAccountId}
															</p>
															{line.accountRef && (
																<p className="text-xs text-gray-500">
																	{line.accountRef.name}
																</p>
															)}
														</div>
														<div>
															<p className="text-xs text-gray-500 uppercase font-medium">
																Type
															</p>
															<p className="text-sm font-medium">{line.type}</p>
															{line.postingType && (
																<p className="text-xs text-gray-500">
																	{line.postingType}
																</p>
															)}
														</div>
														<div className="md:col-span-1"></div>
														<div>
															<p className="text-xs text-gray-500 uppercase font-medium">
																Integration
															</p>
															<p className="text-sm text-purple-600">
																{line.integrationName || "N/A"}
															</p>
														</div>
														<div className="text-right">
															<p className="text-xs text-gray-500 uppercase font-medium">
																Amount
															</p>
															<p className="text-sm font-bold text-black">
																{typeof line.amount === "number" &&
																!isNaN(line.amount)
																	? `${line.amount.toLocaleString("en-US", {
																			style: "currency",
																			currency: line.currency || "USD",
																	  })}`
																	: "N/A"}
															</p>
														</div>
													</div>
												</div>
											);
										})}
								</div>
							) : (
								// Full View (existing code)
								<>
									{filteredTransactions.map((transaction, index) => {
										const isLastEntry =
											index === filteredTransactions.length - 1;

										return (
											<div
												key={`${transaction.integrationId}-${transaction.id}-${transaction.connectionId}`}
												className="border rounded-lg p-4 mb-4"
												ref={isLastEntry ? lastEntryElementRef : null}
											>
												{/* Header */}
												<div className="flex items-center justify-between mb-3">
													<div className="flex-1">
														<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
															<div>
																<p className="font-bold text-lg">
																	ID: {transaction.id}
																</p>
																{transaction.integrationName && (
																	<p className="font-medium text-purple-600">
																		Integration: {transaction.integrationName}
																	</p>
																)}
															</div>
															<div>
																{transaction.memo && (
																	<>
																		<p className="font-bold text-lg">Memo</p>
																		<p className="font-medium text-gray-700">
																			{transaction.memo}
																		</p>
																	</>
																)}
																{!transaction.memo && transaction.number && (
																	<>
																		<p className="font-bold text-lg">Number</p>
																		<p className="font-medium text-gray-700">
																			{transaction.number}
																		</p>
																	</>
																)}
															</div>
														</div>
													</div>
													<div className="text-right ml-4">
														<p className="font-bold text-lg text-black">
															{typeof transaction.totalAmount === "number" &&
															!isNaN(transaction.totalAmount)
																? `${transaction.totalAmount.toLocaleString(
																		"en-US",
																		{
																			style: "currency",
																			currency: transaction.currency || "USD",
																		}
																  )}`
																: "N/A"}
														</p>
														<p className="text-sm text-gray-500">
															{transaction.currency}
														</p>
													</div>
												</div>

												{/* Transaction Details */}
												<div className="grid grid-cols-2 gap-4 mb-3 text-sm">
													<div>
														<p>
															<span className="font-medium">
																Transaction Date:
															</span>{" "}
															{new Date(
																transaction.transactionDate
															).toLocaleDateString()}
														</p>
														<p>
															<span className="font-medium">Created:</span>{" "}
															{new Date(
																transaction.createdTime
															).toLocaleString()}
														</p>
														<p>
															<span className="font-medium">Updated:</span>{" "}
															{new Date(
																transaction.updatedTime
															).toLocaleString()}
														</p>
													</div>
													<div>
														{transaction.number && (
															<p>
																<span className="font-medium">Number:</span>{" "}
																{transaction.number}
															</p>
														)}
														{transaction.memo && (
															<p>
																<span className="font-medium">Memo:</span>{" "}
																{transaction.memo}
															</p>
														)}
														<p>
															<span className="font-medium">
																Classification:
															</span>{" "}
															{transaction.classification}
														</p>
													</div>
												</div>

												{/* Line Items */}
												{transaction.lineItems &&
													transaction.lineItems.length > 0 && (
														<div className="mb-3">
															<p className="font-medium mb-2">
																Line Items ({transaction.lineItems.length}
																):
															</p>
															<div className="space-y-2">
																{transaction.lineItems.map(
																	(line: any, lineIndex: number) => {
																		// Create a truly unique key that combines transaction and line identifiers
																		const uniqueKey = `${
																			transaction.integrationId
																		}-${transaction.id}-${
																			transaction.connectionId
																		}-${line.id || "no-id"}-${lineIndex}`;

																		return (
																			<div
																				key={uniqueKey}
																				className="bg-gray-50 p-3 rounded text-sm"
																			>
																				<div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
																					<div>
																						<p className="font-bold text-xs text-gray-500 uppercase">
																							ID
																						</p>
																						<p className="font-medium">
																							{line.id}
																						</p>
																					</div>
																					<div>
																						<p className="font-bold text-xs text-gray-500 uppercase">
																							Ledger Account ID
																						</p>
																						<p className="font-medium text-blue-600">
																							{line.ledgerAccountId || "N/A"}
																						</p>
																					</div>
																					<div className="flex flex-row items-center justify-between md:block md:space-y-1">
																						<div>
																							<p className="font-bold text-xs text-gray-500 uppercase">
																								Type
																							</p>
																							<p className="font-medium whitespace-normal break-all">
																								{line.type}
																							</p>
																							{line.postingType && (
																								<p className="text-xs text-gray-500">
																									({line.postingType})
																								</p>
																							)}
																						</div>
																					</div>
																					<div className="flex flex-col items-end justify-center md:items-end md:justify-center h-full">
																						<p className="font-bold text-xs text-gray-500 uppercase">
																							Amount
																						</p>
																						<p className="font-medium text-black">
																							{typeof line.amount ===
																								"number" && !isNaN(line.amount)
																								? `${line.amount.toLocaleString(
																										"en-US",
																										{
																											style: "currency",
																											currency:
																												transaction.currency ||
																												"USD",
																										}
																								  )}`
																								: "N/A"}
																						</p>
																					</div>
																				</div>
																				{line.description && (
																					<div className="mt-2">
																						<p className="font-bold text-xs text-gray-500 uppercase">
																							Description
																						</p>
																						<p className="text-sm">
																							{line.description}
																						</p>
																					</div>
																				)}
																				{line.accountRef && (
																					<div className="mt-2">
																						<p className="font-bold text-xs text-gray-500 uppercase">
																							Account
																						</p>
																						<p className="text-sm">
																							{line.accountRef.name} (
																							{line.accountRef.value})
																						</p>
																					</div>
																				)}
																			</div>
																		);
																	}
																)}
															</div>
														</div>
													)}

												{/* All Other Fields */}
												<div className="text-xs text-gray-600">
													<p className="font-medium mb-1">All Fields:</p>
													<pre className="bg-gray-100 p-2 rounded overflow-auto max-h-32">
														{JSON.stringify(transaction, null, 2)}
													</pre>
												</div>
											</div>
										);
									})}
								</>
							)}

							{/* Loading more indicator */}
							{isLoadingMore && (
								<div className="flex items-center justify-center py-4">
									<Loader2 className="h-6 w-6 animate-spin" />
									<span className="ml-2">Loading more transactions...</span>
								</div>
							)}

							{/* End of list indicator */}
							{!hasMore && filteredTransactions.length > 0 && (
								<p className="text-center text-gray-500 text-sm py-4">
									No more transactions to load
								</p>
							)}
						</div>
					) : (
						<div className="text-center py-8 text-gray-500">
							{searchTerm
								? `No transactions found matching "${searchTerm}". Try a different search term.`
								: "No transactions found. Import some transactions to get started."}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
