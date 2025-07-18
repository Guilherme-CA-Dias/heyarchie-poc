import { Schema, model, models } from "mongoose";
import { TRANSACTION_CLASSIFICATIONS } from "@/lib/constants";

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
	dimension_className?: string;
	dimension_classValue?: string;
	dimension_itemName?: string;
	dimension_itemValue?: string;
	dimension_customerName?: string;
	dimension_customerValue?: string;
	dimension_locationName?: string;
	dimension_locationValue?: string;
	dimension_projectName?: string;
	dimension_projectValue?: string;
}

export interface Transaction {
	_id: string;
	id: string;
	number?: string;
	memo?: string;
	currency: string;
	ledgerAccountId?: string;
	lineItems: TransactionLineItem[];
	transactionDate: string;
	createdTime: string;
	updatedTime: string;
	connectionId: string;
	integrationId: string;
	integrationName: string;
	userId: string;
	importedAt: string;
	classification?: string; // Type of transaction - comes directly from API
	totalAmount?: number; // Total amount from API
	rawFields?: any; // Store the complete raw response for reference
}

const transactionLineItemSchema = new Schema<TransactionLineItem>({
	id: String,
	description: String,
	amount: Number,
	type: String,
	postingType: String,
	dimension: String,
	ledgerAccountId: String,
	accountRef: {
		value: String,
		name: String,
	},
	// Dimension fields
	dimension_className: String,
	dimension_classValue: String,
	dimension_itemName: String,
	dimension_itemValue: String,
	dimension_customerName: String,
	dimension_customerValue: String,
	dimension_locationName: String,
	dimension_locationValue: String,
	dimension_projectName: String,
	dimension_projectValue: String,
});

const transactionSchema = new Schema<Transaction>({
	id: String,
	number: String,
	memo: String,
	currency: String,
	ledgerAccountId: String,
	lineItems: [transactionLineItemSchema],
	transactionDate: String,
	createdTime: String,
	updatedTime: String,
	connectionId: String,
	integrationId: String,
	integrationName: String,
	userId: String,
	importedAt: {
		type: String,
		default: () => new Date().toISOString(),
	},
	classification: {
		type: String,
		enum: TRANSACTION_CLASSIFICATIONS,
		required: false, // Optional since it comes from API
	},
	totalAmount: {
		type: Number,
		required: false, // Optional since it comes from API
	},
	rawFields: {
		type: Schema.Types.Mixed,
		default: null,
	},
});

// Create compound unique index on business key (id + connectionId to handle same IDs across integrations)
transactionSchema.index({ id: 1, connectionId: 1 }, { unique: true });

// Create indexes for efficient querying
transactionSchema.index({ userId: 1, integrationId: 1 });
transactionSchema.index({ integrationId: 1, classification: 1 });
transactionSchema.index({ transactionDate: -1 });
transactionSchema.index({ createdTime: -1 });
transactionSchema.index({ classification: 1 });

// For backward compatibility, keep the old model name but use new schema
if (models.JournalEntry) {
	delete models.JournalEntry;
}

export const TransactionModel = model<Transaction>(
	"JournalEntry",
	transactionSchema
);

// Export the old interface names for backward compatibility
export type JournalEntry = Transaction;
export type JournalEntryLineItem = TransactionLineItem;
export const JournalEntryModel = TransactionModel;
