// Pending - This whole route needs to be changes to api/general-ledger/route.ts

import { NextRequest, NextResponse } from "next/server";
import { TransactionModel } from "@/models/journal-entry";
import connectDB from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { transactions, connectionId, integrationId, integrationName } = body;

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: "Invalid transactions data" }, { status: 400 });
    }

    // Prepare entries for bulk upsert
    const bulkOps = transactions.map((transaction: any) => {
      // Log the first entry to debug field mapping
      if (transactions.indexOf(transaction) === 0) {
        console.log('Sample transaction being saved:', {
          id: transaction.id,
          integrationId,
          connectionId,
          classification: transaction.classification,
          ledgerAccountId: transaction.ledgerAccountId,
          hasLedgerAccountId: 'ledgerAccountId' in transaction,
          fields: Object.keys(transaction)
        });
      }
      
      return {
        updateOne: {
          filter: { id: transaction.id, integrationId, connectionId },
          update: {
            $set: {
              ...transaction,
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
    const result = await TransactionModel.bulkWrite(bulkOps);

    return NextResponse.json({
      success: true,
      inserted: result.upsertedCount,
      modified: result.modifiedCount,
      total: transactions.length,
    });

  } catch (error) {
    console.error("Error saving transactions:", error);
    return NextResponse.json(
      { error: "Failed to save transactions" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get("integrationId");
    const classification = searchParams.get("classification");
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

      const counts = await TransactionModel.aggregate(pipeline);
      
      // Get total count
      const totalCount = await TransactionModel.countDocuments({});

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
    if (classification) {
      query.classification = classification;
    }

    // Get transactions with pagination
    const transactions = await TransactionModel
      .find(query)
      .sort({ transactionDate: -1, createdTime: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // Get total count
    const total = await TransactionModel.countDocuments(query);

    return NextResponse.json({
      transactions,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
} 