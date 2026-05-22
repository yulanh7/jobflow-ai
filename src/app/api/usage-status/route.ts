// Returns current per-feature usage counts for the requesting IP (read-only, no increment)

import { NextRequest, NextResponse } from "next/server";
import { getUsageStatus, FEATURE_LIMITS, GLOBAL_LIMIT, getResetTimeISO } from "@/lib/rateLimit";

function getIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

export async function GET(req: NextRequest) {
  try {
    const { analyze, documents, globalCount } = await getUsageStatus(getIP(req));
    return NextResponse.json({
      analyze,
      documents,
      globalCount,
      limits: FEATURE_LIMITS,
      globalLimit: GLOBAL_LIMIT,
      resetAt: getResetTimeISO(),
    });
  } catch {
    return NextResponse.json({
      analyze: 0,
      documents: 0,
      globalCount: 0,
      limits: FEATURE_LIMITS,
      globalLimit: GLOBAL_LIMIT,
      resetAt: null,
    });
  }
}
