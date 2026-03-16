import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import { enrichAccount } from "@/lib/enrichment/enrich";

export async function POST() {
  await dbConnect();
  const accounts = await Account.find().lean();

  let totalNew = 0;
  for (const account of accounts) {
    const count = await enrichAccount(account._id.toString(), account.name);
    totalNew += count;
  }

  return NextResponse.json({ accountsProcessed: accounts.length, newSignals: totalNew });
}
