import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChatThread extends Document {
  accountId: Types.ObjectId;
  title: string;
  messages: { role: "user" | "model"; content: string; sources?: { title: string; url: string }[] }[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatThreadSchema = new Schema<IChatThread>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    title: { type: String, required: true },
    messages: {
      type: [
        {
          role: { type: String, enum: ["user", "model"], required: true },
          content: { type: String, required: true },
          sources: {
            type: [{ title: { type: String }, url: { type: String } }],
            default: [],
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const ChatThread: Model<IChatThread> =
  mongoose.models.ChatThread || mongoose.model<IChatThread>("ChatThread", ChatThreadSchema);

export default ChatThread;
