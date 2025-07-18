"use client";

import { useState, useCallback, useRef } from "react";
import ImportSection from "./components/ImportSection";
import LedgerAccountsSidebar from "./components/LedgerAccountsSidebar";
import TransactionsList from "./components/TransactionsList";

export default function GeneralLedgerPage() {
	const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<
		string | null
	>(null);
	const reloadTransactionsRef = useRef<() => void>(() => {});
	const reloadLedgerAccountsRef = useRef<() => void>(() => {});

	const handleImportComplete = useCallback(() => {
		// Trigger reload of data in child components
		reloadTransactionsRef.current();
		reloadLedgerAccountsRef.current();
	}, []);

	const handleLedgerAccountSelect = (accountId: string) => {
		setSelectedLedgerAccountId(accountId);
	};

	const handleLedgerAccountClear = () => {
		setSelectedLedgerAccountId(null);
	};

	return (
		<div className="px-4 py-6 sm:px-0">
			<div className="flex flex-col mb-4">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white">
					General Ledger
				</h1>
				<p className="text-sm text-gray-500">
					Import and manage transactions from your connected accounting
					integrations.
				</p>
			</div>

			<div className="space-y-6">
				{/* Import Section */}
				<ImportSection onImportComplete={handleImportComplete} />

				{/* Transactions and Ledger Accounts */}
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
					{/* Ledger Accounts Sidebar */}
					<LedgerAccountsSidebar
						selectedLedgerAccountId={selectedLedgerAccountId}
						onLedgerAccountSelect={handleLedgerAccountSelect}
						onLedgerAccountClear={handleLedgerAccountClear}
						onReloadData={useCallback((reloadFn) => {
							reloadLedgerAccountsRef.current = reloadFn;
						}, [])}
					/>

					{/* Transactions List */}
					<TransactionsList
						selectedLedgerAccountId={selectedLedgerAccountId}
						onLedgerAccountClear={handleLedgerAccountClear}
						onReloadData={useCallback((reloadFn) => {
							reloadTransactionsRef.current = reloadFn;
						}, [])}
					/>
				</div>
			</div>
		</div>
	);
}
