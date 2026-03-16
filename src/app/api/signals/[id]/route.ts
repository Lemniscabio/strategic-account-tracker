import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Signal from "@/lib/models/signal";
import Account from "@/lib/models/account";
import { TOUCHPOINT_TYPES } from "@/lib/constants";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const body = await request.json();
  const signal = await Signal.findByIdAndUpdate(id, body, { new: true }).lean();
  if (!signal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If confirming a touchpoint-type signal, update lastTouchpoint
  if (body.status === "Confirmed" && TOUCHPOINT_TYPES.includes(signal.type)) {
    await Account.findByIdAndUpdate(signal.accountId, { lastTouchpoint: signal.date });
  }

  return NextResponse.json(signal);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const signal = await Signal.findByIdAndDelete(id);
  if (!signal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
