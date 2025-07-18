export interface TransactionLineItem {
	id: string;
	description?: string;
	amount: number;
	type: string;
	postingType?: string;
	dimension?: string;
	ledgerAccountId?: string;
	accountRef?: {
		value: string;
		name: string;
	};
	// Dimension fields
	dimension_className?: string | null;
	dimension_classValue?: string | null;
	dimension_itemName?: string | null;
	dimension_itemValue?: string | null;
	dimension_customerName?: string | null;
	dimension_customerValue?: string | null;
	dimension_locationName?: string | null;
	dimension_locationValue?: string | null;
	dimension_projectName?: string | null;
	dimension_projectValue?: string | null;
}

export interface Transaction {
	id: string;
	number?: string;
	memo?: string;
	currency: string;
	ledgerAccountId?: string;
	lineItems: TransactionLineItem[];
	transactionDate: string;
	createdTime: string;
	updatedTime: string;
	integrationId?: string;
	integrationName?: string;
	connectionId?: string;
	classification: string;
	totalAmount?: number;
	rawFields?: any;
}

export interface LedgerAccount {
	id: string;
	name: string;
	type: string;
	classification?: string;
	integrationId?: string;
	integrationName?: string;
	connectionId?: string;
	rawFields?: any;
}

export interface ImportResult {
	integrationId: string;
	integrationName: string;
	success: boolean;
	count: number;
	error?: string;
}
