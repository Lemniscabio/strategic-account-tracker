import mongoose, { Schema, Document, Model } from "mongoose";
import { ACCOUNT_TYPES, STAGES, ACCOUNT_TIERS, AccountType, Stage, AccountTier } from "../constants";

export interface IAccount extends Document {
  name: string;
  type: AccountType;
  stage: Stage;
  tier: AccountTier;
  website?: string;
  linkedinUrl?: string;
  opportunityHypothesis: string;
  founderNote?: string;
  nextAction?: string;
  nextActionDate?: Date;
  lastTouchpoint?: Date;
  keywords: string[];
  touchpoints: { date: Date; note: string; outcome: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ACCOUNT_TYPES, required: true },
    stage: { type: String, enum: STAGES, required: true },
    tier: { type: String, enum: ACCOUNT_TIERS, required: true, default: "C" },
    website: { type: String },
    linkedinUrl: { type: String },
    opportunityHypothesis: { type: String, required: true },
    founderNote: { type: String },
    nextAction: { type: String },
    nextActionDate: { type: Date },
    lastTouchpoint: { type: Date },
    keywords: { type: [String], default: [] },
    touchpoints: {
      type: [
        {
          date: { type: Date, required: true },
          note: { type: String, required: true },
          outcome: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const Account: Model<IAccount> =
  mongoose.models.Account || mongoose.model<IAccount>("Account", AccountSchema);

export default Account;
