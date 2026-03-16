import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI!;

const AccountSchema = new mongoose.Schema(
  {
    name: String,
    type: String,
    stage: String,
    website: String,
    linkedinUrl: String,
    opportunityHypothesis: String,
    founderNote: String,
    nextAction: String,
    nextActionDate: Date,
    lastTouchpoint: Date,
  },
  { timestamps: true }
);

const SignalSchema = new mongoose.Schema(
  {
    accountId: mongoose.Schema.Types.ObjectId,
    type: String,
    source: String,
    title: String,
    note: String,
    url: String,
    status: String,
    date: Date,
  },
  { timestamps: true }
);

const Account = mongoose.model("Account", AccountSchema);
const Signal = mongoose.model("Signal", SignalSchema);

const SEED_ACCOUNTS = [
  {
    name: "Ginkgo Bioworks",
    type: "Customer",
    stage: "Pilot Discussion",
    website: "https://www.ginkgobioworks.com",
    opportunityHypothesis: "Leading synthetic biology platform with 3000+ fermentation runs/year. Scaling challenges reported in Q3 earnings. Digital twin could reduce batch failure rate by 15-20%.",
    founderNote: "Met CTO at SynBioBeta. Strong technical alignment. They're actively evaluating process optimization tools for their foundry.",
    nextAction: "Schedule demo call with VP Manufacturing",
    nextActionDate: new Date("2026-03-20"),
    lastTouchpoint: new Date("2026-03-12"),
  },
  {
    name: "Novozymes",
    type: "Partner",
    stage: "Engaged",
    website: "https://www.novozymes.com",
    opportunityHypothesis: "Global leader in biological solutions. Partnership could give Lemnisca access to enzyme production expertise and pilot facilities. Merging with Chr. Hansen creates even larger opportunity.",
    founderNote: "Innovation team is exploring digital tools for process optimization. Warm intro via YC network.",
    nextAction: "Send case study on fermentation optimization",
    nextActionDate: new Date("2026-03-18"),
    lastTouchpoint: new Date("2026-03-08"),
  },
  {
    name: "Culture Biosciences",
    type: "Customer",
    stage: "Researching",
    website: "https://www.culturebiosciences.com",
    opportunityHypothesis: "Cloud bioreactor company — they run fermentation-as-a-service. Digital twin integration could be a huge value-add for their customers. Natural platform partnership.",
    nextAction: "Find intro through shared investors",
    nextActionDate: new Date("2026-03-25"),
  },
  {
    name: "PointOne Capital",
    type: "Investor",
    stage: "Engaged",
    website: "https://www.pointonecapital.com",
    opportunityHypothesis: "Early-stage deep-tech VC with biotech focus. Already participated in pre-seed. Key relationship for seed round and strategic introductions.",
    founderNote: "Strong relationship with GP. Keep updated on traction metrics monthly.",
    nextAction: "Send monthly update with pilot metrics",
    nextActionDate: new Date("2026-03-30"),
    lastTouchpoint: new Date("2026-03-01"),
  },
  {
    name: "SynBioBeta",
    type: "Ecosystem",
    stage: "Engaged",
    website: "https://www.synbiobeta.com",
    opportunityHypothesis: "Premier synthetic biology conference and community. Key for visibility, recruiting, and BD connections in the biomanufacturing ecosystem.",
    founderNote: "Applied to speak at next conference. Good place to meet potential customers and partners.",
    nextAction: "Submit speaker application for fall conference",
    nextActionDate: new Date("2026-04-15"),
    lastTouchpoint: new Date("2026-02-20"),
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI, { dbName: "strategic-account-tracker" });
  console.log("Connected to MongoDB");

  await Account.deleteMany({});
  await Signal.deleteMany({});
  console.log("Cleared existing data");

  const accounts = await Account.insertMany(SEED_ACCOUNTS);
  console.log(`Created ${accounts.length} accounts`);

  const ginkgo = accounts.find((a) => a.name === "Ginkgo Bioworks")!;
  await Signal.insertMany([
    {
      accountId: ginkgo._id,
      type: "Hiring",
      source: "Serper",
      title: "Ginkgo Bioworks hires VP of Manufacturing Operations",
      status: "Confirmed",
      date: new Date("2026-03-12"),
    },
    {
      accountId: ginkgo._id,
      type: "Expansion",
      source: "RSS",
      title: "Ginkgo Bioworks announces new Boston manufacturing facility",
      url: "https://example.com/ginkgo-boston",
      status: "Confirmed",
      date: new Date("2026-03-05"),
    },
    {
      accountId: ginkgo._id,
      type: "Partnership",
      source: "Serper",
      title: "Ginkgo Bioworks partners with Bayer CropScience on bio-agriculture",
      url: "https://example.com/ginkgo-bayer",
      status: "Suggested",
      date: new Date("2026-02-20"),
    },
    {
      accountId: ginkgo._id,
      type: "Meeting",
      source: "Manual",
      title: "Met CTO at SynBioBeta conference",
      note: "Discussed digital twin approach. Strong interest in reducing batch failures.",
      status: "Confirmed",
      date: new Date("2026-02-10"),
    },
  ]);

  const novozymes = accounts.find((a) => a.name === "Novozymes")!;
  await Signal.insertMany([
    {
      accountId: novozymes._id,
      type: "News",
      source: "RSS",
      title: "Novozymes-Chr. Hansen merger creates global biosolutions leader",
      status: "Confirmed",
      date: new Date("2026-03-01"),
    },
    {
      accountId: novozymes._id,
      type: "Email",
      source: "Manual",
      title: "Introductory email to innovation team",
      note: "Warm intro from YC contact. Discussed potential collaboration areas.",
      status: "Confirmed",
      date: new Date("2026-03-08"),
    },
  ]);

  console.log("Created sample signals");
  console.log("Seed complete!");
  await mongoose.disconnect();
}

seed().catch(console.error);
