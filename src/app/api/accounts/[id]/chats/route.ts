import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import ChatThread from "@/lib/models/chatThread";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const threads = await ChatThread.find({ accountId: id })
    .select("title updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(threads);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const { title } = await request.json();

  const thread = await ChatThread.create({
    accountId: id,
    title: (title || "New Chat").slice(0, 50),
    messages: [],
  });

  return NextResponse.json(thread, { status: 201 });
}
