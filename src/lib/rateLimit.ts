import { createHash } from "crypto";
import { Redis } from "@upstash/redis";

export const GLOBAL_LIMIT = 40;

export const FEATURE_LIMITS = {
  analyze: 2,
  documents: 2,
} as const;

export type Feature = keyof typeof FEATURE_LIMITS;

// Counters outlive the AEST day they belong to, then expire on their own
const KEY_TTL_SECONDS = 172800;

// Increments only while below the limit; returns the new count, or -1 when full.
// Runs as one Lua script so concurrent requests can't overshoot the limit.
const INCREMENT_BELOW_LIMIT = `
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
if current >= tonumber(ARGV[1]) then return -1 end
local next = redis.call("INCR", KEYS[1])
if next == 1 then redis.call("EXPIRE", KEYS[1], ARGV[2]) end
return next`;

const DECREMENT_ABOVE_ZERO = `
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
if current > 0 then return redis.call("DECR", KEYS[1]) end
return 0`;

// Created lazily so builds without Redis env vars still succeed.
// Reads UPSTASH_REDIS_REST_URL/TOKEN, falling back to KV_REST_API_URL/TOKEN.
let redis: Redis | undefined;
function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error("[Upstash Redis] Missing REST URL or token environment variable");
    }
    redis = new Redis({ url, token });
  }
  return redis;
}

function getAESTDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
  }).format(new Date());
}

function hashIP(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function globalKey(date: string): string {
  return `usage:global:${date}`;
}

function featureKey(ip: string, date: string, feature: Feature): string {
  return `usage:ip:${ip}:${date}:${feature}`;
}

export type RefundFn = () => Promise<void>;

export type FeatureRateLimitResult =
  | { allowed: true; featureCount: number; globalCount: number; refund: RefundFn }
  | { allowed: false; reason: "feature_limit" | "global_limit"; featureCount: number; globalCount: number };

async function incrementBelowLimit(key: string, limit: number): Promise<number | null> {
  const count = await getRedis().eval<[number, number], number>(
    INCREMENT_BELOW_LIMIT,
    [key],
    [limit, KEY_TTL_SECONDS]
  );
  return count === -1 ? null : count;
}

async function decrement(key: string): Promise<void> {
  try {
    await getRedis().eval<[], number>(DECREMENT_ABOVE_ZERO, [key], []);
  } catch (err) {
    console.error("Usage refund failed:", err);
  }
}

async function getCount(key: string): Promise<number> {
  return Number((await getRedis().get<number>(key)) ?? 0);
}

export async function checkAndIncrementFeature(
  rawIP: string,
  feature: Feature
): Promise<FeatureRateLimitResult> {
  const date = getAESTDate();
  const gKey = globalKey(date);
  const fKey = featureKey(hashIP(rawIP), date, feature);

  const globalCount = await incrementBelowLimit(gKey, GLOBAL_LIMIT);
  if (globalCount === null) {
    return {
      allowed: false,
      reason: "global_limit",
      featureCount: await getCount(fKey),
      globalCount: GLOBAL_LIMIT,
    };
  }

  const featureCount = await incrementBelowLimit(fKey, FEATURE_LIMITS[feature]);
  if (featureCount === null) {
    await decrement(gKey);
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
      await Promise.all([decrement(gKey), decrement(fKey)]);
    },
  };
}

export async function checkAndIncrementGlobal(): Promise<
  { allowed: true; globalCount: number; refund: RefundFn } | { allowed: false; globalCount: number }
> {
  const gKey = globalKey(getAESTDate());

  const globalCount = await incrementBelowLimit(gKey, GLOBAL_LIMIT);
  if (globalCount === null) {
    return { allowed: false, globalCount: GLOBAL_LIMIT };
  }

  return {
    allowed: true,
    globalCount,
    refund: () => decrement(gKey),
  };
}

export async function getUsageStatus(rawIP: string): Promise<{
  analyze: number;
  documents: number;
  globalCount: number;
}> {
  const date = getAESTDate();
  const ip = hashIP(rawIP);

  const [analyze, documents, globalCount] = await getRedis().mget<(number | null)[]>(
    featureKey(ip, date, "analyze"),
    featureKey(ip, date, "documents"),
    globalKey(date)
  );

  return {
    analyze: Number(analyze ?? 0),
    documents: Number(documents ?? 0),
    globalCount: Number(globalCount ?? 0),
  };
}

export function getResetTimeISO(): string {
  const date = getAESTDate();
  const [y, m, d] = date.split("-").map(Number);
  const tomorrowMidnightUTC = Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 10 * 3600 * 1000;
  return new Date(tomorrowMidnightUTC).toISOString();
}
