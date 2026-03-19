import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import ChatThread from "@/lib/models/chatThread";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  await dbConnect();
  const { threadId } = await params;

  const thread = await ChatThread.findById(threadId).lean();
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  return NextResponse.json(thread);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  await dbConnect();
  const { threadId } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};
  if (body.messages) update.messages = body.messages;
  if (body.title) update.title = body.title;

  const thread = await ChatThread.findByIdAndUpdate(threadId, update, { new: true }).lean();
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  return NextResponse.json(thread);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  await dbConnect();
  const { threadId } = await params;

  await ChatThread.findByIdAndDelete(threadId);
  return NextResponse.json({ success: true });
}
