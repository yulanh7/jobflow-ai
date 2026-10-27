import { createHash } from "crypto";
import { MongoServerError, type Db } from "mongodb";
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

export type RefundFn = () => Promise<void>;

export type FeatureRateLimitResult =
  | { allowed: true; featureCount: number; globalCount: number; refund: RefundFn }
  | { allowed: false; reason: "feature_limit" | "global_limit"; featureCount: number; globalCount: number };

function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof MongoServerError && err.code === 11000;
}

// Atomically increments `field` only while it is below `limit`.
// A full counter makes the filter miss, so the upsert collides with the unique
// index; one retry covers two first-of-day requests racing to insert.
async function incrementBelowLimit(
  db: Db,
  collection: string,
  key: Record<string, string>,
  field: string,
  limit: number
): Promise<number | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const doc = await db.collection(collection).findOneAndUpdate(
        { ...key, $or: [{ [field]: { $lt: limit } }, { [field]: { $exists: false } }] },
        { $inc: { [field]: 1 }, $set: { updatedAt: new Date() } },
        { upsert: true, returnDocument: "after" }
      );
      return (doc?.[field] as number | undefined) ?? 1;
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
  return null;
}

async function decrement(
  db: Db,
  collection: string,
  key: Record<string, string>,
  field: string
): Promise<void> {
  try {
    await db.collection(collection).updateOne(
      { ...key, [field]: { $gt: 0 } },
      { $inc: { [field]: -1 } }
    );
  } catch (err) {
    console.error("Usage refund failed:", err);
  }
}

export async function checkAndIncrementFeature(
  rawIP: string,
  feature: Feature
): Promise<FeatureRateLimitResult> {
  const db = await getDB();
  const date = getAESTDate();
  const ip = hashIP(rawIP);

  const globalCount = await incrementBelowLimit(db, "global_usage", { date }, "count", GLOBAL_LIMIT);
  if (globalCount === null) {
    const ipDoc = await db.collection("ip_usage").findOne({ ip, date });
    return {
      allowed: false,
      reason: "global_limit",
      featureCount: (ipDoc?.[feature] as number | undefined) ?? 0,
      globalCount: GLOBAL_LIMIT,
    };
  }

  const refundGlobal = () => decrement(db, "global_usage", { date }, "count");

  const featureCount = await incrementBelowLimit(db, "ip_usage", { ip, date }, feature, FEATURE_LIMITS[feature]);
  if (featureCount === null) {
    await refundGlobal();
    return {
      allowed: false,
      reason: "feature_limit",
      featureCount: FEATURE_LIMITS[feature],
      globalCount: globalCount - 1,
    };
  }

  return {
    allowed: true,
    featureCount,
    globalCount,
    refund: async () => {
      await Promise.all([refundGlobal(), decrement(db, "ip_usage", { ip, date }, feature)]);
    },
  };
}

export async function checkAndIncrementGlobal(): Promise<
  { allowed: true; globalCount: number; refund: RefundFn } | { allowed: false; globalCount: number }
> {
  const db = await getDB();
  const date = getAESTDate();

  const globalCount = await incrementBelowLimit(db, "global_usage", { date }, "count", GLOBAL_LIMIT);
  if (globalCount === null) {
    return { allowed: false, globalCount: GLOBAL_LIMIT };
  }

  return {
    allowed: true,
    globalCount,
    refund: () => decrement(db, "global_usage", { date }, "count"),
  };
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
