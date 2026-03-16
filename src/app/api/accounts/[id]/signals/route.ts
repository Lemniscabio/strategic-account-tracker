import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Signal from "@/lib/models/signal";
import Account from "@/lib/models/account";
import { TOUCHPOINT_TYPES } from "@/lib/constants";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const signals = await Signal.find({ accountId: id, status: { $ne: "Dismissed" } })
    .sort({ date: -1 })
    .lean();
  return NextResponse.json(signals);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const body = await request.json();

  const signal = await Signal.create({
    ...body,
    accountId: id,
    source: "Manual",
    status: "Confirmed",
  });

  // Auto-update lastTouchpoint for touchpoint-type signals
  if (TOUCHPOINT_TYPES.includes(body.type)) {
    await Account.findByIdAndUpdate(id, { lastTouchpoint: body.date });
  }

  return NextResponse.json(signal, { status: 201 });
}
