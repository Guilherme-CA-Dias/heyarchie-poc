// Accounting integrations that support journal entries
export const ACCOUNTING_INTEGRATIONS = ['quickbooks', 'xero', 'sage', 'freshbooks'] as const;

// Field mapping configurations for different integrations
export const FIELD_MAPPING_CONFIGS = {
  'quickbooks': 'journal-entries',
  'xero': 'journal-entries',
  'sage': 'journal-entries',
  'freshbooks': 'journal-entries',
  // Add more integrations and their field mapping keys as needed
} as const;

export type AccountingIntegrationKey = typeof ACCOUNTING_INTEGRATIONS[number]; 