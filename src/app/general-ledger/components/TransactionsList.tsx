"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Transaction, TransactionLineItem } from "../types";
import { useTransactions } from "../hooks/useTransactions";
import TransactionsListHeader from "./TransactionsListHeader";
import LineItemsView from "./LineItemsView";
import FullView from "./FullView";
import LoadingState from "./LoadingState";

interface TransactionsListProps {
	selectedLedgerAccountId: string | null;
	onLedgerAccountClear: () => void;
	onReloadData: (reloadFn: () => void) => void;
}

export default function TransactionsList({
	selectedLedgerAccountId,
	onLedgerAccountClear,
	onReloadData,
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

	// Register the reload function with parent component
	useEffect(() => {
		onReloadData(() => {
			loadData();
			refreshAvailableIntegrations();
		});
	}, []);

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
				<TransactionsListHeader
					searchTerm={searchTerm}
					setSearchTerm={setSearchTerm}
					transactionsOnlyView={transactionsOnlyView}
					setTransactionsOnlyView={setTransactionsOnlyView}
					isLoading={isLoading}
					activeTab={activeTab}
					selectedLedgerAccountId={selectedLedgerAccountId}
					filteredTransactions={filteredTransactions}
					totalCount={totalCount}
					integrationCounts={integrationCounts}
					availableIntegrations={availableIntegrations}
					onLedgerAccountClear={onLedgerAccountClear}
					onTabChange={setActiveTab}
					loadEntriesForIntegration={loadEntriesForIntegration}
				/>
				<CardContent>
					{isLoading ? (
						<LoadingState />
					) : filteredTransactions.length > 0 ? (
						<div className="space-y-3">
							{transactionsOnlyView ? (
								<LineItemsView
									filteredTransactions={filteredTransactions}
									selectedLedgerAccountId={selectedLedgerAccountId}
									lastEntryElementRef={lastEntryElementRef}
								/>
							) : (
								<FullView
									filteredTransactions={filteredTransactions}
									lastEntryElementRef={lastEntryElementRef}
								/>
							)}
						</div>
					) : (
						<div className="text-center py-8 text-gray-500">
							No transactions found.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
