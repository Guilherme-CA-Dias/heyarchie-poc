"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Loader2,
	Download,
	AlertCircle,
	CheckCircle,
	BookOpen,
} from "lucide-react";
import { useAuth } from "@/app/auth-provider";
import { useIntegrationApp, useIntegrations } from "@integration-app/react";
import { toast } from "sonner";
import { ACCOUNTING_INTEGRATIONS, TRANSACTION_TYPES } from "@/lib/constants";

import { Transaction, LedgerAccount, ImportResult } from "../types";

interface ImportSectionProps {
	onImportComplete: () => void;
}

export default function ImportSection({
	onImportComplete,
}: ImportSectionProps) {
	const { customerId } = useAuth();
	const integrationApp = useIntegrationApp();
	const { integrations } = useIntegrations();
	const [isImporting, setIsImporting] = useState(false);
	const [isImportingLedgerAccounts, setIsImportingLedgerAccounts] =
		useState(false);
	const [importResults, setImportResults] = useState<ImportResult[]>([]);

	// Save transactions to MongoDB
	const saveTransactions = async (
		transactions: Transaction[],
		connectionId: string,
		integrationId: string,
		integrationName: string
	) => {
		try {
			const response = await fetch("/api/journal-entries", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					transactions,
					connectionId,
					integrationId,
					integrationName,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to save transactions");
			}

			const result = await response.json();
			console.log("Saved transactions:", result);
			return result;
		} catch (error) {
			console.error("Error saving transactions:", error);
			throw error;
		}
	};

	// Save ledger accounts to MongoDB
	const saveLedgerAccounts = async (
		accounts: LedgerAccount[],
		connectionId: string,
		integrationId: string,
		integrationName: string
	) => {
		try {
			const response = await fetch("/api/ledger-accounts", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					ledgerAccounts: accounts,
					connectionId,
					integrationId,
					integrationName,
					userId: customerId,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to save ledger accounts");
			}

			const result = await response.json();
			console.log("Saved ledger accounts:", result);
			return result;
		} catch (error) {
			console.error("Error saving ledger accounts:", error);
			throw error;
		}
	};

	const handleImportTransactions = async () => {
		if (!customerId) {
			toast.error("Please log in to import transactions");
			return;
		}

		setIsImporting(true);
		setImportResults([]);

		try {
			const results: ImportResult[] = [];

			// Filter for integrations that support accounting transactions
			const accountingIntegrations = integrations.filter(
				(integration: any) =>
					ACCOUNTING_INTEGRATIONS.includes(integration.key as any) &&
					integration.connection
			);

			if (accountingIntegrations.length === 0) {
				toast.error(
					"No accounting integrations found. Please connect an accounting integration first."
				);
				setIsImporting(false);
				return;
			}

			// Use transaction types from constants
			const transactionTypes = TRANSACTION_TYPES;

			// Process each integration separately
			for (const integration of accountingIntegrations) {
				if (!integration.connection) {
					results.push({
						integrationId: integration.key,
						integrationName: integration.name,
						success: false,
						count: 0,
						error: "No active connection found",
					});
					continue;
				}

				try {
					let totalTransactions = 0;
					const integrationTransactions: Transaction[] = [];

					// Import each transaction type
					for (const transactionType of transactionTypes) {
						try {
							let cursor: string | undefined;
							let hasMore = true;

							// Paginate through all transactions for this type
							while (hasMore) {
								const response = await integrationApp
									.connection(integration.connection.id)
									.action(transactionType.action)
									.run({ cursor });

								if (response.output && Array.isArray(response.output.records)) {
									const transactions = response.output.records.map(
										(record: any) => {
											// Ensure line items have ledgerAccountId
											const lineItems = (record.fields?.lineItems || []).map(
												(lineItem: any) => ({
													id: lineItem.id,
													description: lineItem.description,
													amount: lineItem.amount,
													type: lineItem.type,
													postingType: lineItem.postingType,
													dimension: lineItem.dimension,
													ledgerAccountId: lineItem.ledgerAccountId,
													accountRef: lineItem.accountRef,
													exchangeRate: lineItem.exchangeRate,
												})
											);

											// Debug: Log the first entry's line items to see the structure
											if (response.output.records.indexOf(record) === 0) {
												console.log(
													`Sample line items being saved for ${integration.key} (${transactionType.classification}):`,
													lineItems
												);
											}

											return {
												// Include all fields from the record.fields as-is
												...record.fields,
												// Ensure line items are properly structured with ledgerAccountId
												lineItems,
												// Include the record-level metadata
												id: record.fields?.id || record.id,
												createdTime:
													record.fields?.createdTime || record.createdTime,
												updatedTime:
													record.fields?.updatedTime || record.updatedTime,
												// Include the complete raw fields for reference
												rawFields: record.rawFields,
											};
										}
									);

									integrationTransactions.push(...transactions);
									totalTransactions += transactions.length;

									// Check if there are more pages
									cursor = response.output.cursor;
									hasMore = !!cursor && transactions.length > 0;

									// Optional: Add a small delay to avoid rate limiting
									if (hasMore) {
										await new Promise((resolve) => setTimeout(resolve, 100));
									}
								} else {
									hasMore = false;
								}
							}
						} catch (error) {
							console.warn(
								`Failed to import ${transactionType.classification} for ${integration.key}:`,
								error
							);
							// Continue with other transaction types even if one fails
						}
					}

					// Save transactions to MongoDB for this specific integration
					if (totalTransactions > 0 && integration.connection) {
						console.log(
							`Saving ${totalTransactions} transactions for ${integration.key} with connectionId: ${integration.connection.id}`
						);
						await saveTransactions(
							integrationTransactions,
							integration.connection.id,
							integration.key,
							integration.name
						);
					}

					results.push({
						integrationId: integration.key,
						integrationName: integration.name,
						success: true,
						count: totalTransactions,
					});
				} catch (error) {
					results.push({
						integrationId: integration.key,
						integrationName: integration.name,
						success: false,
						count: 0,
						error: error instanceof Error ? error.message : "Unknown error",
					});
				}
			}

			setImportResults(results);

			const totalImported = results
				.filter((r) => r.success)
				.reduce((sum, r) => sum + r.count, 0);

			if (totalImported > 0) {
				toast.success(
					`Successfully imported ${totalImported} transactions from ${
						results.filter((r) => r.success).length
					} integration(s)`
				);
			} else {
				toast.error("No transactions were imported. Check your integrations.");
			}

			// Notify parent component to reload data
			onImportComplete();
		} catch (error) {
			console.error("Error importing transactions:", error);
			toast.error("Failed to import transactions");
		} finally {
			setIsImporting(false);
		}
	};

	const handleImportLedgerAccounts = async () => {
		if (!customerId) {
			toast.error("Please log in to import ledger accounts");
			return;
		}

		setIsImportingLedgerAccounts(true);

		try {
			// Filter for integrations that support ledger accounts
			const ledgerAccountIntegrations = integrations.filter(
				(integration: any) =>
					ACCOUNTING_INTEGRATIONS.includes(integration.key as any) &&
					integration.connection
			);

			if (ledgerAccountIntegrations.length === 0) {
				toast.error(
					"No accounting integrations found. Please connect an accounting integration first."
				);
				setIsImportingLedgerAccounts(false);
				return;
			}

			let totalAccounts = 0;

			// Process each integration separately
			for (const integration of ledgerAccountIntegrations) {
				if (!integration.connection) continue;

				try {
					let cursor: string | undefined;
					let hasMore = true;
					const integrationAccounts: LedgerAccount[] = [];

					// Paginate through all ledger accounts for this integration
					while (hasMore) {
						const response = await integrationApp
							.connection(integration.connection.id)
							.action("get-ledger-accounts")
							.run({ cursor });

						if (response.output && Array.isArray(response.output.records)) {
							const accounts = response.output.records.map((record: any) => ({
								...record.fields,
								id: record.fields.id || record.id,
								integrationId: integration.key,
								integrationName: integration.name,
								connectionId: integration.connection?.id,
								rawFields: record.rawFields,
							}));

							integrationAccounts.push(...accounts);
							totalAccounts += accounts.length;

							// Check if there are more pages
							cursor = response.output.cursor;
							hasMore = !!cursor && accounts.length > 0;

							// Optional: Add a small delay to avoid rate limiting
							if (hasMore) {
								await new Promise((resolve) => setTimeout(resolve, 100));
							}
						} else {
							hasMore = false;
						}
					}

					// Save accounts to MongoDB for this specific integration
					if (integrationAccounts.length > 0 && integration.connection) {
						await saveLedgerAccounts(
							integrationAccounts,
							integration.connection.id,
							integration.key,
							integration.name
						);
					}
				} catch (error) {
					console.error(
						`Error importing ledger accounts for ${integration.key}:`,
						error
					);
				}
			}

			if (totalAccounts > 0) {
				toast.success(`Successfully imported ${totalAccounts} ledger accounts`);
			} else {
				toast.error(
					"No ledger accounts were imported. Check your integrations."
				);
			}

			// Notify parent component to reload data
			onImportComplete();
		} catch (error) {
			console.error("Error importing ledger accounts:", error);
			toast.error("Failed to import ledger accounts");
		} finally {
			setIsImportingLedgerAccounts(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Import Section */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<BookOpen className="h-4 w-4" />
							Import Ledger Accounts
						</CardTitle>
						<p className="text-xs text-gray-500">
							Import all ledger accounts from your connected accounting
							integrations.
						</p>
					</CardHeader>
					<CardContent className="pt-0">
						<Button
							onClick={handleImportLedgerAccounts}
							disabled={isImportingLedgerAccounts}
							className="w-full sm:w-auto"
						>
							{isImportingLedgerAccounts ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Importing...
								</>
							) : (
								<>
									<BookOpen className="mr-2 h-4 w-4" />
									Import All Ledger Accounts
								</>
							)}
						</Button>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<Download className="h-4 w-4" />
							Import Transactions
						</CardTitle>
						<p className="text-xs text-gray-500">
							Import all transactions from your connected accounting
							integrations.
						</p>
					</CardHeader>
					<CardContent className="pt-0">
						<Button
							onClick={handleImportTransactions}
							disabled={isImporting}
							className="w-full sm:w-auto"
						>
							{isImporting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Importing...
								</>
							) : (
								<>
									<Download className="mr-2 h-4 w-4" />
									Import All Transactions
								</>
							)}
						</Button>
					</CardContent>
				</Card>
			</div>

			{/* Import Results */}
			{importResults.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Import Results</CardTitle>
						<p className="text-sm text-gray-500">
							Results from the latest import operation
						</p>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{importResults.map((result, index) => (
								<div
									key={index}
									className="flex items-center justify-between p-3 border rounded-lg"
								>
									<div className="flex items-center gap-3">
										{result.success ? (
											<CheckCircle className="h-5 w-5 text-green-500" />
										) : (
											<AlertCircle className="h-5 w-5 text-red-500" />
										)}
										<div>
											<p className="font-medium">{result.integrationName}</p>
											{result.error && (
												<p className="text-sm text-red-500">{result.error}</p>
											)}
										</div>
									</div>
									<div className="flex items-center gap-2">
										{result.success && (
											<Badge variant="secondary">
												{result.count} transactions
											</Badge>
										)}
										<Badge variant={result.success ? "default" : "destructive"}>
											{result.success ? "Success" : "Failed"}
										</Badge>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
