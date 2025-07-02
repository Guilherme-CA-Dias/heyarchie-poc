import { NextRequest, NextResponse } from "next/server";
import { JournalEntryModel } from "@/models/journal-entry";
import connectDB from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { journalEntries, connectionId, integrationId, integrationName } = body;

    if (!journalEntries || !Array.isArray(journalEntries)) {
      return NextResponse.json({ error: "Invalid journal entries data" }, { status: 400 });
    }

    // Prepare entries for bulk upsert
    const bulkOps = journalEntries.map((entry: any) => {
      // Log the first entry to debug field mapping
      if (journalEntries.indexOf(entry) === 0) {
        console.log('Sample journal entry being saved:', {
          id: entry.id,
          ledgerAccountId: entry.ledgerAccountId,
          hasLedgerAccountId: 'ledgerAccountId' in entry,
          fields: Object.keys(entry)
        });
      }
      
      return {
        updateOne: {
          filter: { id: entry.id, connectionId },
          update: {
            $set: {
              ...entry,
              connectionId,
              integrationId,
              integrationName,
              importedAt: new Date().toISOString(),
            },
          },
          upsert: true,
        },
      };
    });

    // Perform bulk upsert
    const result = await JournalEntryModel.bulkWrite(bulkOps);

    return NextResponse.json({
      success: true,
      inserted: result.upsertedCount,
      modified: result.modifiedCount,
      total: journalEntries.length,
    });

  } catch (error) {
    console.error("Error saving journal entries:", error);
    return NextResponse.json(
      { error: "Failed to save journal entries" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get("integrationId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const countOnly = searchParams.get("countOnly") === "true";

    // If countOnly is true, return counts by integration
    if (countOnly) {
      const pipeline = [
        {
          $group: {
            _id: "$integrationId",
            count: { $sum: 1 },
            integrationName: { $first: "$integrationName" }
          }
        },
        {
          $project: {
            integrationId: "$_id",
            count: 1,
            integrationName: 1,
            _id: 0
          }
        }
      ];

      const counts = await JournalEntryModel.aggregate(pipeline);
      
      // Get total count
      const totalCount = await JournalEntryModel.countDocuments({});

      return NextResponse.json({
        counts,
        total: totalCount
      });
    }

    // Build query
    const query: any = {};
    if (integrationId) {
      query.integrationId = integrationId;
    }

    // Get journal entries with pagination
    const journalEntries = await JournalEntryModel
      .find(query)
      .sort({ transactionDate: -1, createdTime: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // Get total count
    const total = await JournalEntryModel.countDocuments(query);

    return NextResponse.json({
      journalEntries,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error("Error fetching journal entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch journal entries" },
      { status: 500 }
    );
  }
} 