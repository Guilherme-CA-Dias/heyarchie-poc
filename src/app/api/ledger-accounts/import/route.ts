import { NextRequest, NextResponse } from "next/server";
import { LedgerAccountModel } from "@/models/ledger-account";
import connectDB from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { ledgerAccounts, connectionId, integrationId, integrationName, userId } = body;

    if (!ledgerAccounts || !Array.isArray(ledgerAccounts)) {
      return NextResponse.json({ error: "Invalid ledger accounts data" }, { status: 400 });
    }

    // Prepare entries for bulk upsert
    const bulkOps = ledgerAccounts.map((account: any) => {
      return {
        updateOne: {
          filter: { id: account.id, connectionId },
          update: {
            $set: {
              ...account,
              connectionId,
              integrationId,
              integrationName,
              userId,
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
    console.error("Error importing ledger accounts:", error);
    return NextResponse.json(
      { error: "Failed to import ledger accounts" },
      { status: 500 }
    );
  }
} 