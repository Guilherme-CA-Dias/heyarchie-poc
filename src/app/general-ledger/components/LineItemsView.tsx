"use client";

import { CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LineItemsViewProps {
	filteredTransactions: any[];
	selectedLedgerAccountId: string | null;
	lastEntryElementRef: (node: HTMLDivElement | null) => void;
}

export default function LineItemsView({
	filteredTransactions,
	selectedLedgerAccountId,
	lastEntryElementRef,
}: LineItemsViewProps) {
	return (
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
								return hasValidAccount && accountId === selectedLedgerAccountId;
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
							classification: transaction.classification,
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
										hasValidAccount && accountId === selectedLedgerAccountId
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
									<p className="text-xs text-gray-500">ID: {line.id}</p>
									<p className="text-xs text-purple-600">
										Transaction: {line.transactionId}
									</p>
									<p className="text-xs text-black">
										Classification: {line.classification || "N/A"}
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
										<p className="text-xs text-gray-500">{line.postingType}</p>
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
										{typeof line.amount === "number" && !isNaN(line.amount)
											? `${line.amount.toLocaleString("en-US", {
													style: "currency",
													currency: line.currency || "USD",
											  })}`
											: "N/A"}
									</p>
								</div>
							</div>

							{/* Dimension fields */}
							{(line.dimension_customerName ||
								line.dimension_projectName ||
								line.dimension_className ||
								line.dimension_itemName ||
								line.dimension_locationName) && (
								<div className="mt-2 pt-2 border-t border-gray-200">
									<p className="text-xs text-gray-500 uppercase font-medium mb-1">
										Dimensions
									</p>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
										{line.dimension_customerName && (
											<div>
												<p className="text-gray-500">Customer:</p>
												<p className="font-medium">
													{line.dimension_customerName}
												</p>
											</div>
										)}
										{line.dimension_projectName && (
											<div>
												<p className="text-gray-500">Project:</p>
												<p className="font-medium">
													{line.dimension_projectName}
												</p>
											</div>
										)}
										{line.dimension_className && (
											<div>
												<p className="text-gray-500">Class:</p>
												<p className="font-medium">
													{line.dimension_className}
												</p>
											</div>
										)}
										{line.dimension_itemName && (
											<div>
												<p className="text-gray-500">Item:</p>
												<p className="font-medium">{line.dimension_itemName}</p>
											</div>
										)}
										{line.dimension_locationName && (
											<div>
												<p className="text-gray-500">Location:</p>
												<p className="font-medium">
													{line.dimension_locationName}
												</p>
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					);
				})}
		</div>
	);
}
