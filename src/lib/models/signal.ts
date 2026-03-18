import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { SIGNAL_TYPES, SIGNAL_SOURCES, SIGNAL_STATUSES, SignalType, SignalSource, SignalStatus } from "../constants";

export interface ISignal extends Document {
  accountId: Types.ObjectId;
  type: SignalType;
  source: SignalSource;
  title: string;
  note?: string;
  url?: string;
  status: SignalStatus;
  date: Date;
  snippet?: string;
  relevanceScore?: number;
  scoreReason?: string;
  createdAt: Date;
}

const SignalSchema = new Schema<ISignal>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    type: { type: String, enum: SIGNAL_TYPES, required: true },
    source: { type: String, enum: SIGNAL_SOURCES, required: true },
    title: { type: String, required: true },
    note: { type: String },
    url: { type: String },
    status: { type: String, enum: SIGNAL_STATUSES, required: true },
    date: { type: Date, required: true },
    snippet: { type: String },
    relevanceScore: { type: Number, min: 1, max: 5 },
    scoreReason: { type: String },
  },
  { timestamps: true }
);

const Signal: Model<ISignal> =
  mongoose.models.Signal || mongoose.model<ISignal>("Signal", SignalSchema);

export default Signal;
