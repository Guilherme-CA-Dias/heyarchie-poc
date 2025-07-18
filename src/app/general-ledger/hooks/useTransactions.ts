import { useState, useEffect, useCallback } from "react";
import { Transaction } from "../types";

export function useTransactions() {
	const [isLoading, setIsLoading] = useState(true);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [hasMore, setHasMore] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [currentPage, setCurrentPage] = useState(0);
	const [totalCount, setTotalCount] = useState(0);
	const [availableIntegrations, setAvailableIntegrations] = useState<string[]>(
		[]
	);
	const [integrationCounts, setIntegrationCounts] = useState<{
		[key: string]: { count: number; name: string };
	}>({});

	const pageSize = 10;

	// Load existing transactions from MongoDB on page load
	const loadData = useCallback(async () => {
		try {
			setIsLoading(true);
			setCurrentPage(0);

			// Fetch counts first
			const countsResponse = await fetch("/api/journal-entries?countOnly=true");
			if (countsResponse.ok) {
				const countsData = await countsResponse.json();
				setTotalCount(countsData.total);

				const countsMap: { [key: string]: { count: number; name: string } } =
					{};
				countsData.counts.forEach((item: any) => {
					countsMap[item.integrationId] = {
						count: item.count,
						name: item.integrationName,
					};
				});
				setIntegrationCounts(countsMap);
				setAvailableIntegrations(
					countsData.counts.map((item: any) => item.integrationId)
				);
			}

			// Fetch first page of transactions
			const response = await fetch(
				`/api/journal-entries?limit=${pageSize}&offset=0`
			);
			if (response.ok) {
				const data = await response.json();
				const transactions = data.transactions || [];
				setTransactions(transactions);
				// Set hasMore based on whether we got a full page of results
				setHasMore(transactions.length === pageSize);
			} else {
				console.error("Failed to load transactions");
			}
		} catch (error) {
			console.error("Error loading data:", error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Load more transactions
	const loadMoreEntries = async () => {
		if (isLoadingMore || !hasMore) return;

		try {
			setIsLoadingMore(true);
			const nextPage = currentPage + 1;
			const offset = nextPage * pageSize;

			const response = await fetch(
				`/api/journal-entries?limit=${pageSize}&offset=${offset}`
			);
			if (response.ok) {
				const data = await response.json();
				const newTransactions = data.transactions || [];

				setTransactions((prev) => [...prev, ...newTransactions]);
				setCurrentPage(nextPage);
				setHasMore(newTransactions.length === pageSize);
			} else {
				console.error("Failed to load more transactions");
			}
		} catch (error) {
			console.error("Error loading more transactions:", error);
		} finally {
			setIsLoadingMore(false);
		}
	};

	// Load entries for a specific integration
	const loadEntriesForIntegration = async (integrationId: string) => {
		try {
			setIsLoading(true);
			setCurrentPage(0);

			if (integrationId === "all") {
				// Load all entries with pagination
				const response = await fetch(
					`/api/journal-entries?limit=${pageSize}&offset=0`
				);
				if (response.ok) {
					const data = await response.json();
					setTransactions(data.transactions || []);
					setHasMore(data.transactions.length === pageSize);
				}
			} else {
				// Load all entries for specific integration (no pagination for filtered views)
				const response = await fetch(
					`/api/journal-entries?integrationId=${integrationId}&limit=1000&offset=0`
				);
				if (response.ok) {
					const data = await response.json();
					setTransactions(data.transactions || []);
					setHasMore(false); // No pagination for filtered views
				}
			}
		} catch (error) {
			console.error("Error loading entries for integration:", error);
		} finally {
			setIsLoading(false);
		}
	};

	// Load transactions for a specific ledger account
	const loadTransactionsForLedgerAccount = async (ledgerAccountId: string) => {
		try {
			setIsLoading(true);
			setCurrentPage(0);

			// Load all transactions for the selected ledger account (no pagination for filtered views)
			const response = await fetch(
				`/api/journal-entries?ledgerAccountId=${ledgerAccountId}&limit=1000&offset=0`
			);
			if (response.ok) {
				const data = await response.json();
				setTransactions(data.transactions || []);
				setHasMore(false); // No pagination for filtered views
			}
		} catch (error) {
			console.error("Error loading transactions for ledger account:", error);
		} finally {
			setIsLoading(false);
		}
	};

	// Refresh available integrations
	const refreshAvailableIntegrations = async () => {
		try {
			const countsResponse = await fetch("/api/journal-entries?countOnly=true");
			if (countsResponse.ok) {
				const countsData = await countsResponse.json();
				setTotalCount(countsData.total);

				const countsMap: { [key: string]: { count: number; name: string } } =
					{};
				countsData.counts.forEach((item: any) => {
					countsMap[item.integrationId] = {
						count: item.count,
						name: item.integrationName,
					};
				});
				setIntegrationCounts(countsMap);
				setAvailableIntegrations(
					countsData.counts.map((item: any) => item.integrationId)
				);
			}
		} catch (error) {
			console.error("Error refreshing integrations:", error);
		}
	};

	// Load data on mount
	useEffect(() => {
		loadData();
	}, [loadData]);

	return {
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
	};
}
