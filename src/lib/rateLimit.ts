import { createHash } from "crypto";
import clientPromise from "./mongodb";

export const GLOBAL_LIMIT = 40;

export const FEATURE_LIMITS = {
  analyze: 2,
  documents: 2,
} as const;

export type Feature = keyof typeof FEATURE_LIMITS;

function getAESTDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
  }).format(new Date());
}

function hashIP(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

async function ensureIndexes() {
  const client = await clientPromise;
  const db = client.db();
  await Promise.all([
    db.collection("ip_usage").createIndex({ ip: 1, date: 1 }, { unique: true }),
    db.collection("ip_usage").createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: 172800 }
    ),
    db.collection("global_usage").createIndex({ date: 1 }, { unique: true }),
    db.collection("global_usage").createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: 172800 }
    ),
  ]);
}

let indexesReady = false;
async function getDB() {
  const client = await clientPromise;
  const db = client.db();
  if (!indexesReady) {
    await ensureIndexes();
    indexesReady = true;
  }
  return db;
}

export type FeatureRateLimitResult =
  | { allowed: true; featureCount: number; globalCount: number }
  | { allowed: false; reason: "feature_limit" | "global_limit"; featureCount: number; globalCount: number };

export async function checkAndIncrementFeature(
  rawIP: string,
  feature: Feature
): Promise<FeatureRateLimitResult> {
  const db = await getDB();
  const date = getAESTDate();
  const ip = hashIP(rawIP);
  const now = new Date();
  const limit = FEATURE_LIMITS[feature];

  // Check global limit first
  const globalDoc = await db.collection("global_usage").findOne({ date });
  if (globalDoc && globalDoc.count >= GLOBAL_LIMIT) {
    return { allowed: false, reason: "global_limit", featureCount: 0, globalCount: globalDoc.count };
  }

  // Check feature-specific IP limit
  const ipDoc = await db.collection("ip_usage").findOne({ ip, date });
  const featureCount: number = ipDoc?.[feature] ?? 0;
  if (featureCount >= limit) {
    return { allowed: false, reason: "feature_limit", featureCount, globalCount: globalDoc?.count ?? 0 };
  }

  // Increment both
  const [updatedIP, updatedGlobal] = await Promise.all([
    db.collection("ip_usage").findOneAndUpdate(
      { ip, date },
      { $inc: { [feature]: 1 }, $set: { updatedAt: now } },
      { upsert: true, returnDocument: "after" }
    ),
    db.collection("global_usage").findOneAndUpdate(
      { date },
      { $inc: { count: 1 }, $set: { updatedAt: now } },
      { upsert: true, returnDocument: "after" }
    ),
  ]);

  return {
    allowed: true,
    featureCount: (updatedIP?.[feature] as number | undefined) ?? 1,
    globalCount: updatedGlobal?.count ?? 1,
  };
}

export async function checkAndIncrementGlobal(): Promise<
  { allowed: true; globalCount: number } | { allowed: false; globalCount: number }
> {
  const db = await getDB();
  const date = getAESTDate();
  const now = new Date();

  const globalDoc = await db.collection("global_usage").findOne({ date });
  if (globalDoc && globalDoc.count >= GLOBAL_LIMIT) {
    return { allowed: false, globalCount: globalDoc.count };
  }

  const updatedGlobal = await db.collection("global_usage").findOneAndUpdate(
    { date },
    { $inc: { count: 1 }, $set: { updatedAt: now } },
    { upsert: true, returnDocument: "after" }
  );

  return { allowed: true, globalCount: updatedGlobal?.count ?? 1 };
}

export async function getUsageStatus(rawIP: string): Promise<{
  analyze: number;
  documents: number;
  globalCount: number;
}> {
  const db = await getDB();
  const date = getAESTDate();
  const ip = hashIP(rawIP);

  const [ipDoc, globalDoc] = await Promise.all([
    db.collection("ip_usage").findOne({ ip, date }),
    db.collection("global_usage").findOne({ date }),
  ]);

  return {
    analyze: (ipDoc?.analyze as number | undefined) ?? 0,
    documents: (ipDoc?.documents as number | undefined) ?? 0,
    globalCount: globalDoc?.count ?? 0,
  };
}

export function getResetTimeISO(): string {
  const date = getAESTDate();
  const [y, m, d] = date.split("-").map(Number);
  const tomorrowMidnightUTC = Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 10 * 3600 * 1000;
  return new Date(tomorrowMidnightUTC).toISOString();
}
