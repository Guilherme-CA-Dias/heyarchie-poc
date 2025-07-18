"use client";

import { Badge } from "@/components/ui/badge";

interface FullViewProps {
	filteredTransactions: any[];
	lastEntryElementRef: (node: HTMLDivElement | null) => void;
}

export default function FullView({
	filteredTransactions,
	lastEntryElementRef,
}: FullViewProps) {
	return (
		<>
			{filteredTransactions.map((transaction, index) => {
				const isLastEntry = index === filteredTransactions.length - 1;

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
										<p className="font-bold text-lg">ID: {transaction.id}</p>
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
										? `${transaction.totalAmount.toLocaleString("en-US", {
												style: "currency",
												currency: transaction.currency || "USD",
										  })}`
										: "N/A"}
								</p>
								<p className="text-sm text-gray-500">{transaction.currency}</p>
							</div>
						</div>

						{/* Transaction Details */}
						<div className="grid grid-cols-2 gap-4 mb-3 text-sm">
							<div>
								<p>
									<span className="font-medium">Transaction Date:</span>{" "}
									{new Date(transaction.transactionDate).toLocaleDateString()}
								</p>
								<p>
									<span className="font-medium">Created:</span>{" "}
									{new Date(transaction.createdTime).toLocaleString()}
								</p>
								<p>
									<span className="font-medium">Updated:</span>{" "}
									{new Date(transaction.updatedTime).toLocaleString()}
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
									<span className="font-medium">Classification:</span>{" "}
									{transaction.classification}
								</p>
							</div>
						</div>

						{/* Line Items */}
						{transaction.lineItems && transaction.lineItems.length > 0 && (
							<div className="mb-3">
								<p className="font-medium mb-2">
									Line Items ({transaction.lineItems.length}):
								</p>
								<div className="space-y-2">
									{transaction.lineItems.map((line: any, lineIndex: number) => {
										// Create a truly unique key that combines transaction and line identifiers
										const uniqueKey = `${transaction.integrationId}-${
											transaction.id
										}-${transaction.connectionId}-${
											line.id || "no-id"
										}-${lineIndex}`;

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
														<p className="font-medium">{line.id}</p>
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
															{typeof line.amount === "number" &&
															!isNaN(line.amount)
																? `${line.amount.toLocaleString("en-US", {
																		style: "currency",
																		currency: transaction.currency || "USD",
																  })}`
																: "N/A"}
														</p>
													</div>
												</div>
												{line.description && (
													<div className="mt-2">
														<p className="font-bold text-xs text-gray-500 uppercase">
															Description
														</p>
														<p className="text-sm">{line.description}</p>
													</div>
												)}
												{line.accountRef && (
													<div className="mt-2">
														<p className="font-bold text-xs text-gray-500 uppercase">
															Account
														</p>
														<p className="text-sm">
															{line.accountRef.name} ({line.accountRef.value})
														</p>
													</div>
												)}

												{/* Dimension fields */}
												{(line.dimension_customerName ||
													line.dimension_projectName ||
													line.dimension_className ||
													line.dimension_itemName ||
													line.dimension_locationName) && (
													<div className="mt-2">
														<p className="font-bold text-xs text-gray-500 uppercase">
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
																	<p className="font-medium">
																		{line.dimension_itemName}
																	</p>
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
							</div>
						)}
					</div>
				);
			})}
		</>
	);
}
