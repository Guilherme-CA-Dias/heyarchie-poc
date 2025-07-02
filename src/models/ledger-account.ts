import { Schema, model, models } from "mongoose";

export interface LedgerAccount {
  _id: string;
  id: string;
  name: string;
  type: string;
  status: string;
  currentBalance: number;
  currency: string;
  createdTime: string;
  updatedTime: string;
  classification: string;
  connectionId: string;
  integrationId: string;
  integrationName: string;
  userId: string;
  importedAt: string;
  rawFields?: any;
}

const ledgerAccountSchema = new Schema<LedgerAccount>({
  id: String,
  name: String,
  type: String,
  status: String,
  currentBalance: Number,
  currency: String,
  createdTime: String,
  updatedTime: String,
  classification: String,
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
ledgerAccountSchema.index({ id: 1, connectionId: 1 }, { unique: true });

// Create indexes for efficient querying
ledgerAccountSchema.index({ integrationId: 1 });
ledgerAccountSchema.index({ userId: 1 });
ledgerAccountSchema.index({ classification: 1 });
ledgerAccountSchema.index({ status: 1 });

// Delete the model if it exists to prevent overwrite issues during development
if (models.LedgerAccount) {
  delete models.LedgerAccount;
}

export const LedgerAccountModel = model<LedgerAccount>("LedgerAccount", ledgerAccountSchema); 