import { createHash } from "crypto";
import clientPromise from "./mongodb";

export const IP_LIMIT = 3;
export const GLOBAL_LIMIT = 40;

function getAESTDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
  }).format(new Date());
}

// Hash IP for privacy — never store raw IPs
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
      { expireAfterSeconds: 172800 } // auto-delete after 48h
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

export type RateLimitResult =
  | { allowed: true; ipCount: number; globalCount: number }
  | { allowed: false; reason: "ip_limit" | "global_limit"; ipCount: number; globalCount: number };

export async function checkAndIncrement(rawIP: string): Promise<RateLimitResult> {
  const db = await getDB();
  const date = getAESTDate();
  const ip = hashIP(rawIP);
  const now = new Date();

  // Check global limit first (cheapest rejection)
  const globalDoc = await db.collection("global_usage").findOne({ date });
  if (globalDoc && globalDoc.count >= GLOBAL_LIMIT) {
    return { allowed: false, reason: "global_limit", ipCount: 0, globalCount: globalDoc.count };
  }

  // Check IP limit
  const ipDoc = await db.collection("ip_usage").findOne({ ip, date });
  if (ipDoc && ipDoc.count >= IP_LIMIT) {
    return {
      allowed: false,
      reason: "ip_limit",
      ipCount: ipDoc.count,
      globalCount: globalDoc?.count ?? 0,
    };
  }

  // Increment both atomically
  const [updatedIP, updatedGlobal] = await Promise.all([
    db.collection("ip_usage").findOneAndUpdate(
      { ip, date },
      { $inc: { count: 1 }, $set: { updatedAt: now } },
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
    ipCount: updatedIP?.count ?? 1,
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
  ipCount: number;
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
    ipCount: ipDoc?.count ?? 0,
    globalCount: globalDoc?.count ?? 0,
  };
}

export function getResetTimeISO(): string {
  const date = getAESTDate();
  const [y, m, d] = date.split("-").map(Number);
  // Tomorrow midnight Sydney — approximate as UTC+10
  const tomorrowMidnightUTC = Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 10 * 3600 * 1000;
  return new Date(tomorrowMidnightUTC).toISOString();
}
