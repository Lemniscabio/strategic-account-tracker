import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Signal from "@/lib/models/signal";
import Account from "@/lib/models/account";
import { TOUCHPOINT_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const signals = await Signal.aggregate([
    { $match: { accountId: new Types.ObjectId(id), status: { $ne: "Dismissed" } } },
    { $addFields: { hasScore: { $cond: [{ $ifNull: ["$relevanceScore", false] }, 1, 0] } } },
    { $sort: { hasScore: -1, relevanceScore: -1, date: -1 } },
    { $project: { hasScore: 0 } },
  ]);
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
