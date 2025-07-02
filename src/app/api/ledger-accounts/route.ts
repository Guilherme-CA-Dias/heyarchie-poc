import { NextRequest, NextResponse } from "next/server";
import { LedgerAccountModel } from "@/models/ledger-account";
import connectDB from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { ledgerAccounts, connectionId, integrationId, integrationName } = body;

    if (!ledgerAccounts || !Array.isArray(ledgerAccounts)) {
      return NextResponse.json({ error: "Invalid ledger accounts data" }, { status: 400 });
    }

    // Prepare entries for bulk upsert
    const bulkOps = ledgerAccounts.map((account: any) => {
      // Log the first account to debug field mapping
      if (ledgerAccounts.indexOf(account) === 0) {
        console.log('Sample ledger account being saved:', {
          id: account.id,
          integrationId,
          connectionId,
          name: account.name,
          fields: Object.keys(account)
        });
      }
      
      return {
        updateOne: {
          filter: { id: account.id, integrationId, connectionId },
          update: {
            $set: {
              ...account,
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
    const result = await LedgerAccountModel.bulkWrite(bulkOps);

    return NextResponse.json({
      success: true,
      inserted: result.upsertedCount,
      modified: result.modifiedCount,
      total: ledgerAccounts.length,
    });

  } catch (error) {
    console.error("Error saving ledger accounts:", error);
    return NextResponse.json(
      { error: "Failed to save ledger accounts" },
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

      const counts = await LedgerAccountModel.aggregate(pipeline);
      
      // Get total count
      const totalCount = await LedgerAccountModel.countDocuments({});

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

    // Get ledger accounts with pagination
    const ledgerAccounts = await LedgerAccountModel
      .find(query)
      .sort({ name: 1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // Get total count
    const total = await LedgerAccountModel.countDocuments(query);

    return NextResponse.json({
      ledgerAccounts,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error("Error fetching ledger accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch ledger accounts" },
      { status: 500 }
    );
  }
} 