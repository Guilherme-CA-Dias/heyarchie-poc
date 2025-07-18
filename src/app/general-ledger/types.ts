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
