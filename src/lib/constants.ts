// Accounting integrations that support journal entries
export const ACCOUNTING_INTEGRATIONS = ['quickbooks', 'xero', 'sage', 'freshbooks'] as const;

// Transaction types and their corresponding API actions
export const TRANSACTION_TYPES = [
  { action: 'get-journal-entries', classification: 'journal-entry' },
  { action: 'get-sales-receipts', classification: 'sales-receipt' },
  { action: 'get-payments', classification: 'payment' },
  { action: 'get-credit-notes', classification: 'credit-note' },
  { action: 'get-bills', classification: 'bill' },
  { action: 'get-invoices', classification: 'invoice' }
] as const;

// Valid transaction classifications
export const TRANSACTION_CLASSIFICATIONS = [
  'journal-entry',
  'sales-receipt', 
  'payment',
  'credit-note',
  'bill',
  'invoice'
] as const;

// Field mapping configurations for different integrations
export const FIELD_MAPPING_CONFIGS = {
  'quickbooks': 'journal-entries',
  'xero': 'journal-entries',
  'sage': 'journal-entries',
  'freshbooks': 'journal-entries',
  // Add more integrations and their field mapping keys as needed
} as const;

export type AccountingIntegrationKey = typeof ACCOUNTING_INTEGRATIONS[number]; 