// src/app/api/webhooks/journal-entries/route.ts

import { verifyIntegrationAppToken } from "@/lib/integration-app-auth";
import { NextRequest, NextResponse } from "next/server";
import { JournalEntryModel } from "@/models/journal-entry";
import connectDB from "@/lib/mongodb";
import { z } from "zod";

const journalEntryWebhookSchema = z.object({
  connectionId: z.string(),
  fields: z.object({
    id: z.string().min(1),
    externalJournalEntryId: z.string().optional(),
    data: z.record(z.any()),
    integrationId: z.string().optional(),
    integrationName: z.string().optional(),
  }),
});

const journalEntryDeleteSchema = z.object({
  connectionId: z.string(),
  externalJournalEntryId: z.string(),
});

/**
 * This webhook is triggered when a journal entry is created or updated on external accounting systems
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  console.log("Journal Entry Webhook Body:", body);

  const verificationResult = await verifyIntegrationAppToken(request);

  if (!verificationResult) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id: userId } = verificationResult;

  console.log("Extracted user ID from token:", userId);

  const payload = journalEntryWebhookSchema.safeParse(body);

  if (!payload.success) {
    console.error("Invalid journal entry webhook payload:", payload.error);
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

    // Extract the external journal entry ID and data
    const externalJournalEntryId = fields.externalJournalEntryId || fields.id;
    const data = fields.data || fields;
    const integrationId = fields.integrationId;
    const integrationName = fields.integrationName;

    console.log(`Processing journal entry webhook for ${externalJournalEntryId} from ${integrationName}`);

    // Prepare the journal entry data
    const journalEntryData = {
      ...data,
      id: externalJournalEntryId,
      integrationId,
      integrationName,
      connectionId,
      userId: userId || 'unknown', // Use 'unknown' as fallback if no user ID
      updatedAt: new Date().toISOString(),
      // Preserve existing fields if they exist
      importedAt: data.importedAt || new Date().toISOString(),
      rawFields: data.rawFields || data,
    };

    // Try to find existing entry by external ID and connection
    const existingEntry = await JournalEntryModel.findOne({
      id: externalJournalEntryId,
      connectionId: connectionId,
    });

    if (existingEntry) {
      // Update existing entry
      const updatedEntry = await JournalEntryModel.findOneAndUpdate(
        {
          id: externalJournalEntryId,
          connectionId: connectionId,
        },
        {
          $set: journalEntryData,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedEntry) {
        throw new Error("Failed to update journal entry");
      }

      console.log(`Updated journal entry ${externalJournalEntryId} from ${integrationName}`);
      
      return NextResponse.json({
        success: true,
        action: "updated",
        journalEntryId: updatedEntry._id,
        externalJournalEntryId,
        integrationName,
        userId: userId || 'unknown',
      });
    } else {
      // Create new entry
      const newEntry = new JournalEntryModel(journalEntryData);
      await newEntry.save();

      console.log(`Created new journal entry ${externalJournalEntryId} from ${integrationName}`);
      
      return NextResponse.json({
        success: true,
        action: "created",
        journalEntryId: newEntry._id,
        externalJournalEntryId,
        integrationName,
        userId: userId || 'unknown',
      });
    }

  } catch (error) {
    console.error("Error processing journal entry webhook:", error);
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
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "journal entries webhook endpoint active",
    message: "POST requests with journal entry data are accepted, DELETE requests for deletion",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle DELETE requests to remove journal entries
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json();

  console.log("Journal Entry Delete Webhook Body:", body);

  const verificationResult = await verifyIntegrationAppToken(request);

  if (!verificationResult) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id: userId } = verificationResult;

  console.log("Extracted user ID from token:", userId);

  const deletePayload = journalEntryDeleteSchema.safeParse(body);

  if (!deletePayload.success) {
    console.error("Invalid journal entry delete webhook payload:", deletePayload.error);
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 }
    );
  }

  const { connectionId, externalJournalEntryId } = deletePayload.data;

  console.log("Processing delete webhook for connection:", connectionId);

  if (!userId) {
    console.warn("No user ID found in JWT token, proceeding with connection ID only");
  }

  try {
    await connectDB();

    console.log(`Processing delete webhook for journal entry ${externalJournalEntryId}`);

    // Find and delete the journal entry
    const deletedEntry = await JournalEntryModel.findOneAndDelete({
      id: externalJournalEntryId,
      connectionId: connectionId,
    });

    if (!deletedEntry) {
      console.log(`Journal entry ${externalJournalEntryId} not found for deletion`);
      return NextResponse.json({
        success: true,
        action: "not_found",
        message: "Journal entry not found for deletion",
        externalJournalEntryId,
        userId: userId || 'unknown',
      });
    }

    console.log(`Deleted journal entry ${externalJournalEntryId}`);
    
    return NextResponse.json({
      success: true,
      action: "deleted",
      journalEntryId: deletedEntry._id,
      externalJournalEntryId,
      userId: userId || 'unknown',
    });

  } catch (error) {
    console.error("Error processing journal entry delete webhook:", error);
    return NextResponse.json(
      { 
        error: "Failed to process delete webhook",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}