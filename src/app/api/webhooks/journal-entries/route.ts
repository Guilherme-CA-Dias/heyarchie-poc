// Pending - This whole route needs to be changes to api/webhooks/general-ledger/route.ts

import { verifyIntegrationAppToken } from "@/lib/integration-app-auth";
import { NextRequest, NextResponse } from "next/server";
import { TransactionModel } from "@/models/journal-entry";
import connectDB from "@/lib/mongodb";
import { z } from "zod";

const transactionWebhookSchema = z.object({
  connectionId: z.string(),
  fields: z.object({
    id: z.string().min(1),
    externalTransactionId: z.string().optional(),
    data: z.record(z.any()),
    integrationId: z.string().optional(),
    integrationName: z.string().optional(),
    classification: z.string().optional(),
  }),
});

const transactionDeleteSchema = z.object({
  connectionId: z.string(),
  externalTransactionId: z.string(),
});

/**
 * This webhook is triggered when a transaction is created or updated on external accounting systems
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  console.log("Transaction Webhook Body:", body);

  const verificationResult = await verifyIntegrationAppToken(request);

  if (!verificationResult) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id: userId } = verificationResult;

  console.log("Extracted user ID from token:", userId);

  const payload = transactionWebhookSchema.safeParse(body);

  if (!payload.success) {
    console.error("Invalid transaction webhook payload:", payload.error);
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 }
    );
  }

  const { fields, connectionId } = payload.data;

  console.log("Processing webhook for connection:", connectionId);

  // For now, let's proceed even if we don't have a user ID from the connection
  // We'll use the user ID from the JWT token instead
  if (!userId) {
    console.warn("No user ID found in JWT token, proceeding with connection ID only");
  }

  try {
    await connectDB();

    // Extract the external transaction ID and data
    const externalTransactionId = fields.externalTransactionId || fields.id;
    const data = fields.data || fields;
    const integrationId = fields.integrationId;
    const integrationName = fields.integrationName;
    // Don't override classification - let it come from the API as-is
    const classification = fields.classification;

    console.log(`Processing transaction webhook for ${externalTransactionId} from ${integrationName} (${classification})`);

    // Prepare the transaction data
    const transactionData = {
      ...data,
      id: externalTransactionId,
      integrationId,
      integrationName,
      connectionId,
      // Only add classification if it exists in the original data
      ...(classification && { classification }),
      userId: userId || 'unknown', // Use 'unknown' as fallback if no user ID
      updatedAt: new Date().toISOString(),
      // Preserve existing fields if they exist
      importedAt: data.importedAt || new Date().toISOString(),
      rawFields: data.rawFields || data,
    };

    // Try to find existing entry by external ID and connection
    const existingEntry = await TransactionModel.findOne({
      id: externalTransactionId,
      connectionId: connectionId,
    });

    if (existingEntry) {
      // Update existing entry
      const updatedEntry = await TransactionModel.findOneAndUpdate(
        {
          id: externalTransactionId,
          connectionId: connectionId,
        },
        {
          $set: transactionData,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedEntry) {
        throw new Error("Failed to update transaction");
      }

      console.log(`Updated transaction ${externalTransactionId} from ${integrationName} (${classification})`);
      
      return NextResponse.json({
        success: true,
        action: "updated",
        transactionId: updatedEntry._id,
        externalTransactionId,
        integrationName,
        classification,
        userId: userId || 'unknown',
      });
    } else {
      // Create new entry
      const newEntry = new TransactionModel(transactionData);
      await newEntry.save();

      console.log(`Created new transaction ${externalTransactionId} from ${integrationName} (${classification})`);
      
      return NextResponse.json({
        success: true,
        action: "created",
        transactionId: newEntry._id,
        externalTransactionId,
        integrationName,
        classification,
        userId: userId || 'unknown',
      });
    }

  } catch (error) {
    console.error("Error processing transaction webhook:", error);
    return NextResponse.json(
      { 
        error: "Failed to process webhook",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET endpoint for webhook verification
export async function GET() {
  return NextResponse.json({
    status: "transactions webhook endpoint active",
    message: "POST requests with transaction data are accepted, DELETE requests for deletion",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle DELETE requests to remove transactions
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json();

  console.log("Transaction Delete Webhook Body:", body);

  const verificationResult = await verifyIntegrationAppToken(request);

  if (!verificationResult) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id: userId } = verificationResult;

  console.log("Extracted user ID from token:", userId);

  const deletePayload = transactionDeleteSchema.safeParse(body);

  if (!deletePayload.success) {
    console.error("Invalid transaction delete webhook payload:", deletePayload.error);
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 }
    );
  }

  const { connectionId, externalTransactionId } = deletePayload.data;

  console.log("Processing delete webhook for connection:", connectionId);

  if (!userId) {
    console.warn("No user ID found in JWT token, proceeding with connection ID only");
  }

  try {
    await connectDB();

    console.log(`Processing delete webhook for transaction ${externalTransactionId}`);

    // Find and delete the transaction
    const deletedEntry = await TransactionModel.findOneAndDelete({
      id: externalTransactionId,
      connectionId: connectionId,
    });

    if (!deletedEntry) {
      console.log(`Transaction ${externalTransactionId} not found for deletion`);
      return NextResponse.json({
        success: true,
        action: "not_found",
        message: "Transaction not found for deletion",
        externalTransactionId,
        userId: userId || 'unknown',
      });
    }

    console.log(`Deleted transaction ${externalTransactionId}`);
    
    return NextResponse.json({
      success: true,
      action: "deleted",
      transactionId: deletedEntry._id,
      externalTransactionId,
      userId: userId || 'unknown',
    });

  } catch (error) {
    console.error("Error processing transaction delete webhook:", error);
    return NextResponse.json(
      { 
        error: "Failed to process delete webhook",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}