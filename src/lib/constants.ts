// Accounting integrations that support journal entries
export const ACCOUNTING_INTEGRATIONS = [
	"quickbooks",
	"xero",
	"sage",
	"freshbooks",
	"workday-soap",
] as const;

// Transaction types and their corresponding API actions
export const TRANSACTION_TYPES = [
	{ action: "get-journal-entries", classification: "journal-entry" },
	{ action: "get-sales-receipts", classification: "sales-receipt" },
	{ action: "get-payments", classification: "payment" },
	{ action: "get-credit-notes", classification: "credit-note" },
	{ action: "get-bills", classification: "bill" },
	{ action: "get-invoices", classification: "invoice" },
	{ action: "get-refunds", classification: "refund" },
	{ action: "get-bill-payments", classification: "bill-payment" },
] as const;

// Valid transaction classifications
export const TRANSACTION_CLASSIFICATIONS = [
	"journal-entry",
	"sales-receipt",
	"payment",
	"credit-note",
	"bill",
	"invoice",
	"refund",
	"bill-payment",
] as const;

// Field mapping configurations for different integrations
export const FIELD_MAPPING_CONFIGS = {
	quickbooks: "journal-entries",
	xero: "journal-entries",
	sage: "journal-entries",
	freshbooks: "journal-entries",
	workday: "journal-entries",
	workday_soap: "journal-entries",
	// Add more integrations and their field mapping keys as needed
} as const;

export type AccountingIntegrationKey = (typeof ACCOUNTING_INTEGRATIONS)[number];
