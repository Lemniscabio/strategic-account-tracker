import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const { date, note, outcome } = await request.json();

  if (!date || !note) {
    return NextResponse.json({ error: "date and note are required" }, { status: 400 });
  }

  const touchpoint = { date: new Date(date), note, outcome: outcome || "" };

  const account = await Account.findByIdAndUpdate(
    id,
    {
      $push: { touchpoints: touchpoint },
    },
    { new: true, runValidators: true }
  ).lean();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Update lastTouchpoint to the most recent touchpoint date
  const maxDate = (account.touchpoints || []).reduce((max: Date, tp: { date: Date }) => {
    const d = new Date(tp.date);
    return d > max ? d : max;
  }, new Date(0));

  await Account.findByIdAndUpdate(id, { lastTouchpoint: maxDate });

  return NextResponse.json({ success: true, touchpoint });
}
