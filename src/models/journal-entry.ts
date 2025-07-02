import { Schema, model, models } from "mongoose";

export interface JournalEntryLineItem {
  id: string;
  description?: string;
  amount: number;
  type: string;
  postingType?: string;
  dimension?: string;
  accountRef?: {
    value: string;
    name: string;
  };
}

export interface JournalEntry {
  _id: string;
  id: string;
  number?: string;
  memo?: string;
  currency: string;
  ledgerAccountId?: string;
  lineItems: JournalEntryLineItem[];
  transactionDate: string;
  createdTime: string;
  updatedTime: string;
  connectionId: string;
  integrationId: string;
  integrationName: string;
  userId: string;
  importedAt: string;
  rawFields?: any; // Store the complete raw response for reference
}

const journalEntryLineItemSchema = new Schema<JournalEntryLineItem>({
  id: String,
  description: String,
  amount: Number,
  type: String,
  postingType: String,
  dimension: String,
  accountRef: {
    value: String,
    name: String,
  },
});

const journalEntrySchema = new Schema<JournalEntry>({
  id: String,
  number: String,
  memo: String,
  currency: String,
  ledgerAccountId: String,
  lineItems: [journalEntryLineItemSchema],
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
  rawFields: {
    type: Schema.Types.Mixed,
    default: null,
  },
});

// Create compound unique index on business key (id + connectionId to handle same IDs across integrations)
journalEntrySchema.index({ id: 1, connectionId: 1 }, { unique: true });

// Create indexes for efficient querying
journalEntrySchema.index({ userId: 1, integrationId: 1 });
journalEntrySchema.index({ transactionDate: 1 });
journalEntrySchema.index({ importedAt: 1 });

if (models.JournalEntry) {
  delete models.JournalEntry;
}

export const JournalEntryModel = model<JournalEntry>("JournalEntry", journalEntrySchema); 