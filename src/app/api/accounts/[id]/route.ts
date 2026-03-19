import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import ChatThread from "@/lib/models/chatThread";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const account = await Account.findById(id).lean();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const body = await request.json();
  const account = await Account.findByIdAndUpdate(id, body, { new: true, runValidators: true }).lean();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  await ChatThread.deleteMany({ accountId: id });
  const account = await Account.findByIdAndDelete(id);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
